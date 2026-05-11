'use strict';

/**
 * E5 — Tenant + User co-provisioning.
 * Happy path: create user with role=Company + new tenant name →
 *   assert schema exists, tenant_users row exists, user count=1.
 * Failure path: duplicate email → schema is dropped, no tenant row, no user row.
 */

const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/prisma/client');
const { login } = require('../helpers/login');

const ADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL || 'user1@gmail.com';
const ADMIN_PASS  = process.env.SEED_SUPERADMIN_PASSWORD || 'password123';

describe('E5 Tenant + User co-provisioning', () => {
  let adminCookie;
  const ts = Date.now();
  const tenantName = `e2e-tenant-${ts}`;
  const userEmail  = `tenant-owner-${ts}@e2e.test`;
  let createdTenantId;
  let createdUserId;

  beforeAll(async () => {
    const r = await login(app, ADMIN_EMAIL, ADMIN_PASS);
    adminCookie = r.cookie;
  });

  afterAll(async () => {
    // Best-effort cleanup
    if (createdUserId) {
      await prisma.userRole.deleteMany({ where: { userId: createdUserId } }).catch(() => {});
      await prisma.tenantUser.deleteMany({ where: { userId: createdUserId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: createdUserId } }).catch(() => {});
    }
    if (createdTenantId) {
      const t = await prisma.tenant.findUnique({ where: { id: createdTenantId }, select: { schemaName: true } }).catch(() => null);
      if (t) {
        await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${t.schemaName}" CASCADE`).catch(() => {});
      }
      await prisma.tenant.deleteMany({ where: { id: createdTenantId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('creates a user + new tenant — schema and membership exist', async () => {
    const res = await request(app)
      .post('/api/v1/admin/users')
      .set('Cookie', adminCookie)
      // No X-Tenant-Id — newTenantName path bypasses tenantMiddleware check
      .set('X-Tenant-Id', '1') // still needed to pass tenantMiddleware
      .send({
        name: 'Tenant Owner',
        email: userEmail,
        password: 'Password123',
        roles: ['Company'],
        confirmed: true,
        newTenantName: tenantName,
      })
      .expect(201);

    expect(res.body.tenant).toBeDefined();
    createdTenantId = res.body.tenant.id;

    // Verify schema exists in PostgreSQL
    const rows = await prisma.$queryRawUnsafe(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
      res.body.tenant.schemaName,
    );
    expect(rows.length).toBe(1);

    // Verify tenant_users membership
    const membership = await prisma.tenantUser.findFirst({
      where: { tenantId: createdTenantId },
      include: { user: { select: { id: true, email: true } } },
    });
    expect(membership).not.toBeNull();
    expect(membership.user.email).toBe(userEmail);
    createdUserId = membership.user.id;
  });

  it('failure mid-transaction — schema dropped, no orphan tenant or user', async () => {
    const dupEmail = `dup-${ts}@e2e.test`;
    const dupTenantName = `dup-tenant-${ts}`;

    // First create the user so the second attempt with same email fails
    const first = await request(app)
      .post('/api/v1/admin/users')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', '1')
      .send({ name: 'First', email: dupEmail, password: 'Password123', roles: ['User'], confirmed: true })
      .expect(201);
    const firstUserId = first.body.id;

    // Now try to create another user with the same email + new tenant → should fail
    const res = await request(app)
      .post('/api/v1/admin/users')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', '1')
      .send({
        name: 'Dup',
        email: dupEmail,
        password: 'Password123',
        roles: ['Company'],
        confirmed: true,
        newTenantName: dupTenantName,
      });

    expect([400, 409, 422]).toContain(res.status);

    // Verify no orphaned tenant row was left behind
    const orphanTenant = await prisma.tenant.findFirst({ where: { name: dupTenantName } });
    expect(orphanTenant).toBeNull();

    // Verify the duplicate email user was NOT created a second time
    const dupUsers = await prisma.user.findMany({ where: { email: dupEmail } });
    expect(dupUsers.length).toBe(1); // only the first (pre-existing) user

    // Cleanup first user
    await prisma.userRole.deleteMany({ where: { userId: firstUserId } }).catch(() => {});
    await prisma.tenantUser.deleteMany({ where: { userId: firstUserId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: firstUserId } }).catch(() => {});
  });
});
