# Project Actual-Spend Tracking (Admin Pool) — Design Spec

**Date:** 2026-07-02
**Modules:** EMS Expense Management (`src/modules/ems/expense-management/`), PMS Project Detail (`src/modules/pms/project-associate/`)
**Status:** Approved by user

## Context

The Monthly Plan tab (System B, this session's work) computes *planned* Admin/HR/Core pool figures live from flat rates (`computeFlatMonthlyRate`), and the Budget & Payroll tab (System A, `localOrgPool.js` + `localAdminExpenses.js`) shows the org-wide vendor-contract ledger merged identically into every project. Neither tracks *actual* money spent against a *specific* project's pool allocation, and the two are not connected.

The user asked to: (1) connect Budget & Payroll with the Monthly Plan, (2) add a new "actual spend" section after the Monthly Plan reflecting real money taken against the project, (3) start admin actuals at "none" per project, (4) have HR's entry of an admin expense in EMS be what populates the PMS figure.

Confirmed via discussion: this round wires up **Admin only**, end to end. HR and Core actual-tracking are explicitly deferred, but the data model must not need reshaping when they're added later. The connection is gated by project activation — a project only becomes eligible for actual-expense logging once its Monthly Plan is complete and `localProjects.activateProject()` has been called (confirmed via code: this sets `is_operations_active = true` and flips `status` to `'ongoing'`).

`localAdminExpenses.js` (the existing EMS "Admin Expenses" tab) is a distinct, deliberately org-wide vendor-contract ledger (rent, AMC contracts, electricity) with no `project_id` field — it is **not** repurposed or modified by this work. It stays exactly as-is.

## Design

### 1. New service: `src/services/localProjectExpenses.js`

`localStorage`-backed, following this codebase's existing service conventions (same shape as `localAdminExpenses.js`/`localProjects.js`: `KEY`, `read()`/`write()`, `uid()`).

Row shape:
```js
{
  id, project_id, pool, // 'admin' | 'hr' | 'core' — only 'admin' is exposed in UI this round
  month,                // 'YYYY-MM'
  amount,               // number, > 0
  label,                // free-text description, required
  createdBy,            // string, display name
  createdAt,
}
```

API:
- `list({ projectId, pool, month } = {})` — filterable.
- `create({ project_id, pool, month, amount, label, createdBy })` — validates `pool` is one of the three, `amount > 0`, `label` non-empty (trimmed), `month` present.
- `remove(id)` — hard delete, matching `removeExpense`/`removePoolAdjustment` convention elsewhere in this codebase.
- `sumForMonth(projectId, pool, month)` — pure aggregation helper, sums matching entries' `amount`.

No seed data — starts empty for every project ("none" until HR adds an entry, per the user's explicit requirement).

### 2. New EMS tab: "Project Expenses"

Third `CNavItem`/`CTabPane` on `ExpenseManagementPage.jsx` (alongside the existing "Admin Expenses" and "Consolidated Sheet" tabs), lazy-loaded the same way (`React.lazy`). New component `ProjectExpensesPage.jsx` in the same directory.

- Gated by `usePermission(MODULE.EXPENSE_MANAGEMENT, 'edit')` — identical gate to the existing Admin Expenses tab (HR/CEO/Finance per this repo's RBAC table; view-only for others).
- Lists only projects where `is_operations_active === true` (via `localProjects.list()`), i.e. projects that have completed planning and been activated. Projects still in planning/draft do not appear — this is the literal gate the user described ("only after the task is initiated and approve/activate... only then the 15% expenses will be forwarded").
- Per project (collapsible row, same accordion pattern already established in `MonthAccordion`): shows the project's flat monthly Admin rate (`computeFlatMonthlyRate(project, 'admin')`, imported from `monthlyApportionment.js` — already exists, unchanged), a month selector (options from `monthsInRange(project.start_date, project.end_date)`), an amount + label form, and a running table of that project's logged admin-expense entries (with remove buttons). HR/Core pools are visibly present as disabled/"Coming soon" options in the pool selector, not hidden — signals the provision without offering a false capability.

### 3. New PMS section: "Actual Spend" (`MonthlyPlanPanel.jsx`)

New `ActualSpendPanel` component, rendered in `MonthlyPlanPanel`'s top-level export directly after `PlanningSummary` (i.e., after the Monthly Plan and its summary — matches "add a new section after the Monthly Plan"), only when `hasPlan`.

- Reads `localProjectExpenses.list({ projectId: project.id })` for the current project.
- Per-month table (`monthsInRange(project.start_date, project.end_date)` rows), columns: Month / Planned Admin (`computeFlatMonthlyRate`) / Actual Admin (`sumForMonth`) / Variance (planned − actual, badge colored by sign) / Project / HR / Core.
- Project/HR/Core columns render a static "— not yet tracked" badge (explicit placeholder, not a fabricated `0`) — honest about what this round covers.
- Before any HR-logged entry exists for a project, every month's Actual Admin is `0` / renders as "None", exactly matching the user's requirement.
- Read-only — no editing happens in PMS; this panel is a mirror of what EMS's Project Expenses tab has recorded, not an input surface.

### 4. Budget & Payroll connection (`ProjectDetailPage.jsx`, tab 5)

The existing "🏛 Admin Expenses" `ExpenseCard` (currently `localAdminExpenses.asProjectExpenses()` merged with `project.admin_expenses`) gets one additive change: also merge in this project's `localProjectExpenses.list({ projectId: project.id, pool: 'admin' })` entries, mapped into the same `ExpenseCard` row shape (`{id, label, amount, date, notes, source: 'project_actual'}`), tagged distinctly from the existing `source: 'hr_admin'` rows so they render with a different badge/notes text (e.g. "Project Actual" vs "HR Admin"). Nothing existing is removed, reordered, or made editable — purely additive, read-only alongside the current read-only card.

## Out of scope

- Any change to `localAdminExpenses.js` or its existing org-wide vendor-ledger behavior.
- HR/Core actual-expense entry UI (data model supports it; UI does not expose it yet).
- Any automatic reconciliation, alerting, or blocking based on variance (Admin actual exceeding planned) — display only.
- Any change to `activateProject()`, the Activate gating logic, or `monthlyApportionment.js`.
