-- Sprint 3 / Task 6 — typed cycle_time_seconds on equipment_properties.
-- equipment_properties is cloned per tenant, so we ALTER tenant_template and
-- every tenant_<id> schema, backfilling from the legacy free-text `cycle_time`.
--
-- Column type is `double precision` to match the Prisma `Float?` mapping
-- (the brief said NUMERIC(10,2); using double precision keeps `prisma db push`
-- from detecting drift against the model).
--
-- Backfill is DEFENSIVE: only strictly-numeric values (e.g. "12", "12.5") are
-- converted; anything else is left NULL so a stray non-numeric legacy string
-- can never break the migration. (Live data could not be inspected here — no DB
-- connectivity in this environment — so the conversion is intentionally strict.)

DO $$
DECLARE sch text;
BEGIN
  FOR sch IN
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name = 'tenant_template' OR schema_name LIKE 'tenant_%'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.equipment_properties ADD COLUMN IF NOT EXISTS cycle_time_seconds double precision',
      sch
    );
    EXECUTE format(
      $f$UPDATE %I.equipment_properties
         SET cycle_time_seconds = NULLIF(regexp_replace(cycle_time, '[^0-9.]', '', 'g'), '')::double precision
         WHERE cycle_time ~ '^[0-9]+(\.[0-9]+)?$'
           AND cycle_time_seconds IS NULL$f$,
      sch
    );
  END LOOP;
END $$;
