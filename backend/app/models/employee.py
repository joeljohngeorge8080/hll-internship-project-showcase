import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional

from sqlalchemy import Column, Numeric
from sqlmodel import Field, SQLModel


# ─── Enums ────────────────────────────────────────────────────────────────────

class EmployeeStatus(str, Enum):
    ACTIVE = 'Active'
    INACTIVE = 'Inactive'
    RESIGNED = 'Resigned'
    RETIRED = 'Retired'


class EmployeeCategory(str, Enum):
    PERMANENT = 'Permanent'
    FTC = 'FTC'
    TPC = 'TPC'


class Gender(str, Enum):
    MALE = 'Male'
    FEMALE = 'Female'
    OTHER = 'Other'


class MaritalStatus(str, Enum):
    SINGLE = 'Single'
    MARRIED = 'Married'
    DIVORCED = 'Divorced'
    WIDOWED = 'Widowed'


class DocumentCategory(str, Enum):
    RESUME = 'Resume'
    EDUCATION = 'Education'
    IDENTITY_PROOF = 'Identity Proof'
    EMPLOYMENT_DOCUMENTS = 'Employment Documents'
    OTHER = 'Other'


class AddressType(str, Enum):
    PRESENT = 'Present'
    PERMANENT = 'Permanent'


class AssignmentStatus(str, Enum):
    ACTIVE = 'Active'
    COMPLETED = 'Completed'
    REASSIGNED = 'Reassigned'


class IncrementPercentage(float, Enum):
    THREE = 3.0
    SIX = 6.0
    EIGHT = 8.0


# ─── Core Employee ─────────────────────────────────────────────────────────────

class Employee(SQLModel, table=True):
    __tablename__ = 'employees'

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    employee_id: str = Field(unique=True, nullable=False, index=True, max_length=20)

    # Section 1 — Basic Information
    first_name: str = Field(nullable=False, max_length=100)
    middle_name: Optional[str] = Field(default=None, max_length=100)
    last_name: str = Field(nullable=False, max_length=100)
    gender: Gender = Field(nullable=False)
    date_of_birth: date = Field(nullable=False)
    marital_status: Optional[MaritalStatus] = Field(default=None)
    blood_group: Optional[str] = Field(default=None, max_length=5)

    # Section 4 — Employment Information (snapshot; changes logged to history)
    designation: str = Field(nullable=False, max_length=100)
    department: str = Field(nullable=False, max_length=100)
    employee_category: EmployeeCategory = Field(nullable=False)
    state_for_pt: str = Field(nullable=False, max_length=100)
    joining_date: date = Field(nullable=False)
    reporting_to: Optional[uuid.UUID] = Field(default=None, foreign_key='employees.id')
    exit_date: Optional[date] = Field(default=None)

    # Salary — never updated directly; always via salary_history transaction
    current_salary: Decimal = Field(
        sa_column=Column(Numeric(12, 2), nullable=False),
    )

    # Status
    status: EmployeeStatus = Field(default=EmployeeStatus.ACTIVE, nullable=False, index=True)

    # Audit
    created_by: uuid.UUID = Field(foreign_key='users.id', nullable=False)
    created_at: datetime = Field(nullable=False)
    updated_at: datetime = Field(nullable=False)


# ─── Contact Information ───────────────────────────────────────────────────────

class EmployeeContactInformation(SQLModel, table=True):
    __tablename__ = 'employee_contact_information'

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    employee_id: uuid.UUID = Field(foreign_key='employees.id', nullable=False, unique=True, index=True)
    personal_email: Optional[str] = Field(default=None, max_length=255)
    working_email: str = Field(nullable=False, max_length=255)
    mobile_number: str = Field(nullable=False, max_length=15)
    phone_number: Optional[str] = Field(default=None, max_length=15)
    emergency_contact: Optional[str] = Field(default=None, max_length=255)
    created_at: datetime = Field(nullable=False)
    updated_at: datetime = Field(nullable=False)


# ─── Addresses ────────────────────────────────────────────────────────────────

class EmployeeAddress(SQLModel, table=True):
    __tablename__ = 'employee_addresses'

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    employee_id: uuid.UUID = Field(foreign_key='employees.id', nullable=False, index=True)
    address_type: AddressType = Field(nullable=False)
    address_line1: str = Field(nullable=False)
    address_line2: Optional[str] = Field(default=None)
    city: Optional[str] = Field(default=None, max_length=100)
    state: str = Field(nullable=False, max_length=100)
    pincode: Optional[str] = Field(default=None, max_length=10)
    country: str = Field(default='India', max_length=100)
    resident_location: Optional[str] = Field(default=None, max_length=200)
    created_at: datetime = Field(nullable=False)
    updated_at: datetime = Field(nullable=False)


# ─── Government Identification ─────────────────────────────────────────────────

class EmployeeIdentification(SQLModel, table=True):
    __tablename__ = 'employee_identification'

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    employee_id: uuid.UUID = Field(foreign_key='employees.id', nullable=False, unique=True, index=True)
    pan_number: Optional[str] = Field(default=None, max_length=10)
    aadhar_number: Optional[str] = Field(default=None, max_length=12)
    uan_number: Optional[str] = Field(default=None, max_length=12)
    esi_number: Optional[str] = Field(default=None, max_length=17)
    pf_number: Optional[str] = Field(default=None, max_length=22)
    passport_number: Optional[str] = Field(default=None, max_length=20)
    created_at: datetime = Field(nullable=False)
    updated_at: datetime = Field(nullable=False)


# ─── Bank Accounts ─────────────────────────────────────────────────────────────

class EmployeeBankAccount(SQLModel, table=True):
    __tablename__ = 'employee_bank_accounts'

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    employee_id: uuid.UUID = Field(foreign_key='employees.id', nullable=False, index=True)
    bank_name: str = Field(nullable=False, max_length=100)
    account_number: str = Field(nullable=False, max_length=20)
    ifsc_code: str = Field(nullable=False, max_length=11)
    is_primary: bool = Field(default=False, nullable=False)
    created_at: datetime = Field(nullable=False)
    updated_at: datetime = Field(nullable=False)


# ─── Family Members ────────────────────────────────────────────────────────────

class EmployeeFamilyMember(SQLModel, table=True):
    __tablename__ = 'employee_family_members'

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    employee_id: uuid.UUID = Field(foreign_key='employees.id', nullable=False, index=True)
    name: str = Field(nullable=False, max_length=200)
    relationship: str = Field(nullable=False, max_length=50)
    contact_number: Optional[str] = Field(default=None, max_length=15)
    date_of_birth: Optional[date] = Field(default=None)
    aadhar_number: Optional[str] = Field(default=None, max_length=12)
    pan_number: Optional[str] = Field(default=None, max_length=10)
    created_at: datetime = Field(nullable=False)
    updated_at: datetime = Field(nullable=False)


# ─── Documents (S3-backed) ─────────────────────────────────────────────────────

class EmployeeDocument(SQLModel, table=True):
    __tablename__ = 'employee_documents'

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    employee_id: uuid.UUID = Field(foreign_key='employees.id', nullable=False, index=True)
    document_name: str = Field(nullable=False, max_length=255)
    document_category: DocumentCategory = Field(nullable=False, index=True)
    file_key: str = Field(nullable=False, max_length=500)   # S3 object key
    file_name: str = Field(nullable=False, max_length=255)
    file_size_bytes: Optional[int] = Field(default=None)
    content_type: Optional[str] = Field(default=None, max_length=100)
    uploaded_by: uuid.UUID = Field(foreign_key='users.id', nullable=False)
    uploaded_at: datetime = Field(nullable=False)
    remarks: Optional[str] = Field(default=None)
    is_deleted: bool = Field(default=False, nullable=False)  # soft delete — never hard-delete


# ─── Salary History (append-only) ─────────────────────────────────────────────

class EmployeeSalaryHistory(SQLModel, table=True):
    __tablename__ = 'employee_salary_history'

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    employee_id: uuid.UUID = Field(foreign_key='employees.id', nullable=False, index=True)
    previous_salary: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    increment_percentage: Decimal = Field(sa_column=Column(Numeric(5, 2), nullable=False))
    increment_amount: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    new_salary: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    effective_date: date = Field(nullable=False)
    remarks: Optional[str] = Field(default=None)
    changed_by: uuid.UUID = Field(foreign_key='users.id', nullable=False)
    created_at: datetime = Field(nullable=False)


# ─── Department History (append-only) ─────────────────────────────────────────

class EmployeeDepartmentHistory(SQLModel, table=True):
    __tablename__ = 'employee_department_history'

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    employee_id: uuid.UUID = Field(foreign_key='employees.id', nullable=False, index=True)
    previous_department: str = Field(nullable=False, max_length=100)
    new_department: str = Field(nullable=False, max_length=100)
    effective_date: date = Field(nullable=False)
    remarks: Optional[str] = Field(default=None)
    changed_by: uuid.UUID = Field(foreign_key='users.id', nullable=False)
    created_at: datetime = Field(nullable=False)


# ─── Project Assignments (append-only) ────────────────────────────────────────

class EmployeeProjectAssignment(SQLModel, table=True):
    __tablename__ = 'employee_project_assignments'

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    employee_id: uuid.UUID = Field(foreign_key='employees.id', nullable=False, index=True)
    project_id: uuid.UUID = Field(foreign_key='projects.id', nullable=False, index=True)
    allocation_start_date: date = Field(nullable=False)
    allocation_end_date: Optional[date] = Field(default=None)
    status: AssignmentStatus = Field(default=AssignmentStatus.ACTIVE, nullable=False)
    remarks: Optional[str] = Field(default=None)
    assigned_by: uuid.UUID = Field(foreign_key='users.id', nullable=False)
    created_at: datetime = Field(nullable=False)
    updated_at: datetime = Field(nullable=False)
