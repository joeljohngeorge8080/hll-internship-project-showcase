# HMA IEMS — Architecture Decision Records (ADRs)

> Canonical log of architectural decisions, extracted from the numbered
> requirement specs (`01`–`12`), `CLAUDE.md`, and the Architecture v2.0
> review. **Future Claude sessions should consult this file before making
> design choices** — it records not just what was decided but why, and which
> requirement-doc statements have been overridden.
>
> Status values: **Accepted** · **Deferred** (decided to postpone) ·
> **Removed** (explicitly out of scope) · **Superseded**.
>
> Last updated: 2026-07-07

---

## Index

| ADR | Title | Status |
|---|---|---|
| 001 | Modular monolith architecture | Accepted |
| 002 | JWT authentication; Employee ID as username | Accepted |
| 003 | No Google OAuth | Accepted |
| 004 | Five-role RBAC with a single-source permission matrix | Accepted |
| 005 | Business locks are separate from RBAC | Accepted |
| 006 | PostgreSQL on Supabase Pro + SQLModel ORM | Accepted |
| 007 | FastAPI layered backend; logic in the service layer | Accepted |
| 008 | SQLModel for persistence, Pydantic for API I/O | Accepted |
| 009 | CoreUI React template; CoreUI components exclusively | Accepted |
| 010 | Chart.js (not Recharts) | Accepted (overrides spec) |
| 011 | Bootstrap 5 via CoreUI SCSS (not Tailwind) | Accepted (overrides spec) |
| 012 | Frontend code conventions | Accepted |
| 013 | Immutable audit logs | Accepted |
| 014 | Append-only history tables | Accepted |
| 015 | Soft deletes for expenses; no hard delete of employees | Accepted |
| 016 | Project value immutable after creation | Accepted |
| 017 | Completed projects are read-only | Accepted |
| 018 | Payroll locked after generation; overrides via history | Accepted |
| 019 | Attendance locked after import; corrections via history | Accepted |
| 020 | Pace Attendance Software is the attendance source of truth | Accepted |
| 021 | Configurable policy table; deduction formula deferred | Accepted / Deferred |
| 022 | Minimal leave model (no self-service/approval) | Accepted |
| 023 | Employee↔Project is many-to-many (multi-project) | Accepted |
| 024 | Track employee department history | Accepted |
| 025 | Project documents persist past completion | Accepted |
| 026 | Finance edit boundary: project expenses only | Accepted |
| 027 | EMS consumes ML forecasts; forecast schema deferred | Deferred |
| 028 | Settings module out of scope | Removed |
| 029 | Dashboard widgets deferred (placeholder) | Deferred |
| 030 | Module-by-module delivery | Accepted |
| 031 | AWS infrastructure & file/email services | Accepted |
| 032 | Only HR resets passwords; users created manually | Accepted |
| 033 | Standard timestamps on every record | Accepted |
| 034 | Inventory is net-new and pending scope | Deferred |
| 035 | Temporary mock user during Phase 0 | Accepted (temporary) |
| 036 | Project scope narrowed to expense oversight (PA→PO flow, 5% EMS share) | Accepted — partially supersedes ADR-004 |

---

## ADR-001 — Modular monolith architecture
**Status:** Accepted
**Context:** Small internal user base, complex interrelated business rules, internal-only system, simple maintenance goals (`10_Architecture.md`).
**Decision:** Build a modular monolith with role-based access, not microservices.
**Consequences:** Simpler deploy/ops; modules stay independently testable but share one codebase and DB.

## ADR-002 — JWT authentication; Employee ID as username
**Status:** Accepted
**Context:** Internal auth, no external IdP (`03_Business_Rules.md`, `CLAUDE.md`).
**Decision:** Username + password with JWT sessions; the Employee ID (e.g. `EMP2398`) is the login username. JWT on every protected route.
**Consequences:** `users.employee_id` is unique and FK-linked to `employees`. Token carries identity + role for matrix checks.

## ADR-003 — No Google OAuth
**Status:** Accepted
**Context:** Explicitly excluded.
**Decision:** No third-party OAuth/social login.
**Consequences:** All credentials managed in-system; HR resets passwords (see ADR-032).

## ADR-004 — Five-role RBAC with a single-source permission matrix
**Status:** Accepted — role count superseded in practice, see ADR-036
**Context:** Roles CEO, Heads, HR, Finance, Project Officer with differentiated access (`02_Roles_and_Permissions.md`).
**Decision:** One canonical matrix (`constants/permissions.js` on the frontend, mirrored in the service layer) keyed `module → role → V|E|null`. Consumed via `usePermission` and `ProtectedRoute`.
**Consequences:** No ad-hoc role checks scattered in code; changing access is a single-file edit. **Drift note (2026-07-07):** `src/constants/roles.js` now defines 11 roles (adds Admin, Project Associate, Field Personnel, Backend Team, Project Coordinator, Employee). The single-source-matrix *pattern* still holds — `constants/permissions.js` is still the one file to edit — but this doc's role list is stale. Treat the code as authoritative for the current role set; a full matrix reconciliation across `02_Roles_and_Permissions.md` is out of scope for ADR-036 and remains future work.

## ADR-005 — Business locks are separate from RBAC
**Status:** Accepted
**Context:** Completed projects and locked payroll must be read-only regardless of role.
**Decision:** Enforce business locks as a layer distinct from the permission matrix.
**Consequences:** A user with Edit rights is still blocked when the record is locked; both checks must pass to mutate.

## ADR-006 — PostgreSQL on Supabase Pro + SQLModel ORM
**Status:** Accepted
**Context:** `10_Architecture.md`, `07_Database_Requirements.md`.
**Decision:** PostgreSQL (Supabase Pro), normalized tables, SQLModel ORM.
**Consequences:** History preserved relationally; object files live in S3, not the DB (ADR-031).

## ADR-007 — FastAPI layered backend; logic in the service layer
**Status:** Accepted
**Context:** Layers: API → Service → Data Access → Validation → Audit → Report → Import/Export.
**Decision:** REST only; business logic in the service layer, never in route handlers.
**Consequences:** Routes stay thin; services are unit-testable; audit/validation centralized.

## ADR-008 — SQLModel for persistence, Pydantic for API I/O
**Status:** Accepted
**Decision:** SQLModel models define DB schema; Pydantic schemas define request/response shapes.
**Consequences:** Clear separation between storage and transport; explicit serialization boundaries.

## ADR-009 — CoreUI React template; CoreUI components exclusively
**Status:** Accepted
**Context:** `.cursorrules` forbids non-CoreUI UI libraries.
**Decision:** Use `@coreui/react` components only — no Material-UI, no Tailwind, no other component libraries.
**Consequences:** Consistent design system; new components built from CoreUI primitives.

## ADR-010 — Chart.js (not Recharts)
**Status:** Accepted — **overrides `01_Project_Overview.md` / `10_Architecture.md`**
**Context:** The requirement docs list Recharts, but the installed template ships Chart.js via `@coreui/react-chartjs`.
**Decision:** Use `@coreui/react-chartjs` (Chart.js 4.x). Ignore the Recharts mention in the specs.
**Consequences:** All charts use the CoreUI Chart.js wrapper.

## ADR-011 — Bootstrap 5 via CoreUI SCSS (not Tailwind)
**Status:** Accepted — **overrides `01`/`10` tech-stack lists**
**Context:** Specs list Tailwind; template uses Bootstrap 5 via CoreUI SCSS, and `.cursorrules` forbids Tailwind.
**Decision:** Styling via CoreUI SCSS / Bootstrap 5 utility classes; brand overrides in `scss/_custom.scss`.
**Consequences:** No Tailwind anywhere.

## ADR-012 — Frontend code conventions
**Status:** Accepted
**Decision:** Functional components + hooks only (no class components); PropTypes on every component; Prettier with no semicolons, single quotes, 2-space indent; `React.lazy` + `<Suspense>` for route components; HashRouter (`#/path`).
**Consequences:** Uniform style; ESLint/Prettier enforce it.

## ADR-013 — Immutable audit logs
**Status:** Accepted
**Context:** Governance/compliance requirement.
**Decision:** `audit_logs` is append-only; no code path may UPDATE or DELETE a row. Fields: `user_id, role, module_name, action_type, record_id, old_value, new_value, remarks, ip_address, created_at`. Every create/update/delete/correction/login/override/password-reset writes one row.
**Consequences:** Audit-write hook is cross-cutting from RBAC onward (see module specs).

## ADR-014 — Append-only history tables
**Status:** Accepted
**Decision:** Never overwrite historical records. History tables: `employee_salary_history`, `employee_department_history`, `project_officer_history`, `project_expense_history`, `attendance_corrections`, `payroll_history`, `finance_file_history`, `employee_project_assignments` (closed, never overwritten).
**Consequences:** Current-value tables update in place *and* write a history row in the same transaction.

## ADR-015 — Soft deletes for expenses; no hard delete of employees
**Status:** Accepted
**Decision:** `expenses` and `project_expenses` use `is_deleted` (soft delete). Employee records are never hard-deleted; status moves to Inactive/Resigned/Retired.
**Consequences:** Historical reporting stays intact.

## ADR-016 — Project value immutable after creation
**Status:** Accepted
**Decision:** `projects.project_value` cannot be modified once the project is created — for any role.
**Consequences:** Variance reporting compares actuals against a fixed baseline.

## ADR-017 — Completed projects are read-only
**Status:** Accepted
**Decision:** When `projects.status = Completed`, the project and its child expenses become read-only (business lock, ADR-005).
**Consequences:** Service layer rejects mutations on completed projects regardless of role.

## ADR-018 — Payroll locked after generation; overrides via history
**Status:** Accepted
**Decision:** Generated payroll sets `is_locked = true` and is read-only. HR overrides require a `payroll_history` entry + audit log.
**Consequences:** No silent edits to processed payroll.

## ADR-019 — Attendance locked after import; corrections via history
**Status:** Accepted
**Decision:** Imported attendance rows are locked. HR corrections write to `attendance_corrections` (original + corrected value + reason); the original row is never overwritten.
**Consequences:** Imported file remains the source of truth (ADR-020).

## ADR-020 — Pace Attendance Software is the attendance source of truth
**Status:** Accepted
**Context:** `03_Business_Rules.md`, `12_Excel_Import_Specifications.md`.
**Decision:** Attendance is imported from Pace `.xlsx` exports with 11 fixed columns (Employee ID, Employee Name, Date, Status, In Time, Out Time, Work Duration, Late By, Early By, Overtime, Shift). The imported file is authoritative.
**Consequences:** Import validation: employee exists, date non-null, valid status, no duplicate (employee + date). Test fixture: `WorkDurationReport.xlsx`.

## ADR-021 — Configurable policy table; deduction formula deferred
**Status:** Accepted / Deferred
**Context:** Late-entry/leave rules exist but the deduction formula needs HR confirmation.
**Decision:** Store policy values (free late units = 7, unit = 15 min, work hours 09:15–17:45, casual = 12, sick = 8) in an `attendance_policy` table — not hardcoded. The payroll deduction formula is **deferred** until HR confirms; build the calculation pluggable.
**Consequences:** Policy changes without code changes; payroll generation ships with the formula as a swappable component.

## ADR-022 — Minimal leave model (no self-service/approval)
**Status:** Accepted
**Decision:** `leave_balances` tracks used casual/sick days per employee per year only, to support payroll. No leave applications, approval workflow, or self-service in this release. No carry-forward.
**Consequences:** A future self-service portal extends this; current scope stays small.

## ADR-023 — Employee↔Project is many-to-many (multi-project)
**Status:** Accepted
**Context:** One employee may work on multiple projects simultaneously.
**Decision:** Join entity `employee_project_assignments` (employee, project, start, end, status, remarks). Append-only; reassignment closes the prior row (end date + status), never overwrites.
**Consequences:** Distinct from `projects.officer_id` (the single accountable officer).

## ADR-024 — Track employee department history
**Status:** Accepted
**Decision:** Department changes update `employees.department` *and* append to `employee_department_history` (previous, new, effective date, remarks, changed_by).
**Consequences:** Department moves are fully auditable.

## ADR-025 — Project documents persist past completion
**Status:** Accepted
**Decision:** `project_documents` (Proposal/Agreement/Report/Budget/Supporting/Other) remain accessible after a project is Completed or Archived.
**Consequences:** Read access continues even when the project is locked.

## ADR-026 — Finance edit boundary: project expenses only
**Status:** Accepted
**Context:** Finance and Project Officer jointly own project expenses, but Finance must not alter project master data.
**Decision:** Finance may create/edit/delete `project_expenses` and upload `project_documents`, but has **no** write access to `projects` master fields (name, value, type, dates, officer). Project Officer may edit master fields (except value) + expenses.
**Consequences:** Service-layer guard distinct from the module-level matrix.

## ADR-027 — EMS consumes ML forecasts; forecast schema deferred
**Status:** Deferred
**Context:** ML team has not finalized inputs/outputs/model/frequency/format.
**Decision:** The EMS does not run models; it would only store and display ML output. No `forecasts` table is finalized yet. Reporting shows forecasting as a placeholder ("future ML integration").
**Consequences:** Revisit when ML requirements land.

## ADR-028 — Settings module out of scope
**Status:** Removed
**Context:** v2.0 review removed Settings from current scope.
**Decision:** No Settings module, page, route, table, or API. `attendance_policy` is the only configurable store needed now.
**Consequences:** Sidebar has no Settings item; future settings scoped separately.

## ADR-029 — Dashboard widgets deferred (placeholder)
**Status:** Deferred
**Context:** Dashboard layout/widgets not finalized; await stakeholder validation.
**Decision:** Ship Dashboard as a placeholder; no fixed KPI cards/charts until requirements confirmed.
**Consequences:** Dashboard route exists and renders an empty shell.

## ADR-030 — Module-by-module delivery
**Status:** Accepted
**Context:** `11_Development_Rules.md`, `CLAUDE.md`.
**Decision:** Build and validate one module at a time; do not generate the whole system at once. Sequence per EMS_ROADMAP.md.
**Consequences:** Each phase is verified before the next begins.

## ADR-031 — AWS infrastructure & file/email services
**Status:** Accepted
**Decision:** S3 for files (employee/project docs, expense & finance uploads, report exports); SES for email; EC2 + Route53 + Certificate Manager + CloudWatch; Docker; CI/CD via GitHub Actions → ECR → EC2.
**Consequences:** File paths stored as S3 references in DB rows.

## ADR-032 — Only HR resets passwords; users created manually
**Status:** Accepted
**Decision:** Only HR can reset passwords; system administrators create users manually. No self-registration.
**Consequences:** Register page removed from the template; `POST /auth/reset-password` is HR-gated.

## ADR-033 — Standard timestamps on every record
**Status:** Accepted
**Decision:** Every table carries `created_at` / `updated_at` (history/audit tables carry `created_at`/event timestamps).
**Consequences:** Uniform temporal auditing.

## ADR-034 — Inventory is net-new and pending scope
**Status:** Deferred
**Context:** Requested as an EMS module but absent from v2.0 spec (no entities/rules).
**Decision:** Do not plan or build Inventory until a scoping pass defines entities, fields, rules, and permission-matrix rows. Tracked as an optional parallel track (EMS_ROADMAP.md P9).
**Consequences:** Reporting/Notifications treat Inventory as conditional.

## ADR-035 — Temporary mock user during Phase 0
**Status:** Accepted (temporary)
**Context:** Phase 0 has no login yet, but the shell must render and sidebar role-filtering must be testable.
**Decision:** Seed a mock CEO user in the Redux store, clearly commented as temporary.
**Consequences:** **Must be removed in Phase 1** when real JWT login lands (see PROJECT_TODO P1.2.3).

## ADR-036 — Project scope narrowed to expense oversight (PA→PO flow, 5% EMS share)
**Status:** Accepted
**Context:** CEO directive relayed 2026-07-07 (`newplan.txt`): the CEO does not need a full project-management system. What he needs is visibility into whether project expenses are being handled and planned correctly. The real process: **2 Project Associates (PA)** and **multiple Project Officers (PO)**. When a project arrives, a PA assigns it to a PO. The PO then owns everything from there — adds project detail, plans the budget, and allocates it. After planning, the PO routes a **5% share of the project's money to EMS (HR)**; the rest is the PO's own project-side spend.
**Decision:**
- **PMS scope trimmed, not removed.** `src/modules/pms/project-associate`, `pms/projects`, `pms/lsgb`, `pms/donors`, and `pms/audit-logs` stay in scope — they implement the PA→PO assignment and PO budget/expense flow. **Daily task-tracking is out of scope**: `pms/daily-reports` (`TaskManagementPage`, `MyTasksPage`, `TaskAssignModal`, `TaskCard`, `TaskReportSubmitPage`, `TaskReportEditPage`) and the PMS dashboard's project-KPI/phase widgets (`ProjectKPIsWidget`, `ProjectsByPhaseWidget`, `ProjectValueWidget`, `RecentProjectsWidget`) are not part of the CEO's ask and should not be prioritized.
- **The 5% EMS share is already implemented**, not a new build. `src/services/localOrgPool.js` (`getActiveProjectMonthlyBudgets`) splits each project's value into an **HR-pool** monthly budget (→ EMS) and a **Core-pool** monthly budget (→ project's own spend), via configurable `hrPct`/`corePct` (default 5% / 95% of the relevant installment). This is the concrete instance of the `admin_overhead` concept sketched abstractly in `project_budget_drd.md` (§2.3: `admin_overhead = project_subtotal × admin_rate%`).
- **Role reality check:** the PA/PO split already exists as formal RBAC roles (`ROLE.PROJECT_ASSOCIATE`, `ROLE.PROJECT_OFFICER` in `src/constants/roles.js`), wired into `constants/permissions.js`. No new role work is needed for this directive.
**Consequences:** Roadmap/TODO/MVP docs should stop tracking PMS task-tracking work as in-scope. Reporting for the CEO should center on expense-planning-vs-actual visibility (ties to `project_budget_drd.md`'s variance model, §4), not project-management features. Does not retroactively re-baseline all already-built EMS/PMS submodules against the docs — that audit is separate, future work.

## ADR-037 — Supabase Postgres schema replaces localStorage and the unused FastAPI backend
**Status:** Accepted (schema drafted, not yet applied to a live Supabase project)
**Context:** All app data currently lives in browser localStorage via 25 `src/services/local*.js` files (per-device, non-durable, single-user — see project memory `project_context`). A real FastAPI+PostgreSQL backend exists but only handles auth fallback, unused for business data. This is GAPS.md's G1. The user requested a full Supabase migration, designed module-by-module via a Q&A session rather than assumed.
**Decision:**
- **Supabase replaces both layers** — no dual-write, no FastAPI backend retained. Postgres (via Supabase) becomes the single source of truth for all business data; Supabase Auth replaces the current 3-tier login (local password bypass / Google OAuth whitelist / backend JWT) and the plaintext `PASSWORD_LOGINS` (GAPS.md G7).
- **Full schema for all ~25 modules designed in one pass** (not phased), living in `hma-template/emsv1/supabase/migrations/` as 14 numbered SQL files, applied and syntax-verified against a real Postgres instance during design (62 tables, 12 RLS policies created cleanly).
- **UUID primary keys** (`gen_random_uuid()`) throughout, chosen to match Supabase Auth's `auth.users.id` type so RLS policies stay simple joins rather than needing a bigint↔uuid mapping layer.
- **Auth model: Supabase Auth + Row Level Security.** The 8-role model in `src/constants/roles.js` (verified against code — not the 5- or 11-role counts in stale docs/memory) is enforced via RLS policies, not just app-layer checks. Row-ownership scoping that today lives in ad hoc JS (PA sees only own projects, PO sees only assigned projects, Field Personnel see only projects listing their email) is promoted into RLS policies joining through `project_officer_assignments` / `project_field_personnel` / `profiles`, not derivable from the flat `permissions.js` V/E matrix alone. Only core tables (profiles, employees, projects, budget_plans, project_expenses, audit_log) have RLS policies drafted so far — peripheral modules (GST, LSGB, internships, recruitments, announcements, etc.) follow the same two patterns and are deferred to a follow-up migration rather than hand-copied 24 times.
- **Fixes a live data-integrity bug for free**: `localPayroll.js`, `localOrgPool.js`, and `localProjects.js` currently read three different localStorage key versions of "projects" (`v8`/`v11`/`v12`) — a single `projects` table removes this drift.
- **Money math stays application logic.** The apportionment/cascade/settlement engine (`monthlyApportionment.js`, `localOrgPool.js`) is genuinely complex derived business logic, not a simple aggregate — kept as application/Edge Function logic over normalized tables (`project_pool_adjustments` as an append-only ledger, etc.), not raw SQL views.
- **Money type**: all currency columns are `numeric(14,2)`, removing the JS `Math.round(x*100)/100` paisa-rounding workaround scattered across the codebase.
- **Real audit log added** (`audit_log` table, actor/action/table/row/before/after) — this closes GAPS.md G2, which previously had zero write path (`localAudit.js` was 5 hardcoded rows).
- **Product-level unification calls made during design**: `localDonors.js` is dropped as a separate entity and merged into `projects.funding_agency` (was tracking the same thing twice). The four distinct "admin expense" concepts (vendor contracts, monthly categorized actuals, pool ledger, project-attributed pool spend) are kept as 4 separate tables — they track genuinely different things, not duplication. `pms/daily-reports` is not schema'd, matching its ADR-036 out-of-scope status.
**Consequences:** Migration is module-by-module from here — schema exists but no Supabase project has been created yet, and no frontend code has been rewired off `local*.js`. GST entry columns (`gst_entries.raw_row`) are left as jsonb pending a real Excel column list. RLS policies for peripheral modules are a known follow-up, not yet written.
