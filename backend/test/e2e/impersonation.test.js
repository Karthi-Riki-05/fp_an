'use strict';

/**
 * E3 — Impersonation flow.
 * 1. Admin starts impersonation.
 * 2. Act under impersonated token — audit row includes BOTH ids.
 * 3. Stop impersonation — fresh admin token, no re-login.
 * 4. Cannot impersonate another Administrator.
 * 5. /auth/impersonate/stop from non-impersonation token → 400.
 */

const request = require('supertest');
const app = require('../../src/app');
const { login } = require('../helpers/login');
const { getDemoCompanyUserId } = require('../helpers/get-demo-company-user-id');

const ADMIN_EMAIL   = process.env.SEED_SUPERADMIN_EMAIL  || 'user1@gmail.com';
const ADMIN_PASS    = process.env.SEED_SUPERADMIN_PASSWORD || 'password123';
const COMPANY_EMAIL = process.env.SEED_COMPANY_EMAIL     || 'user2@gmail.com';

describe('E3 Impersonation', () => {
  let adminCookie;
  let adminId;
  let targetUserId;
  let tenantId;

  beforeAll(async () => {
    const r = await login(app, ADMIN_EMAIL, ADMIN_PASS);
    adminCookie = r.cookie;
    adminId = r.userId;

    tenantId = await getDemoCompanyUserId(app, adminCookie);

    const users = await request(app)
      .get('/api/v1/admin/users?perPage=200')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    const target = users.body.data.find((u) => u.email === COMPANY_EMAIL);
    expect(target).toBeDefined();
    targetUserId = target.id;
  });

  let impersonationCookie;

  it('admin starts impersonation — token has sub=target + impersonator_id=admin', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/users/${targetUserId}/impersonate`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(201);

    expect(res.body.user.id).toBe(targetUserId);
    expect(res.body.user.impersonatorId).toBe(adminId);

    const arr = Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [res.headers['set-cookie'] ?? ''];
    const c = arr.find((x) => x.startsWith('access_token='));
    expect(c).toBeDefined();
    impersonationCookie = c.split(';')[0];

    const payload = JSON.parse(Buffer.from(impersonationCookie.split('.')[1], 'base64url').toString('utf8'));
    expect(payload.sub).toBe(targetUserId);
    expect(payload.impersonator_id).toBe(adminId);
    expect(payload.kind).toBe('web');
  });

  it('audit log records the start event with both actor and entity ids', async () => {
    const res = await request(app)
      .get('/api/v1/admin/history?entity_type=User&limit=20')
      .set('Cookie', adminCookie)
      .expect(200);

    const startEvent = res.body.items.find((h) => h.text && h.text.includes('started impersonating user'));
    expect(startEvent).toBeDefined();
    expect(startEvent.actorId).toBe(adminId);
    expect(startEvent.entityId).toBe(targetUserId);
  });

  it('refuses to impersonate another Administrator', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/users/${adminId}/impersonate`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId));
    expect(res.status).toBe(403);
  });

  it('stops impersonation — fresh admin token, no re-login', async () => {
    const res = await request(app)
      .post('/api/v1/auth/impersonate/stop')
      .set('Cookie', impersonationCookie)
      .expect(200);

    expect(res.body.user.id).toBe(adminId);
    expect(res.body.user.tenantId).toBeNull();

    const arr = Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [res.headers['set-cookie'] ?? ''];
    const c = arr.find((x) => x.startsWith('access_token='));
    expect(c).toBeDefined();
    const freshCookie = c.split(';')[0];
    const payload = JSON.parse(Buffer.from(freshCookie.split('.')[1], 'base64url').toString('utf8'));
    expect(payload.sub).toBe(adminId);
    expect(payload.impersonator_id).toBeUndefined();
  });

  it('returns 400 when /auth/impersonate/stop is called with non-impersonation token', async () => {
    await request(app)
      .post('/api/v1/auth/impersonate/stop')
      .set('Cookie', adminCookie)
      .expect(400);
  });
});
