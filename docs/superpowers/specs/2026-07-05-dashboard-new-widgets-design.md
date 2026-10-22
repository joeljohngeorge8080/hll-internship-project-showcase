# EMS Dashboard — 7 New Widgets — Design Spec

**Date:** 2026-07-05
**Module:** EMS Dashboard (`hma-template/emsv1/src/modules/ems/dashboard/`)
**Status:** Approved by user.

## Background

The user wants to add dashboard cards sourced from Expense Pools, Global Core Pool, Expense Management, General Expenses, Report & Analysis (including its charts), and Profit/Loss, selectable via the dashboard's widget picker.

**The picker already exists.** `src/modules/ems/dashboard/Dashboard.jsx` defines `ALL_WIDGETS` (an array of `{ id, title, description, colProps, badge, component }`), passed to `useDashboardWidgets('ems', ALL_WIDGETS)` (`src/components/dashboard/useDashboardWidgets.js`) which persists an `activeIds` array to `localStorage` (`hma_dashboard_widgets_ems`), and a "Customize" button opens `WidgetCatalog.jsx` — a modal listing every widget with an on/off `CFormSwitch`. `DashboardGrid.jsx` renders whichever widgets are active. **None of this needs to change.** This feature is purely additive: 7 new widget components + 7 new `ALL_WIDGETS` entries.

**Two items were dropped after investigation, confirmed with user:**
- **General Expenses** — already has two dashboard widgets (`GeneralExpenseWidget`: YTD planned/actual/variance; `ExpenseByCategoryWidget`: top categories). Not duplicated.
- **Monthly Payroll** (from Report & Analysis) — `computeTotalMonthlyPayroll()` computes the exact same number as the existing `PayrollSummaryWidget`. Not duplicated.

**One thing to note (not a decision needed, just a heads-up for whoever reads this later):** anyone with an existing saved widget selection in `localStorage` won't see these 7 new widgets turned on automatically — `useDashboardWidgets`'s default-on behavior only applies to a brand-new (empty) selection. Existing users enable them via "Customize," same as any other widget added to this array historically.

## Decisions (confirmed with user)

1. Report & Analysis becomes **4 separate widgets** (not one combined card): Department Headcount, Attendance Trend, Projects Overview — plus Profit/Loss as its own 5th, listed separately below since it's its own top-level ask.
2. Projects Overview shows **real live project totals** (from `localProjects`), not the static 17-project demo CSV data that the Report & Analysis page's "Projects SDP" section happens to use.

## Non-goals

- No changes to `useDashboardWidgets.js`, `DashboardGrid.jsx`, or `WidgetCatalog.jsx` — all already fully generic.
- No changes to any existing widget (`EmployeeStatsWidget`, `AttendanceSummaryWidget`, `PayrollSummaryWidget`, `GeneralExpenseWidget`, `ExpenseByCategoryWidget`, `AnnouncementsWidget`).
- No new General Expenses or Monthly Payroll widgets (covered above).
- No drag-and-drop reordering — matches the existing catalog's on/off-only behavior.

## Section 1 — Two source-file exports (avoid duplicating real logic)

**`VisualModelPage.jsx`:** `buildDepartments` (line 67) and `buildAttendanceTrend` (line 86) go from private `const` to `export const` — no behavior change, just makes them importable.

**`LsgbDependencyPage.jsx`:** this one needs a real (behavior-preserving) extraction, not just an export keyword. Its Profit/Loss numbers come from a chain of module-level helpers (`buildOperatingActuals`, `forecastFrom`, `monthsBetween`, `computeEffectivePoolMonthly`) feeding a `monthRows` → `totals` computation currently inlined in the component via `useMemo`. Duplicating that chain inline in a new widget would duplicate real, non-trivial business logic. Instead, extract one new exported pure function:

```js
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
```

The page's own `monthRows` useMemo (currently ~line 140) and `totals` useMemo (currently ~line 204) are replaced with one combined `useMemo` call. The page's **separate** `hrRevenue` useMemo (~line 178, returning `{ recruitment, training, internship, total }`, used at lines 342 and 462-464) is **not** touched — it stays exactly as-is:

```js
const { monthRows, ...totals } = useMemo(
  () => computeLsgbTotals(rangeStart, rangeEnd),
  [rangeStart, rangeEnd],
)
const isProfit = totals.isProfit
```

Every place the page currently reads `totals.operating`/`totals.project`/`totals.shares`/`totals.expenses`/`totals.ownRevenue`/`totals.lsgbNeed`/`totals.surplus`/`totals.lsgbSharePct` keeps working unchanged — `totals` is the same destructured object, just minus `monthRows` (pulled out separately above) and plus the extra `isProfit`/`hrRevenueTotal` fields `computeLsgbTotals` also returns (both unused by the page, harmless). The page's own `hrRevenue.recruitment`/`.training`/`.internship`/`.total` reads are completely unaffected since that useMemo isn't part of this change.

## Section 2 — The 7 new widget files

All live in `hma-template/emsv1/src/modules/ems/dashboard/widgets/`, following the same pattern as existing widgets (`useState` + one-shot `useEffect`, `CCard`/`CCardBody`, `Intl.NumberFormat` currency formatter, no PropTypes — matches this codebase's established convention, not the stale CoreUI-template rule in `docs/CLAUDE.md`).

### 2a. `ExpensePoolsWidget.jsx`

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

### 2b. `GlobalCorePoolWidget.jsx`

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

### 2c. `ExpenseManagementWidget.jsx`

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

### 2d. `DepartmentHeadcountWidget.jsx`

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

### 2e. `AttendanceTrendWidget.jsx`

Mini Chart.js line chart, reusing `buildAttendanceTrend()` and the exact same colors already validated on the Visual Model page (`#059669` present, `#ef4444` absent, `#d97706` on-leave):

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

### 2f. `ProjectsOverviewWidget.jsx`

Real live project totals (per user's decision), not the static SDP demo CSV:

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

### 2g. `ProfitLossWidget.jsx`

Same default range as `LsgbDependencyPage.jsx` (Jan–Dec of the current year), using Section 1's new `computeLsgbTotals` export:

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

## Section 3 — Registering all 7 in `Dashboard.jsx`

Add 7 imports and 7 `ALL_WIDGETS` entries:

```js
import ExpensePoolsWidget from './widgets/ExpensePoolsWidget'
import GlobalCorePoolWidget from './widgets/GlobalCorePoolWidget'
import ExpenseManagementWidget from './widgets/ExpenseManagementWidget'
import DepartmentHeadcountWidget from './widgets/DepartmentHeadcountWidget'
import AttendanceTrendWidget from './widgets/AttendanceTrendWidget'
import ProjectsOverviewWidget from './widgets/ProjectsOverviewWidget'
import ProfitLossWidget from './widgets/ProfitLossWidget'
```

```js
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
  {
    id: 'profit_loss',
    title: 'Profit / Loss',
    description: 'Current-year expenses vs own revenue, LSGB dependency verdict',
    colProps: { xs: 12, lg: 6 },
    badge: { label: 'Finance', color: 'success' },
    component: ProfitLossWidget,
  },
```

## Data shape summary (for the implementation plan)

```
VisualModelPage.jsx: buildDepartments, buildAttendanceTrend — const → export const (no logic change)
LsgbDependencyPage.jsx: new export computeLsgbTotals(rangeStart, rangeEnd); page's own
  monthRows/totals/isProfit useMemo blocks replaced with a single call to it.
  The page's separate hrRevenue useMemo (recruitment/training/internship/total,
  used at lines 342, 462-464) stays completely untouched — computeLsgbTotals
  computes its own internal HR-revenue total independently for its totals math
  (a small, harmless duplication of the same calculation, not a dependency).

New files (all in src/modules/ems/dashboard/widgets/):
  ExpensePoolsWidget.jsx, GlobalCorePoolWidget.jsx, ExpenseManagementWidget.jsx,
  DepartmentHeadcountWidget.jsx, AttendanceTrendWidget.jsx, ProjectsOverviewWidget.jsx,
  ProfitLossWidget.jsx

Dashboard.jsx: +7 imports, +7 ALL_WIDGETS entries. No other changes.
```
