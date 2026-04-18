# 🌌 Antigravity BI — Autonomous Agentic Data Warehouse

<div align="center">
  <img src="https://img.shields.io/badge/Version-v4.1%20PRO-indigo.svg?style=for-the-badge" alt="Version"/>
  <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/React%20Flow-FF0072?style=for-the-badge&logo=react" alt="React Flow"/>
  <img src="https://img.shields.io/badge/SQL_Server_2022-CC2927?style=for-the-badge&logo=microsoft-sql-server&logoColor=white" alt="SQL Server"/>
  <img src="https://img.shields.io/badge/LangGraph-000000?style=for-the-badge" alt="LangGraph"/>
</div>

<br/>

Antigravity BI (Agent Architect) est un système ETL de bout en bout propulsé par des **Agents IA Multi-Modèles**. Conçu pour révolutionner la modélisation de données (Kimball Star Schema), il automatise la création de Data Warehouses d'Entreprise, de l'ingestion à la validation croisée par l'IA.

---

## 📸 Architectural Canvas (Constellation Schema)

Une interface ergonomique `Lightbox` digne d'un IDE professionnel permet une interaction riche avec les schémas modélisés par l'IA (Click-to-Zoom, Auto-Layout dynamique).

> *Aperçu de l'interface de révision (Human-In-The-Loop) de l'agent métier.*

---

## 🚀 Fonctionnalités Clés

*   **Intelligence Artificielle Orchestrée (LangGraph)** : Plus de 10 agents IA spécialisés dialoguent pour profiler, auditer, modéliser, transformer et valider vos données de manière itérative.
*   **Auto-Healing Engine (Le "*Healer*")** : Un moteur de cicatrisation automatique qui intercepte les crashs (erreurs T-SQL, DDL malformés, URL SQLAlchemy erronés) et y injecte instantanément un correctif généré par IA.
*   **Modélisation Étoile (Star Schema) Dynamique** : Fini l'ETL manuel complexe. Téléchargez un `"*.bak"` ou un `"*.csv"`, et le modèle génère lui-même ses tables de Fait (`FACT`) et ses Dimensions (`DIM_XX`) avec *Surrogate Keys*.
*   **Smart Canvas & Lightbox (React Flow)** : Un canevas en plein écran avec fonction Zoom pour analyser chirurgicalement les schémas complexes générés par le Modeler cognitif.
*   **Infrastructure Microsoft Hautes Performances** : Migration totale à 100% sur un environnement **SQL Server 2022** optimisé pour l'analytique avec le pilote `pyodbc`.

---

## 🧠 Flotte d'Agents (Neural Pipeline)

Le système de traitement se divise en nœuds de pipeline cognitifs stricts :

1.  **🔍 Explorer** : Renifle le *schema*, échantillonne la donnée de manière asynchrone et relève les contraintes (Types, Primary Keys, Foreign Keys).
2.  **🕵️ Data Quality** : Audite en profondeur la sanité de la data (Valeurs Nulles, NaN, Outliers, Cardinalité) et émet des règles (Warning/Critical).
3.  **📐 Modeler** : Cerveau central transformant le chaos 3NF ou Plat en **Modèle Kimball** optimisé (Dimensions SCD, Faits additifs).
4.  **🧑‍⚖️ Critic & ChatModifier** : Human-in-the-Loop. L'IA soumet son design. Si défaillant, elle discute avec vous pour modifier les Surrogate Keys ou aplanir (Flatten) certaines dimensions à la volée.
5.  **🔧 ETL Generator & Executor** : Construit nativement les codes Python / SQLAlchemy (`INSERT`, `MERGE`, gestion des Quarantaines) pour envoyer la donnée physique dans SQL Server.

---

## 🛠️ Stack Technologique

**Backend**
*   **FastAPI & Python 3.10+** (Moteur API asynchrone).
*   **LangChain / LangGraph** (Construction du graphe de dialogue AI).
*   **SQLAlchemy 2.0 & PyODBC** (ORM et interface ODBC SQL Server MSSQL).
*   **Pandas** (ETL Python Memory-Mapped).

**Frontend**
*   **React + Vite + Tailwind CSS** (UI Glassmorphism, Dark Mode).
*   **React Flow / xyflow** (Génération du DAG visuel des tables SQL).
*   **Lucide-React & Framer Motion** (Micro-animations, transitions fluides).

**Infrastructure**
*   **Microsoft SQL Server 2022** (Conteneur ou Local)
*   **OpenAI / Gemini / Ollama** (Flexibilité des LLMs)

---

## 📦 Installation & Déploiement

### 1. Pré-Requis
*   **Python 3.10+** et **Node.js v18+**.
*   **SQL Server 2022** (Avec ODBC Driver 17 for SQL Server installé sur la machine).

### 2. Configuration Backend
Clonez le dépôt, créez un environnement virtuel et configurez l'environnement :
```bash
git clone https://github.com/salaheddinehalimisiad-coder/agent_data_warehouse_v2.git
cd agent_data_warehouse_v2
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```
Modifiez le fichier `.env` selon l'exemple fourni :
```env
DB_HOST=127.0.0.1
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=VotreSuperMotDePasse!
DB_NAME=agent_dw_meta
```

### 3. Démarrer les Serveurs

Démarrer l'agent cognitif (Terminal 1) :
```bash
uvicorn main:app --reload --port 8000
```
Démarrer l'interface Architecte (Terminal 2) :
```bash
npm install
npm run dev
```

---

## 🎯 Cycle d'Utilisation

1.  Ouvrez `http://localhost:5173`. Cliquez sur **New Pipeline**.
2.  Assurez-vous que la source est bien sélectionnée sur SQL Server ou `.bak` et glissez votre base (ex: *Northwind.bak*).
3.  Laissez le pipeline s'allumer. Chaque agent prendra la parole, effectuera son audit, et résoudra de potentiels blocages grâce au rôle *Healer*.
4.  À l'étape **Human Review**, agrandissez (*Fullscreen*) la modélisation en étoile générée. Vous pouvez cliquer sur les en-têtes et discuter avec le chatbot pour exiger une fusion de tables !
5.  Validez le schéma. L'ETL Executor peuplera les tables et un dashboard vous annoncera la disponibilité immédiate du Data Warehouse pour vos reportings (PowerBI/Tableau).

---

## 🗺️ Roadmap & Évolutions
Consultez la [Roadmap Stratégique (Phase 3)](./ROADMAP.md) pour découvrir les prochaines étapes du projet :
- Générateur de requêtes analytiques (SQL OLAP, DAX).
- Moteur de rapports PDF professionnels.
- ETL Incrémental via CDC Watermarking.
- Dashboard Builder interactif.

---

<p align="center">
Développé dans le cadre d'un pipeline MLOps de R&D avancée.
</p>
