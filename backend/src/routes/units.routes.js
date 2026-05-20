'use strict';

const { Router } = require('express');
const multer = require('multer');
const { tenantMiddleware } = require('../middleware/tenant');
const svc = require('../services/units.service');
const { put: storagePut } = require('../services/file-storage.service');

const router = Router();
router.use(tenantMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// GET /units — operator card view (unit + equipment + unregistered count)
/**
 * @swagger
 * /api/v1/units:
 *   get:
 *     tags: ["Units"]
 *     summary: GET /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/', async (req, res, next) => {
  try {
    res.json(await svc.listUnits(req.tenant));
  } catch (e) { next(e); }
});

// GET /units/status — live snapshot for the 5s frontend poll
/**
 * @swagger
 * /api/v1/units/status:
 *   get:
 *     tags: ["Units"]
 *     summary: GET /status?machineIds=1,2,3
 *     security: [{ access_token: [] }]
 *     parameters:
 *       - { in: query, name: machineIds, required: true, schema: { type: string } }
 *     responses: { 200: { description: OK } }
 */
router.get('/status', async (req, res, next) => {
  try {
    const raw = req.query.machineIds;
    const ids = typeof raw === 'string'
      ? raw.split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0)
      : Array.isArray(raw)
        ? raw.map(Number).filter((n) => Number.isInteger(n) && n > 0)
        : [];
    res.json(await svc.listStatus(req.tenant, ids));
  } catch (e) { next(e); }
});

// GET /units/stop-dialog/last-used — 24h form prefill (Redis-backed)
/**
 * @swagger
 * /api/v1/units/stop-dialog/last-used:
 *   get:
 *     tags: ["Units"]
 *     summary: GET /stop-dialog/last-used?equipmentId=
 *     security: [{ access_token: [] }]
 *     parameters:
 *       - { in: query, name: equipmentId, required: true, schema: { type: integer } }
 *     responses: { 200: { description: OK } }
 */
router.get('/stop-dialog/last-used', async (req, res, next) => {
  try {
    const equipmentId = Number(req.query.equipmentId);
    if (!Number.isInteger(equipmentId) || equipmentId <= 0) {
      return res.status(400).json({ statusCode: 400, message: 'equipmentId-required' });
    }
    res.json((await svc.getStopFormPrefill(req.tenant, equipmentId)) ?? {});
  } catch (e) { next(e); }
});

// GET/POST /units/settings — per-user hidden + sort-order preferences
/**
 * @swagger
 * /api/v1/units/settings:
 *   get:
 *     tags: ["Units"]
 *     summary: GET /settings
 *     security: [{ access_token: [] }]
 *     responses: { 200: { description: OK } }
 *   post:
 *     tags: ["Units"]
 *     summary: POST /settings
 *     security: [{ access_token: [] }]
 *     responses: { 200: { description: OK } }
 */
router.get('/settings', async (req, res, next) => {
  try { res.json(await svc.getUnitWebSettings(req.user.id)); } catch (e) { next(e); }
});
router.post('/settings', async (req, res, next) => {
  try { res.json(await svc.saveUnitWebSettings(req.user.id, req.body || {})); } catch (e) { next(e); }
});

// GET /units/:machineId/unregistered — buckets the operator can pick
/**
 * @swagger
 * /api/v1/units/{machineId}/unregistered:
 *   get:
 *     tags: ["Units"]
 *     summary: GET /:machineId/unregistered
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: machineId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:machineId/unregistered', async (req, res, next) => {
  try {
    res.json(await svc.listUnregistered(req.tenant, Number(req.params.machineId), {
      page: req.query.page, perPage: req.query.perPage,
    }));
  } catch (e) { next(e); }
});

// POST /units/:machineId/stop-data — batch insert N stop rows
/**
 * @swagger
 * /api/v1/units/{machineId}/stop-data:
 *   post:
 *     tags: ["Units"]
 *     summary: POST /:machineId/stop-data
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: machineId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.post('/:machineId/stop-data', async (req, res, next) => {
  try {
    res.status(201).json(
      await svc.batchRegisterStops(req.tenant, req.user, Number(req.params.machineId), req.body),
    );
  } catch (e) { next(e); }
});

// POST /units/:machineId/stop-data/upload — single attachment; returns filename
/**
 * @swagger
 * /api/v1/units/{machineId}/stop-data/upload:
 *   post:
 *     tags: ["Units"]
 *     summary: POST /:machineId/stop-data/upload
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: machineId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.post('/:machineId/stop-data/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ statusCode: 400, message: 'file-required' });
    }
    const result = await storagePut(
      `tenant-${req.tenant.tenantId}/stop-data`,
      req.file.originalname,
      req.file.buffer,
      req.file.mimetype,
    );
    // The legacy `stop_data.picture` column stores a URL/path-like string.
    // Return both the URL (for previewing) and the storage key (for backups).
    res.status(201).json({ filename: result.url, key: result.key });
  } catch (e) { next(e); }
});

module.exports = router;
