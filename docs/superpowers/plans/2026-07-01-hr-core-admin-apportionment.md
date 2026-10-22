# HR / Core / Admin Pool Apportionment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the HR/Core/Admin org-pool logic so Admin is a one-time lump sum credited at project creation, HR/Core apportionment only begins once "Activate Project" is clicked (itself gated on at least one task being assigned), and a Project Coordinator can pull a milestone shortfall from HR/Core with the change applying only to the current-and-future months.

**Architecture:** All state lives in `localStorage` via the existing `localProjects` / `localOrgPool` service modules (no backend yet). The core mechanism is an append-only per-project `hr_core_rate_ledger`: activation writes the first rate entry per pool, a shortfall withdrawal writes a new entry effective from the current month onward. Every consumer (consolidated sheet, drill-down, project detail) reads "the rate for month X" by taking the latest ledger entry with `effectiveFromMonth <= X`, so past months are structurally never rewritten.

**Tech Stack:** React 19 + Vite, CoreUI React components, plain JS service modules backed by `localStorage`. No test runner (no Jest/Vitest/pytest configured anywhere in this repo — confirmed via `package.json` scripts, which only has `build`/`lint`/`serve`/`start`).

## Global Constraints

- No backend exists yet — every change here is frontend-only, `localStorage`-backed, per the existing pattern in `localProjects.js` / `localOrgPool.js`. Do not introduce API calls.
- No automated test framework is configured in this repo. Each task's verification step is: (a) `npm run lint` from `hma-template/emsv1/`, (b) `npm run build` from the same directory, and (c) a manual browser-devtools-console check script (provided per task) run against the app's `localStorage` state, since these services read/write `localStorage` directly and cannot run under plain `node`. Do not add a test framework as part of this plan — out of scope.
- **Lint baseline warning:** `npm run lint` on an unmodified checkout of this branch already reports 523 pre-existing errors / 14 warnings repo-wide (confirmed by running it before any task started) — it does **not** exit 0 today and is not expected to. Do not attempt to fix pre-existing lint errors in files you didn't otherwise touch for your task — that is out of scope and would blow up the diff. Every task's lint step runs `npm run lint -- <path-to-the-file(s)-you-changed>` (eslint accepts specific file paths) scoped to only the files that task touches, and compares the reported error count against this pre-existing per-file baseline (also confirmed by running it before any task started):

  | File | Baseline error count |
  |---|---|
  | `src/services/localOrgPool.js` | 2 |
  | `src/services/localProjects.js` | 0 |
  | `src/modules/pms/project-associate/ProjectDetailPage.jsx` | 56 |
  | `src/modules/ems/expense-management/ExpenseManagementPage.jsx` | 38 |
  | `src/modules/ems/projects/ProjectOverheadsList.jsx` | 1 |

  The bar for every task's lint step is: **the scoped lint run's error count must not exceed the baseline number above for that file.** It is fine if the count is lower (e.g. a rewrite happens to fix a pre-existing formatting error in a block you replaced) — do not chase the baseline errors down to 0, that is out of scope.
- `npm run build` **does** exit 0 cleanly on an unmodified checkout (only non-fatal "chunk size" warnings) — treat any build failure as a real regression from your change.
- Follow existing code style: no semicolons are used inconsistently in this codebase (mixed) — match the file you're editing line-by-line rather than reformatting.
- Money values are always rounded to 2 decimals with `Math.round(x * 100) / 100`, matching every existing calculation in `localOrgPool.js`.
- Dates for months are always `'YYYY-MM'` strings; use `.slice(0, 7)` on ISO date strings to get the month.
- Run `npm run lint` and `npm run build` from `/home/jojo/labs/git-lab/HMA/hma-template/emsv1` (that's the actual Vite project root — not the repo root).

---

## Task 1: Ledger + rate-lookup helpers in `localOrgPool.js`

**Files:**
- Modify: `hma-template/emsv1/src/services/localOrgPool.js:83-126` (delete `computeHRCoreMonthly`, add new helpers in its place)

**Interfaces:**
- Produces: top-level helpers `currentMonth()`, `rateForMonth(ledger, pool, month)`, `getEffectiveLedger(project)` (module-private, used by Tasks 2–4 within this same file).
- Produces: `localOrgPool.computeActivationLedgerEntries(project, activatedAtISO, createdBy)` → `Array<{id, pool, effectiveFromMonth, monthlyRate, reason, installmentId, note, createdBy, createdAt}>` (2 entries: hr + core). Consumed by Task 4 (`localProjects.js` `activateProject()`).
- Produces: `localOrgPool.computeAdminPoolAmount(project)` → `number`. Consumed by Task 2 (`localProjects.js` `create()`/`update()`).

- [ ] **Step 1: Delete the old `computeHRCoreMonthly` function**

In `hma-template/emsv1/src/services/localOrgPool.js`, delete lines 83-126 (the entire `computeHRCoreMonthly` function, including its docblock). Leave the `projectValue` function above it (line 86 in the old numbering, just above `computeHRCoreMonthly`) untouched.

- [ ] **Step 2: Add the ledger helpers in its place**

Insert this in the same spot (right after `projectValue`, right before `// ─── Public API ───`):

```js
/**
 * Current calendar month as 'YYYY-MM'.
 */
const currentMonth = () => new Date().toISOString().slice(0, 7)

/**
 * Returns the monthlyRate in effect for `pool` during `month`, per the
 * project's append-only hr_core_rate_ledger. Returns null if the pool has
 * never been activated for this project (no ledger entry applies yet).
 */
const rateForMonth = (ledger, pool, month) => {
  const entries = (ledger || []).filter((e) => e.pool === pool && e.effectiveFromMonth <= month)
  if (entries.length === 0) return null
  return entries.sort((a, b) => b.effectiveFromMonth.localeCompare(a.effectiveFromMonth))[0]
    .monthlyRate
}

/**
 * Legacy shim: projects activated before hr_core_rate_ledger existed only
 * have is_operations_active + operations_activated_at. Synthesize the two
 * base ledger entries on the fly so seed/demo data keeps working without a
 * data migration.
 */
const getEffectiveLedger = (project) => {
  if (project.hr_core_rate_ledger?.length > 0) return project.hr_core_rate_ledger
  if (!project.is_operations_active || !project.operations_activated_at) return []
  return localOrgPool.computeActivationLedgerEntries(project, project.operations_activated_at)
}
```

- [ ] **Step 3: Add the two new public methods to the `localOrgPool` object**

In the same file, inside `export const localOrgPool = {` (the object literal starts a few lines below), add these two methods as the first two entries, right after the opening brace:

```js
  /**
   * Computes the two activation ledger entries (hr + core) for a project,
   * anchored to the calendar month of `activatedAtISO`. Does not mutate
   * or persist anything — the caller (localProjects.activateProject) is
   * responsible for appending these to project.hr_core_rate_ledger.
   */
  computeActivationLedgerEntries(project, activatedAtISO, createdBy = 'system') {
    const pv = projectValue(project)
    const activationMonth = activatedAtISO.slice(0, 7)
    const months = monthsBetween(activationMonth, project.end_date)
    return ['hr', 'core'].map((pool) => {
      const pct = pool === 'core' ? (project.core_pct ?? 5) : (project.hr_pct ?? 5)
      return {
        id: uid(),
        pool,
        effectiveFromMonth: activationMonth,
        monthlyRate: pv > 0 ? Math.round(((pv * (pct / 100)) / months) * 100) / 100 : 0,
        reason: 'activation',
        installmentId: null,
        note: null,
        createdBy,
        createdAt: new Date().toISOString(),
      }
    })
  },

  /** 5% (admin_pct) of total project value — credited once, as a lump sum. */
  computeAdminPoolAmount(project) {
    const pv = projectValue(project)
    const pct = project.admin_pct ?? 5
    return Math.round(pv * (pct / 100) * 100) / 100
  },

```

- [ ] **Step 4: Verify it lints and builds**

Run: `cd /home/jojo/labs/git-lab/HMA/hma-template/emsv1 && npm run build && npm run lint -- src/services/localOrgPool.js`
Expected: `npm run build` exits 0. This file has a pre-existing lint baseline of 2 errors (see Global Constraints table) — the scoped lint run should report 2 or fewer, plus it may additionally report `no-unused-vars` for `currentMonth`/`rateForMonth`/`getEffectiveLedger` — that's expected at this point, since Task 3 is what wires them into `getActiveProjectMonthlyBudgets`/`getProjectInstallmentBudgets`. If lint hard-fails the build itself (rather than just reporting the unused-vars warning/error), temporarily reference them with `void rateForMonth, void getEffectiveLedger, void currentMonth` at the bottom of the file and remove that line in Task 3. Do not compare against this repo's full unscoped `npm run lint` — see Global Constraints.

- [ ] **Step 5: Manual verification via browser console**

Run: `cd /home/jojo/labs/git-lab/HMA/hma-template/emsv1 && npm run start`, open the app in a browser, open devtools console, paste:

```js
const mod = await import('/src/services/localOrgPool.js')
const fakeProject = { project_value: 1200000, hr_pct: 5, core_pct: 5, end_date: '2026-10-31' }
console.log(mod.localOrgPool.computeActivationLedgerEntries(fakeProject, '2026-03-15T00:00:00.000Z'))
```

Expected: an array of 2 objects (`pool: 'hr'` and `pool: 'core'`), each with `effectiveFromMonth: '2026-03'` and `monthlyRate` equal to `(1200000 * 0.05) / monthsBetween('2026-03', '2026-10-31')` = `60000 / 8` = `7500`.

- [ ] **Step 6: Commit**

```bash
cd /home/jojo/labs/git-lab/HMA
git add hma-template/emsv1/src/services/localOrgPool.js
git commit -m "feat: add ledger-based rate helpers to localOrgPool"
```

---

## Task 2: Admin lump-sum crediting in `localProjects.js`

**Files:**
- Modify: `hma-template/emsv1/src/services/localOrgPool.js` (add `recordAdminCredit` method + `admin_pool_credits` array support)
- Modify: `hma-template/emsv1/src/services/localProjects.js:628-690` (`create()` and `update()`)

**Interfaces:**
- Consumes: `localOrgPool.computeAdminPoolAmount(project)` from Task 1.
- Produces: `localOrgPool.recordAdminCredit(projectId, amount)` — appends `{id, projectId, amount, createdAt}` to `admin_pool_credits` in the `ORG_POOL_KEY` store. Consumed by Task 7 (Consolidated Sheet admin row) and available for future auditing.
- Produces: on every project object, `admin_pool_credited: boolean`, `admin_pool_amount: number`, `admin_credited_at: string|null`.

- [ ] **Step 1: Add `recordAdminCredit` to `localOrgPool.js`**

In `hma-template/emsv1/src/services/localOrgPool.js`, inside the `localOrgPool` object, add this method right after `getAllCoreExpenses()` (the last method, just before the closing `}`):

```js

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

- [ ] **Step 2: Credit admin on project creation**

Read `hma-template/emsv1/src/services/localProjects.js` around line 628 (the `create(data)` method) to find where the new project object is constructed and where `write(PROJECTS_KEY, ...)` is called. Immediately before the final `write(PROJECTS_KEY, [...projects, project])` (or equivalent) call in `create()`, add:

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

Add the import at the top of `localProjects.js` (it currently only imports `localNotifications` — check line 22): add `import { localOrgPool } from './localOrgPool'` alongside it.

- [ ] **Step 3: Credit admin on first `update()` that sets a real project value**

In the same file, find `update(id, data)` (around line 683). Change it from:

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

Run: `cd /home/jojo/labs/git-lab/HMA/hma-template/emsv1 && npm run build && npm run lint -- src/services/localOrgPool.js src/services/localProjects.js`
Expected: `npm run build` exits 0. Combined pre-existing baseline for these two files is 2 errors (2 in `localOrgPool.js`, 0 in `localProjects.js` — see Global Constraints table); the scoped lint run should report 2 or fewer.

- [ ] **Step 5: Manual verification via browser console**

With the app running (`npm run start`), open devtools console on any page and paste:

```js
const { localProjects } = await import('/src/services/localProjects.js')
const { localOrgPool } = await import('/src/services/localOrgPool.js')
const p = localProjects.create({ name: 'Test Admin Credit', project_value: 1000000, admin_pct: 5, start_date: '2026-01-01', end_date: '2026-10-31' })
console.log(p.admin_pool_credited, p.admin_pool_amount) // expect: true 50000
console.log(localOrgPool.getAdminPoolCredits().find((c) => c.projectId === p.id)) // expect: a record with amount 50000
```

Expected output: `true 50000` and a matching credit record.

- [ ] **Step 6: Commit**

```bash
cd /home/jojo/labs/git-lab/HMA
git add hma-template/emsv1/src/services/localOrgPool.js hma-template/emsv1/src/services/localProjects.js
git commit -m "feat: credit admin pool lump sum at project creation/valuation"
```

---

## Task 3: Ledger-driven `getActiveProjectMonthlyBudgets` and `getProjectInstallmentBudgets`

**Files:**
- Modify: `hma-template/emsv1/src/services/localOrgPool.js:142-337` (both functions, full rewrite of their bodies)

**Interfaces:**
- Consumes: `rateForMonth`, `getEffectiveLedger`, `currentMonth` from Task 1.
- Produces: `getActiveProjectMonthlyBudgets(pool)` — same return shape as before minus `installmentId/installmentLabel/installmentStart/installmentEnd/installmentAmount/instMonths/budgetNotForeseen` fields (set `installmentId: null`, `budgetNotForeseen: false` for shape stability since `computeAllocations` destructures `b.installmentId`), consumed unchanged by `ProjectOverheadsList.jsx`, `ExpenseManagementPage.jsx` `EXPENSE_ROWS`, `computeAllocations`.
- Produces: `getProjectInstallmentBudgets(projectId, pool)` — same shape as before, but `monthList` entries change from bare `'YYYY-MM'` strings to `{ month: 'YYYY-MM', budget: number }` objects. This is a breaking change for its one consumer — fixed in Task 3's Step 4 below (`MonthlyDrillDown` in `ExpenseManagementPage.jsx`).

- [ ] **Step 1: Rewrite `getActiveProjectMonthlyBudgets`**

Replace the entire method (currently lines 142-192, from `getActiveProjectMonthlyBudgets(pool = 'hr') {` through its closing `},`) with:

```js
  getActiveProjectMonthlyBudgets(pool = 'hr') {
    const projects = readProjects().filter(
      (p) =>
        p.is_operations_active &&
        (p.status === 'ongoing' || p.status === 'active' || p.status === 'approved'),
    )

    const month = currentMonth()
    const budgets = projects
      .map((p) => {
        const ledger = getEffectiveLedger(p)
        const monthlyBudget = rateForMonth(ledger, pool, month)
        if (monthlyBudget === null) return null

        const pct = pool === 'core' ? (p.core_pct ?? 5) : (p.hr_pct ?? 5)
        return {
          projectId: p.id,
          projectName: p.title || p.name,
          installmentId: null,
          pct,
          totalProjectMonths: totalProjectMonths(p),
          poolBudget: Math.round(projectValue(p) * (pct / 100) * 100) / 100,
          monthlyBudget,
          budgetNotForeseen: false,
          sharePct: 0, // filled in below
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

- [ ] **Step 2: Rewrite `getProjectInstallmentBudgets`**

Replace the entire method (currently lines 210-337) with:

```js
  getProjectInstallmentBudgets(projectId, pool = 'hr') {
    const projects = readProjects()
    const p = projects.find((pr) => pr.id === projectId)
    if (!p) return []

    const hrPct = p.hr_pct ?? 5
    const corePct = p.core_pct ?? 5
    const pct = pool === 'core' ? corePct : hrPct
    const ledger = getEffectiveLedger(p)
    const installments = p.installments || []

    return installments.map((inst) => {
      const endField = inst.end_date || inst.target_date || ''
      const instMonths = monthsBetween(inst.start_date, endField)
      const startMonth = (inst.start_date || '').slice(0, 7)

      // Rate as of this installment's start month — used for the header summary line.
      const rateAtStart = rateForMonth(ledger, pool, startMonth) ?? 0
      const instPoolBudget = Math.round(rateAtStart * instMonths * 100) / 100

      // Project spend receives the remaining percentage
      const projectPct = 100 - ADMIN_PCT - hrPct - corePct
      const projectBudget = Math.round(inst.amount * (projectPct / 100) * 100) / 100
      const adminBudget = Math.round(inst.amount * (ADMIN_PCT / 100) * 100) / 100

      // Per-calendar-month breakdown — reflects mid-installment rate changes
      // from shortfall withdrawals (Task 5), since each month looks up its
      // own rate instead of repeating one flat installment-wide figure.
      const monthList = []
      if (inst.start_date && endField) {
        let [cy, cm] = inst.start_date.split('-').map(Number)
        const [ey, em] = endField.split('-').map(Number)
        while (cy < ey || (cy === ey && cm <= em)) {
          const ym = `${cy}-${String(cm).padStart(2, '0')}`
          monthList.push({ month: ym, budget: rateForMonth(ledger, pool, ym) ?? 0 })
          cm++
          if (cm > 12) {
            cm = 1
            cy++
          }
        }
      }

      return {
        installmentId: inst.id,
        installmentLabel: inst.label,
        installmentStart: inst.start_date,
        installmentEnd: endField,
        installmentAmount: inst.amount,
        percentage: inst.percentage,
        ucStatus: inst.uc_status,

        instMonths,
        months: instMonths,
        monthList,

        projectBudget,
        adminBudget,
        pct,
        hrPct,
        corePct,
        projectPct,
        adminPct: ADMIN_PCT,

        shortfallTopups: inst.shortfall_topups || [],

        // The old installment-amount-based fallback path is gone (per the design spec,
        // this is intentionally dropped), but `pms/projects/ProjectDetailPage.jsx` still
        // reads `row.budgetNotForeseen` to decide whether to show a warning badge — keep
        // it explicitly `false` here so that check stays a real boolean, not `undefined`.
        budgetNotForeseen: false,

        // Legacy field names kept for the existing UI (header summary line, totals)
        poolBudget: instPoolBudget,
        monthlyBudget: rateAtStart,
      }
    })
  },
```

- [ ] **Step 3: Delete the now-unused `getCurrentInstallment` helper if nothing else calls it**

Run: `grep -rn "getCurrentInstallment" hma-template/emsv1/src/services/localOrgPool.js`
If the only remaining reference is the function definition itself (lines ~73-81), delete that function — it was only used by the two methods just rewritten.

- [ ] **Step 4: Update `MonthlyDrillDown` in `ExpenseManagementPage.jsx` to consume the new `monthList` shape**

In `hma-template/emsv1/src/modules/ems/expense-management/ExpenseManagementPage.jsx`, find this block (around line 317-321):

```js
        installments.map((inst) => {
          const instUsed = inst.monthList.reduce(
            (s, ym) => s + (chargeByMonth[ym] || 0),
            0,
          )
```

Change to:

```js
        installments.map((inst) => {
          const instUsed = inst.monthList.reduce(
            (s, ym) => s + (chargeByMonth[ym.month] || 0),
            0,
          )
```

Then find the per-month card block (around line 360-367):

```js
                    {inst.monthList.map((ym) => {
                      const used = chargeByMonth[ym] || 0
                      const remaining = inst.monthlyBudget - used
                      const pct =
                        inst.monthlyBudget > 0
                          ? Math.min(100, Math.round((used / inst.monthlyBudget) * 100))
                          : 0
                      const over = remaining < 0
```

Change to:

```js
                    {inst.monthList.map((ym) => {
                      const used = chargeByMonth[ym.month] || 0
                      const remaining = ym.budget - used
                      const pct =
                        ym.budget > 0 ? Math.min(100, Math.round((used / ym.budget) * 100)) : 0
                      const over = remaining < 0
```

And within the same `.map`, find every remaining reference to the old bare-string `ym` used as a month label or budget figure — specifically:
- `key={ym}` → `key={ym.month}`
- `{monthLabel(ym)}` → `{monthLabel(ym.month)}`
- `{fmtL(inst.monthlyBudget)}` (inside the per-month card's "Budget" row, around line 407) → `{fmtL(ym.budget)}`

- [ ] **Step 5: Verify it lints and builds**

Run: `cd /home/jojo/labs/git-lab/HMA/hma-template/emsv1 && npm run build && npm run lint -- src/services/localOrgPool.js src/modules/ems/expense-management/ExpenseManagementPage.jsx`
Expected: `npm run build` exits 0. Combined pre-existing baseline for these two files is 40 errors (2 in `localOrgPool.js`, 38 in `ExpenseManagementPage.jsx` — see Global Constraints table); the scoped lint run should report 40 or fewer. Pay attention to any lingering `ym` (bare string) usages a manual `grep -n "ym)" hma-template/emsv1/src/modules/ems/expense-management/ExpenseManagementPage.jsx` might reveal — every `ym` in this component must now be an object.

- [ ] **Step 6: Manual verification via browser console**

With `npm run start` running, navigate to a project that has `is_operations_active: true` and real installments (e.g. seed project `proj_001`), open devtools console:

```js
const { localOrgPool } = await import('/src/services/localOrgPool.js')
const rows = localOrgPool.getProjectInstallmentBudgets('proj_001', 'hr')
console.log(rows[0].monthList[0]) // expect: { month: '2024-03', budget: <number> }
console.log(localOrgPool.getActiveProjectMonthlyBudgets('hr').find((b) => b.projectId === 'proj_001'))
```

Expected: `monthList[0]` is an object with `month`/`budget` keys (not a bare string), and the active-projects lookup returns a budget object with a `monthlyBudget` computed from the legacy-shim ledger (since `proj_001` predates the ledger field and only has `operations_activated_at`).

- [ ] **Step 7: Also navigate the Consolidated Sheet and a project's Overheads page in the browser to visually confirm nothing crashed**

Navigate to `/ems/expenses` (Consolidated Sheet tab) and click into a project's monthly breakdown. Confirm the month cards render with figures (not `NaN` or blank) and no console errors appear.

- [ ] **Step 8: Commit**

```bash
cd /home/jojo/labs/git-lab/HMA
git add hma-template/emsv1/src/services/localOrgPool.js hma-template/emsv1/src/modules/ems/expense-management/ExpenseManagementPage.jsx
git commit -m "refactor: drive HR/Core monthly budgets from rate ledger instead of installment-coupled formula"
```

---

## Task 4: Gate "Activate Project" on task assignment + write the activation ledger entries

**Files:**
- Modify: `hma-template/emsv1/src/services/localProjects.js:692-705` (`activateProject`)
- Modify: `hma-template/emsv1/src/modules/pms/project-associate/ProjectDetailPage.jsx:69-75` (imports), `:641-646` (role checks), `:706-713` (`handleActivateProject`), `:773-798` (button JSX)

**Interfaces:**
- Consumes: `localOrgPool.computeActivationLedgerEntries` from Task 1.
- Consumes: `localTasks.getByProject(projectId)` — already exists (`localTasks.js:73-78`), returns `Array<task>`.
- Produces: `localProjects.activateProject(id, createdBy)` now also writes `project.hr_core_rate_ledger`.

- [ ] **Step 1: Update `activateProject` in `localProjects.js`**

Replace:

```js
  activateProject(id) {
    const projects = read(PROJECTS_KEY)
    const idx = projects.findIndex((p) => p.id === id)
    if (idx === -1) throw new Error('Project not found')
    projects[idx].is_operations_active = true
    projects[idx].operations_activated_at = now()
    if (projects[idx].status === 'pipeline' || projects[idx].status === 'approved') {
      projects[idx].status = 'ongoing'
      projects[idx].phase = 'implementation'
    }
    projects[idx].updated_at = now()
    write(PROJECTS_KEY, projects)
    return projects[idx]
  },
```

with:

```js
  activateProject(id, createdBy = 'system') {
    const projects = read(PROJECTS_KEY)
    const idx = projects.findIndex((p) => p.id === id)
    if (idx === -1) throw new Error('Project not found')
    const activatedAt = now()
    projects[idx].is_operations_active = true
    projects[idx].operations_activated_at = activatedAt
    if (projects[idx].status === 'pipeline' || projects[idx].status === 'approved') {
      projects[idx].status = 'ongoing'
      projects[idx].phase = 'implementation'
    }
    const newEntries = localOrgPool.computeActivationLedgerEntries(
      projects[idx],
      activatedAt,
      createdBy,
    )
    projects[idx].hr_core_rate_ledger = [...(projects[idx].hr_core_rate_ledger || []), ...newEntries]
    projects[idx].updated_at = now()
    write(PROJECTS_KEY, projects)
    return projects[idx]
  },
```

(The `import { localOrgPool } from './localOrgPool'` was already added in Task 2, Step 2 — no new import needed here.)

- [ ] **Step 2: Add `useAuth` import to `ProjectDetailPage.jsx`**

In `hma-template/emsv1/src/modules/pms/project-associate/ProjectDetailPage.jsx`, find line 74 (`import useRole from '../../../hooks/useRole'`) and add right after it:

```js
import useAuth from '../../../hooks/useAuth'
```

- [ ] **Step 3: Add task-count check and wire `useAuth` into the component**

Find lines 641-646:

```js
  const role = useRole()
  const isBudgetAdmin =
    role === ROLE.CEO ||
    role === ROLE.FINANCE ||
    role === ROLE.HR ||
    role === ROLE.PROJECT_COORDINATOR
```

Change to:

```js
  const role = useRole()
  const { user } = useAuth()
  const isBudgetAdmin =
    role === ROLE.CEO ||
    role === ROLE.FINANCE ||
    role === ROLE.HR ||
    role === ROLE.PROJECT_COORDINATOR
  const isProjectCoordinator = role === ROLE.PROJECT_COORDINATOR
  const projectTaskCount = useMemo(
    () => (project ? localTasks.getByProject(project.id).length : 0),
    [project],
  )
```

(`useMemo` is already imported at line 5; `localTasks` is already imported at line 70.)

- [ ] **Step 4: Pass the current user into `handleActivateProject`**

Find lines 706-713:

```js
  const handleActivateProject = () => {
    const updated = localProjects.activateProject(project.id)
    setProject(updated)
    setToast({
      color: 'success',
      message: 'Project operations activated — HR & Core pool contributions are now live',
    })
  }
```

Change to:

```js
  const handleActivateProject = () => {
    const updated = localProjects.activateProject(project.id, user?.full_name || user?.email || 'system')
    setProject(updated)
    setToast({
      color: 'success',
      message: 'Project operations activated — HR & Core pool contributions are now live',
    })
  }
```

- [ ] **Step 5: Gate the button on task existence**

Find lines 773-798 (search for `▶ Activate Project`):

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

Change to:

```js
          {!project.is_operations_active && (
            <CTooltip
              content={
                projectTaskCount === 0
                  ? 'Assign at least one task before activating operations'
                  : 'Start HR & Core pool contributions for this project'
              }
            >
              <span className="d-inline-block">
                <CButton
                  color="success"
                  className="fw-semibold flex-shrink-0"
                  disabled={projectTaskCount === 0}
                  onClick={handleActivateProject}
                >
                  ▶ Activate Project
                </CButton>
              </span>
            </CTooltip>
          )}
```

Check whether `CTooltip` is already imported at the top of the file (search `grep -n "CTooltip" hma-template/emsv1/src/modules/pms/project-associate/ProjectDetailPage.jsx`). If not, add `CTooltip` to the existing `@coreui/react` import block (the multi-line `import { ... } from '@coreui/react'` starting at line 7).

- [ ] **Step 6: Verify it lints and builds**

Run: `cd /home/jojo/labs/git-lab/HMA/hma-template/emsv1 && npm run build && npm run lint -- src/services/localProjects.js src/modules/pms/project-associate/ProjectDetailPage.jsx`
Expected: `npm run build` exits 0. Combined pre-existing baseline for these two files is 56 errors (0 in `localProjects.js`, 56 in `ProjectDetailPage.jsx` — see Global Constraints table); the scoped lint run should report 56 or fewer.

- [ ] **Step 7: Manual verification via browser console + UI**

Console:

```js
const { localProjects } = await import('/src/services/localProjects.js')
const p = localProjects.create({ name: 'Test Activation', project_value: 1200000, hr_pct: 5, core_pct: 5, start_date: '2026-01-01', end_date: '2026-10-31' })
const activated = localProjects.activateProject(p.id, 'Test User')
console.log(activated.hr_core_rate_ledger)
```

Expected: an array of 2 entries (`pool: 'hr'`, `pool: 'core'`), `effectiveFromMonth` equal to today's `'YYYY-MM'`, `createdBy: 'Test User'`.

UI: navigate to `/pms/projects/<new-project-id>` in the browser (log in as a Project Associate/Officer role if the route is gated). Confirm the "Activate Project" button is disabled with the tooltip since no tasks exist yet. Then assign a task to that project via `/pms/daily-reports/tasks`, reload the project detail page, and confirm the button is now enabled.

- [ ] **Step 8: Commit**

```bash
cd /home/jojo/labs/git-lab/HMA
git add hma-template/emsv1/src/services/localProjects.js hma-template/emsv1/src/modules/pms/project-associate/ProjectDetailPage.jsx
git commit -m "feat: gate project activation on task assignment, seed HR/Core ledger on activation"
```

---

## Task 5: Milestone shortfall withdrawal (`withdrawForShortfall`)

**Files:**
- Modify: `hma-template/emsv1/src/services/localOrgPool.js` (new method)
- Modify: `hma-template/emsv1/src/services/localProjects.js` (helper to append `shortfall_topups` onto an installment — reuse existing `updateInstallment`)

**Interfaces:**
- Consumes: `rateForMonth`, `getEffectiveLedger`, `currentMonth`, `monthsBetween` (Task 1/3), `localProjects.getById`, `localProjects.updateInstallment(projectId, installmentId, data)` (existing method, `localProjects.js:709-722`).
- Produces: `localOrgPool.withdrawForShortfall(projectId, installmentId, amount, reason, createdBy)` → throws on invalid input/insufficient balance, otherwise returns `{ hrEntry, coreEntry }` (the two new ledger entries).

- [ ] **Step 1: Add the method to `localOrgPool.js`**

Do **not** import `localProjects` into `localOrgPool.js` — `localProjects.js` already imports `localOrgPool` (from Task 2), so importing it back here would create a circular import. Instead, `withdrawForShortfall` takes the already-loaded `project` object as a parameter (the caller — the UI component in Task 6 — already has it in state) rather than looking it up itself. No new import is needed for this task.

Add this method to the `localOrgPool` object, right after `recordAdminCredit`/`getAdminPoolCredits` (added in Task 2):

```js

  /**
   * Pulls `amount` (split 50/50 between hr and core) from a project's
   * remaining HR/Core pool to cover a milestone shortfall. Reduces the
   * monthly rate for the current month onward only — prior months are
   * untouched since the new ledger entry's effectiveFromMonth is today's
   * month, and rateForMonth always prefers the latest applicable entry.
   *
   * @param {object} project - the full project record (caller already has it loaded)
   * @param {string} installmentId
   * @param {number} amount - total shortfall amount, split 50/50 hr/core
   * @param {string} reason - required, for audit
   * @param {string} createdBy
   * @returns {{ hrEntry: object, coreEntry: object }}
   */
  withdrawForShortfall(project, installmentId, amount, reason, createdBy) {
    if (!amount || amount <= 0) throw new Error('Withdrawal amount must be greater than zero')
    if (!reason?.trim()) throw new Error('A reason is required for a shortfall withdrawal')

    const perPoolAmount = amount / 2
    const month = currentMonth()
    const remainingMonths = monthsBetween(month, project.end_date)
    const ledger = getEffectiveLedger(project)

    const entries = ['hr', 'core'].map((pool) => {
      const currentRate = rateForMonth(ledger, pool, month)
      if (currentRate === null) {
        throw new Error(`Project is not activated for the ${pool.toUpperCase()} pool yet`)
      }
      const remainingPool = currentRate * remainingMonths
      if (perPoolAmount > remainingPool) {
        throw new Error(
          `Insufficient ${pool.toUpperCase()} balance remaining — max withdrawable is ${Math.round(
            remainingPool,
          )} per pool`,
        )
      }
      const newRate = Math.round(((remainingPool - perPoolAmount) / remainingMonths) * 100) / 100
      return {
        id: uid(),
        pool,
        effectiveFromMonth: month,
        monthlyRate: newRate,
        reason: 'milestone_shortfall',
        installmentId,
        note: reason,
        createdBy,
        createdAt: new Date().toISOString(),
      }
    })

    return { hrEntry: entries[0], coreEntry: entries[1] }
  },
```

- [ ] **Step 2: Verify it lints and builds**

Run: `cd /home/jojo/labs/git-lab/HMA/hma-template/emsv1 && npm run build && npm run lint -- src/services/localOrgPool.js`
Expected: `npm run build` exits 0 (this method isn't called from any UI yet — that's Task 6 — but it must not break the build). This file has a pre-existing lint baseline of 2 errors (see Global Constraints table); the scoped lint run should report 2 or fewer.

- [ ] **Step 3: Manual verification via browser console**

```js
const { localOrgPool } = await import('/src/services/localOrgPool.js')
const { localProjects } = await import('/src/services/localProjects.js')

const p = localProjects.create({ name: 'Test Withdrawal', project_value: 1200000, hr_pct: 5, core_pct: 5, start_date: '2026-01-01', end_date: '2026-10-31' })
const activated = localProjects.activateProject(p.id, 'Test User')
// monthlyRate should be 60000/10 = 6000 for hr (assuming activation this month, 10 remaining months)

const result = localOrgPool.withdrawForShortfall(activated, 'inst_fake', 3000, 'Milestone 1 shortfall', 'Coordinator Test')
console.log(result.hrEntry.monthlyRate, result.coreEntry.monthlyRate)
```

Expected: both entries have `monthlyRate` reduced from the base rate — e.g. if base was 6000/month over 10 remaining months (pool 60000), withdrawing 1500 from HR leaves 58500, `/10 = 5850`.

Also verify the guard rails:

```js
try {
  localOrgPool.withdrawForShortfall(activated, 'inst_fake', 999999999, 'too much', 'Coordinator Test')
} catch (e) {
  console.log(e.message) // expect: "Insufficient HR balance remaining — max withdrawable is ..."
}
try {
  localOrgPool.withdrawForShortfall(activated, 'inst_fake', 100, '', 'Coordinator Test')
} catch (e) {
  console.log(e.message) // expect: "A reason is required for a shortfall withdrawal"
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/jojo/labs/git-lab/HMA
git add hma-template/emsv1/src/services/localOrgPool.js
git commit -m "feat: add withdrawForShortfall for milestone shortfall pulls from HR/Core"
```

---

## Task 6: Wire the withdrawal into the Installment Schedule UI (Project Coordinator only)

**Files:**
- Modify: `hma-template/emsv1/src/modules/pms/project-associate/ProjectDetailPage.jsx` (Installment Schedule table, around lines 2071-2192; state near the other modal state around line 626)

**Interfaces:**
- Consumes: `localOrgPool.withdrawForShortfall(project, installmentId, amount, reason, createdBy)` from Task 5; `localProjects.updateInstallment(projectId, installmentId, data)` (existing) to persist `shortfall_topups`; `localProjects.update(projectId, { hr_core_rate_ledger })` (existing generic `update`) to persist the new ledger entries; `isProjectCoordinator` from Task 4.

- [ ] **Step 1: Add modal state**

Near the other modal state declarations (around line 626, where `ucModal` is declared), add:

```js
  const [withdrawModal, setWithdrawModal] = useState({ visible: false, installment: null })
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', reason: '' })
```

- [ ] **Step 2: Add the handler**

Near `handleSubmitUc` (around line 695-704), add:

```js
  const handleWithdrawShortfall = () => {
    const amount = parseFloat(withdrawForm.amount)
    try {
      const { hrEntry, coreEntry } = localOrgPool.withdrawForShortfall(
        project,
        withdrawModal.installment.id,
        amount,
        withdrawForm.reason,
        user?.full_name || user?.email || 'system',
      )
      const updatedLedger = [...(project.hr_core_rate_ledger || []), hrEntry, coreEntry]
      // update() persists the new ledger entries first; updateInstallment() re-reads that
      // freshly-written record and returns the full project object with both changes applied.
      localProjects.update(project.id, { hr_core_rate_ledger: updatedLedger })
      const withUpdatedInstallment = localProjects.updateInstallment(
        project.id,
        withdrawModal.installment.id,
        {
          shortfall_topups: [
            ...(withdrawModal.installment.shortfall_topups || []),
            {
              amount,
              hrAmount: amount / 2,
              coreAmount: amount / 2,
              reason: withdrawForm.reason,
              createdBy: user?.full_name || user?.email || 'system',
              createdAt: new Date().toISOString(),
            },
          ],
        },
      )
      setProject(withUpdatedInstallment)
      setWithdrawModal({ visible: false, installment: null })
      setWithdrawForm({ amount: '', reason: '' })
      setToast({ color: 'success', message: `₹${amount} pulled from HR & Core pools for this milestone` })
    } catch (e) {
      setToast({ color: 'danger', message: e.message })
    }
  }
```

- [ ] **Step 3: Add the action button + modal in the Installment Schedule table**

Find the "Installment" table header row (around line 2094-2101):

```js
                                <CTableRow>
                                  <CTableHeaderCell>Installment</CTableHeaderCell>
                                  <CTableHeaderCell className="text-center">%</CTableHeaderCell>
                                  <CTableHeaderCell className="text-end">Amount</CTableHeaderCell>
                                  <CTableHeaderCell>Period (Start – End/Target)</CTableHeaderCell>
                                  <CTableHeaderCell>Actual Date</CTableHeaderCell>
                                  <CTableHeaderCell className="text-center">
                                    UC Status
                                  </CTableHeaderCell>
                                </CTableRow>
```

Add a column header after `UC Status`, only when the current user is a Project Coordinator:

```js
                                <CTableRow>
                                  <CTableHeaderCell>Installment</CTableHeaderCell>
                                  <CTableHeaderCell className="text-center">%</CTableHeaderCell>
                                  <CTableHeaderCell className="text-end">Amount</CTableHeaderCell>
                                  <CTableHeaderCell>Period (Start – End/Target)</CTableHeaderCell>
                                  <CTableHeaderCell>Actual Date</CTableHeaderCell>
                                  <CTableHeaderCell className="text-center">
                                    UC Status
                                  </CTableHeaderCell>
                                  {isProjectCoordinator && (
                                    <CTableHeaderCell className="text-center">
                                      HR/Core Shortfall
                                    </CTableHeaderCell>
                                  )}
                                </CTableRow>
```

Find the closing `</CTableRow>` for each installment data row (right after the `UC Status` `<CTableDataCell>`, around line 2179-2184):

```js
                                      <CTableDataCell className="text-center">
                                        <CBadge color={UC_COLORS[inst.uc_status] || 'secondary'}>
                                          {inst.uc_status || 'Pending'}
                                        </CBadge>
                                      </CTableDataCell>
                                    </CTableRow>
```

Add a matching data cell:

```js
                                      <CTableDataCell className="text-center">
                                        <CBadge color={UC_COLORS[inst.uc_status] || 'secondary'}>
                                          {inst.uc_status || 'Pending'}
                                        </CBadge>
                                      </CTableDataCell>
                                      {isProjectCoordinator && (
                                        <CTableDataCell className="text-center">
                                          <CButton
                                            size="sm"
                                            color="warning"
                                            variant="ghost"
                                            onClick={() =>
                                              setWithdrawModal({ visible: true, installment: inst })
                                            }
                                          >
                                            Withdraw
                                          </CButton>
                                        </CTableDataCell>
                                      )}
                                    </CTableRow>
```

- [ ] **Step 4: Add the withdrawal modal**

Right after the existing "UC Submission Modal" closing `</CModal>` (search for it — it ends a bit after line 2298 where `handleSubmitUc` is called), add:

```js

      {/* Shortfall Withdrawal Modal */}
      <CModal
        visible={withdrawModal.visible}
        onClose={() => setWithdrawModal({ visible: false, installment: null })}
        alignment="center"
      >
        <CModalHeader>
          <CModalTitle>Withdraw from HR/Core Pool</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p className="small text-body-secondary">
            Pulling from <strong>{withdrawModal.installment?.label}</strong>. Split 50/50 between
            HR and Core, reducing the current month onward only.
          </p>
          <CInputGroup size="sm" className="mb-2">
            <CInputGroupText>₹</CInputGroupText>
            <CFormInput
              type="number"
              min="0"
              placeholder="Amount needed"
              value={withdrawForm.amount}
              onChange={(e) => setWithdrawForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </CInputGroup>
          <CFormInput
            size="sm"
            placeholder="Reason (required)"
            value={withdrawForm.reason}
            onChange={(e) => setWithdrawForm((f) => ({ ...f, reason: e.target.value }))}
          />
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="ghost"
            onClick={() => setWithdrawModal({ visible: false, installment: null })}
          >
            Cancel
          </CButton>
          <CButton color="warning" onClick={handleWithdrawShortfall}>
            Confirm Withdrawal
          </CButton>
        </CModalFooter>
      </CModal>
```

Check that `CInputGroup`, `CInputGroupText`, `CFormInput` are already imported (they are — used elsewhere in this file for the expense-add forms).

- [ ] **Step 5: Verify it lints and builds**

Run: `cd /home/jojo/labs/git-lab/HMA/hma-template/emsv1 && npm run build && npm run lint -- src/modules/pms/project-associate/ProjectDetailPage.jsx`
Expected: `npm run build` exits 0. This file has a pre-existing lint baseline of 56 errors (see Global Constraints table); the scoped lint run should report 56 or fewer.

- [ ] **Step 6: Manual verification in the browser**

Log in as a user with `ROLE.PROJECT_COORDINATOR`. Navigate to an activated project's detail page (`/pms/projects/<id>`), scroll to Installment Schedule. Confirm the "Withdraw" column/button only appears for this role. Click it, enter an amount and reason, confirm. Check the toast message, then reopen the Consolidated Sheet drill-down for the same project and confirm the current month's HR/Core figure dropped while prior months are unchanged.

- [ ] **Step 7: Commit**

```bash
cd /home/jojo/labs/git-lab/HMA
git add hma-template/emsv1/src/modules/pms/project-associate/ProjectDetailPage.jsx
git commit -m "feat: add HR/Core shortfall withdrawal UI for Project Coordinators"
```

---

## Task 7: Admin row on the Consolidated Sheet + locked Admin tile on the project page

**Files:**
- Modify: `hma-template/emsv1/src/modules/ems/expense-management/ExpenseManagementPage.jsx:442-465` (`EXPENSE_ROWS`)
- Modify: `hma-template/emsv1/src/modules/pms/project-associate/ProjectDetailPage.jsx:1958-2043` ("Project Overheads" admin tile + `ExpenseCard`)

**Interfaces:**
- Consumes: `project.admin_pool_amount` (Task 2), `localOrgPool.getAdminPoolCredits()` (Task 2).

- [ ] **Step 1: Add an `admin` row to `EXPENSE_ROWS`**

In `ExpenseManagementPage.jsx`, the `EXPENSE_ROWS` array currently has `hr` and `core` entries (lines 442-465). The `ConsolidatedSheet` component builds its project list from `hrBudgets`/`coreBudgets` (`localOrgPool.getActiveProjectMonthlyBudgets`), which doesn't cover Admin (Admin isn't a monthly figure). Add a third row that reads the lump sum directly off the project record instead of off `budgets`:

```js
  {
    key: 'admin',
    label: 'Admin Expenses',
    pctKey: 'admin_pct',
    color: 'warning',
    getValue: (proj) => proj.adminPoolAmount ?? 0,
    getUsed: () => 0, // admin charges tracked separately via localAdminExpenses / project.admin_expenses
  },
```

Insert it as the third entry, after the existing `core` row.

- [ ] **Step 2: Feed `adminPoolAmount` into the `projects` list the table renders**

Find the `ConsolidatedSheet` component's `useEffect` (around line 473-496), specifically where `projs` is built from `hrBudgets`/`coreBudgets`:

```js
    const projMap = {}
    ;[...hrBudgets, ...coreBudgets].forEach((b) => {
      if (!projMap[b.projectId]) projMap[b.projectId] = b
    })
    const projs = Object.values(projMap)
```

Change to also merge in each project's `admin_pool_amount` by looking up the full project record:

```js
    const projMap = {}
    ;[...hrBudgets, ...coreBudgets].forEach((b) => {
      if (!projMap[b.projectId]) projMap[b.projectId] = b
    })
    const projs = Object.values(projMap).map((p) => ({
      ...p,
      adminPoolAmount: localProjects.getById(p.projectId)?.admin_pool_amount ?? 0,
    }))
```

(`localProjects` is already imported at line 41 of this file.)

- [ ] **Step 3: Lock the Admin tile on the project detail page**

In `ProjectDetailPage.jsx` (project-associate), find the admin/hr/core tile loop (around lines 1962-2014):

```js
                          {[
                            { key: 'admin_pct', color: '#f7c948', label: 'Admin' },
                            { key: 'hr_pct', color: '#4361ee', label: 'HR' },
                            { key: 'core_pct', color: '#f72585', label: 'Core' },
                          ].map(({ key, color, label }) => {
                            const pct = project[key] ?? 5
                            const budgetAmt =
                              (project.project_valuation || project.project_value || 0) *
                              (pct / 100)
                            return (
```

Change the `budgetAmt` line so the Admin tile reads the locked lump sum instead of recomputing it live:

```js
                          {[
                            { key: 'admin_pct', color: '#f7c948', label: 'Admin' },
                            { key: 'hr_pct', color: '#4361ee', label: 'HR' },
                            { key: 'core_pct', color: '#f72585', label: 'Core' },
                          ].map(({ key, color, label }) => {
                            const pct = project[key] ?? 5
                            const budgetAmt =
                              key === 'admin_pct'
                                ? project.admin_pool_amount ?? 0
                                : (project.project_valuation || project.project_value || 0) *
                                  (pct / 100)
                            return (
```

- [ ] **Step 4: Use the locked amount in the `ExpenseCard` budget prop too**

Find the `ExpenseCard title="🏛 Admin Expenses"` block (around lines 2028-2041):

```js
                                <ExpenseCard
                                  title="🏛 Admin Expenses"
                                  color="warning"
                                  budget={
                                    (project.project_valuation || project.project_value || 0) *
                                    ((project.admin_pct ?? 5) / 100)
                                  }
```

Change `budget` to:

```js
                                <ExpenseCard
                                  title="🏛 Admin Expenses"
                                  color="warning"
                                  budget={project.admin_pool_amount ?? 0}
```

- [ ] **Step 5: Verify it lints and builds**

Run: `cd /home/jojo/labs/git-lab/HMA/hma-template/emsv1 && npm run build && npm run lint -- src/modules/ems/expense-management/ExpenseManagementPage.jsx src/modules/pms/project-associate/ProjectDetailPage.jsx`
Expected: `npm run build` exits 0. Combined pre-existing baseline for these two files is 94 errors (38 in `ExpenseManagementPage.jsx`, 56 in `ProjectDetailPage.jsx` — see Global Constraints table); the scoped lint run should report 94 or fewer.

- [ ] **Step 6: Manual verification in the browser**

Navigate to `/ems/expenses` → Consolidated Sheet tab. Confirm a third "Admin Expenses" row appears alongside HR/Core, showing each active project's locked lump sum. Navigate to a project detail page's "Project Overheads" section and confirm the Admin tile now shows the same locked figure regardless of what `admin_pct` is edited to afterward.

- [ ] **Step 7: Commit**

```bash
cd /home/jojo/labs/git-lab/HMA
git add hma-template/emsv1/src/modules/ems/expense-management/ExpenseManagementPage.jsx hma-template/emsv1/src/modules/pms/project-associate/ProjectDetailPage.jsx
git commit -m "feat: show locked admin pool lump sum on consolidated sheet and project overheads"
```

---

## Task 8: Fix `ProjectOverheadsList.jsx` crash (`localProjects.getAll()` doesn't exist)

**Files:**
- Modify: `hma-template/emsv1/src/modules/ems/projects/ProjectOverheadsList.jsx:26-30`

**Interfaces:**
- Consumes: `localProjects.list({})` (existing method, `localProjects.js:587-609`) → `{ items, total, total_pages }`.

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

Run: `cd /home/jojo/labs/git-lab/HMA/hma-template/emsv1 && npm run build && npm run lint -- src/modules/ems/projects/ProjectOverheadsList.jsx`
Expected: `npm run build` exits 0. This file has a pre-existing lint baseline of 1 error (see Global Constraints table); the scoped lint run should report 1 or fewer.

- [ ] **Step 3: Manual verification in the browser**

Navigate to `/ems/projects/overheads` (or wherever `ProjectOverheadsList` is routed — check `grep -rn "ProjectOverheadsList" hma-template/emsv1/src/routes/` if unsure). Confirm the page loads without a console error and lists active projects with their HR/Core monthly figures.

- [ ] **Step 4: Commit**

```bash
cd /home/jojo/labs/git-lab/HMA
git add hma-template/emsv1/src/modules/ems/projects/ProjectOverheadsList.jsx
git commit -m "fix: ProjectOverheadsList crash from calling nonexistent localProjects.getAll()"
```
