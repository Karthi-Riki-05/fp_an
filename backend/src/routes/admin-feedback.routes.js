'use strict';

const { Router } = require('express');
const { requirePermission } = require('../middleware/requirePermission');
const svc = require('../services/admin-feedback.service');

const router = Router();
router.use(requirePermission('manage-feedback'));

/**
 * @swagger
 * /api/v1/admin/feedback:
 *   get:
 *     tags: ["Admin — Feedback"]
 *     summary: GET /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/', async (req, res, next) => {
  try {
    const q = { page: req.query.page ? Number(req.query.page) : undefined, perPage: req.query.perPage ? Number(req.query.perPage) : undefined, search: req.query.search, tenantId: req.query.tenantId ? Number(req.query.tenantId) : undefined, sort: req.query.sort, order: req.query.order };
    res.json(await svc.list(req.user, q));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/feedback/{id}:
 *   get:
 *     tags: ["Admin — Feedback"]
 *     summary: GET /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id', async (req, res, next) => {
  try { res.json(await svc.findOne(req.user, Number(req.params.id))); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/feedback:
 *   post:
 *     tags: ["Admin — Feedback"]
 *     summary: POST /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.post('/', async (req, res, next) => {
  try { res.status(201).json(await svc.create(req.user, req.body)); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/feedback/{id}:
 *   patch:
 *     tags: ["Admin — Feedback"]
 *     summary: PATCH /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/:id', async (req, res, next) => {
  try { res.json(await svc.update(req.user, Number(req.params.id), req.body)); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/feedback/{id}:
 *   delete:
 *     tags: ["Admin — Feedback"]
 *     summary: DELETE /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/:id', async (req, res, next) => {
  try { await svc.softDelete(req.user, Number(req.params.id)); res.status(204).send(); } catch (err) { next(err); }
});

module.exports = router;
