# nodes/query_generator.py — P3-02 : Générateur de Requêtes Analytiques OLAP
"""
Phase 3 — Génère des requêtes SQL analytiques sur le schéma DW produit par le Modeler.
- Utilise le modèle logique (fact_tables + dimensions) pour construire des requêtes pertinentes
- Fallback algorithmique si LLM indisponible
- Exécute les requêtes sur la base DW réelle et stocke les résultats
- 100% générique : fonctionne sur N'IMPORTE quel schéma généré
"""
import json
import logging
import re
from typing import List, Dict, Any, Optional
from app_state import AgentState
from nodes.llm_factory import get_llm, call_with_retry, extract_text
from langchain_core.prompts import ChatPromptTemplate

logger = logging.getLogger(__name__)

# ── Prompt LLM ────────────────────────────────────────────────────────────────
QUERY_GEN_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """Tu es un Expert SQL OLAP / Business Intelligence.
On te donne le schéma d'un Data Warehouse en Star/Constellation Schema sur SQL Server.
Ton objectif : générer exactement 6 requêtes SQL analytiques pertinentes.

## Règles :
- Utilise UNIQUEMENT les noms de tables et colonnes fournis (avec le préfixe utilisateur)
- Syntaxe T-SQL (SQL Server) — pas de MySQL ni PostgreSQL
- Inclure des GROUP BY, ORDER BY, agrégations (SUM, COUNT, AVG, MIN, MAX)
- Varier les types : tendances temporelles, top-N, répartition, KPIs, comparaisons
- Les JOINs doivent utiliser les surrogate keys (_sk)
- Chaque requête doit avoir un titre descriptif et une description métier

## Format JSON OBLIGATOIRE (pur, sans markdown) :
[
  {{
    "title": "Titre Business de la Requête",
    "description": "Ce que cette requête révèle pour le décideur",
    "type": "trend|top_n|distribution|kpi|comparison|detail",
    "sql": "SELECT ... FROM ... JOIN ... GROUP BY ... ORDER BY ..."
  }}
]"""),
    ("human", """Schéma du Data Warehouse :

=== TABLES DE FAITS ===
{fact_tables}

=== TABLES DE DIMENSIONS ===
{dim_tables}

=== PRÉFIXE UTILISATEUR ===
{prefix}

Génère 6 requêtes SQL analytiques variées. Retourne uniquement le JSON.""")
])


def query_generator_node(state: AgentState) -> dict:
    """Génère et exécute des requêtes analytiques SQL OLAP sur le DW généré."""
    logger.info("--- AGENT QUERY GENERATOR : Requêtes Analytiques OLAP ---")

    logical_model = state.get("logical_model", {})
    prefix = state.get("user_prefix", "dw")
    dw_config = state.get("dw_connection_config", {})

    if not logical_model:
        logger.warning("[QueryGen] Aucun modèle logique — SKIP")
        return {
            "execution_log": [
                "[QueryGen] ⚠️ SKIP — pas de modèle logique"
            ],
            "generated_queries": [],
            "query_results": [],
        }

    # ── Génération algorithmique directe (noms physiques garantis) ──────────
    # Le LLM invente des noms de tables (français, mauvais préfixe) → bypass total
    queries = _generate_fallback(logical_model, prefix)
    logger.info(f"[QueryGen] 🤖 {len(queries)} requêtes générées (noms physiques: {prefix}_*)")

    # ── Exécuter les requêtes sur la base DW ─────────────────────────────────
    query_results = []
    if dw_config and queries:
        query_results = _execute_queries(queries, dw_config)
        n_success = sum(1 for r in query_results if not r.get("error"))
        logger.info(f"[QueryGen] Exécution : {n_success}/{len(query_results)} requêtes réussies")

    return {
        "execution_log": [
            f"[QueryGen] ✅ {len(queries)} requêtes générées, "
            f"{sum(1 for r in query_results if not r.get('error'))}/{len(query_results)} exécutées"
        ],
        "generated_queries": queries,
        "query_results": query_results,
    }


# ═════════════════════════════════════════════════════════════════════════════
# LLM GENERATION
# ═════════════════════════════════════════════════════════════════════════════

def _generate_via_llm(model: dict, prefix: str) -> Optional[List[Dict]]:
    """Génère les requêtes via LLM."""
    llm = get_llm(temperature=0.1, task_type="code")
    chain = QUERY_GEN_PROMPT | llm

    fact_tables = model.get("fact_tables", [])
    if not fact_tables:
        ft = model.get("fact_table")
        fact_tables = [ft] if ft else []

    fact_str = "\n".join(
        f"  [{prefix}_{ft['name']}] colonnes: {', '.join(c['name'] for c in ft.get('columns', []))}"
        for ft in fact_tables if ft
    )
    dim_str = "\n".join(
        f"  [{prefix}_{dt['name']}] colonnes: {', '.join(c['name'] for c in dt.get('columns', []))}"
        for dt in model.get("dimension_tables", [])
    )

    resp = call_with_retry(chain, {
        "fact_tables": fact_str,
        "dim_tables": dim_str,
        "prefix": prefix,
    })
    raw = extract_text(resp)
    return _parse_queries_json(raw)


def _parse_queries_json(raw: str) -> Optional[List[Dict]]:
    """Parse le JSON des requêtes depuis la réponse LLM."""
    cleaned = re.sub(r"```(?:json)?\n?", "", raw).strip().rstrip("`")
    try:
        result = json.loads(cleaned)
        if isinstance(result, list) and len(result) > 0:
            return result
    except json.JSONDecodeError:
        m = re.search(r"\[[\s\S]+\]", cleaned)
        if m:
            try:
                result = json.loads(m.group())
                if isinstance(result, list):
                    return result
            except Exception:
                pass
    return None


# ═════════════════════════════════════════════════════════════════════════════
# FALLBACK ALGORITHMIQUE
# ═════════════════════════════════════════════════════════════════════════════

def _generate_fallback(model: dict, prefix: str) -> List[Dict]:
    """Génère des requêtes analytiques algorithmiquement sans LLM."""
    queries = []

    fact_tables = model.get("fact_tables", [])
    if not fact_tables:
        ft = model.get("fact_table")
        fact_tables = [ft] if ft else []

    dims = model.get("dimension_tables", [])
    dim_date = next((d for d in dims if d.get("name") == "dim_date"), None)

    for fact in fact_tables:
        if not fact:
            continue
        fact_full = f"[{prefix}_{fact['name']}]"
        cols = fact.get("columns", [])

        # Identifier les métriques et FKs
        metrics = [c for c in cols if c.get("role") in ("metric", "measure")]
        if not metrics:
            metrics = [c for c in cols if c.get("role") not in ("fk", "pk")]
        fk_cols = [c for c in cols if c.get("role") == "fk"]

        if not metrics:
            continue

        first_metric = metrics[0]["name"]

        # ── 1. KPI global ────────────────────────────────────────────────────
        agg_parts = ", ".join(
            f"SUM([{m['name']}]) AS total_{m['name']}" if 'decimal' in m.get('type', '').lower() or 'money' in m.get('type', '').lower()
            else f"SUM([{m['name']}]) AS total_{m['name']}" if 'int' in m.get('type', '').lower()
            else f"COUNT([{m['name']}]) AS count_{m['name']}"
            for m in metrics[:3]
        )
        queries.append({
            "title": f"KPI Global — {fact['name']}",
            "description": "Vue d'ensemble des métriques clés de la table de faits",
            "type": "kpi",
            "sql": f"SELECT COUNT(*) AS total_rows, {agg_parts} FROM {fact_full};"
        })

        # ── 2. Tendance temporelle (si dim_date) ─────────────────────────────
        if dim_date:
            date_full = f"[{prefix}_dim_date]"
            date_sk_col = next(
                (c["name"] for c in fk_cols if c.get("references") == "dim_date"),
                "date_sk"
            )
            # Résoudre les vrais noms de colonnes depuis le modèle
            date_col_names = {c["name"].lower(): c["name"] for c in dim_date.get("columns", [])}
            year_col  = _find_date_dim_col(date_col_names, ["year", "annee", "année", "an"])
            month_col = _find_date_dim_col(date_col_names, ["month", "mois"])
            mname_col = _find_date_dim_col(date_col_names, ["month_name", "nom_mois", "mois_nom"])

            if year_col and month_col:
                month_part = f"d.[{month_col}]"
                if mname_col:
                    month_part += f", d.[{mname_col}]"
                queries.append({
                    "title": f"Tendance Mensuelle — {fact['name']}",
                    "description": "Évolution des métriques par mois et année",
                    "type": "trend",
                    "sql": (
                        f"SELECT d.[{year_col}], {month_part}, "
                        f"SUM(f.[{first_metric}]) AS total_{first_metric}, "
                        f"COUNT(*) AS nb_transactions "
                        f"FROM {fact_full} f "
                        f"JOIN {date_full} d ON f.[{date_sk_col}] = d.[date_sk] "
                        f"GROUP BY d.[{year_col}], {month_part} "
                        f"ORDER BY d.[{year_col}], d.[{month_col}];"
                    )
                })

        # ── 3. Top N par dimension ───────────────────────────────────────────
        for fk in fk_cols[:2]:
            ref_dim = fk.get("references", "")
            if ref_dim == "dim_date":
                continue
            dim_info = next((d for d in dims if d.get("name") == ref_dim), None)
            if not dim_info:
                continue

            dim_full = f"[{prefix}_{ref_dim}]"
            sk_name = fk["name"]

            # Trouver un attribut descriptif (pas sk, pas dates SCD)
            desc_col = _find_descriptive_col(dim_info)
            if not desc_col:
                continue

            queries.append({
                "title": f"Top 10 — {ref_dim} par {first_metric}",
                "description": f"Les 10 {ref_dim} avec le plus de {first_metric}",
                "type": "top_n",
                "sql": (
                    f"SELECT TOP 10 dim.[{desc_col}], "
                    f"SUM(f.[{first_metric}]) AS total_{first_metric}, "
                    f"COUNT(*) AS nb_transactions "
                    f"FROM {fact_full} f "
                    f"JOIN {dim_full} dim ON f.[{sk_name}] = dim.[{_get_pk(dim_info)}] "
                    f"GROUP BY dim.[{desc_col}] "
                    f"ORDER BY total_{first_metric} DESC;"
                )
            })

        # ── 4. Distribution trimestrielle ────────────────────────────────────
        if dim_date:
            date_full = f"[{prefix}_dim_date]"
            date_sk_col = next(
                (c["name"] for c in fk_cols if c.get("references") == "dim_date"),
                "date_sk"
            )
            date_col_names = {c["name"].lower(): c["name"] for c in dim_date.get("columns", [])}
            year_col2    = _find_date_dim_col(date_col_names, ["year", "annee", "année", "an"])
            quarter_col  = _find_date_dim_col(date_col_names, ["quarter", "trimestre"])

            if year_col2 and quarter_col:
                queries.append({
                    "title": f"Distribution Trimestrielle — {fact['name']}",
                    "description": "Répartition des transactions par trimestre",
                    "type": "distribution",
                    "sql": (
                        f"SELECT d.[{year_col2}], d.[{quarter_col}], "
                        f"SUM(f.[{first_metric}]) AS total_{first_metric}, "
                        f"COUNT(*) AS nb_transactions, "
                        f"AVG(CAST(f.[{first_metric}] AS FLOAT)) AS avg_{first_metric} "
                        f"FROM {fact_full} f "
                        f"JOIN {date_full} d ON f.[{date_sk_col}] = d.[date_sk] "
                        f"GROUP BY d.[{year_col2}], d.[{quarter_col}] "
                        f"ORDER BY d.[{year_col2}], d.[{quarter_col}];"
                    )
                })

    # Limiter à 6 requêtes
    return queries[:6]


def _find_date_dim_col(col_names_lower: dict, candidates: list) -> Optional[str]:
    """Résout le vrai nom d'une colonne date depuis une liste de candidats (FR/EN)."""
    for c in candidates:
        if c in col_names_lower:
            return col_names_lower[c]
    # Correspondance partielle
    for c in candidates:
        for k, v in col_names_lower.items():
            if c in k or k in c:
                return v
    return None


def _find_descriptive_col(dim_info: dict) -> Optional[str]:
    """Trouve une colonne descriptive dans une dimension (pas PK, pas SCD)."""
    scd_cols = {"valid_from", "valid_to", "is_current"}
    for col in dim_info.get("columns", []):
        name = col.get("name", "")
        role = col.get("role", "")
        if role == "pk":
            continue
        if name.lower() in scd_cols:
            continue
        if col.get("natural_key"):
            continue
        if "name" in name.lower() or "label" in name.lower() or "title" in name.lower():
            return name
    # Fallback: first non-pk non-scd attribute
    for col in dim_info.get("columns", []):
        name = col.get("name", "")
        role = col.get("role", "")
        if role == "pk" or name.lower() in scd_cols:
            continue
        if col.get("type", "").upper().startswith("NVARCHAR") or col.get("type", "").upper().startswith("VARCHAR"):
            return name
    return None


def _get_pk(dim_info: dict) -> str:
    """Retourne le nom de la PK d'une dimension."""
    for col in dim_info.get("columns", []):
        if col.get("role") == "pk":
            return col["name"]
    return dim_info.get("columns", [{}])[0].get("name", "id")


# ═════════════════════════════════════════════════════════════════════════════
# EXÉCUTION DES REQUÊTES
# ═════════════════════════════════════════════════════════════════════════════

def _execute_queries(queries: List[Dict], dw_config: dict) -> List[Dict]:
    """Exécute les requêtes sur la base DW et retourne les résultats."""
    results = []
    try:
        from nodes.etl_executor import _build_engine
        import pandas as pd
        engine = _build_engine(dw_config)
    except Exception as e:
        logger.error(f"[QueryGen] Impossible de créer le moteur DB : {e}")
        return [
            {**q, "columns": [], "rows": [], "error": f"DB connection failed: {e}"}
            for q in queries
        ]

    for q in queries:
        sql = q.get("sql", "")
        result = {
            "title": q.get("title", ""),
            "description": q.get("description", ""),
            "type": q.get("type", ""),
            "sql": sql,
            "columns": [],
            "rows": [],
            "error": None,
        }
        if not sql:
            result["error"] = "SQL vide"
            results.append(result)
            continue

        try:
            with engine.connect() as conn:
                df = pd.read_sql(sql, conn)
                result["columns"] = list(df.columns)
                # Limiter à 100 lignes pour le rapport
                result["rows"] = df.head(100).values.tolist()
                # Convertir les types numpy pour sérialisation JSON
                result["rows"] = [
                    [_safe_val(v) for v in row]
                    for row in result["rows"]
                ]
        except Exception as e:
            result["error"] = str(e)[:500]
            logger.warning(f"[QueryGen] Erreur SQL '{q.get('title', '')}': {e}")

        results.append(result)

    return results


def _safe_val(val) -> Any:
    """Convertit une valeur numpy/pandas pour JSON."""
    import numpy as np
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return None
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        return round(float(val), 4)
    if isinstance(val, (np.bool_,)):
        return bool(val)
    return str(val) if not isinstance(val, (str, int, float, bool)) else val
