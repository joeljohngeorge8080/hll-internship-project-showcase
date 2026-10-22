import uuid
from typing import Annotated, List

from fastapi import APIRouter, Depends, Request

from app.database import get_session
from app.dependencies import (
    CurrentUser,
    get_client_ip,
    require_hr,
    require_officer_manager,
)
from app.models.user import User
from app.schemas.user import UserAccountCreate, UserAccountResponse
from app.services import user_service as svc
from sqlmodel import Session

router = APIRouter(prefix='/users', tags=['users'])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get('', response_model=List[UserAccountResponse])
def list_users(
    session: SessionDep,
    current_user: Annotated[User, Depends(require_officer_manager)],
):
    return svc.list_user_accounts(session, current_user)


@router.post('', response_model=UserAccountResponse, status_code=201)
def create_user(
    request: Request,
    data: UserAccountCreate,
    session: SessionDep,
    current_user: Annotated[User, Depends(require_officer_manager)],
):
    return svc.create_user_account(session, data, current_user, get_client_ip(request))


@router.delete('/{user_id}', status_code=204)
def delete_user(
    request: Request,
    user_id: uuid.UUID,
    session: SessionDep,
    _: Annotated[None, Depends(require_hr)],
    current_user: CurrentUser,
):
    svc.delete_user_account(session, user_id, current_user, get_client_ip(request))
