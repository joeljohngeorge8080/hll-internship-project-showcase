from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.google_auth import verify_google_token
from app.core.security import create_access_token, verify_password
from app.database import get_session
from app.dependencies import CurrentUser, get_client_ip
from app.models.audit import ActionType
from app.models.user import User
from app.services.audit_service import write_audit

router = APIRouter(prefix='/auth', tags=['auth'])

SessionDep = Annotated[Session, Depends(get_session)]


class PasswordLoginRequest(BaseModel):
    employee_id: str
    password: str


class GoogleLoginRequest(BaseModel):
    credential: str


class AuthResponse(BaseModel):
    access_token: str
    user: dict


def _build_session(user: User, session) -> dict:
    token = create_access_token({'user_id': str(user.id)})
    return {
        'access_token': token,
        'user': {
            'employee_id': user.employee_id,
            'full_name': user.full_name,
            'google_email': user.google_email,
            'role': user.role,
        },
    }


@router.post('/login', response_model=AuthResponse)
def password_login(
    request: Request,
    data: PasswordLoginRequest,
    session: SessionDep,
):
    user = session.exec(select(User).where(User.employee_id == data.employee_id.strip().upper())).first()

    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail='Invalid employee ID or password',
    )

    if not user or not user.password_hash:
        raise invalid
    if not verify_password(data.password, user.password_hash):
        raise invalid
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Account is inactive. Contact HR.')

    user.last_login_at = datetime.now(timezone.utc)
    session.add(user)
    write_audit(session, user, 'Auth', ActionType.LOGIN, record_id=str(user.id), ip_address=get_client_ip(request))
    session.commit()

    return _build_session(user, session)


@router.post('/google', response_model=AuthResponse)
def google_login(
    request: Request,
    data: GoogleLoginRequest,
    session: SessionDep,
):
    id_info = verify_google_token(data.credential)
    email = id_info.get('email', '').lower()

    user = session.exec(select(User).where(User.google_email == email)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='No account associated with this Google account. Contact HR to get access.',
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Account is inactive. Contact HR.',
        )

    user.last_login_at = datetime.now(timezone.utc)
    session.add(user)
    write_audit(session, user, 'Auth', ActionType.LOGIN, record_id=str(user.id), ip_address=get_client_ip(request))
    session.commit()

    return _build_session(user, session)


@router.get('/me')
def get_me(current_user: CurrentUser):
    return {
        'employee_id': current_user.employee_id,
        'full_name': current_user.full_name,
        'google_email': current_user.google_email,
        'role': current_user.role,
        'is_active': current_user.is_active,
    }


@router.post('/logout')
def logout():
    return {'detail': 'Logged out'}
