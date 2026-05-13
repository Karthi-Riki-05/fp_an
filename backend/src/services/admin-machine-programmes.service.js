'use strict';

const { withTenant } = require('../prisma/client');
const { NotFoundError } = require('../errors');

/**
 * Machine programmes admin = MachineProgramme rows.
 *
 * Schema rejig: the new_fp port initially dropped the legacy
 * `machine_id` FK on machine_programmes. D3 reintroduces it as
 * `machine_doc_id` pointing at MachineDocument (the current "machines"
 * entity) so the admin Add/Edit modal can pick a parent machine.
 */

const TABLE = 'machine_programmes';
const SELECT = `mp.id, mp.name, mp.description,
  mp.machine_doc_id AS "machineId",
  md.name AS "machineName",
  mp.is_link AS "isLink", mp.is_locked AS "isLocked",
  mp.status, mp.created_at AS "createdAt"`;

const JOINS = `LEFT JOIN machine_documents md ON md.id = mp.machine_doc_id`;

async function list(tenant, q = {}) {
  const page = q.page ?? 1;
  const perPage = q.perPage ?? 10;
  const skip = (page - 1) * perPage;
  const params = [];
  const where = ['mp.deleted_at IS NULL'];
  if (q.search) { params.push(`%${q.search}%`); where.push(`mp.name ILIKE $${params.length}`); }
  if (q.machineId !== undefined) { params.push(Number(q.machineId)); where.push(`mp.machine_doc_id = $${params.length}`); }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const dir = q.order === 'asc' ? 'ASC' : 'DESC';

  return withTenant(tenant, async (tx) => {
    const data = await tx.$queryRawUnsafe(
      `SELECT ${SELECT} FROM ${TABLE} mp ${JOINS} ${whereSql}
       ORDER BY mp.id ${dir} LIMIT ${perPage} OFFSET ${skip}`,
      ...params,
    );
    const total = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM ${TABLE} mp ${whereSql}`, ...params,
    );
    return { data, total: Number(total[0]?.count ?? 0n), page, perPage };
  });
}

async function findOne(tenant, id) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `SELECT ${SELECT} FROM ${TABLE} mp ${JOINS} WHERE mp.id = $1 AND mp.deleted_at IS NULL`,
      id,
    ),
  );
  if (!rows[0]) throw new NotFoundError('machine-programme-not-found');
  return rows[0];
}

async function create(tenant, dto) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `INSERT INTO ${TABLE} (name, machine_doc_id, is_link, is_locked, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 1, now(), now()) RETURNING id`,
      dto.name,
      dto.machineId !== undefined && dto.machineId !== null ? Number(dto.machineId) : null,
      Boolean(dto.isLink ?? false),
      Boolean(dto.isLocked ?? false),
    ),
  );
  return findOne(tenant, rows[0].id);
}

async function update(tenant, id, dto) {
  const sets = [];
  const values = [];
  const push = (sql, v) => { sets.push(sql.replace('$?', `$${values.length + 1}`)); values.push(v); };
  if (dto.name !== undefined)      push('name = $?', dto.name);
  if (dto.machineId !== undefined) push('machine_doc_id = $?', dto.machineId !== null ? Number(dto.machineId) : null);
  if (dto.isLink !== undefined)    push('is_link = $?', Boolean(dto.isLink));
  if (dto.isLocked !== undefined)  push('is_locked = $?', Boolean(dto.isLocked));
  if (sets.length === 0) return findOne(tenant, id);
  sets.push('updated_at = now()');
  values.push(id);
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `UPDATE ${TABLE} SET ${sets.join(', ')} WHERE id = $${values.length} AND deleted_at IS NULL RETURNING id`,
      ...values,
    ),
  );
  if (!rows[0]) throw new NotFoundError('machine-programme-not-found');
  return findOne(tenant, id);
}

async function patchStatus(tenant, id) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `UPDATE ${TABLE} SET status = CASE WHEN status = 1 THEN 0 ELSE 1 END, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL RETURNING id, status`,
      id,
    ),
  );
  if (!rows[0]) throw new NotFoundError('machine-programme-not-found');
  return rows[0];
}

async function softDelete(tenant, id) {
  const result = await withTenant(tenant, (tx) =>
    tx.$executeRawUnsafe(`UPDATE ${TABLE} SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, id),
  );
  if (result === 0) throw new NotFoundError('machine-programme-not-found');
}

module.exports = { list, findOne, create, update, patchStatus, softDelete };
