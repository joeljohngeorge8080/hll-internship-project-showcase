# Expense Pool: LSGB Revenue + Core's Admin 5% Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "LSGB Revenue" as a third revenue-source option on all three Expense Pool cards (HR, Admin, Core), and a fourth, Core-only "Admin 5% Share" source that performs a real cross-pool deduction against Admin's own monthly budget.

**Architecture:** Generalize `ExpensePoolCard.jsx`'s hardcoded 2-source revenue selector (`RevenueSourceSelector`) into an N-source model driven by a single `pctBySource` state object, reusing the file's existing proportional-redistribution algorithm (already used for splitting one expense across projects) for the revenue-source-percentage axis too. Extract the existing "Budget Cap Alert" block into a reusable `BudgetCapAlert` component so Core's new Admin-Share row can reuse the same over-budget warning the Project Pool row already has. `localOrgPool.js` gains two new persisted fields (`lsgb_revenue_pct`, `admin_share_pct`) and Admin's own budget-summary functions are extended to also scan Core's expenses for the cross-pool draw.

**Tech Stack:** React 19 (function components + hooks), CoreUI React components, `localStorage`-backed services. No test runner is configured in this repo — verification is `npm run build` + `npm run lint` plus manual browser verification via the dev server (matching this repo's established convention).

## Global Constraints

- LSGB Revenue is informational only (like the existing HR Revenue) — its `lsgb_revenue_pct` is persisted but never read back for any budget calculation.
- Admin 5% Share is Core-card-only — HR and Admin cards must never render or accept the `admin_pool` source.
- Admin 5% Share has **no per-project allocation breakdown** — it's a flat monthly draw against Admin's aggregate remaining budget, not split per-project like Project Pool is.
- Editing an already-created expense stays untouched (`editForm` only ever sets `label`/`amount`/`date` — this plan does not change that).
- Every percentage split (2, 3, or 4 sources selected) must sum to exactly 100 after rounding — reuse the existing rounding-remainder-fix pattern, don't introduce off-by-0.01 sums.

---

## File Structure

- **Modify:** `src/services/localOrgPool.js` — `addHRExpense`/`addAdminExpense`/`addCoreExpense` persist `lsgb_revenue_pct`; `addCoreExpense` additionally persists `admin_share_pct` and accepts `'admin_pool'` in `revenue_sources`; `getMonthlyAdminPoolBudgetSummary`/`getProjectsMonthlyAdminRemaining` also scan `getCoreExpenses()` for `admin_pool`-tagged entries.
- **Rewrite (full file):** `src/modules/ems/hr-pool/ExpensePoolCard.jsx` — generalized `RevenueSourceSelector` (2→4 sources), new `BudgetCapAlert` component (extracted, reused twice), `ExpensePoolCard` state/handlers updated to match.
- **Modify:** `src/modules/ems/hr-pool/GlobalHRPoolPage.jsx` — thread `lsgbAvailable` to all three `ExpensePoolCard` instances, `getAdminPoolBudgetSummary` to the Core instance only; add an "LSGB Rev" badge to the existing per-project "Allocated Charges" list; fix the now-stale "unrelated to Core 5% pool math" comment.

---

## Task 1: `localOrgPool.js` — persist the two new percentage fields, extend Admin's budget scan to Core

**Files:**
- Modify: `src/services/localOrgPool.js`

**Interfaces:**
- Produces: `addHRExpense`/`addAdminExpense`/`addCoreExpense` now accept an optional `expense.lsgb_revenue_pct` (number, defaults `0`), persisted as `lsgb_revenue_pct` on the new record.
- Produces: `addCoreExpense` additionally accepts an optional `expense.admin_share_pct` (number, defaults `0`), persisted as `admin_share_pct`; `'admin_pool'` becomes a valid member of `expense.revenue_sources` for Core expenses only (no validation enforced here — the UI in Task 2/3 is what restricts this to Core).
- Produces: `getMonthlyAdminPoolBudgetSummary(month)` and `getProjectsMonthlyAdminRemaining(month)` now also count Core expenses tagged `admin_pool` against Admin's own budget — no change to their call signature or return shape, existing callers (`GlobalHRPoolPage.jsx`'s Admin `ExpensePoolCard` instance) are unaffected.

- [ ] **Step 1: Add `lsgb_revenue_pct` to `addHRExpense`**

Change (`src/services/localOrgPool.js`):
```js
  addHRExpense(expense, enteredByProjectId) {
    const pool = readPool()
    const totalAmt = parseFloat(expense.amount) || 0

    // Determine revenue sources
    const revenueSources = expense.revenue_sources || ['project_pool']
    const projectPoolPct = parseFloat(expense.project_pool_pct) ?? 100
    const hrRevenuePct = parseFloat(expense.hr_revenue_pct) ?? 0

    // Use caller-provided allocations (user-edited) if present, else auto-compute
    let allocations
    if (expense.project_allocations && expense.project_allocations.length > 0) {
      allocations = expense.project_allocations
    } else {
      const projectPoolAmt = Math.round(totalAmt * (projectPoolPct / 100) * 100) / 100
      allocations = revenueSources.includes('project_pool')
        ? this.computeAllocations('hr', projectPoolAmt)
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
      // Revenue source metadata
      revenue_sources: revenueSources,
      hr_revenue_pct: hrRevenuePct,
      project_pool_pct: projectPoolPct,
      // Project allocations — may be user-customised or auto-computed
      project_allocations: allocations,
      created_at: new Date().toISOString(),
    }
    pool.hr_expenses = [...(pool.hr_expenses || []), newExp]
    writePool(pool)
    setTimeout(() => this.checkHRBudgetThresholds(), 100)
```
to:
```js
  addHRExpense(expense, enteredByProjectId) {
    const pool = readPool()
    const totalAmt = parseFloat(expense.amount) || 0

    // Determine revenue sources
    const revenueSources = expense.revenue_sources || ['project_pool']
    const projectPoolPct = parseFloat(expense.project_pool_pct) ?? 100
    const hrRevenuePct = parseFloat(expense.hr_revenue_pct) ?? 0
    const lsgbRevenuePct = parseFloat(expense.lsgb_revenue_pct) || 0

    // Use caller-provided allocations (user-edited) if present, else auto-compute
    let allocations
    if (expense.project_allocations && expense.project_allocations.length > 0) {
      allocations = expense.project_allocations
    } else {
      const projectPoolAmt = Math.round(totalAmt * (projectPoolPct / 100) * 100) / 100
      allocations = revenueSources.includes('project_pool')
        ? this.computeAllocations('hr', projectPoolAmt)
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
      // Revenue source metadata
      revenue_sources: revenueSources,
      hr_revenue_pct: hrRevenuePct,
      lsgb_revenue_pct: lsgbRevenuePct,
      project_pool_pct: projectPoolPct,
      // Project allocations — may be user-customised or auto-computed
      project_allocations: allocations,
      created_at: new Date().toISOString(),
    }
    pool.hr_expenses = [...(pool.hr_expenses || []), newExp]
    writePool(pool)
    setTimeout(() => this.checkHRBudgetThresholds(), 100)
```

- [ ] **Step 2: Add `lsgb_revenue_pct` to `addAdminExpense`**

Change:
```js
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
```
to:
```js
  addAdminExpense(expense, enteredByProjectId) {
    const pool = readPool()
    const totalAmt = parseFloat(expense.amount) || 0

    const revenueSources = expense.revenue_sources || ['project_pool']
    const projectPoolPct = parseFloat(expense.project_pool_pct) ?? 100
    const hrRevenuePct = parseFloat(expense.hr_revenue_pct) ?? 0
    const lsgbRevenuePct = parseFloat(expense.lsgb_revenue_pct) || 0

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
      lsgb_revenue_pct: lsgbRevenuePct,
      project_pool_pct: projectPoolPct,
      project_allocations: allocations,
      created_at: new Date().toISOString(),
    }
    pool.admin_expenses = [...(pool.admin_expenses || []), newExp]
    writePool(pool)
    return newExp
  },
```

- [ ] **Step 3: Add `lsgb_revenue_pct` and `admin_share_pct` to `addCoreExpense`**

Change:
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
to:
```js
  addCoreExpense(expense, enteredByProjectId) {
    const pool = readPool()
    const totalAmt = parseFloat(expense.amount) || 0

    const revenueSources = expense.revenue_sources || ['project_pool']
    const projectPoolPct = parseFloat(expense.project_pool_pct) ?? 100
    const hrRevenuePct = parseFloat(expense.hr_revenue_pct) ?? 0
    const lsgbRevenuePct = parseFloat(expense.lsgb_revenue_pct) || 0
    // Admin 5% Share — Core-only source, a real draw against Admin's own
    // monthly budget (see getMonthlyAdminPoolBudgetSummary below), not just
    // an attribution tag like HR/LSGB Revenue.
    const adminSharePct = parseFloat(expense.admin_share_pct) || 0

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
      lsgb_revenue_pct: lsgbRevenuePct,
      admin_share_pct: adminSharePct,
      project_pool_pct: projectPoolPct,
      project_allocations: allocations,
      created_at: new Date().toISOString(),
    }
    pool.core_expenses = [...(pool.core_expenses || []), newExp]
    writePool(pool)
    return newExp
  },
```

- [ ] **Step 4: Extend `getMonthlyAdminPoolBudgetSummary` to also count Core's Admin-Share draws**

Change:
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
```
to:
```js
  getMonthlyAdminPoolBudgetSummary(month) {
    const budgets = this.getActiveProjectMonthlyBudgets('admin')
    const totalMonthlyBudget = budgets.length > 0 ? (budgets[0].totalMonthlyPool ?? 0) : 0

    const expenses = this.getAdminExpenses()
    const targetMonth = month || new Date().toISOString().slice(0, 7)

    const usedFromAdminExpenses = expenses
      .filter((e) => (e.date ? e.date.slice(0, 7) : targetMonth) === targetMonth)
      .reduce((sum, e) => {
        const sources = e.revenue_sources || ['project_pool']
        if (!sources.includes('project_pool')) return sum
        const poolPct = parseFloat(e.project_pool_pct) ?? 100
        const totalAmt = parseFloat(e.amount) || 0
        return sum + Math.round(totalAmt * (poolPct / 100) * 100) / 100
      }, 0)

    // Core expenses can draw on the Admin pool too ("Admin 5% Share") — a
    // real cross-pool deduction, so it counts against Admin's own budget
    // the same as Admin's own project_pool spend does.
    const usedFromCoreExpenses = this.getCoreExpenses()
      .filter((e) => (e.date ? e.date.slice(0, 7) : targetMonth) === targetMonth)
      .reduce((sum, e) => {
        const sources = e.revenue_sources || []
        if (!sources.includes('admin_pool')) return sum
        const sharePct = parseFloat(e.admin_share_pct) || 0
        const totalAmt = parseFloat(e.amount) || 0
        return sum + Math.round(totalAmt * (sharePct / 100) * 100) / 100
      }, 0)

    const usedThisMonth = usedFromAdminExpenses + usedFromCoreExpenses

    return {
      totalMonthlyBudget: Math.round(totalMonthlyBudget * 100) / 100,
      usedThisMonth: Math.round(usedThisMonth * 100) / 100,
      remaining: Math.round((totalMonthlyBudget - usedThisMonth) * 100) / 100,
    }
  },
```

- [ ] **Step 5: Extend `getProjectsMonthlyAdminRemaining` the same way**

Change:
```js
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
          usedMap[b.projectId] =
            (usedMap[b.projectId] || 0) + Math.round(poolAmt * share * 100) / 100
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
to:
```js
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
          usedMap[b.projectId] =
            (usedMap[b.projectId] || 0) + Math.round(poolAmt * share * 100) / 100
        }
      }
    }

    // Core expenses tagged "Admin 5% Share" draw on this same budget. There's
    // no per-project allocation stored for this source (flat aggregate draw
    // only — see design spec), so distribute proportionally across Admin's
    // active projects by their monthly-budget share, same fallback used above
    // for a plain Admin expense with no project_allocations of its own.
    const coreExpenses = this.getCoreExpenses()
    const totalBudget = budgets.reduce((s, b) => s + b.monthlyBudget, 0)
    for (const exp of coreExpenses) {
      const eMonth = exp.date ? exp.date.slice(0, 7) : targetMonth
      if (eMonth !== targetMonth) continue
      const sources = exp.revenue_sources || []
      if (!sources.includes('admin_pool')) continue

      const sharePct = parseFloat(exp.admin_share_pct) || 0
      const shareAmt = (parseFloat(exp.amount) || 0) * (sharePct / 100)
      for (const b of budgets) {
        const share = totalBudget > 0 ? b.monthlyBudget / totalBudget : 0
        usedMap[b.projectId] =
          (usedMap[b.projectId] || 0) + Math.round(shareAmt * share * 100) / 100
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

- [ ] **Step 6: Verify build**

Run: `npm_config_prefix=<scratch-npm-prefix-dir> npm run build` (from `hma-template/emsv1/`)
Expected: clean build, no errors.

- [ ] **Step 7: Commit**

```bash
git add src/services/localOrgPool.js
git commit -m "feat: persist LSGB Revenue and Admin 5% Share fields, cross-pool budget scan"
```

---

## Task 2: Rewrite `ExpensePoolCard.jsx` — generalize the revenue-source selector to N sources

**Files:**
- Modify (full-file rewrite): `src/modules/ems/hr-pool/ExpensePoolCard.jsx`

**Interfaces:**
- Consumes: `localOrgPool.computeAllocations` (unchanged, already imported).
- Produces: `ExpensePoolCard` gains three new optional props: `lsgbAvailable` (number, all instances), `getAdminPoolBudgetSummary` (function `(month) => {totalMonthlyBudget, usedThisMonth, remaining}`, Core instance only — its mere presence is what turns on the 4th "Admin 5% Share" source; HR/Admin instances simply don't pass it).
- Produces: `RevenueSourceSelector` and the new `BudgetCapAlert` are internal to this file (not exported) — same as `RevenueSourceSelector` is today.

This task replaces the entire file. Write the following complete content to `src/modules/ems/hr-pool/ExpensePoolCard.jsx`:

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
// Generalized over however many sources a given pool card offers: HR and
// Admin cards offer 3 (hr_revenue, project_pool, lsgb_revenue); Core offers a
// 4th (admin_pool) via showAdminShare. `pctBySource` holds one percentage per
// source key; toggling or editing any source redistributes the rest so the
// selected sources always sum to exactly 100.
const RevenueSourceSelector = ({
  poolType,
  poolFundLabel,
  revSources,
  setRevSources,
  pctBySource,
  setPctBySource,
  totalAmount,
  hrRevenueTotal,
  lsgbAvailable,
  showAdminShare,
}) => {
  const total = parseFloat(totalAmount) || 0
  const availableSources = [
    'hr_revenue',
    'project_pool',
    'lsgb_revenue',
    ...(showAdminShare ? ['admin_pool'] : []),
  ]
  const multiSelected = revSources.length >= 2

  const SOURCE_LABELS = {
    hr_revenue: 'HR Revenue',
    project_pool: poolFundLabel,
    lsgb_revenue: 'LSGB Revenue',
    admin_pool: 'Admin 5% Share',
  }
  const SOURCE_COLORS = {
    hr_revenue: '#4cc9f0',
    project_pool: '#06d6a0',
    lsgb_revenue: '#f77f00',
    admin_pool: '#7209b7',
  }

  const toggle = (src) => {
    setRevSources((prev) => {
      const isRemoving = prev.includes(src)
      const next = isRemoving ? prev.filter((s) => s !== src) : [...prev, src]
      const finalNext = next.length > 0 ? next : ['project_pool']
      // Evenly split 100% across whatever ends up selected — matches this
      // selector's original 2-source behaviour (single = 100%, two = 50/50),
      // generalised to however many are selected, with the rounding
      // remainder given to the first selected source so the total is always
      // exactly 100.
      const evenBase = Math.floor((100 / finalNext.length) * 100) / 100
      const remainder = Math.round((100 - evenBase * finalNext.length) * 100) / 100
      const nextPct = {}
      availableSources.forEach((s) => {
        nextPct[s] = 0
      })
      finalNext.forEach((s, i) => {
        nextPct[s] = i === 0 ? Math.round((evenBase + remainder) * 100) / 100 : evenBase
      })
      setPctBySource(nextPct)
      return finalNext
    })
  }

  // Redistribute the remaining percentage proportionally across the other
  // currently-selected sources — the same algorithm this file already uses
  // to split one expense across multiple projects (see ExpensePoolCard's
  // handleAllocPctChange), applied here to the revenue-source axis.
  const handlePctChange = (src, val) => {
    const v = Math.max(0, Math.min(100, parseFloat(val) || 0))
    const others = revSources.filter((s) => s !== src)
    const remaining = Math.round((100 - v) * 100) / 100
    const othersTotal = others.reduce((s, k) => s + (pctBySource[k] || 0), 0)

    const next = { ...pctBySource, [src]: v }
    others.forEach((k) => {
      const weight = othersTotal > 0 ? (pctBySource[k] || 0) / othersTotal : 1 / others.length
      next[k] = Math.round(remaining * weight * 100) / 100
    })
    if (others.length > 0) {
      const last = others[others.length - 1]
      const sumExceptLast = v + others.slice(0, -1).reduce((s, k) => s + next[k], 0)
      next[last] = Math.round((100 - sumExceptLast) * 100) / 100
    }
    setPctBySource(next)
  }

  const handleAmtChange = (src, val) => {
    if (total <= 0) return
    const amt = Math.max(0, Math.min(total, parseFloat(val) || 0))
    const pct = Math.round((amt / total) * 10000) / 100
    handlePctChange(src, pct)
  }

  const totalPct =
    Math.round(revSources.reduce((s, k) => s + (pctBySource[k] || 0), 0) * 100) / 100
  const pctValid = !multiSelected || totalPct === 100

  const rowStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '10px 14px',
  }

  const renderRow = (src, availableTotal) => {
    const label = SOURCE_LABELS[src]
    const color = SOURCE_COLORS[src]
    const checked = revSources.includes(src)
    const pct = pctBySource[src] || 0
    const amt = total > 0 ? Math.round(total * (pct / 100) * 100) / 100 : 0

    return (
      <div key={src} style={rowStyle}>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <input
            type="checkbox"
            id={`rev-${src}-${poolType}`}
            checked={checked}
            onChange={() => toggle(src)}
            style={{ accentColor: color, width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
          />
          <label
            htmlFor={`rev-${src}-${poolType}`}
            className="mb-0 fw-semibold"
            style={{ cursor: 'pointer', color, minWidth: 96 }}
          >
            {label}
          </label>
          {checked && multiSelected && (
            <>
              <CInputGroup size="sm" style={{ width: 90 }}>
                <CFormInput
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={pct}
                  onChange={(e) => handlePctChange(src, e.target.value)}
                  style={{ textAlign: 'right', fontWeight: 600 }}
                />
                <CInputGroupText style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                  %
                </CInputGroupText>
              </CInputGroup>
              <CInputGroup size="sm" style={{ width: 120 }}>
                <CInputGroupText style={{ fontSize: '0.8rem' }}>&#8377;</CInputGroupText>
                <CFormInput
                  type="number"
                  min="0"
                  value={amt || ''}
                  placeholder="Amount"
                  onChange={(e) => handleAmtChange(src, e.target.value)}
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
          {checked && !multiSelected && total > 0 && (
            <span className="text-body-secondary ms-auto" style={{ fontSize: '0.78rem' }}>
              100% — {fmt(total)}
            </span>
          )}
        </div>
        {checked &&
          availableTotal !== undefined &&
          (() => {
            const drawn = multiSelected ? amt : total
            const remaining = (availableTotal || 0) - drawn
            const isOver = remaining < 0
            return (
              <div
                className={`small mt-1 ${isOver ? 'text-danger fw-semibold' : 'text-body-secondary'}`}
                style={{ fontSize: '0.74rem' }}
              >
                Available: {fmt(availableTotal || 0)} &nbsp;−{fmt(drawn)} this expense
                &nbsp;→&nbsp;
                {fmt(remaining)} remaining
              </div>
            )
          })()}
      </div>
    )
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
        {renderRow('hr_revenue', hrRevenueTotal)}
        {renderRow('project_pool', undefined)}
        {renderRow('lsgb_revenue', lsgbAvailable)}
        {showAdminShare && renderRow('admin_pool', undefined)}
      </div>

      {/* Validation message */}
      {multiSelected && (
        <div
          className={`small mt-2 d-flex align-items-center gap-2 ${pctValid ? 'text-success' : 'text-danger'}`}
          style={{ fontSize: '0.74rem' }}
        >
          {pctValid ? (
            <>
              <CIcon icon={cilCheck} style={{ width: 12, height: 12 }} />
              Percentages sum to 100% —{' '}
              {revSources.map((s) => `${SOURCE_LABELS[s]}: ${pctBySource[s] || 0}%`).join(' · ')}
            </>
          ) : (
            <>&#9888; Percentages must sum to 100% (currently {totalPct}%)</>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Budget Cap Alert ──────────────────────────────────────────────────────────
// Shared by the Project Pool row (every card) and the Admin 5% Share row
// (Core only) — both are real budget-capped draws, unlike HR/LSGB Revenue
// which are informational-only checks shown inline in RevenueSourceSelector.
const BudgetCapAlert = ({ label, totalAmt, poolPortion, budgetSummary }) => {
  const { totalMonthlyBudget, usedThisMonth, remaining } = budgetSummary

  if (totalAmt <= 0 || totalMonthlyBudget <= 0) return <div className="mb-3" style={{ minHeight: 0 }} />

  const overage = Math.round((poolPortion - remaining) * 100) / 100
  const pctUsed = Math.round((poolPortion / totalMonthlyBudget) * 100)
  const isOver = overage > 0
  const isWarn = !isOver && poolPortion >= remaining * 0.8

  if (!isOver && !isWarn) return <div className="mb-3" style={{ minHeight: 0 }} />

  if (!isOver) {
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
          <strong>{fmt(remaining)}</strong> remaining monthly {label} budget ({pctUsed}%).
        </span>
      </div>
    )
  }

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
        {label} budget exceeded for this month
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
          This expense ({label} portion): <strong className="text-danger">{fmt(poolPortion)}</strong>
        </span>
        <span>
          Overage: <strong className="text-danger">+{fmt(overage)}</strong>
        </span>
      </div>
      <div className="mt-2 small text-body-secondary" style={{ fontSize: '0.73rem' }}>
        Reduce the expense amount, reduce the {label} %, or route more to another revenue source
        to stay within budget.
      </div>
    </div>
  )
}

// ─── Expense Pool Card (shared HR / Admin / Core expense-adding card) ─────────

const ExpensePoolCard = ({
  poolType,
  poolLabel,
  poolFundLabel,
  hrRevenueTotal,
  lsgbAvailable,
  getAdminPoolBudgetSummary,
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
  const showAdminShare = Boolean(getAdminPoolBudgetSummary)

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
  const [pctBySource, setPctBySource] = useState({
    hr_revenue: 0,
    project_pool: 100,
    lsgb_revenue: 0,
    admin_pool: 0,
  })

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
  const [adminPoolBudgetSummary, setAdminPoolBudgetSummary] = useState({
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
    if (getAdminPoolBudgetSummary) setAdminPoolBudgetSummary(getAdminPoolBudgetSummary())
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
    setPctBySource({ hr_revenue: 0, project_pool: 100, lsgb_revenue: 0, admin_pool: 0 })
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
    if (getAdminPoolBudgetSummary) {
      setAdminPoolBudgetSummary(getAdminPoolBudgetSummary(form.expenseMonth))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.expenseMonth, allExpenses])

  // Live allocation preview — recomputes whenever amount, pool%, or source changes
  useEffect(() => {
    const amt = parseFloat(form.amount) || 0
    const hasPool = revSources.includes('project_pool')
    if (amt > 0 && hasPool) {
      const poolAmt = Math.round(amt * (pctBySource.project_pool / 100) * 100) / 100
      const computed = localOrgPool.computeAllocations(poolType, poolAmt, selectedProjectIds)
      setPreviewAllocs(computed)
      setCustomAllocs(null) // reset custom overrides when base changes
      setDraftAmounts({}) // clear drafts when base recalculates
    } else {
      setPreviewAllocs([])
      setCustomAllocs(null)
      setDraftAmounts({})
    }
  }, [form.amount, pctBySource.project_pool, revSources, selectedProjectIds, poolType])

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
    const poolAmt = Math.round(totalAmt * (pctBySource.project_pool / 100) * 100) / 100

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
    const poolAmt = Math.round(totalAmt * (pctBySource.project_pool / 100) * 100) / 100
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
    if (revSources.length < 2) return true
    const sum = revSources.reduce((s, src) => s + (pctBySource[src] || 0), 0)
    return Math.round(sum * 100) / 100 === 100
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
        hr_revenue_pct: pctBySource.hr_revenue,
        lsgb_revenue_pct: pctBySource.lsgb_revenue,
        ...(showAdminShare ? { admin_share_pct: pctBySource.admin_pool } : {}),
        project_pool_pct: pctBySource.project_pool,
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
  const hasAdminShare = revSources.includes('admin_pool')

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
                <CFormSelect
                  size="sm"
                  onChange={(e) => handleExpensePick(e.target.value)}
                  defaultValue=""
                >
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
              pctBySource={pctBySource}
              setPctBySource={setPctBySource}
              totalAmount={form.amount}
              hrRevenueTotal={hrRevenueTotal}
              lsgbAvailable={lsgbAvailable}
              showAdminShare={showAdminShare}
            />

            {/* ── Budget Cap Alerts — always-rendered wrappers prevent layout shift ── */}
            {hasPool && (
              <BudgetCapAlert
                label={poolFundLabel}
                totalAmt={parseFloat(form.amount) || 0}
                poolPortion={
                  Math.round(
                    (parseFloat(form.amount) || 0) * (pctBySource.project_pool / 100) * 100,
                  ) / 100
                }
                budgetSummary={poolBudgetSummary}
              />
            )}
            {hasAdminShare && (
              <BudgetCapAlert
                label="Admin 5% Share"
                totalAmt={parseFloat(form.amount) || 0}
                poolPortion={
                  Math.round(
                    (parseFloat(form.amount) || 0) * (pctBySource.admin_pool / 100) * 100,
                  ) / 100
                }
                budgetSummary={adminPoolBudgetSummary}
              />
            )}

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
                        <label
                          htmlFor={`proj-chk-${poolType}-${p.projectId}`}
                          className="mb-0"
                          style={{ cursor: 'pointer' }}
                        >
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
                    {revSources.length > 1 && (
                      <span
                        className="text-body-secondary fw-normal ms-2"
                        style={{ fontSize: '0.75rem' }}
                      >
                        ({poolFundLabel} portion: {pctBySource.project_pool}% of total amount)
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
                            const isTight =
                              !isOver &&
                              rem.monthlyBudget > 0 &&
                              rem.remaining < rem.monthlyBudget * 0.2
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
                              background: pctValid
                                ? 'rgba(6,214,160,0.15)'
                                : 'rgba(255,107,107,0.15)',
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
                              value={
                                a.sharePct % 1 === 0
                                  ? a.sharePct
                                  : parseFloat(a.sharePct).toFixed(2)
                              }
                              onChange={(e) => handleAllocPctChange(a.projectId, e.target.value)}
                              onWheel={(e) => e.currentTarget.blur()}
                              style={{
                                textAlign: 'right',
                                fontWeight: 600,
                                padding: '3px 6px',
                                fontSize: '0.8rem',
                              }}
                              title="Edit % for this project"
                            />
                            <CInputGroupText style={{ fontSize: '0.75rem', padding: '3px 5px' }}>
                              %
                            </CInputGroupText>
                          </CInputGroup>
                        </div>

                        {/* ₹ Amount input with Recalculate */}
                        {(() => {
                          const draftVal = draftAmounts[a.projectId]
                          const isDraft =
                            draftVal !== undefined && draftVal !== String(a.amountCharged)
                          return (
                            <div
                              className="d-flex align-items-center gap-1"
                              style={{ flexShrink: 0 }}
                            >
                              <CInputGroup size="sm" style={{ width: 130 }}>
                                <CInputGroupText
                                  style={{ fontSize: '0.78rem', padding: '3px 6px' }}
                                >
                                  &#8377;
                                </CInputGroupText>
                                <CFormInput
                                  type="number"
                                  min="0"
                                  value={draftVal !== undefined ? draftVal : a.amountCharged}
                                  onChange={(e) => {
                                    setDraftAmounts((d) => ({
                                      ...d,
                                      [a.projectId]: e.target.value,
                                    }))
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
                                  style={{
                                    padding: '2px 8px',
                                    fontSize: '0.72rem',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}
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
                      ✓ Total: {Math.round(total * 100) / 100}%
                      {customAllocs ? ' (custom weights)' : ' (auto)'}
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
                  This expense will be fully covered by revenue sources other than {poolFundLabel}
                  — no project allocation will be distributed.
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
                    const poolPortion =
                      Math.round(totalAmt * (pctBySource.project_pool / 100) * 100) / 100
                    return (
                      poolBudgetSummary.totalMonthlyBudget > 0 &&
                      poolPortion > poolBudgetSummary.remaining
                    )
                  })() ||
                  (() => {
                    if (!hasAdminShare) return false
                    const totalAmt = parseFloat(form.amount) || 0
                    const sharePortion =
                      Math.round(totalAmt * (pctBySource.admin_pool / 100) * 100) / 100
                    return (
                      adminPoolBudgetSummary.totalMonthlyBudget > 0 &&
                      sharePortion > adminPoolBudgetSummary.remaining
                    )
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
            <CButton
              size="sm"
              color="success"
              onClick={() => setAdding(true)}
              id={`btn-add-${poolType}-expense`}
            >
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
                    <CButton
                      size="sm"
                      color="secondary"
                      variant="ghost"
                      onClick={() => setEditId(null)}
                    >
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
                      {/* Revenue source tags — % shown once 2+ sources are tagged */}
                      {(() => {
                        const multi = (exp.revenue_sources?.length || 0) > 1
                        return (
                          <>
                            {exp.revenue_sources?.includes('hr_revenue') && (
                              <CBadge
                                color="info"
                                shape="rounded-pill"
                                style={{ fontSize: '0.65rem' }}
                              >
                                HR Revenue{multi ? ` ${exp.hr_revenue_pct}%` : ''}
                              </CBadge>
                            )}
                            {exp.revenue_sources?.includes('project_pool') && (
                              <CBadge
                                color="success"
                                shape="rounded-pill"
                                style={{ fontSize: '0.65rem' }}
                              >
                                {poolFundLabel}
                                {multi ? ` ${exp.project_pool_pct}%` : ''}
                              </CBadge>
                            )}
                            {exp.revenue_sources?.includes('lsgb_revenue') && (
                              <CBadge
                                color="warning"
                                shape="rounded-pill"
                                style={{ fontSize: '0.65rem' }}
                              >
                                LSGB Revenue{multi ? ` ${exp.lsgb_revenue_pct}%` : ''}
                              </CBadge>
                            )}
                            {exp.revenue_sources?.includes('admin_pool') && (
                              <CBadge
                                color="dark"
                                shape="rounded-pill"
                                style={{ fontSize: '0.65rem' }}
                              >
                                Admin 5% Share{multi ? ` ${exp.admin_share_pct}%` : ''}
                              </CBadge>
                            )}
                          </>
                        )
                      })()}
                    </div>
                    <div className="text-body-secondary small mb-1">
                      {fmtDate(exp.date)} {exp.notes && ` · ${exp.notes}`}
                      {exp.bill_no && ` · Bill #${exp.bill_no}`}
                    </div>
                    <div className="text-body-tertiary" style={{ fontSize: '0.8rem' }}>
                      Distributed across{' '}
                      {exp.allocations?.length || exp.project_allocations?.length || 0} active
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

- [ ] **Step 1: Write the file**

Write the complete content above to `src/modules/ems/hr-pool/ExpensePoolCard.jsx`, replacing the entire existing file.

- [ ] **Step 2: Verify build**

Run: `npm_config_prefix=<scratch-npm-prefix-dir> npm run build`
Expected: clean build. This will fail until Task 3 updates `GlobalHRPoolPage.jsx`'s prop names/values to match — if the build errors reference `GlobalHRPoolPage.jsx`, that's expected at this point; a plain syntax/type check of `ExpensePoolCard.jsx` itself is what this step confirms (Vite doesn't type-check props across files, so it will very likely build clean even before Task 3 — just confirm no JS syntax errors in the new file).

- [ ] **Step 3: Commit**

```bash
git add src/modules/ems/hr-pool/ExpensePoolCard.jsx
git commit -m "feat: generalize ExpensePoolCard's revenue selector to 4 sources"
```

---

## Task 3: `GlobalHRPoolPage.jsx` — thread the new props, add the LSGB badge, fix the stale comment

**Files:**
- Modify: `src/modules/ems/hr-pool/GlobalHRPoolPage.jsx`

**Interfaces:**
- Consumes: `ExpensePoolCard`'s new `lsgbAvailable`/`getAdminPoolBudgetSummary` props (Task 2); `localOrgPool.getMonthlyAdminPoolBudgetSummary` (Task 1, unchanged signature).

- [ ] **Step 1: Add `lsgbAvailable` to the HR card**

Change:
```jsx
      {/* ── HR Expense Pool Card ─────────────────────────────────────────────── */}
      <ExpensePoolCard
        poolType="hr"
        poolLabel="HR"
        poolFundLabel="Project 5% Pool"
        hrRevenueTotal={hrRevenueTotal}
        expenseDropdownItems={hrGeneralExpenses.map((e) => ({ id: e.id, label: e.expense_name }))}
```
to:
```jsx
      {/* ── HR Expense Pool Card ─────────────────────────────────────────────── */}
      <ExpensePoolCard
        poolType="hr"
        poolLabel="HR"
        poolFundLabel="Project 5% Pool"
        hrRevenueTotal={hrRevenueTotal}
        lsgbAvailable={lsgbSummary?.remaining || 0}
        expenseDropdownItems={hrGeneralExpenses.map((e) => ({ id: e.id, label: e.expense_name }))}
```

- [ ] **Step 2: Add `lsgbAvailable` to the Admin card**

Change:
```jsx
      {/* ── Admin Expense Pool Card ──────────────────────────────────────────── */}
      <ExpensePoolCard
        poolType="admin"
        poolLabel="Admin"
        poolFundLabel="Project 5% Admin Pool"
        hrRevenueTotal={hrRevenueTotal}
        expenseDropdownItems={adminExpenseItems.map((e) => ({
```
to:
```jsx
      {/* ── Admin Expense Pool Card ──────────────────────────────────────────── */}
      <ExpensePoolCard
        poolType="admin"
        poolLabel="Admin"
        poolFundLabel="Project 5% Admin Pool"
        hrRevenueTotal={hrRevenueTotal}
        lsgbAvailable={lsgbSummary?.remaining || 0}
        expenseDropdownItems={adminExpenseItems.map((e) => ({
```

- [ ] **Step 3: Fix the stale "LSGB Fund Balance" comment**

Change:
```jsx
      {/* ── LSGB Fund Balance (info line, unrelated to Core 5% pool math) ────── */}
```
to:
```jsx
      {/* ── LSGB Fund Balance — this same `remaining` figure is now also the
          "LSGB Revenue" source's available balance on all three pool cards
          above/below (see `lsgbAvailable` prop) ─────────────────────────── */}
```

- [ ] **Step 4: Add `lsgbAvailable` and `getAdminPoolBudgetSummary` to the Core card**

Change:
```jsx
      {/* ── Core Expense Pool Card ─────────────────────────────────────────────── */}
      <ExpensePoolCard
        poolType="core"
        poolLabel="Core"
        poolFundLabel="Core 5% Pool"
        hrRevenueTotal={hrRevenueTotal}
        expenseDropdownItems={(() => {
```
to:
```jsx
      {/* ── Core Expense Pool Card ─────────────────────────────────────────────── */}
      <ExpensePoolCard
        poolType="core"
        poolLabel="Core"
        poolFundLabel="Core 5% Pool"
        hrRevenueTotal={hrRevenueTotal}
        lsgbAvailable={lsgbSummary?.remaining || 0}
        getAdminPoolBudgetSummary={(month) => localOrgPool.getMonthlyAdminPoolBudgetSummary(month)}
        expenseDropdownItems={(() => {
```

- [ ] **Step 5: Add an "LSGB Rev" tag to the existing per-project "Allocated Charges" badges**

Change (inside `ProjectHRBudgetCard`):
```jsx
                      {/* Revenue source tags */}
                      {c.revenue_sources?.includes('hr_revenue') && (
                        <CBadge color="info" style={{ fontSize: '0.58rem' }}>
                          HR Rev · {c.hr_revenue_type || ''}
                        </CBadge>
                      )}
                    </div>
```
to:
```jsx
                      {/* Revenue source tags */}
                      {c.revenue_sources?.includes('hr_revenue') && (
                        <CBadge color="info" style={{ fontSize: '0.58rem' }}>
                          HR Rev · {c.hr_revenue_type || ''}
                        </CBadge>
                      )}
                      {c.revenue_sources?.includes('lsgb_revenue') && (
                        <CBadge color="warning" style={{ fontSize: '0.58rem' }}>
                          LSGB Rev
                        </CBadge>
                      )}
                    </div>
```

- [ ] **Step 6: Verify build and lint**

Run: `npm_config_prefix=<scratch-npm-prefix-dir> npm run build`
Expected: clean build, no errors.

Run: `npm run lint -- src/modules/ems/hr-pool/GlobalHRPoolPage.jsx src/modules/ems/hr-pool/ExpensePoolCard.jsx src/services/localOrgPool.js`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/modules/ems/hr-pool/GlobalHRPoolPage.jsx
git commit -m "feat: wire LSGB Revenue and Admin 5% Share into the Expense Pools page"
```

---

## Task 4: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server and confirm it's serving**

Run: `(nohup npm run start -- --port 5183 --strictPort > /tmp/dev-server.log 2>&1 &)`
Run: `timeout 30 bash -c 'until curl -sf http://localhost:5183 >/dev/null; do sleep 1; done' && echo UP`
Expected: `UP`

- [ ] **Step 2: Dev-login and reach the Expense Pools page**

Using Playwright (or the project's established browser-verification approach): dev-login as a role with access to EMS Expense Management (HR or CEO per this repo's RBAC — check `constants/permissions.js` for `MODULE.HR_POOL` or equivalent if the exact route requires a specific role), navigate to the "Expense Pools" page (`/ems/...` — find the exact route in `src/modules/ems/_nav.jsx` or `src/routes/ems.routes.js` under `hr-pool`), screenshot it.

- [ ] **Step 3: Verify the HR card's 3-way split**

Click "Add New HR Expense". Fill Vendor/Payee, Category, Monthly Cut (e.g. 10000). Check "HR Revenue", "Project 5% Pool", and "LSGB Revenue" all three. Confirm:
- All three show %/₹ fields.
- Toggling from 1→2→3 selected sources re-splits evenly (100 / 50-50 / ~33-33-34) each time — screenshot after each toggle.
- Editing one source's % redistributes the other two proportionally, still summing to 100 (validation message turns green "Percentages sum to 100%").
- The LSGB Revenue row shows "Available: ₹X − ₹Y this expense → ₹Z remaining" using the real LSGB balance from the LSGB Fund Balance line elsewhere on this page.
- Manually set percentages that DON'T sum to 100 (e.g. 50/50/50) — confirm the "Add & Distribute Expense" button becomes disabled and the validation message turns red.
- Fix the split back to summing to 100, click Add. Confirm the new expense appears in the list below with three badges: "HR Revenue X%", "Project 5% Pool Y%", "LSGB Revenue Z%".

- [ ] **Step 4: Verify Core's 4-way split and the cross-pool Admin deduction**

On the Core card, note the Admin card's current "remaining" budget figure (visible via the Admin card's own Budget Cap Alert, or by adding a small Admin expense first to get a non-zero baseline if needed — Budget Cap Alert only renders when usage crosses a threshold, so alternatively just note `poolBudgetSummary` isn't directly visible unless near-cap; simplest: use the disabled-button check instead — see next step). Click "Add New Core Expense", pick or fill an employee/vendor, enter a Monthly Cut amount. Check "Core 5% Pool" and "Admin 5% Share" (2-way split, 50/50). Confirm:
- The Admin 5% Share row appears (it must NOT appear at all on the HR or Admin cards — verify by reopening their Add forms and confirming only 3 rows exist there, no "Admin 5% Share").
- A Budget Cap Alert-style block appears for the Admin 5% Share portion once the amount is large enough relative to Admin's monthly budget (same visual treatment as the Core 5% Pool alert — try a large amount, e.g. ₹500000 split 50/50, to trigger the "budget exceeded" red block if Admin's monthly budget is smaller than that).
- Click Add. Confirm the new expense shows "Core 5% Pool X%" and "Admin 5% Share Y%" badges.
- Switch to the Admin card's Add-Expense form (or just re-open it) and confirm its own Project Pool `poolBudgetSummary`/Budget Cap Alert now reflects the Core expense's admin-share draw — i.e., open the Admin card, start adding a new Admin expense with "Project 5% Pool" checked at 100%, enter an amount close to what should now be the reduced remaining budget, and confirm the alert/disabled-button state reflects the lower remaining (proving `getMonthlyAdminPoolBudgetSummary` now counts the Core expense).

- [ ] **Step 5: Check console errors and lint one more time**

Run in the browser dev tools / via Playwright `console --errors` equivalent: confirm no new console errors from any of the above interactions.

- [ ] **Step 6: Stop the dev server**

Run: `pkill -f "vite.*5183"` (or the PID captured in Step 1).

- [ ] **Step 7: Final commit if verification uncovered fixes**

If any bug was found and fixed during verification, commit it separately with a clear message describing what was wrong and what changed, following this repo's established pattern (see `docs/handoff.md` and recent commits for tone/format).

---

## Self-Review Notes

- **Spec coverage:** Task 1 covers spec §"Data model" (lsgb_revenue_pct on all three add* functions, admin_share_pct + admin_pool tag on addCoreExpense) and the cross-pool budget scan. Task 2 covers spec §1–3 (generalized selector, LSGB row, Admin Share row + BudgetCapAlert reuse). Task 3 covers prop-threading, the stale comment, and the optional per-project badge. Task 4 covers end-to-end verification of both the informational (LSGB) and real-deduction (Admin Share) behaviors. Out-of-scope items from the spec (CorePoolPage.jsx's separate salary list, LSGB module changes, per-project Admin-Share allocation, cumulative LSGB balance tracking, edit-form changes) are correctly not implemented anywhere in this plan.
- **Type/name consistency:** `pctBySource` keys (`hr_revenue`, `project_pool`, `lsgb_revenue`, `admin_pool`) are identical across Task 1's persisted field names (`hr_revenue_pct`/`lsgb_revenue_pct`/`project_pool_pct`/`admin_share_pct` — note the deliberate naming difference for the stored field, `admin_share_pct` not `admin_pool_pct`, matching the design spec's exact wording) and Task 2's `handleAdd` mapping (`admin_share_pct: pctBySource.admin_pool`). `getAdminPoolBudgetSummary` prop name matches between Task 2's consumption and Task 3's Core-card wiring.
- **No placeholders:** every step shows complete code, no "add validation"/"similar to Task N" shorthand. The full-file rewrite in Task 2 is shown in its entirety rather than as a diff, per the plan's own note that nearly every section of that file changes.
