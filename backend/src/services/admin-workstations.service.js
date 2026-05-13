'use strict';

const { withTenant } = require('../prisma/client');
const { NotFoundError } = require('../errors');

/**
 * Workstation admin — minimal definition: name + machine_id (FK to
 * MachineDocument, mirroring D3 machine-programmes).
 *
 * NOTE — deferred legacy columns:
 *   The legacy `work_station` table doubled as a stop-recording table
 *   (columns stop_cause / counts / date_time / duration). New_fp split
 *   that responsibility into the StopData domain (Phase B/C5 result
 *   forms) and kept Workstation as a pure definition row. The legacy
 *   form's stop_cause / counts / date_time / duration fields are NOT
 *   ported here — they belong on a future user-side stop-entry form,
 *   tracked in DROPDOWN_AUDIT.md.
 */

const TABLE = 'workstations';
const SELECT = `w.id, w.name, w.machine_id AS "machineId",
  md.name AS "machineName",
  w.status, w.created_at AS "createdAt"`;

const JOINS = `LEFT JOIN machine_documents md ON md.id = w.machine_id`;

async function list(tenant, q = {}) {
  const page = q.page ?? 1;
  const perPage = q.perPage ?? 10;
  const skip = (page - 1) * perPage;
  const params = [];
  // workstations table has no deleted_at column in the current schema.
  const where = [];
  if (q.search) { params.push(`%${q.search}%`); where.push(`w.name ILIKE $${params.length}`); }
  if (q.machineId !== undefined) { params.push(Number(q.machineId)); where.push(`w.machine_id = $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const dir = q.order === 'asc' ? 'ASC' : 'DESC';

  return withTenant(tenant, async (tx) => {
    const data = await tx.$queryRawUnsafe(
      `SELECT ${SELECT} FROM ${TABLE} w ${JOINS} ${whereSql}
       ORDER BY w.id ${dir} LIMIT ${perPage} OFFSET ${skip}`,
      ...params,
    );
    const total = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM ${TABLE} w ${whereSql}`, ...params,
    );
    return { data, total: Number(total[0]?.count ?? 0n), page, perPage };
  });
}

async function findOne(tenant, id) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(`SELECT ${SELECT} FROM ${TABLE} w ${JOINS} WHERE w.id = $1`, id),
  );
  if (!rows[0]) throw new NotFoundError('workstation-not-found');
  return rows[0];
}

async function create(tenant, dto) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `INSERT INTO ${TABLE} (name, machine_id, status, created_at, updated_at)
       VALUES ($1, $2, 1, now(), now()) RETURNING id`,
      dto.name,
      dto.machineId !== undefined && dto.machineId !== null ? Number(dto.machineId) : null,
    ),
  );
  return findOne(tenant, rows[0].id);
}

async function update(tenant, id, dto) {
  const sets = [];
  const values = [];
  const push = (sql, v) => { sets.push(sql.replace('$?', `$${values.length + 1}`)); values.push(v); };
  if (dto.name !== undefined)      push('name = $?', dto.name);
  if (dto.machineId !== undefined) push('machine_id = $?', dto.machineId !== null ? Number(dto.machineId) : null);
  if (sets.length === 0) return findOne(tenant, id);
  sets.push('updated_at = now()');
  values.push(id);
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `UPDATE ${TABLE} SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING id`,
      ...values,
    ),
  );
  if (!rows[0]) throw new NotFoundError('workstation-not-found');
  return findOne(tenant, id);
}

async function patchStatus(tenant, id) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `UPDATE ${TABLE} SET status = CASE WHEN status = 1 THEN 0 ELSE 1 END, updated_at = now()
       WHERE id = $1 RETURNING id, status`,
      id,
    ),
  );
  if (!rows[0]) throw new NotFoundError('workstation-not-found');
  return rows[0];
}

async function remove(tenant, id) {
  // No deleted_at column — hard delete to match the legacy DeleteData() path.
  const result = await withTenant(tenant, (tx) =>
    tx.$executeRawUnsafe(`DELETE FROM ${TABLE} WHERE id = $1`, id),
  );
  if (result === 0) throw new NotFoundError('workstation-not-found');
}

module.exports = { list, findOne, create, update, patchStatus, remove };
