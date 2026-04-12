# api/db/mysql.py — Couche d'accès aux données MySQL (métadonnées sessions)
import os
import logging
import mysql.connector
from mysql.connector import Error as MySQLError
from typing import Optional

logger = logging.getLogger(__name__)


def get_meta_connection():
    """Connexion à la base MySQL de métadonnées (sessions, users)."""
    password = os.getenv("DB_PASSWORD")
    if not password:
        raise RuntimeError(
            "Variable d'environnement DB_PASSWORD manquante. "
            "Ajoutez DB_PASSWORD=votre_mot_de_passe dans votre fichier .env"
        )
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=password,
        database=os.getenv("DB_NAME", "agent_dw_meta"),
        connection_timeout=10,
    )


def init_metadata_db() -> None:
    """Crée les tables de métadonnées si elles n'existent pas."""
    try:
        conn = get_meta_connection()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                prefix VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id VARCHAR(100) PRIMARY KEY,
                user_id INT NOT NULL,
                state_json LONGTEXT,
                status VARCHAR(50) DEFAULT 'running',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            ) ENGINE=InnoDB;
        """)
        conn.commit()
        cursor.close()
        conn.close()
        logger.info("[DB] Tables de métadonnées initialisées")
    except MySQLError as e:
        logger.warning(f"[DB] Impossible d'initialiser la DB métadonnées : {e}")


def save_session_state(session_id: str, user_id: int, state: dict) -> None:
    """Sauvegarde l'état d'une session en base."""
    import json
    try:
        conn = get_meta_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO sessions (id, user_id, state_json, status)
            VALUES (%s, %s, %s, 'running')
            ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = NOW()
        """, (session_id, user_id, json.dumps(state, default=str)))
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        logger.error(f"[DB] Erreur sauvegarde session {session_id} : {e}")


def get_session_state(session_id: str) -> Optional[dict]:
    """Récupère l'état d'une session depuis la base."""
    import json
    try:
        conn = get_meta_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT state_json FROM sessions WHERE id = %s", (session_id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if row and row.get("state_json"):
            return json.loads(row["state_json"])
    except Exception as e:
        logger.error(f"[DB] Erreur lecture session {session_id} : {e}")
    return None


def list_user_sessions(user_id: int) -> list:
    """Liste les sessions d'un utilisateur."""
    try:
        conn = get_meta_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, status, created_at, updated_at
            FROM sessions WHERE user_id = %s
            ORDER BY updated_at DESC LIMIT 20
        """, (user_id,))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return rows
    except Exception as e:
        logger.error(f"[DB] Erreur liste sessions user {user_id} : {e}")
        return []
