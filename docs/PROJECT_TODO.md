# HMA IEMS — Project TODO & Execution Tracker

> Phases → Epics → Tasks, with dependencies and status. Grounded in the
> HMA IEMS Architecture v2.0 and **EMS_ROADMAP.md**. Update the status marker
> as work progresses.
>
> Last updated: 2026-07-07  (Phase 1 started; P4 scope narrowed per ADR-036)

## Status Legend
- ✅ Done
- 🔄 In Progress
- ⬜ Not Started
- ⏸ Blocked / Deferred
- ❓ Pending Scope

## ID Scheme
`P{phase}.{epic}.{task}` — e.g. `P3.2.1`. Dependencies reference these IDs.

## Phase Dependency Summary
```
P0 ─▶ P1 ─▶ P2 ─▶ P3 ─┬─▶ P4 (Projects)
                       └─▶ P5 (Attendance) ─▶ P6 (Payroll)
P2 ─▶ P7 (Expense) · P8 (Finance) · P9 (Inventory❓)   [parallel]
{P3..P9} ─▶ P10 (Reporting)
P2 (audit hook) ─▶ P11 (Audit viewer)
P1 ─▶ P13 (SES infra) ─▶ P12 (Notification triggers, after P6/P10)
all ─▶ P14 (Brand & QA)
```

---

## P0 — Foundation  ✅ COMPLETE

### Epic P0.1 — Template cleanup
- ✅ P0.1.1 Delete demo views (base/buttons/forms/icons/notifications/theme/widgets/charts/register)
- ✅ P0.1.2 Delete Docs components + fix `components/index.js`
- ✅ P0.1.3 Remove `examples.scss` + import
- ✅ P0.1.4 Clean `App.jsx` routing (drop register)

### Epic P0.2 — RBAC scaffolding
- ✅ P0.2.1 `constants/roles.js`, `constants/modules.js`
- ✅ P0.2.2 `constants/permissions.js` (v2.0 matrix)
- ✅ P0.2.3 Hooks: `useAuth`, `useRole`, `usePermission`
- ✅ P0.2.4 `ProtectedRoute.jsx` (built, unwired)

### Epic P0.3 — Shell & state
- ✅ P0.3.1 Expand Redux store (`user`, `token`, `sidebarUnfoldable`; temp mock user)
- ✅ P0.3.2 Rewrite `_nav.jsx` (8 items, role-gated, no Settings)
- ✅ P0.3.3 Rewrite `routes.js` (module keys + placeholders)
- ✅ P0.3.4 Role-filter sidebar; clean header/dropdown/footer; Dashboard placeholder; `_custom.scss`
- ✅ P0.3.5 Verify: lint, build, dev-server boot

---

## P1 — Authentication  ✅ COMPLETE  · deps: P0

### Epic P1.1 — API client
- ✅ P1.1.1 Axios instance + base URL config (`src/services/api.js`)
- ✅ P1.1.2 JWT request interceptor (attach Bearer)
- ✅ P1.1.3 Response interceptor (401 → clear localStorage + logout + navigate `/login`)

### Epic P1.2 — Login flow
- ✅ P1.2.1 Redesign `Login.jsx` — HMA branding, Employee ID field, error alert, loading state
- ✅ P1.2.2 `POST /auth/login` integration → `localStorage.setItem('hma_token')` + dispatch user+token
- ✅ P1.2.3 Remove Phase-0 mock user from store; seed token from localStorage on startup
- ✅ P1.2.4 Logout: `logoutApi()` + `localStorage.removeItem('hma_token')` + dispatch null + navigate
- ✅ P1.2.5 Redirect-after-login via `location.state.from` (deep-link return)
- ✅ P1.2.6 "Forgot password?" → inline CAlert info: "Contact your HR administrator"
- ✅ App startup token rehydration: `GET /auth/me` on mount if token exists; 401 clears session
- ✅ Auth guards in `App.jsx`: unauthenticated `*` → `/login`; authenticated `/login` → `/dashboard`

> P2.1.1 pulled forward — ProtectedRoute wired in AppContent.jsx (module-level RBAC active).

---

## P2 — RBAC Enforcement + Audit Logging  ⬜  · deps: P1

### Epic P2.1 — Route & UI gating
- ✅ P2.1.1 Wire `ProtectedRoute` into router via route `module` keys — *done in Phase 1*
- ⬜ P2.1.2 In-page edit/view gating via `usePermission`
- ⬜ P2.1.3 403 / unauthorized handling
- ⬜ P2.1.4 Business-lock layer (completed project / locked payroll read-only)

### Epic P2.2 — Audit logging (cross-cutting)
- ⬜ P2.2.1 Audit-write service/hook on every mutation — *dep: P1*
- ⬜ P2.2.2 Capture user/role/module/action/old/new/ip/timestamp
- ⬜ P2.2.3 Guarantee append-only (no update/delete path)

---

## P3 — Employee Management  ⬜  · deps: P2

### Epic P3.1 — Directory & profile
- ⬜ P3.1.1 `EmployeeDirectory` (search/filter/paginate) — *dep: P2.1.1*
- ⬜ P3.1.2 `EmployeeProfile` shell (6 tabs)
- ⬜ P3.1.3 `EmployeeForm` create/edit (HR only)
- ⬜ P3.1.4 Status lifecycle (Active/Inactive/Resigned/Retired, soft-delete)

### Epic P3.2 — History & documents
- ⬜ P3.2.1 Salary tab + `employee_salary_history` (append-only) — *dep: P3.1.2*
- ⬜ P3.2.2 Department-history tab (append-only)
- ⬜ P3.2.3 Documents tab + S3 upload (`employee_documents`)
- ⬜ P3.2.4 Project-assignments tab (`employee_project_assignments`, multi-project)

---

## P4 — Projects  ⬜  · deps: P2 (hard), P3 (soft: officer/team)

> **Scope narrowed 2026-07-07 (ADR-036):** CEO wants expense oversight, not a full
> PMS. In scope: PA assigns PO; PO plans/allocates budget (incl. 5% EMS share,
> already implemented via `localOrgPool`) and manages expenses. **Out of scope:**
> daily task-tracking/reporting (`pms/daily-reports`) and PMS dashboard KPI/phase
> widgets — do not prioritize P4.3 below.

### Epic P4.1 — Project core
- ⬜ P4.1.1 `ProjectList` parameterized by category (CSR/LSGB/Other) — *dep: P2.1.1*
- ⬜ P4.1.2 `ProjectForm` create/edit (Project Officer); `project_value` immutable
- ⬜ P4.1.3 `ProjectDetail` shell (5 tabs); read-only banner on Completed
- ⬜ P4.1.4 Status lifecycle (Draft→Active→Completed/Archived/Cancelled)
- ⬜ P4.1.5 Officer reassignment → `project_officer_history` — *dep: P3.1.1*
- ⬜ P4.1.6 Project Associate assignment step (PA assigns PO on intake) — *ADR-036*

### Epic P4.2 — Expenses & documents
- ⬜ P4.2.1 `project_expenses` CRUD (Finance + Project Officer) — *dep: P4.1.3*
- ⬜ P4.2.2 `project_expense_history` on every change
- ⬜ P4.2.3 Finance edit-boundary guard (expenses only, not master fields)
- ⬜ P4.2.4 Project documents tab + S3 (`project_documents`)
- ⬜ P4.2.5 Team-assignments tab — *dep: P3.2.4*
- ⬜ P4.2.6 5% EMS share display/reporting on top of `localOrgPool` HR/Core split — *ADR-036*

### Epic P4.3 — Daily task-tracking — ⏸ out of scope (ADR-036)
- ⏸ P4.3.1 Task assignment/management, my-tasks, task report submit/edit — not needed for CEO's expense-oversight goal; do not build against this epic

---

## P5 — Attendance  ⬜  · deps: P3

### Epic P5.1 — Import
- ⬜ P5.1.1 `attendance_policy` config loader + `constants/policyKeys.js` — *dep: P2*
- ⬜ P5.1.2 `AttendanceImport` 5-step wizard (upload→preview→map→validate→confirm) — *dep: P3.1.1*
- ⬜ P5.1.3 Pace 11-column mapping + validation (exists/date/status/dup) — test vs `WorkDurationReport.xlsx`
- ⬜ P5.1.4 Lock-after-import

### Epic P5.2 — Records & corrections
- ⬜ P5.2.1 `AttendanceRecords` table + calendar toggle — *dep: P5.1.2*
- ⬜ P5.2.2 `AttendanceCorrections` (HR) → `attendance_corrections` (no overwrite)
- ⬜ P5.2.3 `attendance_summary` aggregation (present/absent/late/leave…)
- ⬜ P5.2.4 `leave_balances` (minimal, payroll support only)

---

## P6 — Payroll  ⏸ blocked (formula)  · deps: P3, P5

### Epic P6.1 — Generation
- ⬜ P6.1.1 `PayrollGenerate` monthly flow (HR only) — *dep: P3.2.1, P5.2.3*
- ⏸ P6.1.2 Deduction calc (pluggable; reads `attendance_policy`) — *blocked: HR formula*
- ⬜ P6.1.3 Lock-after-generation (`is_locked`)
- ⬜ P6.1.4 Override → `payroll_history` (append-only)

### Epic P6.2 — Output
- ⬜ P6.2.1 `PayrollList` + `PayslipCard`
- ⬜ P6.2.2 Salary-increment records UI — *dep: P3.2.1*
- ⬜ P6.2.3 Payslip email handoff — *dep: P13.1*

---

## P7 — Expense Management  ⬜  · deps: P2  [parallel]

### Epic P7.1 — Records & upload
- ⬜ P7.1.1 `ExpenseRecords` table (HR edit) — *dep: P2.1.1*
- ⬜ P7.1.2 `ExpenseForm` manual entry; soft-delete
- ⬜ P7.1.3 `ExpenseUpload` Excel import (preserve original)
- ⬜ P7.1.4 `ExpenseAnalysis` charts

---

## P8 — Finance  ⬜  · deps: P2  [parallel]

### Epic P8.1 — Uploads & versioning
- ⬜ P8.1.1 `FinanceOverview` (3 sheet cards, Finance edit) — *dep: P2.1.1*
- ⬜ P8.1.2 `FinanceUpload` parameterized by sheetNumber + S3
- ⬜ P8.1.3 Versioning + `finance_file_history`; download past versions

---

## P9 — Inventory  ❓ pending scope  · deps: P2  [parallel]

### Epic P9.1 — Scoping (gate)
- ❓ P9.1.1 Define entities, fields, rules, permission-matrix rows — *blocker for all of P9*
- ❓ P9.1.2 Approve scope / confirm in-scope for this release

### Epic P9.2 — Build *(only after P9.1)*
- ❓ P9.2.1 Item catalog
- ❓ P9.2.2 Stock levels + in/out movements
- ❓ P9.2.3 Assignment to employees/projects
- ❓ P9.2.4 Low-stock alerts — *dep: P13.1*

---

## P10 — Reporting & Analysis  ⬜  · deps: P3,P4,P5,P6,P7,P8

### Epic P10.1 — Reports
- ⬜ P10.1.1 `ReportsOverview` card grid — *dep: P2.1.1*
- ⬜ P10.1.2 Attendance report — *dep: P5*
- ⬜ P10.1.3 Project + overall-project reports — *dep: P4*
- ⬜ P10.1.4 Actual-expense report — *dep: P7, P4.2*
- ⬜ P10.1.5 Payroll report — *dep: P6*

### Epic P10.2 — Export & forecasting
- ⬜ P10.2.1 Export to PDF/Excel/Word (`POST /reports/export`)
- ⬜ P10.2.2 Monthly report email — *dep: P13.1*
- ⏸ P10.2.3 Forecasting pages — *deferred: ML spec (placeholder only)*

---

## P11 — Audit Logs Viewer  ⬜  · deps: P2.2

### Epic P11.1 — Viewer
- ⬜ P11.1.1 `AuditLogList` with filters (module/user/role/date/action) — *dep: P2.2*
- ⬜ P11.1.2 `AuditLogDetail` + `DiffViewer` (old vs new)
- ⬜ P11.1.3 Enforce read-only for all roles

---

## P12 — Notification Triggers  ⬜  · deps: P13, source modules

### Epic P12.1 — Wire triggers
- ⬜ P12.1.1 Payslip-generated email — *dep: P6.2.3, P13.1*
- ⬜ P12.1.2 Monthly-report email — *dep: P10.2.2*
- ⬜ P12.1.3 Password-reset email — *dep: P1.2.6*
- ⬜ P12.1.4 Low-stock alert (if Inventory adopted) — *dep: P9.2.4*

---

## P13 — Notifications Infrastructure  ⬜  · deps: P1  [start early]

### Epic P13.1 — SES
- ⬜ P13.1.1 AWS SES integration + config
- ⬜ P13.1.2 Email template system
- ⬜ P13.1.3 Send service + delivery logging

---

## P14 — Brand & QA  ⬜  · deps: all

### Epic P14.1 — Branding
- ⬜ P14.1.1 HMA logo (`assets/brand`) + favicon
- ⬜ P14.1.2 `_custom.scss` brand variables

### Epic P14.2 — Quality
- ⬜ P14.2.1 Responsive audit (sidebar/tables/modals)
- ⬜ P14.2.2 Per-role QA pass (all 5 roles)
- ⬜ P14.2.3 Toasts, empty states, error boundaries, 404/500 polish

---

## Parallel Track — Backend / API Integration
- ⬜ BE.1 FastAPI + SQLModel + Pydantic project skeleton — *dep: P0*
- ⬜ BE.2 DB schema migrations for 24 v2.0 entities (forecasting/inventory deferred)
- ⬜ BE.3 Per-module endpoints, swapped in as each frontend phase lands
- ⬜ BE.4 Audit-logging + immutability enforcement in service layer — *dep: P2.2*
