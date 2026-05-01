# Agent Data Warehouse

> **Plateforme ETL multi-agents IA** — Pipeline autonome qui transforme une source SQL Server / CSV en Data Warehouse Kimball complet, orchestré par LangGraph et un assistant conversationnel intégré ("Atlas").

<div align="center">

[![Python 3.11](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2-1C3C3C)](https://github.com/langchain-ai/langgraph)
[![SQL Server](https://img.shields.io/badge/SQL%20Server-2022-CC2927?logo=microsoftsqlserver&logoColor=white)](https://www.microsoft.com/sql-server)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![Tests](https://img.shields.io/badge/Tests-116%20passing-success)](./tests)
[![License](https://img.shields.io/badge/License-Proprietary-lightgrey)](./LICENSE)

</div>

---

## Sommaire

- [Aperçu](#aperçu)
- [Fonctionnalités clés](#fonctionnalités-clés)
- [Architecture](#architecture)
- [Démarrage rapide](#démarrage-rapide)
- [Configuration](#configuration)
- [Tests](#tests)
- [Déploiement](#déploiement)
- [Structure du projet](#structure-du-projet)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Licence](#licence)

---

## Aperçu

Agent Data Warehouse automatise la chaîne complète **OLTP → OLAP** :

1. **Ingestion** d'une source : `.bak` SQL Server, CSV, Excel, MySQL, PostgreSQL, REST API.
2. **Profilage** automatique des données par l'agent `Explorer`.
3. **Score qualité** par l'agent `DataQuality` (alertes bloquantes si < 50/100).
4. **Modélisation Kimball** intelligente : détection de la fact table, dimensions, hiérarchies, SCD Type 2.
5. **Critique IA** du modèle (validation Kimball best practices).
6. **Pause Human-in-the-Loop** : tu valides ou tu demandes une modification en langage naturel.
7. **Génération ETL T-SQL** + Airflow DAG + dbt project.
8. **Exécution ETL** avec auto-healing et CDC watermarks.
9. **Catalogue + Lineage colonne→colonne** automatique.
10. **Exports** Excel décisionnel (10 feuilles), CSV bundle, JSON, .bak SQL Server.

L'utilisateur dialogue avec **Atlas** — l'assistant IA hybride qui comprend les modifications complexes ("Ajoute trois clés de date pour le rôle-playing", "Prorate le freight par ligne", "Change le type de reportsto en INT") et les applique de manière atomique au modèle logique + DDL.

## Fonctionnalités clés

### Pipeline multi-agents
- **23 agents spécialisés** orchestrés par LangGraph (Explorer, Modeler, Critic, Healer, Lineage, Forecaster, etc.)
- **Workflow cyclique** avec auto-healing des erreurs ETL
- **Persistence** automatique de l'état entre redémarrages serveur
- **Streaming SSE** temps réel vers le frontend

### Atlas — Assistant IA hybride
- Détection d'intent automatique : conversation libre vs modification du pipeline
- Mode **patch operations** : produit une liste d'opérations atomiques (`add_column`, `split_date_key`, `change_column_type`, `add_fk`...) au lieu de regénérer tout le JSON, ce qui rend les modifications complexes 100x plus fiables
- Cache LLM en mémoire (LRU + TTL configurable)
- Force l'utilisation de **Blaze GLM-5** (jamais Ollama pour les opérations critiques)
- Streaming des réponses via SSE (`/api/chat/stream`)
- Widget flottant style ChatGPT/Intercom avec badge unread, pastille de status, mode plein écran

### Star Schema Kimball
- Détection automatique de la fact table (scoring FK + métriques + lignes)
- Pattern Header/Détail (Orders + OrderDetails → fact_sales)
- Aplatissement Snowflake → Star
- SCD Type 2 avec `valid_from`, `valid_to`, `is_current`, `row_hash`
- Index automatiques sur les FK
- Tables de quarantaine pour les rejets

### Reporting décisionnel (Excel)
Export `.xlsx` 10 feuilles natif avec graphiques embarqués :
- **Tableau de bord** : KPIs exécutifs, scorecard, résumé décideur
- **Mesures & KPI** : pour chaque mesure : `COUNT/SUM/AVG/MIN/MAX/STDDEV` + granularité Année/Trimestre/Mois + Top 10 par dimension + charts natifs (Bar, Line, Pie)
- **Qualité données**, **Schéma étoile**, **Performance ETL**, **Analyses OLAP**, **Catalogue**, **Lineage**, **DDL**, **Journal**

### Sécurité & observabilité
- JWT authentication (PyJWT)
- Rate limiting (slowapi)
- Security headers + CSP
- Endpoint `/metrics` Prometheus (counters, histograms, gauges)
- Logs structurés JSON optionnels (ingestion ELK/Loki)
- Cache LLM stats exposées
- Pool SQLAlchemy avec `pool_pre_ping` et tunables via env vars

### Déploiement production
- Multi-stage Dockerfiles (image backend ~600 MB, frontend ~50 MB)
- `tini` comme PID 1, gunicorn + uvicorn workers
- nginx-unprivileged + Caddy reverse-proxy avec **HTTPS auto Let's Encrypt** (HTTP/3)
- Secrets exigés via `${VAR:?}` (pas de fallback en dur)
- Read-only filesystem + tmpfs en prod
- Healthchecks + log rotation
- CI GitHub Actions : lint, tests, build Docker, scan Trivy

## Architecture

```
                       ┌─────────────────────────────┐
                       │     React + Vite (SPA)      │
                       │  • PipelineCanvas           │
                       │  • Atlas (FloatingChat)     │
                       │  • HumanReviewPanel         │
                       │  • ExportPanel              │
                       └──────────────┬──────────────┘
                                      │
                                  HTTPS / SSE
                                      │
                       ┌──────────────▼──────────────┐
                       │      Caddy (reverse-proxy)  │
                       │  Let's Encrypt + HTTP/3     │
                       └──────────────┬──────────────┘
                                      │
                       ┌──────────────▼──────────────┐
                       │   nginx (SPA + static)      │
                       └──────────────┬──────────────┘
                                      │
                       ┌──────────────▼──────────────┐
                       │  FastAPI + Gunicorn (4 w.)  │
                       │  /api/start /chat /export   │
                       │  /metrics /pipeline-stream  │
                       └──────────────┬──────────────┘
                                      │
                       ┌──────────────▼──────────────┐
                       │  LangGraph Workflow         │
                       │  Explorer → DataQuality →   │
                       │  Modeler → Critic → HITL →  │
                       │  ETL → Lineage → ...        │
                       └──┬───────────┬──────────────┘
                          │           │
                          ▼           ▼
                  ┌──────────┐  ┌──────────────┐
                  │  Blaze   │  │  SQL Server  │
                  │  GLM-5   │  │  (DW + meta) │
                  └──────────┘  └──────────────┘
```

## Démarrage rapide

### Prérequis

- **Docker** 24+ et **Docker Compose** v2 (recommandé)
- **OU** Python 3.11+, Node 20+, SQL Server 2022 (Express OK)
- Une **clé API Blaze** (https://blaze.ai) avec accès GLM-5

### En 3 commandes (Docker)

```bash
git clone https://github.com/salaheddinehalimisiad-coder/agent_data_warehouse_v2.git
cd agent_data_warehouse_v2

cp .env.example .env
# Edite .env : DB_PASSWORD, BLAZE_API_KEY, JWT_SECRET, ALLOWED_ORIGINS

docker compose --profile full up -d --build
```

L'application est disponible sur :
- **Frontend** : http://localhost:8080
- **Backend API** : http://localhost:8000
- **Docs API** : http://localhost:8000/api/docs
- **Metrics** : http://localhost:8000/metrics

### Dev local (sans Docker)

```bash
# Backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
uvicorn api.server:app --reload

# Frontend (dans un autre terminal)
npm install
npm run dev                     # http://localhost:5173
```

Voir [`GETTING_STARTED.md`](./GETTING_STARTED.md) pour le détail Windows + SQL Server Express.

## Configuration

Toutes les variables sont dans [`.env.example`](./.env.example) :

| Variable | Défaut | Description |
|---|---|---|
| `DB_PASSWORD` | (requis) | Mot de passe `sa` SQL Server |
| `BLAZE_API_KEY` | (requis) | Clé API Blaze GLM-5 |
| `JWT_SECRET` | (requis) | Secret JWT (≥ 64 caractères aléatoires) |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:8080` | CORS origins (prod : ton domaine HTTPS) |
| `BACKEND_WORKERS` | `2` (dev) / `4` (prod) | Workers gunicorn |
| `LLM_CACHE_ENABLED` | `1` | Active le cache LLM |
| `LLM_CACHE_TTL` | `3600` | TTL cache LLM (secondes) |
| `DB_POOL_SIZE` | `5` | Pool SQLAlchemy |
| `DB_POOL_MAX_OVERFLOW` | `10` | Connexions overflow |
| `LOG_FORMAT` | `text` | `text` ou `json` (ELK/Loki) |
| `METRICS_ENABLED` | `1` | Endpoint `/metrics` Prometheus |
| `DOMAIN` | `localhost` | Domaine pour Caddy/Let's Encrypt |
| `ACME_EMAIL` | — | Email pour Let's Encrypt |

## Tests

**116 tests** sur 4 niveaux : unitaires backend & frontend, intégration, système, E2E.

```bash
# Tous les tests Python (pytest)
make test
# ou
pytest tests/unit/backend tests/integration tests/system

# Tests frontend (Vitest)
npm run test:run

# Tests E2E (Playwright)
npx playwright install chromium
npm run test:e2e
```

| Suite | Framework | Tests | Description |
|---|---|---|---|
| `tests/unit/backend/` | pytest | 94 | Logic atomique : `chat_modifier`, `modeler`, `llm_factory`, `etl_service`, `export_service`, `observability` |
| `tests/unit/frontend/` | Vitest + RTL | 29 | Composants React : `pipelineStore`, `FloatingChatWidget`, `ChatInterface`, `ExportPanel` |
| `tests/integration/` | FastAPI TestClient | 13 | Endpoints REST : `/health`, `/metrics`, OpenAPI, CORS, auth, exports |
| `tests/system/` | pytest + mocks | 9 | Workflow complet : flux modification, patch ops, bug `[un] NVARCHAR` |
| `tests/e2e/` | Playwright | 13 | UI réelle : ouverture Atlas, suggestions, Esc, exports, smoke |

CI GitHub Actions exécute lint + tests + build Docker + scan Trivy à chaque push.

## Déploiement

### Production (Docker + HTTPS)

```bash
# 1. Configure DNS pour pointer ton domaine vers le serveur
# 2. .env de prod
cat > .env <<EOF
DB_PASSWORD=$(openssl rand -base64 24)
JWT_SECRET=$(openssl rand -base64 64)
BLAZE_API_KEY=sk-blaze-xxx
ALLOWED_ORIGINS=https://app.tondomaine.com
DOMAIN=app.tondomaine.com
ACME_EMAIL=admin@tondomaine.com
APP_ENV=production
EOF

# 3. Build + run
docker compose -f docker-compose.deploy.yml up -d --build

# Caddy obtient automatiquement le certificat Let's Encrypt
# L'app est dispo sur https://app.tondomaine.com
```

Voir [`DEPLOY_DOCKER.md`](./DEPLOY_DOCKER.md) pour le détail (DNS, firewall, monitoring).

### Mise à l'échelle

- `BACKEND_WORKERS=8` ou plus selon CPU
- Augmenter `DB_POOL_SIZE` proportionnellement
- Caddy tient ~10k connexions concurrentes par défaut
- Pour > 100 utilisateurs simultanés, sortir SQL Server du compose et l'héberger en managé (Azure SQL, RDS, etc.)

## Structure du projet

```
agent_data_warehouse_v2/
├── api/                        Backend FastAPI
│   ├── routes/                 Endpoints (pipeline, auth, export, ...)
│   ├── services/               etl_service (orchestration), export_service, sse
│   ├── middleware/             jwt_auth, security, observability
│   └── db/                     SQL Server metadata layer
├── nodes/                      Agents LangGraph
│   ├── chat_modifier.py        Atlas patch ops (v4.0)
│   ├── llm_factory.py          Blaze GLM-5 + cache LRU/TTL
│   ├── modeler.py              Kimball star schema generator
│   ├── etl_executor.py         ETL execution + auto-healing
│   └── ...                     critic, lineage, forecaster, etc.
├── src/                        Frontend React
│   ├── components/             FloatingChatWidget, PipelineCanvas, ...
│   ├── store/                  Zustand pipelineStore
│   └── api/                    HTTP client + SSE
├── docker/
│   ├── Dockerfile.backend      Multi-stage Python (gunicorn + tini)
│   ├── Dockerfile.frontend     Multi-stage Vite + nginx-unprivileged
│   ├── nginx.conf              SPA proxy + CSP + SSE support
│   └── caddy/Caddyfile         HTTPS Let's Encrypt
├── tests/
│   ├── unit/{backend,frontend} 123 tests unitaires
│   ├── integration/            13 tests REST
│   ├── system/                 9 tests workflow
│   └── e2e/                    13 tests Playwright
├── .github/workflows/ci.yml    Lint + tests + build + scan
├── docker-compose.yml          Stack dev (sqlserver + backend + [frontend])
├── docker-compose.deploy.yml   Stack prod (+ caddy HTTPS)
├── Makefile                    make up / prod-up / scan / test / logs
├── pytest.ini                  pytest config + coverage
├── vitest.config.js            Vitest + jsdom
├── playwright.config.js        E2E config + dev server auto
├── requirements.txt            Python deps
├── package.json                Frontend deps + scripts
├── .env.example                Template variables
└── .pre-commit-config.yaml     Hooks ruff + detect-secrets
```

## Roadmap

- [ ] Streaming SSE complet pour les réponses Atlas (déjà implémenté backend, intégration UI à finaliser)
- [ ] Support PostgreSQL natif comme cible DW (actuellement source uniquement)
- [ ] Connecteur Snowflake / BigQuery
- [ ] Mode collaboratif multi-utilisateurs avec notifications real-time
- [ ] Intégration Power BI Service (push automatique du dataset)
- [ ] Plugin VS Code pour interagir avec Atlas depuis l'IDE
- [ ] Modèle d'auto-régression pour la prédiction de la qualité

## Contributing

Les contributions sont bienvenues ! Voir [`CONTRIBUTING.md`](./CONTRIBUTING.md).

```bash
# Setup dev
pip install -r requirements.txt
pip install -r requirements-dev.txt
npm install

# Pre-commit hooks
pip install pre-commit
pre-commit install

# Run tests avant push
make test
npm run test:run
```

## Licence

Proprietary © 2026. Voir [`CHANGELOG.md`](./CHANGELOG.md) pour l'historique des versions.

---

<div align="center">

**Atlas** — *Architecte ETL & Data Warehouse* — propulsé par Blaze GLM-5

[Documentation](./GETTING_STARTED.md) · [Déploiement](./DEPLOY_DOCKER.md) · [Issues](https://github.com/salaheddinehalimisiad-coder/agent_data_warehouse_v2/issues)

</div>
