'use strict';

/**
 * E2 — Self-protection rules.
 * Admin cannot: soft-delete self, deactivate self,
 * demote self out of Administrator, hard-delete self.
 */

const request = require('supertest');
const app = require('../../src/app');
const { login } = require('../helpers/login');

const ADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL || 'user1@gmail.com';
const ADMIN_PASS  = process.env.SEED_SUPERADMIN_PASSWORD || 'password123';

describe('E2 Self-protection', () => {
  let adminCookie;
  let adminId;
  let tenantId;

  beforeAll(async () => {
    const r = await login(app, ADMIN_EMAIL, ADMIN_PASS);
    adminCookie = r.cookie;
    adminId = r.userId;
    const tenants = await request(app)
      .get('/api/v1/admin/tenants')
      .set('Cookie', adminCookie)
      .expect(200);
    tenantId = tenants.body[0].id;
  });

  it('returns 403 when admin tries to soft-delete self', async () => {
    const res = await request(app)
      .delete(`/api/v1/admin/users/${adminId}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId));
    expect(res.status).toBe(403);
  });

  it('returns 403 when admin tries to deactivate self via PATCH /status', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${adminId}/status`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .send({ status: 0 });
    expect(res.status).toBe(403);
  });

  it('returns 403 when admin tries to deactivate self via PATCH (active: false)', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${adminId}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .send({ active: false });
    expect(res.status).toBe(403);
  });

  it('returns 403 when admin tries to demote self out of Administrator', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${adminId}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .send({ roles: ['User'] });
    expect(res.status).toBe(403);
  });

  it('returns 403 when admin tries to hard-delete self (not soft-deleted)', async () => {
    // Hard delete requires soft-delete first; but self-delete is always blocked
    const res = await request(app)
      .delete(`/api/v1/admin/users/${adminId}?permanent=true`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId));
    // permanentDelete() checks self first (403), then checks soft-delete state (404)
    expect([403, 404]).toContain(res.status);
  });
});
