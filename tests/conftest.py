"""pytest conftest racine - mocks pour modules externes (langchain/langgraph)."""
import sys
from unittest.mock import MagicMock

_MOCKED_MODULES = [
    'langgraph', 'langgraph.graph',
    'langgraph.checkpoint', 'langgraph.checkpoint.memory',
    'langchain_core', 'langchain_core.prompts',
    'langchain_core.messages',
    'langchain_core.language_models', 'langchain_core.language_models.chat_models',
    'langchain_core.outputs',
]
for _m in _MOCKED_MODULES:
    if _m not in sys.modules:
        sys.modules[_m] = MagicMock()
