'use strict';
const { Router } = require('express');
const { tenantMiddleware } = require('../middleware/tenant');
const svc = require('../services/admin-boards.service');
const chartSvc = require('../services/admin-chart-data.service');
const router = Router();
router.use(tenantMiddleware);

// Board list
/**
 * @swagger
 * /api/v1/admin/boards:
 *   get:
 *     tags: ["Admin — Boards"]
 *     summary: GET /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/', async (req, res, next) => {
  try {
    const q = { page: Number(req.query.page ?? 1), perPage: Number(req.query.perPage ?? 10) };
    res.json(await svc.listBoards(req.tenant, q));
  } catch (e) { next(e); }
});

// Widgets (all, not per-board) — must be before /:id
/**
 * @swagger
 * /api/v1/admin/boards/widgets:
 *   get:
 *     tags: ["Admin — Boards"]
 *     summary: GET /widgets
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/widgets', async (req, res, next) => {
  try { res.json(await svc.listWidgets(req.tenant)); } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/boards/widgets:
 *   post:
 *     tags: ["Admin — Boards"]
 *     summary: POST /widgets
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.post('/widgets', async (req, res, next) => {
  try { res.status(201).json(await svc.createWidget(req.tenant, req.user, req.body)); } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/boards/widgets/{widgetId}:
 *   delete:
 *     tags: ["Admin — Boards"]
 *     summary: DELETE /widgets/:widgetId
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: widgetId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/widgets/:widgetId', async (req, res, next) => {
  try { await svc.deleteWidget(req.tenant, Number(req.params.widgetId)); res.status(204).send(); } catch (e) { next(e); }
});

// Per-board
/**
 * @swagger
 * /api/v1/admin/boards/{id}:
 *   get:
 *     tags: ["Admin — Boards"]
 *     summary: GET /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id', async (req, res, next) => {
  try { res.json(await svc.findBoard(req.tenant, Number(req.params.id))); } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/boards/{id}/widgets:
 *   get:
 *     tags: ["Admin — Boards"]
 *     summary: GET /:id/widgets
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id/widgets', async (req, res, next) => {
  try { res.json(await svc.getBoardWidgets(req.tenant, Number(req.params.id))); } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/boards/{id}/widgets/{widgetId}/chart-data:
 *   get:
 *     tags: ["Admin — Boards"]
 *     summary: GET /:id/widgets/:widgetId/chart-data
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: widgetId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id/widgets/:widgetId/chart-data', async (req, res, next) => {
  try {
    const widgets = await svc.getBoardWidgets(req.tenant, Number(req.params.id));
    const widget = widgets.find(w => w.id === Number(req.params.widgetId));
    if (!widget) return res.status(404).json({ message: 'widget-not-found' });
    const settings = typeof widget.settings === 'string' ? JSON.parse(widget.settings) : widget.settings;
    const data = await chartSvc.getChartData(req.tenant, settings, req.query.from, req.query.to);
    res.json({ widget, chartData: data });
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/boards:
 *   post:
 *     tags: ["Admin — Boards"]
 *     summary: POST /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.post('/', async (req, res, next) => {
  try { res.status(201).json(await svc.createBoard(req.tenant, req.user, req.body)); } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/boards/{id}:
 *   patch:
 *     tags: ["Admin — Boards"]
 *     summary: PATCH /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/:id', async (req, res, next) => {
  try { res.json(await svc.updateBoard(req.tenant, Number(req.params.id), req.body)); } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/boards/{id}/status:
 *   patch:
 *     tags: ["Admin — Boards"]
 *     summary: PATCH /:id/status
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/:id/status', async (req, res, next) => {
  try { res.json(await svc.patchBoardStatus(req.tenant, Number(req.params.id))); } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/boards/{id}:
 *   delete:
 *     tags: ["Admin — Boards"]
 *     summary: DELETE /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/:id', async (req, res, next) => {
  try { await svc.deleteBoard(req.tenant, Number(req.params.id)); res.status(204).send(); } catch (e) { next(e); }
});

module.exports = router;
