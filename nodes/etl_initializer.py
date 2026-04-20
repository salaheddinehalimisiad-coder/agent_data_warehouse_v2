# nodes/etl_initializer.py — Professional ETL Initializer v4.2 (TDS-safe)
"""
INITIALIZER v4.2 :
- Utilise la nouvelle connexion TDS-safe de etl_executor._build_engine
- Exécute le DDL en AUTOCOMMIT (via _execute_ddl patché)
- **Vérification active** post-DDL : compte les tables réellement créées
  avec le préfixe de l'utilisateur → plus de 'success' fantôme.
- Logs enrichis avec serveur résolu, base cible, tables visibles.
"""
import logging
import traceback

from app_state import AgentState
from nodes.etl_executor import (
    _build_engine,
    _execute_ddl,
    _test_connection,
    _verify_tables_created,
)

logger = logging.getLogger(__name__)


def etl_initializer_node(state: AgentState) -> dict:
    """
    INITIALIZER STEP :
      1. Vérifie la connectivité DW (handshake TDS réel).
      2. Exécute le DDL en AUTOCOMMIT.
      3. Vérifie que les tables physiques sont bien créées.
      4. Prépare l'environnement d'exécution.
    """
    logger.info("--- [ETL] PHASE 0 : INITIALIZER (v4.2 TDS-safe) ---")

    sql_ddl     = state.get("sql_ddl", "")
    dw_config   = state.get("dw_connection_config", {})
    exec_log    = state.get("execution_log", [])
    user_prefix = state.get("user_prefix", "dw")

    if not sql_ddl:
        return {
            "etl_status": "failed",
            "etl_error":  "Missing SQL DDL for initialization",
            "execution_log": exec_log + ["[Initializer] ❌ Missing DDL"],
        }

    if not dw_config or not dw_config.get("host"):
        exec_log.append(
            "[Initializer] ⚠️ No DW config found — proceeding in export-only mode."
        )
        return {
            "etl_status":    "pending",
            "execution_log": exec_log,
        }

    # ── Préparation des infos de connexion (pour logs) ───────────────────────
    host     = dw_config.get("host", "localhost")
    database = dw_config.get("database", "data_warehouse")
    user     = dw_config.get("user", "sa")

    try:
        # ── 1. Connexion ─────────────────────────────────────────────────────
        dw_engine = _build_engine(dw_config)
        _test_connection(dw_engine)
        exec_log.append(
            f"[Initializer] 🔌 Connexion DW établie — "
            f"host={host}, db={database}, user={user}"
        )

        # ── 2. Exécution du DDL (AUTOCOMMIT, split GO) ───────────────────────
        logger.info("[Initializer] Applying DDL schema...")
        ddl_error = _execute_ddl(dw_engine, sql_ddl)
        if ddl_error:
            return {
                "etl_status": "failed",
                "etl_error":  f"DDL Execution failed: {ddl_error}",
                "execution_log": exec_log + [
                    f"[Initializer] ❌ DDL Error: {ddl_error[:150]}"
                ],
            }
        exec_log.append(
            f"[Initializer] 📐 DDL appliqué (préfixe: {user_prefix})"
        )

        # ── 3. Vérification active : les tables existent-elles ? ─────────────
        n_tables, table_names = _verify_tables_created(dw_engine, user_prefix)
        if n_tables == 0:
            return {
                "etl_status": "failed",
                "etl_error":  (
                    f"DDL exécuté mais 0 table '{user_prefix}_*' trouvée dans "
                    f"[{database}] — vérifier les permissions CREATE TABLE "
                    f"pour l'utilisateur {user}."
                ),
                "execution_log": exec_log + [
                    f"[Initializer] ⚠️ 0 table détectée avec préfixe '{user_prefix}'"
                ],
            }

        preview = ", ".join(table_names[:5]) + (
            f" … (+{n_tables - 5} autres)" if n_tables > 5 else ""
        )
        exec_log.append(
            f"[Initializer] 📦 {n_tables} table(s) physique(s) créée(s) : {preview}"
        )
        exec_log.append(
            f"[Initializer] ✅ Schéma vérifié dans [{database}] — prêt pour le chargement"
        )

        return {
            "etl_status":    "pending",
            "execution_log": exec_log,
        }

    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(f"[Initializer] Critical Failure:\n{error_trace}")
        return {
            "etl_status": "failed",
            "etl_error":  f"Initialization failed: {e}\n{error_trace}",
            "execution_log": exec_log + [
                f"[Initializer] ❌ Critical Failure: {e}"
            ],
        }
