# FP Analyzer — Server Update Guide
**Target:** AWS Lightsail Ubuntu instance  
**Date produced:** 2026-05-21  
**Deployer assumed to be:** `ubuntu` user, project at `/opt/fp-analyzer`

---

## 1. What Changed (Change Analysis)

This update adds Phase 1 MQTT + WebSocket real-time support on top of the existing HTTP-only stack. All HTTP endpoints and database schemas remain backward-compatible.

### 1.1 New npm Packages

| Package | Service | Purpose |
|---------|---------|---------|
| `mqtt@^5.15.1` | backend | Connects backend to the Mosquitto broker as a subscriber |
| `socket.io@^4.8.3` | backend | Real-time event push to connected browser clients |
| `socket.io-client@^4.8.3` | frontend | Browser-side Socket.io connection to the backend |

### 1.2 New Source Files (must be present after `git pull`)

```
backend/
  src/services/mqtt.service.js          — MQTT subscriber + topic router
  src/services/socket.service.js        — Socket.io server + auth middleware
  src/routes/superadmin-mqtt.routes.js  — SuperAdmin test/monitor endpoints
  migrations/001_mqtt_columns.sql       — DB schema migration (run once)
  scripts/run-mqtt-migration.js         — Migration runner

docker/mosquitto/
  mosquitto.conf                        — Broker configuration
  acl                                   — Topic ACL rules
  passwd                                — Hashed broker credentials

frontend/src/
  app/(admin)/admin/mqtt-monitor/       — SuperAdmin MQTT monitor page
  app/(admin)/admin/mqtt-testing/       — SuperAdmin MQTT test page
  components/realtime/                  — Real-time UI components
  hooks/                                — Socket.io React hooks
  lib/socket.ts                         — User-facing socket singleton
  lib/adminSocket.ts                    — Admin socket singleton
  lib/store/adminSocketStore.ts         — Zustand admin socket store
  lib/store/machineSocketStore.ts       — Zustand machine socket store
```

### 1.3 Modified Source Files

| File | What Changed |
|------|-------------|
| `backend/src/server.js` | Socket.io attached to HTTP server; MQTT service started at boot |
| `backend/src/app.js` | `superadmin-mqtt.routes.js` registered at `/api/v1/superadmin` |
| `backend/src/routes/admin-iot.routes.js` | New `POST /admin/iot/units/:id/provision-mqtt` endpoint |
| `backend/src/services/admin-iot.service.js` | `provisionMqtt()` function added (uses `bcrypt` + `crypto`) |
| `backend/src/services/iot-machine-data.service.js` | Bug fix: unconfigured machine Turn Off/On flow; `mqtt_message_id` deduplication |
| `docker-compose.server.yml` | **MQTT service added** (Mosquitto broker, loopback-only port) |
| `.env.example` | 9 new MQTT variables documented |

### 1.4 Database Migration Required

**Migration:** `backend/migrations/001_mqtt_columns.sql`

Adds to every tenant schema (`tenant_template` + all `tenant_N`):

```sql
-- machines table
ALTER TABLE machines ADD COLUMN IF NOT EXISTS mqtt_client_id      VARCHAR(100);
ALTER TABLE machines ADD COLUMN IF NOT EXISTS mqtt_password_hash  TEXT;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS mqtt_provisioned_at TIMESTAMPTZ;

-- machine_data table
ALTER TABLE machine_data ADD COLUMN IF NOT EXISTS mqtt_message_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS ... ON machine_data(mqtt_message_id);
```

All columns are nullable with `IF NOT EXISTS` guards — **safe to run against a live database; no existing rows are affected.**

### 1.5 New Environment Variables

| Variable | Required | Example Value | Notes |
|----------|----------|---------------|-------|
| `MQTT_BROKER_URL` | **Yes** | `mqtt://mqtt:1883` | Internal Docker network URL; omit to disable MQTT silently |
| `MQTT_USERNAME` | Yes | `fpanalyzer-mqtt-u1` | Must match Mosquitto passwd entry |
| `MQTT_PASSWORD` | Yes | *(generate with openssl)* | Must match Mosquitto passwd entry |
| `MQTT_CLIENT_ID` | Recommended | `express-backend-prod` | Unique per deployment |
| `MQTT_TLS` | No | `false` | Set `true` + configure certs to use TLS (port 8883) |
| `MQTT_CA_FILE` | No | *(empty)* | Path to CA PEM; leave empty for public CA certs |
| `MQTT_TLS_VERIFY` | No | `true` | Keep `true`; only `false` for self-signed dev certs |
| `MQTT_BROKER_URL_PUBLIC` | Recommended | `mqtt://YOUR_SERVER_IP:1883` | Returned to IoT devices during provisioning |

> **`CORS_ORIGINS`** must include the production frontend domain so Socket.io handshakes succeed. This variable likely already exists — verify it includes `https://yourdomain.com`.

---

## 2. Pre-Update Checklist

Work through each item **before** running `git pull` or restarting Docker.

### 2.1 Disk Space

```bash
df -h /                      # root volume
df -h /var/lib/docker        # Docker data (images, volumes)
docker system df             # Docker usage breakdown
```

**Minimum headroom required:** 2 GB free (new images ≈ 500 MB compressed, build cache ≈ 1 GB).

```bash
# Free space if needed
docker image prune -f
docker builder prune -f
```

### 2.2 Required Packages on Ubuntu

Install the following if not already present:

```bash
sudo apt update

# Core tools (likely already installed)
sudo apt install -y git curl jq openssl

# Docker Engine (skip if already installed — check with `docker version`)
# Full install guide: https://docs.docker.com/engine/install/ubuntu/
# Quick check:
docker version && docker compose version

# mosquitto-clients — used for smoke tests (mosquitto_pub / mosquitto_sub)
sudo apt install -y mosquitto-clients
```

Verify versions:

```bash
docker --version          # 24.x or newer
docker compose version    # 2.x (plugin, not standalone)
openssl version           # any recent version
mosquitto_pub --help      # confirms mosquitto-clients is installed
```

### 2.3 Backups

Run all backup commands before touching code or containers.

#### 2.3.1 Database Backup

```bash
BACKUP_DIR="/opt/backups/fp-analyzer-$(date +%Y%m%d-%H%M)"
mkdir -p "$BACKUP_DIR"

# Full database dump (all schemas)
docker exec fp-analyzer-postgres-1 pg_dumpall -U app \
  | gzip > "$BACKUP_DIR/pg_dumpall.sql.gz"

echo "DB backup: $BACKUP_DIR/pg_dumpall.sql.gz"
ls -lh "$BACKUP_DIR/"
```

#### 2.3.2 Environment File Backup

```bash
cp /opt/fp-analyzer/.env.production "$BACKUP_DIR/.env.production.bak"
echo "Backed up .env.production"
```

#### 2.3.3 Mosquitto Files Backup

```bash
cp -r /opt/fp-analyzer/docker/mosquitto "$BACKUP_DIR/mosquitto-config/"
echo "Backed up Mosquitto config"
```

#### 2.3.4 Verify Backups

```bash
ls -lh "$BACKUP_DIR/"
zcat "$BACKUP_DIR/pg_dumpall.sql.gz" | head -5
```

### 2.4 Running Services Inventory

```bash
docker compose -f /opt/fp-analyzer/docker-compose.server.yml ps
```

Expected before this update: `postgres`, `redis`, `backend`, `frontend`. After this update, `mqtt` is also present.

### 2.5 Firewall / Security Group

The MQTT broker binds to **loopback only** (`127.0.0.1:1883`) in `docker-compose.server.yml`. IoT devices connect via the internal Docker network — the port does **not** need to be open in the Lightsail firewall for the broker itself.

However, verify:

| Port | Direction | Purpose | Action |
|------|-----------|---------|--------|
| 80 | inbound | HTTP (redirects to HTTPS) | Must be open |
| 443 | inbound | HTTPS + Socket.io WSS | Must be open |
| 1883 | **external** | MQTT plain-text | **Keep CLOSED** in Lightsail security group |
| 8883 | external | MQTT TLS (future) | Open only if you enable TLS later |

Socket.io uses the **same HTTPS port (443)** as the frontend — no extra port is needed. The upgrade from HTTP to WebSocket happens transparently via the existing reverse proxy.

```bash
# Lightsail CLI check (if aws CLI is installed)
aws lightsail get-instance-port-states --instance-name YOUR_INSTANCE_NAME
```

---

## 3. Step-by-Step Deployment

Run commands as `ubuntu` (or via sudo where indicated). All paths assume project root is `/opt/fp-analyzer`.

### Step 3.1 — SSH into the Instance

```bash
ssh -i ~/.ssh/your-lightsail-key.pem ubuntu@YOUR_INSTANCE_IP
```

### Step 3.2 — Set Working Variables

```bash
export PROJECT_DIR=/opt/fp-analyzer
export BACKUP_DIR="/opt/backups/fp-analyzer-$(date +%Y%m%d-%H%M)"
mkdir -p "$BACKUP_DIR"
cd "$PROJECT_DIR"
```

### Step 3.3 — Take Backups (from Section 2.3)

```bash
# Database
docker exec fp-analyzer-postgres-1 pg_dumpall -U app \
  | gzip > "$BACKUP_DIR/pg_dumpall.sql.gz"

# Environment and Mosquitto config
cp .env.production "$BACKUP_DIR/.env.production.bak"
cp -r docker/mosquitto "$BACKUP_DIR/mosquitto-config/"

ls -lh "$BACKUP_DIR/"
echo "Backups complete."
```

### Step 3.4 — Install Missing Packages

```bash
sudo apt update -y
sudo apt install -y mosquitto-clients jq
mosquitto_pub --help 2>&1 | head -2   # verify install
```

### Step 3.5 — Pull Latest Code

```bash
cd "$PROJECT_DIR"
git fetch origin main
git log --oneline -5                   # confirm what you are about to pull
git pull origin main
git log --oneline -5                   # confirm HEAD moved
```

Verify the new files are present:

```bash
ls backend/src/services/mqtt.service.js
ls backend/src/services/socket.service.js
ls backend/migrations/001_mqtt_columns.sql
ls docker/mosquitto/mosquitto.conf
```

### Step 3.6 — Add New Environment Variables

Open `.env.production` and add the MQTT block. Use your preferred editor:

```bash
nano .env.production
```

Add the following at the end of the file (replace placeholder values):

```env
# =============================================================================
# MQTT Broker — Phase 1 (added 2026-05-21)
# =============================================================================
MQTT_BROKER_URL=mqtt://mqtt:1883
MQTT_USERNAME=fpanalyzer-mqtt-u1
MQTT_PASSWORD=REPLACE_WITH_STRONG_PRODUCTION_PASSWORD
MQTT_CLIENT_ID=express-backend-prod
MQTT_TLS=false
MQTT_CA_FILE=
MQTT_TLS_VERIFY=true
MQTT_BROKER_URL_PUBLIC=mqtt://YOUR_SERVER_IP:1883
```

Generate a strong password and paste it in:

```bash
openssl rand -base64 32 | tr -d '\n/+='
# Copy the output and paste as MQTT_PASSWORD value
```

Also verify `CORS_ORIGINS` includes your production domain:

```bash
grep CORS_ORIGINS .env.production
# Expected: CORS_ORIGINS=https://yourdomain.com,...
```

If the production frontend domain is missing, add it:

```bash
# Example — adjust to your actual domain
sed -i 's|^CORS_ORIGINS=.*|&,https://yourdomain.com|' .env.production
# Then verify:
grep CORS_ORIGINS .env.production
```

### Step 3.7 — Set Up Mosquitto Password File

The `docker/mosquitto/passwd` file from the repository contains **development hashes only**. You must create a new production password entry for `fpanalyzer-mqtt-u1` that matches the `MQTT_PASSWORD` you set in Step 3.6.

```bash
# Read the production password you set
MQTT_PASS=$(grep '^MQTT_PASSWORD=' .env.production | cut -d= -f2)
echo "Using password of length: ${#MQTT_PASS}"

# Generate the hashed passwd file using a temporary Mosquitto container
# (Removes all existing dev entries and creates a fresh production file)
docker run --rm \
  -v "$(pwd)/docker/mosquitto:/mosquitto/config" \
  eclipse-mosquitto:2 \
  sh -c "mosquitto_passwd -c /mosquitto/config/passwd fpanalyzer-mqtt-u1 '${MQTT_PASS}' && echo 'passwd created OK'"
```

Set safe permissions on the file:

```bash
chmod 600 docker/mosquitto/passwd
ls -la docker/mosquitto/passwd      # should show -rw-------
```

Verify the file has exactly one entry:

```bash
wc -l docker/mosquitto/passwd       # should be 1
head -1 docker/mosquitto/passwd     # shows: fpanalyzer-mqtt-u1:$7$...
```

> **Note:** The `-c` flag creates a new file, overwriting existing hashes. This is intentional — dev device entries (machine-66-9 etc.) should not exist in production. IoT devices will be provisioned individually via the API (`POST /admin/iot/units/:id/provision-mqtt`), which returns new credentials to load into the device firmware.

Verify the ACL file has the correct superuser:

```bash
head -6 docker/mosquitto/acl
# Must show: user fpanalyzer-mqtt-u1
```

If the ACL still says `express-backend`, fix it:

```bash
sed -i 's/user express-backend/user fpanalyzer-mqtt-u1/' docker/mosquitto/acl
grep "^user " docker/mosquitto/acl | head -3
```

### Step 3.8 — Run the Database Migration

The migration adds nullable columns — it is safe to run while the existing backend is still up.

```bash
cd "$PROJECT_DIR"

# Run the migration inside the existing backend container
docker exec fp-analyzer-backend-1 \
  node scripts/run-mqtt-migration.js

# Expected output:
# Applying MQTT columns migration...
#   ✓ tenant_template
#   ✓ tenant_2
#   ✓ tenant_66
#   ...
# Done.
```

If the backend container is not running yet (first-time setup), run via a one-shot container:

```bash
docker compose -f docker-compose.server.yml run --rm \
  -e NODE_ENV=production \
  backend \
  node scripts/run-mqtt-migration.js
```

Verify columns exist:

```bash
docker exec fp-analyzer-postgres-1 psql -U app -d fp_analyzer \
  -c "SELECT column_name FROM information_schema.columns
      WHERE table_schema='tenant_template'
        AND table_name='machines'
        AND column_name LIKE 'mqtt%';"
# Expected: mqtt_client_id, mqtt_password_hash, mqtt_provisioned_at
```

### Step 3.9 — Rebuild Docker Images

```bash
cd "$PROJECT_DIR"

# Build backend and frontend (no-cache ensures new packages are installed)
docker compose -f docker-compose.server.yml build --no-cache backend frontend

# The MQTT broker uses a pre-built official image — no build step needed.
```

Verify images were built:

```bash
docker images | grep fp-analyzer
```

### Step 3.10 — Start/Restart All Services

```bash
cd "$PROJECT_DIR"

# Pass MQTT vars so the mqtt container's healthcheck can read them
MQTT_USERNAME=$(grep '^MQTT_USERNAME=' .env.production | cut -d= -f2) \
MQTT_PASSWORD=$(grep '^MQTT_PASSWORD=' .env.production | cut -d= -f2) \
docker compose -f docker-compose.server.yml up -d --force-recreate
```

Monitor startup:

```bash
# Watch all service health statuses (Ctrl-C when all healthy)
watch -n 3 'docker compose -f docker-compose.server.yml ps'

# Expected final state (allow 2–3 minutes for backend db:bootstrap):
# mqtt      healthy
# postgres  healthy
# redis     healthy
# backend   healthy
# frontend  healthy
```

If the `mqtt` service takes time to become healthy, check its logs:

```bash
docker compose -f docker-compose.server.yml logs mqtt --tail=20
```

### Step 3.11 — Run Smoke Tests

#### Test A: MQTT Broker Authentication

```bash
MQTT_PASS=$(grep '^MQTT_PASSWORD=' /opt/fp-analyzer/.env.production | cut -d= -f2)

mosquitto_pub -h 127.0.0.1 -p 1883 \
  -u fpanalyzer-mqtt-u1 -P "$MQTT_PASS" \
  -t "fp/v1/test/heartbeat" \
  -m '{"ts":0,"test":true}' \
  && echo "MQTT AUTH: OK" || echo "MQTT AUTH: FAIL"
```

#### Test B: Backend Connected to Broker

```bash
docker compose -f docker-compose.server.yml logs backend --tail=20 \
  | grep -E "\[MQTT\]"
# Expected:
# [MQTT] Connected to broker: mqtt://mqtt:1883
# [MQTT] Subscribed to fp/v1/#
```

#### Test C: Health Endpoints

```bash
curl -sf http://localhost:4000/api/v1/health | jq .
# Expected: {"status":"ok", ...}

curl -sf http://localhost:3000/ -o /dev/null -w "Frontend HTTP: %{http_code}\n"
# Expected: Frontend HTTP: 200
```

#### Test D: Socket.io Handshake

```bash
curl -sf "http://localhost:4000/socket.io/?EIO=4&transport=polling" \
  | grep -o '"sid":"[^"]*"' \
  && echo "Socket.io: OK" || echo "Socket.io: FAIL"
```

#### Test E: Heartbeat Through the Full Stack

Replace `COMPANY_ID`, `MACHINE_ID`, and `MQTT_PASS` with real production values:

```bash
COMPANY_ID=66   # Replace with actual company/tenant ID
MACHINE_ID=1    # Replace with an actual machine ID
MQTT_PASS=$(grep '^MQTT_PASSWORD=' /opt/fp-analyzer/.env.production | cut -d= -f2)
TS=$(python3 -c "import time; print(int(time.time() * 1000))")

# Publish heartbeat
mosquitto_pub -h 127.0.0.1 -p 1883 \
  -u fpanalyzer-mqtt-u1 -P "$MQTT_PASS" \
  -t "fp/v1/${COMPANY_ID}/machine/${MACHINE_ID}/heartbeat" \
  -m "{\"ts\":${TS},\"pin_no\":1,\"unit_name\":\"Smoke Test\"}" \
  && echo "Heartbeat published"

sleep 2

# Verify last_online updated in DB
docker exec fp-analyzer-postgres-1 psql -U app -d fp_analyzer \
  -c "SELECT id, last_online FROM tenant_${COMPANY_ID}.machines WHERE id=${MACHINE_ID};"
```

---

## 4. Rollback Plan

If anything fails after the update, use the following sequence to restore the previous state.

### Step 4.1 — Stop All Services

```bash
cd /opt/fp-analyzer
docker compose -f docker-compose.server.yml down
```

### Step 4.2 — Revert Code to Previous Commit

```bash
cd /opt/fp-analyzer
git log --oneline -10           # identify the previous commit hash
git checkout <PREVIOUS_HASH>    # substitute with actual hash, e.g. 8df4767
```

### Step 4.3 — Restore Environment File

```bash
cp "$BACKUP_DIR/.env.production.bak" /opt/fp-analyzer/.env.production
```

### Step 4.4 — Restore Mosquitto Config

```bash
cp -r "$BACKUP_DIR/mosquitto-config/" /opt/fp-analyzer/docker/mosquitto/
```

### Step 4.5 — Restore Database (only if schema changes caused failures)

> The migration adds nullable columns with IF NOT EXISTS. Normally a DB restore is **not** needed — just rolling back the code is sufficient. Only restore if data was corrupted.

```bash
# Stop postgres first
docker compose -f docker-compose.server.yml stop postgres

# Restore (destructive — deletes current data)
docker exec -i fp-analyzer-postgres-1 \
  sh -c "dropdb -U app fp_analyzer && createdb -U app fp_analyzer" && \
zcat "$BACKUP_DIR/pg_dumpall.sql.gz" | \
  docker exec -i fp-analyzer-postgres-1 psql -U app
```

### Step 4.6 — Rebuild Previous Images and Restart

```bash
cd /opt/fp-analyzer
docker compose -f docker-compose.server.yml build backend frontend
MQTT_USERNAME=$(grep '^MQTT_USERNAME=' .env.production | cut -d= -f2) \
MQTT_PASSWORD=$(grep '^MQTT_PASSWORD=' .env.production | cut -d= -f2) \
docker compose -f docker-compose.server.yml up -d
```

---

## 5. Post-Deployment IoT Device Provisioning

After the server is running, IoT devices (Raspberry Pi units) need new MQTT credentials issued by the API. The old device credentials in the dev `docker/mosquitto/passwd` were wiped in Step 3.7.

For each machine:

1. **Generate credentials** via the admin API:
   ```bash
   curl -sf -X POST \
     "https://yourdomain.com/api/v1/admin/iot/units/MACHINE_ID/provision-mqtt" \
     -H "Cookie: access_token=YOUR_JWT" \
     -H "X-Tenant-Id: COMPANY_ID" \
     | jq .data
   ```

2. **Add to Mosquitto passwd** on the server:
   ```bash
   DEVICE_USER="machine-COMPANY_ID-MACHINE_ID"
   DEVICE_PASS="<password from API response>"

   docker run --rm \
     -v /opt/fp-analyzer/docker/mosquitto:/mosquitto/config \
     eclipse-mosquitto:2 \
     mosquitto_passwd -b /mosquitto/config/passwd "$DEVICE_USER" "$DEVICE_PASS"

   # Reload broker without restart
   docker kill --signal=SIGHUP fp-analyzer-mqtt-1
   ```

3. **Add ACL entry** in `docker/mosquitto/acl`:
   ```
   user machine-COMPANY_ID-MACHINE_ID
   topic write fp/v1/COMPANY_ID/machine/MACHINE_ID/#
   topic read  fp/v1/COMPANY_ID/machine/MACHINE_ID/#
   ```
   Then reload: `docker kill --signal=SIGHUP fp-analyzer-mqtt-1`

4. **Flash credentials** to the device firmware.

---

## 6. Reference: Final `.env.production` MQTT Block

```env
# MQTT Broker — Phase 1
MQTT_BROKER_URL=mqtt://mqtt:1883
MQTT_USERNAME=fpanalyzer-mqtt-u1
MQTT_PASSWORD=<production-password-generated-with-openssl>
MQTT_CLIENT_ID=express-backend-prod
MQTT_TLS=false
MQTT_CA_FILE=
MQTT_TLS_VERIFY=true
MQTT_BROKER_URL_PUBLIC=mqtt://YOUR_SERVER_IP:1883
```

---

## 7. Checklist Summary

| # | Task | Done? |
|---|------|-------|
| 1 | Check disk space (`df -h`) | ☐ |
| 2 | Install `mosquitto-clients` and `jq` | ☐ |
| 3 | Backup database (`pg_dumpall`) | ☐ |
| 4 | Backup `.env.production` | ☐ |
| 5 | Backup Mosquitto config | ☐ |
| 6 | `git pull origin main` | ☐ |
| 7 | Add MQTT variables to `.env.production` | ☐ |
| 8 | Generate production Mosquitto passwd (`-c` flag = fresh file) | ☐ |
| 9 | Verify ACL uses `fpanalyzer-mqtt-u1` | ☐ |
| 10 | Run DB migration (`run-mqtt-migration.js`) | ☐ |
| 11 | `docker compose build --no-cache backend frontend` | ☐ |
| 12 | `docker compose up -d --force-recreate` (with MQTT env vars) | ☐ |
| 13 | Verify all services healthy (`docker compose ps`) | ☐ |
| 14 | Smoke test: MQTT auth (`mosquitto_pub`) | ☐ |
| 15 | Smoke test: backend log shows `[MQTT] Connected` | ☐ |
| 16 | Smoke test: Socket.io handshake succeeds | ☐ |
| 17 | Provision MQTT credentials for IoT devices | ☐ |
