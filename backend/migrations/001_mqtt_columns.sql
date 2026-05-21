-- Migration 001: Add MQTT columns to tenant schemas
-- Run this against the fp_analyzer database (or each tenant DB if using multi-DB mode).
-- All new columns are nullable and do not affect existing HTTP-inserted rows.
--
-- Run once per tenant schema: replace {{SCHEMA}} with the actual schema name
-- (e.g. tenant_1, tenant_5, tenant_template).
-- The helper script scripts/run-mqtt-migration.js applies this to all schemas automatically.

-- machines: store per-device MQTT broker credentials
ALTER TABLE "{{SCHEMA}}".machines
  ADD COLUMN IF NOT EXISTS mqtt_client_id       VARCHAR(100),
  ADD COLUMN IF NOT EXISTS mqtt_password_hash   TEXT,
  ADD COLUMN IF NOT EXISTS mqtt_provisioned_at  TIMESTAMPTZ;

-- machine_data: QoS-1 deduplication key
ALTER TABLE "{{SCHEMA}}".machine_data
  ADD COLUMN IF NOT EXISTS mqtt_message_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS "{{SCHEMA}}_machine_data_mqtt_message_id_idx"
  ON "{{SCHEMA}}".machine_data (mqtt_message_id)
  WHERE mqtt_message_id IS NOT NULL;
