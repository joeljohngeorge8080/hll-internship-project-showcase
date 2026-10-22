# HMA IEMS — Module Specifications

Implementation-level specs for every module. Each spec covers **Entities,
Database tables, APIs, Permissions, Validation rules, and Edge cases** —
the contract to satisfy before coding that module.

> These are **implementation** specs. The numbered files at the repo root
> (`01`–`12`) are the **requirements** specs. Architectural decisions live in
> `../DECISIONS.md`; sequencing in `../EMS_ROADMAP.md`; task tracking in
> `../PROJECT_TODO.md`.

## Index

| # | Spec | Roadmap phase | Status |
|---|---|---|---|
| 00 | [Authentication & RBAC](./00_auth_and_rbac.md) | P1–P2 | Spec ready |
| 01 | [Employee Management](./01_employee_management.md) | P3 | Spec ready |
| 02 | [Projects](./02_projects.md) | P4 | Spec ready |
| 03 | [Attendance](./03_attendance.md) | P5 | Spec ready |
| 04 | [Payroll](./04_payroll.md) | P6 | Spec ready (formula deferred) |
| 05 | [Expense Management](./05_expense_management.md) | P7 | Spec ready |
| 06 | [Finance](./06_finance.md) | P8 | Spec ready |
| 07 | [Reporting & Analysis](./07_reporting.md) | P10 | Spec ready (forecasting deferred) |
| 08 | [Audit Logs](./08_audit_logs.md) | P11 | Spec ready |
| 09 | [Dashboard](./09_dashboard.md) | P3 (placeholder) | Deferred |
| 10 | [Notifications](./10_notifications.md) | P12–P13 | Spec ready |
| 11 | [Inventory](./11_inventory.md) | P9 | ❓ Pending scope |

## Conventions used in every spec
- **Roles:** CEO, Heads, HR, Finance, Project Officer (see `../DECISIONS.md` ADR-004).
- **Permission notation:** V = View · E = Edit/Create/Update · — = No access.
- **Immutability/locks:** ADR-013 through ADR-019.
- **All timestamps:** `created_at` / `updated_at` per ADR-033.
- **Audit:** every mutation writes an `audit_logs` row (ADR-013).
