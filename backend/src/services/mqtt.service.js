'use strict';

/**
 * MQTT 5.0 subscriber — FP Analyzer v2 protocol.
 *
 * Implements the ingestion half of the IoT MQTT architecture: per-unit topics,
 * a unified ON/OFF machine event, client-generated event ids for idempotency,
 * and LWT-based presence. Replaces the v1 scheme (per-machine topics, split
 * stop/start + stop/end correlated by timestamp string, packet-id dedup).
 *
 * Topics consumed (device -> server):
 *   fp/{companyId}/{unit}/evt/machine       machine ON/OFF transition
 *   fp/{companyId}/{unit}/evt/ota           OTA apply progress
 *   fp/{companyId}/{unit}/status/conn       presence; retained, also the LWT
 *   fp/{companyId}/{unit}/status/machines   retained snapshot of all pins
 *   fp/{companyId}/{unit}/req/{op}          request; op = register | version | login
 *
 * Topics published (server -> device):
 *   fp/{companyId}/{unit}/resp/{op}         reply, echoing Correlation Data
 *   fp/{companyId}/{unit}/cmd/config        pin enable + filter times (retained)
 *   fp/{companyId}/{unit}/cmd/ota           firmware URL + sha256
 *
 * companyId doubles as the tenant id — schema tenant_{companyId}.
 * pin_no inside the payload selects which of the unit's machines the event is for.
 *
 * The binary itself never crosses MQTT: cmd/ota carries a URL and a SHA-256,
 * and the device fetches the ZIP over HTTPS.
 */

const mqtt = require('mqtt');
const { withTenant } = require('../prisma/client');
const iotSvc = require('./iot-machine-data.service');
const unitResolver = require('./unit-resolver.service');
const mqttAuth = require('./mqtt-auth.service');
const firmwareSvc = require('./firmware.service');

let _client = null;
let _socketSvc = null;

const TOPICS = [
  'fp/+/+/evt/machine',
  'fp/+/+/evt/ota',
  'fp/+/+/status/conn',
  'fp/+/+/status/machines',
  'fp/+/+/req/+',
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function setSocketService(svc) {
  _socketSvc = svc;
}

// ── validation ───────────────────────────────────────────────────────────────

/**
 * Timestamps are the CAPTURE time, so buffered events are legitimately old and
 * must never be rejected for age — idempotency (event_id), not a freshness
 * window, is what stops replays here. We only reject values that cannot be real.
 */
function parseEventTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime();
  if (ms < Date.UTC(2020, 0, 1)) return null;              // implausibly old
  if (ms > Date.now() + 24 * 3600_000) return null;        // clock far in the future
  return d.toISOString();
}

function productionTimeStr(startISO, endISO) {
  const mins = Math.max(0, Math.round((new Date(endISO) - new Date(startISO)) / 60_000));
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

// ── event handlers ───────────────────────────────────────────────────────────

/**
 * evt/machine — the unified transition.
 *   state "OFF" = machine stopped  -> open a machine_data stop row
 *   state "ON"  = machine restarted -> close the open stop row
 */
async function handleMachineEvent(companyId, unitName, payload) {
  const eventId = String(payload.event_id ?? '').toLowerCase();
  if (!UUID_RE.test(eventId)) {
    console.warn(`[MQTT] evt/machine rejected: missing/invalid event_id unit=${unitName} company=${companyId}`);
    return;
  }

  const state = String(payload.state ?? '').toUpperCase();
  if (state !== 'ON' && state !== 'OFF') {
    console.warn(`[MQTT] evt/machine rejected: state must be ON|OFF, got "${payload.state}"`);
    return;
  }

  const ts = parseEventTime(payload.ts);
  if (!ts) {
    console.warn(`[MQTT] evt/machine rejected: unparseable ts="${payload.ts}" unit=${unitName}`);
    return;
  }

  const buffered = payload.buffered === true;
  const seq = Number.isFinite(Number(payload.seq)) ? Number(payload.seq) : null;

  let machine;
  try {
    const resolved = await unitResolver.resolveMachine(companyId, unitName, payload.pin_no, {
      firmware: payload.fw ?? null,
    });
    machine = resolved.machine;
    if (resolved.created) {
      console.log(`[MQTT] auto-registered machine id=${machine.id} unit=${unitName} pin=${payload.pin_no} company=${companyId}`);
      _socketSvc?.emitToTenant(companyId, 'machine:enrolled', {
        machineId: machine.id, unitName, pinNo: machine.pinNo, ts: Date.now(),
      });
    }
  } catch (err) {
    console.error(`[MQTT] evt/machine resolve failed unit=${unitName} company=${companyId}: ${err.message}`);
    return;
  }

  const tenant = unitResolver.buildTenant(companyId);

  // Idempotency gate. The partial unique indexes on (machine_id, event_id) and
  // (machine_id, end_event_id) are the real guarantee; this check just avoids
  // doing the work twice in the common case.
  const seen = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `SELECT id FROM machine_data
        WHERE machine_id = $1 AND (event_id = $2::uuid OR end_event_id = $2::uuid) LIMIT 1`,
      machine.id, eventId,
    ),
  );
  if (seen[0]) {
    console.debug(`[MQTT] duplicate event_id=${eventId} machine=${machine.id} — ignored`);
    return;
  }

  if (seq !== null) await checkSequenceGap(tenant, companyId, machine, seq);

  if (state === 'OFF') await applyMachineOff(companyId, tenant, machine, eventId, ts, seq, buffered);
  else                 await applyMachineOn(companyId, tenant, machine, eventId, ts, buffered);
}

/** Machine stopped — open a stop row. */
async function applyMachineOff(companyId, tenant, machine, eventId, ts, seq, buffered) {
  try {
    const result = await iotSvc.saveStopStart(tenant, {
      machine_id: machine.id,
      start_time: ts,
      event_id: eventId,
      seq,
      buffered,
    });

    const machineDataId = result.data?.machine_data_id;
    if (!machineDataId) return; // long-stop continuation — nothing new recorded

    const ev = {
      machineId: machine.id,
      machineDataId,
      unitName: machine.unitName,
      pinNo: machine.pinNo,
      startTime: ts,
      equipmentId: result.data?.equipmentId ?? machine.equipmentId ?? null,
      buffered,
      eventId,
      ts: Date.now(),
    };
    _socketSvc?.emitToTenant(companyId, 'machine:stop:started', ev);
    _socketSvc?.emitToMachine(companyId, machine.id, 'machine:stop:started', ev);
    _socketSvc?.emitToTenant(companyId, 'machine:status:changed', {
      machineId: machine.id, runningStatus: 'off', unitConnected: 'yes', ts: Date.now(),
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      console.debug(`[MQTT] event_id=${eventId} raced a duplicate — ignored`);
      return;
    }
    console.error(`[MQTT] OFF machine=${machine.id} company=${companyId}: ${err.message}`);
  }
}

/** Machine restarted — close the open stop row. */
async function applyMachineOn(companyId, tenant, machine, eventId, ts, buffered) {
  try {
    const result = await withTenant(tenant, async (tx) => {
      // Close the most recent still-open stop row. No timestamp string matching:
      // the ON event does not need to know when the stop began.
      const open = await tx.$queryRawUnsafe(
        `SELECT id, start_time AS "startTime" FROM machine_data
          WHERE machine_id = $1 AND end_time IS NULL
          ORDER BY start_time DESC NULLS LAST, id DESC LIMIT 1`,
        machine.id,
      );

      await tx.$executeRawUnsafe(
        `UPDATE machines SET running_status = 'on'::tenant_template."MachineRunningStatus",
                             unit_connected = 'yes',
                             has_unregister_data = 'yes',
                             last_online = NOW(),
                             updated_at = NOW()
          WHERE id = $1`,
        machine.id,
      );

      const statusRows = await tx.$queryRawUnsafe(
        `SELECT id FROM machine_status WHERE machine_id = $1 LIMIT 1`, machine.id,
      );
      if (statusRows[0]) {
        await tx.$executeRawUnsafe(
          `UPDATE machine_status SET status = 'on'::tenant_template."MachineRunningStatus", "time" = $2 WHERE id = $1`,
          statusRows[0].id, ts,
        );
      } else {
        await tx.$executeRawUnsafe(
          `INSERT INTO machine_status (machine_id, status, "time")
           VALUES ($1, 'on'::tenant_template."MachineRunningStatus", $2)`,
          machine.id, ts,
        );
      }

      if (!open[0]) return { machineDataId: null, productionTime: null };

      const prodTime = open[0].startTime
        ? productionTimeStr(open[0].startTime, ts)
        : null;

      await tx.$executeRawUnsafe(
        `UPDATE machine_data
            SET end_time = $2::timestamptz, production_time = $3, end_event_id = $4::uuid
          WHERE id = $1`,
        open[0].id, ts, prodTime, eventId,
      );

      return { machineDataId: open[0].id, startTime: open[0].startTime, productionTime: prodTime };
    });

    const ev = {
      machineId: machine.id,
      machineDataId: result.machineDataId,
      unitName: machine.unitName,
      pinNo: machine.pinNo,
      startTime: result.startTime ?? null,
      endTime: ts,
      productionTime: result.productionTime,
      buffered,
      eventId,
      ts: Date.now(),
    };
    _socketSvc?.emitToTenant(companyId, 'machine:stop:ended', ev);
    _socketSvc?.emitToMachine(companyId, machine.id, 'machine:stop:ended', ev);
    _socketSvc?.emitToTenant(companyId, 'machine:status:changed', {
      machineId: machine.id, runningStatus: 'on', unitConnected: 'yes', ts: Date.now(),
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      console.debug(`[MQTT] end_event_id=${eventId} raced a duplicate — ignored`);
      return;
    }
    console.error(`[MQTT] ON machine=${machine.id} company=${companyId}: ${err.message}`);
  }
}

/**
 * status/conn — presence. Published retained by the device on connect, and by
 * the broker as the Last Will when a unit drops without disconnecting cleanly.
 * This is what replaces the 180 s HTTP heartbeat.
 */
async function handleConnStatus(companyId, unitName, payload) {
  const online = payload.online === true;
  const reason = String(payload.reason ?? (online ? 'connect' : 'lwt'));

  try {
    await mqttAuth.touchUnit(companyId, unitName, payload.fw ?? null);

    // Presence is a property of the physical unit, so it applies to every
    // machine on that unit.
    await withTenant(unitResolver.buildTenant(companyId), (tx) =>
      tx.$executeRawUnsafe(
        `UPDATE machines
            SET unit_connected   = $2,
                last_online      = CASE WHEN $3 THEN NOW() ELSE last_online END,
                firmware_version = COALESCE($4, firmware_version),
                wifi_id          = COALESCE($5, wifi_id),
                updated_at       = NOW()
          WHERE unit_name = $1`,
        unitName, online ? 'yes' : 'no', online, payload.fw ?? null, payload.ip ?? null,
      ),
    );

    unitResolver.invalidate(companyId, unitName);

    _socketSvc?.emitToTenant(companyId, online ? 'machine:unit:online' : 'machine:unit:offline', {
      unitName, online, reason, firmware: payload.fw ?? null, ip: payload.ip ?? null, ts: Date.now(),
    });

    console.log(`[MQTT] unit ${unitName} (company ${companyId}) ${online ? 'ONLINE' : `OFFLINE (${reason})`}`);
  } catch (err) {
    console.error(`[MQTT] status/conn unit=${unitName} company=${companyId}: ${err.message}`);
  }
}

/**
 * status/machines — retained snapshot of every pin on the unit. Lets a
 * restarted backend or a rejoining dashboard learn current state without
 * waiting for the next transition.
 */
async function handleMachinesSnapshot(companyId, unitName, payload) {
  const machines = Array.isArray(payload.machines) ? payload.machines : [];
  if (machines.length === 0) return;

  const summary = [];
  for (const m of machines) {
    try {
      const { machine } = await unitResolver.resolveMachine(companyId, unitName, m.pin_no, {
        firmware: payload.fw ?? null,
        autoCreate: m.enabled !== false,
      });
      if (!machine) continue;
      summary.push({
        machineId: machine.id,
        pinNo: machine.pinNo,
        reportedState: String(m.state ?? '').toUpperCase() || null,
        dbState: machine.runningStatus,
        enabled: m.enabled !== false,
      });
    } catch (err) {
      console.warn(`[MQTT] snapshot pin=${m.pin_no} unit=${unitName}: ${err.message}`);
    }
  }

  const drift = summary.filter((s) => s.reportedState && s.reportedState.toLowerCase() !== s.dbState);
  if (drift.length > 0) {
    // Reported by the device but not reconciled automatically — closing or
    // opening rows from a snapshot would invent events that never happened.
    console.warn(`[MQTT] state drift unit=${unitName} company=${companyId}: ${JSON.stringify(drift)}`);
  }

  if (Number(payload.dropped_count) > 0) {
    console.warn(`[MQTT] unit=${unitName} company=${companyId} reported dropped_count=${payload.dropped_count} — local buffer overflowed`);
  }

  _socketSvc?.emitToTenant(companyId, 'machine:unit:snapshot', {
    unitName, machines: summary, drift, firmware: payload.fw ?? null,
    droppedCount: Number(payload.dropped_count) || 0, ts: Date.now(),
  });
}

// ── publishing ───────────────────────────────────────────────────────────────

/**
 * Publish to a device topic. Refuses anything outside fp/{companyId}/{unit}/
 * so a malformed or hostile request can never make the backend — which holds
 * broker superuser rights — publish into another tenant's subtree.
 */
function publish(topic, payload, opts = {}) {
  if (!_client?.connected) {
    console.warn(`[MQTT] publish skipped, broker not connected: ${topic}`);
    return false;
  }
  if (!/^fp\/\d+\/[^/+#]+\//.test(topic)) {
    console.error(`[MQTT] refusing to publish to unsafe topic: ${topic}`);
    return false;
  }
  const options = { qos: opts.qos ?? 1, retain: opts.retain === true };
  if (opts.correlationData) {
    options.properties = { correlationData: opts.correlationData };
  }
  _client.publish(topic, JSON.stringify(payload), options, (err) => {
    if (err) console.error(`[MQTT] publish failed ${topic}: ${err.message}`);
  });
  return true;
}

/**
 * Reply to a req/{op}. MQTT 5 devices supply a Response Topic and Correlation
 * Data; the topic is validated against the caller's own subtree before use, and
 * falls back to the conventional resp/{op} when absent (MQTT 3.1.1 clients).
 */
function reply(companyId, unitName, op, body, packet) {
  const fallback = `fp/${companyId}/${unitName}/resp/${op}`;
  const requested = packet?.properties?.responseTopic;
  const prefix = `fp/${companyId}/${unitName}/`;

  let topic = fallback;
  if (requested) {
    if (String(requested).startsWith(prefix)) topic = String(requested);
    else console.warn(`[MQTT] ignoring out-of-subtree responseTopic "${requested}" from ${unitName}`);
  }

  return publish(topic, body, {
    qos: 1,
    correlationData: packet?.properties?.correlationData,
  });
}

// ── request / response ───────────────────────────────────────────────────────

async function handleRequest(companyId, unitName, op, payload, packet) {
  // req_id is echoed in the body as well as in Correlation Data, so 3.1.1
  // clients can correlate without MQTT 5 properties.
  const reqId = payload.req_id ?? null;

  try {
    switch (op) {
      case 'register': return await handleRegisterRequest(companyId, unitName, payload, packet, reqId);
      case 'version':  return await handleVersionRequest(companyId, unitName, payload, packet, reqId);
      case 'login':    return await handleLoginRequest(companyId, unitName, payload, packet, reqId);
      default:
        console.warn(`[MQTT] unknown req op "${op}" from ${unitName}`);
        return reply(companyId, unitName, op, { req_id: reqId, success: false, reason: 'unknown-op' }, packet);
    }
  } catch (err) {
    console.error(`[MQTT] req/${op} unit=${unitName} company=${companyId}: ${err.message}`);
    return reply(companyId, unitName, op, { req_id: reqId, success: false, reason: 'server-error' }, packet);
  }
}

/**
 * req/register — resolve (unit, pin) to a machine id, creating the row on first
 * sighting. Replaces installV1's register role. Idempotent: asking twice for the
 * same pin returns the same machine_id.
 */
async function handleRegisterRequest(companyId, unitName, payload, packet, reqId) {
  const pin = Number(payload.pin_no);
  if (!Number.isInteger(pin) || pin < 1 || pin > 4) {
    return reply(companyId, unitName, 'register',
      { req_id: reqId, success: false, reason: 'pin_no must be 1..4' }, packet);
  }

  const { machine, created } = await unitResolver.resolveMachine(companyId, unitName, pin, {
    firmware: payload.fw ?? null,
    ip: payload.ip ?? null,
  });

  if (created) {
    console.log(`[MQTT] req/register created machine id=${machine.id} unit=${unitName} pin=${pin}`);
    _socketSvc?.emitToTenant(companyId, 'machine:enrolled', {
      machineId: machine.id, unitName, pinNo: pin, ts: Date.now(),
    });
  }

  return reply(companyId, unitName, 'register', {
    req_id: reqId,
    success: true,
    pin_no: pin,
    machine_id: machine.id,
    // equipment_id 0 means an operator has not bound this machine yet; the unit
    // should keep reporting regardless.
    configured: Number(machine.equipmentId) > 0,
  }, packet);
}

/**
 * req/version — the server decides whether an update applies. The device does
 * no version arithmetic, which is what the v1 string comparison got wrong.
 */
async function handleVersionRequest(companyId, unitName, payload, packet, reqId) {
  const result = await firmwareSvc.checkUpdate(payload.fw ?? payload.version);

  if (payload.fw) {
    await mqttAuth.touchUnit(companyId, unitName, payload.fw).catch(() => {});
  }

  return reply(companyId, unitName, 'version', {
    req_id: reqId,
    success: true,
    update_available: result.updateAvailable === true,
    version: result.version ?? null,
    url: result.url ?? null,
    sha256: result.sha256 ?? null,
    size: result.size ?? null,
    notes: result.notes ?? '',
    mandatory: result.mandatory === true,
  }, packet);
}

/**
 * req/login — a compatibility stub. Reaching this topic already required valid
 * broker credentials, so the connection itself is the authentication; there is
 * no password to check a second time.
 */
async function handleLoginRequest(companyId, unitName, payload, packet, reqId) {
  await mqttAuth.touchUnit(companyId, unitName, payload.fw ?? null).catch(() => {});
  return reply(companyId, unitName, 'login', {
    req_id: reqId,
    success: true,
    reason: 'ok',
    company_id: companyId,
    unit: unitName,
  }, packet);
}

// ── commands (server -> device) ──────────────────────────────────────────────

const OTA_STATES = ['downloading', 'verifying', 'applying', 'success', 'failed'];

/**
 * cmd/ota — push a firmware update to one unit. The release must carry a
 * SHA-256; firmware.assertOtaReady() refuses otherwise, because the device
 * install path runs as root and an unverified package is a root shell.
 */
async function sendOtaCommand(companyId, unitName, opts = {}) {
  const release = await firmwareSvc.assertOtaReady();
  const cmdId = require('crypto').randomUUID();

  const ok = publish(`fp/${companyId}/${unitName}/cmd/ota`, {
    cmd_id: cmdId,
    version: release.version,
    url: release.url,
    sha256: release.sha256,
    size: release.size,
    force: opts.force === true,
  }, { qos: 1 });

  if (!ok) throw Object.assign(new Error('broker not connected'), { statusCode: 503 });

  await mqttAuth.setOtaState(companyId, unitName, {
    state: 'downloading', version: release.version, cmdId, detail: 'command sent',
  }).catch((e) => console.warn(`[MQTT] ota state write failed: ${e.message}`));

  return { cmdId, version: release.version, unitName, companyId };
}

/**
 * cmd/config — pin enable flags and GPIO debounce windows. Retained, so a unit
 * rejoining after a reboot picks up current settings without asking.
 */
function sendConfigCommand(companyId, unitName, config = {}) {
  const cmdId = require('crypto').randomUUID();
  const body = { cmd_id: cmdId };

  if (config.off_on_ms != null) body.off_on_ms = Number(config.off_on_ms);
  if (config.on_off_ms != null) body.on_off_ms = Number(config.on_off_ms);
  if (config.pins && typeof config.pins === 'object') {
    body.pins = {};
    for (const pin of ['1', '2', '3', '4']) {
      if (config.pins[pin] != null) body.pins[pin] = config.pins[pin] === true;
    }
  }

  const ok = publish(`fp/${companyId}/${unitName}/cmd/config`, body, { qos: 1, retain: true });
  if (!ok) throw Object.assign(new Error('broker not connected'), { statusCode: 503 });
  return { cmdId, unitName, companyId, config: body };
}

/** cmd/reboot — delayed restart. */
function sendRebootCommand(companyId, unitName, delaySeconds = 5) {
  const cmdId = require('crypto').randomUUID();
  const ok = publish(`fp/${companyId}/${unitName}/cmd/reboot`,
    { cmd_id: cmdId, delay_s: Number(delaySeconds) || 5 }, { qos: 1 });
  if (!ok) throw Object.assign(new Error('broker not connected'), { statusCode: 503 });
  return { cmdId, unitName, companyId };
}

/** evt/ota — the device's progress report for a cmd/ota it received. */
async function handleOtaEvent(companyId, unitName, payload) {
  const state = String(payload.state ?? '').toLowerCase();
  if (!OTA_STATES.includes(state)) {
    console.warn(`[MQTT] evt/ota unknown state "${payload.state}" from ${unitName}`);
    return;
  }

  const detail = String(payload.detail ?? '').slice(0, 500);
  const version = payload.version ?? null;

  try {
    await mqttAuth.setOtaState(companyId, unitName, {
      state, version, detail, cmdId: payload.cmd_id ?? null,
    });
  } catch (err) {
    console.warn(`[MQTT] evt/ota state write failed unit=${unitName}: ${err.message}`);
  }

  if (state === 'success' && version) {
    await mqttAuth.touchUnit(companyId, unitName, version).catch(() => {});
  }
  if (state === 'failed') {
    console.error(`[MQTT] OTA FAILED unit=${unitName} company=${companyId} version=${version}: ${detail}`);
  }

  _socketSvc?.emitToTenant(companyId, 'machine:ota:progress', {
    unitName, state, version, detail, cmdId: payload.cmd_id ?? null, ts: Date.now(),
  });
}

/** Monotonic seq lets us notice events that never arrived, instead of finding out months later. */
async function checkSequenceGap(tenant, companyId, machine, seq) {
  try {
    const rows = await withTenant(tenant, (tx) =>
      tx.$queryRawUnsafe(`SELECT last_event_seq AS "lastSeq" FROM machines WHERE id = $1`, machine.id),
    );
    const last = rows[0]?.lastSeq != null ? Number(rows[0].lastSeq) : null;

    if (last !== null && seq > last + 1) {
      const missing = seq - last - 1;
      console.warn(`[MQTT] sequence gap machine=${machine.id} unit=${machine.unitName}: expected ${last + 1}, got ${seq} (${missing} event(s) missing)`);
      _socketSvc?.emitToTenant(companyId, 'machine:sequence:gap', {
        machineId: machine.id, unitName: machine.unitName,
        expected: last + 1, received: seq, missing, ts: Date.now(),
      });
    }

    // Never move the counter backwards — buffered replay arrives out of order.
    if (last === null || seq > last) {
      await withTenant(tenant, (tx) =>
        tx.$executeRawUnsafe(`UPDATE machines SET last_event_seq = $2 WHERE id = $1`, machine.id, seq),
      );
    }
  } catch (err) {
    console.warn(`[MQTT] seq check machine=${machine.id}: ${err.message}`);
  }
}

function isUniqueViolation(err) {
  return err?.code === 'P2010' && /23505/.test(err?.meta?.code ?? '')
      || /duplicate key value violates unique constraint/i.test(err?.message ?? '');
}

// ── router ───────────────────────────────────────────────────────────────────

function routeMessage(topic, rawPayload, packet) {
  // fp/{companyId}/{unit}/{class}/{name}
  const parts = topic.split('/');
  if (parts.length < 5 || parts[0] !== 'fp') return;

  const [, companyIdRaw, unitName, cls, name] = parts;
  if (!/^\d+$/.test(companyIdRaw)) {
    console.warn(`[MQTT] non-numeric company segment in topic: ${topic}`);
    return;
  }
  const companyId = Number(companyIdRaw);
  if (!unitName) return;

  let payload;
  try {
    payload = JSON.parse(rawPayload.toString());
  } catch {
    // A zero-length retained message is how a retained topic gets cleared.
    if (rawPayload.length > 0) console.warn(`[MQTT] non-JSON payload on ${topic}`);
    return;
  }

  if (cls === 'evt' && name === 'machine')      return handleMachineEvent(companyId, unitName, payload);
  if (cls === 'evt' && name === 'ota')          return handleOtaEvent(companyId, unitName, payload);
  if (cls === 'status' && name === 'conn')      return handleConnStatus(companyId, unitName, payload);
  if (cls === 'status' && name === 'machines')  return handleMachinesSnapshot(companyId, unitName, payload);
  if (cls === 'req')                            return handleRequest(companyId, unitName, name, payload, packet);
  // resp/* and cmd/* are server-published; seeing one back means a device echoed
  // it. Ignore rather than loop.
}

// ── connection ───────────────────────────────────────────────────────────────

function connect() {
  const brokerUrl = process.env.MQTT_BROKER_URL;
  if (!brokerUrl) {
    console.warn('[MQTT] MQTT_BROKER_URL not set — MQTT subscriber disabled');
    return null;
  }

  const options = {
    protocolVersion: 5,                       // required for the phase-2 req/resp topics
    username: process.env.MQTT_USERNAME || 'fp-backend',
    password: process.env.MQTT_PASSWORD,
    clientId: process.env.MQTT_CLIENT_ID || 'fp-backend',
    clean: false,                             // persistent session — queue while we restart
    properties: { sessionExpiryInterval: 86_400 },
    reconnectPeriod: 5_000,
    connectTimeout: 30_000,
    keepalive: 60,
    resubscribe: true,
  };

  if (process.env.MQTT_TLS === 'true' || brokerUrl.startsWith('mqtts://')) {
    const fs = require('fs');
    if (process.env.MQTT_CA_FILE) options.ca = fs.readFileSync(process.env.MQTT_CA_FILE);
    if (process.env.MQTT_CERT_FILE) options.cert = fs.readFileSync(process.env.MQTT_CERT_FILE);
    if (process.env.MQTT_KEY_FILE) options.key = fs.readFileSync(process.env.MQTT_KEY_FILE);
    options.rejectUnauthorized = process.env.MQTT_TLS_VERIFY !== 'false';
  }

  _client = mqtt.connect(brokerUrl, options);

  _client.on('connect', () => {
    console.log(`[MQTT] Connected to broker: ${brokerUrl} (MQTT 5.0)`);
    _client.subscribe(TOPICS, { qos: 1 }, (err) => {
      if (err) console.error('[MQTT] Subscribe error:', err.message);
      else console.log('[MQTT] Subscribed:', TOPICS.join(', '));
    });
  });

  _client.on('message', (topic, payload, packet) => {
    Promise.resolve(routeMessage(topic, payload, packet)).catch((err) =>
      console.error(`[MQTT] unhandled error on ${topic}: ${err.message}`),
    );
  });

  _client.on('error',     (err) => console.error('[MQTT] Client error:', err.message));
  _client.on('reconnect', ()    => console.log('[MQTT] Reconnecting to broker...'));
  _client.on('offline',   ()    => console.warn('[MQTT] Broker connection offline'));

  return _client;
}

function getClient() { return _client; }

function disconnect() {
  if (_client) {
    _client.end(true);
    _client = null;
  }
}

module.exports = {
  connect, disconnect, getClient, setSocketService, routeMessage, TOPICS,
  publish, sendOtaCommand, sendConfigCommand, sendRebootCommand,
};
