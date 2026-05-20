'use strict';

/**
 * E7 — Tenant isolation, post Tenant-removal (MIGRATION_NOTES §13).
 *
 * The "tenant" is a Company user. Administrator routes to a Company's
 * workspace via X-Tenant-Id = Company user id. The new tenantMiddleware
 * derives the schema purely from the authenticated user — so for a
 * Company-role caller, X-Tenant-Id is *ignored* (they always see their
 * own schema). That's stronger than the old 403 behavior but equivalent
 * in security (cannot cross-tenant).
 */

const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/prisma/client');
const { login } = require('../helpers/login');
const { getDemoCompanyUserId } = require('../helpers/get-demo-company-user-id');

const ADMIN_EMAIL   = process.env.SEED_SUPERADMIN_EMAIL  || 'user1@gmail.com';
const ADMIN_PASS    = process.env.SEED_SUPERADMIN_PASSWORD || 'password123';
const COMPANY_EMAIL = process.env.SEED_COMPANY_EMAIL     || 'user2@gmail.com';
const COMPANY_PASS  = process.env.SEED_COMPANY_PASSWORD  || 'password123';

describe('E7 Tenant isolation', () => {
  let adminCookie;
  let companyCookie;
  let company1Id;       // Company user A (the seed Company)
  let company2Id;       // Company user B (provisioned in beforeAll)
  let company2SchemaName;

  beforeAll(async () => {
    adminCookie   = (await login(app, ADMIN_EMAIL, ADMIN_PASS)).cookie;
    companyCookie = (await login(app, COMPANY_EMAIL, COMPANY_PASS)).cookie;
    company1Id    = await getDemoCompanyUserId(app, adminCookie);

    // Provision a second Company user — this auto-creates tenant_<id> schema.
    const res = await request(app)
      .post('/api/v1/admin/users')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(company1Id))
      .send({
        name: `Isolation Co ${Date.now()}`,
        email: `isolation-co-${Date.now()}@e2e.test`,
        password: 'Password123',
        roles: ['Company'],
        confirmed: true,
      })
      .expect(201);
    company2Id = res.body.id;
    company2SchemaName = `tenant_${company2Id}`;
  });

  afterAll(async () => {
    if (company2SchemaName) {
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${company2SchemaName}" CASCADE`).catch(() => {});
    }
    if (company2Id) {
      await prisma.userRole.deleteMany({ where: { userId: company2Id } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: company2Id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('admin sees Company-A users when X-Tenant-Id=company1Id', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users?perPage=200')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(company1Id))
      .expect(200);
    // The seed Company user itself is always in the list.
    expect(res.body.data.some((u) => u.id === company1Id)).toBe(true);
  });

  it('admin sees Company-B separately (no Company-A users crossover)', async () => {
    const a = await request(app)
      .get('/api/v1/admin/users?perPage=200')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(company1Id))
      .expect(200);
    const b = await request(app)
      .get('/api/v1/admin/users?perPage=200')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(company2Id))
      .expect(200);

    const aIds = new Set(a.body.data.map((u) => u.id));
    // Company-B only contains itself (just provisioned, no sub-users yet)
    expect(b.body.data.length).toBe(1);
    expect(b.body.data[0].id).toBe(company2Id);
    expect(aIds.has(company2Id)).toBe(false);
  });

  it('Company user cannot cross-scope: passing X-Tenant-Id is ignored', async () => {
    // Caller is Company-A (the seed). Passing a different tenant header
    // must NOT escape their own schema. New tenantMiddleware derives the
    // schema from the user's own row, so the header is silently ignored.
    const meBefore = await request(app)
      .get('/api/v1/me')
      .set('Cookie', companyCookie)
      .expect(200);
    const ownTenantId = meBefore.body.activeTenantId;
    expect(ownTenantId).toBe(company1Id);

    const res = await request(app)
      .get('/api/v1/admin/users?perPage=200')
      .set('Cookie', companyCookie)
      .set('X-Tenant-Id', String(company2Id))
      .expect(200);
    // None of the returned users belong to Company-B's schema; in particular
    // company2Id is not in the response.
    expect(res.body.data.some((u) => u.id === company2Id)).toBe(false);
  });

  it('Company user with no header gets only their own tenant data', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users?perPage=200')
      .set('Cookie', companyCookie)
      .expect(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    // Caller's own row must be in the result.
    expect(res.body.data.some((u) => u.id === company1Id)).toBe(true);
  });
});
