# nodes/etl_initializer.py — Professional ETL Initializer v4.2 (TDS-safe)
"""
INITIALIZER v4.2 :
- Utilise la nouvelle connexion TDS-safe de etl_executor._build_engine
- Exécute le DDL en AUTOCOMMIT (via _execute_ddl patché)
- **Vérification active** post-DDL : compte les tables réellement créées
  avec le préfixe de l'utilisateur → plus de 'success' fantôme.
- Logs enrichis avec serveur résolu, base cible, tables visibles.
"""
import logging
import traceback

from app_state import AgentState
from nodes.etl_executor import (
    _build_engine,
    _execute_ddl,
    _test_connection,
    _verify_tables_created,
)
from nodes.etl_loader import _save_session_to_disk

logger = logging.getLogger(__name__)


def etl_initializer_node(state: AgentState) -> dict:
    """
    INITIALIZER STEP :
      1. Vérifie la connectivité DW (handshake TDS réel).
      2. Exécute le DDL en AUTOCOMMIT.
      3. Vérifie que les tables physiques sont bien créées.
      4. Prépare l'environnement d'exécution.
    """
    logger.info("--- [ETL] PHASE 0 : INITIALIZER (v4.2 TDS-safe) ---")

    dw_config = state.get("dw_connection_config", {})
    sql_ddl   = state.get("sql_ddl", "")
    user_prefix = state.get("user_prefix", "dw")

    if not sql_ddl:
        return {
            "etl_status": "failed",
            "etl_error": "No SQL DDL available",
            "execution_log": ["[ETL INITIALIZER] ❌ No DDL"]
        }

    new_logs = []
    try:
        # 1. Test connexion DW
        engine = _build_engine(dw_config)
        _test_connection(engine)
        new_logs.append("[ETL INITIALIZER] ✅ DW connection verified")

        # 2. Exécuter le DDL en AUTOCOMMIT
        ddl_err = _execute_ddl(engine, sql_ddl)
        if ddl_err:
            return {
                "etl_status": "failed",
                "etl_error": f"DDL execution error: {ddl_err}",
                "execution_log": new_logs + [f"[ETL INITIALIZER] ❌ DDL error: {ddl_err[:200]}"]
            }
        new_logs.append("[ETL INITIALIZER] ✅ DDL executed")

        # 3. Vérifier que les tables sont créées
        n_tables, table_names = _verify_tables_created(engine, user_prefix)
        if not n_tables:
            return {
                "etl_status": "failed",
                "etl_error": "No tables created after DDL execution",
                "execution_log": new_logs + ["[ETL INITIALIZER] ❌ No tables created"]
            }

        new_logs.append(f"[ETL INITIALIZER] ✅ {n_tables} tables created: {', '.join(table_names)}")

        # Persist model to disk immediately so OLAP can read it without waiting for ETL load
        session_id    = state.get("session_id", "unknown")
        logical_model = state.get("logical_model", {})
        _save_session_to_disk(session_id, logical_model, user_prefix, dw_config)
        new_logs.append("[ETL INITIALIZER] ✅ Modèle persisté sur disque (OLAP ready)")

        return {
            "etl_status": "success",
            "etl_error": None,
            "execution_log": new_logs,
        }
    except Exception as e:
        logger.error(f"[ETL INITIALIZER] Error: {e}", exc_info=True)
        return {
            "etl_status": "failed",
            "etl_error": str(e),
            "execution_log": new_logs + [f"[ETL INITIALIZER] ❌ Error: {e}"]
        }
