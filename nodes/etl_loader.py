# nodes/etl_loader.py — Step 3: Load
import logging
from datetime import datetime, timezone
from app_state import AgentState
from nodes.etl_executor import _load_fact, _build_engine, _persist_metrics

logger = logging.getLogger(__name__)

def etl_loader_node(state: AgentState) -> dict:
    """
    LOAD STEP:
    - Resolves SKs for the fact table.
    - Loads data into the final fact table.
    - Persists load metrics.
    """
    logger.info("--- [ETL] STEP 3: LOAD ---")
    logical_model = state.get("logical_model", {})
    dw_config    = state.get("dw_connection_config", {})
    source_df    = state.get("source_df")
    sk_maps      = state.get("sk_maps", {})
    user_prefix  = state.get("user_prefix", "dw")
    session_id   = state.get("session_id", "unknown")
    exec_log     = state.get("execution_log", [])
    clean_action = state.get("clean_action", "NONE")
    
    if source_df is None or not sk_maps:
         return {"etl_status": "failed", "etl_error": "Missing data or SK maps", "execution_log": exec_log + ["[Load] ❌ Missing inputs"]}

    try:
        dw_engine = _build_engine(dw_config)
        fact = logical_model.get("fact_table", {})
        if not fact:
             return {"etl_status": "success", "execution_log": exec_log + ["[Load] ℹ️ No fact table defined"]}

        fact_name = fact.get("name")
        table_name = f"{user_prefix}_{fact_name}"
        
        metrics = _load_fact(dw_engine, table_name, fact, source_df, sk_maps, user_prefix, session_id, clean_action)
        
        load_metrics = {
            "source_rows": len(source_df),
            "fact": metrics,
            "loaded_at": datetime.now(timezone.utc).isoformat(),
            "dw_prefix": user_prefix,
        }
        _persist_metrics(load_metrics, session_id)
        
        exec_log.append(f"[Load] ✅ Fact table {fact_name} loaded: {metrics['inserted']} rows.")
        exec_log.append(f"[Load] 🏁 ETL Cycle Complete.")
        
        # SUCCESS si au moins 1 ligne insérée OÙ si la source était vide
        is_success = metrics['inserted'] > 0 or len(source_df) == 0
        
        return {
            "etl_status": "success" if is_success else "failed",
            "etl_error": "" if is_success else "Fact loading failed: 0 rows inserted",
            "load_metrics": load_metrics,
            "execution_log": exec_log
        }
    except Exception as e:
        logger.error(f"[Load] Failed: {e}")
        return {
            "etl_status": "failed",
            "etl_error": f"Loading failed: {e}",
            "execution_log": exec_log + [f"[Load] ❌ Failed: {e}"]
        }
