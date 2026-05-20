'use strict';

const { Router } = require('express');
const multer = require('multer');
const { tenantMiddleware } = require('../middleware/tenant');
const svc = require('../services/myresult.service');
const { put: storagePut } = require('../services/file-storage.service');

const router = Router();
router.use(tenantMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ─── helpers ──────────────────────────────────────────────────────────────

function intParam(req, name) {
  const v = Number(req.params[name]);
  if (!Number.isInteger(v) || v <= 0) {
    const err = new Error(`${name}-invalid`); err.statusCode = 400; throw err;
  }
  return v;
}

function parsedQuery(req) {
  // Light, defensive normalisation — the service does its own type coercion.
  const q = { ...req.query };
  for (const k of ['filterColumn', 'filterType', 'filterVal']) {
    if (q[k] != null && !Array.isArray(q[k])) q[k] = [q[k]];
  }
  return q;
}

// ─── GET /tabs ────────────────────────────────────────────────────────────

router.get('/tabs', async (req, res, next) => {
  try { res.json(await svc.getTabs(req.tenant, req.user.id)); } catch (e) { next(e); }
});

// ─── LIST endpoints ───────────────────────────────────────────────────────

router.get('/production', async (req, res, next) => {
  try { res.json(await svc.listProduction(req.tenant, req.user.id, parsedQuery(req))); } catch (e) { next(e); }
});
router.get('/scrap', async (req, res, next) => {
  try { res.json(await svc.listScrap(req.tenant, req.user.id, parsedQuery(req))); } catch (e) { next(e); }
});
router.get('/stop', async (req, res, next) => {
  try { res.json(await svc.listStop(req.tenant, req.user.id, parsedQuery(req))); } catch (e) { next(e); }
});
router.get('/warning', async (req, res, next) => {
  try { res.json(await svc.listWarning(req.tenant, req.user.id, parsedQuery(req))); } catch (e) { next(e); }
});
router.get('/unregistered', async (req, res, next) => {
  try { res.json(await svc.listUnregistered(req.tenant, parsedQuery(req))); } catch (e) { next(e); }
});

// ─── SUMMARY ──────────────────────────────────────────────────────────────

for (const tab of ['production', 'scrap', 'stop']) {
  router.get(`/${tab}/summary`, async (req, res, next) => {
    try {
      const type = Number(req.query.type);
      res.json(await svc.getSummary(req.tenant, req.user.id, tab, type));
    } catch (e) { next(e); }
  });
}

// ─── GET single row (edit-form data) ──────────────────────────────────────

for (const tab of ['production', 'scrap', 'stop', 'warning']) {
  router.get(`/${tab}/:id`, async (req, res, next) => {
    try {
      const id = intParam(req, 'id');
      res.json(await svc.getEditRow(req.tenant, req.user.id, tab, id));
    } catch (e) { next(e); }
  });
}

// ─── POST (upsert) ────────────────────────────────────────────────────────
//
// Production: JSON body.
// Scrap / Stop: multipart with optional `picture` file.
// Optional `id` in body to update an existing row.
// Multer's `.any()` accepts the picture without changing the field-key contract.

router.post('/production', async (req, res, next) => {
  try {
    const id = req.body.id ? Number(req.body.id) : null;
    res.status(id ? 200 : 201).json(await svc.upsertProduction(req.tenant, req.user, req.body, id));
  } catch (e) { next(e); }
});

router.post('/scrap', upload.single('picture'), async (req, res, next) => {
  try {
    const id = req.body.id ? Number(req.body.id) : null;
    if (req.file) {
      const out = await storagePut(
        `tenant-${req.tenant.companyUserId}/result-pictures`,
        req.file.originalname, req.file.buffer, req.file.mimetype,
      );
      req.body.picture = out.url;
    }
    res.status(id ? 200 : 201).json(await svc.upsertScrap(req.tenant, req.user, req.body, id));
  } catch (e) { next(e); }
});

router.post('/stop', upload.single('picture'), async (req, res, next) => {
  try {
    const id = req.body.id ? Number(req.body.id) : null;
    if (req.file) {
      const out = await storagePut(
        `tenant-${req.tenant.companyUserId}/result-pictures`,
        req.file.originalname, req.file.buffer, req.file.mimetype,
      );
      req.body.picture = out.url;
    }
    res.status(id ? 200 : 201).json(await svc.upsertStop(req.tenant, req.user, req.body, id));
  } catch (e) { next(e); }
});

router.post('/warning', async (req, res, next) => {
  try {
    const id = req.body.id ? Number(req.body.id) : null;
    res.status(id ? 200 : 201).json(await svc.upsertWarning(req.tenant, req.user, req.body, id));
  } catch (e) { next(e); }
});

// ─── DELETE (soft delete) ─────────────────────────────────────────────────

for (const tab of ['production', 'scrap', 'stop', 'warning']) {
  router.delete(`/${tab}/:id`, async (req, res, next) => {
    try {
      const id = intParam(req, 'id');
      res.json(await svc.softDelete(req.tenant, req.user.id, tab, id));
    } catch (e) { next(e); }
  });
}

// ─── Legacy PATCH endpoints (back-compat for the current frontend page) ──

router.patch('/production/:id', async (req, res, next) => {
  try {
    res.json(await svc.updateProductionMine(req.tenant, req.user.id, intParam(req, 'id'), req.body));
  } catch (e) { next(e); }
});
router.patch('/scrap/:id', async (req, res, next) => {
  try {
    res.json(await svc.updateScrapMine(req.tenant, req.user.id, intParam(req, 'id'), req.body));
  } catch (e) { next(e); }
});
router.patch('/stop/:id', async (req, res, next) => {
  try {
    res.json(await svc.updateStopMine(req.tenant, req.user.id, intParam(req, 'id'), req.body));
  } catch (e) { next(e); }
});

module.exports = router;
