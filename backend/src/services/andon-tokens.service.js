'use strict';
const crypto = require('crypto');
const { prisma } = require('../prisma/client');

/**
 * Andon board tokens (Sprint 3 / Task 1). Stored in the GLOBAL `public`
 * schema (public.andon_tokens) and accessed via raw SQL on the global Prisma
 * client — the token must be resolvable WITHOUT tenant context because it is
 * what identifies the tenant for the public Andon board.
 */

function genId() { return 'atk_' + crypto.randomBytes(12).toString('hex'); }
function genToken() { return crypto.randomBytes(20).toString('hex'); }

async function createToken(companyId, { flowId, label, expiresAt } = {}) {
  const id = genId();
  const token = genToken();
  await prisma.$executeRawUnsafe(
    `INSERT INTO public.andon_tokens (id, flow_id, company_id, token, label, created_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, now(), $6)`,
    id, Number(flowId), Number(companyId), token, label ?? null,
    expiresAt ? new Date(expiresAt) : null
  );
  return { id, token, flowId: Number(flowId), label: label ?? null, expiresAt: expiresAt ?? null };
}

async function listTokens(companyId) {
  return prisma.$queryRawUnsafe(
    `SELECT id, flow_id AS "flowId", token, label,
            created_at AS "createdAt", expires_at AS "expiresAt"
     FROM public.andon_tokens
     WHERE company_id = $1
     ORDER BY created_at DESC`,
    Number(companyId)
  );
}

async function revokeToken(companyId, id) {
  const affected = await prisma.$executeRawUnsafe(
    `DELETE FROM public.andon_tokens WHERE id = $1 AND company_id = $2`,
    id, Number(companyId)
  );
  return affected > 0;
}

/** Resolve a token → { id, flowId, companyId } (null if missing/expired). */
async function resolveToken(token) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, flow_id AS "flowId", company_id AS "companyId", expires_at AS "expiresAt"
     FROM public.andon_tokens WHERE token = $1 LIMIT 1`,
    token
  );
  const t = rows[0];
  if (!t) return null;
  if (t.expiresAt && new Date(t.expiresAt).getTime() < Date.now()) return null;
  return { id: t.id, flowId: Number(t.flowId), companyId: Number(t.companyId) };
}

module.exports = { createToken, listTokens, revokeToken, resolveToken };
