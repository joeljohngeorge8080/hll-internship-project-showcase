# Monthly Planning + HR/Core/Admin Apportionment (Part 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Project Officer plan a project's execution budget month-by-month (Design/Implementation/Monitoring phase line items), generate that plan across the full project duration, set a per-month HR%/Core% that carves those pools out of each month's planned total, and gate release behind task-assignment + an "Activate Project" click — producing a static plan and its derived Project/HR/Core split, surfaced on the project page and the EMS Consolidated Sheet.

**Architecture:** A new pure-math module (`monthlyApportionment.js`) owns the working-pool/baseline/split/validation formulas with no I/O. `localProjects.js` gets new CRUD methods that call into that math module and persist to the existing `localStorage`-backed project record (`hma_projects_v9`). A new `MonthlyPlanPanel.jsx` component (not inlined into the already-2300-line `ProjectDetailPage.jsx`) renders the template editor, Generate action, and the editable monthly table, and is wired in as a new tab. `ExpenseManagementPage.jsx`'s Consolidated Sheet reads the same derived-split data for the current month.

**Tech Stack:** React 19 + Vite, CoreUI React components, plain JS service modules backed by `localStorage`. No test runner configured in this repo.

**Part 2 (not in this plan):** activation-timing redistribution (spec Section 6), live spend-vs-plan clawback/overflow (spec Section 7), and the `project_expenses` actuals ledger they depend on. This plan produces the static plan + its direct derived split only — Part 2 will read `monthly_plan`/`monthly_derived` produced here and add the reconciliation layer on top.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-02-hr-core-admin-monthly-apportionment-design.md` — Sections 1–5 and 9 are what this plan implements. Sections 6–8 are explicitly Part 2 or out of scope (Section 8, installments, is permanently out of scope — no task here should read or gate on `project.installments`).
- No automated test framework exists in this repo (no Jest/Vitest/pytest — only `build`/`lint`/`serve`/`start` in `package.json`). Verification is `npm run build` + a scoped `npm run lint -- <file>` + a manual browser-console/UI check per task.
- **Lint baseline** (measured on a clean checkout of this worktree, before any task in this plan runs — do not attempt to fix these, only avoid exceeding them):

  | File | Baseline error count |
  |---|---|
  | `src/services/localOrgPool.js` | 2 |
  | `src/services/localProjects.js` | 0 |
  | `src/modules/pms/project-associate/ProjectDetailPage.jsx` | 56 |
  | `src/modules/ems/expense-management/ExpenseManagementPage.jsx` | 38 |
  | `src/modules/ems/projects/ProjectOverheadsList.jsx` | 1 |
  | New files (`monthlyApportionment.js`, `MonthlyPlanPanel.jsx`) | 0 (new file, must lint clean) |

  `npm run build` exits 0 on a clean checkout — treat any build failure as a real regression.
- Money values are rounded with `Math.round(x * 100) / 100`. Month strings are always `'YYYY-MM'`.
- Follow each file's existing style exactly (no semicolons, single quotes, 2-space indent) — match what's already there.
- Run all commands from `/home/jojo/labs/git-lab/HMA/hma-template/emsv1` (the Vite project root) unless stated otherwise.
- **Admin is a locked lump sum** (spec Section 1) — never recompute `admin_pool_amount` after it's first credited, regardless of later edits to `admin_pct` or `project_value`.
- **HR/Core % is per-month, not project-wide** (spec Section 4) — every month in `monthly_plan` carries its own `hr_pct`/`core_pct`, default 5 each.
- **The monthly plan must sum to the working pool exactly** (spec Section 3) — `project_value − admin_pool_amount`. Every write path that changes plan totals must re-validate this and surface the variance; never silently accept an unbalanced plan.

---

## Task 1: Admin lump-sum crediting

**Files:**
- Modify: `src/services/localOrgPool.js` (add `recordAdminCredit`/`getAdminPoolCredits`/`computeAdminPoolAmount`)
- Modify: `src/services/localProjects.js` (wire crediting into `create()`/`update()`)

**Interfaces:**
- Produces: `localOrgPool.computeAdminPoolAmount(project)` → `number` (`project_value × admin_pct% `, rounded).
- Produces: `localOrgPool.recordAdminCredit(projectId, amount)` → appends `{id, projectId, amount, createdAt}` to `admin_pool_credits` in the org pool store (`ORG_POOL_KEY`).
- Produces: on every project record, `admin_pool_amount: number`, `admin_pool_credited: boolean`, `admin_credited_at: string|null`. Consumed by Task 2 (working-pool calc) and Task 5 (UI display).

- [ ] **Step 1: Add the two methods to `localOrgPool.js`**

Read `src/services/localOrgPool.js` first — find the `projectValue` helper function (used to resolve `p.project_value || p.project_valuation || 0`) and the `localOrgPool` object's closing methods (`getAllCoreExpenses()` is the last one before the final `}`). Add these two methods right after `getAllCoreExpenses()`:

```js

  /** 5% (admin_pct) of total project value — credited once, as a lump sum. */
  computeAdminPoolAmount(project) {
    const pv = projectValue(project)
    const pct = project.admin_pct ?? 5
    return Math.round(pv * (pct / 100) * 100) / 100
  },

  /** Appends a lump-sum admin credit record (org-wide ledger, mirrors hr/core expense arrays). */
  recordAdminCredit(projectId, amount) {
    const pool = readPool()
    const record = { id: uid(), projectId, amount, createdAt: new Date().toISOString() }
    pool.admin_pool_credits = [...(pool.admin_pool_credits || []), record]
    writePool(pool)
    return record
  },

  /** Returns all admin pool lump-sum credit records. */
  getAdminPoolCredits() {
    return readPool().admin_pool_credits || []
  },
```

- [ ] **Step 2: Credit admin on project creation in `localProjects.js`**

Read `src/services/localProjects.js` — find the `create(data)` method (builds the new project object and calls `write(PROJECTS_KEY, ...)`). Add this import at the top of the file, alongside the existing `import { localNotifications } from './localNotifications'` line:

```js
import { localOrgPool } from './localOrgPool'
```

Immediately before the final `write(PROJECTS_KEY, [...projects, project])` (or equivalent) call inside `create()`, add:

```js
    if (project.project_value > 0) {
      project.admin_pool_amount = localOrgPool.computeAdminPoolAmount(project)
      project.admin_pool_credited = true
      project.admin_credited_at = now()
      localOrgPool.recordAdminCredit(project.id, project.admin_pool_amount)
    } else {
      project.admin_pool_amount = 0
      project.admin_pool_credited = false
      project.admin_credited_at = null
    }
```

- [ ] **Step 3: Credit admin on the first `update()` that sets a real project value**

In the same file, find `update(id, data)`. Change it from:

```js
  update(id, data) {
    const projects = read(PROJECTS_KEY)
    const idx = projects.findIndex((p) => p.id === id)
    if (idx === -1) throw new Error('Project not found')
    projects[idx] = { ...projects[idx], ...data, updated_at: now() }
    write(PROJECTS_KEY, projects)
    return projects[idx]
  },
```

to:

```js
  update(id, data) {
    const projects = read(PROJECTS_KEY)
    const idx = projects.findIndex((p) => p.id === id)
    if (idx === -1) throw new Error('Project not found')
    const updated = { ...projects[idx], ...data, updated_at: now() }

    if (!updated.admin_pool_credited && updated.project_value > 0) {
      updated.admin_pool_amount = localOrgPool.computeAdminPoolAmount(updated)
      updated.admin_pool_credited = true
      updated.admin_credited_at = now()
      localOrgPool.recordAdminCredit(updated.id, updated.admin_pool_amount)
    }

    projects[idx] = updated
    write(PROJECTS_KEY, projects)
    return projects[idx]
  },
```

- [ ] **Step 4: Verify it lints and builds**

Run: `npm run build && npm run lint -- src/services/localOrgPool.js src/services/localProjects.js`
Expected: `npm run build` exits 0. Combined pre-existing baseline for these two files is 2 errors (2 in `localOrgPool.js`, 0 in `localProjects.js`); the scoped lint run should report 2 or fewer.

- [ ] **Step 5: Manual verification via browser console**

Run `npm run start`, open the app, open devtools console, paste:

```js
const { localProjects } = await import('/src/services/localProjects.js')
const { localOrgPool } = await import('/src/services/localOrgPool.js')
const p = localProjects.create({ name: 'Test Admin Credit', project_value: 1000000, admin_pct: 5, start_date: '2026-01-01', end_date: '2026-10-31' })
console.log(p.admin_pool_credited, p.admin_pool_amount) // expect: true 50000
console.log(localOrgPool.getAdminPoolCredits().find((c) => c.projectId === p.id)) // expect: a record with amount 50000
```

Expected: `true 50000` and a matching credit record.

- [ ] **Step 6: Commit**

```bash
git add src/services/localOrgPool.js src/services/localProjects.js
git commit -m "feat: credit admin pool lump sum at project creation/valuation"
```

---

## Task 2: Pure math module — working pool, baseline months, split, validation

**Files:**
- Create: `src/services/monthlyApportionment.js`

**Interfaces:**
- Produces: `computeWorkingPool(project)` → `number` (`project_value - admin_pool_amount`).
- Produces: `monthsInRange(startDate, endDate)` → `Array<'YYYY-MM'>` (every calendar month from start to end, inclusive).
- Produces: `computeMonthSplit(monthEntry)` → `{ projectAmount, hrAmount, coreAmount }` where `monthEntry = { total, hr_pct, core_pct }`.
- Produces: `sumPlanTotal(monthlyPlan)` → `number` (sum of every month's `total`).
- Produces: `validatePlanTotal(monthlyPlan, workingPool)` → `{ valid: boolean, planTotal: number, workingPool: number, diff: number }` (`diff = planTotal - workingPool`, rounded to 2dp; `valid` is `Math.abs(diff) < 0.01`).
- Consumed by Task 3 (`localProjects.js` plan CRUD), Task 5 (`MonthlyPlanPanel.jsx` UI), Task 7 (Consolidated Sheet).

This is a pure module — no `localStorage` access, no imports from other service files. Every function takes plain data in and returns plain data out, so it can be verified directly under plain `node` without a browser.

- [ ] **Step 1: Write the module**

```js
/**
 * monthlyApportionment.js — Pure math for project monthly planning
 * (spec: docs/superpowers/specs/2026-07-02-hr-core-admin-monthly-apportionment-design.md,
 * Sections 2-4). No localStorage or other I/O — every function is a plain
 * data-in/data-out transform so it's testable without a browser.
 */

/**
 * Working pool = total project value minus the (already-credited, locked)
 * admin lump sum. This is what the monthly plan (Task 3) must sum to.
 */
export const computeWorkingPool = (project) => {
  const pv = project.project_value || project.project_valuation || 0
  const admin = project.admin_pool_amount || 0
  return Math.round((pv - admin) * 100) / 100
}

/**
 * Every calendar month from start to end (both 'YYYY-MM-DD' or 'YYYY-MM'),
 * inclusive. Returns at least one month.
 */
export const monthsInRange = (startDate, endDate) => {
  if (!startDate || !endDate) return []
  const [sy, sm] = startDate.split('-').map(Number)
  const [ey, em] = endDate.split('-').map(Number)
  const months = []
  let cy = sy
  let cm = sm
  while (cy < ey || (cy === ey && cm <= em)) {
    months.push(`${cy}-${String(cm).padStart(2, '0')}`)
    cm++
    if (cm > 12) {
      cm = 1
      cy++
    }
  }
  return months
}

/**
 * Splits one month's planned total into Project/HR/Core, carving HR/Core
 * out of the same pot (not additive on top) per spec Section 4.
 */
export const computeMonthSplit = (monthEntry) => {
  const total = monthEntry.total || 0
  const hrPct = monthEntry.hr_pct ?? 5
  const corePct = monthEntry.core_pct ?? 5
  const hrAmount = Math.round(total * (hrPct / 100) * 100) / 100
  const coreAmount = Math.round(total * (corePct / 100) * 100) / 100
  const projectAmount = Math.round((total - hrAmount - coreAmount) * 100) / 100
  return { projectAmount, hrAmount, coreAmount }
}

/** Sum of every month's total in a monthly plan. */
export const sumPlanTotal = (monthlyPlan) =>
  Math.round((monthlyPlan || []).reduce((s, m) => s + (m.total || 0), 0) * 100) / 100

/**
 * A plan is valid only when its total exactly matches the working pool
 * (spec Section 3) — within a half-paisa rounding tolerance.
 */
export const validatePlanTotal = (monthlyPlan, workingPool) => {
  const planTotal = sumPlanTotal(monthlyPlan)
  const diff = Math.round((planTotal - workingPool) * 100) / 100
  return { valid: Math.abs(diff) < 0.01, planTotal, workingPool, diff }
}
```

- [ ] **Step 2: Verify it lints and builds**

Run: `npm run build && npm run lint -- src/services/monthlyApportionment.js`
Expected: both exit 0, 0 errors (this is a new file, no baseline exceptions apply).

- [ ] **Step 3: Manual verification under plain Node**

This module has no `localStorage` dependency, so verify it directly:

```bash
node -e "
const m = require('./src/services/monthlyApportionment.js')
" 2>&1 || node --input-type=module -e "
import { computeWorkingPool, monthsInRange, computeMonthSplit, sumPlanTotal, validatePlanTotal } from './src/services/monthlyApportionment.js'

console.log(computeWorkingPool({ project_value: 1000000, admin_pool_amount: 50000 })) // expect 950000

console.log(monthsInRange('2026-01-01', '2026-10-31'))
// expect ['2026-01','2026-02',...,'2026-10'] (10 entries)

console.log(computeMonthSplit({ total: 95000, hr_pct: 5, core_pct: 5 }))
// expect { projectAmount: 85500, hrAmount: 4750, coreAmount: 4750 }
// (5% of 95000 = 4750 each for HR/Core, not 5000 - percentages are of that month's pot, not
// a flat 5K reference; projectAmount is the 95000 residual after both are carved out: 85500)

const plan = Array.from({length: 10}, (_, i) => ({ month: \`2026-\${String(i+1).padStart(2,'0')}\`, total: 95000, hr_pct: 5, core_pct: 5 }))
console.log(sumPlanTotal(plan)) // expect 950000
console.log(validatePlanTotal(plan, 950000)) // expect { valid: true, planTotal: 950000, workingPool: 950000, diff: 0 }
console.log(validatePlanTotal(plan, 900000)) // expect { valid: false, ..., diff: 50000 }
"
```

Expected: run the second (ESM) form — this repo's `package.json` has `"type": "module"` or the `.js` files use `export`, so the `require` form will fail with "Cannot use import statement" and fall through to the `--input-type=module` form via `||`. Confirm the printed values match the comments exactly, especially `computeMonthSplit`'s 4750/4750 (not 5000/5000) — this is the one easy-to-get-wrong detail: percentages are of *that month's total*, not a flat reference amount.

- [ ] **Step 4: Commit**

```bash
git add src/services/monthlyApportionment.js
git commit -m "feat: add pure monthly-apportionment math module"
```

---

## Task 3: Monthly plan CRUD in `localProjects.js`

**Files:**
- Modify: `src/services/localProjects.js`

**Interfaces:**
- Consumes: `computeWorkingPool`, `monthsInRange`, `validatePlanTotal` from `monthlyApportionment.js` (Task 2).
- Produces: `localProjects.generateMonthlyPlan(projectId, templatePhases)` → generates `project.monthly_plan` by repeating `templatePhases` across every month in `monthsInRange(project.start_date, project.end_date)`. Throws if the resulting plan doesn't balance against the working pool. Returns the updated project.
- Produces: `localProjects.updateMonthPlan(projectId, month, phases)` → replaces one month's `phases` array (and recomputed `total`) in `project.monthly_plan`. Does **not** throw on an unbalanced total — returns the updated project plus a `validation` field (`{valid, diff}`) so the UI can show the variance without blocking the edit (spec Section 3 says the UI must "block/flag" — flagging via a returned validation result, with the *Generate* step in Step 1 being the actual hard block, matches "block or flag").
- Produces: `localProjects.updateMonthPct(projectId, month, { hr_pct, core_pct })` → updates one month's percentages. Returns the updated project.

- [ ] **Step 1: Add the import**

At the top of `src/services/localProjects.js`, alongside the `localOrgPool` import added in Task 1, add:

```js
import { computeWorkingPool, monthsInRange, validatePlanTotal } from './monthlyApportionment'
```

- [ ] **Step 2: Add `generateMonthlyPlan`**

Find the `activateProject(id)` method in `localProjects.js` (search for `activateProject`). Add the three new methods right after it, before the `// ── Installment Management ─────` comment:

```js

  // ── Monthly Planning ────────────────────────────────────────────────────────

  /**
   * Replicates `templatePhases` (an array of { phase, label, amount }) across
   * every month of the project's duration, producing project.monthly_plan.
   * Throws if the resulting plan doesn't balance against the working pool
   * (project_value - admin_pool_amount) — the Generate action is the plan's
   * hard validation gate (spec Section 3).
   */
  generateMonthlyPlan(projectId, templatePhases) {
    const projects = read(PROJECTS_KEY)
    const idx = projects.findIndex((p) => p.id === projectId)
    if (idx === -1) throw new Error('Project not found')
    const project = projects[idx]

    const months = monthsInRange(project.start_date, project.end_date)
    if (months.length === 0) {
      throw new Error('Project must have a start_date and end_date before generating a plan')
    }

    const monthTotal = Math.round(
      templatePhases.reduce((s, ph) => s + (parseFloat(ph.amount) || 0), 0) * 100,
    ) / 100

    const monthlyPlan = months.map((month) => ({
      month,
      phases: templatePhases.map((ph) => ({ ...ph, amount: parseFloat(ph.amount) || 0 })),
      total: monthTotal,
      hr_pct: 5,
      core_pct: 5,
    }))

    const workingPool = computeWorkingPool(project)
    const { valid, planTotal, diff } = validatePlanTotal(monthlyPlan, workingPool)
    if (!valid) {
      throw new Error(
        `Plan total (${planTotal}) does not match the working pool (${workingPool}) — ` +
          `difference of ${diff}. Adjust the template amounts and try again.`,
      )
    }

    projects[idx] = { ...project, monthly_plan: monthlyPlan, updated_at: now() }
    write(PROJECTS_KEY, projects)
    return projects[idx]
  },

  /**
   * Replaces one month's phase line items. Does not block on an unbalanced
   * total (single-month edits routinely go out of balance mid-edit) — the
   * returned `validation` field tells the caller whether the *overall* plan
   * still balances, so the UI can flag it live.
   */
  updateMonthPlan(projectId, month, phases) {
    const projects = read(PROJECTS_KEY)
    const idx = projects.findIndex((p) => p.id === projectId)
    if (idx === -1) throw new Error('Project not found')
    const project = projects[idx]
    const plan = project.monthly_plan || []
    const mIdx = plan.findIndex((m) => m.month === month)
    if (mIdx === -1) throw new Error(`Month ${month} not found in plan`)

    const total = Math.round(
      phases.reduce((s, ph) => s + (parseFloat(ph.amount) || 0), 0) * 100,
    ) / 100
    const updatedPlan = [...plan]
    updatedPlan[mIdx] = { ...updatedPlan[mIdx], phases, total }

    projects[idx] = { ...project, monthly_plan: updatedPlan, updated_at: now() }
    write(PROJECTS_KEY, projects)

    const validation = validatePlanTotal(updatedPlan, computeWorkingPool(projects[idx]))
    return { project: projects[idx], validation }
  },

  /** Updates one month's HR%/Core%. */
  updateMonthPct(projectId, month, { hr_pct, core_pct }) {
    const projects = read(PROJECTS_KEY)
    const idx = projects.findIndex((p) => p.id === projectId)
    if (idx === -1) throw new Error('Project not found')
    const project = projects[idx]
    const plan = project.monthly_plan || []
    const mIdx = plan.findIndex((m) => m.month === month)
    if (mIdx === -1) throw new Error(`Month ${month} not found in plan`)

    const updatedPlan = [...plan]
    updatedPlan[mIdx] = {
      ...updatedPlan[mIdx],
      hr_pct: hr_pct ?? updatedPlan[mIdx].hr_pct,
      core_pct: core_pct ?? updatedPlan[mIdx].core_pct,
    }

    projects[idx] = { ...project, monthly_plan: updatedPlan, updated_at: now() }
    write(PROJECTS_KEY, projects)
    return projects[idx]
  },
```

- [ ] **Step 3: Verify it lints and builds**

Run: `npm run build && npm run lint -- src/services/localProjects.js`
Expected: `npm run build` exits 0. `localProjects.js` has a baseline of 0 errors — the scoped lint run should report 0.

- [ ] **Step 4: Manual verification via browser console**

```js
const { localProjects } = await import('/src/services/localProjects.js')

const p = localProjects.create({ name: 'Test Plan', project_value: 1000000, admin_pct: 5, start_date: '2026-01-01', end_date: '2026-10-31' })
// working pool = 950000, 10 months -> 95000/month template

const generated = localProjects.generateMonthlyPlan(p.id, [
  { phase: 'design', label: 'Design work', amount: 30000 },
  { phase: 'implementation', label: 'Field work', amount: 55000 },
  { phase: 'monitoring', label: 'M&E', amount: 10000 },
])
console.log(generated.monthly_plan.length) // expect 10
console.log(generated.monthly_plan[0]) // expect { month: '2026-01', phases: [...], total: 95000, hr_pct: 5, core_pct: 5 }

// Unbalanced template should throw:
try {
  localProjects.generateMonthlyPlan(p.id, [{ phase: 'design', label: 'x', amount: 1000 }])
} catch (e) {
  console.log(e.message) // expect a message mentioning the plan/working-pool mismatch
}

const { project: afterEdit, validation } = localProjects.updateMonthPlan(p.id, '2026-01', [
  { phase: 'design', label: 'Design work', amount: 40000 },
  { phase: 'implementation', label: 'Field work', amount: 55000 },
  { phase: 'monitoring', label: 'M&E', amount: 10000 },
])
console.log(afterEdit.monthly_plan[0].total) // expect 105000
console.log(validation) // expect valid: false, diff: 10000 (plan now totals 960000 vs working pool 950000)

const afterPct = localProjects.updateMonthPct(p.id, '2026-01', { hr_pct: 7, core_pct: 3 })
console.log(afterPct.monthly_plan[0].hr_pct, afterPct.monthly_plan[0].core_pct) // expect 7 3
```

Expected: output matches every comment above.

- [ ] **Step 5: Commit**

```bash
git add src/services/localProjects.js
git commit -m "feat: add monthly plan generate/update CRUD to localProjects"
```

---

## Task 4: `MonthlyPlanPanel.jsx` — template editor + Generate

**Files:**
- Create: `src/modules/pms/project-associate/MonthlyPlanPanel.jsx`

**Interfaces:**
- Consumes: `localProjects.generateMonthlyPlan(projectId, templatePhases)` (Task 3), `computeWorkingPool` (Task 2).
- Consumes prop: `project` (full project record), `onProjectChange(updatedProject)` (callback to push the new project object up to the parent's state — matches the existing `setProject` pattern already used throughout `ProjectDetailPage.jsx`).
- Produces: a component that renders (a) the template editor (only shown when `project.monthly_plan` doesn't exist yet) and (b) delegates the generated-plan table to Task 5, which extends this same file.

This task only builds the "no plan yet" state (template entry + Generate). Task 5 adds the "plan exists" editable table in the same file.

- [ ] **Step 1: Write the component**

```jsx
import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CFormSelect,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CButton,
  CAlert,
  CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilTrash } from '@coreui/icons'
import { localProjects } from '../../../services/localProjects'
import { computeWorkingPool, monthsInRange } from '../../../services/monthlyApportionment'

const PHASE_OPTIONS = [
  { value: 'design', label: 'Design' },
  { value: 'implementation', label: 'Implementation' },
  { value: 'monitoring', label: 'Monitoring' },
]

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const emptyLine = () => ({ phase: 'design', label: '', amount: '' })

const TemplateEditor = ({ project, onProjectChange }) => {
  const [lines, setLines] = useState([emptyLine()])
  const [error, setError] = useState('')

  const workingPool = computeWorkingPool(project)
  const monthCount = monthsInRange(project.start_date, project.end_date).length
  const baselinePerMonth = monthCount > 0 ? Math.round((workingPool / monthCount) * 100) / 100 : 0
  const templateTotal = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)

  const updateLine = (i, patch) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  const addLine = () => setLines((prev) => [...prev, emptyLine()])
  const removeLine = (i) => setLines((prev) => prev.filter((_, idx) => idx !== i))

  const handleGenerate = () => {
    setError('')
    try {
      const templatePhases = lines
        .filter((l) => l.label.trim() && parseFloat(l.amount) > 0)
        .map((l) => ({ phase: l.phase, label: l.label.trim(), amount: parseFloat(l.amount) }))
      if (templatePhases.length === 0) {
        setError('Add at least one phase line item with a label and amount.')
        return
      }
      const updated = localProjects.generateMonthlyPlan(project.id, templatePhases)
      onProjectChange(updated)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <CCard className="shadow-sm mb-4">
      <CCardHeader className="bg-transparent fw-semibold pt-3">
        📅 Plan One Month — Generate Across the Full Duration
      </CCardHeader>
      <CCardBody>
        <div className="text-body-secondary small mb-3">
          Working pool: <strong>{fmt(workingPool)}</strong> (project value minus the locked admin
          share) across <strong>{monthCount}</strong> month{monthCount !== 1 ? 's' : ''} — baseline
          suggestion: <strong>{fmt(baselinePerMonth)}</strong>/month if split evenly. Build one
          month&apos;s phase breakdown below, then Generate repeats it across every month of the
          project.
        </div>

        {lines.map((line, i) => (
          <CRow key={i} className="g-2 mb-2 align-items-center">
            <CCol xs={12} md={3}>
              <CFormSelect
                size="sm"
                value={line.phase}
                onChange={(e) => updateLine(i, { phase: e.target.value })}
              >
                {PHASE_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol xs={12} md={5}>
              <CFormInput
                size="sm"
                placeholder="Task / activity"
                value={line.label}
                onChange={(e) => updateLine(i, { label: e.target.value })}
              />
            </CCol>
            <CCol xs={8} md={3}>
              <CInputGroup size="sm">
                <CInputGroupText>₹</CInputGroupText>
                <CFormInput
                  type="number"
                  min="0"
                  value={line.amount}
                  onChange={(e) => updateLine(i, { amount: e.target.value })}
                />
              </CInputGroup>
            </CCol>
            <CCol xs={4} md={1}>
              <CButton
                size="sm"
                color="danger"
                variant="ghost"
                disabled={lines.length === 1}
                onClick={() => removeLine(i)}
              >
                <CIcon icon={cilTrash} />
              </CButton>
            </CCol>
          </CRow>
        ))}

        <CButton size="sm" color="secondary" variant="outline" className="mb-3" onClick={addLine}>
          <CIcon icon={cilPlus} className="me-1" />
          Add Line
        </CButton>

        <div className="d-flex align-items-center gap-2 mb-3">
          <span className="small text-body-secondary">Month total:</span>
          <CBadge color={templateTotal > 0 ? 'primary' : 'secondary'}>{fmt(templateTotal)}</CBadge>
        </div>

        {error && (
          <CAlert color="danger" className="py-2 small">
            {error}
          </CAlert>
        )}

        <CButton color="success" onClick={handleGenerate}>
          Generate {project.start_date && project.end_date ? 'Full' : ''} Plan
        </CButton>
      </CCardBody>
    </CCard>
  )
}

TemplateEditor.propTypes = {
  project: PropTypes.object.isRequired,
  onProjectChange: PropTypes.func.isRequired,
}

const MonthlyPlanPanel = ({ project, onProjectChange }) => {
  if (!project.monthly_plan || project.monthly_plan.length === 0) {
    return <TemplateEditor project={project} onProjectChange={onProjectChange} />
  }
  return <div>Plan table goes here (Task 5)</div>
}

MonthlyPlanPanel.propTypes = {
  project: PropTypes.object.isRequired,
  onProjectChange: PropTypes.func.isRequired,
}

export default MonthlyPlanPanel
```

- [ ] **Step 2: Verify it lints and builds**

Run: `npm run build && npm run lint -- src/modules/pms/project-associate/MonthlyPlanPanel.jsx`
Expected: both exit 0, 0 errors (new file).

- [ ] **Step 3: Manual verification via browser console + UI**

This component isn't wired into any page yet (Task 6 does that), so verify the underlying call chain via console first:

```js
const { localProjects } = await import('/src/services/localProjects.js')
const p = localProjects.create({ name: 'Panel Test', project_value: 500000, admin_pct: 5, start_date: '2026-01-01', end_date: '2026-06-30' })
console.log(p.monthly_plan) // expect undefined - TemplateEditor should render for this project
```

Confirm the file has no unused-import lint errors and the JSX is well-formed (the build step already confirms this).

- [ ] **Step 4: Commit**

```bash
git add src/modules/pms/project-associate/MonthlyPlanPanel.jsx
git commit -m "feat: add MonthlyPlanPanel template editor and Generate action"
```

---

## Task 5: `MonthlyPlanPanel.jsx` — editable monthly table with HR/Core arrows

**Files:**
- Modify: `src/modules/pms/project-associate/MonthlyPlanPanel.jsx`

**Interfaces:**
- Consumes: `localProjects.updateMonthPlan`, `localProjects.updateMonthPct` (Task 3), `computeMonthSplit`, `validatePlanTotal`, `computeWorkingPool` (Task 2).
- Replaces the placeholder `<div>Plan table goes here (Task 5)</div>` from Task 4 with the real table.

- [ ] **Step 1: Add the new imports**

At the top of `src/modules/pms/project-associate/MonthlyPlanPanel.jsx`, add to the existing `@coreui/react` import block: `CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell`. Add to the existing `@coreui/icons` import: `cilArrowThickTop, cilArrowThickBottom`. Add a new import line:

```js
import { computeMonthSplit, validatePlanTotal } from '../../../services/monthlyApportionment'
```

(`computeWorkingPool` is already imported from Task 4.)

- [ ] **Step 2: Replace the placeholder with the real table component**

Replace this line (added in Task 4):

```js
  return <div>Plan table goes here (Task 5)</div>
```

with:

```js
  return <PlanTable project={project} onProjectChange={onProjectChange} />
```

Then add the `PlanTable` component right above `MonthlyPlanPanel` (after `TemplateEditor`'s closing `TemplateEditor.propTypes = {...}` block):

```jsx
const monthLabel = (ym) => {
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

const PctStepper = ({ value, onChange }) => (
  <div className="d-flex align-items-center gap-1">
    <CButton
      size="sm"
      color="secondary"
      variant="ghost"
      style={{ padding: '2px 6px' }}
      onClick={() => onChange(Math.max(0, Math.round((value - 0.5) * 10) / 10))}
    >
      <CIcon icon={cilArrowThickBottom} size="sm" />
    </CButton>
    <span className="fw-semibold" style={{ minWidth: 40, textAlign: 'center' }}>
      {value}%
    </span>
    <CButton
      size="sm"
      color="secondary"
      variant="ghost"
      style={{ padding: '2px 6px' }}
      onClick={() => onChange(Math.round((value + 0.5) * 10) / 10)}
    >
      <CIcon icon={cilArrowThickTop} size="sm" />
    </CButton>
  </div>
)

PctStepper.propTypes = {
  value: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
}

const PlanTable = ({ project, onProjectChange }) => {
  const workingPool = computeWorkingPool(project)
  const validation = validatePlanTotal(project.monthly_plan, workingPool)

  const handlePctChange = (month, patch) => {
    const updated = localProjects.updateMonthPct(project.id, month, patch)
    onProjectChange(updated)
  }

  const handleAmountChange = (month, phaseIdx, amount) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    const phases = monthEntry.phases.map((ph, i) =>
      i === phaseIdx ? { ...ph, amount: parseFloat(amount) || 0 } : ph,
    )
    const { project: updated } = localProjects.updateMonthPlan(project.id, month, phases)
    onProjectChange(updated)
  }

  return (
    <CCard className="shadow-sm mb-4">
      <CCardHeader className="bg-transparent fw-semibold pt-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <span>📊 Monthly Plan</span>
        <CBadge color={validation.valid ? 'success' : 'danger'}>
          {validation.valid
            ? `Balanced — ${fmt(validation.planTotal)}`
            : `Off by ${fmt(Math.abs(validation.diff))} (plan ${fmt(validation.planTotal)} vs pool ${fmt(validation.workingPool)})`}
        </CBadge>
      </CCardHeader>
      <CCardBody className="p-0">
        <div style={{ overflowX: 'auto' }}>
          <CTable hover align="middle" className="mb-0" style={{ fontSize: '0.82rem' }}>
            <CTableHead color="light">
              <CTableRow>
                <CTableHeaderCell>Month</CTableHeaderCell>
                <CTableHeaderCell>Phase Breakdown</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Total</CTableHeaderCell>
                <CTableHeaderCell className="text-center">HR %</CTableHeaderCell>
                <CTableHeaderCell className="text-center">Core %</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Project / HR / Core</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {project.monthly_plan.map((m) => {
                const split = computeMonthSplit(m)
                return (
                  <CTableRow key={m.month}>
                    <CTableDataCell className="fw-semibold">{monthLabel(m.month)}</CTableDataCell>
                    <CTableDataCell>
                      {m.phases.map((ph, i) => (
                        <div key={i} className="d-flex align-items-center gap-2 mb-1">
                          <CBadge color="secondary" shape="rounded-pill" style={{ fontSize: '0.65rem' }}>
                            {ph.phase}
                          </CBadge>
                          <span className="text-body-secondary">{ph.label}</span>
                          <CInputGroup size="sm" style={{ maxWidth: 130 }}>
                            <CInputGroupText>₹</CInputGroupText>
                            <CFormInput
                              type="number"
                              min="0"
                              value={ph.amount}
                              onChange={(e) => handleAmountChange(m.month, i, e.target.value)}
                            />
                          </CInputGroup>
                        </div>
                      ))}
                    </CTableDataCell>
                    <CTableDataCell className="text-end fw-bold">{fmt(m.total)}</CTableDataCell>
                    <CTableDataCell className="text-center">
                      <PctStepper
                        value={m.hr_pct}
                        onChange={(v) => handlePctChange(m.month, { hr_pct: v })}
                      />
                    </CTableDataCell>
                    <CTableDataCell className="text-center">
                      <PctStepper
                        value={m.core_pct}
                        onChange={(v) => handlePctChange(m.month, { core_pct: v })}
                      />
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                      <div className="text-primary">{fmt(split.projectAmount)}</div>
                      <div className="text-info">{fmt(split.hrAmount)}</div>
                      <div className="text-danger">{fmt(split.coreAmount)}</div>
                    </CTableDataCell>
                  </CTableRow>
                )
              })}
            </CTableBody>
          </CTable>
        </div>
      </CCardBody>
    </CCard>
  )
}

PlanTable.propTypes = {
  project: PropTypes.object.isRequired,
  onProjectChange: PropTypes.func.isRequired,
}
```

- [ ] **Step 3: Verify it lints and builds**

Run: `npm run build && npm run lint -- src/modules/pms/project-associate/MonthlyPlanPanel.jsx`
Expected: both exit 0, 0 errors (new file — still no baseline exceptions).

- [ ] **Step 4: Manual verification via browser console**

```js
const { localProjects } = await import('/src/services/localProjects.js')
const p = localProjects.create({ name: 'Table Test', project_value: 950000 / 0.95, admin_pct: 5, start_date: '2026-01-01', end_date: '2026-10-31' })
const generated = localProjects.generateMonthlyPlan(p.id, [
  { phase: 'design', label: 'Design', amount: 85000 },
  { phase: 'implementation', label: 'Field', amount: 10000 },
])
// month total 95000, hr_pct/core_pct default 5 -> hrAmount=coreAmount=4750, projectAmount=85500

const changed = localProjects.updateMonthPct(p.id, '2026-01', { hr_pct: 10 })
console.log(changed.monthly_plan[0].hr_pct) // expect 10
```

Then in the browser UI (once Task 6 wires this into the page): open a project with a generated plan, click a Core% up-arrow, confirm the displayed Core amount for that month increases and the Project amount decreases correspondingly, and the header balance badge still reads the correct plan-vs-pool comparison.

- [ ] **Step 5: Commit**

```bash
git add src/modules/pms/project-associate/MonthlyPlanPanel.jsx
git commit -m "feat: add editable monthly plan table with HR/Core % steppers"
```

---

## Task 6: Wire into `ProjectDetailPage.jsx` + restyle Activate button

**Files:**
- Modify: `src/modules/pms/project-associate/ProjectDetailPage.jsx`

**Interfaces:**
- Consumes: `MonthlyPlanPanel` (Task 4/5), `localTasks.getByProject` (existing).

- [ ] **Step 1: Import the new panel and `useAuth`**

Find line 69-75 (the existing import block: `localProjects`, `localTasks`, `localPayroll`, `localOrgPool`, `localAdminExpenses`, `useRole`, `ROLE`). Add:

```js
import MonthlyPlanPanel from './MonthlyPlanPanel'
```

- [ ] **Step 2: Add the task-count check**

Find where `const role = useRole()` is declared (search for `useRole()`). Right after it, add:

```js
  const projectTaskCount = useMemo(
    () => (project ? localTasks.getByProject(project.id).length : 0),
    [project],
  )
```

(`useMemo` is already imported at the top of the file; `localTasks` is already imported.)

- [ ] **Step 3: Restyle the Activate control**

Find the `!project.is_operations_active` block that renders the "▶ Activate Project" button (search for `Activate Project`):

```js
          {!project.is_operations_active && (
            <CButton
              color="success"
              className="fw-semibold flex-shrink-0"
              onClick={handleActivateProject}
            >
              ▶ Activate Project
            </CButton>
          )}
```

Replace with a greyed-out state (per spec Section 5 — a visible "Not Activated" label, not just a disabled button with a tooltip):

```js
          {!project.is_operations_active && projectTaskCount === 0 && (
            <CBadge
              color="secondary"
              className="px-3 py-2 d-flex align-items-center"
              style={{ fontSize: '0.8rem' }}
            >
              ⏸ Not Activated — assign a task first
            </CBadge>
          )}
          {!project.is_operations_active && projectTaskCount > 0 && (
            <CButton
              color="success"
              className="fw-semibold flex-shrink-0"
              onClick={handleActivateProject}
            >
              ▶ Activate Project
            </CButton>
          )}
```

- [ ] **Step 4: Add the Monthly Plan tab**

Find the tab list array (search for `'Budget & Payroll'`):

```js
            {[
              'Overview',
              'Project Officer',
              'Approvals',
              'Project Financials',
              'Project Milestones',
              'Budget & Payroll',
            ].map((tab, i) => (
```

Add a new tab entry:

```js
            {[
              'Overview',
              'Project Officer',
              'Approvals',
              'Project Financials',
              'Project Milestones',
              'Budget & Payroll',
              'Monthly Plan',
            ].map((tab, i) => (
```

Find the last `</CTabPane>` before `</CTabContent>` (the "Budget & Payroll" tab, `activeTab === 5`) and add a new pane right after it, before `</CTabContent>`:

```js
            {/* Monthly Plan Tab */}
            <CTabPane visible={activeTab === 6}>
              <MonthlyPlanPanel project={project} onProjectChange={setProject} />
            </CTabPane>
```

(`setProject` is the existing state setter already used throughout this file for every other mutation — e.g. `handleActivateProject` already calls `setProject(updated)`.)

- [ ] **Step 5: Verify it lints and builds**

Run: `npm run build && npm run lint -- src/modules/pms/project-associate/ProjectDetailPage.jsx`
Expected: `npm run build` exits 0. This file has a pre-existing baseline of 56 errors — the scoped lint run should report 56 or fewer.

- [ ] **Step 6: Manual verification in the browser**

Navigate to a project with no tasks assigned — confirm the "Not Activated" badge shows instead of the button. Assign a task via `/pms/daily-reports/tasks`, reload — confirm the "Activate Project" button now appears. Click the new "Monthly Plan" tab — confirm the template editor renders, fill in a template, click Generate, confirm the plan table renders with 10 rows and a "Balanced" badge.

- [ ] **Step 7: Commit**

```bash
git add src/modules/pms/project-associate/ProjectDetailPage.jsx
git commit -m "feat: wire MonthlyPlanPanel into project detail page, restyle Activate control"
```

---

## Task 7: Consolidated Sheet reads the new plan data

**Files:**
- Modify: `src/modules/ems/expense-management/ExpenseManagementPage.jsx`

**Interfaces:**
- Consumes: `computeMonthSplit` (Task 2), `project.monthly_plan` (Task 3).

This task gives the EMS Consolidated Sheet a basic (non-redistributed — that's Part 2) read of each active project's *current calendar month* Project/HR/Core split, replacing its dependency on the old `localOrgPool.getActiveProjectMonthlyBudgets` ledger call for projects that have a `monthly_plan`.

- [ ] **Step 1: Add the import**

At the top of `ExpenseManagementPage.jsx`, alongside the existing `localOrgPool`/`localProjects` imports, add:

```js
import { computeMonthSplit } from '../../../services/monthlyApportionment'
```

- [ ] **Step 2: Add a helper to resolve the current month's split for a project**

Find the `ConsolidatedSheet` component's `useEffect` (search for `getActiveProjectMonthlyBudgets`). Immediately above the `ConsolidatedSheet` component definition, add:

```js
const currentMonth = () => new Date().toISOString().slice(0, 7)

/** Resolves a project's Project/HR/Core split for the current month from its
 * monthly_plan, if one exists. Returns null for projects still on the old
 * (pre-monthly-plan) model. */
const currentMonthSplitFor = (project) => {
  if (!project?.monthly_plan?.length) return null
  const entry = project.monthly_plan.find((m) => m.month === currentMonth())
  if (!entry) return null
  return { ...computeMonthSplit(entry), monthTotal: entry.total }
}
```

- [ ] **Step 3: Prefer the new split when available**

Inside `ConsolidatedSheet`'s `useEffect`, find where `projs` and `sums` are built from `hrBudgets`/`coreBudgets`/`localOrgPool.getProjectHRBudgetSummary`. After that block builds `projs`, add an enrichment pass:

```js
    const enrichedProjs = projs.map((p) => {
      const fullProject = localProjects.getById(p.projectId)
      const newSplit = currentMonthSplitFor(fullProject)
      if (!newSplit) return p
      // p.sharePct (cross-project share) still comes from the old ledger for now — Part 2 replaces this too
      return { ...p, newMonthSplit: newSplit }
    })

    setProjects(enrichedProjs)
```

Replace the existing `setProjects(projs)` call with this block instead (delete the old `setProjects(projs)` line).

- [ ] **Step 4: Verify it lints and builds**

Run: `npm run build && npm run lint -- src/services/monthlyApportionment.js src/modules/ems/expense-management/ExpenseManagementPage.jsx`
Expected: `npm run build` exits 0. Combined baseline for the touched files is 38 (0 for the pure module, 38 pre-existing in `ExpenseManagementPage.jsx`); the scoped lint run should report 38 or fewer.

- [ ] **Step 5: Manual verification in the browser**

Create and activate a project with a generated monthly plan for the current month. Navigate to `/ems/expenses` → Consolidated Sheet. Confirm the project appears (existing ledger-based logic still gates visibility via `is_operations_active`) and that `console.log`-ing the component's `projects` state (via React DevTools or a temporary `console.log(enrichedProjs)` while testing) shows a `newMonthSplit` field with the current month's `projectAmount`/`hrAmount`/`coreAmount` matching what the Monthly Plan tab shows on the project's own page for that month.

- [ ] **Step 6: Commit**

```bash
git add src/modules/ems/expense-management/ExpenseManagementPage.jsx
git commit -m "feat: surface monthly-plan-derived split on the EMS Consolidated Sheet"
```

---

## Task 8: Fix `ProjectOverheadsList.jsx` crash (`localProjects.getAll()` doesn't exist)

**Files:**
- Modify: `src/modules/ems/projects/ProjectOverheadsList.jsx`

**Interfaces:**
- Consumes: `localProjects.list({})` (existing method) → `{ items, total, total_pages }`.

This is an unrelated pre-existing bug found during design review — bundled here since it's a one-line fix in a file this plan's neighbors already touch conceptually (EMS project overhead views).

- [ ] **Step 1: Fix the broken call**

Replace:

```js
    // Only fetch projects that are active/ongoing to show overheads
    const all = localProjects
      .getAll()
      .filter((p) => p.is_operations_active && ['ongoing', 'active', 'approved'].includes(p.status))
```

with:

```js
    // Only fetch projects that are active/ongoing to show overheads
    const all = localProjects
      .list({ pageSize: 1000 })
      .items.filter(
        (p) => p.is_operations_active && ['ongoing', 'active', 'approved'].includes(p.status),
      )
```

- [ ] **Step 2: Verify it lints and builds**

Run: `npm run build && npm run lint -- src/modules/ems/projects/ProjectOverheadsList.jsx`
Expected: `npm run build` exits 0. This file has a pre-existing lint baseline of 1 error; the scoped lint run should report 1 or fewer.

- [ ] **Step 3: Manual verification in the browser**

Navigate to the route that renders `ProjectOverheadsList` (check `grep -rn "ProjectOverheadsList" src/routes/` if unsure of the path). Confirm the page loads without a console error.

- [ ] **Step 4: Commit**

```bash
git add src/modules/ems/projects/ProjectOverheadsList.jsx
git commit -m "fix: ProjectOverheadsList crash from calling nonexistent localProjects.getAll()"
```
