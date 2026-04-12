# nodes/forecaster.py — Agent de Prévision Prédictive
import logging
import json
import pandas as pd
from app_state import AgentState
from nodes.llm_factory import get_llm, call_with_retry, extract_text
from nodes.etl_executor import _build_engine

logger = logging.getLogger(__name__)

def forecaster_node(state: AgentState) -> dict:
    """Analyse les séries temporelles et génère des prévisions simples."""
    logger.info("--- AGENT FORECASTER : Analyse Prédictive ---")
    
    logical_model = state.get("logical_model", {})
    dw_config     = state.get("dw_connection_config", {})
    user_prefix   = state.get("user_prefix", "dw")
    
    if not logical_model or not dw_config:
        return {"execution_log": state.get("execution_log", []) + ["[Forecaster] SKIP — DW non accessible"]}

    fact_table = logical_model.get("fact_table", {})
    fact_name  = fact_table.get("name", "")
    if not fact_name: return {}
    
    full_fact_name = f"{user_prefix}_{fact_name}"
    metric_col = next((c.get("name") for c in fact_table.get("columns", []) if c.get("role") == "metric"), None)
    
    if not metric_col:
        return {"execution_log": state.get("execution_log", []) + ["[Forecaster] SKIP — Aucune métrique détectée"]}

    try:
        engine = _build_engine(dw_config)
        date_tbl = f"{user_prefix}_dim_date"
        query = f"SELECT d.year, d.month, SUM(f.{metric_col}) as val FROM {full_fact_name} f JOIN {date_tbl} d ON f.date_key = d.date_key GROUP BY d.year, d.month ORDER BY d.year, d.month"
        
        with engine.connect() as conn:
            df = pd.read_sql(query, conn)
            
        if len(df) < 3:
            return {"execution_log": state.get("execution_log", []) + ["[Forecaster] SKIP — Historique insuffisant"]}

        data_summary = df.tail(12).to_dict(orient="records")
        llm = get_llm(temperature=0)
        prompt = f"Expert Data: Analyse {data_summary} pour la métrique {metric_col}. Calcule prévision 3 mois. Répond JSON: {{\"predictions\": [{{ \"label\": \"PROJ M1\", \"value\": 123 }}], \"comment\": \"...\"}}"
        
        resp = llm.invoke(prompt)
        pred_json = json.loads(extract_text(resp))
        
        new_viz = {
            "title": f"Projections Neuronales : {metric_col}",
            "type": "line",
            "data": df.tail(6).rename(columns={'val': 'value'}).to_dict(orient="records") + pred_json["predictions"],
            "is_forecast": True,
            "comment": pred_json["comment"]
        }
        
        current_viz = state.get("visualizations", [])
        return {
            "execution_log": state.get("execution_log", []) + ["[Forecaster] ✅ Projections générées"],
            "visualizations": current_viz + [new_viz]
        }
    except Exception as e:
        logger.error(f"[Forecaster] Error: {e}")
        return {"execution_log": state.get("execution_log", []) + [f"[Forecaster] ERROR: {str(e)}"]}
