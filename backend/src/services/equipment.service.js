'use strict';

const { withTenant } = require('../prisma/client');
const { NotFoundError } = require('../errors');

const SELECT = `id, company_id AS "companyId", sort_order AS "sortOrder", parent_id AS "parentId",
  type_id AS "typeId", name, description, icon, is_active AS "isActive",
  created_at AS "createdAt", updated_at AS "updatedAt", deleted_at AS "deletedAt"`;

async function list(tenant, opts = {}) {
  const where = opts.includeDeleted ? '' : 'WHERE deleted_at IS NULL';
  return withTenant(tenant.schemaName, (tx) =>
    tx.$queryRawUnsafe(`SELECT ${SELECT} FROM equipment ${where} ORDER BY parent_id, sort_order, id`),
  );
}

async function findOne(tenant, id) {
  const rows = await withTenant(tenant.schemaName, (tx) =>
    tx.$queryRawUnsafe(`SELECT ${SELECT} FROM equipment WHERE id = $1 AND deleted_at IS NULL`, id),
  );
  if (!rows[0]) throw new NotFoundError('equipment-not-found');
  return rows[0];
}

async function create(tenant, dto) {
  const rows = await withTenant(tenant.schemaName, (tx) =>
    tx.$queryRawUnsafe(
      `INSERT INTO equipment (company_id, sort_order, parent_id, type_id, name, description, icon, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
       RETURNING ${SELECT}`,
      0, dto.sortOrder ?? 0, dto.parentId ?? 0, dto.typeId ?? 0, dto.name, dto.description ?? null, dto.icon ?? 'noimage.jpg', dto.isActive ?? true,
    ),
  );
  return rows[0];
}

async function update(tenant, id, dto) {
  const sets = [];
  const values = [];
  let i = 1;
  const push = (sql, value) => { sets.push(sql.replace('$?', `$${i++}`)); values.push(value); };

  if (dto.name !== undefined)        push('name = $?',        dto.name);
  if (dto.parentId !== undefined)    push('parent_id = $?',   dto.parentId);
  if (dto.typeId !== undefined)      push('type_id = $?',     dto.typeId);
  if (dto.description !== undefined) push('description = $?', dto.description);
  if (dto.icon !== undefined)        push('icon = $?',        dto.icon);
  if (dto.sortOrder !== undefined)   push('sort_order = $?',  dto.sortOrder);
  if (dto.isActive !== undefined)    push('is_active = $?',   dto.isActive);

  if (sets.length === 0) return findOne(tenant, id);
  sets.push('updated_at = now()');
  values.push(id);

  const rows = await withTenant(tenant.schemaName, (tx) =>
    tx.$queryRawUnsafe(`UPDATE equipment SET ${sets.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING ${SELECT}`, ...values),
  );
  if (!rows[0]) throw new NotFoundError('equipment-not-found');
  return rows[0];
}

async function softDelete(tenant, id) {
  const result = await withTenant(tenant.schemaName, (tx) =>
    tx.$executeRawUnsafe(`UPDATE equipment SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, id),
  );
  if (result === 0) throw new NotFoundError('equipment-not-found');
}

module.exports = { list, findOne, create, update, softDelete };
