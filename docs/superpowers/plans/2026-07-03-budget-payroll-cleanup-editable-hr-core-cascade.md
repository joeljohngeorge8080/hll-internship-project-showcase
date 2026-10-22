# Budget & Payroll Cleanup + Editable HR/Core Cascade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Budget & Payroll's Admin/HR/Core cards show only EMS-logged, project-scoped expenses (dropping older sources), and make the Monthly Plan tab's HR/Core columns directly editable with an automatic cascade that funds any Project-column overage from HR/Core — same month first, then spread across the rest of the project's months.

**Architecture:** Two new pure functions in `monthlyApportionment.js` compute a month's baseline Project share and a month's own HR+Core capacity; a third pure function derives the full set of `auto_cascade` pool_adjustments a plan implies. `localProjects.js`'s `updateMonthPlan` recomputes these fresh on every phase edit (merged with untouched manual adjustments), and a new `setManualPoolAdjustment` replaces the old `addPoolAdjustment`/`removePoolAdjustment` pair with upsert (set-the-value) semantics. `MonthlyPlanPanel.jsx` loses the Withdraw modal in favor of inline-editable HR/Core cells using the same permission gate as the Project column. `ProjectDetailPage.jsx`'s Budget & Payroll cards are re-sourced to read only from `localProjectExpenses` (the per-project ledger added last session), dropping `project.admin_expenses`, the org-wide vendor ledger, and `localOrgPool` HR/Core charge lookups.

**Tech Stack:** React 19 + Vite, CoreUI React, plain JS service modules backed by `localStorage`. No test framework, no working browser in this environment — verification is `npm run build` + scoped `npm run lint -- <file>` + Node-traced manual verification for pure/impure logic (in-memory `localStorage` polyfill for impure functions, per this session's established pattern) and careful manual JSX review for UI.

**Design reference:** `docs/superpowers/specs/2026-07-03-budget-payroll-cleanup-editable-hr-core-cascade-design.md` — read it for full rationale behind every decision below.

## Global Constraints

- **Scope boundary:** touches only `monthlyApportionment.js`, `localProjects.js`, `MonthlyPlanPanel.jsx`, and `ProjectDetailPage.jsx`. Does not touch `localProjectExpenses.js`, `localAdminExpenses.js`, `localOrgPool.js`, `admin_pct`/`hr_pct`/`core_pct` editors, or the Activate-gating logic.
- **50/50 split, always:** every cascade pull (same-month and cross-month) splits evenly between HR and Core, regardless of the project's `hr_pct`/`core_pct` values.
- **Recompute fresh, not stack:** `auto_cascade`-tagged adjustments are fully recomputed (discarded and regenerated) on every `updateMonthPlan` call. `manual`-tagged adjustments (and any legacy adjustment without an `auto_cascade` source tag) are always preserved untouched by that recompute.
- **"Flag, don't block":** an uncovered shortfall (single-month project, or excess beyond total remaining HR+Core capacity project-wide) is simply not represented by any adjustment — it shows up honestly as a genuine "Off by X" in the balance check. No error is thrown, no edit is blocked, nothing is clamped at 0.
- **Manual edits are unconstrained overrides:** `setManualPoolAdjustment`'s delta can be negative (a manual top-up above the flat rate) — not clamped, matching this codebase's existing pool-adjustment philosophy.
- **Permission model:** HR/Core inline editing uses the exact same gate as Project editing (`canEdit`, i.e. PO + Project Associate + budget-admin roles) — there is no separate, narrower gate for HR/Core.
- Money values always rounded with `Math.round(x * 100) / 100`. Month strings always `'YYYY-MM'`.
- Follow each file's existing style exactly (no semicolons, single quotes, 2-space indent).
- **Lint baselines** (measured on a clean checkout before this plan's tasks run — do not exceed; fine if a count decreases from deleted code):

  | File | Baseline |
  |---|---|
  | `src/services/monthlyApportionment.js` | 0 |
  | `src/services/localProjects.js` | 26 |
  | `src/modules/pms/project-associate/MonthlyPlanPanel.jsx` | 0 |
  | `src/modules/pms/project-associate/ProjectDetailPage.jsx` | 56 |

  `npm run build` currently passes clean and must continue to after every task.
- Run all commands from `/home/jojo/labs/git-lab/HMA/hma-template/emsv1`.

---

## Task 1: Pure cascade math in `monthlyApportionment.js`

**Files:**
- Modify: `src/services/monthlyApportionment.js` (four new exports, appended after the existing `computeEffectivePoolMonthly`)

**Interfaces:**
- Produces: `computeMonthBaseline(project)` → `number`. Consumed by Task 1's own `computeCascadeAdjustments` and by Task 2.
- Produces: `computeMonthHRCore(project, month)` → `number`. Consumed by Task 1's own `computeCascadeAdjustments`.
- Produces: `computeCascadeAdjustments(project)` → `Array<{pool: 'hr'|'core', month: string, amount: number, source: 'auto_cascade'}>` (no `id`/`reason`/`createdBy`/`createdAt` — the impure layer, Task 2, adds those when persisting). Consumed by Task 2.
- Produces: `validatePlanTotalWithCascade(monthlyPlan, workingPool, poolAdjustments)` → same shape as the existing `validatePlanTotal` (`{valid, planTotal, workingPool, diff}`). Consumed by Task 2 (inside `updateMonthPlan`'s return value) and Task 3 (`PlanTable`'s badge, `PlanningSummary`'s verdict).
- Consumes (already exist in this file, unchanged): `computeWorkingPool(project)`, `monthsInRange(startDate, endDate)`, `computeFlatMonthlyRate(project, pool)`, `validatePlanTotal(monthlyPlan, workingPool)`.

- [ ] **Step 1: Add the four new exports**

Append to the end of `src/services/monthlyApportionment.js` (after the existing `computeEffectivePoolMonthly` export):

```js
/**
 * A project's normal Project-column share for one month — the working
 * pool spread evenly across the project's duration. This is the "baseline"
 * (B) a month's Project total is compared against to decide whether it
 * needs to borrow from HR/Core.
 */
export const computeMonthBaseline = (project) => {
  const months = monthsInRange(project.start_date, project.end_date)
  if (months.length === 0) return 0
  return Math.round((computeWorkingPool(project) / months.length) * 100) / 100
}

/**
 * One month's own combined HR+Core flat capacity (HC) — the amount a
 * Project overage can draw from that same month before needing to reach
 * into other months. `month` is accepted for API symmetry with other
 * per-month functions even though the flat rate is month-independent today.
 */
export const computeMonthHRCore = (project, month) =>
  Math.round(
    (computeFlatMonthlyRate(project, 'hr') + computeFlatMonthlyRate(project, 'core')) * 100,
  ) / 100

/**
 * Derives the auto_cascade pool_adjustments a monthly plan implies: when a
 * month's Project total (P) exceeds its baseline share (B), the excess is
 * funded by pulling from HR/Core — first that same month's own HR+Core
 * capacity (HC), split 50/50, then, if the excess is larger than HC, the
 * remainder is spread evenly across every OTHER month's HR+Core, also
 * split 50/50 within each. Pure function of the project's current
 * monthly_plan; does not read or preserve any existing pool_adjustments —
 * the caller (localProjects.js) merges this against manual ones. A
 * shortfall that can't be covered (a single-month project, or an excess
 * larger than every other month's combined capacity) is simply not
 * represented by any adjustment — no clamping, no error, nothing forced.
 *
 * Every split below computes one side and derives the other as the exact
 * remainder (never rounding both sides independently), and the last month
 * in an even cross-month spread absorbs any leftover rounding — so the sum
 * of every adjustment this function creates for one month's excess always
 * equals that excess exactly, to the paisa. This matters:
 * validatePlanTotalWithCascade compares the raw plan total against
 * workingPool + (sum of every auto_cascade amount), and that comparison
 * only tolerates half a paisa of drift — independent per-record rounding
 * would silently accumulate past that tolerance on an uneven split (e.g.
 * spreading ₹5,000 across 9 months) and produce a false "Off by X".
 */
export const computeCascadeAdjustments = (project) => {
  const plan = project.monthly_plan || []
  const allMonths = plan.map((m) => m.month)
  const baseline = computeMonthBaseline(project)
  const adjustments = []

  const pushSplit = (month, total) => {
    const hrShare = Math.round((total / 2) * 100) / 100
    const coreShare = Math.round((total - hrShare) * 100) / 100
    adjustments.push({ pool: 'hr', month, amount: hrShare, source: 'auto_cascade' })
    adjustments.push({ pool: 'core', month, amount: coreShare, source: 'auto_cascade' })
  }

  plan.forEach((m) => {
    const hc = computeMonthHRCore(project, m.month)
    const excess = Math.round((m.total - baseline) * 100) / 100
    if (excess <= 0) return

    const sameMonthPull = Math.min(excess, hc)
    if (sameMonthPull > 0) {
      pushSplit(m.month, sameMonthPull)
    }

    const remaining = Math.round((excess - sameMonthPull) * 100) / 100
    if (remaining > 0) {
      const otherMonths = allMonths.filter((mm) => mm !== m.month)
      if (otherMonths.length > 0) {
        const perMonth = Math.round((remaining / otherMonths.length) * 100) / 100
        otherMonths.forEach((om, i) => {
          const isLast = i === otherMonths.length - 1
          const amt = isLast
            ? Math.round((remaining - perMonth * (otherMonths.length - 1)) * 100) / 100
            : perMonth
          pushSplit(om, amt)
        })
      }
    }
  })

  return adjustments
}

/**
 * Same balance check as validatePlanTotal, but a month's overage that's
 * fully funded by an auto_cascade pull no longer counts against it — only
 * a genuine, uncovered shortfall does. Reuses validatePlanTotal by raising
 * the comparison baseline by however much was actually pulled via cascade:
 * every cascaded rupee exists specifically to fund an overage, so total
 * pulled always equals total funded, by construction.
 */
export const validatePlanTotalWithCascade = (monthlyPlan, workingPool, poolAdjustments) => {
  const totalCascadePulled =
    Math.round(
      (poolAdjustments || [])
        .filter((a) => a.source === 'auto_cascade')
        .reduce((s, a) => s + (a.amount || 0), 0) * 100,
    ) / 100
  return validatePlanTotal(monthlyPlan, workingPool + totalCascadePulled)
}
```

- [ ] **Step 2: Verify it lints clean**

Run: `npm run lint -- src/services/monthlyApportionment.js`
Expected: 0 errors (this file's baseline is 0 — hold it strictly).

- [ ] **Step 3: Verify behavior with a Node scratch script**

This file has zero localStorage/I/O — no polyfill needed, just import and call directly. Create a scratch file (not committed) at
`/tmp/claude-1000/-home-jojo-labs-git-lab-HMA/d4d85282-9c9f-4114-857d-f117e0519726/scratchpad/verify-cascade-math.mjs`:

```js
const {
  computeMonthBaseline,
  computeMonthHRCore,
  computeCascadeAdjustments,
  validatePlanTotalWithCascade,
} = await import(
  '/home/jojo/labs/git-lab/HMA/hma-template/emsv1/src/services/monthlyApportionment.js'
)

const assert = (cond, msg) => {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`OK: ${msg}`)
}

// Project: value 10,00,000, 10 months, default 5/5/5% pools.
// Working pool = 85% of 10,00,000 = 8,50,000. Baseline per month = 85,000.
// Flat HR = flat Core = 10,00,000*5%/10 = 5,000/month. HC = 10,000/month.
const project = {
  project_value: 1000000,
  start_date: '2026-01',
  end_date: '2026-10',
  admin_pct: 5,
  hr_pct: 5,
  core_pct: 5,
}

assert(computeMonthBaseline(project) === 85000, 'baseline is 85,000/month')
assert(computeMonthHRCore(project, '2026-01') === 10000, 'HC is 10,000/month')

// Case 1: a month exactly at baseline — no cascade.
const plan1 = [{ month: '2026-01', total: 85000, phases: [] }]
assert(
  computeCascadeAdjustments({ ...project, monthly_plan: plan1 }).length === 0,
  'no cascade when P == B',
)

// Case 2: a month at 90,000 (excess 5,000, within HC=10,000) — pulls only
// from that same month, split 50/50 (2,500 each).
const plan2 = [
  { month: '2026-01', total: 90000, phases: [] },
  { month: '2026-02', total: 85000, phases: [] },
]
const c2 = computeCascadeAdjustments({ ...project, monthly_plan: plan2 })
assert(c2.length === 2, 'case 2: exactly 2 adjustment records (same month only)')
assert(
  c2.every((a) => a.month === '2026-01' && a.amount === 2500),
  'case 2: both records are 2,500 against January',
)
assert(c2.some((a) => a.pool === 'hr') && c2.some((a) => a.pool === 'core'), 'case 2: hr and core both present')

// Case 3: your worked example. January's Project total is 95,000 (baseline
// 85,000 + HC 10,000 exactly) — fully covered by that month's own HR+Core,
// nothing spills to other months.
const plan3 = [
  { month: '2026-01', total: 95000, phases: [] },
  { month: '2026-02', total: 85000, phases: [] },
  { month: '2026-03', total: 85000, phases: [] },
]
const c3 = computeCascadeAdjustments({ ...project, monthly_plan: plan3 })
assert(c3.length === 2, 'case 3: exactly 2 records — the 95k example stays within same-month HC')
assert(c3.every((a) => a.month === '2026-01' && a.amount === 5000), 'case 3: 5,000 each (10,000/2) against January')

// Case 4: January's Project total is 100,000 — excess 15,000, exceeds HC of
// 10,000. Same-month pull is capped at 10,000 (5,000/5,000 hr/core), and the
// remaining 5,000 spreads across the other 9 months — 5,000/9 doesn't divide
// evenly to the paisa, so this exercises the drift-reconciliation rule (the
// last of those 9 months absorbs whatever the other 8 didn't).
const months10 = [
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05',
  '2026-06', '2026-07', '2026-08', '2026-09', '2026-10',
]
const plan4 = months10.map((m) => ({ month: m, total: m === '2026-01' ? 100000 : 85000, phases: [] }))
const c4 = computeCascadeAdjustments({ ...project, monthly_plan: plan4 })
const janRecords = c4.filter((a) => a.month === '2026-01')
const otherRecords = c4.filter((a) => a.month !== '2026-01')
assert(janRecords.length === 2 && janRecords.every((a) => a.amount === 5000), 'case 4: January capped at 5,000/5,000')
assert(otherRecords.length === 18, 'case 4: 9 other months x 2 records each = 18')
const otherMonthTotals = {}
otherRecords.forEach((a) => {
  otherMonthTotals[a.month] = Math.round(((otherMonthTotals[a.month] || 0) + a.amount) * 100) / 100
})
assert(Object.keys(otherMonthTotals).length === 9, 'case 4: all 9 other months represented')
Object.entries(otherMonthTotals).forEach(([month, total]) => {
  assert(total === 555.56 || total === 555.52, `case 4: ${month} totals a plausible per-month share (got ${total})`)
})
const grandTotalOther = Math.round(
  Object.values(otherMonthTotals).reduce((s, v) => s + v, 0) * 100,
) / 100
assert(grandTotalOther === 5000, `case 4: the 9 other months sum to exactly 5,000 with no drift (got ${grandTotalOther})`)
const janTotal = janRecords.reduce((s, a) => s + a.amount, 0)
const c4Total = Math.round((janTotal + grandTotalOther) * 100) / 100
assert(c4Total === 15000, `case 4: total cascade pulled equals the full 15,000 excess exactly (got ${c4Total})`)

// Case 5: single-month project, Project total exceeds B+HC — the
// uncovered remainder is simply not represented (no records for it beyond
// the same-month cap).
const singleMonthProject = { ...project, start_date: '2026-01', end_date: '2026-01' }
const plan5 = [{ month: '2026-01', total: 200000, phases: [] }]
const c5 = computeCascadeAdjustments({ ...singleMonthProject, monthly_plan: plan5 })
assert(c5.length === 2 && c5.every((a) => a.amount === 5000), 'case 5: capped at same-month HC, remainder uncovered')

// validatePlanTotalWithCascade: case 4's full 10-month plan raises the raw
// plan total by exactly the 15,000 excess (865,000 vs a working pool of
// 850,000), but every rupee of that is accounted for by c4's cascade
// records — this must read as balanced despite the uneven 9-way split
// that would have drifted past the 0.01 tolerance without the
// drift-reconciliation fix above.
const workingPool10 = 850000 // 10 months x 85,000 baseline
const v = validatePlanTotalWithCascade(plan4, workingPool10, c4)
assert(v.valid, 'validatePlanTotalWithCascade treats the fully-cascade-funded 10-month plan as balanced')

// A genuinely uncovered shortfall (case 5, single-month project) must NOT
// be hidden — validatePlanTotalWithCascade should still flag it.
const totalPulled5 = c5.reduce((s, a) => s + a.amount, 0)
const v5 = validatePlanTotalWithCascade(plan5, computeMonthBaseline(singleMonthProject), c5)
assert(!v5.valid, 'validatePlanTotalWithCascade still flags a genuine, uncovered shortfall')
assert(
  Math.abs(v5.diff) === Math.round((plan5[0].total - computeMonthBaseline(singleMonthProject) - totalPulled5) * 100) / 100,
  'the flagged diff equals exactly the uncovered portion',
)

console.log('ALL PASS')
```

Run: `node /tmp/claude-1000/-home-jojo-labs-git-lab-HMA/d4d85282-9c9f-4114-857d-f117e0519726/scratchpad/verify-cascade-math.mjs`
Expected: every line prints `OK: ...`, ending with `ALL PASS`. No `FAIL` lines.

- [ ] **Step 4: Commit**

```bash
git add src/services/monthlyApportionment.js
git commit -m "feat: add cascade math (baseline, HR+Core capacity, cascade derivation, cascade-aware validation)"
```

---

## Task 2: `localProjects.js` — cascade recompute + manual upsert

**Files:**
- Modify: `src/services/localProjects.js` (import list; rewrite `updateMonthPlan`; delete `addPoolAdjustment`/`removePoolAdjustment`; add `setManualPoolAdjustment`)

**Interfaces:**
- Consumes (Task 1): `computeCascadeAdjustments(project)`, `validatePlanTotalWithCascade(monthlyPlan, workingPool, poolAdjustments)`. Also newly consumes `computeFlatMonthlyRate(project, pool)` (already exists in `monthlyApportionment.js`, not previously imported into this file).
- Produces: `updateMonthPlan(projectId, month, phases)` → `{project, validation}` — same public shape as before, but `validation` now comes from `validatePlanTotalWithCascade` and `project.pool_adjustments` is recomputed as part of the call. Consumed by Task 3.
- Produces: `setManualPoolAdjustment(projectId, {pool, month, newAmount, createdBy})` → updated `project`. Throws `Error` with a human-readable message on invalid `pool`/`month`. Consumed by Task 3.
- Removes: `addPoolAdjustment`, `removePoolAdjustment` — no longer exported. Their only call sites are in `MonthlyPlanPanel.jsx`'s `WithdrawModal`, which Task 3 deletes in the same pass — **do not land Task 2 and Task 3 out of order in a way that leaves a dangling call**; this plan sequences Task 2 before Task 3, so between these two tasks landing, `WithdrawModal` will reference two functions that no longer exist. This is expected and matches this session's established pattern (a brief, known gap between adjacent tasks that closes by the next task) — flag it in your report, don't treat it as a blocker.

- [ ] **Step 1: Extend the import block**

Find (near the top of `src/services/localProjects.js`):

```js
import {
  computeWorkingPool,
  monthsInRange,
  sumPlanTotal,
  validatePlanTotal,
} from './monthlyApportionment'
```

Replace with:

```js
import {
  computeWorkingPool,
  monthsInRange,
  sumPlanTotal,
  validatePlanTotal,
  computeFlatMonthlyRate,
  computeCascadeAdjustments,
  validatePlanTotalWithCascade,
} from './monthlyApportionment'
```

- [ ] **Step 2: Rewrite `updateMonthPlan`**

Find the existing method (search for `updateMonthPlan(projectId, month, phases) {`):

```js
  updateMonthPlan(projectId, month, phases) {
    const projects = read(PROJECTS_KEY)
    const idx = projects.findIndex((p) => p.id === projectId)
    if (idx === -1) throw new Error('Project not found')
    const project = projects[idx]
    const plan = project.monthly_plan || []
    const mIdx = plan.findIndex((m) => m.month === month)
    if (mIdx === -1) throw new Error(`Month ${month} not found in plan`)

    const total =
      Math.round(phases.reduce((s, ph) => s + (parseFloat(ph.amount) || 0), 0) * 100) / 100
    const updatedPlan = [...plan]
    updatedPlan[mIdx] = { ...updatedPlan[mIdx], phases, total }

    projects[idx] = { ...project, monthly_plan: updatedPlan, updated_at: now() }
    write(PROJECTS_KEY, projects)

    const validation = validatePlanTotal(updatedPlan, computeWorkingPool(projects[idx]))
    return { project: projects[idx], validation }
  },
```

Replace with:

```js
  /**
   * Replaces one month's phase line items, then recomputes the whole
   * project's auto_cascade pool_adjustments from scratch against the
   * updated plan (any month's Project total exceeding its baseline share
   * automatically pulls from HR/Core — see computeCascadeAdjustments).
   * Manual adjustments (and any legacy adjustment without an auto_cascade
   * source tag) are preserved untouched. Does not block on an unbalanced
   * total (single-month edits routinely go out of balance mid-edit) — the
   * returned `validation` field (cascade-aware) tells the caller whether
   * the *overall* plan still balances, so the UI can flag it live.
   */
  updateMonthPlan(projectId, month, phases) {
    const projects = read(PROJECTS_KEY)
    const idx = projects.findIndex((p) => p.id === projectId)
    if (idx === -1) throw new Error('Project not found')
    const project = projects[idx]
    const plan = project.monthly_plan || []
    const mIdx = plan.findIndex((m) => m.month === month)
    if (mIdx === -1) throw new Error(`Month ${month} not found in plan`)

    const total =
      Math.round(phases.reduce((s, ph) => s + (parseFloat(ph.amount) || 0), 0) * 100) / 100
    const updatedPlan = [...plan]
    updatedPlan[mIdx] = { ...updatedPlan[mIdx], phases, total }

    const preservedAdjustments = (project.pool_adjustments || []).filter(
      (a) => a.source !== 'auto_cascade',
    )
    const cascadeAdjustments = computeCascadeAdjustments({
      ...project,
      monthly_plan: updatedPlan,
    }).map((a) => ({
      id: `padj_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      ...a,
      reason: 'Auto-funded from Project overage',
      createdBy: 'System',
      createdAt: now(),
    }))
    const poolAdjustments = [...preservedAdjustments, ...cascadeAdjustments]

    projects[idx] = {
      ...project,
      monthly_plan: updatedPlan,
      pool_adjustments: poolAdjustments,
      updated_at: now(),
    }
    write(PROJECTS_KEY, projects)

    const validation = validatePlanTotalWithCascade(
      updatedPlan,
      computeWorkingPool(projects[idx]),
      poolAdjustments,
    )
    return { project: projects[idx], validation }
  },
```

- [ ] **Step 3: Delete `addPoolAdjustment` and `removePoolAdjustment`, add `setManualPoolAdjustment`**

Find and delete both existing methods (search for `addPoolAdjustment(projectId,` through the end of `removePoolAdjustment`'s closing `},`):

```js
  /**
   * Manually withdraws money from Admin/HR/Core for one specific month —
   * a targeted, one-month deduction (not spread across future months).
   * `amount` is split evenly across every pool named in `pools`: e.g.
   * pools=['hr','core'], amount=2000 records ₹1000 against hr and ₹1000
   * against core. One record per selected pool.
   */
  addPoolAdjustment(projectId, { pools, month, amount, reason, createdBy }) {
    const projects = read(PROJECTS_KEY)
    const pIdx = projects.findIndex((p) => p.id === projectId)
    if (pIdx === -1) throw new Error('Project not found')

    const validPools = ['admin', 'hr', 'core']
    const chosen = (pools || []).filter((p) => validPools.includes(p))
    if (chosen.length === 0) throw new Error('Select at least one pool to withdraw from.')
    const amt = parseFloat(amount) || 0
    if (amt <= 0) throw new Error('Withdrawal amount must be greater than zero.')
    if (!month) throw new Error('A month is required.')
    if (!reason || !reason.trim()) throw new Error('A reason is required for audit purposes.')

    const months = monthsInRange(projects[pIdx].start_date, projects[pIdx].end_date)
    if (!months.includes(month)) throw new Error(`${month} is outside the project's duration.`)

    const perPool = Math.round((amt / chosen.length) * 100) / 100
    const records = chosen.map((pool) => ({
      id: `padj_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      pool,
      month,
      amount: perPool,
      reason: reason.trim(),
      createdBy: createdBy || 'Unknown',
      createdAt: now(),
    }))

    projects[pIdx].pool_adjustments = [...(projects[pIdx].pool_adjustments || []), ...records]
    projects[pIdx].updated_at = now()
    write(PROJECTS_KEY, projects)
    notify()
    return projects[pIdx]
  },

  /** Reverses one withdrawal record (hard delete, matching removeExpense's convention). */
  removePoolAdjustment(projectId, adjustmentId) {
    const projects = read(PROJECTS_KEY)
    const pIdx = projects.findIndex((p) => p.id === projectId)
    if (pIdx === -1) throw new Error('Project not found')
    projects[pIdx].pool_adjustments = (projects[pIdx].pool_adjustments || []).filter(
      (a) => a.id !== adjustmentId,
    )
    projects[pIdx].updated_at = now()
    write(PROJECTS_KEY, projects)
    notify()
    return projects[pIdx]
  },
```

Replace with:

```js
  /**
   * Directly sets a pool's effective figure for one month by upserting a
   * single manual pool_adjustment — replacing any prior manual adjustment
   * for that exact pool+month (not stacking). `newAmount` is the desired
   * effective value; the stored adjustment amount is however much that
   * differs from the flat rate (delta = flat − newAmount). Delta can be
   * negative (a manual top-up above the flat rate) — not clamped,
   * consistent with this codebase's existing pool-adjustment behavior. If
   * the delta rounds to within half a paisa of zero, any existing manual
   * adjustment for that pool+month is removed instead of storing a no-op
   * record (back to the flat rate).
   */
  setManualPoolAdjustment(projectId, { pool, month, newAmount, createdBy }) {
    const projects = read(PROJECTS_KEY)
    const pIdx = projects.findIndex((p) => p.id === projectId)
    if (pIdx === -1) throw new Error('Project not found')

    const validPools = ['admin', 'hr', 'core']
    if (!validPools.includes(pool)) throw new Error('Pool must be admin, hr, or core.')
    if (!month) throw new Error('A month is required.')

    const months = monthsInRange(projects[pIdx].start_date, projects[pIdx].end_date)
    if (!months.includes(month)) throw new Error(`${month} is outside the project's duration.`)

    const flat = computeFlatMonthlyRate(projects[pIdx], pool)
    const delta = Math.round((flat - (parseFloat(newAmount) || 0)) * 100) / 100

    const withoutExistingManual = (projects[pIdx].pool_adjustments || []).filter(
      (a) => !(a.source === 'manual' && a.pool === pool && a.month === month),
    )

    const nextAdjustments =
      Math.abs(delta) < 0.01
        ? withoutExistingManual
        : [
            ...withoutExistingManual,
            {
              id: `padj_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
              pool,
              month,
              amount: delta,
              source: 'manual',
              reason: 'Direct edit',
              createdBy: createdBy || 'Unknown',
              createdAt: now(),
            },
          ]

    projects[pIdx].pool_adjustments = nextAdjustments
    projects[pIdx].updated_at = now()
    write(PROJECTS_KEY, projects)
    notify()
    return projects[pIdx]
  },
```

- [ ] **Step 4: Verify it lints clean**

Run: `npm run lint -- src/services/localProjects.js`
Expected: ≤26 errors (this file's pre-existing baseline — do not exceed).

- [ ] **Step 5: Verify behavior with a Node scratch script**

Create a scratch file (not committed) at
`/tmp/claude-1000/-home-jojo-labs-git-lab-HMA/d4d85282-9c9f-4114-857d-f117e0519726/scratchpad/verify-localprojects-cascade.mjs`:

```js
// Minimal in-memory localStorage polyfill, same technique used earlier
// this session to verify localProjects.js CRUD functions under plain Node.
globalThis.localStorage = (() => {
  let store = {}
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
  }
})()

const { localProjects } = await import(
  '/home/jojo/labs/git-lab/HMA/hma-template/emsv1/src/services/localProjects.js'
)

const assert = (cond, msg) => {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`OK: ${msg}`)
}

// Seed a minimal project directly into localStorage under the same key
// localProjects.js uses (confirmed current value at the top of that file).
const PROJECTS_KEY = 'hma_projects_v11'
const project = {
  id: 'test_proj_1',
  project_value: 1000000,
  start_date: '2026-01',
  end_date: '2026-03',
  admin_pct: 5,
  hr_pct: 5,
  core_pct: 5,
  monthly_plan: [
    { month: '2026-01', phases: [{ phase: 'design', label: 'x', amount: 85000 }], total: 85000 },
    { month: '2026-02', phases: [{ phase: 'design', label: 'x', amount: 85000 }], total: 85000 },
    { month: '2026-03', phases: [{ phase: 'design', label: 'x', amount: 85000 }], total: 85000 },
  ],
  pool_adjustments: [],
}
localStorage.setItem(PROJECTS_KEY, JSON.stringify([project]))

// Edit January's phases to push its total to 92,000 (excess 7,000, within
// HC=10,000) — expect a same-month-only cascade of 3,500/3,500.
const { project: updated, validation } = localProjects.updateMonthPlan('test_proj_1', '2026-01', [
  { phase: 'design', label: 'x', amount: 92000 },
])
const janCascade = updated.pool_adjustments.filter(
  (a) => a.source === 'auto_cascade' && a.month === '2026-01',
)
assert(janCascade.length === 2, 'exactly 2 auto_cascade records for January')
assert(janCascade.every((a) => a.amount === 3500), 'each is 3,500 (7,000 excess / 2)')
assert(validation.valid, 'plan reads as balanced (cascade-funded)')

// Manually set HR for February to 2,000 (below its flat rate of 5,000) —
// expect one 'manual' adjustment of 3,000 (delta = flat - newAmount).
const afterManual = localProjects.setManualPoolAdjustment('test_proj_1', {
  pool: 'hr',
  month: '2026-02',
  newAmount: 2000,
  createdBy: 'Test User',
})
const febManual = afterManual.pool_adjustments.filter(
  (a) => a.source === 'manual' && a.month === '2026-02' && a.pool === 'hr',
)
assert(febManual.length === 1, 'exactly 1 manual record for February HR')
assert(febManual[0].amount === 3000, 'manual delta is 3,000 (5,000 flat - 2,000 requested)')

// Re-editing January's phases again should recompute the auto_cascade
// records fresh (still 2, still 3,500 each, since the plan didn't change)
// WITHOUT touching the manual February record just created.
const { project: updated2 } = localProjects.updateMonthPlan('test_proj_1', '2026-01', [
  { phase: 'design', label: 'x', amount: 92000 },
])
const febManualAfter = updated2.pool_adjustments.filter(
  (a) => a.source === 'manual' && a.month === '2026-02',
)
assert(febManualAfter.length === 1 && febManualAfter[0].amount === 3000, 'manual February record survives a cascade recompute')
const janCascadeAfter = updated2.pool_adjustments.filter(
  (a) => a.source === 'auto_cascade' && a.month === '2026-01',
)
assert(janCascadeAfter.length === 2, 'auto_cascade recomputed fresh, still exactly 2 records (not stacked/duplicated)')

// Editing January back down to baseline (85,000) should clear its cascade
// entirely.
const { project: updated3 } = localProjects.updateMonthPlan('test_proj_1', '2026-01', [
  { phase: 'design', label: 'x', amount: 85000 },
])
const janCascadeGone = updated3.pool_adjustments.filter((a) => a.source === 'auto_cascade')
assert(janCascadeGone.length === 0, 'cascade fully clears when Project total returns to baseline')

// Setting a manual adjustment back to exactly the flat rate removes the
// record instead of storing a zero-delta no-op.
const afterReset = localProjects.setManualPoolAdjustment('test_proj_1', {
  pool: 'hr',
  month: '2026-02',
  newAmount: 5000,
  createdBy: 'Test User',
})
const febManualReset = afterReset.pool_adjustments.filter(
  (a) => a.source === 'manual' && a.month === '2026-02',
)
assert(febManualReset.length === 0, 'manual adjustment removed (not stored as a zero-delta record) when reset to flat rate')

console.log('ALL PASS')
```

Run: `node /tmp/claude-1000/-home-jojo-labs-git-lab-HMA/d4d85282-9c9f-4114-857d-f117e0519726/scratchpad/verify-localprojects-cascade.mjs`
Expected: every line prints `OK: ...`, ending with `ALL PASS`. No `FAIL` lines. (If `PROJECTS_KEY` doesn't match, the script will fail early with a "Project not found" error — read the actual constant from the top of `localProjects.js` and fix the script before treating this as a real failure.)

- [ ] **Step 6: Commit**

```bash
git add src/services/localProjects.js
git commit -m "feat: recompute HR/Core cascade on plan edits, replace withdraw CRUD with manual upsert"
```

---

## Task 3: `MonthlyPlanPanel.jsx` — inline-editable HR/Core, remove Withdraw

**Files:**
- Modify: `src/modules/pms/project-associate/MonthlyPlanPanel.jsx`

**Interfaces:**
- Consumes (Task 1, via existing import from `monthlyApportionment.js`): add `validatePlanTotalWithCascade` to the existing import list, remove nothing from it. Consumes (Task 2): `localProjects.setManualPoolAdjustment(projectId, {pool, month, newAmount, createdBy})`.
- Produces: no new exports — this task only changes `PlanTable`, `PlanningSummary`, and the default-exported `MonthlyPlanPanel`'s prop signatures (removing `canWithdraw` from all three).

- [ ] **Step 1: Update the import list**

Find (near the top of the file):

```js
import {
  computeWorkingPool,
  monthsInRange,
  computeEffectivePoolMonthly,
  validatePlanTotal,
} from '../../../services/monthlyApportionment'
```

Replace with:

```js
import {
  computeWorkingPool,
  monthsInRange,
  computeEffectivePoolMonthly,
  validatePlanTotalWithCascade,
} from '../../../services/monthlyApportionment'
```

(`validatePlanTotal` is no longer called directly in this file — `MonthAccordion`'s own regenerate pre-check, if any, uses `computeWorkingPool`/`monthsInRange` only; confirm by reading `MonthAccordion`'s body before removing `validatePlanTotal` from the import — if it turns out `MonthAccordion` does call `validatePlanTotal` directly, keep it in the import list alongside `validatePlanTotalWithCascade` rather than removing it.)

- [ ] **Step 2: Delete `POOL_LABELS` and `WithdrawModal` entirely**

Find and delete this line (a few lines before `WithdrawModal`'s definition):

```js
const POOL_LABELS = { admin: 'Admin', hr: 'HR', core: 'Core' }
```

Find and delete the entire `WithdrawModal` component and its `propTypes` block — from `const WithdrawModal = ({ visible, onClose, project, month, onProjectChange, currentUser }) => {` through the closing:

```js
WithdrawModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  project: PropTypes.object.isRequired,
  month: PropTypes.string,
  onProjectChange: PropTypes.func.isRequired,
  currentUser: PropTypes.string,
}
```

Delete the whole block, including everything in between (the pool checkboxes, amount/reason inputs, existing-withdrawals list, and the modal JSX).

- [ ] **Step 3: Rewrite `PlanTable`**

Find the current `PlanTable` component (`const PlanTable = ({ project, onProjectChange, canEdit = false, canWithdraw = false, currentUser = 'Unknown' }) => { ... }` through its closing `PlanTable.propTypes = {...}` block) and replace the ENTIRE component with:

```js
const PlanTable = ({ project, onProjectChange, canEdit = false, currentUser = 'Unknown' }) => {
  const workingPool = computeWorkingPool(project)
  const validation = validatePlanTotalWithCascade(
    project.monthly_plan,
    workingPool,
    project.pool_adjustments,
  )
  const [saved, setSaved] = useState(false)

  const handleAmountChange = (month, phaseIdx, amount) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    const phases = monthEntry.phases.map((ph, i) =>
      i === phaseIdx ? { ...ph, amount: parseFloat(amount) || 0 } : ph,
    )
    const { project: updated } = localProjects.updateMonthPlan(project.id, month, phases)
    onProjectChange(updated)
  }

  const handleLabelChange = (month, phaseIdx, label) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    const phases = monthEntry.phases.map((ph, i) => (i === phaseIdx ? { ...ph, label } : ph))
    const { project: updated } = localProjects.updateMonthPlan(project.id, month, phases)
    onProjectChange(updated)
  }

  const handlePhaseChange = (month, phaseIdx, phase) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    const phases = monthEntry.phases.map((ph, i) => (i === phaseIdx ? { ...ph, phase } : ph))
    const { project: updated } = localProjects.updateMonthPlan(project.id, month, phases)
    onProjectChange(updated)
  }

  const handleAddPhase = (month) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    const phases = [...monthEntry.phases, { phase: 'design', label: '', amount: 0 }]
    const { project: updated } = localProjects.updateMonthPlan(project.id, month, phases)
    onProjectChange(updated)
  }

  const handleRemovePhase = (month, phaseIdx) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    const phases = monthEntry.phases.filter((_, i) => i !== phaseIdx)
    const { project: updated } = localProjects.updateMonthPlan(project.id, month, phases)
    onProjectChange(updated)
  }

  const handlePoolAmountChange = (pool, month, newAmount) => {
    const updated = localProjects.setManualPoolAdjustment(project.id, {
      pool,
      month,
      newAmount,
      createdBy: currentUser,
    })
    onProjectChange(updated)
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <CCard className="shadow-sm mb-4">
      <CCardHeader className="bg-transparent fw-semibold pt-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <span>📊 Monthly Plan</span>
        <div className="d-flex align-items-center gap-2">
          <CBadge color={validation.valid ? 'success' : 'danger'}>
            {validation.valid
              ? `Balanced — ${fmt(validation.planTotal)}`
              : `Off by ${fmt(Math.abs(validation.diff))} (plan ${fmt(validation.planTotal)} vs baseline ${fmt(validation.workingPool)})`}
          </CBadge>
          <CButton size="sm" color="primary" onClick={handleSave}>
            💾 Save Monthly Plan
          </CButton>
        </div>
      </CCardHeader>
      {saved && (
        <CAlert color="success" className="mb-0 py-2 small rounded-0 text-center">
          ✓ Monthly plan saved
        </CAlert>
      )}
      <CCardBody className="p-0">
        <div style={{ overflowX: 'auto' }}>
          <CTable hover align="middle" className="mb-0" style={{ fontSize: '0.82rem' }}>
            <CTableHead color="light">
              <CTableRow>
                <CTableHeaderCell>Month</CTableHeaderCell>
                <CTableHeaderCell>Phase Breakdown (Project)</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Project Total</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Admin</CTableHeaderCell>
                <CTableHeaderCell className="text-end">HR</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Core</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {project.monthly_plan.map((m) => {
                const adjustedFor = (pool) =>
                  (project.pool_adjustments || []).some(
                    (a) => a.pool === pool && a.month === m.month,
                  )
                return (
                  <CTableRow key={m.month}>
                    <CTableDataCell className="fw-semibold">{monthLabel(m.month)}</CTableDataCell>
                    <CTableDataCell>
                      {m.phases.map((ph, i) => (
                        <div key={i} className="d-flex align-items-center gap-1 mb-1 flex-wrap">
                          <CFormSelect
                            size="sm"
                            style={{ width: 110 }}
                            value={ph.phase}
                            disabled={!canEdit}
                            onChange={(e) => handlePhaseChange(m.month, i, e.target.value)}
                          >
                            {PHASE_OPTIONS.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </CFormSelect>
                          <CFormInput
                            size="sm"
                            style={{ width: 130 }}
                            placeholder="Task / activity"
                            value={ph.label}
                            disabled={!canEdit}
                            onChange={(e) => handleLabelChange(m.month, i, e.target.value)}
                          />
                          <CInputGroup size="sm" style={{ maxWidth: 120 }}>
                            <CInputGroupText>₹</CInputGroupText>
                            <CFormInput
                              type="number"
                              min="0"
                              value={ph.amount}
                              disabled={!canEdit}
                              onChange={(e) => handleAmountChange(m.month, i, e.target.value)}
                            />
                          </CInputGroup>
                          {canEdit && (
                            <CButton
                              size="sm"
                              color="danger"
                              variant="ghost"
                              disabled={m.phases.length === 1}
                              onClick={() => handleRemovePhase(m.month, i)}
                            >
                              <CIcon icon={cilTrash} size="sm" />
                            </CButton>
                          )}
                        </div>
                      ))}
                      {canEdit && (
                        <CButton
                          size="sm"
                          color="secondary"
                          variant="outline"
                          onClick={() => handleAddPhase(m.month)}
                        >
                          <CIcon icon={cilPlus} className="me-1" />
                          Add Line
                        </CButton>
                      )}
                    </CTableDataCell>
                    <CTableDataCell className="text-end fw-bold">{fmt(m.total)}</CTableDataCell>
                    <CTableDataCell className="text-end">
                      {fmt(computeEffectivePoolMonthly(project, 'admin', m.month))}
                      {adjustedFor('admin') && (
                        <CBadge
                          color="warning"
                          shape="rounded-pill"
                          className="ms-1"
                          style={{ fontSize: '0.6rem' }}
                        >
                          adjusted
                        </CBadge>
                      )}
                    </CTableDataCell>
                    {['hr', 'core'].map((pool) => (
                      <CTableDataCell key={pool} className="text-end">
                        <CInputGroup
                          size="sm"
                          style={{ maxWidth: 130, marginLeft: 'auto' }}
                        >
                          <CInputGroupText>₹</CInputGroupText>
                          <CFormInput
                            type="number"
                            value={computeEffectivePoolMonthly(project, pool, m.month)}
                            disabled={!canEdit}
                            onChange={(e) => handlePoolAmountChange(pool, m.month, e.target.value)}
                          />
                        </CInputGroup>
                        {adjustedFor(pool) && (
                          <CBadge
                            color="warning"
                            shape="rounded-pill"
                            className="ms-1"
                            style={{ fontSize: '0.6rem' }}
                          >
                            adjusted
                          </CBadge>
                        )}
                      </CTableDataCell>
                    ))}
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
  canEdit: PropTypes.bool,
  currentUser: PropTypes.string,
}
```

- [ ] **Step 4: Update `PlanningSummary`'s validation call**

Find (inside `PlanningSummary`):

```js
  const workingPool = computeWorkingPool(project)
  const validation = validatePlanTotal(project.monthly_plan, workingPool)
```

Replace with:

```js
  const workingPool = computeWorkingPool(project)
  const validation = validatePlanTotalWithCascade(
    project.monthly_plan,
    workingPool,
    project.pool_adjustments,
  )
```

- [ ] **Step 5: Remove `canWithdraw` from the top-level `MonthlyPlanPanel` export**

Find:

```js
const MonthlyPlanPanel = ({
  project,
  onProjectChange,
  canEdit = false,
  canWithdraw = false,
  currentUser = 'Unknown',
}) => {
  const hasPlan = Boolean(project.monthly_plan?.length)
  return (
    <>
      <MonthAccordion
        project={project}
        onProjectChange={onProjectChange}
        canEdit={canEdit}
        defaultCollapsed={hasPlan}
      />
      {hasPlan && (
        <>
          <PlanTable
            project={project}
            onProjectChange={onProjectChange}
            canEdit={canEdit}
            canWithdraw={canWithdraw}
            currentUser={currentUser}
          />
          <PlanningSummary project={project} />
          <ActualSpendPanel project={project} />
        </>
      )}
    </>
  )
}

MonthlyPlanPanel.propTypes = {
  project: PropTypes.object.isRequired,
  onProjectChange: PropTypes.func.isRequired,
  canEdit: PropTypes.bool,
  canWithdraw: PropTypes.bool,
  currentUser: PropTypes.string,
}
```

Replace with:

```js
const MonthlyPlanPanel = ({
  project,
  onProjectChange,
  canEdit = false,
  currentUser = 'Unknown',
}) => {
  const hasPlan = Boolean(project.monthly_plan?.length)
  return (
    <>
      <MonthAccordion
        project={project}
        onProjectChange={onProjectChange}
        canEdit={canEdit}
        defaultCollapsed={hasPlan}
      />
      {hasPlan && (
        <>
          <PlanTable
            project={project}
            onProjectChange={onProjectChange}
            canEdit={canEdit}
            currentUser={currentUser}
          />
          <PlanningSummary project={project} />
          <ActualSpendPanel project={project} />
        </>
      )}
    </>
  )
}

MonthlyPlanPanel.propTypes = {
  project: PropTypes.object.isRequired,
  onProjectChange: PropTypes.func.isRequired,
  canEdit: PropTypes.bool,
  currentUser: PropTypes.string,
}
```

- [ ] **Step 6: Verify it lints clean**

Run: `npm run lint -- src/modules/pms/project-associate/MonthlyPlanPanel.jsx`
Expected: 0 errors (this file's baseline is 0 — hold it strictly).

- [ ] **Step 7: Verify the build succeeds**

Run: `npm run build`
Expected: build completes with no errors. (This will still fail at this point if `ProjectDetailPage.jsx`, Task 4, still passes a `canWithdraw` prop — Vite doesn't statically check prop shapes against a component's declared PropTypes, so an unrecognized prop being passed does NOT fail the build, only a PropTypes console warning at runtime, which no build step catches in this environment. Confirm no *other* consequence — e.g. no leftover reference to the deleted `WithdrawModal`, `POOL_LABELS`, `addPoolAdjustment`, or `removePoolAdjustment` symbols anywhere in this file.)

- [ ] **Step 8: Manual review checklist (no browser available)**

Confirm: (a) no reference to `WithdrawModal`, `POOL_LABELS`, `withdrawMonth`, `canWithdraw`, `addPoolAdjustment`, or `removePoolAdjustment` remains anywhere in this file; (b) the HR/Core `CFormInput`s are disabled exactly when `!canEdit`, matching every other editable control in this table; (c) `adjustedFor(pool)` is unchanged and still checks `project.pool_adjustments` for ANY matching record regardless of `source` — both manual and auto-cascade adjustments should show the "adjusted" badge. Note in your report that no rendered-browser check was possible.

- [ ] **Step 9: Commit**

```bash
git add src/modules/pms/project-associate/MonthlyPlanPanel.jsx
git commit -m "feat: make HR/Core inline-editable in Monthly Plan, remove Withdraw modal"
```

---

## Task 4: `ProjectDetailPage.jsx` — Budget & Payroll single source of truth

**Files:**
- Modify: `src/modules/pms/project-associate/ProjectDetailPage.jsx`

**Interfaces:**
- Consumes (already imported in this file): `localProjectExpenses.list({ projectId, pool })` (used identically to the existing Admin-card usage, just generalized to all three pools).
- Produces: no new exports — this task only changes the Budget & Payroll tab's data assembly and the `MonthlyPlanPanel` call site's props.

- [ ] **Step 1: Remove the now-unused `localOrgPool` and `localAdminExpenses` imports**

Find (near the top of the file):

```js
import { localOrgPool } from '../../../services/localOrgPool'
import { localAdminExpenses } from '../../../services/localAdminExpenses'
import { localProjectExpenses } from '../../../services/localProjectExpenses'
```

Replace with:

```js
import { localProjectExpenses } from '../../../services/localProjectExpenses'
```

(Before deleting, confirm via `grep -n "localOrgPool\.\|localAdminExpenses\."` on this file that the only remaining usages are the ones this task removes in Step 2 below — if a grep turns up any other usage elsewhere in this large file, stop and report it rather than silently removing the import.)

- [ ] **Step 2: Replace the Budget & Payroll data assembly and the three `ExpenseCard`s**

Find, inside the Budget & Payroll tab's IIFE (search for `const hrSummary = localOrgPool.getProjectHRBudgetSummary`):

```js
                const hrSummary = localOrgPool.getProjectHRBudgetSummary(project.id)
                const coreSummary = localOrgPool.getProjectCoreBudgetSummary(project.id)
                const hrCharges = localOrgPool
                  .getProjectHRCharges(project.id)
                  .map((c) => ({ ...c, amount: c.myAmount }))
                const coreCharges = localOrgPool
                  .getProjectCoreCharges(project.id)
                  .map((c) => ({ ...c, amount: c.myAmount }))

                const saveActualDate = (instId) => {
```

Replace with:

```js
                const poolExpensesFor = (pool) =>
                  localProjectExpenses.list({ projectId: project.id, pool }).map((e) => ({
                    id: e.id,
                    label: e.label,
                    amount: e.amount,
                    date: e.createdAt,
                    notes: `Logged by ${e.createdBy}`,
                    source: 'project_actual',
                  }))

                const saveActualDate = (instId) => {
```

Find, a little further down (search for `const handleAddExpense = (pool, expense) => {`), and delete these three handlers entirely — they're no longer called by anything once all three `ExpenseCard`s become read-only:

```js
                const handleAddExpense = (pool, expense) => {
                  const updated = localProjects.addExpense(project.id, pool, expense)
                  setProject(updated)
                  setToast({ color: 'success', message: `${pool.toUpperCase()} expense added.` })
                }

                const handleRemoveExpense = (pool, expId) => {
                  const updated = localProjects.removeExpense(project.id, pool, expId)
                  setProject(updated)
                }

                const handleEditExpense = (pool, expId, data) => {
                  const updated = localProjects.updateExpense(project.id, pool, expId, data)
                  setProject(updated)
                }

```

(Leave the `fmtD`/`UC_COLORS` declarations that follow untouched.)

Find the three `ExpenseCard` call sites (search for `<CRow className="g-3">` inside this same section, through the closing `</CRow>` right before `</CCardBody>`):

```jsx
                        <CRow className="g-3">
                          <CCol xs={12} md={4}>
                            {(() => {
                              // Merge org-level EMS expenses (read-only), this project's
                              // actual admin spend (from the EMS Project Expenses tab), and
                              // project-specific admin expenses added directly in this card
                              const orgAdminExpenses = localAdminExpenses.asProjectExpenses()
                              const projectActualAdminExpenses = localProjectExpenses
                                .list({ projectId: project.id, pool: 'admin' })
                                .map((e) => ({
                                  id: e.id,
                                  label: e.label,
                                  amount: e.amount,
                                  date: e.createdAt,
                                  notes: `Logged by ${e.createdBy}`,
                                  source: 'project_actual',
                                }))
                              const mergedAdminExpenses = [
                                ...orgAdminExpenses,
                                ...projectActualAdminExpenses,
                                ...(project.admin_expenses || []),
                              ]
                              return (
                                <ExpenseCard
                                  title="🏛 Admin Expenses"
                                  color="warning"
                                  budget={
                                    (project.project_valuation || project.project_value || 0) *
                                    ((project.admin_pct ?? 5) / 100)
                                  }
                                  expenses={mergedAdminExpenses}
                                  isAdmin={true}
                                  projectId={project.id}
                                  onAdd={(exp) => handleAddExpense('admin', exp)}
                                  onRemove={(expId) => handleRemoveExpense('admin', expId)}
                                  onEdit={(expId, data) => handleEditExpense('admin', expId, data)}
                                />
                              )
                            })()}
                          </CCol>
                          <CCol xs={12} md={4}>
                            <ExpenseCard
                              title="👥 HR Pool Charges"
                              color="primary"
                              budget={hrSummary.poolBudget}
                              expenses={hrCharges}
                              isAdmin={false}
                              projectId={project.id}
                              isReadOnly={true}
                            />
                          </CCol>
                          <CCol xs={12} md={4}>
                            <ExpenseCard
                              title="⚡ Core Pool Charges"
                              color="danger"
                              budget={coreSummary.poolBudget}
                              expenses={coreCharges}
                              isAdmin={false}
                              projectId={project.id}
                              isReadOnly={true}
                            />
                          </CCol>
                        </CRow>
```

Replace with:

```jsx
                        <CRow className="g-3">
                          <CCol xs={12} md={4}>
                            <ExpenseCard
                              title="🏛 Admin Expenses"
                              color="warning"
                              budget={
                                (project.project_valuation || project.project_value || 0) *
                                ((project.admin_pct ?? 5) / 100)
                              }
                              expenses={poolExpensesFor('admin')}
                              isAdmin={true}
                              projectId={project.id}
                              isReadOnly={true}
                            />
                          </CCol>
                          <CCol xs={12} md={4}>
                            <ExpenseCard
                              title="👥 HR Pool Charges"
                              color="primary"
                              budget={
                                (project.project_valuation || project.project_value || 0) *
                                ((project.hr_pct ?? 5) / 100)
                              }
                              expenses={poolExpensesFor('hr')}
                              isAdmin={false}
                              projectId={project.id}
                              isReadOnly={true}
                            />
                          </CCol>
                          <CCol xs={12} md={4}>
                            <ExpenseCard
                              title="⚡ Core Pool Charges"
                              color="danger"
                              budget={
                                (project.project_valuation || project.project_value || 0) *
                                ((project.core_pct ?? 5) / 100)
                              }
                              expenses={poolExpensesFor('core')}
                              isAdmin={false}
                              projectId={project.id}
                              isReadOnly={true}
                            />
                          </CCol>
                        </CRow>
```

- [ ] **Step 3: Remove the now-invalid `canWithdraw` prop at the `MonthlyPlanPanel` call site**

Find (in the "Monthly Plan Tab" `CTabPane`, search for `<MonthlyPlanPanel`):

```jsx
              <MonthlyPlanPanel
                project={project}
                onProjectChange={setProject}
                canEdit={canEditMonthlyPlan}
                canWithdraw={isBudgetAdmin}
                currentUser={user?.full_name || user?.employee_id || 'Unknown'}
              />
```

Replace with:

```jsx
              <MonthlyPlanPanel
                project={project}
                onProjectChange={setProject}
                canEdit={canEditMonthlyPlan}
                currentUser={user?.full_name || user?.employee_id || 'Unknown'}
              />
```

(`isBudgetAdmin` itself is still used elsewhere in this file — the admin_pct/hr_pct/core_pct steppers in the "Project Overheads" card header — do not remove its declaration.)

- [ ] **Step 4: Verify it lints clean**

Run: `npm run lint -- src/modules/pms/project-associate/ProjectDetailPage.jsx`
Expected: ≤56 errors (this file's pre-existing baseline — do not exceed).

- [ ] **Step 5: Verify the build succeeds**

Run: `npm run build`
Expected: build completes with no errors. This is the first task where the full chain (Task 2's renamed/removed functions, Task 3's removed `WithdrawModal`/`canWithdraw`, Task 4's removed imports) all land together — a clean build here confirms no dangling references anywhere across all three files.

- [ ] **Step 6: Manual review checklist (no browser available)**

Confirm: (a) `localProjects.addExpense`/`removeExpense`/`updateExpense` are no longer called anywhere in this file (they may still exist as service methods — this task doesn't touch `localProjects.js`'s expense CRUD, only stops calling it from here); (b) all three `ExpenseCard`s pass `isReadOnly={true}`; (c) the HR/Core budget figures now use `hr_pct`/`core_pct` respectively (not both defaulting to the Admin figure or to `localOrgPool`'s old summaries). Note in your report that no rendered-browser check was possible.

- [ ] **Step 7: Commit**

```bash
git add src/modules/pms/project-associate/ProjectDetailPage.jsx
git commit -m "feat: source Budget & Payroll Admin/HR/Core cards only from EMS-logged project expenses"
```

---

## Final Verification (after all 4 tasks)

- [ ] Run `npm run build` from `hma-template/emsv1` — must succeed with no errors.
- [ ] Run `npm run lint -- src/services/monthlyApportionment.js src/services/localProjects.js src/modules/pms/project-associate/MonthlyPlanPanel.jsx src/modules/pms/project-associate/ProjectDetailPage.jsx` — every file at or under its Global Constraints baseline.
- [ ] Re-run both Node scratch scripts (Task 1 and Task 2) one more time against the final committed code to confirm no regressions from later tasks.
- [ ] Grep the whole `src/` tree for `WithdrawModal`, `addPoolAdjustment`, `removePoolAdjustment`, `POOL_LABELS`, `canWithdraw`, `localOrgPool`, and `localAdminExpenses` inside `MonthlyPlanPanel.jsx`/`ProjectDetailPage.jsx` specifically — all should return zero matches in those two files.
- [ ] Manually trace one end-to-end scenario by reading the code (no browser available): a project with a Monthly Plan where the PO edits January's Project total from 85,000 to 95,000 (baseline + full HC) → confirm `updateMonthPlan` produces exactly 2 `auto_cascade` records (hr 5,000, core 5,000) against January only → confirm `PlanTable`'s badge and `PlanningSummary`'s verdict both read this as balanced → confirm the Budget & Payroll HR/Core cards are unaffected by this (they only reflect EMS-logged actuals, not planned/cascaded figures) — these are two genuinely separate concepts (planned pool allocation vs. actual money spent) and this task set does not conflate them.
