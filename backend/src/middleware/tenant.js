'use strict';

const { prisma } = require('../prisma/client');

async function tenantMiddleware(req, res, next) {
  try {
    const user = req.user;
    if (!user) return res.status(403).json({ statusCode: 403, message: 'not-authenticated' });

    const headerTenant = req.headers['x-tenant-id'];
    const overrideTenantId = typeof headerTenant === 'string' ? Number(headerTenant) : undefined;

    let tenantId;
    if (overrideTenantId && Number.isInteger(overrideTenantId)) {
      if (!user.isAdmin) return res.status(403).json({ statusCode: 403, message: 'x-tenant-id-admin-only' });
      tenantId = overrideTenantId;
    } else {
      tenantId = user.tenantId;
    }

    if (!tenantId) {
      return res.status(400).json({ statusCode: 400, message: 'no-tenant-context — pass X-Tenant-Id (admin) or login with a tenant-bound user' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, schemaName: true, timezone: true, status: true },
    });
    if (!tenant) return res.status(400).json({ statusCode: 400, message: 'tenant-not-found' });
    if (tenant.status !== 'active') return res.status(403).json({ statusCode: 403, message: 'tenant-inactive' });

    if (!user.isAdmin) {
      const member = await prisma.tenantUser.findFirst({
        where: { userId: user.id, tenantId: tenant.id, status: true },
        select: { id: true },
      });
      if (!member) return res.status(403).json({ statusCode: 403, message: 'not-a-member-of-tenant' });
    }

    req.tenant = { tenantId: tenant.id, schemaName: tenant.schemaName, timezone: tenant.timezone };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { tenantMiddleware };
