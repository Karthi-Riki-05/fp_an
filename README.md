# FP Analyzer (v3 stack)

Migration target for the legacy Laravel 5.8 / PHP 7.2 FP Analyzer manufacturing OEE platform. This repo hosts the new stack: **Next.js 14 frontend + NestJS 10 backend + PostgreSQL 16 (schema-per-tenant)**.

> **Status: Phase 1 — empty scaffold.** No business logic yet. The migration plan lives in [`MIGRATION_NOTES.md`](./MIGRATION_NOTES.md). Operator-only unknowns blocking later phases are tracked in [`OPERATOR_QUESTIONS.md`](./OPERATOR_QUESTIONS.md). The legacy MySQL schema reference is [`legacy-schema.json`](./legacy-schema.json).

## Layout

```
new_fp/
├── MIGRATION_NOTES.md       Phase 0 contract — read this first.
├── OPERATOR_QUESTIONS.md    Concrete unknowns the operator must resolve.
├── legacy-schema.json       Frozen MySQL schema reference (Phase 6 input).
├── .env.example             All env vars, documented.
├── docker-compose.local.yml Dev compose — hot reload, MailHog, host ports.
├── docker-compose.server.yml Prod compose — built images, internal network, nginx.
├── docker/
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   └── nginx/nginx.conf
├── backend/                 NestJS 10 / Node 20 / Prisma / BullMQ.
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── common/          Guards, decorators, interceptors, filters (stubs).
│   │   └── health/          GET /api/v1/health → { status, db, redis, … }.
│   └── prisma/schema.prisma Datasource only — Phase 2 fills in models.
└── frontend/                Next.js 14 App Router / Ant Design 5 / next-intl.
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx   AntD ConfigProvider + NextIntlClientProvider.
    │   │   └── (public)/page.tsx   "FP Analyzer — coming soon".
    │   └── i18n/request.ts  next-intl bootstrap.
    └── messages/{sv,en}.json (currently empty).
```

## Local development (Phase 1 verification)

The single goal of Phase 1 is for both compose services to come up cleanly with healthchecks green. Phase 2 begins after that gate is met.

```bash
# 1. Copy the env template.
cp .env.example .env.local

# 2. Fill in (at minimum):
#    POSTGRES_PASSWORD, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, JWT_DEVICE_SECRET
#    For dev you can use anything — these get rotated for production.

# 3. Start the local compose.
docker compose -f docker-compose.local.yml up --build

# 4. Verify (in another terminal):
curl http://localhost:4000/api/v1/health    # expect { "status": "ok", checks: { db: "unknown", redis: "unknown" }, ... }
curl -I http://localhost:3000/              # expect HTTP/1.1 200 OK

# Optional: MailHog UI
open http://localhost:8025
```

The `db` and `redis` checks return `"unknown"` deliberately — Phase 2 (Prisma) and Phase 3 (BullMQ) wire the actual probes.

## Why two compose files?

- **`docker-compose.local.yml`** mounts `./backend` and `./frontend` as volumes for hot reload, exposes Postgres/Redis on host ports for IDE access, runs MailHog for SMTP testing. Loaded vars come from `.env.local`.
- **`docker-compose.server.yml`** uses pre-built images only (no source mounts, no dev server), keeps Postgres and Redis on an `internal` network with no host ports, places nginx as the only host-exposed service on 80/443. Vars come from `.env.production`, which references externally-managed secrets — never store real production values in the file itself.

Both share the same Dockerfiles (`docker/{backend,frontend}.Dockerfile`) with multi-stage builds and `dev` / `prod` targets.

## Phase 1 deliverables (this commit)

- [x] Empty NestJS skeleton with `app.module.ts`, `main.ts`, stub `common/{guards,decorators,interceptors,filters}/`, working `GET /api/v1/health`.
- [x] Empty Next.js App Router skeleton with AntD `ConfigProvider`, `next-intl` configured, placeholder homepage.
- [x] `docker-compose.local.yml` and `docker-compose.server.yml` per `MIGRATION_NOTES.md` §Phase 5 spec.
- [x] `.env.example` with all vars documented.
- [x] No Prisma models yet (Phase 2). No business controllers (Phase 3). No real pages (Phase 4).
- [x] No Tailwind — Ant Design is the design system.

## Phase 2 entry criteria

User acceptance: both compose services up cleanly with healthchecks green. After that, Phase 2 generates the full Prisma schema from `legacy-schema.json` per the model mapping in `MIGRATION_NOTES.md` §4.3 (with multiSchema preview, soft-delete strategy from §4.4, partitioning from §4.6, snapshot pattern from §11.5, timezone column from §17).

## Operator action items

See [`OPERATOR_QUESTIONS.md`](./OPERATOR_QUESTIONS.md). One of them — **Q2 (GoJS license)** — blocks Phase 4. The others can be answered in parallel with Phases 1–3.
