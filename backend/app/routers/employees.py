import math
import uuid
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlmodel import Session, select

from app.database import get_session
from app.dependencies import CurrentUser, get_client_ip, require_hr, require_not_project_officer
from app.models.employee import (
    EmployeeAddress,
    EmployeeBankAccount,
    EmployeeContactInformation,
    EmployeeDepartmentHistory,
    EmployeeFamilyMember,
    EmployeeIdentification,
    EmployeeStatus,
)
from app.schemas.employee import (
    AddressResponse,
    AddressUpsert,
    BankAccountCreate,
    BankAccountResponse,
    ContactInformationResponse,
    ContactInformationUpdate,
    DepartmentChangeRequest,
    DepartmentHistoryResponse,
    EmployeeAccountResponse,
    EmployeeAccountUpdate,
    EmployeeCreate,
    EmployeeListResponse,
    EmployeeListRow,
    EmployeeProfileResponse,
    EmployeeStatusUpdate,
    EmployeeUpdate,
    FamilyMemberCreate,
    FamilyMemberResponse,
    IdentificationResponse,
    IdentificationUpdate,
    SalaryDirectUpdateRequest,
    SalaryIncrementRequest,
    SalaryIncrementResponse,
)
from app.services import employee_service as svc

router = APIRouter(prefix='/employees', tags=['employees'])

SessionDep = Annotated[Session, Depends(get_session)]


# ─── Employee List & Create ────────────────────────────────────────────────────

@router.get('', response_model=EmployeeListResponse)
def list_employees(
    request: Request,
    session: SessionDep,
    user: Annotated[None, Depends(require_not_project_officer)],
    current_user: CurrentUser,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    status: Optional[EmployeeStatus] = Query(default=None),
    department: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
):
    items, total = svc.list_employees(session, page, page_size, search, status, department, category)
    return EmployeeListResponse(
        items=[EmployeeListRow.model_validate(e) for e in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 0,
    )


@router.post('', response_model=EmployeeProfileResponse, status_code=status.HTTP_201_CREATED)
def create_employee(
    request: Request,
    data: EmployeeCreate,
    session: SessionDep,
    actor: Annotated[None, Depends(require_hr)],
    current_user: CurrentUser,
):
    ip = get_client_ip(request)
    emp = svc.create_employee(session, data, current_user, ip)
    return EmployeeProfileResponse.model_validate(emp)


# ─── Employee Detail ───────────────────────────────────────────────────────────

@router.get('/{employee_id}', response_model=EmployeeProfileResponse)
def get_employee(
    employee_id: uuid.UUID,
    session: SessionDep,
    _: Annotated[None, Depends(require_not_project_officer)],
    current_user: CurrentUser,
):
    emp = svc.get_employee_or_404(session, employee_id)
    profile = EmployeeProfileResponse.model_validate(emp)

    contact = session.exec(
        select(EmployeeContactInformation).where(EmployeeContactInformation.employee_id == emp.id)
    ).first()
    if contact:
        profile.contact = ContactInformationResponse.model_validate(contact)

    addresses = session.exec(
        select(EmployeeAddress).where(EmployeeAddress.employee_id == emp.id)
    ).all()
    profile.addresses = [AddressResponse.model_validate(a) for a in addresses]

    identification = session.exec(
        select(EmployeeIdentification).where(EmployeeIdentification.employee_id == emp.id)
    ).first()
    if identification:
        profile.identification = IdentificationResponse.model_validate(identification)

    bank_accounts = session.exec(
        select(EmployeeBankAccount).where(EmployeeBankAccount.employee_id == emp.id)
    ).all()
    profile.bank_accounts = [BankAccountResponse.model_validate(b) for b in bank_accounts]

    family_members = session.exec(
        select(EmployeeFamilyMember).where(EmployeeFamilyMember.employee_id == emp.id)
    ).all()
    profile.family_members = [FamilyMemberResponse.model_validate(f) for f in family_members]

    return profile


@router.put('/{employee_id}', response_model=EmployeeProfileResponse)
def update_employee(
    request: Request,
    employee_id: uuid.UUID,
    data: EmployeeUpdate,
    session: SessionDep,
    _: Annotated[None, Depends(require_hr)],
    current_user: CurrentUser,
):
    emp = svc.get_employee_or_404(session, employee_id)
    emp = svc.update_employee(session, emp, data, current_user, get_client_ip(request))
    return EmployeeProfileResponse.model_validate(emp)


@router.patch('/{employee_id}/status', response_model=EmployeeProfileResponse)
def change_status(
    request: Request,
    employee_id: uuid.UUID,
    data: EmployeeStatusUpdate,
    session: SessionDep,
    _: Annotated[None, Depends(require_hr)],
    current_user: CurrentUser,
):
    emp = svc.get_employee_or_404(session, employee_id)
    emp = svc.change_employee_status(session, emp, data, current_user, get_client_ip(request))
    return EmployeeProfileResponse.model_validate(emp)


# ─── Contact ───────────────────────────────────────────────────────────────────

@router.get('/{employee_id}/contact', response_model=ContactInformationResponse)
def get_contact(
    employee_id: uuid.UUID,
    session: SessionDep,
    _: Annotated[None, Depends(require_not_project_officer)],
    current_user: CurrentUser,
):
    emp = svc.get_employee_or_404(session, employee_id)
    contact = session.exec(
        select(EmployeeContactInformation).where(EmployeeContactInformation.employee_id == emp.id)
    ).first()
    if not contact:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail='Contact not found')
    return ContactInformationResponse.model_validate(contact)


@router.put('/{employee_id}/contact', response_model=ContactInformationResponse)
def update_contact(
    request: Request,
    employee_id: uuid.UUID,
    data: ContactInformationUpdate,
    session: SessionDep,
    _: Annotated[None, Depends(require_hr)],
    current_user: CurrentUser,
):
    emp = svc.get_employee_or_404(session, employee_id)
    contact = svc.upsert_contact(session, emp, data, current_user, get_client_ip(request))
    return ContactInformationResponse.model_validate(contact)


# ─── Address ───────────────────────────────────────────────────────────────────

@router.get('/{employee_id}/addresses', response_model=List[AddressResponse])
def get_addresses(
    employee_id: uuid.UUID,
    session: SessionDep,
    _: Annotated[None, Depends(require_not_project_officer)],
    current_user: CurrentUser,
):
    emp = svc.get_employee_or_404(session, employee_id)
    addresses = session.exec(
        select(EmployeeAddress).where(EmployeeAddress.employee_id == emp.id)
    ).all()
    return [AddressResponse.model_validate(a) for a in addresses]


@router.put('/{employee_id}/addresses', response_model=AddressResponse)
def upsert_address(
    request: Request,
    employee_id: uuid.UUID,
    data: AddressUpsert,
    session: SessionDep,
    _: Annotated[None, Depends(require_hr)],
    current_user: CurrentUser,
):
    emp = svc.get_employee_or_404(session, employee_id)
    addr = svc.upsert_address(session, emp, data, current_user, get_client_ip(request))
    return AddressResponse.model_validate(addr)


# ─── Identification ────────────────────────────────────────────────────────────

@router.get('/{employee_id}/identification', response_model=IdentificationResponse)
def get_identification(
    employee_id: uuid.UUID,
    session: SessionDep,
    _: Annotated[None, Depends(require_hr)],
    current_user: CurrentUser,
):
    emp = svc.get_employee_or_404(session, employee_id)
    ident = session.exec(
        select(EmployeeIdentification).where(EmployeeIdentification.employee_id == emp.id)
    ).first()
    if not ident:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail='Identification not found')
    return IdentificationResponse.model_validate(ident)


@router.put('/{employee_id}/identification', response_model=IdentificationResponse)
def update_identification(
    request: Request,
    employee_id: uuid.UUID,
    data: IdentificationUpdate,
    session: SessionDep,
    _: Annotated[None, Depends(require_hr)],
    current_user: CurrentUser,
):
    emp = svc.get_employee_or_404(session, employee_id)
    ident = svc.upsert_identification(session, emp, data, current_user, get_client_ip(request))
    return IdentificationResponse.model_validate(ident)


# ─── Bank Accounts ─────────────────────────────────────────────────────────────

@router.get('/{employee_id}/bank-accounts', response_model=List[BankAccountResponse])
def get_bank_accounts(
    employee_id: uuid.UUID,
    session: SessionDep,
    _: Annotated[None, Depends(require_hr)],
    current_user: CurrentUser,
):
    emp = svc.get_employee_or_404(session, employee_id)
    accounts = session.exec(
        select(EmployeeBankAccount).where(EmployeeBankAccount.employee_id == emp.id)
    ).all()
    return [BankAccountResponse.model_validate(a) for a in accounts]


@router.post('/{employee_id}/bank-accounts', response_model=BankAccountResponse, status_code=201)
def add_bank_account(
    request: Request,
    employee_id: uuid.UUID,
    data: BankAccountCreate,
    session: SessionDep,
    _: Annotated[None, Depends(require_hr)],
    current_user: CurrentUser,
):
    emp = svc.get_employee_or_404(session, employee_id)
    account = svc.add_bank_account(session, emp, data, current_user, get_client_ip(request))
    return BankAccountResponse.model_validate(account)


# ─── Family Members ────────────────────────────────────────────────────────────

@router.get('/{employee_id}/family-members', response_model=List[FamilyMemberResponse])
def get_family_members(
    employee_id: uuid.UUID,
    session: SessionDep,
    _: Annotated[None, Depends(require_not_project_officer)],
    current_user: CurrentUser,
):
    emp = svc.get_employee_or_404(session, employee_id)
    members = session.exec(
        select(EmployeeFamilyMember).where(EmployeeFamilyMember.employee_id == emp.id)
    ).all()
    return [FamilyMemberResponse.model_validate(m) for m in members]


@router.post('/{employee_id}/family-members', response_model=FamilyMemberResponse, status_code=201)
def add_family_member(
    request: Request,
    employee_id: uuid.UUID,
    data: FamilyMemberCreate,
    session: SessionDep,
    _: Annotated[None, Depends(require_hr)],
    current_user: CurrentUser,
):
    emp = svc.get_employee_or_404(session, employee_id)
    member = svc.add_family_member(session, emp, data, current_user, get_client_ip(request))
    return FamilyMemberResponse.model_validate(member)


# ─── Salary ────────────────────────────────────────────────────────────────────

@router.get('/{employee_id}/salary-history', response_model=List[SalaryIncrementResponse])
def get_salary_history(
    employee_id: uuid.UUID,
    session: SessionDep,
    _: Annotated[None, Depends(require_not_project_officer)],
    current_user: CurrentUser,
):
    emp = svc.get_employee_or_404(session, employee_id)
    history = svc.get_salary_history(session, emp.id)
    return [SalaryIncrementResponse.model_validate(h) for h in history]


@router.post('/{employee_id}/salary-increment', response_model=SalaryIncrementResponse, status_code=201)
def apply_salary_increment(
    request: Request,
    employee_id: uuid.UUID,
    data: SalaryIncrementRequest,
    session: SessionDep,
    _: Annotated[None, Depends(require_hr)],
    current_user: CurrentUser,
):
    emp = svc.get_employee_or_404(session, employee_id)
    hist = svc.apply_salary_increment(session, emp, data, current_user, get_client_ip(request))
    return SalaryIncrementResponse.model_validate(hist)


@router.post('/{employee_id}/salary-update', response_model=SalaryIncrementResponse, status_code=201)
def direct_salary_update(
    request: Request,
    employee_id: uuid.UUID,
    data: SalaryDirectUpdateRequest,
    session: SessionDep,
    _: Annotated[None, Depends(require_hr)],
    current_user: CurrentUser,
):
    emp = svc.get_employee_or_404(session, employee_id)
    hist = svc.apply_salary_direct_update(session, emp, data, current_user, get_client_ip(request))
    return SalaryIncrementResponse.model_validate(hist)


# ─── Account Management (Google account + role) ────────────────────────────────

@router.get('/{employee_id}/account', response_model=EmployeeAccountResponse)
def get_account(
    employee_id: uuid.UUID,
    session: SessionDep,
    _: Annotated[None, Depends(require_hr)],
    current_user: CurrentUser,
):
    from sqlmodel import select as sql_select
    from app.models.user import User
    emp = svc.get_employee_or_404(session, employee_id)
    user_account = session.exec(
        sql_select(User).where(User.employee_id == emp.employee_id)
    ).first()
    if not user_account:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail='No login account found for this employee')
    return EmployeeAccountResponse(
        employee_id=user_account.employee_id,
        google_email=user_account.google_email,
        role=user_account.role,
        is_active=user_account.is_active,
    )


@router.patch('/{employee_id}/account', response_model=EmployeeAccountResponse)
def update_account(
    request: Request,
    employee_id: uuid.UUID,
    data: EmployeeAccountUpdate,
    session: SessionDep,
    _: Annotated[None, Depends(require_hr)],
    current_user: CurrentUser,
):
    emp = svc.get_employee_or_404(session, employee_id)
    user_account = svc.update_employee_account(session, emp, data, current_user, get_client_ip(request))
    return EmployeeAccountResponse(
        employee_id=user_account.employee_id,
        google_email=user_account.google_email,
        role=user_account.role,
        is_active=user_account.is_active,
    )


# ─── Department History ────────────────────────────────────────────────────────

@router.get('/{employee_id}/department-history', response_model=List[DepartmentHistoryResponse])
def get_department_history(
    employee_id: uuid.UUID,
    session: SessionDep,
    _: Annotated[None, Depends(require_not_project_officer)],
    current_user: CurrentUser,
):
    emp = svc.get_employee_or_404(session, employee_id)
    history = session.exec(
        select(EmployeeDepartmentHistory)
        .where(EmployeeDepartmentHistory.employee_id == emp.id)
        .order_by(EmployeeDepartmentHistory.created_at.desc())
    ).all()
    return [DepartmentHistoryResponse.model_validate(h) for h in history]
