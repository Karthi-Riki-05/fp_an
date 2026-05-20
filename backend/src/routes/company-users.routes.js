'use strict';

/**
 * Company-Admin sub-user management. Mirrors legacy /admin/company/useradd
 * and /admin/company/useredit.
 *
 *   - Caller MUST hold the Company role (requireRole gates the whole router).
 *   - companyId on the created/updated user is FORCED to the caller's id
 *     (req.user.id). Any client-supplied companyId is ignored.
 *   - Roles assignable here are User and Admin only. Company / Administrator
 *     are rejected.
 *   - No schema provisioning ever happens through this router.
 *
 * The list/read/update/delete handlers delegate to admin-users.service
 * because companyMembershipFilter already scopes by tenant.tenantId (which
 * tenantMiddleware sets to user.id for Company callers).
 */

const { Router } = require('express');
const { tenantMiddleware } = require('../middleware/tenant');
const { requireRole } = require('../middleware/requireRole');
const svc = require('../services/admin-users.service');
const { BadRequestError } = require('../errors');

const router = Router();

router.use(tenantMiddleware, requireRole('Company'));

const ALLOWED_ROLES = new Set(['User', 'Admin']);

function sanitizeRoles(roles) {
  if (!Array.isArray(roles) || roles.length === 0) return ['User'];
  for (const r of roles) {
    if (!ALLOWED_ROLES.has(r)) {
      throw new BadRequestError(`role-not-assignable-by-company-admin: ${r}`);
    }
  }
  return roles;
}

function mapLegacyRoleId(roleId) {
  // Legacy radio: 3 = User, 2 = Admin
  const n = Number(roleId);
  if (n === 2) return 'Admin';
  return 'User';
}

/**
 * @swagger
 * /api/v1/company/users:
 *   get:
 *     tags: ["Company Users"]
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
      email: req.query.email,
      confirmed: req.query.confirmed,
      active: req.query.active,
      sort: req.query.sort,
      order: req.query.order,
    };
    res.json(await svc.list(req.tenant, q));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/company/users/{id}:
 *   get:
 *     tags: ["Company Users"]
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
 * /api/v1/company/users:
 *   post:
 *     tags: ["Company Users"]
 *     summary: POST /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    let roles;
    if (body.roles !== undefined) {
      roles = sanitizeRoles(body.roles);
    } else if (body.roleId !== undefined) {
      roles = [mapLegacyRoleId(body.roleId)];
    } else {
      roles = ['User'];
    }

    const dto = {
      firstName: body.firstName,
      lastName: body.lastName,
      name: body.name ?? `${body.firstName ?? ''} ${body.lastName ?? ''}`.trim(),
      email: body.email,
      password: body.password,
      confirmed: body.confirmed === true || body.confirmed === '1' || body.confirmed === 1,
      active: body.active !== false && body.status !== 0,
      sendConfirmationEmail: body.sendConfirmationEmail === true,
      sessionTimeout: body.sessionTimeout,
      timezone: body.timezone,
      roles,
      companyId: req.user.id, // forced — caller IS the Company user
    };

    if (!dto.email) throw new BadRequestError('email-required');
    if (!dto.password) throw new BadRequestError('password-required');
    if (!dto.firstName && !dto.name) throw new BadRequestError('first-name-required');

    res.status(201).json(await svc.create(req.tenant, req.user, dto));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/company/users/{id}:
 *   patch:
 *     tags: ["Company Users"]
 *     summary: PATCH /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const body = req.body || {};
    const dto = { ...body };
    if (dto.companyId !== undefined) delete dto.companyId;
    if (dto.roles !== undefined) dto.roles = sanitizeRoles(dto.roles);
    else if (dto.roleId !== undefined) {
      dto.roles = [mapLegacyRoleId(dto.roleId)];
      delete dto.roleId;
    }
    res.json(await svc.update(req.tenant, req.user, Number(req.params.id), dto));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/company/users/{id}:
 *   delete:
 *     tags: ["Company Users"]
 *     summary: DELETE /:id
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await svc.softDelete(req.tenant, req.user, Number(req.params.id));
    res.status(204).send();
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/company/users/{id}/status:
 *   patch:
 *     tags: ["Company Users"]
 *     summary: PATCH /:id/status
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/:id/status', async (req, res, next) => {
  try {
    const active = req.body.active !== undefined ? !!req.body.active : req.body.status === 1;
    res.json(await svc.toggleStatus(req.tenant, req.user, Number(req.params.id), active));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/company/users/{id}/confirm:
 *   patch:
 *     tags: ["Company Users"]
 *     summary: PATCH /:id/confirm
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/:id/confirm', async (req, res, next) => {
  try {
    res.json(await svc.toggleConfirm(req.tenant, req.user, Number(req.params.id), !!req.body.confirmed));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/company/users/{id}/password:
 *   post:
 *     tags: ["Company Users"]
 *     summary: POST /:id/password
 *     security:
 *       - access_token: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.post('/:id/password', async (req, res, next) => {
  try {
    res.json(await svc.changePassword(req.tenant, req.user, Number(req.params.id), req.body.password));
  } catch (err) { next(err); }
});

module.exports = router;
