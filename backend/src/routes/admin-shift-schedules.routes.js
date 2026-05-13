'use strict';

const { Router } = require('express');
const { tenantMiddleware } = require('../middleware/tenant');
const svc = require('../services/admin-shift-schedules.service');

const router = Router();
router.use(tenantMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const q = {
      page: req.query.page ? Number(req.query.page) : undefined,
      perPage: req.query.perPage ? Number(req.query.perPage) : undefined,
      search: req.query.search,
      name: req.query.name,
      sort: req.query.sort,
      order: req.query.order,
    };
    res.json(await svc.list(req.tenant, q));
  } catch (err) { next(err); }
});

router.get('/:id/events', async (req, res, next) => {
  try {
    const { start, end } = req.query;
    res.json(await svc.getEvents(req.tenant, Number(req.params.id), start, end));
  } catch (err) { next(err); }
});

/**
 * Returns shift schedule event titles applicable to an equipment on a given date.
 * Legacy: getShiftScheduleTitleByTimeAll(date, equipment_id).
 * Query: ?date=YYYY-MM-DD&equipmentId=:id
 */
router.get('/titles', async (req, res, next) => {
  try {
    const date = req.query.date;
    const equipmentId = req.query.equipmentId ? Number(req.query.equipmentId) : undefined;
    if (!date || !equipmentId) {
      return res.status(400).json({ statusCode: 400, message: 'date and equipmentId required' });
    }
    res.json(await svc.getTitlesForEquipment(req.tenant, equipmentId, date));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try { res.json(await svc.findOne(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await svc.create(req.tenant, req.body)); } catch (err) { next(err); }
});

router.post('/:id/events', async (req, res, next) => {
  try { res.status(201).json(await svc.createEvent(req.tenant, Number(req.params.id), req.body)); } catch (err) { next(err); }
});

router.patch('/:id/status', async (req, res, next) => {
  try { res.json(await svc.patchStatus(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try { res.json(await svc.update(req.tenant, Number(req.params.id), req.body)); } catch (err) { next(err); }
});

router.delete('/:id/events/:eventId', async (req, res, next) => {
  try { await svc.deleteEvent(req.tenant, Number(req.params.eventId)); res.status(204).send(); } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try { await svc.softDelete(req.tenant, Number(req.params.id)); res.status(204).send(); } catch (err) { next(err); }
});

module.exports = router;
