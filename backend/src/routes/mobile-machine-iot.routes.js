'use strict';

/**
 * IoT firmware compatibility shim — legacy fpanalyzer semantics for
 * the two endpoints the field units call without a JWT:
 *
 *   POST /api/v1/machine/installV1     "I'm online / restart"
 *   POST /api/v1/machine/saveStopDataV1 "machine stopped at T"
 *
 * Mounted in app.js BEFORE the global JWT authMiddleware so callers
 * that authenticate via `company_email_id` in the request body can
 * reach these without a cookie. JWT callers still work — see iotAuth.
 *
 * All other /api/v1/machine/* endpoints continue to live in
 * mobile-machine.routes.js behind JWT auth.
 */

const { Router } = require('express');
const jwt = require('jsonwebtoken');
const { iotAuth } = require('../middleware/iot-auth');
const { loginRateLimiter } = require('../middleware/rateLimiter');
const { prisma, withTenant } = require('../prisma/client');
const { verify: verifyPassword } = require('../services/password.service');
const iotSvc = require('../services/iot-machine-data.service');

const router = Router();

function ok(data, msg = '') { return { success: true, msg, data }; }
function fail(msg) { return { success: false, msg }; }

function parseTtlToSeconds(ttl) {
  if (/^\d+$/.test(String(ttl))) return Number(ttl);
  const m = String(ttl).match(/^(\d+)\s*([smhd])$/);
  if (!m) return 900;
  return Number(m[1]) * ({ s: 1, m: 60, h: 3600, d: 86400 }[m[2]] ?? 1);
}

/**
 * @swagger
 * /api/v1/machine/installV1:
 *   post:
 *     tags: [Mobile - Machine]
 *     summary: IoT install / restart signal (legacy fpanalyzer flow)
 *     description: |
 *       Field-firmware "I'm online" call. Authenticates via either a
 *       JWT (cookie/bearer) OR the legacy `company_email_id` body field
 *       — the Company-role user that owns the tenant schema.
 *
 *       Behaviour mirrors the Laravel `MachineController@installV1`:
 *         - find machine by `machine_id`; fallback to (pin_no + unit_name)
 *         - if neither exists → INSERT a fresh unconfigured machines row
 *         - if found AND configured AND both start_time + end_time given
 *           → treat as a stop-end / restart, close out the open
 *           machine_data row + write `machine_status='on'`
 *         - otherwise → flip `running_status='on'`, refresh `last_online`
 *
 *       Filter-time queue debounce intentionally not ported (firmware
 *       handles it locally now).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pin_no, unit_name, company_email_id]
 *             properties:
 *               company_email_id:
 *                 type: string
 *                 description: Company-owner email (resolves to tenant_${id}). Use volvo123@gmail.com for the Volvo tenant.
 *                 example: "volvo123@gmail.com"
 *               pin_no:
 *                 type: integer
 *                 description: IoT board pin. For Volvo, pin 1 = Montering Input (machine_id 9).
 *                 example: 1
 *               unit_name:
 *                 type: string
 *                 description: Display name for the unit. Must match exactly when used to look up an existing row.
 *                 example: "Montering Input - 1"
 *               bluetooth_id: { type: string, example: "*" }
 *               wifi_id:      { type: string, example: "*" }
 *               machine_id:
 *                 type: integer
 *                 description: Existing machine id. For Volvo, use 9 (Montering Input - 1, equipment 76).
 *                 example: 9
 *               start_time:
 *                 type: string
 *                 description: Stop start time (only used when end_time is also supplied — restart signal).
 *                 example: "2026-05-18 11:33:47"
 *               end_time:
 *                 type: string
 *                 description: Stop end time. Presence triggers the restart / close-out flow.
 *                 example: "2026-05-18 11:45:00"
 *           examples:
 *             volvoHeartbeat:
 *               summary: Volvo — plain heartbeat (machine already enrolled)
 *               value:
 *                 company_email_id: "volvo123@gmail.com"
 *                 machine_id: 9
 *                 pin_no: 1
 *                 unit_name: "Montering Input - 1"
 *                 bluetooth_id: "*"
 *                 wifi_id: "*"
 *             volvoRestart:
 *               summary: Volvo — restart / close out an open stop
 *               value:
 *                 company_email_id: "volvo123@gmail.com"
 *                 machine_id: 9
 *                 pin_no: 1
 *                 unit_name: "Montering Input - 1"
 *                 bluetooth_id: "*"
 *                 wifi_id: "*"
 *                 start_time: "2026-05-18 11:33:47"
 *                 end_time: "2026-05-18 11:45:00"
 *             volvoEnrollNew:
 *               summary: Volvo — enroll a brand-new unit (no matching pin_no + unit_name)
 *               value:
 *                 company_email_id: "volvo123@gmail.com"
 *                 pin_no: 99
 *                 unit_name: "Biglia_2.0_test"
 *                 bluetooth_id: "*"
 *                 wifi_id: "*"
 *     responses:
 *       200:
 *         description: Legacy `{success,msg,data}` envelope
 */
router.post('/installV1', iotAuth, async (req, res) => {
  try {
    const result = await iotSvc.installMachine(req.tenant, req.body);
    res.json(ok(result.data, result.action));
  } catch (e) {
    res.json(fail(e.message ?? 'install failed'));
  }
});

/**
 * @swagger
 * /api/v1/machine/saveStopDataV1:
 *   post:
 *     tags: [Mobile - Machine]
 *     summary: IoT stop-start signal (legacy fpanalyzer flow)
 *     description: |
 *       Records the START of a stop. Only `start_time` is required;
 *       the matching end_time arrives later via `installV1`.
 *
 *       Mirrors `MachineController@saveStopDataV1`:
 *         - refresh `unit_connected='yes'`
 *         - reject if machine has no equipment_id (returns
 *           "Machine not configured")
 *         - long-stop suppression: if machine_status is already 'off',
 *           skip the insert + return early
 *         - else upsert machine_status (off, time=start_time) and
 *           INSERT a machine_data row (start_time only)
 *         - flip machines.running_status='off', has_unregister_data='yes'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [machine_id, start_time, company_email_id]
 *             properties:
 *               company_email_id:
 *                 type: string
 *                 description: Company-owner email (resolves to tenant_${id}). Use volvo123@gmail.com for the Volvo tenant.
 *                 example: "volvo123@gmail.com"
 *               machine_id:
 *                 type: integer
 *                 description: Existing machine id. For Volvo, use 9 (Montering Input - 1, equipment 76).
 *                 example: 9
 *               start_time:
 *                 type: string
 *                 description: Stop start timestamp.
 *                 example: "2026-05-18 11:33:47"
 *           examples:
 *             volvoStopStart:
 *               summary: Volvo — stop start on Montering Input - 1
 *               value:
 *                 company_email_id: "volvo123@gmail.com"
 *                 machine_id: 9
 *                 start_time: "2026-05-18 11:33:47"
 *             volvoStopStartLater:
 *               summary: Volvo — stop start a few minutes later (triggers long-stop suppression if prior stop still open)
 *               value:
 *                 company_email_id: "volvo123@gmail.com"
 *                 machine_id: 9
 *                 start_time: "2026-05-18 11:35:00"
 *     responses:
 *       200:
 *         description: Legacy `{success,msg,data}` envelope
 */
router.post('/saveStopDataV1', iotAuth, async (req, res) => {
  try {
    const result = await iotSvc.saveStopStart(req.tenant, req.body);
    // saveStopStart already returns the legacy envelope.
    res.json(result);
  } catch (e) {
    res.json(fail(e.message ?? 'saveStopData failed'));
  }
});

// ── Machine / IoT login ───────────────────────────────────────────────────────
/**
 * @swagger
 * /api/v1/machine/login:
 *   post:
 *     tags: [Mobile - Machine]
 *     summary: Legacy machine/IoT login — mirrors Laravel MachineController@login
 *     description: |
 *       Returns the full user object in the legacy {success,msg,data} envelope
 *       AND sets an HTTP-only JWT cookie so the firmware can authenticate
 *       subsequent requests without re-sending credentials.
 *
 *       Old mobile builds and IoT firmware that pre-date the /auth/login JWT
 *       flow use this endpoint. Credentials are verified against the master
 *       users table (bcrypt). Rate-limited to prevent brute force.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Legacy {success,msg,data} envelope with user object + JWT cookie
 */
router.post('/login', loginRateLimiter, async (req, res) => {
  try {
    const email = String(req.body.email ?? '').trim();
    const password = String(req.body.password ?? '').trim();
    if (!email || !password) return res.json(fail('Required fields not satisfied'));

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
      select: {
        id: true, companyId: true, name: true, firstName: true, lastName: true,
        email: true, image: true, password: true, status: true,
        createdAt: true, updatedAt: true,
        userRoles: { select: { role: { select: { name: true } } } },
      },
    });

    if (!user || !user.password) return res.json(fail('Invalid login'));

    const { ok: pwOk } = await verifyPassword(password, user.password);
    if (!pwOk) return res.json(fail('Invalid login'));
    if (user.status !== 1) return res.json(fail('Invalid login'));

    // Look up the company name (parent Company user if this is a sub-user).
    let companyName = user.name;
    if (user.companyId > 0) {
      const parent = await prisma.user.findFirst({
        where: { id: user.companyId },
        select: { name: true },
      });
      companyName = parent?.name ?? '';
    }

    // Issue JWT + set cookie so subsequent IoT calls carry it.
    const roles = user.userRoles.map((ur) => ur.role.name);
    const ttl = process.env.JWT_ACCESS_TTL || '15m';
    const expiresIn = parseTtlToSeconds(ttl);
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, roles, kind: 'web' },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: ttl },
    );
    const domain = process.env.COOKIE_DOMAIN || undefined;
    res.cookie('access_token', accessToken, {
      httpOnly: true, sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/', maxAge: expiresIn * 1000,
      ...(domain ? { domain } : {}),
    });

    return res.json(ok({
      id: user.id,
      company_id: user.companyId || null,
      name: user.name,
      first_name: user.firstName,
      last_name: user.lastName,
      email: user.email,
      image: user.image,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      company_name: companyName,
    }, 'Successfully logined'));
  } catch (e) {
    res.json(fail(e.message ?? 'Login failed'));
  }
});

// ── Update unit connection status ─────────────────────────────────────────────
/**
 * @swagger
 * /api/v1/machine/updateUnitConnectionStatus:
 *   post:
 *     tags: [Mobile - Machine]
 *     summary: Mark a machine connected and refresh last_online
 *     description: |
 *       Mirrors Laravel MachineController@updateUnitConnectionStatus.
 *
 *       **Authentication — two modes:**
 *
 *       **(a) JWT (cookie or Bearer) + machine_id** — for web/mobile callers already
 *       logged in. Company-role users resolve the tenant automatically from their JWT.
 *       Sub-users (User role) resolve via their `companyId`. Administrator/SuperAdmin
 *       users **must** also supply the `X-Tenant-Id` header (the Company user's id,
 *       e.g. 9 for the Volvo tenant) — without it the call returns an error.
 *
 *       **(b) company_email_id + unit_name** — legacy IoT firmware style. No JWT
 *       needed. The backend resolves the tenant from the Company-role user whose
 *       email matches `company_email_id`.
 *
 *       Sets `unit_connected` and `last_online = NOW()` using parameterised queries
 *       (no SQL injection). Works for both configured and unconfigured machines.
 *
 *       **How to test in Swagger UI:**
 *       1. Call `POST /api/v1/machine/login` (or `POST /api/v1/auth/login`) with your
 *          credentials — the response sets the `access_token` cookie on this domain.
 *       2. Click **Authorize** (top-right) and paste the same token as a Bearer value.
 *       3. If you are a SuperAdmin, also enter the Company user's id in the
 *          `X-Tenant-Id` field of the Authorize dialog or in the header parameter below.
 *     security:
 *       - access_token: []
 *       - bearer: []
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Id
 *         schema:
 *           type: integer
 *         required: false
 *         description: |
 *           Company user id that identifies the tenant schema (`tenant_<id>`).
 *           **Required when calling as Administrator/SuperAdmin** (JWT roles include
 *           "Administrator"). Ignored for Company-role and User-role JWT callers.
 *           Example: 9 (Volvo tenant).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               company_email_id:
 *                 type: string
 *                 description: Company-owner email (IoT firmware / no-JWT path). Use volvo123@gmail.com for the Volvo tenant.
 *                 example: "volvo123@gmail.com"
 *               unit_name:
 *                 type: string
 *                 description: Machine unit_name (used when no machine_id provided, or on the legacy no-JWT path).
 *                 example: "Montering Input - 1"
 *               machine_id:
 *                 type: integer
 *                 description: Machine id (JWT path). For Volvo, machine_id 9 = "Montering Input - 1".
 *                 example: 9
 *               unit_connected:
 *                 type: string
 *                 enum: [yes, no]
 *                 default: "yes"
 *                 description: Connection state to persist.
 *           examples:
 *             jwtCompanyUser:
 *               summary: "JWT (Company user) + machine_id — no extra header needed"
 *               value:
 *                 machine_id: 9
 *                 unit_connected: "yes"
 *             jwtAdminWithHeader:
 *               summary: "JWT (SuperAdmin) + machine_id — requires X-Tenant-Id header set to 9"
 *               value:
 *                 machine_id: 9
 *                 unit_connected: "yes"
 *             legacyIoT:
 *               summary: "Legacy IoT — company_email_id + unit_name, no JWT"
 *               value:
 *                 company_email_id: "volvo123@gmail.com"
 *                 unit_name: "Montering Input - 1"
 *                 unit_connected: "yes"
 *     responses:
 *       200:
 *         description: Success or error in the legacy {success, msg} envelope
 *         content:
 *           application/json:
 *             examples:
 *               success:
 *                 value: { success: true, msg: "updated successfully" }
 *               missingFields:
 *                 value: { success: false, msg: "Required fields not satisfied" }
 *               invalidLogin:
 *                 value: { success: false, msg: "Invalid login" }
 *               adminMissingHeader:
 *                 value: { success: false, msg: "X-Tenant-Id header required for admin/superadmin calls, or include company_email_id in the request body" }
 */
router.post('/updateUnitConnectionStatus', iotAuth, async (req, res) => {
  try {
    const unitName  = String(req.body.unit_name  ?? '').trim();
    const machineId = Number(req.body.machine_id) || 0;
    const conn = req.body.unit_connected === 'no' ? 'no' : 'yes';

    if (!unitName && !machineId) {
      return res.json(fail('Required fields not satisfied'));
    }

    const affected = await withTenant(req.tenant, (tx) => {
      if (unitName) {
        return tx.$executeRawUnsafe(
          `UPDATE machines SET unit_connected = $1, last_online = NOW(), updated_at = NOW()
           WHERE unit_name = $2`,
          conn, unitName,
        );
      }
      return tx.$executeRawUnsafe(
        `UPDATE machines SET unit_connected = $1, last_online = NOW(), updated_at = NOW()
         WHERE id = $2`,
        conn, machineId,
      );
    });

    if (affected === 0) {
      return res.json(fail('Machine not found'));
    }
    return res.json({ success: true, msg: 'updated successfully' });
  } catch (e) {
    res.json(fail(e.message ?? 'update failed'));
  }
});

module.exports = router;
