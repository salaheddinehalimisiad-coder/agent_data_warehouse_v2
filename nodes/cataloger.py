# nodes/cataloger.py — Agent de Documentation Automatique (Data Catalog)
import logging
from app_state import AgentState

logger = logging.getLogger(__name__)

# Descriptions métier génériques par rôle de colonne
_ROLE_DESC = {
    "pk":      "Clé primaire surrogate (auto-incrémentée)",
    "fk":      "Clé étrangère vers une dimension",
    "metric":  "Mesure quantitative pour l'analyse",
    "attribute": "Attribut descriptif de la dimension",
    "date":    "Dimension temporelle",
}

_TABLE_PREFIX_DESC = {
    "dim_date":     "Dimension temporelle — calendrier analytique complet",
    "dim_":         "Table de dimension — attributs descriptifs pour l'analyse",
    "fact_":        "Table de faits — mesures quantitatives et clés étrangères",
}


def _table_description(name: str) -> str:
    for prefix, desc in _TABLE_PREFIX_DESC.items():
        if name.startswith(prefix):
            return desc
    return f"Table DW — {name.replace('_', ' ')}"


def _col_description(col: dict) -> str:
    name = col.get("name", "")
    role = col.get("role", "")
    col_type = col.get("type", "")
    if role in _ROLE_DESC:
        base = _ROLE_DESC[role]
    elif "date" in name.lower():
        base = "Champ date"
    elif "name" in name.lower() or "label" in name.lower():
        base = "Libellé textuel"
    elif col_type.upper().startswith("DECIMAL") or col_type.upper().startswith("FLOAT"):
        base = "Valeur numérique décimale"
    elif col_type.upper().startswith("INT") or col_type.upper().startswith("BIGINT"):
        base = "Valeur entière"
    else:
        base = f"Champ {name.replace('_', ' ')}"
    ref = col.get("references")
    if ref:
        base += f" → {ref}"
    return base


def cataloger_node(state: AgentState) -> dict:
    """Génère un catalogue sémantique du DW à partir du modèle logique (sans LLM)."""
    logger.info("--- AGENT CATALOGER : Indexation Sémantique ---")

    logical_model = state.get("logical_model", {})
    user_prefix   = state.get("user_prefix", "dw")
    if not logical_model:
        return {"execution_log": ["[Cataloger] SKIP — Pas de modèle"]}

    catalog_tables = []

    # Dimensions
    for dim in logical_model.get("dimension_tables", []):
        name = f"{user_prefix}_{dim.get('name', '')}"
        catalog_tables.append({
            "name": name,
            "type": "dimension",
            "description": _table_description(dim.get("name", "")),
            "columns": [
                {"name": c.get("name"), "type": c.get("type", ""), "description": _col_description(c)}
                for c in dim.get("columns", [])
            ]
        })

    # Faits
    fact_tables = logical_model.get("fact_tables", [])
    if not fact_tables:
        ft = logical_model.get("fact_table")
        fact_tables = [ft] if ft else []
    for fact in fact_tables:
        if not fact:
            continue
        name = f"{user_prefix}_{fact.get('name', '')}"
        catalog_tables.append({
            "name": name,
            "type": "fact",
            "description": _table_description(fact.get("name", "")),
            "columns": [
                {"name": c.get("name"), "type": c.get("type", ""), "description": _col_description(c)}
                for c in fact.get("columns", [])
            ]
        })

    catalog = {"tables": catalog_tables}
    logger.info(f"[Cataloger] ✅ {len(catalog_tables)} tables indexées")

    return {
        "execution_log": [f"[Cataloger] ✅ {len(catalog_tables)} tables cataloguées"],
        "data_catalog": catalog,
    }
