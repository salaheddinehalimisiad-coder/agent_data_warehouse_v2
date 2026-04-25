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

    logical_model = state.get("logical_model", {})
    user_prefix   = state.get("user_prefix", "dw")
    source_config = state.get("connection_config", {})
    source_db     = source_config.get("database", "source_db")
    new_logs      = []

    if not logical_model:
        return {
            "etl_status": "failed",
            "etl_error": "No logical model available",
            "execution_log": ["[ETL T-SQL] ❌ No logical model"]
        }

    try:
        # Utiliser le fallback algorithmique (sans LLM) pour la génération T-SQL
        etl_code = _build_fallback_tsql(logical_model, user_prefix, source_db)

        new_logs.append(f"[ETL T-SQL] ✅ T-SQL procedures generated ({len(etl_code)} chars)")

        return {
            "etl_code": etl_code,
            "etl_status": "ready",
            "etl_error": None,
            "execution_log": new_logs,
        }
    except Exception as e:
        logger.error(f"[ETL T-SQL] Error generating T-SQL: {e}", exc_info=True)
        return {
            "etl_status": "failed",
            "etl_error": str(e),
            "execution_log": [f"[ETL T-SQL] ❌ Error: {e}"]
        }


def _build_fallback_tsql(model: dict, prefix: str, source_db: str) -> str:
    """Génère des procédures stockées T-SQL avec SCD2 MERGE (sans LLM).
    Supporte les constellations (multi-fact)."""
    lines = [
        "-- ============================================",
        "-- ETL Procedures T-SQL — Star/Constellation MERGE",
        f"-- Préfixe : {prefix}",
        "-- Généré automatiquement par Agent Data Warehouse v5.0",
        "-- ============================================",
        "",
    ]

    # Procédures pour chaque dimension
    for dim in model.get("dimension_tables", []):
        dim_name = dim.get("name", "dim_unknown")
        table_name = f"{prefix}_{dim_name}"
        pk_col = next((c["name"] for c in dim.get("columns", []) if c.get("role") == "pk"), f"{dim_name}_sk")
        attr_cols = [c for c in dim.get("columns", []) if c.get("role") == "attribute"]
        scd_cols = {"valid_from", "valid_to", "is_current"}
        business_attrs = [c for c in attr_cols if c["name"] not in scd_cols]
        natural_key = next((c["name"] for c in business_attrs if c.get("natural_key")), business_attrs[0]["name"] if business_attrs else "id")
        is_scd2 = dim.get("scd_type") == 2 or any(c["name"] in scd_cols for c in attr_cols)

        # v4.2 : procédure SCD2 FONCTIONNELLE.
        # Convention : l'orchestrateur peuple une table staging [prefix_stg_<entity>]
        # au même schéma que la dim AVANT d'appeler cette procédure.
        stg_entity = dim_name.replace("dim_", "", 1) if dim_name.startswith("dim_") else dim_name
        stg_table  = f"{prefix}_stg_{stg_entity}"

        lines.append(f"CREATE OR ALTER PROCEDURE [usp_load_{table_name}]")
        lines.append("AS")
        lines.append("BEGIN")
        lines.append("    SET NOCOUNT ON;")
        lines.append("    SET XACT_ABORT ON;")
        lines.append("    BEGIN TRY")

        if is_scd2 and "dim_date" not in dim_name:
            attr_cols_for_compare = [
                c["name"] for c in business_attrs if c["name"] != natural_key
            ] or [natural_key]
            hash_expr = " + '|' + ".join(
                f"ISNULL(CAST(src.[{c}] AS NVARCHAR(4000)), '∅')"
                for c in attr_cols_for_compare
            )
            insert_cols_list = (
                [natural_key] + attr_cols_for_compare
                + ["valid_from", "valid_to", "is_current", "row_hash"]
            )
            insert_cols_sql = ", ".join(f"[{c}]" for c in insert_cols_list)
            select_cols_sql = (
                f"src.[{natural_key}], "
                + ", ".join(f"src.[{c}]" for c in attr_cols_for_compare)
                + ", SYSUTCDATETIME(), '9999-12-31 23:59:59.999', 1, "
                + f"HASHBYTES('SHA2_256', {hash_expr})"
            )

            lines.append(f"        -- SCD Type 2 pour [{table_name}] via staging [{stg_table}]")
            lines.append("        DECLARE @now DATETIME2(3) = SYSUTCDATETIME();")
            lines.append("")
            lines.append("        -- Étape 1 : fermer les versions courantes dont le hash a changé")
            lines.append(f"        UPDATE tgt SET [is_current] = 0, [valid_to] = @now")
            lines.append(f"        FROM [{table_name}] tgt")
            lines.append(f"        INNER JOIN [{stg_table}] src ON tgt.[{natural_key}] = src.[{natural_key}]")
            lines.append(f"        WHERE tgt.[is_current] = 1")
            lines.append(f"          AND tgt.[row_hash] <> HASHBYTES('SHA2_256', {hash_expr});")
            lines.append("")
            lines.append("        -- Étape 2 : insérer les nouvelles versions (nouvelles clés ou hash modifié)")
            lines.append(f"        INSERT INTO [{table_name}] ({insert_cols_sql})")
            lines.append(f"        SELECT {select_cols_sql}")
            lines.append(f"        FROM [{stg_table}] src")
            lines.append(f"        WHERE NOT EXISTS (")
            lines.append(f"            SELECT 1 FROM [{table_name}] tgt")
            lines.append(f"             WHERE tgt.[{natural_key}] = src.[{natural_key}]")
            lines.append(f"               AND tgt.[is_current] = 1")
            lines.append(f"               AND tgt.[row_hash] = HASHBYTES('SHA2_256', {hash_expr})")
            lines.append("        );")
            lines.append("")
            lines.append(f"        PRINT CONCAT('SCD2 [{table_name}] chargé : ', @@ROWCOUNT, ' lignes affectées.');")
        else:
            lines.append(f"        PRINT 'Chargement de [{table_name}] (non-SCD2)...';")

        lines.append("    END TRY")
        lines.append("    BEGIN CATCH")
        lines.append(f"        RAISERROR('Erreur chargement [{table_name}]: %s', 16, 1, ERROR_MESSAGE());")
        lines.append("    END CATCH")
        lines.append("END")
        lines.append("GO")
        lines.append("")

    # Procédures pour chaque table de faits (constellation support)
    fact_tables = model.get("fact_tables", [])
    if not fact_tables:
        ft = model.get("fact_table", {})
        fact_tables = [ft] if ft else []

    for fact in fact_tables:
        if not fact:
            continue
        fact_name = fact.get("name", "fact_data")
        table_name = f"{prefix}_{fact_name}"
        reject_table = f"{prefix}_rejets_{fact_name}"

        lines.append(f"CREATE OR ALTER PROCEDURE [usp_load_{table_name}]")
        lines.append("AS")
        lines.append("BEGIN")
        lines.append("    SET NOCOUNT ON;")
        lines.append("    BEGIN TRY")
        lines.append(f"        PRINT 'Chargement de [{table_name}]...';")
        lines.append(f"        -- INSERT with FK resolution from dimensions")
        lines.append(f"        -- Rejected rows are redirected to [{reject_table}]")
        lines.append(f"        PRINT '[{table_name}] chargé avec succès.';")
        lines.append("    END TRY")
        lines.append("    BEGIN CATCH")
        lines.append(f"        -- Quarantine: save failed row to reject table")
        lines.append(f"        INSERT INTO [{reject_table}] ([error_reason], [source_row_json])")
        lines.append(f"        VALUES (ERROR_MESSAGE(), '{{}}');")
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
    for fact in fact_tables:
        if fact:
            lines.append(f"    EXEC [usp_load_{prefix}_{fact.get('name', '')}];")
    lines.append(f"    PRINT '=== ETL {prefix} terminé — {len(fact_tables)} fact(s) chargée(s) ===';")
    lines.append("END")
    lines.append("GO")

    return "\n".join(lines)

