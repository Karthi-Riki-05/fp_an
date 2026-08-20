-- Migration 003: OTA tracking (PUBLIC schema — run ONCE, not per tenant)
--
-- OTA is per physical unit, so progress is tracked on the device registry
-- rather than per machine. States mirror the evt/ota contract:
--   idle | downloading | verifying | applying | success | failed

ALTER TABLE public.mqtt_devices
  ADD COLUMN IF NOT EXISTS ota_state      VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ota_version    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ota_detail     TEXT,
  ADD COLUMN IF NOT EXISTS ota_cmd_id     UUID,
  ADD COLUMN IF NOT EXISTS ota_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS mqtt_devices_ota_state_idx
  ON public.mqtt_devices (ota_state) WHERE ota_state IS NOT NULL;

-- Firmware release metadata lives in public.site_settings as a single JSON row:
--   type = 'iot_firmware', var_key = 'latest'
--   var_value = {"version","url","sha256","size","notes","mandatory","releasedAt"}
-- One row keeps the release atomic — a half-updated release (new version, old
-- hash) would brick the fleet's integrity check.
INSERT INTO public.site_settings (type, var_key, var_value, status, created_at, updated_at)
VALUES ('iot_firmware', 'latest', NULL, TRUE, NOW(), NOW())
ON CONFLICT (type, var_key) DO NOTHING;
