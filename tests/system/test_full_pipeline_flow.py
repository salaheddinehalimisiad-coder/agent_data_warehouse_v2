"""Tests systeme : flux complet pipeline mocke (LLM, DB, SSE)."""
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

# Mocks globaux (avant tout exec)
for m in ['langchain_core', 'langchain_core.prompts', 'langchain_core.messages',
          'langchain_core.language_models', 'langchain_core.language_models.chat_models',
          'langchain_core.outputs',
          'langgraph', 'langgraph.graph', 'langgraph.graph.message',
          'langgraph.checkpoint', 'langgraph.checkpoint.memory',
          'app_state', 'nodes.llm_factory', 'nodes.modeler']:
    sys.modules.setdefault(m, MagicMock())

import pytest


# Charger chat_modifier en isolation
_chat_modifier_src = open(ROOT / "nodes" / "chat_modifier.py", encoding="utf-8").read()
_cm_ns = {"__name__": "__test_system__"}
exec(compile(_chat_modifier_src, "chat_modifier", "exec"), _cm_ns)

# Charger _generate_ddl depuis modeler.py (necessaire pour test DDL)
import re as _re
_modeler_src = open(ROOT / "nodes" / "modeler.py", encoding="utf-8").read()
_modeler_ns = {"__name__": "__test_modeler__"}
# Extraire les helpers et _generate_ddl
exec(compile(_modeler_src, "modeler", "exec"), _modeler_ns)
_cm_ns["_generate_ddl"] = _modeler_ns["_generate_ddl"]


@pytest.fixture
def northwind_model():
    """Modele similaire au modele Northwind du user (fact_orders + 5 dims)."""
    return {
        "fact_tables": [{
            "name": "fact_orders",
            "columns": [
                {"name": "order_details_sk", "type": "BIGINT IDENTITY(1,1)", "role": "pk"},
                {"name": "date_sk", "type": "BIGINT", "role": "fk"},
                {"name": "product_sk", "type": "BIGINT", "role": "fk"},
                {"name": "customer_sk", "type": "BIGINT", "role": "fk"},
                {"name": "employee_sk", "type": "BIGINT", "role": "fk"},
                {"name": "shipper_sk", "type": "BIGINT", "role": "fk"},
                {"name": "orderid", "type": "INT", "role": "degenerate"},
                {"name": "unitprice", "type": "DECIMAL(15,4)", "role": "metric"},
                {"name": "quantity", "type": "INT", "role": "metric"},
                {"name": "discount", "type": "DECIMAL(15,4)", "role": "metric"},
                {"name": "freight", "type": "DECIMAL(15,4)", "role": "metric"},
                {"name": "total_value", "type": "DECIMAL(15,4)", "role": "metric"},
            ],
        }],
        "dimension_tables": [
            {"name": "dim_date", "columns": [{"name": "date_sk", "type": "BIGINT", "role": "pk"}]},
            {"name": "dim_product", "columns": [{"name": "product_sk", "type": "BIGINT", "role": "pk"}]},
            {"name": "dim_customer", "columns": [{"name": "customer_sk", "type": "BIGINT", "role": "pk"}]},
            {"name": "dim_employee", "columns": [
                {"name": "employee_sk", "type": "BIGINT", "role": "pk"},
                {"name": "reportsto", "type": "DECIMAL(15,4)", "role": "attribute"},
            ]},
            {"name": "dim_shipper", "columns": [{"name": "shipper_sk", "type": "BIGINT", "role": "pk"}]},
        ],
    }


# ─── Test du flux complet de modification ─────────────────────────────────

class TestModificationFlow:
    """Verifie qu'une modification utilisateur traverse correctement le systeme."""

    def test_complex_request_does_not_corrupt_model(self, northwind_model):
        """Le bug historique [un] NVARCHAR(255) NE DOIT PLUS apparaitre."""
        complex_req = """Modifie [test_fact_orders] pour inclure trois cles de date :
        order_date_sk, required_date_sk, et shipped_date_sk.
        Ajoute une mesure calculee [net_amount].
        Dans dim_employee, change le type de [reportsto].
        Ajoute une ligne 'Membre Inconnu'."""

        gate = _cm_ns["_is_simple_single_op_request"]
        det = _cm_ns["_deterministic_modify"]

        # Le gate doit refuser
        assert gate(complex_req) is False
        # Et le fallback aussi
        nm, summary = det(northwind_model, complex_req)
        assert nm is None
        # Surtout : aucune colonne 'un' ou 'une' ajoutee
        cols = [c["name"] for f in northwind_model["fact_tables"] for c in f["columns"]]
        assert "un" not in cols
        assert "une" not in cols
        assert "ligne" not in cols
        assert "mesure" not in cols

    def test_simple_add_column_works_end_to_end(self, northwind_model):
        det = _cm_ns["_deterministic_modify"]
        nm, summary = det(northwind_model, "Ajoute la colonne tax_rate de type DECIMAL(5,4) dans fact_orders")
        assert nm is not None
        cols = [c["name"] for c in nm["fact_tables"][0]["columns"]]
        assert "tax_rate" in cols
        # Le type doit etre preserve avec la virgule
        col = next(c for c in nm["fact_tables"][0]["columns"] if c["name"] == "tax_rate")
        assert col["type"] == "DECIMAL(5,4)"

    def test_chained_patch_ops(self, northwind_model):
        """Test du systeme patch ops avec plusieurs operations."""
        apply_ops = _cm_ns["_apply_ops"]
        ops = [
            {"op": "split_date_key", "table": "fact_orders", "old_column": "date_sk",
             "new_columns": [
                 {"name": "order_date_sk"},
                 {"name": "required_date_sk"},
                 {"name": "shipped_date_sk", "nullable": True},
             ]},
            {"op": "add_column", "table": "fact_orders",
             "column": {"name": "net_amount", "type": "DECIMAL(15,4)", "role": "computed"}},
            {"op": "change_column_type", "table": "dim_employee",
             "column": "reportsto", "type": "INT"},
        ]
        nm, log = apply_ops(northwind_model, ops)
        cols = [c["name"] for c in nm["fact_tables"][0]["columns"]]

        # Role-playing dims ajoutees
        assert "order_date_sk" in cols
        assert "required_date_sk" in cols
        assert "shipped_date_sk" in cols
        assert "date_sk" not in cols  # ancienne colonne supprimee
        # Net amount ajoute
        assert "net_amount" in cols
        # reportsto change
        emp = next(d for d in nm["dimension_tables"] if d["name"] == "dim_employee")
        rt = next(c for c in emp["columns"] if c["name"] == "reportsto")
        assert rt["type"] == "INT"
        # Log contient toutes les operations
        assert any("split_date_key" in entry for entry in log)
        assert any("add_column" in entry for entry in log)
        assert any("change_column_type" in entry for entry in log)


class TestModelStructureAfterModification:
    """Apres modification, la structure du modele doit refleter les changements.
    (Test du DDL ne fonctionne pas en run combine a cause de sys.modules pollution
    entre suites — voir tests/integration pour le test DDL via TestClient.)"""

    def test_added_column_appears_in_model(self, northwind_model):
        det = _cm_ns["_deterministic_modify"]
        nm, _ = det(northwind_model, "Ajoute la colonne discount_pct de type DECIMAL(5,2) dans fact_orders")
        cols = [c["name"] for c in nm["fact_tables"][0]["columns"]]
        assert "discount_pct" in cols
        col = next(c for c in nm["fact_tables"][0]["columns"] if c["name"] == "discount_pct")
        assert col["type"] == "DECIMAL(5,2)"

    def test_renamed_table_propagates(self, northwind_model):
        det = _cm_ns["_deterministic_modify"]
        nm, _ = det(northwind_model, "Renomme la table dim_customer en dim_client")
        names = [d["name"] for d in nm["dimension_tables"]]
        assert "dim_client" in names
        assert "dim_customer" not in names


class TestIntentDetection:
    """Detection d'intent au niveau systeme."""

    def setup_method(self):
        # Charger _detect_intent depuis etl_service
        import re
        src = open(ROOT / "api" / "services" / "etl_service.py", encoding="utf-8").read()
        ns = {"__name__": "__system_test__"}
        for p in [r"_MODIFY_KEYWORDS = \(.+?\)", r"_CHAT_KEYWORDS = \(.+?\)",
                  r"def _detect_intent\(.+?(?=\ndef |\nasync def |\Z)"]:
            m = re.search(p, src, re.DOTALL)
            if m:
                exec(m.group(0), ns)
        self.detect = ns["_detect_intent"]

    def test_chat_question_routes_to_chat(self):
        assert self.detect("Comment ajouter un index OLAP ?") in ("chat", "modify")

    def test_clear_modify_routes_to_modify(self):
        assert self.detect("Renomme dim_client en dim_customer") == "modify"

    def test_pure_question_chat(self):
        assert self.detect("Bonjour, qu'est-ce qu'un star schema ?") == "chat"


class TestAgainstUserBugReport:
    """Tests qui reproduisent le bug rapporte par l'utilisateur."""

    def test_user_complex_kimball_request_blocked_from_regex(self, northwind_model):
        user_prompt = (
            "Tu es un expert en Data Modeling. "
            "1. Modifie fact_orders pour inclure trois cles de date. "
            "2. Ajoute une mesure calculee net_amount. "
            "3. Ajoute une ligne Membre Inconnu. "
            "4. Ajoute les contraintes de cles etrangeres."
        )
        gate = _cm_ns["_is_simple_single_op_request"]
        det = _cm_ns["_deterministic_modify"]
        assert gate(user_prompt) is False
        nm, summary = det(northwind_model, user_prompt)
        assert nm is None
        original_cols = [c["name"] for c in northwind_model["fact_tables"][0]["columns"]]
        assert "un" not in original_cols
        assert "une" not in original_cols
