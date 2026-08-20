-- Migration 004: least-privilege Postgres role for the MQTT broker (PUBLIC — run ONCE)
--
-- The broker authenticates every device CONNECT and every publish/subscribe by
-- querying public.mqtt_devices. It must NOT do that as the application user:
-- the broker is the most exposed component in the system (it is the only one
-- the factory fleet can reach), so it gets read access to exactly one table.
--
-- The password cannot live in this file. Run it with the password passed in:
--
--   psql "$DATABASE_URL" -v mqtt_pw="'$(openssl rand -base64 24)'" \
--        -f migrations/004_mqtt_auth_role.sql
--
-- Then put the same password in .env.production as MQTT_PG_PASSWORD.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mqtt_auth') THEN
    EXECUTE format('CREATE ROLE mqtt_auth LOGIN PASSWORD %L', :mqtt_pw);
  ELSE
    EXECUTE format('ALTER ROLE mqtt_auth LOGIN PASSWORD %L', :mqtt_pw);
  END IF;
END
$$;

-- Exactly one table, read only. No INSERT/UPDATE/DELETE: a compromised broker
-- must not be able to mint itself a credential or disable another device.
GRANT USAGE  ON SCHEMA public          TO mqtt_auth;
GRANT SELECT ON public.mqtt_devices    TO mqtt_auth;

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM mqtt_auth;
GRANT  SELECT ON public.mqtt_devices TO mqtt_auth;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM mqtt_auth;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM mqtt_auth;

-- Do not let it read future tables either.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM mqtt_auth;
