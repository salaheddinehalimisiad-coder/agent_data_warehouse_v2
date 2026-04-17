# nodes/modeler.py — Agent Modeler : conception du schéma OLAP Star Schema
import json
import logging
import re
from app_state import AgentState
from nodes.llm_factory import get_llm, call_with_retry, extract_text
from langchain_core.prompts import ChatPromptTemplate

logger = logging.getLogger(__name__)


MODELER_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """Tu es un Expert Architecte Data Warehouse Senior spécialisé en modélisation OLAP Kimball.

Ton rôle : analyser les métadonnées d'une source de données et concevoir un schéma en Étoile (Star Schema) optimal.

## Règles strictes d'architecture :
1. Une seule table de faits centrale (préfixe `fact_`) contenant les métriques numériques
2. Tables de dimensions (préfixe `dim_`) pour chaque axe d'analyse
3. Surrogate Keys (SK) sur toutes les tables de dimensions (suffixe `_sk`, type BIGINT AUTO_INCREMENT)
4. Clés étrangères dans la table de faits pointant vers les dim_
5. Pas de FOREIGN KEY physiques sur fact_ (INDEX à la place, pour les perfs)
6. Toujours inclure `dim_date` (date_sk, date_full, annee, trimestre, mois, semaine, jour)
7. Typage précis : BIGINT pour les SKs, DECIMAL(15,4) pour les montants, INT pour les quantités
8. Pour chaque dimension entité (client, produit, etc.), inclure les colonnes SCD Type 2 : `valid_from DATE`, `valid_to DATE`, `is_current TINYINT(1)` pour gérer l'historisation
9. La clé naturelle (natural_key) doit être présente dans chaque dimension pour le lookup lors de l'ETL

## Format de réponse OBLIGATOIRE (JSON uniquement, sans balises markdown) :
{{
  "fact_table": {{
    "name": "fact_ventes",
    "description": "Table de faits centrale",
    "columns": [
      {{"name": "vente_sk", "type": "BIGINT AUTO_INCREMENT", "role": "pk"}},
      {{"name": "date_sk", "type": "BIGINT", "role": "fk", "references": "dim_date"}},
      {{"name": "montant_total", "type": "DECIMAL(15,4)", "role": "metric"}}
    ]
  }},
  "dimension_tables": [
    {{
      "name": "dim_date",
      "description": "Dimension temporelle",
      "columns": [
        {{"name": "date_sk", "type": "BIGINT AUTO_INCREMENT", "role": "pk"}},
        {{"name": "date_full", "type": "DATE", "role": "attribute"}}
      ]
    }}
  ]
}}"""),
    ("human", """Métadonnées de la source de données :
{metadata}

{drift_warning}

Conçois le meilleur schéma Star Schema possible pour cette source.""")
])


def modeler_node(state: AgentState) -> dict:
    """Génère le modèle logique OLAP et le DDL SQL correspondant.
    Si le LLM est indisponible, utilise un générateur intelligent basé sur les métadonnées.
    """
    logger.info("--- AGENT MODELER : Conception du Star Schema ---")

    metadata = state.get("source_metadata", {})
    drift_detected = state.get("schema_drift_detected", False)
    drift_details = state.get("schema_drift_details", "")

    drift_warning = ""
    if drift_detected:
        drift_warning = f"⚠️ ATTENTION : Dérive de schéma détectée : {drift_details}. Adapte le modèle en conséquence."

    current_version = state.get("logical_model_version", 0)
    previous_ddl = state.get("sql_ddl", "")

    # ── Tentative avec LLM ───────────────────────────────────────────────────
    logical_model = None
    try:
        llm = get_llm(temperature=0.1)
        chain = MODELER_PROMPT | llm
        response = call_with_retry(chain, {
            "metadata": json.dumps(metadata, indent=2, default=str),
            "drift_warning": drift_warning,
        })
        raw = extract_text(response)
        logical_model = _parse_model_json(raw)
        if logical_model:
            logger.info("[Modeler] ✅ Modèle généré via LLM")
        else:
            logger.warning("[Modeler] ⚠️ LLM a répondu mais JSON invalide — bascule sur mock")
    except Exception as e:
        logger.warning(f"[Modeler] ⚠️ LLM indisponible ({type(e).__name__}) — bascule sur générateur intelligent")

    # ── Fallback : Générateur intelligent sans LLM ───────────────────────────
    if not logical_model:
        logical_model = _smart_mock_model(metadata)
        logger.info(f"[Modeler] 🤖 Star Schema auto-généré sans LLM : "
                    f"{len(logical_model.get('dimension_tables', []))} dimensions")

    # Générer le DDL SQL
    sql_ddl = _generate_ddl(logical_model, state.get("user_prefix", "dw"))

    logger.info(f"[Modeler] Modèle v{current_version + 1} — "
                f"{len(logical_model.get('dimension_tables', []))} dimensions + 1 table de faits")

    return {
        "logical_model": logical_model,
        "logical_model_version": current_version + 1,
        "previous_sql_ddl": previous_ddl,
        "sql_ddl": sql_ddl,
        "execution_log": state.get("execution_log", []) + [
            f"[Modeler] ✅ Star Schema v{current_version + 1} — "
            f"{len(logical_model.get('dimension_tables', []))} dimensions"
        ],
    }


def _smart_mock_model(metadata: dict) -> dict:
    """Génère automatiquement un Star Schema réaliste depuis les métadonnées source.

    Logique :
    - Colonnes numériques (int/float/decimal) → métriques dans fact_table
    - Colonnes date → dim_date
    - Colonnes texte/catégorie → tables de dimensions distinctes
    - Colonnes *_id ou id_* → clés étrangères
    """
    import re as _re

    NUMERIC_TYPES = {'int', 'float', 'double', 'decimal', 'numeric', 'bigint', 'smallint', 'number'}
    DATE_TYPES = {'date', 'datetime', 'timestamp', 'time'}
    TEXT_TYPES = {'varchar', 'char', 'text', 'string', 'object', 'str'}

    all_tables = list(metadata.values()) if isinstance(metadata, dict) else []
    if not all_tables:
        return _default_skeleton_model()

    # On prend la première (principale) table source
    source = all_tables[0] if isinstance(all_tables[0], dict) else {}
    columns = source.get('columns', [])
    table_name = source.get('name', 'source').replace('-', '_').replace(' ', '_')

    numeric_cols, date_cols, text_cols, id_cols = [], [], [], []

    for col in columns:
        cname = col.get('name', '').lower()
        ctype = str(col.get('type', col.get('dtype', 'text'))).lower().split('(')[0].strip()

        if _re.search(r'(^id$|_id$|^id_)', cname):
            id_cols.append(col)
        elif ctype in NUMERIC_TYPES or any(t in ctype for t in NUMERIC_TYPES):
            numeric_cols.append(col)
        elif ctype in DATE_TYPES or any(t in ctype for t in DATE_TYPES) or 'date' in cname:
            date_cols.append(col)
        else:
            text_cols.append(col)

    # ── Fact Table ────────────────────────────────────────────────────────────
    fact_name = f"fact_{table_name}"
    fact_cols = [{"name": f"{table_name}_sk", "type": "BIGINT IDENTITY(1,1)", "role": "pk"}]

    # FK vers dim_date si des dates existent
    if date_cols:
        fact_cols.append({"name": "date_sk", "type": "BIGINT", "role": "fk", "references": "dim_date"})

    # FK vers chaque dimension texte (une dim par colonne text avec peu de cardinalité)
    dim_tables = []
    for tc in text_cols[:5]:  # max 5 dimensions
        dim_col_name = tc.get('name', 'dim').lower().replace(' ', '_')
        dim_name = f"dim_{dim_col_name}"
        fact_cols.append({"name": f"{dim_col_name}_sk", "type": "BIGINT", "role": "fk", "references": dim_name})
        dim_tables.append({
            "name": dim_name,
            "description": f"Dimension {dim_col_name}",
            "natural_key": dim_col_name,
            "scd_type": 2,
            "columns": [
                {"name": f"{dim_col_name}_sk", "type": "BIGINT IDENTITY(1,1)", "role": "pk"},
                {"name": dim_col_name, "type": "NVARCHAR(255)", "role": "attribute", "natural_key": True},
                {"name": "description", "type": "NVARCHAR(500)", "role": "attribute"},
                {"name": "valid_from", "type": "DATE", "role": "attribute"},
                {"name": "valid_to", "type": "DATE", "role": "attribute"},
                {"name": "is_current", "type": "BIT DEFAULT 1", "role": "attribute"},
            ]
        })

    # Métriques dans la fact
    for nc in numeric_cols[:8]:
        cname = nc.get('name', '').lower().replace(' ', '_')
        ctype = nc.get('type', nc.get('dtype', 'DECIMAL(15,4)'))
        if 'int' in str(ctype).lower():
            sql_type = 'INT'
        else:
            sql_type = 'DECIMAL(15,4)'
        fact_cols.append({"name": cname, "type": sql_type, "role": "metric"})

    # ── Dim Date (toujours présente) ─────────────────────────────────────────
    dim_date = {
        "name": "dim_date",
        "description": "Dimension temporelle",
        "columns": [
            {"name": "date_sk",    "type": "BIGINT IDENTITY(1,1)", "role": "pk"},
            {"name": "date_full",  "type": "DATE",      "role": "attribute"},
            {"name": "annee",      "type": "INT",        "role": "attribute"},
            {"name": "trimestre",  "type": "TINYINT",   "role": "attribute"},
            {"name": "mois",       "type": "TINYINT",   "role": "attribute"},
            {"name": "semaine",    "type": "TINYINT",   "role": "attribute"},
            {"name": "jour",       "type": "TINYINT",   "role": "attribute"},
            {"name": "jour_semaine","type":"VARCHAR(20)","role": "attribute"},
        ]
    }

    # Ajouter les colonnes date sources dans dim_date
    for dc in date_cols:
        dcname = dc.get('name', '').lower().replace(' ', '_')
        dim_date["columns"].append({"name": dcname, "type": "DATE", "role": "attribute"})

    dim_tables.insert(0, dim_date)

    return {
        "fact_table": {
            "name": fact_name,
            "description": f"Table de faits centrale — données de {table_name}",
            "columns": fact_cols,
        },
        "dimension_tables": dim_tables
    }


def _default_skeleton_model() -> dict:
    """Modèle par défaut minimal si aucune métadonnée n'est disponible."""
    return {
        "fact_table": {
            "name": "fact_ventes",
            "description": "Table de faits centrale",
            "columns": [
                {"name": "vente_sk",      "type": "BIGINT IDENTITY(1,1)", "role": "pk"},
                {"name": "date_sk",       "type": "BIGINT",      "role": "fk", "references": "dim_date"},
                {"name": "produit_sk",    "type": "BIGINT",      "role": "fk", "references": "dim_produit"},
                {"name": "montant_total", "type": "DECIMAL(15,4)","role": "metric"},
                {"name": "quantite",      "type": "INT",         "role": "metric"},
            ]
        },
        "dimension_tables": [
            {
                "name": "dim_date",
                "description": "Dimension temporelle",
                "columns": [
                    {"name": "date_sk",   "type": "BIGINT IDENTITY(1,1)", "role": "pk"},
                    {"name": "date_full", "type": "DATE",    "role": "attribute"},
                    {"name": "annee",     "type": "INT",     "role": "attribute"},
                    {"name": "trimestre", "type": "TINYINT", "role": "attribute"},
                    {"name": "mois",      "type": "TINYINT", "role": "attribute"},
                ]
            },
            {
                "name": "dim_produit",
                "description": "Dimension produit",
                "columns": [
                    {"name": "produit_sk",  "type": "BIGINT IDENTITY(1,1)", "role": "pk"},
                    {"name": "nom_produit", "type": "NVARCHAR(255)", "role": "attribute"},
                    {"name": "categorie",   "type": "NVARCHAR(100)", "role": "attribute"},
                ]
            }
        ]
    }


def _parse_model_json(raw: str) -> dict:
    """Extrait et parse le JSON du modèle depuis la réponse LLM."""
    # Nettoyer les balises markdown si présentes
    cleaned = re.sub(r"```(?:json)?\n?", "", raw).strip().rstrip("`")
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Essayer d'extraire le JSON avec regex
        match = re.search(r"\{[\s\S]+\}", cleaned)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
    return {}


def _generate_ddl(model: dict, prefix: str = "dw") -> str:
    """Génère le SQL DDL T-SQL (SQL Server) à partir du modèle logique."""
    lines = ["-- ============================================",
             "-- Data Warehouse DDL — Star Schema (T-SQL)",
             f"-- Préfixe schéma : {prefix}",
             "-- ============================================\n"]

    def _col_def(col: dict) -> str:
        name = col.get("name", "col")
        ctype = col.get("type", "NVARCHAR(255)")
        role = col.get("role", "attribute")
        # Conversion des types MySQL vers T-SQL
        ctype = ctype.replace("AUTO_INCREMENT", "").strip()
        if "TINYINT(1)" in ctype:
            ctype = ctype.replace("TINYINT(1)", "BIT")
        parts = [f"[{name}] {ctype}"]
        if role == "pk":
            parts.append("PRIMARY KEY")
        return " ".join(parts)

    # Tables de dimensions d'abord (pour les FK)
    for dim in model.get("dimension_tables", []):
        tname = f"{prefix}_{dim['name']}"
        cols = [_col_def(c) for c in dim.get("columns", [])]
        desc = dim.get('description', '').replace("'", "''")
        lines.append(f"IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '{tname}')")
        lines.append(f"CREATE TABLE [{tname}] (")
        lines.append(",\n".join(f"  {c}" for c in cols))
        lines.append(f");\n")

    # Table de faits
    fact = model.get("fact_table", {})
    if fact:
        tname = f"{prefix}_{fact['name']}"
        cols = [_col_def(c) for c in fact.get("columns", [])]

        # Ajouter les INDEX sur les FK (pas de FK physiques pour les perfs)
        fk_cols = [c["name"] for c in fact.get("columns", []) if c.get("role") == "fk"]

        all_cols = [f"  {c}" for c in cols]
        lines.append(f"IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '{tname}')")
        lines.append(f"CREATE TABLE [{tname}] (")
        lines.append(",\n".join(all_cols))
        lines.append(f");\n")

        # Index séparés (T-SQL ne supporte pas INDEX inline dans CREATE TABLE)
        for fk_col in fk_cols:
            lines.append(f"IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_{fk_col}' AND object_id = OBJECT_ID('{tname}'))")
            lines.append(f"CREATE NONCLUSTERED INDEX [idx_{fk_col}] ON [{tname}] ([{fk_col}]);\n")

    return "\n".join(lines)
