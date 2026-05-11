'use strict';

const bcrypt = require('bcryptjs');
const { scrypt: _scrypt } = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(_scrypt);
const BCRYPT_ROUNDS = 12;

async function hash(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function verify(plain, stored) {
  if (!stored) return { ok: false, needsRehash: false };

  if (stored.startsWith('scrypt$')) {
    const ok = await verifyScrypt(plain, stored);
    return { ok, needsRehash: ok };
  }

  if (stored.startsWith('$2')) {
    const ok = await bcrypt.compare(plain, stored);
    return { ok, needsRehash: false };
  }

  return { ok: false, needsRehash: false };
}

async function verifyScrypt(plain, stored) {
  const [, salt, hex] = stored.split('$');
  if (!salt || !hex) return false;
  const derived = await scrypt(plain, salt, 64);
  return derived.toString('hex') === hex;
}

module.exports = { hash, verify };
