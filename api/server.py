# api/server.py — Serveur FastAPI production-ready v2.0
import logging
import os
from pathlib import Path
from dotenv import load_dotenv

# Charger .env AVANT tous les autres imports pour que os.getenv() soit correct
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

from api.routes import pipeline, auth, sessions, backup
from api.routes.scheduler import router as scheduler_router
from api.db.sqlserver import init_metadata_db
from api.middleware.security import RateLimitMiddleware, SecurityHeadersMiddleware
from api.middleware.jwt_auth import get_current_user, get_optional_user
from api.services import etl_service, export_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Agent Data Warehouse v2.0 — Démarrage")
    try:
        init_metadata_db()
        logger.info("✅ Base de métadonnées initialisée")
    except Exception as e:
        logger.warning(f"⚠️  DB non disponible (mode dégradé) : {e}")
    yield
    # Shutdown hooks
    try:
        from api.services.scheduler_service import shutdown_scheduler
        shutdown_scheduler()
    except Exception:
        pass
    logger.info("🛑 Serveur arrêté")


app = FastAPI(
    title="Agent Data Warehouse API",
    description="Plateforme ETL multi-agents IA — LangGraph + FastAPI",
    version="3.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Middlewares (OUTER to INNER)
# PRO #6 : CORS origines configurables depuis .env
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
_env_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()] if _raw_origins else []
_default_origins = ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"]
_all_origins = list(set(_default_origins + _env_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_all_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)


# Routeurs
app.include_router(pipeline.router)
app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(backup.router)
app.include_router(scheduler_router)


# ─── Routes supplémentaires ───────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "version": "3.0.0", "env": os.getenv("ENVIRONMENT", "development")}


@app.get("/api/export-pdf")
async def export_pdf(session_id: str, user: dict = Depends(get_optional_user)):
    """Génère un rapport PDF professionnel."""
    state = etl_service.get_pipeline_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session introuvable")
    try:
        pdf_path = export_service.generate_pdf_report(state, session_id)
        return FileResponse(pdf_path, media_type="application/pdf",
                            filename=f"rapport_{session_id}.pdf")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/export-json")
async def export_json_report(session_id: str, user: dict = Depends(get_optional_user)):
    """Export JSON complet du rapport."""
    state = etl_service.get_pipeline_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session introuvable")
    return export_service.generate_json_report(state, session_id)


@app.get("/api/export-airflow")
async def export_airflow(session_id: str, user: dict = Depends(get_optional_user)):
    """Export Python Airflow DAG."""
    state = etl_service.get_pipeline_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session introuvable")
    dag_code = state.get("airflow_dag")
    if not dag_code:
        raise HTTPException(status_code=404, detail="DAG Airflow non généré")
    
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(content=dag_code, media_type="text/x-python", headers={
        "Content-Disposition": f"attachment; filename=airflow_dag_{session_id}.py"
    })

@app.get("/api/export-dbt")
async def export_dbt_project(session_id: str, user: dict = Depends(get_optional_user)):
    """Export dbt project as a ZIP archive."""
    import io
    import zipfile
    from fastapi.responses import Response
    
    state = etl_service.get_pipeline_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session introuvable")
    
    dbt_project = state.get("dbt_project")
    if not dbt_project or not isinstance(dbt_project, dict):
        raise HTTPException(status_code=404, detail="Projet dbt non généré")
        
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        for file_path, file_content in dbt_project.items():
            zip_file.writestr(file_path, str(file_content))
            
    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=dbt_project_{session_id}.zip"}
    )

@app.get("/api/export-xlsx")
async def export_xlsx(session_id: str, user: dict = Depends(get_optional_user)):
    """Export Excel multi-feuilles (Overview + DDL + 1 feuille par table FACT/DIM).
    Format universellement exploitable par Power BI, Excel, Tableau."""
    state = etl_service.get_pipeline_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session introuvable")
    try:
        xlsx_path = export_service.generate_xlsx_report(state, session_id)
        return FileResponse(
            xlsx_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=f"rapport_{session_id}.xlsx",
        )
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"openpyxl non installé: {e}")
    except Exception as e:
        logger.exception("[export-xlsx] erreur")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/export-csv")
async def export_csv_bundle(session_id: str, user: dict = Depends(get_optional_user)):
    """Export ZIP contenant un .csv par table (UTF-8-SIG, compatible Excel/PowerBI)."""
    from fastapi.responses import Response
    state = etl_service.get_pipeline_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session introuvable")
    try:
        zip_bytes = export_service.generate_csv_bundle(state, session_id)
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=csv_bundle_{session_id}.zip"},
        )
    except Exception as e:
        logger.exception("[export-csv] erreur")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/export-powerbi")
async def export_powerbi(session_id: str, user: dict = Depends(get_optional_user)):
    """Export bundle Power BI : connection.pqt + README + schema.sql + manifest."""
    from fastapi.responses import Response
    state = etl_service.get_pipeline_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session introuvable")
    try:
        zip_bytes = export_service.generate_powerbi_template(state, session_id)
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=powerbi_bundle_{session_id}.zip"},
        )
    except Exception as e:
        logger.exception("[export-powerbi] erreur")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/export-bak")
async def export_bak(session_id: str, user: dict = Depends(get_optional_user)):
    """Export SQL Server backup (.bak) du Data Warehouse généré."""
    import pyodbc
    import os
    import shutil
    from pathlib import Path

    state = etl_service.get_pipeline_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session introuvable")

    dw_cfg     = state.get("dw_connection_config") or {}
    db_name    = dw_cfg.get("database") or state.get("user_prefix", "dw")
    user_prefix = state.get("user_prefix", "dw")

    # FIX: Use SQL Server backup directory or temp directory that SQL Server can access
    # Try common SQL Server backup locations
    sql_backup_dirs = [
        Path("C:/ProgramData/agent_dw_bak"),  # Our known working directory
        Path(os.environ.get("TEMP", "C:/Windows/Temp")),
        Path("C:/SQLServer/Backup") if Path("C:/SQLServer").exists() else None,
    ]
    
    bak_dir = None
    for d in sql_backup_dirs:
        if d and d.exists():
            bak_dir = d
            break
    
    # Fallback: create ProgramData directory
    if not bak_dir:
        bak_dir = Path("C:/ProgramData/agent_dw_bak")
    
    bak_dir.mkdir(parents=True, exist_ok=True)
    
    # Filename in SQL Server accessible location
    bak_filename = f"{user_prefix}_{session_id[:8]}_dw.bak"
    bak_path_sql = bak_dir / bak_filename
    
    # Final download path (outputs folder)
    outputs_dir = Path("outputs")
    outputs_dir.mkdir(exist_ok=True)
    download_path = outputs_dir / bak_filename

    env = {
        "host":     os.getenv("DB_HOST", "localhost"),
        "port":     os.getenv("DB_PORT", "1433"),
        "user":     os.getenv("DB_USER", "sa"),
        "password": os.getenv("DB_PASSWORD", ""),
    }
    try:
        drivers = [d for d in pyodbc.drivers() if "SQL Server" in d]
        driver  = next((d for d in ("ODBC Driver 18 for SQL Server", "ODBC Driver 17 for SQL Server") if d in drivers), drivers[0] if drivers else "ODBC Driver 17 for SQL Server")
    except Exception:
        driver = "ODBC Driver 17 for SQL Server"

    pw = env["password"].replace("}", "}}")
    conn_str = (
        f"DRIVER={{{driver}}};"
        f"SERVER={env['host']},{env['port']};DATABASE=master;"
        f"UID={env['user']};PWD={{{pw}}};"
        f"Encrypt=no;TrustServerCertificate=yes;"
    )
    try:
        conn   = pyodbc.connect(conn_str, autocommit=True, timeout=15)
        cursor = conn.cursor()
        # FIX: Use forward slashes for SQL Server path compatibility
        bak_abs = str(bak_path_sql).replace("'", "''")
        db_esc  = db_name.replace("'", "''").replace("]", "]]")
        cursor.execute(f"BACKUP DATABASE [{db_esc}] TO DISK = N'{bak_abs}' WITH COMPRESSION, STATS = 5")
        cursor.close(); conn.close()
    except Exception as e:
        logger.warning(f"[export-bak] {e}")
        raise HTTPException(status_code=500, detail=f"Backup SQL Server échoué : {e}")

    if not bak_path_sql.exists():
        raise HTTPException(status_code=500, detail="Fichier .bak non généré par SQL Server")

    # FIX: Copy to outputs folder for download
    try:
        shutil.copy2(bak_path_sql, download_path)
    except Exception as e:
        logger.warning(f"[export-bak] Copy to outputs failed: {e}, using source path")
        download_path = bak_path_sql

    return FileResponse(
        str(download_path),
        media_type="application/octet-stream",
        filename=f"{user_prefix}_dw_{session_id[:8]}.bak",
    )


class EmailNotifyRequest(BaseModel):
    session_id: str
    email: str
    include_pdf: Optional[bool] = True


@app.post("/api/notify-email")
async def notify_email(req: EmailNotifyRequest, user: dict = Depends(get_optional_user)):
    """Envoie un rapport par email avec PDF en pièce jointe."""
    from api.services.email_service import send_pipeline_complete_email
    state = etl_service.get_pipeline_state(req.session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session introuvable")
    pdf_path = None
    if req.include_pdf:
        try:
            pdf_path = export_service.generate_pdf_report(state, req.session_id)
        except Exception as e:
            logger.warning(f"[Email] PDF non généré : {e}")
    success = send_pipeline_complete_email(req.email, req.session_id, state, pdf_path)
    return {"sent": success, "email": req.email}
