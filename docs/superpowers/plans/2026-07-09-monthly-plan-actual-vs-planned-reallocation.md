# Monthly Plan Actual-vs-Planned Reallocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a PO enter what a Monthly Plan phase line actually cost, right next to what was planned, and have the month's actual-vs-planned outcome move money automatically (overspend pulls from next month) or via PO-triggered buttons (underspend sends to HR/Core or next month). Also fixes a real bug where typing in the HR/Core boxes doesn't land on the typed value.

**Architecture:** Extends the existing `pool_adjustments` reallocation system (already used for Admin/HR/Core ↔ Project transfers within a month) to also cover Project ↔ Project transfers across months, using the same record shape plus a `counterMonth` field. All money-movement math stays in the existing pure-function module (`monthlyApportionment.js`); `localProjects.js` owns persistence and orchestration; `MonthlyPlanPanel.jsx` owns presentation only — no math in the component layer.

**Tech Stack:** React 18 (function components + hooks), CoreUI React components, plain `localStorage`-backed service modules (no backend, no DB). No test framework exists in this project (`package.json` has no `vitest`/`jest`, no test files anywhere) — do **not** add one; that's an unrequested new-dependency decision outside this plan's scope. Verification instead follows this project's established convention: pure functions get a throwaway Node sanity-check script (deleted after use, never committed), and the full feature gets verified end-to-end in a real browser via Playwright, plus `npm run build` / `npm run lint`.

## Global Constraints

- Scope is the **Project** pool only. Admin/HR/Core's own actual spend stays HR's job via EMS, unchanged (per spec `## Context`).
- Reallocation triggers off **month totals**, not individual phase lines (per spec `## Context`).
- Values recompute **live** on every edit, no "finalize month" step; blank Actual = 0 (per spec `## Context`).
- Case 1 (overspend) is fully automatic, pulls only from the **next** month, never further; an uncovered remainder is flagged, not forced (per spec `## Algorithm`).
- Case 2 (underspend) is **manual** — two buttons, "Send to HR/Core" (50/50 split) and "Send to next month" (per spec `## Context`, `## UI`).
- Case 1/2 only touch **planned** figures via `pool_adjustments` — the existing Admin/HR/Core Send/Revoke button on the Expense tab (unlocking EMS) is untouched and still a separate manual step (per spec `## Context`).
- `sumManualPoolAdjustments`/`computeEffectiveProjectMonthly` changes must be a no-op for any project with no `pool: 'project'` adjustment records (per spec `## Data model`, item 3) — this is the regression-safety property to preserve for the existing Admin/HR/Core cascade system.
- Reference spec: `docs/superpowers/specs/2026-07-09-monthly-plan-actual-vs-planned-reallocation-design.md`. Read it in full before starting — this plan implements it section by section but does not repeat all of its reasoning.

---

## File Structure

| File | Responsibility |
|---|---|
| `hma-template/emsv1/src/services/monthlyApportionment.js` | Pure math only. Modify `sumManualPoolAdjustments`, `computeEffectiveProjectMonthly`. Add `computeMonthActualTotal`, `computeActualVsPlannedTransfers`. |
| `hma-template/emsv1/src/services/localProjects.js` | Persistence + orchestration. Fix `setManualPoolAdjustment`'s delta bug. Extend `updateMonthPlan` to recompute `actual_pull` records. Add `sendSurplusToPools`, `sendSurplusToNextMonth`, `revokeActualSurplusTransfer`. |
| `hma-template/emsv1/src/modules/pms/project-associate/MonthlyPlanPanel.jsx` | UI only. `PlanTable`: add Actual input per phase line, transfer badge, Case 2 buttons, refresh button. `ExpensePanel`: remove `ActualExpenseCard`. `ActualSpendPanel`: switch Project column to phase-actual sums. |

No new files. No new dependencies.

---

### Task 1: `monthlyApportionment.js` — pure math changes

**Files:**
- Modify: `hma-template/emsv1/src/services/monthlyApportionment.js`

**Interfaces:**
- Consumes: nothing new (this file has zero imports today — stays that way).
- Produces:
  - `computeMonthActualTotal(monthEntry: { phases: Array<{actual?: number|string}> }) => number`
  - `computeActualVsPlannedTransfers(project: { monthly_plan, pool_adjustments, start_date, end_date }) => Array<{pool: 'project', month: string, amount: number, source: 'actual_pull', counterMonth: string, reason: string}>`
  - `sumManualPoolAdjustments(adjustments, month) => number` — same signature, narrowed filter (now excludes `pool === 'project'`).
  - `computeEffectiveProjectMonthly(project, month) => number` — same signature, new subtraction term.
  - Both consumed by Task 2 (`localProjects.js`) and Task 3 (`MonthlyPlanPanel.jsx`).

- [ ] **Step 1: Write a throwaway algorithm sanity-check script**

This project has no test framework and `monthlyApportionment.js` uses `export const` (ESM) while `package.json` has no `"type": "module"`, so plain Node can't `require()` or `import` it directly without either adding a new dependency or changing the app's module config — both out of scope. Instead, sanity-check the *algorithm* in isolation first with a throwaway script containing copies of the function bodies (deleted after use — this is a pre-implementation logic check, not a substitute for the real end-to-end browser verification in Task 4).

Create `/tmp/verify-transfers.mjs`:

```js
// Throwaway algorithm check — copies of the functions being added to
// monthlyApportionment.js. Delete this file after Task 1 Step 3 passes.

const sumPoolAdjustments = (adjustments, pool, month) =>
  Math.round(
    (adjustments || [])
      .filter((a) => a.pool === pool && a.month === month)
      .reduce((s, a) => s + (a.amount || 0), 0) * 100,
  ) / 100

const sumManualPoolAdjustments = (adjustments, month) =>
  Math.round(
    (adjustments || [])
      .filter((a) => a.source === 'manual' && a.month === month && a.pool !== 'project')
      .reduce((s, a) => s + (a.amount || 0), 0) * 100,
  ) / 100

const computeMonthActualTotal = (monthEntry) =>
  Math.round(
    (monthEntry?.phases || []).reduce((s, ph) => s + (parseFloat(ph.actual) || 0), 0) * 100,
  ) / 100

const computeActualVsPlannedTransfers = (project) => {
  const plan = project.monthly_plan || []
  const adjustments = project.pool_adjustments || []
  const transfers = []
  const appliedDelta = {}
  const effectivePlanned = (month, rawTotal) => {
    const manualDelta = sumManualPoolAdjustments(adjustments, month)
    const existingProjectTransfer = sumPoolAdjustments(adjustments, 'project', month)
    return rawTotal + manualDelta - existingProjectTransfer - (appliedDelta[month] || 0)
  }

  plan.forEach((m, idx) => {
    const rawTotal = m.total || 0
    const planned = effectivePlanned(m.month, rawTotal)
    const actual = computeMonthActualTotal(m)
    const excess = Math.round((actual - planned) * 100) / 100
    if (excess <= 0) return

    const nextMonth = plan[idx + 1]
    if (!nextMonth) return

    const nextRawTotal = nextMonth.total || 0
    const nextAvailable = effectivePlanned(nextMonth.month, nextRawTotal)
    const pull = Math.min(excess, Math.max(nextAvailable, 0))
    if (pull <= 0) return

    transfers.push({
      pool: 'project',
      month: nextMonth.month,
      amount: pull,
      source: 'actual_pull',
      counterMonth: m.month,
      reason: `Auto-pulled to cover ${m.month} overage`,
    })
    transfers.push({
      pool: 'project',
      month: m.month,
      amount: -pull,
      source: 'actual_pull',
      counterMonth: nextMonth.month,
      reason: `Auto-funded from ${nextMonth.month}`,
    })
    appliedDelta[nextMonth.month] = (appliedDelta[nextMonth.month] || 0) + pull
  })

  return transfers
}

// ── Assertions ──────────────────────────────────────────────────────────
const assertEqual = (actual, expected, label) => {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) {
    console.error(`FAIL: ${label}\n  got:      ${a}\n  expected: ${e}`)
    process.exitCode = 1
  } else {
    console.log(`PASS: ${label}`)
  }
}

// Case A: simple overage, next month fully covers it
{
  const project = {
    monthly_plan: [
      { month: '2026-01', total: 10000, phases: [{ actual: 12000 }] },
      { month: '2026-02', total: 10000, phases: [{ actual: 0 }] },
    ],
    pool_adjustments: [],
  }
  const result = computeActualVsPlannedTransfers(project)
  assertEqual(
    result,
    [
      {
        pool: 'project',
        month: '2026-02',
        amount: 2000,
        source: 'actual_pull',
        counterMonth: '2026-01',
        reason: 'Auto-pulled to cover 2026-01 overage',
      },
      {
        pool: 'project',
        month: '2026-01',
        amount: -2000,
        source: 'actual_pull',
        counterMonth: '2026-02',
        reason: 'Auto-funded from 2026-02',
      },
    ],
    'Case A: full pull from next month',
  )
}

// Case B: overage bigger than next month's capacity — partial pull, no error
{
  const project = {
    monthly_plan: [
      { month: '2026-01', total: 10000, phases: [{ actual: 15000 }] },
      { month: '2026-02', total: 3000, phases: [{ actual: 0 }] },
    ],
    pool_adjustments: [],
  }
  const result = computeActualVsPlannedTransfers(project)
  assertEqual(
    result.find((r) => r.month === '2026-02').amount,
    3000,
    'Case B: pulls all of next month\'s 3000, leaves 2000 unfunded (no adjustment forced)',
  )
}

// Case C: last month overage, no next month — no transfer at all
{
  const project = {
    monthly_plan: [{ month: '2026-01', total: 10000, phases: [{ actual: 15000 }] }],
    pool_adjustments: [],
  }
  assertEqual(computeActualVsPlannedTransfers(project), [], 'Case C: no next month, no transfer')
}

// Case D: chained overage — Jan pulls from Feb, Feb (net of that pull) is also over, pulls from Mar
{
  const project = {
    monthly_plan: [
      { month: '2026-01', total: 10000, phases: [{ actual: 11000 }] }, // over by 1000
      { month: '2026-02', total: 10000, phases: [{ actual: 10500 }] }, // raw over by 500, but after giving 1000 to Jan, effective planned is 9000, so actual 10500 vs 9000 = over by 1500
      { month: '2026-03', total: 10000, phases: [{ actual: 0 }] },
    ],
    pool_adjustments: [],
  }
  const result = computeActualVsPlannedTransfers(project)
  const janFromFeb = result.find((r) => r.month === '2026-01' && r.counterMonth === '2026-02')
  const febFromMar = result.find((r) => r.month === '2026-02' && r.counterMonth === '2026-03')
  assertEqual(janFromFeb.amount, -1000, 'Case D: Jan receives 1000 from Feb')
  assertEqual(febFromMar.amount, -1500, 'Case D: Feb receives 1500 from Mar (its own overage against reduced capacity)')
}

// Case E: no excess — no transfers
{
  const project = {
    monthly_plan: [
      { month: '2026-01', total: 10000, phases: [{ actual: 9000 }] },
      { month: '2026-02', total: 10000, phases: [{ actual: 0 }] },
    ],
    pool_adjustments: [],
  }
  assertEqual(computeActualVsPlannedTransfers(project), [], 'Case E: under/at planned, no transfer')
}
```

- [ ] **Step 2: Run it**

```bash
node /tmp/verify-transfers.mjs
```

Expected: five `PASS:` lines, exit code 0. If Case D fails, re-derive the `appliedDelta`/`effectivePlanned` bookkeeping by hand against the case's numbers before touching the real file — this is the trickiest part of the algorithm.

- [ ] **Step 3: Delete the throwaway script**

```bash
rm /tmp/verify-transfers.mjs
```

- [ ] **Step 4: Apply the verified logic to the real file**

In `hma-template/emsv1/src/services/monthlyApportionment.js`, replace `sumManualPoolAdjustments`:

```js
export const sumManualPoolAdjustments = (adjustments, month) =>
  Math.round(
    (adjustments || [])
      .filter((a) => a.source === 'manual' && a.month === month && a.pool !== 'project')
      .reduce((s, a) => s + (a.amount || 0), 0) * 100,
  ) / 100
```

Replace `computeEffectiveProjectMonthly`:

```js
export const computeEffectiveProjectMonthly = (project, month) => {
  const monthEntry = (project.monthly_plan || []).find((m) => m.month === month)
  const rawTotal = monthEntry?.total || 0
  const manualDelta = sumManualPoolAdjustments(project.pool_adjustments, month)
  const projectTransfer = sumPoolAdjustments(project.pool_adjustments, 'project', month)
  return Math.round((rawTotal + manualDelta - projectTransfer) * 100) / 100
}
```

Add two new exports at the end of the file (after `computeCascadeAdjustments`, before `validatePlanTotalWithCascade`):

```js
/** Sum of a month's phase-line `actual` figures. Blank/unset lines count as 0. */
export const computeMonthActualTotal = (monthEntry) =>
  Math.round(
    (monthEntry?.phases || []).reduce((s, ph) => s + (parseFloat(ph.actual) || 0), 0) * 100,
  ) / 100

/**
 * Derives the 'actual_pull' pool_adjustments a monthly plan's actual-vs-
 * planned figures imply: processing months chronologically, when a
 * month's actual total exceeds its *effective* planned total (raw plan
 * total plus/minus any transfer already applied to it earlier in this
 * same pass), the excess is pulled from the immediately next month's
 * effective planned total, capped at whatever that month currently has
 * available. Never reaches past the next month — an excess bigger than
 * next month's capacity, or a last-month excess with no next month, is
 * simply not represented by an adjustment for the uncovered remainder
 * (the UI flags it directly from the raw numbers, nothing is forced).
 * Pure function of the project's current monthly_plan and
 * pool_adjustments; does not read or preserve any existing 'actual_pull'
 * records itself — the caller (localProjects.js updateMonthPlan) discards
 * old ones and replaces them with this function's fresh output, the same
 * convention computeCascadeAdjustments already uses for 'auto_cascade'.
 * The caller must pass pool_adjustments with any stale 'actual_pull'
 * records already stripped out, or this function will double-subtract
 * them when computing effective planned figures.
 */
export const computeActualVsPlannedTransfers = (project) => {
  const plan = project.monthly_plan || []
  const adjustments = project.pool_adjustments || []
  const transfers = []
  const appliedDelta = {}
  const effectivePlanned = (month, rawTotal) => {
    const manualDelta = sumManualPoolAdjustments(adjustments, month)
    const existingProjectTransfer = sumPoolAdjustments(adjustments, 'project', month)
    return rawTotal + manualDelta - existingProjectTransfer - (appliedDelta[month] || 0)
  }

  plan.forEach((m, idx) => {
    const rawTotal = m.total || 0
    const planned = effectivePlanned(m.month, rawTotal)
    const actual = computeMonthActualTotal(m)
    const excess = Math.round((actual - planned) * 100) / 100
    if (excess <= 0) return

    const nextMonth = plan[idx + 1]
    if (!nextMonth) return

    const nextRawTotal = nextMonth.total || 0
    const nextAvailable = effectivePlanned(nextMonth.month, nextRawTotal)
    const pull = Math.min(excess, Math.max(nextAvailable, 0))
    if (pull <= 0) return

    transfers.push({
      pool: 'project',
      month: nextMonth.month,
      amount: pull,
      source: 'actual_pull',
      counterMonth: m.month,
      reason: `Auto-pulled to cover ${m.month} overage`,
    })
    transfers.push({
      pool: 'project',
      month: m.month,
      amount: -pull,
      source: 'actual_pull',
      counterMonth: nextMonth.month,
      reason: `Auto-funded from ${nextMonth.month}`,
    })
    appliedDelta[nextMonth.month] = (appliedDelta[nextMonth.month] || 0) + pull
  })

  return transfers
}
```

- [ ] **Step 5: Verify the file still parses and builds**

```bash
cd hma-template/emsv1 && npm run build
```

Expected: `✓ built in` with no errors (warnings about chunk size are pre-existing and unrelated).

- [ ] **Step 6: Commit**

```bash
cd hma-template/emsv1 && git add src/services/monthlyApportionment.js
git commit -m "feat: add actual-vs-planned transfer math to monthlyApportionment"
```

---

### Task 2: `localProjects.js` — bug fix + orchestration

**Files:**
- Modify: `hma-template/emsv1/src/services/localProjects.js`

**Interfaces:**
- Consumes: `computeMonthActualTotal`, `computeActualVsPlannedTransfers`, `computeEffectivePoolMonthly` from Task 1's file (the last one already existed but wasn't imported here yet).
- Produces:
  - `localProjects.setManualPoolAdjustment(projectId, {pool, month, newAmount, createdBy}) => project` — same signature, fixed math.
  - `localProjects.updateMonthPlan(projectId, month, phases) => {project, validation}` — same signature, phases may now carry `actual`.
  - `localProjects.sendSurplusToPools(projectId, {month, surplus, createdBy}) => project`
  - `localProjects.sendSurplusToNextMonth(projectId, {month, surplus, createdBy}) => project`
  - `localProjects.revokeActualSurplusTransfer(projectId, {month}) => project`
  - All consumed by Task 3 (`MonthlyPlanPanel.jsx`). (No `revokeSurplusToPools` — see Step 4's note on why "Send to HR/Core" has no dedicated revoke control.)

- [ ] **Step 1: Update the import block**

In `hma-template/emsv1/src/services/localProjects.js`, find:

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
  computeActualVsPlannedTransfers,
  computeEffectivePoolMonthly,
} from './monthlyApportionment'
```

- [ ] **Step 2: Fix the `setManualPoolAdjustment` bug**

Find the existing method (around line 693):

```js
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
```

Replace the `flat`/`delta` computation with:

```js
    const flat = computeFlatMonthlyRate(projects[pIdx], pool)
    const nonManualWithdrawn = (projects[pIdx].pool_adjustments || [])
      .filter((a) => a.pool === pool && a.month === month && a.source !== 'manual')
      .reduce((s, a) => s + (a.amount || 0), 0)
    const delta =
      Math.round((flat - nonManualWithdrawn - (parseFloat(newAmount) || 0)) * 100) / 100
```

Leave the rest of the method (the `withoutExistingManual` filter and everything after) exactly as-is — only the `delta` computation changes. This is the bug fix: a typed `newAmount` now lands exactly on the effective figure regardless of any `auto_cascade` (or future `actual_pull`) withdrawal already sitting on that pool+month, because the delta is computed relative to what's *already available after those other withdrawals*, not the raw flat rate.

- [ ] **Step 3: Extend `updateMonthPlan` to recompute `actual_pull` transfers**

Find the existing method (around line 636):

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

Replace with:

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

    const preservedAdjustments = (project.pool_adjustments || []).filter(
      (a) => a.source !== 'auto_cascade' && a.source !== 'actual_pull',
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
    const actualPullAdjustments = computeActualVsPlannedTransfers({
      ...project,
      monthly_plan: updatedPlan,
      pool_adjustments: preservedAdjustments,
    }).map((a) => ({
      id: `padj_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      ...a,
      createdBy: 'System',
      createdAt: now(),
    }))
    const poolAdjustments = [
      ...preservedAdjustments,
      ...cascadeAdjustments,
      ...actualPullAdjustments,
    ]

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

Note the `pool_adjustments: preservedAdjustments` passed into `computeActualVsPlannedTransfers`'s input — this is what makes stale `actual_pull` records not get double-subtracted (per Task 1's doc comment on that function).

- [ ] **Step 4: Add the four new methods**

Add these after `revokePoolAllocation` (around line 793, right before the `// ── Pool % Adjustment API ──` comment):

```js
  // ── Actual-vs-Planned Reallocation (Case 1 automatic, Case 2 manual) ────────

  /**
   * Case 2 "Send to HR/Core": splits a month's Project surplus 50/50 into
   * HR and Core's effective monthly figures via the existing
   * setManualPoolAdjustment — no new schema. Each call adds its half on
   * top of whatever that pool's current effective figure already is
   * (not a flat overwrite), so a pre-existing manual HR/Core edit for
   * that month is preserved and topped up, not replaced outright.
   */
  sendSurplusToPools(projectId, { month, surplus, createdBy }) {
    const amt = parseFloat(surplus) || 0
    if (amt <= 0) throw new Error('No surplus available to send for this month.')
    const half = Math.round((amt / 2) * 100) / 100
    const otherHalf = Math.round((amt - half) * 100) / 100

    const project = localProjects.getById(projectId)
    if (!project) throw new Error('Project not found')

    const hrCurrent = computeEffectivePoolMonthly(project, 'hr', month)
    const afterHr = localProjects.setManualPoolAdjustment(projectId, {
      pool: 'hr',
      month,
      newAmount: hrCurrent + half,
      createdBy,
    })
    const coreCurrent = computeEffectivePoolMonthly(afterHr, 'core', month)
    return localProjects.setManualPoolAdjustment(projectId, {
      pool: 'core',
      month,
      newAmount: coreCurrent + otherHalf,
      createdBy,
    })
  },

  /**
   * Case 2 "Send to next month": pushes a month's Project surplus into
   * next month's effective planned Project total, as a paired
   * pool: 'project' adjustment (same sign convention/shape as the
   * automatic 'actual_pull' transfers) — but source-tagged distinctly
   * since this one is PO-triggered and persists until explicitly
   * revoked, not recomputed-and-replaced on every edit.
   */
  sendSurplusToNextMonth(projectId, { month, surplus, createdBy }) {
    const amt = parseFloat(surplus) || 0
    if (amt <= 0) throw new Error('No surplus available to send for this month.')

    const projects = read(PROJECTS_KEY)
    const pIdx = projects.findIndex((p) => p.id === projectId)
    if (pIdx === -1) throw new Error('Project not found')
    const project = projects[pIdx]

    const months = monthsInRange(project.start_date, project.end_date)
    const monthIdx = months.indexOf(month)
    if (monthIdx === -1) throw new Error(`${month} is outside the project's duration.`)
    const nextMonth = months[monthIdx + 1]
    if (!nextMonth) throw new Error('There is no next month to send this surplus to.')

    const withoutExistingSurplusTransfer = (project.pool_adjustments || []).filter(
      (a) =>
        !(a.source === 'actual_surplus_next_month' && (a.month === month || a.month === nextMonth)),
    )
    const record = (targetMonth, amount, counterMonth, reason) => ({
      id: `padj_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      pool: 'project',
      month: targetMonth,
      amount,
      source: 'actual_surplus_next_month',
      counterMonth,
      reason,
      createdBy: createdBy || 'Unknown',
      createdAt: now(),
    })

    projects[pIdx] = {
      ...project,
      pool_adjustments: [
        ...withoutExistingSurplusTransfer,
        record(month, amt, nextMonth, `PO-sent surplus to ${nextMonth}`),
        record(nextMonth, -amt, month, `PO-sent surplus from ${month}`),
      ],
      updated_at: now(),
    }
    write(PROJECTS_KEY, projects)
    notify()
    return projects[pIdx]
  },

  /** Reverses a Case-2 "Send to next month" transfer — removes both paired records. */
  revokeActualSurplusTransfer(projectId, { month }) {
    const projects = read(PROJECTS_KEY)
    const pIdx = projects.findIndex((p) => p.id === projectId)
    if (pIdx === -1) throw new Error('Project not found')
    const project = projects[pIdx]

    const existing = (project.pool_adjustments || []).find(
      (a) => a.source === 'actual_surplus_next_month' && a.month === month,
    )
    if (!existing) return project

    const counterMonth = existing.counterMonth
    projects[pIdx] = {
      ...project,
      pool_adjustments: (project.pool_adjustments || []).filter(
        (a) =>
          !(
            a.source === 'actual_surplus_next_month' &&
            (a.month === month || a.month === counterMonth)
          ),
      ),
      updated_at: now(),
    }
    write(PROJECTS_KEY, projects)
    notify()
    return projects[pIdx]
  },
```

No dedicated "revoke" for Case 2's "Send to HR/Core": it's built on the existing single-slot `setManualPoolAdjustment`, which can't cleanly separate "this month's manual HR/Core figure came from a surplus-send" from "the PO just typed a number in that box" — there's no new field for that distinction, by design (no schema change for this path, per the spec). Undoing it is already possible the same way any manual HR/Core edit is undone today: type a new value directly into the box (now that Task 2 Step 2's bug fix makes that land correctly). Adding a separate revoke button here would need new state to track *why* the current manual figure exists, which is unrequested scope beyond what the spec asked for.

- [ ] **Step 5: Verify the file still parses and builds**

```bash
cd hma-template/emsv1 && npm run build
```

Expected: `✓ built in` with no errors.

- [ ] **Step 6: Commit**

```bash
cd hma-template/emsv1 && git add src/services/localProjects.js
git commit -m "fix: HR/Core manual adjustment math; add actual-vs-planned reallocation methods"
```

---

### Task 3: `MonthlyPlanPanel.jsx` — Actual entry, transfer badge, Case 2 buttons, refresh

**Files:**
- Modify: `hma-template/emsv1/src/modules/pms/project-associate/MonthlyPlanPanel.jsx`

**Interfaces:**
- Consumes: `computeMonthActualTotal` (Task 1), `localProjects.sendSurplusToPools`/`sendSurplusToNextMonth`/`revokeActualSurplusTransfer` (Task 2), plus everything already imported in this file.
- Produces: nothing consumed elsewhere — this is the leaf UI layer.

- [ ] **Step 1: Update imports**

Find:

```js
import CIcon from '@coreui/icons-react'
import { cilPlus, cilTrash } from '@coreui/icons'
import { localProjects } from '../../../services/localProjects'
import { localProjectExpenses } from '../../../services/localProjectExpenses'
import { localTasks } from '../../../services/localTasks'
import {
  computeWorkingPool,
  monthsInRange,
  computeEffectivePoolMonthly,
  computeEffectivePoolPct,
  computeEffectiveProjectMonthly,
  sumManualPoolAdjustments,
  validatePlanTotalWithCascade,
} from '../../../services/monthlyApportionment'
```

Replace with:

```js
import CIcon from '@coreui/icons-react'
import { cilPlus, cilTrash, cilReload } from '@coreui/icons'
import { localProjects } from '../../../services/localProjects'
import { localProjectExpenses } from '../../../services/localProjectExpenses'
import { localTasks } from '../../../services/localTasks'
import {
  computeWorkingPool,
  monthsInRange,
  computeEffectivePoolMonthly,
  computeEffectivePoolPct,
  computeEffectiveProjectMonthly,
  computeMonthActualTotal,
  sumManualPoolAdjustments,
  validatePlanTotalWithCascade,
} from '../../../services/monthlyApportionment'
```

- [ ] **Step 2: Add the Actual input to each phase line in `PlanTable`**

Find (inside `PlanTable`, the `m.phases.map((ph, i) => (...))` block):

```jsx
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
```

Replace with:

```jsx
                            <CInputGroup size="sm" style={{ maxWidth: 120 }}>
                              <CInputGroupText>₹P</CInputGroupText>
                              <CFormInput
                                type="number"
                                min="0"
                                value={ph.amount}
                                disabled={!canEdit}
                                onChange={(e) => handleAmountChange(m.month, i, e.target.value)}
                              />
                            </CInputGroup>
                            <CInputGroup size="sm" style={{ maxWidth: 120 }}>
                              <CInputGroupText>₹A</CInputGroupText>
                              <CFormInput
                                type="number"
                                min="0"
                                placeholder="Actual"
                                value={ph.actual ?? ''}
                                disabled={!canEdit}
                                onChange={(e) => handleActualChange(m.month, i, e.target.value)}
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
```

`₹P`/`₹A` prefixes distinguish Planned from Actual inline, since both are now visible on the same row without separate column headers.

- [ ] **Step 3: Add `handleActualChange` and seed `actual` on new lines**

Find `handleAmountChange` in `PlanTable`:

```js
  const handleAmountChange = (month, phaseIdx, amount) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    const phases = monthEntry.phases.map((ph, i) =>
      i === phaseIdx ? { ...ph, amount: parseFloat(amount) || 0 } : ph,
    )
    const { project: updated } = localProjects.updateMonthPlan(project.id, month, phases)
    onProjectChange(updated)
  }
```

Add directly after it:

```js
  const handleActualChange = (month, phaseIdx, actual) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    const phases = monthEntry.phases.map((ph, i) =>
      i === phaseIdx ? { ...ph, actual: parseFloat(actual) || 0 } : ph,
    )
    const { project: updated } = localProjects.updateMonthPlan(project.id, month, phases)
    onProjectChange(updated)
  }
```

Find `handleAddPhase`:

```js
  const handleAddPhase = (month) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    const phases = [...monthEntry.phases, { phase: 'design', label: '', amount: 0 }]
    const { project: updated } = localProjects.updateMonthPlan(project.id, month, phases)
    onProjectChange(updated)
  }
```

Change the new-line object to seed `actual: 0`:

```js
  const handleAddPhase = (month) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    const phases = [...monthEntry.phases, { phase: 'design', label: '', amount: 0, actual: 0 }]
    const { project: updated } = localProjects.updateMonthPlan(project.id, month, phases)
    onProjectChange(updated)
  }
```

- [ ] **Step 4: Add reallocation handlers and error state to `PlanTable`**

Find the `const [saved, setSaved] = useState(false)` line near the top of `PlanTable` and add a sibling state line after it:

```js
  const [saved, setSaved] = useState(false)
  const [reallocError, setReallocError] = useState('')
```

Find `handleSave` (near the bottom of the handlers, before the `return (`):

```js
  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }
```

Add directly after it:

```js
  const handleSendSurplusToPools = (monthValue, surplus) => {
    setReallocError('')
    try {
      const updated = localProjects.sendSurplusToPools(project.id, {
        month: monthValue,
        surplus,
        createdBy: currentUser,
      })
      onProjectChange(updated)
    } catch (e) {
      setReallocError(e.message)
    }
  }

  const handleSendSurplusToNextMonth = (monthValue, surplus) => {
    setReallocError('')
    try {
      const updated = localProjects.sendSurplusToNextMonth(project.id, {
        month: monthValue,
        surplus,
        createdBy: currentUser,
      })
      onProjectChange(updated)
    } catch (e) {
      setReallocError(e.message)
    }
  }

  const handleRefresh = () => {
    const fresh = localProjects.getById(project.id)
    if (fresh) onProjectChange(fresh)
  }
```

- [ ] **Step 5: Add the refresh button to the card header**

Find the `CCardHeader` in `PlanTable`:

```jsx
      <CCardHeader className="bg-transparent fw-semibold pt-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <span>📊 Monthly Plan</span>
        <div className="d-flex align-items-center gap-2">
          {project.monthly_plan?.length > 0 && (
            <CBadge color={validation.valid ? 'success' : 'danger'}>
              {validation.valid
                ? `Balanced — ${fmt(validation.planTotal)}`
                : `Off by ${fmt(Math.abs(validation.diff))} (plan ${fmt(validation.planTotal)} vs baseline ${fmt(validation.workingPool)})`}
            </CBadge>
          )}
          {project.monthly_plan?.length > 0 && (
            <CButton size="sm" color="primary" onClick={handleSave}>
              💾 Save Monthly Plan
            </CButton>
          )}
        </div>
      </CCardHeader>
```

Add a refresh button before the badge:

```jsx
      <CCardHeader className="bg-transparent fw-semibold pt-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <span>📊 Monthly Plan</span>
        <div className="d-flex align-items-center gap-2">
          <CButton
            size="sm"
            color="secondary"
            variant="ghost"
            title="Refresh figures"
            onClick={handleRefresh}
          >
            <CIcon icon={cilReload} size="sm" />
          </CButton>
          {project.monthly_plan?.length > 0 && (
            <CBadge color={validation.valid ? 'success' : 'danger'}>
              {validation.valid
                ? `Balanced — ${fmt(validation.planTotal)}`
                : `Off by ${fmt(Math.abs(validation.diff))} (plan ${fmt(validation.planTotal)} vs baseline ${fmt(validation.workingPool)})`}
            </CBadge>
          )}
          {project.monthly_plan?.length > 0 && (
            <CButton size="sm" color="primary" onClick={handleSave}>
              💾 Save Monthly Plan
            </CButton>
          )}
        </div>
      </CCardHeader>
```

- [ ] **Step 6: Replace the Project Total cell — transfer badge + Case 2 buttons**

Find, inside the `project.monthly_plan.map((m) => {...})` block (note the map callback currently only takes `m` — it needs `idx` too):

```jsx
                {project.monthly_plan.map((m) => {
                  const adjustedFor = (pool) =>
                    (project.pool_adjustments || []).some(
                      (a) => a.pool === pool && a.month === m.month,
                    )
                  const projectReallocation = sumManualPoolAdjustments(
                    project.pool_adjustments,
                    m.month,
                  )
                  return (
```

Replace with (adds `idx`, `monthActual`, `netProjectTransfer`, `projectTransfers`, `surplus`):

```jsx
                {project.monthly_plan.map((m, idx) => {
                  const adjustedFor = (pool) =>
                    (project.pool_adjustments || []).some(
                      (a) => a.pool === pool && a.month === m.month,
                    )
                  const projectReallocation = sumManualPoolAdjustments(
                    project.pool_adjustments,
                    m.month,
                  )
                  const projectTransfers = (project.pool_adjustments || []).filter(
                    (a) => a.pool === 'project' && a.month === m.month,
                  )
                  const netProjectTransfer = projectTransfers.reduce(
                    (s, a) => s + (a.amount || 0),
                    0,
                  )
                  const monthActual = computeMonthActualTotal(m)
                  const monthPlanned = computeEffectiveProjectMonthly(project, m.month)
                  const surplus = Math.round((monthPlanned - monthActual) * 100) / 100
                  const hasNextMonth = idx < project.monthly_plan.length - 1
                  return (
```

Now find the Project Total cell:

```jsx
                      <CTableDataCell className="text-end fw-bold">
                        {fmt(computeEffectiveProjectMonthly(project, m.month))}
                        {projectReallocation !== 0 && (
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
```

Replace with:

```jsx
                      <CTableDataCell className="text-end fw-bold">
                        {fmt(monthPlanned)}
                        {projectReallocation !== 0 && (
                          <CBadge
                            color="warning"
                            shape="rounded-pill"
                            className="ms-1"
                            style={{ fontSize: '0.6rem' }}
                          >
                            adjusted
                          </CBadge>
                        )}
                        {netProjectTransfer !== 0 && (
                          <div className="mt-1">
                            <CBadge
                              color={netProjectTransfer > 0 ? 'warning' : 'info'}
                              shape="rounded-pill"
                              style={{ fontSize: '0.6rem' }}
                            >
                              {netProjectTransfer > 0 ? '−' : '+'}
                              {fmt(Math.abs(netProjectTransfer))}{' '}
                              {netProjectTransfer > 0 ? '→ given to' : '← from'}{' '}
                              {projectTransfers.map((a) => monthLabelShort(a.counterMonth)).join(', ')}
                            </CBadge>
                            {projectTransfers.some((a) => a.source === 'actual_surplus_next_month') &&
                              canEdit && (
                                <CButton
                                  size="sm"
                                  color="secondary"
                                  variant="ghost"
                                  style={{ fontSize: '0.62rem', padding: '0 4px' }}
                                  onClick={() =>
                                    onProjectChange(
                                      localProjects.revokeActualSurplusTransfer(project.id, {
                                        month: m.month,
                                      }),
                                    )
                                  }
                                >
                                  Revoke
                                </CButton>
                              )}
                          </div>
                        )}
                        {surplus > 0 && canEdit && (
                          <div className="d-flex gap-1 mt-1 justify-content-end flex-wrap">
                            <CButton
                              size="sm"
                              color="success"
                              variant="outline"
                              style={{ fontSize: '0.62rem', padding: '2px 6px' }}
                              onClick={() => handleSendSurplusToPools(m.month, surplus)}
                            >
                              Send {fmt(surplus)} → HR/Core
                            </CButton>
                            {hasNextMonth && (
                              <CButton
                                size="sm"
                                color="info"
                                variant="outline"
                                style={{ fontSize: '0.62rem', padding: '2px 6px' }}
                                onClick={() => handleSendSurplusToNextMonth(m.month, surplus)}
                              >
                                Send {fmt(surplus)} → Next Month
                              </CButton>
                            )}
                          </div>
                        )}
                      </CTableDataCell>
```

`monthLabelShort` is already defined in this file (used by `BaselineTable`) — no new import needed.

- [ ] **Step 7: Show `reallocError` near the top of the card body**

Find, in `PlanTable`'s `return (`, right after the `{saved && (...)}` block:

```jsx
      {saved && (
        <CAlert color="success" className="mb-0 py-2 small rounded-0 text-center">
          ✓ Monthly plan saved
        </CAlert>
      )}
      <CCardBody className="p-0">
```

Add the error alert between them:

```jsx
      {saved && (
        <CAlert color="success" className="mb-0 py-2 small rounded-0 text-center">
          ✓ Monthly plan saved
        </CAlert>
      )}
      {reallocError && (
        <CAlert color="danger" className="mb-0 py-2 small rounded-0 text-center">
          {reallocError}
        </CAlert>
      )}
      <CCardBody className="p-0">
```

- [ ] **Step 8: Remove `ActualExpenseCard` from `ExpensePanel`**

Delete the entire `ActualExpenseCard` component definition (from `const ActualExpenseCard = ({...`  through its closing `ActualExpenseCard.propTypes = {...}` block — roughly lines 1010–1135 in the pre-Task-3 file).

In `ExpensePanel`'s render, find:

```jsx
        <CRow className="g-3">
          <CCol xs={12} md={6}>
            <ActualExpenseCard
              projectId={project.id}
              month={month}
              plannedAmount={computeEffectiveProjectMonthly(project, month)}
              canEdit={canEdit}
              currentUser={currentUser}
            />
          </CCol>

          <CCol xs={12} md={6}>
            <CCard className="h-100">
              <CCardHeader className="bg-transparent fw-semibold py-2">
                🏁 Milestones <CBadge color="secondary">{monthInstallments.length}</CBadge>
              </CCardHeader>
```

Remove the `ActualExpenseCard` `CCol` block entirely, leaving Milestones as the first card:

```jsx
        <CRow className="g-3">
          <CCol xs={12} md={6}>
            <CCard className="h-100">
              <CCardHeader className="bg-transparent fw-semibold py-2">
                🏁 Milestones <CBadge color="secondary">{monthInstallments.length}</CBadge>
              </CCardHeader>
```

(Milestones/Assignees/Expenses cards below are otherwise untouched — Milestones and Assignees keep their existing `CCol xs={12} md={6}` markup unchanged, Expenses too.)

- [ ] **Step 9: Switch `ActualSpendPanel`'s Project column to phase-actual sums**

Find, at the top of `ActualSpendPanel`:

```js
const ActualSpendPanel = ({ project }) => {
  const entries = localProjectExpenses.list({ projectId: project.id, pool: 'admin' })
  const actualForMonth = (month) =>
    entries.filter((e) => e.month === month).reduce((s, e) => s + e.amount, 0)

  const projectEntries = localProjectExpenses.list({ projectId: project.id, pool: 'project' })
  const actualProjectForMonth = (month) =>
    projectEntries.filter((e) => e.month === month).reduce((s, e) => s + e.amount, 0)
```

Replace the `projectEntries`/`actualProjectForMonth` pair with:

```js
const ActualSpendPanel = ({ project }) => {
  const entries = localProjectExpenses.list({ projectId: project.id, pool: 'admin' })
  const actualForMonth = (month) =>
    entries.filter((e) => e.month === month).reduce((s, e) => s + e.amount, 0)

  const actualProjectForMonth = (month) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    return computeMonthActualTotal(monthEntry)
  }
```

Also update the description text right below the header, which currently says Project actuals are logged in the Expense tab:

Find:

```jsx
        <div className="small text-body-secondary mb-3">
          Real money spent against this project, month by month, compared to the planned pool rates.
          Admin actuals are logged by HR in EMS → Expense Management → Project Expenses. Project
          actuals are logged by the PO directly in the Expense tab. HR/Core actual tracking is not
          yet wired up.
        </div>
```

Replace with:

```jsx
        <div className="small text-body-secondary mb-3">
          Real money spent against this project, month by month, compared to the planned pool rates.
          Admin actuals are logged by HR in EMS → Expense Management → Project Expenses. Project
          actuals are entered directly on each phase line in the Monthly Plan table above. HR/Core
          actual tracking is not yet wired up.
        </div>
```

- [ ] **Step 10: Verify lint and build**

```bash
cd hma-template/emsv1 && npm run build && npx eslint src/modules/pms/project-associate/MonthlyPlanPanel.jsx
```

Expected: clean build. For lint, confirm any reported errors are the same pre-existing `prettier/prettier` formatting errors in `RecurringTasksSection` (lines ~95–500, untouched by this task) as before — no *new* errors in the lines this task touched. Compare against a pre-task baseline if unsure:

```bash
git stash && npx eslint src/modules/pms/project-associate/MonthlyPlanPanel.jsx 2>&1 | tail -5 && git stash pop
```

- [ ] **Step 11: Commit**

```bash
cd hma-template/emsv1 && git add src/modules/pms/project-associate/MonthlyPlanPanel.jsx
git commit -m "feat: Actual entry per phase line, Case 1/2 reallocation UI, retire itemized Actual Expense card"
```

---

### Task 4: End-to-end browser verification

**Files:** none (verification only).

**Interfaces:** none produced — terminal task.

- [ ] **Step 1: Start the dev server**

```bash
cd hma-template/emsv1
npm run start &
timeout 30 bash -c 'until curl -sf http://localhost:3001 >/dev/null 2>&1 || curl -sf http://localhost:3000 >/dev/null 2>&1; do sleep 1; done'
```

(Port may land on 3000 or 3001 depending on what else is running — check the Vite startup log for the actual port.)

- [ ] **Step 2: Drive it with Playwright** (via a scratch npm prefix — `mkdir -p /tmp/pw-scratch && cd /tmp/pw-scratch && npm init -y && npm install playwright`, same workaround this project's prior sessions have used)

Write a script that:
1. Dev-logs in as Project Associate, enters PMS, opens a project with a Monthly Plan already generated (or generates one for a project that doesn't have one yet).
2. On one phase line, types a Planned amount and an Actual amount greater than Planned (e.g. Planned 10,000 / Actual 12,000) for month 1 of a 2+ month project.
3. Screenshots the Monthly Plan table: confirm month 2's Project Total shows a reduced figure with a "− given to <month 1>" badge, and month 1 shows "+ from <month 2>" — i.e. Case 1 fired automatically with no extra click.
4. On a different month, types Actual less than Planned, confirms the "Send X → HR/Core" and "Send X → Next Month" buttons appear with the correct surplus amount.
5. Clicks "Send X → HR/Core", confirms the HR and Core boxes for that month increase by half the surplus each, and the buttons disappear (surplus now 0).
6. On another month with a surplus, clicks "Send X → Next Month" instead, confirms next month's Project Total increases and shows a "+ from" badge, and that clicking "Revoke" removes it and restores the original figures.
7. Types a value directly into an HR box for a month that already has an auto-cascade or actual-pull adjustment sitting on it (from steps above); confirms the box shows exactly what was typed after the edit — this is the bug-fix verification. Click the new refresh icon button; confirm the figure doesn't change (since it's already correct — refreshing a correct value is a no-op, which is itself a pass).
8. Opens the Expense tab for the same project, confirms `ActualExpenseCard` ("Actual Expense" card with a Date/Description row) no longer appears — only Milestones, Assignees, and the Admin/HR/Core Send/Revoke card remain.
9. Runs `console --errors` (or reads `page.on('console', ...)` for `error`-type messages) after every screenshot step; confirm none.

- [ ] **Step 3: Report findings**

For each of the 9 checks above, state pass/fail with the screenshot filename as evidence. Any failure blocks moving to Step 4 — fix the root cause in the relevant Task before re-running.

- [ ] **Step 4: Stop the dev server and clean up**

```bash
pkill -f "vite" 2>/dev/null
rm -rf /tmp/pw-scratch
```

- [ ] **Step 5: Final full verification pass**

```bash
cd hma-template/emsv1 && npm run build && npm run lint
```

Expected: clean build; lint shows only the same pre-existing baseline errors confirmed in Task 3 Step 10, no new ones anywhere in the three touched files.

- [ ] **Step 6: Report to the user**

Summarize what was verified (the 9 checks from Step 2), link the design spec and this plan, and state the final commit list from Tasks 1–3.
