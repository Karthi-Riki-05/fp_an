'use strict';

const { createHash, randomBytes } = require('crypto');
const { promises: fs } = require('fs');
const path = require('path');

const SAFE_PREFIX = /^[a-z0-9][a-z0-9_\-/]{0,127}$/;

const driver = process.env.STORAGE_DRIVER || 'local';
const localDir = path.resolve(process.env.STORAGE_LOCAL_DIR || 'storage/uploads');
const publicBase = (process.env.STORAGE_PUBLIC_BASE || '/uploads').replace(/\/$/, '');

async function put(prefix, originalName, body, contentType) {
  if (!SAFE_PREFIX.test(prefix)) throw new Error(`Unsafe prefix: "${prefix}"`);
  const sha256 = createHash('sha256').update(body).digest('hex');
  const ext = sanitiseExt(originalName);
  const filename = `${sha256}${ext}`;
  const key = `${prefix.replace(/\/$/, '')}/${filename}`;

  if (driver === 'local') {
    const target = path.join(localDir, key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body);
    const url = `${publicBase}/${key}`;
    return { url, key, sha256, size: body.length, contentType };
  }

  throw new Error('STORAGE_DRIVER=s3 not implemented');
}

async function del(key) {
  if (!key) return;
  if (driver === 'local') {
    const target = path.join(localDir, key);
    try {
      await fs.unlink(target);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    return;
  }
  throw new Error('STORAGE_DRIVER=s3 not implemented');
}

function sanitiseExt(originalName) {
  const m = originalName.match(/\.([a-z0-9]{1,6})$/i);
  return m ? `.${m[1].toLowerCase()}` : '';
}

module.exports = { put, del };
