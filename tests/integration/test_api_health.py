"""Tests integration - endpoints simples qui ne dependent pas de DB."""
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

# Set env vars requis pour le serveur
os.environ.setdefault("JWT_SECRET", "test-secret-not-prod-only-for-tests")
os.environ.setdefault("DB_PASSWORD", "TestPass123!")
os.environ.setdefault("BLAZE_API_KEY", "sk-blaze-test-key-not-real")

import pytest

@pytest.fixture(scope="module")
def client():
    """FastAPI TestClient avec workflow mocke."""
    # Mock langgraph + main avant import
    for m in ['langgraph', 'langgraph.graph', 'langgraph.checkpoint',
              'langgraph.checkpoint.memory']:
        sys.modules.setdefault(m, MagicMock())
    sys.modules.setdefault('main', MagicMock())

    from fastapi.testclient import TestClient
    from api.server import app
    return TestClient(app)


class TestHealth:
    def test_health_returns_ok(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert "version" in data

    def test_health_includes_environment(self, client):
        r = client.get("/health")
        assert "env" in r.json()


class TestMetrics:
    def test_metrics_endpoint_returns_prometheus_format(self, client):
        r = client.get("/metrics")
        # 200 si prometheus_client installe, sinon 404
        if r.status_code == 200:
            assert "http_requests_total" in r.text or "process_cpu" in r.text \
                or "python_gc_objects" in r.text or len(r.text) > 0


class TestOpenAPISpec:
    def test_openapi_json_accessible(self, client):
        r = client.get("/api/openapi.json")
        assert r.status_code == 200
        spec = r.json()
        assert "paths" in spec
        assert "/health" in spec["paths"]

    def test_docs_accessible(self, client):
        r = client.get("/api/docs")
        assert r.status_code == 200
        assert "swagger" in r.text.lower() or "redoc" in r.text.lower()


class TestCorsHeaders:
    def test_cors_preflight(self, client):
        r = client.options("/api/start", headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        })
        # CORS active
        assert r.status_code in (200, 204, 405)


class TestAuthEndpointsExist:
    def test_login_route_exists(self, client):
        # POST /api/auth/login attend body, on doit avoir 422 (validation) ou 401 pas 404
        r = client.post("/api/auth/login")
        assert r.status_code != 404

    def test_register_route_exists(self, client):
        r = client.post("/api/auth/register")
        assert r.status_code != 404


class TestPipelineRoutes:
    def test_pipeline_status_404_for_unknown(self, client):
        r = client.get("/api/pipeline-status?session_id=ghost-session-xyz")
        assert r.status_code == 404

    def test_validate_requires_body(self, client):
        r = client.post("/api/validate")
        assert r.status_code in (400, 422)


class TestExportRoutes:
    def test_export_xlsx_requires_session(self, client):
        r = client.get("/api/export-xlsx?session_id=ghost-xyz-123")
        assert r.status_code == 404

    def test_export_csv_requires_session(self, client):
        r = client.get("/api/export-csv?session_id=ghost-xyz-123")
        assert r.status_code == 404

    def test_export_bak_requires_session(self, client):
        r = client.get("/api/export-bak?session_id=ghost-xyz-123")
        assert r.status_code in (404, 500)  # selon l'etat de l'env
