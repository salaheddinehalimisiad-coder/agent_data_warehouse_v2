# app_state.py — État LangGraph v3.0
"""
v3.0 — Nouveaux champs :
  dq_report : rapport Data Quality complet
  dq_score  : score DQ global 0-100
  dq_alerts : liste d'alertes DQ [{severity, table, column, rule, detail}]
  lineage   : graphe de lignage source → DW
"""
from typing import Annotated, Any, Dict, List
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict


class AgentState(TypedDict, total=False):
    # ─── Messages LangChain ────────────────────────────────────────────────
    messages: Annotated[list, add_messages]

    # ─── Config connexions ─────────────────────────────────────────────────
    connection_config:    Dict[str, Any]
    dw_connection_config: Dict[str, Any]

    # ─── Auth utilisateur ──────────────────────────────────────────────────
    user_id:     int
    user_prefix: str

    # ─── Exploration ──────────────────────────────────────────────────────
    source_metadata: Dict[str, Any]

    # ─── Data Quality (NOUVEAU v3) ─────────────────────────────────────────
    dq_report:  Dict[str, Any]     # rapport complet {global_score, tables, ...}
    dq_score:   float              # score 0-100
    dq_alerts:  List[Dict]         # [{severity, table, column, rule, detail}]

    # ─── Drift Detector ────────────────────────────────────────────────────
    schema_fingerprint:    str
    schema_drift_detected: bool
    schema_drift_details:  str

    # ─── Modélisation ──────────────────────────────────────────────────────
    logical_model:         Dict[str, Any]
    logical_model_version: int
    previous_sql_ddl:      str
    sql_ddl:               str

    # ─── Critique ─────────────────────────────────────────────────────────
    critic_review:    str
    critic_approved:  bool

    # ─── Human-in-the-Loop ─────────────────────────────────────────────────
    is_validated: bool
    hitl_comment: str

    # ─── ETL ──────────────────────────────────────────────────────────────
    etl_code:    str
    etl_status:  str    # "pending" | "success" | "failed"
    etl_error:   str
    retry_count: int
    heal_history: List[str]

    # ─── Lineage (NOUVEAU v3) ──────────────────────────────────────────────
    lineage: Dict[str, Any]    # {table_name: {type, nodes, edges}}

    # ─── Post-Run Insights (NOUVEAU v4.0) ──────────────────────────────────
    load_metrics:      Dict[str, Any]
    executive_summary: str
    visualizations:    List[Dict]
    node_durations:    Dict[str, float]
    data_catalog:      Dict[str, Any]
    clean_action:      str
    airflow_dag:       str
    dbt_project:       Dict[str, str]
    governance_report: Dict[str, Any]
    masking_sql:       str
    mock_data_sql:     str


    # ─── Journal ──────────────────────────────────────────────────────────
    execution_log: List[str]

    # ─── Session (optionnel, pour le tracking) ────────────────────────────
    session_id: str
