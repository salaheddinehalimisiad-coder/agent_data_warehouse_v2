# api/middleware/security.py — Middlewares de sécurité production
import time
import logging
import hashlib
import hmac
import base64
import json
import os
from collections import defaultdict
from typing import Optional
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# ─── Rate Limiter (en mémoire) ────────────────────────────────────────────────
_rate_store: dict = defaultdict(list)  # ip → [timestamps]

RATE_LIMITS = {
    "/api/start":          (5,  60),    # 5 req / 60s
    "/api/chat":           (30, 60),    # 30 req / 60s
    "/api/auth/login":     (10, 60),    # 10 req / 60s
    "/api/auth/register":  (3,  60),    # 3 req / 60s
    "/api/upload":         (10, 60),    # 10 req / 60s
    "/api/upload-csv":     (10, 60),    # Legacy CSV
    "/api/upload-backup":  (100, 60),   # Dev mode: 100 req / min
    "default":             (100, 60),   # 100 req / 60s
}


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Ne pas limiter les preflights CORS
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        ip   = request.client.host if request.client else "unknown"
        key  = f"{ip}:{path}"
        now  = time.time()

        limit, window = RATE_LIMITS.get(path, RATE_LIMITS["default"])
        _rate_store[key] = [t for t in _rate_store[key] if now - t < window]

        if len(_rate_store[key]) >= limit:
            logger.warning(f"[RateLimit] Bloqué : {ip} sur {path}")
            return JSONResponse(
                status_code=429,
                content={"detail": f"Trop de requêtes. Réessayez dans {window}s."},
                headers={"Retry-After": str(window)},
            )

        _rate_store[key].append(now)
        try:
            return await call_next(request)
        except Exception as e:
            logger.error(f"[Middleware] Erreur pipeline : {e}")
            raise



class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Ajoute les en-têtes de sécurité standard."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"]  = "nosniff"
        response.headers["X-Frame-Options"]          = "DENY"
        response.headers["X-XSS-Protection"]         = "1; mode=block"
        response.headers["Referrer-Policy"]           = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"]        = "camera=(), microphone=(), geolocation=()"
        if not request.url.path.startswith("/api/pipeline-stream"):
            response.headers["Cache-Control"] = "no-store"
        return response


# ─── JWT simple (sans dépendance externe) ─────────────────────────────────────
_JWT_SECRET = os.getenv("JWT_SECRET", "change-this-in-production-please-use-strong-secret")


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    pad = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * pad)


def create_jwt(payload: dict, expires_in: int = 86400) -> str:
    """Crée un JWT HS256 simple."""
    header  = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = dict(payload, exp=int(time.time()) + expires_in)
    body    = _b64url_encode(json.dumps(payload).encode())
    sig_input = f"{header}.{body}".encode()
    signature = hmac.new(_JWT_SECRET.encode(), sig_input, hashlib.sha256).digest()
    return f"{header}.{body}.{_b64url_encode(signature)}"


def verify_jwt(token: str) -> Optional[dict]:
    """Vérifie et décode un JWT. Retourne None si invalide."""
    try:
        header, body, sig = token.split(".")
        sig_input = f"{header}.{body}".encode()
        expected_sig = hmac.new(_JWT_SECRET.encode(), sig_input, hashlib.sha256).digest()
        actual_sig   = _b64url_decode(sig)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
        payload = json.loads(_b64url_decode(body))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


def hash_password(pwd: str) -> str:
    """Hash SHA-256 + sel du mot de passe."""
    salt = os.getenv("PASSWORD_SALT", "agent-dw-salt-change-in-production")
    return hashlib.sha256(f"{salt}{pwd}".encode()).hexdigest()


# ─── Validation des entrées ───────────────────────────────────────────────────

MAX_UPLOAD_SIZE_MB = 2000

def validate_file(filename: str, size_bytes: int) -> None:
    """Valide un fichier uploadé (CSV ou SQL Server Backup)."""
    allowed_exts = (".csv", ".txt", ".bak")
    if not any(filename.lower().endswith(ext) for ext in allowed_exts):
        logger.warning(f"[Security] Fichier rejeté (extension) : {filename}")
        raise HTTPException(status_code=400, detail="Format non supporté. Utiliser CSV (.csv, .txt) ou SQL Backup (.bak)")
    
    if size_bytes > MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        logger.warning(f"[Security] Fichier rejeté (taille) : {size_bytes} bytes")
        raise HTTPException(
            status_code=413,
            detail=f"Fichier trop grand. Maximum : {MAX_UPLOAD_SIZE_MB}MB"
        )

def validate_csv_file(filename: str, size_bytes: int) -> None:
    """
    Compat legacy: validation stricte des uploads CSV historiques.
    Garde une limite dédiée plus basse pour éviter de casser les anciens flux.
    """
    allowed_exts = (".csv", ".txt")
    if not any(filename.lower().endswith(ext) for ext in allowed_exts):
        raise HTTPException(status_code=400, detail="Format CSV invalide")
    if size_bytes > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Fichier CSV trop volumineux (max 50MB)")


def sanitize_prefix(prefix: str) -> str:
    """Nettoie un préfixe utilisateur pour éviter les injections SQL."""
    import re
    clean = re.sub(r"[^a-z0-9_]", "", prefix.lower())[:20]
    return clean or "dw"
