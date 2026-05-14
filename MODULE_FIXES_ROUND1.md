# Module Fixes Round 1 — User Module + Type Management

**Date:** 2026-05-14
**Scope:** MODULE 1 (User Module — role-based create/edit) + MODULE 2 (Type Management — CRUD + icon library picker)

---

## Step 0 — Screenshot inventory

Screenshots in `new_fp/screenshots/module-fixes/`:

| # | File | Caption |
|---|---|---|
| 1 | Screenshot 2026-05-14 at 11.41.59 AM.png | LEGACY Company-Admin create-user form (`fpanalyzer.se/admin/company/useradd`) — fields: First name, Surname, Email address, Password, Confirm password, Time until automatic logout (min) default 5, Active checkbox, Confirmed checkbox, Role radio (User/Admin). Purple-outlined Create button. NO database fields. |
| 2 | Screenshot 2026-05-14 at 11.42.45 AM.png | NEW_FP Salary Group "Edit Salary group" modal (Volvo tenant, impersonating user1@gmail.com) — fields: Name, Hourly Rate, Info. Cancel + teal "Save changes" button. Shown to confirm the new_fp left-nav (Administration → User Management → Users / Salary Group → Type Management …). |
| 3 | Screenshot 2026-05-14 at 11.43.27 AM.png | NEW_FP Super-Admin create-user form (`fptest.com/admin/access/users/create`) — has "Database information" section (Host Name, Database Name, Database Username, Database Password) and "Company information" section. This is the form a Company-Admin sees by mistake. |
| 4 | Screenshot 2026-05-14 at 11.58.02 AM.png | LEGACY Type Management Create Type — Entity dropdown open. Options visible: Choose Entity, Equipments, Stop Reasons, Scrap Reason, Parts, Orders. Fields: Name, Entity, Loss model category, Description, Icon (Choose file / Choose from library buttons), Sort Order, Create button. |
| 5 | Screenshot 2026-05-14 at 11.58.07 AM.png | LEGACY Type Management Create Type — Loss model category dropdown open. Options: Choose Type, Performance, Availability, Quality (Not applicable not visible in this screenshot, likely below fold). |
| 6 | Screenshot 2026-05-14 at 11.58.20 AM.png | LEGACY native file picker opened (macOS Finder sheet) — proves "Choose file" is a real `<input type="file">`. |
| 7 | Screenshot 2026-05-14 at 11.58.30 AM.png | LEGACY "Choose icon" library modal opened — Search box at top right; scrollable list of icon rows (thumbnail + name). Visible: 3d_glasses, Gear-icon-291x300, add, address_book, adhesive_tape, air_tube_carrier, airbrush, airplane. Red "Close" button at bottom-left of modal. |
| 8 | Screenshot 2026-05-14 at 11.58.39 AM.png | LEGACY "Choose icon" modal with Search = "add" — filtered list shows: add, address_book, ladder. Real-time client-side filter by name. |

---

## Module 1 — Legacy source findings

### Routes
| Action | URL | Method | Controller |
|---|---|---|---|
| Super-Admin Create user — GET | `/admin/access/user/create` | GET | `Access\User\UserController@create` (Route::resource `user`, `Backend/Access.php:19`) |
| Super-Admin Create user — POST | `/admin/access/user` | POST | `Access\User\UserController@store` (resource) |
| Company-Admin Create user — GET | `/admin/company/useradd` | GET | `DashboardController@addCompanyUser` (`Backend/Dashboard.php:84`) |
| Company-Admin Create user — POST | `/admin/company/useradd` | POST | `DashboardController@storeCompanyUser` (`Backend/Dashboard.php:85`) |
| Company-Admin Edit user — GET | `/admin/company/useredit/{id}` | GET | `DashboardController@editCompanyUser` |
| Company-Admin Edit user — POST | `/admin/company/useredit` | POST | `DashboardController@updateCompanyUser` |
| Company-Admin User list | `/admin/company/user` | GET | `DashboardController@companyUser` (scoped by `Auth::id()` — `DashboardController.php:307`) |

### storeCompanyUser controller logic (DashboardController.php:320–386)
- Validates: `email|required|unique:users`, `password|required`, `password_confirmation|required`
- Sets `company_id` = caller's company id (via `getUserCompanyId()`)
- Sets `name` = `first_name + ' ' + last_name`
- Inherits `db_name`, `db_username`, `db_password` from `Auth::user()` (multi-tenant carry-over — N/A for new_fp single Postgres)
- `confirmation_code = md5(uniqid())`
- `role_id` defaults to 3 (User); allowed values are 2 (Admin) or 3 (User) — clamps to 3 if `<2`
- Inserts row in `assigned_roles`
- Sends confirmation email if `confirmed` is empty
- Redirects to `/admin/company/user` with flash success

### Company-Admin form field inventory (from `backend/company/add_user.blade.php`)
| Legacy field | Type | Default | Validation |
|---|---|---|---|
| `first_name` | text | empty | required |
| `last_name` | text | empty | required |
| `email` | email | empty | required, unique on users.email |
| `password` | password | empty | required, minlength 5 |
| `password_confirmation` | password | empty | required, minlength 5, equalTo password |
| `session_timeout` | number | **5** | — |
| `status` | checkbox | **checked** | (=`1` if checked, `0` otherwise) |
| `confirmed` | checkbox | disabled in template — value `0` | — |
| `role_id` | radio | `3` (User) | `3`=User, `2`=Admin |

There is **NO** `unit_only`, **NO** `mobile`, **NO** DB-information fields, **NO** `confirmation_email` checkbox in the Company-Admin form. (`unit_only` only appears in the Super-Admin create form — `access/create.blade.php:160`.)

The Company-Admin **Edit** form (`edit_user.blade.php`) has the same field set as the create form; password is optional on edit.

### Role mapping legacy → new_fp
Legacy uses integer `role_id` values; new_fp uses string role names:
- `role_id=2` → role name `Admin`
- `role_id=3` → role name `User`
- (Reference) `Company` role exists only for Super-Admin-created tenant owners; not selectable here.
- (Reference) `Administrator` role exists only at platform level; not selectable here.

### new_fp current state (from Explore agent)
- Admin user POST: `backend/src/routes/admin-users.routes.js:86` → service `services/admin-users.service.js:187` (`create()`)
- Schema provisioning is **inline in `create()`** at `admin-users.service.js:232` — triggered only when `roleNames.includes('Company')`. Sub-users (role=Admin/User) skip provisioning already.
- Auth middleware (`middleware/auth.js:51-60`) puts `req.user.roles` as **string array**, `req.user.companyId`, `req.user.isAdmin`.
- Permission gate on user create: `requirePermission('manage-users')` (`admin-users.routes.js:21`). Company-Admins must hold this permission for the existing endpoint to work for them.
- `MeResponse` (frontend `lib/api/types.ts`) gives `roles: string[]`, `isAdmin`, `activeTenantId` etc.

### Endpoint approach decision (proposed — needs your nod, see Questions below)
The existing `POST /api/v1/admin/users` create service already branches on whether the request creates a `Company` role user (provisions schema) vs a sub-user (no schema). It already accepts `companyId`. The cleanest fix is to:

1. Allow `role=Company` callers to invoke the same endpoint **with constraints**:
   - Force `companyId = req.user.id` on the server (ignore any client-supplied value).
   - Reject role assignments other than `User` / `Admin`.
   - Reject creating users with role `Company` or `Administrator`.
2. Either widen the route's permission gate to also accept callers whose role is `Company`, OR mount a second route `POST /api/v1/company/users` reusing the same service with the constraints above.

**User confirmed option 2.** Implemented at `backend/src/routes/company-users.routes.js` (new file) + mounted at `/api/v1/company/users` in `backend/src/app.js`.

### Module 1 — Backend changes

- New router `backend/src/routes/company-users.routes.js`. Gated by `tenantMiddleware` + `requireRole('Company')`. Reuses `admin-users.service` functions.
  - `POST /` create: forces `companyId = req.user.id`, restricts roles to `User`/`Admin`, never provisions a schema. Accepts both `roles: [...]` and legacy `roleId` (2=Admin, 3=User).
  - `PATCH /:id` update: strips client-supplied `companyId`, restricts roles to `User`/`Admin`.
  - `GET /`, `GET /:id`, `DELETE /:id` (soft), `PATCH /:id/status`, `PATCH /:id/confirm`, `POST /:id/password` — all delegate to admin-users service, which already filters by `companyMembershipFilter(tenant.tenantId)`.
- `backend/src/app.js` mounts the new router at `/api/v1/company/users`.

### Module 1 — Frontend changes

- `frontend/src/lib/api/admin-users.ts` — added `useCreateCompanyUser` + `useUpdateCompanyUser` hooks that POST/PATCH `/company/users[/<id>]` without `X-Tenant-Id`.
- `frontend/src/components/users/CompanyAdminCreateUserForm.tsx` — new component mirroring legacy `backend/company/add_user.blade.php`:
  - First name, Surname, Email address, Password, Confirm password, Time until automatic logout (default 5), Active (default on), Confirmed (default off), Role radio (User/Admin, User default).
  - No DB fields, no `unit_only`, no Associated Roles checklist.
  - Submits to `/api/v1/company/users` via `useCreateCompanyUser`.
  - On success → push to `/admin/access/users`; on 409 email-already-in-use → field-level error.
- `frontend/src/app/(admin)/admin/access/users/create/page.tsx` — early-returns `<CompanyAdminCreateUserForm />` when `me.roles.includes('Company') && !me.isAdmin`. Super-Admin / Administrator path is untouched.
- `frontend/src/app/(admin)/admin/access/users/UserFormModal.tsx` — used for the edit modal on the user detail page. When `useMe()` returns a Company-Admin caller:
  - Uses `useCreateCompanyUser` / `useUpdateCompanyUser` instead of the admin hooks.
  - Shows extra fields: `sessionTimeout` (number, default 5) and a `User` / `Admin` role radio (default = whichever role the user currently has).
  - On save sends `roles: [<choice>]` so the role mutation goes through.
- The list page (`(admin)/admin/access/users/page.tsx`) is untouched. Existing list already calls `useAdminUsers` → `GET /admin/users` which is permission-gated by `manage-users`; `Company` role is seeded with `manage-users` (`backend/prisma/seed.js:47`) and the list service applies `companyMembershipFilter(tenant.tenantId)`, so a Company-Admin already sees only themselves + their sub-users.

### Module 1 — Verification

- `node -c backend/src/routes/company-users.routes.js` → syntax OK.
- `node -c backend/src/app.js` → syntax OK (app boots; routes mount).
- `npx tsc --noEmit` in frontend — no new type errors introduced in `CompanyAdminCreateUserForm.tsx`, `UserFormModal.tsx`, `admin-users.ts`, or the create page. (Pre-existing Highcharts errors in `admin/boards/...` are unrelated.)
- Functional smoke test (curl + browser) — pending the running stack; called out in "Deferred / Out of scope" if not run this round.

## Module 2 — Legacy source findings

### Routes & controller (legacy)
- `routes/Backend/Dashboard.php`: GET `type/add`, POST `type/add`, GET `type/edit/{id}`, POST `type/update`, POST `type/delete`, POST `type/status`, GET `type/view/{id}`.
- Controller: `DashboardController` methods `addType`, `storeType`, `editType`, `updateType`, `statusType`, `deleteType`, `viewType`, `getTypeSummary`.

### Add Type form (legacy `backend/types/add_type.blade.php`)
| Field | Type | Default | Notes |
|---|---|---|---|
| `name` | text | empty | required |
| `entity` | select | empty | required. Values: `Equipments`, `Stop reason`, `Scrap reason`, `Parts`, `Orders` (the option *value*, used as the stored DB value, are display strings). |
| `type` (loss model category) | select | empty | conditional. Shown when entity ≠ Equipments/Parts/Orders. Values: `Performance`, `Availability`, `Quality`. For Stop reason: Quality is hidden in legacy. For Scrap reason: Performance + Availability are hidden. (Per DROPDOWN_AUDIT RESOLVED iii the new_fp set is broader — see note below.) |
| `description` | textarea | empty | rows=5 |
| `icon` | file `<input type=file>` + library button | empty | "Choose from library" opens `#browseModal`. Hidden input `#icon_path` (form name `icon_name`) carries the chosen filename. |
| `sort_order` | text | empty | rendered alongside icon column |
| `exclude_type` | checkbox | unchecked | only shown when entity = `Stop reason` |

### Icon library modal (legacy `backend/includes/icon/modal.blade.php`)
- Reads `public/img/icons/` via PHP `scandir`. Both `public/img/icons/` and `public/build/img/icons/` exist in legacy with the same 1,793 PNGs.
- Each list row: thumbnail (`<img>` lazy-loaded) + filename without extension. `data-text` attribute holds the full filename for the search filter.
- Search box uses substring `text.search(src) >= 0` — client-side filter.
- `getIcon(filename)` closes the modal and sets `#icon_name` text + `#icon_path` hidden-input value to the filename (with extension). Stored DB value = filename string.

### View Type page (legacy `view_type.blade.php`)
- 31 lines. Shows Name / Entity / Description / Icon (img tag) + a Back button. Trivial — the existing SimpleCrudPage "view" action covers an equivalent inspection.

### List page columns (legacy `types.blade.php` lines 35-42)
S.No · Name · Category type · Entity · Description · Icon Preview · Sort Order · Actions.

### Discrepancy vs DROPDOWN_AUDIT RESOLVED iii
Legacy UI hides `Quality` from Stop reason and hides `Performance`/`Availability` from Scrap reason. DROPDOWN_AUDIT broadened the set:
- StopReason → NotApplicable / Performance / Availability / Quality (all four)
- ScrapReason → NotApplicable / Quality
Per the audit (already implemented in `types/page.tsx`), the new_fp set is the broader one. **Kept as-is** — the audit is the authoritative source per the prompt.

### Module 2 — Backend changes

- 1,793 icon PNGs copied from `fpanalyzer/public/build/img/icons/` → `new_fp/frontend/public/equipment-icons/`.
- New router `backend/src/routes/admin-icons.routes.js`. `GET /api/v1/admin/icons[?search=]` — reads `frontend/public/equipment-icons/` via `fs.readdirSync`, filters by `.png/.jpe?g/.svg/.gif/.webp`, sorts case-insensitively by name, caches once per process. Optional `search` param does case-insensitive substring filter server-side; the modal also filters client-side.
- Mounted at `/api/v1/admin/icons` in `app.js`.

### Module 2 — Frontend changes

- `frontend/src/lib/api/icons.ts` — `useIcons()` TanStack Query hook with 5-minute `staleTime`.
- `frontend/src/components/shared/IconLibraryModal.tsx` — AntD `Modal` (width 520) titled "Choose icon". Right-aligned Search input (autofocus); scrollable list (max-height 400px) of rows showing 32×32 thumbnail + filename without extension. Click a row → `onSelect(filename)` + close. Red `Close` button in footer matches legacy.
- `frontend/src/components/data-table/SimpleCrudPage.tsx` — extended the `SimpleField` discriminated union with a new variant `type: 'icon-picker'`. `renderField` adds a case that uses a small internal `IconPickerInput` component (works with AntD Form's value/onChange contract). Displays current 32×32 preview + filename, a teal "Choose from library" button, and a Clear button when a value is set.
- `frontend/src/app/(admin)/admin/types/page.tsx`:
  - Entity labels updated to match legacy: Equipments / Stop Reasons / Scrap Reason / Parts / Orders (stored enum values unchanged).
  - Icon field switched from plain `text` to `icon-picker`.
  - List columns: added an "Icon Preview" column rendering a 28×28 thumbnail from `/equipment-icons/<filename>` (em-dash when empty), placed between Description and Sort to match legacy order.

### Module 2 — Verification

- `node -c backend/src/app.js` and `backend/src/routes/admin-icons.routes.js` → syntax OK.
- Standalone Node smoke of the readdir logic against the live `equipment-icons/` directory → `icons found: 1793`. First entries: `3d_glasses.png, Gear-icon-291x300.png, add.png`.
- `npx tsc --noEmit` (excluding pre-existing Highcharts errors) → zero new type errors in `types/page.tsx`, `SimpleCrudPage.tsx`, `IconLibraryModal.tsx`, `icons.ts`.
- Full CRUD click-through with running backend + frontend — pending; see Deferred below.

## Deferred / Out of scope

- Live browser smoke (Create / Edit / Delete / View Type, role-based User create with a real Company-Admin session) — not run this round. The static checks (syntax, type-check, standalone icon-load) all pass. Smoke testing requires the running stack and a Company-Admin login.
- Legacy `view_type` blade is trivial (Name + Entity + Description + Icon img + Back button). Not ported as a separate "View Type" page — the existing SimpleCrudPage row-detail UX covers it. Flag if you want a dedicated full-page View.
- Legacy hides Quality from Stop reason and Performance/Availability from Scrap reason in the UI; new_fp shows the broader set per DROPDOWN_AUDIT. Flag if you want the legacy hide-set instead.
- `unitOnly` field on Company-Admin create user — present in Super-Admin form, absent in legacy Company-Admin form, omitted from `CompanyAdminCreateUserForm` to match legacy. Flag if Company-Admins should also see it.

