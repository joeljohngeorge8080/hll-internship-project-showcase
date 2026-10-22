import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column, Numeric
from sqlmodel import Field, SQLModel


class ExpenseFrequency(str, Enum):
    MONTHLY = 'Monthly'
    QUARTERLY = 'Quarterly'
    ANNUAL = 'Annual'
    ONE_TIME = 'One-time'


class ExpenseStatus(str, Enum):
    PENDING = 'Pending'
    PAID = 'Paid'
    OVERDUE = 'Overdue'
    CANCELLED = 'Cancelled'


class ExpenseCategory(SQLModel, table=True):
    __tablename__ = 'expense_categories'

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(unique=True, nullable=False, max_length=100, index=True)
    description: Optional[str] = Field(default=None)
    is_active: bool = Field(default=True, nullable=False)
    created_by: uuid.UUID = Field(foreign_key='users.id', nullable=False)
    created_at: datetime = Field(nullable=False)
    updated_at: datetime = Field(nullable=False)


class GeneralExpense(SQLModel, table=True):
    __tablename__ = 'general_expenses'

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    category_id: uuid.UUID = Field(foreign_key='expense_categories.id', nullable=False, index=True)
    expense_name: str = Field(nullable=False, max_length=200)
    month: int = Field(nullable=False)
    year: int = Field(nullable=False)
    frequency: ExpenseFrequency = Field(default=ExpenseFrequency.MONTHLY, nullable=False)
    planned_amount: float = Field(sa_column=Column(Numeric(14, 2), nullable=False))
    actual_amount: float = Field(sa_column=Column(Numeric(14, 2), nullable=False, server_default='0'))
    variance: float = Field(sa_column=Column(Numeric(14, 2), nullable=False, server_default='0'))
    status: ExpenseStatus = Field(default=ExpenseStatus.PENDING, nullable=False)
    remarks: Optional[str] = Field(default=None)
    upload_id: Optional[uuid.UUID] = Field(default=None, nullable=True)
    created_by: uuid.UUID = Field(foreign_key='users.id', nullable=False)
    created_at: datetime = Field(nullable=False)
    updated_at: datetime = Field(nullable=False)
    is_deleted: bool = Field(default=False, nullable=False)  # soft delete (ADR-015) — never hard-delete


class ExpenseUpload(SQLModel, table=True):
    __tablename__ = 'expense_uploads'

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    file_name: str = Field(nullable=False, max_length=255)
    file_key: Optional[str] = Field(default=None, max_length=500)
    month: int = Field(nullable=False)
    year: int = Field(nullable=False)
    row_count: int = Field(default=0, nullable=False)
    status: str = Field(default='Done', max_length=20, nullable=False)
    error_log: Optional[str] = Field(default=None)
    uploaded_by: uuid.UUID = Field(foreign_key='users.id', nullable=False)
    uploaded_at: datetime = Field(nullable=False)
