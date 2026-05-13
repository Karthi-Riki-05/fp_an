'use strict';

const { withTenant } = require('../prisma/client');
const { NotFoundError } = require('../errors');

const SELECT = `wd.id, wd.equipment_id AS "equipmentId", e.name AS "equipmentName", wd.duration,
  wd.notification_text AS "notificationText",
  wd.from_time AS "fromTimestamp", wd.to_time AS "toTimestamp",
  wd.created_at AS "createdAt"`;

/**
 * List warning_data rows with optional date range + pagination.
 */
async function list(tenant, q) {
  const page = q.page ?? 1;
  const perPage = q.perPage ?? 50;
  const skip = (page - 1) * perPage;
  const params = [];
  const where = [];

  if (q.from) { params.push(q.from); where.push(`wd.from_time >= $${params.length}`); }
  if (q.to)   { params.push(q.to);   where.push(`wd.from_time <= $${params.length}`); }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  return withTenant(tenant, async (tx) => {
    const data = await tx.$queryRawUnsafe(
      `SELECT ${SELECT}
       FROM warning_data wd
       LEFT JOIN equipment e ON e.id = wd.equipment_id
       ${whereSql}
       ORDER BY wd.id DESC LIMIT ${perPage} OFFSET ${skip}`,
      ...params
    );
    const total = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM warning_data wd ${whereSql}`,
      ...params
    );
    return { data, total: Number(total[0]?.count ?? 0n), page, perPage };
  });
}

/**
 * Patch a warning_data row's editable fields.
 *
 * Per RESOLVED v: equipmentId + fromTime + toTime are user-editable;
 * `duration` is computed server-side as `toTime - fromTime` (in seconds) and
 * not accepted from clients. Existing fromTime/toTime are read first so a
 * caller can update one side at a time.
 */
async function update(tenant, id, dto) {
  return withTenant(tenant, async (tx) => {
    // Load current row to compute the effective duration after the patch.
    const cur = await tx.$queryRawUnsafe(
      `SELECT id, equipment_id AS "equipmentId",
              from_time AS "fromTime", to_time AS "toTime",
              notification_text AS "notificationText"
       FROM warning_data WHERE id = $1`,
      id,
    );
    if (!cur[0]) throw new NotFoundError('warning-data-not-found');
    const current = cur[0];

    const newFromTime = dto.fromTime !== undefined ? (dto.fromTime ? new Date(dto.fromTime) : null) : current.fromTime;
    const newToTime   = dto.toTime   !== undefined ? (dto.toTime   ? new Date(dto.toTime)   : null) : current.toTime;
    const newEquipmentId = dto.equipmentId !== undefined ? Number(dto.equipmentId) : current.equipmentId;
    const newNotificationText = dto.notificationText !== undefined ? dto.notificationText : current.notificationText;

    let duration = 0;
    if (newFromTime && newToTime) {
      duration = Math.max(0, Math.floor((new Date(newToTime).getTime() - new Date(newFromTime).getTime()) / 1000));
    }

    await tx.$executeRawUnsafe(
      `UPDATE warning_data SET
         equipment_id = $1,
         from_time = $2::timestamptz,
         to_time = $3::timestamptz,
         duration = $4,
         notification_text = $5,
         updated_at = now()
       WHERE id = $6`,
      newEquipmentId,
      newFromTime ? newFromTime.toISOString() : null,
      newToTime ? newToTime.toISOString() : null,
      duration,
      newNotificationText,
      id,
    );

    const row = await tx.$queryRawUnsafe(
      `SELECT wd.id, e.name AS "equipmentName", wd.equipment_id AS "equipmentId",
              wd.duration, wd.notification_text AS "notificationText",
              wd.from_time AS "fromTimestamp", wd.to_time AS "toTimestamp",
              wd.created_at AS "createdAt"
       FROM warning_data wd
       LEFT JOIN equipment e ON e.id = wd.equipment_id
       WHERE wd.id = $1`,
      id,
    );
    return row[0];
  });
}

/**
 * Hard-delete a warning_data row.
 */
async function remove(tenant, id) {
  await withTenant(tenant, (tx) =>
    tx.$executeRawUnsafe(`DELETE FROM warning_data WHERE id = $1`, id)
  );
}

module.exports = { list, update, remove };
