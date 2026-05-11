'use strict';

const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const token =
    req.cookies?.access_token ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) {
    return res.status(401).json({ statusCode: 401, message: 'unauthorized' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    if (payload.kind !== 'web') {
      return res.status(401).json({ statusCode: 401, message: 'wrong-token-kind' });
    }
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.email,
      tenantId: payload.tenantId ?? null,
      roles: payload.roles ?? [],
      isAdmin: (payload.roles ?? []).includes('Administrator'),
      impersonatorId: payload.impersonator_id,
    };
    next();
  } catch {
    return res.status(401).json({ statusCode: 401, message: 'invalid-token' });
  }
}

module.exports = { authMiddleware };
