'use strict';

const { PrismaClient } = require('@prisma/client');
const { buildTenantUrl } = require('./db-provisioner');

// Master Prisma client — connects to fp_analyzer (public schema: users, roles, tenants…)
const prisma = new PrismaClient();

// Cache of per-company Prisma clients, keyed by dbName.
// Each client points to a separate PostgreSQL database (e.g. "volvo_db").
const _tenantClients = new Map();

/**
 * Get (or create) a Prisma client for a company's own database.
 * The client is cached for the lifetime of the process.
 */
function getTenantClient(dbName) {
  if (_tenantClients.has(dbName)) return _tenantClients.get(dbName);
  const url = buildTenantUrl(dbName);
  const client = new PrismaClient({ datasources: { db: { url } } });
  _tenantClients.set(dbName, client);
  return client;
}

/**
 * Run a callback scoped to a specific tenant.
 *
 * Two routing modes:
 *   1. dbName is set  → company has its own PostgreSQL database.
 *      A cached PrismaClient for that database is used. The company DB has a
 *      `tenant_template` schema with all the company tables (same names as
 *      master's tenant_template schema), so the multi-schema Prisma client
 *      works transparently.
 *
 *   2. dbName is null → legacy/schema-per-tenant mode.
 *      A Prisma transaction is opened and SET LOCAL search_path is used to
 *      route to the per-tenant schema inside fp_analyzer.
 */
async function withTenant(tenant, cb) {
  // Support both (tenant object) and (schemaName string) call signatures
  if (typeof tenant === 'string') {
    return _withSchema(tenant, cb);
  }

  if (tenant.dbName) {
    // Per-company database: tables live in the tenant_template schema of the company's own DB.
    const client = getTenantClient(tenant.dbName);
    return client.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL search_path = "tenant_template", public`);
      return cb(tx);
    });
  }

  return _withSchema(tenant.schemaName, cb);
}

async function _withSchema(schemaName, cb) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schemaName)) {
    throw new Error(`Refusing unsafe tenant schema name: ${schemaName}`);
  }
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL search_path = "${schemaName}", public`);
    return cb(tx);
  });
}

async function ping() {
  const t0 = Date.now();
  await prisma.$queryRawUnsafe('SELECT 1');
  return { ok: true, latency_ms: Date.now() - t0 };
}

async function disconnect() {
  await prisma.$disconnect();
  for (const client of _tenantClients.values()) {
    await client.$disconnect().catch(() => {});
  }
}

module.exports = { prisma, withTenant, getTenantClient, ping, disconnect };
