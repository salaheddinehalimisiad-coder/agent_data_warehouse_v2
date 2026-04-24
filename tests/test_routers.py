# tests/test_routers.py — Tests unitaires pour les fonctions de routage LangGraph
"""
Teste les fonctions de routage critiques de main.py sans avoir besoin
d'un environnement LangGraph complet ou d'une vraie base de données.
"""
import sys
import os

# Assure que le module racine est dans le path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Import des fonctions de routage uniquement (pas d'instance globale)
from main import (
    route_after_critic,
    route_after_human_review,
    route_etl_execution,
    route_after_dq,
    route_after_dq_alert,
    MAX_RETRIES,
    MAX_CRITIC_LOOPS,
)
from langgraph.graph import END


# ─── route_after_critic ───────────────────────────────────────────────────────

class TestRouteAfterCritic:
    def test_approved_goes_to_human_review(self):
        state = {"critic_approved": True, "logical_model_version": 0}
        assert route_after_critic(state) == "human_review"

    def test_refused_goes_to_chat_modifier(self):
        state = {"critic_approved": False, "logical_model_version": 1}
        assert route_after_critic(state) == "chat_modifier"

    def test_max_loops_forces_human_review(self):
        state = {"critic_approved": False, "logical_model_version": MAX_CRITIC_LOOPS}
        assert route_after_critic(state) == "human_review"

    def test_missing_critic_approved_defaults_false(self):
        """Si critic_approved absent, on doit aller vers chat_modifier (pas de KeyError)."""
        state = {"logical_model_version": 0}
        assert route_after_critic(state) == "chat_modifier"


# ─── route_after_human_review ─────────────────────────────────────────────────

class TestRouteAfterHumanReview:
    def test_validated_goes_to_cdc_watermark(self):
        assert route_after_human_review({"is_validated": True}) == "cdc_watermark"

    def test_not_validated_goes_to_chat_modifier(self):
        assert route_after_human_review({"is_validated": False}) == "chat_modifier"

    def test_missing_is_validated_defaults_false(self):
        assert route_after_human_review({}) == "chat_modifier"


# ─── route_etl_execution ──────────────────────────────────────────────────────

class TestRouteEtlExecution:
    def test_success_goes_to_lineage_tracker(self):
        state = {"etl_status": "success", "retry_count": 0}
        assert route_etl_execution(state) == "lineage_tracker"

    def test_failed_with_retries_goes_to_healer(self):
        for retry in range(MAX_RETRIES):
            state = {"etl_status": "failed", "retry_count": retry}
            assert route_etl_execution(state) == "healer", \
                f"Devrait aller vers healer pour retry_count={retry}"

    def test_failed_max_retries_goes_to_end(self):
        """BUG FIX audit P1 : après MAX_RETRIES échecs, on termine sans KeyError."""
        state = {"etl_status": "failed", "retry_count": MAX_RETRIES}
        assert route_etl_execution(state) == END

    def test_unexpected_status_goes_to_end(self):
        """Risque audit : statut inattendu ne doit pas crasher silencieusement."""
        state = {"etl_status": "pending", "retry_count": 0}
        assert route_etl_execution(state) == END

    def test_missing_status_defaults_to_end(self):
        """Aucun KeyError si etl_status ou retry_count sont absents."""
        assert route_etl_execution({}) == END


# ─── route_after_dq ──────────────────────────────────────────────────────────

class TestRouteAfterDq:
    def test_high_dq_score_goes_to_drift_detector(self):
        assert route_after_dq({"dq_score": 80}) == "drift_detector"

    def test_low_dq_score_goes_to_human_review_dq(self):
        assert route_after_dq({"dq_score": 30}) == "human_review_dq_alert"

    def test_exactly_50_goes_to_drift_detector(self):
        assert route_after_dq({"dq_score": 50}) == "drift_detector"

    def test_missing_dq_score_defaults_high(self):
        """Aucun KeyError si dq_score absent — défaut 100 = drift_detector."""
        assert route_after_dq({}) == "drift_detector"


# ─── route_after_dq_alert ────────────────────────────────────────────────────

class TestRouteAfterDqAlert:
    def test_validated_goes_to_drift_detector(self):
        assert route_after_dq_alert({"is_validated": True}) == "drift_detector"

    def test_not_validated_goes_to_end(self):
        assert route_after_dq_alert({"is_validated": False}) == END
