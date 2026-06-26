-- Sprint 3 / Task 1 — Andon TV-board access tokens.
-- PUBLIC schema (global): the token resolves the tenant for the public
-- /api/v1/andon/:flowId board, so it cannot live in a per-tenant schema.
--
-- NOTE: This project uses `prisma db push` (no migrate history). This file is
-- the explicit, reviewable equivalent — `prisma db push` will create the same
-- table from the AndonToken model. id/token are app-generated (no DB default).

CREATE TABLE IF NOT EXISTS public.andon_tokens (
  id          text        PRIMARY KEY,
  flow_id     integer     NOT NULL,
  company_id  integer     NOT NULL,
  token       text        NOT NULL UNIQUE,
  label       varchar(120),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz
);

CREATE INDEX IF NOT EXISTS andon_tokens_company_id_idx ON public.andon_tokens (company_id);
CREATE INDEX IF NOT EXISTS andon_tokens_token_idx ON public.andon_tokens (token);
