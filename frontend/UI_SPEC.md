# FP Analyzer — UI Specification (Phase 4a)

> **Status:** Phase 4a deliverable — design language extracted from the legacy
> Bootstrap/AdminLTE/jQuery app, re-implemented in Ant Design 5 + Next.js 14
> App Router, with three reference screens (Login, Equipment list, Flow
> Monitor) covering all the patterns the rest of Phase 4 needs.

The legacy app (`/fpanalyzer`) is **read-only reference material**. We extract
its design language — not its markup. The rule throughout this document:

> Same brand identity, same information architecture, same key interactions.
> NOT same DOM structure.

---

## 1. Design tokens

Source of truth: `frontend/src/lib/theme/tokens.ts`. Wired into the AntD
`ConfigProvider` via `frontend/src/lib/theme/antd-theme.ts`. Every AntD
component picks the brand up automatically.

### 1.1 Brand palette

| Token | Hex | Source in legacy |
|---|---|---|
| `colors.brandPrimary` | `#01b9d0` | Logo, marketing-site `style.css` `.background:#01b9d0` (line 1417); also matches AdminLTE backend `info` color used for highlights. |
| `colors.brandDeep`    | `#00768D` | Marketing-site `.header_top { background:#00768D }` (`style.css` head). The dark teal in the brand. |
| `colors.brandLight`   | `#4BBACF` | Active nav highlight on marketing site (`style.css` `.navbar-inverse .navbar-nav > .active > a` `color:#4BBACF`). |
| `colors.brandAccent`  | `#954cfe` | Backend `submit-btn` border + `.time-slider` handle in `backend-custom.css`. **Demoted from primary** (Phase 1 had this wrong) — the actual logo is teal, not purple. Kept as a secondary CTA accent. |

### 1.2 Semantic colors

Pulled from AdminLTE 2 defaults (`public/assets/sass/backend/_variables.scss`):

| Token | Hex | Source |
|---|---|---|
| `colors.success` | `#00a65a` | `$green` |
| `colors.warning` | `#f39c12` | `$yellow` |
| `colors.error`   | `#dd4b39` | `$red` |
| `colors.info`    | `#01b9d0` | aligned with `brandPrimary` (legacy `$aqua` `#00c0ef` was close; we unify) |

### 1.3 Machine status colors

Used in Flow Monitor / Units / Machine Status detail. Critical because
operators read these from across a factory floor.

| Status | Hex | Visual |
|---|---|---|
| running | `#00a65a` | green |
| idle    | `#bfbfbf` | grey |
| stopped | `#dd4b39` | red |
| warning | `#f39c12` | orange |
| offline | `#999999` | dark grey |

Each status is **also paired with a text label and an icon** (PlayCircle,
ClockCircle, PauseCircle, Warning) — color is never the only signal.
Legacy app violated this; we fix on the way through.

### 1.4 Typography

| Token | Value | Source |
|---|---|---|
| body sans | **Lato** via `next/font/google` | `public/assets/sass/{backend,frontend}/variable-overrides.scss:2`: `$font-family-sans-serif: Lato, "Helvetica Neue", Helvetica, Arial, sans-serif;` |
| display | **Poppins** via `next/font/google` | `public/css/style.css` `@font-face` at top — Poppins Bold/Medium/Regular were locally hosted. We use `next/font/google` instead so we don't ship the TTFs. |

Both via `next/font/google` in `app/layout.tsx` — exposed as CSS variables
`--font-lato` / `--font-poppins` and consumed by AntD's `fontFamily` token.

### 1.5 Spacing / radius / shadows

| Token | Value | Notes |
|---|---|---|
| spacing | `4 / 8 / 16 / 24 / 32 / 48` | AdminLTE rhythm; aligns with AntD's default 8-step grid. |
| radius.base | `6px` | **Diverges from legacy 3px** (AdminLTE `$box-border-radius`). Adopting AntD's 6px global default — explicit decision in §6 below. |
| shadows.card | `0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.08)` | Softer than AntD default; closer to legacy `$box-boxshadow: 0 1px 1px rgba(0,0,0,.1)`. |

---

## 2. Icon mapping

Source: `frontend/src/lib/theme/icon-map.ts`. The 100+ entries cover
Font Awesome 4, Ionicons 2, and a few Glyphicons — translated to
`@ant-design/icons` outline-style components.

Examples (full list in source):

| Legacy | AntD | Used on |
|---|---|---|
| `fa-tachometer` | `DashboardOutlined` | sidebar dashboard |
| `fa-cogs` | `SettingOutlined` | settings, types |
| `fa-cubes` | `AppstoreOutlined` | equipment, parts |
| `fa-connectdevelop` | `NodeIndexOutlined` | flow designs |
| `fa-bar-chart` | `BarChartOutlined` | reports, KPIs |
| `fa-clock-o` / `ion-android-stopwatch` | `ClockCircleOutlined` | shifts, timers |
| `fa-folder-open` | `FolderOpenOutlined` | files |
| `fa-users` | `TeamOutlined` | user mgmt |

Unknown legacy icons fall through `resolveIcon()` to `QuestionCircleOutlined`
with a `console.warn` in dev — so missing mappings get noticed during port.

---

## 3. Layout shells

### 3.1 PublicShell (`components/layout/PublicShell.tsx`)

For `/`, `/faq`, `/login`, `/register`, `/privacy_policy`, `/terms_conditions`,
`/roi-kalkyl`. Mirrors `frontend/layouts/master.blade.php` + `nav.blade.php`
+ `footer.blade.php`.

```
┌────────────────────────────────────────────┐
│  [logo]                Home  FAQ  ROI [Sign in] │  Header (sticky, white, 64px)
├────────────────────────────────────────────┤
│                                            │
│        page content / hero                 │  Content (#ecf0f5)
│                                            │
├────────────────────────────────────────────┤
│  FP Analyzer · Manufacturing OEE          │
│  Privacy · Terms · ROI · info@…           │  Footer (#1a1a1d, 32px padding)
└────────────────────────────────────────────┘
```

`minimal` prop hides marketing nav (used on `/login`).

### 3.2 UserShell (`components/layout/UserShell.tsx`)

Operator-facing layout. Mirrors authenticated `frontend/layouts/master.blade.php`
+ `nav.blade.php`. **Top-nav** layout, no persistent sidebar (some pages add
a contextual side panel via inline `Row`/`Col`).

```
┌────────────────────────────────────────────┐
│ [logo] Dashboard MyResult Monitor … [Tenant] [User ▼] │
├────────────────────────────────────────────┤
│                                            │
│  page content                              │
│                                            │
└────────────────────────────────────────────┘
```

Mobile (< 768px): nav collapses into a `Drawer` triggered from a hamburger.

### 3.3 AdminShell (`components/layout/AdminShell.tsx`)

For `/admin/*`. Mirrors AdminLTE: collapsible left sider + top header +
content. **Sider menu IA** (matches `backend/includes/sidebar.blade.php`):

```
Dashboard
Flow management ▸  Flow designs / Flow monitor / Flow analyzer / Loss model
Equipment ▸        Equipment list / Stop reasons / Scrap reasons
Production ▸       Parts / Orders / Work shifts / Shift schedules
Results ▸          Production / Scrap / Stop / Warning data
Types
Machines ▸         Machines / Machine files / Programmes / Workstations
Files / Folders
Content ▸          CMS / Sliders / Testimonials / Symbols
Boards
IoT ▸              Setup units / Firmware / Auto-register
Import / Export
Access ▸           Users / Roles / Tenants
Feedback
```

Mobile (< 992px): sider becomes a left `Drawer`.

---

## 4. Reference screens

### 4.1 Login — `app/(public)/login/page.tsx`

| Aspect | Decision |
|---|---|
| Shell | `PublicShell` with `minimal` (no marketing nav) |
| Form | `react-hook-form` + `zod` schema (`email().min(1)`, `password().min(1)`); inline error messages; `aria-invalid` + `aria-describedby` |
| Submit | calls `useLogin()` hook → `POST /api/v1/auth/login` (Phase 3 backend) |
| Social | 5 providers (Google/Facebook/GitHub/LinkedIn/Twitter); circle-icon buttons; **no Bitbucket** per Phase 0 v2 §13.27 |
| Account creation | Email link `info@fpanalyzer.se` — matches legacy "to register, email us" text |
| Forgot password | link to `/password/reset` (Phase 4b ports the reset flow) |
| Dev creds | inline gray-box footer — only renders in any environment for now; Phase 4b gates on `NODE_ENV !== 'production'` |

Tested at 360px / 768px / 1280px width.

### 4.2 Equipment list — `app/(admin)/equipment/page.tsx`

Mirrors `backend/equipments/equipments.blade.php` IA:

| Legacy block | New impl |
|---|---|
| `box.box-success` wrapper | AntD `Card` (drops the green top border — divergence noted in §6) |
| Page header with title + import/export/add buttons | breadcrumb + page header `<div>` with `Title` + Space of action buttons |
| Filter "Drop group here" + per-column filter operators | single search `Input` (top of table card) — full per-column filter UI deferred to Phase 4b |
| Yajra DataTable with server-side pagination | AntD `Table` with `pagination`, `sorter`, column `filters`, `scroll.x` |
| `actions` column (view/edit/delete dropdown) | AntD `Dropdown` with menu items + AntD `Modal.confirm` for delete |
| Group-by column + summary row | deferred to Phase 4b (added as a "Group by" toolbar control then) |

**Two-pane layout** (Tree | Table) at >= 992px; collapses to single column on
mobile via `@media` block. The legacy app put the tree on a separate route;
the v3 design merges them since users frequently switch between tree and
list view of the same data.

Tree uses AntD `Tree` with `showIcon`, `draggable`, `defaultExpandAll`,
`blockNode`. Drag-to-reorder shows a toast in Phase 4a; Phase 4b wires the
backend reorder mutation.

### 4.3 Flow Monitor — `app/(user)/monitor/[[...id]]/page.tsx`

Mirrors `frontend/flow_control/flow_monitor.blade.php` IA:

| Legacy block | New impl |
|---|---|
| Panel-default with arrow-back + title | breadcrumb-like inline `ArrowLeftOutlined` + `Title` |
| Flow selector (a `<select>` rendered inline) | AntD `Select` with mock flow options |
| `#myDiagramDiv` — GoJS canvas, 16:9 | **`FlowCanvasPlaceholder`** (SVG) — see §5.1 below |
| Modals for register stop/scrap/production | three AntD `Modal` instances with `Form` |
| Hidden flow_data textarea | not needed — diagram state lives in component state, server returns flow JSON in Phase 4b |
| KPI strip (typically below the canvas in legacy) | AntD `Statistic` × 4 (OEE/Availability/Performance/Quality) in a `Card` row |
| Last-5-stops list (legacy as a side panel) | inline list inside the right-side selected-node `Card` |

Polling: `refetchInterval: 10_000` per Phase 0 v2 §16 R5 (wired in Phase 4b
when the API hooks land).

---

## 5. Custom components built for Phase 4a

### 5.1 `FlowCanvasPlaceholder` (`components/flow/FlowCanvasPlaceholder.tsx`)

SVG-based stand-in for the GoJS flow diagram. **Same public API** as the
real GoJS component will have: `nodes`, `edges`, `selectedId`, `onSelect`.
Phase 4b swaps the implementation once the GoJS license is confirmed
(OPERATOR_QUESTIONS.md C4) — no consuming page changes.

Visual semantics that match the legacy GoJS canvas:
- 16:9 aspect ratio (legacy: `h = w / 1.77`)
- white nodes with thin border, drop shadow, brand-colored selection ring
- status indicator dot (5 colors per §1.3) + status text label inside each node
- arrow-tipped edges between nodes
- click / Enter / Space to select
- `role="img"` with `aria-label` for the whole canvas; per-node `role="button"`

### 5.2 None other

Everything else is plain AntD with `ConfigProvider` tokens.

---

## 6. Deliberate divergences from legacy

| Legacy | v3 | Why |
|---|---|---|
| 3px border radius (AdminLTE `$box-border-radius`) | 6px (AntD default) | Modernizes the look without breaking brand recognition. Reverting would require dozens of per-component overrides. |
| Green top-border on `.box-success` cards | flat AntD `Card` with neutral header | The colored top-border is an AdminLTE-ism that doesn't translate well to AntD's card aesthetic. Brand color shows up via primary buttons / tags / status indicators instead. |
| Font Awesome 4 + Ionicons 2 + Glyphicons | `@ant-design/icons` only | One icon system. Mapping in `icon-map.ts`. |
| Equipment list and equipment tree on **separate routes** | combined two-pane on `/admin/equipment` | Operators frequently switch between views; saving one click per workflow. Old tree-only route can be a `?view=tree` query param if anyone misses it. |
| Marketing-site primary purple `#954cfe` (Phase 1 placeholder) | teal `#01b9d0` (logo + marketing actual) | The Phase 1 ConfigProvider color was a guess. The actual logo and marketing CSS are teal — corrected to match. `#954cfe` kept as `brandAccent` for backwards compatibility. |
| Sidebar at 270px | 240px (AntD default) | Saves 30px of horizontal real estate; AntD's collapsible width feels right for the icon set. |
| Color-only status indicators | color + icon + text label | Accessibility (legacy fails WCAG color-contrast for status). Operators on the floor with sun glare also benefit. |
| Per-column filter operator picker (contains/empty/regex/etc.) | single search box + AntD column `filters` for enum columns | The full operator picker is a Phase 4b enhancement on the table component. v3 covers ~80% of usage with the simpler control. |
| AntD Tree expand-collapse caret on the LEFT | (legacy AdminLTE Tree had it on the right) | AntD default. Reversing would require custom CSS that breaks caret accessibility. |
| Legacy /login had a custom JS "password text-feeder" with `myfont.ttf` | standard `Input.Password` | The custom font + JS-driven password mask was an obfuscation hack of unclear value. Standard input + autocomplete + password reveal toggle is more accessible. |

---

## 7. Asset migration manifest

### Copied to `frontend/public/`

| Source | Destination | Reason |
|---|---|---|
| `/fpanalyzer/public/img/logo.png` | `frontend/public/brand/logo.png` | Primary brand logo (the "fp analyzer" wordmark). |
| `/fpanalyzer/public/img/logo40.png` | `frontend/public/brand/logo-40.png` | 40px favicon-style logo for narrow contexts (collapsed sider). |
| `/fpanalyzer/public/img/footer_logo.png` | `frontend/public/brand/footer-logo.png` | White-on-dark footer variant. |
| `/fpanalyzer/public/apple-touch-icon.png` | `frontend/public/apple-touch-icon.png` | iOS home-screen icon. |
| `/fpanalyzer/public/manifest.webmanifest` | `frontend/public/manifest.webmanifest` | PWA manifest; Phase 4b reviews whether to re-author. |
| `/fpanalyzer/public/browserconfig.xml` + `tile.png` + `tile-wide.png` | `frontend/public/...` | Windows tile icons. |
| `/fpanalyzer/public/robots.txt` | `frontend/public/robots.txt` | Carry-over until SEO review. |

### Stub directories created (populated as Phase 6 migration runs):

- `frontend/public/cms/` — CMS-uploaded images (legacy `public/build/img/cms/`)
- `frontend/public/equipment-icons/` — equipment icons (legacy `public/build/img/icons/`)
- `frontend/public/slider/` — slider images (legacy `public/build/img/slider/`)

### NOT copied (replaced by npm packages or AntD)

| Path | Reason |
|---|---|
| `public/css/`, `public/css1/` | Bootstrap / AdminLTE compiled CSS — replaced by AntD theme tokens. |
| `public/js/` | jQuery, Bootstrap JS, GoJS in-tree copy, HighCharts, AmCharts, DataTables — replaced by npm. |
| `public/site/`, `public/site_bk/` | Old marketing-site theme files. |
| `public/datatable/`, `public/calendar/`, `public/colorpicker/`, `public/date-picker/`, `public/time-picker/`, `public/html_editor/`, `public/ckeditor/` | All replaced by AntD components. |
| `public/fonts/` (FontAwesome, Glyphicons, Ionicons, Fontello, Source Sans Pro, custom `myfont.ttf`) | AntD has its own icon set; Lato + Poppins from Google Fonts via `next/font`. The custom `myfont.ttf` was used for an obfuscated password input — dropped. |
| `public/temp/`, `public/log.txt`, `public/worker.log*` | Runtime garbage. |
| `public/db_unique/`, `public/mysqlAdmin/`, `public/API/xmlapi.php` | Security risk; not used. |
| `public/ajax/` | PHP AJAX endpoints — backend is now NestJS. |
| `public/firebase/` | Phase 4b will re-author the FCM service worker as a typed `firebase-messaging-sw.js` co-located with the FCM hook. |
| `public/iot_version/` | Real firmware (B5). Phase 6 migrates to S3; not bundled with the frontend. |

---

## 8. Phase 4b backlog (40+ remaining screens)

Grouped by shell. Path on the right is the legacy Blade reference.

### PublicShell (8 screens)
- `/` (landing) — `frontend/layouts/...` + `frontend/welcome.blade.php` (TBD; legacy redirects to www.fpanalyzer.se)
- `/login` — ✅ Phase 4a
- `/register` & `/register/{slug}` — `frontend/auth/choose_price_plan.blade.php`, `register.blade.php`
- `/account/confirm/{token}` — `frontend/auth/emails/confirm-account.blade.php`
- `/password/reset` & `/password/email` — `frontend/auth/passwords/{email,reset}.blade.php`
- `/faq` — CMS-driven; renders MDX or HTML from `cms.slug='faq'`
- `/privacy_policy`, `/terms_conditions`, `/roi-kalkyl` — CMS-driven
- `/{slug}` — generic CMS catch-all

### UserShell (15 screens)
- `/dashboard` — `frontend/user/dashboard.blade.php` (Phase 4 already has a placeholder; Phase 4b polishes)
- `/myresult` — `frontend/user/myresult/index.blade.php`
- `/myresult/production_data` / `scrap_data` / `stop_data` / `unregistered_stop` / `warning_log`
- `/myresult/formResultProduction/[[...id]]` (and scrap/stop variants) — `frontend/user/myresult/form_*.blade.php`
- `/analyzer/[[...id]]` — `frontend/flow_analyzer/flow_analyzer.blade.php` (HighCharts heavy)
- `/monitor/[[...id]]` — ✅ Phase 4a
- `/units` — `frontend/units/index.blade.php`
- `/machines` & `/machines/{id}` — `frontend/machine/{index,view}.blade.php`
- `/orders` — `backend/orders/orders.blade.php` (shared)
- `/boards/[[...id]]` — `backend/board/showDashboard.blade.php`
- `/feedback` — `frontend/feedback/index.blade.php`
- `/profile/edit` — `frontend/user/profile/edit.blade.php`

### AdminShell (~40 screens)
- `/admin` — `backend/dashboard.blade.php`
- `/admin/equipment` (list + tree) — ✅ Phase 4a
- `/admin/equipment/[id]/edit`, `/admin/equipment/new` — `backend/equipments/{add,edit}_equipments.blade.php`
- `/admin/equipment/stop-reasons`, `…/scrap-reasons` — `backend/equipments/{stop,scrap}_reasons.blade.php`
- `/admin/flow-designs` (+ `[id]/edit`) — `backend/flow_designs/`
- `/admin/flow-monitor` & `/admin/flow-analyzer` — `backend/flow_monitor/`, `backend/flow_analyzer/`
- `/admin/loss-model` — `backend/loss_model/`
- `/admin/parts` (+ form) — `backend/parts/`
- `/admin/orders` (+ form) — `backend/orders/`
- `/admin/work-shifts` (+ form) — `backend/work_shifts/`
- `/admin/shift-schedules` (+ form, calendar) — `backend/shift_schedule/`
- `/admin/results/{production,scrap,stop,warning}` — `backend/result/`, `backend/warning_data/`
- `/admin/types` (+ form) — `backend/types/`
- `/admin/machines` (+ form, files) — `backend/machine/`, `backend/machines/`
- `/admin/machine-files`, `/admin/machine-programmes` — `backend/company/programme/`
- `/admin/workstations` — `backend/company/workstation/`
- `/admin/folders` — `backend/folders/`
- `/admin/cms` (+ form) — `backend/cms/`
- `/admin/sliders`, `/admin/testimonials`, `/admin/symbols` — corresponding `backend/` dirs
- `/admin/boards` (creator + list) — `backend/board/`
- `/admin/iot/setup`, `/admin/iot/software`, `/admin/iot/auto-register` — `backend/machine/`
- `/admin/import-export` — `backend/result/import_export.blade.php`
- `/admin/access/users` (+ form, deactivated, deleted) — `backend/access/`
- `/admin/access/roles` (+ form) — `backend/access/roles/`
- `/admin/tenants` — already exists from Phase 4 (will polish to use AdminShell)
- `/admin/feedback` — `backend/feedback/`
- `/admin/profile` — admin variant of profile

Each screen ports under: extract IA from the Blade → reuse already-built shell + AntD components → wire to existing `/api/v1/*` endpoint or stub if backend isn't ready. Estimated 1-3 hours per screen depending on complexity.

---

## 9. Verification

Phase 4a is verified by a human comparing each of the three reference screens
side-by-side with the legacy app:

1. **Login** (`http://localhost:3030/login`) vs legacy `/login`
2. **Equipment** (`http://localhost:3030/admin/equipment`) vs legacy `/admin/equipments`
3. **Flow Monitor** (`http://localhost:3030/monitor`) vs legacy `/monitor`

Things to check:
- Brand colors match (teal primary, dark teal accents).
- Typography looks like the legacy (Lato body, Poppins display).
- Logo + favicon are present.
- Information architecture matches (same blocks, same order).
- Key interactions work (form validation, modals open, table sorts, tree expands).
- Mobile (768px) doesn't break.
- No `console.warn` from `icon-map.ts` (which would mean a missing legacy → AntD mapping the port hit).

Approve or send back specific revisions; **Phase 4b doesn't start until Phase 4a is approved**.
