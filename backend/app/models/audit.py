import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class ActionType(str, Enum):
    CREATE = 'Create'
    UPDATE = 'Update'
    DELETE = 'Delete'
    CORRECTION = 'Correction'
    LOGIN = 'Login'
    LOGOUT = 'Logout'
    OVERRIDE = 'Override'
    PASSWORD_RESET = 'PasswordReset'
    SALARY_INCREMENT = 'SalaryIncrement'
    SALARY_UPDATE = 'SalaryUpdate'
    STATUS_CHANGE = 'StatusChange'
    DOCUMENT_UPLOAD = 'DocumentUpload'
    ACCESS_DENIED = 'AccessDenied'


class AuditLog(SQLModel, table=True):
    """Mirrors the Supabase-native `audit_logs` table (see
    supabase/migrations/00000000000017_audit_log.sql, extended by
    00000000000060, 00000000000077, and 00000000000084). That table is also
    written to automatically by a Postgres trigger (audit_log_row()) on
    projects/employees/salary_details/core_salaries, so this model's shape
    is NOT ours to redefine independently — it must always match those
    migrations. `create_all()` only issues `CREATE TABLE IF NOT EXISTS`, so
    as long as this matches the migration-created table, it's a no-op in
    every environment where the migration already ran.

    The backend writes rows here directly (not via the `log_manual_audit_entry`
    RPC that browser/supabase-js callers use) because `write_audit()` is only
    ever called with an already-authenticated `actor`, so there's no need to
    re-derive identity from a Postgres-session `auth.uid()` — that GUC isn't
    even set on the backend's direct DB connection.
    """

    __tablename__ = 'audit_logs'

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    actor_profile_id: Optional[uuid.UUID] = Field(default=None, index=True)
    actor_employee_id: Optional[uuid.UUID] = Field(default=None, index=True)
    actor_name: Optional[str] = Field(default=None)
    actor_role: Optional[str] = Field(default=None)
    # Manual (backend-originated) rows: table_name doubles as the free-text
    # module label (e.g. "Auth", "General Expenses"), matching how
    # log_manual_audit_entry() uses it for supabase-js callers.
    table_name: str = Field(nullable=False, index=True)
    record_id: Optional[uuid.UUID] = Field(default=None)
    # Trigger rows use 'INSERT'/'UPDATE'/'DELETE'; every backend-originated
    # row is 'MANUAL', with the real action recorded in action_label.
    action: str = Field(default='MANUAL', nullable=False)
    old_data: Optional[Any] = Field(default=None, sa_column=Column(JSONB, nullable=True))
    new_data: Optional[Any] = Field(default=None, sa_column=Column(JSONB, nullable=True))
    entry_kind: str = Field(default='manual', nullable=False, index=True)
    action_label: Optional[str] = Field(default=None)
    record_label: Optional[str] = Field(default=None)
    details: Optional[str] = Field(default=None)
    ip_address: Optional[str] = Field(default=None)
    created_at: datetime = Field(nullable=False, index=True)
