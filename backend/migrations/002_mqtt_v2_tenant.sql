-- Migration 002b: MQTT v2 idempotency columns (PER-TENANT — replace {{SCHEMA}})
--
-- Replaces the mqtt_message_id dedup key from migration 001, which used the MQTT
-- packet identifier. Packet ids are assigned by the publishing client, range
-- 1..65535, and restart at 1 on every reconnect — so they collide across devices
-- and across reconnects. The old index was also not scoped by machine_id, which
-- meant one machine's event could suppress another machine's event.
--
-- event_id is a client-generated UUIDv4 that is stable across retries and offline
-- replay. seq is a monotonic per-unit counter used to detect gaps (lost events).
--
-- Applied by scripts/run-mqtt-v2-migration.js to tenant_template + every tenant_<id>.

ALTER TABLE "{{SCHEMA}}".machine_data
  ADD COLUMN IF NOT EXISTS event_id   UUID,
  ADD COLUMN IF NOT EXISTS seq        BIGINT,
  ADD COLUMN IF NOT EXISTS buffered   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS end_event_id UUID;

-- The real dedup guarantee. Partial so legacy HTTP-inserted rows (event_id NULL)
-- are unaffected and can coexist during the dual-run migration phase.
CREATE UNIQUE INDEX IF NOT EXISTS "{{SCHEMA}}_machine_data_event_id_uniq"
  ON "{{SCHEMA}}".machine_data (machine_id, event_id)
  WHERE event_id IS NOT NULL;

-- Same guarantee for the ON event that closes a stop row.
CREATE UNIQUE INDEX IF NOT EXISTS "{{SCHEMA}}_machine_data_end_event_id_uniq"
  ON "{{SCHEMA}}".machine_data (machine_id, end_event_id)
  WHERE end_event_id IS NOT NULL;

-- machines: presence + firmware reported over status/conn, and the unit a
-- machine belongs to. unit_name already exists; this indexes the lookup that
-- resolves (company, unit, pin) -> machine id on every inbound event.
CREATE INDEX IF NOT EXISTS "{{SCHEMA}}_machines_unit_pin_idx"
  ON "{{SCHEMA}}".machines (unit_name, pin_no);

ALTER TABLE "{{SCHEMA}}".machines
  ADD COLUMN IF NOT EXISTS firmware_version VARCHAR(20),
  ADD COLUMN IF NOT EXISTS last_event_seq   BIGINT,
  ADD COLUMN IF NOT EXISTS dropped_count    INTEGER NOT NULL DEFAULT 0;
