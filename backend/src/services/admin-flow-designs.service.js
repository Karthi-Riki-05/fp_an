'use strict';

const crypto = require('crypto');
const fileStorage = require('./file-storage.service');
const { withTenant } = require('../prisma/client');
const { BadRequestError, ConflictError, NotFoundError } = require('../errors');

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

// ────────────────────── Step 1 — extended endpoints ──────────────────────

/**
 * Return only flow_data (and the row id+name for context). Used by the
 * Designer to load the diagram into GoJS and by the Monitor/Analyzer card
 * grids to render thumbnails client-side.
 */
async function getDiagram(tenant, id) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `SELECT id, name, flow_data AS "flowData",
              flow_format AS "flowFormat", svg_cache AS "svgCache"
         FROM flow_designs WHERE id = $1 AND deleted_at IS NULL`,
      id,
    ),
  );
  if (!rows[0]) throw new NotFoundError('flow-design-not-found');
  return rows[0];
}

// Cap thumbnail SVGs so a runaway diagram (hundreds of nodes) doesn't
// balloon flow_designs.svg_cache to multi-MB rows. 500 KB is well above
// every realistic diagram we'd ship and still cheap to store.
const SVG_MAX_BYTES = 500_000;

/**
 * Save the flow diagram (drawio XML preferred; legacy GoJS JSON tolerated
 * but never freshly written — pre-§11 rows were blanked). When `asNewName`
 * is provided the call creates a NEW row (Save As). Tenant-scoped name
 * uniqueness on Save As — 409 on conflict.
 *
 * Format detection
 *   - drawio XML  → starts with '<' (e.g. '<mxGraphModel' or '<mxfile')
 *   - legacy GoJS → starts with '{' AND JSON-parses to { nodeDataArray }
 *   - anything else → 400 flowData-unknown-format
 *
 * Setting `flow_format='drawio'` on every drawio save means any
 * pre-§11 GoJS row that gets re-saved through the new editor flips its
 * format flag automatically — no separate migration step needed.
 *
 * Optional `svgData` (drawio path only) is the export SVG captured by
 * the Designer at save-time. Stored verbatim in svg_cache for the
 * FlowCard thumbnail render in Monitor/Analyzer card grids.
 */
async function saveDiagram(tenant, id, { flowData, asNewName, svgData }) {
  if (typeof flowData !== 'string' || flowData.length === 0) {
    throw new BadRequestError('flowData-required');
  }

  const trimmed = flowData.trimStart();
  let flowFormat;
  if (trimmed.startsWith('<')) {
    // drawio XML — accept as-is, no DOM parse here (drawio itself validates
    // on load; a syntactically broken XML would re-open as a blank canvas).
    flowFormat = 'drawio';
  } else if (trimmed.startsWith('{')) {
    let parsed;
    try { parsed = JSON.parse(trimmed); } catch { throw new BadRequestError('flowData-not-json'); }
    if (!parsed || !Array.isArray(parsed.nodeDataArray)) {
      throw new BadRequestError('flowData-missing-nodeDataArray');
    }
    flowFormat = 'gojs';
  } else {
    throw new BadRequestError('flowData-unknown-format');
  }

  // Validate / cap the SVG thumbnail.
  let svgToStore = null;
  if (svgData !== undefined && svgData !== null && svgData !== '') {
    if (typeof svgData !== 'string') throw new BadRequestError('svgData-not-string');
    const svgHead = svgData.trimStart();
    if (!/^<svg/i.test(svgHead)) throw new BadRequestError('svgData-not-svg');
    if (svgData.length > SVG_MAX_BYTES) {
      // eslint-disable-next-line no-console
      console.warn(`[flow-designs] svgData oversized (${svgData.length} bytes > ${SVG_MAX_BYTES}); skipping cache for flow id=${id}`);
      svgToStore = null;
    } else {
      svgToStore = svgData;
    }
  }

  return withTenant(tenant, async (tx) => {
    if (asNewName !== undefined && asNewName !== null && asNewName !== '') {
      const name = String(asNewName).slice(0, 250);
      const dupes = await tx.$queryRawUnsafe(
        `SELECT id FROM flow_designs WHERE name = $1 AND deleted_at IS NULL LIMIT 1`,
        name,
      );
      if (dupes[0]) throw new ConflictError('name-already-in-use');
      const rows = await tx.$queryRawUnsafe(
        `INSERT INTO flow_designs (name, flow_data, flow_format, svg_cache, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 1, now(), now())
         RETURNING id, name, flow_format AS "flowFormat"`,
        name, flowData, flowFormat, svgToStore,
      );
      return rows[0];
    }
    // Update existing. svg_cache is only overwritten when svgData was
    // supplied — autosave (no SVG) leaves the previous thumbnail in place.
    const sets = ['flow_data = $1', 'flow_format = $2', 'updated_at = now()'];
    const params = [flowData, flowFormat];
    if (svgData !== undefined) {
      params.push(svgToStore);
      sets.push(`svg_cache = $${params.length}`);
    }
    params.push(id);
    const rows = await tx.$queryRawUnsafe(
      `UPDATE flow_designs SET ${sets.join(', ')}
        WHERE id = $${params.length} AND deleted_at IS NULL
        RETURNING id, name, flow_format AS "flowFormat"`,
      ...params,
    );
    if (!rows[0]) throw new NotFoundError('flow-design-not-found');
    return rows[0];
  });
}

/**
 * Multipart background image upload. Stored under flow-bg/<flowId>/<sha>.<ext>
 * via FileStorageService. Does NOT mutate flow_data — the client is
 * responsible for putting the returned url into the GoJS bg-node and saving
 * the diagram. Matches the prompt's explicit Step 1 contract.
 */
async function uploadBackground(tenant, id, file) {
  if (!file || !file.buffer) throw new BadRequestError('image-file-required');
  // Confirm the flow exists in this tenant before writing.
  await findOne(tenant, id);
  const safePrefix = `flow-bg/${id}`;
  const stored = await fileStorage.put(safePrefix, file.originalname, file.buffer, file.mimetype);
  return { url: stored.url, key: stored.key, size: stored.size };
}

async function removeBackground(tenant, id, url) {
  if (!url || typeof url !== 'string') throw new BadRequestError('url-required');
  await findOne(tenant, id);
  // url is `<publicBase>/<key>` — strip the public base off.
  const publicBase = (process.env.STORAGE_PUBLIC_BASE || '/uploads').replace(/\/$/, '');
  const key = url.startsWith(publicBase + '/') ? url.slice(publicBase.length + 1) : url.replace(/^\//, '');
  await fileStorage.del(key);
}

/**
 * Read-only attributes endpoint. Per §9 Q3 the GoJS-era Designer never
 * writes here — the data is preserved only for legacy importers / Phase 6.
 */
async function getAttributes(tenant, id) {
  await findOne(tenant, id);
  return withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `SELECT id::int AS id, flow_design_id::int AS "flowDesignId",
              relation_id::int AS "relationId", type AS kind,
              "left"::int AS "posLeft", "right"::int AS "posRight",
              created_at AS "createdAt", updated_at AS "updatedAt"
         FROM flow_design_attributes
        WHERE flow_design_id = $1
        ORDER BY id`,
      id,
    ),
  );
}

/**
 * Non-paginated list of ACTIVE flows with flow_data included. Used by the
 * Monitor + Analyzer card grids — the client renders SVG thumbnails from
 * flow_data once GoJS is in place.
 */
async function listWithData(tenant) {
  return withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `SELECT id::int AS id, name, status::int AS status,
              flow_data   AS "flowData",
              flow_format AS "flowFormat",
              svg_cache   AS "svgCache",
              updated_at  AS "updatedAt"
         FROM flow_designs
        WHERE deleted_at IS NULL AND status = 1
        ORDER BY name ASC`,
    ),
  );
}

/**
 * Live monitor status for each equipment-bound node in the flow.
 *
 * Walks `flow_data.nodeDataArray` and picks keys that are numeric — those
 * are equipment ids (palette shapes use string keys like "start" / "end").
 * For each equipment id, joins to all Machines on that equipment, picks the
 * latest by `last_online`, and returns its running_status + connection +
 * last seen + the latest MachineData registration state.
 *
 * Mirrors the data contract of legacy `CompanyUserController::getMachineStatus`
 * (`:2178`), but keyed by equipment id instead of machine id so the GoJS
 * canvas can paint the badge on the node directly.
 */
async function getMonitorStatus(tenant, id) {
  const flow = await getDiagram(tenant, id);
  let nodes = [];
  if (flow.flowData) {
    try {
      const parsed = JSON.parse(flow.flowData);
      if (Array.isArray(parsed?.nodeDataArray)) nodes = parsed.nodeDataArray;
    } catch { /* malformed flow — treat as empty */ }
  }
  const equipmentIds = [...new Set(nodes
    .map((n) => Number(n?.key))
    .filter((k) => Number.isInteger(k) && k > 0))];
  if (equipmentIds.length === 0) return [];

  return withTenant(tenant, async (tx) => {
    // One latest machine row per equipment (sorted by last_online DESC).
    const rows = await tx.$queryRawUnsafe(
      `SELECT DISTINCT ON (m.equipment_id)
              m.equipment_id::int AS "equipmentId",
              m.id::int           AS "machineId",
              m.running_status    AS "runningStatus",
              m.unit_connected    AS "unitConnected",
              m.last_online       AS "lastOnline",
              m.signal_type       AS "signalType"
         FROM machines m
        WHERE m.equipment_id = ANY($1::int[])
        ORDER BY m.equipment_id, m.last_online DESC NULLS LAST, m.id DESC`,
      equipmentIds,
    );
    // Attach latest MachineData (is_registered + start_time) for each.
    const machineIds = rows.map((r) => r.machineId);
    let latestData = [];
    if (machineIds.length > 0) {
      latestData = await tx.$queryRawUnsafe(
        `SELECT DISTINCT ON (md.machine_id)
                md.machine_id::int   AS "machineId",
                md.id::int           AS "machineDataId",
                md.start_time        AS "startTime",
                md.is_registered     AS "isRegistered"
           FROM machine_data md
          WHERE md.machine_id = ANY($1::int[])
          ORDER BY md.machine_id, md.id DESC`,
        machineIds,
      );
    }
    const dataByMachine = new Map(latestData.map((d) => [d.machineId, d]));
    return rows.map((r) => ({
      equipmentId: r.equipmentId,
      machineId: r.machineId,
      runningStatus: r.runningStatus,
      unitConnected: r.unitConnected,
      lastOnline: r.lastOnline,
      signalType: r.signalType,
      latestData: dataByMachine.get(r.machineId) ?? null,
    }));
  });
}

function parseDateOnly(s, fallback) {
  if (!s) return fallback;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? fallback : s.slice(0, 10);
}

/**
 * Analyzer dashboard data. Aggregates production / scrap / stop per
 * equipment for the flow over a date range. Mirrors legacy
 * CompanyUserController::getFlowAnalyzer/getFlowData (`:1692+`).
 */
async function getAnalyzerData(tenant, id, q = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const startDate = parseDateOnly(q.startDate, today);
  const endDate   = parseDateOnly(q.endDate, today);
  const flowKey   = q.flowKey !== undefined && q.flowKey !== '' ? Number(q.flowKey) : null;

  await findOne(tenant, id);
  return withTenant(tenant, async (tx) => {
    // Production aggregated per equipment (flow_object_key).
    const productionWhere = [`pd.flow_id = $1`, `pd.date BETWEEN $2::date AND $3::date`];
    const productionParams = [id, startDate, endDate];
    if (flowKey !== null) { productionParams.push(flowKey); productionWhere.push(`pd.flow_object_key = $${productionParams.length}`); }
    const production = await tx.$queryRawUnsafe(
      `SELECT pd.flow_object_key::int AS "equipmentId",
              SUM(pd.part_qty)::int  AS "okQty",
              SUM(pd.planned_qty)::int AS "plannedQty",
              SUM(CASE WHEN pd.work_hours ~ '^[0-9]+$' THEN pd.work_hours::int ELSE 0 END)::int AS "workedHoursMin"
         FROM production_data pd
        WHERE ${productionWhere.join(' AND ')} AND pd.status = 1
        GROUP BY pd.flow_object_key`,
      ...productionParams,
    );

    // Stops aggregated per (equipment, reason).
    const stopWhere = [`sd.flow_id = $1`, `sd.date BETWEEN $2::date AND $3::date`, `sd.deleted_at IS NULL`];
    const stopParams = [id, startDate, endDate];
    if (flowKey !== null) { stopParams.push(flowKey); stopWhere.push(`sd.flow_object_key = $${stopParams.length}`); }
    const stops = await tx.$queryRawUnsafe(
      `SELECT sd.flow_object_key::int AS "equipmentId",
              sd.reason::int         AS "stopReasonId",
              sr.name                AS "stopReasonName",
              SUM(sd.quantity)::int  AS "count",
              SUM(sd.hours * 60 + sd.minutes)::int AS "totalMinutes"
         FROM stop_data sd
         LEFT JOIN stop_reasons sr ON sr.id = sd.reason
        WHERE ${stopWhere.join(' AND ')}
        GROUP BY sd.flow_object_key, sd.reason, sr.name
        ORDER BY "totalMinutes" DESC NULLS LAST`,
      ...stopParams,
    );

    // Scrap aggregated per (equipment, reason).
    const scrapWhere = [`scd.flow_id = $1`, `scd.date BETWEEN $2::date AND $3::date`, `scd.deleted_at IS NULL`];
    const scrapParams = [id, startDate, endDate];
    if (flowKey !== null) { scrapParams.push(flowKey); scrapWhere.push(`scd.flow_object_key = $${scrapParams.length}`); }
    const scraps = await tx.$queryRawUnsafe(
      `SELECT scd.flow_object_key::int AS "equipmentId",
              scd.reason::int         AS "scrapReasonId",
              scr.name                AS "scrapReasonName",
              SUM(scd.quantity)::int  AS "totalQty",
              COUNT(*)::int           AS "count"
         FROM scrap_data scd
         LEFT JOIN scrap_reasons scr ON scr.id = scd.reason
        WHERE ${scrapWhere.join(' AND ')}
        GROUP BY scd.flow_object_key, scd.reason, scr.name
        ORDER BY "totalQty" DESC NULLS LAST`,
      ...scrapParams,
    );

    return { production, stops, scraps, startDate, endDate, flowKey };
  });
}

/**
 * HighCharts series data for a single metric over time. Mirrors legacy
 * CompanyUserController::getLineChart (`:1987-2087`). `type` ∈ scrap|production|stop.
 */
async function getLineChart(tenant, id, q = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const startDate = parseDateOnly(q.startDate, today);
  const endDate   = parseDateOnly(q.endDate, today);
  const type      = q.type || 'stop';
  const flowKey   = q.flowKey !== undefined && q.flowKey !== '' ? Number(q.flowKey) : null;
  const name      = q.name || '';
  const prodGroup = q.prodGroup || 'equipment';

  await findOne(tenant, id);
  return withTenant(tenant, async (tx) => {
    if (type === 'scrap') {
      let reasonId = null;
      if (name) {
        const r = await tx.$queryRawUnsafe(
          `SELECT id::int FROM scrap_reasons WHERE name = $1 AND status = 1 LIMIT 1`, name,
        );
        reasonId = r[0]?.id ?? null;
      }
      const where = [`flow_id = $1`, `date BETWEEN $2::date AND $3::date`, `deleted_at IS NULL`];
      const params = [id, startDate, endDate];
      if (flowKey !== null) { params.push(flowKey); where.push(`flow_object_key = $${params.length}`); }
      if (reasonId !== null) { params.push(reasonId); where.push(`reason = $${params.length}`); }
      return tx.$queryRawUnsafe(
        `SELECT date::text AS d, SUM(quantity)::int AS quantity
           FROM scrap_data WHERE ${where.join(' AND ')}
          GROUP BY d ORDER BY d`,
        ...params,
      );
    }
    if (type === 'production') {
      const where = [`flow_id = $1`, `date BETWEEN $2::date AND $3::date`];
      const params = [id, startDate, endDate];
      if (flowKey !== null) { params.push(flowKey); where.push(`flow_object_key = $${params.length}`); }
      if (name) {
        if (prodGroup === 'part') {
          const partNo = name.split('-')[0].trim();
          const r = await tx.$queryRawUnsafe(`SELECT id::int FROM parts WHERE part_no = $1 LIMIT 1`, partNo);
          const partId = r[0]?.id;
          if (partId) { params.push(partId); where.push(`part_id = $${params.length}`); }
        } else if (prodGroup === 'equipment') {
          const r = await tx.$queryRawUnsafe(`SELECT id::int FROM equipment WHERE name = $1 AND is_active = true LIMIT 1`, name);
          const eqId = r[0]?.id;
          if (eqId) { params.push(eqId); where.push(`flow_object_key = $${params.length}`); }
        } else if (prodGroup === 'work_shift') {
          params.push(name.trim()); where.push(`work_shift_name = $${params.length}`);
        } else {
          params.push(name.trim()); where.push(`order_no = $${params.length}`);
        }
      }
      return tx.$queryRawUnsafe(
        `SELECT date::text AS d,
                SUM(part_qty)::int    AS "okQty",
                SUM(planned_qty)::int AS "plannedQty"
           FROM production_data WHERE ${where.join(' AND ')}
          GROUP BY d ORDER BY d`,
        ...params,
      );
    }
    // type === 'stop'
    let reasonId = null;
    if (name) {
      const r = await tx.$queryRawUnsafe(
        `SELECT id::int FROM stop_reasons WHERE name = $1 AND status = 1 LIMIT 1`, name,
      );
      reasonId = r[0]?.id ?? null;
    }
    const where = [`flow_id = $1`, `date BETWEEN $2::date AND $3::date`, `deleted_at IS NULL`];
    const params = [id, startDate, endDate];
    if (flowKey !== null) { params.push(flowKey); where.push(`flow_object_key = $${params.length}`); }
    if (reasonId !== null) { params.push(reasonId); where.push(`reason = $${params.length}`); }
    return tx.$queryRawUnsafe(
      `SELECT date::text AS d,
              SUM(quantity)::int AS quantity,
              SUM(hours)::int    AS hours,
              SUM(minutes)::int  AS minutes
         FROM stop_data WHERE ${where.join(' AND ')}
        GROUP BY d ORDER BY d`,
      ...params,
    );
  });
}

/**
 * Stops grouped by reason + by date for a flow (optionally one equipment).
 * Mirrors legacy CompanyUserController::getQuantTimeGraph (`:2090-2148`).
 * Returns `{ stopByReason, stopByDate }` — frontend's HighCharts panels
 * read these directly.
 */
async function getQuantTimeGraph(tenant, id, q = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const startDate = parseDateOnly(q.startDate, today);
  const endDate   = parseDateOnly(q.endDate, today);
  const flowKey   = q.flowKey !== undefined && q.flowKey !== '' ? Number(q.flowKey) : null;

  await findOne(tenant, id);
  return withTenant(tenant, async (tx) => {
    const where = [`sd.flow_id = $1`, `sd.date BETWEEN $2::date AND $3::date`, `sd.deleted_at IS NULL`];
    const params = [id, startDate, endDate];
    if (flowKey !== null) { params.push(flowKey); where.push(`sd.flow_object_key = $${params.length}`); }

    const byReason = await tx.$queryRawUnsafe(
      `SELECT sr.id::int AS "reasonId", sr.name AS "name",
              SUM(sd.quantity)::int AS quantity,
              SUM(sd.hours)::int    AS hours,
              SUM(sd.minutes)::int  AS minutes
         FROM stop_data sd
         LEFT JOIN stop_reasons sr ON sr.id = sd.reason
        WHERE ${where.join(' AND ')}
        GROUP BY sd.reason, sr.id, sr.name
        ORDER BY quantity DESC NULLS LAST`,
      ...params,
    );
    const byDate = await tx.$queryRawUnsafe(
      `SELECT sd.date::text AS d, sr.name AS "name",
              SUM(sd.quantity)::int AS quantity,
              SUM(sd.hours)::int    AS hours,
              SUM(sd.minutes)::int  AS minutes
         FROM stop_data sd
         LEFT JOIN stop_reasons sr ON sr.id = sd.reason
        WHERE ${where.join(' AND ')}
        GROUP BY sd.date, sr.name
        ORDER BY sd.date DESC`,
      ...params,
    );
    return { stopByReason: byReason, stopByDate: byDate };
  });
}

function etagFor(body) {
  return '"' + crypto.createHash('sha1').update(JSON.stringify(body)).digest('hex') + '"';
}

module.exports = {
  list, findOne, create, update, patchStatus, softDelete, flowContainsEquipment,
  getDiagram, saveDiagram,
  uploadBackground, removeBackground,
  getAttributes,
  listWithData,
  getMonitorStatus, getAnalyzerData, getLineChart, getQuantTimeGraph,
  etagFor,
};
