'use strict';

const { withTenant } = require('../prisma/client');
const { BadRequestError, NotFoundError } = require('../errors');

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

// ─────────────── Equipment Tree reorder / reparent ────────────────────────
//
// Mirrors legacy DashboardController@sortEquipments. The legacy endpoint
// branched on parent_changed (reorder-within-parent vs reparent) and updated
// one row per call; the new contract is a batch — clients send the full list
// of affected rows in one POST so the entire drop is atomic.
//
// Validation pipeline (all done BEFORE the transaction begins so we read
// the pre-update tree state):
//   1. dedupe & coerce inputs (parentId null/missing -> 0 root)
//   2. confirm every input id exists in this tenant and is not deleted
//   3. confirm every non-zero parentId exists in this tenant
//   4. anti-circular check: walk up from each new parentId on the CURRENT
//      tree; if we encounter the node being moved, reject 400.
// Then a single $transaction updates parent_id + sort_order on every row.

async function reorder(tenant, items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new BadRequestError('reorder-items-empty');
  }

  // Normalise inputs.
  const normalised = items.map((it) => {
    const id = Number(it?.id);
    const parentId = (it?.parentId === null || it?.parentId === undefined)
      ? 0
      : Number(it.parentId);
    const sortOrder = Number(it?.sortOrder);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestError(`invalid-id: ${it?.id}`);
    }
    if (!Number.isInteger(parentId) || parentId < 0) {
      throw new BadRequestError(`invalid-parentId: ${it?.parentId}`);
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      throw new BadRequestError(`invalid-sortOrder: ${it?.sortOrder}`);
    }
    if (parentId === id) {
      const err = new BadRequestError('circular-reference');
      err.nodeId = id;
      throw err;
    }
    return { id, parentId, sortOrder };
  });

  // De-duplicate by id (keep first occurrence; reject if a single id appears
  // with conflicting values).
  const byId = new Map();
  for (const row of normalised) {
    const existing = byId.get(row.id);
    if (existing && (existing.parentId !== row.parentId || existing.sortOrder !== row.sortOrder)) {
      throw new BadRequestError(`duplicate-id-conflict: ${row.id}`);
    }
    byId.set(row.id, row);
  }
  const inputs = [...byId.values()];
  const inputIds = inputs.map((i) => i.id);
  const parentIds = [...new Set(inputs.map((i) => i.parentId).filter((p) => p !== 0))];

  return withTenant(tenant, async (tx) => {
    // 2. All input ids belong to this tenant.
    const existing = await tx.$queryRawUnsafe(
      `SELECT id::int AS id, parent_id::int AS "parentId"
         FROM equipment
        WHERE id = ANY($1::int[]) AND deleted_at IS NULL`,
      inputIds,
    );
    if (existing.length !== inputIds.length) {
      const foundIds = new Set(existing.map((r) => r.id));
      const missing = inputIds.filter((id) => !foundIds.has(id));
      throw new NotFoundError(`equipment-not-found: ${missing.join(',')}`);
    }

    // 3. All proposed parent ids exist in this tenant (skip the 0 sentinel).
    if (parentIds.length > 0) {
      const parents = await tx.$queryRawUnsafe(
        `SELECT id::int AS id FROM equipment
          WHERE id = ANY($1::int[]) AND deleted_at IS NULL`,
        parentIds,
      );
      if (parents.length !== parentIds.length) {
        const foundIds = new Set(parents.map((r) => r.id));
        const missing = parentIds.filter((id) => !foundIds.has(id));
        throw new NotFoundError(`parent-not-found: ${missing.join(',')}`);
      }
    }

    // 4. Anti-circular walk on the CURRENT (pre-update) tree state.
    // Build a map of id → parentId for the whole tenant tree so a walk is
    // O(depth). Then for each input row, walk up from the proposed new
    // parent; if we encounter the row's own id, reject.
    const allRows = await tx.$queryRawUnsafe(
      `SELECT id::int AS id, parent_id::int AS "parentId"
         FROM equipment WHERE deleted_at IS NULL`,
    );
    const parentMap = new Map(allRows.map((r) => [r.id, r.parentId]));
    for (const row of inputs) {
      let cursor = row.parentId;
      const visited = new Set();
      while (cursor !== 0) {
        if (cursor === row.id) {
          const err = new BadRequestError('circular-reference');
          err.nodeId = row.id;
          throw err;
        }
        if (visited.has(cursor)) break; // pre-existing cycle (shouldn't happen) — bail
        visited.add(cursor);
        cursor = parentMap.get(cursor) ?? 0;
      }
    }

    // All checks passed — apply the updates.
    for (const row of inputs) {
      await tx.$executeRawUnsafe(
        `UPDATE equipment SET parent_id = $1, sort_order = $2, updated_at = now()
          WHERE id = $3 AND deleted_at IS NULL`,
        row.parentId, row.sortOrder, row.id,
      );
    }
    return { updated: inputs.length };
  });
}

async function updatePosition(tenant, id, parentId, sortOrder) {
  return reorder(tenant, [{ id, parentId, sortOrder }]);
}

// ─────────────── Equipment Properties (per-part-type config) ───────────────
// One row per (equipment, part type). Stores cycle time, operator count,
// salary group, value-adding cost, per-hour cost, currency, and the order
// number selection mode. Replaces legacy equipment_properties.

const PROP_SELECT = `id::int AS id, equip_id::int AS "equipmentId",
  type_id::int AS "typeId", cycle_time AS "cycleTime",
  cost_per_hour::int AS "costPerHour", currency,
  operator::int AS operator, salary_group_id::int AS "salaryGroupId",
  value_added_type AS "valueAddedType", value_added_val AS "valueAddedVal",
  order_selection AS "orderSelection"`;

async function getProperties(tenant, equipmentId) {
  return withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `SELECT ${PROP_SELECT} FROM equipment_properties WHERE equip_id = $1 ORDER BY id`,
      equipmentId,
    ),
  );
}

async function replaceProperties(tenant, equipmentId, rows) {
  if (!Array.isArray(rows)) rows = [];
  return withTenant(tenant, async (tx) => {
    await tx.$executeRawUnsafe(
      `DELETE FROM equipment_properties WHERE equip_id = $1`, equipmentId,
    );
    for (const r of rows) {
      const typeId = Number(r.typeId);
      if (!Number.isFinite(typeId) || typeId <= 0) continue;
      await tx.$executeRawUnsafe(
        `INSERT INTO equipment_properties (
           equip_id, type_id, cycle_time, cost_per_hour, currency, operator,
           salary_group_id, value_added_type, value_added_val, order_selection,
           created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8::tenant_template."ValueAddedType",
           $9,
           $10::tenant_template."OrderSelection",
           now(), now()
         )`,
        equipmentId,
        typeId,
        String(r.cycleTime ?? ''),
        Number(r.costPerHour) || 0,
        String(r.currency ?? ''),
        Number(r.operator) || 0,
        Number(r.salaryGroupId) || 0,
        r.valueAddedType === 'percentage' ? 'percentage' : 'currency',
        String(r.valueAddedVal ?? ''),
        r.orderSelection === 'list' ? 'list' : 'free_text',
      );
    }
    return tx.$queryRawUnsafe(
      `SELECT ${PROP_SELECT} FROM equipment_properties WHERE equip_id = $1 ORDER BY id`,
      equipmentId,
    );
  });
}

module.exports = {
  list, findOne, create, update, softDelete, getTree,
  getPartsForEquipment, getStopReasonsForEquipment, getScrapReasonsForEquipment, getOrdersForEquipment,
  getProperties, replaceProperties,
  reorder, updatePosition,
};
