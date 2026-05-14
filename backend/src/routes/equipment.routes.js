'use strict';

const { Router } = require('express');
const { tenantMiddleware } = require('../middleware/tenant');
const { requirePermission } = require('../middleware/requirePermission');
const svc = require('../services/equipment.service');

const router = Router();

router.use(tenantMiddleware);

router.get('/', async (req, res, next) => {
  try { res.json(await svc.list(req.tenant)); } catch (err) { next(err); }
});

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
router.get('/:id/parts', async (req, res, next) => {
  try { res.json(await svc.getPartsForEquipment(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

router.get('/:id/stop-reasons', async (req, res, next) => {
  try { res.json(await svc.getStopReasonsForEquipment(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

router.get('/:id/scrap-reasons', async (req, res, next) => {
  try { res.json(await svc.getScrapReasonsForEquipment(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

router.get('/:id/orders', async (req, res, next) => {
  try { res.json(await svc.getOrdersForEquipment(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

router.get('/:id/properties', async (req, res, next) => {
  try { res.json(await svc.getProperties(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

router.put('/:id/properties', requirePermission('manage-equipment'), async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body) ? req.body : req.body?.properties;
    res.json(await svc.replaceProperties(req.tenant, Number(req.params.id), rows ?? []));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try { res.json(await svc.findOne(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

router.post('/', requirePermission('manage-equipment'), async (req, res, next) => {
  try { res.status(201).json(await svc.create(req.tenant, req.body)); } catch (err) { next(err); }
});

router.patch('/:id', requirePermission('manage-equipment'), async (req, res, next) => {
  try { res.json(await svc.update(req.tenant, Number(req.params.id), req.body)); } catch (err) { next(err); }
});

router.delete('/:id', requirePermission('manage-equipment'), async (req, res, next) => {
  try { await svc.softDelete(req.tenant, Number(req.params.id)); res.status(204).send(); } catch (err) { next(err); }
});

module.exports = router;
