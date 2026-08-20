-- Migration 002a: MQTT v2 device registry (PUBLIC schema — run ONCE, not per tenant)
--
-- Backs the mosquitto-go-auth Postgres backend. The broker queries this table
-- directly on every CONNECT and every publish/subscribe, so credentials and
-- ACLs live in the database instead of a hand-edited flat file.
--
-- Identity is per PHYSICAL UNIT (one Raspberry Pi), not per machine. A Pi has
-- up to 4 pins = up to 4 machines, but one MQTT connection and one credential.
-- pin_no inside the payload selects which machine an event belongs to.

CREATE TABLE IF NOT EXISTS public.mqtt_devices (
  id             SERIAL PRIMARY KEY,
  -- Broker username AND client id: fp-{companyId}-{unitName}
  username       VARCHAR(150) NOT NULL UNIQUE,
  -- mosquitto-go-auth PBKDF2 format: PBKDF2$sha512$iterations$salt$hash
  password_hash  TEXT         NOT NULL,
  company_id     INTEGER      NOT NULL,
  unit_name      VARCHAR(50)  NOT NULL,
  is_superuser   BOOLEAN      NOT NULL DEFAULT FALSE,
  disabled       BOOLEAN      NOT NULL DEFAULT FALSE,
  firmware       VARCHAR(20),
  last_seen_at   TIMESTAMPTZ,
  provisioned_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT mqtt_devices_company_unit_uniq UNIQUE (company_id, unit_name)
);

CREATE INDEX IF NOT EXISTS mqtt_devices_company_id_idx ON public.mqtt_devices (company_id);
CREATE INDEX IF NOT EXISTS mqtt_devices_enabled_idx    ON public.mqtt_devices (username) WHERE disabled = FALSE;

-- Broker service account. Password is set by scripts/provision-mqtt-backend.js;
-- this row only reserves the username so the ACL query has something to match.
INSERT INTO public.mqtt_devices (username, password_hash, company_id, unit_name, is_superuser)
VALUES ('fp-backend', 'SET-ME', 0, '_backend', TRUE)
ON CONFLICT (username) DO NOTHING;
