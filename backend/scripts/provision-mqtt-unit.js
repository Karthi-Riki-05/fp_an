#!/usr/bin/env node
'use strict';

/**
 * Provision MQTT credentials from the command line.
 *
 *   # one Raspberry Pi (companyId is the tenant id — the Company user's id)
 *   node scripts/provision-mqtt-unit.js 66 UNIT-01
 *
 *   # the backend's own broker account (run once per deployment)
 *   node scripts/provision-mqtt-unit.js --backend
 *
 *   # revoke a unit immediately
 *   node scripts/provision-mqtt-unit.js --revoke 66 UNIT-01
 *
 * The password is printed once. There is no way to recover it afterwards.
 */

require('dotenv').config();

const crypto = require('crypto');
const { prisma, disconnect } = require('../src/prisma/client');
const mqttAuth = require('../src/services/mqtt-auth.service');

async function provisionBackend() {
  const password = crypto.randomBytes(32).toString('base64url');
  const hash = mqttAuth.hashPassword(password);
  await prisma.$executeRawUnsafe(
    `INSERT INTO public.mqtt_devices (username, password_hash, company_id, unit_name, is_superuser, updated_at)
     VALUES ('fp-backend', $1, 0, '_backend', TRUE, NOW())
     ON CONFLICT (username) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, is_superuser = TRUE,
           disabled = FALSE, updated_at = NOW()`,
    hash,
  );
  console.log('\nBackend broker service account provisioned.\n');
  console.log('Put these in .env.production:\n');
  console.log(`  MQTT_USERNAME=fp-backend`);
  console.log(`  MQTT_PASSWORD=${password}`);
  console.log(`  MQTT_CLIENT_ID=fp-backend\n`);
  console.log('Then restart the backend and the broker.\n');
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--backend') return provisionBackend();

  if (args[0] === '--revoke') {
    const [, companyId, unitName] = args;
    if (!companyId || !unitName) throw new Error('usage: --revoke <companyId> <unitName>');
    const r = await mqttAuth.revokeUnit(companyId, unitName);
    console.log(r.revoked ? `Revoked ${r.username}` : `No such device: ${r.username}`);
    return;
  }

  const [companyId, unitName] = args;
  if (!companyId || !unitName) {
    console.error('usage: node scripts/provision-mqtt-unit.js <companyId> <unitName>');
    console.error('       node scripts/provision-mqtt-unit.js --backend');
    console.error('       node scripts/provision-mqtt-unit.js --revoke <companyId> <unitName>');
    process.exit(1);
  }

  const c = await mqttAuth.provisionUnit(companyId, unitName);
  console.log('\nUnit provisioned. Configure the Raspberry Pi with:\n');
  console.log(`  broker    ${c.brokerUrl ?? 'mqtts://<host>:8883  (set MQTT_BROKER_URL_PUBLIC)'}`);
  console.log(`  username  ${c.username}`);
  console.log(`  client id ${c.clientId}      <- must match the username exactly`);
  console.log(`  password  ${c.password}`);
  console.log(`  topics    ${c.topicPrefix}/...`);
  console.log(`  ca cert   copy docker/mosquitto/certs/ca.crt to /etc/fpanalyzer/ca.crt\n`);
  console.log('The password is not stored in recoverable form — save it now.\n');
}

main()
  .catch((err) => { console.error(`\nError: ${err.message}\n`); process.exitCode = 1; })
  .finally(() => disconnect());
