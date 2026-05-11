'use strict';

const { prisma, withTenant: withTenantCtx } = require('../prisma/client');
const { record } = require('./history.service');
const { NotFoundError, ConflictError } = require('../errors');

async function list() {
  return prisma.tenant.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, slug: true, name: true, schemaName: true, timezone: true, status: true, createdAt: true, _count: { select: { users: true } } },
  });
}

async function findOneOrThrow(id) {
  const t = await prisma.tenant.findUnique({
    where: { id },
    select: { id: true, slug: true, name: true, schemaName: true, timezone: true, status: true, primaryUserId: true, legacyDbName: true, createdAt: true, updatedAt: true, _count: { select: { users: true } } },
  });
  if (!t) throw new NotFoundError('tenant-not-found');
  return t;
}

async function create(actor, dto) {
  const existing = await prisma.tenant.findFirst({ where: { OR: [{ slug: dto.slug }, { name: dto.name }] }, select: { id: true } });
  if (existing) throw new ConflictError('tenant-slug-or-name-taken');

  const tenant = await prisma.$transaction(async (tx) => {
    const t = await tx.tenant.create({
      data: { slug: dto.slug, name: dto.name, schemaName: `tenant_${dto.slug}`, timezone: dto.timezone ?? 'Europe/Stockholm' },
    });
    const schemaName = `tenant_${t.id}`;
    await tx.tenant.update({ where: { id: t.id }, data: { schemaName } });
    await provisionSchema(tx, schemaName);
    return { ...t, schemaName };
  });

  if (actor) {
    await record({ actor, typeName: 'Tenant', entityId: tenant.id, text: `created tenant "${tenant.name}"`, icon: 'building' });
  }
  return tenant;
}

async function update(actor, id, dto) {
  await findOneOrThrow(id);
  const data = {};
  if (dto.name !== undefined) data.name = dto.name;
  if (dto.timezone !== undefined) data.timezone = dto.timezone;
  if (Object.keys(data).length === 0) return findOneOrThrow(id);
  try {
    const t = await prisma.tenant.update({ where: { id }, data });
    await record({ actor, typeName: 'Tenant', entityId: id, text: `updated tenant "${t.name}"`, icon: 'building' });
    return findOneOrThrow(id);
  } catch (err) {
    const { Prisma } = require('@prisma/client');
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictError('tenant-name-taken');
    throw err;
  }
}

async function setStatus(actor, id, status) {
  await findOneOrThrow(id);
  const t = await prisma.tenant.update({ where: { id }, data: { status } });
  await record({ actor, typeName: 'Tenant', entityId: id, text: `set tenant "${t.name}" status to ${status}`, icon: 'building' });
  return findOneOrThrow(id);
}

async function archive(actor, id) {
  return setStatus(actor, id, 'archived');
}

async function listUsers(tenantId, q) {
  await findOneOrThrow(tenantId);
  const page = q.page ?? 1;
  const perPage = q.perPage ?? 50;
  const where = { tenantId, status: true };
  const [rows, total] = await prisma.$transaction([
    prisma.tenantUser.findMany({
      where, orderBy: { id: 'asc' }, skip: (page - 1) * perPage, take: perPage,
      include: {
        user: { select: { id: true, name: true, email: true, status: true, deletedAt: true } },
        tenant: { select: { id: true, name: true } },
      },
    }),
    prisma.tenantUser.count({ where }),
  ]);
  return { data: rows.map((r) => ({ id: r.id, tenantId: r.tenantId, userId: r.userId, roleId: r.roleId, status: r.status, user: r.user })), total, page, perPage };
}

async function addUser(actor, tenantId, dto) {
  await findOneOrThrow(tenantId);
  const user = await prisma.user.findFirst({ where: { id: dto.userId, deletedAt: null }, select: { id: true, email: true } });
  if (!user) throw new NotFoundError('user-not-found');
  try {
    const membership = await prisma.tenantUser.upsert({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      update: { status: true, roleId: dto.roleId ?? undefined },
      create: { tenantId, userId: user.id, roleId: dto.roleId ?? null, status: true },
    });
    await record({ actor, typeName: 'Tenant', entityId: tenantId, text: `added user ${user.email} to tenant ${tenantId}`, icon: 'building' });
    return membership;
  } catch (err) {
    const { Prisma } = require('@prisma/client');
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictError('user-already-member');
    throw err;
  }
}

async function removeUser(actor, tenantId, userId) {
  const membership = await prisma.tenantUser.findUnique({ where: { tenantId_userId: { tenantId, userId } } });
  if (!membership) throw new NotFoundError('tenant-membership-not-found');
  await prisma.tenantUser.update({ where: { id: membership.id }, data: { status: false } });
  await record({ actor, typeName: 'Tenant', entityId: tenantId, text: `removed user ${userId} from tenant ${tenantId}`, icon: 'building' });
}

async function provisionSchema(tx, schemaName) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schemaName)) throw new Error(`unsafe schema name: ${schemaName}`);
  await tx.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
  const tables = await tx.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'tenant_template' AND table_type = 'BASE TABLE' ORDER BY table_name`,
  );
  for (const { table_name } of tables) {
    const exists = await tx.$queryRawUnsafe(
      `SELECT count(*) AS count FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
      schemaName, table_name,
    );
    if (exists[0]?.count && Number(exists[0].count) > 0) continue;
    await tx.$executeRawUnsafe(`CREATE TABLE "${schemaName}"."${table_name}" (LIKE "tenant_template"."${table_name}" INCLUDING ALL)`);
  }
}

/**
 * Drop a tenant schema — used as cleanup when user co-provisioning fails.
 * Safe to call even if the schema doesn't exist (IF EXISTS guard).
 */
async function dropSchema(schemaName) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schemaName)) throw new Error(`unsafe schema name: ${schemaName}`);
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
}

module.exports = { list, findOneOrThrow, create, update, setStatus, archive, listUsers, addUser, removeUser, provisionSchema, dropSchema };
