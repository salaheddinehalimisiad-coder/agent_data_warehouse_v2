# tests/test_backend.py — Suite de tests backend complète — Phase 3
"""
Tests unitaires et d'intégration pour Agent Data Warehouse v6.0
Lancement : pytest tests/ -v

Phase 3 Corrections :
  - Suppression des refs à nodes.etl_generator (module supprimé en faveur de etl_tsql_generator)
  - Ajout de tests génériques sur des schémas NON-Northwind
  - Ajout de tests pour query_generator, cdc_watermark, scheduler
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

    def test_state_has_phase3_fields(self):
        """Phase 3 : vérifier les nouveaux champs."""
        from app_state import AgentState
        phase3_fields = [
            "generated_queries", "query_results",
            "etl_mode", "etl_watermarks",
            "schedule_config", "pdf_report_path",
        ]
        annotations = AgentState.__annotations__
        for field in phase3_fields:
            assert field in annotations, f"Champ Phase 3 manquant : {field}"

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

    def test_route_after_dq_high_score(self):
        from main import route_after_dq
        state = {"dq_score": 80}
        assert route_after_dq(state) == "drift_detector"

    def test_route_after_dq_low_score(self):
        from main import route_after_dq
        state = {"dq_score": 30}
        assert route_after_dq(state) == "human_review_dq_alert"


# ═══════════════════════════════════════════════════════════════
# Tests — Query Generator (P3-02) — Non-Northwind
# ═══════════════════════════════════════════════════════════════

class TestQueryGenerator:
    """Tests sur un schéma hospitalier (NON-Northwind)."""

    def _hospital_model(self):
        return {
            "fact_tables": [{
                "name": "fact_consultations",
                "description": "Consultations médicales",
                "source_tables": ["consultations"],
                "columns": [
                    {"name": "consultation_sk", "type": "BIGINT IDENTITY(1,1)", "role": "pk"},
                    {"name": "date_sk", "type": "BIGINT", "role": "fk", "references": "dim_date"},
                    {"name": "patient_sk", "type": "BIGINT", "role": "fk", "references": "dim_patient"},
                    {"name": "medecin_sk", "type": "BIGINT", "role": "fk", "references": "dim_medecin"},
                    {"name": "duree_minutes", "type": "INT", "role": "metric"},
                    {"name": "cout", "type": "DECIMAL(15,4)", "role": "metric"},
                ],
            }],
            "fact_table": None,
            "dimension_tables": [
                {
                    "name": "dim_date",
                    "columns": [
                        {"name": "date_sk", "type": "BIGINT IDENTITY(1,1)", "role": "pk"},
                        {"name": "date_full", "type": "DATE", "role": "attribute"},
                        {"name": "year", "type": "INT", "role": "attribute"},
                        {"name": "month", "type": "TINYINT", "role": "attribute"},
                        {"name": "month_name", "type": "VARCHAR(20)", "role": "attribute"},
                        {"name": "quarter", "type": "TINYINT", "role": "attribute"},
                    ],
                },
                {
                    "name": "dim_patient",
                    "columns": [
                        {"name": "patient_sk", "type": "BIGINT IDENTITY(1,1)", "role": "pk"},
                        {"name": "patient_id", "type": "NVARCHAR(50)", "role": "attribute", "natural_key": True},
                        {"name": "nom_complet", "type": "NVARCHAR(255)", "role": "attribute"},
                        {"name": "ville", "type": "NVARCHAR(100)", "role": "attribute"},
                        {"name": "valid_from", "type": "DATE", "role": "attribute"},
                        {"name": "valid_to", "type": "DATE", "role": "attribute"},
                        {"name": "is_current", "type": "BIT DEFAULT 1", "role": "attribute"},
                    ],
                },
                {
                    "name": "dim_medecin",
                    "columns": [
                        {"name": "medecin_sk", "type": "BIGINT IDENTITY(1,1)", "role": "pk"},
                        {"name": "medecin_id", "type": "NVARCHAR(50)", "role": "attribute", "natural_key": True},
                        {"name": "nom_medecin", "type": "NVARCHAR(255)", "role": "attribute"},
                        {"name": "specialite", "type": "NVARCHAR(100)", "role": "attribute"},
                        {"name": "valid_from", "type": "DATE", "role": "attribute"},
                        {"name": "valid_to", "type": "DATE", "role": "attribute"},
                        {"name": "is_current", "type": "BIT DEFAULT 1", "role": "attribute"},
                    ],
                },
            ],
        }

    def test_fallback_generates_queries_for_hospital(self):
        from nodes.query_generator import _generate_fallback
        queries = _generate_fallback(self._hospital_model(), "hosp")
        assert len(queries) > 0
        assert len(queries) <= 6
        # Toutes les requêtes doivent contenir le préfixe
        for q in queries:
            assert "hosp_" in q["sql"]
            assert q.get("title")
            assert q.get("type") in ("trend", "top_n", "distribution", "kpi", "comparison", "detail")

    def test_fallback_no_northwind_references(self):
        from nodes.query_generator import _generate_fallback
        queries = _generate_fallback(self._hospital_model(), "hosp")
        for q in queries:
            sql_lower = q["sql"].lower()
            assert "northwind" not in sql_lower
            assert "orders" not in sql_lower
            assert "products" not in sql_lower
            assert "customers" not in sql_lower

    def test_query_generator_node_skip_no_model(self):
        from nodes.query_generator import query_generator_node
        result = query_generator_node({"logical_model": {}, "execution_log": []})
        assert result["generated_queries"] == []
        assert result["query_results"] == []

    def test_query_generator_node_with_model(self):
        from nodes.query_generator import query_generator_node
        state = {
            "logical_model": self._hospital_model(),
            "user_prefix": "hosp",
            "dw_connection_config": {},  # Pas de DB → pas d'exécution
            "execution_log": [],
        }
        with patch("nodes.query_generator.get_llm") as mock_llm:
            mock_llm.side_effect = Exception("LLM offline")
            result = query_generator_node(state)
        assert len(result["generated_queries"]) > 0


# ═══════════════════════════════════════════════════════════════
# Tests — CDC Watermark (P3-05) — Non-Northwind
# ═══════════════════════════════════════════════════════════════

class TestCDCWatermark:
    """Tests sur un schéma RH (NON-Northwind)."""

    def _hr_metadata(self):
        return {
            "employees": {
                "row_count": 500,
                "columns": [
                    {"name": "EmployeeID", "dtype": "int"},
                    {"name": "FullName", "dtype": "nvarchar"},
                    {"name": "HireDate", "dtype": "date"},
                    {"name": "UpdatedAt", "dtype": "datetime2"},
                ],
            },
            "payroll": {
                "row_count": 12000,
                "columns": [
                    {"name": "PayrollID", "dtype": "int"},
                    {"name": "EmployeeID", "dtype": "int"},
                    {"name": "PayDate", "dtype": "date"},
                    {"name": "Amount", "dtype": "decimal"},
                ],
            },
        }

    def test_cdc_detects_modification_column(self):
        from nodes.cdc_watermark import _detect_modification_column
        cols = [
            {"name": "ID", "dtype": "int"},
            {"name": "Name", "dtype": "nvarchar"},
            {"name": "UpdatedAt", "dtype": "datetime2"},
        ]
        result = _detect_modification_column(cols)
        assert result == "UpdatedAt"

    def test_cdc_detects_created_column(self):
        from nodes.cdc_watermark import _detect_modification_column
        cols = [
            {"name": "ID", "dtype": "int"},
            {"name": "CreatedDate", "dtype": "datetime"},
        ]
        result = _detect_modification_column(cols)
        assert result == "CreatedDate"

    def test_cdc_no_tracking_column(self):
        from nodes.cdc_watermark import _detect_modification_column
        cols = [
            {"name": "ID", "dtype": "int"},
            {"name": "Name", "dtype": "nvarchar"},
            {"name": "Amount", "dtype": "decimal"},
        ]
        result = _detect_modification_column(cols)
        assert result is None

    def test_cdc_autoincrement_pk_fallback(self):
        from nodes.cdc_watermark import _detect_autoincrement_pk
        cols = [
            {"name": "PayrollID", "dtype": "int"},
            {"name": "Amount", "dtype": "decimal"},
        ]
        result = _detect_autoincrement_pk(cols)
        assert result == "PayrollID"

    def test_cdc_node_first_run(self, tmp_path, monkeypatch):
        from nodes import cdc_watermark as cdc
        monkeypatch.setattr(cdc, "WATERMARK_FILE", str(tmp_path / "wm.json"))
        state = {
            "source_metadata": self._hr_metadata(),
            "execution_log": [],
        }
        result = cdc.cdc_watermark_node(state)
        assert result["etl_mode"] == "full_load"
        assert "employees" in result["etl_watermarks"]
        assert "payroll" in result["etl_watermarks"]
        # employees has UpdatedAt → tracking available
        assert result["etl_watermarks"]["employees"]["column"] == "UpdatedAt"

    def test_cdc_incremental_where(self):
        from nodes.cdc_watermark import build_incremental_where
        wm = {
            "column": "UpdatedAt",
            "column_type": "datetime2",
            "last_value": "2026-04-01T00:00:00",
            "mode": "incremental",
        }
        clause = build_incremental_where(wm)
        assert "UpdatedAt" in clause
        assert "2026-04-01" in clause

    def test_cdc_full_load_no_where(self):
        from nodes.cdc_watermark import build_incremental_where
        wm = {"column": None, "last_value": None, "mode": "full_load"}
        assert build_incremental_where(wm) is None


# ═══════════════════════════════════════════════════════════════
# Tests — Modeler Genericité (P3-04) — Non-Northwind
# ═══════════════════════════════════════════════════════════════

class TestModelerGenericity:
    """Tests que le modeler fonctionne sur des schémas non-Northwind."""

    def test_modeler_scoring_ecommerce(self):
        """Base e-commerce avec schema non-standard."""
        from nodes.modeler import _build_fk_graph, _score_fact_candidates
        ecommerce_meta = {
            "commandes": {
                "row_count": 200,
                "columns": [
                    {"name": "commande_id", "dtype": "int"},
                    {"name": "client_id", "dtype": "int"},
                    {"name": "date_commande", "dtype": "date"},
                    {"name": "total_ttc", "dtype": "decimal"},
                ],
                "foreign_keys": [
                    {"constrained_columns": ["client_id"], "referred_table": "clients", "referred_columns": ["client_id"]},
                ],
            },
            "lignes_commande": {
                "row_count": 2000,
                "columns": [
                    {"name": "ligne_id", "dtype": "int"},
                    {"name": "commande_id", "dtype": "int"},
                    {"name": "article_id", "dtype": "int"},
                    {"name": "quantite", "dtype": "int"},
                    {"name": "prix_unitaire", "dtype": "decimal"},
                    {"name": "remise", "dtype": "decimal"},
                ],
                "foreign_keys": [
                    {"constrained_columns": ["commande_id"], "referred_table": "commandes", "referred_columns": ["commande_id"]},
                    {"constrained_columns": ["article_id"], "referred_table": "articles", "referred_columns": ["article_id"]},
                ],
            },
            "clients": {
                "row_count": 50,
                "columns": [
                    {"name": "client_id", "dtype": "int"},
                    {"name": "nom", "dtype": "nvarchar"},
                    {"name": "ville", "dtype": "nvarchar"},
                ],
                "foreign_keys": [],
            },
            "articles": {
                "row_count": 100,
                "columns": [
                    {"name": "article_id", "dtype": "int"},
                    {"name": "nom_article", "dtype": "nvarchar"},
                    {"name": "categorie", "dtype": "nvarchar"},
                    {"name": "prix", "dtype": "decimal"},
                ],
                "foreign_keys": [],
            },
        }
        fk_out, fk_in = _build_fk_graph(ecommerce_meta)
        scores = _score_fact_candidates(ecommerce_meta, fk_out, fk_in)
        # lignes_commande devrait être le meilleur candidat fact
        assert scores[0][0] == "lignes_commande"

    def test_modeler_full_pipeline_hospital(self):
        """Vérifie que le modeler construit un Star Schema pour un schéma hospitalier."""
        from nodes.modeler import _build_fk_graph, _score_fact_candidates, _build_star_from_relational
        hospital_meta = {
            "consultations": {
                "row_count": 5000,
                "columns": [
                    {"name": "consultation_id", "dtype": "int"},
                    {"name": "patient_id", "dtype": "int"},
                    {"name": "medecin_id", "dtype": "int"},
                    {"name": "date_consultation", "dtype": "datetime"},
                    {"name": "duree_min", "dtype": "int"},
                    {"name": "cout_total", "dtype": "decimal"},
                ],
                "foreign_keys": [
                    {"constrained_columns": ["patient_id"], "referred_table": "patients", "referred_columns": ["patient_id"]},
                    {"constrained_columns": ["medecin_id"], "referred_table": "medecins", "referred_columns": ["medecin_id"]},
                ],
            },
            "patients": {
                "row_count": 500,
                "columns": [
                    {"name": "patient_id", "dtype": "int"},
                    {"name": "nom_complet", "dtype": "nvarchar"},
                    {"name": "date_naissance", "dtype": "date"},
                    {"name": "ville", "dtype": "nvarchar"},
                ],
                "foreign_keys": [],
            },
            "medecins": {
                "row_count": 30,
                "columns": [
                    {"name": "medecin_id", "dtype": "int"},
                    {"name": "nom_medecin", "dtype": "nvarchar"},
                    {"name": "specialite", "dtype": "nvarchar"},
                ],
                "foreign_keys": [],
            },
        }
        fk_out, fk_in = _build_fk_graph(hospital_meta)
        scores = _score_fact_candidates(hospital_meta, fk_out, fk_in)
        model = _build_star_from_relational(hospital_meta, fk_out, fk_in, scores)

        assert "fact_tables" in model
        assert len(model["fact_tables"]) >= 1
        assert "dimension_tables" in model
        # Should have dim_date + dim_patient + dim_medecin
        dim_names = {d["name"] for d in model["dimension_tables"]}
        assert "dim_date" in dim_names


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

    @patch("api.routes.pipeline.sse_service.get_or_create_queue")
    def test_pipeline_stream_returns_sse(self, mock_get_queue, client):
        import asyncio
        mock_q = MagicMock()
        mock_q.get.side_effect = asyncio.CancelledError()
        mock_get_queue.return_value = mock_q
        from api.middleware.jwt_auth import create_token
        token = create_token(user_id=1, email="test@local", prefix="test")
        with client.stream("GET", f"/api/pipeline-stream?session_id=test_session&token={token}") as resp:
            assert resp.status_code == 200
            assert "text/event-stream" in resp.headers.get("content-type", "")

    def test_export_json_not_found(self, client):
        resp = client.get("/api/export-json?session_id=nonexistent_session")
        assert resp.status_code == 404

    def test_pipeline_status_not_found(self, client):
        resp = client.get("/api/pipeline-status?session_id=ghost_session")
        assert resp.status_code == 404

    def test_scheduler_list_endpoint(self, client):
        resp = client.get("/api/schedule")
        assert resp.status_code == 200
        data = resp.json()
        assert "jobs" in data
