"""conftest pour tests systeme - mocks + nettoyage sys.modules."""
import sys
from pathlib import Path
from unittest.mock import MagicMock
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

# Nettoyer sys.modules des modules du projet pollues par d'autres test suites
# pour eviter les conflits entre tests/unit/backend (qui mocke nodes.modeler) et
# tests/system (qui veut le vrai nodes.modeler)
@pytest.fixture(autouse=True, scope="session")
def _clean_sys_modules():
    for k in list(sys.modules.keys()):
        if k in ('nodes.modeler', 'nodes.chat_modifier'):
            mod = sys.modules[k]
            if isinstance(mod, MagicMock):
                del sys.modules[k]


# Mocks system-level
_MOCKS = [
    'pyodbc',
    'langgraph', 'langgraph.graph', 'langgraph.graph.message',
    'langgraph.checkpoint', 'langgraph.checkpoint.memory',
    'langchain_core', 'langchain_core.prompts', 'langchain_core.messages',
    'langchain_core.language_models', 'langchain_core.language_models.chat_models',
    'langchain_core.outputs',
    'app_state',
    'nodes.llm_factory',
]
for m in _MOCKS:
    if m not in sys.modules:
        sys.modules[m] = MagicMock()

sys.modules['pyodbc'].drivers = lambda: ["ODBC Driver 18 for SQL Server"]


class _FakePromptTemplate:
    @staticmethod
    def from_messages(msgs):
        return MagicMock()
sys.modules['langchain_core.prompts'].ChatPromptTemplate = _FakePromptTemplate
