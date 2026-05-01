# Tests Suite

```
tests/
├── unit/
│   ├── backend/      Pytest unitaires Python (chat_modifier, modeler, llm_factory, ...)
│   └── frontend/     Vitest + RTL (composants React, store)
├── integration/      Pytest avec FastAPI TestClient (endpoints REST)
├── system/           Pytest workflow complet (mocks LLM/DB)
├── e2e/              Playwright (UI navigateur, smoke tests)
└── fixtures/         Donnees partagees (CSV, JSON modeles, etc.)
```

## Commandes

```bash
# Backend
pytest tests/unit/backend           # rapide, sans deps externes
pytest tests/integration            # FastAPI TestClient
pytest tests/system                 # Pipeline complet mocke
pytest                              # tout

# Frontend
npm run test                        # vitest watch
npm run test:run                    # vitest single run
npm run test:coverage               # avec coverage

# E2E
npm run test:e2e                    # playwright (necessite backend + frontend up)
```
