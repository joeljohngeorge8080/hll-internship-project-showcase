import re
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, EmailStr, field_validator, model_validator

from app.models.employee import (
    AddressType,
    AssignmentStatus,
    EmployeeCategory,
    EmployeeStatus,
    Gender,
    IncrementPercentage,
    MaritalStatus,
)
from app.models.user import UserRole


# ─── Employee Master List (table row) ─────────────────────────────────────────

class EmployeeListRow(BaseModel):
    id: uuid.UUID
    employee_id: str
    full_name: str
    state_for_pt: str
    designation: str
    department: str
    employee_category: EmployeeCategory
    gender: Gender
    current_salary: Decimal
    status: EmployeeStatus

    model_config = {'from_attributes': True}


class EmployeeListResponse(BaseModel):
    items: List[EmployeeListRow]
    total: int
    page: int
    page_size: int
    total_pages: int


# ─── Create Employee ───────────────────────────────────────────────────────────

class EmployeeCreate(BaseModel):
    employee_id: str
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    gender: Gender
    date_of_birth: date
    marital_status: Optional[MaritalStatus] = None
    blood_group: Optional[str] = None

    designation: str
    department: str
    employee_category: EmployeeCategory
    state_for_pt: str
    joining_date: date
    reporting_to: Optional[uuid.UUID] = None

    current_salary: Decimal

    # Contact (required at creation)
    working_email: str
    personal_email: Optional[str] = None
    mobile_number: str
    phone_number: Optional[str] = None
    emergency_contact: Optional[str] = None

    # System login — optional at creation time. HR can assign a Google
    # account, password, and role now, or grant access later from the
    # employee's profile page.
    google_email: Optional[str] = None
    default_password: Optional[str] = None
    user_role: Optional[UserRole] = None

    @field_validator('google_email')
    @classmethod
    def validate_google_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip().lower()
        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', v):
            raise ValueError('Invalid email address')
        return v

    @field_validator('default_password')
    @classmethod
    def validate_password(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        return v

    @model_validator(mode='after')
    def validate_account_pair(self) -> 'EmployeeCreate':
        if bool(self.google_email) != bool(self.default_password):
            raise ValueError(
                'google_email and default_password must be provided together to create a '
                'login account, or both left blank to skip account creation'
            )
        return self

    @field_validator('employee_id')
    @classmethod
    def validate_employee_id(cls, v: str) -> str:
        v = v.strip().upper()
        if not re.match(r'^[A-Z0-9]{4,20}$', v):
            raise ValueError('Employee ID must be 4-20 alphanumeric characters (uppercase)')
        return v

    @field_validator('mobile_number')
    @classmethod
    def validate_mobile(cls, v: str) -> str:
        if not re.match(r'^\+?[0-9]{10,15}$', v):
            raise ValueError('Invalid mobile number format')
        return v

    @field_validator('current_salary')
    @classmethod
    def validate_salary(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError('Salary must be greater than zero')
        return v

    @model_validator(mode='after')
    def validate_dates(self) -> 'EmployeeCreate':
        if self.joining_date > date.today():
            raise ValueError('Joining date cannot be in the future')
        if self.date_of_birth >= date.today():
            raise ValueError('Date of birth must be in the past')
        return self


# ─── Update Employee ───────────────────────────────────────────────────────────

class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[Gender] = None
    date_of_birth: Optional[date] = None
    marital_status: Optional[MaritalStatus] = None
    blood_group: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    employee_category: Optional[EmployeeCategory] = None
    state_for_pt: Optional[str] = None
    joining_date: Optional[date] = None
    reporting_to: Optional[uuid.UUID] = None
    exit_date: Optional[date] = None
    # NOTE: current_salary is NOT updatable via this schema — use SalaryIncrementRequest


class EmployeeStatusUpdate(BaseModel):
    status: EmployeeStatus
    exit_date: Optional[date] = None
    remarks: Optional[str] = None

    @model_validator(mode='after')
    def require_exit_date_on_resign_retire(self) -> 'EmployeeStatusUpdate':
        if self.status in (EmployeeStatus.RESIGNED, EmployeeStatus.RETIRED):
            if not self.exit_date:
                raise ValueError('exit_date is required when status is Resigned or Retired')
        return self


# ─── Salary Increment ─────────────────────────────────────────────────────────

class SalaryIncrementRequest(BaseModel):
    increment_percentage: IncrementPercentage  # 3 | 6 | 8 only
    effective_date: date
    remarks: Optional[str] = None

    @field_validator('effective_date')
    @classmethod
    def validate_effective_date(cls, v: date) -> date:
        if v < date.today():
            raise ValueError('Effective date cannot be in the past')
        return v


class SalaryDirectUpdateRequest(BaseModel):
    new_salary: Decimal
    effective_date: date
    remarks: Optional[str] = None

    @field_validator('new_salary')
    @classmethod
    def validate_new_salary(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError('Salary must be greater than zero')
        return v

    @field_validator('effective_date')
    @classmethod
    def validate_effective_date(cls, v: date) -> date:
        if v < date.today():
            raise ValueError('Effective date cannot be in the past')
        return v


class SalaryIncrementResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    previous_salary: Decimal
    increment_percentage: Decimal
    increment_amount: Decimal
    new_salary: Decimal
    effective_date: date
    remarks: Optional[str]
    changed_by: uuid.UUID
    created_at: datetime

    model_config = {'from_attributes': True}


# ─── Contact Information ───────────────────────────────────────────────────────

class ContactInformationUpdate(BaseModel):
    personal_email: Optional[str] = None
    working_email: Optional[str] = None
    mobile_number: Optional[str] = None
    phone_number: Optional[str] = None
    emergency_contact: Optional[str] = None

    @field_validator('mobile_number')
    @classmethod
    def validate_mobile(cls, v: Optional[str]) -> Optional[str]:
        if v and not re.match(r'^\+?[0-9]{10,15}$', v):
            raise ValueError('Invalid mobile number format')
        return v


class ContactInformationResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    personal_email: Optional[str]
    working_email: str
    mobile_number: str
    phone_number: Optional[str]
    emergency_contact: Optional[str]

    model_config = {'from_attributes': True}


# ─── Address ───────────────────────────────────────────────────────────────────

class AddressUpsert(BaseModel):
    address_type: AddressType
    address_line1: str
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: str
    pincode: Optional[str] = None
    country: str = 'India'
    resident_location: Optional[str] = None


class AddressResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    address_type: AddressType
    address_line1: str
    address_line2: Optional[str]
    city: Optional[str]
    state: str
    pincode: Optional[str]
    country: str
    resident_location: Optional[str]

    model_config = {'from_attributes': True}


# ─── Identification ────────────────────────────────────────────────────────────

class IdentificationUpdate(BaseModel):
    pan_number: Optional[str] = None
    aadhar_number: Optional[str] = None
    uan_number: Optional[str] = None
    esi_number: Optional[str] = None
    pf_number: Optional[str] = None
    passport_number: Optional[str] = None

    @field_validator('pan_number')
    @classmethod
    def validate_pan(cls, v: Optional[str]) -> Optional[str]:
        if v and not re.match(r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$', v.upper()):
            raise ValueError('Invalid PAN format (e.g. ABCDE1234F)')
        return v.upper() if v else v

    @field_validator('aadhar_number')
    @classmethod
    def validate_aadhar(cls, v: Optional[str]) -> Optional[str]:
        if v and not re.match(r'^\d{12}$', v):
            raise ValueError('Aadhar must be 12 digits')
        return v

    @field_validator('ifsc_code', mode='before', check_fields=False)
    @classmethod
    def validate_ifsc(cls, v: Optional[str]) -> Optional[str]:
        return v


class IdentificationResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    pan_number: Optional[str]
    aadhar_number: Optional[str]
    uan_number: Optional[str]
    esi_number: Optional[str]
    pf_number: Optional[str]
    passport_number: Optional[str]

    model_config = {'from_attributes': True}


# ─── Bank Account ─────────────────────────────────────────────────────────────

class BankAccountCreate(BaseModel):
    bank_name: str
    account_number: str
    ifsc_code: str
    is_primary: bool = False

    @field_validator('ifsc_code')
    @classmethod
    def validate_ifsc(cls, v: str) -> str:
        if not re.match(r'^[A-Z]{4}0[A-Z0-9]{6}$', v.upper()):
            raise ValueError('Invalid IFSC code format (e.g. SBIN0001234)')
        return v.upper()


class BankAccountResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    bank_name: str
    account_number: str
    ifsc_code: str
    is_primary: bool

    model_config = {'from_attributes': True}


# ─── Family Member ─────────────────────────────────────────────────────────────

class FamilyMemberCreate(BaseModel):
    name: str
    relationship: str
    contact_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    aadhar_number: Optional[str] = None
    pan_number: Optional[str] = None


class FamilyMemberResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    name: str
    relationship: str
    contact_number: Optional[str]
    date_of_birth: Optional[date]
    aadhar_number: Optional[str]
    pan_number: Optional[str]

    model_config = {'from_attributes': True}


# ─── Employee Full Profile ────────────────────────────────────────────────────

class EmployeeProfileResponse(BaseModel):
    id: uuid.UUID
    employee_id: str
    first_name: str
    middle_name: Optional[str]
    last_name: str
    gender: Gender
    date_of_birth: date
    marital_status: Optional[MaritalStatus]
    blood_group: Optional[str]
    designation: str
    department: str
    employee_category: EmployeeCategory
    state_for_pt: str
    joining_date: date
    reporting_to: Optional[uuid.UUID]
    exit_date: Optional[date]
    current_salary: Decimal
    status: EmployeeStatus
    created_at: datetime
    updated_at: datetime

    contact: Optional[ContactInformationResponse] = None
    addresses: List[AddressResponse] = []
    identification: Optional[IdentificationResponse] = None
    bank_accounts: List[BankAccountResponse] = []
    family_members: List[FamilyMemberResponse] = []

    model_config = {'from_attributes': True}


# ─── Account Management (HR: update Google account / role) ────────────────────

class EmployeeAccountUpdate(BaseModel):
    google_email: Optional[str] = None
    new_password: Optional[str] = None
    user_role: Optional[UserRole] = None

    @field_validator('google_email')
    @classmethod
    def validate_google_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip().lower()
        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', v):
            raise ValueError('Invalid email address')
        return v

    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        return v

    @model_validator(mode='after')
    def require_at_least_one(self) -> 'EmployeeAccountUpdate':
        if self.google_email is None and self.new_password is None and self.user_role is None:
            raise ValueError('At least one field must be provided')
        return self


class EmployeeAccountResponse(BaseModel):
    employee_id: str
    google_email: str
    role: str
    is_active: bool

    model_config = {'from_attributes': True}


# ─── Department Change ─────────────────────────────────────────────────────────

class DepartmentChangeRequest(BaseModel):
    new_department: str
    effective_date: date
    remarks: Optional[str] = None


class DepartmentHistoryResponse(BaseModel):
    id: uuid.UUID
    previous_department: str
    new_department: str
    effective_date: date
    remarks: Optional[str]
    changed_by: uuid.UUID
    created_at: datetime

    model_config = {'from_attributes': True}
