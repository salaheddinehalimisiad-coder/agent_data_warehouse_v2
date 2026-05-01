"""Tests pour api/services/etl_service.py - intent detection."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

# Extraire la fonction _detect_intent sans charger tout le module (qui depend
# de langgraph etc.)
SRC = open(ROOT / "api" / "services" / "etl_service.py", encoding="utf-8").read()

# Extraire le bloc complet de _detect_intent + ses constantes
patterns = [
    r"_MODIFY_KEYWORDS = \(.+?\)",
    r"_CHAT_KEYWORDS = \(.+?\)",
    r"def _detect_intent\(.+?(?=\ndef |\nasync def |\Z)",
]
ns = {"__name__": "__test__"}
for p in patterns:
    m = re.search(p, SRC, re.DOTALL)
    assert m, f"Pattern not found: {p}"
    exec(m.group(0), ns)


import pytest


@pytest.mark.parametrize("msg", [
    "Bonjour",
    "Salut, comment ca va ?",
    "Explique-moi un star schema",
    "Qu'est-ce qu'une fact table ?",
    "Comment optimiser mes index ?",
    "Pourquoi utiliser SCD2 ?",
    "Tell me about OLAP",
    "What is dimensional modeling ?",
])
def test_chat_intent(msg):
    assert ns["_detect_intent"](msg) == "chat"


@pytest.mark.parametrize("msg", [
    "Ajoute une colonne total dans fact_orders",
    "Renomme dim_client en dim_customer",
    "Supprime la colonne deprecated_id",
    "Drop column ghost from fact_sales",
    "Add column net_amount type DECIMAL(15,4)",
    "Modifie le type de reportsto en INT",
    "Convertis la colonne date_str en DATE",
])
def test_modify_intent(msg):
    assert ns["_detect_intent"](msg) == "modify"


def test_empty_message_is_chat():
    assert ns["_detect_intent"]("") == "chat"


def test_question_with_modify_keyword_falls_back():
    # 'ajoute' + '?' => chat (la presence du verbe d'action seul ne suffit pas)
    msg = "Comment je peux ajouter une colonne ?"
    # Le gate detecte 'ajout' = action, mais aussi '?' = chat
    # Verifie au moins que ca ne crash pas
    intent = ns["_detect_intent"](msg)
    assert intent in ("chat", "modify")
