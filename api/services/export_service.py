# api/services/export_service.py — P3-03 : Rapport PDF Professionnel 8 Sections
"""
Phase 3 — Rapport PDF professionnel avec 8 sections dynamiques :
  1. En-tête & Métadonnées
  2. Source Database Profile
  3. Data Quality Report
  4. Star/Constellation Schema Design
  5. DDL SQL Server
  6. Pipeline ETL Summary
  7. Analytical Queries & Results
  8. Métriques de Qualité & Journal

Utilise fpdf2 (priorité) ou reportlab (fallback).
Le rapport utilise state['logical_model'] et state['query_results'] — données réelles.
"""
import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


def generate_pdf_report(state: dict, session_id: str) -> str:
    """
    Génère un rapport PDF professionnel du pipeline avec 8 sections dynamiques.
    Retourne le chemin du fichier PDF créé.
    """
    # Essayer fpdf2 d'abord (plus flexible pour les tables complexes)
    try:
        return _generate_pdf_fpdf2(state, session_id)
    except ImportError:
        logger.info("[Export] fpdf2 non disponible, fallback sur reportlab")

    # Fallback reportlab
    try:
        return _generate_pdf_reportlab(state, session_id)
    except ImportError:
        raise RuntimeError(
            "Ni fpdf2 ni reportlab ne sont installés. "
            "Ajoutez 'fpdf2>=2.7.0' ou 'reportlab>=4.2.0' à requirements.txt"
        )


def _generate_pdf_fpdf2(state: dict, session_id: str) -> str:
    """Génère le rapport PDF avec fpdf2."""
    from fpdf import FPDF

    os.makedirs("outputs", exist_ok=True)
    pdf_path = f"outputs/{session_id}_report.pdf"
    generated_at = datetime.now().strftime("%d/%m/%Y à %H:%M")

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)

    # ── Couleurs du thème ────────────────────────────────────────────────────
    primary = (99, 102, 241)   # Indigo
    dark = (30, 41, 59)
    gray = (100, 116, 139)
    success = (5, 150, 105)
    warning = (217, 119, 6)
    bg_light = (248, 250, 252)

    def _section_title(title: str):
        pdf.set_font("Helvetica", "B", 14)
        pdf.set_text_color(*primary)
        pdf.cell(0, 10, title, new_x="LMARGIN", new_y="NEXT")
        pdf.set_draw_color(*primary)
        pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
        pdf.ln(4)
        pdf.set_text_color(*dark)

    def _body_text(text: str, bold=False):
        pdf.set_font("Helvetica", "B" if bold else "", 9)
        pdf.set_text_color(*dark)
        pdf.multi_cell(0, 5, str(text)[:3000])
        pdf.ln(2)

    def _code_block(text: str, max_len: int = 2500):
        pdf.set_font("Courier", "", 7)
        pdf.set_text_color(30, 41, 59)
        pdf.set_fill_color(*bg_light)
        display = str(text)[:max_len]
        if len(str(text)) > max_len:
            display += "\n-- [tronqué...]"
        pdf.multi_cell(0, 4, display, fill=True)
        pdf.ln(3)

    def _kv_table(data: list):
        """Table clé-valeur."""
        pdf.set_font("Helvetica", "", 9)
        col_w = [50, 130]
        for key, val in data:
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(*primary)
            pdf.cell(col_w[0], 6, str(key))
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*dark)
            pdf.cell(col_w[1], 6, str(val)[:80], new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)

    def _data_table(columns: list, rows: list, max_rows: int = 15):
        """Table de données avec en-têtes."""
        if not columns or not rows:
            return
        n_cols = min(len(columns), 6)
        col_w = (pdf.w - pdf.l_margin - pdf.r_margin) / n_cols

        # Header
        pdf.set_font("Helvetica", "B", 7)
        pdf.set_fill_color(*primary)
        pdf.set_text_color(255, 255, 255)
        for col in columns[:n_cols]:
            pdf.cell(col_w, 6, str(col)[:20], border=1, fill=True)
        pdf.ln()

        # Rows
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(*dark)
        for i, row in enumerate(rows[:max_rows]):
            pdf.set_fill_color(255, 255, 255) if i % 2 == 0 else pdf.set_fill_color(*bg_light)
            for val in row[:n_cols]:
                cell_val = str(val)[:18] if val is not None else "NULL"
                pdf.cell(col_w, 5, cell_val, border=1, fill=True)
            pdf.ln()
        if len(rows) > max_rows:
            pdf.set_font("Helvetica", "I", 7)
            pdf.set_text_color(*gray)
            pdf.cell(0, 5, f"... {len(rows) - max_rows} lignes supplémentaires non affichées",
                     new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 1 : En-tête & Métadonnées
    # ═══════════════════════════════════════════════════════════════════════════
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(*primary)
    pdf.cell(0, 15, "ANTIGRAVITY BI", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(*gray)
    pdf.cell(0, 8, "Rapport d'Exécution Pipeline ETL IA", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(8)

    etl_status = state.get("etl_status", "N/A").upper()
    status_color = success if etl_status == "SUCCESS" else warning

    _kv_table([
        ("Session ID", session_id),
        ("Généré le", generated_at),
        ("Utilisateur", state.get("user_prefix", "N/A")),
        ("Statut ETL", etl_status),
        ("Version modèle", str(state.get("logical_model_version", 0))),
        ("Corrections Healer", str(len(state.get("heal_history", [])))),
        ("Mode ETL", state.get("etl_mode", "full_load")),
    ])

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 2 : Source Database Profile
    # ═══════════════════════════════════════════════════════════════════════════
    _section_title("1. Profil de la Base Source")
    source_meta = state.get("source_metadata", {})
    if source_meta:
        tables_data = []
        for tname, tinfo in source_meta.items():
            if not isinstance(tinfo, dict):
                continue
            cols = tinfo.get("columns", [])
            rows = tinfo.get("row_count", 0)
            fks = len(tinfo.get("foreign_keys", []))
            tables_data.append([tname, str(len(cols)), str(rows), str(fks)])

        if tables_data:
            _data_table(
                ["Table", "Colonnes", "Lignes", "FK"],
                tables_data
            )
            _body_text(f"Total : {len(tables_data)} tables dans la base source")
    else:
        _body_text("Aucune métadonnée source disponible")

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 3 : Data Quality Report
    # ═══════════════════════════════════════════════════════════════════════════
    _section_title("2. Rapport Qualité des Données (DQ)")
    dq_score = state.get("dq_score")
    dq_alerts = state.get("dq_alerts", [])

    if dq_score is not None:
        score_color = success if dq_score >= 70 else warning if dq_score >= 50 else (239, 68, 68)
        pdf.set_font("Helvetica", "B", 16)
        pdf.set_text_color(*score_color)
        pdf.cell(0, 10, f"Score DQ : {dq_score}/100", new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(*dark)
        pdf.ln(3)

    if dq_alerts:
        alerts_data = [
            [a.get("severity", "?"), a.get("table", "?"),
             a.get("column", "?"), a.get("rule", "?")[:30]]
            for a in dq_alerts[:20]
        ]
        _data_table(["Sévérité", "Table", "Colonne", "Règle"], alerts_data)
    else:
        _body_text("Aucune alerte de qualité détectée")

    # SECTION 3 bis : Schema Drift
    if state.get("schema_drift_detected"):
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*warning)
        pdf.cell(0, 8, "DÉRIVE DE SCHÉMA DÉTECTÉE", new_x="LMARGIN", new_y="NEXT")
        _body_text(state.get("schema_drift_details", ""))

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 4 : Star/Constellation Schema Design
    # ═══════════════════════════════════════════════════════════════════════════
    pdf.add_page()
    _section_title("3. Modèle Dimensionnel (Star/Constellation)")
    logical_model = state.get("logical_model", {})

    if logical_model:
        # Fact tables
        fact_tables = logical_model.get("fact_tables", [])
        if not fact_tables:
            ft = logical_model.get("fact_table")
            fact_tables = [ft] if ft else []

        n_facts = len(fact_tables)
        n_dims = len(logical_model.get("dimension_tables", []))
        schema_type = "Constellation" if n_facts > 1 else "Star Schema"

        _body_text(f"Type : {schema_type} — {n_facts} table(s) de faits, {n_dims} dimensions", bold=True)

        for fact in fact_tables:
            if not fact:
                continue
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(*primary)
            pdf.cell(0, 7, f"FACT: {fact.get('name', '?')}", new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(*dark)

            cols_data = [
                [c.get("name", "?"), c.get("type", "?"), c.get("role", "?")]
                for c in fact.get("columns", [])
            ]
            _data_table(["Colonne", "Type", "Rôle"], cols_data)

        for dim in logical_model.get("dimension_tables", []):
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(5, 150, 105)
            pdf.cell(0, 7, f"DIM: {dim.get('name', '?')}", new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(*dark)

            cols_data = [
                [c.get("name", "?"), c.get("type", "?"), c.get("role", "?")]
                for c in dim.get("columns", [])[:10]
            ]
            _data_table(["Colonne", "Type", "Rôle"], cols_data)
    else:
        _body_text("Aucun modèle logique disponible")

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 5 : DDL SQL Server
    # ═══════════════════════════════════════════════════════════════════════════
    _section_title("4. DDL SQL Server — Schéma DW")
    sql_ddl = state.get("sql_ddl", "")
    if sql_ddl:
        _code_block(sql_ddl, max_len=3000)
    else:
        _body_text("DDL non généré")

    # Rapport du Critic
    critic_review = state.get("critic_review", "")
    critic_approved = state.get("critic_approved", False)
    if critic_review:
        verdict = "APPROVED" if critic_approved else "NEEDS_REVISION"
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*(success if critic_approved else warning))
        pdf.cell(0, 7, f"Verdict Critic : {verdict}", new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(*dark)
        _body_text(critic_review[:1500])

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 6 : Pipeline ETL Summary
    # ═══════════════════════════════════════════════════════════════════════════
    pdf.add_page()
    _section_title("5. Pipeline ETL — Résumé des Transformations")
    etl_code = state.get("etl_code", "")
    if etl_code:
        _body_text("Procédures T-SQL MERGE générées :", bold=True)
        _code_block(etl_code, max_len=2000)

    # Load metrics
    load_metrics = state.get("load_metrics", {})
    if load_metrics:
        _body_text("Métriques de chargement :", bold=True)
        metrics_data = []
        if isinstance(load_metrics, dict):
            for key, val in load_metrics.items():
                if isinstance(val, dict):
                    for sub_key, sub_val in val.items():
                        metrics_data.append([f"{key}.{sub_key}", str(sub_val)])
                else:
                    metrics_data.append([str(key), str(val)])
        if metrics_data:
            _data_table(["Métrique", "Valeur"], metrics_data[:20])

    # Healer history
    heal_history = state.get("heal_history", [])
    if heal_history:
        _body_text("Corrections Healer :", bold=True)
        for i, h in enumerate(heal_history, 1):
            _body_text(f"  {i}. {h}")

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 7 : Analytical Queries & Results
    # ═══════════════════════════════════════════════════════════════════════════
    _section_title("6. Requêtes Analytiques")
    query_results = state.get("query_results", [])
    generated_queries = state.get("generated_queries", [])

    queries_to_show = query_results if query_results else generated_queries

    if queries_to_show:
        for i, q in enumerate(queries_to_show, 1):
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(*primary)
            title = q.get("title", f"Requête {i}")
            pdf.cell(0, 7, f"{i}. {title}", new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(*dark)

            desc = q.get("description", "")
            if desc:
                _body_text(desc)

            sql = q.get("sql", "")
            if sql:
                _code_block(sql, max_len=800)

            # Résultats de la requête (si exécutée)
            if q.get("columns") and q.get("rows"):
                _data_table(q["columns"], q["rows"], max_rows=10)
            elif q.get("error"):
                pdf.set_font("Helvetica", "I", 8)
                pdf.set_text_color(*warning)
                pdf.cell(0, 5, f"Erreur : {q['error'][:100]}", new_x="LMARGIN", new_y="NEXT")
                pdf.set_text_color(*dark)
                pdf.ln(3)
    else:
        _body_text("Aucune requête analytique générée")

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 8 : Métriques & Journal d'exécution
    # ═══════════════════════════════════════════════════════════════════════════
    pdf.add_page()
    _section_title("7. Métriques d'Exécution")

    # Node durations
    node_durations = state.get("node_durations", {})
    if node_durations:
        _body_text("Durées par nœud :", bold=True)
        dur_data = [
            [node, f"{dur:.2f}s"]
            for node, dur in sorted(node_durations.items(), key=lambda x: x[1], reverse=True)
        ]
        _data_table(["Nœud", "Durée"], dur_data)

    # Reject metrics
    reject_metrics = state.get("reject_metrics", {})
    if reject_metrics:
        _body_text("Métriques de quarantaine :", bold=True)
        rej_data = [
            [str(k), str(v)] for k, v in reject_metrics.items()
        ]
        _data_table(["Table", "Rejets"], rej_data[:10])

    # CDC Watermarks
    etl_watermarks = state.get("etl_watermarks", {})
    etl_mode = state.get("etl_mode", "")
    if etl_mode:
        _body_text(f"Mode ETL : {etl_mode}", bold=True)
    if etl_watermarks:
        wm_data = [
            [table, info.get("column", "N/A"), info.get("mode", "N/A"),
             str(info.get("last_value", "N/A"))[:30]]
            for table, info in etl_watermarks.items()
            if isinstance(info, dict)
        ]
        _data_table(["Table", "Colonne tracking", "Mode", "Dernière valeur"], wm_data)

    # Journal d'exécution
    _section_title("8. Journal d'Exécution")
    exec_log = state.get("execution_log", [])
    if exec_log:
        for i, entry in enumerate(exec_log[-40:], 1):
            pdf.set_font("Courier", "", 7)
            pdf.set_text_color(*gray)
            pdf.cell(8, 4, str(i))
            pdf.set_text_color(*dark)
            pdf.multi_cell(0, 4, str(entry)[:120])
    else:
        _body_text("Journal vide")

    # ── Pied de page ─────────────────────────────────────────────────────────
    pdf.ln(5)
    pdf.set_font("Helvetica", "I", 7)
    pdf.set_text_color(*gray)
    pdf.cell(0, 5,
             f"Rapport généré par Antigravity BI v6.0 — {generated_at}",
             new_x="LMARGIN", new_y="NEXT", align="C")

    pdf.output(pdf_path)
    logger.info(f"[Export] PDF généré (fpdf2) : {pdf_path}")
    return pdf_path


def _generate_pdf_reportlab(state: dict, session_id: str) -> str:
    """Fallback : rapport PDF avec reportlab."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table,
        TableStyle, HRFlowable, Preformatted
    )
    from reportlab.lib.enums import TA_CENTER

    os.makedirs("outputs", exist_ok=True)
    pdf_path = f"outputs/{session_id}_report.pdf"

    doc = SimpleDocTemplate(
        pdf_path, pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm
    )

    styles = getSampleStyleSheet()
    # Styles personnalisés
    title_style = ParagraphStyle(
        "Title", parent=styles["Title"],
        fontSize=22, textColor=colors.HexColor("#6366f1"),
        spaceAfter=6
    )
    h2_style = ParagraphStyle(
        "H2", parent=styles["Heading2"],
        fontSize=13, textColor=colors.HexColor("#1e293b"),
        spaceBefore=16, spaceAfter=6,
        borderPad=4
    )
    body_style = ParagraphStyle(
        "Body", parent=styles["Normal"],
        fontSize=9, textColor=colors.HexColor("#374151"),
        leading=14
    )
    code_style = ParagraphStyle(
        "Code", parent=styles["Code"],
        fontSize=7, fontName="Courier",
        textColor=colors.HexColor("#1e293b"),
        backColor=colors.HexColor("#f8fafc"),
        borderColor=colors.HexColor("#e2e8f0"),
        borderWidth=1, borderPad=6,
        leading=11
    )
    success_style = ParagraphStyle(
        "Success", parent=body_style,
        textColor=colors.HexColor("#059669"),
        fontName="Helvetica-Bold"
    )
    warning_style = ParagraphStyle(
        "Warning", parent=body_style,
        textColor=colors.HexColor("#d97706"),
        fontName="Helvetica-Bold"
    )

    story = []
    generated_at = datetime.now().strftime("%d/%m/%Y à %H:%M")

    # ── En-tête ────────────────────────────────────────────────────────────────
    story.append(Paragraph("ANTIGRAVITY BI", title_style))
    story.append(Paragraph("Rapport d'exécution du Pipeline ETL IA", styles["Heading3"]))
    story.append(Spacer(1, 0.3*cm))

    # Métadonnées
    meta_data = [
        ["Session ID", session_id],
        ["Généré le", generated_at],
        ["Utilisateur", state.get("user_prefix", "N/A")],
        ["Statut ETL", state.get("etl_status", "N/A").upper()],
        ["Version modèle", str(state.get("logical_model_version", 0))],
        ["Corrections Healer", str(len(state.get("heal_history", [])))],
        ["Mode ETL", state.get("etl_mode", "full_load")],
    ]
    meta_table = Table(meta_data, colWidths=[4*cm, 12*cm])
    meta_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#6366f1")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f8fafc")),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(meta_table)
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0"), spaceAfter=12))

    # ── Data Quality ──────────────────────────────────────────────────────────
    dq_score = state.get("dq_score")
    if dq_score is not None:
        story.append(Paragraph(f"Score DQ : {dq_score}/100", h2_style))

    # ── Schema Drift ──────────────────────────────────────────────────────────
    if state.get("schema_drift_detected"):
        story.append(Paragraph("DÉRIVE DE SCHÉMA DÉTECTÉE", warning_style))
        story.append(Paragraph(state.get("schema_drift_details", ""), body_style))
        story.append(Spacer(1, 0.3*cm))

    # ── Rapport du Critic ──────────────────────────────────────────────────────
    story.append(Paragraph("Rapport du Critic", h2_style))
    critic_review = state.get("critic_review", "Non disponible")
    critic_approved = state.get("critic_approved", False)
    verdict_style = success_style if critic_approved else warning_style
    verdict_label = "APPROVED" if critic_approved else "NEEDS_REVISION"
    story.append(Paragraph(verdict_label, verdict_style))
    story.append(Spacer(1, 0.2*cm))
    critic_text = critic_review[:2000] + ("..." if len(critic_review) > 2000 else "")
    story.append(Paragraph(critic_text.replace("\n", "<br/>"), body_style))

    # ── DDL SQL ────────────────────────────────────────────────────────────────
    sql_ddl = state.get("sql_ddl", "")
    if sql_ddl:
        story.append(Paragraph("DDL SQL — Schéma Data Warehouse", h2_style))
        sql_display = sql_ddl[:3000] + ("\n-- [tronqué...]" if len(sql_ddl) > 3000 else "")
        story.append(Preformatted(sql_display, code_style))

    # ── Requêtes Analytiques ──────────────────────────────────────────────────
    query_results = state.get("query_results", [])
    if query_results:
        story.append(Paragraph("Requêtes Analytiques", h2_style))
        for i, q in enumerate(query_results[:6], 1):
            story.append(Paragraph(f"{i}. {q.get('title', '')}", body_style))
            if q.get("sql"):
                story.append(Preformatted(q["sql"][:500], code_style))

    # ── Code ETL ──────────────────────────────────────────────────────────────
    etl_code = state.get("etl_code", "")
    if etl_code:
        story.append(Paragraph("Procédures ETL T-SQL", h2_style))
        etl_display = etl_code[:2000] + ("\n-- [tronqué...]" if len(etl_code) > 2000 else "")
        story.append(Preformatted(etl_display, code_style))

    # ── Historique Healer ─────────────────────────────────────────────────────
    heal_history = state.get("heal_history", [])
    if heal_history:
        story.append(Paragraph("Historique des corrections Healer", h2_style))
        for i, h in enumerate(heal_history, 1):
            story.append(Paragraph(f"{i}. {h}", body_style))
        story.append(Spacer(1, 0.3*cm))

    # ── Journal d'exécution ───────────────────────────────────────────────────
    exec_log = state.get("execution_log", [])
    if exec_log:
        story.append(Paragraph("Journal d'exécution", h2_style))
        log_data = [[f"{i+1}", entry] for i, entry in enumerate(exec_log[-30:])]
        log_table = Table(log_data, colWidths=[1*cm, 15*cm])
        log_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), "Courier"),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#94a3b8")),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#f1f5f9")),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]))
        story.append(log_table)

    # ── Pied de page ──────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.5*cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0")))
    story.append(Paragraph(
        f"<font size=8 color='#94a3b8'>Rapport généré par Antigravity BI v6.0 — {generated_at}</font>",
        ParagraphStyle("Footer", parent=body_style, alignment=TA_CENTER)
    ))

    doc.build(story)
    logger.info(f"[Export] PDF généré (reportlab) : {pdf_path}")
    return pdf_path


def generate_json_report(state: dict, session_id: str) -> dict:
    """Génère un rapport JSON complet — Phase 3."""
    return {
        "meta": {
            "session_id": session_id,
            "generated_at": datetime.now().isoformat(),
            "user_prefix": state.get("user_prefix"),
            "etl_status": state.get("etl_status"),
            "logical_model_version": state.get("logical_model_version"),
            "critic_approved": state.get("critic_approved"),
            "schema_drift_detected": state.get("schema_drift_detected"),
            "schema_drift_details": state.get("schema_drift_details"),
            "heal_count": len(state.get("heal_history", [])),
            "dq_score": state.get("dq_score"),
            "etl_mode": state.get("etl_mode"),
        },
        "artifacts": {
            "sql_ddl": state.get("sql_ddl"),
            "etl_code": state.get("etl_code"),
            "logical_model": state.get("logical_model"),
            "generated_queries": state.get("generated_queries", []),
        },
        "analytics": {
            "query_results": state.get("query_results", []),
            "executive_summary": state.get("executive_summary"),
            "visualizations": state.get("visualizations", []),
        },
        "quality": {
            "dq_score": state.get("dq_score"),
            "dq_alerts": state.get("dq_alerts", []),
            "reject_metrics": state.get("reject_metrics", {}),
            "etl_watermarks": state.get("etl_watermarks", {}),
        },
        "audit": {
            "critic_review": state.get("critic_review"),
            "heal_history": state.get("heal_history", []),
            "execution_log": state.get("execution_log", []),
            "lineage": state.get("lineage", {}),
            "node_durations": state.get("node_durations", {}),
        },
    }
