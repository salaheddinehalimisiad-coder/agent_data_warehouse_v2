# api/routes/backup.py — Mission 1 : Upload .bak + RESTORE DATABASE
# Remplace la section correspondante dans pipeline.py
# Endpoint autonome, facile à tester avec curl ou Swagger UI

import os
import re
import uuid
import logging
from pathlib import Path
from typing import Optional

import pyodbc
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["backup"])

# Dossier où le backend écrit les .bak (= volume partagé bak_transit)
BAK_DIR = Path(os.getenv("BAK_UPLOAD_DIR", "/app/uploads/bak"))


# ─── Endpoint : Upload + Restauration automatique ────────────────────────────

@router.post("/upload-backup")
async def upload_backup(
    file: UploadFile = File(...),
    restore_db_name: Optional[str] = Form(None),
):
    """
    1. Reçoit un fichier .bak
    2. Le sauvegarde dans le volume partagé avec SQL Server
    3. Exécute RESTORE DATABASE automatiquement
    4. Retourne la liste des tables restaurées
    """
    # ── Validation ────────────────────────────────────────────────────────────
    if not file.filename.lower().endswith(".bak"):
        raise HTTPException(
            status_code=400,
            detail="Seuls les fichiers .bak SQL Server sont acceptés."
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Le fichier .bak est vide.")

    # ── Sauvegarde dans le volume partagé ─────────────────────────────────────
    BAK_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    bak_path = BAK_DIR / safe_name

    with open(bak_path, "wb") as f:
        f.write(content)

    size_mb = len(content) / (1024 * 1024)
    logger.info(f"[BAK] Fichier sauvegardé : {bak_path} ({size_mb:.1f} MB)")

    # ── Nom de la base cible ──────────────────────────────────────────────────
    db_stem = Path(file.filename).stem.lower().replace("-", "_").replace(" ", "_")[:50]
    target_db = restore_db_name or f"restored_{db_stem}"

    # ── Restauration ──────────────────────────────────────────────────────────
    result = restore_sqlserver_backup(str(bak_path), target_db)

    return {
        "filename":        file.filename,
        "size_mb":         round(size_mb, 2),
        "file_path":       str(bak_path),
        "restore_success": result["success"],
        "restored_db":     target_db if result["success"] else None,
        "tables":          result.get("tables", []),
        "message":         result.get("message", ""),
        "restore_error":   result.get("error", ""),
    }


# ─── Fonction de restauration T-SQL ──────────────────────────────────────────

def restore_sqlserver_backup(bak_path: str, target_db: str) -> dict:
    """
    Exécute un RESTORE DATABASE complet via pyodbc + T-SQL.

    Paramètres :
        bak_path   : chemin du .bak VU PAR LE BACKEND (dans /app/uploads/bak/)
        target_db  : nom de la base de données à créer/écraser

    Le fichier .bak est accessible par SQL Server via le MÊME volume Docker
    monté à /var/opt/mssql/backup dans le conteneur SQL Server.
    """
    host     = os.getenv("DB_HOST", "sqlserver")
    user     = os.getenv("DB_USER", "sa")
    password = os.getenv("DB_PASSWORD")

    if not password:
        return {"success": False, "error": "DB_PASSWORD manquant dans .env", "tables": []}

    # Le volume est monté à des chemins différents dans chaque conteneur :
    #   Backend    : /app/uploads/bak/fichier.bak
    #   SQL Server : /var/opt/mssql/backup/fichier.bak
    # On reconstruit le chemin SQL Server à partir du nom de fichier seul.
    backup_mount = os.getenv("SQLSERVER_BACKUP_MOUNT_DIR", "/var/opt/mssql/backup")
    bak_filename = Path(bak_path).name
    bak_sql_path = str(Path(backup_mount) / bak_filename)

    # Nom de DB sécurisé (alphanumeric + underscore)
    safe_db = re.sub(r"[^a-zA-Z0-9_]", "_", target_db)[:64] or "restored_db"

    conn_str = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={host},1433;DATABASE=master;"
        f"UID={user};PWD={{{password}}};TrustServerCertificate=yes;"
    )

    try:
        conn = pyodbc.connect(conn_str, autocommit=True, timeout=300)
        cursor = conn.cursor()

        # ── Étape 1 : Lire les logical names depuis le backup ─────────────────
        logger.info(f"[BAK] RESTORE FILELISTONLY FROM '{bak_sql_path}'")
        bak_escaped = bak_sql_path.replace("'", "''")
        cursor.execute(f"RESTORE FILELISTONLY FROM DISK = N'{bak_escaped}'")

        columns  = [d[0] for d in cursor.description]
        file_list = [dict(zip(columns, row)) for row in cursor.fetchall()]

        logical_data = next(
            (r["LogicalName"] for r in file_list if r.get("Type") == "D"), None
        )
        logical_log = next(
            (r["LogicalName"] for r in file_list if r.get("Type") == "L"), None
        )

        if not logical_data:
            return {
                "success": False,
                "error": "Impossible de lire les logical names. Vérifiez que le .bak est accessible par SQL Server.",
                "tables": []
            }

        logger.info(f"[BAK] Logical names → data='{logical_data}' log='{logical_log}'")

        # ── Étape 2 : Chemins de destination (Linux, dans le conteneur SS) ────
        data_dir = os.getenv("SQLSERVER_DATA_DIR", "/var/opt/mssql/data")
        mdf_path = str(Path(data_dir) / f"{safe_db}.mdf")
        ldf_path = str(Path(data_dir) / f"{safe_db}_log.ldf")

        # Escape SQL
        def esc(s): return s.replace("'", "''")

        # ── Étape 3 : Si la DB existe déjà, passer en SINGLE_USER pour REPLACE ─
        cursor.execute(f"""
            IF EXISTS (SELECT name FROM master.sys.databases WHERE name = N'{esc(safe_db)}')
                ALTER DATABASE [{safe_db}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE
        """)

        # ── Étape 4 : RESTORE DATABASE ────────────────────────────────────────
        restore_sql = f"""
            RESTORE DATABASE [{safe_db}]
            FROM DISK = N'{esc(bak_sql_path)}'
            WITH
              MOVE N'{esc(logical_data)}' TO N'{esc(mdf_path)}',
              MOVE N'{esc(logical_log or logical_data + "_log")}' TO N'{esc(ldf_path)}',
              REPLACE,
              RECOVERY,
              STATS = 5
        """
        logger.info(f"[BAK] Lancement RESTORE DATABASE [{safe_db}] ...")
        cursor.execute(restore_sql)
        
        # Petit délai pour laisser SQL Server finaliser l'état ONLINE
        import time
        time.sleep(2)
        
        logger.info(f"[BAK] ✅ RESTORE terminé pour [{safe_db}]")

        # ── Étape 5 : Remettre en MULTI_USER ──────────────────────────────────
        cursor.execute(f"ALTER DATABASE [{safe_db}] SET MULTI_USER")

        # ── Étape 6 : Lister les tables restaurées ────────────────────────────
        cursor.execute(f"""
            SELECT TABLE_SCHEMA + '.' + TABLE_NAME
            FROM [{safe_db}].INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        """)
        tables = [row[0] for row in cursor.fetchall()]

        cursor.close()
        conn.close()

        return {
            "success": True,
            "tables":  tables,
            "message": f"Base [{safe_db}] restaurée. {len(tables)} table(s) disponible(s).",
        }

    except pyodbc.Error as e:
        logger.error(f"[BAK] Erreur pyodbc : {e}")
        return {"success": False, "error": str(e), "tables": []}

    except Exception as e:
        logger.error(f"[BAK] Erreur inattendue : {e}")
        return {"success": False, "error": str(e), "tables": []}
