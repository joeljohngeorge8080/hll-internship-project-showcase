# Flat Admin/HR/Core Rates, Multi-Block Planning, Manual Withdrawals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current locked-admin-lump-sum / per-month-HR-Core-carve-out math with symmetric flat live-computed Admin/HR/Core pools, replace the single-template Generate mechanic with multi-block planning, and add a manual per-month withdrawal provision from Admin/HR/Core.

**Architecture:** `monthlyApportionment.js` (pure) gets a new flat-rate formula and a withdrawal-adjustment lookup, replacing the per-month carve-out formula. `localProjects.js` gets a rewritten `generateMonthlyPlan` (multi-block instead of single-template) and new withdrawal CRUD, and loses the admin-crediting/locking machinery entirely. `MonthlyPlanPanel.jsx` gets a `BlockPlanner` (replacing `TemplateEditor`) and an updated `PlanTable` (flat pool columns instead of per-month steppers, plus a Withdraw modal). One new prop flows from `ProjectDetailPage.jsx` for withdrawal access. `ExpenseManagementPage.jsx`'s Consolidated Sheet integration is updated to match.

**Tech Stack:** React 19 + Vite, CoreUI React, plain JS service modules backed by `localStorage`. No test framework, no working browser in this environment (confirmed throughout this session) — verification is `npm run build` + scoped `npm run lint -- <file>` + Node-traced manual verification for pure/impure logic.

**Design reference:** `docs/NEWPLAN (1).drawio` (hand-drawn diagram) and `/home/jojo/.claude/plans/dazzling-humming-zephyr.md` (the approved architecture plan this implementation plan is derived from — read it for the full rationale behind each decision below).

## Global Constraints

- **Scope boundary:** this plan touches only System B (`monthlyApportionment.js`, the plan-CRUD parts of `localProjects.js`, `MonthlyPlanPanel.jsx`, the Consolidated Sheet's `monthly_plan` integration in `ExpenseManagementPage.jsx`, and one prop addition in `ProjectDetailPage.jsx`). System A (`localOrgPool.js`, the "Project Overheads" card, `GlobalHRPoolPage.jsx`, `ProjectOverheadView.jsx`, `ProjectOverheadsList.jsx`, `pms/projects/ProjectDetailPage.jsx`) is a separate, older, still-load-bearing computation path and must not be modified.
- **No test framework, no working browser** — every task's verification is `npm run build` + scoped `npm run lint -- <file>` + a Node-traced manual check (using an in-memory `localStorage` polyfill for impure functions, following the pattern already established earlier in this session).
- **Lint baselines** (measured on a clean checkout before this plan's tasks run — do not exceed; it's fine if a count decreases from deleted code):

  | File | Baseline |
  |---|---|
  | `src/services/monthlyApportionment.js` | 0 |
  | `src/services/localProjects.js` | 24 |
  | `src/modules/pms/project-associate/MonthlyPlanPanel.jsx` | 0 |
  | `src/modules/pms/project-associate/ProjectDetailPage.jsx` | 56 |
  | `src/modules/ems/expense-management/ExpenseManagementPage.jsx` | 38 |

  `npm run build` currently passes clean and must continue to after every task.
- Money values always rounded with `Math.round(x * 100) / 100`. Month strings always `'YYYY-MM'`.
- Follow each file's existing style exactly (no semicolons, single quotes, 2-space indent).
- Run all commands from `/home/jojo/labs/git-lab/HMA/hma-template/emsv1`.

---

## Task 1: Pure math changes in `monthlyApportionment.js`

**Files:**
- Modify: `src/services/monthlyApportionment.js` (full rewrite of `computeWorkingPool`, deletion of `computeMonthSplit`, three new exports)

**Interfaces:**
- Produces: `computeWorkingPool(project)` → `number` (now `project_value × (100 - admin_pct - hr_pct - core_pct)% ÷ 100`, not "value minus locked admin lump sum"). Consumed by Task 3 (`generateMonthlyPlan`) and Task 5/6 (UI).
- Produces: `computeFlatMonthlyRate(project, pool)` → `number`, `pool ∈ {'admin','hr','core'}`. Consumed by Task 6 (`PlanTable`) and Task 8 (Consolidated Sheet).
- Produces: `sumPoolAdjustments(adjustments, pool, month)` → `number`. Consumed by `computeEffectivePoolMonthly` (same file) and Task 4 (withdrawal CRUD, for validation).
- Produces: `computeEffectivePoolMonthly(project, pool, month)` → `number` (`computeFlatMonthlyRate(project, pool) - sumPoolAdjustments(project.pool_adjustments, pool, month)`, never clamped at 0). Consumed by Task 6 and Task 8.
- Removes: `computeMonthSplit` — no longer exported. Its 2 current call sites (`MonthlyPlanPanel.jsx:312`, `ExpenseManagementPage.jsx:477`) are updated in Tasks 6 and 8 respectively — **do not leave either call site broken after this task**; Task 1 only changes this file, so those two call sites will fail to build until Tasks 6/8 land. Tasks in this plan are sequenced so Task 5/6 (UI) and Task 8 happen after Task 1-4 are committed — see the note in Task 1 Step 4 about verifying build state honestly.

- [ ] **Step 1: Replace `computeWorkingPool`**

Replace (currently lines 8-16):
```js
/**
 * Working pool = total project value minus the (already-credited, locked)
 * admin lump sum. This is what the monthly plan (Task 3) must sum to.
 */
export const computeWorkingPool = (project) => {
  const pv = project.project_value || project.project_valuation || 0
  const admin = project.admin_pool_amount || 0
  return Math.round((pv - admin) * 100) / 100
}
```
with:
```js
/**
 * Working pool = the project's own baseline share of total value — the
 * residual after Admin, HR, and Core's percentages (each independently
 * pct% of total value, not carved out of this pool). This is what the
 * monthly plan (generateMonthlyPlan) must sum to.
 */
export const computeWorkingPool = (project) => {
  const pv = project.project_value || project.project_valuation || 0
  const adminPct = project.admin_pct ?? 5
  const hrPct = project.hr_pct ?? 5
  const corePct = project.core_pct ?? 5
  const projectPct = 100 - adminPct - hrPct - corePct
  return Math.round(pv * (projectPct / 100) * 100) / 100
}
```

- [ ] **Step 2: Delete `computeMonthSplit`**

Delete (currently lines 40-52):
```js
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
```

- [ ] **Step 3: Add the three new exports**

Add at the end of the file (after `validatePlanTotal`):
```js
/**
 * Flat monthly rate for one pool ('admin'|'hr'|'core') — pct% of total
 * project value, divided evenly across the project's duration. Identical
 * every month; recomputed live from current project fields, never cached.
 */
export const computeFlatMonthlyRate = (project, pool) => {
  const pv = project.project_value || project.project_valuation || 0
  const pct = project[`${pool}_pct`] ?? 5
  const months = monthsInRange(project.start_date, project.end_date)
  if (months.length === 0) return 0
  return Math.round(((pv * (pct / 100)) / months.length) * 100) / 100
}

/** Sum of adjustment amounts recorded against one exact (pool, month) pair. */
export const sumPoolAdjustments = (adjustments, pool, month) =>
  Math.round(
    (adjustments || [])
      .filter((a) => a.pool === pool && a.month === month)
      .reduce((s, a) => s + (a.amount || 0), 0) * 100,
  ) / 100

/**
 * Effective monthly figure for one pool/month after manual withdrawals:
 * the flat rate minus every adjustment recorded against that exact
 * (pool, month) pair. Not clamped at 0 — a negative figure legitimately
 * represents a pool in deficit for that project that month; callers that
 * display this should warn, not block, on a negative result.
 */
export const computeEffectivePoolMonthly = (project, pool, month) => {
  const flat = computeFlatMonthlyRate(project, pool)
  const withdrawn = sumPoolAdjustments(project.pool_adjustments, pool, month)
  return Math.round((flat - withdrawn) * 100) / 100
}
```

- [ ] **Step 4: Verify it lints and builds**

Run: `npm run lint -- src/services/monthlyApportionment.js`
Expected: 0 errors (this file's baseline is 0 — hold it strictly).

Run: `npm run build`
Expected: **this will fail** at this point — `MonthlyPlanPanel.jsx` and `ExpenseManagementPage.jsx` both still import `computeMonthSplit`, which no longer exists. This is expected and correct: Task 1 is intentionally not shippable alone. Confirm the build's *only* new error is the two `computeMonthSplit` import failures (no other unrelated breakage) — this is your evidence Task 1's edit itself is otherwise correct, and Tasks 5/6/8 close the gap. Do not attempt to work around this by leaving a fake `computeMonthSplit` export — that would contradict Task 1's purpose.

- [ ] **Step 5: Manual verification via Node**

This module is pure — verify directly:

```bash
node --input-type=module -e "
import { computeWorkingPool, computeFlatMonthlyRate, sumPoolAdjustments, computeEffectivePoolMonthly } from './src/services/monthlyApportionment.js'

const project = { project_value: 1000000, admin_pct: 5, hr_pct: 5, core_pct: 5, start_date: '2026-01-01', end_date: '2026-10-31' }

console.log(computeWorkingPool(project)) // expect 850000 (85% of 1,000,000)
console.log(computeFlatMonthlyRate(project, 'admin')) // expect 5000 (50000/10 months)
console.log(computeFlatMonthlyRate(project, 'hr')) // expect 5000
console.log(computeFlatMonthlyRate(project, 'core')) // expect 5000

const adjustments = [
  { pool: 'hr', month: '2026-03', amount: 1000 },
  { pool: 'hr', month: '2026-03', amount: 500 },
  { pool: 'core', month: '2026-03', amount: 2000 },
]
console.log(sumPoolAdjustments(adjustments, 'hr', '2026-03')) // expect 1500
console.log(sumPoolAdjustments(adjustments, 'hr', '2026-04')) // expect 0 (different month)
console.log(computeEffectivePoolMonthly({ ...project, pool_adjustments: adjustments }, 'hr', '2026-03')) // expect 3500 (5000 - 1500)
console.log(computeEffectivePoolMonthly({ ...project, pool_adjustments: adjustments }, 'hr', '2026-04')) // expect 5000 (no adjustment that month)
"
```

Expected: every value matches the comment exactly. This confirms the diagram's own worked example (₹10,00,000 total → ₹50,000/₹50,000/₹50,000 pools = ₹5,000/month each over 10 months, ₹8,50,000 project baseline).

- [ ] **Step 6: Commit**

```bash
git add src/services/monthlyApportionment.js
git commit -m "feat: replace per-month HR/Core carve-out with flat live pool rates"
```

---

## Task 2: Remove admin-lump-sum machinery, bump `PROJECTS_KEY`

**Files:**
- Modify: `src/services/localProjects.js`

**Interfaces:**
- Removes: the `import { localOrgPool } from './localOrgPool'` line, the admin-crediting blocks inside `create()`/`update()`.
- Changes: `PROJECTS_KEY` from `'hma_projects_v10'` to `'hma_projects_v11'`.

- [ ] **Step 1: Remove the `localOrgPool` import**

Find (line 8):
```js
import { localOrgPool } from './localOrgPool'
```
Delete this line entirely. (Confirm nothing else in this file references `localOrgPool` before deleting — `grep -n "localOrgPool" src/services/localProjects.js` should show only this import line and the two admin-crediting blocks you're about to remove in Steps 2-3.)

- [ ] **Step 2: Remove admin-crediting from `create()`**

Find (currently lines 299-308):
```js
    if (newProject.project_value > 0) {
      newProject.admin_pool_amount = localOrgPool.computeAdminPoolAmount(newProject)
      newProject.admin_pool_credited = true
      newProject.admin_credited_at = now()
      localOrgPool.recordAdminCredit(newProject.id, newProject.admin_pool_amount)
    } else {
      newProject.admin_pool_amount = 0
      newProject.admin_pool_credited = false
      newProject.admin_credited_at = null
    }
    projects.unshift(newProject)
```
Replace with:
```js
    projects.unshift(newProject)
```

- [ ] **Step 3: Remove admin-crediting from `update()`**

Find (currently lines 315-332):
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
    notify()
    return projects[idx]
  },
```
Replace with:
```js
  update(id, data) {
    const projects = read(PROJECTS_KEY)
    const idx = projects.findIndex((p) => p.id === id)
    if (idx === -1) throw new Error('Project not found')
    const updated = { ...projects[idx], ...data, updated_at: now() }

    projects[idx] = updated
    write(PROJECTS_KEY, projects)
    notify()
    return projects[idx]
  },
```

- [ ] **Step 4: Bump `PROJECTS_KEY`**

Find (line 11):
```js
const PROJECTS_KEY = 'hma_projects_v10'   // bumped → forces reseed with CSV data
```
Replace with:
```js
const PROJECTS_KEY = 'hma_projects_v11'   // bumped → forces reseed under the flat-rate/multi-block model
```

- [ ] **Step 5: Verify it lints and builds**

Run: `npm run lint -- src/services/localProjects.js`
Expected: ≤24 errors (this file's baseline).

Run: `npm run build`
Expected: **still fails** — `generateMonthlyPlan`/`updateMonthPct` still reference the old single-template shape and `MonthlyPlanPanel.jsx`/`ExpenseManagementPage.jsx` still import `computeMonthSplit` (Task 1's expected gap, unchanged). Confirm no *new* errors beyond what Task 1 already introduced — this task should be a pure subtraction with no new breakage of its own.

- [ ] **Step 6: Manual verification via Node**

```bash
node --input-type=module -e "
process.env.NODE_ENV = 'test'
globalThis.window = { dispatchEvent() {} }
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
}
const { localProjects } = await import('./src/services/localProjects.js')
const p = localProjects.create({ name: 'Admin Removal Test', project_value: 1000000, start_date: '2026-01-01', end_date: '2026-10-31' })
console.log(p.admin_pool_amount, p.admin_pool_credited, p.admin_credited_at) // expect undefined undefined undefined
console.log(p.admin_pct, p.hr_pct, p.core_pct) // expect 5 5 5 (unrelated pre-existing fields, still set elsewhere in create())
"
```
Expected: the admin-lump-sum fields are simply absent from the created project (never set), while `admin_pct`/`hr_pct`/`core_pct` (used by Task 1's new formulas) are still present and default to 5.

- [ ] **Step 7: Commit**

```bash
git add src/services/localProjects.js
git commit -m "feat: remove locked admin lump-sum crediting, bump PROJECTS_KEY to v11"
```

---

## Task 3: Rewrite `generateMonthlyPlan` for multi-block planning

**Files:**
- Modify: `src/services/localProjects.js`

**Interfaces:**
- Changes: `generateMonthlyPlan(projectId, templatePhases)` → `generateMonthlyPlan(projectId, blocks)`, where `blocks: Array<{ id?, startMonth: 'YYYY-MM', endMonth: 'YYYY-MM', phases: Array<{phase, label, amount}> }>`. Same throw-on-imbalance contract as before, generalized to multiple blocks. Now also writes `project.plan_blocks` (the raw block definitions) alongside `project.monthly_plan`. Consumed by Task 5 (`BlockPlanner`'s Generate handler).
- Consumes: `monthsInRange`, `computeWorkingPool`, `validatePlanTotal` (Task 1, unchanged signatures).

- [ ] **Step 1: Replace the whole `generateMonthlyPlan` method and its docblock**

Find the entire block from the `/** Builds project.monthly_plan...` docblock (currently starting a few lines before line 369) through the closing `},` of `generateMonthlyPlan` (currently ending at line 479) — i.e., everything from:
```js
  /**
   * Builds project.monthly_plan by keeping month 1 exactly as entered via
```
through:
```js
    projects[idx] = { ...project, monthly_plan: monthlyPlan, updated_at: now() }
    write(PROJECTS_KEY, projects)
    return projects[idx]
  },
```
(the closing `},` that ends `generateMonthlyPlan` — the very next line after it is the docblock for `updateMonthPlan`, so stop replacing right before `/**\n   * Replaces one month's phase line items.`).

Replace the whole thing with:
```js
  /**
   * Builds project.monthly_plan from one or more independently-planned
   * "blocks" — each a contiguous month range with its own Design/
   * Implementation/Monitoring phase breakdown, replicated identically
   * across every month in that block's range. Months not covered by any
   * block are filled with an even split of whatever's left of the
   * project's own baseline (computeWorkingPool) as a single generic
   * "Planned budget" line item per month.
   *
   * - If blocks cover every month, the blocked total must equal the
   *   working pool exactly (no remainder exists to spread either way) or
   *   this throws.
   * - Throws if a block falls outside the project's duration, if two
   *   blocks claim the same month, if the blocked total alone already
   *   exceeds the working pool, or if the final plan still fails to
   *   balance after rounding-drift reconciliation (a real algorithm bug,
   *   not normal user error).
   * - Persists both `monthly_plan` (the derived per-month array consumed
   *   by the rest of the app) and `plan_blocks` (the raw block
   *   definitions, so the editor can reload and revise them later).
   */
  generateMonthlyPlan(projectId, blocks) {
    const projects = read(PROJECTS_KEY)
    const idx = projects.findIndex((p) => p.id === projectId)
    if (idx === -1) throw new Error('Project not found')
    const project = projects[idx]

    const months = monthsInRange(project.start_date, project.end_date)
    if (months.length === 0) {
      throw new Error('Project must have a start_date and end_date before generating a plan')
    }
    const monthSet = new Set(months)

    const stampedBlocks = blocks.map((b) => ({
      id: b.id || `blk_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      startMonth: b.startMonth,
      endMonth: b.endMonth,
      phases: b.phases.map((ph) => ({ ...ph, amount: parseFloat(ph.amount) || 0 })),
    }))

    const blockedMonthEntries = []
    const claimedBy = {}

    for (const block of stampedBlocks) {
      const blockMonths = monthsInRange(block.startMonth, block.endMonth)
      if (blockMonths.length === 0) {
        throw new Error(`Block has an invalid month range (${block.startMonth}–${block.endMonth}).`)
      }
      for (const m of blockMonths) {
        if (!monthSet.has(m)) {
          throw new Error(
            `Block ${block.startMonth}–${block.endMonth} falls outside the project's duration ` +
              `(${months[0]}–${months[months.length - 1]}).`,
          )
        }
        if (claimedBy[m]) {
          throw new Error(
            `Month ${m} is covered by more than one block ` +
              `(${claimedBy[m]} and ${block.startMonth}–${block.endMonth}).`,
          )
        }
        claimedBy[m] = `${block.startMonth}–${block.endMonth}`
      }
      const total = Math.round(block.phases.reduce((s, ph) => s + ph.amount, 0) * 100) / 100
      for (const m of blockMonths) {
        blockedMonthEntries.push({ month: m, phases: block.phases.map((ph) => ({ ...ph })), total })
      }
    }

    const workingPool = computeWorkingPool(project)
    const blockedTotal = sumPlanTotal(blockedMonthEntries)
    const remainingMonths = months.filter((m) => !claimedBy[m])

    let monthlyPlan

    if (remainingMonths.length === 0) {
      monthlyPlan = months.map((m) => blockedMonthEntries.find((e) => e.month === m))
      const { valid, planTotal, diff } = validatePlanTotal(monthlyPlan, workingPool)
      if (!valid) {
        throw new Error(
          `Plan total (${planTotal}) does not match the project baseline (${workingPool}) — ` +
            `difference of ${diff}. Adjust the block amounts and try again.`,
        )
      }
      projects[idx] = {
        ...project,
        monthly_plan: monthlyPlan,
        plan_blocks: stampedBlocks,
        updated_at: now(),
      }
      write(PROJECTS_KEY, projects)
      return projects[idx]
    }

    const remainingPool = Math.round((workingPool - blockedTotal) * 100) / 100
    if (remainingPool < 0) {
      throw new Error(
        `Blocked months' total (₹${blockedTotal}) already exceeds the project baseline ` +
          `(₹${workingPool}) — reduce block amounts.`,
      )
    }

    const remainingPerMonth = Math.round((remainingPool / remainingMonths.length) * 100) / 100
    const remainingEntries = remainingMonths.map((month) => ({
      month,
      phases: [{ phase: 'design', label: 'Planned budget', amount: remainingPerMonth }],
      total: remainingPerMonth,
    }))

    monthlyPlan = months.map(
      (m) =>
        blockedMonthEntries.find((e) => e.month === m) ||
        remainingEntries.find((e) => e.month === m),
    )

    const drift = validatePlanTotal(monthlyPlan, workingPool)
    if (!drift.valid) {
      if (Math.abs(drift.diff) >= 1) {
        throw new Error(
          `Plan total (${drift.planTotal}) does not match the project baseline (${workingPool}) — ` +
            `difference of ${drift.diff}. This is larger than normal rounding drift and indicates ` +
            `a bug in the plan-generation algorithm.`,
        )
      }
      const lastRemainingMonth = remainingMonths[remainingMonths.length - 1]
      const lastIdx = monthlyPlan.findIndex((e) => e.month === lastRemainingMonth)
      const lastEntry = monthlyPlan[lastIdx]
      const patchedAmount = Math.round((lastEntry.phases[0].amount - drift.diff) * 100) / 100
      if (patchedAmount < 0) {
        throw new Error(
          'Rounding reconciliation produced a negative amount — this indicates a bug in the ' +
            'plan-generation algorithm.',
        )
      }
      monthlyPlan = [
        ...monthlyPlan.slice(0, lastIdx),
        {
          ...lastEntry,
          phases: [{ ...lastEntry.phases[0], amount: patchedAmount }],
          total: patchedAmount,
        },
        ...monthlyPlan.slice(lastIdx + 1),
      ]
    }

    const final = validatePlanTotal(monthlyPlan, workingPool)
    if (!final.valid) {
      throw new Error(
        `Plan total (${final.planTotal}) does not match the project baseline (${workingPool}) — ` +
          `difference of ${final.diff}. Adjust the block amounts and try again.`,
      )
    }

    projects[idx] = {
      ...project,
      monthly_plan: monthlyPlan,
      plan_blocks: stampedBlocks,
      updated_at: now(),
    }
    write(PROJECTS_KEY, projects)
    return projects[idx]
  },
```

Note: this new code calls `sumPlanTotal`, which the current file does not yet import. Check `grep -n "^import" src/services/localProjects.js` — if `sumPlanTotal` isn't already imported alongside `computeWorkingPool`/`monthsInRange`/`validatePlanTotal` (it should already be there for `validatePlanTotal`'s own use, but confirm), add it to that same import line.

- [ ] **Step 2: Verify it lints and builds**

Run: `npm run lint -- src/services/localProjects.js`
Expected: ≤24 errors.

Run: `npm run build`
Expected: still fails only on the two remaining `computeMonthSplit` imports (Task 1's known gap) and now also on `MonthlyPlanPanel.jsx`'s call to `generateMonthlyPlan(project.id, templatePhases)` with the old single-array-of-phases signature — that call site is fixed in Task 5. Confirm no other new errors.

- [ ] **Step 3: Manual verification via Node**

```bash
node --input-type=module -e "
globalThis.window = { dispatchEvent() {} }
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
}
const { localProjects } = await import('./src/services/localProjects.js')

// working pool = 1,000,000 × 85% = 850,000 over 10 months (Jan-Oct)
const p = localProjects.create({ name: 'Multi-block Test', project_value: 1000000, admin_pct: 5, hr_pct: 5, core_pct: 5, start_date: '2026-01-01', end_date: '2026-10-31' })

// Case 1: zero blocks — pure even split
const zero = localProjects.generateMonthlyPlan(p.id, [])
console.log(zero.monthly_plan.length, zero.monthly_plan[0].total) // expect 10 85000

// Case 2: one block covering Jan-Mar, remainder spread over Apr-Oct (7 months)
const one = localProjects.generateMonthlyPlan(p.id, [
  { startMonth: '2026-01', endMonth: '2026-03', phases: [{ phase: 'design', label: 'Design', amount: 60000 }] },
])
console.log(one.monthly_plan.find(m => m.month === '2026-01').total) // expect 60000
console.log(one.monthly_plan.find(m => m.month === '2026-04').total) // expect (850000 - 180000)/7 = 95714.28...  rounds to 95714.29
console.log(one.plan_blocks.length) // expect 1

// Case 3: multiple non-adjacent blocks with a remainder
const two = localProjects.generateMonthlyPlan(p.id, [
  { startMonth: '2026-01', endMonth: '2026-02', phases: [{ phase: 'design', label: 'D', amount: 40000 }] },
  { startMonth: '2026-06', endMonth: '2026-06', phases: [{ phase: 'implementation', label: 'I', amount: 200000 }] },
])
console.log(two.monthly_plan.length) // expect 10
console.log(two.monthly_plan.find(m => m.month === '2026-06').total) // expect 200000
console.log(two.monthly_plan.filter(m => !['2026-01','2026-02','2026-06'].includes(m.month)).every(m => m.total === Math.round(((850000 - 80000 - 200000) / 7) * 100) / 100)) // expect true

// Case 4: blocks covering every month, matching exactly — should succeed
const flatBlocks = zero.monthly_plan.map(m => ({ startMonth: m.month, endMonth: m.month, phases: m.phases }))
const full = localProjects.generateMonthlyPlan(p.id, flatBlocks)
console.log(full.monthly_plan.length) // expect 10

// Case 5: blocks covering every month, NOT matching — should throw
try {
  const badFull = flatBlocks.map((b, i) => i === 0 ? { ...b, phases: [{ phase: 'design', label: 'x', amount: 1 }] } : b)
  localProjects.generateMonthlyPlan(p.id, badFull)
  console.log('FAIL: expected a throw')
} catch (e) {
  console.log('threw as expected:', e.message.slice(0, 40))
}

// Case 6: overlapping blocks — should throw
try {
  localProjects.generateMonthlyPlan(p.id, [
    { startMonth: '2026-01', endMonth: '2026-03', phases: [{ phase: 'design', label: 'D', amount: 10000 }] },
    { startMonth: '2026-02', endMonth: '2026-04', phases: [{ phase: 'design', label: 'D2', amount: 10000 }] },
  ])
  console.log('FAIL: expected a throw')
} catch (e) {
  console.log('threw as expected:', e.message.slice(0, 40))
}

// Case 7: a block alone exceeding the working pool — should throw
try {
  localProjects.generateMonthlyPlan(p.id, [
    { startMonth: '2026-01', endMonth: '2026-01', phases: [{ phase: 'design', label: 'D', amount: 900000 }] },
  ])
  console.log('FAIL: expected a throw')
} catch (e) {
  console.log('threw as expected:', e.message.slice(0, 40))
}
"
```

Expected: every `console.log` output matches its comment; both `try/catch` blocks print "threw as expected," never "FAIL."

- [ ] **Step 4: Commit**

```bash
git add src/services/localProjects.js
git commit -m "feat: rewrite generateMonthlyPlan for multi-block planning"
```

---

## Task 4: Withdrawal CRUD; delete `updateMonthPct`

**Files:**
- Modify: `src/services/localProjects.js`

**Interfaces:**
- Removes: `updateMonthPct(projectId, month, {hr_pct, core_pct})` — no longer needed, HR/Core/Admin percentages are project-level, not per-month.
- Produces: `addPoolAdjustment(projectId, { pools, month, amount, reason, createdBy })` → returns the updated project. Splits `amount` evenly across every pool in `pools`, one adjustment record per pool. Throws on: no pools selected, non-positive amount, missing month, month outside the project's duration, missing/empty reason. Consumed by Task 6 (Withdraw modal).
- Produces: `removePoolAdjustment(projectId, adjustmentId)` → returns the updated project (hard delete). Consumed by Task 6.

- [ ] **Step 1: Delete `updateMonthPct`**

Find (currently the block right after `generateMonthlyPlan`'s closing `},`, before `// ── Installment Management ──`):
```js
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
Delete it entirely.

- [ ] **Step 2: Add the withdrawal CRUD right after `updateMonthPlan`'s closing `},`**

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

- [ ] **Step 3: Verify it lints and builds**

Run: `npm run lint -- src/services/localProjects.js`
Expected: ≤24 errors.

Run: `npm run build`
Expected: still fails only on the known, not-yet-closed gaps from Tasks 1/3 (the two `computeMonthSplit` imports, `MonthlyPlanPanel.jsx`'s old-signature `generateMonthlyPlan` call, and now also `MonthlyPlanPanel.jsx`'s `updateMonthPct` call, which no longer exists) — all closed by Task 5/6. Confirm no other new errors.

- [ ] **Step 4: Manual verification via Node**

```bash
node --input-type=module -e "
globalThis.window = { dispatchEvent() {} }
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
}
const { localProjects } = await import('./src/services/localProjects.js')

const p = localProjects.create({ name: 'Withdrawal Test', project_value: 1000000, admin_pct: 5, hr_pct: 5, core_pct: 5, start_date: '2026-01-01', end_date: '2026-10-31' })

const withOne = localProjects.addPoolAdjustment(p.id, { pools: ['hr'], month: '2026-03', amount: 2000, reason: 'Milestone shortfall', createdBy: 'Test User' })
console.log(withOne.pool_adjustments.length, withOne.pool_adjustments[0].amount) // expect 1 2000

const withTwo = localProjects.addPoolAdjustment(withOne.id, { pools: ['hr', 'core'], month: '2026-04', amount: 2000, reason: 'Split test', createdBy: 'Test User' })
console.log(withTwo.pool_adjustments.length) // expect 3 (1 + 2 new)
console.log(withTwo.pool_adjustments.filter(a => a.month === '2026-04').map(a => a.amount)) // expect [1000, 1000]

try {
  localProjects.addPoolAdjustment(p.id, { pools: ['hr'], month: '2027-01', amount: 100, reason: 'x', createdBy: 'Test' })
  console.log('FAIL: expected a throw for out-of-range month')
} catch (e) {
  console.log('threw as expected:', e.message.slice(0, 40))
}

try {
  localProjects.addPoolAdjustment(p.id, { pools: ['hr'], month: '2026-03', amount: 100, reason: '', createdBy: 'Test' })
  console.log('FAIL: expected a throw for missing reason')
} catch (e) {
  console.log('threw as expected:', e.message.slice(0, 40))
}

const idToRemove = withTwo.pool_adjustments[0].id
const afterRemove = localProjects.removePoolAdjustment(withTwo.id, idToRemove)
console.log(afterRemove.pool_adjustments.length) // expect 2
console.log(typeof localProjects.updateMonthPct) // expect undefined
"
```

Expected: every value matches its comment; both `try/catch` blocks print "threw as expected"; `updateMonthPct` confirmed gone.

- [ ] **Step 5: Commit**

```bash
git add src/services/localProjects.js
git commit -m "feat: add manual pool withdrawal CRUD, remove per-month updateMonthPct"
```

---

## Task 5: `MonthlyPlanPanel.jsx` — `BlockPlanner` replaces `TemplateEditor`

**Files:**
- Modify: `src/modules/pms/project-associate/MonthlyPlanPanel.jsx`

**Interfaces:**
- Consumes: `localProjects.generateMonthlyPlan(projectId, blocks)` (Task 3, new signature), `monthsInRange`, `computeWorkingPool` (Task 1).
- Removes: `TemplateEditor`, its `computeMonthSplit` import.
- Produces: `BlockPlanner` component with the same role in `MonthlyPlanPanel`'s render logic that `TemplateEditor` used to have, but **per decision #4 (approved plan)**: stays reachable even after `project.monthly_plan` exists (collapsible), instead of disappearing.

- [ ] **Step 1: Update imports**

Find:
```js
import { localProjects } from '../../../services/localProjects'
import {
  computeWorkingPool,
  monthsInRange,
  computeMonthSplit,
  validatePlanTotal,
} from '../../../services/monthlyApportionment'
```
Replace with:
```js
import { localProjects } from '../../../services/localProjects'
import {
  computeWorkingPool,
  monthsInRange,
  computeFlatMonthlyRate,
  computeEffectivePoolMonthly,
  validatePlanTotal,
} from '../../../services/monthlyApportionment'
```

Also add `CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter, CFormCheck, CFormTextarea` to the existing `@coreui/react` import block (needed for Task 6's withdrawal modal — adding now keeps the import edit in one place).

- [ ] **Step 2: Delete `TemplateEditor` entirely**

Delete the whole `TemplateEditor` component and its `TemplateEditor.propTypes` block (from `const TemplateEditor = ({ project, onProjectChange, canEdit = false }) => {` through the `TemplateEditor.propTypes = {...}` block that follows it).

- [ ] **Step 3: Add `BlockPlanner` in its place**

```jsx
const emptyBlock = (months) => ({
  id: null,
  startMonth: months[0] || '',
  endMonth: months[0] || '',
  lines: [emptyLine()],
})

const BlockPlanner = ({ project, onProjectChange, canEdit = false, defaultCollapsed = false }) => {
  const months = monthsInRange(project.start_date, project.end_date)
  const workingPool = computeWorkingPool(project)
  const monthCount = months.length
  const baselinePerMonth = monthCount > 0 ? Math.round((workingPool / monthCount) * 100) / 100 : 0

  const seedBlocks = () =>
    project.plan_blocks?.length
      ? project.plan_blocks.map((b) => ({
          id: b.id,
          startMonth: b.startMonth,
          endMonth: b.endMonth,
          lines: b.phases.map((ph) => ({ phase: ph.phase, label: ph.label, amount: String(ph.amount) })),
        }))
      : [emptyBlock(months)]

  const [blocks, setBlocks] = useState(seedBlocks)
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [error, setError] = useState('')

  const updateBlock = (i, patch) => {
    setBlocks((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)))
  }
  const updateBlockLine = (i, lineIdx, patch) => {
    setBlocks((prev) =>
      prev.map((b, idx) =>
        idx === i
          ? { ...b, lines: b.lines.map((l, li) => (li === lineIdx ? { ...l, ...patch } : l)) }
          : b,
      ),
    )
  }
  const addBlock = () => setBlocks((prev) => [...prev, emptyBlock(months)])
  const removeBlock = (i) => setBlocks((prev) => prev.filter((_, idx) => idx !== i))
  const addBlockLine = (i) =>
    setBlocks((prev) => prev.map((b, idx) => (idx === i ? { ...b, lines: [...b.lines, emptyLine()] } : b)))
  const removeBlockLine = (i, lineIdx) =>
    setBlocks((prev) =>
      prev.map((b, idx) =>
        idx === i ? { ...b, lines: b.lines.filter((_, li) => li !== lineIdx) } : b,
      ),
    )

  const blockedTotal = blocks.reduce(
    (s, b) => s + b.lines.reduce((s2, l) => s2 + (parseFloat(l.amount) || 0), 0),
    0,
  )

  const handleGenerate = () => {
    setError('')
    try {
      const payload = blocks.map((b) => ({
        id: b.id,
        startMonth: b.startMonth,
        endMonth: b.endMonth,
        phases: b.lines
          .filter((l) => l.label.trim() && parseFloat(l.amount) > 0)
          .map((l) => ({ phase: l.phase, label: l.label.trim(), amount: parseFloat(l.amount) })),
      }))
      const nonEmpty = payload.filter((b) => b.phases.length > 0)
      if (project.monthly_plan?.length) {
        // eslint-disable-next-line no-alert
        const ok = window.confirm(
          'Regenerating will overwrite all manual month edits made in the table below — continue?',
        )
        if (!ok) return
      }
      const updated = localProjects.generateMonthlyPlan(project.id, nonEmpty)
      onProjectChange(updated)
      setCollapsed(true)
    } catch (e) {
      setError(e.message)
    }
  }

  if (!canEdit) {
    return (
      <CCard className="shadow-sm mb-4">
        <CCardHeader className="bg-transparent fw-semibold pt-3">📅 Plan the Budget</CCardHeader>
        <CCardBody>
          <CAlert color="info" className="mb-0 small">
            You don&apos;t have permission to plan this project&apos;s budget.
          </CAlert>
        </CCardBody>
      </CCard>
    )
  }

  return (
    <CCard className="shadow-sm mb-4">
      <CCardHeader
        className="bg-transparent fw-semibold pt-3 d-flex justify-content-between align-items-center"
        role="button"
        onClick={() => project.monthly_plan?.length && setCollapsed((c) => !c)}
      >
        <span>📅 Manage Planning Blocks</span>
        {project.monthly_plan?.length > 0 && (
          <CBadge color="secondary">{collapsed ? 'Show' : 'Hide'}</CBadge>
        )}
      </CCardHeader>
      {!collapsed && (
        <CCardBody>
          <div className="text-body-secondary small mb-3">
            Project baseline: <strong>{fmt(workingPool)}</strong> across{' '}
            <strong>{monthCount}</strong> month{monthCount !== 1 ? 's' : ''} — suggestion:{' '}
            <strong>{fmt(baselinePerMonth)}</strong>/month if split evenly. Add one or more
            planning blocks, each covering a range of months with its own phase breakdown — any
            months you don&apos;t cover are filled evenly with what&apos;s left.
          </div>

          {monthCount > 0 && <BaselineTable months={months} baselinePerMonth={baselinePerMonth} />}

          {blocks.map((block, bi) => (
            <CCard key={bi} className="mb-3 border">
              <CCardBody>
                <CRow className="g-2 mb-2 align-items-center">
                  <CCol xs={12} md={5}>
                    <CFormSelect
                      size="sm"
                      value={block.startMonth}
                      onChange={(e) => updateBlock(bi, { startMonth: e.target.value })}
                    >
                      {months.map((m) => (
                        <option key={m} value={m}>
                          {monthLabelShort(m)}
                        </option>
                      ))}
                    </CFormSelect>
                  </CCol>
                  <CCol xs={12} md={5}>
                    <CFormSelect
                      size="sm"
                      value={block.endMonth}
                      onChange={(e) => updateBlock(bi, { endMonth: e.target.value })}
                    >
                      {months.map((m) => (
                        <option key={m} value={m}>
                          {monthLabelShort(m)}
                        </option>
                      ))}
                    </CFormSelect>
                  </CCol>
                  <CCol xs={12} md={2}>
                    <CButton
                      size="sm"
                      color="danger"
                      variant="ghost"
                      disabled={blocks.length === 1}
                      onClick={() => removeBlock(bi)}
                    >
                      <CIcon icon={cilTrash} className="me-1" />
                      Block
                    </CButton>
                  </CCol>
                </CRow>

                {block.lines.map((line, li) => (
                  <CRow key={li} className="g-2 mb-2 align-items-center">
                    <CCol xs={12} md={3}>
                      <CFormSelect
                        size="sm"
                        value={line.phase}
                        onChange={(e) => updateBlockLine(bi, li, { phase: e.target.value })}
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
                        onChange={(e) => updateBlockLine(bi, li, { label: e.target.value })}
                      />
                    </CCol>
                    <CCol xs={8} md={3}>
                      <CInputGroup size="sm">
                        <CInputGroupText>₹</CInputGroupText>
                        <CFormInput
                          type="number"
                          min="0"
                          value={line.amount}
                          onChange={(e) => updateBlockLine(bi, li, { amount: e.target.value })}
                        />
                      </CInputGroup>
                    </CCol>
                    <CCol xs={4} md={1}>
                      <CButton
                        size="sm"
                        color="danger"
                        variant="ghost"
                        disabled={block.lines.length === 1}
                        onClick={() => removeBlockLine(bi, li)}
                      >
                        <CIcon icon={cilTrash} />
                      </CButton>
                    </CCol>
                  </CRow>
                ))}

                <CButton size="sm" color="secondary" variant="outline" onClick={() => addBlockLine(bi)}>
                  <CIcon icon={cilPlus} className="me-1" />
                  Add Line
                </CButton>
              </CCardBody>
            </CCard>
          ))}

          <CButton size="sm" color="secondary" variant="outline" className="mb-3" onClick={addBlock}>
            <CIcon icon={cilPlus} className="me-1" />
            Add Block
          </CButton>

          <div className="d-flex align-items-center gap-2 mb-3">
            <span className="small text-body-secondary">Blocked total:</span>
            <CBadge color={blockedTotal > 0 ? 'primary' : 'secondary'}>{fmt(blockedTotal)}</CBadge>
            <span className="small text-body-secondary">
              of {fmt(workingPool)} project baseline
            </span>
          </div>

          {error && (
            <CAlert color="danger" className="py-2 small">
              {error}
            </CAlert>
          )}

          <CButton color="success" onClick={handleGenerate}>
            Generate Plan
          </CButton>
        </CCardBody>
      )}
    </CCard>
  )
}

BlockPlanner.propTypes = {
  project: PropTypes.object.isRequired,
  onProjectChange: PropTypes.func.isRequired,
  canEdit: PropTypes.bool,
  defaultCollapsed: PropTypes.bool,
}
```

- [ ] **Step 4: Update `MonthlyPlanPanel` to always render `BlockPlanner` (plus `PlanTable` when a plan exists)**

Find (currently near the end of the file):
```js
const MonthlyPlanPanel = ({ project, onProjectChange, canEdit = false }) => {
  if (!project.monthly_plan || project.monthly_plan.length === 0) {
    return <TemplateEditor project={project} onProjectChange={onProjectChange} canEdit={canEdit} />
  }
  return <PlanTable project={project} onProjectChange={onProjectChange} canEdit={canEdit} />
}
```
Replace with (leave `PlanTable`'s own props as-is for now — Task 6 adds `canWithdraw` to it):
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
      <BlockPlanner
        project={project}
        onProjectChange={onProjectChange}
        canEdit={canEdit}
        defaultCollapsed={hasPlan}
      />
      {hasPlan && (
        <PlanTable
          project={project}
          onProjectChange={onProjectChange}
          canEdit={canEdit}
          canWithdraw={canWithdraw}
          currentUser={currentUser}
        />
      )}
    </>
  )
}
```

Update `MonthlyPlanPanel.propTypes` (currently at the bottom of the file) to add `canWithdraw: PropTypes.bool,` and `currentUser: PropTypes.string,`.

- [ ] **Step 5: Verify it lints and builds**

Run: `npm run lint -- src/modules/pms/project-associate/MonthlyPlanPanel.jsx`
Expected: **this will still show errors** — `PlanTable` still references the deleted `computeMonthSplit` and the deleted `updateMonthPct`, and doesn't yet accept `canWithdraw`. That's Task 6's job. Confirm the errors are confined to `PlanTable`/`PctStepper` (the parts of this file Task 5 didn't touch) and that `BlockPlanner` itself has no lint errors.

Run: `npm run build`
Expected: still fails on `PlanTable`'s stale references — same known gap, closed in Task 6.

- [ ] **Step 6: Commit**

```bash
git add src/modules/pms/project-associate/MonthlyPlanPanel.jsx
git commit -m "feat: add multi-block BlockPlanner, replacing single-template TemplateEditor"
```

---

## Task 6: `PlanTable` — flat pool columns + Withdraw modal

**Files:**
- Modify: `src/modules/pms/project-associate/MonthlyPlanPanel.jsx`

**Interfaces:**
- Consumes: `computeFlatMonthlyRate`, `computeEffectivePoolMonthly` (Task 1), `localProjects.addPoolAdjustment`/`removePoolAdjustment` (Task 4).
- Changes: `PlanTable` drops HR%/Core% columns and `PctStepper`s, adds Admin/HR/Core effective-monthly columns and a Withdraw action, gated by a new `canWithdraw` prop (separate from `canEdit` — **budget-admin roles only**, per decision #2). Also accepts a `currentUser` prop (threaded through to `WithdrawModal`, populated for real in Task 7).

This task closes every remaining gap inside `MonthlyPlanPanel.jsx` itself (Tasks 1/3/4/5's known deferred errors). The build will still fail after this task, but only on `ExpenseManagementPage.jsx`'s stale `computeMonthSplit` import — that's Task 8's job, the last task that makes `npm run build` exit clean overall.

- [ ] **Step 1: Delete `PctStepper` entirely**

Delete the whole `PctStepper` component and its `PctStepper.propTypes` block.

- [ ] **Step 2: Replace `PlanTable`**

Replace the entire `PlanTable` component (from `const PlanTable = ({ project, onProjectChange, canEdit = false }) => {` through its closing `}` and `PlanTable.propTypes` block) with:

```jsx
const POOL_LABELS = { admin: 'Admin', hr: 'HR', core: 'Core' }

const WithdrawModal = ({ visible, onClose, project, month, onProjectChange, currentUser }) => {
  const [pools, setPools] = useState([])
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const togglePool = (pool) =>
    setPools((prev) => (prev.includes(pool) ? prev.filter((p) => p !== pool) : [...prev, pool]))

  const existing = (project.pool_adjustments || []).filter((a) => a.month === month)

  const handleSubmit = () => {
    setError('')
    try {
      const updated = localProjects.addPoolAdjustment(project.id, {
        pools,
        month,
        amount: parseFloat(amount),
        reason,
        createdBy: currentUser,
      })
      onProjectChange(updated)
      setPools([])
      setAmount('')
      setReason('')
    } catch (e) {
      setError(e.message)
    }
  }

  const handleRemove = (adjustmentId) => {
    const updated = localProjects.removePoolAdjustment(project.id, adjustmentId)
    onProjectChange(updated)
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment="center">
      <CModalHeader>
        <CModalTitle>Withdraw for {monthLabel(month)}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <p className="small text-body-secondary">
          Split evenly across every pool selected below.
        </p>
        <div className="d-flex gap-3 mb-3">
          {['admin', 'hr', 'core'].map((pool) => (
            <CFormCheck
              key={pool}
              label={POOL_LABELS[pool]}
              checked={pools.includes(pool)}
              onChange={() => togglePool(pool)}
            />
          ))}
        </div>
        <CInputGroup size="sm" className="mb-2">
          <CInputGroupText>₹</CInputGroupText>
          <CFormInput
            type="number"
            min="0"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </CInputGroup>
        <CFormTextarea
          size="sm"
          placeholder="Reason (required)"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {error && (
          <CAlert color="danger" className="py-2 small mt-2">
            {error}
          </CAlert>
        )}
        {existing.length > 0 && (
          <div className="mt-3">
            <div className="small fw-semibold mb-1">Existing withdrawals this month</div>
            {existing.map((a) => (
              <div key={a.id} className="d-flex justify-content-between align-items-center small mb-1">
                <span>
                  {POOL_LABELS[a.pool]} — {fmt(a.amount)} — {a.reason}
                </span>
                <CButton size="sm" color="danger" variant="ghost" onClick={() => handleRemove(a.id)}>
                  <CIcon icon={cilTrash} size="sm" />
                </CButton>
              </div>
            ))}
          </div>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="ghost" onClick={onClose}>
          Close
        </CButton>
        <CButton color="warning" onClick={handleSubmit}>
          Withdraw
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

WithdrawModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  project: PropTypes.object.isRequired,
  month: PropTypes.string,
  onProjectChange: PropTypes.func.isRequired,
  currentUser: PropTypes.string,
}

const PlanTable = ({ project, onProjectChange, canEdit = false, canWithdraw = false, currentUser = 'Unknown' }) => {
  const workingPool = computeWorkingPool(project)
  const validation = validatePlanTotal(project.monthly_plan, workingPool)
  const [withdrawMonth, setWithdrawMonth] = useState(null)

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
            : `Off by ${fmt(Math.abs(validation.diff))} (plan ${fmt(validation.planTotal)} vs baseline ${fmt(validation.workingPool)})`}
        </CBadge>
      </CCardHeader>
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
                {canWithdraw && <CTableHeaderCell className="text-center">Withdraw</CTableHeaderCell>}
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {project.monthly_plan.map((m) => {
                const adjustedFor = (pool) =>
                  (project.pool_adjustments || []).some((a) => a.pool === pool && a.month === m.month)
                return (
                  <CTableRow key={m.month}>
                    <CTableDataCell className="fw-semibold">{monthLabel(m.month)}</CTableDataCell>
                    <CTableDataCell>
                      {m.phases.map((ph, i) => (
                        <div key={i} className="d-flex align-items-center gap-2 mb-1">
                          <CBadge
                            color="secondary"
                            shape="rounded-pill"
                            style={{ fontSize: '0.65rem' }}
                          >
                            {ph.phase}
                          </CBadge>
                          <span className="text-body-secondary">{ph.label}</span>
                          <CInputGroup size="sm" style={{ maxWidth: 130 }}>
                            <CInputGroupText>₹</CInputGroupText>
                            <CFormInput
                              type="number"
                              min="0"
                              value={ph.amount}
                              disabled={!canEdit}
                              onChange={(e) => handleAmountChange(m.month, i, e.target.value)}
                            />
                          </CInputGroup>
                        </div>
                      ))}
                    </CTableDataCell>
                    <CTableDataCell className="text-end fw-bold">{fmt(m.total)}</CTableDataCell>
                    {['admin', 'hr', 'core'].map((pool) => (
                      <CTableDataCell key={pool} className="text-end">
                        {fmt(computeEffectivePoolMonthly(project, pool, m.month))}
                        {adjustedFor(pool) && (
                          <CBadge color="warning" shape="rounded-pill" className="ms-1" style={{ fontSize: '0.6rem' }}>
                            adjusted
                          </CBadge>
                        )}
                      </CTableDataCell>
                    ))}
                    {canWithdraw && (
                      <CTableDataCell className="text-center">
                        <CButton size="sm" color="warning" variant="ghost" onClick={() => setWithdrawMonth(m.month)}>
                          Withdraw
                        </CButton>
                      </CTableDataCell>
                    )}
                  </CTableRow>
                )
              })}
            </CTableBody>
          </CTable>
        </div>
      </CCardBody>
      {canWithdraw && (
        <WithdrawModal
          visible={Boolean(withdrawMonth)}
          onClose={() => setWithdrawMonth(null)}
          project={project}
          month={withdrawMonth}
          onProjectChange={onProjectChange}
          currentUser={currentUser}
        />
      )}
    </CCard>
  )
}

PlanTable.propTypes = {
  project: PropTypes.object.isRequired,
  onProjectChange: PropTypes.func.isRequired,
  canEdit: PropTypes.bool,
  canWithdraw: PropTypes.bool,
  currentUser: PropTypes.string,
}
```

`currentUser` is threaded as a plain prop (`MonthlyPlanPanel` → `PlanTable` → `WithdrawModal`, defaulting to `'Unknown'` at every level), the same way `canEdit`/`canWithdraw` already are. Task 7 supplies the real value from `ProjectDetailPage.jsx`.

- [ ] **Step 3: Verify it lints and builds**

Run: `npm run lint -- src/modules/pms/project-associate/MonthlyPlanPanel.jsx`
Expected: 0 errors (this file's baseline is 0 — hold strictly).

Run: `npm run build`
Expected: **still fails** on `ExpenseManagementPage.jsx`'s `computeMonthSplit` import (Task 1's remaining known gap, closed in Task 8) — confirm that is the *only* remaining failure now.

- [ ] **Step 4: Manual verification**

No browser available. Do a careful manual read-through confirming: `PlanTable` no longer imports or calls `computeMonthSplit`/`updateMonthPct`/`PctStepper`; `canWithdraw` defaults to `false` (fails closed, matching the existing `canEdit` convention); the Withdraw button and column only render when `canWithdraw` is true; `WithdrawModal`'s pool checkboxes, amount, and reason fields map correctly onto `addPoolAdjustment`'s `{ pools, month, amount, reason, createdBy }` signature from Task 4.

- [ ] **Step 5: Commit**

```bash
git add src/modules/pms/project-associate/MonthlyPlanPanel.jsx
git commit -m "feat: PlanTable shows flat Admin/HR/Core figures, adds Withdraw modal"
```

---

## Task 7: `ProjectDetailPage.jsx` — wire `canWithdraw` and `currentUser`

**Files:**
- Modify: `src/modules/pms/project-associate/ProjectDetailPage.jsx`

**Interfaces:**
- Consumes: `isBudgetAdmin` (already exists in this file, unchanged). `useAuth()` is **not** currently imported in this file (confirmed via `grep -n "useAuth" src/modules/pms/project-associate/ProjectDetailPage.jsx` — only `useRole` is imported today) — this task adds it fresh.

- [ ] **Step 1: Import and call `useAuth`**

Find the existing `useRole` import (line 74):
```js
import useRole from '../../../hooks/useRole'
```
Add right after it:
```js
import useAuth from '../../../hooks/useAuth'
```

Find where `const role = useRole()` is declared (near the top of the component body, close to where `isBudgetAdmin` is computed). Add right after it:
```js
  const { user } = useAuth()
```

- [ ] **Step 2: Add `canWithdraw` and `currentUser` to the `<MonthlyPlanPanel>` call**

Find (currently lines 2230-2237):
```js
            {/* Monthly Plan Tab */}
            <CTabPane visible={activeTab === 6}>
              <MonthlyPlanPanel
                project={project}
                onProjectChange={setProject}
                canEdit={canEditMonthlyPlan}
              />
            </CTabPane>
```
Replace with:
```js
            {/* Monthly Plan Tab */}
            <CTabPane visible={activeTab === 6}>
              <MonthlyPlanPanel
                project={project}
                onProjectChange={setProject}
                canEdit={canEditMonthlyPlan}
                canWithdraw={isBudgetAdmin}
                currentUser={user?.full_name || user?.employee_id || 'Unknown'}
              />
            </CTabPane>
```

Do not modify `isBudgetAdmin`'s own declaration or its other use site (the "Project Overheads" card, ~line 2011) — this task only adds the new `useAuth` import/call and two new props at one call site.

- [ ] **Step 3: Verify it lints and builds**

Run: `npm run lint -- src/modules/pms/project-associate/ProjectDetailPage.jsx`
Expected: ≤56 errors (this file's baseline).

Run: `npm run build`
Expected: still fails only on `ExpenseManagementPage.jsx`'s `computeMonthSplit` import — the last known gap, closed in Task 8.

- [ ] **Step 4: Manual verification**

Confirm `isBudgetAdmin`'s declaration (search for `const isBudgetAdmin =`) is byte-for-byte unchanged from before this task, and its other use site (~line 2011, the "Project Overheads" card) is untouched — this task should show as a pure addition in the diff, nothing modified. Confirm `useAuth` wasn't already imported under a different alias elsewhere in this file before adding it (should be a clean, non-duplicate new import).

- [ ] **Step 5: Commit**

```bash
git add src/modules/pms/project-associate/ProjectDetailPage.jsx
git commit -m "feat: gate pool withdrawals to budget-admin roles, wire currentUser"
```

---

## Task 8: `ExpenseManagementPage.jsx` — update `currentMonthSplitFor`

**Files:**
- Modify: `src/modules/ems/expense-management/ExpenseManagementPage.jsx`

**Interfaces:**
- Consumes: `computeEffectivePoolMonthly` (Task 1).

This task closes the last build gap — after this task, `npm run build` must pass clean with zero errors.

- [ ] **Step 1: Update the import**

Find (line 42):
```js
import { computeMonthSplit } from '../../../services/monthlyApportionment'
```
Replace with:
```js
import { computeEffectivePoolMonthly } from '../../../services/monthlyApportionment'
```

- [ ] **Step 2: Rewrite `currentMonthSplitFor`**

Find (currently lines 470-478):
```js
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
Replace with:
```js
/** Resolves a project's Admin/HR/Core/Project figures for the current
 * month from its monthly_plan, if one exists. Returns null for projects
 * still on the old (pre-monthly-plan) model. */
const currentMonthSplitFor = (project) => {
  if (!project?.monthly_plan?.length) return null
  const month = currentMonth()
  const entry = project.monthly_plan.find((m) => m.month === month)
  if (!entry) return null
  return {
    projectAmount: entry.total,
    hrAmount: computeEffectivePoolMonthly(project, 'hr', month),
    coreAmount: computeEffectivePoolMonthly(project, 'core', month),
    adminAmount: computeEffectivePoolMonthly(project, 'admin', month),
    monthTotal: entry.total,
  }
}
```

- [ ] **Step 3: Add Admin to the render block (optional but recommended — Admin is now a live monthly figure, previously it never appeared here)**

Find the render block that displays `newMonthSplit` (search for `newMonthSplit` in the JSX, roughly the block added by the earlier "surface newMonthSplit" commit — it currently shows Project/HR/Core using `fmtL`). Add a fourth segment for `p.newMonthSplit.adminAmount` using the same `fmtL` formatter and styling convention already used for the other three figures in that same line/block. Match the existing pattern exactly (same `text-body-secondary`/small-font styling already established there) — do not introduce a new visual style for this one addition.

- [ ] **Step 4: Verify it lints and builds**

Run: `npm run lint -- src/modules/ems/expense-management/ExpenseManagementPage.jsx`
Expected: ≤38 errors (this file's baseline).

Run: `npm run build`
Expected: **exits 0, clean.** This closes every gap opened since Task 1 — confirm this explicitly, since every prior task in this plan expected specific, named build failures; this is the first task where the build must be fully green again.

- [ ] **Step 5: Manual verification**

No browser available. Confirm via code read-through: `currentMonthSplitFor`'s returned object shape (`projectAmount`, `hrAmount`, `coreAmount`, `adminAmount`, `monthTotal`) matches what the render block consumes; the existing `sharePct`-based rendering (the older, untouched ledger path) is unaffected — this diff should be confined to the `currentMonthSplitFor` function body, its import, and the small additive JSX change for `adminAmount`.

- [ ] **Step 6: Commit**

```bash
git add src/modules/ems/expense-management/ExpenseManagementPage.jsx
git commit -m "feat: surface flat Admin/HR/Core figures on the EMS Consolidated Sheet"
```
