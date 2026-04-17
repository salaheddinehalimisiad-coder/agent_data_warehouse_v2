# nodes/healer.py — Agent Réparateur : auto-correction du fichier .ktr
import logging
from app_state import AgentState
from nodes.llm_factory import get_llm, call_with_retry, extract_text
from langchain_core.prompts import ChatPromptTemplate

logger = logging.getLogger(__name__)


HEALER_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """Tu es le système immunitaire neural de l'Agent Data Warehouse. Ton rôle est de diagnostiquer et réparer les échecs du pipeline ETL.

## Ton expertise :
1. **Schéma SQL (DDL)** : Corriger les types incompatibles, ajouter des longueurs (VARCHAR(MAX)), gérer les contraintes.
2. **Qualité des Données** : Identifier les doublons, les valeurs NULL orphelines, ou les erreurs de format (dates invalides).
3. **Mappage Sémantique** : Résoudre les incohérences entre la source et le schéma en étoile.

## Ton rôle :
- Analyser l'erreur fatale produite par l'exécuteur ETL ou le moteur SQL.
- Définir une stratégie de remédiation : 
    a) Modification du schéma SQL DDL.
    b) Action de nettoyage spécifique (Deduplicate, Cast, Trim, IgnoreError).
- Produire le code SQL DDL actualisé ET un résumé technique de l'action.

## Règles strictes :
1. Retourne le SQL DDL complet et corrigé.
2. Pour les erreurs de données (doublons), suggère l'utilisation de 'INSERT IGNORE' ou 'REPLACE'.
3. Ne vide jamais les tables existantes sauf si c'est la seule solution.
4. Format de réponse :
   [SQL_DDL_START]
   ... ton code SQL ...
   [SQL_DDL_END]
   HEAL_SUMMARY: [Explication courte de ce qui a été réparé]
   CLEAN_ACTION: [DEDUPLICATE | CAST_TYPES | IGNORE_REJECTS | NONE]

## Historique des réparations :
{heal_history}
"""),
    ("human", """Code SQL DDL actuel :
{sql_ddl}

Erreur d'exécution :
{etl_error}

Tentative n°{retry_count}.
Produis le code SQL DDL corrigé.""")
])


def healer_node(state: AgentState) -> dict:
    """
    Corrige automatiquement le fichier .ktr en analysant l'erreur d'exécution.
    Conserve un historique des corrections pour éviter les boucles.
    """
    retry_count = state.get("retry_count", 0)
    logger.info(f"--- AGENT HEALER : Correction n°{retry_count} ---")

    sql_ddl = state.get("sql_ddl", "")
    etl_error = state.get("etl_error", "")
    heal_history = state.get("heal_history", [])

    if not sql_ddl or not etl_error:
        return {
            "execution_log": state.get("execution_log", []) + ["[Healer] SKIP — rien à corriger"]
        }

    llm = get_llm(temperature=0.2)
    chain = HEALER_PROMPT | llm

    try:
        response = call_with_retry(chain, {
            "sql_ddl": sql_ddl,
            "etl_error": etl_error,
            "retry_count": retry_count,
            "heal_history": "\n".join(heal_history) if heal_history else "Aucune correction précédente.",
        })
        raw = extract_text(response).strip()
    except Exception as e:
        logger.error(f"[Healer] Erreur LLM : {e}")
        return {
            "execution_log": state.get("execution_log", []) + [f"[Healer] ERREUR LLM : {e}"]
        }

    # Extraction précise via marqueurs
    import re
    heal_summary = ""
    clean_action = "NONE"
    
    summary_match = re.search(r"HEAL_SUMMARY:\s*(.+)", raw)
    if summary_match: heal_summary = summary_match.group(1).strip()
    
    action_match = re.search(r"CLEAN_ACTION:\s*(.+)", raw)
    if action_match: clean_action = action_match.group(1).strip()
    
    sql_match = re.search(r"\[SQL_DDL_START\](.*?)\[SQL_DDL_END\]", raw, re.DOTALL)
    if sql_match:
        sql_part = sql_match.group(1).strip()
    else:
        # Fallback sur l'extraction par triple backticks si les marqueurs échouent
        sql_part = re.sub(r"HEAL_SUMMARY:.+", "", raw, flags=re.DOTALL)
        sql_part = re.sub(r"CLEAN_ACTION:.+", "", sql_part, flags=re.DOTALL).strip()
        sql_part = re.sub(r"^```(?:sql)?\n?", "", sql_part, flags=re.IGNORECASE|re.MULTILINE)
        sql_part = re.sub(r"```$", "", sql_part, flags=re.MULTILINE).strip()

    if not sql_part or "CREATE " not in sql_part.upper():
        logger.warning("[Healer] SQL corrigé invalide — conservation de l'original")
        return {
            "execution_log": state.get("execution_log", []) + [
                f"[Healer] ⚠️ Correction n°{retry_count} échouée (SQL invalide)"
            ]
        }

    updated_heal_history = heal_history + [
        f"Tentative {retry_count} : {heal_summary or etl_error[:100]}"
    ]

    logger.info(f"[Healer] ✅ Correction n°{retry_count} : {heal_summary}")

    return {
        "sql_ddl": sql_part,
        "etl_error": "",
        "etl_status": "pending",
        "retry_count": retry_count + 1,
        "clean_action": clean_action,
        "heal_history": updated_heal_history,
        "execution_log": state.get("execution_log", []) + [
            f"[Healer] 🔧 Correction n°{retry_count} : {heal_summary or 'appliquée'}"
        ],
    }
