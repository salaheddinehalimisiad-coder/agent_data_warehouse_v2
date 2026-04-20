# api/middleware/jwt_auth.py — Authentification JWT Enterprise v4.2
"""
Durcissement v4.2 :
  - Refuse de booter si JWT_SECRET est absent ou égal à la valeur par défaut
    en mode production (APP_ENV=prod).
  - Supprime le bypass silencieux quand PyJWT n'est pas installé : toute
    tentative de décoder/créer un token lève une erreur claire.
  - Supprime le fallback "utilisateur invité admin=1" qui permettait une
    escalade de privilèges si un endpoint se fiait à `sub`.
  - Cookie `secure` piloté par l'env (COOKIE_SECURE=1 en prod).
  - Ajoute un utilitaire CSRF (double-submit) : `issue_csrf_token`
    et `verify_csrf_token`.
  - Impressionne un `jti` (JWT ID) et un `iss` pour faciliter la révocation
    ultérieure.
"""
import os
import time
import uuid
import hmac
import logging
from typing import Optional
from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)


# ─── Imports résilients ──────────────────────────────────────────────────────
try:
    import jwt as pyjwt
    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False


# ─── Configuration ───────────────────────────────────────────────────────────
_DEFAULT_SECRET = "CHANGE_ME_in_production_please"
JWT_SECRET      = os.getenv("JWT_SECRET", _DEFAULT_SECRET)
JWT_ALGORITHM   = "HS256"
JWT_ISSUER      = os.getenv("JWT_ISSUER", "antigravity-bi")
JWT_EXPIRE_S    = int(os.getenv("JWT_EXPIRE_SECONDS", str(60 * 60 * 24)))  # 24h
APP_ENV         = os.getenv("APP_ENV", "dev").lower()
COOKIE_SECURE   = os.getenv("COOKIE_SECURE", "0").lower() in ("1", "true", "yes")
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax").lower()  # lax|strict|none


def _is_prod() -> bool:
    return APP_ENV in ("prod", "production")


# ─── Garde-fou de démarrage ──────────────────────────────────────────────────

def assert_auth_config() -> None:
    """
    À appeler au démarrage de l'application (main.py / api/server.py).
    Refuse de booter en prod si la configuration d'auth est faible.
    """
    if not JWT_AVAILABLE:
        msg = "PyJWT n'est pas installé — l'authentification est impossible. `pip install PyJWT>=2`."
        if _is_prod():
            raise RuntimeError(msg)
        logger.error(f"[JWT] {msg} (dev mode : échec au premier appel auth)")

    if _is_prod():
        if not JWT_SECRET or JWT_SECRET == _DEFAULT_SECRET:
            raise RuntimeError(
                "[JWT] JWT_SECRET absent ou égal à la valeur par défaut en production. "
                "Définir une variable d'env JWT_SECRET (≥ 32 octets aléatoires)."
            )
        if len(JWT_SECRET) < 32:
            raise RuntimeError(
                "[JWT] JWT_SECRET trop court (< 32 caractères). Génère-le avec "
                "`python -c 'import secrets; print(secrets.token_urlsafe(48))'`."
            )
        if not COOKIE_SECURE:
            logger.warning(
                "[JWT] ⚠️ COOKIE_SECURE=0 en production — les cookies seront envoyés en clair."
            )
    else:
        if JWT_SECRET == _DEFAULT_SECRET:
            logger.warning(
                "[JWT] ⚠️ JWT_SECRET utilise la valeur par défaut (dev mode uniquement)."
            )


# ─── JWT ─────────────────────────────────────────────────────────────────────

def create_token(user_id: int, email: str, prefix: str) -> str:
    """Génère un JWT signé. Lève RuntimeError si PyJWT manque."""
    if not JWT_AVAILABLE:
        raise RuntimeError("PyJWT non installé — impossible de créer un token.")
    now = int(time.time())
    payload = {
        "sub":    str(user_id),
        "email":  email,
        "prefix": prefix,
        "iat":    now,
        "exp":    now + JWT_EXPIRE_S,
        "iss":    JWT_ISSUER,
        "jti":    uuid.uuid4().hex,
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Décode et vérifie un JWT. Lève HTTPException 401 si invalide."""
    if not JWT_AVAILABLE:
        raise HTTPException(
            status_code=500,
            detail="Service d'authentification indisponible (PyJWT manquant).",
        )
    try:
        payload = pyjwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            issuer=JWT_ISSUER,
            options={"require": ["exp", "iat", "sub", "iss"]},
        )
        return payload
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré — veuillez vous reconnecter")
    except pyjwt.InvalidIssuerError:
        raise HTTPException(status_code=401, detail="Émetteur du token invalide")
    except pyjwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Token invalide : {e}")


def get_current_user(request: Request) -> dict:
    """
    Dépendance FastAPI : extrait et valide le JWT.
    Ordre de priorité : header 'Authorization: Bearer …' puis cookie 'auth_token'.
    """
    token: Optional[str] = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
    if not token:
        token = request.cookies.get("auth_token")
    if not token:
        raise HTTPException(status_code=401, detail="Authentification requise")
    return decode_token(token)


def get_optional_user(request: Request) -> Optional[dict]:
    """
    Dépendance FastAPI optionnelle. Renvoie None si pas de cookie/header valide
    (fini l'escalade de privilèges via utilisateur invité id=1).
    """
    auth_header = request.headers.get("Authorization", "")
    token = None
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
    if not token:
        token = request.cookies.get("auth_token")
    if not token:
        return None
    try:
        return decode_token(token)
    except HTTPException:
        return None


# ─── CSRF (double-submit cookie) ─────────────────────────────────────────────

CSRF_COOKIE = "csrf_token"
CSRF_HEADER = "X-CSRF-Token"


def issue_csrf_token() -> str:
    """Génère un token CSRF aléatoire (à poser en cookie non-HttpOnly côté login)."""
    return uuid.uuid4().hex + uuid.uuid4().hex  # 64 chars


def verify_csrf(request: Request) -> None:
    """
    Vérifie le pattern double-submit : le cookie `csrf_token` doit correspondre
    au header `X-CSRF-Token` envoyé par le client. À utiliser sur toutes les
    mutations (POST/PUT/DELETE/PATCH) en plus de get_current_user.
    """
    if request.method.upper() in ("GET", "HEAD", "OPTIONS"):
        return
    cookie_val = request.cookies.get(CSRF_COOKIE, "")
    header_val = request.headers.get(CSRF_HEADER, "")
    if not cookie_val or not header_val or not hmac.compare_digest(cookie_val, header_val):
        raise HTTPException(status_code=403, detail="CSRF token manquant ou invalide")
