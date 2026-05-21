# FP Analyzer MQTT — Quick Reference Card

## Connection Parameters

| Parameter | Value |
|-----------|-------|
| Broker (dev) | `mqtt://localhost:1883` |
| Broker (prod) | `mqtts://mqtt.fpanalyzer.com:8883` |
| TLS | Required in production (port 8883) |
| Username | `machine-{companyId}-{machineId}` — from provisioning endpoint |
| Password | Random base64url — from provisioning endpoint |
| Client ID | Same as username: `machine-{companyId}-{machineId}` |
| `clean_session` | `false` (enables offline message queuing) |
| Keepalive | `60` seconds |

**Get credentials:** `POST /api/v1/admin/iot/units/{machineId}/provision-mqtt` (admin JWT)

**LWT (set on CONNECT):**
```
Topic:   fp/v1/{companyId}/machine/{machineId}/status
Payload: {"machine_id":{machineId},"connected":false,"reason":"lwt","ts":0}
QoS: 1  Retain: true
```
Use `ts:0` — a real timestamp would be stale when the broker fires the LWT.

---

## Topic Table

| Topic | Dir | QoS | Retain | Purpose |
|-------|-----|-----|--------|---------|
| `fp/v1/{companyId}/machine/{machineId}/heartbeat` | D→S | 1 | Yes | Periodic online signal (replaces `installV1` heartbeat) |
| `fp/v1/{companyId}/machine/{machineId}/stop/start` | D→S | 1 | No | Machine stopped — opens stop record (replaces `saveStopDataV1`) |
| `fp/v1/{companyId}/machine/{machineId}/stop/end` | D→S | 1 | No | Machine restarted — closes stop record (replaces `installV1` restart) |
| `fp/v1/{companyId}/machine/new/enroll` | D→S | 1 | No | First-boot enrollment — request machineId (replaces `installV1` new-unit) |
| `fp/v1/{companyId}/machine/{machineId}/stop/replay` | D→S | 1 | No | Offline buffer replay (replaces `saveOfflineData`) |
| `fp/v1/{companyId}/machine/{machineId}/firmware/check` | D→S | 0 | No | Firmware version check (optional; HTTP also available) |
| `fp/v1/{companyId}/machine/{machineId}/status` | D→S | 1 | Yes | LWT + manual online/offline |
| `fp/v1/{companyId}/machine/new/enrolled` | S→D | 1 | No | Response to enroll — contains assigned `machineId` |
| `fp/v1/{companyId}/machine/{machineId}/stop/replay/ack` | S→D | 1 | No | Replay batch result — contains `committed` and `failed_at` |
| `fp/v1/{companyId}/machine/{machineId}/firmware/response` | S→D | 0 | No | Firmware version response with download URL |

D→S = device to server · S→D = server to device

---

## Minimal Payload Examples

**heartbeat** — publish every 30–60 s; `retain=true`
```json
{"machine_id":9,"pin_no":1,"unit_name":"Lathe-3","firmware_version":"1.3.0","ts":1747735200000}
```

**stop/start** — publish when machine stops; save `start_time` locally
```json
{"machine_id":9,"start_time":"2026-05-20T10:00:00Z","ts":1747735200000}
```

**stop/end** — publish when machine restarts; `start_time` MUST match stop/start exactly
```json
{"machine_id":9,"start_time":"2026-05-20T10:00:00Z","end_time":"2026-05-20T10:11:00Z","ts":1747735860000}
```

**enroll** — first boot only; subscribe to `enrolled` before publishing
```json
{"pin_no":99,"unit_name":"New-Unit","wifi_id":"FactorySSID","bluetooth_id":"*","ts":1747735200000}
```

**stop/replay** — after reconnect with buffered events; events sorted ascending
```json
{"machine_id":9,"events":[{"start_time":"2026-05-17T08:00:00Z","end_time":"2026-05-17T08:45:00Z","is_valid_data":true}],"ts":1747735200000}
```

**status (online)** — publish right after connect to overwrite retained LWT
```json
{"machine_id":9,"connected":true,"reason":"connect","ts":1747735200000}
```

---

## Three Essential Test Commands

Replace `COMPANY_ID`, `MACHINE_ID`, and `PASS` before running.

```bash
# 0. Setup
export H=localhost PORT=1883 COMPANY_ID=5 MACHINE_ID=9
export USER="machine-${COMPANY_ID}-${MACHINE_ID}" PASS="your-password"
export OPTS="-h $H -p $PORT -u $USER -P $PASS"
# For production: add --cafile ca.crt and change port to 8883

# 1. Heartbeat
mosquitto_pub $OPTS \
  -t "fp/v1/${COMPANY_ID}/machine/${MACHINE_ID}/heartbeat" \
  -m "{\"machine_id\":${MACHINE_ID},\"pin_no\":1,\"unit_name\":\"Test\",\"firmware_version\":\"1.3.0\",\"ts\":$(date +%s)000}" \
  -q 1 -r

# 2. Stop/Start
mosquitto_pub $OPTS \
  -t "fp/v1/${COMPANY_ID}/machine/${MACHINE_ID}/stop/start" \
  -m "{\"machine_id\":${MACHINE_ID},\"start_time\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"ts\":$(date +%s)000}" \
  -q 1

# 3. Stop/End  (use the SAME start_time from command 2)
mosquitto_pub $OPTS \
  -t "fp/v1/${COMPANY_ID}/machine/${MACHINE_ID}/stop/end" \
  -m "{\"machine_id\":${MACHINE_ID},\"start_time\":\"2026-05-20T10:00:00Z\",\"end_time\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"ts\":$(date +%s)000}" \
  -q 1
```

---

## Error Codes and Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Message silently dropped | `ts` is more than 60 s from server time | Sync NTP on boot; check `[MQTT] stale message rejected` in server logs |
| Stop row never closed | `start_time` in `stop/end` doesn't match `stop/start` | Store `start_time` persistently; pass the exact same ISO 8601 string |
| No response to `enroll` | Not subscribed to `enrolled` before publishing | Subscribe first, then publish |
| Duplicate stop rows | Reconnecting with a new client ID between retries | Use the provisioned, stable client ID — never change it |
| LWT not firing on power loss | `clean_session=true` or LWT not set on CONNECT | Set `clean_session=false`; configure LWT before calling `connect()` |
| Dashboard not updating | Wrong `companyId` in topic | Must match the integer from provisioning (`aclTopicPrefix` field) |
| Replay events partially committed | Events not sorted by `start_time` | Sort ascending before building the `events[]` array |
| Connection refused | Client ID doesn't match provisioned username | Client ID must be exactly `machine-{companyId}-{machineId}` |
