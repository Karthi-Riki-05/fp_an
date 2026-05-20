'use strict';

const { Router } = require('express');
const { loginRateLimiter } = require('../middleware/rateLimiter');
const { authMiddleware } = require('../middleware/auth');
const { login, issueImpersonationToken, stopImpersonation } = require('../services/auth.service');
const { verify: verifyPassword } = require('../services/password.service');
const { prisma } = require('../prisma/client');
const { BadRequestError, UnauthorizedError, NotFoundError } = require('../errors');
const { sendConfirmationEmail } = require('../services/mail.service');
const { randomUUID } = require('crypto');
const adminUsersSvc = require('../services/admin-users.service');

const ACCESS_COOKIE = 'access_token';

function cookieOpts(maxAgeSeconds) {
  const domain = process.env.COOKIE_DOMAIN || undefined;
  return { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: maxAgeSeconds * 1000, ...(domain ? { domain } : {}) };
}

function clearCookieOpts() {
  const domain = process.env.COOKIE_DOMAIN || undefined;
  return { path: '/', ...(domain ? { domain } : {}) };
}

const router = Router();

// POST /auth/login
/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Email + password login. Sets `access_token` HTTP-only cookie.
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
 *       200: { description: Logged in }
 *       401: { description: Invalid credentials }
 */
router.post('/login', loginRateLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ statusCode: 400, message: 'email and password are required' });
    const result = await login(email, password);
    // Reset throttle bucket on successful login so a user who mistyped
    // a password up to (limit-1) times isn't locked out immediately after.
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    loginRateLimiter.resetKey?.(ip);
    res.cookie(ACCESS_COOKIE, result.accessToken, cookieOpts(result.expiresIn));
    res.json({ user: result.user, expiresIn: result.expiresIn });
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout
/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Clear the `access_token` cookie.
 *     responses:
 *       200: { description: OK }
 */
router.post('/logout', (req, res) => {
  res.clearCookie(ACCESS_COOKIE, clearCookieOpts());
  res.status(204).send();
});

// POST /auth/impersonate/stop — requires auth + active impersonation token
/**
 * @swagger
 * /api/v1/auth/impersonate/stop:
 *   post:
 *     tags: [Auth]
 *     summary: Drop an active impersonation and return to the super-admin session.
 *     security:
 *       - access_token: []
 */
router.post('/impersonate/stop', authMiddleware, async (req, res, next) => {
  try {
    const actor = req.user;
    if (!actor.impersonatorId) throw new BadRequestError('not-impersonating');
    const result = await stopImpersonation(actor.impersonatorId);
    res.cookie(ACCESS_COOKIE, result.accessToken, cookieOpts(result.expiresIn));
    await adminUsersSvc.recordImpersonateStop(actor, actor.impersonatorId);
    res.json({ user: result.user, expiresIn: result.expiresIn });
  } catch (err) {
    next(err);
  }
});

// GET /auth/confirm/:token — confirm account via email link
/**
 * @swagger
 * /api/v1/auth/confirm/{token}:
 *   get:
 *     tags: [Auth]
 *     summary: Confirm a newly-created account using the emailed token.
 *     parameters:
 *       - { in: path, name: token, required: true, schema: { type: string } }
 */
router.get('/confirm/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token) throw new BadRequestError('token-required');
    const user = await prisma.user.findFirst({
      where: { confirmationCode: token, deletedAt: null },
      select: { id: true, email: true },
    });
    if (!user) throw new NotFoundError('invalid_or_expired_token');
    await prisma.user.update({ where: { id: user.id }, data: { confirmed: true, confirmationCode: '' } });
    res.json({ ok: true, message: 'Account confirmed. You can now log in.' });
  } catch (err) {
    next(err);
  }
});

// POST /auth/confirm/resend — resend confirmation email
/**
 * @swagger
 * /api/v1/auth/confirm/resend:
 *   post:
 *     tags: [Auth]
 *     summary: Resend the account-confirmation email.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, format: email }
 */
router.post('/confirm/resend', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw new BadRequestError('email-required');
    const user = await prisma.user.findFirst({
      where: { email: String(email).toLowerCase(), confirmed: false, deletedAt: null },
      select: { id: true, email: true, name: true },
    });
    // Return 202 regardless of whether the email exists (don't leak user existence)
    if (user) {
      const code = randomUUID();
      await prisma.user.update({ where: { id: user.id }, data: { confirmationCode: code } });
      const confirmUrl = `${process.env.APP_URL}/account/confirm/${code}`;
      sendConfirmationEmail({ toEmail: user.email, toName: user.name, confirmUrl })
        .catch((err) => console.error('resend confirmation email failed:', err.message));
    }
    res.status(202).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /auth/verify-password — D5: re-confirm identity before destructive actions
/**
 * @swagger
 * /api/v1/auth/verify-password:
 *   post:
 *     tags: [Auth]
 *     summary: Confirm the authenticated user's password (used for sensitive ops).
 *     security:
 *       - access_token: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string }
 */
router.post('/verify-password', authMiddleware, async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) throw new BadRequestError('password-required');
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { password: true } });
    if (!user || !user.password) throw new UnauthorizedError('invalid-credentials');
    const { ok } = await verifyPassword(password, user.password);
    if (!ok) throw new UnauthorizedError('invalid-credentials');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
