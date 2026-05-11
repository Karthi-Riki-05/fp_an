'use strict';

const rateLimit = require('express-rate-limit');

const rateLimiter = rateLimit({
  windowMs: Number(process.env.THROTTLE_DEFAULT_TTL ?? 60) * 1000,
  max: Number(process.env.THROTTLE_DEFAULT_LIMIT ?? 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: { statusCode: 429, message: 'too-many-requests' },
});

const loginRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { statusCode: 429, message: 'too-many-login-attempts' },
});

module.exports = { rateLimiter, loginRateLimiter };
