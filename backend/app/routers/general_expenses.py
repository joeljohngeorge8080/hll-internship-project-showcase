import uuid
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile, status
from sqlmodel import Session

from app.database import get_session
from app.dependencies import CurrentUser, get_client_ip, require_hr
from app.schemas.general_expense import (
    AnalysisResponse,
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
    ExpenseCreate,
    ExpenseListResponse,
    ExpenseRow,
    ExpenseUpdate,
    UploadResponse,
)
from app.services import general_expense_service as svc

router = APIRouter(prefix='/general-expenses', tags=['general-expenses'])

SessionDep = Annotated[Session, Depends(get_session)]


# ── Categories ─────────────────────────────────────────────────────────────────

@router.get('/categories', response_model=List[CategoryResponse])
def list_categories(
    session: SessionDep,
    user: CurrentUser,
    include_inactive: bool = Query(default=False),
):
    return svc.list_categories(session, include_inactive=include_inactive)


@router.post('/categories', response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    session: SessionDep,
    actor: Annotated[None, Depends(require_hr)],
    user: CurrentUser,
    data: CategoryCreate,
):
    return svc.create_category(session, data, user)


@router.patch('/categories/{category_id}', response_model=CategoryResponse)
def update_category(
    category_id: uuid.UUID,
    session: SessionDep,
    actor: Annotated[None, Depends(require_hr)],
    user: CurrentUser,
    data: CategoryUpdate,
):
    return svc.update_category(session, category_id, data.model_dump(exclude_unset=True), user)


@router.delete('/categories/{category_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: uuid.UUID,
    session: SessionDep,
    actor: Annotated[None, Depends(require_hr)],
    user: CurrentUser,
):
    svc.delete_category(session, category_id, user)


# ── Expenses ───────────────────────────────────────────────────────────────────

@router.get('', response_model=ExpenseListResponse)
def list_expenses(
    session: SessionDep,
    user: CurrentUser,
    year: Optional[int] = Query(default=None),
    month: Optional[int] = Query(default=None),
    category_id: Optional[uuid.UUID] = Query(default=None),
    expense_status: Optional[str] = Query(default=None, alias='status'),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    return svc.list_expenses(
        session,
        year=year,
        month=month,
        category_id=category_id,
        status=expense_status,
        page=page,
        page_size=page_size,
    )


@router.post('', response_model=ExpenseRow, status_code=status.HTTP_201_CREATED)
def create_expense(
    session: SessionDep,
    actor: Annotated[None, Depends(require_hr)],
    user: CurrentUser,
    data: ExpenseCreate,
):
    return svc.create_expense(session, data, user)


@router.get('/uploads', response_model=List[UploadResponse])
def list_uploads(
    session: SessionDep,
    user: CurrentUser,
    year: Optional[int] = Query(default=None),
    month: Optional[int] = Query(default=None),
):
    return svc.list_uploads(session, year=year, month=month)


@router.post('/upload', response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_excel(
    session: SessionDep,
    actor: Annotated[None, Depends(require_hr)],
    user: CurrentUser,
    file: UploadFile = File(...),
    month: int = Form(...),
    year: int = Form(...),
):
    content = await file.read()
    return svc.process_upload(session, content, file.filename or 'upload.xlsx', month, year, user)


@router.get('/analysis', response_model=AnalysisResponse)
def get_analysis(
    session: SessionDep,
    user: CurrentUser,
    year: int = Query(default=None),
):
    from datetime import datetime
    if year is None:
        year = datetime.now().year
    return svc.get_analysis(session, year)


@router.get('/{expense_id}', response_model=ExpenseRow)
def get_expense(
    expense_id: uuid.UUID,
    session: SessionDep,
    user: CurrentUser,
):
    exp, cat_name = svc.get_expense(session, expense_id)
    from app.services.general_expense_service import _to_row
    return _to_row(exp, cat_name)


@router.patch('/{expense_id}', response_model=ExpenseRow)
def update_expense(
    expense_id: uuid.UUID,
    session: SessionDep,
    actor: Annotated[None, Depends(require_hr)],
    user: CurrentUser,
    data: ExpenseUpdate,
):
    return svc.update_expense(session, expense_id, data, user)


@router.delete('/{expense_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: uuid.UUID,
    session: SessionDep,
    actor: Annotated[None, Depends(require_hr)],
    user: CurrentUser,
):
    svc.delete_expense(session, expense_id, user)
