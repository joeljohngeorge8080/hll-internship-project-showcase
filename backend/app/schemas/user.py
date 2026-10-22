import re
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

from app.models.user import UserRole


class UserAccountCreate(BaseModel):
    full_name: str
    google_email: str
    role: UserRole
    employee_id: Optional[str] = None

    @field_validator('google_email')
    @classmethod
    def validate_google_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', v):
            raise ValueError('Invalid email address')
        return v

    @field_validator('full_name')
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('Full name is required')
        return v

    @field_validator('employee_id')
    @classmethod
    def validate_employee_id(cls, v: Optional[str]) -> Optional[str]:
        v = (v or '').strip().upper()
        return v or None


class UserAccountResponse(BaseModel):
    id: uuid.UUID
    employee_id: Optional[str] = None
    full_name: Optional[str] = None
    google_email: str
    role: str
    is_active: bool
    created_at: datetime
    email_sent: bool = True

    model_config = {'from_attributes': True}
