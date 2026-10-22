# Budget & Payroll Cleanup + Editable HR/Core Cascade — Design Spec

**Date:** 2026-07-03
**Modules:** PMS Project Detail — Budget & Payroll tab and Monthly Plan tab (`ProjectDetailPage.jsx`, `MonthlyPlanPanel.jsx`, `localProjects.js`, `monthlyApportionment.js`)
**Status:** Approved by user

## Context

Two related cleanups to the money-tracking model built over the last several sessions:

1. **Budget & Payroll's Admin/HR/Core "Project Overheads" card** currently merges expense data from several disconnected sources (manually-added `project.admin_expenses`, the org-wide vendor ledger, `localOrgPool` HR/Core charge lookups). The user wants this simplified to a single source of truth: only expenses HR explicitly logs against that specific project via EMS → Project Expenses (`localProjectExpenses`, added last session) should show here.

2. **The Monthly Plan tab's HR/Core columns** are currently read-only, computed live from flat rates (`computeFlatMonthlyRate`), adjustable only via a budget-admin-only "Withdraw" modal. The user wants HR and Core to become directly editable inline by the same people who edit the Project column (PO/Associate/budget-admin), and wants a new automatic rule: when a Project Officer edits a month's Project total above its normal baseline share, the system automatically funds that overage by pulling from HR and Core — first from that same month's own HR/Core capacity, then, if that's not enough, spread evenly across the rest of the project's months.

Confirmed via discussion: this round covers both of these. It does **not** cover forwarding HR/Core money into EMS after a PO "approves" a plan — that stays a deferred future provision, consistent with how EMS HR/Core logging was already deferred last session (EMS's Project Expenses tab still only accepts Admin-pool entries; this round doesn't change that).

## Design

### 1. Budget & Payroll — single source of truth

In `ProjectDetailPage.jsx`'s Budget & Payroll tab, the Admin/HR/Core `ExpenseCard`s are all changed to read-only (`isReadOnly={true}`), each sourced only from:

```js
localProjectExpenses.list({ projectId: project.id, pool: 'admin' | 'hr' | 'core' })
```

mapped to the `ExpenseCard` row shape (`{id, label, amount, date, notes}`) the same way Admin already does today. Removed entirely from this view:
- `project.admin_expenses` and its add/edit/remove UI and handlers (`handleAddExpense`, `handleRemoveExpense`, `handleEditExpense`, and the `localProjects.addExpense`/`removeExpense`/`updateExpense` calls they wrap).
- The org-wide vendor-ledger merge (`localAdminExpenses.asProjectExpenses()`).
- The `localOrgPool.getProjectHRCharges`/`getProjectCoreCharges`/`getProjectHRBudgetSummary`/`getProjectCoreBudgetSummary` lookups that fed the HR/Core cards.

The pool budget ceiling shown per card (`project_value × pct%`) is unchanged — it's still a meaningful reference figure, mathematically identical to `computeFlatMonthlyRate(project, pool) × duration`.

Since EMS's Project Expenses tab still only exposes the Admin pool option (HR/Core remain disabled "coming soon," unchanged this round), the HR and Core cards will show empty for every project until that EMS-side work happens later. This is expected, not a bug — it directly satisfies "clear the current expenses out" since nothing populates those two cards yet.

The `%` editors in the "Project Overheads" card header (admin_pct/hr_pct/core_pct steppers, gated `isBudgetAdmin`) are untouched — they control the flat-rate formulas, a separate concern from the expense *lists*.

### 2. Monthly Plan — editable HR/Core with cascading pull

**Two new pure helpers**, `src/services/monthlyApportionment.js`:

```js
/** A project's normal Project-column share for one month. */
export const computeMonthBaseline = (project) => {
  const months = monthsInRange(project.start_date, project.end_date)
  if (months.length === 0) return 0
  return Math.round((computeWorkingPool(project) / months.length) * 100) / 100
}

/** One month's own combined HR+Core flat capacity. */
export const computeMonthHRCore = (project, month) =>
  Math.round(
    (computeFlatMonthlyRate(project, 'hr') + computeFlatMonthlyRate(project, 'core')) * 100,
  ) / 100
```

(`month` param kept for API symmetry with other per-month functions, even though the flat rate is month-independent today.)

**Cascade recompute**, a new function in `localProjects.js`, called automatically at the end of `updateMonthPlan` whenever a month's phase amounts (and therefore its `total`) change:

1. Discard every existing `pool_adjustments` entry tagged `source: 'auto_cascade'` for this project. Entries tagged `source: 'manual'` (see below) are left untouched — the cascade is fully recomputed from scratch each time, independent of manual edits.
2. For every month in `project.monthly_plan`, with `P` = that month's `total`, `B` = `computeMonthBaseline(project)`, `HC` = `computeMonthHRCore(project, month)`:
   - If `P ≤ B`: no cascade needed for this month.
   - Else: `excess = P − B`.
     - `sameMonthPull = min(excess, HC)`. Create two `auto_cascade` adjustment records for *this* month — `{pool: 'hr', amount: sameMonthPull/2}` and `{pool: 'core', amount: sameMonthPull/2}`.
     - If `excess > HC`: `remaining = excess − HC`. Let `otherMonths` = every other month in the plan. If `otherMonths.length === 0`, the remainder is left uncovered (see below). Otherwise `perMonth = remaining / otherMonths.length`, and for each other month, create two more `auto_cascade` records (`hr: perMonth/2`, `core: perMonth/2`).
3. If, after step 2, some months' own HR/Core (net of everything already pulled from them, including other months' cascades landing on them) would go negative, that's allowed — this codebase already treats a negative effective pool figure as a legitimate "flag, don't block" signal (`computeEffectivePoolMonthly`'s existing doc comment). No clamping, no error, no blocked edit.
4. Persist the merged adjustment list (`auto_cascade` ones just computed + untouched `manual` ones) to `project.pool_adjustments`.

**Manual HR/Core editing** replaces the Withdraw modal entirely. In `MonthlyPlanPanel.jsx`'s `PlanTable`, the HR and Core columns become editable `CFormInput`s (mirroring the existing Project phase-amount inputs), gated by the same `canEdit` prop already used for Project (not the narrower `canWithdraw`/`isBudgetAdmin`). Typing a new value computes `delta = computeEffectivePoolMonthly(project, pool, month) − newValue` and **upserts** (replace-if-exists, not stack) a single `{pool, month, amount: delta, source: 'manual', reason: 'Direct edit', createdBy}` record — negative `delta` is allowed (a manual top-up above the flat rate), matching this codebase's existing no-clamping stance. `WithdrawModal`, the `canWithdraw` prop threading from `ProjectDetailPage.jsx`, and the `isBudgetAdmin`-only Withdraw button/column are removed.

**`pool_adjustments` gains a `source` field** (`'auto_cascade' | 'manual'`) to distinguish the two origins; `sumPoolAdjustments`/`computeEffectivePoolMonthly` sum across both sources unchanged (a pool/month's effective value is still flat rate minus everything pulled from it, regardless of why).

**Balance badge** (`validatePlanTotal`, consumed by `PlanTable`'s header badge and `PlanningSummary`'s verdict): today it compares `sum(monthly_plan[].total)` against the fixed `computeWorkingPool(project)`. This changes to compare against `computeWorkingPool(project) + totalCascadePulled`, where `totalCascadePulled` is simply the sum of every `auto_cascade`-tagged adjustment's `amount` currently on the project — since, by construction, every rupee pulled via the cascade exists specifically to fund a Project overage, so total pulled always equals total funded. A month whose overage is fully funded no longer contributes to an "off by X" reading; only a genuine, uncovered shortfall (excess beyond what all HR/Core capacity in the project could supply — see step 3 above) still does, because that portion was never pulled anywhere and so isn't included in `totalCascadePulled`.

## Out of scope

- Forwarding HR/Core money to EMS after a "PO approval" step, and EMS's Project Expenses tab gaining HR/Core pool options — deferred, unchanged this round (HR/Core options stay disabled in that EMS tab).
- Any change to Admin's flat-rate formula, `admin_pct`/`hr_pct`/`core_pct` editors, or the Activate-gating logic.
- Any change to `localProjectExpenses.js`'s service API (Task 1 from last session) — reused as-is.
- Migrating or backfilling existing `project.admin_expenses` data — it's simply no longer read by this view; the field itself is left alone in storage (harmless, unread dead data).
