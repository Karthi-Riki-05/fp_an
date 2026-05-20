'use strict';

const { Router } = require('express');
const { tenantMiddleware } = require('../middleware/tenant');
const { requirePermission } = require('../middleware/requirePermission');
const svc = require('../services/admin-work-shifts.service');

const router = Router();
router.use(tenantMiddleware, requirePermission('manage-work-shifts'));

/**
 * @swagger
 * /api/v1/admin/work-shifts:
 *   get:
 *     tags: ["Admin — Work Shifts"]
 *     summary: GET /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/', async (req, res, next) => {
  try {
    const q = { page: req.query.page ? Number(req.query.page) : undefined, perPage: req.query.perPage ? Number(req.query.perPage) : undefined, search: req.query.search, name: req.query.name, sort: req.query.sort, order: req.query.order };
    res.json(await svc.list(req.tenant, q));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/work-shifts/{id}:
 *   get:
 *     tags: ["Admin — Work Shifts"]
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
 * /api/v1/admin/work-shifts:
 *   post:
 *     tags: ["Admin — Work Shifts"]
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
 * /api/v1/admin/work-shifts/{id}/status:
 *   patch:
 *     tags: ["Admin — Work Shifts"]
 *     summary: PATCH /:id/status
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/:id/status', async (req, res, next) => {
  try { res.json(await svc.patchStatus(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/work-shifts/{id}:
 *   patch:
 *     tags: ["Admin — Work Shifts"]
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
 * /api/v1/admin/work-shifts/{id}:
 *   delete:
 *     tags: ["Admin — Work Shifts"]
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
