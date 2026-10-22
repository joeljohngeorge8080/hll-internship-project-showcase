from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.core.config import settings
from app.core.ses import send_invite_email
from app.models.audit import ActionType
from app.models.employee import Employee
from app.models.user import User, UserRole
from app.schemas.user import UserAccountCreate, UserAccountResponse
from app.services.audit_service import write_audit

MODULE = 'UserManagement'


def _now() -> datetime:
    return datetime.now(timezone.utc)


# Project Coordinator/Associate can see and grant Project Officer access only —
# everything else in the users table (Admin, HR, other Coordinators/Associates
# etc.) stays invisible to them.
_OFFICER_MANAGER_ROLES = (UserRole.PROJECT_COORDINATOR, UserRole.PROJECT_ASSOCIATE)


def list_user_accounts(session: Session, actor: Optional[User] = None) -> List[User]:
    query = select(User).order_by(User.created_at)
    if actor and actor.role in _OFFICER_MANAGER_ROLES:
        query = query.where(User.role == UserRole.PROJECT_OFFICER)
    return session.exec(query).all()


def create_user_account(
    session: Session,
    data: UserAccountCreate,
    actor: User,
    ip: Optional[str] = None,
) -> UserAccountResponse:
    if actor.role != UserRole.ADMIN and data.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Only an Admin can grant the Admin role',
        )
    if actor.role in _OFFICER_MANAGER_ROLES and data.role != UserRole.PROJECT_OFFICER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='You can only grant Project Officer access',
        )

    existing = session.exec(select(User).where(User.google_email == data.google_email)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f'{data.google_email} is already registered',
        )

    if data.employee_id:
        # Select only id/employee_id — Employee also declares columns
        # (designation, department, state_for_pt, joining_date, reporting_to,
        # etc.) that live on employee_employment in the current Supabase
        # schema, not on employees itself. A full `select(Employee)` 500s
        # with UndefinedColumn; we only need to confirm the ID exists here.
        employee = session.exec(
            select(Employee.id, Employee.employee_id).where(Employee.employee_id == data.employee_id)
        ).first()
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f'No employee found with ID {data.employee_id} — check Staff & Payroll for the correct ID',
            )
        linked = session.exec(select(User).where(User.employee_id == data.employee_id)).first()
        if linked:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f'{data.employee_id} is already linked to another login account',
            )

    user = User(
        full_name=data.full_name,
        google_email=data.google_email,
        role=data.role,
        employee_id=data.employee_id,
        password_hash=None,
        is_active=True,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(user)
    session.flush()

    write_audit(
        session, actor, MODULE, ActionType.CREATE,
        record_id=str(user.id),
        new_value={
            'full_name': user.full_name,
            'google_email': user.google_email,
            'role': str(user.role),
            'employee_id': user.employee_id,
        },
        ip_address=ip,
    )
    session.commit()
    session.refresh(user)

    login_url = f'{settings.FRONTEND_URL}/'
    # SES is in sandbox mode: send fails silently (returns False) unless the
    # recipient address was pre-verified in the SES console. Surface that on
    # the response so the admin knows to verify + resend, instead of assuming
    # the new hire got the email. Built explicitly rather than set on `user`
    # itself — SQLModel/pydantic v2 rejects attributes that aren't declared
    # table columns.
    email_sent = send_invite_email(user.google_email, user.full_name, login_url)

    return UserAccountResponse(
        id=user.id,
        employee_id=user.employee_id,
        full_name=user.full_name,
        google_email=user.google_email,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        email_sent=email_sent,
    )


def delete_user_account(
    session: Session,
    user_id,
    actor: User,
    ip: Optional[str] = None,
) -> None:
    target = session.get(User, user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not found')
    if target.id == actor.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='You cannot remove your own access')
    if target.role == UserRole.ADMIN and actor.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Only an Admin can remove an Admin account')

    write_audit(
        session, actor, MODULE, ActionType.DELETE,
        record_id=str(target.id),
        old_value={'full_name': target.full_name, 'google_email': target.google_email, 'role': str(target.role)},
        ip_address=ip,
    )
    session.delete(target)
    session.commit()
