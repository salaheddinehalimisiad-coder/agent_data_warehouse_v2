"""Smoke test: SQL Server reachable avec les variables du .env à la racine du projet."""
from pathlib import Path
import os
import sys

try:
    from dotenv import load_dotenv
except ImportError:
    print("dotenv manquant")
    sys.exit(1)

root = Path(__file__).resolve().parents[1]
load_dotenv(root / ".env")

import pyodbc  # noqa: E402

host = os.getenv("DB_HOST", "127.0.0.1")
port = os.getenv("DB_PORT", "1433")
password = os.getenv("DB_PASSWORD", "")
if not password:
    print("DB_PASSWORD manquant")
    sys.exit(1)

pw = password.replace("}", "}}")
driver = "ODBC Driver 18 for SQL Server"
try:
    drivers = [d for d in pyodbc.drivers() if "SQL Server" in d]
    if driver not in drivers and "ODBC Driver 17 for SQL Server" in drivers:
        driver = "ODBC Driver 17 for SQL Server"
except Exception:
    pass

conn_str = (
    f"DRIVER={{{driver}}};"
    f"SERVER={host},{port};DATABASE=master;UID=sa;PWD={{{pw}}};"
    "Encrypt=no;TrustServerCertificate=yes;"
)
try:
    with pyodbc.connect(conn_str, autocommit=True, timeout=20) as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT CAST(SERVERPROPERTY('ProductVersion') AS NVARCHAR(64)), "
            "CAST(SERVERPROPERTY('HostPlatform') AS NVARCHAR(32))"
        )
        row = cur.fetchone()
    print("OK", f"{host},{port}", row[0] if row else "", row[1] if row and len(row) > 1 else "")
except Exception as e:
    print("FAIL", e)
    sys.exit(1)
