# nodes/etl_loader.py — Step 3: Load (v4.2 — Vibrant logs + Multi-Fact / Constellation)
"""
Step 3 : LOAD (Constellation Support)
  - Boucle sur tous les fact_tables (multi-fact)
  - Résolution des SKs pour chaque fact table
  - Chargement via _load_fact (itertuples + executemany + broadcast throttlé)
  - Logs "vibrants" : emojis, barres de progression, taux %, débit rows/s
  - Agrégation des métriques cross-fact
"""
import json
import time
import logging
from datetime import datetime, timezone
from pathlib import Path

from app_state import AgentState
from nodes.etl_executor import _load_fact, _build_engine, _persist_metrics, df_cache_load, _drop_source_tables

_OUTPUTS_DIR = Path(__file__).parent.parent / "outputs"


def _save_session_to_disk(session_id: str, logical_model: dict, user_prefix: str, dw_config: dict) -> None:
    """Persiste le modèle et la config DW sur disque pour survie aux redémarrages."""
    try:
        _OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
        f = _OUTPUTS_DIR / f"{session_id}_model.json"
        f.write_text(json.dumps({
            "session_id":          session_id,
            "logical_model":       logical_model,
            "user_prefix":         user_prefix,
            "dw_connection_config": dw_config,
            "saved_at":            datetime.now(timezone.utc).isoformat(),
        }, default=str), encoding="utf-8")
    except Exception as e:
        logging.getLogger(__name__).warning(f"[Load] Persistance modèle échouée: {e}")

logger = logging.getLogger(__name__)


def _yield_emoji(inserted: int, rejected: int) -> str:
    """Sélectionne un emoji de statut selon le taux de rejet."""
    total = inserted + rejected
    if total == 0:
        return "⚪"
    rate = rejected / total
    if rate == 0.0:
        return "🏆"
    if rate < 0.01:
        return "🟢"
    if rate < 0.05:
        return "🟡"
    if rate < 0.20:
        return "🟠"
    return "🔴"


def _format_duration(seconds: float) -> str:
    """Formate une durée en 1m23s / 45.2s."""
    if seconds < 60:
        return f"{seconds:.1f}s"
    m, s = divmod(seconds, 60)
    return f"{int(m)}m{int(s):02d}s"


def etl_loader_node(state: AgentState) -> dict:
    """
    LOAD STEP (v4.2 — Vibrant Logs) :
      - Loops over all fact_tables (multi-fact constellation)
      - Resolves SKs for each fact table
      - Loads data into each final fact table
      - Aggregates and persists load metrics across all facts
      - Émet des logs expressifs pour le widget Premium Dark
    """
    logger.info("--- [ETL] STEP 3: LOAD (v4.2) ---")
    logical_model = state.get("logical_model", {})
    dw_config     = state.get("dw_connection_config", {})
    session_id    = state.get("session_id", "default")
    sk_maps       = state.get("sk_maps", {})
    user_prefix   = state.get("user_prefix", "dw")

    # Load DataFrames from module-level cache (bypasses LangGraph serialization)
    source_dfs = df_cache_load(session_id)
    source_df  = state.get("source_df") or (next(iter(source_dfs.values())) if source_dfs else None)
    new_logs      = []
    clean_action  = state.get("clean_action", "NONE")
    dim_metrics   = state.get("dim_metrics", {})  # populated by etl_transformer

    if (source_df is None and not source_dfs) or (not sk_maps and logical_model.get("dimension_tables")):
        return {
            "etl_status": "failed",
            "etl_error":  "Missing data or SK maps",
            "execution_log": ["[Load] ❌ Missing inputs (source_df / sk_maps)"],
        }

    # ── Fact tables list : constellation ou single fact (compat) ─────────────
    fact_tables = logical_model.get("fact_tables", [])
    if not fact_tables:
        ft = logical_model.get("fact_table", {})
        fact_tables = [ft] if ft else []

    if not fact_tables:
        return {
            "etl_status": "success",
            "execution_log": ["[Load] ℹ️ Aucune fact table définie — skip load"],
        }

    # ── Header vibrant ───────────────────────────────────────────────────────
    # source_dfs in state is empty (DFs cached in memory to bypass LangGraph serialization)
    # Read true row count from the module-level DF cache
    _cached_dfs = df_cache_load(session_id)
    if _cached_dfs:
        source_rows = sum(len(df) for df in _cached_dfs.values())
    elif source_df is not None:
        source_rows = len(source_df)
    else:
        source_rows = sum(len(df) for df in source_dfs.values())
    new_logs.append(
        f"[Load] 🚀 Démarrage — {len(fact_tables)} fact(s) × {source_rows:,} rows source "
        f"• Préfixe DW: [{user_prefix}] • Action: {clean_action}"
    )

    load_start = time.monotonic()

    try:
        dw_engine = _build_engine(dw_config)

        all_fact_metrics: dict = {}
        total_inserted = 0
        total_rejected = 0

        for i, fact in enumerate(fact_tables, 1):
            fact_name = fact.get("name", "")
            if not fact_name:
                continue
            table_name = f"{user_prefix}_{fact_name}"

            new_logs.append(
                f"[Load] ⏳ ({i}/{len(fact_tables)}) Chargement → «{fact_name}» "
                f"vers [{table_name}]…"
            )

            fact_start = time.monotonic()
            metrics = _load_fact(
                dw_engine, table_name, fact, source_df,
                sk_maps, user_prefix, session_id, clean_action,
                source_dfs=source_dfs or None,
            )
            fact_elapsed = time.monotonic() - fact_start

            ins = metrics.get("inserted", 0)
            rej = metrics.get("rejected", 0)
            rate_ok = 100 * ins / max(1, ins + rej)
            rows_s  = metrics.get("rate_rows_s", round(ins / max(0.1, fact_elapsed), 1))
            emoji   = _yield_emoji(ins, rej)

            all_fact_metrics[fact_name] = metrics
            total_inserted += ins
            total_rejected += rej

            # Ligne de progression par fact, riche et lisible
            new_logs.append(
                f"[Load] {emoji} «{fact_name}» → "
                f"✅ {ins:,} inserted  "
                f"⚠️ {rej:,} rejected  "
                f"📊 yield {rate_ok:.1f}%  "
                f"⚡ {rows_s:,.0f} rows/s  "
                f"🕒 {_format_duration(fact_elapsed)}"
            )

        # ── Métriques consolidées ────────────────────────────────────────────
        load_metrics = {
            "source_rows": source_rows,
            "fact":        all_fact_metrics.get(fact_tables[0].get("name", ""), {}),
            "facts":       all_fact_metrics,
            "dimensions":  dim_metrics,
            "loaded_at":   datetime.now(timezone.utc).isoformat(),
            "dw_prefix":   user_prefix,
        }
        _persist_metrics(load_metrics, session_id)

        total_elapsed  = time.monotonic() - load_start
        overall_emoji  = _yield_emoji(total_inserted, total_rejected)
        overall_yield  = 100 * total_inserted / max(1, total_inserted + total_rejected)
        overall_rate   = total_inserted / max(0.1, total_elapsed)

        # ── Bannière de clôture ──────────────────────────────────────────────
        new_logs.append("[Load] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        new_logs.append(
            f"[Load] {overall_emoji} ETL TERMINÉ — "
            f"{len(fact_tables)} fact(s) • "
            f"✅ {total_inserted:,} rows chargés • "
            f"⚠️ {total_rejected:,} rejets • "
            f"📊 {overall_yield:.1f}% yield"
        )
        new_logs.append(
            f"[Load] ⚡ {overall_rate:,.0f} rows/s moyen • "
            f"🕒 Durée {_format_duration(total_elapsed)} • "
            f"📦 Préfixe [{user_prefix}] • "
            f"🏁 {datetime.now(timezone.utc).strftime('%H:%M:%S UTC')}"
        )
        new_logs.append("[Load] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

        is_success = total_inserted > 0 or source_rows == 0

        # Nettoyage des tables sources après ETL réussi
        if is_success:
            _save_session_to_disk(session_id, logical_model, user_prefix, dw_config)
            new_logs = _drop_source_tables(dw_engine, user_prefix, new_logs)

        return {
            "etl_status":  "success" if is_success else "failed",
            "etl_error":   "" if is_success else "Fact loading failed: 0 rows inserted",
            "load_metrics": load_metrics,
            "execution_log": new_logs,
        }

    except Exception as e:
        logger.error(f"[Load] Failed: {e}")
        return {
            "etl_status": "failed",
            "etl_error":  f"Loading failed: {e}",
            "execution_log": new_logs + [f"[Load] 💥 Crash: {e}"],
        }
