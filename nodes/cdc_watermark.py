# nodes/cdc_watermark.py — P3-05 : CDC Watermark — ETL Incrémental
"""
Phase 3 — Mécanisme de watermark générique pour ETL incrémental.
- Persiste les timestamps par table dans outputs/etl_watermarks.json
- Détecte automatiquement la colonne de modification (UpdatedAt, CreatedAt, etc.)
- Détermine le mode : full_load (premier run ou reset) vs incremental
- 100% générique : fonctionne sur N'IMPORTE quel schéma
"""
import json
import logging
import os
from datetime import datetime
from typing import Dict, Any, Optional, List
from app_state import AgentState

logger = logging.getLogger(__name__)

WATERMARK_FILE = "outputs/etl_watermarks.json"

# Noms de colonnes candidats pour la détection de la colonne de modification
# Par ordre de priorité décroissante
_MODIFIED_COL_PATTERNS = [
    # Colonnes de mise à jour (priorité haute)
    "updatedat", "modifiedat", "lastmodified", "updatedate",
    "modified_date", "updated_date", "last_modified", "last_update",
    "date_modification", "date_mise_a_jour", "modified_on", "updated_on",
    # Colonnes de création (priorité moyenne — inserts seulement)
    "createdat", "insertedat", "createddate", "created_date",
    "insert_date", "date_creation", "created_on", "added_on",
    # Colonnes timestamp génériques
    "timestamp", "ts", "row_timestamp", "sys_timestamp",
]


def cdc_watermark_node(state: AgentState) -> dict:
    """
    Nœud CDC Watermark : détermine le mode ETL (full_load ou incremental)
    et prépare les watermarks pour chaque table source.
    """
    logger.info("--- AGENT CDC WATERMARK : Détection Mode ETL ---")

    metadata = state.get("source_metadata", {})
    if not metadata:
        logger.warning("[CDC] Aucune métadonnée source — mode full_load par défaut")
        return {
            "etl_mode": "full_load",
            "etl_watermarks": {},
            "execution_log": state.get("execution_log", []) + [
                "[CDC] ⚠️ Mode full_load — aucune métadonnée"
            ],
        }

    # ── Charger les watermarks existants ──────────────────────────────────────
    existing_watermarks = _load_watermarks()
    is_first_run = len(existing_watermarks) == 0

    # ── Détecter les colonnes de modification pour chaque table ───────────────
    new_watermarks = {}
    incremental_tables = 0

    for table_name, table_info in metadata.items():
        if not isinstance(table_info, dict):
            continue

        columns = table_info.get("columns", [])
        mod_col = _detect_modification_column(columns)

        if mod_col:
            prev = existing_watermarks.get(table_name, {})
            prev_value = prev.get("last_value")

            new_watermarks[table_name] = {
                "column": mod_col,
                "column_type": _get_col_type(columns, mod_col),
                "last_value": prev_value,
                "last_run": prev.get("last_run"),
                "mode": "incremental" if prev_value else "full_load",
            }

            if prev_value:
                incremental_tables += 1
                logger.info(
                    f"[CDC] {table_name} → incrémental "
                    f"(colonne: {mod_col}, watermark: {prev_value})"
                )
            else:
                logger.info(
                    f"[CDC] {table_name} → full_load initial "
                    f"(colonne de tracking: {mod_col})"
                )
        else:
            # Pas de colonne de tracking → toujours full_load
            pk_col = _detect_autoincrement_pk(columns)
            if pk_col:
                prev = existing_watermarks.get(table_name, {})
                prev_value = prev.get("last_value")
                new_watermarks[table_name] = {
                    "column": pk_col,
                    "column_type": "pk_autoincrement",
                    "last_value": prev_value,
                    "last_run": prev.get("last_run"),
                    "mode": "incremental_inserts_only" if prev_value else "full_load",
                }
                if prev_value:
                    incremental_tables += 1
            else:
                new_watermarks[table_name] = {
                    "column": None,
                    "column_type": None,
                    "last_value": None,
                    "last_run": None,
                    "mode": "full_load",
                }
                logger.debug(
                    f"[CDC] {table_name} → full_load permanent "
                    "(aucune colonne de tracking)"
                )

    # ── Déterminer le mode global ─────────────────────────────────────────────
    total_tables = len(new_watermarks)
    if is_first_run or incremental_tables == 0:
        etl_mode = "full_load"
        mode_label = "FULL LOAD (premier run)" if is_first_run else "FULL LOAD"
    elif incremental_tables == total_tables:
        etl_mode = "incremental"
        mode_label = "INCRÉMENTAL (toutes les tables)"
    else:
        etl_mode = "incremental"
        mode_label = f"MIXTE ({incremental_tables}/{total_tables} tables incrémentales)"

    logger.info(f"[CDC] Mode ETL déterminé : {mode_label}")

    return {
        "etl_mode": etl_mode,
        "etl_watermarks": new_watermarks,
        "execution_log": state.get("execution_log", []) + [
            f"[CDC] ✅ Mode {mode_label} — {total_tables} tables analysées"
        ],
    }


# ═════════════════════════════════════════════════════════════════════════════
# PERSISTANCE WATERMARKS
# ═════════════════════════════════════════════════════════════════════════════

def _load_watermarks() -> dict:
    """Charge les watermarks depuis le fichier JSON."""
    if not os.path.exists(WATERMARK_FILE):
        return {}
    try:
        with open(WATERMARK_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"[CDC] Erreur lecture watermarks : {e}")
        return {}


def save_watermarks(watermarks: dict) -> None:
    """Sauvegarde les watermarks après un run ETL réussi."""
    os.makedirs(os.path.dirname(WATERMARK_FILE), exist_ok=True)
    now = datetime.now().isoformat()

    # Mettre à jour le timestamp du run
    for table in watermarks:
        if isinstance(watermarks[table], dict):
            watermarks[table]["last_run"] = now

    try:
        with open(WATERMARK_FILE, "w", encoding="utf-8") as f:
            json.dump(watermarks, f, indent=2, ensure_ascii=False, default=str)
        logger.info(f"[CDC] Watermarks sauvegardés : {WATERMARK_FILE}")
    except Exception as e:
        logger.error(f"[CDC] Erreur sauvegarde watermarks : {e}")


def update_table_watermark(watermarks: dict, table_name: str, new_value) -> dict:
    """Met à jour le watermark d'une table spécifique après chargement réussi."""
    if table_name in watermarks:
        watermarks[table_name]["last_value"] = str(new_value)
        watermarks[table_name]["last_run"] = datetime.now().isoformat()
    return watermarks


# ═════════════════════════════════════════════════════════════════════════════
# DÉTECTION COLONNES
# ═════════════════════════════════════════════════════════════════════════════

def _detect_modification_column(columns: List[dict]) -> Optional[str]:
    """
    Détecte la colonne de modification/timestamp d'une table.
    Algorithme par priorité :
    1. Colonne nommée UpdatedAt, ModifiedAt, LastModified, etc.
    2. Colonne nommée CreatedAt, InsertedAt, etc. (inserts seulement)
    3. Fallback : None (pas de colonne de tracking)
    """
    col_names_lower = {
        col.get("name", "").lower().replace("_", ""): col.get("name", "")
        for col in columns
    }

    for pattern in _MODIFIED_COL_PATTERNS:
        clean_pattern = pattern.replace("_", "")
        if clean_pattern in col_names_lower:
            return col_names_lower[clean_pattern]

    # Recherche par type : colonnes datetime sans "date" dans le nom
    # qui pourraient être des timestamps de tracking
    date_types = {"datetime", "datetime2", "timestamp", "datetimeoffset"}
    for col in columns:
        dtype = str(col.get("dtype", col.get("type", ""))).lower().split("(")[0].strip()
        name = col.get("name", "").lower()
        if dtype in date_types:
            # Exclure les colonnes date métier évidentes (OrderDate, BirthDate, etc.)
            if any(kw in name for kw in ("order", "birth", "hire", "ship", "start", "end")):
                continue
            if any(kw in name for kw in ("modif", "updat", "creat", "insert", "timestamp", "last")):
                return col.get("name", "")

    return None


def _detect_autoincrement_pk(columns: List[dict]) -> Optional[str]:
    """Détecte une colonne PK auto-increment pour tracking d'inserts."""
    for col in columns:
        name = col.get("name", "")
        dtype = str(col.get("dtype", col.get("type", ""))).lower()
        if ("int" in dtype or "identity" in dtype) and (
            name.lower().endswith("id") or name.lower() == "id"
        ):
            return name
    return None


def _get_col_type(columns: List[dict], col_name: str) -> str:
    """Retourne le type d'une colonne par son nom."""
    for col in columns:
        if col.get("name", "") == col_name:
            return str(col.get("dtype", col.get("type", "unknown")))
    return "unknown"


def build_incremental_where(watermark_info: dict) -> Optional[str]:
    """
    Construit la clause WHERE pour l'extraction incrémentale.
    Utilisé par etl_extractor pour filtrer les nouvelles lignes.
    """
    col = watermark_info.get("column")
    last_value = watermark_info.get("last_value")
    mode = watermark_info.get("mode", "full_load")

    if not col or not last_value or mode == "full_load":
        return None

    col_type = watermark_info.get("column_type", "")

    if col_type == "pk_autoincrement":
        return f"[{col}] > {last_value}"
    else:
        return f"[{col}] > '{last_value}'"
