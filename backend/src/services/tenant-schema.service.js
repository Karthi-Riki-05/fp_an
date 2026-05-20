'use strict';

const { prisma } = require('../prisma/client');

/**
 * Minimal replacement for the deleted tenants.service.js.
 *
 * Post Tenant-removal there is no `tenants` table — the schema name is
 * derived from the Company user's id. This module only owns DDL:
 *   - provisionSchema(companyUserId) — clone tenant_template into tenant_<id>
 *   - dropSchema(companyUserId)       — used during create rollback
 *   - syncSchemas()                   — startup helper, ensures every
 *                                       Company user has a complete schema
 */

const SCHEMA_NAME_RE = /^[a-z][a-z0-9_]{0,62}$/;

function schemaNameFor(companyUserId) {
  return `tenant_${Number(companyUserId)}`;
}

async function provisionSchema(prismaOrTx, companyUserId) {
  const schemaName = schemaNameFor(companyUserId);
  if (!SCHEMA_NAME_RE.test(schemaName)) throw new Error(`unsafe schema name: ${schemaName}`);
  await prismaOrTx.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

  const tables = await prismaOrTx.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'tenant_template' AND table_type = 'BASE TABLE' ORDER BY table_name`,
  );
  let cloned = 0;
  for (const { table_name } of tables) {
    const exists = await prismaOrTx.$queryRawUnsafe(
      `SELECT count(*) AS count FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
      schemaName, table_name,
    );
    if (exists[0]?.count && Number(exists[0].count) > 0) continue;
    await prismaOrTx.$executeRawUnsafe(`CREATE TABLE "${schemaName}"."${table_name}" (LIKE "tenant_template"."${table_name}" INCLUDING ALL)`);
    cloned++;
  }
  return { schemaName, cloned };
}

async function dropSchema(companyUserId) {
  const schemaName = schemaNameFor(companyUserId);
  if (!SCHEMA_NAME_RE.test(schemaName)) throw new Error(`unsafe schema name: ${schemaName}`);
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
}

/**
 * Ensure every active Company user has a populated tenant schema. Safe to
 * call at startup — skips users whose schemas are already in sync.
 */
async function syncSchemas() {
  const companyUsers = await prisma.user.findMany({
    where: {
      deletedAt: null,
      status: 1,
      userRoles: { some: { role: { name: 'Company' } } },
    },
    select: { id: true, name: true, email: true },
  });
  let provisioned = 0;
  for (const u of companyUsers) {
    try {
      await prisma.$transaction((tx) => provisionSchema(tx, u.id));
      provisioned++;
    } catch (err) {
      console.error(`[syncSchemas] ${u.email} (id=${u.id}): ${err.message}`);
    }
  }
  if (provisioned > 0) console.log(`[syncSchemas] checked ${provisioned} company schema(s).`);
}

module.exports = { provisionSchema, dropSchema, syncSchemas, schemaNameFor };
