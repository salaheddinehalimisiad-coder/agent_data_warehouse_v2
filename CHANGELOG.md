# Changelog — Agent Data Warehouse

## v4.0 PRO — Refonte ETL + Solidité ingénieur (2026-04-12)

### Refonte majeure — ETL Python Natif

**`nodes/etl_executor.py` réécrit intégralement :**
- ETL Python natif via SQLAlchemy (zéro dépendance Pentaho)
- Lecture réelle des données source (CSV, Excel, SQL, REST API)
- Chargement des dimensions avec génération de Surrogate Keys
- Résolution des clés étrangères (nat_key → SK) pour la table de faits
- Chargement en batch de 500 lignes avec comptage insertions/rejets
- Métriques post-chargement : taux de charge, rejets, lignes par dimension
- Mode dégradé : export DDL `.sql` si DW non configuré

### Nouvelles fonctionnalités DW

- **SCD Type 2** : colonnes `valid_from`, `valid_to`, `is_current` ajoutées automatiquement aux dimensions entités
- **Clé naturelle** (`natural_key`) présente dans chaque dimension pour le lookup ETL
- **RunMetrics.jsx** : dashboard de métriques post-chargement (taux, rejets, dims)
- **StarSchemaViewer v4.0** : navigation interactive FK→dim, affichage SCD2, copie DDL

### Corrections de bugs (de la session précédente)

- BUG #1 `HumanReviewPanel.jsx` : `validateModel` → `validatePipeline`
- BUG #2 `pipeline.py` : validation JWT sur le SSE stream
- BUG #3 `pipelineStore.js` : signature `apiClient.startPipeline()` harmonisée
- BUG #4 `nodes/explorer.py` : URL SQLAlchemy dynamique par type de DB
- BUG #5 `nodes/lineage_tracker.py` : suppression asyncio incorrect
- BUG #6 `ConnectionModal.jsx` : `db` → `database` dans config DW
- WARN #2 : event SSE `dq_review_required` géré dans le store
- WARN #3 : dérive schéma avec type de colonne inclus
- WARN #4 : DDL split via `sqlparse`
- WARN #6 : chemins absolus `pathlib` partout
- WARN #7 : `_sseCleanup` null après resetPipeline
- WARN #8 : NeuralBackground lazy-loadé

### Nouvelles dépendances

- `sqlparse>=0.5.0` — découpage DDL robuste
- Dépendances déjà présentes utilisées : `sqlalchemy`, `pandas`

---

## v3.0 — Initial release
- 11 nœuds LangGraph, Data Quality Agent, Lineage Tracker
- Frontend premium avec SSE temps-réel
