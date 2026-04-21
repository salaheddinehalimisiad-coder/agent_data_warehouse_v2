# api/services/sse.py — Service SSE : diffusion temps réel vers le frontend
#
# FIX v3.2 (2026-04) — « le pipeline n'avance pas »
# ---------------------------------------------------
# Problème : les premiers événements SSE (initial_state, log de démarrage,
# agent_status=running, …) étaient émis AVANT que le client EventSource ait
# fini de se connecter à /api/pipeline-stream. La fonction broadcast() quittait
# alors silencieusement (`if session_id not in _sse_queues: return`) et les
# événements étaient perdus. Conséquence côté UI : la barre de progression
# restait bloquée à 0 % et aucun log n'apparaissait.
#
# Solution : chaque session dispose désormais d'un *buffer* d'événements non
# consommés. broadcast() empile dans ce buffer quand aucun client n'est encore
# enregistré. À la connexion, la route /api/pipeline-stream vide le buffer
# (cf. drain_buffer()) avant d'entrer dans la boucle de streaming temps réel.
import asyncio
import json
import logging
from collections import deque
from datetime import datetime
from typing import Any, Deque, Dict, List

logger = logging.getLogger(__name__)

# Registre des queues SSE par session_id
_sse_queues: Dict[str, List[asyncio.Queue]] = {}

# Buffer d'événements émis AVANT la connexion du premier client SSE
# (évite la perte des tout premiers événements). Capacité bornée pour ne pas
# fuir la mémoire si personne ne se connecte jamais.
_BUFFER_MAXLEN = 500
_sse_buffers: Dict[str, Deque[str]] = {}


def _buffer_for(session_id: str) -> Deque[str]:
    buf = _sse_buffers.get(session_id)
    if buf is None:
        buf = deque(maxlen=_BUFFER_MAXLEN)
        _sse_buffers[session_id] = buf
    return buf


def get_or_create_queue(session_id: str) -> asyncio.Queue:
    """Crée ou récupère la queue SSE pour une session."""
    if session_id not in _sse_queues:
        _sse_queues[session_id] = []
    q: asyncio.Queue = asyncio.Queue(maxsize=500)
    _sse_queues[session_id].append(q)
    return q


def drain_buffer(session_id: str) -> List[str]:
    """Retourne et vide les événements accumulés avant connexion du client.

    Appelée par la route /api/pipeline-stream juste après get_or_create_queue()
    pour que le nouveau client reçoive l'historique complet de la session.
    """
    buf = _sse_buffers.get(session_id)
    if not buf:
        return []
    items = list(buf)
    buf.clear()
    return items


def remove_queue(session_id: str, queue: asyncio.Queue) -> None:
    """Supprime la queue à la déconnexion du client."""
    if session_id in _sse_queues:
        try:
            _sse_queues[session_id].remove(queue)
        except ValueError:
            pass


def broadcast(session_id: str, event_type: str, data: Any) -> None:
    """Diffuse un événement SSE à tous les clients connectés à cette session.

    Si aucun client n'est encore connecté, l'événement est conservé dans un
    buffer borné et sera rejoué dès la connexion (voir drain_buffer).
    """
    payload = {
        "type":      event_type,
        "data":      data,
        "timestamp": datetime.utcnow().isoformat(),
    }
    message = f"data: {json.dumps(payload, default=str)}\n\n"

    queues = _sse_queues.get(session_id) or []
    if not queues:
        # Pas encore de client : on bufferise pour rejouer à la connexion.
        _buffer_for(session_id).append(message)
        logger.debug(f"[SSE:{session_id}] Bufferisé (no client yet): {event_type}")
        return

    dead_queues = []
    for q in queues:
        try:
            q.put_nowait(message)
        except asyncio.QueueFull:
            logger.warning(f"[SSE:{session_id}] Queue pleine — client lent")
            dead_queues.append(q)

    for dq in dead_queues:
        try:
            queues.remove(dq)
        except ValueError:
            pass


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


def cleanup_session(session_id: str) -> None:
    """Libère les ressources (buffer + queues) associées à une session."""
    _sse_buffers.pop(session_id, None)
    _sse_queues.pop(session_id, None)
