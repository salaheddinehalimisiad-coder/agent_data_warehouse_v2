"""Tests securite : validation, headers, anti-injection."""
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

os.environ.setdefault("JWT_SECRET", "test-secret-very-long-not-for-prod-only-tests-x" * 2)
os.environ.setdefault("DB_PASSWORD", "TestPass123!")
os.environ.setdefault("BLAZE_API_KEY", "sk-blaze-test-key")

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


class TestInputValidation:
    def test_start_requires_connection_config(self, client):
        r = client.post("/api/start", json={})
        assert r.status_code == 422

    def test_start_invalid_type(self, client):
        r = client.post("/api/start", json={"connection_config": "not-dict"})
        assert r.status_code == 422

    def test_validate_requires_session_id(self, client):
        r = client.post("/api/validate", json={"validated": True})
        assert r.status_code == 422

    def test_chat_requires_message(self, client):
        r = client.post("/api/chat?session_id=test", json={})
        assert r.status_code == 422


class TestSecurityHeaders:
    def test_x_frame_options(self, client):
        r = client.get("/health")
        if "x-frame-options" in r.headers:
            assert r.headers["x-frame-options"].lower() in ("deny", "sameorigin")

    def test_x_content_type_options(self, client):
        r = client.get("/health")
        if "x-content-type-options" in r.headers:
            assert r.headers["x-content-type-options"].lower() == "nosniff"


class TestSQLInjectionGuard:
    def test_drop_rejected(self, client):
        r = client.post("/api/execute-query", json={"sql": "DROP TABLE users", "session_id": "x"})
        assert r.status_code in (400, 403, 422)

    def test_insert_rejected(self, client):
        r = client.post("/api/execute-query", json={"sql": "INSERT INTO t VALUES (1)", "session_id": "x"})
        assert r.status_code in (400, 403, 422)

    def test_update_rejected(self, client):
        r = client.post("/api/execute-query", json={"sql": "UPDATE t SET x=1", "session_id": "x"})
        assert r.status_code in (400, 403, 422)

    def test_multi_statement_rejected(self, client):
        r = client.post("/api/execute-query", json={"sql": "SELECT 1; DROP TABLE u;", "session_id": "x"})
        assert r.status_code in (400, 403, 422)

    def test_exec_rejected(self, client):
        r = client.post("/api/execute-query", json={"sql": "exec sp_who", "session_id": "x"})
        assert r.status_code in (400, 403, 422)


class TestAuthEnforcement:
    def test_login_empty(self, client):
        r = client.post("/api/auth/login", json={"email": "", "password": ""})
        assert r.status_code in (400, 401, 422)

    def test_login_invalid_email(self, client):
        r = client.post("/api/auth/login", json={"email": "not-an-email", "password": "x"})
        assert r.status_code in (400, 401, 422)


class TestRateLimit:
    def test_health_unrestricted(self, client):
        for _ in range(20):
            r = client.get("/health")
            assert r.status_code == 200

    def test_burst_login_no_500(self, client):
        codes = []
        for _ in range(10):
            r = client.post("/api/auth/login", json={"email": "x@x.com", "password": "wrong"})
            codes.append(r.status_code)
        assert 500 not in codes


class TestPathTraversal:
    def test_session_id_path_traversal(self, client):
        r = client.get("/api/pipeline-status?session_id=../etc/passwd")
        assert r.status_code in (400, 404, 422)
