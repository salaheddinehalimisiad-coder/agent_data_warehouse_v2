import logging
import traceback

from app_state import AgentState
from nodes.etl_executor import _load_dimension, _build_engine, _test_connection, df_cache_load

logger = logging.getLogger(__name__)

def etl_transformer_node(state: AgentState) -> dict:
    """
    TRANSFORM STEP:
    - Loads dimensions into the DW.
    - Generates Surrogate Keys (SK) mapping.
    - Applies basic cleaning/remediation logic.
    - Uses source_dfs (multi-table) when available, falls back to source_df.
    """
    logger.info("--- [ETL] STEP 2: TRANSFORM ---")
    logical_model = state.get("logical_model", {})
    dw_config    = state.get("dw_connection_config", {})
    session_id   = state.get("session_id", "default")
    user_prefix  = state.get("user_prefix", "dw")
    new_logs     = []

    # Load DataFrames from module-level cache (bypasses LangGraph serialization)
    source_dfs = df_cache_load(session_id)
    source_df  = state.get("source_df") or (next(iter(source_dfs.values())) if source_dfs else None)

    if source_df is None and not source_dfs:
        return {"etl_status": "failed", "etl_error": "No data to transform", "execution_log": ["[Transform] ❌ No data"]}

    try:
        # Connect to target DW (no source type check needed - we only write to DW)
        dw_engine = _build_engine(dw_config)
        _test_connection(dw_engine)

        sk_maps = {}
        dim_metrics = {}
        for dim in logical_model.get("dimension_tables", []):
            dim_name = dim.get("name")
            table_name = f"{user_prefix}_{dim_name}"
            try:
                result = _load_dimension(dw_engine, table_name, dim, source_df, source_dfs=source_dfs or None)
                sk_maps[dim_name] = result["sk_map"]
                dim_metrics[dim_name] = result["metrics"]
                ins = result["metrics"]["inserted"]
                existing = result["metrics"].get("existing", 0)
                if ins == 0 and existing == 0:
                    new_logs.append(f"[Transform] ⚠️ Dimension {dim_name}: 0 rows loaded — check source column mapping")
                else:
                    new_logs.append(f"[Transform] ✅ Dimension {dim_name} processed ({ins} new, {existing} existing SKs)")
            except Exception as dim_err:
                logger.error(f"[Transform] Dim {dim_name} failed: {dim_err}", exc_info=True)
                new_logs.append(f"[Transform] ❌ Dimension {dim_name} error: {dim_err}")
                sk_maps[dim_name] = {}
                dim_metrics[dim_name] = {"inserted": 0, "existing": 0, "updated": 0}

        new_logs.append("[Transform] ✅ Dimensions synchronized & SK maps generated.")
        return {
            "sk_maps": sk_maps,
            "dim_metrics": dim_metrics,
            "etl_status": "success",
            "execution_log": new_logs
        }
    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(f"[Transform] Critical Failure: {error_trace}")
        return {
            "etl_status": "failed",
            "etl_error": f"Transformation failed: {e}\n{error_trace}",
            "execution_log": new_logs + [f"[Transform] ❌ Critical Failure: {e}"]
        }
