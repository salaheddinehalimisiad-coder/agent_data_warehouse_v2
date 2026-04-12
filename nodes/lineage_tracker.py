# nodes/lineage_tracker.py — Agent Lineage Tracker v1.1 (FIXED)
"""
Nœud LangGraph inséré après etl_executor (succès).
Rôle : construire et persister le graphe de lignage complet
  source_column → transform → target_table.target_column

FIX v1.1 :
- Suppression de l'usage incorrect d'asyncio dans un nœud synchrone
- Chemins de fichiers absolus via pathlib (plus de CWD-dependency)
"""
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from app_state import AgentState

logger = logging.getLogger(__name__)

# Chemin absolu indépendant du CWD
_HERE = Path(__file__).parent.parent
LINEAGE_STORE = _HERE / "outputs" / "lineage_history.json"


def lineage_tracker_node(state: AgentState) -> dict:
    """
    Construit le lineage data-to-DW à partir du modèle logique et
    des métadonnées source. Persiste un historique JSON.
    """
    logger.info("--- AGENT LINEAGE TRACKER : Construction du lignage ---")

    source_meta   = state.get("source_metadata", {})
    logical_model = state.get("logical_model", {})
    user_prefix   = state.get("user_prefix", "dw")
    session_id    = state.get("session_id", "unknown")

    if not logical_model or not source_meta:
        return {
            "lineage": {},
            "execution_log": state.get("execution_log", []) + [
                "[Lineage] SKIP — modèle ou métadonnées absents"
            ],
        }

    lineage = _build_lineage(source_meta, logical_model, user_prefix)

    # Persistance synchrone directe (pas d'asyncio dans un nœud sync)
    try:
        _persist_lineage(lineage, session_id, state)
    except Exception as e:
        logger.warning(f"[Lineage] Persistance échouée (non-bloquant) : {e}")

    node_count = sum(len(v["nodes"]) for v in lineage.values())
    edge_count = sum(len(v["edges"]) for v in lineage.values())

    log_msg = f"[Lineage] ✅ {node_count} nœuds, {edge_count} transformations tracées"
    logger.info(log_msg)

    return {
        "lineage": lineage,
        "execution_log": state.get("execution_log", []) + [log_msg],
    }


# ─── Construction du graphe de lignage ───────────────────────────────────────

def _build_lineage(
    source_meta: Dict,
    logical_model: Dict,
    prefix: str,
) -> Dict[str, Any]:
    result: Dict[str, Any] = {}

    source_cols: Dict[str, List[str]] = {}
    for table_name, table_data in source_meta.items():
        if isinstance(table_data, dict):
            source_cols[table_name] = [
                c.get("name", "") for c in table_data.get("columns", [])
            ]

    def _node_id(kind: str, table: str, col: str) -> str:
        return f"{kind}::{table}::{col}"

    for dim in logical_model.get("dimension_tables", []):
        dim_name   = dim.get("name", "")
        target_tbl = f"{prefix}_{dim_name}"
        nodes, edges = [], []

        for col in dim.get("columns", []):
            col_name = col.get("name", "")
            role     = col.get("role", "attribute")
            target_node = {
                "id":    _node_id("target", target_tbl, col_name),
                "label": col_name,
                "table": target_tbl,
                "role":  role,
                "kind":  "target",
            }
            nodes.append(target_node)

            matched_source = _find_source_column(col_name, source_cols)
            if matched_source:
                src_tbl, src_col = matched_source
                src_node = {
                    "id":    _node_id("source", src_tbl, src_col),
                    "label": src_col,
                    "table": src_tbl,
                    "kind":  "source",
                }
                if not any(n["id"] == src_node["id"] for n in nodes):
                    nodes.append(src_node)
                edges.append({
                    "from":      src_node["id"],
                    "to":        target_node["id"],
                    "transform": _infer_transform(src_col, col_name, role),
                })

        result[target_tbl] = {"type": "dimension", "nodes": nodes, "edges": edges}

    fact = logical_model.get("fact_table", {})
    if fact:
        fact_name  = fact.get("name", "")
        target_tbl = f"{prefix}_{fact_name}"
        nodes, edges = [], []

        for col in fact.get("columns", []):
            col_name = col.get("name", "")
            role     = col.get("role", "metric")
            target_node = {
                "id":    _node_id("target", target_tbl, col_name),
                "label": col_name,
                "table": target_tbl,
                "role":  role,
                "kind":  "target",
            }
            nodes.append(target_node)

            if role == "metric":
                matched = _find_source_column(col_name, source_cols)
                if matched:
                    src_tbl, src_col = matched
                    src_node = {
                        "id":    _node_id("source", src_tbl, src_col),
                        "label": src_col,
                        "table": src_tbl,
                        "kind":  "source",
                    }
                    if not any(n["id"] == src_node["id"] for n in nodes):
                        nodes.append(src_node)
                    edges.append({
                        "from":      src_node["id"],
                        "to":        target_node["id"],
                        "transform": "DIRECT_LOAD",
                    })
            elif role == "fk":
                ref_dim = col.get("references", "")
                edges.append({
                    "from":      _node_id("target", f"{prefix}_{ref_dim}", "sk"),
                    "to":        target_node["id"],
                    "transform": "LOOKUP_SK",
                })

        result[target_tbl] = {"type": "fact", "nodes": nodes, "edges": edges}

    return result


def _find_source_column(
    col_name: str,
    source_cols: Dict[str, List[str]],
) -> Optional[Tuple[str, str]]:
    clean = col_name.lower()
    for suffix in ("_sk", "_id", "_key", "_fk"):
        clean = clean.removesuffix(suffix)
    for pfx in ("dim_", "fact_"):
        clean = clean.removeprefix(pfx)

    for table, cols in source_cols.items():
        for src_col in cols:
            if src_col.lower() == clean or src_col.lower() == col_name.lower():
                return (table, src_col)
            if clean in src_col.lower() or src_col.lower() in clean:
                return (table, src_col)
    return None


def _infer_transform(src_col: str, tgt_col: str, role: str) -> str:
    if role == "pk":
        return "GENERATE_SURROGATE_KEY"
    if "date" in src_col.lower() or "date" in tgt_col.lower():
        return "DATE_PARSE"
    if src_col.lower() == tgt_col.lower():
        return "DIRECT_LOAD"
    return "RENAME_AND_CAST"


def _persist_lineage(lineage: Dict, session_id: str, state: AgentState) -> None:
    """Persiste le lignage dans un fichier JSON historique (chemin absolu)."""
    LINEAGE_STORE.parent.mkdir(parents=True, exist_ok=True)

    history = []
    if LINEAGE_STORE.exists():
        try:
            with open(LINEAGE_STORE, "r") as f:
                history = json.load(f)
        except Exception:
            history = []

    entry = {
        "session_id":  session_id,
        "timestamp":   datetime.now(timezone.utc).isoformat(),
        "user_prefix": state.get("user_prefix", "dw"),
        "lineage":     lineage,
    }
    history.append(entry)
    history = history[-50:]

    with open(LINEAGE_STORE, "w") as f:
        json.dump(history, f, indent=2, default=str)
