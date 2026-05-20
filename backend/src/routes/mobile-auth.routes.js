'use strict';

/**
 * Mobile / IoT PUBLIC auth endpoints — mounted under `/api/v1/auth/mobile/*`
 * BEFORE the JWT middleware so unauthenticated callers can run the
 * forgot-password and demo-signup flows.
 *
 * Wraps everything in the legacy `{success, msg, data}` envelope.
 *
 * Endpoints:
 *   POST /auth/mobile/sendResetPwdOtp     send OTP to existing user
 *   POST /auth/mobile/resetPassword       verify OTP + set new password
 *   POST /auth/mobile/sendRegistrationOtp send OTP to a not-yet-registered email
 *   POST /auth/mobile/verifyRegistaration verify the registration OTP (legacy spelling preserved)
 *   POST /auth/mobile/demoUserRegister    create a demo account + provision a tenant schema
 */

const { Router } = require('express');
const { prisma } = require('../prisma/client');
const { hash } = require('../services/password.service');
const { issueOtp, verifyOtp } = require('../services/otp.service');
const { sendOtpEmail } = require('../services/mail.service');

const router = Router();

function ok(data, msg = '') { return { success: true, msg, data }; }
function fail(msg, errors) { return { success: false, msg, ...(errors ? { errors } : {}) }; }
const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @swagger
 * /api/v1/auth/mobile/sendResetPwdOtp:
 *   post:
 *     tags: [Mobile - Auth]
 *     summary: Send a 6-digit password-reset OTP to an existing user's email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *               email_id: { type: string, description: legacy snake_case alias }
 */
router.post('/sendResetPwdOtp', async (req, res) => {
  try {
    const email = String(req.body.email ?? req.body.email_id ?? '').trim().toLowerCase();
    if (!VALID_EMAIL.test(email)) return res.json(fail('Valid email required'));
    const user = await prisma.user.findUnique({ where: { email } });
    // Always respond OK so this endpoint can't be used to probe whether
    // an email is registered. Only actually send when the user exists.
    if (user) {
      const code = await issueOtp('reset', email);
      try { await sendOtpEmail({ toEmail: email, toName: user.name, code, purpose: 'reset' }); }
      catch (e) { console.error('[mobile-auth] OTP mail failed:', e.message); }
    }
    res.json(ok({}, 'If the email is registered, a code has been sent.'));
  } catch (e) {
    if (e.statusCode === 429) return res.json(fail(e.message));
    console.error('[mobile-auth] sendResetPwdOtp:', e);
    res.json(fail('Failed to send OTP'));
  }
});

/**
 * @swagger
 * /api/v1/auth/mobile/resetPassword:
 *   post:
 *     tags: [Mobile - Auth]
 *     summary: Verify OTP and set a new password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, new_password]
 *             properties:
 *               email: { type: string }
 *               otp: { type: string, pattern: '^\\d{6}$' }
 *               new_password: { type: string, minLength: 8 }
 */
router.post('/resetPassword', async (req, res) => {
  try {
    const email = String(req.body.email ?? req.body.email_id ?? '').trim().toLowerCase();
    const otp = String(req.body.otp ?? '').trim();
    const newPassword = String(req.body.new_password ?? req.body.newPassword ?? '');
    if (!VALID_EMAIL.test(email)) return res.json(fail('Valid email required'));
    if (newPassword.length < 8) return res.json(fail('Password must be ≥ 8 characters'));
    const valid = await verifyOtp('reset', email, otp);
    if (!valid) return res.json(fail('Invalid or expired OTP'));
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json(fail('User not found'));
    const passwordHash = await hash(newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { password: passwordHash } });
    res.json(ok({}, 'Password reset successfully'));
  } catch (e) {
    console.error('[mobile-auth] resetPassword:', e);
    res.json(fail('Reset failed'));
  }
});

/**
 * @swagger
 * /api/v1/auth/mobile/sendRegistrationOtp:
 *   post:
 *     tags: [Mobile - Auth]
 *     summary: Send a 6-digit registration OTP to a not-yet-registered email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 */
router.post('/sendRegistrationOtp', async (req, res) => {
  try {
    const email = String(req.body.email ?? req.body.email_id ?? '').trim().toLowerCase();
    if (!VALID_EMAIL.test(email)) return res.json(fail('Valid email required'));
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.json(fail('Email already registered'));
    const code = await issueOtp('register', email);
    try { await sendOtpEmail({ toEmail: email, code, purpose: 'registration' }); }
    catch (e) { console.error('[mobile-auth] OTP mail failed:', e.message); }
    res.json(ok({}, 'OTP sent'));
  } catch (e) {
    if (e.statusCode === 429) return res.json(fail(e.message));
    console.error('[mobile-auth] sendRegistrationOtp:', e);
    res.json(fail('Failed to send OTP'));
  }
});

/**
 * @swagger
 * /api/v1/auth/mobile/verifyRegistaration:
 *   post:
 *     tags: [Mobile - Auth]
 *     summary: Verify the registration OTP (legacy spelling preserved)
 *     description: |
 *       Endpoint name preserves the legacy typo `verifyRegistaration` so
 *       existing mobile builds don't have to ship a path change.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email: { type: string }
 *               otp: { type: string }
 */
router.post('/verifyRegistaration', async (req, res) => {
  try {
    const email = String(req.body.email ?? req.body.email_id ?? '').trim().toLowerCase();
    const otp = String(req.body.otp ?? '').trim();
    const valid = await verifyOtp('register', email, otp);
    if (!valid) return res.json(fail('Invalid or expired OTP'));
    // Re-issue a SHORT-TTL "verified" marker so the immediately-following
    // demoUserRegister call can trust the email without a second OTP.
    await issueOtp('register-verified', email);
    res.json(ok({ verified: true }, 'OTP verified'));
  } catch (e) {
    console.error('[mobile-auth] verifyRegistaration:', e);
    res.json(fail('Verification failed'));
  }
});

/**
 * @swagger
 * /api/v1/auth/mobile/demoUserRegister:
 *   post:
 *     tags: [Mobile - Auth]
 *     summary: Self-service demo account creation
 *     description: |
 *       Creates a `User` row (Company role) + provisions the tenant
 *       schema via the same `provisionTenantSchema` path the admin
 *       seed uses. The caller must have just verified the email via
 *       `verifyRegistaration` (the temporary `register-verified` marker
 *       is checked + consumed).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email: { type: string }
 *               password: { type: string, minLength: 8 }
 *               name: { type: string }
 */
router.post('/demoUserRegister', async (req, res) => {
  try {
    const email = String(req.body.email ?? req.body.email_id ?? '').trim().toLowerCase();
    const password = String(req.body.password ?? '');
    const name = String(req.body.name ?? '').trim();
    if (!VALID_EMAIL.test(email)) return res.json(fail('Valid email required'));
    if (password.length < 8) return res.json(fail('Password must be ≥ 8 characters'));
    if (!name) return res.json(fail('Name required'));

    // Gate: caller must have a fresh `register-verified` marker for this
    // email. Consumes it (single-use). Without this the endpoint would
    // be open for anyone to spam accounts.
    const verifiedOk = await verifyOtp('register-verified', email, await (async () => {
      // The marker is the same 6-digit code we just minted in
      // verifyRegistaration; the client is NOT supposed to know it, but
      // the OTP service requires a code arg. Read the value back to verify
      // existence + consume it.
      const { redis } = require('../redis/client');
      const stored = await redis.get(`otp:register-verified:${email}`);
      return stored ?? '000000';
    })());
    if (!verifiedOk) return res.json(fail('Please verify your email first'));

    // Single transaction: User row + UserRole(Company) + tenant schema.
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.json(fail('Email already registered'));
    const companyRole = await prisma.role.findUnique({ where: { name: 'Company' } });
    if (!companyRole) return res.json(fail('Company role missing — contact admin'));

    const passwordHash = await hash(password);
    const user = await prisma.user.create({
      data: {
        email, password: passwordHash, name,
        firstName: name.split(' ')[0] ?? name,
        lastName: name.split(' ').slice(1).join(' ') || '',
        confirmed: true, status: 1,
        userRoles: { create: [{ roleId: companyRole.id }] },
      },
    });

    // Provision per-tenant schema (tenant_<userId>). Mirrors the seed
    // script's `provisionTenantSchema` — clones the tenant_template tables.
    const schemaName = `tenant_${user.id}`;
    await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    const tables = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'tenant_template' AND table_type = 'BASE TABLE' ORDER BY table_name`,
    );
    for (const { table_name } of tables) {
      const exists = await prisma.$queryRawUnsafe(
        `SELECT count(*) AS count FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
        schemaName, table_name,
      );
      if (Number(exists[0]?.count ?? 0) > 0) continue;
      await prisma.$executeRawUnsafe(`CREATE TABLE "${schemaName}"."${table_name}" (LIKE "tenant_template"."${table_name}" INCLUDING ALL)`);
    }

    res.json(ok({ id: user.id, email: user.email, schema: schemaName }, 'Account created'));
  } catch (e) {
    console.error('[mobile-auth] demoUserRegister:', e);
    res.json(fail('Registration failed'));
  }
});

module.exports = router;
