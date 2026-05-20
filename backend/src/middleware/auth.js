'use strict';

const jwt = require('jsonwebtoken');
const { prisma } = require('../prisma/client');

/**
 * Auth guard — verifies the JWT, then loads the user row to populate
 * the fields the (DB-free) tenantMiddleware needs at request time:
 *   roles[], companyId, timezone
 *
 * The JWT itself no longer carries `tenantId` (Tenant model removed).
 * The auth lookup adds one cheap indexed query per request — net
 * effect is the same as the old `prisma.tenant.findUnique` hop the
 * tenantMiddleware used to do.
 */
async function authMiddleware(req, res, next) {
  const token =
    req.cookies?.access_token ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) {
    return res.status(401).json({ statusCode: 401, message: 'unauthorized' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch {
    return res.status(401).json({ statusCode: 401, message: 'invalid-token' });
  }
  if (payload.kind !== 'web') {
    return res.status(401).json({ statusCode: 401, message: 'wrong-token-kind' });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: {
        id: true, email: true, name: true, companyId: true, timezone: true, status: true,
        userRoles: { select: { role: { select: { name: true, all: true } } } },
      },
    });
    if (!user) return res.status(401).json({ statusCode: 401, message: 'user-not-found' });
    if (user.status !== 1) return res.status(401).json({ statusCode: 401, message: 'user-disabled' });

    const roles = user.userRoles.map((ur) => ur.role.name);
    const isAdmin = user.userRoles.some((ur) => ur.role.all);

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      companyId: user.companyId,
      timezone: user.timezone,
      roles,
      isAdmin,
      impersonatorId: payload.impersonator_id,
    };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authMiddleware };
