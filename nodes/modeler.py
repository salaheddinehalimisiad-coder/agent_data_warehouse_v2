# nodes/modeler.py — Agent Modeler v3.0 : Star Schema Intelligence Kimball
"""
Refonte complète v3.0 :
- Analyse multi-tables relationnelles (OLTP → OLAP)
- Scoring automatique de la table de faits (FK + métriques + lignes)
- Détection du pattern Header/Détail (Orders + OrderDetails → fact_sales)
- Aplatissement Snowflake (Products + Categories → dim_product)
- Déduction des FK depuis les noms de colonnes si l'inspecteur DB ne les fournit pas
- Dimensions métier propres : Date, Client, Produit, Employé, Fournisseur, Transporteur
- Prompt LLM enrichi avec le graphe FK explicite
"""
import json
import logging
import re
import math
from typing import Dict, Any, List, Optional, Tuple
from app_state import AgentState
from nodes.llm_factory import get_llm, call_with_retry, extract_text
from langchain_core.prompts import ChatPromptTemplate

logger = logging.getLogger(__name__)

# ── Classification des types ──────────────────────────────────────────────────
_NUMERIC_TYPES = {
    'int', 'integer', 'bigint', 'smallint', 'tinyint', 'float', 'real',
    'double', 'decimal', 'numeric', 'money', 'smallmoney',
    'int64', 'float64', 'int32', 'float32', 'number',
}
_DATE_TYPES = {
    'date', 'datetime', 'datetime2', 'smalldatetime', 'datetimeoffset',
    'timestamp', 'datetime64', 'time',
}


def _norm(dtype: str) -> str:
    """Normalise un type de données (supprime longueur, namespace)."""
    return str(dtype).lower().split('[')[0].split('(')[0].strip()


def _is_num(dtype: str) -> bool:
    t = _norm(dtype)
    return t in _NUMERIC_TYPES or any(n in t for n in ('int', 'float', 'decimal', 'numeric', 'money'))


def _is_dt(dtype: str, col: str = '') -> bool:
    t = _norm(dtype)
    return t in _DATE_TYPES or 'date' in t or ('date' in col.lower() and 'update' not in col.lower())


def _is_id(col: str) -> bool:
    return bool(re.search(r'(^id$|_id$|^id_)', col.lower()))


def _to_tsql(dtype: str, col: str, role: str = 'attribute') -> str:
    """Convertit un dtype pandas/SQLAlchemy en type T-SQL propre."""
    if role == 'pk':
        return 'BIGINT IDENTITY(1,1)'
    if role == 'fk':
        return 'BIGINT'
    t = _norm(dtype)
    if _is_id(col) and _is_num(dtype):
        return 'BIGINT'
    if _is_dt(dtype, col):
        return 'DATE'
    if _is_num(dtype):
        if any(x in t for x in ('tinyint', 'smallint', 'int', 'integer', 'bigint')):
            return 'INT'
        return 'DECIMAL(15,4)'
    return 'NVARCHAR(255)'


# ── Prompt LLM enrichi ────────────────────────────────────────────────────────
MODELER_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """Tu es un Expert Architecte Data Warehouse Senior spécialisé en modélisation OLAP Kimball.

Tu analyses une base de données OLTP relationnelle et tu dois concevoir le Star Schema Kimball optimal.

## Processus obligatoire :
1. **IDENTIFIER LA FACT TABLE** : table avec le plus de FK sortantes + métriques numériques + lignes
2. **PATTERN HEADER/DÉTAIL** : si la best-fact table référence une autre table transactionnelle (ex: Orders),
   fusionne-les en une seule fact_sales. La grain = la table de détail.
3. **CRÉER UNE DIMENSION** par entité référencée (client, produit, employé, date, transporteur, fournisseur)
4. **SNOWFLAKE → STAR** : si une dimension référence une autre table (Products→Categories),
   inclure les attributs de la table référencée dans la dimension (CategoryName, Description dans dim_product)
5. **dim_date OBLIGATOIRE** avec hiérarchie complète
6. **SCD Type 2** sur chaque dimension : valid_from DATE, valid_to DATE, is_current BIT

## Pour le domaine métier en cours :
- Analyse les noms des tables pour déduire le domaine cible (Santé, Finance, E-commerce, Logistique, RH, etc.).
- La table de faits doit avoir un nom pertinent lié aux transactions principales (ex: fact_consultations, fact_paie, fact_stock, fact_sales).
- Les dimensions doivent avoir un nom générique lié à l'entité (ex: dim_patient, dim_medecin, dim_employee, dim_product, dim_branch).
- Identifie les métriques logiques (montants, quantités, durée, scores) respectives du domaine pour les inclure dans la table de faits.
- Si pertinent, ajoute des métriques calculées logiques (ex: montant_total, cout_net, anciennete, etc.).

## Règles strictes :
- Préfixe fact_ pour la table de faits
- Préfixe dim_ pour les dimensions
- Surrogate key suffixe _sk, type BIGINT IDENTITY(1,1)
- Pas de FK physiques sur la fact_ (INDEX seulement)
- natural_key de la source doit rester dans chaque dimension

## FORMAT JSON OBLIGATOIRE (pur, sans markdown). CECI EST UN TEMPLATE GÉNÉRIQUE :
{{
  "fact_table": {{
    "name": "fact_<domaine>",
    "description": "Ligne de fait — grain transaction",
    "source_tables": ["HeaderTable", "DetailTable"],
    "columns": [
      {{"name": "fact_sk", "type": "BIGINT IDENTITY(1,1)", "role": "pk"}},
      {{"name": "date_sk", "type": "BIGINT", "role": "fk", "references": "dim_date", "source_column": "DateColumn"}},
      {{"name": "entity_sk", "type": "BIGINT", "role": "fk", "references": "dim_entity", "source_column": "EntityID"}},
      {{"name": "transaction_id", "type": "INT", "role": "degenerate", "source_column": "HeaderID"}},
      {{"name": "metric_1", "type": "INT", "role": "metric", "source_column": "SourceMetric1"}},
      {{"name": "metric_calc", "type": "DECIMAL(15,4)", "role": "metric", "computed": "metric_1 * 2"}}
    ]
  }},
  "dimension_tables": [
    {{
      "name": "dim_date",
      "description": "Dimension temporelle",
      "source_tables": ["HeaderTable"],
      "source_date_column": "DateColumn",
      "columns": [
        {{"name": "date_sk", "type": "BIGINT IDENTITY(1,1)", "role": "pk"}},
        {{"name": "date_full", "type": "DATE", "role": "attribute"}},
        {{"name": "year", "type": "INT", "role": "attribute"}},
        {{"name": "month", "type": "TINYINT", "role": "attribute"}},
        {{"name": "is_weekend", "type": "BIT DEFAULT 0", "role": "attribute"}}
      ]
    }}
  ]
}}"""),
    ("human", """Voici les métadonnées complètes de la base de données source :

=== TABLES ET COLONNES ===
{metadata}

=== GRAPHE DES RELATIONS FK (table → [tables référencées]) ===
{fk_graph}

=== TOP CANDIDATS TABLE DE FAITS (scores décroissants) ===
{fact_candidates}

{drift_warning}

Génère le Star Schema Kimball optimal pour cette base OLTP. Retourne uniquement le JSON.""")
])


# ═════════════════════════════════════════════════════════════════════════════
# NŒUD PRINCIPAL
# ═════════════════════════════════════════════════════════════════════════════

def modeler_node(state: AgentState) -> dict:
    """Génère le modèle logique OLAP Star Schema et le DDL T-SQL correspondant."""
    logger.info("--- AGENT MODELER v3.0 : Star Schema Intelligence ---")

    metadata    = state.get("source_metadata", {})
    drift_warn  = ""
    if state.get("schema_drift_detected"):
        drift_warn = f"⚠️ Dérive de schéma : {state.get('schema_drift_details', '')}. Adapter le modèle."

    current_v   = state.get("logical_model_version", 0)
    previous_ddl = state.get("sql_ddl", "")
    prefix      = state.get("user_prefix", "dw")

    # ── Construire le graphe FK et les candidats fact pour le prompt ──────────
    fk_out, fk_in = _build_fk_graph(metadata)
    scores        = _score_fact_candidates(metadata, fk_out, fk_in)

    fk_graph_str = _fk_graph_to_str(fk_out)
    candidates_str = "\n".join(
        f"  {i+1}. {t} (score={s:.1f})"
        for i, (t, s) in enumerate(scores[:8])
    )

    # ── Tentative LLM ─────────────────────────────────────────────────────────
    logical_model = None
    try:
        llm   = get_llm(temperature=0.05)
        chain = MODELER_PROMPT | llm
        resp  = call_with_retry(chain, {
            "metadata":       _metadata_summary(metadata),
            "fk_graph":       fk_graph_str,
            "fact_candidates": candidates_str,
            "drift_warning":  drift_warn,
        })
        raw = extract_text(resp)
        logical_model = _parse_json(raw)
        if logical_model:
            logger.info("[Modeler] ✅ Star Schema généré via LLM")
        else:
            logger.warning("[Modeler] ⚠️ JSON LLM invalide — bascule sur algorithme intelligent")
    except Exception as e:
        logger.warning(f"[Modeler] ⚠️ LLM indisponible ({type(e).__name__}) — algorithme intelligent")

    # ── Fallback : algorithme intelligent ────────────────────────────────────
    if not logical_model:
        if metadata:
            logical_model = _build_star_from_relational(metadata, fk_out, fk_in, scores)
            logger.info(
                f"[Modeler] 🤖 Star Schema auto-généré : "
                f"{len(logical_model.get('dimension_tables', []))} dimensions + 1 fact"
            )
        else:
            logical_model = _default_skeleton_model()
            logger.info("[Modeler] 🦴 Skeleton model (aucune métadonnée)")

    # ── Générer le DDL T-SQL ─────────────────────────────────────────────────
    sql_ddl = _generate_ddl(logical_model, prefix)

    logger.info(
        f"[Modeler] Modèle v{current_v + 1} — "
        f"{len(logical_model.get('dimension_tables', []))} dimensions + 1 table de faits"
    )

    return {
        "logical_model":         logical_model,
        "logical_model_version": current_v + 1,
        "previous_sql_ddl":      previous_ddl,
        "sql_ddl":               sql_ddl,
        "execution_log": state.get("execution_log", []) + [
            f"[Modeler] ✅ Star Schema v{current_v+1} — "
            f"{len(logical_model.get('dimension_tables', []))} dimensions"
        ],
    }


# ═════════════════════════════════════════════════════════════════════════════
# GRAPHE FK
# ═════════════════════════════════════════════════════════════════════════════

def _build_fk_graph(metadata: dict) -> Tuple[Dict, Dict]:
    """
    Construit les deux index FK :
      fk_out[table] = [{constrained_columns, referred_table, referred_columns}, ...]
      fk_in[table]  = [table_qui_pointe_vers_moi, ...]
    """
    fk_out: Dict[str, List[dict]] = {}
    fk_in:  Dict[str, List[str]]  = {}

    for table, info in metadata.items():
        if not isinstance(info, dict):
            continue

        # FK déjà extraites par l'explorer (inspecteur SQLAlchemy)
        fks = info.get("foreign_keys", [])

        # Sinon, inférence heuristique depuis les noms de colonnes
        if not fks:
            fks = _infer_fks_from_names(table, info, metadata)

        fk_out[table] = fks
        for fk in fks:
            ref = fk.get("referred_table", "")
            if ref and ref != table:   # ignorer self-joins
                fk_in.setdefault(ref, [])
                if table not in fk_in[ref]:
                    fk_in[ref].append(table)

    return fk_out, fk_in


def _infer_fks_from_names(table_name: str, info: dict, all_meta: dict) -> List[dict]:
    """
    Heuristique : colonne CustomerID → cherche table Customers ou Customer.
    Couvre les bases sans FK définies (CSV, DB legacy).
    """
    fks = []
    lower_tables = {t.lower(): t for t in all_meta.keys()}

    for col in info.get("columns", []):
        name = col.get("name", "")
        if not _is_id(name):
            continue
        # Extraire l'entité : "CustomerID" → "customer"
        m = re.match(r'^(.+?)_?id$', name.lower())
        if not m:
            continue
        entity = m.group(1).rstrip("_")

        for candidate in [entity, entity + "s", entity + "es"]:
            actual = lower_tables.get(candidate)
            if actual and actual != table_name:
                fks.append({
                    "constrained_columns": [name],
                    "referred_table": actual,
                    "referred_columns": [name],
                    "inferred": True,
                })
                break

    return fks


def _fk_graph_to_str(fk_out: dict) -> str:
    """Format lisible du graphe FK pour le prompt LLM."""
    lines = []
    for table, fks in fk_out.items():
        if fks:
            refs = ", ".join(
                f"{fk.get('constrained_columns',['?'])[0]} → {fk.get('referred_table','?')}"
                for fk in fks
            )
            lines.append(f"  {table}: [{refs}]")
    return "\n".join(lines) or "  (aucune FK détectée)"


def _metadata_summary(metadata: dict) -> str:
    """Résumé compact des métadonnées pour le prompt LLM."""
    lines = []
    for table, info in metadata.items():
        if not isinstance(info, dict):
            continue
        cols = info.get("columns", [])
        rows = info.get("row_count", 0)
        col_names = [f"{c.get('name')}({_norm(c.get('dtype', c.get('type', 'str')))})"
                     for c in cols[:20]]
        lines.append(f"\n[{table}] {rows} lignes, {len(cols)} colonnes:")
        lines.append("  " + ", ".join(col_names))
    return "\n".join(lines)


# ═════════════════════════════════════════════════════════════════════════════
# SCORING
# ═════════════════════════════════════════════════════════════════════════════

def _score_fact_candidates(
    metadata: dict, fk_out: dict, fk_in: dict
) -> List[Tuple[str, float]]:
    """
    Score chaque table comme candidat à la table de faits.

    Facteurs POSITIFS :
      - Nombre de FK sortantes directes (pointe vers des dimensions)
      - FK transitives (header/detail pattern : A→B→{C,D,E} donne bonus à A)
      - Nombre de colonnes métriques (numériques, non-IDs)
      - Nombre de lignes (la table de faits est souvent la plus peuplée)

    Facteurs NÉGATIFS :
      - Table de jonction pure (2 FKs, ≤2 autres colonnes, 0 mesures)
      - Table lookup/référence (reçoit des FK de tables bien plus peuplées)
      - Table en-tête qui a un détail plus granulaire (Orders vs OrderDetails)
    """
    scores = []

    all_rows = {t: info.get("row_count", 0)
                for t, info in metadata.items() if isinstance(info, dict)}
    max_rows = max(all_rows.values(), default=1) or 1

    for table, info in metadata.items():
        if not isinstance(info, dict):
            continue

        cols      = info.get("columns", [])
        rows      = info.get("row_count", 0)
        fks       = fk_out.get(table, [])
        refs_by   = fk_in.get(table, [])

        # Noms des colonnes FK (pour les exclure du décompte des métriques)
        fk_col_names = {
            c.lower()
            for fk in fks
            for c in fk.get("constrained_columns", [])
        }

        # Métriques = numériques non-IDs non-FK
        metrics = [
            c for c in cols
            if _is_num(c.get("dtype", c.get("type", "")))
            and not _is_id(c.get("name", ""))
            and c.get("name", "").lower() not in fk_col_names
        ]

        # Dates (directes ou transitives via header)
        date_cols = [
            c for c in cols
            if _is_dt(c.get("dtype", c.get("type", "")), c.get("name", ""))
        ]

        n_fk_out  = len(fks)
        n_metrics = len(metrics)
        n_dates   = len(date_cols)
        n_total   = len(cols)

        # ── Bonus FK transitives (Header/Detail pattern) ────────────────────
        # Si table A → table B, et B a lui-même N FK sortantes vers d'autres
        # tables, alors A hérite de ces N FK "transitives" avec un bonus.
        # Ex: OrderDetails → Orders → {Customers, Employees, Shippers}
        #     OrderDetails obtient +3 FK transitives
        n_transitive_fk = 0
        n_transitive_dates = 0
        n_transitive_metrics = 0
        for fk in fks:
            ref_table = fk.get("referred_table", "")
            if not ref_table or ref_table == table:
                continue
            ref_fks = fk_out.get(ref_table, [])
            # Le header a lui-même des FK → c'est un header transactionnel
            if len(ref_fks) >= 2:
                n_transitive_fk += len(ref_fks)
                # Compter les dates et métriques du header aussi
                ref_info = metadata.get(ref_table, {})
                for c in ref_info.get("columns", []):
                    cn = c.get("name", "")
                    dt = c.get("dtype", c.get("type", ""))
                    if _is_dt(dt, cn):
                        n_transitive_dates += 1
                    elif _is_num(dt) and not _is_id(cn):
                        n_transitive_metrics += 1

        # Score de base
        score = (
            n_fk_out  * 3.0
            + n_transitive_fk * 3.5     # bonus header/detail
            + n_metrics * 4.0
            + n_transitive_metrics * 2.0  # métriques du header
            + n_dates   * 1.5
            + n_transitive_dates * 1.0   # dates du header
            + math.log2(rows + 2) * 1.2  # poids augmenté pour row count
        )

        # ── Pénalité : table de jonction pure ──────────────────────────────
        n_non_fk = n_total - len(fk_col_names)
        if n_fk_out >= 2 and n_non_fk <= 2 and n_metrics == 0:
            score *= 0.05

        # ── Pénalité : table de référence / lookup ──────────────────────────
        # Si des tables avec beaucoup plus de lignes pointent vers moi → je suis une dim
        if refs_by:
            max_referencing_rows = max(all_rows.get(r, 0) for r in refs_by)
            ratio = max_referencing_rows / max(rows, 1)
            if ratio >= 2:
                score *= 0.12   # très probablement une dimension

        # ── Pénalité : table en-tête avec un détail plus granulaire ─────────
        # Si une table qui me référence (fk_in) a elle-même des métriques
        # ET plus de lignes que moi, je suis l'en-tête, pas le fait
        for child in refs_by:
            child_rows = all_rows.get(child, 0)
            child_info = metadata.get(child, {})
            child_fk_names = {
                c2.lower() for fk2 in fk_out.get(child, [])
                for c2 in fk2.get("constrained_columns", [])
            }
            child_metrics = [
                c for c in child_info.get("columns", [])
                if _is_num(c.get("dtype", c.get("type", "")))
                and not _is_id(c.get("name", ""))
                and c.get("name", "").lower() not in child_fk_names
            ]
            if child_rows > rows and len(child_metrics) >= 2:
                # Je suis l'en-tête d'un détail → pénaliser fortement
                score *= 0.25
                logger.debug(
                    f"[Modeler] Penalite header: {table} (en-tete de {child})"
                )
                break

        scores.append((table, round(score, 2)))

    scores.sort(key=lambda x: x[1], reverse=True)
    logger.debug(f"[Modeler] Scores fact : {scores[:8]}")
    return scores


# ═════════════════════════════════════════════════════════════════════════════
# CONSTRUCTEUR PRINCIPAL DU STAR SCHEMA
# ═════════════════════════════════════════════════════════════════════════════

def _build_star_from_relational(
    metadata: dict,
    fk_out: dict,
    fk_in: dict,
    scores: List[Tuple[str, float]],
) -> dict:
    """
    Construit automatiquement le Star Schema depuis une base relationnelle.

    Algorithme :
    1. Sélectionner la meilleure table de faits (score #1)
    2. Détecter le pattern header/détail et fusionner
    3. Collecter toutes les FK vers dimensions
    4. Construire chaque dimension avec aplatissement snowflake
    5. Ajouter dim_date systématiquement
    """
    if not scores:
        return _default_skeleton_model()

    # ── 1. Sélection de la table de faits ────────────────────────────────────
    best_fact, _ = scores[0]
    fact_info    = metadata.get(best_fact, {})

    # ── 2. Détection du pattern Header / Détail ──────────────────────────────
    # ex: OrderDetails → Orders (Orders est le "header" qui a Customer, Employee, ShipVia)
    header_table = None
    for fk in fk_out.get(best_fact, []):
        ref = fk.get("referred_table", "")
        if not ref or ref == best_fact:
            continue
        ref_fks = fk_out.get(ref, [])
        ref_info = metadata.get(ref, {})
        # Le header a lui-même des FK sortantes (vers Client, Employé, etc.)
        if len(ref_fks) >= 2:
            header_table = ref
            header_info  = ref_info
            logger.info(
                f"[Modeler] Pattern Header/Détail : "
                f"{best_fact} (détail) ← {header_table} (en-tête)"
            )
            break

    # ── 3. Collecter toutes les FK fait + header ──────────────────────────────
    all_fact_fks = list(fk_out.get(best_fact, []))
    if header_table:
        all_fact_fks += fk_out.get(header_table, [])

    # Dédupliquer (une seule FK par table référencée, exclure self/header)
    seen_refs, unique_fks = set(), []
    exclude = {best_fact, header_table} if header_table else {best_fact}
    for fk in all_fact_fks:
        ref = fk.get("referred_table", "")
        if ref and ref not in seen_refs and ref not in exclude:
            seen_refs.add(ref)
            unique_fks.append(fk)

    # ── 4. Construire la table de faits ──────────────────────────────────────
    fact_table = _build_fact_table(
        best_fact, fact_info,
        header_table, metadata.get(header_table, {}) if header_table else {},
        unique_fks, fk_out, metadata,
    )

    # ── 5. Construire les dimensions ─────────────────────────────────────────
    dim_tables     = [_build_dim_date(metadata, header_table or best_fact)]
    already_dimmed = {"dim_date"}

    for fk in unique_fks:
        ref_table = fk.get("referred_table", "")
        dim_name  = f"dim_{_to_dim_name(ref_table)}"
        if dim_name in already_dimmed:
            continue
        already_dimmed.add(dim_name)

        ref_info = metadata.get(ref_table, {})
        if not ref_info:
            continue

        # Aplatir le snowflake (ex: Products → Categories, Suppliers)
        snow_fks = [
            f for f in fk_out.get(ref_table, [])
            if f.get("referred_table", "") not in exclude
            and f.get("referred_table", "") != ref_table
        ]

        dim = _build_dim(dim_name, ref_table, ref_info, snow_fks, metadata)
        dim_tables.append(dim)

    return {
        "fact_table": fact_table,
        "dimension_tables": dim_tables,
    }


# ═════════════════════════════════════════════════════════════════════════════
# CONSTRUCTEURS DES TABLES
# ═════════════════════════════════════════════════════════════════════════════

def _build_fact_table(
    fact_name: str,
    fact_info: dict,
    header_name: Optional[str],
    header_info: dict,
    dim_fks: List[dict],
    fk_out: dict,
    metadata: dict,
) -> dict:
    """Construit la définition de la table de faits."""
    safe_name = re.sub(r'\W+', '_', fact_name.lower())
    fact_sk   = f"{safe_name}_sk"

    columns = [{"name": fact_sk, "type": "BIGINT IDENTITY(1,1)", "role": "pk"}]

    # FK vers dim_date (depuis les colonnes date du header ou de la fact)
    date_src_table = header_name or fact_name
    date_src_info  = header_info if header_name else fact_info
    date_col       = _find_date_col(date_src_info.get("columns", []))
    if date_col:
        columns.append({
            "name": "date_sk", "type": "BIGINT", "role": "fk",
            "references": "dim_date",
            "source_table": date_src_table,
            "source_column": date_col,
        })

    # FK vers chaque dimension
    for fk in dim_fks:
        ref   = fk.get("referred_table", "")
        fk_cols = fk.get("constrained_columns", [])
        dim_name  = f"dim_{_to_dim_name(ref)}"
        sk_name   = f"{_to_dim_name(ref)}_sk"
        src_col   = fk_cols[0] if fk_cols else ref
        src_table = header_name if (header_name and _col_in_table(src_col, header_info)) else fact_name

        columns.append({
            "name": sk_name, "type": "BIGINT", "role": "fk",
            "references": dim_name,
            "source_table": src_table,
            "source_column": src_col,
        })

    # Dimension dégénérée : clé naturelle de l'en-tête (ex: OrderID)
    if header_name:
        header_pk = _find_pk_col(header_info.get("columns", []), header_name)
        if header_pk:
            columns.append({
                "name": header_pk.lower(),
                "type": "INT",
                "role": "degenerate",
                "source_table": header_name,
                "source_column": header_pk,
            })

    # Métriques de la fact table
    fk_col_names = {
        c.lower()
        for fk in fk_out.get(fact_name, [])
        for c in fk.get("constrained_columns", [])
    }
    for col in fact_info.get("columns", []):
        cname = col.get("name", "")
        dtype = col.get("dtype", col.get("type", ""))
        if _is_id(cname) or cname.lower() in fk_col_names:
            continue
        if _is_dt(dtype, cname):
            continue
        if _is_num(dtype):
            tsql = "INT" if any(x in _norm(dtype) for x in ("int", "tinyint", "smallint")) else "DECIMAL(15,4)"
            columns.append({
                "name": cname.lower().replace(" ", "_"),
                "type": tsql,
                "role": "metric",
                "source_table": fact_name,
                "source_column": cname,
            })

    # Métriques supplémentaires de l'en-tête (ex: Freight depuis Orders)
    if header_name and header_info:
        header_fk_cols = {
            c.lower()
            for fk in fk_out.get(header_name, [])
            for c in fk.get("constrained_columns", [])
        }
        for col in header_info.get("columns", []):
            cname = col.get("name", "")
            dtype = col.get("dtype", col.get("type", ""))
            if _is_id(cname) or cname.lower() in header_fk_cols:
                continue
            if _is_dt(dtype, cname):
                continue
            if _is_num(dtype):
                tsql = "INT" if any(x in _norm(dtype) for x in ("int", "tinyint")) else "DECIMAL(15,4)"
                # Ne pas dupliquer
                if not any(c.get("source_column") == cname for c in columns):
                    columns.append({
                        "name": cname.lower().replace(" ", "_"),
                        "type": tsql,
                        "role": "metric",
                        "source_table": header_name,
                        "source_column": cname,
                    })

    # Métriques calculées — détection flexible des noms
    metric_names = {c["name"] for c in columns if c.get("role") == "metric"}
    metric_names_flat = {n.replace("_", "") for n in metric_names}  # unitprice == unit_price
    has_qty   = "quantity" in metric_names_flat or any("quantit" in n for n in metric_names)
    has_price = "unitprice" in metric_names_flat or any("price" in n for n in metric_names)
    has_disc  = "discount" in metric_names_flat or any("discount" in n for n in metric_names)
    has_freight = "freight" in metric_names_flat or any("freight" in n for n in metric_names)

    # Trouver les noms réels des colonnes pour la formule
    qty_col   = next((n for n in metric_names if "quantit" in n.lower()), "quantity")
    price_col = next((n for n in metric_names if "price" in n.lower() or "prix" in n.lower()), "unitprice")
    disc_col  = next((n for n in metric_names if "discount" in n.lower() or "remise" in n.lower()), "discount")
    frt_col   = next((n for n in metric_names if "freight" in n.lower() or "frais" in n.lower()), "freight")

    if has_qty and has_price and has_disc:
        columns.append({
            "name": "sales_amount",
            "type": "DECIMAL(15,4)",
            "role": "metric",
            "computed": f"{qty_col} * {price_col} * (1 - {disc_col})",
        })
        if has_freight:
            columns.append({
                "name": "net_amount",
                "type": "DECIMAL(15,4)",
                "role": "metric",
                "computed": f"sales_amount - {frt_col}",
            })

    src_tables = [fact_name] if not header_name else [header_name, fact_name]
    
    clean_name = fact_name.lower().replace(" ", "_").replace("details", "").strip("_")
    if header_name:
        clean_name = header_name.lower().replace(" ", "_").replace("details", "").strip("_")
        
    return {
        "name": f"fact_{clean_name}",
        "description": f"Table de faits centrale ({', '.join(src_tables)})",
        "source_tables": src_tables,
        "columns": columns,
    }


def _build_dim(
    dim_name: str,
    src_table: str,
    src_info: dict,
    snowflake_fks: List[dict],
    metadata: dict,
) -> dict:
    """Construit une table de dimension avec aplatissement snowflake."""
    entity    = dim_name.replace("dim_", "")
    sk_name   = f"{entity}_sk"
    nat_key   = _find_pk_col(src_info.get("columns", []), src_table)

    cols = [{"name": sk_name, "type": "BIGINT IDENTITY(1,1)", "role": "pk"}]

    # Clé naturelle
    if nat_key:
        cols.append({
            "name": nat_key.lower(),
            "type": "NVARCHAR(50)",
            "role": "attribute",
            "natural_key": True,
            "source_table": src_table,
        })

    # Attributs de la table source
    fk_col_names = {
        c.lower()
        for fk in snowflake_fks
        for c in fk.get("constrained_columns", [])
    }
    for col in src_info.get("columns", []):
        cname = col.get("name", "")
        dtype = col.get("dtype", col.get("type", ""))
        if cname == nat_key:
            continue
        if _is_id(cname) and cname.lower() in fk_col_names:
            continue  # FK snowflake → on va aplatir
        tsql = _to_tsql(dtype, cname)
        cols.append({
            "name": cname.lower().replace(" ", "_"),
            "type": tsql,
            "role": "attribute",
            "source_table": src_table,
        })

    # Aplatissement snowflake : inclure les attributs des tables référencées
    for snow_fk in snowflake_fks:
        snow_ref   = snow_fk.get("referred_table", "")
        snow_info  = metadata.get(snow_ref, {})
        snow_pk    = _find_pk_col(snow_info.get("columns", []), snow_ref)
        snow_prefix = _to_dim_name(snow_ref)

        for col in snow_info.get("columns", []):
            cname = col.get("name", "")
            dtype = col.get("dtype", col.get("type", ""))
            if cname == snow_pk or _is_id(cname):
                continue
            snowflake_col_name = f"{snow_prefix}_{cname.lower().replace(' ', '_')}"
            tsql = _to_tsql(dtype, cname)
            cols.append({
                "name": snowflake_col_name,
                "type": tsql,
                "role": "attribute",
                "source_table": snow_ref,
                "source_column": cname,
            })

    # SCD Type 2
    cols += [
        {"name": "valid_from",  "type": "DATE",        "role": "attribute"},
        {"name": "valid_to",    "type": "DATE",        "role": "attribute"},
        {"name": "is_current",  "type": "BIT DEFAULT 1", "role": "attribute"},
    ]

    snow_tables = [f.get("referred_table", "") for f in snowflake_fks]
    return {
        "name": dim_name,
        "description": f"Dimension {entity} (source : {src_table}" +
                       (f" + {', '.join(snow_tables)}" if snow_tables else "") + ")",
        "source_tables": [src_table] + snow_tables,
        "natural_key": nat_key or entity + "_id",
        "scd_type": 2,
        "columns": cols,
    }


def _build_dim_date(metadata: dict, src_table: str = "") -> dict:
    """Construit la dimension Date standard avec hiérarchie complète."""
    return {
        "name": "dim_date",
        "description": "Dimension temporelle — hiérarchie Year > Semester > Quarter > Month > Week > Day",
        "source_tables": [src_table] if src_table else [],
        "columns": [
            {"name": "date_sk",        "type": "BIGINT IDENTITY(1,1)", "role": "pk"},
            {"name": "date_full",      "type": "DATE",        "role": "attribute"},
            {"name": "year",           "type": "INT",         "role": "attribute"},
            {"name": "semester",       "type": "TINYINT",     "role": "attribute"},
            {"name": "quarter",        "type": "TINYINT",     "role": "attribute"},
            {"name": "month",          "type": "TINYINT",     "role": "attribute"},
            {"name": "month_name",     "type": "VARCHAR(20)", "role": "attribute"},
            {"name": "week",           "type": "TINYINT",     "role": "attribute"},
            {"name": "day",            "type": "TINYINT",     "role": "attribute"},
            {"name": "day_of_week",    "type": "TINYINT",     "role": "attribute"},
            {"name": "day_name",       "type": "VARCHAR(20)", "role": "attribute"},
            {"name": "is_weekend",     "type": "BIT DEFAULT 0", "role": "attribute"},
            {"name": "is_month_start", "type": "BIT DEFAULT 0", "role": "attribute"},
            {"name": "is_month_end",   "type": "BIT DEFAULT 0", "role": "attribute"},
        ],
    }


# ═════════════════════════════════════════════════════════════════════════════
# UTILITAIRES
# ═════════════════════════════════════════════════════════════════════════════

def _to_dim_name(table: str) -> str:
    """Customers → customer, OrderDetails → order_details"""
    t = re.sub(r'([A-Z])', r'_\1', table).lower().strip("_")
    # Singulariser les pluriels courants
    if t.endswith("ies"):
        t = t[:-3] + "y"
    elif t.endswith("sses") or t.endswith("xes"):
        t = t[:-2]
    elif t.endswith("s") and not t.endswith("ss"):
        t = t[:-1]
    return re.sub(r'_+', '_', t).strip("_")


def _find_pk_col(columns: List[dict], table_name: str) -> Optional[str]:
    """Cherche la colonne PK (clé naturelle) d'une table."""
    table_lower = table_name.lower().rstrip("s").rstrip("e")
    # 1. Clé qui correspond au nom de la table
    for col in columns:
        cname = col.get("name", "")
        if _is_id(cname) and table_lower in cname.lower():
            return cname
    # 2. Première colonne ID
    for col in columns:
        if _is_id(col.get("name", "")):
            return col.get("name")
    # 3. Première colonne
    return columns[0].get("name") if columns else None


def _find_date_col(columns: List[dict]) -> Optional[str]:
    """Cherche la première colonne de date (OrderDate, Date, etc.)."""
    for col in columns:
        n = col.get("name", "")
        d = col.get("dtype", col.get("type", ""))
        if _is_dt(d, n) and "date" in n.lower():
            return n
    for col in columns:
        n = col.get("name", "")
        d = col.get("dtype", col.get("type", ""))
        if _is_dt(d, n):
            return n
    return None


def _col_in_table(col_name: str, table_info: dict) -> bool:
    """Vérifie si une colonne est présente dans une table."""
    return any(
        c.get("name", "").lower() == col_name.lower()
        for c in table_info.get("columns", [])
    )


# ═════════════════════════════════════════════════════════════════════════════
# MODÈLE PAR DÉFAUT (skeleton)
# ═════════════════════════════════════════════════════════════════════════════

def _default_skeleton_model() -> dict:
    return {
        "fact_table": {
            "name": "fact_transactions",
            "description": "Table de faits centrale (schéma squelette — aucune métadonnée disponible)",
            "source_tables": [],
            "columns": [
                {"name": "transaction_sk", "type": "BIGINT IDENTITY(1,1)", "role": "pk"},
                {"name": "date_sk",        "type": "BIGINT", "role": "fk", "references": "dim_date"},
                {"name": "entity_sk",      "type": "BIGINT", "role": "fk", "references": "dim_entity"},
                {"name": "amount",         "type": "DECIMAL(15,4)", "role": "metric"},
                {"name": "quantity",       "type": "INT",     "role": "metric"},
            ],
        },
        "dimension_tables": [
            {
                "name": "dim_date",
                "description": "Dimension temporelle",
                "columns": [
                    {"name": "date_sk",    "type": "BIGINT IDENTITY(1,1)", "role": "pk"},
                    {"name": "date_full",  "type": "DATE",    "role": "attribute"},
                    {"name": "year",       "type": "INT",     "role": "attribute"},
                    {"name": "semester",   "type": "TINYINT", "role": "attribute"},
                    {"name": "quarter",    "type": "TINYINT", "role": "attribute"},
                    {"name": "month",      "type": "TINYINT", "role": "attribute"},
                    {"name": "week",       "type": "TINYINT", "role": "attribute"},
                    {"name": "day",        "type": "TINYINT", "role": "attribute"},
                    {"name": "day_name",   "type": "VARCHAR(20)", "role": "attribute"},
                ],
            },
            {
                "name": "dim_entity",
                "description": "Dimension principale",
                "natural_key": "entity_id",
                "scd_type": 2,
                "columns": [
                    {"name": "entity_sk",    "type": "BIGINT IDENTITY(1,1)", "role": "pk"},
                    {"name": "entity_id",    "type": "INT",          "role": "attribute", "natural_key": True},
                    {"name": "entity_name",  "type": "NVARCHAR(255)", "role": "attribute"},
                    {"name": "category",     "type": "NVARCHAR(100)", "role": "attribute"},
                    {"name": "valid_from",   "type": "DATE",          "role": "attribute"},
                    {"name": "valid_to",     "type": "DATE",          "role": "attribute"},
                    {"name": "is_current",   "type": "BIT DEFAULT 1", "role": "attribute"},
                ],
            }
        ],
    }


# ═════════════════════════════════════════════════════════════════════════════
# PARSING JSON LLM
# ═════════════════════════════════════════════════════════════════════════════

def _parse_json(raw: str) -> dict:
    """Extrait le JSON du modèle depuis la réponse LLM."""
    cleaned = re.sub(r"```(?:json)?\n?", "", raw).strip().rstrip("`")
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]+\}", cleaned)
        if m:
            try:
                return json.loads(m.group())
            except Exception:
                pass
    return {}


# ═════════════════════════════════════════════════════════════════════════════
# GÉNÉRATION DDL T-SQL
# ═════════════════════════════════════════════════════════════════════════════

def _generate_ddl(model: dict, prefix: str = "dw") -> str:
    """Génère le DDL T-SQL complet (SQL Server) depuis le modèle logique."""
    lines = [
        "-- ============================================================",
        "-- Data Warehouse DDL — Star Schema Kimball (T-SQL / SQL Server)",
        f"-- Préfixe : {prefix}",
        "-- ============================================================\n",
    ]

    def _col_def(col: dict) -> str:
        name  = col.get("name", "col")
        ctype = col.get("type", "NVARCHAR(255)")
        role  = col.get("role", "attribute")
        # Nettoyage type MySQL → T-SQL
        ctype = ctype.replace("AUTO_INCREMENT", "").strip()
        ctype = ctype.replace("TINYINT(1)", "BIT")
        parts = [f"[{name}] {ctype}"]
        if role == "pk":
            parts.append("PRIMARY KEY")
        return " ".join(parts)

    # ── Dimensions d'abord ───────────────────────────────────────────────────
    for dim in model.get("dimension_tables", []):
        tname  = f"{prefix}_{dim['name']}"
        cols   = [_col_def(c) for c in dim.get("columns", [])]
        source = ", ".join(dim.get("source_tables", [])) or dim["name"]

        lines.append(f"-- Dimension : {dim['name']} (source : {source})")
        lines.append(f"IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '{tname}')")
        lines.append(f"CREATE TABLE [{tname}] (")
        lines.append(",\n".join(f"  {c}" for c in cols))
        lines.append(");\n")

    # ── Table de faits ────────────────────────────────────────────────────────
    fact = model.get("fact_table", {})
    if fact:
        tname  = f"{prefix}_{fact['name']}"
        cols   = [_col_def(c) for c in fact.get("columns", []) if c.get("role") != "computed"]
        source = ", ".join(fact.get("source_tables", [])) or fact["name"]

        lines.append(f"-- Fait : {fact['name']} (source : {source})")
        lines.append(f"IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '{tname}')")
        lines.append(f"CREATE TABLE [{tname}] (")
        lines.append(",\n".join(f"  {c}" for c in cols))
        lines.append(");\n")

        # Index sur les FK (T-SQL ne supporte pas INDEX inline)
        fk_cols = [c["name"] for c in fact.get("columns", []) if c.get("role") == "fk"]
        for fk_col in fk_cols:
            idx = f"idx_{fact['name']}_{fk_col}"
            lines.append(
                f"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='{idx}' "
                f"AND object_id=OBJECT_ID('{tname}'))"
            )
            lines.append(f"CREATE NONCLUSTERED INDEX [{idx}] ON [{tname}] ([{fk_col}]);\n")

    return "\n".join(lines)
