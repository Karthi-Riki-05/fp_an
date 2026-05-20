'use strict';

const { Router } = require('express');
const { tenantMiddleware } = require('../middleware/tenant');
const { requirePermission } = require('../middleware/requirePermission');
const svc = require('../services/equipment.service');

const router = Router();

router.use(tenantMiddleware);

/**
 * @swagger
 * /api/v1/equipment:
 *   get:
 *     tags: ["Equipment"]
 *     summary: GET /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/', async (req, res, next) => {
  try { res.json(await svc.list(req.tenant)); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/equipment/tree:
 *   get:
 *     tags: ["Equipment"]
 *     summary: GET /tree
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/tree', async (req, res, next) => {
  try {
    const tree = await svc.getTree(req.tenant);
    // Explicit BigInt-safe serialisation — Prisma $queryRawUnsafe can return
    // BigInt on some PostgreSQL column types even after int casts.
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(tree, (_, v) => (typeof v === 'bigint' ? Number(v) : v)));
  } catch (err) { next(err); }
});

// Cascading sub-resources used by Orders / Result / Flow Monitor / Units forms.
/**
 * @swagger
 * /api/v1/equipment/{id}/parts:
 *   get:
 *     tags: ["Equipment"]
 *     summary: GET /:id/parts
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id/parts', async (req, res, next) => {
  try { res.json(await svc.getPartsForEquipment(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/equipment/{id}/stop-reasons:
 *   get:
 *     tags: ["Equipment"]
 *     summary: GET /:id/stop-reasons
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id/stop-reasons', async (req, res, next) => {
  try { res.json(await svc.getStopReasonsForEquipment(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/equipment/{id}/scrap-reasons:
 *   get:
 *     tags: ["Equipment"]
 *     summary: GET /:id/scrap-reasons
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id/scrap-reasons', async (req, res, next) => {
  try { res.json(await svc.getScrapReasonsForEquipment(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/equipment/{id}/orders:
 *   get:
 *     tags: ["Equipment"]
 *     summary: GET /:id/orders
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id/orders', async (req, res, next) => {
  try { res.json(await svc.getOrdersForEquipment(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/equipment/{id}/properties:
 *   get:
 *     tags: ["Equipment"]
 *     summary: GET /:id/properties
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id/properties', async (req, res, next) => {
  try { res.json(await svc.getProperties(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

// Tree reorder/reparent. POST /reorder is the batch endpoint used by the
// draggable tree; PATCH /:id/position is a single-item convenience that
// delegates to the same service code.
function sendCircularRef(res, err) {
  if (err && err.message === 'circular-reference' && err.nodeId !== undefined) {
    res.status(400).json({ statusCode: 400, message: 'circular-reference', nodeId: err.nodeId });
    return true;
  }
  return false;
}

/**
 * @swagger
 * /api/v1/equipment/reorder:
 *   post:
 *     tags: ["Equipment"]
 *     summary: POST /reorder
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.post('/reorder', requirePermission('manage-equipment'), async (req, res, next) => {
  try {
    const items = Array.isArray(req.body) ? req.body : req.body?.items;
    res.json(await svc.reorder(req.tenant, items ?? []));
  } catch (err) {
    if (sendCircularRef(res, err)) return;
    next(err);
  }
});

/**
 * @swagger
 * /api/v1/equipment/{id}/position:
 *   patch:
 *     tags: ["Equipment"]
 *     summary: PATCH /:id/position
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/:id/position', requirePermission('manage-equipment'), async (req, res, next) => {
  try {
    const { parentId, sortOrder } = req.body ?? {};
    res.json(await svc.updatePosition(req.tenant, Number(req.params.id), parentId, sortOrder));
  } catch (err) {
    if (sendCircularRef(res, err)) return;
    next(err);
  }
});

/**
 * @swagger
 * /api/v1/equipment/{id}/properties:
 *   put:
 *     tags: ["Equipment"]
 *     summary: PUT /:id/properties
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.put('/:id/properties', requirePermission('manage-equipment'), async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body) ? req.body : req.body?.properties;
    res.json(await svc.replaceProperties(req.tenant, Number(req.params.id), rows ?? []));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/equipment/{id}:
 *   get:
 *     tags: ["Equipment"]
 *     summary: GET /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id', async (req, res, next) => {
  try { res.json(await svc.findOne(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/equipment:
 *   post:
 *     tags: ["Equipment"]
 *     summary: POST /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.post('/', requirePermission('manage-equipment'), async (req, res, next) => {
  try { res.status(201).json(await svc.create(req.tenant, req.body)); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/equipment/{id}:
 *   patch:
 *     tags: ["Equipment"]
 *     summary: PATCH /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/:id', requirePermission('manage-equipment'), async (req, res, next) => {
  try { res.json(await svc.update(req.tenant, Number(req.params.id), req.body)); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/equipment/{id}:
 *   delete:
 *     tags: ["Equipment"]
 *     summary: DELETE /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/:id', requirePermission('manage-equipment'), async (req, res, next) => {
  try { await svc.softDelete(req.tenant, Number(req.params.id)); res.status(204).send(); } catch (err) { next(err); }
});

module.exports = router;
