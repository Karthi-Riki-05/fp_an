'use strict';

/**
 * "My Result" — operator-scoped data tables.
 *
 * Port of the FP Analyzer legacy `DashboardController` methods:
 *   userProductionData / userScrapData / userStopData /
 *   userUnregStopData / userWarningLog and their save/edit/delete pairs.
 *
 * Spec: /Applications/XAMPP/xamppfiles/htdocs/new_fp/results.md
 *
 * The legacy controller is server-rendered DataTables (Yajra). This service
 * implements the same shape as a JSON API used by the Next.js page.
 */

const { withTenant, prisma } = require('../prisma/client');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../errors');
const adminSvc = require('./admin-results.service');

const SWE_COLLATE = `COLLATE "sv-SE-x-icu"`;

// ─── 8 filter operators (results.md §6.4) ──────────────────────────────────

function parseFilterOperator(col, type, value, nextIndex) {
  const v = value == null ? '' : String(value);
  const t = Number(type);
  if ([1, 2, 3, 4, 7, 8].includes(t) && v === '') return null;
  switch (t) {
    case 1: return { sql: `${col} = $${nextIndex}`,          params: [v] };
    case 2: return { sql: `${col} != $${nextIndex}`,         params: [v] };
    case 3: return { sql: `${col} ILIKE $${nextIndex}`,      params: [`%${v}%`] };
    case 4: return { sql: `${col} NOT ILIKE $${nextIndex}`,  params: [`%${v}%`] };
    case 5: return { sql: `(${col} IS NULL OR ${col} = '')`, params: [] };
    case 6: return { sql: `(${col} IS NOT NULL AND ${col} != '')`, params: [] };
    case 7: return { sql: `${col} ILIKE $${nextIndex}`,      params: [`${v}%`] };
    case 8: return { sql: `${col} ILIKE $${nextIndex}`,      params: [`%${v}`] };
    default: return null;
  }
}

function buildColumnFilters(q, baseIndex) {
  const parts = [];
  const params = [];
  let i = baseIndex;

  const items = [];
  if (Array.isArray(q.filterColumn)) {
    for (let k = 0; k < q.filterColumn.length; k++) {
      items.push({
        column: q.filterColumn[k],
        op: q.filterType ? q.filterType[k] : 1,
        value: q.filterVal ? q.filterVal[k] : '',
      });
    }
  }
  if (Array.isArray(q.filters)) {
    for (const f of q.filters) items.push({ column: f.column, op: f.op, value: f.value ?? '' });
  }

  for (const f of items) {
    if (!f.column || !f.op) continue;
    const built = parseFilterOperator(f.column, f.op, f.value, i);
    if (!built) continue;
    parts.push(built.sql);
    if (built.params.length) {
      params.push(...built.params);
      i += built.params.length;
    }
  }
  return { parts, params, nextIndex: i };
}

function buildCommonFilters(q, baseTable, baseIndex) {
  const parts = [];
  const params = [];
  let i = baseIndex;

  if (q.start_date) { parts.push(`${baseTable}.date >= $${i++}::date`); params.push(q.start_date); }
  if (q.end_date)   { parts.push(`${baseTable}.date <= $${i++}::date`); params.push(q.end_date); }
  if (q.date)       { parts.push(`${baseTable}.date = $${i++}::date`);  params.push(q.date); }

  if (q.flow_id)   { parts.push(`${baseTable}.flow_id = $${i++}`);         params.push(Number(q.flow_id)); }
  if (q.equip_id)  { parts.push(`${baseTable}.flow_object_key = $${i++}`); params.push(Number(q.equip_id)); }

  const wsCsv = q.filter && (q.filter.filter_workshift || q.filter.filterWorkshift);
  if (wsCsv) {
    const ids = String(wsCsv).split(',').map(Number).filter(Number.isInteger);
    if (ids.length) { parts.push(`${baseTable}.work_shift_id = ANY($${i++}::int[])`); params.push(ids); }
  }
  const partCsv = q.filter && (q.filter.filter_part || q.filter.filterPart);
  if (partCsv) {
    const ids = String(partCsv).split(',').map(Number).filter(Number.isInteger);
    if (ids.length) { parts.push(`${baseTable}.part_id = ANY($${i++}::int[])`); params.push(ids); }
  }
  const orderNo = q.filter && (q.filter.order_no || q.filter.orderNo);
  if (orderNo) { parts.push(`${baseTable}.order_no = $${i++}`); params.push(orderNo); }

  return { parts, params, nextIndex: i };
}

function applyShowMyEntries(q, baseTable, tab, userId, sink) {
  // Stop tab carve-out (§11.6): skip when a single `date` is supplied.
  if (tab === 'stop' && q.date) return;
  if (String(q.show_my_entries) === '1') {
    sink.parts.push(`${baseTable}.created_by = $${sink.nextIndex++}`);
    sink.params.push(userId);
  }
}

// ─── tab dispatcher ────────────────────────────────────────────────────────

const TAB_INDEX = {
  0: 'production',
  1: 'scrap',
  2: 'stop',
  3: 'warning',
  4: 'unregistered',
};

async function getTabs(tenant, userId) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { tablePreferences: true },
  });
  const order = u?.tablePreferences?.tap_setting?.myresult;
  const savedIds = Array.isArray(order) ? order.map(Number) : [0, 1, 2];
  const ids = Array.from(new Set([...savedIds, 3, 4]));

  let warningVisible = true;
  await withTenant(tenant, async (tx) => {
    const rows = await tx.$queryRawUnsafe(
      `SELECT 1 FROM warning_data
       WHERE from_time IS NOT NULL AND to_time IS NOT NULL
       LIMIT 1`,
    ).catch(() => []);
    warningVisible = rows && rows.length > 0;
  });

  const tabs = ids
    .filter((id) => TAB_INDEX[id])
    .map((id) => ({ id, slug: TAB_INDEX[id], visible: id === 3 ? warningVisible : true }));
  return { tabs };
}

// ─── pagination + sort helpers ─────────────────────────────────────────────

function paginate(q) {
  const page = Math.max(1, Number(q.page) || 1);
  const perPage = Math.max(1, Math.min(500, Number(q.perPage) || 25));
  return { page, perPage, skip: (page - 1) * perPage };
}

function sortClause(q, defaultCol, defaultDir, textCols) {
  const col = q.order && q.order.col ? String(q.order.col) : defaultCol;
  const dir = q.order && /^(asc|desc)$/i.test(String(q.order.dir || ''))
    ? String(q.order.dir).toUpperCase() : defaultDir.toUpperCase();
  const isText = (textCols || []).includes(col);
  return isText ? `ORDER BY ${col} ${SWE_COLLATE} ${dir}` : `ORDER BY ${col} ${dir}`;
}

const LOSS_BUCKETS = new Set(['Performance', 'Availability', 'Quality', 'Other', 'Not applicable']);
function lossTranslation(value) {
  if (!value) return null;
  return LOSS_BUCKETS.has(value) ? value : null;
}

function formatHMS(sec) {
  let s = Math.max(0, Number(sec) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function formatSumOfTime(sec, hours, minutes, qty) {
  let s = Number(sec);
  if (!s && (hours || minutes) && qty) {
    s = ((Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60) * Number(qty);
  }
  return formatHMS(s || 0);
}

// ─── LIST: production / scrap / stop / warning / unregistered ─────────────

async function listProduction(tenant, userId, q) {
  const { page, perPage, skip } = paginate(q);
  const params = [];
  const where = ['pd.deleted_at IS NULL'];
  const sink = { parts: where, params, nextIndex: 1 };
  applyShowMyEntries(q, 'pd', 'production', userId, sink);
  const cf = buildCommonFilters(q, 'pd', sink.nextIndex);
  where.push(...cf.parts); params.push(...cf.params); sink.nextIndex = cf.nextIndex;

  if (q.type_name && q.prod_group) {
    if (q.prod_group === 'part') { where.push(`p.part_no = $${sink.nextIndex++}`); params.push(q.type_name); }
    else if (q.prod_group === 'equipment') { where.push(`e.name = $${sink.nextIndex++}`); params.push(q.type_name); }
    else if (q.prod_group === 'work_shift') { where.push(`pd.work_shift_name = $${sink.nextIndex++}`); params.push(q.type_name); }
    else { where.push(`pd.order_no = $${sink.nextIndex++}`); params.push(q.type_name); }
  } else if (q.type_name) {
    where.push(`pd.order_no = $${sink.nextIndex++}`); params.push(q.type_name);
  }

  const colf = buildColumnFilters(q, sink.nextIndex);
  where.push(...colf.parts); params.push(...colf.params);

  const textCols = ['fd.name', 'e.name', 'p.part_no', 'p.name', 'pd.work_shift_name', 'pd.order_no', 'pd.comment', 'u.name'];
  const orderBy = sortClause(q, 'pd.id', 'desc', textCols);

  const joins = `
    LEFT JOIN flow_designs fd ON fd.id = pd.flow_id
    LEFT JOIN equipment e ON e.id = pd.flow_object_key
    LEFT JOIN parts p ON p.id = pd.part_id
    LEFT JOIN users u ON u.id = pd.created_by`;
  const select = `
    pd.id, fd.name AS "flowName",
    pd.flow_object_key AS "equipmentId", e.name AS "equipmentName",
    pd.part_id AS "partId", p.part_no AS "partNumber", p.name AS "partName",
    pd.work_shift_id AS "workShiftId", pd.work_shift_name AS "shiftName",
    pd.order_no AS "orderNo",
    pd.work_hours AS "workedHours", pd.part_qty AS "okPartsQty",
    pd.planned_qty AS "plannedQty", pd.comment,
    pd.date AS "selectedDate", pd.created_at AS "createdAt",
    pd.created_by AS "createdByUserId", u.name AS "createdBy"`;

  return withTenant(tenant, async (tx) => {
    const data = await tx.$queryRawUnsafe(
      `SELECT ${select} FROM production_data pd ${joins}
       WHERE ${where.join(' AND ')} ${orderBy}
       LIMIT ${perPage} OFFSET ${skip}`, ...params);
    const total = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM production_data pd ${joins}
       WHERE ${where.join(' AND ')}`, ...params);
    return {
      data: data.map((r) => ({ ...r, canEdit: Number(r.createdByUserId) === Number(userId) })),
      total: Number(total[0]?.count ?? 0n), page, perPage,
    };
  });
}

async function listScrap(tenant, userId, q) {
  const { page, perPage, skip } = paginate(q);
  const params = [];
  const where = ['sd.deleted_at IS NULL'];
  const sink = { parts: where, params, nextIndex: 1 };
  applyShowMyEntries(q, 'sd', 'scrap', userId, sink);
  const cf = buildCommonFilters(q, 'sd', sink.nextIndex);
  where.push(...cf.parts); params.push(...cf.params); sink.nextIndex = cf.nextIndex;

  if (q.type_name) {
    where.push(`sr.name = $${sink.nextIndex++} AND sr.status = 1`);
    params.push(q.type_name);
  }
  const colf = buildColumnFilters(q, sink.nextIndex);
  where.push(...colf.parts); params.push(...colf.params);

  const textCols = ['fd.name', 'e.name', 'p.part_no', 'p.name', 'sd.work_shift_name', 'sd.order_no', 'sd.comment', 't.name', 'sr.name', 'u.name'];
  const orderBy = sortClause(q, 'sd.id', 'desc', textCols);

  const joins = `
    LEFT JOIN flow_designs fd ON fd.id = sd.flow_id
    LEFT JOIN equipment e ON e.id = sd.flow_object_key
    LEFT JOIN parts p ON p.id = sd.part_id
    LEFT JOIN types t ON t.id = sd.scrap_type_id
    LEFT JOIN scrap_reasons sr ON sr.id = sd.reason
    LEFT JOIN users u ON u.id = sd.created_by`;
  const select = `
    sd.id, fd.name AS "flowName",
    sd.flow_object_key AS "equipmentId", e.name AS "equipmentName",
    sd.part_id AS "partId", p.part_no AS "partNumber", p.name AS "partName",
    sd.work_shift_id AS "workShiftId", sd.work_shift_name AS "shiftName",
    sd.order_no AS "orderNo", sd.quantity,
    sd.scrap_type_id AS "scrapTypeId", t.name AS "scrapType",
    sd.reason AS "reasonId", sr.name AS "scrapReason",
    sd.comment, sd.date AS "selectedDate", sd.created_at AS "createdAt",
    sd.created_by AS "createdByUserId", u.name AS "createdBy",
    sd.picture AS "attachment"`;

  return withTenant(tenant, async (tx) => {
    const data = await tx.$queryRawUnsafe(
      `SELECT ${select} FROM scrap_data sd ${joins}
       WHERE ${where.join(' AND ')} ${orderBy}
       LIMIT ${perPage} OFFSET ${skip}`, ...params);
    const total = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM scrap_data sd ${joins}
       WHERE ${where.join(' AND ')}`, ...params);
    return {
      data: data.map((r) => ({ ...r, canEdit: Number(r.createdByUserId) === Number(userId) })),
      total: Number(total[0]?.count ?? 0n), page, perPage,
    };
  });
}

async function listStop(tenant, userId, q) {
  const { page, perPage, skip } = paginate(q);
  const params = [];
  const where = ['sd.deleted_at IS NULL'];
  const sink = { parts: where, params, nextIndex: 1 };
  applyShowMyEntries(q, 'sd', 'stop', userId, sink);

  const excludeOn = String(q.exclude_type) !== '1';
  if (excludeOn) where.push(`(t.exclude_type = false OR t.exclude_type IS NULL)`);
  if (String(q.save_exclude_option) === '1') {
    saveTableSetting(userId, 'exclude_type', 'stop', String(q.exclude_type) === '1' ? 1 : 0)
      .catch(() => undefined);
  }

  const cf = buildCommonFilters(q, 'sd', sink.nextIndex);
  where.push(...cf.parts); params.push(...cf.params); sink.nextIndex = cf.nextIndex;

  if (q.type_name) {
    where.push(`sr.name = $${sink.nextIndex++} AND sr.status = 1`);
    params.push(q.type_name);
  }
  const colf = buildColumnFilters(q, sink.nextIndex);
  where.push(...colf.parts); params.push(...colf.params);

  const textCols = ['fd.name', 'e.name', 'p.part_no', 'p.name', 'sd.work_shift_name', 'sd.order_no', 'sd.comment', 't.name', 'sr.name', 'u.name'];
  const orderBy = sortClause(q, 'sd.id', 'desc', textCols);

  const joins = `
    LEFT JOIN flow_designs fd ON fd.id = sd.flow_id
    LEFT JOIN equipment e ON e.id = sd.flow_object_key
    LEFT JOIN parts p ON p.id = sd.part_id
    LEFT JOIN types t ON t.id = sd.stop_type_id
    LEFT JOIN stop_reasons sr ON sr.id = sd.reason
    LEFT JOIN users u ON u.id = sd.created_by`;
  const select = `
    sd.id, fd.name AS "flowName",
    sd.flow_object_key AS "equipmentId", e.name AS "equipmentName",
    sd.part_id AS "partId", p.part_no AS "partNumber", p.name AS "partName",
    sd.work_shift_id AS "workShiftId", sd.work_shift_name AS "shiftName",
    sd.order_no AS "orderNo", sd.quantity,
    sd.time, sd.sum_of_time AS "sumOfTimeSec", sd.hours, sd.minutes,
    sd.stop_type_id AS "stopTypeId", t.type AS "lossCategory", t.name AS "stopType",
    sd.reason AS "reasonId", sr.name AS "stopReason", sd.comment,
    sd.date AS "selectedDate",
    sd.stop_timestamp AS "stopTimestamp", sd.restart_timestamp AS "restartTimestamp",
    sd.created_at AS "createdAt",
    sd.created_by AS "createdByUserId", u.name AS "createdBy",
    sd.picture AS "attachment"`;

  return withTenant(tenant, async (tx) => {
    const data = await tx.$queryRawUnsafe(
      `SELECT ${select} FROM stop_data sd ${joins}
       WHERE ${where.join(' AND ')} ${orderBy}
       LIMIT ${perPage} OFFSET ${skip}`, ...params);
    const total = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM stop_data sd ${joins}
       WHERE ${where.join(' AND ')}`, ...params);
    return {
      data: data.map((r) => ({
        ...r,
        sumOfTime: formatSumOfTime(r.sumOfTimeSec, r.hours, r.minutes, r.quantity),
        lossCategoryKey: lossTranslation(r.lossCategory),
        canEdit: Number(r.createdByUserId) === Number(userId),
      })),
      total: Number(total[0]?.count ?? 0n), page, perPage,
    };
  });
}

async function listWarning(tenant, userId, q) {
  const { page, perPage, skip } = paginate(q);
  const params = [];
  const where = ['wd.from_time IS NOT NULL', 'wd.to_time IS NOT NULL'];
  let i = 1;
  if (q.start_date) { where.push(`DATE(wd.from_time) >= $${i++}::date`); params.push(q.start_date); }
  if (q.end_date)   { where.push(`DATE(wd.from_time) <= $${i++}::date`); params.push(q.end_date); }
  if (q.equip_id)   { where.push(`wd.equipment_id = $${i++}`);            params.push(Number(q.equip_id)); }
  if (String(q.show_my_entries) === '1') { where.push(`wd.created_by = $${i++}`); params.push(userId); }

  const colf = buildColumnFilters(q, i);
  where.push(...colf.parts); params.push(...colf.params);

  const textCols = ['e.name', 'wd.notification_text', 'u.name'];
  const orderBy = sortClause(q, 'wd.id', 'desc', textCols);

  return withTenant(tenant, async (tx) => {
    const data = await tx.$queryRawUnsafe(
      `SELECT wd.id, wd.equipment_id AS "equipmentId", e.name AS "equipmentName",
              wd.notification_text AS "notificationText",
              wd.from_time AS "fromTime", wd.to_time AS "toTime",
              wd.duration AS "durationSec",
              wd.created_by AS "createdByUserId", u.name AS "createdBy"
       FROM warning_data wd
       LEFT JOIN equipment e ON e.id = wd.equipment_id
       LEFT JOIN users u ON u.id = wd.created_by
       WHERE ${where.join(' AND ')} ${orderBy}
       LIMIT ${perPage} OFFSET ${skip}`, ...params);
    const total = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM warning_data wd
       LEFT JOIN equipment e ON e.id = wd.equipment_id
       LEFT JOIN users u ON u.id = wd.created_by
       WHERE ${where.join(' AND ')}`, ...params);
    return {
      data: data.map((r) => ({
        ...r,
        duration: formatHMS(r.durationSec),
        canEdit: Number(r.createdByUserId) === Number(userId),
      })),
      total: Number(total[0]?.count ?? 0n), page, perPage,
    };
  });
}

async function listUnregistered(tenant, q) {
  const { page, perPage, skip } = paginate(q);
  const params = [];
  const where = [
    "md.is_registered = 'no'",
    "md.is_valid_data = true",
    'md.end_time IS NOT NULL',
    "m.signal_type != 'warning'",
  ];
  let i = 1;
  if (q.start_date) { where.push(`DATE(md.start_time) >= $${i++}::date`); params.push(q.start_date); }
  if (q.end_date)   { where.push(`DATE(md.start_time) <= $${i++}::date`); params.push(q.end_date); }

  const colf = buildColumnFilters(q, i);
  where.push(...colf.parts); params.push(...colf.params);

  return withTenant(tenant, async (tx) => {
    const data = await tx.$queryRawUnsafe(
      `SELECT md.id, m.unit_name AS "unitName",
              m.equipment_id AS "equipmentId", e.name AS "equipmentName",
              md.start_time AS "startTime", md.end_time AS "endTime",
              md.production_time AS "productionTime"
       FROM machine_data md
       INNER JOIN machines m ON m.id = md.machine_id
       LEFT JOIN equipment e ON e.id = m.equipment_id
       WHERE ${where.join(' AND ')}
       ORDER BY md.id DESC
       LIMIT ${perPage} OFFSET ${skip}`, ...params);
    const total = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM machine_data md
       INNER JOIN machines m ON m.id = md.machine_id
       WHERE ${where.join(' AND ')}`, ...params);
    return { data, total: Number(total[0]?.count ?? 0n), page, perPage };
  });
}

// ─── summary endpoints ─────────────────────────────────────────────────────

const SUMMARY_TYPE_LABELS = {
  1: 'empty', 2: 'nonEmpty', 3: 'distinct', 4: 'sum', 5: 'max', 6: 'min', 7: 'avg',
};

function buildSummarySql(fromSql, columns, type) {
  const exprs = columns.map(({ key, col, kind }) => {
    switch (type) {
      case 1: return `SUM(CASE WHEN ${col} IS NULL OR ${col}::text = '' THEN 1 ELSE 0 END)::int AS "${key}"`;
      case 2: return `SUM(CASE WHEN ${col} IS NOT NULL AND ${col}::text != '' THEN 1 ELSE 0 END)::int AS "${key}"`;
      case 3: return `COUNT(DISTINCT ${col})::int AS "${key}"`;
      case 4: return kind === 'numeric' ? `COALESCE(SUM(${col}),0)::text AS "${key}"` : `'0' AS "${key}"`;
      case 5: return kind === 'numeric' ? `MAX(${col})::text AS "${key}"` : `'0' AS "${key}"`;
      case 6: return kind === 'numeric' ? `MIN(${col})::text AS "${key}"` : `'0' AS "${key}"`;
      case 7: return kind === 'numeric' ? `ROUND(AVG(${col})::numeric, 2)::text AS "${key}"` : `'0' AS "${key}"`;
      default: return `NULL AS "${key}"`;
    }
  });
  return `SELECT ${exprs.join(', ')} FROM ${fromSql}`;
}

async function getSummary(tenant, userId, tab, type) {
  const t = Number(type);
  if (!Number.isInteger(t) || t < 1 || t > 7) throw new BadRequestError('summary-type-invalid');

  const COLS = {
    production: [
      { key: 'flowName', col: 'fd.name', kind: 'text' },
      { key: 'equipmentName', col: 'e.name', kind: 'text' },
      { key: 'partNumber', col: 'p.part_no', kind: 'text' },
      { key: 'partName', col: 'p.name', kind: 'text' },
      { key: 'shiftName', col: 'pd.work_shift_name', kind: 'text' },
      { key: 'orderNo', col: 'pd.order_no', kind: 'text' },
      { key: 'workedHours', col: 'pd.work_hours', kind: 'text' },
      { key: 'okPartsQty', col: 'pd.part_qty', kind: 'numeric' },
      { key: 'plannedQty', col: 'pd.planned_qty', kind: 'numeric' },
      { key: 'comment', col: 'pd.comment', kind: 'text' },
      { key: 'selectedDate', col: 'pd.date', kind: 'date' },
    ],
    scrap: [
      { key: 'flowName', col: 'fd.name', kind: 'text' },
      { key: 'equipmentName', col: 'e.name', kind: 'text' },
      { key: 'partNumber', col: 'p.part_no', kind: 'text' },
      { key: 'partName', col: 'p.name', kind: 'text' },
      { key: 'shiftName', col: 'sd.work_shift_name', kind: 'text' },
      { key: 'orderNo', col: 'sd.order_no', kind: 'text' },
      { key: 'quantity', col: 'sd.quantity', kind: 'numeric' },
      { key: 'scrapType', col: 't.name', kind: 'text' },
      { key: 'scrapReason', col: 'sr.name', kind: 'text' },
      { key: 'comment', col: 'sd.comment', kind: 'text' },
      { key: 'selectedDate', col: 'sd.date', kind: 'date' },
    ],
    stop: [
      { key: 'flowName', col: 'fd.name', kind: 'text' },
      { key: 'equipmentName', col: 'e.name', kind: 'text' },
      { key: 'partNumber', col: 'p.part_no', kind: 'text' },
      { key: 'partName', col: 'p.name', kind: 'text' },
      { key: 'shiftName', col: 'sd.work_shift_name', kind: 'text' },
      { key: 'orderNo', col: 'sd.order_no', kind: 'text' },
      { key: 'quantity', col: 'sd.quantity', kind: 'numeric' },
      { key: 'sumOfTimeSec', col: 'sd.sum_of_time', kind: 'numeric' },
      { key: 'stopType', col: 't.name', kind: 'text' },
      { key: 'stopReason', col: 'sr.name', kind: 'text' },
      { key: 'comment', col: 'sd.comment', kind: 'text' },
      { key: 'selectedDate', col: 'sd.date', kind: 'date' },
    ],
  }[tab];
  if (!COLS) throw new BadRequestError('summary-tab-invalid');

  const FROM = {
    production: `production_data pd
      LEFT JOIN flow_designs fd ON fd.id = pd.flow_id
      LEFT JOIN equipment e ON e.id = pd.flow_object_key
      LEFT JOIN parts p ON p.id = pd.part_id
      WHERE pd.deleted_at IS NULL AND pd.created_by = $1`,
    scrap: `scrap_data sd
      LEFT JOIN flow_designs fd ON fd.id = sd.flow_id
      LEFT JOIN equipment e ON e.id = sd.flow_object_key
      LEFT JOIN parts p ON p.id = sd.part_id
      LEFT JOIN types t ON t.id = sd.scrap_type_id
      LEFT JOIN scrap_reasons sr ON sr.id = sd.reason
      WHERE sd.deleted_at IS NULL AND sd.created_by = $1`,
    stop: `stop_data sd
      LEFT JOIN flow_designs fd ON fd.id = sd.flow_id
      LEFT JOIN equipment e ON e.id = sd.flow_object_key
      LEFT JOIN parts p ON p.id = sd.part_id
      LEFT JOIN types t ON t.id = sd.stop_type_id
      LEFT JOIN stop_reasons sr ON sr.id = sd.reason
      WHERE sd.deleted_at IS NULL AND sd.created_by = $1`,
  }[tab];

  return withTenant(tenant, async (tx) => {
    const rows = await tx.$queryRawUnsafe(buildSummarySql(FROM, COLS, t), userId);
    return { type: t, label: SUMMARY_TYPE_LABELS[t], row: rows[0] || {} };
  });
}

// ─── edit-form lookups + upsert + delete ───────────────────────────────────

async function getEditRow(tenant, userId, tab, id) {
  return withTenant(tenant, async (tx) => {
    let row;
    if (tab === 'production') {
      row = (await tx.$queryRawUnsafe(`SELECT * FROM production_data WHERE id = $1 AND deleted_at IS NULL`, id))[0];
    } else if (tab === 'scrap') {
      row = (await tx.$queryRawUnsafe(`SELECT * FROM scrap_data WHERE id = $1 AND deleted_at IS NULL`, id))[0];
    } else if (tab === 'stop') {
      row = (await tx.$queryRawUnsafe(`SELECT * FROM stop_data WHERE id = $1 AND deleted_at IS NULL`, id))[0];
    } else if (tab === 'warning') {
      row = (await tx.$queryRawUnsafe(`SELECT * FROM warning_data WHERE id = $1`, id))[0];
    } else {
      throw new BadRequestError('tab-invalid');
    }
    if (!row) throw new NotFoundError('row-not-found');
    if (Number(row.created_by) !== Number(userId)) throw new ForbiddenError('not-row-owner');

    const parts = await tx.$queryRawUnsafe(`SELECT id, part_no AS "partNo", name FROM parts WHERE status = 1 ORDER BY name`);
    const shifts = await tx.$queryRawUnsafe(`SELECT id, name FROM work_shifts WHERE status = 1 ORDER BY name`);

    let types = null, reasons = null;
    if (tab === 'stop') {
      types = await tx.$queryRawUnsafe(`SELECT id, name, type, exclude_type AS "excludeType" FROM types WHERE entity = 'StopReason' AND is_active = true ORDER BY name`);
      reasons = await tx.$queryRawUnsafe(`SELECT id, name, type_id AS "typeId" FROM stop_reasons WHERE status = 1 ORDER BY name`);
    } else if (tab === 'scrap') {
      types = await tx.$queryRawUnsafe(`SELECT id, name, type FROM types WHERE entity = 'ScrapReason' AND is_active = true ORDER BY name`);
      reasons = await tx.$queryRawUnsafe(`SELECT id, name, type_id AS "typeId" FROM scrap_reasons WHERE status = 1 ORDER BY name`);
    }

    let scheduleTitles = null;
    if (row.work_shift_id === 0 && row.date && row.flow_object_key) {
      scheduleTitles = await loadScheduleTitles(tx, row.date, row.flow_object_key);
    }

    return { row, parts, shifts, types, reasons, scheduleTitles };
  });
}

async function loadScheduleTitles(tx, date, equipmentId) {
  const rows = await tx.$queryRawUnsafe(
    `SELECT DISTINCT ssd.title
     FROM equipment_shift_schedule ess
     INNER JOIN shift_schedule_data ssd ON ssd.schedule_id = ess.schedule_id
     WHERE ess.equipment_id = $1
       AND DATE(ssd.start) <= $2::date AND DATE(ssd.end) >= $2::date
     ORDER BY ssd.title`,
    Number(equipmentId), date,
  ).catch(() => []);
  return rows.map((r) => r.title);
}

async function upsertProduction(tenant, user, dto, id) {
  if (id) {
    await assertOwnership(tenant, 'production_data', id, user.id);
    return adminSvc.updateProduction(tenant, id, dto);
  }
  return adminSvc.createProduction(tenant, user, dto);
}

async function upsertScrap(tenant, user, dto, id) {
  if (id) {
    await assertOwnership(tenant, 'scrap_data', id, user.id);
    return adminSvc.updateScrap(tenant, id, dto);
  }
  return adminSvc.createScrap(tenant, user, dto);
}

async function upsertStop(tenant, user, dto, id) {
  if (dto.time) {
    const [h, m, s] = String(dto.time).split(':').map((x) => Number(x) || 0);
    dto.hours = h; dto.minutes = m;
    dto.sumOfTime = (h * 3600 + m * 60 + s) * (Number(dto.quantity) || 1);
  }
  if (id) {
    await assertOwnership(tenant, 'stop_data', id, user.id);
    return adminSvc.updateStop(tenant, id, dto);
  }
  return adminSvc.createStop(tenant, user, dto);
}

async function upsertWarning(tenant, user, dto, id) {
  return withTenant(tenant, async (tx) => {
    const duration = dto.fromTime && dto.toTime
      ? Math.max(0, Math.floor((new Date(dto.toTime).getTime() - new Date(dto.fromTime).getTime()) / 1000))
      : 0;
    if (id) {
      const existing = (await tx.$queryRawUnsafe(`SELECT created_by FROM warning_data WHERE id = $1`, id))[0];
      if (!existing) throw new NotFoundError('warning-not-found');
      if (Number(existing.created_by) !== Number(user.id)) throw new ForbiddenError('not-row-owner');
      const u = await tx.$queryRawUnsafe(
        `UPDATE warning_data
         SET equipment_id = $1, notification_text = $2, from_time = $3, to_time = $4,
             duration = $5, updated_at = now()
         WHERE id = $6 RETURNING id`,
        Number(dto.equipmentId), String(dto.notificationText || ''),
        dto.fromTime, dto.toTime, duration, id,
      );
      return { id: u[0].id, updated: true };
    }
    const ins = await tx.$queryRawUnsafe(
      `INSERT INTO warning_data
         (equipment_id, machine_id, notification_text, from_time, to_time, duration,
          created_by, created_by_email, created_by_name, created_at, updated_at)
       VALUES ($1, 0, $2, $3, $4, $5, $6, $7, $8, now(), now())
       RETURNING id`,
      Number(dto.equipmentId), String(dto.notificationText || ''),
      dto.fromTime, dto.toTime, duration,
      user.id, user.email || '', user.name || '',
    );
    return { id: ins[0].id, created: true };
  });
}

// warning_data has no `deleted_at` column — hard-delete instead.
const HARD_DELETE_TABLES = new Set(['warning_data']);

async function softDelete(tenant, userId, tab, id) {
  const table = { production: 'production_data', scrap: 'scrap_data', stop: 'stop_data', warning: 'warning_data' }[tab];
  if (!table) throw new BadRequestError('tab-invalid');
  await assertOwnership(tenant, table, id, userId);
  return withTenant(tenant, async (tx) => {
    if (HARD_DELETE_TABLES.has(table)) {
      await tx.$queryRawUnsafe(`DELETE FROM ${table} WHERE id = $1`, id);
    } else {
      await tx.$queryRawUnsafe(`UPDATE ${table} SET deleted_at = now() WHERE id = $1`, id);
    }
    return { deleted: true };
  });
}

async function assertOwnership(tenant, table, id, userId) {
  return withTenant(tenant, async (tx) => {
    const softClause = HARD_DELETE_TABLES.has(table) ? '' : ' AND deleted_at IS NULL';
    const rows = await tx.$queryRawUnsafe(
      `SELECT created_by FROM ${table} WHERE id = $1${softClause}`, id,
    );
    if (!rows[0]) throw new NotFoundError(`${table}-not-found`);
    if (Number(rows[0].created_by) !== Number(userId)) throw new ForbiddenError('not-row-owner');
  });
}

// ─── per-user table_settings JSON merge ────────────────────────────────────

async function saveTableSetting(userId, key, subKey, data) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { tablePreferences: true } });
  const cur = (u && u.tablePreferences) || {};
  if (subKey == null || subKey === '') {
    cur[key] = data;
  } else {
    cur[key] = { ...(cur[key] || {}), [subKey]: data };
  }
  await prisma.user.update({ where: { id: userId }, data: { tablePreferences: cur } });
  return cur;
}

async function readTablePrefs(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { tablePreferences: true } });
  return (u && u.tablePreferences) || {};
}

// ─── legacy back-compat (the previous frontend page calls these) ───────────

async function listProductionMine(tenant, userId, q) {
  return listProduction(tenant, userId, {
    page: q.page, perPage: q.perPage,
    start_date: q.from, end_date: q.to,
    filters: q.filters,
  });
}
async function listScrapMine(tenant, userId, q) {
  return listScrap(tenant, userId, {
    page: q.page, perPage: q.perPage,
    start_date: q.from, end_date: q.to,
    filters: q.filters,
  });
}
async function listStopMine(tenant, userId, q) {
  return listStop(tenant, userId, {
    page: q.page, perPage: q.perPage,
    start_date: q.from, end_date: q.to,
    filters: q.filters,
    exclude_type: q.includeExcluded ? '1' : '0',
  });
}
async function updateProductionMine(tenant, userId, id, dto) {
  await assertOwnership(tenant, 'production_data', id, userId);
  return adminSvc.updateProduction(tenant, id, dto);
}
async function updateScrapMine(tenant, userId, id, dto) {
  await assertOwnership(tenant, 'scrap_data', id, userId);
  return adminSvc.updateScrap(tenant, id, dto);
}
async function updateStopMine(tenant, userId, id, dto) {
  await assertOwnership(tenant, 'stop_data', id, userId);
  return adminSvc.updateStop(tenant, id, dto);
}

module.exports = {
  getTabs,
  listProduction, listScrap, listStop, listWarning, listUnregistered,
  getSummary,
  getEditRow,
  upsertProduction, upsertScrap, upsertStop, upsertWarning,
  softDelete,
  saveTableSetting, readTablePrefs,
  parseFilterOperator,
  // back-compat
  listProductionMine, listScrapMine, listStopMine,
  updateProductionMine, updateScrapMine, updateStopMine,
};
