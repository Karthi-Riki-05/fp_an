'use strict';

/**
 * One-time-password issuance + verification, backed by Redis with TTL
 * auto-expiry. Used by the mobile password-reset and demo-signup flows.
 *
 * Key shape:  `otp:<purpose>:<email>` → 6-digit string code
 * TTL:        10 minutes (Redis EXPIRE)
 * Rate limit: 1 OTP per 60 seconds per (purpose, email) — counter key
 *             `otp:rate:<purpose>:<email>` with a 60-second TTL.
 */

const { redis } = require('../redis/client');
const { randomInt } = require('node:crypto');

const TTL_SECONDS = 600;         // 10 minutes
const RATE_WINDOW_SECONDS = 60;  // 1 OTP per minute

function key(purpose, email) {
  return `otp:${purpose}:${email.toLowerCase()}`;
}
function rateKey(purpose, email) {
  return `otp:rate:${purpose}:${email.toLowerCase()}`;
}

function generateCode() {
  // 6-digit, zero-padded. randomInt is cryptographically strong.
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Issue an OTP. Throws { statusCode: 429, message } if the caller hits
 * the per-email rate limit within the window. Returns the code.
 */
async function issueOtp(purpose, email) {
  const rk = rateKey(purpose, email);
  const recent = await redis.get(rk);
  if (recent) {
    const ttl = await redis.ttl(rk);
    const err = new Error(`Please wait ${ttl}s before requesting another code.`);
    err.statusCode = 429;
    throw err;
  }
  const code = generateCode();
  await redis.set(key(purpose, email), code, 'EX', TTL_SECONDS);
  await redis.set(rk, '1', 'EX', RATE_WINDOW_SECONDS);
  return code;
}

/**
 * Verify and consume an OTP. Returns true on match. Deletes the code on
 * success so it can't be replayed.
 */
async function verifyOtp(purpose, email, code) {
  if (!code || !/^\d{6}$/.test(code)) return false;
  const stored = await redis.get(key(purpose, email));
  if (!stored || stored !== code) return false;
  await redis.del(key(purpose, email));
  return true;
}

module.exports = { issueOtp, verifyOtp };
