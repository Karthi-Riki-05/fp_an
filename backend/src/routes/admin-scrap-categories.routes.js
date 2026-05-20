'use strict';

const { Router } = require('express');
const { tenantMiddleware } = require('../middleware/tenant');
const svc = require('../services/admin-scrap-categories.service');

const router = Router();
router.use(tenantMiddleware);

/**
 * @swagger
 * /api/v1/admin/scrap-categories:
 *   get:
 *     tags: ["Admin — Scrap Categories"]
 *     summary: GET /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/', async (req, res, next) => {
  try { res.json(await svc.list(req.tenant)); } catch (err) { next(err); }
});

module.exports = router;
