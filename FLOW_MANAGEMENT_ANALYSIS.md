# Flow Management — Migration Analysis

> **Status:** Step 0 read-and-document complete. **No code generated yet.** Awaiting operator approval AND a GoJS license decision before Step 1.
> **Source:** `/Applications/XAMPP/xamppfiles/htdocs/fpanalyzer` (Laravel 5.8 + jQuery + **GoJS v1.6.16 evaluation build**).
> **Target:** `/Applications/XAMPP/xamppfiles/htdocs/new_fp` (Next.js 14 + Express + Prisma).

---

## 0. GoJS license status — **UNRESOLVED, BLOCKS CANVAS**

| Check | Result |
|---|---|
| Legacy bundle | `fpanalyzer/public/js/go.js` (842,637 bytes ≈ 823 KB) |
| Version | **GoJS v1.6.16** (Northwoods Software, ~2017) |
| Header watermark | "GoJS … Northwoods Software" with LICENSE comment block; no embedded paid key |
| `Diagram.licenseKey = …` set anywhere in the legacy project | **No** (verified via `grep -rn` of `resources/`, `public/js/`, `app/`) |
| Separate `*license*.key` file | **No** (verified via `find`) |
| `gojs` in `new_fp/frontend/package.json` | **No — not installed** |
| `OPERATOR_QUESTIONS.md` Q2 | **Open / blocks Phase 4 frontend** |

**Conclusion:** the legacy app ships the **GoJS evaluation build**, which embeds a watermark and is **not legal for production use**. Per OPERATOR_QUESTIONS Q2, this is the documented blocker for the Flow Management surface. **Step 2 (canvas) cannot proceed until either a paid `NEXT_PUBLIC_GOJS_LICENSE_KEY` is supplied or the operator chooses an alternative renderer.**

Surfaces that CAN be built without GoJS (recommended even without the license decision):
- Flow Designs **list page** (CRUD on the row — name + status, no canvas)
- Flow Monitor **card grid** shell (cards with a placeholder where the GoJS thumbnail would go)
- Flow Analyzer **card grid** shell + the date filter + HighCharts panels (HighCharts already in `new_fp`, unrelated to GoJS)
- All backend endpoints (diagram save/load, attributes, background image upload, analyzer chart data)

Surfaces that REQUIRE the license:
- The actual **GoJS canvas** in the Flow Designer
- The **live GoJS thumbnails** rendered on each Monitor/Analyzer card
- The **live status overlay** on Flow Monitor (badges on each equipment node)

If the operator wants to ship without GoJS, the alternatives noted in OPERATOR_QUESTIONS Q2 stand: `@xyflow/react` (MIT, very different API, would need a port from scratch), `mxgraph` (Apache 2.0), or a hand-rolled SVG renderer.

---

## 1. Page 1: Flow Designer (admin)

### Legacy URLs
| Method | URI | Controller |
|---|---|---|
| GET | `/admin/flow/add` | `DashboardController@test_flow` (renders empty designer) |
| GET | `/admin/flow/edit_flow/{id?}` | `DashboardController@editFlowTest` (renders designer with `$data->flow_data`) |
| GET | `/admin/flow/add_flow_test` (AJAX) | `DashboardController@addFlowDesignTest` (create + save JSON) |
| GET | `/admin/flow/update_flow` (AJAX) | `DashboardController@editFlowDesignTest` (update OR Save As) |
| POST | `/admin/flow/editFlowName` | `DashboardController@editFlowName` |
| POST | `/admin/flow/changeFlowDesignStatus` | `DashboardController@changeFlowDesignStatus` |
| POST | `/admin/flow/deleteFlowDesign` | `DashboardController@deleteFlowDesign` (soft delete + cascade scrap/production/stop data) |
| POST | `/admin/flow/uploadBgFlow` | `DashboardController@uploadBgFlow` (multipart, returns `/images/user/<userId>/<filename>`) |
| POST | `/admin/flow/removeBgFlow` | `DashboardController@removeBgFlow` |

### Controller details

**`test_flow()` (`:3028–3043`) and `editFlowTest($id)` (`:3240–3259`)**
Render `backend.flow_control.add_flow` / `edit_flow` with:
- `$categories` — root equipment (`Equipments::where('parent_id', 0)->get()`). Used to render the left-side equipment tree.
- `$machines` — joins `machines` + `machine_files` for the file-tree panel.
- `$flows` — `FlowDesigns::get()` (for the Open/Load dropdown).
- `$data` — the FlowDesign row being edited (provides `flow_data` JSON).
- `$user` — for `bg_flow` (the user's last-used background image path).
- `$equipment_tree_pos` — CSV of expanded node ids from the equipment-tree feature (same as the structure page).

**`addFlowDesignTest()` (`:3096–3136`) — Create**
Reads `$_REQUEST['arr']` (the GoJS `model.toJson()` string) and `$_REQUEST['name']`. Validates `name` is unique. If the diagram JSON has a `nodeDataArray[0].img_path` that lives in `public/images/user/<uid>/…`, **moves the file** to `public/images/bg_flow/` and rewrites the JSON to point at the new path. Stores the *entire diagram JSON* in `flow_designs.flow_data` (single column).

**`editFlowDesignTest()` (`:3138–3189`) — Update + Save As**
Same idea. `$_REQUEST['type'] > 0` ⇒ Save As (creates a NEW row with `flow_name_as`). `type === 0` ⇒ Update existing row. Same bg-image-move logic. **Does NOT touch `flow_design_attributes` from this path** — the in-document GoJS data is the authoritative source.

**`editFlowName()` / `changeFlowDesignStatus()` / `deleteFlowDesign()`** — straight one-row updates / soft delete.

**`uploadBgFlow()` (`:5607–5630`)** — multipart, field `bg_flow_file`. Stores to `public/images/user/<userId>/<timestamp>_<rand>.<ext>`. Returns `{ success, reason, url }`.

**`removeBgFlow()` (`:5907–5936`)** — receives `path` + `flow_id`. Decodes `flow_data` JSON, clears `nodeDataArray[0].img_path`, re-encodes, saves. Then `unlink`s the file on disk.

### Blade structure (`backend/flow_control/edit_flow.blade.php`, 722 lines)

Header toolbar (lines 22-38):
- Save → `save('0')`
- Save As → opens modal → `save('1')` writes a new flow
- Open ("folder" icon) → dropdown listing all `$flows` to load into the canvas
- **Background image** (`#backgroundImage`, fa-image icon) → opens `flow_file_upload.blade.php` modal

Layout:
- Left panel — equipment tree (collapsible). The tree is rendered with the same `treed()` jQuery plugin used by `/admin/equipment/tree`; nodes are jQuery-UI-draggable into the canvas.
- Right panel — `<div id="myDiagramDiv">` (the GoJS canvas).

### GoJS initialization (the meat of the blade)
- Loaded from `public/js/go.js` (v1.6.16 eval build).
- `var $ = go.GraphObject.make` (line 237).
- Diagram options (line 240):
  - `allowDrop: true` (external DnD from the equipment tree)
  - `linkingTool.isUnconnectedLinkValid: false`
  - `relinkingTool.fromHandleArchetype` / `toHandleArchetype` (red Diamond endpoints)
  - `undoManager.isEnabled: true`
  - GridLayout (`makeLayout: false` — manual placement)
- **Node templates** (`templmap`, line ~280–413): a map keyed by `category`. Categories used in the saved JSON: `start`, `activity`, `buffer`, `end`, `connector`, `background`. Each template defines the shape (Circle / Rectangle / Diamond / LineH), fill colour, four `makePort` directional ports (T/L/R/B for link-from / link-to), an editable `TextBlock`, etc.
- **`background` template** (line 402): a `go.Picture` bound to `img_path`, scaled with `imageStretch: Fill`, opacity 0.5.
- **`linkTemplate`** (line 430): orthogonal routing, "Standard" arrowhead, selectable, no editable label.
- **Palette** (line 469): a separate `go.Palette` instance sharing `nodeTemplateMap` with the diagram.

### Save flow
```js
// save(type)
saveDiagramProperties();                            // stash position into model.modelData
document.getElementById('mySavedModel').value = myDiagram.model.toJson();
save_flow(value, type);                             // → AJAX POST to addFlowDesignTest or editFlowDesignTest
```
The POST sends `arr=<json>&name=<id-or-name>&type=<0|1>&flow_name_as=<saveAsName>`.

### Load flow
```js
myDiagram.model = go.Model.fromJson(JSON.stringify(data));
// Ensures a bg_img node exists at nodeDataArray[0] even when none was saved.
```

### Equipment tree → canvas drag
Lines 188–230: `$('#myDiagramDiv').droppable({ … })` accepts jQuery-UI draggables from the equipment tree. On drop:
1. Compute drop position via `myDiagram.transformViewToDoc`.
2. Read the dragged element's `data-id` (equipment id) and `data-name` (equipment label).
3. **Reject duplicates** — if an existing node in `model.nodeDataArray` already has this equipment id as its `key`, show `showErrorMsg('duplicate_equipment')` and abort (line 212).
4. Otherwise `model.addNodeData({ key: <equipmentId>, text: <equipmentName>, category: 'activity', loc: '<x> <y>' })`.

So the **node `key` for an equipment-bound node IS the equipment id** — that's the link the analyzer + monitor use to overlay live data on the diagram. Free-form palette nodes (Start/End/etc.) get GoJS's auto-assigned keys.

### Data model

**`flow_designs` table** (Prisma: `tenant_template.flow_designs`):
| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| name | varchar(250) | unique on create (checked in controller, not enforced by DB) |
| **flow_data** | TEXT | The entire GoJS `model.toJson()` blob — `{ nodeDataArray: […], linkDataArray: […], modelData: { position: 'x y' } }` |
| status | smallint default 1 | 1 active, 0 inactive |
| legacy_id | bigint UNIQUE nullable | legacy import marker |
| created_at / updated_at / deleted_at | timestamptz | soft-delete |

Confirmed against `new_fp/backend/prisma/schema.prisma` — the schema is already correct.

**`flow_design_attributes` table** (Prisma: `tenant_template.flow_design_attributes`):
| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| flow_design_id | int | FK → flow_designs |
| relation_id | int | polymorphic; points at Equipment / Folder / MachineDocument / Symbol depending on `kind` |
| type | enum `FlowDesignAttributeKind` | mapped to `kind` in Prisma |
| left, right | int | legacy x/y position columns from the v0 (non-GoJS) data model |
| legacy_id / created_at / updated_at | … | |

**Important observation about `flow_design_attributes`:**
The current Designer code path (`addFlowDesignTest` / `editFlowDesignTest`) does **NOT write to this table** — the diagram lives entirely in `flow_data` JSON. The *older* `addFlowDesignAjax` / `editFlowDesignAjax` paths (commented out in routes) DID write per-node rows here. Per the controllers this is a **legacy v0 table that's effectively dead** for the GoJS-era data. We should keep the schema (data is preserved) but treat `flow_data` JSON as the source of truth and NOT write new rows to attributes from the Designer. The Analyzer/Monitor reads equipment ids out of `flow_data.nodeDataArray[].key`, not from this table (confirmed by `getFlowAnalyzer` at `:1692+`).

---

## 2. Page 2: Flow Monitor (frontend/user)

### Legacy URLs
| Method | URI | Controller |
|---|---|---|
| GET | `/monitor/{id?}` | `CompanyUserController@getFlowMonitor` (note: route name `Monitor` is **mis-mapped** to `getFlowMonitor` even though the routes file declares it; live legacy code shows `flowMonitor`). Renders the monitor page. |
| GET | `/getFlowMonitorList` | `CompanyUserController@getFlowMonitorList` — JSON list of flows for the card grid |
| GET | `/getFlowMonitorListImg` | `CompanyUserController@getFlowMonitorListImg` — same list with the GoJS-rendered SVG inlined per row |
| GET | `/changeFlowMonitorListView` | persists user's grid/list preference (`users.flow_monitor_view`) |
| GET | `/flow/get_loss_monitor` | `CompanyUserController@getLossMonitor` — live loss panel data when a flow is opened |
| GET | `/lossmonitor/form_production` / `…/form_scrap` / `…/form_stop` | sub-forms for the "register loss" modal |

Admin shell wrapper: `/admin/flow/flow_monitor/{id?}` → `DashboardController@flowMonitor` (`:3298–3339`). Logic differs slightly — sorts flows by most-recent production_data activity first, then everything else. Otherwise the same blade.

### Card grid rendering

`backend/includes/flow_monitor/flow_image.blade.php` (the partial that powers each card thumbnail) creates a **fresh `go.Diagram` per card** in a hidden `myDiagramDiv_<i>` div, loads the JSON via `go.Model.fromJson`, **calls `myDiagram2.makeSvg(...)` to render it to a static SVG**, and replaces the div content with that SVG. SVG width is responsive (200–450px depending on `window.innerWidth`).

So the card thumbnail is **a server-loaded GoJS diagram rendered to inline SVG on the client at page load** — not a server-side image, not a live interactive canvas. That's a key constraint: **the Monitor card grid still requires GoJS at runtime to render the thumbnails**.

Without a license we can either:
- Render an SVG placeholder rectangle with the flow name (works, but loses parity with the legacy UX), OR
- Server-side-render the diagram to SVG with a Node-side GoJS install (still needs a license at SVG-generation time)

### Grid vs list toggle
Top-right `AppstoreOutlined` / `BarsOutlined`. State persisted via `/changeFlowMonitorListView`.

### Click a flow card
Opens the same page with `?id=<flowId>` — the right panel switches to the full-size GoJS canvas (`isReadOnly: true`) with the live loss-monitor sidebar visible.

### Live status overlay (the core value)
On the full-size monitor view, each equipment-bound node gets a **status badge** overlay. The data comes from a polling AJAX call to `getLossMonitor` (every ~10s in legacy) which returns the latest StopData / ProductionData / ScrapData grouped by `flow_object_key` (which is the GoJS node key, i.e. the equipment id). The blade then walks `myDiagram.model.nodeDataArray` and `setDataProperty(node, 'lossInfo', …)` so the node template re-renders with the colour/icon.

This is non-trivial to port and **also requires GoJS** because the badge is part of the node template.

---

## 3. Page 3: Flow Analyzer

### Legacy URLs (frontend + admin twin)
| Method | URI | Controller |
|---|---|---|
| GET | `/analyzer/{id?}` | `CompanyUserController@flowAnalyzer` (`:1554+`) |
| GET | `/flow/get_flow_analyzer` | `CompanyUserController@getFlowAnalyzer` → delegates to `getFlowData($req)` (`:1692+`) |
| GET | `/flow/get_lc` | `CompanyUserController@getLineChart` (`:1987+`) — line chart data |
| GET | `/flow/get_quant_time` | `CompanyUserController@getQuantTimeGraph` (`:2090+`) — quantity-over-time graph |
| GET | `/getFlowAnalyzerList` | `CompanyUserController@getFlowAnalyzerList` — JSON card grid |
| GET | `/changeFlowAnalyzerListView` | persists user's grid/list preference |
| Admin twin | `/admin/flow/flow_analyzer/{id?}` etc. | `DashboardController` equivalents |

### Card grid
Same `flow_image` partial as Monitor (GoJS → SVG thumbnails). The grid is the same; the difference is what happens when you click a card.

### Click a flow card
Opens the analyzer detail view:
- Left: the read-only GoJS canvas of the flow (same SVG approach as Monitor thumbnails, but bigger; nodes are clickable to filter the right panel).
- Right: stop-reason / scrap-reason / production analytics. Tables of "recent stops" by reason; HighCharts line + quantity-time charts.
- Top: date-range strip (Today / This Week / This Month / Custom) + filter chips.

### Charts
HighCharts (already in `new_fp` package.json — `highcharts-react-official` per earlier audit). The data endpoints are vanilla SQL aggregations over `production_data`, `scrap_data`, `stop_data` joined to `equipment_id` filters derived from `flow_data.nodeDataArray[].key`. Complex but not GoJS-blocked.

### Difference from Monitor (in one line)
**Monitor = live IoT status overlay on the diagram. Analyzer = historical OEE data charts beside the diagram.** Both use the same card grid + GoJS thumbnails.

---

## 4. Current new_fp state

### Backend
- `backend/src/routes/admin-flow-designs.routes.js` — basic CRUD (GET list, GET one, POST, PATCH, PATCH /:id/status, DELETE). **Missing: diagram save/load endpoints, attributes endpoint, background image upload/remove, monitor list w/ flow_data, analyzer list+chart endpoints.**
- `backend/src/services/admin-flow-designs.service.js` — list/findOne/create/update/patchStatus/softDelete only.
- Prisma schema for `FlowDesign` and `FlowDesignAttribute` is already correct (verified — `flow_data` column exists as `String?`).

### Frontend
- `/admin/flow-designs/page.tsx` — list page with basic CRUD (no canvas, no thumbnail).
- `(user)/monitor/[[...id]]/page.tsx` — exists; needs verification of card-grid completeness.
- `(user)/analyzer/page.tsx` — placeholder.
- **`gojs` and `gojs-react` not installed.**
- No Designer page exists yet (`/admin/flow-designs/[id]/edit` is missing).

---

## 5. Implementation plan

### A. License unresolved (default, until operator answers Q2)
1. Build the **backend** endpoints in full (diagram save/load, attributes, bg image, analyzer chart data). These are honest data plumbing; no GoJS at the server.
2. Build the **list page** (Flow Designs) fully.
3. Build **card-grid shells** on Monitor + Analyzer with a placeholder rectangle per card (flow name + "Open in Designer" link, no thumbnail).
4. Build the **Analyzer detail page** with the date-range strip, the recent-stops table, and the HighCharts panels (HighCharts is unblocked).
5. Render a `<GoJsLicensePlaceholder />` component on:
   - `/admin/flow-designs/[id]/edit` (the Designer canvas surface)
   - Each Monitor / Analyzer card thumbnail slot
   - The Monitor live-status panel
   The placeholder shows an `ApartmentOutlined` icon + "Flow Designer requires a GoJS license — see OPERATOR_QUESTIONS.md Q2" + the env-var name `NEXT_PUBLIC_GOJS_LICENSE_KEY`.

### B. License confirmed (paid v3 key available)
Same as A, plus:
1. `npm install gojs gojs-react` in `frontend/`.
2. Add `NEXT_PUBLIC_GOJS_LICENSE_KEY` to `.env.example` + `.env.local`.
3. Set `go.Diagram.licenseKey = process.env.NEXT_PUBLIC_GOJS_LICENSE_KEY` in a top-level `lib/gojs-init.ts` imported by every GoJS-using component.
4. Build `<FlowDesignerCanvas />` using `gojs-react`'s `ReactDiagram`. Port the legacy node templates (start / activity / buffer / end / connector / background) verbatim. Port the link template. Port the equipment-tree drop handler.
5. Build `<FlowCardThumbnail />` that mounts a hidden `go.Diagram`, calls `.makeSvg()`, and renders the resulting SVG inline (matching the legacy approach).
6. Build the **live status overlay** for Monitor: poll `/admin/flow-designs/:id/monitor-status` every 10s with `ETag`/`If-None-Match`; on a non-304 response, walk `model.nodeDataArray` and `setDataProperty(node, 'status', …)`.

### C. Alternative renderer
Out of scope for this analysis. If selected, the analysis would need to be redone for `@xyflow/react` or similar — the data model (single JSON column) still works, but the templates and runtime tooling are a from-scratch port.

---

## 6. Backend endpoints needed (Step 1)

```
GET    /api/v1/admin/flow-designs                      (exists) — list paginated
GET    /api/v1/admin/flow-designs/:id                  (exists)
POST   /api/v1/admin/flow-designs                      (exists) — create empty
PATCH  /api/v1/admin/flow-designs/:id                  (exists) — rename
PATCH  /api/v1/admin/flow-designs/:id/status           (exists)
DELETE /api/v1/admin/flow-designs/:id                  (exists)

NEW:
GET    /api/v1/admin/flow-designs/:id/diagram          → { flowData: <json string> }
PUT    /api/v1/admin/flow-designs/:id/diagram          ← { flowData: <json string>, asNewName?: string }
                                                        ← when asNewName is set, creates a new row (Save As)
POST   /api/v1/admin/flow-designs/:id/background       multipart `image` → { url }
DELETE /api/v1/admin/flow-designs/:id/background       clears the bg_img path in flow_data + deletes file

GET    /api/v1/admin/flow-designs/:id/attributes       → [{ relationId, kind, posLeft, posRight }]
PUT    /api/v1/admin/flow-designs/:id/attributes       ← [{ relationId, kind, posLeft, posRight }]
                                                        (kept for legacy compatibility — not written by Designer)

GET    /api/v1/admin/flow-designs/list-with-thumbnails → list view used by Monitor + Analyzer card grids
                                                        Returns name, id, status, flow_data (for the SVG render)

GET    /api/v1/admin/flow-designs/:id/monitor-status   → ETag-cached live loss data per equipment node
GET    /api/v1/admin/flow-designs/:id/analyzer-data    → stop/scrap/production aggregations (paramaterised
                                                          by start_date/end_date/flow_key/equip_name/etc.)
GET    /api/v1/admin/flow-designs/:id/line-chart       → HighCharts series data
GET    /api/v1/admin/flow-designs/:id/quant-time       → quantity-over-time graph series
```

The legacy "files-in-public/images" pattern for the background image is replaced with the existing `FileStorageService` (the same storage layer Phase D1 used for machine files). Path inside tenant storage: `tenant-<id>/flow-backgrounds/<flowId>.<ext>`. Public URL returned to the client.

Permission: every flow-designs route is gated by `manage-flow-designs` (already in the seed for Company role per `prisma/seed.js`).

---

## 7. Open questions

1. **GoJS license — paid v3 key, alternative, or proceed with stub-only?** This is the BLOCKER. The four-way answer matrix:
   - (a) Paid v3 key exists → proceed with B above. Provide the key value to set as `NEXT_PUBLIC_GOJS_LICENSE_KEY`.
   - (b) Buy a Single-Developer paid key now → confirm and provide the key when ready.
   - (c) Switch to `@xyflow/react` or similar → analysis must be redone; this prompt is paused.
   - (d) Ship without diagrams in v1 → I build Plan A (placeholders) only.

2. **Save As semantics in the Designer.** Legacy `editFlowDesignTest` with `type > 0` creates a new flow. Should the new_fp endpoint be `PUT /:id/diagram { asNewName }` (one endpoint, branches internally) or `POST /save-as { fromId, asNewName, flowData }` (separate)? I lean **single endpoint with `asNewName` optional** — matches legacy behaviour, fewer routes.

3. **flow_design_attributes table.** Legacy doesn't write to it from the GoJS-era Designer; it's stale. Should I:
   - (a) Keep the schema, expose read-only `GET attributes` for any legacy importers, never write from the Designer (**recommended**)
   - (b) Drop the table now (a migration; not worth the risk during a port)
   - (c) Repopulate it on every save by extracting equipment ids from `flow_data.nodeDataArray` (extra writes, no consumer)

4. **Card thumbnails.** Once a GoJS license is in place, the legacy approach (mount a hidden diagram per card, `.makeSvg()`, replace) is fine for ~20 cards. For tenants with hundreds of flows, do you want to:
   - Server-side-render the SVG once per save and cache it in `flow_designs.svg_cache` (one extra column, fast page loads)
   - Or stick with the legacy client-side render (acceptable for now)
   Recommend: **client-side render for v1, revisit if performance is a problem.**

5. **Monitor live-status polling cadence.** Phase 0 v2 §16 says 10s with `If-None-Match`. Confirm 10s is still right — should it be 5s for IoT-driven operator screens?

6. **Permissions.** Both `Company` and `User` roles in legacy can view Monitor (operator screen) but only `Admin`/`Company` can edit flows. Should new_fp gate `/admin/flow-designs/[id]/edit` behind `manage-flow-designs` (matches list page) while Monitor + Analyzer are accessible to any logged-in tenant user with `view-flow-designs`?

---

## 8. Stop points (carried forward)

- **STOP HERE** — operator must resolve Q2 (license) and confirm §7 questions 2–6 before Step 1.
- After Step 1 (backend) — show endpoints + 65/65 test green.
- After Step 2 (frontend, with chosen license path) — manual browser checklist.
- After Step 3 (Playwright) — final review.

**Decision needed: which of Plan A / Plan B / Plan C in §5 should I execute?**

---

## 9. Approved decisions (locked in)

| # | Topic | Decision |
|---|-------|----------|
| 1 | License path | **PLAN A** — proceed with placeholders. Do not install GoJS. Build all backend endpoints + list page + Monitor/Analyzer card-grid shells with `<GoJsLicensePlaceholder />` in every canvas/thumbnail slot. Plan B drops in cleanly by adding `NEXT_PUBLIC_GOJS_LICENSE_KEY` + GoJS components later. |
| 2 | Save As contract | Single endpoint `PUT /api/v1/admin/flow-designs/:id/diagram` with optional `asNewName`. When `asNewName` is set, create a new row; otherwise update the existing one. Always return `{ id, name }` so the client can redirect after Save As. |
| 3 | `flow_design_attributes` | Keep the table + schema. Expose **read-only** `GET /:id/attributes` for legacy data consumers / Phase 6 migration. Never written from the GoJS-era Designer. Documented as stale v0 artifact in §6. |
| 4 | Card thumbnail caching | **Client-side render for v1** (mount hidden diagram → `.makeSvg()` → inline SVG, matching legacy). No `svg_cache` column. Revisit if a tenant has 100+ flows. |
| 5 | Monitor polling cadence | **10s** with `If-None-Match` (Phase 0 v2 §16 decision stands). Configurable via `POLL_INTERVAL_FLOW_MONITOR_MS` env var when Plan B's polling client is built. |
| 6 | Permissions split | `manage-flow-designs` for `/admin/flow-designs/[id]/edit`. `view-flow-monitor` for `/monitor/*`. `view-flow-analyzer` for `/analyzer/*`. All three permission names are already in the Phase B3 seed — no new permissions needed. |

### Step 1 backend scope (locked)

```
GET    /api/v1/admin/flow-designs                            (exists)
GET    /api/v1/admin/flow-designs/:id                        (exists)
POST   /api/v1/admin/flow-designs                            (exists)
PATCH  /api/v1/admin/flow-designs/:id                        (exists)
PATCH  /api/v1/admin/flow-designs/:id/status                 (exists)
DELETE /api/v1/admin/flow-designs/:id                        (exists)

NEW:
GET    /api/v1/admin/flow-designs/list-with-data             non-paginated, status=1, name ASC
GET    /api/v1/admin/flow-designs/:id/diagram                → { flowData }
PUT    /api/v1/admin/flow-designs/:id/diagram                ← { flowData, asNewName? } → { id, name }
POST   /api/v1/admin/flow-designs/:id/background             multipart `image`, 8MB cap → { url }
DELETE /api/v1/admin/flow-designs/:id/background             ← { url } → 204
GET    /api/v1/admin/flow-designs/:id/attributes             read-only
GET    /api/v1/admin/flow-designs/:id/monitor-status         ETag-cached
GET    /api/v1/admin/flow-designs/:id/analyzer-data          ?startDate&endDate&flowKey&equipName
GET    /api/v1/admin/flow-designs/:id/line-chart             ?startDate&endDate&type&name&prodGroup&filter…
GET    /api/v1/admin/flow-designs/:id/quant-time             ?startDate&endDate&flowKey
```

Permission gate: every flow-designs route runs through `requirePermission('manage-flow-designs')` (`view-flow-monitor` / `view-flow-analyzer` will gate the user-shell consumers in Step 2, but the underlying admin endpoints stay behind manage).

Background image storage path: `flow-bg/<flowId>/<filename>` via `FileStorageService.put()`. Returned URL is the public path the GoJS bg-node will reference via `nodeDataArray[0].img_path`. Client is responsible for re-saving the diagram with the new path — the upload endpoint does NOT mutate `flow_data` (matches the legacy two-step flow but cleaner: legacy moved files between dirs, new_fp uses content-hashed names so paths are stable).

### Legacy code references (for the chart endpoints)

- `getLossMonitor` is mostly a Laravel-view-rendering "register loss" shift form (`CompanyUserController.php:502-592`). The actual live-status data comes from `getMachineStatus` (line ~2178), which returns `[{ id, running_status, unit_connected, updated_at, signal_type, start_time, machine_data_id, is_registered }]` per machine_id. **`/monitor-status` follows that contract** but is keyed by equipment id (parsed from `flow_data.nodeDataArray[].key`, numeric only) and joins to MachineStatus / MachineData for the latest reading.
- `getLineChart` (`CompanyUserController.php:1987-2087`) branches on `type` ∈ `scrap` | `production` | `stop`. Translated below.
- `getQuantTimeGraph` (`CompanyUserController.php:2090-2148`) returns `{ stop_count, stop_data }` with stop-reason aggregations.
- `getFlowAnalyzer → getFlowData` (`CompanyUserController.php:1692-…`) returns per-equipment stop/scrap/production aggregations. Translated below as `/analyzer-data`.

---

## 11. draw.io replacement plan (Plan B — supersedes the GoJS path)

> **Status:** Q2 RESOLVED — draw.io adopted (Apache 2.0). GoJS plan retired.
> **Source code being adopted:** the operator's ValueChart project — already pasted into `new_fp/frontend/public/draw_io/` (178 MB vendored draw.io v29.3.6 webapp) and `new_fp/frontend/src/components/flows/` (7 React integration files, ~116 KB).
> **Awaiting operator approval of §11 before any code is written.** §11-S1 (schema patch) begins after approval.

### 11.1 What's pasted in

| Path | Size | Source | Status |
|---|---|---|---|
| `frontend/public/draw_io/` | 178 MB | ValueChart vendored draw.io v29.3.6 — full webapp (index.html, mxgraph/, shapes/, plugins/, js/, etc.) | Keep as-is. Next.js serves it from `/draw_io/index.html`. |
| `frontend/src/components/flows/EditorView.tsx` | 1924 lines | ValueChart main editor wrapper | Port to `components/flow/FlowDesignerEditor.tsx`. |
| `frontend/src/components/flows/CustomShapesPanel.tsx` | 405 lines | Custom shape palette sidebar | Defer to v1.1 — Designer can ship without it. |
| `frontend/src/components/flows/FlowCard.tsx` | 237 lines | Card-grid card with favorite/share/lock | We already have `components/flow/FlowCard.tsx` (Plan A). Take only the thumbnail/SVG rendering bits; keep our card. |
| `frontend/src/components/flows/FlowPickerModal.tsx` | 313 lines | "Open a flow" modal | **Skip** — our card grid is the picker. |
| `frontend/src/components/flows/ShareFlowModal.tsx` | 326 lines | Team-sharing modal | **Strip** — no team sharing concept in new_fp. |
| `frontend/src/components/flows/AssignProjectModal.tsx` | 184 lines | Assign-to-project modal | **Strip** — no project concept in new_fp. |
| `frontend/src/components/flows/FlowPackBanner.tsx` | 197 lines | Template-pack promo banner | **Strip** — ValueChart-only feature. |

After porting, **`components/flows/` (plural) gets deleted**. The new `components/flow/` (singular, our Plan A folder) keeps `FlowCard`, `FlowCardGrid`, `FlowAnalyzerCharts`, and the placeholder gets replaced by `FlowDesignerEditor`.

### 11.2 ValueChart imports → new_fp mapping

| ValueChart import | What it exports | new_fp replacement |
|---|---|---|
| `@/lib/flow` → `getFlowById(flowId)` returns `{ name, permission, xml, diagramData, … }` | Initial-load fetch for the editor | `useFlowDesign(scope, id)` from `lib/api/flow-designs.ts` (Plan A built it) → returns `{ id, name, flowData }`. `flowData` IS the XML string (we agreed to overload the existing column). Skip `permission` — new_fp gates at the page level via `manage-flow-designs`. |
| `@/components/templates/TemplateBrowser` | Modal that shows shape pack templates | **Strip.** The `init` handler in EditorView opens this when the diagram is empty. We replace that with no-op (just leave the blank canvas). Template chooser is a future enhancement. |
| `@/components/ai/AiCreditsDisplay` | AI feature widget showing remaining credits | **Strip.** Whole AI integration removed. |
| `@/api/notifications.api` → `flowPackApi` | Used only by `FlowPickerModal` | **Strip** (file dropped). |
| `@/lib/axios` → `api` | Axios instance used by `CustomShapesPanel` | If we port the shapes panel later, use new_fp's `apiClient` from `lib/api-client.ts`. |
| `sessionStorage.getItem('ai_generated_xml')` / `ai_generated_name` | AI handoff between Generator page and Editor | **Strip.** No AI flow in new_fp. |

### 11.3 ValueChart API endpoints → new_fp endpoints

| ValueChart call | Body / params | new_fp endpoint | Notes |
|---|---|---|---|
| `getFlowById(flowId)` (`GET /api/flows/:id`) | none | `GET /api/v1/admin/flow-designs/:id/diagram` (built in Plan A Step 1) | Response: `{ id, name, flowData }`. `flowData` = XML string OR null (blank). |
| `POST /api/save-diagram` | `{ flowId, name, xml, thumbnail }` | `PUT /api/v1/admin/flow-designs/:id/diagram` (built) | new_fp body shape: `{ flowData, asNewName? }`. Existing endpoint accepts ANY string — drawio XML fits. **NEW WORK (§11-S2):** extend the endpoint to also accept a `svgCache` field for the thumbnail. |
| `GET /api/flows/:id/versions` | none | **DEFER** — no version history endpoint exists yet in new_fp | Skip the version-history UI in the port. Add as a follow-up if needed. |
| `POST /api/flows/:id/versions/restore/:vId` | none | **DEFER** | Same as above. |
| `DELETE /api/flows/:id` | none | `DELETE /api/v1/admin/flow-designs/:id` (built) | Already wired. |
| `api.get('/shapes')` | none | **DEFER** — custom shape library is its own subsystem | Drop the `CustomShapesPanel` from v1. drawio ships hundreds of stock shapes already. |
| `api.get('/shape-groups')` | none | **DEFER** | Same. |

### 11.4 postMessage protocol — full event shape

Parent React component ↔ drawio iframe communicate via `window.postMessage(JSON.stringify(...))`.

**Incoming events (iframe → parent), handled in `EditorView.tsx:409+`:**

| `msg.event` | Fired when | Payload | Parent response |
|---|---|---|---|
| `init` | drawio iframe finished mounting and is ready for content | `{ event: 'init' }` | Parent fetches `{ name, flowData }` from `GET /:id/diagram`, then posts `action: 'load'` back with the XML + `autosave: 1`. Empty diagrams default to `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>`. |
| `save` | User clicked Save button inside drawio | `{ event: 'save', xml: string }` | Parent triggers internal "export SVG" then calls `PUT /:id/diagram { flowData: xml, svgCache: svg }`; then posts `action: 'status'` with empty message + `modified: false` to clear drawio's dirty indicator. |
| `autosave` | drawio's internal autosave timer fired | `{ event: 'autosave', xml: string }` | Same as `save` — silent persist. Debounced by drawio. |
| `export` | Response to a parent-initiated export request (PNG/SVG/.drawio download or internal thumbnail capture) | `{ event: 'export', format: 'png'\|'svg'\|'xml', data: <base64 or string>, xml?: string }` | Parent either downloads it (user-clicked Export) OR sends the SVG to the server as `svgCache` (internal thumbnail capture, §11-S6). |
| `showSaveDialog` | User triggered "Save As" inside drawio | `{ event: 'showSaveDialog', xml: string, currentName: string }` | Parent opens an AntD modal asking for the new name → `PUT /:id/diagram { flowData, asNewName }`. **Save As already supported in Plan A backend.** |
| `showShareDialog` | User clicked Share | — | **Strip.** new_fp has no sharing. Either swallow silently or hide the Share button via the existing AI-hiding CSS. |
| `showImportDialog` | User triggered Import | — | Open an AntD file-picker → read file → post `action: 'load'` with the file contents. |
| `exit` | User clicked the (hidden) Exit button | — | Navigate back to `/admin/flow-designs`. |

**Outgoing events (parent → iframe), via `iframeRef.current.contentWindow.postMessage(JSON.stringify({...}))`:**

| `action` | Purpose | Payload |
|---|---|---|
| `load` | Initial-load + autosave setup. Sent in response to `init`. | `{ action: 'load', xml: string, autosave: 1, titles?: string[], allEntries?: [{ title, xml, aspect }] }` — `titles`/`allEntries` are optional custom shape categories. |
| `status` | Update drawio's chrome status line (e.g. "Saved", "Saving…") | `{ action: 'status', message: string, modified: boolean }` |
| `export` | Ask drawio to export the current diagram (response comes back as `export` event) | `{ action: 'export', format: 'png'\|'svg'\|'xml', xml?: boolean, ... }` |
| `mergeAiXml` | (ValueChart-only — STRIP) | — |
| `print` | Trigger drawio's print dialog | `{ action: 'print' }` |
| `insertNode` (**NEW custom action — see §11.4.5**) | Add an equipment-bound node at a canvas position | `{ action: 'insertNode', label: string, equipmentId: number, x: number, y: number, style?: string }` |
| `paintStatus` (**NEW custom action — see §11.6**) | Repaint cells with `equipment-id` attributes using current Machine status | `{ action: 'paintStatus', statuses: [{ equipmentId, status, lastOnline }, ...] }` |

#### 11.4.5 Custom equipment-drop event

The legacy fpanalyzer Designer lets users drag equipment from the left tree onto the canvas; each dropped node carries the equipment id. drawio doesn't natively understand this. Two viable patterns:

1. **HTML5 drag-drop on the iframe wrapper div** (recommended). The equipment tree's grip element is `draggable`; on `drop`, the wrapper's handler intercepts (drawio's iframe doesn't receive HTML5 drag events from outside its own document). We then post `insertNode`. drawio's webapp doesn't ship this handler natively — we add a tiny custom plugin in `frontend/public/draw_io/js/diagramly/` (or as an "embed plugin" path) that listens for `insertNode` and calls `editorUi.editor.graph.addCell(...)` with the right `mxCell` shape including `equipment-id="42"` as a custom attribute.

2. **Use drawio's existing "library" drop pattern** — define each equipment as a stencil entry in the `allEntries` payload of the `load` message. Less flexible (have to know all equipment up front) and pollutes the shape sidebar. **Skip.**

The custom plugin in option 1 is the minimum-glue solution.

### 11.5 `flow_designs.flow_data` content semantics after §11

| State | `flow_format` | `flow_data` | `svg_cache` | Meaning |
|---|---|---|---|---|
| New row created via `POST /flow-designs` | `'drawio'` (default) | `NULL` | `NULL` | Blank canvas. drawio loads with the default empty XML. |
| Saved at least once via Designer | `'drawio'` | `<mxGraphModel>…</mxGraphModel>` | `<svg>…</svg>` | Real drawio XML + thumbnail SVG. |
| Legacy row (pre-§11) | `'gojs'` (set by migration SQL) | `NULL` (also set by migration) | `NULL` | Blanked out. Designer shows blank canvas and writes a fresh drawio diagram on first save. After first save, `flow_format` updates to `'drawio'`. |

### 11.6 Live status overlay design

Core value of Flow Monitor — operators see which machines are running/stopped/idle/warning. drawio doesn't have first-class "live data binding" like GoJS, so we drive it via the custom plugin:

- Each equipment-bound node carries `equipment-id="N"` as a custom mxCell attribute (set at drop time per §11.4.5).
- Monitor detail page polls `GET /:id/monitor-status` every 10s (already wired in Plan A via `useFlowMonitorStatus`).
- On every response, post:
    ```
    { action: 'paintStatus',
      statuses: [{ equipmentId: 42, status: 'running'|'stopped'|'warning'|'idle'|'offline',
                   lastOnline: '...' }, ...] }
    ```
- The custom plugin walks all cells via `graph.model.cells`, finds ones with matching `equipment-id`, updates their `style` (fill color) and optionally injects a small SVG badge as a child cell.
- Status → color (legacy-matched):
  - `running` → `#52c41a` (green)
  - `warning` → `#faad14` (amber)
  - `stopped` → `#f5222d` (red)
  - `idle` → `#bfbfbf` (grey)
  - `offline` → `#8c8c8c` (dark grey)
- The plugin also makes Monitor view-mode read-only (`graph.setEnabled(false)`) so operators can't accidentally edit.

### 11.7 Thumbnail strategy

Per the operator decision: save SVG at save-time (avoids per-card iframe explosion).

- Add `svgCache String?` to `FlowDesign` model alongside `flowFormat` (§11-S1).
- Backend: extend `PUT /:id/diagram` to also accept `svgCache` field. If present, store it. Return it in `GET /list-with-data` (§11-S2).
- Frontend save flow: after the user saves, the parent posts `{ action: 'export', format: 'svg' }` to the iframe, awaits the `export` response, sends the SVG as part of the save payload.
- Card grid: `FlowCard` renders the inline SVG when `flow.svgCache` exists, falls back to `EmptyDiagramPlaceholder` when not.

### 11.8 Files to delete / rename after porting

- `frontend/src/components/flow/GoJsLicensePlaceholder.tsx` → **rename** to `EmptyDiagramPlaceholder.tsx`. Content updates: no more "GoJS license required" copy; shows "No diagram yet" + a "Open in Designer" link.
- `frontend/src/components/flow/FlowCanvasPlaceholder.tsx` (legacy mock canvas from Phase 4b) → **delete**.
- `frontend/src/components/flows/` (the ValueChart-pasted folder, plural) → **delete** after porting `EditorView.tsx` content into `flow/FlowDesignerEditor.tsx`.
- The `if (process.env.NEXT_PUBLIC_GOJS_LICENSE_KEY)` conditional in the placeholder → remove.
- All GoJS / `NEXT_PUBLIC_GOJS_LICENSE_KEY` references in earlier §§ — leave as historical record (still accurate for that point in time); §11 is now the authoritative direction.

### 11.9 Step-by-step implementation (locked plan)

| Step | Scope | Files touched | Stop point |
|------|------|---------------|-----------|
| **§11-S1** | Schema patch | `prisma/schema.prisma` (add `flowFormat`, `svgCache`); `prisma db push`; SQL to blank legacy GoJS rows in `tenant_2`, `tenant_66` | Verify columns exist + legacy rows blanked. Commit. |
| **§11-S2** | Backend `PUT /:id/diagram` accepts `svgCache` + returns `flowFormat` + `svgCache` in `GET /list-with-data` + Designer always sends `flow_format = 'drawio'` on save | `backend/src/services/admin-flow-designs.service.js` | curl smoke. Commit. |
| **§11-S3** | Port `FlowDesignerEditor` from `EditorView.tsx`. Strip AI/share/project/templates/version-history; rewire API calls; replace `getFlowById` with `useFlowDesign`. | `components/flow/FlowDesignerEditor.tsx` (new) | Designer opens, loads diagram, saves XML. Commit. |
| **§11-S4** | Wire Designer page — drop `GoJsLicensePlaceholder`, mount `<FlowDesignerEditor>` | `(admin)/admin/flow-designs/[id]/edit/page.tsx` | Browser smoke: open, edit, save, reload, persists. Commit. |
| **§11-S5** | Equipment tree → canvas drop. Add the small custom plugin to `public/draw_io/js/diagramly/` for `insertNode` handling. Wire the drop handler on the iframe wrapper. | `public/draw_io/js/diagramly/EmbedActions.js` (new tiny plugin); `FlowDesignerEditor.tsx` (drop handler) | Drag equipment, see it appear with `equipment-id` attribute. Commit. |
| **§11-S6** | Thumbnail SVG: capture on save → store in `svgCache` → render in `FlowCard`. Rename placeholder → `EmptyDiagramPlaceholder`. | `FlowDesignerEditor.tsx`, `FlowCard.tsx`, `lib/api/flow-designs.ts` | Save a flow → card grid shows the SVG. Commit. |
| **§11-S7** | Monitor: read-only canvas + live status overlay. Extend `EmbedActions.js` for `paintStatus`. Wire the polling output to the iframe. | `public/draw_io/js/diagramly/EmbedActions.js` (extend); `(user)/monitor/[[...id]]/page.tsx` | Open a flow with machines, see colour-coded status badges that update every 10s. Commit. |
| **§11-S8** | Analyzer: read-only canvas + click-a-node-to-filter. Re-wire `flowKey` query param into `analyzer-data`/`line-chart`/`quant-time` requests when a node is clicked. | `(user)/analyzer/[[...id]]/page.tsx` | Click a node, charts refilter. Commit. |
| **§11-S9** | Playwright updates: un-skip the 3 Plan B tests (`drag equipment from tree to canvas`, `save flow preserves diagram on reload`, `background image upload appears on canvas`). Add new tests for status overlay + thumbnail capture. | `tests/flow-management.spec.ts` | All tests green. Commit. |

### 11.10 Open questions resolved by this plan

- ~~Q1 license decision~~ → **resolved** (drawio, Apache 2.0).
- ~~Q2 Save As semantics~~ → keep as Plan A: `asNewName` field on existing `PUT /:id/diagram`.
- ~~Q3 flow_design_attributes stale~~ → unchanged. Still read-only. drawio's mxCell `equipment-id` attribute is the new authoritative binding (lives inside the XML), not the legacy attributes table.
- ~~Q4 thumbnail caching~~ → **flipped**. We now DO cache. `svg_cache` column added; populated at save time. Per-tenant size impact: ~10-50 KB per flow × ~50 flows max = ~2.5 MB. Acceptable.
- ~~Q5 polling cadence~~ → still 10s.
- ~~Q6 permissions~~ → unchanged. Designer requires `manage-flow-designs`. Monitor/Analyzer read endpoints already split (Step 2 pre-check).
- **NEW: drawio AI/Share/SaveAndExit buttons** — the ValueChart code already injects CSS to hide these (`HIDE_AI_CSS` constant in `EditorView.tsx`). Keep that CSS verbatim.
- **NEW: 178 MB of `public/draw_io/` static assets** — increases the production image size. Acceptable for a self-hosted manufacturing app; flag for review if we ever want a separate CDN.

### 11.11 What's NOT being done in Plan B v1

Explicitly deferred:
- Template browser (the "what kind of flow do you want?" modal at first open).
- Custom shape library (`CustomShapesPanel` — drawio's built-in shapes are enough for v1).
- Team sharing (`ShareFlowModal`).
- Project assignment (`AssignProjectModal`).
- Version history (`GET /api/flows/:id/versions` + restore endpoints).
- Template pack banners (`FlowPackBanner`).
- AI-generated diagrams (`mergeAiXml` postMessage path).

All can land later without re-doing the Designer foundation.

### 11.12 Stop point

**§11 written. Awaiting operator approval. After approval → §11-S1 (schema patch) starts.**


