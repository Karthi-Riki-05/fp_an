'use strict';

/**
 * User-facing "units" endpoints (E2). Surfaces the operator view of IoT
 * units (rows in `machines`) and lets the operator register stops for
 * un-registered MachineData buckets.
 *
 * Legacy counterparts:
 *   Frontend/User/DashboardController::units / getUnitStopData
 *   Frontend/CompanyUserController::getUnitStopSaveDlg / saveUnitStopData
 */

const { withTenant, prisma } = require('../prisma/client');
const { NotFoundError, BadRequestError } = require('../errors');
const { flowContainsEquipment } = require('./admin-flow-designs.service');
const { redis } = require('../redis/client');

// Redis key for the 24h "last-used" form prefill, scoped per equipment.
const PREFILL_TTL_SEC = 24 * 60 * 60;
const prefillKey = (companyUserId, equipmentId) =>
  `stop_form:${companyUserId}:${equipmentId}`;

// ── list units (operator card view) ────────────────────────────────────────

async function listUnits(tenant) {
  return withTenant(tenant, async (tx) => {
    const rows = await tx.$queryRawUnsafe(
      `SELECT m.id,
              m.unit_name             AS "unitName",
              m.equipment_id          AS "equipmentId",
              e.name                  AS "equipmentName",
              m.signal_type           AS "signalType",
              m.running_status        AS "runningStatus",
              m.unit_connected        AS "unitConnected",
              m.has_unregister_data   AS "hasUnregisterData",
              m.last_online           AS "lastOnline",
              m.updated_at            AS "updatedAt",
              COALESCE(uc.cnt, 0)::int AS "unregisteredCount"
       FROM machines m
       LEFT JOIN equipment e ON e.id = m.equipment_id
       LEFT JOIN (
         SELECT machine_id, COUNT(*) AS cnt
         FROM machine_data
         WHERE is_registered = 'no' AND is_valid_data = true
         GROUP BY machine_id
       ) uc ON uc.machine_id = m.id
       WHERE m.equipment_id > 0
       ORDER BY (m.has_unregister_data = 'yes') DESC, uc.cnt DESC NULLS LAST, m.id`,
    );
    return rows;
  });
}

// ── live status snapshot (polled every 5s by the operator UI) ──────────────

async function listStatus(tenant, machineIds) {
  const ids = (Array.isArray(machineIds) ? machineIds : [])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return [];
  return withTenant(tenant, async (tx) => {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const machines = await tx.$queryRawUnsafe(
      `SELECT id,
              running_status      AS "runningStatus",
              unit_connected      AS "unitConnected",
              has_unregister_data AS "hasUnregisterData",
              signal_type         AS "signalType",
              updated_at          AS "updatedAt"
       FROM machines
       WHERE id IN (${placeholders})`,
      ...ids,
    );
    // Latest MachineData row per machine (for the "currently running stop"
    // injection on the frontend — includes is_registered to flag pre-reg state).
    const latest = await tx.$queryRawUnsafe(
      `SELECT DISTINCT ON (machine_id)
              machine_id      AS "machineId",
              id              AS "machineDataId",
              start_time      AS "startTime",
              end_time        AS "endTime",
              is_registered   AS "isRegistered"
       FROM machine_data
       WHERE machine_id IN (${placeholders})
       ORDER BY machine_id, id DESC`,
      ...ids,
    );
    const byMachine = new Map(latest.map((r) => [r.machineId, r]));
    return machines.map((m) => {
      const l = byMachine.get(m.id);
      return {
        ...m,
        startTime: l?.startTime ?? null,
        endTime: l?.endTime ?? null,
        machineDataId: l?.machineDataId ?? null,
        latestIsRegistered: l?.isRegistered ?? null,
      };
    });
  });
}

// ── 24h "last-used" form prefill (Redis) ───────────────────────────────────

async function getStopFormPrefill(tenant, equipmentId) {
  const key = prefillKey(tenant.companyUserId, equipmentId);
  const raw = await redis.get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function setStopFormPrefill(tenant, equipmentId, payload) {
  const key = prefillKey(tenant.companyUserId, equipmentId);
  await redis.set(key, JSON.stringify(payload), 'EX', PREFILL_TTL_SEC);
}

// ── per-user unit list display preferences (hidden + sort order) ───────────

async function getUnitWebSettings(userId) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { tablePreferences: true },
  });
  const t = (u && u.tablePreferences) || {};
  return {
    unchecked: Array.isArray(t?.unit_web_settings?.unchecked) ? t.unit_web_settings.unchecked : [],
    order: Array.isArray(t?.order) ? t.order : [],
  };
}

async function saveUnitWebSettings(userId, dto) {
  const unchecked = Array.isArray(dto.unchecked) ? dto.unchecked.map(Number).filter(Number.isInteger) : [];
  const order = Array.isArray(dto.order) ? dto.order.map(Number).filter(Number.isInteger) : [];
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { tablePreferences: true } });
  const cur = (u && u.tablePreferences) || {};
  const next = {
    ...cur,
    unit_web_settings: { ...(cur.unit_web_settings || {}), unchecked },
    order,
  };
  await prisma.user.update({ where: { id: userId }, data: { tablePreferences: next } });
  return { unchecked, order };
}

// ── list un-registered MachineData buckets for one unit ────────────────────

async function listUnregistered(tenant, machineId, q) {
  const page = Math.max(1, Number(q.page) || 1);
  const perPage = Math.max(1, Math.min(100, Number(q.perPage) || 25));
  const skip = (page - 1) * perPage;
  return withTenant(tenant, async (tx) => {
    const exists = await tx.$queryRawUnsafe(
      `SELECT 1 FROM machines WHERE id = $1`, machineId,
    );
    if (!exists[0]) throw new NotFoundError('machine-not-found');

    const rows = await tx.$queryRawUnsafe(
      `SELECT id,
              machine_id       AS "machineId",
              start_time       AS "startTime",
              end_time         AS "endTime",
              production_time  AS "productionTime",
              is_valid_data    AS "isValidData"
       FROM machine_data
       WHERE machine_id = $1
         AND is_registered = 'no'
         AND is_valid_data = true
       ORDER BY id DESC
       LIMIT ${perPage} OFFSET ${skip}`,
      machineId,
    );
    const total = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count
       FROM machine_data
       WHERE machine_id = $1 AND is_registered = 'no' AND is_valid_data = true`,
      machineId,
    );
    return { data: rows, total: Number(total[0]?.count ?? 0n), page, perPage };
  });
}

// ── batch register stops ───────────────────────────────────────────────────

/**
 * Compute the time triple a stop_data row carries:
 *   - sum_of_time INTEGER — seconds between start and end
 *   - hours, minutes — INTEGER pair (derived from seconds)
 *   - time VARCHAR — "HH:MM:SS" zero-padded display string
 * For pre-reg (no end), all three return zero/empty.
 */
function computeDuration(start, end) {
  if (!end) return { sumOfTime: 0, hours: 0, minutes: 0, timeStr: '00:00:00' };
  const sec = Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return { sumOfTime: sec, hours, minutes, timeStr };
}

function parseReasonComposite(raw) {
  if (typeof raw !== 'string' || !raw.includes('-')) {
    throw new BadRequestError('stop-reason-composite-invalid');
  }
  const [t, r] = raw.split('-', 2).map((x) => Number(x));
  if (!Number.isInteger(t) || !Number.isInteger(r) || t <= 0 || r <= 0) {
    throw new BadRequestError('stop-reason-composite-invalid');
  }
  return { stopTypeId: t, stopReasonId: r };
}

async function resolveFlowIdForEquipment(tx, equipmentId) {
  // Mirror the legacy "first flow whose flow_data.nodeDataArray references
  // this equipment" rule used by the admin-iot getFlowDesigns picker.
  const flows = await tx.$queryRawUnsafe(
    `SELECT id, flow_data AS "flowData"
     FROM flow_designs
     WHERE status = 1 AND deleted_at IS NULL
     ORDER BY id`,
  );
  const hit = flows.find((f) => flowContainsEquipment(f.flowData, equipmentId));
  return hit ? hit.id : 0;
}

/**
 * Register N stops in a single transaction.
 *   - type=''        → finalises a finished MachineData bucket (is_registered='yes')
 *   - type='pre-reg' → ongoing run; row stays open. MachineData marked
 *                       'pre'; restart_timestamp=null, time=00:00:00.
 *
 * Returns { created, stopDataIds }.
 */
async function batchRegisterStops(tenant, user, machineId, dto) {
  const isPreReg = dto.type === 'pre-reg';
  const { stopTypeId, stopReasonId } = parseReasonComposite(dto.stopReasonComposite);
  const bucketIds = Array.isArray(dto.stopBucketIds) ? dto.stopBucketIds.map(Number).filter(Number.isInteger) : [];
  if (bucketIds.length === 0) throw new BadRequestError('stop-bucket-ids-required');

  const workShiftMap = dto.workShiftMap || {};
  // Validate every bucket has a shift assignment.
  for (const id of bucketIds) {
    if (!workShiftMap[String(id)]) {
      throw new BadRequestError(`work-shift-missing-for-bucket-${id}`);
    }
  }

  // Legacy `stop_data` has NOT NULL DEFAULT 0 on part_id and NOT NULL DEFAULT ''
  // on comment / created_by_* — coerce nullish inputs to the column defaults
  // (the schema can't accept SQL NULL on those columns).
  const partId = dto.partId == null ? 0 : Number(dto.partId);
  const orderNo = typeof dto.orderNo === 'string' ? dto.orderNo : null;
  const comment = typeof dto.comment === 'string' ? dto.comment : '';
  const picture = typeof dto.picture === 'string' ? dto.picture : null;

  return withTenant(tenant, async (tx) => {
    // Validate machine exists and grab equipment_id for flow resolution.
    const machineRows = await tx.$queryRawUnsafe(
      `SELECT id, equipment_id AS "equipmentId" FROM machines WHERE id = $1`, machineId,
    );
    if (!machineRows[0]) throw new NotFoundError('machine-not-found');
    const equipmentId = machineRows[0].equipmentId;
    if (!equipmentId || equipmentId <= 0) {
      throw new BadRequestError('machine-not-assigned-to-equipment');
    }

    // One flow lookup for the whole batch.
    const flowId = await resolveFlowIdForEquipment(tx, equipmentId);
    if (flowId === 0) throw new BadRequestError('no-flow-for-equipment');

    // Load all buckets for this machine, in one query, to validate them.
    const placeholders = bucketIds.map((_, i) => `$${i + 2}`).join(',');
    const buckets = await tx.$queryRawUnsafe(
      `SELECT id, machine_id AS "machineId",
              start_time AS "startTime", end_time AS "endTime",
              is_registered AS "isRegistered"
       FROM machine_data
       WHERE machine_id = $1 AND id IN (${placeholders})`,
      machineId, ...bucketIds,
    );
    if (buckets.length !== bucketIds.length) {
      throw new BadRequestError('some-buckets-not-found');
    }
    for (const b of buckets) {
      if (b.isRegistered !== 'no') {
        throw new BadRequestError(`bucket-${b.id}-already-registered`);
      }
    }

    const stopDataIds = [];
    for (const b of buckets) {
      const shift = workShiftMap[String(b.id)];
      const workShiftId = shift?.id == null ? 0 : Number(shift.id);
      const workShiftName = String(shift?.name ?? '');
      const dur = computeDuration(b.startTime, isPreReg ? null : b.endTime);
      const stopTimestamp = b.startTime;
      const restartTimestamp = isPreReg ? null : b.endTime;
      const dateOnly = new Date(b.startTime).toISOString().slice(0, 10);

      const inserted = await tx.$queryRawUnsafe(
        `INSERT INTO stop_data (
           flow_id, flow_object_key, part_id,
           work_shift_id, work_shift_name,
           order_no, date, hours, minutes, time, sum_of_time, quantity,
           stop_type_id, reason, comment,
           stop_timestamp, restart_timestamp,
           machine_stop_id, stop_data_type,
           status, picture,
           created_by, created_by_email, created_by_name,
           created_at, updated_at
         )
         VALUES (
           $1, $2, $3,
           $4, $5,
           $6, $7::date, $8, $9, $10, $11, 1,
           $12, $13, $14,
           $15::timestamptz, $16::timestamptz,
           $17, $18::"tenant_template"."StopDataKind",
           1, $19,
           $20, $21, $22,
           now(), now()
         )
         RETURNING id`,
        flowId, equipmentId, partId,
        workShiftId, workShiftName,
        orderNo, dateOnly, dur.hours, dur.minutes, dur.timeStr, dur.sumOfTime,
        stopTypeId, stopReasonId, comment,
        stopTimestamp, restartTimestamp,
        b.id, isPreReg ? 'pre' : 'reg',
        picture,
        user.id, user.email || '', user.name || '',
      );
      stopDataIds.push(inserted[0].id);

      // Mark the source MachineData bucket.
      //   normal mode → 'yes' (registered, removed from operator's list)
      //   pre-reg     → 'pre' (still ongoing; will flip to 'yes' on completion)
      const newRegState = isPreReg ? 'pre' : 'yes';
      await tx.$queryRawUnsafe(
        `UPDATE machine_data SET is_registered = $1::"tenant_template"."MachineDataRegistration" WHERE id = $2`,
        newRegState, b.id,
      );
    }

    // Recompute the unit's has_unregister_data marker for the operator card.
    const remaining = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS c FROM machine_data
       WHERE machine_id = $1 AND is_registered = 'no' AND is_valid_data = true`,
      machineId,
    );
    await tx.$queryRawUnsafe(
      `UPDATE machines SET has_unregister_data = $1, updated_at = now() WHERE id = $2`,
      remaining[0].c > 0 ? 'yes' : 'no', machineId,
    );

    // Cache the form payload for 24h so the next modal opens prefilled.
    try {
      await setStopFormPrefill(tenant, equipmentId, {
        stopReasonComposite: dto.stopReasonComposite,
        partId,
        orderNo,
        comment,
        // workShiftMap is per-bucket and date-bound — do NOT cache it.
      });
    } catch (e) {
      // Cache failures must not break the save.
    }

    return { created: stopDataIds.length, stopDataIds };
  });
}

module.exports = {
  listUnits,
  listUnregistered,
  listStatus,
  batchRegisterStops,
  getStopFormPrefill,
  setStopFormPrefill,
  getUnitWebSettings,
  saveUnitWebSettings,
};
