'use strict';

const { withTenant } = require('../prisma/client');
const { NotFoundError } = require('../errors');

const TABLE = 'symbols';
const SELECT = `id, name, image, status, sort_order AS "sortOrder",
  created_at AS "createdAt"`;

async function list(tenant, q = {}) {
  const page = q.page ?? 1;
  const perPage = q.perPage ?? 50;
  const skip = (page - 1) * perPage;
  const params = [];
  const where = [];
  if (q.search) { params.push(`%${q.search}%`); where.push(`name ILIKE $${params.length}`); }
  if (q.name) { params.push(`%${q.name}%`); where.push(`name ILIKE $${params.length}`); }
  if (q.status !== undefined) { params.push(Number(q.status)); where.push(`status = $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const dir = q.order === 'asc' ? 'ASC' : 'DESC';

  return withTenant(tenant, async (tx) => {
    const data = await tx.$queryRawUnsafe(
      `SELECT ${SELECT} FROM ${TABLE} ${whereSql} ORDER BY id ${dir} LIMIT ${perPage} OFFSET ${skip}`,
      ...params,
    );
    const total = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM ${TABLE} ${whereSql}`, ...params,
    );
    return { data, total: Number(total[0]?.count ?? 0n), page, perPage };
  });
}

async function findOne(tenant, id) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(`SELECT ${SELECT} FROM ${TABLE} WHERE id = $1`, id),
  );
  if (!rows[0]) throw new NotFoundError('symbol-not-found');
  return rows[0];
}

async function create(tenant, dto) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `INSERT INTO ${TABLE} (name, image, status, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       RETURNING ${SELECT}`,
      dto.name, dto.image ?? null, dto.status ?? 1, Number(dto.sortOrder ?? 0),
    ),
  );
  return rows[0];
}

async function update(tenant, id, dto) {
  const sets = [];
  const values = [];
  const push = (sql, v) => { sets.push(sql.replace('$?', `$${values.length + 1}`)); values.push(v); };
  if (dto.name !== undefined) push('name = $?', dto.name);
  if (dto.image !== undefined) push('image = $?', dto.image);
  if (dto.status !== undefined) push('status = $?', Number(dto.status));
  if (dto.sortOrder !== undefined) push('sort_order = $?', Number(dto.sortOrder));
  if (sets.length === 0) return findOne(tenant, id);
  sets.push('updated_at = now()');
  values.push(id);
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `UPDATE ${TABLE} SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING ${SELECT}`,
      ...values,
    ),
  );
  if (!rows[0]) throw new NotFoundError('symbol-not-found');
  return rows[0];
}

async function remove(tenant, id) {
  // No deleted_at column on `symbols` — hard delete.
  const result = await withTenant(tenant, (tx) =>
    tx.$executeRawUnsafe(`DELETE FROM ${TABLE} WHERE id = $1`, id),
  );
  if (result === 0) throw new NotFoundError('symbol-not-found');
}

module.exports = { list, findOne, create, update, remove };
