# Phase 4b — Super Admin Module Port

> **Status:** Steps 1–5 complete. Step 6 (side-by-side screenshots) + Step 7 (final commit) pending. Scope confirmed: Hybrid (port screenshotted screens + Companies/Tenants CRUD + Roles/permission-matrix UI; skip Log Viewer; no Salary Groups UI in this phase).
>
> **Batch 1 (schema gaps 1, 2, 3) — applied 2026-05-09.** Slider.description added; Testimonial gained companyName + title (role kept nullable per operator override 2026-05-09); SiteSetting restructured to (type, varKey, varValue, status) with @@unique([type, varKey]).
>
> **Batch 2 (Gap 5 + new modules + tests) — applied 2026-05-09.** Feedback moved from `tenant_template` to `public` with `tenantId`/snapshots/`visibleToTenant=false` default. New modules: recent-history, roles, social, sliders, testimonials, cms. Extended modules: admin-users (deactivated/deleted/restore/permanent/password/impersonate/resend-confirm), tenants (full CRUD + status + users sub-resource), admin-feedback (refactored to public schema). New common services: HistoryService, FileStorageService (local driver; S3 driver wired but disabled until prod). Permission seed bumped 26 → 29 (added manage-sliders, manage-testimonials, manage-social — Super Admin only, NOT in Company role). JWT extended with optional `impersonator_id` claim; AuthUser exposes `impersonatorId`. POST /auth/impersonate/stop and POST /admin/users/:id/impersonate wired end-to-end.
>
> **Verification:** TypeScript compiles clean (`npx tsc --noEmit`). Backend boots cleanly with all 18 modules registered. Smoke-tested every new endpoint via authenticated curl — all return correct shape. **e2e tests: 2 specs / 12 tests, all passing.**

> **Source of truth:** the 13 screenshots dropped into `/Applications/XAMPP/xamppfiles/htdocs/new_fp/` on 2026-05-09 between 15:22 and 15:25 local time. Filenames are reproduced verbatim.

---

## ⚠️ Scope discrepancy — operator decision required before Step 2

The prompt structures Phase 4b around Companies (Tenants), Users, Roles, Salary Groups, and Permissions as the core Super Admin entities, with screen sets like `(admin)/companies/...`, `(admin)/access/users/...`, `(admin)/access/roles/...`.

The 13 screenshots **do not** show any of:

- Companies list / Companies form / Company detail with tabs
- Roles list / Role create / Role + permission matrix
- Salary Groups list / form
- Permissions UI of any kind
- Users-deactivated / users-deleted dedicated pages

The 13 screenshots **do** show, in order of appearance in the sidebar nav:

1. Administration (Admin Dashboard / Recent History feed)
2. User Management (Active + History tabs; Company Name is a *column*, not a separate page)
3. Social Management (CRUD on social-media links)
4. CMS Management (rich-text content blocks, e.g. "Vara Tjänster")
5. Slider Management (homepage slider CRUD)
6. Testimonials (Testimonial CRUD)
7. Log Viewer (third-party Arcanedev LogViewer 4.7.1 package — its own dark header)
8. Feedback (read-only list of customer feedback)

The User Management page's "Users" split-button dropdown reveals these *implied* sub-screens that are not directly screenshotted but exist as menu items:

- **Create Company** — implies a `/admin/company/create` form route
- **Create User** — implies a `/admin/access/user/create` form route
- **Deactivated Users** — implies a `/admin/access/user/deactivated` list route
- **Deleted Users** — implies a `/admin/access/user/deleted` list route
- **All Users** — current page

Everything else mentioned in the prompt (Roles, Permissions matrix, Salary Groups, dedicated Company detail with tabs, etc.) is **not** evidenced by the screenshots and is **not** implied by any visible button.

Per the prompt's stated rule:

> "Screenshots are the source of truth for which screens exist. Don't add screens not in the screenshots."

…the right thing to do is port what the screenshots show, plus the dropdown-implied sub-screens, and stop. But the prompt's Step 4–5 structure is incompatible with that scope. **Operator must pick one of the three paths in the question at the bottom of this doc before Step 2 begins.**

---

## Step 1 — Screenshot inventory

### Common chrome (visible across screens 1–6, 9, 10, 13)

The Phase 4a `AdminShell` should reproduce this layout:

- **Left sidebar (collapsible):**
  - Brand: `fp analyzer` logo (the same teal/cyan "fp" + grey "analyzer" wordmark)
  - User card: round avatar placeholder + name "Admin FP Analyzer" + green dot + "Online"
  - Nav items, in this order, each with a 16px outline icon:
    1. Administration (page icon)
    2. User Management (user-circle icon)
    3. Social Management (broadcast / share icon)
    4. CMS Management (file-text icon)
    5. Slider Management (image / picture icon, currently *teal-highlighted accent* in screen 9)
    6. Testimonials (chat-bubble icon)
    7. Log Viewer (eye / monitor icon, with right-side caret — collapsible parent)
    8. Feedback (comment icon)
- **Top bar:** burger-toggle icon (left, collapses sidebar), small avatar dropdown (top right). Avatar dropdown content (visible in screen 1): name "Admin FP Analyzer" + role badge "Administrator" + "Logga ut" link. **Locale:** Swedish; UI mixes Swedish chrome (Välkommen tillbaka, Logga ut) with English page titles. The new app must wire each visible string through `next-intl` keys; English defaults are fine for Phase 4b per the spec.
- **Footer:** "Copyright © 2026 FP Analyzer. All Rights Reserved." (left) • "Developed By Flow Process Sweden AB" (right, teal link).
- **Background:** very light grey (#F5F7FA-ish); cards are pure white with a 1px hairline border and a faint shadow.

The Log Viewer pages (screens 11–12) replace the entire AdminShell with a separate dark-blue navbar from the Arcanedev package — see the dedicated entry below.

---

### Screen 1 — Admin Dashboard / Recent History

- **Filename:** `Screenshot 2026-05-09 at 3.22.52 PM.png`
- **Best-guess screen:** Admin landing dashboard ("Adminpanelen") with a Recent History activity feed. Avatar dropdown is open in this shot.
- **Visible URL:** address bar partially obscured; consistent with `https://fpanalyzer.se/admin` or `/admin/dashboard`. Confirm in Step 2 by inspecting `routes/Backend/Dashboard.php` for the index route.
- **UI elements:**
  - Page banner: **"Välkommen tillbaka"** (Welcome back) — Swedish.
  - Page title row: **"Adminpanelen"**, no breadcrumb visible.
  - Section: **"Recent History"** — a vertically scrolling feed.
  - Each feed item is a horizontal card: round avatar (Admin FP Analyzer's user avatar) on the left, sentence text in the middle, relative timestamp ("1 minute ago") on the right.
  - Avatar dropdown popped open in this screenshot, showing: "Admin FP Analyzer" (name) + "Administrator" (role) + "Logga ut" link, plus three small chips that look like locale/social icons.
- **Buttons:**
  - Sidebar burger toggle (collapse / expand sidebar) → no navigation, UI state.
  - Avatar (top right) → opens the dropdown shown.
  - "Logga ut" inside the dropdown → **POST /logout** (Laravel default auth logout).
  - Sidebar nav items → described above; each navigates to that section.
- **Visible data examples:**
  - Verbatim feed copy:
    - "Admin FP Analyzer updated user **Beradetning 2 Bigfa**" (1 minute ago)
    - "Admin FP Analyzer updated user **Mats Larsson**" (1 minute ago) ×2
    - "Admin FP Analyzer changed password for user **Demo Company**" (1 minute ago)
    - "Admin FP Analyzer changed password for user **Demo User**"
    - "Admin FP Analyzer changed password for user **Tomas Ljungstrom**"
    - "Admin FP Analyzer changed password for user **Magnus C**" (×4, three of them are duplicates)
    - "Admin FP Analyzer changed password for user **Susanne Bovells**"
    - "Admin FP Analyzer changed password for user **Mattias Bovells**"
    - "Admin FP Analyzer changed password for user **Emil Bovells**"
- **Variant:** dashboard / list view. Feed is paginated by infinite scroll or "load more" — exact pagination not visible in this screenshot.
- **Implied data model:** an `audit_history` / `history` table with at minimum `(actor_user_id, action_phrase, target_user_id, created_at)`. The legacy app has the `rappasoft/laravel-5-boilerplate` `History` model — confirm in Step 2.

---

### Screen 2 — User Management (Active Users, left columns)

- **Filename:** `Screenshot 2026-05-09 at 3.23.05 PM.png`
- **Best-guess screen:** User Management → Active tab → Active Users list (yajra DataTable). This screen and screens 3, 4, 5 all show the same page in slightly different states (column scroll position; dropdown open/closed).
- **Visible URL:** `https://fpanalyzer.se/admin/access/user` (visible in tab title "User Management" and consistent with the legacy route prefix).
- **UI elements:**
  - Page header: **"User Management"** (left).
  - Top-right action group: **"Users"** (a pill-button — actually a split-button dropdown; opens menu in screens 4–5) + **"History"** chip (toggles tabs).
  - Tabs: **Active** (currently selected, teal underline) | **History**.
  - Card body title: **"Active Users"**.
  - Filter zone (yajra ColReorder): **"Filter By Group"** label + **"Drop group here"** drop target (drag a column header here to group rows by it).
  - Toolbar row above table: **Show [10] entries** dropdown, eye-toggle (column visibility), columns reorder icon, search box (right), green Excel export icon.
  - Table header: **ID | Company Name | Name | E-mail | Roles | Confirmed | Unit Org.** (more columns are off-screen to the right — see screen 3).
  - Per-column filter inputs sit beneath each header with an "[A]" affordance (yajra individual-column filtering; "[A]" likely toggles "use regex / advanced match").
  - Pagination footer: **"Showing 1 to 10 of 215 entries"**, **Summary: [None]** dropdown, **Previous** / **Next** buttons.
  - Below the table: a duplicated **"Recent History"** feed identical in style to Screen 1.
- **Buttons:**
  - **Users** split-button (top-right) → opens dropdown — see screens 4 & 5.
  - **History** chip → switches to the History tab (route probably `?tab=history` or a separate URL fragment).
  - Eye-toggle / column visibility → opens a column-show/hide popover (yajra Buttons extension).
  - Column-reorder icon → enables drag reorder.
  - Excel export → triggers an XLSX download (likely via `maatwebsite/excel`).
  - Per-row action buttons → see screen 3 (cropped here).
- **Visible data examples:**
  - First visible row: ID `(blank)` | Company Name `(blank)` | Name `Beradetning 2 Bigfa` | E-mail `(redacted)@gmail.com` | Roles `(blank)` | Confirmed `Yes` (green tag) | Unit Org. `(cut off)`.
  - Several rows with Roles tag `Company` and Confirmed `Yes` (green).
  - 215 total active users.
- **Variant:** list view (yajra DataTable, server-side paginated).

---

### Screen 3 — User Management (Active Users, right columns + action buttons)

- **Filename:** `Screenshot 2026-05-09 at 3.23.13 PM.png`
- **Best-guess screen:** Same User Management list as Screen 2; the table has been horizontally scrolled (or the viewport widened) so the right-hand columns are visible.
- **Visible URL:** same as Screen 2.
- **UI elements:**
  - Right-hand columns now visible: **E-mail | Roles | Confirmed | Unit Org. | Created | Actions**.
  - Created column: ISO-style timestamps, e.g. `2020-03-04 23:33:55`, `2020-03-09 14:04:35`.
  - Actions column: a horizontal row of **5–6 colored square icon buttons** per row, in this consistent order (left → right):
    1. **Green** square (likely "Login as user" — legacy `loginAs`)
    2. **Blue** square (likely "View" — legacy `viewCompany` / `viewCompanyUser`)
    3. **Yellow / teal** square (likely "Edit" — legacy `editCompanyUser` / Edit user)
    4. **Dark-blue** square (likely "Change password" — legacy `password_match` / `changePassword`)
    5. **Orange** square (likely "Status toggle" — legacy `statusCompanyUser` deactivate)
    6. **Red** square (likely "Delete" — legacy `deleteCompanyUser`)
  - The exact mapping of icon → action must be confirmed in Step 2 by reading the Blade template's action-column partial.
- **Buttons (per row, by colour):** see above. Wire each to the corresponding NestJS endpoint.
- **Visible data examples:** same row set as Screen 2, just with the right-hand columns visible.
- **Variant:** list view.

---

### Screen 4 — User Management with "Users" dropdown open (variant 1)

- **Filename:** `Screenshot 2026-05-09 at 3.23.29 PM.png`
- **Best-guess screen:** Same page as Screen 3, but the **"Users"** split-button dropdown (top-right) is open.
- **Visible URL:** same.
- **UI elements:**
  - Dropdown menu, items in order:
    1. **All Users** → `/admin/access/user`
    2. **Create Company** → `/admin/company/create` (or similar; see Step 2)
    3. **Create User** → `/admin/access/user/create`
    4. **Deactivated Users** → `/admin/access/user/deactivated`
    5. **Deleted Users** → `/admin/access/user/deleted`
- **Buttons:** the 5 dropdown items above. Each is a navigation link.
- **Visible data examples:** dropdown text only.
- **Variant:** list view + open dropdown overlay.
- **Implication for the new app:** these dropdown items dictate which sub-routes must exist. They are the *only* evidence in the screenshot set for the Companies-create flow, the deactivated-users list, and the deleted-users list. We will port these as required pages even though no full screenshot of them is provided.

---

### Screen 5 — User Management with dropdown open (variant 2)

- **Filename:** `Screenshot 2026-05-09 at 3.23.36 PM.png`
- **Best-guess screen:** Same page as Screen 4, dropdown still / again open. Possibly captured a fraction of a second after Screen 4 with one item highlighted on hover.
- **Visible URL:** same.
- **UI elements:** dropdown content effectively identical to Screen 4. Treat as confirming variant — no new info.
- **Buttons:** same 5.
- **Variant:** same as Screen 4.

---

### Screen 6 — Social Management (Active Socials)

- **Filename:** `Screenshot 2026-05-09 at 3.23.48 PM.png`
- **Best-guess screen:** Social Management → Active Socials. Inline-editable list of social-media links.
- **Visible URL:** `https://fpanalyzer.se/admin/social`.
- **UI elements:**
  - Page title: **"Social Management"** with subtitle **"Active Socials"** (lighter weight, smaller).
  - Top-right button: **"Deactive"** (orange, filled) — toggles between Active and Inactive socials lists.
  - Table columns: **ID | Media Name | Link**. No Actions column — each row's URL is itself an editable input (inline edit). Saving is implicit (probably blur or a hidden save key) — confirm in Step 2.
  - 5 rows:
    | ID | Media Name | Link |
    | --- | --- | --- |
    | 1 | Facebook | `https://en-gb.facebook.com/login` |
    | 2 | Twitter | `https://twitter.com/login` |
    | 3 | LinkedIn | `https://www.linkedin.com/company/fp-analyzer` |
    | 4 | Skype | `https://www.skype.com/en/` |
    | 5 | Pinterest | `https://in.pinterest.com/login/?referrer=home_page` |
- **Buttons:**
  - **Deactive** → switches to the inactive-socials view (probably toggles a `?status=inactive` query string or shows a different list).
  - Each link cell is an editable input; submission method TBD in Step 2.
- **Visible data examples:** the 5 rows above.
- **Variant:** list view with inline-edit pattern. **No "+ Add" button** — the social rows are seeded fixtures (Facebook/Twitter/LinkedIn/Skype/Pinterest are the only 5 ever).

---

### Screen 7 — CMS Management (Active Contents, top of page)

- **Filename:** `Screenshot 2026-05-09 at 3.24.12 PM.png`
- **Best-guess screen:** CMS Management → Active Contents → showing a single content row "VARA TJÄNSTER" with rich-text body.
- **Visible URL:** address bar shows `/admin/c…` cropped — most likely `/admin/cms` or `/admin/cms/content`. Confirm in Step 2.
- **UI elements:**
  - Page title: **"Content Management"** (the new app should consider naming this "CMS Management" to match the sidebar — see "intentional differences" later).
  - Subheading: **"Active Contents"**.
  - Table columns: **ID | Title | Content** (no Actions column visible in this screen — possibly off-screen to the right; confirm).
  - Single visible row:
    - **ID:** 1
    - **Title:** "VARA TJÄNSTER"
    - **Content:** a long Swedish rich-text block listing FP Analyzer use-cases as a bullet list — **Produktionstidskoll och Projektledning · VSM – Value Stream Mapping · Produktionskalkyler · Systematiskt förbättringsarbete · Lean · LCP – Life Cycle Profit · VSM – Value Stream Maintenance · Underhåll enligt svensk standard ref: underhållssystem · Six Sigma**, then a follow-up paragraph about brain-trick / production improvement.
- **Buttons:** edit/status/delete actions are likely off-screen right; confirm in Step 2.
- **Visible data examples:** the single content row above.
- **Variant:** list view with rich-text content rendered inline (probably the column shows raw HTML — confirm). The editor on the form view is almost certainly TinyMCE or Trumbowyg (Laravel boilerplate default).

---

### Screen 8 — CMS Management (continuation, scrolled down)

- **Filename:** `Screenshot 2026-05-09 at 3.24.20 PM.png`
- **Best-guess screen:** Same CMS list as Screen 7, scrolled vertically — showing the rest of the "VARA TJÄNSTER" content body, including a hero photo of dashboards on devices.
- **Visible URL:** same as Screen 7.
- **UI elements:** continuation of the same page. The content row contains embedded `<img>` tags (the dashboards-on-devices stock photo) — implies the rich-text editor supports image upload (probably via a `cms_files` table; confirm in Step 2).
- **Buttons:** none new.
- **Visible data examples:** image asset in CMS row.
- **Variant:** list view continuation.

---

### Screen 9 — Slider Management

- **Filename:** `Screenshot 2026-05-09 at 3.24.33 PM.png`
- **Best-guess screen:** Slider Management → Slider list (homepage carousel slides).
- **Visible URL:** `https://fpanalyzer.se/admin/sliders`.
- **UI elements:**
  - Page title: **"Slider Management"**.
  - Subheading: **"Slider list"** (left) + **"+ Add New Slider"** link/button (right, teal text).
  - Table columns: **S.No | Title | Description | Updated | Status | Actions**.
  - 7 rows:
    | S.No | Title | Description | Updated | Status | Actions |
    | --- | --- | --- | --- | --- | --- |
    | 1 | Home Slider Test | Slider one test description | 2017-10-11 06:50:07 | (orange circle — inactive) | (blue pencil — edit) |
    | 2 | Produktionsuppföljning i Molnet | _(empty)_ | 2020-01-28 21:20:14 | (teal play — active) | (edit) |
    | 3 | Test Slide FP | Test Brodtext | 2017-10-11 15:39:15 | (orange — inactive) | (edit) |
    | 4 | FP Analyzer | _(empty)_ | 2018-03-10 15:39:40 | (orange) | (edit) |
    | 5 | Produktionsuppföljning i Molnet | _(empty)_ | 2019-11-10 20:27:56 | (teal) | (edit) |
    | 6 | Hitta Dina Förluster | _(empty)_ | 2019-11-10 20:34:20 | (orange) | (edit) |
    | 7 | Industri 4.0 & IoT | _(empty)_ | 2018-03-27 17:06:19 | (orange) | (edit) |
- **Buttons:**
  - **+ Add New Slider** → likely `/admin/sliders/create`.
  - **Status icon** in each row → click probably toggles active/inactive (legacy `statusSlider`).
  - **Edit pencil** → `/admin/sliders/{id}/edit`.
  - **No Delete button visible** — slider rows can apparently only be edited and deactivated, not deleted. Confirm in Step 2.
- **Visible data examples:** see 7 rows above.
- **Variant:** list view. The status icon doubles as an action button (clicking it toggles status — typical legacy yajra DataTables pattern).

---

### Screen 10 — Testimonials

- **Filename:** `Screenshot 2026-05-09 at 3.24.42 PM.png`
- **Best-guess screen:** Testimonials → Testimonial Content list.
- **Visible URL:** `https://fpanalyzer.se/admin/testimonial` (singular).
- **UI elements:**
  - Page title: **"Content Management"** (sic — same header reused; the *active sidebar item* is "Testimonials" so the page title is presumably wrong in legacy. The new app should set this to **"Testimonials"** for clarity — flag as intentional difference.).
  - Subheading: **"Testimonial Content"**.
  - Right side: **"+ Create Testimonial"** (teal text button).
  - Table columns: **ID | Name | Company Name | Content | Actions**.
  - 1 row:
    - ID `1`, Name `Test` (with a "Photo Not Available" placeholder thumbnail above the name), Company Name `company 1`, Content `Test testimonials`.
    - Actions: 3 buttons — blue pencil (edit), teal play (status toggle?), red ✕ (delete).
- **Buttons:**
  - **+ Create Testimonial** → `/admin/testimonial/create`.
  - **Edit (pencil)** → `/admin/testimonial/{id}/edit`.
  - **Status (play)** → toggles active/inactive.
  - **Delete (red ✕)** → `/admin/testimonial/{id}/delete` in legacy (GET-for-delete) — must become `DELETE /api/v1/admin/testimonials/{id}` with Popconfirm in the new app.
- **Visible data examples:** the 1 row above.
- **Variant:** list view with thumbnails.

---

### Screen 11 — Log Viewer Dashboard (third-party Arcanedev package)

- **Filename:** `Screenshot 2026-05-09 at 3.25.08 PM.png`
- **Best-guess screen:** Log Viewer dashboard. **This is the [Arcanedev LogViewer](https://github.com/ARCANEDEV/LogViewer) Laravel package, version 4.7.1**, embedded inside `/admin/log-viewer`. It does not use the AdminShell — it has its own dark-blue topbar.
- **Visible URL:** `https://fpanalyzer.se/admin/log-viewer`.
- **UI elements:**
  - Top bar (dark blue, full-width): **LogViewer** (logo) | **Dashboard** (icon, current) | **Logs** (icon).
  - Page title: **"Dashboard"**.
  - Donut chart showing log-level distribution (left).
  - 3×3 tile grid (right):
    | Tile | Count | % |
    | --- | --- | --- |
    | All | 10520 | 100 % |
    | Emergency | 0 | 0 % |
    | Alert | 0 | 0 % |
    | Critical | 0 | 0 % |
    | **Error** | **1** | **0.01 %** (highlighted red) |
    | Warning | 0 | 0 % |
    | Notice | 0 | 0 % |
    | **Info** | **10519** | **99.99 %** (highlighted blue) |
    | Debug | 0 | 0 % |
  - Footer: **"LogViewer — version 4.7.1"** (left) • **"Created with ❤ by ARCANEDEV"** (right).
- **Buttons:** Dashboard tab (current), Logs tab → /admin/log-viewer/logs.
- **Visible data examples:** see tile grid.
- **Variant:** dashboard.
- **Port note:** the new stack runs on Node + Postgres, not Laravel + filesystem `storage/logs`. The Arcanedev package cannot be ported as-is. We have three options to discuss in Step 7's "what's intentionally different":
  1. **Skip** — observability lives in Vercel/server logs (Datadog, Sentry, etc.); remove the Log Viewer sidebar item.
  2. **Reimplement** as an in-app log table fed by the NestJS logger (Winston / Pino) writing to a `logs` Postgres table.
  3. **Embed** an existing Node equivalent (e.g. Pino dashboard, OpenObserve, Loki+Grafana behind a proxy).
  Decision deferred to operator.

---

### Screen 12 — Log Viewer / Logs (date list)

- **Filename:** `Screenshot 2026-05-09 at 3.25.16 PM.png`
- **Best-guess screen:** Log Viewer → Logs → list of daily log files with per-level counts.
- **Visible URL:** `https://fpanalyzer.se/admin/log-viewer/logs`.
- **UI elements:**
  - Top bar: same as Screen 11; **Logs** tab is now active.
  - Page title: **"Logs"**.
  - Table columns: **Date | All | Emergency | Alert | Critical | Error | Warning | Notice | Info | Debug | Actions**.
  - Each level is a coloured pill in the header (Emergency=red, Alert=red, Critical=dark-red, Error=red, Warning=orange, Notice=green, Info=blue, Debug=cyan).
  - 14 visible date rows from `2026-05-09` down to `2026-04-21`. Sample row counts:
    - 2026-05-09: All=4, Info=4, others=0.
    - 2026-04-22: All=867, Error=1, Info=866 (this is the row that produced the single Error count on the dashboard).
  - Per-row actions (right): 3 buttons — **🔍 Show** (cyan), **⬇ Download** (green), **🗑 Delete** (red).
- **Buttons:**
  - Show → opens a single-day log detail page.
  - Download → downloads the raw `laravel-YYYY-MM-DD.log` file.
  - Delete → deletes that day's log file.
- **Visible data examples:** see above.
- **Variant:** list view.
- **Port note:** see Screen 11 — this whole sub-app inherits the same decision.

---

### Screen 13 — Feedback

- **Filename:** `Screenshot 2026-05-09 at 3.25.24 PM.png`
- **Best-guess screen:** Feedback → List (read-only customer feedback log).
- **Visible URL:** `https://fpanalyzer.se/feedback`. **Note:** this is `/feedback` *not* `/admin/feedback` — the legacy route lives at the top level. The new app should mount this under `(admin)/feedback` so the AdminShell wraps it; flag as intentional difference.
- **UI elements:**
  - Page title: **"Feedback"** with subheading **"List"**.
  - Filter zone: **"Filter By Group"** + **"Drop group here"** (yajra DataTables ColReorder grouping).
  - Toolbar: **Show [50] entries**, eye-toggle, columns-reorder icon, **Search:** input (right), green Excel export icon.
  - Table columns: **S.No | Date | Feedback | Company name | User | Actions**.
  - 4 rows:
    | S.No | Date | Feedback | Company name | User | Actions |
    | --- | --- | --- | --- | --- | --- |
    | 5 | 2020-02-06 12:10:35 | "krångligt när man ska skri va vad man har åtgärdat. 711 Kommer till någon k odsica." | Rekordverken AB | _(empty)_ | 🔍 ✕ |
    | 4 | 2019-11-03 14:58:15 | "Ska 'användare' verkilge nå lämna feedback? ka nske endast admin elle r??" | Stolkompaniet AB 12 | _(empty)_ | 🔍 ✕ |
    | 2 | 2019-09-23 19:36:48 | "Nice! Good work :-)" | Cidan Machinery AB | Cidan Machinery AB | 🔍 ✕ |
    | 1 | 2019-09-21 02:28:35 | "test feedback" | Livetest | Livetest | 🔍 ✕ |
  - Per-column filter inputs with **[A]** affordance.
  - Pagination: **Showing 1 to 4 of 4 entries**, **Previous** / **1** / **Next**.
- **Buttons:**
  - **🔍 Show / View (cyan)** → opens a feedback detail (probably a modal showing the full text, since it can be truncated in the list).
  - **✕ Delete (red)** → deletes that feedback row.
  - **Excel** → downloads the table as XLSX.
- **Visible data examples:** see above. Note S.No `3` is missing (deleted) — confirms soft-delete or hard-delete is in use.
- **Variant:** list view (read-only feedback).

---

## Summary table — screens identified

| # | Filename | Screen | URL | Variant | Implied sub-routes |
| --- | --- | --- | --- | --- | --- |
| 1 | 3.22.52 PM | Admin Dashboard / Recent History | `/admin` (or `/admin/dashboard`) | dashboard | — |
| 2 | 3.23.05 PM | User Management — Active Users (left cols) | `/admin/access/user` | list | — |
| 3 | 3.23.13 PM | User Management — Active Users (right cols, action buttons) | `/admin/access/user` | list | row actions: View, Edit, Login-as, Change-password, Status-toggle, Delete |
| 4 | 3.23.29 PM | User Management — Users dropdown open (var. 1) | `/admin/access/user` | list+overlay | All Users · Create Company · Create User · Deactivated Users · Deleted Users |
| 5 | 3.23.36 PM | User Management — Users dropdown open (var. 2) | `/admin/access/user` | list+overlay | (same as #4) |
| 6 | 3.23.48 PM | Social Management | `/admin/social` | list+inline-edit | — |
| 7 | 3.24.12 PM | CMS Management — top | `/admin/cms` (TBC) | list | — |
| 8 | 3.24.20 PM | CMS Management — scrolled | (same) | list (continued) | — |
| 9 | 3.24.33 PM | Slider Management | `/admin/sliders` | list | + Add New Slider · Edit · Status |
| 10 | 3.24.42 PM | Testimonials | `/admin/testimonial` | list | + Create Testimonial · Edit · Status · Delete |
| 11 | 3.25.08 PM | Log Viewer — Dashboard (3rd-party) | `/admin/log-viewer` | dashboard | — (Arcanedev package) |
| 12 | 3.25.16 PM | Log Viewer — Logs | `/admin/log-viewer/logs` | list | Show · Download · Delete |
| 13 | 3.25.24 PM | Feedback | `/feedback` | list | View · Delete · Excel |

---

## What the screenshots are *silent on* (do not appear)

- Companies (tenants) — list, create form, detail with tabs, edit, salary-groups sub-tab. **Only "Create Company" as a dropdown menu item is evidence Companies CRUD exists in legacy.**
- Roles — list, create, edit + permission matrix. **No screenshot, no menu item, no sidebar entry. Likely hard-coded in legacy or managed via DB seeds only.**
- Permissions UI — none.
- Salary Groups — none.
- Users → Create User form, Edit User form, Change-password form. (Implied by row action buttons + dropdown menu items.)
- Users → Deactivated / Deleted list pages. (Implied by dropdown menu.)
- Login-as confirmation flow — implied by the green action button.
- Profile / "My Account" page for the Super Admin themself — none.
- Settings / preferences / language switcher — none (sidebar shows a Swedish UI but no toggle visible).

---

## Operator decisions — recorded 2026-05-09

| Question | Choice |
| --- | --- |
| Scope | **Hybrid** — port the 8 screenshotted sidebar pages + dropdown-implied user sub-routes + minimal Companies/Tenants CRUD + Roles/permission-matrix UI. No Salary Groups UI in this phase. |
| Log Viewer (Arcanedev 4.7.1) | **Skip** — drop the sidebar item; observability lives in external tooling. |
| Roles UI | **Yes — minimal Roles + permission matrix** per Phase 0 v2 §4.5. |

---

## Step 2 — Laravel source mapping

Mapped via legacy-code exploration on 2026-05-09. Every screen is grounded in `routes/Backend/Dashboard.php` (1146 LOC), `routes/Backend/Access.php` (66 LOC), and `routes/Frontend/Frontend.php` (feedback only). Controllers consolidate around `app/Http/Controllers/Backend/DashboardController.php` (4400+ LOC monolith) and `app/Http/Controllers/Backend/Access/User/UserController.php`. Repositories live under `app/Repositories/Backend/Access/User/EloquentUserRepository.php`.

> Convention used below: `controller@method (file:line)` and `view: path/to/blade.blade.php`. All "GET-for-delete" routes are flagged because the new app converts them to `DELETE` + `Popconfirm` per Phase 0 v2 §13.

### A — Admin Dashboard / Recent History

- Route: `GET /admin/dashboard` (`routes/Backend/Dashboard.php:4`, name `admin.dashboard`, middleware `admin`).
- Controller: `DashboardController@index` (`DashboardController.php:71-93`). Branches on role: admin → renders `backend.dashboard_admin`; non-admin → renders `backend.dashboard` with KPI report data from `getRepData()` (`:114-169`).
- View: `resources/views/backend/dashboard_admin.blade.php` — calls `{!! history()->render() !!}` at line 20 to emit the recent history feed.
- Helper: `history()` global (`app/helpers.php:35`) → `app('history')` service. Writes via `history()->log($slug, $message, $entity_id, $icon, $class)` from `UserEventListener` (`app/Listeners/Backend/Access/User/UserEventListener.php:20-117` covering create, update, delete, restore, password-changed, deactivated, reactivated, permanently-deleted).
- Models: `App\Models\History\History` (table `history`), `App\Models\History\HistoryType`. Both fully captured in `legacy-schema.json` (see Step 3 — no gap).
- Side effects: the dashboard is read-only. Any sidebar event throughout the app fires events that listeners turn into `history` rows.

### B — User Management list (`/admin/access/user`)

- Route: `GET /admin/access/user` (`routes/Backend/Access.php:19-21`, resource `user.*`, middleware `access.routeNeedsPermission:manage-users` per `:13`). Plus `GET /admin/access/user/deactivated` (`:29`) and `GET /admin/access/user/deleted` (`:30`).
- Controllers:
  - `UserController@index` (`:62-72`) — AJAX pivot calls `get()`; HTML returns `backend.access.index` view.
  - `UserController@get` (`:78-141`) — yajra DataTables JSON; joins `users ⨯ assigned_roles ⨯ roles`; emits per-row HTML action buttons (`:139-141`).
  - `UserController@deactivated` (`:263-266`) → view `backend.access.deactivated`.
  - `UserController@deleted` (`:272-275`) → view `backend.access.deleted`.
- Views: `resources/views/backend/access/{index,deactivated,deleted}.blade.php`.
- Models: `App\Models\Access\User\User` (uses `SoftDeletes`).
- FormRequest: `app/Http/Requests/Backend/Access/User/ManageUserRequest.php` (gates `manage-users`).
- Side effects: none on read (server-side pagination + filtering only).

### C — User Management dropdown destinations

- C1 **All Users** → same as B.
- C2 **Create Company** → "Create Company" actually opens the standard user-create form, but with a different intended role (`Company`). Routes: `GET /admin/access/user/create` + `POST /admin/access/user` (resource). Controller: `UserController@create` (`:148-152`) and `@store` (`:158-171`). Repository: `EloquentUserRepository::create` (`EloquentUserRepository.php:200-280`) — **performs MySQL `CREATE DATABASE` (`:231`), imports template SQL from `API/demoChildDb.sql` (`:259`), writes to two connections (`:263, :266-267`), stores DB credentials in session `login_arr` (`:251-256`).** Per Phase 0 v2 §11.2 this is **replaced** by `TenantsService.provisionFromTemplate()` (Postgres `CREATE SCHEMA` + clone). View: `resources/views/backend/access/create.blade.php`. FormRequest `StoreUserRequest`: `name required`, `email required|email|unique`, `password required|alpha_num|min:6|confirmed`. Fires `UserCreated` event → history.
- C3 **Create User** (under existing company) → `GET /admin/company/useradd` + `POST /admin/company/useradd` (`Dashboard.php:84-85`). Controller: `DashboardController@addCompanyUser` (`:315`) and `@storeCompanyUser` (`:320-386`). Validates email uniqueness on master DB (`:362-367`); writes via `InsertData()` to **both master and tenant DB** (`:370`); assigns role 2 (Company-admin) or 3 (Company-user); sends confirmation mail (`:381-383`). View: `backend/company/add_user.blade.php`. **The dual-write conflicts with Phase 0 v2** — flag in "intentional differences": new app writes user to `public.users` only, attaches via `tenant_users` join, snapshot fields denormalised on tenant rows when needed.
- C4 **Deactivated Users** → `GET /admin/access/user/deactivated`, controller `@deactivated`, view `deactivated.blade.php`.
- C5 **Deleted Users** → `GET /admin/access/user/deleted`, controller `@deleted`, view `deleted.blade.php`.

### D — Per-row user actions (action column on User Management)

| # | Action (legacy) | Route | Controller@method | Repository@method | Side effects |
| --- | --- | --- | --- | --- | --- |
| D1 | View | _(none — Resource excludes `show`)_ | — | — | — |
| D2 | Edit | `GET/PATCH /admin/access/user/{user}` | `UserController@edit / @update` (`:178-200`) | `EloquentUserRepository::update` (`:285-353`) | Fires `UserUpdated` → history |
| D3 | **Login-as** | `GET /admin/access/user/{user}/login-as` (`Access.php:47`) | `UserController@loginAs` (`:320-323`) | `EloquentUserRepository::loginAs` (`:486-539`) | Sets session `admin_user_id`, `admin_user_name`, `temp_user_id`, `login_arr`; switches DB connection; redirects to `frontend.index` |
| D4 | Change password | `GET/POST /admin/access/user/{user}/password/change` (`:48-49`) | `UserController@changePassword / @updatePassword` (`:282-299`) | `EloquentUserRepository::updatePassword` (`:355-371`) | Fires `UserPasswordChanged` → history; bcrypts; dual-DB write |
| D5 | Status toggle | `GET /admin/access/user/{user}/mark/{status}` (`:46`) | `UserController@mark` (`:252-257`) | `EloquentUserRepository::mark` (`:454-479`) | Prevents self-disable; dual-DB write; events commented out (no history) |
| D6 | Delete (soft) | `DELETE /admin/access/user/{user}` (resource `destroy`) | `UserController@destroy` (`:207-216`) | `EloquentUserRepository::destroy` (`:378-395`) | Soft-delete; switches DB; fires `UserDeleted` → history |
| D7 | Restore | `GET /admin/access/user/{deletedUser}/restore` (`:50`) | `UserController@restore` (`:239-244`) | `EloquentUserRepository::restore` (`:433-446`) | `$user->restore()`; fires `UserRestored` → history |
| D8 | Permanent delete | `GET /admin/access/user/{deletedUser}/delete` (`:51`) | `UserController@delete` (`:223-232`) | `EloquentUserRepository::delete` (`:402-426`) | Detaches roles; hard delete; fires `UserPermanentlyDeleted` → history |
| D9 | Resend confirm email | `GET /admin/account/confirm/resend/{user}` (`:53`) | `UserController@resendConfirmationEmail` (`:307-313`) | (delegates to frontend `UserRepository::sendConfirmationEmail`) | Sends email |

**GET-for-delete tally for D7, D8, D9** — convert to `POST` (`/restore`, `/permanent-delete`, `/resend-confirmation`) with confirm-popups in the new app.

**Login-as port note (D3):** new app issues a Super-Admin-signed JWT for the target user, encoding the original Super Admin's id in an `impersonator_id` claim (per the Phase 4b prompt). No DB connection switch — tenant context comes from the JWT, not session-swap.

### E — Companies CRUD

- E1 **List** — `GET /admin/company`, name `Company`. Controller `DashboardController@getCompany` (`:219-227`) — queries `Users where company_id=0 AND role!=1`; renders `backend.superadmin.company`.
- E2/E3 **Create form / Store** — uses the same User-create flow (C2). The "Create Company" UX is just opening the user form pre-loaded for the Company role.
- E4 **Show / View** — `GET /admin/company/view/{id}`, name `ViewCompany`. Controller `@viewCompany` (`:241-247`) — fetches `CompanyMachine` + tenant users; renders `backend.superadmin.company_view`.
- E7 **Status toggle** — `GET /admin/company/status/{id}`, controller `@statusCompany` (`:229-239`). Direct model save toggling `status`.
- E8 **Destroy** — no explicit route; reuses User soft-delete D6.

### F — Social Management (`/admin/social`)

- Route: `GET /admin/social` (`Dashboard.php:126`, name `Social`). Inline edits POST to `GET /admin/socialupdate` (sic — controller treats the AJAX as POST-equivalent), name `socialUpdate`.
- Controllers: `DashboardController@getSocial` (`:1139-1143`), `@socialUpdate` (`:1145-1165`).
- View: `resources/views/backend/social/social.blade.php`. Inline `<input onchange="UpdateSocial($social->id, this.value)">` (line 44).
- Model: `App\Models\SiteSettings` table `site_settings`, columns `(type='social', var_key, var_value)` plus an active/inactive toggle button at view top.
- Side effects: direct model write; AJAX returns `"true"`/`"false"`; no history.

### G — CMS / Content Management (`/admin/cms`)

- Routes (`Dashboard.php:113-123`):
  - `GET /admin/cms` → `@getCms` (`:960-964`) → view `backend.cms.cms`.
  - `GET /admin/cms/add` → `@addCms` (`:966-969`) → view `backend.cms.add`.
  - `POST /admin/cms/add` → `@storeCms` (`:971-994`) — `slug required|unique`, `title required`, `content required`. Inserts via `InsertDataNew()`.
  - `GET /admin/cms/edit/{id}` → `@editCms` (`:996-1000`) → view `backend.cms.edit`.
  - `POST /admin/cms/update` → `@updateCms` (`:1002-1021`) — same validation; `UpdateData()`.
  - `GET /admin/cms/status/{id}` → `@statusCms` (`:1023-1033`) — toggles `status` Y↔N via `ChangeStatus()`.
  - `GET /admin/cms/delete/{id}` → `@deleteCms` (`:1035-1039`) — `DeleteData('cms', $id)`. **GET-for-delete → convert.**
  - `GET/POST /admin/cms/img/{id}`, `GET /admin/cms/img_delete` → image upload/delete via `@getCmsImage / @postCmsImage / @deleteCmsImage` (`:898-916, :883`).
- Model: `Cms` table with `id, company_id, slug, title, content, status (Y/N), created_at, updated_at`; relation `getCmsImages()` (hasMany `CmsImage` where `status=1`).
- Side effects: file uploads to `public/img/...`; no history events.

### H — Slider Management (`/admin/sliders`)

- Routes (`Dashboard.php:261-268`):
  - `GET /admin/sliders` → `@getSliders` (`:4309-4313`) → view `backend.slider.sliders_list`.
  - `POST /admin/slider/save` → `@postSliderSaveFirst` (`:4345-4402`) — AJAX JSON, validates title uniqueness, uploads image to `public/img/slider/`, inserts row, returns rendered HTML rows.
  - `GET /admin/slider/edit/form` → `@getSliderEditForm` (`:4404-4408`) — AJAX returns slider as JSON.
  - `POST /admin/slider/edit/save` → `@postSliderSave` (`:4409-4472`) — replaces image if uploaded, updates row, returns HTML.
  - `GET /admin/sliders/status/{id}` → `@getSlidersStatus` (`:4315-4332`) — toggles `is_active` Y↔N (raw DB).
  - `GET /admin/sliders/delete/{id}` → `@getSlidersDelete` (`:4333-4344`) — deletes file + DB row. **GET-for-delete → convert.**
- Storage: raw `DB::table('sliders')` queries (no Eloquent model class). Columns inferred: `id, title, description, image, is_active (Y/N), created_at, updated_at`.

### I — Testimonials (`/admin/testimonial`)

- Routes (`Dashboard.php:269-277`):
  - `GET /admin/testimonial` → `@getTestimonial` (`:1042-1046`) → view `backend.testimonial.list`.
  - `GET /admin/testimonial/add` → `@addTestimonial` (`:1048-1051`) → view `backend.testimonial.add`.
  - `POST /admin/testimonial/add` → `@storeTestimonial` (`:1053-1082`) — `company_name required|unique`, `name required`, `content required`. Image upload to `public/img/cms/`. `InsertDataNew()`.
  - `GET /admin/testimonial/edit/{id}` → `@editTestimonial` (`:1084-1088`) → view `backend.testimonial.edit`.
  - `POST /admin/testimonial/update` → `@updateTestimonial` (`:1090-1115`) — note the legacy `unique:testimonials` rule does NOT exclude the current row (legacy bug — flag).
  - `GET /admin/testimonial/status/{id}` → `@statusTestimonial` (`:1118-1128`) — toggles `status` 1↔0.
  - `GET /admin/testimonial/delete/{id}` → `@deleteTestimonial` (`:1130-1134`) — `DeleteData('testimonials', $id)`. **GET-for-delete → convert.**
- Model: `Testimonial` table `testimonials`, columns `id, company_name, title, content, icon (filename), status (1/0), created_at, updated_at`.

### J — Feedback (`/feedback` — top-level)

- Routes (`routes/Frontend/Frontend.php:124-127`):
  - `GET /feedback` → `FeedbackController@feedback` (`:20-31`) — admin role → list view; Company role → `frontend.feedback.form`; else `form2`.
  - AJAX POST to `/feedback` → `@getFeedbackList` (`:33-82`) — DataTables JSON; joins `feedbacks ⨯ users` for company/user names.
  - `POST /feedback/save` → `@saveFeedback` (`:84-105`) — auth user posts `feedback` text; saves to **master DB** via `setAdminDb()`.
  - `GET /feedback/show/{id}` → `@showFeedback` (`:107-125`) → view `frontend.feedback.view` (detail with joins).
  - `GET /feedback/remove/{id}` → `@removeFeedback` (`:127-135`) — soft-delete. **GET-for-delete → convert.**
- Model: `Feedback` table `tbl_feedbacks` (uses `SoftDeletes`), columns `id, feedback, company_id, user_id, created_at, updated_at, deleted_at`. **Connection: `mysql` (master DB) — Feedback is platform-scoped in legacy.** Joins to `users` for snapshot display.

### K — History writes (audit feed sources)

- Helper: `history()->log($slug, $message, $entity_id, $icon, $class)` writes a `history` row tagged with `type_id` from `history_types.name = $slug` (e.g. `'User'`).
- Listeners that emit history:
  - `UserEventListener` (`app/Listeners/Backend/Access/User/UserEventListener.php`) — Created/Updated/Deleted/Restored/PermanentlyDeleted/PasswordChanged/Deactivated/Reactivated.
  - `RoleEventListener` (likely; not yet read — confirm in Step 4 implementation).
- Reading: `history()->render()` in dashboard_admin.blade.php emits HTML; can be reproduced by a NestJS endpoint returning `{ items: [{ icon, class, text, createdAt, actorName, entityId }] }`.

### Audit & permissions summary

- Backend middleware: every `/admin/*` route uses `middleware('admin')` which composes `web` + `auth` + implicit `view-backend` permission. Specific routes layer `access.routeNeedsPermission:<perm>` (`Access.php:13` for `manage-users`, `:62` for `manage-roles`).
- Permissions to mirror in the new app for Phase 4b:
  - `view-backend` — entry to `(admin)/*`.
  - `manage-users` — User Management endpoints.
  - `manage-tenants` — Companies/Tenants CRUD.
  - `manage-roles` — Roles CRUD + permission matrix.
  - `manage-cms`, `manage-sliders`, `manage-testimonials`, `manage-social`, `manage-feedback` — content modules. Phase 0 v2 §4.5 permission inventory will need to add these if absent.

---

## Step 3 — Schema gap analysis

> **STOP-AND-ASK:** several of the columns the legacy controllers read/write are not captured in `legacy-schema.json` (the file lists `cms`, `cms_images`, `sliders`, `testimonials`, `site_settings`, `tbl_feedbacks` only under "tables not directly captured" — column-level detail is absent). Per the prompt's "When to ask me" rule, **adding columns the legacy DB has but legacy-schema.json doesn't capture is a legacy-schema.json defect; flag it.** This Step 3 is the flag.

### What's already correct (no change needed)

| Prisma model | Legacy table | Status |
| --- | --- | --- |
| `User` (`schema.prisma:60-97`) | `users` | All columns captured in legacy-schema.json present. Soft-delete via `deletedAt`. ✓ |
| `Role` (`:103-118`) | `roles` | ✓ — adds `all: bool` super-admin shortcut per §4.5. |
| `Permission` (`:120-133`) | `permissions` | ✓ |
| `RolePermission` (`:135-146`) | `permission_role` | ✓ |
| `UserRole` (`:149-160`) | `assigned_roles` | ✓ |
| `History` (`:187-208`) | `history` | All 9 columns match legacy exactly (`type_id, user_id, entity_id, icon, class, text, assets, created_at, updated_at`). ✓ |
| `HistoryType` (`:174-185`) | `history_types` | ✓ |
| `Tenant` (`:292-310`) | _new — replaces `users.db_*` triple_ | ✓ — Phase 0 v2 first-class entity. |
| `TenantUser` (`:312-330`) | _new — replaces `users.company_id` for membership_ | ✓ |

### Gaps — columns legacy uses but Prisma doesn't have

> Each entry below maps to a screen + a controller line that reads or writes the column. Severity: **HIGH** = the screen breaks without it · **MED** = data lost on re-display · **LOW** = cosmetic.

#### Gap 1 — `Slider.description` — **HIGH**

- **Legacy:** raw `DB::table('sliders')` selects/inserts `description` (`DashboardController.php:4373` insert array, `:4439` update array). Screenshot 9 shows "Slider one test description" and "Test Brodtext" populated for two rows.
- **Prisma (`:247-260`):** `Slider { id, title?, image, link?, status, sortOrder, ... }` — no `description`.
- **Proposed fix:** add `description String? @db.VarChar(1024)` to `Slider` model.

#### Gap 2 — `Testimonial.companyName` and `Testimonial.title` — **HIGH**

- **Legacy:** `testimonials` table columns (per `@storeTestimonial`/`@updateTestimonial` validation): `company_name` (unique), `name`, `title`, `content`, `icon` (filename), `status` (1/0). Screenshot 10 shows "Company Name" as a separate displayed column ("company 1").
- **Prisma (`:262-275`):** `Testimonial { id, name, role?, body, image?, status, sortOrder, ... }` — has `role` (different concept: speaker's job title) and `body` (= legacy `content`), but no `companyName` and no separate `title`.
- **Proposed fix:** add `companyName String @map("company_name") @db.VarChar(255)` and `title String? @db.VarChar(255)`. Decide whether to keep legacy `role` (no legacy column for this — Phase 4a addition?) or drop it. **Recommend dropping `role` since legacy never used it; rename `body` → `content` for clarity, OR keep `body` and treat it as `content`.**

#### Gap 3 — `SiteSetting.{type, key, status}` — **HIGH**

- **Legacy:** `site_settings` columns are `(id, type, var_key, var_value)` — composite identity. Screenshot 6 shows 5 rows with `type='social'` and `var_key in (Facebook, Twitter, LinkedIn, Skype, Pinterest)`. Plus a top-right "Deactive" / "Active" toggle button — implies a per-row OR per-type **status** field.
- **Prisma (`:278-288`):** `SiteSetting { id, key (unique), value? }` — collapsed. No `type`, no `status`.
- **Proposed fix:** either (a) add columns to match legacy `(type, varKey, varValue, status)` exactly OR (b) keep flat `(key, value, status)` and use composite keys like `social.facebook`, with an active flag stored as `social.active = "Y"`. **Recommend (a)** for cleanest mapping and so Social Mgmt can list-by-type cleanly:
  ```prisma
  model SiteSetting {
    id     Int     @id @default(autoincrement())
    type   String  @db.VarChar(64)        // e.g. 'social'
    varKey String  @map("var_key") @db.VarChar(255)  // e.g. 'facebook'
    varValue String? @map("var_value")    // e.g. 'https://...'
    status Boolean @default(true)
    ...
    @@unique([type, varKey])
  }
  ```

#### Gap 4 — `Cms.tenantId` vs. Cms-is-global — **DECISION** (not strictly a gap)

- **Legacy:** `cms` rows have `company_id` and `getCms()` filters by `$this->getUserCompanyId()` (`:961`). Per-tenant CMS content.
- **Prisma (`:211-227`):** `Cms` is platform-scoped (no tenantId) and lives in `public` schema.
- **Resolution:** Phase 0 v2 says CMS is platform-managed (Super Admin sets global content like the marketing site's "Vara Tjänster"). Screenshot 7 supports this — content is generic marketing copy, not tenant-specific. **Keep CMS global; explicitly drop legacy `company_id`.** Document as intentional difference; flag for the Phase 6 data-migration script (will need to either pick one tenant's CMS as canonical, or merge across tenants).

#### Gap 5 — `Feedback` location: `tenant_template` vs `public` — **HIGH (decision)**

- **Legacy:** `tbl_feedbacks` is in master DB (the `mysql` connection set via `setAdminDb()` in `FeedbackController:96`) — i.e. **public/platform-scoped, NOT per-tenant**. Joins to `users` for company/user snapshot.
- **Prisma current state:** `Feedback` model lives in `tenant_template` (`:1464-1481`) — per-tenant. The `admin-feedback/` NestJS module already wraps queries in `prisma.withTenant(tenant.schemaName, ...)`.
- **Conflict:** screenshot 13 shows Super Admin viewing feedback from MULTIPLE companies in one table (rows for "Rekordverken AB", "Stolkompaniet AB 12", "Cidan Machinery AB", "Livetest"). With Feedback per-tenant, Super Admin would have to query each tenant's schema in a loop. With Feedback in public, one query. Legacy uses public.
- **Proposed fix:** **move `Feedback` to `public` schema** with columns `(id, body, tenantId, userId, userEmailSnapshot, userNameSnapshot, tenantNameSnapshot, status, createdAt, updatedAt, deletedAt)`. Keep the existing tenant-template `Feedback` only if the user wants tenant-scoped feedback as well (separate concept from Super-Admin-visible platform feedback). The `admin-feedback/` module pivots from `tenant-table.helpers` to direct Prisma client. **Operator decision required.**

#### Gap 6 — Companies "view" detail page (E4) — **LOW**

- **Legacy:** `viewCompany($id)` joins `CompanyMachine` (machine inventory per company) and lists tenant users. The Companies detail screen (not screenshotted) is a tabbed view: Info / Users / Machines.
- **Prisma:** `Tenant` has `users TenantUser[]` relation; machines live in tenant_template. Building this in the new app is straightforward — no schema change needed.

#### Gap 7 — `Slider.is_active` Y/N → `Slider.status: bool` — **NONE (already done)**

- Prisma already uses `status: Boolean` for Slider, Cms, Testimonial. Y/N normalization happens in the data-migration script (Phase 6).

### Permissions Phase 4b additions

The current `Permission` table content depends on Phase 0 v2 §4.5 inventory and seeds. These permissions must exist (add via Prisma seed if missing — no schema change needed):

- `view-backend` — confirmed in legacy. Backend access gate.
- `manage-users` — confirmed.
- `manage-tenants` — already used by `tenants/` module.
- `manage-roles` — confirmed.
- `manage-cms` — new for this phase.
- `manage-sliders` — new.
- `manage-testimonials` — new.
- `manage-social` — new.
- `manage-feedback` — new.

(Salary-Groups, Equipment, Types, Parts, Scrap-Reasons, Stop-Reasons, Work-Shifts already have permissions in earlier modules — no change here.)

### Schema-gap summary (TL;DR)

| Gap | Action | Severity | Approval | Resolution |
| --- | --- | --- | --- | --- |
| 1. `Slider.description` | Add column | HIGH | ✅ Approved | Add `description String? @db.VarChar(1024)` (Batch 1) |
| 2. `Testimonial.{companyName, title}` + drop `role` | Add columns | HIGH | ✅ Approved | Add `companyName`, `title`; remove unused `role` (Batch 1) |
| 3. `SiteSetting` restructure | Schema change | HIGH | ✅ Approved | Restructure to `(id, type, varKey, varValue, status)` with `@@unique([type, varKey])` (Batch 1) |
| 4. `Cms` global vs per-tenant | Document as intentional | LOW | Implicit (Hybrid scope) | Cms stays platform-scoped (no `tenantId`). Phase 6 migrate picks one tenant's CMS as canonical |
| 5. `Feedback` move to `public` | Move model + add tenantId/snapshots | HIGH | ✅ Approved | Move from `tenant_template` to `public`. **Deferred to Batch 2** — must be atomic with `admin-feedback/` module refactor or build breaks |
| 6. Companies detail tabs | None — pure UI | LOW | n/a | Frontend only |
| 7. Y/N → bool | None — already done | — | — | — |

### Batch 1 deliverables (this commit)

- Prisma schema edits for Gaps 1, 2, 3 → applied via `prisma db push`.
- `Slider.description` added.
- `Testimonial`: `role` removed, `companyName` + `title` added; `body` retained as the legacy `content` value.
- `SiteSetting` restructured to `(type, varKey, varValue, status)` with composite unique key.
- Permission seeds for `manage-cms`, `manage-sliders`, `manage-testimonials`, `manage-social`, `manage-feedback` (added in Batch 2 alongside the modules).

### Batch 2+ deliverables (subsequent commits)

- Move `Feedback` model from `tenant_template` to `public` schema atomically with the `admin-feedback/` module refactor.
- New backend modules: `recent-history/`, `roles/`, `social/`, `cms/`, `sliders/`, `testimonials/`. Extensions to `tenants/`, `admin-users/`.
- Frontend pages per the Step 5 plan above.
- e2e tests for tenant isolation + write paths.
- Side-by-side screenshot capture.

---

## Steps 4–7 — pending operator input on Step 3 schema gaps

Implementation cannot proceed cleanly without resolving Gaps 1-3 and 5. Once approved, the plan is:

**Step 4 (backend) — module-by-module:**

1. Patch Prisma schema for Gaps 1-3 + 5 (one migration, one commit, scoped clearly: `chore(prisma): phase 4b schema fixups for super admin`).
2. Seed missing permissions (Gap §4.5).
3. New module `recent-history/` — read-only `GET /api/v1/admin/history?limit=50` returning the feed shape for the dashboard.
4. Extend `admin-users/` — add the missing endpoints: deactivated list, deleted list, restore, permanent-delete, change-password, login-as (impersonation JWT), resend-confirmation. Replace any GET-for-delete legacy parity with proper REST verbs.
5. Extend `tenants/` — add `PATCH /:id`, `PATCH /:id/status`, `DELETE /:id`, sub-resources `GET /:id/users`, `POST /:id/users`, `DELETE /:id/users/:userId`, plus tenant-isolation e2e test per §13.23.
6. New module `roles/` — `GET /admin/roles`, `:id`, POST/PATCH/DELETE, with permission-set sync.
7. New module `social/` — list, inline-update, status toggle. Read seeded rows only — no create/delete (5 social platforms are fixtures).
8. New module `cms/` — full CRUD with rich-text + image upload (uploads land in `public/cms/<filename>`; need an upload endpoint or a Vercel Blob path).
9. New module `sliders/` — full CRUD with image upload to `public/slider/`.
10. New module `testimonials/` — full CRUD with image upload to `public/testimonials/` (or reuse `public/cms/`).
11. Refactor `admin-feedback/` from tenant-scoped to platform-scoped (per Gap 5).
12. Audit emit: every write hits `recent-history` via the `writeHistory()` helper already in `admin-users/`.
13. e2e tests per controller method.

**Step 5 (frontend) — page-by-page in this order:**

1. Update sidebar (`AdminShell.tsx` SIDEBAR const) — drop "Symbols" / Log-Viewer; rename items to match screenshots; reorder to mirror legacy.
2. `/admin/admin/page.tsx` — Recent History feed dashboard (replaces the current KPI/charts placeholder for the Super Admin variant; existing version stays for tenant-admin).
3. `/admin/admin/access/users/page.tsx` — already exists; finish: Active/History tabs, split-button "Users" dropdown (All/Create-Company/Create-User/Deactivated/Deleted), 6-button action column, Excel export, server-side pagination.
4. `/admin/admin/access/users/new/page.tsx`, `[id]/edit`, `[id]/password`, `deactivated`, `deleted`.
5. `/admin/admin/tenants/...` — already partially done; extend: detail page with tabs (Info / Users), plus the dedicated "Create Company" flow linked from User Management dropdown.
6. `/admin/admin/access/roles/page.tsx`, `new`, `[id]/edit` (permission matrix UI per Phase 0 v2 §4.5).
7. `/admin/admin/social/page.tsx` — inline-edit list, per-row save, toggle.
8. `/admin/admin/cms/page.tsx`, `new`, `[id]/edit` — rich-text editor (TipTap or AntD's Mentions/Editor depending on dep policy; default to TipTap given AntD has no first-class rich-text).
9. `/admin/admin/sliders/page.tsx`, `new`, `[id]/edit` — image upload + status toggle.
10. `/admin/admin/testimonials/page.tsx`, `new`, `[id]/edit`.
11. `/admin/admin/feedback/page.tsx`, `[id]` — list + detail modal.

**Step 6 (verification):**
- Stand up legacy on :80 (XAMPP) and new on :3030. Capture before/after screenshot pairs into `new_fp/screenshots-after/` named by feature. ~15 image pairs.

**Step 7 (commit + finalize doc):**
- Update this doc with the endpoint list, page list, and visual-diff notes.
- Single commit `feat(phase 4b): super admin module — tenants, users, roles, content modules end-to-end`.

---

## Appendices

### A.1 — Endpoints created/extended in Batch 2 (2026-05-09)

All paths are mounted under the `/api/v1` global prefix.

#### auth (extended)
| Verb | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | /auth/impersonate/stop | any auth | 400 if current token has no `impersonator_id` claim. Issues fresh Super Admin JWT, no re-login. Audits to `public.history`. |

#### admin/users (extended)
| Verb | Path | Permission | Notes |
| --- | --- | --- | --- |
| GET | /admin/users/deactivated | manage-users | Active=false (status=0, not soft-deleted) in current tenant. |
| GET | /admin/users/deleted | manage-users | Soft-deleted users (deletedAt!=null) once a tenant member. |
| POST | /admin/users/:id/password | manage-users | Admin-set, no current-password challenge. Audits. |
| POST | /admin/users/:id/restore | manage-users | Restore soft-deleted user + reactivate tenant membership. |
| DELETE | /admin/users/:id/permanent | manage-users | Hard delete previously soft-deleted user; refuses self. |
| POST | /admin/users/:id/confirm/resend | manage-users | Regenerates `confirmation_code`, audits. (Mail dispatch pending). |
| POST | /admin/users/:id/impersonate | impersonate-users + Roles('Administrator') | Issues impersonation JWT (sub=target, impersonator_id=actor). Refuses to impersonate Administrators. Sets cookie. Audits BOTH ids. |

#### admin/tenants (extended)
| Verb | Path | Permission | Notes |
| --- | --- | --- | --- |
| GET | /admin/tenants/:id | manage-tenants | Includes `_count.users`. |
| PATCH | /admin/tenants/:id | manage-tenants | name, timezone. |
| PATCH | /admin/tenants/:id/status | manage-tenants | active / suspended / archived. |
| DELETE | /admin/tenants/:id | manage-tenants | Soft-archive (status=archived). Schema NOT dropped — Phase 6 cleanup. |
| GET | /admin/tenants/:id/users | manage-tenants | Members with status=true. |
| POST | /admin/tenants/:id/users | manage-tenants | Add/reactivate by userId; optional roleId. |
| DELETE | /admin/tenants/:id/users/:userId | manage-tenants | Soft removal (status=false). |

#### admin/roles (new)
| Verb | Path | Permission | Notes |
| --- | --- | --- | --- |
| GET | /admin/roles | manage-roles | List with permission counts + user counts. |
| GET | /admin/roles/permissions | manage-roles | Full permission inventory (the matrix axis). |
| GET | /admin/roles/:id | manage-roles | Includes the permission name set. |
| POST | /admin/roles | manage-roles | Creates + syncs permissions in one tx. |
| PATCH | /admin/roles/:id | manage-roles | Replaces permission set if `permissions` is sent. |
| DELETE | /admin/roles/:id | manage-roles | Refuses if any user is assigned, or if role is `all=true`. |

#### admin/history (new)
| Verb | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | /admin/history | Roles('Administrator') only | Recent activity feed. Filters: `typeId`, `typeName`, paginated. |

#### admin/social (new)
| Verb | Path | Permission | Notes |
| --- | --- | --- | --- |
| GET | /admin/social | manage-social | Lists `type='social'` rows. |
| GET | /admin/social/:id | manage-social | |
| POST | /admin/social | manage-social | Add new platform row. |
| PATCH | /admin/social/:id | manage-social | URL or status toggle. |

#### admin/sliders (new)
| Verb | Path | Permission | Notes |
| --- | --- | --- | --- |
| GET | /admin/sliders | manage-sliders | Paginated list. |
| GET | /admin/sliders/:id | manage-sliders | |
| POST | /admin/sliders | manage-sliders | multipart/form-data; "image" field required + metadata fields. |
| PATCH | /admin/sliders/:id | manage-sliders | Metadata only. |
| POST | /admin/sliders/:id/image | manage-sliders | Replace image (multipart). |
| DELETE | /admin/sliders/:id | manage-sliders | Hard delete row; image left in storage for lifecycle cleanup. |

#### admin/testimonials (new)
| Verb | Path | Permission | Notes |
| --- | --- | --- | --- |
| GET | /admin/testimonials | manage-testimonials | |
| GET | /admin/testimonials/:id | manage-testimonials | |
| POST | /admin/testimonials | manage-testimonials | Image optional. |
| PATCH | /admin/testimonials/:id | manage-testimonials | |
| POST | /admin/testimonials/:id/image | manage-testimonials | Replace image. |
| DELETE | /admin/testimonials/:id | manage-testimonials | |

#### admin/cms (new)
| Verb | Path | Permission | Notes |
| --- | --- | --- | --- |
| GET | /admin/cms | manage-cms | Soft-delete aware. |
| GET | /admin/cms/:id | manage-cms | Includes `images`. |
| POST | /admin/cms | manage-cms | slug auto-normalised. |
| PATCH | /admin/cms/:id | manage-cms | |
| DELETE | /admin/cms/:id | manage-cms | Soft delete. |
| GET | /admin/cms/:id/images | manage-cms | |
| POST | /admin/cms/:id/images | manage-cms | multipart/form-data; "image" + optional alt. |
| DELETE | /admin/cms/:id/images/:imageId | manage-cms | Soft delete image. |

#### admin/feedback (refactored to public schema)
| Verb | Path | Permission | Notes |
| --- | --- | --- | --- |
| GET | /admin/feedback | manage-feedback | Admin: all tenants (filter by `tenantId`). Company: own tenant + `visibleToTenant=true`. |
| GET | /admin/feedback/:id | manage-feedback | Admin or matching tenant + visible. |
| POST | /admin/feedback | manage-feedback | Any user with manage-feedback can create; admins may target specific tenantId. Records snapshot fields. |
| PATCH | /admin/feedback/:id | manage-feedback | Admin only (status, body, visibleToTenant). |
| DELETE | /admin/feedback/:id | manage-feedback | Admin only soft-delete. |

### A.2 — Pages created/extended in Step 5 (2026-05-09)

URL convention: `app/(admin)/admin/<section>/page.tsx` → URL `/admin/<section>` (preserves legacy paths per Phase 0 v2 §8).

| URL | File | Status |
| --- | --- | --- |
| `/admin/dashboard` | `app/(admin)/admin/dashboard/page.tsx` | **Extended** — Super Admin variant now shows Recent History feed (legacy parity); tenant-admin variant keeps the KPI + Flow Analyzer dashboard. |
| `/admin/access/users` | `app/(admin)/admin/access/users/page.tsx` | **Extended** — split-button "Users" dropdown (All/Create-Company/Create-User/Deactivated/Deleted), 5-button action column (Edit / Change-pw / Resend-confirm if not confirmed / Login-as / Delete), inline change-password modal, impersonation Popconfirm with explanatory copy. |
| `/admin/access/users/deactivated` | `app/(admin)/admin/access/users/deactivated/page.tsx` | **New** — list of disabled users + one-click Activate. |
| `/admin/access/users/deleted` | `app/(admin)/admin/access/users/deleted/page.tsx` | **New** — soft-deleted users + Restore + Forever (permanent) delete. |
| `/admin/access/roles` | `app/(admin)/admin/access/roles/page.tsx` | **New** — list with permission count + user count; Delete refuses if assigned. |
| `/admin/access/roles/new` | `app/(admin)/admin/access/roles/new/page.tsx` | **New** — create role + assign permissions checklist. |
| `/admin/access/roles/[id]/edit` | `app/(admin)/admin/access/roles/[id]/edit/page.tsx` | **New** — permission matrix grouped by verb (manage/write/view), with Select-all/Clear shortcuts; Administrator role flagged read-only. |
| `/admin/tenants` | `app/(admin)/admin/tenants/page.tsx` | Existing (already implemented earlier). |
| `/admin/social` | `app/(admin)/admin/social/page.tsx` | **New** — inline-edit URLs, status switch per row, "Add platform" modal. |
| `/admin/cms` | `app/(admin)/admin/cms/page.tsx` | **Replaced** — list + create/edit modal with HTML textarea + preview. (Image-upload sub-resource API is wired in `lib/api/cms.ts` for next iteration.) |
| `/admin/sliders` | `app/(admin)/admin/sliders/page.tsx` | **Replaced** — list + create modal (image upload via `useCreateSlider`) + edit modal with replace-image. |
| `/admin/testimonials` | `app/(admin)/admin/testimonials/page.tsx` | **Replaced** — list with thumbnails + create/edit modal with optional image. |
| `/admin/feedback` | `app/(admin)/admin/feedback/page.tsx` | **Replaced** — Super Admin sees all tenants with optional tenant filter; status select inline; Visible-to-tenant switch; Company role gets a read-only-ish view (no edit/delete). |

### A.3 — Frontend infrastructure added

- **`components/admin/ImpersonationBanner.tsx`** — orange persistent banner (mounted at the top of AdminShell content). Reads `me.impersonator` and `me.impersonatorId`; renders only when impersonating. "Stop impersonating" button calls `useStopImpersonation()` → backend issues fresh Super Admin token via Set-Cookie, then redirects back to the Users page.
- **`AdminShell.tsx`** — sidebar refresh: dropped `Symbols` (out of scope), added `Social Management`. Reordered super-admin section to mirror the screenshots: Tenants · Roles · Social · CMS · Sliders · Testimonials.
- **`/me` extended** — exposes `impersonatorId: number | null` and `impersonator: { id, name, email } | null` so the banner can render the original Super Admin's identity.
- **API hooks (lib/api/)** — new files: `recent-history.ts`, `roles.ts`, `social.ts`, `sliders.ts`, `testimonials.ts`, `cms.ts`, `feedback.ts`. Extended: `auth.ts` (impersonate / stop-impersonation), `tenants.ts` (detail / users sub-resource / status / archive), `admin-users.ts` (deactivated / deleted / restore / permanent / change-password / resend-confirmation).
- **`admin-crud.ts`** cleaned up — old `feedbackApi`/`FeedbackRow` types removed (Phase 4b moved Feedback to public schema with a different shape).
- **`DataTablePage<T>` constraint loosened** from `Record<string, unknown>` → `object` so typed AdminUser interfaces work without an awkward index-signature shim.

### A.4 — Verification (Step 5)

- **Frontend `tsc --noEmit`** — clean (no errors after fixes).
- **Backend `tsc --noEmit`** — clean.
- **Backend health** — `GET /api/v1/health` returns `{ status: 'ok', db: ok, redis: ok }`.
- **Frontend `/login`** — returns 200.
- **`/me` smoke** — admin login returns full profile with `impersonatorId: null`; after `POST /admin/users/15/impersonate` the same `/me` returns target user (`id: 15, isAdmin: false, tenantId: 3`) plus the original Super Admin's identity in `impersonator`. After `POST /auth/impersonate/stop` the cookie + `/me` are restored to the admin (`id: 14, tenantId: null`).
- **e2e suite** — `npm run test:e2e --runInBand --forceExit` → **2 specs / 12 tests, all passing.** No regression from Batch 2.

### A.3 — Intentional differences from legacy (so far)

- **Auth model** — JWT (cookie + bearer), not Laravel sessions. `auth/login` sets `access_token` httpOnly cookie.
- **GET-for-delete eliminated** — every legacy `GET /foo/delete/{id}` is now `DELETE /foo/{id}`. Frontend renders Popconfirm.
- **Login-as via impersonation JWT** — no DB connection swap. JWT carries `impersonator_id`; `POST /auth/impersonate/stop` exchanges back. Audit log records both ids on every event during impersonation (text marker `[impersonating X as su=Y] ...`).
- **Tenant DB creation** — `CREATE SCHEMA "tenant_<id>"` + `CREATE TABLE LIKE "tenant_template".T INCLUDING ALL` per table. Replaces legacy MySQL `CREATE DATABASE` + cPanel xmlapi.
- **Feedback platform-scoped** — moved from `tenant_template.feedbacks` to `public.feedbacks`. Carries denormalised `tenantId`/snapshot fields. New `visibleToTenant: false` default flag (Gap 5 extension) lets future enhancements expose individual rows back to the tenant view without another migration.
- **CMS global** — no per-tenant CMS rows; Super Admin manages site-wide content blocks.
- **Log Viewer removed** — observability lives in external tooling.
- **SiteSetting structured** — `(type, varKey, varValue, status)` triplet matches legacy semantics, beats the prior flat `(key, value)` collapse.
- **Testimonial schema** — added `companyName` + `title`; `role` kept nullable per Phase 4b operator override (legacy never populated it; new app may use it for richer testimonial UX).
- **File uploads** — every binary write goes through `FileStorageService` (Phase 0 v2 §1). Local-disk driver in dev (`storage/uploads/`); S3 driver wired but disabled until prod env supplies S3_*.

### A.4 — What's missing / stubbed

- **Resend confirmation email** — `POST /admin/users/:id/confirm/resend` regenerates `confirmation_code` and audits, but the email is NOT actually dispatched yet (TODO Phase 5: NotificationModule + Mailer driver). Returns `{ ok: true, queued: false }` to make the contract explicit.
- **S3 driver** — `FileStorageService` constructor accepts `STORAGE_DRIVER=s3` and validates required env, but `put`/`delete` throw "not implemented". Local driver is fully wired.
- **CmsImage delete from storage** — currently soft-deletes the DB row; underlying file stays in storage. Cleaner approach is a lifecycle worker.
- **Slider delete** — image stays in storage after the DB row is deleted. Same trade-off.
- **Bulk-delete** — not implemented anywhere; the legacy app has none either (cosmetic checkboxes only). Frontend will iterate single DELETE calls.
- **Phase 6 data migration** — separate effort. CMS row picker (Gap 4) deferred to that script: it queries each legacy tenant DB for `SELECT COUNT(*), tenant_db_name FROM cms` grouped by db; if exactly one populates it, those rows become canonical for `public.cms`; if multiple, **the script halts and asks**.

### A.5 — Test coverage

- **`test/impersonation.e2e-spec.ts`** — 7 tests covering admin login → impersonate (token shape verified including `impersonator_id` claim) → audit log check → refusing to impersonate Administrators → stop-impersonation cookie swap → 400 from stop on non-impersonation token.
- **`test/tenant-isolation.e2e-spec.ts`** — 5 tests covering admin filter by `X-Tenant-Id`, Company user blocked from cross-tenant header, Company user defaults to own tenant, admin feedback `?tenantId=N` filter.
- **All 12 tests pass** under `npm run test:e2e --runInBand --forceExit` inside the backend container.

---

## Phase 4b — Batch 2: Backend Modules (D1–D6)

### B2.1 — New Screenshot Inventory

| Screenshot | Timestamp | Content |
|---|---|---|
| `Screenshot 2026-05-11 at 12.34.33 PM.png` | 2026-05-11 | Users dropdown (All Users / Create Company User / Create User / Deactivated / Deleted) |
| `Screenshot 2026-05-11 at 12.34.41 PM.png` | 2026-05-11 | Create User form (Company Information section: name, email, password, session_timeout, status, confirmed, send_confirmation_email, roles[], unit_only) |
| `Screenshot 2026-05-11 at 12.34.55 PM.png` | 2026-05-11 | Roles dropdown (All Roles / Create Role) |

Confirmed sub-routes from screenshots: `/admin/access/role` (All Roles list) and `/admin/access/role/create` (Create Role form).

---

### B2.2 — Intentional Differences from Legacy Workflow Report

| # | Legacy says | New app does | Why |
|---|---|---|---|
| A1 | Dual-write to master + company DB on every users/assigned_roles write | Single write to `public.users`, `public.user_roles`. No tenant-DB write for these tables. | Phase 0 v2 §13.2 dropped dual-write; users/roles/user_roles live in public schema only per §11.3. |
| A2 | DB credentials (db_name, db_username, db_password) stored on User row | No such columns. Tenant membership + schema live on Tenant + TenantUser. | Phase 0 v2 §4.3: Tenant is a first-class entity. These columns do not exist in Prisma; not added. |
| A3 | Create User form asks for Host/DB Name/Username/Password | Create User form has NO DB fields. Tenant is auto-provisioned server-side from tenant name when role=Company. | New tenant model uses `CREATE SCHEMA tenant_<id>` — no per-tenant credentials exist. |
| A4 | Run API/demoChildDb.sql against new DB to seed it | `TenantsService.create()` runs `CREATE SCHEMA` + `CREATE TABLE … LIKE … INCLUDING ALL` from `tenant_template` + INSERT for seeded reference data. | Phase 0 v2 §11.2. cPanel/MySQL provisioning fully replaced. |
| A5 | login_arr session: db_name, db_username, db_password, session_timeout | No session. No login_arr. No DB credentials outside env var. Tenant context from JWT `tenantId` claim. `session_timeout` accepted in DTO but not persisted (column dropped per §13.3). | Phase 0 v2 §1, A4. |
| A6 | loginAs switches Config::default to companysql with user's DB credentials | Impersonation issues a fresh JWT for target user with `impersonator_id` claim. No DB connection swap. Frontend shows persistent "Logged in as X" banner. | Phase 4b + Phase 0 v2. Security-critical. |
| A7 | Role assignment fixed at creation — edit form cannot change role | Edit form CAN change roles (`roles[]` array in UpdateUserDto). | Phase 0 v2 §13.10 — roles/permissions are runtime-editable. |
| A8 | unit_only propagates to all sub-users with company_id | unit_only is a property on TenantUser, set per (user, tenant) pair. No implicit cascade. | Phase 0 v2: tenant membership replaces company_id. |
| A9 | GET /restore, GET /permanent-delete, GET /resend-confirmation | POST /restore, DELETE /:id?permanent=true, POST /:id/confirm/resend — all state-changing ops are POST/PATCH/DELETE. | Phase 0 v2 §13.5. |
| A10 | Administrator (role_id=1) is NEVER deleted or modified | Administrator role: `all=true` forced on update, permissions sync skipped, delete returns 403. Admin cannot deactivate/delete/demote self. | Defensive, kept all three self-protection rules. |
| A11 | InsertDataN / UpdateData / DeleteData / ChangeStatus helpers | No such helpers. Services write through Prisma directly. | Phase 0 v2 §7 explicitly drops these. |
| A12 | CopyBasicData clones types, equipment, etc. into new tenant DB | `TenantsService.provisionSchema()` clones from `tenant_template` via `CREATE TABLE LIKE … INCLUDING ALL`. Same outcome. | Phase 0 v2 §11.2 step 4. |
| A13 | first_name set to name on create, last_name empty string, image empty string | `firstName` defaults to `dto.name` on create (A13 parity). `lastName` defaults to `''`. `image` defaults to `''`. | Legacy parity for the three fields that exist in Prisma schema. |
| A14 | confirmation_code = md5(uniqid) | `confirmation_code = randomBytes(24).toString('hex')` (48-char hex, CSPRNG). | md5 is cryptographically broken. |
| A15 | bcrypt(password) | bcrypt via bcryptjs at cost 12. Legacy scrypt passwords auto-rehash on first login. Consistent with existing auth module. | Stays consistent; no mixed hash types per-user. |

---

### B2.3 — Endpoint Inventory (D1–D5)

All endpoints under `/api/v1`, all guarded by `JwtAuthGuard + Administrator role + relevant permission`.

#### D1 — Admin Users (`/api/v1/admin/users`)

| Method | Path | Description |
|---|---|---|
| GET | `/` | Paginated list with search, sort, 8-operator column filters |
| GET | `/summary` | Column stats (empty / non-empty / distinct counts) per DataTable |
| GET | `/deactivated` | Active=false shortcut |
| GET | `/deleted` | Soft-deleted users |
| GET | `/:id` | Single user with roles + tenant memberships |
| POST | `/` | Create user; if `newTenantName` provided, auto-provisions tenant (D4) |
| PATCH | `/:id` | Update (name, email, status, confirmed, session_timeout accepted/ignored, unit_only, roles[]) |
| DELETE | `/:id` | Soft delete (default) or `?permanent=true` (hard, only if already soft-deleted) |
| DELETE | `/:id/permanent` | Hard delete (legacy compat alias) |
| PATCH | `/:id/status` | Toggle active/inactive — accepts `{ status: 1\|0 }` or `{ active: true\|false }` |
| PATCH | `/:id/confirm` | Toggle confirmed flag |
| POST | `/:id/password` | Admin-initiated password change |
| POST | `/:id/restore` | Restore soft-deleted user |
| POST | `/:id/confirm/resend` | Regenerate confirmation_code (email not yet dispatched — Phase 5) |
| POST | `/:id/impersonate` | Start impersonation; sets impersonation cookie (requires `impersonate-users` permission) |

#### D2 — Roles (`/api/v1/admin/roles`)

| Method | Path | Description |
|---|---|---|
| GET | `/` | List with permission count + user count |
| GET | `/permissions` | All 29 available permissions |
| GET | `/:id` | Single role with permission names |
| POST | `/` | Create role |
| PATCH | `/:id` | Update (name, sort, all, permissions[]); Administrator role: all forced true, permissions ignored |
| DELETE | `/:id` | Delete — blocks if `role.all=true` (403) or has users (409) |

#### D3 — Recent History (`/api/v1/admin/history`)

| Method | Path | Description |
|---|---|---|
| GET | `/` | Cursor-based feed: `?limit=50&before=<ISO>&actor_id=&entity_type=&entity_id=`. Returns `{ items, next_cursor }` |

#### D4 — Tenant co-provisioning (integrated into D1 POST /)

When `dto.newTenantName` is set on `POST /api/v1/admin/users`, the service:
1. Calls `TenantsService.create()` — creates tenant row + provisions schema
2. Creates user + userRole + tenantUser in a separate transaction
3. On failure: explicitly drops schema (`DROP SCHEMA … CASCADE`) + deletes tenant row

#### D5 — Auth extras (`/api/v1/auth`)

| Method | Path | Description |
|---|---|---|
| POST | `/impersonate/stop` | End impersonation; issues fresh Super Admin token via Set-Cookie |
| POST | `/verify-password` | Re-confirm identity — body `{ password }`, returns `{ ok: true }` or 401 |

---

### B2.4 — Schema Gaps Applied in Batch 2

| Gap | Column | Table | Applied |
|---|---|---|---|
| D6 | `impersonator_id INT NULL` | `public.history` | Added to Prisma schema + `prisma db push` executed. Indexed. |

**History semantics change:** `userId` = JWT `sub` (the user whose session acted). When impersonating, `impersonatorId` = original Super Admin's id. Both ids are stored so the history feed shows "Admin acted as User". Previously `userId` was set to the impersonator's id — **this was corrected**.

---

### B2.5 — Report Contradictions Resolved

| Contradiction | Resolution |
|---|---|
| Legacy: `session_timeout` stored in DB | Column dropped per §13.3. Field accepted in DTOs (for legacy UX compat) but not persisted. |
| Legacy: dual-write to company DB on user create | Single write to public schema only. No per-tenant user table. |
| Legacy: role assignment immutable after create | roles[] array in UpdateUserDto; role change is runtime-editable. |
| Legacy: loginAs swaps DB connection | Impersonation JWT only. No connection swap. Audit row written with both userId + impersonatorId. |
| Legacy: GET verbs for state changes (restore/delete) | All state changes use POST/PATCH/DELETE. |
| Legacy: Administrator role exempt from edit/delete | Kept as rule but tightened: `all=true` forced on update, permissions ignored, self-demotion blocked. |

---

### B2.6 — Tenant Isolation Design Decision

Per the e2e test suite (E7):
- **Super Admin** must pass `X-Tenant-Id` header to scope to a specific tenant. Without it, the tenant middleware returns `400 no-tenant-context` (admins are not tenant-bound by JWT).
- **Non-admin users** cannot set `X-Tenant-Id` to another tenant — returns `403 x-tenant-id-admin-only`.
- **Non-admin users** with no `X-Tenant-Id` header get their own tenant automatically from the JWT `tenantId` claim.

---

### B2.7 — e2e Test Results

`npm test` inside the backend container — **7 suites / 38 tests, all passing**.

| Suite | Tests | What it covers |
|---|---|---|
| `users-crud.test.js` | 11 | Full user lifecycle: create → list → get → update → soft-delete → restore → hard-delete |
| `self-protection.test.js` | 5 | Cannot deactivate self, delete self, demote self from Administrator |
| `impersonation.test.js` | 5 | Start → audit (both ids) → refuse admin impersonation → stop → 400 on non-impersonation token |
| `roles-crud.test.js` | 8 | Create → update permissions → list (user count) → cannot delete Administrator → cannot delete role with users → reassign → delete |
| `tenant-provision.test.js` | 2 | Happy path (schema + membership) + failure path (schema dropped, no orphan tenant/user) |
| `recent-history.test.js` | 2 | 5 actions → ≥5 history rows with correct actor; cursor pagination shape |
| `tenant-isolation.test.js` | 4 | Admin sees t1 vs t2 separately; Company user blocked from cross-tenant header; own-tenant default |
