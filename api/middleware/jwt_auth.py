# api/middleware/jwt_auth.py — Authentification JWT production
"""
Remplace le système de tokens UUID en mémoire par de vrais JWT signés.
Utilise PyJWT (pip install PyJWT).
"""
import os
import logging
import time
from typing import Optional
from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)

try:
    import jwt as pyjwt
    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False
    logger.warning("[JWT] PyJWT non installé — authentification désactivée (mode dev)")


JWT_SECRET    = os.getenv("JWT_SECRET", "CHANGE_ME_in_production_please")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_S  = int(os.getenv("JWT_EXPIRE_SECONDS", str(60 * 60 * 24)))  # 24h par défaut


def create_token(user_id: int, email: str, prefix: str) -> str:
    """Génère un JWT signé."""
    if not JWT_AVAILABLE:
        import uuid
        return f"devtoken_{uuid.uuid4().hex}"
    payload = {
        "sub":    str(user_id),
        "email":  email,
        "prefix": prefix,
        "iat":    int(time.time()),
        "exp":    int(time.time()) + JWT_EXPIRE_S,
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Décode et vérifie un JWT. Lève HTTPException 401 si invalide."""
    if not JWT_AVAILABLE:
        # mode dev : accepter tous les tokens devtoken_
        if token.startswith("devtoken_"):
            return {"sub": "1", "email": "dev@local", "prefix": "dw"}
        raise HTTPException(status_code=401, detail="PyJWT non installé — token invalide")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré — veuillez vous reconnecter")
    except pyjwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Token invalide : {e}")


def get_current_user(request: Request) -> dict:
    """
    Dépendance FastAPI : extrait et valide le JWT depuis le cookie 'auth_token'.
    Usage : user = Depends(get_current_user)
    """
    token = request.cookies.get("auth_token")
    if not token:
        raise HTTPException(status_code=401, detail="Cookie d'authentification requis")
    return decode_token(token)


def get_optional_user(request: Request) -> dict:
    """
    Dépendance FastAPI optionnelle : accepte les requêtes sans cookie.
    Si un cookie est présent il est validé; sinon on retourne un utilisateur invité.
    Usage : user = Depends(get_optional_user)
    """
    token = request.cookies.get("auth_token")
    if not token:
        return {"sub": "1", "email": "guest@local", "prefix": "dw"}
    try:
        return decode_token(token)
    except HTTPException:
        return {"sub": "1", "email": "guest@local", "prefix": "dw"}
