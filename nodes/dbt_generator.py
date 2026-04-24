# nodes/dbt_generator.py — Agent Générateur dbt (data build tool)
import logging
import json
from app_state import AgentState
from nodes.llm_factory import get_llm, call_with_retry, extract_text

logger = logging.getLogger(__name__)

def dbt_generator_node(state: AgentState) -> dict:
    """
    Génère un projet dbt complet à partir du modèle logique (staging & marts).
    """
    logger.info("--- AGENT DBT GENERATOR : Modélisation Analytics Engineer ---")
    
    logical_model = state.get("logical_model", {})
    user_prefix   = state.get("user_prefix", "dw")
    
    if not logical_model:
        return {"execution_log": state.get("execution_log", []) + ["[dbt] SKIP — Pas de modèle logique pour générer le projet dbt"]}

    llm = get_llm(temperature=0, task_type="code")
    
    prompt = f"""Tu es un Analytics Engineer Expert spécialisé en dbt (data build tool).
Ton objectif est de générer la structure d'un projet dbt complet pour le Data Warehouse spécifié.

## Modèle Logique :
{logical_model}
Préfixe d'utilisateur : {user_prefix}

## Consignes Techniques :
Génère une réponse **strictement JSON** représentant l'arborescence des fichiers du projet dbt.
Le projet doit contenir :
1. `dbt_project.yml` : Configuration de base.
2. `models/staging/schema.yml` : Définition des sources.
3. Des fichiers SQL pour les dimensions (ex: `models/marts/dim_XXX.sql`)
4. Un fichier SQL pour la table de faits (ex: `models/marts/fact_XXX.sql`)

### Format JSON attendu :
{{
  "dbt_project.yml": "name: my_dw_project\\n...",
  "models/staging/schema.yml": "version: 2\\nsources:\\n  - name: source_data\\n...",
  "models/marts/dim_1.sql": "SELECT ...",
  "models/marts/fact_1.sql": "SELECT ..."
}}

Ne renvoie **AUCUN** autre texte que le JSON brut (pas de balises markdown, juste les accolades de début/fin).
"""
    
    try:
        resp = llm.invoke(prompt)
        dbt_json_str = extract_text(resp)
        
        # Nettoyage si markdown
        if "```json" in dbt_json_str:
            dbt_json_str = dbt_json_str.split("```json")[1].split("```")[0].strip()
        elif "```" in dbt_json_str:
            dbt_json_str = dbt_json_str.split("```")[1].split("```")[0].strip()
            
        dbt_project = json.loads(dbt_json_str)
        
        return {
            "execution_log": state.get("execution_log", []) + ["[dbt] ✅ Projet dbt généré avec succès"],
            "dbt_project": dbt_project
        }

    except Exception as e:
        logger.error(f"[dbt Generator] Error: {e}")
        return {"execution_log": state.get("execution_log", []) + [f"[dbt Generator] ERROR: {str(e)}"]}
