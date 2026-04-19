# api/routes/scheduler.py — P3-07 : Routes FastAPI pour le Scheduler
"""
Endpoints CRUD pour le scheduler APScheduler.
POST   /api/schedule       → Créer un job
GET    /api/schedule       → Lister les jobs
DELETE /api/schedule/{id}  → Supprimer un job
PUT    /api/schedule/{id}  → Modifier un job
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from api.middleware.jwt_auth import get_optional_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/schedule", tags=["scheduler"])


class CreateScheduleRequest(BaseModel):
    connection_config: dict
    dw_connection_config: dict
    user_id: int = 1
    user_prefix: str = "dw"
    cron_expression: Optional[str] = None
    interval_minutes: Optional[int] = None
    name: str = "Pipeline ETL"


class UpdateScheduleRequest(BaseModel):
    cron_expression: Optional[str] = None
    interval_minutes: Optional[int] = None
    name: Optional[str] = None


@router.post("")
async def create_schedule(req: CreateScheduleRequest, user: dict = Depends(get_optional_user)):
    """Crée un nouveau job planifié."""
    from api.services.scheduler_service import create_schedule as svc_create
    result = svc_create(
        connection_config=req.connection_config,
        dw_connection_config=req.dw_connection_config,
        user_id=req.user_id,
        user_prefix=req.user_prefix,
        cron_expression=req.cron_expression,
        interval_minutes=req.interval_minutes,
        name=req.name,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("")
async def list_schedules(user: dict = Depends(get_optional_user)):
    """Liste tous les jobs planifiés."""
    from api.services.scheduler_service import list_schedules as svc_list
    return {"jobs": svc_list()}


@router.delete("/{job_id}")
async def delete_schedule(job_id: str, user: dict = Depends(get_optional_user)):
    """Supprime un job planifié."""
    from api.services.scheduler_service import delete_schedule as svc_delete
    return svc_delete(job_id)


@router.put("/{job_id}")
async def update_schedule(
    job_id: str,
    req: UpdateScheduleRequest,
    user: dict = Depends(get_optional_user),
):
    """Met à jour un job planifié."""
    from api.services.scheduler_service import update_schedule as svc_update
    result = svc_update(
        job_id=job_id,
        cron_expression=req.cron_expression,
        interval_minutes=req.interval_minutes,
        name=req.name,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result
