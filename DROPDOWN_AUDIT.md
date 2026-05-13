# DROPDOWN_AUDIT.md — Form select / option-source audit (legacy → new_fp)

**Audit date:** 2026-05-13
**Legacy:** `/Applications/XAMPP/xamppfiles/htdocs/fpanalyzer` (Laravel 5.8 / PHP 7.2 EOL, Blade + LaravelCollective Form)
**New:** `/Applications/XAMPP/xamppfiles/htdocs/new_fp` (Next.js 14+ App Router + AntD; backend = Express + Prisma, **not** NestJS as the audit brief assumed)

This audit covers Step 0 only. **No code has been modified.** Approval required before any fix is applied.

---

## 0. Top-level findings & corrections to the audit brief

These are facts you should review **before** approving fixes — they change the scope.

1. **Backend stack is Express, not NestJS.** Routes live in `new_fp/backend/src/routes/*.routes.js` (mounted via `new_fp/backend/src/app.js`), services in `services/*.service.js`. There are no `@Controller`/`@Module` decorators. Any references to "create a NestJS module" in the brief should read "create a route file + service in `new_fp/backend/src/routes` and `services` and mount it in `app.js`".

2. **New_fp API base is `/api/v1`, and most dropdown sources are mounted at `/api/v1/admin/...`** — not `/api/v1/admin/equipment/...` or `/api/v1/equipment/...` mix the brief implied. Currently mounted (verified in `app.js` lines 104–134):

   | Mounted path                          | Route file                              |
   |---------------------------------------|-----------------------------------------|
   | `/api/v1/health`                      | `health.routes.js`                      |
   | `/api/v1/auth`                        | `auth.routes.js`                        |
   | `/api/v1/me`                          | `me.routes.js`                          |
   | `/api/v1/admin/tenants`               | `tenants.routes.js`                     |
   | `/api/v1/admin/roles`                 | `roles.routes.js`                       |
   | `/api/v1/equipment`                   | `equipment.routes.js`                   |
   | `/api/v1/admin/types`                 | `admin-types.routes.js`                 |
   | `/api/v1/admin/users`                 | `admin-users.routes.js`                 |
   | `/api/v1/admin/stop-reasons`          | `admin-stop-reasons.routes.js`          |
   | `/api/v1/admin/scrap-reasons`         | `admin-scrap-reasons.routes.js`         |
   | `/api/v1/admin/stop-categories`       | `admin-stop-categories.routes.js`       |
   | `/api/v1/admin/scrap-categories`      | `admin-scrap-categories.routes.js`      |
   | `/api/v1/admin/parts`                 | `admin-parts.routes.js`                 |
   | `/api/v1/admin/work-shifts`           | `admin-work-shifts.routes.js`           |
   | `/api/v1/admin/shift-schedules`       | `admin-shift-schedules.routes.js`       |
   | `/api/v1/admin/results`               | `admin-results.routes.js`               |
   | `/api/v1/admin/salary-groups`         | `admin-salary-groups.routes.js`         |
   | `/api/v1/admin/feedback`              | `admin-feedback.routes.js`              |
   | `/api/v1/admin/boards`                | `admin-boards.routes.js`                |
   | `/api/v1/admin/cms`                   | `cms.routes.js`                         |
   | `/api/v1/admin/sliders`               | `sliders.routes.js`                     |
   | `/api/v1/admin/testimonials`          | `testimonials.routes.js`                |
   | `/api/v1/admin/social`                | `social.routes.js`                      |
   | `/api/v1/admin/history`               | `recent-history.routes.js`              |
   | `/api/v1/admin/iot`                   | `admin-iot.routes.js`                   |
   | `/api/v1/superadmin`                  | `superadmin-users.routes.js`            |

3. **Backend endpoints required by the audit but NOT mounted yet** (must be added before the matching frontend fix can be wired):
   - `/api/v1/admin/flow-designs` — required by Orders, Result forms, Monitor flow picker, Units stop form, IoT flow filter
   - `/api/v1/admin/orders` (or `/api/v1/admin/equipment/:id/orders`) — required by Orders pages, Monitor shift form, Units stop form
   - `/api/v1/admin/equipment/:id/parts` (cascading filter)
   - `/api/v1/admin/equipment/:id/stop-reasons` (cascading filter, equipment-scoped + Types-grouped)
   - `/api/v1/admin/equipment/:id/scrap-reasons` (cascading filter)
   - `/api/v1/admin/machines` — required by Machine Setup, Machine Programmes, Workstations forms
   - `/api/v1/admin/machine-programmes`
   - `/api/v1/admin/machine-files`
   - `/api/v1/admin/workstations`
   - `/api/v1/admin/folders`
   - `/api/v1/admin/symbols`
   - `/api/v1/admin/warning-data` *(service file exists at `services/admin-warning-data.service.js` but no route file)*

4. **Most new_fp form pages are still mock placeholders, not actual ports.** Roughly two-thirds of the legacy form views map to a new_fp page that is either:
   - a `<ComingSoon>` stub (orders, parts, types is partially real, symbols, folders, machines, machine-programmes, machine-files, workstations, user-side `myresult`, user-side `units`, IoT software), **or**
   - a list page with no Add/Edit modal at all (`results/{production,scrap,stop}` Edit button shows `message.info('Edit not yet implemented')`), **or**
   - a list+modal page where the modal uses `MOCK_ROWS` and plain `<Input>` fields where selects belong (`equipment/page.tsx`).
   This audit treats those cases as **"NOT PORTED — YES, full port + selects required"**, not as `<Input>→<Select>` substitutions.

5. **Legacy form view files in the audit brief that DO NOT EXIST** in the legacy repo (paths the brief assumed):
   - `equipments/add.blade.php`, `equipments/edit.blade.php` (actual names are `add_equipments.blade.php`, `edit_equipments.blade.php`, plus modal variants `add_ajax_equipment.blade.php`, `edit_ajax_equipments.blade.php`)
   - `orders/add.blade.php` exists in `backend/orders/` AND `frontend/orders/` — there are **four** order forms, not two
   - `production/parts/*.blade.php` (actual paths: `backend/parts/`, `backend/types/`)
   - `production/types/*.blade.php`
   - `result/form_stop.blade.php`, `form_scrap.blade.php` (actual names: `form_stop_data.blade.php`, `form_scrap_data.blade.php`)
   - `access/create.blade.php`, `edit.blade.php` (actual paths: `backend/access/create.blade.php`, `backend/access/edit.blade.php` — yes exists, plus role variants under `access/roles/`)
   - `machine/add.blade.php`, `edit.blade.php`, `setup.blade.php` (actual: `backend/machines/{add,edit}_machine.blade.php`, `backend/machine/configured_unit.blade.php` and friends)

6. **NEEDS INVESTIGATION — RESOLVED 2026-05-13:**

   - **i. ✅ RESOLVED.** `/api/v1/admin/stop-categories` = legacy `stop_category` table (current new_fp behavior is correct). `/api/v1/admin/scrap-categories` = `types WHERE entity='ScrapReason'`. **These are two different tables; do not merge them.** Form field labels stay as-is on stop-reasons / scrap-reasons admin pages.

   - **ii. ✅ RESOLVED.** Canonical `types.entity` enum = **PascalCase singular** as currently implemented in new_fp: `Equipment`, `StopReason`, `ScrapReason`, `Part`, `Order`, `Content`. Legacy values (`Equipments`, `Stop reason`, `Scrap reason`, `Parts`, `Orders`) are migration-time source values only. Mapping table to be added to `MIGRATION_NOTES.md §6`. `Content` is valid for folder types (no legacy equivalent).

   - **iii. ✅ RESOLVED.** Canonical `types.type` enum = `Performance`, `Availability`, `Quality`, `NotApplicable`. **Drop `Other` from new_fp** — it was a speculative addition with no legacy data. Conditional visibility on form:
     - `StopReason` entity: show `Performance`, `Availability`, `Quality`, `NotApplicable`
     - `ScrapReason` entity: show `Quality`, `NotApplicable`
     - Any other entity: **hide the field entirely**

   - **iv. ✅ RESOLVED.** Equipment-scoped + grouped is the canonical behavior; the current flat tenant-wide lists are a **regression to fix**:
     - `GET /api/v1/admin/iot/stop-reasons?equipmentId=:id` → reasons scoped to that equipment's `EquipmentStopReason` rows, grouped by Type for `<Select>` optgroup / AntD groupLabel.
     - `GET /api/v1/admin/iot/flow-designs?equipmentId=:id` → only flows whose `nodeDataArray` contains a node matching the equipment id.
     Both endpoints extended in Phase A4 before any IoT setup UI is fixed.

   - **v. ✅ RESOLVED.** Warning Edit canonical schema = `equip_id` + `from_time` + `to_time` are user-editable; `duration` is computed (`to_time − from_time`) server-side and stored read-only. **Current new_fp edit-duration-directly behavior is wrong.** `PATCH /api/v1/admin/results/warning/:id` accepts `equipId`, `fromTime`, `toTime` and recomputes duration. Fix in Phase A5 + Warning module.

   - **vi. ✅ RESOLVED.** Dual `work_shift` submit is canonical: backend `POST /api/v1/admin/results/*` accepts either `workShiftId` (integer FK) OR `workShiftName` (string). Store whichever is provided. `work_shift_name` column is the display value for result lists.

   - **vii. ✅ RESOLVED.** `backend/company/machine/{add,edit}.blade.php` is **dead code** — route `machine.add` is not registered, superseded by `backend/machines/*`. Skip the port.

   - **viii. ✅ RESOLVED.** User-facing flow editing is **out of scope for Phase 4**. `frontend/flow_control/flow_extra.blade.php` was never finished in legacy. Mark as "planned, not in Phase 4" in `MIGRATION_NOTES.md §8`. Requires GoJS license + separate UX design.

   - **ix. ✅ RESOLVED.** Canonical `counter_date` option set = **9 legacy values** with corrected spelling: `today`, `yesterday`, `this_week`, `week_to_week`, `previous_week`, `this_month`, `previous_month`, `this_year`, `previous_year`. Backend accepts the legacy typo `"yestarday"` on read for backward compatibility but always writes the corrected `"yesterday"`. Current new_fp 3-value set (`daily/weekly/monthly`) is a regression to fix in Phase B5.

7. **Endpoint behavior to confirm** (mounted but query-param support unknown — please verify before wiring):
   - `GET /api/v1/admin/types` — does it accept `?entity=…` and `?is_active=Y` filters?
   - `GET /api/v1/admin/parts` — does it accept `?equipmentId=…`?
   - `GET /api/v1/admin/shift-schedules` — does it accept `?date=YYYY-MM-DD&equipmentId=…` (legacy `getShiftScheduleTitleByTimeAll` analogue)?
   - `GET /api/v1/equipment` — does it support flat/tree shape switch, and `?flowId=…` for the cascading equipment lookup?
   - `GET /api/v1/admin/iot/stop-reasons` and `/iot/flow-designs` — do they accept `?equipmentId=…` for per-unit scoping?

---

# Module 1 — Equipment Management

## Add Equipment (`resources/views/backend/equipments/add_equipments.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/equipment/page.tsx` *(create flow is a stubbed AntD `<Modal>` on MOCK_ROWS, fields are plain `<Input>`)*
**Legacy route:** `GET /admin/equipment/add` / `POST /admin/equipment/add` (route name `AddEquipment`)
**Legacy controller@method:** `Backend\DashboardController@addEquipment` / `@storeEquipment`

| Field name | Legacy source | Legacy options (if static) | new_fp current state | Fix needed |
|---|---|---|---|---|
| parent_id | custom tree-picker over `equipments where parent_id=0 and is_active='Y'` (hidden input populated by JS) | — | plain `<Input name="parentName">` (mock) | YES — `<TreeSelect>` from `GET /api/v1/equipment` (tree shape). Non-standard widget; do NOT use a flat Select. |
| type_id | `types where entity='Equipments' and is_active='Y'` | — | plain `<Input name="typeName">` (mock) | YES — `<Select>` from `GET /api/v1/admin/types?entity=Equipment&is_active=Y` (verify entity-filter support — Top-level finding 7) |
| reason_stops[] | checkboxes over `types where entity='Stop reason'`, pre-checked from `equipment_stop_reasons` | — | NOT PORTED | YES — `<Checkbox.Group>` (or `<Select mode="multiple">`) from `GET /api/v1/admin/types?entity=StopReason` |
| reason_scraps[] | checkboxes over `types where entity='Scrap reason'`, pre-checked from `equipment_scrap_reasons` | — | NOT PORTED | YES — `<Checkbox.Group>` from `GET /api/v1/admin/types?entity=ScrapReason` |
| reason_parts[] | checkboxes over `types where entity='Parts'`, pre-checked from `equipment_part_types` | — | NOT PORTED | YES — `<Checkbox.Group>` from `GET /api/v1/admin/types?entity=Part` |
| reason_orders[] | checkboxes over `types where entity='Orders'`, pre-checked from `equipment_order_types` | — | NOT PORTED | YES — `<Checkbox.Group>` from `GET /api/v1/admin/types?entity=Order` |
| schedule_id | radio over `ShiftSchedule where status=1`, pre-selected from `equipment_schedule` | — | NOT PORTED | YES — `<Radio.Group>` from a shift-schedules listing endpoint (mount `/admin/shift-schedules` exists; verify list shape) |
| asato_child_stop / _scrap / _part / _order | checkboxes | `1` | NOT PORTED | YES — `<Checkbox>` per tab |
| also_assign_import | checkbox | `1` | NOT PORTED | YES — `<Checkbox>` |
| order_selection | radio | `free_text`, `list` | NOT PORTED | YES — `<Radio.Group>` hardcoded (drives whether order_no is `<Input>` or `<Select>` in flow_monitor / units forms) |
| cycle_time_type (UI-only, drives per-part editor) | `types where entity='Parts'` | — | NOT PORTED | YES — `<Select>` from `GET /api/v1/admin/types?entity=Part` |
| salary_group (UI-only, per part) | `SalaryGroup::pluck('name','id')` | — | NOT PORTED | YES — `<Select>` from `GET /api/v1/admin/salary-groups` ✓ (endpoint mounted) |
| value_added_type | radio | `currency`, `percentage` | NOT PORTED | YES — `<Radio.Group>` hardcoded |
| cycle_time | text HH:MM:SS | — | NOT PORTED | YES — masked `<Input>` or `<TimePicker>` (out of select scope but noted) |
| name / description / sort_order / cost_per_hour / currency / operator / value_added_val | text/number/textarea | — | (only name/description/sortOrder in mock modal) | n/a (not select fields) |
| icon / icon_name | file upload + library picker (non-standard) | — | NOT PORTED | n/a (file upload, not select) |

## Edit Equipment (`resources/views/backend/equipments/edit_equipments.blade.php`)
**New_fp page:** NOT YET PORTED (the row dropdown "Edit" item is wired to nothing)
**Legacy route:** `GET /admin/equipment/edit/{id}` / `POST /admin/equipment/update` (route name `EditEquipment`)
**Legacy controller@method:** `Backend\DashboardController@editEquipment` / `@updateEquipment`

Field list and select sources are identical to **Add Equipment** above (same Blade variables `$type`, `$stop_types`, `$scrap_types`, `$part_types`, `$order_types`, `$schedule_types`, `$salary_groups`, plus pre-selected `$equip_*_types` arrays and `$equipmentProperty` JSON). All YES rows above apply. **Pre-select pitfall:** on edit, options must be loaded before initialValues are set or the AntD `<Select>` will display the raw numeric ID — see Step 6 in the brief.

## Add Equipment Modal (`resources/views/backend/equipments/add_ajax_equipment.blade.php`)
**New_fp page:** NOT YET PORTED (no add-child modal exists on the equipment tree)
**Legacy route:** rendered via AJAX from the equipment-tree "+" button; submits to `AddEquipment`
**Legacy controller@method:** `Backend\DashboardController@add_equipment_modal` → `@storeEquipment`

Same field set as Add Equipment. All fixes identical.

## Edit Equipment Modal (`resources/views/backend/equipments/edit_ajax_equipments.blade.php`)
**New_fp page:** NOT YET PORTED
**Legacy route:** `POST /admin/equipment/update-modal` (route name `EditEquipmentModal`)
**Legacy controller@method:** `Backend\DashboardController@editAjaxEquipment` → `@updateEquipmentModal`

Same field set as Edit Equipment. All fixes identical.

## Stop Reason Form (`resources/views/backend/equipments/form_stop_reason.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/equipment/stop-reasons/page.tsx`
**Legacy route:** `GET /admin/equipment/form_stop_reason/{id?}` / `POST /admin/equipment/save_stop_reason` (route `saveEquipmentStopReason`)
**Legacy controller@method:** `Backend\DashboardController@formEquipmentStopReason` / `@saveEquipmentStopReason`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| type_id | `types where entity='Stop reason' and is_active='Y'` | — | `<Select>` from API ✓ (uses `/admin/stop-categories`, labeled "Category", field `typeId`) | NO — but pending Top-level finding 6.i (confirm stop-categories vs types-with-entity mapping) |
| name | text | — | `<Input>` ✓ | NO |
| description | textarea | — | `<Input.TextArea>` ✓ | NO |
| sort_order | text | — | `<InputNumber>` ✓ | NO |

## Scrap Reason Form (`resources/views/backend/equipments/form_scrap_reason.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/equipment/scrap-reasons/page.tsx`
**Legacy route:** `GET /admin/equipment/form_scrap_reason/{id?}` / `POST /admin/equipment/save_scrap_reason` (route `saveEquipmentScrapReason`)
**Legacy controller@method:** `Backend\DashboardController@formEquipmentScrapReason` / `@saveEquipmentScrapReason`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| type_id | `types where entity='Scrap reason' and is_active='Y'` | — | `<Select>` from API ✓ (uses `/admin/scrap-categories`) | NO — pending Top-level finding 6.i |
| name | text | — | `<Input>` ✓ | NO |
| description | textarea | — | `<Input.TextArea>` ✓ | NO |
| sort_order | text | — | `<InputNumber>` ✓ | NO |

## Stop Category Form (`resources/views/backend/equipments/stop_category.blade.php`)
**New_fp page:** NOT YET PORTED (no dedicated stop-category create form; `/admin/stop-categories` is currently only consumed as an option source)
**Legacy route:** `POST /admin/users/saveStopCategory` (route `saveStopCategory`)
**Legacy controller@method:** `Backend\DashboardController@saveStopCategory`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| name | text | — | NOT PORTED | n/a |
| type | hardcoded | `Performance`, `Availability`, `Quality`, `Other` | NOT PORTED | YES — `<Select>` hardcoded (next-intl labels) |
| description | textarea | — | NOT PORTED | n/a |
| icon_name | library picker | — | NOT PORTED | n/a |

## Equipment Tree (`resources/views/backend/equipments/...` tree partials)
**New_fp page:** `frontend/src/app/(admin)/admin/equipment/tree/page.tsx`
**Legacy controller@method:** `Backend\DashboardController@getEquipments`

No selects. New_fp uses AntD `<Tree>` from `useEquipmentTree(null)`. Read-only display, **NO fix**.

---

# Module 2 — Production Management (Types, Parts, Salary Groups, Orders, Work-Shifts, Shift-Schedule, Symbols, Folders)

## Add Type (`resources/views/backend/types/add_type.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/types/page.tsx` *(shared add/edit modal in `SimpleCrudPage`)*
**Legacy route:** `GET /admin/type/add` / `POST /admin/type/add`
**Legacy controller@method:** `Backend\DashboardController@addType` / `@storeType`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| entity | hardcoded | `Equipments` / `Stop reason` / `Scrap reason` / `Parts` / `Orders` | `<Select>` hardcoded — values `Equipment` / `Content` / `StopReason` / `ScrapReason` / `Part` / `Order` | YES — value strings diverge (Top-level finding 6.ii). Reconcile enum (server-side mapping OR rename one side) before relying on this select to power filter queries. |
| type (kind / loss_model_category) | hardcoded, only shown when entity ∈ Stop/Scrap reason; legacy JS hides Performance/Availability for Scrap and Quality for Stop | `Performance`, `Availability`, `Quality` (+ implicit default `Not applicable`) | `<Select>` hardcoded — values `NotApplicable` / `Performance` / `Availability` / `Quality` / `Other` — **always visible** | YES — add conditional visibility (show only when entity is StopReason or ScrapReason), and reconcile `Other` (not in legacy) (Top-level finding 6.iii) |
| exclude_type | hardcoded checkbox, only shown when entity=`Stop reason` | `1` | NOT PORTED | YES — conditional `<Checkbox>` (legacy hides for non-stop) |
| name / description / sort_order | text / textarea / number | — | `<Input>` / `<Input.TextArea>` / `<InputNumber>` ✓ | NO |
| icon (file) / icon_name | file upload + library picker | — | plain `<Input>` named `iconFilename` | (out of select scope; file uploader is a separate concern) |

## Edit Type (`resources/views/backend/types/edit_type.blade.php`)
Same modal as Add Type. Same fixes apply. New_fp adds an `isActive` `<Switch>` which has no legacy equivalent on this form — acceptable addition, not a bug.

## Add Part (`resources/views/backend/parts/add.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/parts/page.tsx` *(shared add/edit modal)*
**Legacy route:** `GET /admin/production/part-add` / `POST /admin/production/part-add` (route `addPart`)
**Legacy controller@method:** `Backend\DashboardController@addPart` / `@storePart`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| type (saved to `type_id`) | `Form::select('type', $type, ...)` where `$type = types where entity='Parts' and is_active='Y'` | — | plain numeric `<InputNumber name="typeId">` | YES — `<Select>` from `GET /api/v1/admin/types?entity=Part` |
| name / part_no / description / purchase_price / sales_price / sort_order | text / number / textarea | — | `<Input>` / `<InputNumber>` / `<Input.TextArea>` ✓ | NO |

## Edit Part (`resources/views/backend/parts/edit.blade.php`)
Same modal as Add Part. Same fix needed for `type` → `<Select>` from `/admin/types?entity=Part`.

## Add Salary Group (`resources/views/backend/salary_group/add_form.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/access/salary-groups/page.tsx`
**Legacy route:** `POST /admin/company/salaryGroup/save`
**Legacy controller@method:** `Backend\Access\User\UserController@addSalaryGroup` / `@saveSalaryGroup`

No `<select>` fields. **NO fix needed.**

## Edit Salary Group (`resources/views/backend/salary_group/edit_form.blade.php`)
Same modal; **NO fix needed.**

## Add Order — backend (`resources/views/backend/orders/add.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/orders/page.tsx` — `<ComingSoon>` stub
**Legacy route:** `GET /admin/production/order-add` / `POST /admin/production/order-add` (route `AddOrder`)
**Legacy controller@method:** `Backend\OrderController@addOrder` / `@storeOrder`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| type_id | `types where entity='Orders' and is_active='Y'` | — | NOT PORTED | YES — `<Select>` from `GET /api/v1/admin/types?entity=Order` |
| **flow_id** | `flow_designs where status=1` | — | NOT PORTED | YES — `<Select>` from `GET /api/v1/admin/flow-designs` *(endpoint missing — needs backend addition)* — **parent of cascade**; changing must clear `equip_id` and `part_id` |
| **equip_id** | AJAX `GET /admin/production/getEquipmentsByFlowId/{flow_id}` | — | NOT PORTED | YES — `<Select>` cascading on flow_id from `GET /api/v1/admin/equipment?flowId=:id` (or new endpoint) *(endpoint missing)* — **child of flow_id**; changing must clear `part_id` |
| **part_id** | AJAX `GET /admin/production/getPartsByEquipmentId/{equip_id}` | — | NOT PORTED | YES — `<Select>` cascading on equip_id from `GET /api/v1/admin/parts?equipmentId=:id` (verify `/admin/parts` supports this filter) — **grandchild of flow_id** |
| order_nr / description | text | — | NOT PORTED | n/a |
| start_date / end_date | datetimepicker | — | NOT PORTED | n/a (date fields, not selects) |
| planned_hrs / planned_qty / ok_qty / scrap_qty / worked_hrs / remaining_hrs / remaining_qty / sort_order | number | — | NOT PORTED | n/a |

## Edit Order — backend (`resources/views/backend/orders/edit.blade.php`)
**New_fp page:** same `orders/page.tsx` ComingSoon
**Legacy route:** `GET /admin/production/order-edit/{id}` / `POST /admin/production/order-update` (route `EditOrder`)
**Legacy controller@method:** `Backend\OrderController@editOrder` / `@updateOrder`

Same fields as Add Order — same cascading chain `flow_id → equip_id → part_id`, all NOT PORTED. **Pre-select pitfall** applies (initialValues must wait for cascading queries to resolve).

## Add Order — frontend (`resources/views/frontend/orders/add.blade.php`)
**New_fp page:** `frontend/src/app/(user)/orders/page.tsx` — `<ComingSoon>` stub
**Legacy route:** `GET /order-add` / `POST /order-add` (route `FrontAddOrder`)
**Legacy controller@method:** `Backend\OrderController@addOrder` (shared with admin; branches on `REQUEST_URI`)

Same fields as backend Add Order **minus** `sort_order` (frontend form omits this). Cascading chain same: `flow_id → equip_id → part_id`. All NOT PORTED.

## Edit Order — frontend (`resources/views/frontend/orders/edit.blade.php`)
**New_fp page:** same `orders/page.tsx` ComingSoon
**Legacy route:** `GET /order-edit/{id}` / `POST /order-update` (route `FrontEditOrder`)
**Legacy controller@method:** `Backend\OrderController@editOrder` / `@updateOrder`

Same as frontend Add Order; cascading same. All NOT PORTED.

## Add Work Shift (`resources/views/backend/work_shifts/add.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/work-shifts/page.tsx` *(`SimpleCrudPage` shared modal — text-only fields)*
**Legacy route:** `GET /admin/production/shift-add` / `POST /admin/production/shift-add` (route `AddWorkShift`)
**Legacy controller@method:** `Backend\DashboardController@addWorkShift` / `@storeWorkShift`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| working_days[] | checkboxes from hardcoded `$days` Mon..Sun (values 1..7) + "All days" toggle | Monday..Sunday | plain text `<Input name="workingDays">` | YES — `<Checkbox.Group>` with options `[{label:'Mon',value:1}…{value:7}]` (or `<Select mode="multiple">`); persist as comma-separated `1..7` to match legacy `work_shifts.working_days` |
| name / start_time / end_time | text / time | — | `<Input>` / `<Input type="time">` | NO (functional — TimePicker would match better) |
| break_start_time[] / break_end_time[] | repeating clockpicker pairs (legacy stores as `HH:mm-HH:mm` CSV in `break_times`) | — | single `<Input type="time">` per side | YES — convert to `<Form.List>` of `<TimePicker>` pairs (this is the "rendered as plain text input" anti-pattern the brief calls out, but it's a `<Form.List>` issue not a `<Select>` issue — still in scope of the form-correctness audit) |

## Edit Work Shift (`resources/views/backend/work_shifts/edit.blade.php`)
Same modal as Add Work Shift. Same fixes: `working_days[]` → `<Checkbox.Group>`; break times → `<Form.List>`.

## Create / Edit Shift Schedule (`resources/views/backend/shift_schedule/create.blade.php`)
**New_fp page:** list at `frontend/src/app/(admin)/admin/shift-schedules/page.tsx`; calendar at `shift-schedules/[id]/edit/page.tsx`
**Legacy route:** `GET /admin/production/AddShiftSchedule` (route `addShiftSchedule`) / `EditShiftSchedule/{id}`; sub-form posts to `production/StoreShiftScheduleData`
**Legacy controller@method:** `Backend\ShiftScheduleController@addShiftSchedule` / `@editShiftSchedule`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| c_title / c_description (header) | text / textarea | — | `<Input>` / `<Input.TextArea>` ✓ | NO |
| f_c_title (event modal title) | text | — | `window.prompt()` — no `<Form.Item>` | YES — replace `prompt()` with `<Modal>`+`<Form.Item name="title">` |
| is_reccuring (event modal) | radio | `0` Once / `1` Repeats | NOT PORTED | YES — `<Radio.Group>` hardcoded |
| repeat_day[] (event modal) | checkboxes | Mon/Tue/Wed/Thu/Fri/Sat/Sun (values 1..6,0 — legacy uses 0 for Sunday) | NOT PORTED | YES — `<Checkbox.Group>` (preserve legacy value mapping or migrate to 1..7) |
| end_date_type (event modal) | `<select>` hardcoded | `1` None / `2` By date / `3` No. of occurrence | NOT PORTED | YES — `<Select>` hardcoded; must show/hide `f_c_r_end_date` vs `f_c_end_occurence` based on value (UI cascade) |
| f_c_r_end_date | datetimepicker (shown when end_date_type=2) | — | NOT PORTED | YES — `<DatePicker>` |
| f_c_end_occurence | text count (shown when end_date_type=3) | — | NOT PORTED | YES — `<InputNumber>` |
| color_picker_textcolor / color_picker_background | spectrum color picker | — | hardcoded `#ffffff` / `#3788d8` | YES — `<ColorPicker>` (out of select scope but flagged) |
| series_single_edit | hidden | — | NOT PORTED | YES — hidden field for edit-occurrence vs edit-series flow |

## Add Symbol (`resources/views/backend/symbol/add_symbol.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/symbols/page.tsx` — `<ComingSoon>` stub
**Legacy route:** `POST /admin/symbol/add` (route `AddSymbol`)
**Legacy controller@method:** `Backend\SymbolController@addSymbol` / `@storeSymbol`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| type | hardcoded array in Blade | Company / Department / Machining / Line / LinePosition / Machine / Assembly / MachineStation / BackupFiles / Folder / Manuals / Drawings / Programs (13 values + "Choose type" placeholder) | NOT PORTED | YES — `<Select>` hardcoded (string values, not IDs) |
| description | textarea | — | NOT PORTED | n/a |
| filename | file upload | — | NOT PORTED | n/a |

## Edit Symbol (`resources/views/backend/symbol/edit_symbol.blade.php`)
Same 13-value `type` select. Same fix. *Backend route `/api/v1/admin/symbols` is **not mounted** — needs backend addition.*

## Add Folder (`resources/views/backend/folders/add_folder.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/folders/page.tsx` — `<ComingSoon>` stub
**Legacy route:** `POST /admin/folder/add` (route `AddFolder`)
**Legacy controller@method:** `Backend\DashboardController@addFolder` / `@storeFolder`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| folder_type | `types where entity='Content' and is_active='Y'` (prepended with placeholder) | — | NOT PORTED | YES — `<Select>` from `GET /api/v1/admin/types?entity=Content` |
| equipment_id (hidden + tree) | recursive equipment tree from `Equipments where parent_id=0` | — | NOT PORTED | YES — `<TreeSelect>` from `GET /api/v1/equipment` (tree shape) |
| name | text | — | NOT PORTED | n/a |

*Backend route `/api/v1/admin/folders` is **not mounted** — needs backend addition.*

## Edit Folder (`resources/views/backend/folders/edit_folder.blade.php`)
Same fields. Same fixes.

---

# Module 3 — Flow Management

## Edit Flow / Flow designer canvas (`resources/views/backend/flow_control/edit_flow.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/flow-designs/page.tsx` *(table-only port; GoJS canvas not implemented yet)*
**Legacy route:** `GET /admin/flow/edit_flow/{id?}` (route `editFlowTest`)
**Legacy controller@method:** `Backend\DashboardController@editFlowTest`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| flow_id (open-flow select in `flow_extra`) | `$flows = FlowDesigns::get()` (all rows, includes inactive) | — | NOT PORTED (no canvas) | YES (when canvas wired) — `<Select>` from `GET /api/v1/admin/flow-designs` *(endpoint missing — needs backend addition)* |
| flow_name (edit-modal text) | text | — | `<Input name="name">` in Add modal ✓ | NO |

## Add Flow (`resources/views/backend/flow_control/add_flow.blade.php`)
**New_fp page:** Add Flow Design modal on `flow-designs/page.tsx`
**Legacy route:** `GET /admin/flow/add_flow_test` (route `addFlowDesignTest`)
**Legacy controller@method:** `Backend\DashboardController@addFlowDesignTest`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| flow_name | text | — | `<Input name="name">` ✓ | NO |
| status | inferred from controller default | Active / Inactive | `<Switch name="status">` ✓ | NO |

## Flow Extra (`resources/views/backend/flow_control/flow_extra.blade.php`)
**New_fp page:** NOT YET PORTED (modals are blocked on GoJS canvas)

Same `flow_id` select source (`$flows = FlowDesigns::get()`); same YES fix once canvas is wired. *(endpoint missing)*

## Flow Extra — frontend (`resources/views/frontend/flow_control/flow_extra.blade.php`)
**New_fp page:** NOT YET PORTED ((user) area has no flow editing pages)
**Source of `$flows`:** NEEDS INVESTIGATION (Top-level finding 6.viii) — user-facing flow editor was apparently never fully wired in legacy

---

# Module 4 — Result Management

## Production data Edit — admin (`resources/views/backend/result/form_production.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/results/production/page.tsx` *(list-only; Edit shows `message.info('Edit not yet implemented')`)*
**Legacy route:** `GET /admin/result/formResultProduction/{id?}` / `POST /admin/result/saveResultProduction`
**Legacy controller@method:** `Backend\DashboardController@formResultProduction` / `@saveResultProduction`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| part_id | `parts table` | — | NOT PORTED | YES — `<Select>` from `GET /api/v1/admin/parts` |
| work_shift_id / work_shift_name | `work_shifts table` AND `shift_schedules` titles via `getShiftScheduleTitleByTimeAll(row.date, row.flow_object_key)` — submits one or the other | — | NOT PORTED | YES — primary `<Select>` from `GET /api/v1/admin/work-shifts`; fallback list from `GET /api/v1/admin/shift-schedules?date=…&equipmentId=…` (Top-level finding 7 — verify) |
| order_no / work_hours / part_qty / planned_qty / comment / date | text / number / textarea / datepicker | — | NOT PORTED | n/a (not select fields) |

No flow_id / equipment_id selects on this Edit (they come from the row, not user-selectable). No cascading on this form specifically.

## Scrap data Edit — admin (`resources/views/backend/result/form_scrap_data.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/results/scrap/page.tsx` *(list-only)*
**Legacy route:** `GET /admin/result/formResultScrapData/{id?}` / `POST /admin/result/saveResultScrapData`
**Legacy controller@method:** `Backend\DashboardController@formResultScrapData` / `@saveResultScrapData`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| part_id | `parts table` | — | NOT PORTED | YES — `<Select>` from `GET /api/v1/admin/parts` |
| work_shift_id / work_shift_name | same dual source as production | — | NOT PORTED | YES — same dual select pattern |
| **scrap_type_id** | `types where entity='Scrap reason'` | — | NOT PORTED | YES — `<Select>` from `GET /api/v1/admin/types?entity=ScrapReason` (or `/admin/scrap-categories` — Top-level 6.i) — **parent of cascade** |
| **reason** (scrap_reason) | full `scrap_reasons` table loaded as JSON; client-side filter by `type_id == scrap_type_id` | — | NOT PORTED | YES — `<Select>` cascading on scrap_type_id from `GET /api/v1/admin/scrap-reasons?typeId=:id` — **must clear when scrap_type_id changes** |
| order_no / quantity / comment / date | text / number / textarea / datepicker | — | NOT PORTED | n/a |

**Cascading chain:** `scrap_type_id → reason`.

## Stop data Edit — admin (`resources/views/backend/result/form_stop_data.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/results/stop/page.tsx` *(list-only)*
**Legacy route:** `GET /admin/result/formResultStopData/{id?}` / `POST /admin/result/saveResultStopData`
**Legacy controller@method:** `Backend\DashboardController@formResultStopData` / `@saveResultStopData`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| part_id | `parts table` | — | NOT PORTED | YES — `<Select>` from `GET /api/v1/admin/parts` |
| work_shift_id / work_shift_name | dual source as production | — | NOT PORTED | YES — same dual pattern |
| **stop_type_id** | `types where entity='Stop reason'` | — | NOT PORTED | YES — `<Select>` from `GET /api/v1/admin/types?entity=StopReason` (or `/admin/stop-categories`) — **parent of cascade** |
| **reason** (stop_reason) | full `stop_reasons` as JSON; client-side filter by `type_id == stop_type_id` | — | NOT PORTED | YES — `<Select>` cascading on stop_type_id from `GET /api/v1/admin/stop-reasons?typeId=:id` — **must clear when stop_type_id changes** |
| order_no / quantity / time / comment / date | text / number / textarea / datepicker | — | NOT PORTED | n/a |

**Cascading chain:** `stop_type_id → reason`.

## Warning data Edit — admin (`resources/views/backend/warning_data/edit.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/results/warning/page.tsx` *(modal edits `notificationText` + `duration` only — diverges from legacy)*
**Legacy route:** `POST /admin/result/warning-data/update/{id}` (route `WarningDataUpdate`)
**Legacy controller@method:** `Backend\WarningDataController@edit` / `@update`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| equip_id | `Equipments::pluck('name','id')` | — | NOT in modal | YES (pending Top-level 6.v decision) — `<Select>` from `GET /api/v1/admin/equipment` |
| from_time / to_time | datetimepicker | — | NOT in modal (only computed `duration` is editable) | YES (pending decision) — `<DatePicker showTime>`; backend `PATCH` would need to accept these and recompute duration |
| notification_text | text | — | `<Input.TextArea>` ✓ | NO |

---

## Production data — user (`resources/views/frontend/user/myresult/form_production.blade.php`)
**New_fp page:** `frontend/src/app/(user)/myresult/page.tsx` is a `<ComingSoon>` stub; no `production_data` sub-route file exists
**Legacy route:** `POST /myresult/saveResultProduction`
**Legacy controller@method:** `Frontend\User\DashboardController@formResultProduction` / `@saveResultProduction`

Same select sources as admin production Edit (part_id from `parts`, work_shift_id/name dual). **All NOT PORTED — same fixes apply.**

## Scrap data — user (`resources/views/frontend/user/myresult/form_scrap_data.blade.php`)
**New_fp page:** NOT YET PORTED
**Legacy route:** `POST /myresult/saveResultScrapData`
**Legacy controller@method:** `Frontend\User\DashboardController@formResultScrapData` / `@saveResultScrapData`

Same fields and **same cascading** as admin scrap Edit: `scrap_type_id → reason`. All NOT PORTED — same fixes apply.

## Stop data — user (`resources/views/frontend/user/myresult/form_stop_data.blade.php`)
**New_fp page:** NOT YET PORTED
**Legacy route:** `POST /myresult/saveResultStopData`
**Legacy controller@method:** `Frontend\User\DashboardController@formResultStopData` / `@saveResultStopData`

Same fields and **same cascading** as admin stop Edit: `stop_type_id → reason`. All NOT PORTED — same fixes apply.

## Warning log — user (`resources/views/frontend/user/myresult/form_warning_log.blade.php`)
**New_fp page:** NOT YET PORTED
**Legacy route:** `POST /myresult/warning/update`
**Legacy controller@method:** `Frontend\User\DashboardController@editWarningLog` / `@updateWarningLog`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| equip_id | `Equipments::pluck('name','id')` | — | NOT PORTED | YES — `<Select>` from `GET /api/v1/admin/equipment` (or a user-scoped variant) |
| from_time / to_time / notification_text | datetimepicker / textarea | — | NOT PORTED | n/a |

---

## Flow Monitor — Shift form (`resources/views/frontend/flow_monitor/shift_form.blade.php`)
**New_fp page:** `frontend/src/app/(user)/monitor/[[...id]]/page.tsx` *(page has top-level `<Select>` of FLOWS fed by MOCK array; modals do not capture date/work_shift/part/order)*
**Legacy route:** rendered by `getLossMonitor` (`Frontend\CompanyUserController@getLossMonitor`)

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| **flow_id (page-level top filter)** | `FlowDesigns` list | — | `<Select>` hardcoded MOCK array `FLOWS` | YES — `<Select>` from `GET /api/v1/admin/flow-designs` *(endpoint missing — needs backend addition)* |
| date | text + date picker | — | NOT PORTED | n/a |
| work_shift_id / work_shift_name | `WorkShift where status=1` AND `getShiftScheduleTitleByTimeAll(today, equipment_id)` | — | NOT PORTED | YES — same dual pattern as result Edit forms |
| **part_id** | `Parts` filtered by `EquipmentPart.part_type_id` for the equipment | — | NOT PORTED | YES — `<Select>` cascading on **equipment (node click)** from `GET /api/v1/admin/equipment/:id/parts` *(endpoint missing — needs backend addition)* — **must clear on equipment change** |
| **order_no** | If `EquipmentProperty.order_selection='list'`: `tbl_orders` JOIN `equipment_orders` by `equipment_id`. Else free text. | — | NOT PORTED | YES — conditional `<Select>` from `GET /api/v1/admin/equipment/:id/orders` *(endpoint missing)* OR plain `<Input>`, controlled by EquipmentProperty.order_selection |

**Cascading chain:** `flow_id (page) → equipment (node) → part_id` and `equipment → order_no (conditional)` and `equipment + date → shift schedule titles`.

## Flow Monitor — Scrap modal (`resources/views/frontend/flow_monitor/scrap_form.blade.php`)
**New_fp page:** "Register scrap" modal in `monitor/[[...id]]/page.tsx`
**Legacy route:** `getLossMonitorScrapForm` (`Frontend\CompanyUserController@getLossMonitorScrapForm`)

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| **scrap_reason (composite `type_id-reason_id`)** | `Types::whereIn('id', EquipmentScrapReason::where('equipment_id',$eid)->pluck('reason_type_id'))->with('scrapReason')` — rendered with `<optgroup>` per type | — | `<Select>` hardcoded (4 mock options) | YES — `<Select>` with optgroup support, cascading on **equipment** from `GET /api/v1/admin/equipment/:id/scrap-reasons` *(endpoint missing — needs backend addition)* — **must clear on equipment change**; preserve `type_id-reason_id` composite then split on submit (or use two paired Selects) |
| quantity | number | — | `<InputNumber>` ✓ | NO |
| comment_sr | textarea | — | `<Input.TextArea>` ✓ | NO |
| scrap_picture | file upload | — | NOT PORTED | n/a |
| hidden scrap_type_id, scrap_reason_id | derived from composite split | — | not derived | YES — split composite on submit |

**Cascading chain:** `equipment (node) → scrap_reason (type+reason composite)`.

## Flow Monitor — Stop modal (`resources/views/frontend/flow_monitor/stop_form.blade.php`)
**New_fp page:** "Register stop" modal in `monitor/[[...id]]/page.tsx`
**Legacy route:** `getLossMonitorStopForm`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| **stop_reason (composite)** | `Types::whereIn('id', EquipmentStopReason::where('equipment_id',$eid)->pluck('reason_type_id'))->with('stopReason')` — `<optgroup>` per type | — | `<Select>` hardcoded (5 mock options) | YES — `<Select>` with optgroup support, cascading on **equipment** from `GET /api/v1/admin/equipment/:id/stop-reasons` *(endpoint missing — needs backend addition)* — **must clear on equipment change**; submits composite `type_id-reason_id` |
| qty | number | — | NOT PRESENT (only duration) | YES — `<InputNumber>` |
| time (hours) + time_min (minutes) | two number inputs summed | — | single `duration` `<InputNumber>` in minutes | YES — replace single duration with hours + minutes pair |
| comment_st | textarea | — | `<Input.TextArea>` ✓ | NO |
| stop_picture | file | — | NOT PORTED | n/a |
| hidden stop_type_id, stop_reason_id | derived | — | not present | YES — split composite on submit |

**Cascading chain:** `equipment (node) → stop_reason (type+reason composite)`.

## Units — Stop form (`resources/views/frontend/units/stop_form.blade.php`)
**New_fp page:** `frontend/src/app/(user)/units/page.tsx` — `<ComingSoon>` stub
**Legacy route:** `GET getUnitStopSaveDlg` / `POST saveUnitStopData` (`Frontend\CompanyUserController`)

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| **flow_id** | `FlowDesigns::get()` filtered to those whose `flow_data.nodeDataArray` contains `abs(key)==equipment_id` | — | NOT PORTED | YES — `<Select>` from `GET /api/v1/admin/flow-designs?equipmentId=:id` *(endpoint missing)* |
| **stop_reason** (composite) | same as Flow Monitor stop modal | — | NOT PORTED | YES — same fix as Flow Monitor stop (equipment-scoped, grouped, composite) |
| work_shift_name | custom shift-picker dialog backed by `WorkShift where status=1` + `getShiftScheduleTitleByTimeAll(date, equipment_id)` | — | NOT PORTED | YES — custom date-aware shift picker; sources `GET /admin/work-shifts` + `GET /admin/shift-schedules?date=…&equipmentId=…` |
| **part_id** | `Parts where type_id IN (EquipmentPart.part_type_id for this equipment)` and status=1 | — | NOT PORTED | YES — `<Select>` cascading on equipment from `GET /api/v1/admin/equipment/:id/parts` *(endpoint missing)* |
| **order_no** | conditional on `EquipmentProperty.order_selection` | — | NOT PORTED | YES — conditional `<Select>` from `GET /api/v1/admin/equipment/:id/orders` *(endpoint missing)* OR `<Input>` |
| comment_st / stop_picture | textarea / file | — | NOT PORTED | n/a |
| hidden stop_type_id / stop_reason_id / stop_type | derived | — | NOT PORTED | YES — split composite on submit |

**Cascading chain:** `equipment (route ctx) → flow_id`, `→ stop_reason`, `→ part_id`, `→ order_no`, `+ date → shift schedule`.

---

# Module 5 — User Management / Access

## User Create Form (`resources/views/backend/access/create.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/access/users/create/page.tsx`
**Legacy route:** `POST /admin/access/user` (route `admin.access.user.store`)
**Legacy controller@method:** `Backend\Access\User\UserController@create` / `@store`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| assignees_roles[] | `<input type=checkbox>` per role from `EloquentRoleRepository::getAll()` (legacy `@if` restricts to "Company" role) | — | `<Checkbox>` group from `useRoles()` API ✓ | NO — semantically equivalent (checkbox group, not multi-select) |
| status / confirmed / confirmation_email / unit_only | checkboxes | 1/0 | `<Checkbox>` each ✓ | NO |
| session_timeout | number | — | `<InputNumber>` ✓ | NO |
| tenantId (NEW — no legacy equivalent) | n/a | — | `<Select>` from `useTenantsList()` (conditional) ✓ | NO — new affordance |
| name / email / password / password_confirmation / db_name | text | — | inputs ✓ | NO |
| host / db_username / db_password | hardcoded `config('env.*')` | — | `<Input disabled>` from env ✓ | NO |

## User Edit Form (`resources/views/backend/access/edit.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/access/users/[id]/page.tsx` + `UserFormModal.tsx` (edit modal)
**Legacy route:** `PATCH /admin/access/user/{user}` (route `admin.access.user.update`)
**Legacy controller@method:** `Backend\Access\User\UserController@edit` / `@update`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| status / confirmed | checkboxes | — | `<Checkbox>` ✓ | NO |
| session_timeout | number | — | NOT in modal | YES — add `<InputNumber>` (endpoint `PATCH /api/v1/admin/users/:id` exists; just expose field) |
| unit_only | checkbox | — | NOT in modal | YES — add `<Checkbox name="unitOnly">` |
| assignees_roles[] | (legacy intentionally hides via commented-out section + hidden input set from `$role_comp`) | — | NOT exposed in modal (roles read-only as `<Tag>`) | NO — matches legacy intent |
| name / email / firstName / lastName | text | — | `<Input>` ✓ | NO |

## Role Create Form (`resources/views/backend/access/roles/create.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/access/roles/new/page.tsx`
**Legacy route:** `POST /admin/access/role`
**Legacy controller@method:** `Backend\Access\Role\RoleController@create` / `@store`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| associated-permissions (UI gate only — not persisted) | `Form::select` hardcoded | `all` / `custom` | `<Checkbox.Group>` always shown (no `all/custom` toggle) | NO — legacy select was a visual gate; new design always showing permissions is an acceptable simplification |
| permissions[] | checkboxes from `Permission::all()` | — | `<Checkbox.Group>` from `usePermissionInventory()` ✓ | NO |
| name / sort | text / number | — | `<Input>` / `<InputNumber>` ✓ | NO |

## Role Edit Form (`resources/views/backend/access/roles/edit.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/access/roles/[id]/edit/page.tsx`

Same as Role Create. New_fp adds a `<Switch name="all">` for the super-admin flag — semantically equivalent to the legacy "all" select. **NO fix.**

---

# Module 6 — CMS / Content Management

## CMS Add (`resources/views/backend/cms/add.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/cms/page.tsx` (modal in list page)
**Legacy route:** `POST /admin/cms/add`
**Legacy controller@method:** `Backend\DashboardController@addCms` / `@storeCms`

**No `<select>` fields in legacy CMS Add.** **NO fix.** (Content rich-editor port — CKEditor → plain `<TextArea>` — is out of select scope; flagged for future enhancement.)

## CMS Edit (`resources/views/backend/cms/edit.blade.php`)
Same modal as Add. **No selects, no fix.**

## CMS Image Upload (`resources/views/backend/cms/image.blade.php`)
**New_fp page:** NOT YET PORTED (no multi-image attachment UI in `cms/page.tsx`)

No selects, separate feature concern.

## Slider Add / Edit (`resources/views/backend/slider/sliders_add.blade.php`, `sliders_edit.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/sliders/page.tsx` (`SliderModal`)

**No `<select>` fields.** Fully ported (image upload is `<Upload>`). **NO fix.**

## Testimonial Add / Edit (`resources/views/backend/testimonial/{add,edit}.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/testimonials/page.tsx` (`TestimonialModal`)

**No `<select>` fields.** **NO fix.** (Rich editor on `body`/`content` is out of select scope.)

## Social (`resources/views/backend/social/social.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/social/page.tsx`

**No `<select>` fields.** Per-row `<Switch>` matches legacy button toggle. **NO fix.**

## Feedback (no legacy form — table-only audit)
**New_fp page:** `frontend/src/app/(admin)/admin/feedback/page.tsx`

Table-level filters: `<Select>` for tenantId (from `useTenantsList()`) and `<Select>` hardcoded for status. Both correct. **NO fix.**

## Tenants (no legacy form — new_fp concept)
**New_fp page:** `frontend/src/app/(admin)/admin/tenants/page.tsx`

Create modal: name / slug / timezone, all `<Input>`. **No selects in form, no fix.**

---

# Module 7 — Machine / IoT Setup

## Configured Unit Inline Panel (`resources/views/backend/machine/configured_unit.blade.php`)  — **priority focus**
**New_fp page:** `frontend/src/app/(admin)/admin/iot/setup/page.tsx` (`UnitPanel` rendered inside Tabs > "configured")
**Legacy route:** `GET /admin/setupUnit` (panel render) + `POST /admin/getSingleMachinealldetails` (AJAX dropdown population)
**Legacy controller@method:** `Backend\MachineController@setupunit` + `@getSingleMachinealldetails`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| **signal_type** | hardcoded inline `<select>` (legacy has `on_counter` / `off_counter` commented out) | `on` (ON Signal), `off` (OFF Signal), `warning` (Warning Signal) | `<Select>` hardcoded ✓ (`SIGNAL_OPTIONS`) | NO |
| **cause_id (reasons)** | inline `<select name="reasons">` populated by AJAX from `getSingleMachinealldetails.stop_reasons` — **equipment-scoped** via `EquipmentStopReason` and **grouped by Types** with composite value `<type_id>-<reason_id>` | — | `<Select>` from `GET /admin/iot/stop-reasons` — flat tenant-wide, NOT grouped, NOT equipment-scoped | YES (pending Top-level 6.iv decision) — either: extend `GET /api/v1/admin/iot/stop-reasons?equipmentId=:id` to return grouped + scoped data, OR confirm the simplification is intentional |
| **flow_id (flow_name)** | inline `<select name="flow_name">` populated by AJAX from `getSingleMachinealldetails.flows` — flows filtered to those whose `flow_data.nodeDataArray` contains a node matching `equip_id` | — | `<Select>` from `GET /admin/iot/flow-designs` — flat tenant-wide list | YES (pending Top-level 6.iv decision) — extend with `?equipmentId=:id` OR confirm simplification |
| auto_registry (chk_auto_reg_default) | checkbox | — | read-only `<Tag>` shown when `unit.isAutoRegistered=='yes'` | YES — expose as `<Checkbox>` (endpoint `PATCH /api/v1/admin/iot/units/:id/settings` is mounted but must accept `isAutoRegistered`) |
| time_limit (auto-stop) | number | — | read-only `<Text>` showing parsed `autoStopLimit` from `autoRegisteredData` JSON | YES — expose as `<InputNumber>` |
| log_warning | checkbox (only when signal_type='warning') | — | NOT rendered | YES — conditional `<Checkbox name="logWarning">` |
| **counter_date** | hardcoded `<select>` | `today` / `yestarday` / `this_week` / `week_to_week` / `previous_week` / `this_month` / `previous_month` / `this_year` / `previous_year` (9 values, legacy includes typo "yestarday") | `<Select>` hardcoded — only `daily` / `weekly` / `monthly` (3 values) | YES (pending Top-level 6.ix decision) — expand to 9 legacy values OR confirm 3-value simplification is canonical |
| target_prod / part_hr / filter_time / filter_time_on | number | — | `<InputNumber>` each ✓ | NO |
| custom_notification_text | text | — | `<Input>` ✓ | NO |
| notification_default | checkbox | — | `<Checkbox>` "Use Default" ✓ | NO |
| equipment picker (Change Equipment) | non-standard custom JS tree | — | non-standard `<Tree>` in `<Modal>` (`EquipmentPickerModal`) ✓ | NO — tree picker preserved |

## Unconfigured Unit Panel (`resources/views/backend/machine/unconfigured_unit.blade.php`)
**New_fp page:** same `iot/setup/page.tsx`, "unconfigured" tab

No selects (only the tree-picker "Assign Equipment" button). **NO fix.**

## IoT Software (`resources/views/backend/machine/iot_software_list.blade.php` + `iot_software_update_form.blade.php`)
**New_fp page:** `iot/software/page.tsx` — `<ComingSoon>` stub

No selects in the legacy update form (version / description / file). **NO fix re: selects.**

## Add Machine (file-mode) (`resources/views/backend/machines/add_machine.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/machines/page.tsx` — `<ComingSoon>` stub
**Legacy route:** `POST /admin/machine/add` (route `AddMachine`)
**Legacy controller@method:** `Backend\DashboardController@addMachine` / `@storeMachine`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| equipment_id | non-standard `<ul>` tree picker over `Equipments where parent_id=0` | — | NOT PORTED | YES — tree picker (reuse `EquipmentPickerModal`); endpoint `GET /api/v1/equipment` already mounted |
| folder_id | `Form::select` populated via AJAX from `/admin/machine/get-folder?equipment_id=…` | — | NOT PORTED | YES — `<Select>` cascading on equipment_id from `GET /api/v1/admin/folders?equipmentId=:id` *(folders endpoint missing — needs backend addition)* |
| file_id (linkup modal) | non-standard `<ul>` file tree | — | NOT PORTED | YES — non-standard widget |
| name / notes | text / textarea | — | NOT PORTED | n/a |
| is_link / is_locked | checkbox | Y | NOT PORTED | n/a |
| files | file upload (jquery.filer) | — | NOT PORTED | n/a |

## Edit Machine (`resources/views/backend/machines/edit_machine.blade.php`)
Same as Add Machine. Same fixes. *Backend `/api/v1/admin/machines` mount is **missing**.*

## Child Equipment partial (`resources/views/backend/machines/child_equipment.blade.php`)
Used inline within add_machine. `equipment_key[]` is `Form::select` from `$equipment`; same backend needs. Same YES.

## Company Machine Add/Edit (`resources/views/backend/company/machine/{add,edit}.blade.php`)
**New_fp page:** same machines ComingSoon; **NEEDS INVESTIGATION** — these reference route `machine.add` that is **not registered** in `routes/Backend/Dashboard.php`. Likely dead code (Top-level finding 6.vii).

If still live:
| parent_id | `Form::select` from `$machines` (companysql `pluck('machine_name','id')`) | — | NOT PORTED | YES — `<Select>` from `GET /api/v1/admin/machines` *(endpoint missing)* |

## Company Programme Add/Edit (`resources/views/backend/company/programme/{add,edit}.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/machine-programmes/page.tsx` — `<ComingSoon>` stub
**Legacy route:** `POST /admin/programme/add` (route `AddProgramme`)
**Legacy controller@method:** `Backend\DashboardController@addProgramme` / `@storeProgramme`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| machine_id | `Form::select` from `$machine = company_machine.pluck('machine_name','id')` (tenant-scoped) | — | NOT PORTED | YES — `<Select>` from `GET /api/v1/admin/machines` *(endpoint missing)* |
| file_id (linkup modal) | non-standard radio buttons over `$documents` list | — | NOT PORTED | YES — non-standard widget |
| name | text | — | NOT PORTED | n/a |
| files / is_link / is_locked | file / checkbox / checkbox | — | NOT PORTED | n/a |

*Backend `/api/v1/admin/machine-programmes` mount is **missing**.*

## Company Workstation Add/Edit (`resources/views/backend/company/workstation/{add,edit}.blade.php`)
**New_fp page:** `frontend/src/app/(admin)/admin/workstations/page.tsx` — `<ComingSoon>` stub
**Legacy route:** `POST /admin/workstation/add` (route `AddWorkStation`)
**Legacy controller@method:** `Backend\DashboardController@addWorkStation` / `@storeWorkStation`

| Field name | Legacy source | Legacy options | new_fp current state | Fix needed |
|---|---|---|---|---|
| machine_id | `Form::select` from `$machine = company_machine.pluck('machine_name','id')` | — | NOT PORTED | YES — `<Select>` from `GET /api/v1/admin/machines` *(endpoint missing)* |
| stop_cause / counts / date / time / duration | textarea / number / date / time / time | — | NOT PORTED | n/a (date/time fields, not selects) |

*Backend `/api/v1/admin/workstations` mount is **missing**.*

---

# Summary — Cascading-select chains

Every cascading chain in scope. Each downstream select must clear when its upstream changes (see brief Step 2, Fix type C).

1. **Orders (backend + frontend, add + edit):** `flow_id → equip_id → part_id`
2. **Result Scrap Edit (admin + user):** `scrap_type_id → reason`
3. **Result Stop Edit (admin + user):** `stop_type_id → reason`
4. **Flow Monitor shift form:** `flow_id (page) → equipment (node) → part_id`; `equipment → order_no (conditional)`; `equipment + date → shift schedule titles`
5. **Flow Monitor scrap modal:** `equipment (node) → scrap_reason (type+reason composite)`
6. **Flow Monitor stop modal:** `equipment (node) → stop_reason (type+reason composite)`
7. **Units stop form:** `equipment (route ctx) → flow_id`; `→ stop_reason`; `→ part_id`; `→ order_no`; `+ date → shift schedule titles`
8. **IoT setup (pending Top-level 6.iv decision):** `equipment (per unit) → cause_id (stop_reasons grouped by type)`; `equipment → flow_id (filtered)`
9. **Add Machine / Edit Machine:** `equipment_id → folder_id`

---

# Summary — Backend endpoints to add (or extend with query params)

If you approve the YES fixes above, the following backend work is needed first (or in tandem). The exact path is suggested — feel free to rename:

| Endpoint | Used by | Status |
|---|---|---|
| `GET /api/v1/admin/flow-designs` (list + CRUD) | Orders, Result forms, Monitor flow filter, Units stop form, IoT flow filter, Flow Designs admin page | **route file missing** |
| `GET /api/v1/admin/flow-designs?equipmentId=:id` | Units stop form, IoT setup flow filter | needs implementation as part of above |
| `GET /api/v1/admin/orders` (list + CRUD) OR `GET /api/v1/admin/equipment/:id/orders` | Orders admin/user pages, Monitor shift form, Units stop form | **route file missing** |
| `GET /api/v1/admin/equipment/:id/parts` (cascading filter) | Orders forms, Monitor shift form, Units stop form | **likely missing on /admin/parts; verify** |
| `GET /api/v1/admin/equipment/:id/stop-reasons` (equipment-scoped + Types-grouped) | IoT setup `cause_id`, Monitor stop modal, Units stop form | needs new shape on existing `/admin/stop-reasons` OR new path |
| `GET /api/v1/admin/equipment/:id/scrap-reasons` (equipment-scoped + Types-grouped) | Monitor scrap modal | needs new shape on existing `/admin/scrap-reasons` OR new path |
| `GET /api/v1/admin/shift-schedules?date=YYYY-MM-DD&equipmentId=:id` | Result Edit forms (work_shift fallback), Monitor shift form, Units stop form | verify existing mount supports these params |
| `GET /api/v1/admin/equipment` with `?flat=true` / `?tree=true` switch | Equipment parent picker, Folder TreeSelect | verify existing mount |
| `GET /api/v1/admin/types?entity=…&is_active=Y` filter | Every form that loads a type-filtered select | verify existing mount |
| `GET /api/v1/admin/machines` (list + CRUD) | Machine, Programme, Workstation forms | **route file missing** |
| `GET /api/v1/admin/machine-programmes` | Programme admin page | **route file missing** |
| `GET /api/v1/admin/machine-files` | Machine linkup widget | **route file missing** |
| `GET /api/v1/admin/workstations` | Workstation admin page | **route file missing** |
| `GET /api/v1/admin/folders?equipmentId=:id` | Folder admin page, Add Machine `folder_id` | **route file missing** |
| `GET /api/v1/admin/symbols` (list + CRUD) | Symbol admin page | **route file missing** |
| `PATCH /api/v1/admin/iot/units/:id/settings` accepting `isAutoRegistered`, `logWarning`, `autoStopTimeLimit` | IoT setup `UnitPanel` | mounted, payload shape to confirm |
| `PATCH /api/v1/admin/results/warning/:id` extended to accept `equipId`, `fromTime`, `toTime` | Warning Edit form | mounted (only `notificationText`+`duration` today) — depends on decision 6.v |
| `POST /api/v1/admin/results/{production,scrap,stop}` accepting either `workShiftId` (FK) or `workShiftName` (string) | Result Edit forms (admin + user) | mounted — verify schema |

---

# Summary — RESOLVED decisions (2026-05-13)

All 9 items were answered during audit review. See Top-level finding 6 for full prose; the one-line summary below is the contract the implementation phases assume.

i.   ✅ `stop-categories` = legacy `stop_category` table; `scrap-categories` = `types WHERE entity='ScrapReason'`. Two different tables — do not merge.
ii.  ✅ `types.entity` canonical = PascalCase singular: `Equipment` / `StopReason` / `ScrapReason` / `Part` / `Order` / `Content`. Map legacy values at migration time only.
iii. ✅ `types.type` canonical = `Performance` / `Availability` / `Quality` / `NotApplicable`. Drop `Other`. Conditional visibility by entity (StopReason: all 4; ScrapReason: Quality + NotApplicable; other: hide field).
iv.  ✅ IoT `cause_id` + `flow_id` are equipment-scoped + grouped (legacy behavior). Current flat lists are a regression — extend endpoints with `?equipmentId=:id` in Phase A4.
v.   ✅ Warning Edit edits `equip_id` + `from_time` + `to_time`; `duration` is computed server-side. "Edit duration directly" UI is wrong — fix in Phase A5 + Warning module.
vi.  ✅ Confirmed dual submit: `POST /admin/results/*` accepts `workShiftId` (FK) OR `workShiftName` (string). Store whichever is provided.
vii. ✅ `backend/company/machine/{add,edit}.blade.php` is dead code — skip the port.
viii. ✅ User-facing flow editing out of scope for Phase 4 (needs separate UX + GoJS license).
ix.  ✅ Canonical `counter_date` = 9 legacy values with corrected spelling `"yesterday"` (accept both spellings on read for back-compat).

---

# Summary — Per-module fix volume (for sequencing the work after approval)

| Module | Forms with YES rows | Backend endpoint additions | Approximate "fix-week" load |
|---|---|---|---|
| Equipment | 4 (add, edit, add-modal, edit-modal, stop-category) | 0 (uses existing /admin/types + /admin/salary-groups + /equipment) | Large — entire Equipment add/edit is unported |
| Production (types, parts, salary, orders, work-shifts, shift-schedule, symbols, folders) | 12 | 4 (orders, folders, symbols, optionally flow-designs) | Largest |
| Flow Management | 2 | 1 (flow-designs) | Small, gated on GoJS canvas |
| Result / Data Entry | 8 | 5+ (equipment/:id/{parts,stop-reasons,scrap-reasons,orders}, shift-schedules query params) + cascading filters | Large (cascading + composite values) |
| Access (Users, Roles) | 1 small (User Edit needs sessionTimeout + unitOnly fields) | 0 | Trivial |
| CMS / Content | 0 (no select fixes; only rich-editor and image-attach future work) | 0 | None |
| Machine / IoT | 6 | 5 (machines, machine-programmes, machine-files, workstations, plus iot endpoint extensions) | Large |

---

**End of audit. Awaiting your review before any fix is started.**
