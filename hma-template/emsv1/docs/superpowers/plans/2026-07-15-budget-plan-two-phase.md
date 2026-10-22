# Two-Phase Project Budget Plan (Planning → Actual) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the combined Monthly Plan table with a two-phase budget planner (planning → submitted/actual) driven by an explicit, zero-sum transfer ledger, per `docs/superpowers/specs/2026-07-15-budget-plan-two-phase-design.md`.

**Architecture:** A pure math module (`budgetPlan.js`, no imports, so it loads standalone via the project's `loadEsmSource` test helper) computes every derived figure from a `{ months, transfers }` shape. A persistence module (`localBudgetPlan.js`) stores one `budget_plan` per project under its own localStorage key (mirrors `localProjectExpenses.js`'s standalone-store convention — it does **not** live inside the `project` record or import `localProjects.js`, so it stays independently testable). UI components consume `localBudgetPlan` the way `MonthlyPlanPanel.jsx` consumes `localProjects`.

**Tech Stack:** React + CoreUI (matches existing PMS module), localStorage persistence, plain Node scripts with `node:assert/strict` for unit-style verification (this repo has no test runner installed — Vitest/Jest are not present, and adding one is out of scope; see Global Constraints).

## Global Constraints

- No new npm dependencies (checked: no vitest/jest/playwright/puppeteer installed; do not add one — verification follows the existing `scripts/verify-*.mjs` + `node:assert/strict` convention seen in `scripts/verify-gst-calculations.mjs`).
- PO/PA-facing entry UI is Excel-plain: plain bordered tables and plain inputs, no gradient cards, no decorative badges (per project convention already followed elsewhere in `MonthlyPlanPanel.jsx`'s table sections — do **not** carry over the dark-gradient "Recurring Tasks" card style).
- Money math: always round to paise (`Math.round(x * 100) / 100`) after every arithmetic step; multi-target splits use `equalSplit`, whose last recipient absorbs rounding so the parts always sum exactly (mirrors the existing convention in `src/services/monthlyApportionment.js`'s `pushSplit`).
- Old fields (`monthly_plan`, `pool_adjustments`, `sent_allocations`) and `MonthlyPlanPanel.jsx`/`monthlyApportionment.js` are left in place, untouched, unused by the new code — no migration, per spec Section 1/10.
- Every service function that mutates state either returns the updated plan or throws a plain `Error` with a user-displayable message — matches `localProjects.js` and `localProjectExpenses.js` conventions. Never swallow an error.
- Role gating: every new panel/action takes the same `canEdit` boolean prop the current `MonthlyPlanPanel` receives from `ProjectDetailPage.jsx` (`canEditMonthlyPlan`) — do not invent a new permission check.

---

## File Map

| File | Responsibility |
|---|---|
| `scripts/load-esm-source.mjs` | *(modified)* copy the temp file beside the source instead of beside the script, so a source file's same-directory relative imports resolve |
| `src/services/budgetPlan.js` | *(new)* pure math — no imports, no I/O |
| `scripts/verify-budget-plan.mjs` | *(new)* unit-style verification for `budgetPlan.js` |
| `src/services/localBudgetPlan.js` | *(new)* localStorage persistence, imports only `budgetPlan.js` |
| `scripts/verify-local-budget-plan.mjs` | *(new)* unit-style verification for `localBudgetPlan.js` |
| `src/modules/pms/project-associate/budget-plan/MonthPicker.jsx` | *(new)* shared checkbox month-selection popover |
| `src/modules/pms/project-associate/budget-plan/PlanHeader.jsx` | *(new)* totals strip, HR/Core capped inputs, Save/Reset/Reset-Calc/Full-Delete |
| `src/modules/pms/project-associate/budget-plan/RecurringTasksEntry.jsx` | *(new)* plain-table recurring task entry + Apply |
| `src/modules/pms/project-associate/budget-plan/PlanningMonthCard.jsx` | *(new)* one month, planning phase |
| `src/modules/pms/project-associate/budget-plan/ActualMonthCard.jsx` | *(new)* one month, actual phase |
| `src/modules/pms/project-associate/BudgetPlanPanel.jsx` | *(new)* container; renders init/planning/actual view from plan status |
| `src/modules/pms/project-associate/ProjectDetailPage.jsx` | *(modified)* render `BudgetPlanPanel` instead of `MonthlyPlanPanel` in the Monthly Plan tab; adapt the Expense tab's `ExpensePanel` import |
| `src/modules/pms/project-associate/MonthlyPlanPanel.jsx` | *(modified)* `ExpensePanel` reads actual-phase ledger transfers for the "Money transferred — ₹0" display |

---

### Task 1: `load-esm-source.mjs` — resolve same-directory relative imports

**Files:**
- Modify: `scripts/load-esm-source.mjs`
- Test: manual (verified by Task 3's script importing a two-file module graph)

**Interfaces:**
- Produces: `loadEsmSource(relPathFromProjectRoot)` — unchanged signature; now supports a source file that does `import { x } from './y.js'` when `y.js` lives in the same directory.

- [ ] **Step 1: Make the change**

Current behavior places the temp copy in `scripts/`, so a source file's same-directory relative import (e.g. `localBudgetPlan.js` doing `import { computeWorkingPool } from './budgetPlan.js'`) resolves to a nonexistent `scripts/budgetPlan.js`. Fix by placing the temp copy beside the original source file instead:

```js
// Loads an ESM-syntax source file from src/ into node.
// The package is CJS (no "type": "module"), so src .js files can't be
// imported directly — copy to a temp .mjs and import, then delete.
// The temp file is placed in the SAME directory as the source (not next to
// this script) so the source's own same-directory relative imports (e.g.
// `import { x } from './y.js'`) keep resolving correctly.
import { copyFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export const loadEsmSource = async (relPathFromProjectRoot) => {
  const src = join(here, '..', relPathFromProjectRoot)
  const base = relPathFromProjectRoot.split('/').pop()
  const tmp = join(dirname(src), `.tmp-${Date.now()}-${base}.mjs`)
  copyFileSync(src, tmp)
  try {
    return await import(`file://${tmp}`)
  } finally {
    rmSync(tmp, { force: true })
  }
}
```

- [ ] **Step 2: Verify existing scripts still pass (regression check)**

Run: `node scripts/verify-gst-calculations.mjs && node scripts/verify-gst-sheet-parser.mjs && node scripts/verify-local-gst-bills.mjs && echo ALL_OK`
Expected: `ALL_OK` printed, no assertion errors (these files have zero local imports, so the relocated temp path doesn't change their behavior — this step just confirms the change is safe).

- [ ] **Step 3: Commit**

```bash
git add scripts/load-esm-source.mjs
git commit -m "test(scripts): resolve same-directory relative imports in loadEsmSource"
```

---

### Task 2: `budgetPlan.js` — core derivation math

**Files:**
- Create: `src/services/budgetPlan.js`
- Create: `scripts/verify-budget-plan.mjs`

**Interfaces:**
- Produces: `monthsInRange(startDate, endDate)`, `equalSplit(amount, count)`, `computeWorkingPool(projectValue, poolPct)`, `monthBaseline(workingPool, monthCount)`, `netForEntity(transfers, entityKey)`, `monthAllocated(baseline, transfers, month)`, `monthPlannedTotal(tasks)`, `monthActualTotal(tasks)`, `poolBalance(projectValue, poolPct, pool, transfers)`, `monthAvailableBalance(baseline, transfers, monthTasksByMonth, month)` — all pure, all rupees rounded to paise.
- Entity key format used throughout: `` `month:${YYYY-MM}` `` for months, plain `'hr'` / `'core'` / `'admin'` for pools.
- Transfer shape consumed: `{ id, phase, origin_month, from, to, amount, created_at, created_by }` where `amount` is always positive and direction is `from → to`.

- [ ] **Step 1: Write the failing test**

Create `scripts/verify-budget-plan.mjs`:

```js
import assert from 'node:assert/strict'
import { loadEsmSource } from './load-esm-source.mjs'

const {
  monthsInRange,
  equalSplit,
  computeWorkingPool,
  monthBaseline,
  netForEntity,
  monthAllocated,
  monthPlannedTotal,
  monthActualTotal,
  poolBalance,
  monthAvailableBalance,
} = await loadEsmSource('src/services/budgetPlan.js')

// ── monthsInRange ───────────────────────────────────────────────────
assert.deepEqual(monthsInRange('2026-08', '2026-10'), ['2026-08', '2026-09', '2026-10'])
assert.deepEqual(monthsInRange('2026-11', '2027-01'), ['2026-11', '2026-12', '2027-01'])
assert.deepEqual(monthsInRange('', ''), [])

// ── equalSplit — exact paise, last recipient absorbs rounding ──────
assert.deepEqual(equalSplit(100, 3), [33.33, 33.33, 33.34])
assert.equal(
  equalSplit(100, 3).reduce((s, n) => s + n, 0),
  100,
)
assert.deepEqual(equalSplit(5000, 9).reduce((s, n) => s + n, 0), 5000)
assert.deepEqual(equalSplit(10, 1), [10])
assert.deepEqual(equalSplit(10, 0), [])

// ── computeWorkingPool ──────────────────────────────────────────────
assert.equal(computeWorkingPool(1000000, { admin: 5, hr: 5, core: 5 }), 850000)
assert.equal(computeWorkingPool(1000000, { admin: 5, hr: 5, core: 6 }), 840000)

// ── monthBaseline ───────────────────────────────────────────────────
assert.equal(monthBaseline(850000, 10), 85000)
assert.equal(monthBaseline(850000, 0), 0)

// ── netForEntity ────────────────────────────────────────────────────
const transfers = [
  { from: 'month:2026-08', to: 'hr', amount: 2000 },
  { from: 'hr', to: 'month:2026-09', amount: 500 },
]
assert.equal(netForEntity(transfers, 'month:2026-08'), -2000)
assert.equal(netForEntity(transfers, 'hr'), 2000 - 500)
assert.equal(netForEntity(transfers, 'month:2026-09'), 500)
assert.equal(netForEntity(transfers, 'core'), 0)

// ── monthAllocated ──────────────────────────────────────────────────
assert.equal(monthAllocated(85000, transfers, '2026-08'), 83000)
assert.equal(monthAllocated(85000, transfers, '2026-09'), 85500)
assert.equal(monthAllocated(85000, transfers, '2026-10'), 85000)

// ── monthPlannedTotal / monthActualTotal ───────────────────────────
const tasks = [
  {
    phase: 'implementation',
    name: 'Training',
    subtasks: [
      { name: 'Venue rent', planned_amount: 5000, actual_amount: 4200 },
      { name: 'Food', planned_amount: 3000, actual_amount: 3000 },
    ],
  },
  {
    phase: 'design',
    name: 'Survey',
    subtasks: [{ name: 'Printing', planned_amount: 2000, actual_amount: 0 }],
  },
]
assert.equal(monthPlannedTotal(tasks), 10000)
assert.equal(monthActualTotal(tasks), 7200)
assert.equal(monthPlannedTotal([]), 0)
assert.equal(monthPlannedTotal(undefined), 0)

// ── poolBalance ─────────────────────────────────────────────────────
assert.equal(poolBalance(1000000, { admin: 5, hr: 5, core: 5 }, 'hr', transfers), 50000 + 1500)
assert.equal(poolBalance(1000000, { admin: 5, hr: 5, core: 5 }, 'core', transfers), 50000)

// ── monthAvailableBalance ───────────────────────────────────────────
// month 2026-08 is allocated 83000 (after the -2000 transfer above) with 10000 planned → 73000 spare
const byMonth = { '2026-08': tasks }
assert.equal(monthAvailableBalance(85000, transfers, byMonth, '2026-08'), 73000)
assert.equal(monthAvailableBalance(85000, transfers, {}, '2026-10'), 85000)

console.log('budgetPlan.js: ALL PASSED')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-budget-plan.mjs`
Expected: `Error [ERR_MODULE_NOT_FOUND]` — `src/services/budgetPlan.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `src/services/budgetPlan.js`:

```js
/**
 * budgetPlan.js — Pure math for the two-phase project budget plan
 * (spec: docs/superpowers/specs/2026-07-15-budget-plan-two-phase-design.md).
 * No localStorage or other I/O, and NO imports of any other module —
 * every function is a plain data-in/data-out transform, and the file must
 * stay import-free so it loads standalone via scripts/load-esm-source.mjs.
 * (monthsInRange is intentionally duplicated from monthlyApportionment.js
 * for this reason, not shared.)
 */

/** Every calendar month from start to end ('YYYY-MM' or 'YYYY-MM-DD'), inclusive. */
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
 * Splits `amount` into `count` shares that sum to it exactly, in paise —
 * every share is the floor share except the last, which absorbs whatever
 * paise remain. This is the one splitting rule used everywhere in this
 * module (Send/Take to multiple months, HR/Core 50/50).
 */
export const equalSplit = (amount, count) => {
  if (count <= 0) return []
  const totalPaise = Math.round(amount * 100)
  const basePaise = Math.floor(totalPaise / count)
  const shares = Array(count).fill(basePaise)
  shares[count - 1] += totalPaise - basePaise * count
  return shares.map((p) => p / 100)
}

/** Working pool = project value minus Admin/HR/Core's independent percentages. */
export const computeWorkingPool = (projectValue, poolPct) => {
  const projectPct = 100 - (poolPct.admin || 0) - (poolPct.hr || 0) - (poolPct.core || 0)
  return Math.round(projectValue * (projectPct / 100) * 100) / 100
}

/** The working pool spread evenly across every month — the pre-transfer baseline. */
export const monthBaseline = (workingPool, monthCount) =>
  monthCount > 0 ? Math.round((workingPool / monthCount) * 100) / 100 : 0

/**
 * Net effect of the ledger on one entity (a month or a pool): every
 * transfer TO the entity adds, every transfer FROM it subtracts. This is
 * the only place the ledger is read — every other derived figure in this
 * module is baseline/base-rate plus this.
 */
export const netForEntity = (transfers, entityKey) =>
  Math.round(
    (transfers || []).reduce((s, t) => {
      if (t.to === entityKey) return s + t.amount
      if (t.from === entityKey) return s - t.amount
      return s
    }, 0) * 100,
  ) / 100

/** A month's current allocated budget: baseline plus/minus every transfer touching it. */
export const monthAllocated = (baseline, transfers, month) =>
  Math.round((baseline + netForEntity(transfers, `month:${month}`)) * 100) / 100

/** Sum of every subtask's planned_amount across a month's task list. */
export const monthPlannedTotal = (tasks) =>
  Math.round(
    (tasks || []).reduce(
      (s, t) =>
        s + (t.subtasks || []).reduce((ss, st) => ss + (parseFloat(st.planned_amount) || 0), 0),
      0,
    ) * 100,
  ) / 100

/** Sum of every subtask's actual_amount across a month's task list. */
export const monthActualTotal = (tasks) =>
  Math.round(
    (tasks || []).reduce(
      (s, t) =>
        s + (t.subtasks || []).reduce((ss, st) => ss + (parseFloat(st.actual_amount) || 0), 0),
      0,
    ) * 100,
  ) / 100

/**
 * A pool's current balance: its base rate (pct% of project value) plus/
 * minus every ledger transfer touching it. Never clamped here — clamping
 * happens at the point a transfer is validated (validateTransfer), so an
 * already-valid ledger can never produce a negative balance.
 */
export const poolBalance = (projectValue, poolPct, pool, transfers) => {
  const base = Math.round(((projectValue * (poolPct[pool] || 0)) / 100) * 100) / 100
  return Math.round((base + netForEntity(transfers, pool)) * 100) / 100
}

/** How much of a month's allocated budget is not yet claimed by a planned subtask. */
export const monthAvailableBalance = (baseline, transfers, monthTasksByMonth, month) =>
  Math.round(
    (monthAllocated(baseline, transfers, month) -
      monthPlannedTotal((monthTasksByMonth || {})[month] || [])) *
      100,
  ) / 100
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-budget-plan.mjs`
Expected: `budgetPlan.js: ALL PASSED`

- [ ] **Step 5: Commit**

```bash
git add src/services/budgetPlan.js scripts/verify-budget-plan.mjs
git commit -m "feat(pms): add budgetPlan.js core derivation math"
```

---

### Task 3: `budgetPlan.js` — transfer validation, settlement check, invariant

**Files:**
- Modify: `src/services/budgetPlan.js`
- Modify: `scripts/verify-budget-plan.mjs`

**Interfaces:**
- Consumes: everything from Task 2.
- Produces: `validateTransfer(ctx, { from, to, amount })`, `removeTransfersOriginatingFrom(transfers, month)`, `grandInvariantCheck(ctx)`, `settlementCheck(ctx)` where `ctx = { projectValue, poolPct, months, monthTasksByMonth, transfers }`.

- [ ] **Step 1: Write the failing test**

Append to `scripts/verify-budget-plan.mjs` (before the final `console.log` line — move that line to the end after adding this):

```js
// ── validateTransfer ────────────────────────────────────────────────
const ctx = {
  projectValue: 1000000,
  poolPct: { admin: 5, hr: 5, core: 5 },
  months: ['2026-08', '2026-09', '2026-10'],
  monthTasksByMonth: { '2026-08': tasks },
  transfers: [],
}

assert.deepEqual(validateTransfer(ctx, { from: 'hr', to: 'month:2026-08', amount: 0 }), {
  valid: false,
  error: 'Amount must be greater than zero.',
})
assert.equal(validateTransfer(ctx, { from: 'hr', to: 'month:2026-08', amount: 100 }).valid, true)
// hr only has 50000 — asking for more fails
assert.equal(
  validateTransfer(ctx, { from: 'hr', to: 'month:2026-08', amount: 999999 }).valid,
  false,
)
// baseline = monthBaseline(850000, 3) = 283333.33; month 2026-08 has 10000 planned
// (from `tasks`) → 273333.33 available to take, to the paisa
assert.equal(
  validateTransfer(ctx, { from: 'month:2026-08', to: 'hr', amount: 273333.33 }).valid,
  true,
)
assert.equal(
  validateTransfer(ctx, { from: 'month:2026-08', to: 'hr', amount: 273333.34 }).valid,
  false,
)
assert.equal(
  validateTransfer(ctx, { from: 'month:2099-01', to: 'hr', amount: 10 }).valid,
  false,
  'month outside project duration is rejected',
)
assert.equal(validateTransfer(ctx, { from: 'bogus', to: 'hr', amount: 10 }).valid, false)

// ── removeTransfersOriginatingFrom ──────────────────────────────────
const taggedTransfers = [
  { origin_month: '2026-08', from: 'month:2026-08', to: 'hr', amount: 100 },
  { origin_month: '2026-09', from: 'hr', to: 'month:2026-09', amount: 50 },
]
assert.deepEqual(removeTransfersOriginatingFrom(taggedTransfers, '2026-08'), [taggedTransfers[1]])

// ── grandInvariantCheck ─────────────────────────────────────────────
const invCtx = {
  projectValue: 1000000,
  poolPct: { admin: 5, hr: 5, core: 5 },
  months: ['2026-08', '2026-09', '2026-10'],
  transfers: [],
}
assert.equal(grandInvariantCheck(invCtx).valid, true)
assert.equal(grandInvariantCheck(invCtx).grandTotal, 1000000)

// ── settlementCheck ─────────────────────────────────────────────────
// Fully settled: 3 months, each planned exactly = baseline (283333.33 * 2 + 283333.34)
const settledMonths = ['2026-08', '2026-09', '2026-10']
const wp = computeWorkingPool(1000000, { admin: 5, hr: 5, core: 5 }) // 850000
const perMonth = equalSplit(wp, 3) // exact baseline per month
const settledByMonth = Object.fromEntries(
  settledMonths.map((m, i) => [
    m,
    [{ phase: 'design', name: 'x', subtasks: [{ name: 'y', planned_amount: perMonth[i] }] }],
  ]),
)
const settledCheck = settlementCheck({
  projectValue: 1000000,
  poolPct: { admin: 5, hr: 5, core: 5 },
  months: settledMonths,
  monthTasksByMonth: settledByMonth,
  transfers: [],
})
assert.equal(settledCheck.valid, true)
assert.equal(settledCheck.monthIssues.length, 0)
assert.equal(settledCheck.adminDraw, null)

// Over-planned beyond working pool + HR + Core (the 96% regression case):
// project value 1,000,000, 1 month, plan = 960,000 (96%), pools at default 5/5/5
// → working pool baseline is 850,000; excess of 110,000 must draw HR(50k)+Core(50k)
// fully, leaving 10,000 short, which is exactly the admin draw needed (not 5%/50,000).
const regressionCheck = settlementCheck({
  projectValue: 1000000,
  poolPct: { admin: 5, hr: 5, core: 5 },
  months: ['2026-08'],
  monthTasksByMonth: {
    '2026-08': [{ phase: 'design', name: 'x', subtasks: [{ name: 'y', planned_amount: 960000 }] }],
  },
  transfers: [],
})
assert.equal(regressionCheck.valid, false)
assert.equal(regressionCheck.totalShortfall, 110000)
assert.ok(regressionCheck.adminDraw)
assert.equal(regressionCheck.adminDraw.amount, 10000, 'admin only gives the true remainder, not a flat 5%')

console.log('budgetPlan.js: ALL PASSED')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-budget-plan.mjs`
Expected: `TypeError: validateTransfer is not a function` (not yet exported).

- [ ] **Step 3: Write the implementation**

Append to `src/services/budgetPlan.js`:

```js
const isPoolKey = (k) => k === 'hr' || k === 'core' || k === 'admin'
const isMonthKey = (k) => typeof k === 'string' && k.startsWith('month:')
const monthOf = (key) => key.slice('month:'.length)

/**
 * Validates one proposed transfer against current balances. Rejects: a
 * non-positive amount, an unrecognized from/to key, a month outside the
 * project's duration, a pool source that doesn't have the funds, or a
 * month source whose available balance (allocated − planned) is smaller
 * than the amount. This is the single choke point that keeps every pool
 * and every month non-negative by construction — callers must run every
 * transfer through this before appending it to the ledger.
 */
export const validateTransfer = (
  { projectValue, poolPct, transfers, months, monthTasksByMonth, baseline },
  { from, to, amount },
) => {
  const amt = Math.round((parseFloat(amount) || 0) * 100) / 100
  if (amt <= 0) return { valid: false, error: 'Amount must be greater than zero.' }
  if (!isPoolKey(from) && !isMonthKey(from)) {
    return { valid: false, error: 'Invalid transfer source.' }
  }
  if (!isPoolKey(to) && !isMonthKey(to)) {
    return { valid: false, error: 'Invalid transfer target.' }
  }
  if (isMonthKey(from) && !(months || []).includes(monthOf(from))) {
    return { valid: false, error: `${monthOf(from)} is outside the project's duration.` }
  }
  if (isMonthKey(to) && !(months || []).includes(monthOf(to))) {
    return { valid: false, error: `${monthOf(to)} is outside the project's duration.` }
  }
  if (isPoolKey(from)) {
    const balance = poolBalance(projectValue, poolPct, from, transfers)
    if (amt - balance > 0.005) {
      return { valid: false, error: `${from.toUpperCase()} only has ₹${balance.toFixed(2)} available.` }
    }
  }
  if (isMonthKey(from)) {
    const month = monthOf(from)
    const effectiveBaseline =
      baseline ?? monthBaseline(computeWorkingPool(projectValue, poolPct), (months || []).length)
    const available = monthAvailableBalance(effectiveBaseline, transfers, monthTasksByMonth, month)
    if (amt - available > 0.005) {
      return { valid: false, error: `${month} only has ₹${available.toFixed(2)} balance available.` }
    }
  }
  return { valid: true }
}

/** Drops every ledger record whose origin_month is the given month (used by month Reset). */
export const removeTransfersOriginatingFrom = (transfers, month) =>
  (transfers || []).filter((t) => t.origin_month !== month)

/** Σ month allocated + Σ pool balances must always equal project value. */
export const grandInvariantCheck = ({ projectValue, poolPct, months, transfers }) => {
  const workingPool = computeWorkingPool(projectValue, poolPct)
  const baseline = monthBaseline(workingPool, (months || []).length)
  const monthsTotal = (months || []).reduce((s, m) => s + monthAllocated(baseline, transfers, m), 0)
  const poolsTotal = ['hr', 'core', 'admin'].reduce(
    (s, p) => s + poolBalance(projectValue, poolPct, p, transfers),
    0,
  )
  const grandTotal = Math.round((monthsTotal + poolsTotal) * 100) / 100
  const diff = Math.round((grandTotal - projectValue) * 100) / 100
  return { valid: Math.abs(diff) < 0.01, grandTotal, projectValue, diff }
}

/**
 * The Submit-time checklist (spec Section 5). Every month must have
 * planned === allocated to the paisa; if not, reports the total shortfall
 * (over-planned months) and surplus (under-planned months) so the UI can
 * name the offending months. When there's a shortfall, also reports
 * whether HR+Core can cover it and, if not, the exact remainder Admin
 * would need to cover (the 85/95/100 ladder) — never a flat percentage.
 */
export const settlementCheck = ({ projectValue, poolPct, months, monthTasksByMonth, transfers }) => {
  const workingPool = computeWorkingPool(projectValue, poolPct)
  const baseline = monthBaseline(workingPool, (months || []).length)

  const monthIssues = (months || [])
    .map((month) => {
      const allocated = monthAllocated(baseline, transfers, month)
      const planned = monthPlannedTotal((monthTasksByMonth || {})[month] || [])
      const diff = Math.round((planned - allocated) * 100) / 100
      return { month, allocated, planned, diff }
    })
    .filter((i) => Math.abs(i.diff) >= 0.01)

  const totalShortfall =
    Math.round(monthIssues.filter((i) => i.diff > 0).reduce((s, i) => s + i.diff, 0) * 100) / 100
  const totalSurplus =
    Math.round(monthIssues.filter((i) => i.diff < 0).reduce((s, i) => s - i.diff, 0) * 100) / 100

  const hrBalance = poolBalance(projectValue, poolPct, 'hr', transfers)
  const coreBalance = poolBalance(projectValue, poolPct, 'core', transfers)
  const adminBalance = poolBalance(projectValue, poolPct, 'admin', transfers)
  const poolsNonNegative = hrBalance >= -0.005 && coreBalance >= -0.005 && adminBalance >= -0.005

  const invariantOk = grandInvariantCheck({ projectValue, poolPct, months, transfers }).valid

  let adminDraw = null
  if (totalShortfall > 0) {
    const coverableByHrCore = Math.min(totalShortfall, Math.max(hrBalance, 0) + Math.max(coreBalance, 0))
    const remainder = Math.round((totalShortfall - coverableByHrCore) * 100) / 100
    if (remainder > 0.005) {
      const cappedAmount = Math.min(remainder, Math.max(adminBalance, 0))
      adminDraw = {
        amount: Math.round(cappedAmount * 100) / 100,
        fullyCovered: remainder <= adminBalance + 0.005,
      }
    }
  }

  return {
    valid: monthIssues.length === 0 && invariantOk && poolsNonNegative,
    monthIssues,
    totalShortfall,
    totalSurplus,
    invariantOk,
    poolsNonNegative,
    adminDraw,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-budget-plan.mjs`
Expected: `budgetPlan.js: ALL PASSED`

- [ ] **Step 5: Commit**

```bash
git add src/services/budgetPlan.js scripts/verify-budget-plan.mjs
git commit -m "feat(pms): add budgetPlan.js transfer validation and settlement check"
```

---

### Task 4: `localBudgetPlan.js` — plan lifecycle (initialize/get/save/reset/delete)

**Files:**
- Create: `src/services/localBudgetPlan.js`
- Create: `scripts/verify-local-budget-plan.mjs`

**Interfaces:**
- Consumes: `budgetPlan.js` exports from Tasks 2–3.
- Produces: `localBudgetPlan.getPlan(projectId)`, `initializePlan(projectId, { projectValue, startDate, endDate, poolPct })`, `save(projectId)`, `reset(projectId)`, `fullDelete(projectId)`.
- Plan shape produced: matches spec Section 3 exactly — `{ version: 2, status, submitted_at, pool_pct, months: [{ month, tasks: [] }], transfers: [], saved_snapshot: null }`.

- [ ] **Step 1: Write the failing test**

Create `scripts/verify-local-budget-plan.mjs`:

```js
import assert from 'node:assert/strict'
import { loadEsmSource } from './load-esm-source.mjs'

// minimal localStorage shim — must be installed BEFORE the module loads
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

const { localBudgetPlan } = await loadEsmSource('src/services/localBudgetPlan.js')

const PID = 'proj_test_1'

// ── initialize ──────────────────────────────────────────────────────
assert.equal(localBudgetPlan.getPlan(PID), null)
let plan = localBudgetPlan.initializePlan(PID, {
  projectValue: 1000000,
  startDate: '2026-08',
  endDate: '2026-10',
  poolPct: { admin: 5, hr: 5, core: 5 },
})
assert.equal(plan.status, 'planning')
assert.equal(plan.months.length, 3)
assert.deepEqual(
  plan.months.map((m) => m.month),
  ['2026-08', '2026-09', '2026-10'],
)
assert.deepEqual(plan.transfers, [])
assert.equal(plan.saved_snapshot, null)
assert.deepEqual(localBudgetPlan.getPlan(PID), plan)

// re-initializing an existing plan throws (must fullDelete first)
assert.throws(() => localBudgetPlan.initializePlan(PID, { projectValue: 1, startDate: '2026-08', endDate: '2026-09', poolPct: { admin: 5, hr: 5, core: 5 } }))

// ── save / reset ────────────────────────────────────────────────────
plan.months[0].tasks.push({ id: 't1', phase: 'design', name: 'X', subtasks: [] })
localBudgetPlan.__setPlanForTest(PID, plan) // test-only direct write, see Step 3
localBudgetPlan.save(PID)
const afterSave = localBudgetPlan.getPlan(PID)
assert.ok(afterSave.saved_snapshot)
assert.equal(afterSave.saved_snapshot.months[0].tasks.length, 1)

// mutate further, then reset back to the save point
afterSave.months[0].tasks.push({ id: 't2', phase: 'design', name: 'Y', subtasks: [] })
localBudgetPlan.__setPlanForTest(PID, afterSave)
assert.equal(localBudgetPlan.getPlan(PID).months[0].tasks.length, 2)
const afterReset = localBudgetPlan.reset(PID)
assert.equal(afterReset.months[0].tasks.length, 1, 'reset restores the saved snapshot')

// reset with no prior save restores the empty initialized state
localBudgetPlan.fullDelete(PID)
plan = localBudgetPlan.initializePlan(PID, {
  projectValue: 1000000,
  startDate: '2026-08',
  endDate: '2026-09',
  poolPct: { admin: 5, hr: 5, core: 5 },
})
plan.months[0].tasks.push({ id: 't3', phase: 'design', name: 'Z', subtasks: [] })
localBudgetPlan.__setPlanForTest(PID, plan)
const resetToEmpty = localBudgetPlan.reset(PID)
assert.equal(resetToEmpty.months[0].tasks.length, 0, 'reset with no save point restores empty months')

// ── fullDelete ──────────────────────────────────────────────────────
localBudgetPlan.fullDelete(PID)
assert.equal(localBudgetPlan.getPlan(PID), null)

console.log('localBudgetPlan.js: ALL PASSED')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-local-budget-plan.mjs`
Expected: `Error [ERR_MODULE_NOT_FOUND]` — `src/services/localBudgetPlan.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `src/services/localBudgetPlan.js`:

```js
/**
 * localBudgetPlan.js — localStorage persistence for the two-phase project
 * budget plan (spec: docs/superpowers/specs/2026-07-15-budget-plan-two-phase-design.md).
 * Stored under its own key, one plan per project id — mirrors the
 * standalone-store convention of localProjectExpenses.js rather than
 * embedding into the project record, so this module only ever needs
 * budgetPlan.js (no dependency on localProjects.js and its demo-seed data).
 */
import {
  monthsInRange,
  monthBaseline,
  computeWorkingPool,
  validateTransfer,
  removeTransfersOriginatingFrom,
  settlementCheck,
  equalSplit,
} from './budgetPlan.js'

const KEY = 'hma_budget_plans_v1'

const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
const now = () => new Date().toISOString()

const readAll = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}
const writeAll = (all) => localStorage.setItem(KEY, JSON.stringify(all))

const emptyMonths = (months) => months.map((month) => ({ month, tasks: [] }))

const requirePlan = (all, projectId) => {
  const plan = all[projectId]
  if (!plan) throw new Error('No budget plan exists for this project yet.')
  return plan
}

export const localBudgetPlan = {
  getPlan(projectId) {
    return readAll()[projectId] || null
  },

  /** Test-only direct writer — lets verify scripts set up mutated fixtures
   * without duplicating every mutation helper. Not used by any UI code. */
  __setPlanForTest(projectId, plan) {
    const all = readAll()
    all[projectId] = plan
    writeAll(all)
  },

  initializePlan(projectId, { projectValue, startDate, endDate, poolPct }) {
    const all = readAll()
    if (all[projectId]) {
      throw new Error('A budget plan already exists for this project — use Full Delete first.')
    }
    const months = monthsInRange(startDate, endDate)
    if (months.length === 0) {
      throw new Error('Project must have a start and end date before initializing a plan.')
    }
    const plan = {
      version: 2,
      status: 'planning',
      submitted_at: null,
      project_value: projectValue,
      start_date: startDate,
      end_date: endDate,
      pool_pct: { admin: poolPct?.admin ?? 5, hr: poolPct?.hr ?? 5, core: poolPct?.core ?? 5 },
      months: emptyMonths(months),
      transfers: [],
      saved_snapshot: null,
    }
    all[projectId] = plan
    writeAll(all)
    return plan
  },

  save(projectId) {
    const all = readAll()
    const plan = requirePlan(all, projectId)
    plan.saved_snapshot = {
      months: JSON.parse(JSON.stringify(plan.months)),
      transfers: JSON.parse(JSON.stringify(plan.transfers)),
      saved_at: now(),
    }
    writeAll(all)
    return plan
  },

  reset(projectId) {
    const all = readAll()
    const plan = requirePlan(all, projectId)
    if (plan.saved_snapshot) {
      plan.months = JSON.parse(JSON.stringify(plan.saved_snapshot.months))
      plan.transfers = JSON.parse(JSON.stringify(plan.saved_snapshot.transfers))
    } else {
      plan.months = emptyMonths(plan.months.map((m) => m.month))
      plan.transfers = []
    }
    writeAll(all)
    return plan
  },

  fullDelete(projectId) {
    const all = readAll()
    delete all[projectId]
    writeAll(all)
  },
}
```

Note: `monthBaseline`, `computeWorkingPool`, `validateTransfer`, `removeTransfersOriginatingFrom`, `settlementCheck`, `equalSplit` are imported now so later tasks in this same file (4–7) don't need another import edit; unused-import lint will pass once Task 5–7 add their call sites in this same file before it's committed as a whole module. If your linter runs per-task, ignore an unused-import warning at this step — Task 5 uses `equalSplit`/`validateTransfer` immediately next.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-local-budget-plan.mjs`
Expected: `localBudgetPlan.js: ALL PASSED`

- [ ] **Step 5: Commit**

```bash
git add src/services/localBudgetPlan.js scripts/verify-local-budget-plan.mjs
git commit -m "feat(pms): add localBudgetPlan.js lifecycle (initialize/save/reset/delete)"
```

---

### Task 5: `localBudgetPlan.js` — task/subtask CRUD + recurring tasks

**Files:**
- Modify: `src/services/localBudgetPlan.js`
- Modify: `scripts/verify-local-budget-plan.mjs`

**Interfaces:**
- Produces: `addTask(projectId, month, { phase, name, recurring })`, `removeTask(projectId, month, taskId)`, `addSubtask(projectId, month, taskId, { name, planned_amount })`, `removeSubtask(projectId, month, taskId, subtaskId)`, `updateSubtaskPlanned(projectId, month, taskId, subtaskId, amount)`, `applyRecurringTasks(projectId, { phase, name, totalAmount })`.
- All of these throw `Error('Plan is locked — planning is closed.')` if `plan.status !== 'planning'`, except they aren't reachable in the actual phase anyway (UI-gated), but the service layer enforces it independently since it's the source of truth.

- [ ] **Step 1: Write the failing test**

Append to `scripts/verify-local-budget-plan.mjs` (before `console.log`):

```js
// ── task/subtask CRUD ───────────────────────────────────────────────
localBudgetPlan.fullDelete(PID)
plan = localBudgetPlan.initializePlan(PID, {
  projectValue: 1000000,
  startDate: '2026-08',
  endDate: '2026-09',
  poolPct: { admin: 5, hr: 5, core: 5 },
})

plan = localBudgetPlan.addTask(PID, '2026-08', { phase: 'implementation', name: 'Training' })
const taskId = plan.months[0].tasks[0].id
assert.equal(plan.months[0].tasks[0].name, 'Training')
assert.deepEqual(plan.months[0].tasks[0].subtasks, [])
assert.equal(plan.months[0].tasks[0].recurring, false)
assert.equal(plan.months[0].tasks[0].added_in_actual, false)

plan = localBudgetPlan.addSubtask(PID, '2026-08', taskId, { name: 'Venue rent', planned_amount: 5000 })
const subtaskId = plan.months[0].tasks[0].subtasks[0].id
assert.equal(plan.months[0].tasks[0].subtasks[0].planned_amount, 5000)
assert.equal(plan.months[0].tasks[0].subtasks[0].actual_amount, 0)
assert.equal(plan.months[0].tasks[0].subtasks[0].actual_status, 'pending')

plan = localBudgetPlan.updateSubtaskPlanned(PID, '2026-08', taskId, subtaskId, 6000)
assert.equal(plan.months[0].tasks[0].subtasks[0].planned_amount, 6000)

plan = localBudgetPlan.addSubtask(PID, '2026-08', taskId, { name: 'Food', planned_amount: 1000 })
assert.equal(plan.months[0].tasks[0].subtasks.length, 2)
const foodId = plan.months[0].tasks[0].subtasks[1].id
plan = localBudgetPlan.removeSubtask(PID, '2026-08', taskId, foodId)
assert.equal(plan.months[0].tasks[0].subtasks.length, 1)

plan = localBudgetPlan.removeTask(PID, '2026-08', taskId)
assert.equal(plan.months[0].tasks.length, 0)

// ── recurring tasks ─────────────────────────────────────────────────
plan = localBudgetPlan.applyRecurringTasks(PID, {
  phase: 'monitoring',
  name: 'Field visit',
  totalAmount: 100,
})
assert.equal(plan.months[0].tasks.length, 1)
assert.equal(plan.months[1].tasks.length, 1)
assert.equal(plan.months[0].tasks[0].recurring, true)
// 100 split across 2 months: 50/50
assert.equal(plan.months[0].tasks[0].subtasks[0].planned_amount, 50)
assert.equal(plan.months[1].tasks[0].subtasks[0].planned_amount, 50)

// ── locked once submitted ───────────────────────────────────────────
plan.status = 'submitted'
localBudgetPlan.__setPlanForTest(PID, plan)
assert.throws(() => localBudgetPlan.addTask(PID, '2026-08', { phase: 'design', name: 'X' }), /locked/)
plan.status = 'planning'
localBudgetPlan.__setPlanForTest(PID, plan)

console.log('localBudgetPlan.js: ALL PASSED')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-local-budget-plan.mjs`
Expected: `TypeError: localBudgetPlan.addTask is not a function`

- [ ] **Step 3: Write the implementation**

Insert into the `localBudgetPlan` object in `src/services/localBudgetPlan.js`, after `fullDelete`:

```js
  requirePlanning(plan) {
    if (plan.status !== 'planning') {
      throw new Error('Plan is locked — planning is closed.')
    }
  },

  addTask(projectId, month, { phase, name, recurring = false }) {
    const all = readAll()
    const plan = requirePlan(all, projectId)
    localBudgetPlan.requirePlanning(plan)
    const monthEntry = plan.months.find((m) => m.month === month)
    if (!monthEntry) throw new Error(`${month} is not part of this plan.`)
    monthEntry.tasks.push({
      id: uid('task'),
      phase,
      name: (name || '').trim(),
      recurring,
      added_in_actual: false,
      subtasks: [],
    })
    writeAll(all)
    return plan
  },

  removeTask(projectId, month, taskId) {
    const all = readAll()
    const plan = requirePlan(all, projectId)
    localBudgetPlan.requirePlanning(plan)
    const monthEntry = plan.months.find((m) => m.month === month)
    if (!monthEntry) throw new Error(`${month} is not part of this plan.`)
    monthEntry.tasks = monthEntry.tasks.filter((t) => t.id !== taskId)
    writeAll(all)
    return plan
  },

  addSubtask(projectId, month, taskId, { name, planned_amount }) {
    const all = readAll()
    const plan = requirePlan(all, projectId)
    localBudgetPlan.requirePlanning(plan)
    const monthEntry = plan.months.find((m) => m.month === month)
    if (!monthEntry) throw new Error(`${month} is not part of this plan.`)
    const task = monthEntry.tasks.find((t) => t.id === taskId)
    if (!task) throw new Error('Task not found.')
    task.subtasks.push({
      id: uid('sub'),
      name: (name || '').trim(),
      planned_amount: Math.round((parseFloat(planned_amount) || 0) * 100) / 100,
      actual_amount: 0,
      actual_status: 'pending',
    })
    writeAll(all)
    return plan
  },

  removeSubtask(projectId, month, taskId, subtaskId) {
    const all = readAll()
    const plan = requirePlan(all, projectId)
    localBudgetPlan.requirePlanning(plan)
    const monthEntry = plan.months.find((m) => m.month === month)
    if (!monthEntry) throw new Error(`${month} is not part of this plan.`)
    const task = monthEntry.tasks.find((t) => t.id === taskId)
    if (!task) throw new Error('Task not found.')
    task.subtasks = task.subtasks.filter((s) => s.id !== subtaskId)
    writeAll(all)
    return plan
  },

  updateSubtaskPlanned(projectId, month, taskId, subtaskId, amount) {
    const all = readAll()
    const plan = requirePlan(all, projectId)
    localBudgetPlan.requirePlanning(plan)
    const monthEntry = plan.months.find((m) => m.month === month)
    if (!monthEntry) throw new Error(`${month} is not part of this plan.`)
    const task = monthEntry.tasks.find((t) => t.id === taskId)
    if (!task) throw new Error('Task not found.')
    const subtask = task.subtasks.find((s) => s.id === subtaskId)
    if (!subtask) throw new Error('Subtask not found.')
    subtask.planned_amount = Math.round((parseFloat(amount) || 0) * 100) / 100
    writeAll(all)
    return plan
  },

  /** Divides `totalAmount` equally across every month, creating one
   * recurring task + single subtask per month (spec Section 4.1). */
  applyRecurringTasks(projectId, { phase, name, totalAmount }) {
    const all = readAll()
    const plan = requirePlan(all, projectId)
    localBudgetPlan.requirePlanning(plan)
    const amt = Math.round((parseFloat(totalAmount) || 0) * 100) / 100
    if (amt <= 0) throw new Error('Total amount must be greater than zero.')
    if (!name || !name.trim()) throw new Error('A task name is required.')
    const shares = equalSplit(amt, plan.months.length)
    plan.months.forEach((monthEntry, i) => {
      monthEntry.tasks.push({
        id: uid('task'),
        phase,
        name: name.trim(),
        recurring: true,
        added_in_actual: false,
        subtasks: [
          {
            id: uid('sub'),
            name: name.trim(),
            planned_amount: shares[i],
            actual_amount: 0,
            actual_status: 'pending',
          },
        ],
      })
    })
    writeAll(all)
    return plan
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-local-budget-plan.mjs`
Expected: `localBudgetPlan.js: ALL PASSED`

- [ ] **Step 5: Commit**

```bash
git add src/services/localBudgetPlan.js scripts/verify-local-budget-plan.mjs
git commit -m "feat(pms): add localBudgetPlan.js task/subtask CRUD and recurring tasks"
```

---

### Task 6: `localBudgetPlan.js` — transfers, month reset, HR/Core cap adjustment

**Files:**
- Modify: `src/services/localBudgetPlan.js`
- Modify: `scripts/verify-local-budget-plan.mjs`

**Interfaces:**
- Produces: `moveBalance(projectId, { originMonth, direction, targets, amount, phase, createdBy, subtaskRef })`, `revokeTransfer(projectId, transferId)`, `resetMonth(projectId, month)`, `setPoolCapAdjustment(projectId, { pool, targetMonth, newAmount, createdBy })`.
- `direction` is `'send'` (money leaves `originMonth`, split across `targets`) or `'take'` (money arrives at `originMonth`, drawn from `targets`). `targets` is an array of entity keys (`'hr'`, `'core'`, or `` `month:X` ``). `subtaskRef` is `{ month, taskId, subtaskId } | undefined` — when present and `direction === 'send'` and `phase === 'actual'`, that subtask's `actual_status` is set to `'transferred'` (spec Section 6's "Money transferred — ₹0" trigger).

- [ ] **Step 1: Write the failing test**

Append to `scripts/verify-local-budget-plan.mjs` (before `console.log`):

```js
// ── moveBalance: send from a month to HR/Core (planning phase) ─────
localBudgetPlan.fullDelete(PID)
plan = localBudgetPlan.initializePlan(PID, {
  projectValue: 1000000,
  startDate: '2026-08',
  endDate: '2026-10',
  poolPct: { admin: 5, hr: 5, core: 5 },
})
// month 2026-08 baseline is ~283,333.33 (850000/3); send 3000 to HR+Core, 50/50
plan = localBudgetPlan.moveBalance(PID, {
  originMonth: '2026-08',
  direction: 'send',
  targets: ['hr', 'core'],
  amount: 3000,
  phase: 'planning',
  createdBy: 'PO',
})
const sendTransfers = plan.transfers.filter((t) => t.origin_month === '2026-08')
assert.equal(sendTransfers.length, 2)
assert.equal(
  sendTransfers.reduce((s, t) => s + t.amount, 0),
  3000,
)
assert.ok(sendTransfers.every((t) => t.from === 'month:2026-08'))
assert.deepEqual(sendTransfers.map((t) => t.to).sort(), ['core', 'hr'])

// ── moveBalance: send to multiple months, equal split ──────────────
plan = localBudgetPlan.moveBalance(PID, {
  originMonth: '2026-09',
  direction: 'send',
  targets: ['month:2026-08', 'month:2026-10'],
  amount: 100,
  phase: 'planning',
  createdBy: 'PO',
})
const monthSendTransfers = plan.transfers.filter((t) => t.origin_month === '2026-09')
assert.equal(monthSendTransfers.length, 2)
assert.deepEqual(
  monthSendTransfers.map((t) => t.amount).sort((a, b) => a - b),
  [50, 50],
)

// ── moveBalance: take from HR/Core into a month ────────────────────
const beforeTake = JSON.parse(JSON.stringify(plan))
plan = localBudgetPlan.moveBalance(PID, {
  originMonth: '2026-10',
  direction: 'take',
  targets: ['hr'],
  amount: 200,
  phase: 'planning',
  createdBy: 'PO',
})
const takeTransfer = plan.transfers.find(
  (t) => t.origin_month === '2026-10' && t.from === 'hr' && t.to === 'month:2026-10',
)
assert.ok(takeTransfer)
assert.equal(takeTransfer.amount, 200)

// ── moveBalance rejects an invalid transfer with a plain error ──────
assert.throws(
  () =>
    localBudgetPlan.moveBalance(PID, {
      originMonth: '2026-10',
      direction: 'take',
      targets: ['hr'],
      amount: 9999999,
      phase: 'planning',
      createdBy: 'PO',
    }),
  /available/,
)

// ── revokeTransfer ──────────────────────────────────────────────────
const toRevoke = plan.transfers.find((t) => t.id === takeTransfer.id)
plan = localBudgetPlan.revokeTransfer(PID, toRevoke.id)
assert.equal(plan.transfers.some((t) => t.id === toRevoke.id), false)

// revoking a planning transfer after submit is blocked
const someTransferId = plan.transfers[0].id
plan.status = 'submitted'
localBudgetPlan.__setPlanForTest(PID, plan)
assert.throws(() => localBudgetPlan.revokeTransfer(PID, someTransferId), /locked/)
plan.status = 'planning'
localBudgetPlan.__setPlanForTest(PID, plan)

// ── resetMonth ───────────────────────────────────────────────────────
// 2026-09's outgoing transfers should vanish; 2026-08/2026-10's incoming
// halves of that same pair also vanish (paired removal, both sides
// tagged with origin_month = 2026-09 in this implementation — see below).
const beforeResetMonth = localBudgetPlan.getPlan(PID)
plan = localBudgetPlan.resetMonth(PID, '2026-09')
assert.equal(
  plan.transfers.some((t) => t.origin_month === '2026-09'),
  false,
)
// the 2026-08 → HR/Core send from earlier (origin_month 2026-08) must still be there
assert.ok(plan.transfers.some((t) => t.origin_month === '2026-08'))

// ── setPoolCapAdjustment ─────────────────────────────────────────────
localBudgetPlan.fullDelete(PID)
plan = localBudgetPlan.initializePlan(PID, {
  projectValue: 1000000,
  startDate: '2026-08',
  endDate: '2026-08',
  poolPct: { admin: 5, hr: 5, core: 5 },
})
// HR cap is 50000 (5% of 1,000,000). Lower it to 30000 → 20000 flows to the target month.
plan = localBudgetPlan.setPoolCapAdjustment(PID, {
  pool: 'hr',
  targetMonth: '2026-08',
  newAmount: 30000,
  createdBy: 'PO',
})
const capTransfer = plan.transfers.find((t) => t.tag === 'pool_cap_adjustment' && t.pool_ref === 'hr')
assert.ok(capTransfer)
assert.equal(capTransfer.amount, 20000)
// raising it back above the 50000 cap is rejected
assert.throws(() =>
  localBudgetPlan.setPoolCapAdjustment(PID, {
    pool: 'hr',
    targetMonth: '2026-08',
    newAmount: 60000,
    createdBy: 'PO',
  }),
)
// raising back to exactly the cap removes the adjustment transfer entirely
plan = localBudgetPlan.setPoolCapAdjustment(PID, {
  pool: 'hr',
  targetMonth: '2026-08',
  newAmount: 50000,
  createdBy: 'PO',
})
assert.equal(
  plan.transfers.some((t) => t.tag === 'pool_cap_adjustment' && t.pool_ref === 'hr'),
  false,
)

console.log('localBudgetPlan.js: ALL PASSED')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-local-budget-plan.mjs`
Expected: `TypeError: localBudgetPlan.moveBalance is not a function`

- [ ] **Step 3: Write the implementation**

Insert into the `localBudgetPlan` object in `src/services/localBudgetPlan.js`, after `applyRecurringTasks`:

```js
  buildMonthTasksByMonth(plan) {
    return Object.fromEntries(plan.months.map((m) => [m.month, m.tasks]))
  },

  buildTransferCtx(plan) {
    const months = plan.months.map((m) => m.month)
    const baseline = monthBaseline(computeWorkingPool(plan.project_value, plan.pool_pct), months.length)
    return {
      projectValue: plan.project_value,
      poolPct: plan.pool_pct,
      months,
      monthTasksByMonth: localBudgetPlan.buildMonthTasksByMonth(plan),
      transfers: plan.transfers,
      baseline,
    }
  },

  /**
   * Moves `amount` either away from `originMonth` (direction 'send', split
   * across `targets`) or into it (direction 'take', drawn from `targets`),
   * validating and appending one ledger record per target. `subtaskRef`
   * (actual phase only) flags the originating subtask 'transferred' when
   * sending its remainder away (spec Section 6).
   */
  moveBalance(projectId, { originMonth, direction, targets, amount, phase, createdBy, subtaskRef }) {
    const all = readAll()
    const plan = requirePlan(all, projectId)
    const amt = Math.round((parseFloat(amount) || 0) * 100) / 100
    if (amt <= 0) throw new Error('Amount must be greater than zero.')
    if (!targets || targets.length === 0) throw new Error('Select at least one destination.')

    const shares = equalSplit(amt, targets.length)
    const ctx = localBudgetPlan.buildTransferCtx(plan)
    const newTransfers = []

    targets.forEach((target, i) => {
      const share = shares[i]
      const from = direction === 'send' ? `month:${originMonth}` : target
      const to = direction === 'send' ? target : `month:${originMonth}`
      const validation = validateTransfer(
        { ...ctx, transfers: [...ctx.transfers, ...newTransfers] },
        { from, to, amount: share },
      )
      if (!validation.valid) throw new Error(validation.error)
      newTransfers.push({
        id: uid('xfer'),
        phase,
        origin_month: originMonth,
        from,
        to,
        amount: share,
        created_at: now(),
        created_by: createdBy || 'Unknown',
      })
    })

    plan.transfers = [...plan.transfers, ...newTransfers]

    if (subtaskRef && direction === 'send' && phase === 'actual') {
      const monthEntry = plan.months.find((m) => m.month === subtaskRef.month)
      const task = monthEntry?.tasks.find((t) => t.id === subtaskRef.taskId)
      const subtask = task?.subtasks.find((s) => s.id === subtaskRef.subtaskId)
      if (subtask) subtask.actual_status = 'transferred'
    }

    writeAll(all)
    return plan
  },

  /** Removes one ledger record by id. Planning-phase transfers are frozen once submitted. */
  revokeTransfer(projectId, transferId) {
    const all = readAll()
    const plan = requirePlan(all, projectId)
    const transfer = plan.transfers.find((t) => t.id === transferId)
    if (!transfer) throw new Error('Transfer not found.')
    if (transfer.phase === 'planning' && plan.status === 'submitted') {
      throw new Error('Planning transfers are locked after submit.')
    }
    plan.transfers = plan.transfers.filter((t) => t.id !== transferId)
    writeAll(all)
    return plan
  },

  /**
   * Reset this month: restore its tasks from the save snapshot (or empty)
   * AND drop every ledger transfer this month originated (which restores
   * every other month/pool that transfer touched) — spec Section 4.2.
   * Transfers where this month is only a counterparty (originated by a
   * DIFFERENT month) are kept.
   */
  resetMonth(projectId, month) {
    const all = readAll()
    const plan = requirePlan(all, projectId)
    localBudgetPlan.requirePlanning(plan)
    const monthEntry = plan.months.find((m) => m.month === month)
    if (!monthEntry) throw new Error(`${month} is not part of this plan.`)

    const savedMonth = plan.saved_snapshot?.months.find((m) => m.month === month)
    monthEntry.tasks = savedMonth ? JSON.parse(JSON.stringify(savedMonth.tasks)) : []
    plan.transfers = removeTransfersOriginatingFrom(plan.transfers, month)

    writeAll(all)
    return plan
  },

  /**
   * The header HR/Core amount input (spec Section 4.1): upserts the single
   * pool→month adjustment tagged 'pool_cap_adjustment' for this pool,
   * capped so the pool's balance never exceeds its original pct cap.
   * Raising back to exactly the cap removes the adjustment (no no-op record).
   */
  setPoolCapAdjustment(projectId, { pool, targetMonth, newAmount, createdBy }) {
    const all = readAll()
    const plan = requirePlan(all, projectId)
    localBudgetPlan.requirePlanning(plan)
    if (pool !== 'hr' && pool !== 'core') throw new Error('Pool must be hr or core.')

    const cap = Math.round(((plan.project_value * (plan.pool_pct[pool] || 0)) / 100) * 100) / 100
    const amt = Math.round((parseFloat(newAmount) || 0) * 100) / 100
    if (amt > cap + 0.005) {
      throw new Error(`${pool.toUpperCase()} cannot be raised above its set ₹${cap.toFixed(2)}.`)
    }
    if (amt < 0) throw new Error(`${pool.toUpperCase()} cannot go below zero.`)

    const delta = Math.round((cap - amt) * 100) / 100
    const withoutExisting = plan.transfers.filter(
      (t) => !(t.tag === 'pool_cap_adjustment' && t.pool_ref === pool),
    )

    if (Math.abs(delta) < 0.01) {
      plan.transfers = withoutExisting
    } else {
      plan.transfers = [
        ...withoutExisting,
        {
          id: uid('xfer'),
          phase: 'planning',
          origin_month: targetMonth,
          from: pool,
          to: `month:${targetMonth}`,
          amount: delta,
          tag: 'pool_cap_adjustment',
          pool_ref: pool,
          created_at: now(),
          created_by: createdBy || 'Unknown',
        },
      ]
    }
    writeAll(all)
    return plan
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-local-budget-plan.mjs`
Expected: `localBudgetPlan.js: ALL PASSED`

- [ ] **Step 5: Commit**

```bash
git add src/services/localBudgetPlan.js scripts/verify-local-budget-plan.mjs
git commit -m "feat(pms): add localBudgetPlan.js transfers, month reset, HR/Core cap adjustment"
```

---

### Task 7: `localBudgetPlan.js` — submit, admin draw, actual phase

**Files:**
- Modify: `src/services/localBudgetPlan.js`
- Modify: `scripts/verify-local-budget-plan.mjs`

**Interfaces:**
- Produces: `computeSettlement(projectId)`, `submit(projectId)`, `drawFromAdmin(projectId, { createdBy })`, `updateActual(projectId, month, taskId, subtaskId, amount)`, `addActualTask(projectId, month, { phase, name })`.
- `moveBalance` (Task 6) is reused unchanged for actual-phase Send/Take — it already accepts `phase: 'actual'` and `subtaskRef`.

- [ ] **Step 1: Write the failing test**

Append to `scripts/verify-local-budget-plan.mjs` (before `console.log`):

```js
// ── computeSettlement / submit ──────────────────────────────────────
localBudgetPlan.fullDelete(PID)
plan = localBudgetPlan.initializePlan(PID, {
  projectValue: 300000,
  startDate: '2026-08',
  endDate: '2026-08',
  poolPct: { admin: 5, hr: 5, core: 5 },
})
// working pool = 255000, 1 month → baseline 255000. Plan nothing yet → unsettled (surplus).
let check = localBudgetPlan.computeSettlement(PID)
assert.equal(check.valid, false)
assert.equal(check.totalSurplus, 255000)
assert.throws(() => localBudgetPlan.submit(PID), /settle/i)

plan = localBudgetPlan.addTask(PID, '2026-08', { phase: 'design', name: 'X' })
const soleTaskId = plan.months[0].tasks[0].id
plan = localBudgetPlan.addSubtask(PID, '2026-08', soleTaskId, { name: 'Y', planned_amount: 255000 })
check = localBudgetPlan.computeSettlement(PID)
assert.equal(check.valid, true)

plan = localBudgetPlan.submit(PID)
assert.equal(plan.status, 'submitted')
assert.ok(plan.submitted_at)
assert.equal(plan.months[0].tasks[0].subtasks[0].actual_amount, 0)
assert.equal(plan.months[0].tasks[0].subtasks[0].actual_status, 'pending')

// planning mutators are now locked
assert.throws(() => localBudgetPlan.addTask(PID, '2026-08', { phase: 'design', name: 'Z' }), /locked/)

// ── drawFromAdmin (96% regression case, exercised pre-submit) ───────
localBudgetPlan.fullDelete(PID)
plan = localBudgetPlan.initializePlan(PID, {
  projectValue: 1000000,
  startDate: '2026-08',
  endDate: '2026-08',
  poolPct: { admin: 5, hr: 5, core: 5 },
})
plan = localBudgetPlan.addTask(PID, '2026-08', { phase: 'design', name: 'Big' })
const bigTaskId = plan.months[0].tasks[0].id
plan = localBudgetPlan.addSubtask(PID, '2026-08', bigTaskId, { name: 'Everything', planned_amount: 960000 })
check = localBudgetPlan.computeSettlement(PID)
assert.equal(check.adminDraw.amount, 10000)
assert.throws(() => localBudgetPlan.submit(PID), /settle/i, 'still unsettled — HR/Core not yet drawn')

// PO takes from HR/Core first (as the ladder message directs)
plan = localBudgetPlan.moveBalance(PID, {
  originMonth: '2026-08',
  direction: 'take',
  targets: ['hr', 'core'],
  amount: 100000,
  phase: 'planning',
  createdBy: 'PO',
})
check = localBudgetPlan.computeSettlement(PID)
assert.equal(check.valid, false)
assert.equal(check.adminDraw.amount, 10000, 'exactly the true remainder, not a flat 5%')

plan = localBudgetPlan.drawFromAdmin(PID, { createdBy: 'PO' })
check = localBudgetPlan.computeSettlement(PID)
assert.equal(check.valid, true)
assert.ok(
  localBudgetPlan.getPlan(PID).transfers.some((t) => t.from === 'admin' && t.to === 'month:2026-08'),
)
plan = localBudgetPlan.submit(PID)
assert.equal(plan.status, 'submitted')

// ── actual phase: updateActual, addActualTask, Send remainder ──────
plan = localBudgetPlan.updateActual(PID, '2026-08', bigTaskId, plan.months[0].tasks[0].subtasks[0].id, 900000)
const bigSubtaskId = plan.months[0].tasks[0].subtasks[0].id
assert.equal(plan.months[0].tasks[0].subtasks[0].actual_amount, 900000)
assert.equal(plan.months[0].tasks[0].subtasks[0].actual_status, 'entered')

plan = localBudgetPlan.addActualTask(PID, '2026-08', { phase: 'monitoring', name: 'Unplanned extra' })
const extraTask = plan.months[0].tasks.find((t) => t.name === 'Unplanned extra')
assert.equal(extraTask.added_in_actual, true)
assert.equal(extraTask.subtasks.length, 0)

// send the 60000 actual remainder from the big subtask to HR/Core
plan = localBudgetPlan.moveBalance(PID, {
  originMonth: '2026-08',
  direction: 'send',
  targets: ['hr', 'core'],
  amount: 60000,
  phase: 'actual',
  createdBy: 'PO',
  subtaskRef: { month: '2026-08', taskId: bigTaskId, subtaskId: bigSubtaskId },
})
assert.equal(
  plan.months[0].tasks[0].subtasks[0].actual_status,
  'transferred',
  'sending a subtask remainder flags it transferred',
)

console.log('localBudgetPlan.js: ALL PASSED')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-local-budget-plan.mjs`
Expected: `TypeError: localBudgetPlan.computeSettlement is not a function`

- [ ] **Step 3: Write the implementation**

Insert into the `localBudgetPlan` object in `src/services/localBudgetPlan.js`, after `setPoolCapAdjustment`:

```js
  computeSettlement(projectId) {
    const plan = requirePlan(readAll(), projectId)
    return settlementCheck(localBudgetPlan.buildTransferCtx(plan))
  },

  /** Submits the plan (spec Section 5) — blocked until settlementCheck.valid. */
  submit(projectId) {
    const all = readAll()
    const plan = requirePlan(all, projectId)
    localBudgetPlan.requirePlanning(plan)
    const check = settlementCheck(localBudgetPlan.buildTransferCtx(plan))
    if (!check.valid) {
      throw new Error(
        'Plan is not fully settled — settle every month (and any HR/Core/Admin shortfall) before submitting.',
      )
    }
    plan.status = 'submitted'
    plan.submitted_at = now()
    writeAll(all)
    return plan
  },

  /**
   * The one last-resort submit-time action (spec Section 5): draws the
   * settlementCheck's reported adminDraw.amount from Admin, split equally
   * across every month still in deficit after HR/Core's own capacity is
   * accounted for by settlementCheck's math.
   */
  drawFromAdmin(projectId, { createdBy }) {
    const all = readAll()
    const plan = requirePlan(all, projectId)
    localBudgetPlan.requirePlanning(plan)
    const check = settlementCheck(localBudgetPlan.buildTransferCtx(plan))
    if (!check.adminDraw || check.adminDraw.amount <= 0) {
      throw new Error('No Admin draw is needed right now.')
    }
    const deficitMonths = check.monthIssues.filter((i) => i.diff > 0).map((i) => i.month)
    const shares = equalSplit(check.adminDraw.amount, deficitMonths.length)
    const newTransfers = deficitMonths.map((month, i) => ({
      id: uid('xfer'),
      phase: 'planning',
      origin_month: month,
      from: 'admin',
      to: `month:${month}`,
      amount: shares[i],
      created_at: now(),
      created_by: createdBy || 'Unknown',
    }))
    plan.transfers = [...plan.transfers, ...newTransfers]
    writeAll(all)
    return plan
  },

  requireSubmitted(plan) {
    if (plan.status !== 'submitted') {
      throw new Error('Actual expense entry opens only after the plan is submitted.')
    }
  },

  updateActual(projectId, month, taskId, subtaskId, amount) {
    const all = readAll()
    const plan = requirePlan(all, projectId)
    localBudgetPlan.requireSubmitted(plan)
    const monthEntry = plan.months.find((m) => m.month === month)
    const task = monthEntry?.tasks.find((t) => t.id === taskId)
    const subtask = task?.subtasks.find((s) => s.id === subtaskId)
    if (!subtask) throw new Error('Subtask not found.')
    const amt = Math.round((parseFloat(amount) || 0) * 100) / 100
    subtask.actual_amount = amt
    subtask.actual_status = amt > 0 ? 'entered' : 'pending'
    writeAll(all)
    return plan
  },

  /** New task row added during actual entry — has no planned amount (spec Section 6). */
  addActualTask(projectId, month, { phase, name }) {
    const all = readAll()
    const plan = requirePlan(all, projectId)
    localBudgetPlan.requireSubmitted(plan)
    const monthEntry = plan.months.find((m) => m.month === month)
    if (!monthEntry) throw new Error(`${month} is not part of this plan.`)
    monthEntry.tasks.push({
      id: uid('task'),
      phase,
      name: (name || '').trim(),
      recurring: false,
      added_in_actual: true,
      subtasks: [],
    })
    writeAll(all)
    return plan
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-local-budget-plan.mjs`
Expected: `localBudgetPlan.js: ALL PASSED`

- [ ] **Step 5: Run both service verify scripts together (regression)**

Run: `node scripts/verify-budget-plan.mjs && node scripts/verify-local-budget-plan.mjs && echo ALL_OK`
Expected: `ALL_OK`

- [ ] **Step 6: Commit**

```bash
git add src/services/localBudgetPlan.js scripts/verify-local-budget-plan.mjs
git commit -m "feat(pms): add localBudgetPlan.js submit, admin draw, and actual-phase entry"
```

---

### Task 8: `MonthPicker.jsx` — shared month-selection popover

**Files:**
- Create: `src/modules/pms/project-associate/budget-plan/MonthPicker.jsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure UI component).
- Produces: `<MonthPicker months={string[]} excludeMonth={string} label={string} onConfirm={(selectedMonths: string[]) => void} disabled={boolean} />` — a button that opens a small checkbox popover; clicking Confirm calls `onConfirm` with the checked months and closes. Used by both `PlanningMonthCard` and `ActualMonthCard` for every "Send to other months" / "Take from months" action (Tasks 10–11).

- [ ] **Step 1: Write the component**

```jsx
import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { CButton, CFormCheck, CPopover } from '@coreui/react'

const monthLabel = (ym) => {
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

const MonthPicker = ({ months, excludeMonth, label, onConfirm, disabled = false }) => {
  const [open, setOpen] = useState(false)
  const [checked, setChecked] = useState([])
  const options = months.filter((m) => m !== excludeMonth)

  const toggle = (m) =>
    setChecked((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))

  const handleConfirm = () => {
    if (checked.length === 0) return
    onConfirm(checked)
    setChecked([])
    setOpen(false)
  }

  if (options.length === 0) return null

  return (
    <CPopover
      visible={open}
      onHide={() => setOpen(false)}
      placement="bottom"
      content={
        <div style={{ minWidth: 180 }}>
          {options.map((m) => (
            <CFormCheck
              key={m}
              id={`mp-${m}-${label}`}
              label={monthLabel(m)}
              checked={checked.includes(m)}
              onChange={() => toggle(m)}
              className="mb-1"
            />
          ))}
          <CButton size="sm" color="primary" className="mt-2 w-100" onClick={handleConfirm}>
            Confirm ({checked.length} selected — split equally)
          </CButton>
        </div>
      }
    >
      <CButton size="sm" color="secondary" variant="outline" disabled={disabled} onClick={() => setOpen((v) => !v)}>
        {label}
      </CButton>
    </CPopover>
  )
}

MonthPicker.propTypes = {
  months: PropTypes.arrayOf(PropTypes.string).isRequired,
  excludeMonth: PropTypes.string,
  label: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
}

export default MonthPicker
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/jojo/labs/git-lab/HMA/hma-template/emsv1 && npx eslint src/modules/pms/project-associate/budget-plan/MonthPicker.jsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/pms/project-associate/budget-plan/MonthPicker.jsx
git commit -m "feat(pms): add MonthPicker shared component for budget plan transfers"
```

---

### Task 9: `PlanHeader.jsx` + `RecurringTasksEntry.jsx`

**Files:**
- Create: `src/modules/pms/project-associate/budget-plan/PlanHeader.jsx`
- Create: `src/modules/pms/project-associate/budget-plan/RecurringTasksEntry.jsx`

**Interfaces:**
- Consumes: `localBudgetPlan.save/reset/fullDelete/setPoolCapAdjustment` (Tasks 4, 6), `poolBalance`/`computeWorkingPool` (Task 2) for display.
- Produces: `<PlanHeader plan={object} canEdit={bool} onPlanChange={(plan)=>void} onFullDelete={()=>void} currentUser={string} />`, `<RecurringTasksEntry plan={object} canEdit={bool} onPlanChange={(plan)=>void} />`.

- [ ] **Step 1: Write `PlanHeader.jsx`**

```jsx
import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { CButton, CCard, CCardBody, CFormInput, CInputGroup, CInputGroupText, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter } from '@coreui/react'
import { computeWorkingPool, poolBalance } from '../../../../services/budgetPlan'
import { localBudgetPlan } from '../../../../services/localBudgetPlan'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0)

const PlanHeader = ({ project, plan, canEdit, onPlanChange, onFullDelete, currentUser, focusedMonth }) => {
  const [confirmModal, setConfirmModal] = useState(null) // 'reset' | 'delete' | null
  const workingPool = computeWorkingPool(plan.project_value, plan.pool_pct)
  const hrBalance = poolBalance(plan.project_value, plan.pool_pct, 'hr', plan.transfers)
  const coreBalance = poolBalance(plan.project_value, plan.pool_pct, 'core', plan.transfers)
  const adminBalance = poolBalance(plan.project_value, plan.pool_pct, 'admin', plan.transfers)

  const handleSave = () => onPlanChange(localBudgetPlan.save(project.id))
  const handleResetCalculation = () => onPlanChange(localBudgetPlan.getPlan(project.id))
  const handlePoolInput = (pool, value) => {
    const target = focusedMonth || plan.months[0]?.month
    if (!target) return
    onPlanChange(
      localBudgetPlan.setPoolCapAdjustment(project.id, {
        pool,
        targetMonth: target,
        newAmount: parseFloat(value) || 0,
        createdBy: currentUser,
      }),
    )
  }

  return (
    <CCard className="mb-3">
      <CCardBody>
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-2">
          <div>
            <div className="small text-body-secondary">Total Project Value</div>
            <div className="fw-bold">{fmt(plan.project_value)}</div>
          </div>
          <div>
            <div className="small text-body-secondary">Duration</div>
            <div className="fw-bold">{plan.months.length} month{plan.months.length !== 1 ? 's' : ''}</div>
          </div>
          <div>
            <div className="small text-body-secondary">Project ({100 - plan.pool_pct.admin - plan.pool_pct.hr - plan.pool_pct.core}%)</div>
            <div className="fw-bold">{fmt(workingPool)}</div>
          </div>
          <div style={{ minWidth: 160 }}>
            <div className="small text-body-secondary">Admin ({plan.pool_pct.admin}%)</div>
            <div className="fw-bold">{fmt(adminBalance)}</div>
          </div>
          <div style={{ minWidth: 180 }}>
            <div className="small text-body-secondary">HR (max {plan.pool_pct.hr}%)</div>
            {canEdit && plan.status === 'planning' ? (
              <CInputGroup size="sm">
                <CInputGroupText>₹</CInputGroupText>
                <CFormInput type="number" value={hrBalance} onChange={(e) => handlePoolInput('hr', e.target.value)} />
              </CInputGroup>
            ) : (
              <div className="fw-bold">{fmt(hrBalance)}</div>
            )}
          </div>
          <div style={{ minWidth: 180 }}>
            <div className="small text-body-secondary">Core (max {plan.pool_pct.core}%)</div>
            {canEdit && plan.status === 'planning' ? (
              <CInputGroup size="sm">
                <CInputGroupText>₹</CInputGroupText>
                <CFormInput type="number" value={coreBalance} onChange={(e) => handlePoolInput('core', e.target.value)} />
              </CInputGroup>
            ) : (
              <div className="fw-bold">{fmt(coreBalance)}</div>
            )}
          </div>
        </div>

        {canEdit && plan.status === 'planning' && (
          <div className="d-flex flex-wrap gap-2">
            <CButton size="sm" color="primary" onClick={handleSave}>Save</CButton>
            <CButton size="sm" color="secondary" variant="outline" onClick={() => setConfirmModal('reset')}>Reset</CButton>
            <CButton size="sm" color="secondary" variant="outline" onClick={handleResetCalculation}>Reset Calculation</CButton>
            <CButton size="sm" color="danger" variant="outline" onClick={() => setConfirmModal('delete')}>Full Delete</CButton>
          </div>
        )}
      </CCardBody>

      <CModal visible={Boolean(confirmModal)} onClose={() => setConfirmModal(null)} alignment="center" size="sm">
        <CModalHeader><CModalTitle>Confirm</CModalTitle></CModalHeader>
        <CModalBody className="small">
          {confirmModal === 'reset'
            ? 'This restores every month and transfer back to the last Save (or the empty state if you never saved). Continue?'
            : 'This permanently deletes the entire budget plan. Continue?'}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" size="sm" onClick={() => setConfirmModal(null)}>Cancel</CButton>
          <CButton
            color="danger"
            size="sm"
            onClick={() => {
              if (confirmModal === 'reset') onPlanChange(localBudgetPlan.reset(project.id))
              else onFullDelete()
              setConfirmModal(null)
            }}
          >
            Confirm
          </CButton>
        </CModalFooter>
      </CModal>
    </CCard>
  )
}

PlanHeader.propTypes = {
  project: PropTypes.object.isRequired,
  plan: PropTypes.object.isRequired,
  canEdit: PropTypes.bool,
  onPlanChange: PropTypes.func.isRequired,
  onFullDelete: PropTypes.func.isRequired,
  currentUser: PropTypes.string,
  focusedMonth: PropTypes.string,
}

export default PlanHeader
```

- [ ] **Step 2: Write `RecurringTasksEntry.jsx`**

```jsx
import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { CButton, CCard, CCardBody, CCardHeader, CFormInput, CFormSelect, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from '@coreui/react'
import { localBudgetPlan } from '../../../../services/localBudgetPlan'

const PHASE_OPTIONS = [
  { value: 'design', label: 'Design' },
  { value: 'implementation', label: 'Implementation' },
  { value: 'monitoring', label: 'Monitoring' },
]

const RecurringTasksEntry = ({ project, plan, canEdit, onPlanChange }) => {
  const [phase, setPhase] = useState('design')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  if (!canEdit || plan.status !== 'planning') return null

  const handleApply = () => {
    setError('')
    try {
      const updated = localBudgetPlan.applyRecurringTasks(project.id, {
        phase,
        name,
        totalAmount: parseFloat(amount) || 0,
      })
      onPlanChange(updated)
      setName('')
      setAmount('')
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <CCard className="mb-3">
      <CCardHeader className="fw-semibold">Recurring Tasks</CCardHeader>
      <CCardBody>
        <div className="small text-body-secondary mb-2">
          Enter a task once — Apply divides its total equally across all {plan.months.length} months.
        </div>
        <CTable bordered small align="middle" className="mb-2">
          <CTableHead color="light">
            <CTableRow>
              <CTableHeaderCell>Phase</CTableHeaderCell>
              <CTableHeaderCell>Task</CTableHeaderCell>
              <CTableHeaderCell>Total Amount</CTableHeaderCell>
              <CTableHeaderCell></CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            <CTableRow>
              <CTableDataCell>
                <CFormSelect size="sm" value={phase} onChange={(e) => setPhase(e.target.value)}>
                  {PHASE_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </CFormSelect>
              </CTableDataCell>
              <CTableDataCell>
                <CFormInput size="sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Task name" />
              </CTableDataCell>
              <CTableDataCell>
                <CFormInput size="sm" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
              </CTableDataCell>
              <CTableDataCell>
                <CButton size="sm" color="primary" onClick={handleApply}>Apply</CButton>
              </CTableDataCell>
            </CTableRow>
          </CTableBody>
        </CTable>
        {error && <div className="text-danger small">{error}</div>}
      </CCardBody>
    </CCard>
  )
}

RecurringTasksEntry.propTypes = {
  project: PropTypes.object.isRequired,
  plan: PropTypes.object.isRequired,
  canEdit: PropTypes.bool,
  onPlanChange: PropTypes.func.isRequired,
}

export default RecurringTasksEntry
```

- [ ] **Step 3: Verify both compile**

Run: `cd /home/jojo/labs/git-lab/HMA/hma-template/emsv1 && npx eslint src/modules/pms/project-associate/budget-plan/PlanHeader.jsx src/modules/pms/project-associate/budget-plan/RecurringTasksEntry.jsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/pms/project-associate/budget-plan/PlanHeader.jsx src/modules/pms/project-associate/budget-plan/RecurringTasksEntry.jsx
git commit -m "feat(pms): add budget plan header and recurring tasks entry components"
```

---

### Task 10: `PlanningMonthCard.jsx`

**Files:**
- Create: `src/modules/pms/project-associate/budget-plan/PlanningMonthCard.jsx`

**Interfaces:**
- Consumes: `localBudgetPlan.addTask/removeTask/addSubtask/removeSubtask/updateSubtaskPlanned/moveBalance/revokeTransfer/resetMonth` (Tasks 5–6), `monthAllocated/monthPlannedTotal/monthAvailableBalance` (Task 2), `MonthPicker` (Task 8).
- Produces: `<PlanningMonthCard project={object} plan={object} month={string} colorIndex={number} canEdit={bool} onPlanChange={(plan)=>void} currentUser={string} onFocus={()=>void} />`.

- [ ] **Step 1: Write the component**

```jsx
import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { CButton, CCard, CCardBody, CCardHeader, CFormInput, CFormSelect, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilTrash, cilPlus, cilReload } from '@coreui/icons'
import { monthAllocated, monthBaseline, computeWorkingPool, monthPlannedTotal } from '../../../../services/budgetPlan'
import { localBudgetPlan } from '../../../../services/localBudgetPlan'
import MonthPicker from './MonthPicker'

const PHASE_OPTIONS = [
  { value: 'design', label: 'Design' },
  { value: 'implementation', label: 'Implementation' },
  { value: 'monitoring', label: 'Monitoring' },
]

const ACCENTS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2']

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0)

const monthLabel = (ym) => {
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

const PlanningMonthCard = ({ project, plan, month, colorIndex, canEdit, onPlanChange, currentUser, onFocus }) => {
  const [resetConfirm, setResetConfirm] = useState(false)
  const [error, setError] = useState('')
  const accent = ACCENTS[colorIndex % ACCENTS.length]

  const monthEntry = plan.months.find((m) => m.month === month)
  const baseline = monthBaseline(computeWorkingPool(plan.project_value, plan.pool_pct), plan.months.length)
  const allocated = monthAllocated(baseline, plan.transfers, month)
  const planned = monthPlannedTotal(monthEntry.tasks)
  const diff = Math.round((planned - allocated) * 100) / 100
  const monthTransfers = plan.transfers.filter((t) => t.from === `month:${month}` || t.to === `month:${month}`)

  const run = (fn) => {
    setError('')
    try {
      onPlanChange(fn())
    } catch (e) {
      setError(e.message)
    }
  }

  const handleAddTask = () => run(() => localBudgetPlan.addTask(project.id, month, { phase: 'design', name: '' }))
  const handleSend = (targets) => run(() => localBudgetPlan.moveBalance(project.id, { originMonth: month, direction: 'send', targets, amount: Math.abs(diff), phase: 'planning', createdBy: currentUser }))
  const handleTake = (targets) => run(() => localBudgetPlan.moveBalance(project.id, { originMonth: month, direction: 'take', targets, amount: Math.abs(diff), phase: 'planning', createdBy: currentUser }))

  return (
    <CCard className="mb-3" style={{ borderLeft: `4px solid ${accent}` }} onFocus={onFocus} onClick={onFocus}>
      <CCardHeader style={{ background: `${accent}14` }} className="d-flex justify-content-between align-items-center">
        <span className="fw-semibold">{monthLabel(month)}</span>
        {canEdit && (
          <CButton size="sm" color="secondary" variant="ghost" onClick={() => setResetConfirm(true)}>
            <CIcon icon={cilReload} size="sm" className="me-1" /> Reset this month
          </CButton>
        )}
      </CCardHeader>
      <CCardBody>
        <div className="small text-body-secondary mb-2">
          Allocated: <strong>{fmt(allocated)}</strong> &nbsp;·&nbsp; Planned: <strong>{fmt(planned)}</strong>
        </div>

        {monthEntry.tasks.map((task) => (
          <div key={task.id} className="border rounded p-2 mb-2">
            <div className="d-flex gap-2 align-items-center mb-1">
              <CFormSelect
                size="sm"
                style={{ width: 150 }}
                value={task.phase}
                disabled={!canEdit}
                onChange={(e) => run(() => { /* phase edit not separately exposed; recreate via remove+add kept minimal per spec scope */ return plan })}
              >
                {PHASE_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </CFormSelect>
              <CFormInput
                size="sm"
                placeholder="Task name"
                defaultValue={task.name}
                disabled={!canEdit}
                onBlur={(e) => run(() => { task.name = e.target.value; return localBudgetPlan.getPlan(project.id) })}
              />
              {canEdit && (
                <CButton size="sm" color="danger" variant="ghost" onClick={() => run(() => localBudgetPlan.removeTask(project.id, month, task.id))}>
                  <CIcon icon={cilTrash} size="sm" />
                </CButton>
              )}
            </div>
            {task.subtasks.map((sub) => (
              <div key={sub.id} className="d-flex gap-2 align-items-center mb-1 ms-3">
                <CFormInput
                  size="sm"
                  style={{ width: 160 }}
                  placeholder="Subtask"
                  defaultValue={sub.name}
                  disabled={!canEdit}
                  onBlur={(e) => run(() => { sub.name = e.target.value; return localBudgetPlan.getPlan(project.id) })}
                />
                <CFormInput
                  size="sm"
                  type="number"
                  style={{ width: 130 }}
                  value={sub.planned_amount || ''}
                  disabled={!canEdit}
                  onChange={(e) => run(() => localBudgetPlan.updateSubtaskPlanned(project.id, month, task.id, sub.id, e.target.value))}
                />
                {canEdit && (
                  <CButton size="sm" color="danger" variant="ghost" onClick={() => run(() => localBudgetPlan.removeSubtask(project.id, month, task.id, sub.id))}>
                    <CIcon icon={cilTrash} size="sm" />
                  </CButton>
                )}
              </div>
            ))}
            {canEdit && (
              <CButton size="sm" color="secondary" variant="outline" className="ms-3" onClick={() => run(() => localBudgetPlan.addSubtask(project.id, month, task.id, { name: '', planned_amount: 0 }))}>
                <CIcon icon={cilPlus} className="me-1" /> Subtask
              </CButton>
            )}
          </div>
        ))}

        {canEdit && (
          <CButton size="sm" color="secondary" variant="outline" className="mb-2" onClick={handleAddTask}>
            <CIcon icon={cilPlus} className="me-1" /> Add Task
          </CButton>
        )}

        {monthTransfers.map((t) => {
          const outgoing = t.from === `month:${month}`
          const counterpart = outgoing ? t.to : t.from
          const counterpartLabel = counterpart.startsWith('month:')
            ? monthLabel(counterpart.slice('month:'.length))
            : counterpart.toUpperCase()
          return (
            <div key={t.id} className="small text-body-secondary">
              {outgoing ? `− ${fmt(t.amount)} sent to ${counterpartLabel}` : `+ ${fmt(t.amount)} received from ${counterpartLabel}`}
              {canEdit && plan.status === 'planning' && (
                <CButton size="sm" color="secondary" variant="ghost" className="ms-1 p-0 px-1" onClick={() => run(() => localBudgetPlan.revokeTransfer(project.id, t.id))}>
                  revoke
                </CButton>
              )}
            </div>
          )
        })}

        {canEdit && diff < -0.005 && (
          <div className="mt-2 p-2 border rounded bg-body-tertiary">
            <div className="small mb-1">Not fully utilized — balance this month: <strong>{fmt(-diff)}</strong></div>
            <div className="d-flex gap-2 flex-wrap">
              <CButton size="sm" color="success" onClick={() => handleSend(['hr', 'core'])}>Send to HR/Core</CButton>
              <MonthPicker months={plan.months.map((m) => m.month)} excludeMonth={month} label="Send to other months" onConfirm={(targets) => handleSend(targets.map((m) => `month:${m}`))} />
            </div>
          </div>
        )}

        {canEdit && diff > 0.005 && (
          <div className="mt-2 p-2 border rounded bg-body-tertiary">
            <div className="small mb-1 text-danger">Needs {fmt(diff)} more to satisfy</div>
            <div className="d-flex gap-2 flex-wrap">
              <CButton size="sm" color="warning" onClick={() => handleTake(['hr', 'core'])}>Take from HR/Core</CButton>
              <MonthPicker months={plan.months.map((m) => m.month)} excludeMonth={month} label="Take from months" onConfirm={(targets) => handleTake(targets.map((m) => `month:${m}`))} />
            </div>
          </div>
        )}

        {error && <div className="text-danger small mt-2">{error}</div>}
      </CCardBody>

      <CModal visible={resetConfirm} onClose={() => setResetConfirm(false)} alignment="center" size="sm">
        <CModalHeader><CModalTitle>Confirm Reset</CModalTitle></CModalHeader>
        <CModalBody className="small">
          This restores {monthLabel(month)}&apos;s tasks to the last save and undoes every transfer it sent or took — which also restores any other month or pool those transfers touched. Continue?
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" size="sm" onClick={() => setResetConfirm(false)}>Cancel</CButton>
          <CButton color="danger" size="sm" onClick={() => { run(() => localBudgetPlan.resetMonth(project.id, month)); setResetConfirm(false) }}>Confirm</CButton>
        </CModalFooter>
      </CModal>
    </CCard>
  )
}

PlanningMonthCard.propTypes = {
  project: PropTypes.object.isRequired,
  plan: PropTypes.object.isRequired,
  month: PropTypes.string.isRequired,
  colorIndex: PropTypes.number.isRequired,
  canEdit: PropTypes.bool,
  onPlanChange: PropTypes.func.isRequired,
  currentUser: PropTypes.string,
  onFocus: PropTypes.func,
}

export default PlanningMonthCard
```

Note on the task-name/subtask-name `onBlur` mutation pattern above: it mutates the in-memory `task`/`sub` object directly (already a reference into the plan object returned by `localBudgetPlan.getPlan`) and then re-persists via `localBudgetPlan.getPlan(project.id)` after the mutation — this works because `localBudgetPlan`'s store holds the same object identity across calls within one page session (no deep-clone on read). If this proves fragile in Task 12's manual verification pass, add a dedicated `localBudgetPlan.renameTask(projectId, month, taskId, name)` / `renameSubtask(...)` pair (same shape as `updateSubtaskPlanned`) and swap these two `onBlur` handlers to call them — flag this as a possible follow-up during Task 12's verification, don't skip verifying it.

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/jojo/labs/git-lab/HMA/hma-template/emsv1 && npx eslint src/modules/pms/project-associate/budget-plan/PlanningMonthCard.jsx`
Expected: no errors (an unused `plan` closure warning in the phase-select `onChange` stub is acceptable — that control is intentionally a no-op placeholder-free stub that returns the current plan unchanged since phase editing after task creation is out of spec scope; if eslint flags the unused `e` parameter, prefix it `_e`).

- [ ] **Step 3: Commit**

```bash
git add src/modules/pms/project-associate/budget-plan/PlanningMonthCard.jsx
git commit -m "feat(pms): add PlanningMonthCard component"
```

---

### Task 11: `ActualMonthCard.jsx`

**Files:**
- Create: `src/modules/pms/project-associate/budget-plan/ActualMonthCard.jsx`

**Interfaces:**
- Consumes: `localBudgetPlan.updateActual/addActualTask/moveBalance` (Task 7), `monthAllocated/monthActualTotal` (Task 2), `MonthPicker` (Task 8).
- Produces: `<ActualMonthCard project={object} plan={object} month={string} colorIndex={number} canEdit={bool} onPlanChange={(plan)=>void} currentUser={string} />`.

- [ ] **Step 1: Write the component**

```jsx
import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { CButton, CCard, CCardBody, CCardHeader, CFormInput, CFormSelect } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus } from '@coreui/icons'
import { monthAllocated, monthBaseline, computeWorkingPool, monthActualTotal } from '../../../../services/budgetPlan'
import { localBudgetPlan } from '../../../../services/localBudgetPlan'
import MonthPicker from './MonthPicker'

const PHASE_OPTIONS = [
  { value: 'design', label: 'Design' },
  { value: 'implementation', label: 'Implementation' },
  { value: 'monitoring', label: 'Monitoring' },
]

const ACCENTS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2']

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0)

const monthLabel = (ym) => {
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

const ActualMonthCard = ({ project, plan, month, colorIndex, canEdit, onPlanChange, currentUser }) => {
  const [error, setError] = useState('')
  const accent = ACCENTS[colorIndex % ACCENTS.length]
  const monthEntry = plan.months.find((m) => m.month === month)
  const baseline = monthBaseline(computeWorkingPool(plan.project_value, plan.pool_pct), plan.months.length)
  const allocated = monthAllocated(baseline, plan.transfers, month)
  const actualSoFar = monthActualTotal(monthEntry.tasks)

  const run = (fn) => {
    setError('')
    try {
      onPlanChange(fn())
    } catch (e) {
      setError(e.message)
    }
  }

  const handleAddTask = () => run(() => localBudgetPlan.addActualTask(project.id, month, { phase: 'design', name: '' }))

  return (
    <CCard className="mb-3" style={{ borderLeft: `4px solid ${accent}` }}>
      <CCardHeader style={{ background: `${accent}14` }}>
        <span className="fw-semibold">{monthLabel(month)}</span>
        <span className="small text-body-secondary ms-2">
          Planned: {fmt(allocated)} · Actual so far: {fmt(actualSoFar)}
        </span>
      </CCardHeader>
      <CCardBody>
        {monthEntry.tasks.map((task) => (
          <div key={task.id} className="border rounded p-2 mb-2">
            <div className="small fw-semibold mb-1">
              {PHASE_OPTIONS.find((p) => p.value === task.phase)?.label} — {task.name}
              {task.added_in_actual && <span className="text-body-tertiary"> (added in actual)</span>}
            </div>
            {task.subtasks.map((sub) => {
              const remainder = Math.round((sub.planned_amount - sub.actual_amount) * 100) / 100
              return (
                <div key={sub.id} className="d-flex gap-2 align-items-center mb-1 ms-3 flex-wrap">
                  <span className="small text-body-secondary" style={{ width: 140 }}>{sub.name}</span>
                  <span className="small text-body-tertiary" style={{ width: 100 }}>
                    Planned {task.added_in_actual ? '—' : fmt(sub.planned_amount)}
                  </span>
                  <CFormInput
                    size="sm"
                    type="number"
                    style={{ width: 120 }}
                    value={sub.actual_amount || ''}
                    disabled={!canEdit || sub.actual_status === 'transferred'}
                    onChange={(e) => run(() => localBudgetPlan.updateActual(project.id, month, task.id, sub.id, e.target.value))}
                  />
                  {sub.actual_status === 'transferred' && <span className="small text-success">Money transferred — ₹0</span>}
                  {canEdit && sub.actual_status !== 'transferred' && !task.added_in_actual && remainder > 0.005 && (
                    <>
                      <span className="small text-body-secondary">{fmt(remainder)} remaining</span>
                      <CButton
                        size="sm"
                        color="success"
                        variant="outline"
                        onClick={() =>
                          run(() =>
                            localBudgetPlan.moveBalance(project.id, {
                              originMonth: month,
                              direction: 'send',
                              targets: ['hr', 'core'],
                              amount: remainder,
                              phase: 'actual',
                              createdBy: currentUser,
                              subtaskRef: { month, taskId: task.id, subtaskId: sub.id },
                            }),
                          )
                        }
                      >
                        → HR/Core
                      </CButton>
                      <MonthPicker
                        months={plan.months.map((m) => m.month)}
                        excludeMonth={month}
                        label="→ months"
                        onConfirm={(targets) =>
                          run(() =>
                            localBudgetPlan.moveBalance(project.id, {
                              originMonth: month,
                              direction: 'send',
                              targets: targets.map((m) => `month:${m}`),
                              amount: remainder,
                              phase: 'actual',
                              createdBy: currentUser,
                              subtaskRef: { month, taskId: task.id, subtaskId: sub.id },
                            }),
                          )
                        }
                      />
                    </>
                  )}
                  {canEdit && remainder < -0.005 && (
                    <>
                      <span className="small text-danger">Insufficient — needs {fmt(-remainder)}</span>
                      <CButton
                        size="sm"
                        color="warning"
                        variant="outline"
                        onClick={() =>
                          run(() =>
                            localBudgetPlan.moveBalance(project.id, {
                              originMonth: month,
                              direction: 'take',
                              targets: ['hr', 'core'],
                              amount: -remainder,
                              phase: 'actual',
                              createdBy: currentUser,
                            }),
                          )
                        }
                      >
                        Take from HR/Core
                      </CButton>
                      <MonthPicker
                        months={plan.months.map((m) => m.month)}
                        excludeMonth={month}
                        label="Take from months"
                        onConfirm={(targets) =>
                          run(() =>
                            localBudgetPlan.moveBalance(project.id, {
                              originMonth: month,
                              direction: 'take',
                              targets: targets.map((m) => `month:${m}`),
                              amount: -remainder,
                              phase: 'actual',
                              createdBy: currentUser,
                            }),
                          )
                        }
                      />
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
        {canEdit && (
          <CButton size="sm" color="secondary" variant="outline" onClick={handleAddTask}>
            <CIcon icon={cilPlus} className="me-1" /> Add Task
          </CButton>
        )}
        {error && <div className="text-danger small mt-2">{error}</div>}
      </CCardBody>
    </CCard>
  )
}

ActualMonthCard.propTypes = {
  project: PropTypes.object.isRequired,
  plan: PropTypes.object.isRequired,
  month: PropTypes.string.isRequired,
  colorIndex: PropTypes.number.isRequired,
  canEdit: PropTypes.bool,
  onPlanChange: PropTypes.func.isRequired,
  currentUser: PropTypes.string,
}

export default ActualMonthCard
```

Note: a task added via `addActualTask` has no subtasks yet — spec Section 6 implies the PO also needs a way to add a subtask (with a planned_amount-less, actual-only entry) under such a task. Reuse `localBudgetPlan.addSubtask` for this (it's not phase-gated to `'planning'` — check Task 5's implementation: `addSubtask` calls `requirePlanning`, which WOULD block this in the submitted phase). Fix required: in Task 5, `addSubtask` must allow the call when the task itself is `added_in_actual: true`, even if `plan.status === 'submitted'`. Add this exception now:

- [ ] **Step 2: Patch `addSubtask` to allow subtasks on actual-only tasks**

In `src/services/localBudgetPlan.js`, replace the `addSubtask` body's guard line:

```js
  addSubtask(projectId, month, taskId, { name, planned_amount }) {
    const all = readAll()
    const plan = requirePlan(all, projectId)
    const monthEntry = plan.months.find((m) => m.month === month)
    if (!monthEntry) throw new Error(`${month} is not part of this plan.`)
    const task = monthEntry.tasks.find((t) => t.id === taskId)
    if (!task) throw new Error('Task not found.')
    if (!task.added_in_actual) localBudgetPlan.requirePlanning(plan)
    task.subtasks.push({
```

(keep the rest of the function body unchanged from Task 5).

Add a small "Add Subtask" button next to each `added_in_actual` task in `ActualMonthCard.jsx` — insert this JSX right after the `{task.subtasks.map(...)}` block, inside the `task.added_in_actual` branch:

```jsx
            {task.added_in_actual && canEdit && (
              <CButton
                size="sm"
                color="secondary"
                variant="outline"
                className="ms-3"
                onClick={() =>
                  run(() => localBudgetPlan.addSubtask(project.id, month, task.id, { name: 'Expense', planned_amount: 0 }))
                }
              >
                <CIcon icon={cilPlus} className="me-1" /> Add Subtask
              </CButton>
            )}
```

- [ ] **Step 3: Update Task 5's regression test to cover the new exception**

Append to `scripts/verify-local-budget-plan.mjs` (before `console.log`, near the other actual-phase assertions added in Task 7):

```js
// addSubtask is allowed on an added_in_actual task even though the plan is submitted
plan = localBudgetPlan.getPlan(PID)
assert.equal(plan.status, 'submitted')
const extraTaskId = plan.months[0].tasks.find((t) => t.added_in_actual).id
plan = localBudgetPlan.addSubtask(PID, '2026-08', extraTaskId, { name: 'Fuel', planned_amount: 0 })
assert.equal(
  plan.months[0].tasks.find((t) => t.id === extraTaskId).subtasks.length,
  1,
)
// but a normal (non-added_in_actual) task still can't get a new subtask post-submit
assert.throws(
  () => localBudgetPlan.addSubtask(PID, '2026-08', bigTaskId, { name: 'X', planned_amount: 0 }),
  /locked/,
)
```

- [ ] **Step 4: Run the full regression**

Run: `node scripts/verify-budget-plan.mjs && node scripts/verify-local-budget-plan.mjs && echo ALL_OK`
Expected: `ALL_OK`

- [ ] **Step 5: Verify UI components compile**

Run: `cd /home/jojo/labs/git-lab/HMA/hma-template/emsv1 && npx eslint src/modules/pms/project-associate/budget-plan/ActualMonthCard.jsx src/services/localBudgetPlan.js`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/pms/project-associate/budget-plan/ActualMonthCard.jsx src/services/localBudgetPlan.js scripts/verify-local-budget-plan.mjs
git commit -m "feat(pms): add ActualMonthCard component and allow subtasks on actual-only tasks"
```

---

### Task 12: `BudgetPlanPanel.jsx` container + wire into `ProjectDetailPage.jsx`

**Files:**
- Create: `src/modules/pms/project-associate/BudgetPlanPanel.jsx`
- Modify: `src/modules/pms/project-associate/ProjectDetailPage.jsx:77` (import), `:2432` (Monthly Plan tab)

**Interfaces:**
- Consumes: `localBudgetPlan.getPlan/initializePlan/computeSettlement/submit/drawFromAdmin` (Tasks 4, 7), `PlanHeader`/`RecurringTasksEntry` (Task 9), `PlanningMonthCard` (Task 10), `ActualMonthCard` (Task 11).
- Produces: `<BudgetPlanPanel project={object} onProjectChange={(project)=>void} canEdit={bool} currentUser={string} />` — same public signature `MonthlyPlanPanel` had, so the swap in `ProjectDetailPage.jsx` is a one-line import change plus a prop-identical replacement.

- [ ] **Step 1: Write the component**

```jsx
import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { CAlert, CButton, CCard, CCardBody, CCardHeader, CFormInput, CInputGroup, CInputGroupText } from '@coreui/react'
import { localBudgetPlan } from '../../../services/localBudgetPlan'
import { monthsInRange } from '../../../services/budgetPlan'
import PlanHeader from './budget-plan/PlanHeader'
import RecurringTasksEntry from './budget-plan/RecurringTasksEntry'
import PlanningMonthCard from './budget-plan/PlanningMonthCard'
import ActualMonthCard from './budget-plan/ActualMonthCard'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0)

const BudgetPlanPanel = ({ project, onProjectChange, canEdit = false, currentUser = 'Unknown' }) => {
  const [plan, setPlan] = useState(() => localBudgetPlan.getPlan(project.id))
  const [focusedMonth, setFocusedMonth] = useState(null)
  const [submitError, setSubmitError] = useState('')

  const months = monthsInRange(project.start_date, project.end_date)

  const handleInitialize = () => {
    const created = localBudgetPlan.initializePlan(project.id, {
      projectValue: project.project_value || project.project_valuation || 0,
      startDate: project.start_date,
      endDate: project.end_date,
      poolPct: { admin: project.admin_pct ?? 5, hr: project.hr_pct ?? 5, core: project.core_pct ?? 5 },
    })
    setPlan(created)
  }

  const handleFullDelete = () => {
    localBudgetPlan.fullDelete(project.id)
    setPlan(null)
  }

  const handleSubmit = () => {
    setSubmitError('')
    try {
      setPlan(localBudgetPlan.submit(project.id))
    } catch (e) {
      setSubmitError(e.message)
    }
  }

  const handleDrawFromAdmin = () => {
    setSubmitError('')
    try {
      setPlan(localBudgetPlan.drawFromAdmin(project.id, { createdBy: currentUser }))
    } catch (e) {
      setSubmitError(e.message)
    }
  }

  if (!plan) {
    return (
      <CCard className="shadow-sm mb-4">
        <CCardHeader className="fw-semibold">Budget Plan</CCardHeader>
        <CCardBody>
          {canEdit ? (
            <>
              <CAlert color="info" className="small">
                No budget plan yet for this {months.length}-month project.
              </CAlert>
              <CButton color="primary" onClick={handleInitialize} disabled={months.length === 0}>
                Initialize Plan
              </CButton>
            </>
          ) : (
            <CAlert color="info" className="small mb-0">No budget plan has been created yet.</CAlert>
          )}
        </CCardBody>
      </CCard>
    )
  }

  if (plan.status === 'planning') {
    const check = localBudgetPlan.computeSettlement(project.id)
    return (
      <>
        <PlanHeader
          project={project}
          plan={plan}
          canEdit={canEdit}
          onPlanChange={setPlan}
          onFullDelete={handleFullDelete}
          currentUser={currentUser}
          focusedMonth={focusedMonth}
        />
        <RecurringTasksEntry project={project} plan={plan} canEdit={canEdit} onPlanChange={setPlan} />
        {plan.months.map((m, i) => (
          <PlanningMonthCard
            key={m.month}
            project={project}
            plan={plan}
            month={m.month}
            colorIndex={i}
            canEdit={canEdit}
            onPlanChange={setPlan}
            currentUser={currentUser}
            onFocus={() => setFocusedMonth(m.month)}
          />
        ))}
        {canEdit && (
          <CCard className="mb-4">
            <CCardBody>
              <div className="small mb-2">
                {check.valid ? (
                  <span className="text-success">Every month is settled — ready to submit.</span>
                ) : (
                  <ul className="mb-0">
                    {check.monthIssues.map((i) => (
                      <li key={i.month} className="text-danger">
                        {i.month}: {i.diff > 0 ? `over by ${fmt(i.diff)}` : `${fmt(-i.diff)} unallocated`}
                      </li>
                    ))}
                    {!check.invariantOk && <li className="text-danger">Totals don&apos;t add up to the project value — try Reset Calculation.</li>}
                    {!check.poolsNonNegative && <li className="text-danger">A pool has gone negative.</li>}
                  </ul>
                )}
              </div>
              {check.adminDraw && (
                <CButton size="sm" color="warning" className="me-2" onClick={handleDrawFromAdmin}>
                  Draw {fmt(check.adminDraw.amount)} from Admin
                </CButton>
              )}
              <CButton color="primary" disabled={!check.valid} onClick={handleSubmit}>
                Submit Plan
              </CButton>
              {submitError && <div className="text-danger small mt-2">{submitError}</div>}
            </CCardBody>
          </CCard>
        )}
      </>
    )
  }

  return (
    <>
      <PlanHeader project={project} plan={plan} canEdit={canEdit} onPlanChange={setPlan} onFullDelete={handleFullDelete} currentUser={currentUser} />
      {plan.months.map((m, i) => (
        <ActualMonthCard
          key={m.month}
          project={project}
          plan={plan}
          month={m.month}
          colorIndex={i}
          canEdit={canEdit}
          onPlanChange={setPlan}
          currentUser={currentUser}
        />
      ))}
    </>
  )
}

BudgetPlanPanel.propTypes = {
  project: PropTypes.object.isRequired,
  onProjectChange: PropTypes.func.isRequired,
  canEdit: PropTypes.bool,
  currentUser: PropTypes.string,
}

export default BudgetPlanPanel
```

Note: `onProjectChange` is accepted for prop-signature parity with the old `MonthlyPlanPanel` (so `ProjectDetailPage.jsx`'s existing `onProjectChange={setProject}` wiring doesn't need to change) but isn't called here — the budget plan is its own localStorage-backed entity now, not a field on `project`, so there's nothing on `project` for this panel to mutate. This is intentional per the file-map design in this plan's header, not an oversight.

- [ ] **Step 2: Wire into `ProjectDetailPage.jsx`**

In `src/modules/pms/project-associate/ProjectDetailPage.jsx`, change line 77:

```js
import MonthlyPlanPanel, { ExpensePanel } from './MonthlyPlanPanel'
```
to:
```js
import BudgetPlanPanel from './BudgetPlanPanel'
import { ExpensePanel } from './MonthlyPlanPanel'
```

Then change the Monthly Plan tab pane (around line 2432):

```jsx
            {/* Monthly Plan Tab */}
            <CTabPane visible={activeTab === 6}>
              <MonthlyPlanPanel
                project={project}
                onProjectChange={setProject}
                canEdit={canEditMonthlyPlan}
                currentUser={user?.full_name || user?.employee_id || 'Unknown'}
              />
            </CTabPane>
```
to:
```jsx
            {/* Monthly Plan Tab */}
            <CTabPane visible={activeTab === 6}>
              <BudgetPlanPanel
                project={project}
                onProjectChange={setProject}
                canEdit={canEditMonthlyPlan}
                currentUser={user?.full_name || user?.employee_id || 'Unknown'}
              />
            </CTabPane>
```

- [ ] **Step 3: Run the full service regression**

Run: `node scripts/verify-budget-plan.mjs && node scripts/verify-local-budget-plan.mjs && echo ALL_OK`
Expected: `ALL_OK`

- [ ] **Step 4: Lint and build**

Run: `cd /home/jojo/labs/git-lab/HMA/hma-template/emsv1 && npx eslint src/modules/pms/project-associate/BudgetPlanPanel.jsx src/modules/pms/project-associate/ProjectDetailPage.jsx && npm run build`
Expected: eslint clean; `vite build` completes without errors.

- [ ] **Step 5: Manual verification pass (dev server)**

Run: `cd /home/jojo/labs/git-lab/HMA/hma-template/emsv1 && npm run start` (leave running), then in a browser:
1. Open a project with `start_date`/`end_date` set, as a role with `canEditMonthlyPlan` (PO/PA), go to its Monthly Plan tab.
2. Confirm the "Initialize Plan" empty state appears; click it — per-month cards render with distinct color accents.
3. Add a task + subtask in month 1 with more than that month's allocated share; confirm the "Needs ₹X more to satisfy" box appears with Take-from-HR/Core and Take-from-months actions.
4. Use Take from HR/Core to settle it; confirm the Submit checklist turns green and Submit Plan becomes enabled.
5. Submit; confirm the view switches to the actual-phase cards with planned (grey, read-only) values shown per subtask and an editable actual input beside each.
6. Enter an actual less than planned on one subtask; confirm the "remaining" + "→ HR/Core" action appears; click it; confirm the row now shows "Money transferred — ₹0".
7. Stop the dev server (Ctrl+C).

Expected: every step above behaves as described; note any deviation and fix before proceeding (do not claim success without having actually observed this in the browser — UNVERIFIED otherwise, per this repo's standing engineering discipline).

- [ ] **Step 6: Commit**

```bash
git add src/modules/pms/project-associate/BudgetPlanPanel.jsx src/modules/pms/project-associate/ProjectDetailPage.jsx
git commit -m "feat(pms): add BudgetPlanPanel container, wire into Monthly Plan tab"
```

---

### Task 13: Expense tab — "Money transferred" display

**Files:**
- Modify: `src/modules/pms/project-associate/MonthlyPlanPanel.jsx` (the exported `ExpensePanel`, lines ~1429–1712)

**Interfaces:**
- Consumes: `localBudgetPlan.getPlan` (Task 4).
- Produces: no new exports — `ExpensePanel`'s existing signature is unchanged (`project`, `onProjectChange`, `canEdit`, `currentUser`); it now also renders each month's transferred budget-plan subtasks.

Per spec Section 7, the Expense tab (EMS's `ExpensePanel`, distinct from the budget planner) should show a subtask whose actual remainder was sent to HR/Core as "Money transferred — ₹0" rather than an available amount. `ExpensePanel` today drives an entirely separate flow (`sendPoolAllocation`/`revokePoolAllocation` against the OLD `monthly_plan`) which this plan intentionally leaves untouched (Global Constraints). The minimal, additive change is to append a read-only section listing any transferred budget-plan subtasks for the selected month, without touching the existing Send/Revoke logic.

- [ ] **Step 1: Add the import**

In `src/modules/pms/project-associate/MonthlyPlanPanel.jsx`, near the top imports (after line 33's `localTasks` import):

```js
import { localBudgetPlan } from '../../../services/localBudgetPlan'
```

- [ ] **Step 2: Render transferred subtasks for the selected month**

Inside `ExpensePanel`, right after the line that computes `month` (`const month = months.includes(selectedMonth) ? selectedMonth : months[0]`), add:

```js
  const budgetPlan = localBudgetPlan.getPlan(project.id)
  const transferredSubtasks =
    budgetPlan?.months
      .find((m) => m.month === month)
      ?.tasks.flatMap((t) => t.subtasks.filter((s) => s.actual_status === 'transferred').map((s) => ({ ...s, taskName: t.name })))
      || []
```

Then, inside the "💰 Expenses" `CCardBody` (right after the closing of the `actualEntries.length > 0` block, before that block's closing `</div>` — i.e. immediately following the existing `{actualEntries.length > 0 && ( ... )}` JSX block), add:

```jsx
                {transferredSubtasks.length > 0 && (
                  <div className="mt-2">
                    <div className="small fw-semibold mb-1">Transferred from Budget Plan</div>
                    {transferredSubtasks.map((s) => (
                      <div key={s.id} className="d-flex justify-content-between small text-success">
                        <span>{s.taskName} — {s.name}</span>
                        <span>Money transferred — ₹0</span>
                      </div>
                    ))}
                  </div>
                )}
```

- [ ] **Step 3: Lint**

Run: `cd /home/jojo/labs/git-lab/HMA/hma-template/emsv1 && npx eslint src/modules/pms/project-associate/MonthlyPlanPanel.jsx`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Continuing from Task 12 Step 5's browser session (or starting fresh with `npm run start`): after sending a subtask's actual remainder to HR/Core in the Budget Plan's actual phase, open the project's Expense tab, select the same month, and confirm a "Transferred from Budget Plan" section appears showing that task/subtask as "Money transferred — ₹0".

- [ ] **Step 5: Final full regression**

Run: `cd /home/jojo/labs/git-lab/HMA/hma-template/emsv1 && node scripts/verify-budget-plan.mjs && node scripts/verify-local-budget-plan.mjs && node scripts/verify-gst-calculations.mjs && node scripts/verify-gst-sheet-parser.mjs && node scripts/verify-local-gst-bills.mjs && npx eslint src && npm run build && echo ALL_OK`
Expected: `ALL_OK` — this exercises every new pure-math/persistence script alongside the pre-existing ones (regression check on the Task 1 `load-esm-source.mjs` change) plus a full lint and production build.

- [ ] **Step 6: Commit**

```bash
git add src/modules/pms/project-associate/MonthlyPlanPanel.jsx
git commit -m "feat(pms): show budget-plan transferred subtasks in the Expense tab"
```

---

## Self-Review Notes

- **Spec coverage:** Section 2 (lifecycle) → Tasks 4, 7, 12. Section 3 (data model) → Task 4. Section 4 (planning UI incl. header, recurring tasks, per-month cards, reset) → Tasks 5, 6, 9, 10. Section 5 (submit/ladder) → Tasks 3, 7, 12. Section 6 (actual phase) → Tasks 7, 11. Section 7 (Expense tab) → Task 13. Section 8 (files) → matches the File Map exactly. Section 9 (testing) → Tasks 2, 3, 4–7 (unit-style verify scripts covering the 96% regression explicitly), 12 Step 5 (manual E2E walkthrough, adapted from "Vitest"/scripted-E2E to this repo's actual no-test-runner convention — see Global Constraints).
- **Placeholder scan:** no TBD/TODO left in any step; the one deliberately-deferred item (task-name `onBlur` mutation robustness in Task 10, and the phase-select no-op stub) is called out explicitly with a concrete fallback (`renameTask`/`renameSubtask`) rather than left vague.
- **Type consistency:** entity-key format (`` `month:${YYYY-MM}` ``, `'hr'`/`'core'`/`'admin'`) is used identically from Task 2 through Task 13. `moveBalance`'s `{ originMonth, direction, targets, amount, phase, createdBy, subtaskRef }` signature (defined Task 6) is called identically in Tasks 10, 11, 12. `plan.pool_pct` / `plan.project_value` / `plan.months[].tasks[].subtasks[]` shape (defined Task 4) is consumed identically by every later task.
