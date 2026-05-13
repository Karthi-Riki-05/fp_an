'use strict';

const { withTenant } = require('../prisma/client');
const { NotFoundError } = require('../errors');

// Explicit int casts prevent Prisma $queryRawUnsafe from returning BigInt
// for columns that might be defined as BIGINT in some tenant schema versions.
const SELECT = `id::int AS id, company_id::int AS "companyId", sort_order::int AS "sortOrder",
  parent_id::int AS "parentId", type_id::int AS "typeId", name, description, icon,
  is_active AS "isActive",
  created_at AS "createdAt", updated_at AS "updatedAt", deleted_at AS "deletedAt"`;

async function list(tenant, opts = {}) {
  const where = opts.includeDeleted ? '' : 'WHERE deleted_at IS NULL';
  return withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(`SELECT ${SELECT} FROM equipment ${where} ORDER BY parent_id, sort_order, id`),
  );
}

async function findOne(tenant, id) {
  return withTenant(tenant, async (tx) => {
    const rows = await tx.$queryRawUnsafe(
      `SELECT ${SELECT} FROM equipment WHERE id = $1 AND deleted_at IS NULL`, id,
    );
    if (!rows[0]) throw new NotFoundError('equipment-not-found');
    const row = rows[0];

    // Fan-out the current assignments so the edit form can pre-populate.
    const [stopIds, scrapIds, partIds, orderIds, sched] = await Promise.all([
      tx.$queryRawUnsafe(
        `SELECT reason_type_id::int AS id FROM equipment_stop_reasons WHERE equipment_id = $1 AND deleted_at IS NULL`, id,
      ),
      tx.$queryRawUnsafe(
        `SELECT reason_type_id::int AS id FROM equipment_scrap_reasons WHERE equipment_id = $1 AND deleted_at IS NULL`, id,
      ),
      tx.$queryRawUnsafe(
        `SELECT part_type_id::int AS id FROM equipment_parts WHERE equipment_id = $1 AND deleted_at IS NULL`, id,
      ),
      tx.$queryRawUnsafe(
        `SELECT order_type_id::int AS id FROM equipment_orders WHERE equipment_id = $1 AND deleted_at IS NULL`, id,
      ),
      tx.$queryRawUnsafe(
        `SELECT schedule_id::int AS "scheduleId", also_assign_import AS "alsoAssignImport"
         FROM equipment_shift_schedule WHERE equipment_id = $1 LIMIT 1`, id,
      ),
    ]);

    return {
      ...row,
      reasonStopTypeIds:  stopIds.map((r) => r.id),
      reasonScrapTypeIds: scrapIds.map((r) => r.id),
      reasonPartTypeIds:  partIds.map((r) => r.id),
      reasonOrderTypeIds: orderIds.map((r) => r.id),
      scheduleId: sched[0]?.scheduleId ?? null,
      alsoAssignImport: Boolean(sched[0]?.alsoAssignImport ?? false),
    };
  });
}

/**
 * Replace all rows in a junction table that link to this equipment with the
 * given set of foreign ids. Hard-DELETE then INSERT so the table stays in
 * sync with the legacy "checkbox state" semantics — soft-deleting would
 * leak ghost rows back into the cascade endpoints (parts / stop / scrap /
 * orders) which filter only on `deleted_at IS NULL`. Caller passes `tx`
 * because this runs inside `create`/`update`'s transaction.
 */
async function replaceJunctionRows(tx, table, fkCol, equipmentId, ids) {
  await tx.$executeRawUnsafe(`DELETE FROM ${table} WHERE equipment_id = $1`, equipmentId);
  if (!Array.isArray(ids) || ids.length === 0) return;
  const values = [];
  const params = [];
  let i = 1;
  for (const v of ids) {
    values.push(`($${i++}, $${i++}, 1, now(), now())`);
    params.push(equipmentId, Number(v));
  }
  await tx.$executeRawUnsafe(
    `INSERT INTO ${table} (equipment_id, ${fkCol}, status, created_at, updated_at) VALUES ${values.join(', ')}`,
    ...params,
  );
}

/**
 * Upsert the single equipment_shift_schedule row for this equipment.
 */
async function upsertShiftSchedule(tx, equipmentId, scheduleId, alsoAssignImport) {
  if (scheduleId === undefined || scheduleId === null) return;
  await tx.$executeRawUnsafe(
    `DELETE FROM equipment_shift_schedule WHERE equipment_id = $1`,
    equipmentId,
  );
  if (Number(scheduleId) > 0) {
    await tx.$executeRawUnsafe(
      `INSERT INTO equipment_shift_schedule (equipment_id, schedule_id, also_assign_import)
       VALUES ($1, $2, $3)`,
      equipmentId, Number(scheduleId), Boolean(alsoAssignImport),
    );
  }
}

async function applyAssignments(tx, equipmentId, dto) {
  if (dto.reasonStopTypeIds !== undefined) {
    await replaceJunctionRows(tx, 'equipment_stop_reasons', 'reason_type_id', equipmentId, dto.reasonStopTypeIds);
  }
  if (dto.reasonScrapTypeIds !== undefined) {
    await replaceJunctionRows(tx, 'equipment_scrap_reasons', 'reason_type_id', equipmentId, dto.reasonScrapTypeIds);
  }
  if (dto.reasonPartTypeIds !== undefined) {
    await replaceJunctionRows(tx, 'equipment_parts', 'part_type_id', equipmentId, dto.reasonPartTypeIds);
  }
  if (dto.reasonOrderTypeIds !== undefined) {
    await replaceJunctionRows(tx, 'equipment_orders', 'order_type_id', equipmentId, dto.reasonOrderTypeIds);
  }
  if (dto.scheduleId !== undefined) {
    await upsertShiftSchedule(tx, equipmentId, dto.scheduleId, dto.alsoAssignImport);
  }
}

async function create(tenant, dto) {
  return withTenant(tenant, async (tx) => {
    const rows = await tx.$queryRawUnsafe(
      `INSERT INTO equipment (company_id, sort_order, parent_id, type_id, name, description, icon, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
       RETURNING ${SELECT}`,
      0, dto.sortOrder ?? 0, dto.parentId ?? 0, dto.typeId ?? 0, dto.name, dto.description ?? null, dto.icon ?? 'noimage.jpg', dto.isActive ?? true,
    );
    const created = rows[0];
    await applyAssignments(tx, created.id, dto);
    return created;
  });
}

async function update(tenant, id, dto) {
  const sets = [];
  const values = [];
  let i = 1;
  const push = (sql, value) => { sets.push(sql.replace('$?', `$${i++}`)); values.push(value); };

  if (dto.name !== undefined)        push('name = $?',        dto.name);
  if (dto.parentId !== undefined)    push('parent_id = $?',   dto.parentId);
  if (dto.typeId !== undefined)      push('type_id = $?',     dto.typeId);
  if (dto.description !== undefined) push('description = $?', dto.description);
  if (dto.icon !== undefined)        push('icon = $?',        dto.icon);
  if (dto.sortOrder !== undefined)   push('sort_order = $?',  dto.sortOrder);
  if (dto.isActive !== undefined)    push('is_active = $?',   dto.isActive);

  const hasAssignmentChanges = ['reasonStopTypeIds','reasonScrapTypeIds','reasonPartTypeIds','reasonOrderTypeIds','scheduleId']
    .some((k) => dto[k] !== undefined);

  return withTenant(tenant, async (tx) => {
    let row;
    if (sets.length > 0) {
      sets.push('updated_at = now()');
      values.push(id);
      const rows = await tx.$queryRawUnsafe(
        `UPDATE equipment SET ${sets.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING ${SELECT}`,
        ...values,
      );
      if (!rows[0]) throw new NotFoundError('equipment-not-found');
      row = rows[0];
    } else {
      // No column changes — verify the row exists before touching junction tables.
      const rows = await tx.$queryRawUnsafe(`SELECT ${SELECT} FROM equipment WHERE id = $1 AND deleted_at IS NULL`, id);
      if (!rows[0]) throw new NotFoundError('equipment-not-found');
      row = rows[0];
    }
    if (hasAssignmentChanges) await applyAssignments(tx, id, dto);
    return row;
  });
}

async function softDelete(tenant, id) {
  const result = await withTenant(tenant, (tx) =>
    tx.$executeRawUnsafe(`UPDATE equipment SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, id),
  );
  if (result === 0) throw new NotFoundError('equipment-not-found');
}

async function getTree(tenant) {
  const flat = await list(tenant);
  const map = {};
  for (const node of flat) {
    map[node.id] = { ...node, children: [] };
  }
  const roots = [];
  for (const node of flat) {
    const mapped = map[node.id];
    if (!node.parentId || !map[node.parentId]) {
      roots.push(mapped);
    } else {
      map[node.parentId].children.push(mapped);
    }
  }
  return roots;
}

// ── Cascading sub-resources ──────────────────────────────────────────────────
//
// Mirror the legacy filtering used by the flow-monitor / units / order forms:
//   parts        — parts where type_id IN (equipment_parts.part_type_id)
//   stop-reasons — for each stop_category linked via equipment_stop_reasons,
//                  load its stop_reasons rows. Returned grouped:
//                    [{ typeId, typeName, reasons: [{id, name}] }]
//   scrap-reasons — same shape but categories come from types(entity='ScrapReason')
//                   linked via equipment_scrap_reasons
//   orders       — orders where type_id IN (equipment_orders.order_type_id)

async function getPartsForEquipment(tenant, equipmentId) {
  return withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `SELECT p.id, p.name, p.part_no AS "partNo", p.type_id AS "typeId",
              p.sort_order AS "sortOrder"
       FROM parts p
       WHERE p.deleted_at IS NULL
         AND p.status = 1
         AND p.type_id IN (
           SELECT part_type_id FROM equipment_parts
           WHERE equipment_id = $1 AND deleted_at IS NULL
         )
       ORDER BY p.sort_order, p.id`,
      equipmentId,
    ),
  );
}

async function getStopReasonsForEquipment(tenant, equipmentId) {
  // stop_category is the "type" table for stop reasons (per RESOLVED i).
  return withTenant(tenant, async (tx) => {
    const categories = await tx.$queryRawUnsafe(
      `SELECT sc.id AS "typeId", sc.name AS "typeName"
       FROM stop_category sc
       WHERE sc.id IN (
           SELECT reason_type_id FROM equipment_stop_reasons
           WHERE equipment_id = $1 AND deleted_at IS NULL
         )
         AND sc.deleted_at IS NULL
       ORDER BY sc.id`,
      equipmentId,
    );
    if (!categories.length) return [];
    const typeIds = categories.map((c) => c.typeId);
    const reasons = await tx.$queryRawUnsafe(
      `SELECT id, name, type_id AS "typeId", sort_order AS "sortOrder"
       FROM stop_reasons
       WHERE type_id = ANY($1::int[]) AND deleted_at IS NULL AND status = 1
       ORDER BY sort_order, id`,
      typeIds,
    );
    const byType = new Map();
    for (const cat of categories) byType.set(cat.typeId, { typeId: cat.typeId, typeName: cat.typeName, reasons: [] });
    for (const r of reasons) {
      const bucket = byType.get(r.typeId);
      if (bucket) bucket.reasons.push({ id: r.id, name: r.name });
    }
    return Array.from(byType.values());
  });
}

async function getScrapReasonsForEquipment(tenant, equipmentId) {
  // types(entity='ScrapReason') is the "type" table for scrap reasons (per RESOLVED i).
  return withTenant(tenant, async (tx) => {
    const categories = await tx.$queryRawUnsafe(
      `SELECT t.id AS "typeId", t.name AS "typeName"
       FROM types t
       WHERE t.id IN (
           SELECT reason_type_id FROM equipment_scrap_reasons
           WHERE equipment_id = $1 AND deleted_at IS NULL
         )
         AND t.deleted_at IS NULL
         AND t.entity = 'ScrapReason'
       ORDER BY t.sort_order, t.id`,
      equipmentId,
    );
    if (!categories.length) return [];
    const typeIds = categories.map((c) => c.typeId);
    const reasons = await tx.$queryRawUnsafe(
      `SELECT id, name, type_id AS "typeId", sort_order AS "sortOrder"
       FROM scrap_reasons
       WHERE type_id = ANY($1::int[]) AND deleted_at IS NULL AND status = 1
       ORDER BY sort_order, id`,
      typeIds,
    );
    const byType = new Map();
    for (const cat of categories) byType.set(cat.typeId, { typeId: cat.typeId, typeName: cat.typeName, reasons: [] });
    for (const r of reasons) {
      const bucket = byType.get(r.typeId);
      if (bucket) bucket.reasons.push({ id: r.id, name: r.name });
    }
    return Array.from(byType.values());
  });
}

async function getOrdersForEquipment(tenant, equipmentId) {
  return withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `SELECT o.id, o.order_nr AS "orderNr", o.description, o.type_id AS "typeId",
              o.flow_id AS "flowId", o.part_id AS "partId"
       FROM orders o
       WHERE o.deleted_at IS NULL
         AND o.status = 1
         AND (
           o.equipment_id = $1
           OR o.type_id IN (
             SELECT order_type_id FROM equipment_orders
             WHERE equipment_id = $1 AND deleted_at IS NULL
           )
         )
       ORDER BY o.id DESC`,
      equipmentId,
    ),
  );
}

module.exports = {
  list, findOne, create, update, softDelete, getTree,
  getPartsForEquipment, getStopReasonsForEquipment, getScrapReasonsForEquipment, getOrdersForEquipment,
};
