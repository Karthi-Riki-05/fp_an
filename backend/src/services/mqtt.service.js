'use strict';

/**
 * MQTT subscriber — connects to the Mosquitto broker as the superuser
 * client and handles ONLY the three critical stop-data topics:
 *
 *   fp/v1/+/machine/+/stop/start   → handleStopStart
 *   fp/v1/+/machine/+/stop/end     → handleStopEnd
 *   fp/v1/+/machine/+/stop/replay  → handleStopReplay
 *
 * All other IoT interactions (heartbeat, enroll, status, firmware check)
 * are HTTP-only. The broker may receive those publishes from devices but
 * the backend is NOT subscribed to them and will not act on them.
 *
 * Business logic is delegated to iot-machine-data.service.js (same
 * functions used by the HTTP routes) so no logic is duplicated.
 */

const mqtt = require('mqtt');
const { withTenant } = require('../prisma/client');
const iotSvc = require('./iot-machine-data.service');

let _client = null;
let _socketSvc = null;

// Injected by server.js after both services are initialised.
function setSocketService(svc) {
  _socketSvc = svc;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function buildTenant(tenantId) {
  const id = parseInt(tenantId, 10);
  if (!id) throw new Error(`Invalid tenantId: ${tenantId}`);
  return { tenantId: id, schemaName: `tenant_${id}`, dbName: null, timezone: 'Europe/Stockholm' };
}

/**
 * Returns true when the message timestamp is more than 60 s away from now
 * (guards against replay attacks — design doc §8.4).
 */
function isStale(ts) {
  return ts && Math.abs(Date.now() - Number(ts)) > 60_000;
}

function productionTimeStr(startISO, endISO) {
  const mins = Math.max(0, Math.round((new Date(endISO) - new Date(startISO)) / 60_000));
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

// ── topic handlers ────────────────────────────────────────────────────────────
// Only three handlers exist. Heartbeat, enroll, status, and firmware/check
// are handled exclusively via HTTP — no MQTT handlers for those topics.

async function handleStopStart(tenantId, machineId, payload, packetId) {
  const tenant = buildTenant(tenantId);
  const mqttMsgId = packetId ? String(packetId) : null;

  try {
    // Deduplication — skip if this exact QoS-1 packet was already processed.
    if (mqttMsgId) {
      const dup = await withTenant(tenant, (tx) =>
        tx.$queryRawUnsafe(
          `SELECT id FROM machine_data WHERE mqtt_message_id = $1 LIMIT 1`,
          mqttMsgId,
        ),
      );
      if (dup[0]) {
        console.debug(`[MQTT] stop/start dup skipped msgId=${mqttMsgId}`);
        return;
      }
    }

    const result = await iotSvc.saveStopStart(tenant, {
      machine_id: parseInt(machineId, 10),
      start_time: payload.start_time,
      mqtt_message_id: mqttMsgId,
    });

    // Emit events whenever a machine_data row was inserted, regardless of whether
    // the machine was configured (success=false + machine_data_id means unconfigured
    // machine stop — we still want the dashboard to reflect the status change).
    if (result.data?.machine_data_id) {
      const evData = {
        machineId: parseInt(machineId, 10),
        machineDataId: result.data.machine_data_id,
        startTime: payload.start_time,
        equipmentId: result.data.equipmentId ?? null,
        ts: Date.now(),
      };
      _socketSvc?.emitToTenant(tenantId, 'machine:stop:started', evData);
      _socketSvc?.emitToMachine(tenantId, machineId, 'machine:stop:started', evData);
      _socketSvc?.emitToTenant(tenantId, 'machine:status:changed', {
        machineId: parseInt(machineId, 10),
        runningStatus: 'off',
        unitConnected: 'yes',
        ts: Date.now(),
      });
    }
  } catch (err) {
    console.error(`[MQTT] stop/start machine=${machineId} tenant=${tenantId}: ${err.message}`);
  }
}

async function handleStopEnd(tenantId, machineId, payload, packetId) {
  const tenant = buildTenant(tenantId);
  const mqttMsgId = packetId ? `end-${String(packetId)}` : null;

  try {
    const result = await withTenant(tenant, async (tx) => {
      // Find the matching open machine_data row by start_time (fixes the "wrong row" bug
      // documented in iot.md §2.9 and design doc §9.6).
      let rows = await tx.$queryRawUnsafe(
        `SELECT id FROM machine_data
          WHERE machine_id = $1 AND start_time = $2::timestamptz AND end_time IS NULL
          LIMIT 1`,
        parseInt(machineId, 10), payload.start_time,
      );

      if (!rows[0]) {
        // Graceful fallback: close the most recent open row.
        console.warn(`[MQTT] stop/end no exact match for start_time=${payload.start_time} machine=${machineId}; closing most recent`);
        rows = await tx.$queryRawUnsafe(
          `SELECT id FROM machine_data WHERE machine_id = $1 AND end_time IS NULL ORDER BY id DESC LIMIT 1`,
          parseInt(machineId, 10),
        );
        if (!rows[0]) return null;
      }

      const machineDataId = rows[0].id;
      const prodTime = productionTimeStr(payload.start_time, payload.end_time);

      await tx.$executeRawUnsafe(
        `UPDATE machine_data SET end_time = $2::timestamptz, production_time = $3
          WHERE id = $1`,
        machineDataId, payload.end_time, prodTime,
      );

      // Upsert machine_status → on.
      const statusRows = await tx.$queryRawUnsafe(
        `SELECT id FROM machine_status WHERE machine_id = $1 LIMIT 1`,
        parseInt(machineId, 10),
      );
      if (statusRows[0]) {
        await tx.$executeRawUnsafe(
          `UPDATE machine_status SET status = 'on'::tenant_template."MachineRunningStatus", "time" = $2 WHERE id = $1`,
          statusRows[0].id, payload.end_time,
        );
      } else {
        await tx.$executeRawUnsafe(
          `INSERT INTO machine_status (machine_id, status, "time") VALUES ($1, 'on'::tenant_template."MachineRunningStatus", $2)`,
          parseInt(machineId, 10), payload.end_time,
        );
      }

      // Refresh machine fields.
      const updated = await tx.$queryRawUnsafe(
        `UPDATE machines SET has_unregister_data = 'yes',
                              running_status = 'on'::tenant_template."MachineRunningStatus",
                              unit_connected = 'yes',
                              updated_at = NOW()
           WHERE id = $1
         RETURNING id, equipment_id AS "equipmentId", running_status AS "runningStatus",
                   unit_connected AS "unitConnected", last_online AS "lastOnline"`,
        parseInt(machineId, 10),
      );

      return { machineDataId, machine: updated[0], productionTime: prodTime };
    });

    if (result) {
      const evData = {
        machineId: parseInt(machineId, 10),
        machineDataId: result.machineDataId,
        startTime: payload.start_time,
        endTime: payload.end_time,
        productionTime: result.productionTime,
        autoRegistered: false,
        stopDataId: null,
        ts: Date.now(),
      };
      _socketSvc?.emitToTenant(tenantId, 'machine:stop:ended', evData);
      _socketSvc?.emitToMachine(tenantId, machineId, 'machine:stop:ended', evData);
      _socketSvc?.emitToTenant(tenantId, 'machine:status:changed', {
        machineId: parseInt(machineId, 10),
        runningStatus: 'on',
        unitConnected: 'yes',
        lastOnline: result.machine?.lastOnline,
        ts: Date.now(),
      });
    }
  } catch (err) {
    console.error(`[MQTT] stop/end machine=${machineId} tenant=${tenantId}: ${err.message}`);
  }
}

async function handleStopReplay(tenantId, machineId, payload) {
  const tenant = buildTenant(tenantId);
  const events = Array.isArray(payload.events) ? payload.events : [];
  const sorted = [...events].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  // Use a synthetic system actor — auto-registration needs a created_by id.
  const actor = { id: 0, email: 'mqtt-replay@system', name: 'MQTT Replay' };

  let committed = 0;
  let failedAt = null;

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    try {
      await iotSvc.saveStopEvent(tenant, actor, {
        machine_id: parseInt(machineId, 10),
        start_time: ev.start_time,
        end_time: ev.end_time,
        is_valid_data: ev.is_valid_data !== false,
      });
      committed++;
    } catch (err) {
      console.error(`[MQTT] stop/replay event ${i} machine=${machineId}: ${err.message}`);
      failedAt = i;
      break;
    }
  }

  // No ACK published — device does not subscribe to response topics.
  // Dashboard is notified via WebSocket only.
  _socketSvc?.emitToTenant(tenantId, 'machine:replay:complete', {
    machineId: parseInt(machineId, 10),
    committed,
    total: sorted.length,
    failedAt,
    ts: Date.now(),
  });
}

// ── message router ────────────────────────────────────────────────────────────

function routeMessage(topic, rawPayload, packet) {
  // topic: fp/v1/{tenantId}/machine/{machineId}/{stop/start|stop/end|stop/replay}
  const parts = topic.split('/');
  if (parts[0] !== 'fp' || parts[1] !== 'v1' || parts[3] !== 'machine') return;

  const tenantId = parts[2];
  if (!tenantId || !/^\d+$/.test(tenantId)) return;

  const machineSegment = parts[4];
  if (!machineSegment || !/^\d+$/.test(machineSegment)) return;

  let payload;
  try {
    payload = JSON.parse(rawPayload.toString());
  } catch {
    console.warn(`[MQTT] non-JSON payload on ${topic}`);
    return;
  }

  if (isStale(payload.ts)) {
    console.warn(`[MQTT] stale message rejected topic=${topic} ts=${payload.ts}`);
    return;
  }

  const eventPath = parts.slice(5).join('/');
  const packetId = packet?.messageId;

  switch (eventPath) {
    case 'stop/start':  handleStopStart(tenantId, machineSegment, payload, packetId); break;
    case 'stop/end':    handleStopEnd(tenantId, machineSegment, payload, packetId); break;
    case 'stop/replay': handleStopReplay(tenantId, machineSegment, payload); break;
    default: break; // heartbeat, status, firmware/check, enroll → HTTP-only; ignored here
  }
}

// ── connection management ─────────────────────────────────────────────────────

function connect() {
  const brokerUrl = process.env.MQTT_BROKER_URL;
  if (!brokerUrl) {
    console.warn('[MQTT] MQTT_BROKER_URL not set — MQTT subscriber disabled');
    return null;
  }

  const options = {
    username: process.env.MQTT_USERNAME || 'express-backend',
    password: process.env.MQTT_PASSWORD,
    clientId: process.env.MQTT_CLIENT_ID || `express-backend-${Date.now()}`,
    clean: true,
    reconnectPeriod: 5_000,
    connectTimeout: 30_000,
    keepalive: 60,
  };

  if (process.env.MQTT_TLS === 'true') {
    const fs = require('fs');
    if (process.env.MQTT_CA_FILE) {
      options.ca = fs.readFileSync(process.env.MQTT_CA_FILE);
    }
    options.rejectUnauthorized = process.env.MQTT_TLS_VERIFY !== 'false';
  }

  _client = mqtt.connect(brokerUrl, options);

  _client.on('connect', () => {
    console.log('[MQTT] Connected to broker:', brokerUrl);
    const topics = [
      'fp/v1/+/machine/+/stop/start',
      'fp/v1/+/machine/+/stop/end',
      'fp/v1/+/machine/+/stop/replay',
    ];
    _client.subscribe(topics, { qos: 1 }, (err) => {
      if (err) console.error('[MQTT] Subscribe error:', err.message);
      else console.log('[MQTT] Subscribed to stop topics:', topics.join(', '));
    });
  });

  _client.on('message', (topic, payload, packet) => {
    routeMessage(topic, payload, packet);
  });

  _client.on('error', (err) => {
    console.error('[MQTT] Client error:', err.message);
  });

  _client.on('reconnect', () => {
    console.log('[MQTT] Reconnecting to broker...');
  });

  _client.on('offline', () => {
    console.warn('[MQTT] Broker connection offline');
  });

  return _client;
}

function getClient() {
  return _client;
}

function disconnect() {
  if (_client) {
    _client.end(true);
    _client = null;
  }
}

module.exports = { connect, disconnect, getClient, setSocketService, routeMessage };
