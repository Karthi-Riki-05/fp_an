'use strict';

/**
 * Per-company database provisioner.
 *
 * When a company is created with a custom dbName (e.g. "volvo_db"), this
 * module:
 *   1. Creates the PostgreSQL database using a superuser connection to the
 *      master database.
 *   2. Connects to the new database and runs the tenant DDL template, which
 *      creates the tenant_template schema and all 40 company-data tables.
 *
 * The DDL template is the pg_dump of the master's tenant_template schema
 * (prisma/tenant-ddl.sql). It is idempotent — CREATE TABLE IF NOT EXISTS
 * patterns mean re-running it is safe.
 */

const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const DDL_PATH = path.resolve(__dirname, '../../prisma/tenant-ddl.sql');

/**
 * Parse the DATABASE_URL connection string into pg Pool config.
 * Strips the schema search_path override that Prisma appends.
 */
function parseDbUrl(url) {
  const u = new URL(url.split('?')[0]);
  return {
    host: u.hostname,
    port: Number(u.port) || 5432,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  };
}

function buildTenantUrl(dbName) {
  const url = new URL((process.env.DATABASE_URL || '').split('?')[0]);
  url.pathname = `/${dbName}`;
  return url.toString();
}

/**
 * Create a new PostgreSQL database and populate it with the tenant DDL.
 * Throws if the database already exists (caller should check first).
 */
async function createCompanyDatabase(dbName) {
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(dbName)) {
    throw new Error(`Unsafe database name: ${dbName}`);
  }

  const masterCfg = parseDbUrl(process.env.DATABASE_URL || '');

  // Step 1: CREATE DATABASE — must be done outside a transaction,
  // connected to the master database.
  const masterPool = new Pool({ ...masterCfg, database: masterCfg.database });
  try {
    // Check if database already exists
    const { rows } = await masterPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName],
    );
    if (rows.length > 0) throw new Error(`Database "${dbName}" already exists`);

    await masterPool.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await masterPool.end();
  }

  // Step 2: Connect to the new database and run the DDL template.
  const tenantPool = new Pool({ ...masterCfg, database: dbName });
  try {
    const raw = fs.readFileSync(DDL_PATH, 'utf8');

    // Strip psql meta-commands (\something lines) — these crash the pg driver.
    // Keep all real SQL including multi-line CREATE TABLE statements.
    const ddl = raw
      .split('\n')
      .filter((line) => !line.startsWith('\\'))
      .join('\n');

    const client = await tenantPool.connect();
    try {
      // Install required extensions (pg_trgm is used by GIN indexes on text cols)
      await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
      // Run the full tenant DDL (multi-statement string — pg handles it)
      await client.query(ddl);
    } finally {
      client.release();
    }
  } finally {
    await tenantPool.end();
  }
}

/**
 * Drop a company database — used as rollback when user creation fails.
 */
async function dropCompanyDatabase(dbName) {
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(dbName)) return;

  const masterCfg = parseDbUrl(process.env.DATABASE_URL || '');
  const pool = new Pool({ ...masterCfg, database: masterCfg.database });
  try {
    // Terminate all connections to the target database first
    await pool.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName],
    );
    await pool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  } finally {
    await pool.end();
  }
}

/**
 * Check whether a database with this name already exists on the server.
 */
async function databaseExists(dbName) {
  const masterCfg = parseDbUrl(process.env.DATABASE_URL || '');
  const pool = new Pool({ ...masterCfg, database: masterCfg.database });
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName],
    );
    return rows.length > 0;
  } finally {
    await pool.end();
  }
}

module.exports = { createCompanyDatabase, dropCompanyDatabase, databaseExists, buildTenantUrl };
