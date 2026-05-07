"""Tests multi-tenant : isolation des sessions par user_prefix.

Verifie qu'un utilisateur A avec prefix 'companyA' et un utilisateur B avec
prefix 'companyB' ne peuvent pas voir / modifier les sessions de l'autre.
"""
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

os.environ.setdefault("JWT_SECRET", "test-secret-multitenant-very-long" * 2)
os.environ.setdefault("DB_PASSWORD", "TestPass!")
os.environ.setdefault("BLAZE_API_KEY", "sk-blaze-test")

import pytest


@pytest.fixture(scope="module")
def client():
    sys.modules.setdefault('main', MagicMock())
    _exec_mock = MagicMock()
    _exec_mock._build_engine = MagicMock(side_effect=Exception("DB indispo"))
    sys.modules['nodes.etl_executor'] = _exec_mock
    from fastapi.testclient import TestClient
    from api.server import app
    return TestClient(app)


@pytest.fixture
def isolated_states(monkeypatch):
    """Reset le _pipeline_states dict entre tests."""
    from api.services import etl_service
    etl_service._pipeline_states.clear()
    yield etl_service._pipeline_states
    etl_service._pipeline_states.clear()


class TestSessionIsolation:
    """Verifier que les sessions de A et B sont isolees au niveau du store."""

    def test_two_users_have_separate_states(self, isolated_states):
        from api.services.etl_service import update_pipeline_state, get_pipeline_state
        update_pipeline_state("sess_user_A", {
            "user_id": 1, "user_prefix": "companyA",
            "logical_model": {"fact_tables": [{"name": "fact_sales_A"}]},
        })
        update_pipeline_state("sess_user_B", {
            "user_id": 2, "user_prefix": "companyB",
            "logical_model": {"fact_tables": [{"name": "fact_sales_B"}]},
        })
        state_A = get_pipeline_state("sess_user_A")
        state_B = get_pipeline_state("sess_user_B")
        assert state_A["user_prefix"] == "companyA"
        assert state_B["user_prefix"] == "companyB"
        assert state_A["logical_model"]["fact_tables"][0]["name"] != \
               state_B["logical_model"]["fact_tables"][0]["name"]

    def test_session_id_unknown_returns_empty(self, isolated_states):
        from api.services.etl_service import get_pipeline_state
        state = get_pipeline_state("nonexistent_session_xyz")
        assert state in ({}, None) or state.get("user_prefix") is None

    def test_status_endpoint_404_for_unknown(self, client, isolated_states):
        r = client.get("/api/pipeline-status?session_id=ghost-A-12345")
        assert r.status_code == 404

    def test_user_prefix_propagated_in_session(self, isolated_states):
        from api.services.etl_service import update_pipeline_state, get_pipeline_state
        update_pipeline_state("s1", {"user_prefix": "tenantA"})
        update_pipeline_state("s2", {"user_prefix": "tenantB"})
        assert get_pipeline_state("s1")["user_prefix"] == "tenantA"
        assert get_pipeline_state("s2")["user_prefix"] == "tenantB"


class TestPrefixScoping:
    """Le user_prefix doit prefixer les tables dans le DDL pour eviter les collisions."""

    def test_ddl_uses_user_prefix(self):
        # Mocks pour pouvoir charger modeler
        for m in ['app_state', 'nodes.llm_factory', 'langchain_core',
                  'langchain_core.prompts', 'langchain_core.messages',
                  'langchain_core.language_models',
                  'langchain_core.language_models.chat_models',
                  'langchain_core.outputs',
                  'langgraph', 'langgraph.graph', 'langgraph.graph.message']:
            sys.modules.setdefault(m, MagicMock())

        src = open(ROOT / "nodes" / "modeler.py").read()
        ns = {"__name__": "__test_modeler_mt__"}
        exec(compile(src, "modeler", "exec"), ns)

        model = {
            "fact_tables": [{"name": "fact_orders", "columns": [
                {"name": "id", "type": "BIGINT", "role": "pk"},
                {"name": "amount", "type": "DECIMAL(15,2)", "role": "metric"},
            ]}],
            "dimension_tables": [],
        }
        ddl_A = ns["_generate_ddl"](model, "companyA")
        ddl_B = ns["_generate_ddl"](model, "companyB")
        assert "[companyA_fact_orders]" in ddl_A
        assert "[companyB_fact_orders]" in ddl_B
        assert "[companyA_fact_orders]" not in ddl_B
        assert "[companyB_fact_orders]" not in ddl_A


class TestNoLeakageBetweenSessions:
    """Modifier la session A ne doit jamais affecter la session B."""

    def test_modifying_A_does_not_affect_B(self, isolated_states):
        from api.services.etl_service import update_pipeline_state, get_pipeline_state, _merge
        update_pipeline_state("A", {"user_prefix": "alice", "sql_ddl": "CREATE TABLE alice_t..."})
        update_pipeline_state("B", {"user_prefix": "bob", "sql_ddl": "CREATE TABLE bob_t..."})
        _merge("A", {"sql_ddl": "ALTERED ALICE"})
        assert get_pipeline_state("A")["sql_ddl"] == "ALTERED ALICE"
        # B inchange
        assert get_pipeline_state("B")["sql_ddl"] == "CREATE TABLE bob_t..."
        assert get_pipeline_state("B")["user_prefix"] == "bob"
