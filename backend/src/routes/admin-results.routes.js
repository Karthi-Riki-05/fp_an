'use strict';

const { Router } = require('express');
const multer = require('multer');
const { tenantMiddleware } = require('../middleware/tenant');
const resultSvc = require('../services/admin-results.service');
const warningSvc = require('../services/admin-warning-data.service');

const router = Router();
router.use(tenantMiddleware);

// Memory storage — uploaded buffers are handed to FileStorageService which
// writes them to disk (or eventually S3). Keep the cap aligned with the
// other image-upload routes (5MB on icons, 8MB on flow background).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

/**
 * Parse the filters[] query param array.
 * Accepts: ?filters[0][column]=flow_designs.name&filters[0][op]=3&filters[0][value]=line
 */
function parseFilters(query) {
  const raw = query.filters;
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .map((f) => ({ column: f.column, op: Number(f.op), value: f.value ?? '' }))
    .filter((f) => f.column && f.op);
}

function parseQ(query) {
  return {
    page: query.page ? Number(query.page) : 1,
    perPage: query.perPage ? Number(query.perPage) : 10,
    from: query.from || '',
    to: query.to || '',
    filters: parseFilters(query),
  };
}

// ── Production ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/admin/results/production:
 *   get:
 *     tags: ["Admin — Results"]
 *     summary: GET /production
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/production', async (req, res, next) => {
  try {
    res.json(await resultSvc.listProduction(req.tenant, parseQ(req.query)));
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/results/production/{id}:
 *   patch:
 *     tags: ["Admin — Results"]
 *     summary: PATCH /production/:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/production/:id', async (req, res, next) => {
  try {
    res.json(await resultSvc.updateProduction(req.tenant, Number(req.params.id), req.body));
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/results/production:
 *   post:
 *     tags: ["Admin — Results"]
 *     summary: POST /production
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.post('/production', async (req, res, next) => {
  try {
    res.status(201).json(await resultSvc.createProduction(req.tenant, req.user, req.body));
  } catch (e) { next(e); }
});

// ── Scrap ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/admin/results/scrap:
 *   get:
 *     tags: ["Admin — Results"]
 *     summary: GET /scrap
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/scrap', async (req, res, next) => {
  try {
    res.json(await resultSvc.listScrap(req.tenant, parseQ(req.query)));
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/results/scrap/{id}:
 *   patch:
 *     tags: ["Admin — Results"]
 *     summary: PATCH /scrap/:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/scrap/:id', async (req, res, next) => {
  try {
    res.json(await resultSvc.updateScrap(req.tenant, Number(req.params.id), req.body));
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/results/scrap:
 *   post:
 *     tags: ["Admin — Results"]
 *     summary: POST /scrap
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.post('/scrap', async (req, res, next) => {
  try {
    res.status(201).json(await resultSvc.createScrap(req.tenant, req.user, req.body));
  } catch (e) { next(e); }
});

// ── Stop ─────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/admin/results/stop:
 *   get:
 *     tags: ["Admin — Results"]
 *     summary: GET /stop
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/stop', async (req, res, next) => {
  try {
    const q = {
      ...parseQ(req.query),
      includeExcluded: req.query.include_excluded === '1',
    };
    res.json(await resultSvc.listStop(req.tenant, q));
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/results/stop/{id}:
 *   patch:
 *     tags: ["Admin — Results"]
 *     summary: PATCH /stop/:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/stop/:id', async (req, res, next) => {
  try {
    res.json(await resultSvc.updateStop(req.tenant, Number(req.params.id), req.body));
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/results/stop:
 *   post:
 *     tags: ["Admin — Results"]
 *     summary: POST /stop
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.post('/stop', async (req, res, next) => {
  try {
    res.status(201).json(await resultSvc.createStop(req.tenant, req.user, req.body));
  } catch (e) { next(e); }
});

// ── Picture upload (used by Flow Monitor click-modal for stop + scrap) ──────

/**
 * @swagger
 * /api/v1/admin/results/upload-picture:
 *   post:
 *     tags: ["Admin — Results"]
 *     summary: POST /upload-picture
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.post('/upload-picture', upload.single('image'), async (req, res, next) => {
  try {
    res.status(201).json(await resultSvc.uploadResultPicture(req.tenant, req.file));
  } catch (e) { next(e); }
});

// ── Warning data ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/admin/results/warning:
 *   get:
 *     tags: ["Admin — Results"]
 *     summary: GET /warning
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/warning', async (req, res, next) => {
  try {
    const q = {
      page: Number(req.query.page ?? 1),
      perPage: Number(req.query.perPage ?? 50),
      from: req.query.from || '',
      to: req.query.to || '',
    };
    res.json(await warningSvc.list(req.tenant, q));
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/results/warning/{id}:
 *   patch:
 *     tags: ["Admin — Results"]
 *     summary: PATCH /warning/:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/warning/:id', async (req, res, next) => {
  try {
    res.json(await warningSvc.update(req.tenant, Number(req.params.id), req.body));
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/results/warning/{id}:
 *   delete:
 *     tags: ["Admin — Results"]
 *     summary: DELETE /warning/:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/warning/:id', async (req, res, next) => {
  try {
    await warningSvc.remove(req.tenant, Number(req.params.id));
    res.status(204).send();
  } catch (e) { next(e); }
});

module.exports = router;
