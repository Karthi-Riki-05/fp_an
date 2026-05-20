# My Result Module — Complete Implementation Reference

> Detailed technical report of the **My Result** page in FP Analyzer.
> Companion to `unit.md`. Purpose: when re-implementing this module in another
> project, point Claude Code at this file plus the FP Analyzer folder and it has
> the full picture — routes, controllers, models, views, JS, AJAX flow, DB
> tables and the UI design.
>
> URL in app: `https://fpanalyzer.se/myresult` (redirects to the user's preferred tab)
> Generated: 2026-05-16

---

## 1. What This Module Does (Business Logic)

The My Result module is the **operator's personal data-entry/audit screen**. It
exposes the rows the current user has produced (or that the IoT has produced
on their behalf) across five tabs:

1. **Production data** — `production_data` rows the operator created via
   "Save production".
2. **Scrap data** — `scrap_data` rows.
3. **Stop data** — `stop_data` rows (registered downtime).
4. **Warning log** — `tbl_warning_data` rows raised by the IoT
   (only shown if at least one warning has both `from_time` and `to_time`).
5. **Unregistered stops** — `tbl_machine_data` rows with `is_registered = 'no'`
   and a non-null `end_time`. Read-only audit; the actual registration UI is
   the Units module.

Across every tab the page provides:

- A horizontal **date-range slider** (`#date_range_slider`) with day/week/
  month/quarter/year presets, custom date-pickers and a draggable/resizable
  scrubber. Picks `start_date` and `end_date` that are pushed into every
  DataTables request.
- **Server-side DataTables** with: per-column filter (8 operators), drag-to-
  group ("Filter By Group"), Excel export, sort, page-size (10/25/50/All),
  "Show my entries only" toggle (`created_by = me`), per-tab "Show also excluded
  types" toggle (Stop data only), column visibility/resize persisted to
  `users.table_settings`, and a footer **Summary** row (Empty / Non-empty /
  Distinct / Sum / Max / Min / Avg).
- Each row has an **Actions** column with edit / delete buttons (only when
  `created_by` matches the current user). Edit opens a full-page form
  (`/myresult/formResult{Production|ScrapData|StopData}/{id}`); delete posts to
  `/myresult/deleteResult{...}/{id}`.
- Warning log uses a different edit/delete pair
  (`/myresult/warning/edit/{id}`, `/myresult/warning/delete/{id}`) and has its
  own edit form.

---

## 2. File Map (all paths relative to project root)

| Layer | Path |
|---|---|
| Routes | `routes/Frontend/Frontend.php` (lines 25-53) |
| Controller | `app/Http/Controllers/Frontend/User/DashboardController.php` |
| Tab dispatcher | `DashboardController@myresult` (line 48) |
| Tab-preference helper | `DashboardController::getTapSettings()` / `getTapList()` |
| Filter operator helper | `DashboardController::getFilterTypeQuery()` |
| Production | `userProductionData`, `formResultProduction`, `saveResultProduction`, `deleteResultProduction`, `getProductionSummary` |
| Scrap | `userScrapData`, `formResultScrapData`, `saveResultScrapData`, `deleteResultScrapData`, `getResultScrapSummary` |
| Stop | `userStopData`, `formResultStopData`, `saveResultStopData`, `deleteResultStopData`, `getResultStopSummary` |
| Unregistered stop | `userUnregStopData` |
| Warning log | `userWarningLog`, `editWarningLog`, `updateWarningLog`, `deleteWarningLog` |
| User-settings helpers | `app/Lib/CommonFunc.php`: `saveTableSettings`, `saveSettings`, `getTableSettings`, `setUserSettings` |
| Shift schedule resolver | `app/Lib/CommonFunc.php::getShiftScheduleTitleByTimeAll` |
| Tab views | `resources/views/frontend/user/myresult/{production_data,scrap_data,stop_data,warning_log,unreg_data}.blade.php` |
| Tab body partials (DataTables + JS) | `resources/views/frontend/user/myresult/{production_data,scrap_data,stop_data,warning_log_cont,unreg_data}_cont.blade.php` |
| Edit forms | `resources/views/frontend/user/myresult/form_{production,scrap_data,stop_data,warning_log}.blade.php` |
| Date-range slider | `resources/views/backend/board/date_range_slider.blade.php` (≈1780 LOC, jQuery-UI Resizable + Draggable, custom day/week/month/year renderer, jQuery `datepicker.min.js` for the bubble) |
| Filter dropdown partial | `resources/views/backend/includes/filter_dlg.blade.php` (8 operators) + Summary `<select>` |
| Action buttons partial | `resources/views/backend/button/actions.blade.php` |
| Models | `app/Models/{StopData,ScrapData,ProductionData,WarningData}.php`, `app/Models/Machine/MachineData.php` |
| JS libraries | `public/datatable/datatables.min.js`, `public/js/table-grouping.js` (group-by + drag-and-drop columns), `all-frontend.js` (`initDateRange`, `initVisibleColumn`, `doFilterSearch`, `processCallback`, `setSummaryVal`, `newExportAction`, `handleDataTableAjaxError`, `updateSettings`, `pageLength`, `buttons`, `visibleStr`) |

---

## 3. Routes

All defined in `routes/Frontend/Frontend.php` (auth middleware):

```php
Route::get ('myresult',                              'DashboardController@myresult')->name("myresult");
Route::get ('myresult/production_data',              'DashboardController@userProductionData')->name("userProductionData");
Route::get ('myresult/scrap_data',                   'DashboardController@userScrapData')->name("userScrapData");
Route::get ('myresult/stop_data',                    'DashboardController@userStopData')->name("userStopData");
Route::get ('myresult/unregistered_stop',            'DashboardController@userUnregStopData')->name("userUnregStopData");

Route::get ('myresult/warning_log',                  'DashboardController@userWarningLog')->name('userWarningLog');
Route::get ('myresult/warning/edit/{id}',            'DashboardController@editWarningLog')->name('editWarningLog');
Route::post('myresult/warning/update',               'DashboardController@updateWarningLog')->name('updateWarningLog');
Route::post('myresult/warning/delete/{id}',          'DashboardController@deleteWarningLog')->name('deleteWarningLog');

Route::get ('myresult/formResultProduction/{id?}',   'DashboardController@formResultProduction')->name('formUserProductionData');
Route::post('myresult/saveResultProduction',         'DashboardController@saveResultProduction')->name('saveUserProduction');
Route::get ('myresult/deleteResultProduction/{id}',  'DashboardController@deleteResultProduction');

Route::get ('myresult/formResultScrapData/{id?}',    'DashboardController@formResultScrapData')->name('formUserScrapData');
Route::post('myresult/saveResultScrapData',          'DashboardController@saveResultScrapData')->name('saveUserScrapData');
Route::get ('myresult/deleteResultScrapData/{id}',   'DashboardController@deleteResultScrapData');

Route::get ('myresult/formResultStopData/{id?}',     'DashboardController@formResultStopData')->name('formUserStopData');
Route::post('myresult/saveResultStopData',           'DashboardController@saveResultStopData')->name('saveUserStopData');
Route::get ('myresult/deleteResultStopData/{id}',    'DashboardController@deleteResultStopData');

Route::get ('myresult/getProductionSummary',         'DashboardController@getProductionSummary');
Route::get ('myresult/getResultScrapSummary',        'DashboardController@getResultScrapSummary');
Route::get ('myresult/getResultStopSummary',         'DashboardController@getResultStopSummary');

// shared settings save endpoint (CommonFunc trait)
Route::post('saveTableSettings',                     'DashboardController@saveTableSettings')->name('frontend.saveTableSettings');
```

**Endpoint cheat-sheet**

| Method | URL | Purpose |
|---|---|---|
| GET | `/myresult` | Redirects to the first tab in the user's saved tab order. |
| GET | `/myresult/{tab}` | Render the page shell + tab's DataTable, OR (when `request()->ajax()`) return DataTables JSON. Same URL handles both. |
| GET | `/myresult/getProductionSummary?type={1-7}` | Aggregate columns for Production summary footer. |
| GET | `/myresult/getResultScrapSummary?type={1-7}` | Same for Scrap. |
| GET | `/myresult/getResultStopSummary?type={1-7}` | Same for Stop. |
| GET | `/myresult/formResult{Production,ScrapData,StopData}/{id?}` | Full-page edit/create form (id absent ⇒ new). |
| POST | `/myresult/saveResult{Production,ScrapData,StopData}` | Persist, redirect back to tab. |
| GET | `/myresult/deleteResult{...}/{id}` | Soft delete and redirect back. |
| GET | `/myresult/warning/edit/{id}` | Warning-log edit form. |
| POST | `/myresult/warning/update` | Save warning log. |
| POST | `/myresult/warning/delete/{id}` | Delete warning log. |
| POST | `/saveTableSettings` (ajax) | Persist any per-user table preference key into `users.table_settings` JSON. |

> Note: the `data_type` argument passed to `saveTableSettings` controls *which*
> sub-key gets written. Used keys on this page:
> - `ru_production_data` / `ru_scrap_data` / `ru_stop_data` / `r_warning_data`
>   / `ru_scrap_data` (reused for unreg) — store column visibility, widths,
>   `show_my_entries`.
> - `exclude_type.stop` — store the "show also excluded types" toggle for Stop
>   tab.
> - `tap_setting.myresult` — drag-sorted tab order for the page.

---

## 4. Database Tables (used by this module)

All in the **company DB** (`companysql`).

### `production_data` (model `App\Models\ProductionData`)
| Column | Meaning |
|---|---|
| `id` | PK |
| `flow_id` | FK → `flow_designs.id` |
| `flow_object_key` | FK → `equipments.id` (equipment id, despite the name) |
| `part_id` | FK → `parts.id` |
| `work_shift_id` | FK → `work_shifts.id` (0 when name-only) |
| `work_shift_name` | resolved shift label (snapshot — survives shift renames; used when `work_shift_id = 0`) |
| `order_no` | free-text |
| `work_hours` | `HH:MM:SS` worked |
| `part_qty` | quantity OK |
| `planned_qty` | planned target |
| `comment` | free-text |
| `date` | date the entry refers to |
| `created_by` | FK → `users.id` |
| `created_at`, `updated_at`, `deleted_at` | soft-delete timestamps |

### `scrap_data` (model `App\Models\ScrapData`)
| Column | Meaning |
|---|---|
| `id`, `flow_id`, `flow_object_key`, `part_id`, `work_shift_id`, `work_shift_name`, `order_no`, `quantity`, `date`, `comment`, `created_by`, `created_at`, `updated_at`, `deleted_at` | same as above |
| `scrap_type_id` | FK → `types.id` (entity = `Scrap reason`) |
| `reason` | FK → `scrap_reasons.id` |
| `picture` | optional uploaded image path |

### `stop_data` (model `App\Models\StopData`)
| Column | Meaning |
|---|---|
| `id`, `flow_id`, `flow_object_key`, `part_id`, `work_shift_id`, `work_shift_name`, `order_no`, `quantity`, `date`, `comment`, `created_by`, `created_at`, `updated_at`, `deleted_at` | same as above |
| `stop_type_id` | FK → `types.id` (entity = `Stop reason`) |
| `reason` | FK → `stop_reasons.id` |
| `time` | `HH:MM:SS` per stop |
| `hours`, `minutes` | integer parts of `time` |
| `sum_of_time` | `(hours*3600 + minutes*60 + secs) * quantity` (back-filled on read if empty) |
| `stop_timestamp` | start ts (set when row originated from a unit registration) |
| `restart_timestamp` | end ts |
| `picture` | optional uploaded image path |
| `stop_data_type` | `'pre'` if pre-registered, else null |
| `machine_stop_id` | FK → `tbl_machine_data.id` if originated from IoT registration |

### `types` (model `App\Models\Types`)
Parent groupings for stop reasons and scrap reasons.
Columns used: `id`, `name`, `entity` (`'Stop reason'` or `'Scrap reason'`),
`type` (one of `Performance`, `Availability`, `Quality`, `Other`,
`Not applicable` — translated via `custom.texts.{type}`), `exclude_type`
(`0` = visible by default, `1` = hidden unless "show excluded" toggled).

### `stop_reasons` (model `App\Models\StopReason`)
Columns: `id`, `name`, `type_id` (FK → `types.id`), `status` (`'1'` = active).

### `scrap_reasons` (model `App\Models\ScrapReason`)
Same shape.

### `tbl_warning_data` (model `App\Models\WarningData`)
| Column | Meaning |
|---|---|
| `id` | PK |
| `equip_id` | FK → `equipments.id` |
| `notification_text` | free-text shown to operators |
| `from_time` | DATETIME — warning start. Tab tab is **hidden** entirely if no warning has both `from_time` and `to_time`. |
| `to_time` | DATETIME — warning end |
| `duration` | seconds (computed in `updateWarningLog` as `strtotime(to) - strtotime(from)`) |
| `created_by` | FK |

### `tbl_machine_data` (used by Unregistered stops tab)
Mirrors §4 of `unit.md`. Tab joins to `tbl_machines` (for `unit_name`) and
`equipments` (for `name`). Filters: `signal_type != 'warning'`,
`is_registered = 'no'`, `is_valid_data = 'yes'`, `end_time IS NOT NULL`,
ordered by `id DESC`.

### `users.table_settings` (master DB, JSONB after port)
Per-user JSON blob. Keys touched by this module:
```jsonc
{
  "tap_setting":       { "myresult": ["0","1","2","3","4"] }, // drag-sort tab order
  "ru_production_data": { "show_my_entries": 1, "columns": {...}, "widths": {...} },
  "ru_scrap_data":      { "show_my_entries": 1, ... },
  "ru_stop_data":       { "show_my_entries": 1, ... },
  "r_warning_data":     { ... },
  "exclude_type":       { "stop": 1 },                       // "show also excluded types"
  "filter_search":      {  /* persisted per-column filter operators */ }
}
```

### Supporting tables
- `equipments` → name shown in Equipment Name column.
- `flow_designs` → name shown in Flow Name column; also linked via
  `flow_object_key` when scoping by equipment.
- `parts` → `part_no` (Part number column) + `name` (Part name column).
- `work_shifts` → fallback shift name when no schedule is configured.
- `equipment_shift_schedule` + `shift_schedule_data` → resolves the
  work-shift label when the form is edited and the row has no
  `work_shift_id` (uses `getShiftScheduleTitleByTimeAll`).

---

## 5. Page Flow Diagram

```
GET /myresult
  └── DashboardController@myresult()
        └── reads users.table_settings.tap_setting.myresult
            (force-include tabs 3 + 4 — Warning + Unregistered)
            (hide tab 3 if no warning_data has both from_time and to_time)
        └── redirect → route name for the first id in $tab_pref

GET /myresult/{tab}                (non-AJAX, server render)
  └── userProductionData|userScrapData|userStopData|userWarningLog|userUnregStopData
        ├── loads $tap (HTML string of <li> entries built by getTapList())
        ├── loads $table_settings (JSON string of the user's prefs)
        └── returns view 'frontend.user.myresult.{tab}'
              → which @extends master and @includes
                'frontend.user.myresult.{tab}_cont' AND
                'backend.board.date_range_slider' AND
                'backend.includes.filter_dlg'

DOMReady JS (inside *_cont.blade.php)
  ├── initDateRange(table_settings)        // wires DR_SLIDER to push start_date/end_date into table.ajax.reload
  ├── initVisibleColumn(<settingsKey>,...) // column visibility / resize plumbing
  ├── reads query string  flow_id, flow_key (→ equip_id), date, name, filter, prod_group
  │   (used when navigating from a dashboard widget that drills into a tab)
  ├── builds $('#users-table').DataTable({serverSide:true, ajax:{ url, data:fn }})
  │   data fn pushes: order, status=1, trashed=false, show_my_entries,
  │     start_date, end_date, flow_id, equip_id, date, type_name, prod_group, filter, exclude_type
  ├── initComplete:
  │     ├── injects a second <tr class="filter_hld"> in <thead> with per-column inputs
  │     │   + .filter_column (operator picker linked to filter_dlg.blade.php)
  │     ├── adds Group-By button per .group_by header
  │     ├── adds the Visibility / Resize menu (visibleStr)
  │     └── (Stop tab only) appends #exclude_type_hld with the "Show also excluded types" checkbox
  └── drawCallback:
        ├── appends footer-summary controls (the .summary-hld <select>)
        ├── on summary change → AJAX get{Type}Summary?type={1..7} → setSummaryVal()
        └── processCallback(api)            // applies group-by aggregation in JS

GET /myresult/{tab}        (AJAX, serverSide DataTables request)
  └── same controller method, returns DataTables::of(query)->...->make(true)
        ├── joins equipments, flow_designs, parts, users + type/reason tables
        ├── applies start_date/end_date, flow_id, equip_id, type_name (+ prod_group for Production),
        │   show_my_entries, filter[filter_workshift|filter_part|order_no]
        ├── applies per-column filterColumn / filterType / filterVal (8 operators)
        ├── applies order[col].dir with Swedish-collation fallback for text columns
        ├── editColumn('picture',...) wraps the path in an <img>
        ├── editColumn('sum_of_time',...) computes (h*60+m)*qty*60 if NULL and persists
        ├── editColumn('types-type',...) translates the loss-model bucket
        └── addColumn('actions',...) renders Edit/Delete only if row.created_by == auth user

GET /myresult/getResult{...}Summary?type={1-7}
  └── builds one of 7 hand-written SQL strings against the same table
       scoped to `created_by = current user` and not soft-deleted
       (1 empty | 2 non-empty | 3 distinct | 4 sum | 5 max | 6 min | 7 avg)

GET /myresult/formResult{Production|ScrapData|StopData}/{id?}
  └── loads the row (if id), pulls parts+shifts+types+reasons,
      builds $schedule_ar via getShiftScheduleTitleByTimeAll() when row has work_shift_id=0
      returns the form view

POST /myresult/saveResult{Production|ScrapData|StopData}
  └── Validator + myTimeValidation extension (Stop/Production)
  └── computes sum_of_time for stops
  └── ProductionData|ScrapData|StopData::find()->save()
  └── redirect back to the tab with a flash

GET /myresult/deleteResult{...}/{id}
  └── ModelClass::where('id',$id)->delete()    // soft delete via SoftDeletes
  └── redirect back with flash
```

---

## 6. Detailed Function-by-Function Reference

### 6.1  `DashboardController@myresult()` — tab dispatcher
`DashboardController.php:48`. Reads `users.table_settings.tap_setting.myresult`,
maps the first preferred index to a route name (`userProductionData`,
`userScrapData`, `userStopData`, `userWarningData`) and `redirect()`s.

### 6.2  `getTapSettings()` (private, line 62)
Reads the user's tap order JSON. Always force-includes ids `3` (warning_log)
and `4` (unregistered_stop). If no `tbl_warning_data` row has both `from_time`
and `to_time`, id `3` is **removed** from the return value (the Warning tab
becomes invisible).

### 6.3  `getTapList($activeIndex)` (private, line 90)
Renders the `<li>` HTML for the tab strip using the `frontend.layouts.master`
nav style; the active li gets `class="active"`. The list is sortable via the
master layout's `#nav-tabs-sort` jQuery-UI Sortable wiring; reorder writes back
to `tap_setting.{type}`.

### 6.4  `getFilterTypeQuery($type, $val)` (private, line 106)
Maps the 8 filter operator ids from `filter_dlg.blade.php` into `[operator,
value]` tuples for the query builder:

| `data-type` | UI label | SQL operator | Value transform |
|---|---|---|---|
| 1 | Equals | `=` | as-is |
| 2 | Does Not Equal | `!=` | as-is |
| 3 | Contains | `LIKE` | `%val%` |
| 4 | Does Not Contain | `NOT LIKE` | `%val%` |
| 5 | Is Empty | `=` | `''` |
| 6 | Is Not Empty | `!=` | `''` |
| 7 | Starts With | `LIKE` | `val%` |
| 8 | Ends With | `LIKE` | `%val` |

For empty / not-empty (5, 6) the controller applies the WHERE *even when the
text input is empty* — every other operator is skipped when the input is empty.

### 6.5  `userStopData()` — Stop tab list
`DashboardController.php:159`. The most complex tab. Joins:

```sql
SELECT stop_data.*,
       equipments.name        AS `equipments-name`,
       flow_designs.name      AS `flow_designs-name`,
       parts.name             AS `parts-name`,
       parts.part_no          AS `parts-part_no`,
       users.name             AS `users-name`,
       stop_reasons.name      AS `stop_reasons-name`,
       types.name             AS `types-name`,
       types.type             AS `types-type`
FROM stop_data
LEFT JOIN equipments    ON equipments.id    = stop_data.flow_object_key
LEFT JOIN flow_designs  ON flow_designs.id  = stop_data.flow_id
LEFT JOIN parts         ON parts.id         = stop_data.part_id
LEFT JOIN users         ON users.id         = stop_data.created_by
LEFT JOIN types         ON types.id         = stop_data.stop_type_id
LEFT JOIN stop_reasons  ON stop_reasons.id  = stop_data.reason
```

Conditional WHEREs (all driven from the DataTables `data:` callback):
- `exclude_type != "1"` ⇒ adds `WHERE types.exclude_type = 0` (default-hidden
  loss-model rows are excluded). When `save_exclude_option=1` is sent the
  setting is persisted via `saveSettingsData("exclude_type","stop", …)`.
- `flow_id` → `stop_data.flow_id = ?`
- `equip_id` → `stop_data.flow_object_key = ?`
- `type_name` → looks up `stop_reasons.id` by name (status=1) and filters on
  `stop_data.reason`.
- `filter.filter_workshift` (comma-string of ids) → `whereIn work_shift_id`
- `filter.filter_part` → `whereIn part_id`
- `filter.order_no` → `where order_no = ?`
- `start_date`/`end_date` (or `date` which sets both) → range on `stop_data.date`.
- `show_my_entries` AND no `date` → `created_by = auth.id`.

Ordering: numeric columns go through `orderBy`; text columns go through
`orderByRaw($col . " COLLATE utf8_swedish_ci " . $dir)` so the Swedish letters
sort correctly. `stop_reasons.name` uses the older `latin1_swedish_ci`.

Per-column filters: each tuple of `filterColumn[i] / filterType[i] /
filterVal[i]` runs through `getFilterTypeQuery()`.

Response transforms (Yajra `DataTables::of`):
- `sum_of_time`: if NULL, computes `(hours*60 + minutes) * quantity * 60` and
  **persists** it back to the row, then formats `HH:MM:SS`.
- `picture`: wraps in `<a href=…><img …/></a>`.
- `types-type`: if the value is one of `Performance / Availability / Quality /
  Other / Not applicable` it is translated via
  `trans('custom.texts.'.$value)`.
- `actions`: included only when `row.created_by == auth.id` — uses
  `backend.button.actions` with `edit = myresult/formResultStopData/{id}` and
  `delete = myresult/deleteResultStopData/{id}`.

Non-AJAX branch returns view `frontend.user.myresult.stop_data` with
`$table_settings` and `$tap`.

### 6.6  `userScrapData()` — Scrap tab list
`DashboardController.php:316`. Same shape as 6.5 with these differences:
- Joins `scrap_reasons` and `types` on `scrap_data.scrap_type_id`.
- No `exclude_type` logic (only Stop tab has it).
- Editable columns: `picture` only.
- Sortable columns: `id`, `work_shifts.name`, `quantity`, `date`, `created_at`
  use direct `orderBy`; everything else goes through `utf8_swedish_ci`.

### 6.7  `userProductionData()` — Production tab list
`DashboardController.php:442`. Same shape with:
- No type / reason joins (Production has no reason picker).
- `prod_group` query parameter — used when the page is navigated from a
  drill-down chart. Values: `part` (filter by `part_no` looked up in `parts`),
  `equipment` (look up `equipments.name`), `work_shift` (look up
  `work_shifts.name`); otherwise treats `type_name` as a raw `order_no`.
- Editable columns: `work_hours` → `date('H:i:s', strtotime($row->work_hours))`.

### 6.8  `userUnregStopData()` — Unregistered stops list
`DashboardController.php:583`. Joins `tbl_machine_data` ↔ `tbl_machines` ↔
`equipments`. Date filter is applied to `DATE(start_time)` (not `date` — the
machine table has no `date` column).
Final scoping: `tbl_machines.signal_type != 'warning'` AND
`is_registered = 'no'` AND `is_valid_data = 'yes'` AND `end_time IS NOT NULL`,
`ORDER BY id DESC`.

> Bug carried over (line 718-730): the action column references an admin route
> (`admin/production/order-edit/...`) and `addColumn('actions',...)` ignores
> the `created_by` check. The new build can either drop the column entirely
> (the unregistered tab is read-only) or wire it to the Units module's
> registration modal.

### 6.9  `formResult{Production,ScrapData,StopData}($id = '')`
`DashboardController.php:740 / 835 / 914`. Loads the row when `$id` is set
(otherwise an empty model). Pulls `$parts`, `$shifts`, and for Scrap/Stop also
`$types` (entity filter) and `$reasons`. If the row has `work_shift_id = 0`,
runs `getShiftScheduleTitleByTimeAll($data->date, $data->flow_object_key)` to
build `$schedule_ar` (recurring-shift titles for that date), which swaps the
work-shift dropdown to a name-based picker.

### 6.10  `saveResult{Production,ScrapData,StopData}()`
`DashboardController.php:762 / 860 / 939`. Each uses Laravel `Validator`:

| Field | Production | Scrap | Stop |
|---|---|---|---|
| `part_id` | required | required | required |
| `work_shift_id` OR `work_shift_name` | one required | one required | one required (also re-asserted post-validate) |
| `order_no` | optional | optional | optional |
| `work_hours` | `myTimeValidation` (`HH:MM:SS`) | — | — |
| `part_qty` / `planned_qty` | required | — | — |
| `quantity` | — | required | required numeric |
| `time` | — | — | `myTimeValidation` |
| `scrap_type_id` / `reason` | — | required | — |
| `stop_type_id` / `reason` | — | — | required |
| `date` | required `Y-m-d` | required `Y-m-d` | required `Y-m-d` |

`myTimeValidation` is a closure registered with `Validator::extend` that
asserts the value has three `:`-separated numeric segments.

Stop tab also computes `hours`, `minutes`, and `sum_of_time = (h*3600 + m*60 +
s) * quantity` before saving.

All three redirect back to their listing route with a flash success message.

### 6.11  `deleteResult{...}($id)`
Soft-deletes via Eloquent (`StopData::where(...)->delete()`) and redirects
back. No CSRF token is checked because the route is GET — see §11.5.

### 6.12  `getProductionSummary() / getResultScrapSummary() / getResultStopSummary()`
Each accepts `?type=1..7` and runs one of 7 hand-written SQL strings scoped to
`deleted_at is null AND created_by = $user_id`:

| type | Output per column |
|---|---|
| 1 | Count of empty rows |
| 2 | Count of non-empty rows |
| 3 | Count of distinct values |
| 4 | SUM (only quantity-ish columns; identifier columns return `'0'`) |
| 5 | MAX |
| 6 | MIN |
| 7 | AVG |

The Stop variant additionally aggregates `hours` and `minutes` into a single
`time` value (e.g. `SUM(hours) + (SUM(minutes)/60)` for type 4 — note this is
hours-as-decimal, not `HH:MM`).

Returns `json_encode($data[0])`. The `.summary-hld` change handler in the
view writes each field into the `.summary-row-item.{key}` `<td>`s.

### 6.13  `userWarningLog()`, `editWarningLog()`, `updateWarningLog()`, `deleteWarningLog()`
- List joins `tbl_warning_data` ↔ `equipments`; filter on `equip_id`,
  `start_date`/`end_date` of `DATE(from_time)`, and `show_my_entries`.
- `duration` column is rendered as `HH:MM:SS` from the stored seconds.
  Filter on `duration` parses the user input back to seconds (h*3600 +
  m*60 + s) before applying the operator.
- Edit form: equipment dropdown, `from_time`, `to_time`, `notification_text`.
  On save, `duration = strtotime(to_time) - strtotime(from_time)` is
  recomputed server-side.

### 6.14  `app/Lib/CommonFunc.php` helpers
| Method | Purpose |
|---|---|
| `saveTableSettings()` | AJAX endpoint — pulls `data_type`, `data_val`, `data` from request and proxies to `saveSettings()`. |
| `saveSettings($type,$key,$data,$userId)` | Merges `$data` under `table_settings[$type][$key]` JSON and persists. Returns `1`/`0`. |
| `getTableSettings($user)` | Decodes `users.table_settings`. |
| `setUserSettings()` | Constructor middleware — switches the `companysql` connection to the tenant DB from `Session('login_arr')` and sets the timezone. |
| `getShiftScheduleTitleByTimeAll($date, $equipmentId)` | Returns `[ {start,end,title}, … ]` of recurring shift events for a single date — used to populate the work-shift name dropdown in edit forms when `work_shift_id = 0`. |

---

## 7. View Anatomy

### 7.1  Tab page (e.g. `stop_data.blade.php`)

```
@extends 'frontend.layouts.master'
@section content
  <div class="container-fluid">
    <div class="dashboard_block detail_block analyzar-blade">
      <div class="panel">
        <div class="panel-heading"><a href="/dashboard"><img src="/images/ic_arrow_left.png"></a>  My result</div>
        <div class="panel-body">
          <div class="box-body content" id="contents">
            <ul class="nav nav-tabs" id="nav-tabs-sort" data-type="myresult">
              {!! $tap !!}                                ← server-rendered <li> per tab (drag-sortable)
            </ul>
            <div class="tab-content" id="tab_content">
              <div class="row">
                <div class="col-md-12">
                  @include('backend.board.date_range_slider')   ← #date_range_slider
                </div>
              </div>
              @include('frontend.user.myresult.stop_data_cont') ← table + JS
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
@stop
```

### 7.2  Tab body (`stop_data_cont.blade.php`)

```
<div class="grouping_filter">
  <span>Filter By Group</span>
  <div class="filter_drop_area">Drop group here</div>          ← drop target for column drag
  <ul class="filter_lst"></ul>                                  ← active group chips
</div>

<table id="users-table" class="table table-condensed table-hover">
  <thead>
    <tr>
      <th data-id="0">S.No</th>
      <th data-id="1" class="group_by">Flow name</th>
      <th data-id="2" class="group_by">Equipment Name</th>
      <th data-id="3" class="group_by">Part number</th>
      <th data-id="4" class="group_by">Part Name</th>
      <th data-id="5" class="group_by">Shift Name</th>
      <th data-id="6" class="group_by">Order NR</th>
      <th data-id="7" class="group_by">Quantity</th>
      <th data-id="8" class="group_by" data-name="mins">Time</th>
      <th data-id="9" class="group_by" data-name="mins">Sum of time</th>
      <th data-id="10" class="group_by">Loss model category</th>   ← types.type translated
      <th data-id="11" class="group_by">Stop type</th>              ← types.name
      <th data-id="12" class="group_by">Stop reason</th>            ← stop_reasons.name
      <th data-id="13" class="group_by">Comment</th>
      <th data-id="14" class="group_by">Selected date</th>
      <th data-id="15" class="group_by">Stop timestamp</th>
      <th data-id="16" class="group_by">Restart timestamp</th>
      <th data-id="17" class="group_by">Created date</th>
      <th data-id="18" class="group_by">Created by</th>
      <th data-id="19" class="">Attachment</th>
      <th data-id="20" class="no-export">Actions</th>
    </tr>
  </thead>
</table>

<div id="loader-hld">…spinner…</div>
<div id="exclude_type_hld" style="display:none">
  <input type="checkbox" id="exclude_type" onchange="changeExcludeOptions(this)">
  Show also excluded types
</div>

@include('backend.includes.filter_dlg')          ← shared 8-operator popover + summary <select>
```

### 7.3  Tab column layouts

| Tab | Columns (in order) |
|---|---|
| **Production data** | `S.No, Flow name, Equipment Name, Part number, Part Name, Shift Name, Order NR, Worked Hours, Ok Parts Qty, Planned Qty, Comment, Selected date, Created date, Created by, Actions` |
| **Scrap data** | `S.No, Flow name, Equipment Name, Part number, Part Name, Shift Name, Order NR, Quantity, Scrap type (types.name), Scrap reason (scrap_reasons.name), Comment, Selected date, Created date, Created by, Attachment, Actions` |
| **Stop data** | (see 7.2 above) |
| **Warning log** | `S.No, Equipment Name, Duration, Notification text, From timestamp, To timestamp, Actions` |
| **Unregistered stops** | `S.No, Unit (tbl_machines.unit_name), Equipment, Start Time, End Time, Production time` |

### 7.4  DataTables shared init pattern

Every `_cont.blade.php` does roughly the same:

```js
var table_settings = JSON.parse('<?php echo $table_settings ?>');
var show_my_entries = 0, exclude_type = 0;
var flow_id   = '{{ $_GET["flow_id"]  ?? "" }}';
var equip_id  = '{{ $_GET["flow_key"] ?? "" }}';
var date      = '{{ $_GET["date"]     ?? "" }}';
var type_name = '{{ $_GET["name"]     ?? "" }}';
var filter    = JSON.parse('<?= json_encode($_GET["filter"] ?? []) ?>');

$(function () {
  if (flow_id === '') initDateRange(table_settings);           // wires DR_SLIDER → ajax reload
  initVisibleColumn('<settings_key>',  /* … */ true);          // column show/hide + resize
  if (typeof table_settings['<settings_key>'] !== 'undefined') {
    show_my_entries = table_settings['<settings_key>'].show_my_entries;
  }

  table = $('#users-table').DataTable({
    processing: true, serverSide: true, pageLength: pageLength,
    dom: 'lBfrtip',
    lengthMenu: [[10,25,50,-1],[10,25,50,'All']],
    buttons: buttons,                                          // Excel HTML5 (no-export columns omitted)
    ajax: {
      url: '{{ route("user<Tab>") }}',
      type: 'get',
      data: d => Object.assign(d, {
        order, status: 1, trashed: false,
        show_my_entries, start_date, end_date,
        flow_id, equip_id, date, type_name, filter, exclude_type
      }),
      error: handleDataTableAjaxError
    },
    columns: [...],
    searchDelay: 500,
    initComplete: /* build filter <tr>, add group-by buttons, wire visibility menu */,
    drawCallback: /* render footer Summary row + summary-hld change handler */
  });
});
```

The `_cont` views diverge only in (a) the `<th>` definitions, (b) the
`columns` array, (c) the per-column filter inputs (the `name` attribute is
the SQL column the filter targets), (d) the per-tab Summary URL
(`/myresult/getResult{...}Summary`), and (e) the per-tab `settings_key`
(`ru_production_data`, `ru_scrap_data`, `ru_stop_data`, `r_warning_data`).

### 7.5  Date-range slider behaviour (`date_range_slider.blade.php`)

Self-contained jQuery widget exported as the global `DR_SLIDER`.

- Min visible date is `new Date(2017,0,1)` (`active_start_date`). Anything
  earlier shows the red "Out of range" bubble.
- Modes: `SLIDER_T_DAY (1)`, `SLIDER_T_WEEK (7)`, `SLIDER_T_MONTH (30)`,
  `SLIDER_T_YEAR (365)`. Resizing the central scrubber automatically zooms
  between modes; cell width clamps to `[40, 180]` px.
- Presets (`<select class="date-range-sl">`): All, Today, Yesterday, This/Previous
  Week, This/Previous Month, This/Previous Quarter, This/Previous Year, Custom.
- Two date pickers (`#from_selected_date`, `#to_selected_date`) using
  `datepicker.min.js`. The "from" picker is bounded by `[2017-01-01,
  toDate]` and `to - from ≤ 365 days`; the "to" picker is bounded by
  `[fromDate - 1 day, today]`.
- On any change calls `updateDashBoardDate()` → invokes the registered
  callback `loadDashboard(d_select, start_date_str, end_date_str)` which in
  the MyResult context is `initDateRange`'s wrapper → `table.ajax.reload()`
  with the new `start_date` / `end_date`.

### 7.6  Tab strip drag-sort (`#nav-tabs-sort`)

The master layout wires this with jQuery-UI Sortable; on stop it POSTs
the new order to `/saveTableSettings` with `data_type=tap_setting`,
`data_val=myresult`, `data=[…tabIndexes]`. Server merges via `saveSettings`.

### 7.7  Edit forms (`form_*.blade.php`)

Plain Bootstrap 3 horizontal forms inside the master layout, posted to the
`saveResult*` route. Stop and Scrap forms render the **reason picker** as
two coupled `<select>`s: changing `#stop_type_id` (or `#scrap_type_id`)
filters the `<option>`s in `#stop_reason` (or `#reason`) by the row's
`type_id`. The reason options are emitted as a `<?=json_encode($reasons)?>`
blob and filtered in JS — there is no AJAX involved.

When `work_shift_id = 0` and `$schedule_ar` is non-empty, the form swaps the
`work_shift_id` dropdown for a `work_shift_name` dropdown of shift titles
resolved by `getShiftScheduleTitleByTimeAll` (the original numeric id is set
to `0` via a hidden input).

The Warning edit form (`form_warning_log.blade.php`) is just equipment +
`from_time` + `to_time` + `notification_text`; duration is recomputed
server-side.

---

## 8. Filter / Group / Summary detail

| Control | DOM | Wire-up | Server impact |
|---|---|---|---|
| Date range slider | `#date_range_slider` | `DR_SLIDER` → `initDateRange()` wrapper → `table.ajax.reload()` | `start_date`, `end_date` |
| Date range preset | `<select.date-range-sl>` | `calculateAndSetRange(val)` → `setRangeDate()` → callback | same |
| "Show my entries only" | `<input type="checkbox">` after `dom: 'lBfrtip'` | Toggling sets `show_my_entries` and calls `saveSettings('ru_<tab>', 'show_my_entries', val)` then reloads | `created_by = me` |
| "Show also excluded types" (Stop only) | `#exclude_type_hld input` | `changeExcludeOptions()` reloads ajax with `exclude_type=1&save_exclude_option=1` | removes `types.exclude_type = 0` clause |
| Per-column text input | `tr.filter_hld td.filter_input_hld input` | `keyup` → `doFilterSearch()` (debounced) — collects `filterColumn[] / filterType[] / filterVal[]` per column and reloads | `WHERE col {op} val` driven by `getFilterTypeQuery()` |
| Operator pop-up | `.filter_column` → `.filter_search_hld` from `filter_dlg.blade.php` | Click swaps the icon + `data-filter-type` | sets `filterType[i]` |
| Group-By column | `th.group_by button` | Toggles a single active id `group_by`. After draw, `processCallback(api)` walks the page rows and inserts group headers + sub-totals client-side (`public/js/table-grouping.js`) | none — pure client aggregation |
| Drag column into "Drop group here" | `.filter_drop_area` | `table-grouping.js` jQuery-UI Droppable | none |
| Column visibility / resize | `visibleStr` injected into `#users-table_filter` | `initVisibleColumn(key,…)` saves toggles to `users.table_settings.{key}.columns` / `.widths` | none |
| Excel export | DataTables Buttons (`buttons` array) | `extend: 'excelHtml5', exportOptions: { columns: ':visible:not(.no-export)' }`, custom `newExportAction` | none |
| Summary dropdown | `.summary-hld` `<select>` | On `change`, GETs `getResult{Tab}Summary?type=N`, fills `.summary-row-item.{col}` cells | One of 7 hand-written SQLs |

---

## 9. State Machine of a Row's Visibility

```
Row in *_data
   │
   ├── deleted_at NOT NULL  ──► hidden (SoftDeletes scope)
   ├── date NOT IN [start_date, end_date] ──► hidden
   ├── (Stop only) types.exclude_type = 1 AND exclude_type checkbox unchecked ──► hidden
   ├── show_my_entries = 1 AND created_by ≠ auth.id ──► hidden
   ├── per-column filters fail ──► hidden
   └── otherwise ──► shown
         └── row.created_by = auth.id ? render edit/delete buttons : empty Actions cell
```

---

## 10. Re-implementation Checklist for a New Project

**Schema**
- [ ] `production_data`, `scrap_data`, `stop_data` with snake_case columns
      mirroring §4. Use the same `flow_object_key` naming for the
      equipment-id FK to remain compatible with existing GoJS flow JSON.
- [ ] `types` with `entity ENUM('Stop reason','Scrap reason', …)`,
      `type ENUM('Performance','Availability','Quality','Other','Not applicable')`,
      `exclude_type BOOLEAN DEFAULT FALSE`.
- [ ] `stop_reasons` / `scrap_reasons` linked to `types` via `type_id`.
- [ ] `tbl_warning_data` with `equip_id`, `notification_text`, `from_time`,
      `to_time`, `duration` (seconds, generated on save).
- [ ] Soft-delete (`deleted_at TIMESTAMPTZ NULL`) on all four entry tables.
- [ ] `users.table_settings JSONB` with at minimum the keys from §4.

**Routes (Express)**
- [ ] `GET /api/myresult` → tab dispatch helper or static (the Next.js shell
      can call `/api/me/settings/myresult-tabs` directly and skip a redirect).
- [ ] `GET /api/myresult/production?start_date=&end_date=&flow_id=&equip_id=&type_name=&prod_group=&filter[…]=&filterColumn[]=&filterType[]=&filterVal[]=&order[…]=&show_my_entries=&page=&perPage=`
      → `{ data, total, page, perPage }`.
- [ ] Same for `/scrap`, `/stop` (add `exclude_type`, `save_exclude_option`),
      `/warning`, `/unregistered`.
- [ ] `GET /api/myresult/{tab}/summary?type={1-7}` → aggregate JSON.
- [ ] `GET /api/myresult/{production|scrap|stop}/:id` → row for edit form
      (plus `parts`, `shifts`, `types`, `reasons`, optional `scheduleTitles`).
- [ ] `POST /api/myresult/{production|scrap|stop}` (multipart for stop/scrap
      picture) → upsert + recompute `sum_of_time`.
- [ ] `DELETE /api/myresult/{production|scrap|stop}/:id` → soft delete (use
      proper DELETE, not GET).
- [ ] `GET /api/myresult/warning/:id`, `POST /api/myresult/warning` (with
      `duration = to_time - from_time` recomputed server-side),
      `DELETE /api/myresult/warning/:id`.
- [ ] `POST /api/users/settings/table` with `{ key, subKey, data }` →
      merges into `users.table_settings`.

**Server logic**
- [ ] Reuse a single shared "list" service per tab that accepts a Zod-typed
      query DTO and returns `{ data, total, page, perPage }`.
- [ ] `parseFilterOperator(type)` re-implementing §6.4.
- [ ] `applyShowMyEntries(query, userId, date)` — skip when a specific
      `date` is supplied (matches §6.5 line 238).
- [ ] On Stop save: recompute `sum_of_time = (h*3600 + m*60 + s) * quantity`.
- [ ] On Warning save: recompute `duration` server-side.
- [ ] On Stop list: back-fill `sum_of_time` when null (§6.5).
- [ ] `excludeType` clause for Stop tab; persist toggle to
      `users.table_settings.exclude_type.stop`.
- [ ] Action column ↔ ownership: only emit `edit`/`delete` URLs when
      `row.created_by == auth.id`.
- [ ] Use a real query builder (Prisma / Knex) — no `Input::all()` or raw
      `\DB::select` injection (the legacy summary endpoints interpolate
      `$user_id` into a string — **fix on port**).

**Front-end (Next.js)**
- [ ] One `app/myresult/layout.tsx` shell with the date-range slider + sortable
      tab strip; child routes `app/myresult/{production,scrap,stop,warning,unregistered}/page.tsx`.
- [ ] Replace jQuery-UI Sortable on the tab strip with `@dnd-kit/sortable`
      (already installed).
- [ ] Replace the date-range slider widget with a React equivalent: a
      preset `<Select>`, the two `<DatePicker>`s and a custom horizontal
      scrubber (canvas/SVG). Don't try to lift the jQuery widget — it depends
      on `datepicker.min.js` and jQuery-UI Resizable/Draggable which we are
      not bringing.
- [ ] Use `@tanstack/react-table` (or AntD `<Table>` with server-side mode +
      a `useReactTable` companion) for the data grid. Keep the 8-operator
      column filter pop-up; expose Group-By via column meta.
- [ ] Excel export: client-side via `xlsx` (`writeFile`) — match
      `:visible:not(.no-export)`.
- [ ] Persist column show/hide/widths and `show_my_entries` to the new
      `/api/users/settings/table` endpoint.
- [ ] Edit forms with React Hook Form + Zod. Stop form: dependent reason
      `<Select>` filtered by `stop_type_id`. Production/Stop `HH:MM:SS`
      inputs validated by a regex matching the legacy `myTimeValidation`.
- [ ] Drill-down support: the page must honour `flow_id`, `flow_key`, `date`,
      `name`, `prod_group`, and a serialised `filter` query string (used by
      charts on the Dashboard module).

**Carry-forward gotchas** (§11)

---

## 11. Notable Gotchas

1. **Soft delete via GET**: the legacy delete endpoints are `Route::get()`s
   and there is no CSRF or DELETE method. On port, switch to `DELETE` and
   require an auth header. (Stop, Scrap, Production are affected.)
2. **`flow_object_key` actually holds the equipment id**, not a flow node
   key. The DataTables join `equipments.id = stop_data.flow_object_key`
   confirms this. Keep the column name if you want the GoJS flow definitions
   to remain compatible.
3. **Loss-model bucket translation**: `types.type` is rendered through
   `trans('custom.texts.'.$value)` only when it is one of `Performance`,
   `Availability`, `Quality`, `Other`, `Not applicable`. Free-text types
   pass through verbatim — your new translation table needs the same five
   keys.
4. **Swedish collation in `ORDER BY`**: text columns sort with
   `COLLATE utf8_swedish_ci` (and `latin1_swedish_ci` for the Stop
   `stop_reasons.name` column). Postgres equivalent is `COLLATE "sv-SE-x-icu"`
   on the columns or `ORDER BY col COLLATE "sv-SE-x-icu"` at query time. If
   you skip this, å/ä/ö will sort wrong.
5. **`sum_of_time` self-heal**: the Stop list endpoint *writes* to `stop_data`
   while serving a GET — back-filling `sum_of_time` for legacy rows where
   `hours`/`minutes`/`quantity` exist but `sum_of_time` is null. On port the
   right move is a one-time migration, not a write-on-read.
6. **`show_my_entries` short-circuit**: the Stop tab skips the
   `created_by = me` clause when a single `date` is supplied (line 238). The
   Scrap and Production tabs don't have this carve-out. Preserve or
   normalise — your call, but document either way.
7. **Warning tab visibility**: `getTapSettings()` removes the warning tab
   entirely when there are no warning rows with both `from_time` and
   `to_time`. The reverse isn't true on the client — the JS doesn't
   re-check after the page loads. Operators have to refresh to see the tab
   reappear.
8. **`getResultStopSummary` type 4** returns hours-as-decimal (`SUM(hours) +
   (SUM(minutes)/60)`) under the same key the row column uses for `HH:MM:SS`.
   The view writes the raw value into `.summary-row-item.time`. Either
   change the summary key (`total_hours`) or format it as `HH:MM` on render.
9. **SQL injection in summary endpoints**: the `$user_id` is interpolated
   into a raw SQL string. It's `Auth::id()` so it's not user-controlled, but
   the new build should still parameterise.
10. **Unregistered-stop tab leaks admin URLs** (line 718-730 of
    `DashboardController.php`): action URLs point at `admin/production/...`
    which the operator can't reach. Drop the column or wire it to the
    Units-module registration modal (the existing module already handles
    `is_registered = 'no'` rows).
11. **`work_shift_name` vs `work_shift_id`**: when the user picks from a
    *schedule title* dropdown (because `equipment_shift_schedule` exists),
    `work_shift_id` is saved as `0` and the human-readable label lives in
    `work_shift_name`. The list view selects `work_shift_name` directly —
    do NOT inner-join `work_shifts`, or rows with `work_shift_id = 0`
    disappear.
12. **Sortable tab strip writes to `tap_setting.myresult`**: ids `3` and `4`
    are *force-included* on read even if the user has saved a partial order.
    Mirror this so the warning + unregistered tabs are never permanently
    droppable.
13. **`signal_type != 'warning'` on Unregistered stops** filters out the
    warning-overlay machines mentioned in `unit.md` §11.8. Don't reuse the
    "exclude warning/off_counter/on_counter" rule from the Units module —
    this tab is narrower.
14. **DataTables column ordering bug** (Production, line 154 of
    `production_data_cont.blade.php`): two `<td>`s in the filter row both
    use `data-id="11"`. The list still works because filters are keyed by
    `name`, but the `data-id`-driven group-by drop target offsets are
    inconsistent. Fix on port.
