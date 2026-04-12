# utils/connectors.py — Connecteurs multi-sources v3.0
"""
v3.0 — Nouvelles sources supportées :
  - Excel (.xlsx, .xls) via openpyxl / xlrd
  - PostgreSQL via psycopg2
  - API REST (JSON) via requests
  - MongoDB (optionnel, si pymongo installé)

Sources existantes maintenues :
  - CSV, MySQL, SQLite
"""
import logging
import os
from typing import Any, Dict

logger = logging.getLogger(__name__)


# ─── Point d'entrée unifié ────────────────────────────────────────────────────

def get_connection(config: dict) -> "BaseConnector":
    """Retourne le connecteur approprié selon le type de source."""
    source_type = config.get("type", "csv").lower()

    connectors = {
        "csv":        CSVConnector,
        "excel":      ExcelConnector,
        "xlsx":       ExcelConnector,
        "xls":        ExcelConnector,
        "mysql":      MySQLConnector,
        "postgresql": PostgreSQLConnector,
        "postgres":   PostgreSQLConnector,
        "sqlite":     SQLiteConnector,
        "rest_api":   RESTAPIConnector,
        "mongodb":    MongoDBConnector,
    }

    cls = connectors.get(source_type)
    if not cls:
        raise ValueError(
            f"Type de source non supporté : '{source_type}'. "
            f"Sources disponibles : {list(connectors.keys())}"
        )
    return cls(config)


def test_connection(config: dict) -> Dict[str, Any]:
    """Teste la connexion et retourne un rapport de diagnostic."""
    try:
        conn = get_connection(config)
        info = conn.test()
        return {"success": True, "info": info}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── Classe de base ───────────────────────────────────────────────────────────

class BaseConnector:
    def __init__(self, config: dict):
        self.config = config

    def test(self) -> dict:
        raise NotImplementedError

    def get_metadata(self) -> dict:
        raise NotImplementedError


# ─── CSV ──────────────────────────────────────────────────────────────────────

class CSVConnector(BaseConnector):
    def test(self) -> dict:
        path = self.config.get("file_path", "")
        if not os.path.exists(path):
            raise FileNotFoundError(f"CSV introuvable : {path}")
        size = os.path.getsize(path)
        return {"type": "csv", "path": path, "size_bytes": size}

    def get_metadata(self) -> dict:
        import pandas as pd
        path = self.config.get("file_path", "")
        sep  = self.config.get("separator", ",")
        enc  = self.config.get("encoding", "utf-8")

        df = pd.read_csv(path, nrows=5000, sep=sep, encoding=enc)
        table_name = os.path.splitext(os.path.basename(path))[0]
        return {table_name: _df_to_metadata(df)}


# ─── Excel ────────────────────────────────────────────────────────────────────

class ExcelConnector(BaseConnector):
    """Supporte .xlsx (openpyxl) et .xls (xlrd)."""

    def test(self) -> dict:
        path = self.config.get("file_path", "")
        if not os.path.exists(path):
            raise FileNotFoundError(f"Excel introuvable : {path}")
        try:
            import openpyxl
            wb = openpyxl.load_workbook(path, read_only=True)
            sheets = wb.sheetnames
            wb.close()
            return {"type": "excel", "path": path, "sheets": sheets}
        except Exception:
            # Fallback xlrd pour .xls
            import xlrd
            wb = xlrd.open_workbook(path)
            return {"type": "xls_legacy", "path": path, "sheets": wb.sheet_names()}

    def get_metadata(self) -> dict:
        import pandas as pd
        path   = self.config.get("file_path", "")
        sheets = self.config.get("sheets", None)   # None = toutes les feuilles

        ext = os.path.splitext(path)[1].lower()
        engine = "xlrd" if ext == ".xls" else "openpyxl"

        xl = pd.ExcelFile(path, engine=engine)
        sheet_names = sheets if sheets else xl.sheet_names

        metadata = {}
        for sheet in sheet_names:
            try:
                df = pd.read_excel(xl, sheet_name=sheet, nrows=5000, engine=engine)
                # Sanitize sheet name pour nom de table SQL
                safe_name = sheet.lower().replace(" ", "_").replace("-", "_")
                metadata[safe_name] = _df_to_metadata(df)
            except Exception as e:
                logger.warning(f"[Excel] Feuille '{sheet}' ignorée : {e}")

        return metadata


# ─── MySQL ────────────────────────────────────────────────────────────────────

class MySQLConnector(BaseConnector):
    def _engine(self):
        from sqlalchemy import create_engine
        c = self.config
        url = (
            f"mysql+mysqlconnector://{c['user']}:{c['password']}"
            f"@{c.get('host','localhost')}:{c.get('port',3306)}/{c['database']}"
        )
        return create_engine(url, pool_pre_ping=True)

    def test(self) -> dict:
        from sqlalchemy import text
        engine = self._engine()
        with engine.connect() as conn:
            version = conn.execute(text("SELECT VERSION()")).scalar()
        return {"type": "mysql", "version": version, "database": self.config["database"]}

    def get_metadata(self) -> dict:
        return _sql_metadata(self._engine())


# ─── PostgreSQL ───────────────────────────────────────────────────────────────

class PostgreSQLConnector(BaseConnector):
    """NOUVEAU v3 — Connecteur PostgreSQL via SQLAlchemy + psycopg2."""

    def _engine(self):
        from sqlalchemy import create_engine
        c = self.config
        url = (
            f"postgresql+psycopg2://{c['user']}:{c['password']}"
            f"@{c.get('host','localhost')}:{c.get('port',5432)}/{c['database']}"
        )
        schema = c.get("schema", "public")
        return create_engine(
            url,
            pool_pre_ping=True,
            connect_args={"options": f"-c search_path={schema}"},
        )

    def test(self) -> dict:
        from sqlalchemy import text
        engine = self._engine()
        with engine.connect() as conn:
            version = conn.execute(text("SELECT version()")).scalar()
        return {
            "type": "postgresql",
            "version": version[:60],
            "database": self.config["database"],
            "schema": self.config.get("schema", "public"),
        }

    def get_metadata(self) -> dict:
        return _sql_metadata(self._engine())


# ─── SQLite ───────────────────────────────────────────────────────────────────

class SQLiteConnector(BaseConnector):
    def _engine(self):
        from sqlalchemy import create_engine
        path = self.config.get("file_path", ":memory:")
        return create_engine(f"sqlite:///{path}")

    def test(self) -> dict:
        engine = self._engine()
        from sqlalchemy import inspect
        insp = inspect(engine)
        tables = insp.get_table_names()
        return {"type": "sqlite", "tables": tables, "count": len(tables)}

    def get_metadata(self) -> dict:
        return _sql_metadata(self._engine())


# ─── REST API ─────────────────────────────────────────────────────────────────

class RESTAPIConnector(BaseConnector):
    """
    NOUVEAU v3 — Connecteur API REST JSON.
    Config :
      url     : URL de l'endpoint
      method  : GET (défaut) | POST
      headers : dict d'entêtes HTTP
      params  : dict de query params
      body    : dict pour POST
      root_key : clé JSON racine si la liste n'est pas à la racine
    """

    def test(self) -> dict:
        import requests
        url     = self.config.get("url", "")
        headers = self.config.get("headers", {})
        resp    = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        return {"type": "rest_api", "url": url, "status": resp.status_code}

    def get_metadata(self) -> dict:
        import requests
        import pandas as pd

        url      = self.config.get("url", "")
        method   = self.config.get("method", "GET").upper()
        headers  = self.config.get("headers", {})
        params   = self.config.get("params", {})
        body     = self.config.get("body", None)
        root_key = self.config.get("root_key", None)

        if method == "POST":
            resp = requests.post(url, headers=headers, json=body, timeout=30)
        else:
            resp = requests.get(url, headers=headers, params=params, timeout=30)
        resp.raise_for_status()

        data = resp.json()
        if root_key and isinstance(data, dict):
            data = data.get(root_key, data)

        if isinstance(data, list):
            df = pd.json_normalize(data[:5000])
        elif isinstance(data, dict):
            df = pd.json_normalize([data])
        else:
            raise ValueError("Format JSON non supporté (ni list ni dict)")

        # Nom de table = dernier segment de l'URL
        endpoint_name = url.rstrip("/").split("/")[-1].replace("-", "_") or "api_data"
        return {endpoint_name: _df_to_metadata(df)}


# ─── MongoDB (optionnel) ──────────────────────────────────────────────────────

class MongoDBConnector(BaseConnector):
    """
    NOUVEAU v3 — Connecteur MongoDB (pymongo requis).
    Config :
      uri        : mongodb://user:pass@host:27017/
      database   : nom de la base
      collection : nom de la collection (ou None = toutes)
    """

    def _client(self):
        try:
            import pymongo
        except ImportError:
            raise ImportError("pymongo requis : pip install pymongo")
        return pymongo.MongoClient(
            self.config.get("uri", "mongodb://localhost:27017/"),
            serverSelectionTimeoutMS=5000,
        )

    def test(self) -> dict:
        client = self._client()
        info   = client.server_info()
        return {
            "type":    "mongodb",
            "version": info.get("version", "?"),
            "database": self.config.get("database", "?"),
        }

    def get_metadata(self) -> dict:
        import pandas as pd
        client   = self._client()
        db_name  = self.config.get("database", "")
        db       = client[db_name]
        col_name = self.config.get("collection", None)

        collections = [col_name] if col_name else db.list_collection_names()
        metadata = {}

        for coll in collections:
            docs = list(db[coll].find({}, {"_id": 0}).limit(5000))
            if not docs:
                continue
            df = pd.json_normalize(docs)
            safe_name = coll.lower().replace(" ", "_")
            metadata[safe_name] = _df_to_metadata(df)

        return metadata


# ─── Helpers partagés ────────────────────────────────────────────────────────

def _df_to_metadata(df) -> dict:
    """Convertit un DataFrame pandas en metadata dict standard."""
    import numpy as np

    columns = []
    for col in df.columns:
        dtype   = str(df[col].dtype)
        samples = [
            v.item() if isinstance(v, (np.integer, np.floating)) else v
            for v in df[col].dropna().head(3).tolist()
        ]
        columns.append({
            "name":          col,
            "dtype":         dtype,
            "null_count":    int(df[col].isnull().sum()),
            "null_pct":      round(float(df[col].isnull().mean()) * 100, 2),
            "nunique":       int(df[col].nunique()),
            "sample_values": samples,
        })

    return {
        "row_count": len(df),
        "col_count": len(df.columns),
        "columns":   columns,
        "sample":    df.head(3).to_dict(orient="records"),
    }


def _sql_metadata(engine) -> dict:
    """
    Extrait les métadonnées d'une base SQL via SQLAlchemy.
    CORRECTION : une seule connexion partagée pour toute l'extraction
    (ancienne version ouvrait N_tables × N_colonnes connexions).
    """
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    metadata  = {}

    with engine.connect() as conn:
        for table_name in inspector.get_table_names():
            cols_info = inspector.get_columns(table_name)
            columns   = []

            # Nombre de lignes de la table (une seule requête)
            try:
                row_count = conn.execute(
                    text(f'SELECT COUNT(*) FROM "{table_name}"')
                ).scalar() or 0
            except Exception:
                row_count = 0

            for col in cols_info:
                col_name = col["name"]
                try:
                    null_count = conn.execute(
                        text(f'SELECT COUNT(*) FROM "{table_name}" WHERE "{col_name}" IS NULL')
                    ).scalar() or 0
                    null_pct = round(null_count / max(row_count, 1) * 100, 2)
                except Exception:
                    null_count, null_pct = 0, 0.0

                columns.append({
                    "name":          col_name,
                    "dtype":         str(col["type"]),
                    "nullable":      col.get("nullable", True),
                    "null_count":    int(null_count),
                    "null_pct":      null_pct,
                    "nunique":       0,
                    "sample_values": [],
                })

            metadata[table_name] = {
                "row_count": row_count,
                "col_count": len(columns),
                "columns":   columns,
            }

    return metadata
