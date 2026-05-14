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
const multer = require('multer');

/**
 * In docker dev, the backend container does NOT mount the frontend/ tree —
 * so we let docker-compose bind ./frontend/public/equipment-icons to a known
 * path inside the container (default /icons). The fallback resolves to
 * ../../frontend/public/equipment-icons relative to the source file, which
 * works for local-no-docker runs.
 */
const ICONS_DIR = process.env.ICONS_DIR
  ? path.resolve(process.env.ICONS_DIR)
  : path.resolve(__dirname, '..', '..', '..', 'frontend', 'public', 'equipment-icons');
const PUBLIC_PREFIX = '/equipment-icons';
const ALLOWED = /\.(png|jpe?g|svg|gif|webp)$/i;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

let CACHE = null;
function invalidateCache() { CACHE = null; }

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

/**
 * Upload an icon. Stored under equipment-icons/ with a sanitized,
 * collision-safe filename. Returns { filename } so the caller can write it
 * straight into a Type/Equipment record.
 */
router.post('/upload', upload.single('icon'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ statusCode: 400, message: 'no-file' });
    if (!ALLOWED.test(req.file.originalname)) {
      return res.status(400).json({ statusCode: 400, message: 'unsupported-image-type' });
    }
    const ext = path.extname(req.file.originalname).toLowerCase();
    const base = path.basename(req.file.originalname, ext).replace(/[^a-z0-9_-]+/gi, '_').slice(0, 64) || 'icon';
    let filename = `${base}${ext}`;
    let counter = 0;
    while (fs.existsSync(path.join(ICONS_DIR, filename))) {
      counter += 1;
      filename = `${base}_${counter}${ext}`;
    }
    if (!fs.existsSync(ICONS_DIR)) fs.mkdirSync(ICONS_DIR, { recursive: true });
    fs.writeFileSync(path.join(ICONS_DIR, filename), req.file.buffer);
    invalidateCache();
    res.status(201).json({ filename, url: `${PUBLIC_PREFIX}/${filename}` });
  } catch (err) { next(err); }
});

module.exports = router;
