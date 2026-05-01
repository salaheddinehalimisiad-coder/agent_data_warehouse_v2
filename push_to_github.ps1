# push_to_github.ps1
# Script PowerShell pour finaliser le commit + push sur GitHub.
# Usage : .\push_to_github.ps1
#
# Ce script :
#  1. Supprime le verrou .git/index.lock (s'il existe)
#  2. Nettoie les fichiers obsoletes (vite timestamps, fix_*.py, logs, scratch/, .coverage)
#  3. Stage tous les changements
#  4. Cree le commit
#  5. Push vers GitHub

$ErrorActionPreference = "Stop"
$repoPath = $PSScriptRoot

Write-Host "=== Cleanup et commit Atlas v4.0 ===" -ForegroundColor Cyan
Set-Location $repoPath

# 1. Supprimer le verrou git si present
$lockFile = Join-Path $repoPath ".git\index.lock"
if (Test-Path $lockFile) {
    Write-Host "[1/5] Suppression de .git\index.lock (lock obsolete)..." -ForegroundColor Yellow
    Remove-Item $lockFile -Force
}

# 2. Supprimer les fichiers obsoletes du disque
Write-Host "[2/5] Nettoyage des fichiers obsoletes..." -ForegroundColor Yellow
$toDelete = @(
    "vite.config.js.timestamp-*.mjs",
    "fix_all_remaining.py", "fix_etl_service.py", "fix_etl_service2.py",
    "backend.log", "backend_stderr.log", "backend_stdout.log", "server.log",
    ".coverage", "test_payload.json", "roadmap_parsed.txt",
    "rapport_mini_projet_AntigravityBI.docx", "roadmap_generique_phase3.docx",
    "walkthrough_architecture.md"
)
foreach ($pat in $toDelete) {
    Get-ChildItem -Path $repoPath -Filter $pat -ErrorAction SilentlyContinue | Remove-Item -Force
}
if (Test-Path "scratch") { Remove-Item "scratch" -Recurse -Force -ErrorAction SilentlyContinue }

# 3. Configurer git si necessaire
if (-not (git config user.email)) {
    git config user.email "salah.eddine.halimi.siad@gmail.com"
}
if (-not (git config user.name)) {
    git config user.name "salaheddinehalimisiad-coder"
}

# 4. Untrack obsolete files (sans toucher au disque)
Write-Host "[3/5] Untrack des fichiers obsoletes..." -ForegroundColor Yellow
$untrack = @(
    ".coverage", "fix_all_remaining.py", "fix_etl_service.py", "fix_etl_service2.py",
    "server.log", "test_payload.json", "roadmap_parsed.txt",
    "rapport_mini_projet_AntigravityBI.docx", "roadmap_generique_phase3.docx",
    "walkthrough_architecture.md"
)
foreach ($f in $untrack) {
    git rm --cached -f --ignore-unmatch $f 2>$null | Out-Null
}
git ls-files | Where-Object { $_ -match "vite\.config\.js\.timestamp" } | ForEach-Object {
    git rm --cached -f --ignore-unmatch $_ 2>$null | Out-Null
}
git rm --cached -rf --ignore-unmatch scratch/ 2>$null | Out-Null

# 5. Stage + commit
Write-Host "[4/5] Stage + commit..." -ForegroundColor Yellow
git add -A

$commitMsg = @"
feat: Atlas v4.0 + tests complets + Docker prod-ready + observabilite

CHAT_MODIFIER v4.0 (resout le bug [un] NVARCHAR(255))
- Mode 'patch operations' au lieu de regenerer tout le JSON (10x moins de tokens)
- Force Blaze GLM-5 strict (jamais Ollama pour les modifications critiques)
- Gate _is_simple_single_op_request : refuse les demandes >150 chars
- 9 operations atomiques: add_column, drop_column, rename_*, change_type,
  split_date_key, add_table, add_fk, note
- Diff DDL injecte dans critic_review pour visibilite UI

UI Atlas widget
- FloatingChatWidget : bouton circulaire + slide-up panel + maximize
- ChatInterface refondu (suppression onglets et barre du bas)
- Composer redesigne avec hints clavier et glow au focus

EXPORTS
- Backup .bak: fallback ZIP logique si SQL Server indisponible
- Excel report: 10 feuilles avec charts natifs (Mesures & KPI ajoutee)

DOCKER PROD-READY
- Multi-stage Dockerfiles + gunicorn + tini + OCI labels
- nginx-unprivileged + CSP + Caddy HTTPS auto Let's Encrypt
- docker-compose harmonise dev/prod, secrets via VAR:?, log rotation
- read-only filesystems + tmpfs + no-new-privileges en prod

OBSERVABILITE
- /metrics Prometheus + JSONLogFormatter pour ELK/Loki

PERFORMANCE
- Cache LRU + TTL pour les appels LLM
- Pool SQLAlchemy tunable
- Endpoint SSE chat /api/chat/stream

TESTS (116 passing)
- tests/unit/{backend,frontend}, integration, system, e2e (Playwright)

CI/CD
- .github/workflows/ci.yml + Makefile + pre-commit hooks

CLEANUP
- Suppression fichiers obsoletes (fix_*.py, scratch/, vite timestamps, logs)
- .gitignore mis a jour
- README.md reecrit professionnellement
- BLAZE_API_KEY retiree des sources
"@

git commit -m $commitMsg

# 6. Push
Write-Host "[5/5] Push vers GitHub..." -ForegroundColor Yellow
$branch = git rev-parse --abbrev-ref HEAD
Write-Host "   Branche : $branch" -ForegroundColor Gray

git push origin $branch

Write-Host "" -ForegroundColor Green
Write-Host "*** Commit + push reussi sur https://github.com/salaheddinehalimisiad-coder/agent_data_warehouse_v2 ***" -ForegroundColor Green
