# HMA IEMS — Unified Implementation Roadmap

> Single source of truth for build sequencing. Reconciles the originally
> requested generic-EMS modules with the full **HMA IEMS Architecture v2.0**
> scope (24 entities, RBAC matrix, immutability rules). Companion execution
> tracker: **PROJECT_TODO.md**.
>
> Last updated: 2026-07-07 · Foundation (Phase 0) complete.
>
> **2026-07-07 note:** Real implementation has grown into a dual `src/modules/ems/` +
> `src/modules/pms/` structure with far more submodules than this roadmap's original
> single-"Projects"-module plan describes. This update layers in the CEO-directed scope
> change from `newplan.txt` (see ADR-036) — it does **not** re-baseline this roadmap
> against the full current codebase; that audit is separate future work.

---

## 1. Scope & Status

| Module | In v2.0 spec? | Status |
|---|---|---|
| Foundation | ✅ | ✅ Complete (Phase 0) |
| Authentication | ✅ | ⬜ Scaffolded, not wired |
| RBAC + Audit logging | ✅ | ⬜ Matrix exists; enforcement pending |
| Dashboard | ✅ | 🔄 Placeholder only (widgets deferred) |
| Employee Management | ✅ (Staff side) | ⬜ Not started |
| Projects (+ Expenses, Documents, Assignments) | ✅ — scope narrowed, see ADR-036 | 🔄 In progress (PA→PO assignment, budget planning, expenses); daily task-tracking out of scope |
| Attendance | ✅ | ⬜ Not started |
| Payroll | ✅ (Payroll side) | ⏸ Blocked — deduction formula pending HR |
| Expense Management (company ops) | ✅ | ⬜ Not started |
| Finance | ✅ | ⬜ Not started |
| **Inventory** | ❌ net-new | ❓ Pending scope approval |
| Reporting & Analysis (+ Forecasting) | ✅ | ⬜ Not started (forecasting = placeholder) |
| Audit Logs (viewer) | ✅ | ⬜ Not started |
| Notifications (AWS SES) | ✅ | ⬜ Not started |

**Open decisions:**
1. **Inventory** has no entities/fields/rules in v2.0 — it needs a scoping pass before it can be planned in detail. Modelled below as an optional, parallel track.
2. **Forecasting** stays a placeholder until the ML team finalizes inputs/outputs (no `forecasts` schema yet).
3. **Payroll deduction formula** deferred until HR confirms; build the generation skeleton with the formula pluggable, reading config from `attendance_policy`.
4. **Projects scope is narrowed** (ADR-036, 2026-07-07): the CEO wants expense oversight, not a full PMS. In-scope: Project Associate assigns Project Officer; PO plans/allocates budget and manages expenses; 5% of project value routes to EMS (already implemented via `localOrgPool`'s HR/Core pool split). Out of scope: daily task-tracking/reporting (`pms/daily-reports`) and PMS dashboard KPI/phase widgets.

---

## 2. Module Catalog

| Module | Purpose | Key entities |
|---|---|---|
| Foundation | Shell, build, routing, state, shared components, permission scaffolding | — |
| Authentication | Employee-ID + password → JWT; session lifecycle | `users` |
| RBAC + Audit | Enforce permission matrix; immutable audit trail on every write | `audit_logs` |
| Dashboard | Org overview (layout TBD after stakeholder validation) | — |
| Employee Management | Employee master + history + documents + assignments | `employees`, `employee_types`, `employee_salary_history`, `employee_department_history`, `employee_documents`, `employee_project_assignments` |
| Projects | CSR/LSGB/Other lifecycle scoped to expense oversight: PA assigns PO, PO plans/allocates budget (incl. 5% EMS share) and manages expenses/documents/team. Daily task-tracking is out of scope (ADR-036). | `projects`, `project_officer_history`, `project_documents`, `project_expenses`, `project_expense_history` |
| Attendance | Pace `.xlsx` import, corrections, summaries | `attendance`, `attendance_corrections`, `attendance_summary`, `attendance_policy`, `leave_balances` |
| Payroll | Monthly generation, lock, override history, payslips | `payroll`, `payroll_history` |
| Expense Management | Company operational expenses (manual + Excel) | `expenses` |
| Finance | 3 finance Excel slots with versioning | `finance_files`, `finance_file_history` |
| Inventory ❓ | Asset/stock tracking (net-new — to be scoped) | *(new tables TBD)* |
| Reporting | Cross-module reports + PDF/Excel/Word export; forecasting placeholder | `reports` (+`forecasts` deferred) |
| Audit Logs | Read-only viewer with filters + diff | `audit_logs` |
| Notifications | AWS SES email (payslips, monthly reports, alerts) | *(delivery log)* |

---

## 3. Dependency Graph

```
                         ┌──────────────────┐
                         │   FOUNDATION ✅   │
                         └─────────┬────────┘
              ┌────────────────────┼───────────────────────────┐
              ▼                    ▼                            ▼
     ┌────────────────┐   ┌─────────────────┐         ┌──────────────────┐
     │ AUTHENTICATION │   │ NOTIFICATIONS    │ (infra) │  INVENTORY ❓      │
     └───────┬────────┘   │ SES·templates    │         │ (Found+Auth+RBAC) │
             ▼            └────────┬─────────┘         └────────┬─────────┘
     ┌────────────────┐            │                           │
     │ RBAC + AUDIT   │            │                           │
     │ (audit-write   │            │                           │
     │  hook = X-cut) │            │                           │
     └───────┬────────┘            │                           │
             │ gates every data module                         │
   ┌─────────┼───────────────────────────────┐                 │
   ▼         ▼                                ▼                 │
┌────────┐ ┌──────────────────┐   ┌────────────────────────┐   │
│DASHBOARD│ │ EMPLOYEE MGMT    │   │ EXPENSE MGMT │ FINANCE │   │
│(placehld)│ │ master data      │   │ (parallel, independent)│   │
└────────┘ └───┬──────────┬───┘   └────────────────────────┘   │
               │          │                                     │
        soft   │          │ hard                                │
    (officer/  │          │                                     │
     team)     ▼          ▼                                     │
        ┌────────────┐ ┌──────────────┐                         │
        │  PROJECTS  │ │  ATTENDANCE  │                         │
        │ +expenses  │ │ Pace import· │                         │
        │ +documents │ │ corrections  │                         │
        └─────┬──────┘ └──────┬───────┘                         │
              │               │ hard                            │
              │               ▼                                 │
              │        ┌──────────────┐                         │
              │        │   PAYROLL    │──┐ payslip emails        │
              │        │ generate·lock│  │ (→Notifications)      │
              │        └──────┬───────┘  │                       │
              ▼               ▼          ▼                       ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                    REPORTING & ANALYSIS                         │
   │  consumes Employee·Projects·Attendance·Payroll·Expenses·Finance │
   │  (+Inventory if adopted) · exports · monthly mail(→Notif)       │
   └───────────────────────────────┬─────────────────────────────────┘
                                    ▼
                         ┌────────────────────┐
                         │  AUDIT LOGS viewer │  reads audit-write
                         │  (filters + diff)  │  data produced since RBAC
                         └────────────────────┘
```

Arrows = "depends on / blocked by." **Audit logging** is a cross-cutting write-hook switched on at RBAC and used by every module thereafter; the **Audit Logs viewer** is a late, read-only consumer. **Notifications** infra stands up early; its triggers wire in as their source modules land.

---

## 4. Dependency Table

| Module | Hard deps | Soft deps | Blocks | Parallelizable with |
|---|---|---|---|---|
| Foundation | — | — | all | — |
| Authentication | Foundation | — | RBAC, all protected routes | Notifications infra, Inventory scoping |
| RBAC + Audit | Authentication | — | all data modules | — |
| Dashboard | RBAC | (later) all summaries | — | everything |
| Employee Mgmt | RBAC | — | Projects(soft), Attendance, Payroll, Reporting | Expense, Finance, Inventory, Notifications |
| Projects | RBAC | Employee Mgmt (officer/team) | Reporting | Attendance, Expense, Finance |
| Attendance | Employee Mgmt | — | Payroll, Reporting | Projects, Expense, Finance |
| Payroll | Employee Mgmt, **Attendance** | Notifications (payslips) | Reporting | Expense, Finance, Inventory |
| Expense Mgmt | RBAC | — | Reporting | Projects, Attendance, Finance |
| Finance | RBAC | — | Reporting | Projects, Attendance, Expense |
| Inventory ❓ | RBAC | — | Reporting (if adopted) | all data modules |
| Reporting | Employee, Projects, Attendance, Payroll, Expense, Finance | Inventory | — | — |
| Audit Logs viewer | RBAC (audit data) | — | — | Reporting |
| Notifications | Foundation | Payroll, Reporting, Inventory triggers | — | most modules |

**Critical path:** Foundation → Auth → RBAC → Employee Mgmt → Attendance → Payroll → Reporting.
Off critical path (parallel): Projects, Expense Mgmt, Finance, Inventory, Notifications, Dashboard, Audit viewer.

---

## 5. Phase Plan (Waves)

| Wave | Phases | Goal |
|---|---|---|
| 1 — Platform | P0 Foundation ✅ · P1 Authentication · P2 RBAC + Audit hook | Secure, gated shell |
| 2 — Core data | P3 Employee Management *(Dashboard placeholder already in P0)* | The entity everything references |
| 3 — Operational | P4 Projects · P5 Attendance *(parallel after Employee)* | Day-to-day records |
| 4 — Dependent processing | P6 Payroll | Needs Employee + Attendance |
| 5 — Financial ops | P7 Expense Mgmt · P8 Finance · P9 Inventory ❓ *(all parallel)* | Independent financial/asset tracking |
| 6 — Consumption | P10 Reporting · P11 Audit Logs viewer · P12 Notifications triggers | Read & communicate |
| 7 — Hardening | P13 Brand & QA | Logo, responsive, role QA, polish |
| Parallel track | Backend API integration (FastAPI) wired per module | Replace mocks with live data |

---

## 6. Cross-Cutting Concerns

- **Audit logging:** every create/update/delete/correction/login/override writes an immutable `audit_logs` row (`user_id, role, module_name, action_type, record_id, old_value, new_value, remarks, ip_address, created_at`). Switched on at P2; honored by all later modules.
- **Immutability:** history tables append-only; `audit_logs` never updated/deleted; `project_value` immutable; completed projects & locked payroll read-only; soft-delete (`is_deleted`) for expenses.
- **Business locks vs RBAC:** completed projects and locked payroll are read-only regardless of role — enforced separately from the permission matrix.
- **Notifications:** SES infra early; triggers (payslip, monthly report, low-stock, password reset) wired as sources land.
- **Brand & QA (P13):** HMA logo, `_custom.scss` variables, responsive audit, per-role QA, toasts, empty states, error pages.
- **Backend integration:** Axios client + JWT interceptor (P1); each module swaps placeholder data for live FastAPI endpoints as it is built.

---

## 7. Reconciliation Note

The originally requested module list (Foundation, Authentication, RBAC, Employee Management, Attendance, Payroll, Inventory, Reporting, Notifications) is fully covered, **plus** the v2.0 spec modules that were missing from it: **Projects (+ Project Expenses, Project Documents), Expense Management, Finance, and Audit Logs**. **Inventory** is retained as a flagged, net-new, parallel track pending a scoping decision.

**2026-07-07 addendum (ADR-036):** the CEO narrowed Projects scope to expense oversight only — no full PMS. See §1 Open Decisions and the Module Catalog entry above.
