'use strict';

const { withTenant } = require('../prisma/client');
const { tenantSoftDelete } = require('../helpers/tenant-table.helpers');
const { NotFoundError } = require('../errors');

const TABLE = 'work_shifts';
const SELECT = `id, name, start_time::text AS "startTime", end_time::text AS "endTime", break_start_time::text AS "breakStartTime", break_end_time::text AS "breakEndTime", working_days AS "workingDays", status, created_at AS "createdAt"`;

async function list(tenant, q) {
  const page = q.page ?? 1;
  const perPage = q.perPage ?? 10;
  const params = [];
  const where = ['deleted_at IS NULL'];
  if (q.search) { params.push(`%${q.search}%`); where.push(`name ILIKE $${params.length}`); }
  if (q.name) { params.push(`%${q.name}%`); where.push(`name ILIKE $${params.length}`); }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const dir = q.order === 'asc' ? 'ASC' : 'DESC';
  return withTenant(tenant.schemaName, async (tx) => {
    const data = await tx.$queryRawUnsafe(`SELECT ${SELECT} FROM ${TABLE} ${whereSql} ORDER BY id ${dir} LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`, ...params);
    const totalRows = await tx.$queryRawUnsafe(`SELECT COUNT(*)::bigint AS count FROM ${TABLE} ${whereSql}`, ...params);
    return { data, total: Number(totalRows[0]?.count ?? 0n), page, perPage };
  });
}

async function findOne(tenant, id) {
  const rows = await withTenant(tenant.schemaName, (tx) =>
    tx.$queryRawUnsafe(`SELECT ${SELECT} FROM ${TABLE} WHERE id = $1 AND deleted_at IS NULL`, id),
  );
  if (!rows[0]) throw new NotFoundError('not-found');
  return rows[0];
}

async function create(tenant, dto) {
  const rows = await withTenant(tenant.schemaName, (tx) =>
    tx.$queryRawUnsafe(
      `INSERT INTO work_shifts (name, start_time, end_time, break_start_time, break_end_time, working_days, status, created_at, updated_at)
       VALUES ($1, $2::time, $3::time, $4::time, $5::time, $6, 1, now(), now())
       RETURNING ${SELECT}`,
      dto.name, dto.startTime || null, dto.endTime || null, dto.breakStartTime || null, dto.breakEndTime || null, dto.workingDays ?? null,
    ),
  );
  return rows[0];
}

async function update(tenant, id, dto) {
  const sets = [];
  const values = [];
  const push = (sql, value) => { sets.push(sql.replace('$?', `$${values.length + 1}`)); values.push(value); };
  if (dto.name !== undefined) push('name = $?', dto.name);
  if (dto.startTime !== undefined) push('start_time = $?::time', dto.startTime || null);
  if (dto.endTime !== undefined) push('end_time = $?::time', dto.endTime || null);
  if (dto.breakStartTime !== undefined) push('break_start_time = $?::time', dto.breakStartTime || null);
  if (dto.breakEndTime !== undefined) push('break_end_time = $?::time', dto.breakEndTime || null);
  if (dto.workingDays !== undefined) push('working_days = $?', dto.workingDays);
  if (sets.length === 0) return findOne(tenant, id);
  sets.push('updated_at = now()');
  values.push(id);
  const rows = await withTenant(tenant.schemaName, (tx) =>
    tx.$queryRawUnsafe(`UPDATE work_shifts SET ${sets.join(', ')} WHERE id = $${values.length} AND deleted_at IS NULL RETURNING ${SELECT}`, ...values),
  );
  if (!rows[0]) throw new NotFoundError('not-found');
  return rows[0];
}

function softDelete(tenant, id) {
  return tenantSoftDelete({ withTenant, tenant, table: TABLE, id });
}

module.exports = { list, findOne, create, update, softDelete };
