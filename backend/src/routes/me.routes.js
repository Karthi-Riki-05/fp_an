'use strict';

const { Router } = require('express');
const { prisma } = require('../prisma/client');
const { NotFoundError } = require('../errors');

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const authUser = req.user;
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: {
        userRoles: { include: { role: { select: { name: true, all: true, rolePermissions: { include: { permission: { select: { name: true } } } } } } } },
        tenantUsers: { where: { status: true }, include: { tenant: { select: { id: true, slug: true, name: true, schemaName: true, timezone: true, status: true } } }, orderBy: { id: 'asc' } },
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

    let impersonator = null;
    if (authUser.impersonatorId) {
      const su = await prisma.user.findUnique({ where: { id: authUser.impersonatorId }, select: { id: true, name: true, email: true } });
      if (su) impersonator = su;
    }

    res.json({
      id: user.id, email: user.email, name: user.name, firstName: user.firstName, lastName: user.lastName,
      image: user.image, confirmed: user.confirmed, activeTenantId: authUser.tenantId, isAdmin: authUser.isAdmin,
      roles: user.userRoles.map((ur) => ur.role.name), permissions,
      tenants: user.tenantUsers.map((tu) => tu.tenant),
      impersonatorId: authUser.impersonatorId ?? null, impersonator,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
