# Sprint Plan (2026-06-03)

Status legend: ✅ done · ⚠️ done with caveat · ⛔ blocked

## Sprint 1 — 3-Fix Batch

| # | Fix | Priority | Status |
|---|-----|----------|--------|
| 1 | OEE formula + dashboard wiring | P0 | ✅ done |
| 2 | Mobile bottom-nav app shell | P0 | ✅ done |
| 3 | PWA manifest + icons + next-pwa | P1 | ✅ done |

## Sprint 2 — 4 Tasks

| # | Task | Status |
|---|------|--------|
| 1 | /alerts route + warning API (S1 blocker #1) | ✅ done |
| 2 | Andon Board S15 (public TV display) | ✅ done |
| 3 | OEE planned-time recurrence fix (S1 blocker #2) | ✅ done |
| 4 | Dashboard line chart real data (S1 blocker #4) | ✅ done |

## Sprint 3 — 6 Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Andon board token system (S2 blocker #1) | ✅ done |
| 2 | warning_data acknowledge state (S2 blocker #3) | ✅ done |
| 3 | Admin nav IA → 6 groups + Advanced | ✅ done |
| 4 | Loss Model page (remove ComingSoon) | ✅ done |
| 5 | User Orders page (remove ComingSoon) | ✅ done |
| 6 | cycle_time typed column (S1 blocker #3) | ✅ done |

Build: `next build` → **✓ Compiled successfully** (`/admin/loss-model`, `/orders`, updated
`/admin/monitor/[[...id]]` present). `prisma validate` → schema valid. All backend files pass
`node --check` and require-load OK. **DB migrations are written but NOT applied** (no DB in this
environment) — see Sprint 3 detail.

## Sprint 4 — Final polish + deploy prep

| # | Task | Status |
|---|------|--------|
| 1 | Run the 3 (now 4) pending migrations | ⛔ blocked — no DB access (see below) |
| 2 | Company Setup page (S3 blocker #2) | ✅ done |
| 3 | Public Andon Socket.io namespace (S2 blocker #2) | ✅ done |
| 4 | rc_data format verification (S2 blocker #4) | ⚠️ heuristic hardened; verify query provided (no DB) |
| 5 | Roles page read-only for Company (S3 blocker #3) | ✅ done |
| 6 | Final QA + deploy prep (.env.example, health, build) | ✅ done |

Build: `next build` → **✓ Compiled successfully**; `prisma validate` → valid; all backend
files pass `node --check` + require-load. Health endpoint already returns
`{ status, uptime_s, version, checks:{ db, redis } }`.

## Sprint 5 — Functional operator forms + role-screen polish ✅

Environment is now LIVE (Docker: postgres/redis/backend/frontend healthy; the 4 pending
migrations from Sprints 1–4 are **applied** to all tenant schemas).

| # | Task | Status |
|---|------|--------|
| 1 | Stop Logger — full functional submit (`POST /user/saveStopData`) | ✅ done |
| 2 | Production Logger — full functional submit (`POST /user/saveProductionData`) | ✅ done |
| 3 | Fix 3 pre-existing TypeScript errors → `tsc --noEmit` = 0 | ✅ done |
| 4 | Scrap Logger — mobile polish + functional submit (`POST /user/saveScrapData`) | ✅ done |
| 5 | Profile page — settings rows (language/push/timezone/password/sign-out) | ✅ done |
| 6 | Admin dashboard machine grid wired to live data (`useAdminMachines`, 10s poll) | ✅ done |

Verification: `tsc --noEmit` → **0 errors** (was 3). All 6 screens compile + return 200. The
three save endpoints were exercised live and returned `{success:true,data:{id}}`
(production id 13, stop id 10, scrap id 6 in `tenant_2`). New hook lib:
`frontend/src/lib/api/operator-logging.ts`. See Sprint 5 detail below.

---

## ✅ FIX 1 — OEE Formula (P0)

**Backend**
- `backend/src/services/admin-chart-data.service.js` — added `getOeeMetrics(tenant, from, to)`.
- `backend/src/routes/admin-dashboard.routes.js` — **new** route `GET /api/v1/admin/dashboard/oee?from=&to=`.
- `backend/src/app.js` — mounted `adminDashboardRoutes` at `/api/v1/admin/dashboard`.

**Frontend**
- `frontend/src/lib/api/oee.ts` — **new** `useOee()` React Query hook + `OeeMetrics` type.
- `frontend/src/app/(admin)/admin/dashboard/page.tsx` — replaced mock `KPIS` / `ANALYTICS`
  with live OEE: four KPI cards (OEE / Availability / Performance / Quality) + the analyzer
  panel's Production / Scrap / Stop statistics now read from `oee.inputs`.

**Formula returned** (all `0–100`, one decimal, each component clamped to `[0,1]`):
```
availability = (plannedMinutes − downtimeMinutes) / plannedMinutes
performance  = (actualQty × idealCycleMinutes) / (plannedMinutes − downtimeMinutes)
quality      = (actualQty − scrapQty) / actualQty
oee          = availability × performance × quality × 100
```

**⚠️ Schema reality vs. the task spec** — the live Prisma schema does **not** have the
columns named in the brief, so these mappings were made (and documented in the service):

| Spec assumption | Actual implementation |
|---|---|
| `shift_schedules` has planned time | No such column. Planned minutes summed from `shift_schedule_data` event windows (`start`→`end`) overlapping the range. **Recurring events (`is_recurring`/`rc_data`) are NOT expanded** — only their stored window counts. |
| `stop_data.exclude_type = "Exclude from OEE"` | Exclusion is `types.exclude_type` (boolean) joined via `stop_data.stop_type_id`. |
| downtime in minutes | `stop_data.sum_of_time` is in **seconds** → `/60`. |
| `production_data.idealCycleTime` column | No such column. Ideal cycle time = average of numeric-parseable `equipment_properties.cycle_time` (VARCHAR, seconds/part) → minutes/part. |
| `production_data.actualQty` / `plannedQty` | `part_qty` / `planned_qty`. |
| `scrap_data.scrapQty` | `scrap_data.quantity`. |

The response includes an `inputs` block (raw minutes/qtys) and a `computable` block flagging
which factors had sufficient data, so the UI can show an honest empty state.

---

## ✅ FIX 2 — Mobile Bottom Nav (P0)

- `frontend/src/components/layout/UserShell.tsx` — fully rewritten.
  - **AppHeader**: 32px gradient logo mark (`#00768D → #01b9d0`, radius 8), route-driven
    title+subtitle, bell with red unread badge, initials avatar (brand gradient), white bg +
    `1px #f0f0f0` bottom border.
  - **Content**: `flex:1`, `overflow-y:auto`, momentum scroll.
  - **BottomNav**: white, `1px #f0f0f0` top border, `0 -2px 12px rgba(0,0,0,.06)` shadow,
    `56px + env(safe-area-inset-bottom)`, 4 tabs (Dashboard / Monitor / Alerts / Profile),
    active = 2.5px top indicator (`border-radius 0 0 3px 3px`) + `#01b9d0`, inactive `#bfbfbf`,
    labels Poppins 9px/700 uppercase `0.5px` tracking.
  - Retained `ImpersonationBanner` + `MachineSocketProvider` from the previous shell.

---

## ✅ FIX 3 — PWA Manifest + Icons (P1)

- `frontend/public/manifest.webmanifest` — replaced with FP Analyzer manifest
  (`start_url:/dashboard`, theme `#01b9d0`, bg `#ecf0f5`, 192/512 maskable icons, 2 shortcuts).
- `frontend/public/icons/icon-192.png`, `icon-512.png` — generated from
  `icons/icon.svg` (cyan `#01b9d0` field, centered white 2×2 grid) via ImageMagick.
- `next-pwa@5.6.0` installed (Next 14.2.35).
- `frontend/next.config.mjs` — wrapped with `withPWA`. The config is **ESM** (`.mjs`), so the
  task's CommonJS `require(...)`/`module.exports` snippet was adapted to
  `import withPWAInit from 'next-pwa'` and `export default withPWA(withNextIntl(nextConfig))`.
  SW disabled in development.
- `frontend/.gitignore` — ignores generated `sw.js` / `workbox-*.js` / `worker-*.js` artifacts.

---

# Sprint 2 — detail

## ✅ TASK 1 — /alerts route + warning API (resolves S1 blocker #1)

**Backend**
- `backend/src/services/alerts.service.js` — **new** `getAlerts(tenant, {windowDays, limit})`.
- `backend/src/routes/mobile-user.routes.js` — **new** `GET /api/v1/user/alerts` (JWT, tenant-scoped).
  > ⚠️ Path is `/api/v1/user/alerts`, **not** the brief's `/api/v1/mobile/alerts` — there is no
  > `/api/v1/mobile` mount; this router lives at `/api/v1/user`.

**Frontend**
- `frontend/src/lib/api/alerts.ts` — **new** `useAlerts()` hook (polls every 30s).
- `frontend/src/app/(user)/alerts/page.tsx` — **new** mobile-first alert list, left-border by
  severity (critical `#dd4b39` / warning `#f39c12` / info `#01b9d0`), LOG/ACK/VIEW actions,
  whole-card tap → `/units` (stops) or `/myresult` (warnings).
- `frontend/src/components/layout/UserShell.tsx` — bell badge now reads `useAlerts().unread`
  (replaced the hard-coded `0`).

**⚠️ Schema reality vs. brief:**
| Brief | Actual |
|---|---|
| `stop_data WHERE stop_type_id IS NULL` | `stop_type_id` is `Int @default(0)` (non-null) → filter is `stop_type_id = 0 AND reason = 0`. |
| `warning_data WHERE deleted_at IS NULL AND acknowledged_at IS NULL` | **Neither column exists.** Warnings filtered by `created_at >= CURRENT_DATE - windowDays`; no acknowledge state exists. |
| `severity` column | No such column — severity is derived (`stop`→critical, `warning`→warning). |
| INFO type | No backing table — INFO is a frontend-only concept (count 0). |

## ✅ TASK 2 — Andon Board (public TV display)

- `frontend/src/app/(public)/andon/[flowId]/page.tsx` — **new** fullscreen dark board
  (`#111827`), top bar (logo / flow name / live clock / OEE badge), 4 stat boxes,
  responsive machine grid (running/stopped/warning nodes, **stopped pulses**), bottom marquee
  ticker of unlogged stops. Refreshes every **5s via HTTP polling**.
- `backend/src/services/andon.service.js` — **new** `getAndon(tenant, flowId)`.
- `backend/src/routes/andon.routes.js` — **new** `GET /api/v1/andon/:flowId?company=<email>`,
  **public (no JWT)**, mounted before `authMiddleware`.
- `backend/src/middleware/iot-auth.js` — exported `loadCompanyUserByEmail` +
  `buildTenantForCompanyUser` for the public route to resolve the tenant.

**⚠️ Necessary deviations (architecture):**
1. **Tenant key required.** `flow_id` is only unique *within* a tenant schema and there's no
   JWT, so the board URL **must** carry `?company=<company-email>` to pick the schema. Without
   it the endpoint 400s and the board shows a usage hint.
2. **Polling, not Socket.io.** Server-side Socket.io auth is JWT-only; a public board cannot
   subscribe, so it polls every 5s instead of consuming `machine:status` events.
3. **No machine `warning` state.** `MachineRunningStatus` enum is only `on`/`off`. WARNING is
   synthesised from `unit_connected='no'` or a missing `machines` row.
4. **Per-node OEE is an availability proxy** (`1 − lostMinutesToday / minutesSinceMidnight`);
   the headline OEE is tenant-wide `getOeeMetrics()` for today (not yet flow-scoped).
- Route path is `/api/v1/andon/:flowId` (not `/api/v1/admin/andon` — `/admin/*` is JWT-gated).

## ✅ TASK 3 — OEE recurrence fix (resolves S1 blocker #2)

- `backend/src/services/admin-chart-data.service.js → getOeeMetrics()` — planned-time query
  rewritten with a `non_recurring` + `recurring` CTE. Recurring `shift_schedule_data` events
  are expanded with `generate_series` (series anchored on the event's own start date to preserve
  weekday/day-of-month), counting only occurrences within `[from,to]`.
  > ⚠️ `rc_data` is a free-text **String** (legacy format unknown). Frequency is inferred by
  > heuristic: `ILIKE '%week%'` → weekly, `ILIKE '%month%'` → monthly, else daily. If real
  > `rc_data` uses a different encoding, the inference may need adjustment once sample data is seen.

## ✅ TASK 4 — Dashboard line chart real data (resolves S1 blocker #4)

- `backend/src/services/admin-chart-data.service.js` — **new** `getDashboardChart(tenant,
  from, to, flowId)` using `generate_series` for a gap-free date axis; returns
  `{ dates, production, scrap, stops }`. `flowId` optional (omit → all flows).
- `backend/src/routes/admin-dashboard.routes.js` — **new** `GET /api/v1/admin/dashboard/chart`.
- `frontend/src/lib/api/dashboard-chart.ts` — **new** `useDashboardChart()` + `toChartPoints()`.
- `frontend/src/app/(admin)/admin/dashboard/page.tsx` — removed `mockSeries`; the `@ant-design/plots`
  Line now renders real data, with a `Skeleton` while `chartLoading`.

---

## Sprint 1 blockers — resolution status

1. ~~**Alerts route missing.**~~ ✅ Resolved in Sprint 2 / Task 1 (`/alerts` page + `/user/alerts` API + live badge).
2. ~~**OEE planned-time recurrence.**~~ ✅ Resolved in Sprint 2 / Task 3 (recurrence expansion).
3. **Ideal cycle time** is a tenant-wide average of a free-text VARCHAR. If any tenant stores
   cycle time in a non-second unit or non-numeric string, `performance` will be off. Consider a
   typed `cycle_time` column. *(Still open.)*
4. ~~**Line chart still mock.**~~ ✅ Resolved in Sprint 2 / Task 4 (`/admin/dashboard/chart`).
5. ~~**Full `next build` not run.**~~ ✅ Run in Sprint 2 → **✓ Compiled successfully**; SW emitted.

## New blockers / follow-ups found in Sprint 2

1. **Andon needs a tenant key in the URL** (`?company=<email>`). A cleaner long-term fix is a
   short-lived signed "board token" or a public flow→tenant registry so TVs don't embed an email.
2. **Public real-time.** Andon polls every 5s because Socket.io is JWT-only. A public read-only
   socket namespace (token-scoped to one flow) would cut latency and DB load.
3. **Per-machine OEE on the Andon board is an availability proxy**, not true OEE (needs
   per-equipment planned/qty/cycle). Headline OEE is tenant-wide, not flow-scoped.
4. **`rc_data` format is unverified.** Recurrence frequency is inferred by `ILIKE` heuristic;
   confirm against real shift-schedule rows and switch to explicit parsing if the encoding differs.
5. **Warnings have no acknowledge/soft-delete state.** Once `warning_data` gets `acknowledged_at`
   (+ `deleted_at`), wire the ACK button to a real mutation and filter acknowledged ones out.
6. **Andon `machine:status` socket events unused.** If a public socket lands, swap polling for the
   existing `machine:status:changed` / `machine:stop:*` events.

## Verification performed
- **Sprint 1:** `node --check` on OEE service/route/`app.js`; `import('./next.config.mjs')` resolves; icons confirmed PNG.
- **Sprint 2:** `node --check` on all 8 modified/new backend files → OK; full `next build` →
  **✓ Compiled successfully** with `/alerts` + `/andon/[flowId]` in the route table and `public/sw.js`
  regenerated (508 KB). Dashboard grep-clean of `mockSeries`.

---

# Sprint 3 — detail

> ⚠️ **Migrations not applied.** This environment has no DB/`psql` connectivity, so the three
> migration SQL files were authored but **not run**, and `prisma generate`/`db push` were not
> executed. All new endpoints are code-complete and fall back gracefully where a new column
> may be missing, but require the migrations + a client regen to be fully live. The cycle_time
> "inspect current data" step (Task 6 step 1) could not be run for the same reason — the
> migration is written defensively to compensate.

## ✅ TASK 1 — Andon board token (resolves S2 blocker #1)

**Backend**
- `prisma/schema.prisma` — new `AndonToken` model in the **public** schema (it resolves the
  tenant, so it cannot be tenant-scoped).
- `prisma/migrations/20260603000001_add_andon_tokens/migration.sql` — creates `public.andon_tokens`.
- `src/services/andon-tokens.service.js` — create / list / revoke / `resolveToken` (raw SQL on the
  global client, so no client regen needed).
- `src/routes/admin-andon-tokens.routes.js` — `POST/GET/DELETE /api/v1/admin/andon-tokens`
  (JWT). POST returns `{ token, url }` (`PUBLIC_APP_URL` env, default `app.fpanalyzer.se`).
- `src/routes/andon.routes.js` — now accepts `?token=` (preferred) → resolves tenant + validates
  the token's flow matches the path; `?company=` kept as a back-compat fallback.

**Frontend**
- `src/components/admin/AndonTvLinkButton.tsx` — modal with QR (`qrcode.react@4.2.0`), copyable URL,
  Generate + Revoke.
- `src/app/(admin)/admin/monitor/[[...id]]/page.tsx` — the re-export became a thin wrapper that
  renders the shared monitor page **plus** the admin-only TV-link button (shared page untouched).
- `src/app/(public)/andon/[flowId]/page.tsx` — reads `?token=` (falls back to `?company=`).

## ✅ TASK 2 — warning_data acknowledge state (resolves S2 blocker #3)

- `prisma/migrations/20260603000002_add_warning_ack/migration.sql` — adds `acknowledged_at` +
  `acknowledged_by` to `warning_data` across `tenant_template` **and every cloned `tenant_*`
  schema** (DO-block loop — the table is cloned per tenant).
- `prisma/schema.prisma` — `acknowledgedAt` / `acknowledgedBy` on `WarningData`.
- `src/services/alerts.service.js` — `getAlerts()` filters `acknowledged_at IS NULL` (with a
  try/catch fallback to the unfiltered query if the migration isn't applied yet); new
  `acknowledgeWarning(tenant, id, userId)`.
- `src/routes/mobile-user.routes.js` — `PATCH /api/v1/user/alerts/warnings/:id/acknowledge`.
- `src/lib/api/alerts.ts` — `useAcknowledgeWarning()` (optimistic cache removal + badge update).
- `src/app/(user)/alerts/page.tsx` — ACK button calls the mutation, shows a "Warning acknowledged"
  toast, and the row disappears.

## ✅ TASK 3 — Admin nav IA → 6 groups + Advanced

- `src/components/layout/AdminShell.tsx` — `COMPANY_SIDEBAR` restructured into exactly 6 groups
  (Overview / Production / Results / Factory / People / Settings) + a collapsible **Advanced**
  group (CMS / Boards / Feedback). `SUPERADMIN_SIDEBAR` untouched.
- `messages/en.json` + `sv.json` — added 8 keys (overview, results, factory, people, advanced,
  machines, company_setup, import_export) so labels render properly (next-intl has no custom
  fallback — missing keys would render `texts.<key>`).
- ⚠️ "Company Setup" points at `/admin/profile` (no dedicated company-settings page exists yet).

## ✅ TASK 4 — Loss Model page (remove ComingSoon)

- `src/services/admin-chart-data.service.js` — new `getLossModel(tenant, from, to, machineId?)`:
  recurrence-aware planned time, downtime by stop type, scrap by reason, machine-scoped. Returns
  `{ metrics, losses, inputs, range }`. Buckets: Availability (stop types, non-excluded),
  Performance (runTime × (1−perf)), Quality (scrapQty × idealCycle).
- `src/routes/admin-dashboard.routes.js` — `GET /api/v1/admin/dashboard/loss-model` (note: under
  the `/dashboard` router, so the path is `/admin/dashboard/loss-model`, not `/admin/loss-model`).
- `src/lib/api/loss-model.ts` — `useLossModel()`.
- `src/app/(admin)/admin/loss-model/page.tsx` — range picker (default ISO week) + machine selector,
  a CSS waterfall (Ideal → Availability → Performance → Quality → OEE), and a loss-categories table.

## ✅ TASK 5 — User Orders page (remove ComingSoon)

- `src/routes/mobile-user.routes.js` — `GET /api/v1/user/orders` (reuses the orders service).
- `src/lib/api/user-orders.ts` — `useUserOrders()`.
- `src/app/(user)/orders/page.tsx` — mobile order cards (progress bar produced/target, due date red
  when overdue, status pill), All / In Progress / Overdue tabs; tap → `/myresult/production`.
- ⚠️ No user→machine binding exists in the schema, so this returns the tenant's orders (not
  per-operator-machine). Documented; pass `?equipmentId=` to scope.

## ✅ TASK 6 — cycle_time typed column (resolves S1 blocker #3)

- `prisma/migrations/20260603000003_cycle_time_numeric/migration.sql` — adds
  `cycle_time_seconds double precision` to `equipment_properties` across `tenant_template` + all
  `tenant_*` schemas and backfills **only** strictly-numeric legacy `cycle_time` values.
- `prisma/schema.prisma` — `cycleTimeSeconds Float?` on `EquipmentProperty`.
- `src/services/admin-chart-data.service.js` — `getOeeMetrics()` (and `getLossModel()`) now prefer
  `cycle_time_seconds`, falling back to parsing the legacy VARCHAR, with a try/catch fallback if
  the column isn't present yet.
- Used `double precision` (not the brief's `NUMERIC(10,2)`) to match Prisma `Float?` and avoid
  `db push` drift.
- **Task 6 step 1 (data inspection) not run** — no DB connectivity. The backfill is deliberately
  strict (`~ '^[0-9]+(\.[0-9]+)?$'`) so it is safe regardless of the live values.

## Sprint 2 blockers — resolution status
1. ~~Andon `?company=` in URL~~ ✅ Task 1 (signed token + QR).
2. Public real-time — *still open* (token-scoped public socket is a future enhancement; board still polls).
3. ~~Warnings have no acknowledge state~~ ✅ Task 2.
4. `rc_data` format unverified — *still open* (heuristic retained; needs sample-data confirmation).
5. Per-machine OEE proxy on Andon — *still open*.
6. Andon socket events unused — *still open* (depends on #2).

## New blockers / follow-ups found in Sprint 3
1. **Migrations + `prisma generate`/`db push` must be run** before these features work against a
   real DB. The per-tenant column adds (Tasks 2 & 6) loop over `tenant_*` schemas — verify the
   DO-blocks against the actual schema-clone naming in staging.
2. **No "Company Setup" page** — Settings group links it to `/admin/profile` as a placeholder.
3. **`/admin/access/roles` for Company admins** — included in the People group; confirm the page
   exists/permits the Company role (it currently ships in the Super Admin sidebar).
4. **Loss Model headline vs. table units** — Performance/Quality losses are modelled minutes
   (derived), not directly recorded; the waterfall is illustrative, not a strict time ledger.
5. **User Orders is tenant-wide** (no operator↔machine link). A real assignment model (or a
   machine picker persisted to the user) would make it truly per-operator.

## Verification performed
- **Sprint 3:** `prisma format` + `prisma validate` → **schema valid**; `node --check` on all
  modified backend files → OK; backend modules `require`-load OK (`REQUIRE_OK`); full `next build`
  → **✓ Compiled successfully** with `/admin/loss-model`, `/orders`, `/alerts`, `/andon/[flowId]`
  and the wrapped `/admin/monitor/[[...id]]` in the route table. `qrcode.react@4.2.0` installed.

---

# Sprint 4 — detail

## ⛔ TASK 1 — Run pending migrations (BLOCKED, environment)

**Could not run.** This environment has **no usable database**:
- No `DATABASE_URL` is configured (`backend/.env` contains only `JWT_SECRET`).
- Port 5432 is open locally, but the documented dev credentials (`app:app@/fp_analyzer`,
  from `docker-compose.local.yml`) are **rejected** — so it is not this project's DB (or runs
  with unknown creds). Running schema DDL against an unidentified database would be unsafe, so
  it was **not** attempted. No migration output is fabricated.

There are now **4** migration files to apply (Sprint 3 added 3, Sprint 4 adds company_settings):
```
prisma/migrations/20260603000001_add_andon_tokens/      (public.andon_tokens)
prisma/migrations/20260603000002_add_warning_ack/       (tenant_* warning_data cols)
prisma/migrations/20260603000003_cycle_time_numeric/    (tenant_* equipment_properties col)
prisma/migrations/20260603000004_add_company_settings/  (public.company_settings)
```

**Runbook (operator to execute once `DATABASE_URL` is set):**
```bash
cd backend
# 1. Verify connection
node -e "const{PrismaClient}=require('@prisma/client');new PrismaClient().\$connect().then(()=>console.log('DB OK')).catch(console.error)"
# 2. Sync the public-schema models (andon_tokens, company_settings) + tenant_template
npx prisma db push          # this project uses db push, not migrate
npx prisma generate
# 3. Apply the per-tenant DO-block migrations to tenant_template + every tenant_<id>:
psql "$DATABASE_URL" -f prisma/migrations/20260603000002_add_warning_ack/migration.sql
psql "$DATABASE_URL" -f prisma/migrations/20260603000003_cycle_time_numeric/migration.sql
# (the andon_tokens + company_settings tables are created by `db push` from the models)
# 4. Verify columns
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.\$queryRawUnsafe(\"SELECT column_name FROM information_schema.columns WHERE table_schema='tenant_template' AND table_name='warning_data' AND column_name IN ('acknowledged_at','acknowledged_by')\").then(r=>{console.log(r);return p.\$disconnect()})"
```
All new endpoints degrade gracefully (try/catch fallbacks) until these run, so nothing crashes
pre-migration — features simply don't persist ack state / use the typed cycle column yet.

## ✅ TASK 2 — Company Setup page (resolves S3 blocker #2)

- `prisma/schema.prisma` — new `CompanySetting` model (public, JSONB blob keyed by companyId).
- `prisma/migrations/20260603000004_add_company_settings/migration.sql` — `public.company_settings`.
- `src/services/company-settings.service.js` — get/update (raw SQL upsert, deep-merged defaults).
- `src/routes/admin-company-settings.routes.js` — `GET`/`PATCH /api/v1/admin/company-settings`; mounted.
- `src/lib/api/company-settings.ts` — `useCompanySettings()` + `useUpdateCompanySettings()`.
- `src/app/(admin)/admin/profile/page.tsx` — replaced ComingSoon with the 3-section form
  (Company Information incl. logo upload→data-URL · OEE Settings · Notification Settings).
- The Settings sidebar group's "Company Setup" now points at a real page.

## ✅ TASK 3 — Public Andon Socket.io namespace (resolves S2 blocker #2)

- `src/socket/andon-socket.js` — **new** `/andon` namespace: token auth via `resolveToken`
  (no JWT), joins `flow:<companyId>:<flowId>`, emits `andon:snapshot` on connect + `andon:resync`.
  `relayMachineToAndon(tenantId, machineId)` recomputes & pushes a fresh snapshot to any board
  watching a flow that contains the machine (only when the room has connected boards).
- `src/services/socket.service.js` — calls `initAndonNamespace(_io)`; `emitToMachine` now
  fire-and-forget relays to `/andon` (every machine stop start/end → live board refresh).
- `src/app/(public)/andon/[flowId]/page.tsx` — connects to `${SOCKET_URL}/andon` with the token,
  listens for `andon:snapshot`; **30s HTTP poll kept as a fallback** if the socket can't connect
  (and the legacy `?company=` path, which has no socket auth, relies on the poll).

## ⚠️ TASK 4 — rc_data verification (hardened; verification blocked)

Could not query live `rc_data` (no DB). **Key realisation:** the existing case-insensitive
`ILIKE '%week%'` / `'%month%'` heuristic **already covers all three plausible encodings**, because
each contains the frequency word as a substring:
| Encoding | Example | Matches |
|---|---|---|
| JSON | `{"freq":"weekly"}` | `%week%` ✓ |
| iCal RRULE | `FREQ=WEEKLY;BYDAY=MO` | `%week%` (ILIKE) ✓ |
| plaintext | `weekly` | `%week%` ✓ |

So no logic change was made (changing it blind would be guessing); the comment in
`getOeeMetrics()` now documents this. **Verification query to run once DB is available:**
```bash
cd backend && node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();
p.\$queryRawUnsafe(\"SELECT DISTINCT rc_data, is_recurring FROM tenant_template.shift_schedule_data WHERE is_recurring=true LIMIT 20\")
.then(r=>{console.log(JSON.stringify(r,null,2));return p.\$disconnect()}).catch(e=>{console.log('no rows / error:',e.message);p.\$disconnect()})"
```
If the real format turns out to encode frequency without the word (e.g. `RRULE` abbreviations),
switch the `CASE` to explicit JSON/RRULE parsing.

## ✅ TASK 5 — Roles read-only for Company (resolves S3 blocker #3)

- `src/routes/roles.routes.js` — reads (`GET /`, `/permissions`, `/:id`) now use
  `requireAnyPermission('manage-roles','view-roles','view-backend')`; writes still require
  `manage-roles`. (Administrators bypass permission checks.)
- `src/app/(admin)/admin/access/roles/page.tsx` — `canManage = me.isAdmin`; the "New role"
  button and the entire Actions (Edit/Delete) column render only for Administrators; Company
  admins see a read-only table + "You have read-only access." note.
- ⚠️ Company role may still need `view-roles` or `view-backend` granted in RBAC seed data to
  read; otherwise the GET 403s (data/seeding concern, not code).

## ✅ TASK 6 — QA + deploy prep

- `backend/.env.example` + `frontend/.env.example` — **new**, generated from the actual
  `process.env.*` usage in the code (not guessed). Notable corrections vs. the brief:
  backend uses `JWT_ACCESS_SECRET` (not `JWT_SECRET`); `NEXT_PUBLIC_API_URL` is the **origin**
  (`http://localhost:4000`) because `api-client.ts` appends `/api/v1` itself.
- Health endpoint: **already present** at `GET /api/v1/health` →
  `{ status, uptime_s, timestamp, version, checks:{ db:{status,latency_ms}, redis:{...} } }`
  with real DB connectivity — no change needed (Docker `healthcheck` can hit it).
- `next build` → **✓ Compiled successfully**; `node --check` clean across all
  service/route/socket/middleware files; new modules require-load OK.

---

## Production Readiness

- [ ] Migrations applied to **staging** (`db push` + 2 DO-block SQL files; verify `tenant_*` loop)
- [ ] Migrations applied to **production**
- [ ] `prisma generate` run + backend redeployed (so the client knows `AndonToken`/`CompanySetting`)
- [ ] Environment variables set from `.env.example` (both apps) — esp. `DATABASE_URL`,
      `JWT_ACCESS_SECRET`, `PUBLIC_APP_URL`, `NEXT_PUBLIC_SOCKET_URL`
- [x] `next build` passes
- [x] Backend `node --check` clean
- [x] Health endpoint responding (`GET /api/v1/health`)
- [ ] PWA installable on mobile (test on a real device)
- [ ] Andon board tested on a TV (token link + live socket push)
- [ ] OEE numbers verified against a manual calculation on a known day
- [ ] RBAC: grant Company role `view-roles`/`view-backend` if read-only Roles is wanted
- [ ] Verify `rc_data` format with the query above; adjust recurrence parsing if needed

## Sprint 2/3 blockers — status after Sprint 4
1. ~~Andon `?company=` in URL~~ ✅ S3 (token).
2. ~~Public real-time socket~~ ✅ S4 Task 3 (`/andon` namespace + 30s fallback).
3. ~~Warnings ack state~~ ✅ S3 + S4 (mutation wired).
4. rc_data format — ⚠️ heuristic proven to cover JSON/RRULE/plaintext; live verify still pending DB.
5. Per-machine Andon OEE proxy — still open (needs per-equipment planned/qty/cycle).
6. ~~Andon socket events unused~~ ✅ S4 (relay on machine stop start/end).

## New blockers / follow-ups found in Sprint 4
1. **No DB in this environment** — migrations + `prisma generate` are the gating items for go-live.
2. **Logo upload stores a base64 data URL** in the settings JSON (no object-storage endpoint).
   Large logos bloat the row; add a real upload endpoint (`STORAGE_DRIVER`) for production.
3. **Company Setup is not yet consumed** — `targetOee`, `stopAlertThresholdMin`, `workingDays`,
   `plannedTimeMethod` are persisted but not yet read by OEE/alert logic. Wire them next.
4. **Andon relay covers stop start/end** (which accompany status changes); a pure
   `unit_connected` flip with no stop won't push until the 30s poll. Add a relay at the
   `machine:status:changed` emit point if sub-30s connection-state latency is required.

## Verification performed (Sprint 4)
- DB connectivity probed: no `DATABASE_URL`; documented dev creds rejected on :5432 → migrations not run (honestly reported).
- `prisma format` + `validate` (dummy URL) → **schema valid** (incl. `AndonToken`, `CompanySetting`).
- `node --check` across all `src/services`,`src/routes`,`src/socket`,`src/middleware` → clean.
- New backend modules `require`-load OK (andon-socket, company-settings, socket.service, roles).
- `next build` → **✓ Compiled successfully** (`/admin/profile`, `/admin/access/roles`,
  `/andon/[flowId]`, `/orders`, `/admin/loss-model` all present).

---

# Sprint 5 — detail

## ✅ TASK 1 — Stop Logger functional submit
`frontend/src/app/(user)/myresult/stop/page.tsx`. Machine `<Select>` (auto-selects first unit
from `useUnitsList()`), live IoT-stop banner (socket `openStop` + 1s timer), reason grid built
from **real** per-equipment reasons (`POST /user/getStopReasonData`, grouped `typeId`+`reasons[]`),
action strip. Submit → `useSaveStop()` → `POST /user/saveStopData`
`{flow_id:0, equipment_id, date, stop_type_id, stop_reason_id, time_minutes, comment, work_shift_name}`.
`message.success('Stop logged ✓')` / `message.error(...)`. When an equipment has no configured
reasons the grid shows an empty-state and submit is disabled (honest — the legacy save needs a
real `stop_reason_id`).

## ✅ TASK 2 — Production Logger functional submit
`frontend/src/app/(user)/myresult/production/page.tsx`. Machine selector (auto), big −/+ stepper
(+10/+50 chips), auto date (`todayLocal()`), auto shift (`currentShiftName()` 06–14 A / 14–22 B /
22–06 C). Submit → `useSaveProduction()` → `POST /user/saveProductionData`
`{flow_id:0, equipment_id, date, part_qty, planned_qty, work_hours, work_shift_name, comment}`.
On success: toast, reset qty, increment in-session "today" counter, invalidate the results table.

## ✅ TASK 3 — 3 pre-existing TS errors fixed (`tsc --noEmit` 0)
- `components/dashboard/SettingsUnitsList.tsx` (×2): `useUnitsList()` returns `UnitCard[]`
  (`unitName: string | null`), but the local `UnitFromApi` declared `unitName: string`. Made it
  nullable + guarded the one consumer (`name: u.unitName ?? ''`).
- `app/(admin)/admin/shift-schedules/[id]/edit/page.tsx`: `eventResize` was handed a handler typed
  `(arg: EventDropArg)`; FullCalendar passes `EventResizeDoneArg`. Imported `EventResizeDoneArg`
  from `@fullcalendar/interaction`, typed `handleEventResize` with it, and widened `handleEventDrop`
  to `EventDropArg | EventResizeDoneArg` (it only reads `event.id/start/end` + `revert()`, common to both).

## ✅ TASK 4 — Scrap Logger
`frontend/src/app/(user)/myresult/scrap/page.tsx`. Machine selector + scrap-reason `<Select>`
(`POST /user/getScrapReasonData`) + qty stepper + brand submit → `useSaveScrap()` →
`POST /user/saveScrapData` `{flow_id:0, equipment_id, date, scrap_type_id, scrap_reason_id,
quantity, work_shift_name, comment}`.

## ✅ TASK 5 — Profile settings rows
`frontend/src/app/(user)/profile/page.tsx`. Identity card (initials + role chips) + tappable rows:
🌍 Language (toggles `NEXT_LOCALE` cookie + reload), 🔔 Push Notifications (antd `Switch`,
persisted to `localStorage['fp_push_enabled']`), 🌐 Timezone (from tenant or `Europe/Stockholm`),
🔒 Change Password (`/profile/password`), 🚪 Sign Out (`useLogout()`).

## ✅ TASK 6 — Admin machine grid wired to live data
New `useAdminMachines()` in `frontend/src/lib/api/admin-machines.ts` — polls `GET /units` every
10s (no role guard; Company admin can read), maps to `{id, name, status, unregisteredCount,
lastOnline}`. Dashboard machine grid now renders these with the Socket.io store
(`useLiveMachines()`) layered on top for instant flips; "No machines connected" only when the
tenant truly has zero units.

## New hooks — `frontend/src/lib/api/operator-logging.ts`
`useEquipmentStopReasons` / `useEquipmentScrapReasons` / `useEquipmentOrders` (lookup), and
`useSaveStop` / `useSaveProduction` / `useSaveScrap` (mutations). Each unwraps the legacy
`{success,msg,data}` envelope and throws `msg` on `success:false`. Helpers `currentShiftName()`
+ `todayLocal()` (local-date, avoids the `toISOString()` UTC off-by-one).

## Verification performed (Sprint 5)
- `tsc --noEmit` → **0 errors** (was 3).
- All 6 routes compile + HTTP 200: `/dashboard`, `/myresult/stop`, `/myresult/production`,
  `/myresult/scrap`, `/admin/dashboard`, `/profile`.
- Live save smoke tests (authed as `user2@gmail.com`, `tenant_2`):
  `saveProductionData`→`{success:true,data:{id:13}}`, `saveStopData`→`{id:10}`,
  `saveScrapData`→`{id:6}`. (These created real rows in `tenant_2` for verification.)
- Compiled `.next` bundles contain the new UI strings per route.

## New blockers / follow-ups (Sprint 5)
1. **No stop/scrap reasons seeded for tenant_2 equipment** → the operator reason pickers show
   an empty-state and submit is disabled until an admin configures stop/scrap reasons per
   equipment. The endpoints + wiring are proven via direct calls.
2. **Photo capture** on the stop logger is still a disabled placeholder (upload endpoint
   `POST /units/:id/stop-data/upload` exists; wire camera/file input next).
3. **`flow_id` is sent as 0** — the save service accepts it, but rows aren't linked to a flow.
   For flow-attributed results, look up a flow via `POST /user/getFlowListByEquipment` and pass
   its `id`.
4. **Production logger sends no `part_id`/`order_no`** (good-parts qty only). Add part/order
   pickers (`getEquipmentPartData` / `getEquipmentOrderData`) for full attribution.

---

# Sprint 5.1 — gap fixes (resolves Sprint 5 follow-ups #1, #3, #4)

| # | Task | Status |
|---|------|--------|
| 1 | Seed stop/scrap reasons + map to tenant_2 equipment (S5 follow-up #1) | ✅ done |
| 2 | Part + Order pickers on Production Logger (S5 follow-up #4) | ✅ done |
| 3 | Wire real `flow_id` for stop/production (S5 follow-up #3) | ✅ done |

## ✅ TASK 1 — Seed stop/scrap reasons
Root cause: `equipment_stop_reasons` and `equipment_scrap_reasons` were **empty** for tenant_2
(no equipment→category mapping), so `getStopReasonData`/`getScrapReasonData` returned `[]`. The
`types` admin page already had category rows; only the per-equipment mapping was missing.
Seeded (idempotent, `tenant_2`): 4 stop categories (Mechanical/Electrical/Material/Planned) + 8
stop reasons; 4 scrap reasons under existing `ScrapReason` types (Wrong dimension / Surface
defect); mapped all to equipment **79** and **96**; plus 2 demo work orders. Verified live:
`getStopReasonData(79)` → 4 grouped categories, `getScrapReasonData(79)` → 2, `getEquipmentPartData(79)` → 2 parts, `getEquipmentOrderData(79)` → 1 order.

## ✅ TASK 2 — Part + Order pickers (Production)
`frontend/src/app/(user)/myresult/production/page.tsx` — added searchable **Part Number**
(`useEquipmentParts` → `POST /user/getEquipmentPartData`) and **Work Order**
(`useEquipmentOrders` → `POST /user/getEquipmentOrderData`) selects above the qty stepper.
Submit body now includes `part_id` and `order_no`. New hooks `useEquipmentParts` + the
`partId` field on `SaveProductionInput`/`part_id` in the body
(`frontend/src/lib/api/operator-logging.ts`).

## ✅ TASK 3 — Wire real `flow_id`
Backend bug fixed: `POST /user/getFlowListByEquipment` called `flowSvc.list({status:1})`
**without** `equipmentId`, so `flow_data` was omitted from the SELECT and the string filter
`f.flowData.includes('equipment-id="79"')` never matched → always `[]`. Added an
`includeFlowData` option to `admin-flow-designs.service.js` `list()` that forces `flow_data` into
the SELECT **without** the GoJS-JSON node filter (the data here is mxGraph **XML**), and the route
now passes it. New `useEquipmentFlow()` hook resolves the first matching flow id; stop &
production submits send it (production prefers a selected order's `flowId`).

## Verification performed (Sprint 5.1)
- `tsc --noEmit` → **0 errors**. `/myresult/{production,stop,scrap}` → 200, no compile errors.
- `getFlowListByEquipment(79)` → **43 flows** (was `[]`); first id 281.
- Live submits (`tenant_2`): production id **14** → `flow_id=154, part_id=40, order_no=WO-2026-079`;
  stop id **11** → `flow_id=281, stop_type_id=7, reason=10`. **`flow_id` is non-zero** (was 0).

## Still open (carried from Sprint 5)
- #2 Photo capture on stop logger is still a disabled placeholder (`POST /units/:id/stop-data/upload`
  exists; wire camera/file input next).
- Equipment **96** (unit `seed-test-unit`) has no flow → `flow_id` stays 0 for it (no flow contains
  it); reasons/parts now seeded. Equipment 79 (the auto-selected first unit) is fully wired.
