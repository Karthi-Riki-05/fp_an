'use strict';
const { Router } = require('express');
const { tenantMiddleware } = require('../middleware/tenant');
const svc = require('../services/admin-iot.service');
const router = Router();
router.use(tenantMiddleware);

router.get('/units', async (req, res, next) => {
  try { res.json(await svc.getUnits(req.tenant)); } catch (e) { next(e); }
});

router.patch('/units/:id/settings', async (req, res, next) => {
  try { await svc.updateSettings(req.tenant, Number(req.params.id), req.body); res.status(204).send(); } catch (e) { next(e); }
});

router.post('/units/:id/equipment', async (req, res, next) => {
  try { await svc.assignEquipment(req.tenant, Number(req.params.id), Number(req.body.equipmentId)); res.status(204).send(); } catch (e) { next(e); }
});

router.delete('/units/:id/equipment', async (req, res, next) => {
  try { await svc.removeEquipment(req.tenant, Number(req.params.id)); res.status(204).send(); } catch (e) { next(e); }
});

router.patch('/units/:id/counter-settings', async (req, res, next) => {
  try { await svc.updateCounterSettings(req.tenant, Number(req.params.id), req.body); res.status(204).send(); } catch (e) { next(e); }
});

router.get('/units/:id/counter-children', async (req, res, next) => {
  try { res.json(await svc.getCounterChildren(req.tenant, Number(req.params.id))); } catch (e) { next(e); }
});

router.post('/units/:id/test-notification', async (req, res, next) => {
  // Stub — real push notification wired in Phase 5 IoT module
  res.json({ success: true, message: 'Test notification queued (stub)' });
});

router.get('/flow-designs', async (req, res, next) => {
  try {
    const equipmentId = req.query.equipmentId ? Number(req.query.equipmentId) : undefined;
    res.json(await svc.getFlowDesigns(req.tenant, equipmentId));
  } catch (e) { next(e); }
});

router.get('/stop-reasons', async (req, res, next) => {
  try {
    const equipmentId = req.query.equipmentId ? Number(req.query.equipmentId) : undefined;
    res.json(await svc.getStopReasons(req.tenant, equipmentId));
  } catch (e) { next(e); }
});

module.exports = router;
