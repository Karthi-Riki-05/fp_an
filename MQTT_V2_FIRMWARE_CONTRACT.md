# FP Analyzer — MQTT v2 Firmware Contract

> **This supersedes `fpanalyzer-mqtt-architecture.html` where the two differ.**
> That document is the design this is built from; this file is what the server
> actually implements. Where the HTML says something else, this file wins.
>
> **Status:** phases 1 and 2 implemented — ingestion, request/reply, and commands.
> Server source of truth:
> `backend/src/services/mqtt.service.js`.
> **Date:** 2026-08-20

---

## 1. What changed from the design document

Four deliberate deviations. Everything else follows the HTML.

| Design doc | Implemented | Why |
|---|---|---|
| `fp/{company-slug}/{unit}/...` | `fp/{companyId}/{unit}/...` — **integer**, not a slug | The integer *is* the tenant id; it selects the Postgres schema `tenant_{companyId}`. A slug would need a lookup table that adds nothing. |
| `req/login` returns an auth result | **Stub that always succeeds** | Reaching the topic already required valid broker credentials — the connection *is* the authentication. Kept so firmware need not special-case it. |
| First-boot enrollment over MQTT | **Still HTTP** | A factory-fresh unit has no broker credentials, so it cannot connect at all. `req/register` covers everything after provisioning. |
| Per-device X.509 mTLS | **Username + password over TLS** | Credentials live in Postgres and are individually revocable, which was the actual requirement. The broker config flips to mTLS later without changing topics or payloads. |

---

## 2. Connection

| Parameter | Value |
|---|---|
| Broker | `mqtts://api.fptest.com:8883` |
| TLS | **Required.** There is no plain 1883 listener. |
| CA certificate | `/etc/fpanalyzer/ca.crt` — issued by `docker/mosquitto/gen-certs.sh`, not a public CA |
| Protocol | MQTT 5.0 (3.1.1 also works for phase 1) |
| Username | `fp-{companyId}-{unitName}` — from provisioning |
| Password | random, from provisioning |
| Client ID | **exactly the username** |
| Clean Start | `false` |
| Session Expiry | `86400` |
| Keep Alive | `60` |

One connection per **physical Raspberry Pi**, not per machine. A Pi carrying 4
machines on pins 1–4 uses one credential; `pin_no` in the payload selects the
machine.

**Getting credentials** — an admin runs either:
```bash
node backend/scripts/provision-mqtt-unit.js 66 UNIT-01
# or: POST /api/v1/admin/iot/mqtt-units/provision  { "unitName": "UNIT-01" }
```
The password is shown once. Revoke with `--revoke 66 UNIT-01`; it takes effect
within 60 seconds (the broker's auth cache TTL).

**Last Will**, registered at CONNECT — topic `fp/{companyId}/{unit}/status/conn`,
QoS 1, **retain true**:
```json
{"online": false, "reason": "lwt"}
```

---

## 3. Topics

Only these three are consumed. Publishing anything else is accepted by the
broker and ignored by the server.

### Device → server

| Topic | QoS | Retain | Purpose |
|---|---|---|---|
| `fp/{companyId}/{unit}/evt/machine` | 1 | no | Machine ON/OFF transition |
| `fp/{companyId}/{unit}/evt/ota` | 1 | no | OTA progress report |
| `fp/{companyId}/{unit}/status/conn` | 1 | **yes** | Presence; also the LWT |
| `fp/{companyId}/{unit}/status/machines` | 1 | **yes** | Snapshot of all pins |
| `fp/{companyId}/{unit}/req/register` | 1 | no | Get the machine id for a pin |
| `fp/{companyId}/{unit}/req/version` | 1 | no | Ask whether an update applies |
| `fp/{companyId}/{unit}/req/login` | 1 | no | Compatibility stub |

### Server → device — subscribe to these

| Topic | QoS | Retain | Purpose |
|---|---|---|---|
| `fp/{companyId}/{unit}/resp/{op}` | 1 | no | Reply to `req/{op}` |
| `fp/{companyId}/{unit}/cmd/config` | 1 | **yes** | Pin enable + debounce windows |
| `fp/{companyId}/{unit}/cmd/ota` | 1 | no | Firmware URL + SHA-256 |
| `fp/{companyId}/{unit}/cmd/reboot` | 1 | no | Delayed restart |

Your ACL confines you to `fp/{companyId}/{unit}/#` for both publish and
subscribe. Publishing outside it is rejected by the broker, and the server
refuses to reply to a Response Topic outside your own subtree.

---

## 4. `evt/machine` — the only event that carries data

```json
{
  "event_id": "9f2c1b7a-4c31-4a6e-9c21-1d5f0b7a2e11",
  "seq": 10432,
  "pin_no": 1,
  "state": "OFF",
  "ts": "2026-08-20T14:03:22.114Z",
  "buffered": false,
  "fw": "2.1.7"
}
```

| Field | Required | Rules |
|---|---|---|
| `event_id` | **yes** | UUIDv4, lowercase. Generated **once at capture** and reused for every retry and replay. This is the deduplication key — a wrong one causes duplicate or lost records. |
| `seq` | recommended | Monotonic per unit, persisted across reboots. Gaps are logged and surfaced as `machine:sequence:gap`. |
| `pin_no` | **yes** | 1–4. Anything else is rejected. |
| `state` | **yes** | `"ON"` or `"OFF"`, case-insensitive. `OFF` = machine stopped. `ON` = machine restarted. |
| `ts` | **yes** | ISO-8601 **UTC with milliseconds and a `Z` suffix**. Stamp at GPIO capture, never at send. Rejected if before 2020 or more than 24 h in the future. |
| `buffered` | no | `true` when replayed from the local queue. |
| `fw` | no | Firmware version string. |

### What the server does

- **`state: "OFF"`** → opens a stop record (`machine_data` row, `start_time = ts`).
- **`state: "ON"`** → closes the most recent open stop record (`end_time = ts`).

An `ON` event **does not need to know when the stop began**. There is no
timestamp matching — this is the main fix over v1.

### Rules that will bite you

1. **`event_id` must survive a reboot.** Write the event to the local queue with
   its UUID *before* publishing; delete the row only after PUBACK. A new UUID on
   retry creates a duplicate record.
2. **`ts` is capture time.** Buffered events keep their original timestamp. The
   server does **not** reject old timestamps — idempotency handles replay, so
   there is no freshness window to worry about.
3. **UTC only.** The v1 firmware sent local time on one code path and UTC on
   another. Everything is UTC now.
4. **Unknown unit+pin auto-registers.** A machine the server has never seen is
   created as unconfigured (`equipment_id = 0`) and appears in the admin IoT
   list awaiting assignment. No enrollment call needed.

---

## 5. `status/conn` — presence

Publish **retained**, QoS 1, immediately after connecting (this overwrites the
retained LWT):
```json
{"online": true, "reason": "connect", "fw": "2.1.7", "ip": "192.168.1.7"}
```
On a clean shutdown, publish `{"online": false, "reason": "shutdown"}` then
disconnect.

This replaces the 180-second HTTP heartbeat entirely. Do not poll.

---

## 6. `status/machines` — snapshot

Publish **retained**, QoS 1, after connect and whenever pin configuration
changes:
```json
{
  "fw": "2.1.7",
  "dropped_count": 0,
  "machines": [
    {"pin_no": 1, "state": "ON",  "enabled": true},
    {"pin_no": 2, "state": "OFF", "enabled": true},
    {"pin_no": 3, "state": "OFF", "enabled": false},
    {"pin_no": 4, "state": "ON",  "enabled": true}
  ]
}
```

`dropped_count` is the local buffer overflow counter. Report it; never drop
events silently.

The server **logs** state drift between this snapshot and the database but does
**not** reconcile it — inventing transitions that never happened would corrupt
run-time reporting. Drift means events were lost; investigate rather than paper
over it.

---

## 7. `req/{op}` — request / reply

Publish to `req/{op}`. On MQTT 5, set **Response Topic** (must be inside your own
subtree) and **Correlation Data**; the server echoes both. On MQTT 3.1.1, omit
them — the reply lands on `resp/{op}` and `req_id` is echoed in the body.

Timeout 10 s, retry 3× with backoff. If no reply arrives, carry on with the last
known values and retry later — never block machine capture on a reply.

### `req/register` — get the machine id for a pin

```json
→ {"req_id": "c7a1...", "pin_no": 1, "fw": "2.1.7", "ip": "192.168.1.7"}
← {"req_id": "c7a1...", "success": true, "pin_no": 1, "machine_id": 125, "configured": true}
```

Idempotent — asking twice returns the same `machine_id`. A pin the server has
never seen is created automatically. `configured: false` means no operator has
bound it to an equipment yet; **keep reporting events anyway**, they are stored
and become valid once binding happens.

You do not strictly need this call: `evt/machine` resolves the machine from
`(unit, pin_no)` on its own. Use it when you want the id for local display.

### `req/version` — should I update?

```json
→ {"req_id": "d1b2...", "fw": "2.1.7"}
← {"req_id": "d1b2...", "success": true, "update_available": true,
   "version": "2.1.8", "url": "https://api.fptest.com/downloads/fp_2.1.8.zip",
   "sha256": "e3b0c442...", "size": 10485760, "notes": "...", "mandatory": false}
```

**The server decides.** Do no version arithmetic on the device — comparing
version strings is what made v1 miss every `x.y.10` release. Act on
`update_available` alone.

When no update applies: `{"update_available": false, "version": "2.1.8"}`.

---

## 8. `cmd/*` — commands from the server

Subscribe to `fp/{companyId}/{unit}/cmd/#` after connecting.

**Hard rule:** the MQTT thread must never touch GPIO. Validate the command, hand
it to the control thread through a queue, and let that thread apply it. A
malformed or hostile command must not be able to drive a relay.

### `cmd/config` — retained

```json
{"cmd_id": "...", "off_on_ms": 100, "on_off_ms": 100,
 "pins": {"1": true, "2": true, "3": false, "4": true}}
```
Retained, so a rebooting unit receives current settings on subscribe without
asking. Only keys present are being changed. Pin keys outside 1–4 are stripped
server-side.

### `cmd/ota`

```json
{"cmd_id": "...", "version": "2.1.8",
 "url": "https://api.fptest.com/downloads/fp_2.1.8.zip",
 "sha256": "e3b0c442...", "size": 10485760, "force": false}
```

Required device behaviour, in order:

1. Download over HTTPS, streaming, treating `size` as an upper bound.
2. Compute SHA-256 and **abort unless it matches**. The server refuses to publish
   a release without a hash precisely because the install path runs as root.
3. Extract to a staging directory, swap a `current` symlink, then reboot. Never
   extract in place — a half-download must not brick the unit.
4. Report every step on `evt/ota`.

### `cmd/reboot`

```json
{"cmd_id": "...", "delay_s": 5}
```

---

## 9. `evt/ota` — progress

```json
{"cmd_id": "...", "state": "verifying", "version": "2.1.8", "detail": "sha256 ok"}
```

`state` is one of `downloading`, `verifying`, `applying`, `success`, `failed`.
Anything else is ignored. On `failed`, put the reason in `detail` — it is shown
in the admin fleet view and logged server-side.

---

## 10. Reconnect

- Randomized exponential backoff: base 1 s, ×2, cap 60 s, ±20 % jitter.
  Mandatory — 500 units reconnecting in lockstep will take the broker down.
- `clean_start = false` resumes the session.
- On reconnect, drain the local queue oldest-first with `buffered: true` and the
  original `ts` and `event_id`. Overlap with in-flight messages is safe;
  duplicates are absorbed.

---

## 11. Test it

```bash
export C=66 U=UNIT-01
export CRED="-u fp-$C-$U -P <password>"
export OPTS="-h api.fptest.com -p 8883 --cafile /etc/fpanalyzer/ca.crt $CRED"

# presence
mosquitto_pub $OPTS -t "fp/$C/$U/status/conn" -q 1 -r \
  -m '{"online":true,"reason":"connect","fw":"2.1.7"}'

# machine stopped
mosquitto_pub $OPTS -t "fp/$C/$U/evt/machine" -q 1 \
  -m "{\"event_id\":\"$(uuidgen | tr 'A-Z' 'a-z')\",\"seq\":1,\"pin_no\":1,\"state\":\"OFF\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",\"buffered\":false,\"fw\":\"2.1.7\"}"

# machine restarted
mosquitto_pub $OPTS -t "fp/$C/$U/evt/machine" -q 1 \
  -m "{\"event_id\":\"$(uuidgen | tr 'A-Z' 'a-z')\",\"seq\":2,\"pin_no\":1,\"state\":\"ON\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",\"buffered\":false,\"fw\":\"2.1.7\"}"
```

Server side:
```bash
docker compose -f docker-compose.server.yml logs -f backend | grep MQTT
```
Then open `/admin/mqtt-monitor/66` — the change should appear live.

---

## 12. Troubleshooting

| Symptom | Cause |
|---|---|
| Connection refused | Client ID is not exactly the username, or the unit was revoked |
| TLS handshake failure | Missing/wrong `ca.crt`, or connecting to the wrong port |
| Event accepted but nothing appears | `pin_no` outside 1–4, or `event_id` is not a valid lowercase UUIDv4 |
| Duplicate records | A new `event_id` generated on retry instead of reusing the stored one |
| Stop never closes | No `ON` event sent after the machine restarted |
| `sequence gap` warnings | Events lost between the queue and the broker; check queue-delete-after-PUBACK ordering |
| Revocation seems slow | Broker auth cache — up to 60 s |
| No reply to `req/{op}` | Not subscribed to `resp/#` before publishing, or the Response Topic was outside your own subtree (the server refuses those and falls back to `resp/{op}`) |
| `cmd/ota` never arrives | No release published, or the release has no SHA-256 — the server refuses to send one |
| OTA aborts at verify | Hash mismatch: the package was modified, truncated, or the release metadata is stale |
