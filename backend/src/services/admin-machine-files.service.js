'use strict';

const { withTenant } = require('../prisma/client');
const { NotFoundError, BadRequestError } = require('../errors');
const fileStorage = require('./file-storage.service');

/**
 * File versions on a MachineDocument (legacy `machine_files`, renamed
 * `machine_document_files` in v3). The list is always scoped to a machine
 * (the parent document) and writes go through FileStorageService so the
 * S3 driver can be swapped in for prod (Phase 0 v2 §11).
 */

const TABLE = 'machine_document_files';
const SELECT = `id, machine_id AS "machineDocId", filename, filetype,
  is_main AS "isMain", is_locked AS "isLocked",
  uploaded_at AS "uploadedAt", downloaded_at AS "downloadedAt",
  user_id AS "uploadedByUserId", uploaded_by_email AS "uploadedByEmail", uploaded_by_name AS "uploadedByName",
  locked_by_user_id AS "lockedByUserId", locked_by_email AS "lockedByEmail", locked_by_name AS "lockedByName",
  notes, is_active AS "isActive",
  created_at AS "createdAt"`;

/**
 * Multipart form-data sends every field as a string. A bare `Boolean('false')`
 * is `true` because non-empty strings are truthy. Coerce literally.
 */
function parseBool(v, fallback = false) {
  if (typeof v === 'boolean') return v;
  if (v === undefined || v === null) return fallback;
  const s = String(v).toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

/** Cheap content-type → legacy `filetype` mapping. */
function classifyFiletype(mimetype, originalName) {
  const mt = (mimetype || '').toLowerCase();
  if (mt.startsWith('image/')) return 'Image';
  if (mt === 'application/pdf') return 'PDF';
  if (mt.startsWith('video/')) return 'Video';
  if (mt.includes('excel') || mt.includes('spreadsheet')) return 'Excel';
  const ext = (originalName || '').split('.').pop()?.toLowerCase() ?? '';
  if (['jpg','jpeg','png','gif','webp'].includes(ext)) return 'Image';
  if (ext === 'pdf') return 'PDF';
  if (['mp4','mov','flv','vlc'].includes(ext)) return 'Video';
  if (['xls','xlsx'].includes(ext)) return 'Excel';
  return 'Image';
}

async function list(tenant, q = {}) {
  if (!q.machineId) throw new BadRequestError('machineId-required');
  const machineId = Number(q.machineId);
  return withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `SELECT ${SELECT} FROM ${TABLE} WHERE machine_id = $1 AND deleted_at IS NULL ORDER BY id DESC`,
      machineId,
    ),
  );
}

async function upload(tenant, user, dto, file) {
  if (!file || !file.buffer) throw new BadRequestError('file-required');
  if (!dto.machineId) throw new BadRequestError('machineId-required');
  const machineId = Number(dto.machineId);
  const stored = await fileStorage.put(
    `tenant-${tenant.tenantId}/machines/${machineId}`,
    file.originalname,
    file.buffer,
    file.mimetype,
  );
  const filetype = classifyFiletype(file.mimetype, file.originalname);
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `INSERT INTO ${TABLE}
         (machine_id, filename, filetype, is_main, is_locked, is_active,
          user_id, uploaded_by_email, uploaded_by_name,
          uploaded_at, created_at, updated_at)
       VALUES ($1, $2, $3::"tenant_template"."MachineFileType", true, $4, true,
               $5, $6, $7,
               now(), now(), now())
       RETURNING ${SELECT}`,
      machineId,
      stored.key,
      filetype,
      parseBool(dto.isLocked, false),
      user?.id ?? 0,
      user?.email ?? '',
      user?.name ?? '',
    ),
  );
  return rows[0];
}

async function update(tenant, id, dto) {
  const sets = [];
  const values = [];
  const push = (sql, v) => { sets.push(sql.replace('$?', `$${values.length + 1}`)); values.push(v); };
  if (dto.notes !== undefined) push('notes = $?', dto.notes);
  if (dto.isLocked !== undefined) push('is_locked = $?', parseBool(dto.isLocked));
  if (sets.length === 0) {
    const row = await withTenant(tenant, (tx) =>
      tx.$queryRawUnsafe(`SELECT ${SELECT} FROM ${TABLE} WHERE id = $1 AND deleted_at IS NULL`, id),
    );
    if (!row[0]) throw new NotFoundError('machine-file-not-found');
    return row[0];
  }
  sets.push('updated_at = now()');
  values.push(id);
  const rows = await withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `UPDATE ${TABLE} SET ${sets.join(', ')} WHERE id = $${values.length} AND deleted_at IS NULL RETURNING ${SELECT}`,
      ...values,
    ),
  );
  if (!rows[0]) throw new NotFoundError('machine-file-not-found');
  return rows[0];
}

async function softDelete(tenant, id) {
  const result = await withTenant(tenant, (tx) =>
    tx.$executeRawUnsafe(`UPDATE ${TABLE} SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, id),
  );
  if (result === 0) throw new NotFoundError('machine-file-not-found');
}

module.exports = { list, upload, update, softDelete };
