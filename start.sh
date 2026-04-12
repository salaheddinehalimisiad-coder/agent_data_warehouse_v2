#!/bin/bash
# start.sh — Script de démarrage Linux/Mac
set -e

echo "🏭 Agent Data Warehouse v2.0"
echo "================================"

# Vérifier .env
if [ ! -f ".env" ]; then
    echo "⚠️  Fichier .env manquant — copie depuis .env.example"
    cp .env.example .env
    echo "✏️  Éditez .env avec vos valeurs puis relancez ce script."
    exit 1
fi

# Activer venv
if [ ! -d ".venv" ]; then
    echo "📦 Création de l'environnement virtuel..."
    python3 -m venv .venv
fi

echo "🐍 Activation de l'environnement virtuel..."
source .venv/bin/activate

echo "📦 Installation des dépendances Python..."
pip install -r requirements.txt -q

if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances Node.js..."
    npm install
fi

echo ""
echo "🚀 Démarrage des serveurs..."
echo "   Backend FastAPI  → http://localhost:8000"
echo "   Frontend React   → http://localhost:5173"
echo ""

# Lancer en arrière-plan
uvicorn api.server:app --reload --port 8000 &
BACKEND_PID=$!

sleep 2
npm run dev &
FRONTEND_PID=$!

echo "✅ Serveurs démarrés (backend PID: $BACKEND_PID, frontend PID: $FRONTEND_PID)"
echo "   Ctrl+C pour arrêter les deux serveurs"

# Attendre et nettoyer à l'arrêt
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '🛑 Serveurs arrêtés'" EXIT
wait
