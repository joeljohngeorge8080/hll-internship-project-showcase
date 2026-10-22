import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import settings

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')

# Dev mode token mappings (role key → user_id) — only used in development
DEV_TOKENS = {
    'DEV000': '00000000-0000-0000-0000-000000000000',  # Admin
    'DEV001': '11111111-1111-1111-1111-111111111111',  # Admin
    'DEV002': '22222222-2222-2222-2222-222222222222',  # HR
    'DEV003': '33333333-3333-3333-3333-333333333333',  # HR (for testing)
}


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict[str, Any]) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({**data, 'exp': expire}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    # Dev mode: support dev-token-DEV001 format (development only)
    if settings.ENVIRONMENT == 'development' and token.startswith('dev-token-'):
        role_key = token.replace('dev-token-', '')
        if role_key in DEV_TOKENS:
            user_id = DEV_TOKENS[role_key]
            return {'user_id': str(user_id), 'role': role_key}
        return {}

    # Production: decode JWT
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return {}
