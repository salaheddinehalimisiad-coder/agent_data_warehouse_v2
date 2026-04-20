# api/services/scheduler_service.py — P3-07 : Scheduler APScheduler
"""
Phase 3 — Scheduler natif Python avec APScheduler.
- Remplace le stub airflow_generator.py par un vrai scheduler
- Persiste les jobs via JSON (léger, sans dépendance SQL pour le scheduler)
- Endpoints : create, list, delete, update
- Chaque job déclenche un run complet du pipeline LangGraph
"""
import json
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

# Ancré à la racine du projet (remonte de api/services/ → racine)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
JOBS_FILE = str(_PROJECT_ROOT / "outputs" / "scheduler_jobs.json")

# ── Scheduler singleton ──────────────────────────────────────────────────────
_scheduler = None
_scheduler_started = False


def _get_scheduler():
    """Lazy-init du scheduler APScheduler."""
    global _scheduler, _scheduler_started
    if _scheduler is not None:
        return _scheduler

    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
        from apscheduler.triggers.interval import IntervalTrigger

        _scheduler = BackgroundScheduler(
            job_defaults={
                "coalesce": True,
                "max_instances": 1,
                "misfire_grace_time": 300,
            }
        )

        # Restaurer les jobs persistés
        _restore_jobs(_scheduler)

        if not _scheduler_started:
            _scheduler.start()
            _scheduler_started = True
            logger.info("[Scheduler] ✅ APScheduler démarré")

        return _scheduler
    except ImportError:
        logger.error(
            "[Scheduler] ❌ apscheduler non installé. "
            "Ajoutez 'apscheduler>=3.10.0' à requirements.txt"
        )
        return None


def _run_pipeline_job(
    job_id: str,
    connection_config: dict,
    dw_connection_config: dict,
    user_id: int,
    user_prefix: str,
):
    """
    Callback exécuté par APScheduler : lance un run complet du pipeline LangGraph.
    """
    logger.info(f"[Scheduler] 🚀 Déclenchement job {job_id}")
    try:
        from main import agent_workflow
        from api.services.sse import broadcast

        session_id = f"scheduled_{job_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        initial_state = {
            "messages": [],
            "connection_config": connection_config,
            "dw_connection_config": dw_connection_config,
            "user_id": user_id,
            "user_prefix": user_prefix,
            "session_id": session_id,
            "execution_log": [f"[Scheduler] Job {job_id} déclenché automatiquement"],
            "etl_status": "pending",
            "retry_count": 0,
            "heal_history": [],
            "is_validated": True,
        }

        config = {"configurable": {"thread_id": session_id}}
        result = agent_workflow.invoke(initial_state, config)

        etl_status = result.get("etl_status", "unknown")
        logger.info(
            f"[Scheduler] ✅ Job {job_id} terminé — "
            f"session={session_id}, status={etl_status}"
        )

        # Mettre à jour le statut du job
        _update_job_status(job_id, {
            "last_run": datetime.now().isoformat(),
            "last_session_id": session_id,
            "last_status": etl_status,
        })

    except Exception as e:
        logger.error(f"[Scheduler] ❌ Job {job_id} échoué : {e}")
        _update_job_status(job_id, {
            "last_run": datetime.now().isoformat(),
            "last_status": "error",
            "last_error": str(e)[:500],
        })


# ═════════════════════════════════════════════════════════════════════════════
# API PUBLIQUE
# ═════════════════════════════════════════════════════════════════════════════

def create_schedule(
    connection_config: dict,
    dw_connection_config: dict,
    user_id: int,
    user_prefix: str,
    cron_expression: str = None,
    interval_minutes: int = None,
    name: str = "Pipeline ETL",
) -> Dict[str, Any]:
    """
    Crée un job planifié.
    Soit un cron_expression (ex: "0 2 * * *" = tous les jours à 2h),
    soit un interval_minutes (ex: 60 = toutes les heures).
    """
    scheduler = _get_scheduler()
    if scheduler is None:
        return {"error": "Scheduler non disponible (apscheduler non installé)"}

    job_id = str(uuid.uuid4())[:8]

    try:
        if cron_expression:
            from apscheduler.triggers.cron import CronTrigger
            parts = cron_expression.split()
            trigger = CronTrigger(
                minute=parts[0] if len(parts) > 0 else "*",
                hour=parts[1] if len(parts) > 1 else "*",
                day=parts[2] if len(parts) > 2 else "*",
                month=parts[3] if len(parts) > 3 else "*",
                day_of_week=parts[4] if len(parts) > 4 else "*",
            )
            schedule_desc = f"Cron: {cron_expression}"
        elif interval_minutes:
            from apscheduler.triggers.interval import IntervalTrigger
            trigger = IntervalTrigger(minutes=interval_minutes)
            schedule_desc = f"Toutes les {interval_minutes} minutes"
        else:
            return {"error": "Fournir cron_expression ou interval_minutes"}

        scheduler.add_job(
            _run_pipeline_job,
            trigger=trigger,
            id=job_id,
            name=name,
            kwargs={
                "job_id": job_id,
                "connection_config": connection_config,
                "dw_connection_config": dw_connection_config,
                "user_id": user_id,
                "user_prefix": user_prefix,
            },
            replace_existing=True,
        )

        job_info = {
            "id": job_id,
            "name": name,
            "schedule": schedule_desc,
            "cron_expression": cron_expression,
            "interval_minutes": interval_minutes,
            "connection_config": connection_config,
            "dw_connection_config": dw_connection_config,
            "user_id": user_id,
            "user_prefix": user_prefix,
            "created_at": datetime.now().isoformat(),
            "status": "active",
            "last_run": None,
            "last_status": None,
            "next_run": str(scheduler.get_job(job_id).next_run_time) if scheduler.get_job(job_id) else None,
        }

        _persist_job(job_info)
        logger.info(f"[Scheduler] ✅ Job créé : {job_id} ({schedule_desc})")
        return job_info

    except Exception as e:
        logger.error(f"[Scheduler] Erreur création job : {e}")
        return {"error": str(e)}


def list_schedules() -> List[Dict[str, Any]]:
    """Liste tous les jobs planifiés."""
    jobs = _load_jobs()
    scheduler = _get_scheduler()

    # Enrichir avec les infos du scheduler en temps réel
    if scheduler:
        for job in jobs:
            apjob = scheduler.get_job(job["id"])
            if apjob:
                job["next_run"] = str(apjob.next_run_time) if apjob.next_run_time else None
                job["status"] = "active"
            else:
                job["status"] = "paused"

    return jobs


def delete_schedule(job_id: str) -> Dict[str, Any]:
    """Supprime un job planifié."""
    scheduler = _get_scheduler()
    if scheduler:
        try:
            scheduler.remove_job(job_id)
        except Exception:
            pass  # Job peut ne pas exister dans le scheduler

    jobs = _load_jobs()
    jobs = [j for j in jobs if j.get("id") != job_id]
    _save_jobs(jobs)

    logger.info(f"[Scheduler] 🗑️ Job supprimé : {job_id}")
    return {"deleted": job_id}


def update_schedule(
    job_id: str,
    cron_expression: str = None,
    interval_minutes: int = None,
    name: str = None,
) -> Dict[str, Any]:
    """Met à jour un job planifié existant."""
    scheduler = _get_scheduler()
    if scheduler is None:
        return {"error": "Scheduler non disponible"}

    jobs = _load_jobs()
    job_info = next((j for j in jobs if j["id"] == job_id), None)
    if not job_info:
        return {"error": f"Job {job_id} introuvable"}

    # Supprimer l'ancien job
    try:
        scheduler.remove_job(job_id)
    except Exception:
        pass

    # Recréer avec les nouveaux paramètres
    return create_schedule(
        connection_config=job_info["connection_config"],
        dw_connection_config=job_info["dw_connection_config"],
        user_id=job_info["user_id"],
        user_prefix=job_info["user_prefix"],
        cron_expression=cron_expression or job_info.get("cron_expression"),
        interval_minutes=interval_minutes or job_info.get("interval_minutes"),
        name=name or job_info.get("name", "Pipeline ETL"),
    )


def shutdown_scheduler():
    """Arrête proprement le scheduler."""
    global _scheduler, _scheduler_started
    if _scheduler and _scheduler_started:
        _scheduler.shutdown(wait=False)
        _scheduler_started = False
        logger.info("[Scheduler] 🛑 APScheduler arrêté")


# ═════════════════════════════════════════════════════════════════════════════
# PERSISTANCE JOBS
# ═════════════════════════════════════════════════════════════════════════════

def _load_jobs() -> List[dict]:
    """Charge les jobs depuis le fichier JSON."""
    if not os.path.exists(JOBS_FILE):
        return []
    try:
        with open(JOBS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _save_jobs(jobs: List[dict]) -> None:
    """Sauvegarde les jobs dans le fichier JSON."""
    os.makedirs(os.path.dirname(JOBS_FILE), exist_ok=True)
    try:
        with open(JOBS_FILE, "w", encoding="utf-8") as f:
            json.dump(jobs, f, indent=2, ensure_ascii=False, default=str)
    except Exception as e:
        logger.error(f"[Scheduler] Erreur sauvegarde jobs : {e}")


def _persist_job(job_info: dict) -> None:
    """Ajoute ou met à jour un job dans le fichier de persistance."""
    jobs = _load_jobs()
    # Remplacer si existe
    jobs = [j for j in jobs if j.get("id") != job_info["id"]]
    jobs.append(job_info)
    _save_jobs(jobs)


def _update_job_status(job_id: str, updates: dict) -> None:
    """Met à jour le statut d'un job après exécution."""
    jobs = _load_jobs()
    for job in jobs:
        if job.get("id") == job_id:
            job.update(updates)
            break
    _save_jobs(jobs)


def _restore_jobs(scheduler) -> None:
    """Restaure les jobs persistés au démarrage du scheduler."""
    jobs = _load_jobs()
    if not jobs:
        return

    for job_info in jobs:
        if job_info.get("status") != "active":
            continue
        try:
            cron_expr = job_info.get("cron_expression")
            interval_min = job_info.get("interval_minutes")

            if cron_expr:
                from apscheduler.triggers.cron import CronTrigger
                parts = cron_expr.split()
                trigger = CronTrigger(
                    minute=parts[0] if len(parts) > 0 else "*",
                    hour=parts[1] if len(parts) > 1 else "*",
                    day=parts[2] if len(parts) > 2 else "*",
                    month=parts[3] if len(parts) > 3 else "*",
                    day_of_week=parts[4] if len(parts) > 4 else "*",
                )
            elif interval_min:
                from apscheduler.triggers.interval import IntervalTrigger
                trigger = IntervalTrigger(minutes=interval_min)
            else:
                continue

            scheduler.add_job(
                _run_pipeline_job,
                trigger=trigger,
                id=job_info["id"],
                name=job_info.get("name", "Pipeline ETL"),
                kwargs={
                    "job_id": job_info["id"],
                    "connection_config": job_info["connection_config"],
                    "dw_connection_config": job_info["dw_connection_config"],
                    "user_id": job_info["user_id"],
                    "user_prefix": job_info["user_prefix"],
                },
                replace_existing=True,
            )
            logger.info(f"[Scheduler] 🔄 Job restauré : {job_info['id']}")
        except Exception as e:
            logger.warning(f"[Scheduler] Job {job_info['id']} non restauré : {e}")
