'use strict';

/**
 * One-off script: reprovision missing tables for one or more tenants.
 *
 * Usage:
 *   node scripts/reprovision-tenant.js               # all tenants
 *   node scripts/reprovision-tenant.js 14            # tenant id 14 only
 *   node scripts/reprovision-tenant.js 14 7 23       # specific ids
 *
 * Safe to run repeatedly — skips tables that already exist in the schema.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function provisionSchema(tx, schemaName) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schemaName)) {
    throw new Error(`Unsafe schema name: ${schemaName}`);
  }

  await tx.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

  const tables = await tx.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'tenant_template' AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
  );

  let created = 0;
  let skipped = 0;

  for (const { table_name } of tables) {
    const exists = await tx.$queryRawUnsafe(
      `SELECT count(*)::int AS count FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = $2`,
      schemaName, table_name,
    );
    if (Number(exists[0]?.count ?? 0) > 0) {
      skipped++;
      continue;
    }
    await tx.$executeRawUnsafe(
      `CREATE TABLE "${schemaName}"."${table_name}" (LIKE "tenant_template"."${table_name}" INCLUDING ALL)`,
    );
    created++;
  }

  return { created, skipped };
}

async function main() {
  const args = process.argv.slice(2);

  let tenants;
  if (args.length > 0) {
    const ids = args.map(Number).filter(Boolean);
    tenants = await prisma.tenant.findMany({ where: { id: { in: ids } } });
  } else {
    tenants = await prisma.tenant.findMany({ where: { status: 'active' } });
  }

  if (tenants.length === 0) {
    console.log('No tenants found for the given IDs.');
    return;
  }

  for (const tenant of tenants) {
    if (!tenant.schemaName) {
      console.log(`  tenant ${tenant.id} (${tenant.name}): no schemaName — skipped`);
      continue;
    }

    if (tenant.dbName) {
      console.log(`  tenant ${tenant.id} (${tenant.name}): DB-per-tenant mode — skipped (run DDL against ${tenant.dbName} separately)`);
      continue;
    }

    process.stdout.write(`  tenant ${tenant.id} (${tenant.name}) schema="${tenant.schemaName}": `);
    try {
      const result = await prisma.$transaction(async (tx) => provisionSchema(tx, tenant.schemaName));
      console.log(`${result.created} tables created, ${result.skipped} already existed ✓`);
    } catch (err) {
      console.log(`FAILED — ${err.message}`);
    }
  }
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
