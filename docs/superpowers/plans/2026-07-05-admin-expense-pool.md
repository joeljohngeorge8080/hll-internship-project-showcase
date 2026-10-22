# Admin Expense Pool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Admin Expense" card to the Global HR Pool page, positioned under the existing HR Expense card, with the same feature set (Bill No, Expense dropdown, project checklist, dual revenue-source selector) but funded from projects' Admin 5% pool share instead of HR's.

**Architecture:** Extend `localOrgPool.js`'s existing generic pool-budget engine (`getActiveProjectMonthlyBudgets`, `computeAllocations`) with an `'admin'` pool type, add a parallel Admin Expense CRUD + budget-summary API mirroring the existing HR/Core ones, then extract the ~500-line "Add expense / list / edit" UI block (currently inline and HR-only in `GlobalHRPoolPage.jsx`) into a new reusable `ExpensePoolCard.jsx` component so both HR and Admin render from one code path.

**Tech Stack:** React 19 (functional components, hooks only), CoreUI React 5.x components, no test runner in this repo (verification is via `npx eslint`, `npm run build`, and standalone Node scripts using `node:assert` against replicated pure-function logic — see Global Constraints).

**Spec:** `docs/superpowers/specs/2026-07-05-admin-expense-pool-design.md`

## Global Constraints

- CoreUI React components exclusively (`@coreui/react`) — never Tailwind, Material-UI, or other component libraries.
- Functional components with Hooks only — no class components.
- Prettier formatting: no semicolons, single quotes, 2-space indentation (existing files have pre-existing Prettier lint debt unrelated to this feature — do not bulk `--fix` unrelated lines; only keep new/changed lines clean).
- Payroll/history immutability rules from `docs/CLAUDE.md` do not apply here (this feature touches org-pool expense records, not payroll/attendance), but the existing `localOrgPool.js` append-only expense-array pattern (`pool.hr_expenses = [...(pool.hr_expenses || []), newExp]`) must be followed for the new `admin_expenses` array, for consistency with `hr_expenses`/`core_expenses`.
- **No test runner exists in this repo** (no jest/vitest, no `*.test.js` files anywhere). Verification for every task is: (1) a standalone Node script using `node:assert` that replicates the new pure-function logic with fixture data (do **not** try to `import` `localOrgPool.js` directly under plain Node — it transitively imports `./localNotifications` with an extensionless specifier, which throws `ERR_MODULE_NOT_FOUND` under plain Node even though Vite resolves it fine; replicate the logic inline in the verification script instead), (2) `npx eslint <changed files>` compared against the baseline counts below, (3) `npm run build` (must succeed with zero errors).
- Lint baselines (pre-existing, unrelated to this feature — do not regress, but do not attempt to fix either): `src/services/localOrgPool.js` = 13 problems. `src/modules/ems/hr-pool/GlobalHRPoolPage.jsx` = 124 problems (this file's line count drops sharply in Task 3 since most of the flagged lines move to the new `ExpensePoolCard.jsx` file — expect a much lower count after, not a match).
- Commit convention: `feat:` / `fix:` / `docs:` / `refactor:` / `chore:` per `docs/CLAUDE.md`.

---

### Task 1: `localOrgPool.js` — `'admin'` branch in `getActiveProjectMonthlyBudgets`

**Files:**
- Modify: `hma-template/emsv1/src/services/localOrgPool.js:188-255`

**Interfaces:**
- Consumes: nothing new — reuses existing `readProjects()`, `projectValue()`, `totalProjectMonths()`, `getActivationMonth()`, `getCurrentInstallment()`, `getEffectivePoolPcts()`, `buildMonthList()`, `monthsBetween()` helpers already defined earlier in this file.
- Produces: `getActiveProjectMonthlyBudgets('admin')` — same return shape as the existing `'hr'`/`'core'` calls: `Array<{ projectId, projectName, installmentId, installmentLabel, pct, totalProjectMonths, poolBudget, monthlyBudget, budgetNotForeseen, sharePct, activationMonth, totalMonthlyPool }>`. `installmentId`/`installmentLabel`/`activationMonth` are `null` for admin rows (admin has no installment or activation concept). `computeAllocations('admin', amount, allowedProjectIds)` needs no changes — it already calls `this.getActiveProjectMonthlyBudgets(pool)` generically, so it works automatically once this task lands.

- [ ] **Step 1: Write the verification script (logic replicated, not imported)**

Create `hma-template/emsv1/scratch_verify_task1.mjs` (delete after use — not part of the app):

```js
import assert from 'node:assert'

// Replicated from the new 'admin' branch inside getActiveProjectMonthlyBudgets
function computeAdminBudget(pv, pct, tpm) {
  const monthlyBudget = pv > 0 ? Math.round(((pv * (pct / 100)) / tpm) * 100) / 100 : 0
  const poolBudget = pv > 0 ? Math.round(pv * (pct / 100) * 100) / 100 : 0
  return { monthlyBudget, poolBudget, budgetNotForeseen: pv === 0 }
}

// Project A: value 1,200,000; admin_pct 5% (default); 12 months
const a = computeAdminBudget(1200000, 5, 12)
assert.strictEqual(a.monthlyBudget, 5000)
assert.strictEqual(a.poolBudget, 60000)
assert.strictEqual(a.budgetNotForeseen, false)

// Project B: no project_value set (pv = 0) — budgetNotForeseen, zero budgets
const b = computeAdminBudget(0, 5, 12)
assert.strictEqual(b.monthlyBudget, 0)
assert.strictEqual(b.poolBudget, 0)
assert.strictEqual(b.budgetNotForeseen, true)

// Project C: custom admin_pct 8%, value 900,000, 18 months
const c = computeAdminBudget(900000, 8, 18)
assert.strictEqual(c.monthlyBudget, 4000) // 900000*0.08/18 = 4000
assert.strictEqual(c.poolBudget, 72000) // 900000*0.08 = 72000

console.log('Task 1 admin-branch math verified OK')
```

- [ ] **Step 2: Run it to confirm the math is right before touching the real file**

Run: `node hma-template/emsv1/scratch_verify_task1.mjs`
Expected: `Task 1 admin-branch math verified OK`

- [ ] **Step 3: Replace `getActiveProjectMonthlyBudgets` in the real file**

In `hma-template/emsv1/src/services/localOrgPool.js`, find the exact block starting at `getActiveProjectMonthlyBudgets(pool = 'hr') {` (line 188) through its closing `},` (line 255) — this is the entire method including its doc comment block above it (lines 181-187) should stay untouched; only replace the method body itself (188-255). Replace it with:

```js
  getActiveProjectMonthlyBudgets(pool = 'hr') {
    const todayYM = new Date().toISOString().slice(0, 7) // YYYY-MM

    const statusOk = (p) =>
      p.status === 'ongoing' || p.status === 'active' || p.status === 'approved'
    const projects = readProjects().filter((p) =>
      pool === 'admin' ? statusOk(p) : p.is_operations_active && statusOk(p),
    )

    const budgets = projects
      .map((p) => {
        if (pool === 'admin') {
          const pv = projectValue(p)
          const tpm = totalProjectMonths(p)
          const pct = p.admin_pct ?? 5
          const monthlyBudget = pv > 0 ? Math.round(((pv * (pct / 100)) / tpm) * 100) / 100 : 0
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

        // HR/Core only apply from the month the project was activated
        const activationMonth = getActivationMonth(p)
        if (!activationMonth || activationMonth > todayYM) return null

        const inst = getCurrentInstallment(p)
        if (!inst) return null

        const pv = projectValue(p)
        const tpm = totalProjectMonths(p)
        const pcts = getEffectivePoolPcts(p, todayYM)
        const pct = pool === 'core' ? pcts.core_pct : pcts.hr_pct

        // Monthly budget for this pool at today's effective %
        const monthlyBudget = pv > 0 ? Math.round(((pv * (pct / 100)) / tpm) * 100) / 100 : 0

        // Total pool budget = sum across all active months (activation → project end)
        const allMonths = buildMonthList(p.start_date, p.end_date)
        const poolBudget = allMonths.reduce((sum, month) => {
          if (month < activationMonth) return sum
          const mPcts = getEffectivePoolPcts(p, month)
          const mPct = pool === 'core' ? mPcts.core_pct : mPcts.hr_pct
          return sum + (pv > 0 ? Math.round(((pv * (mPct / 100)) / tpm) * 100) / 100 : 0)
        }, 0)

        const endField = inst.end_date || inst.target_date || ''
        const instMonths = monthsBetween(inst.start_date, endField)

        return {
          projectId: p.id,
          projectName: p.title || p.name,
          installmentId: inst.id,
          installmentLabel: inst.label,
          installmentStart: inst.start_date,
          installmentEnd: endField,
          installmentAmount: inst.amount,
          pct,
          instMonths,
          totalProjectMonths: tpm,
          poolBudget: Math.round(poolBudget * 100) / 100,
          monthlyBudget,
          budgetNotForeseen: pv === 0,
          sharePct: 0, // filled below
          activationMonth,
        }
      })
      .filter(Boolean)

    const total = budgets.reduce((s, b) => s + b.monthlyBudget, 0)
    const totalRounded = Math.round(total * 100) / 100

    return budgets.map((b) => ({
      ...b,
      sharePct: total > 0 ? Math.round((b.monthlyBudget / total) * 10000) / 100 : 0,
      totalMonthlyPool: totalRounded,
    }))
  },
```

- [ ] **Step 4: Delete the scratch verification script**

Run: `rm hma-template/emsv1/scratch_verify_task1.mjs`

- [ ] **Step 5: Lint check**

Run: `cd hma-template/emsv1 && npx eslint src/services/localOrgPool.js`
Expected: problem count at or below 13 + a small number of new Prettier-only formatting flags on the lines you just added (no new `no-undef`, `no-unused-vars`, or other logic-category rule violations — the pre-existing 13 are all Prettier formatting).

- [ ] **Step 6: Build check**

Run: `npx vite build`
Expected: build succeeds with no errors (the `'hr'`/`'core'` branches are byte-identical to before, so no existing caller of this function should behave differently).

- [ ] **Step 7: Commit**

```bash
git add hma-template/emsv1/src/services/localOrgPool.js
git commit -m "feat: add admin pool branch to getActiveProjectMonthlyBudgets"
```

---

### Task 2: `localOrgPool.js` — Admin Expense CRUD + budget summary functions

**Files:**
- Modify: `hma-template/emsv1/src/services/localOrgPool.js` — insert new methods immediately before the `computeAdminPoolAmount` method (currently at line 986; after Task 1's edit, the line number will be identical since Task 1 only replaced the method body between the same start/end lines, not the count of lines outside 188-255 — but re-locate by searching for the exact anchor text below, do not rely on the line number).

**Interfaces:**
- Consumes: `this.computeAllocations('admin', amount, allowedProjectIds)` (already generic, unchanged since Task 1 made `getActiveProjectMonthlyBudgets('admin')` work), `readPool()`/`writePool()`/`uid()` helpers already defined at the top of the file.
- Produces:
  - `getAdminExpenses()` → `Array<expense>`
  - `addAdminExpense(expense, enteredByProjectId)` → the created expense object (same shape as `addHRExpense`'s return: `{ id, label, vendor, frequency, yearly_price, amount, date, notes, bill_no, entered_by_project_id, revenue_sources, hr_revenue_pct, project_pool_pct, project_allocations, created_at }`)
  - `removeAdminExpense(expenseId)` → `void`
  - `updateAdminExpense(expenseId, data)` → `void`
  - `getAllAdminExpenses()` → `Array<expense>` (identical to `getAdminExpenses()`, kept for naming symmetry with `getAllHRExpenses`/`getAllCoreExpenses`)
  - `getMonthlyAdminPoolBudgetSummary(month)` → `{ totalMonthlyBudget, usedThisMonth, remaining }`
  - `getProjectsMonthlyAdminRemaining(month)` → `Record<projectId, { monthlyBudget, usedThisMonth, remaining }>`
  - Storage key used: `pool.admin_expenses` (new, parallel to `pool.hr_expenses`/`pool.core_expenses`).

- [ ] **Step 1: Write the verification script for the budget-summary math**

Create `hma-template/emsv1/scratch_verify_task2.mjs`:

```js
import assert from 'node:assert'

// Replicated from the new getMonthlyAdminPoolBudgetSummary(month)
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
  { projectId: 'p1', monthlyBudget: 3000, totalMonthlyPool: 5000 },
  { projectId: 'p2', monthlyBudget: 2000, totalMonthlyPool: 5000 },
]
const expenses = [
  { date: '2026-07', amount: 1000, revenue_sources: ['project_pool'], project_pool_pct: 100 },
  { date: '2026-07', amount: 2000, revenue_sources: ['hr_revenue'], project_pool_pct: 0 }, // fully HR revenue — excluded
  { date: '2026-06', amount: 5000, revenue_sources: ['project_pool'], project_pool_pct: 100 }, // wrong month — excluded
]

const summary = monthlyPoolBudgetSummary(budgets, expenses, '2026-07')
assert.strictEqual(summary.totalMonthlyBudget, 5000)
assert.strictEqual(summary.usedThisMonth, 1000)
assert.strictEqual(summary.remaining, 4000)

console.log('Task 2 budget-summary math verified OK')
```

- [ ] **Step 2: Run it**

Run: `node hma-template/emsv1/scratch_verify_task2.mjs`
Expected: `Task 2 budget-summary math verified OK`

- [ ] **Step 3: Delete the scratch script**

Run: `rm hma-template/emsv1/scratch_verify_task2.mjs`

- [ ] **Step 4: Insert the new methods into the real file**

In `hma-template/emsv1/src/services/localOrgPool.js`, find this exact line (the last line of `getAllCoreExpenses`, immediately followed by the dead admin-credit code's doc comment):

```js
  /** Returns all Core expenses in the org pool. */
  getAllCoreExpenses() {
    return readPool().core_expenses || []
  },

  /** 5% (admin_pct) of total project value — credited once, as a lump sum. */
```

Replace it with (inserting the new block between `getAllCoreExpenses` and the untouched dead-code comment):

```js
  /** Returns all Core expenses in the org pool. */
  getAllCoreExpenses() {
    return readPool().core_expenses || []
  },

  // ── Admin Expense CRUD ─────────────────────────────────────────────────────

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

  /** Returns all Admin expenses in the org pool. */
  getAllAdminExpenses() {
    return readPool().admin_expenses || []
  },

  /**
   * Returns the total monthly Admin project-pool budget across all active projects,
   * and how much has already been used (charged to project_pool) this month.
   */
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

  /** 5% (admin_pct) of total project value — credited once, as a lump sum. */
```

- [ ] **Step 5: Grep-check the storage key didn't leak a typo**

Run: `cd hma-template/emsv1 && grep -n "admin_expenses" src/services/localOrgPool.js`
Expected: exactly 8 matches — the 7 new methods that read/write `pool.admin_expenses` (`getAdminExpenses`, `addAdminExpense` read+write, `removeAdminExpense` read+write, `updateAdminExpense` read+write, `getAllAdminExpenses`), no accidental references to `hr_expenses` or `core_expenses` inside these new methods.

- [ ] **Step 6: Lint check**

Run: `npx eslint src/services/localOrgPool.js`
Expected: no new `no-undef`/`no-unused-vars`/logic-category errors — only Prettier formatting flags on the new lines, same category as the pre-existing 13.

- [ ] **Step 7: Build check**

Run: `npx vite build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add hma-template/emsv1/src/services/localOrgPool.js
git commit -m "feat: add Admin Expense CRUD and budget summary functions"
```

---

### Task 3: Extract `ExpensePoolCard.jsx` and wire HR + Admin cards into `GlobalHRPoolPage.jsx`

This is one task, not two, because the extracted component isn't meaningfully testable in isolation — `npx vite build` only type/syntax-checks files that are actually imported somewhere, so `ExpensePoolCard.jsx` only becomes verifiable once `GlobalHRPoolPage.jsx` imports and renders it. Both changes land together.

**Files:**
- Create: `hma-template/emsv1/src/modules/ems/hr-pool/ExpensePoolCard.jsx`
- Modify: `hma-template/emsv1/src/modules/ems/hr-pool/GlobalHRPoolPage.jsx` (full-file replacement — see Step 3)

**Interfaces:**
- Consumes: `localOrgPool.computeAllocations(poolType, amount, allowedProjectIds)` (direct import inside `ExpensePoolCard.jsx` — already fully generic, no wrapper needed).
- Produces: `ExpensePoolCard` (default export) — props:
  ```
  poolType: 'hr' | 'admin'
  poolLabel: string
  poolFundLabel: string
  hrRevenueTotal: number
  expenseDropdownItems: Array<{ id: string, label: string }>
  onPickExpense: (id: string) => { label?, vendor?, amount?, yearly_price? } | null
  getExpenses: () => Array<expense>
  addExpense: (expense, enteredByProjectId) => expense
  removeExpense: (id) => void
  updateExpense: (id, patch) => void
  getActiveProjects: () => Array<{ projectId, projectName, monthlyBudget, ... }>
  getPoolBudgetSummary: (month?) => { totalMonthlyBudget, usedThisMonth, remaining }
  getProjectsMonthlyRemaining: (month?) => Record<projectId, { monthlyBudget, usedThisMonth, remaining }>
  onExpenseChanged?: () => void   // optional — called after add/remove/edit succeeds, so the caller can refresh anything else on the page that depends on expense data (HR passes this to refresh ProjectHRBudgetCard; Admin has no equivalent banner in scope, so it omits this prop)
  ```

  Two deviations from the literal spec text, both necessary for correctness (caught while writing this plan, not scope creep — the spec's own Section 4 requires "HR Expense still behaves identically after extraction"):
  1. **DOM id collisions**: the spec's Section 4 doesn't mention it, but `RevenueSourceSelector`'s checkbox ids (`rev-hr`, `rev-pool`) and the project-checklist's ids (`proj-chk-${projectId}`) are hardcoded today. Once two `ExpensePoolCard` instances render on the same page simultaneously (HR + Admin), duplicate ids would break `<label htmlFor>` pairing (clicking one card's label could focus the other card's checkbox). Fixed by namespacing every id with `poolType`: `rev-hr-${poolType}`, `rev-pool-${poolType}`, `proj-chk-${poolType}-${projectId}`, `btn-add-${poolType}-expense`.
  2. **`onPickExpense` returning `undefined` for `vendor`**: the spec's generic `handleExpensePick` does `setForm((f) => ({ ...f, ...mapped }))`. When HR's mapper returns `vendor: undefined` (no vendor match in the picked expense's remarks), a plain object spread still sets the key, overwriting `form.vendor` with `undefined` and blanking whatever the user had already typed (plus a React controlled-input console warning). The original inline code avoided this by falling back to `f.vendor` in the ternary. Fixed by having `handleExpensePick` filter out `undefined` values from `mapped` before merging, so returning `vendor: undefined` means "leave whatever's already in the form," matching the original behavior exactly.
  3. **Missing budget-card refresh**: the spec's Section 5 usage doesn't wire anything to `setBudgetKey` after an HR expense add/remove/edit. Today, `handleAdd`/`handleRemove`/`handleEditSave` all call `setBudgetKey((k) => k + 1)` to force `ProjectHRBudgetCard` to remount and show the new "Allocated Charges" list immediately. After extraction, that logic lives inside `ExpensePoolCard`, which has no reference to the page's `budgetKey` state. Fixed by adding the optional `onExpenseChanged` prop above, called at the end of `handleAdd`/`handleRemove`/`handleEditSave`; the page wires it to `() => setBudgetKey((k) => k + 1)` only for the HR instance.

- [ ] **Step 1: Create `ExpensePoolCard.jsx`**

Create `hma-template/emsv1/src/modules/ems/hr-pool/ExpensePoolCard.jsx` with this exact content:

```jsx
import React, { useState, useEffect } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CButton,
  CFormInput,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilPencil, cilTrash, cilCheck } from '@coreui/icons'
import { localOrgPool } from '../../../services/localOrgPool'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : ''

// ─── Revenue Source Selector ─────────────────────────────────────────────────────

const RevenueSourceSelector = ({
  poolType,
  poolFundLabel,
  revSources,
  setRevSources,
  hrRevPct,
  setHrRevPct,
  projPoolPct,
  setProjPoolPct,
  totalAmount,
  hrRevenueTotal,
}) => {
  const hasHR = revSources.includes('hr_revenue')
  const hasPool = revSources.includes('project_pool')
  const bothSelected = hasHR && hasPool
  const total = parseFloat(totalAmount) || 0

  const toggle = (src) => {
    setRevSources((prev) => {
      if (prev.includes(src)) {
        const next = prev.filter((s) => s !== src)
        if (src === 'hr_revenue') {
          setHrRevPct(0)
          setProjPoolPct(100)
        }
        if (src === 'project_pool') {
          setProjPoolPct(0)
          setHrRevPct(100)
        }
        return next.length > 0 ? next : ['project_pool']
      }
      const next = [...prev, src]
      if (next.includes('hr_revenue') && next.includes('project_pool')) {
        setHrRevPct(50)
        setProjPoolPct(50)
      }
      return next
    })
  }

  // Change handlers — by % or by ₹ amount
  const handleHrPctChange = (val) => {
    const v = Math.max(0, Math.min(100, parseFloat(val) || 0))
    setHrRevPct(v)
    setProjPoolPct(Math.round((100 - v) * 100) / 100)
  }
  const handleHrAmtChange = (val) => {
    if (total <= 0) return
    const amt = Math.max(0, Math.min(total, parseFloat(val) || 0))
    const pct = Math.round((amt / total) * 10000) / 100
    setHrRevPct(pct)
    setProjPoolPct(Math.round((100 - pct) * 100) / 100)
  }
  const handlePoolPctChange = (val) => {
    const v = Math.max(0, Math.min(100, parseFloat(val) || 0))
    setProjPoolPct(v)
    setHrRevPct(Math.round((100 - v) * 100) / 100)
  }
  const handlePoolAmtChange = (val) => {
    if (total <= 0) return
    const amt = Math.max(0, Math.min(total, parseFloat(val) || 0))
    const pct = Math.round((amt / total) * 10000) / 100
    setProjPoolPct(pct)
    setHrRevPct(Math.round((100 - pct) * 100) / 100)
  }

  const hrAmt = total > 0 ? Math.round(total * (hrRevPct / 100) * 100) / 100 : 0
  const poolAmt = total > 0 ? Math.round(total * (projPoolPct / 100) * 100) / 100 : 0
  const totalPct = Math.round((hrRevPct + projPoolPct) * 100) / 100
  const pctValid = !bothSelected || totalPct === 100

  const rowStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '10px 14px',
  }

  return (
    <div
      className="rounded-3 p-3 mb-3"
      style={{
        background: 'rgba(6,214,160,0.06)',
        border: '1px solid rgba(6,214,160,0.25)',
        fontSize: '0.85rem',
      }}
    >
      <div className="fw-semibold text-body mb-2" style={{ fontSize: '0.82rem' }}>
        Revenue Source
      </div>

      <div className="d-flex flex-column gap-2">
        {/* ─ HR Revenue row ─ */}
        <div style={rowStyle}>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <input
              type="checkbox"
              id={`rev-hr-${poolType}`}
              checked={hasHR}
              onChange={() => toggle('hr_revenue')}
              style={{ accentColor: '#4cc9f0', width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
            />
            <label
              htmlFor={`rev-hr-${poolType}`}
              className="mb-0 fw-semibold"
              style={{ cursor: 'pointer', color: '#4cc9f0', minWidth: 96 }}
            >
              HR Revenue
            </label>
            {hasHR && bothSelected && (
              <>
                {/* % field */}
                <CInputGroup size="sm" style={{ width: 90 }}>
                  <CFormInput
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={hrRevPct}
                    onChange={(e) => handleHrPctChange(e.target.value)}
                    style={{ textAlign: 'right', fontWeight: 600 }}
                  />
                  <CInputGroupText style={{ fontWeight: 600, fontSize: '0.8rem' }}>%</CInputGroupText>
                </CInputGroup>
                {/* ₹ amount field */}
                <CInputGroup size="sm" style={{ width: 120 }}>
                  <CInputGroupText style={{ fontSize: '0.8rem' }}>&#8377;</CInputGroupText>
                  <CFormInput
                    type="number"
                    min="0"
                    value={hrAmt || ''}
                    placeholder="Amount"
                    onChange={(e) => handleHrAmtChange(e.target.value)}
                    style={{ textAlign: 'right' }}
                  />
                </CInputGroup>
                {total > 0 && (
                  <span className="text-body-secondary" style={{ fontSize: '0.73rem' }}>
                    of {fmt(total)}
                  </span>
                )}
              </>
            )}
            {hasHR && !bothSelected && total > 0 && (
              <span className="text-body-secondary ms-auto" style={{ fontSize: '0.78rem' }}>
                100% — {fmt(total)}
              </span>
            )}
          </div>
          {hasHR &&
            (() => {
              const drawn = bothSelected ? hrAmt : total
              const remaining = (hrRevenueTotal || 0) - drawn
              const isOver = remaining < 0
              return (
                <div
                  className={`small mt-1 ${isOver ? 'text-danger fw-semibold' : 'text-body-secondary'}`}
                  style={{ fontSize: '0.74rem' }}
                >
                  Available: {fmt(hrRevenueTotal || 0)} &nbsp;−{fmt(drawn)} this expense &nbsp;→&nbsp;
                  {fmt(remaining)} remaining
                </div>
              )
            })()}
        </div>

        {/* ─ Project Pool row ─ */}
        <div style={rowStyle}>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <input
              type="checkbox"
              id={`rev-pool-${poolType}`}
              checked={hasPool}
              onChange={() => toggle('project_pool')}
              style={{ accentColor: '#06d6a0', width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
            />
            <label
              htmlFor={`rev-pool-${poolType}`}
              className="mb-0 fw-semibold"
              style={{ cursor: 'pointer', color: '#06d6a0', minWidth: 96 }}
            >
              {poolFundLabel}
            </label>
            {hasPool && bothSelected && (
              <>
                <CInputGroup size="sm" style={{ width: 90 }}>
                  <CFormInput
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={projPoolPct}
                    onChange={(e) => handlePoolPctChange(e.target.value)}
                    style={{ textAlign: 'right', fontWeight: 600 }}
                  />
                  <CInputGroupText style={{ fontWeight: 600, fontSize: '0.8rem' }}>%</CInputGroupText>
                </CInputGroup>
                <CInputGroup size="sm" style={{ width: 120 }}>
                  <CInputGroupText style={{ fontSize: '0.8rem' }}>&#8377;</CInputGroupText>
                  <CFormInput
                    type="number"
                    min="0"
                    value={poolAmt || ''}
                    placeholder="Amount"
                    onChange={(e) => handlePoolAmtChange(e.target.value)}
                    style={{ textAlign: 'right' }}
                  />
                </CInputGroup>
                {total > 0 && (
                  <span className="text-body-secondary" style={{ fontSize: '0.73rem' }}>
                    of {fmt(total)}
                  </span>
                )}
              </>
            )}
            {hasPool && !bothSelected && total > 0 && (
              <span className="text-body-secondary ms-auto" style={{ fontSize: '0.78rem' }}>
                100% — {fmt(total)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Validation message */}
      {bothSelected && (
        <div
          className={`small mt-2 d-flex align-items-center gap-2 ${pctValid ? 'text-success' : 'text-danger'}`}
          style={{ fontSize: '0.74rem' }}
        >
          {pctValid ? (
            <>
              <CIcon icon={cilCheck} style={{ width: 12, height: 12 }} />
              Percentages sum to 100% — HR Revenue: {hrRevPct}% · Project Pool: {projPoolPct}%
            </>
          ) : (
            <>&#9888; Percentages must sum to 100% (currently {totalPct}%)</>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Expense Pool Card (shared HR / Admin expense-adding card) ────────────────

const ExpensePoolCard = ({
  poolType,
  poolLabel,
  poolFundLabel,
  hrRevenueTotal,
  expenseDropdownItems,
  onPickExpense,
  getExpenses,
  addExpense,
  removeExpense,
  updateExpense,
  getActiveProjects,
  getPoolBudgetSummary,
  getProjectsMonthlyRemaining,
  onExpenseChanged,
}) => {
  const [form, setForm] = useState({
    vendor: '',
    label: '',
    frequency: 'Monthly',
    yearly_price: '',
    amount: '',
    expenseMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
    notes: '',
    bill_no: '',
  })
  // Revenue source state for the add form
  const [revSources, setRevSources] = useState(['project_pool'])
  const [hrRevPct, setHrRevPct] = useState(0)
  const [projPoolPct, setProjPoolPct] = useState(100)

  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [allExpenses, setAllExpenses] = useState([])
  const [previewAllocs, setPreviewAllocs] = useState([])
  const [customAllocs, setCustomAllocs] = useState(null) // null = use auto previewAllocs
  const [draftAmounts, setDraftAmounts] = useState({}) // projectId -> string being typed
  const [activeProjects, setActiveProjects] = useState([])
  const [selectedProjectIds, setSelectedProjectIds] = useState([])
  const [poolBudgetSummary, setPoolBudgetSummary] = useState({
    totalMonthlyBudget: 0,
    usedThisMonth: 0,
    remaining: 0,
  })
  const [projectRemainingMap, setProjectRemainingMap] = useState({})

  const reload = () => {
    setAllExpenses(getExpenses())
    const ap = getActiveProjects()
    setActiveProjects(ap)
    setSelectedProjectIds(ap.map((p) => p.projectId))
    setPoolBudgetSummary(getPoolBudgetSummary())
    setProjectRemainingMap(getProjectsMonthlyRemaining())
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetAddForm = () => {
    setForm({
      vendor: '',
      label: '',
      frequency: 'Monthly',
      yearly_price: '',
      amount: '',
      expenseMonth: new Date().toISOString().slice(0, 7),
      notes: '',
      bill_no: '',
    })
    setRevSources(['project_pool'])
    setHrRevPct(0)
    setProjPoolPct(100)
    setPreviewAllocs([])
    setCustomAllocs(null)
    setDraftAmounts({})
    setSelectedProjectIds(activeProjects.map((p) => p.projectId))
  }

  const handleExpensePick = (expenseId) => {
    if (!expenseId) return
    const mapped = onPickExpense(expenseId)
    if (!mapped) return
    setForm((f) => {
      const next = { ...f }
      for (const [k, v] of Object.entries(mapped)) {
        if (v !== undefined) next[k] = v
      }
      return next
    })
  }

  const toggleSelectedProject = (projectId) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId],
    )
  }

  // Refresh month-scoped budget figures when selected month changes
  useEffect(() => {
    setPoolBudgetSummary(getPoolBudgetSummary(form.expenseMonth))
    setProjectRemainingMap(getProjectsMonthlyRemaining(form.expenseMonth))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.expenseMonth, allExpenses])

  // Live allocation preview — recomputes whenever amount, pool%, or source changes
  useEffect(() => {
    const amt = parseFloat(form.amount) || 0
    const hasPool = revSources.includes('project_pool')
    if (amt > 0 && hasPool) {
      const poolAmt = Math.round(amt * (projPoolPct / 100) * 100) / 100
      const computed = localOrgPool.computeAllocations(poolType, poolAmt, selectedProjectIds)
      setPreviewAllocs(computed)
      setCustomAllocs(null) // reset custom overrides when base changes
      setDraftAmounts({}) // clear drafts when base recalculates
    } else {
      setPreviewAllocs([])
      setCustomAllocs(null)
      setDraftAmounts({})
    }
  }, [form.amount, projPoolPct, revSources, selectedProjectIds, poolType])

  // Displayed allocations: use custom if user has edited, else auto
  const displayAllocs = customAllocs ?? previewAllocs

  /**
   * When user edits one project's %, redistribute the remaining (100 - newPct)%
   * proportionally across all other projects.
   */
  const handleAllocPctChange = (projectId, newPct) => {
    const base = customAllocs ?? previewAllocs
    if (!base.length) return
    const clamped = Math.max(0, Math.min(100, parseFloat(newPct) || 0))
    const others = base.filter((a) => a.projectId !== projectId)
    const othersTotal = others.reduce((s, a) => s + a.sharePct, 0)
    const remaining = 100 - clamped
    const totalAmt = parseFloat(form.amount) || 0
    const poolAmt = Math.round(totalAmt * (projPoolPct / 100) * 100) / 100

    const updated = base.map((a) => {
      if (a.projectId === projectId) {
        return {
          ...a,
          sharePct: clamped,
          amountCharged: Math.round(poolAmt * (clamped / 100) * 100) / 100,
        }
      }
      const weight = othersTotal > 0 ? a.sharePct / othersTotal : 1 / others.length
      const pct = Math.round(remaining * weight * 100) / 100
      return {
        ...a,
        sharePct: pct,
        amountCharged: Math.round(poolAmt * (pct / 100) * 100) / 100,
      }
    })
    setCustomAllocs(updated)
  }

  /**
   * Commit the draft ₹ amount for one project, recalculate its %,
   * and redistribute the remaining % proportionally across other projects.
   */
  const handleRecalculate = (projectId) => {
    const base = customAllocs ?? previewAllocs
    if (!base.length) return
    const totalAmt = parseFloat(form.amount) || 0
    const poolAmt = Math.round(totalAmt * (projPoolPct / 100) * 100) / 100
    if (poolAmt <= 0) return

    const enteredAmt = parseFloat(draftAmounts[projectId] ?? '')
    if (isNaN(enteredAmt)) return

    const clampedAmt = Math.max(0, Math.min(poolAmt, enteredAmt))
    const newPct = Math.round((clampedAmt / poolAmt) * 10000) / 100

    const others = base.filter((a) => a.projectId !== projectId)
    const othersTotal = others.reduce((s, a) => s + a.sharePct, 0)
    const remaining = 100 - newPct

    const updated = base.map((a) => {
      if (a.projectId === projectId) {
        return { ...a, sharePct: newPct, amountCharged: clampedAmt }
      }
      const weight = othersTotal > 0 ? a.sharePct / othersTotal : 1 / others.length
      const pct = Math.round(remaining * weight * 100) / 100
      return { ...a, sharePct: pct, amountCharged: Math.round(poolAmt * (pct / 100) * 100) / 100 }
    })
    setCustomAllocs(updated)
    // Clear the draft for this project so the input shows the committed value
    setDraftAmounts((d) => {
      const next = { ...d }
      delete next[projectId]
      return next
    })
  }

  const handleYearlyPriceChange = (val, isEdit = false) => {
    const yp = parseFloat(val) || 0
    const mc = yp > 0 ? (yp / 12).toFixed(2) : ''
    if (isEdit) {
      setEditForm((f) => ({ ...f, yearly_price: val, amount: mc }))
    } else {
      setForm((f) => ({ ...f, yearly_price: val, amount: mc }))
    }
  }

  const handleMonthlyCutChange = (val, isEdit = false) => {
    const mc = parseFloat(val) || 0
    const yp = mc > 0 ? (mc * 12).toFixed(2) : ''
    if (isEdit) {
      setEditForm((f) => ({ ...f, amount: val, yearly_price: yp }))
    } else {
      setForm((f) => ({ ...f, amount: val, yearly_price: yp }))
    }
  }

  const isSplitValid = () => {
    const hasHR = revSources.includes('hr_revenue')
    const hasPool = revSources.includes('project_pool')
    if (hasHR && hasPool) {
      return Math.round((hrRevPct + projPoolPct) * 100) / 100 === 100
    }
    return true
  }

  const handleAdd = () => {
    if (!form.label || !form.amount) return
    if (!isSplitValid()) return
    const allocsToSave = customAllocs ?? previewAllocs
    addExpense(
      {
        ...form,
        date: form.expenseMonth, // store as YYYY-MM for month-based filtering
        revenue_sources: revSources,
        hr_revenue_pct: hrRevPct,
        project_pool_pct: projPoolPct,
        project_allocations: allocsToSave.length > 0 ? allocsToSave : undefined,
      },
      'global',
    )
    resetAddForm()
    setAdding(false)
    reload()
    if (onExpenseChanged) onExpenseChanged()
  }

  const handleRemove = (id) => {
    removeExpense(id)
    reload()
    if (onExpenseChanged) onExpenseChanged()
  }

  const handleEditSave = () => {
    updateExpense(editId, editForm)
    setEditId(null)
    reload()
    if (onExpenseChanged) onExpenseChanged()
  }

  const hasPool = revSources.includes('project_pool')

  return (
    <CCard className="shadow-sm border-top border-4 border-top-success mb-4">
      <CCardHeader className="bg-transparent fw-semibold pt-3 d-flex justify-content-between align-items-center">
        <span>Manage Organization-Wide {poolLabel} Expenses</span>
        <CBadge color="success" shape="rounded-pill">
          {allExpenses.length} Total Expenses
        </CBadge>
      </CCardHeader>
      <CCardBody>
        {adding ? (
          <div className="border rounded p-3 bg-body-secondary mb-4">
            <h6 className="fw-semibold mb-3 d-flex align-items-center gap-2">
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#06d6a0',
                  flexShrink: 0,
                }}
              >
                <CIcon icon={cilCheck} style={{ width: 12, height: 12, color: '#fff' }} />
              </span>
              Add New {poolLabel} Expense
            </h6>
            <CRow className="g-2 mb-2">
              <CCol xs={12} md={6}>
                <CFormSelect size="sm" onChange={(e) => handleExpensePick(e.target.value)} defaultValue="">
                  <option value="">— Select an expense (optional) —</option>
                  {expenseDropdownItems.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
            </CRow>
            <CRow className="g-2 mb-2">
              <CCol xs={12} md={3}>
                <CFormInput
                  size="sm"
                  placeholder="Vendor / Payee *"
                  value={form.vendor}
                  onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
                />
              </CCol>
              <CCol xs={12} md={3}>
                <CFormInput
                  size="sm"
                  placeholder="Category / Description *"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                />
              </CCol>
              <CCol xs={12} md={2}>
                <CFormSelect
                  size="sm"
                  value={form.frequency}
                  onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Yearly">Yearly</option>
                  <option value="One-time">One-time</option>
                </CFormSelect>
              </CCol>
              <CCol xs={6} md={2}>
                <CInputGroup size="sm">
                  <CInputGroupText>₹</CInputGroupText>
                  <CFormInput
                    type="number"
                    min="0"
                    placeholder="Yearly Price"
                    value={form.yearly_price}
                    onChange={(e) => handleYearlyPriceChange(e.target.value, false)}
                  />
                </CInputGroup>
              </CCol>
              <CCol xs={6} md={2}>
                <CInputGroup size="sm">
                  <CInputGroupText>₹</CInputGroupText>
                  <CFormInput
                    type="number"
                    min="0"
                    placeholder="Monthly Cut *"
                    value={form.amount}
                    onChange={(e) => handleMonthlyCutChange(e.target.value, false)}
                  />
                </CInputGroup>
              </CCol>
            </CRow>

            <CRow className="g-2 mb-2">
              <CCol xs={12} md={4}>
                <CFormInput
                  size="sm"
                  placeholder="Bill No (optional)"
                  value={form.bill_no}
                  onChange={(e) => setForm((f) => ({ ...f, bill_no: e.target.value }))}
                />
              </CCol>
            </CRow>

            {/* ── Revenue Source Selector ── */}
            <RevenueSourceSelector
              poolType={poolType}
              poolFundLabel={poolFundLabel}
              revSources={revSources}
              setRevSources={setRevSources}
              hrRevPct={hrRevPct}
              setHrRevPct={setHrRevPct}
              projPoolPct={projPoolPct}
              setProjPoolPct={setProjPoolPct}
              totalAmount={form.amount}
              hrRevenueTotal={hrRevenueTotal}
            />

            {/* ── Budget Cap Alert — always-rendered wrapper prevents layout shift ── */}
            {hasPool &&
              (() => {
                const totalAmt = parseFloat(form.amount) || 0
                const poolPortion = Math.round(totalAmt * (projPoolPct / 100) * 100) / 100
                const { totalMonthlyBudget, usedThisMonth, remaining } = poolBudgetSummary

                if (totalAmt <= 0 || totalMonthlyBudget <= 0)
                  return <div className="mb-3" style={{ minHeight: 0 }} />

                const overage = Math.round((poolPortion - remaining) * 100) / 100
                const pctUsed = Math.round((poolPortion / totalMonthlyBudget) * 100)
                const isOver = overage > 0
                const isWarn = !isOver && poolPortion >= remaining * 0.8

                if (!isOver && !isWarn) return <div className="mb-3" style={{ minHeight: 0 }} />

                if (!isOver)
                  return (
                    <div
                      className="mb-3 p-2 rounded d-flex align-items-center gap-2"
                      style={{
                        background: 'rgba(255,193,7,0.1)',
                        border: '1px solid rgba(255,193,7,0.35)',
                        fontSize: '0.78rem',
                      }}
                    >
                      <span style={{ fontSize: '1rem' }}>&#9889;</span>
                      <span className="text-warning">
                        This expense will use <strong>{fmt(poolPortion)}</strong> of the{' '}
                        <strong>{fmt(remaining)}</strong> remaining monthly pool budget ({pctUsed}%).
                      </span>
                    </div>
                  )

                return (
                  <div
                    className="mb-3 p-3 rounded"
                    style={{
                      background: 'rgba(220,53,69,0.12)',
                      border: '1.5px solid rgba(220,53,69,0.5)',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div className="d-flex align-items-center gap-2 fw-bold text-danger mb-1">
                      <span style={{ fontSize: '1.05rem' }}>&#128683;</span>
                      Project Pool budget exceeded for this month
                    </div>
                    <div
                      className="d-flex flex-wrap gap-3 mt-1"
                      style={{ fontSize: '0.77rem', color: 'rgba(255,255,255,0.75)' }}
                    >
                      <span>
                        Monthly budget: <strong className="text-body">{fmt(totalMonthlyBudget)}</strong>
                      </span>
                      <span>
                        Already used: <strong className="text-body">{fmt(usedThisMonth)}</strong>
                      </span>
                      <span>
                        Remaining: <strong className="text-warning">{fmt(remaining)}</strong>
                      </span>
                      <span>
                        This expense (pool portion): <strong className="text-danger">{fmt(poolPortion)}</strong>
                      </span>
                      <span>
                        Overage: <strong className="text-danger">+{fmt(overage)}</strong>
                      </span>
                    </div>
                    <div className="mt-2 small text-body-secondary" style={{ fontSize: '0.73rem' }}>
                      Reduce the expense amount, reduce the {poolFundLabel} %, or route more to HR Revenue to
                      stay within budget.
                    </div>
                  </div>
                )
              })()}

            {/* ── Project Checklist — choose which active projects this expense applies to ── */}
            {hasPool && (
              <div className="mb-3 p-3 rounded border" style={{ fontSize: '0.85rem' }}>
                <div className="fw-semibold mb-2" style={{ fontSize: '0.82rem' }}>
                  Apply to Projects
                </div>
                {activeProjects.length === 0 ? (
                  <div className="text-body-secondary small">No active projects in the pool.</div>
                ) : (
                  <div className="d-flex flex-column gap-1">
                    {activeProjects.map((p) => (
                      <div key={p.projectId} className="d-flex align-items-center gap-2">
                        <input
                          type="checkbox"
                          id={`proj-chk-${poolType}-${p.projectId}`}
                          checked={selectedProjectIds.includes(p.projectId)}
                          onChange={() => toggleSelectedProject(p.projectId)}
                          style={{ width: 15, height: 15, cursor: 'pointer' }}
                        />
                        <label htmlFor={`proj-chk-${poolType}-${p.projectId}`} className="mb-0" style={{ cursor: 'pointer' }}>
                          {p.projectName}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                {activeProjects.length > 0 && selectedProjectIds.length === 0 && (
                  <div className="text-danger small mt-2">
                    Select at least one project, or remove {poolFundLabel} as a revenue source.
                  </div>
                )}
              </div>
            )}

            {/* ── Allocation Preview (editable) ── */}
            {hasPool && displayAllocs.length > 0 && (
              <div
                className="mb-3 p-3 rounded bg-success bg-opacity-10 border border-success"
                style={{ fontSize: '0.85rem' }}
              >
                <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
                  <div className="fw-semibold text-success">
                    Allocation Preview Across Active Projects
                    {revSources.includes('hr_revenue') && revSources.includes('project_pool') && (
                      <span className="text-body-secondary fw-normal ms-2" style={{ fontSize: '0.75rem' }}>
                        ({poolFundLabel} portion: {projPoolPct}% of total amount)
                      </span>
                    )}
                  </div>
                  {customAllocs && (
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 text-warning"
                      style={{ fontSize: '0.73rem', textDecoration: 'underline' }}
                      onClick={() => setCustomAllocs(null)}
                    >
                      ↺ Reset to auto
                    </button>
                  )}
                </div>
                {/* Editable project rows */}
                <div className="d-flex flex-column gap-2">
                  {displayAllocs.map((a) => {
                    const totalPct = displayAllocs.reduce((s, x) => s + x.sharePct, 0)
                    const pctValid = Math.abs(totalPct - 100) < 0.5
                    return (
                      <div
                        key={a.projectId}
                        className="d-flex align-items-center gap-2 bg-body-secondary rounded border px-3 py-2"
                        style={{ fontSize: '0.83rem' }}
                      >
                        {/* Project name + remaining badge */}
                        <div className="d-flex flex-column" style={{ minWidth: 0, flex: '1 1 0' }}>
                          <span className="fw-medium text-truncate" title={a.projectName}>
                            {a.projectName}
                          </span>
                          {(() => {
                            const rem = projectRemainingMap[a.projectId]
                            if (!rem) return null
                            const isOver = rem.remaining < 0
                            const isTight = !isOver && rem.monthlyBudget > 0 && rem.remaining < rem.monthlyBudget * 0.2
                            const color = isOver ? '#ff6b6b' : isTight ? '#f4a261' : '#06d6a0'
                            return (
                              <span style={{ fontSize: '0.68rem', color, marginTop: 1 }}>
                                Monthly budget: {fmt(rem.monthlyBudget)} • Remaining:{' '}
                                <strong style={{ color }}>{fmt(rem.remaining)}</strong>
                              </span>
                            )
                          })()}
                        </div>

                        {/* % badge + input */}
                        <div className="d-flex align-items-center gap-1" style={{ flexShrink: 0 }}>
                          <span
                            className="rounded-2 px-2 py-1 fw-bold"
                            style={{
                              background: pctValid ? 'rgba(6,214,160,0.15)' : 'rgba(255,107,107,0.15)',
                              color: pctValid ? '#06d6a0' : '#ff6b6b',
                              fontSize: '0.8rem',
                              minWidth: 54,
                              textAlign: 'center',
                              lineHeight: 1.4,
                            }}
                          >
                            {a.sharePct % 1 === 0 ? a.sharePct : parseFloat(a.sharePct).toFixed(2)}%
                          </span>
                          <CInputGroup size="sm" style={{ width: 80 }}>
                            <CFormInput
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={a.sharePct % 1 === 0 ? a.sharePct : parseFloat(a.sharePct).toFixed(2)}
                              onChange={(e) => handleAllocPctChange(a.projectId, e.target.value)}
                              onWheel={(e) => e.currentTarget.blur()}
                              style={{ textAlign: 'right', fontWeight: 600, padding: '3px 6px', fontSize: '0.8rem' }}
                              title="Edit % for this project"
                            />
                            <CInputGroupText style={{ fontSize: '0.75rem', padding: '3px 5px' }}>%</CInputGroupText>
                          </CInputGroup>
                        </div>

                        {/* ₹ Amount input with Recalculate */}
                        {(() => {
                          const draftVal = draftAmounts[a.projectId]
                          const isDraft = draftVal !== undefined && draftVal !== String(a.amountCharged)
                          return (
                            <div className="d-flex align-items-center gap-1" style={{ flexShrink: 0 }}>
                              <CInputGroup size="sm" style={{ width: 130 }}>
                                <CInputGroupText style={{ fontSize: '0.78rem', padding: '3px 6px' }}>
                                  &#8377;
                                </CInputGroupText>
                                <CFormInput
                                  type="number"
                                  min="0"
                                  value={draftVal !== undefined ? draftVal : a.amountCharged}
                                  onChange={(e) => {
                                    setDraftAmounts((d) => ({ ...d, [a.projectId]: e.target.value }))
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRecalculate(a.projectId)
                                  }}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  style={{
                                    textAlign: 'right',
                                    fontWeight: 600,
                                    padding: '3px 6px',
                                    fontSize: '0.8rem',
                                    borderColor: isDraft ? '#f4a261' : undefined,
                                  }}
                                  title="Type an amount then click Recalculate"
                                />
                              </CInputGroup>
                              {isDraft && (
                                <CButton
                                  size="sm"
                                  color="warning"
                                  variant="outline"
                                  style={{ padding: '2px 8px', fontSize: '0.72rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                                  onClick={() => handleRecalculate(a.projectId)}
                                  title="Recalculate distribution based on this amount"
                                >
                                  ↺ Recalc
                                </CButton>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}
                </div>
                {/* Total check */}
                {(() => {
                  const total = displayAllocs.reduce((s, a) => s + a.sharePct, 0)
                  const diff = Math.abs(total - 100)
                  return diff > 0.5 ? (
                    <div className="text-danger small mt-2" style={{ fontSize: '0.73rem' }}>
                      ⚠ Percentages sum to {Math.round(total * 100) / 100}% — must equal 100%
                    </div>
                  ) : (
                    <div className="text-success small mt-2" style={{ fontSize: '0.73rem' }}>
                      ✓ Total: {Math.round(total * 100) / 100}%{customAllocs ? ' (custom weights)' : ' (auto)'}
                    </div>
                  )
                })()}
              </div>
            )}

            {!hasPool && (
              <div
                className="mb-3 p-2 rounded border border-info"
                style={{ background: 'rgba(76,201,240,0.07)', fontSize: '0.8rem' }}
              >
                <span className="text-info">
                  This expense will be fully covered by HR Revenue — no project allocation will be distributed.
                </span>
              </div>
            )}

            <div className="d-flex gap-2">
              <CButton
                size="sm"
                color="success"
                onClick={handleAdd}
                disabled={
                  !form.label ||
                  !form.amount ||
                  !isSplitValid() ||
                  (hasPool && activeProjects.length > 0 && selectedProjectIds.length === 0) ||
                  (displayAllocs.length > 0 &&
                    Math.abs(displayAllocs.reduce((s, a) => s + a.sharePct, 0) - 100) > 0.5) ||
                  (() => {
                    if (!hasPool) return false
                    const totalAmt = parseFloat(form.amount) || 0
                    const poolPortion = Math.round(totalAmt * (projPoolPct / 100) * 100) / 100
                    return poolBudgetSummary.totalMonthlyBudget > 0 && poolPortion > poolBudgetSummary.remaining
                  })()
                }
              >
                Add &amp; Distribute Expense
              </CButton>
              <CButton
                size="sm"
                color="secondary"
                variant="ghost"
                onClick={() => {
                  setAdding(false)
                  resetAddForm()
                }}
              >
                Cancel
              </CButton>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <CButton size="sm" color="success" onClick={() => setAdding(true)} id={`btn-add-${poolType}-expense`}>
              <CIcon icon={cilPlus} className="me-1" />
              Add New {poolLabel} Expense
            </CButton>
          </div>
        )}

        {allExpenses.length === 0 ? (
          <div className="text-center text-body-tertiary small py-4 bg-light rounded border border-dashed">
            No {poolLabel} expenses recorded yet.
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {allExpenses.map((exp) =>
              editId === exp.id ? (
                <div key={exp.id} className="border rounded p-3 bg-body-secondary shadow-sm">
                  <CRow className="g-2 mb-2">
                    <CCol xs={12} md={5}>
                      <CFormInput
                        size="sm"
                        placeholder="Label"
                        value={editForm.label}
                        onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                      />
                    </CCol>
                    <CCol xs={6} md={3}>
                      <CInputGroup size="sm">
                        <CInputGroupText>₹</CInputGroupText>
                        <CFormInput
                          type="number"
                          value={editForm.amount}
                          onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                        />
                      </CInputGroup>
                    </CCol>
                    <CCol xs={6} md={4}>
                      <CFormInput
                        size="sm"
                        type="date"
                        value={editForm.date}
                        onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                      />
                    </CCol>
                  </CRow>
                  <div className="d-flex gap-2 mt-2">
                    <CButton size="sm" color="primary" onClick={handleEditSave}>
                      Save Changes
                    </CButton>
                    <CButton size="sm" color="secondary" variant="ghost" onClick={() => setEditId(null)}>
                      Cancel
                    </CButton>
                  </div>
                </div>
              ) : (
                <div
                  key={exp.id}
                  className="d-flex align-items-center justify-content-between border rounded px-3 py-3 shadow-sm"
                >
                  <div>
                    <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                      <span className="fw-semibold fs-6">{exp.label}</span>
                      {/* Revenue source tags */}
                      {exp.revenue_sources?.includes('hr_revenue') && (
                        <CBadge color="info" shape="rounded-pill" style={{ fontSize: '0.65rem' }}>
                          HR Revenue
                          {exp.revenue_sources?.includes('project_pool') ? ` ${exp.hr_revenue_pct}%` : ''}
                        </CBadge>
                      )}
                      {exp.revenue_sources?.includes('project_pool') && (
                        <CBadge color="success" shape="rounded-pill" style={{ fontSize: '0.65rem' }}>
                          {poolFundLabel}
                          {exp.revenue_sources?.includes('hr_revenue') ? ` ${exp.project_pool_pct}%` : ''}
                        </CBadge>
                      )}
                    </div>
                    <div className="text-body-secondary small mb-1">
                      {fmtDate(exp.date)} {exp.notes && ` · ${exp.notes}`}
                      {exp.bill_no && ` · Bill #${exp.bill_no}`}
                    </div>
                    <div className="text-body-tertiary" style={{ fontSize: '0.8rem' }}>
                      Distributed across {exp.allocations?.length || exp.project_allocations?.length || 0} active
                      project(s)
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-4">
                    <div className="text-end">
                      <div className="text-body-secondary small">Total Amount</div>
                      <div className="fw-bold fs-5 text-success">{fmt(exp.amount)}</div>
                    </div>
                    <div className="d-flex gap-1 border-start ps-3">
                      <CButton
                        color="secondary"
                        variant="ghost"
                        size="sm"
                        title="Edit Expense"
                        onClick={() => {
                          setEditId(exp.id)
                          setEditForm({ ...exp })
                        }}
                      >
                        <CIcon icon={cilPencil} />
                      </CButton>
                      <CButton
                        color="danger"
                        variant="ghost"
                        size="sm"
                        title="Remove Expense"
                        onClick={() => handleRemove(exp.id)}
                      >
                        <CIcon icon={cilTrash} />
                      </CButton>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

export default ExpensePoolCard
```

- [ ] **Step 2: Confirm nothing else in the repo imports the pieces you just moved out of `GlobalHRPoolPage.jsx`**

Run: `cd hma-template/emsv1 && grep -rn "GlobalHRPoolPage" src --include=*.jsx -l`
Expected: only the route/nav files that import the page component itself (e.g. `routes.js`/`_nav.js` or an EMS routes file) — nothing imports `RevenueSourceSelector` or any of the form-handler function names directly, confirming it's safe to remove them from `GlobalHRPoolPage.jsx` in the next step.

- [ ] **Step 3: Replace the entire contents of `GlobalHRPoolPage.jsx`**

Replace the full contents of `hma-template/emsv1/src/modules/ems/hr-pool/GlobalHRPoolPage.jsx` with:

```jsx
import React, { useState, useEffect } from 'react'
import { CCard, CCardBody, CRow, CCol, CButton, CFormInput, CFormSelect, CInputGroup, CInputGroupText, CBadge } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPencil, cilDollar, cilChartPie, cilCheckAlt, cilX } from '@coreui/icons'
import { localOrgPool } from '../../../services/localOrgPool'
import { localGeneralExpenses } from '../../../services/localGeneralExpenses'
import { localAdminExpenses } from '../../../services/localAdminExpenses'
import { localRecruitments } from '../../../services/localRecruitments'
import { localInternships } from '../../../services/localInternships'
import ExpensePoolCard from './ExpensePoolCard'

// Outsourced Services — same category DivisionsSummary.jsx treats as the HR division.
const HR_DIVISION_CATEGORY_ID = 'cat-00000000-0012'

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const fmtL = (n) => {
  if (!n && n !== 0) return '—'
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)} L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)} K`
  return `₹${Math.round(n)}`
}

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : ''

// ─── Inline Allocation Editor (per charge row in budget card) ─────────────────

const AllocationEditor = ({ charge, onSave, onCancel }) => {
  const [pct, setPct] = useState(String(charge.mySharePct ?? 0))
  const [amt, setAmt] = useState(String(charge.myAmount ?? 0))
  const total = parseFloat(charge.amount) || 0

  const handlePctChange = (val) => {
    setPct(val)
    const p = parseFloat(val) || 0
    setAmt(String(Math.round(total * (p / 100) * 100) / 100))
  }

  const handleAmtChange = (val) => {
    setAmt(val)
    const a = parseFloat(val) || 0
    setPct(String(total > 0 ? Math.round((a / total) * 10000) / 100 : 0))
  }

  const handleSave = () => {
    const newPct = parseFloat(pct) || 0
    if (newPct < 0 || newPct > 100) return
    onSave(newPct)
  }

  return (
    <div
      className="rounded-3 p-3 mt-2 mb-1"
      style={{
        background: 'rgba(79,172,254,0.08)',
        border: '1px solid rgba(79,172,254,0.3)',
        animation: 'fadeSlideIn 0.18s ease',
      }}
    >
      <div className="text-white-50 small fw-semibold mb-2" style={{ fontSize: '0.72rem' }}>
        Edit allocation for <span className="text-white">{charge.label}</span>
      </div>
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <CInputGroup size="sm" style={{ maxWidth: 120 }}>
          <CFormInput
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={pct}
            onChange={(e) => handlePctChange(e.target.value)}
            style={{ textAlign: 'right', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
          />
          <CInputGroupText style={{ background: 'rgba(255,255,255,0.1)', color: '#aaa', border: '1px solid rgba(255,255,255,0.2)' }}>%</CInputGroupText>
        </CInputGroup>
        <span className="text-white-50 small">or</span>
        <CInputGroup size="sm" style={{ maxWidth: 140 }}>
          <CInputGroupText style={{ background: 'rgba(255,255,255,0.1)', color: '#aaa', border: '1px solid rgba(255,255,255,0.2)' }}>₹</CInputGroupText>
          <CFormInput
            type="number"
            min="0"
            value={amt}
            onChange={(e) => handleAmtChange(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
          />
        </CInputGroup>
        <div className="d-flex gap-1 ms-auto">
          <CButton
            size="sm"
            color="success"
            onClick={handleSave}
            style={{ minWidth: 64, fontSize: '0.75rem' }}
          >
            <CIcon icon={cilCheckAlt} className="me-1" style={{ width: 12, height: 12 }} />
            Save
          </CButton>
          <CButton
            size="sm"
            color="secondary"
            variant="ghost"
            onClick={onCancel}
            style={{ fontSize: '0.75rem' }}
          >
            <CIcon icon={cilX} style={{ width: 12, height: 12 }} />
          </CButton>
        </div>
      </div>
      <div className="text-white-50 mt-2" style={{ fontSize: '0.68rem' }}>
        Other projects will be redistributed proportionally to make up the remaining %.
        {charge.hasCustomAllocation && (
          <span className="text-warning ms-2">Custom allocation active</span>
        )}
      </div>
    </div>
  )
}

// ─── Project HR Budget Banner ─────────────────────────────────────────────────

const ProjectHRBudgetCard = ({ projectId, projects, onAllocationEdited }) => {
  const [editingCharge, setEditingCharge] = useState(null) // { expenseId, charge }
  const [charges, setCharges] = useState([])
  const [summary, setSummary] = useState(null)

  const reloadCharges = () => {
    if (!projectId) return
    setCharges(localOrgPool.getProjectHRCharges(projectId))
    setSummary(localOrgPool.getProjectHRBudgetSummary(projectId))
  }

  useEffect(() => {
    setEditingCharge(null)
    reloadCharges()
  }, [projectId])

  if (!projectId) return null

  const project = projects.find((p) => p.projectId === projectId)

  if (!summary) return null

  if (!summary.isActive && charges.length === 0) {
    return (
      <div className="p-3 rounded border bg-body-secondary text-body-secondary small text-center mb-4">
        This project is not currently active in the HR pool.
      </div>
    )
  }

  const usedPct =
    summary.poolBudget > 0
      ? Math.min(100, Math.round((summary.totalCharged / summary.poolBudget) * 100))
      : 0
  const isOver = summary.remaining < 0
  const remainingColor = isOver ? 'danger' : usedPct > 85 ? 'warning' : 'success'

  const handleSaveAllocation = (expenseId, newPct) => {
    localOrgPool.updateExpenseProjectAllocation(expenseId, projectId, newPct)
    setEditingCharge(null)
    reloadCharges()
    if (onAllocationEdited) onAllocationEdited()
  }

  return (
    <CCard
      className="mb-4 shadow-sm border-0"
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      <CCardBody className="p-4">
        {/* Header row */}
        <div className="d-flex align-items-start justify-content-between mb-4 flex-wrap gap-3">
          <div>
            <div className="text-white-50 small fw-semibold text-uppercase mb-1" style={{ letterSpacing: '0.08em' }}>
              HR Pool Budget — Monthly View
            </div>
            <div className="text-white fw-bold fs-5">{project?.projectName || 'Selected Project'}</div>
            <div className="text-white-50 small mt-1">
              Share: <span className="text-white fw-semibold">{summary.sharePct?.toFixed(1) || 0}%</span>
              {' '}of org-wide pool &nbsp;·&nbsp;
              {summary.activeProjectCount} active project{summary.activeProjectCount !== 1 ? 's' : ''}
            </div>
          </div>
          <CBadge
            color={summary.isActive ? 'success' : 'secondary'}
            shape="rounded-pill"
            className="px-3 py-2"
          >
            {summary.isActive ? 'Active in Pool' : 'Inactive'}
          </CBadge>
        </div>

        {/* Three metric cards */}
        <CRow className="g-3 mb-4">
          {[
            {
              label: 'Monthly HR Budget',
              value: fmtL(summary.monthlyBudget),
              sub: `Pool: ${fmtL(summary.poolBudget)} / installment`,
              icon: cilDollar,
              accent: '#4facfe',
            },
            {
              label: 'Amount Used',
              value: fmtL(summary.totalCharged),
              sub: `${charges.length} expense record${charges.length !== 1 ? 's' : ''}`,
              icon: cilChartPie,
              accent: isOver ? '#ff6b6b' : '#ffd166',
            },
            {
              label: 'Remaining',
              value: fmtL(Math.abs(summary.remaining)),
              sub: isOver ? 'Over budget!' : `${100 - usedPct}% remaining`,
              icon: cilDollar,
              accent: isOver ? '#ff6b6b' : '#06d6a0',
              prefix: isOver ? '−' : '',
            },
          ].map((m) => (
            <CCol key={m.label} xs={12} md={4}>
              <div
                className="rounded-3 p-3 h-100"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: `1px solid rgba(255,255,255,0.1)`,
                  backdropFilter: 'blur(10px)',
                }}
              >
                <div
                  className="d-flex align-items-center gap-2 mb-2"
                  style={{ color: m.accent }}
                >
                  <CIcon icon={m.icon} size="sm" />
                  <span className="small fw-semibold text-uppercase" style={{ letterSpacing: '0.06em', fontSize: '0.7rem' }}>
                    {m.label}
                  </span>
                </div>
                <div className="fw-bold text-white" style={{ fontSize: '1.6rem', lineHeight: 1.1 }}>
                  {m.prefix || ''}{m.value}
                </div>
                <div className="text-white-50" style={{ fontSize: '0.75rem', marginTop: 4 }}>
                  {m.sub}
                </div>
              </div>
            </CCol>
          ))}
        </CRow>

        {/* Progress bar */}
        <div>
          <div className="d-flex justify-content-between text-white-50 small mb-2">
            <span>Budget utilization</span>
            <span className={isOver ? 'text-danger fw-bold' : 'text-white fw-semibold'}>
              {usedPct}% used {isOver && '(Over budget!)'}
            </span>
          </div>
          <div
            className="rounded-pill overflow-hidden"
            style={{ height: 10, background: 'rgba(255,255,255,0.12)' }}
          >
            <div
              className="rounded-pill h-100"
              style={{
                width: `${Math.min(100, usedPct)}%`,
                background: isOver
                  ? '#ff6b6b'
                  : usedPct > 85
                  ? 'linear-gradient(90deg,#ffd166,#ff9f43)'
                  : 'linear-gradient(90deg,#4facfe,#06d6a0)',
                transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
              }}
            />
          </div>
        </div>

        {/* Breakdown of charges — clickable project names */}
        {charges.length > 0 && (
          <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="text-white-50 small fw-semibold text-uppercase" style={{ letterSpacing: '0.06em' }}>
                Allocated Charges
              </div>
              <div className="text-white-50" style={{ fontSize: '0.65rem' }}>
                Click a charge name to edit its allocation for this project
              </div>
            </div>
            <div className="d-flex flex-column gap-1">
              {charges.map((c) => (
                <div key={c.id}>
                  <div
                    className="d-flex justify-content-between align-items-center rounded-2 px-2 py-1"
                    style={{
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      background:
                        editingCharge?.expenseId === c.id
                          ? 'rgba(79,172,254,0.12)'
                          : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (editingCharge?.expenseId !== c.id)
                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                    }}
                    onMouseLeave={(e) => {
                      if (editingCharge?.expenseId !== c.id)
                        e.currentTarget.style.background = 'transparent'
                    }}
                    onClick={() => {
                      if (editingCharge?.expenseId === c.id) {
                        setEditingCharge(null)
                      } else {
                        setEditingCharge({ expenseId: c.id, charge: c })
                      }
                    }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-white fw-medium">{c.label}</span>
                      {c.date && (
                        <span className="text-white-50 ms-1">{fmtDate(c.date)}</span>
                      )}
                      <CBadge
                        color={c.hasCustomAllocation ? 'warning' : 'secondary'}
                        className="ms-1"
                        style={{ fontSize: '0.62rem', opacity: 0.85 }}
                      >
                        {c.mySharePct?.toFixed(1)}% share
                      </CBadge>
                      {c.hasCustomAllocation && (
                        <CBadge color="warning" style={{ fontSize: '0.58rem' }}>custom</CBadge>
                      )}
                      {/* Revenue source tags */}
                      {c.revenue_sources?.includes('hr_revenue') && (
                        <CBadge color="info" style={{ fontSize: '0.58rem' }}>
                          HR Rev · {c.hr_revenue_type || ''}
                        </CBadge>
                      )}
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-white fw-semibold">{fmt(c.myAmount)}</span>
                      <CIcon
                        icon={cilPencil}
                        style={{
                          width: 12,
                          height: 12,
                          color: editingCharge?.expenseId === c.id ? '#4facfe' : 'rgba(255,255,255,0.3)',
                          transition: 'color 0.15s',
                        }}
                      />
                    </div>
                  </div>

                  {editingCharge?.expenseId === c.id && (
                    <AllocationEditor
                      charge={c}
                      onSave={(newPct) => handleSaveAllocation(c.id, newPct)}
                      onCancel={() => setEditingCharge(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const GlobalHRPoolPage = () => {
  const hrRevenueTotal = (() => {
    const recruitmentRevenue = localRecruitments
      .list({ activity_type: 'recruitment' })
      .reduce((s, r) => s + (r.amount_received || 0), 0)
    const trainingRevenue = localRecruitments
      .list({ activity_type: 'training' })
      .reduce((s, r) => s + (r.amount_received || 0), 0)
    const internshipRevenue = localInternships
      .list()
      .reduce((s, r) => s + (r.amount_received || 0), 0)
    return recruitmentRevenue + trainingRevenue + internshipRevenue
  })()

  const [hrGeneralExpenses, setHrGeneralExpenses] = useState([])
  const [adminExpenseItems, setAdminExpenseItems] = useState([])
  const [activeProjects, setActiveProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
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
    setSelectedProjectId((prev) => prev || (ap[0]?.projectId ?? ''))
  }

  useEffect(() => {
    reload()
  }, [])

  return (
    <>
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h4 className="mb-1 fw-bold">Global HR Expense Pool</h4>
          <p className="text-body-secondary mb-0 small">
            Organisation-wide HR expenses distributed across projects.
          </p>
        </div>
      </div>

      {/* ── Project Selector + Budget Banner ─────────────────────────────────── */}
      <CCard className="shadow-sm mb-3 border-0 bg-body-secondary">
        <CCardBody className="py-3 px-4">
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <CIcon icon={cilChartPie} className="text-primary" style={{ width: 20, height: 20, flexShrink: 0 }} />
            <div className="fw-semibold text-nowrap">View Project HR Budget:</div>
            <CFormSelect
              size="sm"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              style={{ maxWidth: 380, minWidth: 220 }}
            >
              <option value="">— Select a project —</option>
              {activeProjects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.projectName}
                </option>
              ))}
            </CFormSelect>
            {activeProjects.length === 0 && (
              <span className="text-body-secondary small">No active projects in the HR pool yet.</span>
            )}
          </div>
        </CCardBody>
      </CCard>

      <ProjectHRBudgetCard
        key={budgetKey}
        projectId={selectedProjectId}
        projects={activeProjects}
        onAllocationEdited={() => setBudgetKey((k) => k + 1)}
      />

      {/* ── HR Expense Pool Card ─────────────────────────────────────────────── */}
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
        onExpenseChanged={() => setBudgetKey((k) => k + 1)}
      />

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

export default GlobalHRPoolPage
```

- [ ] **Step 4: Lint check both files**

Run: `npx eslint src/modules/ems/hr-pool/ExpensePoolCard.jsx src/modules/ems/hr-pool/GlobalHRPoolPage.jsx`
Expected: no `no-undef`, `no-unused-vars`, `react-hooks/rules-of-hooks`, or `react/jsx-key` errors (these would indicate a real bug in the extraction — e.g. a leftover reference to `localGeneralExpenses` inside `ExpensePoolCard.jsx`, or a missing `key` prop). Prettier-only formatting flags are fine and expected (same pre-existing-style debt as the rest of the codebase).

- [ ] **Step 5: Build check**

Run: `npx vite build`
Expected: build succeeds with zero errors. This is the critical gate for this task — it will catch any leftover reference to a removed variable/function (e.g. if `hasPool`, `previewAllocs`, or any other moved identifier is still referenced somewhere in `GlobalHRPoolPage.jsx`), any missing import, or a JSX syntax mistake in the new `ExpensePoolCard.jsx`.

- [ ] **Step 6: Structural grep checks**

Run: `grep -c "ExpensePoolCard" src/modules/ems/hr-pool/GlobalHRPoolPage.jsx`
Expected: `3` (1 import line + 2 JSX usages).

Run: `grep -c "RevenueSourceSelector" src/modules/ems/hr-pool/GlobalHRPoolPage.jsx`
Expected: `0` (fully moved into `ExpensePoolCard.jsx`).

Run: `grep -c "const RevenueSourceSelector" src/modules/ems/hr-pool/ExpensePoolCard.jsx`
Expected: `1`.

- [ ] **Step 7: Manual smoke check in the dev server (no automated browser tooling available this session)**

Run: `npm start` (from `hma-template/emsv1/`), then in a browser:
1. Navigate to the Global HR Pool page.
2. Confirm the "View Project HR Budget" selector and gradient budget banner still render exactly as before.
3. Confirm there are now two cards below it: "Manage Organization-Wide HR Expenses" and "Manage Organization-Wide Admin Expenses".
4. Click "Add New HR Expense", confirm the form, revenue-source selector, project checklist, and allocation preview all still work exactly as before (this is the "verify HR still behaves identically" check called for by the spec).
5. Click "Add New Admin Expense", confirm its expense dropdown is populated from Admin Expenses (vendor/category names like "Contract Vehicle — Manjith Travels"), not HR's General Expenses list.
6. Add one small test Admin expense, confirm it appears in the "Manage Organization-Wide Admin Expenses" list with the correct amount, then remove it (cleanup).
7. Stop the dev server (`Ctrl+C`) once confirmed.

Report back what was observed instead of claiming this was verified if the manual check wasn't actually run.

- [ ] **Step 8: Commit**

```bash
git add hma-template/emsv1/src/modules/ems/hr-pool/ExpensePoolCard.jsx hma-template/emsv1/src/modules/ems/hr-pool/GlobalHRPoolPage.jsx
git commit -m "refactor: extract ExpensePoolCard component and add Admin Expense card to Global HR Pool"
```

---

## Post-plan cleanup

None needed — no scaffolding, feature flags, or temporary code paths are introduced. The dead `computeAdminPoolAmount`/`recordAdminCredit`/`getAdminPoolCredits` functions remain untouched at the bottom of `localOrgPool.js`, exactly as decided in the spec's non-goals.
