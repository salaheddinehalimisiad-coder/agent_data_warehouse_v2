# Guide de lancement — Antigravity BI v5.0

> Agent Data Warehouse piloté par LangGraph — du CSV à la Star Schema SQL Server 2022 en quelques minutes.

Ce guide couvre de l'installation à zéro jusqu'au premier pipeline exécuté. Il est pensé pour fonctionner sur **Windows 10/11** (cible principale) et pour **Linux / macOS** (mode avancé).

---

## Sommaire

1. [Architecture en deux mots](#1-architecture-en-deux-mots)
2. [Prérequis machine](#2-prérequis-machine)
3. [Installation rapide — la voie express](#3-installation-rapide--la-voie-express)
4. [Configuration du fichier `.env`](#4-configuration-du-fichier-env)
5. [Lancer l'application](#5-lancer-lapplication)
6. [Premier lancement — checklist visuelle](#6-premier-lancement--checklist-visuelle)
7. [Arrêter les serveurs proprement](#7-arrêter-les-serveurs-proprement)
8. [Installation manuelle pas à pas](#8-installation-manuelle-pas-à-pas)
9. [Dépannage (TDS, ports, CORS, auth)](#9-dépannage-tds-ports-cors-auth)
10. [Commandes utiles](#10-commandes-utiles)
11. [Aller plus loin](#11-aller-plus-loin)

---

## 1. Architecture en deux mots

L'application tourne en deux processus séparés qui communiquent par HTTP :

| Composant | Stack | Port par défaut | Rôle |
|---|---|---|---|
| **Backend** | FastAPI · Python 3.10+ · LangGraph | `8000` | Orchestration des agents, ETL, API REST, JWT |
| **Frontend** | React 18 · Vite · Tailwind · Framer Motion | `5173` | Interface Premium Dark v5, chat, Star Schema viewer |
| **Warehouse** | SQL Server 2022 Express | `1433` | Data warehouse physique (tables dim/fact générées) |
| **Meta DB** | même SQL Server (base `agent_dw_meta`) | `1433` | Utilisateurs, sessions, historique des runs |

Le backend **ne démarre pas** sans SQL Server accessible. Le frontend démarre toujours — si le backend est absent, tu verras un badge rouge dans le header.

---

## 2. Prérequis machine

### Sur Windows

| Logiciel | Version minimale | Pourquoi |
|---|---|---|
| Python | 3.10+ | Backend FastAPI, LangGraph |
| Node.js | 18+ | Frontend Vite |
| SQL Server 2022 Express | 2022 | Data warehouse |
| ODBC Driver 17 for SQL Server | 17 ou 18 | Connexion pyodbc |
| PowerShell | 5.1+ ou 7 | Script `start.ps1` |
| Git | any | Cloner le repo |

Vérifie que tout est installé en ouvrant **PowerShell** et en tapant :

```powershell
python --version       # attendu : Python 3.10+
node --version         # attendu : v18+
npm --version          # attendu : 9+
git --version
```

Pour le pilote ODBC, lance dans PowerShell :

```powershell
Get-OdbcDriver -Name "*SQL Server*"
```

Tu dois voir au moins `ODBC Driver 17 for SQL Server` dans la liste. Sinon, télécharge-le [ici](https://learn.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server).

### Sur Linux / macOS

Les mêmes outils que Windows (Python 3.10+, Node 18+, ODBC 17) mais via le gestionnaire de paquets de ta distribution (`apt`, `brew`). Pour SQL Server, soit tu le lances dans **Docker** (`docker run mcr.microsoft.com/mssql/server:2022-latest`), soit tu as un serveur distant. Le diagnostic TDS fourni dans `scratch/diag_tds.py` fonctionne aussi sous Linux.

### Instance SQL Server

Le projet cible par défaut une instance nommée `DESKTOP-<TON-HOST>\SQLEXPRESS`. Vérifie qu'elle tourne :

```powershell
Get-Service -Name 'MSSQL*'
```

Tu dois voir `MSSQL$SQLEXPRESS` avec le statut `Running`. Sinon :

```powershell
Start-Service 'MSSQL$SQLEXPRESS'
```

Assure-toi aussi que **SQL Server Browser** tourne (indispensable pour résoudre les instances nommées) :

```powershell
Start-Service SQLBrowser
Set-Service   SQLBrowser -StartupType Automatic
```

---

## 3. Installation rapide — la voie express

Trois étapes, environ 5 minutes sur une machine normale.

### Étape 1 : Récupérer le code

```powershell
git clone https://github.com/<ton-org>/antigravity-bi.git
cd antigravity-bi
```

### Étape 2 : Copier et éditer le `.env`

```powershell
Copy-Item .env.example .env
notepad .env
```

Édite les valeurs sensibles — voir section [Configuration du fichier `.env`](#4-configuration-du-fichier-env) pour le détail de chaque variable.

### Étape 3 : Tout lancer

```powershell
.\start.ps1
```

Le script fait tout automatiquement (venv, pip, npm, puis ouvre deux fenêtres PowerShell : une pour le backend, une pour le frontend). À la fin, ouvre ton navigateur sur :

> **http://localhost:5173**

Et c'est parti.

---

## 4. Configuration du fichier `.env`

Le fichier `.env.example` contient toutes les variables possibles. Voici celles qui sont **indispensables** à adapter :

```ini
# ── Backend ────────────────────────────────────────────
VITE_API_URL=http://localhost:8000

# ── Connexion SQL Server (Warehouse + Meta) ────────────
DW_HOST=DESKTOP-HDK3ADV\SQLEXPRESS
DW_PORT=1433
DW_DATABASE=agent_dw_meta
DW_USER=sa
DW_PASSWORD=TonMotDePasseSa!

# ── Sécurité JWT (backend) ─────────────────────────────
JWT_SECRET=CHANGE_ME_change_this_to_48_random_chars_minimum
APP_ENV=dev                 # 'prod' → refuse de booter si JWT_SECRET faible
COOKIE_SECURE=0             # 1 en production (HTTPS obligatoire)
COOKIE_SAMESITE=lax

# ── LLM (au choix) ─────────────────────────────────────
GOOGLE_API_KEY=AIza…        # Gemini (fallback gratuit)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CLOUD_MODEL=glm-5:cloud

# ── SMTP (optionnel, pour reset password) ──────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=toi@gmail.com
SMTP_PASS=mot_de_passe_application

# ── Environnement ──────────────────────────────────────
ENVIRONMENT=development
FRONTEND_URL=http://localhost:5173
```

### Générer un JWT_SECRET solide

En production, `APP_ENV=prod` fera planter le backend si le secret est trop court ou laissé par défaut. Pour en générer un correct :

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Colle le résultat dans `JWT_SECRET=…`.

### Variables sensibles à **ne jamais committer**

Le `.gitignore` exclut déjà `.env` — vérifie que tu ne l'as pas ajouté par erreur :

```powershell
git check-ignore .env     # doit afficher ".env"
```

---

## 5. Lancer l'application

### 5.1 Méthode recommandée (Windows)

```powershell
.\start.ps1
```

Que fait le script, ligne par ligne :

1. **Vérifie `.env`** — si absent, le copie depuis `.env.example` et t'arrête pour que tu l'édites.
2. **Vérifie Python** — s'arrête avec un message si Python 3.10+ n'est pas trouvé.
3. **Crée `.venv`** si ce n'est pas déjà fait (environnement virtuel isolé).
4. **Active `.venv`** et installe les dépendances Python (`pip install -r requirements.txt -q`). Durée : ~30 s la première fois, instantané ensuite.
5. **Vérifie Node.js** — s'arrête si absent.
6. **Installe les dépendances Node** (`npm install`) si `node_modules/` n'existe pas. Durée : ~40 s.
7. **Ouvre deux fenêtres PowerShell** :
   - Fenêtre 1 : `uvicorn api.server:app --reload --port 8000` (backend)
   - Fenêtre 2 : `npm run dev` (frontend)
8. **Affiche** les URLs des deux serveurs.

> **Conseil** : Après le premier lancement réussi, tu peux relancer avec `.\start.ps1` sans crainte — le script détecte `.venv/` et `node_modules/` existants et saute les étapes d'installation.

### 5.2 Si PowerShell refuse de lancer le script

Tu verras un message du type *"cannot be loaded because running scripts is disabled"*. Débloque l'exécution pour la session courante :

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\start.ps1
```

Ça ne modifie pas la policy globale de ta machine — seulement le shell courant.

### 5.3 Méthode Linux / macOS

```bash
chmod +x start.sh
./start.sh
```

Le script `start.sh` est l'équivalent de `start.ps1` mais lance les deux serveurs en **arrière-plan dans le même terminal** (avec un `trap` pour les tuer ensemble au `Ctrl+C`).

### 5.4 Méthode manuelle (deux terminaux)

Si tu préfères voir les logs séparés sans passer par le script.

**Terminal 1 — backend FastAPI :**

```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn api.server:app --reload --port 8000
```

Tu dois voir :
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

**Terminal 2 — frontend Vite :**

```powershell
npm run dev
```

Tu dois voir :
```
VITE v5.4.21  ready in 412 ms
➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

Ouvre ton navigateur sur **http://localhost:5173**.

---

## 6. Premier lancement — checklist visuelle

Quand tu ouvres `http://localhost:5173` pour la première fois avec le design v5 intégré, voici ce que tu dois voir — et si tu ne le vois pas, à quoi ça correspond.

### 6.1 Header du dashboard

| Élément | À quoi ça ressemble | Si c'est absent… |
|---|---|---|
| Logo carré violet avec halo | Carré 9×9 px en dégradé violet→indigo→cyan, avec un petit point vert qui pulse (c'est le healthcheck) | Ton fichier `src/index.css` n'est pas à jour ou Tailwind n'a pas recompilé — redémarre `npm run dev` |
| Titre "Antigravity **BI**" | Le mot "BI" en gradient violet/cyan | Même cause que ci-dessus |
| Sous-titre "v5.0 · Premium Dark" | En police JetBrains Mono, gris clair | Cache du navigateur — fais `Ctrl+F5` |
| Bouton "New Pipeline" | Gradient violet avec shine blanc qui traverse au survol | La classe `.btn-primary` n'est pas à jour — reload le CSS |

### 6.2 Arrière-plan

Tu dois voir deux orbes radiaux très discrets :
- Un violet en haut à droite
- Un cyan en bas à gauche

C'est défini par `body::before` dans `src/index.css`. Si l'arrière-plan est uniforme noir, ton navigateur n'a pas pris le nouveau CSS — fais un `Ctrl+Shift+Delete` et vide le cache.

### 6.3 Status backend

En haut, juste à côté du logo, un badge doit t'indiquer l'état du backend :

| Badge | Signification |
|---|---|
| `Running` violet pulsant | Le pipeline tourne |
| `Standby` gris | Backend OK, en attente |
| `Error` rouge | Backend joignable mais erreur — ouvre les logs |
| *Pas de badge* ou page blanche | Backend non joignable — vérifie qu'uvicorn tourne |

### 6.4 Test rapide de bout en bout

1. Clique sur **New Pipeline** (ou `Ctrl+K`)
2. Dans le modal qui s'ouvre, choisis **Fichier CSV** et upload `demo_hospital.csv` (fourni à la racine du repo)
3. Renseigne la connexion SQL Server si demandé
4. Lance

Si tout marche, tu dois voir les nodes s'allumer un par un dans le canvas pipeline, puis une confetti animation à la fin.

---

## 7. Arrêter les serveurs proprement

### Méthode start.ps1 (Windows)

Ferme les deux fenêtres PowerShell ouvertes par le script (celles qui montrent les logs de `uvicorn` et `npm run dev`). Un simple clic sur la croix rouge suffit, ou `Ctrl+C` dans chacune.

### Méthode start.sh (Linux/macOS)

`Ctrl+C` dans le terminal. Le `trap` du script tue les deux processus ensemble.

### Méthode nucléaire (si un port reste bloqué)

Sur Windows, trouve et tue les processus sur les ports 8000 et 5173 :

```powershell
Get-NetTCPConnection -LocalPort 8000 | Select-Object OwningProcess | Stop-Process -Id { $_.OwningProcess } -Force
Get-NetTCPConnection -LocalPort 5173 | Select-Object OwningProcess | Stop-Process -Id { $_.OwningProcess } -Force
```

Sur Linux :

```bash
lsof -ti:8000 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

---

## 8. Installation manuelle pas à pas

À utiliser si `start.ps1` plante ou si tu veux comprendre ce qui se passe.

### 8.1 Cloner et entrer dans le projet

```powershell
git clone https://github.com/<ton-org>/antigravity-bi.git
cd antigravity-bi
```

### 8.2 Créer et activer le virtualenv Python

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Ton prompt PowerShell doit maintenant être préfixé par `(.venv)`.

### 8.3 Installer les dépendances Python

```powershell
pip install --upgrade pip
pip install -r requirements.txt
```

Si `pyodbc` plante à la compilation sur Windows, installe préalablement les **Microsoft C++ Build Tools** ([lien](https://visualstudio.microsoft.com/visual-cpp-build-tools/)) en cochant "Desktop development with C++".

### 8.4 Installer les dépendances Node

```powershell
npm install
```

Si `npm install` est lent ou échoue, passe par `npm ci` qui est plus strict avec le `package-lock.json`.

### 8.5 Copier `.env.example` en `.env` et l'éditer

```powershell
Copy-Item .env.example .env
notepad .env       # ou code .env, ou vim .env
```

Renseigne au minimum :
- `DW_HOST`, `DW_USER`, `DW_PASSWORD`, `DW_DATABASE`
- `JWT_SECRET` (48 caractères aléatoires — commande fournie plus haut)

### 8.6 Vérifier que SQL Server répond

Lance le diagnostic TDS fourni dans le repo :

```powershell
python scratch\diag_tds.py
```

Tu dois obtenir quelque chose comme :

```
▶ Volet A — pyodbc direct
  ✅ A1 pyodbc direct — instance SEULE (SQL Browser requis)
  ✅ A3 pyodbc direct — 127.0.0.1,port
  …
▶ Volet B — SQLAlchemy v4.2 (creator=pyodbc)
  ✅ B1 SQLAlchemy creator= OK
▶ Volet C — AUTOCOMMIT DDL
  ✅ AUTOCOMMIT OK — rows insérées : 3

✅ Diagnostic complet — la v4.2 devrait tourner.
```

Si un volet échoue, le script te dit exactement quelle cause activer et comment la corriger.

### 8.7 Démarrer le backend

```powershell
python -m uvicorn api.server:app --reload --port 8000
```

Laisse ce terminal ouvert.

### 8.8 Démarrer le frontend

Dans un **nouveau terminal** (ne ferme pas celui du backend) :

```powershell
npm run dev
```

Ouvre `http://localhost:5173` dans ton navigateur.

---

## 9. Dépannage (TDS, ports, CORS, auth)

### 9.1 Erreur `TDS protocol error (0)` au démarrage

Symptôme dans les logs du backend :
```
pyodbc.Error: ('HY000', '[HY000] Erreur de protocole dans le flux TDS (0)')
```

C'est le bug qu'on a corrigé en v4.2. Si tu le revois, lance :

```powershell
python scratch\diag_tds.py
```

Le volet qui échoue te dit quelle cause cocher :
- **A2 échoue, A1 réussit** → instance nommée en conflit avec le port. La v4.2 normalise automatiquement (retire le port si l'hôte contient un `\`). Vérifie `nodes/etl_executor.py`, fonction `_normalize_sqlserver_target`.
- **B échoue** → SQLAlchemy parse l'URL. La v4.2 bypass via `creator=pyodbc.connect`. Vérifie que `_build_engine` utilise bien le pattern creator.
- **C échoue** → transaction DDL. La v4.2 force `AUTOCOMMIT`. Vérifie `_execute_ddl`.

### 9.2 `JWT_SECRET too short` au boot du backend

En mode `prod`, le backend refuse de démarrer avec un secret par défaut ou < 32 caractères. Régénère :

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Copie la sortie dans `JWT_SECRET=…` dans ton `.env`. Ou repasse en `APP_ENV=dev` si c'est pour du local.

### 9.3 Port 8000 ou 5173 déjà occupé

Windows :
```powershell
Get-NetTCPConnection -LocalPort 8000
```

Si une ligne apparaît, le port est pris. Tue le processus (voir [section 7](#7-arrêter-les-serveurs-proprement)) ou change le port :

```powershell
python -m uvicorn api.server:app --reload --port 8001
# et côté .env :
# VITE_API_URL=http://localhost:8001
```

### 9.4 Le frontend charge mais pas d'appels API (erreurs CORS)

Ouvre la console du navigateur (`F12`). Si tu vois :
```
Access to fetch at 'http://localhost:8000/api/…' from origin 'http://localhost:5173' has been blocked by CORS policy
```

Vérifie que `FRONTEND_URL=http://localhost:5173` est bien dans ton `.env` (le backend lit cette variable pour autoriser l'origine).

### 9.5 Écran blanc au chargement

1. Ouvre les **DevTools** (`F12`) → onglet **Console**.
2. Erreur `Failed to load module script` ou `Cannot find module '…jsx'` : le `npm install` est incomplet. Relance.
3. Erreur `localStorage is not defined` ou similaire : tu es probablement en mode private — passe en navigation normale.
4. Aucune erreur mais écran noir : probable cache. `Ctrl+Shift+R` pour recharger en forçant.

### 9.6 `ODBC Driver 17` manquant

Symptôme :
```
pyodbc.InterfaceError: ('IM002', '[IM002] ... Data source name not found...')
```

Télécharge et installe [ODBC Driver 17 for SQL Server](https://learn.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server). Redémarre ton terminal après installation.

### 9.7 SQL Server Browser n'est pas démarré

Symptôme : A1 échoue, A3 réussit (dans `diag_tds.py`). Le résolveur d'instances nommées ne répond pas.

```powershell
Start-Service SQLBrowser
Set-Service   SQLBrowser -StartupType Automatic
```

Ou, contournement simple : utilise `127.0.0.1,1433` au lieu de `DESKTOP-…\SQLEXPRESS` dans ton `.env`.

### 9.8 `bcrypt` plante à l'install sur Windows

```powershell
pip install bcrypt --only-binary :all:
```

Le flag force pip à prendre un wheel pré-compilé au lieu d'essayer de builder depuis les sources.

### 9.9 Le pipeline reste bloqué à `starting`

Ouvre les logs backend dans son terminal. Trois cas fréquents :
- **Connexion DW KO** → relance `diag_tds.py`, applique le fix.
- **LLM inaccessible** → vérifie `GOOGLE_API_KEY` ou qu'Ollama tourne (`ollama list` doit répondre).
- **Session locked** → redémarre le backend.

---

## 10. Commandes utiles

### Backend

| Commande | Effet |
|---|---|
| `python -m uvicorn api.server:app --reload --port 8000` | Démarrer le backend en mode dev avec hot-reload |
| `python -m uvicorn api.server:app --port 8000 --workers 4` | Démarrer en mode production (4 workers, pas de reload) |
| `pytest` | Lancer la suite de tests |
| `pytest --cov=api --cov=nodes` | Tests + couverture |
| `python scratch/diag_tds.py` | Diagnostic de la connexion SQL Server |

### Frontend

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur Vite dev avec HMR |
| `npm run build` | Build de production dans `dist/` |
| `npm run preview` | Sert le build de `dist/` (pour tester) |
| `npm run lint` | Linter ESLint |
| `npm run format` | Formatter Prettier |

### Git & maintenance

| Commande | Effet |
|---|---|
| `git status` | Voir ce qui est modifié |
| `git pull` | Mettre à jour depuis le repo |
| `git clean -xfd -n` | Voir ce qui serait nettoyé (dry-run, prudent) |
| `Remove-Item .venv -Recurse -Force` | Détruire le venv Python (pour repartir propre) |
| `Remove-Item node_modules -Recurse -Force` | Détruire les deps Node |

---

## 11. Aller plus loin

### Lancer en production

Le mode prod impose plusieurs choses :
- `APP_ENV=prod` → `JWT_SECRET` obligatoirement fort
- `COOKIE_SECURE=1` → HTTPS uniquement
- Uvicorn sans `--reload`, avec plusieurs workers
- Un reverse proxy (nginx, Caddy) devant pour le TLS

Exemple `nginx.conf` minimal :

```nginx
server {
    listen 443 ssl http2;
    server_name antigravity.example.com;

    ssl_certificate     /etc/letsencrypt/live/.../fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/.../privkey.pem;

    # Frontend Vite buildé
    location / {
        root /var/www/antigravity/dist;
        try_files $uri /index.html;
    }

    # Backend FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Dockeriser

Le dossier `docker/` contient un `docker-compose.yml` prêt :

```powershell
docker-compose up -d
```

Trois services démarrent : `api` (backend), `web` (frontend servi par nginx), `db` (SQL Server 2022 Express dans un container). Parfait pour une démo sans installer Python/Node sur la machine hôte.

### Générer le DDL SCD Type 2

Depuis le dashboard :
1. Source → fichier CSV ou connexion SQL
2. Clique sur l'onglet **OLAP Schema**
3. Clique sur **Export DDL**

Tu obtiens un fichier `.sql` prêt à exécuter contenant les `CREATE TABLE`, les index filtrés `WHERE is_current = 1`, et les MERGE SCD2 avec `HASHBYTES('SHA2_256', ...)`.

### Ressources

- **Documentation projet** : `README.md` et `INSTRUCTIONS_DEPLOY.md` à la racine
- **Changelog** : `CHANGELOG.md`
- **Maquette UI** : `outputs/antigravity_ui_v5_mockup.html` (ouvre-la dans un navigateur pour voir le design system)
- **Roadmap** : `roadmap_generique_phase3.docx`

---

## Support

Un problème qui n'est pas couvert ici ? Ouvre une issue GitHub avec :
1. Ton OS + version
2. La sortie de `python --version` et `node --version`
3. Les logs du terminal qui plante
4. La sortie de `python scratch/diag_tds.py` si c'est lié à SQL Server

Bonne exploration.
