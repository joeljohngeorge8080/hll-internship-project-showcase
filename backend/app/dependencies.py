import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import decode_token
from app.database import get_session
from app.models.audit import ActionType
from app.models.user import User, UserRole

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    session: Annotated[Session, Depends(get_session)],
) -> User:
    payload = decode_token(credentials.credentials)
    user_id = payload.get('user_id')
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid token')

    user = session.get(User, uuid.UUID(user_id))

    # Dev mode: seed a real user row for dev tokens if not in database yet, so
    # that anything stamping this id as a created_by/assigned_by FK succeeds.
    if not user and settings.ENVIRONMENT == 'development' and payload.get('role', '').startswith('DEV'):
        role_key = payload['role']
        role_map = {
            'DEV000': UserRole.ADMIN,
            'DEV001': UserRole.ADMIN,
            'DEV002': UserRole.HR,
            'DEV003': UserRole.HR,
        }
        user = User(
            id=uuid.UUID(user_id),
            google_email=f'{role_key.lower()}@dev.local',
            full_name=f'Dev User {role_key}',
            role=role_map.get(role_key, UserRole.EMPLOYEE),
            is_active=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user

    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='User inactive or not found')
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get('X-Forwarded-For')
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    return request.client.host if request.client else '0.0.0.0'


def _deny(session: Session, user: User, request: Request, detail: str) -> None:
    # Imported here, not at module scope, to avoid a circular import
    # (app.services.audit_service imports app.models.user, which is fine,
    # but keeping the dependency graph one-directional is simpler to reason
    # about for a module every router depends on).
    from app.services.audit_service import write_audit

    write_audit(
        session, user, 'AccessControl', ActionType.ACCESS_DENIED,
        remarks=f'{request.method} {request.url.path}: {detail}',
        ip_address=get_client_ip(request),
    )
    session.commit()
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def require_role(*roles: UserRole):
    def checker(
        user: CurrentUser,
        request: Request,
        session: Annotated[Session, Depends(get_session)],
    ) -> User:
        if user.role not in roles:
            _deny(session, user, request, f'Role {user.role} is not authorized for this action')
        return user
    return checker


def require_hr(
    user: CurrentUser,
    request: Request,
    session: Annotated[Session, Depends(get_session)],
) -> User:
    if user.role not in (UserRole.ADMIN, UserRole.HR):
        _deny(session, user, request, 'HR role required')
    return user


# Project Coordinator/Associate may manage Project Officer logins (grant access,
# see the roster) without the full HR user-management surface — user_service
# enforces that they can only ever create/see Project Officer accounts.
def require_officer_manager(
    user: CurrentUser,
    request: Request,
    session: Annotated[Session, Depends(get_session)],
) -> User:
    if user.role not in (
        UserRole.ADMIN,
        UserRole.HR,
        UserRole.PROJECT_COORDINATOR,
        UserRole.PROJECT_ASSOCIATE,
    ):
        _deny(session, user, request, 'Not authorized')
    return user


def require_not_project_officer(
    user: CurrentUser,
    request: Request,
    session: Annotated[Session, Depends(get_session)],
) -> User:
    if user.role == UserRole.PROJECT_OFFICER:
        _deny(session, user, request, 'Access denied')
    return user
