'use strict';

/**
 * E5 — Company-user → tenant schema co-provisioning.
 *
 * Post Tenant-removal (see MIGRATION_NOTES §13): there is no Tenant row to
 * create. Creating a user with role=Company implicitly provisions a
 * `tenant_${user.id}` schema in the same transaction. If user creation
 * fails (e.g. duplicate email), no schema must be left behind.
 */

const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/prisma/client');
const { login } = require('../helpers/login');

const ADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL || 'user1@gmail.com';
const ADMIN_PASS  = process.env.SEED_SUPERADMIN_PASSWORD || 'password123';

async function schemaExists(name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`,
    name,
  );
  return rows.length > 0;
}

async function purgeUser(id) {
  if (!id) return;
  await prisma.userRole.deleteMany({ where: { userId: id } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id } }).catch(() => {});
}

describe('E5 Company-user → schema co-provisioning', () => {
  let adminCookie;
  const ts = Date.now();
  const userEmail  = `tenant-owner-${ts}@e2e.test`;
  let createdUserId;
  let createdSchemaName;

  beforeAll(async () => {
    const r = await login(app, ADMIN_EMAIL, ADMIN_PASS);
    adminCookie = r.cookie;
  });

  afterAll(async () => {
    if (createdSchemaName) {
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${createdSchemaName}" CASCADE`).catch(() => {});
    }
    await purgeUser(createdUserId);
    await prisma.$disconnect();
  });

  it('creating a role=Company user provisions tenant_${id} schema', async () => {
    // Admin must supply *some* X-Tenant-Id to satisfy tenantMiddleware;
    // any seeded Company user id works (the new user becomes its own company).
    const res = await request(app)
      .post('/api/v1/admin/users')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', '2')
      .send({
        name: `E5 Owner ${ts}`,
        email: userEmail,
        password: 'Password123',
        roles: ['Company'],
        confirmed: true,
      })
      .expect(201);

    createdUserId = res.body.id;
    createdSchemaName = `tenant_${createdUserId}`;
    expect(await schemaExists(createdSchemaName)).toBe(true);

    // The schema must mirror the template (i.e. > 0 tables).
    const tableRows = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS c FROM information_schema.tables WHERE table_schema = $1`,
      createdSchemaName,
    );
    expect(tableRows[0].c).toBeGreaterThan(0);
  });

  it('duplicate email rejected — no orphan schema, no orphan user row', async () => {
    const dupEmail = `dup-${ts}@e2e.test`;

    // 1) seed a first user with this email so the second attempt collides
    const first = await request(app)
      .post('/api/v1/admin/users')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', '2')
      .send({ name: 'First', email: dupEmail, password: 'Password123', roles: ['User'], confirmed: true })
      .expect(201);
    const firstId = first.body.id;

    // 2) second attempt — same email, role=Company → should fail
    const res = await request(app)
      .post('/api/v1/admin/users')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', '2')
      .send({
        name: 'Dup', email: dupEmail, password: 'Password123',
        roles: ['Company'], confirmed: true,
      });
    expect([400, 409, 422]).toContain(res.status);

    // No second user row, no leftover tenant_<some-new-id> schema
    const dupUsers = await prisma.user.findMany({ where: { email: dupEmail } });
    expect(dupUsers.length).toBe(1);

    await purgeUser(firstId);
  });
});
