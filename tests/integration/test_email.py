"""Tests integration : notification email avec mock SMTP."""
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-email-tests" * 2)
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
def fake_session(monkeypatch):
    """Cree une session fake avec quelques metriques."""
    from api.services import etl_service
    sid = "sess_email_test"
    etl_service.update_pipeline_state(sid, {
        "user_id": 1,
        "user_prefix": "tenant_test",
        "etl_status": "success",
        "dq_score": 92,
        "logical_model": {"fact_tables": [{"name": "fact_orders"}]},
    })
    yield sid
    etl_service._pipeline_states.pop(sid, None)


class TestEmailEndpoint:
    def test_notify_email_unknown_session_returns_404(self, client):
        r = client.post("/api/notify-email", json={
            "session_id": "nonexistent",
            "email": "test@example.com",
        })
        assert r.status_code == 404

    def test_notify_email_invalid_email_format(self, client, fake_session):
        # Pydantic devrait rejeter "not-an-email" si validation stricte;
        # sinon le service renverra sent=False
        r = client.post("/api/notify-email", json={
            "session_id": fake_session,
            "email": "not-an-email",
        })
        assert r.status_code in (200, 400, 422)

    def test_notify_email_with_smtp_mock(self, client, fake_session):
        """Mock le service email pour eviter SMTP reel."""
        from api.services import email_service

        with patch.object(email_service, "send_pipeline_complete_email", return_value=True) as mock_send:
            r = client.post("/api/notify-email", json={
                "session_id": fake_session,
                "email": "user@example.com",
                "include_pdf": False,
            })
            assert r.status_code == 200
            data = r.json()
            assert data["sent"] is True
            assert data["email"] == "user@example.com"
            mock_send.assert_called_once()

    def test_notify_email_smtp_failure_returns_sent_false(self, client, fake_session):
        from api.services import email_service

        with patch.object(email_service, "send_pipeline_complete_email", return_value=False):
            r = client.post("/api/notify-email", json={
                "session_id": fake_session,
                "email": "user@example.com",
                "include_pdf": False,
            })
            assert r.status_code == 200
            assert r.json()["sent"] is False

    def test_notify_email_pdf_generation_failure_doesnt_crash(self, client, fake_session):
        """Si la generation PDF echoue, on doit quand meme tenter d'envoyer."""
        from api.services import email_service, export_service

        with patch.object(export_service, "generate_pdf_report",
                          side_effect=Exception("PDF gen failed")), \
             patch.object(email_service, "send_pipeline_complete_email",
                          return_value=True) as mock_send:
            r = client.post("/api/notify-email", json={
                "session_id": fake_session,
                "email": "user@example.com",
                "include_pdf": True,
            })
            assert r.status_code == 200
            assert r.json()["sent"] is True
            # PDF=None passe au service
            args = mock_send.call_args[0]
            assert args[3] is None  # pdf_path = None


class TestEmailValidation:
    def test_missing_email_field(self, client, fake_session):
        r = client.post("/api/notify-email", json={"session_id": fake_session})
        assert r.status_code in (400, 422)

    def test_missing_session_id(self, client):
        r = client.post("/api/notify-email", json={"email": "u@e.com"})
        assert r.status_code in (400, 422)

    def test_empty_body(self, client):
        r = client.post("/api/notify-email", json={})
        assert r.status_code in (400, 422)
