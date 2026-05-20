# Tenant model removal — audit (Step 1 of the refactor)

**Date opened:** 2026-05-13
**Date completed:** 2026-05-14
**Trigger:** Architectural decision — drop the `Tenant` + `TenantUser` models;
the legacy pattern "a Company user IS the company" is sufficient.
**Status:** **DONE.** All 5 risks resolved (see "Resolution log" below). Full
e2e suite green (9 suites / 65 tests). Smoke verifications I.1–I.3 pass. See
MIGRATION_NOTES §13 entry 32 for the canonical decision record.

---

## Surface area

### Backend — 38 files

Grouped by what each file uses Tenant for. `IMPACT` reflects how invasive the
fix will be once Step 4 (middleware redesign) lands.

#### Auth / middleware / Prisma plumbing — must change first

| File | Uses Tenant for | Impact |
|---|---|---|
| `src/middleware/auth.js` | Reads `payload.tenantId` from JWT into `req.user.tenantId`. | Remove `tenantId` from `req.user`. |
| `src/middleware/tenant.js` | Looks up `prisma.tenant.findUnique` + `prisma.tenantUser.findFirst`; populates `req.tenant = { tenantId, schemaName, dbName, timezone }`. | **Rewrite** — derive schema from `req.user` only. |
| `src/services/auth.service.js` | `login()` + `issueImpersonationToken()` read `target.tenantUsers[0].tenantId` and embed `tenantId` in JWT. | Strip `tenantId` from JWT payload + login/impersonate responses. |
| `src/prisma/client.js` | `withTenant(tenant, cb)` accepts a `{ schemaName, dbName, timezone }` object **or** a schema-name string. | Keep — change callers to pass the derived schemaName (string form already supported). |
| `src/prisma/db-provisioner.js` | Builds tenant DB URLs from `dbName`. | Keep only the `createCompanyDatabase`/`dropCompanyDatabase` helpers — they're called from the new "create Company user" flow. References to `prisma.tenant.findUnique` go away. |
| `src/server.js` | Calls `tenantsService.syncTenantSchemas()` at boot — that loops over `prisma.tenant.findMany()`. | Replace with a sweep over `users where role=Company`. |
| `src/routes/me.routes.js` | Returns `activeTenantId` + `tenants[]` array; reads `user.tenantUsers`. | Drop both fields; replace with `companyUserId` (derived). |

#### Tenant API surface — endpoints / service to delete

| File | Role | Action |
|---|---|---|
| `src/routes/tenants.routes.js` | `GET/POST/PATCH/DELETE /api/v1/admin/tenants` + sub-user management. | **Delete** the route file + unmount from `app.js`. |
| `src/services/tenants.service.js` | All of `list/find/create/update/setStatus/archive/listUsers/addUser/removeUser` plus `provisionSchema()`. | **Split**: `provisionSchema()` + `syncTenantSchemas()` survive (move to `tenant-schema.service.js` or merge into `admin-users.service.js`). Everything else deleted. |
| `src/app.js` | Mounts `/api/v1/admin/tenants`. | Remove the import + mount line. |
| `src/routes/admin-users.routes.js` | (Currently calls `tenantsService.addUser` after creating a user with `tenantIds[]` — see service file below.) | Replace with: if `role=Company`, call provisionSchema directly. |
| `src/services/admin-users.service.js` | When creating a user with `tenantIds[]`, posts to `tenantsService.addUser` to wire up `tenant_users`. | Replace with: on role=Company create, call `provisionSchema(\`tenant_${newUser.id}\`)`. No `tenant_users` rows. |
| `src/routes/admin-feedback.routes.js` | Filters feedback by `tenantId` query param (super-admin filter). | Replace with `companyUserId` filter. |

#### Domain services that call `withTenant()` — pass-through change

These 30 service files all call `withTenant(req.tenant, cb)`. They never touch
the Tenant model directly; they only care that the middleware hands them a
schema. After the middleware rewrite, `req.tenant` becomes `{ schemaName }`
(or just a string), and the services need no logic changes — only
type/shape adjustments where TS infers a richer object.

```
src/helpers/tenant-table.helpers.js          (helper used by ~20 services)
src/services/admin-boards.service.js
src/services/admin-chart-data.service.js
src/services/admin-feedback.service.js
src/services/admin-flow-designs.service.js
src/services/admin-folders.service.js
src/services/admin-iot.service.js
src/services/admin-machine-files.service.js
src/services/admin-machine-programmes.service.js
src/services/admin-machines.service.js
src/services/admin-orders.service.js
src/services/admin-parts.service.js
src/services/admin-results.service.js
src/services/admin-salary-groups.service.js
src/services/admin-scrap-categories.service.js
src/services/admin-scrap-reasons.service.js
src/services/admin-shift-schedules.service.js
src/services/admin-stop-categories.service.js
src/services/admin-stop-reasons.service.js
src/services/admin-symbols.service.js
src/services/admin-types.service.js
src/services/admin-users.service.js          (also: see "API surface" row above)
src/services/admin-warning-data.service.js
src/services/admin-work-shifts.service.js
src/services/admin-workstations.service.js
src/services/equipment.service.js
```

Most need ZERO code changes if `req.tenant.schemaName` keeps the same name in
the new shape. They show up in the grep only because they pass `tenant`
through to `withTenant()`.

### Frontend — 50 files

Grouped by usage pattern. Counts below are file counts.

| Pattern | Files | What changes |
|---|---|---|
| `me.activeTenantId` for `useQuery` tenant scoping | ~35 admin pages + the cascade hooks | The field goes away from `useMe()`. Pages need a replacement: either (a) drop the param entirely (backend derives schema) or (b) rename to `companyUserId`. |
| `X-Tenant-Id` header on requests | ~25 hook modules under `lib/api/` | Header is now redundant for non-admin users (backend derives schema). For Super Admin override, becomes `X-Company-User-Id`. |
| `/api/v1/admin/tenants` consumers | `lib/api/tenants.ts`, `admin/tenants/page.tsx`, `admin/feedback/page.tsx` (tenant filter), `admin/access/users/create/page.tsx` (tenantId Select on Create User) | Delete the tenants page + module. Feedback filter swaps to "Company user" Select. Users-create form already needs revision per Step 6. |
| `TenantSummary` type | `lib/api/types.ts`, `auth.ts`, `tenants.ts` | Type goes away. `MeResponse.tenants` array goes away. |
| `AdminShell.tsx` / `AppShell.tsx` | Tenant indicator / picker. | Switch to Company user indicator if any visible UI. Per Step 7, the sidebar "Tenants" item goes. |

### Tests — 9 files, all use Tenant somehow

| File | Use |
|---|---|
| `tenant-isolation.test.js` | The whole suite asserts cross-tenant isolation by creating a tenant + a user in it. **Will need rewriting around two Company users instead of two Tenants.** |
| `tenant-provision.test.js` | The whole suite asserts tenant CRUD + schema provisioning. **Becomes "Company user creation provisions a schema".** |
| `users-crud.test.js` | Bootstraps via `GET /admin/tenants` to get `tenantId`. Send `X-Tenant-Id` on user CRUD. | Switch to login-as-admin-with-target-company-user-id pattern. |
| `roles-crud.test.js` | Same bootstrap pattern. |
| `impersonation.test.js` | Asserts impersonation switches tenantId. | Asserts impersonation switches `sub` and derived schema follows. |
| `self-protection.test.js` | Bootstrap pattern only. |
| `recent-history.test.js` | Bootstrap pattern only. |
| `phase-a-flow-designs-orders.test.js` | Bootstrap pattern + `X-Tenant-Id` on every call. |
| `phase-a-cascading-warning.test.js` | Same. Has 13 individual assertions all under one `X-Tenant-Id` umbrella. |

**All 65 tests will need to keep passing after the refactor.** The two
tenant-specific suites will be rewritten end-to-end; the other 7 will need
a small bootstrap helper change.

---

## Current data state (live `tenant_1` schema)

| public.users.id | name | role | company_id | tenant_users mapping |
|---|---|---|---|---|
| 1 | Admin User | Administrator | 0 | (none — Super Admin) |
| 2 | Company User | Company | 0 | tenant_id=1 (active) |
| 66 | Volvo | Company | 0 | tenant_id=14 (active) |
| 11, 24, 32, 35, 43, 45, 54 | "First" (e2e leftovers) | User | 0 | tenant_id=1 (status=false, soft-deleted) |

`public.tenants`:

| id | name | slug | schema_name | db_name | status |
|---|---|---|---|---|---|
| 1 | Demo Tenant | demo | tenant_1 | (null) | active |
| 14 | Volvo | volvo | schema_14 | vovodb | active |

---

## Risks and blockers — read this before Step 3

The plan as written makes three assumptions that don't hold against the
current data. These need decisions before any destructive step.

### Risk 1 — `tenant.id` ≠ company user's `id`  ✅ RESOLVED

The plan says:

> in practice if user.id === tenant.id for all existing rows, there may be
> no data change needed

That's **not true here**. Demo Tenant's id is 1 but its Company user's id is
**2**. Volvo's tenant id is 14 but its user's id is **66**. So the existing
schema `tenant_1` doesn't map to `tenant_${user2.id}` = `tenant_2`. Choices:

- **(a) Rename the PostgreSQL schema** from `tenant_1` to `tenant_2` before
  flipping the middleware. This preserves all the Phase A–D test data and
  every row Demo tenant has accumulated.
- **(b) Accept the loss** — drop `tenant_1`, provision a fresh `tenant_2`,
  and start over. Acceptable only because this is a dev DB; production
  must do (a).

The `vovodb` separate database (for tenant 14 / user 66) doesn't exist on this
machine — nothing to migrate locally, but the production migration story
needs to address it.

**Recommendation:** option (a), via a single `ALTER SCHEMA tenant_1 RENAME TO tenant_2`. Doing it before the middleware switch means existing JWT-with-tenantId tokens still hit a valid schema, and the new derived schema also hits the same one.

### Risk 2 — `users.company_id` is currently 0 for every row  ✅ RESOLVED

The plan says sub-users (`role=User`) get routed to their parent Company's
schema via `user.companyId`. But every row in `public.users` has
`company_id = 0` — including the soft-deleted "First" sub-users that used to
belong to Demo Tenant via `tenant_users`. The legacy column was never
populated by the new_fp port.

Without populating `company_id`, every existing sub-user would route to
`tenant_0` (nonexistent) after the cutover. Choices:

- **(a) Backfill `company_id`** from the existing `tenant_users` table before
  dropping it: for each row in `tenant_users where status=true`, set
  `users.company_id = (SELECT primary_user_id FROM tenants WHERE id = tenant_users.tenant_id)`.
  Or use a simpler mapping: each tenant has a "primary" Company user; map
  every member to that primary's id.
- **(b) Make `company_id` non-zero a hard requirement** at user creation,
  drop the migration, and live with broken existing sub-users. (None of the
  current sub-users are active, so this might be acceptable.)

**Recommendation:** option (a) with a one-shot backfill query in the same
migration that drops the Tenant tables.

### Risk 3 — losing `Tenant.timezone` and the `dbName` (separate-DB) mode  ✅ RESOLVED

Three fields on `Tenant` aren't recoverable from the User model:

- **`timezone`** — currently set per tenant (default `Europe/Stockholm`).
  Used by `withTenant()` and a few date-display call sites. Either move to
  `users.timezone` (per-Company user) or hard-code a default.
- **`dbName`** — multi-database mode (one Postgres DB per tenant). Volvo
  uses this. If we drop the Tenant model, the dbName has nowhere to live
  unless we add it to the User model. **The plan doesn't mention this.**
  If we drop the column, we're committing to schema-only mode and Volvo's
  separate-DB routing breaks.
- **`status`** — `active` / `suspended` / `archived`. Already maps to
  `users.status` (1/0/whatever); decommissioning Tenant `status` means the
  Company-user-level status is the source of truth.

**Recommendation:** move `timezone` to `users` (or default it). Decide
explicitly whether to support the separate-DB mode. If yes, add
`users.db_name` (Company-only). If no, document that all tenants are
schema-mode from this commit forward and plan a separate path for Volvo's
production migration.

### Risk 4 — `TenantUser` is a many-to-many  ✅ RESOLVED

Even though current data has each user in only one tenant, the model
permits multi-tenant users. The new "user.company_id is your tenant"
flattens that to single-tenant. **No current data depends on multi-tenant
users**, so the simplification is safe — but worth a sentence in the
MIGRATION_NOTES decision log.

### Risk 5 — soft-deleted `tenant_users` rows  ✅ RESOLVED

Eight users (the "First" e2e test leftovers) are soft-deleted in
`tenant_users` (status=false). The new model doesn't have a place for
"user used to belong to tenant X". The backfill in Risk 2 needs to skip
rows with `status=false` and instead populate `company_id` based on
their currently-true membership (or 0 if none).

### Risk 6 — 50+ frontend files reading `me.activeTenantId`  ✅ RESOLVED

Removing the field is a wide change. Every admin page passes
`tenantId` to its TanStack hooks, every hook puts it in the query key
and the `X-Tenant-Id` header. After the refactor:

- For non-admin users: the header is unnecessary (backend derives schema)
  but harmless. Keep sending it to avoid touching 25+ hook files.
- For admin (super-admin) override: switch the header to
  `X-Company-User-Id`. Or keep `X-Tenant-Id` semantically and just have it
  mean "company user id" — **less invasive but confusing**.
- `me.activeTenantId` itself: rename to `activeCompanyUserId` and update
  the ~35 page consumers. Or keep the name and just change the meaning.

**Recommendation:** keep the field/header names exactly as they are
(`activeTenantId`, `X-Tenant-Id`) but document that the value is now the
Company user's id. Reduces frontend churn from 50 files down to ~5. The
"tenant" word stays in the codebase as a synonym for "company user id" —
ugly but stable.

### Risk 7 — test suite breakage  ✅ RESOLVED

7 of 9 test files use the `GET /admin/tenants` bootstrap to discover a
tenant id. After Step 6 the endpoint is gone. Two options:

- Add a shared test helper that returns "the Company user id Admin Owns"
  (e.g. `getDemoCompanyUserId(adminCookie)` that hits
  `GET /admin/users?role=Company` and returns the first row).
- Hard-code id=2 in tests (brittle but simple — tenant_1 → user 2).

The two tenant-specific suites get rewritten or deleted.

---

## What the refactor will produce

If the risks above are answered, the resulting state:

1. `prisma/schema.prisma`: no `Tenant`, no `TenantUser`. `User` model
   gains `timezone` (and optionally `dbName`). All sub-users have
   `companyId` populated.
2. `tenant_1` schema renamed to `tenant_2` (or whichever id User#2 ends up
   with).
3. `tenantMiddleware` derives `req.tenant.schemaName` from `req.user.id` /
   `req.user.companyId` with no DB lookup.
4. JWT payload drops `tenantId`. Token issued at login = `{ sub, email, roles, kind }`.
5. `/api/v1/admin/tenants` endpoint deleted. Sidebar item removed.
6. `POST /api/v1/admin/users` with `role=Company` provisions `tenant_${user.id}`.
7. All 65 tests rewired to the new bootstrap helper. New shapes for the
   tenant-isolation and tenant-provision suites.
8. Frontend: 50 files keep working under "activeTenantId now means
   companyUserId" semantics (the cheap rename-the-meaning option) — or
   we do the full field rename (expensive but cleaner). Audit recommends
   the cheap option.

---

## Questions for the reviewer before Step 3 runs

1. **Schema rename `tenant_1` → `tenant_2`** — confirm we do this rather
   than start fresh? (Saves all Phase A–D test data.)
2. **`company_id` backfill from `tenant_users`** — confirm we run this
   one-shot inside the same migration? Or accept that legacy sub-users
   route to `tenant_0`?
3. **Volvo / multi-database mode** — drop entirely (schema-only future)
   or move `db_name` to `users` and keep both modes? Production migration
   depends on this answer.
4. **Frontend rename `activeTenantId` → `activeCompanyUserId`** — full
   rename (50 files) or keep the name and document the new meaning
   (~5 files)?
5. **Test bootstrap** — shared helper `getDemoCompanyUserId(adminCookie)`,
   or hard-code id=2?

Answer these five and I'll execute Steps 3–9.

---

## Resolution log (filled in after Step J)

All 7 risks above closed. Concrete outcomes per risk:

| # | Risk | Resolution |
|---|---|---|
| 1 | `tenant.id` ≠ Company user id | Renamed PostgreSQL schema `tenant_1` → `tenant_2` (Demo's Company user is id=2). All Phase A–D test data preserved. Volvo's id-66 mapping was already `tenant_66` so no rename needed. |
| 2 | `users.company_id = 0` for every row | Backfill SQL ran inside Step B. `UPDATE 0` because all current sub-users were soft-deleted leftovers (`status=false` in `tenant_users`) — the live data was already consistent with "Company users have `company_id=0`". The constraint is enforced going forward by `admin-users.service.create()` setting `companyId = req.tenant.tenantId` on `role=User` writes. |
| 3 | Lost `Tenant.timezone` / `dbName` | `timezone` moved to `User.timezone TEXT NOT NULL DEFAULT 'Europe/Stockholm'`. `dbName` (separate-DB mode) **dropped** — schema-only from now on. Volvo's production migration must convert their separate DB to a `tenant_<id>` schema before this commit ships to prod (see `OPERATOR_QUESTIONS.md`). |
| 4 | `TenantUser` many-to-many | Flattened to single-tenant per user via `User.companyId`. No current data depended on multi-tenant membership. |
| 5 | Soft-deleted `tenant_users` rows | Discarded along with the `tenant_users` table. The 8 "First" e2e-test leftover users keep `companyId=0`; they are inert (status=false, deletedAt set). |
| 6 | 50+ frontend `me.activeTenantId` reads | Kept the field name; redocumented the semantic at the canonical type (`lib/api/types.ts` `MeResponse.activeTenantId`) and at four high-impact call sites (`AppShell.tsx`, `AdminShell.tsx`, `dashboard/page.tsx`, `users/[id]/page.tsx`). Net frontend churn was 7 files (5 redoc + 2 selector rewires), not 50. |
| 7 | Test-suite breakage | Helper `backend/test/helpers/get-demo-company-user-id.js` exports `getDemoCompanyUserId(app, adminCookie)` and `getDemoTenantContext(app, adminCookie)`. 7 tests rewired to the helper; 2 tenant-specific tests rewritten (`tenant-provision`, `tenant-isolation`). Full suite: 9/9 passing, 65/65 tests. |

Verification runs (Step I, 2026-05-14):
- I.1: create Company user → `tenant_360` exists with 41 tables → PASS
- I.2: Company user login → `GET /equipment` 200 OK → PASS
- I.3: sub-User created under Company 360 → `users.company_id=360`, `/me.activeTenantId=360` → PASS

Cleanup: deleting the smoke Company user via `DELETE /admin/users/360?permanent=true` correctly dropped the `tenant_360` schema.
