# Super Forecasting — CEO Executive Dashboard Design Spec

**Date:** 2026-07-08
**Modules:** EMS Reports & Analysis (`src/modules/ems/reports-analysis/`), routes/nav
**Status:** Approved by user

## Context

`LsgbDependencyPage.jsx` ("Profit / Loss vs LSGB") is a CEO-facing report that compares total company expenses against total "own revenue" (project pool-share cuts + HR revenue) and reports whether the shortfall must come from LSGB (loss) or not (profit). It was built and reviewed for accuracy in an earlier session — see `2026-07-08-expense-pool-lsgb-admin-share-revenue-sources-design.md` for the Expense Pools' revenue-source tagging feature this page needs to now reflect.

Two gaps prompted this redesign:
1. **Data gap:** the page has no idea `localOrgPool`'s HR/Admin/Core expenses (Expense Pools cards) exist — it only reads `localAdminExpenses` (vendor contracts) + project monthly plans. So tagging an expense as "LSGB Revenue" in Expense Pools currently has zero visible effect on this forecast.
2. **Scope gap:** the CEO wants this page to become a single command-center answering a long list of operational questions (expense counts, project counts, HR health, "should I add more projects," etc.) — not just the profit/loss verdict.

The user also asked for a specific new calculation: given the current LSGB shortfall (or surplus), how much new project value would be needed to reduce LSGB borrowing by a target % (default 10%), since new projects earn revenue via the same 5%+5%+5% (admin+hr+core) pool cuts already used elsewhere in this codebase (`monthlyApportionment.js`).

Renamed to **"Super Forecasting"** (nav label + page heading + route path + file name), per explicit user request.

## Design

### 1. Renamed & relocated

- `src/modules/ems/reports-analysis/LsgbDependencyPage.jsx` → `SuperForecastingPage.jsx` (file rename; component renamed `SuperForecastingPage`, default export unchanged in usage).
- `src/routes/ems.routes.js`: import + `name` + `path` updated — path becomes `/ems/reports-analysis/super-forecasting` (old path `/ems/reports-analysis/lsgb-dependency` retired; nothing else in the codebase links to the old path — confirmed no hardcoded references in `ProfitLossWidget.jsx` or elsewhere).
- `src/modules/ems/_nav.jsx`: nav item label `'Profit / Loss vs LSGB'` → `'Super Forecasting'`, `to` updated to match.
- `computeLsgbTotals` (still exported, still consumed by `ProfitLossWidget.jsx` on the Dashboard) keeps its name and signature — only its internals change (per §2 below) — so the Dashboard widget picks up the corrected numbers automatically with no changes needed there.

### 2. Corrected math: Expense Pools now counted

`computeLsgbTotals(rangeStart, rangeEnd)` gains one more expense category. New helper `buildPoolExpenseTotals(rangeStart, rangeEnd)` in the page file (same pattern as the existing `buildOperatingActuals()` — an inline, page-local aggregation function, no changes to `localOrgPool.js` needed):

```js
const buildPoolExpenseTotals = (rangeStart, rangeEnd) => {
  const all = [
    ...localOrgPool.getHRExpenses(),
    ...localOrgPool.getAdminExpenses(),
    ...localOrgPool.getCoreExpenses(),
  ]
  const inRange = all.filter((e) => {
    const m = (e.date || '').slice(0, 7)
    return m >= rangeStart && m <= rangeEnd
  })
  const totalAmount = inRange.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
  const lsgbTaggedAmount = inRange.reduce((s, e) => {
    const pct = parseFloat(e.lsgb_revenue_pct) || 0
    return s + (parseFloat(e.amount) || 0) * (pct / 100)
  }, 0)
  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    lsgbTaggedAmount: Math.round(lsgbTaggedAmount * 100) / 100,
    count: inRange.length,
  }
}
```

`computeLsgbTotals` adds `poolExpenses.totalAmount` into `expenses` (alongside existing `operating` + `project`), and returns the new `poolExpenses` object (with `totalAmount`/`lsgbTaggedAmount`/`count`) in its result so the page can show the real, tagged LSGB draw as its own honest line — separate from the derived shortfall. `ownRevenue` (`shares + hrRevenueTotal`) is **not** changed — it already represents the full "money we earned" pot; adding pool expenses only makes "money we spent" more complete. `lsgbNeed`/`surplus`/`isProfit` formulas are unchanged (still `max(0, expenses - ownRevenue)` / `max(0, ownRevenue - expenses)` / `lsgbNeed === 0`) — exactly matching "the logic is same, when greater amounts of expense is taken from the lsgb revenue it will be marked as loss": more real spending routed through LSGB-tagged Expense Pool entries increases `expenses` with no matching new revenue, so the shortfall (and loss verdict) grows accordingly.

The month-by-month breakdown (`monthRows`) is **not** extended per-pool-expense per-month — `localOrgPool` expenses are one-off dated entries, not the same "monthly recurring plan" shape as `operatingActuals`/project plans, and per-month attribution isn't needed for the CEO-facing verdict. `poolExpenses.totalAmount` is a period-level figure only, shown once in the headline cards, not in the per-month table.

**Known limitation, stated on the page, not hidden:** `localAdminExpenses` (vendor contracts) and `localOrgPool`'s HR/Admin/Core expenses are two disconnected data stores that may double-record the same real expense (nothing in the code ties them together). This design does not attempt deduplication — they're shown as two clearly separate lines ("Operating" vs "Pool Expenses").

### 3. Kid-simple language throughout

Every label on this page changes to plain words — no financial jargon, no unexplained percentages, minimal tables:

| Old | New |
|---|---|
| Total Expenses | Money We Spent |
| Own Revenue | Money We Earned |
| LSGB Need | Money We Had to Borrow |
| Profit / Loss verdict | "We Made Money! 🎉" / "We Spent More Than We Earned 😟" |
| LSGB dependency % / grade badges | dropped — replaced by the plain borrow amount + the new calculator (§4) |

The existing month-by-month table (7 columns: HR+Admin Expense, Project Planned Expense, Total Expense, Project Shares, LSGB Need, Status badge, forecast badge) is cut down to 4 plain columns: Month, Money We Spent, Money We Earned, and a single ✅/⚠️ icon — no jargon column headers, no "forecast" pill (a small `(estimate)` suffix on the month label instead).

### 4. New: "Can We Cut Our LSGB Borrowing?" calculator

New card, directly under the verdict banner. Editable target-% input (default 10, plain number field, no slider/fanciness). Computation, added as a new export `computeLsgbReductionPlan(totals, targetPct)` in the page file (pure function, easy to verify independently):

```js
export const computeLsgbReductionPlan = (totals, targetPct) => {
  const projects = localProjects
    .list({ pageSize: 1000 })
    .items.filter((p) => p.status === 'active' || p.status === 'ongoing')

  const totalValue = projects.reduce((s, p) => s + (p.project_value || p.project_valuation || 0), 0)
  const weightedPctSum = projects.reduce((s, p) => {
    const pv = p.project_value || p.project_valuation || 0
    const combinedPct = (p.admin_pct ?? 5) + (p.hr_pct ?? 5) + (p.core_pct ?? 5)
    return s + pv * combinedPct
  }, 0)
  // Weighted-average combined pool-cut % across currently active projects,
  // grounded in real per-project admin_pct/hr_pct/core_pct fields rather
  // than assuming every project uses the 5+5+5 default. Falls back to the
  // default only when there are no active projects to weight against.
  const avgCombinedPct = totalValue > 0 ? weightedPctSum / totalValue : 15

  const baseAmount = totals.isProfit ? totals.surplus : totals.lsgbNeed
  const targetReduction = baseAmount * ((targetPct || 0) / 100)
  const neededNewProjectValue = avgCombinedPct > 0 ? targetReduction / (avgCombinedPct / 100) : 0
  const avgProjectSize = projects.length > 0 ? totalValue / projects.length : 0
  const approxProjectsNeeded =
    avgProjectSize > 0 ? Math.ceil(neededNewProjectValue / avgProjectSize) : null

  return {
    avgCombinedPct: Math.round(avgCombinedPct * 100) / 100,
    baseAmount: Math.round(baseAmount * 100) / 100,
    targetReduction: Math.round(targetReduction * 100) / 100,
    neededNewProjectValue: Math.round(neededNewProjectValue * 100) / 100,
    avgProjectSize: Math.round(avgProjectSize * 100) / 100,
    approxProjectsNeeded,
  }
}
```

Displayed as one plain sentence: *"To cut LSGB borrowing by 10%, you need about ₹X in new project value — roughly N new projects, based on your average project size of ₹Y."* Directly under it, a stated assumption in small text: *"Assumes the new project(s) run for this whole period."* — not hidden in a tooltip. If there are no active projects (`avgProjectSize` is 0), show *"Add at least one active project to calculate this."* instead of dividing by zero.

### 5. New: "Expenses at a Glance"

- **Counts:** operating vendor contracts (`localAdminExpenses.list({status:'Active'}).length`), Expense Pool entries (`poolExpenses.count` from §2), projects with a monthly plan (`projects.length`, already computed).
- **Health check**, one row per pool (HR/Admin/Core), reusing the exact threshold convention already used by `GeneralExpenseWidget.jsx` (`utilPct > 100 ? 'danger' : utilPct > 85 ? 'warning' : 'success'`), fed by the existing `localOrgPool.getMonthlyHRPoolBudgetSummary()` / `getMonthlyAdminPoolBudgetSummary()` / `getMonthlyCorePoolBudgetSummary()` (current month, no arg): plain labels "OK" (success) / "Watch" (warning) / "Over Budget" (danger), each showing `usedThisMonth` vs `totalMonthlyBudget` in plain currency, no raw percentage jargon.

### 6. New: "Projects at a Glance"

- Running-project count via **`localProjects.getStats()`** (already exists, unused elsewhere on this page): shows `ongoing`, `approved`, `pipeline`, `completed`, `total`.
- Total pool-share money earned this period: reuses `totals.shares` (already computed) — *"Your projects earned ₹X in pool-cut money this period."*
- "Do our projects earn enough?" reuses the **same** `totals.isProfit` flag as the main verdict (deliberately not a second, differently-thresholded metric — a CEO seeing "profit: NO" at the top and "projects: enough ✅" further down would be a confusing self-contradiction). Answered in one sentence, then a direct link down to §4's calculator for "if not, here's how many more projects you'd need."

### 7. New: "How Is HR Doing?"

HR Revenue (existing `hrRevenueTotal` = recruitment+training+internship) vs. HR's total cost — new figure, `localAdminExpenses.list({status:'Active'}).filter(e => e.group === 'HR')` monthly_actuals summed over the range, **plus** `localOrgPool.getHRExpenses()` amounts summed over the range (both HR-cost surfaces combined, since both are real HR costs). Shown as *"HR earned ₹X and cost ₹Y — HR covers Z% of its own cost."* (`Z = min(100, round(X/Y*100))`, or *"HR has no recorded cost this period"* if Y is 0).

## Out of scope

- Deduplicating `localAdminExpenses` vs `localOrgPool` expense records (flagged as a known limitation, not solved here).
- Per-month attribution of Expense Pool entries in the month-by-month table (period-level only).
- Any change to `ProfitLossWidget.jsx` itself (it keeps working via `computeLsgbTotals`'s stable signature) or to `localOrgPool.js` (no new methods added there — all new aggregation lives in the page file, matching this file's existing pattern).
- Changing the pre-existing "project's own planned expense counts as company expense" modeling choice — not something this request asked to revisit.
- Any admin_pct/hr_pct/core_pct value changes to actual project records — the calculator only reads these, never writes.
