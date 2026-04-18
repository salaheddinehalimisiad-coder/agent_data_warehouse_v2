# 🗺️ Roadmap Stratégique — Phase 3 : Intelligence Analytique & Robustesse

Ce document détaille la vision, les objectifs techniques et le plan d'exécution pour la **Phase 3** du projet **Antigravity BI**. L'accent est mis sur la **généricité absolue**, l'**automatisation analytique** et la **génération de rapports professionnels**.

---

## 🎯 1. Vision & Objectifs Centraux

### 1.1 La Mission
Transformer n'importe quelle base de données OLTP source en un système décisionnel opérationnel en quelques minutes, sans intervention manuelle experte.

### 1.2 Principes de Conception
*   **Généricité Non-Négociable** : L'agent doit raisonner sur le schéma (profiling) et non sur des règles métier pré-établies.
*   **Aide à la Décision (SIA)** : Le framework ne doit pas juste charger les données, il doit générer l'intelligence pour les exploiter (SQL OLAP, MDX, DAX).
*   **Human-In-The-Loop** : Une interface interactive pour valider et affiner les propositions de l'IA.

---

## 🚀 2. État du Pipeline (9 Nœuds Actifs)

Le graph **LangGraph** actuel assure le flux de données suivant :
1.  **Explorer** : Profiling asynchrone et détection de schéma.
2.  **Data Quality** : Audit de sanité (Nulls, Outliers, Cardinalité).
3.  **Modeler** : Scoring de tables pour inférer les Faits et Dimensions.
4.  **Critic/Chat** : Boucle de révision humaine interactive.
5.  **ETL Generator/Executor** : Forge T-SQL et chargement physique (SQL Server 2022).

---

## ⚡ 3. Algorithme de Modélisation Générique

Le moteur de modélisation (`modeler.py`) utilise un système de scoring multicritère :
*   **Scoring de 'Fact-ness'** : Relations FK entrantes (≥ 2), colonnes numériques continues (mesures), cardinalité élevée.
*   **Étoile & Constellation** : Détection de clusters de faits et dénormalisation des chaînes Snowflake.
*   **Génération DimDate** : Création algorithmique d'une dimension temporelle universelle (Year, Quarter, Month, Day, Weekday, etc.).
*   **Inférence de Mesures** : Détection des colonnes `MONEY`, `DECIMAL` et calculs automatiques (Price × Quantity).

---

## 🛠️ 4. Plan de Route Phase 3 (Détail des Tâches)

### 🔴 P3-01 : Stabilisation & Tests (Priorité Haute)
*   Migration totale des tests vers `etl_tsql_generator`.
*   Validation de la logique **SCD Type 2** (ValidFrom/To).
*   Test sur schémas fictifs non-Northwind (ex: Library System).

### 🔍 P3-02 : Query Generator (IA Analytique)
*   **Génération dynamique** : Création de requêtes SQL analytiques (Window Functions, ROLLUP, CUBE) basées sur le schéma généré.
*   **Multi-Langage** : Support initial pour MDX (SSAS) et DAX (Power BI).
*   **Exécution Directe** : Collecte des résultats analytiques dans `state['query_results']`.

### 📄 P3-03 : Report Generator (PDF PRO)
*   Génération de rapports PDF documentant tout le cycle de vie du run.
*   Sections : Résumé Exécutif, Schéma Source, Modèle Dimensionnel, DDL, et Résultats Analytiques.
*   Librairies : `fpdf2` ou `reportlab`.

### 🔄 P3-04 : CDC & ETL Incrémental
*   Mécanisme de **Watermark** générique (timestamps par table).
*   Détection intelligente des colonnes de modification (`UpdatedAt`, `LastModified`).
*   Mode `Full Load` vs `Incremental` persistant.

### 📊 P3-05 : Dashboard Builder React
*   Interface de visualisation générique s'adaptant au schéma du Modeler.
*   Widgets dynamiques : Charts Recharts, KPI Cards, DataTables.
*   Système de Drag-and-Drop pour la mise en page.

---

## 📐 5. Patterns & Architecture Cible

### État de l'Agent (`app_state.py`)
Nouveaux champs intégrés pour la Phase 3 :
```python
# Query & Analytics
generated_queries: Dict[str, List[str]]
query_results: Dict[str, Any]

# Reporting
report_pdf_path: str
report_language: str # 'fr' | 'en'

# Sync & CDC
etl_mode: str # 'full' | 'incremental'
etl_watermarks: Dict[str, str]
```

---

## 📦 6. Dépendances & Stack Phase 3

*   **Backend** : `fpdf2` (PDF), `apscheduler` (Planification), `pyodbc` (SQL Server).
*   **Frontend** : `react-grid-layout` (Dashboard), `recharts` (Visualisation).
*   **Modèles** : `qwen2.5-coder:7b` ou `gemini-1.5-flash`.

---
<p align="center">
<i>"L'automatisation ne consiste pas à remplacer l'ingénieur, mais à le libérer des tâches répétitives pour qu'il se concentre sur l'architecture de la décision."</i>
</p>
