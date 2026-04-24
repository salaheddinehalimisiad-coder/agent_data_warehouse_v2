# nodes/critic.py — Agent Critique avec verdict binaire APPROVED / NEEDS_REVISION
import re
import logging
from app_state import AgentState
from nodes.llm_factory import get_llm, call_with_retry, extract_text
from langchain_core.prompts import ChatPromptTemplate

logger = logging.getLogger(__name__)

CRITIC_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """Tu es un Expert Architecte Data Senior et Auditeur SQL.
Ton rôle : auditer rigoureusement un DDL SQL pour Data Warehouse OLAP.

## Critères d'évaluation :
1. ✅ Clés primaires présentes sur TOUTES les tables (dim_ et fact_)
2. ✅ Types de données appropriés (BIGINT pour SKs, DECIMAL pour montants, DATE pour dates)
3. ✅ Pas de FOREIGN KEY physiques sur la table de faits (INDEX à la place)
4. ✅ Cohérence des préfixes (dim_ et fact_ respectés)
5. ✅ Surrogate Keys (_sk) présentes dans la table de faits
6. ✅ dim_date présente avec les attributs temporels standards
7. ✅ Toutes les colonnes de faits FK pointent vers des dimensions existantes

## Format de réponse OBLIGATOIRE :
1. Liste les points validés avec ✅
2. Liste les problèmes détectés avec ❌ et leur correction recommandée
3. Termine OBLIGATOIREMENT par une ligne de verdict au format EXACT :
VERDICT: APPROVED
ou
VERDICT: NEEDS_REVISION - [raison principale en une phrase]
"""),
    ("human", "DDL SQL à auditer :\n\n{sql_ddl}")
])


def critic_node(state: AgentState) -> dict:
    """
    Audite le DDL SQL et émet un verdict structuré.
    Si le LLM est indisponible, effectue un audit structurel automatique.
    v2.1 — Ajout : validation du logical_model avant tout audit.
    """
    logger.info("--- AGENT CRITIQUE : Audit du modèle DDL ---")

    sql_ddl = state.get("sql_ddl", "")
    logical_model = state.get("logical_model", {})

    # ── Validation : refuser si le modèle est vide/invalide ─────────────────
    if not logical_model or not logical_model.get("fact_table"):
        logger.error(
            f"[Critic] ❌ logical_model vide ou sans fact_table — REFUS automatique. "
            f"clés={list(logical_model.keys()) if logical_model else 'None'}"
        )
        return {
            "critic_approved": False,
            "critic_review": (
                "❌ ÉCHEC CRITIQUE : Le modèle logique est vide ou ne contient aucune table de faits. "
                "L'étape Schema Modeling a échoué — aucune validation possible."
            ),
            "execution_log": state.get("execution_log", []) + [
                "[Critic] ❌ REFUS — logical_model vide/invalide, modeler a échoué"
            ],
        }

    if not logical_model.get("dimension_tables"):
        logger.warning("[Critic] ⚠️ Aucune dimension dans le modèle logique — REFUS")
        return {
            "critic_approved": False,
            "critic_review": (
                "❌ Le modèle logique ne contient aucune dimension. "
                "Un Star Schema nécessite au minimum une table de faits et une dimension."
            ),
            "execution_log": state.get("execution_log", []) + [
                "[Critic] ❌ REFUS — aucune dimension dans le modèle"
            ],
        }

    if not sql_ddl or len(sql_ddl.strip()) < 50 or "-- ERREUR" in sql_ddl.upper() or "-- Erreur" in sql_ddl:
        logger.warning(f"[Critic] ⚠️ DDL vide/erreur ({len(sql_ddl.strip()) if sql_ddl else 0} chars) — REFUS")
        return {
            "critic_approved": False,
            "critic_review": (
                "❌ Le DDL SQL généré est vide, en erreur ou insuffisant. "
                "La modélisation n'a pas produit de script de création de tables valide."
            ),
            "execution_log": state.get("execution_log", []) + [
                "[Critic] ❌ REFUS — DDL vide/insuffisant"
            ],
        }

    # ── Tentative avec LLM ───────────────────────────────────────────────────
    try:
        llm = get_llm(temperature=0)
        # Detect FakeChatModel to force auto-approval for algorithm-generated schemas
        if hasattr(llm, '_llm_type') and llm._llm_type == "fake-chat-model":
            logger.warning("[Critic] FakeChatModel détecté — audit structurel automatique forcé")
            return _auto_structural_audit(state, sql_ddl)
        
        chain = CRITIC_PROMPT | llm
        response = call_with_retry(chain, {"sql_ddl": sql_ddl})
        review_text = extract_text(response)

        verdict_match = re.search(
            r"VERDICT:\s*(APPROVED|NEEDS_REVISION)", review_text, re.IGNORECASE
        )
        is_approved = bool(verdict_match and verdict_match.group(1).upper() == "APPROVED")
        verdict_label = "✅ APPROVED" if is_approved else "⚠️ NEEDS_REVISION"
        logger.info(f"[Critic] Verdict LLM : {verdict_label}")

        return {
            "critic_review": review_text,
            "critic_approved": is_approved,
            "execution_log": state.get("execution_log", []) + [
                f"[Critic] Verdict : {verdict_label}"
            ],
        }

    except Exception as e:
        logger.warning(f"[Critic] ⚠️ LLM indisponible ({type(e).__name__}) — audit structurel automatique")
        # ── Fallback : Audit structurel automatique sans LLM ─────────────────────
        return _auto_structural_audit(state, sql_ddl)


def _auto_structural_audit(state: AgentState, sql_ddl: str) -> dict:
    """Audit structurel du DDL sans LLM : vérifie les règles OLAP de base."""
    checks = []
    score = 0

    # Vérifier présence de tables de faits
    if "fact_" in sql_ddl.lower():
        checks.append("✅ Table de faits (fact_) détectée")
        score += 1
    else:
        checks.append("❌ Aucune table de faits détectée")

    # Vérifier présence de dimensions
    dim_count = sql_ddl.lower().count("create table")
    if dim_count >= 2:
        checks.append(f"✅ {dim_count} table(s) créée(s) dans le schéma")
        score += 1
    else:
        checks.append("⚠️ Peu de tables dans le schéma")

    # Vérifier dim_date
    if "dim_date" in sql_ddl.lower():
        checks.append("✅ dim_date présente (dimension temporelle)")
        score += 1
    else:
        checks.append("⚠️ dim_date absente — recommandée pour OLAP")

    # Vérifier surrogate keys _sk
    if "_sk" in sql_ddl.lower():
        checks.append("✅ Surrogate Keys (_sk) détectées")
        score += 1
    else:
        checks.append("❌ Surrogate Keys (_sk) non détectées")

    # Vérifier PRIMARY KEY
    if "primary key" in sql_ddl.lower():
        checks.append("✅ PRIMARY KEY présente")
        score += 1
    else:
        checks.append("❌ PRIMARY KEY non détectée")

    # Vérifier types numériques
    if "decimal" in sql_ddl.lower() or "bigint" in sql_ddl.lower():
        checks.append("✅ Typage numérique approprié (DECIMAL/BIGINT)")
        score += 1

    # Auto-approve si score >= 4
    is_approved = score >= 4
    review_lines = [
        "## 🤖 Audit Structurel Automatique (Mode Sans-LLM)",
        "",
        *checks,
        "",
        f"**Score structural : {score}/6**",
        "",
        f"VERDICT: {'APPROVED' if is_approved else 'NEEDS_REVISION'}"
        + ("" if is_approved else " - Score structural insuffisant, vérifier la structure DDL")
    ]
    review_text = "\n".join(review_lines)
    verdict_label = "✅ AUTO-APPROVED" if is_approved else "⚠️ NEEDS_REVISION"
    logger.info(f"[Critic] Verdict structurel : {verdict_label} (score {score}/6)")

    return {
        "critic_review": review_text,
        "critic_approved": is_approved,
        "execution_log": state.get("execution_log", []) + [
            f"[Critic] {verdict_label} — audit structurel automatique (score {score}/6)"
        ],
    }