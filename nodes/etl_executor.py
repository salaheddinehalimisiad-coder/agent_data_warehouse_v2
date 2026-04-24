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

    # Colonnes attributs (pas pk, pas fk, pas SCD metadata)
    scd_meta_cols = {"valid_from", "valid_to", "is_current"}
    attr_cols = [c for c in columns
                 if c.get("role") == "attribute" and c.get("name") not in scd_meta_cols]
    pk_col = next((c for c in columns if c.get("role") == "pk"), None)

    has_scd2_cols = any(c.get("name") in scd_meta_cols for c in columns)
    is_scd2 = (scd_type == 2 or has_scd2_cols) and "dim_date" not in dim_name

    if not attr_cols or not pk_col:
        return {"sk_map": {}, "metrics": {"inserted": 0, "existing": 0, "updated": 0}}

    pk_name = pk_col["name"]

    natural_key_col = next(
        (c["name"] for c in attr_cols if c.get("natural_key")),
        attr_cols[0]["name"]
    )
    compare_attr_names = [c["name"] for c in attr_cols if c["name"] != natural_key_col]

    src_col_name = _find_source_col(natural_key_col, resolved_df.columns.tolist())

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
                                    new_attrs[dim_col] = str(src_row.get(sc, "")).strip()
                                else:
                                    new_attrs[dim_col] = str(old_attrs.get(dim_col, ""))

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
                                        insert_vals[dim_col] = str(src_rows.iloc[-1].get(sc, "")).strip()

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
                            insert_vals = {a["name"]: clean_val for a in attr_cols[:1]}
                            cols_str  = ", ".join(f"[{k}]" for k in insert_vals)
                            vals_str  = ", ".join(f":{k}" for k in insert_vals)
                            merge_sql = f"""
                            MERGE [{table_name}] AS Target
                            USING (SELECT :v AS [{check_col}]) AS Source
                            ON Target.[{check_col}] = Source.[{check_col}]
                            WHEN NOT MATCHED THEN
                                INSERT ({cols_str}) VALUES ({vals_str});
                            """
                            insert_vals["v"] = clean_val
                            conn.execute(text(merge_sql), insert_vals)

                            row2 = conn.execute(
                                text(f"SELECT TOP 1 [{pk_name}] FROM [{table_name}] WHERE [{check_col}] = :v"),
                                {"v": clean_val}
                            ).fetchone()
                            if row2:
                                sk_map[clean_val] = row2[0]
                                inserted += 1

                except Exception as e:
                    logger.debug(f"[ETL] Dim {table_name} val '{clean_val}' : {e}")

    # dim_date : chargement automatique depuis la source
    if "dim_date" in dim_name:
        sk_map.update(_load_dim_date_from_source(engine, table_name, resolved_df))
        inserted = len(sk_map)

    return {"sk_map": sk_map, "metrics": {"inserted": inserted, "existing": existing, "updated": updated}}


def _load_dim_date_from_source(engine, table_name: str, source_df) -> dict:
    """Charge dim_date depuis les colonnes dates détectées (T-SQL MERGE)."""
    import datetime
    from sqlalchemy import text

    date_cols = [
        c for c in source_df.columns
        if "date" in c.lower() or (
            source_df[c].dtype in ("datetime64[ns]", "object")
            and _is_date_column(source_df[c])
        )
    ]

    if not date_cols:
        return {}

    sk_map: Dict[str, int] = {}
    dates_seen: set = set()

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
                        text(f"SELECT TOP 1 [date_sk] FROM [{table_name}] WHERE [date_full] = :d"),
                        {"d": d}
                    ).fetchone()

                    if row:
                        sk_map[key] = row[0]
                    else:
                        dt = datetime.date.fromisoformat(key)
                        conn.execute(text(f"""
                            MERGE [{table_name}] AS Target
                            USING (SELECT :df AS date_full) AS Source
                            ON Target.[date_full] = Source.[date_full]
                            WHEN NOT MATCHED THEN
                                INSERT ([date_full],[annee],[trimestre],[mois],[semaine],[jour],[jour_semaine])
                                VALUES (:df, :y, :q, :m, :w, :d2, :wd);
                        """), {
                            "df": d, "y": dt.year, "q": (dt.month - 1) // 3 + 1,
                            "m": dt.month, "w": dt.isocalendar()[1],
                            "d2": dt.day, "wd": dt.strftime("%A"),
                        })

                        row2 = conn.execute(
                            text(f"SELECT TOP 1 [date_sk] FROM [{table_name}] WHERE [date_full] = :d"),
                            {"d": d}
                        ).fetchone()
                        if row2:
                            sk_map[key] = row2[0]
        except Exception as e:
            logger.debug(f"[ETL] dim_date load : {e}")

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
    met_cols = [c for c in columns if c.get("role") == "metric"]

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
            if nat_key_col and dim_sks:
                nat_val = str(src_row.get(nat_key_col, "")).strip()
                sk_val  = dim_sks.get(nat_val)
                if sk_val:
                    row_dict[fk_name] = sk_val
                else:
                    if "date" in ref_dim:
                        try:
                            d = str(pd.to_datetime(src_row.get(nat_key_col)).date())
                            row_dict[fk_name] = dim_sks.get(d, 1)
                        except Exception:
                            row_dict[fk_name] = 1
                    else:
                        row_dict[fk_name] = 1

        # ─── Mapping métriques ───────────────────────────────────────────────
        for met in met_cols:
            met_name = met["name"]
            src_col  = _find_source_col(met_name, src_cols_list)
            if src_col:
                val = src_row.get(src_col, 0)
                try:
                    if "decimal" in met.get("type", "").lower():
                        row_dict[met_name] = float(val)
                    else:
                        row_dict[met_name] = int(float(val))
                except (ValueError, TypeError):
                    row_dict[met_name] = 0

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
        "inserted":    inserted,
        "rejected":    rejected,
        "source_rows": len(resolved_df),
        "duration_s":  round(elapsed_total, 2),
        "rate_rows_s": round(inserted / elapsed_total, 1),
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
    host = (host or "").strip()
    port = str(port or "").strip()

    if not host:
        return "127.0.0.1,1433"
    if "," in host:
        return host
    if "\\" in host:
        logger.info(
            f"[_build_engine] Instance nommée détectée ({host}) — "
            "SQL Browser requis, port ignoré pour éviter le conflit TDS."
        )
        return host
    return f"{host},{port or '1433'}"


def _build_engine(config: dict):
    """Construit un engine SQLAlchemy — v4.2 TDS-safe (creator pyodbc direct)."""
    from sqlalchemy import create_engine
    from urllib.parse import quote_plus

    db_type  = config.get("type", "sqlserver").lower().replace("postgres", "postgresql")
    host     = config.get("host", "localhost")
    port     = config.get("port", 1433 if db_type in ("sqlserver", "mssql") else 3306)
    database = config.get("database", "data_warehouse")
    user     = config.get("user", "sa")
    password = config.get("password", "")

    if db_type == "sqlite":
        return create_engine(f"sqlite:///{database}")

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
            pool_pre_ping=True,
            pool_recycle=1800,
            fast_executemany=True,
            future=True,
        )

    # Autres dialectes (MySQL, Postgres)
    driver_map = {"mysql": "mysqlconnector", "postgresql": "psycopg2"}
    driver = driver_map.get(db_type, "pyodbc")
    pwd_enc = quote_plus(password or "")
    return create_engine(
        f"{db_type}+{driver}://{user}:{pwd_enc}@{host}:{port}/{database}",
        pool_pre_ping=True, pool_recycle=3600,
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


def _split_tsql_batches(sql_ddl: str) -> list:
    """
    Découpe un script T-SQL comme sqlcmd :
      1) retire commentaires -- et /* */
      2) split sur 'GO' en tant que ligne entière
      3) split chaque batch sur ';'
    """
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


def _execute_ddl(engine, sql_ddl: str) -> str:
    """
    Exécute le DDL en AUTOCOMMIT (indispensable pour CREATE DATABASE,
    ALTER DATABASE SET, FULLTEXT, SNAPSHOT_ISOLATION, etc.).
    Retourne '' si OK, message d'erreur sinon.
    """
    from sqlalchemy import text

    statements = _split_tsql_batches(sql_ddl)
    if not statements:
        return "DDL vide après nettoyage."

    try:
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            for stmt in statements:
                try:
                    conn.execute(text(stmt))
                except Exception as stmt_err:
                    msg = str(stmt_err)
                    if "already" in msg.lower() and "exist" in msg.lower():
                        logger.info(
                            f"[ExecuteDDL] ⊙ objet déjà existant (skipped) : {stmt[:60]}"
                        )
                        continue
                    logger.error(
                        f"[ExecuteDDL] ❌ Statement: {stmt[:100]}... → {msg}"
                    )
                    return f"Erreur SQL: {msg} (Statement: {stmt[:80]}...)"
        return ""
    except Exception as e:
        logger.error(f"[ExecuteDDL] ❌ Global: {e}")
        return f"Erreur globale DDL: {e}"


def _verify_tables_created(engine, user_prefix: str) -> Tuple[int, List[str]]:
    """
    Vérifie activement que les tables 'user_prefix_%' existent bien dans la DB
    cible après l'exécution du DDL. Retourne (nb_tables, noms_complets).
    Utilisé par etl_initializer_node pour éviter les 'success' fantômes.
    """
    from sqlalchemy import text
    sql = text("""
        SELECT TABLE_SCHEMA + '.' + TABLE_NAME AS full_name
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
          AND TABLE_NAME LIKE :p
        ORDER BY TABLE_NAME
    """)
    try:
        with engine.connect() as conn:
            rows = conn.execute(sql, {"p": f"{user_prefix}\\_%" if "\\" not in user_prefix else f"{user_prefix}%"}).fetchall()
        names = [r[0] for r in rows]
        return len(names), names
    except Exception as e:
        logger.warning(f"[_verify_tables_created] {e}")
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
            source_cfg["database"] = config.get("restored_db", dw_config.get("database"))
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

def _find_source_col(target_name: str, source_cols: list) -> Optional[str]:
    """Cherche la colonne source la plus proche du nom cible."""
    clean = target_name.lower()
    for suffix in ("_sk", "_id", "_key", "_fk"):
        clean = clean.removesuffix(suffix)
    for pfx in ("dim_", "fact_"):
        clean = clean.removeprefix(pfx)

    for col in source_cols:
        if col.lower() == clean or col.lower() == target_name.lower():
            return col
    for col in source_cols:
        if clean in col.lower() or col.lower() in clean:
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
            # Multi-table: merge sur les colonnes communes
            # La première table est la table principale
            result = matched_dfs[0]
            for other in matched_dfs[1:]:
                common_cols = list(set(result.columns) & set(other.columns))
                if common_cols:
                    # Merge sur la première colonne commune (souvent un ID)
                    merge_col = common_cols[0]
                    # Éviter les conflits de colonnes
                    suffixes = ("", "_right")
                    result = result.merge(other, on=merge_col, how="left", suffixes=suffixes)
                else:
                    # Pas de colonne commune — cross join limité (dangereux)
                    logger.warning(
                        f"[ETL] Pas de colonne commune pour merge de "
                        f"{len(result)} × {len(other)} lignes — utilisation de la première table uniquement"
                    )
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


def _persist_metrics(metrics: dict, session_id: str) -> None:
    """Persiste les métriques de chargement dans un historique JSON."""
    metrics_file = OUTPUTS_DIR / "load_metrics_history.json"
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

    history: List[dict] = []
    if metrics_file.exists():
        try:
            history = json.loads(metrics_file.read_text())
        except Exception:
            history = []

    history.append({"session_id": session_id, **metrics})
    history = history[-100:]

    metrics_file.write_text(json.dumps(history, indent=2, default=str))
