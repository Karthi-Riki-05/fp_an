'use strict';

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
// Simulates an MQTT message by routing it through the full MQTT → DB → Socket.io
// pipeline. Exercises exactly the same code path a real device would.
//
// Body: { companyId, machineId, action: 'stop_start' | 'stop_end' | 'heartbeat' }
router.post('/test/machine-action', async (req, res, next) => {
  try {
    const { companyId, machineId, action } = req.body ?? {};

    if (!companyId || !machineId || !['stop_start', 'stop_end', 'heartbeat'].includes(action)) {
      return res.status(400).json({
        statusCode: 400,
        message: 'companyId, machineId, and action (stop_start|stop_end|heartbeat) are required',
      });
    }

    const cId = Number(companyId);
    const mId = Number(machineId);
    const tenant = { tenantId: cId, schemaName: `tenant_${cId}`, dbName: null, timezone: 'UTC' };

    let topic, payload;

    if (action === 'stop_start') {
      topic = `fp/v1/${cId}/machine/${mId}/stop/start`;
      payload = { start_time: new Date().toISOString() };

    } else if (action === 'stop_end') {
      // Find the most recent open machine_data row for this machine.
      const rows = await withTenant(tenant, (tx) =>
        tx.$queryRawUnsafe(
          `SELECT start_time FROM machine_data
            WHERE machine_id = $1 AND end_time IS NULL
            ORDER BY start_time DESC LIMIT 1`,
          mId,
        ),
      );

      if (!rows[0]) {
        // No open stop — the machine may already be running, or a previous Turn Off
        // happened while the machine was unconfigured (equipment_id=0).
        // Do NOT 409. Instead, directly set running_status='on' AND upsert
        // machine_status='on' so long-stop suppression is reset, then emit a
        // machine:status:changed WebSocket event so the dashboard updates.
        console.warn(`[SuperAdmin] stop_end: machine ${mId} (company ${cId}) has no open stop — refreshing status to 'on'`);

        const now = new Date().toISOString();
        const mUpdated = await withTenant(tenant, async (tx) => {
          const mRows = await tx.$queryRawUnsafe(
            `SELECT id FROM machines WHERE id = $1`, mId,
          );
          if (!mRows[0]) return null;

          const statusRows = await tx.$queryRawUnsafe(
            `SELECT id FROM machine_status WHERE machine_id = $1 LIMIT 1`, mId,
          );
          if (statusRows[0]) {
            await tx.$executeRawUnsafe(
              `UPDATE machine_status SET status = 'on'::tenant_template."MachineRunningStatus", "time" = $2 WHERE id = $1`,
              statusRows[0].id, now,
            );
          } else {
            await tx.$executeRawUnsafe(
              `INSERT INTO machine_status (machine_id, status, "time")
               VALUES ($1, 'on'::tenant_template."MachineRunningStatus", $2)`,
              mId, now,
            );
          }

          const updated = await tx.$queryRawUnsafe(
            `UPDATE machines SET running_status = 'on'::tenant_template."MachineRunningStatus",
                                 unit_connected = 'yes', last_online = NOW(), updated_at = NOW()
               WHERE id = $1
             RETURNING last_online AS "lastOnline"`,
            mId,
          );
          return updated[0];
        });

        if (!mUpdated) {
          return res.status(404).json({ statusCode: 404, message: 'machine-not-found' });
        }

        socketService.emitToTenant(cId, 'machine:status:changed', {
          machineId: mId,
          runningStatus: 'on',
          unitConnected: 'yes',
          lastOnline: mUpdated.lastOnline,
          ts: Date.now(),
        });

        return res.json({
          success: true,
          topic: `fp/v1/${cId}/machine/${mId}/status-updated`,
          payload: { action: 'no-open-stop-status-refresh', runningStatus: 'on' },
        });
      } else {
        topic = `fp/v1/${cId}/machine/${mId}/stop/end`;
        payload = {
          start_time: rows[0].start_time instanceof Date
            ? rows[0].start_time.toISOString()
            : String(rows[0].start_time),
          end_time: new Date().toISOString(),
        };
      }

    } else if (action === 'heartbeat') {
      // Fetch pin_no + unit_name required by installMachine().
      const machines = await withTenant(tenant, (tx) =>
        tx.$queryRawUnsafe(
          `SELECT pin_no AS "pinNo", unit_name AS "unitName"
             FROM machines WHERE id = $1`,
          mId,
        ),
      );
      if (!machines[0]) {
        return res.status(404).json({ statusCode: 404, message: 'machine-not-found' });
      }
      topic = `fp/v1/${cId}/machine/${mId}/heartbeat`;
      payload = {
        pin_no: machines[0].pinNo,
        unit_name: machines[0].unitName,
        firmware_version: 'admin-test-1.0.0',
        uptime: 0,
      };
    }

    // Route through the full MQTT handler pipeline (async, fire-and-forget).
    // DB writes and Socket.io events fire asynchronously after this returns.
    mqttService.routeMessage(topic, Buffer.from(JSON.stringify(payload)), {});

    res.json({ success: true, topic, payload });
  } catch (err) { next(err); }
});

module.exports = router;
