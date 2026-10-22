import uuid
from datetime import date, datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class ProjectStatus(str, Enum):
    PLANNING = 'Planning'
    ACTIVE = 'Active'
    ON_HOLD = 'On Hold'
    COMPLETED = 'Completed'
    CANCELLED = 'Cancelled'


class Project(SQLModel, table=True):
    __tablename__ = 'projects'

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    project_code: str = Field(unique=True, nullable=False, index=True, max_length=50)
    name: str = Field(nullable=False, max_length=200)
    description: Optional[str] = Field(default=None)
    status: ProjectStatus = Field(default=ProjectStatus.PLANNING, nullable=False)
    start_date: Optional[date] = Field(default=None)
    end_date: Optional[date] = Field(default=None)
    created_by: uuid.UUID = Field(foreign_key='users.id', nullable=False)
    created_at: datetime = Field(nullable=False)
    updated_at: datetime = Field(nullable=False)
