'use strict';

/**
 * E4 — Role CRUD happy path.
 * create → update permissions → list (user count correct) →
 * delete (cannot delete Administrator) →
 * delete (cannot delete role with users) →
 * assign role to user then still can't delete →
 * reassign user away → delete succeeds.
 */

const request = require('supertest');
const app = require('../../src/app');
const { login } = require('../helpers/login');
const { getDemoCompanyUserId } = require('../helpers/get-demo-company-user-id');

const ADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL || 'user1@gmail.com';
const ADMIN_PASS  = process.env.SEED_SUPERADMIN_PASSWORD || 'password123';

describe('E4 Role CRUD', () => {
  let adminCookie;
  let tenantId;
  let testRoleId;
  let testUserId;
  const roleName = `e2e-role-${Date.now()}`;
  const testEmail = `role-test-${Date.now()}@e2e.test`;

  beforeAll(async () => {
    const r = await login(app, ADMIN_EMAIL, ADMIN_PASS);
    adminCookie = r.cookie;
    tenantId = await getDemoCompanyUserId(app, adminCookie);
  });

  afterAll(async () => {
    // Cleanup test user if it still exists
    if (testUserId) {
      await request(app)
        .delete(`/api/v1/admin/users/${testUserId}`)
        .set('Cookie', adminCookie)
        .set('X-Tenant-Id', String(tenantId));
      await request(app)
        .delete(`/api/v1/admin/users/${testUserId}?permanent=true`)
        .set('Cookie', adminCookie)
        .set('X-Tenant-Id', String(tenantId));
    }
    // Cleanup test role if it still exists
    if (testRoleId) {
      await request(app)
        .delete(`/api/v1/admin/roles/${testRoleId}`)
        .set('Cookie', adminCookie);
    }
  });

  it('creates a role', async () => {
    const res = await request(app)
      .post('/api/v1/admin/roles')
      .set('Cookie', adminCookie)
      .send({ name: roleName, permissions: ['view-backend'], sort: 99 })
      .expect(201);
    expect(res.body.name).toBe(roleName);
    testRoleId = res.body.id;
  });

  it('updates role permissions', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/roles/${testRoleId}`)
      .set('Cookie', adminCookie)
      .send({ permissions: ['view-backend', 'manage-users'] })
      .expect(200);
    expect(res.body.permissions).toContain('manage-users');
  });

  it('lists roles and the new role has userCount=0', async () => {
    const res = await request(app)
      .get('/api/v1/admin/roles')
      .set('Cookie', adminCookie)
      .expect(200);
    const found = res.body.find((r) => r.id === testRoleId);
    expect(found).toBeDefined();
    expect(found.userCount).toBe(0);
  });

  it('cannot delete Administrator role', async () => {
    const roles = await request(app).get('/api/v1/admin/roles').set('Cookie', adminCookie).expect(200);
    const admin = roles.body.find((r) => r.all === true);
    expect(admin).toBeDefined();
    const res = await request(app)
      .delete(`/api/v1/admin/roles/${admin.id}`)
      .set('Cookie', adminCookie);
    expect(res.status).toBe(403);
  });

  it('assigns the test role to a new user', async () => {
    const res = await request(app)
      .post('/api/v1/admin/users')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .send({ name: 'Role Test User', email: testEmail, password: 'Password123', roles: [roleName], confirmed: true })
      .expect(201);
    testUserId = res.body.id;
  });

  it('cannot delete role while it has users assigned', async () => {
    const res = await request(app)
      .delete(`/api/v1/admin/roles/${testRoleId}`)
      .set('Cookie', adminCookie);
    expect(res.status).toBe(409);
  });

  it('reassigns user to a different role', async () => {
    await request(app)
      .patch(`/api/v1/admin/users/${testUserId}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .send({ roles: ['User'] })
      .expect(200);
  });

  it('deletes role after all users are reassigned', async () => {
    await request(app)
      .delete(`/api/v1/admin/roles/${testRoleId}`)
      .set('Cookie', adminCookie)
      .expect(204);
    testRoleId = null;
  });
});
