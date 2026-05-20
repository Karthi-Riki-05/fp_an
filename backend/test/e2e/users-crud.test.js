'use strict';

/**
 * E1 — User CRUD happy path.
 * create → list → get → update → soft-delete → list(absent) →
 * list?deleted → restore → list(present) → soft-delete → hard-delete →
 * list?deleted (absent)
 */

const request = require('supertest');
const app = require('../../src/app');
const { login } = require('../helpers/login');
const { getDemoCompanyUserId } = require('../helpers/get-demo-company-user-id');

const ADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL || 'user1@gmail.com';
const ADMIN_PASS  = process.env.SEED_SUPERADMIN_PASSWORD || 'password123';

describe('E1 User CRUD happy path', () => {
  let adminCookie;
  let tenantId;
  let createdUserId;
  const testEmail = `crud-test-${Date.now()}@e2e.test`;

  beforeAll(async () => {
    const r = await login(app, ADMIN_EMAIL, ADMIN_PASS);
    adminCookie = r.cookie;
    // Admin is not tenant-bound — look up the demo Company user id dynamically.
    // "tenantId" here = Company user id (post Tenant-removal — see MIGRATION_NOTES §13).
    tenantId = await getDemoCompanyUserId(app, adminCookie);
    expect(tenantId).toBeDefined();
  });

  it('creates a user', async () => {
    const res = await request(app)
      .post('/api/v1/admin/users')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .send({ name: 'CRUD Test', email: testEmail, password: 'Password123', roles: ['User'], confirmed: true })
      .expect(201);
    expect(res.body.email).toBe(testEmail);
    createdUserId = res.body.id;
  });

  it('lists the user', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/users?search=${encodeURIComponent(testEmail)}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    expect(res.body.data.some((u) => u.id === createdUserId)).toBe(true);
  });

  it('gets a single user', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/users/${createdUserId}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    expect(res.body.id).toBe(createdUserId);
    expect(res.body.email).toBe(testEmail);
  });

  it('updates the user name', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${createdUserId}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .send({ name: 'CRUD Updated' })
      .expect(200);
    expect(res.body.name).toBe('CRUD Updated');
  });

  it('soft-deletes the user', async () => {
    await request(app)
      .delete(`/api/v1/admin/users/${createdUserId}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(204);
  });

  it('soft-deleted user is absent from active list', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/users?search=${encodeURIComponent(testEmail)}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    expect(res.body.data.every((u) => u.id !== createdUserId)).toBe(true);
  });

  it('soft-deleted user appears in /deleted list', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users/deleted')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    expect(res.body.data.some((u) => u.id === createdUserId)).toBe(true);
  });

  it('restores the user', async () => {
    await request(app)
      .post(`/api/v1/admin/users/${createdUserId}/restore`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
  });

  it('restored user is back in active list', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/users?search=${encodeURIComponent(testEmail)}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    expect(res.body.data.some((u) => u.id === createdUserId)).toBe(true);
  });

  it('soft-deletes again before permanent delete', async () => {
    await request(app)
      .delete(`/api/v1/admin/users/${createdUserId}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(204);
  });

  it('hard-deletes the user via ?permanent=true', async () => {
    await request(app)
      .delete(`/api/v1/admin/users/${createdUserId}?permanent=true`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(204);
  });

  it('hard-deleted user is absent from /deleted list', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users/deleted')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    expect(res.body.data.every((u) => u.id !== createdUserId)).toBe(true);
  });
});
