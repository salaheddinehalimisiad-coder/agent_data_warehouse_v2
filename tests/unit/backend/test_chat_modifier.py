"""Tests pour nodes/chat_modifier.py - gate, regex, patch ops."""
import sys
from unittest.mock import MagicMock
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

# Mock modules absents lors du test unitaire
for m in ['app_state', 'nodes.llm_factory', 'nodes.modeler',
          'langchain_core', 'langchain_core.prompts', 'langchain_core.messages',
          'langchain_core.language_models', 'langchain_core.language_models.chat_models',
          'langchain_core.outputs', 'langgraph', 'langgraph.graph',
          'langgraph.checkpoint', 'langgraph.checkpoint.memory']:
    sys.modules.setdefault(m, MagicMock())

import pytest

# Charger directement le code source
SRC = open(ROOT / "nodes" / "chat_modifier.py", encoding="utf-8").read()
NS = {"__name__": "__test_chat_modifier__"}
exec(compile(SRC, "chat_modifier", "exec"), NS)

is_simple = NS["_is_simple_single_op_request"]
det_modify = NS["_deterministic_modify"]
apply_ops = NS["_apply_ops"]
find_table = NS["_find_table"]


@pytest.fixture
def sample_model():
    return {
        "fact_tables": [{
            "name": "fact_orders",
            "columns": [
                {"name": "order_sk", "type": "BIGINT", "role": "pk"},
                {"name": "date_sk", "type": "BIGINT", "role": "fk"},
                {"name": "amount", "type": "DECIMAL(15,2)", "role": "metric"},
            ],
        }],
        "dimension_tables": [{
            "name": "dim_employee",
            "columns": [
                {"name": "employee_sk", "type": "BIGINT", "role": "pk"},
                {"name": "reportsto", "type": "DECIMAL(15,4)", "role": "attribute"},
            ],
        }, {
            "name": "dim_client",
            "columns": [{"name": "client_sk", "type": "BIGINT", "role": "pk"}],
        }],
    }


# ─── Gate _is_simple_single_op_request ──────────────────────────────────

class TestSimpleGate:
    def test_short_explicit_add_column(self):
        assert is_simple("Ajoute la colonne total_ttc de type DECIMAL(15,2)") is True

    def test_short_rename_table(self):
        assert is_simple("Renomme la table dim_client en dim_customer") is True

    def test_short_drop_column(self):
        assert is_simple("Supprime la colonne deprecated_id de dim_product") is True

    def test_long_request_blocked(self):
        long_req = "Tu es expert. " + ("Ajoute une colonne X. " * 20)
        assert is_simple(long_req) is False

    def test_multiline_blocked(self):
        assert is_simple("Ajoute X.\nRenomme Y.") is False

    def test_numbered_list_blocked(self):
        assert is_simple("1. Ajoute X 2. Supprime Y") is False

    def test_two_verbs_blocked(self):
        assert is_simple("Ajoute la colonne X et renomme la colonne Y") is False

    def test_orphan_un_blocked(self):
        # Le piege historique : 'ajoute une mesure' ne doit PAS passer
        assert is_simple("Ajoute une mesure calculée net_amount") is False
        assert is_simple("Ajoute une ligne Membre Inconnu") is False
        assert is_simple("Ajoute un flag is_first_line") is False
        assert is_simple("Ajoute des contraintes FK") is False


# ─── Fallback deterministe ──────────────────────────────────────────────

class TestDeterministic:
    def test_add_column_simple(self, sample_model):
        nm, summary = det_modify(sample_model, "Ajoute la colonne total_ttc de type DECIMAL(15,2) dans fact_orders")
        assert nm is not None
        assert "total_ttc" in summary
        cols = nm["fact_tables"][0]["columns"]
        assert any(c["name"] == "total_ttc" for c in cols)
        col = next(c for c in cols if c["name"] == "total_ttc")
        assert col["type"] == "DECIMAL(15,2)"
        assert col["role"] == "metric"  # 'total' detecte comme metric

    def test_rename_table(self, sample_model):
        nm, summary = det_modify(sample_model, "Renomme la table dim_client en dim_customer")
        assert nm is not None
        names = [d["name"] for d in nm["dimension_tables"]]
        assert "dim_customer" in names
        assert "dim_client" not in names

    def test_rename_column(self, sample_model):
        nm, summary = det_modify(sample_model, "Renomme la colonne reportsto en reports_to_employee_id")
        assert nm is not None
        emp = next(d for d in nm["dimension_tables"] if d["name"] == "dim_employee")
        cols = [c["name"] for c in emp["columns"]]
        assert "reports_to_employee_id" in cols
        assert "reportsto" not in cols

    def test_drop_column(self, sample_model):
        nm, summary = det_modify(sample_model, "Supprime la colonne amount de fact_orders")
        assert nm is not None
        cols = [c["name"] for c in nm["fact_tables"][0]["columns"]]
        assert "amount" not in cols

    def test_complex_request_returns_none(self, sample_model):
        # Demande complexe -> pas de fallback regex
        complex_req = "Modifie fact_orders pour avoir order_date_sk, required_date_sk, shipped_date_sk. Ajoute net_amount. Corrige reportsto en INT."
        nm, summary = det_modify(sample_model, complex_req)
        assert nm is None
        assert summary == ""


# ─── Patch operations ───────────────────────────────────────────────────

class TestPatchOps:
    def test_add_column_op(self, sample_model):
        ops = [{"op": "add_column", "table": "fact_orders",
                "column": {"name": "net_amount", "type": "DECIMAL(15,4)", "role": "metric"}}]
        nm, log = apply_ops(sample_model, ops)
        cols = [c["name"] for c in nm["fact_tables"][0]["columns"]]
        assert "net_amount" in cols
        assert any("net_amount" in entry for entry in log)

    def test_change_type_op(self, sample_model):
        ops = [{"op": "change_column_type", "table": "dim_employee",
                "column": "reportsto", "type": "INT"}]
        nm, log = apply_ops(sample_model, ops)
        emp = next(d for d in nm["dimension_tables"] if d["name"] == "dim_employee")
        col = next(c for c in emp["columns"] if c["name"] == "reportsto")
        assert col["type"] == "INT"

    def test_split_date_key_op(self, sample_model):
        ops = [{
            "op": "split_date_key",
            "table": "fact_orders",
            "old_column": "date_sk",
            "new_columns": [
                {"name": "order_date_sk", "nullable": False},
                {"name": "required_date_sk", "nullable": False},
                {"name": "shipped_date_sk", "nullable": True},
            ],
        }]
        nm, log = apply_ops(sample_model, ops)
        cols = [c["name"] for c in nm["fact_tables"][0]["columns"]]
        assert "date_sk" not in cols
        assert "order_date_sk" in cols
        assert "required_date_sk" in cols
        assert "shipped_date_sk" in cols

    def test_unknown_op_logs_failure(self, sample_model):
        ops = [{"op": "do_magic", "table": "fact_orders"}]
        nm, log = apply_ops(sample_model, ops)
        assert any("inconnue" in entry.lower() or "unknown" in entry.lower() for entry in log)

    def test_drop_nonexistent_logs_failure(self, sample_model):
        ops = [{"op": "drop_column", "table": "fact_orders", "column": "ghost"}]
        nm, log = apply_ops(sample_model, ops)
        assert any("absente" in entry.lower() or "absent" in entry.lower() for entry in log)

    def test_multiple_ops_chained(self, sample_model):
        ops = [
            {"op": "add_column", "table": "fact_orders",
             "column": {"name": "net_amount", "type": "DECIMAL(15,4)", "role": "computed"}},
            {"op": "change_column_type", "table": "dim_employee",
             "column": "reportsto", "type": "INT"},
            {"op": "rename_table", "old": "dim_client", "new": "dim_customer"},
        ]
        nm, log = apply_ops(sample_model, ops)
        # Verifier les 3 changements
        cols_fact = [c["name"] for c in nm["fact_tables"][0]["columns"]]
        assert "net_amount" in cols_fact
        emp = next(d for d in nm["dimension_tables"] if d["name"] == "dim_employee")
        rt = next(c for c in emp["columns"] if c["name"] == "reportsto")
        assert rt["type"] == "INT"
        names = [d["name"] for d in nm["dimension_tables"]]
        assert "dim_customer" in names
