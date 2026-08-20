'use strict';

const { randomUUID } = require('crypto');
const { Router } = require('express');
const { requireRole } = require('../middleware/requireRole');
const { prisma, withTenant } = require('../prisma/client');
const mqttService = require('../services/mqtt.service');
const socketService = require('../services/socket.service');

const router = Router();
router.use(requireRole('Administrator'));

// GET /superadmin/companies
// Lists all Company-role users with a machine count from their tenant schema.
router.get('/companies', async (req, res, next) => {
  try {
    const companies = await prisma.user.findMany({
      where: {
        deletedAt: null,
        userRoles: { some: { role: { name: 'Company' } } },
      },
      select: { id: true, name: true, email: true, status: true, createdAt: true },
      orderBy: { name: 'asc' },
    });

    const result = await Promise.all(
      companies.map(async (c) => {
        const tenant = { tenantId: c.id, schemaName: `tenant_${c.id}`, dbName: null, timezone: 'UTC' };
        let machineCount = 0;
        try {
          const rows = await withTenant(tenant, (tx) =>
            tx.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM machines`),
          );
          machineCount = rows[0]?.count ?? 0;
        } catch { /* tenant schema may not exist yet */ }
        return { ...c, machineCount };
      }),
    );

    res.json({ data: result, total: result.length });
  } catch (err) { next(err); }
});

// GET /superadmin/companies/:companyId/machines
// Returns all machines from the given company's tenant schema.
router.get('/companies/:companyId/machines', async (req, res, next) => {
  try {
    const companyId = Number(req.params.companyId);
    if (!companyId) return res.status(400).json({ statusCode: 400, message: 'invalid companyId' });

    const tenant = { tenantId: companyId, schemaName: `tenant_${companyId}`, dbName: null, timezone: 'UTC' };

    const machines = await withTenant(tenant, (tx) =>
      tx.$queryRawUnsafe(`
        SELECT m.id             AS "machineId",
               m.unit_name      AS "unitName",
               m.pin_no         AS "pinNo",
               m.running_status AS "runningStatus",
               m.unit_connected AS "unitConnected",
               m.last_online    AS "lastOnline",
               m.equipment_id   AS "equipmentId",
               m.mqtt_client_id AS "mqttClientId",
               m.has_unregister_data AS "hasUnregisterData",
               e.name           AS "equipmentName"
          FROM machines m
          LEFT JOIN equipment e ON e.id = m.equipment_id
         ORDER BY m.id
      `),
    );

    res.json({ data: machines, total: machines.length, companyId });
  } catch (err) { next(err); }
});

// POST /superadmin/test/machine-action
// Simulates a device message by pushing it through the real MQTT handler
// pipeline — same code path a Raspberry Pi triggers, including auto-register,
// event_id deduplication and the Socket.io fan-out.
//
// Body: { companyId, machineId, action: 'stop_start' | 'stop_end' | 'heartbeat' }
//
// The action names are kept for the existing admin UI. They map onto the v2
// protocol as:
//   stop_start -> evt/machine  state OFF   (machine stopped)
//   stop_end   -> evt/machine  state ON    (machine restarted)
//   heartbeat  -> status/conn  online true (presence; there is no heartbeat topic)
router.post('/test/machine-action', async (req, res, next) => {
  try {
    const { companyId, machineId, action } = req.body ?? {};
    const ACTIONS = ['stop_start', 'stop_end', 'heartbeat'];

    if (!companyId || !machineId || !ACTIONS.includes(action)) {
      return res.status(400).json({
        statusCode: 400,
        message: `companyId, machineId, and action (${ACTIONS.join('|')}) are required`,
      });
    }

    const cId = Number(companyId);
    const mId = Number(machineId);
    const tenant = { tenantId: cId, schemaName: `tenant_${cId}`, dbName: null, timezone: 'UTC' };

    // v2 topics address the physical unit, not the machine, so we need the
    // machine's unit_name and pin_no to build one.
    const machines = await withTenant(tenant, (tx) =>
      tx.$queryRawUnsafe(
        `SELECT pin_no AS "pinNo", unit_name AS "unitName" FROM machines WHERE id = $1`,
        mId,
      ),
    );
    if (!machines[0]) {
      return res.status(404).json({ statusCode: 404, message: 'machine-not-found' });
    }
    const { pinNo, unitName } = machines[0];
    const now = new Date().toISOString();

    let topic;
    let payload;

    if (action === 'heartbeat') {
      topic = `fp/${cId}/${unitName}/status/conn`;
      payload = { online: true, reason: 'admin-test', fw: 'admin-test-1.0.0' };
    } else {
      // A fresh event_id each time, so repeated clicks are treated as distinct
      // events rather than silently deduplicated.
      topic = `fp/${cId}/${unitName}/evt/machine`;
      payload = {
        event_id: randomUUID(),
        pin_no: pinNo,
        state: action === 'stop_start' ? 'OFF' : 'ON',
        ts: now,
        buffered: false,
        fw: 'admin-test-1.0.0',
      };
    }

    // Await it, unlike the v1 handler which fired and forgot — the panel should
    // report a failure rather than show success while the write is still open.
    await mqttService.routeMessage(topic, Buffer.from(JSON.stringify(payload)), {});

    res.json({ success: true, topic, payload });
  } catch (err) { next(err); }
});

module.exports = router;
