# Spec 02 — Projects (incl. Expenses, Documents, Assignments)

**Roadmap:** P4 · **Decisions:** ADR-005, 014, 016, 017, 025, 026

## Purpose
Manage CSR/LSGB/Other projects through their lifecycle, with actual expenses, documents, officer history, and team assignments.

## Entities / Tables

### `projects`
| Field | Type | Notes |
|---|---|---|
| id | PK | |
| project_code | string, unique | auto-generated |
| project_name | string | |
| project_type | enum | CSR / LSGB / Other |
| other_type_name | string | required iff type = Other |
| funder, location | string | |
| project_value | decimal | **immutable after creation (ADR-016)** |
| start_date, end_date | date | |
| status | enum | Draft / Active / Completed / Archived / Cancelled |
| officer_id | FK → employees | current accountable officer |
| remarks, created_by | | |
| created_at, updated_at | timestamp | |

### `project_officer_history` (append-only)
`id` · `project_id` · `old_officer_id` · `new_officer_id` · `changed_by` · `changed_at` · `remarks`

### `project_documents` (persist past completion — ADR-025)
`id` · `project_id` · `document_name` · `document_category` (Proposal/Agreement/Project Report/Budget File/Supporting Document/Other) · `file_path` (S3) · `uploaded_by` · `uploaded_at` · `remarks`

### `project_expenses`
`id` · `project_id` · `category` · `amount` · `expense_date` · `remarks` · `created_by` · `updated_by` · `created_at` · `updated_at` · `is_deleted`

### `project_expense_history` (append-only)
`id` · `project_expense_id` · `old_amount` · `new_amount` · `old_remarks` · `new_remarks` · `changed_by` · `changed_at`

## APIs
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/projects` | all (view) | list/filter by category+status |
| POST | `/projects` | Project Officer | create |
| GET | `/projects/{id}` | view | detail |
| PUT | `/projects/{id}` | Project Officer | update master (not value) |
| PATCH | `/projects/{id}/status` | Project Officer | status change |
| GET | `/projects/{id}/history` | view | officer history |
| GET | `/projects/{id}/expenses` | view | expense list |
| POST | `/projects/{id}/expenses` | Finance, Project Officer | create expense |
| PUT | `/projects/{id}/expenses/{eid}` | Finance, Project Officer | update expense |
| DELETE | `/projects/{id}/expenses/{eid}` | Finance, Project Officer | soft-delete expense |

## Permissions
| Module | CEO | Heads | HR | Finance | Project Officer |
|---|---|---|---|---|---|
| Projects (master) | V | V | V | V | E |
| Project Expenses | V | V | V | E | E |
| Project Documents | V | V | V | V | E |

**Finance boundary (ADR-026):** Finance edits expenses/documents only — never `projects` master fields.

## Validation rules
- `project_type = Other` ⇒ `other_type_name` required.
- `project_value` set once at creation; any later change attempt rejected (all roles).
- `project_code` auto-generated, unique.
- `end_date ≥ start_date`.
- Status transitions follow Draft → Active → {Completed, Archived, Cancelled}; backward transitions disallowed unless explicitly permitted.
- Officer reassignment writes `project_officer_history` and updates `officer_id` atomically.
- Expense create/update writes `project_expense_history` (old/new amount + remarks) and an audit row.

## Edge cases
- **Completed/Archived project (ADR-017):** master + expenses read-only for all roles; documents remain viewable; show ReadOnlyBanner.
- Finance attempting to edit project name/value/dates/officer → 403 (boundary guard, distinct from matrix).
- Deleting an expense → soft delete (`is_deleted = true`), still retained for audit; excluded from active totals.
- Officer set to an Inactive/Resigned employee → warn/guard.
- Reassigning officer to the same person → no-op (no history row).
- Budget utilization > project_value → allowed but flagged in UI (variance), since value is fixed.
