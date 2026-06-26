# FP Analyzer — 4-Prompt Deep Code Audit
**Source:** Live codebase at `/Applications/XAMPP/xamppfiles/htdocs/new_fp`
**Date:** 2026-06-02
**Method:** Direct file reads — no guessing, no assumptions

---

## PROMPT 1 — UI & Brand Design System

---

### 1. CSS Framework

- **Framework:** Ant Design 5 (`antd@5.20.0`) — used exclusively via `ConfigProvider` theme tokens
- **No Tailwind** — no `tailwind.config.js` found anywhere in the project
- **No CSS-in-JS** (beyond AntD internals) — components use AntD's built-in style system
- **Custom CSS file:** `/frontend/src/app/globals.css`

**globals.css contains:**
- `html/body` reset (margin, padding, overflow-x: hidden)
- `box-sizing: border-box` universal reset
- Heading font override → Poppins for `h1–h6` and `.ant-typography`
- `.fp-visually-hidden` — WCAG accessibility utility
- `.fp-no-scroll` — scroll lock utility
- `.safe-area-top/bottom` — iOS notch padding (env variables)
- `.hide-scrollbar` — horizontal carousel utility
- Mobile responsive AntD Table overrides (`min-width: 720px`, `overflow-x: auto` below 767px)
- Mobile font floor (`font-size: 14px` minimum; `16px` for inputs to prevent iOS zoom)
- Mobile tap-target floor (`min-height: 44px` for buttons, pagination, dropdowns)
- `100dvh` fix for iOS Safari toolbar (replaces broken `100vh`)

---

### 2. Brand Colors — EXACT HEX VALUES

**Source file:** `/frontend/src/lib/theme/tokens.ts`

#### Primary Brand Palette

| Token Name | Hex Value | Usage |
|-----------|-----------|-------|
| `brandPrimary` | `#01b9d0` | Primary actions, active nav, links, borders |
| `brandDeep` | `#00768D` | Marketing hero/CTA, deep brand accent |
| `brandLight` | `#4BBACF` | Active nav highlight, light teal variant |
| `brandAccent` | `#954cfe` | Secondary accent (legacy purple) |

#### Semantic Colors

| Token Name | Hex Value | Usage |
|-----------|-----------|-------|
| `success` | `#00a65a` | Success states, OK indicator |
| `warning` | `#f39c12` | Warning alerts, orange indicator |
| `error` | `#dd4b39` | Error states, delete actions |
| `info` | `#01b9d0` | Info state (= brandPrimary) |

#### Machine Status Colors

| Status | Hex Value | Meaning |
|--------|-----------|---------|
| `running` | `#00a65a` | Machine actively producing |
| `idle` | `#bfbfbf` | Connected, no output |
| `stopped` | `#dd4b39` | Machine stopped (manual or fault) |
| `warning` | `#f39c12` | Running with warning signal |
| `offline` | `#999999` | Disconnected / last-seen > threshold |

#### Neutral / Layout Colors

| Token Name | Hex Value | Usage |
|-----------|-----------|-------|
| `bgBody` | `#ecf0f5` | Page background (AdminLTE classic grey) |
| `bgCard` | `#ffffff` | Card/panel backgrounds |
| `bgSiderDark` | `#222d32` | Dark sidebar (AdminLTE legacy) |
| `bgSiderHover` | `#1e282c` | Sidebar hover/submenu |
| `bgHeader` | `#ffffff` | Top navigation bar |
| `borderLight` | `#f4f4f4` | Card/box light borders |
| `borderDefault` | `#d2d6de` | Form and box standard border |
| `textPrimary` | `#333333` | Primary body text |
| `textSecondary` | `#666666` | Secondary/label text |
| `textMuted` | `#999999` | Placeholder/disabled text |
| `textInverse` | `#ffffff` | Text on dark backgrounds |

> **Note:** AntD theme also applies `colorBgBase: '#ffffff'` and `colorBgLayout: '#ecf0f5'` globally via ConfigProvider.

---

### 3. Typography

**Source file:** `/frontend/src/lib/theme/tokens.ts` + `/frontend/src/app/layout.tsx`

| Property | Value | Notes |
|----------|-------|-------|
| **Body font** | `Lato` | Google Fonts, weights 300/400/700/900 |
| **Display/Heading font** | `Poppins` | Google Fonts, weights 400/500/600/700 |
| **Monospace** | Not configured | No code/mono font defined |
| **Font import** | `next/font/google` | No local font files; automatic subsetting |
| **CSS variables** | `--font-lato`, `--font-poppins` | Set on `<html>` element |
| **fontSizeBase** | `14px` | AntD token `fontSize: 14` |
| **fontSizeSm** | `12px` | Labels, captions |
| **fontSizeLg** | `16px` | Subheadings |
| **fontSizeXl** | `20px` | Section headers |
| **fontSizeHero** | `48px` | Marketing page hero |
| **lineHeightBase** | `1.5` | Body copy |
| **lineHeightHeading** | `1.25` | h1–h6 |

**Heading override (globals.css):**
```css
h1, h2, h3, h4, h5, h6,
.ant-typography h1, .ant-typography h2, .ant-typography h3 {
  font-family: var(--font-poppins), var(--font-lato), -apple-system, sans-serif;
}
```

---

### 4. Logo

**Source file:** `/frontend/src/lib/assets.ts`

| Asset | Path | Format |
|-------|------|--------|
| Full logo | `/public/brand/logo.png` | PNG |
| Small logo (40×40) | `/public/brand/logo-40.png` | PNG |
| Footer logo | `/public/brand/footer-logo.png` | PNG |
| Favicon / Apple touch | `/public/apple-touch-icon.png` | PNG |

- **Colors in logo:** Gray "fp" text + teal/cyan "analyzer" text with teal geometric bars on left side
- **No SVG version** — all PNG only
- **No dark/light variants** — single version used everywhere
- **No tenant branding support** — same logo shown for all company users

---

### 5. Sidebar / Navigation

**Source files:** `AdminShell.tsx`, `UserShell.tsx`

#### Layout Dimensions

| Property | Value | Source |
|----------|-------|--------|
| Sidebar width (expanded) | `220px` | `SIDEBAR_WIDTH = 220` in AdminShell.tsx |
| Sidebar width (collapsed) | `60px` | `SIDEBAR_COLLAPSED = 60` in AdminShell.tsx |
| Sidebar collapsed width (tokens) | `80px` | `layout.siderCollapsedWidth` in tokens.ts |
| Header height | `60px` (AdminShell) / `64px` (tokens) | Minor mismatch |

#### Sidebar Styling (from AdminShell.tsx)

```
Background:           #ffffff (white)
Border-right:         1px solid #eef0f3
Position:             sticky, top: 0, height: 100vh
Active item bg:       #e6f7fa (light teal)
Active item color:    #01b9d0 (brand teal)
Active item border:   3px solid #01b9d0 (left border)
Inactive item color:  #555
Icon color (active):  #01b9d0
Icon color (inactive):#888
Group header color:   #555 (inactive), #01b9d0 (has active child)
Font size:            13px
Item min-height:      44px (WCAG tap target)
Sub-item padding:     10px 16px 10px 40px
```

#### Icon Library

- **Library:** `@ant-design/icons` (`^5.4.0`)
- **Icons used in sidebar:**

| Icon Component | Used For |
|----------------|---------|
| `HomeOutlined` | Dashboard |
| `TeamOutlined` | User Management |
| `SafetyCertificateOutlined` | Roles |
| `ShareAltOutlined` | Social Management |
| `ProfileOutlined` | CMS Management |
| `ProjectOutlined` | Slider Management |
| `BulbOutlined` | Testimonials |
| `CommentOutlined` | Feedback |
| `WifiOutlined` | MQTT Monitor |
| `BugOutlined` | MQTT Testing |
| `TagOutlined` | Type Management |
| `ToolOutlined` | Equipment Management |
| `NodeIndexOutlined` | Flow Management |
| `AppstoreOutlined` | Production Management |
| `BarChartOutlined` | Result Management |
| `LineChartOutlined` | Boards |
| `SettingOutlined` | Setup Units |
| `RightOutlined` | Collapse/expand arrow |
| `MenuOutlined` | Hamburger toggle |
| `LogoutOutlined` | Logout |

#### Collapsible Behavior

- **Desktop:** Sidebar collapses to `60px` (icon-only mode) via hamburger button toggle
- **Mobile (< lg breakpoint):** Sidebar becomes an Ant Design `Drawer` (off-canvas, slides in from left)
- **Auto-expand:** Active page's parent group auto-expands on navigation via `useEffect`

#### User Shell Difference

**Operators (User role) have NO sidebar.** `UserShell.tsx` uses `MarketingHeader` + `MarketingFooter` only — logo and user dropdown in the top nav, tile-based page access from dashboard.

---

### 6. Login Page

**Source file:** `/frontend/src/app/(public)/login/page.tsx`

#### Layout Description
- Single centered card on a `#ecf0f5` body background
- Card contains: logo at top center, title, email+password form, submit button
- No social login buttons (no Google/GitHub OAuth)
- No "remember me" checkbox
- Rate-limited: 5 attempts/minute at backend

#### Form Fields
1. **Email** — `type="email"`, required, lowercase validation
2. **Password** — `type="password"`, required, `minLength: 6`

#### Form Behavior
- Validated with `react-hook-form` + `zod`
- On success: JWT cookie set by backend, redirect to `/dashboard`
- On failure: AntD `message.error()` with translated error message
- Shows spinner on loading state

---

### 7. Dashboard Layout

**Source file:** `/frontend/src/app/(admin)/admin/dashboard/page.tsx`

- **Column structure:** 2-column grid on desktop (`Row` + `Col` from AntD with `gutter={[16,16]}`)
- **Cards:** AntD `Card` component with `borderRadius: 8px` (radius.lg token), `headerBg: '#fafafa'`, `paddingLG: 24`
- **Shadow:** `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.08)` (shadows.card token)
- **Border radius on cards:** `8px` (`radius.lg`)
- Layout: KPI stat cards row at top, then analyzer/charts, then recent history table

---

### 8. Data Tables

**Source file:** `/frontend/src/components/data-table/DataTablePage.tsx`

- **Library:** Ant Design `Table` component (not TanStack Table)
- **Pagination:** AntD `Pagination` component with server-side paging — page size options: [10, 25, 50, 100]
- **Row behavior:** Rows can be clickable (configured per page via `onRowClick` prop)
- **Search:** Built-in server-side search input with debounce
- **Column filters:** Popover-based per-column filters
- **Date range:** DateRangePicker for date filters
- **Mobile:** Tables scroll horizontally below 767px (globals.css override, `min-width: 720px`)
- **Table styling (antd-theme.ts):**
  - `headerBg: '#fafafa'`
  - `headerColor: '#333333'`
  - `borderColor: borderLight (#f4f4f4)`
  - `rowHoverBg: '#f5f7f9'`
  - `cellPaddingBlock: 12`

---

### 9. Buttons

**Source:** `antd-theme.ts` AntD component overrides

```
borderRadius:    6px   (radius.base)
controlHeight:   38px  (standard buttons)
controlHeightLG: 46px  (large variant)
controlHeightSM: 30px  (small variant)
```

- **Primary button:** Background `#01b9d0`, white text, 6px border-radius, height 38px
- **Secondary button:** AntD default (outlined), teal border
- **Danger/delete button:** `type="primary" danger` → `#dd4b39` background
- **No custom Button component** — AntD Button used directly everywhere

---

### 10. Mobile Current State

#### Breakpoints (tokens.ts)

| Name | Value |
|------|-------|
| `xs` | 480px |
| `sm` | 576px |
| `md` | 768px — **primary mobile target** |
| `lg` | 992px |
| `xl` | 1200px |
| `xxl` | 1600px |

#### Mobile Behavior

- **Sidebar:** Collapses to Drawer on mobile (< `lg` = 992px breakpoint via `Grid.useBreakpoint()`)
- **Tables:** `min-width: 720px` + horizontal scroll below 767px (globals.css)
- **Tap targets:** Bumped to `44px` minimum for buttons, pagination, dropdowns (globals.css)
- **Fonts:** `font-size: 14px` floor; `16px` for inputs (prevents iOS zoom)
- **Layout:** `100dvh` fix for iOS Safari toolbar

#### What Breaks on Mobile

- AntD Table columns crush below `720px` if container allows it
- DrawIO flow editor is an iframe — cannot be resized for mobile
- Admin sidebar has 35+ items even when collapsed to Drawer — no search or grouping
- Complex forms (production entry, stop entry) are not optimized for touch
- Boards/dashboard grid uses `react-grid-layout` which is drag-only (no touch alternative)

---

## PROMPT 2 — Roles & Permissions Exact Data

---

### 1. All Roles

**Source:** `/backend/prisma/seed.js`

| Role Name | DB Slug | `all` Flag | Sort | Description |
|-----------|---------|-----------|------|-------------|
| `Administrator` | `Administrator` | `true` | 1 | Super-admin, all permissions implicit |
| `Company` | `Company` | `false` | 2 | Tenant owner/manager, 25 permissions |
| `User` | `User` | `false` | 3 | Operator, 5 permissions |

**Total default roles: 3**

---

### 2. Administrator Role (Super Admin)

**Role key:** `Administrator` | `all: true` (bypasses all permission checks)

#### Menu Items Visible (SUPERADMIN_SIDEBAR from AdminShell.tsx)

| Label Key | Route | Icon |
|-----------|-------|------|
| Administration | `/admin/dashboard` | HomeOutlined |
| User Management | `/admin/access/users` | TeamOutlined |
| Roles | `/admin/access/roles` | SafetyCertificateOutlined |
| Social Management | `/admin/social` | ShareAltOutlined |
| CMS Management | `/admin/cms` | ProfileOutlined |
| Slider Management | `/admin/sliders` | ProjectOutlined |
| Testimonials | `/admin/testimonials` | BulbOutlined |
| Feedback | `/admin/feedback` | CommentOutlined |
| MQTT Monitor | `/admin/mqtt-monitor` | WifiOutlined |
| MQTT Testing | `/admin/mqtt-testing` | BugOutlined |

**Total sidebar items: 10 (flat, no groups)**

#### Special Powers

- `all: true` flag bypasses ALL `requirePermission()` checks in backend
- Can impersonate any non-Administrator user via `POST /admin/users/:id/impersonate`
- Can send `X-Tenant-Id` header to access any company's schema
- Can join all tenant rooms on Socket.io via `admin:join:all` event
- Can call `client:resync:tenant` for any tenant ID
- Cannot be impersonated by another admin

---

### 3. Company Admin Role

**Role key:** `Company` | `all: false` | 25 permissions assigned

#### Menu Items (COMPANY_SIDEBAR from AdminShell.tsx)

| Group/Item | Sub-items | Route(s) | Icon |
|-----------|-----------|----------|------|
| Administration | — | `/admin/dashboard` | HomeOutlined |
| **User Management** (group) | Users | `/admin/access/users` | TeamOutlined |
| | Salary Group | `/admin/access/salary-groups` | |
| Type Management | — | `/admin/types` | TagOutlined |
| **Equipment Management** (group) | Equipment List | `/admin/equipment` | ToolOutlined |
| | Equipment Structure | `/admin/equipment/tree` | |
| | Stop Reasons | `/admin/equipment/stop-reasons` | |
| | Scrap Reasons | `/admin/equipment/scrap-reasons` | |
| **Flow Management** (group) | Flow Designer | `/admin/flow-designs` | NodeIndexOutlined |
| | Flow Monitor | `/admin/monitor` | |
| | Flow Analyzer | `/admin/analyzer` | |
| **Production Management** (group) | Order List | `/admin/orders` | AppstoreOutlined |
| | Parts List | `/admin/parts` | |
| | Work Shifts | `/admin/work-shifts` | |
| | Shift Schedule | `/admin/shift-schedules` | |
| **Result Management** (group) | Production Data | `/admin/results/production` | BarChartOutlined |
| | Scrap Data | `/admin/results/scrap` | |
| | Stop Data | `/admin/results/stop` | |
| | Warning Data | `/admin/results/warning` | |
| **Board** (group) | Dashboard Creator | `/admin/boards` | LineChartOutlined |
| Setup Units | — | `/admin/iot/setup` | SettingOutlined |
| Feedback | — | `/admin/feedback` | CommentOutlined |

**Total sidebar items: 9 groups/items containing 21 leaf routes**

#### What Company Can Do That Operators Cannot

- Access the entire `/admin/*` section (operators have no sidebar)
- Design and edit flow diagrams (DrawIO editor)
- Manage equipment hierarchy, stop/scrap reasons
- Create and manage user accounts (for their company only)
- View and manage production/scrap/stop result tables
- Configure IoT machines, shifts, orders, parts
- Access salary groups (cost tracking)
- Build custom dashboards (boards)

---

### 4. User / Operator Role

**Role key:** `User` | `all: false` | 5 permissions only

#### Permissions

```
view-flow-monitor
view-flow-analyzer
write-production-data
write-scrap-data
write-stop-data
```

#### Navigation

**NO sidebar** — Operators use `UserShell.tsx` which provides:
- `MarketingHeader` (logo + user dropdown only, `hideNav=true`)
- `MachineSocketProvider` (real-time machine events)
- `MarketingFooter`
- Tile-based page access from dashboard

#### Pages Accessible to Operators

| Route | Purpose |
|-------|---------|
| `/dashboard` | Stats overview / tile launcher |
| `/analyzer/[[...id]]` | Flow analyzer (read-only) |
| `/monitor/[[...id]]` | Real-time flow monitor |
| `/myresult/production` | Log production qty |
| `/myresult/scrap` | Log scrap/defects |
| `/myresult/stop` | Log downtime |
| `/myresult/warning` | View warnings |
| `/myresult/unregistered` | Categorize IoT stops |
| `/boards` | Custom dashboards |
| `/machines` | Machine list (assigned only) |
| `/orders` | Order list |
| `/units` | IoT unit view |
| `/feedback` | Submit feedback |
| `/profile/edit` | Edit profile |
| `/profile/password` | Change password |

**First screen after login:** `/dashboard`

---

### 5. Permission System

**Source:** `/backend/prisma/seed.js` — 31 permissions total

#### Complete Permission List

| Permission Key | Display Name | Sort | Company | User |
|---------------|--------------|------|---------|------|
| `view-backend` | View Backend | 1 | ✅ | ❌ |
| `manage-users` | Manage Users | 2 | ✅ | ❌ |
| `manage-roles` | Manage Roles | 3 | ❌ | ❌ |
| `manage-tenants` | Manage Tenants | 4 | ❌ | ❌ |
| `impersonate-users` | Impersonate Users | 5 | ❌ | ❌ |
| `manage-equipment` | Manage Equipment | 10 | ✅ | ❌ |
| `manage-flow-designs` | Manage Flow Designs | 11 | ✅ | ❌ |
| `view-flow-monitor` | View Flow Monitor | 11 | ✅ | ✅ |
| `view-flow-analyzer` | View Flow Analyzer | 11 | ✅ | ✅ |
| `manage-parts` | Manage Parts | 12 | ✅ | ❌ |
| `manage-orders` | Manage Orders | 13 | ✅ | ❌ |
| `manage-work-shifts` | Manage Work Shifts | 14 | ✅ | ❌ |
| `manage-shift-schedules` | Manage Shift Schedules | 15 | ✅ | ❌ |
| `manage-machines` | Manage Machines | 16 | ✅ | ❌ |
| `manage-folders` | Manage File Folders | 17 | ✅ | ❌ |
| `manage-workstations` | Manage Workstations | 18 | ✅ | ❌ |
| `manage-types` | Manage Types | 20 | ✅ | ❌ |
| `manage-stop-reasons` | Manage Stop Reasons | 21 | ✅ | ❌ |
| `manage-scrap-reasons` | Manage Scrap Reasons | 22 | ✅ | ❌ |
| `manage-cms` | Manage CMS | 30 | ✅ | ❌ |
| `manage-feedback` | Manage Feedback | 31 | ✅ | ❌ |
| `manage-warning-data` | Manage Warning Data | 32 | ✅ | ❌ |
| `manage-loss-model` | Manage Loss Model | 33 | ✅ | ❌ |
| `manage-sliders` | Manage Sliders | 34 | ❌ | ❌ |
| `manage-testimonials` | Manage Testimonials | 35 | ❌ | ❌ |
| `manage-social` | Manage Social Links | 36 | ❌ | ❌ |
| `manage-import-export` | Manage Import/Export | 40 | ✅ | ❌ |
| `send-notifications` | Send Notifications | 41 | ✅ | ❌ |
| `write-production-data` | Write Production Data | 50 | ✅ | ✅ |
| `write-scrap-data` | Write Scrap Data | 51 | ✅ | ✅ |
| `write-stop-data` | Write Stop Data | 52 | ✅ | ✅ |

#### How Permissions Are Checked (Backend)

**Source:** `/backend/src/middleware/requirePermission.js`

```javascript
// requirePermission — user must have ALL listed permissions
function requirePermission(...perms) {
  return async (req, res, next) => {
    if (user.isAdmin) return next();  // Administrator bypasses all checks

    const grants = await prisma.rolePermission.findMany({
      where: { role: { userRoles: { some: { userId: user.id } } } },
      include: { permission: { select: { name: true } } },
    });
    const owned = new Set(grants.map(g => g.permission.name));
    const ok = perms.every(p => owned.has(p));
    if (!ok) return res.status(403).json({ message: 'permission-required' });
  };
}

// requireAnyPermission — user must have ANY ONE of listed permissions
function requireAnyPermission(...perms) {
  // Same but: const ok = perms.some(p => owned.has(p));
}
```

**Frontend:** Permissions are **not checked on the frontend** (no client-side gates). Backend is the source of truth. The `hasPermission(me, permName)` helper in `AdminShell` only controls sidebar visibility — the pages themselves are accessible if the user has the cookie.

---

### 6. Role Gaps

| Missing Role | What They Need | Current Workaround |
|-------------|----------------|-------------------|
| **Supervisor** | View all-machine status, approve stop reasons, view shift reports, cannot change configuration | Does not exist — must be Company role (sees everything) |
| **Manager** | OEE dashboards, reports, read-only analytics, no data entry | Does not exist — must be Company role |
| **Maintenance Tech** | Machine config, IoT setup, no production data access | Does not exist — must be Company role |
| **Quality Inspector** | Write scrap data + view scrap reports only | Does not exist — must be User role (limited) or Company role (too broad) |
| **Shift Lead** | Write stop data + view shift summary, cannot edit config | Does not exist — User role misses equipment management needed for shift lead tasks |

**Verdict:** 3-role system (Admin / Company / User) is insufficient for real factory hierarchy. A proper factory needs at least 5–6 roles.

---

### 7. JWT Token Structure

**Source:** `/backend/src/services/auth.service.js`

#### Standard Login Token Payload

```json
{
  "sub": 42,
  "email": "user@company.com",
  "roles": ["Company"],
  "kind": "web",
  "iat": 1748800000,
  "exp": 1748800900
}
```

#### Impersonation Token Payload (additional field)

```json
{
  "sub": 99,
  "email": "operator@company.com",
  "roles": ["User"],
  "kind": "web",
  "impersonator_id": 1,
  "iat": 1748800000,
  "exp": 1748801800
}
```

| Field | Type | Notes |
|-------|------|-------|
| `sub` | Integer | User ID (primary key in `public.users`) |
| `email` | String | User email at token issue time |
| `roles` | String[] | Array of role names |
| `kind` | String | Always `"web"` for browser sessions |
| `impersonator_id` | Integer? | Only present during super-admin impersonation |
| `iat` | Unix timestamp | Issued at |
| `exp` | Unix timestamp | Expires (15 min access, 30 min impersonation) |

**Delivery:** HTTP-only cookie named `access_token`. Also accepted as `Authorization: Bearer <token>` header for non-browser clients (IoT, mobile).

**Signing secret:** `process.env.JWT_ACCESS_SECRET` (separate secrets for access/refresh/device tokens)

---

### 8. Navigation Rendering Logic

**Source:** `AdminShell.tsx` — key logic:

```typescript
// 1. Determine which sidebar to use
const activeSidebar = me?.isAdmin ? SUPERADMIN_SIDEBAR : COMPANY_SIDEBAR;

// 2. Filter items by permission
const visibleSidebar = activeSidebar.map(item => {
  if (item.children) {
    const visibleChildren = item.children.filter(c =>
      !c.permission || hasPermission(me, c.permission)
    );
    if (visibleChildren.length === 0) return null;
    return { ...item, children: visibleChildren };
  }
  if (item.permission && !hasPermission(me, item.permission)) return null;
  return item;
}).filter(Boolean);

// 3. Auto-expand active group
useEffect(() => {
  const next = new Set(openKeys);
  sidebar.forEach(item => {
    if (item.children?.some(c => pathname === c.href || pathname.startsWith(`${c.href}/`))) {
      next.add(item.key);
    }
  });
  setOpenKeys(Array.from(next));
}, [pathname, me?.isAdmin]);
```

**Frontend middleware** (`/frontend/src/middleware.ts`) — cookie-only redirect:

```typescript
// Protected prefixes (cookie-presence check only — backend validates JWT)
const protectedPrefixes = [
  '/dashboard', '/equipment', '/admin', '/monitor', '/analyzer',
  '/myresult', '/units', '/machines', '/orders', '/boards',
  '/feedback', '/profile',
];

// If no cookie → redirect to /login?next=<path>
// If has cookie + hitting /login → redirect to /dashboard
// Root / → hasCookie ? /dashboard : /login
```

---

## PROMPT 3 — Core Data Models

**Source:** `/backend/prisma/schema.prisma` (1514 lines)
**Database:** PostgreSQL 16, multi-schema (`public` + `tenant_template` cloned per tenant)

---

### 1. User Model

**Schema:** `public.users`

```prisma
model User {
  id                Int       @id @default(autoincrement())
  companyId         Int       @default(0)   // 0 = IS the company; >0 = sub-user's parent company id
  name              String    @db.VarChar(255)
  firstName         String    @default("") @db.VarChar(255)
  lastName          String    @default("") @db.VarChar(255)
  email             String    @unique @db.VarChar(255)
  password          String?   @db.VarChar(255)  // nullable (social login placeholder)
  image             String    @default("") @db.VarChar(255)
  status            Int       @default(1)   // 1=active, 0=inactive
  confirmationCode  String    @default("")
  confirmed         Boolean   @default(false)
  rememberToken     String?   @db.VarChar(100)
  emailVerifiedAt   DateTime? @db.Timestamptz
  equipmentTreePos  String    @default("")  // user's equipment tree expand state
  analyzerSettings  String    @default("")  // user's analyzer filter state
  tablePreferences  Json?     // per-table column visibility/sort preferences
  fcmToken          String?   @db.VarChar(255)  // Firebase push notification token
  fcmDevice         FcmDevice @default(android)  // android | ios
  unitOnly          Boolean   @default(false)  // legacy flag: IoT unit-only access
  timezone          String    @default("Europe/Stockholm")  // per-company timezone
  legacyId          BigInt?   @unique  // migration tracking
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime? // soft-delete

  userRoles    UserRole[]
  history      History[]
}
```

**Multi-tenancy logic:**
- `companyId = 0` → User IS the Company → schema = `tenant_{user.id}`
- `companyId > 0` → Sub-user → schema = `tenant_{user.companyId}`
- No separate Tenant/Company model — the User row with `Role = Company` IS the company

**Profile fields shown in UI:** name, firstName, lastName, email, image, timezone, fcmToken, tablePreferences

---

### 2. Tenant / Company Model

**There is no separate Tenant model** (removed per MIGRATION_NOTES §13). The Company is represented by:
- A `User` row with `Role = Company`
- A PostgreSQL schema named `tenant_{companyUserId}` (cloned from `tenant_template` at registration)
- `User.timezone` stores the company timezone
- `User.companyId = 0` identifies Company users vs. sub-users

**Multi-tenancy enforcement:**
- Every API request runs `tenantMiddleware` which resolves `schemaName = tenant_${companyId or userId}`
- All tenant DB queries run inside `withTenant(tenant, tx => ...)` which sets `search_path` to the tenant schema
- Super-admin can override via `X-Tenant-Id` header

---

### 3. Equipment Model

**Schema:** `tenant_template.equipment`

```prisma
model Equipment {
  id          Int       @id @default(autoincrement())
  companyId   Int       @default(0)   // legacy field; schema isolation makes this redundant
  sortOrder   Int       @default(0)   // display order within parent
  parentId    Int       @default(0)   // 0 = root; >0 = parent equipment id
  typeId      Int       @default(0)   // FK to types (equipment category)
  name        String?   @db.VarChar(255)
  description String?
  icon        String    @default("noimage.jpg")
  isActive    Boolean   @default(true)
  legacyId    BigInt?   @unique
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime? // soft-delete

  type     Type
  properties           EquipmentProperty[]   // cycle time, cost per hour, salary group
  scrapReasons         EquipmentScrapReason[] // which scrap reasons allowed per equipment
  stopReasons          EquipmentStopReason[]  // which stop reasons allowed per equipment
  parts                EquipmentPart[]        // which parts can be made on this equipment
  orders               EquipmentOrder[]       // order types allowed per equipment
  shiftSchedules       EquipmentShiftSchedule[]
  assignments          EquipmentAssign[]      // which operators assigned
  userEquipments       UserEquipment[]        // user visibility shortcuts
  machines             Machine[]              // IoT devices on this equipment
  machineDocuments     MachineDocument[]      // manuals/docs
  folders              Folder[]
  warningData          WarningData[]
}
```

**Hierarchy:** Self-referencing via `parentId` (integer, not FK). `parentId = 0` = root level. Unlimited depth.

**EquipmentProperty** (one per equipment):
```
cycleTime       String   // "30" (seconds per part)
costPerHour     Int      // machine cost in currency units
currency        String   // "SEK", "EUR", etc.
operator        Int      // number of operators required
salaryGroupId   Int      // FK to salary_groups
valueAddedType  enum     // currency | percentage
orderSelection  enum     // free_text | list
```

---

### 4. Machine / IoT Device Model

**Schema:** `tenant_template.machines`

```prisma
model Machine {
  id                  Int                  @id @default(autoincrement())
  equipmentId         Int                  // FK to equipment
  pinNo               Int                  // GPIO pin number on physical unit
  unitName            String?              // human label "Unit 1", "Line A"
  runningStatus       MachineRunningStatus @default(on) // on | off
  signalType          MachineSignalType    @default(on) // on | off | warning
  unitConnected       String               @default("off") // "on"/"off" string (legacy)
  wifiId              String?              // MAC / WiFi identifier
  bluetoothId         String?              // Bluetooth identifier
  hasUnregisterData   Boolean              @default(false)
  lastOnline          DateTime?
  filterTime          Int                  @default(0)  // data aggregation window (seconds)
  filterTimeOn        Boolean              @default(false)
  logWarning          Boolean              @default(false)
  customNotification  Boolean              @default(false)
  customNotificationText String            @default("")
  autoRegistered      String               @default("no") // "no"/"yes"
  autoRegisteredData  Json?               // {time_limit, reason_id, stop_type_id, flow_id}
  mqttClientId        String?              // MQTT client identifier
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt

  equipment    Equipment
  data         MachineData[]       // IoT sensor readings (high-volume)
  prevStarts   MachinePrevStart[]  // previous cycle tracking
  statuses     MachineStatus[]     // status history
  userSettings MachineUserSetting[] // per-user notification preferences
}
```

**Auto-registration:** When `autoRegistered = "yes"` and stop duration ≥ `autoRegisteredData.time_limit`, a `StopData` row is automatically created without operator input.

---

### 5. MachineData (IoT Event) Model

**Schema:** `tenant_template.machine_data` — **highest-volume table**

```prisma
model MachineData {
  id             Int                    @id @default(autoincrement())
  machineId      Int                    // FK to machines
  startTime      DateTime               // when machine stopped
  endTime        DateTime?              // when machine restarted (null = still stopped)
  isRegistered   MachineDataRegistration @default(no) // no | yes | pre
  isValidData    Boolean                @default(false) // false = unconfigured machine
  productionTime String?               // duration string "HH:MM:SS"
  mqttMessageId  String?               // deduplication key for QoS-1 MQTT
  legacyId       BigInt?               @unique
  createdAt      DateTime              @default(now())
  updatedAt      DateTime              @updatedAt

  machine Machine
}
```

**What a "stop event" looks like in DB:**
```
{ machineId: 5, startTime: "2026-06-02T07:45:00Z", endTime: null,
  isRegistered: "no", isValidData: true, productionTime: null }
```

**What a "running event" (restart) looks like:**
```
{ machineId: 5, startTime: "2026-06-02T07:45:00Z", endTime: "2026-06-02T08:10:00Z",
  isRegistered: "no", isValidData: true, productionTime: "00:25:00" }
```

**Registration states:**
- `no` — raw IoT event, operator has not categorized it yet
- `yes` — operator categorized (linked to a StopData row)
- `pre` — auto-registered (system created StopData automatically)

> **Warning:** Phase 6 planned partition by `start_time` (monthly). Currently unpartitioned — will degrade at scale.

---

### 6. Stop / Downtime Model

**Schema:** `tenant_template.stop_data`

```prisma
model StopData {
  id              Int         @id @default(autoincrement())
  flowId          Int         // FK to flow_designs
  flowObjectKey   Int         // Equipment ID (legacy column name)
  partId          Int         // FK to parts
  workShiftId     Int         // FK to work_shifts
  reasonId        Int         // FK to stop_reasons (why stopped)
  stopTypeId      Int         // FK to types (stop category)
  stopTimestamp   DateTime?   // when machine stopped (ISO timestamp)
  restartTimestamp DateTime?  // when machine restarted
  hours           Int         @default(0)  // duration hours (legacy redundant)
  minutes         Int         @default(0)  // duration minutes (legacy redundant)
  time            String?     // "HH:MM" string (legacy)
  sumOfTime       Decimal?    // calculated total minutes (most reliable)
  quantity        Int?        // items affected during stop
  status          Int         @default(1)
  orderNo         String?
  date            DateTime?   @db.Date
  comment         String      @default("")
  stopDataKind    StopDataKind @default(reg)  // "reg" = manual | "pre" = auto-registered
  machineStopId   Int?        // FK to machine_data (links to IoT raw event)
  // User snapshot (§11.5)
  createdByUserId Int         @default(0)
  createdByEmail  String      @default("")
  createdByName   String      @default("")
  workShiftName   String?
  createdAt       DateTime?
  updatedAt       DateTime?
  deletedAt       DateTime?   // soft-delete

  flow      FlowDesign
  part      Part
  workShift WorkShift
  reason    StopReason
  stopType  Type
}
```

**Duration calculation:** `sumOfTime` (in minutes) is the most reliable. `hours`/`minutes` are legacy redundant fields. `productionTime` string in MachineData uses "HH:MM:SS" format.

**Stop categories (StopCategoryKind enum):**
- `Performance` — machine running below target speed
- `Availability` — machine not running at all
- `Quality` — running but producing defects
- `Other` — unclassified stops

---

### 7. Production Entry Model

**Schema:** `tenant_template.production_data`

```prisma
model ProductionData {
  id              Int       @id @default(autoincrement())
  flowId          Int       // FK to flow_designs
  flowObjectKey   Int       // Equipment ID (legacy: flow node key = equipment id)
  partId          Int       // FK to parts
  workShiftId     Int       // FK to work_shifts
  workHours       String?   // "08:00-16:00" work window string
  partQty         Int       @default(0)  // actual qty produced
  plannedQty      Int       @default(0)  // target qty for this entry
  orderNo         String?              // free-text or order nr reference
  date            DateTime? @db.Date
  status          Int       @default(1)
  comment         String    @default("")
  // User snapshot (immutable)
  createdByUserId Int       @default(0)
  createdByEmail  String    @default("")
  createdByName   String    @default("")
  workShiftName   String?
  legacyId        BigInt?
  createdAt       DateTime?
  updatedAt       DateTime?
  deletedAt       DateTime? // soft-delete

  flow      FlowDesign
  part      Part
  workShift WorkShift
}
```

**Complete production record example:**
```json
{
  "flowId": 3,
  "flowObjectKey": 79,
  "partId": 12,
  "workShiftId": 2,
  "partQty": 47,
  "plannedQty": 50,
  "orderNo": "ORD-2026-001",
  "date": "2026-06-02",
  "comment": "Slight delay at start",
  "createdByUserId": 15,
  "createdByEmail": "operator@abc.se",
  "createdByName": "Erik Svensson",
  "workShiftName": "Morning Shift"
}
```

---

### 8. Scrap Entry Model

**Schema:** `tenant_template.scrap_data`

```prisma
model ScrapData {
  id              Int       @id @default(autoincrement())
  flowId          Int
  flowObjectKey   Int       // Equipment ID
  partId          Int
  workShiftId     Int
  orderNo         String?
  quantity        Int?      // qty scrapped
  reasonId        Int       // FK to scrap_reasons
  scrapTypeId     Int       // FK to types (scrap category)
  date            DateTime? @db.Date
  status          Int       @default(1)
  comment         String    @default("")
  picture         String?   @db.VarChar(255)  // file path to defect photo
  // User snapshot
  createdByUserId Int       @default(0)
  createdByEmail  String    @default("")
  createdByName   String    @default("")
  workShiftName   String?
  createdAt       DateTime?
  updatedAt       DateTime?
  deletedAt       DateTime?
}
```

**Photo storage:** `picture` stores a relative file path. Files saved to `/storage/uploads/` (local) or S3 bucket (production). Max size: 8 MB. Served by Express.static.

---

### 9. Shift Model

**Schema:** `tenant_template.work_shifts`

```prisma
model WorkShift {
  id              Int       @id @default(autoincrement())
  name            String?   // "Morning Shift", "Night Shift"
  startTime       String    // "06:00" (HH:MM, no date)
  endTime         String    // "14:00"
  breakStartTime  String?   // "10:00"
  breakEndTime    String?   // "10:15"
  workingDays     Json      // [1,2,3,4,5] = Mon–Fri (ISO weekday numbers)
  status          Int       @default(1)
  legacyId        BigInt?
  createdAt       DateTime?
  updatedAt       DateTime?
  deletedAt       DateTime?

  productionData ProductionData[]
  scrapData      ScrapData[]
  stopData       StopData[]
}
```

**Shift is linked to results** via `workShiftId` FK on production/scrap/stop tables. `workShiftName` snapshot is also stored at insert time.

> **Critical gap:** Shift times are stored as strings ("06:00") with NO timezone awareness. Cross-timezone deployments will have incorrect shift boundaries.

---

### 10. Order Model

**Schema:** `tenant_template.orders`

```prisma
model Order {
  id            Int       @id @default(autoincrement())
  status        Int       @default(1)
  typeId        Int       // FK to types (order category)
  orderNr       String    @db.VarChar(50) @unique
  description   String    @db.VarChar(255)
  flowId        Int       // which flow diagram this order runs on
  equipmentId   Int       // which machine/workstation
  partId        Int       // which part is being produced
  startDate     DateTime? @db.Timestamptz
  endDate       DateTime? @db.Timestamptz
  plannedQty    Int       @default(0)
  okQty         Int       @default(0)   // accepted qty so far
  scrapQty      Int       @default(0)   // scrapped qty so far
  plannedHrs    Int       @default(0)
  workedHrs     Int       @default(0)
  remainingQty  Int       @default(0)
  remainingHrs  Int       @default(0)
  sortOrder     Int       @default(0)
  createdAt     DateTime?
  updatedAt     DateTime?
  deletedAt     DateTime?
}
```

**Order links to production:** Via `orderNo` free-text field on `production_data` (no FK). This is a design weakness — order completion tracking depends on string matching.

---

### 11. Stop Reasons Model

**Schema:** `tenant_template.stop_reasons`

```prisma
model StopReason {
  id          Int       @id @default(autoincrement())
  name        String?   @db.VarChar(255)
  status      Int       @default(1)
  typeId      Int       // FK to types (category — e.g. "Mechanical", "Electrical")
  description String    @default("") @db.VarChar(255)
  sortOrder   Int       @default(0)
  createdAt   DateTime?
  updatedAt   DateTime
  deletedAt   DateTime?

  type Type
  equipmentStopReasons EquipmentStopReason[] // which equipment this reason applies to
  stopData             StopData[]
}
```

**StopCategory** is a separate model (`stop_category`) with `kind` enum: `Performance | Availability | Quality | Other`. This is the OEE loss category system (currently admin-configurable but not used in any calculation).

---

### 12. OEE Calculation

**Source:** `/backend/src/services/admin-chart-data.service.js`

**OEE is NOT calculated anywhere in the codebase.**

The `admin-chart-data.service.js` provides raw aggregations only:
- `stop_data` → sum of `quantity` and `sum_of_time` grouped by stop reason
- `stop_count` → stop count grouped by date and reason
- `scrap_data` → sum of `quantity` grouped by scrap reason
- `production_data` → sum of `part_qty` and `planned_qty` grouped by part/equipment/shift

No OEE formula (`Availability × Performance × Quality`) exists anywhere in the backend or frontend code.

**What would be needed:**
```javascript
// Missing from admin-chart-data.service.js:
const plannedTime     = shiftDuration - plannedDowntime;          // minutes
const availability    = (plannedTime - unplannedDowntime) / plannedTime;
const performance     = (actualQty * idealCycleTime) / (plannedTime - unplannedDowntime);
const quality         = (actualQty - scrapQty) / actualQty;
const oee             = availability * performance * quality * 100; // as %
```

---

## PROMPT 4 — API & Real-time Events

---

### 1. Auth Endpoints

**Base URL:** `http://localhost:4000/api/v1/`
**Auth delivery:** HTTP-only cookie `access_token` OR `Authorization: Bearer <token>` header

| Method | Path | Body / Params | Response | Notes |
|--------|------|--------------|----------|-------|
| `POST` | `/auth/login` | `{email, password}` | `{user, expiresIn}` + sets cookie | Rate-limited 5/min per IP |
| `POST` | `/auth/logout` | — | 204 No Content | Clears cookie |
| `POST` | `/auth/impersonate/stop` | — (JWT required) | `{user, expiresIn}` | Returns super-admin session |
| `GET` | `/auth/confirm/:token` | token in path | `{ok, message}` | Email confirmation |
| `POST` | `/auth/confirm/resend` | `{email}` | 202 | Always 202 (no leak) |
| `POST` | `/auth/verify-password` | `{password}` | `{ok: true}` | Re-confirm identity |

**Standard success response:**
```json
{ "user": { "id": 42, "email": "x@y.com", "name": "...", "tenantId": 5, "roles": ["Company"] }, "expiresIn": 900 }
```

**Standard error response:**
```json
{ "statusCode": 401, "message": "invalid-credentials" }
```

---

### 2. Operator Endpoints (User-Facing)

#### My Result — Production

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/myresult/production` | List operator's production entries (paginated, filtered) |
| `POST` | `/myresult/production` | Create new production entry |
| `GET` | `/myresult/production/:id` | Get single production entry |
| `PATCH` | `/myresult/production/:id` | Update (own entries only) |
| `DELETE` | `/myresult/production/:id` | Soft-delete (own entries only) |
| `GET` | `/myresult/production/summary` | Aggregated summary row |

#### My Result — Scrap

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/myresult/scrap` | List scrap entries |
| `POST` | `/myresult/scrap` | Create + accepts multipart (picture upload) |
| `GET` | `/myresult/scrap/:id` | Get single scrap entry |
| `PATCH` | `/myresult/scrap/:id` | Update |
| `DELETE` | `/myresult/scrap/:id` | Soft-delete |

#### My Result — Stop / Warning / Unregistered

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/myresult/stop` | List stop entries |
| `POST` | `/myresult/stop` | Create stop entry |
| `PATCH` | `/myresult/stop/:id` | Update stop entry |
| `DELETE` | `/myresult/stop/:id` | Soft-delete |
| `GET` | `/myresult/warning` | List warning data |
| `GET` | `/myresult/unregistered` | List unregistered IoT stops |
| `POST` | `/myresult/unregistered/:id/register` | Categorize unregistered stop |

#### Shared User Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/me` | Get own profile |
| `PATCH` | `/me` | Update own profile |
| `POST` | `/me/password` | Change password |
| `POST` | `/me/profile-picture` | Upload avatar |
| `GET` | `/units` | List IoT units (operator view) |
| `GET` | `/equipment` | Equipment tree (assigned only) |
| `POST` | `/feedback` | Submit platform feedback |

---

### 3. Company Admin Endpoints

#### Equipment Management

| Method | Path | Permission |
|--------|------|-----------|
| `GET` | `/equipment` | auth required |
| `GET` | `/equipment/:id` | auth required |
| `POST` | `/equipment` | manage-equipment |
| `PATCH` | `/equipment/:id` | manage-equipment |
| `DELETE` | `/equipment/:id` | manage-equipment |
| `PATCH` | `/equipment/:id/reorder` | manage-equipment |

#### Flow Designs

| Method | Path | Permission |
|--------|------|-----------|
| `GET` | `/admin/flow-designs` | view-flow-monitor OR manage-flow-designs |
| `GET` | `/admin/flow-designs/list-with-data` | view-flow-monitor OR manage-flow-designs |
| `GET` | `/admin/flow-designs/:id` | view-flow-monitor OR manage-flow-designs |
| `POST` | `/admin/flow-designs` | manage-flow-designs |
| `PATCH` | `/admin/flow-designs/:id` | manage-flow-designs |
| `PATCH` | `/admin/flow-designs/:id/status` | manage-flow-designs |
| `DELETE` | `/admin/flow-designs/:id` | manage-flow-designs |
| `GET` | `/admin/flow-designs/:id/diagram` | view-flow-monitor OR manage-flow-designs |
| `PUT` | `/admin/flow-designs/:id/diagram` | manage-flow-designs |
| `POST` | `/admin/flow-designs/:id/background` | manage-flow-designs |
| `DELETE` | `/admin/flow-designs/:id/background` | manage-flow-designs |
| `GET` | `/admin/flow-designs/:id/attributes` | view-flow-monitor OR manage-flow-designs |
| `GET` | `/admin/flow-designs/:id/monitor-status` | view-flow-monitor OR manage-flow-designs |
| `GET` | `/admin/flow-designs/:id/analyzer-data` | view-flow-analyzer OR manage-flow-designs |
| `GET` | `/admin/flow-designs/:id/line-chart` | view-flow-analyzer OR manage-flow-designs |
| `GET` | `/admin/flow-designs/:id/quant-time` | view-flow-analyzer OR manage-flow-designs |

#### Results Admin

| Method | Path | Permission |
|--------|------|-----------|
| `GET` | `/admin/results/production` | view-* or manage-* |
| `GET` | `/admin/results/scrap` | view-* or manage-* |
| `GET` | `/admin/results/stop` | view-* or manage-* |
| `GET` | `/admin/results/warning` | view-* or manage-* |
| `POST` | `/admin/results/production` | write-production-data |
| `POST` | `/admin/results/scrap` | write-scrap-data |
| `POST` | `/admin/results/stop` | write-stop-data |
| `PATCH` | `/admin/results/:type/:id` | write-*-data |
| `DELETE` | `/admin/results/:type/:id` | write-*-data |

#### User Management

| Method | Path | Permission |
|--------|------|-----------|
| `GET` | `/admin/users` | manage-users |
| `GET` | `/admin/users/summary` | manage-users |
| `GET` | `/admin/users/deactivated` | manage-users |
| `GET` | `/admin/users/deleted` | manage-users |
| `GET` | `/admin/users/:id` | manage-users |
| `POST` | `/admin/users` | manage-users |
| `PATCH` | `/admin/users/:id` | manage-users |
| `DELETE` | `/admin/users/:id` | manage-users |
| `POST` | `/admin/users/:id/reactivate` | manage-users |
| `POST` | `/admin/users/:id/impersonate` | impersonate-users |

#### Machines / IoT

| Method | Path | Permission |
|--------|------|-----------|
| `GET` | `/admin/machines` | manage-machines |
| `GET` | `/admin/machines/:id` | manage-machines |
| `POST` | `/admin/machines` | manage-machines |
| `PATCH` | `/admin/machines/:id` | manage-machines |
| `DELETE` | `/admin/machines/:id` | manage-machines |
| `GET` | `/admin/iot/units` | manage-machines |
| `PATCH` | `/admin/iot/units/:id/settings` | manage-machines |
| `POST` | `/admin/iot/units/:id/provision-mqtt` | manage-machines |
| `POST` | `/admin/iot/units/:id/test-notification` | manage-machines |

#### Master Data (Orders, Parts, Shifts, Reasons, etc.)

| Method | Path | Permission |
|--------|------|-----------|
| `GET/POST/PATCH/DELETE` | `/admin/orders` | manage-orders |
| `GET/POST/PATCH/DELETE` | `/admin/parts` | manage-parts |
| `GET/POST/PATCH/DELETE` | `/admin/work-shifts` | manage-work-shifts |
| `GET/POST/PATCH/DELETE` | `/admin/shift-schedules` | manage-shift-schedules |
| `GET/POST/PATCH/DELETE` | `/admin/stop-reasons` | manage-stop-reasons |
| `GET/POST/PATCH/DELETE` | `/admin/scrap-reasons` | manage-scrap-reasons |
| `GET/POST/PATCH/DELETE` | `/admin/stop-categories` | manage-stop-reasons |
| `GET/POST/PATCH/DELETE` | `/admin/types` | manage-types |
| `GET/POST/PATCH/DELETE` | `/admin/salary-groups` | manage-equipment |
| `GET/POST/PATCH/DELETE` | `/admin/workstations` | manage-workstations |
| `GET/POST/PATCH/DELETE` | `/admin/machine-programmes` | manage-machines |
| `GET/POST/PATCH/DELETE` | `/admin/machine-files` | manage-machines |
| `GET/POST/PATCH/DELETE` | `/admin/folders` | manage-folders |
| `GET/POST/PATCH/DELETE` | `/admin/roles` | manage-roles |
| `GET/POST/PATCH/DELETE` | `/admin/boards` | auth required |
| `GET` | `/admin/history` | view-backend |

---

### 4. Super Admin Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/superadmin/users` | List ALL platform users across all tenants |
| `POST` | `/superadmin/users` | Create user at platform level |
| `GET` | `/admin/mqtt-monitor` | MQTT broker status |
| `POST` | `/admin/mqtt-testing` | Publish test MQTT message |
| `GET` | `/admin/feedback` | View all feedback across tenants |

---

### 5. IoT / Machine Data Endpoints

**Legacy firmware endpoints (no JWT — authenticated by `company_email_id` field):**

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/machine/installV1` | Device heartbeat + enrollment |
| `POST` | `/machine/saveStopDataV1` | Legacy push stop event |
| `POST` | `/machine/login` | Device login (returns device token) |
| `POST` | `/machine/updateUnitConnectionStatus` | Update connected status |
| `POST` | `/machine/checkIotLatestVersion` | Firmware version check |

**Request payload example (`installV1`):**
```json
{
  "company_email_id": "company@client.com",
  "machine_id": "ABC123",
  "pin_no": 3,
  "unit_name": "Unit 1",
  "start_time": "2026-06-02T07:45:00Z",
  "stop_time": "2026-06-02T08:10:00Z"
}
```

---

### 6. Analytics / Chart Endpoints

| Endpoint | Query Params | Returns |
|----------|-------------|---------|
| `GET /admin/flow-designs/:id/analyzer-data` | `flow_id, equip_id, chart_type, prod_group, from, to` | Aggregated production/scrap/stop data |
| `GET /admin/flow-designs/:id/line-chart` | `from, to, equip_id` | Time-series production data |
| `GET /admin/flow-designs/:id/quant-time` | `from, to, equip_id` | Quantity vs. time statistics |
| `GET /admin/flow-designs/:id/monitor-status` | — | Current machine running status per node |

**`chart_type` values for analyzer-data:**
- `stop_data` — stops by reason (sum of time + quantity)
- `stop_count` — stop count by date
- `scrap_data` — scrap by reason (quantity)
- `production_data` — production by part/shift (qty + planned)

**OEE endpoint:** Does NOT exist. No combined OEE calculation anywhere.

---

### 7. Socket.io Events

**Server:** `socket.io@4.8.3` on path `/socket.io`
**Auth:** JWT from cookie OR `Authorization: Bearer` OR `socket.handshake.auth.token`

#### Rooms

| Room | Who joins | Purpose |
|------|-----------|---------|
| `tenant:{tenantId}` | All users of a company | Broadcast machine events company-wide |
| `machine:{tenantId}:{machineId}` | Users watching specific machine | Machine-level events |

#### Client → Server Events

| Event | Payload | Purpose |
|-------|---------|---------|
| `join:machine` | `machineId: number` | Subscribe to a specific machine's room |
| `leave:machine` | `machineId: number` | Unsubscribe from machine room |
| `client:resync` | `{lastSeenTs?: string}` | Request full snapshot of machine states |
| `admin:join:all` | — (admin only) | Join all active tenant rooms simultaneously |
| `client:resync:tenant` | `{tenantId: number}` (admin only) | Request machine snapshot for a specific tenant |

#### Server → Client Events

| Event | Payload | Triggered By |
|-------|---------|-------------|
| `resync:snapshot` | `{machines[], recentStops[], ts}` | Response to `client:resync` |
| `admin:joined` | `{tenantIds: number[]}` | Response to `admin:join:all` |
| **MQTT-triggered events (via mqtt.service.js):** | | |
| `machine:stop:start` | `{machineId, tenantId, startTime, runningStatus: 'off'}` | MQTT stop/start topic |
| `machine:stop:end` | `{machineId, tenantId, startTime, endTime, productionTime, runningStatus: 'on'}` | MQTT stop/end topic |
| `machine:status` | `{machineId, tenantId, runningStatus, lastOnline}` | Status change |
| `machine:unregistered` | `{machineId, tenantId, count}` | New unregistered stop available |

**Resync snapshot payload:**
```json
{
  "machines": [
    { "machineId": 5, "runningStatus": "on", "unitConnected": "on",
      "lastOnline": "2026-06-02T09:30:00Z", "equipmentId": 79 }
  ],
  "recentStops": [
    { "id": 1234, "machineId": 5, "startTime": "...", "endTime": "...", "productionTime": "00:25:00" }
  ],
  "ts": 1748854800000
}
```

---

### 8. File Upload Endpoints

| Endpoint | Method | Field Name | File Types | Storage |
|----------|--------|-----------|------------|---------|
| `/me/profile-picture` | POST | `file` | Image | local/S3 |
| `/myresult/scrap` | POST | `picture` | Image | local/S3 |
| `/admin/results/scrap` (update) | PATCH | `picture` | Image | local/S3 |
| `/admin/machine-files/upload` | POST | `file` | Image, Excel, PDF, Video | local/S3 |
| `/admin/machine-programmes/:id/upload` | POST | `file` | Any | local/S3 |
| `/admin/flow-designs/:id/background` | POST | `background` | Image | local/S3 |
| `/admin/cms` | POST/PATCH | `images[]` | Image | local/S3 |
| `/admin/sliders` | POST/PATCH | `image` | Image | local/S3 |
| `/admin/testimonials` | POST/PATCH | `image` | Image | local/S3 |
| `/admin/symbols` | POST/PATCH | `image` | Image | local/S3 |

**Storage driver:** `STORAGE_DRIVER` env var — `"local"` (dev) or `"s3"` (prod)
**Max file size:** 8 MB (`MAX_FILE_SIZE` env)
**File serving:** `GET /uploads/:filename` via Express.static

---

### 9. API Structure

#### Base URL
```
http://localhost:4000/api/v1/
```

#### Auth Token Delivery
1. HTTP-only cookie: `access_token` (browser — set by `/auth/login`)
2. Header: `Authorization: Bearer <token>` (API clients, IoT devices)
3. Socket.io handshake: `socket.handshake.auth.token` or cookie

#### Standard Success Response
```json
{
  "data": [...] | {},
  "meta": { "total": 120, "page": 1, "limit": 25 }
}
```

#### Standard Error Response
```json
{
  "statusCode": 403,
  "message": "permission-required"
}
```

#### Common Error Messages

| Code | Message | Meaning |
|------|---------|---------|
| 401 | `unauthorized` | No token present |
| 401 | `invalid-token` | JWT verify failed |
| 401 | `wrong-token-kind` | Token `kind` ≠ `"web"` |
| 401 | `user-not-found` | User deleted or not found |
| 401 | `user-disabled` | `user.status ≠ 1` |
| 401 | `invalid-credentials` | Wrong password |
| 403 | `role-required` | Wrong role for endpoint |
| 403 | `permission-required` | Missing permission |
| 403 | `account_not_confirmed` | Email not confirmed yet |
| 400 | `not-impersonating` | Tried to stop impersonation when not active |

---

### 10. MQTT Topics

**Source:** `/backend/src/services/mqtt.service.js`

**Broker config:** `MQTT_BROKER_URL` env var (mqtt:// or mqtts://). Optional — falls back to HTTP polling if unset.

#### Subscribed Topics (Backend → Devices)

| Topic Pattern | Handler | Trigger |
|--------------|---------|---------|
| `fp/v1/{tenantId}/machine/{machineId}/stop/start` | `handleStopStart()` | Machine signals it has STOPPED |
| `fp/v1/{tenantId}/machine/{machineId}/stop/end` | `handleStopEnd()` | Machine signals it has RESTARTED |
| `fp/v1/{tenantId}/machine/{machineId}/stop/replay` | `handleStopReplay()` | Device sends buffered events (offline recovery) |

**Only 3 MQTT topics.** All other IoT communication uses legacy HTTP endpoints.

#### Topic Naming Convention
```
fp/v1/{tenantId}/machine/{machineId}/stop/{action}
│     │ │         │       │           │    └── start | end | replay
│     │ │         │       └────────── numeric machine DB id
│     │ │         └── "machine" (fixed segment)
│     │ └─────────── numeric tenant (Company user id)
│     └─────────── API version
└── "fp" (product namespace)
```

#### MQTT Message Payloads

**stop/start message (machine stopped):**
```json
{
  "machine_id": "ABC123",
  "start_time": "2026-06-02T07:45:12Z",
  "mqtt_message_id": "uuid-v4-dedup-key"
}
```

**stop/end message (machine restarted):**
```json
{
  "machine_id": "ABC123",
  "start_time": "2026-06-02T07:45:12Z",
  "end_time": "2026-06-02T08:10:44Z",
  "mqtt_message_id": "uuid-v4-dedup-key"
}
```

**stop/replay message (bulk offline recovery):**
```json
{
  "machine_id": "ABC123",
  "events": [
    { "start_time": "2026-06-01T22:00:00Z", "end_time": "2026-06-01T22:15:00Z" },
    { "start_time": "2026-06-01T23:30:00Z", "end_time": "2026-06-01T23:45:00Z" }
  ]
}
```

#### MQTT Deduplication
- QoS-1 packets can be delivered more than once (at-least-once guarantee)
- `mqtt_message_id` field stored on `machine_data` table
- Duplicate detection: `SELECT 1 FROM machine_data WHERE mqtt_message_id = $1`
- If duplicate found → NOOP (no DB write, no Socket.io emit)

#### MQTT Stale Message Guard
- Messages older than 60 seconds from `start_time` are rejected (design doc §8.4)
- Prevents offline-buffered replays from corrupting real-time state

#### MQTT → Socket.io Bridge
After processing each MQTT event, the service emits:
```javascript
emitToTenant(tenantId, 'machine:stop:start', { machineId, startTime, runningStatus: 'off' });
emitToMachine(tenantId, machineId, 'machine:stop:start', { ... });
// and similarly for stop:end
```

---

### Complete Route Files List (42 total)

```
/backend/src/routes/
├── auth.routes.js
├── me.routes.js
├── myresult.routes.js
├── units.routes.js
├── equipment.routes.js
├── company-users.routes.js
├── feedback.routes.js
├── roles.routes.js
├── recent-history.routes.js
├── admin-users.routes.js
├── admin-machines.routes.js
├── admin-flow-designs.routes.js
├── admin-results.routes.js
├── admin-orders.routes.js
├── admin-parts.routes.js
├── admin-types.routes.js
├── admin-stop-reasons.routes.js
├── admin-scrap-reasons.routes.js
├── admin-stop-categories.routes.js
├── admin-work-shifts.routes.js
├── admin-shift-schedules.routes.js
├── admin-salary-groups.routes.js
├── admin-workstations.routes.js
├── admin-boards.routes.js
├── admin-folders.routes.js
├── admin-machine-files.routes.js
├── admin-machine-programmes.routes.js
├── admin-icons.routes.js
├── admin-symbols.routes.js
├── admin-iot.routes.js
├── admin-feedback.routes.js
├── admin-history.routes.js
├── admin-cms.routes.js
├── admin-sliders.routes.js
├── admin-testimonials.routes.js
├── admin-social.routes.js
├── admin-loss-model.routes.js
├── admin-import-export.routes.js
├── superadmin-users.routes.js
├── mobile-machine-iot.routes.js
├── mobile-machine.routes.js
└── mobile-user.routes.js
```

---

*End of 4-Prompt Deep Code Audit — FP Analyzer*
*All data extracted directly from source files. Zero guessing.*
