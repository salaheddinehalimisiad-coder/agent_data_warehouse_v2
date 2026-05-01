"""Tests pour api/middleware/observability.py."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

import pytest
from api.middleware.observability import (
    _normalize_path, JSONLogFormatter, configure_json_logs,
)


class TestNormalizePath:
    def test_simple_path(self):
        assert _normalize_path("/api/health") == "/api/health"

    def test_path_with_uuid(self):
        # Long ids alphanum avec digit -> {id}
        norm = _normalize_path("/api/sessions/abc123def456ghi")
        assert "{id}" in norm

    def test_path_with_numeric_id(self):
        norm = _normalize_path("/api/users/12345678")
        assert "{id}" in norm

    def test_root(self):
        assert _normalize_path("/") == "/"


class TestJSONLogFormatter:
    def test_formats_basic_record(self):
        import logging
        formatter = JSONLogFormatter()
        record = logging.LogRecord(
            name="test", level=logging.INFO, pathname="t.py",
            lineno=1, msg="hello %s", args=("world",),
            exc_info=None,
        )
        out = formatter.format(record)
        assert "hello world" in out
        assert '"level"' in out
        assert '"INFO"' in out
        assert '"logger"' in out

    def test_includes_extra_fields(self):
        import logging
        formatter = JSONLogFormatter()
        record = logging.LogRecord(
            name="t", level=logging.WARNING, pathname="t.py",
            lineno=1, msg="x", args=(), exc_info=None,
        )
        record.session_id = "sess-123"
        out = formatter.format(record)
        assert "sess-123" in out
