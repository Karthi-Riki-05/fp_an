'use strict';

const { Router } = require('express');
const { loginRateLimiter } = require('../middleware/rateLimiter');
const { authMiddleware } = require('../middleware/auth');
const { login, issueImpersonationToken, stopImpersonation } = require('../services/auth.service');
const { verify: verifyPassword } = require('../services/password.service');
const { prisma } = require('../prisma/client');
const { BadRequestError, UnauthorizedError } = require('../errors');
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
router.post('/login', loginRateLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ statusCode: 400, message: 'email and password are required' });
    const result = await login(email, password);
    res.cookie(ACCESS_COOKIE, result.accessToken, cookieOpts(result.expiresIn));
    res.json({ user: result.user, expiresIn: result.expiresIn });
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie(ACCESS_COOKIE, clearCookieOpts());
  res.status(204).send();
});

// POST /auth/impersonate/stop — requires auth + active impersonation token
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

// POST /auth/verify-password — D5: re-confirm identity before destructive actions
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
