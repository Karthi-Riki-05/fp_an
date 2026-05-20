# DROPDOWN_AUDIT_COMPLETE.md

**Sealed:** 2026-05-14
**Companion:** [DROPDOWN_AUDIT.md](./DROPDOWN_AUDIT.md) — the per-form audit
**Status:** Phase E complete. Dropdown-audit track closed.

This document is the closing summary of the work that began with the
DROPDOWN_AUDIT.md audit. It records what was fixed, what was deferred
(with reasons), and what was found to be unnecessary after deeper reading
of the legacy source.

---

## Top-line counts

| Metric | Value |
|---|---|
| Legacy form views audited | 59 (counted by `## *.blade.php` headings in DROPDOWN_AUDIT.md) |
| Audit "YES — fix needed" field rows | ≈ 87 individual field-level fixes called out across those 59 forms |
| Fixes actually applied across Phases A–E | All YES rows in audited forms — see "Items deferred" below for the 4 explicitly out-of-scope buckets |
| Backend route files in the system today | 35 (was 22 at audit time — 13 new routes added) |
| Backend tests: full suite | 9 suites / 65 tests passing as of the E2 commit |
| TypeScript build: app code (non-peer-dep errors) | 0 |

The "fix" counts are field-level rather than form-level because a single
form often had 3–7 separate dropdown sources to repoint, each tracked as a
distinct YES row in the audit. Form-level resolution status lives inside
DROPDOWN_AUDIT.md itself (each form's table marks every row as either NO
or YES — every YES row in an audited form was addressed by the
corresponding lettered phase below).

---

## Backend endpoints added or extended during Phases A–E

Counted by route-file delta against the audit baseline.

**New route files (13):**

| Route file | Mounted at | Phase |
|---|---|---|
| `admin-flow-designs.routes.js` | `/api/v1/admin/flow-designs` | A1 |
| `admin-orders.routes.js` | `/api/v1/admin/orders` | A2 |
| `admin-stop-categories.routes.js` | `/api/v1/admin/stop-categories` | C3 |
| `admin-scrap-categories.routes.js` | `/api/v1/admin/scrap-categories` | C3 (extension) |
| `admin-symbols.routes.js` | `/api/v1/admin/symbols` | C6 |
| `admin-folders.routes.js` | `/api/v1/admin/folders` | C7 |
| `admin-machines.routes.js` | `/api/v1/admin/machines` | D1 |
| `admin-machine-files.routes.js` | `/api/v1/admin/machine-files` | D1 |
| `admin-machine-programmes.routes.js` | `/api/v1/admin/machine-programmes` | D3 |
| `admin-workstations.routes.js` | `/api/v1/admin/workstations` | D4 |
| `admin-iot.routes.js` extensions | `/api/v1/admin/iot/*` | A4 |
| `results.routes.js` (user-scoped) | `/api/v1/results` | **E1** |
| `units.routes.js` (operator) | `/api/v1/units` | **E2** |

**Cascading sub-resources added under existing `equipment.routes.js`** (A3):
`/equipment/:id/parts`, `/equipment/:id/stop-reasons`,
`/equipment/:id/scrap-reasons`, `/equipment/:id/orders`.

**Query-param extensions on existing endpoints:**
- `/admin/types` learned `entity=*&isActive=true`
- `/admin/parts` learned `equipmentId=N`
- `/admin/shift-schedules` learned `date=*&equipmentId=N`
- `/admin/iot/flow-designs` learned `equipmentId=N`
- `/admin/results/warning` learned the PATCH extension (A6)
- `/superadmin/users` learned `roles=Company` (added during the Tenant-removal refactor)

---

## Phase-by-phase summary

- **Phase 0 — Audit (this document's parent).** Catalogued 59 forms × their dropdown sources, surfaced 9 unknowns ("RESOLVED i–ix") that the operator confirmed before any code was written.
- **Phase A — Backend foundation.** 6 sub-items: flow-designs, orders, cascading sub-resources, IoT scoping, warning PATCH extension. Established the API surface every later phase depends on.
- **Phase B — 5 form fixes.** Flow Monitor modals, Work Shift, Types, Parts, IoT Setup, Warning Edit.
- **Phase C — 7 sub-items.** Equipment add/edit + modals, Orders admin, Stop Categories, Shift Schedule events, Result Edit forms, Symbols, Folders.
- **Phase D — 4 sub-items.** Machines + machine-files, machine-programmes, workstations.
- **Tenant model removal (interrupt between D and E).** Dropped the Tenant + TenantUser models. Backend (`tenantMiddleware`, JWT, services), frontend (5 redocumented files + 2 selector rewires), tests (helper + 9 file rewires/rewrites). All 5 audit risks resolved. See `TENANT_REMOVAL.md` and `MIGRATION_NOTES.md §13 entry 32`.
- **Phase E1 — User-side myresult.** Created 3 user-scoped result endpoints (`/results/{production,scrap,stop}`) with ownership checks. Extracted shared `ProductionDataForm.tsx` / `ScrapDataForm.tsx` / `StopDataForm.tsx` components used by both admin and user pages. Ported `myresult` from ComingSoon stub to a 3-tab list+edit page.
- **Phase E2 — Units stop form.** Built `/api/v1/units` operator routes: list units, list unregistered MachineData buckets, batch-register stops (N rows in one transaction), multipart attachment upload. Ported `(user)/units` from ComingSoon stub to a card-grid + 2-step modal: bucket selection → stop form with composite reason Select, per-bucket shift assignment table, file upload, pre-reg toggle.

---

## Items deferred (explicitly out of scope for this audit track)

These were called out in the audit or surfaced during a phase, and were
deliberately left for a future track. Each has a specific reason.

- **C1 Properties tab (per-part `cycle_time` / `cost_per_hour` / `salary_group_id` / `value_added_*`).**
  Reason: tabular per-part editor inside the Equipment add/edit form. The
  audit's "YES" rows for those fields point at endpoints (`/admin/parts`,
  `/admin/salary-groups`) that already exist; what's missing is the
  *editor UI*, not the data source. The deferral is purely UX/scope.

- **User-facing flow editing (`frontend/flow_control/flow_extra.blade.php`).**
  Reason: never finished in legacy (resolved as Phase 0 v2 §viii). Requires
  a GoJS license discussion and a separate UX design before any port can
  start. Marked as "planned, not in this audit track" in MIGRATION_NOTES.

- **Workstation stop-recording fields (D4 deferred).**
  Reason: workstations were ported as a CRUD surface, but the legacy
  per-workstation stop-bucket recording dialog has separate semantics
  from the units stop form (different time bucketing, different reason
  scoping). Out of scope for the dropdown-audit track; needs its own
  pre-implementation analysis like E2 had.

- **B2 multi-break `Form.List` (Work Shift breaks).**
  Reason: legacy `work_shifts` has a JSON `breaks` column that the
  audit flagged as needing a dynamic-row editor. The new schema is
  still settling — the column is mapped to Prisma `Json?` but the row
  shape was never frozen. Deferred until the schema confirms the
  break-row shape (start/end timestamps? minutes-from-start?
  cross-day?).

---

## Items found to be NOT needed after deeper reading

The audit listed these tentatively but a Phase 0 follow-up confirmed they
should never be ported. They appear with the **✅ RESOLVED** marker in
DROPDOWN_AUDIT.md but are restated here as the canonical "not doing this"
list.

- **`backend/company/machine/{add,edit}.blade.php`** — dead code in legacy.
  The `machine.add` route is not registered; the visible CRUD lives under
  `backend/machines/*`. (Resolved vii.)

- **User-facing flow editor `frontend/flow_control/flow_extra.blade.php`**
  — never wired in legacy. UI scaffolding exists but no working save path.
  (Resolved viii. See also the "Items deferred" section above for the
  consequence — we defer rather than re-implement a never-finished
  feature.)

- **`Macros::Dropdowns` (countries, US states, …)** — was a backend macro
  for static data. Replaced in new_fp by a frontend JSON file; no backend
  endpoint needed.

- **`tbl_delay_notifications` queue table** — was a poor-man's queue with
  a select-driven admin UI. Replaced by BullMQ; no admin UI surface
  needed. (See MIGRATION_NOTES §13 entry 7.)

- **`objects` table + `Objects` model** — dead code: a `use` import in
  `DashboardController` with no instantiation. Audit found no UI consuming
  it. (Resolved as MIGRATION_NOTES §13 entry 26.)

- **`/admin/tenants` route and page** — removed as part of the Tenant
  model removal refactor. The audit had marked the tenant picker in
  `users/create` and `feedback` as needing rewiring; that rewiring is
  done. The Tenants list page itself is gone — Administrators discover
  companies via User Management filtered by `roles=Company`.

---

## How to extend this in the future

If a new form is added to legacy or surfaces in production traffic that
isn't in DROPDOWN_AUDIT.md, do **not** edit this file. Instead:

1. Append a new `## Form Name (path/to/blade)` block to DROPDOWN_AUDIT.md.
2. Mark each field row YES/NO using the existing table layout.
3. Run the corresponding lettered phase against the YES rows (or open a
   pre-implementation analysis section if the form has non-obvious
   semantics, as Phase E2 did for the units stop form).
4. After the new fix lands, add a one-line entry to this file's
   phase-by-phase summary.

The dropdown-audit track is *closed*. Future audits should branch from
this baseline rather than reopen it.
