'use strict';

/**
 * Resolves an MQTT topic identity to a machine row.
 *
 * MQTT topics are per PHYSICAL UNIT:   fp/{companyId}/{unitName}/...
 * The database is per MACHINE:         machines(id, unit_name, pin_no, ...)
 *
 * One Raspberry Pi carries up to 4 machines on pins 1..4, so every inbound
 * event needs (companyId, unitName, pin_no) -> machines.id. companyId doubles
 * as the tenant id: schema tenant_{companyId} (see middleware/tenant.js).
 *
 * Results are cached in-process because this lookup runs on every event from
 * every unit. The cache is invalidated on auto-register and can be cleared by
 * the admin API when a machine is re-bound.
 */

const { withTenant } = require('../prisma/client');

const TTL_MS = 5 * 60_000;
const _cache = new Map(); // key -> { machine, expires }

function cacheKey(companyId, unitName, pinNo) {
  return `${companyId}::${unitName}::${pinNo}`;
}

/** Build the tenant descriptor withTenant() expects. companyId IS the tenant id. */
function buildTenant(companyId, timezone = 'Europe/Stockholm') {
  const id = Number(companyId);
  if (!Number.isInteger(id) || id <= 0) throw new Error(`Invalid companyId: ${companyId}`);
  return { tenantId: id, schemaName: `tenant_${id}`, dbName: null, timezone };
}

function invalidate(companyId, unitName, pinNo) {
  if (pinNo == null) {
    for (const key of _cache.keys()) {
      if (key.startsWith(`${companyId}::${unitName}::`)) _cache.delete(key);
    }
    return;
  }
  _cache.delete(cacheKey(companyId, unitName, pinNo));
}

function clearCache() {
  _cache.clear();
}

const MACHINE_COLS = `
  id, equipment_id AS "equipmentId", pin_no AS "pinNo", unit_name AS "unitName",
  running_status::text AS "runningStatus", unit_connected AS "unitConnected",
  signal_type::text AS "signalType", last_online AS "lastOnline",
  is_auto_registered AS "isAutoRegistered"`;

/**
 * Look up the machine for a unit+pin, creating an unconfigured row on first
 * sighting. A new row has equipment_id = 0 and shows up in the admin IoT list
 * waiting to be bound to an equipment — same behaviour as HTTP installV1.
 *
 * Returns { machine, created }.
 */
async function resolveMachine(companyId, unitName, pinNo, opts = {}) {
  const cid = Number(companyId);
  const unit = String(unitName ?? '').trim();
  const pin = Number(pinNo);

  if (!unit) throw new Error('unitName required');
  if (!Number.isInteger(pin) || pin < 1 || pin > 4) {
    throw new Error(`pin_no must be 1..4, got ${pinNo}`);
  }

  const key = cacheKey(cid, unit, pin);
  const hit = _cache.get(key);
  if (hit && hit.expires > Date.now()) return { machine: hit.machine, created: false };

  const tenant = buildTenant(cid);

  const result = await withTenant(tenant, async (tx) => {
    const rows = await tx.$queryRawUnsafe(
      `SELECT ${MACHINE_COLS} FROM machines WHERE unit_name = $1 AND pin_no = $2 LIMIT 1`,
      unit, pin,
    );
    if (rows[0]) return { machine: rows[0], created: false };

    if (opts.autoCreate === false) return { machine: null, created: false };

    const inserted = await tx.$queryRawUnsafe(
      `INSERT INTO machines
          (equipment_id, pin_no, unit_name, wifi_id, bluetooth_id,
           running_status, unit_connected, signal_type, is_auto_registered,
           firmware_version, installation_date, last_online, created_at, updated_at)
       VALUES
          (0, $1, $2, $3, '*',
           'on'::tenant_template."MachineRunningStatus", 'yes',
           'on'::tenant_template."MachineSignalType", 'yes',
           $4, NOW(), NOW(), NOW(), NOW())
       RETURNING ${MACHINE_COLS}`,
      pin, unit, opts.ip ?? null, opts.firmware ?? null,
    );
    return { machine: inserted[0], created: true };
  });

  if (result.machine) {
    _cache.set(key, { machine: result.machine, expires: Date.now() + TTL_MS });
  }
  return result;
}

/** All machines belonging to one physical unit, pin-ordered. */
async function listUnitMachines(companyId, unitName) {
  return withTenant(buildTenant(companyId), (tx) =>
    tx.$queryRawUnsafe(
      `SELECT ${MACHINE_COLS} FROM machines WHERE unit_name = $1 ORDER BY pin_no`,
      String(unitName).trim(),
    ),
  );
}

module.exports = { buildTenant, resolveMachine, listUnitMachines, invalidate, clearCache };
