'use strict';

const { withTenant } = require('../prisma/client');
const { tenantInsert, tenantUpdate, tenantSoftDelete } = require('../helpers/tenant-table.helpers');
const { NotFoundError } = require('../errors');

const TABLE = 'scrap_reasons';
const SELECT_MAP = { id: 'id', name: 'name', typeId: 'type_id', description: 'description', sortOrder: 'sort_order', createdAt: 'created_at' };

async function list(tenant, q) {
  const page = q.page ?? 1;
  const perPage = q.perPage ?? 50;
  const skip = (page - 1) * perPage;
  const params = [];
  const whereParts = ['sr.deleted_at IS NULL'];
  if (q.search) { params.push(`%${q.search}%`); whereParts.push(`sr.name ILIKE $${params.length}`); }
  if (q.name) { params.push(`%${q.name}%`); whereParts.push(`sr.name ILIKE $${params.length}`); }
  if (q.typeId !== undefined) { params.push(Number(q.typeId)); whereParts.push(`sr.type_id = $${params.length}`); }
  const where = whereParts.join(' AND ');
  const orderCol = q.sort === 'sortOrder' ? 'sr.sort_order' : (q.sort === 'typeName' ? 'sc.name' : 'sr.id');
  const orderDir = q.order === 'asc' ? 'ASC' : 'DESC';
  return withTenant(tenant, async (tx) => {
    const data = await tx.$queryRawUnsafe(
      `SELECT sr.id, sr.name, sr.type_id AS "typeId", sc.name AS "typeName",
              sr.description, sr.sort_order AS "sortOrder", sr.created_at AS "createdAt"
       FROM scrap_reasons sr
       LEFT JOIN types sc ON sc.id = sr.type_id AND sc.entity = 'Scrap reason' AND sc.is_active = 'Y'
       WHERE ${where}
       ORDER BY ${orderCol} ${orderDir}, sr.id ${orderDir}
       LIMIT ${perPage} OFFSET ${skip}`,
      ...params
    );
    const totalRows = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM scrap_reasons sr WHERE ${where}`, ...params
    );
    return { data, total: Number(totalRows[0]?.count ?? 0n), page, perPage };
  });
}

async function findOne(tenant, id) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `SELECT sr.id, sr.name, sr.type_id AS "typeId", sc.name AS "typeName",
              sr.description, sr.sort_order AS "sortOrder", sr.created_at AS "createdAt"
       FROM scrap_reasons sr
       LEFT JOIN types sc ON sc.id = sr.type_id AND sc.entity = 'Scrap reason' AND sc.is_active = 'Y'
       WHERE sr.id = $1 AND sr.deleted_at IS NULL`,
      id
    )
  );
  if (!rows[0]) throw new NotFoundError('scrap-reason-not-found');
  return rows[0];
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
