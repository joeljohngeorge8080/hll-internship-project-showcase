# Monthly Plan — Pool Reduction/Top-up Flows Into Project Total — Design Spec

**Date:** 2026-07-06
**Module:** PMS Project Detail — Monthly Plan (`hma-template/emsv1/src/modules/pms/project-associate/MonthlyPlanPanel.jsx`)
**Status:** Approved by user, pending implementation plan
**Builds on:** `2026-07-02-hr-core-admin-monthly-apportionment-design.md` (Section 4's "carved from the same pot" model) and the current `monthlyApportionment.js`/`localProjects.js` implementation.

## Background

In the current 📊 Monthly Plan table, a Project Officer can manually edit a month's Admin/HR/Core amount (or %) via `setManualPoolAdjustment`. This stores a `pool_adjustments` record with `source: 'manual'` and `amount: delta` where `delta = flatRate − newAmount`. Today that delta only affects the pool's own displayed/effective figure (`computeEffectivePoolMonthly`) — it has no effect on that month's Project Total. The existing `auto_cascade` mechanism (`computeCascadeAdjustments`) moves money the other way (Project overage pulls from HR/Core) but is unrelated and one-directional.

The user wants: reducing a month's Admin, HR, or Core amount should add that reduction onto the same month's Project value — money moves from the shrunk pool into the Project column, within that month, not just an isolated pool-only edit.

## Behavior

- Reducing a pool for a month (`delta > 0`, i.e. `newAmount < flat`) adds `delta` to that month's effective Project Total.
- Topping a pool up above its flat rate for a month (`delta < 0`) subtracts the same amount from that month's effective Project Total (symmetric — confirmed with user).
- Applies to all three pools: Admin, HR, and Core (confirmed with user — matches the current UI, which already exposes all three as per-month editable, even though the original Section 1 design treated Admin as a locked lump sum).
- The reallocated amount is **not** surfaced as a new phase/task line item — it is folded invisibly into the Project Total figure (confirmed with user). An "adjusted" badge (matching the existing badge already shown on pool columns) indicates when a month's Project Total includes a reallocation.
- Only `source: 'manual'` pool_adjustments feed this. `auto_cascade` adjustments are excluded — those already represent money the Project's raw phase entries have already accounted for (the cascade documents where an existing overage is funded from; including it again in the Project figure would double-count the same rupees).

## Math

New pure function in `monthlyApportionment.js`:

```
sumManualPoolAdjustments(adjustments, month) =
  Σ a.amount for a in adjustments where a.source === 'manual' and a.month === month
  (pool ∈ {admin, hr, core} — every pool_adjustments record already only ever
  targets one of these three)

computeEffectiveProjectMonthly(project, month) =
  round(rawMonthTotal(month) + sumManualPoolAdjustments(project.pool_adjustments, month))
```

where `rawMonthTotal(month)` is the existing `monthly_plan` entry's stored `total` (sum of that month's phase amounts, unchanged).

**Conservation property:** for any month, `effectiveProject + Σ_pool computeEffectivePoolMonthly(pool)` is invariant under manual pool edits, because `computeEffectivePoolMonthly = flat − (manual + cascade deltas)` and the manual delta appears with opposite sign in each formula — they cancel. This is what makes the symmetric top-up case fall out for free, with no separate branch.

**Not clamped:** like the existing pool math, a large enough top-up across pools can drive `computeEffectiveProjectMonthly` negative for that month. This is not blocked — it is displayed as-is (consistent with how the codebase already handles a pool going into deficit).

## What does NOT change

- `validatePlanTotal` / `validatePlanTotalWithCascade` — these validate the PO's raw phase entries against the fixed `workingPool` target (a project-level percentage-derived constant) and the auto-cascade funding math. Both are orthogonal to this reallocation layer and stay keyed off raw `monthly_plan` totals, not the new effective figure.
- `computeCascadeAdjustments` — unchanged, still one-directional (Project overage → pulls from HR/Core), still computed off raw totals only.
- No data model changes. `computeEffectiveProjectMonthly` is a live, unpersisted derivation — the same architectural pattern `computeEffectivePoolMonthly` already uses. Nothing new is written to `localStorage`.
- `setManualPoolAdjustment`, `updateMonthPlan`, `generateMonthlyPlan` in `localProjects.js` — no changes needed; the existing `delta` sign convention already encodes exactly what this feature needs.

## UI changes (`MonthlyPlanPanel.jsx`)

- `PlanTable`'s **Project Total** cell: replace `fmt(m.total)` with `fmt(computeEffectiveProjectMonthly(project, m.month))`, plus an "adjusted" badge shown when `sumManualPoolAdjustments(project.pool_adjustments, m.month) !== 0` for that month.
- `PlanningSummary`: the headline **Project** stat and **Grand Total**, and the per-month summary table's Project column, switch from raw `m.total` to `computeEffectiveProjectMonthly` for consistency with the plan table above it.
- `ActualSpendPanel` and `ExpensePanel`: no changes — Project isn't a "sendable" pool and its actual-spend tracking is already marked "not yet tracked" independent of this feature.

## Out of scope

- Any change to how `auto_cascade` computes or triggers (Section 6/7 of the original spec) — that remains the Project → HR/Core direction only.
- Persisting the effective Project figure — it stays a live derivation, matching the pool convention.
- A dedicated "reallocation history" or audit view of these transfers beyond the existing "adjusted" badge — the underlying `pool_adjustments` records (with `createdBy`/`createdAt`/`reason: 'Direct edit'`) already carry that provenance if ever needed later.
