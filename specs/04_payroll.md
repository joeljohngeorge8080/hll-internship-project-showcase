# Spec 04 — Payroll

**Roadmap:** P6 · **Decisions:** ADR-014, 018, 021 · **Status:** deduction formula DEFERRED (HR)

## Purpose
Generate monthly payroll per employee, apply attendance-based deductions (formula pending), lock after generation, and record overrides immutably. Depends on Employee Management (salary) + Attendance (deduction inputs).

## Entities / Tables

### `payroll`
| Field | Type | Notes |
|---|---|---|
| id | PK | |
| employee_id | FK → employees | |
| payroll_month, payroll_year | int | |
| gross_salary | decimal | from `current_salary` |
| deductions | decimal | from attendance (formula pending) |
| net_salary | decimal | gross − deductions |
| status | enum | Draft / Generated / Locked |
| is_locked | bool | true after generation |
| generated_by | FK → users | HR |
| generated_at | timestamp | |
| remarks | string | |

### `payroll_history` (append-only — ADR-018)
`id` · `payroll_id` · `old_value` (json) · `new_value` (json) · `changed_by` · `changed_at` · `remarks`

## APIs
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/payroll/generate` | HR | generate for a month |
| GET | `/payroll` | all (view) | list |
| GET | `/payroll/{id}` | view | detail / payslip |
| PUT | `/payroll/{id}` | HR | override (requires history) |
| GET | `/payroll/{id}/history` | view | change history |
| GET | `/payroll/report` | view | payroll report |

## Permissions
| Role | Access |
|---|---|
| HR | E (generate/override) |
| CEO, Heads, Finance | V |
| Project Officer | — |

## Validation rules
- Generation is per `month`+`year`; one payroll row per employee per period (no duplicates).
- Only **Active** employees included (configurable later).
- `gross_salary` snapshots `employees.current_salary` at generation time.
- **Deduction formula DEFERRED:** compute via a pluggable function reading `attendance_policy` (free units, unit minutes, work hours) and attendance data. Until HR confirms, deductions may be 0 or manual; do not hardcode the formula (ADR-021). Reference (unconfirmed): hourly = `monthly_salary / days_in_month / 8`; >1h late ⇒ half-day (4h) deduction; 7 free 15-min units/month.
- After generation: `is_locked = true`, status = Locked; record read-only.
- Override: requires HR; writes `payroll_history` (old/new) + audit row; recomputes `net_salary`.
- Salary increment recorded in `employee_salary_history` (see spec 01), not mutated here.

## Edge cases
- Re-running generation for an already-generated period → reject (or require explicit override path); never silently overwrite locked payroll (ADR-018).
- Attendance not yet imported for the period → block generation or warn (deductions would be incomplete).
- Mid-month salary increment → effective-date logic determines which gross applies; document chosen rule when formula is confirmed.
- Override after lock → allowed for HR via history only; CEO/Heads/Finance cannot edit.
- Employee resigned mid-period → prorate per (future) policy; flag for HR review.
- Payslip email send failure → payroll stays valid; retry via Notifications (spec 10).
