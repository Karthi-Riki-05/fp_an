'use strict';

const { Router } = require('express');
const { tenantMiddleware } = require('../middleware/tenant');
const svc = require('../services/admin-stop-categories.service');

const router = Router();
router.use(tenantMiddleware);

/**
 * @swagger
 * /api/v1/admin/stop-categories:
 *   get:
 *     tags: ["Admin — Stop Categories"]
 *     summary: GET /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/', async (req, res, next) => {
  try {
    const q = {
      page: req.query.page ? Number(req.query.page) : undefined,
      perPage: req.query.perPage ? Number(req.query.perPage) : undefined,
      search: req.query.search,
      isActive: req.query.isActive !== undefined
        ? (req.query.isActive === 'true' || req.query.isActive === '1' || req.query.isActive === true)
        : undefined,
    };
    res.json(await svc.list(req.tenant, q));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/stop-categories/{id}:
 *   get:
 *     tags: ["Admin — Stop Categories"]
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
 * /api/v1/admin/stop-categories:
 *   post:
 *     tags: ["Admin — Stop Categories"]
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
 * /api/v1/admin/stop-categories/{id}:
 *   patch:
 *     tags: ["Admin — Stop Categories"]
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
 * /api/v1/admin/stop-categories/{id}:
 *   delete:
 *     tags: ["Admin — Stop Categories"]
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
