'use strict';
const { withTenant } = require('../prisma/client');
const { NotFoundError } = require('../errors');
const equipmentSvc = require('./equipment.service');
const flowDesignsSvc = require('./admin-flow-designs.service');

const SIGNAL_LABELS = { on: 'ON Signal', off: 'OFF Signal', warning: 'Warning Signal' };

function parseCounterDetails(raw) {
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
}

async function getUnits(tenant) {
  return withTenant(tenant, async (tx) => {
    // Configured = has equipment_id > 0
    const configured = await tx.$queryRawUnsafe(
      `SELECT m.id, m.unit_name AS "unitName", m.signal_type AS "signalType",
              m.filter_time AS "filterTime", m.filter_time_on AS "filterTimeOn",
              m.custom_notification_text AS "customNotificationText",
              m.notification_default AS "notificationDefault",
              m.installation_date AS "installationDate", m.pin_no AS "pinNo",
              m.last_online AS "lastOnline", m.running_status AS "runningStatus",
              m.parent_id AS "parentId", m.is_auto_registered AS "isAutoRegistered",
              m.auto_registered_data AS "autoRegisteredData",
              m.counter_details AS "counterDetails",
              m.equipment_id AS "equipmentId", e.name AS "equipmentName"
       FROM machines m
       LEFT JOIN equipment e ON e.id = m.equipment_id
       WHERE m.equipment_id > 0
       ORDER BY m.id`
    );
    const unconfigured = await tx.$queryRawUnsafe(
      `SELECT m.id, m.unit_name AS "unitName", m.signal_type AS "signalType",
              m.last_online AS "lastOnline", m.running_status AS "runningStatus",
              m.equipment_id AS "equipmentId"
       FROM machines m WHERE m.equipment_id = 0 OR m.equipment_id IS NULL ORDER BY m.id`
    );
    return { configured, unconfigured };
  });
}

async function updateSettings(tenant, id, dto) {
  const sets = [];
  const vals = [];
  const push = (sql, v) => { sets.push(sql.replace('$?', `$${vals.length + 1}`)); vals.push(v); };
  if (dto.signalType !== undefined) push('signal_type = $?', dto.signalType);
  if (dto.filterTime !== undefined) push('filter_time = $?', Number(dto.filterTime));
  if (dto.filterTimeOn !== undefined) push('filter_time_on = $?', Number(dto.filterTimeOn));
  if (dto.customNotificationText !== undefined) push('custom_notification_text = $?', dto.customNotificationText);
  if (dto.notificationDefault !== undefined) push('notification_default = $?', Boolean(dto.notificationDefault));
  if (dto.logWarning !== undefined) push('log_warning = $?', Boolean(dto.logWarning));
  if (dto.isAutoRegistered !== undefined) {
    // Schema stores 'yes' / 'no' in a VARCHAR(3). Accept booleans for callers.
    const v = typeof dto.isAutoRegistered === 'boolean'
      ? (dto.isAutoRegistered ? 'yes' : 'no')
      : String(dto.isAutoRegistered);
    push('is_auto_registered = $?', v);
  }

  // `auto_registered_data` is a JSON blob; we merge a single key
  // (`time_limit`) without disturbing other producers writing to it.
  if (dto.autoStopTimeLimit !== undefined) {
    await withTenant(tenant, async (tx) => {
      const cur = await tx.$queryRawUnsafe(
        `SELECT auto_registered_data FROM machines WHERE id = $1`, id,
      );
      let parsed = {};
      const raw = cur[0]?.auto_registered_data;
      if (raw) {
        try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { parsed = {}; }
      }
      const merged = { ...parsed, time_limit: Number(dto.autoStopTimeLimit) };
      await tx.$executeRawUnsafe(
        `UPDATE machines SET auto_registered_data = $1, updated_at = now() WHERE id = $2`,
        JSON.stringify(merged), id,
      );
    });
  }

  if (sets.length === 0) return;
  sets.push('updated_at = now()');
  vals.push(id);
  await withTenant(tenant, (tx) =>
    tx.$executeRawUnsafe(
      `UPDATE machines SET ${sets.join(', ')} WHERE id = $${vals.length}`, ...vals
    )
  );
}

async function assignEquipment(tenant, id, equipmentId) {
  await withTenant(tenant, (tx) =>
    tx.$executeRawUnsafe(
      `UPDATE machines SET equipment_id = $1, updated_at = now() WHERE id = $2`, equipmentId, id
    )
  );
}

async function removeEquipment(tenant, id) {
  await withTenant(tenant, (tx) =>
    tx.$executeRawUnsafe(
      `UPDATE machines SET equipment_id = 0, updated_at = now() WHERE id = $1`, id
    )
  );
}

async function updateCounterSettings(tenant, id, dto) {
  const counterData = {
    date_filter: dto.dateFilter ?? 'daily',
    part_per_hour: Number(dto.partPerHour ?? 0),
    target_product: Number(dto.targetProduct ?? 0),
  };
  await withTenant(tenant, (tx) =>
    tx.$executeRawUnsafe(
      `UPDATE machines SET counter_details = $1, updated_at = now() WHERE id = $2`,
      JSON.stringify(counterData), id
    )
  );
}

async function getCounterChildren(tenant, parentId) {
  return withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `SELECT m.id, m.unit_name AS "unitName", m.counter_details AS "counterDetails"
       FROM machines m WHERE m.parent_id = $1 ORDER BY m.id`, parentId
    )
  );
}

async function getFlowDesigns(tenant, equipmentId) {
  if (equipmentId) {
    // Equipment-scoped: only flows whose nodeDataArray contains this equipment id.
    const { data } = await flowDesignsSvc.list(tenant, { equipmentId, status: 1, perPage: 1000 });
    return data.map((f) => ({ id: f.id, name: f.name }));
  }
  return withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(`SELECT id, name FROM flow_designs WHERE status = 1 AND deleted_at IS NULL ORDER BY name`)
  );
}

async function getStopReasons(tenant, equipmentId) {
  if (equipmentId) {
    // Equipment-scoped + grouped (per RESOLVED iv): [{typeId, typeName, reasons:[{id,name}]}]
    return equipmentSvc.getStopReasonsForEquipment(tenant, equipmentId);
  }
  return withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(`SELECT id, name FROM stop_reasons WHERE deleted_at IS NULL ORDER BY name`)
  );
}

module.exports = { getUnits, updateSettings, assignEquipment, removeEquipment, updateCounterSettings, getCounterChildren, getFlowDesigns, getStopReasons, SIGNAL_LABELS, parseCounterDetails };
