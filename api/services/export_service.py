# api/services/export_service.py — Génération de rapports PDF et JSON professionnels
import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


def generate_pdf_report(state: dict, session_id: str) -> str:
    """
    Génère un rapport PDF professionnel du pipeline.
    Retourne le chemin du fichier PDF créé.
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib import colors
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table,
            TableStyle, HRFlowable, Preformatted
        )
        from reportlab.lib.enums import TA_CENTER
    except ImportError:
        raise RuntimeError(
            "reportlab non installé. Ajoutez 'reportlab' à requirements.txt "
            "et relancez pip install -r requirements.txt"
        )

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
    # (h3_style retiré pour Ruff F841)
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
    # (error_style retiré pour Ruff F841)

    story = []
    generated_at = datetime.now().strftime("%d/%m/%Y à %H:%M")

    # ── En-tête ────────────────────────────────────────────────────────────────
    story.append(Paragraph("🏭 Agent Data Warehouse", title_style))
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

    # ── Schema Drift ──────────────────────────────────────────────────────────
    if state.get("schema_drift_detected"):
        story.append(Paragraph("⚠️ DÉRIVE DE SCHÉMA DÉTECTÉE", warning_style))
        story.append(Paragraph(state.get("schema_drift_details", ""), body_style))
        story.append(Spacer(1, 0.3*cm))

    # ── Rapport du Critic ──────────────────────────────────────────────────────
    story.append(Paragraph("📋 Rapport du Critic", h2_style))
    critic_review = state.get("critic_review", "Non disponible")
    critic_approved = state.get("critic_approved", False)
    verdict_style = success_style if critic_approved else warning_style
    verdict_label = "✅ APPROVED" if critic_approved else "⚠️ NEEDS_REVISION"
    story.append(Paragraph(verdict_label, verdict_style))
    story.append(Spacer(1, 0.2*cm))
    # Tronquer si trop long
    critic_text = critic_review[:2000] + ("..." if len(critic_review) > 2000 else "")
    story.append(Paragraph(critic_text.replace("\n", "<br/>"), body_style))

    # ── DDL SQL ────────────────────────────────────────────────────────────────
    sql_ddl = state.get("sql_ddl", "")
    if sql_ddl:
        story.append(Paragraph("🗄️ DDL SQL — Schéma Data Warehouse", h2_style))
        # Tronquer si très long
        sql_display = sql_ddl[:3000] + ("\n-- [tronqué...]" if len(sql_ddl) > 3000 else "")
        story.append(Preformatted(sql_display, code_style))

    # ── Code ETL ──────────────────────────────────────────────────────────────
    etl_code = state.get("etl_code", "")
    if etl_code:
        story.append(Paragraph("⚙️ Fichier ETL Pentaho (.ktr)", h2_style))
        etl_display = etl_code[:2000] + ("\n<!-- [tronqué...] -->" if len(etl_code) > 2000 else "")
        story.append(Preformatted(etl_display, code_style))

    # ── Historique Healer ─────────────────────────────────────────────────────
    heal_history = state.get("heal_history", [])
    if heal_history:
        story.append(Paragraph("🔧 Historique des corrections Healer", h2_style))
        for i, h in enumerate(heal_history, 1):
            story.append(Paragraph(f"{i}. {h}", body_style))
        story.append(Spacer(1, 0.3*cm))

    # ── Journal d'exécution ───────────────────────────────────────────────────
    exec_log = state.get("execution_log", [])
    if exec_log:
        story.append(Paragraph("📜 Journal d'exécution", h2_style))
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
        f"<font size=8 color='#94a3b8'>Rapport généré par Agent Data Warehouse v2.0 — {generated_at}</font>",
        ParagraphStyle("Footer", parent=body_style, alignment=TA_CENTER)
    ))

    doc.build(story)
    logger.info(f"[Export] PDF généré : {pdf_path}")
    return pdf_path


def generate_json_report(state: dict, session_id: str) -> dict:
    """Génère un rapport JSON complet."""
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
        },
        "artifacts": {
            "sql_ddl": state.get("sql_ddl"),
            "etl_code": state.get("etl_code"),
            "logical_model": state.get("logical_model"),
        },
        "audit": {
            "critic_review": state.get("critic_review"),
            "heal_history": state.get("heal_history", []),
            "execution_log": state.get("execution_log", []),
            "lineage": state.get("lineage", {}),
        },
    }
