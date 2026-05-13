'use strict';

const { Router } = require('express');
const { tenantMiddleware } = require('../middleware/tenant');
const resultSvc = require('../services/admin-results.service');
const warningSvc = require('../services/admin-warning-data.service');

const router = Router();
router.use(tenantMiddleware);

/**
 * Parse the filters[] query param array.
 * Accepts: ?filters[0][column]=flow_designs.name&filters[0][op]=3&filters[0][value]=line
 */
function parseFilters(query) {
  const raw = query.filters;
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .map((f) => ({ column: f.column, op: Number(f.op), value: f.value ?? '' }))
    .filter((f) => f.column && f.op);
}

function parseQ(query) {
  return {
    page: query.page ? Number(query.page) : 1,
    perPage: query.perPage ? Number(query.perPage) : 10,
    from: query.from || '',
    to: query.to || '',
    filters: parseFilters(query),
  };
}

// ── Production ──────────────────────────────────────────────────────────────

router.get('/production', async (req, res, next) => {
  try {
    res.json(await resultSvc.listProduction(req.tenant, parseQ(req.query)));
  } catch (e) { next(e); }
});

router.patch('/production/:id', async (req, res, next) => {
  try {
    res.json(await resultSvc.updateProduction(req.tenant, Number(req.params.id), req.body));
  } catch (e) { next(e); }
});

// ── Scrap ────────────────────────────────────────────────────────────────────

router.get('/scrap', async (req, res, next) => {
  try {
    res.json(await resultSvc.listScrap(req.tenant, parseQ(req.query)));
  } catch (e) { next(e); }
});

router.patch('/scrap/:id', async (req, res, next) => {
  try {
    res.json(await resultSvc.updateScrap(req.tenant, Number(req.params.id), req.body));
  } catch (e) { next(e); }
});

// ── Stop ─────────────────────────────────────────────────────────────────────

router.get('/stop', async (req, res, next) => {
  try {
    const q = {
      ...parseQ(req.query),
      includeExcluded: req.query.include_excluded === '1',
    };
    res.json(await resultSvc.listStop(req.tenant, q));
  } catch (e) { next(e); }
});

router.patch('/stop/:id', async (req, res, next) => {
  try {
    res.json(await resultSvc.updateStop(req.tenant, Number(req.params.id), req.body));
  } catch (e) { next(e); }
});

// ── Warning data ─────────────────────────────────────────────────────────────

router.get('/warning', async (req, res, next) => {
  try {
    const q = {
      page: Number(req.query.page ?? 1),
      perPage: Number(req.query.perPage ?? 50),
      from: req.query.from || '',
      to: req.query.to || '',
    };
    res.json(await warningSvc.list(req.tenant, q));
  } catch (e) { next(e); }
});

router.patch('/warning/:id', async (req, res, next) => {
  try {
    res.json(await warningSvc.update(req.tenant, Number(req.params.id), req.body));
  } catch (e) { next(e); }
});

router.delete('/warning/:id', async (req, res, next) => {
  try {
    await warningSvc.remove(req.tenant, Number(req.params.id));
    res.status(204).send();
  } catch (e) { next(e); }
});

module.exports = router;
