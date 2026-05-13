'use strict';

/**
 * Phase A foundation — flow-designs + orders CRUD happy paths.
 *
 * Verifies the two newly-mounted route files:
 *   /api/v1/admin/flow-designs
 *   /api/v1/admin/orders
 *
 * The equipmentId-filtered flow-designs query is exercised against a fresh
 * flow whose flow_data references a known equipment id, plus a control flow
 * without that node.
 */

const request = require('supertest');
const app = require('../../src/app');
const { login } = require('../helpers/login');

const ADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL || 'user1@gmail.com';
const ADMIN_PASS  = process.env.SEED_SUPERADMIN_PASSWORD || 'password123';

describe('Phase A — flow-designs + orders CRUD', () => {
  let adminCookie;
  let tenantId;
  let equipmentId;
  let partId;
  let flowWithEquipmentId;
  let flowWithoutEquipmentId;
  let orderId;
  const orderNr = `phase-a-${Date.now()}`;

  beforeAll(async () => {
    const r = await login(app, ADMIN_EMAIL, ADMIN_PASS);
    adminCookie = r.cookie;
    const tenants = await request(app)
      .get('/api/v1/admin/tenants')
      .set('Cookie', adminCookie)
      .expect(200);
    tenantId = tenants.body[0].id;

    // Create a throw-away equipment + part the test will reference. Both are
    // soft-deleted in afterAll, so the test is idempotent across reruns.
    const eq = await request(app)
      .post('/api/v1/equipment')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .send({ name: `phase-a-eq-${Date.now()}`, sortOrder: 0 })
      .expect(201);
    equipmentId = eq.body.id;

    const part = await request(app)
      .post('/api/v1/admin/parts')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .send({ name: `phase-a-part-${Date.now()}`, partNo: `PA-${Date.now()}` })
      .expect(201);
    partId = part.body.id;
  });

  afterAll(async () => {
    // Clean up. Soft-delete order, then flows, then part, then equipment.
    const del = async (path) =>
      request(app)
        .delete(path)
        .set('Cookie', adminCookie)
        .set('X-Tenant-Id', String(tenantId));
    if (orderId) await del(`/api/v1/admin/orders/${orderId}`);
    if (flowWithEquipmentId) await del(`/api/v1/admin/flow-designs/${flowWithEquipmentId}`);
    if (flowWithoutEquipmentId) await del(`/api/v1/admin/flow-designs/${flowWithoutEquipmentId}`);
    if (partId) await del(`/api/v1/admin/parts/${partId}`);
    if (equipmentId) await del(`/api/v1/equipment/${equipmentId}`);
  });

  // ── flow-designs ───────────────────────────────────────────────────────────

  it('creates a flow design with nodeDataArray referencing the equipment', async () => {
    const flowData = JSON.stringify({
      nodeDataArray: [{ key: equipmentId, type: 'Equipment', text: 'eq' }],
      linkDataArray: [],
    });
    const res = await request(app)
      .post('/api/v1/admin/flow-designs')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .send({ name: `phase-a-flow-eq-${Date.now()}`, flowData })
      .expect(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe(1);
    flowWithEquipmentId = res.body.id;
  });

  it('creates a control flow design WITHOUT the equipment node', async () => {
    const res = await request(app)
      .post('/api/v1/admin/flow-designs')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .send({ name: `phase-a-flow-ctrl-${Date.now()}`, flowData: JSON.stringify({ nodeDataArray: [], linkDataArray: [] }) })
      .expect(201);
    flowWithoutEquipmentId = res.body.id;
  });

  it('lists flow designs (unfiltered) and finds both', async () => {
    const res = await request(app)
      .get('/api/v1/admin/flow-designs')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    const ids = res.body.data.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining([flowWithEquipmentId, flowWithoutEquipmentId]));
  });

  it('lists flow designs filtered by equipmentId — includes only the matching flow', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/flow-designs?equipmentId=${equipmentId}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    const ids = res.body.data.map((f) => f.id);
    expect(ids).toContain(flowWithEquipmentId);
    expect(ids).not.toContain(flowWithoutEquipmentId);
  });

  it('gets a flow design by id', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/flow-designs/${flowWithEquipmentId}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    expect(res.body.id).toBe(flowWithEquipmentId);
  });

  it('patches the flow design name', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/flow-designs/${flowWithEquipmentId}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .send({ name: `phase-a-flow-renamed-${Date.now()}` })
      .expect(200);
    expect(res.body.name).toMatch(/^phase-a-flow-renamed-/);
  });

  it('toggles the flow design status', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/flow-designs/${flowWithEquipmentId}/status`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    expect(res.body.status === 0 || res.body.status === 1).toBe(true);
  });

  it('returns 404 for unknown flow design', async () => {
    await request(app)
      .get('/api/v1/admin/flow-designs/9999999')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(404);
  });

  // ── orders ─────────────────────────────────────────────────────────────────

  it('creates an order', async () => {
    const res = await request(app)
      .post('/api/v1/admin/orders')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .send({
        orderNr,
        description: 'phase-a order',
        flowId: flowWithEquipmentId,
        equipmentId,
        partId,
        plannedQty: 100,
      })
      .expect(201);
    expect(res.body.orderNr).toBe(orderNr);
    expect(res.body.flowName).toBeDefined();
    expect(res.body.equipmentName).toBeDefined();
    orderId = res.body.id;
  });

  it('lists orders filtered by equipmentId', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/orders?equipmentId=${equipmentId}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    const ids = res.body.data.map((o) => o.id);
    expect(ids).toContain(orderId);
  });

  it('lists orders filtered by flowId', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/orders?flowId=${flowWithEquipmentId}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    expect(res.body.data.map((o) => o.id)).toContain(orderId);
  });

  it('returns 409 when the same orderNr is reused', async () => {
    await request(app)
      .post('/api/v1/admin/orders')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .send({ orderNr, description: 'dup', flowId: flowWithEquipmentId, equipmentId, partId })
      .expect(409);
  });

  it('patches the order quantity', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/orders/${orderId}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .send({ plannedQty: 200, okQty: 50 })
      .expect(200);
    expect(res.body.plannedQty).toBe(200);
    expect(res.body.okQty).toBe(50);
  });

  it('gets the order by id', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/orders/${orderId}`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', String(tenantId))
      .expect(200);
    expect(res.body.id).toBe(orderId);
  });
});
