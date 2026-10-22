# HR / Core / Admin Pool Apportionment — Design Spec

**Date:** 2026-07-01
**Module:** EMS Expense Management / PMS Projects (frontend prototype, `hma-template/emsv1`)
**Status:** Approved by user, pending implementation plan

## Background

The org-wide HR/Core/Admin pool logic (`localOrgPool.js`) currently has three problems relative to the intended business rule:

1. Admin's 5% is computed off the *installment amount* while HR/Core are computed off *total project value* — an inconsistency between `localOrgPool.js` and the project detail page's "Project Overheads" tiles, which already use `project.admin_pct × project_value`.
2. The "Activate Project" button has no relationship to task assignment — it's a bare toggle, so HR/Core apportionment can start with no work actually assigned.
3. `getActiveProjectMonthlyBudgets()` requires a non-null installment just to compute a value that never actually uses installment data, so an activated project with a real `project_value` but zero installments silently disappears from the consolidated sheet.

Additionally, `ProjectOverheadsList.jsx:29` calls `localProjects.getAll()`, which does not exist on the service — this crashes that page on load. This is fixed as part of this change since it lives in the same code path.

## Business rule (as specified by user)

1. When a project is created, 5% Admin, 5% HR, and 5% Core are reserved from total project value. Admin's 5% is credited to the admin pool immediately as a one-time lump sum — it is never split across months.
2. HR and Core do **not** start apportioning until the Project Officer has assigned at least one task to the project. Task assignment is a *precondition* that unlocks the "Activate Project" button; it does not itself set the start month.
3. When the button is actually clicked, HR and Core each begin an equal monthly split of their 5% of total project value, spread across the months from the **activation month** (the month the button was clicked) through the project's end date. Months before activation get nothing.
4. Project funding arrives via installments, managed by Finance. If an installment isn't enough to complete a milestone, the Project Coordinator can pull a shortfall amount from the HR and Core pools (50/50 split), tied to a specific installment/milestone. The pulled amount permanently reduces HR/Core's *future* monthly figures (recomputed as an even split over the remaining months, current month included) — past months are never touched. No repayment tracking.

## Section 1 — Data model changes

**Project record (`localProjects.js`):**
- `admin_pct`, `hr_pct`, `core_pct` — unchanged (existing per-project fields, default 5).
- New: `admin_pool_credited: boolean`, `admin_pool_amount: number`, `admin_credited_at: string|null`. Set once — either at creation if `project_value > 0`, or on the first `update()` call that gives the project a `project_value > 0` if it was 0 at creation. Never re-credited afterward even if `admin_pct` or `project_value` changes later.
- New: `hr_core_rate_ledger: Array<{ id, pool: 'hr'|'core', effectiveFromMonth: 'YYYY-MM', monthlyRate: number, reason: 'activation'|'milestone_shortfall', installmentId: string|null, note: string|null, createdBy: string, createdAt: string }>`. Append-only. First two entries (one per pool) are written when "Activate Project" is clicked.

**Org pool store (`ORG_POOL_KEY`, `localOrgPool.js`):**
- New: `admin_pool_credits: Array<{ id, projectId, amount, createdAt }>` — append-only log mirroring the existing `hr_expenses`/`core_expenses` arrays, populated when a project's admin lump sum is credited.

**Installment record (on `project.installments[i]`):**
- New: `shortfall_topups: Array<{ amount, hrAmount, coreAmount, reason, createdBy, createdAt }>` — append-only, populated by the withdrawal action.

**Rate lookup rule:** for pool `p` and month `M`, the applicable monthly rate is the `monthlyRate` of the entry in `hr_core_rate_ledger` where `pool === p` and `effectiveFromMonth` is the latest value `<= M`. If no such entry exists, the project has no rate for that pool (not in the pool yet).

## Section 2 — Trigger mechanism & Admin crediting

**Activate button (`ProjectDetailPage.jsx` in `pms/project-associate/`):**
- Disabled (with tooltip "Assign at least one task before activating operations") until `localTasks.getByProject(project.id).length > 0`.
- On click, `activateProject()` (in `localProjects.js`) does its existing work (`is_operations_active = true`, `operations_activated_at = now()`, status transition) **plus**: appends one `hr_core_rate_ledger` entry per pool, `effectiveFromMonth` = calendar month of `operations_activated_at`, `monthlyRate = (project_value × pct%) ÷ monthsBetween(activationMonth, project.end_date)`, `reason: 'activation'`.
- The task-assignment date itself (`assigned_at`) is not used anywhere in the math — it only gates the button.

**Admin lump sum (`localProjects.js`):**
- In `create()`: if `data.project_value > 0`, compute `admin_pool_amount = project_value × admin_pct%`, set `admin_pool_credited = true`, `admin_credited_at = now()`, and append a record to `localOrgPool`'s `admin_pool_credits`.
- In `update()`: if `admin_pool_credited` is still `false` and the update sets `project_value > 0` for the first time, do the same crediting. Otherwise, changes to `project_value` or `admin_pct` after crediting have no retroactive effect on `admin_pool_amount`.

## Section 3 — Monthly schedule computation

Replace `computeHRCoreMonthly()` in `localOrgPool.js` with a ledger lookup:

```js
const rateForMonth = (ledger, pool, month) => {
  const entries = ledger.filter(e => e.pool === pool && e.effectiveFromMonth <= month)
  if (entries.length === 0) return null
  return entries.sort((a, b) => b.effectiveFromMonth.localeCompare(a.effectiveFromMonth))[0].monthlyRate
}
```

- `getActiveProjectMonthlyBudgets(pool)`: filter to `is_operations_active` projects (unchanged), compute `rateForMonth(project.hr_core_rate_ledger, pool, currentMonth())` for each, drop projects where this is `null`. No installment lookup required — this removes the silent-drop bug where an activated project with no installments disappeared from the pool.
- `getProjectInstallmentBudgets(projectId, pool)`: for the monthly drill-down table, compute `rateForMonth` per calendar month from `activationMonth` to `project.end_date`, instead of a single flat value — this is what makes a withdrawal visible as a step-down in the per-month table from that month onward.
- `sharePct` in the consolidated sheet: unchanged formula, now fed by `rateForMonth` output instead of the static division.

## Section 4 — Milestone shortfall withdrawal

New method `localOrgPool.withdrawForShortfall(projectId, installmentId, amount, reason, currentUser)`:

1. `perPoolAmount = amount / 2`.
2. `currentMonth = today's 'YYYY-MM'`.
3. For each pool in `['hr', 'core']`:
   - `currentRate = rateForMonth(ledger, pool, currentMonth)`. If `null`, reject — project not activated.
   - `remainingMonths = monthsBetween(currentMonth, project.end_date)`.
   - `remainingPool = currentRate * remainingMonths`.
   - If `perPoolAmount > remainingPool`, reject with "Insufficient HR/Core balance remaining — max withdrawable is ₹X" (no negative future budgets).
   - `newRate = (remainingPool - perPoolAmount) / remainingMonths`.
   - Append to `hr_core_rate_ledger`: `{ pool, effectiveFromMonth: currentMonth, monthlyRate: newRate, reason: 'milestone_shortfall', installmentId, note: reason, createdBy: currentUser, createdAt: now() }`.
4. Append to `project.installments[installmentId].shortfall_topups`: `{ amount, hrAmount: perPoolAmount, coreAmount: perPoolAmount, reason, createdBy: currentUser, createdAt: now() }` — this is how the milestone's budget breakdown shows the extra funding source.

**Access control:** this action is only available to `ROLE.PROJECT_COORDINATOR`, following the existing `isBudgetAdmin`-style role check pattern already used in `ProjectDetailPage.jsx` for the %-edit fields.

**Worked example (matches the numbers given in conversation):** project starts January, 10-month duration (through October), first task assigned in March, "Activate Project" clicked that same month → `effectiveFromMonth = '2026-03'`, and the base monthly HR rate (say ₹5,000) applies flat for March–October (8 months): March 5000, April 5000, May 5000, … — matching the table you gave. Now suppose in May the Project Coordinator withdraws ₹3,000 for a milestone shortfall (₹1,500 from HR, ₹1,500 from Core). March and April are untouched (still 5000 each, already "spent" in the schedule). Remaining HR pool from May–October (6 months) was `5000 × 6 = 30,000`; after removing 1,500 it's 28,500, spread over the same 6 months → new rate `28,500 ÷ 6 = 4,750/month` from May through October. A second withdrawal in July would repeat this against whatever the May-set rate left remaining from July onward.

## Section 5 — UI changes & bundled fixes

- **`ExpenseManagementPage.jsx`**: `EXPENSE_ROWS` gets a third `admin` row, sourced from `admin_pool_amount` (single lump-sum figure, not a monthly series like HR/Core).
- **`PAProjectDetailPage.jsx`**: Admin overhead tile reads from `admin_pool_amount` (locked at creation) instead of live-recomputing `project_value × admin_pct`; "Activate Project" button gated on task existence (Section 2); new "Withdraw from HR/Core pool" action added to the installment/milestone rows, Project Coordinator only (Section 4).
- **`ProjectOverheadsList.jsx:29`**: fix `localProjects.getAll()` → `localProjects.list({}).items`.
- **`MonthlyDrillDown`**: no shape change; now correctly reflects step-downs from withdrawals since it consumes the updated `getProjectInstallmentBudgets`.

## Assumption flagged during self-review — please confirm

Today's code has a fallback: if `project_value` is 0/unset at the time HR/Core is computed, it charges off the *installment amount* instead and sets a `budgetNotForeseen` flag so the UI can warn. This spec's ledger model has no equivalent — if a project is activated while `project_value` is still 0, its `monthlyRate` for that pool will simply compute to 0 (not excluded from the pool, just permanently zero for that ledger entry until a new entry is written). **If you still want a "budget not foreseen yet" fallback/warning for projects activated without a known value, say so and I'll add an equivalent ledger entry type before writing the implementation plan.** Otherwise I'll treat this as intentionally dropped, since the new architecture assumes `project_value` is known before activation is even possible.

## Out of scope

- Repayment/loan tracking for withdrawn amounts (explicitly ruled out — permanent reallocation only).
- Automatic validation that a milestone actually lacks sufficient installment funds before allowing a withdrawal (trusted manual entry by Project Coordinator, with a required `reason` for audit purposes).
- Backend/API persistence — this is all `localStorage`-backed per the existing frontend-prototype pattern; no backend exists yet per project memory.
