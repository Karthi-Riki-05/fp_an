# Equipment Tree — Migration Analysis

> **Status:** Step 0 read-and-document complete. **No code generated yet.** Awaiting user approval before Step 1.
> **Source:** `/Applications/XAMPP/xamppfiles/htdocs/fpanalyzer` (Laravel 5.8 + jQuery)
> **Target:** `/Applications/XAMPP/xamppfiles/htdocs/new_fp` (Next.js 14 + Express + Prisma)

---

## 1. Legacy blade path

- Tree shell: `fpanalyzer/resources/views/backend/equipments/equipment_tree.blade.php`
- Recursive child partial: `fpanalyzer/resources/views/backend/equipments/equipmentChild.blade.php`
- Stylesheet: `public/css/equipment_tree.css` (referenced but not deep-read — visual only)

The shell renders **only root nodes** in a `<ul id="tree1" class="sortable">` and includes
the child partial for any node that has descendants. The partial recursively `@include`s
itself, so the entire tree is rendered server-side as a nested `<ul>/<li>` structure.

---

## 2. Legacy routes

| Method | URI                                            | Controller@method                  | Purpose |
|--------|------------------------------------------------|------------------------------------|---------|
| GET    | `/admin/equipment/tree`                        | `DashboardController@getEquipmentTree` | Render the tree page |
| POST   | `/admin/equipments/sortEquipments`             | `DashboardController@sortEquipments`   | Save a drop — reorder within parent OR reparent |
| GET    | `/admin/equipment/updateTreePos`               | `DashboardController@updateTreePos`    | Save which nodes are *expanded* (UI state) for this user |
| GET    | `/admin/equipment/modal-view` *(referenced)*   | `view_equipment` AJAX target           | Open view-equipment modal (separate flow — not in scope here) |
| GET    | `/admin/equipment/modal-view?mode=edit`        | same                               | Open edit modal |
| GET    | `/admin/equipment/add-modal-view`              | add-equipment modal                | Open create-child modal |

> The expand-state persistence (`updateTreePos`) writes a CSV of expanded node ids
> into `users.equipment_tree_pos`. Reload restores expansion from that column.

---

## 3. Controller methods

### getEquipmentTree  (`DashboardController.php:1924–1943`)
- **Returns:** Blade view. Variables exposed: `$categories` (root equipment, eager-loadable `childs()`), `$machines = []` (unused), `$equipment_tree_pos` (CSV from user table).
- **Query:** `Equipments::where('parent_id', 0)->orderBy('sort_order', 'asc')->get()`. The recursion happens in Blade via the `childs()` Eloquent relation (`hasMany('App\Models\Equipments', 'parent_id', 'id')->orderBy('sort_order')`). Equivalent to a flat fetch + tree-build, but Laravel lazy-loads each level on demand.
- **Passed to view as:** `categories`, `machines`, `equipment_tree_pos`.

### sortEquipments  (`DashboardController.php:5561–5592`) — **the actual save**
- **Endpoint:** `POST /admin/equipments/sortEquipments`
- **Accepts (form-urlencoded):**
  - `id` — the dragged node's id
  - `parent_id` — the *new* parent id (`0` for root)
  - `parent_changed` — `1` if reparenting, `0` if reorder-within-same-parent
  - `pos` — the new index (zero-based) inside the new parent
  - `child` — JSON array of the **new sibling order** at the destination position; each entry is the equipment row object. Used only on reorder-within-parent.
- **Does:**
  - **Reparent path (`parent_changed=1`):** `Equipments::find(id)` → set `parent_id = $parent_id` and `sort_order = $pos` → save. Returns `2`.
  - **Reorder path (`parent_changed=0`):** loops `$child[]`, updates each row's `sort_order = $i++` (0-based sequence). Returns `1`.
- **Returns:** integer `1` (reorder), `2` (reparent), or implicit `1` on no-op.
- The frontend treats `data == 2` (reparent) as a signal to do a full page reload (`window.location.href = ...`), so the new structure is freshly rendered. Reorder keeps the optimistic UI state.

### updateTreePos  (`DashboardController.php:5595–5604`) — **expand-state save**
- **Endpoint:** `GET /admin/equipment/updateTreePos?pos[]=...`
- **Accepts:** `pos` — array of node ids that are currently expanded (the ones showing the `glyphicon-plus-sign` icon, per the blade's `treed()` plugin convention).
- **Does:** `users.equipment_tree_pos = implode(',', $pos)` for the calling user.
- **Returns:** integer `1`.
- This is a personal/per-user preference, not part of the tree data itself. Optional to port.

### getEquipmentTreeLastPos (private, `:1945`)
- Reads `users.equipment_tree_pos` for `Auth::id()`. Returned to the blade so the JS can re-trigger clicks on those node ids to restore expansion on reload.

---

## 4. Drag-and-drop library

- **Library:** **jQuery UI Sortable** (not Nestable, not jsTree, not Fancytree). Confirmed by:
  - `public/js/jquery-ui.min.js` present
  - Blade lines 394–442: `$('.sortable').sortable({ handle: '.move', connectWith: '.sortable', start: …, update: … })`
- **Version:** jQuery UI 1.x (legacy bundle — no explicit version comment in min file).
- **Drag trigger:** any element with class `.move` (every `<li><div class="move">…</div></li>`). The whole row is grabbable; there is no dedicated grip icon — the row body itself is the handle.
- **Save trigger:** the Sortable `update` event fires once per drop. JS shows a `confirm("Are you sure?")` dialog before persisting. On OK → AJAX POST to `/admin/equipments/sortEquipments`. On Cancel → `list.sortable('cancel')` (visual revert).
- **AJAX payload** (line 430):
  ```
  POST /admin/equipments/sortEquipments
  child=[…serialised sibling array…]
  parent_id=<new parent>
  id=<dragged node id>
  parent_changed=<0|1>
  pos=<new index in new parent>
  ```
  The `child` array is the dragged node's sibling list with two entries swapped (the legacy code does a single 2-element swap inside the array client-side — a buggy approximation of a real reorder, but it's what gets sent).

- **Connect-with:** `connectWith: '.sortable'` — every nested `<ul class="sortable">` is connected, so dragging across parents (reparenting) works in one drop.

- **Visual placeholder:** the default jQuery UI placeholder. No custom drop-line indicator.

---

## 5. Equipment table schema

Current new_fp schema (Postgres `tenant_template.equipment`):

| Column        | Type                       | Notes |
|---------------|----------------------------|-------|
| `id`          | `integer`                  | PK, autoincrement |
| `company_id`  | `integer`                  | unused on tenant rows (legacy artifact) |
| `sort_order`  | `integer NOT NULL DEFAULT 0` | **the reorder column** |
| `parent_id`   | `integer NOT NULL DEFAULT 0` | `0` = root (no FK enforced; conventional sentinel) |
| `type_id`     | `integer`                  | FK → `types.id` (Equipment kind) |
| `name`        | `varchar(255)`             | |
| `description` | `text`                     | |
| `icon`        | `varchar(255) NOT NULL DEFAULT 'noimage.jpg'` | |
| `is_active`   | `boolean NOT NULL DEFAULT true` | for status toggle |
| `legacy_id`   | `bigint` UNIQUE            | legacy import marker (nullable) |
| `created_at`/`updated_at`/`deleted_at` | timestamptz | soft-delete via `deleted_at` |

Indexes that matter for tree work:
- `equipment_parent_id_sort_order_idx (parent_id, sort_order)` — ideal for the recursive children query
- `equipment_parent_id_idx (parent_id)`

The legacy schema uses **adjacency list + sort_order**, not `lft/rgt` (nested set). No need to worry about Modified Preorder Tree Traversal — straightforward reordering.

---

## 6. Tree features in legacy (checked)

- [x] **Drag to reorder within same parent** — jQuery UI Sortable, fires `update` → `sortEquipments`
- [x] **Drag to reparent (move to different parent)** — same, via `connectWith: '.sortable'`. Backend reload after reparent.
- [x] **Add child node (per node)** — right-click context menu → `add_equipment(id, name)` → AJAX loads add modal
- [x] **Edit node (modal)** — right-click context menu → `edit_equipment(id)` → AJAX loads edit modal. Also clicking the node opens a *view* modal (`view_equipment(id)`).
- [ ] **Delete node** — Not in the equipment_tree blade. There is `del_folder()` defined but commented out in the context menu (lines 51, 367). Delete happens via the equipment list page in legacy, **not the tree**.
- [x] **Expand/collapse toggle** — `glyphicon-plus-sign` / `glyphicon-minus-sign` per node; managed by the inline `$.fn.treed()` plugin (lines 126–200).
- [ ] **Expand all / Collapse all button** — Not present.
- [ ] **Search/filter** — Not present.
- [ ] **Status toggle (activate/deactivate)** — Not present on the tree. Status is managed on the list page.
- [x] **Icons per node** — `$category->icon` if set, else `getType->icon` (fall back to Equipment type's icon). PNG from `public/img/icons/`.
- [x] **Right-click context menu** — custom `#context-menu` div, positioned at the mouse on `oncontextmenu`. Items: Edit equipment, Add equipment. (Other items commented out.)
- [ ] **Keyboard navigation** — Not present.
- [x] **Confirm dialog before drop persists** — `confirm("Are you sure?")` (line 407).
- [x] **Per-user expand-state persistence** — `updateTreePos` writes CSV of expanded node ids into `users.equipment_tree_pos`. Restored on next page load.

---

## 7. Current new_fp tree state

- **File:** `frontend/src/app/(admin)/admin/equipment/tree/page.tsx`
- **Component:** AntD `<Tree>` with `showLine`, `showIcon`, `defaultExpandAll`, `blockNode`.
- **Data:** fetched via `useEquipmentTree(null)` → `GET /api/v1/equipment/tree` → returns **already-nested** `EquipmentTreeNode[]`. Build verified in `backend/src/services/equipment.service.js` `getTree()` — flat list converted to children-bearing nodes server-side.
- **Working:** expand/collapse (built into AntD Tree), icons (custom `EquipmentIcon` falls back to `ApartmentOutlined`), connecting lines (CSS via `showLine`), read-only rendering.
- **Missing (vs legacy):**
  - Drag-to-reorder
  - Drag-to-reparent
  - Right-click context menu (Add child, Edit)
  - Confirm-before-save dialog
  - Per-user expand-state persistence (optional)
  - "Click node → open view modal" wiring

Backend endpoints already present:
- `GET    /api/v1/equipment/tree` — nested tree
- `POST   /api/v1/equipment` — create
- `PATCH  /api/v1/equipment/:id` — update
- `DELETE /api/v1/equipment/:id` — soft delete
- (No reorder / position endpoint yet — confirmed via `grep` of `routes/equipment.routes.js`.)

---

## 8. Implementation plan

### Drag library choice — `@dnd-kit/core` + `@dnd-kit/sortable`
- **Not installed yet** — `grep "@dnd-kit" package.json` → no match. New install required.
- Per the prompt: do NOT use `react-beautiful-dnd` (archived) or `react-sortable-tree` (unmaintained). Confirmed.
- `@dnd-kit` is the React-idiomatic, accessible, hook-based replacement for jQuery UI Sortable. It supports:
  - Nested sortable containers (the equivalent of jQuery's `connectWith`)
  - Custom drag handles
  - Pointer / keyboard sensors
  - Drop indicators via custom `DragOverlay`

### Backend endpoints to add (Step 1)

A **single batch endpoint** is sufficient — the legacy uses two paths (reparent vs reorder) but both update the same columns. One endpoint that accepts an array of `{id, parentId, sortOrder}` and runs the updates inside one transaction covers both. Add a strict circular-reference guard server-side.

1. `POST /api/v1/equipment/reorder` — batch update (primary)
2. `PATCH /api/v1/equipment/:id/position` — single-item update (convenience; optional given the batch endpoint)
3. `GET   /api/v1/equipment/tree` — **already exists**, no change
4. **Anti-circular guard** — walk up from the proposed new parent. If we ever hit the moved node's id, reject 400 with `circular-reference`.

### Frontend changes (Step 2)

1. Install `@dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`.
2. Replace `frontend/src/app/(admin)/admin/equipment/tree/page.tsx` content. Keep AntD `<Tree>` only as a small mobile/fallback view (optional — primary desktop view becomes the new component).
3. Build `frontend/src/components/equipment/DraggableEquipmentTree.tsx` (recursive `TreeNode`).
4. Per-node actions: right-click context menu (matches legacy) **plus** hover-only inline icons (Edit / Add child) — modern complement, since right-click is hidden by default.
5. Reuse the existing `Edit equipment` modal from `/admin/equipment` (Phase C1 work). For Add-Child, open the create form with `parentId` pre-set.
6. **Save behaviour:** keep the legacy's confirm-before-save pattern. After a drop, show an AntD `Modal.confirm("Are you sure?")` → on OK, call `POST /equipment/reorder` with the affected nodes' new positions; on Cancel, revert local state.
7. Anti-circular guard on the client too — fast feedback before the request goes out.
8. Skip expand-state persistence for v1 (it's a per-user preference, not core functionality). Add later as `/me/preferences` if desired.

### Out of scope (per legacy parity check)

- Delete from the tree (legacy doesn't do it on the tree page — keep that pattern; the list page is where Delete lives)
- Status toggle from the tree (legacy doesn't have it on the tree)
- Search / Expand-all / Collapse-all (legacy doesn't have these — the prompt asks me to implement them, but check Section 6: legacy has none of these. Recommend **including them anyway** because they're cheap, useful, and won't disturb parity. Will flag in §9.)

---

## 9. Questions / ambiguities

1. **Save flow** — legacy shows a `confirm("Are you sure?")` dialog before every drop persists. Should new_fp keep this confirmation, or save silently with toast feedback? The prompt suggests "save on every drop" — I lean keep-the-confirm because it matches legacy and protects against accidental drops, but it adds friction. **Recommend keep the confirm dialog.**

2. **Reparent reload** — legacy returns `2` and the JS does `window.location.href = …` to fully reload after a reparent (server is the source of truth for the new structure). new_fp can avoid the reload by relying on the optimistic-update result and a query invalidation. **Recommend optimistic update + invalidate, no page reload.**

3. **Expand-all / Collapse-all / Search box** — the prompt lists these in the implementation plan, but legacy has *none of them* (verified §6). Building them goes beyond strict parity. Two options:
   - **(A) Skip them** to match legacy strictly.
   - **(B) Add them anyway** because they're useful and cheap with `@dnd-kit`.
   **Recommend (B)** — they don't change drag semantics and improve UX.

4. **Per-user expand-state persistence** — legacy persists which nodes are expanded in `users.equipment_tree_pos`. The new_fp `users` table has no equivalent column. Adding it requires a migration. **Recommend skip for v1** — local React state suffices; revisit later if requested.

5. **Right-click context menu** — should the new_fp tree support right-click (desktop parity) or only show actions on hover/click? Right-click feels dated and is invisible on touch devices. **Recommend hover-icons primary, right-click as a secondary affordance.**

6. **Status toggle and Delete on the tree** — the prompt's Step 2 plan lists both but legacy has neither on the tree. **Recommend skip** — both already exist on `/admin/equipment` (the list page) which has the inline icons.

7. **Mobile/touch behaviour** — `@dnd-kit` supports pointer sensors but tree drag-on-mobile is awkward. Should we restrict drag to desktop and fall back to a read-only `<Tree>` on small screens? **Recommend desktop-only drag (≥768px); mobile shows the AntD `<Tree>` read-only.**

---

**Stop here.** Awaiting approval of:
- §8 Implementation plan
- §9 Decisions on questions 1–7

Once confirmed, Step 1 (backend reorder endpoint + circular-ref guard) begins.

---

## 10. Approved decisions (locked in)

| # | Topic | Decision |
|---|-------|----------|
| 1 | Confirm-before-save | **KEEP** — use AntD `Modal.confirm` (not browser `confirm()`). Match legacy intent with cleaner UX. |
| 2 | Reparent reload vs optimistic | **OPTIMISTIC UPDATE + invalidate** — no full page reload. Re-fetch tree on success. |
| 3 | Search / Expand-all / Collapse-all | **ADD Expand-all + Collapse-all**, SKIP search (scope creep, filtered nodes can't drag — defer to later issue). |
| 4 | Per-user expand-state persistence | **SKIP for v1** — local React state only. Future: add `users.equipment_tree_pos` column if requested. |
| 5 | Hover icons vs right-click | **BOTH** — hover icons (Edit, Add child) are primary; right-click context menu is secondary (matches legacy discoverability). |
| 6 | Delete / status toggle on tree | **SKIP** — list page is the authoritative surface for those actions. Don't blur the boundary. |
| 7 | Mobile drag | **Desktop-only drag (≥ 768px)** — smaller viewports render the existing read-only AntD `<Tree>` via `useMediaQuery`. |

### Root parent representation
Confirmed against schema: `tenant_template.equipment.parent_id integer NOT NULL DEFAULT 0`. **Root = `0`**, not `null`. Backend accepts `null` / missing / `0` from the client and normalises to `0`.

### Backend contract (Step 1)
- `POST /api/v1/equipment/reorder` — body `{ items: [{ id, parentId, sortOrder }] }`. Validates tenant membership for every id. Anti-circular walk is performed on the CURRENT tree state (before any update), then all updates run in one `withTenant` transaction. Returns `{ updated: N }`.
- `PATCH /api/v1/equipment/:id/position` — body `{ parentId, sortOrder }`. Single-item convenience; delegates to `reorder` internally with a one-element array.
- Circular-ref error response: `400 { statusCode: 400, message: 'circular-reference', nodeId: <X> }`.

### Frontend contract (Step 2, for reference)
- Library: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` — fresh install.
- Flatten visible tree into `[{ id, depth, parentId, sortOrder, hasChildren, expanded, ... }]` for sortable consumption.
- Drop projection by **horizontal indent of pointer vs node depth** — Linear/Notion/dnd-kit-tree-stories pattern.
- Blue line indicator at the projected drop position.
- On DragEnd → AntD `Modal.confirm` → on OK, `POST /equipment/reorder` → on Cancel, revert local state.
- Anti-circular guard also on the client for fast feedback.
- `useMediaQuery('(min-width: 768px)')` decides draggable-vs-readonly rendering.

### Commits planned
1. `fix(backend): equipment tree — reorder + position endpoints, circular-ref guard`
2. `feat(frontend): equipment tree — draggable with @dnd-kit, confirm dialog, hover actions, context menu, expand/collapse all, mobile fallback`

### Stop points (carried over)
- After commit 1: report test suite count.
- After commit 2: report manual browser verification before running Playwright.
- After Playwright: final review.

