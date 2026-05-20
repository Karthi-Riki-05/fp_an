'use strict';
const { withTenant } = require('../prisma/client');
const { NotFoundError } = require('../errors');

const BOARD_SELECT = `id, name, status, created_by AS "createdByUserId",
  created_by_name AS "createdByName", updated_at AS "updatedAt", created_at AS "createdAt"`;

const WIDGET_SELECT = `id, board_id AS "boardId", title, img_path AS "imgPath",
  settings, created_at AS "createdAt"`;

// Note: the `dashboards` table has NO `deleted_at` column (verified
// against tenant_template). Earlier service code filtered by it, which
// 500'd every dashboards query. We delete hard instead — operators can
// also flip `status` between 1/0 via patchBoardStatus to deactivate
// without removing.

async function listBoards(tenant, q = {}) {
  const page = q.page ?? 1;
  const perPage = q.perPage ?? 10;
  const skip = (page - 1) * perPage;
  return withTenant(tenant, async (tx) => {
    const data = await tx.$queryRawUnsafe(
      `SELECT ${BOARD_SELECT} FROM dashboards ORDER BY id DESC LIMIT ${perPage} OFFSET ${skip}`
    );
    const total = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM dashboards`
    );
    return { data, total: Number(total[0]?.count ?? 0n), page, perPage };
  });
}

async function findBoard(tenant, id) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `SELECT ${BOARD_SELECT}, slot_data AS "slotData", total_slots AS "totalSlots"
       FROM dashboards WHERE id = $1`, id
    )
  );
  if (!rows[0]) throw new NotFoundError('board-not-found');
  return rows[0];
}

async function createBoard(tenant, actor, dto) {
  // `slot_data` is the JSON-encoded array of slot assignments the
  // Dashboard Creator produces, e.g.
  //   [{ slotIdx: 0, widgetId: 12, title: 'Stops', showTitle: true }, …]
  // We store it as text and parse on read — keeps the schema simple.
  const slotData = dto.slotData !== undefined
    ? (typeof dto.slotData === 'string' ? dto.slotData : JSON.stringify(dto.slotData))
    : null;
  const totalSlots = Number.isFinite(Number(dto.totalSlots)) ? Number(dto.totalSlots) : 6;
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `INSERT INTO dashboards (name, status, slot_data, total_slots, created_by, created_by_name, created_by_email, created_at, updated_at)
       VALUES ($1, 1, $2, $3, $4, $5, $6, now(), now()) RETURNING ${BOARD_SELECT}, slot_data AS "slotData", total_slots AS "totalSlots"`,
      dto.name, slotData, totalSlots, actor.id, actor.name ?? '', actor.email ?? ''
    )
  );
  return rows[0];
}

async function updateBoard(tenant, id, dto) {
  const sets = [];
  const values = [];
  const push = (sql, v) => { sets.push(sql.replace('$?', `$${values.length + 1}`)); values.push(v); };
  if (dto.name !== undefined)       push('name = $?', dto.name);
  if (dto.slotData !== undefined)   push('slot_data = $?', typeof dto.slotData === 'string' ? dto.slotData : JSON.stringify(dto.slotData));
  if (dto.totalSlots !== undefined) push('total_slots = $?', Number(dto.totalSlots));
  if (sets.length === 0) return findBoard(tenant, id);
  sets.push('updated_at = now()');
  values.push(id);
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `UPDATE dashboards SET ${sets.join(', ')} WHERE id = $${values.length}
       RETURNING ${BOARD_SELECT}, slot_data AS "slotData", total_slots AS "totalSlots"`,
      ...values,
    )
  );
  if (!rows[0]) throw new NotFoundError('board-not-found');
  return rows[0];
}

async function patchBoardStatus(tenant, id) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `UPDATE dashboards SET status = CASE WHEN status = 1 THEN 0 ELSE 1 END, updated_at = now()
       WHERE id = $1 RETURNING id, status`, id
    )
  );
  if (!rows[0]) throw new NotFoundError('board-not-found');
  return rows[0];
}

async function deleteBoard(tenant, id) {
  // Hard delete — there's no soft-delete column on `dashboards`. Cascade
  // any widget-slot references via the dashboard_widgets junction in a
  // future migration if we add formal foreign-key constraints.
  const result = await withTenant(tenant, (tx) =>
    tx.$executeRawUnsafe(
      `DELETE FROM dashboards WHERE id = $1`, id
    )
  );
  if (result === 0) throw new NotFoundError('board-not-found');
}

async function listWidgets(tenant) {
  return withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `SELECT ${WIDGET_SELECT} FROM dashboard_widgets WHERE deleted_at IS NULL ORDER BY id DESC`
    )
  );
}

async function createWidget(tenant, actor, dto) {
  const settingsJson = JSON.stringify(dto.settings ?? {});
  const imgPath = dto.imgPath ?? '/images/dashboard/chart_bar.png';
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `INSERT INTO dashboard_widgets (board_id, title, img_path, settings, created_by, created_by_name, created_by_email, created_at, updated_at)
       VALUES (0, $1, $2, $3, $4, $5, $6, now(), now()) RETURNING ${WIDGET_SELECT}`,
      dto.title, imgPath, settingsJson, actor.id, actor.name ?? '', actor.email ?? ''
    )
  );
  return rows[0];
}

async function deleteWidget(tenant, id) {
  await withTenant(tenant, (tx) =>
    tx.$executeRawUnsafe(
      `UPDATE dashboard_widgets SET deleted_at = now() WHERE id = $1`, id
    )
  );
}

async function getBoardWidgets(tenant, boardId) {
  return withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `SELECT ${WIDGET_SELECT} FROM dashboard_widgets WHERE board_id = $1 AND deleted_at IS NULL ORDER BY id`, boardId
    )
  );
}

module.exports = { listBoards, findBoard, createBoard, updateBoard, patchBoardStatus, deleteBoard, listWidgets, createWidget, deleteWidget, getBoardWidgets };
