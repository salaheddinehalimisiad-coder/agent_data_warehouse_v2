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
    governance_report: Dict[str, Any]
    masking_sql:       str
    source_df:         Any     # DataFrame pandas (étapes ETL)
    sk_maps:           Dict[str, Dict[str, int]] # Mapping Surrogate Keys
    
    # ─── Phase 2 : Constellation & MDM (NOUVEAU v5.0) ──────────────────────
    fact_tables:       List[Dict]   # Multi-fact constellation support
    reject_metrics:    Dict[str, Any]  # Quarantine metrics per fact table
    
    # ─── Backup Flow (NOUVEAU v4.1) ────────────────────────────────────────
    restored_db:       str     # Nom de la base SQL Server restaurée
    is_backup_flow:    bool    # True si on part d'un .bak restauré

    # ─── Phase 3 : Query Generator (NOUVEAU v6.0) ─────────────────────────
    generated_queries: List[Dict]   # [{title, sql, description, type}]
    query_results:     List[Dict]   # [{title, sql, columns, rows, error}]
    queries_schema_context: str     # Contexte du schéma DW injecté dans les prompts

    # ─── Phase 3 : CDC Watermark (NOUVEAU v6.0) ───────────────────────────
    etl_mode:          str          # "full_load" | "incremental"
    etl_watermarks:    Dict[str, Any]  # {table: {column, last_value, last_run}}
    cdc_delta_counts:  Dict[str, int]  # {table_name: nb_rows_changed}

    # ─── Phase 3 : Scheduler (NOUVEAU v6.0) ───────────────────────────────
    schedule_config:   Dict[str, Any]  # {job_id, cron, next_run, ...}

    # ─── Phase 3 : Report (NOUVEAU v6.0) ──────────────────────────────────
    pdf_report_path:   str          # Chemin du dernier rapport PDF généré
    report_sections:   List[Dict[str, Any]] # Sections composées du rapport
    report_language:   str          # 'fr' | 'en' (défaut: 'fr')



    # ─── Journal ──────────────────────────────────────────────────────────
    execution_log: List[str]

    # ─── Session (optionnel, pour le tracking) ────────────────────────────
    session_id: str
