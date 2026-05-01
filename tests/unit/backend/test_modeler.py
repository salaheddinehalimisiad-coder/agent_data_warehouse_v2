"""Tests pour nodes/modeler.py - helpers _generate_ddl, _to_tsql, _is_*."""
import sys
from pathlib import Path
from unittest.mock import MagicMock

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

# Mock langchain
for m in ['langchain_core', 'langchain_core.prompts', 'langchain_core.messages',
          'langchain_core.language_models', 'langchain_core.language_models.chat_models',
          'langchain_core.outputs']:
    sys.modules.setdefault(m, MagicMock())

# Charger directement
SRC = open(ROOT / "nodes" / "modeler.py", encoding="utf-8").read()
NS = {"__name__": "__test_modeler__"}
exec(compile(SRC, "modeler", "exec"), NS)

import pytest


# ─── Type detection helpers ──────────────────────────────────────────────

class TestTypeHelpers:
    def test_is_num_int(self):
        assert NS["_is_num"]("INT") is True

    def test_is_num_decimal(self):
        assert NS["_is_num"]("DECIMAL(15,2)") is True

    def test_is_num_string_false(self):
        assert NS["_is_num"]("NVARCHAR(255)") is False

    def test_is_dt_date(self):
        assert NS["_is_dt"]("DATE") is True

    def test_is_dt_datetime(self):
        assert NS["_is_dt"]("DATETIME") is True

    def test_is_id_with_underscore_id(self):
        assert NS["_is_id"]("customer_id") is True

    def test_is_id_simple(self):
        assert NS["_is_id"]("id") is True

    def test_is_id_negative(self):
        assert NS["_is_id"]("name") is False


class TestToTsql:
    def test_pk(self):
        assert NS["_to_tsql"]("INT", "id", "pk") == "BIGINT IDENTITY(1,1)"

    def test_fk(self):
        assert NS["_to_tsql"]("INT", "customer_sk", "fk") == "BIGINT"

    def test_date(self):
        assert NS["_to_tsql"]("datetime", "order_date") == "DATE"

    def test_int(self):
        assert NS["_to_tsql"]("int", "qty") == "INT"

    def test_string_default(self):
        assert NS["_to_tsql"]("varchar", "name") == "NVARCHAR(255)"


# ─── DDL generation ──────────────────────────────────────────────────────

class TestGenerateDDL:
    @pytest.fixture
    def simple_model(self):
        return {
            "fact_table": {
                "name": "fact_orders",
                "columns": [
                    {"name": "order_sk", "type": "BIGINT IDENTITY(1,1)", "role": "pk"},
                    {"name": "customer_sk", "type": "BIGINT", "role": "fk"},
                    {"name": "amount", "type": "DECIMAL(15,2)", "role": "metric"},
                ],
            },
            "dimension_tables": [
                {
                    "name": "dim_customer",
                    "columns": [
                        {"name": "customer_sk", "type": "BIGINT IDENTITY(1,1)", "role": "pk"},
                        {"name": "name", "type": "NVARCHAR(255)", "role": "attribute"},
                    ],
                }
            ],
        }

    def test_includes_prefix(self, simple_model):
        ddl = NS["_generate_ddl"](simple_model, "myprefix")
        assert "[myprefix_fact_orders]" in ddl
        assert "[myprefix_dim_customer]" in ddl

    def test_includes_columns(self, simple_model):
        ddl = NS["_generate_ddl"](simple_model, "test")
        assert "[order_sk]" in ddl
        assert "[customer_sk]" in ddl
        assert "[amount]" in ddl
        assert "[name]" in ddl

    def test_includes_index_on_fk(self, simple_model):
        ddl = NS["_generate_ddl"](simple_model, "test")
        # Index sur les FK de la fact
        assert "idx_fact_orders_customer_sk" in ddl

    def test_includes_quarantine_table(self, simple_model):
        ddl = NS["_generate_ddl"](simple_model, "test")
        assert "test_rejets_fact_orders" in ddl

    def test_constellation_multiple_facts(self):
        model = {
            "fact_tables": [
                {"name": "fact_sales", "columns": [{"name": "x", "type": "INT", "role": "metric"}]},
                {"name": "fact_inventory", "columns": [{"name": "y", "type": "INT", "role": "metric"}]},
            ],
            "dimension_tables": [],
        }
        ddl = NS["_generate_ddl"](model, "dw")
        assert "fact_sales" in ddl
        assert "fact_inventory" in ddl
        assert "Constellation" in ddl

    def test_empty_model_returns_header_only(self):
        ddl = NS["_generate_ddl"]({}, "dw")
        assert "Star Schema" in ddl or "Constellation" in ddl
        # Pas de CREATE TABLE
        assert "CREATE TABLE" not in ddl


class TestParseJson:
    def test_valid_json(self):
        result = NS["_parse_json"]('{"a": 1, "b": 2}')
        assert result == {"a": 1, "b": 2}

    def test_with_markdown_fence(self):
        result = NS["_parse_json"]('```json\n{"x": 42}\n```')
        assert result == {"x": 42}

    def test_invalid_returns_empty(self):
        assert NS["_parse_json"]("not json at all") == {}

    def test_extracts_json_from_prose(self):
        text = "Voici la reponse: {\"a\": 1} et c'est fini."
        result = NS["_parse_json"](text)
        assert result == {"a": 1}
