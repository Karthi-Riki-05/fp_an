'use strict';

/**
 * Tenant routing — derived from the authenticated user, no DB lookup.
 *
 *   role=Administrator → no fixed schema. Super Admin must pass the
 *                         X-Tenant-Id header to switch into a company
 *                         context; the value is the Company user's id
 *                         (the field/header name is kept for back-compat
 *                         — see TENANT_REMOVAL.md decision 4).
 *   role=Company        → tenant_${user.id}
 *   role=User           → tenant_${user.companyId}; throws 400 if
 *                         companyId is 0 (orphaned legacy data).
 *
 * The replaced `prisma.tenant.findUnique` + `prisma.tenantUser.findFirst`
 * calls are gone. Per the TENANT_REMOVAL Step D rewrite.
 */

function pickRole(roles) {
  // Role precedence — Administrator wins, then Company, then User.
  if (!Array.isArray(roles) || roles.length === 0) return null;
  if (roles.includes('Administrator')) return 'Administrator';
  if (roles.includes('Company')) return 'Company';
  if (roles.includes('User')) return 'User';
  return roles[0] ?? null;
}

function getTenantSchema(user, req) {
  const role = pickRole(user.roles);
  if (role === 'Administrator') {
    const headerVal = req.headers['x-tenant-id'];
    const companyUserId = typeof headerVal === 'string' ? Number(headerVal) : NaN;
    return Number.isInteger(companyUserId) && companyUserId > 0
      ? { schemaName: `tenant_${companyUserId}`, companyUserId, role }
      : null;
  }
  if (role === 'Company') {
    return { schemaName: `tenant_${user.id}`, companyUserId: user.id, role };
  }
  if (role === 'User') {
    if (!user.companyId || user.companyId === 0) {
      const err = new Error(`user-${user.id}-has-no-company`);
      err.statusCode = 400;
      throw err;
    }
    return { schemaName: `tenant_${user.companyId}`, companyUserId: user.companyId, role };
  }
  return null;
}

async function tenantMiddleware(req, res, next) {
  try {
    const user = req.user;
    if (!user) return res.status(403).json({ statusCode: 403, message: 'not-authenticated' });

    let resolved;
    try {
      resolved = getTenantSchema(user, req);
    } catch (err) {
      return res.status(err.statusCode ?? 400).json({ statusCode: err.statusCode ?? 400, message: err.message });
    }

    if (!resolved) {
      return res.status(400).json({
        statusCode: 400,
        message: 'no-tenant-context — pass X-Tenant-Id (Company user id) as Administrator, or log in as a Company / sub-user',
      });
    }

    req.tenant = {
      // Keep the legacy field name so downstream services that already pass
      // req.tenant to withTenant(tenant, ...) keep working. The value is
      // now the Company user's id, not the (deleted) Tenant table id.
      tenantId: resolved.companyUserId,
      schemaName: resolved.schemaName,
      dbName: null, // Multi-DB mode removed — schema-only.
      timezone: user.timezone || 'Europe/Stockholm',
    };
    next();
  } catch (err) {
    next(err);
  }
}

// Like tenantMiddleware but sets req.tenant = null instead of returning 400
// when an Administrator has no X-Tenant-Id. Used for endpoints that work
// without a tenant context (e.g. Company creation, which provisions its own schema).
async function softTenantMiddleware(req, res, next) {
  try {
    const user = req.user;
    if (!user) return res.status(403).json({ statusCode: 403, message: 'not-authenticated' });
    let resolved;
    try {
      resolved = getTenantSchema(user, req);
    } catch (err) {
      return res.status(err.statusCode ?? 400).json({ statusCode: err.statusCode ?? 400, message: err.message });
    }
    req.tenant = resolved
      ? { tenantId: resolved.companyUserId, schemaName: resolved.schemaName, dbName: null, timezone: user.timezone || 'Europe/Stockholm' }
      : null;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { tenantMiddleware, softTenantMiddleware, getTenantSchema };
