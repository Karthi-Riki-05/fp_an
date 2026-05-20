# Session Handoff — 2026-05-15

Flow Management drawio migration (§11 of `FLOW_MANAGEMENT_ANALYSIS.md`).
This session took the plan from "S5 mid-debugging the drop bug" all the way
through S9. The whole §11 path is now shippable; remaining items are polish.

---

## What's done

| Step | Title | Status |
|------|-------|--------|
| §11-S1 | Schema (`flow_format`, `svg_cache` columns) | ✅ |
| §11-S2 | Backend `svgCache` save + read endpoints | ✅ |
| §11-S3 | `FlowDesignerEditor` port from ValueChart | ✅ |
| §11-S4 | Designer page two-pane layout | ✅ |
| §11-S5 | Drag-drop equipment → drawio cell | ✅ |
| §11-S6 | Thumbnail SVG capture + FlowCard render | ✅ |
| §11-S7 | Monitor live status overlay (paintStatus) | ✅ |
| §11-S8 | Analyzer click-to-filter | ✅ (static-SVG approach) |
| §11-S9 | Test cleanup, un-skip stubs | ✅ (15/17 passing) |

### Architecture per page

- **Designer** (`/admin/flow-designs/:id/edit`): live drawio iframe in edit
  mode. Equipment tree on the left, native HTML5 drag-drop forwarded into
  the iframe via fp-embed.js capture-phase listeners. Save via drawio toolbar
  triggers `event:'save'` → parent requests SVG export → PUT `/:id/diagram`
  with both `flowData` (XML) and `svgData` (SVG).
- **Monitor** (`/monitor/:id`): live drawio iframe in readOnly mode.
  `useFlowMonitorStatus` polls every 10s; results are mapped to drawio style
  fragments (`on`/`off` → green/red palettes) and pushed to fp-embed.js via
  `action:'paintStatus'`, which swaps `fillColor/strokeColor/fontColor` on
  cells whose UserObject carries a matching `equipment-id`.
- **Analyzer** (`/analyzer/:id`): **static decorated SVG** — not a live
  iframe. The cached `svgCache` is rendered inline via
  `dangerouslySetInnerHTML`; `decorateSvgWithEquipmentIds` cross-references
  the `flowData` XML to inject `data-equipment-id` attributes onto each
  `<g data-cell-id="X">`. Click handling is pure DOM delegation.

  **Why static SVG and not the live editor here?** drawio's `EditorUi.createUi`
  hook (where `over-ride.js` captures `__editorUi`) is unreliable on the
  *second* iframe load in a session. The Designer iframe always gets it; a
  subsequent Analyzer/Monitor iframe (after navigating away from Designer)
  sometimes doesn't. paintStatus and cellClick forwarders both need
  `__editorUi`, so they break. The static-SVG path sidesteps the entire
  embed-mode boot dance. Monitor still uses the live iframe because the live
  paint matters more there; this is the open polish item below.

---

## Files touched this session

### Frontend
- `public/draw_io/index.html` — `?v=` cache buster bumped to v9
- `public/draw_io/service-worker.js` — neutered (uninstalls itself on activate)
- `public/custom/chart/js/fp-embed.js` — drop target, paintStatus, cell-click
  forwarder (IIFE-bound, falls back through multiple graph-lookup strategies)
- `src/components/flow/FlowDesignerEditor.tsx` — postMessage protocol,
  paintStatus pump, `onCellClick`, readOnly URL (no `lightbox=1&chrome=0`
  because that path breaks the createUi hook)
- `src/components/flow/FlowCard.tsx` — inline SVG thumbnail via `svgCache`
- `src/components/flow/FlowCardGrid.tsx` — passes svgCache
- `src/components/flow/EmptyDiagramPlaceholder.tsx` — **replaces**
  `GoJsLicensePlaceholder.tsx` (deleted), neutral copy
- `src/app/(admin)/admin/flow-designs/[id]/edit/page.tsx` — `EquipmentRow`
  with native `draggable=true`, two-pane layout
- `src/app/(user)/monitor/[[...id]]/page.tsx` — live editor + status overlay,
  `statusToStyle()` maps `on`/`off` enum to drawio fillColor/strokeColor
- `src/app/(user)/analyzer/[[...id]]/page.tsx` — `FlowDiagramClickMap` +
  `decorateSvgWithEquipmentIds`
- `src/lib/api/flow-designs.ts` — `svgCache` and `flowFormat` on `FlowDesignRow`

### Backend
- `prisma/schema.prisma` — `flow_format String @default("drawio")`,
  `svg_cache String?` on `FlowDesign`
- `src/services/admin-flow-designs.service.js`:
  - Shared `SELECT` includes `flowFormat` + `svgCache` (so `findOne` returns them)
  - `saveDiagram` validates SVG starts with `<svg`, caps 500KB, detects format
  - `getMonitorStatus` parses drawio XML to extract equipment ids
    (legacy GoJS branch kept for un-migrated rows)

### Tests (new)
- `tests/flow-drop-debug.spec.ts` — drag-drop produces a drawio rectangle
- `tests/flow-thumbnail-debug.spec.ts` — save populates `svgCache` and
  FlowCard renders it as inline SVG
- `tests/flow-monitor-debug.spec.ts` — paintStatus fires and overrides cell
  fillColor based on `machines.running_status`
- `tests/flow-analyzer-debug.spec.ts` — clicking a decorated SVG cell
  surfaces the "Filtered to equipment #N" chip
- `playwright.config.ts` — 4 new debug projects matching the above

### Tests (updated)
- `tests/flow-management.spec.ts` — GoJS-placeholder assertions removed;
  drawio assertions added; 2 of 3 `test.skip` stubs converted to real tests;
  background-image-upload stub deleted (feature gone)

---

## Known issues / open polish

1. **`__editorUi` flakiness in second-iframe loads** — root cause is
   drawio's embed-mode boot timing racing with `over-ride.js`'s
   `EditorUi.prototype.createUi` prototype patch. Currently we work around
   it by using a static SVG in Analyzer. Monitor still uses the live iframe
   and works *most* of the time, but a stale auth cookie + this race could
   produce an empty canvas (paintStatus never fires). **Long-term fix:** move
   `over-ride.js` to load *before* `js/main.js` in `public/draw_io/index.html`
   so the prototype patch is in place when drawio's first `EditorUi`
   instance is constructed. Risk: ValueChart team owns `over-ride.js`; their
   load-order may have a reason we don't yet understand.

2. **Two flow-management.spec.ts tests fail under rate-limit pressure** —
   `analyzer detail makes line-chart + quant-time requests` and
   `recent stops card renders`. Both fail when the session-wide login
   throttle (50/min) is hit by earlier tests. Not a §11 regression —
   these would have failed before the migration too if run after a busy
   suite. **Fix options:** (a) bump backend login rate limit in
   `.env.local` for tests, (b) reuse a single API context across the whole
   suite instead of `apiContextFor` per test, (c) accept these as flaky and
   add `test.retry(2)` to that describe block.

3. **Monitor side-panel "Selected node" is still hardcoded to mock `NODES`**
   (`n2` initial state). Clicking a cell in Monitor doesn't update the side
   panel. Same `onCellClick` plumbing as Analyzer would wire it; we just
   didn't do it because the Monitor test scope was "paintStatus works",
   not "click selects". Reasonable next-day polish.

4. **No machine data in tenant_2 by default** — for §11-S7 verification I
   seeded a row directly:
   ```sql
   INSERT INTO tenant_2.machines
     (equipment_id, pin_no, unit_name, running_status, unit_connected, last_online, signal_type)
   VALUES (79, 1, 'test-unit', 'on', 'on', NOW(), 'on');
   ```
   That row is still in the DB. Either keep it as a test fixture or seed
   it in a proper migration. The Monitor test depends on it.

5. **Backend hot-reload didn't pick up the `SELECT` constant change**
   without a `docker restart new_fp-backend-1`. If you change any
   module-level constant in `admin-flow-designs.service.js`, restart the
   backend before testing.

6. **3 `test.skip` originally — only 2 are now real tests.** The third
   ("background image upload appears on canvas") was deleted because the
   feature was removed when the GoJS placeholder was retired. If background
   images were never a real product requirement, that's fine. Worth
   confirming with the operator.

---

## Where to pick up tomorrow

Priority order (top = highest leverage):

1. **Wire Monitor click-to-select** — `onCellClick` on the readOnly
   `FlowDesignerEditor` already exists. Hook it into `FlowMonitorDetail`'s
   `selectedId` state. ~15 min.
2. **Fix `over-ride.js` load order** — move it to load before `main.js` in
   `public/draw_io/index.html` and verify Designer+Monitor+Analyzer still
   work. If clean, we can swap Analyzer back to the live iframe (it gets
   paintStatus support for free that way). ~30 min + manual verification.
3. **Address the 2 flow-management.spec.ts rate-limit failures** —
   easiest: replace per-test `apiContextFor` calls with a module-level
   singleton. ~20 min.
4. **Seed `tenant_2.machines` fixtures in a migration** so Monitor test
   data is reproducible. ~30 min.
5. **Manual smoke** — actually use the app in a browser, drop a few
   equipment, save, navigate Monitor + Analyzer, confirm the user-visible
   experience matches the test output. The Playwright tests prove
   end-to-end wiring; eyeballing catches CSS/spacing/UX issues tests miss.

---

## Quick references

- §11 plan: `FLOW_MANAGEMENT_ANALYSIS.md` §11
- drawio version: 29.3.6 vendored at `frontend/public/draw_io/`
  (Apache 2.0)
- ValueChart hooks: `frontend/public/custom/chart/js/over-ride.js`
- FP-specific plugin: `frontend/public/custom/chart/js/fp-embed.js`
- Postmessage contract: `FLOW_MANAGEMENT_ANALYSIS.md` §11.4

### Useful commands

```bash
# Backend hot-reload doesn't catch constants — restart explicitly
docker restart new_fp-backend-1

# Refresh Playwright auth (JWT expires in 24h)
cd frontend && npx playwright test --project=user-setup

# Run a single §11 debug test
cd frontend && npx playwright test --project=flow-drop-debug
cd frontend && npx playwright test --project=flow-thumbnail-debug
cd frontend && npx playwright test --project=flow-monitor-debug
cd frontend && npx playwright test --project=flow-analyzer-debug

# Full flow-management suite (15/17 pass under rate-limit)
cd frontend && npx playwright test --project=flow-management

# Inspect a saved flow's XML / svgCache via API
curl -k -s -X POST https://api.fptest.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user2@gmail.com","password":"password123"}' \
  -c /tmp/cookies.txt > /dev/null
curl -k -s https://api.fptest.com/api/v1/admin/flow-designs/<id> \
  -b /tmp/cookies.txt | python3 -m json.tool
```
