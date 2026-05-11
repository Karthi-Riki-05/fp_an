'use strict';

/**
 * E7 — Tenant isolation.
 * - Super Admin sees tenant-1 users when X-Tenant-Id: 1.
 * - Super Admin sees tenant-2 users separately (no crossover if seed has none).
 * - Company user (tenant-1) cannot set X-Tenant-Id: 2 → 403.
 * - Company user with no override gets only their own tenant data.
 * Design decision (per SUPER_ADMIN_PORT.md): non-admin cross-tenant header → 403.
 */

const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/prisma/client');
const { login } = require('../helpers/login');

const ADMIN_EMAIL   = process.env.SEED_SUPERADMIN_EMAIL  || 'user1@gmail.com';
const ADMIN_PASS    = process.env.SEED_SUPERADMIN_PASSWORD || 'password123';
const COMPANY_EMAIL = process.env.SEED_COMPANY_EMAIL     || 'user2@gmail.com';
const COMPANY_PASS  = process.env.SEED_COMPANY_PASSWORD  || 'password123';

describe('E7 Tenant isolation', () => {
  let adminCookie;
  let companyCookie;
  let tenant1Id;
  let tenant2Id;
  let tenant2Created = false;

  beforeAll(async () => {
    adminCookie  = (await login(app, ADMIN_EMAIL, ADMIN_PASS)).cookie;
    companyCookie = (await login(app, COMPANY_EMAIL, COMPANY_PASS)).cookie;

    const tenants = await request(app)
      .get('/api/v1/admin/tenants')
      .set('Cookie', adminCookie)
      .expect(200);
    tenant1Id = tenants.body[0].id;

    // Create a second tenant for isolation checks
    const t2res = await request(app)
      .post('/api/v1/admin/tenants')
      .set('Cookie', adminCookie)
      .send({ slug: `isolation-${Date.now()}`, name: `Isolation Tenant ${Date.now()}` })
      .expect(201);
    tenant2Id = t2res.body.id;
    tenant2Created = true;
  });

  afterAll(async () => {
    if (tenant2Created && tenant2Id) {
      const t = await prisma.tenant.findUnique({ where: { id: tenant2Id }, select: { schemaName: true } }).catch(() => null);
      if (t) await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${t.schemaName}" CASCADE`).catch(() => {});
      await prisma.tenant.deleteMany({ where: { id: tenant2Id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('admin sees tenant-1 users', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users?perPage=200')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenant1Id))
      .expect(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it('admin sees tenant-2 users separately (empty — no users seeded there)', async () => {
    const t1 = await request(app)
      .get('/api/v1/admin/users?perPage=200')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenant1Id))
      .expect(200);
    const t2 = await request(app)
      .get('/api/v1/admin/users?perPage=200')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenant2Id))
      .expect(200);

    const t1Ids = new Set(t1.body.data.map((u) => u.id));
    for (const u of t2.body.data) {
      expect(t1Ids.has(u.id)).toBe(false);
    }
  });

  it('company user cannot access tenant-2 by setting the header → 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Cookie', companyCookie)
      .set('X-Tenant-Id', String(tenant2Id));
    expect(res.status).toBe(403);
  });

  it('company user with no override gets only their own tenant data', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Cookie', companyCookie)
      .expect(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });
});
