#!/usr/bin/env node
'use strict';

/**
 * Applies migrations/001_mqtt_columns.sql to:
 *   - tenant_template (so new tenant schemas pick up the columns automatically)
 *   - every existing tenant_<id> schema
 *
 * Usage:
 *   node scripts/run-mqtt-migration.js
 *
 * Requires DATABASE_URL env var (or .env in the parent dir).
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const SQL_TEMPLATE = fs.readFileSync(
  path.join(__dirname, '..', 'migrations', '001_mqtt_columns.sql'),
  'utf8',
);

async function applyToSchema(client, schemaName) {
  const sql = SQL_TEMPLATE.split('{{SCHEMA}}').join(schemaName);
  try {
    await client.query(sql);
    console.log(`  ✓ ${schemaName}`);
  } catch (err) {
    console.error(`  ✗ ${schemaName}: ${err.message}`);
  }
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('Applying MQTT columns migration...\n');

  // 1. Apply to tenant_template first so new schemas inherit the columns.
  await applyToSchema(client, 'tenant_template');

  // 2. Find all existing tenant schemas.
  const result = await client.query(
    `SELECT schema_name FROM information_schema.schemata
      WHERE schema_name ~ '^tenant_\\d+$'
      ORDER BY schema_name`,
  );

  for (const row of result.rows) {
    await applyToSchema(client, row.schema_name);
  }

  await client.end();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
