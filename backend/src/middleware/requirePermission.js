'use strict';

const { prisma } = require('../prisma/client');

function requirePermission(...perms) {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) return res.status(403).json({ statusCode: 403, message: 'not-authenticated' });
      if (user.isAdmin) return next();

      const grants = await prisma.rolePermission.findMany({
        where: { role: { userRoles: { some: { userId: user.id } } } },
        include: { permission: { select: { name: true } } },
      });
      const owned = new Set(grants.map((g) => g.permission.name));
      const ok = perms.every((p) => owned.has(p));
      if (!ok) return res.status(403).json({ statusCode: 403, message: 'permission-required' });
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Like requirePermission but the caller passes through if they hold ANY ONE
 * of the listed permissions. Used by read-only Monitor/Analyzer endpoints
 * that should accept either the view-* permission OR the manage-* one.
 */
function requireAnyPermission(...perms) {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) return res.status(403).json({ statusCode: 403, message: 'not-authenticated' });
      if (user.isAdmin) return next();

      const grants = await prisma.rolePermission.findMany({
        where: { role: { userRoles: { some: { userId: user.id } } } },
        include: { permission: { select: { name: true } } },
      });
      const owned = new Set(grants.map((g) => g.permission.name));
      const ok = perms.some((p) => owned.has(p));
      if (!ok) return res.status(403).json({ statusCode: 403, message: 'permission-required' });
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requirePermission, requireAnyPermission };
