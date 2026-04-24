# nodes/governance_agent.py — Agent de Sécurité et de Conformité (Governance & PII)
import logging
import json
from app_state import AgentState
from nodes.llm_factory import get_llm, call_with_retry, extract_text

logger = logging.getLogger(__name__)

def governance_agent_node(state: AgentState) -> dict:
    """
    Scanne le modèle logique pour détecter les données à caractère personnel (PII).
    Génère un rapport de conformité GDPR/CCPA et des stratégies de masquage SQL.
    """
    logger.info("--- AGENT GOVERNANCE : Audit PII & Conformité Sécurité ---")
    
    logical_model = state.get("logical_model", {})
    if not logical_model:
        logger.error("[Governance] ❌ logical_model VIDE — impossible d'auditer la conformité")
        return {
            "governance_report": {"pii_columns_detected": [], "compliance_score": 0, "masking_sql": "", "error": "no_model"},
            "masking_sql": "",
            "execution_log": state.get("execution_log", []) + [
                "[Governance] ❌ SKIP — Modèle logique manquant, audit impossible"
            ],
        }

    llm = get_llm(temperature=0)
    
    prompt = f"""Tu es un Data Protection Officer (DPO) et Expert en Gouvernance de Données.
Ta mission est d'auditer le schéma logique du Data Warehouse pour détecter les PII (Personnally Identifiable Information) et générer des règles de masquage des données.

## Modèle du Data Warehouse :
{json.dumps(logical_model)}

## Instructions d'analyse de Sécurité :
1. Identifie chaque colonne qui contient ou pourrait contenir des PII (nom, prenom, email, telephone, adresse, SSN, coordonnées bancaires).
2. Propose un algorithme de masquage sécurisé :
   - Hachage cryptographique (SHA-256)
   - Masquage partiel (ex: 'xxx-xxx-1234')
   - Masquage total (ex: '***')
3. Rédige le SQL natif de masquage `masking_sql` qui pourra être utilisé sous la forme de Vue SQL Sécurisée ou Dynamic Data Masking selon.

Génère la réponse strictemnt en format JSON sans rien d'autre :
{{
  "pii_columns_detected": [
    {{"table": "dim_client", "column": "email", "risk_level": "High", "masking_rule": "Partial Masking", "reason": "GDPR constraint"}}
  ],
  "compliance_score": 85,
  "masking_sql": "-- Vue securisee ou DDM:\\nCREATE OR REPLACE VIEW secure_dim_client AS SELECT ..., MASK_STRING(email) as email FROM dim_client;"
}}
"""
    
    try:
        resp = llm.invoke(prompt)
        raw_text = extract_text(resp)
        
        # Nettoyage Markdown
        if "```json" in raw_text:
            raw_text = raw_text.split("```json")[1].split("```")[0].strip()
        elif "```" in raw_text:
            raw_text = raw_text.split("```")[1].split("```")[0].strip()

        gov_report = json.loads(raw_text)
        masking_sql = gov_report.get("masking_sql", "")
        detected = gov_report.get("pii_columns_detected", [])
        
        log_msg = f"[Governance] ✅ Audit Sécurité Terminé : {len(detected)} PII identifiée(s), Score GDPR: {gov_report.get('compliance_score', 100)}%"
        logger.info(log_msg)
        
        return {
            "execution_log": state.get("execution_log", []) + [log_msg],
            "governance_report": gov_report,
            "masking_sql": masking_sql
        }

    except Exception as e:
        logger.error(f"[Governance] Error: {e}")
        return {"execution_log": state.get("execution_log", []) + [f"[Governance] ⚠️ Impossible d'exécuter l'audit: {str(e)}"]}
