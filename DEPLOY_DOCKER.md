# 🐳 Antigravity BI — Guide de déploiement Docker

**Public cible :** le PC du professeur (Windows 10/11, macOS ou Linux).
**Temps estimé :** 15 à 25 minutes la première fois (build des images),
5 minutes les fois suivantes.

À la fin de ce guide, le prof aura **une seule commande** à taper :

```powershell
docker compose -f docker-compose.deploy.yml up -d --build
```

…et trois conteneurs tournent :

| Conteneur              | Port hôte | Description                     |
| ---------------------- | --------- | ------------------------------- |
| `agent_dw_sqlserver`   | `1433`    | SQL Server 2022 Developer       |
| `agent_dw_backend`     | `8000`    | API FastAPI + LangGraph         |
| `agent_dw_frontend`    | `8080`    | UI React (servie par Nginx)     |

> 🌐 L'application s'ouvre dans le navigateur sur **http://localhost:8080**

---

## 📋 Sommaire

1. [Audit du setup existant](#1-audit-du-setup-existant)
2. [Prérequis sur le PC cible](#2-prérequis-sur-le-pc-cible)
3. [Transfert du projet](#3-transfert-du-projet)
4. [Configuration .env](#4-configuration-env)
5. [Lancer le déploiement](#5-lancer-le-déploiement)
6. [Vérifier que tout tourne](#6-vérifier-que-tout-tourne)
7. [Premier login](#7-premier-login)
8. [Restaurer une base .bak](#8-restaurer-une-base-bak)
9. [Arrêter / redémarrer](#9-arrêter--redémarrer)
10. [Dépannage](#10-dépannage)
11. [Commandes utiles](#11-commandes-utiles)

---

## 1. Audit du setup existant

J'ai relu les fichiers Docker déjà dans le projet. Voici le diagnostic :

| Fichier                       | État          | Commentaire                                                               |
| ----------------------------- | ------------- | ------------------------------------------------------------------------- |
| `docker/Dockerfile.backend`   | ✅ **OK**     | Python 3.11-slim + `msodbcsql18` + `unixodbc-dev` + user non-root.        |
| `docker/Dockerfile.frontend`  | ✅ **OK**     | Build Node 20 → static → Nginx alpine. Healthcheck présent.               |
| `docker/nginx.conf`           | ✅ **OK**     | Proxy `/api/*`, SSE (`/api/pipeline-stream`), upload 2 GB, headers sécu.  |
| `docker-compose.yml` (ancien) | ⚠️ **À corriger** | Service `frontend` commenté, port SQL mappé en `14330`, bind-mount hot-reload `.:/app` (= mode dev). Pas production-ready. |
| `.env` actuel                 | ⚠️ **Incomplet**  | Il manque `JWT_SECRET` → le backend refuse de booter en mode production.  |

### Ce que j'ai ajouté pour rendre le déploiement propre

- **`docker-compose.deploy.yml`** — version prod qui :
  - active le service `frontend` (manquant dans l'ancien compose),
  - publie SQL Server sur le port standard `1433` (pas `14330`),
  - retire le bind-mount `.:/app` (image self-contained),
  - injecte `ALLOWED_ORIGINS`, `JWT_SECRET`, `APP_ENV=production`,
  - ajoute `extra_hosts` pour que le backend puisse joindre Ollama sur le PC hôte.
- **`.env.deploy`** — fichier `.env` prêt à copier avec **toutes les clés**
  (JWT, DB, Gemini, SMTP, Ollama, Composio).

> 📌 **Conclusion** : le Dockerfile backend et le Dockerfile frontend sont
> corrects tels quels. Le compose d'origine est un compose de **dev**, pas de
> **déploiement**. Utilise `docker-compose.deploy.yml` sur le PC du prof.

---

## 2. Prérequis sur le PC cible

### 2.1 Docker Desktop

**Windows / macOS :** installer [Docker Desktop](https://www.docker.com/products/docker-desktop/).
**Linux :** installer `docker-ce` + `docker-compose-plugin`.

Vérification :

```powershell
docker --version
docker compose version
```

→ attendu :

```
Docker version 24.x ou plus
Docker Compose version v2.20+ ou plus
```

### 2.2 Ressources mini recommandées

- **RAM** : 6 Go libres (SQL Server 2022 = 2 Go + backend = 2 Go + système)
- **Disque** : 10 Go libres (images Docker + volumes de données)
- **CPU** : 2 cœurs

Sur Windows : **Docker Desktop → Settings → Resources → Memory ≥ 6 GB**.

### 2.3 Ports à laisser libres

`1433`, `8000`, `8080` ne doivent pas être pris par un autre logiciel
(vérif : `netstat -ano | findstr :1433`).

> Si SQL Server local tourne déjà sur `1433`, change la ligne `ports` de
> `docker-compose.deploy.yml` en `"14330:1433"` et le prof se connectera
> à `localhost,14330` depuis SSMS.

---

## 3. Transfert du projet

Trois options, la n°1 est la plus propre.

### Option A — Git (recommandée)

```powershell
git clone https://github.com/<ton-compte>/antigravity-bi.git
cd antigravity-bi
```

### Option B — Zip

Zippe le dossier `agent_dw_v3_fixed` **sans** les dossiers suivants
(pour ne pas envoyer 2 Go) :

- `.venv\`
- `node_modules\`
- `dist\`
- `__pycache__\`
- `.pytest_cache\`
- `.git\` (si tu préfères)

Transfère le zip (clé USB, Drive, WeTransfer), et dézippe-le sur le PC du prof.

### Option C — Image Docker pré-buildée

Si le PC cible n'a pas Internet fiable, tu peux builder les images sur ta
machine puis les exporter :

```powershell
# Sur ton PC
docker compose -f docker-compose.deploy.yml build
docker save antigravity-bi-backend:latest antigravity-bi-frontend:latest -o antigravity-images.tar

# Sur le PC du prof
docker load -i antigravity-images.tar
docker compose -f docker-compose.deploy.yml up -d   # sans --build
```

---

## 4. Configuration .env

Sur le PC du prof, à la racine du projet :

```powershell
# PowerShell
copy .env.deploy .env

# Bash (macOS/Linux)
cp .env.deploy .env
```

Ouvre `.env` et **vérifie** ces 3 clés sensibles :

| Variable      | Action                                                                |
| ------------- | --------------------------------------------------------------------- |
| `DB_PASSWORD` | Mot de passe `sa` SQL Server. SQL Server refuse si < 8 caractères, sans majuscule/chiffre/symbole. La valeur par défaut `Antigravity2026!` respecte la politique. |
| `JWT_SECRET`  | Doit faire ≥ 32 caractères. La valeur fournie (64 chars base64url) est OK. Tu peux en générer une nouvelle avec :<br>`python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `SMTP_PASS`   | Mot de passe d'app Gmail (16 caractères, pas ton mot de passe perso). |

> ⚠️ **Sécurité** — `.env.deploy` contient **mes vraies clés** pour que ça
> marche chez le prof. Si tu partages le dépôt plus largement, **régénère**
> au moins `JWT_SECRET` et `DB_PASSWORD`.

---

## 5. Lancer le déploiement

Une seule commande depuis la racine du projet :

```powershell
docker compose -f docker-compose.deploy.yml --env-file .env up -d --build
```

Ce qui se passe :

1. **Build du backend** (~3-5 min la 1ʳᵉ fois) : Python 3.11 + ODBC 18 + deps.
2. **Build du frontend** (~2 min) : `npm ci` + `vite build` + copie vers Nginx.
3. **Pull de SQL Server 2022** (~1.4 Go la 1ʳᵉ fois).
4. **Création du réseau `agent_dw_net`** et des volumes `sql_data`, `sql_log`.
5. **Démarrage séquentiel** :
   - `sqlserver` démarre (~30 s)
   - `backend` attend le healthcheck SQL puis démarre
   - `frontend` attend le healthcheck backend puis démarre

Tu verras défiler les logs de build. À la fin :

```
✔ Container agent_dw_sqlserver  Healthy
✔ Container agent_dw_backend    Healthy
✔ Container agent_dw_frontend   Started
```

---

## 6. Vérifier que tout tourne

### 6.1 État des conteneurs

```powershell
docker compose -f docker-compose.deploy.yml ps
```

Les 3 lignes doivent être `Up (healthy)` (ou `Up` pour le frontend si le
healthcheck est en cours).

### 6.2 Test du backend

```powershell
curl http://localhost:8000/health
```

→ réponse attendue :

```json
{"status":"ok","version":"3.0.0","env":"production"}
```

### 6.3 Test de SQL Server

```powershell
docker exec -it agent_dw_sqlserver /opt/mssql-tools18/bin/sqlcmd `
  -S localhost -U sa -P "Antigravity2026!" -No -C -Q "SELECT @@VERSION"
```

→ doit afficher `Microsoft SQL Server 2022 (RTM-CU...)`.

### 6.4 Ouvrir l'UI

Dans un navigateur : **http://localhost:8080**

Tu dois voir le thème **Premium Dark v5.0**, le logo Antigravity BI en
dégradé violet, et l'écran de login.

---

## 7. Premier login

Au tout premier démarrage, la base de metadata `agent_dw_meta` est vide.
Deux chemins possibles :

### 7.1 Inscription via l'UI

1. Ouvre http://localhost:8080
2. Clique **"Créer un compte"** (lien sous le formulaire de connexion)
3. Renseigne email + mot de passe (≥ 12 caractères recommandé)
4. Te voilà connecté, le premier compte est automatiquement `admin`.

### 7.2 Via l'API (Swagger)

Ouvre **http://localhost:8000/api/docs** → `POST /api/auth/register` →
**Try it out** → fournis `email` + `password` → **Execute**.

---

## 8. Restaurer une base .bak

C'est le scénario principal du projet (le prof teste avec ses propres
bases SQL Server).

1. **Place le .bak dans `./uploads/bak/`** sur le PC du prof
   (monté automatiquement dans SQL Server).
2. Dans l'UI → onglet **"Importer une base"** → upload le fichier.
3. Le backend lance `RESTORE DATABASE` via ODBC, SQL Server restaure, puis
   le pipeline LangGraph démarre l'analyse.

Alternative ligne de commande :

```powershell
curl -X POST http://localhost:8000/api/upload-backup `
  -F "file=@C:\chemin\vers\ma_base.bak" `
  -F "restore_db_name=ma_base_test"
```

---

## 9. Arrêter / redémarrer

```powershell
# Arrêter (les volumes sont conservés)
docker compose -f docker-compose.deploy.yml down

# Redémarrer
docker compose -f docker-compose.deploy.yml up -d

# Tout supprimer (⚠️ efface aussi la BDD SQL Server)
docker compose -f docker-compose.deploy.yml down -v
```

---

## 10. Dépannage

### 10.1 `port is already allocated`

Un port (1433, 8000, 8080) est déjà utilisé. Soit tu arrêtes le service
conflictuel, soit tu changes le mapping dans `docker-compose.deploy.yml` :

```yaml
ports:
  - "14330:1433"   # 14330 côté hôte, 1433 dans le conteneur
```

### 10.2 SQL Server bloqué sur `starting`

Attends 45 s (SQL Server 2022 est lent au 1er démarrage). Si ça persiste :

```powershell
docker logs agent_dw_sqlserver --tail 50
```

Erreurs fréquentes :

- `Password validation failed` → `DB_PASSWORD` dans `.env` ne respecte pas
  la politique (il faut majuscule + chiffre + symbole + ≥ 8 chars).
- `There is insufficient system memory` → Docker Desktop a < 4 GB alloués.

### 10.3 Backend redémarre en boucle

```powershell
docker logs agent_dw_backend --tail 80
```

Cas courants :

- **`JWT_SECRET absent`** → `.env` pas chargé. Vérifie que le fichier existe
  bien à la racine et que tu as utilisé `--env-file .env`.
- **`Login failed for user 'sa'`** → `DB_PASSWORD` dans `.env` ne matche pas
  celui passé à SQL Server au premier démarrage.
  Solution : `docker compose -f docker-compose.deploy.yml down -v` (efface
  le volume) puis `up -d --build`.
- **`Cannot open backup device`** → le `.bak` n'est pas visible par SQL
  Server. Vérifie le volume partagé :

  ```powershell
  docker exec agent_dw_sqlserver ls -la /var/opt/mssql/backup/
  docker exec agent_dw_backend ls -la /app/uploads/bak/
  ```

  Les deux listings doivent afficher le même fichier.

### 10.4 UI charge mais `/api/...` renvoie 404

Nginx ne proxifie pas correctement. Teste :

```powershell
docker exec agent_dw_frontend wget -qO- http://backend:8000/health
```

Si ça échoue : le réseau `agent_dw_net` a un souci. `docker compose down && up -d`.

### 10.5 CORS error dans la console navigateur

Ajoute l'origine exacte à `ALLOWED_ORIGINS` dans `.env`, puis redémarre le
backend :

```powershell
docker compose -f docker-compose.deploy.yml restart backend
```

### 10.6 Ollama injoignable depuis le backend

Le backend essaye `http://host.docker.internal:11434`. Sur Linux pur (pas
Docker Desktop), il faut que la ligne `extra_hosts: host.docker.internal:
host-gateway` soit bien présente (elle l'est déjà dans le compose).
Vérifie qu'Ollama écoute sur **toutes les interfaces** :

```powershell
$env:OLLAMA_HOST="0.0.0.0"; ollama serve
```

---

## 11. Commandes utiles

### Logs en direct

```powershell
# Tous les services
docker compose -f docker-compose.deploy.yml logs -f

# Un seul service
docker compose -f docker-compose.deploy.yml logs -f backend
```

### Shell dans un conteneur

```powershell
# Dans le backend (Python)
docker exec -it agent_dw_backend bash

# Dans SQL Server (sqlcmd)
docker exec -it agent_dw_sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Antigravity2026!" -No -C
```

### Reconstruire un service après un changement de code

```powershell
# Uniquement le backend
docker compose -f docker-compose.deploy.yml up -d --build backend

# Uniquement le frontend (si tu as touché à src/)
docker compose -f docker-compose.deploy.yml up -d --build frontend
```

### Exporter / importer les images

```powershell
# Export (sur ta machine)
docker save antigravity-bi-backend:latest antigravity-bi-frontend:latest -o antigravity-images.tar

# Import (sur le PC du prof, sans rebuild)
docker load -i antigravity-images.tar
docker compose -f docker-compose.deploy.yml up -d
```

### Backup de la base de metadata

```powershell
docker exec agent_dw_sqlserver /opt/mssql-tools18/bin/sqlcmd `
  -S localhost -U sa -P "Antigravity2026!" -No -C `
  -Q "BACKUP DATABASE agent_dw_meta TO DISK = '/var/opt/mssql/backup/meta.bak' WITH INIT"
```

Le fichier apparaît dans `./uploads/bak/meta.bak` côté hôte.

---

## 📞 Check-list finale avant de passer le projet au prof

- [ ] Docker Desktop installé et ≥ 6 GB de RAM alloués
- [ ] Ports 1433, 8000, 8080 libres
- [ ] `docker-compose.deploy.yml` présent à la racine
- [ ] `.env` copié depuis `.env.deploy` (contient `JWT_SECRET`)
- [ ] `docker compose -f docker-compose.deploy.yml up -d --build` termine sans erreur
- [ ] `docker compose ps` → 3 services `healthy`
- [ ] `http://localhost:8080` affiche l'UI Premium Dark v5.0
- [ ] `curl http://localhost:8000/health` → `{"status":"ok"}`
- [ ] Première inscription via UI fonctionne
- [ ] Un `.bak` de test peut être restauré

Si les 10 cases sont cochées → **c'est déployé**. 🚀
