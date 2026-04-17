# nodes/etl_extractor.py — Step 1: Extract
import logging
import pandas as pd
from pathlib import Path
from typing import Dict, Any
from app_state import AgentState
from nodes.etl_executor import _read_source

logger = logging.getLogger(__name__)

def etl_extractor_node(state: AgentState) -> dict:
    """
    EXTRACT STEP:
    Reads data from the defined source (CSV, SQL, API, etc.)
    and loads it into a pandas DataFrame in the state.
    """
    logger.info("--- [ETL] STEP 1: EXTRACT ---")
    source_config = state.get("connection_config", {})
    exec_log = state.get("execution_log", [])
    
    try:
        source_df = _read_source(source_config)
        exec_log.append(f"[Extract] ✅ Data extracted successfully: {len(source_df)} rows captured.")
        
        # We store the dataframe in the state for the next nodes
        # Note: In a real production system, we might use a staging area or database
        return {
            "source_df": source_df,
            "execution_log": exec_log
        }
    except Exception as e:
        logger.error(f"[Extract] Failed: {e}")
        return {
            "etl_status": "failed",
            "etl_error": f"Extraction failed: {e}",
            "execution_log": exec_log + [f"[Extract] ❌ Failed: {e}"]
        }
