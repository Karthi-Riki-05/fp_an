'use strict';

const { withTenant } = require('../prisma/client');
const { NotFoundError } = require('../errors');

const TABLE = 'folders';
const SELECT = `f.id, f.name, f.equipment_id AS "equipmentId",
  f.folder_type AS "folderType", f.status,
  f.created_at AS "createdAt",
  e.name AS "equipmentName", t.name AS "folderTypeName"`;

const JOINS = `
  LEFT JOIN equipment e ON e.id = f.equipment_id
  LEFT JOIN types t ON t.id = f.folder_type`;

async function list(tenant, q = {}) {
  const page = q.page ?? 1;
  const perPage = q.perPage ?? 10;
  const skip = (page - 1) * perPage;
  const params = [];
  const where = ['f.deleted_at IS NULL'];
  if (q.search) { params.push(`%${q.search}%`); where.push(`f.name ILIKE $${params.length}`); }
  if (q.name)   { params.push(`%${q.name}%`); where.push(`f.name ILIKE $${params.length}`); }
  if (q.equipmentId !== undefined) { params.push(Number(q.equipmentId)); where.push(`f.equipment_id = $${params.length}`); }
  if (q.folderType !== undefined)  { params.push(Number(q.folderType));  where.push(`f.folder_type = $${params.length}`); }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const dir = q.order === 'asc' ? 'ASC' : 'DESC';

  return withTenant(tenant, async (tx) => {
    const data = await tx.$queryRawUnsafe(
      `SELECT ${SELECT} FROM ${TABLE} f ${JOINS} ${whereSql}
       ORDER BY f.id ${dir} LIMIT ${perPage} OFFSET ${skip}`,
      ...params,
    );
    const total = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM ${TABLE} f ${whereSql}`, ...params,
    );
    return { data, total: Number(total[0]?.count ?? 0n), page, perPage };
  });
}

async function findOne(tenant, id) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `SELECT ${SELECT} FROM ${TABLE} f ${JOINS} WHERE f.id = $1 AND f.deleted_at IS NULL`,
      id,
    ),
  );
  if (!rows[0]) throw new NotFoundError('folder-not-found');
  return rows[0];
}

async function create(tenant, dto) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `INSERT INTO ${TABLE} (name, equipment_id, folder_type, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now()) RETURNING id`,
      dto.name, Number(dto.equipmentId ?? 0), Number(dto.folderType ?? 0), Number(dto.status ?? 1),
    ),
  );
  return findOne(tenant, rows[0].id);
}

async function update(tenant, id, dto) {
  const sets = [];
  const values = [];
  const push = (sql, v) => { sets.push(sql.replace('$?', `$${values.length + 1}`)); values.push(v); };
  if (dto.name !== undefined) push('name = $?', dto.name);
  if (dto.equipmentId !== undefined) push('equipment_id = $?', Number(dto.equipmentId));
  if (dto.folderType !== undefined) push('folder_type = $?', Number(dto.folderType));
  if (dto.status !== undefined) push('status = $?', Number(dto.status));
  if (sets.length === 0) return findOne(tenant, id);
  sets.push('updated_at = now()');
  values.push(id);
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `UPDATE ${TABLE} SET ${sets.join(', ')} WHERE id = $${values.length} AND deleted_at IS NULL RETURNING id`,
      ...values,
    ),
  );
  if (!rows[0]) throw new NotFoundError('folder-not-found');
  return findOne(tenant, id);
}

async function softDelete(tenant, id) {
  const result = await withTenant(tenant, (tx) =>
    tx.$executeRawUnsafe(`UPDATE ${TABLE} SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, id),
  );
  if (result === 0) throw new NotFoundError('folder-not-found');
}

module.exports = { list, findOne, create, update, softDelete };
