'use strict';

const { withTenant } = require('../prisma/client');
const { tenantListPaginated, tenantFindOne, tenantSoftDelete } = require('../helpers/tenant-table.helpers');
const { NotFoundError } = require('../errors');

const TABLE = 'types';
const SELECT_MAP = { id: 'id', name: 'name', kind: 'type', entity: 'entity', description: 'description', icon: 'icon', sortOrder: 'sort_order', isActive: 'is_active', excludeType: 'exclude_type', createdAt: 'created_at' };

async function list(tenant, q) {
  const filters = [];
  if (q.search) filters.push({ column: 'name', op: 'ILIKE', value: q.search });
  if (q.name) filters.push({ column: 'name', op: 'ILIKE', value: q.name });
  if (q.entity) filters.push({ column: 'entity', op: '=', value: q.entity, cast: '"tenant_template"."TypeEntity"' });
  if (q.isActive !== undefined) filters.push({ column: 'is_active', op: '=', value: Boolean(q.isActive) });
  return tenantListPaginated({
    withTenant, tenant, table: TABLE, selectMap: SELECT_MAP,
    page: q.page ?? 1, perPage: q.perPage ?? 10, filters,
    orderBy: { column: q.sort === 'sortOrder' ? 'sort_order' : (q.sort ?? 'id'), dir: q.order ?? 'desc' },
  });
}

function findOne(tenant, id) {
  return tenantFindOne({ withTenant, tenant, table: TABLE, selectMap: SELECT_MAP, id });
}

async function create(tenant, dto) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `INSERT INTO types (name, type, entity, description, icon, sort_order, is_active, exclude_type, created_at, updated_at)
       VALUES ($1, $2::"tenant_template"."TypeKind", $3::"tenant_template"."TypeEntity", $4, $5, $6, $7, $8, now(), now())
       RETURNING id, name, type AS "kind", entity, description, icon, sort_order AS "sortOrder", is_active AS "isActive", exclude_type AS "excludeType", created_at AS "createdAt"`,
      dto.name, dto.kind ?? 'NotApplicable', dto.entity ?? 'Equipment', dto.description ?? null, dto.icon ?? 'noimage.jpg', dto.sortOrder ?? 0, dto.isActive ?? true, Boolean(dto.excludeType ?? false),
    ),
  );
  return rows[0];
}

async function update(tenant, id, dto) {
  const sets = [];
  const values = [];
  const push = (sql, value) => { sets.push(sql.replace('$?', `$${values.length + 1}`)); values.push(value); };
  if (dto.name !== undefined) push('name = $?', dto.name);
  if (dto.kind !== undefined) push('type = $?::"tenant_template"."TypeKind"', dto.kind);
  if (dto.entity !== undefined) push('entity = $?::"tenant_template"."TypeEntity"', dto.entity);
  if (dto.description !== undefined) push('description = $?', dto.description);
  if (dto.icon !== undefined) push('icon = $?', dto.icon);
  if (dto.sortOrder !== undefined) push('sort_order = $?', dto.sortOrder);
  if (dto.isActive !== undefined) push('is_active = $?', dto.isActive);
  if (dto.excludeType !== undefined) push('exclude_type = $?', Boolean(dto.excludeType));
  if (sets.length === 0) return findOne(tenant, id);
  sets.push('updated_at = now()');
  values.push(id);
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `UPDATE types SET ${sets.join(', ')} WHERE id = $${values.length} AND deleted_at IS NULL
       RETURNING id, name, type AS "kind", entity, description, icon, sort_order AS "sortOrder", is_active AS "isActive", exclude_type AS "excludeType", created_at AS "createdAt"`,
      ...values,
    ),
  );
  if (!rows[0]) throw new NotFoundError('not-found');
  return rows[0];
}

function softDelete(tenant, id) {
  return tenantSoftDelete({ withTenant, tenant, table: TABLE, id });
}

module.exports = { list, findOne, create, update, softDelete };
