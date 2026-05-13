'use strict';

const { withTenant } = require('../prisma/client');
const { NotFoundError } = require('../errors');

/**
 * "Machines" admin = the legacy `machines` / new `machine_documents` table
 * (Phase 0 v2 A1 rename). Each row is a file-manager document attached to
 * an equipment + folder, with N file versions in `machine_document_files`.
 *
 * The API path stays `/admin/machines` for legacy URL consistency; the
 * Prisma model name is MachineDocument.
 */

const TABLE = 'machine_documents';
const SELECT = `md.id, md.name AS "machineName",
  md.equipment_id AS "equipmentId", e.name AS "equipmentName",
  md.folder_id AS "folderId", f.name AS "folderName",
  md.is_main AS "isMain", md.is_locked AS "isLocked",
  md.created_at AS "createdAt"`;

const JOINS = `
  LEFT JOIN equipment e ON e.id = md.equipment_id
  LEFT JOIN folders f ON f.id = md.folder_id`;

async function list(tenant, q = {}) {
  const page = q.page ?? 1;
  const perPage = q.perPage ?? 10;
  const skip = (page - 1) * perPage;
  const params = [];
  const where = ['md.deleted_at IS NULL'];
  if (q.search) { params.push(`%${q.search}%`); where.push(`md.name ILIKE $${params.length}`); }
  if (q.equipmentId !== undefined) { params.push(Number(q.equipmentId)); where.push(`md.equipment_id = $${params.length}`); }
  if (q.folderId !== undefined)    { params.push(Number(q.folderId));    where.push(`md.folder_id = $${params.length}`); }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const dir = q.order === 'asc' ? 'ASC' : 'DESC';

  return withTenant(tenant, async (tx) => {
    const data = await tx.$queryRawUnsafe(
      `SELECT ${SELECT} FROM ${TABLE} md ${JOINS} ${whereSql}
       ORDER BY md.id ${dir} LIMIT ${perPage} OFFSET ${skip}`,
      ...params,
    );
    const total = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM ${TABLE} md ${whereSql}`, ...params,
    );
    return { data, total: Number(total[0]?.count ?? 0n), page, perPage };
  });
}

async function findOne(tenant, id) {
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `SELECT ${SELECT} FROM ${TABLE} md ${JOINS} WHERE md.id = $1 AND md.deleted_at IS NULL`,
      id,
    ),
  );
  if (!rows[0]) throw new NotFoundError('machine-not-found');
  return rows[0];
}

async function create(tenant, dto) {
  // NOTE: legacy MachineDocument has no `notes` column (notes live on each
  // MachineDocumentFile). The brief's body included `notes`; it is silently
  // dropped here. Per-file notes are handled by the machine-files service.
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `INSERT INTO ${TABLE} (name, equipment_id, folder_id, is_main, is_locked, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now()) RETURNING id`,
      dto.name,
      Number(dto.equipmentId ?? 0),
      Number(dto.folderId ?? 0),
      // `isMain` is a legacy flag that stays true for a document's primary
      // (and currently only) record. Defaults true to match legacy storeMachine.
      Boolean(dto.isMain ?? true),
      Boolean(dto.isLocked ?? false),
    ),
  );
  return findOne(tenant, rows[0].id);
}

async function update(tenant, id, dto) {
  const sets = [];
  const values = [];
  const push = (sql, v) => { sets.push(sql.replace('$?', `$${values.length + 1}`)); values.push(v); };
  if (dto.name !== undefined)        push('name = $?', dto.name);
  if (dto.equipmentId !== undefined) push('equipment_id = $?', Number(dto.equipmentId));
  if (dto.folderId !== undefined)    push('folder_id = $?',    Number(dto.folderId));
  if (dto.isLocked !== undefined)    push('is_locked = $?',    Boolean(dto.isLocked));
  if (sets.length === 0) return findOne(tenant, id);
  sets.push('updated_at = now()');
  values.push(id);
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `UPDATE ${TABLE} SET ${sets.join(', ')} WHERE id = $${values.length} AND deleted_at IS NULL RETURNING id`,
      ...values,
    ),
  );
  if (!rows[0]) throw new NotFoundError('machine-not-found');
  return findOne(tenant, id);
}

async function patchStatus(tenant, id) {
  // `machine_documents` has no `status` column; "status" toggling in the
  // legacy app was the `is_locked` flag. Keep that semantic on this endpoint.
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `UPDATE ${TABLE} SET is_locked = NOT is_locked, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL RETURNING id, is_locked AS "isLocked"`,
      id,
    ),
  );
  if (!rows[0]) throw new NotFoundError('machine-not-found');
  return rows[0];
}

async function softDelete(tenant, id) {
  const result = await withTenant(tenant, (tx) =>
    tx.$executeRawUnsafe(`UPDATE ${TABLE} SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, id),
  );
  if (result === 0) throw new NotFoundError('machine-not-found');
}

module.exports = { list, findOne, create, update, patchStatus, softDelete };
