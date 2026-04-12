import logging
from passlib.context import CryptContext
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from api.db import mysql as db
from api.middleware.jwt_auth import create_token, get_current_user

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
    # BCrypt a une limite de 72 octets. On tronque pour éviter l'erreur.
    return pwd_context.hash(password[:72])

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password[:72], hashed_password)


def _generate_prefix(email: str) -> str:
    return email.split("@")[0].lower().replace(".", "_")[:20]


@router.post("/register")
async def register(req: RegisterRequest):
    """Inscription d'un nouvel utilisateur."""
    try:
        conn = db.get_meta_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id FROM users WHERE email = %s", (req.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="Email déjà utilisé")

        prefix = req.prefix or _generate_prefix(req.email)
        cursor.execute(
            "INSERT INTO users (email, password_hash, prefix) VALUES (%s, %s, %s)",
            (req.email, get_password_hash(req.password), prefix)
        )
        conn.commit()
        user_id = cursor.lastrowid
        cursor.close()
        conn.close()

        token = create_token(user_id, req.email, prefix)
        return {"token": token, "user_id": user_id, "prefix": prefix}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Auth] Erreur register : {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/login")
async def login(req: LoginRequest):
    """Connexion d'un utilisateur existant."""
    try:
        conn = db.get_meta_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, prefix, password_hash FROM users WHERE email = %s",
            (req.email,)
        )
        user = cursor.fetchone()
        cursor.close()
        conn.close()

        if not user or not verify_password(req.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Identifiants incorrects")

        token = create_token(user["id"], req.email, user["prefix"])
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
