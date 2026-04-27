@echo off
title Agent Data Warehouse — Launcher
cd /d "%~dp0"

echo [1/2] Demarrage du backend FastAPI (port 8000)...
start "Backend API" .venv\Scripts\uvicorn.exe api.server:app --reload --port 8000

timeout /t 3 /nobreak >nul

echo [2/2] Demarrage du frontend Vite (port 5173)...
start "Frontend Vite" cmd /k "npm run dev"

echo.
echo Backend  : http://localhost:8000/api/docs
echo Frontend : http://localhost:5173
echo.
echo Les deux serveurs tournent dans leurs fenetres respectives.
pause
