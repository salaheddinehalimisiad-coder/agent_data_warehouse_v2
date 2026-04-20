# api/routes/sessions.py — Gestion des sessions
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.db import sqlserver as db
from api.services import etl_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/sessions", tags=["sessions"])


class ResumeRequest(BaseModel):
    session_id: str
    user_id: int


@router.get("")
async def list_sessions(user_id: int):
    """Liste les sessions d'un utilisateur."""
    sessions = db.list_user_sessions(user_id)
    return {"sessions": sessions}


@router.post("/new")
async def new_session(user_id: int = 1):
    """Réinitialise la session courante."""
    return {"status": "ready", "message": "Prêt pour un nouveau pipeline"}


@router.post("/resume")
async def resume_session(req: ResumeRequest):
    """Reprend une session existante depuis la base."""
    state = db.get_session_state(req.session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session introuvable")

    etl_service.update_pipeline_state(req.session_id, state)
    return {
        "session_id": req.session_id,
        "status": "resumed",
        "sql_ddl": state.get("sql_ddl", ""),
        "etl_status": state.get("etl_status", "unknown"),
    }
