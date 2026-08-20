'use strict';

/**
 * MQTT device credential provisioning.
 *
 * Credentials live in public.mqtt_devices, which the broker reads directly via
 * the mosquitto-go-auth Postgres backend. Provisioning is therefore a single
 * database write — no mosquitto_passwd, no ACL file edit, no SIGHUP. That is
 * what makes 500+ units workable.
 *
 * Identity is per PHYSICAL UNIT (one Raspberry Pi), not per machine:
 *   username = client id = fp-{companyId}-{unitName}
 * A unit publishes for all of its pins under one connection; pin_no in the
 * payload selects the machine.
 *
 * Hash format is mosquitto-go-auth's PBKDF2 encoding:
 *   PBKDF2$sha512$<iterations>$<base64 salt>$<base64 key>
 */

const crypto = require('crypto');
const { prisma } = require('../prisma/client');

const ITERATIONS = 100_000;
const KEY_LEN = 64;
const DIGEST = 'sha512';
const SALT_BYTES = 16;

/** Build a mosquitto-go-auth PBKDF2 hash string. */
function hashPassword(plain, iterations = ITERATIONS) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key = crypto.pbkdf2Sync(plain, salt, iterations, KEY_LEN, DIGEST);
  return `PBKDF2$${DIGEST}$${iterations}$${salt.toString('base64')}$${key.toString('base64')}`;
}

/** Verify a plaintext password against a stored PBKDF2 string (used by tests/tools). */
function verifyPassword(plain, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 5 || parts[0] !== 'PBKDF2') return false;
  const [, digest, iterStr, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = crypto.pbkdf2Sync(
    plain, Buffer.from(saltB64, 'base64'), Number(iterStr), expected.length, digest,
  );
  return crypto.timingSafeEqual(expected, actual);
}

/** Broker username for a unit. Must match the client id the firmware connects with. */
function usernameFor(companyId, unitName) {
  return `fp-${Number(companyId)}-${String(unitName).trim()}`;
}

/**
 * Issue (or re-issue) credentials for one physical unit.
 * The plaintext password is returned once and never stored.
 */
async function provisionUnit(companyId, unitName, { firmware = null } = {}) {
  const cid = Number(companyId);
  const unit = String(unitName ?? '').trim();
  if (!cid) throw Object.assign(new Error('companyId required'), { statusCode: 400 });
  if (!unit) throw Object.assign(new Error('unitName required'), { statusCode: 400 });
  if (!/^[A-Za-z0-9._-]{1,50}$/.test(unit)) {
    throw Object.assign(
      new Error('unitName must be 1-50 chars of A-Z a-z 0-9 . _ - (it becomes an MQTT topic segment)'),
      { statusCode: 400 },
    );
  }

  const username = usernameFor(cid, unit);
  const password = crypto.randomBytes(32).toString('base64url');
  const passwordHash = hashPassword(password);

  await prisma.$executeRawUnsafe(
    `INSERT INTO public.mqtt_devices (username, password_hash, company_id, unit_name, firmware, provisioned_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     ON CONFLICT (username) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           disabled      = FALSE,
           firmware      = COALESCE(EXCLUDED.firmware, public.mqtt_devices.firmware),
           provisioned_at= NOW(),
           updated_at    = NOW()`,
    username, passwordHash, cid, unit, firmware,
  );

  return {
    username,
    clientId: username,
    password,
    companyId: cid,
    unitName: unit,
    brokerUrl: process.env.MQTT_BROKER_URL_PUBLIC || null,
    topicPrefix: `fp/${cid}/${unit}`,
    aclPattern: `fp/${cid}/${unit}/#`,
    provisionedAt: new Date().toISOString(),
    note: 'Store the password securely — it is not recoverable.',
  };
}

/** Revoke one unit immediately. The broker drops it on the next auth check. */
async function revokeUnit(companyId, unitName) {
  const username = usernameFor(companyId, unitName);
  const n = await prisma.$executeRawUnsafe(
    `UPDATE public.mqtt_devices SET disabled = TRUE, updated_at = NOW() WHERE username = $1`,
    username,
  );
  return { username, revoked: n > 0 };
}

/** List provisioned units for a company (no secrets). */
async function listUnits(companyId) {
  return prisma.$queryRawUnsafe(
    `SELECT username, company_id AS "companyId", unit_name AS "unitName",
            disabled, firmware, last_seen_at AS "lastSeenAt", provisioned_at AS "provisionedAt"
       FROM public.mqtt_devices
      WHERE company_id = $1 AND is_superuser = FALSE
      ORDER BY unit_name`,
    Number(companyId),
  );
}

/** Resolve a broker username back to (companyId, unitName). Returns null if unknown/disabled. */
async function lookupUnit(username) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT company_id AS "companyId", unit_name AS "unitName"
       FROM public.mqtt_devices
      WHERE username = $1 AND disabled = FALSE LIMIT 1`,
    String(username),
  );
  return rows[0] ?? null;
}

/** Record liveness + firmware from a status/conn message. */
async function touchUnit(companyId, unitName, firmware) {
  await prisma.$executeRawUnsafe(
    `UPDATE public.mqtt_devices
        SET last_seen_at = NOW(),
            firmware     = COALESCE($3, firmware),
            updated_at   = NOW()
      WHERE company_id = $1 AND unit_name = $2`,
    Number(companyId), String(unitName), firmware ?? null,
  );
}

/** Record OTA progress for a unit (states: downloading|verifying|applying|success|failed). */
async function setOtaState(companyId, unitName, { state, version = null, detail = null, cmdId = null }) {
  await prisma.$executeRawUnsafe(
    `UPDATE public.mqtt_devices
        SET ota_state      = $3,
            ota_version    = COALESCE($4, ota_version),
            ota_detail     = $5,
            ota_cmd_id     = COALESCE($6::uuid, ota_cmd_id),
            ota_updated_at = NOW(),
            updated_at     = NOW()
      WHERE company_id = $1 AND unit_name = $2`,
    Number(companyId), String(unitName), state, version, detail, cmdId,
  );
}

/** OTA rollout status across a company — what the admin fleet view reads. */
async function otaStatus(companyId) {
  return prisma.$queryRawUnsafe(
    `SELECT unit_name AS "unitName", firmware, ota_state AS "otaState",
            ota_version AS "otaVersion", ota_detail AS "otaDetail",
            ota_updated_at AS "otaUpdatedAt", last_seen_at AS "lastSeenAt", disabled
       FROM public.mqtt_devices
      WHERE company_id = $1 AND is_superuser = FALSE
      ORDER BY unit_name`,
    Number(companyId),
  );
}

module.exports = {
  hashPassword, verifyPassword, usernameFor,
  provisionUnit, revokeUnit, listUnits, lookupUnit, touchUnit,
  setOtaState, otaStatus,
};
