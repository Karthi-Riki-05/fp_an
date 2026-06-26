-- Sprint 4 / Task 2 — per-company configuration.
-- PUBLIC schema (company-level config keyed by the Company-role user id).
-- Settings are a single JSONB blob so the shape can evolve without migrations.

CREATE TABLE IF NOT EXISTS public.company_settings (
  company_id integer PRIMARY KEY,
  data       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
