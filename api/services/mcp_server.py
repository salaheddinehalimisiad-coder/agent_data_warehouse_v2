# api/services/mcp_server.py — Protocole MCP (Lecteur de Schéma)
import os
import logging
from sqlalchemy import create_engine, inspect
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

def _get_sql_server_engine(database_name: str):
    """Génère l'Engine de connexion Read-Only vers SQL Server pour les requêtes MCP."""
    password = os.getenv("DB_PASSWORD", "StrongP@ssw0rd!")
    host = os.getenv("DB_HOST", "sqlserver")
    url = f"mssql+pyodbc://sa:{password}@{host}:1433/{database_name}?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes"
    return create_engine(url)

@tool
def mcp_read_schema(database_name: str = "master") -> str:
    """
    [Serveur MCP - Outil de Lecture] 
    Interroge directement SQL Server (via INFORMATION_SCHEMA interne) pour 
    retourner la structure physique précise d'une base de données.
    Axe de sécurité : Lecture seule (Inspect) garantie.
    """
    logger.info(f"⚡ [MCP] Appel sécurité pour lire le schéma de la base : {database_name}")
    try:
        engine = _get_sql_server_engine(database_name)
        inspector = inspect(engine)
        schema_dump = []
        for table in inspector.get_table_names():
            columns = inspector.get_columns(table)
            col_strings = [f"{c['name']} ({c['type']})" for c in columns]
            schema_dump.append(f"Table [{table}] : " + ", ".join(col_strings))
        
        return "\n".join(schema_dump) if schema_dump else "La base est vide."
        
    except Exception as e:
        logger.error(f"[MCP Server] Erreur critique d'inspection : {e}")
        return f"ERREUR_MCP_INSPECTION : Impossible d'accéder au schéma. Détails: {e}"
