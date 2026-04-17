# nodes/etl_initializer.py — Professional ETL Initializer
import logging
from app_state import AgentState
from nodes.etl_executor import _build_engine, _execute_ddl, _test_connection
import traceback

logger = logging.getLogger(__name__)

def etl_initializer_node(state: AgentState) -> dict:
    """
    INITIALIZER STEP:
    - Verifies DW connectivity.
    - Executes the SQL DDL to ensure tables exist.
    - Prepares the execution environment.
    """
    logger.info("--- [ETL] PHASE 0: INITIALIZER ---")
    sql_ddl      = state.get("sql_ddl", "")
    dw_config    = state.get("dw_connection_config", {})
    exec_log     = state.get("execution_log", [])
    user_prefix  = state.get("user_prefix", "dw")
    
    if not sql_ddl:
        return {
            "etl_status": "failed", 
            "etl_error": "Missing SQL DDL for initialization", 
            "execution_log": exec_log + ["[Initializer] ❌ Missing DDL"]
        }

    if not dw_config or not dw_config.get("host"):
         exec_log.append("[Initializer] ⚠️ No DW config found. Proceeding in export-only mode.")
         return {
             "etl_status": "pending",
             "execution_log": exec_log
         }

    try:
        # 1. Connect
        dw_engine = _build_engine(dw_config)
        _test_connection(dw_engine)
        exec_log.append("[Initializer] ✅ DW Connection established.")
        
        # 2. Execute DDL
        logger.info("[Initializer] Applying DDL schema...")
        ddl_error = _execute_ddl(dw_engine, sql_ddl)
        if ddl_error:
             return {
                 "etl_status": "failed",
                 "etl_error": f"DDL Execution failed: {ddl_error}",
                 "execution_log": exec_log + [f"[Initializer] ❌ DDL Error: {ddl_error[:100]}"]
             }
        
        exec_log.append(f"[Initializer] ✅ Schema verified/created in DW (prefix: {user_prefix})")
        
        return {
            "etl_status": "pending",
            "execution_log": exec_log
        }
    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(f"[Initializer] Critical Failure: {error_trace}")
        return {
            "etl_status": "failed",
            "etl_error": f"Initialization failed: {e}\n{error_trace}",
            "execution_log": exec_log + [f"[Initializer] ❌ Critical Failure: {e}"]
        }
