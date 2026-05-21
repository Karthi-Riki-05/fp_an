'use strict';

/**
 * Mobile / IoT machine-facing API — legacy-compatible aliases under
 * `/api/v1/machine/*`.
 *
 * The legacy fpanalyzer Laravel app exposes these paths for IoT firmware
 * and the mobile companion app. new_fp keeps the same paths so existing
 * binaries can speak to the new backend.
 *
 * Auth: requires JWT (cookie or Bearer). IoT firmware should call
 * POST /auth/login first to obtain the cookie, then send it on every
 * subsequent request.
 */

const { Router } = require('express');
const { tenantMiddleware } = require('../middleware/tenant');
const machinesSvc = require('../services/admin-machines.service');

const router = Router();
router.use(tenantMiddleware);

function ok(data, msg = '') { return { success: true, msg, data }; }
function fail(msg, errors) { return { success: false, msg, ...(errors ? { errors } : {}) }; }

/**
 * @swagger
 * /api/v1/machine/test:
 *   get:
 *     tags: [Mobile - Machine]
 *     summary: Health / connectivity probe used by IoT firmware
 *     security:
 *       - access_token: []
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/test', (_req, res) => res.json(ok({ pong: true, ts: new Date().toISOString() })));

/**
 * @swagger
 * /api/v1/machine/getMachineList:
 *   post:
 *     tags: [Mobile - Machine]
 *     summary: All machines for the tenant joined to their equipment metadata
 *     security:
 *       - access_token: []
 *     responses:
 *       200:
 *         description: Machine list wrapped in mobile envelope
 */
router.post('/getMachineList', async (req, res, next) => {
  try {
    const result = await machinesSvc.list(req.tenant, { page: 1, perPage: 500 });
    res.json(ok(result.data ?? result));
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/machine/getConfiguredUnitsCount:
 *   post:
 *     tags: [Mobile - Machine]
 *     summary: Count of machines with equipment_id != 0
 *     security:
 *       - access_token: []
 */
router.post('/getConfiguredUnitsCount', async (req, res, next) => {
  try {
    const result = await machinesSvc.list(req.tenant, { page: 1, perPage: 500 });
    const rows = result.data ?? result;
    const configured = rows.filter((m) => Number(m.equipmentId ?? m.equipment_id ?? 0) > 0).length;
    res.json(ok({ configured, total: rows.length, unconfigured: rows.length - configured }));
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/machine/getConfiguredUnits:
 *   post:
 *     tags: [Mobile - Machine]
 *     summary: Configured machines (equipment_id != 0)
 *     security:
 *       - access_token: []
 */
router.post('/getConfiguredUnits', async (req, res, next) => {
  try {
    const result = await machinesSvc.list(req.tenant, { page: 1, perPage: 500 });
    const rows = (result.data ?? result).filter((m) => Number(m.equipmentId ?? m.equipment_id ?? 0) > 0);
    res.json(ok(rows));
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/machine/getMachineStatus:
 *   post:
 *     tags: [Mobile - Machine]
 *     summary: Current running_status / unit_connected per machine
 *     description: Mobile clients poll this for live-tile updates. Accepts an optional `machine_ids[]` array; without it returns every machine in the tenant.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               machine_ids:
 *                 type: array
 *                 items: { type: integer }
 *     security:
 *       - access_token: []
 */
router.post('/getMachineStatus', async (req, res, next) => {
  try {
    const result = await machinesSvc.list(req.tenant, { page: 1, perPage: 500 });
    let rows = result.data ?? result;
    const ids = req.body.machine_ids;
    if (Array.isArray(ids) && ids.length > 0) {
      const idSet = new Set(ids.map(Number).filter(Number.isFinite));
      rows = rows.filter((m) => idSet.has(Number(m.id)));
    }
    // Slim the response to the legacy shape — only the live fields.
    const status = rows.map((m) => ({
      id: m.id,
      running_status: m.runningStatus,
      unit_connected: m.unitConnected,
      last_online: m.lastOnline,
      signal_type: m.signalType,
    }));
    res.json(ok(status));
  } catch (e) { next(e); }
});

// installV1 + saveStopDataV1 are served by the public IoT shim
// (mobile-machine-iot.routes.js) mounted in app.js BEFORE the global
// JWT middleware — they accept either JWT or `company_email_id` body
// auth so field firmware can call them without a cookie.
//
// updateUnitConnectionStatus is also served by the public IoT shim so
// legacy firmware can call it with company_email_id + unit_name without
// a JWT. See mobile-machine-iot.routes.js.

// ── Phase C: IoT stop ingestion + helpers ─────────────────────────────────

const iotSvc = require('../services/iot-machine-data.service');
const { redis } = require('../redis/client');

// (saveStopDataV1 served by the public IoT shim — see top of this file)

/**
 * @swagger
 * /api/v1/machine/saveOfflineData:
 *   post:
 *     tags: [Mobile - Machine]
 *     summary: Bulk-replay buffered stop events
 *     description: |
 *       Used when an IoT unit comes back online after a network outage.
 *       Accepts an array of stop events and persists them in
 *       chronological order via `saveStopDataV1`. Stops on first error
 *       so the firmware can retry from the last persisted offset.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [events]
 *             properties:
 *               events:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     machine_id: { type: integer }
 *                     start_time: { type: string, format: date-time }
 *                     end_time: { type: string, format: date-time }
 *     security:
 *       - access_token: []
 */
router.post('/saveOfflineData', async (req, res) => {
  try {
    const events = Array.isArray(req.body.events) ? req.body.events : [];
    if (events.length === 0) return res.json(fail('events array required'));
    // Sort chronologically before persisting so auto-register cascades
    // pick up earlier stops first.
    const sorted = [...events].sort((a, b) =>
      String(a.start_time ?? '').localeCompare(String(b.start_time ?? '')),
    );
    const results = [];
    for (const ev of sorted) {
      try {
        results.push(await iotSvc.saveStopEvent(req.tenant, req.user, ev));
      } catch (e) {
        // Stop on first failure — firmware retries from this index.
        return res.json(fail(`Failed at event #${results.length}: ${e.message}`, { committed: results.length, total: events.length }));
      }
    }
    res.json(ok({ committed: results.length, total: events.length, results }, 'Offline buffer flushed'));
  } catch (e) {
    res.json(fail(e.message ?? 'saveOfflineData failed'));
  }
});

/**
 * @swagger
 * /api/v1/machine/getMachineData:
 *   post:
 *     tags: [Mobile - Machine]
 *     summary: Raw machine_data rows for a machine within a date range
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [machine_id]
 *             properties:
 *               machine_id: { type: integer }
 *               from: { type: string, format: date-time }
 *               to: { type: string, format: date-time }
 *               limit: { type: integer, default: 100 }
 *     security:
 *       - access_token: []
 */
router.post('/getMachineData', async (req, res) => {
  try {
    const machineId = Number(req.body.machine_id);
    if (!machineId) return res.json(fail('machine_id required'));
    const rows = await iotSvc.listMachineData(req.tenant, machineId, {
      from: req.body.from, to: req.body.to, limit: req.body.limit,
    });
    res.json(ok(rows));
  } catch (e) { res.json(fail(e.message ?? 'lookup failed')); }
});

/**
 * @swagger
 * /api/v1/machine/getProductionTime:
 *   post:
 *     tags: [Mobile - Machine]
 *     summary: Running vs. stop minutes for an equipment over a window
 *     description: |
 *       `runningMinutes = windowMinutes − stopMinutes`. Drives the
 *       "Production time" card on the mobile dashboard.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [equipment_id, from, to]
 *             properties:
 *               equipment_id: { type: integer }
 *               from: { type: string, format: date-time }
 *               to: { type: string, format: date-time }
 *     security:
 *       - access_token: []
 */
router.post('/getProductionTime', async (req, res) => {
  try {
    const equipmentId = Number(req.body.equipment_id);
    const from = String(req.body.from ?? '').trim();
    const to = String(req.body.to ?? '').trim();
    if (!equipmentId || !from || !to) return res.json(fail('equipment_id, from, to required'));
    const result = await iotSvc.getProductionTime(req.tenant, equipmentId, from, to);
    res.json(ok(result));
  } catch (e) { res.json(fail(e.message ?? 'lookup failed')); }
});

/**
 * @swagger
 * /api/v1/machine/getShiftSchedulesByDates:
 *   post:
 *     tags: [Mobile - Machine]
 *     summary: Shift schedule rows that overlap a date window
 *     description: |
 *       Returns the events the operator entered on the Shift Schedule
 *       calendar that touch `[from, to]`. Used by IoT firmware when
 *       attributing an offline-replayed stop to the right shift.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [from, to]
 *             properties:
 *               from: { type: string, format: date-time }
 *               to: { type: string, format: date-time }
 *     security:
 *       - access_token: []
 */
router.post('/getShiftSchedulesByDates', async (req, res) => {
  try {
    const from = String(req.body.from ?? '').trim();
    const to = String(req.body.to ?? '').trim();
    if (!from || !to) return res.json(fail('from and to required'));
    const rows = await iotSvc.getShiftSchedulesByDates(req.tenant, from, to);
    res.json(ok(rows));
  } catch (e) { res.json(fail(e.message ?? 'lookup failed')); }
});

// ── Firmware versioning ───────────────────────────────────────────────────
//
// Legacy reads `public/iot_version/version.web` + `version_info.web`.
// We read from env vars (or a Redis-stashed override) so admins can bump
// without a redeploy. Response shape mirrors the Laravel original so old
// firmware parses it correctly.

// Proper per-component semver comparison — avoids the "strip dots → int"
// bug where 1.2.10 < 1.2.9 because 1210 < 129 as integers.
function semverGt(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/**
 * @swagger
 * /api/v1/machine/checkIotLatestVersion:
 *   post:
 *     tags: [Mobile - Machine]
 *     summary: Check whether a newer firmware is available
 *     description: |
 *       Compares the unit's `version` against `IOT_LATEST_VERSION`
 *       (env var, optionally overridden via Redis key `iot:latest`).
 *
 *       Response mirrors Laravel MachineController@checkIotLatestVersion:
 *         - upgrade available → `{ success: true, data: { version, info, url } }`
 *         - up to date        → `{ success: false, msg: "Request version is upto date." }`
 *
 *       Set `IOT_FIRMWARE_INFO` to a human-readable change-log string.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [version]
 *             properties:
 *               version: { type: string, example: "1.2.7" }
 *     security:
 *       - access_token: []
 */
router.post('/checkIotLatestVersion', async (req, res) => {
  try {
    const current = String(req.body.version ?? '').trim();
    if (!current) return res.json(fail('Required fields not satisfied'));

    const override = await redis.get('iot:latest');
    const latest   = override || process.env.IOT_LATEST_VERSION || '1.0.0';
    const info     = process.env.IOT_FIRMWARE_INFO || '';
    const url      = process.env.IOT_FIRMWARE_URL  || '/iot_version/software/latest.bin';

    if (!semverGt(latest, current)) {
      return res.json({ success: false, msg: 'Request version is upto date.' });
    }

    return res.json(ok({ version: latest, info, url }));
  } catch (e) { res.json(fail(e.message ?? 'version check failed')); }
});

// ── Per-user machine settings (Redis-backed) ──────────────────────────────
//
// Legacy stores these as a JSON blob on the master `users.table_settings`
// column. We use Redis (`user:<id>:machine-settings:<machineId>`) so we
// don't have to migrate the schema for what's essentially UI preferences.

function userSettingsKey(userId, machineId) {
  return `user:${userId}:machine-settings:${machineId}`;
}

/**
 * @swagger
 * /api/v1/machine/saveUserUnitSettings:
 *   post:
 *     tags: [Mobile - Machine]
 *     summary: Per-user per-machine UI preferences (pinned, order, etc.)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [machine_id]
 *             properties:
 *               machine_id: { type: integer }
 *               pinned: { type: boolean }
 *               sort_order: { type: integer }
 *               hide: { type: boolean }
 *     security:
 *       - access_token: []
 */
router.post('/saveUserUnitSettings', async (req, res) => {
  try {
    const machineId = Number(req.body.machine_id);
    if (!machineId || !req.user?.id) return res.json(fail('machine_id required + must be authenticated'));
    const settings = {
      pinned: !!req.body.pinned,
      sortOrder: Number(req.body.sort_order ?? 0),
      hide: !!req.body.hide,
      updatedAt: new Date().toISOString(),
    };
    await redis.set(userSettingsKey(req.user.id, machineId), JSON.stringify(settings));
    res.json(ok(settings, 'Settings saved'));
  } catch (e) { res.json(fail(e.message ?? 'save failed')); }
});

/**
 * @swagger
 * /api/v1/machine/saveUserNotificationSettings:
 *   post:
 *     tags: [Mobile - Machine]
 *     summary: Per-user push-notification opt-in per machine
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [machine_id]
 *             properties:
 *               machine_id: { type: integer }
 *               notifications_enabled: { type: boolean }
 *     security:
 *       - access_token: []
 */
router.post('/saveUserNotificationSettings', async (req, res) => {
  try {
    const machineId = Number(req.body.machine_id);
    if (!machineId || !req.user?.id) return res.json(fail('machine_id required'));
    const k = userSettingsKey(req.user.id, machineId);
    const existing = JSON.parse((await redis.get(k)) ?? '{}');
    existing.notificationsEnabled = req.body.notifications_enabled !== false;
    existing.updatedAt = new Date().toISOString();
    await redis.set(k, JSON.stringify(existing));
    res.json(ok(existing, 'Notification settings saved'));
  } catch (e) { res.json(fail(e.message ?? 'save failed')); }
});

/**
 * @swagger
 * /api/v1/machine/getMachineUserSettings:
 *   post:
 *     tags: [Mobile - Machine]
 *     summary: Read per-user preferences for one machine
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [machine_id]
 *             properties:
 *               machine_id: { type: integer }
 *     security:
 *       - access_token: []
 */
router.post('/getMachineUserSettings', async (req, res) => {
  try {
    const machineId = Number(req.body.machine_id);
    if (!machineId || !req.user?.id) return res.json(fail('machine_id required'));
    const raw = await redis.get(userSettingsKey(req.user.id, machineId));
    res.json(ok(raw ? JSON.parse(raw) : null));
  } catch (e) { res.json(fail(e.message ?? 'lookup failed')); }
});

/**
 * @swagger
 * /api/v1/machine/updateMachineUserSettings:
 *   post:
 *     tags: [Mobile - Machine]
 *     summary: Partial update of per-user machine preferences
 *     description: |
 *       Merges into whatever's already stored for the (user, machine)
 *       pair. Same backing store as saveUserUnitSettings + the
 *       saveUserNotificationSettings flow.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [machine_id]
 *             properties:
 *               machine_id: { type: integer }
 *               pinned: { type: boolean }
 *               sort_order: { type: integer }
 *               hide: { type: boolean }
 *               notifications_enabled: { type: boolean }
 *     security:
 *       - access_token: []
 */
router.post('/updateMachineUserSettings', async (req, res) => {
  try {
    const machineId = Number(req.body.machine_id);
    if (!machineId || !req.user?.id) return res.json(fail('machine_id required'));
    const k = userSettingsKey(req.user.id, machineId);
    const existing = JSON.parse((await redis.get(k)) ?? '{}');
    const merged = { ...existing };
    if (req.body.pinned !== undefined)                merged.pinned = !!req.body.pinned;
    if (req.body.sort_order !== undefined)            merged.sortOrder = Number(req.body.sort_order);
    if (req.body.hide !== undefined)                  merged.hide = !!req.body.hide;
    if (req.body.notifications_enabled !== undefined) merged.notificationsEnabled = !!req.body.notifications_enabled;
    merged.updatedAt = new Date().toISOString();
    await redis.set(k, JSON.stringify(merged));
    res.json(ok(merged, 'Settings updated'));
  } catch (e) { res.json(fail(e.message ?? 'update failed')); }
});

module.exports = router;
