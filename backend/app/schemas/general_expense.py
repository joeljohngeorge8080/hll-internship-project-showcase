import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, field_validator

from app.models.general_expense import ExpenseFrequency, ExpenseStatus


# ── Categories ─────────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None

    @field_validator('name')
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('Category name cannot be empty')
        return v


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class CategoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {'from_attributes': True}


# ── Expenses ───────────────────────────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    category_id: uuid.UUID
    expense_name: str
    month: int
    year: int
    frequency: ExpenseFrequency = ExpenseFrequency.MONTHLY
    planned_amount: float
    actual_amount: float = 0.0
    status: ExpenseStatus = ExpenseStatus.PENDING
    remarks: Optional[str] = None

    @field_validator('month')
    @classmethod
    def valid_month(cls, v: int) -> int:
        if not 1 <= v <= 12:
            raise ValueError('Month must be between 1 and 12')
        return v

    @field_validator('year')
    @classmethod
    def valid_year(cls, v: int) -> int:
        if not 2000 <= v <= 2100:
            raise ValueError('Year must be between 2000 and 2100')
        return v

    @field_validator('planned_amount')
    @classmethod
    def planned_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError('Planned amount must be non-negative')
        return v

    @field_validator('actual_amount')
    @classmethod
    def actual_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError('Actual amount must be non-negative')
        return v


class ExpenseUpdate(BaseModel):
    category_id: Optional[uuid.UUID] = None
    expense_name: Optional[str] = None
    month: Optional[int] = None
    year: Optional[int] = None
    frequency: Optional[ExpenseFrequency] = None
    planned_amount: Optional[float] = None
    actual_amount: Optional[float] = None
    status: Optional[ExpenseStatus] = None
    remarks: Optional[str] = None

    @field_validator('month')
    @classmethod
    def valid_month(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not 1 <= v <= 12:
            raise ValueError('Month must be between 1 and 12')
        return v

    @field_validator('year')
    @classmethod
    def valid_year(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not 2000 <= v <= 2100:
            raise ValueError('Year must be between 2000 and 2100')
        return v

    @field_validator('planned_amount')
    @classmethod
    def planned_non_negative(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError('Planned amount must be non-negative')
        return v

    @field_validator('actual_amount')
    @classmethod
    def actual_non_negative(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError('Actual amount must be non-negative')
        return v


class ExpenseRow(BaseModel):
    id: uuid.UUID
    category_id: uuid.UUID
    category_name: str
    expense_name: str
    month: int
    year: int
    frequency: str
    planned_amount: float
    actual_amount: float
    variance: float
    status: str
    remarks: Optional[str]
    upload_id: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {'from_attributes': True}


class ExpenseListResponse(BaseModel):
    items: List[ExpenseRow]
    total: int
    total_pages: int
    page: int


# ── Uploads ────────────────────────────────────────────────────────────────────

class UploadResponse(BaseModel):
    id: uuid.UUID
    file_name: str
    month: int
    year: int
    row_count: int
    status: str
    error_log: Optional[str]
    uploaded_at: datetime

    model_config = {'from_attributes': True}


# ── Analysis ───────────────────────────────────────────────────────────────────

class CategorySummary(BaseModel):
    category_id: str
    category_name: str
    planned_total: float
    actual_total: float
    variance_total: float


class MonthSummary(BaseModel):
    month: int
    year: int
    planned_total: float
    actual_total: float
    variance_total: float
    record_count: int


class AnalysisResponse(BaseModel):
    year: int
    ytd_planned: float
    ytd_actual: float
    ytd_variance: float
    monthly_summary: List[MonthSummary]
    category_summary: List[CategorySummary]
    status_breakdown: dict
