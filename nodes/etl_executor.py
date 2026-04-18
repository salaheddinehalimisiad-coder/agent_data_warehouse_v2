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

    # ── Étape 4 : Charger les tables de faits (Constellation support) ────────
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
                sk_maps, user_prefix, session_id, clean_action
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
        "source_rows":   len(source_df),
        "dimensions":    dim_metrics,
        "fact":          all_fact_metrics.get(first_fact_name, {}),  # backward compat
        "facts":         all_fact_metrics,                           # multi-fact
        "loaded_at":     datetime.now(timezone.utc).isoformat(),
        "dw_prefix":     user_prefix,
    }
    _persist_metrics(load_metrics, session_id)

    total_inserted = sum(m.get("inserted", 0) for m in all_fact_metrics.values())
    total_rejected = sum(m.get("rejected", 0) for m in all_fact_metrics.values())
    exec_log = exec_log + [
        f"[ETL] 🏁 Chargement terminé — {len(fact_tables)} fact(s), "
        f"{total_inserted} insérés / {total_rejected} rejetés"
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
    Charge une table de dimension avec support SCD Type 2 :
    - Identifie la colonne source correspondante
    - Déduplique les valeurs
    - SCD Type 2 : historise les changements d'attributs (valid_from/valid_to/is_current)
    - Retourne le sk_map {valeur_naturelle: sk_current}
    """
    from sqlalchemy import text, inspect
    import pandas as pd

    dim_name   = dim_model.get("name", "")
    columns    = dim_model.get("columns", [])
    scd_type   = dim_model.get("scd_type", 1)

    # Colonnes attributs (pas pk, pas fk, pas SCD metadata)
    scd_meta_cols = {"valid_from", "valid_to", "is_current"}
    attr_cols = [c for c in columns
                 if c.get("role") == "attribute" and c.get("name") not in scd_meta_cols]
    pk_col    = next((c for c in columns if c.get("role") == "pk"), None)

    # Detect if this dimension has SCD2 columns in its schema
    has_scd2_cols = any(c.get("name") in scd_meta_cols for c in columns)
    is_scd2 = (scd_type == 2 or has_scd2_cols) and "dim_date" not in dim_name

    if not attr_cols or not pk_col:
        return {"sk_map": {}, "metrics": {"inserted": 0, "existing": 0, "updated": 0}}

    pk_name = pk_col["name"]

    # Identify the natural key column (the business key for SCD matching)
    natural_key_col = next(
        (c["name"] for c in attr_cols if c.get("natural_key")),
        attr_cols[0]["name"]
    )

    # Build list of attribute column names (for change detection)
    compare_attr_names = [c["name"] for c in attr_cols if c["name"] != natural_key_col]

    # Trouver la colonne source correspondante à la natural key
    src_col_name = _find_source_col(natural_key_col, source_df.columns.tolist())

    # Build source mapping for ALL dimension attributes
    src_attr_mapping = {}  # {dim_col_name: source_col_name}
    for ac in attr_cols:
        sc = _find_source_col(ac["name"], source_df.columns.tolist())
        if sc:
            src_attr_mapping[ac["name"]] = sc

    sk_map = {}
    inserted = 0
    existing = 0
    updated  = 0  # SCD2: new version created for changed attributes

    if src_col_name:
        # Collect unique rows keyed by natural key (keep last occurrence)
        unique_vals = source_df[src_col_name].dropna().unique().tolist()

        with engine.begin() as conn:
            for val in unique_vals:
                clean_val = str(val).strip()
                if not clean_val:
                    continue

                try:
                    if is_scd2:
                        # ═══ SCD TYPE 2 LOGIC ═══════════════════════════════════
                        # 1. Check for existing CURRENT record
                        row = conn.execute(
                            text(f"SELECT TOP 1 [{pk_name}], "
                                 + ", ".join(f"[{a}]" for a in compare_attr_names)
                                 + f" FROM [{table_name}] WHERE [{natural_key_col}] = :v AND [is_current] = 1"),
                            {"v": clean_val}
                        ).fetchone()

                        if row:
                            # 2. Compare attributes to detect change
                            old_sk = row[0]
                            old_attrs = {compare_attr_names[i]: row[i + 1] for i in range(len(compare_attr_names))}

                            # Get new attribute values from source
                            src_row = source_df[source_df[src_col_name].astype(str).str.strip() == clean_val].iloc[-1] if len(source_df[source_df[src_col_name].astype(str).str.strip() == clean_val]) > 0 else None
                            new_attrs = {}
                            for dim_col in compare_attr_names:
                                sc = src_attr_mapping.get(dim_col)
                                if sc and src_row is not None:
                                    new_attrs[dim_col] = str(src_row.get(sc, "")).strip()
                                else:
                                    new_attrs[dim_col] = str(old_attrs.get(dim_col, ""))

                            # Detect if any attribute changed
                            changed = any(
                                str(old_attrs.get(k, "")).strip() != str(new_attrs.get(k, "")).strip()
                                for k in compare_attr_names
                                if new_attrs.get(k) and old_attrs.get(k) is not None
                            )

                            if changed:
                                # 3a. CLOSE the old record
                                conn.execute(
                                    text(f"UPDATE [{table_name}] SET [is_current] = 0, "
                                         f"[valid_to] = GETDATE() "
                                         f"WHERE [{pk_name}] = :sk"),
                                    {"sk": old_sk}
                                )

                                # 3b. INSERT new current version
                                all_insert_cols = {natural_key_col: clean_val}
                                for dim_col in compare_attr_names:
                                    all_insert_cols[dim_col] = new_attrs.get(dim_col, "")
                                all_insert_cols["valid_from"] = "GETDATE()"
                                all_insert_cols["is_current"] = 1

                                non_func_cols = {k: v for k, v in all_insert_cols.items()
                                                 if k != "valid_from"}
                                cols_str = ", ".join(f"[{k}]" for k in non_func_cols) + ", [valid_from], [valid_to]"
                                vals_str = ", ".join(f":{k}" for k in non_func_cols) + ", GETDATE(), '9999-12-31'"

                                conn.execute(text(
                                    f"INSERT INTO [{table_name}] ({cols_str}) VALUES ({vals_str})"
                                ), non_func_cols)

                                # Re-read the new SK
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
                                # No change — reuse existing SK
                                sk_map[clean_val] = old_sk
                                existing += 1
                        else:
                            # 4. NEW record — INSERT with SCD2 metadata
                            insert_vals = {natural_key_col: clean_val}
                            for dim_col in compare_attr_names:
                                sc = src_attr_mapping.get(dim_col)
                                if sc:
                                    src_rows = source_df[source_df[src_col_name].astype(str).str.strip() == clean_val]
                                    if len(src_rows) > 0:
                                        insert_vals[dim_col] = str(src_rows.iloc[-1].get(sc, "")).strip()

                            insert_vals["is_current"] = 1
                            non_func_cols = {k: v for k, v in insert_vals.items()}
                            cols_str = ", ".join(f"[{k}]" for k in non_func_cols) + ", [valid_from], [valid_to]"
                            vals_str = ", ".join(f":{k}" for k in non_func_cols) + ", GETDATE(), '9999-12-31'"

                            conn.execute(text(
                                f"INSERT INTO [{table_name}] ({cols_str}) VALUES ({vals_str})"
                            ), non_func_cols)

                            # Re-read SK
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
                        # ═══ SCD TYPE 1 (original simple MERGE) ═════════════════
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

    # dim_date : chargement automatique des dates depuis source
    if "dim_date" in dim_name:
        sk_map.update(_load_dim_date_from_source(engine, table_name, source_df))
        inserted = len(sk_map)

    return {"sk_map": sk_map, "metrics": {"inserted": inserted, "existing": existing, "updated": updated}}


def _load_dim_date_from_source(engine, table_name: str, source_df) -> dict:
    """Charge dim_date depuis les colonnes dates détectées dans la source (T-SQL / SQL Server)."""
    import pandas as pd
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

    sk_map = {}
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

                    # Lire le SK s'il existe déjà
                    row = conn.execute(
                        text(f"SELECT TOP 1 [date_sk] FROM [{table_name}] WHERE [date_full] = :d"),
                        {"d": d}
                    ).fetchone()

                    if row:
                        sk_map[key] = row[0]
                    else:
                        dt = datetime.date.fromisoformat(key)
                        # T-SQL MERGE pour éviter les doublons (remplace INSERT IGNORE MySQL)
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

                        # Relire le SK nouvellement créé
                        row2 = conn.execute(
                            text(f"SELECT TOP 1 [date_sk] FROM [{table_name}] WHERE [date_full] = :d"),
                            {"d": d}
                        ).fetchone()
                        if row2:
                            sk_map[key] = row2[0]
        except Exception as e:
            logger.debug(f"[ETL] dim_date load : {e}")

    return sk_map


def _load_fact(engine, table_name: str, fact_model: dict, source_df,
               sk_maps: dict, prefix: str, session_id: str = "unknown", 
               clean_action: str = "NONE") -> dict:
    """
    Charge la table de faits :
    - Résolution des SKs via sk_maps
    - Mapping des métriques numériques
    - Compte les insertions et rejets
    - Redirige les rejets vers la table de quarantaine
    - Diffuse la progression via SSE
    - Supporte IGNORE_REJECTS
    """
    from sqlalchemy import text
    import pandas as pd
    from api.services.sse import broadcast

    use_ignore  = clean_action in ("IGNORE_REJECTS", "DEDUPLICATE")

    # Quarantine table name (auto-generated by DDL)
    fact_name = fact_model.get("name", "")
    reject_table = f"{prefix}_rejets_{fact_name}" if fact_name else ""

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
            ins, rej = _batch_insert(engine, table_name, rows_batch, use_ignore, reject_table)
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
        ins, rej = _batch_insert(engine, table_name, rows_batch, use_ignore, reject_table)
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


def _batch_insert(engine, table_name: str, rows: list, use_ignore: bool = False,
                   reject_table: str = "") -> Tuple[int, int]:
    """Insère un batch de lignes. Les rejets sont redirigés vers la table de quarantaine.
    Retourne (inserted, rejected)."""
    from sqlalchemy import text
    import json as _json
    if not rows:
        return 0, 0

    cols    = list(rows[0].keys())
    cols_str = ", ".join(f"[{c}]" for c in cols)
    vals_str = ", ".join(f":{c}" for c in cols)

    inserted = 0
    rejected = 0
    try:
        with engine.begin() as conn:
            for row in rows:
                try:
                    if use_ignore:
                        # Simulation de INSERT IGNORE en T-SQL avec MERGE
                        merge_stmt = f"""
                        MERGE [{table_name}] AS Target
                        USING (SELECT {vals_str}) AS Source ({cols_str})
                        ON 1=0 -- Condition factice, remplacez par PK pour Upsert réel
                        WHEN NOT MATCHED THEN
                            INSERT ({cols_str}) VALUES ({vals_str});
                        """
                        conn.execute(text(merge_stmt), row)
                    else:
                        conn.execute(
                            text(f"INSERT INTO [{table_name}] ({cols_str}) VALUES ({vals_str})"),
                            row
                        )
                    inserted += 1
                except Exception as row_err:
                    rejected += 1
                    # ═══ QUARANTINE: redirect rejected row ═══════════════════
                    if reject_table:
                        try:
                            row_json = _json.dumps(
                                {k: str(v) for k, v in row.items()},
                                default=str, ensure_ascii=False
                            )
                            conn.execute(
                                text(f"INSERT INTO [{reject_table}] "
                                     f"([error_reason], [source_row_json]) "
                                     f"VALUES (:err, :rj)"),
                                {"err": str(row_err)[:500], "rj": row_json}
                            )
                        except Exception as q_err:
                            logger.debug(f"[ETL] Quarantine insert failed: {q_err}")
    except Exception as e:
        error_msg = str(e)
        logger.warning(f"[ETL] Batch insert {table_name} : {error_msg}")
        rejected += len(rows)

    return inserted, rejected


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _build_engine(config: dict):
    """Construit un engine SQLAlchemy selon le type de base."""
    from sqlalchemy import create_engine
    db_type  = config.get("type", "sqlserver").lower().replace("postgres", "postgresql")
    host     = config.get("host", "localhost")
    port     = config.get("port", 3306)
    database = config.get("database", "data_warehouse")
    user     = config.get("user", "root")
    password = config.get("password", "")

    driver_map = {
        "mysql": "mysqlconnector",
        "postgresql": "psycopg2",
        "sqlite": "pysqlite",
        "sqlserver": "pyodbc",
        "mssql": "pyodbc",
    }
    driver = driver_map.get(db_type, "pyodbc")

    if db_type == "sqlite":
        return create_engine(f"sqlite:///{database}")
        
    if driver == "pyodbc":
        from urllib.parse import quote_plus
        encoded_pwd = quote_plus(str(password))
        # Injection Chaîne de connexion SQL Server
        return create_engine(
            f"mssql+pyodbc://{user}:{encoded_pwd}@{host}:{port}/{database}?driver=ODBC+Driver+17+for+SQL+Server",
            pool_pre_ping=True, pool_recycle=3600, fast_executemany=True
        )
        
    return create_engine(
        f"{db_type}+{driver}://{user}:{password}@{host}:{port}/{database}",
        pool_pre_ping=True, pool_recycle=3600,
    )


def _test_connection(engine) -> None:
    from sqlalchemy import text
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))


def _execute_ddl(engine, sql_ddl: str) -> str:
    """Exécute le DDL T-SQL (SQL Server). Retourne '' si OK, message d'erreur sinon."""
    from sqlalchemy import text
    import re
    try:
        # Nettoyage : suppression des commentaires mono-ligne et multi-lignes
        sql_clean = re.sub(r'--.*$', '', sql_ddl, flags=re.MULTILINE)
        sql_clean = re.sub(r'/\*.*?\*/', '', sql_clean, flags=re.DOTALL)

        # Split sur les points-virgules
        statements = [s.strip() for s in sql_clean.split(";") if s.strip()]

        with engine.begin() as conn:
            for stmt in statements:
                if len(stmt) < 5:
                    continue
                try:
                    conn.execute(text(stmt))
                except Exception as stmt_err:
                    logger.error(f"[ExecuteDDL] Erreur statement: {stmt[:100]}... -> {stmt_err}")
                    return f"Erreur SQL: {str(stmt_err)} (Statement: {stmt[:50]}...)"
        return ""
    except Exception as e:
        logger.error(f"[ExecuteDDL] Erreur globale: {e}")
        return f"DDL Critical Error: {str(e)}"


def _read_source(config: dict, dw_config: dict = None):
    """Lit les données source et retourne un DataFrame pandas."""
    import pandas as pd
    from pathlib import Path
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
        # Handle 'bak' source type
        if source_type == "bak":
            if not dw_config:
                raise ValueError("DW config missing for 'bak' source type")
            # Use credentials from DW but point to restored source DB
            source_cfg = dw_config.copy()
            source_cfg["database"] = config.get("restored_db", dw_config.get("database"))
            source_cfg["type"] = "sqlserver"
            src_engine = _build_engine(source_cfg)
        else:
            src_engine = _build_engine(config)

        table = config.get("table", "")
        if table:
            # SQL Server specific escaping
            if "sqlserver" in str(src_engine.url) or "mssql" in str(src_engine.url):
                return pd.read_sql(f"SELECT * FROM [{table}]", src_engine)
            return pd.read_sql_table(table, src_engine)
        
        # Default query refinement
        query = config.get("query", "")
        if not query:
            if "sqlserver" in str(src_engine.url) or "mssql" in str(src_engine.url):
                query = "SELECT TOP 100 * FROM INFORMATION_SCHEMA.TABLES"
            else:
                query = "SELECT * FROM information_schema.tables LIMIT 100"
        
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


def _export_ddl_only(sql_ddl: str, user_prefix: str, exec_log: list, retry_count: int, ktr_xml: str = "") -> dict:
    """Mode dégradé : exporte uniquement le DDL SQL."""
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    ddl_path = OUTPUTS_DIR / f"{user_prefix}_schema.sql"
    ktr_path = OUTPUTS_DIR / f"{user_prefix}_pipeline.ktr"

    ddl_path.write_text(sql_ddl, encoding="utf-8")
    # Conserver le KTR généré précédemment s'il existe
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
