# nodes/schema_drift_detector.py — Détection de dérive de schéma v1.1
"""
FIX v1.1 :
  WARN #6 : chemins absolus via pathlib
  WARN #3 : comparaison inclut le type de colonne (pas seulement le nom)
"""
import json
import hashlib
import logging
from pathlib import Path
from app_state import AgentState

logger = logging.getLogger(__name__)

_HERE = Path(__file__).parent.parent
SCHEMA_CACHE_FILE = _HERE / "outputs" / "schema_snapshot.json"


def _compute_fingerprint(metadata: dict) -> str:
    """Hash MD5 déterministe du schéma source (nom + type)."""
    all_cols = []
    for table, data in metadata.items():
        if isinstance(data, dict):
            for col in data.get("columns", []):
                all_cols.append(
                    f"{table}.{col.get('name', '')}:{col.get('dtype', col.get('type', ''))}"
                )
    all_cols.sort()
    return hashlib.md5(json.dumps(all_cols).encode()).hexdigest()


def schema_drift_detector_node(state: AgentState) -> dict:
    """
    Compare le schéma actuel avec le snapshot précédent.
    Détecte les colonnes ajoutées / supprimées / modifiées (type inclus).
    """
    logger.info("--- AGENT DRIFT DETECTOR : Vérification de la cohérence du schéma ---")
    metadata = state.get("source_metadata", {})

    if not metadata:
        return {
            "schema_fingerprint": "",
            "schema_drift_detected": False,
            "schema_drift_details": "",
        }

    current_fingerprint = _compute_fingerprint(metadata)
    drift_detected = False
    drift_details  = ""

    cache_file = Path(SCHEMA_CACHE_FILE)
    cache_file.parent.mkdir(parents=True, exist_ok=True)

    if cache_file.exists():
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                cached = json.load(f)

            if cached.get("fingerprint") != current_fingerprint:
                drift_detected = True

                # Comparaison nom + type (WARN #3 FIX)
                cached_cols  = set(cached.get("columns_with_types", cached.get("columns", [])))
                current_cols = set()
                for table, data in metadata.items():
                    if isinstance(data, dict):
                        for col in data.get("columns", []):
                            dtype = col.get("dtype", col.get("type", "unknown"))
                            current_cols.add(f"{table}.{col.get('name', '')}:{dtype}")

                added   = current_cols - cached_cols
                removed = cached_cols - current_cols

                parts = []
                if added:
                    parts.append(f"+{len(added)} ajouté(e)(s) : {', '.join(list(added)[:5])}")
                if removed:
                    parts.append(f"-{len(removed)} supprimé(e)(s) : {', '.join(list(removed)[:5])}")
                drift_details = " | ".join(parts) or "Structure modifiée"

                logger.warning(f"[Drift Detector] DÉRIVE DÉTECTÉE : {drift_details}")

        except Exception as e:
            logger.warning(f"[Drift Detector] Impossible de lire le cache : {e}")

    # Mise à jour du snapshot avec types inclus
    current_cols_with_types = []
    current_cols_names_only = []
    for table, data in metadata.items():
        if isinstance(data, dict):
            for col in data.get("columns", []):
                dtype = col.get("dtype", col.get("type", "unknown"))
                current_cols_with_types.append(f"{table}.{col.get('name', '')}:{dtype}")
                current_cols_names_only.append(f"{table}.{col.get('name', '')}")

    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump({
            "fingerprint":         current_fingerprint,
            "columns":             current_cols_names_only,
            "columns_with_types":  current_cols_with_types,
        }, f, indent=2)

    log_entry = (
        f"[Drift Detector] {'⚠️ DÉRIVE : ' + drift_details if drift_detected else '✅ Schéma stable'}"
    )

    return {
        "schema_fingerprint":    current_fingerprint,
        "schema_drift_detected": drift_detected,
        "schema_drift_details":  drift_details,
        "execution_log": [log_entry],
    }
