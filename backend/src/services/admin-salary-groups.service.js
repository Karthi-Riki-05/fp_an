'use strict';

const { withTenant } = require('../prisma/client');
const { tenantListPaginated, tenantFindOne, tenantInsert, tenantUpdate, tenantSoftDelete } = require('../helpers/tenant-table.helpers');

const TABLE = 'salary_group';
const SELECT_MAP = { id: 'id', name: 'name', hourlyRate: 'hourly_rate', info: 'info', createdAt: 'created_at' };

function list(tenant, q) {
  const filters = [];
  if (q.search) filters.push({ column: 'name', op: 'ILIKE', value: q.search });
  if (q.name) filters.push({ column: 'name', op: 'ILIKE', value: q.name });
  return tenantListPaginated({
    withTenant, tenant, table: TABLE, selectMap: SELECT_MAP,
    page: q.page ?? 1, perPage: q.perPage ?? 10, filters,
    orderBy: { column: q.sort ?? 'id', dir: q.order ?? 'desc' },
  });
}

function findOne(tenant, id) {
  return tenantFindOne({ withTenant, tenant, table: TABLE, selectMap: SELECT_MAP, id });
}

// hourly_rate is numeric(10,0) in Postgres — coerce strings to numbers so a
// JSON body of {"hourlyRate":"12"} doesn't blow up with "expression is of
// type text".
function toNumberOrZero(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function create(tenant, dto) {
  return tenantInsert({
    withTenant, tenant, table: TABLE, selectMap: SELECT_MAP,
    values: { name: dto.name, hourly_rate: toNumberOrZero(dto.hourlyRate), info: dto.info ?? '' },
  });
}

function update(tenant, id, dto) {
  const values = {};
  if (dto.name !== undefined) values.name = dto.name;
  if (dto.hourlyRate !== undefined) values.hourly_rate = toNumberOrZero(dto.hourlyRate);
  if (dto.info !== undefined) values.info = dto.info;
  return tenantUpdate({ withTenant, tenant, table: TABLE, selectMap: SELECT_MAP, id, values });
}

function softDelete(tenant, id) {
  return tenantSoftDelete({ withTenant, tenant, table: TABLE, id });
}

module.exports = { list, findOne, create, update, softDelete };
