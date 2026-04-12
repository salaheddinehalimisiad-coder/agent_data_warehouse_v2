# tests/conftest.py — Configuration pytest globale
import os
import sys
import pytest

# Variables d'environnement pour les tests (évite de charger un vrai .env)
os.environ.setdefault("DB_PASSWORD", "test_password")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-not-for-production")
os.environ.setdefault("PASSWORD_SALT", "test-salt")
os.environ.setdefault("GOOGLE_API_KEY", "test-key")
os.environ.setdefault("OLLAMA_BASE_URL", "http://localhost:11434")
os.environ.setdefault("ENVIRONMENT", "test")

# Path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


@pytest.fixture(scope="session")
def sample_csv_path(tmp_path_factory):
    """Crée un CSV de test temporaire."""
    import pandas as pd
    tmp = tmp_path_factory.mktemp("data")
    csv_path = tmp / "test_ventes.csv"
    df = pd.DataFrame({
        "id_vente": range(1, 11),
        "date": ["2024-01-01"] * 10,
        "client_id": [f"C{i:03d}" for i in range(1, 11)],
        "produit": ["Laptop", "Souris", "Clavier"] * 3 + ["Écran"],
        "montant": [1200.0, 25.0, 75.0] * 3 + [350.0],
    })
    df.to_csv(csv_path, index=False)
    return str(csv_path)


@pytest.fixture
def sample_state():
    """State LangGraph minimal pour les tests."""
    return {
        "messages": [],
        "connection_config": {"type": "csv", "file_path": "test.csv"},
        "dw_connection_config": {"host": "localhost", "database": "dw_test"},
        "source_metadata": {
            "ventes": {
                "row_count": 1500,
                "col_count": 5,
                "columns": [
                    {"name": "id_vente", "dtype": "int64", "nunique": 1500, "null_count": 0},
                    {"name": "date", "dtype": "object", "nunique": 365, "null_count": 0},
                    {"name": "montant", "dtype": "float64", "nunique": 500, "null_count": 0},
                ],
            }
        },
        "schema_fingerprint": "",
        "schema_drift_detected": False,
        "schema_drift_details": "",
        "logical_model": {
            "fact_table": {
                "name": "fact_ventes",
                "description": "Table de faits",
                "columns": [
                    {"name": "vente_sk", "type": "BIGINT AUTO_INCREMENT", "role": "pk"},
                    {"name": "date_sk", "type": "BIGINT", "role": "fk"},
                    {"name": "montant", "type": "DECIMAL(15,4)", "role": "metric"},
                ],
            },
            "dimension_tables": [
                {
                    "name": "dim_date",
                    "description": "Dimension temporelle",
                    "columns": [
                        {"name": "date_sk", "type": "BIGINT AUTO_INCREMENT", "role": "pk"},
                        {"name": "date_full", "type": "DATE", "role": "attribute"},
                    ],
                }
            ],
        },
        "logical_model_version": 1,
        "sql_ddl": "CREATE TABLE IF NOT EXISTS `dw_dim_date` (`date_sk` BIGINT AUTO_INCREMENT PRIMARY KEY);",
        "previous_sql_ddl": "",
        "critic_review": "VERDICT: APPROVED",
        "critic_approved": True,
        "is_validated": False,
        "hitl_comment": "",
        "etl_code": "<transformation><info><n>Test</n></info></transformation>",
        "etl_status": "pending",
        "etl_error": "",
        "heal_history": [],
        "retry_count": 0,
        "lineage": {},
        "execution_log": ["[Explorer] Source analysée", "[Modeler] Star Schema v1 conçu"],
        "user_id": 1,
        "user_prefix": "test",
    }
