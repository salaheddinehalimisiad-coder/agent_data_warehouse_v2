# api/routes/pipeline.py — Routes pipeline v3.1 PRO (tous bugs corrigés)
"""
FIXES v3.1 :
  BUG #2 : SSE stream avec validation JWT (token en query param validé)
  WARN #6 : chemins absolus via pathlib
"""
import asyncio
import logging
import os
import re
import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Depends, Query, Request, Form
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from typing import Optional

from api.services import sse as sse_service
from api.services import etl_service
from api.middleware.jwt_auth import get_current_user, get_optional_user, decode_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["pipeline"])

_HERE = Path(__file__).parent.parent.parent
UPLOADS_DIR = _HERE / "uploads" / "bak"
OUTPUTS_DIR = _HERE / "outputs"


class StartRequest(BaseModel):
    session_id: Optional[str] = None
    connection_config: dict
    dw_connection_config: dict
    user_prefix: Optional[str] = ""


class ValidateRequest(BaseModel):
    session_id: str
    validated: bool
    comment: Optional[str] = ""


class ValidateDQRequest(BaseModel):
    session_id: str
    validated: bool


class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = "sql"


@router.post("/start")
async def start_pipeline(
    req: StartRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_optional_user),
):
    """Démarre un nouveau pipeline."""
    session_id  = req.session_id or f"session_{uuid.uuid4().hex[:12]}"
    user_id     = int(user.get("sub", 1)) if user else 1
    user_prefix = req.user_prefix or (user.get("prefix", "dw") if user else "dw")

    config = req.dict(exclude={"session_id"})
    config["user_id"]     = user_id
    config["user_prefix"] = user_prefix

    background_tasks.add_task(etl_service.run_pipeline, session_id, config)
    logger.info(f"[API] Pipeline démarré : {session_id} (user={user_id})")
    return {"session_id": session_id, "status": "started"}


@router.post("/validate")
async def validate_model(
    req: ValidateRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_optional_user),
):
    """Reprend le pipeline après validation HITL du modèle."""
    background_tasks.add_task(
        etl_service.resume_pipeline,
        req.session_id,
        req.validated,
        req.comment or "",
    )
    return {"status": "resumed", "validated": req.validated}


@router.post("/validate-dq")
async def validate_dq_alert(
    req: ValidateDQRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_optional_user),
):
    """
    Reprend le pipeline après l'alerte Data Quality (score DQ < 50).
    validated=True  → continuer vers drift_detector
    validated=False → abandonner le pipeline
    """
    background_tasks.add_task(
        etl_service.resume_dq_review,
        req.session_id,
        req.validated,
    )
    return {"status": "dq_resumed", "validated": req.validated}


@router.post("/chat")
async def chat_with_agent(
    req: ChatRequest,
    session_id: str,
    user: dict = Depends(get_optional_user),
):
    """Envoie un message utilisateur et relance le pipeline depuis human_review."""
    try:
        result = await etl_service.send_chat_and_resume(session_id, req.message, req.context or "sql")
        return result
    except Exception as e:
        logger.error(f"[API Chat] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pipeline-stream")
async def pipeline_stream(
    session_id: str,
    request: Request,
):
    """SSE temps réel — validation JWT via cookie (mode strict)."""
    effective_token = request.cookies.get("auth_token") or request.query_params.get("token")
    if not effective_token:
        raise HTTPException(status_code=401, detail="Jeton d'authentification manquant (Cookie ou Query Param)")

    try:
        decode_token(effective_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")

    queue = sse_service.get_or_create_queue(session_id)

    async def event_generator():
        import json
        current_state = etl_service.get_pipeline_state(session_id)
        if current_state:
            payload = {k: v for k, v in current_state.items() if k != "messages"}
            yield f"data: {json.dumps({'type': 'initial_state', 'data': payload})}\n\n"

        try:
            while True:
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=25)
                    yield message
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"
        except asyncio.CancelledError:
            sse_service.remove_queue(session_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/pipeline-status")
async def pipeline_status(
    session_id: str,
    user: dict = Depends(get_optional_user),
):
    state = etl_service.get_pipeline_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session introuvable")
    return {k: v for k, v in state.items() if k != "messages"}


@router.post("/upload")
@router.post("/upload-csv")
async def upload_file(
    file: UploadFile = File(...),
    user: dict = Depends(get_optional_user),
):
    """Upload CSV uniquement (.csv / .txt)."""
    logger.info(f"[API] Upload CSV début : {file.filename}")
    from api.middleware.security import validate_file
    content = await file.read()
    try:
        # Forcer uniquement CSV / txt pour cette route
        if not any(file.filename.lower().endswith(ext) for ext in (".csv", ".txt")):
            raise HTTPException(status_code=400, detail="Cette route accepte uniquement les fichiers CSV (.csv, .txt). Pour un backup SQL Server, utilisez /api/upload-backup.")
        validate_file(file.filename or "file.dat", len(content))
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"[API] Validation upload échouée pour {file.filename} : {e}")
        raise

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    file_path = UPLOADS_DIR / safe_name
    with open(file_path, "wb") as f:
        f.write(content)
    logger.info(f"[API] Upload CSV réussi : {file_path}")
    return {"file_path": str(file_path), "filename": file.filename, "size": len(content)}


# Route /api/upload-backup déplacée vers api/routes/backup.py pour une meilleure maintenance.


@router.get("/export")
async def export_json_legacy(
    session_id: str,
    user: dict = Depends(get_optional_user),
):
    """Export JSON complet de la session."""
    state = etl_service.get_pipeline_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session introuvable")
    return {
        "session_id":            session_id,
        "sql_ddl":               state.get("sql_ddl", ""),
        "etl_code":              state.get("etl_code", ""),
        "critic_review":         state.get("critic_review", ""),
        "lineage":               state.get("lineage", {}),
        "dq_report":             state.get("dq_report", {}),
        "dq_score":              state.get("dq_score", 100),
        "execution_log":         state.get("execution_log", []),
        "schema_drift_detected": state.get("schema_drift_detected", False),
        "heal_history":          state.get("heal_history", []),
    }


@router.get("/export-ktr")
async def export_ktr(
    session_id: str,
    user: dict = Depends(get_optional_user),
):
    state = etl_service.get_pipeline_state(session_id)
    if not state or not state.get("etl_code"):
        raise HTTPException(status_code=404, detail="Aucun fichier .ktr disponible")
    user_prefix = state.get("user_prefix", "dw")
    ktr_path = OUTPUTS_DIR / f"{user_prefix}_pipeline.ktr"
    if ktr_path.exists():
        return FileResponse(str(ktr_path), filename=f"{user_prefix}_pipeline.ktr", media_type="application/xml")
    raise HTTPException(status_code=404, detail="Fichier .ktr non trouvé")

class TestConnectionRequest(BaseModel):
    connection_config: dict


@router.post("/test-connection")
async def test_connection(req: TestConnectionRequest):
    """
    PRO #3 : Teste la connexion à la source avant de lancer le pipeline.
    Retourne {ok: bool, error: str, tables: list}
    """
    config = req.connection_config
    source_type = config.get("type", "csv")

    try:
        if source_type == "csv":
            from pathlib import Path
            fp = config.get("file_path", "")
            if not fp or not Path(fp).exists():
                return {"ok": False, "error": f"Fichier introuvable : {fp}", "tables": []}
            import pandas as pd
            df = pd.read_csv(fp, nrows=1)
            return {"ok": True, "error": "", "tables": [Path(fp).stem], "columns": list(df.columns)}

        elif source_type == "excel":
            from pathlib import Path
            import pandas as pd
            fp = config.get("file_path", "")
            if not fp or not Path(fp).exists():
                return {"ok": False, "error": "Fichier Excel introuvable", "tables": []}
            xl = pd.ExcelFile(fp)
            return {"ok": True, "error": "", "tables": xl.sheet_names}

        elif source_type == "rest_api":
            import requests
            url = config.get("url")
            headers = config.get("headers", {})
            if not url: return {"ok": False, "error": "URL manquante", "tables": []}
            resp = requests.get(url, headers=headers, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            # On vérifie si c'est une liste ou un dict avec la root_key
            rk = config.get("root_key")
            if rk and isinstance(data, dict): data = data.get(rk, [])
            if not isinstance(data, list):
                return {"ok": False, "error": "L'API n'a pas retourné une liste de données", "tables": []}
            return {"ok": True, "error": "", "tables": ["api_response"], "count": len(data)}

        elif source_type in ("mysql", "postgresql", "postgres", "sqlite"):
            from sqlalchemy import create_engine, inspect, text
            host     = config.get("host", "localhost")
            port     = config.get("port")
            database = config.get("database", "")
            user     = config.get("user", "")
            password = config.get("password", "")
            
            driver_map = {"mysql": "mysqlconnector", "postgresql": "psycopg2", "postgres": "psycopg2", "sqlite": "pysqlite"}
            driver = driver_map.get(source_type, "mysqlconnector")
            
            if not port:
                port = 5432 if source_type in ("postgresql", "postgres") else 3306
                
            if source_type == "sqlite":
                url = f"sqlite:///{database}"
            else:
                url = f"{source_type}+{driver}://{user}:{password}@{host}:{port}/{database}"
            
            engine = create_engine(url, connect_args={"connect_timeout": 5})
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            inspector = inspect(engine)
            tables = inspector.get_table_names()
            return {"ok": True, "error": "", "tables": tables}

        else:
            return {"ok": False, "error": f"Type de source non supporté : {source_type}", "tables": []}

    except Exception as e:
        logger.error(f"[TestConn] Failed: {e}")
        return {"ok": False, "error": f"{type(e).__name__}: {str(e)}", "tables": []}


@router.post("/query")
async def query_warehouse(
    request: Request,
    user: dict = Depends(get_current_user)
):
    """Génère et exécute une requête SQL à partir d'une question en langage naturel."""
    try:
        data = await request.json()
        session_id = data.get("session_id")
        question   = data.get("question")
        
        # Récupérer l'état actuel (modèle logique + config DW) via main.py helper
        from main import get_thread_state
        state = get_thread_state(session_id)
        
        logical_model = state.get("logical_model")
        dw_config     = state.get("dw_connection_config")
        user_prefix   = state.get("user_prefix", "dw")
        
        if not logical_model or not dw_config:
            raise HTTPException(status_code=400, detail="Data Warehouse non prêt ou modèle inexistant.")

        # 1. Générer le SQL via LLM
        from nodes.llm_factory import get_llm, extract_text
        llm = get_llm(temperature=0)
        
        prompt = f"""Tu es un expert SQL de haut niveau. Ta tâche est de traduire la question utilisateur en une requête SQL valide compatible avec MySQL/PostgreSQL.
        
MODÈLE LOGIQUE DU DATA WAREHOUSE:
{logical_model}

PRÉFIXE DES TABLES: Toutes les tables dans la base commencent par '{user_prefix}_'. Exemple: si la table est 'dim_client', son nom réel est '{user_prefix}_dim_client'.

QUESTION UTILISATEUR:
"{question}"

 RÈGLES DE RÉPONSE:
- Analyse bien les relations (FK) entre la table de faits et les dimensions.
- Les dimensions commencent par '{user_prefix}_dim_' et les faits par '{user_prefix}_fact_'.
- Retourne uniquement le bloc SQL entre des balises [SQL] et [/SQL].
"""
        
        resp = llm.invoke(prompt)
        raw_text = extract_text(resp)
        import re
        sql_match = re.search(r"\[SQL\](.*?)\[/SQL\]", raw_text, re.DOTALL | re.IGNORECASE)
        generated_sql = sql_match.group(1).strip() if sql_match else raw_text.strip()
        generated_sql = generated_sql.replace('```sql', '').replace('```', '').strip()

        # Guardrails minimums: requete lecture seule uniquement.
        blocked = ("insert", "update", "delete", "drop", "alter", "truncate", "create", "merge", "exec", "execute")
        lowered = generated_sql.lower().strip()
        if not lowered.startswith("select"):
            raise HTTPException(status_code=400, detail="Seules les requêtes SELECT sont autorisées.")
        if any(re.search(rf"\b{kw}\b", lowered) for kw in blocked):
            raise HTTPException(status_code=400, detail="La requête contient des opérations interdites.")
        if ";" in lowered:
            raise HTTPException(status_code=400, detail="Les requêtes multiples ne sont pas autorisées.")

        # 2. Exécuter le SQL
        from nodes.etl_executor import _build_engine
        engine = _build_engine(dw_config)
        import pandas as pd
        
        with engine.connect() as conn:
            df = pd.read_sql(generated_sql, conn)
            df = df.head(500)
            
        # Conversion des dates/objets pour le JSON
        for col in df.columns:
            if df[col].dtype == 'object' or 'datetime' in str(df[col].dtype):
                df[col] = df[col].astype(str)

        rows = df.to_dict(orient="records")
        columns = df.columns.tolist()

        # 4. Tenter une auto-visualisation si résultats présents
        chart_config = None
        import json
        if rows and len(rows) > 0:
            try:
                viz_prompt = f"""
                Analyse ces données SQL et suggère un graphique.
                Colonnes: {columns}
                Exemple de données: {rows[:3]}
                Question utilisateur: {question}
                
                Réponds UNIQUEMENT en JSON: 
                {{
                  "type": "bar|line|pie|none", 
                  "title": "...", 
                  "xKey": "...", 
                  "yKey": "..."
                }}
                """
                llm = get_llm(temperature=0)
                viz_resp = llm.invoke(viz_prompt)
                chart_config = json.loads(extract_text(viz_resp))
                if chart_config.get("type") == "none": chart_config = None
            except:
                chart_config = None

        return {
            "success": True,
            "sql": generated_sql,
            "columns": columns,
            "rows": rows,
            "total_rows": len(rows),
            "chart": chart_config
        }

    except Exception as e:
        logger.error(f"Query Error: {e}")

