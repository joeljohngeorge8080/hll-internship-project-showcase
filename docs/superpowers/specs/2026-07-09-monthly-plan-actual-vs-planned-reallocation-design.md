# Monthly Plan — Actual vs Planned Entry + Cross-Month/Cross-Pool Reallocation — Design Spec

**Date:** 2026-07-09
**Module:** PMS Project Detail — Monthly Plan / Expense (`hma-template/emsv1/src/modules/pms/project-associate/MonthlyPlanPanel.jsx`, `src/services/localProjects.js`, `src/services/monthlyApportionment.js`)
**Status:** Approved by user, pending implementation plan
**Builds on:** `2026-07-06-monthly-plan-pool-reallocation-to-project-design.md` (the `pool_adjustments`/`computeEffectiveProjectMonthly` model this extends) and `2026-07-08-po-actual-project-expense-entry-design.md` (the itemized `localProjectExpenses` Actual Expense card this **supersedes**).

## Context

The PO currently plans a month's Project budget as a set of phase/task lines (`monthly_plan[i].phases`: `{phase, label, amount}`) in the Monthly Plan tab, and separately logs actual project spend as an itemized, dated log (`ActualExpenseCard`, pool `'project'` entries in `localProjectExpenses`) on the Expense tab.

The user wants these merged and made load-bearing: enter what a phase line actually cost right next to what was planned for it, and have the month's actual-vs-planned outcome automatically or semi-automatically move money — pulling a shortfall from next month if overspent, or letting the PO push a surplus into HR/Core or next month if underspent. This makes "planned vs actual" a first-class input to the budget, not just a side log.

Confirmed via discussion:
- The itemized dated-entry log (`ActualExpenseCard`, `localProjectExpenses` pool `'project'`) is retired. Actual is now a single number per phase line, directly editable, same shape as Planned.
- Only the Actual Expense **entry** moves out of the Expense tab into Monthly Plan. Milestones, Assignees, and the Admin/HR/Core Send/Revoke panel stay on the Expense tab, unchanged.
- Reallocation triggers off **month totals** (sum of a month's phase lines), not individual lines.
- Values recompute **live** on every edit — no separate "finalize month" step. A half-filled month is read at face value (blank Actual = 0).
- **Case 1 (overspend):** automatic, no confirmation step — mirrors the existing `auto_cascade` UX. Pulls only from the **next** month (never further); an uncovered remainder is flagged, not forced.
- **Case 2 (underspend):** manual — the PO clicks one of two buttons, **"Send to HR/Core"** (50/50 split) or **"Send to next month"**.
- Sending a pool's money to EMS (unlocking HR to log actual spend there) stays a separate, explicit step via the existing Send button on the Expense tab — Case 1/2 only touch the *planned* figures. Since the existing Send button already reads the live effective pool figure, it automatically reflects any Case 2 HR/Core boost with no extra plumbing.
- Data model: **generalize `pool_adjustments`** to accept `pool: 'project'` for cross-month transfers (user's explicit choice over a separate array), plus a `counterMonth` field so the UI can show which month a transfer is paired with.
- Scope is the **Project** pool only. Admin/HR/Core's own actual spend stays HR's job via EMS, unchanged.

## Data model

### 1. `monthly_plan[i].phases[j].actual` (new field)

Same shape and validation as `amount`: string, parsed with `parseFloat(...) || 0`, blank by default. No separate service call needed to persist it — folds into the existing `updateMonthPlan(projectId, month, phases)` call, since phases already round-trip through that function.

### 2. `pool_adjustments` — `pool: 'project'` + `counterMonth`

Existing shape: `{ id, pool, month, amount, source, reason, createdBy, createdAt }`, where `amount` is a **withdrawal** from `(pool, month)` — positive means money taken away, negative means money added (the existing sign convention, unchanged). Two additions:

- `pool` may now be `'project'` in addition to `'admin' | 'hr' | 'core'`.
- New optional field `counterMonth` — the other month a `'project'`-pool transfer is paired with, so the UI can render "given to Jan 2026" / "from Feb 2026" without re-deriving it.

Two new `source` values, both `pool: 'project'`:

- **`'actual_pull'`** — Case 1. Fully derived, like `auto_cascade`: recomputed from scratch and replaced on every relevant edit, never hand-edited or revoked individually.
- **`'actual_surplus_next_month'`** — Case 2's "Send to next month" button. Persists until the PO explicitly revokes it (same lifecycle as existing `source: 'manual'` records).

Case 2's "Send to HR/Core" button needs **no schema change** — it calls the existing `localProjects.setManualPoolAdjustment(projectId, { pool: 'hr'|'core', month, newAmount, createdBy })` twice (once per pool), where `newAmount = computeEffectivePoolMonthly(project, pool, month) + share`. This reuses the exact function and `source: 'manual'` record shape already in use for the HR/Core boxes — genuinely additive, zero risk to existing behavior.

A pull/transfer between month A (lender) and month B (borrower) for amount `X` is always written as a **pair**:

```
{ pool: 'project', month: A, amount:  X, source, counterMonth: B, reason: '...' }
{ pool: 'project', month: B, amount: -X, source, counterMonth: A, reason: '...' }
```

### 3. `monthlyApportionment.js` changes

**`sumManualPoolAdjustments(adjustments, month)`** — narrow its filter from `source === 'manual'` to also exclude `pool === 'project'`:

```
sumManualPoolAdjustments(adjustments, month) =
  Σ a.amount for a in adjustments
  where a.source === 'manual' and a.month === month and a.pool !== 'project'
```

Required because this sum feeds `computeEffectiveProjectMonthly` under the existing "money withdrawn from admin/hr/core is added to Project" logic — a `pool: 'project'` entry represents Project's own change, not a cross-pool contribution, and must not be folded in here a second time. This is a **no-op for every project that doesn't use the new feature** (no `pool: 'project'` records exist there), so it carries no regression risk to the existing admin/hr/core cascade behavior.

**`computeEffectiveProjectMonthly(project, month)`** — add one term:

```
computeEffectiveProjectMonthly(project, month) =
  round(
    rawMonthTotal(month)
    + sumManualPoolAdjustments(adjustments, month)        // unchanged, admin/hr/core → project (now excludes 'project')
    - sumPoolAdjustments(adjustments, 'project', month)    // NEW: this month's own net transfer
  )
```

`sumPoolAdjustments` is already fully generic over `pool` (no hardcoded admin/hr/core list) — it needs **no code change** to support `'project'`. A lending month's positive entry subtracts; a borrowing month's paired negative entry adds — the pair nets out per month automatically, by construction (same "conservation" property the 2026-07-06 spec already established for cross-pool transfers, now also true across months for this new axis).

**New pure function — `computeActualVsPlannedTransfers(project)`:**

Analogous to `computeCascadeAdjustments`, this derives the full set of `'actual_pull'` records for the whole project in one pass, processing months **chronologically**:

1. For each month in order, compute `monthActual = Σ phases[].actual`, and `effectivePlanned = rawMonthTotal(month) + (any transfer already applied to this month by an earlier month's processing, e.g. an earlier month pulling from this one)`.
2. If `monthActual > effectivePlanned`: the excess needs funding. Look at the **next** month only. Pull `min(excess, nextMonth's currently-available effective planned)`. Record the pair. Any unfunded remainder is not represented by an adjustment — the UI flags it directly from the raw numbers (see UI section), consistent with how an uncovered `auto_cascade` excess is already handled today.
3. If `monthActual <= effectivePlanned`: no automatic action (Case 2 is manual, handled separately by the button handlers, not by this derivation pass).

This function is called (and its `'actual_pull'` records replaced fresh, old ones discarded) every time any phase line's `actual` or `amount` changes for the project — the same recompute-and-replace pattern `updateMonthPlan` already applies to `auto_cascade`.

`updateMonthPlan` already builds its next `pool_adjustments` array as `[...preserved, ...freshlyComputed]`, where `preserved` filters out only `source === 'auto_cascade'` and keeps everything else. Extend that filter to also drop `source === 'actual_pull'` (both are fully-derived and get replaced every call), while continuing to preserve `'manual'` and `'actual_surplus_next_month'` records untouched — those are PO-triggered and persist until explicitly revoked. Net effect per call: `[...preserved (manual, actual_surplus_next_month), ...freshCascadeAdjustments, ...freshActualPullTransfers]`. The two fresh sets are computed independently (`computeCascadeAdjustments` off raw phase totals, `computeActualVsPlannedTransfers` off actual-vs-effective-planned) and both are pure functions of the updated project state, so call order between them doesn't matter.

### 4. What's retired

- `ActualExpenseCard` component and its rendering in `ExpensePanel` — removed.
- `ActualSpendPanel`'s Project column (currently reads `localProjectExpenses` pool `'project'` sums per the 2026-07-08 spec) — switches to reading `phases[].actual` sums per month instead (see UI section).
- `localProjectExpenses` pool `'project'` — no longer written going forward. Existing pool `'admin'` usage (HR's own EMS logging) is untouched; `'project'` stays in `VALID_POOLS` (harmless, just unused by any UI after this change) rather than being ripped out, to avoid touching a shared validation list for a pure UI-side retirement.

## UI changes (`MonthlyPlanPanel.jsx`)

### `PlanTable` — phase line row

Add a fourth field to each phase line, after the existing ₹ Planned input:

```
[Phase ▾] [Task / activity] [₹ Planned] [₹ Actual] [🗑]
```

Same `CFormInput type="number"` treatment as Planned; `onChange` folds into the same `handleAmountChange`-style call that already persists the line via `updateMonthPlan` (extended to also carry `actual`).

### `PlanTable` — Project Total cell

Replace the current generic "adjusted" badge (fed by `sumManualPoolAdjustments !== 0`, which no longer includes project-pool entries per the change above) with a check against `sumPoolAdjustments(adjustments, 'project', month)`:

- Value `> 0` (this month lent money away): show `−₹X → given to <counterMonth>`.
- Value `< 0` (this month received money): show `+₹X ← from <counterMonth>`.
- `0`: no badge, unchanged.

The existing cross-pool "adjusted" badge (admin/hr/core → project, from the 2026-07-06 feature) is unaffected and continues to render independently.

### `PlanTable` — Case 2 buttons

When a month's `monthActual < effectivePlanned` (surplus exists) and neither an `'actual_surplus_next_month'` transfer nor an equivalent HR/Core send has already been applied for that month, show two buttons under that month's row: **"Send to HR/Core"** and **"Send to next month"**. Clicking either applies it (see Data model) and both buttons are replaced by a small "surplus sent" indicator with a revoke control, consistent with the existing Send/Revoke pattern elsewhere in this file.

### `ExpensePanel`

- `ActualExpenseCard` and its grid slot removed.
- Nothing else in this panel changes — Milestones, Assignees, and the Admin/HR/Core Send/Revoke cards stay exactly as they are today.

### `ActualSpendPanel`

Project column switches from `localProjectExpenses` sums to `Σ phases[].actual` for that month, sourced the same way `monthTotal`/`grandTotal` already sum `phases[].amount` elsewhere in this file.

## Bug fix: HR/Core input values changing unexpectedly

Root cause (confirmed by reading the code, not reproduced live): `setManualPoolAdjustment` computes `delta = flat − newAmount`, but the box's displayed value is `computeEffectivePoolMonthly` = `flat − (every adjustment for that pool+month, manual **and** auto_cascade combined)`. When an `auto_cascade` withdrawal already sits on that pool+month (from some other month's overage being funded), typing a value doesn't land on what was typed — it lands offset by whatever the cascade amount happens to be, and that amount can itself shift whenever any other month's Project line is edited. This is why it's HR/Core specifically (`auto_cascade` never touches Admin) and why it looks like it changes "randomly" over time, not just while typing.

**Fix:** change the delta formula to net out non-manual withdrawals already on that pool+month:

```
delta = (flat − nonManualWithdrawn(pool, month)) − newAmount
```

where `nonManualWithdrawn` sums every adjustment for that exact `(pool, month)` with `source !== 'manual'`. This makes a typed value land exactly on the effective figure regardless of what cascade/transfer activity is happening elsewhere, on the first try.

**Plus:** a small refresh/recalculate icon button on the Monthly Plan card header, forcing a re-render from the current stored project state — a visible manual safety net, per the user's request, on top of the actual fix (not a replacement for it).

## Edge cases

- **Project's last month runs over, no next month exists:** the entire excess is unfunded from the start (no month to pull from) — same "flagged, not forced" treatment as a partially-covered excess.
- **A month already has an `'actual_surplus_next_month'` transfer applied, then its own actual later changes such that it's no longer in surplus:** the transfer record is **not** auto-reverted (it was a manual, PO-triggered action) — the month can go negative/over as a result, same as any other manual pool top-up going into deficit today (not clamped, displayed as-is, consistent with the existing convention).
- **Chained overages (Jan over, pulls from Feb; Feb is also over on its own raw numbers):** resolved deterministically by the chronological processing order in `computeActualVsPlannedTransfers` — Feb's own overage is evaluated against its *already-reduced* effective planned (after Jan's pull), so it correctly needs to pull more from Mar to cover both its own overage and the amount it gave to Jan.

## Out of scope

- Any change to Admin/HR/Core's own actual-spend tracking (still logged by HR in EMS, unchanged).
- Any change to `auto_cascade` (Project overage → HR/Core within the same month) — untouched, orthogonal axis.
- A dedicated reallocation history/audit view beyond the inline "given to / from" badge — the underlying `pool_adjustments` records already carry `createdBy`/`createdAt`/`reason` if ever needed later (same reasoning as the 2026-07-06 spec).
- Reconciliation with `project.expense_accounted`/`committed_expense` top-level fields — pre-existing, unrelated inconsistency, not addressed here.
