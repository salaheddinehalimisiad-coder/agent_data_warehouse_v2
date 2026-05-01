# Makefile - raccourcis Docker et dev pour Agent DW
# Usage : make help

.PHONY: help build up down logs ps restart clean dev prod test lint shell-backend shell-db

DC_DEV  ?= docker compose
DC_PROD ?= docker compose -f docker-compose.deploy.yml

help: ## Liste des commandes disponibles
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Dev ─────────────────────────────────────────────────────
build: ## Build les images dev
	$(DC_DEV) build

up: ## Demarre la stack dev (sqlserver + backend)
	$(DC_DEV) up -d

up-full: ## Demarre la stack dev complete (+ frontend)
	$(DC_DEV) --profile full up -d

down: ## Arrete la stack
	$(DC_DEV) down

logs: ## Affiche les logs (suivre)
	$(DC_DEV) logs -f --tail=200

logs-backend: ## Logs backend uniquement
	$(DC_DEV) logs -f backend

ps: ## Liste les containers
	$(DC_DEV) ps

restart: ## Restart backend
	$(DC_DEV) restart backend

shell-backend: ## Shell dans le container backend
	$(DC_DEV) exec backend bash

shell-db: ## sqlcmd dans le container SQL Server
	$(DC_DEV) exec sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$$DB_PASSWORD" -No -C

clean: ## Stop + supprime volumes (DESTRUCTIF)
	$(DC_DEV) down -v

# ─── Prod ────────────────────────────────────────────────────
prod-build: ## Build les images prod
	$(DC_PROD) build --no-cache

prod-up: ## Demarre la stack prod
	$(DC_PROD) up -d

prod-down: ## Arrete la stack prod
	$(DC_PROD) down

prod-logs: ## Logs prod
	$(DC_PROD) logs -f --tail=200

# ─── Quality ─────────────────────────────────────────────────
test: ## Lance les tests pytest
	$(DC_DEV) exec backend pytest -v

lint-backend: ## Lint Python
	cd . && python -m ruff check api nodes utils

lint-frontend: ## Lint frontend
	npm run lint

# ─── Image scanning ──────────────────────────────────────────
scan: ## Scan vulnerabilites avec Trivy (necessite trivy installe)
	trivy image agent_dw_backend:dev
	trivy image agent_dw_frontend:dev
