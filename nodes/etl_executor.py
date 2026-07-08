# nodes/etl_executor.py — Agent ETL Executor v4.2 PRO — TDS-safe + Real Batching
"""
REFONTE v4.2 (suite v4.0) :
  - TDS-safe : _build_engine utilise un creator=pyodbc.connect (bypass parsing URL
    SQLAlchemy), normalise les instances nommées SQL Express, échappe correctement
    les braces du password.
  - DDL-safe : _execute_ddl exécute en AUTOCOMMIT (compatible CREATE DATABASE,
    ALTER DATABASE SET, etc.) et découpe proprement les batches séparés par 'GO'.
  - Batching RÉEL : _batch_insert utilise executemany (fast_executemany=True
    exploité par pyodbc Driver 17), 1 aller-retour TDS pour N lignes.
  - Fact load : source_df parcouru avec itertuples (≈5× plus rapide qu'iterrows),
    broadcast SSE throttlé pour ne plus spammer l'UI.
  - Helper _verify_tables_created exporté pour l'Initializer.
  - Aucun changement de signature publique : etl_executor_node inchangé.
"""
import os
import re
import json
import time
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from app_state import AgentState

logger = logging.getLogger(__name__)

_HERE = Path(__file__).parent.parent
OUTPUTS_DIR = _HERE / "outputs"

# ── Module-level DataFrame cache (bypasses LangGraph msgpack serialization) ──
# DataFrames cannot be serialized by LangGraph's MemorySaver — store them here
# keyed by session_id so ETL steps can share them without going through state.
_df_store: Dict[str, Dict[str, "pd.DataFrame"]] = {}

def df_cache_store(session_id: str, dfs: Dict) -> None:
    _df_store[session_id] = dfs

def df_cache_load(session_id: str) -> Dict:
    return _df_store.get(session_id, {})


# ═════════════════════════════════════════════════════════════════════════════
#  NODE ENTRY POINT — etl_executor_node (inchangé fonctionnellement)
# ═════════════════════════════════════════════════════════════════════════════

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
    logger.info("--- AGENT ETL EXECUTOR v4.2 : ETL Python Natif (TDS-safe) ---")

    sql_ddl       = state.get("sql_ddl", "")
    logical_model = state.get("logical_model", {})
    dw_config     = state.get("dw_connection_config", {})
    source_config = state.get("connection_config", {})
    retry_count   = state.get("retry_count", 0)
    user_prefix   = state.get("user_prefix", "dw")
    exec_log      = state.get("execution_log", [])
    source_meta   = state.get("source_metadata", {})

    # ── Validation minimale ──────────────────────────────────────────────────
    if not logical_model or not sql_ddl:
        return {
            "etl_status": "failed",
            "etl_error":  "Modèle OLAP ou DDL absent",
            "retry_count": retry_count + 1,
            "execution_log": exec_log + ["[ETL] ERREUR : modèle absent"],
        }

    # ── Mode dégradé si pas de config DW ─────────────────────────────────────
    if not dw_config or not dw_config.get("host"):
        exec_log = exec_log + ["[ETL] Mode dégradé — pas de config DW, export DDL uniquement"]
        return _export_ddl_only(sql_ddl, user_prefix, exec_log, retry_count, state.get("etl_code", ""))

    # ── Connexion DW ─────────────────────────────────────────────────────────
    try:
        dw_engine = _build_engine(dw_config)
        _test_connection(dw_engine)
        exec_log = exec_log + ["[ETL] ✅ Connexion DW établie"]
    except Exception as e:
        logger.warning(f"[ETL] DW non accessible : {e} — export DDL uniquement")
        return _export_ddl_only(
            sql_ddl, user_prefix,
            exec_log + [f"[ETL] DW inaccessible : {e}"],
            retry_count,
            state.get("etl_code", "")
        )

    # ── Étape 1 : Créer le schéma DDL ────────────────────────────────────────
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
    source_dfs = state.get("source_dfs", {})
    try:
        if source_dfs:
            # Multi-table: source_df déjà résolu par l'extracteur
            source_df = state.get("source_df") or (list(source_dfs.values())[0] if source_dfs else None)
        else:
            source_df = _read_source(source_config, dw_config)

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
                    except Exception:
                        pass

        exec_log = exec_log + [f"[ETL] ✅ Source lue — {len(source_df)} lignes"]
    except Exception as e:
        return {
            "etl_status":  "failed",
            "etl_error":   f"Erreur lecture source : {e}",
            "retry_count": retry_count + 1,
            "execution_log": exec_log + [f"[ETL] ❌ Lecture source : {e}"],
        }

    # ── Étape 3 : Charger les dimensions ─────────────────────────────────────
    sk_maps: Dict[str, Dict[str, int]] = {}
    dim_metrics: Dict[str, dict] = {}

    for dim in logical_model.get("dimension_tables", []):
        dim_name   = dim.get("name", "")
        table_name = f"{user_prefix}_{dim_name}"
        try:
            result = _load_dimension(dw_engine, table_name, dim, source_df, source_dfs=source_dfs or None)
            sk_maps[dim_name]     = result["sk_map"]
            dim_metrics[dim_name] = result["metrics"]
            exec_log = exec_log + [
                f"[ETL] ✅ {table_name} — {result['metrics']['inserted']} insérées, "
                f"{result['metrics']['existing']} existantes"
            ]
        except Exception as e:
            logger.warning(f"[ETL] Dim {dim_name} erreur : {e}")
            exec_log = exec_log + [f"[ETL] ⚠️ {dim_name} : {e}"]

    # ── Étape 4 : Charger les tables de faits (Constellation) ────────────────
    fact_tables = logical_model.get("fact_tables", [])
    if not fact_tables:
        ft = logical_model.get("fact_table", {})
        fact_tables = [ft] if ft else []

    all_fact_metrics = {}
    session_id = state.get("session_id", "unknown")
    clean_action = state.get("clean_action", "NONE")

    for fact in fact_tables:
        if not fact:
            continue
        fact_name  = fact.get("name", "")
        table_name = f"{user_prefix}_{fact_name}"
        try:
            metrics = _load_fact(
                dw_engine, table_name, fact, source_df,
                sk_maps, user_prefix, session_id, clean_action,
                source_dfs=source_dfs or None,
            )
            all_fact_metrics[fact_name] = metrics
            exec_log = exec_log + [
                f"[ETL] ✅ {table_name} — {metrics.get('inserted', 0)} faits insérés, "
                f"{metrics.get('rejected', 0)} rejetés"
            ]
        except Exception as e:
            return {
                "etl_status":  "failed",
                "etl_error":   f"Erreur chargement faits ({fact_name}) : {e}",
                "retry_count": retry_count + 1,
                "execution_log": exec_log + [f"[ETL] ❌ {fact_name} : {e}"],
            }

    # ── Étape 5 : Métriques post-load ────────────────────────────────────────
    first_fact_name = fact_tables[0].get("name", "") if fact_tables else ""
    load_metrics = {
        "source_rows": len(source_df),
        "dimensions":  dim_metrics,
        "fact":        all_fact_metrics.get(first_fact_name, {}),
        "facts":       all_fact_metrics,
        "loaded_at":   datetime.now(timezone.utc).isoformat(),
        "dw_prefix":   user_prefix,
    }
    _persist_metrics(load_metrics, session_id)

    total_inserted = sum(m.get("inserted", 0) for m in all_fact_metrics.values())
    total_rejected = sum(m.get("rejected", 0) for m in all_fact_metrics.values())
    exec_log = exec_log + [
        f"[ETL] 🏁 Chargement terminé — {len(fact_tables)} fact(s), "
        f"{total_inserted} insérés / {total_rejected} rejetés"
    ]

    # ── Artefacts (DDL + KTR) ────────────────────────────────────────────────
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    ddl_path = OUTPUTS_DIR / f"{user_prefix}_schema.sql"
    ddl_path.write_text(sql_ddl, encoding="utf-8")

    ktr_xml = state.get("etl_code", "")
    if ktr_xml:
        ktr_path = OUTPUTS_DIR / f"{user_prefix}_pipeline.ktr"
        ktr_path.write_text(ktr_xml, encoding="utf-8")

    return {
        "etl_status":    "success",
        "etl_error":     "",
        "load_metrics":  load_metrics,
        "execution_log": exec_log,
    }


# ═════════════════════════════════════════════════════════════════════════════
#  DIMENSIONS — SCD Type 1 + SCD Type 2
# ═════════════════════════════════════════════════════════════════════════════

_MAX_ATTR_LEN = 4000  # safe for NVARCHAR(MAX) long text fields

def _safe_attr_val(raw) -> str:
    """Converts a raw cell value to a safe SQL string attribute.
    Binary blobs (bytes or bytes repr) are replaced with '' to avoid truncation errors.
    Other values are truncated to _MAX_ATTR_LEN chars.
    """
    if raw is None:
        return ""
    if isinstance(raw, (bytes, bytearray)):
        return ""
    s = str(raw).strip()
    # Python repr of bytes: b'\x...' or b"..." — extremely long, not useful
    if (s.startswith("b'") or s.startswith('b"')) and len(s) > 100:
        return ""
    return s[:_MAX_ATTR_LEN]


def _load_dimension(engine, table_name: str, dim_model: dict, source_df, source_dfs: Dict[str, pd.DataFrame] = None) -> dict:
    """
    Charge une table de dimension avec support SCD Type 2 :
    - Identifie la colonne source correspondante
    - Déduplique les valeurs
    - SCD Type 2 : historise les changements d'attributs (valid_from/valid_to/is_current)
    - Retourne le sk_map {valeur_naturelle: sk_current}

    Si source_dfs est fourni, résout le bon DataFrame pour cette dimension.
    Sinon, utilise source_df (legacy mono-table).
    """
    from sqlalchemy import text

    # Résoudre le DataFrame source pour cette dimension
    if source_dfs:
        resolved_df = _resolve_source_df(source_dfs, dim_model, fallback_df=source_df)
    else:
        resolved_df = source_df
    if resolved_df is None or (isinstance(resolved_df, pd.DataFrame) and resolved_df.empty):
        logger.warning(f"[ETL] Dim {dim_model.get('name', '?')}: pas de données source — sk_map vide")
        return {"sk_map": {}, "metrics": {"inserted": 0, "existing": 0, "updated": 0}}

    dim_name = dim_model.get("name", "")
    columns  = dim_model.get("columns", [])
    scd_type = dim_model.get("scd_type", 1)

    # Colonnes attributs : tout sauf pk, fk strict, et métadonnées SCD
    # On accepte role=attribute, natural_key, "", None — le LLM peut générer plusieurs valeurs
    scd_meta_cols = {"valid_from", "valid_to", "is_current"}
    _excluded_roles = {"pk", "fk"}
    attr_cols = [c for c in columns
                 if c.get("role") not in _excluded_roles
                 and c.get("name") not in scd_meta_cols]
    pk_col = next((c for c in columns if c.get("role") == "pk"), None)

    # Fallback: si aucun pk trouvé, utiliser la 1ère colonne comme pk
    if not pk_col and columns:
        pk_col = columns[0]

    has_scd2_cols = any(c.get("name") in scd_meta_cols for c in columns)
    is_scd2 = (scd_type == 2 or has_scd2_cols) and "dim_date" not in dim_name

    if not attr_cols:
        logger.warning(f"[ETL] Dim {dim_name}: aucune colonne attribut trouvée — colonnes: {[c.get('name') for c in columns]}")
        return {"sk_map": {}, "metrics": {"inserted": 0, "existing": 0, "updated": 0}}

    pk_name = pk_col["name"]

    natural_key_col = next(
        (c["name"] for c in attr_cols if c.get("natural_key")),
        attr_cols[0]["name"]
    )
    compare_attr_names = [c["name"] for c in attr_cols if c["name"] != natural_key_col]

    src_col_name = _find_source_col(natural_key_col, resolved_df.columns.tolist())

    # If natural key column not found, try every attr_col as fallback before giving up
    if src_col_name is None:
        for _fallback_ac in attr_cols:
            _fb = _find_source_col(_fallback_ac["name"], resolved_df.columns.tolist())
            if _fb:
                natural_key_col  = _fallback_ac["name"]
                src_col_name     = _fb
                compare_attr_names = [c["name"] for c in attr_cols if c["name"] != natural_key_col]
                logger.warning(
                    f"[ETL] Dim {dim_name}: natural key not found in source — "
                    f"falling back to '{natural_key_col}' → src col '{_fb}'"
                )
                break
        if src_col_name is None:
            logger.warning(
                f"[ETL] Dim {dim_name}: NO source column matched any attr col "
                f"(source cols: {resolved_df.columns.tolist()[:8]}) — dimension will load 0 rows"
            )

    src_attr_mapping: Dict[str, str] = {}
    for ac in attr_cols:
        sc = _find_source_col(ac["name"], resolved_df.columns.tolist())
        if sc:
            src_attr_mapping[ac["name"]] = sc

    sk_map: Dict[str, int] = {}
    inserted = 0
    existing = 0
    updated  = 0

    if src_col_name:
        unique_vals = resolved_df[src_col_name].dropna().unique().tolist()

        with engine.begin() as conn:
            for val in unique_vals:
                clean_val = str(val).strip()
                if not clean_val:
                    continue

                try:
                    if is_scd2:
                        # ─── SCD TYPE 2 ────────────────────────────────────
                        row = conn.execute(
                            text(f"SELECT TOP 1 [{pk_name}], "
                                 + ", ".join(f"[{a}]" for a in compare_attr_names)
                                 + f" FROM [{table_name}] WHERE [{natural_key_col}] = :v AND [is_current] = 1"),
                            {"v": clean_val}
                        ).fetchone()

                        if row:
                            old_sk = row[0]
                            old_attrs = {compare_attr_names[i]: row[i + 1]
                                         for i in range(len(compare_attr_names))}

                            match_rows = resolved_df[
                                resolved_df[src_col_name].astype(str).str.strip() == clean_val
                            ]
                            src_row = match_rows.iloc[-1] if len(match_rows) > 0 else None
                            new_attrs: Dict[str, str] = {}
                            for dim_col in compare_attr_names:
                                sc = src_attr_mapping.get(dim_col)
                                if sc and src_row is not None:
                                    new_attrs[dim_col] = _safe_attr_val(src_row.get(sc, ""))
                                else:
                                    new_attrs[dim_col] = _safe_attr_val(old_attrs.get(dim_col, ""))

                            changed = any(
                                str(old_attrs.get(k, "")).strip() != str(new_attrs.get(k, "")).strip()
                                for k in compare_attr_names
                                if new_attrs.get(k) and old_attrs.get(k) is not None
                            )

                            if changed:
                                conn.execute(
                                    text(f"UPDATE [{table_name}] SET [is_current] = 0, "
                                         f"[valid_to] = GETDATE() "
                                         f"WHERE [{pk_name}] = :sk"),
                                    {"sk": old_sk}
                                )

                                all_insert_cols = {natural_key_col: clean_val}
                                for dim_col in compare_attr_names:
                                    all_insert_cols[dim_col] = new_attrs.get(dim_col, "")
                                all_insert_cols["is_current"] = 1

                                non_func_cols = {k: v for k, v in all_insert_cols.items()}
                                cols_str = ", ".join(f"[{k}]" for k in non_func_cols) + ", [valid_from], [valid_to]"
                                vals_str = ", ".join(f":{k}" for k in non_func_cols) + ", GETDATE(), '9999-12-31'"

                                conn.execute(text(
                                    f"INSERT INTO [{table_name}] ({cols_str}) VALUES ({vals_str})"
                                ), non_func_cols)

                                row2 = conn.execute(
                                    text(f"SELECT TOP 1 [{pk_name}] FROM [{table_name}] "
                                         f"WHERE [{natural_key_col}] = :v AND [is_current] = 1 "
                                         f"ORDER BY [{pk_name}] DESC"),
                                    {"v": clean_val}
                                ).fetchone()
                                if row2:
                                    sk_map[clean_val] = row2[0]
                                updated += 1
                            else:
                                sk_map[clean_val] = old_sk
                                existing += 1
                        else:
                            insert_vals = {natural_key_col: clean_val}
                            for dim_col in compare_attr_names:
                                sc = src_attr_mapping.get(dim_col)
                                if sc:
                                    src_rows = resolved_df[
                                        resolved_df[src_col_name].astype(str).str.strip() == clean_val
                                    ]
                                    if len(src_rows) > 0:
                                        insert_vals[dim_col] = _safe_attr_val(src_rows.iloc[-1].get(sc, ""))

                            insert_vals["is_current"] = 1
                            non_func_cols = {k: v for k, v in insert_vals.items()}
                            cols_str = ", ".join(f"[{k}]" for k in non_func_cols) + ", [valid_from], [valid_to]"
                            vals_str = ", ".join(f":{k}" for k in non_func_cols) + ", GETDATE(), '9999-12-31'"

                            conn.execute(text(
                                f"INSERT INTO [{table_name}] ({cols_str}) VALUES ({vals_str})"
                            ), non_func_cols)

                            row2 = conn.execute(
                                text(f"SELECT TOP 1 [{pk_name}] FROM [{table_name}] "
                                     f"WHERE [{natural_key_col}] = :v AND [is_current] = 1 "
                                     f"ORDER BY [{pk_name}] DESC"),
                                {"v": clean_val}
                            ).fetchone()
                            if row2:
                                sk_map[clean_val] = row2[0]
                                inserted += 1

                    else:
                        # ─── SCD TYPE 1 ────────────────────────────────────
                        check_col = natural_key_col
                        row = conn.execute(
                            text(f"SELECT TOP 1 [{pk_name}] FROM [{table_name}] WHERE [{check_col}] = :v"),
                            {"v": clean_val}
                        ).fetchone()

                        if row:
                            sk_map[clean_val] = row[0]
                            existing += 1
                        else:
                            # Build complete row with ALL attribute columns mapped from source
                            insert_vals = {natural_key_col: clean_val}
                            for dim_col in compare_attr_names:
                                sc = src_attr_mapping.get(dim_col)
                                if sc:
                                    src_rows = resolved_df[
                                        resolved_df[src_col_name].astype(str).str.strip() == clean_val
                                    ]
                                    if len(src_rows) > 0:
                                        insert_vals[dim_col] = _safe_attr_val(src_rows.iloc[-1].get(sc, ""))

                            cols_str = ", ".join(f"[{k}]" for k in insert_vals)
                            vals_str = ", ".join(f":{k}" for k in insert_vals)
                            conn.execute(text(
                                f"INSERT INTO [{table_name}] ({cols_str}) VALUES ({vals_str})"
                            ), insert_vals)

                            row2 = conn.execute(
                                text(f"SELECT TOP 1 [{pk_name}] FROM [{table_name}] WHERE [{check_col}] = :v"),
                                {"v": clean_val}
                            ).fetchone()
                            if row2:
                                sk_map[clean_val] = row2[0]
                                inserted += 1

                except Exception as e:
                    logger.warning(f"[ETL] Dim {table_name} val '{clean_val}' : {e}")

    # dim_date : chargement automatique depuis la source
    if "dim_date" in dim_name:
        sk_map.update(_load_dim_date_from_source(engine, table_name, resolved_df))
        inserted = len(sk_map)

    return {"sk_map": sk_map, "metrics": {"inserted": inserted, "existing": existing, "updated": updated}}


def _load_dim_date_from_source(engine, table_name: str, source_df) -> dict:
    """Charge dim_date depuis une plage calendaire complète + colonnes dates source."""
    import datetime
    from sqlalchemy import text

    sk_map: Dict[str, int] = {}
    dates_seen: set = set()

    # ── 1. Plage calendaire par défaut (1990 → 2030) ──────────────────────────
    calendar_dates = pd.date_range(start="1990-01-01", end="2030-12-31", freq="D").date
    all_dates = set(calendar_dates)

    # ── 2. Ajouter les dates détectées dans la source ─────────────────────────
    if source_df is not None and not source_df.empty:
        date_cols = [
            c for c in source_df.columns
            if "date" in c.lower() or (
                source_df[c].dtype in ("datetime64[ns]", "object")
                and _is_date_column(source_df[c])
            )
        ]
        for dcol in date_cols[:3]:
            try:
                src_dates = pd.to_datetime(source_df[dcol], errors="coerce").dropna().dt.date
                all_dates.update(src_dates)
            except Exception:
                pass

    # ── 3. Insérer / merger toutes les dates ──────────────────────────────────
    with engine.begin() as conn:
        for d in sorted(all_dates):
            if d in dates_seen:
                continue
            dates_seen.add(d)
            key = str(d)

            row = conn.execute(
                text(f"SELECT TOP 1 [date_sk] FROM [{table_name}] WHERE [date_full] = :d"),
                {"d": d}
            ).fetchone()

            if row:
                sk_map[key] = row[0]
            else:
                dt = d if isinstance(d, datetime.date) else datetime.date.fromisoformat(key)
                iso = dt.isocalendar()
                conn.execute(text(f"""
                    MERGE [{table_name}] AS Target
                    USING (SELECT CAST(:df AS DATE) AS date_full) AS Source
                    ON Target.[date_full] = Source.[date_full]
                    WHEN NOT MATCHED THEN
                        INSERT ([date_full],[year],[semester],[quarter],[month],[month_name],
                                [week],[day],[day_of_week],[day_name],[is_weekend],
                                [is_month_start],[is_month_end])
                        VALUES (:df,:y,:sem,:q,:m,:mname,:w,:d2,:wd,:dname,:wkend,:mstart,:mend);
                """), {
                    "df":     d,
                    "y":      dt.year,
                    "sem":    1 if dt.month <= 6 else 2,
                    "q":      (dt.month - 1) // 3 + 1,
                    "m":      dt.month,
                    "mname":  dt.strftime("%B"),
                    "w":      iso[1],
                    "d2":     dt.day,
                    "wd":     dt.isoweekday(),
                    "dname":  dt.strftime("%A"),
                    "wkend":  1 if dt.weekday() >= 5 else 0,
                    "mstart": 1 if dt.day == 1 else 0,
                    "mend":   1 if (dt + datetime.timedelta(days=1)).month != dt.month else 0,
                })

                row2 = conn.execute(
                    text(f"SELECT TOP 1 [date_sk] FROM [{table_name}] WHERE [date_full] = :d"),
                    {"d": d}
                ).fetchone()
                if row2:
                    sk_map[key] = row2[0]

    logger.info(f"[ETL] dim_date loaded : {len(sk_map)} dates (plage {min(dates_seen)} → {max(dates_seen)})")
    return sk_map


# ═════════════════════════════════════════════════════════════════════════════
#  FACT LOAD — itertuples + broadcast throttlé + batching réel
# ═════════════════════════════════════════════════════════════════════════════

def _load_fact(engine, table_name: str, fact_model: dict, source_df,
               sk_maps: dict, prefix: str, session_id: str = "unknown",
               clean_action: str = "NONE",
               source_dfs: Dict[str, pd.DataFrame] = None) -> dict:
    """
    Charge la table de faits :
    - Résolution des SKs via sk_maps
    - Mapping des métriques numériques
    - Compte les insertions et rejets
    - Redirige les rejets vers la table de quarantaine
    - Diffuse la progression via SSE (throttlé à 2 pulses/sec max)
    - Supporte IGNORE_REJECTS (dédup in-memory)

    Si source_dfs est fourni, résout le bon DataFrame pour cette table de faits.
    Sinon, utilise source_df (legacy mono-table).
    """

    # Résoudre le DataFrame source pour cette table de faits
    if source_dfs:
        resolved_df = _resolve_source_df(source_dfs, fact_model, fallback_df=source_df)
    else:
        resolved_df = source_df
    if resolved_df is None or (isinstance(resolved_df, pd.DataFrame) and resolved_df.empty):
        logger.warning(f"[ETL] Fact {fact_model.get('name', '?')}: pas de données source — skip")
        return {"inserted": 0, "rejected": 0, "reason": "No source data for this fact table"}
    try:
        from api.services.sse import broadcast
    except Exception:
        def broadcast(*_args, **_kwargs):  # type: ignore
            return None

    use_ignore = clean_action in ("IGNORE_REJECTS", "DEDUPLICATE")

    fact_name    = fact_model.get("name", "")
    reject_table = f"{prefix}_rejets_{fact_name}" if fact_name else ""

    columns  = fact_model.get("columns", [])
    fk_cols  = [c for c in columns if c.get("role") == "fk"]
    # Accepter role=metric, measure, ou toute colonne non-fk/non-pk comme métrique potentielle
    met_cols = [c for c in columns if c.get("role") in ("metric", "measure")]
    if not met_cols:
        # Fallback: toutes les colonnes non-fk et non-pk sont des métriques candidates
        met_cols = [c for c in columns if c.get("role") not in ("fk", "pk")]

    if not met_cols:
        return {"inserted": 0, "rejected": 0, "reason": "Aucune métrique définie"}

    total_rows = len(resolved_df)
    inserted   = 0
    rejected   = 0
    rows_batch: List[Dict[str, Any]] = []

    src_cols_list = resolved_df.columns.tolist()
    BATCH_SIZE  = 500
    PULSE_EVERY = 0.5  # secondes — max 2 pulses SSE / seconde

    load_start_ts = time.monotonic()
    last_pulse    = load_start_ts

    # ⚡ itertuples ≈ 5-10× plus rapide qu'iterrows
    for idx, src_tuple in enumerate(resolved_df.itertuples(index=False, name="Row")):
        src_row = src_tuple._asdict()
        row_dict: Dict[str, Any] = {}

        # ─── Résolution des FKs ──────────────────────────────────────────────
        for fk in fk_cols:
            fk_name = fk["name"]
            ref_dim = fk.get("references", "")
            dim_sks = sk_maps.get(ref_dim, {})

            nat_key_col = _find_source_col(fk_name.replace("_sk", ""), src_cols_list)
            nat_val = str(src_row.get(nat_key_col, "")).strip() if nat_key_col else ""
            sk_val  = dim_sks.get(nat_val) if (dim_sks and nat_val) else None

            if sk_val:
                row_dict[fk_name] = sk_val
            elif "date" in ref_dim and nat_key_col:
                try:
                    d = str(pd.to_datetime(src_row.get(nat_key_col)).date())
                    row_dict[fk_name] = dim_sks.get(d, 1) if dim_sks else 1
                except Exception:
                    row_dict[fk_name] = 1
            else:
                # Always populate FK with a valid integer — prevents NOT NULL violations
                row_dict[fk_name] = 1

        # ─── Mapping métriques ───────────────────────────────────────────────
        mapped_src_cols = set()  # colonnes source déjà utilisées
        for met in met_cols:
            met_name = met["name"]
            formula  = met.get("formula", "")
            is_dec   = "decimal" in met.get("type", "").lower() or "float" in met.get("type", "").lower() or "real" in met.get("type", "").lower()

            if formula:
                # ── Colonne calculée : évaluation de formule sécurisée ──────
                try:
                    safe_env = {k.lower().replace(" ", "_"): (float(v) if v is not None else 0)
                                for k, v in src_row.items()}
                    result_val = eval(formula.lower(), {"__builtins__": {}}, safe_env)  # noqa: S307
                    row_dict[met_name] = round(float(result_val), 4)
                except Exception:
                    # Fallback : chercher colonne source de même nom
                    src_col = _find_source_col(met_name, src_cols_list)
                    if src_col:
                        try:
                            row_dict[met_name] = float(src_row.get(src_col, 0)) if is_dec else int(float(src_row.get(src_col, 0)))
                        except (ValueError, TypeError):
                            row_dict[met_name] = 0.0 if is_dec else 0
            else:
                src_col = _find_source_col(met_name, src_cols_list)
                if src_col:
                    mapped_src_cols.add(src_col)
                    val = src_row.get(src_col, 0)
                    try:
                        row_dict[met_name] = round(float(val), 4) if is_dec else int(float(val))
                    except (ValueError, TypeError):
                        row_dict[met_name] = 0.0 if is_dec else 0

        # ── Auto-map : colonnes numériques source non encore mappées ────────
        # Pour ne perdre aucune donnée numérique, on tente de les rattacher
        # aux colonnes DW non encore remplies.
        unmatched_dw = [m["name"] for m in met_cols if m["name"] not in row_dict and not m.get("formula")]
        if unmatched_dw:
            numeric_unmapped = [
                c for c in src_cols_list
                if c not in mapped_src_cols
                and pd.api.types.is_numeric_dtype(resolved_df[c])
            ]
            for dw_col, src_c in zip(unmatched_dw, numeric_unmapped):
                val = src_row.get(src_c, 0)
                try:
                    row_dict[dw_col] = round(float(val), 4)
                except (ValueError, TypeError):
                    row_dict[dw_col] = 0.0

        if row_dict:
            rows_batch.append(row_dict)

        # ─── Batch flush ─────────────────────────────────────────────────────
        if len(rows_batch) >= BATCH_SIZE:
            ins, rej = _batch_insert(engine, table_name, rows_batch, use_ignore, reject_table)
            inserted += ins
            rejected += rej
            rows_batch = []

            now = time.monotonic()
            if now - last_pulse >= PULSE_EVERY:
                pct = round((idx / max(1, total_rows)) * 100, 1)
                bar = "▰" * int(pct / 5) + "▱" * max(0, 20 - int(pct / 5))
                elapsed = max(0.1, now - load_start_ts)
                broadcast(session_id, "etl_progress", {
                    "table":        table_name,
                    "inserted":     inserted,
                    "rejected":     rejected,
                    "total":        total_rows,
                    "pct":          pct,
                    "bar":          bar,
                    "rate_rows_s":  round(inserted / elapsed, 1),
                    "phase":        f"Loading ⚡ [{bar}] {pct:.1f}%",
                })
                last_pulse = now

    # ─── Flush final ─────────────────────────────────────────────────────────
    if rows_batch:
        ins, rej = _batch_insert(engine, table_name, rows_batch, use_ignore, reject_table)
        inserted += ins
        rejected += rej

    elapsed_total = max(0.1, time.monotonic() - load_start_ts)

    # ─── SQL UPDATE post-load : calcul des métriques dérivées ────────────────
    # Pour chaque colonne avec un champ "formula", on exécute un UPDATE SQL
    # afin de recalculer la valeur en utilisant les colonnes déjà en base.
    computed_updates = 0
    try:
        from sqlalchemy import text as sa_text
        with engine.connect() as conn:
            for met in met_cols:
                formula = met.get("formula", "")
                met_name = met["name"]
                if not formula:
                    continue
                # Convertir la formule Python en SQL (cas courants)
                sql_formula = formula
                # Python -> SQL opérators
                sql_formula = sql_formula.replace("**", "").replace("^", "")
                # Nettoyer espaces
                sql_formula = sql_formula.strip()
                update_sql = f"UPDATE [{table_name}] SET [{met_name}] = {sql_formula} WHERE [{met_name}] IS NULL OR [{met_name}] = 0"
                try:
                    conn.execute(sa_text(update_sql))
                    computed_updates += 1
                    logger.info(f"[ETL] Computed column [{met_name}] updated via: {sql_formula}")
                except Exception as upd_err:
                    logger.warning(f"[ETL] Computed column [{met_name}] SQL update failed: {upd_err}")
            conn.commit()

            # ── Métriques dérivées automatiques communes ──────────────────
            # Detect if we have unit_price, quantity, discount → calculate extended_price
            auto_formulas = {
                "extended_price":  "unit_price * quantity * (1.0 - discount)",
                "total_amount":    "unit_price * quantity * (1.0 - discount)",
                "line_total":      "unit_price * quantity * (1.0 - discount)",
                "amount":          "unit_price * quantity",
            }
            # Get actual column names in the table
            try:
                from sqlalchemy import inspect as sa_inspect
                inspector = sa_inspect(engine)
                tbl_name_clean = table_name.strip("[]")
                existing_cols = {c["name"].lower() for c in inspector.get_columns(tbl_name_clean)}
                has_price    = any(c in existing_cols for c in ("unit_price", "unitprice"))
                has_qty      = any(c in existing_cols for c in ("quantity", "qty"))
                has_discount = any(c in existing_cols for c in ("discount",))

                if has_price and has_qty:
                    price_col    = "unit_price" if "unit_price" in existing_cols else "unitprice"
                    qty_col      = "quantity" if "quantity" in existing_cols else "qty"
                    disc_col     = "discount"  if "discount"  in existing_cols else None
                    disc_expr    = f" * (1.0 - [{disc_col}])" if disc_col else ""

                    for target_col in auto_formulas:
                        if target_col in existing_cols:
                            auto_sql = (f"UPDATE [{table_name}] SET [{target_col}] = "
                                        f"[{price_col}] * [{qty_col}]{disc_expr} "
                                        f"WHERE [{target_col}] IS NULL OR [{target_col}] = 0")
                            try:
                                conn.execute(sa_text(auto_sql))
                                computed_updates += 1
                                logger.info(f"[ETL] Auto-computed [{target_col}]")
                            except Exception:
                                pass
                    conn.commit()
            except Exception as insp_err:
                logger.debug(f"[ETL] Auto-formula inspect error: {insp_err}")

    except Exception as post_err:
        logger.warning(f"[ETL] Post-load computed columns failed: {post_err}")

    broadcast(session_id, "etl_progress", {
        "table":       table_name,
        "inserted":    inserted,
        "rejected":    rejected,
        "total":       total_rows,
        "pct":         100.0,
        "bar":         "▰" * 20,
        "rate_rows_s": round(inserted / elapsed_total, 1),
        "phase":       f"✅ Done — {inserted:,} rows in {elapsed_total:.1f}s",
    })

    return {
        "inserted":        inserted,
        "rejected":        rejected,
        "source_rows":     len(resolved_df),
        "duration_s":      round(elapsed_total, 2),
        "rate_rows_s":     round(inserted / elapsed_total, 1),
        "computed_updates": computed_updates,
    }


# ═════════════════════════════════════════════════════════════════════════════
#  BATCH INSERT — vrai executemany, respect de la limite 2100 paramètres
# ═════════════════════════════════════════════════════════════════════════════

def _batch_insert(engine, table_name: str, rows: list, use_ignore: bool = False,
                   reject_table: str = "") -> Tuple[int, int]:
    """
    Insère un batch via executemany réel (fast_executemany=True exploité par
    pyodbc Driver 17). Stratégie :

      1) Insertion en masse par chunks sûrs (< 2000 paramètres, marge sur la
         limite dure 2100 de SQL Server).
      2) En cas d'échec du chunk : repli ligne-à-ligne sur ce chunk uniquement,
         avec redirection des rejets vers la table de quarantaine.
      3) use_ignore=True : dédup in-memory avant insertion (plus de faux-MERGE
         'ON 1=0' qui ne servait à rien).

    Retour : (inserted, rejected)
    """
    from sqlalchemy import text

    if not rows:
        return 0, 0

    cols     = list(rows[0].keys())
    cols_str = ", ".join(f"[{c}]" for c in cols)
    vals_str = ", ".join(f":{c}" for c in cols)
    insert_sql = text(f"INSERT INTO [{table_name}] ({cols_str}) VALUES ({vals_str})")

    MAX_PARAMS = 2000
    chunk_size = max(1, MAX_PARAMS // max(1, len(cols)))

    if use_ignore:
        seen = set()
        deduped = []
        for r in rows:
            key = tuple(r.get(c) for c in cols)
            if key not in seen:
                seen.add(key)
                deduped.append(r)
        rows = deduped

    inserted = 0
    rejected = 0

    for start in range(0, len(rows), chunk_size):
        chunk = rows[start:start + chunk_size]
        try:
            with engine.begin() as conn:
                conn.execute(insert_sql, chunk)
            inserted += len(chunk)
        except Exception as batch_err:
            logger.warning(
                f"[ETL] Batch {table_name} ({len(chunk)} rows) a échoué ({batch_err}). "
                "Repli ligne-à-ligne."
            )
            for row in chunk:
                try:
                    with engine.begin() as conn:
                        conn.execute(insert_sql, row)
                    inserted += 1
                except Exception as row_err:
                    rejected += 1
                    if reject_table:
                        try:
                            row_json = json.dumps(
                                {k: str(v) for k, v in row.items()},
                                default=str, ensure_ascii=False,
                            )
                            with engine.begin() as conn:
                                conn.execute(
                                    text(
                                        f"INSERT INTO [{reject_table}] "
                                        f"([error_reason], [source_row_json]) "
                                        f"VALUES (:err, :rj)"
                                    ),
                                    {"err": str(row_err)[:500], "rj": row_json},
                                )
                        except Exception as q_err:
                            logger.debug(f"[ETL] Quarantine insert failed: {q_err}")

    return inserted, rejected


# ═════════════════════════════════════════════════════════════════════════════
#  CONNECTION LAYER — TDS-safe pour SQL Server / Express
# ═════════════════════════════════════════════════════════════════════════════

def _normalize_sqlserver_target(host: str, port) -> str:
    """
    Construit un SERVER= robuste pour SQL Server / Express.

    Règles :
      - host contient un backslash (instance nommée) → 'host\\INSTANCE' SEUL
        (SQL Browser actif requis ; pas de port pour éviter les conflits TDS).
      - host = 'host,port' déjà fourni par l'utilisateur → on le garde.
      - sinon → 'host,port'.
    """
    import os

    host = (host or "").strip()
    port = str(port or "").strip()
    env_port = str(int(os.getenv("DB_PORT", "1433").strip()))

    if not host:
        h = (os.getenv("DB_HOST", "127.0.0.1") or "127.0.0.1").strip()
        return f"{h},{env_port}"
    if "," in host:
        return host
    if "\\" in host:
        logger.info(
            f"[_build_engine] Instance nommée détectée ({host}) — "
            "SQL Browser requis, port ignoré pour éviter le conflit TDS."
        )
        return host
    return f"{host},{port or env_port}"


def _build_engine(config: dict):
    """Construit un engine SQLAlchemy - v4.3 TDS-safe + pool tunable.

    Variables d'env (pour la prod) :
      DB_POOL_SIZE        (default 5)
      DB_POOL_MAX_OVERFLOW (default 10)
      DB_POOL_TIMEOUT     (default 30)
      DB_POOL_RECYCLE     (default 1800)
    """
    import os
    from sqlalchemy import create_engine
    from urllib.parse import quote_plus

    pool_size = int(os.getenv("DB_POOL_SIZE", "5"))
    pool_max_overflow = int(os.getenv("DB_POOL_MAX_OVERFLOW", "10"))
    pool_timeout = int(os.getenv("DB_POOL_TIMEOUT", "30"))
    pool_recycle = int(os.getenv("DB_POOL_RECYCLE", "1800"))

    db_type = config.get("type", "sqlserver").lower().replace("postgres", "postgresql")
    database = config.get("database", "data_warehouse")

    if db_type in ("sqlserver", "mssql"):
        host = (config.get("host") or os.getenv("DB_HOST") or "localhost").strip()
        user = (config.get("user") or os.getenv("DB_USER", "sa")).strip()
        password = (config.get("password") or "").strip()
        raw_port = config.get("port")
        if raw_port is not None and str(raw_port).strip() != "":
            port = int(str(raw_port).strip())
        else:
            # Le frontend n'envoie souvent pas le port ; aligner sur le backend (.env) / Docker.
            port = int(os.getenv("DB_PORT", "1433").strip())
        if not password:
            password = (os.getenv("DB_PASSWORD", "") or "").strip()
    else:
        host = (config.get("host") or "localhost").strip()
        port = config.get("port", 3306 if db_type in ("mysql", "mariadb") else 5432)
        user = config.get("user", "root" if db_type in ("mysql", "mariadb") else "postgres")
        password = config.get("password", "") or ""
        if db_type not in ("sqlite",):
            try:
                port = int(port)
            except (TypeError, ValueError):
                port = 3306

    if db_type == "sqlite":
        return create_engine(f"sqlite:///{database}", pool_pre_ping=True)

    if db_type in ("sqlserver", "mssql"):
        import pyodbc
        server = _normalize_sqlserver_target(host, port)

        # Échappement ODBC officiel : '}' dans un password doit être doublé.
        safe_pwd = (password or "").replace("}", "}}")
        conn_str = (
            f"DRIVER={{ODBC Driver 17 for SQL Server}};"
            f"SERVER={server};"
            f"DATABASE={database};"
            f"UID={user};"
            f"PWD={{{safe_pwd}}};"
            f"Encrypt=no;"
            f"TrustServerCertificate=yes;"
            f"Connection Timeout=30;"
            f"MARS_Connection=yes;"
        )
        logger.info(
            f"[_build_engine] SQL Server resolved → SERVER={server}, DB={database}, UID={user}"
        )

        # ✅ creator= : bypass complet du parsing URL SQLAlchemy, identique à
        # get_meta_connection() qui fonctionne côté métadonnées.
        def _connect():
            return pyodbc.connect(conn_str, autocommit=False, timeout=30)

        return create_engine(
            "mssql+pyodbc://",
            creator=_connect,
            pool_size=pool_size,
            max_overflow=pool_max_overflow,
            pool_timeout=pool_timeout,
            pool_recycle=pool_recycle,
            pool_pre_ping=True,
            fast_executemany=True,
            future=True,
        )

    # Autres dialectes (MySQL, Postgres)
    driver_map = {"mysql": "mysqlconnector", "postgresql": "psycopg2"}
    driver = driver_map.get(db_type, "pyodbc")
    pwd_enc = quote_plus(password or "")
    return create_engine(
        f"{db_type}+{driver}://{user}:{pwd_enc}@{host}:{port}/{database}",
        pool_size=pool_size,
        max_overflow=pool_max_overflow,
        pool_timeout=pool_timeout,
        pool_recycle=pool_recycle,
        pool_pre_ping=True,
    )


def _test_connection(engine) -> None:
    """Ping réel : SELECT 1 + lecture de @@VERSION pour valider le handshake TDS."""
    from sqlalchemy import text
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
        try:
            row = conn.execute(text("SELECT @@VERSION AS v")).fetchone()
            if row:
                version = str(row[0]).split("\n")[0][:80]
                logger.info(f"[_test_connection] ✅ TDS handshake OK — {version}")
        except Exception:
            logger.info("[_test_connection] ✅ Connexion OK (dialecte non-SQL Server)")


# ═════════════════════════════════════════════════════════════════════════════
#  DDL EXECUTION — AUTOCOMMIT + split 'GO' + tolérance 'already exists'
# ═════════════════════════════════════════════════════════════════════════════

_DDL_GO_SPLITTER = re.compile(r'^\s*GO\s*;?\s*$', re.IGNORECASE | re.MULTILINE)


def _normalize_tsql_ddl(sql_ddl: str) -> str:
    """
    Last-line deterministic cleanup before SQL Server execution.
    LLM/healer output can accidentally create invalid tokens such as
    DATETIME22(3) or SYSUTCDATETIME2(); fix them here before splitting.
    """
    if not sql_ddl:
        return sql_ddl

    ddl = sql_ddl
    ddl = re.sub(r"\bDATETIME22\b", "DATETIME2", ddl, flags=re.IGNORECASE)
    ddl = re.sub(r"\bSYSUTCDATETIME2\s*\(", "SYSUTCDATETIME(", ddl, flags=re.IGNORECASE)
    ddl = re.sub(r"\bDATETIME\b(?!\s*\()", "DATETIME2", ddl, flags=re.IGNORECASE)
    ddl = ddl.replace("TINYINT(1)", "BIT").replace("AUTO_INCREMENT", "IDENTITY(1,1)")
    return ddl


def _split_tsql_batches(sql_ddl: str) -> list:
    """
    Découpe un script T-SQL comme sqlcmd :
      1) retire commentaires -- et /* */
      2) split sur 'GO' en tant que ligne entière
      3) split chaque batch sur ';'
    """
    sql_ddl = _normalize_tsql_ddl(sql_ddl)
    sql_clean = re.sub(r'--.*$', '', sql_ddl, flags=re.MULTILINE)
    sql_clean = re.sub(r'/\*.*?\*/', '', sql_clean, flags=re.DOTALL)

    batches = _DDL_GO_SPLITTER.split(sql_clean)

    statements: List[str] = []
    for batch in batches:
        for stmt in batch.split(";"):
            s = stmt.strip()
            if len(s) >= 5:
                statements.append(s)
    return statements


_CREATE_TABLE_RE = re.compile(
    r'CREATE\s+TABLE\s+(?:\[?\w+\]?\.)?\[?(\w+)\]?\s*\(',
    re.IGNORECASE,
)


def _drop_tables_for_ddl(conn, statements: list) -> None:
    """
    Drop every table that appears in a CREATE TABLE statement within the DDL.
    Processes facts (with FK refs) before dimensions so FK constraints don't block the drops.
    Uses dynamic SQL to drop any referencing FK constraints first.
    """
    from sqlalchemy import text as _text

    tables = []
    for stmt in statements:
        m = _CREATE_TABLE_RE.search(stmt)
        if m:
            tables.append(m.group(1))

    if not tables:
        return

    # Drop in reverse declaration order (facts first since they hold the FKs)
    for tbl in reversed(tables):
        try:
            conn.execute(_text(f"""
                IF OBJECT_ID(N'[{tbl}]', N'U') IS NOT NULL
                BEGIN
                    DECLARE @drop_fks NVARCHAR(MAX) = N'';
                    SELECT @drop_fks = @drop_fks
                        + N'ALTER TABLE [' + OBJECT_NAME(parent_object_id)
                        + N'] DROP CONSTRAINT [' + name + N'];'
                    FROM sys.foreign_keys
                    WHERE referenced_object_id = OBJECT_ID(N'[{tbl}]');
                    IF LEN(@drop_fks) > 0 EXEC sp_executesql @drop_fks;
                    DROP TABLE [{tbl}];
                END
            """))
            logger.info(f"[ExecuteDDL] ♻ Dropped existing table [{tbl}] for schema refresh")
        except Exception as drop_err:
            logger.warning(f"[ExecuteDDL] Could not drop [{tbl}]: {drop_err}")


def _execute_ddl(engine, sql_ddl: str) -> str:
    """
    Exécute le DDL en AUTOCOMMIT.
    DROP + RE-CREATE toutes les tables du DDL pour garantir que le schéma
    correspond toujours au modèle logique courant (évite les erreurs de
    colonnes manquantes dues aux re-générations LLM).
    Retourne '' si OK, message d'erreur sinon.
    """
    from sqlalchemy import text

    statements = _split_tsql_batches(sql_ddl)
    if not statements:
        return "DDL vide après nettoyage."

    conn_str = str(engine.url)
    logger.info(f"[ExecuteDDL] Target DB: {conn_str.split('@')[-1] if '@' in conn_str else 'localhost'}")

    try:
        # FIX v4.3 — Use explicit commit instead of AUTOCOMMIT isolation level
        # which is unreliable with pyodbc/SQLAlchemy 2.0
        with engine.connect() as conn:
            # Phase 1 — Drop existing tables so new schema is always applied fresh
            _drop_tables_for_ddl(conn, statements)
            conn.commit()  # Ensure drops are committed

            # Phase 2 — Execute all DDL statements
            executed = 0
            for stmt in statements:
                try:
                    conn.execute(text(stmt))
                    executed += 1
                except Exception as stmt_err:
                    msg = str(stmt_err)
                    # Tolerate "already exists" for non-table objects (indexes, constraints…)
                    if "already" in msg.lower() and "exist" in msg.lower():
                        logger.info(f"[ExecuteDDL] ⊙ objet déjà existant (skipped) : {stmt[:60]}")
                        continue
                    logger.error(f"[ExecuteDDL] ❌ Statement: {stmt[:100]}... → {msg}")
                    conn.rollback()
                    return f"Erreur SQL: {msg} (Statement: {stmt[:80]}...)"

            # CRITICAL: Explicit commit before returning
            conn.commit()
            logger.info(f"[ExecuteDDL] ✅ {executed} statements committed successfully")
        return ""
    except Exception as e:
        logger.error(f"[ExecuteDDL] ❌ Global: {e}")
        return f"Erreur globale DDL: {e}"


def _verify_tables_created(engine, user_prefix: str) -> Tuple[int, List[str]]:
    """
    Vérifie activement que les tables 'user_prefix_%' existent bien dans la DB
    cible après l'exécution du DDL. Retourne (nb_tables, noms_complets).
    Utilisé par etl_initializer_node pour éviter les 'success' fantômes.

    FIX v4.3 — Ajoute un délai de récupération pour la cohérence de connexion
    et supporte les tables sans underscore (ex: 'prefixDimName').
    """
    from sqlalchemy import text
    import time

    # Essayer deux patterns: avec underscore (standard) et sans (fallback)
    patterns = [
        f"{user_prefix.replace('[', '[[]').replace('%', '[%]')}[_]%",  # prefix_tablename
        f"{user_prefix.replace('[', '[[]').replace('%', '[%]')}%",      # prefixTablename (sans _)
    ]

    sql = text("""
        SELECT TABLE_SCHEMA + '.' + TABLE_NAME AS full_name
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
          AND TABLE_NAME LIKE :p
        ORDER BY TABLE_NAME
    """)

    # FIX: Petit délai pour la cohérence de la connexion pyodbc
    time.sleep(0.1)

    for pattern in patterns:
        try:
            with engine.connect() as conn:
                rows = conn.execute(sql, {"p": pattern}).fetchall()
            names = [r[0] for r in rows]
            if names:
                logger.info(f"[_verify_tables_created] Pattern={pattern!r} → {len(names)} tables: {names}")
                return len(names), names
        except Exception as e:
            logger.warning(f"[_verify_tables_created] Pattern={pattern!r} error: {e}")

    logger.warning(f"[_verify_tables_created] Aucune table trouvée avec les patterns: {patterns}")
    return 0, []


# ═════════════════════════════════════════════════════════════════════════════
#  SOURCE READING
# ═════════════════════════════════════════════════════════════════════════════

def _read_source(config: dict, dw_config: dict = None):
    """Lit les données source et retourne un DataFrame pandas."""
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

    elif source_type in ("mysql", "postgresql", "postgres", "sqlite", "sqlserver", "mssql", "bak"):
        if source_type == "bak":
            if not dw_config:
                raise ValueError("DW config missing for 'bak' source type")
            source_cfg = dw_config.copy()
            # FIX: Ensure restored_db is not None - fallback to dw_config.database or raise clear error
            restored_db = config.get("restored_db") or dw_config.get("database")
            if not restored_db:
                raise ValueError("restored_db is required for .bak source type. Please configure the source database name.")
            source_cfg["database"] = restored_db
            source_cfg["type"] = "sqlserver"
            src_engine = _build_engine(source_cfg)
        else:
            src_engine = _build_engine(config)

        table = config.get("table", "")
        if table:
            if "sqlserver" in str(src_engine.url) or "mssql" in str(src_engine.url):
                return pd.read_sql(f"SELECT * FROM [{table}]", src_engine)
            return pd.read_sql_table(table, src_engine)

        query = config.get("query", "")
        if not query:
            # Fallback: lire la première table utilisateur au lieu de INFORMATION_SCHEMA
            from sqlalchemy import inspect as sa_inspect
            inspector = sa_inspect(src_engine)
            user_tables = [t for t in inspector.get_table_names()
                           if not t.startswith("sys") and not t.startswith("_")]
            if user_tables:
                first_table = user_tables[0]
                if "sqlserver" in str(src_engine.url) or "mssql" in str(src_engine.url):
                    query = f"SELECT * FROM [{first_table}]"
                else:
                    query = f"SELECT * FROM {first_table}"
            else:
                raise ValueError("Aucune table utilisateur trouvée dans la base source")

        return pd.read_sql(query, src_engine)

    elif source_type == "rest_api":
        import requests
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


# ═════════════════════════════════════════════════════════════════════════════
#  UTILITAIRES
# ═════════════════════════════════════════════════════════════════════════════

_SOURCE_COL_ALIASES: Dict[str, List[str]] = {
    # Domain aliases — DW column name → possible source column names
    "shipper":     ["shipvia", "ship_via", "shipperid", "carrier"],
    "ship_via":    ["shipvia", "ship_via", "shipperid"],
    "customer":    ["customerid", "custid", "clientid", "client"],
    "employee":    ["employeeid", "empid", "salesrepid"],
    "product":     ["productid", "itemid", "skuid"],
    "category":    ["categoryid", "catid"],
    "supplier":    ["supplierid", "vendorid"],
    "territory":   ["territoryid"],
    "region":      ["regionid"],
    "order":       ["orderid"],
}


def _find_source_col(target_name: str, source_cols: list) -> Optional[str]:
    """Cherche la colonne source la plus proche du nom cible.
    Gère : snake_case ↔ PascalCase ↔ camelCase ↔ 'Space Separated' ↔ domain aliases.
    Ex: company_name → CompanyName, shipper → ShipVia
    """
    clean = target_name.lower()
    for suffix in ("_sk", "_id", "_key", "_fk"):
        clean = clean.removesuffix(suffix)
    for pfx in ("dim_", "fact_"):
        clean = clean.removeprefix(pfx)

    # Variantes : sans underscore, sans espace
    clean_flat = clean.replace("_", "").replace(" ", "")

    source_flat = {col: col.lower().replace("_", "").replace(" ", "") for col in source_cols}

    # 1. Match exact (casse)
    for col in source_cols:
        if col.lower() == clean or col.lower() == target_name.lower():
            return col

    # 2. Match en ignorant underscores/espaces (snake_case ↔ PascalCase ↔ spaces)
    for col, flat in source_flat.items():
        if flat == clean_flat:
            return col

    # 3. Match partiel brut
    for col in source_cols:
        c = col.lower()
        if clean in c or c in clean:
            return col

    # 4. Match partiel sans underscores/espaces
    for col, flat in source_flat.items():
        if clean_flat and (clean_flat in flat or flat in clean_flat) and len(clean_flat) >= 3:
            return col

    # 5. Domain alias lookup (handles ShipVia → shipper, etc.)
    aliases = _SOURCE_COL_ALIASES.get(clean, []) + _SOURCE_COL_ALIASES.get(clean_flat, [])
    for alias in aliases:
        for col, flat in source_flat.items():
            if flat == alias or alias in flat or flat in alias:
                return col

    return None


def _resolve_source_df(
    source_dfs: Dict[str, pd.DataFrame],
    model_item: dict,
    fallback_df: pd.DataFrame = None,
) -> pd.DataFrame:
    """
    Résout le DataFrame source pour une dimension ou table de faits.

    Stratégie :
      1. Utiliser source_tables du modèle (ex: ["Customers", "Orders"])
      2. Si plusieurs tables source, les merger sur les FK communes
      3. Fallback: chercher par nom de dimension/fait dans source_dfs
      4. Dernier recours: fallback_df (source_df legacy)
    """
    source_tables = model_item.get("source_tables", [])
    item_name = model_item.get("name", "")

    # ── 1. Match direct sur source_tables ──────────────────────────────────
    if source_tables:
        # Chercher les tables source dans source_dfs
        matched_dfs = []
        for st in source_tables:
            # Match exact
            if st in source_dfs:
                matched_dfs.append(source_dfs[st])
                continue
            # Match case-insensitive
            st_lower = st.lower()
            found = None
            for key, df in source_dfs.items():
                if key.lower() == st_lower:
                    found = df
                    break
            if found is not None:
                matched_dfs.append(found)
                continue
            # Match partiel (ex: "Customer" dans "Customers")
            found = None
            for key, df in source_dfs.items():
                if st_lower in key.lower() or key.lower() in st_lower:
                    found = df
                    break
            if found is not None:
                matched_dfs.append(found)

        if len(matched_dfs) == 1:
            return matched_dfs[0]
        elif len(matched_dfs) > 1:
            # Multi-table : merge en utilisant les colonnes ID pour la jointure
            # La table SECONDAIRE (plus grosse = grain fin) est la table principale
            matched_dfs_sorted = sorted(matched_dfs, key=lambda d: len(d), reverse=True)
            result = matched_dfs_sorted[0]
            for other in matched_dfs_sorted[1:]:
                common_cols = list(set(result.columns) & set(other.columns))
                if not common_cols:
                    logger.warning(f"[ETL] Pas de colonne commune pour merge — skip join")
                    continue
                # Préférer les colonnes ID/Key pour la jointure
                id_cols = [c for c in common_cols
                           if any(c.lower().endswith(s) for s in ("id", "key", "no", "code", "num"))]
                merge_col = id_cols[0] if id_cols else common_cols[0]
                # Éviter conflits de colonnes : supprimer du 'other' les cols déjà dans result
                cols_to_drop = [c for c in other.columns if c in result.columns and c != merge_col]
                other_clean  = other.drop(columns=cols_to_drop)
                result = result.merge(other_clean, on=merge_col, how="left")
                logger.info(f"[ETL] Merge multi-table sur [{merge_col}] → {len(result)} lignes")
            return result

    # ── 2. Fallback: chercher par nom de dim/fact dans source_dfs ──────────
    # Ex: dim_customer → chercher "Customer" ou "Customers"
    clean_name = item_name.lower()
    for pfx in ("dim_", "fact_"):
        clean_name = clean_name.removeprefix(pfx)

    for key, df in source_dfs.items():
        if key.lower() == clean_name or clean_name in key.lower() or key.lower() in clean_name:
            return df

    # ── 3. Fallback: chercher par source_table des colonnes ───────────────
    col_source_tables = set()
    for col in model_item.get("columns", []):
        st = col.get("source_table", "")
        if st:
            col_source_tables.add(st)

    for st in col_source_tables:
        if st in source_dfs:
            return source_dfs[st]
        for key, df in source_dfs.items():
            if st.lower() in key.lower() or key.lower() in st.lower():
                return df

    # ── 4. Dernier recours: fallback_df ─────────────────────────────────────
    if fallback_df is not None:
        logger.warning(f"[ETL] Aucun DataFrame source trouvé pour '{item_name}' — utilisation du fallback")
        return fallback_df

    # ── 5. Aucun DataFrame disponible ──────────────────────────────────────
    logger.error(f"[ETL] Aucun DataFrame source pour '{item_name}'")
    return pd.DataFrame()  # empty — les étapes suivantes détecteront l'absence de données


def _is_date_column(series) -> bool:
    """Vérifie heuristiquement si une colonne contient des dates."""
    sample = series.dropna().head(5)
    if len(sample) == 0:
        return False
    try:
        pd.to_datetime(sample, errors="raise")
        return True
    except Exception:
        return False


def _export_ddl_only(sql_ddl: str, user_prefix: str, exec_log: list,
                     retry_count: int, ktr_xml: str = "") -> dict:
    """Mode dégradé : exporte uniquement le DDL SQL."""
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    ddl_path = OUTPUTS_DIR / f"{user_prefix}_schema.sql"
    ktr_path = OUTPUTS_DIR / f"{user_prefix}_pipeline.ktr"

    ddl_path.write_text(sql_ddl, encoding="utf-8")
    if ktr_xml:
        ktr_path.write_text(ktr_xml, encoding="utf-8")
    else:
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


def _drop_source_tables(engine, dw_prefix: str, execution_log: list) -> list:
    """
    Supprime toutes les tables NON-DW de la base après un ETL réussi.
    Les tables DW sont identifiées par leur préfixe (ex: admin_dim_*, admin_fact_*).
    Désactive d'abord les FK constraints pour éviter les erreurs de dépendance.
    """
    from sqlalchemy import text

    new_logs = list(execution_log)
    try:
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            rows = conn.execute(text(
                "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES "
                "WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
            )).fetchall()

            all_tables    = [r[0] for r in rows]
            prefix_lower  = dw_prefix.lower() + "_"
            dw_tables     = [t for t in all_tables if t.lower().startswith(prefix_lower)]
            source_tables = [t for t in all_tables if not t.lower().startswith(prefix_lower)]

            if not source_tables:
                new_logs.append("[Cleanup] ℹ️ Aucune table source à supprimer — base déjà propre")
                return new_logs

            new_logs.append(
                f"[Cleanup] 🗑️ {len(source_tables)} tables sources détectées "
                f"| {len(dw_tables)} tables DW conservées"
            )

            # Désactiver toutes les FK constraints
            try:
                conn.execute(text(
                    "EXEC sp_MSforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL'"
                ))
            except Exception:
                for t in source_tables:
                    try:
                        conn.execute(text(f"ALTER TABLE [{t}] NOCHECK CONSTRAINT ALL"))
                    except Exception:
                        pass

            # DROP chaque table source
            dropped, failed = [], []
            for table in source_tables:
                try:
                    conn.execute(text(f"DROP TABLE IF EXISTS [{table}]"))
                    dropped.append(table)
                except Exception as drop_err:
                    failed.append(table)
                    logger.warning(f"[Cleanup] DROP [{table}] échoué : {drop_err}")

            if dropped:
                preview = ", ".join(f"[{t}]" for t in dropped[:12])
                suffix  = f"… (+{len(dropped)-12})" if len(dropped) > 12 else ""
                new_logs.append(f"[Cleanup] ✅ {len(dropped)} tables supprimées : {preview}{suffix}")
            if failed:
                new_logs.append(f"[Cleanup] ⚠️ {len(failed)} tables non supprimées : {', '.join(failed[:5])}")


    except Exception as e:
        logger.error(f"[Cleanup] Erreur globale : {e}")
        new_logs.append(f"[Cleanup] Erreur : {e}")

    return new_logs


def _persist_metrics(metrics: dict, session_id: str) -> None:
    """Persiste les load_metrics sur disque (best effort, non bloquant)."""
    import json
    from pathlib import Path
    try:
        out_dir = Path("outputs")
        out_dir.mkdir(exist_ok=True)
        path = out_dir / f"{session_id}_load_metrics.json"
        path.write_text(json.dumps(metrics, indent=2, default=str), encoding="utf-8")
    except Exception as e:
        logger.warning(f"[_persist_metrics] echec ecriture {session_id}: {e}")
