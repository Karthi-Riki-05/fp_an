# FP Analyzer — IoT Developer Handoff

**To:** the IoT / firmware developer
**Subject:** the MQTT server side is built and running. Here is how to connect to it.
**Date:** 2026-08-20

---

## 1. Read this first — what changed from your design

Your `fpanalyzer-mqtt-architecture.html` is what we built from, and most of it was
adopted as written: unified ON/OFF events, client-generated `event_id` for
idempotency, LWT presence, the local durable queue, hybrid OTA (URL over MQTT,
bytes over HTTPS), the three-thread fault-isolation model.

**Four things differ. Build to these, not to the HTML.**

| Your design | What the server implements | Why |
|---|---|---|
| `fp/{company-slug}/{unit}/...` | `fp/{companyId}/{unit}/...` — an **integer** | That integer is the tenant id; it selects the Postgres schema directly. A slug would need a lookup that buys nothing. |
| Per-device X.509 mTLS | **Username + password over TLS** | Credentials live in Postgres and are individually revocable, which was the actual requirement. Topics and ACLs are unchanged if we move to mTLS later. |
| First-boot enrollment over MQTT | **Still HTTP** | A factory-fresh unit has no broker credentials, so it cannot connect at all. Everything after provisioning is MQTT. |
| `req/login` returns an auth result | **Stub that always succeeds** | Reaching the topic already required valid broker credentials — the connection *is* the authentication. |

**The full, authoritative spec is [`MQTT_V2_FIRMWARE_CONTRACT.md`](./MQTT_V2_FIRMWARE_CONTRACT.md).**
Where it and the HTML disagree, the contract wins.

Two older files in this repo — `iot_mqtt.md` and `mqtt_quickref.md` — describe the
**previous** protocol and are now marked superseded. Ignore them.

---

## 2. Connection details

| | |
|---|---|
| **Broker** | `mqtts://api.fptest.com:8883` |
| **TLS** | Required. There is no plain-text listener. |
| **CA certificate** | We issue it — a private CA, not a public one. Install as `/etc/fpanalyzer/ca.crt`. |
| **Protocol** | MQTT 5.0 preferred; 3.1.1 works |
| **Username** | `fp-{companyId}-{unitName}` — we issue this |
| **Password** | random, 32 bytes — we issue this, shown once |
| **Client ID** | **exactly the username** — a mismatch is refused |
| **Clean Start** | `false` |
| **Session Expiry** | `86400` (24 h) |
| **Keep Alive** | `60` |
| **API base** | `https://api.fptest.com/api/v1/machine/` — note `/api/v1/`, not `/api/` |

**We give you, per Raspberry Pi:** the username, the password, and `ca.crt`.

### One credential per Pi, not per machine

This is the biggest structural difference from the old system. A Pi carrying four
machines on pins 1–4 uses **one** connection, **one** credential, **one** topic
subtree. `pin_no` inside the payload says which machine an event belongs to.

Your ACL confines you to `fp/{companyId}/{unit}/#` for both publish and subscribe.
We tested this: a unit publishing into another company's subtree is silently
dropped by the broker.

---

## 3. The flow

### Once, per unit, before it ships

We run one command and hand you three values. Nothing is needed from you here.

```
username  fp-66-UNIT-01
password  kJ8x2mQ...
ca.crt    (file)
```

### Every boot

```
1. Sync the clock (NTP) — see §5, this matters
2. Connect TLS 8883, clean_start=false, client_id = username
   Register the LWT *before* connecting:
     topic   fp/66/UNIT-01/status/conn   retain=true  qos=1
     payload {"online": false, "reason": "lwt"}
3. Publish presence, retained, to overwrite the LWT:
     fp/66/UNIT-01/status/conn  {"online": true, "reason": "connect", "fw": "2.1.7"}
4. Subscribe to  fp/66/UNIT-01/resp/#  and  fp/66/UNIT-01/cmd/#
5. Publish a retained snapshot of all 4 pins:
     fp/66/UNIT-01/status/machines
6. Optional: ask req/register for each pin's machine_id (for local display only —
   events resolve the machine on their own)
7. Optional: ask req/version to see whether an update applies
```

### While running

```
GPIO transition
  -> stamp UTC time and a UUIDv4 at CAPTURE
  -> write to the local SQLite queue
  -> MQTT thread publishes  fp/66/UNIT-01/evt/machine  qos=1
  -> delete the queue row ONLY after PUBACK
```

```json
{"event_id":"9f2c...","seq":10432,"pin_no":1,"state":"OFF",
 "ts":"2026-08-20T10:00:00.000Z","buffered":false,"fw":"2.1.7"}
```

`state:"OFF"` = machine stopped. `state:"ON"` = machine restarted.
The ON event does **not** need to carry the stop time — the server closes
whatever stop is currently open. No timestamp string matching anywhere.

### When the network drops

Keep capturing. Keep queuing. Machine monitoring must never stop because the
network did. On reconnect, drain the queue oldest-first with `buffered: true` and
the **original** `ts` and `event_id`.

Reconnect with randomized exponential backoff — base 1 s, ×2, cap 60 s, ±20 %
jitter. With 500 units this is not optional.

If the queue ever overflows, drop oldest and report `dropped_count` in the next
`status/machines`. Never lose data silently.

### Firmware update

```
server -> fp/66/UNIT-01/cmd/ota   {version, url, sha256, size}
device  -> download over HTTPS (size is an upper bound)
        -> compute SHA-256, ABORT unless it matches
        -> extract to staging, swap a symlink, reboot
        -> report each step on fp/66/UNIT-01/evt/ota
```

The hash check is mandatory. The install path runs as root; the server refuses to
publish a release that has no hash, and the device must refuse to install one.

---

## 4. Reference skeleton

```python
import json, time, uuid, sqlite3
import paho.mqtt.client as mqtt

COMPANY_ID, UNIT = 66, "UNIT-01"
USER = f"fp-{COMPANY_ID}-{UNIT}"
BASE = f"fp/{COMPANY_ID}/{UNIT}"

c = mqtt.Client(client_id=USER, clean_session=False, protocol=mqtt.MQTTv5)
c.username_pw_set(USER, PASSWORD)
c.tls_set(ca_certs="/etc/fpanalyzer/ca.crt")

c.will_set(f"{BASE}/status/conn",
           json.dumps({"online": False, "reason": "lwt"}),
           qos=1, retain=True)

c.connect("api.fptest.com", 8883, keepalive=60)
c.subscribe([(f"{BASE}/resp/#", 1), (f"{BASE}/cmd/#", 1)])
c.publish(f"{BASE}/status/conn",
          json.dumps({"online": True, "reason": "connect", "fw": FW}),
          qos=1, retain=True)

def on_gpio_change(pin_no, is_running):
    # Stamp identity and time HERE, at capture — never at send time.
    event = {
        "event_id": str(uuid.uuid4()),
        "seq":      next_seq(),
        "pin_no":   pin_no,
        "state":    "ON" if is_running else "OFF",
        "ts":       time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
        "buffered": False,
        "fw":       FW,
    }
    queue_insert(event)        # persist BEFORE publishing

def drain_queue():
    for row in queue_oldest_first():
        info = c.publish(f"{BASE}/evt/machine", json.dumps(row), qos=1)
        info.wait_for_publish()
        queue_delete(row["event_id"])   # only after PUBACK
```

---

## 5. The four rules that cause most bugs

1. **`event_id` must survive a reboot.** Write it to the queue before publishing
   and reuse the same one on every retry. A fresh UUID on retry creates a
   duplicate record; the same one is silently absorbed. This is the entire
   deduplication mechanism.

2. **UTC, always, with milliseconds and a `Z`.** The v1 firmware sent local time
   on one path and UTC on another. Everything is UTC now.

3. **NTP at boot.** Your `ts` is the capture time and the server does *not*
   reject old timestamps — buffered replay depends on that. But a clock that is
   wrong by hours produces wrong reports with no error anywhere.

4. **The MQTT thread never touches GPIO.** Validate an inbound command, hand it to
   the control thread through a queue, and let that thread act. Your own §12 —
   we're holding you to it.

---

## 6. What we have already verified

Tested against a live broker and database, not just in theory:

- Broker authenticates against Postgres; wrong password is refused at CONNECT
- A valid unit publishing into another company's subtree is **dropped** — we
  confirmed the message never reaches the backend
- Machine auto-registers on first event from an unseen unit+pin
- A stop opens a record; the ON event closes it and computes duration
- **Re-sending the same `event_id` creates no second record**
- LWT/presence marks the unit offline

So the server side is real. What is missing is a device that talks to it.

---

## 7. What we need from you

1. **Confirm you will build to `MQTT_V2_FIRMWARE_CONTRACT.md`**, not the HTML —
   particularly the integer `{companyId}` topic segment.
2. **Tell us how many pins per unit in the field** — we assume up to 4 (GPIO
   17, 27, 22, 5 → pins 1–4). The server rejects anything outside 1–4.
3. **Fix the v1 client bugs you documented**, since those devices are still live:
   the `fetchone()` batch loop that uploads 4 of every 5 records but deletes all
   5; stops not being buffered offline; the hard-coded `test.fpanalyzer.se` in
   four files.
4. **Tell us your unit naming scheme.** `unitName` becomes an MQTT topic segment,
   so it must be 1–50 characters of `A-Z a-z 0-9 . _ -` and stable for the life
   of the device.
5. **Say whether you want mTLS in a later phase.** The design is ready for it; it
   is a broker config change plus a certificate pipeline, no protocol change.

---

## 8. Open questions on our side

- **Broker high availability.** Still a single Mosquitto node. Your §2 is right
  that this is the real risk at 500 units, not throughput. Not yet resolved.
- **Package signing.** We enforce SHA-256, which proves the file is intact but not
  who made it. As your doc notes, whoever controls the version response controls
  the hash. Signing is the proper fix and is not built.
