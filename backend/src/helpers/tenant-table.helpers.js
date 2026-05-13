'use strict';

const { NotFoundError } = require('../errors');

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function safeIdent(name) {
  if (!IDENTIFIER.test(name)) throw new Error(`Unsafe SQL identifier: ${name}`);
  return name;
}

async function tenantListPaginated({ prismaClient, withTenant, tenant, table, selectMap, page, perPage, filters = [], orderBy, softDelete = true }) {
  const t = safeIdent(table);
  const skip = Math.max(0, (page - 1) * perPage);

  const select = Object.entries(selectMap)
    .map(([alias, col]) => `${safeIdent(col)} AS "${alias}"`)
    .join(', ');

  const params = [];
  const whereParts = [];
  if (softDelete) whereParts.push('deleted_at IS NULL');

  for (const f of filters) {
    const col = safeIdent(f.column);
    if (f.op === 'IS NULL' || f.op === 'IS NOT NULL') {
      whereParts.push(`${col} ${f.op}`);
    } else if (f.op === 'ILIKE') {
      params.push(`%${String(f.value ?? '').replace(/[%_]/g, (c) => `\\${c}`)}%`);
      whereParts.push(`${col} ILIKE $${params.length}`);
    } else {
      params.push(f.value);
      // Optional explicit cast for enum-typed columns (`f.cast = '"tenant_template"."TypeEntity"'`).
      // The cast string is validated as a Postgres identifier with optional schema-qualifier
      // and quotes, so it cannot be injected.
      let castSuffix = '';
      if (f.cast) {
        if (!/^"?[A-Za-z_][A-Za-z0-9_]*"?(\."?[A-Za-z_][A-Za-z0-9_]*"?)?$/.test(f.cast)) {
          throw new Error(`Unsafe SQL cast: ${f.cast}`);
        }
        castSuffix = `::${f.cast}`;
      }
      whereParts.push(`${col} = $${params.length}${castSuffix}`);
    }
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const orderCol = orderBy ? safeIdent(orderBy.column) : 'id';
  const orderDir = orderBy?.dir === 'asc' ? 'ASC' : 'DESC';

  return withTenant(tenant, async (tx) => {
    const data = await tx.$queryRawUnsafe(
      `SELECT ${select} FROM ${t} ${whereSql} ORDER BY ${orderCol} ${orderDir}, id ${orderDir} LIMIT ${perPage} OFFSET ${skip}`,
      ...params,
    );
    const totalRows = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM ${t} ${whereSql}`,
      ...params,
    );
    return { data, total: Number(totalRows[0]?.count ?? 0n), page, perPage };
  });
}

async function tenantFindOne({ withTenant, tenant, table, selectMap, id, softDelete = true }) {
  const t = safeIdent(table);
  const select = Object.entries(selectMap)
    .map(([alias, col]) => `${safeIdent(col)} AS "${alias}"`)
    .join(', ');
  const filter = softDelete ? 'WHERE id = $1 AND deleted_at IS NULL' : 'WHERE id = $1';
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(`SELECT ${select} FROM ${t} ${filter}`, id),
  );
  if (!rows[0]) throw new NotFoundError('not-found');
  return rows[0];
}

async function tenantInsert({ withTenant, tenant, table, values, selectMap }) {
  const t = safeIdent(table);
  const cols = Object.keys(values).map(safeIdent);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const params = Object.values(values);
  const select = Object.entries(selectMap)
    .map(([alias, col]) => `${safeIdent(col)} AS "${alias}"`)
    .join(', ');
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `INSERT INTO ${t} (${cols.join(', ')}, created_at, updated_at) VALUES (${placeholders}, now(), now()) RETURNING ${select}`,
      ...params,
    ),
  );
  return rows[0];
}

async function tenantUpdate({ withTenant, tenant, table, id, values, selectMap, softDelete = true }) {
  const t = safeIdent(table);
  const cols = Object.keys(values);
  if (cols.length === 0) {
    return tenantFindOne({ withTenant, tenant, table, selectMap, id, softDelete });
  }
  const sets = cols.map((c, i) => `${safeIdent(c)} = $${i + 1}`).join(', ');
  const params = Object.values(values);
  params.push(id);
  const select = Object.entries(selectMap)
    .map(([alias, col]) => `${safeIdent(col)} AS "${alias}"`)
    .join(', ');
  const filter = softDelete
    ? `WHERE id = $${params.length} AND deleted_at IS NULL`
    : `WHERE id = $${params.length}`;
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `UPDATE ${t} SET ${sets}, updated_at = now() ${filter} RETURNING ${select}`,
      ...params,
    ),
  );
  if (!rows[0]) throw new NotFoundError('not-found');
  return rows[0];
}

async function tenantSoftDelete({ withTenant, tenant, table, id }) {
  const t = safeIdent(table);
  const result = await withTenant(tenant, (tx) =>
    tx.$executeRawUnsafe(`UPDATE ${t} SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, id),
  );
  if (result === 0) throw new NotFoundError('not-found');
}

module.exports = { tenantListPaginated, tenantFindOne, tenantInsert, tenantUpdate, tenantSoftDelete };
