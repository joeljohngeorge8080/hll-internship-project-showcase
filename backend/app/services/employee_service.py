import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlmodel import Session, col, select

from app.core.security import hash_password
from app.models.audit import ActionType
from app.models.employee import (
    Employee,
    EmployeeAddress,
    EmployeeBankAccount,
    EmployeeContactInformation,
    EmployeeDepartmentHistory,
    EmployeeFamilyMember,
    EmployeeIdentification,
    EmployeeProjectAssignment,
    EmployeeSalaryHistory,
    EmployeeStatus,
)
from app.models.user import User, UserRole
from app.schemas.employee import (
    AddressUpsert,
    BankAccountCreate,
    ContactInformationUpdate,
    DepartmentChangeRequest,
    EmployeeAccountUpdate,
    EmployeeCreate,
    EmployeeStatusUpdate,
    EmployeeUpdate,
    FamilyMemberCreate,
    IdentificationUpdate,
    SalaryDirectUpdateRequest,
    SalaryIncrementRequest,
)
from app.services.audit_service import write_audit

MODULE = 'Staff & Payroll'


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ─── Employee CRUD ─────────────────────────────────────────────────────────────

def create_employee(
    session: Session,
    data: EmployeeCreate,
    actor: User,
    ip: Optional[str] = None,
) -> Employee:
    existing = session.exec(select(Employee).where(Employee.employee_id == data.employee_id)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f'Employee ID {data.employee_id} already exists')

    existing_user = session.exec(select(User).where(User.employee_id == data.employee_id)).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f'Login account for {data.employee_id} already exists')

    creating_account = (
        data.google_email is not None and data.default_password is not None
    )
    if creating_account:
        email_conflict = session.exec(select(User).where(User.google_email == data.google_email)).first()
        if email_conflict:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f'{data.google_email} is already assigned to another account')

    now = _now()
    emp = Employee(
        **{k: v for k, v in data.model_dump().items() if k not in {
            'working_email', 'personal_email', 'mobile_number', 'phone_number', 'emergency_contact',
            'google_email', 'default_password', 'user_role',
        }},
        created_by=actor.id,
        created_at=now,
        updated_at=now,
    )
    session.add(emp)
    session.flush()  # get emp.id

    contact = EmployeeContactInformation(
        employee_id=emp.id,
        personal_email=data.personal_email,
        working_email=data.working_email,
        mobile_number=data.mobile_number,
        phone_number=data.phone_number,
        emergency_contact=data.emergency_contact,
        created_at=now,
        updated_at=now,
    )
    session.add(contact)

    audit_extra = {}
    if creating_account:
        user_account = User(
            employee_id=emp.employee_id,
            google_email=data.google_email,
            password_hash=hash_password(data.default_password),
            role=data.user_role or UserRole.PROJECT_OFFICER,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        session.add(user_account)
        audit_extra = {
            'google_email': data.google_email,
            'user_role': str(data.user_role or UserRole.PROJECT_OFFICER),
        }

    write_audit(
        session, actor, MODULE, ActionType.CREATE,
        record_id=str(emp.id),
        new_value={
            'employee_id': emp.employee_id,
            'full_name': f'{emp.first_name} {emp.last_name}',
            **audit_extra,
        },
        ip_address=ip,
    )
    session.commit()
    session.refresh(emp)
    return emp


def list_employees(
    session: Session,
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    status: Optional[EmployeeStatus] = None,
    department: Optional[str] = None,
    category: Optional[str] = None,
) -> Tuple[List[Employee], int]:
    query = select(Employee)
    if search:
        term = f'%{search}%'
        query = query.where(
            (col(Employee.first_name).ilike(term))
            | (col(Employee.last_name).ilike(term))
            | (col(Employee.employee_id).ilike(term))
        )
    if status:
        query = query.where(Employee.status == status)
    if department:
        query = query.where(Employee.department == department)
    if category:
        query = query.where(Employee.employee_category == category)

    total = len(session.exec(query).all())
    items = session.exec(query.offset((page - 1) * page_size).limit(page_size)).all()
    return items, total


def get_employee_or_404(session: Session, employee_db_id: uuid.UUID) -> Employee:
    emp = session.get(Employee, employee_db_id)
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Employee not found')
    return emp


def update_employee(
    session: Session,
    emp: Employee,
    data: EmployeeUpdate,
    actor: User,
    ip: Optional[str] = None,
) -> Employee:
    old_dept = emp.department
    old_snapshot = {
        'designation': emp.designation,
        'department': emp.department,
        'status': emp.status,
    }

    update_data = data.model_dump(exclude_none=True)
    new_dept = update_data.get('department')

    for k, v in update_data.items():
        setattr(emp, k, v)
    emp.updated_at = _now()

    if new_dept and new_dept != old_dept:
        hist = EmployeeDepartmentHistory(
            employee_id=emp.id,
            previous_department=old_dept,
            new_department=new_dept,
            effective_date=_now().date(),
            changed_by=actor.id,
            created_at=_now(),
        )
        session.add(hist)

    write_audit(
        session, actor, MODULE, ActionType.UPDATE,
        record_id=str(emp.id),
        old_value=old_snapshot,
        new_value=update_data,
        ip_address=ip,
    )
    session.add(emp)
    session.commit()
    session.refresh(emp)
    return emp


def change_employee_status(
    session: Session,
    emp: Employee,
    data: EmployeeStatusUpdate,
    actor: User,
    ip: Optional[str] = None,
) -> Employee:
    old_status = emp.status
    emp.status = data.status
    if data.exit_date:
        emp.exit_date = data.exit_date
    emp.updated_at = _now()

    write_audit(
        session, actor, MODULE, ActionType.STATUS_CHANGE,
        record_id=str(emp.id),
        old_value={'status': old_status},
        new_value={'status': data.status, 'exit_date': str(data.exit_date) if data.exit_date else None},
        remarks=data.remarks,
        ip_address=ip,
    )
    session.add(emp)
    session.commit()
    session.refresh(emp)
    return emp


# ─── Salary Increment ─────────────────────────────────────────────────────────

def apply_salary_increment(
    session: Session,
    emp: Employee,
    data: SalaryIncrementRequest,
    actor: User,
    ip: Optional[str] = None,
) -> EmployeeSalaryHistory:
    previous_salary = emp.current_salary
    increment_amount = (previous_salary * Decimal(str(data.increment_percentage.value)) / Decimal('100')).quantize(Decimal('0.01'))
    new_salary = previous_salary + increment_amount

    hist = EmployeeSalaryHistory(
        employee_id=emp.id,
        previous_salary=previous_salary,
        increment_percentage=Decimal(str(data.increment_percentage.value)),
        increment_amount=increment_amount,
        new_salary=new_salary,
        effective_date=data.effective_date,
        remarks=data.remarks,
        changed_by=actor.id,
        created_at=_now(),
    )

    emp.current_salary = new_salary
    emp.updated_at = _now()

    session.add(hist)
    session.add(emp)

    write_audit(
        session, actor, MODULE, ActionType.SALARY_INCREMENT,
        record_id=str(emp.id),
        old_value={'salary': str(previous_salary)},
        new_value={
            'salary': str(new_salary),
            'increment_pct': str(data.increment_percentage.value),
            'increment_amount': str(increment_amount),
            'effective_date': str(data.effective_date),
        },
        remarks=data.remarks,
        ip_address=ip,
    )
    session.commit()
    session.refresh(hist)
    return hist


def apply_salary_direct_update(
    session: Session,
    emp: Employee,
    data: SalaryDirectUpdateRequest,
    actor: User,
    ip: Optional[str] = None,
) -> EmployeeSalaryHistory:
    previous_salary = emp.current_salary
    new_salary = data.new_salary.quantize(Decimal('0.01'))
    increment_amount = (new_salary - previous_salary).quantize(Decimal('0.01'))

    hist = EmployeeSalaryHistory(
        employee_id=emp.id,
        previous_salary=previous_salary,
        increment_percentage=Decimal('0'),
        increment_amount=increment_amount,
        new_salary=new_salary,
        effective_date=data.effective_date,
        remarks=data.remarks,
        changed_by=actor.id,
        created_at=_now(),
    )

    emp.current_salary = new_salary
    emp.updated_at = _now()

    session.add(hist)
    session.add(emp)

    write_audit(
        session, actor, MODULE, ActionType.SALARY_UPDATE,
        record_id=str(emp.id),
        old_value={'salary': str(previous_salary)},
        new_value={
            'salary': str(new_salary),
            'increment_amount': str(increment_amount),
            'effective_date': str(data.effective_date),
        },
        remarks=data.remarks,
        ip_address=ip,
    )
    session.commit()
    session.refresh(hist)
    return hist


def get_salary_history(session: Session, employee_id: uuid.UUID) -> List[EmployeeSalaryHistory]:
    return session.exec(
        select(EmployeeSalaryHistory)
        .where(EmployeeSalaryHistory.employee_id == employee_id)
        .order_by(col(EmployeeSalaryHistory.created_at).desc())
    ).all()


# ─── Contact / Address / Identification ───────────────────────────────────────

def upsert_contact(
    session: Session,
    emp: Employee,
    data: ContactInformationUpdate,
    actor: User,
    ip: Optional[str] = None,
) -> EmployeeContactInformation:
    now = _now()
    contact = session.exec(
        select(EmployeeContactInformation).where(EmployeeContactInformation.employee_id == emp.id)
    ).first()

    if contact:
        old = contact.model_dump()
        for k, v in data.model_dump(exclude_none=True).items():
            setattr(contact, k, v)
        contact.updated_at = now
    else:
        contact = EmployeeContactInformation(
            employee_id=emp.id,
            **data.model_dump(exclude_none=True),
            created_at=now,
            updated_at=now,
        )

    write_audit(session, actor, MODULE, ActionType.UPDATE, record_id=str(emp.id),
                new_value=data.model_dump(exclude_none=True), ip_address=ip)
    session.add(contact)
    session.commit()
    session.refresh(contact)
    return contact


def upsert_address(
    session: Session,
    emp: Employee,
    data: AddressUpsert,
    actor: User,
    ip: Optional[str] = None,
) -> EmployeeAddress:
    now = _now()
    addr = session.exec(
        select(EmployeeAddress).where(
            EmployeeAddress.employee_id == emp.id,
            EmployeeAddress.address_type == data.address_type,
        )
    ).first()

    if addr:
        for k, v in data.model_dump(exclude_none=True).items():
            setattr(addr, k, v)
        addr.updated_at = now
    else:
        addr = EmployeeAddress(employee_id=emp.id, **data.model_dump(), created_at=now, updated_at=now)

    write_audit(session, actor, MODULE, ActionType.UPDATE, record_id=str(emp.id),
                new_value=data.model_dump(), ip_address=ip)
    session.add(addr)
    session.commit()
    session.refresh(addr)
    return addr


def upsert_identification(
    session: Session,
    emp: Employee,
    data: IdentificationUpdate,
    actor: User,
    ip: Optional[str] = None,
) -> EmployeeIdentification:
    now = _now()
    ident = session.exec(
        select(EmployeeIdentification).where(EmployeeIdentification.employee_id == emp.id)
    ).first()

    if ident:
        for k, v in data.model_dump(exclude_none=True).items():
            setattr(ident, k, v)
        ident.updated_at = now
    else:
        ident = EmployeeIdentification(employee_id=emp.id, **data.model_dump(), created_at=now, updated_at=now)

    write_audit(session, actor, MODULE, ActionType.UPDATE, record_id=str(emp.id),
                new_value=data.model_dump(exclude_none=True), ip_address=ip)
    session.add(ident)
    session.commit()
    session.refresh(ident)
    return ident


# ─── Bank Accounts ─────────────────────────────────────────────────────────────

def add_bank_account(
    session: Session,
    emp: Employee,
    data: BankAccountCreate,
    actor: User,
    ip: Optional[str] = None,
) -> EmployeeBankAccount:
    now = _now()
    if data.is_primary:
        existing = session.exec(
            select(EmployeeBankAccount).where(
                EmployeeBankAccount.employee_id == emp.id,
                EmployeeBankAccount.is_primary == True,  # noqa: E712
            )
        ).all()
        for acc in existing:
            acc.is_primary = False
            session.add(acc)

    account = EmployeeBankAccount(
        employee_id=emp.id, **data.model_dump(), created_at=now, updated_at=now,
    )
    write_audit(session, actor, MODULE, ActionType.UPDATE, record_id=str(emp.id),
                new_value={'bank_account': data.model_dump(exclude={'is_primary'})}, ip_address=ip)
    session.add(account)
    session.commit()
    session.refresh(account)
    return account


# ─── Family Members ────────────────────────────────────────────────────────────

def add_family_member(
    session: Session,
    emp: Employee,
    data: FamilyMemberCreate,
    actor: User,
    ip: Optional[str] = None,
) -> EmployeeFamilyMember:
    now = _now()
    member = EmployeeFamilyMember(
        employee_id=emp.id, **data.model_dump(), created_at=now, updated_at=now,
    )
    write_audit(session, actor, MODULE, ActionType.UPDATE, record_id=str(emp.id),
                new_value={'family_member': data.model_dump()}, ip_address=ip)
    session.add(member)
    session.commit()
    session.refresh(member)
    return member




# ─── Account Management ───────────────────────────────────────────────────────

def update_employee_account(
    session: Session,
    emp: Employee,
    data: EmployeeAccountUpdate,
    actor: User,
    ip: Optional[str] = None,
) -> User:
    user_account = session.exec(
        select(User).where(User.employee_id == emp.employee_id)
    ).first()
    if not user_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='No login account found for this employee',
        )

    old_snapshot = {
        'google_email': user_account.google_email,
        'role': str(user_account.role),
    }

    new_snapshot: dict = {}

    if data.google_email is not None:
        conflict = session.exec(
            select(User).where(
                User.google_email == data.google_email,
                User.id != user_account.id,
            )
        ).first()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f'{data.google_email} is already assigned to another account',
            )
        user_account.google_email = data.google_email
        new_snapshot['google_email'] = data.google_email

    if data.new_password is not None:
        user_account.password_hash = hash_password(data.new_password)
        new_snapshot['password'] = 'changed'

    if data.user_role is not None:
        user_account.role = data.user_role
        new_snapshot['role'] = str(data.user_role)

    user_account.updated_at = _now()
    new_snapshot['changed_by'] = actor.employee_id

    write_audit(
        session, actor, MODULE, ActionType.UPDATE,
        record_id=str(emp.id),
        old_value=old_snapshot,
        new_value=new_snapshot,
        ip_address=ip,
    )
    session.add(user_account)
    session.commit()
    session.refresh(user_account)
    return user_account
