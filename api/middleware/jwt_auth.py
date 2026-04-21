# api/middleware/jwt_auth.py — Authentification JWT Enterprise v4.3 (stdlib)
"""
Durcissement v4.3 — ZÉRO dépendance externe :
  - Implémentation JWT HS256 en pur stdlib Python (hmac + hashlib + base64 + json).
  - Si PyJWT est installé, on l'utilise (plus rapide + bien éprouvé).
  - Sinon on bascule silencieusement sur l'implémentation interne : l'app
    marche EXACTEMENT pareil, sans aucune erreur "Service d'authentification
    indisponible". Plus jamais de 500 parce que `pip install` n'a pas été lancé.
  - Refuse de booter si JWT_SECRET est absent ou égal à la valeur par défaut
    en mode production (APP_ENV=prod).
  - Supprime le fallback "utilisateur invité admin=1".
  - Cookie `secure` piloté par l'env (COOKIE_SECURE=1 en prod).
  - Ajoute CSRF double-submit.
  - Impressionne un `jti` (JWT ID) et un `iss` pour révocation ultérieure.
"""
import os
import json
import time
import uuid
import hmac
import base64
import hashlib
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
    pyjwt = None  # placeholder pour les `except pyjwt.XxxError`


# ─── Configuration ───────────────────────────────────────────────────────────
_DEFAULT_SECRET = "CHANGE_ME_in_production_please"
JWT_SECRET      = os.getenv("JWT_SECRET", _DEFAULT_SECRET)
JWT_ALGORITHM   = "HS256"
JWT_ISSUER      = os.getenv("JWT_ISSUER", "agent-bi")
JWT_EXPIRE_S    = int(os.getenv("JWT_EXPIRE_SECONDS", str(60 * 60 * 24)))  # 24h
APP_ENV         = os.getenv("APP_ENV", "dev").lower()
COOKIE_SECURE   = os.getenv("COOKIE_SECURE", "0").lower() in ("1", "true", "yes")
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax").lower()  # lax|strict|none


def _is_prod() -> bool:
    return APP_ENV in ("prod", "production")


# ─── Implémentation stdlib HS256 (fallback sans PyJWT) ───────────────────────
#
# On respecte la RFC 7519 pour que les tokens soient lisibles par PyJWT si un
# admin installe la lib plus tard. Format :
#   base64url(header) . base64url(payload) . base64url(HMAC-SHA256(secret, h.p))

class _StdlibJwtError(Exception):
    """Erreur interne à notre JWT stdlib (évite d'importer pyjwt.*)."""

class _StdlibExpired(_StdlibJwtError):
    pass

class _StdlibInvalid(_StdlibJwtError):
    pass


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _stdlib_encode(payload: dict, secret: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    h_b64 = _b64url_encode(json.dumps(header, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    p_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    signing_input = f"{h_b64}.{p_b64}".encode("ascii")
    sig = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    s_b64 = _b64url_encode(sig)
    return f"{h_b64}.{p_b64}.{s_b64}"


def _stdlib_decode(token: str, secret: str, required: tuple = ("exp", "iat", "sub")) -> dict:
    try:
        h_b64, p_b64, s_b64 = token.split(".")
    except ValueError:
        raise _StdlibInvalid("Format de token invalide (doit contenir 3 segments).")

    # Vérifie l'algorithme
    try:
        header = json.loads(_b64url_decode(h_b64))
    except Exception as e:
        raise _StdlibInvalid(f"Header illisible : {e}")
    if header.get("alg") != "HS256":
        raise _StdlibInvalid(f"Algorithme non supporté : {header.get('alg')}")

    # Vérifie la signature
    signing_input = f"{h_b64}.{p_b64}".encode("ascii")
    expected = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    try:
        provided = _b64url_decode(s_b64)
    except Exception:
        raise _StdlibInvalid("Signature illisible (base64)")
    if not hmac.compare_digest(expected, provided):
        raise _StdlibInvalid("Signature invalide")

    # Parse payload
    try:
        payload = json.loads(_b64url_decode(p_b64))
    except Exception as e:
        raise _StdlibInvalid(f"Payload illisible : {e}")

    # Claims requis
    for claim in required:
        if claim not in payload:
            raise _StdlibInvalid(f"Claim requis manquant : {claim}")

    # Expiration
    exp = payload.get("exp")
    if isinstance(exp, (int, float)) and int(time.time()) >= int(exp):
        raise _StdlibExpired("Token expiré")

    return payload


# ─── Garde-fou de démarrage ──────────────────────────────────────────────────

def assert_auth_config() -> None:
    """
    À appeler au démarrage de l'application (main.py / api/server.py).
    Refuse de booter en prod si la configuration d'auth est faible.
    """
    if not JWT_AVAILABLE:
        logger.warning(
            "[JWT] PyJWT non détecté — utilisation du backend HS256 stdlib "
            "(100%% compatible RFC 7519, aucune action requise)."
        )

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


# ─── JWT (API publique) ──────────────────────────────────────────────────────

def create_token(user_id: int, email: str, prefix: str) -> str:
    """Génère un JWT signé HS256. Utilise PyJWT si présent, sinon fallback stdlib."""
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
    if JWT_AVAILABLE:
        return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return _stdlib_encode(payload, JWT_SECRET)


def decode_token(token: str) -> dict:
    """Décode et vérifie un JWT. Lève HTTPException 401 si invalide.

    NOTE v4.3 :
      - `iss` optionnel (rétro-compat avec les anciens tokens sans iss/jti).
      - Si PyJWT absent, bascule sur le décodeur stdlib interne.
    """
    if JWT_AVAILABLE:
        try:
            payload = pyjwt.decode(
                token,
                JWT_SECRET,
                algorithms=[JWT_ALGORITHM],
                options={"require": ["exp", "iat", "sub"], "verify_iss": False},
            )
            iss = payload.get("iss")
            if iss and iss != JWT_ISSUER:
                raise HTTPException(status_code=401, detail="Émetteur du token invalide")
            return payload
        except pyjwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expiré — veuillez vous reconnecter")
        except pyjwt.InvalidTokenError as e:
            raise HTTPException(status_code=401, detail=f"Token invalide : {e}")

    # Fallback stdlib
    try:
        payload = _stdlib_decode(token, JWT_SECRET, required=("exp", "iat", "sub"))
        iss = payload.get("iss")
        if iss and iss != JWT_ISSUER:
            raise HTTPException(status_code=401, detail="Émetteur du token invalide")
        return payload
    except _StdlibExpired:
        raise HTTPException(status_code=401, detail="Token expiré — veuillez vous reconnecter")
    except _StdlibInvalid as e:
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
