# nodes/etl_loader.py — Step 3: Load (Multi-Fact / Constellation Support)
import logging
from datetime import datetime, timezone
from app_state import AgentState
from nodes.etl_executor import _load_fact, _build_engine, _persist_metrics

logger = logging.getLogger(__name__)

def etl_loader_node(state: AgentState) -> dict:
    """
    LOAD STEP (v2.0 — Constellation Support):
    - Loops over all fact_tables (multi-fact constellation)
    - Resolves SKs for each fact table
    - Loads data into each final fact table
    - Aggregates and persists load metrics across all facts
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
    dim_metrics  = state.get("load_metrics", {}).get("dimensions", {})
    
    if source_df is None or not sk_maps:
         return {"etl_status": "failed", "etl_error": "Missing data or SK maps", "execution_log": exec_log + ["[Load] ❌ Missing inputs"]}

    # Get fact tables list (constellation) or single fact (backward compat)
    fact_tables = logical_model.get("fact_tables", [])
    if not fact_tables:
        ft = logical_model.get("fact_table", {})
        fact_tables = [ft] if ft else []

    if not fact_tables:
        return {"etl_status": "success", "execution_log": exec_log + ["[Load] ℹ️ No fact table defined"]}

    try:
        dw_engine = _build_engine(dw_config)
        
        all_fact_metrics = {}
        total_inserted = 0
        total_rejected = 0

        for fact in fact_tables:
            fact_name = fact.get("name", "")
            if not fact_name:
                continue
            table_name = f"{user_prefix}_{fact_name}"
            
            metrics = _load_fact(
                dw_engine, table_name, fact, source_df, 
                sk_maps, user_prefix, session_id, clean_action
            )
            all_fact_metrics[fact_name] = metrics
            total_inserted += metrics.get("inserted", 0)
            total_rejected += metrics.get("rejected", 0)
            exec_log.append(
                f"[Load] ✅ {fact_name}: {metrics['inserted']} rows inserted, "
                f"{metrics['rejected']} rejected"
            )
        
        load_metrics = {
            "source_rows": len(source_df),
            "fact": all_fact_metrics.get(fact_tables[0].get("name", ""), {}),  # backward compat
            "facts": all_fact_metrics,  # multi-fact metrics
            "dimensions": dim_metrics,
            "loaded_at": datetime.now(timezone.utc).isoformat(),
            "dw_prefix": user_prefix,
        }
        _persist_metrics(load_metrics, session_id)
        
        exec_log.append(
            f"[Load] 🏁 ETL Complete — {len(fact_tables)} fact(s), "
            f"{total_inserted} total inserted, {total_rejected} total rejected."
        )
        
        is_success = total_inserted > 0 or len(source_df) == 0
        
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
