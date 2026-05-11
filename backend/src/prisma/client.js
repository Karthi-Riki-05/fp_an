'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Run a callback inside a transaction with SET LOCAL search_path = "<schema>", public.
 * All queries in the callback operate against the per-tenant schema.
 */
async function withTenant(schemaName, cb) {
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
}

module.exports = { prisma, withTenant, ping, disconnect };
