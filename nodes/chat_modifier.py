# nodes/chat_modifier.py — Agent Chat Modifier CORRIGÉ v2.1
import json
import logging
import re
from app_state import AgentState
from nodes.llm_factory import get_llm, call_with_retry, extract_text
from nodes.modeler import _generate_ddl, _parse_json
from langchain_core.prompts import ChatPromptTemplate

logger = logging.getLogger(__name__)

CHAT_MODIFIER_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """Tu es un Expert Data Architect spécialisé en modélisation OLAP Kimball.
L'utilisateur veut modifier le schéma Star Schema via une instruction en langage naturel.

Modèle OLAP actuel (version {model_version}) :
{current_model}

DDL SQL actuel :
{current_ddl}

Rapport Critic :
{critic_review}

Historique de conversation :
{chat_history}

## Instructions STRICTES :
- Applique UNIQUEMENT la modification demandée
- Retourne le JSON COMPLET du nouveau modèle (même structure que l'original)
- Ajoute obligatoirement `fact_table` et `dimension_tables` dans le JSON
- Le JSON doit être valide, sans balises markdown
- Termine par : CHANGE_SUMMARY: [ce qui a changé en une phrase courte]
- Si la demande concerne un ajout de colonne, spécifie le bon `role` (pk/fk/metric/attribute)
- Si la demande est vague, interprète-la intelligemment selon le contexte OLAP
- Explique brièvement ton choix dans le CHANGE_SUMMARY
"""),
    ("human", "Modification demandée : {user_request}")
])


def _extract_user_request(state: AgentState) -> str:
    for msg in reversed(state.get("messages", [])):
        content = None
        if hasattr(msg, "type") and msg.type == "human":
            content = msg.content
        elif isinstance(msg, dict) and msg.get("role") in ("human", "user"):
            content = msg.get("content", "")
        if content and content.strip():
            return content.strip()

    hitl = state.get("hitl_comment", "").strip()
    if hitl:
        return hitl

    critic = state.get("critic_review", "")
    if critic and "NEEDS_REVISION" in critic.upper():
        return "Applique toutes les corrections recommandées par le Critic."
    return ""


def chat_modifier_node(state: AgentState) -> dict:
    logger.info("--- AGENT CHAT MODIFIER ---")

    user_request = _extract_user_request(state)

    # Smart fallback : si vague, utiliser les recommandations du Critic
    if not user_request:
        critic = state.get("critic_review", "")
        if critic and "NEEDS_REVISION" in critic.upper():
            user_request = "Applique toutes les corrections recommandées par le Critic."
        else:
            return {"execution_log": ["[ChatModifier] SKIP — aucune demande"]}

    current_model = state.get("logical_model", {})
    current_ddl = state.get("sql_ddl", "")

    if not current_model or not current_ddl:
        return {"execution_log": ["[ChatModifier] SKIP — modèle absent"]}

    # Construire l'historique de conversation pour le contexte
    messages = state.get("messages", [])
    chat_history_lines = []
    for m in messages[-10:]:
        if isinstance(m, dict):
            role = m.get("role", "user")
            content = m.get("content", "")[:200]
        elif hasattr(m, "type"):
            role = "user" if m.type == "human" else "assistant"
            content = (m.content or "")[:200]
        else:
            continue
        chat_history_lines.append(f"{role.upper()}: {content}")
    chat_history = "\n".join(chat_history_lines) if chat_history_lines else "Aucun historique."

    llm = get_llm(temperature=0.2, task_type="code")
    chain = CHAT_MODIFIER_PROMPT | llm

    try:
        response = call_with_retry(chain, {
            "current_model": json.dumps(current_model, indent=2, default=str),
            "current_ddl": current_ddl,
            "critic_review": state.get("critic_review", "Aucune critique."),
            "user_request": user_request,
            "model_version": state.get("logical_model_version", 0),
            "chat_history": chat_history,
        }, max_retries=3)
        raw = extract_text(response)
    except Exception as e:
        logger.error(f"[ChatModifier] ERREUR Blaze : {e}")
        ver = state.get("logical_model_version", 0)
        return {
            "logical_model_version": ver + 1,  # incrémente pour que route_after_critic atteigne MAX_CRITIC_LOOPS
            "execution_log": [f"[ChatModifier] ERREUR LLM : {str(e)[:100]} — SKIP (v{ver+1})"],
        }

    change_summary = ""
    sm = re.search(r"CHANGE_SUMMARY:\s*(.+)", raw)
    if sm:
        change_summary = sm.group(1).strip()

    json_part = re.sub(r"CHANGE_SUMMARY:.+", "", raw, flags=re.DOTALL).strip()
    new_model = _parse_json(json_part)

    if not new_model or (not new_model.get("fact_tables") and not new_model.get("fact_table")):
        return {"execution_log": ["[ChatModifier] ⚠️ JSON invalide — inchangé"]}

    previous_ddl = current_ddl
    new_ddl = _generate_ddl(new_model, state.get("user_prefix", "dw"))
    ver = state.get("logical_model_version", 0)

    logger.info(f"[ChatModifier] v{ver+1} : {change_summary or user_request[:60]}")

    return {
        "logical_model": new_model,
        "logical_model_version": ver + 1,
        "previous_sql_ddl": previous_ddl,
        "sql_ddl": new_ddl,
        "critic_approved": False,
        # FIX v3.2 — is_validated=None (pas False!) pour éviter boucle infinie
        # False provoque route_after_human_review → chat_modifier (boucle infinie)
        # None = en attente de validation utilisateur (pause HITL correcte)
        "is_validated": None,
        "execution_log": [f"[ChatModifier] v{ver+1} : {change_summary or user_request[:60]}"],
    }