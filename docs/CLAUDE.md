# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ⚠️ Read first — the two things that trip everyone up

1. **The frontend has no database. All app data lives in browser localStorage**
   via `src/services/local*.js`. The FastAPI `backend/` exists but the
   frontend uses it only as a fallback — in practice the browser profile *is*
   the database. Data is per-device, non-durable, single-user, and not
   server-enforced. Never assume two users share state or that a written
   value survives a browser clear.
2. **The numbered specs `01`–`12` are historical and wrong in the ways that
   matter** (they describe a 5-role, backend-driven, single-Projects-module
   system). For an accurate mental model read **`docs/PROJECT_OVERVIEW.md`**
   (how it really works) and **`docs/GAPS.md`** (every known weakness) before
   the numbered specs. `DECISIONS.md` (ADRs) records where reality overruled
   the specs; ADR-036 is the latest.

The frontend lives in **`hma-template/emsv1/`** (not repo root). All paths
below are relative to it unless noted.

---

## Project Overview

**HMA IEMS** (HMA Internal Enterprise Management System) is a role-based web application that replaces fragmented Excel workflows with a centralized platform for managing projects, employees, attendance, payroll, expenses, finance, and reporting.

The full specification lives in the numbered markdown files at the root (`01_Project_Overview.md` through `12_Excel_Import_Specifications.md`). Always read the relevant spec file before implementing a module. Also consult `DECISIONS.md` (ADRs) — it records overrides to these specs, most recently ADR-036 (Projects scope narrowed to expense oversight).

The `git-coreui/` directory contains the CoreUI free React admin template that serves as the frontend base.

**Module architecture (`src/modules/`):** the frontend code is split into `ems/` (HR/finance/ops side — attendance, staff-payroll, expense-management, finance, recruitment, etc.) and `pms/` (project side — `project-associate`, `projects`, `lsgb`, `donors`, `audit-logs`). Per ADR-036, `pms/daily-reports` (task tracking) and the PMS dashboard's KPI/phase widgets are **out of scope** — the CEO wants project-expense oversight, not project-management tooling. Do not build against those.

---

## Development Approach

Build **module by module**. Validate each module before starting the next. Do not generate the whole project at once. The order is: Auth → Dashboard → Projects → Staff & Payroll → Attendance → Expense Management → Finance → Reports & Analysis → Audit Logs.

---

## Frontend (CoreUI React Template)

**Location:** `git-coreui/coreui-free-react-admin-template/`

```bash
npm install          # Install dependencies
npm start            # Start dev server at http://localhost:3000
npm run build        # Production build
npm run lint         # Run ESLint + Prettier check
npm run serve        # Preview production build
```

**Stack:** React 19, Vite 8, CoreUI React 5.x, React Router 7.x, Redux 5.x, Sass/Bootstrap 5, Chart.js 4.x

**Critical rules for this template:**
- Use **CoreUI React components exclusively** (`@coreui/react`). Never use Tailwind CSS, Material-UI, or other component libraries.
- Use functional components with Hooks only — no class components.
- Prettier formatting: no semicolons, single quotes, 2-space indentation.
- Always add PropTypes for new components.
- Use `React.lazy()` + `<Suspense>` for all route components.

**Adding a new page:**
1. Create component in `src/views/[feature]/ComponentName.js`
2. Add route to `src/routes.js`
3. Add navigation item to `src/_nav.js` (sidebar is role-based — show items conditionally based on user role from Redux store)

**Charts:** Use `@coreui/react-chartjs` (Chart.js wrapper), not Recharts. (Note: `01_Project_Overview.md` lists Recharts but the template uses Chart.js — follow the template.)

**Theme:** Support dark mode via `useColorModes` from `@coreui/react`.

---

## Backend

**Stack:** Python 3.12+, FastAPI, SQLModel (ORM), Pydantic (validation), PostgreSQL via Supabase Pro, JWT authentication

**Backend layers:** API → Service → Data Access → Validation → Audit Logging → Report Generation → Import/Export

**Rules:**
- REST APIs only. JWT for all protected routes. Employee ID is the login username.
- Put business logic in the service layer, not in route handlers.
- Use SQLModel models for DB schema and Pydantic schemas for API I/O.
- Every module must remain independently testable.
- Google OAuth is explicitly out of scope.

**API base routes** (see `08_API_Requirements.md` for full list):
`/auth`, `/dashboard`, `/employees`, `/projects`, `/attendance`, `/payroll`, `/expenses`, `/finance`, `/reports`, `/audit-logs`, `/settings`

---

## Database

PostgreSQL on Supabase Pro. Use SQLModel ORM.

**Immutability rules (critical):**
- Never overwrite historical records. Create new history entries instead.
- Audit logs (`audit_logs` table) must never be deleted or updated by any code path.
- Completed projects become read-only.
- Payroll is locked after generation; overrides require a `payroll_history` entry.
- Attendance is locked after upload; corrections go to `attendance_corrections`, not the original row.
- Project value is fixed at creation and must never be modified.

**History tables exist for:** `employee_salary_history`, `project_officer_history`, `project_expense_history`, `attendance_corrections`, `payroll_history`, `finance_file_history`

Every record must have `created_at` / `updated_at` timestamps. Use soft deletes (`is_deleted`) not hard deletes for expenses and project expenses.

---

## Authentication & RBAC

Originally documented as five roles: **CEO**, **Heads**, **HR**, **Finance**, **Project Officer**. The table below is the documented baseline matrix; `src/constants/roles.js` is the current source of truth and now defines 11 roles (adds **Admin**, **Project Associate**, Field Personnel, Backend Team, Project Coordinator, Employee — see ADR-036/ADR-004). Project Associate assigns incoming projects to a Project Officer; the Project Officer then plans/allocates the budget and owns expenses.

| Module              | CEO | Heads | HR | Finance | Project Officer |
|---------------------|-----|-------|----|---------|-----------------|
| Dashboard           | V   | V     | V  | V       | V               |
| Projects            | V   | V     | V  | V       | E               |
| Project Expenses    | V   | V     | V  | E       | E               |
| Staff & Payroll     | V   | V     | E  | V       | —               |
| Attendance          | V   | V     | E  | V       | —               |
| Expense Management  | V   | V     | E  | V       | —               |
| Finance             | V   | V     | V  | E       | —               |
| Reports & Analysis  | V   | V     | V  | V       | V               |
| Audit Logs          | V   | V     | V  | V       | V               |

(V = View, E = Edit/Create/Update, — = No Access)

Only HR can reset passwords. Users are created manually by system administrators.

---

## Key Business Rules

**Attendance:**
- Work week: Mon–Sat (2nd and 4th Saturdays are holidays). Hours: 09:15–17:45.
- 7 free late-entry units/month (1 unit = 15 min). Beyond that: hourly salary deduction (`monthly_salary / days_in_month / 8`).
- Arriving >1 hour late → marked Half Day (4-hour deduction).
- Annual leave: 12 casual days (1/month), 8 sick days. Neither carries forward.

**Payroll:**
- Generated monthly by HR. Locked after generation.
- Every salary increment creates a `employee_salary_history` entry; never mutate `current_salary` without it.

**Projects:**
- Categories: CSR, LSGB, Other (Other requires a custom name field).
- Statuses: Draft → Active → Completed / Archived / Cancelled.
- Project value is immutable after creation. Project Officer can be reassigned (log to `project_officer_history`).
- **Scope (ADR-036):** Project Associate assigns the Project Officer on intake. The PO then plans and allocates the budget and owns expenses. **5% of project value routes to EMS (HR)** — already implemented as the HR/Core monthly-budget split in `src/services/localOrgPool.js` (`getActiveProjectMonthlyBudgets`), conceptually described in `project_budget_drd.md`'s `admin_overhead` formula. Daily task-tracking is explicitly out of scope.

**Audit Logs:**
Every create, update, delete, correction, login, and override must write to `audit_logs` with: `user_id`, `role`, `module_name`, `action_type`, `record_id`, `old_value`, `new_value`, `remarks`, `ip_address`, `created_at`.

---

## File Storage & External Services

- **AWS S3:** Employee documents, expense uploads, finance uploads, report exports
- **AWS SES:** Monthly report emails, future notifications
- **Infrastructure:** AWS EC2, Route53, Certificate Manager, CloudWatch
- **CI/CD:** GitHub Actions → AWS ECR → EC2 (Docker containers)

---

## Forecasting / ML

The EMS **consumes** forecast output — it does not run ML models itself. The ML team provides predicted values; the backend stores them in the `forecasts` table and the frontend displays them in Reports & Analysis (line charts, variance charts, summary tables). See `09_ML_Requirements.md`.

---

## Commit Convention

```
feat:     New feature
fix:      Bug fix
docs:     Documentation
style:    Formatting only
refactor: Code restructure without behavior change
test:     Tests
chore:    Maintenance
```

No AI attribution / co-author lines in commit messages (team preference).

---

## How this codebase actually works (learned notes)

### The data layer (`src/services/`)
- ~25 `local*.js` files, each a localStorage-backed "table" with a
  backend-shaped API: `list({ page, pageSize })`, `get(id)`, `create`,
  `update`. Seed data is merged on load so records survive a storage clear
  *for seeds only* — user-created data does not.
- **The money engine is `localOrgPool.js`** (pool/installment/monthly budget
  math, 1,246 lines) and **`monthlyApportionment.js`** (pure, I/O-free plan
  math — the clean version, with a spec in `docs/superpowers/specs/`). Prefer
  extending the pure module and keep it testable.
- Percent split of project value: `ADMIN_PCT` (5) + `hr_pct` (5) + `core_pct`
  (5) + project spend (~85), each configurable per project. The HR/core
  shares are the "5% to EMS" the CEO cares about (ADR-036).
- A monthly plan is valid only when Σ(month totals) == working pool within
  0.01 (`validatePlanTotal`). Money is float rupees rounded to paise — see
  GAPS G4; don't add new float-accumulation paths.

### Auth (`src/services/auth.js`, `localUsers.js`)
Three login paths, checked in order: (1) dev bypass `dev-bypass-<role>` when
`VITE_DEV_LOGIN==='true'` or Vite DEV; (2) local whitelist — Google email or
seeded Employee-ID+password matched against localStorage users; (3) backend
fallback (`/auth/*`). The Google JWT is **decoded, not verified**, on the
client (GAPS G8). Seeded admin passwords are plaintext in source (GAPS G7).
Treat all frontend auth as UX, not security.

### RBAC
- Roles: `src/constants/roles.js` (**11 roles**, source of truth). Matrix:
  `src/constants/permissions.js` keyed `module → role → V|E|none`. Gate with
  `usePermission(module, action)` and `<ProtectedRoute module= action=>`.
- Admin short-circuits to full access. Add access by editing the matrix — no
  ad-hoc role checks. When adding a role, update roles.js **and** every
  PERMISSIONS module (nothing enforces they agree — GAPS G21).

### Frontend structure
- Dual module trees: `src/modules/ems/` and `src/modules/pms/`, each with its
  own `_nav.jsx` and a routes file in `src/routes/` (`ems.routes.js`,
  `pms.routes.js`). Routes are `React.lazy`-loaded.
- Redux (`store.js`) is legacy `createStore` with a single `'set'` action
  holding only `user`, `token`, sidebar/theme. **No business data in Redux.**
- HashRouter — routes are `#/path`. Navigation outside components uses
  `window.location.hash` (see `api.js` 401 handler).

### Deploy
- Frontend → Netlify (`netlify.toml` at repo root, base `hma-template/emsv1`,
  SPA redirect). Backend → Render via GH Action on push to **`master`**
  touching `backend/**`. Active dev branch is `master2`, so backend does not
  auto-deploy from it. **No frontend CI** — lint/build are manual (GAPS G12).

### When working here
- **Add tests when you touch money math** — Vitest is the natural fit; there
  are currently zero tests (GAPS G11). The pure functions in
  `monthlyApportionment.js` are the easiest, highest-value place to start.
- New entity IDs: prefer `crypto.randomUUID()` over the existing
  `Date.now()+short-random` pattern (collision risk, GAPS G5).
- Guard every localStorage write against `QuotaExceededError` and validate
  parsed shape, not just parse success (GAPS G1, G17).
- Before claiming any module is "done," remember the audit log is a mock and
  immutability is unenforced — don't represent either as real (GAPS G2, G3).
