'use strict';

const { randomUUID } = require('crypto');
const { prisma } = require('../prisma/client');
const { hash } = require('./password.service');
const { record } = require('./history.service');
const { sendConfirmationEmail } = require('./mail.service');
const { provisionSchema, dropSchema } = require('./tenant-schema.service');
const { ConflictError, ForbiddenError, NotFoundError, BadRequestError } = require('../errors');
const { Prisma } = require('@prisma/client');

const SORT_COL = { id: 'id', name: 'name', email: 'email', confirmed: 'confirmed', status: 'status', createdAt: 'createdAt' };
const FILTER_COLS = new Set(['name', 'email', 'image', 'confirmationCode']);

function mapUser(u) {
  return {
    id: u.id, name: u.name, firstName: u.firstName, lastName: u.lastName,
    email: u.email, confirmed: u.confirmed, active: u.status === 1,
    unitOnly: u.unitOnly, image: u.image,
    createdAt: u.createdAt, updatedAt: u.updatedAt,
    roles: u.userRoles.map((ur) => ur.role.name),
  };
}

function buildOperatorFilter(column, operator, value) {
  switch (operator) {
    case 'equal':        return { equals: value };
    case 'not-equal':    return { not: { equals: value } };
    case 'contains':     return { contains: value, mode: 'insensitive' };
    case 'not-contains': return { NOT: { contains: value, mode: 'insensitive' } };
    case 'empty':        return { in: ['', null] };
    case 'not-empty':    return { notIn: ['', null] };
    case 'starts-with':  return { startsWith: value, mode: 'insensitive' };
    case 'ends-with':    return { endsWith: value, mode: 'insensitive' };
    default: return { contains: value, mode: 'insensitive' };
  }
}

async function resolveRoleIds(roleNames, fallbackName) {
  if (!roleNames || roleNames.length === 0) {
    const fallback = await prisma.role.findUnique({ where: { name: fallbackName }, select: { id: true } });
    if (!fallback) throw new NotFoundError(`default role "${fallbackName}" not seeded`);
    return [fallback.id];
  }
  const roles = await prisma.role.findMany({ where: { name: { in: roleNames } }, select: { id: true, name: true } });
  if (roles.length !== roleNames.length) {
    const found = new Set(roles.map((r) => r.name));
    const missing = roleNames.filter((n) => !found.has(n));
    throw new BadRequestError(`unknown-roles: ${missing.join(',')}`);
  }
  return roles.map((r) => r.id);
}

/**
 * Tenant-membership predicate, post Tenant-removal.
 * `tenant.tenantId` here is the Company user's id (legacy field name kept).
 * A user belongs to the company iff:
 *   - they ARE the Company user (id === companyUserId), OR
 *   - their companyId points to the Company user
 */
function companyMembershipFilter(companyUserId) {
  return { OR: [{ id: companyUserId }, { companyId: companyUserId }] };
}

async function list(tenant, q) {
  const page = q.page ?? 1; const perPage = q.perPage ?? 10;
  const sort = q.sort ?? 'id'; const order = q.order ?? 'desc';
  const where = { deletedAt: null, ...companyMembershipFilter(tenant.tenantId) };
  if (q.search) where.AND = [{ OR: [
    { name: { contains: q.search, mode: 'insensitive' } },
    { email: { contains: q.search, mode: 'insensitive' } },
  ] }];
  if (q.name) where.name = { contains: q.name, mode: 'insensitive' };
  if (q.email) where.email = { contains: q.email, mode: 'insensitive' };
  if (q.confirmed !== undefined) where.confirmed = q.confirmed === 'true';
  if (q.active !== undefined) where.status = q.active === 'true' ? 1 : 0;

  if (Array.isArray(q.filters)) {
    for (const f of q.filters) {
      if (!f.column || !f.operator) continue;
      if (FILTER_COLS.has(f.column)) where[f.column] = buildOperatorFilter(f.column, f.operator, f.value ?? '');
    }
  }

  const [rows, total] = await prisma.$transaction([
    prisma.user.findMany({
      where, orderBy: { [SORT_COL[sort] ?? 'id']: order },
      skip: (page - 1) * perPage, take: perPage,
      include: { userRoles: { include: { role: { select: { name: true } } } } },
    }),
    prisma.user.count({ where }),
  ]);
  return { data: rows.map(mapUser), total, page, perPage };
}

async function summary(tenant, q) {
  const type = q.type ?? 'non-empty';
  const columns = (q.columns ?? [...FILTER_COLS]).filter((c) => FILTER_COLS.has(c));
  const baseWhere = { deletedAt: null, ...companyMembershipFilter(tenant.tenantId) };
  const result = {};
  for (const col of columns) {
    if (type === 'empty') {
      result[col] = await prisma.user.count({ where: { ...baseWhere, [col]: { in: ['', null] } } });
    } else if (type === 'non-empty') {
      result[col] = await prisma.user.count({ where: { ...baseWhere, [col]: { notIn: ['', null] } } });
    } else if (type === 'distinct') {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT COUNT(DISTINCT "${col}") AS cnt FROM public.users
         WHERE deleted_at IS NULL
           AND (id = $1 OR company_id = $1)
           AND "${col}" IS NOT NULL AND "${col}" != ''`,
        tenant.tenantId,
      );
      result[col] = Number(rows[0]?.cnt ?? 0);
    } else {
      result[col] = await prisma.user.count({ where: baseWhere });
    }
  }
  return { type, columns: result };
}

async function listAll(q) {
  const page = q.page ?? 1; const perPage = q.perPage ?? 25;
  const where = q.deleted === 'true' ? { deletedAt: { not: null } } : { deletedAt: null };
  if (q.search) where.OR = [{ name: { contains: q.search, mode: 'insensitive' } }, { email: { contains: q.search, mode: 'insensitive' } }];
  if (q.name) where.name = { contains: q.name, mode: 'insensitive' };
  if (q.email) where.email = { contains: q.email, mode: 'insensitive' };
  if (q.confirmed !== undefined) where.confirmed = q.confirmed === 'true';
  if (q.active !== undefined && q.deleted !== 'true') where.status = q.active === 'true' ? 1 : 0;
  if (Array.isArray(q.roles) && q.roles.length) {
    where.userRoles = { some: { role: { name: { in: q.roles } } } };
  }
  const [rows, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { [SORT_COL[q.sort ?? 'id'] ?? 'id']: q.order ?? 'asc' },
      skip: (page - 1) * perPage, take: perPage,
      include: { userRoles: { include: { role: { select: { name: true } } } } },
    }),
    prisma.user.count({ where }),
  ]);
  // companyName: look up the Company-role user named by u.companyId
  // (or by u.id itself if the user IS a Company user).
  const ids = Array.from(new Set(rows.map((u) => {
    const isCompany = u.userRoles.some((ur) => ur.role.name === 'Company');
    return isCompany ? u.id : (u.companyId || 0);
  }).filter(Boolean)));
  const companies = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const nameById = new Map(companies.map((c) => [c.id, c.name]));
  return {
    data: rows.map((u) => {
      const isCompany = u.userRoles.some((ur) => ur.role.name === 'Company');
      const companyId = isCompany ? u.id : (u.companyId || null);
      return { ...mapUser(u), companyId, companyName: companyId ? (nameById.get(companyId) ?? '') : '' };
    }),
    total, page, perPage,
  };
}

async function findOne(tenant, id) {
  const u = await prisma.user.findFirst({
    where: { id, deletedAt: null, ...companyMembershipFilter(tenant.tenantId) },
    include: { userRoles: { include: { role: { select: { name: true } } } } },
  });
  if (!u) throw new NotFoundError('user-not-found');
  return mapUser(u);
}

async function findUserInTenantOrThrow(tenant, id) {
  const u = await prisma.user.findFirst({
    where: { id, deletedAt: null, ...companyMembershipFilter(tenant.tenantId) },
    select: { id: true, email: true },
  });
  if (!u) throw new NotFoundError('user-not-found');
  return u;
}

/**
 * Create a user attached to the current company.
 *   role=Company  → the new user IS a new company. Their schema (tenant_<id>)
 *                   is provisioned in the same transaction. If schema
 *                   provisioning fails the user create is rolled back.
 *   role=User     → companyId is set to the calling Company's id (or to the
 *                   explicit companyId in the dto if Super Admin is creating
 *                   under a specific company).
 */
async function create(tenant, actor, dto) {
  const existing = await prisma.user.findUnique({ where: { email: dto.email }, select: { id: true, deletedAt: true } });
  if (existing && !existing.deletedAt) throw new ConflictError('email-already-in-use');

  const roleNames = dto.roles ?? (dto.roleId ? [] : ['User']);
  const roleIds = dto.roleId
    ? [await (async () => {
        const r = await prisma.role.findUnique({ where: { id: Number(dto.roleId) }, select: { id: true } });
        if (!r) throw new NotFoundError('role-not-found');
        return r.id;
      })()]
    : await resolveRoleIds(roleNames, 'User');

  const isCompany = roleNames.includes('Company');
  const subUserCompanyId = isCompany ? 0 : (dto.companyId ?? tenant.tenantId ?? 0);

  const passwordHash = await hash(dto.password);
  const wantsConfirmEmail = dto.sendConfirmationEmail === true && !dto.confirmed;
  const confirmCode = wantsConfirmEmail ? randomUUID() : '';

  try {
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: dto.name,
          firstName: dto.firstName ?? dto.name,
          lastName: dto.lastName ?? '',
          email: dto.email,
          password: passwordHash,
          companyId: subUserCompanyId,
          timezone: dto.timezone ?? 'Europe/Stockholm',
          confirmed: dto.confirmed ?? false,
          confirmationCode: confirmCode,
          status: dto.active === false || dto.status === 0 ? 0 : 1,
          unitOnly: dto.unitOnly ?? false,
          image: dto.image ?? '',
        },
      });
      await tx.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId: user.id, roleId })),
        skipDuplicates: true,
      });
      // Provision the per-Company schema in the same transaction. If this
      // fails the user insert rolls back automatically.
      if (isCompany) {
        await provisionSchema(tx, user.id);
      }
      return user;
    });
    await record({ actor, typeName: 'User', entityId: created.id, text: `created user ${created.email}${isCompany ? ' (Company — tenant schema provisioned)' : ''}`, icon: 'user', cssClass: 'user' });
    if (wantsConfirmEmail) {
      const confirmUrl = `${process.env.APP_URL}/account/confirm/${confirmCode}`;
      sendConfirmationEmail({ toEmail: created.email, toName: created.name, confirmUrl })
        .catch((err) => console.error('confirmation email failed:', err.message));
    }
    // Company-role create may have come from a Super Admin with no
    // tenant context. Resolve findOne against the new user's own
    // company id so the response works either way.
    const lookupTenant = isCompany ? { tenantId: created.id } : tenant;
    return findOne(lookupTenant, created.id);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictError('email-already-in-use');
    throw err;
  }
}

async function update(tenant, actor, id, dto) {
  if (id === actor.id) {
    if (dto.active === false || dto.status === 0) throw new ForbiddenError('cannot-disable-self');
    if (dto.roles !== undefined && actor.isAdmin && !dto.roles.includes('Administrator')) {
      throw new ForbiddenError('cannot-demote-self-from-administrator');
    }
  }
  const target = await findUserInTenantOrThrow(tenant, id);
  const data = {};
  if (dto.name !== undefined) data.name = dto.name;
  if (dto.email !== undefined) data.email = dto.email;
  if (dto.firstName !== undefined) data.firstName = dto.firstName;
  if (dto.lastName !== undefined) data.lastName = dto.lastName;
  if (dto.confirmed !== undefined) data.confirmed = dto.confirmed;
  if (dto.active !== undefined) data.status = dto.active ? 1 : 0;
  if (dto.status !== undefined && dto.active === undefined) data.status = dto.status === 1 ? 1 : 0;
  if (dto.unitOnly !== undefined) data.unitOnly = dto.unitOnly;
  if (dto.timezone !== undefined) data.timezone = dto.timezone;
  if (dto.password) data.password = await hash(dto.password);

  try {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) await tx.user.update({ where: { id: target.id }, data });
      if (dto.roles !== undefined) {
        const roleIds = await resolveRoleIds(dto.roles, 'User');
        await tx.userRole.deleteMany({ where: { userId: target.id } });
        await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: target.id, roleId })), skipDuplicates: true });
      } else if (dto.roleId !== undefined) {
        const role = await tx.role.findUnique({ where: { id: Number(dto.roleId) }, select: { id: true, all: true } });
        if (!role) throw new NotFoundError('role-not-found');
        if (role.all && !actor.isAdmin) throw new ForbiddenError('cannot-assign-super-admin');
        await tx.userRole.deleteMany({ where: { userId: target.id } });
        await tx.userRole.create({ data: { userId: target.id, roleId: role.id } });
      }
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictError('email-already-in-use');
    throw err;
  }
  await record({ actor, typeName: 'User', entityId: target.id, text: `updated user ${target.email}`, icon: 'user', cssClass: 'user' });
  return findOne(tenant, target.id);
}

async function softDelete(tenant, actor, id) {
  if (id === actor.id) throw new ForbiddenError('cannot-delete-self');
  const target = await findUserInTenantOrThrow(tenant, id);
  await prisma.user.update({ where: { id: target.id }, data: { deletedAt: new Date(), status: 0 } });
  await record({ actor, typeName: 'User', entityId: target.id, text: `deleted user ${target.email}`, icon: 'user', cssClass: 'user' });
}

async function toggleStatus(tenant, actor, id, active) {
  if (id === actor.id && !active) throw new ForbiddenError('cannot-disable-self');
  const target = await findUserInTenantOrThrow(tenant, id);
  await prisma.user.update({ where: { id: target.id }, data: { status: active ? 1 : 0 } });
  await record({ actor, typeName: 'User', entityId: target.id, text: `${active ? 'enabled' : 'disabled'} user ${target.email}`, icon: 'user' });
  return findOne(tenant, target.id);
}

async function toggleConfirm(tenant, actor, id, confirmed) {
  const target = await findUserInTenantOrThrow(tenant, id);
  await prisma.user.update({ where: { id: target.id }, data: { confirmed } });
  await record({ actor, typeName: 'User', entityId: target.id, text: `${confirmed ? 'confirmed' : 'unconfirmed'} user ${target.email}`, icon: 'user' });
  return findOne(tenant, target.id);
}

async function listDeleted(tenant, q) {
  const page = q.page ?? 1; const perPage = q.perPage ?? 10;
  const where = { deletedAt: { not: null }, ...companyMembershipFilter(tenant.tenantId) };
  if (q.search) where.AND = [{ OR: [
    { name: { contains: q.search, mode: 'insensitive' } },
    { email: { contains: q.search, mode: 'insensitive' } },
  ] }];
  const [rows, total] = await prisma.$transaction([
    prisma.user.findMany({
      where, orderBy: { deletedAt: 'desc' }, skip: (page - 1) * perPage, take: perPage,
      include: { userRoles: { include: { role: { select: { name: true } } } } },
    }),
    prisma.user.count({ where }),
  ]);
  return { data: rows.map(mapUser), total, page, perPage };
}

async function changePassword(tenant, actor, id, plain) {
  if (!plain) throw new BadRequestError('password-required');
  const target = await findUserInTenantOrThrow(tenant, id);
  const h = await hash(plain);
  await prisma.user.update({ where: { id: target.id }, data: { password: h } });
  await record({ actor, typeName: 'User', entityId: target.id, text: `changed password for user ${target.email}`, icon: 'user' });
  return { ok: true };
}

async function restore(tenant, actor, id) {
  const target = await prisma.user.findFirst({
    where: { id, deletedAt: { not: null }, ...companyMembershipFilter(tenant.tenantId) },
    select: { id: true, email: true },
  });
  if (!target) throw new NotFoundError('user-not-found');
  await prisma.user.update({ where: { id: target.id }, data: { deletedAt: null, status: 1 } });
  await record({ actor, typeName: 'User', entityId: target.id, text: `restored user ${target.email}`, icon: 'user' });
  return findOne(tenant, target.id);
}

async function permanentDelete(tenant, actor, id) {
  if (id === actor.id) throw new ForbiddenError('cannot-delete-self');
  const target = await prisma.user.findFirst({
    where: { id, deletedAt: { not: null }, ...companyMembershipFilter(tenant.tenantId) },
    include: { userRoles: { select: { role: { select: { name: true } } } } },
  });
  if (!target) throw new NotFoundError('user-not-found-or-not-soft-deleted');
  const wasCompany = (target.userRoles ?? []).some((ur) => ur.role?.name === 'Company');
  await prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId: target.id } });
    await tx.user.delete({ where: { id: target.id } });
  });
  if (wasCompany) {
    try { await dropSchema(target.id); }
    catch (err) { console.error(`drop tenant_${target.id} failed: ${err.message}`); }
  }
  await record({ actor, typeName: 'User', entityId: target.id, text: `permanently deleted user ${target.email}${wasCompany ? ' (and its tenant schema)' : ''}`, icon: 'user' });
}

async function resendConfirmation(tenant, actor, id) {
  const target = await findUserInTenantOrThrow(tenant, id);
  const code = randomUUID();
  await prisma.user.update({ where: { id: target.id }, data: { confirmationCode: code } });
  await record({ actor, typeName: 'User', entityId: target.id, text: `re-issued confirmation code for ${target.email}`, icon: 'user' });
  const confirmUrl = `${process.env.APP_URL}/account/confirm/${code}`;
  sendConfirmationEmail({ toEmail: target.email, toName: target.email, confirmUrl })
    .catch((err) => console.error('resend confirmation email failed:', err.message));
  return { ok: true, queued: true };
}

async function findOneGlobal(id) {
  const u = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: { userRoles: { include: { role: { select: { name: true } } } } },
  });
  if (!u) throw new NotFoundError('user-not-found');
  const isCompany = u.userRoles.some((ur) => ur.role.name === 'Company');
  const companyId = isCompany ? u.id : (u.companyId || null);
  let companyName = '';
  if (companyId) {
    const c = await prisma.user.findUnique({ where: { id: companyId }, select: { name: true } });
    companyName = c?.name ?? '';
  }
  return { ...mapUser(u), companyId, companyName };
}

async function recordImpersonateStart(actor, targetId) {
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { email: true } });
  await record({ actor, typeName: 'User', entityId: targetId, text: `started impersonating user ${target?.email ?? targetId}`, icon: 'user-secret', cssClass: 'impersonate-start' });
}

async function recordImpersonateStop(actor, originalAdminId) {
  await record({ actor, typeName: 'User', entityId: originalAdminId, text: `stopped impersonation (returned to admin ${originalAdminId})`, icon: 'user-check', cssClass: 'impersonate-stop' });
}

module.exports = {
  list, listAll, findOne, findOneGlobal, summary, create, update,
  softDelete, toggleStatus, toggleConfirm, listDeleted,
  changePassword, restore, permanentDelete, resendConfirmation,
  recordImpersonateStart, recordImpersonateStop,
};
