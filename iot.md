# FP Analyzer — IoT API: Product Documentation & Technical Report

> **Base URL:** `https://api.fptest.com/api/v1/machine/`  
> **Backend stack:** Node.js / Express.js (migrated from Laravel/PHP)  
> **Auth model:** JWT cookie (`access_token`) **or** legacy `company_email_id` body field for firmware units  
> **Date:** 2026-05-20

---

## Summary Table

| Endpoint | HTTP | Purpose | Primary DB Table(s) | Triggers Notifications? | Offline Supported? | Auth Method |
|---|---|---|---|---|---|---|
| `POST /auth/login` | POST | Obtain JWT session token | `users` (master DB) | No | No | Email + password |
| `saveStopDataV1` | POST | Record machine stop start | `machine_data`, `machine_status`, `machines` | No (stub only) | No | JWT **or** `company_email_id` |
| `installV1` | POST | Heartbeat / restart / new unit enroll | `machines`, `machine_status`, `machine_data` | No | No | JWT **or** `company_email_id` |
| `saveOfflineData` | POST | Bulk replay of buffered stop events | `machine_data`, `machines`, `stop_data` (auto-reg) | No | **Yes — this IS the offline mechanism** | JWT only |
| `updateUnitConnectionStatus` | POST | Manually toggle unit connectivity flag | `machines` | No | No | JWT only |
| `checkIotLatestVersion` | POST | Check for firmware upgrade | Redis, env vars (no DB) | No | No | JWT only |

---

## Part 1 — Product Document

### 1.1 What Is the IoT Integration?

FP Analyzer places small IoT hardware units on factory machines (lathes, assembly stations, etc.). Each unit sends signals over Wi-Fi back to this API. The system uses these signals to:

- Know whether a machine is **running or stopped** at any moment.
- Record **when a stop started and when it ended**, so analysts can calculate how much production time was lost.
- Alert operators when a machine goes down.
- Keep the data intact even when the factory's Wi-Fi goes offline.

The API acts as the bridge between physical factory hardware and the analytics dashboard.

---

### 1.2 How Each Endpoint Contributes to Machine Monitoring

#### Step 1 — Machine Login (the `login` endpoint)
Before a firmware unit can use the protected API endpoints, a company administrator logs in via email and password to obtain a session cookie. Field units that run older firmware skip this step and authenticate by embedding the company owner's email directly in every request body (`company_email_id` field). This dual-auth design preserves compatibility with deployed hardware that cannot be updated easily.

#### Step 2 — Unit Enrollment (`installV1`)
The first time a new IoT board powers up, it calls `installV1`. If no matching machine record exists in the database, the system auto-creates an "unconfigured" placeholder row. An operator later logs into the admin dashboard to bind that placeholder to a real piece of equipment (e.g., "Lathe 3" or "Assembly Line B"). Until that binding happens, stop data from the unit is saved but **not** forwarded to analytics.

On every subsequent power-up, `installV1` acts as a **heartbeat / restart signal**: it marks the machine as "running" and records the Wi-Fi/Bluetooth signal IDs. When the unit sends both a `start_time` and `end_time`, the system interprets this as a **restart after a stop** and closes out the open stop record.

#### Step 3 — Stop Detection (`saveStopDataV1`)
When the IoT sensor detects the machine has stopped (power draw drops, vibration ceases, etc.), it immediately calls `saveStopDataV1` with a `start_time`. The system:

1. Confirms the unit is connected.
2. Checks whether the machine already has an open stop (if so, this is a **long-stop continuation** and the call is silently acknowledged without creating a duplicate record).
3. Otherwise, creates an open stop record and marks the machine as "off".

The stop remains "open" (no end time) until the machine restarts and calls `installV1` again.

#### Step 4 — Handling Offline Scenarios (`saveOfflineData`)
If the factory Wi-Fi goes down, the IoT unit buffers stop events locally on its own storage. When connectivity resumes, it calls `saveOfflineData` once with the entire backlog as a JSON array. The server processes events in chronological order and stops at the first failure, so the firmware knows exactly which events were saved and can retry from that point.

#### Step 5 — Connection Status Updates (`updateUnitConnectionStatus`)
The mobile app (or admin dashboard) can manually mark a unit as connected or disconnected. This is used when a unit is physically removed for maintenance or when network issues cause the automated status to lag.

#### Step 6 — Firmware Version Checks (`checkIotLatestVersion`)
IoT boards periodically ask the server whether a newer firmware version is available. The server compares the unit's reported version against a configured "latest" value and returns a download URL if an upgrade is available. This allows the factory to roll out firmware updates without physically visiting each machine.

---

### 1.3 The Overall Flow

```
                ┌─────────────────────────────────────────────────┐
                │           IoT Firmware on Factory Floor          │
                └──────────────┬──────────────────────────────────┘
                               │
            ┌──────────────────▼──────────────────┐
            │  POST /auth/login  (or company_email_id in body)   │
            │  → Receives JWT cookie               │
            └──────────────────┬──────────────────┘
                               │
            ┌──────────────────▼──────────────────┐
            │  POST /machine/installV1             │
            │  → Heartbeat on power-up             │
            │  → Enrolls new unit if first boot    │
            │  → Closes open stop if restart       │
            └──────────┬───────────────────────────┘
                       │
          Machine detects stop
                       │
            ┌──────────▼───────────────────────────┐
            │  POST /machine/saveStopDataV1         │
            │  → Opens a stop record (start_time)  │
            └──────────┬───────────────────────────┘
                       │
          Machine restarts → calls installV1 again
          with start_time + end_time → closes stop record
                       │
            ┌──────────▼──────────────────────────────┐
            │  (If Wi-Fi was down during stops)        │
            │  POST /machine/saveOfflineData           │
            │  → Replays buffered stop events in bulk  │
            └──────────┬───────────────────────────────┘
                       │
            ┌──────────▼───────────────────────────┐
            │  POST /machine/checkIotLatestVersion  │
            │  → Periodic firmware upgrade check    │
            └──────────────────────────────────────┘
```

---

## Part 2 — Technical Implementation Report

### 2.1 Code Structure

```
backend/src/
├── app.js                              # Express app, route mounting order
├── routes/
│   ├── auth.routes.js                  # POST /auth/login
│   ├── mobile-machine-iot.routes.js    # installV1, saveStopDataV1 (PUBLIC — pre-auth)
│   └── mobile-machine.routes.js        # saveOfflineData, updateUnitConnectionStatus,
│                                       #   checkIotLatestVersion (JWT-protected)
├── services/
│   ├── auth.service.js                 # login(), JWT signing, password verify/rehash
│   └── iot-machine-data.service.js     # installMachine(), saveStopStart(),
│                                       #   saveStopEvent(), getProductionTime(), etc.
└── middleware/
    ├── iot-auth.js                     # Dual-auth: JWT OR company_email_id
    ├── auth.js                         # Standard JWT-only middleware
    └── rateLimiter.js                  # Global + per-login rate limits
```

**Key architectural decision:** `installV1` and `saveStopDataV1` are mounted **before** the global `authMiddleware` in `app.js` (line 132), meaning they are reachable without a valid JWT. The `iotAuth` middleware they use accepts either credential type, so legacy field hardware works without changes.

---

### 2.2 Endpoint-by-Endpoint Technical Analysis

---

#### `POST /api/v1/auth/login`

**File:** `backend/src/routes/auth.routes.js:49`, service: `auth.service.js:53`

**Request body:**
```json
{
  "email": "volvo123@gmail.com",
  "password": "secret"
}
```

**Required fields:** `email`, `password`

**What it does:**
1. Looks up user in master Prisma DB (case-insensitive email match, soft-delete filter).
2. Verifies bcrypt password hash. If the hash is outdated, it re-hashes transparently on success.
3. Checks `user.status === 1` (enabled) and `user.confirmed === true`.
4. Signs a JWT with `{ sub, email, roles, kind: 'web' }` and TTL from `JWT_ACCESS_TTL` env var (default `15m`).
5. Sets an HTTP-only `access_token` cookie.

**Response (200):**
```json
{
  "user": {
    "id": 5,
    "email": "volvo123@gmail.com",
    "name": "Volvo Admin",
    "tenantId": 5,
    "roles": ["Company"]
  },
  "expiresIn": 900
}
```

**Error responses:**
- `400` — `email and password are required`
- `401` — `invalid-credentials` or `user-disabled`
- `403` — `account_not_confirmed`
- `429` — `too-many-login-attempts` (rate limit: 5 attempts per 60 seconds per IP, configurable via `THROTTLE_AUTH_LIMIT`)

**Cookie options:** `httpOnly: true`, `sameSite: 'lax'`, `secure` (in production only), `maxAge = expiresIn * 1000`.

**Database tables accessed:** `users`, `user_roles`, `roles` (master schema, via Prisma ORM)

**Security notes:**
- Bucket resets on successful login so a user who fat-fingered their password isn't locked out.
- Password never logged or returned.
- No refresh token — the short-lived JWT must be renewed by calling login again.

---

#### `POST /api/v1/machine/saveStopDataV1`

**File:** `backend/src/routes/mobile-machine-iot.routes.js:88`, service: `iot-machine-data.service.js:368`

**Auth:** `iotAuth` middleware — JWT cookie/bearer **or** `company_email_id` in body.

**Request body:**
```json
{
  "company_email_id": "volvo123@gmail.com",
  "machine_id": 9,
  "start_time": "2026-05-18 11:33:47"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `machine_id` | integer | Yes | ID from the `machines` table |
| `start_time` | string (datetime) | Yes | When the stop started |
| `company_email_id` | string | Conditional | Required if no JWT cookie; must match a Company-role user |

**What it does (step by step):**
1. Looks up the machine row. Throws 404 if not found.
2. Sets `machines.unit_connected = 'yes'` — a stop signal proves the unit is alive.
3. If `machine.equipment_id` is 0 or null: sets `running_status = 'off'` and returns `success: false, msg: 'Machine not configured'`. No `machine_data` row is written.
4. Reads `machine_status` for this machine. If `status = 'off'` already: returns early with `msg: 'Long stop continue, so neclet notification'` (see known issues — typo in response). No duplicate row written.
5. Upserts `machine_status` (INSERT if none exists, UPDATE if it does) to `status = 'off', time = start_time`.
6. Inserts a new `machine_data` row: `{ machine_id, start_time, is_registered: 'no', is_valid_data: true }`. `end_time` is NULL at this point.
7. Updates `machines`: `has_unregister_data = 'yes'`, `running_status = 'off'`.

**Success response (200):**
```json
{
  "success": true,
  "msg": "Saved successfully",
  "data": {
    "id": 9,
    "equipmentId": 76,
    "runningStatus": "off",
    "unitConnected": "yes",
    "lastOnline": "2026-05-18T11:33:47.000Z",
    "machine_data_id": 1042
  }
}
```

**Not-configured response (200):**
```json
{ "success": false, "msg": "Machine not configured", "data": { "id": 9 } }
```

**Long-stop suppression response (200):**
```json
{ "success": true, "msg": "Long stop continue, so neclet notification", "data": { "id": 9 } }
```

**Database tables written:** `machines` (UPDATE), `machine_status` (UPSERT), `machine_data` (INSERT)

**Notifications triggered:** None currently. FCM infrastructure exists (tokens stored in Redis) but push notification dispatch for stop events is **not yet implemented**. The long-stop suppression message says "neclet notification" — a preserved typo from the original Laravel code.

**Known issues:**
- Typo in the long-stop message: `"neclet"` should be `"neglect"`. This is preserved from the legacy PHP controller for firmware compatibility.
- `filter_time` / `filter_time_on` debouncing via queue jobs (present in legacy Laravel code) is **not ported**. The comment notes this is intentional — firmware now handles debouncing locally.

---

#### `POST /api/v1/machine/installV1`

**File:** `backend/src/routes/mobile-machine-iot.routes.js:38`, service: `iot-machine-data.service.js:194`

**Auth:** `iotAuth` middleware — JWT cookie/bearer **or** `company_email_id` in body.

**Request body:**
```json
{
  "company_email_id": "volvo123@gmail.com",
  "pin_no": 1,
  "unit_name": "Montering Input - 1",
  "machine_id": 9,
  "bluetooth_id": "*",
  "wifi_id": "*",
  "start_time": "2026-05-18 11:33:47",
  "end_time": "2026-05-18 11:45:00"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `pin_no` | integer | Yes | IoT board pin number |
| `unit_name` | string | Yes | Display name; used as fallback lookup key |
| `machine_id` | integer | No | If omitted, lookup falls back to `pin_no + unit_name` |
| `company_email_id` | string | Conditional | Required if no JWT |
| `bluetooth_id` | string | No | Updated on heartbeat; `*` means not used |
| `wifi_id` | string | No | Updated on heartbeat; `*` means not used |
| `start_time` | string | No | Only relevant when `end_time` is also present |
| `end_time` | string | No | Presence triggers the restart / stop-close flow |

**Three distinct code paths:**

**Path A — New unit enrollment** (no matching machine found):
- Inserts a new `machines` row: `equipment_id=0` (unconfigured), `running_status='on'`, `unit_connected='yes'`, `installation_date=NOW()`.
- Returns `action: 'created'`.
- The unit will not generate analytics data until an operator binds it to equipment via the admin panel.

**Path B — Restart / close stop** (machine exists, has `equipment_id`, and both `start_time` + `end_time` provided):
- Sets `machines.unit_connected = 'yes'`.
- Upserts `machine_status` row to `status='on', time=end_time`.
- Finds the most recent `machine_data` row for this machine (open stop) and sets its `end_time`.
- Updates `machines`: `has_unregister_data='yes'`, `running_status='on'`.
- Returns `action: 'restart-saved'` or `action: 'restart-no-prior-stop'` if no open stop was found.

**Path C — Plain heartbeat** (machine exists, but no `end_time` or machine not yet configured):
- Updates `machines`: `running_status='on'`, `unit_connected='yes'`, refreshes `wifi_id`/`bluetooth_id`, sets `last_online=NOW()`.
- Returns `action: 'heartbeat'`.

**Success response (200):**
```json
{
  "success": true,
  "msg": "restart-saved",
  "data": {
    "id": 9,
    "equipmentId": 76,
    "runningStatus": "on",
    "unitConnected": "yes",
    "lastOnline": "2026-05-18T11:45:00.000Z"
  }
}
```

**Database tables written:**
- `machines` — always updated
- `machine_status` — upserted on Path B
- `machine_data` — last row's `end_time` set on Path B; new row inserted on Path A

**Known issues:**
- The restart path closes the **most recent** `machine_data` row, not one specifically tied to the `start_time` provided in the body. If `saveStopDataV1` was called twice before `installV1`, only the later stop row is closed. The earlier one remains with `end_time = NULL` indefinitely.
- Legacy `filter_time_on` queue debounce **not ported** (firmware-side now).

---

#### `POST /api/v1/machine/saveOfflineData`

**File:** `backend/src/routes/mobile-machine.routes.js:~120`, service: `iot-machine-data.service.js:40`

**Auth:** JWT required (standard cookie/bearer). Legacy `company_email_id` body field NOT accepted for this endpoint.

**Request body:**
```json
{
  "events": [
    { "machine_id": 9, "start_time": "2026-05-17 08:00:00", "end_time": "2026-05-17 08:45:00" },
    { "machine_id": 9, "start_time": "2026-05-17 10:10:00", "end_time": "2026-05-17 10:25:00" }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `events` | array | Yes | Array of stop objects |
| `events[].machine_id` | integer | Yes | |
| `events[].start_time` | string (datetime) | Yes | |
| `events[].end_time` | string (datetime) | Yes | |
| `events[].is_valid_data` | boolean | No | Defaults to `true` |

**What it does:**
1. Validates `events` is a non-empty array.
2. Sorts events by `start_time` ascending (so auto-register cascades pick up earlier stops first).
3. For each event, calls `saveStopEvent()` which:
   - Looks up the machine.
   - Inserts a complete `machine_data` row (both `start_time` and `end_time` present, so `production_time` is computed immediately).
   - Sets `machines.running_status = 'off'`.
   - **Auto-registration:** If `machines.is_auto_registered = 'yes'` AND the stop duration ≥ `auto_registered_data.time_limit` (in minutes), also inserts a `stop_data` row and marks `machine_data.is_registered = 'yes'`.
4. Stops at the first failure. Firmware retries from the last successfully committed offset.

**Success response (200):**
```json
{
  "success": true,
  "msg": "Offline buffer flushed",
  "data": {
    "committed": 2,
    "total": 2,
    "results": [
      { "machine_data_id": 1043, "auto_registered": false },
      { "machine_data_id": 1044, "stop_data_id": 55, "auto_registered": true }
    ]
  }
}
```

**Partial failure response (200):**
```json
{
  "success": false,
  "msg": "Failed at event #1: machine not found",
  "errors": { "committed": 1, "total": 3 }
}
```

**Database tables written:** `machine_data` (INSERT per event), `machines` (UPDATE per event), `stop_data` (INSERT when auto-register fires)

**Auto-registration logic** (inside `saveStopEvent`):
- Reads `machines.auto_registered_data` JSON column. Parses `time_limit`, `reasons` (stop reason ID), `stop_type_id`, `flow` (flow ID).
- If `durationMinutes >= time_limit`, inserts into `stop_data` with `created_by` from the JWT user performing the replay.
- If `auto_registered_data` JSON is malformed, auto-reg is silently skipped.

**Known issues:**
- Cross-shift stop splitting (a stop spanning a shift boundary should produce two `stop_data` rows) is **not implemented** — marked as "Phase D" in code comments.
- `cycle_time` multi-part counting from the legacy system is **not ported**.

---

#### `POST /api/v1/machine/updateUnitConnectionStatus`

**File:** `backend/src/routes/mobile-machine.routes.js:~108`

**Auth:** JWT required.

**Request body:**
```json
{
  "machine_id": 9,
  "unit_connected": "yes"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `machine_id` | integer | Yes | |
| `unit_connected` | string | Yes | Accepted values: `"yes"` or `"no"` |

**What it does:** Calls `machinesSvc.update()` to set `machines.unit_connected` to the provided value. This is a manual override used by the mobile app or admin dashboard, not called by firmware itself.

**Success response (200):**
```json
{
  "success": true,
  "msg": "",
  "data": { "id": 9, "unitConnected": "yes", ... }
}
```

**Error response (200):**
```json
{ "success": false, "msg": "machine_id required" }
```

**Database tables written:** `machines` (UPDATE single field)

**Notes:** Any value other than `"yes"` for `unit_connected` is stored as `"no"` (defensive default in the route handler).

---

#### `POST /api/v1/machine/checkIotLatestVersion`

**File:** `backend/src/routes/mobile-machine.routes.js:~161`

**Auth:** JWT required.

**Request body:**
```json
{ "version": "1.2.7" }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `version` | string | No | Unit's current firmware version string |

**What it does:**
1. Reads the `iot:latest` Redis key for an admin-set override.
2. Falls back to `process.env.IOT_LATEST_VERSION` (default: `'1.0.0'`).
3. Compares using the **"strip dots → integer"** method: `"1.2.10"` → `1210`, `"1.2.9"` → `129`. **This means `1.2.10` is seen as older than `1.2.9`** — a known bug documented in the code comments.
4. Returns `upgradeAvailable: true` and a download URL if the latest version's integer representation exceeds the current one.

**Success response (200):**
```json
{
  "success": true,
  "msg": "",
  "data": {
    "current": "1.2.7",
    "latest": "1.3.0",
    "upgradeAvailable": true,
    "downloadUrl": "/iot_version/software/latest.bin"
  }
}
```

**No upgrade available (200):**
```json
{
  "success": true,
  "msg": "",
  "data": {
    "current": "1.3.0",
    "latest": "1.3.0",
    "upgradeAvailable": false,
    "downloadUrl": null
  }
}
```

**Database tables accessed:** None — version data comes from Redis and environment variables.

**Configuration:**
| Setting | Source | Default |
|---|---|---|
| Latest version | `IOT_LATEST_VERSION` env var or Redis key `iot:latest` | `'1.0.0'` |
| Download URL | `IOT_FIRMWARE_URL` env var | `'/iot_version/software/latest.bin'` |

**Known bug:** The version comparison strips all non-digit characters and compares as a plain integer. This breaks for any version component with more than one digit past the first (e.g., `1.0.10` vs `1.0.9`). The code comment acknowledges this: *"Keep per-component digits ≤ 9 until this is refactored."*

---

### 2.3 Authentication Deep Dive

#### Standard JWT Flow (protected endpoints)

```
Client → POST /auth/login { email, password }
       ← Set-Cookie: access_token=<JWT>; HttpOnly

Client → POST /machine/saveOfflineData
         Cookie: access_token=<JWT>
       ← Response
```

The JWT payload: `{ sub: userId, email, roles: ["Company"], kind: "web", iat, exp }`

Tenant resolution at request time:
- `Company` role → `schemaName = tenant_${user.id}`
- `User` role → `schemaName = tenant_${user.companyId}`
- `Administrator` role → reads `X-Tenant-Id` header

#### Legacy Firmware Flow (`iotAuth` middleware)

```
Firmware → POST /machine/saveStopDataV1
           Body: { company_email_id: "owner@example.com", machine_id: 9, start_time: "..." }
         ← Response (same shape as JWT path)
```

The `iotAuth` middleware (`middleware/iot-auth.js`) first attempts JWT verification; if that fails or is absent, it falls through to looking up the `company_email_id` in the `users` table (case-insensitive, `Company` role required, `status = 1`). This lookup hits the database on every request from legacy firmware. There is no caching.

**Security concern:** The `company_email_id` mechanism means any actor who knows the company owner's email address can send stop events as that company. There is no secret/password involved. This is a legacy design inherited from the original PHP system.

---

### 2.4 Database Schema Summary

All IoT data is written to **tenant-scoped schemas** (`tenant_<userId>`). The master schema holds only user/auth data.

#### `machines` table
| Column | Type | Notes |
|---|---|---|
| `id` | int | Primary key |
| `equipment_id` | int | 0 = unconfigured; non-zero = linked to equipment |
| `pin_no` | int | IoT board pin |
| `unit_name` | string | Display name |
| `running_status` | enum | `on` / `off` / `warning` |
| `unit_connected` | string | `yes` / `no` |
| `last_online` | timestamp | Last heartbeat time |
| `signal_type` | enum | `on` / `off` / `warning` |
| `has_unregister_data` | string | `yes` / `no` — dirty flag for unprocessed stops |
| `filter_time` | int | Legacy debounce config (not actively used) |
| `filter_time_on` | int | Legacy debounce config (not actively used) |
| `is_auto_registered` | string | `yes` / `no` |
| `auto_registered_data` | JSON | `{ time_limit, reasons, stop_type_id, flow }` |
| `custom_notification_text` | string | Per-machine push notification message |
| `notification_default` | boolean | Use default text instead |
| `parent_id` | int | Counter parent linkage |
| `counter_details` | JSON | Sub-unit counter config |

#### `machine_data` table
| Column | Type | Notes |
|---|---|---|
| `id` | int | Primary key |
| `machine_id` | int | FK → machines |
| `start_time` | timestamptz | Stop start |
| `end_time` | timestamptz | Stop end — NULL until installV1 closes it |
| `is_registered` | enum | `no` → `yes` after auto-register |
| `is_valid_data` | boolean | |
| `production_time` | string | `HH:MM` format; computed on insert by `saveStopEvent` |

#### `machine_status` table
| Column | Type | Notes |
|---|---|---|
| `id` | int | Primary key |
| `machine_id` | int | FK → machines (one row per machine) |
| `status` | enum | `on` / `off` |
| `time` | string | Timestamp of last status change |

#### `stop_data` table (auto-register writes)
Written by `saveOfflineData` when auto-register fires. Fields: `flow_id`, `flow_object_key` (= `equipment_id`), `part_id`, `work_shift_id`, `hours`, `minutes`, `time`, `sum_of_time`, `reason` (reason ID), `stop_type_id`, `date`, `comment`, `created_by`, `created_by_email`, `created_by_name`.

---

### 2.5 Dependencies

| Dependency | Purpose | Location |
|---|---|---|
| Prisma ORM | Master DB access (users, auth) | `prisma/client.js` |
| `withTenant()` | Tenant schema DB access (raw SQL via Prisma) | `prisma/client.js` |
| Redis | FCM token storage, IoT version override (`iot:latest`), user machine settings | `redis/client.js` |
| `jsonwebtoken` | JWT signing and verification | `auth.service.js`, `iot-auth.js` |
| `express-rate-limit` | Login throttle (5 req/60s) + global throttle (60 req/60s) | `middleware/rateLimiter.js` |
| FCM (Firebase Cloud Messaging) | Push notifications | Tokens stored in Redis; **dispatch not yet implemented** |
| `helmet` | HTTP security headers | `app.js` |
| `pino` | Structured JSON logging | `app.js` |
| `swagger-jsdoc` / `swagger-ui-express` | API docs at `/api/docs` | `app.js` |

---

### 2.6 Security Considerations

1. **Legacy `company_email_id` auth has no secret.** Any caller who knows the company owner's email can write stop events to their tenant. This is a known inherited design flaw. Mitigation would be adding a pre-shared API key or migrating all firmware to JWT.

2. **JWT TTL is 15 minutes** (`JWT_ACCESS_TTL` env, default `15m`). There is no refresh token. Long-running IoT firmware processes must re-call `/auth/login` before the token expires. If they don't, they fall back to the `company_email_id` path which has no expiry — so in practice JWT auth degrades gracefully for legacy units.

3. **JWT secret is in environment variable** `JWT_ACCESS_SECRET`. If this leaks, all tokens are compromised.

4. **Raw SQL via `$queryRawUnsafe`** is used throughout the IoT service. All parameters are passed as positional bindings (`$1`, `$2`, ...) — SQL injection is not possible through these parameters. However, the table/schema names are interpolated from `tenant.schemaName` (e.g., `tenant_${id}`) which is derived from the authenticated user's record, not from user input, so there is no injection vector there either.

5. **CORS is configured** to allow only origins listed in `CORS_ORIGINS` env var. Credentials (cookies) are allowed.

6. **`company_email_id` lookup is case-insensitive** (Prisma `mode: 'insensitive'`). A firmware unit configured with `VOLVO123@GMAIL.COM` will still authenticate.

---

### 2.7 Error Handling

All IoT endpoints return HTTP `200` regardless of logical outcome. The `success` field in the JSON body indicates actual success or failure. This is a deliberate legacy compatibility choice — older firmware cannot handle non-200 HTTP status codes.

```json
// Success
{ "success": true, "msg": "Saved successfully", "data": { ... } }

// Failure
{ "success": false, "msg": "Machine not configured" }

// Partial failure (saveOfflineData only)
{ "success": false, "msg": "Failed at event #2: machine not found", "errors": { "committed": 2, "total": 5 } }
```

**Unhandled exceptions** in route handlers fall through to either:
- The `next(e)` error handler (which returns `{ statusCode: 5xx, message: "..." }` with a proper HTTP status code).
- A direct `res.json(fail(...))` catch block (returns HTTP 200 with `success: false`).

The IoT-specific endpoints (`installV1`, `saveStopDataV1`) use the `res.json(fail(...))` pattern to stay firmware-compatible.

---

### 2.8 Performance Implications

| Endpoint | DB Operations per Call | Frequency |
|---|---|---|
| `saveStopDataV1` | 1 SELECT + 1 SELECT + 1 UPSERT + 1 INSERT + 1 UPDATE = 5 queries | Every stop event (could be minutes apart or hours apart) |
| `installV1` (heartbeat) | 1–2 SELECT + 1 UPDATE = 3 queries | Every machine power-up / restart |
| `installV1` (restart) | 1–2 SELECT + 1 UPDATE + 1 SELECT + 1 UPSERT + 1 SELECT + 1 UPDATE + 1 UPDATE = 7–8 queries | Every machine restart after a stop |
| `saveOfflineData` | 5–7 queries × N events | Once per outage recovery; N could be dozens |
| `checkIotLatestVersion` | 1 Redis GET | Periodic (e.g., daily) |
| `updateUnitConnectionStatus` | 1 UPDATE | Manual / infrequent |

All queries execute within a `withTenant()` transaction that sets the Postgres search path to `tenant_<id>` for the duration of the request. Each request pays the cost of a `SET search_path` call.

**The `company_email_id` auth path** performs a Prisma ORM query (with joins to `user_roles` and `roles`) on every single request from legacy firmware. On a factory with 20 units sending heartbeats every minute, this is 20 user-table lookups per minute that a caching layer (Redis) could eliminate. Currently there is no caching for this lookup.

---

### 2.9 Known Issues and Technical Debt

| Issue | Location | Severity | Notes |
|---|---|---|---|
| `company_email_id` has no shared secret | `iot-auth.js` | High | Any caller knowing the email can write stop data |
| Version comparison bug (`1.2.10 < 1.2.9`) | `mobile-machine.routes.js:checkIotLatestVersion` | Medium | Explicitly documented in code: "Keep per-component digits ≤ 9" |
| Long-stop message typo: `"neclet notification"` | `iot-machine-data.service.js:410` | Low | Preserved for firmware compatibility |
| `company_email_id` auth not cached | `iot-auth.js` | Low | DB query on every firmware request |
| Cross-shift stop splitting not implemented | `iot-machine-data.service.js` comment | Medium | Marked "Phase D" — stops spanning shift boundaries produce one `stop_data` row instead of two |
| `filter_time` debounce not ported | `iot-machine-data.service.js` comment | Low | Firmware handles locally now; legacy queue jobs (`UpdateMachineStartStatusV1`, `UpdateMachineStopStatusV1`) not ported |
| FCM push notification dispatch not implemented | `mobile-machine.routes.js` | Medium | Tokens are stored in Redis but no send logic exists yet |
| `installV1` closes most recent stop, not the matched stop | `iot-machine-data.service.js:315` | Medium | If two `saveStopDataV1` calls arrive before `installV1`, only the later `machine_data` row gets an `end_time` |
| `cycle_time` multi-part counting not ported | `iot-machine-data.service.js` comment | Low | Legacy Laravel feature; not yet ported |
| No refresh token for JWT auth | `auth.service.js` | Low | Firmware must re-login every 15 min (or fall back to `company_email_id`) |

---

### 2.10 Related Helper Functions

#### `saveStopEvent(tenant, actor, dto)` — `iot-machine-data.service.js:40`
Used exclusively by `saveOfflineData`. Handles a complete stop (both `start_time` and `end_time` present). Computes `production_time` as `HH:MM`, inserts `machine_data`, and conditionally triggers auto-registration into `stop_data`. This function is distinct from `saveStopStart()` which handles the open-ended signal from `saveStopDataV1`.

#### `_processMachineStart(tx, machine, endTime)` — `iot-machine-data.service.js:288`
Private helper called by `installMachine()` when a stop-close/restart signal is detected. Upserts `machine_status`, closes the latest open `machine_data` row, and returns an action label (`restart-saved` or `restart-no-prior-stop`).

#### `installMachine(tenant, dto)` — `iot-machine-data.service.js:194`
Called by the `installV1` route. Implements the three-path lookup logic (by `machine_id`, by `pin_no + unit_name`, or new insert). Delegates to `_processMachineStart()` for the restart case.

#### `saveStopStart(tenant, dto)` — `iot-machine-data.service.js:368`
Called by the `saveStopDataV1` route. Handles the open-ended stop signal. Contains the long-stop suppression check and the `machine_status` upsert.

#### `getProductionTime(tenant, equipmentId, from, to)` — `iot-machine-data.service.js:139`
Used by `POST /machine/getProductionTime`. Aggregates `machine_data` stop durations for an equipment in a time window and computes `runningMinutes = windowMinutes − stopMinutes`. Drives the "Production time" dashboard card.

#### `getShiftSchedulesByDates(tenant, from, to)` — `iot-machine-data.service.js:162`
Used by `POST /machine/getShiftSchedulesByDates`. Returns `shift_schedule_data` rows overlapping a date range. Firmware uses this when attributing offline-replayed stops to the correct shift.

---

## Appendix — Environment Variables Reference

| Variable | Used By | Default | Notes |
|---|---|---|---|
| `JWT_ACCESS_SECRET` | `auth.service.js`, `iot-auth.js` | — | **Required.** Must be set. |
| `JWT_ACCESS_TTL` | `auth.service.js` | `15m` | Format: `15m`, `1h`, `3600` (seconds), `86400` |
| `COOKIE_DOMAIN` | `auth.routes.js` | (not set) | Set for cross-subdomain cookie sharing |
| `THROTTLE_AUTH_LIMIT` | `rateLimiter.js` | `5` | Max login attempts per IP per 60 s |
| `THROTTLE_DEFAULT_LIMIT` | `rateLimiter.js` | `60` | Max requests per IP per window |
| `THROTTLE_DEFAULT_TTL` | `rateLimiter.js` | `60` | Window size in seconds |
| `IOT_LATEST_VERSION` | `mobile-machine.routes.js` | `1.0.0` | Override via Redis `iot:latest` key |
| `IOT_FIRMWARE_URL` | `mobile-machine.routes.js` | `/iot_version/software/latest.bin` | Download URL returned to firmware |
| `CORS_ORIGINS` | `app.js` | `http://localhost:3030,http://localhost:3000` | Comma-separated allowed origins |
| `NODE_ENV` | `app.js`, `auth.routes.js` | — | `production` enables secure cookies |

---

*Generated by code analysis of `/Applications/XAMPP/xamppfiles/htdocs/new_fp/backend/src/`. All findings are based on actual source code — no assumptions made about unimplemented features.*
