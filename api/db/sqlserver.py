# api/db/sqlserver.py — Couche d'accès aux données SQL Server (métadonnées sessions)
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

def get_meta_connection(db_name="agent_dw_meta"):
    """Connexion à SQL Server via pyodbc."""
    import pyodbc
    password = os.getenv("DB_PASSWORD")
    host     = os.getenv("DB_HOST", "127.0.0.1")
    user     = os.getenv("DB_USER", "sa")
    if not password:
        raise RuntimeError("DB_PASSWORD manquant dans l'environnement")
    conn_str = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={host},1433;DATABASE={db_name};"
        f"UID={user};PWD={{{password}}};TrustServerCertificate=yes;"
    )
    return pyodbc.connect(conn_str, autocommit=True)

def init_metadata_db() -> None:
    """Crée la base de métadonnées et ses tables si elles n'existent pas."""
    try:
        # Création de la DB
        conn = get_meta_connection("master")
        cursor = conn.cursor()
        cursor.execute("IF NOT EXISTS (SELECT name FROM master.dbo.sysdatabases WHERE name = N'agent_dw_meta') CREATE DATABASE [agent_dw_meta]")
        cursor.close()
        conn.close()

        # Création des tables
        conn = get_meta_connection("agent_dw_meta")
        cursor = conn.cursor()
        cursor.execute("""
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
            CREATE TABLE users (
                id INT IDENTITY(1,1) PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                prefix VARCHAR(50) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='sessions' AND xtype='U')
            CREATE TABLE sessions (
                id VARCHAR(100) PRIMARY KEY,
                user_id INT NOT NULL,
                state_json VARCHAR(MAX),
                status VARCHAR(50) DEFAULT 'running',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        cursor.close()
        conn.close()
        logger.info("[DB] Tables de métadonnées initialisées sous SQL Server")
    except Exception as e:
        logger.warning(f"[DB] Impossible d'initialiser SQL Server : {e}")


def save_session_state(session_id: str, user_id: int, state: dict) -> None:
    import json
    try:
        conn = get_meta_connection()
        cursor = conn.cursor()
        # SQL Server UPSERT via MERGE
        state_str = json.dumps(state, default=str)
        cursor.execute("""
            MERGE sessions AS target
            USING (SELECT ? AS id, ? AS user_id, ? AS state_json, 'running' AS status) AS source
            ON target.id = source.id
            WHEN MATCHED THEN 
                UPDATE SET state_json = source.state_json, updated_at = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (id, user_id, state_json, status)
                VALUES (source.id, source.user_id, source.state_json, source.status);
        """, (session_id, user_id, state_str))
        cursor.close()
        conn.close()
    except Exception as e:
        logger.error(f"[DB] Erreur sauvegarde session {session_id} : {e}")

def get_session_state(session_id: str) -> Optional[dict]:
    import json
    try:
        conn = get_meta_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT state_json FROM sessions WHERE id = ?", (session_id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if row and row[0]:
            return json.loads(row[0])
    except Exception as e:
        logger.error(f"[DB] Erreur lecture session {session_id} : {e}")
    return None

def list_user_sessions(user_id: int) -> list:
    try:
        conn = get_meta_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT TOP 20 id, status, created_at, updated_at
            FROM sessions WHERE user_id = ?
            ORDER BY updated_at DESC
        """, (user_id,))
        columns = [column[0] for column in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        return rows
    except Exception as e:
        logger.error(f"[DB] Erreur liste sessions user {user_id} : {e}")
        return []
