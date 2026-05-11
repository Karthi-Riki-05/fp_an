'use strict';

const { withTenant } = require('../prisma/client');
const { tenantListPaginated, tenantFindOne, tenantInsert, tenantUpdate, tenantSoftDelete } = require('../helpers/tenant-table.helpers');

const TABLE = 'stop_reasons';
const SELECT_MAP = { id: 'id', name: 'name', typeId: 'type_id', description: 'description', sortOrder: 'sort_order', createdAt: 'created_at' };

function list(tenant, q) {
  const filters = [];
  if (q.search) filters.push({ column: 'name', op: 'ILIKE', value: q.search });
  if (q.name) filters.push({ column: 'name', op: 'ILIKE', value: q.name });
  return tenantListPaginated({
    withTenant, tenant, table: TABLE, selectMap: SELECT_MAP,
    page: q.page ?? 1, perPage: q.perPage ?? 10, filters,
    orderBy: { column: q.sort === 'sortOrder' ? 'sort_order' : (q.sort ?? 'id'), dir: q.order ?? 'desc' },
  });
}

function findOne(tenant, id) {
  return tenantFindOne({ withTenant, tenant, table: TABLE, selectMap: SELECT_MAP, id });
}

function create(tenant, dto) {
  return tenantInsert({ withTenant, tenant, table: TABLE, selectMap: SELECT_MAP, values: { name: dto.name, type_id: dto.typeId, description: dto.description ?? '', sort_order: dto.sortOrder ?? 0, status: 1 } });
}

function update(tenant, id, dto) {
  const v = {};
  if (dto.name !== undefined) v.name = dto.name;
  if (dto.typeId !== undefined) v.type_id = dto.typeId;
  if (dto.description !== undefined) v.description = dto.description;
  if (dto.sortOrder !== undefined) v.sort_order = dto.sortOrder;
  return tenantUpdate({ withTenant, tenant, table: TABLE, selectMap: SELECT_MAP, id, values: v });
}

function softDelete(tenant, id) {
  return tenantSoftDelete({ withTenant, tenant, table: TABLE, id });
}

module.exports = { list, findOne, create, update, softDelete };
