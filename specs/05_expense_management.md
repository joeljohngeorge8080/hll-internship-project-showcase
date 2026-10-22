# Spec 05 — Expense Management (Company Operational Expenses)

**Roadmap:** P7 · **Decisions:** ADR-015, 031 · Distinct from **project** expenses (spec 02).

## Purpose
Record and analyze company operational expenses, entered manually or via Excel upload. Managed by HR.

## Entities / Tables

### `expenses`
| Field | Type | Notes |
|---|---|---|
| id | PK | |
| expense_title | string | |
| category | string | |
| amount | decimal | |
| expense_date | date | |
| uploaded_by | FK → users | |
| source_type | enum | Manual / Excel Upload |
| remarks | string | |
| created_at, updated_at | timestamp | |
| is_deleted | bool | soft delete (ADR-015) |

(Original uploaded files preserved in S3 — ADR-031.)

## APIs
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/expenses` | all (view) | list/filter |
| POST | `/expenses` | HR | create (manual) |
| POST | `/expenses/upload` | HR | upload Excel |
| PUT | `/expenses/{id}` | HR | update |
| DELETE | `/expenses/{id}` | HR | soft-delete |
| GET | `/expenses/report` | view | report |

## Permissions
| Role | Access |
|---|---|
| HR | E |
| CEO, Heads, Finance | V |
| Project Officer | — |

## Validation rules
- `amount` > 0; `expense_date` valid (not future beyond policy).
- `category` from an allowed set (configurable list).
- Excel upload: original file preserved in S3; parsed rows validated (required columns, numeric amount, valid date) before commit.
- Delete is soft (`is_deleted = true`); excluded from active totals/reports.
- All create/update/delete write audit rows.

## Edge cases
- Malformed Excel / missing columns → reject with row-level errors; nothing committed until valid.
- Duplicate rows in an upload → flag; let HR decide skip vs import.
- Editing a soft-deleted expense → disallowed (restore first, if restore is supported).
- Large file upload → enforce size limit; stream to S3.
- Non-HR mutation attempt → 403.
