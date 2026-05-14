# Operator Questions — Phase 0 Unknowns

This file tracks the concrete unknowns the Phase 0 analysis surfaced that **only the operator** (the human running the legacy production system) can answer. Each question lists:

1. **What we need to know.**
2. **Why it matters** — which phase it blocks or shapes.
3. **Exactly what to run** — SQL query, file inspection, or third-party check.
4. **How to record the answer** — where to update in the new repo.

When you answer, update this file in-place: replace `__answer pending__` with the value, and either tick `[x]` the resolution checkbox or note the follow-up edit needed in `MIGRATION_NOTES.md`. Phase 4 (frontend) is hard-blocked until **Q2 (GoJS)** is resolved; the others shape later phases but don't block Phase 1/2/3.

---

## Q1. Is the Grafana read-only DB user still in active use?

**Why it matters:** Legacy `.env` defines `DB_READ_ONLY_USER=grafana` and `DB_READ_ONLY_PASS=…`. If a Grafana instance is currently dashboarding the master MySQL DB, the schema-per-tenant move to PostgreSQL **breaks every Grafana query** — they currently look like `SELECT … FROM tenantdb.production_data` and must be rewritten to `SELECT … FROM tenant_<id>.production_data`. We need to plan a parallel Grafana rebuild as part of Phase 6.

**Phase impact:** Phase 6 (data migration). Doesn't block Phase 1/2/3.

**Steps:**

1. Check whether the `grafana` MySQL user has connected recently:
   ```sql
   -- Run against the master DB (fpanalyzer_se_prodmaster on AWS RDS)
   SELECT USER, HOST, COMMAND, TIME, STATE
   FROM information_schema.processlist
   WHERE USER = 'grafana';
   ```
   Empty result during business hours = probably not active.

2. Check the audit log if available:
   ```sql
   -- AWS RDS general log if enabled, or:
   SELECT event_time, user_host
   FROM mysql.general_log
   WHERE user_host LIKE 'grafana%'
   ORDER BY event_time DESC
   LIMIT 50;
   ```

3. Ask whoever owns the company's monitoring stack: "Is there a Grafana dashboard pointed at the FP Analyzer master DB? If so, where does it live and who maintains it?"

**How to record:**
- If **YES, in use** → list the dashboard URLs and the queries; add a Phase 6 sub-task to rewrite each query for the schema-per-tenant model.
- If **NO** → drop `DB_READ_ONLY_USER` / `DB_READ_ONLY_PASS` from the new `.env.example`; remove the §13 reference to a Grafana parallel rebuild task.

- [ ] **Resolution:** __answer pending__

---

## Q2. GoJS license status — paid, eval, or unknown? (BLOCKS PHASE 4)

**Why it matters:** The legacy app ships `public/js/google.js`, an **822 KB** in-tree GoJS distribution. GoJS is commercial software. If it's the watermarked **eval build**, it is **NOT legal for production use** — and the npm install (`gojs` package) for v3 needs a valid license key at runtime to remove the watermark. If the company doesn't hold a license, we either need to buy one (Single Developer ~$1,395 USD as of 2024 pricing; multi-dev higher) or pick a different diagram library entirely (alternatives: `@xyflow/react` (formerly React Flow, MIT-licensed but very different API), `mxgraph` (Apache 2.0, less polished), or rolling our own SVG flow renderer).

**Phase impact:** **Phase 4 frontend is BLOCKED.** Cannot ship the Flow Monitor / Flow Analyzer / Flow Design Editor without a decision.

**Steps:**

1. Check whether the in-tree file is the eval build:
   ```bash
   head -c 2000 /Applications/XAMPP/xamppfiles/htdocs/fpanalyzer/public/js/google.js | grep -i "eval\|trial\|watermark\|license"
   ```
   Eval builds typically contain comments like `Trial expires…` or `licensed to Eval User`. Production builds reference the actual licensee.

2. Search company records for a GoJS purchase:
   - Accounting receipts since 2015 (when GoJS was first adopted, judging by `public/js/google.js` mtime).
   - Email archive for `support@nwoods.com` or `licensing@nwoods.com` (the GoJS vendor is Northwoods Software).

3. If a license exists, retrieve the **license key** — it's a JSON-shaped string starting `{"E":` typically, or a `Diagram.licenseKey = "…"` declaration somewhere in the legacy code.
   ```bash
   grep -rn "licenseKey\|nwoodsLicense\|\.E\":" /Applications/XAMPP/xamppfiles/htdocs/fpanalyzer/public/ /Applications/XAMPP/xamppfiles/htdocs/fpanalyzer/resources/ 2>/dev/null | head
   ```

**How to record:**
- If **PAID, key exists** → store the key in the secrets vault as `GOJS_LICENSE_KEY`; add it to `.env.example` (with placeholder); Phase 4 proceeds with `gojs` from npm.
- If **EVAL or UNCLEAR** → escalate to procurement for a license purchase decision, OR pick an alternative library and update §1 (`gojs` row in the stack mapping table) and §10 (public assets — the in-tree `google.js` decision).

- [x] **Resolution:** **RESOLVED 2026-05-14 — switched to draw.io (Apache 2.0).** No license purchase needed. The operator's other project (ValueChart) already had a complete draw.io editor (~178 MB vendored draw.io v29.3.6 webapp + 7 React integration components in `frontend/src/components/flows/`). That code is being adopted as the Flow Designer / Monitor / Analyzer canvas. Legacy `flow_designs.flow_data` rows (GoJS JSON) are not preserved — production tenants start with blank canvases. See `FLOW_MANAGEMENT_ANALYSIS.md` §11 for the replacement plan.

---

## Q3. Multi-language: which of the 10 locales are actually used in production?

**Why it matters:** v3 lazy-loads all 10 locales by default (next-intl) and eagerly bundles only `sv` + `en`. If only sv+en are real and the other 8 are scaffold artifacts that nobody set, we can drop them from disk entirely. If e.g. `de` and `fr` have real users, we keep them lazy-loaded but don't need to maintain them as first-class. Determines the maintenance burden going forward.

**Phase impact:** Shapes Phase 4 (frontend i18n). Doesn't block Phase 1/2/3.

**Steps:**

1. Find where per-user locale is stored. The `users` table in `legacy-schema.json` does NOT have a `locale` column, but the dump might be stale. Check the live master DB:
   ```sql
   SHOW COLUMNS FROM users WHERE Field LIKE '%locale%' OR Field LIKE '%lang%';
   ```

2. If a `locale` (or `lang` / `language`) column exists:
   ```sql
   SELECT locale, COUNT(*) AS user_count
   FROM users
   WHERE deleted_at IS NULL AND status = 1
   GROUP BY locale
   ORDER BY user_count DESC;
   ```

3. If there's no per-user column, locale is in session only (legacy `LocaleMiddleware` reads `session('locale')`) — operator must check **server logs** for `lang/{lang}` and `changeLanguage/{locale}` route hits over the last 12 months:
   ```bash
   # On the legacy production server:
   grep -hE "GET /(lang|changeLanguage)/" /var/log/apache2/access.log* \
     | sed -E 's|.*/(lang|changeLanguage)/([a-z-]+).*|\2|' \
     | sort | uniq -c | sort -rn
   ```

**How to record:** list the locales with real usage. Update `MIGRATION_NOTES.md` §13.31 with the actual list. Locales with zero usage stay in `frontend/messages/` for safety (cheap) but the admin UI's locale dropdown only shows the active ones.

- [ ] **Resolution:** __answer pending__

---

## Q4. IoT firmware: does the device's first-boot/factory-reset flow need an unauthenticated bootstrap path?

**Why it matters:** v3 default is to auth-gate `/api/v1/iot/software/latest/download` (requires a device-bound JWT). But devices that are factory-reset or being installed for the first time may not yet have credentials — so they need an unauthenticated way to download the firmware on first boot. If yes, we expose a **single** read-only `GET /firmware/<version>.zip` endpoint behind a long-random URL (or with a short-lived signed URL flow). If no, we keep everything auth-gated.

**Phase impact:** Phase 7 (verification — IoT smoke test path) and Phase 4/5 (frontend admin shows firmware-version-list, Docker config).

**Steps:**

1. Read the legacy IoT firmware README/source if it's available — typically inside `public/iot_version/software/1616048013_1675418443_fp_analyzer_v2.1.2.zip`. Unpack and inspect its boot script:
   ```bash
   mkdir -p /tmp/fpanalyzer-iot && cd /tmp/fpanalyzer-iot
   unzip /Applications/XAMPP/xamppfiles/htdocs/fpanalyzer/public/iot_version/software/1616048013_1675418443_fp_analyzer_v2.1.2.zip
   grep -rE "version_info|/iot_version/|/api/machine/login|/api/v1/machine/" .
   ```
   Look for: does the boot/update script call `/iot_version/version.web` and `/iot_version/software/...zip` *before* it has a logged-in `Machine` JWT? If yes → need unauthenticated bootstrap path.

2. Or ask whoever maintains the IoT firmware: "When a device powers on for the first time, before it has user credentials configured, does it need to download the firmware update from a public URL, or does the install flow always start with credential entry?"

**How to record:**
- If **YES, needs unauth bootstrap** → expose `GET /firmware/latest` and `GET /firmware/latest/download` without auth. Update §10 public assets and §2.7 IoT API decisions in `MIGRATION_NOTES.md`. Add rate-limiting per IP to the bootstrap routes.
- If **NO** → keep all firmware behind device JWT. No change to v3 design.

- [ ] **Resolution:** __answer pending__

---

## Q5. Bitbucket OAuth: is it actually used by anyone?

**Why it matters:** v3 default omits Bitbucket from the supported social providers (5 instead of 6). If even one production user has an active Bitbucket-linked login, removing the provider locks them out.

**Phase impact:** Phase 3 (auth module). Trivial to flip — un-comment 3 lines in `.env.example` + add one strategy registration in `auth.module.ts`.

**Steps:**

```sql
-- Run against the master DB (fpanalyzer_se_prodmaster on AWS RDS)
SELECT COUNT(*) AS bitbucket_users
FROM social_logins
WHERE provider = 'bitbucket';

-- Also check if any user has it as their primary login:
SELECT u.id, u.email, sl.created_at AS bitbucket_link_at
FROM social_logins sl
JOIN users u ON u.id = sl.user_id
WHERE sl.provider = 'bitbucket' AND u.deleted_at IS NULL;
```

**How to record:**
- `bitbucket_users = 0` → no change needed. Provisional v3 default (no Bitbucket) is correct.
- `bitbucket_users > 0` → restore Bitbucket provider config: uncomment `BITBUCKET_*` lines in `.env.example`, register the strategy in `auth.module.ts`, and add the login button back in the frontend. Update `MIGRATION_NOTES.md` §13.27.

- [ ] **Resolution:** __answer pending__

---

## Triage summary

| Question | Phase blocked | Severity | Default if unanswered |
|---|---|---|---|
| Q1 Grafana | Phase 6 only | Medium — affects external monitoring | Assume YES; plan rebuild task; revisit before Phase 6 starts |
| **Q2 GoJS** | **Phase 4 (frontend)** | **HIGH — legal exposure if eval build is in production** | **BLOCKS Phase 4** — must resolve before any flow-diagram code is written |
| Q3 Locales | Phase 4 cosmetic | Low — affects bundle size and locale-dropdown UX | Bundle sv+en, lazy-load all 10; revisit during Phase 4 |
| Q4 IoT bootstrap | Phase 7 | Medium — affects firmware update flow | Default to auth-gated; revisit during Phase 7 IoT smoke test |
| Q5 Bitbucket | Phase 3 | Low — easy flip | Default to 5 providers (no Bitbucket); revisit during Phase 3 auth module |

**Phase 1 (skeleton) and Phase 2 (Prisma schema) start immediately.** Operator can answer these in parallel.
