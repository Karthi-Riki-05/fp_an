'use strict';
const { Router } = require('express');
const { tenantMiddleware } = require('../middleware/tenant');
const svc = require('../services/admin-iot.service');
const mqttAuth = require('../services/mqtt-auth.service');
const firmwareSvc = require('../services/firmware.service');
const mqttSvc = require('../services/mqtt.service');
const router = Router();
router.use(tenantMiddleware);

/**
 * @swagger
 * /api/v1/admin/iot/units:
 *   get:
 *     tags: ["Admin — Iot"]
 *     summary: GET /units
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/units', async (req, res, next) => {
  try { res.json(await svc.getUnits(req.tenant)); } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/iot/units/{id}/settings:
 *   patch:
 *     tags: ["Admin — Iot"]
 *     summary: PATCH /units/:id/settings
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/units/:id/settings', async (req, res, next) => {
  try { await svc.updateSettings(req.tenant, Number(req.params.id), req.body); res.status(204).send(); } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/iot/units/{id}/equipment:
 *   post:
 *     tags: ["Admin — Iot"]
 *     summary: POST /units/:id/equipment
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.post('/units/:id/equipment', async (req, res, next) => {
  try { await svc.assignEquipment(req.tenant, Number(req.params.id), Number(req.body.equipmentId)); res.status(204).send(); } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/iot/units/{id}/equipment:
 *   delete:
 *     tags: ["Admin — Iot"]
 *     summary: DELETE /units/:id/equipment
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/units/:id/equipment', async (req, res, next) => {
  try { await svc.removeEquipment(req.tenant, Number(req.params.id)); res.status(204).send(); } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/iot/units/{id}/counter-settings:
 *   patch:
 *     tags: ["Admin — Iot"]
 *     summary: PATCH /units/:id/counter-settings
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/units/:id/counter-settings', async (req, res, next) => {
  try { await svc.updateCounterSettings(req.tenant, Number(req.params.id), req.body); res.status(204).send(); } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/iot/units/{id}/counter-children:
 *   get:
 *     tags: ["Admin — Iot"]
 *     summary: GET /units/:id/counter-children
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/units/:id/counter-children', async (req, res, next) => {
  try { res.json(await svc.getCounterChildren(req.tenant, Number(req.params.id))); } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/iot/units/{id}/test-notification:
 *   post:
 *     tags: ["Admin — Iot"]
 *     summary: POST /units/:id/test-notification
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.post('/units/:id/test-notification', async (req, res, next) => {
  // Stub — real push notification wired in Phase 5 IoT module
  res.json({ success: true, message: 'Test notification queued (stub)' });
});

/**
 * @swagger
 * /api/v1/admin/iot/units/{id}/provision-mqtt:
 *   post:
 *     tags: ["Admin — Iot"]
 *     summary: Generate unique MQTT credentials for a machine
 *     description: >
 *       Creates a new MQTT username + random password for the machine, stores the bcrypt hash,
 *       and returns the plain-text password **once**. Deploy these credentials to the Pi firmware
 *       as its MQTT CONNECT credentials. The broker ACL must grant this client
 *       read/write access to fp/v1/{tenantId}/machine/{machineId}/#.
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Credentials generated. Store password securely — shown once only.
 *       404:
 *         description: Machine not found
 */
router.post('/units/:id/provision-mqtt', async (req, res, next) => {
  try {
    res.json(await svc.provisionMqtt(req.tenant, Number(req.params.id)));
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/iot/mqtt-units:
 *   get:
 *     tags: ["Admin — Iot"]
 *     summary: List provisioned MQTT units (one per Raspberry Pi) for this company
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/mqtt-units', async (req, res, next) => {
  try {
    const units = await mqttAuth.listUnits(req.tenant.tenantId);
    res.json({ data: units, total: units.length });
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/iot/mqtt-units/provision:
 *   post:
 *     tags: ["Admin — Iot"]
 *     summary: Issue MQTT broker credentials for one physical unit
 *     description: |
 *       Credentials are per Raspberry Pi, not per machine — one unit carries up
 *       to 4 machines on pins 1-4 over a single connection. Writes straight to
 *       public.mqtt_devices, which the broker reads live; no broker restart or
 *       file edit is needed. The password is returned once and is not recoverable.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [unitName]
 *             properties:
 *               unitName: { type: string, example: "UNIT-01" }
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: Credentials issued — store the password now }
 */
router.post('/mqtt-units/provision', async (req, res, next) => {
  try {
    const creds = await mqttAuth.provisionUnit(req.tenant.tenantId, req.body?.unitName, {
      firmware: req.body?.firmware ?? null,
    });
    res.json({ success: true, data: creds });
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/iot/mqtt-units/revoke:
 *   post:
 *     tags: ["Admin — Iot"]
 *     summary: Revoke one unit's broker access immediately
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [unitName]
 *             properties:
 *               unitName: { type: string, example: "UNIT-01" }
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.post('/mqtt-units/revoke', async (req, res, next) => {
  try {
    const result = await mqttAuth.revokeUnit(req.tenant.tenantId, req.body?.unitName);
    res.json({ success: result.revoked, data: result });
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/iot/firmware:
 *   get:
 *     tags: ["Admin — Iot"]
 *     summary: Current IoT firmware release
 *     security: [{ access_token: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/firmware', async (req, res, next) => {
  try {
    const release = await firmwareSvc.getRelease();
    res.json({ data: release, otaReady: Boolean(release?.sha256) });
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/iot/firmware:
 *   put:
 *     tags: ["Admin — Iot"]
 *     summary: Publish a firmware release
 *     description: |
 *       sha256 is mandatory. The device install path extracts and runs as root,
 *       so a package that cannot be integrity-checked is refused rather than
 *       shipped. url must be https.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [version, url, sha256]
 *             properties:
 *               version:   { type: string, example: "2.1.8" }
 *               url:       { type: string, example: "https://api.fptest.com/downloads/fp_2.1.8.zip" }
 *               sha256:    { type: string, example: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" }
 *               size:      { type: integer, example: 10485760 }
 *               notes:     { type: string }
 *               mandatory: { type: boolean }
 *     security: [{ access_token: [] }]
 *     responses:
 *       200: { description: Release published }
 *       400: { description: Missing or invalid sha256 / url / version }
 */
router.put('/firmware', async (req, res, next) => {
  try {
    const release = await firmwareSvc.setRelease(req.body ?? {}, req.user);
    res.json({ success: true, data: release });
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/iot/mqtt-units/ota:
 *   post:
 *     tags: ["Admin — Iot"]
 *     summary: Push the current firmware release to one unit, or the whole fleet
 *     description: |
 *       Omit unitName to target every provisioned unit in this company. The
 *       command carries a URL and sha256; the ZIP itself travels over HTTPS.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               unitName: { type: string, description: "Omit to target all units" }
 *               force:    { type: boolean }
 *     security: [{ access_token: [] }]
 *     responses:
 *       200: { description: Command(s) published }
 *       409: { description: No release configured, or release has no sha256 }
 *       503: { description: Broker not connected }
 */
router.post('/mqtt-units/ota', async (req, res, next) => {
  try {
    const companyId = req.tenant.tenantId;
    const { unitName, force } = req.body ?? {};

    if (unitName) {
      const result = await mqttSvc.sendOtaCommand(companyId, unitName, { force: force === true });
      return res.json({ success: true, data: result });
    }

    // Fleet rollout — a failure on one unit must not abort the rest.
    const units = await mqttAuth.listUnits(companyId);
    const targets = units.filter((u) => !u.disabled);
    const sent = [];
    const failed = [];
    for (const u of targets) {
      try {
        sent.push(await mqttSvc.sendOtaCommand(companyId, u.unitName, { force: force === true }));
      } catch (err) {
        failed.push({ unitName: u.unitName, error: err.message });
      }
    }
    res.json({ success: failed.length === 0, data: { sent: sent.length, failed, total: targets.length } });
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/iot/mqtt-units/config:
 *   post:
 *     tags: ["Admin — Iot"]
 *     summary: Push pin enable flags and debounce windows to a unit (retained)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [unitName]
 *             properties:
 *               unitName:  { type: string, example: "UNIT-01" }
 *               off_on_ms: { type: integer, example: 100 }
 *               on_off_ms: { type: integer, example: 100 }
 *               pins:      { type: object, example: { "1": true, "2": true, "3": false, "4": true } }
 *     security: [{ access_token: [] }]
 *     responses:
 *       200: { description: Config published }
 *       503: { description: Broker not connected }
 */
router.post('/mqtt-units/config', async (req, res, next) => {
  try {
    const { unitName, ...config } = req.body ?? {};
    if (!unitName) return res.status(400).json({ statusCode: 400, message: 'unitName required' });
    res.json({ success: true, data: mqttSvc.sendConfigCommand(req.tenant.tenantId, unitName, config) });
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/iot/mqtt-units/reboot:
 *   post:
 *     tags: ["Admin — Iot"]
 *     summary: Reboot a unit
 *     security: [{ access_token: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post('/mqtt-units/reboot', async (req, res, next) => {
  try {
    const { unitName, delaySeconds } = req.body ?? {};
    if (!unitName) return res.status(400).json({ statusCode: 400, message: 'unitName required' });
    res.json({ success: true, data: mqttSvc.sendRebootCommand(req.tenant.tenantId, unitName, delaySeconds) });
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/iot/mqtt-units/ota-status:
 *   get:
 *     tags: ["Admin — Iot"]
 *     summary: OTA rollout status for every unit in this company
 *     security: [{ access_token: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/mqtt-units/ota-status', async (req, res, next) => {
  try {
    const rows = await mqttAuth.otaStatus(req.tenant.tenantId);
    res.json({ data: rows, total: rows.length });
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/iot/flow-designs:
 *   get:
 *     tags: ["Admin — Iot"]
 *     summary: GET /flow-designs
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/flow-designs', async (req, res, next) => {
  try {
    const equipmentId = req.query.equipmentId ? Number(req.query.equipmentId) : undefined;
    res.json(await svc.getFlowDesigns(req.tenant, equipmentId));
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/iot/stop-reasons:
 *   get:
 *     tags: ["Admin — Iot"]
 *     summary: GET /stop-reasons
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/stop-reasons', async (req, res, next) => {
  try {
    const equipmentId = req.query.equipmentId ? Number(req.query.equipmentId) : undefined;
    res.json(await svc.getStopReasons(req.tenant, equipmentId));
  } catch (e) { next(e); }
});

module.exports = router;
