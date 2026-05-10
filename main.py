# main.py — Orchestration LangGraph v6.0 (Phase 3)
"""
v6.0 — Phase 3 : Nouveaux nœuds :
  - query_generator  : génération + exécution de requêtes OLAP sur le DW
  - cdc_watermark    : détection mode ETL (full_load vs incremental)

v3.0 — Nœuds existants :
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
from nodes.data_quality_agent    import data_quality_agent_node
from nodes.schema_drift_detector import schema_drift_detector_node
from nodes.modeler               import modeler_node
from nodes.critic                import critic_node
from nodes.chat_modifier         import chat_modifier_node
from nodes.etl_tsql_generator    import etl_tsql_generator_node     # ← REMPLACE etl_generator (Pentaho)
from nodes.etl_extractor         import etl_extractor_node
from nodes.etl_transformer       import etl_transformer_node
from nodes.etl_loader            import etl_loader_node
from nodes.etl_initializer       import etl_initializer_node
from nodes.healer                import healer_node
from nodes.lineage_tracker       import lineage_tracker_node
from nodes.insight_generator     import insight_generator_node
from nodes.cataloger             import cataloger_node
from nodes.governance_agent      import governance_agent_node
from nodes.query_generator       import query_generator_node        # P3-02
from nodes.cdc_watermark         import cdc_watermark_node          # P3-05
from nodes.airflow_generator     import airflow_generator_node
from nodes.dbt_generator         import dbt_generator_node
from nodes.mock_generator        import mock_generator_node

logger           = logging.getLogger(__name__)
MAX_RETRIES      = 3
MAX_CRITIC_LOOPS = 4   # anti-boucle infinie critic ↔ chat_modifier


def human_review_node(state: AgentState) -> dict:
    """
    Pause et attend l'approbation explicite de l'utilisateur via /validate endpoint.
    FIX : Force TOUJOURS is_validated à None quand le graphe atteint ce nœud naturellement,
    pour briser les boucles infinies et forcer la pause HITL.
    """
    logger.info("[Human Review] ⏸️ En attente d'approbation utilisateur")
    return {
        "is_validated": None,  # Force la pause
        "hitl_comment": "",
    }


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


def route_after_modeler(state: AgentState) -> str:
    """
    Si le modèle logique est vide/invalide après le modeler,
    le pipeline doit s'arrêter avec une erreur explicite au lieu
    de continuer silencieusement vers governance → critic.
    """
    logical_model = state.get("logical_model", {})
    has_fact = logical_model.get("fact_table") or logical_model.get("fact_tables")
    if not logical_model or not has_fact:
        logger.error(
            f"[Router] ❌ Modeler a produit un modèle VIDE ou sans fact_table/fact_tables — "
            f"arrêt du pipeline. clés={list(logical_model.keys()) if logical_model else 'None'}"
        )
        return "modeling_failed"
    return "governance"


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


def route_after_chat_modifier(state: AgentState) -> str:
    """
    Après chat_modifier : repasser par critic UNIQUEMENT si le modèle est valide.
    Si le modèle est vide/invalide, forcer human_review pour éviter boucle infinie.
    """
    logical_model = state.get("logical_model", {})
    has_fact = logical_model.get("fact_table") or logical_model.get("fact_tables")
    if not logical_model or not has_fact:
        logger.error(
            "[Router] ChatModifier a laissé un modèle VIDE — "
            "forçage vers human_review pour éviter boucle infinie"
        )
        return "human_review"
    logger.info("[Router] ChatModifier → critic (re-validation)")
    return "critic"


def route_after_human_review(state: AgentState) -> str:
    is_validated = state.get("is_validated")
    logger.info(f"[Router] route_after_human_review: is_validated={is_validated}")

    if is_validated:
        logger.info("[Router] Routing to cdc_watermark")
        return "cdc_watermark"

    logger.info("[Router] Routing to chat_modifier")
    return "chat_modifier"


def route_etl_execution(state: AgentState) -> str:
    """
    Routage post-ETL global:
    - succès -> lineage_tracker
    - échec + retries restantes -> healer
    - échec final -> END
    """
    status = state.get("etl_status", "pending")
    retry_count = state.get("retry_count", 0)

    if status == "success":
        return "lineage_tracker"
    if status == "failed" and retry_count < MAX_RETRIES:
        return "healer"
    return END


def route_etl_step_execution(state: AgentState) -> str:
    """
    CORRECTION v2.1 : utilise etl_status (enum explicite).
    NOUVEAU v3 : succès → lineage_tracker avant END.
    """
    status      = state.get("etl_status", "pending")
    retry_count = state.get("retry_count", 0)

    if status == "success":
        return "success"

    if status == "failed":
        if retry_count < MAX_RETRIES:
            logger.warning(f"[Router] ETL échoué — Healer tentative {retry_count + 1}/{MAX_RETRIES}")
            return "failed"
        else:
            logger.critical(f"[Router] ÉCHEC CRITIQUE après {MAX_RETRIES} tentatives.")
            return "critical_failure"

    # Statut inattendu (ex: 'pending' après crash) — traiter comme échec
    logger.warning(
        f"[Router] Statut ETL inattendu: '{status}' — traité comme échec.  "
        "Vérifier l'état du nœud."
    )
    return "failed"


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
    workflow.add_node("governance",           profile_node(governance_agent_node, "governance"))
    workflow.add_node("critic",               profile_node(critic_node, "critic"))
    workflow.add_node("human_review",         human_review_node)
    workflow.add_node("chat_modifier",        profile_node(chat_modifier_node, "chat_modifier"))
    workflow.add_node("cdc_watermark",        profile_node(cdc_watermark_node, "cdc_watermark"))
    workflow.add_node("etl_tsql_generator",   profile_node(etl_tsql_generator_node, "etl_tsql_generator"))
    workflow.add_node("etl_initializer",      profile_node(etl_initializer_node, "etl_initializer"))
    workflow.add_node("etl_extractor",        profile_node(etl_extractor_node, "etl_extractor"))
    workflow.add_node("etl_transformer",      profile_node(etl_transformer_node, "etl_transformer"))
    workflow.add_node("etl_loader",           profile_node(etl_loader_node, "etl_loader"))
    workflow.add_node("healer",               profile_node(healer_node, "healer"))
    workflow.add_node("lineage_tracker",      profile_node(lineage_tracker_node, "lineage_tracker"))
    workflow.add_node("query_generator",      profile_node(query_generator_node, "query_generator"))  # P3-02
    workflow.add_node("insight_generator",    profile_node(insight_generator_node, "insight_generator"))
    workflow.add_node("cataloger",            cataloger_node)
    workflow.add_node("airflow_generator",   profile_node(airflow_generator_node, "airflow_generator"))
    workflow.add_node("dbt_generator",       profile_node(dbt_generator_node, "dbt_generator"))

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

    # Modeler → governance SEULEMENT si le modèle est valide, sinon END
    workflow.add_conditional_edges("modeler", route_after_modeler, {
        "governance":      "critic",   # governance désactivée — aller directement au critic
        "modeling_failed": END,
    })

    # Boucle 1 : Critic → HITL ou Chat Modifier
    workflow.add_conditional_edges("critic", route_after_critic, {
        "human_review":  "human_review",
        "chat_modifier": "chat_modifier",
    })
    # CORRECTION : arête conditionnelle au lieu de 2 arêtes statiques
    # (les 2 arêtes statiques causaient un fan-out → INVALID_CONCURRENT_GRAPH_UPDATE)
    workflow.add_conditional_edges("chat_modifier", route_after_chat_modifier, {
        "critic":        "critic",
        "human_review": "human_review",
    })

    # Boucle 2 : Human Review → CDC Watermark → ETL ou Chat Modifier
    # interrupt_before=["human_review"] gère la pause HITL — pas de self-loop nécessaire
    workflow.add_conditional_edges("human_review", route_after_human_review, {
        "cdc_watermark":  "cdc_watermark",
        "chat_modifier": "chat_modifier",
    })

    # P3-05 : CDC Watermark → ETL T-SQL Generator
    workflow.add_edge("cdc_watermark", "etl_tsql_generator")

    # Phase ETL fractionnée avec vérification d'erreur à chaque étape
    workflow.add_edge("etl_tsql_generator", "etl_initializer")
    
    workflow.add_conditional_edges(
        "etl_initializer",
        route_etl_step_execution,
        {
            "success": "etl_extractor",
            "failed": "healer",
            "critical_failure": END
        }
    )
    
    workflow.add_conditional_edges(
        "etl_extractor",
        route_etl_step_execution,
        {
            "success": "etl_transformer",
            "failed": "healer",
            "critical_failure": END
        }
    )
    
    workflow.add_conditional_edges(
        "etl_transformer",
        route_etl_step_execution,
        {
            "success": "etl_loader",
            "failed": "healer",
            "critical_failure": END
        }
    )
    
    workflow.add_conditional_edges(
        "etl_loader",
        route_etl_step_execution,
        {
            "success": "lineage_tracker",
            "failed": "healer",
            "critical_failure": END
        }
    )

    workflow.add_edge("healer", "etl_initializer")

    # Post-ETL : lineage → query_generator → insight → cataloger → generators → END
    workflow.add_edge("lineage_tracker",  "query_generator")
    workflow.add_edge("query_generator",  "insight_generator")
    workflow.add_edge("insight_generator", "cataloger")
    workflow.add_edge("cataloger",        "airflow_generator")
    workflow.add_edge("airflow_generator", "dbt_generator")
    workflow.add_edge("dbt_generator",     END)

    # Using MemorySaver with serde=None to avoid DataFrame serialization issues
    # The exclude_dataframes reducer in app_state.py handles DataFrame fields
    memory = MemorySaver(serde=None)
    return workflow.compile(
        checkpointer=memory,
        interrupt_before=["human_review"],
    )


# Instance globale
agent_workflow = create_agent_workflow()


def get_thread_state(session_id: str) -> dict:
    """Récupère l'état le plus récent pour un session_id (thread_id)."""
    config = {"configurable": {"thread_id": session_id}}
    state = agent_workflow.get_state(config)
    return state.values if state else {}
