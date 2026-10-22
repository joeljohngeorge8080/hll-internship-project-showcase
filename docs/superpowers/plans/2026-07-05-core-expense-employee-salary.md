# Core Expense (Employee Salary) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third "Core Expense" card to the Global HR Pool page that lets a user register an unassigned ("overhead") employee's salary as a Core-5%-pool-funded expense (with HR Revenue as an optional second source), plus a small LSGB fund-balance info line.

**Architecture:** Upgrade the existing but currently-dead-code `addCoreExpense` in `localOrgPool.js` to the same fuller shape HR/Admin already use, add the two missing Core budget-summary functions mirroring Admin's, then wire a third `ExpensePoolCard` instance (already fully generic — zero changes needed there) into `GlobalHRPoolPage.jsx`, sourcing its dropdown from `localPayroll.getAllEmployeesWithProjectInfo()`'s existing `isOverhead` flag.

**Tech Stack:** React 19 (functional components, hooks only), CoreUI React 5.x. No test runner in this repo — verification is `npx eslint`, `npm run build`, and standalone Node scripts using `node:assert` against replicated pure-function logic.

**Spec:** `docs/superpowers/specs/2026-07-05-core-expense-employee-salary-design.md`

## Global Constraints

- CoreUI React components exclusively (`@coreui/react`) — never Tailwind, Material-UI, or other component libraries.
- Functional components with Hooks only — no class components.
- Prettier formatting: no semicolons, single quotes, 2-space indentation (existing files have pre-existing Prettier lint debt unrelated to this feature — do not bulk `--fix` unrelated lines).
- No changes to `CorePoolPage.jsx`, `CoreExpensesTab`, `hma_core_salary_expenses`, `localLsgb.js`, `getProjectCoreCharges`, `getProjectCoreBudgetSummary`, `getActiveProjectMonthlyBudgets`, `computeAllocations`, or `ExpensePoolCard.jsx` — all confirmed out of scope / already correct in the spec's non-goals.
- **No test runner exists in this repo.** Verification for every task is: (1) a standalone Node script using `node:assert` that replicates the new pure-function logic with fixture data (do **not** `import` `localOrgPool.js` directly under plain Node — see prior plans in this repo for why: it transitively imports `./localNotifications` with an extensionless specifier, which throws `ERR_MODULE_NOT_FOUND` under plain Node even though Vite resolves it fine), (2) `npx eslint <changed files>` compared against the baseline counts below, (3) `npm run build` (must succeed with zero errors).
- Lint baselines (pre-existing, unrelated to this feature — do not regress): `src/services/localOrgPool.js` = 14 problems. `src/modules/ems/hr-pool/GlobalHRPoolPage.jsx` = 32 problems.
- Commit convention: `feat:` / `fix:` / `docs:` / `refactor:` / `chore:` per `docs/CLAUDE.md`.

---

### Task 1: `localOrgPool.js` — upgrade `addCoreExpense`, add Core budget-summary functions

**Files:**
- Modify: `hma-template/emsv1/src/services/localOrgPool.js:907-923` (`addCoreExpense`)
- Modify: `hma-template/emsv1/src/services/localOrgPool.js` — insert two new methods after `getAllCoreExpenses()` (currently lines 1002-1005)

**Interfaces:**
- Consumes: `this.computeAllocations('core', amount, allowedProjectIds)` and `this.getActiveProjectMonthlyBudgets('core')` (both already exist, already generic, unchanged).
- Produces:
  - `addCoreExpense(expense, enteredByProjectId)` → now returns the fuller shape: `{ id, label, vendor, frequency, yearly_price, amount, date, notes, bill_no, employee_id, entered_by_project_id, revenue_sources, hr_revenue_pct, project_pool_pct, project_allocations, created_at }` (previously only had `id, label, amount, date, notes, entered_by_project_id, project_allocations, created_at`).
  - `getMonthlyCorePoolBudgetSummary(month)` → `{ totalMonthlyBudget, usedThisMonth, remaining }`
  - `getProjectsMonthlyCoreRemaining(month)` → `Record<projectId, { monthlyBudget, usedThisMonth, remaining }>`

- [ ] **Step 1: Write the verification script for the new math**

Create `hma-template/emsv1/scratch_verify_core_task1.mjs`:

```js
import assert from 'node:assert'

// Replicated from the new getMonthlyCorePoolBudgetSummary(month) — same shape as
// the already-shipped getMonthlyAdminPoolBudgetSummary, just renamed for Core.
function monthlyPoolBudgetSummary(budgets, expenses, targetMonth) {
  const totalMonthlyBudget = budgets.length > 0 ? (budgets[0].totalMonthlyPool ?? 0) : 0
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
}

const budgets = [
  { projectId: 'p1', monthlyBudget: 4000, totalMonthlyPool: 6000 },
  { projectId: 'p2', monthlyBudget: 2000, totalMonthlyPool: 6000 },
]
const expenses = [
  // Salary fully funded by Core pool
  { date: '2026-07', amount: 20000, revenue_sources: ['project_pool'], project_pool_pct: 100 },
  // Salary split 60/40 Core-pool/HR-Revenue — only the 60% (12000*0.6=7200... wait use amount*pct)
  { date: '2026-07', amount: 10000, revenue_sources: ['project_pool', 'hr_revenue'], project_pool_pct: 60 },
  // Fully HR-Revenue funded — excluded entirely
  { date: '2026-07', amount: 15000, revenue_sources: ['hr_revenue'], project_pool_pct: 0 },
  // Wrong month — excluded
  { date: '2026-06', amount: 20000, revenue_sources: ['project_pool'], project_pool_pct: 100 },
]

const summary = monthlyPoolBudgetSummary(budgets, expenses, '2026-07')
// usedThisMonth = 20000 (100%) + 10000*0.6=6000 = 26000
assert.strictEqual(summary.totalMonthlyBudget, 6000)
assert.strictEqual(summary.usedThisMonth, 26000)
assert.strictEqual(summary.remaining, -20000) // over budget, remaining can go negative — expected

console.log('Task 1 Core budget-summary math verified OK')
```

- [ ] **Step 2: Run it**

Run: `node hma-template/emsv1/scratch_verify_core_task1.mjs`
Expected: `Task 1 Core budget-summary math verified OK`

- [ ] **Step 3: Delete the scratch script**

Run: `rm hma-template/emsv1/scratch_verify_core_task1.mjs`

- [ ] **Step 4: Upgrade `addCoreExpense`**

In `hma-template/emsv1/src/services/localOrgPool.js`, find this exact block:

```js
  addCoreExpense(expense, enteredByProjectId) {
    const pool = readPool()
    const allocations = this.computeAllocations('core', parseFloat(expense.amount) || 0)
    const newExp = {
      id: uid().replace('hre_', 'core_'),
      label: expense.label || '',
      amount: parseFloat(expense.amount) || 0,
      date: expense.date || '',
      notes: expense.notes || '',
      entered_by_project_id: enteredByProjectId,
      project_allocations: allocations,
      created_at: new Date().toISOString(),
    }
    pool.core_expenses = [...(pool.core_expenses || []), newExp]
    writePool(pool)
    return newExp
  },
```

Replace it with:

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

Do **not** touch `updateCoreExpense`, `removeCoreExpense`, or `getCoreExpenses` — they already work generically and need no changes.

- [ ] **Step 5: Insert the two new budget-summary functions**

Find this exact block (the end of the Core Expense CRUD section, right before the Admin Expense CRUD section):

```js
  /** Returns all Core expenses in the org pool. */
  getAllCoreExpenses() {
    return readPool().core_expenses || []
  },

  // ── Admin Expense CRUD ─────────────────────────────────────────────────────
```

Replace it with:

```js
  /** Returns all Core expenses in the org pool. */
  getAllCoreExpenses() {
    return readPool().core_expenses || []
  },

  /**
   * Returns the total monthly Core project-pool budget across all active projects,
   * and how much has already been used (charged to project_pool) this month.
   */
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

  // ── Admin Expense CRUD ─────────────────────────────────────────────────────
```

- [ ] **Step 6: Grep-check no stray typos in the new employee_id/core_expenses references**

Run: `cd hma-template/emsv1 && grep -n "employee_id" src/services/localOrgPool.js`
Expected: 1 match — inside `addCoreExpense`'s `newExp` object (`employee_id: expense.employee_id || null,`). No other file in `localOrgPool.js` should reference `employee_id` yet.

- [ ] **Step 7: Lint check**

Run: `npx eslint src/services/localOrgPool.js`
Expected: problem count at or a little above 14 (only new Prettier-style formatting flags on the added lines — no new `no-undef`/`no-unused-vars`/logic-category errors).

- [ ] **Step 8: Build check**

Run: `npx vite build`
Expected: build succeeds with no errors.

- [ ] **Step 9: Commit**

```bash
git add hma-template/emsv1/src/services/localOrgPool.js
git commit -m "feat: upgrade addCoreExpense shape and add Core pool budget summary functions"
```

---

### Task 2: Wire the Core Expense card + LSGB fund balance into `GlobalHRPoolPage.jsx`

**Files:**
- Modify: `hma-template/emsv1/src/modules/ems/hr-pool/GlobalHRPoolPage.jsx`

**Interfaces:**
- Consumes: `localPayroll.getAllEmployeesWithProjectInfo()` (existing, returns employees spread with `isOverhead`, `employee_name`, `current_salary`, `employment`, `status`, `id`), `localLsgb.getSummary()` (existing, returns `{ totalBodies, totalSanctioned, totalWithdrawn, remaining, byPurpose, byBody }`), and Task 1's new `localOrgPool.getMonthlyCorePoolBudgetSummary(month)` / `getProjectsMonthlyCoreRemaining(month)` / upgraded `addCoreExpense`.
- Produces: nothing consumed by later tasks — this is the last task in this plan.

- [ ] **Step 1: Add the two new imports**

Find:

```jsx
import { localAdminExpenses } from '../../../services/localAdminExpenses'
import { localRecruitments } from '../../../services/localRecruitments'
import { localInternships } from '../../../services/localInternships'
import ExpensePoolCard from './ExpensePoolCard'
```

Replace with:

```jsx
import { localAdminExpenses } from '../../../services/localAdminExpenses'
import { localRecruitments } from '../../../services/localRecruitments'
import { localInternships } from '../../../services/localInternships'
import { localPayroll } from '../../../services/localPayroll'
import { localLsgb } from '../../../services/localLsgb'
import ExpensePoolCard from './ExpensePoolCard'
```

- [ ] **Step 2: Add new state and load it in `reload()`**

Find:

```jsx
  const [hrGeneralExpenses, setHrGeneralExpenses] = useState([])
  const [adminExpenseItems, setAdminExpenseItems] = useState([])
  const [activeProjects, setActiveProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('__all__')
  const [showBudgetSection, setShowBudgetSection] = useState(false)
  const [budgetKey, setBudgetKey] = useState(0) // force budget card refresh

  const reload = () => {
    setHrGeneralExpenses(
      localGeneralExpenses.expenses.list({
        category_id: HR_DIVISION_CATEGORY_ID,
        page_size: 500,
      }).items,
    )
    setAdminExpenseItems(localAdminExpenses.list({ status: 'Active' }))
    const ap = localOrgPool.getActiveProjectMonthlyBudgets('hr')
    setActiveProjects(ap)
  }
```

Replace with:

```jsx
  const [hrGeneralExpenses, setHrGeneralExpenses] = useState([])
  const [adminExpenseItems, setAdminExpenseItems] = useState([])
  const [overheadEmployees, setOverheadEmployees] = useState([])
  const [lsgbSummary, setLsgbSummary] = useState(null)
  const [activeProjects, setActiveProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('__all__')
  const [showBudgetSection, setShowBudgetSection] = useState(false)
  const [budgetKey, setBudgetKey] = useState(0) // force budget card refresh

  const reload = () => {
    setHrGeneralExpenses(
      localGeneralExpenses.expenses.list({
        category_id: HR_DIVISION_CATEGORY_ID,
        page_size: 500,
      }).items,
    )
    setAdminExpenseItems(localAdminExpenses.list({ status: 'Active' }))
    setOverheadEmployees(
      localPayroll
        .getAllEmployeesWithProjectInfo()
        .filter((e) => e.isOverhead && e.status !== 'Deleted' && e.status !== 'Inactive'),
    )
    setLsgbSummary(localLsgb.getSummary())
    const ap = localOrgPool.getActiveProjectMonthlyBudgets('hr')
    setActiveProjects(ap)
  }
```

- [ ] **Step 3: Add the LSGB info line and the Core Expense card after the Admin card**

Find the end of the Admin `ExpensePoolCard` usage:

```jsx
      {/* ── Admin Expense Pool Card ──────────────────────────────────────────── */}
      <ExpensePoolCard
        poolType="admin"
        poolLabel="Admin"
        poolFundLabel="Project 5% Admin Pool"
        hrRevenueTotal={hrRevenueTotal}
        expenseDropdownItems={adminExpenseItems.map((e) => ({
          id: e.id,
          label: `${e.expense_category} — ${e.vendor_name}`,
        }))}
        onPickExpense={(id) => {
          const picked = adminExpenseItems.find((e) => e.id === id)
          if (!picked) return null
          const monthKeys = Object.keys(picked.monthly_actuals || {}).sort()
          const latestActual = monthKeys.length > 0 ? picked.monthly_actuals[monthKeys[monthKeys.length - 1]] : 0
          const amt = latestActual > 0 ? latestActual : Math.round((picked.annual_amount || 0) / 12)
          return {
            label: `${picked.expense_category} — ${picked.vendor_name}`,
            amount: String(amt),
            yearly_price: String(picked.annual_amount || ''),
            vendor: picked.vendor_name,
          }
        }}
        getExpenses={() => localOrgPool.getAdminExpenses()}
        addExpense={(expense, enteredBy) => localOrgPool.addAdminExpense(expense, enteredBy)}
        removeExpense={(id) => localOrgPool.removeAdminExpense(id)}
        updateExpense={(id, patch) => localOrgPool.updateAdminExpense(id, patch)}
        getActiveProjects={() => localOrgPool.getActiveProjectMonthlyBudgets('admin')}
        getPoolBudgetSummary={(month) => localOrgPool.getMonthlyAdminPoolBudgetSummary(month)}
        getProjectsMonthlyRemaining={(month) => localOrgPool.getProjectsMonthlyAdminRemaining(month)}
      />
    </>
  )
}
```

Replace it with:

```jsx
      {/* ── Admin Expense Pool Card ──────────────────────────────────────────── */}
      <ExpensePoolCard
        poolType="admin"
        poolLabel="Admin"
        poolFundLabel="Project 5% Admin Pool"
        hrRevenueTotal={hrRevenueTotal}
        expenseDropdownItems={adminExpenseItems.map((e) => ({
          id: e.id,
          label: `${e.expense_category} — ${e.vendor_name}`,
        }))}
        onPickExpense={(id) => {
          const picked = adminExpenseItems.find((e) => e.id === id)
          if (!picked) return null
          const monthKeys = Object.keys(picked.monthly_actuals || {}).sort()
          const latestActual = monthKeys.length > 0 ? picked.monthly_actuals[monthKeys[monthKeys.length - 1]] : 0
          const amt = latestActual > 0 ? latestActual : Math.round((picked.annual_amount || 0) / 12)
          return {
            label: `${picked.expense_category} — ${picked.vendor_name}`,
            amount: String(amt),
            yearly_price: String(picked.annual_amount || ''),
            vendor: picked.vendor_name,
          }
        }}
        getExpenses={() => localOrgPool.getAdminExpenses()}
        addExpense={(expense, enteredBy) => localOrgPool.addAdminExpense(expense, enteredBy)}
        removeExpense={(id) => localOrgPool.removeAdminExpense(id)}
        updateExpense={(id, patch) => localOrgPool.updateAdminExpense(id, patch)}
        getActiveProjects={() => localOrgPool.getActiveProjectMonthlyBudgets('admin')}
        getPoolBudgetSummary={(month) => localOrgPool.getMonthlyAdminPoolBudgetSummary(month)}
        getProjectsMonthlyRemaining={(month) => localOrgPool.getProjectsMonthlyAdminRemaining(month)}
      />

      {/* ── LSGB Fund Balance (info line, unrelated to Core 5% pool math) ────── */}
      {lsgbSummary && (
        <div className="d-flex align-items-center gap-2 mb-2 small text-body-secondary">
          <CIcon icon={cilDollar} style={{ width: 14, height: 14 }} />
          LSGB Fund Balance: <strong className="text-body">{fmt(lsgbSummary.remaining)}</strong>
          <span>
            ({fmt(lsgbSummary.totalSanctioned)} sanctioned − {fmt(lsgbSummary.totalWithdrawn)} withdrawn)
          </span>
        </div>
      )}

      {/* ── Core Expense Pool Card ─────────────────────────────────────────────── */}
      <ExpensePoolCard
        poolType="core"
        poolLabel="Core"
        poolFundLabel="Core 5% Pool"
        hrRevenueTotal={hrRevenueTotal}
        expenseDropdownItems={(() => {
          const existingIds = new Set(localOrgPool.getCoreExpenses().map((exp) => exp.employee_id))
          return overheadEmployees
            .filter((e) => !existingIds.has(e.id))
            .map((e) => ({ id: e.id, label: e.employee_name }))
        })()}
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
    </>
  )
}
```

Note: `employee_id` is not in `ExpensePoolCard`'s documented prop-shape for `onPickExpense`'s return value, but no change to `ExpensePoolCard.jsx` is needed — `handleExpensePick` already does a generic `for (const [k, v] of Object.entries(mapped))` merge into form state, and `handleAdd` spreads the whole form into the object passed to `addExpense`, so `employee_id` flows through to `addCoreExpense` automatically.

- [ ] **Step 4: Lint check**

Run: `cd hma-template/emsv1 && npx eslint src/modules/ems/hr-pool/GlobalHRPoolPage.jsx`
Expected: no `no-undef`, `no-unused-vars`, `react-hooks/rules-of-hooks`, or `react/jsx-key` errors (these would indicate a real bug — e.g. a typo in `localPayroll`/`localLsgb`, or a missing `key`). Prettier-only and the already-accepted `react-hooks/set-state-in-effect` pattern are fine (baseline was 32 problems; a small increase from the new lines is expected).

- [ ] **Step 5: Build check**

Run: `npx vite build`
Expected: build succeeds with zero errors.

- [ ] **Step 6: Structural grep checks**

Run: `grep -c 'poolType="core"' src/modules/ems/hr-pool/GlobalHRPoolPage.jsx`
Expected: `1`.

Run: `grep -c "localPayroll\|localLsgb" src/modules/ems/hr-pool/GlobalHRPoolPage.jsx`
Expected: at least `4` (2 import lines + at least 1 usage each of `localPayroll.getAllEmployeesWithProjectInfo()` and `localLsgb.getSummary()`).

- [ ] **Step 7: Manual smoke check in the dev server (no automated browser tooling available this session)**

Run: `npm start` (from `hma-template/emsv1/`), then in a browser:
1. Navigate to the Global HR Pool page.
2. Confirm a third card, "Manage Organization-Wide Core Expenses", appears below the Admin card, with the LSGB Fund Balance line just above it.
3. Click "Add New Core Expense" — confirm the expense dropdown lists only employees with no active project assignment (cross-check a couple of names against Staff & Payroll → Core Pool's "Unassigned Employees" list, which uses the same underlying data).
4. Pick one, confirm amount/yearly pre-fill from their salary, add it, confirm it appears in the list and that employee no longer appears in the dropdown (already-added filter).
5. Remove the test entry to clean up.
6. Stop the dev server (`Ctrl+C`) once confirmed.

Report back what was observed instead of claiming this was verified if the manual check wasn't actually run.

- [ ] **Step 8: Commit**

```bash
git add hma-template/emsv1/src/modules/ems/hr-pool/GlobalHRPoolPage.jsx
git commit -m "feat: add Core Expense card (employee salary) and LSGB fund balance to Global HR Pool"
```

## Post-plan cleanup

None needed. `CorePoolPage.jsx`'s existing "Core Expenses" tab, `localLsgb.js`, and `ExpensePoolCard.jsx` are all untouched, exactly as decided in the spec's non-goals.
