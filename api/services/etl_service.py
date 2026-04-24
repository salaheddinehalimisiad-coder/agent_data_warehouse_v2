# api/services/etl_service.py — Service d'orchestration v3.0
"""
CORRECTIONS v3.0 :
1. AGENT_LABELS complet (data_quality, human_review_dq, lineage_tracker)
2. State initial inclut tous les champs v3 (dq_report, dq_score, dq_alerts, session_id)
3. human_review_dq géré dans _run_inner → broadcast dq_review_required + pause HITL
4. resume_dq_review() : reprise après validation DQ alert
5. Persistence DB : save_session_state appelé après chaque nœud important
"""
import asyncio
import logging
import json
from typing import Dict
from langchain_core.messages import HumanMessage

logger = logging.getLogger(__name__)

_pipeline_states: Dict[str, dict] = {}
_pipeline_tasks:  Dict[str, asyncio.Task] = {}

AGENT_LABELS = {
    "explorer":         "🔍 Explorer",
    "data_quality":     "📊 Data Quality",
    "human_review_dq":  "⚠️ DQ Alert Review",
    "drift_detector":   "🌊 Drift Detector",
    "modeler":          "🧠 Modeler",
    "critic":           "🛡️ Critic",
    "human_review":     "👤 Human Review",
    "chat_modifier":    "💬 Chat Modifier",
    "governance":       "🛡️ Governance",
    "cdc_watermark":    "💧 CDC Watermark",
    "etl_tsql_generator": "⚙️ ETL Generator",
    "etl_initializer":  "🏗️ ETL Initializer",
    "etl_extractor":    "📥 Extract Step",
    "etl_transformer":  "🔄 Transform Step",
    "etl_loader":       "📤 Load Step",
    "etl_executor":     "🚀 ETL Executor",
    "healer":           "🔧 Healer",
    "lineage_tracker":  "🗺️ Lineage Tracker",
    "query_generator":  "📊 Query Generator",
    "insight_generator":"📊 Insight Gen",
    "forecaster":       "📈 Forecaster",
    "cataloger":        "📚 Cataloger",
    "airflow_generator":"🌪️ Airflow DAG",
    "dbt_generator":    "💎 dbt Project",
    "mock_generator":   "🧪 Synthesizer",
}

# Nœuds après lesquels on persiste en DB
_PERSIST_AFTER = {"modeler", "etl_initializer", "etl_loader", "lineage_tracker", "human_review", "human_review_dq", "cdc_watermark", "etl_tsql_generator", "airflow_generator", "dbt_generator", "mock_generator"}


def get_pipeline_state(session_id: str) -> dict:
    state = _pipeline_states.get(session_id)
    if not state:
        # P3-04 : Restauration depuis la DB si serveur redémarré
        try:
            from api.db.sqlserver import get_session_state
            db_state = get_session_state(session_id)
            if db_state:
                _pipeline_states[session_id] = db_state
                return db_state
        except Exception as e:
            logger.warning(f"[Service] Échec restauration session {session_id} : {e}")
    return state or {}


def update_pipeline_state(session_id: str, state: dict) -> None:
    _pipeline_states[session_id] = state


def _merge(session_id: str, updates: dict) -> dict:
    s = _pipeline_states.get(session_id, {})
    s.update(updates)
    _pipeline_states[session_id] = s
    return s


def _get_wf():
    from main import agent_workflow
    return agent_workflow


def _get_sse():
    from api.services import sse as svc
    return svc


def _safe(data: dict) -> dict:
    """Sérialise les valeurs complexes (numpy, etc.) en types Python standard."""
    import numpy as np
    out = {}
    for k, v in data.items():
        if isinstance(v, (np.integer, np.int64, np.int32, np.int16, np.int8)):
            out[k] = int(v)
        elif isinstance(v, (np.floating, np.float64, np.float32, np.float16)):
            out[k] = float(v)
        elif isinstance(v, np.ndarray):
            out[k] = v.tolist()
        elif isinstance(v, dict):
            out[k] = _safe(v)
        elif isinstance(v, (list, tuple)):
            out[k] = [_safe(item) if isinstance(item, dict) else item for item in v]
        elif hasattr(v, '__dict__'):
            # Handle objects with __dict__ by converting to string
            try:
                json.dumps(v, default=str)
                out[k] = v
            except Exception:
                out[k] = str(v)
        else:
            try:
                json.dumps(v, default=str)
                out[k] = v
            except Exception:
                out[k] = str(v)
    return out


def _persist(session_id: str) -> None:
    """Persiste l'état courant en DB de manière non-bloquante."""
    try:
        from api.db.sqlserver import save_session_state
        state = _pipeline_states.get(session_id, {})
        user_id = state.get("user_id", 1)
        # Exclure les DataFrames (non sérialisables en JSON)
        persistable = {k: v for k, v in state.items()
                       if k not in ("source_df", "source_dfs")}
        save_session_state(session_id, user_id, persistable)
    except Exception as e:
        logger.warning(f"[Persist] Échec sauvegarde {session_id} : {e}")


# ─── Lancement ────────────────────────────────────────────────────────────────

async def run_pipeline(session_id: str, config: dict) -> None:
    """Point d'entrée appelé par FastAPI BackgroundTask.

    FIX v3.2 — on attache un callback `done` à la tâche pour que toute
    exception qui remonterait en dehors du try/except de _run_inner_impl
    soit tracée et rapportée via SSE, au lieu d'être avalée silencieusement.
    """
    existing = _pipeline_tasks.get(session_id)
    if existing and not existing.done():
        existing.cancel()

    task = asyncio.create_task(_run_inner(session_id, config))
    _pipeline_tasks[session_id] = task

    def _observe(t: asyncio.Task) -> None:
        if t.cancelled():
            return
        exc = t.exception()
        if exc is not None:
            logger.exception(f"[Pipeline] Tâche {session_id} a échoué", exc_info=exc)
            try:
                sse = _get_sse()
                sse.log_event(session_id, f"❌ Erreur interne : {exc}", level="error")
                sse.pipeline_complete(session_id, False, {"error": str(exc)})
            except Exception:
                pass

    task.add_done_callback(_observe)


async def _run_inner(session_id: str, config: dict) -> None:
    # PRO #7 : timeout global 60 minutes (augmenté pour les modèles locaux lents)
    try:
        await asyncio.wait_for(_run_inner_impl(session_id, config), timeout=3600)
    except asyncio.TimeoutError:
        sse = _get_sse()
        sse.log_event(session_id, "⏰ Pipeline timeout (60 min) — arrêt forcé", level="error")
        sse.pipeline_complete(session_id, False, {"error": "timeout"})


async def _run_inner_impl(session_id: str, config: dict) -> None:
    wf  = _get_wf()
    sse = _get_sse()
    tc  = {"configurable": {"thread_id": session_id}}

    c_config = config.get("connection_config", {})
    is_bak   = c_config.get("type", "").lower() == "bak"

    initial = {
        "messages": [],
        "connection_config":    c_config,
        "dw_connection_config": config.get("dw_connection_config", {}),
        "user_id":     config.get("user_id", 1),
        "user_prefix": config.get("user_prefix", "dw"),
        "session_id":  session_id,
        # États par défaut
        "is_validated": False, "critic_approved": False,
        "etl_status": "pending", "etl_error": "", "retry_count": 0,
        "heal_history": [], "execution_log": [],
        "schema_drift_detected": False, "schema_drift_details": "",
        "logical_model_version": 0, "previous_sql_ddl": "",
        "sql_ddl": "", "logical_model": {}, "source_metadata": {},
        "schema_fingerprint": "", "critic_review": "", "etl_code": "",
        "source_dfs": {},
        "hitl_comment": "",
        # Champs v3 / v4
        "dq_report": {}, "dq_score": 100, "dq_alerts": [],
        "lineage": {},
        "load_metrics": {},
        "insights": [], "predictions": [],
        # Backup Flow fields (v4.1 PRO)
        "is_backup_flow": is_bak,
        "restored_db":    c_config.get("restored_db", ""),
    }

    _pipeline_states[session_id] = initial.copy()
    sse.broadcast(session_id, "initial_state", {k: v for k, v in initial.items() if k != "messages"})
    sse.log_event(session_id, "🚀 Pipeline démarré")

    try:
        async for event in wf.astream(initial, config=tc, stream_mode="updates"):
            for node, output in event.items():
                sse.set_agent_status(session_id, node, "running")
                sse.log_event(session_id, f"▶️  {AGENT_LABELS.get(node, node)} en cours...")

                if output:
                    safe_out = _safe(output)
                    _merge(session_id, safe_out)
                    sse.broadcast(session_id, "state_update", {
                        "agent": node,
                        "updates": {k: v for k, v in safe_out.items() if k not in ("messages", "source_df", "source_dfs")},
                    })

                # ── Validation output Modeler ────────────────────────────────────
                if node == "modeler":
                    current = _pipeline_states.get(session_id, {})
                    lm = current.get("logical_model", {})
                    has_fact = lm.get("fact_table") or lm.get("fact_tables")
                    if not lm or not has_fact:
                        sse.set_agent_status(session_id, "modeler", "error")
                        sse.log_event(
                            session_id,
                            "❌ Schema Modeling FAILED — modèle vide/invalide, aucune fact_table générée",
                            level="error",
                        )
                        sse.pipeline_complete(session_id, False, {
                            "error": "modeling_failed",
                            "reason": "Le modèle logique est vide ou ne contient aucune table de faits. "
                                      "Vérifiez que l'Explorer a bien extrait les métadonnées source.",
                        })
                        return

                sse.set_agent_status(session_id, node, "done")
                sse.log_event(session_id, f"✅ {AGENT_LABELS.get(node, node)} terminé")

                # Persistance sélective en DB
                if node in _PERSIST_AFTER:
                    await asyncio.to_thread(_persist, session_id)

                # ── Pause d'interactivité : validation humaine ─────────────────────────────────────────
                if node == "human_review":
                    current = _pipeline_states.get(session_id, {})
                    # Skip pause if auto-approved (testing mode)
                    if current.get("is_validated", False):
                        sse.log_event(session_id, "👤 Human Review auto-approved - continuing pipeline")
                    else:
                        sse.set_stage(session_id, "awaiting_human_review")
                        sse.broadcast(session_id, "human_review_required", {
                            "sql_ddl":               current.get("sql_ddl", ""),
                            "critic_review":         current.get("critic_review", ""),
                            "critic_approved":       current.get("critic_approved", False),
                            "schema_drift_detected": current.get("schema_drift_detected", False),
                            "schema_drift_details":  current.get("schema_drift_details", ""),
                            "previous_sql_ddl":      current.get("previous_sql_ddl", ""),
                            "logical_model_version": current.get("logical_model_version", 0),
                            "logical_model":         current.get("logical_model", {}),
                        })
                        return
                
                if node == "human_review_dq":
                    current = _pipeline_states.get(session_id, {})
                    sse.set_stage(session_id, "awaiting_dq_review")
                    sse.broadcast(session_id, "dq_review_required", {
                        "dq_score":     current.get("dq_score", 0),
                        "dq_alerts":    current.get("dq_alerts", []),
                        "dq_report":    current.get("dq_report", {}),
                        "hitl_comment": current.get("hitl_comment", ""),
                    })
                    return

        final = _pipeline_states.get(session_id, {})
        sse.pipeline_complete(session_id, True, {
            "etl_status":  final.get("etl_status"),
            "retry_count": final.get("retry_count", 0),
            "dq_score":    final.get("dq_score", 100),
        })
        sse.log_event(session_id, "🏁 Pipeline terminé avec succès")
        await asyncio.to_thread(_persist, session_id)

    except asyncio.CancelledError:
        sse.log_event(session_id, "⏹️  Pipeline annulé", level="warning")
    except Exception as e:
        logger.error(f"[Pipeline] {session_id}: {e}", exc_info=True)
        sse.log_event(session_id, f"❌ {e}", level="error")
        sse.pipeline_complete(session_id, False, {"error": str(e)})


# ─── Reprise HITL modèle ──────────────────────────────────────────────────────

async def resume_pipeline(session_id: str, validated: bool, comment: str = "") -> None:
    wf  = _get_wf()
    sse = _get_sse()
    tc  = {"configurable": {"thread_id": session_id}}

    await wf.aupdate_state(tc, {"is_validated": validated, "hitl_comment": comment or ""}, as_node="human_review")
    _merge(session_id, {"is_validated": validated, "hitl_comment": comment or ""})

    sse.log_event(session_id, f"👤 {'✅ Validé' if validated else '✏️ Modification demandée'}")
    sse.set_stage(session_id, "etl_generation" if validated else "model_revision")

    existing = _pipeline_tasks.get(session_id)
    if existing and not existing.done():
        existing.cancel()
    task = asyncio.create_task(_stream_continue(session_id, tc))
    _pipeline_tasks[session_id] = task


# ─── Reprise HITL alerte DQ (NOUVEAU v3) ─────────────────────────────────────

async def resume_dq_review(session_id: str, validated: bool) -> None:
    """
    Reprend le pipeline après l'alerte Data Quality.
    validated=True  → continuer malgré le score DQ faible
    validated=False → abandonner
    """
    wf  = _get_wf()
    sse = _get_sse()
    tc  = {"configurable": {"thread_id": session_id}}

    await wf.aupdate_state(tc, {"is_validated": validated}, as_node="human_review_dq")
    _merge(session_id, {"is_validated": validated})

    if validated:
        sse.log_event(session_id, "⚠️ Qualité des données acceptée — poursuite du pipeline")
        sse.set_stage(session_id, "drift_detection")
        existing = _pipeline_tasks.get(session_id)
        if existing and not existing.done():
            existing.cancel()
        task = asyncio.create_task(_stream_continue(session_id, tc))
        _pipeline_tasks[session_id] = task
    else:
        sse.log_event(session_id, "🛑 Pipeline abandonné (qualité insuffisante)", level="warning")
        sse.pipeline_complete(session_id, False, {"reason": "dq_rejected"})


# ─── Continuation après reprise ───────────────────────────────────────────────

async def _stream_continue(session_id: str, tc: dict) -> None:
    wf  = _get_wf()
    sse = _get_sse()

    try:
        async for event in wf.astream(None, config=tc, stream_mode="updates"):
            for node, output in event.items():
                sse.set_agent_status(session_id, node, "running")
                sse.log_event(session_id, f"▶️  {AGENT_LABELS.get(node, node)} en cours...")

                if output:
                    safe_out = _safe(output)
                    _merge(session_id, safe_out)
                    sse.broadcast(session_id, "state_update", {
                        "agent": node,
                        "updates": {k: v for k, v in safe_out.items() if k not in ("messages", "source_df", "source_dfs")},
                    })

                # ── Validation output Modeler (stream_continue) ────────────────
                if node == "modeler":
                    current = _pipeline_states.get(session_id, {})
                    lm = current.get("logical_model", {})
                    has_fact = lm.get("fact_table") or lm.get("fact_tables")
                    if not lm or not has_fact:
                        sse.set_agent_status(session_id, "modeler", "error")
                        sse.log_event(
                            session_id,
                            "❌ Schema Modeling FAILED — modèle vide/invalide, aucune fact_table générée",
                            level="error",
                        )
                        sse.pipeline_complete(session_id, False, {
                            "error": "modeling_failed",
                            "reason": "Le modèle logique est vide ou ne contient aucune table de faits.",
                        })
                        return

                sse.set_agent_status(session_id, node, "done")
                sse.log_event(session_id, f"✅ {AGENT_LABELS.get(node, node)} terminé")

                if node in _PERSIST_AFTER:
                    await asyncio.to_thread(_persist, session_id)

                if node == "human_review":
                    current = _pipeline_states.get(session_id, {})
                    sse.set_stage(session_id, "awaiting_human_review")
                    sse.broadcast(session_id, "human_review_required", {
                        "sql_ddl":               current.get("sql_ddl", ""),
                        "critic_review":         current.get("critic_review", ""),
                        "critic_approved":       current.get("critic_approved", False),
                        "schema_drift_detected": current.get("schema_drift_detected", False),
                        "schema_drift_details":  current.get("schema_drift_details", ""),
                        "previous_sql_ddl":      current.get("previous_sql_ddl", ""),
                        "logical_model_version": current.get("logical_model_version", 0),
                        "logical_model":         current.get("logical_model", {}),
                    })
                    return

                if node == "human_review_dq":
                    current = _pipeline_states.get(session_id, {})
                    sse.set_stage(session_id, "awaiting_dq_review")
                    sse.broadcast(session_id, "dq_review_required", {
                        "dq_score":     current.get("dq_score", 0),
                        "dq_alerts":    current.get("dq_alerts", []),
                        "dq_report":    current.get("dq_report", {}),
                        "hitl_comment": current.get("hitl_comment", ""),
                    })
                    return

        final = _pipeline_states.get(session_id, {})
        sse.pipeline_complete(session_id, True, {"etl_status": final.get("etl_status")})
        sse.log_event(session_id, "🏁 Pipeline terminé")
        await asyncio.to_thread(_persist, session_id)

    except Exception as e:
        logger.error(f"[Resume] {session_id}: {e}", exc_info=True)
        sse.log_event(session_id, f"❌ {e}", level="error")
        sse.pipeline_complete(session_id, False, {"error": str(e)})


# ─── Chat → relance ───────────────────────────────────────────────────────────

async def send_chat_and_resume(session_id: str, message: str, context: str = "sql") -> dict:
    """Envoie un message utilisateur ET relance le pipeline depuis human_review."""
    wf  = _get_wf()
    sse = _get_sse()
    tc  = {"configurable": {"thread_id": session_id}}

    await wf.aupdate_state(tc, {
        "messages":     [HumanMessage(content=message)],
        "is_validated": False,
    }, as_node="human_review")

    sse.log_event(session_id, f"💬 Demande : {message[:80]}")

    existing = _pipeline_tasks.get(session_id)
    if existing and not existing.done():
        existing.cancel()
    task = asyncio.create_task(_stream_continue(session_id, tc))
    _pipeline_tasks[session_id] = task

    state = _pipeline_states.get(session_id, {})
    return {
        "reply":         "Modification envoyée. Le Critic va re-valider...",
        "sql_ddl":       state.get("sql_ddl", ""),
        "critic_review": state.get("critic_review", ""),
        "etl_code":      state.get("etl_code", "") if context == "etl" else None,
    }
