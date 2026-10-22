# Spec 03 — Attendance

**Roadmap:** P5 · **Decisions:** ADR-019, 020, 021, 022 · **Source:** `12_Excel_Import_Specifications.md`

## Purpose
Import attendance from Pace Software Excel exports, lock imported records, allow HR corrections via history, and produce monthly summaries. Late-entry **deduction formula is deferred** (ADR-021).

## Entities / Tables

### `attendance`
| Field | Type | Notes |
|---|---|---|
| id | PK | |
| employee_id | FK → employees | |
| employee_name | string | denormalized from Pace |
| attendance_date | date | |
| status | enum | Pace values (Present/Absent/Leave/Weekly-Off/Holiday…) |
| in_time, out_time | time | out nullable |
| work_duration, late_by, early_by, overtime | duration | |
| shift | string | |
| imported_file_id | FK\|null | source import batch |
| created_at, updated_at | timestamp | |

### `attendance_corrections` (append-only — ADR-019)
`id` · `attendance_id` · `original_value` (json) · `corrected_value` (json) · `reason` · `corrected_by` (HR) · `corrected_at` · `remarks`

### `attendance_summary`
`id` · `employee_id` · `month` · `year` · `present_count` · `absent_count` · `weekly_off_count` · `holiday_count` · `leave_count` · `late_hours` · `late_days` · `early_hours` · `early_days` · `average_working_hours` · `total_work_duration` · `total_overtime`

### `attendance_policy` (configurable — ADR-021)
`id` · `policy_key` · `policy_value` · `data_type` · `description` · `effective_from` · `created_by` · `created_at`
Seed keys: `free_late_entry_units_per_month=7`, `late_entry_unit_duration_minutes=15`, `work_start_time=09:15`, `work_end_time=17:45`, `casual_leave_annual_limit=12`, `sick_leave_annual_limit=8`.

## APIs
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/attendance` | all (view) | list/filter |
| POST | `/attendance/import` | HR | import Pace `.xlsx` |
| PUT | `/attendance/{id}` | HR | manual update if allowed |
| GET | `/attendance/{id}/corrections` | view | correction history |
| POST | `/attendance/{id}/corrections` | HR | create correction |
| GET | `/attendance/report` | view | summary/report |

## Permissions
| Role | Access |
|---|---|
| HR | E |
| CEO, Heads, Finance | V |
| Project Officer | — |

## Validation rules (import)
Pace file = 11 columns: Employee ID, Employee Name, Date, Status, In Time, Out Time, Work Duration, Late By, Early By, Overtime, Shift.
- **Employee ID must exist** in `employees`.
- **Date** must be non-empty and parseable.
- **Status** must be a recognized value.
- **No duplicate** (Employee ID + Date) — within the file and against existing rows.
- 5-step wizard: upload → preview → column-map (pre-mapped to Pace) → validate (show row errors) → confirm import.
- After import, rows are **locked**; edits route to corrections.
- Test fixture: `WorkDurationReport.xlsx`.

## Edge cases
- Duplicate (employee+date) already in DB → flag row; offer skip vs correction; never silently overwrite (ADR-019).
- Unknown Employee ID → row rejected with reason; import continues for valid rows; summary of skipped rows shown.
- Partial/garbled file or wrong column order → mapping step lets HR remap; block confirm until required columns mapped.
- Correction to a locked row → original retained; `attendance_corrections` records original+corrected+reason; summary recomputed.
- 2nd/4th Saturday + company holidays → treated as non-working; reflected in summary counts.
- Deduction computation is **not** performed here — only raw `late_by`/leave data is stored; payroll applies the (future) formula using `attendance_policy`.
- Leave usage feeds `leave_balances` (no carry-forward; annual reset).
