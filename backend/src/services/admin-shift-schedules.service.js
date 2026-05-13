'use strict';

const { withTenant } = require('../prisma/client');
const { NotFoundError } = require('../errors');

const SELECT = `id, title AS "name", description, status, created_at AS "createdAt", updated_at AS "updatedAt"`;

async function list(tenant, q) {
  const page = q.page ?? 1;
  const perPage = q.perPage ?? 10;
  const skip = (page - 1) * perPage;
  const params = [];
  const where = ['deleted_at IS NULL'];
  if (q.search) { params.push(`%${q.search}%`); where.push(`title ILIKE $${params.length}`); }
  if (q.name) { params.push(`%${q.name}%`); where.push(`title ILIKE $${params.length}`); }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const dir = q.order === 'asc' ? 'ASC' : 'DESC';
  return withTenant(tenant, async (tx) => {
    const data = await tx.$queryRawUnsafe(
      `SELECT ${SELECT} FROM shift_schedules ${whereSql} ORDER BY id ${dir} LIMIT ${perPage} OFFSET ${skip}`,
      ...params,
    );
    const totalRows = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM shift_schedules ${whereSql}`, ...params,
    );
    return { data, total: Number(totalRows[0]?.count ?? 0n), page, perPage };
  });
}

async function findOne(tenant, id) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `SELECT ${SELECT} FROM shift_schedules WHERE id = $1 AND deleted_at IS NULL`, id,
    ),
  );
  if (!rows[0]) throw new NotFoundError('shift-schedule-not-found');
  return rows[0];
}

async function create(tenant, dto) {
  // Note: DB column `shift_schedules.status` is BOOLEAN despite the Prisma
  // schema declaring it `Int`. Cast literal accordingly to avoid 42804.
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `INSERT INTO shift_schedules (title, description, status, created_at, updated_at)
       VALUES ($1, $2, true, now(), now()) RETURNING ${SELECT}`,
      dto.name, dto.description ?? null,
    ),
  );
  return rows[0];
}

async function update(tenant, id, dto) {
  const sets = [];
  const values = [];
  const push = (sql, v) => { sets.push(sql.replace('$?', `$${values.length + 1}`)); values.push(v); };
  if (dto.name !== undefined) push('title = $?', dto.name);
  if (dto.description !== undefined) push('description = $?', dto.description);
  if (sets.length === 0) return findOne(tenant, id);
  sets.push('updated_at = now()');
  values.push(id);
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `UPDATE shift_schedules SET ${sets.join(', ')} WHERE id = $${values.length} AND deleted_at IS NULL RETURNING ${SELECT}`,
      ...values,
    ),
  );
  if (!rows[0]) throw new NotFoundError('shift-schedule-not-found');
  return rows[0];
}

async function patchStatus(tenant, id) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `UPDATE shift_schedules SET status = NOT status, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL RETURNING id, status`,
      id,
    ),
  );
  if (!rows[0]) throw new NotFoundError('shift-schedule-not-found');
  return rows[0];
}

async function softDelete(tenant, id) {
  const result = await withTenant(tenant, (tx) =>
    tx.$executeRawUnsafe(
      `UPDATE shift_schedules SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, id,
    ),
  );
  if (result === 0) throw new NotFoundError('shift-schedule-not-found');
}

// FullCalendar events — non-recurring and recurring (expansion in JS mirrors legacy PHP logic)
async function getEvents(tenant, scheduleId, start, end) {
  return withTenant(tenant, async (tx) => {
    const nonRecurring = await tx.$queryRawUnsafe(
      `SELECT id, title, start::text AS start, "end"::text AS end,
              text_color AS "textColor", background_color AS "backgroundColor", is_recurring AS "isRecurring",
              parent_id AS "parentId", rc_data AS "rcData"
       FROM shift_schedule_data
       WHERE schedule_id = $1 AND is_recurring = false AND parent_id = 0
         AND start >= $2::timestamptz AND start <= $3::timestamptz`,
      scheduleId, start, end,
    );

    const recurring = await tx.$queryRawUnsafe(
      `SELECT id, title, start::text AS start, "end"::text AS end,
              text_color AS "textColor", background_color AS "backgroundColor", is_recurring AS "isRecurring",
              parent_id AS "parentId", rc_data AS "rcData"
       FROM shift_schedule_data
       WHERE schedule_id = $1 AND is_recurring = true AND parent_id = 0
         AND start <= $2::timestamptz`,
      scheduleId, end,
    );

    // Expand recurring events (simplified: weekly repeat within date window)
    const expanded = [];
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();

    for (const ev of recurring) {
      const rc = ev.rcData ? JSON.parse(ev.rcData) : {};
      const repeatDays = rc.repeat_day ?? [];
      const evStart = new Date(ev.start);
      const evEnd = new Date(ev.end);
      const duration = evEnd.getTime() - evStart.getTime();

      let cursor = new Date(evStart);
      cursor.setHours(0, 0, 0, 0);
      const windowEnd = new Date(end);
      windowEnd.setHours(23, 59, 59, 999);

      while (cursor <= windowEnd) {
        const dayOfWeek = cursor.getDay();
        if (repeatDays.includes(dayOfWeek) || repeatDays.length === 0) {
          const occurrenceStart = new Date(cursor);
          occurrenceStart.setHours(evStart.getHours(), evStart.getMinutes(), evStart.getSeconds());
          if (occurrenceStart.getTime() >= startTime && occurrenceStart.getTime() <= endTime) {
            expanded.push({
              id: `${ev.id}-${occurrenceStart.toISOString()}`,
              title: ev.title,
              start: occurrenceStart.toISOString(),
              end: new Date(occurrenceStart.getTime() + duration).toISOString(),
              textColor: ev.textColor,
              backgroundColor: ev.backgroundColor,
              isRecurring: true,
              parentId: ev.id,
            });
          }
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return [...nonRecurring, ...expanded];
  });
}

async function createEvent(tenant, scheduleId, dto) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `INSERT INTO shift_schedule_data (schedule_id, title, start, "end", text_color, background_color, is_recurring, parent_id, rc_data, created_at, updated_at)
       VALUES ($1, $2, $3::timestamp, $4::timestamp, $5, $6, $7, 0, $8, now(), now())
       RETURNING id, title, start::text, "end"::text`,
      scheduleId, dto.title, dto.start, dto.end,
      dto.textColor ?? '#ffffff', dto.backgroundColor ?? '#3788d8',
      dto.isRecurring ?? false, dto.rcData ? JSON.stringify(dto.rcData) : null,
    ),
  );
  return rows[0];
}

async function deleteEvent(tenant, eventId) {
  await withTenant(tenant, (tx) =>
    tx.$executeRawUnsafe(`DELETE FROM shift_schedule_data WHERE id = $1`, eventId),
  );
}

/**
 * Returns shift-schedule event titles for a given equipment on a given date.
 * Mirrors legacy `getShiftScheduleTitleByTimeAll(date, equipment_id)`.
 *
 * Resolution: equipment_shift_schedule(equipment_id) → schedule_id → shift_schedule_data
 * events whose `start` date covers the given date. Recurring events are also
 * included if their weekday matches (rc_data.repeat_day contains date's getDay()).
 */
async function getTitlesForEquipment(tenant, equipmentId, dateStr) {
  // Date string: YYYY-MM-DD. We want events whose start is on this calendar day OR
  // recurring events whose repeat_day list includes the day's weekday number.
  const date = new Date(`${dateStr}T00:00:00Z`);
  const dow = date.getUTCDay(); // 0..6, Sun=0
  return withTenant(tenant, async (tx) => {
    const scheduleRows = await tx.$queryRawUnsafe(
      `SELECT schedule_id FROM equipment_shift_schedule WHERE equipment_id = $1`,
      equipmentId,
    );
    if (!scheduleRows.length) return [];
    const scheduleIds = scheduleRows.map((r) => r.schedule_id);

    // Non-recurring events whose start date is the given date (compared as UTC date)
    const nonRecurring = await tx.$queryRawUnsafe(
      `SELECT id, title, start::text AS start, "end"::text AS end, schedule_id AS "scheduleId"
       FROM shift_schedule_data
       WHERE schedule_id = ANY($1::int[])
         AND is_recurring = false
         AND parent_id = 0
         AND start::date = $2::date`,
      scheduleIds, dateStr,
    );

    const recurring = await tx.$queryRawUnsafe(
      `SELECT id, title, start::text AS start, "end"::text AS end, rc_data AS "rcData",
              schedule_id AS "scheduleId"
       FROM shift_schedule_data
       WHERE schedule_id = ANY($1::int[])
         AND is_recurring = true
         AND parent_id = 0
         AND start::date <= $2::date`,
      scheduleIds, dateStr,
    );

    const matchedRecurring = recurring.filter((ev) => {
      const rc = ev.rcData ? (() => { try { return JSON.parse(ev.rcData); } catch { return {}; } })() : {};
      const repeatDays = rc.repeat_day;
      if (!Array.isArray(repeatDays) || repeatDays.length === 0) return true;
      return repeatDays.includes(dow);
    });

    return [...nonRecurring, ...matchedRecurring].map((ev) => ({
      id: ev.id,
      title: ev.title,
      scheduleId: ev.scheduleId,
      start: ev.start,
      end: ev.end,
    }));
  });
}

module.exports = { list, findOne, create, update, patchStatus, softDelete, getEvents, createEvent, deleteEvent, getTitlesForEquipment };
