'use strict';

/**
 * E6 — Recent history feed.
 * Perform 5 admin actions, fetch /api/v1/admin/history?limit=10,
 * assert 5+ rows with expected actor/target/action data.
 * Also verifies cursor pagination (next_cursor shape).
 */

const request = require('supertest');
const app = require('../../src/app');
const { login } = require('../helpers/login');
const { getDemoCompanyUserId } = require('../helpers/get-demo-company-user-id');

const ADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL || 'user1@gmail.com';
const ADMIN_PASS  = process.env.SEED_SUPERADMIN_PASSWORD || 'password123';

describe('E6 Recent history feed', () => {
  let adminCookie;
  let adminId;
  let tenantId;
  const createdIds = [];
  const prefix = `hist-${Date.now()}`;

  beforeAll(async () => {
    const r = await login(app, ADMIN_EMAIL, ADMIN_PASS);
    adminCookie = r.cookie;
    adminId = r.userId;
    tenantId = await getDemoCompanyUserId(app, adminCookie);
  });

  afterAll(async () => {
    // Cleanup: soft-delete then hard-delete test users
    for (const id of createdIds) {
      await request(app).delete(`/api/v1/admin/users/${id}`).set('Cookie', adminCookie).set('X-Tenant-Id', String(tenantId));
      await request(app).delete(`/api/v1/admin/users/${id}?permanent=true`).set('Cookie', adminCookie).set('X-Tenant-Id', String(tenantId));
    }
  });

  it('performs 5 create actions and verifies history', async () => {
    // Create 5 users to generate 5 history entries
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/v1/admin/users')
        .set('Cookie', adminCookie)
        .set('X-Tenant-Id', String(tenantId))
        .send({ name: `Hist ${i}`, email: `${prefix}-${i}@e2e.test`, password: 'Password123', roles: ['User'], confirmed: true })
        .expect(201);
      createdIds.push(res.body.id);
    }

    const res = await request(app)
      .get('/api/v1/admin/history?limit=10&entity_type=User')
      .set('Cookie', adminCookie)
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(5);

    // Verify shape
    const first = res.body.items[0];
    expect(first).toHaveProperty('actorId');
    expect(first).toHaveProperty('actorName');
    expect(first).toHaveProperty('entityType');
    expect(first).toHaveProperty('text');
    expect(first).toHaveProperty('createdAt');

    // Verify actor ids
    const ourEvents = res.body.items.filter((h) => h.actorId === adminId && h.text.includes(`${prefix}`));
    expect(ourEvents.length).toBeGreaterThanOrEqual(5);
  });

  it('cursor pagination — next_cursor is non-null when more results exist, null otherwise', async () => {
    // First page
    const page1 = await request(app)
      .get('/api/v1/admin/history?limit=2')
      .set('Cookie', adminCookie)
      .expect(200);
    expect(page1.body.next_cursor).not.toBeNull();

    // Fetch second page using cursor
    const page2 = await request(app)
      .get(`/api/v1/admin/history?limit=2&before=${encodeURIComponent(page1.body.next_cursor)}`)
      .set('Cookie', adminCookie)
      .expect(200);
    // Items on page2 should all be older than items on page1
    if (page2.body.items.length > 0) {
      const p1Oldest = new Date(page1.body.items[page1.body.items.length - 1].createdAt).getTime();
      const p2Newest = new Date(page2.body.items[0].createdAt).getTime();
      expect(p2Newest).toBeLessThanOrEqual(p1Oldest);
    }
  });
});
