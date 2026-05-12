'use strict';

const jwt = require('jsonwebtoken');
const { prisma } = require('../prisma/client');
const { verify: verifyPassword, hash } = require('./password.service');
const { UnauthorizedError, ForbiddenError, NotFoundError } = require('../errors');

function parseTtlToSeconds(ttl) {
  if (/^\d+$/.test(ttl)) return Number(ttl);
  const m = ttl.match(/^(\d+)\s*([smhd])$/);
  if (!m) return 900;
  const n = Number(m[1]);
  switch (m[2]) {
    case 's': return n;
    case 'm': return n * 60;
    case 'h': return n * 3600;
    case 'd': return n * 86400;
    default:  return 900;
  }
}

function signToken(payload, ttl) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: ttl });
}

async function login(email, plainPassword) {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), deletedAt: null },
    include: {
      userRoles: { include: { role: true } },
      tenantUsers: { where: { status: true }, orderBy: { id: 'asc' } },
    },
  });

  if (!user || !user.password) throw new UnauthorizedError('invalid-credentials');

  const { ok, needsRehash } = await verifyPassword(plainPassword, user.password);
  if (!ok) throw new UnauthorizedError('invalid-credentials');

  if (needsRehash) {
    const fresh = await hash(plainPassword);
    await prisma.user.update({ where: { id: user.id }, data: { password: fresh } });
  }

  if (user.status !== 1) throw new UnauthorizedError('user-disabled');

  if (!user.confirmed) throw new ForbiddenError('account_not_confirmed');

  const roleNames = user.userRoles.map((ur) => ur.role.name);
  const isAdmin = user.userRoles.some((ur) => ur.role.all);
  const tenantId = isAdmin ? null : user.tenantUsers[0]?.tenantId ?? null;

  const ttl = process.env.JWT_ACCESS_TTL || '15m';
  const expiresIn = parseTtlToSeconds(ttl);

  const accessToken = signToken({ sub: user.id, email: user.email, tenantId, roles: roleNames, kind: 'web' }, ttl);

  return { accessToken, user: { id: user.id, email: user.email, name: user.name, tenantId, roles: roleNames }, expiresIn };
}

async function issueImpersonationToken({ targetUserId, impersonatorUserId }) {
  const target = await prisma.user.findFirst({
    where: { id: targetUserId, deletedAt: null },
    include: {
      userRoles: { include: { role: true } },
      tenantUsers: { where: { status: true }, orderBy: { id: 'asc' } },
    },
  });
  if (!target) throw new NotFoundError('user-not-found');
  if (target.status !== 1) throw new ForbiddenError('user-disabled');
  const targetRoleNames = target.userRoles.map((ur) => ur.role.name);
  if (target.userRoles.some((ur) => ur.role.all)) throw new ForbiddenError('cannot-impersonate-administrator');

  const tenantId = target.tenantUsers[0]?.tenantId ?? null;
  const ttl = process.env.JWT_IMPERSONATE_TTL || '30m';
  const expiresIn = parseTtlToSeconds(ttl);

  const payload = { sub: target.id, email: target.email, tenantId, roles: targetRoleNames, kind: 'web', impersonator_id: impersonatorUserId };
  const accessToken = signToken(payload, ttl);

  return { accessToken, user: { id: target.id, email: target.email, name: target.name, tenantId, roles: targetRoleNames, impersonatorId: impersonatorUserId }, expiresIn };
}

async function stopImpersonation(originalSuperAdminId) {
  const su = await prisma.user.findFirst({
    where: { id: originalSuperAdminId, deletedAt: null },
    include: { userRoles: { include: { role: true } } },
  });
  if (!su) throw new NotFoundError('super-admin-not-found');
  if (su.status !== 1) throw new ForbiddenError('super-admin-disabled');
  const roleNames = su.userRoles.map((ur) => ur.role.name);
  if (!su.userRoles.some((ur) => ur.role.all)) throw new ForbiddenError('not-an-administrator');

  const ttl = process.env.JWT_ACCESS_TTL || '15m';
  const expiresIn = parseTtlToSeconds(ttl);
  const accessToken = signToken({ sub: su.id, email: su.email, tenantId: null, roles: roleNames, kind: 'web' }, ttl);

  return { accessToken, user: { id: su.id, email: su.email, name: su.name, tenantId: null, roles: roleNames }, expiresIn };
}

module.exports = { login, issueImpersonationToken, stopImpersonation };
