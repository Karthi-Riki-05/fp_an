'use strict';

const { withTenant } = require('../prisma/client');
const { tenantListPaginated, tenantFindOne, tenantInsert, tenantUpdate, tenantSoftDelete } = require('../helpers/tenant-table.helpers');

const TABLE = 'parts';
const SELECT_MAP = { id: 'id', name: 'name', partNo: 'part_no', description: 'description', typeId: 'type_id', purchasePrice: 'purchase_price', salesPrice: 'sales_price', sortOrder: 'sort_order', createdAt: 'created_at' };

function list(tenant, q) {
  // equipmentId requires a sub-query through equipment_parts — handled inline.
  if (q.equipmentId !== undefined) {
    return _listByEquipment(tenant, q);
  }

  const filters = [];
  if (q.search) filters.push({ column: 'name', op: 'ILIKE', value: q.search });
  if (q.name) filters.push({ column: 'name', op: 'ILIKE', value: q.name });
  if (q.partNo) filters.push({ column: 'part_no', op: 'ILIKE', value: q.partNo });
  if (q.typeId !== undefined) filters.push({ column: 'type_id', op: '=', value: q.typeId });
  return tenantListPaginated({
    withTenant, tenant, table: TABLE, selectMap: SELECT_MAP,
    page: q.page ?? 1, perPage: q.perPage ?? 10, filters,
    orderBy: { column: q.sort === 'sortOrder' ? 'sort_order' : (q.sort ?? 'id'), dir: q.order ?? 'desc' },
  });
}

async function _listByEquipment(tenant, q) {
  const page = q.page ?? 1;
  const perPage = q.perPage ?? 50;
  const skip = (page - 1) * perPage;
  const params = [Number(q.equipmentId)];
  const where = [
    `p.deleted_at IS NULL`,
    `p.status = 1`,
    `p.type_id IN (
       SELECT part_type_id FROM equipment_parts
       WHERE equipment_id = $1 AND deleted_at IS NULL
     )`,
  ];
  if (q.search) { params.push(`%${q.search}%`); where.push(`p.name ILIKE $${params.length}`); }
  if (q.name) { params.push(`%${q.name}%`); where.push(`p.name ILIKE $${params.length}`); }
  if (q.partNo) { params.push(`%${q.partNo}%`); where.push(`p.part_no ILIKE $${params.length}`); }
  if (q.typeId !== undefined) { params.push(Number(q.typeId)); where.push(`p.type_id = $${params.length}`); }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const orderCol = q.sort === 'sortOrder' ? 'p.sort_order' : 'p.id';
  const orderDir = q.order === 'asc' ? 'ASC' : 'DESC';
  return withTenant(tenant, async (tx) => {
    const data = await tx.$queryRawUnsafe(
      `SELECT p.id, p.name, p.part_no AS "partNo", p.description, p.type_id AS "typeId",
              p.purchase_price AS "purchasePrice", p.sales_price AS "salesPrice",
              p.sort_order AS "sortOrder", p.created_at AS "createdAt"
       FROM parts p ${whereSql}
       ORDER BY ${orderCol} ${orderDir}, p.id ${orderDir}
       LIMIT ${perPage} OFFSET ${skip}`,
      ...params,
    );
    const total = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM parts p ${whereSql}`, ...params,
    );
    return { data, total: Number(total[0]?.count ?? 0n), page, perPage };
  });
}

function findOne(tenant, id) {
  return tenantFindOne({ withTenant, tenant, table: TABLE, selectMap: SELECT_MAP, id });
}

function create(tenant, dto) {
  return tenantInsert({ withTenant, tenant, table: TABLE, selectMap: SELECT_MAP, values: { name: dto.name, part_no: dto.partNo ?? '0', description: dto.description ?? null, type_id: dto.typeId ?? 0, purchase_price: dto.purchasePrice ?? 0, sales_price: dto.salesPrice ?? 0, sort_order: dto.sortOrder ?? 0, status: 1 } });
}

function update(tenant, id, dto) {
  const v = {};
  if (dto.name !== undefined) v.name = dto.name;
  if (dto.partNo !== undefined) v.part_no = dto.partNo;
  if (dto.description !== undefined) v.description = dto.description;
  if (dto.typeId !== undefined) v.type_id = dto.typeId;
  if (dto.purchasePrice !== undefined) v.purchase_price = dto.purchasePrice;
  if (dto.salesPrice !== undefined) v.sales_price = dto.salesPrice;
  if (dto.sortOrder !== undefined) v.sort_order = dto.sortOrder;
  return tenantUpdate({ withTenant, tenant, table: TABLE, selectMap: SELECT_MAP, id, values: v });
}

function softDelete(tenant, id) {
  return tenantSoftDelete({ withTenant, tenant, table: TABLE, id });
}

module.exports = { list, findOne, create, update, softDelete };
