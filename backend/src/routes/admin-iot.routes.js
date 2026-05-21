'use strict';
const { Router } = require('express');
const { tenantMiddleware } = require('../middleware/tenant');
const svc = require('../services/admin-iot.service');
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
