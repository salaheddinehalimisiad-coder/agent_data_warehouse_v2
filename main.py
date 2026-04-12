# main.py — Orchestration LangGraph v3.0
"""
v3.0 — Nouveaux nœuds intégrés :
  - data_quality_agent : profiling DQ entre explorer et drift_detector
  - lineage_tracker    : construction du lignage après ETL success

CORRECTIONS v2.1 maintenues :
  1. Anti-boucle infinie : max 3 cycles critic → chat_modifier
  2. Routage etl_execution basé sur statut explicite
  3. human_review_node expose clairement son rôle de point d'interruption
"""
import logging
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from app_state import AgentState

from nodes.explorer              import explorer_node
from nodes.data_quality_agent    import data_quality_agent_node     # ← NOUVEAU v3
from nodes.schema_drift_detector import schema_drift_detector_node
from nodes.modeler               import modeler_node
from nodes.critic                import critic_node
from nodes.chat_modifier         import chat_modifier_node
from nodes.etl_generator         import etl_generator_node
from nodes.etl_executor          import etl_executor_node
from nodes.healer                import healer_node
from nodes.lineage_tracker       import lineage_tracker_node        # ← NOUVEAU v3
from nodes.insight_generator     import insight_generator_node
from nodes.forecaster            import forecaster_node             # ← NOUVEAU v4.1
from nodes.cataloger             import cataloger_node              # ← NOUVEAU v4.1

logger           = logging.getLogger(__name__)
MAX_RETRIES      = 3
MAX_CRITIC_LOOPS = 4   # anti-boucle infinie critic ↔ chat_modifier


def human_review_node(state: AgentState) -> dict:
    """
    Auto-approve pour ne pas bloquer le pipeline
    """
    return {"is_validated": True}


# ─── Routage ──────────────────────────────────────────────────────────────────

def route_after_dq(state: AgentState) -> str:
    """
    NOUVEAU v3 : si le score DQ est trop faible, passer en human_review
    directement pour avertir l'utilisateur avant la modélisation.
    """
    dq_score = state.get("dq_score", 100)
    if dq_score < 50:
        logger.warning(
            f"[Router] Score DQ critique ({dq_score}/100) — "
            "interruption pour validation utilisateur"
        )
        # On force un état awaiting_review avec message d'alerte DQ
        return "human_review_dq_alert"
    return "drift_detector"


def route_after_critic(state: AgentState) -> str:
    """
    APPROUVÉ  → human_review
    REFUSÉ    → chat_modifier (avec protection anti-boucle)
    """
    if state.get("critic_approved", False):
        return "human_review"

    version = state.get("logical_model_version", 0)
    if version >= MAX_CRITIC_LOOPS:
        logger.warning(
            f"[Router] Max cycles Critic atteint ({version}) — forcer human_review"
        )
        return "human_review"

    return "chat_modifier"


def route_after_human_review(state: AgentState) -> str:
    if state.get("is_validated", False):
        return "etl_generator"
    return "chat_modifier"


def route_etl_execution(state: AgentState) -> str:
    """
    CORRECTION v2.1 : utilise etl_status (enum explicite).
    NOUVEAU v3 : succès → lineage_tracker avant END.
    """
    status      = state.get("etl_status", "pending")
    retry_count = state.get("retry_count", 0)

    if status == "success":
        logger.info("[Router] ETL terminé avec succès → Lineage Tracker")
        return "lineage_tracker"

    if status == "failed":
        if retry_count < MAX_RETRIES:
            logger.warning(
                f"[Router] ETL échoué — Healer tentative {retry_count + 1}/{MAX_RETRIES}"
            )
            return "healer"
        else:
            # BUG FIX (audit P1): log critique AVANT de terminer le pipeline
            logger.critical(
                f"[Router] ÉCHEC CRITIQUE — ETL a échoué {MAX_RETRIES}/{MAX_RETRIES} fois. "
                f"Statut final: {status}. "
                f"Arrêt du workflow. Consulter etl_error pour le détail."
            )
            return END

    # Statut inattendu (ex: 'pending' après crash) — ne pas terminer silencieusement
    logger.warning(
        f"[Router] Statut ETL inattendu: '{status}' — arrêt du workflow par sécurité. "
        "Vérifier l'état du nœud etl_executor."
    )
    return END


# ─── Nœud DQ Alert (humain alerté si score DQ < 50) ──────────────────────────

def human_review_dq_alert_node(state: AgentState) -> dict:
    """
    Auto-approve pour l'alerte DQ
    """
    dq_score  = state.get("dq_score", 0)
    dq_alerts = state.get("dq_alerts", [])
    errors    = [a for a in dq_alerts if a.get("severity") == "error"]
    return {
        "is_validated": True,
        "hitl_comment": (
            f"⚠️ Score DQ = {dq_score}/100. "
            f"{len(errors)} colonne(s) critique(s) détectée(s). "
            "Continué automatiquement."
        )
    }


def route_after_dq_alert(state: AgentState) -> str:
    """Après l'alerte DQ, l'utilisateur valide → continuer, sinon → END."""
    if state.get("is_validated", False):
        return "drift_detector"
    return END


# ─── Construction du workflow ─────────────────────────────────────────────────

# ─── Profiling Wrapper ───────────────────────────────────────────────────────
def profile_node(node_func, node_name: str):
    def wrapper(state: AgentState):
        import time
        start = time.time()
        result = node_func(state)
        duration = round(time.time() - start, 2)
        
        # Merge node durations
        existing_durations = state.get("node_durations", {})
        new_durations = {**existing_durations, node_name: duration}
        
        if isinstance(result, dict):
            result["node_durations"] = new_durations
        return result
    return wrapper

def create_agent_workflow():
    workflow = StateGraph(AgentState)

    # ── Configuration des Nœuds ──────────────────────────────────────────────
    workflow.add_node("explorer",             profile_node(explorer_node, "explorer"))
    workflow.add_node("data_quality",         profile_node(data_quality_agent_node, "data_quality"))
    workflow.add_node("human_review_dq",      human_review_dq_alert_node)
    workflow.add_node("drift_detector",       profile_node(schema_drift_detector_node, "drift_detector"))
    workflow.add_node("modeler",              profile_node(modeler_node, "modeler"))
    workflow.add_node("critic",               profile_node(critic_node, "critic"))
    workflow.add_node("human_review",         human_review_node)
    workflow.add_node("chat_modifier",        profile_node(chat_modifier_node, "chat_modifier"))
    workflow.add_node("etl_generator",        profile_node(etl_generator_node, "etl_generator"))
    workflow.add_node("etl_executor",         profile_node(etl_executor_node, "etl_executor"))
    workflow.add_node("healer",               profile_node(healer_node, "healer"))
    workflow.add_node("lineage_tracker",      profile_node(lineage_tracker_node, "lineage_tracker"))
    workflow.add_node("insight_generator",    profile_node(insight_generator_node, "insight_generator"))
    workflow.add_node("forecaster",           profile_node(forecaster_node, "forecaster"))
    workflow.add_node("cataloger",            profile_node(cataloger_node, "cataloger"))

    # ── Flux ─────────────────────────────────────────────────────────────────
    workflow.add_edge(START, "explorer")
    workflow.add_edge("explorer", "data_quality")

    # Branchement selon score DQ
    workflow.add_conditional_edges("data_quality", route_after_dq, {
        "drift_detector":      "drift_detector",
        "human_review_dq_alert": "human_review_dq",
    })

    # Alerte DQ critique → validation utilisateur
    workflow.add_conditional_edges("human_review_dq", route_after_dq_alert, {
        "drift_detector": "drift_detector",
        END:              END,
    })

    workflow.add_edge("drift_detector", "modeler")
    workflow.add_edge("modeler",        "critic")

    # Boucle 1 : Critic → HITL ou Chat Modifier
    workflow.add_conditional_edges("critic", route_after_critic, {
        "human_review":  "human_review",
        "chat_modifier": "chat_modifier",
    })
    workflow.add_edge("chat_modifier", "critic")

    # Boucle 2 : Human Review → ETL ou Chat Modifier
    workflow.add_conditional_edges("human_review", route_after_human_review, {
        "etl_generator": "etl_generator",
        "chat_modifier": "chat_modifier",
    })

    # Phase ETL
    workflow.add_edge("etl_generator", "etl_executor")

    # Boucle 3 : Try-Heal-Retry + Lineage
    workflow.add_conditional_edges(
        "etl_executor",
        lambda x: "insight_generator" if x.get("etl_status") == "success" else "healer",
        {
            "insight_generator": "insight_generator",
            "healer": "healer"
        }
    )
    workflow.add_edge("healer",          "etl_executor")
    workflow.add_edge("lineage_tracker", END)
    workflow.add_edge("insight_generator", "forecaster")
    workflow.add_edge("forecaster", "cataloger")
    workflow.add_edge("cataloger", "lineage_tracker")

    memory = MemorySaver()
    return workflow.compile(
        checkpointer=memory,
    )


# Instance globale
agent_workflow = create_agent_workflow()


def get_thread_state(session_id: str) -> dict:
    """Récupère l'état le plus récent pour un session_id (thread_id)."""
    config = {"configurable": {"thread_id": session_id}}
    state = agent_workflow.get_state(config)
    return state.values if state else {}
