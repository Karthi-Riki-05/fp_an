'use strict';

/**
 * IoT firmware release metadata.
 *
 * A release is one atomic JSON row in public.site_settings
 * (type='iot_firmware', var_key='latest'), because a half-written release —
 * new version paired with the previous hash — would fail integrity checks on
 * every unit in the fleet at once.
 *
 * The binary itself is NOT served over MQTT. The device receives a URL plus a
 * SHA-256 and fetches the ZIP over HTTPS; chunking multi-MB payloads through
 * the broker would abuse it and is capped by message_size_limit anyway.
 *
 * Falls back to the IOT_* environment variables when no release row is set, so
 * existing HTTP firmware checks keep working during the dual-run phase.
 */

const { prisma } = require('../prisma/client');

const TYPE = 'iot_firmware';
const KEY = 'latest';
const SHA256_RE = /^[0-9a-f]{64}$/i;
const VERSION_RE = /^\d+(\.\d+){0,3}$/;

/** Per-component comparison — "1.2.10" is newer than "1.2.9". */
function semverGt(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/** The current release, or null when none is configured. */
async function getRelease() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT var_value AS "value" FROM public.site_settings
      WHERE type = $1 AND var_key = $2 AND status = TRUE LIMIT 1`,
    TYPE, KEY,
  );

  if (rows[0]?.value) {
    try {
      const parsed = JSON.parse(rows[0].value);
      if (parsed?.version) return parsed;
    } catch {
      console.warn('[firmware] site_settings iot_firmware.latest is not valid JSON — falling back to env');
    }
  }

  // Dual-run fallback. No sha256 here, so OTA over MQTT stays disabled until a
  // real release is published — see assertOtaReady().
  const envVersion = process.env.IOT_LATEST_VERSION;
  if (!envVersion) return null;
  return {
    version: envVersion,
    url: process.env.IOT_FIRMWARE_URL || null,
    sha256: null,
    size: null,
    notes: process.env.IOT_FIRMWARE_INFO || '',
    mandatory: false,
    source: 'env',
  };
}

/**
 * Publish a release. sha256 is required: without it a device cannot tell a
 * genuine package from one served by whoever controls the URL, and the install
 * path runs as root.
 */
async function setRelease(dto, actor = null) {
  const version = String(dto.version ?? '').trim();
  const url = String(dto.url ?? '').trim();
  const sha256 = String(dto.sha256 ?? '').trim().toLowerCase();
  const size = dto.size == null ? null : Number(dto.size);

  if (!VERSION_RE.test(version)) {
    throw Object.assign(new Error('version must look like 2.1.8'), { statusCode: 400 });
  }
  if (!/^https:\/\//i.test(url)) {
    throw Object.assign(new Error('url must be https:// — firmware must not be fetched over plaintext'), { statusCode: 400 });
  }
  if (!SHA256_RE.test(sha256)) {
    throw Object.assign(new Error('sha256 must be 64 hex characters — releases without an integrity hash are refused'), { statusCode: 400 });
  }
  if (size != null && (!Number.isFinite(size) || size <= 0)) {
    throw Object.assign(new Error('size must be a positive byte count'), { statusCode: 400 });
  }

  const release = {
    version,
    url,
    sha256,
    size,
    notes: String(dto.notes ?? ''),
    mandatory: dto.mandatory === true,
    releasedAt: new Date().toISOString(),
    releasedBy: actor?.email ?? null,
    source: 'db',
  };

  await prisma.$executeRawUnsafe(
    `INSERT INTO public.site_settings (type, var_key, var_value, status, created_at, updated_at)
     VALUES ($1, $2, $3, TRUE, NOW(), NOW())
     ON CONFLICT (type, var_key) DO UPDATE
       SET var_value = EXCLUDED.var_value, status = TRUE, updated_at = NOW()`,
    TYPE, KEY, JSON.stringify(release),
  );

  return release;
}

/**
 * Answer a device's version query.
 * Returns { updateAvailable, version, url, sha256, size, notes, mandatory }.
 */
async function checkUpdate(currentVersion) {
  const release = await getRelease();
  const current = String(currentVersion ?? '').trim();

  if (!release) return { updateAvailable: false, reason: 'no-release-configured' };
  if (!current) return { updateAvailable: false, reason: 'unknown-current-version' };
  if (!semverGt(release.version, current)) {
    return { updateAvailable: false, version: release.version, reason: 'up-to-date' };
  }

  return {
    updateAvailable: true,
    version: release.version,
    url: release.url,
    sha256: release.sha256,
    size: release.size,
    notes: release.notes,
    mandatory: release.mandatory === true,
  };
}

/** Throws unless the current release can be safely pushed over the air. */
async function assertOtaReady() {
  const release = await getRelease();
  if (!release) {
    throw Object.assign(new Error('no firmware release configured'), { statusCode: 409 });
  }
  if (!SHA256_RE.test(String(release.sha256 ?? ''))) {
    throw Object.assign(
      new Error('current release has no sha256 — publish a release via PUT /admin/iot/firmware before pushing OTA'),
      { statusCode: 409 },
    );
  }
  if (!/^https:\/\//i.test(String(release.url ?? ''))) {
    throw Object.assign(new Error('current release url must be https://'), { statusCode: 409 });
  }
  return release;
}

module.exports = { getRelease, setRelease, checkUpdate, assertOtaReady, semverGt };
