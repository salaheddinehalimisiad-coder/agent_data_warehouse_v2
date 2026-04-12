# nodes/etl_executor.py — Agent ETL Executor v4.0 PRO — ETL Python natif
"""
REFONTE COMPLÈTE v4.0 :
  - ETL Python natif via SQLAlchemy (plus de dépendance Pentaho)
  - Lookup Surrogate Keys réels (résolution FK dans les dimensions)
  - Chargement dimensions AVANT faits (intégrité référentielle)
  - Métriques post-chargement : lignes insérées, rejets, doublons
  - Mode incrémental optionnel (delta load via watermark)
  - Fallback : export .ktr si DW non configuré (mode dégradé)
  - Chemins absolus via pathlib
"""
import os
import logging
import json
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from app_state import AgentState

logger = logging.getLogger(__name__)

_HERE = Path(__file__).parent.parent
OUTPUTS_DIR = _HERE / "outputs"


def etl_executor_node(state: AgentState) -> dict:
    """
    Exécute le pipeline ETL complet :
    1. Lecture des données source
    2. Application des règles DQ (nettoyage basique)
    3. Chargement des dimensions avec génération de SKs
    4. Résolution des SKs pour la table de faits
    5. Chargement de la table de faits
    6. Métriques post-chargement
    """
    logger.info("--- AGENT ETL EXECUTOR v4.0 : ETL Python Natif ---")

    sql_ddl      = state.get("sql_ddl", "")
    logical_model = state.get("logical_model", {})
    dw_config    = state.get("dw_connection_config", {})
    source_config = state.get("connection_config", {})
    retry_count  = state.get("retry_count", 0)
    user_prefix  = state.get("user_prefix", "dw")
    exec_log     = state.get("execution_log", [])
    source_meta  = state.get("source_metadata", {})

    # ── Validation minimale ──────────────────────────────────────────────────
    if not logical_model or not sql_ddl:
        return {
            "etl_status": "failed",
            "etl_error":  "Modèle OLAP ou DDL absent",
            "retry_count": retry_count + 1,
            "execution_log": exec_log + ["[ETL] ERREUR : modèle absent"],
        }

    # ── Mode dégradé si pas de config DW ───────────────────────────────────
    if not dw_config or not dw_config.get("host"):
        exec_log = exec_log + ["[ETL] Mode dégradé — pas de config DW, export DDL uniquement"]
        return _export_ddl_only(sql_ddl, user_prefix, exec_log, retry_count)

    # ── Connexion DW ─────────────────────────────────────────────────────────
    try:
        dw_engine = _build_engine(dw_config)
        _test_connection(dw_engine)
        exec_log = exec_log + ["[ETL] ✅ Connexion DW établie"]
    except Exception as e:
        logger.warning(f"[ETL] DW non accessible : {e} — export DDL uniquement")
        return _export_ddl_only(sql_ddl, user_prefix, exec_log + [f"[ETL] DW inaccessible : {e}"], retry_count)

    # ── Étape 1 : Créer le schéma DDL ───────────────────────────────────────
    ddl_err = _execute_ddl(dw_engine, sql_ddl)
    if ddl_err:
        return {
            "etl_status":  "failed",
            "etl_error":   f"Erreur DDL : {ddl_err}",
            "retry_count": retry_count + 1,
            "execution_log": exec_log + [f"[ETL] ❌ DDL : {ddl_err[:200]}"],
        }
    exec_log = exec_log + ["[ETL] ✅ Schéma DW créé / vérifié"]

    # ── Étape 2 : Lire les données source ────────────────────────────────────
    try:
        source_df = _read_source(source_config)
        
        # Application des directives du Healer (Strategic Remediation)
        clean_action = state.get("clean_action", "NONE")
        if clean_action == "DEDUPLICATE":
            orig_len = len(source_df)
            source_df = source_df.drop_duplicates()
            exec_log.append(f"[ETL] 🔧 Remediation : {orig_len - len(source_df)} doublons supprimés")
        
        if clean_action == "CAST_TYPES":
            exec_log.append("[ETL] 🔧 Remediation : Conversion forcée des types")
            for col in source_df.columns:
                if source_df[col].dtype == 'object':
                    try:
                        source_df[col] = pd.to_numeric(source_df[col], errors='ignore')
                    except: pass
        
        exec_log = exec_log + [f"[ETL] ✅ Source lue — {len(source_df)} lignes"]
    except Exception as e:
        return {
            "etl_status":  "failed",
            "etl_error":   f"Erreur lecture source : {e}",
            "retry_count": retry_count + 1,
            "execution_log": exec_log + [f"[ETL] ❌ Lecture source : {e}"],
        }

    # ── Étape 3 : Charger les dimensions ─────────────────────────────────────
    sk_maps: Dict[str, Dict[str, int]] = {}   # {dim_name: {natural_key: sk}}
    dim_metrics: Dict[str, dict] = {}

    for dim in logical_model.get("dimension_tables", []):
        dim_name   = dim.get("name", "")
        table_name = f"{user_prefix}_{dim_name}"
        try:
            result = _load_dimension(dw_engine, table_name, dim, source_df)
            sk_maps[dim_name]    = result["sk_map"]
            dim_metrics[dim_name] = result["metrics"]
            exec_log = exec_log + [
                f"[ETL] ✅ {table_name} — {result['metrics']['inserted']} insérées, "
                f"{result['metrics']['existing']} existantes"
            ]
        except Exception as e:
            logger.warning(f"[ETL] Dim {dim_name} erreur : {e}")
            exec_log = exec_log + [f"[ETL] ⚠️ {dim_name} : {e}"]

    # ── Étape 4 : Charger la table de faits ──────────────────────────────────
    fact = logical_model.get("fact_table", {})
    fact_metrics = {}
    session_id = state.get("session_id", "unknown")
    if fact:
        fact_name  = fact.get("name", "")
        table_name = f"{user_prefix}_{fact_name}"
        try:
            fact_metrics = _load_fact(dw_engine, table_name, fact, source_df, sk_maps, user_prefix, session_id)
            exec_log = exec_log + [
                f"[ETL] ✅ {table_name} — {fact_metrics.get('inserted', 0)} faits insérés, "
                f"{fact_metrics.get('rejected', 0)} rejetés"
            ]
        except Exception as e:
            return {
                "etl_status":  "failed",
                "etl_error":   f"Erreur chargement faits : {e}",
                "retry_count": retry_count + 1,
                "execution_log": exec_log + [f"[ETL] ❌ Faits : {e}"],
            }

    # ── Étape 5 : Métriques post-load ────────────────────────────────────────
    load_metrics = {
        "source_rows":   len(source_df),
        "dimensions":    dim_metrics,
        "fact":          fact_metrics,
        "loaded_at":     datetime.now(timezone.utc).isoformat(),
        "dw_prefix":     user_prefix,
    }
    _persist_metrics(load_metrics, session_id)

    total_inserted = fact_metrics.get("inserted", 0)
    total_rejected = fact_metrics.get("rejected", 0)
    exec_log = exec_log + [
        f"[ETL] 🏁 Chargement terminé — {total_inserted} faits / {total_rejected} rejetés"
    ]

    # ── Également exporter le DDL et KTR comme artefacts ─────────────────────────────
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    ddl_path = OUTPUTS_DIR / f"{user_prefix}_schema.sql"
    ddl_path.write_text(sql_ddl, encoding="utf-8")
    
    ktr_xml = state.get("etl_code", "")
    if ktr_xml:
        ktr_path = OUTPUTS_DIR / f"{user_prefix}_pipeline.ktr"
        ktr_path.write_text(ktr_xml, encoding="utf-8")

    return {
        "etl_status":   "success",
        "etl_error":    "",
        "load_metrics": load_metrics,
        "execution_log": exec_log,
    }


# ─── Chargement des dimensions ────────────────────────────────────────────────

def _load_dimension(engine, table_name: str, dim_model: dict, source_df) -> dict:
    """
    Charge une table de dimension :
    - Identifie la colonne source correspondante
    - Déduplique les valeurs
    - INSERT OR IGNORE (upsert simple)
    - Retourne le sk_map {valeur_naturelle: sk}
    """
    from sqlalchemy import text, inspect
    import pandas as pd

    dim_name = dim_model.get("name", "")
    columns  = dim_model.get("columns", [])

    # Colonnes attributs (pas pk, pas fk)
    attr_cols = [c for c in columns if c.get("role") == "attribute"]
    pk_col    = next((c for c in columns if c.get("role") == "pk"), None)

    if not attr_cols or not pk_col:
        return {"sk_map": {}, "metrics": {"inserted": 0, "existing": 0}}

    pk_name = pk_col["name"]

    # Trouver la ou les colonnes source correspondantes
    src_col_name = _find_source_col(attr_cols[0]["name"], source_df.columns.tolist())

    sk_map = {}
    inserted = 0
    existing = 0

    if src_col_name:
        # Valeurs uniques de la colonne source
        unique_vals = source_df[src_col_name].dropna().unique().tolist()

        with engine.begin() as conn:
            for val in unique_vals:
                clean_val = str(val).strip()
                if not clean_val:
                    continue

                # Vérifier si déjà existant
                check_col = attr_cols[0]["name"]
                try:
                    row = conn.execute(
                        text(f"SELECT `{pk_name}` FROM `{table_name}` WHERE `{check_col}` = :v LIMIT 1"),
                        {"v": clean_val}
                    ).fetchone()
                except Exception:
                    row = None

                if row:
                    sk_map[clean_val] = row[0]
                    existing += 1
                else:
                    # Construire le dict d'insertion
                    insert_vals = {a["name"]: clean_val for a in attr_cols[:1]}
                    cols_str  = ", ".join(f"`{k}`" for k in insert_vals)
                    vals_str  = ", ".join(f":{k}" for k in insert_vals)
                    try:
                        result = conn.execute(
                            text(f"INSERT IGNORE INTO `{table_name}` ({cols_str}) VALUES ({vals_str})"),
                            insert_vals
                        )
                        if result.lastrowid:
                            sk_map[clean_val] = result.lastrowid
                            inserted += 1
                        else:
                            # Re-lire le SK
                            row2 = conn.execute(
                                text(f"SELECT `{pk_name}` FROM `{table_name}` WHERE `{check_col}` = :v LIMIT 1"),
                                {"v": clean_val}
                            ).fetchone()
                            if row2:
                                sk_map[clean_val] = row2[0]
                    except Exception as e:
                        logger.debug(f"[ETL] Dim {table_name} insert val '{clean_val}' : {e}")

    # dim_date : chargement automatique des dates depuis source
    if "dim_date" in dim_name:
        sk_map.update(_load_dim_date_from_source(engine, table_name, source_df))
        inserted = len(sk_map)

    return {"sk_map": sk_map, "metrics": {"inserted": inserted, "existing": existing}}


def _load_dim_date_from_source(engine, table_name: str, source_df) -> dict:
    """Charge dim_date depuis les colonnes dates détectées dans la source."""
    import pandas as pd
    from sqlalchemy import text

    date_cols = [c for c in source_df.columns
                 if "date" in c.lower() or source_df[c].dtype in ("datetime64[ns]", "object")
                 and _is_date_column(source_df[c])]

    if not date_cols:
        return {}

    sk_map = {}
    dates_seen = set()

    for dcol in date_cols[:1]:
        try:
            dates = pd.to_datetime(source_df[dcol], errors="coerce").dropna()
            with engine.begin() as conn:
                for d in dates.dt.date.unique():
                    if d in dates_seen:
                        continue
                    dates_seen.add(d)
                    key = str(d)
                    row = conn.execute(
                        text(f"SELECT `date_sk` FROM `{table_name}` WHERE `date_full` = :d LIMIT 1"),
                        {"d": d}
                    ).fetchone()
                    if row:
                        sk_map[key] = row[0]
                    else:
                        import datetime
                        dt = datetime.date.fromisoformat(key)
                        result = conn.execute(text(f"""
                            INSERT IGNORE INTO `{table_name}`
                            (date_full, annee, trimestre, mois, semaine, jour, jour_semaine)
                            VALUES (:df, :y, :q, :m, :w, :d, :wd)
                        """), {
                            "df": d, "y": dt.year, "q": (dt.month-1)//3+1,
                            "m": dt.month, "w": dt.isocalendar()[1],
                            "d": dt.day, "wd": dt.strftime("%A"),
                        })
                        if result.lastrowid:
                            sk_map[key] = result.lastrowid
        except Exception as e:
            logger.debug(f"[ETL] dim_date load : {e}")

    return sk_map


def _load_fact(engine, table_name: str, fact_model: dict, source_df,
               sk_maps: dict, prefix: str, session_id: str = "unknown") -> dict:
    """
    Charge la table de faits :
    - Résolution des SKs via sk_maps
    - Mapping des métriques numériques
    - Compte les insertions et rejets
    - Diffuse la progression via SSE
    - Supporte IGNORE_REJECTS
    """
    from sqlalchemy import text
    import pandas as pd
    from api.services.sse import broadcast

    clean_action = state.get("clean_action", "NONE")
    use_ignore  = clean_action in ("IGNORE_REJECTS", "DEDUPLICATE")

    columns  = fact_model.get("columns", [])
    pk_col   = next((c for c in columns if c.get("role") == "pk"), None)
    fk_cols  = [c for c in columns if c.get("role") == "fk"]
    met_cols = [c for c in columns if c.get("role") == "metric"]

    if not met_cols:
        return {"inserted": 0, "rejected": 0, "reason": "Aucune métrique définie"}

    total_rows = len(source_df)
    inserted = 0
    rejected = 0
    rows_batch = []

    for idx, src_row in source_df.iterrows():
        row_dict = {}

        # Résolution des FKs
        for fk in fk_cols:
            fk_name  = fk["name"]
            ref_dim  = fk.get("references", "")
            dim_sks  = sk_maps.get(ref_dim, {})

            # Chercher la valeur source pour cette FK
            nat_key_col = _find_source_col(fk_name.replace("_sk", ""), source_df.columns.tolist())
            if nat_key_col and dim_sks:
                nat_val = str(src_row.get(nat_key_col, "")).strip()
                sk_val  = dim_sks.get(nat_val)
                if sk_val:
                    row_dict[fk_name] = sk_val
                else:
                    # Résolution par date si dim_date
                    if "date" in ref_dim:
                        import pandas as pd2
                        try:
                            d = str(pd2.to_datetime(src_row.get(nat_key_col)).date())
                            row_dict[fk_name] = dim_sks.get(d, 1)
                        except Exception:
                            row_dict[fk_name] = 1
                    else:
                        row_dict[fk_name] = 1  # default SK

        # Mapping des métriques
        for met in met_cols:
            met_name = met["name"]
            src_col  = _find_source_col(met_name, source_df.columns.tolist())
            if src_col:
                val = src_row.get(src_col, 0)
                try:
                    row_dict[met_name] = float(val) if "decimal" in met.get("type","").lower() else int(float(val))
                except (ValueError, TypeError):
                    row_dict[met_name] = 0

        if row_dict:
            rows_batch.append(row_dict)

        # Insérer par batch de 500
        if len(rows_batch) >= 500:
            ins, rej = _batch_insert(engine, table_name, rows_batch, use_ignore)
            inserted += ins
            rejected += rej
            rows_batch = []
            # Pulse notification
            broadcast(session_id, "etl_progress", {
                "inserted": inserted,
                "rejected": rejected,
                "total":    total_rows,
                "table":    table_name,
                "pct":      round((idx / total_rows) * 100, 1)
            })

    # Insérer le reste
    if rows_batch:
        ins, rej = _batch_insert(engine, table_name, rows_batch, use_ignore)
        inserted += ins
        rejected += rej
        broadcast(session_id, "etl_progress", {
            "inserted": inserted,
            "rejected": rejected,
            "total":    total_rows,
            "table":    table_name,
            "pct":      100
        })

    return {"inserted": inserted, "rejected": rejected, "source_rows": len(source_df)}


def _batch_insert(engine, table_name: str, rows: list, use_ignore: bool = False) -> Tuple[int, int]:
    """Insère un batch de lignes. Retourne (inserted, rejected)."""
    from sqlalchemy import text
    if not rows:
        return 0, 0

    verb = "INSERT IGNORE" if use_ignore else "INSERT"
    cols    = list(rows[0].keys())
    cols_str = ", ".join(f"`{c}`" for c in cols)
    vals_str = ", ".join(f":{c}" for c in cols)

    inserted = 0
    rejected = 0
    try:
        with engine.begin() as conn:
            for row in rows:
                try:
                    conn.execute(
                        text(f"{verb} INTO `{table_name}` ({cols_str}) VALUES ({vals_str})"),
                        row
                    )
                    inserted += 1
                except Exception:
                    rejected += 1
    except Exception as e:
        logger.warning(f"[ETL] Batch insert {table_name} : {e}")
        rejected += len(rows)

    return inserted, rejected


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _build_engine(config: dict):
    """Construit un engine SQLAlchemy selon le type de base."""
    from sqlalchemy import create_engine
    db_type  = config.get("type", "mysql").lower().replace("postgres", "postgresql")
    host     = config.get("host", "localhost")
    port     = config.get("port", 3306)
    database = config.get("database", "data_warehouse")
    user     = config.get("user", "root")
    password = config.get("password", "")

    driver_map = {
        "mysql": "mysqlconnector",
        "postgresql": "psycopg2",
        "sqlite": "pysqlite",
    }
    driver = driver_map.get(db_type, "mysqlconnector")

    if db_type == "sqlite":
        return create_engine(f"sqlite:///{database}")
    return create_engine(
        f"{db_type}+{driver}://{user}:{password}@{host}:{port}/{database}",
        pool_pre_ping=True, pool_recycle=3600,
    )


def _test_connection(engine) -> None:
    from sqlalchemy import text
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))


def _execute_ddl(engine, sql_ddl: str) -> str:
    """Exécute le DDL. Retourne '' si OK, message d'erreur sinon."""
    from sqlalchemy import text
    try:
        try:
            import sqlparse
            statements = [str(s).strip() for s in sqlparse.parse(sql_ddl)
                         if str(s).strip() and not str(s).strip().startswith("--")]
        except ImportError:
            statements = [s.strip() for s in sql_ddl.split(";")
                         if s.strip() and len(s.strip()) > 5]

        with engine.begin() as conn:
            for stmt in statements:
                if stmt:
                    conn.execute(text(stmt))
        return ""
    except Exception as e:
        return str(e)


def _read_source(config: dict):
    """Lit les données source et retourne un DataFrame pandas."""
    import pandas as pd
    source_type = config.get("type", "csv").lower()

    if source_type == "csv":
        path = config.get("file_path", "")
        if not path or not Path(path).exists():
            raise FileNotFoundError(f"Fichier CSV introuvable : {path}")
        return pd.read_csv(path)

    elif source_type in ("excel", "xlsx", "xls"):
        path = config.get("file_path", "")
        ext  = Path(path).suffix.lower()
        engine_name = "xlrd" if ext == ".xls" else "openpyxl"
        return pd.read_excel(path, engine=engine_name)

    elif source_type in ("mysql", "postgresql", "postgres", "sqlite"):
        src_engine = _build_engine(config)
        table = config.get("table", "")
        if table:
            return pd.read_sql_table(table, src_engine)
        query = config.get("query", "SELECT * FROM information_schema.tables LIMIT 100")
        return pd.read_sql(query, src_engine)

    elif source_type == "rest_api":
        import requests
        import pandas as pd
        url      = config.get("url", "")
        headers  = config.get("headers", {})
        root_key = config.get("root_key", None)
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        if root_key and isinstance(data, dict):
            data = data.get(root_key, data)
        return pd.json_normalize(data if isinstance(data, list) else [data])

    else:
        raise ValueError(f"Type source non supporté : {source_type}")


def _find_source_col(target_name: str, source_cols: list) -> Optional[str]:
    """Cherche la colonne source la plus proche du nom cible."""
    clean = target_name.lower()
    for suffix in ("_sk", "_id", "_key", "_fk"):
        clean = clean.removesuffix(suffix)
    for pfx in ("dim_", "fact_"):
        clean = clean.removeprefix(pfx)

    # Correspondance exacte
    for col in source_cols:
        if col.lower() == clean or col.lower() == target_name.lower():
            return col

    # Correspondance partielle
    for col in source_cols:
        if clean in col.lower() or col.lower() in clean:
            return col

    return None


def _is_date_column(series) -> bool:
    """Vérifie heuristiquement si une colonne contient des dates."""
    import pandas as pd
    sample = series.dropna().head(5)
    if len(sample) == 0:
        return False
    try:
        pd.to_datetime(sample, errors="raise")
        return True
    except Exception:
        return False


def _export_ddl_only(sql_ddl: str, user_prefix: str, exec_log: list, retry_count: int) -> dict:
    """Mode dégradé : exporte uniquement le DDL SQL."""
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    ddl_path = OUTPUTS_DIR / f"{user_prefix}_schema.sql"
    ktr_path = OUTPUTS_DIR / f"{user_prefix}_pipeline.ktr"

    ddl_path.write_text(sql_ddl, encoding="utf-8")
    # Conserver le KTR généré précédemment s'il existe
    ktr_xml = state.get("etl_code", "")
    if ktr_xml:
        ktr_path.write_text(ktr_xml, encoding="utf-8")
    else:
        # Écrire aussi un .ktr minimal pour compatibilité
        ktr_path.write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<transformation>
  <info><name>ETL_{user_prefix}</name></info>
  <!-- DDL généré — à exécuter dans votre DW cible -->
  <!-- Voir {user_prefix}_schema.sql pour le schéma complet -->
</transformation>""", encoding="utf-8")

    return {
        "etl_status": "success",
        "etl_error":  "",
        "execution_log": exec_log + [
            f"[ETL] ✅ DDL exporté : {ddl_path}",
            "[ETL] ℹ️ Mode sans-DW : exécutez le .sql dans votre base cible",
        ],
    }


def _persist_metrics(metrics: dict, session_id: str) -> None:
    """Persiste les métriques de chargement dans un historique JSON."""
    metrics_file = OUTPUTS_DIR / "load_metrics_history.json"
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

    history = []
    if metrics_file.exists():
        try:
            history = json.loads(metrics_file.read_text())
        except Exception:
            history = []

    history.append({"session_id": session_id, **metrics})
    history = history[-100:]  # garder les 100 derniers

    metrics_file.write_text(json.dumps(history, indent=2, default=str))
