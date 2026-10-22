import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class UserRole(str, Enum):
    ADMIN = 'Admin'
    CEO = 'CEO'
    HEADS = 'Heads'
    HR = 'HR'
    FINANCE = 'Finance'
    PROJECT_OFFICER = 'Project Officer'
    PROJECT_ASSOCIATE = 'Project Associate'
    PROJECT_COORDINATOR = 'Project Coordinator'
    FIELD_PERSONNEL = 'Field Personnel'
    BACKEND_TEAM = 'Backend Team'
    EMPLOYEE = 'Employee'


class User(SQLModel, table=True):
    __tablename__ = 'users'

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    employee_id: Optional[str] = Field(default=None, unique=True, index=True, max_length=50)
    google_email: str = Field(unique=True, nullable=False, index=True, max_length=255)
    full_name: Optional[str] = Field(default=None, max_length=100)
    password_hash: Optional[str] = Field(default=None)
    role: UserRole = Field(nullable=False)
    is_active: bool = Field(default=True, nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    last_login_at: Optional[datetime] = Field(default=None)
