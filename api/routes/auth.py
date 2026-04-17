import logging
from passlib.context import CryptContext
from fastapi import APIRouter, HTTPException, Depends, Response
from pydantic import BaseModel
from typing import Optional

from api.db import sqlserver as db
from api.middleware.jwt_auth import create_token, get_current_user

import bcrypt

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

class RegisterRequest(BaseModel):
    email: str
    password: str
    prefix: Optional[str] = ""

class LoginRequest(BaseModel):
    email: str
    password: str

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8')[:72], salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Les vieux hash peuvent être gérés si on force l'encodage
    if hashed_password == "null":
        return False
    return bcrypt.checkpw(plain_password.encode('utf-8')[:72], hashed_password.encode('utf-8'))


def _generate_prefix(email: str) -> str:
    return email.split("@")[0].lower().replace(".", "_")[:20]


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="auth_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # a activer en HTTPS prod
        max_age=60 * 60 * 24,
        path="/",
    )


@router.post("/register")
async def register(req: RegisterRequest, response: Response):
    """Inscription d'un nouvel utilisateur."""
    try:
        conn = db.get_meta_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (req.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="Email déjà utilisé")

        prefix = req.prefix or _generate_prefix(req.email)
        cursor.execute(
            "INSERT INTO users (email, password_hash, prefix) VALUES (?, ?, ?)",
            (req.email, get_password_hash(req.password), prefix)
        )
        cursor.execute("SELECT @@IDENTITY AS id")
        row = cursor.fetchone()
        user_id = int(row[0]) if row else 1
        cursor.close()
        conn.close()

        token = create_token(user_id, req.email, prefix)
        _set_auth_cookie(response, token)
        return {"token": token, "user_id": user_id, "prefix": prefix}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Auth] Erreur register : {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/login")
async def login(req: LoginRequest, response: Response):
    """Connexion d'un utilisateur existant."""
    try:
        conn = db.get_meta_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, prefix, password_hash FROM users WHERE email = ?",
            (req.email,)
        )
        row = cursor.fetchone()
        cursor.close()
        conn.close()

        if not row:
            raise HTTPException(status_code=401, detail="Identifiants incorrects")

        user = {"id": row[0], "prefix": row[1], "password_hash": row[2]}

        if not verify_password(req.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Identifiants incorrects")

        token = create_token(user["id"], req.email, user["prefix"])
        _set_auth_cookie(response, token)
        return {"token": token, "user_id": user["id"], "prefix": user["prefix"]}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Auth] Erreur login : {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/verify")
async def verify_token(user: dict = Depends(get_current_user)):
    """Vérifie la validité du JWT (via header Authorization: Bearer <token>)."""
    return {
        "user_id": int(user.get("sub", 0)),
        "email":   user.get("email", ""),
        "prefix":  user.get("prefix", ""),
    }


@router.post("/logout")
async def logout(response: Response):
    """Déconnexion : suppression du cookie d'authentification."""
    response.delete_cookie(
        key="auth_token",
        path="/",
        httponly=True,
        samesite="lax",
        secure=False,
    )
    return {"status": "logged_out"}
