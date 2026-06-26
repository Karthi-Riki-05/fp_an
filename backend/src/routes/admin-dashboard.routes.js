'use strict';
const { Router } = require('express');
const { tenantMiddleware } = require('../middleware/tenant');
const chartSvc = require('../services/admin-chart-data.service');
const router = Router();
router.use(tenantMiddleware);

/**
 * @swagger
 * /api/v1/admin/dashboard/oee:
 *   get:
 *     tags: ["Admin — Dashboard"]
 *     summary: Tenant-wide OEE (availability/performance/quality) for a date range
 *     security:
 *       - access_token: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: OK }
 */
router.get('/oee', async (req, res, next) => {
  try {
    const data = await chartSvc.getOeeMetrics(req.tenant, req.query.from, req.query.to);
    res.json(data);
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/dashboard/chart:
 *   get:
 *     tags: ["Admin — Dashboard"]
 *     summary: Daily Production / Scrap / Stop series for the dashboard line chart
 *     security:
 *       - access_token: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: flowId
 *         description: Optional — restrict to one flow; omit for all flows.
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 */
router.get('/chart', async (req, res, next) => {
  try {
    const data = await chartSvc.getDashboardChart(
      req.tenant, req.query.from, req.query.to, req.query.flowId
    );
    res.json(data);
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /api/v1/admin/loss-model:
 *   get:
 *     tags: ["Admin — Dashboard"]
 *     summary: OEE waterfall metrics + loss breakdown (optionally per machine)
 *     security:
 *       - access_token: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: machineId
 *         description: Optional equipment id to scope the losses to one machine.
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 */
router.get('/loss-model', async (req, res, next) => {
  try {
    const data = await chartSvc.getLossModel(
      req.tenant, req.query.from, req.query.to, req.query.machineId
    );
    res.json(data);
  } catch (e) { next(e); }
});

module.exports = router;
