# nodes/data_quality_agent.py — Agent Data Quality v1.0
"""
Nouveau nœud LangGraph inséré entre explorer et drift_detector.
Rôle : analyser la qualité des données source et produire un rapport DQ
avec scores, alertes et recommandations de nettoyage.
"""
import logging
from typing import Any, Dict, List
from app_state import AgentState

logger = logging.getLogger(__name__)


# ─── Seuils de qualité ────────────────────────────────────────────────────────
DQ_THRESHOLDS = {
    "null_pct_warn":    10.0,   # % nuls → warning
    "null_pct_error":   40.0,   # % nuls → erreur critique
    "duplicate_warn":    5.0,   # % doublons → warning
    "cardinality_low":     2,   # nunique très faible (valeurs constantes)
    "outlier_zscore":    3.5,   # Z-score pour détection outliers
}


def data_quality_agent_node(state: AgentState) -> dict:
    """
    Analyse la qualité des données source.
    Produit :
      - dq_report : dict complet avec scores par table/colonne
      - dq_score  : score global 0-100
      - dq_alerts : liste d'alertes critiques
    """
    logger.info("--- AGENT DATA QUALITY : Analyse qualité des données ---")
    metadata = state.get("source_metadata", {})

    if not metadata:
        return {
            "dq_report": {},
            "dq_score": 100,
            "dq_alerts": [],
            "execution_log": state.get("execution_log", []) + [
                "[DataQuality] SKIP — aucune métadonnée disponible"
            ],
        }

    all_alerts: List[Dict[str, Any]] = []
    table_reports = {}
    global_scores = []

    for table_name, table_data in metadata.items():
        if not isinstance(table_data, dict):
            continue

        columns = table_data.get("columns", [])
        row_count = table_data.get("row_count", 0)
        table_alerts = []
        col_reports = []
        col_scores = []

        for col in columns:
            col_name  = col.get("name", "?")
            dtype     = col.get("dtype", "object")
            null_pct  = col.get("null_pct", 0.0)
            nunique   = col.get("nunique", 0)
            samples   = col.get("sample_values", [])

            issues = []
            score  = 100.0

            # ── Nullité ───────────────────────────────────────────────────────
            if null_pct >= DQ_THRESHOLDS["null_pct_error"]:
                issues.append({
                    "severity": "error",
                    "rule":     "null_rate",
                    "message":  f"{null_pct:.1f}% de valeurs nulles (seuil critique : {DQ_THRESHOLDS['null_pct_error']}%)",
                })
                score -= 40
                table_alerts.append({
                    "severity":  "error",
                    "table":     table_name,
                    "column":    col_name,
                    "rule":      "null_rate",
                    "detail":    f"{null_pct:.1f}% nulls",
                })
            elif null_pct >= DQ_THRESHOLDS["null_pct_warn"]:
                issues.append({
                    "severity": "warning",
                    "rule":     "null_rate",
                    "message":  f"{null_pct:.1f}% de valeurs nulles (seuil warning : {DQ_THRESHOLDS['null_pct_warn']}%)",
                })
                score -= 15

            # ── Cardinalité faible (colonne quasi-constante) ──────────────────
            if row_count > 10 and nunique <= DQ_THRESHOLDS["cardinality_low"]:
                issues.append({
                    "severity": "warning",
                    "rule":     "low_cardinality",
                    "message":  f"Cardinalité très faible ({nunique} valeurs distinctes) — possible colonne constante",
                })
                score -= 10

            # ── Détection de types mixtes (heuristique sur samples) ───────────
            if dtype in ("object", "string") and samples:
                numeric_count = sum(1 for v in samples if _is_numeric(str(v)))
                if 0 < numeric_count < len(samples):
                    issues.append({
                        "severity": "warning",
                        "rule":     "mixed_types",
                        "message":  "Colonnes texte contenant des valeurs numériques — possible type incorrect",
                    })
                    score -= 8

            # ── Doublons potentiels (heuristique : nunique / row_count) ───────
            if row_count > 0 and nunique > 0:
                dup_pct = max(0, 100 * (1 - nunique / row_count))
                if dup_pct >= DQ_THRESHOLDS["duplicate_warn"]:
                    issues.append({
                        "severity": "info",
                        "rule":     "duplicates",
                        "message":  f"~{dup_pct:.1f}% de valeurs en doublon détectées",
                    })

            col_score = max(0.0, score)
            col_scores.append(col_score)
            col_reports.append({
                "column":    col_name,
                "dtype":     dtype,
                "null_pct":  null_pct,
                "nunique":   nunique,
                "score":     round(col_score, 1),
                "issues":    issues,
            })

        table_score = round(sum(col_scores) / len(col_scores), 1) if col_scores else 100.0
        global_scores.append(table_score)

        table_reports[table_name] = {
            "row_count":   row_count,
            "col_count":   len(columns),
            "table_score": table_score,
            "columns":     col_reports,
            "alerts":      table_alerts,
        }
        all_alerts.extend(table_alerts)

    global_score = round(sum(global_scores) / len(global_scores), 1) if global_scores else 100.0

    # ── Enrichissement LLM : recommandations de nettoyage ─────────────────────
    recommendations = _generate_recommendations(all_alerts, global_score)

    log_msg = (
        f"[DataQuality] Score global : {global_score}/100 — "
        f"{len([a for a in all_alerts if a['severity'] == 'error'])} erreur(s), "
        f"{len([a for a in all_alerts if a['severity'] == 'warning'])} warning(s)"
    )
    logger.info(log_msg)

    return {
        "dq_report": {
            "global_score":      global_score,
            "tables":            table_reports,
            "total_alerts":      len(all_alerts),
            "recommendations":   recommendations,
        },
        "dq_score":  global_score,
        "dq_alerts": all_alerts,
        "execution_log": state.get("execution_log", []) + [log_msg],
    }


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _is_numeric(value: str) -> bool:
    try:
        float(value.replace(",", "."))
        return True
    except ValueError:
        return False


def _generate_recommendations(alerts: List[Dict], score: float) -> List[str]:
    """Génère des recommandations de nettoyage basées sur les alertes."""
    recs = []

    error_alerts  = [a for a in alerts if a.get("severity") == "error"]
    warn_alerts   = [a for a in alerts if a.get("severity") == "warning"]

    if error_alerts:
        cols = list({a["column"] for a in error_alerts})[:5]
        recs.append(
            f"🔴 CRITIQUE : Remplir ou exclure les colonnes avec >40% de nulls : {', '.join(cols)}"
        )

    null_warns = [a for a in warn_alerts if a.get("rule") == "null_rate"]
    if null_warns:
        cols = list({a["column"] for a in null_warns})[:5]
        recs.append(f"🟡 Imputer ou signaler les valeurs nulles dans : {', '.join(cols)}")

    type_warns = [a for a in warn_alerts if a.get("rule") == "mixed_types"]
    if type_warns:
        recs.append("🟡 Vérifier et corriger les types de colonnes avec valeurs mixtes")

    if score >= 90:
        recs.append("✅ Qualité des données excellente — prêt pour le chargement DW")
    elif score >= 70:
        recs.append("⚠️ Qualité acceptable — appliquer les corrections ci-dessus avant le chargement")
    else:
        recs.append("🔴 Qualité insuffisante — nettoyage obligatoire avant chargement en DW")

    return recs
