# nodes/etl_extractor.py — Step 1: Extract (multi-table support v2)
import logging
import pandas as pd
from pathlib import Path
from typing import Dict, Any
from app_state import AgentState
from nodes.etl_executor import _read_source, _build_engine, df_cache_store

logger = logging.getLogger(__name__)


def _read_all_sql_tables(source_config: dict, dw_config: dict) -> Dict[str, pd.DataFrame]:
    """
    Lit TOUTES les tables d'une source SQL (bak/sqlserver/mysql/postgres/sqlite).
    Retourne {table_name: DataFrame}.
    """
    from sqlalchemy import create_engine, inspect, text

    source_type = source_config.get("type", "sqlserver").lower()

    # Résoudre la config de connexion
    if source_type == "bak":
        if not dw_config:
            raise ValueError("DW config missing for 'bak' source type")
        cfg = dw_config.copy()
        # FIX: Ensure restored_db is not empty - validate before proceeding
        restored_db = source_config.get("restored_db") or dw_config.get("database")
        if not restored_db:
            raise ValueError("restored_db is required for .bak source type - database name cannot be empty")
        cfg["database"] = restored_db
        cfg["type"] = "sqlserver"
    else:
        cfg = source_config

    engine = _build_engine(cfg)
    inspector = inspect(engine)

    dfs: Dict[str, pd.DataFrame] = {}
    for table_name in inspector.get_table_names():
        # Skip system tables
        if table_name.startswith("sys") or table_name.startswith("_"):
            continue
        try:
            with engine.connect() as conn:
                df = pd.read_sql_query(f"SELECT * FROM [{table_name}]", conn)
            dfs[table_name] = df
            logger.info(f"[Extract] 📥 {table_name}: {len(df)} rows")
        except Exception as e:
            logger.warning(f"[Extract] ⚠️ Skip {table_name}: {e}")

    return dfs


def etl_extractor_node(state: AgentState) -> dict:
    """
    EXTRACT STEP:
    - Mono-table (CSV, Excel, REST API) → source_df (legacy) + source_dfs
    - Multi-table (bak, sqlserver, mysql, postgres, sqlite) → source_dfs
      with one DataFrame per source table.
    """
    logger.info("--- [ETL] STEP 1: EXTRACT ---")
    source_config = state.get("connection_config", {})
    dw_config = state.get("dw_connection_config", {})
    source_type = source_config.get("type", "csv").lower()
    session_id = state.get("session_id", "default")
    new_logs = []

    multi_table_types = {"bak", "sqlserver", "mssql", "mysql", "postgresql", "postgres", "sqlite"}

    try:
        if source_type in multi_table_types:
            # ── Multi-table: lire TOUTES les tables ───────────────────────────
            source_dfs = _read_all_sql_tables(source_config, dw_config)

            if not source_dfs:
                return {
                    "etl_status": "failed",
                    "etl_error": "No tables could be extracted from the source database",
                    "execution_log": ["[Extract] ❌ No tables extracted"],
                }

            # Legacy compat: source_df = plus grosse table
            biggest_table = max(source_dfs.keys(), key=lambda k: len(source_dfs[k]))
            source_df = source_dfs[biggest_table]

            total_rows = sum(len(df) for df in source_dfs.values())
            new_logs.append(
                f"[Extract] ✅ {len(source_dfs)} table(s) extraite(s), "
                f"{total_rows} lignes au total (principale: {biggest_table}={len(source_df)} rows)"
            )

            # Store DataFrames in module-level cache to avoid LangGraph msgpack serialization
            df_cache_store(session_id, source_dfs)

            return {
                "source_df":   None,   # exclude DataFrame from LangGraph state
                "source_dfs":  {},     # exclude DataFrames from LangGraph state
                "etl_status":  "success",
                "execution_log": new_logs,
            }
        else:
            # ── Mono-table: CSV, Excel, REST API ──────────────────────────────
            source_df = _read_source(source_config, dw_config)
            new_logs.append(f"[Extract] ✅ Data extracted: {len(source_df)} rows captured.")

            # Wrap dans source_dfs pour API uniforme
            table_key = source_config.get("filename", "source_data")
            source_dfs = {table_key: source_df}

            # Store DataFrames in module-level cache to avoid LangGraph msgpack serialization
            df_cache_store(session_id, source_dfs)

            return {
                "source_df":   None,   # exclude DataFrame from LangGraph state
                "source_dfs":  {},     # exclude DataFrames from LangGraph state
                "etl_status":  "success",
                "execution_log": new_logs,
            }

    except Exception as e:
        logger.error(f"[Extract] Failed: {e}")
        return {
            "etl_status": "failed",
            "etl_error": f"Extraction failed: {e}",
            "execution_log": new_logs + [f"[Extract] ❌ Failed: {e}"],
        }
