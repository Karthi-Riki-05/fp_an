'use strict';

const { Router } = require('express');
const { tenantMiddleware } = require('../middleware/tenant');
const svc = require('../services/admin-shift-schedules.service');

const router = Router();
router.use(tenantMiddleware);

/**
 * @swagger
 * /api/v1/admin/shift-schedules:
 *   get:
 *     tags: ["Admin — Shift Schedules"]
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
      name: req.query.name,
      sort: req.query.sort,
      order: req.query.order,
    };
    res.json(await svc.list(req.tenant, q));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/shift-schedules/{id}/events:
 *   get:
 *     tags: ["Admin — Shift Schedules"]
 *     summary: GET /:id/events
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
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
/**
 * @swagger
 * /api/v1/admin/shift-schedules/titles:
 *   get:
 *     tags: ["Admin — Shift Schedules"]
 *     summary: GET /titles
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
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

/**
 * @swagger
 * /api/v1/admin/shift-schedules/{id}:
 *   get:
 *     tags: ["Admin — Shift Schedules"]
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
 * /api/v1/admin/shift-schedules:
 *   post:
 *     tags: ["Admin — Shift Schedules"]
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
 * /api/v1/admin/shift-schedules/{id}/events:
 *   post:
 *     tags: ["Admin — Shift Schedules"]
 *     summary: POST /:id/events
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.post('/:id/events', async (req, res, next) => {
  try { res.status(201).json(await svc.createEvent(req.tenant, Number(req.params.id), req.body)); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/shift-schedules/{id}/events/{eventId}:
 *   patch:
 *     tags: ["Admin — Shift Schedules"]
 *     summary: Update an existing shift event (drag-to-reorder or edit)
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: eventId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/:id/events/:eventId', async (req, res, next) => {
  try { res.json(await svc.updateEvent(req.tenant, Number(req.params.eventId), req.body)); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/shift-schedules/{id}/status:
 *   patch:
 *     tags: ["Admin — Shift Schedules"]
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
 * /api/v1/admin/shift-schedules/{id}:
 *   patch:
 *     tags: ["Admin — Shift Schedules"]
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
 * /api/v1/admin/shift-schedules/{id}/events/{eventId}:
 *   delete:
 *     tags: ["Admin — Shift Schedules"]
 *     summary: DELETE /:id/events/:eventId
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: eventId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/:id/events/:eventId', async (req, res, next) => {
  try { await svc.deleteEvent(req.tenant, Number(req.params.eventId)); res.status(204).send(); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/shift-schedules/{id}:
 *   delete:
 *     tags: ["Admin — Shift Schedules"]
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
