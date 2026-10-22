# Project Actual-Spend Tracking (Admin Pool) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect real, HR-logged Admin-pool spending to a specific activated project, surfacing it in a new PMS "Actual Spend" section and in the existing Budget & Payroll Admin Expenses card — while leaving HR/Core actuals and the existing org-wide vendor ledger untouched.

**Architecture:** A new project-scoped ledger service (`localProjectExpenses.js`) is the single source of truth for "real money spent." A new EMS tab ("Project Expenses") lets HR log entries against it, gated to projects that are already activated (`is_operations_active === true`). PMS reads the same ledger in two places: a new `ActualSpendPanel` in the Monthly Plan tab (planned vs actual, read-only) and an additive merge into the existing Admin Expenses card in Budget & Payroll.

**Tech Stack:** React 19 + Vite, CoreUI React, plain JS service modules backed by `localStorage`. No test framework, no working browser in this environment — verification is `npm run build` + scoped `npm run lint -- <file>` + Node-traced manual verification for the pure/impure service logic, and careful manual JSX review for UI.

**Design reference:** `docs/superpowers/specs/2026-07-02-project-actual-spend-tracking-design.md` — read it for full rationale.

## Global Constraints

- **Scope boundary:** this plan touches only the new `localProjectExpenses.js`, a new `ProjectExpensesPage.jsx` + one tab addition in `ExpenseManagementPage.jsx`, a new `ActualSpendPanel` in `MonthlyPlanPanel.jsx`, and the `ExpenseCard`/Admin-card assembly in `ProjectDetailPage.jsx`. `localAdminExpenses.js` (the org-wide vendor ledger), `localOrgPool.js`, `monthlyApportionment.js`, and `localProjects.js` are **not modified** — every value this plan needs from them (`computeFlatMonthlyRate`, `computeEffectivePoolMonthly`, `monthsInRange`, `localProjects.list`) already exists.
- **Admin pool only, this round.** The ledger's `pool` field accepts `'admin'|'hr'|'core'` so the data model doesn't need reshaping later, but only `'admin'` is exposed in any UI. HR/Core options render disabled ("coming soon"), never hidden.
- **Gating:** a project is only visible in the new EMS tab, and only contributes to the Budget & Payroll merge, once `project.is_operations_active === true` (set by the existing `localProjects.activateProject()`, unchanged). Projects still in planning never appear.
- **"None" before any entry exists:** a project with zero logged entries must show `0`/"None" for actual admin spend everywhere — never a fabricated non-zero default.
- **No test framework, no working browser** — every task's verification is `npm run build` + scoped `npm run lint -- <file>` + a Node-traced manual check (in-memory `localStorage` polyfill for the new service) or manual JSX review for UI.
- **Lint baselines** (measured on a clean checkout before this plan's tasks run — do not exceed; fine if a count decreases):

  | File | Baseline |
  |---|---|
  | `src/services/localProjectExpenses.js` (new) | 0 |
  | `src/modules/ems/expense-management/ProjectExpensesPage.jsx` (new) | 0 |
  | `src/modules/ems/expense-management/ExpenseManagementPage.jsx` | 38 |
  | `src/modules/pms/project-associate/MonthlyPlanPanel.jsx` | 0 |
  | `src/modules/pms/project-associate/ProjectDetailPage.jsx` | 56 |

  `npm run build` currently passes clean and must continue to after every task.
- Money values always rounded with `Math.round(x * 100) / 100`. Month strings always `'YYYY-MM'`.
- Follow each file's existing style exactly (no semicolons, single quotes, 2-space indent, functional components with hooks, PropTypes on every new component).
- Run all commands from `/home/jojo/labs/git-lab/HMA/hma-template/emsv1`.

---

## Task 1: `localProjectExpenses.js` — new project-scoped expense ledger

**Files:**
- Create: `src/services/localProjectExpenses.js`

**Interfaces:**
- Produces: `localProjectExpenses.list({ projectId, pool, month } = {})` → `Array<Entry>`, all filters optional. `Entry = { id, project_id, pool, month, amount, label, createdBy, createdAt }`. Consumed by Task 2 (`ProjectExpensesPage.jsx`), Task 3 (`ActualSpendPanel`), Task 4 (`ProjectDetailPage.jsx` Admin card merge).
- Produces: `localProjectExpenses.create({ project_id, pool, month, amount, label, createdBy })` → `Entry`. Throws `Error` with a human-readable message on invalid input. Consumed by Task 2.
- Produces: `localProjectExpenses.remove(id)` → `void`. Throws `Error('Expense entry not found')` if `id` doesn't exist. Consumed by Task 2.
- Produces: `localProjectExpenses.sumForMonth(projectId, pool, month)` → `number`, rounded to 2 decimals. Not directly consumed by later tasks (they use `list()` and sum client-side to also get per-entry detail), but is part of this task's required surface per the design spec — include it.

- [ ] **Step 1: Write the service**

```js
// src/services/localProjectExpenses.js
/**
 * Local store for per-project actual expense entries. Distinct from
 * localAdminExpenses.js (the org-wide vendor-contract ledger) — these
 * entries are tied to one specific project via project_id, and feed the
 * PMS "Actual Spend" section and the Budget & Payroll Admin Expenses card.
 * Only pool: 'admin' is exposed in the UI so far; 'hr'/'core' are accepted
 * by the shape as a provision for later.
 */

const KEY = 'hma_project_expenses'

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `pexp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}
const write = (data) => localStorage.setItem(KEY, JSON.stringify(data))

const VALID_POOLS = ['admin', 'hr', 'core']

export const localProjectExpenses = {
  list({ projectId = '', pool = '', month = '' } = {}) {
    let rows = read()
    if (projectId) rows = rows.filter((r) => r.project_id === projectId)
    if (pool) rows = rows.filter((r) => r.pool === pool)
    if (month) rows = rows.filter((r) => r.month === month)
    return rows
  },

  create({ project_id, pool, month, amount, label, createdBy }) {
    if (!project_id) throw new Error('A project is required.')
    if (!VALID_POOLS.includes(pool)) throw new Error('Pool must be admin, hr, or core.')
    if (!month) throw new Error('A month is required.')
    const amt = parseFloat(amount) || 0
    if (amt <= 0) throw new Error('Amount must be greater than zero.')
    if (!label || !label.trim()) throw new Error('A label is required.')

    const rows = read()
    const row = {
      id: uid(),
      project_id,
      pool,
      month,
      amount: amt,
      label: label.trim(),
      createdBy: createdBy || 'Unknown',
      createdAt: new Date().toISOString(),
    }
    write([...rows, row])
    return row
  },

  remove(id) {
    const rows = read()
    if (!rows.find((r) => r.id === id)) throw new Error('Expense entry not found')
    write(rows.filter((r) => r.id !== id))
  },

  sumForMonth(projectId, pool, month) {
    return (
      Math.round(
        read()
          .filter((r) => r.project_id === projectId && r.pool === pool && r.month === month)
          .reduce((s, r) => s + (r.amount || 0), 0) * 100,
      ) / 100
    )
  },
}
```

- [ ] **Step 2: Verify it lints clean**

Run: `npm run lint -- src/services/localProjectExpenses.js`
Expected: 0 errors (this is a brand-new file — hold to strict standard).

- [ ] **Step 3: Verify behavior with a Node scratch script**

Create a scratch file (not committed) at
`/tmp/claude-1000/-home-jojo-labs-git-lab-HMA/d4d85282-9c9f-4114-857d-f117e0519726/scratchpad/verify-project-expenses.mjs`:

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
globalThis.crypto = { randomUUID: () => `id-${Math.random().toString(36).slice(2)}` }

const { localProjectExpenses } = await import(
  '/home/jojo/labs/git-lab/HMA/hma-template/emsv1/src/services/localProjectExpenses.js'
)

const assert = (cond, msg) => {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`OK: ${msg}`)
}

// Starts empty
assert(localProjectExpenses.list({ projectId: 'p1' }).length === 0, 'no entries initially')
assert(localProjectExpenses.sumForMonth('p1', 'admin', '2026-07') === 0, 'sumForMonth is 0 with no entries')

// Create validates
try {
  localProjectExpenses.create({ project_id: 'p1', pool: 'admin', month: '2026-07', amount: 0, label: 'x' })
  throw new Error('should have thrown on amount <= 0')
} catch (e) {
  assert(e.message.includes('greater than zero'), 'rejects zero amount')
}
try {
  localProjectExpenses.create({ project_id: 'p1', pool: 'bogus', month: '2026-07', amount: 100, label: 'x' })
  throw new Error('should have thrown on invalid pool')
} catch (e) {
  assert(e.message.includes('admin, hr, or core'), 'rejects invalid pool')
}
try {
  localProjectExpenses.create({ project_id: 'p1', pool: 'admin', month: '2026-07', amount: 100, label: '  ' })
  throw new Error('should have thrown on blank label')
} catch (e) {
  assert(e.message.includes('label is required'), 'rejects blank label')
}

// Create + list + sumForMonth
const e1 = localProjectExpenses.create({
  project_id: 'p1', pool: 'admin', month: '2026-07', amount: 5000, label: 'Printer paper', createdBy: 'HR User',
})
localProjectExpenses.create({
  project_id: 'p1', pool: 'admin', month: '2026-07', amount: 2500, label: 'Courier', createdBy: 'HR User',
})
localProjectExpenses.create({
  project_id: 'p1', pool: 'admin', month: '2026-08', amount: 1000, label: 'Next month', createdBy: 'HR User',
})
localProjectExpenses.create({
  project_id: 'p2', pool: 'admin', month: '2026-07', amount: 9999, label: 'Different project', createdBy: 'HR User',
})

assert(localProjectExpenses.list({ projectId: 'p1' }).length === 3, 'p1 has 3 entries total')
assert(localProjectExpenses.list({ projectId: 'p1', month: '2026-07' }).length === 2, 'p1 has 2 entries in July')
assert(localProjectExpenses.sumForMonth('p1', 'admin', '2026-07') === 7500, 'July sum is 7500')
assert(localProjectExpenses.sumForMonth('p1', 'admin', '2026-08') === 1000, 'August sum is 1000')
assert(localProjectExpenses.sumForMonth('p2', 'admin', '2026-07') === 9999, 'p2 is isolated from p1')

// Remove
localProjectExpenses.remove(e1.id)
assert(localProjectExpenses.sumForMonth('p1', 'admin', '2026-07') === 2500, 'sum drops after remove')
try {
  localProjectExpenses.remove('nonexistent-id')
  throw new Error('should have thrown on missing id')
} catch (e) {
  assert(e.message === 'Expense entry not found', 'remove throws on unknown id')
}

console.log('ALL PASS')
```

Run: `node /tmp/claude-1000/-home-jojo-labs-git-lab-HMA/d4d85282-9c9f-4114-857d-f117e0519726/scratchpad/verify-project-expenses.mjs`
Expected: every line prints `OK: ...`, ending with `ALL PASS`. No `FAIL` lines.

- [ ] **Step 4: Commit**

```bash
git add src/services/localProjectExpenses.js
git commit -m "feat: add project-scoped actual-expense ledger service"
```

---

## Task 2: New EMS tab — "Project Expenses" (HR logs actuals against activated projects)

**Files:**
- Create: `src/modules/ems/expense-management/ProjectExpensesPage.jsx`
- Modify: `src/modules/ems/expense-management/ExpenseManagementPage.jsx` (add a third tab, lines ~803, ~833-858, ~861-883)

**Interfaces:**
- Consumes: `localProjectExpenses.list/create/remove` (Task 1). `computeFlatMonthlyRate(project, pool)` and `monthsInRange(startDate, endDate)` from `src/services/monthlyApportionment.js` (already exist, unchanged — see `src/modules/pms/project-associate/MonthlyPlanPanel.jsx:32-38` for the exact existing import pattern). `localProjects.list({ pageSize })` (already exists — see `src/services/localProjects.js:212`, returns `{ items, total, total_pages }`). `usePermission(MODULE.EXPENSE_MANAGEMENT, 'edit')` from `src/hooks/usePermission.js` and `MODULE` from `src/constants/modules.js` (see `src/modules/ems/expense-management/AdminExpensePage.jsx:25-26` for the exact existing usage pattern). `useAuth()` from `src/hooks/useAuth.js` (returns `{ user, token, isAuthenticated }`; `user` has `full_name`/`employee_id` fields — see `src/modules/pms/project-associate/ProjectDetailPage.jsx`'s `const { user } = useAuth()` usage).
- Produces: default-exported `ProjectExpensesPage` component, no props (matches `AdminExpensePage`'s shape — see `ExpenseManagementPage.jsx:803`, `React.lazy(() => import('./AdminExpensePage'))`).

- [ ] **Step 1: Create `ProjectExpensesPage.jsx`**

```jsx
// src/modules/ems/expense-management/ProjectExpensesPage.jsx
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
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilTrash } from '@coreui/icons'
import { usePermission } from '../../../hooks/usePermission'
import { MODULE } from '../../../constants/modules'
import useAuth from '../../../hooks/useAuth'
import { localProjects } from '../../../services/localProjects'
import { localProjectExpenses } from '../../../services/localProjectExpenses'
import { computeFlatMonthlyRate, monthsInRange } from '../../../services/monthlyApportionment'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const monthLabel = (ym) => {
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

const EMPTY_FORM = { month: '', pool: 'admin', amount: '', label: '' }

const ProjectExpenseRow = ({ project, canEdit, currentUser, expanded, onToggle, onChanged }) => {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  const months = monthsInRange(project.start_date, project.end_date)
  const adminRate = computeFlatMonthlyRate(project, 'admin')
  const entries = localProjectExpenses.list({ projectId: project.id, pool: 'admin' })
  const totalActual = entries.reduce((s, e) => s + e.amount, 0)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleAdd = () => {
    setError('')
    try {
      localProjectExpenses.create({
        project_id: project.id,
        pool: form.pool,
        month: form.month,
        amount: parseFloat(form.amount),
        label: form.label,
        createdBy: currentUser,
      })
      setForm(EMPTY_FORM)
      onChanged()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleRemove = (id) => {
    localProjectExpenses.remove(id)
    onChanged()
  }

  return (
    <CCard className="shadow-sm mb-2">
      <CCardHeader
        className="bg-transparent fw-semibold d-flex justify-content-between align-items-center"
        role="button"
        onClick={onToggle}
      >
        <span>{project.name || project.title}</span>
        <div className="d-flex align-items-center gap-2">
          <CBadge color="warning" textColor="dark">
            Admin rate: {fmt(adminRate)}/mo
          </CBadge>
          <CBadge color="info">Actual logged: {fmt(totalActual)}</CBadge>
          <span>{expanded ? '▲' : '▼'}</span>
        </div>
      </CCardHeader>
      {expanded && (
        <CCardBody>
          {error && (
            <CAlert color="danger" className="py-2 small">
              {error}
            </CAlert>
          )}

          {canEdit && (
            <CRow className="g-2 mb-3 align-items-end">
              <CCol xs={12} md={3}>
                <label className="small text-body-secondary">Month</label>
                <CFormSelect
                  size="sm"
                  value={form.month}
                  onChange={(e) => set('month', e.target.value)}
                >
                  <option value="">Select month…</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {monthLabel(m)}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol xs={12} md={2}>
                <label className="small text-body-secondary">Pool</label>
                <CFormSelect size="sm" value={form.pool} onChange={(e) => set('pool', e.target.value)}>
                  <option value="admin">Admin</option>
                  <option value="hr" disabled>
                    HR (coming soon)
                  </option>
                  <option value="core" disabled>
                    Core (coming soon)
                  </option>
                </CFormSelect>
              </CCol>
              <CCol xs={12} md={3}>
                <label className="small text-body-secondary">Amount</label>
                <CInputGroup size="sm">
                  <CInputGroupText>₹</CInputGroupText>
                  <CFormInput
                    type="number"
                    value={form.amount}
                    onChange={(e) => set('amount', e.target.value)}
                  />
                </CInputGroup>
              </CCol>
              <CCol xs={12} md={3}>
                <label className="small text-body-secondary">Label</label>
                <CFormInput
                  size="sm"
                  placeholder="What was this for?"
                  value={form.label}
                  onChange={(e) => set('label', e.target.value)}
                />
              </CCol>
              <CCol xs={12} md={1}>
                <CButton size="sm" color="primary" onClick={handleAdd}>
                  Add
                </CButton>
              </CCol>
            </CRow>
          )}

          {entries.length === 0 ? (
            <div className="text-center text-body-tertiary small py-3">
              No admin expenses logged yet for this project.
            </div>
          ) : (
            <CTable small align="middle" className="mb-0" style={{ fontSize: '0.8rem' }}>
              <CTableHead color="light">
                <CTableRow>
                  <CTableHeaderCell>Month</CTableHeaderCell>
                  <CTableHeaderCell>Label</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Amount</CTableHeaderCell>
                  <CTableHeaderCell>Logged by</CTableHeaderCell>
                  {canEdit && <CTableHeaderCell />}
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {entries.map((e) => (
                  <CTableRow key={e.id}>
                    <CTableDataCell>{monthLabel(e.month)}</CTableDataCell>
                    <CTableDataCell>{e.label}</CTableDataCell>
                    <CTableDataCell className="text-end">{fmt(e.amount)}</CTableDataCell>
                    <CTableDataCell>{e.createdBy}</CTableDataCell>
                    {canEdit && (
                      <CTableDataCell>
                        <CButton
                          color="danger"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(e.id)}
                        >
                          <CIcon icon={cilTrash} size="sm" />
                        </CButton>
                      </CTableDataCell>
                    )}
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      )}
    </CCard>
  )
}

ProjectExpenseRow.propTypes = {
  project: PropTypes.object.isRequired,
  canEdit: PropTypes.bool.isRequired,
  currentUser: PropTypes.string.isRequired,
  expanded: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  onChanged: PropTypes.func.isRequired,
}

const ProjectExpensesPage = () => {
  const canEdit = usePermission(MODULE.EXPENSE_MANAGEMENT, 'edit')
  const { user } = useAuth()
  const currentUser = user?.full_name || user?.employee_id || 'Unknown'
  const [expandedId, setExpandedId] = useState(null)
  const [, forceRefresh] = useState(0)

  const activeProjects = localProjects
    .list({ pageSize: 1000 })
    .items.filter((p) => p.is_operations_active === true)

  return (
    <>
      <div className="mb-3">
        <p className="text-body-secondary small mb-0">
          Log actual Admin-pool expenses against an activated project. Only projects that have
          completed planning and been activated appear here. HR/Core expense tracking is coming
          later — Admin is wired up first.
        </p>
      </div>

      {activeProjects.length === 0 ? (
        <div className="text-center text-body-tertiary py-5">
          No activated projects yet. A project must complete its Monthly Plan and be activated
          before its expenses can be logged here.
        </div>
      ) : (
        activeProjects.map((project) => (
          <ProjectExpenseRow
            key={project.id}
            project={project}
            canEdit={canEdit}
            currentUser={currentUser}
            expanded={expandedId === project.id}
            onToggle={() => setExpandedId((id) => (id === project.id ? null : project.id))}
            onChanged={() => forceRefresh((k) => k + 1)}
          />
        ))
      )}
    </>
  )
}

export default ProjectExpensesPage
```

- [ ] **Step 2: Wire the third tab into `ExpenseManagementPage.jsx`**

Add the lazy import next to the existing one (after line 803, `const AdminExpensePage = React.lazy(() => import('./AdminExpensePage'))`):

```js
const ProjectExpensesPage = React.lazy(() => import('./ProjectExpensesPage'))
```

Add a third `CNavItem` inside the existing `CNav` (after the "Consolidated Sheet" `CNavItem`, i.e. right after the closing `</CNavItem>` that currently ends the nav block at line 857, still inside `<CNav>...</CNav>`):

```jsx
<CNavItem>
  <CNavLink
    active={activeTab === 2}
    onClick={() => setActiveTab(2)}
    role="button"
    className="fw-medium"
    id="tab-project-expenses"
  >
    <CIcon icon={cilDollar} className="me-1" />
    Project Expenses
  </CNavLink>
</CNavItem>
```

`cilDollar` is already imported in this file (see the existing `import { cilDollar, cilChartPie, cilArrowLeft, cilNotes, cilList } from '@coreui/icons'` near the top) — reuse it, do not add a new icon import.

Add a third `CTabPane` inside `<CTabContent>` (after the existing Tab 1 pane, before the closing `</CTabContent>`):

```jsx
{/* ── Tab 2: Project Expenses ───────────────────────────────────── */}
<CTabPane visible={activeTab === 2 && !drillProject}>
  <React.Suspense
    fallback={
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    }
  >
    <ProjectExpensesPage />
  </React.Suspense>
</CTabPane>
```

- [ ] **Step 3: Verify it lints clean**

Run: `npm run lint -- src/modules/ems/expense-management/ProjectExpensesPage.jsx src/modules/ems/expense-management/ExpenseManagementPage.jsx`
Expected: `ProjectExpensesPage.jsx` has 0 errors. `ExpenseManagementPage.jsx` has ≤38 errors (its pre-existing baseline — do not introduce new ones; if `npx eslint` reports more than 38 for this file, the new JSX has a style violation to fix, not a baseline to raise).

- [ ] **Step 4: Verify the build succeeds**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 5: Manual review checklist (no browser available)**

Read through the new tab's JSX and confirm: (a) the tab only renders when `!drillProject` matches the existing Tab 0 pattern; (b) `ProjectExpenseRow` never calls any `localProjects` write function — it only reads `project` fields and writes through `localProjectExpenses`; (c) the pool `<option>` elements for `hr`/`core` carry `disabled` so they cannot be selected. Note in your task report that no rendered-browser check was possible, consistent with every prior UI task this session.

- [ ] **Step 6: Commit**

```bash
git add src/modules/ems/expense-management/ProjectExpensesPage.jsx src/modules/ems/expense-management/ExpenseManagementPage.jsx
git commit -m "feat: add EMS Project Expenses tab for HR to log actual admin spend per project"
```

---

## Task 3: PMS "Actual Spend" section in the Monthly Plan tab

**Files:**
- Modify: `src/modules/pms/project-associate/MonthlyPlanPanel.jsx`

**Interfaces:**
- Consumes: `localProjectExpenses.list({ projectId, pool })` (Task 1). Already-existing in this file: `computeEffectivePoolMonthly(project, pool, month)`, `monthLabel(ym)` (defined at line 378), `fmt(n)` (defined at line 46), `CCard`/`CCardHeader`/`CCardBody`/`CTable*`/`CBadge` (already imported at the top of this file — no new CoreUI imports needed).
- Produces: `ActualSpendPanel` component (not exported separately — rendered directly inside the default-exported `MonthlyPlanPanel`).

- [ ] **Step 1: Add the import**

In the existing import block near the top of the file (after `import { localProjects } from '../../../services/localProjects'` at line 32), add:

```js
import { localProjectExpenses } from '../../../services/localProjectExpenses'
```

- [ ] **Step 2: Add `ActualSpendPanel`**

Insert this new component directly after `PlanningSummary`'s `PlanningSummary.propTypes` block (i.e. right after the block ending at line 812 — `PlanningSummary.propTypes = { project: PropTypes.object.isRequired }` — and before `const MonthlyPlanPanel = ({`):

```jsx
const ActualSpendPanel = ({ project }) => {
  const entries = localProjectExpenses.list({ projectId: project.id, pool: 'admin' })
  const actualForMonth = (month) =>
    entries.filter((e) => e.month === month).reduce((s, e) => s + e.amount, 0)

  return (
    <CCard className="shadow-sm mb-4">
      <CCardHeader className="bg-transparent fw-semibold pt-3">💸 Actual Spend</CCardHeader>
      <CCardBody>
        <div className="small text-body-secondary mb-3">
          Real money spent against this project, month by month, compared to the planned pool
          rates. Admin actuals are logged by HR in EMS → Expense Management → Project Expenses.
          Project/HR/Core actual tracking is not yet wired up.
        </div>
        <div style={{ overflowX: 'auto' }}>
          <CTable bordered small align="middle" className="mb-0" style={{ fontSize: '0.78rem' }}>
            <CTableHead color="light">
              <CTableRow>
                <CTableHeaderCell>Month</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Planned Admin</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Actual Admin</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Variance</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Project</CTableHeaderCell>
                <CTableHeaderCell className="text-end">HR</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Core</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {project.monthly_plan.map((m) => {
                const planned = computeEffectivePoolMonthly(project, 'admin', m.month)
                const actual = actualForMonth(m.month)
                const variance = planned - actual
                return (
                  <CTableRow key={m.month}>
                    <CTableDataCell>{monthLabel(m.month)}</CTableDataCell>
                    <CTableDataCell className="text-end">{fmt(planned)}</CTableDataCell>
                    <CTableDataCell className="text-end">
                      {actual === 0 ? 'None' : fmt(actual)}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                      <CBadge color={variance >= 0 ? 'success' : 'danger'}>{fmt(variance)}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell className="text-end text-body-tertiary">
                      — not yet tracked
                    </CTableDataCell>
                    <CTableDataCell className="text-end text-body-tertiary">
                      — not yet tracked
                    </CTableDataCell>
                    <CTableDataCell className="text-end text-body-tertiary">
                      — not yet tracked
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

ActualSpendPanel.propTypes = {
  project: PropTypes.object.isRequired,
}
```

- [ ] **Step 3: Render it inside `MonthlyPlanPanel`**

In the default-exported `MonthlyPlanPanel` component, add `<ActualSpendPanel project={project} />` directly after `<PlanningSummary project={project} />` (inside the same `{hasPlan && (...)}` block, so it only shows once a plan exists — same gating as `PlanningSummary`):

```jsx
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
```

- [ ] **Step 4: Verify it lints clean**

Run: `npm run lint -- src/modules/pms/project-associate/MonthlyPlanPanel.jsx`
Expected: 0 errors (this file's baseline is 0 — hold it strictly).

- [ ] **Step 5: Verify the build succeeds**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 6: Manual review checklist (no browser available)**

Confirm: (a) `ActualSpendPanel` is read-only — it renders no form inputs, buttons, or write calls; (b) it only reads `project.monthly_plan` (already guaranteed non-empty by the `hasPlan` gate) and `localProjectExpenses.list`; (c) the "None" vs formatted-currency branch on `actual === 0` matches the spec's requirement that a project with zero logged entries shows "None". Note in your task report that no rendered-browser check was possible.

- [ ] **Step 7: Commit**

```bash
git add src/modules/pms/project-associate/MonthlyPlanPanel.jsx
git commit -m "feat: add read-only Actual Spend panel to the Monthly Plan tab"
```

---

## Task 4: Connect Budget & Payroll's Admin Expenses card to the new ledger

**Files:**
- Modify: `src/modules/pms/project-associate/ProjectDetailPage.jsx`

**Interfaces:**
- Consumes: `localProjectExpenses.list({ projectId, pool })` (Task 1). Existing `ExpenseCard` component in this same file (defined ~line 109), existing `fmtDate` helper defined inside `ExpenseCard` (~line 171-174), existing `fmtShort` helper (used throughout this file, already in scope).
- Produces: no new exports — this task only changes `ExpenseCard`'s internal bucketing and the Admin Expenses card's call-site data assembly, both private to this file.

- [ ] **Step 1: Add the import**

Near the top of the file, after the existing `import { localAdminExpenses } from '../../../services/localAdminExpenses'` (line 73), add:

```js
import { localProjectExpenses } from '../../../services/localProjectExpenses'
```

- [ ] **Step 2: Add a third expense bucket inside `ExpenseCard`**

Find the two-bucket split inside `ExpenseCard` (currently, around line 176-178):

```js
  // Separate org-level (EMS synced) from project-specific expenses
  const orgExpenses = expenses.filter((e) => e.source === 'hr_admin')
  const projExpenses = expenses.filter((e) => e.source !== 'hr_admin')
```

Replace with a three-way split:

```js
  // Separate org-level (EMS vendor ledger), project-actual (EMS Project
  // Expenses tab), and project-specific (added directly in this card) expenses
  const orgExpenses = expenses.filter((e) => e.source === 'hr_admin')
  const actualExpenses = expenses.filter((e) => e.source === 'project_actual')
  const projExpenses = expenses.filter(
    (e) => e.source !== 'hr_admin' && e.source !== 'project_actual',
  )
```

- [ ] **Step 3: Render the new bucket**

Immediately after the existing `orgExpenses.length > 0 && (...)` block closes (currently ending at line 248, right before the `{/* ── Project-specific expenses ── */}` comment at line 250), insert:

```jsx
        {/* ── Project-actual expenses (logged via EMS Project Expenses tab) ── */}
        {actualExpenses.length > 0 && (
          <div className="mb-3">
            <div className="d-flex align-items-center gap-2 mb-2">
              <span
                className="small fw-semibold text-body-secondary text-uppercase"
                style={{ fontSize: '0.68rem', letterSpacing: '0.04em' }}
              >
                Project Actual
              </span>
              <CBadge color="info" style={{ fontSize: '0.6rem' }}>
                Logged via EMS
              </CBadge>
            </div>
            <div className="d-flex flex-column gap-2">
              {actualExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="d-flex align-items-start justify-content-between border rounded px-3 py-2"
                  style={{
                    background: 'rgba(13,110,253,0.06)',
                    borderColor: 'rgba(13,110,253,0.3) !important',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="fw-semibold small">{exp.label}</div>
                    <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                      {fmtDate(exp.date)}
                      {exp.notes && ` · ${exp.notes}`}
                    </div>
                  </div>
                  <span className="fw-bold small ms-2 text-nowrap">{fmtShort(exp.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

```

(Note the CBadge component is already imported in this file — it's used elsewhere, e.g. the existing `orgExpenses` block.)

- [ ] **Step 4: Merge project-actual entries into the Admin Expenses card's data**

Find the Admin Expenses card assembly (currently around line 2054-2077):

```jsx
                            {(() => {
                              // Merge org-level EMS expenses (read-only) with project-specific admin expenses
                              const orgAdminExpenses = localAdminExpenses.asProjectExpenses()
                              const mergedAdminExpenses = [
                                ...orgAdminExpenses,
                                ...(project.admin_expenses || []),
                              ]
                              return (
```

Replace with:

```jsx
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
```

The rest of this IIFE (the `<ExpenseCard ... />` return) is unchanged — do not modify anything after the `return (` line shown above.

- [ ] **Step 5: Verify it lints clean**

Run: `npm run lint -- src/modules/pms/project-associate/ProjectDetailPage.jsx`
Expected: ≤56 errors (this file's pre-existing baseline — do not introduce new ones; if `npx eslint` reports more than 56, the new JSX/JS has a style violation to fix).

- [ ] **Step 6: Verify the build succeeds**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 7: Manual review checklist (no browser available)**

Confirm: (a) the `actualExpenses` block renders no edit/remove controls (matches the read-only, EMS-sourced nature of these entries — same as the existing `orgExpenses` block right above it); (b) `projExpenses` (the still-editable, "add expense directly in this card" bucket) no longer accidentally includes `source: 'project_actual'` rows — re-read the three-way filter from Step 2 to confirm the exclusion is correct; (c) the HR Pool Charges and Core Pool Charges `ExpenseCard` call sites (lines ~2080-2100) are unchanged — this task only touches the Admin Expenses card. Note in your task report that no rendered-browser check was possible.

- [ ] **Step 8: Commit**

```bash
git add src/modules/pms/project-associate/ProjectDetailPage.jsx
git commit -m "feat: surface project actual-spend entries in Budget & Payroll Admin Expenses card"
```

---

## Final Verification (after all 4 tasks)

- [ ] Run `npm run build` from repo root of `hma-template/emsv1` — must succeed with no errors.
- [ ] Run `npm run lint -- src/services/localProjectExpenses.js src/modules/ems/expense-management/ProjectExpensesPage.jsx src/modules/ems/expense-management/ExpenseManagementPage.jsx src/modules/pms/project-associate/MonthlyPlanPanel.jsx src/modules/pms/project-associate/ProjectDetailPage.jsx` — every file at or under its Global Constraints baseline.
- [ ] Re-run the Task 1 Node scratch script one more time against the final committed `localProjectExpenses.js` to confirm no regressions from later tasks (later tasks only import/consume this file, never modify it — this should be a no-op check).
- [ ] Manually trace one end-to-end scenario by reading the code (no browser available): a project with `is_operations_active: true` and a `monthly_plan` → confirm it would appear in `ProjectExpensesPage` (Task 2) → confirm an entry logged there would be picked up by both `ActualSpendPanel` (Task 3, via `list({projectId, pool:'admin'})`) and the Admin Expenses card merge (Task 4, same call) → confirm a project with `is_operations_active` falsy is excluded from Task 2's list and therefore never gets entries, so Tasks 3/4 correctly show "None"/empty for it.
