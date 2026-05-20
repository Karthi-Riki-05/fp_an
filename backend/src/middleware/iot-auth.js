'use strict';

/**
 * IoT firmware auth — accepts either:
 *   (a) the standard JWT cookie / Bearer header (web/mobile callers), OR
 *   (b) `company_email_id` in the request body (legacy fpanalyzer IoT
 *       firmware: the unit ships with the company-owner email baked in
 *       and POSTs it on every request, no token).
 *
 * On success populates `req.user` and `req.tenant` exactly like the JWT
 * + tenantMiddleware pipeline does, so downstream handlers can stay
 * unaware of which credential type they got.
 */

const jwt = require('jsonwebtoken');
const { prisma } = require('../prisma/client');

function legacyFail(msg) {
  // Match the Laravel response shape so old firmware parses it.
  return { success: false, msg };
}

async function loadUserById(id) {
  return prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true, email: true, name: true, companyId: true, timezone: true, status: true,
      userRoles: { select: { role: { select: { name: true, all: true } } } },
    },
  });
}

async function loadCompanyUserByEmail(email) {
  // Legacy `company_email_id` always points at a Company-role user
  // (the tenant owner). Match case-insensitively because firmware
  // configs are hand-typed.
  return prisma.user.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      deletedAt: null,
      userRoles: { some: { role: { name: 'Company' } } },
    },
    select: {
      id: true, email: true, name: true, companyId: true, timezone: true, status: true,
      userRoles: { select: { role: { select: { name: true, all: true } } } },
    },
  });
}

function hydrate(user) {
  const roles = user.userRoles.map((ur) => ur.role.name);
  const isAdmin = user.userRoles.some((ur) => ur.role.all);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    companyId: user.companyId,
    timezone: user.timezone,
    roles,
    isAdmin,
  };
}

function buildTenantForCompanyUser(companyUser) {
  // Company role: schema = tenant_${id}. Mirror tenantMiddleware shape.
  return {
    tenantId: companyUser.id,
    schemaName: `tenant_${companyUser.id}`,
    dbName: null,
    timezone: companyUser.timezone || 'Europe/Stockholm',
  };
}

async function iotAuth(req, res, next) {
  try {
    // 1. JWT path (cookie or Bearer) — same logic as authMiddleware.
    const token =
      req.cookies?.access_token ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null);

    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        if (payload.kind === 'web') {
          const user = await loadUserById(payload.sub);
          if (user && user.status === 1) {
            req.user = hydrate(user);
            // Derive tenant the same way tenantMiddleware does — Company
            // user → tenant_${id}, sub-user → tenant_${companyId}.
            if (req.user.roles.includes('Company')) {
              req.tenant = buildTenantForCompanyUser(user);
            } else if (req.user.roles.includes('User') && req.user.companyId) {
              req.tenant = {
                tenantId: req.user.companyId,
                schemaName: `tenant_${req.user.companyId}`,
                dbName: null,
                timezone: req.user.timezone || 'Europe/Stockholm',
              };
            } else if (req.user.roles.includes('Administrator')) {
              const headerVal = req.headers['x-tenant-id'];
              const companyUserId = typeof headerVal === 'string' ? Number(headerVal) : NaN;
              if (Number.isInteger(companyUserId) && companyUserId > 0) {
                req.tenant = {
                  tenantId: companyUserId,
                  schemaName: `tenant_${companyUserId}`,
                  dbName: null,
                  timezone: 'Europe/Stockholm',
                };
              }
            }
            if (req.tenant) return next();
          }
        }
      } catch {
        // fall through to company_email_id path
      }
    }

    // 2. Legacy company_email_id path.
    const emailRaw = req.body?.company_email_id ?? req.body?.companyEmailId;
    const email = typeof emailRaw === 'string' ? emailRaw.trim() : '';
    if (!email) {
      return res.json(legacyFail('Invalid login'));
    }

    const companyUser = await loadCompanyUserByEmail(email);
    if (!companyUser || companyUser.status !== 1) {
      return res.json(legacyFail('Invalid login'));
    }

    req.user = hydrate(companyUser);
    req.tenant = buildTenantForCompanyUser(companyUser);
    return next();
  } catch (err) {
    next(err);
  }
}

module.exports = { iotAuth };
