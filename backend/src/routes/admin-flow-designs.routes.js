'use strict';

const { Router } = require('express');
const multer = require('multer');
const { tenantMiddleware } = require('../middleware/tenant');
const { requirePermission } = require('../middleware/requirePermission');
const { BadRequestError } = require('../errors');
const svc = require('../services/admin-flow-designs.service');

const router = Router();
router.use(tenantMiddleware, requirePermission('manage-flow-designs'));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// List with optional filters (paginated).
router.get('/', async (req, res, next) => {
  try {
    const q = {
      page: req.query.page ? Number(req.query.page) : undefined,
      perPage: req.query.perPage ? Number(req.query.perPage) : undefined,
      search: req.query.search,
      status: req.query.status,
      equipmentId: req.query.equipmentId ? Number(req.query.equipmentId) : undefined,
    };
    res.json(await svc.list(req.tenant, q));
  } catch (err) { next(err); }
});

// Non-paginated list with flow_data — for Monitor / Analyzer card grids.
// Must be declared BEFORE GET /:id so it doesn't get swallowed.
router.get('/list-with-data', async (req, res, next) => {
  try { res.json(await svc.listWithData(req.tenant)); } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try { res.json(await svc.findOne(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await svc.create(req.tenant, req.body)); } catch (err) { next(err); }
});

router.patch('/:id/status', async (req, res, next) => {
  try { res.json(await svc.patchStatus(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try { res.json(await svc.update(req.tenant, Number(req.params.id), req.body)); } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try { await svc.softDelete(req.tenant, Number(req.params.id)); res.status(204).send(); } catch (err) { next(err); }
});

// ─── Step 1 extended endpoints ──────────────────────────────────────────

router.get('/:id/diagram', async (req, res, next) => {
  try { res.json(await svc.getDiagram(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

router.put('/:id/diagram', async (req, res, next) => {
  try {
    const { flowData, asNewName } = req.body ?? {};
    res.json(await svc.saveDiagram(req.tenant, Number(req.params.id), { flowData, asNewName }));
  } catch (err) { next(err); }
});

router.post('/:id/background', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) throw new BadRequestError('image-file-required');
    res.status(201).json(await svc.uploadBackground(req.tenant, Number(req.params.id), req.file));
  } catch (err) { next(err); }
});

router.delete('/:id/background', async (req, res, next) => {
  try {
    const url = req.body?.url ?? req.query?.url;
    await svc.removeBackground(req.tenant, Number(req.params.id), url);
    res.status(204).send();
  } catch (err) { next(err); }
});

router.get('/:id/attributes', async (req, res, next) => {
  try { res.json(await svc.getAttributes(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

// Live monitor status for each equipment-bound node. ETag-cached so the
// poll-every-10s pattern can short-circuit unchanged responses with 304.
router.get('/:id/monitor-status', async (req, res, next) => {
  try {
    const body = await svc.getMonitorStatus(req.tenant, Number(req.params.id));
    const etag = svc.etagFor(body);
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res.json(body);
  } catch (err) { next(err); }
});

router.get('/:id/analyzer-data', async (req, res, next) => {
  try {
    res.json(await svc.getAnalyzerData(req.tenant, Number(req.params.id), {
      startDate: req.query.startDate, endDate: req.query.endDate,
      flowKey: req.query.flowKey, equipName: req.query.equipName,
    }));
  } catch (err) { next(err); }
});

router.get('/:id/line-chart', async (req, res, next) => {
  try {
    res.json(await svc.getLineChart(req.tenant, Number(req.params.id), {
      startDate: req.query.startDate, endDate: req.query.endDate,
      type: req.query.type, name: req.query.name,
      flowKey: req.query.flowKey, prodGroup: req.query.prodGroup,
    }));
  } catch (err) { next(err); }
});

router.get('/:id/quant-time', async (req, res, next) => {
  try {
    res.json(await svc.getQuantTimeGraph(req.tenant, Number(req.params.id), {
      startDate: req.query.startDate, endDate: req.query.endDate,
      flowKey: req.query.flowKey,
    }));
  } catch (err) { next(err); }
});

module.exports = router;
