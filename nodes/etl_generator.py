# nodes/etl_generator.py — Agent Générateur ETL : fichier Pentaho .ktr
import json
import logging
import re
import xml.etree.ElementTree as ET
from app_state import AgentState
from nodes.llm_factory import get_llm, call_with_retry, extract_text
from langchain_core.prompts import ChatPromptTemplate
# composio imported lazily inside the node (optional integration)

logger = logging.getLogger(__name__)


ETL_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """Tu es un Expert Pentaho Data Integration (Kettle).
Génère un fichier de transformation .ktr XML complet et valide pour charger les données dans le Data Warehouse.

## Règles strictes :
1. Le XML doit commencer par `<?xml version="1.0" encoding="UTF-8"?>`
2. Tag racine : `<transformation>`
3. Inclure un step "CSV file input" ou "Table input" selon la source
4. Inclure un step "Dimension lookup/update" pour chaque table de dimension
5. Inclure un step "Table output" pour la table de faits
6. Tous les steps doivent avoir des coordonnées GUI (xloc, yloc)
7. Inclure les hops (connexions entre steps)
8. Pas de placeholder tokens (FIELDS_PLACEHOLDER, etc.)
9. Retourne UNIQUEMENT le XML, sans balises markdown ni texte avant/après
"""),
    ("human", """Métadonnées source :
{metadata}

Modèle OLAP (JSON) :
{logical_model}

DDL SQL :
{sql_ddl}

Configuration DW MySQL cible :
{dw_config}

Génère le fichier .ktr complet.""")
])


def etl_generator_node(state: AgentState) -> dict:
    """Génère le fichier Pentaho .ktr pour le chargement ETL."""
    logger.info("--- AGENT ETL GENERATOR : Génération du fichier .ktr ---")

    metadata = state.get("source_metadata", {})
    logical_model = state.get("logical_model", {})
    sql_ddl = state.get("sql_ddl", "")
    dw_config = state.get("dw_connection_config", {})

    if not logical_model or not sql_ddl:
        return {
            "etl_code": "",
            "etl_status": "failed",
            "etl_error": "Modèle OLAP ou DDL absent — impossible de générer l'ETL",
            "execution_log": state.get("execution_log", []) + ["[ETL Generator] ERREUR : modèle absent"],
        }

    llm = get_llm(temperature=0)
    
    # Intégration du Pont Composio : Fournir au LLM la capacité d'interagir avec GitHub et PostgreSQL
    try:
        from composio_langchain import ComposioToolSet, App  # lazy import
        composio_toolset = ComposioToolSet(apps=[App.GITHUB, App.POSTGRES])
        tools = composio_toolset.get_tools()
        llm = llm.bind_tools(tools)
    except Exception as e:
        logger.warning(f"[ETL Generator] Composio non disponible (optionnel) : {e}")

    chain = ETL_PROMPT | llm

    try:
        response = call_with_retry(chain, {
            "metadata": json.dumps(metadata, indent=2, default=str),
            "logical_model": json.dumps(logical_model, indent=2),
            "sql_ddl": sql_ddl,
            "dw_config": json.dumps({
                "host": dw_config.get("host", "localhost"),
                "port": dw_config.get("port", 3306),
                "database": dw_config.get("database", "data_warehouse"),
                "user": dw_config.get("user", "root"),
            }, indent=2),
        })
        ktr_xml = extract_text(response).strip()
    except Exception as e:
        logger.error(f"[ETL Generator] Erreur LLM : {e}")
        return {
            "etl_code": "",
            "etl_status": "failed",
            "etl_error": str(e),
            "execution_log": state.get("execution_log", []) + [f"[ETL Generator] ERREUR LLM : {e}"],
        }

    # Nettoyer les balises markdown
    ktr_xml = re.sub(r"```(?:xml)?\n?", "", ktr_xml).strip().rstrip("`")

    # Valider le XML généré
    is_valid, reason = _validate_ktr(ktr_xml)
    if not is_valid:
        logger.warning(f"[ETL Generator] KTR invalide ({reason}) — fallback template minimaliste")
        ktr_xml = _build_minimal_ktr(metadata, logical_model, dw_config)
        is_valid2, reason2 = _validate_ktr(ktr_xml)
        if not is_valid2:
            return {
                "etl_code": "",
                "etl_status": "failed",
                "etl_error": f"Impossible de construire un KTR valide : {reason2}",
                "execution_log": state.get("execution_log", []) + [f"[ETL Generator] ERREUR KTR : {reason2}"],
            }

    logger.info("[ETL Generator] Fichier .ktr généré avec succès")
    return {
        "etl_code": ktr_xml,
        "etl_status": "pending",
        "etl_error": "",
        "retry_count": 0,
        "heal_history": [],
        "execution_log": state.get("execution_log", []) + ["[ETL Generator] ✅ Fichier .ktr généré"],
    }


def _validate_ktr(xml_str: str) -> tuple[bool, str]:
    """Valide qu'un string XML est un .ktr Pentaho valide."""
    if not xml_str or "<transformation" not in xml_str.lower():
        return False, "Tag <transformation> manquant"
    for token in ("FIELDS_PLACEHOLDER", "TABLES_STEPS_PLACEHOLDER", "HOPS_PLACEHOLDER"):
        if token in xml_str:
            return False, f"Placeholder non remplacé : {token}"
    try:
        ET.fromstring(xml_str)
    except ET.ParseError as e:
        return False, f"XML invalide : {e}"
    return True, ""


def _build_minimal_ktr(metadata: dict, model: dict, dw_config: dict) -> str:
    """Génère un .ktr minimaliste valide en fallback."""
    fact = model.get("fact_table", {})
    fact_name = fact.get("name", "fact_data")
    host = dw_config.get("host", "localhost")
    port = dw_config.get("port", 3306)
    database = dw_config.get("database", "data_warehouse")

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<transformation>
  <info>
    <name>ETL_{fact_name}</name>
    <description>ETL généré automatiquement — Agent Data Warehouse</description>
  </info>
  <step>
    <name>Table output</name>
    <type>TableOutput</type>
    <GUI><xloc>400</xloc><yloc>200</yloc></GUI>
    <connection>{host}:{port}/{database}</connection>
    <table>{fact_name}</table>
    <commit>1000</commit>
    <truncate>N</truncate>
  </step>
</transformation>"""
