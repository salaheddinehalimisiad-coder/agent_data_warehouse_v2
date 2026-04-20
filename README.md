# 🌌 Antigravity BI — Autonomous Agentic Data Warehouse

<div align="center">
  <img src="https://img.shields.io/badge/Version-v5.0%20Premium%20Dark-8b5cf6.svg?style=for-the-badge" alt="Version"/>
  <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/React%2018-20232a?style=for-the-badge&logo=react" alt="React 18"/>
  <img src="https://img.shields.io/badge/SQL_Server_2022-CC2927?style=for-the-badge&logo=microsoft-sql-server&logoColor=white" alt="SQL Server"/>
  <img src="https://img.shields.io/badge/LangGraph-000000?style=for-the-badge" alt="LangGraph"/>
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"/>
</div>

<br/>

Antigravity BI (Agent Architect) est un système ETL de bout en bout propulsé par
des **agents IA multi-modèles** orchestrés en **LangGraph cyclique**. Conçu pour
révolutionner la modélisation de données (Kimball Star Schema / Constellation),
il automatise la création de Data Warehouses d'entreprise, de l'ingestion d'un
`.bak` SQL Server jusqu'à la validation croisée par l'IA et au dashboard final.

---

## 🚀 Démarrage rapide

Trois options suivant le contexte :

| Cible                    | Guide                                                             | Temps  |
| ------------------------ | ----------------------------------------------------------------- | ------ |
| 🐳 **Déploiement Docker** (prof, démo, prod) | **[DEPLOY_DOCKER.md](./DEPLOY_DOCKER.md)**           | ~15 min |
| 💻 **Dev local** (Windows + SQL Server Express) | **[GETTING_STARTED.md](./GETTING_STARTED.md)**    | ~10 min |
| ⚡ **TL;DR Docker**      | `docker compose -f docker-compose.deploy.yml --env-file .env up -d --build` | 1 min |

Après démarrage : **http://localhost:8080** (UI) · **http://localhost:8000/api/docs** (Swagger).

---

## 📸 Architectural Canvas (Constellation Schema)

Une interface ergonomique **Premium Dark v5.0** (glassmorphism + gradients
violet→cyan) permet une interaction riche avec les schémas modélisés par l'IA
(Click-to-Zoom, Auto-Layout dynamique, hiérarchies sémantiques en orange).

> 💡 Maquette interactive : `outputs/antigravity_ui_v5_mockup.html`

---

## ✨ Fonctionnalités clés

*   **Intelligence Artificielle Orchestrée (LangGraph)** — Plus de 10 agents IA
    spécialisés dialoguent pour profiler, auditer, modéliser, transformer et
    valider vos données de manière itérative.
*   **Auto-Healing Engine (le "*Healer*")** — Moteur de cicatrisation automatique
    qui intercepte les crashs (erreurs T-SQL, DDL malformés, URL SQLAlchemy
    erronés) et y injecte instantanément un correctif généré par IA.
*   **Modélisation Étoile dynamique** — Téléchargez un `.bak` ou un `.csv`, et le
    modeler génère ses tables de Fait (`FACT_*`) et ses Dimensions (`DIM_*`)
    avec Surrogate Keys, **SCD Type 2** (HASHBYTES SHA2_256 + DATETIME2(3) +
    index unique filtré), et détection sémantique des **hiérarchies**
    (Geography, Product, Organization, Customer, Time, self-FK).
*   **Smart Canvas & Lightbox (React Flow)** — Canevas plein écran avec zoom,
    mini-map, orbites de satellites, liens FK animés.
*   **Sécurité Enterprise** — JWT PyJWT (≥ 32 chars imposés en prod) + CSRF
    double-submit + bcrypt + rate-limiting (slowapi) + CORS configurable.
*   **Infrastructure SQL Server 2022** — Pilote `pyodbc` + ODBC Driver 18,
    TDS handshake durci, restauration de `.bak` volumes partagés.

---

## 🧠 Flotte d'agents (Neural Pipeline)

Le système se divise en nœuds cognitifs stricts :

1.  **🔍 Explorer** — Renifle le schéma, échantillonne la donnée de manière
    asynchrone et relève les contraintes (types, PK, FK).
2.  **🕵️ Data Quality** — Audite en profondeur la sanité de la data (NULL,
    NaN, outliers, cardinalité) et émet des règles (Warning / Critical).
3.  **📐 Modeler** — Cerveau central transformant le chaos 3NF ou plat en
    modèle Kimball optimisé (dimensions SCD, faits additifs, hiérarchies).
4.  **🧑‍⚖️ Critic & ChatModifier** — Human-in-the-Loop : l'IA soumet son
    design ; si défaillant, elle discute avec vous pour modifier les
    Surrogate Keys ou aplanir (Flatten) certaines dimensions à la volée.
5.  **🔧 ETL Generator & Executor** — Construit nativement les codes Python /
    SQLAlchemy (`INSERT`, `MERGE`, gestion des quarantaines) pour envoyer la
    donnée physique dans SQL Server.

---

## 🛠️ Stack technologique

**Backend**
*   **FastAPI** (uvicorn ASGI) & **Python 3.10+**
*   **LangChain / LangGraph** (graphe de dialogue AI cyclique)
*   **SQLAlchemy 2.0** & **PyODBC** (ORM + interface ODBC MSSQL)
*   **Pandas / NumPy** (ETL memory-mapped)
*   **APScheduler** (orchestration de pipelines planifiés)

**Frontend**
*   **React 18 + Vite 5 + Tailwind 3.4** (Premium Dark v5.0 : glassmorphism,
    gradients violet/cyan/nebula, 7 animations cinématiques)
*   **React Flow / @xyflow/react** (DAG visuel des tables SQL)
*   **Framer Motion 11** (micro-animations)
*   **Zustand** (state management)
*   **Lucide React** (icônes)

**Infrastructure**
*   **Microsoft SQL Server 2022** (conteneur Docker ou installation locale)
*   **Nginx** (serveur du frontend + proxy `/api` + SSE)
*   **OpenAI / Gemini / Ollama** (flexibilité des LLMs)

---

## 🐳 Déploiement Docker (recommandé)

Trois conteneurs, une seule commande :

```bash
# 1. Cloner
git clone https://github.com/salaheddinehalimisiad-coder/agent_data_warehouse_v2.git
cd agent_data_warehouse_v2

# 2. Créer .env (depuis .env.deploy fourni par l'auteur, ou à partir de .env.example)
cp .env.deploy .env     # ou cp .env.example .env puis éditer

# 3. Démarrer
docker compose -f docker-compose.deploy.yml --env-file .env up -d --build

# 4. Vérifier
docker compose -f docker-compose.deploy.yml ps
#   agent_dw_sqlserver   Up (healthy)   0.0.0.0:1433->1433/tcp
#   agent_dw_backend     Up (healthy)   0.0.0.0:8000->8000/tcp
#   agent_dw_frontend    Up (healthy)   0.0.0.0:8080->80/tcp
```

→ UI : **http://localhost:8080** · API : **http://localhost:8000/api/docs**

Le guide complet (prérequis, dépannage, restauration `.bak`, export d'images
offline) est dans **[DEPLOY_DOCKER.md](./DEPLOY_DOCKER.md)**.

---

## 💻 Installation locale (dev)

### 1. Pré-requis
*   **Python 3.10+** et **Node.js v18+**
*   **SQL Server 2022 Express** avec **ODBC Driver 17 for SQL Server** installé
*   **PowerShell** (Windows) ou **Bash** (macOS/Linux)

### 2. Backend

```bash
git clone https://github.com/salaheddinehalimisiad-coder/agent_data_warehouse_v2.git
cd agent_data_warehouse_v2
python -m venv .venv
# Windows
.\.venv\Scripts\Activate.ps1
# macOS/Linux
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Configuration `.env`

Copier `.env.example` en `.env` et remplir au minimum :

```env
DB_HOST=127.0.0.1
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=VotreSuperMotDePasse!
DB_NAME=agent_dw_meta

# Généré avec : python -c "import secrets; print(secrets.token_urlsafe(48))"
JWT_SECRET=<au moins 32 caractères aléatoires>
```

### 4. Démarrer les serveurs

Option A — **script tout-en-un** (Windows PowerShell) :

```powershell
.\start.ps1
```

Option B — **deux terminaux** :

```bash
# Terminal 1 : backend
uvicorn api.server:app --reload --port 8000

# Terminal 2 : frontend
npm install
npm run dev
```

→ UI dev : **http://localhost:5173**

Guide détaillé : **[GETTING_STARTED.md](./GETTING_STARTED.md)**.

---

## 🎯 Cycle d'utilisation

1.  Ouvre **http://localhost:8080** (Docker) ou **http://localhost:5173** (dev).
    Crée un compte puis clique sur **New Pipeline**.
2.  Sélectionne la source — SQL Server (live connection) ou import `.bak` /
    `.csv` — et glisse ton fichier (ex. *Northwind.bak*).
3.  Laisse le pipeline s'allumer : chaque agent prend la parole, effectue
    son audit et résout les blocages via le rôle *Healer*.
4.  À l'étape **Human Review**, agrandis (*Fullscreen*) la modélisation en
    étoile. Tu peux cliquer sur les en-têtes et discuter avec le chatbot
    pour exiger une fusion de tables ou modifier une dimension.
5.  Valide le schéma. L'**ETL Executor** peuple les tables et un dashboard
    annonce la disponibilité du Data Warehouse pour PowerBI / Tableau.

---

## 📁 Structure du projet

```
antigravity-bi/
├── api/                    # FastAPI (auth, routes, middlewares)
│   ├── routes/             # auth, backup, pipeline, scheduler, sessions
│   ├── middleware/         # jwt_auth, security (CSRF, rate limit)
│   └── services/           # etl_service, mcp_server
├── nodes/                  # Agents LangGraph (explorer, modeler, executor, healer…)
├── src/                    # Frontend React 18 + Vite
│   ├── components/         # DashboardBuilder, PipelineCanvas, ChatInterface…
│   ├── store/              # Zustand (pipelineStore)
│   └── api/                # client.js
├── docker/                 # Dockerfile.backend, Dockerfile.frontend, nginx.conf
├── docker-compose.yml          # Compose dev (hot-reload)
├── docker-compose.deploy.yml   # Compose prod (3 services healthy)
├── .env.example            # Template des variables d'environnement
├── DEPLOY_DOCKER.md        # Guide de déploiement Docker détaillé
├── GETTING_STARTED.md      # Guide de lancement dev pas à pas
└── README.md               # (vous êtes ici)
```

---

## 🧪 Tests

```bash
# Backend
pytest                         # tests unitaires + intégration
pytest --cov=api --cov=nodes   # avec coverage

# Frontend
npm run lint
npm run build                  # valide la compilation Tailwind + Vite
```

---

## 📚 Documentation

| Document                   | Description                                            |
| -------------------------- | ------------------------------------------------------ |
| [DEPLOY_DOCKER.md](./DEPLOY_DOCKER.md) | Déploiement Docker pas-à-pas + dépannage   |
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Lancement dev local (Windows / Mac / Linux) |
| [INSTRUCTIONS_DEPLOY.md](./INSTRUCTIONS_DEPLOY.md) | Migration Mission 1 (legacy) |
| [CHANGELOG.md](./CHANGELOG.md) | Historique des versions                       |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Guide de contribution                       |

---

## 🔐 Sécurité

- **Ne jamais commiter** un vrai `.env` — `.gitignore` exclut `.env`,
  `.env.deploy`, `.env.local`.
- `JWT_SECRET` ≥ 32 caractères obligatoire en production (le backend refuse
  de démarrer sinon).
- Le mot de passe `sa` SQL Server doit respecter la politique Microsoft
  (majuscule + chiffre + symbole + ≥ 8 chars).
- CORS restreint via `ALLOWED_ORIGINS` (séparées par virgules).
- Rate limiting activé sur `/api/auth/login` (slowapi).

---

<p align="center">
Développé dans le cadre d'un pipeline MLOps de R&D avancée — <strong>Antigravity BI v5.0</strong>.
</p>
