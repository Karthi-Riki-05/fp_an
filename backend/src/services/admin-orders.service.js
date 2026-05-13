'use strict';

const { withTenant } = require('../prisma/client');
const { NotFoundError, ConflictError } = require('../errors');

const SELECT = `o.id, o.status, o.type_id AS "typeId", o.order_nr AS "orderNr",
  o.description, o.flow_id AS "flowId", o.equipment_id AS "equipmentId",
  o.part_id AS "partId",
  o.start_date AS "startDate", o.end_date AS "endDate",
  o.planned_qty AS "plannedQty", o.ok_qty AS "okQty", o.scrap_qty AS "scrapQty",
  o.planned_hrs AS "plannedHrs", o.worked_hrs AS "workedHrs",
  o.remaining_qty AS "remainingQty", o.remaining_hrs AS "remainingHrs",
  o.sort_order AS "sortOrder",
  o.created_at AS "createdAt", o.updated_at AS "updatedAt",
  t.name AS "typeName", fd.name AS "flowName", e.name AS "equipmentName",
  p.name AS "partName", p.part_no AS "partNo"`;

const JOINS = `
  LEFT JOIN types t ON t.id = o.type_id
  LEFT JOIN flow_designs fd ON fd.id = o.flow_id
  LEFT JOIN equipment e ON e.id = o.equipment_id
  LEFT JOIN parts p ON p.id = o.part_id`;

async function list(tenant, q = {}) {
  const page = q.page ?? 1;
  const perPage = q.perPage ?? 10;
  const skip = (page - 1) * perPage;
  const params = [];
  const where = ['o.deleted_at IS NULL'];

  if (q.search) {
    params.push(`%${q.search}%`);
    where.push(`(o.order_nr ILIKE $${params.length} OR o.description ILIKE $${params.length})`);
  }
  if (q.equipmentId !== undefined) { params.push(Number(q.equipmentId)); where.push(`o.equipment_id = $${params.length}`); }
  if (q.flowId !== undefined)      { params.push(Number(q.flowId));      where.push(`o.flow_id = $${params.length}`); }
  if (q.typeId !== undefined)      { params.push(Number(q.typeId));      where.push(`o.type_id = $${params.length}`); }
  if (q.partId !== undefined)      { params.push(Number(q.partId));      where.push(`o.part_id = $${params.length}`); }
  if (q.status !== undefined)      { params.push(Number(q.status));      where.push(`o.status = $${params.length}`); }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const dir = q.order === 'asc' ? 'ASC' : 'DESC';

  return withTenant(tenant, async (tx) => {
    const data = await tx.$queryRawUnsafe(
      `SELECT ${SELECT} FROM orders o ${JOINS} ${whereSql}
       ORDER BY o.id ${dir} LIMIT ${perPage} OFFSET ${skip}`,
      ...params,
    );
    const total = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM orders o ${whereSql}`, ...params,
    );
    return { data, total: Number(total[0]?.count ?? 0n), page, perPage };
  });
}

async function findOne(tenant, id) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(`SELECT ${SELECT} FROM orders o ${JOINS} WHERE o.id = $1 AND o.deleted_at IS NULL`, id),
  );
  if (!rows[0]) throw new NotFoundError('order-not-found');
  return rows[0];
}

async function create(tenant, dto) {
  try {
    const rows = await withTenant(tenant, (tx) =>
      tx.$queryRawUnsafe(
        `INSERT INTO orders (status, type_id, order_nr, description, flow_id, equipment_id, part_id,
                              start_date, end_date, planned_qty, ok_qty, scrap_qty,
                              planned_hrs, worked_hrs, remaining_qty, remaining_hrs, sort_order,
                              created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz, $10, $11, $12, $13, $14, $15, $16, $17, now(), now())
         RETURNING id`,
        dto.status ?? 1,
        Number(dto.typeId ?? 0),
        dto.orderNr ?? '',
        dto.description ?? '',
        Number(dto.flowId ?? 0),
        Number(dto.equipmentId ?? 0),
        Number(dto.partId ?? 0),
        dto.startDate ?? null,
        dto.endDate ?? null,
        Number(dto.plannedQty ?? 0),
        Number(dto.okQty ?? 0),
        Number(dto.scrapQty ?? 0),
        Number(dto.plannedHrs ?? 0),
        Number(dto.workedHrs ?? 0),
        Number(dto.remainingQty ?? 0),
        Number(dto.remainingHrs ?? 0),
        Number(dto.sortOrder ?? 0),
      ),
    );
    return findOne(tenant, rows[0].id);
  } catch (err) {
    if (
      err?.code === 'P2002' ||
      /Code: `?23505`?/i.test(err?.message ?? '') ||
      /unique/i.test(err?.message ?? '') ||
      /already exists/i.test(err?.message ?? '')
    ) {
      throw new ConflictError('order-nr-already-exists');
    }
    throw err;
  }
}

async function update(tenant, id, dto) {
  const sets = [];
  const values = [];
  const push = (sql, v) => { sets.push(sql.replace('$?', `$${values.length + 1}`)); values.push(v); };
  if (dto.status !== undefined)       push('status = $?', Number(dto.status));
  if (dto.typeId !== undefined)       push('type_id = $?', Number(dto.typeId));
  if (dto.orderNr !== undefined)      push('order_nr = $?', dto.orderNr);
  if (dto.description !== undefined)  push('description = $?', dto.description);
  if (dto.flowId !== undefined)       push('flow_id = $?', Number(dto.flowId));
  if (dto.equipmentId !== undefined)  push('equipment_id = $?', Number(dto.equipmentId));
  if (dto.partId !== undefined)       push('part_id = $?', Number(dto.partId));
  if (dto.startDate !== undefined)    push('start_date = $?::timestamptz', dto.startDate);
  if (dto.endDate !== undefined)      push('end_date = $?::timestamptz', dto.endDate);
  if (dto.plannedQty !== undefined)   push('planned_qty = $?', Number(dto.plannedQty));
  if (dto.okQty !== undefined)        push('ok_qty = $?', Number(dto.okQty));
  if (dto.scrapQty !== undefined)     push('scrap_qty = $?', Number(dto.scrapQty));
  if (dto.plannedHrs !== undefined)   push('planned_hrs = $?', Number(dto.plannedHrs));
  if (dto.workedHrs !== undefined)    push('worked_hrs = $?', Number(dto.workedHrs));
  if (dto.remainingQty !== undefined) push('remaining_qty = $?', Number(dto.remainingQty));
  if (dto.remainingHrs !== undefined) push('remaining_hrs = $?', Number(dto.remainingHrs));
  if (dto.sortOrder !== undefined)    push('sort_order = $?', Number(dto.sortOrder));

  if (sets.length === 0) return findOne(tenant, id);
  sets.push('updated_at = now()');
  values.push(id);

  try {
    const rows = await withTenant(tenant, (tx) =>
      tx.$queryRawUnsafe(
        `UPDATE orders SET ${sets.join(', ')}
         WHERE id = $${values.length} AND deleted_at IS NULL
         RETURNING id`,
        ...values,
      ),
    );
    if (!rows[0]) throw new NotFoundError('order-not-found');
    return findOne(tenant, id);
  } catch (err) {
    if (
      err?.code === 'P2002' ||
      /Code: `?23505`?/i.test(err?.message ?? '') ||
      /unique/i.test(err?.message ?? '') ||
      /already exists/i.test(err?.message ?? '')
    ) {
      throw new ConflictError('order-nr-already-exists');
    }
    throw err;
  }
}

async function softDelete(tenant, id) {
  const result = await withTenant(tenant, (tx) =>
    tx.$executeRawUnsafe(`UPDATE orders SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, id),
  );
  if (result === 0) throw new NotFoundError('order-not-found');
}

module.exports = { list, findOne, create, update, softDelete };
