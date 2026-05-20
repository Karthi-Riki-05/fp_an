# FP Analyzer — Migration Notes (Phase 0 v3)

> **Status:** Phase 0 v3 — applies v2-review R1–R6 + folds C1–C6 answers. **Approved for Phase 1; commit 1 produced from this file.**
>
> **Source:** `/Applications/XAMPP/xamppfiles/htdocs/fpanalyzer` (Laravel 5.8 / PHP 7.2, EOL).
> **Target:** `/Applications/XAMPP/xamppfiles/htdocs/new_fp` (Next.js 14 + NestJS 10 + PostgreSQL 16).
> **Folder note:** the directory on disk is `fpanalyzer` (with a "z"); the migration prompt uses `fpanalyser`. Treated as identical.
> **Companion artifact:** `legacy-schema.json` — frozen MySQL schema reference extracted from `/fpanalyzer/public/API/{common_db.sql, demoChildDb.sql}` (master = 2017 template, tenant = 2025-05 dump). Phase 2 generates the Prisma schema from this file; Phase 6 asserts live MySQL still matches before migrating data.

This document is the contract for every later phase. If a decision below is wrong, fix it here first and re-run the affected phase.

## v3 changelog

Tightening pass on v2 — no architecture changes, applies the six revisions in the v2 review feedback:

- **R1 (§4.5)** — permission list trimmed to **26** (was 38). Dropped `view-flow-monitor`/`view-flow-analyzer`/`view-units`/`view-boards` (tenant membership = view, not permission). Collapsed `manage-machines` + `manage-machine-documents` + `manage-machine-programmes` → single `manage-machines`. Added `manage-folders`. Folded `stop-categories` into `stop-reasons`; `sliders`+`testimonials`+`symbols` into `cms`/`flow-designs`. Updated Company/User role mappings.
- **R2 (§4.3)** — `Order.equip_id` → Prisma `equipment_id` is an explicit *rename*, not passthrough; Phase 6 migration script must map it. Same applies wherever legacy uses `equip_id` (`tbl_machines`, `equipment_properties`, `tbl_warning_data`).
- **R3 (§11.5)** — added immutability paragraph: snapshot fields (`*_email`, `*_name`) are write-once, never updated. No future "fix-it" sync jobs.
- **R4 (§13.21)** — concrete drift list (table names) for Phase 6 schema-drift assertion. References `legacy-schema.json` `discrepancies.master_missing_tables` / `discrepancies.tenant_missing_tables` / `discrepancies.ghost_models`.
- **R5 (§16)** — polling intervals bumped (Flow Monitor 5→10s, Loss Monitor 10→15s, Units 15→20s, Machine Status 5→10s, Dashboard new 30s). Per-page `NEXT_PUBLIC_POLL_INTERVAL_*_MS` env vars. SSE escalates if backend p95 >300 ms or DB CPU >60% sustained.
- **R6 (§17 NEW)** — explicit timezone handling: UTC `timestamptz` storage, per-tenant `timezone` column on `public.tenants` (default `'Europe/Stockholm'`), shift boundary calculations use tenant TZ explicitly. Added `tenants.timezone` to §4.3 Tenant model row.
- **§13** — added decisions 28–31 covering R6, C1 (big-bang + 30-day rollback), C2 (TipTap provisional), C5 (lazy-load all 10 locales).
- **§14** — folded C-question answers into a resolution table; concrete unknowns moved to `OPERATOR_QUESTIONS.md`.

## v2 changelog

Section headers ending with **(updated v2)** changed materially in this revision. Bullets here summarize what moved.

- §0 — added `legacy-schema.json` companion artifact reference.
- §1 — split JWT into web (cookie) + IoT (bearer); added `JWT_DEVICE_SECRET` callout.
- §2 — confirmed `/api/` v0 mount stays as a thin shim to v1 services (B6 evidence: legacy frontend never calls the API; only IoT firmware does, and we can't coordinate firmware upgrades).
- §3 — `MachineFilesController` operates on `MachineDocument` / `MachineDocumentFile` per A1 rename.
- §4.3 — model rename `Machines → MachineDocument`, `MachineFiles → MachineDocumentFile`; `Order` model now has confirmed columns from B2; dropped `Objects` model (B1 — only a dead import).
- §4.4 — soft-delete via explicit `notDeleted()` helpers, no global Prisma middleware (A2).
- §4.5 — full inventory of legacy permissions (B3 — only `view-backend`, `manage-users`, `manage-roles` are enforced; v2 expands).
- **§4.6 — NEW** — `tbl_machine_data` partition strategy (A3).
- §5 — auth strategy duality (A4).
- §6 — Bull Board gated by env var (A10).
- §11.5 — replace cross-schema FKs with denormalised user snapshots (A5); `pg_dump --schema=tenant_<id>` can now produce standalone-restorable backups.
- §11.2 — add `pg_trgm` extension (A7).
- §13 — added v2 decisions (A1–A10) and removed/promoted some C1-resolved items.
- **§16 — NEW** — Realtime (deferred) (A9).
- §14 — open questions trimmed to the genuinely unanswerable C1–C6.

Reviewer-mandated git artifact contract: when Phase 1 begins, commit 1 must be `chore: phase 0 — migration notes` containing only `MIGRATION_NOTES.md` and `legacy-schema.json`. Phase 1 scaffolding goes in commit 2.

---

## 0. Verified scope (counts grounded in the actual repo)

| Surface | Count | Source |
|---|---|---|
| Route files | 9 (`routes/Api/api.php`, `routes/Backend/Dashboard.php`, `routes/Backend/Access.php`, `routes/Backend/LogViewer.php`, `routes/Frontend/Frontend.php`, `routes/Frontend/Access.php`, `routes/Language/Language.php`, `routes/console.php`, `routes/routes.php`) | `find routes/` |
| Route declarations | **468 total** — 282 admin (Backend/Dashboard.php, 403 lines) + 21 Backend/Access + 88 Frontend/Frontend + 20 Frontend/Access + 47 Api (mounted twice → ~94 endpoints) + 9 LogViewer + 1 Language + ~15 routes.php glue | `grep -c Route::` |
| Controllers | **20** active + 3 dead (`MachineController_old.php`, `bk_machinecontrolller.php`, `MachineController copy.php`) | `find app/Http/Controllers/` |
| God controllers | `Backend/DashboardController.php` = **6,253 lines / 100+ methods**; `Frontend/CompanyUserController.php` = **2,284 lines**; `Api/v1/ApiController.php` = **1,553 lines**; `Api/v1/MachineController.php` = **1,174 lines** | `wc -l` |
| Models | **47 model classes** (+ 10 trait/relationship files in `Access/`) — total `app/Models/**/*.php` = 57 files | `find app/Models/` |
| Middleware | 8 (`Authenticate`, `EncryptCookies`, `LocaleMiddleware`, `RedirectIfAuthenticated`, `RouteNeedsPermission`, `RouteNeedsRole`, `SessionTimeout`, `VerifyCsrfToken`) | `find app/Http/Middleware/` |
| Jobs | 4 (`UpdateMachineStartStatus`, `…StatusV1`, `UpdateMachineStopStatus`, `…StopStatusV1`) + base `Job` | `find app/Jobs/` |
| Events / Listeners | 14 events / 3 subscriber listeners (frontend auth + backend user + backend role) | `find app/Events/ app/Listeners/` |
| Lib (helpers/traits) | 4 (`CommonFunc`, `CopyBasicData`, `FcmNotification`, `FileUtility`) | `find app/Lib/` |
| Repositories | 4 sets (Frontend User; Backend User, Role, Permission; History) | `find app/Repositories/` |
| Import/Export | 6 (Equipment, Part, Order × export/import) | `find app/ImportExports/` |
| Locales | **10** — `ar, da, de, en, es, fr, it, pt-BR, sv, th` (+ `vendor/`); 15 keyspace files per locale (`alerts, auth, buttons, custom, exceptions, history, http, labels, menus, navs, pagination, passwords, roles, strings, validation`) | `ls resources/lang/` |
| `.env` | **Committed**, 85 lines, contains real DB password, `APP_KEY`, mail password, Graph key. Must be rotated. | `cat .env` |
| MySQL tables | Only **4 have Laravel migrations** (`users`, `password_resets`, `jobs`, `failed_jobs`); ~50 more exist only in the live DB. | `find database/migrations/` |

The pre-existing `docs-1/` reference docs (14 files) match the actual code with one important correction: `Backend/Dashboard.php` has 282 `Route::` declarations, not "150+" as previously documented.

---

## 1. Stack mapping (legacy → new) (updated v2)

| Concern | Legacy | New | Notes |
|---|---|---|---|
| Web framework | Laravel 5.8 (EOL) | NestJS 10 (TS) on Node 20 LTS | Modular structure matches the domain split better than raw Express. |
| Frontend | Blade + Bootstrap 3/4 + jQuery 3 (server-rendered) | Next.js 14 App Router + Ant Design 5 + TanStack Query + Zustand | Server-first; pages preserve legacy URL structure. |
| Database | MySQL 5.7+ on AWS RDS, **DB-per-tenant** | PostgreSQL 16, **schema-per-tenant** in one DB | Decision detailed in §11. |
| ORM | Eloquent | Prisma (`multiSchema` preview) | Soft-delete via explicit per-service `notDeleted()` helpers (A2 — no global Prisma middleware). |
| Auth (web) | Session + custom Access service | JWT in **httpOnly Secure SameSite=Lax cookie** (A4) — `JwtCookieStrategy` Passport strategy. 15 min access + 7 day refresh. | Replaces 5-min server timeout (hostile UX for shop floor). |
| Auth (IoT) | Email+password in every request body (no token) | JWT in **`Authorization: Bearer`** header (A4) — `JwtBearerStrategy`. Long-lived (365 day) device-bound JWT with `device_id` claim verified against `tbl_machines`. Separate secret `JWT_DEVICE_SECRET`. | `IotAuthGuard` accepts only the bearer strategy. |
| Roles/permissions | `config/access.php` static + DB tables | DB-only via Prisma; runtime-editable via admin UI | Seeded from `config/access.php`. |
| Queue | DB driver (`jobs`/`failed_jobs` tables) | BullMQ on Redis | Four V1 IoT jobs port over; V0 jobs dropped. |
| Cache / sessions | File driver | Redis (BullMQ shares this Redis) | Aligns with prompt §Phase 5 services. |
| Charts | HighCharts + AmCharts | `highcharts-react-official` (legacy already uses HighCharts heavily) + AmCharts 5 React only where AmCharts-specific visuals exist | Default to HighCharts for new charts. **Phase 4c Q2:** Legacy `board/graphWidgets` routed chart rendering through an external Grafana instance (GRAPH_URL / GRAPH_KEY env vars). That integration is broken for the new PostgreSQL stack. Replaced with in-app HighCharts using the `getBarChartData()` query logic ported to NestJS services. GRAPH_URL / GRAPH_KEY are marked `# legacy — unused in new stack` in `.env.example`. |
| Calendar | jQuery FullCalendar v3 (CDN) | `@fullcalendar/react` + `@fullcalendar/daygrid` + `@fullcalendar/timegrid` + `@fullcalendar/interaction` — **shift schedule edit page only** | AntD `Calendar` is insufficient for recurring-event expansion and click-to-add interaction required by the shift schedule edit UI (Phase 4c Q1). AntD Calendar is still used for date pickers elsewhere. |
| Flow diagrams | GoJS (`public/js/google.js`, 822 KB) | `gojs` npm package wrapped in a React component | Same library, React adapter. |
| Rich text | CKEditor 4 (full distribution in `public/ckeditor/`) | TipTap or Ant Design's `Mentions`/`Editor` integration; CKEditor 5 React fallback for CMS | CKEditor 4 is EOL; default to TipTap, escalate to CKEditor 5 if CMS authors need its specific UX. |
| Tables | yajra DataTables (server-side) | Ant Design `Table` with TanStack Query server pagination | Same UX; remove the jQuery dependency. |
| Excel | `maatwebsite/excel` (PhpSpreadsheet) | `exceljs` | 1:1 functional port. |
| Push | `FcmNotification` PHP lib | `firebase-admin` npm | Same FCM. |
| Email | Office 365 SMTP via Laravel Mail | nodemailer with same SMTP config; MailHog in dev compose | Templates re-rendered as `react-email`. |
| Social login | `laravel/socialite` (FB, Google, GitHub, LinkedIn, Twitter, Bitbucket) | NestJS Passport strategies for the same 6 | Provider creds via env. |
| CAPTCHA | reCAPTCHA v3 (`arcanedev/no-captcha`) | reCAPTCHA v3 server-verify in NestJS guard | Same site/secret keys. |
| Backups | `spatie/laravel-backup` | Postgres `pg_dump` cron in Docker; off-host upload to S3 | Configurable; not first-class in Phase 1. |
| Log viewer | `arcanedev/log-viewer` web UI | Pino → stdout → Docker logs / Loki; drop the in-app viewer | Delete `/admin/log-viewer/` URLs. |
| Multi-tenant DB creation | cPanel `xmlapi` (hardcoded `root:pc-11` creds in code) | Prisma migration that clones a `tenant_template` schema | Removes cPanel dependency entirely (§11). |
| API auth | None (email+password in body, throttle commented out) | JWT + per-route guards, throttling on every endpoint | Major security improvement. |
| Static assets | `public/` AdminLTE + custom uploads | `frontend/public/` for static, S3 for tenant-uploaded files | Migration script copies legacy uploads. |

---

## 2. Routes inventory & mapping

Legacy routes are grouped below by file. Every legacy route has either a planned **new endpoint** (NestJS REST) plus **frontend page** (Next.js), or a documented decision to **drop**. The new endpoint shape follows REST conventions: `GET /api/v1/<resource>`, `POST /api/v1/<resource>`, `GET /api/v1/<resource>/:id`, `PATCH /api/v1/<resource>/:id`, `DELETE /api/v1/<resource>/:id`. **All destructive operations move from GET to DELETE.** Where the legacy URL is user-facing, the Next.js path preserves it.

### 2.1 Public / unauth (`routes/Frontend/Frontend.php`, 88 routes)

| Legacy URI | Method | Controller@method | New endpoint | Next.js page | Notes |
|---|---|---|---|---|---|
| `/` | GET | `FrontendController@index` | — | `app/(public)/page.tsx` | Legacy `index` redirects to `https://www.fpanalyzer.se` (marketing site). New: render landing page. |
| `/faq` | GET | `FrontendController@faq` | — | `app/(public)/faq/page.tsx` | CMS-driven content. |
| `/privacy_policy` | GET | `FrontendController@privacy_policy` | — | `app/(public)/privacy/page.tsx` | URL changed to `/privacy` for cleanliness; legacy URL kept as redirect. |
| `/terms_conditions` | GET | `FrontendController@terms_conditions` | — | `app/(public)/terms/page.tsx` | Legacy URL kept as redirect. |
| `/getting_started` | GET | `FrontendController@getting_started` | — | redirect to `/` | Legacy redirects to home. |
| `/roi-kalkyl` | GET | `FrontendController@roi_calculator` | — | `app/(public)/roi-kalkyl/page.tsx` | Swedish URL preserved. |
| `/sendContact` | POST | `FrontendController@sendContact` | `POST /api/v1/contact` | inline submit on landing page | reCAPTCHA verified server-side. |
| `/clear` | GET | `FrontendController@clear` | — | **DROP** | Was `php artisan view:clear` exposed via web — clear security smell. |
| `/test`, `/tester` | GET | `FrontendController@test`, `CompanyUserController@tester` | — | **DROP** | Debug endpoints. |
| `lang/{lang}`, `changeLanguage/{locale}` | GET | `LanguageController@swap`, `FrontendController@changeLanguage` | — | `next-intl` cookie set client-side | No backend route needed. |
| `{slug}` | GET | `FrontendController@gatPage` | `GET /api/v1/cms/pages/:slug` | `app/(public)/[slug]/page.tsx` | CMS catch-all (fall-through after auth routes). |

### 2.2 Auth (`routes/Frontend/Access.php`, 20 routes)

| Legacy URI | New endpoint | Next.js page | Notes |
|---|---|---|---|
| `GET/POST login` | `POST /api/v1/auth/login` | `app/(public)/login/page.tsx` | Returns `{ access_token, refresh_token, user, tenant }` set as httpOnly cookies. |
| `GET login/{provider}` | `GET /api/v1/auth/oauth/:provider` (+ callback) | redirect | Passport strategies for FB/Google/GitHub/LinkedIn/Twitter/Bitbucket. |
| `GET register`, `register/{slug}` | `POST /api/v1/auth/register` | `app/(public)/register/page.tsx`, `register/[plan]/page.tsx` | "Choose price plan" → "register with plan slug" flow preserved. |
| `POST register` | `POST /api/v1/auth/register` | — | Sends confirmation email. |
| `GET account/confirm/{token}` | `GET /api/v1/auth/confirm/:token` | `app/(public)/account/confirm/[token]/page.tsx` | Returns success/error to a server component. |
| `GET account/confirm/resend/{user_id}` | `POST /api/v1/auth/confirm/resend` | — | Body: `{ email }`. The user_id-in-URL legacy form is a CSRF risk; replaced. |
| `password/reset`, `password/email`, `password/reset/{token}/{email}` | `POST /api/v1/auth/password/forgot`, `POST /api/v1/auth/password/reset` | `app/(public)/password/forgot/page.tsx`, `password/reset/[token]/page.tsx` | Email no longer in URL. |
| `GET/POST password/change` (auth) | `POST /api/v1/auth/password/change` | `app/(user)/profile/password/page.tsx` | |
| `GET logout` | `POST /api/v1/auth/logout` | client-side calls API then clears cookies | GET → POST. |
| `GET logout-as` | `POST /api/v1/auth/impersonate/stop` | client | Admin-as-user. |

### 2.3 Authenticated user (`routes/Frontend/Frontend.php` userFrontEnd group, 67 routes)

Mapped to NestJS modules and Next.js routes. Legacy URL path preserved where reasonable:

| Legacy URL pattern | NestJS module | New endpoint | Next.js path |
|---|---|---|---|
| `dashboard` | `dashboard` | `GET /api/v1/dashboard` | `(user)/dashboard/page.tsx` |
| `profile/edit`, `profile/update` | `users` | `GET /api/v1/me`, `PATCH /api/v1/me` | `(user)/profile/page.tsx` |
| `myresult`, `myresult/production_data`, `myresult/scrap_data`, `myresult/stop_data`, `myresult/unregistered_stop`, `myresult/warning_log` | `production-data`, `scrap-data`, `stop-data`, `warning-data` | `GET /api/v1/{resource}` (list endpoints with `mine=true` filter) | `(user)/myresult/(production_data|scrap_data|stop_data|unregistered_stop|warning_log)/page.tsx` |
| `myresult/formResultProduction/{id?}` | `production-data` | `GET /api/v1/production-data/:id` | `(user)/myresult/production_data/edit/[id]/page.tsx` (and `/new`) |
| `myresult/saveResultProduction` | | `POST /api/v1/production-data` (or `PATCH /:id`) | client-side form |
| `myresult/deleteResultProduction/{id}` | | `DELETE /api/v1/production-data/:id` | (GET → DELETE) |
| same pattern for `ScrapData`, `StopData`, `WarningLog` | `scrap-data`, `stop-data`, `warning-data` | analogous | analogous |
| `myresult/getProductionSummary`, `getResultScrapSummary`, `getResultStopSummary` | each domain module | `GET /api/v1/{resource}/summary` | client component |
| `analyzer/{id?}` | `flow-analyzer` | `GET /api/v1/flow-designs/:id/analyzer` | `(user)/analyzer/[[...id]]/page.tsx` |
| `flow/get_flow_analyzer`, `flow/get_lc`, `flow/get_quant_time` | `flow-analyzer` | `GET /api/v1/flow-analyzer/...` | embedded |
| `monitor/{id?}` | `flow-monitor` | `GET /api/v1/flow-designs/:id/monitor` | `(user)/monitor/[[...id]]/page.tsx` |
| `flow/get_loss_monitor`, `flow/scrape_form`, `flow/stop_form`, `flow/scrape/add`, `flow/stop/add`, `flow/shift/add`, `flow/shift/get-hours`, `flow/register_data` | `flow-monitor` (write-side) | analogous REST endpoints in `flow-monitor` module | embedded forms (Ant Design Modal) |
| `getFlowMonitorList`, `getFlowAnalyzerList`, `changeFlowMonitorListView`, `changeFlowAnalyzerListView`, `getFlowMonitorListImg` | `flow-monitor`, `flow-analyzer` | `GET /api/v1/flow-monitor/list`, `GET /api/v1/flow-analyzer/list`, `PATCH /api/v1/me/preferences` | client |
| `machines`, `machine/get-machine`, `machines/download_file/{id}`, `machine/file`, `programme/files`, `program/downloadfile`, `folder_file/delete/{id}`, `folder_file/lock/{id}` | `machine-files` | `GET /api/v1/machines`, `GET /:id`, `GET /:id/files`, `POST /:id/files`, `DELETE /api/v1/machine-files/:id`, `POST /api/v1/machine-files/:id/lock`, `GET /api/v1/machine-files/:id/download` | `(user)/machines/page.tsx`, `(user)/machines/[id]/page.tsx` |
| `units`, `getUnits`, `getUnitStopData`, `getUnitShiftSelectDlgContent`, `getUnitStopSaveDlg`, `saveUnitStopData`, `updateMachineStatus`, `getMachineStatus` | `flow-monitor` (IoT-facing slice) | `GET /api/v1/units`, `GET /api/v1/units/:id`, `POST /api/v1/units/:id/stop-data`, `PATCH /api/v1/units/:id/status` | `(user)/units/page.tsx` |
| `equipment/modal-view/`, `equipment/modal-view/` (POST) | `equipment` | `GET /api/v1/equipment/:id`, `PATCH /api/v1/equipment/:id/icon` | embedded modal |
| `feedback`, `feedback/save`, `feedback/show/{id}`, `feedback/remove/{id}` | `feedback` | `GET /api/v1/feedback`, `POST /api/v1/feedback`, `GET /:id`, `DELETE /:id` | `(user)/feedback/page.tsx` |
| `searchmachineprogram` | `machine-files` | `GET /api/v1/machine-files/search?q=` | embedded |
| `getStopAnalyzeData`, `getScrapAnalyzeData`, `getProductionAnalyzeData`, `lossmonitor/form_production`, `…/form_scrap`, `…/form_stop` | `flow-monitor`, `loss-model` | analogous REST endpoints | embedded |
| `password_match` | `auth` | `POST /api/v1/auth/verify-password` | client (used to reauth before delete) |
| `saveTableSetting`, `saveSettings` | `users` | `PATCH /api/v1/me/preferences` | client |

### 2.4 Order routes (`routes/routes.php`, 11 routes)

Note: `OrderController` is in `Backend/` namespace but is reused for both admin and frontend. New code uses one `orders` module serving both contexts:

| Legacy URL | New endpoint | Next.js path |
|---|---|---|
| `/orders` | `GET /api/v1/orders` | `(user)/orders/page.tsx` |
| `/order-add` GET/POST | `POST /api/v1/orders` | `(user)/orders/new/page.tsx` |
| `/order-edit/{id}` GET, `/order-update` POST | `PATCH /api/v1/orders/:id` | `(user)/orders/[id]/edit/page.tsx` |
| `/order-status/{id}` GET | `PATCH /api/v1/orders/:id/status` | client |
| `/order-delete/{id}` GET | `DELETE /api/v1/orders/:id` | client |
| `/getEquipmentsByFlowId/{id}` GET | `GET /api/v1/flow-designs/:id/equipments` | client |
| `/getPartsByEquipmentId/{id}` GET | `GET /api/v1/equipment/:id/parts` | client |
| `/getOrderNoByPartId`, `/getOrderNoByEquipId` | `GET /api/v1/orders?part_id=…`, `?equipment_id=…` | client |
| `/getOrderSummary` | `GET /api/v1/orders/summary` | client |
| `boards/{id?}`, `board/getChartData`, `board/getLossChart`, `board/saveBoardChartSettings`, `board/saveBoardDateRangeSettings` | `boards` | `GET /api/v1/boards`, `GET /:id`, `GET /:id/chart-data`, `GET /:id/loss-chart`, `PATCH /:id/settings` | `(user)/boards/[[...id]]/page.tsx` |
| `lossModel/getLossData`, `lossModel/getStopCategoryData`, `lossModel/searchOrderNo` | `loss-model` | `GET /api/v1/loss-model/data`, `/stop-categories`, `/orders?q=` | embedded |

### 2.5 Admin routes (`routes/Backend/Dashboard.php`, 282 declarations)

The admin routes break into 17 domain blocks. Each becomes a NestJS module + an admin Next.js route group page tree (`app/(admin)/...`). I will not transcribe all 282 here; the mapping pattern is:

| Block | Legacy URL prefix | NestJS module / controller | Next.js path | Endpoint pattern |
|---|---|---|---|---|
| Dashboard | `/admin/dashboard`, `/admin/getReportData` | `dashboard` | `(admin)/dashboard/page.tsx` | `GET /api/v1/admin/dashboard`, `/reports` |
| Flow design | `/admin/flow/...` (~20 routes: add, edit, monitor, analyzer, change-status, delete, list-view, batch-update, bg-flow upload/remove) | `flow-design` | `(admin)/flow/page.tsx`, `flow/[id]/edit/page.tsx`, `flow/[id]/analyzer/page.tsx`, `flow/[id]/monitor/page.tsx` | full REST + sub-actions |
| Equipment | `/admin/equipments`, `/admin/equipment/...` (~20 routes including stop-reasons, scrap-reasons, properties, sort, tree, modal CRUD) | `equipment` | `(admin)/equipment/page.tsx`, `equipment/[id]/page.tsx` | REST + nested `/stop-reasons`, `/scrap-reasons`, `/properties` |
| Parts | `/admin/production/parts`, `/admin/production/part-...` (7 routes) | `parts` | `(admin)/production/parts/...` | REST |
| Orders | `/admin/production/orders`, `/admin/production/order-...` (11 routes) | `orders` (shared with frontend) | `(admin)/production/orders/...` | REST |
| Work shifts | `/admin/production/work-shifts`, `/admin/production/shift-...` (7 routes) | `work-shifts` | `(admin)/production/shifts/...` | REST |
| Shift schedules | `/admin/production/ShiftSchedule`, `…/AddShiftSchedule`, `…/EditShiftSchedule/{id}`, etc. (~12 routes) | `shift-schedules` | `(admin)/production/shift-schedules/...` | REST + `/events`, `/data/:id`, `/status` |
| Types | `/admin/types`, `/admin/type/...` (8 routes) | `types` | `(admin)/types/...` | REST |
| Machines (file manager) | `/admin/machines`, `/admin/machine/...` (~13 routes) | `machine-files` | `(admin)/machines/...` | REST + `/files`, `/folders`, `/files/:id/lock`, `/trash`, `/locked` |
| Files / folders | `/admin/files`, `/admin/folder/...`, `/admin/folder-file/...`, `/admin/file/trash_*`, `/admin/file/locked_list` | `files-folders` (shared with `machine-files`) | `(admin)/files/...` | REST |
| Result data (admin view) | `/admin/result/production`, `/admin/result/scrap_data`, `/admin/result/stop_data` (12 routes incl. form & save) | `production-data`, `scrap-data`, `stop-data` | `(admin)/result/production/...`, etc. | same modules as user but admin scope |
| Warning data | `/admin/result/warning-data/...` (5 routes) | `warning-data` | `(admin)/result/warning-data/...` | REST |
| Company / company users | `/admin/company`, `/admin/company/user...` (~10 routes) | `tenants` (Company), `users` (Company users) | `(admin)/companies/page.tsx`, `companies/[id]/page.tsx`, `companies/[id]/users/page.tsx` | REST |
| Programme | `/admin/programme`, `/admin/programme/...` (8 routes) | `machine-programmes` | `(admin)/programme/...` | REST |
| Workstation | `/admin/workstation`, `/admin/workstation/...` (7 routes) | `workstations` | `(admin)/workstation/...` | REST |
| CMS / Sliders / Testimonials / Symbols / Social | `/admin/cms/...`, `/admin/sliders/...`, `/admin/testimonial/...`, `/admin/symbol/...`, `/admin/social`, `/admin/socialupdate` | `cms`, `sliders`, `testimonials`, `symbols`, `cms` (social settings sub-resource) | `(admin)/cms/...`, etc. | REST |
| Loss model / stop category | `/admin/lossModel/...`, `/admin/users/stopCategoryForm`, `/admin/users/saveStopCategory` | `loss-model` | `(admin)/loss-model/...` | REST |
| Salary group | `/admin/company/salaryGroup/...` (6 routes, in `Access\User\UserController`) | `users` (sub-resource) | `(admin)/companies/salary-groups/...` | REST |
| IoT / machine setup | `/admin/setupUnit`, `/admin/saveUnitEquipment`, `/admin/removeUnitEquipment`, `/admin/saveFilterTime`, `/admin/getSettingUnits`, `/admin/checkIotLatestVersion`, `/admin/showIotSoftwares`, `/admin/showIotSoftwareUpdateForm`, `/admin/saveIotSoftware`, `/admin/getSingleMachinealldetails`, `/admin/saveAutoRegistry`, `/admin/dbGetAltTable`, `/admin/saveCounterData`, `/admin/saveSignalToCounter`, `/admin/auto_stop_reg` (~15 routes) | `machines` (admin slice) + `iot-software` | `(admin)/iot/...`, `(admin)/machines/...` | REST |
| Boards (admin) | `/admin/board/...` (~15 routes) | `boards` (admin slice) | `(admin)/boards/...` | REST + `/widgets`, `/graph-widgets`, `/preview/:id` |
| Import/Export | `/admin/exportTemplate`, `/admin/importValidate`, `/admin/importTemplate`, `/admin/getProcessStatus` | `import-export` | `(admin)/import-export/page.tsx` | `POST /api/v1/import-export/validate`, `/run`, `GET /api/v1/import-export/templates/:type`, `GET /api/v1/import-export/jobs/:id` |
| Notification | `/admin/sendTestNotification` | `notifications` | admin tools | `POST /api/v1/notifications/test` |
| Search (admin) | `/admin/searchprogram` | `machine-files` (search slice) | embedded | `GET /api/v1/machine-programmes/search` |
| Misc | `/admin/users/save*Summary`, `/admin/updateImagePath`, `/admin/batchUpdateFlowDesign*`, `/admin/test`, `/admin/equipment/updateTreePos` | each respective module | — | summary endpoints; `/test` and `/updateImagePath` **DROP** as one-off scripts |
| Log viewer | `/admin/log-viewer/...` (9 routes) | — | — | **DROP** — replaced by Pino + Docker logs / Loki |

### 2.6 Admin access routes (`routes/Backend/Access.php`, 21 routes)

Standard `Route::resource('user', ...)` and `Route::resource('role', ...)` plus extras:

| Legacy URL | New endpoint | Next.js path |
|---|---|---|
| `/admin/access/user` (CRUD) | `GET/POST/PATCH/DELETE /api/v1/admin/users` | `(admin)/access/users/...` |
| `/admin/access/user/get` | `GET /api/v1/admin/users` (list w/ pagination) | client |
| `/admin/access/user/deactivated`, `…/deleted` | `GET /api/v1/admin/users?status=deactivated|deleted` | filter on list |
| `/admin/access/user/{user}/mark/{status}` | `PATCH /api/v1/admin/users/:id/status` | client |
| `/admin/access/user/{user}/password/change` | `POST /api/v1/admin/users/:id/password` | `(admin)/access/users/[id]/password/page.tsx` |
| `/admin/access/user/{user}/login-as` | `POST /api/v1/admin/users/:id/impersonate` | client |
| `/admin/access/user/{deletedUser}/delete` | `DELETE /api/v1/admin/users/:id?permanent=true` | client (with confirmation) |
| `/admin/access/user/{deletedUser}/restore` | `POST /api/v1/admin/users/:id/restore` | client |
| `/admin/access/account/confirm/resend/{user}` | `POST /api/v1/admin/users/:id/confirm/resend` | client |
| `/admin/access/role` (CRUD) | `GET/POST/PATCH/DELETE /api/v1/admin/roles` | `(admin)/access/roles/...` |

### 2.7 API routes (`routes/Api/api.php`, 47 declarations × mounted at both `/api` and `/api/v1`) (updated v2)

The same file is included twice in `routes.php`, mapping to namespaces `Api` and `Api\v1`. **B6 evidence (resolved):** the legacy Blade views and frontend JS make **zero calls to `/api/...`** (`grep -rn '/api/' resources/views/` returned nothing) — the API is exclusively consumed by IoT firmware (and possibly an unreleased mobile app). Since deployed IoT firmware can't be coordinated for a flag-day cutover, **both `/api/` and `/api/v1/` mounts are kept**, with v0 routes implemented as **thin shims that delegate to v1 services**. Concretely: each `/api/<endpoint>` controller method is a one-liner that calls into the same `*Service` class the `/api/v1/<endpoint>` controller calls. No business logic is duplicated. The shim layer lives in `backend/src/api-machine/v0/` and `backend/src/auth/v0/` and adds ~50 controller methods totalling ~150 lines.

| Legacy v1 URL | New endpoint | Module |
|---|---|---|
| `POST /api/v1/user/login` | `POST /api/v1/auth/login` (same JWT used as web) | `auth` |
| `POST /api/v1/user/logout` | `POST /api/v1/auth/logout` | `auth` |
| `POST /api/v1/user/getFlowMonitorlist` | `GET /api/v1/flow-monitor/list` | `flow-monitor` |
| `POST /api/v1/user/getFlowListById` | `GET /api/v1/flow-designs/:id` | `flow-design` |
| `POST /api/v1/user/getFlowListByEquipment` | `GET /api/v1/equipment/:id/flows` | `equipment` |
| `POST /api/v1/user/getShiftData` | `GET /api/v1/work-shifts` | `work-shifts` |
| `POST /api/v1/user/getShiftNameByTime`, `…getShiftTimeByName` | `GET /api/v1/work-shifts/by-time?at=…`, `…/by-name?name=…` | `work-shifts` |
| `POST /api/v1/user/getScheduleShiftByDate` | `GET /api/v1/shift-schedules?date=…` | `shift-schedules` |
| `POST /api/v1/user/getPartData`, `…getEquipmentPartData` | `GET /api/v1/parts`, `GET /api/v1/equipment/:id/parts` | `parts`, `equipment` |
| `POST /api/v1/user/getEquipmentOrderData` | `GET /api/v1/equipment/:id/orders` | `equipment` |
| `POST /api/v1/user/getScrapReasonData`, `…getStopReasonData` | `GET /api/v1/scrap-reasons`, `GET /api/v1/stop-reasons` | each |
| `POST /api/v1/user/saveProductionData`, `…saveScrapData`, `…saveStopData`, `…saveEquipmentStopData`, `…saveEquipmentStopDataV1`, `…saveEquipmentStopDataV2` | `POST /api/v1/production-data`, `POST /api/v1/scrap-data`, `POST /api/v1/stop-data`, `POST /api/v1/stop-data/equipment` | `production-data`, `scrap-data`, `stop-data` (consolidate the V1/V2 variants — pick V2 behaviour, document any V1-only fields kept for backward-compat) |
| `POST /api/v1/user/getLastFiveStops` | `GET /api/v1/stop-data?limit=5&order=-occurred_at` | `stop-data` |
| `POST /api/v1/user/updateProfile`, `…changePassword`, `…sendResetPwdOtp`, `…resetPassword`, `…updateFcmToken` | `PATCH /api/v1/me`, `POST /api/v1/auth/password/change`, `POST /api/v1/auth/password/forgot/otp`, `POST /api/v1/auth/password/reset/otp`, `POST /api/v1/me/fcm-token` | `users`, `auth` |
| `POST /api/v1/user/demoUserRegister`, `…sendRegistrationOtp`, `…verifyRegistaration` (sic) | `POST /api/v1/auth/register/demo`, `…/otp`, `…/verify` | `auth` |

#### Machine API (IoT — `routes/Api/api.php`)

| Legacy v1 URL | New endpoint | Module |
|---|---|---|
| `GET /api/v1/machine/test` | `GET /api/v1/iot/health` | `api-machine` |
| `POST /api/v1/machine/login` | `POST /api/v1/iot/auth/login` (issues device JWT, separate from user JWT) | `api-machine` |
| `POST /api/v1/machine/getMachineList` | `GET /api/v1/iot/machines` | `api-machine` |
| `POST /api/v1/machine/getMachineData` | `GET /api/v1/iot/machines/:id/data?status=unregistered` | `api-machine` |
| `POST /api/v1/machine/getConfiguredUnitsCount`, `…getConfiguredUnits` | `GET /api/v1/iot/units?count=true|false` | `api-machine` |
| `POST /api/v1/machine/installV1` | `POST /api/v1/iot/machines/install` | `api-machine` |
| `POST /api/v1/machine/saveStopDataV1` | `POST /api/v1/iot/machines/:id/stop-data` | `api-machine` |
| `POST /api/v1/machine/saveOfflineData` | `POST /api/v1/iot/machines/:id/offline-data` (bulk) | `api-machine` |
| `POST /api/v1/machine/getMachineStatus`, `…updateUnitConnectionStatus` | `GET /api/v1/iot/machines/:id/status`, `PATCH /api/v1/iot/units/:id/status` | `api-machine` |
| `POST /api/v1/machine/getMachineUserSettings`, `…updateMachineUserSettings`, `…saveUserUnitSettings`, `…saveUserNotificationSettings` | `GET/PATCH /api/v1/iot/machines/:id/user-settings` | `api-machine` |
| `POST /api/v1/machine/getProductionTime` | `GET /api/v1/iot/machines/:id/production-time` | `api-machine` |
| `POST /api/v1/machine/checkIotLatestVersion` | `GET /api/v1/iot/software/latest` | `api-machine` |
| `POST /api/v1/machine/getShiftSchedulesByDates` | `GET /api/v1/shift-schedules?from=…&to=…` | `shift-schedules` |

**All IoT endpoints use device-bound JWT (`POST /iot/auth/login` returns a long-lived token tied to a `tbl_machines.id`).** Throttling configured per-device (e.g. 600 req/min) — high enough for IoT polling but bounded.

### 2.8 Routes to drop entirely (updated v2)

- `/clear`, `/test`, `/tester`, `/admin/test`, `/admin/updateImagePath`, `/admin/batchUpdateFlowDesign*` (one-shot data fixes).
- `/admin/log-viewer/*` (9 routes) — replaced by container logs.
- ~~`/api/*` (v0 mount) — ports v1 only.~~ **REVERSED in v2:** v0 stays as a shim — see §2.7.
- Orphaned controller files: `MachineController_old.php`, `bk_machinecontrolller.php`, `Api/v1/MachineController copy.php` (do not migrate).

---

## 3. Controllers — domain split

The two god controllers must be split. Below is the explicit mapping from legacy method clusters → new NestJS controllers/services. Each new controller stays under 300 lines.

### 3.1 `Backend/DashboardController.php` (6,253 lines, 100+ methods) → 13 NestJS controllers

| New controller | Legacy methods absorbed |
|---|---|
| `EquipmentController` | `getEquipments`, `addEquipment`, `storeEquipment`, `editEquipment`, `updateEquipment`, `deleteEquipment`, `viewEquipment`, `statusEquipment`, `getEquipmentTree`, `updateTreePos`, `sortEquipments`, `view_equipment_modal`, `add_equipment_modal`, `updateEquipmentModal`, `del_folder_modal`, `getEquipmentsSummary`, `getChildEquipment`, `addEquipStopReason`, `addEquipScrapReason`, `addEquipPartType`, `addEquipOrderType`, `deleteEquipReason`, `getEquipmentStopReason`, `formEquipmentStopReason`, `saveEquipmentStopReason`, `deleteEquipmentStopReason`, `getEquipmentScrapReason`, `formEquipmentScrapReason`, `saveEquipmentScrapReason`, `deleteEquipmentScrapReason`, `saveEquipmentProperties`, `getEquipmentStopSummary`, `getEquipmentScrapSummary` |
| `FlowDesignController` | `test_flow`, `addFlowDesignTest`, `editFlowTest`, `editFlowDesignTest`, `editFlowName`, `changeFlowDesignStatus`, `deleteFlowDesign`, `flowMonitor` (admin), `flowAnalyzer` (admin), `getFlowAnalyzer`, `getLineChart`, `getQuantTimeGraph`, `getLossMonitor`, `uploadBgFlow`, `removeBgFlow`, `getFlowAnalyzerList`, `changeFlowAnalyzerListView`, `changeFlowMonitorListView`, `postShiftData`, `openScrapeForm`, `postScrapeData`, `openStopForm`, `postStopData`, `getWorkHours`, `postRegisterData`, `batchUpdateFlowDesign`, `batchUpdateFlowDesignTitle` |
| `PartsController` | `getParts`, `addPart`, `storePart`, `editPart`, `updatePart`, `statusPart`, `deletePart`, `getPartSummary` |
| `WorkShiftController` | `getWorkShifts`, `addWorkShift`, `storeWorkShift`, `editWorkShift`, `updateWorkShift`, `statusWorkShift`, `deleteWorkShift`, `getShiftSummary` |
| `TypeController` | `getTypes`, `addType`, `storeType`, `editType`, `updateType`, `statusType`, `deleteType`, `viewType`, `getTypeSummary` |
| `MachineController` | `getMachine`, `addMachine`, `storeMachine`, `editMachine`, `updateMachine`, `deleteMachine`, `statusMachine`, `viewMachine`, `MachineAssign` |
| `MachineDocumentsController` (v2 rename per A1 — was `MachineFilesController`) | `download_file`, `edit_file_modal`, `update_file_detail`, `getFolderAjax`, `getFileTree`, `storeNewFile`, `deleteFolderFile`, `statusFolderFile`, `deleteTrash`, `deletedFileLog`, `lockedFileLog`, `getFile`, `getFolder`, `addFolder`, `storeFolder`, `editFolder`, `updateFolder`, `statusFolder`, `viewFolder` |
| `ResultController` (read-only DataTables) | `getResultProduction`, `formResultProduction`, `saveResultProduction`, `deleteResultProduction`, `getResultScrapData`, `formResultScrapData`, `saveResultScrapData`, `deleteResultScrapData`, `getResultStopData`, `formResultStopData`, `saveResultStopData`, `deleteResultStopData`, `getProductionSummary`, `getResultScrapSummary`, `getResultStopSummary` |
| `CompanyController` | `getCompany`, `statusCompany`, `viewCompany`, `getCompanyUser`, `addCompanyUser`, `storeCompanyUser`, `editCompanyUser`, `updateCompanyUser`, `deleteCompanyUser`, `statusCompanyUser`, `viewCompanyUser`, `getCompanyUserSummary`, `password_match` |
| `CmsController` | `getCms`, `addCms`, `storeCms`, `editCms`, `updateCms`, `statusCms`, `deleteCms`, `getCmsImage`, `postCmsImage`, `deleteCmsImage`, `getSocial`, `socialUpdate` |
| `MachineProgrammeController` | `getMachineProgramme`, `addProgramme`, `storeProgramme`, `editProgramme`, `updateProgramme`, `deleteProgramme`, `statusProgramme`, `viewProgramme`, `deleteProgrammeFile` |
| `WorkstationController` | `getWorkStation`, `addWorkStation`, `storeWorkStation`, `editWorkStation`, `updateWorkStation`, `statusWorkStation`, `deleteWorkStation` |
| `SliderController`, `TestimonialController` | `getSliders`, `getSlidersStatus`, `getSlidersDelete`, `postSliderSaveFirst`, `getSliderEditForm`, `postSliderSave`; `getTestimonial`, `addTestimonial`, `storeTestimonial`, `editTestimonial`, `updateTestimonial`, `statusTestimonial`, `deleteTestimonial` |
| `StopCategoryController` | `stopCategoryForm`, `saveStopCategory` |
| `DashboardController` (small, just for `GET /api/v1/admin/dashboard`) | `index`, `getReportData`, `getRepData`, `saveTableSettings`, `updateImagePath` (drop), `test` (drop) |

### 3.2 `Frontend/CompanyUserController.php` (2,284 lines) → 7 NestJS controllers

| New controller | Legacy methods |
|---|---|
| `FlowAnalyzerController` (user) | `flowAnalyzer`, `getFlowAnalyzer`, `getLineChart`, `getQuantTimeGraph`, `getFlowAnalyzerList`, `changeFlowAnalyzerListView`, `getStopAnalyzeData`, `getScrapAnalyzeData`, `getProductionAnalyzeData` |
| `FlowMonitorController` (user) | `getFlowMonitor`, `getLossMonitor`, `postShiftData`, `openScrapeForm`, `postScrapeData`, `openStopForm`, `postStopData`, `getWorkHours`, `postRegisterData`, `getFlowMonitorList`, `getFlowMonitorListImg`, `changeFlowMonitorListView`, `getLossMonitorProductionForm`, `getLossMonitorScrapForm`, `getLossMonitorStopForm` |
| `MachineDocumentsController` (user, v2 rename per A1) | `getMachines`, `uploadMachineProgrmFile`, `getMachineAjax`, `download_file`, `uploadProgrmFiles`, `WhoDownload`, `deleteFolderFile`, `lockFolderFile` |
| `EquipmentModalController` (user) | `view_equipment_modal`, `edit_equipment_icon` |
| `UnitsController` (user) | `getUnitStopSaveDlg`, `saveUnitStopData`, `updateMachineStatus`, `getMachineStatus` (these wrap IoT endpoints; the read-only `units`, `getUnits`, `getUnitStopData`, `getUnitShiftSelectDlgContent` come from `User\DashboardController`) |
| `AuthSupportController` | `password_match`, `tester` (drop) |

### 3.3 `Api/v1/ApiController.php` (1,553 lines) and `Api/v1/MachineController.php` (1,174 lines)

These split into the same domain controllers above (`production-data`, `scrap-data`, `stop-data`, `flow-monitor`, `flow-design`, `parts`, `work-shifts`, `equipment`, `users`, `auth`, `me`) for the user API, and into the dedicated `api-machine` module for IoT.

### 3.4 Other backend controllers (small)

| Legacy | New |
|---|---|
| `Backend/OrderController.php` | `OrdersController` (in `orders` module) |
| `Backend/BoardController.php` | `BoardsController`, `WidgetsController` (in `boards` module) |
| `Backend/ShiftScheduleController.php` | `ShiftSchedulesController` (in `shift-schedules` module) |
| `Backend/SymbolController.php` | `SymbolsController` (in `symbols` module) |
| `Backend/LossModelController.php` | `LossModelController` (in `loss-model` module) |
| `Backend/WarningDataController.php` | `WarningDataController` (in `warning-data` module) |
| `Backend/ExportAndImportController.php` | `ImportExportController` (in `import-export` module, BullMQ-backed) |
| `Backend/NotificationController.php` | `NotificationsController` (in `notifications` module) |
| `Backend/SearchController.php`, `Frontend/SearchController.php` | folded into respective domain modules — do not create a generic search service |
| `Frontend/FrontendController.php` | `cms` module (`PagesController`, `ContactController`) |
| `Frontend/Auth/AuthController.php`, `PasswordController.php` | `auth` module (`AuthController`, `PasswordController`, `OAuthController`) |
| `Frontend/User/DashboardController.php` | parts of: `dashboard`, `users` (`MeController`), and the various `*-data` modules |
| `Frontend/User/ProfileController.php` | `MeController` (in `users`) |
| `Frontend/FeedbackController.php` | `FeedbackController` (in `feedback`) |
| `Backend/Access/User/UserController.php` | `AdminUsersController` (in `users`); `salaryGroup*` methods → `SalaryGroupsController` |
| `Backend/Access/Role/RoleController.php` | `AdminRolesController` (in `users` or `auth`) |
| `Backend/UserController.php` | `userGroupSummary` → `AdminUsersController.summary()` |

---

## 4. Models → Prisma schema (updated v2)

The legacy app has **57 model files**, of which ~10 are `Access/` traits (relationship/attribute mixins). The 47 actual model classes map to **47 Prisma models** in v2 (the `User`/`Users` duplication consolidates to one; `Objects` is dropped per B1 — only a dead import; `Machines` is renamed to `MachineDocument` per A1).

### 4.1 Schema strategy

- **One Prisma `schema.prisma`**, `previewFeatures = ["multiSchema"]`.
- **`public` schema** (platform-wide): `User`, `Role`, `Permission`, `RolePermission`, `UserRole`, `SocialLogin`, `Cms`, `CmsImage`, `Slider`, `Testimonial`, `SiteSetting`, `History`, `HistoryType`, `Tenant` (new — represents a company), `TenantUser` (new — many-to-many user↔tenant link).
- **`tenant_template` schema** (cloned for each new tenant): everything else — equipment, machines, production data, flow designs, etc.
- New tenants get their schema by cloning `tenant_template` (sequence: `CREATE SCHEMA "tenant_<id>"; CREATE TABLE "tenant_<id>".x (LIKE "tenant_template".x INCLUDING ALL);` per table). Wrapped as a Prisma raw migration script invoked by the `tenants` module.

### 4.2 Naming (updated v2)

- Drop `tbl_` prefix consistently. `tbl_machines` → `Machine` model on table `machines` (with `@@map("machines")`).
- Plural Eloquent class names with awkward grammar normalized: `Equipments` → `Equipment`, `Parts` → `Part`, `Types` → `Type`, `Symbols` → `Symbol`.
- **A1 (v2) — collision-prone `Machines` rename:** legacy has two distinct concepts both colliding around the word "machine":
  - legacy `tbl_machines` (the IoT unit) → Prisma model **`Machine`**, table `machines` (`@@map("machines")` — drops `tbl_` prefix). Replaces the legacy `machines` table at the same name; legacy data is renamed in the migration script.
  - legacy `machines` (the file-manager *document* — one row per logical document attached to an equipment) → Prisma model **`MachineDocument`**, table `machine_documents`.
  - legacy `machine_files` (file *versions* attached to a `MachineDocument`) → Prisma model **`MachineDocumentFile`**, table `machine_document_files`.
  - Old idea (v1) of using `MachineFile` for both was rejected per A1: too easy to confuse "file-manager row" vs "actual file version".
- Where the legacy DB is migrated rather than rebuilt, table names are preserved via `@@map` so existing data flows in untouched (the `tbl_machines` data lands in `machines`; the legacy `machines` data lands in `machine_documents` after a one-shot table rename in the migration script).

### 4.3 Model-by-model mapping

| Legacy model (file → table) | New Prisma model (schema, mapped table) | Notes / FKs to add |
|---|---|---|
| `Access/User/User.php` & `Users.php` → `users` | `User` (public, `users`) | Consolidate. Add `email_verified_at`, `confirmation_code`, `confirmed`, `status`, `session_timeout`, `table_settings (Json)`, `tenant_id` columns observed via controllers. SoftDeletes. |
| `Access/User/SocialLogin.php` → `social_logins` | `SocialLogin` (public) | FK `user_id → User` |
| `Access/Role/Role.php` → `roles` | `Role` (public) | M:N `User` via `UserRole` |
| `Access/Permission/Permission.php` → `permissions` | `Permission` (public) | M:N `Role` via `RolePermission` |
| (none — config-driven) | `RolePermission`, `UserRole` | New explicit join tables. |
| `History/History.php` → `history` | `History` (public) | FK `user_id → User`, `type_id → HistoryType` |
| `History/HistoryType.php` → `history_types` | `HistoryType` (public) | |
| `Cms.php` → `cms` | `Cms` (public) | hasMany `CmsImage` |
| `CmsImage.php` → `cms_images` | `CmsImage` (public) | FK `cms_id → Cms`, SoftDeletes |
| `Slider.php` → `sliders` | `Slider` (public) | |
| `Testimonial.php` → `testimonials` | `Testimonial` (public) | |
| `SiteSettings.php` → `site_settings` | `SiteSetting` (public) | key/value |
| ~~(new) `Tenant`~~ | **REMOVED 2026-05-14** — see §13 entry 32. Schema name is now derived from the Company user's id; `timezone` moved to `User.timezone`. |
| ~~(new) `TenantUser`~~ | **REMOVED 2026-05-14** — see §13 entry 32. Single-tenant: `User.companyId` points at the Company user's id. |
| `Equipments.php` → `equipments` | `Equipment` (tenant_template) | Self-FK `parent_id`, FK `type_id → EquipmentType`. Index on `parent_id`, `type_id`, `status`, `sort_order`. |
| `EquipmentType.php` → `equipment_type` | `EquipmentType` (tenant_template) | Self-FK `parent_id` |
| `EquipmentProperty.php` → `equipment_properties` | `EquipmentProperty` (tenant_template) | FK `equipment_id` |
| `EquipmentOrder.php` → `equipment_orders` | `EquipmentOrder` (tenant_template) | SoftDeletes |
| `EquipmentPart.php` → `equipment_parts` | `EquipmentPart` (tenant_template) | SoftDeletes |
| `EquipmentShiftSchedule.php` → `equipment_shift_schedule` | `EquipmentShiftSchedule` (tenant_template) | timestamps off in legacy → keep that column choice |
| `EquipmentScrapReason.php` → `equipment_scrap_reasons` | `EquipmentScrapReason` (tenant_template) | FK `equipment_id`, `part_id` |
| `EquipmentStopReason.php` → `equipment_stop_reasons` | `EquipmentStopReason` (tenant_template) | FK `equipment_id`, `part_id` |
| `UserEquipments.php` → `user_equipments` | `UserEquipment` (tenant_template — references public.User by id) | Cross-schema FK |
| `Machine/Machine.php` → `tbl_machines` | `Machine` (tenant_template, `machines`) | FK `equipment_id` |
| `Machine/MachineData.php` → `tbl_machine_data` | `MachineData` (tenant_template, `machine_data`) | FK `machine_id`. Likely the highest-volume table — partition by date if rows > 10M (defer until perf data available). |
| `Machine/MachinePrevStart.php` → `tbl_machine_previous_starts` | `MachinePrevStart` (tenant_template, `machine_previous_starts`) | FK `equipment_id` |
| `Machine/MachineStatus.php` → `tbl_machine_status` | `MachineStatus` (tenant_template, `machine_status`) | |
| `Machine/MachineUserSetting.php` → `tbl_machine_user_settings` | `MachineUserSetting` (tenant_template, `machine_user_settings`) | FK `machine_id` |
| `Machines.php` → `machines` | **`MachineDocument`** (tenant_template, `machine_documents`) — A1 rename | FK `equipment_id`, `folder_id` |
| `MachineFiles.php` → `machine_files` | **`MachineDocumentFile`** (tenant_template, `machine_document_files`) — A1 rename | FK `machine_document_id`. User snapshot fields `uploaded_by_user_id`/`uploaded_by_email`/`uploaded_by_name` and `locked_by_user_id`/`locked_by_email`/`locked_by_name` (per A5 — no cross-schema FK). |
| `MachineProgramme.php` → `machine_programme` | `MachineProgramme` (tenant_template) | |
| `MachineProgrammeFiles.php` → `machine_programme_files` | `MachineProgrammeFile` (tenant_template) | FK `programme_id`, `user_id` |
| `MachineAssign.php` → `equipment_assign` | `MachineAssignment` (tenant_template, `machine_assignments`) | FK `user_id`, `machine_id` |
| `ProductionData.php` → `production_data` | `ProductionData` (tenant_template) | FK `flow_id`, `flow_object_key (= equipment_id)`, `part_id`, `work_shift_id`, `created_by`. SoftDeletes. Index all FKs + `created_at`, `(flow_id, work_shift_id, created_at)` composite. **Note:** legacy uses `flow_object_key` not `equipment_id` for the equipment FK — verified in source. |
| `ScrapData.php` → `scrap_data` | `ScrapData` (tenant_template) | Same FKs as ProductionData + `reason_id`, `type_id`. SoftDeletes. |
| `StopData.php` → `stop_data` | `StopData` (tenant_template) | Same FKs + `reason_id`, `type_id`. SoftDeletes. |
| `WarningData.php` → `tbl_warning_data` | `WarningData` (tenant_template, `warning_data`) | FK `equipment_id` |
| `Order.php` → `tbl_orders` | `Order` (tenant_template, `orders`) | **B2 finding (v2):** confirmed columns `id, status, type_id, order_nr, description, flow_id, equip_id, part_id, start_date, end_date, planned_qty, ok_qty, scrap_qty, planned_hrs, worked_hrs, remaining_qty, remaining_hrs, sort_order, created_at, updated_at, deleted_at`. FKs: `type_id → Type`, `flow_id → FlowDesign`, `equip_id → Equipment`, `part_id → Part`. Unique on `(tenant_id, order_nr)` (legacy enforces unique on order_nr in OrderController validation). SoftDeletes. v2 indexes: `type_id`, `flow_id`, `equip_id`, `part_id`, `(start_date, end_date)`, GIN trigram on `(order_nr, description)` for autocomplete (A7). **R2 (v3) — column rename: legacy `equip_id` → Prisma `equipment_id` (DB column `equipment_id`).** This is a *rename*, not a passthrough. The Phase 6 migration script must explicitly map `tbl_orders.equip_id → orders.equipment_id`; do not rely on column-name-equals copying. The same rename applies wherever legacy uses `equip_id` (also `tbl_machines.equip_id`, `equipment_properties.equip_id`, `tbl_warning_data.equip_id` — see `legacy-schema.json` `discrepancies.naming_inconsistencies`). |
| `Parts.php` → `parts` | `Part` (tenant_template) | FK `type_id` |
| `Types.php` → `types` | `Type` (tenant_template) | hasMany ScrapReason, StopReason, Part |
| `ScrapReason.php` → `scrap_reasons` | `ScrapReason` (tenant_template) | FK `type_id`. SoftDeletes. |
| `StopReason.php` → `stop_reasons` | `StopReason` (tenant_template) | FK `type_id`. SoftDeletes. |
| `StopCategory.php` → `stop_category` | `StopCategory` (tenant_template) | SoftDeletes |
| `FlowDesigns.php` → `flow_designs` | `FlowDesign` (tenant_template) | hasMany FlowDesignAttribute. SoftDeletes. |
| `FlowDesignAttributes.php` → `flow_design_attributes` | `FlowDesignAttribute` (tenant_template) | FK `flow_design_id`, `equipment_id` |
| `WorkShift.php` → `work_shifts` | `WorkShift` (tenant_template) | SoftDeletes |
| `ShiftSchedule.php` → `tbl_shift_schedules` | `ShiftSchedule` (tenant_template, `shift_schedules`) | SoftDeletes |
| `ShiftScheduleData.php` → `tbl_shift_schedule_data` | `ShiftScheduleDataEntry` (tenant_template, `shift_schedule_data`) | FK `schedule_id` |
| `WorkStation.php` → `work_station` | `Workstation` (tenant_template, `workstations`) | FK `machine_id` |
| `Dashboard.php` → `dashboards` | `Board` (tenant_template, `dashboards`) — renamed to match user-facing terminology | FK `created_by` |
| `DashboardWidget.php` → `dashboard_widgets` | `BoardWidget` (tenant_template, `dashboard_widgets`) | FK `dashboard_id`. SoftDeletes. |
| `Folders.php` → `folders` | `Folder` (tenant_template) | FK `equipment_id`, `type_id` |
| `UserFileLocks.php` → `user_file_locks` | `UserFileLock` (tenant_template) | FK `machine_file_manager_id`, `machine_file_version_id`, `user_id` |
| `CompanyMachine.php` → `company_machine` | `TenantMachine` (tenant_template, `tenant_machines`) — name reflects new tenant terminology | FK `programme_id` |
| `Symbols.php` → `symbols` | `Symbol` (tenant_template) | |
| `SalaryGroup.php` → `salary_group` | `SalaryGroup` (tenant_template) | SoftDeletes |
| `Feedback.php` → `tbl_feedbacks` | `Feedback` (tenant_template, `feedbacks`) | SoftDeletes |
| `DelayNotification.php` → `tbl_delay_notifications` | drop the table, replace with **BullMQ** delayed job queue | the legacy table was a poor man's queue — BullMQ handles delays natively |
| ~~`Objects.php` → `objects`~~ | **DROPPED in v2** (per B1) | The only reference outside the model file is a dead `use App\Models\Objects;` import in `Backend/DashboardController.php:20` — no instantiation, no query, no relation. The `objects` table contents (id, name, image, status, timestamps) are not referenced by any active code. Confirmed safe to drop both the model and the table. |

### 4.4 Soft-delete handling (updated v2 per A2)

**Decision: no global Prisma `$extends` middleware.** Prisma's middleware has known sharp edges with `findUnique`, raw queries, nested writes, and "include deleted rows" debugging. Replaced with explicit per-service helpers:

- Each soft-deletable model has a `deletedAt DateTime?` field (camelCase Prisma, `deleted_at` in DB via `@map`).
- Each service exposes:
  ```ts
  // backend/src/common/soft-delete.ts
  export const notDeleted = () => ({ deletedAt: null });

  // typical service usage
  this.prisma.equipment.findMany({ where: { ...notDeleted(), tenantId } });
  this.prisma.equipment.update({ where: { id }, data: { deletedAt: new Date() } }); // soft delete
  ```
- "Include deleted" is opt-in: each service method accepts an optional `{ includeDeleted?: boolean }` flag that omits the `deletedAt: null` filter when true. Never automatic.
- `softDelete(id)` and `restore(id)` helpers on each service — not generic, written once per model so they can also clean up tenant-specific bookkeeping (e.g. cascade soft-delete on `equipment_stop_reasons` when an `equipment` is soft-deleted).

The 14 soft-deletable Prisma models (those marked SoftDeletes in §4.3): `User`, `CmsImage`, `Equipment`, `EquipmentOrder`, `EquipmentPart`, `EquipmentScrapReason`, `EquipmentStopReason`, `MachineDocument`, `MachineDocumentFile`, `ProductionData`, `ScrapData`, `StopData`, `Order`, `Part`, `Type`, `ScrapReason`, `StopReason`, `StopCategory`, `FlowDesign`, `WorkShift`, `ShiftSchedule`, `BoardWidget`, `SalaryGroup`, `Feedback`, `EquipmentAssign`. (That's actually 25 — recount during Phase 2.)

### 4.5 Roles & permissions (updated v2 per B3)

**B3 finding:** the legacy app enforces only **THREE distinct permissions** anywhere:

| Permission name | Display name | Enforced at |
|---|---|---|
| `view-backend` | View Backend | global on every `/admin/*` route via `app/Http/Kernel.php:45` |
| `manage-users` | Manage Users | `routes/Backend/Access.php:13` (the user CRUD group) |
| `manage-roles` | Manage Roles | `routes/Backend/Access.php:62` (the role CRUD group) |

That is the entire enforced permission inventory in the legacy app. There are NO other `routeNeedsPermission:` or `routeNeedsRole:` calls anywhere in `routes/` or `app/Http/`. (Verified via `grep -rn "routeNeedsPermission\|routeNeedsRole" routes/ app/Http/`.)

**Roles (seeded from production master `roles` table):**

| id | name | `all` | sort | meaning |
|---|---|---|---|---|
| 1 | Administrator | 1 | 1 | Super-admin shortcut: `all=1` means has every permission. |
| 2 | Company | 0 | 2 | Tenant admin — assigned `view-backend` and `manage-users` per `permission_role` data. |
| 3 | User | 0 | 3 | Factory operator. Default role per `config/access.php` (`'default_role' => 'User'`). |

**v2 permission expansion (trimmed v3 per R1):** The legacy permission set is laughably thin given the surface area. v3 seeds **26 permissions** at first run — broader than legacy, narrower than the v2 first-pass list. Guiding rule: don't gate "viewing" things every authenticated tenant member can already see (that's tenant membership, not permission). Don't over-fragment (e.g. one permission per machine sub-feature). Split is per write-verb-per-module *only where a real role distinction exists*.

| # | name | display |
|---|---|---|
| 1 | `view-backend` | View Backend (legacy) |
| 2 | `manage-users` | Manage Users (legacy) |
| 3 | `manage-roles` | Manage Roles (legacy) |
| 4 | `manage-tenants` | Manage Tenants (super-admin) |
| 5 | `impersonate-users` | Impersonate Users (super-admin) |
| 6 | `manage-equipment` | Manage Equipment |
| 7 | `manage-flow-designs` | Manage Flow Designs (incl. Symbols) |
| 8 | `manage-parts` | Manage Parts |
| 9 | `manage-orders` | Manage Orders |
| 10 | `manage-work-shifts` | Manage Work Shifts |
| 11 | `manage-shift-schedules` | Manage Shift Schedules |
| 12 | `manage-machines` | Manage Machines (collapsed: includes IoT machines + machine documents + machine programmes) |
| 13 | `manage-folders` | Manage File Folders |
| 14 | `manage-workstations` | Manage Workstations |
| 15 | `manage-types` | Manage Types |
| 16 | `manage-stop-reasons` | Manage Stop Reasons (incl. Stop Categories) |
| 17 | `manage-scrap-reasons` | Manage Scrap Reasons |
| 18 | `manage-cms` | Manage CMS (incl. Sliders, Testimonials) |
| 19 | `manage-feedback` | Manage Feedback |
| 20 | `manage-warning-data` | Manage Warning Data |
| 21 | `manage-loss-model` | Manage Loss Model |
| 22 | `manage-import-export` | Manage Import/Export |
| 23 | `send-notifications` | Send Notifications |
| 24 | `write-production-data` | Write Production Data |
| 25 | `write-scrap-data` | Write Scrap Data |
| 26 | `write-stop-data` | Write Stop Data |

R1 deltas vs v2 first-pass:
- Dropped `view-flow-monitor`, `view-flow-analyzer`, `view-units`, `view-boards` — viewing those is gated by tenant membership, not permission. Adding "view" perms for things every authenticated tenant member can see is bureaucracy.
- Collapsed `manage-machines` + `manage-machine-documents` + `manage-machine-programmes` → single `manage-machines`. One feature area, one permission. Split later if a real role distinction emerges.
- Added `manage-folders` (was missing in v2).
- Folded `manage-symbols` into `manage-flow-designs` (symbols are flow-diagram assets).
- Folded `manage-stop-categories` into `manage-stop-reasons`.
- Folded `manage-sliders` + `manage-testimonials` into `manage-cms`.
- Dropped `view-production-data` / `view-scrap-data` / `view-stop-data` — by the same "tenant membership = view" logic; kept the `write-*` distinction because operator-vs-auditor is a real role split.

Seeded in `prisma/seed.ts` on first run (idempotent: `INSERT ... ON CONFLICT DO NOTHING`). Default role-permission mapping:

- **Administrator** → all 26 permissions (`all=true` shortcut bypasses lookup, but for safety we also seed every permission against role 1).
- **Company** (tenant admin) → `view-backend`, `manage-users`, `manage-equipment`, `manage-flow-designs`, `manage-parts`, `manage-orders`, `manage-work-shifts`, `manage-shift-schedules`, `manage-machines`, `manage-folders`, `manage-workstations`, `manage-types`, `manage-stop-reasons`, `manage-scrap-reasons`, `manage-cms`, `manage-feedback`, `manage-warning-data`, `manage-loss-model`, `manage-import-export`, `send-notifications`, `write-production-data`, `write-scrap-data`, `write-stop-data` (23 of 26 — excludes `manage-roles`, `manage-tenants`, `impersonate-users`).
- **User** (factory operator) → `write-production-data`, `write-scrap-data`, `write-stop-data` (3 of 26 — read access to flow monitor/analyzer/units/boards/orders/equipment is via tenant membership, not permission).

The seeded super-admin user from env (`SEED_SUPERADMIN_EMAIL`) gets the **Administrator** role.

### 4.6 Partitioning (NEW v2 per A3)

`tbl_machine_data` (renamed `machine_data` in v2) is the highest-volume table — IoT devices write start/end timestamp pairs at high frequency. Decision: **partition by `start_time` monthly** using PostgreSQL native declarative partitioning, configured at table creation, **not retrofitted later**.

```sql
CREATE TABLE tenant_template.machine_data (
  id bigserial,
  machine_id int NOT NULL,
  start_time timestamptz,
  end_time timestamptz,
  is_registered text NOT NULL DEFAULT 'no',  -- enum-mapped at the Prisma level
  is_valid_data boolean NOT NULL DEFAULT true,
  production_time text,
  PRIMARY KEY (id, start_time)               -- partition key must be in PK
) PARTITION BY RANGE (start_time);

CREATE TABLE tenant_template.machine_data_2026_05 PARTITION OF tenant_template.machine_data
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE tenant_template.machine_data_2026_06 PARTITION OF tenant_template.machine_data
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
-- … plus default partition for safety:
CREATE TABLE tenant_template.machine_data_default PARTITION OF tenant_template.machine_data DEFAULT;
```

When a new tenant schema is cloned from `tenant_template`, the partitioned table structure is preserved (Postgres allows `CREATE TABLE LIKE … INCLUDING ALL` to clone a partitioned parent + its child partitions, but each tenant gets its OWN partition tree under `tenant_<id>.machine_data`).

**Maintenance job:** `partition-maintenance` BullMQ scheduled cron, fires on day 25 of each month at 02:00 UTC. Per tenant schema:

1. Create next-month partition if it doesn't exist (`CREATE TABLE IF NOT EXISTS …_<yyyy>_<mm> PARTITION OF …`).
2. If `MACHINE_DATA_RETENTION_MONTHS` env var > 0, detach (don't drop) partitions older than that. Detached partitions can be dropped manually after backup.

Configurable env vars added to §12: `MACHINE_DATA_RETENTION_MONTHS=24` (default 24 months, 0 = keep forever), `MACHINE_DATA_PARTITION_BUFFER=2` (months to maintain ahead of current).

**Why now, not later:** Switching the partition key on a table with millions of rows means rewriting every row. Picking `start_time` up front costs nothing if data volume is low; rescues us if it grows. Other candidate keys considered and rejected: `machine_id` (doesn't help with retention), `is_registered` (only two-three values, useless for partitioning), `id` (doesn't help with retention either).

---

## 5. Middleware → NestJS guards & interceptors (updated v2)

**Auth strategy duality (A4) recap:** two Passport strategies registered, two guards.

- `JwtCookieStrategy` reads JWT from the `access_token` cookie (httpOnly, Secure, SameSite=Lax, Path=/).
- `JwtBearerStrategy` reads JWT from the `Authorization: Bearer …` header.
- `JwtAuthGuard` accepts EITHER (used by all `/api/v1/*` routes consumed by both web and mobile/IoT — production-data write API, etc.).
- `IotAuthGuard` accepts ONLY `JwtBearerStrategy` AND additionally validates the `device_id` claim against a `tbl_machines` row (used by `/api/v1/iot/*` and `/api/iot/*` shim routes).
- Web tokens signed with `JWT_ACCESS_SECRET` (15 min) + refresh with `JWT_REFRESH_SECRET` (7 days).
- IoT tokens signed with `JWT_DEVICE_SECRET` (365 days, single token, no refresh — devices re-login on token expiry).

| Legacy middleware | New | Notes |
|---|---|---|
| `Authenticate` (web) | `JwtAuthGuard` (cookie-or-bearer) on every protected route | Replaces session-based `auth`. |
| `RouteNeedsRole:Admin\|Manager` | `RolesGuard` + `@Roles('Admin', 'Manager')` decorator | Same pipe-separated semantics. |
| `RouteNeedsPermission:manage-users` | `PermissionsGuard` + `@Permissions('manage-users')` decorator | |
| `SessionTimeout` (5 min) | **Dropped** — replaced by 15 min access token + 7 day refresh token | Per prompt — 5 min is hostile UX for shop floor. |
| `LocaleMiddleware` | NestJS `LocaleInterceptor` reads `Accept-Language` header (set by next-intl on frontend); falls back to `sv` | |
| `EncryptCookies`, `VerifyCsrfToken`, `StartSession`, `ShareErrorsFromSession`, `AddQueuedCookies` | **Dropped** — not relevant in the JWT/REST world | CSRF protection comes from SameSite cookie + custom header check. |
| `RedirectIfAuthenticated` (`guest`) | Frontend handles in middleware (`middleware.ts` redirects authenticated users away from `/login`) | |
| `TrustProxies` | Express `trust proxy` setting + `X-Forwarded-*` parsing | Same role. |
| `CheckForMaintenanceMode` | `MaintenanceGuard` driven by env var `MAINTENANCE_MODE=true` | |
| `ThrottleRequests` (commented out!) | `@nestjs/throttler` configured globally + per-controller overrides | API: 60 req/min default; IoT: 600 req/min per device; auth: 5 req/min. |

Plus new pieces:

| New piece | Purpose |
|---|---|
| `TenantInterceptor` | Reads `tenant_id` claim from JWT, sets `search_path` on the `PrismaService` for the duration of the request. Rejects any request whose user doesn't belong to the requested tenant. |
| `AuditInterceptor` | Replaces `UserEventListener` / `RoleEventListener` — emits NestJS events that get persisted to `history`. |
| `RecaptchaGuard` | Server-side reCAPTCHA v3 verification for contact form, register, password reset. |

---

## 6. Jobs / events / listeners → BullMQ + NestJS events

| Legacy | New | Notes |
|---|---|---|
| `App\Jobs\UpdateMachineStartStatusV1` | BullMQ `machine-start-status` queue + processor | Port V1 only; drop V0. |
| `App\Jobs\UpdateMachineStopStatusV1` | BullMQ `machine-stop-status` queue + processor | Includes warning creation + FCM. |
| Database queue (`jobs`/`failed_jobs` tables) | Redis-backed BullMQ. **Bull Board UI is OFF in production** (A10) — only mounted at `/admin/queues` when env `BULLBOARD_ENABLED=true`. Operators run Bull Board locally with port-forwarding (`kubectl port-forward` or `docker exec -it backend node …`) when they need it. The default `docker-compose.server.yml` does NOT set this var. | Same security posture as our drop of `arcanedev/log-viewer`: keep operational UIs off the internet. |
| `App\Events\Frontend\Auth\UserLoggedIn` etc. (4 frontend auth events) | NestJS `EventEmitter` — `auth.user.loggedIn`, `auth.user.loggedOut`, `auth.user.registered`, `auth.user.confirmed` | Consumed by `AuditService.logAuthEvent`. |
| `App\Events\Backend\Access\User\*` (8 events) | NestJS events `user.created`, `user.updated`, `user.deleted`, `user.restored`, `user.permanentlyDeleted`, `user.passwordChanged`, `user.deactivated`, `user.reactivated` | Consumed by `AuditService.logUserEvent`. |
| `App\Events\Backend\Access\Role\*` (3 events) | `role.created`, `role.updated`, `role.deleted` | Same audit listener. |
| `App\Listeners\…\UserEventListener` (frontend + backend) | `AuditService` (single class) writes to `history` table | Replaces 3 listener classes with one service. |
| `App\Listeners\…\RoleEventListener` | merged into `AuditService` | |
| `tbl_delay_notifications` (poor-man's queue) | BullMQ delayed jobs | Drop the table after migrating in-flight rows to the queue. |
| FCM send (`FcmNotification`) | `firebase-admin` npm in `notifications` module, called from queue processors | |

---

## 7. Helpers / services / repositories / imports

| Legacy | New |
|---|---|
| `app/helpers.php` (autoloaded global helpers) | One-off TS helpers placed in `backend/src/common/helpers/*.ts` (no globals — explicit imports). |
| `app/Lib/CommonFunc.php` (DB switching + table settings + shift calc + FCM + filter queries) | Split into: `PrismaService` (tenant `search_path`), `UserPreferencesService` (table settings), `WorkShiftService.getShiftByTime/getShiftHours`, `ProductionTimeCalculator`, `NotificationsService.send`, query builders inlined into each controller's service. |
| `app/Lib/CopyBasicData.php` (clone template data into new company DB) | `TenantsService.provisionFromTemplate(tenantId)` — runs the schema-clone DDL plus copies seed data from `tenant_template` rows. |
| `app/Lib/FcmNotification.php` | `NotificationsService` using `firebase-admin`. |
| `app/Lib/FileUtility.php` (path helpers) | `FileStorageService` abstraction over `@aws-sdk/client-s3` (prod) / local disk driver (dev). |
| `app/Services/Access/Access.php` (facade) | `AuthorizationService` — `hasRole()`, `hasPermission()`, exposed as `Auth::can` decorators in NestJS. |
| `app/Services/Access/Traits/UseSocialite.php` | `OAuthService` with NestJS Passport strategies. |
| `app/Services/Macros/Dropdowns.php` (countries, US states, etc.) | Static JSON in `frontend/src/lib/static/dropdowns.json` (frontend-only data, no backend involvement). |
| `app/Repositories/Backend/Access/User/EloquentUserRepository.php` | `UsersService` (in `users` module). The `CreateDatabase()` cPanel call is replaced by `TenantsService.provisionFromTemplate`. |
| `app/Repositories/Backend/Access/Role/EloquentRoleRepository.php` | `RolesService`. |
| `app/Repositories/Backend/History/EloquentHistoryRepository.php` | `AuditService`. |
| `app/Repositories/Frontend/Access/User/EloquentUserRepository.php` | `MeService` in the `users` module. |
| `app/Http/Controllers/Frontend/CommonClass.php` (cPanel `xmlapi`, hardcoded `root:pc-11`) | **Deleted entirely**. Replaced by `TenantsService.provisionFromTemplate`. The hardcoded credentials must be considered compromised and rotated regardless of migration. |
| `app/Http/Controllers/Frontend/BackOfficeFunction.php` (dual-write `InsertData/UpdateData/DeleteData/ChangeStatus`) | **Deleted entirely**. See §11 — single-source-of-truth in the new schema. Each call site is mapped to the correct schema during the data migration script. |
| `app/Http/Controllers/Controller.php` base (same dual-write methods) | Replaced by base `BaseService` (just typed Prisma access) in `common/`. |
| `app/ImportExports/EquipmentExport`, `…Import`, `PartExport`, `…Import`, `OrderExport`, `…Import` | `ImportExportService` with `exceljs`. One method per template type: `exportEquipment`, `importEquipment`, etc. Long-running imports go through BullMQ; status polled via `GET /api/v1/import-export/jobs/:id`. |
| `app/Services/Macros/Macros.php` (form macros) | Not needed — Ant Design provides equivalent components. |

---

## 8. Views → Next.js pages

A blanket route-group structure for Next.js App Router:

- `app/(public)/` — homepage, faq, privacy, terms, roi-kalkyl, login, register, password reset, account confirm, `[slug]` (CMS catchall).
- `app/(user)/` — dashboard, myresult/*, analyzer, monitor, units, machines, programme, orders, boards, feedback, profile.
- `app/(admin)/` — full admin tree mirroring `/admin/...` legacy URLs.

The 30+ Blade `resources/views/backend/` and `resources/views/frontend/` folders map to Next.js feature folders by feature, not by file (Blade composition becomes React component composition). The `resources/views/backend/includes/lang/` per-language partials are obsolete — i18n is fully handled by next-intl from JSON message files (§9).

User-visible URLs preserved from the legacy app (per prompt §Phase 4 #10): `/dashboard`, `/myresult/*`, `/monitor/{id}`, `/analyzer/{id}`, `/orders`, `/boards/{id}`, `/admin/...`, `/units`, `/machines`, `/feedback`, `/profile/edit`, `/login`, `/register`, `/faq`, `/privacy_policy`, `/terms_conditions`, `/roi-kalkyl`. Legacy URLs that change (`/privacy_policy` → `/privacy`, `/terms_conditions` → `/terms`) are kept as 301 redirects in `middleware.ts`.

---

## 9. Language files → next-intl

10 locales × 15 keyspace files. Migration plan:

1. Write a one-off TS script `scripts/migrate-lang.ts` that reads each `resources/lang/<locale>/<file>.php` (Laravel array format), parses it (PHP arrays are easy to convert with regex or by `php -r 'echo json_encode(include "…");'`), and emits `frontend/messages/<locale>.json` with namespaced keys: `auth.login_form_title`, `validation.required`, etc.
2. Replace every `__('auth.foo')` and `trans('auth.foo')` usage in legacy views with `t('auth.foo')` from `useTranslations` in the new React components.
3. Default locale = `sv`; fallback = `en`. Locale persisted in `NEXT_LOCALE` cookie (set by next-intl `setRequestLocale`).
4. **RTL** for Arabic — Ant Design's `ConfigProvider direction="rtl"` for `ar`.
5. Each backend response that includes user-facing text uses translation keys (`{ message: 'errors.invalidCredentials' }`), translated on the frontend. Mixing translation between front and back is the legacy pattern's biggest weakness.

---

## 10. Public assets — keep, replace, drop

| Path | Decision |
|---|---|
| `public/ckeditor/` (full distribution) | DROP — TipTap (or CKEditor 5 React if needed) installed via npm. |
| `public/datatable/`, `public/calendar/`, `public/colorpicker/`, `public/date-picker/`, `public/time-picker/`, `public/html_editor/` | DROP — replaced by Ant Design components. |
| `public/js/google.js` (GoJS, 822 KB) | DROP file; install `gojs` via npm (license must be re-checked for non-eval use). |
| `public/js/all-frontend.js`, `all-frontend.css`, `backend.js`, `backend.css`, `mix-manifest.json` | DROP — Next.js bundles. |
| `public/css/`, `public/css1/`, `public/site/`, `public/site_bk/`, `public/js/`, `public/js1/`, `public/images/`, `public/images1/`, `public/img/`, `public/fonts/`, `public/fonts1/` | Drop framework files (jQuery, Bootstrap, Owl Carousel, Slick, Magnific Popup, Font Awesome, Ion Icons) — replaced by npm packages and Ant Design. **Keep custom artwork**: brand logos, custom icons in `public/build/img/icons/`, `public/build/img/cms/`, `public/build/img/slider/`. Migrated to `frontend/public/`. |
| `public/build/img/icons/` (equipment icons) | KEEP — copy to `frontend/public/equipment-icons/`. |
| `public/build/img/cms/` (CMS uploads) | KEEP — these are tenant uploads. Migrated to S3 by the data migration script (§13). |
| `public/build/img/slider/` | KEEP — admin-uploaded; migrate to S3. |
| `public/firebase/` | KEEP if it contains the FCM service worker (`firebase-messaging-sw.js`); otherwise drop. Verified during Phase 4. |
| `public/iot_version/` | KEEP — IoT firmware downloads served by `GET /api/v1/iot/software/latest/download`. Move to S3. |
| `public/temp/`, `public/log.txt`, `public/worker.log*` | DROP — runtime garbage. |
| `public/delay_notification_cron_job.php`, `public/iot_machine_connection_status_cron_job.php`, `public/tt.php` | DROP — replaced by BullMQ scheduled jobs. |
| `public/db_unique`, `public/mysqlAdmin`, `public/API/xmlapi.php` | DROP — exploit risk; cPanel API not used in new stack. |
| `public/ajax/` (PHP AJAX endpoints) | DROP — all behaviour goes through `/api/v1/*`. |
| `public/web.config`, `public/.htaccess` (if present), `public/index.php` | DROP — Apache/IIS-specific. Nginx config in `docker/nginx/nginx.conf`. |
| `public/manifest.webmanifest`, `service-worker.js`, `workbox-*.js` | KEEP intent — Next.js generates its own PWA manifest if needed. Re-evaluate during Phase 4. |
| `public/google79290e805e4462f1.html` | KEEP if the site is still verified with Google Search Console under that token. |
| `public/sitemap.xml`, `robots.txt`, `humans.txt`, `apple-touch-icon.png`, `favicon.ico`, `tile.png`, `tile-wide.png`, `browserconfig.xml`, `crossdomain.xml` | KEEP — copy to `frontend/public/`. |

---

## 11. Multi-tenant migration: MySQL DB-per-tenant → PostgreSQL schema-per-tenant

This is the highest-risk part of the migration and the biggest semantic change.

### 11.1 Legacy model

- One **master DB** `fpanalyzer_se_prodmaster` holds: `users`, `roles`, `permissions`, `social_logins`, `cms`, `cms_images`, `sliders`, `testimonials`, `site_settings`, `history`, `history_types`, plus a copy of all tenant tables for cross-tenant aggregation.
- **N tenant DBs** — one per company — created on demand by `CommonClass::CreateDatabase()` calling cPanel xmlapi. Each tenant DB has its full schema cloned from a template. The master DB also has the same tenant tables (via the dual-write trait).
- Connection switching at runtime: `Config::set('database.connections.companysql.database', $tenantDb)` then `Config::set('database.default', 'companysql')`.
- The dual-write `InsertData/UpdateData/DeleteData/ChangeStatus` methods write **the same row, with the same id**, into BOTH the master DB and the company DB.

### 11.2 New model — schema-per-tenant in one Postgres DB (updated v2)

- One Postgres DB. `public` schema for platform-wide tables. `tenant_template` schema for the canonical tenant table set. Per-tenant schemas `tenant_<id>` cloned from `tenant_template` on Company-user creation.
- **(updated 2026-05-14 — §13 entry 32)** Tenant routing is derived from the authenticated user with no DB lookup: `tenant_${user.id}` for Company users, `tenant_${user.companyId}` for sub-Users, `tenant_${X-Tenant-Id header}` for Administrators. `withTenant(tenant, cb)` issues `SET LOCAL search_path = "tenant_<id>", public` per request. The JWT no longer carries a `tenantId` claim — the auth middleware reloads the user row (cheap, indexed) and the tenant middleware reads role + companyId off it.
- All FKs within a tenant schema are intra-schema. **A5 (v2):** there are NO cross-schema FKs from tenant tables to `public.users` — replaced with denormalised user snapshots (see §11.5).
- **A7 (v2) — `pg_trgm` extension** enabled in the initial migration: `CREATE EXTENSION IF NOT EXISTS pg_trgm;`. GIN trigram indexes on the autocomplete-relevant columns:
  - `tenant_<id>.machine_programmes.name`
  - `tenant_<id>.machine_documents.name`
  - `tenant_<id>.orders.order_nr`, `tenant_<id>.orders.description`
  - `tenant_<id>.parts.name`, `tenant_<id>.parts.part_no`
  - `tenant_<id>.equipment.name`
  - These power the legacy `searchmachineprogram`, `searchprogram`, `getOrderNoByPartId`, `getOrderNoByEquipId`, and equipment/part autocomplete dropdowns.
- Tenant provisioning via `TenantsService.provisionFromTemplate(name)`:
  1. `INSERT INTO public.tenants` row, get id.
  2. `CREATE SCHEMA "tenant_<id>"`.
  3. For every table in `tenant_template`: `CREATE TABLE "tenant_<id>"."<t>" (LIKE "tenant_template"."<t>" INCLUDING ALL)` plus seeded reference data via `INSERT … SELECT` from `tenant_template`.
  4. Insert default rows where `tenant_template` has them (default work shifts, default types, default scrap/stop reasons).
- Removes the cPanel dependency entirely. Schema creation is just SQL run by the same Postgres user the app uses (granted `CREATE` on the database).

### 11.3 Dual-write decisions per call site

The legacy `BackOfficeFunction::InsertData($tblName, $data)` and friends write to BOTH master and company DBs. In the new world the destination is determined by which schema owns the table:

| Call site cluster | Tables touched | New destination |
|---|---|---|
| User CRUD (admin) | `users`, `roles`, `permissions`, `user_roles`, `role_permissions` | `public` schema only |
| Tenant user creation | `users` + `tenant_users` | `public` only (tenant_users is the link) |
| CMS, sliders, testimonials, social, settings | `cms`, `cms_images`, `sliders`, `testimonials`, `site_settings`, `social_logins` | `public` only |
| Equipment, parts, types, work shifts, machines, flows | `equipments`, `parts`, `types`, `work_shifts`, `tbl_machines`, `flow_designs`, etc. | `tenant_<id>` only |
| Production/scrap/stop/warning data | `production_data`, `scrap_data`, `stop_data`, `tbl_warning_data` | `tenant_<id>` only |
| History (audit log) | `history`, `history_types` | `public` only — the audit log is platform-wide so super admins can see all activity (legacy duplicates this into both DBs unnecessarily) |

**No call site requires writing to both `public` and a tenant schema.** Every dual-write in the legacy code is therefore a single-write in the new code, simplifying the data layer.

### 11.4 One-shot data migration

`backend/scripts/migrate-from-mysql.ts`:

1. Read MySQL master DB → write `public.users`, `public.roles`, `public.permissions`, `public.social_logins`, `public.cms`, `public.cms_images`, `public.sliders`, `public.testimonials`, `public.site_settings`, `public.history`, `public.history_types`.
2. For each row in MySQL `users` that has a non-null `db_name`: create `public.tenants` row, capture the new id, run `provisionFromTemplate`.
3. For each tenant DB: read every table, write to the corresponding `tenant_<id>` schema. Type conversions: MySQL `tinyint(1)` → `boolean`; `datetime` → `timestamptz` (assume Europe/Stockholm if naive); `int` → `int4`/`int8` based on size; `varchar` → `text` (Postgres `varchar` and `text` are equivalent); `longtext` → `text`; MySQL `enum` → Postgres enum (already declared in Prisma schema); MySQL `json` → Postgres `jsonb`.
4. Idempotent: each new table has a `legacy_id` (bigint) column with a unique index. Re-running skips already-migrated rows.
5. Reports counts and any rows skipped due to validation errors (FK violations, malformed JSON, etc.).
6. **Order of operations matters**: master tables first, then tenant tables in dependency order (types → parts/work-shifts/equipments → flows → flow_design_attributes → production/scrap/stop). The script uses Prisma's known FK graph to order writes.
7. **Schema discovery**: for the ~50 tables without Laravel migrations, the script first runs `INFORMATION_SCHEMA` queries against the live MySQL DB to extract column types, asserts they match the Prisma schema, and FAILS LOUDLY with the diff if they don't. This catches the cases where a column was added in production but not reflected in Prisma.

**(updated 2026-05-14 — §13 entry 32) Tenant-id ≠ Company-user-id remapping.**
When migrating legacy MySQL tenant data to Postgres in Phase 6:

- The legacy `tenants.id` will NOT match the Company user's `id` in the
  new system (Demo: `tenant.id=1` → `user.id=2`; Volvo: `tenant.id=14` →
  `user.id=66`).
- The Phase 6 migration script must map legacy `tenant.id` → Company
  `user.id` to correctly name the Postgres schema as `tenant_<userId>`.
  Build this map up front by joining legacy `tenants` to legacy `users`
  on the tenant's primary contact (the user whose role row is `Company`
  for that tenant), then keep the map in memory for the duration of the
  run. Persist it as a `legacy_tenant_id_map.json` audit file alongside
  the script's output.
- Any legacy data that references `tenant.id` as a foreign key must be
  updated to reference the Company `user.id` after migration. In
  practice this affects:
  - The schema name itself (`tenant_<id>` directory in PG).
  - The `feedback.tenantId` column (now stores Company user id — the
    field name is kept per the §13 entry 32 stability decision).
  - Any future denormalised "tenant_*_id" snapshot columns added by
    later phases.
- The legacy `users.db_name`, `users.db_username`, `users.db_password`
  columns are **ignored** in the new stack — schema is derived from
  `user.id` only. The Phase 6 script should `SELECT` these columns
  during the legacy read pass only to assert that the `db_name` for
  each Company user matches the legacy `tenants.db_name` for that
  tenant (sanity check that the legacy data really is consistent); it
  must NOT write any of these columns into Postgres `users`.

This block **supersedes step 2 above** for Phase 6: there is no
`public.tenants` row to create. The script's pseudocode for step 2
becomes:

```
for each legacy tenants row T:
    companyUser = legacy_users[T.primary_user_id]  # the role=Company user
    newUserId   = public_users[companyUser.email].id   # already inserted in step 1
    schemaName  = `tenant_${newUserId}`
    provisionSchema(prisma, newUserId)
    legacy_tenant_id_map[T.id] = newUserId
```

### 11.5 User snapshots & per-tenant backup integrity (updated v2 per A5)

**Decision: replace cross-schema FKs with denormalised user snapshots on tenant tables.** The v1 plan had `production_data.created_by → public.users.id` as an explicit cross-schema FK, then claimed in this section that `pg_dump --schema=tenant_<id>` produces standalone-restorable backups. That was wrong — a tenant-only dump that has unresolved FKs to `public.users` rows can't be restored to a fresh DB without ALSO carrying those user rows. Either the per-tenant backup story is broken, or we accept the FKs aren't really there.

A5 picks the second option but does it cleanly: store the user identity at write time as a snapshot, no FK.

**Affected tenant tables (and the legacy column they replace):**

| Table | Legacy column | New columns |
|---|---|---|
| `production_data` | `created_by` | `created_by_user_id BIGINT NULL`, `created_by_email TEXT`, `created_by_name TEXT` |
| `scrap_data` | `created_by` | same triple |
| `stop_data` | `created_by` | same triple |
| `tbl_warning_data` | `created_by` | same triple |
| `user_equipments` | `user_id` | `assigned_user_id BIGINT NULL`, `assigned_user_email TEXT`, `assigned_user_name TEXT` |
| `equipment_assign` | `user_id` | same triple, prefix `assigned_` |
| `tbl_machine_user_settings` | `user_id` | same triple |
| `machine_document_files` | `user_id`, `locked_by` | `uploaded_by_user_id/email/name` and `locked_by_user_id/email/name` |
| `machine_programme_files` | `user_id` | `uploaded_by_user_id/email/name` |
| `user_file_locks` | `user_id` | same triple, prefix `locked_by_` |
| `dashboards` | `created_by` | same triple |
| `dashboard_widgets` | `created_by` | same triple |
| `feedback` | `user_id` | same triple |

The `*_user_id` columns are **NOT FKs** at the DB level — they're informational and used to JOIN back to `public.users` when both schemas are available. The email/name snapshots are what the UI actually displays and what survives:
- if the user is later deleted from `public.users`,
- if the tenant DB is restored in isolation for forensics,
- if the user's email/name changes (you see the value at the time of the write).

The legacy app already does this for `work_shift_name` (denormalised in `production_data`/`scrap_data`/`stop_data`) — so the pattern is consistent with prior art in the codebase.

**Backup story (now correct):** `pg_dump --schema=tenant_<id>` produces a self-contained dump that restores cleanly into a fresh schema. No public-schema rows required.

**R3 (v3) — Snapshot fields are IMMUTABLE.** The `*_email` and `*_name` columns are written **once at row creation** and **never updated thereafter**. If a user later changes their email, the snapshot does NOT change — that's the entire point of a snapshot. A future developer should NOT "fix" this by adding a sync job, a trigger, or a backfill batch — those would defeat the audit-trail and per-tenant-backup-integrity guarantees this pattern delivers. The `*_user_id` column may be used to re-fetch the *current* user identity at read time when both schemas are available, but the persisted email/name reflects who the actor was at write time. Service-layer write code MUST capture these values in the create call (typically inside an interceptor that reads the JWT subject); update calls MUST NOT touch them. Phase 3 includes a lint rule / repository helper (`createWithSnapshot(prisma, user, data)`) that makes this the path of least resistance.

### 11.6 Operational safety

- Per-request `search_path` is reset on connection release to avoid leaks across pooled connections (PG `RESET search_path` in a `try/finally` around each request).
- A misconfigured query that omits the `search_path` will hit `public` by default — Postgres's behaviour, not Prisma's. The `PrismaService` wrapper checks that any tenant-table query was preceded by a `SET search_path` (via a query-tag mechanism) and raises if not.

---

## 12. Environment variables (updated v2)

`/new_fp/.env.example` will contain (Phase 1 deliverable):

```env
# Application
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:4000
DEFAULT_LOCALE=sv
FALLBACK_LOCALE=en

# JWT — three secrets, three audiences (A4)
JWT_ACCESS_SECRET=        # Web access token (cookie). 15 min.
JWT_REFRESH_SECRET=       # Web refresh token (cookie). 7 days.
JWT_DEVICE_SECRET=        # IoT device bearer token. 365 days. NEVER share with web secrets.
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
JWT_DEVICE_TTL=365d

# Machine data partitioning (A3)
MACHINE_DATA_RETENTION_MONTHS=24    # 0 = keep forever
MACHINE_DATA_PARTITION_BUFFER=2     # months to maintain ahead of current

# Bull Board UI gate (A10)
BULLBOARD_ENABLED=false             # set true only for local debugging via port-forward

# Database (Postgres)
DATABASE_URL=postgresql://app:app@postgres:5432/fp_analyzer?schema=public
DATABASE_TEMPLATE_SCHEMA=tenant_template

# Redis (cache + sessions + BullMQ)
REDIS_URL=redis://redis:6379

# Mail (Office 365 SMTP — same credentials need rotation post-migration)
MAIL_HOST=smtp.office365.com
MAIL_PORT=587
MAIL_USER=
MAIL_PASS=
MAIL_FROM=info@fpanalyzer.se
MAIL_FROM_NAME="FP Analyzer"

# File storage
STORAGE_DRIVER=local            # local | s3
STORAGE_LOCAL_PATH=./storage
S3_BUCKET=
S3_REGION=eu-north-1
S3_ACCESS_KEY=
S3_SECRET_KEY=
MAX_FILE_SIZE=8388608           # 8 MB (legacy was 7888000 ≈ 7.5 MB; rounded up)

# Recaptcha v3
RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET_KEY=
RECAPTCHA_THRESHOLD=0.5

# Social OAuth — 5 providers by default (B4: Bitbucket dropped pending operator confirmation, see §13.27)
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
FACEBOOK_REDIRECT_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URL=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URL=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URL=
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
TWITTER_REDIRECT_URL=
# BITBUCKET_* — uncomment if operator confirms usage
# BITBUCKET_CLIENT_ID=
# BITBUCKET_CLIENT_SECRET=
# BITBUCKET_REDIRECT_URL=

# Firebase Cloud Messaging
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Monitoring (optional)
GRAPH_URL=
GRAPH_KEY=

# Throttling
THROTTLE_DEFAULT_TTL=60
THROTTLE_DEFAULT_LIMIT=60
THROTTLE_AUTH_LIMIT=5
THROTTLE_IOT_LIMIT=600

# Super Admin seed (consumed by prisma/seed.ts on first run only)
SEED_SUPERADMIN_EMAIL=
SEED_SUPERADMIN_PASSWORD=

# Maintenance
MAINTENANCE_MODE=false
```

The legacy `.env` had: `APP_KEY` (Laravel-specific, dropped), `APP_LOCALE_PHP` (PHP locale, dropped — Node uses ICU), `SESSION_TIMEOUT_STATUS`/`SESSION_TIMEOUT` (dropped — JWT expiry replaces), `DB_BASE_TEMPLATE_*` (replaced by `DATABASE_TEMPLATE_SCHEMA`), `DB_READ_ONLY_USER`/`DB_READ_ONLY_PASS` (kept as `DATABASE_READONLY_URL` if Grafana integration continues — see Open Questions), `LOG_CHANNEL` (replaced by Pino + log driver via `STDOUT`), `CACHE_DRIVER`/`SESSION_DRIVER`/`QUEUE_DRIVER` (Redis-only, no env switch).

Real secrets observed in legacy `.env` (DB password `Only4FPA!!`, mail password `Only4FPA!`, Graph key, reCAPTCHA keys) **must be rotated** before any reuse. None are copied into the new repo.

---

## 13. Decisions and deviations from a 1:1 port (updated v2)

These are deliberate. If any are wrong, fix here before Phase 1.

1. **DB-per-tenant (MySQL) → schema-per-tenant (Postgres)**. Rationale: cheaper to operate (one DB instance), simpler backups, allows cross-tenant analytical queries when needed, eliminates the cPanel dependency.
2. **Drop dual-write** (`InsertData/UpdateData/DeleteData/ChangeStatus`). Rationale: each table belongs in exactly one schema in the new model; dual-write was a band-aid for the DB-per-tenant design.
3. **Drop session-based auth and 5-min `SessionTimeout`**. Web JWT 15 min access + 7 day refresh in cookies; IoT JWT 365 day device-bound bearer (A4).
4. ~~**Drop API v0 mount**~~ **(REVERSED v2)** — keep v0 as a thin shim to v1 services (B6: legacy frontend never calls the API; only IoT firmware does, and we can't coordinate firmware upgrades). See §2.7.
5. **Move all destructive operations from GET to DELETE**. Rationale: CSRF safety + HTTP semantics. Legacy URLs that change are documented in the route mapping; the frontend issues `DELETE` from a button click, not a `<a>` link.
6. **Drop the in-app `arcanedev/log-viewer`**. Rationale: container logs (Pino → stdout → Docker → optional Loki) are the modern norm and don't expose another web surface.
7. **Drop `tbl_delay_notifications` table**. Rationale: BullMQ delayed jobs do this natively.
8. **Consolidate duplicate `User`/`Users` models** into one `User`.
9. **A1 (v2) Machine rename:** `tbl_machines` → `Machine`; legacy `machines` → `MachineDocument`; legacy `machine_files` → `MachineDocumentFile`. Two clearly distinct identifiers for two clearly distinct concepts.
10. **Move roles/permissions from `config/access.php` to DB tables**, runtime-editable. v2 expands the legacy 3 permissions to ~30 (B3, see §4.5).
11. **Replace `Maatwebsite/excel` long-running imports with BullMQ-backed jobs**. Status polled via `/api/v1/import-export/jobs/:id`.
12. **Drop CKEditor 4** in favour of TipTap (or CKEditor 5 React if CMS authors push back).
13. **Drop yajra DataTables**; Ant Design `Table` + TanStack Query gives the same UX with less weight.
14. **Drop the in-tree GoJS distribution** (`public/js/google.js`); install via npm. License compliance must be re-verified — the legacy in-tree copy is large enough to suggest the eval-only build, which is not allowed in production.
15. **Drop the `/clear`, `/test`, `/tester`, `/admin/test`, `/admin/updateImagePath`, `/admin/batchUpdateFlowDesign*` routes**. They are debug/one-shot endpoints.
16. **Drop the cPanel `xmlapi.php` and the `db_unique`, `mysqlAdmin` directories**. Security risk; not used in the new stack.
17. **Replace the `Macros::Dropdowns` (countries, US states, …)** with a JSON file in the frontend — pure static data shouldn't be a backend concern.
18. **(NEW v2, A2)** Soft-delete via explicit per-service `notDeleted()` helpers — no global Prisma middleware.
19. **(NEW v2, A3)** Partition `tbl_machine_data` (→ `machine_data`) by `start_time`, monthly, from day one. Maintenance via BullMQ scheduled job. (§4.6)
20. **(NEW v2, A5)** Replace cross-schema FKs to `public.users` with denormalised user snapshots on tenant tables. Per-tenant backups become standalone-restorable. (§11.5)
21. **(NEW v2, A6 / refined v3 R4)** Capture legacy schema as frozen `legacy-schema.json` from committed SQL dumps (master 2017 template + tenant 2025-05 dump). The discrepancy ledger lists tables **by name** that exist in production but aren't in either dump — Phase 6's schema-drift assertion compares the live MySQL `INFORMATION_SCHEMA.TABLES` set against this concrete list:
    - **Master DB tables missing from `common_db.sql` (operator must dump from live before Phase 2):** `cms`, `cms_images`, `sliders`, `testimonials`, `site_settings`, `tbl_feedbacks`, `tbl_delay_notifications`, `company_machine`, `machine_programme`, `machine_programme_files`, `work_station`, `symbols`, `equipment_type`, `main_db_info`. *(Source: `legacy-schema.json` → `discrepancies.master_missing_tables`.)*
    - **Tenant DB tables missing from `demoChildDb.sql`:** `main_db_info` (referenced by `CommonClass::CreateDatabase`). *(Source: `legacy-schema.json` → `discrepancies.tenant_missing_tables`.)*
    - **Ghost models** (PHP classes `use`-imported but no class file): `App\Models\OrderReport`, `App\Models\OrderQueue`, `App\Models\Dyanamo\OrderReportData`, `App\Jobs\UpdateOrderReport`. Phase 6 assertion: every code path referencing these must be confirmed dead before migration. *(Source: `legacy-schema.json` → `discrepancies.ghost_models`.)*
    - The Phase 6 script reads `legacy-schema.json`, queries the live DB's `INFORMATION_SCHEMA`, and FAILS LOUDLY if any of these named tables are missing in production OR if the production schema has columns not declared in `legacy-schema.json`.
22. **(NEW v2, A7)** Enable `pg_trgm` extension + GIN trigram indexes on the autocomplete-relevant text columns from day one (`orders.order_nr/description`, `parts.name/part_no`, `equipment.name`, etc.).
23. **(NEW v2, A8)** Every tenant-scoped resource module ships with a tenant-isolation e2e test (`backend/test/tenant-isolation.e2e-spec.ts`) — create rows in tenant A, authenticate as a user in tenant B, assert all GET/POST/PATCH/DELETE return 403 or empty. Required green before any tenant-scoped feature is considered complete.
24. **(NEW v2, A9)** No realtime in v1. Polling with `ETag`/`If-None-Match` for the live-update endpoints. SSE planned but not built — see §16.
25. **(NEW v2, A10)** Bull Board UI is opt-in via `BULLBOARD_ENABLED=true` env, off in production by default. (§6)
26. **(NEW v2, B1)** Drop the `Objects` model + table — no usages in active code (only a dead `use` import).
27. **(NEW v2, B4 deferred)** Bitbucket OAuth: present in scaffold, no observed UI/route wiring beyond the login button list. **Decision pending operator confirmation:** if no users have Bitbucket-linked logins in production `social_logins.provider = 'bitbucket'`, drop the provider entirely. Provisional default for Phase 1: support 5 providers (Facebook, Google, GitHub, LinkedIn, Twitter) and OMIT Bitbucket. Reverse if operator data shows usage.
28. **(NEW v3, R6)** All timestamps stored in UTC (`timestamptz`). Per-tenant `timezone` column on `public.tenants` (default `'Europe/Stockholm'` for migrated tenants). Shift boundary calculations and all wall-clock-aware reads use the tenant timezone explicitly — no implicit "server local". (§17)
29. **(NEW v3, C1)** Migration window: **big-bang**. Plan a 4–8 hour weekend outage. **Rollback plan:** keep the legacy app deployable for **30 days post-migration** in case data corruption is discovered. Concretely: the legacy DB and app server stay up but read-only (a single-line nginx rule blocks POST/PUT/PATCH/DELETE) for 30 days. After 30 days clean, decommission the legacy stack.
30. **(NEW v3, C2 provisional)** Rich text editor: **TipTap**. Re-evaluate during UAT — if CMS authors push back, swap to CKEditor 5 React (one component swap; data format is HTML-string in both).
31. **(NEW v3, C5 strategy)** All 10 locales lazy-loaded by next-intl (default behaviour). Eagerly bundle only `sv` + `en` in the initial JS payload. Operator confirms actual usage post-migration via `SELECT DISTINCT locale FROM users` (or wherever per-user locale is stored) — see OPERATOR_QUESTIONS.md. If only sv+en are real, the other 8 locale JSON files are kept on disk but never bundled and `/changeLanguage` for them returns 404.
32. **(NEW 2026-05-14)** **Drop the `Tenant` + `TenantUser` models — a Company user IS the company.** Replaces the v2/v3 design that had a separate `public.tenants` table joining users to schemas. New shape:
    - `User.companyId BIGINT NOT NULL DEFAULT 0` — for `role=User`, points at the Company user's id; for `role=Company`, stays 0 (they ARE the company).
    - `User.timezone TEXT NOT NULL DEFAULT 'Europe/Stockholm'` — absorbs the field that used to live on `Tenant`.
    - Tenant schema name derived purely from the authenticated user with **no DB lookup**: `tenant_${user.id}` for Company users, `tenant_${user.companyId}` for sub-Users, `tenant_${X-Tenant-Id header}` for Administrators. The legacy `req.tenant.tenantId` field is preserved at the middleware boundary, with the value now meaning *Company user id*.
    - `Feedback.tenantId` column retained, redocumented to mean "Company user id". Snapshot writes use `prisma.user.findUnique` to capture the Company user's display name (was `prisma.tenant.findUnique`).
    - JWT payload drops the `tenantId` claim — `{ sub, email, roles, kind, impersonator_id? }` only. The auth middleware adds one `prisma.user.findFirst` per request (with `userRoles` include) to repopulate role/companyId/timezone; net effect ≈ the same as the old `prisma.tenant.findUnique` hop in `tenantMiddleware`.
    - **Schema-only mode is now the only mode.** `Tenant.dbName` (separate-DB routing — Volvo's `vovodb`) is gone. Production migration for Volvo must convert that separate DB into a `tenant_<id>` schema in the shared cluster *before* this commit deploys (see OPERATOR_QUESTIONS.md, item 31.dbname-flip).
    - `me.activeTenantId` field name preserved on the API; semantic now = Company user id. `MeResponse.tenants[]` becomes a one-row synthetic array (or empty for Administrators) so the frontend's `tenants.find(t => t.id === activeTenantId)` pattern keeps working.
    - **Frontend API surface changes:** `GET /api/v1/admin/tenants` deleted. Admins discover companies via `GET /superadmin/users?roles=Company` (the `roles` filter was added in the same commit). Sidebar's "Tenants" item replaced by filtering User Management on `role=Company`. `frontend/src/lib/api/tenants.ts` and `frontend/src/app/(admin)/admin/tenants/` are gone; new `lib/api/companies.ts` provides `useCompaniesForPicker()`.
    - **Test-bootstrap helper:** `backend/test/helpers/get-demo-company-user-id.js` exports `getDemoCompanyUserId(app, adminCookie)` and `getDemoTenantContext(app, adminCookie)`. Replaces the `GET /admin/tenants` discovery used by 7 e2e tests; the 2 tenant-specific tests are rewritten in place.
    - **Rationale:** the Tenant table existed only to map a user→schema and to hold a timezone; both responsibilities collapse into the User row. Removing it eliminates an entire join (and an entire CRUD surface) without losing any production capability.
    - **Risk audit and full resolution log:** see `TENANT_REMOVAL.md` (all 7 risks RESOLVED, full e2e suite green, smoke verifications I.1–I.3 PASS).
    - **References updated in this section's siblings:** §4.3 (Tenant + TenantUser rows now annotated REMOVED — see entry 32); §11.2 (`PrismaService` derives `search_path` from `req.user.id`/`companyId`, no Tenant table lookup); §17.2 (`tenants.timezone` → `users.timezone`).

---

## 14. C-question resolutions (updated v3)

Items resolved in v2 are no longer listed here:
- ~~Q1 v0 IoT compatibility~~ → resolved B6: keep v0 as shim. (§2.7)
- ~~Q7 `Objects` usage~~ → resolved B1: drop. (§13.26)
- ~~Q8 permission inventory~~ → resolved B3 + R1: legacy enforces only 3; v3 expands to 26. (§4.5)

v2 C1–C6 + B4 are all answered or scoped to operator action in v3:

| # | Question | v3 answer |
|---|---|---|
| C1 | Migration window | **Big-bang.** 4–8 hour weekend outage. Legacy stays read-only for 30 days post-migration as rollback safety net. (§13.29) |
| C2 | Rich text editor | **TipTap (provisional).** Swap to CKEditor 5 React if authors push back during UAT. (§13.30) |
| C3 | Grafana still used? | **Unknown — operator must check** (`OPERATOR_QUESTIONS.md` Q1). Assume YES for planning; parallel Grafana rebuild added to Phase 6. |
| C4 | GoJS license status | **Unknown — operator must verify** (`OPERATOR_QUESTIONS.md` Q2) before Phase 4. **Phase 4 frontend is BLOCKED until resolved** — no charts/diagrams without a license check. |
| C5 | Multi-language coverage | All 10 locales lazy-loaded; eagerly bundle only `sv` + `en`. Operator confirms actual usage post-migration (`OPERATOR_QUESTIONS.md` Q3). (§13.31) |
| C6 | IoT firmware download auth | URL is auth-gated by default. **Operator must confirm IoT firmware first-boot/factory-reset behaviour** (`OPERATOR_QUESTIONS.md` Q4) — devices may need an unauthenticated bootstrap path before they have credentials. |
| B4 | Bitbucket users? | Provisional v3 default: 5 providers, no Bitbucket. **Operator runs `SELECT COUNT(*) FROM social_logins WHERE provider='bitbucket'`** (`OPERATOR_QUESTIONS.md` Q5). If >0, restore the Bitbucket provider config in `.env` and uncomment in `.env.example`. |

**Phase gating (v3):**
- Phase 1 (skeleton) — no blockers. Begin immediately on v3 approval.
- Phase 2 (Prisma schema) — no blockers; can proceed with the schema-per-tenant + `tenants.timezone` design.
- Phase 3 (backend modules) — no blockers; uses the v3 26-permission inventory (§4.5).
- Phase 4 (frontend) — **BLOCKED** until C4 (GoJS license) resolved. Other C-answers shape but don't block.
- Phase 5 (Docker) — no blockers; configs are independent of the unknowns.
- Phase 6 (data migration) — needs C3 (Grafana scope) for parallel-task scoping; otherwise no blockers. C1 = big-bang already locked in.
- Phase 7 (verification) — needs C6 (IoT bootstrap) for the IoT smoke-test path.

The original v2 question text is preserved below for reference; OPERATOR_QUESTIONS.md is the live tracker for the remaining unknowns.

<details>
<summary>v2 C1–C6 question text (resolved or scoped to operator)</summary>

**C1. Live data migration window: big-bang or zero-downtime?** Big-bang means one downtime window (probably a weekend); simpler script. Zero-downtime means dual-write the legacy app + new app for a transition period; doubles Phase 6 effort but is feasible. Decision shapes Phase 6 substantially.

**C1. Live data migration window: big-bang or zero-downtime?** Big-bang means one downtime window (probably a weekend); simpler script. Zero-downtime means dual-write the legacy app + new app for a transition period; doubles Phase 6 effort but is feasible. Decision shapes Phase 6 substantially.

**C2. CKEditor vs TipTap.** Are CMS authors used to CKEditor's specific UX? Only the operators can answer. Provisional default: TipTap. Reverse to CKEditor 5 React if authors push back.

**C3. Grafana read-only DB user.** Legacy `.env` has `DB_READ_ONLY_USER=grafana`. If a Grafana instance currently reads the master MySQL DB, schema-per-tenant in Postgres breaks every Grafana query (now `tenant_<id>.production_data` instead of `tenantdb.production_data`). Is the Grafana instance still in use? If yes, the migration includes a parallel task to rebuild Grafana queries.

**C4. GoJS license status.** `public/js/google.js` is 822 KB — eval builds are watermarked and not legal for production. Does the company hold a paid GoJS license, and what's the license key? `gojs` from npm requires the same license.

**C5. Multi-language coverage in production.** 10 locales × 15 keyspace files each. Are Thai and Arabic actually used by tenants in production, or default-fallback noise from the original Laravel scaffold? Determines whether next-intl bundles all 10 or lazy-loads. (Locale list confirmed in `resources/lang/`: ar, da, de, en, es, fr, it, pt-BR, sv, th.)

**C6. IoT firmware download authentication.** `public/iot_version/` ships real firmware (B5: `software/1616048013_1675418443_fp_analyzer_v2.1.2.zip`, 18.7 MB, dated 2021-03-18, plus `version.web` "2.1.2" + `version_info.web` JSON metadata). Currently served without auth (Apache `public/` directory). New default is auth-gated (device-bound JWT). Confirm this is acceptable, or specify if IoT devices need an unauthenticated bootstrap path before they have credentials.

**Bonus (B4 deferred):** Confirm whether anyone actually uses Bitbucket OAuth in production (`SELECT COUNT(*) FROM social_logins WHERE provider='bitbucket'`). If zero, drop the provider entirely. Provisional default: 5 providers without Bitbucket.

</details>

---

## 15. Phase 0 deliverables (updated v3)

- [x] `/new_fp/` directory created.
- [x] `/new_fp/MIGRATION_NOTES.md` v1 (Phase 0 round 1).
- [x] `/new_fp/MIGRATION_NOTES.md` v2 (applies v1-review A1–A10 + B1–B6 findings).
- [x] `/new_fp/MIGRATION_NOTES.md` v3 (this revision — applies v2-review R1–R6 + folds C1–C6 answers).
- [x] `/new_fp/legacy-schema.json` (frozen MySQL structure from committed dumps + discrepancies + ghost-model warnings + naming inconsistencies + `tbl_orders` confirmed columns).
- [x] `/new_fp/OPERATOR_QUESTIONS.md` (concrete SQL/verification steps for C3/C4/C5/C6/B4).
- [x] Commit 1 staged: `chore: phase 0 — migration notes` (notes only).
- [ ] Commit 2 (Phase 1 scaffold) follows immediately per v3 approval.

Per reviewer mandate, commit 1 is:

```
chore: phase 0 — migration notes

Adds MIGRATION_NOTES.md and legacy-schema.json. No code yet — these are
the contract for every subsequent phase.
```

Phase 1 scaffolding (NestJS + Next.js empty projects, two Docker compose files, `.env.example`, README) goes in commit 2. Phase 2 (Prisma schema generated from `legacy-schema.json`) and Phase 3+ follow per the original prompt.

## 16. Realtime (deferred — NEW v2 per A9)

WebSockets are explicitly OUT of Phase 1 scope. The Flow Monitor / Loss Monitor / Units / Machine Status pages need fresh data on the order of "every few seconds" — polling with cache validation handles this without the operational complexity of a WebSocket layer.

**v1 implementation:**
- The endpoints below set `ETag` (hash of response payload) and `Last-Modified` headers.
- TanStack Query polls with `refetchInterval` + sends `If-None-Match: <etag>`. Backend returns `304 Not Modified` when the data hasn't changed.
- Default poll intervals **(R5 v3 — bumped):**

| Page | v1 default | v3 default | Env var |
|---|---|---|---|
| Flow Monitor | 5 s | **10 s** | `NEXT_PUBLIC_POLL_INTERVAL_FLOW_MONITOR_MS=10000` |
| Loss Monitor | 10 s | **15 s** | `NEXT_PUBLIC_POLL_INTERVAL_LOSS_MONITOR_MS=15000` |
| Units list | 15 s | **20 s** | `NEXT_PUBLIC_POLL_INTERVAL_UNITS_MS=20000` |
| Machine Status detail | 5 s | **10 s** | `NEXT_PUBLIC_POLL_INTERVAL_MACHINE_STATUS_MS=10000` |
| Dashboard | (new) | **30 s** | `NEXT_PUBLIC_POLL_INTERVAL_DASHBOARD_MS=30000` |

**Rationale for bumping (R5):** ETags save *bandwidth*, not server *CPU* — Postgres still computes the response payload to hash it. The v1 defaults assumed ETag-cheap polling and were too aggressive given the per-tenant query cost. These v3 defaults are **conservative** — sized to keep CPU manageable for ~50 tenants × ~10 concurrent users each. **SSE moves up the priority list as soon as production usage data shows the polling cost is noticeable** (defined: backend p95 latency >300 ms on the listed endpoints, OR DB CPU sustained >60%). Until then, polling is the right choice.

**Endpoints designed to be SSE-ready:**

```
GET /api/v1/flow-monitor/list                   ETag, Last-Modified
GET /api/v1/flow-designs/:id/monitor            ETag, Last-Modified
GET /api/v1/flow-designs/:id/loss-monitor       ETag, Last-Modified
GET /api/v1/units                               ETag, Last-Modified
GET /api/v1/iot/machines/:id/status             ETag, Last-Modified
GET /api/v1/dashboard                           ETag, Last-Modified
```

**Future SSE (planned, not built):**

```
GET /api/v1/flow-monitor/:id/stream             text/event-stream
GET /api/v1/units/stream                        text/event-stream
GET /api/v1/iot/machines/:id/status/stream      text/event-stream
```

When SSE is built (post-v1), the backend listens for tenant-scoped events on a Redis pub/sub channel (`tenant:<id>:flow-monitor:<flow_id>`, etc.), publishers being the IoT-write endpoints and the production/scrap/stop write endpoints. The frontend swaps polling for `EventSource` without changing component logic (TanStack Query has built-in support for `useEventSource` adapters).

## 17. Timezone handling (NEW v3 per R6)

The legacy app silently assumes Europe/Stockholm everywhere — no timezone column on `users` or any tenant table, server timezone hard-coded in `config/app.php`, MySQL `timestamp` columns storing whatever the server thought was "now." This works for a single-region Swedish deployment and is the **single biggest silent-bug source** in OEE calculations the moment a tenant in another timezone is added or DST flips.

v3 fixes this rigorously.

### 17.1 Storage: UTC, always

- Postgres `timestamptz` for every "moment in time" column. Stored in UTC internally, regardless of session timezone.
- The migration script (Phase 6) interprets every legacy MySQL `datetime`/`timestamp` value as **Europe/Stockholm wall-clock time** and converts to UTC on write. (MySQL `timestamp` columns are technically already stored as UTC by the MySQL server, but only if the server's `time_zone` is set; the legacy server has it set to `+00:00` per the SQL dumps' `SET time_zone = "+00:00"` line — so the values ARE UTC. MySQL `datetime` columns, however, are stored without timezone — those need the Stockholm assumption.)
- Application writes: `new Date()` → Postgres `timestamptz` → stored UTC. Never store local time.
- Naive date columns (`date`, `time`) stay naive in the new schema where the legacy data is naive — these are wall-clock concepts (a shift "starts at 06:00") and don't carry a TZ.

### 17.2 Tenant timezone

**(updated 2026-05-14 — §13 entry 32)** `timezone` now lives on `User` rather than on the removed `tenants` table. Column: `users.timezone TEXT NOT NULL DEFAULT 'Europe/Stockholm'`. The effective tenant timezone is the Company user's `timezone` (sub-users inherit from their Company user via `user.companyId`). New Company users pick at creation time (admin UI dropdown of IANA TZ names); migrated rows default to `'Europe/Stockholm'`.

### 17.3 Reads + display

- Backend reads always return ISO-8601 UTC strings (e.g. `2026-05-08T12:34:56.789Z`).
- Frontend converts to the **tenant** timezone on display, NOT the browser timezone. The JWT carries a `tenant_timezone` claim (set at login from `tenants.timezone`); the frontend's `dayjs` default is set to that.
- `dayjs` + `dayjs/plugin/timezone` + `dayjs/plugin/utc`. Default applied in `frontend/src/app/layout.tsx`.

### 17.4 Shift boundary calculations — the critical bit

`getShiftByTime(now)` in `WorkShiftService` MUST compute "what shift is now in?" against the **tenant timezone**, not server local. A shift that starts at 06:00 means 06:00 in the tenant's wall-clock — for a Stockholm tenant during summer that's 04:00 UTC; during winter 05:00 UTC. The service receives `(timestamp: Date, tenantTimezone: string)` explicitly. No global "current TZ" state. The timezone parameter is non-optional in the type signature so it can't be forgotten.

A unit test asserts a shift schedule like "06:00–14:00, weekdays" produces correct boundaries on:
- DST forward day (last Sunday of March)
- DST back day (last Sunday of October)
- A non-Stockholm tenant (e.g. `'Asia/Bangkok'`) when one is added

### 17.5 Migration script timezone notes

The Phase 6 script logs every value it reinterpreted, so post-migration audits can spot any out-of-band data that was clearly already stored in some other TZ.
