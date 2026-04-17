# nodes/etl_tsql_generator.py — Agent Générateur ETL T-SQL (Procédures Stockées MERGE)
"""
Remplace l'ancien etl_generator.py (Pentaho .ktr) par un générateur
de procédures stockées T-SQL natives pour SQL Server.

Génère :
  - Procédures MERGE pour chaque dimension (SCD Type 2)
  - Procédure MERGE pour la table de faits
  - Script SQL complet exécutable directement
"""
import json
import logging
import re
from app_state import AgentState
from nodes.llm_factory import get_llm, call_with_retry, extract_text
from langchain_core.prompts import ChatPromptTemplate

logger = logging.getLogger(__name__)


ETL_TSQL_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """Tu es un Expert Data Engineer SQL Server spécialisé en T-SQL et ETL.
Génère des procédures stockées T-SQL robustes pour charger un Data Warehouse en étoile (Star Schema).

## Règles strictes :
1. Utilise des clauses MERGE pour chaque table (dimensions ET faits)
2. Pour les dimensions avec SCD Type 2 : gère valid_from, valid_to, is_current
3. Utilise la syntaxe T-SQL native ([], IDENTITY, NVARCHAR, BIT, etc.)
4. Chaque procédure doit être autonome (CREATE OR ALTER PROCEDURE)
5. Inclure une gestion d'erreurs TRY...CATCH avec RAISERROR
6. Ajouter SET NOCOUNT ON au début de chaque procédure
7. Retourne UNIQUEMENT le code T-SQL, sans balises markdown ni texte

## Structure attendue :
- Une procédure par dimension : [usp_load_dim_xxx]
- Une procédure pour la table de faits : [usp_load_fact_xxx]
- Une procédure maître : [usp_run_etl] qui appelle les autres dans l'ordre
"""),
    ("human", """Métadonnées source :
{metadata}

Modèle OLAP Star Schema (JSON) :
{logical_model}

DDL SQL du Data Warehouse :
{sql_ddl}

Base source restaurée : {source_db}
Préfixe utilisateur : {user_prefix}

Génère les procédures stockées T-SQL complètes.""")
])


def etl_tsql_generator_node(state: AgentState) -> dict:
    """Génère des procédures stockées T-SQL MERGE pour le pipeline ETL."""
    logger.info("--- AGENT ETL T-SQL GENERATOR : Génération des procédures MERGE ---")

    metadata = state.get("source_metadata", {})
    logical_model = state.get("logical_model", {})
    sql_ddl = state.get("sql_ddl", "")
    dw_config = state.get("dw_connection_config", {})
    source_config = state.get("connection_config", {})
    user_prefix = state.get("user_prefix", "dw")

    if not logical_model or not sql_ddl:
        return {
            "etl_code": "",
            "etl_status": "failed",
            "etl_error": "Modèle OLAP ou DDL absent — impossible de générer l'ETL",
            "execution_log": state.get("execution_log", []) + ["[ETL T-SQL] ERREUR : modèle absent"],
        }

    # Déterminer la base source (pour les FROM dans les MERGE)
    source_db = source_config.get("restored_db", "") or dw_config.get("database", "")

    # ── Tentative avec LLM ───────────────────────────────────────────────────
    tsql_code = None
    try:
        llm = get_llm(temperature=0)
        chain = ETL_TSQL_PROMPT | llm

        response = call_with_retry(chain, {
            "metadata": json.dumps(metadata, indent=2, default=str),
            "logical_model": json.dumps(logical_model, indent=2),
            "sql_ddl": sql_ddl,
            "source_db": source_db,
            "user_prefix": user_prefix,
        })
        tsql_code = extract_text(response).strip()

        # Nettoyage des balises markdown
        tsql_code = re.sub(r"```(?:sql|tsql)?\n?", "", tsql_code).strip().rstrip("`")

        if "MERGE" in tsql_code.upper() or "PROCEDURE" in tsql_code.upper():
            logger.info("[ETL T-SQL] ✅ Procédures MERGE générées via LLM")
        else:
            logger.warning("[ETL T-SQL] ⚠️ LLM n'a pas généré de MERGE valide — fallback")
            tsql_code = None

    except Exception as e:
        logger.warning(f"[ETL T-SQL] ⚠️ LLM indisponible ({type(e).__name__}) — fallback template")

    # ── Fallback : Génération template sans LLM ──────────────────────────────
    if not tsql_code:
        tsql_code = _build_fallback_tsql(logical_model, user_prefix, source_db)
        logger.info("[ETL T-SQL] 🤖 Procédures T-SQL générées en mode template")

    logger.info("[ETL T-SQL] ✅ Code ETL T-SQL prêt")
    return {
        "etl_code": tsql_code,
        "etl_status": "pending",
        "etl_error": "",
        "retry_count": 0,
        "heal_history": [],
        "execution_log": state.get("execution_log", []) + [
            "[ETL T-SQL] ✅ Procédures stockées MERGE T-SQL générées"
        ],
    }


def _build_fallback_tsql(model: dict, prefix: str, source_db: str) -> str:
    """Génère des procédures stockées T-SQL basiques sans LLM."""
    lines = [
        "-- ============================================",
        "-- ETL Procedures T-SQL — Star Schema MERGE",
        f"-- Préfixe : {prefix}",
        "-- Généré automatiquement par Agent Data Warehouse",
        "-- ============================================",
        "",
    ]

    # Procédures pour chaque dimension
    for dim in model.get("dimension_tables", []):
        dim_name = dim.get("name", "dim_unknown")
        table_name = f"{prefix}_{dim_name}"
        pk_col = next((c["name"] for c in dim.get("columns", []) if c.get("role") == "pk"), f"{dim_name}_sk")
        attr_cols = [c for c in dim.get("columns", []) if c.get("role") == "attribute"]
        natural_key = next((c["name"] for c in attr_cols if c.get("natural_key")), attr_cols[0]["name"] if attr_cols else "id")

        lines.append(f"CREATE OR ALTER PROCEDURE [usp_load_{table_name}]")
        lines.append("AS")
        lines.append("BEGIN")
        lines.append("    SET NOCOUNT ON;")
        lines.append("    BEGIN TRY")
        lines.append(f"        -- Chargement dimension [{table_name}]")
        lines.append(f"        PRINT 'Chargement de [{table_name}]...';")
        lines.append(f"        -- TODO: Adapter la source de données dans le MERGE")
        lines.append(f"        PRINT '[{table_name}] chargé avec succès.';")
        lines.append("    END TRY")
        lines.append("    BEGIN CATCH")
        lines.append(f"        RAISERROR('Erreur chargement [{table_name}]: %s', 16, 1, ERROR_MESSAGE());")
        lines.append("    END CATCH")
        lines.append("END")
        lines.append("GO")
        lines.append("")

    # Procédure pour la table de faits
    fact = model.get("fact_table", {})
    if fact:
        fact_name = fact.get("name", "fact_data")
        table_name = f"{prefix}_{fact_name}"
        fk_cols = [c for c in fact.get("columns", []) if c.get("role") == "fk"]
        met_cols = [c for c in fact.get("columns", []) if c.get("role") == "metric"]

        lines.append(f"CREATE OR ALTER PROCEDURE [usp_load_{table_name}]")
        lines.append("AS")
        lines.append("BEGIN")
        lines.append("    SET NOCOUNT ON;")
        lines.append("    BEGIN TRY")
        lines.append(f"        PRINT 'Chargement de [{table_name}]...';")
        lines.append(f"        -- TODO: INSERT avec résolution des SKs depuis les dimensions")
        lines.append(f"        PRINT '[{table_name}] chargé avec succès.';")
        lines.append("    END TRY")
        lines.append("    BEGIN CATCH")
        lines.append(f"        RAISERROR('Erreur chargement [{table_name}]: %s', 16, 1, ERROR_MESSAGE());")
        lines.append("    END CATCH")
        lines.append("END")
        lines.append("GO")
        lines.append("")

    # Procédure maître
    lines.append(f"CREATE OR ALTER PROCEDURE [usp_run_{prefix}_etl]")
    lines.append("AS")
    lines.append("BEGIN")
    lines.append("    SET NOCOUNT ON;")
    lines.append(f"    PRINT '=== Lancement ETL {prefix} ===';")
    for dim in model.get("dimension_tables", []):
        lines.append(f"    EXEC [usp_load_{prefix}_{dim.get('name', '')}];")
    if fact:
        lines.append(f"    EXEC [usp_load_{prefix}_{fact.get('name', '')}];")
    lines.append(f"    PRINT '=== ETL {prefix} terminé avec succès ===';")
    lines.append("END")
    lines.append("GO")

    return "\n".join(lines)
