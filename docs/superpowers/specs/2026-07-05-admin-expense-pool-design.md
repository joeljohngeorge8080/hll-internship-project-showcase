# Admin Expense Pool — Design Spec

**Date:** 2026-07-05
**Module:** EMS Global HR Pool (`hma-template/emsv1/src/modules/ems/hr-pool/GlobalHRPoolPage.jsx`)
**Status:** Approved by user (project scope, revenue source, and code-sharing approach all confirmed via questions).

## Background

The Global HR Pool page has a "Manage Organization-Wide HR Expenses" card: an org-wide expense gets entered once and distributed across every active project's HR pool share (`localOrgPool.computeAllocations('hr', amount, allowedProjectIds)`). The user wants an equivalent "Admin Expense" card, positioned directly under the HR Expense card, with the same feature set (Bill No, Expense dropdown, project checklist, dual revenue-source selector) — but funded from projects' **Admin** pool share instead of HR's.

**Why this isn't a copy-paste of the HR logic:** Admin's pool budget already has a different, documented model elsewhere in the codebase (`localOrgPool.js`'s own header comment):
```
ADMIN:  Active from project creation, across ALL months of project duration
        Monthly = project_value × admin_pct% ÷ total_project_months
HR/CORE: FROZEN at ₹0 until "Activate Project" is clicked in PMS
         % may be REDUCED from any month
```
Admin has no activation gate and no month-by-month percentage adjustment — unlike HR/Core, which are both. So Admin needs its own inclusion rule inside the shared budgets function, not a drop-in reuse of HR's.

There is separately some `computeAdminPoolAmount`/`recordAdminCredit`/`getAdminPoolCredits` code in `localOrgPool.js` (lines 986-1005) — confirmed **unused anywhere in the UI** (dead code from an earlier design iteration). This spec does not touch it or build on it.

## Decisions (confirmed with user)

1. **Project scope:** Admin Expense distributes across every project with `status` in `ongoing`/`active`/`approved` and a set `project_value`/duration — **no activation gate**, matching Admin's existing documented behavior (not HR's activation-gated rule).
2. **Revenue source:** Admin Expense keeps the same dual-source selector as HR (Project Pool + a second source), but the second source is **the same HR Revenue balance** reused (recruitment/training/internship fees) rather than a separate "Admin Revenue" concept, which doesn't exist anywhere in the app.
3. **Code sharing:** Extract the Add-form/list/edit UI (currently ~500 lines inline in `GlobalHRPoolPage.jsx`) into a new shared, parameterized component used by both HR (refactored) and Admin (new) — not a duplicated copy. This is a refactor of already-shipped, reviewed code, so it needs the same verification rigor as the original HR Expense work (manual re-check that HR Expense still behaves identically after extraction).

## Non-goals (explicitly out of scope)

- No duplicate "View Project Admin Budget" banner/breakdown card (the gradient `ProjectHRBudgetCard` at the top of the page) — the user only asked for the expense-**adding** card. `ProjectHRBudgetCard` and its "click a charge to edit allocation" flow (`AllocationEditor`, `updateExpenseProjectAllocation`) stay HR-only, unchanged.
- No changes to the unused `computeAdminPoolAmount`/`recordAdminCredit`/`getAdminPoolCredits` functions — dead code, not part of this feature.
- No changes to `AdminDivisionPanel.jsx` or `localAdminExpenses.js`'s own CRUD (House Rent, Electricity, AMC, etc. vendor-contract tracking) — Admin Expense's "Expense dropdown" only **reads** from `localAdminExpenses.list()`, same read-only relationship HR Expense already has with General Expenses.

## Section 1 — `getActiveProjectMonthlyBudgets` gains an `'admin'` branch

In `hma-template/emsv1/src/services/localOrgPool.js`, `getActiveProjectMonthlyBudgets(pool = 'hr')` currently: (a) filters projects to `is_operations_active && status ∈ {ongoing,active,approved}`, then (b) for each project, gates on `activationMonth` and computes `hr_pct`/`core_pct` via `getEffectivePoolPcts` (which honors `pool_pct_adjustments`).

Add an `'admin'` branch that skips both the `is_operations_active` filter and the activation gate, and uses `project.admin_pct ?? 5` directly (no adjustments lookup, matching `buildProjectMonthlyBreakdown`'s existing Admin formula which also ignores installments — Admin's monthly figure is `project_value × admin_pct% ÷ total_project_months`, full stop):

```js
getActiveProjectMonthlyBudgets(pool = 'hr') {
  const todayYM = new Date().toISOString().slice(0, 7) // YYYY-MM

  const statusOk = (p) => p.status === 'ongoing' || p.status === 'active' || p.status === 'approved'
  const projects = readProjects().filter((p) =>
    pool === 'admin' ? statusOk(p) : p.is_operations_active && statusOk(p),
  )

  const budgets = projects
    .map((p) => {
      if (pool === 'admin') {
        const pv = projectValue(p)
        const tpm = totalProjectMonths(p)
        const pct = p.admin_pct ?? 5
        const monthlyBudget = pv > 0 ? Math.round((pv * (pct / 100) / tpm) * 100) / 100 : 0
        const poolBudget = pv > 0 ? Math.round(pv * (pct / 100) * 100) / 100 : 0
        return {
          projectId: p.id,
          projectName: p.title || p.name,
          installmentId: null,
          installmentLabel: null,
          pct,
          totalProjectMonths: tpm,
          poolBudget,
          monthlyBudget,
          budgetNotForeseen: pv === 0,
          sharePct: 0, // filled below
          activationMonth: null,
        }
      }

      // ── existing hr/core logic below, byte-identical, unchanged ──
      const activationMonth = getActivationMonth(p)
      if (!activationMonth || activationMonth > todayYM) return null
      /* ...rest of existing function body, unmodified... */
    })
    .filter(Boolean)

  const total = budgets.reduce((s, b) => s + b.monthlyBudget, 0)
  const totalRounded = Math.round(total * 100) / 100

  return budgets.map((b) => ({
    ...b,
    sharePct: total > 0 ? Math.round((b.monthlyBudget / total) * 10000) / 100 : 0,
    totalMonthlyPool: totalRounded,
  }))
}
```
The final `sharePct`/`total` computation at the bottom is untouched and already generic — it works identically for all three pool values. `computeAllocations(pool, amount, allowedProjectIds)` (already generic, added in the prior HR Expense feature) needs **no changes** — it already just calls `this.getActiveProjectMonthlyBudgets(pool)`, so `computeAllocations('admin', amount, allowedProjectIds)` works automatically once this section lands.

## Section 2 — Admin Expense CRUD in `localOrgPool.js`

Mirror the existing "Core Expense CRUD" section (`addCoreExpense`/`removeCoreExpense`/`updateCoreExpense`/`getCoreExpenses`/`getAllCoreExpenses`/`getProjectCoreCharges`/`getProjectCoreBudgetSummary`) exactly, but reusing the fuller HR-style shape (revenue sources, bill_no, project_allocations) since Admin Expense needs the same revenue-source split and Bill No field HR Expense has — Core's CRUD doesn't have those fields since Core Expense never got the HR Expense enhancements. New functions, storage key `pool.admin_expenses` (parallel to `pool.hr_expenses`/`pool.core_expenses`):

```js
getAdminExpenses() {
  return readPool().admin_expenses || []
},

addAdminExpense(expense, enteredByProjectId) {
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
      ? this.computeAllocations('admin', projectPoolAmt)
      : []
  }

  const newExp = {
    id: uid(),
    label: expense.label || '',
    vendor: expense.vendor || '',
    frequency: expense.frequency || 'Monthly',
    yearly_price: parseFloat(expense.yearly_price) || 0,
    amount: totalAmt,
    date: expense.date || '',
    notes: expense.notes || '',
    bill_no: expense.bill_no || '',
    entered_by_project_id: enteredByProjectId,
    revenue_sources: revenueSources,
    hr_revenue_pct: hrRevenuePct,
    project_pool_pct: projectPoolPct,
    project_allocations: allocations,
    created_at: new Date().toISOString(),
  }
  pool.admin_expenses = [...(pool.admin_expenses || []), newExp]
  writePool(pool)
  return newExp
},

removeAdminExpense(expenseId) {
  const pool = readPool()
  pool.admin_expenses = (pool.admin_expenses || []).filter((e) => e.id !== expenseId)
  writePool(pool)
},

updateAdminExpense(expenseId, data) {
  const pool = readPool()
  pool.admin_expenses = (pool.admin_expenses || []).map((e) => {
    if (e.id !== expenseId) return e
    const updated = { ...e, ...data }
    if (data.amount !== undefined) {
      updated.project_allocations = this.computeAllocations('admin', parseFloat(data.amount) || 0)
    }
    return updated
  })
  writePool(pool)
},

getAllAdminExpenses() {
  return readPool().admin_expenses || []
},
```

## Section 3 — Admin pool budget summary functions

Mirror `getMonthlyHRPoolBudgetSummary(month)` and `getProjectsMonthlyHRRemaining(month)` exactly, reading `admin_expenses` and calling `getActiveProjectMonthlyBudgets('admin')`:

```js
getMonthlyAdminPoolBudgetSummary(month) {
  const budgets = this.getActiveProjectMonthlyBudgets('admin')
  const totalMonthlyBudget = budgets.length > 0 ? (budgets[0].totalMonthlyPool ?? 0) : 0

  const expenses = this.getAdminExpenses()
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

getProjectsMonthlyAdminRemaining(month) {
  const budgets = this.getActiveProjectMonthlyBudgets('admin')
  const expenses = this.getAdminExpenses()
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

## Section 4 — Extract the shared "expense pool card" component

New file: `hma-template/emsv1/src/modules/ems/hr-pool/ExpensePoolCard.jsx`. Move `RevenueSourceSelector` (unchanged) and the entire Add-form/list/edit block (currently `GlobalHRPoolPage.jsx` lines ~943-1470: the `CCard` starting `{/* ── Manage HR Expenses ── */}` through its closing `</CCard>`) into a new default-exported component, `ExpensePoolCard`, taking these props:

```
poolType: 'hr' | 'admin'
poolLabel: string           // "HR" | "Admin" — used in headings: "Add New {poolLabel} Expense", "Manage Organization-Wide {poolLabel} Expenses"
poolFundLabel: string       // "Project 5% Pool" | "Project 5% Admin Pool" — passed through to RevenueSourceSelector's Project Pool row label
hrRevenueTotal: number      // same live HR Revenue figure computed once in GlobalHRPoolPage, passed through unchanged (shared second source)
expenseDropdownItems: Array<{ id: string, label: string }>   // pre-mapped by the caller so this component stays source-agnostic
onPickExpense: (id: string) => { label, vendor, amount, yearly_price } | null  // caller-supplied mapper — HR maps a General Expenses record, Admin maps a localAdminExpenses record; return only the keys that should overwrite form state (handleExpensePick spreads the result into form)
getExpenses: () => Array<expense>
addExpense: (expense, enteredByProjectId) => expense
removeExpense: (id) => void
updateExpense: (id, patch) => void
getActiveProjects: () => Array<{ projectId, projectName, monthlyBudget, ... }>   // caller passes localOrgPool.getActiveProjectMonthlyBudgets(poolType)
getPoolBudgetSummary: (month) => { totalMonthlyBudget, usedThisMonth, remaining }
getProjectsMonthlyRemaining: (month) => Record<projectId, { monthlyBudget, usedThisMonth, remaining }>
```

All internal state (`form`, `revSources`, `hrRevPct`, `projPoolPct`, `adding`, `editId`, `editForm`, `allExpenses`, `previewAllocs`, `customAllocs`, `draftAmounts`, `activeProjects`, `selectedProjectIds`, `poolBudgetSummary`, `projectRemainingMap`) moves into `ExpensePoolCard` unchanged — this is a lift-and-shift of working logic, not a rewrite. Every place the current code calls `localOrgPool.addHRExpense`/`getHRExpenses`/`removeHRExpense`/`updateHRExpense`/`getActiveProjectMonthlyBudgets('hr')`/`getMonthlyHRPoolBudgetSummary`/`getProjectsMonthlyHRRemaining`/`computeAllocations('hr', ...)` becomes a call to the corresponding prop instead (`addExpense`, `getExpenses`, `removeExpense`, `updateExpense`, `getActiveProjects()`, `getPoolBudgetSummary`, `getProjectsMonthlyRemaining`, `localOrgPool.computeAllocations(poolType, ...)` — this one stays a direct `localOrgPool` call since it's already fully generic and doesn't need a prop).

The `handleExpensePick` function becomes:
```js
const handleExpensePick = (expenseId) => {
  if (!expenseId) return
  const mapped = onPickExpense(expenseId)
  if (!mapped) return
  setForm((f) => ({ ...f, ...mapped }))
}
```

## Section 5 — Wire both call sites in `GlobalHRPoolPage.jsx`

`GlobalHRPoolPage.jsx` keeps: the page header, "View Project HR Budget" selector + `ProjectHRBudgetCard` (HR-only, unchanged), and the `hrRevenueTotal` computation (unchanged, now also passed to the Admin card). Replace the old inline "Manage HR Expenses" card with:

```jsx
<ExpensePoolCard
  poolType="hr"
  poolLabel="HR"
  poolFundLabel="Project 5% Pool"
  hrRevenueTotal={hrRevenueTotal}
  expenseDropdownItems={hrGeneralExpenses.map((e) => ({ id: e.id, label: e.expense_name }))}
  onPickExpense={(id) => {
    const picked = hrGeneralExpenses.find((e) => e.id === id)
    if (!picked) return null
    const amt = picked.actual_amount > 0 ? picked.actual_amount : picked.planned_amount
    const vendorMatch = /^Vendor:\s*(.+)$/i.exec(picked.remarks || '')
    return {
      label: picked.expense_name,
      amount: String(amt),
      yearly_price: amt ? String(Math.round(amt * 12 * 100) / 100) : '',
      vendor: vendorMatch ? vendorMatch[1] : undefined,
    }
  }}
  getExpenses={() => localOrgPool.getHRExpenses()}
  addExpense={(expense, enteredBy) => localOrgPool.addHRExpense(expense, enteredBy)}
  removeExpense={(id) => localOrgPool.removeHRExpense(id)}
  updateExpense={(id, patch) => localOrgPool.updateHRExpense(id, patch)}
  getActiveProjects={() => localOrgPool.getActiveProjectMonthlyBudgets('hr')}
  getPoolBudgetSummary={(month) => localOrgPool.getMonthlyHRPoolBudgetSummary(month)}
  getProjectsMonthlyRemaining={(month) => localOrgPool.getProjectsMonthlyHRRemaining(month)}
/>

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
```
`adminExpenseItems` is a new piece of state in `GlobalHRPoolPage.jsx`, loaded via `localAdminExpenses.list({ status: 'Active' })` in `reload()` (same pattern as `hrGeneralExpenses`), importing `localAdminExpenses` from `../../../services/localAdminExpenses`.

## Data shape summary (for the implementation plan)

```
localOrgPool.js gains:
  getActiveProjectMonthlyBudgets(pool) — now accepts 'admin' too (Section 1)
  addAdminExpense, removeAdminExpense, updateAdminExpense, getAdminExpenses, getAllAdminExpenses (Section 2)
  getMonthlyAdminPoolBudgetSummary(month), getProjectsMonthlyAdminRemaining(month) (Section 3)

New file: ExpensePoolCard.jsx — default export, props listed in Section 4

GlobalHRPoolPage.jsx:
  - RevenueSourceSelector + the old inline "Manage HR Expenses" card removed (moved into ExpensePoolCard.jsx)
  - new state: adminExpenseItems (Array, from localAdminExpenses.list({status:'Active'}))
  - renders <ExpensePoolCard poolType="hr" .../> then <ExpensePoolCard poolType="admin" .../>
  - ProjectHRBudgetCard, AllocationEditor, and the "View Project HR Budget" selector stay exactly as-is (HR-only, out of scope)
```
