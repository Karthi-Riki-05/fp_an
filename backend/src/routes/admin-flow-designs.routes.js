'use strict';

const { Router } = require('express');
const multer = require('multer');
const { tenantMiddleware } = require('../middleware/tenant');
const { requirePermission, requireAnyPermission } = require('../middleware/requirePermission');
const { BadRequestError } = require('../errors');
const svc = require('../services/admin-flow-designs.service');

const router = Router();
router.use(tenantMiddleware);

// Gate shorthands. View-only reads (Monitor/Analyzer card grids + their
// per-flow read endpoints) accept any of: view-flow-monitor, view-flow-analyzer,
// or manage-flow-designs (admins always pass through). Write/admin endpoints
// remain locked to manage-flow-designs.
const MANAGE = requirePermission('manage-flow-designs');
const VIEW_ANY = requireAnyPermission('view-flow-monitor', 'view-flow-analyzer', 'manage-flow-designs');
const VIEW_MONITOR = requireAnyPermission('view-flow-monitor', 'manage-flow-designs');
const VIEW_ANALYZER = requireAnyPermission('view-flow-analyzer', 'manage-flow-designs');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// ─── List + single-row CRUD ────────────────────────────────────────────────

router.get('/', VIEW_ANY, async (req, res, next) => {
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
router.get('/list-with-data', VIEW_ANY, async (req, res, next) => {
  try { res.json(await svc.listWithData(req.tenant)); } catch (err) { next(err); }
});

router.get('/:id', VIEW_ANY, async (req, res, next) => {
  try { res.json(await svc.findOne(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

router.post('/', MANAGE, async (req, res, next) => {
  try { res.status(201).json(await svc.create(req.tenant, req.body)); } catch (err) { next(err); }
});

router.patch('/:id/status', MANAGE, async (req, res, next) => {
  try { res.json(await svc.patchStatus(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

router.patch('/:id', MANAGE, async (req, res, next) => {
  try { res.json(await svc.update(req.tenant, Number(req.params.id), req.body)); } catch (err) { next(err); }
});

router.delete('/:id', MANAGE, async (req, res, next) => {
  try { await svc.softDelete(req.tenant, Number(req.params.id)); res.status(204).send(); } catch (err) { next(err); }
});

// ─── Diagram + background + attributes ────────────────────────────────────

// Diagram read is needed by Monitor/Analyzer (thumbnail render). Diagram
// write stays admin-only.
router.get('/:id/diagram', VIEW_ANY, async (req, res, next) => {
  try { res.json(await svc.getDiagram(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

router.put('/:id/diagram', MANAGE, async (req, res, next) => {
  try {
    const { flowData, asNewName, svgData } = req.body ?? {};
    res.json(await svc.saveDiagram(req.tenant, Number(req.params.id), { flowData, asNewName, svgData }));
  } catch (err) { next(err); }
});

router.post('/:id/background', MANAGE, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) throw new BadRequestError('image-file-required');
    res.status(201).json(await svc.uploadBackground(req.tenant, Number(req.params.id), req.file));
  } catch (err) { next(err); }
});

router.delete('/:id/background', MANAGE, async (req, res, next) => {
  try {
    const url = req.body?.url ?? req.query?.url;
    await svc.removeBackground(req.tenant, Number(req.params.id), url);
    res.status(204).send();
  } catch (err) { next(err); }
});

router.get('/:id/attributes', VIEW_ANY, async (req, res, next) => {
  try { res.json(await svc.getAttributes(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

// ─── Monitor + Analyzer read-only endpoints ───────────────────────────────

router.get('/:id/monitor-status', VIEW_MONITOR, async (req, res, next) => {
  try {
    const body = await svc.getMonitorStatus(req.tenant, Number(req.params.id));
    const etag = svc.etagFor(body);
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res.json(body);
  } catch (err) { next(err); }
});

router.get('/:id/analyzer-data', VIEW_ANALYZER, async (req, res, next) => {
  try {
    res.json(await svc.getAnalyzerData(req.tenant, Number(req.params.id), {
      startDate: req.query.startDate, endDate: req.query.endDate,
      flowKey: req.query.flowKey, equipName: req.query.equipName,
    }));
  } catch (err) { next(err); }
});

router.get('/:id/line-chart', VIEW_ANALYZER, async (req, res, next) => {
  try {
    res.json(await svc.getLineChart(req.tenant, Number(req.params.id), {
      startDate: req.query.startDate, endDate: req.query.endDate,
      type: req.query.type, name: req.query.name,
      flowKey: req.query.flowKey, prodGroup: req.query.prodGroup,
    }));
  } catch (err) { next(err); }
});

router.get('/:id/quant-time', VIEW_ANALYZER, async (req, res, next) => {
  try {
    res.json(await svc.getQuantTimeGraph(req.tenant, Number(req.params.id), {
      startDate: req.query.startDate, endDate: req.query.endDate,
      flowKey: req.query.flowKey,
    }));
  } catch (err) { next(err); }
});

module.exports = router;
