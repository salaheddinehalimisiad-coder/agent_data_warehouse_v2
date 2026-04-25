# api/services/olap_service.py — OLAP Cube SQL Builder
"""
Construit et exécute des requêtes GROUP BY T-SQL dynamiques à partir
d'une spec axes/mesures/filtres fournie par le frontend OLAP Explorer.
"""
import logging
import pandas as pd
import numpy as np
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ─── Helpers modèle logique ───────────────────────────────────────────────────

def _dim_pk(logical_model: dict, dim_name: str) -> str:
    for dim in logical_model.get("dimension_tables", []):
        if dim.get("name") == dim_name:
            for col in dim.get("columns", []):
                if col.get("role") == "pk":
                    return col["name"]
            cols = dim.get("columns", [])
            return cols[0]["name"] if cols else f"{dim_name}_sk"
    return f"{dim_name}_sk"


def _fact_fk_for_dim(logical_model: dict, dim_name: str) -> Optional[str]:
    """Trouve la colonne FK dans la table de faits qui référence dim_name."""
    fact_tables = logical_model.get("fact_tables", [])
    if not fact_tables:
        ft = logical_model.get("fact_table")
        fact_tables = [ft] if ft else []
    for fact in fact_tables:
        if not fact:
            continue
        for col in fact.get("columns", []):
            if col.get("role") == "fk" and col.get("references") == dim_name:
                return col["name"]
    # Fallback par convention : dim_customer → customer_sk
    return dim_name.replace("dim_", "") + "_sk"


# ─── Constructeur SQL ─────────────────────────────────────────────────────────

def build_olap_sql(
    logical_model: dict,
    prefix: str,
    row_dims: List[Dict],   # [{"dim":"dim_date","col":"year"}, ...]
    measures: List[Dict],   # [{"fact":"fact_orders","col":"freight","agg":"SUM","alias":"total_freight"}, ...]
    filters: List[Dict],    # [{"dim":"dim_date","col":"year","op":"=","val":"1997"}, ...]
    top_n: int = 0,         # 0 = pas de limite
) -> str:
    if not measures:
        raise ValueError("Au moins une mesure est requise.")

    # Déduire la table de faits depuis les mesures
    fact_name = measures[0].get("fact", "")
    if not fact_name:
        # Fallback auto
        fact_tables = logical_model.get("fact_tables", [])
        if not fact_tables:
            ft = logical_model.get("fact_table")
            fact_tables = [ft] if ft else []
        fact_name = fact_tables[0].get("name", "") if fact_tables else ""
    fact_physical = f"[{prefix}_{fact_name}]"

    # Dimensions impliquées (row + filtres)
    dims_needed: Dict[str, int] = {}
    for rd in row_dims:
        d = rd.get("dim", "")
        if d and d not in dims_needed:
            dims_needed[d] = len(dims_needed)
    for flt in filters:
        d = flt.get("dim", "")
        if d and d != "__fact__" and d not in dims_needed:
            dims_needed[d] = len(dims_needed)

    # Alias par dimension
    dim_alias: Dict[str, str] = {name: f"d{idx}" for name, idx in dims_needed.items()}

    # JOINs
    join_lines = []
    for dim_name, alias in dim_alias.items():
        dim_physical = f"[{prefix}_{dim_name}]"
        fk_col = _fact_fk_for_dim(logical_model, dim_name)
        pk_col = _dim_pk(logical_model, dim_name)
        join_lines.append(
            f"  LEFT JOIN {dim_physical} {alias}"
            f" ON f.[{fk_col}] = {alias}.[{pk_col}]"
        )

    # SELECT + GROUP BY
    select_parts = []
    group_by_parts = []
    for rd in row_dims:
        dim_name = rd["dim"]
        col      = rd["col"]
        alias    = dim_alias.get(dim_name, "f")
        lbl      = rd.get("alias") or f"{dim_name.replace('dim_','')}__{col}"
        ref      = f"{alias}.[{col}]"
        select_parts.append(f"  {ref} AS [{lbl}]")
        group_by_parts.append(ref)

    for m in measures:
        agg   = (m.get("agg") or "SUM").upper()
        col   = m.get("col", "*")
        lbl   = m.get("alias") or f"{agg.lower()}_{col}"
        expr  = f"COUNT(*)" if (agg == "COUNT" and col == "*") else f"{agg}(f.[{col}])"
        select_parts.append(f"  {expr} AS [{lbl}]")

    # WHERE — skip any incomplete filter (missing dim, col, or val)
    where_parts = []
    _no_val_ops = {"IS NULL", "IS NOT NULL"}
    for flt in filters:
        dim_name = flt.get("dim", "").strip()
        col      = flt.get("col", "").strip()
        op       = flt.get("op", "=").strip().upper()
        val      = str(flt.get("val", "")).strip()

        # Skip incomplete filters to prevent empty alias / invalid SQL
        if not col or col == "-":
            logger.debug(f"[OLAP] Skipping incomplete filter (no col): {flt}")
            continue
        if op not in _no_val_ops and not val:
            logger.debug(f"[OLAP] Skipping filter with empty value: {flt}")
            continue

        if not dim_name or dim_name == "__fact__":
            col_ref = f"f.[{col}]"
        else:
            a = dim_alias.get(dim_name, "f")
            col_ref = f"{a}.[{col}]"

        if op == "IN":
            vals = ", ".join(f"'{v.strip()}'" for v in str(val).split(",") if v.strip())
            if not vals:
                continue
            where_parts.append(f"{col_ref} IN ({vals})")
        elif op in _no_val_ops:
            where_parts.append(f"{col_ref} {op}")
        else:
            try:
                float(str(val).replace(",", "."))
                where_parts.append(f"{col_ref} {op} {val}")
            except ValueError:
                safe_val = val.replace("'", "''")
                where_parts.append(f"{col_ref} {op} '{safe_val}'")

    # ORDER BY : les 2 premières colonnes de GROUP BY
    order_cols = group_by_parts[:2] if group_by_parts else []

    # Assembly
    top_clause = f"TOP {top_n} " if top_n > 0 else ""
    select_sql = "SELECT\n" + top_clause + ",\n".join(select_parts)
    from_sql   = f"FROM {fact_physical} f"
    join_sql   = "\n".join(join_lines)
    where_sql  = ("\nWHERE " + "\n  AND ".join(where_parts)) if where_parts else ""
    group_sql  = ("\nGROUP BY " + ", ".join(group_by_parts)) if group_by_parts else ""
    order_sql  = ("\nORDER BY " + ", ".join(order_cols)) if order_cols else ""

    return f"{select_sql}\n{from_sql}\n{join_sql}{where_sql}{group_sql}{order_sql};"


# ─── Exécution ────────────────────────────────────────────────────────────────

def _safe_val(v):
    if v is None:
        return None
    if isinstance(v, float) and np.isnan(v):
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return round(float(v), 4)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    if not isinstance(v, (str, int, float, bool)):
        return str(v)
    return v


def execute_olap(sql: str, dw_config: dict, limit: int = 5000) -> Dict[str, Any]:
    from nodes.etl_executor import _build_engine

    logger.info(f"[OLAP] Generated SQL:\n{sql}")
    engine = _build_engine(dw_config)
    with engine.connect() as conn:
        df = pd.read_sql(sql, conn).head(limit)

    for col in df.columns:
        if "datetime" in str(df[col].dtype):
            df[col] = df[col].astype(str).where(df[col].notna(), None)

    columns = list(df.columns)
    rows    = [[_safe_val(v) for v in row] for row in df.values.tolist()]
    return {"columns": columns, "rows": rows, "total": len(rows)}


# ─── Métadonnées disponibles pour le frontend ─────────────────────────────────

def get_olap_schema(logical_model: dict, prefix: str) -> Dict[str, Any]:
    """
    Retourne le schéma exploitable par le frontend OLAP :
    - dimensions : [{name, physical_name, columns: [{name, type, role}]}]
    - facts       : [{name, physical_name, metrics: [{name, type}]}]
    """
    dims = []
    for dim in logical_model.get("dimension_tables", []):
        dim_name = dim.get("name", "")
        cols = [
            {"name": c["name"], "type": c.get("type", ""), "role": c.get("role", "")}
            for c in dim.get("columns", [])
            if c.get("role") != "pk"  # PK non exposée comme champ analytique
        ]
        dims.append({
            "name":          dim_name,
            "physical_name": f"{prefix}_{dim_name}",
            "columns":       cols,
        })

    fact_tables_raw = logical_model.get("fact_tables", [])
    if not fact_tables_raw:
        ft = logical_model.get("fact_table")
        fact_tables_raw = [ft] if ft else []

    facts = []
    for fact in fact_tables_raw:
        if not fact:
            continue
        fact_name = fact.get("name", "")
        all_cols = fact.get("columns", [])
        metrics = [
            {"name": c["name"], "type": c.get("type", "")}
            for c in all_cols
            if c.get("role") in ("metric", "measure")
        ]
        # Fallback: toutes les colonnes non-fk/non-pk comme métriques candidates
        if not metrics:
            metrics = [
                {"name": c["name"], "type": c.get("type", "")}
                for c in all_cols
                if c.get("role") not in ("fk", "pk")
            ]
        # Ajouter COUNT(*) toujours disponible
        metrics.insert(0, {"name": "*", "type": "COUNT", "label": "Nb lignes (COUNT)"})
        facts.append({
            "name":          fact_name,
            "physical_name": f"{prefix}_{fact_name}",
            "metrics":       metrics,
        })

    return {"dimensions": dims, "facts": facts, "prefix": prefix}
