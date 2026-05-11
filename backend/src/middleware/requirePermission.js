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

module.exports = { requirePermission };
