# PHASE4C_SPEC.md — Company-User Module Surface Port

> **Status:** Spec approved with corrections applied. C1 implemented. Proceeding C2 → C3 → C4 → [review] → C5 → [review] → C6 → C7 → C8.
> **Bugs A1 + A2 already fixed** (see Section 0). **C1 implemented** (see Section 0).
> **Q2 (Grafana) and Q4 (counter units) are STOP-AND-ASK — awaiting decision before C6/C7.**

---

## Section 0 — Immediate Fixes Applied

### A1 — Equipment Tree removed from Equipment List (DONE)
- **File changed:** `frontend/src/app/(admin)/admin/equipment/page.tsx`
- **What changed:** Removed the `<Card>` containing the AntD `<Tree>` component, removed the two-column CSS grid wrapper (`gridTemplateColumns: 'minmax(260px,320px) 1fr'`), removed `MOCK_TREE`, `tree` state, `ClusterOutlined`, `AppstoreOutlined`, `DataNode` imports. Page is now single-column: title row → action buttons → filter input card → full-width table.
- **Tree component file untouched** — it remains for C1 (Equipment Structure page).

### A1 corrections applied
- CORRECTION 1 (ColumnFilter operators): 1=equal, 2=not-equal, 3=contains, 4=not-contains, 5=empty, 6=not-empty, 7=starts-with, 8=ends-with. **No greater-than or less-than** — those don't exist in legacy.
- CORRECTION 2 (Board slug): Preserve underscores. New URL `/admin/boards/8/line_1` not `line-1`.
- CORRECTION 3 (signal_type): See Section 8 Q3/CORRECTION 3 — it's a DB enum, UI labels are constants.
- CORRECTION 4 (middleware): `/feedback` → `/admin/feedback` redirect added to `frontend/src/middleware.ts`.

### C1 — Equipment Structure tree page (DONE)
- **Backend:** `getTree()` added to `equipment.service.js` (JS tree-build from flat list). `GET /equipment/tree` route added to `equipment.routes.js` (registered **before** `/:id` to avoid capture).
- **Frontend hook:** `useEquipmentTree()` added to `lib/api/equipment.ts`.
- **Page:** `app/(admin)/admin/equipment/tree/page.tsx` — AntD `<Tree showLine showIcon>` with `defaultExpandAll`, equipment icon images from `/equipment-icons/`, fallback to `<ApartmentOutlined />`. Handles loading/error/empty states.
- **Fixes the 404** at `fptest.com/admin/equipment/tree`.

### A2 — Flow Designs placeholder replaced with real list view (DONE)
- **File changed:** `frontend/src/app/(admin)/admin/flow-designs/page.tsx`
- **What changed:** Replaced `<ComingSoon>` with a full AntD Table list showing S.No, Name, Status badge, Created By, Created At, Actions (Edit / Status toggle / Delete). "+ Add Flow Design" opens a modal (name + status switch). "Edit" triggers an AntD `Alert type="warning"` about GoJS license (OPERATOR_QUESTIONS.md C4) instead of the canvas.
- **Backend not yet wired** — rows are mock data. API wiring (`GET/POST/PATCH/DELETE /api/v1/admin/flow-designs`) to be added after spec review per C-section order.

---

## Section 1 — Screenshot Inventory & Identification

| Screenshot | Identified Screen | URL (visible in address bar) | Source |
|---|---|---|---|
| `New_Project_Screenshot 2026-05-12 at 10.44.31 PM.png` | Equipment List (new_fp — A1 bug) | `fptest.com/admin/equipment` | new_fp |
| `New_project_Screenshot 2026-05-12 at 10.44.45 PM.png` | Equipment Structure — 404 (new_fp bug) | `fptest.com/admin/equipment/tree` | new_fp |
| `Screenshot ... 10.44.57 PM.png` | Equipment Structure (hierarchical tree) | `fpanalyzer.se/admin/equipment/tree` | legacy |
| `Screenshot ... 10.46.07 PM.png` | Create Deviation Reason (scrap reason form) | `fpanalyzer.se/admin/equipment/form_scrap_reason` | legacy |
| `Screenshot ... 10.46.19 PM.png` | Create Stop Reason form | `fpanalyzer.se/admin/equipment/form_stop_reason` | legacy |
| `Screenshot ... 10.46.57 PM.png` | Flow Designs — placeholder (new_fp — A2 bug) | `fptest.com/admin/flow-designs` | new_fp |
| `Screenshot ... 10.47.57 PM.png` | Order Management list | `fpanalyzer.se/admin/production/orders` | legacy |
| `Screenshot ... 10.48.17 PM.png` | Article Management list | `fpanalyzer.se/admin/production/parts` | legacy |
| `Screenshot ... 10.48.51 PM.png` | Work Shift list | `fpanalyzer.se/admin/production/work-shifts` | legacy |
| `Screenshot ... 10.48.57 PM.png` | Shift Schedule list | `fpanalyzer.se/admin/production/ShiftSchedule` | legacy |
| `Screenshot ... 10.49.10 PM.png` | Production Data (Produktionsdata) | `fpanalyzer.se/admin/result/production` | legacy |
| `Screenshot ... 10.49.25 PM.png` | Scrap Data (Registrerade avvikelser) | `fpanalyzer.se/admin/result/scrap_data` | legacy |
| `Screenshot ... 10.49.55 PM.png` | Stop Data (Registrerade stopp) | `fpanalyzer.se/admin/result/stop_data` | legacy |
| `Screenshot ... 10.50.08 PM.png` | Warning Log | `fpanalyzer.se/admin/result/warning-data` | legacy |
| `Screenshot ... 10.50.24 PM.png` | Dashboard List (Board Creator) | `fpanalyzer.se/admin/board/listDashboard` | legacy |
| `Screenshot ... 10.50.45 PM.png` | Graph Widgets | `fpanalyzer.se/admin/board/graphWidgets` | legacy |
| `Screenshot ... 10.50.58 PM.png` | Board View (Line 1) | `fpanalyzer.se/admin/board/show/8/line_1` | legacy |
| `Screenshot ... 10.51.09 PM.png` | Setup Units / Configure Devices | `fpanalyzer.se/admin/setupUnit` | legacy |
| `Screenshot ... 10.51.21 PM.png` | Feedback (company user send form) | `fpanalyzer.se/feedback` | legacy |

**Extra screenshots noted (beyond original Section B table):**
- `10.44.45 PM` — 404 at `fptest.com/admin/equipment/tree`. The equipment structure page is missing in new_fp. C1 creates it.
- `10.46.07 PM` — Scrap reason form (URL: `form_scrap_reason`). Categories shown: Work error, Material defects, Revision, Handling injuries, Andon. Part of C2.
- `10.47.57 PM` — Order Management at `/admin/production/orders`. Already partially in new_fp (`/admin/orders`). Not in Phase 4c scope.
- `10.48.17 PM` — Article Management at `/admin/production/parts`. Already in new_fp (`/admin/parts`). Not in Phase 4c scope.

---

## Section 2 — Module Map

### C1 — Equipment Structure page

| Field | Value |
|---|---|
| **Legacy URL** | `GET /admin/equipment/tree` |
| **Legacy controller@method** | `DashboardController@getEquipmentTree` |
| **Legacy Blade** | `resources/views/backend/equipments/equipment_tree.blade.php` |
| **New Next.js page** | `frontend/src/app/(admin)/admin/equipment/tree/page.tsx` |
| **New NestJS endpoint** | `GET /api/v1/equipment/tree` (returns nested JSON) |
| **Cross-module deps** | Equipment (self-referential parent/child), Type (icon mapping) |

**Visual spec (screenshot 10.44.57 PM):**
- Page title: "Equipment structure"
- AntD `<Tree showLine showIcon>` rendering the full tenant equipment hierarchy
- Each node: equipment icon image + name, collapse/expand circle toggle
- Hierarchy connects with vertical lines (AntD `showLine` prop)
- Company name shown at root level (visible: "Chair Company AB 12")
- Depth shown: 4+ levels

**Backend spec:**
- `GET /api/v1/equipment/tree` — tenant-scoped recursive query
- Returns: `[{ id, name, iconUrl, parentId, children: [...] }]`
- Add to `equipment.routes.js`: `router.get('/tree', ...)` calling `svc.getTree(req.tenant)`
- Service: recursive CTE query in Prisma raw SQL or recursive JS traversal of flat list

**New_fp bug noted:** `fptest.com/admin/equipment/tree` currently returns 404 — page file does not exist. C1 creates it.

---

### C2 — Stop Reason + Scrap Reason CRUD

| Field | Stop Reasons | Scrap Reasons |
|---|---|---|
| **Legacy URL** | `GET /admin/equipment/stop_reason` (list), `GET /admin/equipment/form_stop_reason/{id?}` (form) | `GET /admin/equipment/scrap_reason`, `GET /admin/equipment/form_scrap_reason/{id?}` |
| **Legacy controller@method** | `DashboardController@getEquipmentStopReason`, `@formEquipmentStopReason`, `@saveEquipmentStopReason`, `@deleteEquipmentStopReason` | `DashboardController@getEquipmentScrapReason`, `@formEquipmentScrapReason`, `@saveEquipmentScrapReason`, `@deleteEquipmentScrapReason` |
| **Legacy Blade** | `resources/views/backend/equipments/stop_reasons.blade.php`, `form_stop_reason.blade.php` | `equipments/scrap_reasons.blade.php`, `form_scrap_reason.blade.php` |
| **New Next.js pages** | `admin/equipment/stop-reasons/page.tsx`, `stop-reasons/new/page.tsx`, `stop-reasons/[id]/edit/page.tsx` | same pattern under `scrap-reasons/` |
| **New NestJS endpoints** | Already exist at `/api/v1/admin/stop-reasons` — **verify service has category (type_id) field** | `/api/v1/admin/scrap-reasons` — same |
| **Cross-module deps** | stop_categories table (for category dropdown) | scrap_categories table (if exists) or types table |

**Visual spec (screenshots 10.46.19 PM = stop, 10.46.07 PM = scrap):**

Stop reason form fields:
- Category (dropdown, required) — loads from stop_categories. Visible options: Efficiency losses, Availability losses, Technical disruption, Conversion, Tool losses, Maintenance, Stop
- Name (text input, required)
- Description (textarea)
- Sort order (number input)
- "Create" / "Update" button (purple outline, matching legacy)
- Back arrow (`<`) at top left

Scrap reason form fields:
- Category (dropdown) — Categories visible in screenshot: Work error, Material defects, Revision, Handling injuries, Andon
- Name (text input, required)
- Description (textarea)
- Sort order (number input)

**IMPORTANT — blade analysis finding:**
The stop reason form blade uses `trans('custom.texts.type')` for the label (not "Category"). The dropdown binds to `type_id` and loads from `$type` which is stop_categories records. The screenshot shows the label as "Category" in the UI — the translation key `custom.texts.type` renders as "Category" in EN locale. New app uses `t('equipment.stopReason.category')`.

**List page columns:**
Stop Reasons list: S.No, Name, Category, Description, Sort Order, Actions (Edit pencil, Delete X)
Scrap Reasons list: S.No, Name, Category, Description, Sort Order, Actions

**Backend verify needed:** Check `admin-stop-reasons.service.js` — confirm it joins stop_categories for the category name in list response, and accepts `typeId`/`categoryId` in create/update body.

---

### C3 — Work Shift CRUD

| Field | Value |
|---|---|
| **Legacy URL** | `GET /admin/production/work-shifts` (list), `GET /admin/production/shift-add` (add form), `GET /admin/production/shift-edit/{id}` (edit form) |
| **Legacy controller@method** | `DashboardController@getWorkShifts`, `@addWorkShift`, `@storeWorkShift`, `@editWorkShift`, `@updateWorkShift`, `@deleteWorkShift`, `@statusWorkShift` |
| **Legacy Blade** | `resources/views/backend/work_shifts/list.blade.php`, `add.blade.php`, `edit.blade.php` |
| **New Next.js page** | `frontend/src/app/(admin)/admin/work-shifts/page.tsx` (list exists as placeholder), add `new/page.tsx`, `[id]/edit/page.tsx` |
| **New NestJS endpoints** | `/api/v1/admin/work-shifts` — route file **already exists** at `admin-work-shifts.routes.js`. Verify it has PATCH `:id/status`. |
| **Cross-module deps** | None |

**Visual spec (screenshot 10.48.51 PM):**
- Page title: "Work shift" (not "Work Shifts")
- "+ Add work shift" button top right
- Filter By Group row (drop group here)
- Show [N] entries, column-visibility, column-reorder, Search, Excel export toolbar
- Table columns (from blade and screenshot): S.No, Name, Start time, End time, Break time, Working days, Actions
- "Working days" shown as comma-separated string e.g. "Monday, Tuesday, Wednesday, Thursday"
- "Break time" stored as legacy comma-separated string e.g. "09:30-10:00,12:00-12:30"
- Actions: edit pencil (blue), status toggle (teal play), delete X (red)
- Summary dropdown below table

**Form spec:**
- Working days: multi-select checkboxes (Mon/Tue/Wed/Thu/Fri/Sat/Sun), serialised to "Monday, Tuesday" etc.
- Break time: dynamic list of time-range pickers (+ Add Break / Remove) → serialises to legacy format
- Start time / End time: AntD TimePicker

---

### C4 — Shift Schedule CRUD + Calendar

| Field | Value |
|---|---|
| **Legacy URL** | `GET /admin/production/ShiftSchedule` (list), `GET /admin/production/AddShiftSchedule`, `GET /admin/production/EditShiftSchedule/{id}` |
| **Legacy controller@method** | `ShiftScheduleController@index`, `@addShiftSchedule`, `@storeShiftSchedule`, `@editShiftSchedule`, `@updateShiftSchedule`, `@DeleteShiftSchedule`, `@changeScheduleStatus`, `@getScheduleEvents`, `@getShiftScheduleDataById`, `@storeShiftScheduleData`, `@updateShiftScheduleData`, `@removeShiftScheduleData` |
| **Legacy Blade** | `resources/views/backend/shift_schedule/list.blade.php`, `create.blade.php` |
| **New Next.js pages** | `admin/shift-schedules/page.tsx` (list exists), `new/page.tsx`, `[id]/edit/page.tsx` |
| **New NestJS endpoints** | `GET/POST/PATCH/DELETE /api/v1/admin/shift-schedules`, `GET /api/v1/admin/shift-schedules/:id/events?month=YYYY-MM`, `PATCH /api/v1/admin/shift-schedules/:id/status` |
| **Cross-module deps** | WorkShift (shift times used in calendar events) |

**Visual spec (screenshot 10.48.57 PM):**
- Page title: "Shift schedule"
- Subtitle: "List"
- "+ Add shift schedule" top right
- Table columns: S.No, Name, Description, Manage
- Manage column: icon buttons only — blue pencil (edit), teal play circle (status toggle), red X (delete)
- No text labels on action buttons — only icons with AntD Tooltip
- Summary dropdown below table

**Edit page spec:**
- Two-panel layout: top = name + description form fields; bottom = weekly calendar view
- Calendar shows scheduled shifts per day using `getScheduleEvents` data
- Calendar library: AntD `Calendar` component (confirm against MIGRATION_NOTES.md §1)
- Calendar data endpoint: `GET /api/v1/admin/shift-schedules/:id/events?month=YYYY-MM`

**Question to answer before implementing:** Read `ShiftScheduleController@getScheduleEvents` fully — what JSON shape does it return and how does the legacy Blade JS consume it? This determines the new endpoint response schema.

---

### C5 — Results Management (Production / Scrap / Stop / Warning)

| Sub-module | Legacy URL | Legacy controller@method | Legacy Blade | New Next.js page | New NestJS endpoint |
|---|---|---|---|---|---|
| Production data | `GET /admin/result/production` | `DashboardController@getResultProduction` | `result/production.blade.php` | `admin/results/production/page.tsx` | `GET /api/v1/admin/results/production` |
| Scrap data | `GET /admin/result/scrap_data` | `DashboardController@getResultScrapData` | `result/scrap_data.blade.php` | `admin/results/scrap/page.tsx` | `GET /api/v1/admin/results/scrap` |
| Stop data | `GET /admin/result/stop_data` | `DashboardController@getResultStopData` | `result/stop_data.blade.php` | `admin/results/stop/page.tsx` | `GET /api/v1/admin/results/stop` |
| Warning log | `GET /admin/result/warning-data` | `WarningDataController@getList` | `warning_data/list.blade.php` | `admin/results/warning/page.tsx` | `GET /api/v1/admin/results/warning` |

**Cross-module deps:** FlowDesigns, Equipment, Parts, WorkShift, StopReason, ScrapReason, Types, Orders, public.users

**Date Range Strip (shared `<DateRangeStrip />` component):**
- File: `frontend/src/components/result/DateRangeStrip.tsx`
- Horizontal carousel of days with day-name label + date number
- Today's date highlighted in dark rounded pill (screenshot shows 12 in dark pill)
- `<` / `>` arrows scroll by 1 day
- "Datumintervall" / "Date Range" dropdown at left: Today (Idag), This week, This month, Custom date range
- Filter/reset funnel icon below the dropdown
- Warning log uses "Date Range" (English) label — the label is locale-driven

**Table toolbar (shared `<TableToolbar />` component):**
- "Show [N] entries" select (10/25/50/All)
- Column-visibility eye icon toggle
- Column-reorder ⊞ icon
- Search input (right-aligned)
- Excel export green icon → calls `GET /api/v1/admin/results/{type}/export?format=xlsx&...filters`

**Column filter (shared `<ColumnFilter />` component):**
- `[A]` button per filterable column opens 8-operator dropdown
- Operators: contains, equals, starts with, ends with, is empty, is not empty, greater than, less than

**Summary dropdown (shared `<SummaryRow />` component):**
- Below pagination: "Summary" dropdown — None, Empty count, Non-empty count, Distinct count

#### Production Data columns (from `production.blade.php`, exact order):
| # | Display (SV) | Display (EN) | DB field | Filterable |
|---|---|---|---|---|
| 0 | S No | S No | id | No |
| 1 | Flödesnamn | Flow name | flow_designs.name | Yes |
| 2 | Utrustningsbenämning | Equipment name | equipments.name | Yes |
| 3 | Artikelnummer | Part number | parts.part_no | Yes |
| 4 | Artikelnamn | Part name | parts.name | Yes |
| 5 | Skift - benämning | Shift name | work_shift_name | Yes |
| 6 | Ordernummer | Order number | order_no | Yes |
| 7 | Arbetad tid | Worked hours | work_hours | Yes |
| 8 | OK-delar | OK parts qty | part_qty | Yes |
| 9 | Planerat antal | Planned qty | planned_qty | Yes |
| 10 | Kommentar | Comment | comment | Yes |
| 11 | Valt datum | Selected date | date | Yes |
| 12 | Skapad datum | Created date | created_at | Yes |
| 13 | Skapad av | Created by | users.name | Yes |
| 14 | Åtgärder | Actions | — | No |

#### Scrap Data columns (from `scrap_data.blade.php`, exact order):
| # | Display (SV) | Display (EN) | DB field | Filterable |
|---|---|---|---|---|
| 0 | S No | S No | id | No |
| 1 | Flödesnamn | Flow name | flow_designs.name | Yes |
| 2 | Utrustningsbenämning | Equipment name | equipments.name | Yes |
| 3 | Artikelnummer | Part number | parts.part_no | Yes |
| 4 | Artikelnamn | Part name | parts.name | Yes |
| 5 | Skift - benämning | Shift name | work_shift_name | Yes |
| 6 | Ordernummer | Order number | order_no | Yes |
| 7 | Antal | Quantity | quantity | Yes |
| 8 | Avvikelsetyp | Scrap type | types.name | Yes |
| 9 | Avvikelseorsak | Scrap reason | scrap_reasons.name | Yes |
| 10 | Kommentar | Comment | comment | Yes |
| 11 | Valt datum | Selected date | date | Yes |
| 12 | Skapad datum | Created date | created_at | Yes |
| 13 | Skapad av | Created by | users.name | Yes |
| 14 | Bilaga | Attachment | picture | Yes |
| 15 | Åtgärder | Actions | — | No |

#### Stop Data columns (from `stop_data.blade.php`, exact order):
| # | Display (SV) | Display (EN) | DB field | Filterable |
|---|---|---|---|---|
| 0 | S No | S No | id | No |
| 1 | Flödesnamn | Flow name | flow_designs.name | Yes |
| 2 | Utrustningsbenämning | Equipment name | equipments.name | Yes |
| 3 | Artikelnummer | Part number | parts.part_no | Yes |
| 4 | Artikelnamn | Part name | parts.name | Yes |
| 5 | Skift - benämning | Shift name | work_shift_name | Yes |
| 6 | Ordernummer | Order number | order_no | Yes |
| 7 | Antal | Quantity | quantity | Yes |
| 8 | Tid | Time (mins) | time | Yes |
| 9 | Summa tid | Sum of time | sum_of_time | Yes |
| 10 | Förlustmodellkategori | Loss model category | types.type | Yes |
| 11 | Stoptyp | Stop type | types.name | Yes |
| 12 | Stopporsak | Stop reason | stop_reasons.name | Yes |
| 13 | Kommentar | Comment | comment | Yes |
| 14 | Valt datum | Selected date | date | Yes |
| 15 | Stop tidsstämpel | Stop timestamp | stop_timestamp | Yes |
| 16 | Restart tidsstämpel | Restart timestamp | restart_timestamp | Yes |
| 17 | Skapad datum | Created date | created_at | Yes |
| 18 | Skapad av | Created by | users.name | Yes |
| 19 | Bilaga | Attachment | picture | Yes |
| 20 | Åtgärder | Actions | — | No |

**Stop Data extra:** "Visa även exkluderade kategorier" checkbox (`include_excluded=1` query param). Sends `exclude_type` param to backend.

#### Warning Log columns (from `warning_data/list.blade.php`, exact order):
| # | Display | DB field | Filterable |
|---|---|---|---|
| 0 | S.No | id | No |
| 1 | Equipment Name | equipments.name | Yes |
| 2 | Duration | duration | Yes |
| 3 | Notification text | notification_text | Yes |
| 4 | From timestamp | from_timestamp | Yes |
| 5 | To timestamp | to_timestamp | Yes |
| 6 | Actions | — | No |

**Warning Log actions:** Edit (PATCH `/api/v1/admin/results/warning/:id`), Delete (DELETE).
**Warning Log date strip label:** "Date Range" (English — this company's locale setting).

---

### C6 — Board / Dashboard Module

| Sub-module | Legacy URL | Legacy controller@method | Legacy Blade | New Next.js page |
|---|---|---|---|---|
| Dashboard List | `GET /admin/board/listDashboard` | `BoardController@listDashboard` | `board/list.blade.php` | `admin/boards/page.tsx` |
| Graph Widgets | `GET /admin/board/graphWidgets` | `BoardController@graphWidgets`, `@showGraphWidgetForm`, `@saveGraphWidget` | `board/graph_widgets.blade.php`, `graph_form.blade.php` | `admin/boards/graph-widgets/page.tsx` |
| Board View | `GET /admin/board/show/{id}/{name}` | `BoardController@showDashboard` | `board/dashboard.blade.php` | `admin/boards/[id]/[slug]/page.tsx` |

**Cross-module deps:** ProductionData, StopData, ScrapData (chart data), FlowDesigns, Equipment

#### Dashboard List (screenshot 10.50.24 PM):
- Page title: "Dashboard List"
- Subtitle: "Dashboard List"
- "+ Add Dashboard" top right (links to Board Creator)
- Table columns: S.No, Name, Creator (company name), Edit Date, Dashboard Link (clickable URL), Actions (edit pencil, status toggle, delete X)
- Dashboard Link column in legacy shows full URL `https://fpanalyzer.se/admin/board/show/8/line_1` → in new app: `/admin/boards/8/line-1`
- Actions: edit pencil (blue), play/status toggle (teal), delete X (red) — icon-only with AntD Tooltip
- NestJS endpoints: `GET/POST/PATCH/DELETE /api/v1/admin/boards`, `PATCH /api/v1/admin/boards/:id/status`

**New NestJS endpoints:**
- `GET /api/v1/admin/boards` — list (tenant-scoped)
- `POST /api/v1/admin/boards` — create {name, slug}
- `PATCH /api/v1/admin/boards/:id` — update name/slug
- `DELETE /api/v1/admin/boards/:id`
- `PATCH /api/v1/admin/boards/:id/status`

#### Graph Widgets (screenshot 10.50.45 PM):
- Page title: "Graph Widgets"
- Subtitle: "List"
- "+ Add Widget" top right
- Card grid (3-column): each card shows a preview thumbnail + widget name below
- Three widget types visible in screenshot:
  1. Bar + line combo chart (named "test")
  2. Horizontal multi-row bar with OEE numbers (named "test2")
  3. Speedometer/gauge (named "ttest3")
- Preview thumbnails: static SVG/HighCharts rendered with mock data (not live)
- `GET /api/v1/admin/boards/widgets` — list all widgets (tenant-scoped)
- `POST /api/v1/admin/boards/widgets` — create widget config (HighCharts JSON)
- `GET /api/v1/admin/boards/widgets/:id/preview` — returns chart config for preview render

**STOP AND ASK:** The widget config JSON structure (from `BoardController@graphWidgets` + `@showGraphWidgetForm`) is complex HighCharts config. **Read the full controller methods and graph_form.blade.php before implementing** to determine the exact JSON schema for widget configs.

#### Board View (screenshot 10.50.58 PM):
- URL pattern: `/admin/board/show/8/line_1` → new: `/admin/boards/8/line-1`
- Top bar: FP Analyzer logo, "Line 1" board-selector dropdown, Date Range carousel (same DateRangeStrip component), filter icon, fullscreen icon
- Widget grid: CSS grid layout, each card borderless, shows chart or "No Data" (AntD `<Empty>`)
- Widget cards: no border chrome visible in screenshot — pure panel fill
- Data polling: 30-second interval per Phase 0 v2 §16 R5
- Chart library: HighCharts (same as widget config)
- NestJS endpoints:
  - `GET /api/v1/admin/boards/:id` — board metadata + widget layout
  - `GET /api/v1/admin/boards/:id/chart-data?widgetId=&from=&to=` — live chart data
  - `GET /api/v1/admin/boards` — list (for board-selector dropdown)

---

### C7 — Setup Units / IoT Configuration

| Field | Value |
|---|---|
| **Legacy URL** | `GET /admin/setupUnit` |
| **Legacy controller@method** | `MachineController@setupunit`, `@getSettingUnits`, `@saveUnitEquipment`, `@removeUnitEquipment`, `@saveFilterTime`, `@saveAutoRegistry`, `@saveSignalToCounter`, `@saveCounterData` |
| **Legacy Blade** | `resources/views/backend/machine/setup.blade.php`, `configured_unit.blade.php`, `unconfigured_unit.blade.php` |
| **New Next.js page** | `frontend/src/app/(admin)/admin/iot/setup/page.tsx` (exists as placeholder) |
| **New NestJS endpoints** | `GET /api/v1/admin/iot/units`, `PATCH /api/v1/admin/iot/units/:id/settings`, `POST /api/v1/admin/iot/units/:id/equipment`, `DELETE /api/v1/admin/iot/units/:id/equipment`, `POST /api/v1/admin/iot/units/:id/test-notification` |
| **Cross-module deps** | Equipment (tree for re-assign modal), FlowDesigns (dropdown), StopReasons (cause dropdown) |

**Visual spec (screenshot 10.51.09 PM):**
- Page title: "Setup units"
- Two tabs: "Configured unit" (active), "Unconfigured units"
- Each configured unit = AntD `<Collapse>` panel
- Panel header: gear icon + unit name + signal type label (e.g. "DoBot Input - 1 - ON Signal") + status dot (green smiley = on, yellow warning triangle = warning)
- Expanded panel fields (from screenshot):
  - Installation Date (date display, read-only)
  - Input Number (read-only)
  - Equipment name — text + edit pencil + "Change Equipment" link (opens equipment tree modal)
  - Signal type (dropdown: ON Signal, OFF Signal, Warning Signal)
  - Cause (dropdown — loads from StopReasons)
  - Flow name (dropdown — loads from FlowDesigns)
  - Filter time (sec) — number input
  - Filter time ON (sec) — number input
  - Notification text — text input
  - "Use default" checkbox
  - "Send test notification" button
  - Auto Stop Registration time limit (number input)
  - Red X delete button (removes equipment assignment)

**Signal type options:** ON Signal, OFF Signal, Warning Signal — hardcoded enum (not from DB).

**"Change Equipment" modal:** AntD Tree showing the full equipment hierarchy (reuses equipment/tree data from `GET /api/v1/equipment/tree`).

**Status icon mapping:**
- Green smiley face = unit is ON/active
- Yellow warning triangle = unit is in warning state
- Grey dot (not shown) = offline/unconfigured

---

### C8 — Feedback (Company User Send Form)

| Field | Value |
|---|---|
| **Legacy URL** | `GET /feedback` (frontend route), `POST /feedback/save` |
| **Legacy controller@method** | `FeedbackController@feedback`, `@saveFeedback` |
| **Legacy Blade** | `resources/views/frontend/feedback/form.blade.php` (company user view) |
| **New Next.js page** | `frontend/src/app/(admin)/admin/feedback/page.tsx` (exists, adapt for role) |
| **New NestJS endpoint** | `POST /api/v1/admin/feedback` (already exists in `admin-feedback.routes.js`) |
| **Cross-module deps** | public.users (for role check) |

**Visual spec (screenshot 10.51.21 PM):**
- URL: `fpanalyzer.se/feedback` (legacy frontend route — company user is on frontend layout)
- Page title: "Feedback"
- Centered AntD Card on grey background
- Card content: "Send your feedback to admin" (title/label above textarea)
- Textarea: placeholder "Your feedback"
- "Send" button — purple outline style (matching legacy), right-aligned within card
- On success: clear textarea + AntD `message.success('Feedback sent!')`

**Role-based rendering:**
- If user role = Administrator: show feedback LIST (DataTable — already ported in Phase 4b)
- If user role = Company or User: show this SEND FORM
- Role check: read from JWT/session, `useCurrentUser()` hook already available in new_fp

**Backend note:** `POST /api/v1/admin/feedback` already exists. Verify it saves to `public.feedback` (platform-scoped per Gap 5 Phase 4b decision) with `{ body, userId, tenantId }`.

---

## Section 3 — Cross-Module Dependency Map

| Module (NestJS service) | Reads from |
|---|---|
| `results/production` | flow_designs, equipments, parts, work_shifts, orders, users |
| `results/scrap` | flow_designs, equipments, parts, work_shifts, orders, types, scrap_reasons, users |
| `results/stop` | flow_designs, equipments, parts, work_shifts, orders, types, stop_reasons, users |
| `results/warning` | equipments |
| `equipment/tree` | equipments (self-join) |
| `stop-reasons` (form) | stop_categories |
| `scrap-reasons` (form) | scrap_categories (or types) |
| `iot/setup-units` | equipments (tree), flow_designs, stop_reasons |
| `shift-schedules` (events) | work_shifts |
| `boards/chart-data` | production_data, stop_data, scrap_data |
| `feedback` (admin list) | public.users |

All cross-tenant reads use `withTenant(tenantId)` — no cross-schema reads except `public.feedback` and `public.users`.

---

## Section 4 — Shared Component Inventory

| Component | File path | Used by |
|---|---|---|
| `<DateRangeStrip />` | `components/result/DateRangeStrip.tsx` | C5 (all 4 result pages), C6 (board view) |
| `<TableToolbar />` | `components/shared/TableToolbar.tsx` | C2, C3, C4, C5, C6 (all list pages) |
| `<ColumnFilter />` | `components/shared/ColumnFilter.tsx` | C5 (all result pages) |
| `<SummaryRow />` | `components/shared/SummaryRow.tsx` | C5 (all result pages) |
| `<EquipmentTreeModal />` | `components/equipment/EquipmentTreeModal.tsx` | C7 (Change Equipment in setup units) |

---

## Section 5 — Design Consistency Rules (from screenshots)

1. **Action icon buttons:** blue pencil = edit, teal/green circle = status toggle, red X = delete. Icon-only with AntD Tooltip. No text labels.
2. **"+ Add X" button:** `<Button type="link" icon={<PlusOutlined />}>` with teal/cyan color (`#13c2c2`). Top right alignment.
3. **Create/Update form button:** purple outline style. In AntD: `<Button type="default" style={{ borderColor: '#722ed1', color: '#722ed1' }}>Create</Button>`.
4. **Date Range Strip:** Today highlighted in dark pill. Day-of-week labels visible for adjacent days. `<` `>` arrows scroll one day.
5. **Table toolbar:** Show entries + eye icon + reorder icon on left, Search + Excel export (green) on right.
6. **Page title:** `<Typography.Title level={3}>` matching the exact string in each screenshot (e.g. "Work shift", not "Work Shifts").
7. **Summary dropdown:** `<Select>` below pagination, options: None (0), Empty count, Non-empty count, Distinct count.
8. **Board view widget cards:** No border/card shadow. Pure panel. "No Data" = AntD `<Empty description="No Data" />` centered.
9. **Equipment tree:** AntD `<Tree showLine showIcon>` with equipment-type icon images. No drag-to-reorder in Phase 4c.
10. **Collapse panels (Setup Units):** Gear icon + unit name + signal type in panel header. Status dot in header right.

---

## Section 6 — Translation Keys to Add

Add to `frontend/messages/sv.json` and `frontend/messages/en.json`:

```
result.dateStrip.dateRange        = "Datumintervall" / "Date Range"
result.dateStrip.today            = "Idag" / "Today"
result.dateStrip.thisWeek         = "Denna vecka" / "This week"
result.dateStrip.thisMonth        = "Denna månad" / "This month"
result.dateStrip.custom           = "Anpassat" / "Custom"
result.columns.sNo                = "S No" / "S No"
result.columns.flowName           = "Flödesnamn" / "Flow name"
result.columns.equipmentName      = "Utrustningsbenämning" / "Equipment name"
result.columns.partNumber         = "Artikelnummer" / "Part number"
result.columns.partName           = "Artikelnamn" / "Part name"
result.columns.shiftName          = "Skift - benämning" / "Shift name"
result.columns.orderNumber        = "Ordernummer" / "Order number"
result.columns.workedHours        = "Arbetad tid" / "Worked hours"
result.columns.okPartsQty         = "OK-delar" / "OK parts qty"
result.columns.plannedQty         = "Planerat antal" / "Planned qty"
result.columns.comment            = "Kommentar" / "Comment"
result.columns.selectedDate       = "Valt datum" / "Selected date"
result.columns.createdDate        = "Skapad datum" / "Created date"
result.columns.createdBy          = "Skapad av" / "Created by"
result.columns.quantity           = "Antal" / "Quantity"
result.columns.scrapType          = "Avvikelsetyp" / "Scrap type"
result.columns.scrapReason        = "Avvikelseorsak" / "Scrap reason"
result.columns.attachment         = "Bilaga" / "Attachment"
result.columns.time               = "Tid" / "Time"
result.columns.sumOfTime          = "Summa tid" / "Sum of time"
result.columns.lossCategory       = "Förlustmodellkategori" / "Loss model category"
result.columns.stopType           = "Stoptyp" / "Stop type"
result.columns.stopReason         = "Stopporsak" / "Stop reason"
result.columns.stopTimestamp      = "Stop tidsstämpel" / "Stop timestamp"
result.columns.restartTimestamp   = "Restart tidsstämpel" / "Restart timestamp"
result.columns.duration           = "Varaktighet" / "Duration"
result.columns.notificationText   = "Aviseringstext" / "Notification text"
result.columns.fromTimestamp      = "Från tidsstämpel" / "From timestamp"
result.columns.toTimestamp        = "Till tidsstämpel" / "To timestamp"
result.stop.showExcluded          = "Visa även exkluderade kategorier" / "Show also excluded categories"
board.dashboardList               = "Dashboard List" / "Dashboard List"
board.addDashboard                = "+ Add Dashboard" / "+ Add Dashboard"
board.columns.creator             = "Skapare" / "Creator"
board.columns.editDate            = "Redigeringsdatum" / "Edit Date"
board.columns.dashboardLink       = "Instrumentpanellänk" / "Dashboard Link"
iot.setupUnits                    = "Konfigurera enheter" / "Setup units"
iot.configuredUnit                = "Konfigurerade enheter" / "Configured unit"
iot.unconfiguredUnit              = "Okonfigurerade enheter" / "Unconfigured units"
iot.signalType.on                 = "ON Signal" / "ON Signal"
iot.signalType.off                = "OFF Signal" / "OFF Signal"
iot.signalType.warning            = "Warning Signal" / "Warning Signal"
iot.changeEquipment               = "Byt utrustning" / "Change Equipment"
iot.sendTestNotification          = "Skicka testnotifiering" / "Send test notification"
feedback.sendTitle                = "Skicka din feedback till administratören" / "Send your feedback to admin"
feedback.placeholder              = "Din feedback" / "Your feedback"
feedback.send                     = "Skicka" / "Send"
feedback.success                  = "Feedback skickad!" / "Feedback sent!"
```

---

## Section 7 — Stop Points & Review Gates

1. **NOW (pre-C1):** Review this PHASE4C_SPEC.md. Confirm or correct before any C implementation.
2. **After C5:** Review DateRangeStrip + shared table components before propagating to C6–C8.
3. **After C8:** Full phase review before merge.

## Section 8 — Questions / Ambiguities

### Q1 — RESOLVED: ShiftSchedule calendar event format
`ShiftScheduleController@getScheduleEvents($id, $req)` params: `start` and `end` (ISO date strings, FullCalendar format).

Returns **FullCalendar event objects**: `{ id, start, end, title, textColor, backgroundColor, is_reccuring, parent_id, rc_data }`.

Two event types:
1. **Non-recurring** (`is_reccuring=0, parent_id=0`): simple date-ranged fetch
2. **Recurring** (`is_reccuring=1`): expanded server-side using `rc_data` JSON:
   ```json
   { "type": 1|2|3, "type_val": any, "repeat_day": [0-6], "delete_list": [] }
   ```
   - type=1: repeat indefinitely by `repeat_day` weekdays
   - type=2: repeat until date (`type_val` = end date timestamp)
   - type=3: repeat N weeks (`type_val` = count)

**New endpoint:** `GET /api/v1/admin/shift-schedules/:id/events?start=YYYY-MM-DD&end=YYYY-MM-DD`
Returns same FullCalendar shape. Expansion logic ported to JS in service.
**Calendar library:** Use FullCalendar npm (`@fullcalendar/react`) — the event data shape is FullCalendar-native. Do not use AntD Calendar.

---

### Q2 — RESOLVED: Graph Widgets → in-app HighCharts (Grafana removed)

**Critical finding:** The legacy `graphWidgets` / `showGraphWidgetForm` / `saveGraphWidget` use **Grafana** as the visualization backend — not HighCharts or any in-app charting library.

How it works in legacy:
- `saveGraphWidget()` calls `getGraphResult("api/dashboards/db", $param)` — this is a POST to the **Grafana REST API** creating a panel in a Grafana dashboard
- `graphWidgets()` calls `getGraphResult("api/dashboards/uid/$db_name")` — fetches all panels from Grafana
- `graphWidgetPreview()` renders an **iframe** embedding a Grafana panel URL
- Requires env var `GRAPH_URL` (Grafana instance URL) and a read-only MySQL user for Grafana datasource

The `DashboardWidget` model in the app DB stores only: `title, img_path (static PNG), settings (JSON)`. All actual graph data lives in Grafana.

**The live board view (`board/show`)** is different — `getChartData()` queries the app DB directly (see Q3). This does NOT use Grafana.

**Decision (approved):** Option A — in-app HighCharts. Port `getBarChartData()` logic to NestJS, render with `highcharts-react-official`.

Three widget types from screenshot → HighCharts chart types:
- Bar + line combo → `combo` (`column` series + `spline` series)
- Horizontal multi-row bar with OEE numbers → `bar` chart with `dataLabels`
- Speedometer/gauge → `solidgauge`

Widget config JSON stored in `dashboard_widgets.settings` (HighCharts options object + data source: `{ flow_id, equip_id, chart_type, prod_group }`).
GRAPH_URL / GRAPH_KEY env vars marked `# legacy — unused in new stack` in `.env.example`.
MIGRATION_NOTES.md §1 updated with Calendar and Grafana→HighCharts rows.

---

### Q3 — RESOLVED: getChartData query params + response shape

`getChartData()` — called by the live board view (`board/show`). NOT Grafana.

**Widget settings JSON** (stored in `dashboard_widgets.settings`):
```json
{
  "flow_id": 123,
  "flow_key": "equip_node_key",
  "equip_name": "CNC-01",
  "chart_type": "stop_data|stop_count|scrap_data|scrap_count|production_data|production_count",
  "prod_group": "part|equipment|work_shift",
  "exclude_type": "true|false",
  "filter": {}
}
```

**Response:** `{ widgets: { ...settings, w_id, slot_id, title, flow_name }, chart_data: [...] }`

chart_data rows by chart_type:
- `stop_data`: `{ reason_id, name, quantity, sum_of_time }`
- `stop_count`: `{ date, name, quantity, hours, minutes }`
- `scrap_data`: `{ reason_id, name, quantity }`
- `scrap_count`: `{ date, name, quantity }`
- `production_data`: `{ date, name (varies by prod_group), ok_qty, planned_qty }`
- `production_count`: `{ date, ok_qty, planned_qty }`

New endpoint: `GET /api/v1/admin/boards/:boardId/widgets/:widgetId/chart-data?from=YYYY-MM-DD&to=YYYY-MM-DD`
Returns `{ widget: {...settings}, chartData: [...] }`

---

### Q4 — RESOLVED: Counter units → sub-section inside signal unit Collapse panel

**Critical finding from `MachineController@saveCounterData` + `@saveSignalToCounter`:**

Counter units are a SECOND IoT device type linked to a signal device:

**Signal unit** (C7 main UI — already spec'd):
- Sends `on/off/warning` signals via `signal_type` column
- Assigned to equipment via `equip_id`
- Config: `filter_time`, `filter_time_on`, `signal_type`, `notification_text`, `notification_default`, `auto_registered_data` (JSON)

**Counter unit** (a separate machine record):
- Purpose: counts production parts (not on/off/warning signals)
- Linked to a signal unit via `parent_id` (counter machine.parent_id = signal machine.id)
- Shares same `equip_id` as its parent signal machine
- Config stored in `counter_details` JSON column:
  ```json
  { "date_filter": "daily|weekly|monthly", "part_per_hour": 100, "target_product": 500 }
  ```
- Action: `saveSignalToCounter()` — links/unlinks a counter machine to a signal machine

**The counter unit config is a separate workflow** — it's a sub-panel inside the signal unit's expanded panel (or a separate section). `getSingleMachinealldetails()` returns both signal config and counter config together.

**Not visible in the setup-units screenshot (10.51.09 PM)** — counter linking is either collapsed or not visible for this particular set of units.

**Decision (approved):** Option A — counter config as a nested secondary Collapse section labeled "Counter inputs" inside each signal unit's expanded panel.

Shows only if the signal unit has counter children (`parent_id` pointing to this machine). Each counter child row shows:
- `date_filter` — date range select (daily/weekly/monthly)
- `part_per_hour` — number input
- `target_product` — number input

Saved via `PATCH /api/v1/admin/iot/units/:id/counter-settings` → body `{ date_filter, part_per_hour, target_product }` → updates `counter_details` JSON column on the child machine record.

---

### Q5 — RESOLVED: Warning data schema

From `demoChildDb.sql`, `tbl_warning_data` actual columns:
```
id, equip_id, machine_id, notification_text, from_time, to_time, duration (int, seconds), created_by, created_at, updated_at
```

**Corrections to spec:**
- Column names are `from_time` and `to_time` — **not** `from_timestamp`/`to_timestamp`
- `duration` is an integer (seconds in legacy, display as formatted time)
- No `deleted_at` — no soft delete for warning data
- UI column headers "From timestamp" / "To timestamp" map to DB `from_time` / `to_time`

**Action required before C5:** Add Prisma schema patch for `WarningData` model with correct column names. Run health check after patch.

---

### Q6 — RESOLVED: stop-reasons + scrap-reasons category joins implemented + verified

`admin-stop-reasons.service.js` does **NOT** join stop_categories. Current `list()` returns only `typeId` (integer FK) — no category name.

**Implemented in C2:**
1. `admin-stop-reasons.service.js` — `list()` and `findOne()` LEFT JOIN `stop_category sc ON sc.id = sr.type_id`, return `typeName: sc.name`
2. `GET /api/v1/admin/stop-categories` — queries `stop_category WHERE deleted_at IS NULL AND is_active = 'Y'`
3. `admin-scrap-reasons.service.js` — LEFT JOIN `types sc ON sc.id = sr.type_id AND sc.entity = 'Scrap reason' AND sc.is_active = 'Y'`
4. `GET /api/v1/admin/scrap-categories` — queries `types WHERE entity = 'Scrap reason' AND is_active = 'Y'`

**CORRECTION C2 verification (from demoChildDb.sql):** The `types.entity` column is a MySQL enum: `'Equipments','Content','Stop reason','Scrap reason','Parts','Orders'`. The value `'Scrap reason'` is a dedicated enum member — the filter is clean and will never return equipment types, part types, or order types. Data is not contaminated. No dedicated `scrap_category` table exists in legacy; the `types` table with entity scoping is the correct source. ✅

---

### CORRECTION 3 — Resolved: signal_type is a DB enum

`tbl_machines.signal_type` is `enum('on','off','warning') NOT NULL DEFAULT 'on'`.

The UI display labels "ON Signal", "OFF Signal", "Warning Signal" are **UI constants** (not DB-stored).
The stored values are lowercase: `on`, `off`, `warning`.

In new app: store `on`/`off`/`warning` in DB; display as "ON Signal"/"OFF Signal"/"Warning Signal" via a constant map in the service/frontend. Do NOT add a stop_categories-style config table for these — they are schema-level fixed values.

---

## Section 9 — Implementation Order After Approval

```
A1, A2 → DONE
C1 → C2 → C3 → C4 → [STOP: review shared components] → C5 → [STOP: review DateRangeStrip] → C6 → C7 → C8 → [STOP: final review]
```

Commit message per module: see Section G of the Phase 4c prompt.
