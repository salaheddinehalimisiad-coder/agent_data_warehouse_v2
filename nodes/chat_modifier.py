# nodes/chat_modifier.py - Agent Chat Modifier v4.0 (Patch operations + Blaze strict)
"""v4.0 :
- Blaze GLM-5 force (jamais Ollama/Fake) pour la qualite de generation.
- L'LLM produit une LISTE D'OPERATIONS ATOMIQUES (JSON Patch-like) au lieu
  de regenerer tout le modele -> 10x moins de tokens, 100x plus fiable.
- Le fallback deterministe ne se declenche QUE sur les demandes courtes
  et explicites (<150 chars + mot-cles 'colonne'/'column' obligatoires).
- Les demandes complexes (>150 chars OU plusieurs verbes d'action) vont
  TOUJOURS au LLM et NE retombent PAS sur la regex.
"""
import copy
import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from app_state import AgentState
from langchain_core.prompts import ChatPromptTemplate

from nodes.llm_factory import call_with_retry, extract_text, get_llm, get_llm_strict, get_human_review_llm
from nodes.modeler import _generate_ddl, _parse_json

logger = logging.getLogger(__name__)


# Prompt LLM en mode "operations atomiques" (PATCH)
PATCH_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """Tu es un Architecte Data Warehouse Senior, expert Kimball.
L'utilisateur veut modifier le schema en etoile suivant. Au lieu de reecrire
tout le modele, tu vas produire une LISTE d'operations atomiques au format
JSON, dans l'ordre d'application.

Modele OLAP courant (version {model_version}) :
```json
{current_model}
```

DDL T-SQL courant (extrait pour reference) :
```sql
{current_ddl_excerpt}
```

# Operations supportees (toutes optionnelles, combinables) :

1. ADD_COLUMN
{{
  "op": "add_column",
  "table": "fact_orders",            // ou "dim_product", etc.
  "column": {{
    "name": "net_amount",
    "type": "DECIMAL(15,4)",
    "role": "metric",                 // pk | fk | metric | attribute | computed | degenerate
    "description": "Montant net = unitprice * quantity * (1-discount)",
    "natural_key": false              // optionnel
  }}
}}

2. DROP_COLUMN
{{ "op": "drop_column", "table": "fact_orders", "column": "freight" }}

3. RENAME_COLUMN
{{ "op": "rename_column", "table": "dim_employee", "old": "reportsto", "new": "reports_to_employee_id" }}

4. CHANGE_COLUMN_TYPE
{{ "op": "change_column_type", "table": "dim_employee", "column": "reportsto", "type": "INT" }}

5. RENAME_TABLE
{{ "op": "rename_table", "old": "dim_client", "new": "dim_customer" }}

6. ADD_TABLE  (rare, surtout dimensions junk/role-playing)
{{
  "op": "add_table",
  "kind": "dimension",                // dimension | fact
  "table": {{
    "name": "dim_date_required",
    "columns": [...],
    "scd_type": 2,
    "natural_key": "date_full"
  }}
}}

7. ADD_FK  (cles etrangeres entre fact et dim)
{{ "op": "add_fk", "table": "fact_orders", "column": "shipper_sk", "references": "dim_shipper.shipper_sk" }}

8. SPLIT_DATE_KEY  (role-playing dimensions)
{{
  "op": "split_date_key",
  "table": "fact_orders",
  "old_column": "date_sk",
  "new_columns": [
    {{ "name": "order_date_sk", "nullable": false }},
    {{ "name": "required_date_sk", "nullable": false }},
    {{ "name": "shipped_date_sk", "nullable": true }}
  ]
}}

9. NOTE  (commentaire purement informatif)
{{ "op": "note", "message": "..." }}

# Regles strictes de sortie :
- Reponds UNIQUEMENT avec un JSON de la forme :

```json
{{
  "ops": [ ... operations ... ],
  "summary": "<1 phrase resumant l'ensemble des changements>"
}}
```

- Pas de markdown autour du JSON, pas de prose hors JSON.
- Si la demande contient plusieurs points (1, 2, 3...), produis UNE operation
  par point au minimum.
- Reflechis a l'integrite : si tu renommes une colonne FK, ajuste les references.
- Pour les role-playing dims (multi-dates dans une fact), utilise SPLIT_DATE_KEY.
- Pour ajouter une mesure calculee, utilise ADD_COLUMN avec role='computed' ET
  ajoute une description de la formule dans `description`.

Demande utilisateur :
{user_request}
"""),
    ("human", "Genere le JSON des operations."),
])


def _extract_user_request(state: AgentState) -> str:
    hitl = (state.get("hitl_comment") or "").strip()
    if hitl:
        return hitl
    for msg in reversed(state.get("messages", []) or []):
        content = None
        if hasattr(msg, "type") and msg.type == "human":
            content = msg.content
        elif isinstance(msg, dict) and msg.get("role") in ("human", "user"):
            content = msg.get("content", "")
        if content and content.strip():
            text = content.strip()
            text = re.sub(r"^MODIFICATION\s+REQUEST:\s*", "", text, flags=re.IGNORECASE)
            return text
    critic = state.get("critic_review", "") or ""
    if "NEEDS_REVISION" in critic.upper():
        return "Applique toutes les corrections recommandees par le Critic."
    return ""


def _all_fact_tables(model: dict) -> List[dict]:
    if not isinstance(model, dict):
        return []
    facts = model.get("fact_tables") or []
    if not facts and model.get("fact_table"):
        facts = [model["fact_table"]]
    return [f for f in facts if isinstance(f, dict)]


def _all_dimensions(model: dict) -> List[dict]:
    return [d for d in (model.get("dimension_tables") or []) if isinstance(d, dict)]


def _all_tables(model: dict) -> List[dict]:
    return _all_fact_tables(model) + _all_dimensions(model)


def _normalize_table_name(n: str) -> str:
    """Strip common DW prefixes/suffixes and underscores to compare table names
    across naming conventions (fact_orders <-> Orders_fact <-> orders)."""
    n = str(n).lower().strip()
    n = re.sub(r"^(dim|fact|stg|stage|f|d)_+", "", n)
    n = re.sub(r"_+(dim|fact|f|d)$", "", n)
    n = n.replace("_", "")
    return n


def _find_table(model: dict, name: str) -> Optional[dict]:
    if not name:
        return None
    target = str(name).lower().strip()
    # Pass 1: exact / suffix match (legacy behavior, fast path)
    for t in _all_tables(model):
        tn = str(t.get("name", "")).lower()
        if tn == target or tn.endswith("_" + target) or tn.endswith(target):
            return t
    # Pass 2: fuzzy match on normalized base name (handles dim_/fact_ swaps,
    # singular/plural differences are caught by startswith below)
    target_norm = _normalize_table_name(target)
    if not target_norm:
        return None
    for t in _all_tables(model):
        tn_norm = _normalize_table_name(str(t.get("name", "")))
        if not tn_norm:
            continue
        if tn_norm == target_norm or tn_norm.startswith(target_norm) or target_norm.startswith(tn_norm):
            return t
    return None


def _ddl_diff(prev: str, curr: str) -> str:
    prev_lines = set(l.strip() for l in (prev or "").splitlines() if l.strip())
    curr_lines = set(l.strip() for l in (curr or "").splitlines() if l.strip())
    added = sorted(curr_lines - prev_lines)
    removed = sorted(prev_lines - curr_lines)
    if not added and not removed:
        return "Aucune ligne DDL modifiee."
    out = []
    if added:
        out.append("[+] Lignes ajoutees :")
        out.extend(f"   {l}" for l in added[:30])
        if len(added) > 30:
            out.append(f"   ... +{len(added) - 30} autres lignes")
    if removed:
        out.append("[-] Lignes supprimees :")
        out.extend(f"   {l}" for l in removed[:30])
        if len(removed) > 30:
            out.append(f"   ... +{len(removed) - 30} autres lignes")
    return "\n".join(out)


# ============================================================================
# Fallback deterministe — STRICT : exige les mots cles 'colonne' ou 'column'
# Ne se declenche que sur les demandes courtes (<150 chars) et mono-action
# ============================================================================
_RE_RENAME_TABLE = re.compile(
    r"(?:renomme|rename)[r]?\s+la\s+table\s+(\w+)\s+en\s+(\w+)",
    re.IGNORECASE,
)
_RE_RENAME_COL = re.compile(
    r"(?:renomme|rename)[r]?\s+(?:la\s+)?(?:colonne|column|champ|field)\s+(\w+)\s+en\s+(\w+)",
    re.IGNORECASE,
)
_RE_ADD_COL = re.compile(
    r"(?:ajoute|add)[r]?\s+(?:une\s+|la\s+|le\s+|a\s+)?"
    r"(?:colonne|column|champ|field)\s+(\w+)"
    r"(?:\s+(?:de\s+type|type|of\s+type)\s+([A-Za-z][A-Za-z0-9_]*(?:\([\d,\s]+\))?))?"
    r"(?:\s+(?:dans|sur|to|in)\s+(?:la\s+table\s+)?(\w+))?",
    re.IGNORECASE,
)
_RE_DROP_COL = re.compile(
    r"(?:supprime|delete|drop|enleve|retire|remove)[r]?\s+(?:la\s+)?"
    r"(?:colonne|column|champ|field)\s+(\w+)"
    r"(?:\s+(?:de|dans|from|in|sur)\s+(?:la\s+table\s+)?(\w+))?",
    re.IGNORECASE,
)


def _is_simple_single_op_request(req: str) -> bool:
    """True si la demande est courte ET mono-action ET contient un mot-cle explicite."""
    if not req or len(req) > 150:
        return False
    rl = req.lower().strip()
    # Plusieurs verbes d'action -> demande complexe -> LLM uniquement
    action_verbs = ("ajoute", "ajouter", "add ", "renomme", "rename",
                    "supprime", "drop ", "delete", "enleve", "remove",
                    "modifie", "modify", "change", "fusionne", "merge",
                    "split", "decoupe", "deplace", "convertis", "convert")
    n_actions = sum(rl.count(v) for v in action_verbs)
    if n_actions > 1:
        return False
    # Plusieurs lignes / numerotation -> demande complexe
    if rl.count("\n") > 0 or rl.count("- ") > 1 or re.search(r"\b\d\.\s", rl):
        return False
    # Doit contenir un mot-cle qui declenche la regex ET un verbe simple
    has_keyword = any(k in rl for k in ("colonne", "column", "champ", "field", "table"))
    has_simple_verb = any(rl.startswith(v) or f" {v}" in rl[:30]
                          for v in ("ajoute", "renomme", "supprime", "add ", "rename", "drop "))
    return has_keyword and has_simple_verb


def _deterministic_modify(model: dict, request: str) -> Tuple[Optional[dict], str]:
    if not request or not isinstance(model, dict):
        return None, ""
    if not _is_simple_single_op_request(request):
        # Demande complexe : on refuse le fallback regex pour eviter les degats
        return None, ""

    new_model = copy.deepcopy(model)
    rl = request.lower().strip()

    m = _RE_RENAME_TABLE.search(rl)
    if m:
        old_name, new_name = m.group(1), m.group(2)
        for t in _all_tables(new_model):
            tn = str(t.get("name", "")).lower()
            if tn == old_name or tn.endswith("_" + old_name):
                t["name"] = new_name
                return new_model, f"Table '{old_name}' renommee en '{new_name}'."

    m = _RE_RENAME_COL.search(rl)
    if m:
        old_col, new_col = m.group(1), m.group(2)
        for t in _all_tables(new_model):
            for col in t.get("columns", []) or []:
                if str(col.get("name", "")).lower() == old_col:
                    col["name"] = new_col
                    return new_model, (
                        f"Colonne '{old_col}' renommee en '{new_col}' dans '{t.get('name')}'."
                    )

    m = _RE_ADD_COL.search(rl)
    if m:
        col_name = m.group(1)
        col_type = (m.group(2) or "NVARCHAR(255)").upper().replace(" ", "")
        target_table = m.group(3)
        target = _find_table(new_model, target_table) if target_table else None
        if target is None:
            facts = _all_fact_tables(new_model)
            dims = _all_dimensions(new_model)
            target = facts[0] if facts else (dims[0] if dims else None)
        if target is not None:
            kw = ("total", "montant", "amount", "qty", "quantity",
                  "cout", "cost", "price", "prix", "freight", "tax", "tva")
            role = "metric" if any(k in col_name.lower() for k in kw) else "attribute"
            target.setdefault("columns", []).append({
                "name": col_name, "type": col_type, "role": role,
                "description": f"Ajoute via Human Review : {request[:120]}",
            })
            return new_model, f"Colonne '{col_name}' ({col_type}) ajoutee a '{target.get('name')}'."

    m = _RE_DROP_COL.search(rl)
    if m:
        col_to_drop = m.group(1)
        target_table = m.group(2)
        for t in _all_tables(new_model):
            if target_table and str(t.get("name", "")).lower() not in (target_table, target_table + "s"):
                continue
            cols = t.get("columns", []) or []
            new_cols = [c for c in cols if str(c.get("name", "")).lower() != col_to_drop]
            if len(new_cols) != len(cols):
                t["columns"] = new_cols
                return new_model, f"Colonne '{col_to_drop}' supprimee de '{t.get('name')}'."

    return None, ""


# ============================================================================
# Application des operations LLM (patch operations) sur le modele logique
# ============================================================================
def _apply_ops(model: dict, ops: List[dict]) -> Tuple[dict, List[str]]:
    """Applique une liste d'operations atomiques sur le modele. Retourne le
    nouveau modele + un log d'application par operation."""
    new_model = copy.deepcopy(model)
    log: List[str] = []

    def fail(msg: str):
        log.append(f"  [!] {msg}")

    def ok(msg: str):
        log.append(f"  [+] {msg}")

    for i, op in enumerate(ops, 1):
        if not isinstance(op, dict):
            fail(f"Op#{i} ignoree (pas un dict)")
            continue
        kind = (op.get("op") or "").lower()

        try:
            if kind == "note":
                ok(f"NOTE: {op.get('message', '')[:120]}")

            elif kind == "add_column":
                tname = op.get("table")
                col = op.get("column") or {}
                t = _find_table(new_model, tname)
                if not t:
                    fail(f"add_column: table '{tname}' introuvable"); continue
                if not col.get("name"):
                    fail(f"add_column: column.name manquant"); continue
                # eviter doublons
                cols = t.setdefault("columns", [])
                if any(str(c.get("name", "")).lower() == str(col["name"]).lower() for c in cols):
                    fail(f"add_column: '{col['name']}' existe deja dans '{tname}'"); continue
                col.setdefault("type", "NVARCHAR(255)")
                col.setdefault("role", "attribute")
                cols.append(col)
                ok(f"add_column {tname}.{col['name']} ({col['type']}, {col.get('role')})")

            elif kind == "drop_column":
                tname = op.get("table"); cname = op.get("column")
                t = _find_table(new_model, tname)
                if not t:
                    fail(f"drop_column: table '{tname}' introuvable"); continue
                cols = t.get("columns", []) or []
                new_cols = [c for c in cols if str(c.get("name", "")).lower() != str(cname).lower()]
                if len(new_cols) == len(cols):
                    fail(f"drop_column: colonne '{cname}' absente de '{tname}'"); continue
                t["columns"] = new_cols
                ok(f"drop_column {tname}.{cname}")

            elif kind == "rename_column":
                tname = op.get("table"); old = op.get("old"); new = op.get("new")
                t = _find_table(new_model, tname)
                if not t:
                    fail(f"rename_column: table '{tname}' introuvable"); continue
                renamed = False
                for c in t.get("columns", []) or []:
                    if str(c.get("name", "")).lower() == str(old).lower():
                        c["name"] = new
                        renamed = True
                        break
                if not renamed:
                    fail(f"rename_column: '{old}' absent de '{tname}'"); continue
                # ajuster les references potentielles dans d'autres tables
                for tt in _all_tables(new_model):
                    for c in tt.get("columns", []) or []:
                        if str(c.get("references", "")).lower() == f"{tname}.{str(old).lower()}":
                            c["references"] = f"{tname}.{new}"
                ok(f"rename_column {tname}.{old} -> {new}")

            elif kind == "change_column_type":
                tname = op.get("table"); cname = op.get("column"); ctype = op.get("type")
                t = _find_table(new_model, tname)
                if not t:
                    fail(f"change_column_type: table '{tname}' introuvable"); continue
                changed = False
                for c in t.get("columns", []) or []:
                    if str(c.get("name", "")).lower() == str(cname).lower():
                        c["type"] = ctype
                        changed = True
                        break
                if not changed:
                    fail(f"change_column_type: '{cname}' absent de '{tname}'"); continue
                ok(f"change_column_type {tname}.{cname} -> {ctype}")

            elif kind == "rename_table":
                old = op.get("old"); new = op.get("new")
                t = _find_table(new_model, old)
                if not t:
                    fail(f"rename_table: table '{old}' introuvable"); continue
                t["name"] = new
                ok(f"rename_table {old} -> {new}")

            elif kind == "add_table":
                kind2 = (op.get("kind") or "").lower()
                tbl = op.get("table") or {}
                if not tbl.get("name"):
                    fail(f"add_table: table.name manquant"); continue
                if kind2 == "fact":
                    new_model.setdefault("fact_tables", []).append(tbl)
                    ok(f"add_table fact: {tbl['name']}")
                else:
                    new_model.setdefault("dimension_tables", []).append(tbl)
                    ok(f"add_table dim: {tbl['name']}")

            elif kind == "add_fk":
                tname = op.get("table"); col = op.get("column"); ref = op.get("references")
                t = _find_table(new_model, tname)
                if not t:
                    fail(f"add_fk: table '{tname}' introuvable"); continue
                for c in t.get("columns", []) or []:
                    if str(c.get("name", "")).lower() == str(col).lower():
                        c["references"] = ref
                        c["role"] = "fk"
                        ok(f"add_fk {tname}.{col} -> {ref}")
                        break
                else:
                    fail(f"add_fk: colonne '{col}' absente de '{tname}'")

            elif kind == "split_date_key":
                tname = op.get("table"); old_col = op.get("old_column")
                new_cols_def = op.get("new_columns") or []
                t = _find_table(new_model, tname)
                if not t:
                    fail(f"split_date_key: table '{tname}' introuvable"); continue
                cols = t.get("columns", []) or []
                # localise et retire l'ancienne colonne
                old_col_def = None
                for c in cols:
                    if str(c.get("name", "")).lower() == str(old_col).lower():
                        old_col_def = c
                        break
                if old_col_def:
                    cols.remove(old_col_def)
                # ajoute les nouvelles
                for nc in new_cols_def:
                    name = nc.get("name")
                    if not name:
                        continue
                    cols.append({
                        "name": name,
                        "type": "BIGINT",
                        "role": "fk",
                        "references": "dim_date.date_sk",
                        "nullable": bool(nc.get("nullable", False)),
                        "description": f"Role-playing date key (split from {old_col})",
                    })
                t["columns"] = cols
                ok(f"split_date_key {tname}.{old_col} -> {[c.get('name') for c in new_cols_def]}")

            else:
                fail(f"Op#{i} '{kind}' inconnue")

        except Exception as e:
            fail(f"Op#{i} '{kind}' a echoue: {e}")

    return new_model, log


# ============================================================================
# Noeud principal
# ============================================================================
def _smart_parse_complex_request(request: str, model: dict) -> List[dict]:
    """Parse une demande complexe multi-etape (numerotee 1./2./3.) et infere
    des operations atomiques. Utilise quand le LLM est indisponible.

    Detecte automatiquement :
      - Role-playing dimensions (multi-dates) -> split_date_key
      - Mesures calculees (net_amount) -> add_column role=computed
      - Changement de type (reportsto en INT) -> change_column_type
      - Foreign keys -> add_fk
    """
    if not request or not isinstance(model, dict):
        return []

    ops: List[dict] = []
    rl = request.lower()

    # Decoupe en sections par numerotation ou puces
    sections = re.split(r"(?:^|\n)\s*(?:\d+[.)]|[-*])\s*", request)
    sections = [s.strip() for s in sections if s.strip()]
    if len(sections) < 2:
        sections = re.split(r"[.;]\s+", request)
        sections = [s.strip() for s in sections if s.strip() and len(s) > 5]

    facts = _all_fact_tables(model)
    fact_name = facts[0]["name"] if facts else None

    for section in sections:
        sec_low = section.lower()

        # 1. Role-playing dimensions
        if fact_name and (
            "multi-date" in sec_low or "multidates" in sec_low
            or "role-playing" in sec_low or "multi date" in sec_low
            or (sec_low.count("date") >= 2 and ("trois" in sec_low or "3" in sec_low))
        ):
            new_cols = []
            for m in re.finditer(r"(\w*_?date_sk)", section, re.IGNORECASE):
                name = m.group(1).lower()
                if name not in [c.get("name") for c in new_cols]:
                    nullable = "shipped" in name or "expedi" in section.lower()
                    new_cols.append({"name": name, "nullable": nullable})
            if not new_cols and fact_name and "order" in fact_name.lower():
                new_cols = [
                    {"name": "order_date_sk", "nullable": False},
                    {"name": "required_date_sk", "nullable": False},
                    {"name": "shipped_date_sk", "nullable": True},
                ]
            if new_cols:
                for fact in facts:
                    for c in fact.get("columns", []):
                        if c.get("name") == "date_sk" or (
                            c.get("role") == "fk" and "date" in str(c.get("name", "")).lower()
                        ):
                            ops.append({
                                "op": "split_date_key",
                                "table": fact["name"],
                                "old_column": c["name"],
                                "new_columns": new_cols,
                            })
                            break

        # 2. Mesure calculee
        if "net_amount" in sec_low or ("calcul" in sec_low and "mesure" in sec_low):
            metric_name_match = re.search(
                r"\[(\w+)\]|`(\w+)`|(net_amount|total_ttc|montant_net|montant_ht)",
                section, re.IGNORECASE,
            )
            if metric_name_match:
                metric_name = next((g for g in metric_name_match.groups() if g), "net_amount")
                description = ""
                formula = re.search(r"\(([^()]+)\)", section)
                if formula:
                    description = f"Mesure calculee = {formula.group(1).strip()}"
                if fact_name:
                    ops.append({
                        "op": "add_column",
                        "table": fact_name,
                        "column": {
                            "name": metric_name.lower(),
                            "type": "DECIMAL(15,4)",
                            "role": "computed",
                            "description": description or "Mesure calculee ajoutee via Human Review",
                        },
                    })

        # 3. Changement de type (reportsto -> INT)
        if "reportsto" in sec_low and ("type" in sec_low or "metier" in sec_low or "int" in sec_low):
            for t in _all_tables(model):
                for c in t.get("columns", []):
                    if str(c.get("name", "")).lower() == "reportsto":
                        ops.append({
                            "op": "change_column_type",
                            "table": t["name"],
                            "column": "reportsto",
                            "type": "INT",
                        })
                        break

        # Pattern generique : "change le type de X en Y"
        m = re.search(
            r"(?:change|modifie|convertis)\s+(?:le\s+type\s+(?:de\s+)?)?\[?(\w+)\]?\s+(?:en|to)\s+(\w+)",
            section, re.IGNORECASE,
        )
        if m:
            col_name = m.group(1)
            new_type = m.group(2).upper()
            if "metier" in sec_low or "business key" in sec_low:
                new_type = "INT"
            for t in _all_tables(model):
                for c in t.get("columns", []):
                    if str(c.get("name", "")).lower() == col_name.lower():
                        ops.append({
                            "op": "change_column_type",
                            "table": t["name"],
                            "column": col_name,
                            "type": new_type,
                        })
                        break

        # 4. Foreign keys
        if ("foreign" in sec_low or " fk " in sec_low or "etrang" in sec_low
            or "contrainte" in sec_low) and fact_name:
            for fact in facts:
                for c in fact.get("columns", []):
                    if c.get("role") == "fk":
                        col = c["name"]
                        base = col.lower().replace("_sk", "")
                        for d in _all_dimensions(model):
                            if base in d.get("name", "").lower():
                                pk = next((cc["name"] for cc in d.get("columns", [])
                                           if cc.get("role") == "pk"), None)
                                if pk:
                                    ops.append({
                                        "op": "add_fk",
                                        "table": fact["name"],
                                        "column": col,
                                        "references": f"{d['name']}.{pk}",
                                    })
                                break

    # Deduplique
    seen = set()
    deduped = []
    for o in ops:
        key = json.dumps(o, sort_keys=True, default=str)
        if key not in seen:
            seen.add(key)
            deduped.append(o)
    return deduped


def chat_modifier_node(state: AgentState) -> dict:
    logger.info("--- AGENT CHAT MODIFIER v4.0 (patch ops + Blaze strict) ---")
    user_request = _extract_user_request(state)
    current_model = state.get("logical_model") or {}
    current_ddl = state.get("sql_ddl", "") or ""
    prefix = state.get("user_prefix", "dw")
    ver = int(state.get("logical_model_version", 0) or 0)
    next_ver = ver + 1


    if not user_request:
        return {"is_validated": None, "execution_log": ["[ChatModifier] SKIP - aucune demande"]}
    if not current_model or not _all_fact_tables(current_model):
        return {"is_validated": None, "execution_log": ["[ChatModifier] SKIP - modele absent"]}

    new_model = None
    change_summary = ""
    used_strategy = "llm-blaze"
    apply_log = []

    llm = None
    used_strategy = "human-review-llm"
    # Cascade Human Review : GLM-5 (3 cles) -> OpenRouter -> Blaze -> Ollama -> Smart parser
    try:
        llm = get_human_review_llm(temperature=0.05, max_tokens=8000)
    except RuntimeError as e:
        logger.warning(f"[ChatModifier] Tous les LLM Human Review KO : {e}")
        llm = None

    failed_apply_log: List[str] = []  # garde trace des [!] si toutes les ops echouent
    if llm is not None:
        raw = ""
        try:
            chain = PATCH_PROMPT | llm
            response = call_with_retry(chain, {
                "current_model": json.dumps(current_model, indent=2, default=str)[:12000],
                "current_ddl_excerpt": current_ddl[:4000],
                "user_request": user_request,
                "model_version": ver,
            }, max_retries=2, use_cache=False)
            raw = extract_text(response)
            json_text = raw
            m = re.search(r"```(?:json)?\s*\n([\s\S]+?)\n```", raw)
            if m:
                json_text = m.group(1)
            json_text = json_text.strip()
            fb = json_text.find("{"); lb = json_text.rfind("}")
            if fb >= 0 and lb > fb:
                json_text = json_text[fb:lb+1]
            parsed = json.loads(json_text)
            ops = parsed.get("ops") or []
            change_summary = (parsed.get("summary") or "").strip()
            if isinstance(ops, list) and ops:
                candidate_model, candidate_log = _apply_ops(current_model, ops)
                # Detect "all ops failed" (no [+] line in apply_log) -> trigger fallback
                # instead of pretending the modification was applied.
                successful = sum(
                    1 for line in candidate_log if line.lstrip().startswith("[+]")
                )
                if successful > 0:
                    new_model, apply_log = candidate_model, candidate_log
                else:
                    failed_apply_log = candidate_log
                    logger.warning(
                        f"[ChatModifier] LLM ops rejetees (0/{len(ops)} appliquees) — "
                        f"fallback smart parser. Log: {candidate_log[:5]}"
                    )
        except json.JSONDecodeError as e:
            logger.error(
                f"[ChatModifier] JSON invalide du LLM : {e}. Raw (extrait) : {raw[:500]!r}"
            )
        except Exception as e:
            logger.error(f"[ChatModifier] LLM erreur : {e}. Raw (extrait) : {raw[:500]!r}")

    if new_model is None:
        smart_ops = _smart_parse_complex_request(user_request, current_model)
        if smart_ops:
            new_model, apply_log = _apply_ops(current_model, smart_ops)
            change_summary = f"{len(smart_ops)} operation(s) inferees par smart parser"
            used_strategy = "smart-deterministic"

    if new_model is None:
        det_model, det_summary = _deterministic_modify(current_model, user_request)
        if det_model is not None:
            new_model = det_model
            change_summary = det_summary
            used_strategy = "deterministic-regex"
            apply_log = [f"  [+] {det_summary}"]

    if new_model is None:
        # Build a more informative failure message that surfaces the LLM rejection
        # log when available, so the user can see why their suggestion was ignored.
        failure_detail = ""
        if failed_apply_log:
            failure_detail = (
                "\n\n--- Pourquoi le LLM a echoue a appliquer ---\n"
                + "\n".join(failed_apply_log[:10])
                + "\n\nAstuce : verifie que les noms de tables/colonnes dans ta demande "
                  "correspondent exactement a ceux du modele courant."
            )
        return {
            "is_validated": None,
            "logical_model_version": next_ver,
            "previous_sql_ddl": current_ddl,
            "critic_approved": False,
            "critic_review": (
                "[!] Modification non appliquee\n"
                f"Demande : {user_request[:200]}\n\n"
                "Ni le LLM (GLM-5/OpenRouter/Blaze/Ollama) ni le smart parser "
                "n'ont reussi a appliquer cette demande."
                + failure_detail
                + "\n\nPistes :\n"
                "  - Reformuler en operations atomiques explicites "
                "(ex: 'Ajoute la colonne net_amount DECIMAL(15,4) dans fact_orders')\n"
                "  - Verifier les cles API GLM5_API_KEYS et OPENROUTER_API_KEY dans .env\n"
                "  - Consulter les logs serveur pour la reponse brute du LLM"
            ),
            "execution_log": [f"[ChatModifier] v{next_ver} ECHEC : {user_request[:80]}"],
        }

    if "fact_table" in new_model and "fact_tables" not in new_model:
        new_model["fact_tables"] = [new_model["fact_table"]]
    if not new_model.get("fact_tables") and new_model.get("fact_table"):
        new_model["fact_tables"] = [new_model["fact_table"]]

    try:
        new_ddl = _generate_ddl(new_model, prefix)
    except Exception as e:
        logger.exception("[ChatModifier] _generate_ddl a echoue")
        return {
            "is_validated": None,
            "logical_model_version": next_ver,
            "previous_sql_ddl": current_ddl,
            "critic_approved": False,
            "critic_review": f"[X] Erreur regeneration DDL : {e}",
            "execution_log": [f"[ChatModifier] v{next_ver} ECHEC DDL : {e}"],
        }

    diff_text = _ddl_diff(current_ddl, new_ddl)
    apply_log_str = "\n".join(apply_log) if apply_log else "(aucune trace)"
    enriched_review = (
        f"[OK] Modification v{next_ver} appliquee\n"
        f"Demande   : {user_request[:200]}\n"
        f"Strategie : {used_strategy}\n"
        f"Resume    : {change_summary}\n\n"
        f"--- Journal ---\n{apply_log_str}\n\n"
        f"--- Diff DDL ---\n{diff_text}"
    )
    logger.info(f"[ChatModifier] v{next_ver} OK ({used_strategy}, {len(apply_log)} lignes)")

    return {
        "logical_model": new_model,
        "logical_model_version": next_ver,
        "previous_sql_ddl": current_ddl,
        "sql_ddl": new_ddl,
        "critic_approved": False,
        "critic_review": enriched_review,
        "is_validated": None,
        "hitl_comment": "",
        "execution_log": [f"[ChatModifier] v{next_ver} OK ({used_strategy})"],
    }
