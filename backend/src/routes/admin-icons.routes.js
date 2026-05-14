'use strict';

/**
 * Equipment / Type icon library listing.
 *
 * Reads icon files from frontend/public/equipment-icons/ (mirrored from
 * legacy fpanalyzer/public/build/img/icons/ by Phase 4a asset migration).
 *
 * The directory is read once per process and the listing is cached, so
 * adding files at runtime requires a backend restart — fine because the
 * icon set is shipped as static assets.
 */

const { Router } = require('express');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'frontend',
  'public',
  'equipment-icons',
);
const PUBLIC_PREFIX = '/equipment-icons';
const ALLOWED = /\.(png|jpe?g|svg|gif|webp)$/i;

let CACHE = null;

function loadOnce() {
  if (CACHE) return CACHE;
  let entries = [];
  try {
    entries = fs.readdirSync(ICONS_DIR, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return (CACHE = []);
    throw err;
  }
  const icons = entries
    .filter((e) => e.isFile() && ALLOWED.test(e.name))
    .map((e) => {
      const filename = e.name;
      const name = filename.replace(/\.[^.]+$/, '');
      return { name, filename, url: `${PUBLIC_PREFIX}/${filename}` };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  CACHE = icons;
  return CACHE;
}

const router = Router();

router.get('/', (req, res, next) => {
  try {
    const icons = loadOnce();
    const q = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const filtered = q ? icons.filter((i) => i.name.toLowerCase().includes(q)) : icons;
    res.json({ icons: filtered, total: filtered.length });
  } catch (err) { next(err); }
});

module.exports = router;
