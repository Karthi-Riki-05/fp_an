'use strict';

const { prisma } = require('../prisma/client');
const { record } = require('./history.service');
const { BadRequestError, ConflictError, ForbiddenError, NotFoundError } = require('../errors');
const { Prisma } = require('@prisma/client');

async function list() {
  const roles = await prisma.role.findMany({
    orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    include: { _count: { select: { rolePermissions: true, userRoles: true } } },
  });
  return roles.map((r) => ({ id: r.id, name: r.name, all: r.all, sort: r.sort, permissionCount: r._count.rolePermissions, userCount: r._count.userRoles }));
}

async function listPermissions() {
  return prisma.permission.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }], select: { id: true, name: true, displayName: true, sort: true } });
}

async function findOne(id) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: { rolePermissions: { include: { permission: { select: { name: true } } } }, _count: { select: { userRoles: true } } },
  });
  if (!role) throw new NotFoundError('role-not-found');
  return { id: role.id, name: role.name, all: role.all, sort: role.sort, userCount: role._count.userRoles, permissions: role.rolePermissions.map((rp) => rp.permission.name).sort() };
}

async function syncPermissions(tx, roleId, permissionNames) {
  if (permissionNames.length === 0) {
    await tx.rolePermission.deleteMany({ where: { roleId } });
    return;
  }
  const perms = await tx.permission.findMany({ where: { name: { in: permissionNames } }, select: { id: true, name: true } });
  if (perms.length !== permissionNames.length) {
    const found = new Set(perms.map((p) => p.name));
    const missing = permissionNames.filter((n) => !found.has(n));
    throw new BadRequestError(`unknown-permissions: ${missing.join(',')}`);
  }
  await tx.rolePermission.deleteMany({ where: { roleId } });
  await tx.rolePermission.createMany({ data: perms.map((p) => ({ roleId, permissionId: p.id })), skipDuplicates: true });
}

async function create(actor, dto) {
  if (dto.all && !actor.isAdmin) throw new ForbiddenError('cannot-create-super-admin-role');
  try {
    const role = await prisma.$transaction(async (tx) => {
      const r = await tx.role.create({ data: { name: dto.name, all: !!dto.all, sort: dto.sort ?? 0 } });
      await syncPermissions(tx, r.id, dto.permissions ?? []);
      return r;
    });
    await record({ actor, typeName: 'Role', entityId: role.id, text: `created role ${role.name}`, icon: 'shield' });
    return findOne(role.id);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictError('role-name-taken');
    throw err;
  }
}

async function update(actor, id, dto) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw new NotFoundError('role-not-found');
  if (role.all && !actor.isAdmin) throw new ForbiddenError('cannot-edit-super-admin-role');
  if (dto.all && !actor.isAdmin) throw new ForbiddenError('cannot-elevate-role-to-super-admin');

  const data = {};
  if (dto.name !== undefined) data.name = dto.name;
  if (dto.sort !== undefined) data.sort = dto.sort;

  // Administrator immunity: if this is the Administrator role (all=true),
  // force all=true regardless of incoming payload and skip permission sync.
  const isAdministratorRole = role.all;
  if (isAdministratorRole) {
    data.all = true;  // Cannot be demoted
  } else if (dto.all !== undefined) {
    data.all = dto.all;
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) await tx.role.update({ where: { id }, data });
      if (dto.permissions !== undefined && !isAdministratorRole) {
        await syncPermissions(tx, id, dto.permissions);
      }
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictError('role-name-taken');
    throw err;
  }
  await record({ actor, typeName: 'Role', entityId: id, text: `updated role ${dto.name ?? role.name}`, icon: 'shield' });
  return findOne(id);
}

async function remove(actor, id) {
  const role = await prisma.role.findUnique({ where: { id }, include: { _count: { select: { userRoles: true } } } });
  if (!role) throw new NotFoundError('role-not-found');
  if (role.all) throw new ForbiddenError('cannot-delete-administrator-role');
  if (role._count.userRoles > 0) throw new ConflictError('role-has-users-assigned');
  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: id } });
    await tx.role.delete({ where: { id } });
  });
  await record({ actor, typeName: 'Role', entityId: id, text: `deleted role ${role.name}`, icon: 'shield' });
}

module.exports = { list, listPermissions, findOne, create, update, remove };
