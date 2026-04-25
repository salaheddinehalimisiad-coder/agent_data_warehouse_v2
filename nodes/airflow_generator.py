# nodes/airflow_generator.py — Agent Générateur DAG Airflow
import logging
from app_state import AgentState
from nodes.llm_factory import get_llm, call_with_retry, extract_text

logger = logging.getLogger(__name__)

def airflow_generator_node(state: AgentState) -> dict:
    """
    Génère un DAG Apache Airflow complet et natif pour automatiser le pipeline.
    """
    logger.info("--- AGENT AIRFLOW GENERATOR : Automatisation ETL ---")
    
    logical_model = state.get("logical_model", {})
    source_config = state.get("connection_config", {})
    dw_config     = state.get("dw_connection_config", {})
    user_prefix   = state.get("user_prefix", "dw")
    
    if not logical_model:
        return {"execution_log": ["[Airflow] SKIP — Pas de modèle logique pour générer le DAG"]}

    llm = get_llm(temperature=0, task_type="code")
    
    prompt = f"""Tu es un Data Engineer Expert spécialisé en Apache Airflow.
Ton objectif est de générer un DAG Airflow (`.py`) complètement fonctionnel pour orchestrer le pipeline ETL du Data Warehouse conçu.

## Contexte :
- Préfixe de l'utilisateur : {user_prefix}
- Modèle Logique : {logical_model}
- Configuration Source : {source_config}
- Configuration Data Warehouse : {dw_config}

## Consignes Techniques :
1. Crée un DAG nommé `{user_prefix}_etl_dag` avec `schedule_interval='@daily'`.
2. Utilise `PythonOperator` ou `BashOperator` selon ce qui est le plus adapté, mais la logique doit rester en Python natif de préférence (simulant la lecture et le chargement).
3. Le DAG doit contenir les étapes suivantes :
   - `extract_source` : Lecture des données.
   - `load_dimensions` : Chargement itératif des dimensions (SCD2 ou basique).
   - `load_facts` : Chargement de la table de faits après résolution des SK.
   - `data_quality_check` : Requête SQL pour vérifier que le chargement s'est bien passé.
4. Les tâches doivent être bien séquencées : extract >> load_dimensions >> load_facts >> data_quality_check.
5. Inclus les imports nécessaires (`from airflow import DAG`, `from airflow.operators.python import PythonOperator`, etc.)

Génère **UNIQUEMENT** le code Python du DAG de bout en bout sans aucun autre texte (pas de markdown de début/fin si possible, juste le code pur, ou bien entouré par ```python ... ``` que je nettoierai).
"""
    
    try:
        resp = call_with_retry(llm, prompt)
        dag_code = extract_text(resp)
        # Nettoyage si markdown
        if "```python" in dag_code:
            dag_code = dag_code.split("```python")[1].split("```")[0].strip()
        elif "```" in dag_code:
            dag_code = dag_code.split("```")[1].split("```")[0].strip()
        
        return {
            "execution_log": ["[Airflow] ✅ DAG généré pour automatisation"],
            "airflow_dag": dag_code
        }

    except Exception as e:
        logger.error(f"[Airflow Generator] Error: {e}")
        return {"execution_log": [f"[Airflow Generator] ERROR: {str(e)}"]}
