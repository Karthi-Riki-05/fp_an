'use strict';

/**
 * Phase A foundation — cascading sub-resources + warning PATCH + shift titles +
 * IoT equipment-scope filters + types/parts query-param filters.
 *
 * Each block exercises a single endpoint added or extended in Phase A and
 * asserts only the contract (shape, status code, key behaviour). Edge-case
 * coverage lives with per-form fix commits in later phases.
 */

const request = require('supertest');
const app = require('../../src/app');
const { login } = require('../helpers/login');
const { prisma, withTenant } = require('../../src/prisma/client');

const ADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL || 'user1@gmail.com';
const ADMIN_PASS  = process.env.SEED_SUPERADMIN_PASSWORD || 'password123';

describe('Phase A — cascading + warning + shift-titles + filters', () => {
  let adminCookie;
  let tenant;
  let tenantId;
  let equipmentId;
  let warningId;

  beforeAll(async () => {
    const r = await login(app, ADMIN_EMAIL, ADMIN_PASS);
    adminCookie = r.cookie;
    const tenants = await request(app).get('/api/v1/admin/tenants').set('Cookie', adminCookie).expect(200);
    tenantId = tenants.body[0].id;
    tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, schemaName: true, dbName: true, timezone: true, status: true },
    });

    const eq = await request(app)
      .post('/api/v1/equipment')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .send({ name: `phase-a-cascade-eq-${Date.now()}`, sortOrder: 0 })
      .expect(201);
    equipmentId = eq.body.id;

    // Seed one warning_data row directly so we can exercise PATCH.
    const fromTime = new Date(Date.now() - 3600_000).toISOString(); // 1h ago
    const toTime = new Date().toISOString();
    const inserted = await withTenant(tenant, (tx) =>
      tx.$queryRawUnsafe(
        `INSERT INTO warning_data (equipment_id, machine_id, notification_text, from_time, to_time, duration, created_at, updated_at)
         VALUES ($1, 0, $2, $3::timestamptz, $4::timestamptz, 3600, now(), now()) RETURNING id`,
        equipmentId, 'phase-a seed', fromTime, toTime,
      ),
    );
    warningId = inserted[0].id;
  });

  afterAll(async () => {
    if (warningId) {
      await request(app)
        .delete(`/api/v1/admin/results/warning/${warningId}`)
        .set('Cookie', adminCookie)
        .set('X-Tenant-Id', String(tenantId))
        .catch(() => {});
    }
    if (equipmentId) {
      await request(app)
        .delete(`/api/v1/equipment/${equipmentId}`)
        .set('Cookie', adminCookie)
        .set('X-Tenant-Id', String(tenantId))
        .catch(() => {});
    }
  });

  // ── cascading sub-resources on /equipment/:id ─────────────────────────────

  it('GET /equipment/:id/parts returns an array (possibly empty)', async () => {
    const res = await request(app)
      .get(`/api/v1/equipment/${equipmentId}/parts`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /equipment/:id/stop-reasons returns grouped shape (array)', async () => {
    const res = await request(app)
      .get(`/api/v1/equipment/${equipmentId}/stop-reasons`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    // If any groups exist, each must have typeId/typeName/reasons[] shape.
    for (const g of res.body) {
      expect(typeof g.typeId).toBe('number');
      expect(typeof g.typeName).toBe('string');
      expect(Array.isArray(g.reasons)).toBe(true);
    }
  });

  it('GET /equipment/:id/scrap-reasons returns grouped shape (array)', async () => {
    const res = await request(app)
      .get(`/api/v1/equipment/${equipmentId}/scrap-reasons`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    for (const g of res.body) {
      expect(typeof g.typeId).toBe('number');
      expect(Array.isArray(g.reasons)).toBe(true);
    }
  });

  it('GET /equipment/:id/orders returns an array', async () => {
    const res = await request(app)
      .get(`/api/v1/equipment/${equipmentId}/orders`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // ── IoT equipment-scope ───────────────────────────────────────────────────

  it('GET /admin/iot/stop-reasons returns flat list when no equipmentId', async () => {
    const res = await request(app)
      .get('/api/v1/admin/iot/stop-reasons')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /admin/iot/stop-reasons?equipmentId= returns equipment-scoped grouped data', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/iot/stop-reasons?equipmentId=${equipmentId}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    // When equipmentId is supplied, response uses the grouped shape.
    for (const g of res.body) {
      expect(typeof g.typeId).toBe('number');
      expect(Array.isArray(g.reasons)).toBe(true);
    }
  });

  it('GET /admin/iot/flow-designs?equipmentId= returns id+name pairs (possibly empty)', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/iot/flow-designs?equipmentId=${equipmentId}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    for (const f of res.body) {
      expect(typeof f.id).toBe('number');
      expect(typeof f.name).toBe('string');
    }
  });

  // ── warning_data PATCH — new schema (RESOLVED v) ──────────────────────────

  it('PATCH /admin/results/warning/:id with fromTime+toTime recomputes duration', async () => {
    const newFrom = new Date(Date.now() - 7200_000).toISOString(); // 2h ago
    const newTo   = new Date(Date.now() - 5400_000).toISOString(); // 1.5h ago → 30m
    const res = await request(app)
      .patch(`/api/v1/admin/results/warning/${warningId}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .send({ fromTime: newFrom, toTime: newTo, notificationText: 'phase-a updated' })
      .expect(200);
    expect(res.body.id).toBe(warningId);
    expect(res.body.notificationText).toBe('phase-a updated');
    // 30 minutes = 1800 seconds.
    expect(res.body.duration).toBe(1800);
  });

  it('PATCH /admin/results/warning/:id can update equipmentId', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/results/warning/${warningId}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .send({ equipmentId })
      .expect(200);
    expect(res.body.equipmentId).toBe(equipmentId);
  });

  // ── shift-schedules titles ────────────────────────────────────────────────

  it('GET /admin/shift-schedules/titles requires date and equipmentId', async () => {
    await request(app)
      .get('/api/v1/admin/shift-schedules/titles')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(400);
  });

  it('GET /admin/shift-schedules/titles returns an array when both params are supplied', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/v1/admin/shift-schedules/titles?date=${today}&equipmentId=${equipmentId}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // ── /admin/types and /admin/parts new query params ───────────────────────

  it('GET /admin/types?entity=&isActive= filters by both', async () => {
    const res = await request(app)
      .get('/api/v1/admin/types?entity=Equipment&isActive=true&perPage=200')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    for (const t of res.body.data) {
      expect(t.entity).toBe('Equipment');
      expect(t.isActive).toBe(true);
    }
  });

  it('GET /admin/parts?equipmentId= returns an array (possibly empty)', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/parts?equipmentId=${equipmentId}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
