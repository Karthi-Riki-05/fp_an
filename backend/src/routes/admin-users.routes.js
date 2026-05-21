'use strict';

const { Router } = require('express');
const { tenantMiddleware, softTenantMiddleware } = require('../middleware/tenant');
const { requirePermission } = require('../middleware/requirePermission');
const { requireRole } = require('../middleware/requireRole');
const svc = require('../services/admin-users.service');
const authSvc = require('../services/auth.service');

const ACCESS_COOKIE = 'access_token';
function cookieOpts(maxAgeSeconds) {
  const domain = process.env.COOKIE_DOMAIN || undefined;
  return { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: maxAgeSeconds * 1000, ...(domain ? { domain } : {}) };
}

const router = Router();

// All routes require manage-users permission. GET/PATCH/DELETE routes require a
// resolved tenant context (X-Tenant-Id for Administrator). POST uses
// softTenantMiddleware so Company creation works without a pre-existing tenant.
router.use(requirePermission('manage-users'));

// GET /summary — column stats for DataTable summary row (Section B.6)
/**
 * @swagger
 * /api/v1/admin/users/summary:
 *   get:
 *     tags: ["Admin — Users"]
 *     summary: GET /summary
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/summary', tenantMiddleware, async (req, res, next) => {
  try {
    const q = {
      type: req.query.type,
      columns: req.query.columns ? String(req.query.columns).split(',') : undefined,
    };
    res.json(await svc.summary(req.tenant, q));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     tags: ["Admin — Users"]
 *     summary: GET /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/', tenantMiddleware, async (req, res, next) => {
  try {
    const filters = [];
    // Support ?filters[0][column]=name&filters[0][operator]=contains&filters[0][value]=foo
    if (req.query.filters && typeof req.query.filters === 'object') {
      for (const f of Object.values(req.query.filters)) {
        if (f && typeof f === 'object') filters.push(f);
      }
    }
    const q = {
      page: req.query.page ? Number(req.query.page) : undefined,
      perPage: req.query.perPage ? Number(req.query.perPage) : undefined,
      search: req.query.search,
      name: req.query.name,
      email: req.query.email,
      confirmed: req.query.confirmed,
      active: req.query.active,
      sort: req.query.sort,
      order: req.query.order,
      filters,
    };
    res.json(await svc.list(req.tenant, q));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/users/deactivated:
 *   get:
 *     tags: ["Admin — Users"]
 *     summary: GET /deactivated
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/deactivated', tenantMiddleware, async (req, res, next) => {
  try {
    const q = {
      page: req.query.page ? Number(req.query.page) : undefined,
      perPage: req.query.perPage ? Number(req.query.perPage) : undefined,
      search: req.query.search,
      active: 'false',
    };
    res.json(await svc.list(req.tenant, q));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/users/deleted:
 *   get:
 *     tags: ["Admin — Users"]
 *     summary: GET /deleted
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/deleted', tenantMiddleware, async (req, res, next) => {
  try {
    const q = {
      page: req.query.page ? Number(req.query.page) : undefined,
      perPage: req.query.perPage ? Number(req.query.perPage) : undefined,
      search: req.query.search,
    };
    res.json(await svc.listDeleted(req.tenant, q));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   get:
 *     tags: ["Admin — Users"]
 *     summary: GET /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id', tenantMiddleware, async (req, res, next) => {
  try { res.json(await svc.findOne(req.tenant, Number(req.params.id))); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/users:
 *   post:
 *     tags: ["Admin — Users"]
 *     summary: POST /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.post('/', softTenantMiddleware, async (req, res, next) => {
  try {
    res.status(201).json(await svc.create(req.tenant, req.user, req.body));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   patch:
 *     tags: ["Admin — Users"]
 *     summary: PATCH /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/:id', tenantMiddleware, async (req, res, next) => {
  try { res.json(await svc.update(req.tenant, req.user, Number(req.params.id), req.body)); } catch (err) { next(err); }
});

// DELETE /:id — soft delete by default; ?permanent=true does hard delete (only if already soft-deleted)
/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   delete:
 *     tags: ["Admin — Users"]
 *     summary: DELETE /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/:id', tenantMiddleware, async (req, res, next) => {
  try {
    if (req.query.permanent === 'true') {
      await svc.permanentDelete(req.tenant, req.user, Number(req.params.id));
    } else {
      await svc.softDelete(req.tenant, req.user, Number(req.params.id));
    }
    res.status(204).send();
  } catch (err) { next(err); }
});

// Keep legacy route for backward compatibility
/**
 * @swagger
 * /api/v1/admin/users/{id}/permanent:
 *   delete:
 *     tags: ["Admin — Users"]
 *     summary: DELETE /:id/permanent
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/:id/permanent', tenantMiddleware, async (req, res, next) => {
  try { await svc.permanentDelete(req.tenant, req.user, Number(req.params.id)); res.status(204).send(); } catch (err) { next(err); }
});

// PATCH /:id/status — accepts { status: 1|0 } or { active: true|false }
/**
 * @swagger
 * /api/v1/admin/users/{id}/status:
 *   patch:
 *     tags: ["Admin — Users"]
 *     summary: PATCH /:id/status
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/:id/status', tenantMiddleware, async (req, res, next) => {
  try {
    const active = req.body.active !== undefined ? !!req.body.active : req.body.status === 1;
    res.json(await svc.toggleStatus(req.tenant, req.user, Number(req.params.id), active));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/users/{id}/confirm:
 *   patch:
 *     tags: ["Admin — Users"]
 *     summary: PATCH /:id/confirm
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/:id/confirm', tenantMiddleware, async (req, res, next) => {
  try { res.json(await svc.toggleConfirm(req.tenant, req.user, Number(req.params.id), !!req.body.confirmed)); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/users/{id}/password:
 *   post:
 *     tags: ["Admin — Users"]
 *     summary: POST /:id/password
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.post('/:id/password', tenantMiddleware, async (req, res, next) => {
  try { res.json(await svc.changePassword(req.tenant, req.user, Number(req.params.id), req.body.password)); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/users/{id}/restore:
 *   post:
 *     tags: ["Admin — Users"]
 *     summary: POST /:id/restore
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.post('/:id/restore', tenantMiddleware, async (req, res, next) => {
  try { res.json(await svc.restore(req.tenant, req.user, Number(req.params.id))); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/users/{id}/confirm/resend:
 *   post:
 *     tags: ["Admin — Users"]
 *     summary: POST /:id/confirm/resend
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.post('/:id/confirm/resend', tenantMiddleware, async (req, res, next) => {
  try { res.status(202).json(await svc.resendConfirmation(req.tenant, req.user, Number(req.params.id))); } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/admin/users/{id}/impersonate:
 *   post:
 *     tags: ["Admin — Users"]
 *     summary: POST /:id/impersonate
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.post('/:id/impersonate', requireRole('Administrator'), requirePermission('impersonate-users'), async (req, res, next) => {
  try {
    const result = await authSvc.issueImpersonationToken({ targetUserId: Number(req.params.id), impersonatorUserId: req.user.id });
    res.cookie(ACCESS_COOKIE, result.accessToken, cookieOpts(result.expiresIn));
    await svc.recordImpersonateStart(req.user, Number(req.params.id));
    res.status(201).json({ user: result.user, expiresIn: result.expiresIn });
  } catch (err) { next(err); }
});

module.exports = router;
