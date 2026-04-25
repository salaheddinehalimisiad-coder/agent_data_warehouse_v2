# start.ps1 - Script de demarrage Windows
Write-Host "Agent Data Warehouse v3.1" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Verifier .env
if (-not (Test-Path ".env")) {
    Write-Host "Fichier .env manquant - copie depuis .env.example" -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "Editez .env avec vos valeurs puis relancez ce script." -ForegroundColor Yellow
    exit 1
}

# Verifier DB_PASSWORD (requis par sqlserver.py)
$envContent = Get-Content ".env" -ErrorAction SilentlyContinue
if ($envContent -notmatch "DB_PASSWORD=") {
    Write-Host "DB_PASSWORD manquant dans .env - requis pour SQL Server metadata DB" -ForegroundColor Yellow
    Write-Host "Ajoutez DB_PASSWORD=votre_mdp dans .env" -ForegroundColor Yellow
}

# Verifier Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Python non trouve. Installez Python 3.10+" -ForegroundColor Red
    exit 1
}

# Activer venv
if (-not (Test-Path ".venv")) {
    Write-Host "Creation de l'environnement virtuel..." -ForegroundColor Blue
    python -m venv .venv
}

Write-Host "Activation de l'environnement virtuel..." -ForegroundColor Blue
& ".\.venv\Scripts\Activate.ps1"

Write-Host "Installation des dependances Python..." -ForegroundColor Blue
python -m pip install -r requirements.txt -q

# Verifier Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js non trouve. Installez Node.js 18+" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "node_modules")) {
    Write-Host "Installation des dependances Node.js..." -ForegroundColor Blue
    npm.cmd install
}

# Lancer les 2 serveurs en parallele
Write-Host ""
Write-Host "Demarrage des serveurs..." -ForegroundColor Green
Write-Host "   Backend FastAPI  -> http://localhost:8000" -ForegroundColor Gray
Write-Host "   Frontend React   -> http://localhost:5173" -ForegroundColor Gray
Write-Host ""

$projectDir = $PSScriptRoot
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$projectDir'; .\.venv\Scripts\Activate.ps1; .\.venv\Scripts\python.exe -m uvicorn api.server:app --reload --port 8000" -WindowStyle Normal
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$projectDir'; npm.cmd run dev" -WindowStyle Normal

Write-Host "Serveurs demarres ! Ouvrez http://localhost:5173" -ForegroundColor Green
