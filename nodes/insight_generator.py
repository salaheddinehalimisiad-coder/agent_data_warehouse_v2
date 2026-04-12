# nodes/insight_generator.py — Agent d'Analyse Post-Chargement + Auto-Viz
import logging
import re
import json
from app_state import AgentState
from nodes.llm_factory import get_llm, call_with_retry, extract_text
from langchain_core.prompts import ChatPromptTemplate

logger = logging.getLogger(__name__)

INSIGHT_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """Tu es un Senior Data Business Analyst & Expert en Visualisation. 
Ton rôle est de fournir un résumé stratégique et un plan de dashboard après la création d'un Data Warehouse.
    
## Entrées :
- Modèle Logique (Tables de faits et dimensions).
- Métriques de chargement (Lignes insérées, erreurs).

## Ton objectif :
1. Expliquer la valeur métier (Quelles questions peut-on poser ?).
2. Suggérer 3 requêtes SQL analytiques.
3. Concevoir 2-3 visualisations stratégiques (titre, type: bar/line/pie, sql).

## Format de sortie :
### 🎯 Business Value
[Texte]

### 🔍 Requêtes suggérées
- **[Titre]**: ```sql ... ```

### 🏥 Diagnostic
[Verdict court]

### 📊 Visualizations
[JSON_START]
[
  {{"title": "Evolution des Ventes", "type": "line", "sql": "SELECT ... "}},
  {{"title": "Top 5 Produits", "type": "bar", "sql": "SELECT ... "}}
]
[JSON_END]

Important: Le SQL dans le JSON doit être valide et utiliser le préfixe de table correct.
"""),
    ("human", """Modèle : {logical_model}
Métriques du run : {load_metrics}
Génère le résumé et les visualisations.""")
])

def insight_generator_node(state: AgentState) -> dict:
    logger.info("--- AGENT INSIGHT GENERATOR : Synthèse Stratégique & Dashboarding ---")
    
    logical_model = state.get("logical_model", {})
    load_metrics = state.get("load_metrics", {})
    user_prefix  = state.get("user_prefix", "dw")
    
    if not logical_model or not load_metrics:
        return {"execution_log": state.get("execution_log", []) + ["[Insight] SKIP — données insuffisantes"]}

    llm = get_llm(temperature=0)
    chain = INSIGHT_PROMPT | llm
    
    try:
        response = call_with_retry(chain, {
            "logical_model": str(logical_model),
            "load_metrics": str(load_metrics)
        })
        full_text = extract_text(response).strip()
        
        # Extraire JSON
        viz_data = []
        json_match = re.search(r"\[JSON_START\](.*?)\[JSON_END\]", full_text, re.DOTALL)
        if json_match:
            try:
                viz_raw = json_match.group(1).strip()
                # Remplacer les préfixes si nécessaire (l'IA devrait le faire mais au cas où)
                viz_data = json.loads(viz_raw)
            except Exception as je:
                logger.warning(f"JSON viz error: {je}")
        
        # Nettoyer le résumé
        summary = re.sub(r"### 📊 Visualizations.*", "", full_text, flags=re.DOTALL).strip()
        
        # Exécuter les requêtes de viz
        from nodes.etl_executor import _build_engine
        import pandas as pd
        dw_config = state.get("dw_connection_config", {})
        
        if dw_config and viz_data:
            try:
                engine = _build_engine(dw_config)
                for viz in viz_data:
                    try:
                        sql = viz.get('sql', '')
                        if sql:
                            with engine.connect() as conn:
                                df = pd.read_sql(sql, conn)
                                viz['data'] = df.to_dict(orient="records")
                    except Exception as ve:
                        viz['error'] = str(ve)
            except Exception as ee:
                logger.error(f"Engine creation failed for viz: {ee}")

    except Exception as e:
        logger.error(f"[Insight] Erreur LLM : {e}")
        summary = "Erreur de génération des insights."
        viz_data = []

    return {
        "execution_log": state.get("execution_log", []) + ["[Insight] ✅ Dashboard stratégique prêt"],
        "executive_summary": summary,
        "visualizations": viz_data
    }
