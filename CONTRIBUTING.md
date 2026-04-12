# Guide de Contribution — Agent Data Warehouse

## 🛠️ Stack Technique
- **Backend** : FastAPI + LangGraph 3.0
- **Frontend** : React 18 + Vite (Mode Strict)
- **Tests** : pytest + vitest
- **CI/CD** : GitHub Actions

## 🏗️ Workflow de Développement
1. **Branchement** : Créez une branche `feature/nom-de-la-feature` à partir de `develop`.
2. **Pré-requis** : Installez les dépendances de dev :
   ```bash
   pip install -r requirements-dev.txt
   npm install
   pre-commit install
   ```
3. **Qualité** : Avant de commit, assurez-vous que les tests passent :
   ```bash
   pytest
   npm run lint
   ```

## 🧪 Tests Unitaires
- Backend : `tests/`
- Frontend : `src/components/__tests__/` (à venir)

## 🐳 Docker
Le projet est prêt pour Docker. Utilisez `docker-compose up --build`.
Note : Le port MySQL `3306` n'est pas exposé publiquement par défaut (lié à `127.0.0.1`).
