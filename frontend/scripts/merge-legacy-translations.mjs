/**
 * Merge the legacy fpanalyzer translation bundle
 * (`public/language.json`) into the next-intl message files
 * (`messages/en.json`, `messages/sv.json`).
 *
 * Legacy file shape:
 *   { "custom.texts.dashboard": { "en": "Dashboard", "sv": "Dashboard", ... }, ... }
 *
 * next-intl shape (nested):
 *   { "custom": { "texts": { "dashboard": "Dashboard" } } }
 *
 * Behaviour:
 *   - Only `en` and `sv` are extracted; all other languages are skipped.
 *   - Dotted legacy keys become nested objects.
 *   - Existing values in messages/{en,sv}.json WIN over legacy values
 *     (we don't want to clobber translations that were hand-tuned in
 *     the new project). This is why we deep-merge with the existing
 *     file as the override.
 *   - Run with:
 *       node scripts/merge-legacy-translations.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(__dirname, '..');
const LEGACY_FILE = path.join(FRONTEND_ROOT, 'public', 'language.json');
const TARGET_DIR = path.join(FRONTEND_ROOT, 'messages');

const LOCALES = ['en', 'sv'];

/** Set `value` at the dotted path `dottedKey` inside `obj` (creates parents). */
function setDeep(obj, dottedKey, value) {
  const parts = dottedKey.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const seg = parts[i];
    if (typeof cur[seg] !== 'object' || cur[seg] === null || Array.isArray(cur[seg])) {
      cur[seg] = {};
    }
    cur = cur[seg];
  }
  cur[parts[parts.length - 1]] = value;
}

/** Deep-merge `override` ON TOP OF `base` and return a new object. */
function deepMerge(base, override) {
  if (base === null || typeof base !== 'object' || Array.isArray(base)) return override;
  if (override === null || typeof override !== 'object' || Array.isArray(override)) return override;
  const out = { ...base };
  for (const k of Object.keys(override)) {
    if (k in out) {
      out[k] = deepMerge(out[k], override[k]);
    } else {
      out[k] = override[k];
    }
  }
  return out;
}

function buildLocaleTree(legacy, locale) {
  const tree = {};
  let placedCount = 0;
  let skippedCount = 0;
  for (const [key, langs] of Object.entries(legacy)) {
    if (typeof langs !== 'object' || langs === null) continue;
    const val = langs[locale];
    if (typeof val !== 'string' || val.length === 0) {
      skippedCount++;
      continue;
    }
    // next-intl rejects keys ending with '.' or with empty segments. Skip
    // anything malformed in the legacy bundle rather than blow up at load.
    if (key.includes('..') || key.startsWith('.') || key.endsWith('.')) {
      skippedCount++;
      continue;
    }
    setDeep(tree, key, val);
    placedCount++;
  }
  return { tree, placedCount, skippedCount };
}

function loadJson(file) {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

const legacy = JSON.parse(fs.readFileSync(LEGACY_FILE, 'utf8'));
const legacyKeyCount = Object.keys(legacy).length;
console.log(`legacy keys: ${legacyKeyCount}`);

for (const locale of LOCALES) {
  const targetFile = path.join(TARGET_DIR, `${locale}.json`);
  const existing = loadJson(targetFile);
  const { tree: legacyTree, placedCount, skippedCount } = buildLocaleTree(legacy, locale);
  // Existing project translations WIN — pass `existing` as override.
  const merged = deepMerge(legacyTree, existing);
  writeJson(targetFile, merged);
  console.log(`  ${locale}: placed=${placedCount} skipped=${skippedCount} → ${path.relative(FRONTEND_ROOT, targetFile)}`);
}
