# FP Analyzer — dev & prod helpers
# Usage: make up | make down | make logs | make ps | make prod-up | make prod-down

DEV_ENV  := .env.local
DEV_FILE := docker-compose.local.yml

PROD_ENV  := .env.production
PROD_FILE := docker-compose.server.yml

.PHONY: up up-build down build logs ps shell-backend shell-frontend \
        prod-up prod-up-build prod-down prod-build prod-logs prod-ps

# ---------------------------------------------------------------------------
# Dev
# ---------------------------------------------------------------------------

up:
	docker compose --env-file $(DEV_ENV) -f $(DEV_FILE) up -d

up-build:
	docker compose --env-file $(DEV_ENV) -f $(DEV_FILE) up -d --build

build:
	docker compose --env-file $(DEV_ENV) -f $(DEV_FILE) build

down:
	docker compose --env-file $(DEV_ENV) -f $(DEV_FILE) down

logs:
	docker compose --env-file $(DEV_ENV) -f $(DEV_FILE) logs -f

ps:
	docker compose --env-file $(DEV_ENV) -f $(DEV_FILE) ps

shell-backend:
	docker compose --env-file $(DEV_ENV) -f $(DEV_FILE) exec backend sh

shell-frontend:
	docker compose --env-file $(DEV_ENV) -f $(DEV_FILE) exec frontend sh

# ---------------------------------------------------------------------------
# Prod
# ---------------------------------------------------------------------------

prod-up:
	docker compose --env-file $(PROD_ENV) -f $(PROD_FILE) up -d

prod-up-build:
	docker compose --env-file $(PROD_ENV) -f $(PROD_FILE) up -d --build

prod-build:
	docker compose --env-file $(PROD_ENV) -f $(PROD_FILE) build

prod-down:
	docker compose --env-file $(PROD_ENV) -f $(PROD_FILE) down

prod-logs:
	docker compose --env-file $(PROD_ENV) -f $(PROD_FILE) logs -f

prod-ps:
	docker compose --env-file $(PROD_ENV) -f $(PROD_FILE) ps
