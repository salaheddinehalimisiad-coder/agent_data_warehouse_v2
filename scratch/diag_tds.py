# scratch/diag_tds.py — Diagnostic TDS minimal pour SQL Server / Express
"""
Objectif : isoler la cause racine du "TDS protocol error (0)" observé dans
l'Initializer de l'Agent Data Warehouse v4.1/v4.2.

Exécution :
    python scratch/diag_tds.py
    # ou avec des variables d'env alternatives :
    DW_HOST="DESKTOP-HDK3ADV\\SQLEXPRESS" DW_PORT=1433 DW_DATABASE=agent_dw_meta \
    DW_USER=sa DW_PASSWORD='MonP@ss!' python scratch/diag_tds.py

Interprétation :
  - A1 passe, A2 échoue  → Cause A (instance nommée + port = conflit TDS).
                           Corrigé par _normalize_sqlserver_target() dans
                           nodes/etl_executor.py (retire le port si host
                           contient un backslash).
  - A3 passe, A2 échoue  → Résolution de nom NetBIOS/DNS instable côté host.
                           Utilise 127.0.0.1 dans la config DW côté UI.
  - A1/A2/A3 OK, B échoue → Cause B (parsing URL SQLAlchemy).
                           Corrigé par creator=pyodbc.connect dans _build_engine.
  - Tous OK              → La v4.2 doit passer. Si ton Initializer échoue
                           encore, c'est la Cause C (transaction DDL) que
                           l'AUTOCOMMIT de _execute_ddl règle.
"""
import os
import sys
import traceback

try:
    import pyodbc
except ImportError:
    print("❌ pyodbc non installé. pip install pyodbc")
    sys.exit(1)


HOST = os.getenv("DW_HOST", "DESKTOP-HDK3ADV\\SQLEXPRESS")
PORT = os.getenv("DW_PORT", "1433")
DB   = os.getenv("DW_DATABASE", "agent_dw_meta")
USER = os.getenv("DW_USER", "sa")
PWD  = os.getenv("DW_PASSWORD", "")


def _cs(server: str) -> str:
    safe_pwd = (PWD or "").replace("}", "}}")
    return (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={server};DATABASE={DB};"
        f"UID={USER};PWD={{{safe_pwd}}};"
        f"Encrypt=no;TrustServerCertificate=yes;"
        f"Connection Timeout=10;"
    )


PYODBC_TRIALS = [
    ("A1 pyodbc direct — instance SEULE (SQL Browser requis)",
     _cs(HOST)),
    ("A2 pyodbc direct — host,port (configuration actuelle suspecte)",
     _cs(f"{HOST},{PORT}")),
    ("A3 pyodbc direct — 127.0.0.1,port",
     _cs(f"127.0.0.1,{PORT}")),
    ("A4 pyodbc direct — localhost (pipe par défaut)",
     _cs("localhost")),
]


def main() -> int:
    print("═" * 70)
    print(f" Diagnostic TDS — SQL Server / Express")
    print(f" HOST={HOST!r}  PORT={PORT}  DB={DB}  USER={USER}")
    print(f" PWD présent: {'oui' if PWD else 'NON — set DW_PASSWORD'}")
    print("═" * 70)

    # ── Volet A : pyodbc direct ─────────────────────────────────────────────
    print("\n▶ Volet A — pyodbc direct (équivalent get_meta_connection)")
    pyodbc_ok: list = []
    for name, cs in PYODBC_TRIALS:
        try:
            cn = pyodbc.connect(cs, autocommit=True, timeout=10)
            cn.cursor().execute("SELECT 1").fetchone()
            cn.close()
            print(f"  ✅ {name}")
            pyodbc_ok.append(name)
        except Exception as e:
            msg = str(e).replace("\n", " ")[:160]
            print(f"  ❌ {name}")
            print(f"     → {msg}")

    # ── Volet B : SQLAlchemy avec creator= (équivalent v4.2) ────────────────
    print("\n▶ Volet B — SQLAlchemy v4.2 (creator=pyodbc) avec la meilleure cible A")
    try:
        from sqlalchemy import create_engine, text
    except ImportError:
        print("  ⚠️ SQLAlchemy non installé, volet B skipped.")
        return 0 if pyodbc_ok else 2

    best_cs = None
    if pyodbc_ok:
        for name, cs in PYODBC_TRIALS:
            if name in pyodbc_ok:
                best_cs = cs
                print(f"  Cible retenue : {name}")
                break

    if not best_cs:
        print("  ⚠️ Aucune variante pyodbc n'a fonctionné, volet B skipped.")
        return 2

    try:
        def _connect():
            return pyodbc.connect(best_cs, autocommit=False, timeout=10)

        engine = create_engine(
            "mssql+pyodbc://",
            creator=_connect,
            pool_pre_ping=True,
            fast_executemany=True,
            future=True,
        )
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            row = conn.execute(text("SELECT @@VERSION AS v")).fetchone()
        print(f"  ✅ B1 SQLAlchemy creator= OK")
        if row:
            print(f"     → @@VERSION : {str(row[0]).splitlines()[0][:80]}")
    except Exception as e:
        print(f"  ❌ B1 SQLAlchemy creator= → {e}")
        traceback.print_exc()
        return 3

    # ── Volet C : AUTOCOMMIT DDL dry-run ────────────────────────────────────
    print("\n▶ Volet C — AUTOCOMMIT DDL (équivalent _execute_ddl v4.2)")
    try:
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.execute(text(
                "IF OBJECT_ID('tempdb..#diag_tds_autocommit') IS NOT NULL "
                "DROP TABLE #diag_tds_autocommit"
            ))
            conn.execute(text("CREATE TABLE #diag_tds_autocommit (id INT)"))
            conn.execute(text("INSERT INTO #diag_tds_autocommit VALUES (1),(2),(3)"))
            n = conn.execute(text("SELECT COUNT(*) FROM #diag_tds_autocommit")).scalar()
            print(f"  ✅ AUTOCOMMIT OK — rows insérées : {n}")
    except Exception as e:
        print(f"  ❌ AUTOCOMMIT DDL → {e}")
        return 4

    print("\n" + "═" * 70)
    print(" ✅ Diagnostic complet — la v4.2 devrait tourner.")
    print("═" * 70)
    return 0


if __name__ == "__main__":
    sys.exit(main())
