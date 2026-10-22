# Global HR Pool — Core Expense (Employee Salary) Card + LSGB Fund Balance — Design Spec

**Date:** 2026-07-05
**Module:** EMS Global HR Pool (`hma-template/emsv1/src/modules/ems/hr-pool/GlobalHRPoolPage.jsx`)
**Status:** Approved by user.

## Background

The Global HR Pool page has HR and Admin Expense cards (both `ExpensePoolCard` instances). The user wants a third, "Core Expense" card: pick an employee who currently has **no active project assignment** ("overhead"/"bench" employee), and register their salary as a Core-pool-funded expense — funded from each project's Core 5% pool per month, with HR Revenue as an optional second source (same dual-source pattern HR/Admin already use). The card should also show the LSGB fund's balance nearby.

**Why this isn't a copy-paste of Admin's approach:** two things already exist here that Admin didn't have to deal with:

1. **A different, existing "Core Expenses" feature.** Staff & Payroll → Core Pool (`src/modules/ems/core-pool/CorePoolPage.jsx`) already has a "Core Expenses" tab (`CoreExpensesTab`, line 615) that lets a user pick an overhead employee and register their salary — but into a completely separate, flat localStorage key (`hma_core_salary_expenses`, line 52), with no pool-funding math and no HR Revenue split. **Confirmed with user: that page stays exactly as-is, untouched.** This spec is a new, separate feature living only on the Global HR Pool page.
2. **`localOrgPool.js` already has a Core Expense CRUD, but it's dead code.** `getCoreExpenses`/`addCoreExpense`/`removeCoreExpense`/`updateCoreExpense`/`getAllCoreExpenses` (lines 903-942, 1003) already exist and are already wired to the Core 5% pool math (`computeAllocations('core', ...)`) — but grepping the whole `src/` tree shows **no UI anywhere calls the write side** (`addCoreExpense` et al.). Only the read side (`getProjectCoreCharges`/`getProjectCoreBudgetSummary`) is used, by `ExpenseManagementPage.jsx:301` and `ProjectOverheadView.jsx:48,50` — and since nothing ever writes a `core_expenses` entry, those reads always come back empty today. This feature finally makes that existing, already-tested read side show real data.

**LSGB, clarified:** there's no `project.category` field with an LSGB value anywhere in the codebase (that's aspirational, per `docs/CLAUDE.md`, not implemented). LSGB is tracked as its own separate domain in `src/services/localLsgb.js` (LSGB "bodies" + fund withdrawals, with `getSummary()` at line 137 returning `{ totalBodies, totalSanctioned, totalWithdrawn, remaining, byPurpose, byBody }`). **Confirmed with user:** "how much LSGB contains" means this fund's `remaining` balance — a separate number, unrelated to the Core 5% project-pool math.

## Decisions (confirmed with user)

1. **Relationship to the existing Core Pool page:** new, separate card on the Global HR Pool page. `CorePoolPage.jsx`'s existing "Core Expenses" tab is untouched.
2. **Funding:** same dual-source `ExpensePoolCard` pattern as HR/Admin — Core 5% Pool + HR Revenue.
3. **LSGB display:** the LSGB fund's overall `remaining` balance (from `localLsgb.getSummary()`), shown as a standalone info line — not related to Core pool math.

## Non-goals (explicitly out of scope)

- No changes to `CorePoolPage.jsx`, `CoreExpensesTab`, `hma_core_salary_expenses`, or any of that page's modals/logic.
- No changes to `getProjectCoreCharges`/`getProjectCoreBudgetSummary` (already correct — they'll just start returning real data).
- No changes to `getActiveProjectMonthlyBudgets('core')` or `computeAllocations('core', ...)` — both already fully support the `'core'` pool type since before the Admin Expense feature.
- No changes to `localLsgb.js` — read-only use of the already-existing `getSummary()`.
- Does not touch the pre-existing duplicate definitions of `getProjectCoreCharges`/`getProjectCoreBudgetSummary` in `localOrgPool.js` (lines 830/845 are dead, shadowed by 927/946 — pre-existing, unrelated to this feature).

## Section 1 — Employee data source (no service changes needed)

`src/services/localPayroll.js`'s existing `getAllEmployeesWithProjectInfo()` (line 71) already returns every employee spread with `isOverhead: true` when they have zero active `project_assignments` — the exact "no current project" signal needed, already used by `CorePoolPage.jsx` for the same purpose. `GlobalHRPoolPage.jsx` will call this directly and filter:

```js
const overheadEmployees = localPayroll
  .getAllEmployeesWithProjectInfo()
  .filter((e) => e.isOverhead && e.status !== 'Deleted' && e.status !== 'Inactive')
```

Employees who already have an open Core expense entry are excluded from the dropdown (so the same person's salary can't be registered twice) — this requires the new expense record to store `employee_id` (Section 2).

## Section 2 — Upgrade `addCoreExpense` to the fuller HR/Admin-style shape

In `hma-template/emsv1/src/services/localOrgPool.js`, `addCoreExpense` (lines 907-923) currently only stores `label`/`amount`/`date`/`notes`/`entered_by_project_id`/`project_allocations` — no `revenue_sources`/`hr_revenue_pct`/`project_pool_pct`/`bill_no`/`vendor`/`frequency`/`yearly_price`. Without this upgrade, `ExpensePoolCard`'s dual revenue-source selector would silently lose data on save (the HR Revenue split would never persist, and `getMonthlyCorePoolBudgetSummary`'s "is this project-pool-sourced" check in Section 3 would always default to 100% project-pool since `revenue_sources` would never be stored). Replace the whole method with:

```js
  addCoreExpense(expense, enteredByProjectId) {
    const pool = readPool()
    const totalAmt = parseFloat(expense.amount) || 0

    const revenueSources = expense.revenue_sources || ['project_pool']
    const projectPoolPct = parseFloat(expense.project_pool_pct) ?? 100
    const hrRevenuePct = parseFloat(expense.hr_revenue_pct) ?? 0

    let allocations
    if (expense.project_allocations && expense.project_allocations.length > 0) {
      allocations = expense.project_allocations
    } else {
      const projectPoolAmt = Math.round(totalAmt * (projectPoolPct / 100) * 100) / 100
      allocations = revenueSources.includes('project_pool')
        ? this.computeAllocations('core', projectPoolAmt)
        : []
    }

    const newExp = {
      id: uid().replace('hre_', 'core_'),
      label: expense.label || '',
      vendor: expense.vendor || '',
      frequency: expense.frequency || 'Monthly',
      yearly_price: parseFloat(expense.yearly_price) || 0,
      amount: totalAmt,
      date: expense.date || '',
      notes: expense.notes || '',
      bill_no: expense.bill_no || '',
      employee_id: expense.employee_id || null,
      entered_by_project_id: enteredByProjectId,
      revenue_sources: revenueSources,
      hr_revenue_pct: hrRevenuePct,
      project_pool_pct: projectPoolPct,
      project_allocations: allocations,
      created_at: new Date().toISOString(),
    }
    pool.core_expenses = [...(pool.core_expenses || []), newExp]
    writePool(pool)
    return newExp
  },
```

`updateCoreExpense` (lines 931-942) needs **no changes** — it already does a generic `{ ...e, ...data }` spread, so any of the new fields pass through automatically. `removeCoreExpense`/`getCoreExpenses`/`getAllCoreExpenses` need no changes either.

## Section 3 — Core pool budget summary functions (new, mirroring Admin's)

Add, mirroring `getMonthlyAdminPoolBudgetSummary`/`getProjectsMonthlyAdminRemaining` exactly (reading `core_expenses`, calling `getActiveProjectMonthlyBudgets('core')`):

```js
  getMonthlyCorePoolBudgetSummary(month) {
    const budgets = this.getActiveProjectMonthlyBudgets('core')
    const totalMonthlyBudget = budgets.length > 0 ? (budgets[0].totalMonthlyPool ?? 0) : 0

    const expenses = this.getCoreExpenses()
    const targetMonth = month || new Date().toISOString().slice(0, 7)

    const usedThisMonth = expenses
      .filter((e) => (e.date ? e.date.slice(0, 7) : targetMonth) === targetMonth)
      .reduce((sum, e) => {
        const sources = e.revenue_sources || ['project_pool']
        if (!sources.includes('project_pool')) return sum
        const poolPct = parseFloat(e.project_pool_pct) ?? 100
        const totalAmt = parseFloat(e.amount) || 0
        return sum + Math.round(totalAmt * (poolPct / 100) * 100) / 100
      }, 0)

    return {
      totalMonthlyBudget: Math.round(totalMonthlyBudget * 100) / 100,
      usedThisMonth: Math.round(usedThisMonth * 100) / 100,
      remaining: Math.round((totalMonthlyBudget - usedThisMonth) * 100) / 100,
    }
  },

  getProjectsMonthlyCoreRemaining(month) {
    const budgets = this.getActiveProjectMonthlyBudgets('core')
    const expenses = this.getCoreExpenses()
    const targetMonth = month || new Date().toISOString().slice(0, 7)

    const usedMap = {}
    for (const exp of expenses) {
      const eMonth = exp.date ? exp.date.slice(0, 7) : targetMonth
      if (eMonth !== targetMonth) continue
      const sources = exp.revenue_sources || ['project_pool']
      if (!sources.includes('project_pool')) continue

      const allocs = exp.project_allocations || []
      if (allocs.length > 0) {
        for (const a of allocs) {
          usedMap[a.projectId] = (usedMap[a.projectId] || 0) + (a.amountCharged || 0)
        }
      } else {
        const total = budgets.reduce((s, b) => s + b.monthlyBudget, 0)
        for (const b of budgets) {
          const share = total > 0 ? b.monthlyBudget / total : 0
          const poolPct = parseFloat(exp.project_pool_pct) ?? 100
          const poolAmt = parseFloat(exp.amount || 0) * (poolPct / 100)
          usedMap[b.projectId] = (usedMap[b.projectId] || 0) + Math.round(poolAmt * share * 100) / 100
        }
      }
    }

    const result = {}
    for (const b of budgets) {
      const used = Math.round((usedMap[b.projectId] || 0) * 100) / 100
      result[b.projectId] = {
        monthlyBudget: b.monthlyBudget,
        usedThisMonth: used,
        remaining: Math.round((b.monthlyBudget - used) * 100) / 100,
      }
    }
    return result
  },
```

Insert this new block right after `getAllCoreExpenses()` (currently the last method before the dead `computeAdminPoolAmount`/`recordAdminCredit`/`getAdminPoolCredits` block — which stays exactly where it is, after this new block, per the earlier Admin spec's non-goals).

## Section 4 — Wire the Core card + LSGB info line into `GlobalHRPoolPage.jsx`

New imports: `localPayroll` from `../../../services/localPayroll`, `localLsgb` from `../../../services/localLsgb`.

New state, loaded in `reload()`:

```js
const [overheadEmployees, setOverheadEmployees] = useState([])
const [lsgbSummary, setLsgbSummary] = useState(null)
```

```js
setOverheadEmployees(
  localPayroll
    .getAllEmployeesWithProjectInfo()
    .filter((e) => e.isOverhead && e.status !== 'Deleted' && e.status !== 'Inactive'),
)
setLsgbSummary(localLsgb.getSummary())
```

A third `ExpensePoolCard`, placed after the Admin card, with the "already added" filter applied to the dropdown:

```jsx
{/* ── LSGB Fund Balance (info line, unrelated to Core 5% pool math) ────── */}
{lsgbSummary && (
  <div className="d-flex align-items-center gap-2 mb-2 small text-body-secondary">
    <CIcon icon={cilDollar} style={{ width: 14, height: 14 }} />
    LSGB Fund Balance: <strong className="text-body">{fmt(lsgbSummary.remaining)}</strong>
    <span>({fmt(lsgbSummary.totalSanctioned)} sanctioned − {fmt(lsgbSummary.totalWithdrawn)} withdrawn)</span>
  </div>
)}

{/* ── Core Expense Pool Card ────────────────────────────────────────────── */}
<ExpensePoolCard
  poolType="core"
  poolLabel="Core"
  poolFundLabel="Core 5% Pool"
  hrRevenueTotal={hrRevenueTotal}
  expenseDropdownItems={overheadEmployees
    .filter((e) => !localOrgPool.getCoreExpenses().some((exp) => exp.employee_id === e.id))
    .map((e) => ({ id: e.id, label: e.employee_name }))}
  onPickExpense={(id) => {
    const picked = overheadEmployees.find((e) => e.id === id)
    if (!picked) return null
    const salary = parseFloat(picked.current_salary) || 0
    return {
      label: picked.employee_name,
      amount: salary ? String(salary) : '',
      yearly_price: salary ? String(Math.round(salary * 12 * 100) / 100) : '',
      vendor: picked.employment?.department || undefined,
      employee_id: picked.id,
    }
  }}
  getExpenses={() => localOrgPool.getCoreExpenses()}
  addExpense={(expense, enteredBy) => localOrgPool.addCoreExpense(expense, enteredBy)}
  removeExpense={(id) => localOrgPool.removeCoreExpense(id)}
  updateExpense={(id, patch) => localOrgPool.updateCoreExpense(id, patch)}
  getActiveProjects={() => localOrgPool.getActiveProjectMonthlyBudgets('core')}
  getPoolBudgetSummary={(month) => localOrgPool.getMonthlyCorePoolBudgetSummary(month)}
  getProjectsMonthlyRemaining={(month) => localOrgPool.getProjectsMonthlyCoreRemaining(month)}
/>
```

`ExpensePoolCard.jsx` itself needs **no changes** — `handleExpensePick` already generically merges every key `onPickExpense` returns (including the new `employee_id`, which isn't in its documented prop-shape comment but flows through the same generic merge used for `label`/`vendor`/`amount`/`yearly_price`), and `handleAdd` already spreads the whole form into the object passed to `addExpense`, so `employee_id` reaches `addCoreExpense` without any plumbing changes.

## Data shape summary (for the implementation plan)

```
localOrgPool.js:
  addCoreExpense — upgraded to the fuller shape (bill_no, vendor, frequency, yearly_price,
    revenue_sources, hr_revenue_pct, project_pool_pct, employee_id)
  getMonthlyCorePoolBudgetSummary(month) — new
  getProjectsMonthlyCoreRemaining(month) — new
  (updateCoreExpense, removeCoreExpense, getCoreExpenses, getAllCoreExpenses — unchanged)

GlobalHRPoolPage.jsx:
  new imports: localPayroll, localLsgb
  new state: overheadEmployees, lsgbSummary
  reload() gains two more loads
  new: LSGB fund balance info line
  new: <ExpensePoolCard poolType="core" .../> after the Admin card

No changes to: ExpensePoolCard.jsx, CorePoolPage.jsx, localLsgb.js, localPayroll.js,
getProjectCoreCharges, getProjectCoreBudgetSummary, getActiveProjectMonthlyBudgets,
computeAllocations.
```
