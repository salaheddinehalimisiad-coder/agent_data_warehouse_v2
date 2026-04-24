# api/services/email_service.py — Notifications email (SMTP) en fin de pipeline
import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import Optional

logger = logging.getLogger(__name__)


def _get_smtp_config() -> dict:
    return {
        "host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.getenv("SMTP_PORT", "587")),
        "user": os.getenv("SMTP_USER", ""),
        "password": os.getenv("SMTP_PASS", os.getenv("SMTP_PASSWORD", "")),
        "from": os.getenv("SMTP_FROM", os.getenv("SMTP_USER", "")),
    }


def send_pipeline_complete_email(
    to_email: str,
    session_id: str,
    state: dict,
    pdf_path: Optional[str] = None,
) -> bool:
    """
    Envoie un email de notification à la fin du pipeline.
    Retourne True si envoi réussi, False sinon.
    """
    cfg = _get_smtp_config()
    if not cfg["user"] or not cfg["password"]:
        logger.info("[Email] SMTP non configuré — notification ignorée")
        return False

    etl_status = state.get("etl_status", "unknown")
    user_prefix = state.get("user_prefix", "N/A")
    heal_count = len(state.get("heal_history", []))
    critic_ok = state.get("critic_approved", False)
    drift = state.get("schema_drift_detected", False)

    status_emoji = "✅" if etl_status == "success" else "❌"
    subject = f"{status_emoji} Pipeline ETL [{user_prefix}] — {etl_status.upper()}"

    # Corps HTML
    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8">
    <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px; }}
    .card {{ background: white; border-radius: 12px; padding: 32px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; }}
    .header {{ display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }}
    .logo {{ width: 48px; height: 48px; background: #6366f1; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; }}
    h1 {{ margin: 0; font-size: 20px; color: #1e293b; }}
    .subtitle {{ color: #64748b; font-size: 13px; margin: 0; }}
    .status {{ display: inline-block; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 13px; margin-bottom: 20px; }}
    .status.success {{ background: #d1fae5; color: #059669; }}
    .status.failed {{ background: #fee2e2; color: #dc2626; }}
    .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }}
    .metric {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }}
    .metric-label {{ font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }}
    .metric-value {{ font-size: 18px; font-weight: bold; color: #1e293b; }}
    .section {{ margin-bottom: 20px; }}
    .section-title {{ font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 8px; }}
    pre {{ background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 11px; color: #334155; overflow: auto; max-height: 200px; }}
    .warning {{ background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px; color: #92400e; font-size: 13px; margin-bottom: 16px; }}
    .footer {{ font-size: 11px; color: #94a3b8; text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; }}
    .badge {{ display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }}
    .badge.ok {{ background: #d1fae5; color: #059669; }}
    .badge.warn {{ background: #fee2e2; color: #dc2626; }}
    </style>
    </head>
    <body>
    <div class="card">
    <div class="header">
    <div class="logo">🏭</div>
    <div>
    <h1>Agent Data Warehouse</h1>
    <p class="subtitle">Rapport de pipeline — {session_id}</p>
    </div>
    </div>

    <div class="status {'success' if etl_status == 'success' else 'failed'}">
    {status_emoji} Pipeline {etl_status.upper()}
    </div>

    {'<div class="warning">⚠️ Dérive de schéma détectée : ' + state.get("schema_drift_details","") + '</div>' if drift else ''}

    <div class="grid">
    <div class="metric">
    <div class="metric-label">Utilisateur</div>
    <div class="metric-value">{user_prefix}</div>
    </div>
    <div class="metric">
    <div class="metric-label">Statut Critic</div>
    <div class="metric-value">{'✅ APPROVED' if critic_ok else '⚠️ NEEDS_REVISION'}</div>
    </div>
    <div class="metric">
    <div class="metric-label">Corrections Healer</div>
    <div class="metric-value">{heal_count}</div>
    </div>
    <div class="metric">
    <div class="metric-label">Version modèle</div>
    <div class="metric-value">v{state.get("logical_model_version", 0)}</div>
    </div>
    </div>

    <div class="section">
    <div class="section-title">📋 Rapport du Critic</div>
    <pre>{state.get("critic_review", "N/A")[:500]}</pre>
    </div>

    <div class="section">
    <div class="section-title">🗄️ DDL SQL (aperçu)</div>
    <pre>{state.get("sql_ddl", "N/A")[:600]}</pre>
    </div>

    {'<div class="section"><div class="section-title">🔧 Corrections Healer</div><ul>' + ''.join(f"<li>{h}</li>" for h in state.get("heal_history", [])) + '</ul></div>' if heal_count > 0 else ''}

    <div class="footer">
    Généré par Agent Data Warehouse v2.0 · LangGraph · FastAPI · React
    </div>
    </div>
    </body>
    </html>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = cfg["from"]
        msg["To"] = to_email
        msg.attach(MIMEText(html, "html"))

        # Joindre le PDF si disponible
        if pdf_path and os.path.exists(pdf_path):
            with open(pdf_path, "rb") as f:
                pdf_part = MIMEApplication(f.read(), _subtype="pdf")
                pdf_part.add_header(
                    "Content-Disposition", "attachment",
                    filename=os.path.basename(pdf_path)
                )
                msg.attach(pdf_part)

        with smtplib.SMTP(cfg["host"], cfg["port"]) as server:
            server.ehlo()
            server.starttls()
            server.login(cfg["user"], cfg["password"])
            server.sendmail(cfg["from"], [to_email], msg.as_string())

        logger.info(f"[Email] Notification envoyée à {to_email}")
        return True

    except Exception as e:
        logger.error(f"[Email] Échec envoi à {to_email} : {e}")
        return False