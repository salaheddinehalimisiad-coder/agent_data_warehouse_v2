# api/services/sse.py — Service SSE : diffusion temps réel vers le frontend
import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

# Registre des queues SSE par session_id
_sse_queues: Dict[str, List[asyncio.Queue]] = {}


def get_or_create_queue(session_id: str) -> asyncio.Queue:
    """Crée ou récupère la queue SSE pour une session."""
    if session_id not in _sse_queues:
        _sse_queues[session_id] = []
    q = asyncio.Queue(maxsize=100)
    _sse_queues[session_id].append(q)
    return q


def remove_queue(session_id: str, queue: asyncio.Queue) -> None:
    """Supprime la queue à la déconnexion du client."""
    if session_id in _sse_queues:
        try:
            _sse_queues[session_id].remove(queue)
        except ValueError:
            pass


def broadcast(session_id: str, event_type: str, data: Any) -> None:
    """Diffuse un événement SSE à tous les clients connectés à cette session."""
    if session_id not in _sse_queues:
        return

    payload = {
        "type": event_type,
        "data": data,
        "timestamp": datetime.utcnow().isoformat(),
    }
    message = f"data: {json.dumps(payload)}\n\n"

    dead_queues = []
    for q in _sse_queues[session_id]:
        try:
            q.put_nowait(message)
        except asyncio.QueueFull:
            dead_queues.append(q)

    for dq in dead_queues:
        _sse_queues[session_id].remove(dq)


def log_event(session_id: str, message: str, level: str = "info") -> None:
    """Envoie un message de log vers le frontend."""
    broadcast(session_id, "log", {"message": message, "level": level})
    logger.info(f"[SSE:{session_id}] {message}")


def set_agent_status(session_id: str, agent: str, status: str) -> None:
    """
    Met à jour le statut visuel d'un agent dans le frontend.
    status : "idle" | "running" | "done" | "error" | "waiting"
    """
    broadcast(session_id, "agent_status", {"agent": agent, "status": status})


def set_stage(session_id: str, stage: str, details: dict = None) -> None:
    """Notifie le frontend de la phase courante du pipeline."""
    payload = {"stage": stage, "details": details or {}}
    # Compat: certains clients ecoutent "stage", d'autres "stage_change".
    broadcast(session_id, "stage_change", payload)
    broadcast(session_id, "stage", payload)


def pipeline_complete(session_id: str, success: bool, summary: dict = None) -> None:
    """Notifie la fin du pipeline."""
    broadcast(session_id, "pipeline_complete", {
        "success": success,
        "summary": summary or {},
    })
