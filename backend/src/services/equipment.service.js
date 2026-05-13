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
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(`SELECT ${SELECT} FROM equipment WHERE id = $1 AND deleted_at IS NULL`, id),
  );
  if (!rows[0]) throw new NotFoundError('equipment-not-found');
  return rows[0];
}

async function create(tenant, dto) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `INSERT INTO equipment (company_id, sort_order, parent_id, type_id, name, description, icon, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
       RETURNING ${SELECT}`,
      0, dto.sortOrder ?? 0, dto.parentId ?? 0, dto.typeId ?? 0, dto.name, dto.description ?? null, dto.icon ?? 'noimage.jpg', dto.isActive ?? true,
    ),
  );
  return rows[0];
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

  if (sets.length === 0) return findOne(tenant, id);
  sets.push('updated_at = now()');
  values.push(id);

  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(`UPDATE equipment SET ${sets.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING ${SELECT}`, ...values),
  );
  if (!rows[0]) throw new NotFoundError('equipment-not-found');
  return rows[0];
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
