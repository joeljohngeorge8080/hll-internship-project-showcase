/**
 * ExpenseManagementPage.jsx
 * EMS › Expense Management
 *
 * Four tabs:
 *  1. Consolidated Sheet — cross-project summary table (Admin/HR/Core/Direct)
 *  2. Apportionment Sheet — per-project monthly breakdown with freeze/adjustment logic
 *  3. Project Expenses — HR logs actual admin-pool spend per sent pool+month
 *  4. Revenue — HR revenue (recruitment/training/internship) + project pool shares
 *
 * Forecast Expense (HR & Admin actual + forecast, formerly tab 3 here) now
 * lives at its own route under the Forecast nav group — see
 * src/modules/ems/forecast/ForecastExpensePage.jsx.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CCard,
  CCardBody,
  CCardHeader,
  CBadge,
  CButton,
  CSpinner,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
  CModalTitle,
  CFormInput,
  CFormLabel,
  CFormSelect,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilDollar,
  cilChartPie,
  cilArrowLeft,
  cilNotes,
  cilPencil,
  cilX,
  cilCash,
  cilCreditCard,
  cilBank,
} from '@coreui/icons'
import { localOrgPool } from '../../../services/localOrgPool'
import { localProjects, PHASE_CONFIG } from '../../../services/localProjects'
import { localProjectExpenses } from '../../../services/localProjectExpenses'
import { computeEffectivePoolMonthly } from '../../../services/monthlyApportionment'

// ── Shared Formatters ─────────────────────────────────────────────────────────

const fmtL = (n) => {
  if (!n && n !== 0) return '—'
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)} L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)} K`
  return `₹${Math.round(n)}`
}

const monthLabel = (ym) => {
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

// ── Helper ────────────────────────────────────────────────────────────────────

const getCurrentInstallment = (installments = []) => {
  const today = new Date().toISOString().split('T')[0]
  return (
    installments.find(
      (i) => i.start_date <= today && (i.end_date || i.target_date || '') >= today,
    ) ||
    installments[installments.length - 1] ||
    null
  )
}

// ── Monthly HR Drill-down ─────────────────────────────────────────────────────

const MonthlyDrillDown = ({ project, onBack }) => {
  const [installments, setInstallments] = useState([])
  const [hrCharges, setHrCharges] = useState([])
  const [summary, setSummary] = useState({ poolBudget: 0, totalCharged: 0, remaining: 0 })
  const [pmsProject, setPmsProject] = useState(null)
  useEffect(() => {
    let cancelled = false
    localProjects.getById(project.projectId).then((p) => {
      if (!cancelled) setPmsProject(p)
    })
    localOrgPool.getProjectInstallmentBudgets(project.projectId, 'hr').then((v) => {
      if (!cancelled) setInstallments(v)
    })
    localOrgPool.getProjectHRCharges(project.projectId).then((v) => {
      if (!cancelled) setHrCharges(v)
    })
    localOrgPool.getProjectHRBudgetSummary(project.projectId).then((v) => {
      if (!cancelled) setSummary(v)
    })
    return () => {
      cancelled = true
    }
  }, [project.projectId])
  const currentInst = useMemo(
    () => getCurrentInstallment(pmsProject?.installments || []),
    [pmsProject],
  )
  const phaseConfig = PHASE_CONFIG[pmsProject?.phase] || PHASE_CONFIG.pipeline

  const chargeByMonth = useMemo(() => {
    const map = {}
    hrCharges.forEach((c) => {
      if (c.date) {
        const ym = c.date.slice(0, 7)
        map[ym] = (map[ym] || 0) + (c.myAmount || 0)
      }
    })
    return map
  }, [hrCharges])

  const usedPct =
    summary.poolBudget > 0
      ? Math.min(100, Math.round((summary.totalCharged / summary.poolBudget) * 100))
      : 0
  const isOver = summary.remaining < 0

  return (
    <>
      <div className="d-flex align-items-center gap-3 mb-4">
        <CButton color="secondary" variant="ghost" size="sm" onClick={onBack}>
          <CIcon icon={cilArrowLeft} className="me-1" />
          Back to Sheet
        </CButton>
        <div>
          <h5 className="mb-0 fw-bold">{project.projectName}</h5>
          <div className="text-body-secondary small">Monthly HR Budget Breakdown</div>
        </div>
      </div>

      <CCard
        className="mb-4 border-0 shadow-sm"
        style={{
          background: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)',
          borderRadius: 14,
        }}
      >
        <CCardBody className="p-4">
          <div className="mb-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div
              className="text-white-50 small fw-semibold text-uppercase mb-2"
              style={{ letterSpacing: '0.08em', fontSize: '0.68rem' }}
            >
              Project Details
            </div>
            <div className="text-white fw-bold mb-2" style={{ fontSize: '1.1rem' }}>
              {project.projectName}
            </div>
            <div className="d-flex flex-wrap gap-2 mb-2">
              {pmsProject?.status && (
                <CBadge
                  color={
                    pmsProject.status === 'ongoing'
                      ? 'success'
                      : pmsProject.status === 'approved'
                        ? 'info'
                        : pmsProject.status === 'completed'
                          ? 'secondary'
                          : 'warning'
                  }
                  shape="rounded-pill"
                  style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}
                >
                  {pmsProject.status}
                </CBadge>
              )}
              {pmsProject?.phase && (
                <CBadge
                  color={phaseConfig.color}
                  shape="rounded-pill"
                  style={{ fontSize: '0.7rem' }}
                >
                  {phaseConfig.label}
                </CBadge>
              )}
              {currentInst && (
                <CBadge
                  color={
                    currentInst.uc_status === 'Approved'
                      ? 'success'
                      : currentInst.uc_status === 'Submitted'
                        ? 'primary'
                        : 'warning'
                  }
                  shape="rounded-pill"
                  style={{ fontSize: '0.7rem' }}
                >
                  UC: {currentInst.uc_status || 'Pending'}
                </CBadge>
              )}
            </div>
          </div>

          <div className="d-flex flex-wrap gap-4">
            {[
              { label: 'Pool Budget', value: fmtL(summary.poolBudget), color: '#4cc9f0' },
              {
                label: 'Utilized',
                value: fmtL(summary.totalCharged),
                color: isOver ? '#ff6b6b' : '#ffd166',
              },
              {
                label: 'Remaining',
                value: fmtL(Math.abs(summary.remaining)),
                color: isOver ? '#ff6b6b' : '#06d6a0',
                prefix: isOver ? '−' : '',
              },
            ].map((item) => (
              <div key={item.label}>
                <div className="text-white-50 small mb-1" style={{ fontSize: '0.7rem' }}>
                  {item.label}
                </div>
                <div className="fw-bold" style={{ fontSize: '1.1rem', color: item.color }}>
                  {item.prefix || ''}
                  {item.value}
                </div>
              </div>
            ))}
            <div>
              <div className="text-white-50 small mb-1" style={{ fontSize: '0.7rem' }}>
                Utilization
              </div>
              <div
                className="fw-bold"
                style={{ fontSize: '1.1rem', color: isOver ? '#ff6b6b' : '#06d6a0' }}
              >
                {usedPct}%
              </div>
            </div>
          </div>
        </CCardBody>
      </CCard>

      <div className="d-flex flex-column gap-3">
        {installments.map((inst) => {
          const used = inst.monthList.reduce((s, ym) => s + (chargeByMonth[ym] || 0), 0)
          const remaining = inst.poolBudget - used
          const pct =
            inst.poolBudget > 0 ? Math.min(100, Math.round((used / inst.poolBudget) * 100)) : 0
          const over = remaining < 0
          return (
            <CCard key={inst.installmentId} className="border-0 shadow-sm">
              <CCardHeader className="py-3">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div>
                    <div className="fw-semibold">{inst.installmentLabel}</div>
                    <div className="text-body-secondary small">
                      {inst.installmentStart} → {inst.installmentEnd} · {inst.instMonths} months
                    </div>
                  </div>
                  <div className="d-flex gap-2 align-items-center">
                    <CBadge
                      color={
                        inst.ucStatus === 'Approved'
                          ? 'success'
                          : inst.ucStatus === 'Submitted'
                            ? 'primary'
                            : 'warning'
                      }
                      shape="rounded-pill"
                    >
                      UC: {inst.ucStatus || 'Pending'}
                    </CBadge>
                    <span className="small text-body-secondary">
                      HR {inst.pct}% ÷ {inst.totalMonths} months ={' '}
                      <strong className="text-primary">{fmtL(inst.monthlyBudget)}</strong>/mo
                      {' · '}this installment ({inst.months} mo):{' '}
                      <strong className="text-success">{fmtL(inst.poolBudget)}</strong>
                    </span>
                  </div>
                </div>
              </CCardHeader>
              <CCardBody>
                {inst.monthList.length === 0 ? (
                  <div className="text-body-secondary small">No months in this installment.</div>
                ) : (
                  <div
                    className="d-flex gap-3 flex-wrap"
                    style={{ overflowX: 'auto', paddingBottom: 4 }}
                  >
                    {inst.monthList.map((ym) => {
                      const mUsed = chargeByMonth[ym] || 0
                      const mRemaining = inst.monthlyBudget - mUsed
                      const mPct =
                        inst.monthlyBudget > 0
                          ? Math.min(100, Math.round((mUsed / inst.monthlyBudget) * 100))
                          : 0
                      const mOver = mRemaining < 0
                      return (
                        <div
                          key={ym}
                          className="rounded-3 border shadow-sm"
                          style={{
                            minWidth: 160,
                            maxWidth: 190,
                            flex: '0 0 auto',
                            padding: '14px 16px',
                          }}
                        >
                          <div
                            className="fw-semibold mb-2 text-body"
                            style={{ fontSize: '0.85rem' }}
                          >
                            {monthLabel(ym)}
                          </div>
                          <div
                            className="rounded-pill overflow-hidden mb-3"
                            style={{ height: 5, background: 'var(--cui-border-color)' }}
                          >
                            <div
                              className="h-100 rounded-pill"
                              style={{
                                width: `${mPct}%`,
                                background: mOver ? '#ff6b6b' : mPct > 85 ? '#ffd166' : '#06d6a0',
                                transition: 'width 0.4s ease',
                              }}
                            />
                          </div>
                          <div className="d-flex justify-content-between small mb-1">
                            <span className="text-body-secondary">Budget</span>
                            <span className="fw-medium">{fmtL(inst.monthlyBudget)}</span>
                          </div>
                          <div className="d-flex justify-content-between small mb-1">
                            <span className="text-body-secondary">Utilized</span>
                            <span
                              className={`fw-semibold ${mUsed > 0 ? (mOver ? 'text-danger' : 'text-warning') : 'text-body-secondary'}`}
                            >
                              {fmtL(mUsed)}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between small">
                            <span className="text-body-secondary">Remaining</span>
                            <span
                              className={`fw-semibold ${mOver ? 'text-danger' : 'text-success'}`}
                            >
                              {mOver ? '−' : ''}
                              {fmtL(Math.abs(mRemaining))}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CCardBody>
            </CCard>
          )
        })}
      </div>
    </>
  )
}

// ── Consolidated Cross-Project Sheet ──────────────────────────────────────────
//
// Budget logic:
//   Admin  → project_value × 5% ÷ total_months, every month from creation
//   HR     → 0 until activation, then project_value × hr_pct% ÷ total_months
//   Core   → 0 until activation, then project_value × core_pct% ÷ total_months
//   Direct → installment_amount × (100-admin-hr-core)% ÷ inst_months

const currentMonth = () => new Date().toISOString().slice(0, 7)

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

const ConsolidatedSheet = ({ onDrillDown }) => {
  const [baseRows, setBaseRows] = useState([])
  const [loading, setLoading] = useState(true)
  // 'all' = full project duration; otherwise a 'YYYY-MM' month key
  const [monthFilter, setMonthFilter] = useState('all')

  const loadConsolidated = useCallback(async () => {
    // Same source as PMS › All Projects (localProjects.list with no filters) —
    // every project entered there shows up here, not just activated ones.
    const allProjects = (await localProjects.list({ pageSize: 1000 })).items || []

    const built = await Promise.all(
      allProjects.map(async (p) => {
        const bd = localOrgPool.buildProjectMonthlyBreakdown(p)
        const pv = p.project_value || p.project_valuation || p.amount_sanctioned || 0
        const hrSummary = await localOrgPool.getProjectHRBudgetSummary(p.id)
        const coreSummary = await localOrgPool.getProjectCoreBudgetSummary(p.id)

        // Per-month "used" maps so the sheet can be filtered month-wise
        const hrUsedByMonth = {}
        ;(await localOrgPool.getProjectHRCharges(p.id)).forEach((c) => {
          if (!c.date) return
          const ym = c.date.slice(0, 7)
          hrUsedByMonth[ym] = (hrUsedByMonth[ym] || 0) + (c.myAmount || 0)
        })
        const coreUsedByMonth = {}
        ;(await localOrgPool.getProjectCoreCharges(p.id)).forEach((c) => {
          if (!c.date) return
          const ym = c.date.slice(0, 7)
          coreUsedByMonth[ym] = (coreUsedByMonth[ym] || 0) + (c.myAmount || 0)
        })
        const adminUsedByMonth = {}
        const adminEntries = await localProjectExpenses.list({ projectId: p.id, pool: 'admin' })
        adminEntries.forEach((e) => {
          adminUsedByMonth[e.month] = (adminUsedByMonth[e.month] || 0) + e.amount
        })

        const activationMonth =
          p.operations_activated_month ||
          (p.operations_activated_at ? p.operations_activated_at.slice(0, 7) : null) ||
          (p.status === 'ongoing' && p.start_date ? p.start_date.slice(0, 7) : null)
        return {
          projectId: p.id,
          projectName: p.title || p.name,
          projectType: p.project_type,
          projectValue: pv,
          startDate: p.start_date,
          endDate: p.end_date,
          durationMonths: bd.length,
          activationMonth,
          bd,
          hrUsedByMonth,
          coreUsedByMonth,
          adminUsedByMonth,
          adminUsedTotal: adminEntries.reduce((s, e) => s + e.amount, 0),
          hrUsedTotal: hrSummary.totalCharged || 0,
          coreUsedTotal: coreSummary.totalCharged || 0,
        }
      }),
    )

    // Attach this month's monthly-plan-derived split (Project/HR/Core/Admin),
    // where available, alongside the localOrgPool-derived totals above.
    const enriched = await Promise.all(
      built.map(async (r) => {
        const fullProject = await localProjects.getById(r.projectId)
        const newSplit = currentMonthSplitFor(fullProject)
        return newSplit ? { ...r, newMonthSplit: newSplit } : r
      }),
    )

    setBaseRows(enriched)
    setLoading(false)
  }, [])

  // Initial load
  useEffect(() => {
    loadConsolidated()
  }, [loadConsolidated])

  // Re-load when any tab saves project changes (cross-tab sync via storage event)
  useEffect(() => {
    const handleChange = () => loadConsolidated()
    window.addEventListener('hma_projects_changed', handleChange)
    const handleStorage = (e) => {
      if (e.key === 'hma_projects_sync_at') handleChange()
    }
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('hma_projects_changed', handleChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [loadConsolidated])

  // Every month any project is running in, for the month selector
  const monthOptions = useMemo(() => {
    const set = new Set()
    baseRows.forEach((r) => r.bd.forEach((m) => set.add(m.month)))
    return [...set].sort()
  }, [baseRows])

  // Budget + used figures for the selected window (full duration or one month)
  const rows = useMemo(
    () =>
      baseRows.map((r) => {
        const months = monthFilter === 'all' ? r.bd : r.bd.filter((m) => m.month === monthFilter)
        return {
          ...r,
          totalAdmin: months.reduce((s, m) => s + m.adminBudget, 0),
          totalHr: months.reduce((s, m) => s + m.hrBudget, 0),
          totalCore: months.reduce((s, m) => s + m.coreBudget, 0),
          totalDirect: months.reduce((s, m) => s + m.directBudget, 0),
          adminUsed:
            monthFilter === 'all' ? r.adminUsedTotal : r.adminUsedByMonth[monthFilter] || 0,
          hrUsed: monthFilter === 'all' ? r.hrUsedTotal : r.hrUsedByMonth[monthFilter] || 0,
          coreUsed: monthFilter === 'all' ? r.coreUsedTotal : r.coreUsedByMonth[monthFilter] || 0,
        }
      }),
    [baseRows, monthFilter],
  )

  if (loading)
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  if (rows.length === 0) {
    return (
      <div className="text-center text-body-secondary py-5 small">
        No projects found. Add a project in PMS › All Projects to see it here.
      </div>
    )
  }

  const sumAdmin = rows.reduce((s, r) => s + r.totalAdmin, 0)
  const sumHr = rows.reduce((s, r) => s + r.totalHr, 0)
  const sumCore = rows.reduce((s, r) => s + r.totalCore, 0)
  const sumDirect = rows.reduce((s, r) => s + r.totalDirect, 0)
  const sumAdminUsed = rows.reduce((s, r) => s + r.adminUsed, 0)
  const sumHrUsed = rows.reduce((s, r) => s + r.hrUsed, 0)
  const sumCoreUsed = rows.reduce((s, r) => s + r.coreUsed, 0)

  const SHEET_ROWS = [
    {
      key: 'admin',
      label: 'HMA Admin Expenses',
      color: 'warning',
      badge: '5%',
      getBudget: (r) => r.totalAdmin,
      getUsed: (r) => r.adminUsed,
      totalBudget: sumAdmin,
      totalUsed: sumAdminUsed,
      note: 'Always active',
    },
    {
      key: 'hr',
      label: 'HR Expenses',
      color: 'primary',
      badge: '5%',
      getBudget: (r) => r.totalHr,
      getUsed: (r) => r.hrUsed,
      totalBudget: sumHr,
      totalUsed: sumHrUsed,
      note: 'Post-activation',
    },
    {
      key: 'core',
      label: 'Core Team Salary',
      color: 'info',
      badge: '5%',
      getBudget: (r) => r.totalCore,
      getUsed: (r) => r.coreUsed,
      totalBudget: sumCore,
      totalUsed: sumCoreUsed,
      note: 'Post-activation',
    },
    {
      key: 'direct',
      label: 'Project Direct Expenses',
      color: 'success',
      badge: '85%+',
      getBudget: (r) => r.totalDirect,
      getUsed: () => 0,
      totalBudget: sumDirect,
      totalUsed: 0,
      note: 'From installment',
    },
  ]

  return (
    <>
      <div className="mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h6 className="fw-bold mb-0">Cross-Project Expense Consolidated Sheet</h6>
          <div className="text-body-secondary small">
            Budget across {rows.length} project{rows.length !== 1 ? 's' : ''} from PMS › All
            Projects
            {' · '}Admin always active · HR/Core from activation · Click project to drill down
          </div>
        </div>
        <div className="d-flex gap-2 align-items-center">
          <CFormSelect
            size="sm"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            style={{ width: 170 }}
            aria-label="Consolidated sheet period"
          >
            <option value="all">Full duration</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </CFormSelect>
          <CBadge color="success" shape="rounded-pill" className="px-3 py-2">
            {rows.length} Project{rows.length !== 1 ? 's' : ''}
          </CBadge>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table
          className="table table-bordered table-hover align-middle mb-0"
          style={{ minWidth: 900, fontSize: '0.84rem' }}
        >
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="align-middle text-center bg-body-secondary fw-semibold"
                style={{
                  minWidth: 50,
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  borderRight: '2px solid var(--cui-border-color)',
                }}
              >
                #
              </th>
              <th
                rowSpan={2}
                className="align-middle bg-body-secondary fw-semibold"
                style={{
                  minWidth: 200,
                  position: 'sticky',
                  left: 50,
                  zIndex: 2,
                  borderRight: '2px solid var(--cui-border-color)',
                }}
              >
                Particulars
              </th>
              <th
                colSpan={rows.length}
                className="text-center bg-primary bg-opacity-10 text-primary fw-semibold"
                style={{ letterSpacing: '0.05em' }}
              >
                Projects
              </th>
              <th
                rowSpan={2}
                className="text-center align-middle bg-body-secondary fw-semibold"
                style={{ minWidth: 120, borderLeft: '2px solid var(--cui-border-color)' }}
              >
                Total
              </th>
            </tr>
            <tr>
              {rows.map((r) => (
                <th
                  key={r.projectId}
                  className="text-center"
                  style={{ minWidth: 130, verticalAlign: 'top', cursor: 'pointer' }}
                  onClick={() =>
                    onDrillDown({ projectId: r.projectId, projectName: r.projectName })
                  }
                  title="Click to view monthly HR breakdown"
                >
                  <div
                    className="text-primary text-decoration-underline"
                    style={{ fontSize: '0.78rem', fontWeight: 600, lineHeight: 1.3 }}
                  >
                    {r.projectName}
                  </div>
                  <div
                    className="text-body-secondary"
                    style={{ fontSize: '0.63rem', marginTop: 2 }}
                  >
                    Duration: {r.durationMonths} month{r.durationMonths !== 1 ? 's' : ''}
                  </div>
                  <CBadge
                    color="secondary"
                    shape="rounded-pill"
                    className="mt-1"
                    style={{ fontSize: '0.62rem' }}
                  >
                    {r.projectType || 'Project'}
                  </CBadge>
                  {r.activationMonth && (
                    <div className="text-success" style={{ fontSize: '0.63rem', marginTop: 2 }}>
                      Active from {r.activationMonth}
                    </div>
                  )}
                  {r.newMonthSplit && (
                    <div
                      className="text-body-secondary"
                      style={{ fontSize: '0.62rem', marginTop: 2, lineHeight: 1.3 }}
                    >
                      This month: Project {fmtL(r.newMonthSplit.projectAmount)} · HR{' '}
                      {fmtL(r.newMonthSplit.hrAmount)} · Core {fmtL(r.newMonthSplit.coreAmount)} ·{' '}
                      Admin {fmtL(r.newMonthSplit.adminAmount)}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SHEET_ROWS.map((row, ri) => (
              <React.Fragment key={row.key}>
                <tr>
                  <td
                    className="text-center fw-medium bg-body-tertiary"
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                      borderRight: '2px solid var(--cui-border-color)',
                    }}
                  >
                    {ri + 1}
                  </td>
                  <td
                    style={{
                      position: 'sticky',
                      left: 50,
                      zIndex: 1,
                      borderRight: '2px solid var(--cui-border-color)',
                      background: 'var(--cui-body-bg)',
                    }}
                  >
                    <div className="fw-semibold">{row.label}</div>
                    <CBadge color={row.color} shape="rounded-pill" style={{ fontSize: '0.62rem' }}>
                      {row.badge}
                    </CBadge>
                    <div className={`text-${row.color}`} style={{ fontSize: '0.65rem' }}>
                      {row.note}
                    </div>
                  </td>
                  {rows.map((r) => {
                    const val = row.getBudget(r)
                    return (
                      <td
                        key={r.projectId}
                        className="text-end"
                        style={{ cursor: 'pointer' }}
                        onClick={() =>
                          onDrillDown({ projectId: r.projectId, projectName: r.projectName })
                        }
                      >
                        <span className="fw-medium">{val > 0 ? fmtL(val) : '—'}</span>
                      </td>
                    )
                  })}
                  <td
                    className="text-end fw-bold text-primary"
                    style={{ borderLeft: '2px solid var(--cui-border-color)' }}
                  >
                    {fmtL(row.totalBudget)}
                  </td>
                </tr>
                {(row.key === 'hr' || row.key === 'core') && (
                  <tr className="table-light">
                    <td
                      style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                        borderRight: '2px solid var(--cui-border-color)',
                      }}
                    />
                    <td
                      style={{
                        position: 'sticky',
                        left: 50,
                        zIndex: 1,
                        borderRight: '2px solid var(--cui-border-color)',
                        background: 'var(--cui-tertiary-bg)',
                      }}
                    >
                      <div className="text-body-secondary" style={{ fontSize: '0.73rem' }}>
                        &#8627; Used
                      </div>
                    </td>
                    {rows.map((r) => {
                      const used = row.getUsed(r)
                      const budget = row.getBudget(r)
                      const over = used > budget && budget > 0
                      return (
                        <td key={r.projectId} className="text-end" style={{ fontSize: '0.78rem' }}>
                          <span
                            className={
                              over
                                ? 'text-danger fw-semibold'
                                : used > 0
                                  ? 'text-warning fw-medium'
                                  : 'text-body-tertiary'
                            }
                          >
                            {used > 0 ? fmtL(used) : '—'}
                          </span>
                        </td>
                      )
                    })}
                    <td
                      className="text-end fw-semibold text-warning"
                      style={{
                        fontSize: '0.78rem',
                        borderLeft: '2px solid var(--cui-border-color)',
                      }}
                    >
                      {row.totalUsed > 0 ? fmtL(row.totalUsed) : '—'}
                    </td>
                  </tr>
                )}
                {ri < SHEET_ROWS.length - 1 && (
                  <tr style={{ height: 6 }}>
                    <td
                      colSpan={rows.length + 3}
                      style={{ background: 'var(--cui-tertiary-bg)', padding: 0 }}
                    />
                  </tr>
                )}
              </React.Fragment>
            ))}
            <tr style={{ borderTop: '3px solid var(--cui-border-color)' }}>
              <td
                colSpan={2}
                className="fw-bold text-center bg-body-secondary"
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                  borderRight: '2px solid var(--cui-border-color)',
                }}
              >
                Project Value
              </td>
              {rows.map((r) => (
                <td key={r.projectId} className="text-end fw-bold text-primary">
                  {fmtL(r.projectValue)}
                </td>
              ))}
              <td
                className="text-end fw-bold text-primary"
                style={{ borderLeft: '2px solid var(--cui-border-color)' }}
              >
                {fmtL(rows.reduce((s, r) => s + r.projectValue, 0))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="text-body-secondary small mt-3">
        <CIcon icon={cilChartPie} className="me-1" />
        Click any project name or cell to view the monthly HR budget breakdown.
      </div>
    </>
  )
}

// ── Apportionment Sheet ───────────────────────────────────────────────────────
//
// Per-project card with month columns. Reflects:
//   - Admin: shown for every month (always active)
//   - HR/Core: shows '—' before activation, actual value after
//   - Adjusted months shown in orange
//   - Per-column pencil button to add % adjustment from that month onwards

const ApportionmentSheet = () => {
  const [projects, setProjects] = useState([])
  const [breakdowns, setBreakdowns] = useState({})
  const [actualAdminByProject, setActualAdminByProject] = useState({})
  const [loading, setLoading] = useState(true)
  const [adjustModal, setAdjustModal] = useState(null)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    const allProjects = (await localProjects.list({ pageSize: 1000 })).items || []
    const bds = {}
    allProjects.forEach((p) => {
      bds[p.id] = localOrgPool.buildProjectMonthlyBreakdown(p)
    })
    const actuals = {}
    await Promise.all(
      allProjects.map(async (p) => {
        const entries = await localProjectExpenses.list({ projectId: p.id, pool: 'admin' })
        actuals[p.id] = entries.reduce((s, e) => s + e.amount, 0)
      }),
    )
    setBreakdowns(bds)
    setActualAdminByProject(actuals)
    setProjects(allProjects)
    setLoading(false)
  }, [])

  // Initial load
  useEffect(() => {
    loadData()
  }, [loadData])

  // Re-load when any tab saves project changes (cross-tab sync via storage event)
  useEffect(() => {
    const handleChange = () => loadData()
    window.addEventListener('hma_projects_changed', handleChange)
    const handleStorage = (e) => {
      if (e.key === 'hma_projects_sync_at') handleChange()
    }
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('hma_projects_changed', handleChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [loadData])

  const handleSaveAdjust = async () => {
    if (!adjustModal) return
    setSaving(true)
    try {
      await localProjects.addPoolPctAdjustment(adjustModal.project.id, {
        from_month: adjustModal.month,
        hr_pct: parseFloat(adjustModal.hr_pct) || 0,
        core_pct: parseFloat(adjustModal.core_pct) || 0,
      })
      setAdjustModal(null)
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveAdjust = async (projectId, from_month) => {
    await localProjects.removePoolPctAdjustment(projectId, from_month)
    loadData()
  }

  if (loading)
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  if (projects.length === 0) {
    return <div className="text-center text-body-secondary py-5 small">No projects found.</div>
  }

  return (
    <>
      <div className="mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h6 className="fw-bold mb-0">Project Apportionment Sheet</h6>
          <div className="text-body-secondary small">
            Monthly budget per project. Admin active from creation. HR/Core frozen until PMS
            activation — adjustable from any month.
          </div>
        </div>
        <CBadge color="primary" shape="rounded-pill" className="px-3 py-2">
          {projects.length} Projects
        </CBadge>
      </div>

      <div className="d-flex flex-column gap-4">
        {projects.map((p, idx) => {
          const bd = breakdowns[p.id] || []
          const pv = p.project_value || p.project_valuation || p.amount_sanctioned || 0
          const activationMonth =
            p.operations_activated_month ||
            (p.operations_activated_at ? p.operations_activated_at.slice(0, 7) : null) ||
            (p.status === 'ongoing' && p.start_date ? p.start_date.slice(0, 7) : null)
          const adjustments = p.pool_pct_adjustments || []
          const totalAdmin = bd.reduce((s, m) => s + m.adminBudget, 0)
          const totalHr = bd.reduce((s, m) => s + m.hrBudget, 0)
          const totalCore = bd.reduce((s, m) => s + m.coreBudget, 0)
          const totalDirect = bd.reduce((s, m) => s + m.directBudget, 0)
          const actualAdmin = actualAdminByProject[p.id] || 0

          return (
            <CCard key={p.id} className="shadow-sm border-0">
              <CCardHeader className="py-3">
                <div className="d-flex align-items-start justify-content-between flex-wrap gap-2">
                  <div>
                    <h6 className="mb-1 fw-bold">
                      {idx + 1}. {p.name || p.title}
                    </h6>
                    <div className="d-flex flex-wrap gap-2 align-items-center">
                      <span className="text-body-secondary small">
                        Type: <strong>{p.project_type || '—'}</strong>
                      </span>
                      <span className="text-body-secondary small">
                        Value: <strong className="text-primary">{fmtL(pv)}</strong>
                      </span>
                      {activationMonth ? (
                        <CBadge
                          color="success"
                          shape="rounded-pill"
                          style={{ fontSize: '0.68rem' }}
                        >
                          HR/Core active from {activationMonth}
                        </CBadge>
                      ) : (
                        <CBadge
                          color="secondary"
                          shape="rounded-pill"
                          style={{ fontSize: '0.68rem' }}
                        >
                          HR/Core frozen — not yet activated in PMS
                        </CBadge>
                      )}
                      {adjustments.length > 0 && (
                        <CBadge
                          color="warning"
                          shape="rounded-pill"
                          style={{ fontSize: '0.68rem' }}
                        >
                          {adjustments.length} % adjustment{adjustments.length > 1 ? 's' : ''}
                        </CBadge>
                      )}
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    {[
                      { l: 'Admin', v: totalAdmin, c: 'warning' },
                      { l: 'HR', v: totalHr, c: 'primary' },
                      { l: 'Core', v: totalCore, c: 'info' },
                      { l: 'Direct', v: totalDirect, c: 'success' },
                      { l: 'Actual (Admin)', v: actualAdmin, c: 'danger' },
                    ].map((s) => (
                      <div
                        key={s.l}
                        className="text-center px-3 py-1 rounded-3 border"
                        style={{ fontSize: '0.72rem', minWidth: 72 }}
                      >
                        <div className={`fw-bold text-${s.c}`}>{fmtL(s.v)}</div>
                        <div className="text-body-secondary">{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </CCardHeader>

              <CCardBody className="p-0">
                <div style={{ overflowX: 'auto' }}>
                  <table
                    className="table table-bordered align-middle mb-0"
                    style={{ minWidth: 420 + bd.length * 95, fontSize: '0.82rem' }}
                  >
                    <thead>
                      <tr className="bg-body-tertiary">
                        <th
                          className="fw-semibold"
                          style={{
                            minWidth: 290,
                            position: 'sticky',
                            left: 0,
                            zIndex: 2,
                            background: 'var(--cui-tertiary-bg)',
                          }}
                        >
                          Project Split Up
                        </th>
                        <th className="text-end fw-semibold" style={{ minWidth: 120 }}>
                          Total
                        </th>
                        {bd.map((m) => {
                          const [y, mo] = m.month.split('-')
                          const adj = adjustments.find((a) => a.from_month === m.month)
                          return (
                            <th
                              key={m.month}
                              className="text-center fw-semibold p-0"
                              style={{ minWidth: 90, verticalAlign: 'bottom' }}
                            >
                              <div className="px-2 pt-2 pb-1">
                                <div style={{ fontSize: '0.75rem' }}>
                                  {mo}/{y.slice(-2)}
                                </div>
                                {!m.isActive && activationMonth && (
                                  <div style={{ fontSize: '0.6rem', color: '#aaa' }}>frozen</div>
                                )}
                                {adj && (
                                  <div
                                    className="text-warning fw-semibold"
                                    style={{ fontSize: '0.6rem' }}
                                  >
                                    HR{adj.hr_pct}%/C{adj.core_pct}%
                                  </div>
                                )}
                                {m.isActive && (
                                  <CButton
                                    size="sm"
                                    color="ghost"
                                    className="p-0 mt-1"
                                    style={{ fontSize: '0.62rem', lineHeight: 1 }}
                                    title={`Adjust % from ${m.month} onwards`}
                                    onClick={() =>
                                      setAdjustModal({
                                        project: p,
                                        month: m.month,
                                        hr_pct: m.hr_pct || (p.hr_pct ?? 5),
                                        core_pct: m.core_pct || (p.core_pct ?? 5),
                                      })
                                    }
                                  >
                                    <CIcon icon={cilPencil} style={{ width: 10, height: 10 }} />
                                  </CButton>
                                )}
                              </div>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Admin — always shown */}
                      <tr>
                        <td
                          className="fw-medium"
                          style={{
                            position: 'sticky',
                            left: 0,
                            zIndex: 1,
                            background: 'var(--cui-body-bg)',
                          }}
                        >
                          HMA Admin Expenses @{p.admin_pct ?? 5}%
                          <CBadge
                            color="warning"
                            shape="rounded-pill"
                            className="ms-2"
                            style={{ fontSize: '0.6rem' }}
                          >
                            Always active
                          </CBadge>
                        </td>
                        <td className="text-end fw-semibold text-warning">{fmtL(totalAdmin)}</td>
                        {bd.map((m) => (
                          <td key={m.month} className="text-end text-body-secondary">
                            {fmtL(m.adminBudget)}
                          </td>
                        ))}
                      </tr>

                      {/* HR — frozen until activation */}
                      <tr>
                        <td
                          className="fw-medium"
                          style={{
                            position: 'sticky',
                            left: 0,
                            zIndex: 1,
                            background: 'var(--cui-body-bg)',
                          }}
                        >
                          HR Expenses @{p.hr_pct ?? 5}%
                          <CBadge
                            color="primary"
                            shape="rounded-pill"
                            className="ms-2"
                            style={{ fontSize: '0.6rem' }}
                          >
                            Post-activation
                          </CBadge>
                        </td>
                        <td className="text-end fw-semibold text-primary">{fmtL(totalHr)}</td>
                        {bd.map((m) => (
                          <td
                            key={m.month}
                            className={`text-end ${
                              !m.isActive
                                ? 'text-body-tertiary'
                                : m.isAdjusted
                                  ? 'text-warning fw-medium'
                                  : 'text-primary'
                            }`}
                          >
                            {m.isActive ? fmtL(m.hrBudget) : '—'}
                          </td>
                        ))}
                      </tr>

                      {/* Core — frozen until activation */}
                      <tr>
                        <td
                          className="fw-medium"
                          style={{
                            position: 'sticky',
                            left: 0,
                            zIndex: 1,
                            background: 'var(--cui-body-bg)',
                          }}
                        >
                          HMA Core Team Salary @{p.core_pct ?? 5}%
                          <CBadge
                            color="info"
                            shape="rounded-pill"
                            className="ms-2"
                            style={{ fontSize: '0.6rem' }}
                          >
                            Post-activation
                          </CBadge>
                        </td>
                        <td className="text-end fw-semibold text-info">{fmtL(totalCore)}</td>
                        {bd.map((m) => (
                          <td
                            key={m.month}
                            className={`text-end ${
                              !m.isActive
                                ? 'text-body-tertiary'
                                : m.isAdjusted
                                  ? 'text-warning fw-medium'
                                  : 'text-info'
                            }`}
                          >
                            {m.isActive ? fmtL(m.coreBudget) : '—'}
                          </td>
                        ))}
                      </tr>

                      {/* Pool subtotal */}
                      <tr className="table-light">
                        <td
                          className="fw-bold"
                          style={{
                            position: 'sticky',
                            left: 0,
                            zIndex: 1,
                            background: 'var(--cui-tertiary-bg)',
                          }}
                        >
                          {(p.admin_pct ?? 5) + (p.hr_pct ?? 5) + (p.core_pct ?? 5)}% total of
                          Project Value
                        </td>
                        <td className="text-end fw-bold">
                          {fmtL(totalAdmin + totalHr + totalCore)}
                        </td>
                        {bd.map((m) => (
                          <td key={m.month} className="text-end fw-medium">
                            {fmtL(m.adminBudget + m.hrBudget + m.coreBudget)}
                          </td>
                        ))}
                      </tr>

                      {/* Direct expenses */}
                      <tr className="table-light">
                        <td
                          className="fw-bold"
                          style={{
                            position: 'sticky',
                            left: 0,
                            zIndex: 1,
                            background: 'var(--cui-tertiary-bg)',
                          }}
                        >
                          Project Direct Expenses
                          <div
                            className="text-body-secondary fw-normal"
                            style={{ fontSize: '0.7rem' }}
                          >
                            Increases when HR/Core % is reduced
                          </div>
                        </td>
                        <td className="text-end fw-bold text-success">{fmtL(totalDirect)}</td>
                        {bd.map((m) => (
                          <td key={m.month} className="text-end fw-medium text-success">
                            {m.directBudget > 0 ? fmtL(m.directBudget) : '—'}
                          </td>
                        ))}
                      </tr>

                      {/* Phase sub-rows */}
                      {(() => {
                        const hasPlannedPhases = bd.some(
                          (m) => m.plannedPhases && m.plannedPhases.length > 0,
                        )

                        if (hasPlannedPhases) {
                          const tasksMap = new Map() // key -> { id, phase, label, total }
                          bd.forEach((m) => {
                            if (m.plannedPhases) {
                              m.plannedPhases.forEach((ph, i) => {
                                const key = `${ph.phase}-${ph.label || i}`
                                if (!tasksMap.has(key)) {
                                  tasksMap.set(key, {
                                    id: key,
                                    phase: ph.phase,
                                    label: ph.label || ph.phase,
                                    total: 0,
                                  })
                                }
                                tasksMap.get(key).total += ph.amount || 0
                              })
                            }
                          })

                          const tasks = Array.from(tasksMap.values())
                          return tasks.map((t) => (
                            <tr key={t.id}>
                              <td
                                className="ps-4 text-body-secondary fw-medium"
                                style={{
                                  position: 'sticky',
                                  left: 0,
                                  zIndex: 1,
                                  background: 'var(--cui-body-bg)',
                                }}
                              >
                                &#8627; {t.label}
                                <CBadge
                                  color="secondary"
                                  shape="rounded-pill"
                                  className="ms-2"
                                  style={{ fontSize: '0.6rem', opacity: 0.8 }}
                                >
                                  PMS Task
                                </CBadge>
                              </td>
                              <td className="text-end text-success fw-medium">{fmtL(t.total)}</td>
                              {bd.map((m) => {
                                const pPhase = m.plannedPhases
                                  ? m.plannedPhases.find(
                                      (ph, i) => `${ph.phase}-${ph.label || i}` === t.id,
                                    )
                                  : null
                                const amt = pPhase ? pPhase.amount || 0 : 0
                                return (
                                  <td
                                    key={m.month}
                                    className="text-end text-body-tertiary"
                                    style={{ fontSize: '0.78rem' }}
                                  >
                                    {amt > 0 ? fmtL(amt) : '—'}
                                  </td>
                                )
                              })}
                            </tr>
                          ))
                        } else {
                          // Fallback to legacy Installment-based phase rows
                          const phases = []
                          const seen = new Set()
                          bd.forEach((m) => {
                            if (m.installmentId && !seen.has(m.installmentId)) {
                              seen.add(m.installmentId)
                              phases.push({
                                id: m.installmentId,
                                label: m.phaseName || m.installmentLabel,
                              })
                            }
                          })
                          return phases.map((ph) => {
                            const phTotal = bd
                              .filter((m) => m.installmentId === ph.id)
                              .reduce((s, m) => s + m.directBudget, 0)
                            return (
                              <tr key={ph.id}>
                                <td
                                  className="ps-4 text-body-secondary fw-medium"
                                  style={{
                                    position: 'sticky',
                                    left: 0,
                                    zIndex: 1,
                                    background: 'var(--cui-body-bg)',
                                  }}
                                >
                                  &#8627; {ph.label}
                                </td>
                                <td className="text-end text-success fw-medium">{fmtL(phTotal)}</td>
                                {bd.map((m) => (
                                  <td
                                    key={m.month}
                                    className="text-end text-body-tertiary"
                                    style={{ fontSize: '0.78rem' }}
                                  >
                                    {m.installmentId === ph.id && m.directBudget > 0
                                      ? fmtL(m.directBudget)
                                      : '—'}
                                  </td>
                                ))}
                              </tr>
                            )
                          })
                        }
                      })()}
                    </tbody>
                  </table>
                </div>
              </CCardBody>

              {/* Adjustment list footer */}
              {adjustments.length > 0 && (
                <div className="px-3 py-2 border-top" style={{ fontSize: '0.73rem' }}>
                  <strong className="text-warning">% Adjustments in effect:</strong>
                  {adjustments.map((a) => (
                    <span key={a.from_month} className="ms-3 text-body-secondary">
                      From <strong>{a.from_month}</strong>: HR {a.hr_pct}% / Core {a.core_pct}%
                      <CButton
                        size="sm"
                        color="ghost"
                        className="p-0 ms-1"
                        style={{ fontSize: '0.6rem' }}
                        onClick={() => handleRemoveAdjust(p.id, a.from_month)}
                      >
                        <CIcon icon={cilX} style={{ width: 9, height: 9 }} />
                      </CButton>
                    </span>
                  ))}
                </div>
              )}
            </CCard>
          )
        })}
      </div>

      {/* Adjustment modal */}
      <CModal visible={!!adjustModal} onClose={() => setAdjustModal(null)} size="sm">
        <CModalHeader>
          <CModalTitle style={{ fontSize: '0.95rem' }}>
            Adjust Pool % from {adjustModal?.month}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {adjustModal && (
            <>
              <div className="text-body-secondary small mb-3">
                <strong>{adjustModal.project.name || adjustModal.project.title}</strong>
                <br />
                Changes apply from <strong>{adjustModal.month}</strong> onwards. Reducing HR/Core %
                increases project direct budget from that month.
              </div>
              <div className="mb-3">
                <CFormLabel className="fw-semibold small mb-1">
                  HR % (default: {adjustModal.project.hr_pct ?? 5}%)
                </CFormLabel>
                <CFormInput
                  type="number"
                  min={0}
                  max={15}
                  step={0.5}
                  value={adjustModal.hr_pct}
                  onChange={(e) => setAdjustModal((s) => ({ ...s, hr_pct: e.target.value }))}
                />
              </div>
              <div className="mb-3">
                <CFormLabel className="fw-semibold small mb-1">
                  Core % (default: {adjustModal.project.core_pct ?? 5}%)
                </CFormLabel>
                <CFormInput
                  type="number"
                  min={0}
                  max={15}
                  step={0.5}
                  value={adjustModal.core_pct}
                  onChange={(e) => setAdjustModal((s) => ({ ...s, core_pct: e.target.value }))}
                />
              </div>
              {(() => {
                const adminP = adjustModal.project.admin_pct ?? 5
                const hrP = parseFloat(adjustModal.hr_pct) || 0
                const coreP = parseFloat(adjustModal.core_pct) || 0
                const dirP = Math.max(0, 100 - adminP - hrP - coreP)
                return (
                  <div
                    className="rounded-3 p-2"
                    style={{ background: 'var(--cui-tertiary-bg)', fontSize: '0.78rem' }}
                  >
                    {[
                      ['Admin', adminP, ''],
                      ['HR', hrP, 'text-primary'],
                      ['Core', coreP, 'text-info'],
                    ].map(([l, v, c]) => (
                      <div key={l} className="d-flex justify-content-between">
                        <span className="text-body-secondary">{l}</span>
                        <strong className={c}>{v}%</strong>
                      </div>
                    ))}
                    <div className="d-flex justify-content-between border-top mt-1 pt-1">
                      <span className="text-body-secondary">Project Direct</span>
                      <strong className="text-success">{dirP.toFixed(1)}%</strong>
                    </div>
                  </div>
                )
              })()}
            </>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" size="sm" onClick={() => setAdjustModal(null)}>
            Cancel
          </CButton>
          <CButton color="primary" size="sm" onClick={handleSaveAdjust} disabled={saving}>
            {saving ? <CSpinner size="sm" /> : 'Save Adjustment'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

// ── Lazy-loaded tab content ──────────────────────────────────────────────────

const ProjectExpensesPage = React.lazy(() => import('./ProjectExpensesPage'))
const RevenuePage = React.lazy(() => import('./RevenuePage'))
const PaymentsPage = React.lazy(() => import('./PaymentsPage'))
const LsgbRevenuePage = React.lazy(() => import('./LsgbRevenuePage'))

// ── Main Page ─────────────────────────────────────────────────────────────────

const ExpenseManagementPage = () => {
  const [activeTab, setActiveTab] = useState(0)
  const [drillProject, setDrillProject] = useState(null)

  const handleDrillDown = (project) => {
    setDrillProject(project)
  }
  const handleBack = () => {
    setDrillProject(null)
  }

  return (
    <>
      {/* Page header */}
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h4 className="mb-1 fw-bold">Expense Management</h4>
          <p className="text-body-secondary mb-0 small">
            Organisation expense registers and consolidated cross-project sheet.
          </p>
        </div>
      </div>

      {/* Tabs */}
      {!drillProject && (
        <CNav variant="underline" className="mb-4">
          <CNavItem>
            <CNavLink
              active={activeTab === 0}
              onClick={() => setActiveTab(0)}
              role="button"
              className="fw-medium"
              id="tab-consolidated-sheet"
            >
              <CIcon icon={cilNotes} className="me-1" />
              Consolidated Sheet
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink
              active={activeTab === 1}
              onClick={() => setActiveTab(1)}
              role="button"
              className="fw-medium"
              id="tab-apportionment-sheet"
            >
              <CIcon icon={cilChartPie} className="me-1" />
              Apportionment Sheet
            </CNavLink>
          </CNavItem>
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
          <CNavItem>
            <CNavLink
              active={activeTab === 3}
              onClick={() => setActiveTab(3)}
              role="button"
              className="fw-medium"
              id="tab-revenue"
            >
              <CIcon icon={cilCash} className="me-1" />
              Revenue
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink
              active={activeTab === 4}
              onClick={() => setActiveTab(4)}
              role="button"
              className="fw-medium"
              id="tab-payments"
            >
              <CIcon icon={cilCreditCard} className="me-1" />
              Payments
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink
              active={activeTab === 5}
              onClick={() => setActiveTab(5)}
              role="button"
              className="fw-medium"
              id="tab-lsgb"
            >
              <CIcon icon={cilBank} className="me-1" />
              LSGB
            </CNavLink>
          </CNavItem>
        </CNav>
      )}

      <CTabContent>
        {/* Tab 0: Consolidated Sheet or drill-down */}
        <CTabPane visible={activeTab === 0 || !!drillProject}>
          {drillProject ? (
            <MonthlyDrillDown project={drillProject} onBack={handleBack} />
          ) : (
            <ConsolidatedSheet onDrillDown={handleDrillDown} />
          )}
        </CTabPane>

        {/* Tab 1: Apportionment Sheet */}
        <CTabPane visible={activeTab === 1 && !drillProject}>
          <ApportionmentSheet />
        </CTabPane>

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

        {/* ── Tab 3: Revenue ─────────────────────────────────────────────── */}
        <CTabPane visible={activeTab === 3 && !drillProject}>
          <React.Suspense
            fallback={
              <div className="text-center py-5">
                <CSpinner color="primary" />
              </div>
            }
          >
            <RevenuePage />
          </React.Suspense>
        </CTabPane>

        {/* ── Tab 4: Payments ────────────────────────────────────────────── */}
        <CTabPane visible={activeTab === 4 && !drillProject}>
          <React.Suspense
            fallback={
              <div className="text-center py-5">
                <CSpinner color="primary" />
              </div>
            }
          >
            <PaymentsPage />
          </React.Suspense>
        </CTabPane>

        {/* ── Tab 5: LSGB ────────────────────────────────────────────────── */}
        <CTabPane visible={activeTab === 5 && !drillProject}>
          <React.Suspense
            fallback={
              <div className="text-center py-5">
                <CSpinner color="primary" />
              </div>
            }
          >
            <LsgbRevenuePage />
          </React.Suspense>
        </CTabPane>
      </CTabContent>
    </>
  )
}

export default ExpenseManagementPage
