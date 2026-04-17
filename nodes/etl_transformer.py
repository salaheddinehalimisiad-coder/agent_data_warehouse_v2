import logging
import traceback

from app_state import AgentState
from nodes.etl_executor import _load_dimension, _build_engine, _test_connection

logger = logging.getLogger(__name__)

def etl_transformer_node(state: AgentState) -> dict:
    """
    TRANSFORM STEP:
    - Loads dimensions into the DW.
    - Generates Surrogate Keys (SK) mapping.
    - Applies basic cleaning/remediation logic.
    """
    logger.info("--- [ETL] STEP 2: TRANSFORM ---")
    logical_model = state.get("logical_model", {})
    dw_config    = state.get("dw_connection_config", {})
    source_df    = state.get("source_df")
    user_prefix  = state.get("user_prefix", "dw")
    exec_log     = state.get("execution_log", [])
    
    if source_df is None:
        return {"etl_status": "failed", "etl_error": "No data to transform", "execution_log": exec_log + ["[Transform] ❌ No data"]}

    try:
        dw_engine = _build_engine(dw_config)
        _test_connection(dw_engine)
        
        sk_maps = {}
        for dim in logical_model.get("dimension_tables", []):
            dim_name = dim.get("name")
            table_name = f"{user_prefix}_{dim_name}"
            result = _load_dimension(dw_engine, table_name, dim, source_df)
            sk_maps[dim_name] = result["sk_map"]
            exec_log.append(f"[Transform] ✅ Dimension {dim_name} processed ({result['metrics']['inserted']} new SKs)")

        exec_log.append("[Transform] ✅ Dimensions synchronized & SK maps generated.")
        return {
            "sk_maps": sk_maps,
            "execution_log": exec_log
        }
    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(f"[Transform] Critical Failure: {error_trace}")
        return {
            "etl_status": "failed",
            "etl_error": f"Transformation failed: {e}\n{error_trace}",
            "execution_log": exec_log + [f"[Transform] ❌ Critical Failure: {e}"]
        }
