'use strict';

const { prisma } = require('../prisma/client');
const { NotFoundError, ForbiddenError } = require('../errors');

// `feedback.tenantId` column now stores the Company user's id
// (legacy field name kept per TENANT_REMOVAL decision 4 — see
// MIGRATION_NOTES §13). For an actor:
//   Administrator → null (sees all when isAdmin; can filter via ?tenantId=)
//   Company       → actor.id
//   User          → actor.companyId
function actorCompanyUserId(actor) {
  if (!actor) return null;
  if (actor.isAdmin) return null;
  if (Array.isArray(actor.roles) && actor.roles.includes('Company')) return actor.id;
  return actor.companyId || null;
}

const SORT_MAP = { id: 'id', status: 'status', createdAt: 'createdAt', tenantId: 'tenantId' };

function toRow(r) {
  return { id: r.id, body: r.body, status: r.status, tenantId: r.tenantId, tenantNameSnap: r.tenantNameSnap, userId: r.userId, userEmailSnap: r.userEmailSnap, userNameSnap: r.userNameSnap, visibleToTenant: r.visibleToTenant, createdAt: r.createdAt };
}

async function list(actor, q) {
  const page = q.page ?? 1;
  const perPage = q.perPage ?? 10;
  const sort = SORT_MAP[q.sort ?? 'id'] ?? 'id';
  const order = q.order ?? 'desc';
  const where = { deletedAt: null };

  if (!actor.isAdmin) {
    const cid = actorCompanyUserId(actor);
    if (cid == null) return { data: [], total: 0, page, perPage };
    where.tenantId = cid;
    where.visibleToTenant = true;
  } else if (q.tenantId !== undefined) {
    where.tenantId = Number(q.tenantId);
  }

  if (q.search) {
    where.OR = [
      { body: { contains: q.search, mode: 'insensitive' } },
      { userEmailSnap: { contains: q.search, mode: 'insensitive' } },
      { tenantNameSnap: { contains: q.search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await prisma.$transaction([
    prisma.feedback.findMany({ where, orderBy: { [sort]: order }, skip: (page - 1) * perPage, take: perPage }),
    prisma.feedback.count({ where }),
  ]);
  return { data: rows.map(toRow), total, page, perPage };
}

async function findOne(actor, id) {
  const row = await prisma.feedback.findFirst({ where: { id, deletedAt: null } });
  if (!row) throw new NotFoundError('feedback-not-found');
  if (!actor.isAdmin) {
    const cid = actorCompanyUserId(actor);
    if (row.tenantId !== cid || !row.visibleToTenant) throw new NotFoundError('feedback-not-found');
  }
  return toRow(row);
}

async function create(actor, dto) {
  const tenantId = actor.isAdmin && dto.tenantId !== undefined
    ? Number(dto.tenantId)
    : actorCompanyUserId(actor);
  let tenantNameSnap = '';
  if (tenantId !== null) {
    // Snapshot the Company user's display name (= the company name).
    const companyUser = await prisma.user.findUnique({ where: { id: tenantId }, select: { name: true } });
    if (!companyUser) throw new NotFoundError('company-not-found');
    tenantNameSnap = companyUser.name;
  }
  const row = await prisma.feedback.create({ data: { body: dto.body, status: 1, tenantId, tenantNameSnap, userId: actor.id, userEmailSnap: actor.email, userNameSnap: actor.name } });
  return toRow(row);
}

async function update(actor, id, dto) {
  const row = await prisma.feedback.findFirst({ where: { id, deletedAt: null } });
  if (!row) throw new NotFoundError('feedback-not-found');
  if (!actor.isAdmin) throw new ForbiddenError('admin-only');
  const data = {};
  if (dto.body !== undefined) data.body = dto.body;
  if (dto.status !== undefined) data.status = dto.status;
  if (dto.visibleToTenant !== undefined) data.visibleToTenant = dto.visibleToTenant;
  const updated = await prisma.feedback.update({ where: { id }, data });
  return toRow(updated);
}

async function softDelete(actor, id) {
  const row = await prisma.feedback.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!row) throw new NotFoundError('feedback-not-found');
  if (!actor.isAdmin) throw new ForbiddenError('admin-only');
  await prisma.feedback.update({ where: { id }, data: { deletedAt: new Date() } });
}

module.exports = { list, findOne, create, update, softDelete };
