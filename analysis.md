# FP ANALYZER — COMPLETE EXPERT PRODUCT AUDIT

**Analyst:** Senior Product Architect (25 YOE, Industrial SaaS)
**Date:** 2026-06-02
**Codebase:** Next.js 14 + Express.js + PostgreSQL + MQTT

---

## PART 1: APPLICATION STRUCTURE ANALYSIS

---

### 1.1 NAVIGATION STRUCTURE

- **Pattern:** Dual-shell sidebar navigation — `AdminShell.tsx` for admin/company role, `UserShell.tsx` for operators. `PublicShell.tsx` for login.
- **Main sections:** 3 distinct portals — Public (1 screen), User/Operator portal (~12 screens), Admin portal (~40+ screens)
- **Routing:** Next.js 14 App Router with route groups: `(public)/`, `(user)/`, `(admin)/`. Role-detected redirect at `middleware.ts`.
- **Role-based nav:** Middleware reads JWT cookie, routes user to `/admin/*` or `/dashboard` based on role. No client-side navigation guards — backend rejects unauthorized API calls. Frontend conditionally renders admin sections based on decoded role.

> **Critical gap:** There is no supervisor or manager portal — every non-operator goes into the same admin shell. A shift supervisor and a company CEO see the same navigation, which is a UX failure.

---

### 1.2 MODULE INVENTORY

| Module | What It Does | State | Roles |
|--------|-------------|-------|-------|
| **Auth / Login** | Email+password, JWT cookie, email confirm | Fully built | All |
| **Flow Designer** | DrawIO-based visual flow editor, equipment node binding | Fully built | Company/Admin |
| **Flow Monitor** | Real-time node status overlay on flow SVG via Socket.io | Fully built | Company, User |
| **Flow Analyzer** | Historical OEE/production analytics per flow node | Partially built (limited chart types) | Company, User |
| **Equipment Tree** | Hierarchical equipment management with drag-drop | Fully built | Company |
| **Production Entry** | Operator manual production data entry | Fully built | User |
| **Scrap Entry** | Operator scrap/defect recording with photo | Fully built | User |
| **Stop/Downtime Entry** | Machine stop registration with reason codes | Fully built | User |
| **Warning Data** | Warning/notification log for machines | Fully built | User |
| **Unregistered Stops** | IoT-detected stops not yet categorized by operator | Fully built | User |
| **IoT Machine Management** | Register/configure IoT hardware units | Fully built | Company |
| **MQTT Monitor** | Super-admin MQTT broker visualization | Fully built | Admin |
| **Orders** | Production order management | Fully built | Company |
| **Parts Catalog** | Part master data | Fully built | Company |
| **Shift Management** | Work shift + schedule editor with FullCalendar | Fully built | Company |
| **User Management** | Create/deactivate/delete users, assign roles | Fully built | Company |
| **Role Management** | Custom role + granular permission assignment | Fully built | Company/Admin |
| **Boards (Custom Dashboard)** | Drag-drop widget-based dashboards | Partially built (grid layout exists, widget content TBD) | Company, User |
| **Loss Model** | OEE loss category configuration | **Placeholder (ComingSoon.tsx)** | Company |
| **Import/Export** | Data import/export tools | **Placeholder** | Company |
| **Salary Groups** | Operator hourly rate tracking | Fully built | Company |
| **Stop Categories** | Downtime category taxonomy | Fully built | Company |
| **Machine Files/Docs** | Machine manual and document management | Fully built | Company |
| **Machine Programmes** | CNC/machine program file management | Fully built | Company |
| **Symbols** | Custom flow diagram symbols | Fully built | Company |
| **CMS / Sliders / Testimonials / Social** | Marketing website builder embedded in app | Fully built but **misplaced** | Admin |
| **Feedback** | In-app user feedback submission | Fully built | All |
| **Impersonation** | Super-admin becomes any user | Fully built | Admin |
| **Workstations** | Sub-machine workstation registry | Fully built | Company |
| **Types** | Category taxonomy (equipment/parts/orders) | Fully built | Company |
| **Scrap Reasons** | Configurable scrap reason codes | Fully built | Company |
| **Stop Reasons** | Configurable downtime reason codes | Fully built | Company |
| **Profile / Password** | User self-service profile edit | Fully built | All |

**Module count:** ~35 modules. **~28 fully built, 5 partial/placeholder, 2 misplaced** (CMS/marketing embedded in production SaaS)

---

### 1.3 PAGE & SCREEN INVENTORY

#### Public Screens (2)

| Screen | Route | Purpose | Key Components |
|--------|-------|---------|----------------|
| Login | `/login` | Email/password auth | Form, error state |
| Email Confirm | `/account/confirm/[token]` | Token-based email verify | Token decode, success/error |

#### User / Operator Screens (14)

| Screen | Route | Purpose | Key Data |
|--------|-------|---------|----------|
| Dashboard | `/dashboard` | Stats overview | Aggregated KPIs |
| Analyzer | `/analyzer/[[...id]]` | OEE analytics (read-only) | Charts, date filters |
| Monitor | `/monitor/[[...id]]` | Real-time flow status | Live SVG overlay, socket |
| Production Log | `/myresult/production` | Log production qty | Equipment, part, shift, qty |
| Scrap Log | `/myresult/scrap` | Log scrap/defects | Equipment, reason, photo |
| Stop Log | `/myresult/stop` | Log downtime | Equipment, reason, timestamps |
| Warning Log | `/myresult/warning` | View machine warnings | Warning list |
| Unregistered | `/myresult/unregistered` | Categorize IoT stops | IoT raw events |
| Boards | `/boards` | Custom dashboards | Widget grid |
| Machines | `/machines` | Machine list (assigned) | Status, last online |
| Orders | `/orders` | Order list | Order nr, status |
| Units | `/units` | IoT unit view | Connection status |
| Feedback | `/feedback` | Submit feedback | Text form |
| Profile / Password | `/profile/edit`, `/profile/password` | Account management | User fields |

#### Admin Screens (~40)

| Screen | Route | Purpose |
|--------|-------|---------|
| Admin Dashboard | `/admin/dashboard` | Full analytics |
| Flow Designs | `/admin/flow-designs` | Flow CRUD |
| Flow Designer | `/admin/flow-designs/[id]/edit` | DrawIO editor |
| Admin Monitor | `/admin/monitor/[[...id]]` | Live monitoring |
| Admin Analyzer | `/admin/analyzer/[[...id]]` | Analytics |
| Equipment Tree | `/admin/equipment` | Hierarchy CRUD |
| Equipment Tree Editor | `/admin/equipment/tree` | Drag-drop editor |
| Scrap Reasons | `/admin/equipment/scrap-reasons` | Reason codes |
| Stop Reasons | `/admin/equipment/stop-reasons` | Reason codes |
| Users | `/admin/access/users` | User management |
| Roles | `/admin/access/roles` | Role/permission management |
| Salary Groups | `/admin/access/salary-groups` | Pay rate config |
| Boards Admin | `/admin/boards` | Dashboard management |
| Board Creator | `/admin/boards/creator` | Drag-drop builder |
| Graph Widgets | `/admin/boards/graph-widgets` | Widget library |
| Orders | `/admin/orders` | Order management |
| Parts | `/admin/parts` | Parts catalog |
| Types | `/admin/types` | Category management |
| Workstations | `/admin/workstations` | Workstation config |
| Work Shifts | `/admin/work-shifts` | Shift times |
| Shift Schedules | `/admin/shift-schedules` | Calendar schedules |
| Machines | `/admin/machines` | IoT device management |
| Machine Programmes | `/admin/machine-programmes` | CNC files |
| Machine Files | `/admin/machine-files` | Document storage |
| Folders | `/admin/folders` | File organization |
| IoT Setup | `/admin/iot/setup` | Device provisioning |
| IoT Auto-Register | `/admin/iot/auto-register` | Auto-discovery |
| IoT Software | `/admin/iot/software` | Firmware management |
| MQTT Monitor | `/admin/mqtt-monitor/[companyId]` | Broker diagnostics |
| MQTT Testing | `/admin/mqtt-testing` | Broker test console |
| Stop Categories | `/admin/stop-categories` | Downtime taxonomy |
| Symbols | `/admin/symbols` | Flow symbols library |
| Loss Model | `/admin/loss-model` | **PLACEHOLDER** |
| Import/Export | `/admin/import-export` | **PLACEHOLDER** |
| CMS Pages | `/admin/cms` | Marketing content |
| Sliders | `/admin/sliders` | Marketing homepage |
| Testimonials | `/admin/testimonials` | Customer quotes |
| Social Links | `/admin/social` | Social media URLs |
| Feedback | `/admin/feedback` | Feedback management |
| Admin Profile | `/admin/profile` | Admin account |

**Total screens: ~54 across all roles.**

---

### 1.4 COMPONENT LIBRARY

#### Layout Components
- `AppShell`, `AdminShell`, `UserShell`, `PublicShell` — role-specific wrappers
- `MarketingHeader`, `MarketingFooter` — for public pages
- `ImpersonationBanner` — super-admin context warning

#### Data Display
- `DataTablePage` — generic paginated/sortable/filterable table (reused across 20+ admin pages)
- `SimpleCrudPage` — wraps DataTablePage with CRUD modal scaffolding
- `ResultsTable`, `SummaryRow`, `ColumnFilter` — result-specific table components

#### Forms
- `ProductionDataForm`, `ScrapDataForm`, `StopDataForm` — Zod-validated with react-hook-form
- `CompanyAdminCreateUserForm` — user creation form

#### Flow & Visualization
- `FlowDesignerEditor` — DrawIO editor embed (iframe-based)
- `FlowCard`, `FlowCardGrid` — flow thumbnail cards
- `EquipmentRegistrationModal` — equipment-to-flow-node binding

#### Equipment
- `DraggableEquipmentTree` — @dnd-kit drag-drop tree
- `EquipmentDetailsView`, `EquipmentFullEditModal`, `EquipmentPropertiesPanel`
- `EquipmentTreeSelect` — picker dropdown

#### Real-time
- `AdminSocketProvider`, `MachineSocketProvider` — Socket.io React contexts
- `useLiveMachine` — custom hook for machine subscription

#### Utility
- `IconPicker`, `IconLibraryModal` — icon selection
- `DateRangeStrip`, `DateRangeSlider` — date filtering
- `WorkShiftDualSource` — shift picker with manual/auto modes
- `ComingSoon` — placeholder for unbuilt features
- `TabStrip`, `FilterOperatorPopover` — operator result navigation

#### Charts (via @ant-design/plots + Highcharts)
- Line charts (time-series production)
- Bar charts (OEE breakdown)
- Quantity vs. time stats
- Analyzer charts (partially built)

#### Notification
Relies entirely on Ant Design's `message`, `notification`, and `Modal.confirm` — **no custom notification system exists.**

---

## PART 2: TECHNICAL ARCHITECTURE ANALYSIS

---

### 2.1 FRONTEND STACK

| Concern | Technology | Version | Assessment |
|---------|-----------|---------|------------|
| Framework | Next.js App Router | 14.2.10 | Solid — slightly dated (15.x is current) |
| UI Library | Ant Design | 5.20.0 | Functional but heavy and dated visual language |
| State | Zustand | 4.5.5 | Correct choice, minimal footprint |
| Data Fetching | React Query (TanStack) | 5.59.0 | Excellent — well-used throughout |
| Forms | react-hook-form + Zod | 7.53 + 3.23 | Industry-standard, good |
| HTTP | Axios | 1.7.7 | Adequate |
| Realtime | Socket.io client | 4.8.3 | Correct pairing with backend |
| i18n | next-intl | 3.19.0 | Good, but locale **hardcoded to 'sv'** |
| Date | dayjs | 1.11.13 | Correct (lightweight vs moment) |
| Charts | @ant-design/plots (Highcharts) | 2.3.0 | Adequate, not data-dense enough |
| Flow Editor | DrawIO (iframe embed) | N/A | Heavyweight — entire diagramming engine |
| Drag & Drop | @dnd-kit | 6.3.1 | Modern, accessible |
| Dashboard Grid | react-grid-layout | 2.2.3 | Good for dashboard builder |
| Calendar | FullCalendar | 6.1.15 | Appropriate for shift scheduling |
| Testing | Playwright | 1.59.1 | Modern E2E, good choice |

**Styling:** CSS Modules + Ant Design design tokens. No Tailwind. Fonts: Lato (body), Poppins (headings). Colors: Ant Design default blue palette with custom theme tokens. No global design system documentation or style guide file found.

---

### 2.2 DATA FLOW

```
IoT Hardware → MQTT Broker (Mosquitto)
                    ↓
            mqtt.service.js subscribes
                    ↓
        iot-machine-data.service.js processes
                    ↓
        PostgreSQL MachineData table written
                    ↓
        socket.service.js broadcasts to frontend
                    ↓
        AdminSocketProvider → useLiveMachine hook
                    ↓
        Monitor screen updates SVG node colors
```

**HTTP polling fallback:** If `MQTT_BROKER_URL` is unset, frontend polls `/admin/flow-designs/:id/monitor-status` every 10–30 seconds (configurable via `.env`).

**API:** 100+ REST endpoints at `/api/v1/`. All follow RESTful conventions. JWT auth via HTTP-only cookie. Tenant routing via schema name resolution on every request.

#### Real-time Coverage Status

| Feature | Status |
|---------|--------|
| Machine ON/OFF status (Socket.io) | ✅ Implemented |
| Flow node color updates (Socket.io) | ✅ Implemented |
| Real-time OEE percentage | ❌ Not implemented (must refresh) |
| Alert/notification push to operator | ❌ FCM token stored, pipeline incomplete |
| Live production count ticker | ❌ Not implemented |

---

### 2.3 AUTHENTICATION SYSTEM

| Aspect | Detail |
|--------|--------|
| Method | JWT in HTTP-only cookie (access: 15 min, refresh: 7 days) |
| Roles | 3 fixed roles: Administrator, Company, User |
| Permissions | 31 granular permissions assignable to roles |
| RBAC enforcement | Backend middleware (`requireRole`, `requirePermission`, `requireAnyPermission`) |
| Multi-tenant | Schema-per-tenant (PostgreSQL schema isolation) |
| Impersonation | Super-admin can impersonate any user with token tracking |
| Email confirm | Token-based activation on user creation |
| Password reset | Token-based reset flow |
| 2FA | **Not implemented** |
| SSO | **Not implemented** |
| Session management | JWT only — Redis used for caching, not sessions |

#### Tenant Resolution Logic

```
Company user (companyId = 0)  →  schema = tenant_{user.id}
Sub-user    (companyId > 0)   →  schema = tenant_{user.companyId}
Super-admin                   →  override via X-Tenant-Id header
```

#### Role & Permission Matrix

| Role | Level | Permissions | User Type |
|------|-------|-------------|-----------|
| **Administrator** | Platform | All 31 (all=true flag) | Super-admin across platform |
| **Company** | Tenant | 25 permissions | Company owner/manager |
| **User** | Tenant | 5 permissions (view-flow-*, write-*-data) | Operator/line worker |

---

### 2.4 DATABASE & MODELS

**Technology:** PostgreSQL 16 + Prisma 5.20 ORM, multi-schema architecture.

#### Schema Structure

| Schema | Models | Purpose |
|--------|--------|---------|
| `public` | 14 models | Users, roles, permissions, CMS, feedback, platform audit |
| `tenant_template` | 36+ models | All tenant data — cloned per company on registration |

#### Key Model Relationships

```
Equipment (tree) ←→ FlowDesign (via FlowDesignAttribute)
FlowDesign → ProductionData / ScrapData / StopData
Equipment  → Machine (IoT device)
Machine    → MachineData (high-volume sensor readings)
Order      → FlowDesign + Equipment + Part
WorkShift  → ProductionData / ScrapData / StopData
User (snapshot) → all result tables
```

#### Core Tenant Models

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Equipment` | Equipment hierarchy (tree) | id, name, parentId, typeId, sortOrder, properties[] |
| `FlowDesign` | DrawIO flow diagrams | id, name, flowData (XML), svgCache, attributes[] |
| `ProductionData` | Production entries | flowId, flowObjectKey, partId, workShiftId, partQty, plannedQty |
| `ScrapData` | Scrap/defect entries | flowId, flowObjectKey, reasonId, quantity, picture |
| `StopData` | Downtime entries | flowId, flowObjectKey, reasonId, stopTimestamp, restartTimestamp, stopDataKind |
| `Machine` | IoT device | equipmentId, unitName, runningStatus, signalType, lastOnline |
| `MachineData` | Sensor readings (high-volume) | machineId, startTime, endTime, isRegistered, productionTime |
| `Order` | Production orders | orderNr, flowId, equipmentId, partId, plannedQty, okQty |
| `WorkShift` | Shift definitions | name, startTime, endTime, workingDays |
| `Board` | Custom dashboards | name, slotData (JSON), widgets[] |
| `SalaryGroup` | Operator pay rates | name, hourlyRate |

> **Critical architectural risk:** `MachineData` is the highest-volume table. Phase 6 plans partition by `start_time` (monthly) but it is currently **unpartitioned**. This will cause degrading query performance at scale.

---

## PART 3: UX & DESIGN ANALYSIS

---

### 3.1 CURRENT DESIGN SYSTEM

#### Color Palette (Ant Design Defaults + Customization)

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#1677ff` | Buttons, links, active states |
| Success | `#52c41a` | Running/OK machine states |
| Warning | `#faad14` | Warning alerts |
| Error | `#ff4d4f` | Stop states, errors |
| Background | `#f5f5f5` / white | Page backgrounds |
| Text primary | `#000000d9` | Body text |
| Border | `#d9d9d9` | Card/input borders |

**Typography:** Lato (body/UI), Poppins (headings). Solid choices but not differentiated from generic SaaS.

**Spacing/Grid:** Ant Design's 8px baseline grid. No custom spacing tokens documented.

**Design language assessment:** Ant Design 5 "Business" theme — functional and enterprise-appropriate, but reads as generic enterprise SaaS. No industrial identity. No dark mode. No visual differentiation from thousands of other AntD applications.

---

### 3.2 CURRENT UI PROBLEMS (Brutally Honest)

#### Structural Problems

- **The CMS/Marketing module is embedded in the production SaaS app.** Testimonials, homepage sliders, and social media management have no business being in an OEE platform. This signals product confusion about what this app is.
- **35+ admin sidebar items** — unnavigable without search or grouping. First-time admins will feel lost immediately.
- **No operator-first design** — operators on a factory floor are using tablets or shop-floor terminals, but the UI is desktop-first. Touch targets are too small for industrial use.
- **Loss Model is a placeholder.** For an OEE product, the loss model IS the product. This is the most critical missing feature.
- **Import/Export is a placeholder.** This blocks enterprise onboarding — customers need to bulk-upload equipment, parts, and orders from ERP systems.

#### Visual Problems

- Default Ant Design blue with no industrial skin looks like an internal HR tool, not a factory floor system
- Flow monitor node colors (`#52c41a` green / `#ff4d4f` red) are barely distinguishable in bright industrial lighting
- No status LEDs or "traffic light" components — operators expect visual metaphors from physical factory floors
- Cards and tables use minimal visual hierarchy — dense data looks like a spreadsheet export

#### UX Flow Problems

- **Production data entry is too many steps.** Select equipment → select part → select shift → enter quantity. On a busy line this takes 2–3 minutes. Operators will abandon or batch-enter at end of shift (corrupting real-time data).
- **Stop data entry requires manual timestamps.** Operators don't know exact timestamps — they enter wrong data. Should auto-capture via IoT and ask operator to classify the reason, not enter times.
- No **quick-action shortcuts** for common operations (most-used parts, last-used reason codes, one-tap production increment).
- **Analyzer page** is generic charts — no guided insight, no "what's wrong today vs. yesterday", no anomaly highlighting.
- **Boards** — grid layout exists but widget content is underdeveloped. This could be the killer feature if invested in.

#### Mobile Problems

- The app is not mobile-responsive for operators. Ant Design layouts break below 768px in many places.
- No PWA manifest or offline capability — factory wifi is often unreliable.
- No large-text or high-contrast mode for bright industrial environments.

---

### 3.3 SCREEN-BY-SCREEN CRITIQUE

| Screen | Rating | Works Well | Must Improve | Priority |
|--------|--------|-----------|-------------|----------|
| **Login** | 6/10 | Functional, clean | No company logo support, no SSO option, no "remember me", generic AntD look | Medium |
| **Operator Dashboard** | 4/10 | Shows something | No KPI hierarchy, no "Today vs Target", no shift-aware data | Critical |
| **Flow Monitor** | 7/10 | Real-time SVG overlay is technically impressive | Color-only status (accessibility fail), no legend, no click-to-drill-down, tiny nodes on complex flows | High |
| **Flow Analyzer** | 5/10 | Has charts | No OEE waterfall, no Pareto of stop reasons, no shift-comparison, no trend arrows | Critical |
| **Production Entry** | 5/10 | Zod-validated form works | Too many clicks, no quick-fill from last entry, no keyboard shortcuts, no barcode scan | High |
| **Scrap Entry** | 5/10 | Photo capture exists | Same UX issues as production entry, reason codes not pre-filtered by equipment | High |
| **Stop Entry** | 4/10 | Reason codes exist | Manual timestamp entry is wrong UX, no duration calculator, no "link to IoT event" button | Critical |
| **Unregistered Stops** | 6/10 | Good concept | Classification UI is unclear, no "bulk assign reason" option | High |
| **Admin Dashboard** | 4/10 | Exists | No KPIs visible above fold, unclear what data it shows | Critical |
| **Flow Designer** | 7/10 | DrawIO integration works | Embedded iframe feels foreign, node binding UX unclear to new users, no auto-save indicator | Medium |
| **Equipment Tree** | 6/10 | Drag-drop works | No tree collapse/expand at depth, properties panel is dense, no bulk import | High |
| **User Management** | 7/10 | Full CRUD, deactivate/delete/restore | No user activity view, no "last login" column, no bulk invite | Medium |
| **Role Management** | 8/10 | 31 permissions, granular | Permission names are technical (`manage-stop-reasons`), not human-friendly | Low |
| **Shift Management** | 6/10 | FullCalendar integration | Calendar doesn't show actual production data, purely config | Medium |
| **Machine Management** | 6/10 | Full IoT config | No connection status dashboard, no firmware version column, no alert threshold config | High |
| **MQTT Monitor** | 7/10 | Good for debugging | Not useful for non-technical users, should be hidden from Company role | Medium |
| **Boards** | 4/10 | Grid layout exists | Widgets underdeveloped, unclear what widgets do, no templates | Critical |
| **Loss Model** | 0/10 | — | **Does nothing — placeholder only** | Critical |
| **Import/Export** | 0/10 | — | **Does nothing — placeholder only** | Critical |
| **CMS / Sliders / Testimonials** | N/A | Functional as CMS | **Wrong product entirely** — remove from main SaaS or isolate to a separate admin | High |

---

### 3.4 Competitor Comparison Gaps

| Dimension | FP Analyzer | Evocon | MachineMetrics | Tractian |
|-----------|-------------|--------|----------------|----------|
| **First impression** | Generic enterprise SaaS | Clean, card-based, delightful | Dense but professional | Modern, AI-first, premium |
| **Operator UX** | Desktop form-heavy | Mobile-optimized, 3-tap entry | Kiosk mode available | Guided workflows |
| **OEE Display** | Hidden in Analyzer tab | Always-visible on monitor | Real-time OEE ticker per machine | Predictive OEE + ML anomaly |
| **Color theme** | AntD default blue | Brand-differentiated | Dark industrial | Gradient-rich dark mode |
| **Data density** | Low–medium | Low (beginner-friendly) | High (power users) | Medium (AI-summarized) |
| **Alert system** | FCM stored, pipeline unclear | Push notifications + email | Real-time alerts with escalation | AI-triggered alerts |
| **Onboarding** | Manual setup, no guided tour | In-app onboarding wizard | Account manager + wizard | AI-assisted setup |
| **Mobile** | Desktop-first | Tablet-optimized | Dedicated mobile app | Native iOS/Android |
| **Reports** | Ad-hoc charts only | PDF/Excel export | Scheduled reports, email | AI-generated summaries |
| **Integrations** | None (standalone) | ERP connectors | SAP, Ignition, MES | API + webhook marketplace |

**Critical gap vs Evocon:** Evocon's operator flow is 3 taps. FP Analyzer's is 8+ steps.

**Critical gap vs MachineMetrics:** They show real-time OEE % on every machine card. FP Analyzer requires navigating to Analyzer → selecting flow → reading charts.

**Critical gap vs Tractian:** They lead with ML anomaly detection and predictive maintenance. FP Analyzer has no AI layer at all.

---

## PART 4: MISSING FEATURES ANALYSIS

---

### 4.1 Critical Missing Features

#### For Operators (Factory Floor)
- ❌ **One-tap production count increment** — "I made 1 more part" should be ONE button
- ❌ **Kiosk mode** — full-screen, large-button, tablet-optimized view for shop-floor terminals
- ❌ **Barcode/QR scan for part selection** — operators cannot type part numbers with gloves
- ❌ **Automatic stop detection** → operator prompted to classify reason (not enter timestamps)
- ❌ **Shift-start / shift-end workflow** — no guided handover between shifts
- ❌ **Running OEE displayed at workstation** — operator should see their live performance

#### For Supervisors (Shift Management)
- ❌ **Shift handover report** — what happened this shift, what's pending
- ❌ **Live production vs. target** — "We need 500 parts by end of shift, we have 320"
- ❌ **Stop escalation** — if machine is down >X minutes, escalate to supervisor automatically
- ❌ **Operator data completeness view** — which operators entered data, which didn't
- ❌ **Multi-machine status board** — TV-display mode showing all machines simultaneously

#### For Managers (Decision Making)
- ❌ **Real OEE dashboard** (Availability × Performance × Quality) — the Analyzer shows components but no combined OEE %
- ❌ **Pareto analysis of downtime reasons** — where is the most time lost?
- ❌ **Shift-over-shift comparison** — is Monday better than Friday?
- ❌ **PDF/Excel report export** — management expects scheduled reports
- ❌ **Scheduled email reports** — weekly OEE summary to inbox
- ❌ **Cost of downtime calculator** — salary-group data exists but no output screen

#### For System Admins
- ❌ **Bulk import (CSV/Excel)** — equipment, parts, orders, users (placeholder does nothing)
- ❌ **ERP integration connectors** — SAP, Odoo, BusinessCentral webhooks
- ❌ **System health dashboard** — DB size, MQTT broker status, active connections
- ❌ **Two-factor authentication** — enterprise customers require this
- ❌ **GDPR data export** — no subject access request workflow

---

### 4.2 Half-Built Features

| Feature | Current State | Gap | Effort to Complete |
|---------|--------------|-----|--------------------|
| **Loss Model** | Route + `ComingSoon` placeholder | OEE formula config, loss category mapping, waterfall chart | 3–4 weeks |
| **Import/Export** | Route + `ComingSoon` placeholder | CSV template download, file upload parser, validation UI, progress tracking | 2–3 weeks |
| **Boards/Widgets** | Grid layout + widget DB model | Widget types (OEE gauge, machine status, production count), real data binding | 4–6 weeks |
| **Flow Analyzer** | Basic line + bar charts | OEE waterfall, Pareto stops, shift comparison, anomaly markers | 3–4 weeks |
| **Operator Dashboard** | Route exists, content thin | Shift-aware KPIs, live target vs actual, recent entries list | 1–2 weeks |
| **i18n (Language)** | next-intl installed, EN+SV files exist | Locale hardcoded to `'sv'` in `i18n/request.ts` — switcher doesn't persist | 1 week |
| **FCM Push Notifications** | Token stored in `User.fcmToken` | No push notification send pipeline in backend services | 2–3 weeks |
| **Barcode Scanner** | Not started | Web Barcode Detection API or `html5-qrcode` needed | 1 week |

---

### 4.3 Global Readiness Gaps

| Concern | Current State | Gap | Severity |
|---------|--------------|-----|----------|
| **Multi-language** | EN + SV files exist, next-intl installed | Locale hardcoded to `'sv'`. Switcher doesn't persist to DB. Backend error messages in English only. | High |
| **Multi-timezone** | User has `timezone` field | No timezone-aware query layer — all queries use server time. Shift boundaries don't adjust per TZ. | Critical |
| **Date formats** | dayjs used | No locale-aware formatting (DD/MM/YYYY vs MM/DD/YYYY) | Medium |
| **Number formats** | None | No thousand-separator or decimal-comma formatting for EU markets | Medium |
| **Currency** | Salary groups use plain numbers | No currency symbol or locale formatting | Low |
| **RTL support** | None | Ant Design supports RTL but not configured | Low (future) |
| **Data residency** | Single PostgreSQL instance | Schema-per-tenant exists but no geo-routing or region selection | High (enterprise) |
| **GDPR compliance** | Soft-delete exists | No data export for subject access requests. No data retention policies. No access audit log. | Critical (EU) |
| **Accessibility (WCAG)** | Ant Design base level | Color-only status indicators, keyboard navigation untested in flow editor | High |

---

## PART 5: REDESIGN RECOMMENDATIONS

---

### 5.1 Design System Recommendation

**Recommendation: Dark Industrial Theme with Light Dashboard Variant**

Industrial SaaS users are either:
1. On shop-floor tablets in bright, noisy environments → need HIGH CONTRAST
2. In control rooms on large monitors → dark theme reduces eye strain

#### Proposed Color Palette

```css
/* Dark Industrial Primary — Operator / Monitor views */
--color-bg-primary:     #0f1117;  /* Near-black background */
--color-bg-surface:     #1a1d27;  /* Card/panel background */
--color-bg-elevated:    #242736;  /* Dropdown/modal */
--color-accent-primary: #3b82f6;  /* Electric blue — actions */
--color-accent-success: #22c55e;  /* Machine running — green */
--color-accent-warning: #f59e0b;  /* Warning — amber */
--color-accent-danger:  #ef4444;  /* Stop/error — red */
--color-accent-idle:    #6366f1;  /* Idle — indigo */
--color-text-primary:   #f1f5f9;  /* High contrast text */
--color-text-muted:     #94a3b8;  /* Secondary text */
--color-border:         #334155;  /* Subtle borders */

/* Light Professional — Admin / Reports views */
--color-bg-primary:     #f8fafc;
--color-bg-surface:     #ffffff;
--color-accent-primary: #2563eb;
```

#### Typography Upgrade

```css
/* Replace Lato/Poppins with: */
font-family: 'Inter', system-ui, sans-serif;   /* Body — optimal screen readability */
font-family: 'JetBrains Mono', monospace;      /* Numerical data (OEE %, counts) */
```

#### Component Library Decision

**Stay with Ant Design 5** but apply a fully custom theme token set. Do NOT migrate to shadcn/ui — that is a 6-month rewrite for no functional gain. Add **Lucide React** icons alongside Ant Design icons (lighter, more modern, consistent stroke weights).

#### Key New Components Needed

| Component | Purpose |
|-----------|---------|
| `StatusIndicator` | LED-style machine status dot with label |
| `OEEGauge` | Circular gauge showing Availability / Performance / Quality |
| `KPICard` | Large number + trend arrow + delta % (like MachineMetrics) |
| `TargetProgress` | "320/500 parts (64%)" progress bar, shift-aware |
| `ShiftBadge` | Visual shift indicator (Morning / Afternoon / Night) |
| `AlertBanner` | Sticky top banner for active machine stops |

---

### 5.2 Screen Redesign Priority List

| # | Screen | Why Urgent | What to Change |
|---|--------|-----------|----------------|
| 1 | **Operator Dashboard** | First thing operators see — currently shows almost nothing useful | Add shift-aware KPI cards (Today Production, Scrap Rate, Active Stops), live machine status grid, recent activity feed, target vs actual progress |
| 2 | **Flow Monitor** | Core selling feature — currently color blobs on a diagram | Add status legend, click-to-expand machine detail panel, OEE mini-gauge per node, alert count badges, dark industrial skin |
| 3 | **Flow Analyzer** | Core analytics — basic charts are not sufficient | Add OEE waterfall (Planned → Availability Loss → Performance Loss → Quality Loss → Actual OEE), Pareto chart of stop reasons, shift comparison, period presets (Today/Week/Month) |
| 4 | **Production Entry (MyResult)** | 8-step process operators hate | Redesign as 3-step wizard: Equipment (pre-filled from assignment), Part (recent parts first), Qty + Shift (auto-detected). Submit in 3 taps. |
| 5 | **Stop Entry (MyResult)** | Manual timestamp entry causes data quality issues | Remove timestamp inputs. If IoT event: pre-fill from event. If manual: show duration calculator. Reason codes as large tap-targets, not dropdown. |
| 6 | **Admin Dashboard** | Currently unclear what it shows | Executive summary: OEE %, Production Today, Active Stops count, Top 3 stop reasons, Recent alerts, 7-day trend sparklines |
| 7 | **Boards/Dashboard Builder** | Barely functional | Add 6 built-in widget types: OEE Gauge, Machine Status Grid, Production Chart, Stop Pareto, Active Orders, Shift Comparison. Make templates available. |
| 8 | **Login** | Generic look | Add company logo support (tenant branding), dark/light variant, industrial SaaS first impression |
| 9 | **Machine Management** | Config-only, no live status | Add connection status column (MQTT online/offline), last event timestamp, firmware version, "Test Connection" button, alert threshold sliders |
| 10 | **Equipment Tree** | Functional but visually dense | Collapse/expand with animation, color-code by type, show machine count per node, "Bulk assign users" action |

---

### 5.3 New Screens to Add

| Screen | Why Needed | Role | Priority |
|--------|-----------|------|----------|
| **TV Display / Andon Board** | Shop-floor TV showing all machines OEE, status, counts simultaneously | User/Admin | Month 1 |
| **OEE Dashboard (Real)** | Calculated OEE % (A×P×Q) per machine per shift, live + historical | Company/Admin | Month 1 |
| **Shift Handover Report** | End-of-shift summary: what ran, what stopped, pending items, notes | User/Company | Month 1 |
| **Stop Escalation Center** | Live view of all open stops over threshold, escalation status, resolution | Company | Month 1 |
| **Onboarding Wizard** | Step-by-step first-run: Add equipment → Add machine → Add flow → Add operator | Company | Month 1 |
| **Production vs. Target** | Live countdown: "Need X more parts in Y minutes to hit shift target" | User/Company | Month 2 |
| **Downtime Pareto Analysis** | Ranked causes of lost time with trend comparison | Company/Admin | Month 2 |
| **Weekly/Monthly OEE Report** | Formatted PDF/Excel report with charts, exportable, schedulable | Company/Admin | Month 2 |
| **Operator Scorecard** | Per-operator: shifts worked, data entry completeness, production achieved | Company | Month 2 |
| **System Health** | PostgreSQL size, Redis hit rate, MQTT connections, active WebSockets | Admin | Month 2 |
| **GDPR Data Export** | One-click user data export (JSON/CSV) for GDPR compliance | Admin | Month 2 |
| **Predictive Maintenance Alerts** | IoT-based pattern detection: "Machine X has failed at this interval 3x" | Company/Admin | Month 3 |
| **ERP Integration Setup** | Webhook config for SAP/Odoo/BC order sync, part sync, results push | Admin | Month 3 |

---

### 5.4 Information Architecture Redesign

**Current admin navigation is flat with 35+ items — this is unusable.**

```
CURRENT (35 flat items — broken IA):
├── dashboard
├── equipment
├── equipment/tree
├── equipment/scrap-reasons
├── equipment/stop-reasons
├── access/users
├── access/roles
├── access/salary-groups
├── flow-designs
├── monitor
├── analyzer
├── results/production
├── results/scrap
├── results/stop
├── results/warning
├── orders
├── parts
├── types
├── machines
├── machine-programmes
├── machine-files
├── folders
├── workstations
├── work-shifts
├── shift-schedules
├── iot/setup
├── iot/auto-register
├── iot/software
├── boards
├── loss-model
├── import-export
├── mqtt-monitor
├── mqtt-testing
├── stop-categories
├── symbols
├── cms / sliders / testimonials / social / feedback
└── profile

RECOMMENDED (6 grouped sections):
├── 📊 OVERVIEW
│   ├── Dashboard (KPIs + live status)
│   └── TV Display (Andon board)
│
├── 🏭 PRODUCTION
│   ├── Flow Monitor (live)
│   ├── Flow Analyzer (historical)
│   ├── Flow Designs (design)
│   ├── OEE Dashboard
│   ├── Shift Handover
│   └── Results (Production / Scrap / Stop)
│
├── ⚙️ EQUIPMENT
│   ├── Equipment Tree
│   ├── Machines (IoT)
│   ├── Stop / Scrap Reasons
│   ├── Stop Categories
│   └── Machine Documents
│
├── 📋 MASTER DATA
│   ├── Orders
│   ├── Parts
│   ├── Work Shifts & Schedules
│   ├── Types
│   ├── Salary Groups
│   └── Import / Export
│
├── 👥 PEOPLE
│   ├── Users
│   ├── Roles & Permissions
│   └── Workstations
│
└── ⚙️ SETTINGS
    ├── Company Profile
    ├── IoT Setup
    ├── Loss Model
    ├── Boards & Widgets
    └── System Health

REMOVE FROM MAIN APP:
└── CMS / Sliders / Testimonials / Social → separate marketing admin panel
```

#### Ideal User Journeys by Role

| Role | Ideal Journey |
|------|--------------|
| **Operator (User)** | Login → See shift KPIs immediately → Tap "Log Production" (3 taps) → Machine stops auto-detected, tap to classify reason → See personal OEE live |
| **Supervisor (Company+)** | Login → See all-machine status board → Click stopped machine → See stop details + duration → Assign reason → Track escalation |
| **Manager (Company)** | Login → See OEE dashboard (week view) → Drill into worst performer → See Pareto of reasons → Export PDF report |
| **Admin (Company)** | Equipment setup → IoT provisioning → User creation → Role assignment — guided onboarding wizard |

---

## PART 6: FINAL EXPERT SUMMARY

---

### 6.1 Overall Product Maturity Score

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| **Feature completeness** | **5/10** | Core CRUD is solid. Loss Model is a placeholder. OEE calculation, analytics, and reporting are incomplete. Boards barely functional. |
| **UI/UX quality** | **4/10** | Functional but generic. No industrial design language. Operator flows are too complex. Not mobile/tablet ready. No dark mode. |
| **Technical architecture** | **7/10** | Excellent foundation: multi-tenant PostgreSQL, Socket.io, MQTT, Prisma, Next.js App Router, proper RBAC. Partition risk on MachineData at scale. |
| **Global readiness** | **3/10** | i18n half-done (locale hardcoded). No timezone-aware queries. No GDPR data export. Marketing content embedded in SaaS. |
| **Mobile readiness** | **2/10** | Desktop-first. AntD breaks at mobile breakpoints. No PWA. No offline mode. Factory workers on tablets will struggle. |

**Overall maturity: 4.2 / 10**

The backend architecture is genuinely excellent. The frontend UX is where it needs the most work. This is an early-stage internal tool that has the bones of a serious product.

---

### 6.2 Top 10 Priority Actions

| # | Action | Impact | Why Now |
|---|--------|--------|---------|
| 1 | **Build real OEE dashboard** (Availability × Performance × Quality per machine) | Critical | This IS the product's value proposition. Without it you can't sell. |
| 2 | **Redesign operator data entry** (3-tap production/stop entry, kiosk mode) | Critical | If operators don't use it consistently, all data is worthless — no insights possible. |
| 3 | **Complete the Loss Model module** (OEE waterfall, loss category mapping) | Critical | Every competitor has this. It's currently a `ComingSoon` placeholder. |
| 4 | **Build TV Andon Board screen** (all machines, live OEE, large display) | High | The single most requested feature in every factory — visible accountability. |
| 5 | **Implement PDF/Excel report export** | High | Managers will not log in daily — they want a report in their inbox Monday morning. |
| 6 | **Fix timezone-aware queries** (shift boundaries, timestamps per user TZ) | High | International data is currently wrong. This is a correctness bug, not a feature gap. |
| 7 | **Redesign navigation IA** (6 grouped sections, remove CMS from main app) | High | 35 flat sidebar items is unusable. This affects every admin user every session. |
| 8 | **Finish i18n** (unlock locale selector to persist language, fix backend error messages) | Medium | EN+SV infrastructure is 90% done — the last 10% unlocks the Swedish market properly. |
| 9 | **Build Onboarding Wizard** (equipment → flow → machine → user) | Medium | Without guided onboarding, new customers churn in week 1. Reduce time-to-value. |
| 10 | **Implement MachineData table partitioning** | Medium | A future P0 — partition before you have 50M rows and 3-second queries. |

---

### 6.3 Effort Estimate (Solo Full-Stack Developer, Node.js)

#### In 2 Weeks
- Fix i18n locale persistence (1–2 days)
- Redesign navigation IA — remove CMS, group into 6 sections (2–3 days)
- Build real OEE calculation service (backend formula + simple display) (3–4 days)
- Operator production entry redesign (3-tap wizard) (3–4 days)

#### In 1 Month
- Everything in the 2-week list, plus:
- Operator Dashboard (shift-aware KPIs, live status)
- Admin OEE Dashboard (machine cards with live OEE %)
- TV Andon Board screen
- Stop entry redesign (auto-detect from IoT, reason tap-targets)
- Fix timezone-aware queries
- MachineData table partitioning migration

#### In 3 Months
- Everything in the 1-month list, plus:
- Loss Model (OEE waterfall, loss category configuration)
- Flow Analyzer redesign (Pareto, shift comparison, trend arrows)
- PDF/Excel report export
- Import/Export (CSV templates, bulk upload parser)
- Boards/Widget builder (6 widget types with real data)
- Shift handover report
- Dark industrial design theme rollout
- PWA manifest + basic offline support for operators
- GDPR data export endpoint

#### Requires a Team (4+ Months)
- Native mobile app (Flutter)
- ERP integration connectors (SAP, Odoo, BusinessCentral)
- Predictive maintenance ML layer
- Multi-region data residency
- SSO (SAML/OAuth enterprise)
- Two-factor authentication
- Advanced analytics (cohort analysis, cross-tenant benchmarks)
- Scalability hardening (load testing, CDN, read replicas)

---

### 6.4 Quick Wins — Code-Level Fixes

```ts
// 1. Fix locale hardcode in /frontend/src/i18n/request.ts
// CURRENT (broken — always Swedish):
const locale = 'sv';

// SHOULD BE:
const locale = requestLocale ?? cookies().get('NEXT_LOCALE')?.value ?? 'sv';
```

```js
// 2. OEE formula — missing from the entire codebase:
// OEE = Availability × Performance × Quality
const availability = (plannedTime - downtimeMinutes) / plannedTime;
const performance  = (actualQty * idealCycleTime) / (plannedTime - downtimeMinutes);
const quality      = (actualQty - scrapQty) / actualQty;
const oee          = availability * performance * quality * 100;
// This belongs in: /backend/src/services/admin-chart-data.service.js
```

```sql
-- 3. MachineData partition DDL (run before hitting 10M rows):
ALTER TABLE tenant_X.machine_data PARTITION BY RANGE (start_time);

CREATE TABLE machine_data_2025_01 PARTITION OF machine_data
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE machine_data_2025_02 PARTITION OF machine_data
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- Continue per month. Add DEFAULT partition to catch overflow.
```

---

### 6.5 One-Line Verdict

> **"This product is currently a technically-solid internal CRUD tool disguised as an OEE platform, and needs to become a factory-floor-first analytics product by building real OEE calculation, redesigning operator data entry to 3 taps, and shipping the TV Andon Board — in that order."**

---

*End of Report — FP Analyzer Complete Expert Product Audit*
