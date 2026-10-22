# Spec 07 — Reporting & Analysis

**Roadmap:** P10 · **Decisions:** ADR-010 (Chart.js), 027 (forecasting deferred), 031

## Purpose
Central analytics hub consuming all data modules; generate and export reports (PDF/Excel/Word). Forecasting is a **placeholder** until ML requirements land (ADR-027).

## Entities / Tables

### `reports`
`id` · `report_name` · `report_type` (Attendance/Project/OverallProject/ActualExpense/Payroll/Forecast/Predicted) · `generated_by` · `generated_at` · `file_path` (S3) · `file_format` (PDF/Excel/Word) · `remarks`

### `forecasts` — **DEFERRED (ADR-027)**
Not finalized. No schema until ML team confirms inputs/outputs/frequency/format. Frontend shows "future ML integration" placeholder.

## APIs
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/reports/attendance` | view | attendance report |
| GET | `/reports/project` | view | single-project report |
| GET | `/reports/project/overall` | view | all-projects report |
| GET | `/reports/actual-expense` | view | actual expense report |
| GET | `/reports/forecast` | view | placeholder (deferred) |
| GET | `/reports/predicted` | view | placeholder (deferred) |
| GET | `/reports/powerbi-style` | view | visualization summary |
| POST | `/reports/export` | view | export to PDF/Excel/Word |

## Permissions
All roles: **V** (view + generate + export). No edit concept.

## Validation rules
- Report parameters (date range, project, employee, department) validated against existing data.
- Export format ∈ {PDF, Excel, Word}; generated file stored in S3; `reports` row recorded.
- Data respects source-module locks/soft-deletes (excludes `is_deleted` expenses, includes attendance corrections' effective values).
- Monthly report email handed to Notifications (spec 10).

## Edge cases
- Empty result set → render an empty-state report, still exportable.
- Report spanning a period with no imported attendance → clearly indicate missing data, do not fabricate.
- Large export → generate async/stream; avoid request timeout.
- Forecasting endpoints called → return placeholder/empty payload until ADR-027 is resolved.
- Project Officer can view reports (matrix allows) but only data their role can otherwise see — apply row-level scoping where required.
