import io
import uuid
import zipfile
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlmodel import Session, col, select

from app.models.audit import ActionType
from app.models.general_expense import (
    ExpenseCategory,
    ExpenseFrequency,
    ExpenseStatus,
    ExpenseUpload,
    GeneralExpense,
)
from app.models.user import User
from app.schemas.general_expense import (
    AnalysisResponse,
    CategoryCreate,
    CategorySummary,
    ExpenseCreate,
    ExpenseListResponse,
    ExpenseRow,
    ExpenseUpdate,
    MonthSummary,
    UploadResponse,
)
from app.services.audit_service import write_audit

MODULE = 'General Expenses'


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── Categories ─────────────────────────────────────────────────────────────────

def list_categories(session: Session, include_inactive: bool = False) -> List[ExpenseCategory]:
    stmt = select(ExpenseCategory)
    if not include_inactive:
        stmt = stmt.where(ExpenseCategory.is_active == True)  # noqa: E712
    stmt = stmt.order_by(ExpenseCategory.name)
    return list(session.exec(stmt).all())


def create_category(
    session: Session,
    data: CategoryCreate,
    actor: User,
) -> ExpenseCategory:
    existing = session.exec(
        select(ExpenseCategory).where(col(ExpenseCategory.name) == data.name.strip())
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Category name already exists')

    ts = _now()
    cat = ExpenseCategory(
        name=data.name.strip(),
        description=data.description,
        created_by=actor.id,
        created_at=ts,
        updated_at=ts,
    )
    session.add(cat)
    session.flush()

    write_audit(
        session, actor, MODULE, ActionType.CREATE,
        record_id=str(cat.id),
        new_value={'name': cat.name, 'description': cat.description},
    )
    session.commit()
    session.refresh(cat)
    return cat


def update_category(
    session: Session,
    category_id: uuid.UUID,
    data: Dict[str, Any],
    actor: User,
) -> ExpenseCategory:
    cat = session.get(ExpenseCategory, category_id)
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Category not found')

    old = {'name': cat.name, 'description': cat.description, 'is_active': cat.is_active}

    if 'name' in data and data['name'] is not None:
        new_name = data['name'].strip()
        conflict = session.exec(
            select(ExpenseCategory)
            .where(col(ExpenseCategory.name) == new_name)
            .where(ExpenseCategory.id != category_id)
        ).first()
        if conflict:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Category name already exists')
        cat.name = new_name

    if 'description' in data:
        cat.description = data['description']
    if 'is_active' in data and data['is_active'] is not None:
        cat.is_active = data['is_active']

    cat.updated_at = _now()
    session.add(cat)
    session.flush()

    write_audit(
        session, actor, MODULE, ActionType.UPDATE,
        record_id=str(cat.id),
        old_value=old,
        new_value={'name': cat.name, 'description': cat.description, 'is_active': cat.is_active},
    )
    session.commit()
    session.refresh(cat)
    return cat


def delete_category(session: Session, category_id: uuid.UUID, actor: User) -> None:
    cat = session.get(ExpenseCategory, category_id)
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Category not found')

    in_use = session.exec(
        select(GeneralExpense).where(GeneralExpense.category_id == category_id).limit(1)
    ).first()
    if in_use:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail='Cannot delete a category that has expense records. Deactivate it instead.',
        )

    write_audit(
        session, actor, MODULE, ActionType.DELETE,
        record_id=str(cat.id),
        old_value={'name': cat.name},
    )
    session.delete(cat)
    session.commit()


# ── Expenses ───────────────────────────────────────────────────────────────────

def _cat_map(session: Session) -> Dict[uuid.UUID, str]:
    cats = session.exec(select(ExpenseCategory)).all()
    return {c.id: c.name for c in cats}


def _to_row(expense: GeneralExpense, cat_name: str) -> ExpenseRow:
    return ExpenseRow(
        id=expense.id,
        category_id=expense.category_id,
        category_name=cat_name,
        expense_name=expense.expense_name,
        month=expense.month,
        year=expense.year,
        frequency=expense.frequency.value,
        planned_amount=float(expense.planned_amount),
        actual_amount=float(expense.actual_amount),
        variance=float(expense.variance),
        status=expense.status.value,
        remarks=expense.remarks,
        upload_id=expense.upload_id,
        created_at=expense.created_at,
        updated_at=expense.updated_at,
    )


def list_expenses(
    session: Session,
    year: Optional[int] = None,
    month: Optional[int] = None,
    category_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
) -> ExpenseListResponse:
    stmt = select(GeneralExpense).where(GeneralExpense.is_deleted == False)  # noqa: E712
    if year is not None:
        stmt = stmt.where(GeneralExpense.year == year)
    if month is not None:
        stmt = stmt.where(GeneralExpense.month == month)
    if category_id is not None:
        stmt = stmt.where(GeneralExpense.category_id == category_id)
    if status:
        stmt = stmt.where(GeneralExpense.status == status)

    stmt = stmt.order_by(col(GeneralExpense.year).desc(), col(GeneralExpense.month).desc(), GeneralExpense.expense_name)

    all_rows = list(session.exec(stmt).all())
    total = len(all_rows)
    total_pages = max(1, (total + page_size - 1) // page_size)
    offset = (page - 1) * page_size
    page_rows = all_rows[offset:offset + page_size]

    cats = _cat_map(session)
    items = [_to_row(e, cats.get(e.category_id, 'Unknown')) for e in page_rows]

    return ExpenseListResponse(items=items, total=total, total_pages=total_pages, page=page)


def get_expense(session: Session, expense_id: uuid.UUID) -> Tuple[GeneralExpense, str]:
    exp = session.get(GeneralExpense, expense_id)
    if not exp or exp.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Expense not found')
    cat = session.get(ExpenseCategory, exp.category_id)
    cat_name = cat.name if cat else 'Unknown'
    return exp, cat_name


def create_expense(session: Session, data: ExpenseCreate, actor: User) -> ExpenseRow:
    cat = session.get(ExpenseCategory, data.category_id)
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Category not found')

    ts = _now()
    variance = round(data.actual_amount - data.planned_amount, 2)
    exp = GeneralExpense(
        category_id=data.category_id,
        expense_name=data.expense_name.strip(),
        month=data.month,
        year=data.year,
        frequency=data.frequency,
        planned_amount=data.planned_amount,
        actual_amount=data.actual_amount,
        variance=variance,
        status=data.status,
        remarks=data.remarks,
        created_by=actor.id,
        created_at=ts,
        updated_at=ts,
    )
    session.add(exp)
    session.flush()

    write_audit(
        session, actor, MODULE, ActionType.CREATE,
        record_id=str(exp.id),
        new_value={
            'expense_name': exp.expense_name,
            'category': cat.name,
            'month': exp.month,
            'year': exp.year,
            'planned_amount': float(exp.planned_amount),
            'actual_amount': float(exp.actual_amount),
        },
    )
    session.commit()
    session.refresh(exp)
    return _to_row(exp, cat.name)


def update_expense(
    session: Session, expense_id: uuid.UUID, data: ExpenseUpdate, actor: User
) -> ExpenseRow:
    exp, cat_name = get_expense(session, expense_id)

    old = {
        'expense_name': exp.expense_name,
        'category_id': str(exp.category_id),
        'planned_amount': float(exp.planned_amount),
        'actual_amount': float(exp.actual_amount),
        'status': exp.status.value,
    }

    if data.category_id is not None:
        cat = session.get(ExpenseCategory, data.category_id)
        if not cat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Category not found')
        exp.category_id = data.category_id
        cat_name = cat.name

    if data.expense_name is not None:
        exp.expense_name = data.expense_name.strip()
    if data.month is not None:
        exp.month = data.month
    if data.year is not None:
        exp.year = data.year
    if data.frequency is not None:
        exp.frequency = data.frequency
    if data.planned_amount is not None:
        exp.planned_amount = data.planned_amount
    if data.actual_amount is not None:
        exp.actual_amount = data.actual_amount
    if data.status is not None:
        exp.status = data.status
    if data.remarks is not None:
        exp.remarks = data.remarks

    exp.variance = round(float(exp.actual_amount) - float(exp.planned_amount), 2)
    exp.updated_at = _now()
    session.add(exp)
    session.flush()

    write_audit(
        session, actor, MODULE, ActionType.UPDATE,
        record_id=str(exp.id),
        old_value=old,
        new_value={
            'expense_name': exp.expense_name,
            'planned_amount': float(exp.planned_amount),
            'actual_amount': float(exp.actual_amount),
            'status': exp.status.value,
        },
    )
    session.commit()
    session.refresh(exp)
    return _to_row(exp, cat_name)


def delete_expense(session: Session, expense_id: uuid.UUID, actor: User) -> None:
    exp, cat_name = get_expense(session, expense_id)

    write_audit(
        session, actor, MODULE, ActionType.DELETE,
        record_id=str(exp.id),
        old_value={'expense_name': exp.expense_name, 'category': cat_name, 'year': exp.year, 'month': exp.month},
    )
    exp.is_deleted = True
    exp.updated_at = _now()
    session.add(exp)
    session.commit()


# ── Excel Upload ───────────────────────────────────────────────────────────────

def process_upload(
    session: Session,
    file_bytes: bytes,
    file_name: str,
    month: int,
    year: int,
    actor: User,
) -> UploadResponse:
    try:
        import openpyxl
        from openpyxl.utils.exceptions import InvalidFileException
    except ImportError:
        raise HTTPException(status_code=500, detail='openpyxl not installed')

    try:
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    except (zipfile.BadZipFile, InvalidFileException):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail='File is not a valid Excel file')
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))
    if len(rows) < 2:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail='Excel file has no data rows')

    headers = [str(h).strip().lower() if h else '' for h in rows[0]]

    def col_idx(name: str) -> int:
        try:
            return headers.index(name.lower())
        except ValueError:
            return -1

    i_cat = col_idx('category')
    i_name = col_idx('expense name')
    i_freq = col_idx('frequency')
    i_plan = col_idx('planned amount')
    i_actual = col_idx('actual amount')
    i_status = col_idx('status')
    i_remarks = col_idx('remarks')

    if i_cat == -1 or i_name == -1 or i_plan == -1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='Required columns missing: Category, Expense Name, Planned Amount',
        )

    # First pass: parse and validate every data row without writing anything,
    # so a single bad row rejects the whole file instead of partially
    # committing the rows that happened to validate.
    errors = []
    parsed_rows = []

    for row_num, row in enumerate(rows[1:], start=2):
        try:
            cat_name_raw = str(row[i_cat]).strip() if i_cat >= 0 and row[i_cat] else ''
            expense_name = str(row[i_name]).strip() if i_name >= 0 and row[i_name] else ''

            if not cat_name_raw or not expense_name:
                continue

            planned = float(row[i_plan] or 0) if i_plan >= 0 else 0.0
            actual = float(row[i_actual] or 0) if i_actual >= 0 and row[i_actual] is not None else 0.0

            freq_raw = str(row[i_freq]).strip() if i_freq >= 0 and row[i_freq] else 'Monthly'
            try:
                freq = ExpenseFrequency(freq_raw)
            except ValueError:
                freq = ExpenseFrequency.MONTHLY

            status_raw = str(row[i_status]).strip() if i_status >= 0 and row[i_status] else 'Pending'
            try:
                exp_status = ExpenseStatus(status_raw)
            except ValueError:
                exp_status = ExpenseStatus.PENDING

            remarks = str(row[i_remarks]).strip() if i_remarks >= 0 and row[i_remarks] else None

            parsed_rows.append({
                'category_name': cat_name_raw,
                'expense_name': expense_name,
                'planned': planned,
                'actual': actual,
                'frequency': freq,
                'status': exp_status,
                'remarks': remarks,
            })
        except Exception as e:
            errors.append(f'Row {row_num}: {e}')

    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={'message': 'Upload rejected — fix the following rows and re-upload', 'errors': errors},
        )

    # Second pass: every row validated, so it's safe to commit them all.
    ts = _now()
    upload = ExpenseUpload(
        file_name=file_name,
        month=month,
        year=year,
        status='Processing',
        uploaded_by=actor.id,
        uploaded_at=ts,
    )
    session.add(upload)
    session.flush()

    category_cache: Dict[str, ExpenseCategory] = {}
    created = 0

    for parsed in parsed_rows:
        cat_name_raw = parsed['category_name']
        cat = category_cache.get(cat_name_raw)
        if not cat:
            cat = session.exec(
                select(ExpenseCategory).where(col(ExpenseCategory.name) == cat_name_raw)
            ).first()
        if not cat:
            cat = ExpenseCategory(
                name=cat_name_raw,
                created_by=actor.id,
                created_at=ts,
                updated_at=ts,
            )
            session.add(cat)
            session.flush()
        category_cache[cat_name_raw] = cat

        variance = round(parsed['actual'] - parsed['planned'], 2)
        exp = GeneralExpense(
            category_id=cat.id,
            expense_name=parsed['expense_name'],
            month=month,
            year=year,
            frequency=parsed['frequency'],
            planned_amount=parsed['planned'],
            actual_amount=parsed['actual'],
            variance=variance,
            status=parsed['status'],
            remarks=parsed['remarks'],
            upload_id=upload.id,
            created_by=actor.id,
            created_at=ts,
            updated_at=ts,
        )
        session.add(exp)
        created += 1

    upload.row_count = created
    upload.status = 'Done'
    session.add(upload)

    write_audit(
        session, actor, MODULE, ActionType.DOCUMENT_UPLOAD,
        record_id=str(upload.id),
        new_value={'file_name': file_name, 'month': month, 'year': year, 'rows_created': created},
    )
    session.commit()
    session.refresh(upload)

    return UploadResponse(
        id=upload.id,
        file_name=upload.file_name,
        month=upload.month,
        year=upload.year,
        row_count=upload.row_count,
        status=upload.status,
        error_log=upload.error_log,
        uploaded_at=upload.uploaded_at,
    )


def list_uploads(session: Session, year: Optional[int] = None, month: Optional[int] = None) -> List[UploadResponse]:
    stmt = select(ExpenseUpload)
    if year is not None:
        stmt = stmt.where(ExpenseUpload.year == year)
    if month is not None:
        stmt = stmt.where(ExpenseUpload.month == month)
    stmt = stmt.order_by(col(ExpenseUpload.uploaded_at).desc())
    uploads = session.exec(stmt).all()
    return [
        UploadResponse(
            id=u.id, file_name=u.file_name, month=u.month, year=u.year,
            row_count=u.row_count, status=u.status, error_log=u.error_log,
            uploaded_at=u.uploaded_at,
        )
        for u in uploads
    ]


# ── Analysis ───────────────────────────────────────────────────────────────────

def get_analysis(session: Session, year: int) -> AnalysisResponse:
    stmt = select(GeneralExpense).where(
        GeneralExpense.year == year, GeneralExpense.is_deleted == False,  # noqa: E712
    )
    expenses = list(session.exec(stmt).all())
    cats = _cat_map(session)

    ytd_planned = sum(float(e.planned_amount) for e in expenses)
    ytd_actual = sum(float(e.actual_amount) for e in expenses)
    ytd_variance = round(ytd_actual - ytd_planned, 2)

    monthly: Dict[int, Dict] = {}
    for e in expenses:
        m = e.month
        if m not in monthly:
            monthly[m] = {'planned': 0.0, 'actual': 0.0, 'count': 0}
        monthly[m]['planned'] += float(e.planned_amount)
        monthly[m]['actual'] += float(e.actual_amount)
        monthly[m]['count'] += 1

    monthly_summary = [
        MonthSummary(
            month=m,
            year=year,
            planned_total=round(v['planned'], 2),
            actual_total=round(v['actual'], 2),
            variance_total=round(v['actual'] - v['planned'], 2),
            record_count=v['count'],
        )
        for m, v in sorted(monthly.items())
    ]

    cat_totals: Dict[uuid.UUID, Dict] = {}
    for e in expenses:
        cid = e.category_id
        if cid not in cat_totals:
            cat_totals[cid] = {'planned': 0.0, 'actual': 0.0, 'name': cats.get(cid, 'Unknown')}
        cat_totals[cid]['planned'] += float(e.planned_amount)
        cat_totals[cid]['actual'] += float(e.actual_amount)

    category_summary = [
        CategorySummary(
            category_id=str(cid),
            category_name=v['name'],
            planned_total=round(v['planned'], 2),
            actual_total=round(v['actual'], 2),
            variance_total=round(v['actual'] - v['planned'], 2),
        )
        for cid, v in sorted(cat_totals.items(), key=lambda x: -x[1]['actual'])
    ]

    status_breakdown: Dict[str, int] = {}
    for e in expenses:
        s = e.status.value
        status_breakdown[s] = status_breakdown.get(s, 0) + 1

    return AnalysisResponse(
        year=year,
        ytd_planned=round(ytd_planned, 2),
        ytd_actual=round(ytd_actual, 2),
        ytd_variance=ytd_variance,
        monthly_summary=monthly_summary,
        category_summary=category_summary,
        status_breakdown=status_breakdown,
    )
