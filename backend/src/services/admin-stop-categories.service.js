'use strict';

const { withTenant } = require('../prisma/client');
const { NotFoundError } = require('../errors');

const TABLE = 'stop_category';
const SELECT = `id, name, type AS "kind", description, icon,
  is_active AS "isActive", created_at AS "createdAt"`;

async function list(tenant, q = {}) {
  const page = q.page ?? 1;
  const perPage = q.perPage ?? 200;
  const skip = (page - 1) * perPage;
  const params = [];
  const where = ['deleted_at IS NULL'];
  if (q.isActive !== undefined) { params.push(Boolean(q.isActive)); where.push(`is_active = $${params.length}`); }
  else { where.push('is_active = true'); }
  if (q.search) { params.push(`%${q.search}%`); where.push(`name ILIKE $${params.length}`); }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  return withTenant(tenant, async (tx) => {
    const data = await tx.$queryRawUnsafe(
      `SELECT ${SELECT} FROM ${TABLE} ${whereSql} ORDER BY name LIMIT ${perPage} OFFSET ${skip}`,
      ...params,
    );
    // If pagination params weren't supplied, return the plain array shape
    // legacy /admin/stop-categories consumers (stop-reasons page) expect.
    if (q.page === undefined && q.perPage === undefined) return data;
    const total = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM ${TABLE} ${whereSql}`, ...params,
    );
    return { data, total: Number(total[0]?.count ?? 0n), page, perPage };
  });
}

async function findOne(tenant, id) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(`SELECT ${SELECT} FROM ${TABLE} WHERE id = $1 AND deleted_at IS NULL`, id),
  );
  if (!rows[0]) throw new NotFoundError('stop-category-not-found');
  return rows[0];
}

async function create(tenant, dto) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `INSERT INTO ${TABLE} (name, type, description, icon, is_active, created_at, updated_at)
       VALUES ($1, $2::"tenant_template"."StopCategoryKind", $3, $4, $5, now(), now())
       RETURNING ${SELECT}`,
      dto.name,
      dto.kind ?? 'Performance',
      dto.description ?? '',
      dto.icon ?? null,
      dto.isActive ?? true,
    ),
  );
  return rows[0];
}

async function update(tenant, id, dto) {
  const sets = [];
  const values = [];
  const push = (sql, v) => { sets.push(sql.replace('$?', `$${values.length + 1}`)); values.push(v); };
  if (dto.name !== undefined) push('name = $?', dto.name);
  if (dto.kind !== undefined) push('type = $?::"tenant_template"."StopCategoryKind"', dto.kind);
  if (dto.description !== undefined) push('description = $?', dto.description);
  if (dto.icon !== undefined) push('icon = $?', dto.icon);
  if (dto.isActive !== undefined) push('is_active = $?', Boolean(dto.isActive));
  if (sets.length === 0) return findOne(tenant, id);
  sets.push('updated_at = now()');
  values.push(id);
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `UPDATE ${TABLE} SET ${sets.join(', ')} WHERE id = $${values.length} AND deleted_at IS NULL
       RETURNING ${SELECT}`,
      ...values,
    ),
  );
  if (!rows[0]) throw new NotFoundError('stop-category-not-found');
  return rows[0];
}

async function softDelete(tenant, id) {
  const result = await withTenant(tenant, (tx) =>
    tx.$executeRawUnsafe(`UPDATE ${TABLE} SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, id),
  );
  if (result === 0) throw new NotFoundError('stop-category-not-found');
}

module.exports = { list, findOne, create, update, softDelete };
