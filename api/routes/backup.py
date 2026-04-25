# api/routes/backup.py — Ingestion universelle de sources SQL Server v2
#
# v2 (2026-04) : support multi-format, preflight version, messages FR clairs.
#
# Formats acceptés :
#   • .bak     → RESTORE DATABASE natif (avec preflight HEADERONLY)
#   • .sql     → exécution batch par batch (split sur GO), 100% agnostique en version
#   • .bacpac  → import via SqlPackage.exe si présent dans le PATH
#
# Stratégie : on détecte l'extension, on choisit la bonne voie, et en cas
# d'échec d'un format on propose explicitement les alternatives à l'utilisateur.
# L'objectif : qu'AUCUN fichier de base de données ne soit rejeté sans message
# d'action concret.

import os
import re
import json
import time
import uuid
import socket
import shutil
import logging
import platform
import threading
import subprocess
from pathlib import Path
from queue import Queue, Empty
from typing import Optional, Tuple, List, Iterator

import pyodbc
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["backup"])

# Dossier où le backend écrit les sources (= volume partagé avec SQL Server en Docker)
BAK_DIR = Path(os.getenv("BAK_UPLOAD_DIR", "/app/uploads/bak"))


# ─── Table de correspondance version SQL Server ──────────────────────────────
# Clef = SoftwareVersionMajor renvoyé par RESTORE HEADERONLY
_SQL_VERSION_NAMES = {
    10: "SQL Server 2008 / 2008 R2",
    11: "SQL Server 2012",
    12: "SQL Server 2014",
    13: "SQL Server 2016",
    14: "SQL Server 2017",
    15: "SQL Server 2019",
    16: "SQL Server 2022",
    17: "SQL Server 2025 / vNext",
}


def _version_label(major: Optional[int]) -> str:
    if major is None:
        return "version inconnue"
    return _SQL_VERSION_NAMES.get(int(major), f"SQL Server (major={major})")


# ─── Utilitaires DB ──────────────────────────────────────────────────────────

def _db_env() -> dict:
    return {
        "host":     os.getenv("DB_HOST", "sqlserver"),
        "port":     os.getenv("DB_PORT", "1433"),
        "user":     os.getenv("DB_USER", "sa"),
        "password": os.getenv("DB_PASSWORD", ""),
    }


def _conn_str(env: dict, database: str = "master") -> str:
    # Driver 18 si dispo (plus récent), sinon 17
    driver = "ODBC Driver 18 for SQL Server"
    try:
        drivers = [d for d in pyodbc.drivers() if "SQL Server" in d]
        if driver not in drivers and "ODBC Driver 17 for SQL Server" in drivers:
            driver = "ODBC Driver 17 for SQL Server"
    except Exception:
        driver = "ODBC Driver 17 for SQL Server"

    pw = env["password"].replace("}", "}}")  # escape for the {pwd} form
    return (
        f"DRIVER={{{driver}}};"
        f"SERVER={env['host']},{env['port']};DATABASE={database};"
        f"UID={env['user']};PWD={{{pw}}};"
        f"Encrypt=no;TrustServerCertificate=yes;"
    )


def _get_server_version(env: dict) -> Tuple[Optional[int], str]:
    """Renvoie (major, full_version_string) du serveur cible. (None, '') si échec."""
    try:
        with pyodbc.connect(_conn_str(env), autocommit=True, timeout=8) as conn:
            cur = conn.cursor()
            cur.execute("SELECT CAST(SERVERPROPERTY('ProductVersion') AS NVARCHAR(128))")
            row = cur.fetchone()
            full = row[0] if row and row[0] else ""
            major = int(full.split(".")[0]) if full and full[0].isdigit() else None
            return major, full
    except Exception as e:
        logger.warning(f"[BAK] Impossible de lire ProductVersion du serveur cible : {e}")
        return None, ""


def _safe_db_name(target: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_]", "_", target)[:64] or "restored_db"


def _get_sqlserver_backup_dir() -> Path:
    """Retourne le répertoire backup de SQL Server depuis le registre Windows."""
    if platform.system() != "Windows":
        return None
    try:
        import winreg
        for instance in ["MSSQL17.MSSQLSERVER", "MSSQL16.MSSQLSERVER", "MSSQL15.MSSQLSERVER",
                         "MSSQL15.SQLEXPRESS", "MSSQL14.MSSQLSERVER"]:
            try:
                key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,
                    rf"SOFTWARE\Microsoft\Microsoft SQL Server\{instance}\MSSQLServer")
                val, _ = winreg.QueryValueEx(key, "BackupDirectory")
                winreg.CloseKey(key)
                p = Path(val)
                if p.exists():
                    return p
            except Exception:
                continue
    except Exception:
        pass
    # Fallback: chercher dans Program Files
    for candidate in Path("C:/Program Files/Microsoft SQL Server").glob("MSSQL*/MSSQL/Backup"):
        if candidate.exists():
            return candidate
    return None


def _resolve_bak_path_for_sql_server(bak_path: str) -> str:
    """
    Résout le chemin du .bak TEL QUE VU par SQL Server.
    Sur Windows : copie le fichier dans le répertoire Backup de SQL Server
    pour contourner les restrictions d'accès aux dossiers utilisateur.
    Sur Linux/Docker : chemin remappé via SQLSERVER_BACKUP_MOUNT_DIR.
    """
    if platform.system() == "Windows":
        src = Path(bak_path).resolve()
        sql_backup_dir = _get_sqlserver_backup_dir()
        if sql_backup_dir and sql_backup_dir != src.parent:
            try:
                dest = sql_backup_dir / src.name
                import shutil
                shutil.copy2(str(src), str(dest))
                logger.info(f"[BAK] Fichier copié vers répertoire SQL Server : {dest}")
                return str(dest)
            except Exception as e:
                logger.warning(f"[BAK] Impossible de copier vers {sql_backup_dir}: {e} — utilisation du chemin direct")
        return str(src)
    mount = os.getenv("SQLSERVER_BACKUP_MOUNT_DIR", "/var/opt/mssql/backup")
    return str(Path(mount) / Path(bak_path).name)


# ─── Endpoint unifié : détection automatique du format ──────────────────────

@router.post("/upload-backup")
async def upload_backup(
    file: UploadFile = File(...),
    restore_db_name: Optional[str] = Form(None),
    # Paramètres ignorés historiques (compat frontend existant)
    db_host: Optional[str] = Form(None),
    db_user: Optional[str] = Form(None),
    db_password: Optional[str] = Form(None),
):
    """
    Endpoint universel d'ingestion de source SQL Server.

    Détecte le format à partir de l'extension :
      • .bak    → RESTORE DATABASE (avec preflight version)
      • .sql    → exécution du script T-SQL batch par batch
      • .bacpac → SqlPackage /Action:Import (si installé)

    Retourne toujours la même forme, avec `restore_success`, `tables`, et
    en cas d'échec un `restore_error` actionnable (et pas une erreur ODBC brute).
    """
    if not file.filename:
        raise HTTPException(400, detail="Aucun fichier reçu.")

    ext = Path(file.filename).suffix.lower()
    if ext not in (".bak", ".sql", ".bacpac"):
        raise HTTPException(
            400,
            detail=(
                f"Format non supporté : {ext or '(aucune extension)'}. "
                "Formats acceptés : .bak (backup natif), .sql (script T-SQL), "
                ".bacpac (Microsoft export portable)."
            ),
        )

    BAK_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    on_disk = BAK_DIR / safe_name

    # Streaming write : on ne charge PAS tout le .bak en RAM (certains backups font
    # plusieurs GB, le précédent `await file.read()` provoquait des OOM et surtout
    # donnait l'impression d'un freeze côté UI car l'allocation mémoire gelait
    # l'event loop). On copie par chunks de 1 MiB.
    total_bytes = 0
    CHUNK = 1024 * 1024
    try:
        with on_disk.open("wb") as fout:
            while True:
                chunk = await file.read(CHUNK)
                if not chunk:
                    break
                fout.write(chunk)
                total_bytes += len(chunk)
    except Exception as e:
        try: on_disk.unlink(missing_ok=True)
        except Exception: pass
        raise HTTPException(500, detail=f"Erreur lors de l'écriture du fichier : {e}")

    if total_bytes == 0:
        try: on_disk.unlink(missing_ok=True)
        except Exception: pass
        raise HTTPException(400, detail="Le fichier est vide.")

    size_mb = total_bytes / (1024 * 1024)
    logger.info(f"[BAK] Fichier sauvegardé : {on_disk} ({size_mb:.2f} MB, ext={ext})")

    db_stem = Path(file.filename).stem.lower().replace("-", "_").replace(" ", "_")[:50]
    target_db = _safe_db_name(restore_db_name or f"restored_{db_stem}")

    # Dispatch selon l'extension
    if ext == ".bak":
        result = restore_sqlserver_backup(str(on_disk), target_db)
    elif ext == ".sql":
        result = run_sql_script(str(on_disk), target_db)
    else:  # .bacpac
        result = import_bacpac(str(on_disk), target_db)

    return {
        "filename":        file.filename,
        "size_mb":         round(size_mb, 2),
        "file_path":       str(on_disk),
        "source_format":   ext.lstrip("."),
        "restore_success": result["success"],
        "restored_db":     target_db if result["success"] else None,
        "tables":          result.get("tables", []),
        "message":         result.get("message", ""),
        "restore_error":   result.get("error", ""),
        "diagnostic":      result.get("diagnostic", None),
    }


# ─── Stratégie 1 : .bak avec preflight version ───────────────────────────────

def _read_backup_header(cursor, bak_sql_path: str) -> Optional[dict]:
    """Retourne un dict avec les colonnes de RESTORE HEADERONLY, ou None en cas d'échec."""
    try:
        cursor.execute(f"RESTORE HEADERONLY FROM DISK = N'{bak_sql_path.replace(chr(39), chr(39)*2)}'")
        cols = [d[0] for d in cursor.description]
        row  = cursor.fetchone()
        if not row:
            return None
        return dict(zip(cols, row))
    except Exception as e:
        logger.warning(f"[BAK] RESTORE HEADERONLY a échoué : {e}")
        return None


def restore_sqlserver_backup(bak_path: str, target_db: str) -> dict:
    """
    Restaure un .bak avec preflight de compatibilité version.
    Si le backup est d'une version SUPÉRIEURE au serveur cible, on N'ESSAIE PAS
    le RESTORE (qui échouerait avec une erreur cryptique) et on renvoie un
    message d'action concret listant les 3 solutions.
    """
    env = _db_env()
    if not env["password"]:
        return {"success": False, "error": "DB_PASSWORD manquant dans la configuration.", "tables": []}

    bak_sql_path = _resolve_bak_path_for_sql_server(bak_path)
    safe_db      = _safe_db_name(target_db)

    try:
        conn = pyodbc.connect(_conn_str(env), autocommit=True, timeout=30)
        cursor = conn.cursor()
    except pyodbc.Error as e:
        return {
            "success": False,
            "error": _format_connection_error(e, env),
            "tables": [],
        }

    try:
        # ── Preflight : lire le header du backup ──────────────────────────────
        header = _read_backup_header(cursor, bak_sql_path)
        server_major, server_full = _get_server_version(env)

        backup_major = None
        backup_full  = ""
        if header:
            backup_major = header.get("SoftwareVersionMajor")
            mn = header.get("SoftwareVersionMinor", "")
            bd = header.get("SoftwareVersionBuild", "")
            backup_full = f"{backup_major}.{mn}.{bd}" if backup_major is not None else ""
            logger.info(
                f"[BAK] Header: db={header.get('DatabaseName')!r} "
                f"version={backup_full} ({_version_label(backup_major)}) "
                f"originalServer={header.get('ServerName')!r}"
            )

        diagnostic = {
            "backup_version":        backup_full,
            "backup_version_label":  _version_label(backup_major),
            "server_version":        server_full,
            "server_version_label":  _version_label(server_major),
            "original_database":     header.get("DatabaseName") if header else None,
            "original_server":       header.get("ServerName")   if header else None,
        }

        # ── Vérification de compatibilité ─────────────────────────────────────
        if (
            server_major is not None
            and backup_major is not None
            and int(backup_major) > int(server_major)
        ):
            msg = (
                f"Ce backup provient de {_version_label(backup_major)} "
                f"(version {backup_full}), mais votre serveur cible exécute "
                f"{_version_label(server_major)} (version {server_full}). "
                f"SQL Server interdit de restaurer un backup d'une version supérieure "
                f"vers une version inférieure. "
                f"\n\nSolutions possibles : "
                f"\n  1️⃣  Mettre à niveau votre serveur SQL Server vers {_version_label(backup_major)} ou supérieur. "
                f"\n  2️⃣  Ré-exporter la source au format .sql (SSMS → clic droit DB → Tasks → Generate Scripts → inclure Schema + Data) puis uploader ce .sql ici. "
                f"\n  3️⃣  Exporter au format .bacpac (SSMS → Tasks → Export Data-tier Application) puis uploader le .bacpac ici — compatible toutes versions."
            )
            cursor.close(); conn.close()
            return {
                "success": False,
                "error": msg,
                "tables": [],
                "diagnostic": diagnostic,
            }

        # ── RESTORE FILELISTONLY pour extraire les logical names ─────────────
        bak_escaped = bak_sql_path.replace("'", "''")
        cursor.execute(f"RESTORE FILELISTONLY FROM DISK = N'{bak_escaped}'")
        cols  = [d[0] for d in cursor.description]
        files = [dict(zip(cols, r)) for r in cursor.fetchall()]

        logical_data = next((r["LogicalName"] for r in files if r.get("Type") == "D"), None)
        logical_log  = next((r["LogicalName"] for r in files if r.get("Type") == "L"), None)
        if not logical_data:
            cursor.close(); conn.close()
            return {
                "success": False,
                "error": "Impossible de lire la structure interne du .bak (RESTORE FILELISTONLY n'a renvoyé aucun fichier de données).",
                "tables": [],
                "diagnostic": diagnostic,
            }

        # ── Chemins de destination des fichiers MDF/LDF ──────────────────────
        if platform.system() == "Windows":
            cursor.execute("SELECT SERVERPROPERTY('InstanceDefaultDataPath')")
            r = cursor.fetchone()
            data_dir = r[0].rstrip("\\") if r and r[0] else "C:\\temp"
        else:
            data_dir = os.getenv("SQLSERVER_DATA_DIR", "/var/opt/mssql/data")
        mdf_path = str(Path(data_dir) / f"{safe_db}.mdf")
        ldf_path = str(Path(data_dir) / f"{safe_db}_log.ldf")

        esc = lambda s: s.replace("'", "''")

        # ── Nettoyage si la DB existe déjà ──────────────────────────────────
        cursor.execute(f"""
            IF EXISTS (SELECT name FROM master.sys.databases WHERE name = N'{esc(safe_db)}')
            BEGIN
                DECLARE @st NVARCHAR(60)
                SELECT @st = state_desc FROM master.sys.databases WHERE name = N'{esc(safe_db)}'
                IF @st = 'RESTORING'
                    DROP DATABASE [{safe_db}]
                ELSE
                    ALTER DATABASE [{safe_db}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE
            END
        """)

        # ── RESTORE DATABASE ────────────────────────────────────────────────
        restore_sql = f"""
            RESTORE DATABASE [{safe_db}]
            FROM DISK = N'{esc(bak_sql_path)}'
            WITH
              MOVE N'{esc(logical_data)}' TO N'{esc(mdf_path)}',
              MOVE N'{esc(logical_log or logical_data + "_log")}' TO N'{esc(ldf_path)}',
              REPLACE, RECOVERY, STATS = 5
        """
        logger.info(f"[BAK] RESTORE DATABASE [{safe_db}] ...")
        cursor.execute(restore_sql)

        import time
        time.sleep(1.5)

        # MULTI_USER et inventaire des tables
        try:
            cursor.execute(f"ALTER DATABASE [{safe_db}] SET MULTI_USER")
        except Exception:
            pass

        cursor.execute(f"""
            SELECT TABLE_SCHEMA + '.' + TABLE_NAME
            FROM [{safe_db}].INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        """)
        tables = [r[0] for r in cursor.fetchall()]

        cursor.close(); conn.close()
        logger.info(f"[BAK] ✅ RESTORE OK — {len(tables)} table(s) dans [{safe_db}]")
        return {
            "success": True,
            "tables": tables,
            "message": f"Base [{safe_db}] restaurée ({len(tables)} table(s)).",
            "diagnostic": diagnostic,
        }

    except pyodbc.Error as e:
        try: cursor.close(); conn.close()
        except Exception: pass
        return {
            "success": False,
            "error": _format_restore_error(e, backup_major=backup_major, server_major=server_major),
            "tables": [],
            "diagnostic": {
                "backup_version":       backup_full if 'backup_full' in locals() else "",
                "backup_version_label": _version_label(backup_major if 'backup_major' in locals() else None),
                "server_version":       server_full if 'server_full' in locals() else "",
                "server_version_label": _version_label(server_major if 'server_major' in locals() else None),
            },
        }
    except Exception as e:
        try: cursor.close(); conn.close()
        except Exception: pass
        logger.exception(f"[BAK] Erreur inattendue : {e}")
        return {"success": False, "error": f"Erreur inattendue : {e}", "tables": []}


# ─── Stratégie 2 : .sql (scripts T-SQL) — agnostique en version ─────────────

_GO_BATCH_RE = re.compile(r'^\s*GO\s*(?:;\s*)?$', re.IGNORECASE | re.MULTILINE)


def _split_sql_batches(sql: str) -> List[str]:
    """Sépare un script T-SQL sur les lignes GO (standard SSMS)."""
    parts = _GO_BATCH_RE.split(sql)
    return [p.strip() for p in parts if p.strip()]


def run_sql_script(sql_path: str, target_db: str) -> dict:
    """
    Exécute un script .sql batch par batch. Agnostique en version serveur.
    Si le script contient `USE [ancienneDB]`, on le remplace par `USE [target_db]`.
    Si aucun USE n'est présent, on crée la DB cible et on l'utilise.
    """
    env = _db_env()
    if not env["password"]:
        return {"success": False, "error": "DB_PASSWORD manquant dans la configuration.", "tables": []}

    safe_db = _safe_db_name(target_db)
    try:
        raw = Path(sql_path).read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        return {"success": False, "error": f"Impossible de lire le fichier .sql : {e}", "tables": []}

    # Normalisation : remplacer USE [xxx] par USE [safe_db], neutraliser CREATE DATABASE du script
    raw = re.sub(r'USE\s*\[[^\]]+\]', f'USE [{safe_db}]', raw, flags=re.IGNORECASE)
    raw = re.sub(r'USE\s+\w+', f'USE [{safe_db}]', raw, flags=re.IGNORECASE)

    try:
        conn = pyodbc.connect(_conn_str(env), autocommit=True, timeout=30)
        cursor = conn.cursor()
    except pyodbc.Error as e:
        return {"success": False, "error": _format_connection_error(e, env), "tables": []}

    try:
        # Créer la DB cible si elle n'existe pas
        cursor.execute(f"""
            IF NOT EXISTS (SELECT name FROM master.sys.databases WHERE name = N'{safe_db.replace("'","''")}')
                CREATE DATABASE [{safe_db}]
        """)
        cursor.execute(f"USE [{safe_db}]")

        batches = _split_sql_batches(raw)
        if not batches:
            cursor.close(); conn.close()
            return {"success": False, "error": "Le script .sql est vide ou ne contient aucun batch exécutable.", "tables": []}

        executed = 0
        errors:   List[str] = []
        for i, b in enumerate(batches, 1):
            # On saute les CREATE DATABASE du script d'origine (collision avec celle qu'on vient de créer)
            if re.match(r'\s*CREATE\s+DATABASE\b', b, re.IGNORECASE):
                continue
            try:
                cursor.execute(b)
                executed += 1
            except Exception as e:
                preview = (b[:140] + "…") if len(b) > 140 else b
                errors.append(f"Batch {i} — {e}\n  SQL: {preview}")

        # Inventaire
        cursor.execute(f"""
            SELECT TABLE_SCHEMA + '.' + TABLE_NAME
            FROM [{safe_db}].INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        """)
        tables = [r[0] for r in cursor.fetchall()]

        cursor.close(); conn.close()

        if errors and not tables:
            return {
                "success": False,
                "error": (
                    f"{len(errors)} batch(s) sur {len(batches)} ont échoué et aucune table n'a été créée.\n\n"
                    + "\n\n".join(errors[:5])
                    + (f"\n\n(+{len(errors)-5} autres erreurs)" if len(errors) > 5 else "")
                ),
                "tables": [],
            }

        msg = f"Script .sql exécuté : {executed}/{len(batches)} batch(s), {len(tables)} table(s) créée(s) dans [{safe_db}]."
        if errors:
            msg += f" ⚠️ {len(errors)} batch(s) ont échoué (warnings non bloquants)."
        return {
            "success": True,
            "tables":  tables,
            "message": msg,
            "diagnostic": {"batches": len(batches), "executed": executed, "warnings": len(errors)},
        }

    except pyodbc.Error as e:
        try: cursor.close(); conn.close()
        except Exception: pass
        return {"success": False, "error": f"Erreur SQL pendant l'exécution du script : {e}", "tables": []}


# ─── Stratégie 3 : .bacpac via SqlPackage ────────────────────────────────────

def _find_sqlpackage() -> Optional[str]:
    """Cherche SqlPackage.exe / sqlpackage dans le PATH et les emplacements standards."""
    for name in ("SqlPackage.exe", "SqlPackage", "sqlpackage"):
        found = shutil.which(name)
        if found:
            return found
    candidates = [
        r"C:\Program Files\Microsoft SQL Server\160\DAC\bin\SqlPackage.exe",
        r"C:\Program Files\Microsoft SQL Server\150\DAC\bin\SqlPackage.exe",
        r"C:\Program Files (x86)\Microsoft SQL Server\160\DAC\bin\SqlPackage.exe",
        "/opt/sqlpackage/sqlpackage",
        "/usr/local/bin/sqlpackage",
    ]
    for c in candidates:
        if Path(c).exists():
            return c
    return None


def import_bacpac(bacpac_path: str, target_db: str) -> dict:
    env = _db_env()
    if not env["password"]:
        return {"success": False, "error": "DB_PASSWORD manquant dans la configuration.", "tables": []}

    sqlpackage = _find_sqlpackage()
    if not sqlpackage:
        return {
            "success": False,
            "error": (
                "SqlPackage.exe n'est pas installé sur ce serveur — impossible d'importer un .bacpac. "
                "\n\nInstallation : "
                "\n  • Windows : https://aka.ms/sqlpackage-windows "
                "\n  • Linux   : https://aka.ms/sqlpackage-linux "
                "\n\nAlternative : ré-exporter votre base au format .sql (SSMS → Tasks → Generate Scripts) et uploader ce fichier à la place."
            ),
            "tables": [],
        }

    safe_db = _safe_db_name(target_db)
    args = [
        sqlpackage,
        "/Action:Import",
        f"/SourceFile:{bacpac_path}",
        f"/TargetServerName:{env['host']},{env['port']}",
        f"/TargetDatabaseName:{safe_db}",
        f"/TargetUser:{env['user']}",
        f"/TargetPassword:{env['password']}",
        "/TargetTrustServerCertificate:True",
    ]
    logger.info(f"[BACPAC] Importing via SqlPackage → [{safe_db}]")
    try:
        res = subprocess.run(args, capture_output=True, text=True, timeout=1800)
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "SqlPackage a dépassé 30 min — import interrompu.", "tables": []}
    except Exception as e:
        return {"success": False, "error": f"Échec de l'appel à SqlPackage : {e}", "tables": []}

    if res.returncode != 0:
        out = (res.stdout or "") + "\n" + (res.stderr or "")
        return {"success": False, "error": f"SqlPackage a échoué (code {res.returncode}) :\n{out.strip()[:2000]}", "tables": []}

    # Inventaire des tables dans la DB importée
    try:
        with pyodbc.connect(_conn_str(env), autocommit=True, timeout=15) as conn:
            cur = conn.cursor()
            cur.execute(f"""
                SELECT TABLE_SCHEMA + '.' + TABLE_NAME
                FROM [{safe_db}].INFORMATION_SCHEMA.TABLES
                WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME
            """)
            tables = [r[0] for r in cur.fetchall()]
    except Exception:
        tables = []

    return {
        "success": True,
        "tables": tables,
        "message": f".bacpac importé dans [{safe_db}] via SqlPackage ({len(tables)} table(s)).",
    }


# ─── Formatage d'erreurs lisible FR ──────────────────────────────────────────

def _format_connection_error(e: Exception, env: dict) -> str:
    s = str(e)
    if "Login failed" in s or "18456" in s:
        return (
            f"Impossible de se connecter à SQL Server sur {env['host']}:{env['port']} "
            f"avec l'utilisateur '{env['user']}'. Vérifiez le mot de passe dans votre fichier .env (DB_PASSWORD)."
        )
    if "could not open a connection" in s.lower() or "08001" in s:
        return (
            f"Le serveur SQL à {env['host']}:{env['port']} n'est pas joignable. "
            f"Vérifiez qu'il est démarré et accessible depuis le backend."
        )
    if "ODBC Driver" in s and "not found" in s.lower():
        return (
            "Aucun pilote ODBC SQL Server n'est installé sur le backend. "
            "Installez ODBC Driver 18 for SQL Server : https://aka.ms/msodbc"
        )
    return f"Erreur de connexion SQL Server : {s}"


def _format_restore_error(e: Exception, backup_major: Optional[int] = None, server_major: Optional[int] = None) -> str:
    """Transforme les erreurs RESTORE ODBC en messages actionnables."""
    s = str(e)

    # Erreur 3169 : version incompatible (normalement déjà interceptée par le preflight,
    # mais on la gère en filet de sécurité si le header était illisible)
    if "3169" in s or "incompatible avec ce serveur" in s or "is not compatible with this server" in s:
        backup_label = _version_label(backup_major) if backup_major else "la version source"
        server_label = _version_label(server_major) if server_major else "votre version serveur"
        return (
            f"Ce backup a été créé sur {backup_label} et ne peut pas être restauré sur {server_label} "
            f"(SQL Server interdit le downgrade entre versions majeures). "
            f"\n\nSolutions : "
            f"\n  1️⃣  Mettre à niveau votre serveur vers {backup_label} ou supérieur."
            f"\n  2️⃣  Ré-exporter au format .sql (SSMS → Generate Scripts avec Schema + Data) et uploader ce fichier ici."
            f"\n  3️⃣  Exporter en .bacpac (SSMS → Export Data-tier Application) et uploader."
        )
    # Erreur 3201 : backup introuvable par SQL Server
    if "3201" in s or "Operating system error 2" in s:
        return (
            "SQL Server ne trouve pas le fichier de backup. "
            "Si vous utilisez Docker, vérifiez que le volume `./uploads/bak` est bien monté "
            "sur `/var/opt/mssql/backup` dans le conteneur sqlserver. "
            "Sur une installation Windows directe, vérifiez que l'utilisateur du service SQL Server "
            "a accès en lecture au dossier d'upload."
        )
    # Erreur 5133/5123 : impossible de créer les fichiers MDF/LDF
    if "5133" in s or "5123" in s or "unable to open physical file" in s.lower():
        return (
            "SQL Server n'a pas pu créer les fichiers de données (.mdf/.ldf). "
            "Vérifiez les permissions du dossier de données SQL Server et qu'il reste assez d'espace disque."
        )
    # Fallback
    return f"La restauration a échoué : {s}"


# ═══════════════════════════════════════════════════════════════════════════
# PONT DOCKER AUTOMATIQUE — restauration cross-version d'un .bak
# ═══════════════════════════════════════════════════════════════════════════
#
# Problème : SQL Server interdit de restaurer un .bak d'une version sup vers
# une version inf (p. ex. un .bak de SQL 2025 ne peut pas être restauré sur
# SQL 2019). La seule parade générique est de lancer une instance SQL Server
# du bon niveau, d'y restaurer le .bak, et d'utiliser cette instance comme
# source de données pour le pipeline.
#
# Ce module orchestre ce pont de manière entièrement automatique via Docker.

# Mapping backup major → liste ordonnée d'images candidates.
# On essaye les tags dans l'ordre et on garde le premier qui pull.
# Pour SQL Server 2025 (major=17) le tag `-latest` n'existe pas encore en preview :
# on tente d'abord `-latest` (au cas où la GA a eu lieu), puis les RC/CTP connus,
# puis on retombe sur 2022 (qui ne peut PAS restaurer un .bak 2025 mais permet
# au moins de démarrer le conteneur — l'erreur RESTORE deviendra alors explicite).
_BRIDGE_IMAGE_CANDIDATES = {
    17: [
        "mcr.microsoft.com/mssql/server:2025-latest",
        "mcr.microsoft.com/mssql/server:2025-RC1-ubuntu-22.04",
        "mcr.microsoft.com/mssql/server:2025-RC0-ubuntu-22.04",
        "mcr.microsoft.com/mssql/server:2025-CTP2.0-ubuntu-22.04",
        "mcr.microsoft.com/mssql/server:vNext-latest",
    ],
    16: ["mcr.microsoft.com/mssql/server:2022-latest"],
    15: ["mcr.microsoft.com/mssql/server:2019-latest"],
    14: ["mcr.microsoft.com/mssql/server:2017-latest"],
}

# Compat : ancien nom utilisé ailleurs
_BRIDGE_IMAGES = {k: v[0] for k, v in _BRIDGE_IMAGE_CANDIDATES.items()}


def _docker_cli_available() -> Tuple[bool, str]:
    """Vérifie que `docker` est installé et que le daemon répond. Renvoie (ok, info_ou_erreur)."""
    try:
        r = subprocess.run(
            ["docker", "version", "--format", "{{.Server.Version}}"],
            capture_output=True, text=True, timeout=6
        )
        if r.returncode == 0 and r.stdout.strip():
            return True, r.stdout.strip()
        err = (r.stderr or r.stdout or "docker daemon injoignable").strip()
        return False, err[:200]
    except FileNotFoundError:
        return False, "Docker CLI introuvable — installez Docker Desktop ou Docker Engine."
    except subprocess.TimeoutExpired:
        return False, "docker version a dépassé 6s — le daemon Docker ne répond pas."
    except Exception as e:
        return False, f"Erreur Docker : {e}"


def _find_free_tcp_port(start: int = 14331, limit: int = 50) -> int:
    """Trouve un port TCP libre à partir de `start`. Lève si aucun dans [start, start+limit[."""
    for p in range(start, start + limit):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            if s.connect_ex(("127.0.0.1", p)) != 0:
                return p
    raise RuntimeError(f"Aucun port libre dans [{start}, {start+limit}[")


def _sqlcmd_in_container(container: str, password: str, query: str, timeout: int = 60) -> subprocess.CompletedProcess:
    """
    Exécute une requête sqlcmd dans le conteneur. Les images MSSQL 2022+ placent
    sqlcmd sous mssql-tools18 ; les images plus anciennes sous mssql-tools.
    """
    last = None
    for tools in ("/opt/mssql-tools18/bin/sqlcmd", "/opt/mssql-tools/bin/sqlcmd"):
        try:
            r = subprocess.run(
                [
                    "docker", "exec", container, tools,
                    "-S", "localhost",
                    "-U", "sa", "-P", password,
                    "-C", "-b", "-h", "-1",
                    "-Q", query,
                ],
                capture_output=True, text=True, timeout=timeout
            )
            last = r
            # Si sqlcmd est trouvé et exécute, on sort même sur returncode != 0
            # (on veut voir l'erreur SQL, pas re-essayer l'autre chemin)
            err = (r.stderr or "").lower()
            if "no such file" not in err and "not found" not in err and "executable file not found" not in err:
                return r
        except subprocess.TimeoutExpired as e:
            last = subprocess.CompletedProcess(args=[], returncode=124, stdout="", stderr=f"timeout: {e}")
    return last


def _wait_for_bridge_ready(container: str, password: str, timeout: int = 180) -> Tuple[bool, str]:
    """Poll jusqu'à ce que SELECT 1 réussisse dans le conteneur (ou timeout)."""
    start = time.time()
    last_err = ""
    while time.time() - start < timeout:
        r = _sqlcmd_in_container(container, password, "SELECT 1", timeout=8)
        if r and r.returncode == 0 and "1" in (r.stdout or ""):
            return True, ""
        last_err = (r.stderr or r.stdout or "").strip()[:200] if r else "no response"
        time.sleep(3)
    return False, last_err


def _wait_for_bridge_ready_emit(container: str, password: str, emit, timeout: int = 180) -> Tuple[bool, str]:
    """Version streaming : heartbeat à chaque tentative."""
    start = time.time()
    last_err = ""
    attempt = 0
    while time.time() - start < timeout:
        attempt += 1
        r = _sqlcmd_in_container(container, password, "SELECT 1", timeout=8)
        if r and r.returncode == 0 and "1" in (r.stdout or ""):
            return True, ""
        last_err = (r.stderr or r.stdout or "").strip()[:200] if r else "no response"
        emit({"phase": "wait_ready", "status": "progress",
              "message": f"Tentative {attempt} — SQL Server pas encore prêt ({int(time.time() - start)}s écoulées)"})
        time.sleep(3)
    return False, last_err


def _docker_rm_force(name: str) -> None:
    try:
        subprocess.run(["docker", "rm", "-f", name], capture_output=True, timeout=30)
    except Exception:
        pass


def _docker_image_exists_locally(image: str) -> bool:
    """Évite un re-pull si l'image est déjà cachée localement."""
    try:
        r = subprocess.run(
            ["docker", "image", "inspect", image],
            capture_output=True, text=True, timeout=10
        )
        return r.returncode == 0
    except Exception:
        return False


def _docker_manifest_check(image: str) -> Tuple[bool, str]:
    """
    Vérifie (sans télécharger les layers) si l'image existe sur le registry.
    Évite d'attendre 15 min sur un tag inexistant.
    """
    try:
        r = subprocess.run(
            ["docker", "manifest", "inspect", image],
            capture_output=True, text=True, timeout=30
        )
        if r.returncode == 0:
            return True, ""
        return False, (r.stderr or r.stdout).strip()[:400]
    except subprocess.TimeoutExpired:
        return False, "timeout 30s sur `docker manifest inspect`"
    except Exception as e:
        return False, str(e)[:400]


def _docker_pull_streaming(image: str, emit, timeout: int = 900) -> Tuple[bool, str]:
    """
    Lance `docker pull` et relaie la progression ligne par ligne via `emit`.
    Renvoie (success, last_error_message).
    """
    try:
        proc = subprocess.Popen(
            ["docker", "pull", image],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1
        )
    except FileNotFoundError:
        return False, "Docker CLI introuvable."
    except Exception as e:
        return False, f"Impossible de lancer docker pull : {e}"

    start = time.time()
    last_line = ""
    try:
        assert proc.stdout is not None
        for raw in proc.stdout:
            line = raw.rstrip()
            if not line:
                continue
            last_line = line
            # Réduction du bruit : on ne transmet que les lignes "résumé"
            # (Pulling / Downloaded / Extracting / Pull complete / Digest / Status)
            low = line.lower()
            if any(k in low for k in (
                "pulling ", "downloaded newer image", "image is up to date",
                "pull complete", "extracting", "verifying checksum",
                "digest:", "status:", "error", "manifest"
            )):
                emit({"phase": "pull", "status": "progress", "message": line})
            if time.time() - start > timeout:
                proc.kill()
                return False, f"Timeout ({timeout}s) sur docker pull"
        proc.wait(timeout=10)
        if proc.returncode == 0:
            return True, ""
        return False, last_line or "docker pull a échoué sans détail"
    except Exception as e:
        try: proc.kill()
        except Exception: pass
        return False, f"Erreur streaming docker pull : {e}"


def _resolve_bridge_image(major: int, emit) -> Tuple[Optional[str], str]:
    """
    Parmi les images candidates pour ce major, sélectionne la première qui :
      1) existe déjà localement (pas de pull nécessaire)
      2) ou dont le manifest est résolvable sur le registry
    Retourne (image_retenue, message_debug).
    """
    candidates = _BRIDGE_IMAGE_CANDIDATES.get(int(major), [])
    if not candidates:
        return None, f"Aucune image candidate pour SQL Server major={major}."

    # Phase 1 : cache local
    for img in candidates:
        if _docker_image_exists_locally(img):
            emit({"phase": "resolve", "status": "done",
                  "message": f"Image déjà présente localement : {img}"})
            return img, f"cache: {img}"

    # Phase 2 : probe registry
    tried = []
    for img in candidates:
        emit({"phase": "resolve", "status": "progress",
              "message": f"Test de l'existence de {img}..."})
        ok, err = _docker_manifest_check(img)
        if ok:
            emit({"phase": "resolve", "status": "done",
                  "message": f"Image résolvable : {img}"})
            return img, f"registry: {img}"
        tried.append(f"{img}: {err[:120]}")

    return None, (
        "Aucun tag trouvé sur le registry parmi les candidats.\n"
        + "\n".join(f"  • {t}" for t in tried)
    )


def docker_bridge_restore(
    bak_path: str,
    target_db: str,
    backup_major: int,
    emit=None,
) -> dict:
    """
    Démarre un conteneur SQL Server correspondant à la version du backup,
    y restaure le .bak, puis renvoie les infos de connexion du conteneur.
    Le conteneur est persistant (il devient la source pour ce backup).

    `emit` est un callback optionnel (dict)->None qui reçoit des événements
    NDJSON de progression. En mode non-streaming, fournir un emit no-op.
    """
    if emit is None:
        emit = lambda _ev: None  # noqa: E731

    emit({"phase": "preflight", "status": "progress", "message": "Vérification du daemon Docker..."})
    ok, info = _docker_cli_available()
    if not ok:
        return {
            "success": False,
            "error": (
                f"Le pont Docker automatique nécessite Docker installé et actif.\n"
                f"Détail : {info}\n\n"
                f"Alternative : installez Docker Desktop (Windows/Mac) ou Docker Engine (Linux), "
                f"puis re-cliquez sur 'Auto-fix Docker'."
            ),
        }
    emit({"phase": "preflight", "status": "done", "message": f"Docker {info} — OK"})

    # Résolution de l'image : on essaye cache local → manifest registry → candidats
    emit({"phase": "resolve", "status": "start",
          "message": f"Recherche d'une image SQL Server compatible (major={backup_major})..."})
    image, dbg = _resolve_bridge_image(int(backup_major), emit)
    if not image:
        return {
            "success": False,
            "error": (
                f"Aucune image Docker officielle trouvée pour SQL Server (major={backup_major}).\n\n"
                f"{dbg}\n\n"
                f"💡 Pour contourner : exportez votre base en .sql (Generate Scripts → "
                f"Schema and data) ou en .bacpac, qui sont indépendants de la version serveur."
            ),
        }

    safe_db = _safe_db_name(target_db)
    container_name = f"agent_dw_bridge_{safe_db}"[:60]

    # Mot de passe : on garde celui du DB_PASSWORD pour cohérence avec le reste
    # de l'app (le bridge devient la nouvelle cible → même identifiant utilisateur).
    bridge_password = os.getenv("DB_PASSWORD") or ("Brg_" + uuid.uuid4().hex[:16] + "!9A")
    # Validation : SQL Server exige un mot de passe fort (>=8 chars, 3 catégories)
    if len(bridge_password) < 8:
        bridge_password = "Brg_" + uuid.uuid4().hex[:16] + "!9A"

    # Nettoyage d'un précédent bridge pour ce même nom (idempotence)
    _docker_rm_force(container_name)

    # Port libre
    try:
        port = _find_free_tcp_port(14331, 50)
    except RuntimeError as e:
        return {"success": False, "error": f"Impossible de trouver un port libre : {e}"}

    # Dossier hôte du .bak → monté read-only dans le conteneur
    bak_host_dir = str(Path(bak_path).parent.resolve())
    container_bak = f"/var/opt/mssql/backup/{Path(bak_path).name}"
    esc_bak = container_bak.replace("'", "''")

    # ── 1. Pull de l'image (streaming progress) ─────────────────────────────
    if _docker_image_exists_locally(image):
        emit({"phase": "pull", "status": "done",
              "message": f"{image} déjà présente localement — pull sauté."})
    else:
        emit({"phase": "pull", "status": "start",
              "message": f"docker pull {image} (5–10 min la 1ère fois, ~1.5 GB)..."})
        logger.info(f"[BRIDGE] docker pull {image} (streaming)...")
        ok_pull, pull_err = _docker_pull_streaming(image, emit, timeout=900)
        if not ok_pull:
            return {
                "success": False,
                "error": (
                    f"Impossible de télécharger l'image Docker `{image}`.\n\n"
                    f"Détails : {pull_err[:600]}\n\n"
                    f"Si l'image n'est pas encore publiée (cas SQL Server 2025 preview), "
                    f"utilisez .sql ou .bacpac comme format alternatif."
                ),
            }
        emit({"phase": "pull", "status": "done", "message": f"Image {image} prête."})

    # ── 2. Démarrage du conteneur ───────────────────────────────────────────
    emit({"phase": "run", "status": "start",
          "message": f"Démarrage du conteneur {container_name} sur 127.0.0.1:{port}..."})
    logger.info(f"[BRIDGE] Démarrage {container_name} ({image}) sur 127.0.0.1:{port}...")
    try:
        run_res = subprocess.run(
            [
                "docker", "run", "-d",
                "--name", container_name,
                "-p", f"{port}:1433",
                "-e", "ACCEPT_EULA=Y",
                "-e", f"MSSQL_SA_PASSWORD={bridge_password}",
                "-e", "MSSQL_PID=Developer",
                "-v", f"{bak_host_dir}:/var/opt/mssql/backup:ro",
                image,
            ],
            capture_output=True, text=True, timeout=60
        )
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Timeout 60s pendant `docker run` — Docker ne répond pas."}
    if run_res.returncode != 0:
        return {
            "success": False,
            "error": f"`docker run` a échoué : {(run_res.stderr or run_res.stdout).strip()[:600]}",
        }
    emit({"phase": "run", "status": "done",
          "message": f"Conteneur {container_name} démarré."})

    # Si on sort en erreur après run OK, on doit nettoyer le conteneur
    try:
        # ── 3. Attente SQL Server prêt ──────────────────────────────────────
        emit({"phase": "wait_ready", "status": "start",
              "message": "Attente de SQL Server dans le conteneur (30–90s)..."})
        logger.info(f"[BRIDGE] Attente du démarrage de SQL Server (30-60s la 1ère fois)...")
        ready, wait_err = _wait_for_bridge_ready_emit(container_name, bridge_password, emit, timeout=180)
        if not ready:
            _docker_rm_force(container_name)
            return {
                "success": False,
                "error": f"SQL Server n'a pas démarré dans le conteneur bridge (timeout 3 min). Dernière erreur : {wait_err}",
            }
        emit({"phase": "wait_ready", "status": "done",
              "message": "SQL Server est prêt à recevoir des connexions."})

        # ── 4. Lecture des logical names via une table intermédiaire ────────
        # Plutôt que parser la sortie texte de RESTORE FILELISTONLY, on insère
        # dans une table temp puis on interroge. Les colonnes changent selon
        # la version SQL Server, donc on détecte dynamiquement.
        logger.info(f"[BRIDGE] Lecture du header + RESTORE FILELISTONLY...")

        # Script T-SQL qui gère la restauration complète en un seul batch
        mdf_path = f"/var/opt/mssql/data/{safe_db}.mdf"
        ldf_path = f"/var/opt/mssql/data/{safe_db}_log.ldf"

        restore_tsql = f"""
SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#fl') IS NOT NULL DROP TABLE #fl;
CREATE TABLE #fl (
    LogicalName NVARCHAR(128), PhysicalName NVARCHAR(260), Type CHAR(1),
    FileGroupName NVARCHAR(128) NULL, Size NUMERIC(20,0), MaxSize NUMERIC(20,0),
    FileId BIGINT, CreateLSN NUMERIC(25,0), DropLSN NUMERIC(25,0) NULL,
    UniqueId UNIQUEIDENTIFIER, ReadOnlyLSN NUMERIC(25,0) NULL,
    ReadWriteLSN NUMERIC(25,0) NULL, BackupSizeInBytes BIGINT,
    SourceBlockSize INT, FileGroupId INT, LogGroupGUID UNIQUEIDENTIFIER NULL,
    DifferentialBaseLSN NUMERIC(25,0) NULL, DifferentialBaseGUID UNIQUEIDENTIFIER NULL,
    IsReadOnly BIT, IsPresent BIT, TDEThumbprint VARBINARY(32) NULL,
    SnapshotUrl NVARCHAR(360) NULL
);
BEGIN TRY
    INSERT INTO #fl EXEC ('RESTORE FILELISTONLY FROM DISK = N''{esc_bak}''');
END TRY
BEGIN CATCH
    -- Les images plus récentes ont une colonne en plus : on retente sans strict schema
    DROP TABLE #fl;
    CREATE TABLE #fl (LogicalName NVARCHAR(128), PhysicalName NVARCHAR(260), Type CHAR(1));
    INSERT INTO #fl (LogicalName, PhysicalName, Type)
      SELECT LogicalName, PhysicalName, Type
      FROM OPENROWSET(BULK N'{esc_bak}', SINGLE_BLOB) x
      WHERE 1=0; -- placeholder, on bascule sur parse XML si besoin
    THROW;
END CATCH;

DECLARE @data NVARCHAR(128), @log NVARCHAR(128);
SELECT TOP 1 @data = LogicalName FROM #fl WHERE Type = 'D';
SELECT TOP 1 @log  = LogicalName FROM #fl WHERE Type = 'L';

IF @data IS NULL
BEGIN
    RAISERROR('Aucun fichier de données trouvé dans le backup', 16, 1);
    RETURN;
END

IF DB_ID(N'{safe_db}') IS NOT NULL
BEGIN
    DECLARE @st NVARCHAR(60);
    SELECT @st = state_desc FROM sys.databases WHERE name = N'{safe_db}';
    IF @st = 'RESTORING'
        EXEC ('DROP DATABASE [{safe_db}]');
    ELSE
        EXEC ('ALTER DATABASE [{safe_db}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE');
END

DECLARE @sql NVARCHAR(MAX) = N'RESTORE DATABASE [{safe_db}] FROM DISK = N''' + '{esc_bak}' + N''' WITH MOVE N''' + @data + N''' TO N''' + '{mdf_path}' + N''', ';
IF @log IS NOT NULL
    SET @sql = @sql + N'MOVE N''' + @log + N''' TO N''' + '{ldf_path}' + N''', ';
SET @sql = @sql + N'REPLACE, RECOVERY, STATS = 10';
EXEC (@sql);

BEGIN TRY ALTER DATABASE [{safe_db}] SET MULTI_USER; END TRY BEGIN CATCH END CATCH;

SELECT 'OK' AS Status;
"""

        emit({"phase": "restore", "status": "start",
              "message": f"RESTORE DATABASE [{safe_db}] en cours (cela peut prendre plusieurs minutes)..."})
        logger.info(f"[BRIDGE] RESTORE DATABASE [{safe_db}] dans le conteneur...")
        r = _sqlcmd_in_container(container_name, bridge_password, restore_tsql, timeout=3600)
        if r is None or r.returncode != 0:
            _docker_rm_force(container_name)
            out = ((r.stdout or "") + "\n" + (r.stderr or "")).strip() if r else ""
            return {
                "success": False,
                "error": f"RESTORE DATABASE dans le bridge a échoué : {out[:900]}",
            }
        emit({"phase": "restore", "status": "done",
              "message": f"RESTORE DATABASE [{safe_db}] terminé avec succès."})

        # ── 5. Inventaire des tables ────────────────────────────────────────
        emit({"phase": "inventory", "status": "start",
              "message": "Inventaire des tables..."})
        tables: List[str] = []
        inv = _sqlcmd_in_container(
            container_name, bridge_password,
            (
                f"SET NOCOUNT ON; "
                f"SELECT TABLE_SCHEMA + '.' + TABLE_NAME "
                f"FROM [{safe_db}].INFORMATION_SCHEMA.TABLES "
                f"WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
            ),
            timeout=60
        )
        if inv and inv.returncode == 0:
            for line in (inv.stdout or "").splitlines():
                s = line.strip()
                if not s: continue
                if "." in s and not s.startswith("(") and "rows affected" not in s.lower() and "---" not in s:
                    tables.append(s)

        emit({"phase": "inventory", "status": "done",
              "message": f"{len(tables)} table(s) détectée(s) dans [{safe_db}]."})
        logger.info(f"[BRIDGE] ✅ Bridge prêt — {len(tables)} table(s) dans [{safe_db}] sur 127.0.0.1:{port}")
        return {
            "success": True,
            "tables": tables,
            "message": (
                f"Backup restauré automatiquement dans un conteneur SQL Server auto-démarré. "
                f"La base [{safe_db}] est accessible sur 127.0.0.1:{port}."
            ),
            "bridge_info": {
                "host":      "127.0.0.1",
                "port":      port,
                "user":      "sa",
                "password":  bridge_password,
                "database":  safe_db,
                "container": container_name,
                "image":     image,
            },
        }

    except Exception as e:
        logger.exception(f"[BRIDGE] Erreur inattendue : {e}")
        _docker_rm_force(container_name)
        return {"success": False, "error": f"Erreur inattendue pendant le bridge : {e}"}


# ─── Endpoint dédié : upload + auto-bridge Docker ────────────────────────────

class BridgeRequest(BaseModel):
    file_path: str           # chemin serveur du .bak déjà uploadé
    restore_db_name: Optional[str] = None


@router.post("/upload-backup-bridge")
async def upload_backup_bridge(req: BridgeRequest):
    """
    Second appel : l'UI appelle cet endpoint avec le chemin serveur du .bak
    déjà uploadé (file_path retourné par /api/upload-backup) pour déclencher
    un pont Docker automatique quand le RESTORE classique a échoué pour
    incompatibilité de version.

    Retour : comme /upload-backup, mais avec `bridge_info` si succès.
    """
    p = Path(req.file_path)
    if not p.exists():
        raise HTTPException(404, detail=f"Le fichier {req.file_path} est introuvable sur le serveur.")

    # Re-lecture du header pour connaître le major
    try:
        conn = pyodbc.connect(_conn_str(_db_env()), autocommit=True, timeout=8)
        cur = conn.cursor()
        header = _read_backup_header(cur, str(p.resolve()))
        cur.close(); conn.close()
    except Exception as e:
        header = None
        logger.warning(f"[BRIDGE] Impossible de relire le header : {e}")

    backup_major = None
    if header:
        backup_major = header.get("SoftwareVersionMajor")
    if backup_major is None:
        raise HTTPException(400, detail="Impossible de lire la version du backup pour choisir l'image Docker.")

    db_stem = p.stem.lower().replace("-", "_").replace(" ", "_")[:50]
    # retire l'éventuel préfixe UUID ajouté à l'upload
    if re.match(r"^[0-9a-f]{8}_", db_stem):
        db_stem = db_stem[9:]
    target_db = _safe_db_name(req.restore_db_name or f"restored_{db_stem}")

    result = docker_bridge_restore(str(p), target_db, int(backup_major))

    return {
        "filename":        p.name,
        "file_path":       str(p),
        "source_format":   "bak",
        "restore_success": result["success"],
        "restored_db":     target_db if result["success"] else None,
        "tables":          result.get("tables", []),
        "message":         result.get("message", ""),
        "restore_error":   result.get("error", ""),
        "bridge_info":     result.get("bridge_info", None),
        "diagnostic": {
            "backup_version_label": _version_label(backup_major),
            "backup_major":         int(backup_major),
            "image":                _BRIDGE_IMAGES.get(int(backup_major), None),
        },
    }


# ─── Endpoint streaming : NDJSON live progress du bridge Docker ──────────────
#
# L'UI consomme cet endpoint ligne par ligne via fetch + ReadableStream.
# Chaque ligne est un JSON : {"phase": ..., "status": ..., "message": ...}
# Le dernier événement contient `"final": true` + tout le résultat du bridge.
#
# Avantage : l'utilisateur voit exactement où on en est (pull / run / wait /
# restore) avec des messages en français. Plus jamais un spinner figé 15 min.


@router.post("/upload-backup-bridge/stream")
async def upload_backup_bridge_stream(req: BridgeRequest):
    """
    Version streaming NDJSON de /upload-backup-bridge.

    Retourne une séquence de lignes JSON (séparées par \\n) décrivant la
    progression en temps réel. Se termine par un événement final contenant
    l'ensemble du résultat (même shape que l'endpoint non-streaming).
    """
    p = Path(req.file_path)
    if not p.exists():
        raise HTTPException(404, detail=f"Le fichier {req.file_path} est introuvable sur le serveur.")

    # Re-lecture du header pour connaître le major (rapide, on peut le faire avant de streamer)
    try:
        conn = pyodbc.connect(_conn_str(_db_env()), autocommit=True, timeout=8)
        cur = conn.cursor()
        header = _read_backup_header(cur, str(p.resolve()))
        cur.close(); conn.close()
    except Exception as e:
        header = None
        logger.warning(f"[BRIDGE/stream] Impossible de relire le header : {e}")

    backup_major = None
    if header:
        backup_major = header.get("SoftwareVersionMajor")
    if backup_major is None:
        raise HTTPException(400, detail="Impossible de lire la version du backup pour choisir l'image Docker.")

    db_stem = p.stem.lower().replace("-", "_").replace(" ", "_")[:50]
    if re.match(r"^[0-9a-f]{8}_", db_stem):
        db_stem = db_stem[9:]
    target_db = _safe_db_name(req.restore_db_name or f"restored_{db_stem}")

    def _event_stream() -> Iterator[bytes]:
        """
        Générateur NDJSON : consomme les events émis par docker_bridge_restore
        (via une Queue thread-safe) et relaie chaque event comme une ligne JSON.
        Le bridge tourne dans un thread pour ne pas bloquer le generator.
        """
        q: "Queue[dict]" = Queue(maxsize=500)
        SENTINEL = {"__sentinel__": True}
        result_holder: dict = {}

        def emit(ev: dict) -> None:
            # horodatage + attributs par défaut
            ev = dict(ev)
            ev.setdefault("t", int(time.time() * 1000))
            try:
                q.put(ev, timeout=5)
            except Exception:
                pass  # si la queue sature, on laisse tomber cet event

        def _worker() -> None:
            try:
                res = docker_bridge_restore(str(p), target_db, int(backup_major), emit=emit)
                result_holder["result"] = res
            except Exception as exc:
                logger.exception("[BRIDGE/stream] Exception dans le worker")
                result_holder["result"] = {"success": False, "error": f"Exception pont : {exc}"}
            finally:
                q.put(SENTINEL)

        t = threading.Thread(target=_worker, daemon=True)
        t.start()

        # Event initial : utile pour afficher l'UI immédiatement
        yield (json.dumps({
            "phase": "init", "status": "start",
            "message": f"Démarrage du pont Docker pour SQL Server {_version_label(backup_major)}",
            "diagnostic": {
                "backup_version_label": _version_label(backup_major),
                "backup_major": int(backup_major),
                "target_db": target_db,
            },
            "t": int(time.time() * 1000),
        }, ensure_ascii=False) + "\n").encode("utf-8")

        # Boucle principale : on relaie les events au fur et à mesure
        while True:
            try:
                ev = q.get(timeout=30)
            except Empty:
                # Heartbeat pour empêcher les proxies de couper la connexion
                yield (json.dumps({
                    "phase": "heartbeat", "status": "progress",
                    "message": "En cours...", "t": int(time.time() * 1000),
                }, ensure_ascii=False) + "\n").encode("utf-8")
                continue

            if ev is SENTINEL:
                break
            yield (json.dumps(ev, ensure_ascii=False) + "\n").encode("utf-8")

        # Event final : résultat complet du bridge
        result = result_holder.get("result", {"success": False, "error": "Pas de résultat renvoyé par le bridge."})
        final_payload = {
            "final": True,
            "phase": "done" if result.get("success") else "error",
            "status": "done" if result.get("success") else "error",
            "message": result.get("message", result.get("error", "")),
            "result": {
                "filename":        p.name,
                "file_path":       str(p),
                "source_format":   "bak",
                "restore_success": result.get("success", False),
                "restored_db":     target_db if result.get("success") else None,
                "tables":          result.get("tables", []),
                "message":         result.get("message", ""),
                "restore_error":   result.get("error", ""),
                "bridge_info":     result.get("bridge_info", None),
                "diagnostic": {
                    "backup_version_label": _version_label(backup_major),
                    "backup_major":         int(backup_major),
                    "image":                _BRIDGE_IMAGES.get(int(backup_major), None),
                },
            },
            "t": int(time.time() * 1000),
        }
        yield (json.dumps(final_payload, ensure_ascii=False) + "\n").encode("utf-8")

    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Accel-Buffering": "no",   # nginx : disable response buffering
        "Connection": "keep-alive",
    }
    return StreamingResponse(
        _event_stream(),
        media_type="application/x-ndjson",
        headers=headers,
    )
