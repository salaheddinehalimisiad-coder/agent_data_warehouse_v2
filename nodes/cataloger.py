# nodes/cataloger.py — Agent de Documentation Automatique (Data Catalog)
import logging
import json
from app_state import AgentState
from nodes.llm_factory import get_llm, call_with_retry, extract_text

logger = logging.getLogger(__name__)

def cataloger_node(state: AgentState) -> dict:
    """Génère un catalogue détaillé avec descriptions IA pour chaque table/colonne."""
    logger.info("--- AGENT CATALOGER : Indexation Sémantique ---")
    
    logical_model = state.get("logical_model", {})
    if not logical_model:
        return {"execution_log": state.get("execution_log", []) + ["[Cataloger] SKIP — Pas de modèle"]}

    try:
        llm = get_llm(temperature=0)
        
        prompt = f"""Tu es un Data Steward. Ta tâche est de documenter ce Data Warehouse.
        Modèle: {logical_model}
        
        Génère une description courte (1 phrase) pour chaque table et chaque colonne.
        Réponds UNIQUEMENT en JSON sous ce format:
        {{
          "tables": [
            {{
              "name": "dim_xxx",
              "description": "...",
              "columns": [{{ "name": "...", "description": "..." }}]
            }}
          ]
        }}
        """
        
        resp = llm.invoke(prompt)
        catalog = json.loads(extract_text(resp))
        
        return {
            "execution_log": state.get("execution_log", []) + ["[Cataloger] ✅ Catalogue indexé"],
            "data_catalog": catalog
        }

    except Exception as e:
        logger.error(f"[Cataloger] Error: {e}")
        return {"execution_log": state.get("execution_log", []) + [f"[Cataloger] ERROR: {str(e)}"]}
