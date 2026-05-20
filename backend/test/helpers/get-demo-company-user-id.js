'use strict';

/**
 * Test helper — replaces the old `GET /api/v1/admin/tenants` discovery used by
 * pre-Tenant-removal e2e tests. After the refactor (see MIGRATION_NOTES §13),
 * "tenant id" === Company user id.
 *
 *   const companyUserId = await getDemoCompanyUserId(app, adminCookie);
 *
 * Optional second form returns the synthetic tenant object for callers that
 * still pass it to `withTenant(tenant, tx => …)`.
 */

const request = require('supertest');

async function getDemoCompanyUserId(app, adminCookie) {
  const res = await request(app)
    .get('/api/v1/superadmin/users?roles=Company&active=true&perPage=10')
    .set('Cookie', adminCookie)
    .expect(200);
  const first = (res.body.data || [])[0];
  if (!first) throw new Error('getDemoCompanyUserId: no Company users found — seed not run?');
  return first.id;
}

async function getDemoTenantContext(app, adminCookie) {
  const id = await getDemoCompanyUserId(app, adminCookie);
  return {
    tenantId: id,
    schemaName: `tenant_${id}`,
    dbName: null,
    timezone: 'Europe/Stockholm',
  };
}

module.exports = { getDemoCompanyUserId, getDemoTenantContext };
