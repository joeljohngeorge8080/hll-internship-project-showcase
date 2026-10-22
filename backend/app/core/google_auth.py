from fastapi import HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.core.config import settings


def verify_google_token(credential: str) -> dict:
    """Verify a Google ID token and return the payload. Raises 401 on failure."""
    try:
        id_info = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f'Invalid Google token: {exc}',
        )

    if not id_info.get('email_verified'):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Google account email is not verified',
        )

    return id_info
