# PRODUCTION DEPLOYMENT GUIDE
## MQTT + WebSocket Changes — FP Analyzer

> **Document scope:** Deployment of the MQTT broker integration and Socket.io real-time layer.  
> **Target environment:** Ubuntu 22.04/24.04 on AWS Lightsail with Docker Compose.  
> **Date produced:** 2026-05-21

---

## 1. Credential and Security Analysis

### 1.1 MQTT Broker Credentials (Backend Subscriber)

**Configuration file:** `backend/src/services/mqtt.service.js`  
**dotenv loading:** `require('dotenv').config()` in `backend/src/app.js` (line 3) — loads before any service is initialised.

#### Environment variables consumed

| Variable | Required | Fallback / default | Notes |
|---|---|---|---|
| `MQTT_BROKER_URL` | **Yes** | _(none — silent skip)_ | If unset the broker client is never created; app continues without MQTT |
| `MQTT_USERNAME` | No | `'express-backend'` | Hard-coded fallback in service |
| `MQTT_PASSWORD` | **Yes** | `undefined` (no fallback) | If unset, `undefined` is passed to `mqtt.connect()` — connection will be refused by Mosquitto |
| `MQTT_CLIENT_ID` | No | `'express-backend-' + Date.now()` | Unique per process restart if unset |
| `MQTT_TLS` | No | `false` | Set to `'true'` to enable TLS |
| `MQTT_CA_FILE` | No | _(none)_ | Absolute path to CA certificate; read synchronously at startup |
| `MQTT_TLS_VERIFY` | No | `true` | Set to `'false'` only for self-signed dev certs |
| `MQTT_BROKER_URL_PUBLIC` | No | Falls back to `MQTT_BROKER_URL` | Returned to devices during provisioning (should be the externally reachable URL) |
| `IOT_LATEST_VERSION` | No | `'1.0.0'` | Firmware version string advertised to devices |
| `IOT_FIRMWARE_URL` | No | `'/iot_version/software/latest.bin'` | Path served by backend |

#### Graceful-degradation behaviour

- `MQTT_BROKER_URL` **missing** → warns and returns `null`; no crash; HTTP endpoints continue to work.
- `MQTT_PASSWORD` **missing** → `undefined` is forwarded to the MQTT client constructor; the broker will refuse the connection at the TCP level but the Node process will not crash (reconnect loop starts).
- `MQTT_CA_FILE` **present but file missing** → `fs.readFileSync()` throws synchronously at startup (no try/catch). **The process will crash.** Set `MQTT_CA_FILE` only when the file is guaranteed to exist.

#### TLS certificate handling

```
// mqtt.service.js — approximate excerpt
if (process.env.MQTT_TLS === 'true') {
  if (process.env.MQTT_CA_FILE) {
    options.ca = fs.readFileSync(process.env.MQTT_CA_FILE);   // sync — must exist
  }
  options.rejectUnauthorized = process.env.MQTT_TLS_VERIFY !== 'false';
}
```

In production with a CA-signed certificate (e.g. Let's Encrypt), set `MQTT_TLS=true`, leave `MQTT_CA_FILE` empty (Node bundles trusted CAs), and keep `MQTT_TLS_VERIFY=true`.  
For a **self-signed** CA only: provide the absolute path in `MQTT_CA_FILE` and ensure the file is present before starting the container.

#### Credential-leak audit

No MQTT password, JWT secret, or sensitive value is printed in any `console.log` statement.  
Logs contain only status strings: broker URL, subscription acknowledgement, reconnect events.

---

### 1.2 Device MQTT Credentials (Provisioning)

**Endpoint:** `POST /api/v1/admin/iot/units/:id/provision-mqtt`  
**Service:** `backend/src/services/admin-iot.service.js`

#### Credential generation

```
username    = `machine-${tenant.tenantId}-${machineId}`
password    = crypto.randomBytes(32).toString('base64url')   // 256-bit entropy
passwordHash= await bcrypt.hash(password, 10)                // bcryptjs, 10 rounds
```

- **Plain password** is returned once in the API response and is **never stored**.
- **Hash** is stored in `machines.mqtt_password_hash` (tenant schema).
- The response includes a `"note"` field: `"Store the password securely — it will not be shown again."`

#### Database columns (added by migration)

Table `machines` (per-tenant schema):

| Column | Type | Notes |
|---|---|---|
| `mqtt_client_id` | `VARCHAR(100)` | Same value as `username` |
| `mqtt_password_hash` | `TEXT` | bcrypt hash, 10 rounds |
| `mqtt_provisioned_at` | `TIMESTAMPTZ` | Set to `NOW()` on each provision call |

Table `machine_data` (per-tenant schema):

| Column | Type | Notes |
|---|---|---|
| `mqtt_message_id` | `VARCHAR(100)` | Deduplicate/trace incoming MQTT messages |

An index on `machine_data(mqtt_message_id)` is also created (partial, WHERE NOT NULL).

#### Mosquitto authentication

Mosquitto uses a **static password file** (`/mosquitto/config/passwd`).  
The backend calls `provisionMqtt()` to generate bcrypt credentials, stores the hash in Postgres, and the Mosquitto file must be **updated separately** by the admin (or an automated script) to add the new `username:hash` line.  
There is no dynamic auth plugin wired up; the password file must be regenerated and `mosquitto_passwd` re-hashed whenever a new device is provisioned.

> **Production gap:** The current implementation does not automatically write to the Mosquitto passwd file. After provisioning, a separate step is required — see §2.6.

#### Credential revocation

No automated revocation mechanism exists. To revoke:
1. Remove the device's entry from the Mosquitto `passwd` file and reload Mosquitto.
2. NULL out `mqtt_client_id`, `mqtt_password_hash`, `mqtt_provisioned_at` in the tenant DB.

---

### 1.3 WebSocket (Socket.io) Credentials

**Service:** `backend/src/services/socket.service.js`  
**Frontend clients:** `frontend/src/lib/socket.ts`, `frontend/src/lib/adminSocket.ts`

#### JWT verification

| Item | Value |
|---|---|
| Secret variable | `JWT_ACCESS_SECRET` |
| Library | `jsonwebtoken` |
| Token kind enforced | `payload.kind === 'web'` |
| Verification | `jwt.verify(token, process.env.JWT_ACCESS_SECRET)` |

#### Auth handshake (three fallback methods, in order)

1. `socket.handshake.auth.token` — for non-browser clients that pass a token explicitly.
2. `Authorization: Bearer <token>` header.
3. `access_token` httpOnly cookie — parsed from the raw `Cookie` header via regex. This is the path used by Next.js browser clients (`withCredentials: true`).

#### CORS configuration

| Variable | Required | Default |
|---|---|---|
| `CORS_ORIGINS` | **Yes in prod** | `'http://localhost:3030,http://localhost:3000'` |

The value is split on `,` and trimmed. In production set it to the exact origins of the frontend and admin panel, e.g.:

```
CORS_ORIGINS=https://app.fpanalyzer.se,https://admin.fpanalyzer.se
```

#### Secure-cookie note

Socket.io itself only sets `credentials: true` in its CORS config; it does not set `secure` or `sameSite` flags — that is handled by the HTTP cookie layer (the REST auth middleware). Verify that the REST `Set-Cookie` response already uses `Secure; SameSite=Strict` in production (this is outside the scope of the MQTT changes but is a prerequisite for the Socket.io cookie path to work over HTTPS).

#### Frontend environment variable

| Variable | Used in | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `socket.ts:15`, `adminSocket.ts:14` | Backend base URL; **baked into bundle at build time** |

---

### 1.4 Security Concerns and Findings

| # | Severity | Finding | Remediation |
|---|---|---|---|
| S-1 | **HIGH** | `.env` is committed to git and contains real (dev) secrets: `MQTT_PASSWORD=dev-mqtt-backend-secret`, `POSTGRES_PASSWORD=app_dev_password` | Rotate these secrets immediately. Add `.env` to `.gitignore`. Use `.env.example` only for documentation. |
| S-2 | **MEDIUM** | `MQTT_PASSWORD` missing → `undefined` passed to broker; connection silently retries forever | Add an explicit check: if `MQTT_BROKER_URL` is set and `MQTT_PASSWORD` is not, log an error and exit (or at least alert) |
| S-3 | **MEDIUM** | `fs.readFileSync(MQTT_CA_FILE)` has no try/catch; if the file path is wrong the process crashes at startup | Wrap in try/catch or pre-validate path existence |
| S-4 | **LOW** | `docker/mosquitto/acl` is committed to git; contains test machine usernames (no passwords — low risk) | Acceptable; ensure real machine IDs are not sensitive |
| S-5 | **LOW** | No automated write to Mosquitto `passwd` file after provisioning; admin must update it manually | Document the manual step (see §2.6); consider adding a post-provision hook |
| S-6 | **INFO** | `docker/mosquitto/passwd` is **not** in git (correctly excluded) | No action needed |
| S-7 | **INFO** | `.env.example` contains only placeholder values; no real secrets | No action needed |

---

## 2. Pre-Deployment Checklist for Live Server

> Work through these steps **before** running `git pull`. Tick each box as you complete it.

---

### 2.1 Pre-Pull Validation

- [ ] **Check Node.js version** — must be ≥ 20 LTS:
  ```bash
  node --version
  ```
- [ ] **Check Docker and Docker Compose versions:**
  ```bash
  docker --version
  docker compose version
  ```
  Docker Compose v2 (`docker compose`) is required; v1 (`docker-compose`) is EOL.

- [ ] **Verify disk space** — MQTT broker adds a persistence volume; ensure ≥ 5 GB free:
  ```bash
  df -h /
  ```
- [ ] **Verify memory** — Mosquitto is lightweight (~5 MB RSS) but confirm at least 512 MB free:
  ```bash
  free -h
  ```
- [ ] **Confirm Docker socket access for your deploy user:**
  ```bash
  docker info > /dev/null && echo "Docker OK"
  ```
  If it fails, add the user to the `docker` group: `sudo usermod -aG docker $USER` then reconnect.

---

### 2.2 Database Backup

- [ ] **Backup the master database (all schemas):**
  ```bash
  PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
    -h localhost -U "$POSTGRES_USER" \
    --format=custom \
    --file="/var/backups/fp_$(date +%Y%m%d_%H%M%S).pgdump" \
    "$POSTGRES_DB"
  ```
  Replace variables with actual values from the production `.env`.

- [ ] **Verify the dump was created:**
  ```bash
  ls -lh /var/backups/fp_*.pgdump | tail -5
  ```

- [ ] **Optionally, dump individual tenant schemas** (if tenants are in the same cluster):
  ```bash
  PGPASSWORD="$POSTGRES_PASSWORD" pg_dumpall \
    -h localhost -U "$POSTGRES_USER" \
    --file="/var/backups/fp_all_$(date +%Y%m%d_%H%M%S).sql"
  ```

---

### 2.3 Backup Existing Configuration Files

- [ ] **Backup the production `.env`:**
  ```bash
  cp /opt/fp-analyzer/.env /var/backups/fp_env_$(date +%Y%m%d_%H%M%S).bak
  ```

- [ ] **Backup any existing Mosquitto passwd and acl files** (if Mosquitto was already running):
  ```bash
  cp /opt/fp-analyzer/docker/mosquitto/passwd /var/backups/mosquitto_passwd_$(date +%Y%m%d_%H%M%S).bak
  cp /opt/fp-analyzer/docker/mosquitto/acl    /var/backups/mosquitto_acl_$(date +%Y%m%d_%H%M%S).bak
  ```

---

### 2.4 Firewall Rules

The Mosquitto broker listens internally on port **1883** (plaintext, container-to-container only). **Do not expose port 1883 publicly.** Devices should connect through your reverse proxy (e.g. Nginx with `stream` block) on 8883 with TLS termination, or use port 1883 only on a private VPC/VPN.

- [ ] **Confirm that port 1883 is NOT open on the public interface:**
  ```bash
  sudo ufw status | grep 1883
  ```
  If it appears open externally, close it:
  ```bash
  sudo ufw deny 1883/tcp
  ```

- [ ] **If exposing MQTT externally with TLS (port 8883), open it selectively:**
  ```bash
  sudo ufw allow from <device-ip-range> to any port 8883 proto tcp
  ```

- [ ] **Ensure Socket.io traffic flows through the HTTPS reverse proxy** (port 443 → backend:4000 `/socket.io`). No additional firewall rule needed if already behind Nginx/Traefik.

---

### 2.5 Environment Variables — Add / Update

Open the production `.env` file and add or update the following variables. Values marked **REQUIRED** will cause a broken deployment if omitted.

```bash
# ── MQTT Broker ─────────────────────────────────────────────────────────────
# Internal URL used by the Express backend to subscribe to the broker.
# Use the Docker service name if Mosquitto runs in the same Compose stack.
MQTT_BROKER_URL=mqtt://mosquitto:1883          # REQUIRED — internal container URL
MQTT_USERNAME=express-backend                  # REQUIRED — must match passwd file
MQTT_PASSWORD=<generate: openssl rand -base64 32>  # REQUIRED — strong random value
MQTT_CLIENT_ID=express-backend-prod            # optional, default uses timestamp
MQTT_TLS=false                                 # false = plaintext inside Docker network
MQTT_CA_FILE=                                  # leave empty unless using self-signed CA
MQTT_TLS_VERIFY=true                           # leave true

# External URL returned to devices during provisioning (what the IoT device calls).
# This should be the broker's public hostname/port, TLS-terminated if applicable.
MQTT_BROKER_URL_PUBLIC=mqtts://mqtt.yourdomain.se:8883   # REQUIRED if provisioning devices

# ── WebSocket / Socket.io ───────────────────────────────────────────────────
# Comma-separated list of allowed origins — must match exactly what the browser sends.
CORS_ORIGINS=https://app.fpanalyzer.se,https://admin.fpanalyzer.se  # REQUIRED

# ── JWT (must already exist — verify values are strong) ────────────────────
JWT_ACCESS_SECRET=<64+ character random string>    # REQUIRED — already present; confirm it is strong
JWT_REFRESH_SECRET=<64+ character random string>   # REQUIRED — already present
JWT_DEVICE_SECRET=<64+ character random string>    # REQUIRED — used for device tokens

# ── IoT Firmware (optional) ────────────────────────────────────────────────
IOT_LATEST_VERSION=1.0.0                           # optional, default 1.0.0
IOT_FIRMWARE_URL=/iot_version/software/latest.bin  # optional
```

**Generate a strong MQTT_PASSWORD:**
```bash
openssl rand -base64 32
```

**Generate a strong JWT secret:**
```bash
openssl rand -hex 64
```

> **Note on `NEXT_PUBLIC_API_URL`** (frontend):  
> This variable is baked into the Next.js build at compile time and is not in the backend `.env`.  
> Ensure it is set in the frontend build environment (Vercel, CI, or `frontend/.env.production`) to the production backend URL before building the frontend image:
> ```
> NEXT_PUBLIC_API_URL=https://api.fpanalyzer.se
> ```

---

### 2.6 Mosquitto Password File — Create / Update

The Mosquitto container uses a static `passwd` file that must be created before starting the broker. This file is **not committed to git** and must be maintained manually on the server.

- [ ] **Create the Mosquitto configuration directory** (if it does not already exist on the host):
  ```bash
  mkdir -p /opt/fp-analyzer/docker/mosquitto
  ```

- [ ] **Create the backend subscriber entry** using `mosquitto_passwd` (run inside the mosquitto container or install the `mosquitto-clients` package):
  ```bash
  # If mosquitto_passwd is available on the host:
  sudo apt-get install -y mosquitto-clients

  # Create a new passwd file with the backend user:
  mosquitto_passwd -c /opt/fp-analyzer/docker/mosquitto/passwd express-backend
  # → Enter the same password as MQTT_PASSWORD in your .env
  ```

- [ ] **Set file permissions** (Mosquitto reads this file as UID 1883 inside the container):
  ```bash
  sudo chown 1883:1883 /opt/fp-analyzer/docker/mosquitto/passwd
  sudo chmod 600       /opt/fp-analyzer/docker/mosquitto/passwd
  ```

- [ ] **After provisioning each real device**, add its entry to the passwd file:
  ```bash
  # Add without overwriting existing entries (omit -c flag):
  mosquitto_passwd /opt/fp-analyzer/docker/mosquitto/passwd machine-<tenantId>-<machineId>
  # → Enter the plain password that was returned by the provision-mqtt API
  ```

- [ ] **Reload Mosquitto after every passwd change** (no full restart needed):
  ```bash
  docker compose exec mqtt kill -HUP 1
  ```
  Mosquitto re-reads the passwd and acl files on SIGHUP without dropping existing connections.

---

### 2.7 Docker Compose — Add Mosquitto Service

If Mosquitto is **not yet running** in the production Compose stack, add the following service to `docker-compose.yml` (or a `docker-compose.override.yml` if you prefer to keep changes isolated):

```yaml
services:
  mqtt:
    image: eclipse-mosquitto:2
    restart: unless-stopped
    ports:
      # Do NOT expose 1883 publicly; keep it within the Docker network.
      # Remove the line below once you confirm backend can reach it internally.
      - "127.0.0.1:1883:1883"
    volumes:
      - ./docker/mosquitto/mosquitto.conf:/mosquitto/config/mosquitto.conf:ro
      - ./docker/mosquitto/acl:/mosquitto/config/acl:ro
      - ./docker/mosquitto/passwd:/mosquitto/config/passwd:ro
      - mqtt-data:/mosquitto/data
      - mqtt-log:/mosquitto/log

volumes:
  mqtt-data:
  mqtt-log:
```

Ensure the backend service is in the same Docker network (`networks:` block) so it can reach `mosquitto:1883`.

---

### 2.8 Pull Code and Rebuild

- [ ] **Pull the latest code:**
  ```bash
  cd /opt/fp-analyzer
  git pull origin main
  ```

- [ ] **Rebuild images** (backend and frontend changed):
  ```bash
  docker compose build --no-cache backend frontend
  ```

- [ ] **Pull the latest Mosquitto image:**
  ```bash
  docker compose pull mqtt
  ```

---

### 2.9 Database Migrations

Run migrations **before** starting the new backend container so that the schema is ready when the app boots.

- [ ] **Run the SQL migration** to add MQTT columns to all schemas:
  ```bash
  docker compose run --rm backend node scripts/run-mqtt-migration.js
  ```
  This script applies `backend/migrations/001_mqtt_columns.sql` to `tenant_template` and every `tenant_<id>` schema.

- [ ] **Verify no errors** in the output — look for lines like:
  ```
  ✓ Applied migration to tenant_1
  ✓ Applied migration to tenant_2
  ```
  Any `ERROR` line means the migration failed for that tenant; investigate before proceeding.

- [ ] **Confirm columns exist** (spot-check one tenant):
  ```bash
  docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -c "\d tenant_1.machines" | grep mqtt
  ```
  Expected output: `mqtt_client_id`, `mqtt_password_hash`, `mqtt_provisioned_at`.

---

### 2.10 Start / Restart Services

- [ ] **Start Mosquitto first** (backend needs it reachable at startup):
  ```bash
  docker compose up -d mqtt
  ```
  Wait ~3 seconds and confirm it is healthy:
  ```bash
  docker compose logs mqtt --tail=20
  ```
  Look for: `mosquitto version 2.x.x running`.

- [ ] **Restart the backend** (picks up new env vars and MQTT connection):
  ```bash
  docker compose up -d --force-recreate backend
  ```

- [ ] **Restart the frontend** (rebuilds with updated `NEXT_PUBLIC_API_URL` if it changed):
  ```bash
  docker compose up -d --force-recreate frontend
  ```

---

### 2.11 Post-Deployment Smoke Tests

- [ ] **MQTT broker reachable internally:**
  ```bash
  docker compose exec backend \
    node -e "
      const mqtt = require('mqtt');
      const c = mqtt.connect('mqtt://mosquitto:1883', {
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
      });
      c.on('connect', () => { console.log('MQTT OK'); c.end(); process.exit(0); });
      c.on('error', (e) => { console.error('MQTT FAIL', e.message); process.exit(1); });
    "
  ```

- [ ] **Backend subscribed to broker** — check backend logs:
  ```bash
  docker compose logs backend --tail=50 | grep -i mqtt
  ```
  Expected lines:
  ```
  [MQTT] Connected to broker: mqtt://mosquitto:1883
  [MQTT] Subscribed to fp/v1/#
  ```

- [ ] **Socket.io accepting connections** — check backend logs:
  ```bash
  docker compose logs backend --tail=50 | grep -i socket
  ```
  Expected:
  ```
  [Socket.io] Server initialised
  ```

- [ ] **Browser WebSocket connectivity** — open the production admin dashboard in a browser, open DevTools → Network → filter by `WS`. Confirm a WebSocket connection to `/socket.io` shows `101 Switching Protocols` and remains open.

- [ ] **Provision a test device** and verify credentials:
  ```bash
  curl -s -X POST https://api.fpanalyzer.se/api/v1/admin/iot/units/<TEST_MACHINE_ID>/provision-mqtt \
    -H "Authorization: Bearer <ADMIN_JWT>" \
    -H "Content-Type: application/json" | jq .
  ```
  Response must contain `username`, `password`, and `brokerUrl`. Add the device to the Mosquitto passwd file (§2.6) and test a connection:
  ```bash
  mosquitto_pub -h <broker-host> -p 1883 \
    -u "<returned-username>" -P "<returned-password>" \
    -t "fp/v1/<tenantId>/machine/<machineId>/heartbeat" \
    -m '{"ts":1234567890,"status":"ok"}'
  ```
  Confirm the backend logs show the received message.

- [ ] **Superadmin MQTT monitor** — log in as superadmin, open the MQTT monitor page, confirm company list loads and test machine action returns `200 OK`.

---

### 2.12 Rollback Plan

If any step above fails and you need to revert:

#### Stop new services and revert code

```bash
# Stop and remove the new containers
docker compose down backend frontend mqtt

# Revert to the previous commit
git log --oneline -5    # find the commit before this deployment
git checkout <previous-commit-hash>

# Rebuild from the previous code
docker compose build --no-cache backend frontend
docker compose up -d backend frontend
```

#### Revert the database migration

The migration adds **nullable** columns only; existing rows are unaffected. No data migration ran. To undo:

```bash
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" << 'EOF'
-- Run for each affected tenant schema, e.g. tenant_1, tenant_2, …
ALTER TABLE tenant_1.machines
  DROP COLUMN IF EXISTS mqtt_client_id,
  DROP COLUMN IF EXISTS mqtt_password_hash,
  DROP COLUMN IF EXISTS mqtt_provisioned_at;

ALTER TABLE tenant_1.machine_data
  DROP COLUMN IF EXISTS mqtt_message_id;
EOF
```

Repeat for every tenant schema. Or restore from the pg_dump taken in §2.2:

```bash
PGPASSWORD="$POSTGRES_PASSWORD" pg_restore \
  --host localhost --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" --clean \
  /var/backups/fp_<timestamp>.pgdump
```

#### Disable MQTT without reverting code

If you want to keep the new code deployed but disable MQTT (e.g. broker is unreachable):

1. Remove or unset `MQTT_BROKER_URL` in the production `.env`.
2. Restart the backend: `docker compose up -d --force-recreate backend`.
3. The `mqttService.connect()` call will detect no URL, log a warning, and skip — HTTP and Socket.io continue to function normally.

#### Restore the .env backup

```bash
cp /var/backups/fp_env_<timestamp>.bak /opt/fp-analyzer/.env
docker compose up -d --force-recreate backend
```

---

## Appendix A — Complete Variable Reference

| Variable | Service | Required | Production example |
|---|---|---|---|
| `MQTT_BROKER_URL` | Backend | Yes | `mqtt://mosquitto:1883` |
| `MQTT_USERNAME` | Backend | Yes | `express-backend` |
| `MQTT_PASSWORD` | Backend | Yes | _(generated with openssl)_ |
| `MQTT_CLIENT_ID` | Backend | No | `express-backend-prod` |
| `MQTT_TLS` | Backend | No | `false` (internal) / `true` (public TLS) |
| `MQTT_CA_FILE` | Backend | No | `/run/secrets/mqtt-ca.crt` (only for self-signed CA) |
| `MQTT_TLS_VERIFY` | Backend | No | `true` |
| `MQTT_BROKER_URL_PUBLIC` | Backend | Yes (if provisioning devices) | `mqtts://mqtt.yourdomain.se:8883` |
| `CORS_ORIGINS` | Backend | Yes | `https://app.fpanalyzer.se,https://admin.fpanalyzer.se` |
| `JWT_ACCESS_SECRET` | Backend | Yes | _(64+ hex chars)_ |
| `JWT_REFRESH_SECRET` | Backend | Yes | _(64+ hex chars)_ |
| `JWT_DEVICE_SECRET` | Backend | Yes | _(64+ hex chars)_ |
| `NEXT_PUBLIC_API_URL` | Frontend (build) | Yes | `https://api.fpanalyzer.se` |
| `IOT_LATEST_VERSION` | Backend | No | `1.0.0` |
| `IOT_FIRMWARE_URL` | Backend | No | `/iot_version/software/latest.bin` |
