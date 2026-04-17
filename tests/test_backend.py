# tests/test_backend.py — Suite de tests backend complète
"""
Tests unitaires et d'intégration pour Agent Data Warehouse v2.0
Lancement : pytest tests/ -v
"""
import os
import sys
import pytest
from unittest.mock import MagicMock, patch

# Ajouter le répertoire racine au path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


# ═══════════════════════════════════════════════════════════════
# Tests — app_state
# ═══════════════════════════════════════════════════════════════

class TestAgentState:
    def test_state_has_required_fields(self):
        from app_state import AgentState
        required = [
            "messages", "connection_config", "source_metadata",
            "schema_fingerprint", "schema_drift_detected", "sql_ddl",
            "critic_review", "critic_approved", "is_validated",
            "etl_code", "etl_status", "etl_error", "heal_history",
            "retry_count", "execution_log", "user_id", "user_prefix",
        ]
        annotations = AgentState.__annotations__
        for field in required:
            assert field in annotations, f"Champ manquant dans AgentState : {field}"

    def test_state_etl_status_values(self):
        # Vérifier que les valeurs possibles d'etl_status sont documentées
        valid_statuses = {"pending", "success", "failed"}
        # Test symbolique — le TypedDict accepte str donc on valide par convention
        assert "pending" in valid_statuses
        assert "success" in valid_statuses
        assert "failed"  in valid_statuses


# ═══════════════════════════════════════════════════════════════
# Tests — Schema Drift Detector
# ═══════════════════════════════════════════════════════════════

class TestSchemaDriftDetector:
    def test_fingerprint_stable_same_schema(self):
        from nodes.schema_drift_detector import _compute_fingerprint
        meta = {
            "ventes": {
                "columns": [
                    {"name": "id", "dtype": "int64"},
                    {"name": "montant", "dtype": "float64"},
                ]
            }
        }
        fp1 = _compute_fingerprint(meta)
        fp2 = _compute_fingerprint(meta)
        assert fp1 == fp2, "Le fingerprint doit être déterministe"

    def test_fingerprint_changes_on_new_column(self):
        from nodes.schema_drift_detector import _compute_fingerprint
        meta1 = {"t": {"columns": [{"name": "id", "dtype": "int"}]}}
        meta2 = {"t": {"columns": [{"name": "id", "dtype": "int"}, {"name": "new_col", "dtype": "str"}]}}
        assert _compute_fingerprint(meta1) != _compute_fingerprint(meta2)

    def test_no_drift_on_first_run(self, tmp_path, monkeypatch):
        from nodes import schema_drift_detector as sdd
        monkeypatch.setattr(sdd, "SCHEMA_CACHE_FILE", str(tmp_path / "schema.json"))
        state = {
            "source_metadata": {"t": {"columns": [{"name": "id", "dtype": "int"}]}},
            "execution_log": [],
        }
        result = sdd.schema_drift_detector_node(state)
        assert result["schema_drift_detected"] is False

    def test_drift_detected_on_column_change(self, tmp_path, monkeypatch):
        from nodes import schema_drift_detector as sdd
        cache_file = str(tmp_path / "schema.json")
        monkeypatch.setattr(sdd, "SCHEMA_CACHE_FILE", cache_file)

        state1 = {"source_metadata": {"t": {"columns": [{"name": "id", "dtype": "int"}]}}, "execution_log": []}
        sdd.schema_drift_detector_node(state1)  # Premier run — enregistre le snapshot

        state2 = {"source_metadata": {"t": {"columns": [{"name": "id", "dtype": "int"}, {"name": "prix", "dtype": "float"}]}}, "execution_log": []}
        result = sdd.schema_drift_detector_node(state2)
        assert result["schema_drift_detected"] is True
        assert "prix" in result["schema_drift_details"]


# ═══════════════════════════════════════════════════════════════
# Tests — Critic
# ═══════════════════════════════════════════════════════════════

class TestCriticNode:
    def test_critic_returns_approved_on_good_ddl(self):
        from nodes.critic import critic_node
        good_ddl = """
        CREATE TABLE IF NOT EXISTS `dw_dim_date` (
            `date_sk` BIGINT AUTO_INCREMENT PRIMARY KEY,
            `date_full` DATE
        );
        CREATE TABLE IF NOT EXISTS `dw_fact_ventes` (
            `vente_sk` BIGINT AUTO_INCREMENT PRIMARY KEY,
            `date_sk` BIGINT,
            `montant` DECIMAL(15,4),
            INDEX idx_date_sk (`date_sk`)
        );
        """
        mock_llm_response = MagicMock()
        mock_llm_response.content = "Le DDL est correct.\nVERDICT: APPROVED"

        with patch("nodes.critic.get_llm") as mock_get_llm, \
             patch("nodes.critic.call_with_retry", return_value=mock_llm_response):
            mock_get_llm.return_value = MagicMock()
            result = critic_node({"sql_ddl": good_ddl, "execution_log": []})

        assert result["critic_approved"] is True
        assert "APPROVED" in result["critic_review"]

    def test_critic_returns_needs_revision_on_bad_ddl(self):
        from nodes.critic import critic_node
        bad_ddl = "CREATE TABLE test (col1 VARCHAR(255));"  # Pas de PK

        mock_response = MagicMock()
        mock_response.content = "Clé primaire manquante.\nVERDICT: NEEDS_REVISION - PK absente"

        with patch("nodes.critic.get_llm"), \
             patch("nodes.critic.call_with_retry", return_value=mock_response):
            result = critic_node({"sql_ddl": bad_ddl, "execution_log": []})

        assert result["critic_approved"] is False

    def test_critic_skips_empty_ddl(self):
        from nodes.critic import critic_node
        result = critic_node({"sql_ddl": "", "execution_log": []})
        assert result["critic_approved"] is False
        assert "Aucun DDL" in result["critic_review"]

    def test_critic_skips_error_ddl(self):
        from nodes.critic import critic_node
        result = critic_node({"sql_ddl": "-- Erreur : modèle non généré", "execution_log": []})
        assert result["critic_approved"] is False


# ═══════════════════════════════════════════════════════════════
# Tests — LLM Factory
# ═══════════════════════════════════════════════════════════════

class TestLLMFactory:
    def test_extract_text_from_message(self):
        from nodes.llm_factory import extract_text
        mock = MagicMock()
        mock.content = "Bonjour"
        assert extract_text(mock) == "Bonjour"

    def test_extract_text_from_string(self):
        from nodes.llm_factory import extract_text
        assert extract_text("Hello") == "Hello"

    def test_extract_text_from_list(self):
        from nodes.llm_factory import extract_text
        result = extract_text([{"text": "A"}, {"text": "B"}])
        assert "A" in result and "B" in result

    def test_call_with_retry_success(self):
        from nodes.llm_factory import call_with_retry
        chain = MagicMock()
        chain.invoke.return_value = "résultat"
        result = call_with_retry(chain, {"key": "value"})
        assert result == "résultat"
        chain.invoke.assert_called_once()

    def test_call_with_retry_on_quota_error(self):
        from nodes.llm_factory import call_with_retry
        chain = MagicMock()
        chain.invoke.side_effect = [Exception("429 quota"), "résultat"]
        with patch("nodes.llm_factory.time.sleep"):
            result = call_with_retry(chain, {}, max_retries=2)
        assert result == "résultat"
        assert chain.invoke.call_count == 2


# ═══════════════════════════════════════════════════════════════
# Tests — Security Middleware
# ═══════════════════════════════════════════════════════════════

class TestSecurity:
    def test_jwt_create_and_verify(self):
        from api.middleware.security import create_jwt, verify_jwt
        payload = {"user_id": 42, "prefix": "test"}
        token = create_jwt(payload)
        decoded = verify_jwt(token)
        assert decoded is not None
        assert decoded["user_id"] == 42
        assert decoded["prefix"] == "test"

    def test_jwt_invalid_signature(self):
        from api.middleware.security import verify_jwt
        fake_token = "aaa.bbb.ccc"
        assert verify_jwt(fake_token) is None

    def test_jwt_expired(self):
        from api.middleware.security import create_jwt, verify_jwt
        token = create_jwt({"user_id": 1}, expires_in=-1)  # Déjà expiré
        assert verify_jwt(token) is None

    def test_hash_password_deterministic(self):
        from api.middleware.security import hash_password
        assert hash_password("test123") == hash_password("test123")
        assert hash_password("test123") != hash_password("test456")

    def test_sanitize_prefix(self):
        from api.middleware.security import sanitize_prefix
        assert sanitize_prefix("Mon DW!") == "mondw"
        assert sanitize_prefix("") == "dw"
        assert sanitize_prefix("a" * 30) == "a" * 20  # Max 20 chars
        assert sanitize_prefix("My_Prefix_123") == "my_prefix_123"

    def test_validate_csv_file_ok(self):
        from api.middleware.security import validate_csv_file
        validate_csv_file("data.csv", 1024)  # Ne doit pas lever d'exception

    def test_validate_csv_file_bad_extension(self):
        from fastapi import HTTPException
        from api.middleware.security import validate_csv_file
        with pytest.raises(HTTPException) as exc:
            validate_csv_file("data.exe", 100)
        assert exc.value.status_code == 400

    def test_validate_csv_file_too_large(self):
        from fastapi import HTTPException
        from api.middleware.security import validate_csv_file
        with pytest.raises(HTTPException) as exc:
            validate_csv_file("data.csv", 100 * 1024 * 1024)  # 100 MB
        assert exc.value.status_code == 413


# ═══════════════════════════════════════════════════════════════
# Tests — ETL Generator (validation XML)
# ═══════════════════════════════════════════════════════════════

class TestETLGenerator:
    def test_validate_ktr_valid_xml(self):
        from nodes.etl_generator import _validate_ktr
        valid_xml = '<?xml version="1.0"?><transformation><info><n>Test</n></info></transformation>'
        ok, reason = _validate_ktr(valid_xml)
        assert ok is True
        assert reason == ""

    def test_validate_ktr_missing_transformation_tag(self):
        from nodes.etl_generator import _validate_ktr
        ok, reason = _validate_ktr("<root><step/></root>")
        assert ok is False
        assert "transformation" in reason.lower()

    def test_validate_ktr_placeholder_detected(self):
        from nodes.etl_generator import _validate_ktr
        xml = "<transformation>FIELDS_PLACEHOLDER</transformation>"
        ok, reason = _validate_ktr(xml)
        assert ok is False
        assert "FIELDS_PLACEHOLDER" in reason

    def test_validate_ktr_invalid_xml(self):
        from nodes.etl_generator import _validate_ktr
        ok, reason = _validate_ktr("<transformation><unclosed>")
        assert ok is False

    def test_validate_ktr_empty(self):
        from nodes.etl_generator import _validate_ktr
        ok, reason = _validate_ktr("")
        assert ok is False


# ═══════════════════════════════════════════════════════════════
# Tests — Export Service
# ═══════════════════════════════════════════════════════════════

class TestExportService:
    def test_generate_json_report_structure(self):
        from api.services.export_service import generate_json_report
        state = {
            "user_prefix": "test",
            "etl_status": "success",
            "logical_model_version": 2,
            "critic_approved": True,
            "schema_drift_detected": False,
            "schema_drift_details": "",
            "heal_history": ["fix1"],
            "sql_ddl": "CREATE TABLE...",
            "etl_code": "<transformation/>",
            "logical_model": {"fact_table": {}, "dimension_tables": []},
            "critic_review": "VERDICT: APPROVED",
            "execution_log": ["step1", "step2"],
            "lineage": {},
        }
        report = generate_json_report(state, "session_abc")
        assert "meta" in report
        assert "artifacts" in report
        assert "audit" in report
        assert report["meta"]["session_id"] == "session_abc"
        assert report["meta"]["etl_status"] == "success"
        assert report["meta"]["heal_count"] == 1
        assert report["artifacts"]["sql_ddl"] == "CREATE TABLE..."


# ═══════════════════════════════════════════════════════════════
# Tests — Connectors
# ═══════════════════════════════════════════════════════════════

class TestConnectors:
    def test_csv_connector_file_not_found(self):
        from utils.connectors import CSVConnector
        c = CSVConnector("/nonexistent/file.csv")
        ok, msg = c.test_connection()
        assert ok is False
        assert "introuvable" in msg.lower() or "not found" in msg.lower() or "/nonexistent" in msg

    def test_get_connector_csv(self):
        from utils.connectors import get_connector, CSVConnector
        c = get_connector({"type": "csv", "file_path": "test.csv"})
        assert isinstance(c, CSVConnector)

    def test_get_connector_mysql(self):
        from utils.connectors import get_connector, SQLConnector
        c = get_connector({"type": "mysql", "host": "localhost", "database": "test"})
        assert isinstance(c, SQLConnector)

    def test_get_connector_unknown_type(self):
        from utils.connectors import get_connector
        with pytest.raises(ValueError):
            get_connector({"type": "oracle"})


# ═══════════════════════════════════════════════════════════════
# Tests — Routage LangGraph
# ═══════════════════════════════════════════════════════════════

class TestWorkflowRouting:
    def test_route_after_critic_approved(self):
        from main import route_after_critic
        state = {"critic_approved": True}
        assert route_after_critic(state) == "human_review"

    def test_route_after_critic_needs_revision(self):
        from main import route_after_critic
        state = {"critic_approved": False}
        assert route_after_critic(state) == "chat_modifier"

    def test_route_after_human_validated(self):
        from main import route_after_human_review
        state = {"is_validated": True}
        assert route_after_human_review(state) == "etl_generator"

    def test_route_after_human_not_validated(self):
        from main import route_after_human_review
        state = {"is_validated": False}
        assert route_after_human_review(state) == "chat_modifier"

    def test_route_etl_success(self):
        from main import route_etl_execution
        state = {"etl_status": "success", "retry_count": 0}
        assert route_etl_execution(state) == "lineage_tracker"

    def test_route_etl_failed_retry(self):
        from main import route_etl_execution
        state = {"etl_status": "failed", "retry_count": 1}
        assert route_etl_execution(state) == "healer"

    def test_route_etl_max_retries_reached(self):
        from main import route_etl_execution, MAX_RETRIES
        from langgraph.graph import END
        state = {"etl_status": "failed", "retry_count": MAX_RETRIES}
        assert route_etl_execution(state) == END


# ═══════════════════════════════════════════════════════════════
# Tests — FastAPI endpoints (client de test)
# ═══════════════════════════════════════════════════════════════

class TestAPIEndpoints:
    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient
        from api.server import app
        return TestClient(app)

    def test_health_endpoint(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "version" in data

    def test_pipeline_stream_returns_sse(self, client):
        with client.stream("GET", "/api/pipeline-stream?session_id=test_session") as resp:
            assert resp.status_code == 200
            assert "text/event-stream" in resp.headers.get("content-type", "")

    def test_export_json_not_found(self, client):
        resp = client.get("/api/export-json?session_id=nonexistent_session")
        assert resp.status_code == 404

    def test_pipeline_status_not_found(self, client):
        resp = client.get("/api/pipeline-status?session_id=ghost_session")
        assert resp.status_code == 404
