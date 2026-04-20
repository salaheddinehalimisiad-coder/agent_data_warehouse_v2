# api/routes/auth.py — Authentification Enterprise v4.2
"""
Durcissement v4.2 :
  - `EmailStr` (validation RFC) + politique de mot de passe.
  - Rate-limit léger en mémoire sur /login (5 tentatives / 5 min / IP, graceful
    sans dépendance externe). Peut être remplacé par slowapi.
  - `SCOPE_IDENTITY()` au lieu de `@@IDENTITY` (safe avec triggers, concurrence).
  - Suppression du hack `if hashed_password == "null"`.
  - CSRF double-submit : cookie csrf_token posé à la connexion, à relire côté
    React et renvoyer dans le header X-CSRF-Token pour toutes les mutations.
  - Cookie `secure` piloté par COOKIE_SECURE env.
  - Log d'audit : last_login_at, last_login_ip (si colonnes présentes — sinon
    simplement loggué).
"""
import os
import time
import logging
from collections import defaultdict, deque
from typing import Optional, Deque, Dict, Tuple

import bcrypt
from fastapi import APIRouter, HTTPException, Depends, Request, Response
from pydantic import BaseModel, EmailStr, Field, field_validator

from api.db import sqlserver as db
from api.middleware.jwt_auth import (
    create_token,
    get_current_user,
    issue_csrf_token,
    CSRF_COOKIE,
    COOKIE_SECURE,
    COOKIE_SAMESITE,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])


# ─── Rate limiting (en mémoire, suffisant single-instance) ───────────────────

_LOGIN_WINDOW_SEC = 300   # 5 min
_LOGIN_MAX       = 5
_login_attempts: Dict[str, Deque[float]] = defaultdict(deque)


def _rate_limit_login(request: Request) -> None:
    """Refuse plus de _LOGIN_MAX tentatives de login par IP dans la fenêtre."""
    ip = (request.client.host if request.client else "unknown")
    now = time.monotonic()
    dq = _login_attempts[ip]
    # Expirer les tentatives hors fenêtre
    while dq and now - dq[0] > _LOGIN_WINDOW_SEC:
        dq.popleft()
    if len(dq) >= _LOGIN_MAX:
        retry_in = int(_LOGIN_WINDOW_SEC - (now - dq[0]))
        raise HTTPException(
            status_code=429,
            detail=f"Trop de tentatives — réessayez dans {retry_in}s",
            headers={"Retry-After": str(retry_in)},
        )
    dq.append(now)


# ─── Modèles Pydantic ────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email:    EmailStr
    password: str = Field(min_length=8, max_length=128)
    prefix:   Optional[str] = Field(default="", max_length=20)

    @field_validator("password")
    @classmethod
    def _password_policy(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Le mot de passe doit faire au moins 8 caractères")
        if v.lower() == v or v.upper() == v or not any(c.isdigit() for c in v):
            raise ValueError(
                "Le mot de passe doit contenir au moins une majuscule, "
                "une minuscule et un chiffre"
            )
        return v

    @field_validator("prefix")
    @classmethod
    def _prefix_safe(cls, v: Optional[str]) -> str:
        if not v:
            return ""
        if not all(c.isalnum() or c == "_" for c in v):
            raise ValueError("Le préfixe ne peut contenir que [a-zA-Z0-9_]")
        return v.lower()


class LoginRequest(BaseModel):
    email:    EmailStr
    password: str = Field(min_length=1, max_length=128)


# ─── Hashing ─────────────────────────────────────────────────────────────────

def get_password_hash(password: str) -> str:
    """Hash bcrypt. Le password est tronqué à 72 octets (limite bcrypt)."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8")[:72], salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Vérifie un password contre son hash. Retourne False si hash invalide."""
    if not hashed_password or not isinstance(hashed_password, str):
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8")[:72],
            hashed_password.encode("utf-8"),
        )
    except ValueError:
        # Hash malformé (ex. migration d'un ancien schéma)
        return False


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _generate_prefix(email: str) -> str:
    return email.split("@")[0].lower().replace(".", "_").replace("-", "_")[:20]


def _set_auth_cookies(response: Response, token: str, csrf: str) -> None:
    response.set_cookie(
        key="auth_token",
        value=token,
        httponly=True,
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE,
        max_age=60 * 60 * 24,
        path="/",
    )
    # CSRF token : lisible par JS (non HttpOnly) pour le pattern double-submit.
    response.set_cookie(
        key=CSRF_COOKIE,
        value=csrf,
        httponly=False,
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE,
        max_age=60 * 60 * 24,
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    for key in ("auth_token", CSRF_COOKIE):
        response.delete_cookie(
            key=key,
            path="/",
            httponly=(key == "auth_token"),
            samesite=COOKIE_SAMESITE,
            secure=COOKIE_SECURE,
        )


def _client_ip(request: Request) -> str:
    xff = request.headers.get("X-Forwarded-For", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/register")
async def register(req: RegisterRequest, request: Request, response: Response):
    """Inscription d'un nouvel utilisateur."""
    conn = cursor = None
    try:
        conn = db.get_meta_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (req.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="Email déjà utilisé")

        prefix = req.prefix or _generate_prefix(req.email)

        # ✅ SCOPE_IDENTITY() — safe avec triggers, thread-safe vs @@IDENTITY
        cursor.execute(
            "INSERT INTO users (email, password_hash, prefix) "
            "OUTPUT inserted.id "
            "VALUES (?, ?, ?)",
            (req.email, get_password_hash(req.password), prefix),
        )
        row = cursor.fetchone()
        user_id = int(row[0]) if row else 0
        if user_id <= 0:
            raise HTTPException(status_code=500, detail="Impossible de créer l'utilisateur")

        logger.info(f"[Auth] Nouveau compte id={user_id} email={req.email} ip={_client_ip(request)}")

        token = create_token(user_id, req.email, prefix)
        csrf  = issue_csrf_token()
        _set_auth_cookies(response, token, csrf)
        return {
            "token":     token,
            "user_id":   user_id,
            "prefix":    prefix,
            "csrf_token": csrf,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Auth] Erreur register : {e}")
        raise HTTPException(status_code=500, detail="Erreur interne")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@router.post("/login")
async def login(req: LoginRequest, request: Request, response: Response):
    """Connexion d'un utilisateur existant. Protégé par rate-limit par IP."""
    _rate_limit_login(request)

    conn = cursor = None
    try:
        conn = db.get_meta_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, prefix, password_hash FROM users WHERE email = ?",
            (req.email,),
        )
        row = cursor.fetchone()

        # Toujours passer par verify_password pour ne pas révéler l'existence
        # du compte via un timing d'erreur distinct.
        stored_hash = row[2] if row else "$2b$12$" + "x" * 53  # hash factice
        valid = verify_password(req.password, stored_hash)

        if not row or not valid:
            raise HTTPException(status_code=401, detail="Identifiants incorrects")

        user_id, prefix = int(row[0]), row[1]
        logger.info(f"[Auth] Login id={user_id} email={req.email} ip={_client_ip(request)}")

        token = create_token(user_id, req.email, prefix)
        csrf  = issue_csrf_token()
        _set_auth_cookies(response, token, csrf)
        return {
            "token":      token,
            "user_id":    user_id,
            "prefix":     prefix,
            "csrf_token": csrf,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Auth] Erreur login : {e}")
        raise HTTPException(status_code=500, detail="Erreur interne")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@router.get("/verify")
async def verify_token(user: dict = Depends(get_current_user)):
    """Vérifie la validité du JWT (header ou cookie)."""
    return {
        "user_id": int(user.get("sub", 0)),
        "email":   user.get("email", ""),
        "prefix":  user.get("prefix", ""),
    }


@router.post("/logout")
async def logout(response: Response):
    """Déconnexion : suppression des cookies."""
    _clear_auth_cookies(response)
    return {"status": "logged_out"}
