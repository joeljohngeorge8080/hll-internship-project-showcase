# Monthly Plan — Pool Reallocation to Project Total — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a Project Officer manually reduces a month's Admin, HR, or Core amount in the Monthly Plan table, the reduced amount is added to that month's Project Total (and symmetrically, a manual top-up above the flat rate is subtracted from Project Total).

**Architecture:** A new pure derivation, `computeEffectiveProjectMonthly`, added to the existing pure-math module `monthlyApportionment.js`, folds every `source: 'manual'` `pool_adjustments` delta for a month into that month's raw phase total. `MonthlyPlanPanel.jsx` swaps its raw `m.total` reads for this derived value in the three places Project Total is displayed. No data model or persistence changes — this mirrors the existing live-computed pattern `computeEffectivePoolMonthly` already uses.

**Tech Stack:** React 19 (CoreUI components), plain-JS pure functions, `localStorage`-backed mock service layer (no backend yet). No test framework exists in this repo (confirmed: no `vitest`/`jest`, no `test` script in `package.json`) — pure-function correctness is verified with a throwaway Node ESM script; the UI change is verified by running the app and driving it in a real browser.

## Global Constraints

- No data model changes — `computeEffectiveProjectMonthly` is a live, unpersisted derivation; nothing new is written to `localStorage`.
- Only `pool_adjustments` entries with `source: 'manual'` feed the calculation — `auto_cascade` entries are excluded (they already fund an overage the raw phase total already reflects; including them too would double-count).
- Applies to all three pools: Admin, HR, and Core.
- Symmetric: a pool reduction (`delta > 0`) adds to Project Total; a manual top-up above the flat rate (`delta < 0`) subtracts from Project Total. This falls out of the existing `delta = flat − newAmount` sign convention in `setManualPoolAdjustment` — no new sign-handling logic.
- The reallocated amount is folded invisibly into the Project Total number — no new phase/task line item is created.
- `validatePlanTotal`, `validatePlanTotalWithCascade`, and `computeCascadeAdjustments` are unaffected and must not be modified — they validate the PO's raw phase entries against the fixed `workingPool` target, an orthogonal concern.
- Round every money value to the nearest paisa (`Math.round(x * 100) / 100`), matching every existing function in `monthlyApportionment.js`.

---

### Task 1: Add `computeEffectiveProjectMonthly` to `monthlyApportionment.js`

**Files:**
- Modify: `hma-template/emsv1/src/services/monthlyApportionment.js:91` (insert new code immediately after this line, before the `computeEffectivePoolPct` doc-comment that currently starts at line 93)
- Test: `/tmp/claude-1000/-home-jojo-labs-git-lab-HMA-hma-template-emsv1/13912b15-c7a6-4086-8ff4-170a58547998/scratchpad/verify-monthly-apportionment.mjs` (throwaway, not committed)

**Interfaces:**
- Consumes: nothing new — reads `project.monthly_plan` (array of `{ month, phases, total }`) and `project.pool_adjustments` (array of `{ pool, month, amount, source }`), both already defined and populated by the existing `localProjects.js`.
- Produces (used by Task 2):
  - `sumManualPoolAdjustments(adjustments, month) => number`
  - `computeEffectiveProjectMonthly(project, month) => number`

- [ ] **Step 1: Write the failing verification script**

Create `/tmp/claude-1000/-home-jojo-labs-git-lab-HMA-hma-template-emsv1/13912b15-c7a6-4086-8ff4-170a58547998/scratchpad/verify-monthly-apportionment.mjs`:

```js
import assert from 'node:assert/strict'
import {
  sumManualPoolAdjustments,
  computeEffectiveProjectMonthly,
} from '/home/jojo/labs/git-lab/HMA/hma-template/emsv1/src/services/monthlyApportionment.js'

const project = {
  monthly_plan: [
    { month: '2026-01', phases: [{ phase: 'design', label: 'x', amount: 85000 }], total: 85000 },
    { month: '2026-02', phases: [{ phase: 'design', label: 'x', amount: 85000 }], total: 85000 },
  ],
  pool_adjustments: [
    { pool: 'hr', month: '2026-01', amount: 2000, source: 'manual' }, // HR reduced 2000 → Project +2000
    { pool: 'core', month: '2026-01', amount: -1000, source: 'manual' }, // Core topped up 1000 → Project -1000
    { pool: 'admin', month: '2026-01', amount: 500, source: 'manual' }, // Admin reduced 500 → Project +500
    { pool: 'hr', month: '2026-01', amount: 999999, source: 'auto_cascade' }, // must be excluded
    { pool: 'hr', month: '2026-02', amount: 3000, source: 'manual' }, // different month
  ],
}

// Jan: manual deltas are 2000 - 1000 + 500 = 1500 (auto_cascade excluded)
assert.equal(sumManualPoolAdjustments(project.pool_adjustments, '2026-01'), 1500)
assert.equal(computeEffectiveProjectMonthly(project, '2026-01'), 86500)

// Feb: only its own manual delta (3000) applies, Jan's adjustments don't leak in
assert.equal(sumManualPoolAdjustments(project.pool_adjustments, '2026-02'), 3000)
assert.equal(computeEffectiveProjectMonthly(project, '2026-02'), 88000)

// Month with no plan entry and no adjustments: raw total 0, delta 0
assert.equal(computeEffectiveProjectMonthly(project, '2026-03'), 0)

// Project with no pool_adjustments at all: falls back to raw total unchanged
const bareProject = { monthly_plan: [{ month: '2026-01', phases: [], total: 42000 }] }
assert.equal(computeEffectiveProjectMonthly(bareProject, '2026-01'), 42000)

console.log('ALL ASSERTIONS PASSED')
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-detect-module /tmp/claude-1000/-home-jojo-labs-git-lab-HMA-hma-template-emsv1/13912b15-c7a6-4086-8ff4-170a58547998/scratchpad/verify-monthly-apportionment.mjs`

Expected: fails with `SyntaxError: The requested module '...monthlyApportionment.js' does not provide an export named 'sumManualPoolAdjustments'` (the functions don't exist yet).

- [ ] **Step 3: Implement the two functions**

In `hma-template/emsv1/src/services/monthlyApportionment.js`, insert immediately after line 91 (the closing `}` of `computeEffectivePoolMonthly`) and before line 93 (the `computeEffectivePoolPct` doc-comment):

```js
/**
 * Sum of every manual pool_adjustment delta (admin+hr+core) recorded
 * against one exact month, regardless of which pool. Excludes
 * auto_cascade adjustments — those already fund an overage the month's
 * raw phase total already includes, so folding them in here would
 * double-count the same rupees.
 */
export const sumManualPoolAdjustments = (adjustments, month) =>
  Math.round(
    (adjustments || [])
      .filter((a) => a.source === 'manual' && a.month === month)
      .reduce((s, a) => s + (a.amount || 0), 0) * 100,
  ) / 100

/**
 * A month's Project Total after folding in manual pool reallocation: a
 * pool reduction (positive delta) adds to Project; a manual top-up above
 * the flat rate (negative delta) subtracts from it. Symmetric by
 * construction — the same delta is subtracted from the pool's own
 * effective figure (computeEffectivePoolMonthly) and added here, so the
 * two changes cancel and a month's grand total (Project + Admin + HR +
 * Core) is unaffected by any manual reallocation. Not clamped at 0 for
 * the same reason computeEffectivePoolMonthly isn't — a large enough
 * cross-pool top-up can legitimately push this negative.
 */
export const computeEffectiveProjectMonthly = (project, month) => {
  const monthEntry = (project.monthly_plan || []).find((m) => m.month === month)
  const rawTotal = monthEntry?.total || 0
  const manualDelta = sumManualPoolAdjustments(project.pool_adjustments, month)
  return Math.round((rawTotal + manualDelta) * 100) / 100
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --experimental-detect-module /tmp/claude-1000/-home-jojo-labs-git-lab-HMA-hma-template-emsv1/13912b15-c7a6-4086-8ff4-170a58547998/scratchpad/verify-monthly-apportionment.mjs`

Expected: prints `ALL ASSERTIONS PASSED` and exits 0 (a `MODULE_TYPELESS_PACKAGE_JSON` warning on stderr is expected and harmless — it's Node's ESM-detection warning, not a failure).

- [ ] **Step 5: Delete the throwaway script and commit**

```bash
rm /tmp/claude-1000/-home-jojo-labs-git-lab-HMA-hma-template-emsv1/13912b15-c7a6-4086-8ff4-170a58547998/scratchpad/verify-monthly-apportionment.mjs
cd /home/jojo/labs/git-lab/HMA
git add hma-template/emsv1/src/services/monthlyApportionment.js
git commit -m "feat: add computeEffectiveProjectMonthly for pool-to-project reallocation"
```

---

### Task 2: Wire the effective Project Total into `MonthlyPlanPanel.jsx`

**Files:**
- Modify: `hma-template/emsv1/src/modules/pms/project-associate/MonthlyPlanPanel.jsx:28-34` (import block)
- Modify: `hma-template/emsv1/src/modules/pms/project-associate/MonthlyPlanPanel.jsx:489-496` (PlanTable per-month row — Project Total cell)
- Modify: `hma-template/emsv1/src/modules/pms/project-associate/MonthlyPlanPanel.jsx:619` (PlanningSummary `projectTotal` calculation)
- Modify: `hma-template/emsv1/src/modules/pms/project-associate/MonthlyPlanPanel.jsx:684-685` (PlanningSummary per-month table — Project cell)

**Interfaces:**
- Consumes: `computeEffectiveProjectMonthly(project, month)` and `sumManualPoolAdjustments(adjustments, month)` from Task 1 (`../../../services/monthlyApportionment`).
- Produces: no new exports — this task only changes what the existing `PlanTable` and `PlanningSummary` components render.

- [ ] **Step 1: Update the import block**

In `hma-template/emsv1/src/modules/pms/project-associate/MonthlyPlanPanel.jsx`, find (lines 28-34):

```js
import {
  computeWorkingPool,
  monthsInRange,
  computeEffectivePoolMonthly,
  computeEffectivePoolPct,
  validatePlanTotalWithCascade,
} from '../../../services/monthlyApportionment'
```

Replace with:

```js
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

- [ ] **Step 2: Update the PlanTable Project Total cell**

In the same file, find this block inside `PlanTable` (lines 489-496 — the start of the `project.monthly_plan.map` in the table body):

```jsx
              {project.monthly_plan.map((m) => {
                const adjustedFor = (pool) =>
                  (project.pool_adjustments || []).some(
                    (a) => a.pool === pool && a.month === m.month,
                  )
                return (
                  <CTableRow key={m.month}>
                    <CTableDataCell className="fw-semibold">{monthLabel(m.month)}</CTableDataCell>
```

Replace with:

```jsx
              {project.monthly_plan.map((m) => {
                const adjustedFor = (pool) =>
                  (project.pool_adjustments || []).some(
                    (a) => a.pool === pool && a.month === m.month,
                  )
                const projectReallocation = sumManualPoolAdjustments(project.pool_adjustments, m.month)
                return (
                  <CTableRow key={m.month}>
                    <CTableDataCell className="fw-semibold">{monthLabel(m.month)}</CTableDataCell>
```

Then, further down in the same row (line 556), find:

```jsx
                    <CTableDataCell className="text-end fw-bold">{fmt(m.total)}</CTableDataCell>
```

Replace with:

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

- [ ] **Step 3: Update PlanningSummary's `projectTotal`**

In the same file, find this line inside `PlanningSummary` (line 619):

```js
  const projectTotal = project.monthly_plan.reduce((s, m) => s + (m.total || 0), 0)
```

Replace with:

```js
  const projectTotal = project.monthly_plan.reduce(
    (s, m) => s + computeEffectiveProjectMonthly(project, m.month),
    0,
  )
```

- [ ] **Step 4: Update PlanningSummary's per-month table Project cell**

In the same file, find this block inside `PlanningSummary`'s per-month table (around lines 682-686):

```jsx
              {project.monthly_plan.map((m) => (
                <CTableRow key={m.month}>
                  <CTableDataCell>{monthLabel(m.month)}</CTableDataCell>
                  <CTableDataCell className="text-end">{fmt(m.total)}</CTableDataCell>
```

Replace with:

```jsx
              {project.monthly_plan.map((m) => (
                <CTableRow key={m.month}>
                  <CTableDataCell>{monthLabel(m.month)}</CTableDataCell>
                  <CTableDataCell className="text-end">
                    {fmt(computeEffectiveProjectMonthly(project, m.month))}
                  </CTableDataCell>
```

- [ ] **Step 5: Lint**

Run: `cd hma-template/emsv1 && npm run lint`
Expected: exits 0, no new errors or warnings in `MonthlyPlanPanel.jsx` or `monthlyApportionment.js`.

- [ ] **Step 6: Build**

Run: `cd hma-template/emsv1 && npm run build`
Expected: exits 0, ends with a `build/` output summary (e.g. `✓ built in ...`), no errors.

- [ ] **Step 7: Verify end-to-end in a real browser**

This repo has no automated test framework (confirmed during planning — no `vitest`/`jest`, no `test` script), so UI correctness is verified by actually driving the feature, per this project's standing convention for frontend changes.

Invoke the `verify` skill with this scenario:

> Start the dev server for `hma-template/emsv1` (`npm run start`). Open the app, use the dev quick-login "Project Associate" button (visible in dev mode on the login page) to sign in — this lands on `/pms/pa/dashboard`. Open any project's detail page, find "📅 Plan the Budget by Month", fill in an amount for one month's line item, click "Generate Plan" to produce a monthly plan (confirm the overwrite dialog if one appears). In the resulting "📊 Monthly Plan" table:
> (1) note a month's current Project Total, then reduce that same month's HR amount by some value X — confirm the Project Total for that month increases by exactly X and an "adjusted" badge appears next to it.
> (2) on a different month, raise the Core amount above its current (flat) value by some value Y — confirm that month's Project Total decreases by exactly Y.
> (3) reduce that same month's Admin amount by some value Z too — confirm Project Total increases by an additional Z (on top of the Core-driven decrease from step 2), and the "📈 Planning Summary" panel's Project/Grand Total figures reflect the same net change.
> Report whether all three checks passed, with the actual before/after numbers observed.

- [ ] **Step 8: Commit**

```bash
cd /home/jojo/labs/git-lab/HMA
git add hma-template/emsv1/src/modules/pms/project-associate/MonthlyPlanPanel.jsx
git commit -m "feat: reflect Admin/HR/Core reallocation in month's Project Total"
```
