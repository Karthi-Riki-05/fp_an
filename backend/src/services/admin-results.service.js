'use strict';

const { withTenant } = require('../prisma/client');
const { NotFoundError } = require('../errors');

/**
 * Build WHERE clause parts from an array of column filter descriptors.
 * @param {Array<{column: string, op: number, value: string}>} filterItems
 * @param {number} baseParamIndex  1-based index of the next positional param
 * @returns {{ parts: string[], params: any[], nextIndex: number }}
 */
function buildColumnFilters(filterItems, baseParamIndex) {
  const parts = [];
  const params = [];
  let i = baseParamIndex;
  for (const f of (filterItems || [])) {
    const col = f.column;
    switch (f.op) {
      case 1: params.push(f.value);          parts.push(`${col} = $${i++}`);            break;
      case 2: params.push(f.value);          parts.push(`${col} != $${i++}`);           break;
      case 3: params.push(`%${f.value}%`);   parts.push(`${col} ILIKE $${i++}`);        break;
      case 4: params.push(`%${f.value}%`);   parts.push(`${col} NOT ILIKE $${i++}`);    break;
      case 5:                                parts.push(`(${col} IS NULL OR ${col} = '')`); break;
      case 6:                                parts.push(`(${col} IS NOT NULL AND ${col} != '')`); break;
      case 7: params.push(`${f.value}%`);    parts.push(`${col} ILIKE $${i++}`);        break;
      case 8: params.push(`%${f.value}`);    parts.push(`${col} ILIKE $${i++}`);        break;
      default: break;
    }
  }
  return { parts, params, nextIndex: i };
}

/**
 * List production_data rows with date range + column filters + pagination.
 * @param {{ schemaName: string }} tenant
 * @param {{ page?, perPage?, from?, to?, filters?, sort?, order? }} q
 */
async function listProduction(tenant, q) {
  const page = q.page ?? 1;
  const perPage = q.perPage ?? 10;
  const skip = (page - 1) * perPage;
  const params = [];
  const where = ['pd.deleted_at IS NULL'];

  if (q.from) { params.push(q.from); where.push(`pd.date >= $${params.length}`); }
  if (q.to)   { params.push(q.to);   where.push(`pd.date <= $${params.length}`); }

  const { parts: fParts, params: fParams } = buildColumnFilters(q.filters, params.length + 1);
  params.push(...fParams);
  where.push(...fParts);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const joins = `
    LEFT JOIN flow_designs fd ON fd.id = pd.flow_id
    LEFT JOIN equipment e ON e.id = pd.flow_object_key
    LEFT JOIN parts p ON p.id = pd.part_id
    LEFT JOIN users u ON u.id = pd.created_by`;

  return withTenant(tenant, async (tx) => {
    const data = await tx.$queryRawUnsafe(
      `SELECT pd.id, fd.name AS "flowName", e.name AS "equipmentName",
              p.part_no AS "partNumber", p.name AS "partName",
              pd.work_shift_name AS "shiftName", pd.order_no AS "orderNo",
              pd.work_hours AS "workedHours", pd.part_qty AS "okPartsQty",
              pd.planned_qty AS "plannedQty", pd.comment,
              pd.date AS "selectedDate", pd.created_at AS "createdAt",
              u.name AS "createdBy"
       FROM production_data pd
       ${joins}
       ${whereSql}
       ORDER BY pd.id DESC
       LIMIT ${perPage} OFFSET ${skip}`,
      ...params
    );
    const total = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count
       FROM production_data pd
       ${joins}
       ${whereSql}`,
      ...params
    );
    return { data, total: Number(total[0]?.count ?? 0n), page, perPage };
  });
}

/**
 * List scrap_data rows with date range + column filters + pagination.
 */
async function listScrap(tenant, q) {
  const page = q.page ?? 1;
  const perPage = q.perPage ?? 10;
  const skip = (page - 1) * perPage;
  const params = [];
  const where = ['sd.deleted_at IS NULL'];

  if (q.from) { params.push(q.from); where.push(`sd.date >= $${params.length}`); }
  if (q.to)   { params.push(q.to);   where.push(`sd.date <= $${params.length}`); }

  const { parts: fParts, params: fParams } = buildColumnFilters(q.filters, params.length + 1);
  params.push(...fParams);
  where.push(...fParts);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const joins = `
    LEFT JOIN flow_designs fd ON fd.id = sd.flow_id
    LEFT JOIN equipment e ON e.id = sd.flow_object_key
    LEFT JOIN parts p ON p.id = sd.part_id
    LEFT JOIN types t ON t.id = sd.reason_type
    LEFT JOIN scrap_reasons sr ON sr.id = sd.reason
    LEFT JOIN users u ON u.id = sd.created_by`;

  return withTenant(tenant, async (tx) => {
    const data = await tx.$queryRawUnsafe(
      `SELECT sd.id, fd.name AS "flowName", e.name AS "equipmentName",
              p.part_no AS "partNumber", p.name AS "partName",
              sd.work_shift_name AS "shiftName", sd.order_no AS "orderNo",
              sd.quantity, t.name AS "scrapType", sr.name AS "scrapReason",
              sd.comment, sd.date AS "selectedDate", sd.created_at AS "createdAt",
              u.name AS "createdBy", sd.picture AS "attachment"
       FROM scrap_data sd
       ${joins}
       ${whereSql}
       ORDER BY sd.id DESC
       LIMIT ${perPage} OFFSET ${skip}`,
      ...params
    );
    const total = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count
       FROM scrap_data sd
       ${joins}
       ${whereSql}`,
      ...params
    );
    return { data, total: Number(total[0]?.count ?? 0n), page, perPage };
  });
}

/**
 * List stop_data rows with date range + column filters + pagination.
 * @param {{ includeExcluded?: boolean }} q  — when false, excludes rows where t.exclude_type = true
 */
async function listStop(tenant, q) {
  const page = q.page ?? 1;
  const perPage = q.perPage ?? 10;
  const skip = (page - 1) * perPage;
  const params = [];
  const where = ['sd.deleted_at IS NULL'];

  if (!q.includeExcluded) where.push(`(t.exclude_type = false OR t.exclude_type IS NULL)`);

  if (q.from) { params.push(q.from); where.push(`sd.date >= $${params.length}`); }
  if (q.to)   { params.push(q.to);   where.push(`sd.date <= $${params.length}`); }

  const { parts: fParts, params: fParams } = buildColumnFilters(q.filters, params.length + 1);
  params.push(...fParams);
  where.push(...fParts);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const joins = `
    LEFT JOIN flow_designs fd ON fd.id = sd.flow_id
    LEFT JOIN equipment e ON e.id = sd.flow_object_key
    LEFT JOIN parts p ON p.id = sd.part_id
    LEFT JOIN types t ON t.id = sd.reason_type
    LEFT JOIN stop_reasons sr ON sr.id = sd.reason
    LEFT JOIN users u ON u.id = sd.created_by`;

  return withTenant(tenant, async (tx) => {
    const data = await tx.$queryRawUnsafe(
      `SELECT sd.id, fd.name AS "flowName", e.name AS "equipmentName",
              p.part_no AS "partNumber", p.name AS "partName",
              sd.work_shift_name AS "shiftName", sd.order_no AS "orderNo",
              sd.quantity, sd.time, sd.sum_of_time AS "sumOfTime",
              t.type AS "lossCategory", t.name AS "stopType",
              sr.name AS "stopReason", sd.comment,
              sd.date AS "selectedDate",
              sd.stop_timestamp AS "stopTimestamp",
              sd.restart_timestamp AS "restartTimestamp",
              sd.created_at AS "createdAt",
              u.name AS "createdBy", sd.picture AS "attachment"
       FROM stop_data sd
       ${joins}
       ${whereSql}
       ORDER BY sd.id DESC
       LIMIT ${perPage} OFFSET ${skip}`,
      ...params
    );
    const total = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count
       FROM stop_data sd
       ${joins}
       ${whereSql}`,
      ...params
    );
    return { data, total: Number(total[0]?.count ?? 0n), page, perPage };
  });
}

// ── Edit: Production / Scrap / Stop ─────────────────────────────────────────
//
// Each PATCH endpoint accepts the legacy field set plus a `workShiftId` xor
// `workShiftName` dual-source pattern (DROPDOWN_AUDIT RESOLVED vi):
//   * If workShiftId is supplied, validate it exists in work_shifts and
//     denormalise the shift name into work_shift_name for table display.
//   * If workShiftName is supplied (e.g. from a shift_schedules title fallback),
//     store the name and zero out the FK.
// Returns the updated row with the same JOIN shape as the list endpoints so
// the caller can refresh the table without a separate fetch.

/**
 * Look up a work_shifts.name for an id. Used to denormalise the shift
 * name into the production_data / scrap_data / stop_data row when the
 * caller supplies workShiftId.
 */
async function resolveWorkShiftName(tx, workShiftId) {
  const id = Number(workShiftId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const rows = await tx.$queryRawUnsafe(
    `SELECT name FROM work_shifts WHERE id = $1 AND deleted_at IS NULL`, id,
  );
  if (!rows[0]) {
    const err = new Error('work-shift-not-found');
    err.statusCode = 400;
    throw err;
  }
  return rows[0].name;
}

/**
 * Apply the work-shift dual-source rule to a `sets`/`values` builder.
 * Mutates both arrays. Returns the resolved `work_shift_name` (or null).
 */
async function applyWorkShiftDualSource(tx, dto, sets, values, push) {
  if (dto.workShiftId !== undefined && dto.workShiftName !== undefined) {
    const err = new Error('work-shift-mutually-exclusive');
    err.statusCode = 400;
    throw err;
  }
  if (dto.workShiftId !== undefined) {
    const name = await resolveWorkShiftName(tx, dto.workShiftId);
    push('work_shift_id = $?', Number(dto.workShiftId));
    push('work_shift_name = $?', name);
  } else if (dto.workShiftName !== undefined) {
    push('work_shift_id = $?', 0);
    push('work_shift_name = $?', dto.workShiftName);
  }
}

async function updateProduction(tenant, id, dto) {
  return withTenant(tenant, async (tx) => {
    const sets = [];
    const values = [];
    const push = (sql, v) => { sets.push(sql.replace('$?', `$${values.length + 1}`)); values.push(v); };

    if (dto.partId !== undefined)     push('part_id = $?',     Number(dto.partId));
    if (dto.orderNo !== undefined)    push('order_no = $?',    dto.orderNo ?? '');
    if (dto.workHours !== undefined)  push('work_hours = $?',  String(dto.workHours));
    if (dto.partQty !== undefined)    push('part_qty = $?',    Number(dto.partQty));
    if (dto.plannedQty !== undefined) push('planned_qty = $?', Number(dto.plannedQty));
    if (dto.comment !== undefined)    push('comment = $?',     dto.comment ?? '');
    if (dto.date !== undefined)       push('date = $?::date',  dto.date);
    await applyWorkShiftDualSource(tx, dto, sets, values, push);

    if (sets.length === 0) {
      const rows = await tx.$queryRawUnsafe(`SELECT id FROM production_data WHERE id = $1`, id);
      if (!rows[0]) throw new NotFoundError('production-data-not-found');
    } else {
      sets.push('updated_at = now()');
      values.push(id);
      const updated = await tx.$queryRawUnsafe(
        `UPDATE production_data SET ${sets.join(', ')} WHERE id = $${values.length} AND deleted_at IS NULL RETURNING id`,
        ...values,
      );
      if (!updated[0]) throw new NotFoundError('production-data-not-found');
    }

    const rows = await tx.$queryRawUnsafe(
      `SELECT pd.id, fd.name AS "flowName", e.name AS "equipmentName",
              pd.part_id AS "partId", p.part_no AS "partNumber", p.name AS "partName",
              pd.work_shift_id AS "workShiftId", pd.work_shift_name AS "shiftName",
              pd.order_no AS "orderNo",
              pd.work_hours AS "workedHours", pd.part_qty AS "okPartsQty",
              pd.planned_qty AS "plannedQty", pd.comment,
              pd.date AS "selectedDate", pd.created_at AS "createdAt",
              u.name AS "createdBy"
       FROM production_data pd
       LEFT JOIN flow_designs fd ON fd.id = pd.flow_id
       LEFT JOIN equipment e ON e.id = pd.flow_object_key
       LEFT JOIN parts p ON p.id = pd.part_id
       LEFT JOIN users u ON u.id = pd.created_by
       WHERE pd.id = $1`,
      id,
    );
    return rows[0];
  });
}

async function updateScrap(tenant, id, dto) {
  return withTenant(tenant, async (tx) => {
    const sets = [];
    const values = [];
    const push = (sql, v) => { sets.push(sql.replace('$?', `$${values.length + 1}`)); values.push(v); };

    if (dto.partId !== undefined)      push('part_id = $?',       Number(dto.partId));
    if (dto.scrapTypeId !== undefined) push('scrap_type_id = $?', Number(dto.scrapTypeId));
    if (dto.reasonId !== undefined)    push('reason = $?',        Number(dto.reasonId));
    if (dto.orderNo !== undefined)     push('order_no = $?',      dto.orderNo ?? '');
    if (dto.quantity !== undefined)    push('quantity = $?',      Number(dto.quantity));
    if (dto.comment !== undefined)     push('comment = $?',       dto.comment ?? '');
    if (dto.date !== undefined)        push('date = $?::date',    dto.date);
    await applyWorkShiftDualSource(tx, dto, sets, values, push);

    if (sets.length === 0) {
      const rows = await tx.$queryRawUnsafe(`SELECT id FROM scrap_data WHERE id = $1`, id);
      if (!rows[0]) throw new NotFoundError('scrap-data-not-found');
    } else {
      sets.push('updated_at = now()');
      values.push(id);
      const updated = await tx.$queryRawUnsafe(
        `UPDATE scrap_data SET ${sets.join(', ')} WHERE id = $${values.length} AND deleted_at IS NULL RETURNING id`,
        ...values,
      );
      if (!updated[0]) throw new NotFoundError('scrap-data-not-found');
    }

    const rows = await tx.$queryRawUnsafe(
      `SELECT sd.id, fd.name AS "flowName", e.name AS "equipmentName",
              sd.part_id AS "partId", p.part_no AS "partNumber", p.name AS "partName",
              sd.work_shift_id AS "workShiftId", sd.work_shift_name AS "shiftName",
              sd.order_no AS "orderNo",
              sd.quantity,
              sd.scrap_type_id AS "scrapTypeId", t.name AS "scrapType",
              sd.reason AS "reasonId", sr.name AS "scrapReason",
              sd.comment, sd.date AS "selectedDate", sd.created_at AS "createdAt",
              u.name AS "createdBy", sd.picture AS "attachment"
       FROM scrap_data sd
       LEFT JOIN flow_designs fd ON fd.id = sd.flow_id
       LEFT JOIN equipment e ON e.id = sd.flow_object_key
       LEFT JOIN parts p ON p.id = sd.part_id
       LEFT JOIN types t ON t.id = sd.scrap_type_id
       LEFT JOIN scrap_reasons sr ON sr.id = sd.reason
       LEFT JOIN users u ON u.id = sd.created_by
       WHERE sd.id = $1`,
      id,
    );
    return rows[0];
  });
}

async function updateStop(tenant, id, dto) {
  return withTenant(tenant, async (tx) => {
    const sets = [];
    const values = [];
    const push = (sql, v) => { sets.push(sql.replace('$?', `$${values.length + 1}`)); values.push(v); };

    if (dto.partId !== undefined)     push('part_id = $?',      Number(dto.partId));
    if (dto.stopTypeId !== undefined) push('stop_type_id = $?', Number(dto.stopTypeId));
    if (dto.reasonId !== undefined)   push('reason = $?',       Number(dto.reasonId));
    if (dto.orderNo !== undefined)    push('order_no = $?',     dto.orderNo ?? '');
    if (dto.quantity !== undefined)   push('quantity = $?',     Number(dto.quantity));
    if (dto.comment !== undefined)    push('comment = $?',      dto.comment ?? '');
    if (dto.date !== undefined)       push('date = $?::date',   dto.date);
    if (dto.timeMinutes !== undefined) {
      const total = Math.max(0, Math.floor(Number(dto.timeMinutes)));
      const hours = Math.floor(total / 60);
      const minutes = total % 60;
      push('hours = $?',       hours);
      push('minutes = $?',     minutes);
      push('sum_of_time = $?', total);
      // `time` is the legacy display string ("HH:MM"). Keep it in sync so
      // the list column doesn't go stale.
      push('time = $?', `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
    }
    await applyWorkShiftDualSource(tx, dto, sets, values, push);

    if (sets.length === 0) {
      const rows = await tx.$queryRawUnsafe(`SELECT id FROM stop_data WHERE id = $1`, id);
      if (!rows[0]) throw new NotFoundError('stop-data-not-found');
    } else {
      sets.push('updated_at = now()');
      values.push(id);
      const updated = await tx.$queryRawUnsafe(
        `UPDATE stop_data SET ${sets.join(', ')} WHERE id = $${values.length} AND deleted_at IS NULL RETURNING id`,
        ...values,
      );
      if (!updated[0]) throw new NotFoundError('stop-data-not-found');
    }

    const rows = await tx.$queryRawUnsafe(
      `SELECT sd.id, fd.name AS "flowName", e.name AS "equipmentName",
              sd.part_id AS "partId", p.part_no AS "partNumber", p.name AS "partName",
              sd.work_shift_id AS "workShiftId", sd.work_shift_name AS "shiftName",
              sd.order_no AS "orderNo",
              sd.quantity, sd.time, sd.sum_of_time AS "sumOfTime",
              sd.hours, sd.minutes,
              sd.stop_type_id AS "stopTypeId", t.type AS "lossCategory", t.name AS "stopType",
              sd.reason AS "reasonId", sr.name AS "stopReason",
              sd.comment,
              sd.date AS "selectedDate",
              sd.stop_timestamp AS "stopTimestamp",
              sd.restart_timestamp AS "restartTimestamp",
              sd.created_at AS "createdAt",
              u.name AS "createdBy", sd.picture AS "attachment"
       FROM stop_data sd
       LEFT JOIN flow_designs fd ON fd.id = sd.flow_id
       LEFT JOIN equipment e ON e.id = sd.flow_object_key
       LEFT JOIN parts p ON p.id = sd.part_id
       LEFT JOIN types t ON t.id = sd.stop_type_id
       LEFT JOIN stop_reasons sr ON sr.id = sd.reason
       LEFT JOIN users u ON u.id = sd.created_by
       WHERE sd.id = $1`,
      id,
    );
    return rows[0];
  });
}

module.exports = { listProduction, listScrap, listStop, updateProduction, updateScrap, updateStop };
