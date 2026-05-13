'use strict';

const { withTenant } = require('../prisma/client');
const { NotFoundError } = require('../errors');

const SELECT = `id, name, status, flow_data AS "flowData", created_at AS "createdAt", updated_at AS "updatedAt"`;

/**
 * Returns true if a flow's serialized GoJS `flow_data` JSON contains a node
 * whose absolute key matches the equipment id. Mirrors the legacy PHP filter
 * in CompanyUserController::getUnitStopSaveDlg which iterates
 * `nodeDataArray` and checks `abs(key) == equipment_id`.
 */
function flowContainsEquipment(flowDataRaw, equipmentId) {
  if (!flowDataRaw) return false;
  let parsed;
  try {
    parsed = typeof flowDataRaw === 'string' ? JSON.parse(flowDataRaw) : flowDataRaw;
  } catch {
    return false;
  }
  const nodes = parsed?.nodeDataArray;
  if (!Array.isArray(nodes)) return false;
  return nodes.some((n) => Math.abs(Number(n?.key ?? 0)) === Number(equipmentId));
}

async function list(tenant, q = {}) {
  const page = q.page ?? 1;
  const perPage = q.perPage ?? 50;
  const skip = (page - 1) * perPage;
  const params = [];
  const where = ['deleted_at IS NULL'];
  if (q.search) { params.push(`%${q.search}%`); where.push(`name ILIKE $${params.length}`); }
  if (q.status !== undefined) { params.push(Number(q.status)); where.push(`status = $${params.length}`); }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  // When equipmentId is supplied we need flow_data to filter in JS.
  const needsFlowData = !!q.equipmentId;
  const selectCols = needsFlowData ? SELECT : `id, name, status, created_at AS "createdAt", updated_at AS "updatedAt"`;

  return withTenant(tenant, async (tx) => {
    const all = await tx.$queryRawUnsafe(
      `SELECT ${selectCols} FROM flow_designs ${whereSql} ORDER BY id DESC LIMIT ${perPage} OFFSET ${skip}`,
      ...params,
    );
    let data = all;
    if (q.equipmentId) {
      const eq = Number(q.equipmentId);
      data = all.filter((f) => flowContainsEquipment(f.flowData, eq));
    }
    const totalRows = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM flow_designs ${whereSql}`, ...params,
    );
    // When equipmentId is in play, paginated total is the filtered length;
    // for unfiltered queries it's the DB count.
    const total = q.equipmentId ? data.length : Number(totalRows[0]?.count ?? 0n);
    return { data, total, page, perPage };
  });
}

async function findOne(tenant, id) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(`SELECT ${SELECT} FROM flow_designs WHERE id = $1 AND deleted_at IS NULL`, id),
  );
  if (!rows[0]) throw new NotFoundError('flow-design-not-found');
  return rows[0];
}

async function create(tenant, dto) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `INSERT INTO flow_designs (name, flow_data, status, created_at, updated_at)
       VALUES ($1, $2, $3, now(), now())
       RETURNING ${SELECT}`,
      dto.name,
      dto.flowData ?? null,
      dto.status ?? 1,
    ),
  );
  return rows[0];
}

async function update(tenant, id, dto) {
  const sets = [];
  const values = [];
  const push = (sql, v) => { sets.push(sql.replace('$?', `$${values.length + 1}`)); values.push(v); };
  if (dto.name !== undefined) push('name = $?', dto.name);
  if (dto.flowData !== undefined) push('flow_data = $?', dto.flowData);
  if (dto.status !== undefined) push('status = $?', Number(dto.status));
  if (sets.length === 0) return findOne(tenant, id);
  sets.push('updated_at = now()');
  values.push(id);
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `UPDATE flow_designs SET ${sets.join(', ')}
       WHERE id = $${values.length} AND deleted_at IS NULL
       RETURNING ${SELECT}`,
      ...values,
    ),
  );
  if (!rows[0]) throw new NotFoundError('flow-design-not-found');
  return rows[0];
}

async function patchStatus(tenant, id) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `UPDATE flow_designs SET status = CASE WHEN status = 1 THEN 0 ELSE 1 END, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL RETURNING id, status`,
      id,
    ),
  );
  if (!rows[0]) throw new NotFoundError('flow-design-not-found');
  return rows[0];
}

async function softDelete(tenant, id) {
  const result = await withTenant(tenant, (tx) =>
    tx.$executeRawUnsafe(`UPDATE flow_designs SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, id),
  );
  if (result === 0) throw new NotFoundError('flow-design-not-found');
}

module.exports = { list, findOne, create, update, patchStatus, softDelete, flowContainsEquipment };
