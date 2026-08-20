#!/usr/bin/env node
'use strict';

/**
 * Applies the MQTT v2 migrations:
 *   - 002_mqtt_v2_public.sql  → public schema, once (device registry for the broker)
 *   - 002_mqtt_v2_tenant.sql  → tenant_template + every tenant_<id>
 *
 * Usage:  node scripts/run-mqtt-v2-migration.js
 * Requires DATABASE_URL (or .env in the parent dir).
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const MIG_DIR = path.join(__dirname, '..', 'migrations');
const PUBLIC_SQL = fs.readFileSync(path.join(MIG_DIR, '002_mqtt_v2_public.sql'), 'utf8');
const OTA_SQL    = fs.readFileSync(path.join(MIG_DIR, '003_mqtt_ota.sql'), 'utf8');
const TENANT_SQL = fs.readFileSync(path.join(MIG_DIR, '002_mqtt_v2_tenant.sql'), 'utf8');

async function applyToSchema(client, schemaName) {
  const sql = TENANT_SQL.split('{{SCHEMA}}').join(schemaName);
  try {
    await client.query(sql);
    console.log(`  ✓ ${schemaName}`);
    return true;
  } catch (err) {
    console.error(`  ✗ ${schemaName}: ${err.message}`);
    return false;
  }
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('MQTT v2 migration\n');

  console.log('public schema (device registry):');
  try {
    await client.query(PUBLIC_SQL);
    console.log('  ✓ public.mqtt_devices');
  } catch (err) {
    console.error(`  ✗ public: ${err.message}`);
  }
  try {
    await client.query(OTA_SQL);
    console.log('  ✓ public.mqtt_devices OTA columns + firmware release row');
  } catch (err) {
    console.error(`  ✗ public (ota): ${err.message}`);
  }

  console.log('\ntenant schemas (idempotency columns):');
  let ok = 0;
  let failed = 0;

  if (await applyToSchema(client, 'tenant_template')) ok++; else failed++;

  const result = await client.query(
    `SELECT schema_name FROM information_schema.schemata
      WHERE schema_name ~ '^tenant_\\d+$'
      ORDER BY schema_name`,
  );
  for (const row of result.rows) {
    if (await applyToSchema(client, row.schema_name)) ok++; else failed++;
  }

  await client.end();
  console.log(`\nDone — ${ok} schema(s) migrated, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
