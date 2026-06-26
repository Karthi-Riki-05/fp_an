-- Sprint 3 / Task 2 — warning_data acknowledge state.
-- warning_data lives in `tenant_template` AND in every cloned `tenant_<id>`
-- schema, so we ALTER all of them. `acknowledged_by` logically references
-- public.users(id) but is left FK-less (cross-schema, and to stay robust if a
-- tenant has legacy/orphan rows) — matching the Prisma model (plain Int?).

DO $$
DECLARE sch text;
BEGIN
  FOR sch IN
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name = 'tenant_template' OR schema_name LIKE 'tenant_%'
  LOOP
    EXECUTE format('ALTER TABLE %I.warning_data ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz', sch);
    EXECUTE format('ALTER TABLE %I.warning_data ADD COLUMN IF NOT EXISTS acknowledged_by integer', sch);
    EXECUTE format('CREATE INDEX IF NOT EXISTS warning_data_acknowledged_at_idx ON %I.warning_data (acknowledged_at)', sch);
  END LOOP;
END $$;
