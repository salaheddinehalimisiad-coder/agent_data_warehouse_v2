# nodes/explorer.py — Agent Explorateur : extraction des métadonnées source
import os
import logging
from typing import Dict, Any
from app_state import AgentState

logger = logging.getLogger(__name__)


def _to_python_types(obj: Any) -> Any:
    """Convertit récursivement les types numpy en types Python standard."""
    import numpy as np
    if isinstance(obj, dict):
        return {k: _to_python_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_to_python_types(i) for i in obj]
    elif isinstance(obj, (np.integer, np.floating)):
        return obj.item()
    elif isinstance(obj, np.ndarray):
        return _to_python_types(obj.tolist())
    return obj


def explorer_node(state: AgentState) -> dict:
    """
    Extrait les métadonnées de la source (CSV ou SQL) :
    - Liste des tables / colonnes
    - Types de données
    - Statistiques descriptives (nunique, nulls, sample)
    """
    logger.info("--- AGENT EXPLORER : Analyse de la source ---")
    config = state.get("connection_config", {})
    source_type = config.get("type", "csv")

    try:
        if source_type == "csv":
            metadata = _explore_csv(config)
        elif source_type in ("excel", "xlsx", "xls"):
            metadata = _explore_excel(config)
        elif source_type in ("mysql", "postgresql", "postgres", "sqlite", "sqlserver", "mssql", "bak"):
            metadata = _explore_sql(config, state.get("dw_connection_config"))
        elif source_type == "rest_api":
            metadata = _explore_rest_api(config)
        else:
            raise ValueError(f"Type de source non supporté : {source_type}")

        metadata = _to_python_types(metadata)
        logger.info(f"[Explorer] Métadonnées extraites : {list(metadata.keys())}")
        return {
            "source_metadata": metadata,
            "execution_log": state.get("execution_log", []) + [
                f"[Explorer] Source analysée ({source_type}) — {len(metadata)} table(s) détectée(s)"
            ]
        }

    except Exception as e:
        logger.error(f"[Explorer] Erreur lors de l'exploration : {e}")
        return {
            "source_metadata": {},
            "execution_log": state.get("execution_log", []) + [f"[Explorer] ERREUR : {e}"]
        }


def _build_column_meta(df, col: str) -> dict:
    """Extrait des statistiques riches par colonne."""
    series = df[col]
    dtype  = str(series.dtype)
    meta = {
        "name":         col,
        "dtype":        dtype,
        "null_count":   int(series.isnull().sum()),
        "null_pct":     round(series.isnull().mean() * 100, 2),
        "nunique":      int(series.nunique()),
        "sample_values": series.dropna().head(5).tolist(),
    }
    # Enrichissement statistique pour les colonnes numériques
    if dtype in ('int64', 'float64', 'int32', 'float32'):
        try:
            meta['min']  = float(series.min())
            meta['max']  = float(series.max())
            meta['mean'] = round(float(series.mean()), 4)
            meta['std']  = round(float(series.std()), 4)
        except Exception:
            pass
    return meta


def _explore_csv(config: dict) -> Dict[str, Any]:
    import pandas as pd

    file_path = config.get("file_path", "")
    if not file_path or not os.path.exists(file_path):
        raise FileNotFoundError(f"Fichier CSV introuvable : {file_path}")

    sep = config.get("separator", config.get("sep", ","))
    encoding = config.get("encoding", "utf-8")
    df = pd.read_csv(file_path, nrows=5000, sep=sep, encoding=encoding, on_bad_lines='skip')
    table_name = os.path.splitext(os.path.basename(file_path))[0]

    columns = [_build_column_meta(df, col) for col in df.columns]

    return {
        table_name: {
            "row_count": len(df),
            "col_count": len(df.columns),
            "columns":   columns,
            "sample":    df.head(5).to_dict(orient="records"),
        }
    }


def _explore_sql(config: dict, dw_config: dict = None) -> Dict[str, Any]:
    import pandas as pd
    from sqlalchemy import create_engine, inspect, text

    db_type  = config.get("type", "mysql").lower()
    
    # Handle 'bak' source type: use DW config but with restored db
    if db_type == "bak":
        host     = dw_config.get("host", "localhost")
        port     = dw_config.get("port", 1433)
        database = config.get("restored_db", dw_config.get("database", ""))
        user     = dw_config.get("user", "sa")
        password = dw_config.get("password", "")
        db_type  = "sqlserver"
    else:
        host     = config.get("host", "localhost")
        port     = config.get("port", 3306)
        database = config.get("database", "")
        user     = config.get("user", "")
        password = config.get("password", "")

    driver_map = {
        "mysql":      "mysqlconnector",
        "postgresql": "psycopg2",
        "postgres":   "psycopg2",
        "sqlite":     "pysqlite",
        "sqlserver":  "pyodbc",
        "mssql":      "pyodbc",
    }
    driver = driver_map.get(db_type, "pyodbc")
    
    if db_type == "sqlite":
        url = f"sqlite:///{database}"
    elif driver == "pyodbc":
        url = f"mssql+pyodbc://{user}:{password}@{host}:{port}/{database}?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes"
    else:
        url = f"{db_type}+{driver}://{user}:{password}@{host}:{port}/{database}"
    
    engine    = create_engine(url, pool_pre_ping=True)
    inspector = inspect(engine)

    metadata = {}
    for table_name in inspector.get_table_names():
        # Skip system tables
        if table_name.startswith("sys") or table_name.startswith("_"):
            continue
            
        cols_info = inspector.get_columns(table_name)
        with engine.connect() as conn:
            # Use [] for SQL Server/cross-compatible escaping
            try:
                count = conn.execute(text(f"SELECT COUNT(*) FROM [{table_name}]")).scalar() or 0
                sample_limit = "TOP 200" if driver == "pyodbc" else ""
                limit_suffix = "" if driver == "pyodbc" else "LIMIT 200"
                
                query = f"SELECT {sample_limit} * FROM [{table_name}] {limit_suffix}"
                sample_df = pd.read_sql(query, conn)
                columns = [_build_column_meta(sample_df, c) for c in sample_df.columns]
            except Exception as e:
                logger.warning(f"[Explorer] Error table {table_name}: {e}")
                columns = [
                    {"name": c["name"], "dtype": str(c["type"]),
                     "nullable": c.get("nullable", True), "null_count": 0, "nunique": 0, "sample_values": []}
                    for c in cols_info
                ]
                count = 0
                
        # ── Extraction FK / PK (relations réelles depuis la DB) ─────────────
        try:
            raw_fks = inspector.get_foreign_keys(table_name)
            fk_list = [
                {
                    "constrained_columns": fk.get("constrained_columns", []),
                    "referred_table":      fk.get("referred_table", ""),
                    "referred_columns":    fk.get("referred_columns", []),
                }
                for fk in raw_fks
                if fk.get("referred_table")
            ]
            raw_pk  = inspector.get_pk_constraint(table_name)
            pk_cols = raw_pk.get("constrained_columns", []) if raw_pk else []
        except Exception as fk_err:
            logger.debug(f"[Explorer] FK/PK extraction skipped for {table_name}: {fk_err}")
            fk_list = []
            pk_cols = []

        metadata[table_name] = {
            "row_count":    int(count),
            "col_count":    len(columns),
            "columns":      columns,
            "foreign_keys": fk_list,
            "primary_key":  pk_cols,
        }
    return metadata


def _explore_excel(config: dict) -> Dict[str, Any]:
    """Explores un fichier Excel (.xlsx / .xls)."""
    import pandas as pd
    from pathlib import Path

    file_path = config.get("file_path", "")
    if not file_path or not os.path.exists(file_path):
        raise FileNotFoundError(f"Fichier Excel introuvable : {file_path}")

    ext = Path(file_path).suffix.lower()
    engine_name = "xlrd" if ext == ".xls" else "openpyxl"

    xls = pd.ExcelFile(file_path, engine=engine_name)
    result = {}
    for sheet in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet, nrows=5000)
        columns = [_build_column_meta(df, col) for col in df.columns]
        result[sheet] = {
            "row_count": len(df),
            "col_count": len(df.columns),
            "columns":   columns,
            "sample":    df.head(5).to_dict(orient="records"),
        }
    return result


def _explore_rest_api(config: dict) -> Dict[str, Any]:
    """Explores une API REST JSON."""
    import requests
    import pandas as pd

    url      = config.get("url", "")
    headers  = config.get("headers", {})
    root_key = config.get("root_key", None)
    if not url:
        raise ValueError("URL de l'API REST manquante")

    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if root_key and isinstance(data, dict):
        data = data.get(root_key, data)

    df = pd.json_normalize(data if isinstance(data, list) else [data])
    table_name = url.rstrip("/").split("/")[-1] or "api_data"
    columns = [_build_column_meta(df, col) for col in df.columns]
    return {
        table_name: {
            "row_count": len(df),
            "col_count": len(df.columns),
            "columns":   columns,
            "sample":    df.head(5).to_dict(orient="records"),
        }
    }
