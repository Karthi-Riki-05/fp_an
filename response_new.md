# FP Analyzer — Complete Expert Analysis Report
**Prepared by: Senior Product Architect & UX Engineer**
**Date: 2026-06-02**
**Stack: Next.js 14 + Express.js + PostgreSQL + Socket.io + MQTT**

---

# PART 1: APPLICATION STRUCTURE ANALYSIS

---

## 1.1 NAVIGATION STRUCTURE

**Pattern:** Nested sidebar (desktop-first, no mobile hamburger adaptation seen)

**Admin Navigation (AdminShell.tsx):**
- Collapsible left sidebar, ~280px wide
- 20+ menu items organized in groups
- Ant Design `<Menu>` with nested `SubMenu` groups
- Top bar with tenant switcher + user avatar dropdown
- No keyboard navigation or breadcrumb trail visible

**User Navigation (AppShell.tsx):**
- Simplified sidebar for operators/users
- ~6 items (Dashboard, Monitor, Analyzer, Equipment, Orders, Units)
- Same Ant Design pattern

**Routing Structure:**

```
/                          → redirect to /admin or /dashboard
/(public)/login            → Login page
/(public)/confirm-email    → Email confirmation
/(admin)/...               → Admin-only, requires Administrator or Company role
/(user)/...                → Operator/User role
```

**Route Groups in Next.js App Router:**
- `(admin)` — ~40 routes
- `(user)` — ~10 routes
- `(public)` — 2 routes

**Role-Based Navigation:**
- `middleware.ts` reads JWT from cookie → determines role → redirects to correct shell
- Admin shell conditionally renders menu items based on `requirePermission()` checks
- No URL-level RBAC guard on every nested route — relies on middleware redirect + API denials

---

## 1.2 MODULE INVENTORY

| Module | What It Does | State | User Role |
|---|---|---|---|
| **Authentication** | JWT login, logout, refresh, email confirm | Fully built | All |
| **User Management** | CRUD users, assign roles, impersonate, deactivate | Fully built | Administrator |
| **Company Management** | Create companies, provision schemas, assign admins | Fully built | Administrator |
| **Roles & Permissions** | Granular 30+ permission matrix, role assignment | Fully built | Administrator |
| **Equipment Tree** | Hierarchical drag-drop tree (factory → line → cell → unit) | Fully built | Admin / Company |
| **Machine Management** | IoT device CRUD, assign to equipment, configure | Mostly built | Admin / Company |
| **IoT Device Setup** | Device tokens, firmware version tracking, MQTT provision | Partially built | Admin |
| **Flow Designer** | Visual diagram editor (draw.io XML), step/event tagging | Fully built | Company Admin |
| **Production Orders** | Order + part CRUD, assign to machines | Mostly built | Company Admin |
| **Shift Management** | Work shifts, schedules, workstations | Schema built, UI partial | Company Admin |
| **Stop Reasons** | Categorized stop reason library | Fully built | Company Admin |
| **Scrap Reasons** | Scrap reason library | Fully built | Company Admin |
| **OEE Types/Symbols** | Classification markers | Fully built | Company Admin |
| **Result Entry (Operator)** | Production, Scrap, Stop, Warning form submission | Fully built | Operator |
| **Monitor View** | Live machine status board (real-time) | Fully built | Operator / Supervisor |
| **Analyzer / Results** | Historical results search, filter, export | Partially built | Supervisor / Manager |
| **Admin Dashboard** | Chart-based OEE overview | Placeholder / Partial | Manager |
| **Board Builder** | Custom dashboard widgets | Schema built, UI unclear | Manager |
| **Boards (Viewer)** | Viewing configured dashboards | Partial | All |
| **Multi-language (i18n)** | EN/SV toggle with next-intl | Partial — hardcoded SV | All |
| **Email Notifications** | SMTP via Office 365 | Fully built (backend) | System |
| **Mobile IoT (Legacy API)** | /api/v1/machine/* compat routes for Flutter mobile | Maintained | IoT Devices |
| **SuperAdmin MQTT Panel** | Monitor MQTT events, test topics | Built (test tool) | SuperAdmin |

**Assessment:** ~60% of modules are fully functional. Shift management and Board Builder are the biggest half-built areas. Analytics/Analyzer is the most underdeveloped user-facing module.

---

## 1.3 PAGE & SCREEN INVENTORY

### Admin Pages (~40 routes)

| Screen | Route | Purpose | Key Components | Data |
|---|---|---|---|---|
| Admin Dashboard | /admin | Overview charts + KPIs | KPI cards, bar charts | OEE%, downtime, production count |
| Companies | /admin/companies | Company list + CRUD | Table, create modal | Company list |
| Create Company | /admin/companies/new | New tenant provisioning | Wizard form | Company + schema provisioning |
| Users | /admin/users | All users across tenants | Table, filters | User list |
| User Detail | /admin/users/[id] | Edit user, roles, impersonate | Form, permission matrix | User + permissions |
| Roles | /admin/roles | Role list + CRUD | Table | Role list |
| Role Detail | /admin/roles/[id] | Edit role + permission matrix | Checkbox grid | Permissions |
| Machines | /admin/machines | Machine list | Table + status badges | Machine + IoT status |
| Machine Detail | /admin/machines/[id] | Edit machine, assign equipment | Form + tree picker | Machine + assignments |
| Equipment Tree | /admin/equipment | Drag-drop hierarchy | Tree component + panel | Equipment hierarchy |
| Orders | /admin/orders | Production order CRUD | Table + form | Orders |
| Parts | /admin/parts | Parts library | Table + form | Parts |
| Stop Reasons | /admin/stop-reasons | Stop category + reasons | Tree list + form | Stop classifications |
| Scrap Reasons | /admin/scrap-reasons | Scrap reason library | List + form | Scrap reasons |
| Flow Designs | /admin/flows | Flow diagram list | Card grid | Flow list |
| Flow Editor | /admin/flows/[id] | Draw.io diagram editor | FlowDesignerEditor | XML diagram |
| Boards | /admin/boards | Dashboard board list | Card grid | Board list |
| Board Editor | /admin/boards/[id] | Widget configuration | Widget builder | Dashboard config |
| Results (Admin) | /admin/results | All operator results | Table + filters | Results data |
| IoT Setup | /admin/iot | Device provisioning | Form + token display | IoT config |
| Shifts | /admin/shifts | Shift schedule management | Calendar? Table? | Shift config |
| History / Audit | /admin/history | Activity log | Table + filters | Audit trail |

### User/Operator Pages (~10 routes)

| Screen | Route | Purpose | Key Components | Data |
|---|---|---|---|---|
| User Dashboard | /dashboard | Personal KPIs / overview | Cards, mini charts | Operator's stats |
| Monitor | /monitor | Live machine status board | Status cards (real-time) | Socket machine states |
| Analyzer | /analyzer | Result history + analysis | Filter form + table | Historical results |
| Equipment | /equipment | Equipment tree view | Tree (read-only) | Equipment hierarchy |
| Orders | /orders | Order list + selection | Table | Active orders |
| Units | /units | Unit/cell listing | List | Unit list |
| Result Entry | /result/[machineId] | Submit production/scrap/stop/warning | Multi-step form | Form submission |

### Public Pages (2)

| Screen | Route | Purpose |
|---|---|---|
| Login | /login | JWT auth entry point |
| Confirm Email | /confirm-email | OTP-based email verification |

---

## 1.4 COMPONENT LIBRARY

### Layout Components
- `AdminShell.tsx` — Master admin layout (sidebar + topbar + content)
- `AppShell.tsx` — Operator layout
- `LocaleSwitcher.tsx` — EN/SV language toggle (hydration-fixed)

### Equipment Components
- `EquipmentTree.tsx` — Drag-drop tree with DnD Kit
- `EquipmentPanel.tsx` — Side panel for selected node details
- `MachineCard.tsx` — Status card for monitor view

### Flow Components
- `FlowDesignerEditor.tsx` — draw.io iframe-based diagram editor
- `FlowEventPanel.tsx` — Tag events on flow steps

### Result Components (Operator)
- `ProductionResultForm.tsx`
- `ScrapResultForm.tsx`
- `StopDataForm.tsx`
- `WarningDataForm.tsx`

### Real-time Providers
- `AdminSocketProvider.tsx` — Socket.io context for admin
- `MachineSocketProvider.tsx` — Machine-specific socket context

### Shared/Utility Components
- Form wrappers (Ant Design Form + Zod validation)
- Status badge/tag components
- Table wrappers with pagination
- Modal wrappers

### Charts
- **Ant Design Charts (G2/AntV)** — Bar charts, line charts, KPI cards
- No dedicated charting library beyond Ant Design's built-in charts

### Notifications/Alerts
- Ant Design `message` API (toast-style) — used for success/error
- Ant Design `notification` API — for real-time socket events
- No persistent notification center or bell icon visible

---

# PART 2: TECHNICAL ARCHITECTURE ANALYSIS

---

## 2.1 FRONTEND STACK

| Concern | Technology | Version | Notes |
|---|---|---|---|
| Framework | Next.js (App Router) | 14.2.10 | Server components + client components mixed |
| UI Library | Ant Design | 5.20.0 | Full component library — no Tailwind |
| State (global) | Zustand | 4.5.5 | 3 stores: machineSocket, adminSocket, myresult |
| Data Fetching | TanStack React Query | 5.x | Cache + mutation management |
| Real-time | Socket.io-client | 4.8.3 | Connected to Express.js Socket server |
| Forms | Ant Design Form + Zod | — | Schema validation at form level |
| i18n | next-intl | — | EN/SV, hardcoded to SV in Phase 1 |
| Testing | Playwright | — | E2E, 14 test suites, 3 browser targets |
| HTTP Client | Axios or fetch | — | Likely custom API wrapper |

**Theme/Styling:**
- Pure Ant Design ThemeConfig (`antd-theme.ts`)
- Design tokens in `tokens.ts`
- Google Fonts: Lato (body) + Poppins (headings)
- No Tailwind CSS in the project
- Global CSS likely minimal — only resets + font imports

---

## 2.2 DATA FLOW

```
IoT Device (MQTT)
    │
    ▼
Mosquitto Broker ──► Backend MQTT Service
                         │
                         ├── Dedup check (mqtt_message_id)
                         ├── Stale guard (60s tolerance)
                         ├── DB write (tenant schema)
                         └── Socket.io emit → Admin/User clients
                                                     │
                                                     ▼
                                          React Query cache invalidation
                                                     │
                                                     ▼
                                              UI re-render
```

**API Endpoints (100+ total):**
```
Auth:        POST /api/v1/auth/login | logout | register
Users:       GET/POST/PUT/DELETE /api/v1/admin/users/:id
Machines:    GET/POST/PUT/DELETE /api/v1/admin/machines/:id
Equipment:   GET/POST/PUT/DELETE /api/v1/equipment/*
Results:     GET/POST/PUT/DELETE /api/v1/admin/results/*
Orders:      GET/POST/PUT/DELETE /api/v1/admin/orders/:id
Flows:       GET/POST/PUT/DELETE /api/v1/admin/flows/:id
Boards:      GET/POST/PUT/DELETE /api/v1/admin/boards/:id
IoT:         POST /api/v1/iot/setup | /firmware | /provision
Mobile compat: /api/v1/machine/* | /api/v1/user/* (legacy)
```

**Real-time Implementation:**
- Socket.io rooms: `tenant:${tenantId}`, `machine:${tenantId}:${machineId}`
- Events: `machine:status:changed`, `machine:stop:started`, `machine:stop:ended`, `resync:snapshot`
- MQTT Phase 1 complete (stop/start/replay topics)
- HTTP routes preserved for backward compatibility with mobile app

**Alert Handling:**
- Ant Design `message.success/error` for form feedback (ephemeral, top-center)
- Ant Design `notification` for socket events
- No persistent alert center, no push notifications to mobile, no email alerts for operators

---

## 2.3 AUTHENTICATION SYSTEM

**Method:** JWT (3 token types)

| Token | TTL | Audience | Storage |
|---|---|---|---|
| Access Token | 15 minutes | Web clients | httpOnly cookie |
| Refresh Token | 7 days | Web clients | httpOnly cookie |
| Device Token | 365 days | IoT devices | Device storage |

**Roles (current):**
1. **Administrator** — SuperAdmin (all=true, cross-tenant)
2. **Company** — Tenant admin (manages own tenant)
3. **User** — Operator/Supervisor (limited to results + monitoring)

**Permission System:**
- 30+ granular permissions (strings like `'view:users'`, `'create:machine'`)
- `requirePermission('name')` middleware on routes
- `requireRole('name')` for coarser role gates
- Impersonation tracking via `History.impersonatorId`

**Login Flow:**
```
POST /api/v1/auth/login
  → verify email + password (bcrypt)
  → check email confirmed
  → check user active
  → sign access + refresh JWTs
  → set httpOnly cookies
  → return user object + permissions
  → frontend middleware redirects to correct shell
```

**Gap:** No MFA, no SSO/SAML, no OAuth provider integration.

---

## 2.4 DATABASE & MODELS

**Architecture:** PostgreSQL 16, Prisma ORM, schema-per-tenant

**Public Schema (15 tables):**
- `User`, `Role`, `Permission`, `RolePermission`
- `Company` (maps to tenant schema name)
- `History` (audit log with impersonation)
- CMS: `Page`, `Section`, `Feedback`

**Tenant Schema (~50 tables per tenant):**

| Domain | Tables |
|---|---|
| Equipment | `Equipment`, `EquipmentType`, `Unit`, `Workstation` |
| Machines | `Machine`, `MachineStatus`, `MachineData` |
| IoT | `MachineIotConfig`, `FirmwareVersion` |
| Results | `ProductionResult`, `ScrapResult`, `StopData`, `WarningData` |
| Classification | `StopReason`, `StopCategory`, `ScrapReason`, `Type`, `Symbol` |
| Orders | `Order`, `OrderItem`, `Part`, `PartMedia` |
| Flows | `FlowDesign`, `FlowFolder`, `FlowEvent` |
| Boards | `Board`, `BoardWidget` |
| Shifts | `WorkShift`, `ShiftSchedule` |
| OEE | `OeeTarget`, `OeeSnapshot` |

**Key Relationships:**
- Equipment → Machine (1:many)
- Machine → MachineData → StopData (IoT event chain)
- Order → Operator entries (ProductionResult, ScrapResult)
- FlowDesign → FlowEvent (diagram step annotations)
- Board → BoardWidget (dashboard composition)

**Multi-tenancy:** `withTenant(tenant, callback)` wraps all queries in the correct Prisma schema client. No row-level security — full schema isolation.

**IoT Data Storage:**
- `MachineData`: Raw stop events (machine_data_id, start_time, end_time, duration)
- `StopData`: Operator-annotated stop records linked to MachineData
- No time-series DB — all in PostgreSQL (partitioning planned for Phase 6)

---

# PART 3: UX & DESIGN ANALYSIS

---

## 3.1 CURRENT DESIGN SYSTEM

**Color Palette:**

| Token | Hex | Usage |
|---|---|---|
| Brand Primary | `#01b9d0` | Buttons, links, active states |
| Brand Deep | `#00768D` | Hover states, dark accents |
| Running | `#00a65a` | Machine running status |
| Idle | `#bfbfbf` | Machine idle |
| Stopped | `#dd4b39` | Machine stopped / critical |
| Warning | `#f39c12` | Warning state |
| Offline | `#999999` | Machine offline |

**Assessment of palette:**
- Cyan primary (`#01b9d0`) is unusual for industrial software — it reads as "consumer tech startup"
- Status colors are well-chosen (traffic light system) — standard industry convention
- No dark mode support despite industrial users often preferring dark dashboards
- Missing: background grays, surface colors, border tokens

**Typography:**
- Body: Lato (Google Fonts) — clean but generic
- Display: Poppins — modern, appropriate for a SaaS product
- Base: 14px — correct for data-dense industrial UI
- Missing: defined heading scale (h1–h6 sizes), line-height tokens

**Spacing:** 8-based grid (4, 8, 16, 24, 32, 48) — correct

**Radii:** 6px base — slightly too round for industrial; 4px would read more serious

**Design Language:** Ant Design 5 default aesthetic with a cyan override. The result is a generic "Chinese SaaS" feel rather than a purposeful industrial brand.

---

## 3.2 CURRENT UI PROBLEMS (BRUTALLY HONEST)

### Critical Problems:

1. **No dashboard on entry** — The admin dashboard appears to be a placeholder. Managers logging in see nothing meaningful. This is the #1 impression screen and it's empty.

2. **Monitor view is the product's heartbeat but likely looks like a list** — A real-time machine status board for a factory floor should be a visual grid of cards. If it's a table, operators can't use it at a glance.

3. **No notification center** — Ephemeral `message.success()` toasts disappear. Operators miss stop events. There's no bell icon, no alert history, no escalation system. For industrial software, this is a dealbreaker.

4. **Cyan primary color is wrong for the market** — Industrial software buyers (VPs of Operations, Plant Managers) expect dark blues, deep teals, or professional grays. `#01b9d0` reads as a FinTech app, not a factory floor tool.

5. **No mobile responsiveness** — The app is desktop-first with no visible mobile adaptation. Operators use tablets and phones on factory floors. Ant Design's responsive breakpoints exist but appear unused.

6. **Sidebar-heavy navigation for operators** — Operators doing quick result entry don't need 20 menu items. Role-appropriate nav simplification is missing.

7. **Form-heavy result entry** — 4 separate form types (Production, Scrap, Stop, Warning) with no guided flow. An operator finishing a shift shouldn't need to navigate between forms — it should be a single wizard.

8. **No OEE score visible** — The primary KPI of any OEE platform (Availability × Performance × Quality) appears nowhere prominent. This is what managers open the app to see.

9. **Equipment tree only shows structure, not status** — The tree should show live machine colors (running/stopped) overlaid on the hierarchy. Currently it's a configuration tool, not an operational view.

10. **Flow Designer is over-engineered for the current user base** — draw.io XML editing is powerful but complex. Most customers will need pre-built templates or a simpler step-based flow builder.

### Moderate Problems:

- No empty states (first-time user sees blank tables with no guidance)
- No loading skeletons — data tables flash in
- Ant Design 5 default form layout is cramped at 14px
- No confirmation dialogs for destructive actions (delete machine wipes IoT history)
- Impersonation UX is likely invisible — no banner saying "You are viewing as [User]"
- No dark mode despite industrial context
- No keyboard shortcuts for power users
- No bulk actions on tables (select all, bulk delete, bulk export)

---

## 3.3 SCREEN-BY-SCREEN CRITIQUE

| Screen | Rating | What Works | What Must Improve | Priority |
|---|---|---|---|---|
| **Login** | 6/10 | Clean, functional | No "Remember me", no password visibility toggle, no MFA, no SSO | Medium |
| **Admin Dashboard** | 2/10 | Exists | Near-empty placeholder — no real OEE KPIs, no actionable data, no drill-down | **Critical** |
| **Monitor View** | 5/10 | Real-time data works | Must be a visual machine grid, not a table. No shift context, no alert escalation | **Critical** |
| **Result Entry (Operator)** | 5/10 | Forms are functional | Must be a single guided wizard. Too many separate navigation steps for 4 result types | **Critical** |
| **Equipment Tree** | 7/10 | Drag-drop is impressive | Needs live status overlay on nodes, no bulk operations | High |
| **Machine Management** | 6/10 | CRUD works | No live machine health view, no firmware status table | High |
| **Analyzer / Results** | 3/10 | Data exists | Missing charts, no time-range selector, no OEE breakdown, no export | **Critical** |
| **Flow Designer** | 5/10 | Powerful (draw.io) | Too complex for end users. Needs templates. No mobile view | High |
| **User Management** | 7/10 | Complete CRUD + impersonation | No bulk invite, no last-login column, no activity indicator | Medium |
| **Roles & Permissions** | 7/10 | Granular system | Matrix UI is confusing — needs grouping by feature area | Medium |
| **Orders / Parts** | 5/10 | Basic CRUD | No production progress tracking, no order-to-result linkage visible | High |
| **Stop Reasons** | 7/10 | Well structured | No usage frequency analytics ("this stop reason was used 47 times this week") | Low |
| **IoT Setup** | 4/10 | Token generation exists | No device health dashboard, no firmware rollout status, no alerts for offline devices | High |
| **Boards / Dashboard Builder** | 2/10 | Schema exists | Appears non-functional — no widget drag-drop, no real preview | **Critical** |
| **Shifts** | 3/10 | Schema exists | UI likely a simple table — no calendar view, no shift-to-results correlation | High |

---

## 3.4 COMPETITOR COMPARISON GAPS

| Feature | Your App | Evocon | MachineMetrics | Tractian |
|---|---|---|---|---|
| **OEE Score visible on entry** | ❌ | ✅ Large, prominent | ✅ Dashboard hero | ✅ AI-scored |
| **Machine status as visual grid** | ❌ (likely table) | ✅ Card grid | ✅ Floor map | ✅ Asset cards |
| **Dark mode / industrial theme** | ❌ | ✅ | ✅ Dark default | ✅ Dark industrial |
| **Mobile operator app** | ❌ | ✅ | ✅ | ✅ |
| **AI-powered anomaly detection** | ❌ | ❌ | Partial | ✅ Core feature |
| **Shift-based OEE breakdown** | ❌ (partial) | ✅ | ✅ | ✅ |
| **Export to PDF/Excel** | ❌ | ✅ | ✅ | ✅ |
| **Custom alert rules** | ❌ | Partial | ✅ | ✅ |
| **SSO/SAML** | ❌ | ✅ | ✅ | ✅ |
| **Multi-site view** | ❌ | ✅ | ✅ | ✅ |
| **API for integrations** | ❌ (no public API) | ✅ | ✅ | ✅ |
| **Onboarding wizard** | ❌ | ✅ | ✅ | ✅ |
| **White-labeling** | ❌ | ❌ | Partial | ❌ |

**Visual Gap Summary:**
- Evocon wins on **simplicity** — their card-based UI takes seconds to understand
- MachineMetrics wins on **data density** — every pixel earns its place
- Tractian wins on **modernity** — dark theme, AI labels, gradient cards
- Your app currently: generic Ant Design table-heavy UI that could be any SaaS product

---

# PART 4: MISSING FEATURES ANALYSIS

---

## 4.1 CRITICAL MISSING FEATURES

### For Operators (Factory Floor)
- [ ] **Guided result entry wizard** — One flow: start production → log output → flag stops → submit
- [ ] **Shift handover screen** — What the previous shift produced, open stops, instructions
- [ ] **Quick-access machine scanner** — QR code → direct result entry for that machine
- [ ] **Offline mode** — Factory WiFi drops. Results must queue locally and sync
- [ ] **Push notifications** — Machine offline alert to operator's phone/tablet

### For Supervisors (Shift Management)
- [ ] **Real-time shift OEE** — Live Availability, Performance, Quality scores for current shift
- [ ] **Stop escalation system** — Stop > 15 min → auto-alert supervisor
- [ ] **Shift comparison view** — This shift vs last shift vs same shift last week
- [ ] **Live headcount view** — Which operator is at which machine right now
- [ ] **Shift notes** — Supervisor can annotate shifts with context

### For Managers (Decision Making)
- [ ] **OEE trend dashboard** — 7-day, 30-day, 90-day OEE with drill-down
- [ ] **Downtime Pareto chart** — Top 5 stop reasons consuming most time
- [ ] **Production vs target tracker** — Order progress in real time
- [ ] **Export to PDF/Excel** — Management reports
- [ ] **Custom date range filtering** — Anywhere in the app
- [ ] **Email/Slack report digests** — Weekly OEE summary to managers

### For Admins (Configuration)
- [ ] **Onboarding wizard** — Step-by-step first-run setup (equipment → machines → shifts → operators)
- [ ] **Bulk user import (CSV)** — Can't invite 50 operators one by one
- [ ] **IoT device health dashboard** — Online/offline/firmware status for all devices
- [ ] **Alert rules engine** — "Notify me when OEE < 70% for 2 consecutive hours"
- [ ] **Data retention settings** — How long to keep raw IoT data

---

## 4.2 HALF-BUILT FEATURES

| Feature | Current State | Gap | Estimated Effort |
|---|---|---|---|
| **Analyzer/Results** | Basic table of results | No OEE calc, no charts, no time-filter, no export | 3–4 weeks |
| **Board Builder** | Schema + route exists | No functional widget UI, no drag-drop builder | 4–6 weeks |
| **Shift Management** | Schema exists | No calendar UI, no shift-result correlation, no OEE per shift | 3–4 weeks |
| **IoT Panel** | Device token generation | No health monitoring, no offline detection, no firmware rollout | 2–3 weeks |
| **i18n** | EN/SV messages exist | Hardcoded to SV, locale routing not implemented | 1 week |
| **Mobile responsiveness** | Breakpoints defined | Not applied to most screens | 2–3 weeks |
| **Notification center** | Ephemeral Ant toasts | No persistent alerts, no read/unread state, no bell icon | 2 weeks |
| **OEE Calculation** | Data exists | No OEE formula applied anywhere visible in UI | 2–3 weeks |
| **Downtime Pareto** | Stop data collected | No aggregation query, no chart | 1 week |

---

## 4.3 GLOBAL READINESS GAPS

| Concern | Current State | Gap | Effort |
|---|---|---|---|
| **Multi-language** | EN + SV messages exist | Locale routing hardcoded, no user language preference saved | 1 week |
| **Timezones** | Not evident in schema | No timezone field on Company or User, timestamps likely UTC-only | 2 weeks |
| **Number formats** | Not implemented | No locale-aware number formatting (1,234.56 vs 1.234,56) | 1 week |
| **Date formats** | Not implemented | DD/MM/YYYY vs MM/DD/YYYY vs ISO not user-configurable | 1 week |
| **Currency** | Not applicable yet | OEE cost-per-downtime will need this | Future |
| **RTL support** | Not implemented | Arabic/Hebrew markets impossible | Future |
| **Data residency** | Single PostgreSQL | EU/US separation not designed | Team-level effort |
| **GDPR compliance** | Partial | Soft-delete exists but no data export, no right-to-erasure flow | 2 weeks |

---

# PART 5: REDESIGN RECOMMENDATIONS

---

## 5.1 DESIGN SYSTEM RECOMMENDATION

### Color Palette — Dark Industrial Theme

```css
/* Primary Brand */
--color-brand:        #0EA5E9;  /* Sky blue — professional, industrial, modern */
--color-brand-deep:   #0369A1;  /* Hover/active */
--color-brand-subtle: #0EA5E91A; /* Background tint */

/* Neutrals (dark theme surfaces) */
--color-bg-base:      #0F172A;  /* Page background */
--color-bg-surface:   #1E293B;  /* Card / panel */
--color-bg-elevated:  #334155;  /* Modal / popover */
--color-border:       #475569;  /* Dividers */
--color-text-primary: #F1F5F9;  /* Headings */
--color-text-secondary: #94A3B8; /* Labels */
--color-text-muted:   #64748B;  /* Placeholders */

/* Status Colors (keep existing — they're correct) */
--color-running:  #22C55E;  /* Slightly brighter green */
--color-idle:     #94A3B8;  /* Neutral gray */
--color-stopped:  #EF4444;  /* Red */
--color-warning:  #F59E0B;  /* Amber */
--color-offline:  #475569;  /* Dark gray */

/* Semantic */
--color-success: #22C55E;
--color-danger:  #EF4444;
--color-info:    #0EA5E9;
```

**Also offer a Light Professional Theme** (for office-based managers):
```css
--color-bg-base:    #F8FAFC;
--color-bg-surface: #FFFFFF;
--color-brand:      #0369A1; /* Darker blue for light bg */
```

### Typography Upgrade

Keep **Poppins** for headings (it's good). Replace **Lato** body with **Inter** — Inter is the industry standard for modern SaaS data apps (Figma, Linear, Vercel all use it).

```css
font-family: 'Inter', -apple-system, sans-serif;  /* body */
font-family: 'Poppins', sans-serif;               /* headings only */
```

### Component Library

**Recommendation: Stay with Ant Design 5 but apply a complete dark ThemeConfig override**

Rationale:
- You already have 40 components built on Ant Design — a migration to shadcn/ui would take 2–3 months
- Ant Design 5's design token system is powerful enough to make it look completely different
- shadcn/ui is better for new greenfield projects, not rewrites at this stage

**When to switch to shadcn/ui:** Phase 2 or when rebuilding for Flutter Web

```typescript
// antd-theme.ts — dark industrial override
const darkTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#0EA5E9',
    colorBgBase: '#0F172A',
    colorBgContainer: '#1E293B',
    borderRadius: 4,          // Less round = more industrial
    fontFamily: 'Inter, -apple-system, sans-serif',
    fontSize: 14,
  }
}
```

### Icon Set

Replace default Ant Design icons with **Lucide React** for non-Ant elements:
- Lucide is clean, consistent, and used by shadcn/ui, Linear, Vercel
- Keep Ant icons where Ant components require them
- No need for a full icon library migration Day 1

---

## 5.2 SCREEN REDESIGN PRIORITY LIST

| Priority | Screen | Why Urgent | What to Change |
|---|---|---|---|
| 1 | **Admin Dashboard** | First impression, currently empty | OEE hero metric, 3 KPI cards, 7-day trend chart, top stop reasons Pareto |
| 2 | **Monitor View** | Core daily-use screen for operators | Visual machine grid (not table), color-coded cards, live stop timer, shift OEE |
| 3 | **Result Entry** | Operator's primary task, done 10x/day | Single wizard flow (not 4 separate forms), large touch targets, mobile-ready |
| 4 | **Analyzer / Results** | How managers judge product value | Time-range picker, OEE breakdown chart, downtime Pareto, export button |
| 5 | **Board Builder** | Promised feature, currently non-functional | Drag-drop widget canvas, 6 widget types, real-time preview |
| 6 | **Login** | First touch — sets brand tone | Dark theme, brand illustration, "Powered by FP Analyzer" tagline |
| 7 | **Shift Management** | Required for OEE accuracy | Calendar view, shift OEE summary, handover notes |
| 8 | **IoT Device Panel** | Required for enterprise sales | Device health grid, online/offline status, firmware table |
| 9 | **User Management** | Friction in onboarding | Bulk invite, CSV import, last-active column |
| 10 | **Equipment Tree** | Good structure, needs status overlay | Live status colors on nodes, utilization % per line |

---

## 5.3 NEW SCREENS TO ADD

### Month 1 (Critical — blocks revenue)

| Screen | Why Needed | Role | Priority |
|---|---|---|---|
| **OEE Dashboard (Redesigned)** | Managers won't buy without this | Manager | Month 1 |
| **Shift OEE View** | Supervisors need shift-level granularity | Supervisor | Month 1 |
| **Notification Center** | Persistent alerts vs ephemeral toasts | All | Month 1 |
| **Onboarding Wizard** | New customers can't self-serve without it | Admin | Month 1 |

### Month 2 (High value — drives retention)

| Screen | Why Needed | Role | Priority |
|---|---|---|---|
| **Downtime Pareto Screen** | Actionable insight managers love | Manager | Month 2 |
| **Machine Health Dashboard** | IoT enterprise feature | Admin | Month 2 |
| **Production vs Target Tracker** | Order management critical for factories | Supervisor | Month 2 |
| **Shift Comparison View** | Weekly performance review | Manager | Month 2 |
| **Export / Reports Center** | Every manager will ask for this on Day 1 | Manager | Month 2 |

### Month 3 (Scale features)

| Screen | Why Needed | Role | Priority |
|---|---|---|---|
| **Alert Rules Engine** | "Notify when OEE < X" | Admin | Month 3 |
| **Multi-Site Dashboard** | Enterprise accounts with multiple factories | Manager | Month 3 |
| **Public API Docs** | ISV/integrator partners | Developer | Month 3 |
| **User Activity Audit** | Enterprise compliance requirement | Admin | Month 3 |
| **Cost-per-Downtime Calculator** | Converts OEE % into money lost | Manager | Month 3 |

---

## 5.4 INFORMATION ARCHITECTURE REDESIGN

### Should navigation be restructured?

**Yes — significantly.** Current structure is flat and tool-organized. It should be task and role-organized.

**Current (tool-centric):**
```
Admin
├── Companies
├── Users
├── Roles
├── Machines
├── Equipment
├── Orders
├── Stop Reasons
├── Scrap Reasons
├── Flow Designs
├── Boards
├── Results
├── IoT Setup
└── History
```

**Recommended (role + task-centric):**

```
[Operations View — Supervisor/Manager]
├── Live Floor (Monitor)
├── OEE Dashboard
├── Shift Overview
├── Downtime Analysis
└── Reports

[Production View — Operator]
├── My Machines
├── Log Results (wizard)
├── My Shift
└── Orders

[Configuration — Admin]
├── Setup Wizard (first run)
├── Equipment & Machines
├── Shifts & Schedules
├── Alerts & Notifications
├── Team
└── IoT Devices

[System — SuperAdmin]
├── Tenants
├── Audit Log
├── Platform Health
└── Firmware
```

### Ideal User Journey Per Role

**Operator (daily flow):**
```
Login → See "My Machines" (2-3 machines) → Tap machine 
→ Log Production Results → Log any stops → End of shift summary → Done
```
Target: under 60 seconds per result entry

**Supervisor (shift flow):**
```
Login → Shift OEE card (current shift) → See any open stops 
→ Check production vs target → End of shift: approve shift summary
```

**Manager (weekly review):**
```
Login → OEE Dashboard (7/30/90 day) → Drill into worst performer 
→ Downtime Pareto → Export PDF report → Done
```

---

# PART 6: FINAL EXPERT SUMMARY

---

## 6.1 OVERALL PRODUCT MATURITY SCORE

| Dimension | Score | Commentary |
|---|---|---|
| **Feature completeness** | 4/10 | Core result collection works. OEE calculation, alerts, exports, mobile — all missing |
| **UI/UX quality** | 3/10 | Generic Ant Design, no industrial identity, tables where cards should be |
| **Technical architecture** | 7/10 | Solid — schema-per-tenant, Socket.io, MQTT, JWT are all correct choices |
| **Global readiness** | 2/10 | Swedish-only by default, no timezone handling, no locale-aware formatting |
| **Mobile readiness** | 1/10 | Not designed for mobile — factory floor operators are stranded |

**Overall Product Maturity: 3.4/10**

The technical foundation is strong. The product layer on top of it is dangerously thin for a commercial launch.

---

## 6.2 TOP 10 PRIORITY ACTIONS

| # | Action | Impact | Effort | Why Now |
|---|---|---|---|---|
| 1 | **Build OEE Dashboard** (real metrics: A×P×Q) | Very High | 2 weeks | Managers won't sign contracts without seeing their OEE score |
| 2 | **Redesign Monitor View** as visual machine grid | Very High | 1 week | Operators judge the product in the first 30 seconds on the floor |
| 3 | **OEE Calculation Engine** in backend | Very High | 1–2 weeks | Nothing on the dashboard works without this formula |
| 4 | **Unified Operator Result Wizard** (1 flow, 4 types) | High | 1.5 weeks | Result entry is the primary daily action — it must be fast and mobile-friendly |
| 5 | **Dark Industrial Theme** (Ant Design ThemeConfig) | High | 3 days | Rebrands the entire product without touching components |
| 6 | **Persistent Notification Center** (bell icon + history) | High | 1 week | Ephemeral toasts lose critical stop events on factory floor |
| 7 | **Downtime Pareto Chart** in Analyzer screen | High | 1 week | Gives managers their #1 actionable insight |
| 8 | **Export to PDF/Excel** (OEE reports + result tables) | High | 1 week | Required for every manager demo and most sales calls |
| 9 | **Onboarding Wizard** (Equipment → Machines → Shifts → Team) | Medium | 1.5 weeks | New tenants currently need manual setup support |
| 10 | **Mobile-responsive Result Entry** (tablet/phone) | Medium | 1.5 weeks | Operators do not sit at desktop computers |

---

## 6.3 EFFORT ESTIMATE (Solo Full-Stack Developer)

### 2 Weeks — Minimum Viable Demo
- Dark industrial theme (3 days)
- OEE calculation engine in backend (4 days)
- OEE Dashboard with real A×P×Q scores (3 days)
- Monitor view as visual machine grid (2 days)

**Outcome:** Product is demo-able to an investor or early customer

---

### 1 Month — Minimum Viable Product
Everything in 2 weeks, plus:
- Unified operator result wizard (mobile-responsive)
- Downtime Pareto chart
- Persistent notification center
- Export to PDF/Excel (basic)
- Fix i18n locale routing

**Outcome:** An operator can do their full daily job. A manager can see value.

---

### 3 Months — Market-Ready V1
Everything in 1 month, plus:
- Shift management (calendar UI + OEE per shift)
- Board builder (drag-drop, 6 widget types)
- Alert rules engine ("notify me when OEE < 70%")
- Onboarding wizard (self-service new tenants)
- IoT device health dashboard
- Bulk user import (CSV)
- Multi-site view for enterprise managers
- Timezone + locale format settings

**Outcome:** Enterprise-demoable, self-serviceable, ready for pilot customers

---

### Requires a Team (Beyond Solo Capacity)
- Mobile app (Flutter) — dedicated mobile developer, 3+ months
- AI anomaly detection — ML engineer, 4–6 months
- Data residency (EU vs US) — DevOps + backend, team effort
- SSO/SAML integration — security-focused developer, 3 weeks
- Public API + developer docs — 4–6 weeks alongside product work
- Automated ML-based predictive maintenance — data science team

---

## 6.4 ONE-LINE VERDICT

> **"This product is currently a promising data-collection backend with a placeholder UI, and needs to become a decision-making OEE platform for factory managers by focusing on the OEE calculation engine and results visualization first — everything else is window dressing until managers can see their 7-day OEE trend on the screen they open every morning."**

---

## APPENDIX: QUICK WINS CHEAT SHEET

These can each be done in under a day and immediately improve perception:

```
[ ] Apply dark Ant Design theme (antd-theme.ts change — 1 hour)
[ ] Add OEE score = "OEE: --%" placeholder card on admin dashboard (2 hours)
[ ] Add machine status color to equipment tree nodes (3 hours)
[ ] Add skeleton loaders to all data tables (4 hours)
[ ] Add empty state illustrations to blank tables (4 hours)
[ ] Add "You are impersonating [User Name]" banner (2 hours)
[ ] Add "Last login" column to users table (1 hour)
[ ] Add device online/offline badge to machines list (2 hours)
[ ] Add confirmation dialog to all delete actions (3 hours)
[ ] Add breadcrumb navigation to all nested admin pages (4 hours)
```

**Total quick wins: ~26 hours of work → product looks 40% more professional**

---

*End of Expert Analysis Report*
*FP Analyzer | v0.1-alpha | Analyzed: 2026-06-02*
