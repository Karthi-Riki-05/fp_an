'use strict';

const { Router } = require('express');
const { tenantMiddleware } = require('../middleware/tenant');
const { requirePermission } = require('../middleware/requirePermission');
const svc = require('../services/admin-stop-reasons.service');

const router = Router();
router.use(tenantMiddleware, requirePermission('manage-stop-reasons'));

/**
 * @swagger
 * /api/v1/admin/stop-reasons:
 *   get:
 *     tags: ["Admin — Stop Reasons"]
 *     summary: GET /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/', async (req, res, next) => {
  try {
    const q = { page: req.query.page ? Number(req.query.page) : undefined, perPage: req.query.perPage ? Number(req.query.perPage) : undefined, search: req.query.search, name: req.query.name, typeId: req.query.typeId !== undefined ? Number(req.query.typeId) : undefined, sort: req.query.sort, order: req.query.order };
    res.json(await svc.list(req.tenant, q));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/stop-reasons/{id}:
 *   get:
 *     tags: ["Admin — Stop Reasons"]
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
 * /api/v1/admin/stop-reasons:
 *   post:
 *     tags: ["Admin — Stop Reasons"]
 *     summary: POST /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.post('/', async (req, res, next) => {
  try { res.status(201).json(await svc.create(req.tenant, req.body)); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/stop-reasons/{id}:
 *   patch:
 *     tags: ["Admin — Stop Reasons"]
 *     summary: PATCH /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/:id', async (req, res, next) => {
  try { res.json(await svc.update(req.tenant, Number(req.params.id), req.body)); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/stop-reasons/{id}:
 *   delete:
 *     tags: ["Admin — Stop Reasons"]
 *     summary: DELETE /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/:id', async (req, res, next) => {
  try { await svc.softDelete(req.tenant, Number(req.params.id)); res.status(204).send(); } catch (err) { next(err); }
});

module.exports = router;
