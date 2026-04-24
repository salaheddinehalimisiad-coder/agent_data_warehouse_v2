# nodes/etl_extractor.py — Step 1: Extract (multi-table support v2)
import logging
import pandas as pd
from pathlib import Path
from typing import Dict, Any
from app_state import AgentState
from nodes.etl_executor import _read_source, _build_engine

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
        cfg["database"] = source_config.get("restored_db", dw_config.get("database", ""))
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
    exec_log = state.get("execution_log", [])

    multi_table_types = {"bak", "sqlserver", "mssql", "mysql", "postgresql", "postgres", "sqlite"}

    try:
        if source_type in multi_table_types:
            # ── Multi-table: lire TOUTES les tables ───────────────────────────
            source_dfs = _read_all_sql_tables(source_config, dw_config)

            if not source_dfs:
                return {
                    "etl_status": "failed",
                    "etl_error": "No tables could be extracted from the source database",
                    "execution_log": exec_log + ["[Extract] ❌ No tables extracted"],
                }

            # Legacy compat: source_df = plus grosse table
            biggest_table = max(source_dfs.keys(), key=lambda k: len(source_dfs[k]))
            source_df = source_dfs[biggest_table]

            total_rows = sum(len(df) for df in source_dfs.values())
            exec_log.append(
                f"[Extract] ✅ {len(source_dfs)} table(s) extraite(s), "
                f"{total_rows} lignes au total (principale: {biggest_table}={len(source_df)} rows)"
            )

            return {
                "source_df": source_df,
                "source_dfs": source_dfs,
                "etl_status": "success",
                "execution_log": exec_log,
            }
        else:
            # ── Mono-table: CSV, Excel, REST API ──────────────────────────────
            source_df = _read_source(source_config, dw_config)
            exec_log.append(f"[Extract] ✅ Data extracted: {len(source_df)} rows captured.")

            # Wrap dans source_dfs pour API uniforme
            table_key = source_config.get("filename", "source_data")
            source_dfs = {table_key: source_df}

            return {
                "source_df": source_df,
                "source_dfs": source_dfs,
                "etl_status": "success",
                "execution_log": exec_log,
            }

    except Exception as e:
        logger.error(f"[Extract] Failed: {e}")
        return {
            "etl_status": "failed",
            "etl_error": f"Extraction failed: {e}",
            "execution_log": exec_log + [f"[Extract] ❌ Failed: {e}"],
        }
