'use strict';

const { Router } = require('express');
const multer = require('multer');
const { tenantMiddleware } = require('../middleware/tenant');
const { requirePermission, requireAnyPermission } = require('../middleware/requirePermission');
const { BadRequestError } = require('../errors');
const svc = require('../services/admin-flow-designs.service');

const router = Router();
router.use(tenantMiddleware);

// Gate shorthands. View-only reads (Monitor/Analyzer card grids + their
// per-flow read endpoints) accept any of: view-flow-monitor, view-flow-analyzer,
// or manage-flow-designs (admins always pass through). Write/admin endpoints
// remain locked to manage-flow-designs.
const MANAGE = requirePermission('manage-flow-designs');
const VIEW_ANY = requireAnyPermission('view-flow-monitor', 'view-flow-analyzer', 'manage-flow-designs');
const VIEW_MONITOR = requireAnyPermission('view-flow-monitor', 'manage-flow-designs');
const VIEW_ANALYZER = requireAnyPermission('view-flow-analyzer', 'manage-flow-designs');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// ─── List + single-row CRUD ────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/admin/flow-designs:
 *   get:
 *     tags: ["Admin — Flow Designs"]
 *     summary: GET /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/', VIEW_ANY, async (req, res, next) => {
  try {
    const q = {
      page: req.query.page ? Number(req.query.page) : undefined,
      perPage: req.query.perPage ? Number(req.query.perPage) : undefined,
      search: req.query.search,
      status: req.query.status,
      equipmentId: req.query.equipmentId ? Number(req.query.equipmentId) : undefined,
    };
    res.json(await svc.list(req.tenant, q));
  } catch (err) { next(err); }
});

// Non-paginated list with flow_data — for Monitor / Analyzer card grids.
// Must be declared BEFORE GET /:id so it doesn't get swallowed.
/**
 * @swagger
 * /api/v1/admin/flow-designs/list-with-data:
 *   get:
 *     tags: ["Admin — Flow Designs"]
 *     summary: GET /list-with-data
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/list-with-data', VIEW_ANY, async (req, res, next) => {
  try { res.json(await svc.listWithData(req.tenant)); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/flow-designs/{id}:
 *   get:
 *     tags: ["Admin — Flow Designs"]
 *     summary: GET /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id', VIEW_ANY, async (req, res, next) => {
  try { res.json(await svc.findOne(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/flow-designs:
 *   post:
 *     tags: ["Admin — Flow Designs"]
 *     summary: POST /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.post('/', MANAGE, async (req, res, next) => {
  try { res.status(201).json(await svc.create(req.tenant, req.body)); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/flow-designs/{id}/status:
 *   patch:
 *     tags: ["Admin — Flow Designs"]
 *     summary: PATCH /:id/status
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/:id/status', MANAGE, async (req, res, next) => {
  try { res.json(await svc.patchStatus(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/flow-designs/{id}:
 *   patch:
 *     tags: ["Admin — Flow Designs"]
 *     summary: PATCH /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/:id', MANAGE, async (req, res, next) => {
  try { res.json(await svc.update(req.tenant, Number(req.params.id), req.body)); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/flow-designs/{id}:
 *   delete:
 *     tags: ["Admin — Flow Designs"]
 *     summary: DELETE /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/:id', MANAGE, async (req, res, next) => {
  try { await svc.softDelete(req.tenant, Number(req.params.id)); res.status(204).send(); } catch (err) { next(err); }
});

// ─── Diagram + background + attributes ────────────────────────────────────

// Diagram read is needed by Monitor/Analyzer (thumbnail render). Diagram
// write stays admin-only.
/**
 * @swagger
 * /api/v1/admin/flow-designs/{id}/diagram:
 *   get:
 *     tags: ["Admin — Flow Designs"]
 *     summary: GET /:id/diagram
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id/diagram', VIEW_ANY, async (req, res, next) => {
  try { res.json(await svc.getDiagram(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/flow-designs/{id}/diagram:
 *   put:
 *     tags: ["Admin — Flow Designs"]
 *     summary: PUT /:id/diagram
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.put('/:id/diagram', MANAGE, async (req, res, next) => {
  try {
    const { flowData, asNewName, svgData } = req.body ?? {};
    res.json(await svc.saveDiagram(req.tenant, Number(req.params.id), { flowData, asNewName, svgData }));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/flow-designs/{id}/background:
 *   post:
 *     tags: ["Admin — Flow Designs"]
 *     summary: POST /:id/background
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.post('/:id/background', MANAGE, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) throw new BadRequestError('image-file-required');
    res.status(201).json(await svc.uploadBackground(req.tenant, Number(req.params.id), req.file));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/flow-designs/{id}/background:
 *   delete:
 *     tags: ["Admin — Flow Designs"]
 *     summary: DELETE /:id/background
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/:id/background', MANAGE, async (req, res, next) => {
  try {
    const url = req.body?.url ?? req.query?.url;
    await svc.removeBackground(req.tenant, Number(req.params.id), url);
    res.status(204).send();
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/flow-designs/{id}/attributes:
 *   get:
 *     tags: ["Admin — Flow Designs"]
 *     summary: GET /:id/attributes
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id/attributes', VIEW_ANY, async (req, res, next) => {
  try { res.json(await svc.getAttributes(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

// ─── Monitor + Analyzer read-only endpoints ───────────────────────────────

/**
 * @swagger
 * /api/v1/admin/flow-designs/{id}/monitor-status:
 *   get:
 *     tags: ["Admin — Flow Designs"]
 *     summary: GET /:id/monitor-status
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id/monitor-status', VIEW_MONITOR, async (req, res, next) => {
  try {
    const body = await svc.getMonitorStatus(req.tenant, Number(req.params.id));
    const etag = svc.etagFor(body);
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res.json(body);
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/flow-designs/{id}/analyzer-data:
 *   get:
 *     tags: ["Admin — Flow Designs"]
 *     summary: GET /:id/analyzer-data
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id/analyzer-data', VIEW_ANALYZER, async (req, res, next) => {
  try {
    res.json(await svc.getAnalyzerData(req.tenant, Number(req.params.id), {
      startDate: req.query.startDate, endDate: req.query.endDate,
      flowKey: req.query.flowKey, equipName: req.query.equipName,
    }));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/flow-designs/{id}/line-chart:
 *   get:
 *     tags: ["Admin — Flow Designs"]
 *     summary: GET /:id/line-chart
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id/line-chart', VIEW_ANALYZER, async (req, res, next) => {
  try {
    res.json(await svc.getLineChart(req.tenant, Number(req.params.id), {
      startDate: req.query.startDate, endDate: req.query.endDate,
      type: req.query.type, name: req.query.name,
      flowKey: req.query.flowKey, prodGroup: req.query.prodGroup,
    }));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/flow-designs/{id}/quant-time:
 *   get:
 *     tags: ["Admin — Flow Designs"]
 *     summary: GET /:id/quant-time
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id/quant-time', VIEW_ANALYZER, async (req, res, next) => {
  try {
    res.json(await svc.getQuantTimeGraph(req.tenant, Number(req.params.id), {
      startDate: req.query.startDate, endDate: req.query.endDate,
      flowKey: req.query.flowKey,
    }));
  } catch (err) { next(err); }
});

module.exports = router;
