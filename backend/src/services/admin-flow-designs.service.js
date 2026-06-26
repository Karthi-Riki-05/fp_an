'use strict';

const crypto = require('crypto');
const fileStorage = require('./file-storage.service');
const { withTenant } = require('../prisma/client');
const { BadRequestError, ConflictError, NotFoundError } = require('../errors');

const SELECT = `id, name, status, flow_data AS "flowData",
  flow_format AS "flowFormat", svg_cache AS "svgCache",
  created_at AS "createdAt", updated_at AS "updatedAt"`;

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

  // When equipmentId is supplied we need flow_data to filter in JS. Callers
  // can also force flow_data into the SELECT (without the JSON node filter)
  // via includeFlowData — used by the operator flow-by-equipment lookup,
  // whose flow_data is mxGraph XML and is string-matched by the route.
  const needsFlowData = !!q.equipmentId || !!q.includeFlowData;
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
  let equipmentIds = [];
  if (flow.flowData) {
    const trimmed = flow.flowData.trimStart();
    if (trimmed.startsWith('<')) {
      // drawio XML — Designer's equipment drops attach the FK to a
      // `equipment-id` attribute on the UserObject (see fp-embed.js).
      const re = /equipment-id="(\d+)"/g;
      const ids = new Set();
      let match;
      while ((match = re.exec(trimmed)) !== null) {
        const n = Number(match[1]);
        if (Number.isInteger(n) && n > 0) ids.add(n);
      }
      equipmentIds = [...ids];
    } else if (trimmed.startsWith('{')) {
      // Legacy GoJS — kept for read-back on rows that haven't been
      // re-saved since the drawio migration. Drops out of the parse
      // path the moment someone saves once.
      try {
        const parsed = JSON.parse(flow.flowData);
        const nodes = Array.isArray(parsed?.nodeDataArray) ? parsed.nodeDataArray : [];
        equipmentIds = [...new Set(nodes
          .map((n) => Number(n?.key))
          .filter((k) => Number.isInteger(k) && k > 0))];
      } catch { /* malformed legacy flow — treat as empty */ }
    }
  }
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
 * Parse the Analyzer filter query params into a normalised object.
 * Shared by /analyzer-data and /line-chart so filters mean the same
 * thing on both endpoints.
 *
 *   workShift         filter by work_shift_name (exact match — operator
 *                     selects from the same list)
 *   partId            filter by part_id (production / scrap)
 *   orderNo           filter by order_no (ILIKE, partial)
 *   includeExcluded   stop tab: when false, drop rows whose
 *                     stop_category.is_active = false
 *   showUnregistered  stop tab: when false, drop rows where
 *                     reason = 0 (operator never picked a reason)
 *   groupBy           production tab: 'Part' | 'Equipment' |
 *                     'WorkShift' | 'Order'. Drives both the
 *                     `analyzer-data` aggregation key and the
 *                     `line-chart` series split.
 */
function parseAnalyzerFilters(q) {
  return {
    workShift:        q.workShift && String(q.workShift).trim() ? String(q.workShift).trim() : null,
    partId:           q.partId !== undefined && q.partId !== '' && Number.isFinite(Number(q.partId)) ? Number(q.partId) : null,
    orderNo:          q.orderNo && String(q.orderNo).trim() ? String(q.orderNo).trim() : null,
    includeExcluded:  q.includeExcluded === '1' || q.includeExcluded === 'true' || q.includeExcluded === true,
    showUnregistered: q.showUnregistered === '1' || q.showUnregistered === 'true' || q.showUnregistered === true,
    groupBy:          (['Part', 'Equipment', 'WorkShift', 'Order'].includes(q.groupBy)) ? q.groupBy : 'Part',
  };
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
  const f         = parseAnalyzerFilters(q);

  await findOne(tenant, id);
  return withTenant(tenant, async (tx) => {
    // ── Stops aggregated per (equipment, reason) with category info. ────
    // includeExcluded=false → drop rows whose stop_category.is_active=false
    // showUnregistered=false → drop rows where reason=0 (no operator pick)
    const stopWhere  = [`sd.flow_id = $1`, `sd.date BETWEEN $2::date AND $3::date`, `sd.deleted_at IS NULL`];
    const stopParams = [id, startDate, endDate];
    const pushStop = (sql, val) => { stopParams.push(val); stopWhere.push(sql.replace('$?', `$${stopParams.length}`)); };
    if (flowKey !== null)      pushStop(`sd.flow_object_key = $?`, flowKey);
    if (f.workShift)           pushStop(`sd.work_shift_name = $?`, f.workShift);
    if (f.partId !== null)     pushStop(`sd.part_id = $?`, f.partId);
    if (f.orderNo)             pushStop(`sd.order_no ILIKE $?`, `%${f.orderNo}%`);
    if (!f.showUnregistered)   stopWhere.push(`sd.reason > 0`);
    if (!f.includeExcluded)    stopWhere.push(`(sc.is_active IS NULL OR sc.is_active = true)`);
    const stops = await tx.$queryRawUnsafe(
      `SELECT sd.flow_object_key::int AS "equipmentId",
              sd.reason::int         AS "stopReasonId",
              sr.name                AS "stopReasonName",
              sr.type_id::int        AS "stopCategoryId",
              sc.name                AS "stopCategoryName",
              SUM(sd.quantity)::int                AS "count",
              SUM(sd.hours * 60 + sd.minutes)::int AS "totalMinutes"
         FROM stop_data sd
         LEFT JOIN stop_reasons  sr ON sr.id = sd.reason
         LEFT JOIN stop_category sc ON sc.id = sr.type_id
        WHERE ${stopWhere.join(' AND ')}
        GROUP BY sd.flow_object_key, sd.reason, sr.name, sr.type_id, sc.name
        ORDER BY "totalMinutes" DESC NULLS LAST`,
      ...stopParams,
    );

    // ── Scraps aggregated per (equipment, reason) with category info. ───
    const scrapWhere  = [`scd.flow_id = $1`, `scd.date BETWEEN $2::date AND $3::date`, `scd.deleted_at IS NULL`];
    const scrapParams = [id, startDate, endDate];
    const pushScrap = (sql, val) => { scrapParams.push(val); scrapWhere.push(sql.replace('$?', `$${scrapParams.length}`)); };
    if (flowKey !== null)  pushScrap(`scd.flow_object_key = $?`, flowKey);
    if (f.workShift)       pushScrap(`scd.work_shift_name = $?`, f.workShift);
    if (f.partId !== null) pushScrap(`scd.part_id = $?`, f.partId);
    if (f.orderNo)         pushScrap(`scd.order_no ILIKE $?`, `%${f.orderNo}%`);
    const scraps = await tx.$queryRawUnsafe(
      `SELECT scd.flow_object_key::int AS "equipmentId",
              scd.reason::int         AS "scrapReasonId",
              scr.name                AS "scrapReasonName",
              t.id::int               AS "scrapCategoryId",
              t.name                  AS "scrapCategoryName",
              SUM(scd.quantity)::int  AS "totalQty",
              COUNT(*)::int           AS "count"
         FROM scrap_data scd
         LEFT JOIN scrap_reasons scr ON scr.id = scd.reason
         LEFT JOIN types         t   ON t.id = scr.type_id AND t.entity = 'ScrapReason'
        WHERE ${scrapWhere.join(' AND ')}
        GROUP BY scd.flow_object_key, scd.reason, scr.name, t.id, t.name
        ORDER BY "totalQty" DESC NULLS LAST`,
      ...scrapParams,
    );

    // ── Production aggregated per groupBy bucket. ───────────────────────
    // groupBy=Part → (part_id, parts.name); Equipment → flow_object_key
    // joined to equipment.name; WorkShift → work_shift_name; Order →
    // order_no. The frontend renders one bar chart over the `label`s.
    const prodWhere  = [`pd.flow_id = $1`, `pd.date BETWEEN $2::date AND $3::date`, `pd.status = 1`];
    const prodParams = [id, startDate, endDate];
    const pushProd = (sql, val) => { prodParams.push(val); prodWhere.push(sql.replace('$?', `$${prodParams.length}`)); };
    if (flowKey !== null) pushProd(`pd.flow_object_key = $?`, flowKey);
    if (f.workShift)      pushProd(`pd.work_shift_name = $?`, f.workShift);
    if (f.partId !== null) pushProd(`pd.part_id = $?`, f.partId);
    if (f.orderNo)        pushProd(`pd.order_no ILIKE $?`, `%${f.orderNo}%`);

    let prodSelect, prodGroupBy, prodOrderBy, prodJoin = '';
    switch (f.groupBy) {
      case 'Equipment':
        prodSelect  = `pd.flow_object_key::int AS "key", COALESCE(e.name, 'Equipment #' || pd.flow_object_key) AS label`;
        prodJoin    = `LEFT JOIN equipment e ON e.id = pd.flow_object_key`;
        prodGroupBy = `pd.flow_object_key, e.name`;
        prodOrderBy = `label`;
        break;
      case 'WorkShift':
        prodSelect  = `0::int AS "key", COALESCE(NULLIF(pd.work_shift_name, ''), '—') AS label`;
        prodGroupBy = `pd.work_shift_name`;
        prodOrderBy = `label`;
        break;
      case 'Order':
        prodSelect  = `0::int AS "key", COALESCE(NULLIF(pd.order_no, ''), '—') AS label`;
        prodGroupBy = `pd.order_no`;
        prodOrderBy = `label`;
        break;
      case 'Part':
      default:
        prodSelect  = `pd.part_id::int AS "key", COALESCE(p.part_no || ' - ' || p.name, '—') AS label`;
        prodJoin    = `LEFT JOIN parts p ON p.id = pd.part_id`;
        prodGroupBy = `pd.part_id, p.part_no, p.name`;
        prodOrderBy = `label`;
        break;
    }
    const production = await tx.$queryRawUnsafe(
      `SELECT ${prodSelect},
              SUM(pd.part_qty)::int    AS "okQty",
              SUM(pd.planned_qty)::int AS "plannedQty",
              SUM(CASE WHEN pd.work_hours ~ '^[0-9]+$' THEN pd.work_hours::int ELSE 0 END)::int AS "workedHoursMin"
         FROM production_data pd
         ${prodJoin}
        WHERE ${prodWhere.join(' AND ')}
        GROUP BY ${prodGroupBy}
        ORDER BY ${prodOrderBy}`,
      ...prodParams,
    );

    return { production, stops, scraps, startDate, endDate, flowKey };
  });
}

/**
 * HighCharts series data for a metric over time. `type ∈ stop|scrap|production`.
 *
 * Returns the HighCharts-friendly shape the tabbed Analyzer renders directly:
 *   { categories: ['YYYY-MM-DD', …], series: [{ name, data: [n, …] }] }
 *
 * - stop / scrap: one series per reason (matching the bar chart's bins),
 *   data[i] = count on that date.
 * - production: 1–N series depending on groupBy. Default groupBy=Part →
 *   two series "OK parts qty" and "Planned Qty". groupBy=Equipment/
 *   WorkShift/Order behave the same — single grouping dimension over time.
 *
 * Filters mirror /analyzer-data exactly (parseAnalyzerFilters).
 */
async function getLineChart(tenant, id, q = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const startDate = parseDateOnly(q.startDate, today);
  const endDate   = parseDateOnly(q.endDate, today);
  const type      = ['stop', 'scrap', 'production'].includes(q.type) ? q.type : 'stop';
  const flowKey   = q.flowKey !== undefined && q.flowKey !== '' ? Number(q.flowKey) : null;
  const f         = parseAnalyzerFilters(q);

  await findOne(tenant, id);
  return withTenant(tenant, async (tx) => {
    if (type === 'stop' || type === 'scrap') {
      const table = type === 'stop' ? 'stop_data' : 'scrap_data';
      const reasonTable = type === 'stop' ? 'stop_reasons' : 'scrap_reasons';
      const reasonAlias = type === 'stop' ? 'sr' : 'scr';
      const where  = [`d.flow_id = $1`, `d.date BETWEEN $2::date AND $3::date`, `d.deleted_at IS NULL`];
      const params = [id, startDate, endDate];
      const push = (sql, val) => { params.push(val); where.push(sql.replace('$?', `$${params.length}`)); };
      if (flowKey !== null)   push(`d.flow_object_key = $?`, flowKey);
      if (f.workShift)        push(`d.work_shift_name = $?`, f.workShift);
      if (f.partId !== null)  push(`d.part_id = $?`, f.partId);
      if (f.orderNo)          push(`d.order_no ILIKE $?`, `%${f.orderNo}%`);
      if (type === 'stop') {
        if (!f.showUnregistered) where.push(`d.reason > 0`);
        if (!f.includeExcluded)  where.push(`(sc.is_active IS NULL OR sc.is_active = true)`);
      }
      const rows = await tx.$queryRawUnsafe(
        `SELECT d.date::text AS day,
                COALESCE(${reasonAlias}.name, 'Unregistered') AS series,
                SUM(d.quantity)::int AS qty
           FROM ${table} d
           LEFT JOIN ${reasonTable} ${reasonAlias} ON ${reasonAlias}.id = d.reason
           ${type === 'stop' ? `LEFT JOIN stop_category sc ON sc.id = sr.type_id` : ''}
          WHERE ${where.join(' AND ')}
          GROUP BY d.date, ${reasonAlias}.name
          ORDER BY d.date`,
        ...params,
      );
      return pivotIntoSeries(rows);
    }

    // type === 'production' — split by groupBy bucket; default is two series
    // (OK + Planned). For non-Part groupings we still emit two series but
    // also one bucket-per-label so the chart legend mirrors the bar chart.
    const where  = [`pd.flow_id = $1`, `pd.date BETWEEN $2::date AND $3::date`, `pd.status = 1`];
    const params = [id, startDate, endDate];
    const push = (sql, val) => { params.push(val); where.push(sql.replace('$?', `$${params.length}`)); };
    if (flowKey !== null)  push(`pd.flow_object_key = $?`, flowKey);
    if (f.workShift)       push(`pd.work_shift_name = $?`, f.workShift);
    if (f.partId !== null) push(`pd.part_id = $?`, f.partId);
    if (f.orderNo)         push(`pd.order_no ILIKE $?`, `%${f.orderNo}%`);

    const rows = await tx.$queryRawUnsafe(
      `SELECT pd.date::text AS day,
              SUM(pd.part_qty)::int    AS "okQty",
              SUM(pd.planned_qty)::int AS "plannedQty"
         FROM production_data pd
        WHERE ${where.join(' AND ')}
        GROUP BY pd.date
        ORDER BY pd.date`,
      ...params,
    );
    const categories = rows.map((r) => r.day);
    return {
      categories,
      series: [
        { name: 'OK parts qty', data: rows.map((r) => Number(r.okQty ?? 0)) },
        { name: 'Planned Qty',  data: rows.map((r) => Number(r.plannedQty ?? 0)) },
      ],
    };
  });
}

/**
 * Turn `[{ day, series, qty }]` (one row per day-and-series) into
 * `{ categories: [day…], series: [{ name, data: [qty per day] }] }`,
 * filling missing combinations with 0. Used by stop+scrap line charts.
 */
function pivotIntoSeries(rows) {
  const dayOrder = [];
  const daySeen = new Set();
  const seriesNames = new Set();
  const byDayThenSeries = new Map();
  for (const r of rows) {
    if (!daySeen.has(r.day)) { daySeen.add(r.day); dayOrder.push(r.day); }
    seriesNames.add(r.series);
    const inner = byDayThenSeries.get(r.day) ?? new Map();
    inner.set(r.series, Number(r.qty ?? 0));
    byDayThenSeries.set(r.day, inner);
  }
  const series = Array.from(seriesNames).sort().map((name) => ({
    name,
    data: dayOrder.map((d) => byDayThenSeries.get(d)?.get(name) ?? 0),
  }));
  return { categories: dayOrder, series };
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
