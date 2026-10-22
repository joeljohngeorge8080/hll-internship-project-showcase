# Spec 01 — Employee Management

**Roadmap:** P3 · **Decisions:** ADR-014, 015, 022, 023, 024, 031, 033

## Purpose
Maintain the employee master record — the entity that Attendance, Payroll, Projects, and Reporting all reference. Includes salary history, department history, documents, and project assignments.

## Entities / Tables

### `employee_types`
`id` · `type_name` (Permanent / FTC / TPC) · `description`

### `employees`
| Field | Type | Notes |
|---|---|---|
| id | PK | |
| employee_id | string, unique | e.g. EMP2398 |
| full_name, email, phone, designation | | |
| department | string | current snapshot (history in separate table) |
| employee_type_id | FK → employee_types | |
| status | enum | Active / Inactive / Resigned / Retired |
| join_date, exit_date | date | exit nullable |
| current_salary | decimal | latest; never changed without a history row |
| created_at, updated_at | timestamp | |

### `employee_salary_history` (append-only)
`id` · `employee_id` · `old_salary` · `increment_percentage` · `increment_amount` · `new_salary` · `effective_date` · `remarks` · `changed_by` · `created_at`

### `employee_department_history` (append-only)
`id` · `employee_id` · `previous_department` · `new_department` · `effective_date` · `remarks` · `changed_by` · `created_at`

### `employee_documents`
`id` · `employee_id` · `document_name` · `document_category` (Certificates / Identity / Employment / Other) · `file_path` (S3) · `uploaded_by` · `uploaded_at` · `remarks`

### `employee_project_assignments` (append-only — ADR-023)
`id` · `employee_id` · `project_id` · `allocation_start_date` · `allocation_end_date` (nullable) · `status` (Active/Completed/Reassigned) · `remarks` · `assigned_by` · `created_at` · `updated_at`

### `leave_balances` (minimal — ADR-022)
`id` · `employee_id` · `year` · `casual_leave_used` · `sick_leave_used` · `updated_at`

## APIs
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/employees` | all (view) | list/search/filter |
| POST | `/employees` | HR | create |
| GET | `/employees/{id}` | all (view) | detail |
| PUT | `/employees/{id}` | HR | update (incl. status, department→history) |
| DELETE | `/employees/{id}` | HR | logical delete via status change |
| GET | `/employees/{id}/salary-history` | view | list |
| GET | `/employees/{id}/documents` | view | list |
| POST | `/employees/{id}/documents` | HR | upload to S3 |

## Permissions
| Role | Access |
|---|---|
| HR | E |
| CEO, Heads, Finance | V |
| Project Officer | — (no access) |

## Validation rules
- `employee_id` unique and required; immutable after creation.
- `status` transitions are recorded; record is never hard-deleted (ADR-015).
- Salary change: must write `employee_salary_history` in the same transaction as updating `current_salary`; `new_salary = old_salary + increment_amount`; `effective_date` required.
- Department change: update `employees.department` **and** append `employee_department_history`.
- Project assignment: an employee may have multiple **Active** assignments; reassignment closes the prior row (set `allocation_end_date`, status → Reassigned) — never overwrite.
- Document upload: allowed category; file persisted to S3; metadata row created.
- `email` format valid; `join_date` ≤ today; `exit_date` ≥ `join_date` when set.

## Edge cases
- Editing `current_salary` directly without a history row → reject (must go through increment flow).
- Resigned/Retired employee: read-only profile except status/exit_date corrections by HR; retains attendance/payroll history.
- Employee referenced by active project assignment or unprocessed payroll → cannot be set Inactive without a warning/guard.
- Duplicate `employee_id` on create → reject.
- Document deletion → preserve historically (no hard delete); supersede with a new upload if replacement needed.
- Project Officer attempting any employee endpoint → 403 (matrix denies).
