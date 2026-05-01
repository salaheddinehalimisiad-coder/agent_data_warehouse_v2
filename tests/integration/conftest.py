"""conftest pour tests integration - mocks deps systeme manquantes."""
import sys
from pathlib import Path
from unittest.mock import MagicMock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

# Mock pyodbc (libodbc.so.2 manque dans certains sandbox)
sys.modules.setdefault('pyodbc', MagicMock(drivers=lambda: ["ODBC Driver 18 for SQL Server"]))

# Mock langgraph
for m in ['langgraph', 'langgraph.graph', 'langgraph.checkpoint',
          'langgraph.checkpoint.memory']:
    sys.modules.setdefault(m, MagicMock())

# Mock main.agent_workflow
_main = MagicMock()
_main.agent_workflow = MagicMock()
_main.get_thread_state = MagicMock(return_value={})
sys.modules.setdefault('main', _main)

# Mock api.db.sqlserver (pas besoin de DB reelle)
_db_mod = MagicMock()
_db_mod.init_metadata_db = MagicMock()
_db_mod.get_session_state = MagicMock(return_value=None)
_db_mod.save_session_state = MagicMock()
sys.modules['api.db.sqlserver'] = _db_mod
