# MQTT + WebSocket Migration Design
## FP Analyzer IoT Architecture — Technical Design Document

> **Status:** Design proposal — not yet implemented  
> **Scope:** Replaces HTTP polling from IoT firmware with MQTT pub/sub; adds Socket.io for real-time frontend updates  
> **Stack:** Raspberry Pi (Python/Node) → Mosquitto MQTT Broker → Express.js → PostgreSQL → Socket.io → Next.js  
> **Date:** 2026-05-20  
> **Reference:** `iot.md` (existing HTTP API documentation)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [MQTT Topic Design](#2-mqtt-topic-design)
3. [Authentication and Device Identity](#3-authentication-and-device-identity)
4. [Handling Existing Functionality via MQTT](#4-handling-existing-functionality-via-mqtt)
5. [Real-Time Frontend Updates via WebSockets](#5-real-time-frontend-updates-via-websockets)
6. [Database Changes](#6-database-changes)
7. [Migration Plan for Existing Devices](#7-migration-plan-for-existing-devices)
8. [Security Considerations](#8-security-considerations)
9. [Risks and Trade-offs](#9-risks-and-trade-offs)
10. [Appendix — Topic and Message Specification](#10-appendix--topic-and-message-specification)

---

## 1. Architecture Overview

### 1.1 Current Architecture (HTTP polling)

```
Raspberry Pi Firmware
        │
        │  POST /api/v1/machine/saveStopDataV1
        │  POST /api/v1/machine/installV1
        │  POST /api/v1/machine/saveOfflineData
        ▼
  Express.js Backend
        │
        │  Raw SQL via Prisma (withTenant)
        ▼
  PostgreSQL (tenant schemas)
        │
        │  Next.js polls REST endpoints
        ▼
  Next.js Dashboard  (no real-time push)
```

**Problems with the current design:**
- The firmware is a polling / event-triggered HTTP client with no persistent connection. The server is unaware when a device disconnects abnormally.
- Stop events are fire-and-forget: if the HTTP request fails, the firmware must implement its own retry logic (currently `saveOfflineData`).
- The dashboard has no live updates — it must poll REST endpoints to detect state changes.
- Every request carries full HTTP overhead (headers, TLS handshake per connection unless keep-alive is tuned). On factory Wi-Fi with dozens of machines, this is measurable waste.

---

### 1.2 Target Architecture (MQTT + WebSocket)

```
                  ┌────────────────────────────────────────────┐
                  │           Factory Floor                     │
                  │                                             │
                  │   ┌──────────────┐   ┌──────────────┐     │
                  │   │  Raspberry   │   │  Raspberry   │     │
                  │   │  Pi Unit A   │   │  Pi Unit B   │ ... │
                  │   └──────┬───────┘   └──────┬───────┘     │
                  └──────────┼──────────────────┼─────────────┘
                             │ MQTT over TLS     │
                             │ (port 8883)       │
                  ┌──────────▼──────────────────▼─────────────┐
                  │         Mosquitto MQTT Broker               │
                  │   • Per-device ACLs                        │
                  │   • QoS 1 persistent sessions              │
                  │   • Last Will and Testament                │
                  └──────────────────┬────────────────────────┘
                                     │ MQTT subscribe (all topics)
                  ┌──────────────────▼────────────────────────┐
                  │          Express.js Backend                │
                  │                                           │
                  │   • MQTT subscriber (mqtt / aedes lib)    │
                  │   • Existing HTTP REST API (preserved)    │
                  │   • Socket.io server                      │
                  └──────────┬────────────────┬───────────────┘
                             │                │
               Raw SQL via Prisma          Socket.io events
                             │                │
                  ┌──────────▼──────┐  ┌──────▼──────────────┐
                  │   PostgreSQL    │  │   Next.js Dashboard  │
                  │ (tenant schemas)│  │  (Socket.io client)  │
                  └─────────────────┘  └──────────────────────┘
```

---

### 1.3 Where the Broker Runs

**Recommended: co-hosted on the same server as Express (initial deployment)**

- Single VM / Docker Compose service alongside Express and PostgreSQL.
- Eliminates network latency between broker and subscriber.
- Simple to operate for a small fleet (< 500 devices).

**Upgrade path: managed cloud broker (at scale or for HA)**

- Options: HiveMQ Cloud, AWS IoT Core, EMQ X Cloud, CloudMQTT.
- Use when: multi-region factories, need for 99.9%+ uptime, or > 500 concurrent devices.
- Express connects to the cloud broker as a subscriber, exactly the same code.

The broker choice is an operational decision and does not affect Express or the Pi firmware code — the MQTT client library abstracts the connection details.

---

### 1.4 Why MQTT Over Raw WebSockets or HTTP

| Concern | HTTP (current) | Raw WebSocket | MQTT |
|---|---|---|---|
| **Connection overhead** | Full HTTP handshake per request | Single WS handshake, then open | Single MQTT CONNECT, then open |
| **Offline message delivery** | Firmware must implement retry | No broker, client handles retry | QoS 1/2 + persistent sessions; broker queues missed messages |
| **Abnormal disconnect detection** | Server never knows | Server detects close frame | Last Will and Testament (LWT) — broker auto-publishes a "device offline" message |
| **Bandwidth** | High (HTTP headers per request) | Low | Very low (2-byte fixed header minimum) |
| **Fan-out (1 event → N subscribers)** | N separate HTTP calls | Requires manual broadcast | Native pub/sub; broker handles fan-out |
| **QoS guarantees** | Application-layer retry | None built-in | QoS 0 (fire-and-forget), 1 (at-least-once), 2 (exactly-once) |
| **Device identity / auth** | Per-request token or body field | Per-connection | Per-connection (CONNECT credentials) |
| **Binary payloads** | Base64 in JSON | Native | Native |
| **Protocol overhead per message** | ~500+ bytes | ~10–50 bytes | 2–10 bytes |

**MQTT's LWT alone justifies the migration**: today, if a Pi loses power mid-stop, the server does not know. With MQTT, the broker automatically publishes to `factory/{tenantId}/machine/{machineId}/status` with payload `{"connected": false, "reason": "lwt"}` the moment the connection drops, triggering an immediate status update in Express and on the dashboard.

---

## 2. MQTT Topic Design

### 2.1 Topic Hierarchy Rationale

Every topic is prefixed with `fp/v1/{tenantId}/machine/{machineId}` where:

- `fp` — product namespace, avoids collision on a shared broker
- `v1` — protocol version, allows future breaking changes without migrating all devices
- `{tenantId}` — the company's user ID (same integer used as the PostgreSQL schema suffix `tenant_{id}`). This is the key field the broker's ACL engine uses to enforce topic isolation between tenants.
- `{machineId}` — integer primary key from the `machines` table

The `{tenantId}` in the topic is not self-reported by the device — it is baked into the device's broker credentials at provisioning time, and the broker enforces that a device's client ID matches its permitted topic prefix (see section 3.3). The device cannot publish to another tenant's topics.

---

### 2.2 Complete Topic Catalogue

#### Device → Broker → Express

| Topic | Purpose | QoS | Retain? |
|---|---|---|---|
| `fp/v1/{tenantId}/machine/{machineId}/heartbeat` | Periodic "I am online" signal | 1 | Yes |
| `fp/v1/{tenantId}/machine/{machineId}/enroll` | First boot — request new machine record | 1 | No |
| `fp/v1/{tenantId}/machine/{machineId}/stop/start` | Machine stopped (open stop) | 1 | No |
| `fp/v1/{tenantId}/machine/{machineId}/stop/end` | Machine restarted (closes open stop) | 1 | No |
| `fp/v1/{tenantId}/machine/{machineId}/stop/replay` | Bulk offline buffer replay | 1 | No |
| `fp/v1/{tenantId}/machine/{machineId}/firmware/check` | Request firmware version check | 0 | No |
| `fp/v1/{tenantId}/machine/{machineId}/status` | **LWT target** (auto-published by broker on disconnect) | 1 | Yes |

#### Express → Broker → Device (downlink commands)

| Topic | Purpose | QoS | Retain? |
|---|---|---|---|
| `fp/v1/{tenantId}/machine/{machineId}/firmware/response` | Response to firmware/check | 0 | No |
| `fp/v1/{tenantId}/machine/{machineId}/cmd/disconnect` | Ask a device to gracefully disconnect (admin) | 1 | No |
| `fp/v1/{tenantId}/machine/{machineId}/cmd/reboot` | Remote reboot command (future) | 1 | No |

---

### 2.3 Payload Schemas (JSON)

All payloads are JSON-encoded UTF-8 strings. All timestamps are ISO 8601 strings in UTC (`"2026-05-18T11:33:47Z"`). The `ts` field (Unix epoch milliseconds) is included on every message for replay-attack detection and ordering.

---

#### `heartbeat`

Published by the Pi every N seconds (recommended: 30–60 s). This replaces the plain-heartbeat path of `installV1`.

```
Topic:   fp/v1/{tenantId}/machine/{machineId}/heartbeat
Retain:  YES — broker stores the last heartbeat so a new Express subscriber immediately knows each machine's state
QoS:     1
```

```json
{
  "machine_id": 9,
  "pin_no": 1,
  "unit_name": "Montering Input - 1",
  "wifi_id": "Factory_SSID",
  "bluetooth_id": "*",
  "firmware_version": "1.3.0",
  "ts": 1747564427000
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `machine_id` | integer | Yes | Must match topic segment |
| `pin_no` | integer | Yes | Board pin — used as fallback identity |
| `unit_name` | string | Yes | Display name |
| `wifi_id` | string | No | Current SSID; `*` if unused |
| `bluetooth_id` | string | No | `*` if unused |
| `firmware_version` | string | No | Allows server to detect outdated firmware passively |
| `ts` | integer (ms) | Yes | Unix epoch ms; server rejects if > 60 s drift |

---

#### `enroll`

Published once on first boot when the device has no `machine_id` yet (unknown to the system). This replaces the "new machine insertion" path of `installV1`.

```
Topic:   fp/v1/{tenantId}/machine/new/enroll   (no machineId yet — uses literal "new")
Retain:  NO
QoS:     1
```

```json
{
  "pin_no": 99,
  "unit_name": "Biglia_2.0_test",
  "wifi_id": "Factory_SSID",
  "bluetooth_id": "*",
  "ts": 1747564427000
}
```

Express inserts a new `machines` row with `equipment_id=0`, then publishes the assigned `machine_id` back to the device via:

```
Topic:   fp/v1/{tenantId}/machine/new/enrolled
```

```json
{
  "machine_id": 47,
  "status": "created",
  "ts": 1747564427500
}
```

The Pi firmware stores the returned `machine_id` persistently (e.g., in a local config file) and uses it for all subsequent publishes. On the next boot, `heartbeat` is published to the correct topic.

---

#### `stop/start`

Published the moment the machine stops. This replaces `saveStopDataV1`. End time is not yet known.

```
Topic:   fp/v1/{tenantId}/machine/{machineId}/stop/start
Retain:  NO
QoS:     1
```

```json
{
  "machine_id": 9,
  "start_time": "2026-05-18T11:33:47Z",
  "ts": 1747564427000
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `machine_id` | integer | Yes | Must match topic segment |
| `start_time` | string (ISO 8601) | Yes | When the stop was detected |
| `ts` | integer (ms) | Yes | Publish timestamp for replay detection |

---

#### `stop/end`

Published when the machine restarts. This replaces the "restart / close stop" path of `installV1`. Both timestamps are provided so the server can close the open `machine_data` row.

```
Topic:   fp/v1/{tenantId}/machine/{machineId}/stop/end
Retain:  NO
QoS:     1
```

```json
{
  "machine_id": 9,
  "start_time": "2026-05-18T11:33:47Z",
  "end_time": "2026-05-18T11:45:00Z",
  "ts": 1747565100000
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `machine_id` | integer | Yes | |
| `start_time` | string (ISO 8601) | Yes | Matches the `start_time` from the earlier `stop/start` — used to locate the correct open `machine_data` row |
| `end_time` | string (ISO 8601) | Yes | When the machine restarted |
| `ts` | integer (ms) | Yes | |

**Improvement over current HTTP design:** The `start_time` field lets Express find the exact `machine_data` row to close, rather than blindly closing the most recent one. This fixes the known bug documented in `iot.md` (section 2.9: "installV1 closes most recent stop, not the matched stop").

---

#### `stop/replay`

Published as a single batch when the Pi reconnects after an outage and has locally buffered events. This replaces `saveOfflineData`.

```
Topic:   fp/v1/{tenantId}/machine/{machineId}/stop/replay
Retain:  NO
QoS:     1
```

```json
{
  "machine_id": 9,
  "events": [
    {
      "start_time": "2026-05-17T08:00:00Z",
      "end_time": "2026-05-17T08:45:00Z",
      "is_valid_data": true
    },
    {
      "start_time": "2026-05-17T10:10:00Z",
      "end_time": "2026-05-17T10:25:00Z",
      "is_valid_data": true
    }
  ],
  "ts": 1747565100000
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `machine_id` | integer | Yes | |
| `events` | array | Yes | Chronologically sorted stop records |
| `events[].start_time` | string (ISO 8601) | Yes | |
| `events[].end_time` | string (ISO 8601) | Yes | |
| `events[].is_valid_data` | boolean | No | Defaults to `true` |
| `ts` | integer (ms) | Yes | |

Express publishes an acknowledgement after processing:

```
Topic:   fp/v1/{tenantId}/machine/{machineId}/stop/replay/ack
```

```json
{
  "committed": 2,
  "total": 2,
  "failed_at": null,
  "ts": 1747565100500
}
```

If processing fails partway through, `failed_at` is the index of the first failed event and `committed` indicates how many succeeded. The Pi retries from `failed_at`.

---

#### `firmware/check`

```
Topic:   fp/v1/{tenantId}/machine/{machineId}/firmware/check
Retain:  NO
QoS:     0  (no guarantee needed — version check is best-effort)
```

```json
{
  "machine_id": 9,
  "current_version": "1.2.7",
  "ts": 1747565100000
}
```

Express replies on:

```
Topic:   fp/v1/{tenantId}/machine/{machineId}/firmware/response
```

```json
{
  "current_version": "1.2.7",
  "latest_version": "1.3.0",
  "upgrade_available": true,
  "download_url": "https://firmware.fpanalyzer.com/releases/1.3.0/pi.bin",
  "ts": 1747565100200
}
```

---

#### `status` (Last Will and Testament)

This topic is **set by the Pi at CONNECT time** as its LWT message. The broker auto-publishes it if the device disconnects without a graceful DISCONNECT packet (e.g., power failure, network loss).

```
Topic:   fp/v1/{tenantId}/machine/{machineId}/status
Retain:  YES — broker stores this so a new subscriber knows machine state immediately
QoS:     1
```

**LWT payload (broker auto-publishes on abnormal disconnect):**
```json
{
  "machine_id": 9,
  "connected": false,
  "reason": "lwt",
  "ts": 0
}
```

**Online payload (published by Pi at connect time, overwriting the LWT retain):**
```json
{
  "machine_id": 9,
  "connected": true,
  "reason": "connect",
  "ts": 1747565100000
}
```

**Offline payload (published by Pi before graceful disconnect):**
```json
{
  "machine_id": 9,
  "connected": false,
  "reason": "graceful",
  "ts": 1747565100000
}
```

Express subscribes to `fp/v1/+/machine/+/status` and updates `machines.unit_connected` accordingly, then emits a WebSocket event to the frontend.

---

### 2.4 Mapping HTTP Endpoints to MQTT Topics

| HTTP Endpoint | Replaces / Maps To | Notes |
|---|---|---|
| `POST /auth/login` | MQTT CONNECT credentials | Credential is per-device, set at provisioning. No per-request token. |
| `POST /machine/installV1` (heartbeat) | `heartbeat` topic | |
| `POST /machine/installV1` (new enroll) | `enroll` topic | Provisional topic `machine/new/enroll` |
| `POST /machine/installV1` (restart) | `stop/end` topic | `start_time` field fixes the existing "wrong row closed" bug |
| `POST /machine/saveStopDataV1` | `stop/start` topic | |
| `POST /machine/saveOfflineData` | `stop/replay` topic | Or native QoS 1 broker retry (see section 4.5) |
| `POST /machine/checkIotLatestVersion` | `firmware/check` / `firmware/response` | Request-response pattern |
| `POST /machine/updateUnitConnectionStatus` | `status` topic LWT + HTTP (remain) | Admin action stays HTTP; LWT handles automated detection |

---

## 3. Authentication and Device Identity

### 3.1 Per-Device Broker Credentials

Every Raspberry Pi is provisioned with a **unique MQTT username and password** before deployment. The credentials are generated server-side during the admin "register device" workflow and are never reused across devices.

Credential format:
- **Username:** `machine-{tenantId}-{machineId}` (e.g., `machine-5-9`)
- **Password:** A cryptographically random 32-byte string, stored as a bcrypt hash in the broker's password file (or in PostgreSQL, if the broker uses a dynamic auth plugin).

**Why not client certificates (mTLS)?**

Client certificates provide stronger security but require a PKI infrastructure (CA, cert issuance, revocation). For the initial deployment, username/password over TLS (port 8883) provides adequate security. Client certificate support should be added as a future hardening step once the operational process for cert lifecycle management is established.

The credential approach is chosen over the current `company_email_id` body-field mechanism because:
- The secret cannot be inferred from publicly visible information (email addresses are not secrets).
- Credentials are per-device, not per-company — a compromised device cannot impersonate other devices.
- Revocation is per-device (one device compromised → revoke one credential, not the whole company).

---

### 3.2 Tenant Mapping at Connect Time

The MQTT username `machine-{tenantId}-{machineId}` encodes the tenant. When Express receives a message on topic `fp/v1/{tenantId}/machine/{machineId}/stop/start`:

1. Parse `tenantId` from the topic string.
2. Derive the tenant schema name: `tenant_{tenantId}`.
3. Execute all database operations within that schema (same `withTenant()` pattern used today).

Express does **not** look up the tenant from a separate registry — the tenant is structural in the topic, just as it is structural in the JWT for HTTP calls today.

**Broker-level enforcement:** The broker's ACL rules ensure that client `machine-5-9` can only publish to `fp/v1/5/machine/9/#` and subscribe to `fp/v1/5/machine/9/#`. It cannot publish to `fp/v1/5/machine/10/#` or to any other tenant's prefix. This is enforced in the broker, not in Express.

---

### 3.3 ACL Rule Structure (Mosquitto ACL file format)

ACL rules follow this pattern per provisioned device:

```
# Each device gets two rules:
# 1. Publish permission: own topic prefix
# 2. Subscribe permission: own topic prefix (for downlink commands / firmware/response)

user machine-{tenantId}-{machineId}
topic write fp/v1/{tenantId}/machine/{machineId}/#
topic read  fp/v1/{tenantId}/machine/{machineId}/#
```

The Express backend uses a **superuser** broker account that can publish and subscribe to all topics:

```
user express-backend
topic readwrite fp/#
```

If using a dynamic auth backend (e.g., Mosquitto's `mosquitto-auth-plug` with PostgreSQL), these rules are stored in the database and reloaded without a broker restart.

---

### 3.4 Preserving the Legacy `company_email_id` Fallback

The `company_email_id` fallback in `iot-auth.js` should **not** be carried into the MQTT architecture. It served two purposes in the HTTP design:

1. Allow older deployed firmware to authenticate without a JWT.
2. Allow testing with a simple `curl` command (no token required).

In the MQTT design, the CONNECT credentials replace both. The migration plan (section 7) describes how to transition existing field devices.

However, the legacy **HTTP endpoints themselves** are preserved during the migration period (section 7, Phase 1 and 2). That means `company_email_id` auth continues to work for HTTP callers. It is retired only in Phase 3 when HTTP endpoints are deprecated.

---

## 4. Handling Existing Functionality via MQTT

### 4.1 Login / Session → MQTT CONNECT Credentials

**Current behavior:** Device calls `POST /auth/login` (or embeds `company_email_id` in every request body) to authenticate. JWT has a 15-minute TTL; device must re-login periodically.

**MQTT behavior:** Authentication happens once, at CONNECT time. The broker validates the username/password and keeps the session open. There is no per-message token. The connection is long-lived — typical factory devices maintain the same TCP connection for days or weeks.

Session persistence:
- The Pi connects with `clean_session=false` and a stable client ID (e.g., `machine-5-9`).
- If the connection drops, the broker holds QoS 1 messages published during the outage. When the Pi reconnects with the same client ID, the broker delivers them.
- Express does not need to handle re-authentication logic for devices; it only processes messages arriving on subscribed topics.

---

### 4.2 `saveStopDataV1` → `stop/start` Topic

**Current behavior:** Pi POSTs `{ machine_id, start_time, company_email_id }`. Express:
1. Marks `machines.unit_connected = 'yes'`.
2. Returns early if machine has no `equipment_id`.
3. Long-stop suppression: if `machine_status.status` is already `'off'`, does nothing.
4. Upserts `machine_status` to `off`.
5. Inserts `machine_data` row with `end_time = NULL`.
6. Sets `machines.running_status = 'off'`, `has_unregister_data = 'yes'`.

**MQTT behavior:** Express subscribes to `fp/v1/+/machine/+/stop/start`. On receipt of a valid message, it executes the same database logic. The response is not sent back to the device (MQTT is async). If the Pi needs confirmation, it subscribes to `stop/start/ack` (optional — most Pi firmware does not need this).

QoS 1 ensures the broker will re-deliver the `stop/start` message if the Express subscriber was temporarily disconnected. The Pi does not need to implement its own retry for the broker-to-Express leg.

---

### 4.3 `installV1` → Three Separate Topics

`installV1` currently conflates three distinct operations. MQTT separates them cleanly:

#### Heartbeat → `heartbeat` topic
Pi publishes periodically (recommended: every 30–60 seconds, or immediately on power-up). Express updates `machines.last_online`, `wifi_id`, `bluetooth_id`, and `running_status = 'on'`.

#### New unit enrollment → `enroll` topic
Pi publishes to `fp/v1/{tenantId}/machine/new/enroll` on first boot. Express inserts a `machines` row with `equipment_id = 0` and replies with the new `machine_id` on `machine/new/enrolled`. The Pi stores the `machine_id` for future use.

#### Restart / stop-end → `stop/end` topic
Pi publishes `{ machine_id, start_time, end_time }`. Express:
1. Finds the `machine_data` row where `machine_id = X AND start_time = Y AND end_time IS NULL`.
2. Sets `end_time`.
3. Upserts `machine_status` to `'on'`.
4. Updates `machines.running_status = 'on'`, `has_unregister_data = 'yes'`.

**Improvement:** The `start_time` lookup in step 1 correctly targets the right open stop row. This eliminates the documented bug in the current `installV1` handler that always closes the most recent row regardless of which stop it corresponds to.

---

### 4.4 `checkIotLatestVersion` → MQTT Request-Response or HTTP

**Option A: MQTT request-response**

Pi publishes to `firmware/check`. Express subscribes, checks Redis / env var, publishes response to `firmware/response`. Pi subscribes to `firmware/response` before publishing the request.

Limitation: MQTT is not natively request-response; there is no built-in correlation ID. Two Pis could send `firmware/check` simultaneously, and both would receive both responses. Mitigation: since the topic already contains `{machineId}`, responses are machine-scoped and this is not an issue.

**Option B: Keep as HTTP**

Version checks are infrequent (e.g., once per day or once per boot). The HTTP endpoint has no side effects on device state. Keeping it HTTP simplifies the Pi firmware: if the device has a JWT (or legacy email), it can call the existing endpoint unchanged.

**Recommendation: keep as HTTP for simplicity during Phase 1 and 2.** Migrate to MQTT in Phase 3 only if a specific need arises (e.g., server-initiated upgrade push).

---

### 4.5 `saveOfflineData` → MQTT QoS + `stop/replay` Topic

This is the most nuanced mapping. There are two distinct offline scenarios:

#### Scenario A: Pi can reach the broker but Express is temporarily down

MQTT QoS 1 + persistent sessions handle this natively. The broker queues messages while Express is disconnected and delivers them when Express reconnects. **No application-level retry needed.**

#### Scenario B: Pi cannot reach the broker (factory network outage)

The broker itself is unreachable. The Pi must buffer events locally.

**Proposed Pi-side local buffering strategy:**

- Pi writes stop events to a local SQLite database (or flat-file queue) when the broker connection is unavailable.
- On reconnect, Pi reads the buffered events and publishes them as a single `stop/replay` message (if the backlog is ≤ ~1000 events) or in chunks.
- The `stop/replay` topic carries a full `events[]` array (same schema as the current `saveOfflineData` HTTP body).
- Express processes them in chronological order and publishes `stop/replay/ack` with `committed` + `failed_at`.
- On partial failure, Pi retries from the `failed_at` index.

**Should `stop/replay` be a dedicated MQTT topic or just repeated `stop/start` + `stop/end` publishes?**

A dedicated `stop/replay` topic is preferred because:
- Bulk delivery allows Express to sort events before processing, which is necessary for correct auto-registration cascade ordering (same reason the current `saveOfflineData` sorts before processing).
- Express can wrap the entire batch in a single database transaction, which is safer than processing events individually when some have auto-registration side effects.
- Simplifies Pi logic: one publish per reconnect rather than N individual publishes that interleave with live heartbeats.

---

### 4.6 `updateUnitConnectionStatus` → Remains HTTP

This endpoint is a **manual admin action** triggered from the dashboard, not from the device. It is not part of device-initiated communication.

**Recommendation: keep as HTTP.** The admin dashboard calls `POST /machine/updateUnitConnectionStatus` exactly as today. No change.

The automated equivalent — detecting device connectivity — is handled by the LWT mechanism (`status` topic). The HTTP endpoint is retained for cases where an admin needs to override the automated state (e.g., marking a unit as "offline" for maintenance without powering it down).

---

## 5. Real-Time Frontend Updates via WebSockets

### 5.1 Data Flow

```
Pi → broker → Express (MQTT subscriber)
                    │
                    │  On each MQTT message, after DB write:
                    ▼
             Socket.io server
                    │
                    │  emit to appropriate room(s)
                    ▼
        Next.js Dashboard (Socket.io client)
```

Express subscribes to `fp/v1/#` on the broker. For each message received, it:
1. Processes the message (DB write, business logic).
2. Emits one or more Socket.io events to the relevant room.

---

### 5.2 Socket.io Room Structure

Dashboard clients join rooms based on their tenant and optionally a specific machine:

| Room Name | Who joins | Purpose |
|---|---|---|
| `tenant:{tenantId}` | Any authenticated dashboard user in that tenant | Receives all machine events for the tenant |
| `machine:{tenantId}:{machineId}` | Dashboard views focused on a single machine | Receives events only for that machine |

On Socket.io connection, the Next.js client sends its JWT in the handshake `auth` object. The Express Socket.io middleware verifies the JWT and automatically adds the client to its tenant room.

---

### 5.3 WebSocket Event Catalogue

All events carry a `data` object. Consumers should treat unknown fields as forward-compatible additions.

#### `machine:status:changed`
Emitted on `heartbeat`, `stop/start`, `stop/end`, and `status` (LWT) messages. Sent to `tenant:{tenantId}` room.

```json
{
  "machineId": 9,
  "runningStatus": "off",
  "unitConnected": "yes",
  "lastOnline": "2026-05-18T11:33:47Z",
  "ts": 1747564427000
}
```

#### `machine:stop:started`
Emitted after a `stop/start` MQTT message is processed and `machine_data` row is inserted. Sent to both `tenant:{tenantId}` and `machine:{tenantId}:{machineId}` rooms.

```json
{
  "machineId": 9,
  "machineDataId": 1042,
  "startTime": "2026-05-18T11:33:47Z",
  "equipmentId": 76,
  "ts": 1747564427000
}
```

#### `machine:stop:ended`
Emitted after a `stop/end` MQTT message closes the `machine_data` row.

```json
{
  "machineId": 9,
  "machineDataId": 1042,
  "startTime": "2026-05-18T11:33:47Z",
  "endTime": "2026-05-18T11:45:00Z",
  "productionTime": "00:11",
  "autoRegistered": false,
  "stopDataId": null,
  "ts": 1747565100000
}
```

#### `machine:offline`
Emitted when the `status` LWT is received from the broker (device disconnected abnormally). Sent to `tenant:{tenantId}` room.

```json
{
  "machineId": 9,
  "connected": false,
  "reason": "lwt",
  "ts": 1747565200000
}
```

#### `machine:online`
Emitted when the `status` topic carries `connected: true` (device reconnected). Sent to `tenant:{tenantId}` room.

```json
{
  "machineId": 9,
  "connected": true,
  "reason": "connect",
  "ts": 1747565300000
}
```

#### `machine:enrolled`
Emitted when a new machine record is created via the `enroll` topic.

```json
{
  "machineId": 47,
  "pinNo": 99,
  "unitName": "Biglia_2.0_test",
  "tenantId": 5,
  "ts": 1747565100000
}
```

#### `machine:replay:complete`
Emitted after a `stop/replay` batch is fully processed.

```json
{
  "machineId": 9,
  "committed": 5,
  "total": 5,
  "failedAt": null,
  "ts": 1747565400000
}
```

#### `machine:firmware:update:available`
Emitted (to `tenant:{tenantId}` room) when a `heartbeat` message reports a firmware version older than the current latest. This allows the dashboard to surface an update badge without the device explicitly asking.

```json
{
  "machineId": 9,
  "currentVersion": "1.2.7",
  "latestVersion": "1.3.0",
  "ts": 1747565100000
}
```

---

### 5.4 Handling Reconnection and Missed Events

**Problem:** If a dashboard client disconnects (page refresh, network blip) and reconnects, it may have missed WebSocket events during the gap.

**Strategy: "connect + pull" pattern**

On Socket.io reconnect, the Next.js client:

1. Emits a `client:resync` event with `{ lastSeenTs: <timestamp of last event received> }`.
2. Express responds with a `resync:snapshot` event containing the current `running_status` and `unit_connected` for all machines in the tenant, plus the last N stop events since `lastSeenTs` (fetched from `machine_data` via REST or direct DB query).
3. The client merges the snapshot into its local state.

This is simpler than maintaining a full event log and is sufficient for a monitoring dashboard where the most important state is "what is the current status of each machine right now".

For audit trails and historical stop data, the existing REST API endpoints (`getMachineData`, `getProductionTime`) remain unchanged and serve as the authoritative source.

---

## 6. Database Changes

### 6.1 New Column: `machines.mqtt_client_id`

Stores the MQTT client ID assigned to the device at provisioning. Used to verify that the client ID in a message matches the expected ID for the machine, and for broker credential revocation.

```
Column:  mqtt_client_id
Type:    VARCHAR(100)
Default: NULL
Nullable: YES (NULL for machines not yet migrated to MQTT)
```

### 6.2 New Column: `machines.mqtt_password_hash`

Stores the bcrypt hash of the device's MQTT password. The plaintext password is given to the device operator once during provisioning and never stored.

```
Column:  mqtt_password_hash
Type:    TEXT
Default: NULL
Nullable: YES
```

Alternatively, if the broker uses its own password file (Mosquitto's `pwfile`), this column is not needed — the broker manages credentials independently. The recommendation is to use a PostgreSQL-backed dynamic auth plugin for Mosquitto so that credential management is centralised and does not require broker restarts.

### 6.3 New Column: `machines.mqtt_provisioned_at`

Timestamp of when MQTT credentials were issued. Useful for auditing and for identifying which devices have been migrated vs which are still on HTTP-only firmware.

```
Column:  mqtt_provisioned_at
Type:    TIMESTAMPTZ
Default: NULL
```

### 6.4 New Column: `machine_data.mqtt_message_id`

Stores the MQTT packet identifier (`PUBACK` message ID) for QoS 1 messages. Enables deduplication: if the broker re-delivers a QoS 1 message (because the `PUBACK` was lost), Express checks whether a `machine_data` row with this `mqtt_message_id` already exists before inserting.

```
Column:  mqtt_message_id
Type:    VARCHAR(100)
Default: NULL
Nullable: YES (NULL for rows inserted via HTTP API)
```

The deduplication check is:
- Before inserting a `machine_data` row, query `SELECT id FROM machine_data WHERE mqtt_message_id = ? LIMIT 1`.
- If a row exists: skip the insert, return the existing row's ID.
- If not: insert normally, storing the message ID.

### 6.5 No New Tables Required

MQTT broker session state (persistent session data) is managed by the broker itself, not by Express or PostgreSQL. The broker stores in-flight messages and subscription state in its own persistence layer (Mosquitto's `.db` file, or the broker's own PostgreSQL/Redis backend if using a managed broker).

There is no need to replicate broker session state into the application database.

### 6.6 Summary of Schema Changes

| Table | New Column | Type | Nullable | Purpose |
|---|---|---|---|---|
| `machines` | `mqtt_client_id` | VARCHAR(100) | YES | Device identity for broker ACLs |
| `machines` | `mqtt_password_hash` | TEXT | YES | Bcrypt of device MQTT password (if DB-backed auth) |
| `machines` | `mqtt_provisioned_at` | TIMESTAMPTZ | YES | Migration tracking |
| `machine_data` | `mqtt_message_id` | VARCHAR(100) | YES | QoS 1 deduplication |

All new columns are nullable so they do not break existing rows (migrated HTTP inserts have `NULL` in the MQTT columns).

---

## 7. Migration Plan for Existing Devices

### 7.1 Principles

- **No device left behind:** HTTP endpoints are preserved indefinitely for devices that cannot receive a firmware update.
- **Zero downtime:** Each phase can be deployed and rolled back independently.
- **Opt-in migration per device:** Devices switch to MQTT individually, not in a fleet-wide cutover.
- **Observable progress:** The `mqtt_provisioned_at` column tracks which devices have migrated.

---

### 7.2 Phase 1 — Broker + Express MQTT Subscriber (Server-Side Only)

**Goal:** Deploy the MQTT broker and subscribe Express to all topics, without changing any device firmware. The HTTP API continues to serve all existing devices unchanged.

**Steps:**
1. Deploy Mosquitto broker (Docker service or system package). Configure TLS on port 8883. Configure `express-backend` superuser credentials.
2. Add `mqtt` npm package to Express backend. Create an MQTT subscriber module that connects to the broker.
3. Register handlers for all topics listed in section 2.2. Each handler calls the same service functions already used by the HTTP routes (e.g., `saveStopStart()`, `installMachine()`).
4. Add the database columns from section 6 via a migration.
5. Deploy Socket.io server alongside the existing Express app. Emit WebSocket events from the MQTT handlers.
6. Deploy Next.js Socket.io client. Initially, it can just log received events — no UI changes yet.

**Rollback:** Stop the broker. Express MQTT subscriber disconnects gracefully. No device is affected. HTTP API unchanged.

**Validation:** Publish test messages manually using `mosquitto_pub` to verify that Express processes them and emits the correct WebSocket events.

---

### 7.3 Phase 2 — Dual-Mode Firmware (Device-Side)

**Goal:** Update device firmware to support MQTT with HTTP fallback. Devices that receive the update migrate to MQTT. Devices that do not remain on HTTP.

**Steps:**
1. Build and test new Pi firmware that:
   - Connects to the MQTT broker with device credentials.
   - On successful MQTT connection: uses MQTT topics exclusively.
   - On MQTT connection failure: falls back to HTTP API (existing behavior).
   - Publishes `connected: true` to `status` topic on connect.
   - Configures LWT to `status` topic with `connected: false, reason: lwt`.
   - Buffers events to local SQLite when broker is unreachable and replays via `stop/replay` on reconnect.
2. Provision each device with MQTT credentials before deploying updated firmware:
   - Admin generates credentials via a new admin API endpoint (`POST /api/v1/admin/machines/{id}/provision-mqtt`).
   - Credentials are delivered to the device operator (QR code, config file transfer, etc.).
   - Device stores credentials in its local config.
3. Deploy updated firmware to devices in batches (e.g., by factory, by shift).
4. Monitor `machines.mqtt_provisioned_at` to track migration progress.

**Rollback:** Revert firmware to previous version. Device falls back to HTTP automatically (HTTP endpoints still active).

**Validation:** Verify that migrated devices appear in the Socket.io-driven dashboard in real time. Verify that HTTP-only devices still appear in the REST-polled dashboard.

---

### 7.4 Phase 3 — Deprecate HTTP IoT Endpoints (After Full Migration)

**Goal:** Remove `company_email_id` auth and deprecate the IoT-specific HTTP endpoints once all devices are confirmed on MQTT.

**Prerequisites:**
- All devices have `mqtt_provisioned_at` populated.
- No HTTP requests to IoT endpoints for > 30 days (verify via access logs).

**Steps:**
1. Return `410 Gone` from `saveStopDataV1`, `installV1`, `saveOfflineData` with a descriptive message.
2. Remove the `iotAuth` middleware and `company_email_id` auth path from `iot-auth.js`.
3. Remove the `mobile-machine-iot.routes.js` file. Remove its `app.use()` line in `app.js`.
4. Keep `updateUnitConnectionStatus` and `checkIotLatestVersion` as HTTP — they serve the dashboard, not device firmware.
5. Keep `/auth/login` — it serves the dashboard and mobile app.

**Devices that can never be updated:** If specific devices cannot receive a firmware update (hardware limitations, inaccessible locations), their HTTP endpoints should be retained selectively. This can be achieved by keeping the IoT routes but removing the `company_email_id` auth path — those devices would need to obtain a JWT via login, which may require a minimal firmware update anyway. In the worst case, the legacy HTTP endpoints remain permanently behind a feature flag.

---

## 8. Security Considerations

### 8.1 Transport Security

All MQTT traffic must use TLS on port 8883. Plain MQTT on port 1883 must be disabled on the broker (or firewalled to localhost only). The broker's TLS certificate should be issued by a public CA (Let's Encrypt) or an internal CA whose root certificate is bundled with the Pi firmware.

The Pi firmware must validate the broker's server certificate. Certificate pinning (verifying the exact certificate fingerprint) provides stronger protection against MITM attacks at the cost of operational complexity when certificates rotate. Pinning is optional but recommended for high-security deployments.

### 8.2 Broker Authentication and ACLs

Three controls work together to isolate tenants:

1. **Per-device credentials** (username/password at CONNECT): ensures only provisioned devices can connect.
2. **Topic ACLs**: each device can only publish and subscribe to `fp/v1/{tenantId}/machine/{machineId}/#`. The broker enforces this before any message reaches Express.
3. **Express-side validation**: even after the broker enforces ACLs, Express re-validates that the `machine_id` in the message payload matches the `machine_id` in the topic path. This defends against bugs or misconfigurations in the broker ACL rules.

If any of these three controls is bypassed, the others still provide a layer of defence.

### 8.3 WebSocket Authentication

The Socket.io handshake must carry the user's JWT. The Next.js client passes it in the `auth` option of `io()`:

```
io('https://api.fptest.com', {
  auth: { token: '<JWT from /auth/login>' }
})
```

The Express Socket.io middleware verifies the JWT on connection (same logic as the `authMiddleware` used for HTTP routes). If the token is invalid or expired, the WebSocket connection is rejected before the client joins any room.

WebSocket connections do not persist across token expiry. The Next.js client should detect the `connect_error` event and re-authenticate before reconnecting.

### 8.4 Replay Attack Prevention

Each MQTT message payload contains a `ts` field (Unix epoch milliseconds). Express rejects messages where `|serverTime - ts| > 60_000` (60-second window). This prevents an attacker who captures a QoS 1 message from replaying it days later to insert a false stop event.

The `mqtt_message_id` deduplication column (section 6.4) provides a second layer: even if the timestamp check is bypassed, an exact duplicate packet ID will be recognised and ignored.

### 8.5 MQTT Broker Hardening Checklist

- Disable anonymous connections (`allow_anonymous false`).
- Disable port 1883 externally (firewall rule or `listener 1883 localhost`).
- Enable port 8883 with TLS.
- Set maximum packet size to prevent oversized payload attacks (`message_size_limit 65536`).
- Enable connection rate limiting to slow credential brute-force (`max_connections 1000`, `connect_rate_limit`).
- Set per-client message queue limits for persistent sessions (`max_queued_messages 1000`).
- Log all connections and authentication failures.
- Rotate `express-backend` credentials on a schedule (6–12 months).

---

## 9. Risks and Trade-offs

### 9.1 Broker Single Point of Failure

**Risk:** The Mosquitto broker is a new critical dependency. If it crashes or becomes unreachable, no MQTT messages are delivered. This is a more visible failure mode than the current HTTP design, where individual request failures are absorbed by device-side retry.

**Mitigations:**
- Run the broker as a Docker container with `restart: always` and health checks.
- Monitor broker uptime and message throughput as a key metric.
- The Pi firmware's HTTP fallback (Phase 2) ensures that a broker outage does not cause data loss — devices fall back to HTTP until the broker recovers.
- For production SLA requirements, switch to a managed cloud broker (AWS IoT Core, HiveMQ Cloud) which provides SLA-backed uptime. This change requires no code modification to Express or the Pi firmware.

### 9.2 Increased Operational Complexity

**Risk:** The system now has an additional moving part (the broker) with its own configuration, credentials, logs, and upgrade lifecycle.

**Mitigations:**
- Managed broker services eliminate most operational overhead.
- The broker's configuration is small and version-controlled.
- The broker's ACL file (or database-backed rules) must be updated whenever a device is provisioned or decommissioned — this is a new operational step.

### 9.3 Broker Latency

**Risk:** The broker adds one network hop between the Pi and Express: Pi → broker → Express. On a co-hosted broker this is < 1 ms. On a cloud broker it is the RTT to the cloud region.

**Context:** The existing HTTP design also has latency (TCP handshake + TLS negotiation on every request). For a persistent MQTT connection, message latency after initial connect is lower than HTTP for most workloads. This is not a practical concern.

### 9.4 Debugging Difficulty

**Risk:** Unlike HTTP, MQTT messages are not visible in browser devtools or simple `curl` commands. Debugging requires broker-level log inspection or a dedicated MQTT client (`mosquitto_sub` or MQTT Explorer).

**Mitigations:**
- Run `mosquitto_sub` in subscription mode during development to observe all messages.
- Log each MQTT message received by Express (topic, payload, timestamp) at debug level.
- The existing Swagger UI for HTTP endpoints is not applicable to MQTT — plan for an internal admin tool or broker dashboard (e.g., EMQX Dashboard or HiveMQ Control Centre) for production visibility.

### 9.5 Fan-out Amplification

**Risk:** A large tenant with 200 machines all sending heartbeats every 30 seconds = ~400 messages/minute to the broker. Each message triggers Express processing + a Socket.io emit to all dashboard clients in that tenant. If 50 dashboard windows are open, each emit goes to 50 clients simultaneously.

**Context:** 400 messages/minute is well within Mosquitto's capacity (handles hundreds of thousands of messages per second). Socket.io fan-out to 50 clients is negligible. This is not a practical concern at the stated scale but should be revisited if tenant size grows to thousands of machines.

### 9.6 Known Bug Fix Creates Protocol Break

The `stop/end` message includes `start_time` to identify the correct `machine_data` row (fixing the "closes most recent stop" bug). This means the Pi firmware must track and remember the `start_time` from its earlier `stop/start` message and include it in the `stop/end` payload. This is simple to implement but must be accounted for in the firmware design.

If a device's local memory is cleared between `stop/start` and `stop/end` (e.g., unexpected reboot), it may not know the original `start_time`. The server-side fallback in this case is to close the most recent open `machine_data` row — preserving the current (buggy) behavior as a graceful degradation, but emitting a warning log.

---

## 10. Appendix — Topic and Message Specification

### Topic Summary Table

| Original HTTP Endpoint | MQTT Topic | Payload Key Fields | QoS | Retain? | Direction |
|---|---|---|---|---|---|
| `POST /auth/login` | (MQTT CONNECT credentials) | username, password | — | — | Device → Broker |
| `POST /machine/saveStopDataV1` | `fp/v1/{tenantId}/machine/{machineId}/stop/start` | `machine_id`, `start_time`, `ts` | 1 | No | Device → Broker → Express |
| `POST /machine/installV1` (heartbeat) | `fp/v1/{tenantId}/machine/{machineId}/heartbeat` | `machine_id`, `pin_no`, `unit_name`, `wifi_id`, `bluetooth_id`, `firmware_version`, `ts` | 1 | Yes | Device → Broker → Express |
| `POST /machine/installV1` (new enroll) | `fp/v1/{tenantId}/machine/new/enroll` | `pin_no`, `unit_name`, `wifi_id`, `bluetooth_id`, `ts` | 1 | No | Device → Broker → Express |
| `POST /machine/installV1` (restart) | `fp/v1/{tenantId}/machine/{machineId}/stop/end` | `machine_id`, `start_time`, `end_time`, `ts` | 1 | No | Device → Broker → Express |
| `POST /machine/saveOfflineData` | `fp/v1/{tenantId}/machine/{machineId}/stop/replay` | `machine_id`, `events[]`, `ts` | 1 | No | Device → Broker → Express |
| `POST /machine/checkIotLatestVersion` | `fp/v1/{tenantId}/machine/{machineId}/firmware/check` | `machine_id`, `current_version`, `ts` | 0 | No | Device → Broker → Express |
| `POST /machine/updateUnitConnectionStatus` | (remains HTTP) | — | — | — | Dashboard → HTTP → Express |
| LWT / disconnect detection | `fp/v1/{tenantId}/machine/{machineId}/status` | `machine_id`, `connected`, `reason`, `ts` | 1 | Yes | Broker → Express (auto) |
| Enrollment response | `fp/v1/{tenantId}/machine/new/enrolled` | `machine_id`, `status`, `ts` | 1 | No | Express → Broker → Device |
| Replay acknowledgement | `fp/v1/{tenantId}/machine/{machineId}/stop/replay/ack` | `committed`, `total`, `failed_at`, `ts` | 1 | No | Express → Broker → Device |
| Firmware response | `fp/v1/{tenantId}/machine/{machineId}/firmware/response` | `current_version`, `latest_version`, `upgrade_available`, `download_url`, `ts` | 0 | No | Express → Broker → Device |

### WebSocket Event Summary

| Socket.io Event | Emitted When | Room | Key Payload Fields |
|---|---|---|---|
| `machine:status:changed` | heartbeat, stop/start, stop/end, LWT | `tenant:{tenantId}` | `machineId`, `runningStatus`, `unitConnected`, `lastOnline` |
| `machine:stop:started` | `stop/start` processed | `tenant:{tenantId}`, `machine:{tenantId}:{machineId}` | `machineId`, `machineDataId`, `startTime`, `equipmentId` |
| `machine:stop:ended` | `stop/end` processed | `tenant:{tenantId}`, `machine:{tenantId}:{machineId}` | `machineId`, `machineDataId`, `startTime`, `endTime`, `productionTime`, `autoRegistered` |
| `machine:offline` | LWT received from broker | `tenant:{tenantId}` | `machineId`, `connected: false`, `reason: "lwt"` |
| `machine:online` | `status` received with `connected: true` | `tenant:{tenantId}` | `machineId`, `connected: true` |
| `machine:enrolled` | `enroll` processed, new machine created | `tenant:{tenantId}` | `machineId`, `pinNo`, `unitName`, `tenantId` |
| `machine:replay:complete` | `stop/replay` fully processed | `tenant:{tenantId}` | `machineId`, `committed`, `total`, `failedAt` |
| `machine:firmware:update:available` | `heartbeat` firmware version < latest | `tenant:{tenantId}` | `machineId`, `currentVersion`, `latestVersion` |

### QoS Selection Rationale

| QoS Level | Used For | Reason |
|---|---|---|
| **0** (fire-and-forget) | `firmware/check`, `firmware/response` | Infrequent; loss is acceptable; device retries at next check interval |
| **1** (at-least-once) | All stop events, heartbeats, status/LWT, replay | Stop data must not be lost; deduplication via `mqtt_message_id` handles broker re-delivery |
| **2** (exactly-once) | Not used | Double the handshake overhead; deduplication at application layer (QoS 1) is equivalent and cheaper |

---

*This document describes a target architecture. Implementation details (library selection, exact broker configuration, Pi firmware changes) are deferred to the implementation phase. All architectural decisions are based on the existing codebase as documented in `iot.md`.*
