'use strict';

/**
 * IoT stop-event ingestion + machine-data helpers.
 *
 * Each "stop" the IoT firmware reports lands as one `machine_data` row
 * (start_time, end_time, is_registered, production_time). When the
 * owning `machines.is_auto_registered = 'yes'` AND the stop is long
 * enough to clear the operator's `time_limit`, we ALSO write a
 * `stop_data` row so the analytics tables see it.
 *
 * This is the pragmatic Phase-C port of the legacy
 * `MachineController@saveStopDataV1` (~600 lines of jQuery-era code).
 * Deferred from the legacy:
 *   - filter_time / filter_time_on debouncing via queue jobs
 *     (UpdateMachineStartStatusV1/StopV1) — the device-side firmware
 *     already does most of this debouncing now
 *   - cycle_time multi-part counting
 *   - cross-shift split (a stop that spans 14:00 should produce two
 *     stop_data rows — one for FM, one for EM). Phase D.
 */

const { withTenant } = require('../prisma/client');

function durationMinutes(startISO, endISO) {
  const s = new Date(startISO).getTime();
  const e = new Date(endISO).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0;
  return Math.round((e - s) / 60_000);
}

/**
 * Persist one stop event from IoT firmware.
 *
 * @param {object} tenant       { tenantId, schemaName }
 * @param {object} actor        req.user
 * @param {object} dto          { machine_id, start_time, end_time, is_valid_data? }
 * @returns {Promise<{ machine_data_id, stop_data_id?, auto_registered }>}
 */
async function saveStopEvent(tenant, actor, dto) {
  const machineId = Number(dto.machine_id ?? dto.machineId);
  const start = String(dto.start_time ?? dto.startTime ?? '').trim();
  const end = String(dto.end_time ?? dto.endTime ?? '').trim();
  if (!machineId)             throw Object.assign(new Error('machine_id required'), { statusCode: 400 });
  if (!start || !end)         throw Object.assign(new Error('start_time and end_time required'), { statusCode: 400 });
  const minutes = durationMinutes(start, end);

  return withTenant(tenant, async (tx) => {
    // 1. Look up the machine to pick up auto-register settings + flow/equipment.
    const mRows = await tx.$queryRawUnsafe(
      `SELECT m.id, m.equipment_id AS "equipmentId", m.is_auto_registered AS "isAutoReg",
              m.auto_registered_data AS "autoRegData", m.unit_name AS "unitName"
         FROM machines m WHERE m.id = $1`,
      machineId,
    );
    if (!mRows[0]) throw Object.assign(new Error('machine not found'), { statusCode: 404 });
    const machine = mRows[0];

    // 2. Record the raw machine_data row. running_status flips OFF for
    //    the duration of this row; the next "running" pulse closes it.
    const productionTime = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const inserted = await tx.$queryRawUnsafe(
      `INSERT INTO machine_data (machine_id, start_time, end_time, is_registered, is_valid_data, production_time)
       VALUES ($1, $2::timestamptz, $3::timestamptz, $4::tenant_template."MachineDataRegistration", $5, $6)
       RETURNING id::int AS id`,
      machineId, start, end, 'no', dto.is_valid_data === false ? false : true, productionTime,
    );
    const machineDataId = inserted[0].id;

    // 3. Refresh the live status fields on the machine row.
    await tx.$executeRawUnsafe(
      `UPDATE machines SET running_status = 'off', last_online = NOW(), updated_at = NOW() WHERE id = $1`,
      machineId,
    );

    // 4. Auto-register: if the machine is auto-reg'd AND the stop is
    //    long enough to clear time_limit, write a stop_data row too.
    if (machine.isAutoReg === 'yes' && machine.equipmentId) {
      let timeLimit = 0;
      let reasonId = 0;
      let stopTypeId = 0;
      let flowId = 0;
      try {
        const auto = machine.autoRegData ? JSON.parse(machine.autoRegData) : {};
        timeLimit = Number(auto.time_limit ?? auto.stop_time_limit ?? 0);
        reasonId = Number(auto.reasons ?? auto.reason_id ?? 0);
        stopTypeId = Number(auto.stop_type_id ?? auto.type_id ?? 0);
        flowId = Number(auto.flow ?? auto.flow_id ?? 0);
      } catch { /* malformed JSON — skip auto-reg */ }

      if (timeLimit > 0 && minutes >= timeLimit) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const stopRows = await tx.$queryRawUnsafe(
          `INSERT INTO stop_data
             (flow_id, flow_object_key, part_id, work_shift_id, work_shift_name,
              order_no, hours, minutes, "time", sum_of_time, quantity, reason,
              stop_type_id, date, comment, created_by, created_by_email, created_by_name)
           VALUES ($1, $2, 0, 0, '', '', $3, $4, $5, $6, 1, $7, $8,
                   $9::date, 'Auto-registered by IoT', $10, $11, $12)
           RETURNING id::int AS id`,
          flowId, machine.equipmentId,
          hours, mins, `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`, minutes,
          reasonId, stopTypeId,
          start.slice(0, 10),
          Number(actor?.id ?? 0), String(actor?.email ?? ''), String(actor?.name ?? `machine-${machineId}`),
        );
        await tx.$executeRawUnsafe(
          `UPDATE machine_data SET is_registered = 'yes'::tenant_template."MachineDataRegistration" WHERE id = $1`,
          machineDataId,
        );
        return { machine_data_id: machineDataId, stop_data_id: stopRows[0]?.id, auto_registered: true };
      }
    }
    return { machine_data_id: machineDataId, auto_registered: false };
  });
}

async function listMachineData(tenant, machineId, opts = {}) {
  const limit = Math.min(500, Math.max(1, Number(opts.limit ?? 100)));
  const from = opts.from ? String(opts.from) : null;
  const to = opts.to ? String(opts.to) : null;
  return withTenant(tenant, async (tx) => {
    const where = ['machine_id = $1'];
    const params = [machineId];
    if (from) { params.push(from); where.push(`start_time >= $${params.length}::timestamptz`); }
    if (to)   { params.push(to);   where.push(`end_time   <= $${params.length}::timestamptz`); }
    return tx.$queryRawUnsafe(
      `SELECT id, machine_id AS "machineId", start_time AS "startTime",
              end_time AS "endTime", is_registered AS "isRegistered",
              is_valid_data AS "isValidData", production_time AS "productionTime"
         FROM machine_data WHERE ${where.join(' AND ')}
        ORDER BY start_time DESC LIMIT ${limit}`,
      ...params,
    );
  });
}

async function getProductionTime(tenant, equipmentId, from, to) {
  return withTenant(tenant, async (tx) => {
    // Total stop minutes = sum of (end-start) for ALL machine_data rows
    // tied to this equipment in the window.
    const rows = await tx.$queryRawUnsafe(
      `SELECT
          COALESCE(SUM(EXTRACT(EPOCH FROM (md.end_time - md.start_time))/60), 0)::int AS "stopMinutes",
          COUNT(*)::int AS "stopCount"
         FROM machine_data md
         JOIN machines m ON m.id = md.machine_id
        WHERE m.equipment_id = $1
          AND md.start_time >= $2::timestamptz
          AND md.end_time   <= $3::timestamptz
          AND md.is_valid_data = true`,
      equipmentId, from, to,
    );
    const stopMinutes = Number(rows[0]?.stopMinutes ?? 0);
    const windowMinutes = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000));
    const runningMinutes = Math.max(0, windowMinutes - stopMinutes);
    return { runningMinutes, stopMinutes, stopCount: rows[0]?.stopCount ?? 0, windowMinutes };
  });
}

async function getShiftSchedulesByDates(tenant, from, to) {
  return withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `SELECT id, parent_id AS "parentId", title, schedule_id AS "scheduleId",
              start, "end", text_color AS "textColor", background_color AS "backgroundColor",
              is_recurring AS "isRecurring", rc_data AS "rcData", break_data AS "breakData"
         FROM shift_schedule_data
        WHERE (start >= $1::timestamptz AND start <= $2::timestamptz)
           OR ("end" >= $1::timestamptz AND "end" <= $2::timestamptz)
        ORDER BY start`,
      from, to,
    ),
  );
}

/**
 * Legacy `MachineController@installV1` port.
 *
 * Behaviour (mirrors fpanalyzer/app/Http/Controllers/Api/v1/MachineController.php@installV1):
 *   - Find machine by id; if not found, fall back to (pin_no + unit_name).
 *   - If neither match, INSERT a fresh `machines` row in the unconfigured
 *     state (equipment_id=0, running_status=on).
 *   - When the machine already exists AND has an equipment_id AND the
 *     caller supplied both `start_time` and `end_time`, treat the call
 *     as a "stop end" / restart signal: write machine_status='on',
 *     close out the open machine_data row's end_time.
 *   - Otherwise just refresh `running_status='on'`, `unit_connected='yes'`,
 *     `last_online=NOW()`.
 *
 * The legacy filter_time_on debounce-via-queue is intentionally not
 * ported — IoT firmware does that locally now.
 */
async function installMachine(tenant, dto) {
  const machineId = Number(dto.machine_id ?? dto.machineId) || 0;
  const pinNo = Number(dto.pin_no ?? dto.pinNo);
  const unitName = String(dto.unit_name ?? dto.unitName ?? '').trim();
  const wifiId = dto.wifi_id ?? dto.wifiId ?? null;
  const bluetoothId = dto.bluetooth_id ?? dto.bluetoothId ?? null;
  const startTime = String(dto.start_time ?? dto.startTime ?? '').trim() || null;
  const endTime = String(dto.end_time ?? dto.endTime ?? '').trim() || null;

  if (!pinNo || !unitName) {
    throw Object.assign(new Error('Required fields not satisfied'), { statusCode: 400 });
  }

  return withTenant(tenant, async (tx) => {
    // Try machine_id first.
    let rows = machineId
      ? await tx.$queryRawUnsafe(
          `SELECT id, equipment_id AS "equipmentId", pin_no AS "pinNo", unit_name AS "unitName",
                  running_status AS "runningStatus", unit_connected AS "unitConnected",
                  signal_type AS "signalType"
             FROM machines WHERE id = $1`,
          machineId,
        )
      : [];
    let machine = rows[0];

    if (!machine) {
      // Fall back to (pin_no + unit_name).
      rows = await tx.$queryRawUnsafe(
        `SELECT id, equipment_id AS "equipmentId", pin_no AS "pinNo", unit_name AS "unitName",
                running_status AS "runningStatus", unit_connected AS "unitConnected",
                signal_type AS "signalType"
           FROM machines WHERE pin_no = $1 AND unit_name = $2`,
        pinNo, unitName,
      );
      machine = rows[0];
    }

    if (!machine) {
      // Insert fresh — unconfigured row, awaiting an operator to bind
      // it to an equipment.
      const inserted = await tx.$queryRawUnsafe(
        `INSERT INTO machines
            (equipment_id, pin_no, unit_name, wifi_id, bluetooth_id,
             running_status, unit_connected, signal_type,
             installation_date, last_online, updated_at, created_at)
         VALUES
            (0, $1, $2, $3, $4,
             'on'::tenant_template."MachineRunningStatus", 'yes',
             'on'::tenant_template."MachineSignalType",
             NOW(), NOW(), NOW(), NOW())
         RETURNING id, equipment_id AS "equipmentId", pin_no AS "pinNo",
                   unit_name AS "unitName", running_status AS "runningStatus",
                   unit_connected AS "unitConnected", signal_type AS "signalType",
                   installation_date AS "installationDate", last_online AS "lastOnline"`,
        pinNo, unitName, wifiId, bluetoothId,
      );
      return { data: inserted[0], action: 'created' };
    }

    // Existing machine.
    // If it's configured AND the caller passed a stop window, treat it
    // as a restart / stop-end signal.
    if (machine.equipmentId && startTime && endTime) {
      const result = await _processMachineStart(tx, machine, endTime);
      return { data: result.data, action: result.action };
    }

    // Plain "I'm online" heartbeat.
    const updated = await tx.$queryRawUnsafe(
      `UPDATE machines SET
         running_status = 'on'::tenant_template."MachineRunningStatus",
         unit_connected = 'yes',
         wifi_id        = COALESCE($2, wifi_id),
         bluetooth_id   = COALESCE($3, bluetooth_id),
         last_online    = NOW(),
         updated_at     = NOW()
       WHERE id = $1
       RETURNING id, equipment_id AS "equipmentId", pin_no AS "pinNo",
                 unit_name AS "unitName", running_status AS "runningStatus",
                 unit_connected AS "unitConnected", signal_type AS "signalType",
                 last_online AS "lastOnline"`,
      machine.id, wifiId, bluetoothId,
    );
    return { data: updated[0], action: 'heartbeat' };
  });
}

/**
 * Helper used by installMachine when a stop window is supplied: write
 * machine_status='on' + close out the latest open machine_data row.
 * Mirrors legacy `MachineController@processMachineStartData` +
 * `saveMachineStartData`.
 */
async function _processMachineStart(tx, machine, endTime) {
  // Refresh connection fields first.
  await tx.$executeRawUnsafe(
    `UPDATE machines SET unit_connected = 'yes', updated_at = NOW() WHERE id = $1`,
    machine.id,
  );

  // Upsert machine_status row.
  const statusRows = await tx.$queryRawUnsafe(
    `SELECT id FROM machine_status WHERE machine_id = $1 LIMIT 1`,
    machine.id,
  );
  if (statusRows[0]) {
    await tx.$executeRawUnsafe(
      `UPDATE machine_status SET status = 'on'::tenant_template."MachineRunningStatus", "time" = $2
         WHERE id = $1`,
      statusRows[0].id, endTime,
    );
  } else {
    await tx.$executeRawUnsafe(
      `INSERT INTO machine_status (machine_id, status, "time")
       VALUES ($1, 'on'::tenant_template."MachineRunningStatus", $2)`,
      machine.id, endTime,
    );
  }

  // Close out the latest open machine_data row (if any).
  const last = await tx.$queryRawUnsafe(
    `SELECT id, start_time AS "startTime" FROM machine_data
       WHERE machine_id = $1 AND end_time IS NULL ORDER BY id DESC LIMIT 1`,
    machine.id,
  );

  if (!last[0]) {
    const updated = await tx.$queryRawUnsafe(
      `UPDATE machines SET running_status = 'on'::tenant_template."MachineRunningStatus",
                           updated_at = NOW()
         WHERE id = $1
       RETURNING id, running_status AS "runningStatus", unit_connected AS "unitConnected",
                 last_online AS "lastOnline"`,
      machine.id,
    );
    return { data: updated[0], action: 'restart-no-prior-stop' };
  }

  await tx.$executeRawUnsafe(
    `UPDATE machine_data SET end_time = $2::timestamptz WHERE id = $1`,
    last[0].id, endTime,
  );
  const updated = await tx.$queryRawUnsafe(
    `UPDATE machines SET has_unregister_data = 'yes',
                          running_status = 'on'::tenant_template."MachineRunningStatus",
                          updated_at = NOW()
        WHERE id = $1
      RETURNING id, equipment_id AS "equipmentId", running_status AS "runningStatus",
                unit_connected AS "unitConnected", last_online AS "lastOnline"`,
    machine.id,
  );
  return { data: updated[0], action: 'restart-saved' };
}

/**
 * Legacy `MachineController@saveStopDataV1` port — stop-start signal.
 *
 * Inputs (legacy): { start_time, machine_id, company_email_id }. NO
 * end_time (that arrives later via installV1).
 *
 * Flow:
 *   1. Look up machine by id. Refresh `unit_connected='yes'`.
 *   2. If machine has no equipment → mark running_status='off' + return
 *      "Machine not configured".
 *   3. Read current machine_status. If already 'off' → treat as long-stop
 *      continuation, return early (don't insert a duplicate stop row).
 *   4. Write/update machine_status (status='off', time=start_time).
 *   5. Insert a new machine_data row (start_time only, is_registered='no',
 *      is_valid_data=true). Set machine.running_status='off',
 *      has_unregister_data='yes'.
 *
 * Filter-time queue debounce skipped (firmware-side now).
 */
async function saveStopStart(tenant, dto) {
  const machineId = Number(dto.machine_id ?? dto.machineId);
  const startTime = String(dto.start_time ?? dto.startTime ?? '').trim();
  if (!machineId || !startTime) {
    throw Object.assign(new Error('Required fields not satisfied'), { statusCode: 400 });
  }

  return withTenant(tenant, async (tx) => {
    const rows = await tx.$queryRawUnsafe(
      `SELECT id, equipment_id AS "equipmentId", running_status AS "runningStatus",
              unit_connected AS "unitConnected"
         FROM machines WHERE id = $1`,
      machineId,
    );
    if (!rows[0]) {
      throw Object.assign(new Error('Invalid machine'), { statusCode: 404 });
    }
    const machine = rows[0];

    // Always mark the unit as connected — stop signal proves liveness.
    await tx.$executeRawUnsafe(
      `UPDATE machines SET unit_connected = 'yes', updated_at = NOW() WHERE id = $1`,
      machine.id,
    );

    if (!machine.equipmentId) {
      // Machine is not yet configured to an equipment.  We still record the stop
      // so that when the machine is later configured and "Turn On" is sent, there
      // is an open machine_data row to close.  The row is marked is_valid_data=false
      // so analytics ignore it until the machine has a real equipment assignment.
      await tx.$executeRawUnsafe(
        `UPDATE machines SET running_status = 'off'::tenant_template."MachineRunningStatus",
                             unit_connected = 'yes', updated_at = NOW() WHERE id = $1`,
        machine.id,
      );

      // Long-stop suppression applies even for unconfigured machines.
      const ucStatusRows = await tx.$queryRawUnsafe(
        `SELECT id, status::text AS status FROM machine_status WHERE machine_id = $1 LIMIT 1`,
        machine.id,
      );
      if (ucStatusRows[0]?.status === 'off') {
        return { success: false, msg: 'Machine not configured — long stop continue', data: { id: machine.id } };
      }

      // Upsert machine_status = 'off' so Turn On can later clear it.
      if (ucStatusRows[0]) {
        await tx.$executeRawUnsafe(
          `UPDATE machine_status SET status = 'off'::tenant_template."MachineRunningStatus", "time" = $2 WHERE id = $1`,
          ucStatusRows[0].id, startTime,
        );
      } else {
        await tx.$executeRawUnsafe(
          `INSERT INTO machine_status (machine_id, status, "time")
           VALUES ($1, 'off'::tenant_template."MachineRunningStatus", $2)`,
          machine.id, startTime,
        );
      }

      const ucMqttMsgId = dto.mqtt_message_id ?? dto.mqttMessageId ?? null;
      const ucInserted = await tx.$queryRawUnsafe(
        `INSERT INTO machine_data (machine_id, start_time, is_registered, is_valid_data, mqtt_message_id)
         VALUES ($1, $2::timestamptz, 'no'::tenant_template."MachineDataRegistration", false, $3)
         RETURNING id::int AS id`,
        machine.id, startTime, ucMqttMsgId,
      );

      await tx.$executeRawUnsafe(
        `UPDATE machines SET has_unregister_data = 'yes' WHERE id = $1`,
        machine.id,
      );

      return {
        success: false,
        msg: 'Machine not configured',
        data: { id: machine.id, machine_data_id: ucInserted[0].id },
      };
    }

    // Long-stop suppression: if machine_status is already off, do nothing.
    const statusRows = await tx.$queryRawUnsafe(
      `SELECT id, status::text AS status FROM machine_status WHERE machine_id = $1 LIMIT 1`,
      machine.id,
    );
    if (statusRows[0] && statusRows[0].status === 'off') {
      return {
        success: true,
        msg: 'Long stop continue, so neclet notification',
        data: { id: machine.id },
      };
    }

    if (statusRows[0]) {
      await tx.$executeRawUnsafe(
        `UPDATE machine_status SET status = 'off'::tenant_template."MachineRunningStatus", "time" = $2
           WHERE id = $1`,
        statusRows[0].id, startTime,
      );
    } else {
      await tx.$executeRawUnsafe(
        `INSERT INTO machine_status (machine_id, status, "time")
         VALUES ($1, 'off'::tenant_template."MachineRunningStatus", $2)`,
        machine.id, startTime,
      );
    }

    // Persist the raw open stop row (end_time stays NULL until installV1 closes it).
    const mqttMessageId = dto.mqtt_message_id ?? dto.mqttMessageId ?? null;
    const inserted = await tx.$queryRawUnsafe(
      `INSERT INTO machine_data (machine_id, start_time, is_registered, is_valid_data, mqtt_message_id)
       VALUES ($1, $2::timestamptz, 'no'::tenant_template."MachineDataRegistration", true, $3)
       RETURNING id::int AS id`,
      machine.id, startTime, mqttMessageId,
    );

    const updated = await tx.$queryRawUnsafe(
      `UPDATE machines SET
          has_unregister_data = 'yes',
          running_status = 'off'::tenant_template."MachineRunningStatus",
          updated_at = NOW()
        WHERE id = $1
      RETURNING id, equipment_id AS "equipmentId", running_status AS "runningStatus",
                unit_connected AS "unitConnected", last_online AS "lastOnline"`,
      machine.id,
    );

    return {
      success: true,
      msg: 'Saved successfully',
      data: { ...updated[0], machine_data_id: inserted[0].id },
    };
  });
}

module.exports = {
  saveStopEvent, listMachineData, getProductionTime, getShiftSchedulesByDates,
  installMachine, saveStopStart,
};
