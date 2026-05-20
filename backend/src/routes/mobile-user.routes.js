'use strict';

/**
 * Mobile / IoT user-facing API — legacy-compatible aliases under
 * `/api/v1/user/*`.
 *
 * The legacy fpanalyzer Laravel app exposes these paths for mobile and
 * IoT clients. new_fp consolidates the same business logic into JWT-
 * protected admin services; this file wraps those services in the
 * legacy path + response envelope (`{ success, msg, data, errors? }`)
 * so existing mobile builds can speak to the new backend without a
 * client release.
 *
 * Auth: requires the standard JWT cookie (or Bearer header) — set by
 * POST /auth/login. Tenant is resolved from the JWT claim.
 */

const { Router } = require('express');
const { tenantMiddleware } = require('../middleware/tenant');
const flowSvc = require('../services/admin-flow-designs.service');
const partsSvc = require('../services/admin-parts.service');
const resultsSvc = require('../services/admin-results.service');
const equipmentSvc = require('../services/equipment.service');
const machinesSvc = require('../services/admin-machines.service');
const workShiftsSvc = require('../services/admin-work-shifts.service');

const router = Router();
router.use(tenantMiddleware);

/** Standard mobile envelope. Every legacy mobile endpoint returns
 *  `{ success, msg, data?, errors? }` with HTTP 200 even on logical
 *  failure — clients check `success` not the status code. */
function ok(data, msg = '') { return { success: true, msg, data }; }
function fail(msg, errors) { return { success: false, msg, ...(errors ? { errors } : {}) }; }

// ── User profile -----------------------------------------------------------

/**
 * @swagger
 * /api/v1/user/whoami:
 *   get:
 *     tags: [Mobile - User]
 *     summary: Current user profile (mobile envelope)
 *     description: Returns the JWT-authenticated user wrapped in the legacy `{success, msg, data}` envelope.
 *     security:
 *       - access_token: []
 *       - bearer: []
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/whoami', async (req, res, next) => {
  try {
    res.json(ok({
      id: req.user?.id,
      email: req.user?.email,
      name: req.user?.name,
      company_id: req.tenant?.tenantId,
      unit_only: false,
    }));
  } catch (e) { next(e); }
});

// ── Flow monitoring --------------------------------------------------------

/**
 * @swagger
 * /api/v1/user/getFlowMonitorlist:
 *   post:
 *     tags: [Mobile - User]
 *     summary: Active flow designs for the tenant
 *     description: Legacy alias for `GET /admin/flow-designs?status=1`.
 *     security:
 *       - access_token: []
 *     responses:
 *       200:
 *         description: List of active flows
 */
router.post('/getFlowMonitorlist', async (req, res, next) => {
  try {
    const result = await flowSvc.list(req.tenant, { page: 1, perPage: 200, status: 1 });
    res.json(ok(result.data));
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/user/getFlowListById:
 *   post:
 *     tags: [Mobile - User]
 *     summary: One flow design with diagram XML
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               flow_id: { type: integer }
 *     security:
 *       - access_token: []
 */
router.post('/getFlowListById', async (req, res, next) => {
  try {
    const id = Number(req.body.flow_id ?? req.body.id);
    if (!id) return res.json(fail('flow_id required'));
    const row = await flowSvc.findOne(req.tenant, id);
    res.json(ok(row));
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/user/getFlowListByEquipment:
 *   post:
 *     tags: [Mobile - User]
 *     summary: Flows whose diagram references a given equipment id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               equipment_id: { type: integer }
 *     security:
 *       - access_token: []
 */
router.post('/getFlowListByEquipment', async (req, res, next) => {
  try {
    const equipmentId = Number(req.body.equipment_id);
    if (!equipmentId) return res.json(fail('equipment_id required'));
    // Reuse the existing list endpoint then filter — admin list already
    // surfaces flowData per row.
    const result = await flowSvc.list(req.tenant, { page: 1, perPage: 200, status: 1 });
    const filtered = (result.data ?? []).filter((f) => {
      try { return f.flowData && f.flowData.includes(`equipment-id="${equipmentId}"`); }
      catch { return false; }
    });
    res.json(ok(filtered));
  } catch (e) { next(e); }
});

// ── Shifts / parts / orders / reasons (cascades) ---------------------------

/**
 * @swagger
 * /api/v1/user/getShiftData:
 *   post:
 *     tags: [Mobile - User]
 *     summary: Work shift definitions for the company
 *     security:
 *       - access_token: []
 */
router.post('/getShiftData', async (req, res, next) => {
  try {
    const result = await workShiftsSvc.list(req.tenant, { page: 1, perPage: 200 });
    res.json(ok(result.data ?? result));
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/user/getPartData:
 *   post:
 *     tags: [Mobile - User]
 *     summary: All parts in the company catalog
 *     security:
 *       - access_token: []
 */
router.post('/getPartData', async (req, res, next) => {
  try {
    const result = await partsSvc.list(req.tenant, { page: 1, perPage: 500 });
    res.json(ok(result.data ?? result));
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/user/getEquipmentPartData:
 *   post:
 *     tags: [Mobile - User]
 *     summary: Parts mapped to a specific equipment
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               equipment_id: { type: integer }
 *     security:
 *       - access_token: []
 */
router.post('/getEquipmentPartData', async (req, res, next) => {
  try {
    const equipmentId = Number(req.body.equipment_id);
    if (!equipmentId) return res.json(fail('equipment_id required'));
    const parts = await equipmentSvc.getPartsForEquipment(req.tenant, equipmentId);
    res.json(ok(parts));
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/user/getEquipmentOrderData:
 *   post:
 *     tags: [Mobile - User]
 *     summary: Active orders for an equipment
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               equipment_id: { type: integer }
 *     security:
 *       - access_token: []
 */
router.post('/getEquipmentOrderData', async (req, res, next) => {
  try {
    const equipmentId = Number(req.body.equipment_id);
    if (!equipmentId) return res.json(fail('equipment_id required'));
    const orders = await equipmentSvc.getOrdersForEquipment(req.tenant, equipmentId);
    res.json(ok(orders));
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/user/getStopReasonData:
 *   post:
 *     tags: [Mobile - User]
 *     summary: Grouped stop reasons for an equipment
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               equipment_id: { type: integer }
 *     security:
 *       - access_token: []
 */
router.post('/getStopReasonData', async (req, res, next) => {
  try {
    const equipmentId = Number(req.body.equipment_id);
    if (!equipmentId) return res.json(fail('equipment_id required'));
    const reasons = await equipmentSvc.getStopReasonsForEquipment(req.tenant, equipmentId);
    res.json(ok(reasons));
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/user/getScrapReasonData:
 *   post:
 *     tags: [Mobile - User]
 *     summary: Grouped scrap reasons for an equipment
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               equipment_id: { type: integer }
 *     security:
 *       - access_token: []
 */
router.post('/getScrapReasonData', async (req, res, next) => {
  try {
    const equipmentId = Number(req.body.equipment_id);
    if (!equipmentId) return res.json(fail('equipment_id required'));
    const reasons = await equipmentSvc.getScrapReasonsForEquipment(req.tenant, equipmentId);
    res.json(ok(reasons));
  } catch (e) { next(e); }
});

// ── Operator result entries (write paths) ---------------------------------

/**
 * @swagger
 * /api/v1/user/saveProductionData:
 *   post:
 *     tags: [Mobile - User]
 *     summary: Register a production_data row
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [flow_id, equipment_id, date]
 *             properties:
 *               flow_id: { type: integer }
 *               equipment_id: { type: integer }
 *               part_id: { type: integer }
 *               work_shift_name: { type: string }
 *               order_no: { type: string }
 *               date: { type: string, format: date }
 *               work_hours: { type: string, description: "HH:MM" }
 *               part_qty: { type: integer }
 *               planned_qty: { type: integer }
 *               comment: { type: string }
 *     security:
 *       - access_token: []
 */
router.post('/saveProductionData', async (req, res, next) => {
  try {
    const b = req.body;
    const result = await resultsSvc.createProduction(req.tenant, req.user, {
      flowId: b.flow_id ?? b.flowId,
      equipmentId: b.equipment_id ?? b.equipmentId,
      partId: b.part_id ?? b.partId,
      workShiftName: b.work_shift_name ?? b.workShiftName,
      orderNo: b.order_no ?? b.orderNo,
      date: b.date,
      workHours: b.work_hours ?? b.workHours,
      partQty: b.part_qty ?? b.partQty,
      plannedQty: b.planned_qty ?? b.plannedQty,
      comment: b.comment,
    });
    res.json(ok(result, 'Production data saved'));
  } catch (e) { res.json(fail(e.message ?? 'Save failed')); }
});

/**
 * @swagger
 * /api/v1/user/saveScrapData:
 *   post:
 *     tags: [Mobile - User]
 *     summary: Register a scrap_data row
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [flow_id, equipment_id, date, scrap_type_id, scrap_reason_id]
 *             properties:
 *               flow_id: { type: integer }
 *               equipment_id: { type: integer }
 *               part_id: { type: integer }
 *               work_shift_name: { type: string }
 *               order_no: { type: string }
 *               date: { type: string, format: date }
 *               scrap_type_id: { type: integer }
 *               scrap_reason_id: { type: integer }
 *               quantity: { type: integer }
 *               comment: { type: string }
 *               picture: { type: string }
 *     security:
 *       - access_token: []
 */
router.post('/saveScrapData', async (req, res, next) => {
  try {
    const b = req.body;
    const result = await resultsSvc.createScrap(req.tenant, req.user, {
      flowId: b.flow_id ?? b.flowId,
      equipmentId: b.equipment_id ?? b.equipmentId,
      partId: b.part_id ?? b.partId,
      workShiftName: b.work_shift_name ?? b.workShiftName,
      orderNo: b.order_no ?? b.orderNo,
      date: b.date,
      scrapTypeId: b.scrap_type_id ?? b.scrapTypeId,
      scrapReasonId: b.scrap_reason_id ?? b.scrapReasonId,
      quantity: b.quantity,
      comment: b.comment,
      picture: b.picture,
    });
    res.json(ok(result, 'Scrap data saved'));
  } catch (e) { res.json(fail(e.message ?? 'Save failed')); }
});

/**
 * @swagger
 * /api/v1/user/saveStopData:
 *   post:
 *     tags: [Mobile - User]
 *     summary: Register a stop_data row
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [flow_id, equipment_id, date, stop_type_id, stop_reason_id]
 *             properties:
 *               flow_id: { type: integer }
 *               equipment_id: { type: integer }
 *               part_id: { type: integer }
 *               work_shift_name: { type: string }
 *               order_no: { type: string }
 *               date: { type: string, format: date }
 *               stop_type_id: { type: integer }
 *               stop_reason_id: { type: integer }
 *               time_hours: { type: integer }
 *               time_minutes: { type: integer }
 *               quantity: { type: integer }
 *               comment: { type: string }
 *               picture: { type: string }
 *     security:
 *       - access_token: []
 */
router.post('/saveStopData', async (req, res, next) => {
  try {
    const b = req.body;
    const result = await resultsSvc.createStop(req.tenant, req.user, {
      flowId: b.flow_id ?? b.flowId,
      equipmentId: b.equipment_id ?? b.equipmentId,
      partId: b.part_id ?? b.partId,
      workShiftName: b.work_shift_name ?? b.workShiftName,
      orderNo: b.order_no ?? b.orderNo,
      date: b.date,
      stopTypeId: b.stop_type_id ?? b.stopTypeId,
      stopReasonId: b.stop_reason_id ?? b.stopReasonId,
      timeHours: b.time_hours ?? b.timeHours,
      timeMinutes: b.time_minutes ?? b.timeMinutes,
      quantity: b.quantity,
      comment: b.comment,
      picture: b.picture,
    });
    res.json(ok(result, 'Stop data saved'));
  } catch (e) { res.json(fail(e.message ?? 'Save failed')); }
});

// ── Last-5 stops timeline -------------------------------------------------

/**
 * @swagger
 * /api/v1/user/saveEquipmentStopDataV2:
 *   post:
 *     tags: [Mobile - User]
 *     summary: Operator-recorded stop linked to an equipment (V2 wire format)
 *     description: |
 *       Legacy V2 of the equipment stop save — accepts start/end
 *       timestamps and writes a stop_data row keyed by equipment +
 *       flow + shift. **Cross-shift split is NOT yet implemented** (a
 *       stop that crosses 14:00 will still produce a single row, not
 *       one per shift). Plan to address in a follow-up once we have
 *       shift-attribution helpers.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [flow_id, equipment_id, start_time, end_time, stop_type_id, stop_reason_id]
 *             properties:
 *               flow_id: { type: integer }
 *               equipment_id: { type: integer }
 *               part_id: { type: integer }
 *               work_shift_name: { type: string }
 *               order_no: { type: string }
 *               start_time: { type: string, format: date-time }
 *               end_time: { type: string, format: date-time }
 *               stop_type_id: { type: integer }
 *               stop_reason_id: { type: integer }
 *               comment: { type: string }
 *     security:
 *       - access_token: []
 */
router.post('/saveEquipmentStopDataV2', async (req, res) => {
  try {
    const b = req.body;
    const start = String(b.start_time ?? b.startTime ?? '').trim();
    const end = String(b.end_time ?? b.endTime ?? '').trim();
    if (!start || !end) return res.json(fail('start_time and end_time required'));
    const minutes = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000));
    const result = await resultsSvc.createStop(req.tenant, req.user, {
      flowId: b.flow_id ?? b.flowId,
      equipmentId: b.equipment_id ?? b.equipmentId,
      partId: b.part_id ?? b.partId,
      workShiftName: b.work_shift_name ?? b.workShiftName,
      orderNo: b.order_no ?? b.orderNo,
      date: start.slice(0, 10),
      stopTypeId: b.stop_type_id ?? b.stopTypeId,
      stopReasonId: b.stop_reason_id ?? b.stopReasonId,
      timeHours: Math.floor(minutes / 60),
      timeMinutes: minutes % 60,
      quantity: b.quantity,
      comment: b.comment,
    });
    res.json(ok(result, 'Equipment stop saved'));
  } catch (e) { res.json(fail(e.message ?? 'Save failed')); }
});

/**
 * @swagger
 * /api/v1/user/getLastFiveStops:
 *   post:
 *     tags: [Mobile - User]
 *     summary: Most recent 5 stop entries for an equipment
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               equipment_id: { type: integer }
 *     security:
 *       - access_token: []
 */
router.post('/getLastFiveStops', async (req, res, next) => {
  try {
    const equipmentId = Number(req.body.equipment_id);
    if (!equipmentId) return res.json(fail('equipment_id required'));
    // Reuse the listStop service with a filter on flow_object_key + pageSize 5.
    const result = await resultsSvc.listStop(req.tenant, {
      page: 1, perPage: 5,
      filters: [{ column: 'sd.flow_object_key', op: 1, value: String(equipmentId) }],
    });
    res.json(ok(result.data ?? []));
  } catch (e) { next(e); }
});

// ── FCM device token storage (Redis) ──────────────────────────────────────
//
// Mobile clients call this on app launch + after token rotation. We store
// the token in Redis under `fcm:user:<id>` (a set of tokens, since one
// user can have multiple devices). Future Phase-C work pulls these to
// fan out FCM v1 push notifications.

const { redis } = require('../redis/client');

/**
 * @swagger
 * /api/v1/user/updateFcmToken:
 *   post:
 *     tags: [Mobile - User]
 *     summary: Register/refresh a Firebase Cloud Messaging device token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fcm_token]
 *             properties:
 *               fcm_token: { type: string }
 *               platform: { type: string, enum: [android, ios, web] }
 *     security:
 *       - access_token: []
 */
router.post('/updateFcmToken', async (req, res) => {
  try {
    const token = String(req.body.fcm_token ?? req.body.fcmToken ?? '').trim();
    if (!token) return res.json(fail('fcm_token required'));
    if (!req.user?.id) return res.json(fail('Not authenticated'));
    const key = `fcm:user:${req.user.id}`;
    await redis.sadd(key, token);
    // Tokens shouldn't live forever — refresh TTL on every call so an
    // app that hasn't been opened in 90 days drops out of the fan-out.
    await redis.expire(key, 90 * 24 * 60 * 60);
    res.json(ok({ stored: true }, 'FCM token saved'));
  } catch (e) {
    console.error('[mobile-user] updateFcmToken:', e);
    res.json(fail('Failed to store FCM token'));
  }
});

// ── Shift helpers (legacy: getShiftNameByTime / getShiftTimeByName / getScheduleShiftByDate)

/**
 * @swagger
 * /api/v1/user/getShiftNameByTime:
 *   post:
 *     tags: [Mobile - User]
 *     summary: Find which work shift covers a given timestamp
 *     description: |
 *       Returns the work shift whose `start_time`–`end_time` window covers
 *       the supplied `HH:MM` time. Crosses midnight when `end_time < start_time`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [time]
 *             properties:
 *               time: { type: string, description: "HH:MM (24h)" }
 *     security:
 *       - access_token: []
 */
router.post('/getShiftNameByTime', async (req, res) => {
  try {
    const t = String(req.body.time ?? '').trim();
    if (!/^\d{1,2}:\d{2}$/.test(t)) return res.json(fail('time must be HH:MM'));
    const result = await workShiftsSvc.list(req.tenant, { page: 1, perPage: 200 });
    const shifts = result.data ?? result;
    const [hh, mm] = t.split(':').map(Number);
    const target = hh * 60 + mm;
    const toMin = (s) => {
      const [h, m] = String(s ?? '00:00').split(':').map(Number);
      return h * 60 + m;
    };
    const match = (shifts ?? []).find((s) => {
      const start = toMin(s.startTime);
      const end = toMin(s.endTime);
      if (end >= start) return target >= start && target < end;
      // Crosses midnight (e.g. 22:00 → 06:00).
      return target >= start || target < end;
    });
    res.json(ok(match ?? null));
  } catch (e) { res.json(fail(e.message ?? 'lookup failed')); }
});

/**
 * @swagger
 * /api/v1/user/getShiftTimeByName:
 *   post:
 *     tags: [Mobile - User]
 *     summary: Inverse of getShiftNameByTime — return start/end for a named shift
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     security:
 *       - access_token: []
 */
router.post('/getShiftTimeByName', async (req, res) => {
  try {
    const name = String(req.body.name ?? '').trim();
    if (!name) return res.json(fail('name required'));
    const result = await workShiftsSvc.list(req.tenant, { page: 1, perPage: 200 });
    const shifts = result.data ?? result;
    const match = (shifts ?? []).find((s) => s.name === name);
    res.json(ok(match ?? null));
  } catch (e) { res.json(fail(e.message ?? 'lookup failed')); }
});

/**
 * @swagger
 * /api/v1/user/getScheduleShiftByDate:
 *   post:
 *     tags: [Mobile - User]
 *     summary: Return scheduled shifts for a given calendar date
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date]
 *             properties:
 *               date: { type: string, format: date }
 *     security:
 *       - access_token: []
 */
router.post('/getScheduleShiftByDate', async (req, res) => {
  try {
    const date = String(req.body.date ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.json(fail('date must be YYYY-MM-DD'));
    // Map ISO weekday (1=Mon..7=Sun) to legacy working_days CSV ("1,2,3,...").
    const dow = new Date(date + 'T00:00:00').getDay() || 7;
    const result = await workShiftsSvc.list(req.tenant, { page: 1, perPage: 200 });
    const shifts = result.data ?? result;
    const today = (shifts ?? []).filter((s) => {
      const csv = String(s.workingDays ?? '');
      return csv.split(',').map((x) => x.trim()).includes(String(dow));
    });
    res.json(ok(today));
  } catch (e) { res.json(fail(e.message ?? 'lookup failed')); }
});

module.exports = router;
