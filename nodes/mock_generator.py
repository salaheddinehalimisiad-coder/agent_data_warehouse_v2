# nodes/mock_generator.py — Agent de Synthétisation de Données (Mock Data Generator)
import logging
from app_state import AgentState
from nodes.llm_factory import get_llm, call_with_retry, extract_text

logger = logging.getLogger(__name__)

def mock_generator_node(state: AgentState) -> dict:
    """
    Génère un script SQL contenant des données factices (Mock Data) 
    pour tester les dimensions et les tables de faits sans dépendre de l'ETL réel.
    """
    logger.info("--- AGENT SYNTHESIZER : Génération de Mock Data ---")
    
    logical_model = state.get("logical_model", {})
    if not logical_model:
        return {"execution_log": ["[Synthesizer] ⚠️ SKIP — Modèle logique manquant"]}

    llm = get_llm(temperature=0.7, task_type="code") # Température plus haute pour de la donnée créative/variée
    
    prompt = f"""Tu es un Data Engineer Expert en Test et Qualité de données.
Ta mission est de générer un script d'insertion SQL de données factices (Mock Data) hyper réalistes basées sur le Star Schema fourni.

## Modèle Logique :
{logical_model}

## Instructions :
1. Génère 5 lignes \`INSERT INTO\` hyper-réalistes pour chaque table de dimension.
2. Génère 5 lignes \`INSERT INTO\` hyper-réalistes pour la table de faits.
3. Assure-toi que les clés étrangères (Foreign Keys) de la table de faits correspondent bien aux clés primaires générées dans les dimensions.
4. N'inclus PAS la création des tables, uniquement les \`INSERT\`.
5. Renvoie UNIQUEMENT le bloc de code SQL, sans explication.
"""
    
    try:
        resp = llm.invoke(prompt)
        mock_sql = extract_text(resp)
        
        # Nettoyage si entouré de markdown
        if "```sql" in mock_sql:
            mock_sql = mock_sql.split("```sql")[1].split("```")[0].strip()
        elif "```" in mock_sql:
            mock_sql = mock_sql.split("```")[1].split("```")[0].strip()
            
        return {
            "execution_log": ["[Synthesizer] ✅ Données factices générées avec succès (Seed Data)"],
            "mock_data_sql": mock_sql
        }

    except Exception as e:
        logger.error(f"[Synthesizer] Error: {e}")
        return {"execution_log": [f"[Synthesizer] ⚠️ Erreur de génération: {str(e)}"]}
