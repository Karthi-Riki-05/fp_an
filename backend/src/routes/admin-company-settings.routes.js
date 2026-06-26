'use strict';
const { Router } = require('express');
const { tenantMiddleware } = require('../middleware/tenant');
const svc = require('../services/company-settings.service');

const router = Router();
router.use(tenantMiddleware);

/**
 * @swagger
 * /api/v1/admin/company-settings:
 *   get:
 *     tags: ["Admin — Company"]
 *     summary: Get this company's settings (merged with defaults)
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 *   patch:
 *     tags: ["Admin — Company"]
 *     summary: Update this company's settings (partial, per section)
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/', async (req, res, next) => {
  try {
    res.json(await svc.getSettings(req.tenant.tenantId));
  } catch (e) { next(e); }
});

router.patch('/', async (req, res, next) => {
  try {
    res.json(await svc.updateSettings(req.tenant.tenantId, req.body ?? {}));
  } catch (e) { next(e); }
});

module.exports = router;
