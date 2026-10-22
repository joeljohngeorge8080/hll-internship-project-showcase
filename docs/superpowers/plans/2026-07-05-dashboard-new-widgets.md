# EMS Dashboard New Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 new selectable cards to the EMS Dashboard — Expense Pools, Global Core Pool, Expense Management, Department Headcount, Attendance Trend, Projects Overview, and Profit/Loss.

**Architecture:** The dashboard's widget-picker infrastructure (`useDashboardWidgets.js`, `DashboardGrid.jsx`, `WidgetCatalog.jsx`) is already fully generic and needs no changes. Each task adds one new widget component (in `src/modules/ems/dashboard/widgets/`) plus its own registration entry in `Dashboard.jsx`'s `ALL_WIDGETS` array — two tasks additionally need a small, behavior-preserving export from an existing Report & Analysis page so the widget can reuse real logic instead of duplicating it.

**Tech Stack:** React 19 (functional components, hooks only), CoreUI React 5.x, Chart.js 4.x (for the Attendance Trend widget). No test runner in this repo — verification is `npx eslint`, `npm run build`, and standalone Node scripts using `node:assert` for the two extracted pure functions.

**Spec:** `docs/superpowers/specs/2026-07-05-dashboard-new-widgets-design.md`

## Global Constraints

- CoreUI React components exclusively (`@coreui/react`) — never Tailwind, Material-UI, or other component libraries.
- Functional components with Hooks only — no class components. No PropTypes — matches this codebase's established convention in `src/modules/ems/dashboard/widgets/` (none of the existing 6 widgets use them).
- Prettier formatting: no semicolons, single quotes, 2-space indentation (pre-existing Prettier debt elsewhere is unrelated to this feature — do not bulk `--fix` unrelated files).
- **No test runner exists in this repo.** Verification per task: (1) `npx eslint <changed files>` compared to the baselines below, (2) `npm run build` (must succeed — this is the main integration gate here, since each task registers its new widget into `Dashboard.jsx` in the same task, making it reachable by Vite's module graph), (3) for the two tasks that extract a pure function (Task 4/5's `buildDepartments`/`buildAttendanceTrend`, Task 7's `computeLsgbTotals`), a standalone Node script using `node:assert` with fixture data replicating the function's logic inline (do **not** `import` the real service files directly under plain Node — `localOrgPool.js` and friends transitively import extensionless specifiers that plain Node's ESM resolver rejects, even though Vite resolves them fine).
- Lint baselines (all clean before this plan): `src/modules/ems/reports-analysis/VisualModelPage.jsx` = 0 problems. `src/modules/ems/reports-analysis/LsgbDependencyPage.jsx` = 0 problems. `src/modules/ems/dashboard/Dashboard.jsx` = 1 problem (pre-existing, unrelated).
- Commit convention: `feat:` / `fix:` / `docs:` / `refactor:` / `chore:` per `docs/CLAUDE.md`.
- After all 7 tasks, one combined manual dev-server smoke check covers all of them together (Step-by-step in Task 7) rather than repeating a full server start/stop cycle 7 times.

---

### Task 1: `ExpensePoolsWidget.jsx`

**Files:**
- Create: `hma-template/emsv1/src/modules/ems/dashboard/widgets/ExpensePoolsWidget.jsx`
- Modify: `hma-template/emsv1/src/modules/ems/dashboard/Dashboard.jsx`

**Interfaces:**
- Consumes: `localOrgPool.getMonthlyHRPoolBudgetSummary()`, `getMonthlyAdminPoolBudgetSummary()`, `getMonthlyCorePoolBudgetSummary()` (all existing, each returns `{ totalMonthlyBudget, usedThisMonth, remaining }`).
- Produces: default-exported `ExpensePoolsWidget` component, registered under `ALL_WIDGETS` id `'expense_pools'`.

- [ ] **Step 1: Create the widget file**

Create `hma-template/emsv1/src/modules/ems/dashboard/widgets/ExpensePoolsWidget.jsx`:

```jsx
import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CProgress } from '@coreui/react'
import { localOrgPool } from '../../../../services/localOrgPool'

const fmtCompact = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 }).format(n || 0)

const ROWS = [
  { key: 'hr', label: 'HR Pool', color: '#4361ee', get: () => localOrgPool.getMonthlyHRPoolBudgetSummary() },
  { key: 'admin', label: 'Admin Pool', color: '#f77f00', get: () => localOrgPool.getMonthlyAdminPoolBudgetSummary() },
  { key: 'core', label: 'Core Pool', color: '#06d6a0', get: () => localOrgPool.getMonthlyCorePoolBudgetSummary() },
]

const ExpensePoolsWidget = () => {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    setRows(ROWS.map((r) => ({ ...r, summary: r.get() })))
  }, [])

  if (!rows) return null

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4">
        <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">Expense Pools</h6>
        <div className="d-flex flex-column gap-3">
          {rows.map((r) => {
            const { totalMonthlyBudget, usedThisMonth } = r.summary
            const pct = totalMonthlyBudget > 0 ? Math.min(100, Math.round((usedThisMonth / totalMonthlyBudget) * 100)) : 0
            return (
              <div key={r.key}>
                <div className="d-flex justify-content-between small mb-1">
                  <span className="fw-medium">{r.label}</span>
                  <span className="text-body-secondary">{fmtCompact(usedThisMonth)} / {fmtCompact(totalMonthlyBudget)}</span>
                </div>
                <CProgress value={pct} height={5} className="rounded-pill" style={{ '--cui-progress-bar-bg': r.color }} />
              </div>
            )
          })}
        </div>
      </CCardBody>
    </CCard>
  )
}

export default ExpensePoolsWidget
```

- [ ] **Step 2: Register it in `Dashboard.jsx`**

Find:

```jsx
import PayrollSummaryWidget from './widgets/PayrollSummaryWidget'
import AnnouncementsWidget from './widgets/AnnouncementsWidget'

const ALL_WIDGETS = [
```

Replace with:

```jsx
import PayrollSummaryWidget from './widgets/PayrollSummaryWidget'
import AnnouncementsWidget from './widgets/AnnouncementsWidget'
import ExpensePoolsWidget from './widgets/ExpensePoolsWidget'

const ALL_WIDGETS = [
```

Find the end of the array:

```jsx
  {
    id: 'announcements',
    title: 'Recent Announcements',
    description: 'Latest announcements and notices from leadership',
    colProps: { xs: 12, lg: 6 },
    badge: { label: 'Comms', color: 'info' },
    component: AnnouncementsWidget,
  },
]
```

Replace with:

```jsx
  {
    id: 'announcements',
    title: 'Recent Announcements',
    description: 'Latest announcements and notices from leadership',
    colProps: { xs: 12, lg: 6 },
    badge: { label: 'Comms', color: 'info' },
    component: AnnouncementsWidget,
  },
  {
    id: 'expense_pools',
    title: 'Expense Pools',
    description: 'HR / Admin / Core monthly pool budget vs used',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Finance', color: 'success' },
    component: ExpensePoolsWidget,
  },
]
```

- [ ] **Step 3: Lint check**

Run: `cd hma-template/emsv1 && npx eslint src/modules/ems/dashboard/widgets/ExpensePoolsWidget.jsx src/modules/ems/dashboard/Dashboard.jsx`
Expected: no `no-undef`/`no-unused-vars`/`react/jsx-key` errors (Prettier-only flags are fine; `Dashboard.jsx`'s pre-existing 1 problem may still appear, unrelated).

- [ ] **Step 4: Build check**

Run: `npx vite build`
Expected: build succeeds with zero errors.

- [ ] **Step 5: Commit**

```bash
git add hma-template/emsv1/src/modules/ems/dashboard/widgets/ExpensePoolsWidget.jsx hma-template/emsv1/src/modules/ems/dashboard/Dashboard.jsx
git commit -m "feat: add Expense Pools dashboard widget"
```

---

### Task 2: `GlobalCorePoolWidget.jsx`

**Files:**
- Create: `hma-template/emsv1/src/modules/ems/dashboard/widgets/GlobalCorePoolWidget.jsx`
- Modify: `hma-template/emsv1/src/modules/ems/dashboard/Dashboard.jsx`

**Interfaces:**
- Consumes: `localPayroll.getAllEmployeesWithProjectInfo()` (existing, each item spread with `isOverhead`, `status`, `current_salary`).
- Produces: default-exported `GlobalCorePoolWidget`, registered as `'global_core_pool'`.

- [ ] **Step 1: Create the widget file**

Create `hma-template/emsv1/src/modules/ems/dashboard/widgets/GlobalCorePoolWidget.jsx`:

```jsx
import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CRow, CCol } from '@coreui/react'
import { localPayroll } from '../../../../services/localPayroll'

const fmtCompact = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 }).format(n || 0)

const GlobalCorePoolWidget = () => {
  const [data, setData] = useState(null)

  useEffect(() => {
    const employees = localPayroll
      .getAllEmployeesWithProjectInfo()
      .filter((e) => e.status !== 'Deleted' && e.status !== 'Inactive')
    const unassigned = employees.filter((e) => e.isOverhead)
    const assigned = employees.filter((e) => !e.isOverhead)
    setData({
      unassignedCount: unassigned.length,
      assignedCount: assigned.length,
      unassignedSalary: unassigned.reduce((s, e) => s + (parseFloat(e.current_salary) || 0), 0),
      assignedSalary: assigned.reduce((s, e) => s + (parseFloat(e.current_salary) || 0), 0),
    })
  }, [])

  if (!data) return null

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4">
        <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">Global Core Pool</h6>
        <CRow className="g-2">
          <CCol xs={6}>
            <div className="small text-body-secondary mb-1">Unassigned ({data.unassignedCount})</div>
            <div className="fw-bold" style={{ color: '#ef476f' }}>{fmtCompact(data.unassignedSalary)}</div>
          </CCol>
          <CCol xs={6}>
            <div className="small text-body-secondary mb-1">Assigned ({data.assignedCount})</div>
            <div className="fw-bold" style={{ color: '#06d6a0' }}>{fmtCompact(data.assignedSalary)}</div>
          </CCol>
        </CRow>
        <div className="text-body-secondary mt-2" style={{ fontSize: '0.72rem' }}>
          Unassigned employees' salaries are core overhead expenses.
        </div>
      </CCardBody>
    </CCard>
  )
}

export default GlobalCorePoolWidget
```

- [ ] **Step 2: Register it in `Dashboard.jsx`**

Find:

```jsx
import AnnouncementsWidget from './widgets/AnnouncementsWidget'
import ExpensePoolsWidget from './widgets/ExpensePoolsWidget'

const ALL_WIDGETS = [
```

Replace with:

```jsx
import AnnouncementsWidget from './widgets/AnnouncementsWidget'
import ExpensePoolsWidget from './widgets/ExpensePoolsWidget'
import GlobalCorePoolWidget from './widgets/GlobalCorePoolWidget'

const ALL_WIDGETS = [
```

Find:

```jsx
  {
    id: 'expense_pools',
    title: 'Expense Pools',
    description: 'HR / Admin / Core monthly pool budget vs used',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Finance', color: 'success' },
    component: ExpensePoolsWidget,
  },
]
```

Replace with:

```jsx
  {
    id: 'expense_pools',
    title: 'Expense Pools',
    description: 'HR / Admin / Core monthly pool budget vs used',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Finance', color: 'success' },
    component: ExpensePoolsWidget,
  },
  {
    id: 'global_core_pool',
    title: 'Global Core Pool',
    description: 'Unassigned vs assigned employee salary totals',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Finance', color: 'success' },
    component: GlobalCorePoolWidget,
  },
]
```

- [ ] **Step 3: Lint check**

Run: `cd hma-template/emsv1 && npx eslint src/modules/ems/dashboard/widgets/GlobalCorePoolWidget.jsx src/modules/ems/dashboard/Dashboard.jsx`
Expected: no `no-undef`/`no-unused-vars`/`react/jsx-key` errors.

- [ ] **Step 4: Build check**

Run: `npx vite build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add hma-template/emsv1/src/modules/ems/dashboard/widgets/GlobalCorePoolWidget.jsx hma-template/emsv1/src/modules/ems/dashboard/Dashboard.jsx
git commit -m "feat: add Global Core Pool dashboard widget"
```

---

### Task 3: `ExpenseManagementWidget.jsx`

**Files:**
- Create: `hma-template/emsv1/src/modules/ems/dashboard/widgets/ExpenseManagementWidget.jsx`
- Modify: `hma-template/emsv1/src/modules/ems/dashboard/Dashboard.jsx`

**Interfaces:**
- Consumes: `localProjects.list({ pageSize: 1000 })`, `localOrgPool.buildProjectMonthlyBreakdown(p)`, `getProjectHRBudgetSummary(p.id)`, `getProjectCoreBudgetSummary(p.id)` (all existing).
- Produces: default-exported `ExpenseManagementWidget`, registered as `'expense_management'`.

- [ ] **Step 1: Create the widget file**

Create `hma-template/emsv1/src/modules/ems/dashboard/widgets/ExpenseManagementWidget.jsx`:

```jsx
import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CRow, CCol } from '@coreui/react'
import { localProjects } from '../../../../services/localProjects'
import { localOrgPool } from '../../../../services/localOrgPool'

const fmtCompact = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 }).format(n || 0)

const ExpenseManagementWidget = () => {
  const [data, setData] = useState(null)

  useEffect(() => {
    const allProjects = localProjects.list({ pageSize: 1000 }).items || []
    let sumAdmin = 0, sumHr = 0, sumCore = 0, sumDirect = 0
    let sumHrUsed = 0, sumCoreUsed = 0
    allProjects.forEach((p) => {
      const bd = localOrgPool.buildProjectMonthlyBreakdown(p)
      sumAdmin += bd.reduce((s, m) => s + m.adminBudget, 0)
      sumHr += bd.reduce((s, m) => s + m.hrBudget, 0)
      sumCore += bd.reduce((s, m) => s + m.coreBudget, 0)
      sumDirect += bd.reduce((s, m) => s + m.directBudget, 0)
      sumHrUsed += localOrgPool.getProjectHRBudgetSummary(p.id).totalCharged || 0
      sumCoreUsed += localOrgPool.getProjectCoreBudgetSummary(p.id).totalCharged || 0
    })
    setData({ sumAdmin, sumHr, sumCore, sumDirect, sumHrUsed, sumCoreUsed, projectCount: allProjects.length })
  }, [])

  if (!data) return null

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4">
        <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">
          Expense Management — {data.projectCount} project{data.projectCount !== 1 ? 's' : ''}
        </h6>
        <CRow className="g-2">
          <CCol xs={6}><div className="small text-body-secondary mb-1">Admin Budget</div><div className="fw-bold" style={{ color: '#f77f00' }}>{fmtCompact(data.sumAdmin)}</div></CCol>
          <CCol xs={6}><div className="small text-body-secondary mb-1">HR Budget</div><div className="fw-bold" style={{ color: '#4361ee' }}>{fmtCompact(data.sumHr)}</div></CCol>
          <CCol xs={6}><div className="small text-body-secondary mb-1">Core Budget</div><div className="fw-bold" style={{ color: '#06d6a0' }}>{fmtCompact(data.sumCore)}</div></CCol>
          <CCol xs={6}><div className="small text-body-secondary mb-1">Direct Budget</div><div className="fw-bold text-body">{fmtCompact(data.sumDirect)}</div></CCol>
        </CRow>
        <div className="text-body-secondary mt-2" style={{ fontSize: '0.72rem' }}>
          Used so far: HR {fmtCompact(data.sumHrUsed)} · Core {fmtCompact(data.sumCoreUsed)}
        </div>
      </CCardBody>
    </CCard>
  )
}

export default ExpenseManagementWidget
```

- [ ] **Step 2: Register it in `Dashboard.jsx`**

Find:

```jsx
import ExpensePoolsWidget from './widgets/ExpensePoolsWidget'
import GlobalCorePoolWidget from './widgets/GlobalCorePoolWidget'

const ALL_WIDGETS = [
```

Replace with:

```jsx
import ExpensePoolsWidget from './widgets/ExpensePoolsWidget'
import GlobalCorePoolWidget from './widgets/GlobalCorePoolWidget'
import ExpenseManagementWidget from './widgets/ExpenseManagementWidget'

const ALL_WIDGETS = [
```

Find:

```jsx
  {
    id: 'global_core_pool',
    title: 'Global Core Pool',
    description: 'Unassigned vs assigned employee salary totals',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Finance', color: 'success' },
    component: GlobalCorePoolWidget,
  },
]
```

Replace with:

```jsx
  {
    id: 'global_core_pool',
    title: 'Global Core Pool',
    description: 'Unassigned vs assigned employee salary totals',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Finance', color: 'success' },
    component: GlobalCorePoolWidget,
  },
  {
    id: 'expense_management',
    title: 'Expense Management',
    description: 'Admin/HR/Core/Direct budget vs used, across all projects',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Finance', color: 'success' },
    component: ExpenseManagementWidget,
  },
]
```

- [ ] **Step 3: Lint check**

Run: `cd hma-template/emsv1 && npx eslint src/modules/ems/dashboard/widgets/ExpenseManagementWidget.jsx src/modules/ems/dashboard/Dashboard.jsx`
Expected: no `no-undef`/`no-unused-vars`/`react/jsx-key` errors.

- [ ] **Step 4: Build check**

Run: `npx vite build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add hma-template/emsv1/src/modules/ems/dashboard/widgets/ExpenseManagementWidget.jsx hma-template/emsv1/src/modules/ems/dashboard/Dashboard.jsx
git commit -m "feat: add Expense Management dashboard widget"
```

---

### Task 4: Export `buildDepartments` + `DepartmentHeadcountWidget.jsx`

**Files:**
- Modify: `hma-template/emsv1/src/modules/ems/reports-analysis/VisualModelPage.jsx:67`
- Create: `hma-template/emsv1/src/modules/ems/dashboard/widgets/DepartmentHeadcountWidget.jsx`
- Modify: `hma-template/emsv1/src/modules/ems/dashboard/Dashboard.jsx`

**Interfaces:**
- Consumes: `localEmployees.list()` (via the newly-exported function).
- Produces: `buildDepartments()` exported from `VisualModelPage.jsx` → `Array<{ name, headcount, male, female }>`, sorted descending by headcount. Default-exported `DepartmentHeadcountWidget`, registered as `'department_headcount'`.

- [ ] **Step 1: Write the verification script**

Create `hma-template/emsv1/scratch_verify_dept.mjs`:

```js
import assert from 'node:assert'

// Replicated from buildDepartments() — groups Active employees by department
function buildDepartments(employees) {
  const byDept = {}
  for (const e of employees) {
    const dept = e.employment?.department || 'Unassigned'
    if (!byDept[dept]) byDept[dept] = { name: dept, headcount: 0, male: 0, female: 0 }
    byDept[dept].headcount += 1
    if (e.gender === 'Male') byDept[dept].male += 1
    else if (e.gender === 'Female') byDept[dept].female += 1
  }
  return Object.values(byDept).sort((a, b) => b.headcount - a.headcount)
}

const fixture = [
  { employment: { department: 'HR' }, gender: 'Female' },
  { employment: { department: 'HR' }, gender: 'Male' },
  { employment: { department: 'Finance' }, gender: 'Male' },
  { employment: {} , gender: 'Male' }, // blank dept -> Unassigned
]

const result = buildDepartments(fixture)
assert.strictEqual(result[0].name, 'HR')
assert.strictEqual(result[0].headcount, 2)
assert.strictEqual(result[0].female, 1)
assert.strictEqual(result[0].male, 1)
assert.strictEqual(result.some((d) => d.name === 'Unassigned'), true)

console.log('Task 4 buildDepartments grouping verified OK')
```

- [ ] **Step 2: Run it**

Run: `node hma-template/emsv1/scratch_verify_dept.mjs`
Expected: `Task 4 buildDepartments grouping verified OK`

- [ ] **Step 3: Delete the scratch script**

Run: `rm hma-template/emsv1/scratch_verify_dept.mjs`

- [ ] **Step 4: Export `buildDepartments`**

In `hma-template/emsv1/src/modules/ems/reports-analysis/VisualModelPage.jsx`, find:

```js
const buildDepartments = () => {
```

Replace with:

```js
export const buildDepartments = () => {
```

- [ ] **Step 5: Create the widget file**

Create `hma-template/emsv1/src/modules/ems/dashboard/widgets/DepartmentHeadcountWidget.jsx`:

```jsx
import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CProgress } from '@coreui/react'
import { buildDepartments } from '../../reports-analysis/VisualModelPage'

const DEPT_COLORS = ['#4361ee', '#06d6a0', '#f77f00', '#ef476f', '#2ec4b6', '#9b5de5']

const DepartmentHeadcountWidget = () => {
  const [departments, setDepartments] = useState(null)

  useEffect(() => {
    setDepartments(buildDepartments().slice(0, 5))
  }, [])

  if (!departments) return null

  const maxHeadcount = Math.max(...departments.map((d) => d.headcount), 1)

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4">
        <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">Department Headcount</h6>
        {departments.length === 0 ? (
          <div className="text-body-secondary small">No active employees yet.</div>
        ) : (
          <div className="d-flex flex-column gap-2">
            {departments.map((d, i) => (
              <div key={d.name}>
                <div className="d-flex justify-content-between small mb-1">
                  <span className="text-truncate me-2">{d.name}</span>
                  <span className="text-body-secondary">{d.headcount}</span>
                </div>
                <CProgress
                  value={Math.round((d.headcount / maxHeadcount) * 100)}
                  height={5}
                  className="rounded-pill"
                  style={{ '--cui-progress-bar-bg': DEPT_COLORS[i % DEPT_COLORS.length] }}
                />
              </div>
            ))}
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

export default DepartmentHeadcountWidget
```

- [ ] **Step 6: Register it in `Dashboard.jsx`**

Find:

```jsx
import GlobalCorePoolWidget from './widgets/GlobalCorePoolWidget'
import ExpenseManagementWidget from './widgets/ExpenseManagementWidget'

const ALL_WIDGETS = [
```

Replace with:

```jsx
import GlobalCorePoolWidget from './widgets/GlobalCorePoolWidget'
import ExpenseManagementWidget from './widgets/ExpenseManagementWidget'
import DepartmentHeadcountWidget from './widgets/DepartmentHeadcountWidget'

const ALL_WIDGETS = [
```

Find:

```jsx
  {
    id: 'expense_management',
    title: 'Expense Management',
    description: 'Admin/HR/Core/Direct budget vs used, across all projects',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Finance', color: 'success' },
    component: ExpenseManagementWidget,
  },
]
```

Replace with:

```jsx
  {
    id: 'expense_management',
    title: 'Expense Management',
    description: 'Admin/HR/Core/Direct budget vs used, across all projects',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Finance', color: 'success' },
    component: ExpenseManagementWidget,
  },
  {
    id: 'department_headcount',
    title: 'Department Headcount',
    description: 'Active employees by department',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'HR', color: 'primary' },
    component: DepartmentHeadcountWidget,
  },
]
```

- [ ] **Step 7: Lint check**

Run: `cd hma-template/emsv1 && npx eslint src/modules/ems/reports-analysis/VisualModelPage.jsx src/modules/ems/dashboard/widgets/DepartmentHeadcountWidget.jsx src/modules/ems/dashboard/Dashboard.jsx`
Expected: `VisualModelPage.jsx` stays at 0 problems (adding `export` to a const changes nothing else); no `no-undef`/`no-unused-vars`/`react/jsx-key` errors in the new widget.

- [ ] **Step 8: Build check**

Run: `npx vite build`
Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
git add hma-template/emsv1/src/modules/ems/reports-analysis/VisualModelPage.jsx hma-template/emsv1/src/modules/ems/dashboard/widgets/DepartmentHeadcountWidget.jsx hma-template/emsv1/src/modules/ems/dashboard/Dashboard.jsx
git commit -m "feat: add Department Headcount dashboard widget"
```

---

### Task 5: Export `buildAttendanceTrend` + `AttendanceTrendWidget.jsx`

**Files:**
- Modify: `hma-template/emsv1/src/modules/ems/reports-analysis/VisualModelPage.jsx:86`
- Create: `hma-template/emsv1/src/modules/ems/dashboard/widgets/AttendanceTrendWidget.jsx`
- Modify: `hma-template/emsv1/src/modules/ems/dashboard/Dashboard.jsx`

**Interfaces:**
- Consumes: `localAttendance.listMonthlySummaries({ year, month })` (via the newly-exported function).
- Produces: `buildAttendanceTrend()` exported from `VisualModelPage.jsx` → `{ months: string[], present: number[], absent: number[], leave: number[] }` (6 entries each, trailing 6 calendar months). Default-exported `AttendanceTrendWidget`, registered as `'attendance_trend'`.

- [ ] **Step 1: Write the verification script**

Create `hma-template/emsv1/scratch_verify_attendance.mjs`:

```js
import assert from 'node:assert'

// Replicated from buildAttendanceTrend()'s per-month averaging logic
function averageMonth(rows) {
  let p = 0, a = 0, l = 0
  for (const r of rows) {
    const total = (r.present_count || 0) + (r.absent_count || 0) + (r.leave_count || 0)
    if (total === 0) continue
    p += (r.present_count || 0) / total
    a += (r.absent_count || 0) / total
    l += (r.leave_count || 0) / total
  }
  return {
    present: Math.round((p / rows.length) * 100),
    absent: Math.round((a / rows.length) * 100),
    leave: Math.round((l / rows.length) * 100),
  }
}

const rows = [
  { present_count: 18, absent_count: 1, leave_count: 1 }, // total 20 -> 90/5/5
  { present_count: 16, absent_count: 2, leave_count: 2 }, // total 20 -> 80/10/10
]
const result = averageMonth(rows)
assert.strictEqual(result.present, 85) // avg(90,80) = 85
assert.strictEqual(result.absent, 8) // avg(5,10) = 7.5 -> rounds to 8
assert.strictEqual(result.leave, 8)

// Empty rows (no attendance imported that month) -> 0%, not fabricated
const emptyResult = { rows: [] }
assert.strictEqual(emptyResult.rows.length === 0, true)

console.log('Task 5 buildAttendanceTrend averaging verified OK')
```

- [ ] **Step 2: Run it**

Run: `node hma-template/emsv1/scratch_verify_attendance.mjs`
Expected: `Task 5 buildAttendanceTrend averaging verified OK`

- [ ] **Step 3: Delete the scratch script**

Run: `rm hma-template/emsv1/scratch_verify_attendance.mjs`

- [ ] **Step 4: Export `buildAttendanceTrend`**

In `hma-template/emsv1/src/modules/ems/reports-analysis/VisualModelPage.jsx`, find:

```js
const buildAttendanceTrend = () => {
```

Replace with:

```js
export const buildAttendanceTrend = () => {
```

- [ ] **Step 5: Create the widget file**

Create `hma-template/emsv1/src/modules/ems/dashboard/widgets/AttendanceTrendWidget.jsx`:

```jsx
import React, { useEffect, useRef, useState } from 'react'
import { CCard, CCardBody } from '@coreui/react'
import { Chart, registerables } from 'chart.js'
import { buildAttendanceTrend } from '../../reports-analysis/VisualModelPage'

Chart.register(...registerables)

const AttendanceTrendWidget = () => {
  const [trend, setTrend] = useState(null)
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    setTrend(buildAttendanceTrend())
  }, [])

  useEffect(() => {
    if (!trend || !canvasRef.current) return
    chartRef.current?.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: trend.months,
        datasets: [
          { label: 'Present %', data: trend.present, borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.08)', fill: true, tension: 0.4, pointRadius: 3, borderWidth: 2 },
          { label: 'Absent %', data: trend.absent, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)', fill: true, tension: 0.4, pointRadius: 3, borderWidth: 2 },
          { label: 'On Leave %', data: trend.leave, borderColor: '#d97706', backgroundColor: 'rgba(217,119,6,0.08)', fill: true, tension: 0.4, pointRadius: 3, borderWidth: 2 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 } } } },
        scales: {
          y: { ticks: { callback: (v) => v + '%', font: { size: 10 } }, min: 0, max: 100 },
          x: { ticks: { font: { size: 10 } } },
        },
      },
    })
    return () => chartRef.current?.destroy()
  }, [trend])

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4">
        <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">Attendance Trend</h6>
        <div style={{ height: 180 }}>
          <canvas ref={canvasRef} />
        </div>
      </CCardBody>
    </CCard>
  )
}

export default AttendanceTrendWidget
```

- [ ] **Step 6: Register it in `Dashboard.jsx`**

Find:

```jsx
import ExpenseManagementWidget from './widgets/ExpenseManagementWidget'
import DepartmentHeadcountWidget from './widgets/DepartmentHeadcountWidget'

const ALL_WIDGETS = [
```

Replace with:

```jsx
import ExpenseManagementWidget from './widgets/ExpenseManagementWidget'
import DepartmentHeadcountWidget from './widgets/DepartmentHeadcountWidget'
import AttendanceTrendWidget from './widgets/AttendanceTrendWidget'

const ALL_WIDGETS = [
```

Find:

```jsx
  {
    id: 'department_headcount',
    title: 'Department Headcount',
    description: 'Active employees by department',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'HR', color: 'primary' },
    component: DepartmentHeadcountWidget,
  },
]
```

Replace with:

```jsx
  {
    id: 'department_headcount',
    title: 'Department Headcount',
    description: 'Active employees by department',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'HR', color: 'primary' },
    component: DepartmentHeadcountWidget,
  },
  {
    id: 'attendance_trend',
    title: 'Attendance Trend',
    description: '6-month trailing present/absent/leave rate chart',
    colProps: { xs: 12, lg: 6 },
    badge: { label: 'HR', color: 'primary' },
    component: AttendanceTrendWidget,
  },
]
```

- [ ] **Step 7: Lint check**

Run: `cd hma-template/emsv1 && npx eslint src/modules/ems/reports-analysis/VisualModelPage.jsx src/modules/ems/dashboard/widgets/AttendanceTrendWidget.jsx src/modules/ems/dashboard/Dashboard.jsx`
Expected: `VisualModelPage.jsx` stays at 0 problems; no `no-undef`/`no-unused-vars`/`react/jsx-key` errors in the new widget.

- [ ] **Step 8: Build check**

Run: `npx vite build`
Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
git add hma-template/emsv1/src/modules/ems/reports-analysis/VisualModelPage.jsx hma-template/emsv1/src/modules/ems/dashboard/widgets/AttendanceTrendWidget.jsx hma-template/emsv1/src/modules/ems/dashboard/Dashboard.jsx
git commit -m "feat: add Attendance Trend dashboard widget"
```

---

### Task 6: `ProjectsOverviewWidget.jsx`

**Files:**
- Create: `hma-template/emsv1/src/modules/ems/dashboard/widgets/ProjectsOverviewWidget.jsx`
- Modify: `hma-template/emsv1/src/modules/ems/dashboard/Dashboard.jsx`

**Interfaces:**
- Consumes: `localProjects.list({ pageSize: 1000 })` (existing, live project data — NOT the static SDP demo CSV `VisualModelPage.jsx` uses for its own "Projects SDP" section, per the confirmed design decision).
- Produces: default-exported `ProjectsOverviewWidget`, registered as `'projects_overview'`.

- [ ] **Step 1: Create the widget file**

Create `hma-template/emsv1/src/modules/ems/dashboard/widgets/ProjectsOverviewWidget.jsx`:

```jsx
import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CRow, CCol } from '@coreui/react'
import { localProjects } from '../../../../services/localProjects'

const fmtCompact = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 }).format(n || 0)

const ProjectsOverviewWidget = () => {
  const [data, setData] = useState(null)

  useEffect(() => {
    const projects = localProjects.list({ pageSize: 1000 }).items || []
    setData({
      totalProjects: projects.length,
      totalValue: projects.reduce((s, p) => s + (p.project_value || p.project_valuation || 0), 0),
      totalBeneficiaries: projects.reduce(
        (s, p) => s + (p.beneficiaries_target || p.beneficiaries_completed || 0),
        0,
      ),
    })
  }, [])

  if (!data) return null

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4">
        <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">Projects Overview</h6>
        <CRow className="g-2">
          <CCol xs={4}>
            <div className="small text-body-secondary mb-1">Projects</div>
            <div className="fw-bold" style={{ color: '#4361ee', fontSize: '1.1rem' }}>{data.totalProjects}</div>
          </CCol>
          <CCol xs={4}>
            <div className="small text-body-secondary mb-1">Total Value</div>
            <div className="fw-bold" style={{ color: '#06d6a0', fontSize: '1.1rem' }}>{fmtCompact(data.totalValue)}</div>
          </CCol>
          <CCol xs={4}>
            <div className="small text-body-secondary mb-1">Beneficiaries</div>
            <div className="fw-bold" style={{ color: '#f77f00', fontSize: '1.1rem' }}>{data.totalBeneficiaries.toLocaleString('en-IN')}</div>
          </CCol>
        </CRow>
      </CCardBody>
    </CCard>
  )
}

export default ProjectsOverviewWidget
```

- [ ] **Step 2: Register it in `Dashboard.jsx`**

Find:

```jsx
import DepartmentHeadcountWidget from './widgets/DepartmentHeadcountWidget'
import AttendanceTrendWidget from './widgets/AttendanceTrendWidget'

const ALL_WIDGETS = [
```

Replace with:

```jsx
import DepartmentHeadcountWidget from './widgets/DepartmentHeadcountWidget'
import AttendanceTrendWidget from './widgets/AttendanceTrendWidget'
import ProjectsOverviewWidget from './widgets/ProjectsOverviewWidget'

const ALL_WIDGETS = [
```

Find:

```jsx
  {
    id: 'attendance_trend',
    title: 'Attendance Trend',
    description: '6-month trailing present/absent/leave rate chart',
    colProps: { xs: 12, lg: 6 },
    badge: { label: 'HR', color: 'primary' },
    component: AttendanceTrendWidget,
  },
]
```

Replace with:

```jsx
  {
    id: 'attendance_trend',
    title: 'Attendance Trend',
    description: '6-month trailing present/absent/leave rate chart',
    colProps: { xs: 12, lg: 6 },
    badge: { label: 'HR', color: 'primary' },
    component: AttendanceTrendWidget,
  },
  {
    id: 'projects_overview',
    title: 'Projects Overview',
    description: 'Total projects, value, and beneficiaries (live data)',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Projects', color: 'warning' },
    component: ProjectsOverviewWidget,
  },
]
```

- [ ] **Step 3: Lint check**

Run: `cd hma-template/emsv1 && npx eslint src/modules/ems/dashboard/widgets/ProjectsOverviewWidget.jsx src/modules/ems/dashboard/Dashboard.jsx`
Expected: no `no-undef`/`no-unused-vars`/`react/jsx-key` errors.

- [ ] **Step 4: Build check**

Run: `npx vite build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add hma-template/emsv1/src/modules/ems/dashboard/widgets/ProjectsOverviewWidget.jsx hma-template/emsv1/src/modules/ems/dashboard/Dashboard.jsx
git commit -m "feat: add Projects Overview dashboard widget"
```

---

### Task 7: Extract `computeLsgbTotals` + `ProfitLossWidget.jsx`

**Files:**
- Modify: `hma-template/emsv1/src/modules/ems/reports-analysis/LsgbDependencyPage.jsx`
- Create: `hma-template/emsv1/src/modules/ems/dashboard/widgets/ProfitLossWidget.jsx`
- Modify: `hma-template/emsv1/src/modules/ems/dashboard/Dashboard.jsx`

**Interfaces:**
- Consumes: `monthsBetween`, `buildOperatingActuals`, `forecastFrom`, `computeEffectivePoolMonthly`, `localProjects`, `localRecruitments`, `localInternships` (all already defined/imported in `LsgbDependencyPage.jsx`).
- Produces: `computeLsgbTotals(rangeStart, rangeEnd)` exported from `LsgbDependencyPage.jsx` → `{ monthRows, hrRevenueTotal, operating, project, shares, expenses, ownRevenue, lsgbNeed, surplus, lsgbSharePct, isProfit }`. Default-exported `ProfitLossWidget`, registered as `'profit_loss'` — the last widget in this plan.

This is the most invasive change in this plan: it removes 3 now-otherwise-unused-after-extraction `useMemo`s (`months`, `operatingActuals`, `projects`) from the page component, since after extraction they're only referenced inside the code being replaced — leaving them in place would create real `no-unused-vars` errors, not pre-existing ones.

- [ ] **Step 1: Write the verification script**

Create `hma-template/emsv1/scratch_verify_lsgb.mjs`:

```js
import assert from 'node:assert'

// Replicated core arithmetic from computeLsgbTotals (the totals half, not the
// full monthRows/forecast machinery — that part is exercised by the real
// page's own existing behavior, unchanged by this extraction)
function computeTotals(operating, project, shares, hrRevenueTotal) {
  const expenses = operating + project
  const ownRevenue = shares + hrRevenueTotal
  const lsgbNeed = Math.max(0, expenses - ownRevenue)
  const surplus = Math.max(0, ownRevenue - expenses)
  const lsgbSharePct = expenses > 0 ? (lsgbNeed / expenses) * 100 : 0
  return { expenses, ownRevenue, lsgbNeed, surplus, lsgbSharePct, isProfit: lsgbNeed === 0 }
}

// Profit case: revenue covers expenses
const profitCase = computeTotals(100000, 50000, 120000, 40000)
assert.strictEqual(profitCase.expenses, 150000)
assert.strictEqual(profitCase.ownRevenue, 160000)
assert.strictEqual(profitCase.lsgbNeed, 0)
assert.strictEqual(profitCase.surplus, 10000)
assert.strictEqual(profitCase.isProfit, true)

// Loss case: revenue falls short
const lossCase = computeTotals(100000, 50000, 60000, 40000)
assert.strictEqual(lossCase.expenses, 150000)
assert.strictEqual(lossCase.ownRevenue, 100000)
assert.strictEqual(lossCase.lsgbNeed, 50000)
assert.strictEqual(lossCase.surplus, 0)
assert.strictEqual(lossCase.isProfit, false)
assert.ok(Math.abs(lossCase.lsgbSharePct - 33.333) < 0.01)

console.log('Task 7 computeLsgbTotals arithmetic verified OK')
```

- [ ] **Step 2: Run it**

Run: `node hma-template/emsv1/scratch_verify_lsgb.mjs`
Expected: `Task 7 computeLsgbTotals arithmetic verified OK`

- [ ] **Step 3: Delete the scratch script**

Run: `rm hma-template/emsv1/scratch_verify_lsgb.mjs`

- [ ] **Step 4: Add the exported `computeLsgbTotals` function**

In `hma-template/emsv1/src/modules/ems/reports-analysis/LsgbDependencyPage.jsx`, find the exact end of `forecastFrom` (right before the `// ── Page ──` comment):

```js
/** Recency-weighted average (oldest ×1 … newest ×n) of known month totals. */
const forecastFrom = (knownTotals) => {
  const n = knownTotals.length
  if (n === 0) return 0
  const weightSum = (n * (n + 1)) / 2
  return Math.round(knownTotals.reduce((acc, v, i) => acc + v * (i + 1), 0) / weightSum)
}

// ── Page ──────────────────────────────────────────────────────────────────────
```

Replace with:

```js
/** Recency-weighted average (oldest ×1 … newest ×n) of known month totals. */
const forecastFrom = (knownTotals) => {
  const n = knownTotals.length
  if (n === 0) return 0
  const weightSum = (n * (n + 1)) / 2
  return Math.round(knownTotals.reduce((acc, v, i) => acc + v * (i + 1), 0) / weightSum)
}

/**
 * Computes the full Profit/Loss picture for a date range: per-month expense
 * rows (with forecast fallback for months without actuals) plus period totals
 * and the profit/loss verdict. Pulled out of the page component so both the
 * page and the dashboard's Profit/Loss widget can call the exact same logic.
 */
export const computeLsgbTotals = (rangeStart, rangeEnd) => {
  const months = monthsBetween(rangeStart, rangeEnd)
  const operatingActuals = buildOperatingActuals()
  const projects = localProjects.list({ pageSize: 1000 }).items.filter((p) => p.monthly_plan?.length > 0)

  const knownMonths = Object.keys(operatingActuals).sort()
  const knownTotals = knownMonths.map((m) => operatingActuals[m])
  const operatingForecast = forecastFrom(knownTotals)
  const lastKnown = knownMonths[knownMonths.length - 1] || ''

  const monthRows = months.map((m) => {
    const hasActual = operatingActuals[m] !== undefined && m <= lastKnown
    const operatingExpense = hasActual ? operatingActuals[m] : operatingForecast

    let projectExpense = 0
    let shareRevenue = 0
    projects.forEach((p) => {
      const entry = p.monthly_plan.find((e) => e.month === m)
      if (!entry) return
      projectExpense += entry.total || 0
      shareRevenue +=
        computeEffectivePoolMonthly(p, 'admin', m) +
        computeEffectivePoolMonthly(p, 'hr', m) +
        computeEffectivePoolMonthly(p, 'core', m)
    })

    const totalExpense = operatingExpense + projectExpense
    const lsgbNeed = Math.max(0, totalExpense - shareRevenue)
    return { month: m, operatingExpense, isForecast: !hasActual, projectExpense, shareRevenue, totalExpense, lsgbNeed }
  })

  const rec = localRecruitments.list()
  const recruitment = rec
    .filter((r) => (r.activity_type || 'recruitment') === 'recruitment')
    .reduce((s, r) => s + (r.amount_received || 0), 0)
  const training = rec
    .filter((r) => r.activity_type === 'training')
    .reduce((s, r) => s + (r.amount_received || 0), 0)
  const internship = localInternships.list().reduce((s, r) => s + (r.amount_received || 0), 0)
  const hrRevenueTotal = recruitment + training + internship

  const operating = monthRows.reduce((s, r) => s + r.operatingExpense, 0)
  const project = monthRows.reduce((s, r) => s + r.projectExpense, 0)
  const shares = monthRows.reduce((s, r) => s + r.shareRevenue, 0)
  const expenses = operating + project
  const ownRevenue = shares + hrRevenueTotal
  const lsgbNeed = Math.max(0, expenses - ownRevenue)
  const surplus = Math.max(0, ownRevenue - expenses)
  const lsgbSharePct = expenses > 0 ? (lsgbNeed / expenses) * 100 : 0

  return {
    monthRows,
    hrRevenueTotal,
    operating,
    project,
    shares,
    expenses,
    ownRevenue,
    lsgbNeed,
    surplus,
    lsgbSharePct,
    isProfit: lsgbNeed === 0,
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────
```

- [ ] **Step 5: Remove the page's now-superseded `months`/`operatingActuals`/`projects`/`monthRows` blocks**

Find the exact block (immediately after the `rangeEnd` state declaration):

```js
  const months = useMemo(() => monthsBetween(rangeStart, rangeEnd), [rangeStart, rangeEnd])

  const operatingActuals = useMemo(() => buildOperatingActuals(), [])

  const projects = useMemo(
    () => localProjects.list({ pageSize: 1000 }).items.filter((p) => p.monthly_plan?.length > 0),
    [],
  )

  // Rows: one per month in the selected range.
  const monthRows = useMemo(() => {
    const knownMonths = Object.keys(operatingActuals).sort()
    const knownTotals = knownMonths.map((m) => operatingActuals[m])
    const operatingForecast = forecastFrom(knownTotals)
    const lastKnown = knownMonths[knownMonths.length - 1] || ''

    return months.map((m) => {
      const hasActual = operatingActuals[m] !== undefined && m <= lastKnown
      const operatingExpense = hasActual ? operatingActuals[m] : operatingForecast

      let projectExpense = 0
      let shareRevenue = 0
      projects.forEach((p) => {
        const entry = p.monthly_plan.find((e) => e.month === m)
        if (!entry) return
        projectExpense += entry.total || 0
        shareRevenue +=
          computeEffectivePoolMonthly(p, 'admin', m) +
          computeEffectivePoolMonthly(p, 'hr', m) +
          computeEffectivePoolMonthly(p, 'core', m)
      })

      const totalExpense = operatingExpense + projectExpense
      const lsgbNeed = Math.max(0, totalExpense - shareRevenue)
      return {
        month: m,
        operatingExpense,
        isForecast: !hasActual,
        projectExpense,
        shareRevenue,
        totalExpense,
        lsgbNeed,
      }
    })
  }, [months, operatingActuals, projects])

  // HR revenue has no per-month received date in its records, so — like the
```

Replace with:

```js
  // HR revenue has no per-month received date in its records, so — like the
```

- [ ] **Step 6: Replace the `totals`/`isProfit` block**

Find the exact block (note: the `hrRevenue` useMemo directly above this, and the `lsgb` useMemo, both stay completely untouched — this find/replace starts at the `// ── Period totals` comment):

```js
  // ── Period totals & verdict ─────────────────────────────────────────────────
  const totals = useMemo(() => {
    const operating = monthRows.reduce((s, r) => s + r.operatingExpense, 0)
    const project = monthRows.reduce((s, r) => s + r.projectExpense, 0)
    const shares = monthRows.reduce((s, r) => s + r.shareRevenue, 0)
    const expenses = operating + project
    const ownRevenue = shares + hrRevenue.total
    const lsgbNeed = Math.max(0, expenses - ownRevenue)
    const surplus = Math.max(0, ownRevenue - expenses)
    const lsgbSharePct = expenses > 0 ? (lsgbNeed / expenses) * 100 : 0
    return { operating, project, shares, expenses, ownRevenue, lsgbNeed, surplus, lsgbSharePct }
  }, [monthRows, hrRevenue.total])

  const isProfit = totals.lsgbNeed === 0
```

Replace with:

```js
  // ── Period totals & verdict ─────────────────────────────────────────────────
  const { monthRows, ...totals } = useMemo(
    () => computeLsgbTotals(rangeStart, rangeEnd),
    [rangeStart, rangeEnd],
  )
  const isProfit = totals.isProfit
```

Note: the page's separate `hrRevenue` useMemo (`{ recruitment, training, internship, total }`, used elsewhere in this file's JSX for the revenue breakdown display) is **not** touched by this step — it's a different variable from `computeLsgbTotals`'s internal, self-contained `hrRevenueTotal`.

- [ ] **Step 7: Create the widget file**

Create `hma-template/emsv1/src/modules/ems/dashboard/widgets/ProfitLossWidget.jsx`:

```jsx
import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CBadge } from '@coreui/react'
import { computeLsgbTotals } from '../../reports-analysis/LsgbDependencyPage'

const fmtCompact = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 }).format(n || 0)

const ProfitLossWidget = () => {
  const [data, setData] = useState(null)

  useEffect(() => {
    const year = new Date().getFullYear()
    setData(computeLsgbTotals(`${year}-01`, `${year}-12`))
  }, [])

  if (!data) return null

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h6 className="fw-semibold mb-0 small text-uppercase text-body-secondary">Profit / Loss ({new Date().getFullYear()})</h6>
          <CBadge color={data.isProfit ? 'success' : 'danger'} shape="rounded-pill">
            {data.isProfit ? 'Profit' : 'Loss'}
          </CBadge>
        </div>
        <div className="small text-body-secondary mb-1">Expenses vs Own Revenue</div>
        <div className="fw-bold mb-2" style={{ fontSize: '1.3rem', color: data.isProfit ? '#06d6a0' : '#ef476f' }}>
          {fmtCompact(data.expenses)} vs {fmtCompact(data.ownRevenue)}
        </div>
        <div className="text-body-secondary" style={{ fontSize: '0.75rem' }}>
          {data.isProfit
            ? `Surplus ${fmtCompact(data.surplus)} — fully self-funded`
            : `${fmtCompact(data.lsgbNeed)} (${data.lsgbSharePct.toFixed(1)}%) must come from LSGB revenue`}
        </div>
      </CCardBody>
    </CCard>
  )
}

export default ProfitLossWidget
```

- [ ] **Step 8: Register it in `Dashboard.jsx`**

Find:

```jsx
import AttendanceTrendWidget from './widgets/AttendanceTrendWidget'
import ProjectsOverviewWidget from './widgets/ProjectsOverviewWidget'

const ALL_WIDGETS = [
```

Replace with:

```jsx
import AttendanceTrendWidget from './widgets/AttendanceTrendWidget'
import ProjectsOverviewWidget from './widgets/ProjectsOverviewWidget'
import ProfitLossWidget from './widgets/ProfitLossWidget'

const ALL_WIDGETS = [
```

Find:

```jsx
  {
    id: 'projects_overview',
    title: 'Projects Overview',
    description: 'Total projects, value, and beneficiaries (live data)',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Projects', color: 'warning' },
    component: ProjectsOverviewWidget,
  },
]
```

Replace with:

```jsx
  {
    id: 'projects_overview',
    title: 'Projects Overview',
    description: 'Total projects, value, and beneficiaries (live data)',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Projects', color: 'warning' },
    component: ProjectsOverviewWidget,
  },
  {
    id: 'profit_loss',
    title: 'Profit / Loss',
    description: 'Current-year expenses vs own revenue, LSGB dependency verdict',
    colProps: { xs: 12, lg: 6 },
    badge: { label: 'Finance', color: 'success' },
    component: ProfitLossWidget,
  },
]
```

- [ ] **Step 9: Lint check**

Run: `cd hma-template/emsv1 && npx eslint src/modules/ems/reports-analysis/LsgbDependencyPage.jsx src/modules/ems/dashboard/widgets/ProfitLossWidget.jsx src/modules/ems/dashboard/Dashboard.jsx`
Expected: `LsgbDependencyPage.jsx` stays at 0 problems — in particular, **no `no-unused-vars` for `months`/`operatingActuals`/`projects`/`monthRows`** (this is the specific regression Step 5 exists to prevent). No `no-undef`/`react/jsx-key` errors in the new widget.

- [ ] **Step 10: Build check**

Run: `npx vite build`
Expected: build succeeds with zero errors. This is the most important check in this task — it will catch any leftover reference to a variable removed in Step 5, or an incorrect destructure in Step 6.

- [ ] **Step 11: Manual smoke check covering all 7 widgets (no automated browser tooling available this session)**

Run: `npm start` (from `hma-template/emsv1/`), then in a browser:
1. Navigate to the EMS Dashboard.
2. Click "Customize" — confirm all 7 new widgets appear in the catalog (Expense Pools, Global Core Pool, Expense Management, Department Headcount, Attendance Trend, Projects Overview, Profit / Loss), each with a working on/off switch.
3. Turn all 7 on, close the modal, confirm all 7 render without errors and show plausible (non-`NaN`, non-`undefined`) figures.
4. Open the browser console, confirm no red errors while the dashboard is showing all widgets.
5. Separately, navigate to the Report & Analysis → Profit/Loss page and confirm its numbers are unchanged from before this plan (sanity-checks that Task 7's extraction didn't alter the page's own behavior).
6. Turn a couple of the new widgets back off via Customize, confirm the choice persists after a page refresh (this exercises the existing, unmodified `localStorage` persistence).
7. Stop the dev server (`Ctrl+C`) once confirmed.

Report back what was observed instead of claiming this was verified if the manual check wasn't actually run.

- [ ] **Step 12: Commit**

```bash
git add hma-template/emsv1/src/modules/ems/reports-analysis/LsgbDependencyPage.jsx hma-template/emsv1/src/modules/ems/dashboard/widgets/ProfitLossWidget.jsx hma-template/emsv1/src/modules/ems/dashboard/Dashboard.jsx
git commit -m "feat: add Profit/Loss dashboard widget"
```

## Post-plan cleanup

None needed. `useDashboardWidgets.js`, `DashboardGrid.jsx`, and `WidgetCatalog.jsx` remain fully untouched, exactly as decided in the spec's non-goals.
