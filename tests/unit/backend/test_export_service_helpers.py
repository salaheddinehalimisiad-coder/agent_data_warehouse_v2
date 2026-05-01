"""Tests pour les helpers de api/services/export_service.py."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

import pytest


def _import_helpers():
    """Charger uniquement les helpers (sans openpyxl) en evitant le module complet."""
    src = open(ROOT / "api" / "services" / "export_service.py", encoding="utf-8").read()
    # On va executer juste les fonctions helper
    ns = {"__name__": "__test_export__", "logger": __import__("logging").getLogger(),
          "datetime": __import__("datetime").datetime, "os": __import__("os")}
    # Extraire _coerce_cell, _iter_result_tables, _sanitize_sheet_name
    import re
    for fname in ["_coerce_cell", "_iter_result_tables", "_sanitize_sheet_name"]:
        m = re.search(rf"^def {fname}\(.+?(?=\n\n\ndef |\n\n# ─|\Z)",
                      src, re.DOTALL | re.MULTILINE)
        if m:
            exec(m.group(0), ns)
    return ns


class TestCoerceCell:
    def setup_method(self):
        self.ns = _import_helpers()

    def test_none(self):
        assert self.ns["_coerce_cell"](None) == ""

    def test_str(self):
        assert self.ns["_coerce_cell"]("hello") == "hello"

    def test_int(self):
        assert self.ns["_coerce_cell"](42) == 42

    def test_float(self):
        assert self.ns["_coerce_cell"](3.14) == 3.14

    def test_bool(self):
        assert self.ns["_coerce_cell"](True) is True

    def test_list_serialized(self):
        out = self.ns["_coerce_cell"]([1, 2, 3])
        assert isinstance(out, str)
        assert "1" in out and "2" in out

    def test_dict_serialized(self):
        out = self.ns["_coerce_cell"]({"a": 1})
        assert isinstance(out, str)
        assert "a" in out


class TestSanitizeSheetName:
    def setup_method(self):
        self.ns = _import_helpers()

    def test_truncates_to_31(self):
        long_name = "A" * 50
        out = self.ns["_sanitize_sheet_name"](long_name)
        assert len(out) <= 31

    def test_strips_invalid_chars(self):
        out = self.ns["_sanitize_sheet_name"]("my:bad/name?")
        for c in ":/?":
            assert c not in out

    def test_empty_returns_default(self):
        out = self.ns["_sanitize_sheet_name"]("")
        assert out == "sheet"


class TestIterResultTables:
    def setup_method(self):
        self.ns = _import_helpers()

    def test_query_results(self):
        state = {
            "query_results": [
                {"title": "top10", "columns": ["a", "b"], "rows": [[1, 2], [3, 4]]}
            ]
        }
        out = list(self.ns["_iter_result_tables"](state))
        assert len(out) == 1
        name, rows = out[0]
        assert name == "top10"
        assert rows == [{"a": 1, "b": 2}, {"a": 3, "b": 4}]

    def test_etl_samples(self):
        state = {
            "etl_samples": {
                "fact_orders": [{"id": 1}, {"id": 2}]
            }
        }
        out = list(self.ns["_iter_result_tables"](state))
        assert len(out) == 1

    def test_empty_state(self):
        assert list(self.ns["_iter_result_tables"]({})) == []
