'use strict';

const { Router } = require('express');
const { prisma } = require('../prisma/client');
const { NotFoundError, BadRequestError, UnauthorizedError } = require('../errors');
const passwordService = require('../services/password.service');

const router = Router();

/**
 * GET /api/v1/me — the authenticated user's profile + permissions.
 *
 * Post Tenant-removal:
 *   - `activeTenantId` is now the Company user's id (= self for role=Company,
 *     = companyId for role=User, null for Administrator). The field name is
 *     preserved per TENANT_REMOVAL decision 4 so the ~35 frontend pages that
 *     read it keep working without a rename.
 *   - `tenants[]` array is dropped — there is no Tenant table to derive it from.
 *     Frontend pages that used it for a tenant picker now show the company
 *     name from `user.name` (for role=Company) or look up the parent company.
 */
/**
 * @swagger
 * /api/v1/me:
 *   get:
 *     tags: ["Me"]
 *     summary: GET /
 *     security:
 *       - access_token: []
 *     responses:
 *       200: { description: OK }
 */
router.get('/', async (req, res, next) => {
  try {
    const authUser = req.user;
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: {
        userRoles: {
          include: {
            role: {
              select: {
                name: true, all: true,
                rolePermissions: { include: { permission: { select: { name: true } } } },
              },
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundError('user-not-found');

    const isSuperAdmin = user.userRoles.some((ur) => ur.role.all);
    const permissionSet = new Set();
    for (const ur of user.userRoles) {
      for (const rp of ur.role.rolePermissions) permissionSet.add(rp.permission.name);
    }
    let permissions = Array.from(permissionSet).sort();
    if (isSuperAdmin) {
      const all = await prisma.permission.findMany({ select: { name: true }, orderBy: { sort: 'asc' } });
      permissions = all.map((p) => p.name);
    }

    const roleNames = user.userRoles.map((ur) => ur.role.name);
    const activeTenantId =
      roleNames.includes('Administrator') ? null
        : roleNames.includes('Company') ? user.id
          : roleNames.includes('User') ? (user.companyId || null)
            : null;

    let impersonator = null;
    if (authUser.impersonatorId) {
      const su = await prisma.user.findUnique({
        where: { id: authUser.impersonatorId },
        select: { id: true, name: true, email: true },
      });
      if (su) impersonator = su;
    }

    // For the frontend's tenant picker compatibility we synthesise a single-row
    // "tenants" array for Company users (themselves) and sub-users (their parent
    // Company). Administrators get an empty array; Super Admin picks a Company
    // user via the user-management page now.
    let tenants = [];
    if (activeTenantId) {
      const companyUser = await prisma.user.findUnique({
        where: { id: activeTenantId },
        select: { id: true, name: true, timezone: true, status: true },
      });
      if (companyUser) {
        tenants = [{
          id: companyUser.id,
          slug: String(companyUser.id),
          name: companyUser.name,
          schemaName: `tenant_${companyUser.id}`,
          timezone: companyUser.timezone || 'Europe/Stockholm',
          status: companyUser.status === 1 ? 'active' : 'suspended',
        }];
      }
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      image: user.image,
      confirmed: user.confirmed,
      activeTenantId,
      isAdmin: isSuperAdmin,
      roles: roleNames,
      permissions,
      tenants,
      // Per-user UI preferences (units hidden/order, table column visibility,
      // etc.) — frontend reads this to filter+order the /units list and the
      // dashboard Settings tab. Updated via POST /me/settings/table.
      tablePreferences: user.tablePreferences ?? {},
      impersonatorId: authUser.impersonatorId ?? null,
      impersonator,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/me/settings/table ─────────────────────────────────────────
//
// Generic merge into User.tablePreferences JSON. Body shape:
//   { key: string, subKey?: string|null, data: any }
// If subKey is omitted/empty: tablePreferences[key] = data
// Else:                       tablePreferences[key][subKey] = data
//
// Replaces the legacy /saveTableSettings AJAX. Used by:
//   - My Result tab strip drag-sort      (key=tap_setting, subKey=myresult)
//   - Stop tab "show also excluded"      (key=exclude_type, subKey=stop)
//   - Per-tab show_my_entries / columns  (key=ru_*_data, subKey=show_my_entries|…)
//   - Units list hidden + sort order     (key=unit_web_settings|order)

/**
 * @swagger
 * /api/v1/me/settings/table:
 *   post:
 *     tags: ["Me"]
 *     summary: POST /settings/table
 *     security: [{ access_token: [] }]
 *     responses: { 200: { description: OK } }
 */
router.post('/settings/table', async (req, res, next) => {
  try {
    const body = req.body || {};
    const key = String(body.key || '').trim();
    if (!key) {
      return res.status(400).json({ statusCode: 400, message: 'key-required' });
    }
    const subKey = body.subKey == null ? '' : String(body.subKey);
    const data = body.data;

    const u = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { tablePreferences: true },
    });
    const cur = (u && u.tablePreferences) || {};
    if (subKey === '') {
      cur[key] = data;
    } else {
      cur[key] = { ...(cur[key] || {}), [subKey]: data };
    }
    await prisma.user.update({ where: { id: req.user.id }, data: { tablePreferences: cur } });
    res.json({ ok: true, tablePreferences: cur });
  } catch (err) { next(err); }
});

// ─── PATCH /api/v1/me ─────────────────────────────────────────────────────
//
// Self-update for the authenticated user. Allowed fields:
//   name, firstName, lastName, email, image, timezone, fcmToken, fcmDevice
// Everything else (status, roles, companyId, password) is ignored — those
// require the admin/users endpoints.
//
// Email uniqueness is enforced; conflicts return 409.

/**
 * @swagger
 * /api/v1/me:
 *   patch:
 *     tags: ["Me"]
 *     summary: Self-update profile fields (name, email, etc.)
 *     security: [{ access_token: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.patch('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    const allowed = ['name', 'firstName', 'lastName', 'email', 'image', 'timezone', 'fcmToken', 'fcmDevice'];
    const data = {};
    for (const k of allowed) {
      if (b[k] !== undefined) data[k] = b[k];
    }
    if (typeof data.email === 'string') data.email = data.email.trim();
    if (Object.keys(data).length === 0) {
      throw new BadRequestError('no-fields-to-update');
    }
    if (data.email) {
      const dup = await prisma.user.findFirst({
        where: { email: data.email, NOT: { id: req.user.id }, deletedAt: null },
        select: { id: true },
      });
      if (dup) return res.status(409).json({ statusCode: 409, message: 'email-already-in-use' });
    }
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true, email: true, name: true, firstName: true, lastName: true,
        image: true, timezone: true,
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// ─── POST /api/v1/me/password ─────────────────────────────────────────────
//
// Change own password. Body: { currentPassword, newPassword }.
// Verifies the current password against the stored hash before rotating.

/**
 * @swagger
 * /api/v1/me/password:
 *   post:
 *     tags: ["Me"]
 *     summary: Change own password (requires current password)
 *     security: [{ access_token: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post('/password', async (req, res, next) => {
  try {
    const cur = String(req.body?.currentPassword ?? req.body?.current_password ?? '').trim();
    const next = String(req.body?.newPassword ?? req.body?.new_password ?? '').trim();
    if (!cur || !next) throw new BadRequestError('current-and-new-password-required');
    if (next.length < 8) throw new BadRequestError('password-too-short');

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, password: true },
    });
    if (!user) throw new NotFoundError('user-not-found');

    const { ok } = await passwordService.verify(cur, user.password);
    if (!ok) throw new UnauthorizedError('current-password-incorrect');

    const hashed = await passwordService.hash(next);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
