/**
 * DetailedReportPage.jsx
 * EMS › Reports & Analysis › Detailed Report
 *
 * One consolidated, filterable view per project that joins every module:
 *  - Project basics (PMS) — value, duration, completion, status, officer
 *  - Staff & Payroll + Attendance — assigned people, salary share, last upload
 *  - Contribution — planned by PO (monthly plan) vs actual/dynamic (HR+Core+Admin)
 *  - Apportionment Sheet — simplified per-month split (Show more details)
 *  - Expense Pools — HR/Core/Admin charges allocated to the project, and the
 *    bills where HR explicitly selected this project
 *  - Revenue — HR (recruitment/training/internship) + Attendance (TPC)
 *
 * Filter, sort and search across projects; select one, several or all so the
 * CEO can read everything about a project in one place.
 */
import React, { useState, useMemo, useEffect } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CBadge,
  CButton,
  CCollapse,
  CFormCheck,
  CFormInput,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSearch, cilX, cilChevronBottom, cilChevronTop, cilSync } from '@coreui/icons'

import { localProjects } from '../../../services/localProjects'
import { localOrgPool } from '../../../services/localOrgPool'
import { localPayroll } from '../../../services/localPayroll'
import { localAttendance } from '../../../services/localAttendance'
import { localProjectExpenses } from '../../../services/localProjectExpenses'
import { localRecruitments } from '../../../services/localRecruitments'
import { localInternships } from '../../../services/localInternships'
import { localGeneralExpenses } from '../../../services/localGeneralExpenses'
import { attendanceRevenue } from '../../../services/attendanceRevenue'

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtL = (n) => {
  if (!n && n !== 0) return '—'
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)} L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)} K`
  return `₹${Math.round(n)}`
}

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

const monthLabel = (ym) => {
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const STATUS_COLOR = {
  ongoing: 'success',
  approved: 'info',
  completed: 'secondary',
  pipeline: 'warning',
}

// ── Per-project data assembly ─────────────────────────────────────────────────

const buildProjectReport = async (p) => {
  const pv = p.project_value || p.project_valuation || p.amount_sanctioned || 0
  const bd = localOrgPool.buildProjectMonthlyBreakdown(p)

  const totalAdmin = bd.reduce((s, m) => s + m.adminBudget, 0)
  const totalHr = bd.reduce((s, m) => s + m.hrBudget, 0)
  const totalCore = bd.reduce((s, m) => s + m.coreBudget, 0)
  const totalDirect = bd.reduce((s, m) => s + m.directBudget, 0)

  // Planned by PO — only when a monthly plan exists; the pool percentages
  // applied to the full project value are what the PO committed to.
  const hasPlan = !!p.monthly_plan?.length
  const plannedContribution = hasPlan
    ? (pv * ((p.admin_pct ?? 5) + (p.hr_pct ?? 5) + (p.core_pct ?? 5))) / 100
    : null

  // Assigned people with their salary share toward this project
  const coreDeductions = await localPayroll.computeCoreDeductions(p.id)
  const team = await Promise.all(
    coreDeductions.map(async (d) => ({
      ...d,
      latestAttendance: await localAttendance.getLatestSummary(d.employee.employee_id),
    })),
  )

  // Pool charges allocated to this project (HR can also explicitly pick a
  // project when paying a bill — flagged via entered_by_project_id)
  const hrCharges = await localOrgPool.getProjectHRCharges(p.id)
  const coreCharges = await localOrgPool.getProjectCoreCharges(p.id)
  const directExpenses = await localProjectExpenses.list({ projectId: p.id })

  const hrChargedTotal = hrCharges.reduce((s, c) => s + (c.myAmount || 0), 0)
  const coreChargedTotal = coreCharges.reduce((s, c) => s + (c.myAmount || 0), 0)
  const directSpentTotal = directExpenses.reduce((s, e) => s + (e.amount || 0), 0)

  return {
    project: p,
    pv,
    bd,
    durationMonths: bd.length,
    totalAdmin,
    totalHr,
    totalCore,
    totalDirect,
    hasPlan,
    plannedContribution,
    actualContribution: totalAdmin + totalHr + totalCore,
    team,
    hrCharges,
    coreCharges,
    directExpenses,
    hrChargedTotal,
    coreChargedTotal,
    directSpentTotal,
  }
}

// ── Small building blocks ─────────────────────────────────────────────────────

const Fact = ({ label, value, color }) => (
  <div>
    <div
      className="text-body-secondary"
      style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
    >
      {label}
    </div>
    <div className="fw-semibold" style={{ fontSize: '0.9rem', color: color || undefined }}>
      {value}
    </div>
  </div>
)

const SectionTitle = ({ children }) => (
  <div
    className="fw-semibold text-body-secondary mb-2"
    style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}
  >
    {children}
  </div>
)

// ── Revenue & Expense details (org-wide) ──────────────────────────────────────
// Itemized money-in vs money-out: HR revenue streams, Attendance (TPC) pool,
// and every expense register (HR/Core/Admin pools, General Expenses,
// per-project actuals) with an expandable entry-level table.

const LineRow = ({ label, value, indent, bold, color }) => (
  <div
    className={`d-flex justify-content-between py-1 ${bold ? 'fw-bold border-top mt-1 pt-2' : ''}`}
    style={{ fontSize: '0.85rem', paddingLeft: indent ? 16 : 0 }}
  >
    <span className={bold ? '' : 'text-body-secondary'}>{label}</span>
    <span className="fw-semibold" style={{ color: color || undefined }}>
      {value}
    </span>
  </div>
)

const FinanceDetailsSection = ({ totals, projectNameById }) => {
  const [showEntries, setShowEntries] = useState(false)

  // Every expense entry across registers, newest first
  const allEntries = useMemo(() => {
    const rows = [
      ...totals.hrExpenseEntries.map((e) => ({
        id: `hr-${e.id}`,
        date: e.date || '',
        label: e.label || '—',
        vendor: e.vendor || '',
        source: 'HR Pool',
        color: 'primary',
        amount: parseFloat(e.amount) || 0,
      })),
      ...totals.coreExpenseEntries.map((e) => ({
        id: `core-${e.id}`,
        date: e.date || '',
        label: e.label || '—',
        vendor: e.vendor || '',
        source: 'Core Pool',
        color: 'info',
        amount: parseFloat(e.amount) || 0,
      })),
      ...totals.adminExpenseEntries.map((e) => ({
        id: `admin-${e.id}`,
        date: e.date || '',
        label: e.label || '—',
        vendor: e.vendor || '',
        source: 'Admin Pool',
        color: 'warning',
        amount: parseFloat(e.amount) || 0,
      })),
      ...totals.directEntries.map((e) => ({
        id: `direct-${e.id}`,
        date: e.date || e.month || '',
        label: e.label || '—',
        vendor: projectNameById[e.project_id] || 'Project',
        source: 'Project Direct',
        color: 'success',
        amount: parseFloat(e.amount) || 0,
      })),
    ]
    return rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [totals, projectNameById])

  return (
    <CCard className="border-0 shadow-sm mb-4" style={{ borderRadius: 12 }}>
      <CCardHeader className="d-flex align-items-center justify-content-between flex-wrap gap-2 py-3">
        <div>
          <div className="fw-semibold">Revenue & Expense Details</div>
          <div className="text-body-secondary small">
            All money in (HR revenue, Attendance TPC pool) against all money out (department pools,
            general and project expenses).
          </div>
        </div>
        <CBadge
          color={totals.netPosition >= 0 ? 'success' : 'danger'}
          shape="rounded-pill"
          className="px-3 py-2"
        >
          Net: {totals.netPosition >= 0 ? '' : '−'}
          {fmtL(Math.abs(totals.netPosition))}
        </CBadge>
      </CCardHeader>
      <CCardBody>
        <CRow className="g-4">
          {/* Revenue column */}
          <CCol xs={12} lg={6}>
            <SectionTitle>Revenue</SectionTitle>
            <LineRow label="Recruitment" value={fmtL(totals.recruitmentRevenue)} indent />
            <LineRow label="Training" value={fmtL(totals.trainingRevenue)} indent />
            <LineRow label="Internship" value={fmtL(totals.internshipRevenue)} indent />
            <LineRow label="HR Revenue subtotal" value={fmtL(totals.hrRevenue)} color="#06d6a0" />
            <LineRow
              label="Attendance Deduction Pool (TPC)"
              value={fmtL(totals.attendancePool)}
              color="#4cc9f0"
            />
            <LineRow label="Total Revenue" value={fmtL(totals.totalRevenue)} bold color="#06d6a0" />
          </CCol>

          {/* Expenses column */}
          <CCol xs={12} lg={6}>
            <SectionTitle>Expenses Occurred</SectionTitle>
            <LineRow
              label={`HR Pool expenses (${totals.hrExpenseEntries.length} bill${totals.hrExpenseEntries.length !== 1 ? 's' : ''})`}
              value={fmtL(totals.hrExpenses)}
              indent
            />
            <LineRow
              label={`Core Pool expenses (${totals.coreExpenseEntries.length} bill${totals.coreExpenseEntries.length !== 1 ? 's' : ''})`}
              value={fmtL(totals.coreExpenses)}
              indent
            />
            <LineRow
              label={`Admin Pool expenses (${totals.adminExpenseEntries.length} bill${totals.adminExpenseEntries.length !== 1 ? 's' : ''})`}
              value={fmtL(totals.adminExpenses)}
              indent
            />
            <LineRow
              label="Department pools subtotal"
              value={fmtL(totals.deptExpenses)}
              color="#ef476f"
            />
            <LineRow
              label="General Expenses (actual)"
              value={fmtL(totals.generalActual)}
              color="#f0ad4e"
            />
            <LineRow
              label={`Project direct expenses (${totals.directEntries.length} entr${totals.directEntries.length === 1 ? 'y' : 'ies'})`}
              value={fmtL(totals.directTotal)}
              color="#06d6a0"
            />
            <LineRow
              label="Total Expenses"
              value={fmtL(totals.totalExpenses)}
              bold
              color="#ef476f"
            />
          </CCol>
        </CRow>

        {/* Entry-level expense table */}
        {allEntries.length > 0 && (
          <div className="mt-3">
            <CButton
              size="sm"
              color="secondary"
              variant="outline"
              onClick={() => setShowEntries((v) => !v)}
            >
              {showEntries ? 'Hide' : 'View'} all expense entries ({allEntries.length})
              <CIcon
                icon={showEntries ? cilChevronTop : cilChevronBottom}
                className="ms-1"
                size="sm"
              />
            </CButton>
            <CCollapse visible={showEntries}>
              <div
                className="table-responsive mt-3 border rounded-3"
                style={{ maxHeight: 420, overflowY: 'auto' }}
              >
                <CTable hover align="middle" small className="mb-0" style={{ fontSize: '0.8rem' }}>
                  <CTableHead className="bg-body-tertiary" style={{ position: 'sticky', top: 0 }}>
                    <CTableRow>
                      <CTableHeaderCell className="py-2">Date</CTableHeaderCell>
                      <CTableHeaderCell className="py-2">Expense</CTableHeaderCell>
                      <CTableHeaderCell className="py-2">Source</CTableHeaderCell>
                      <CTableHeaderCell className="py-2">Vendor / Project</CTableHeaderCell>
                      <CTableHeaderCell className="py-2 text-end">Amount</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {allEntries.map((e) => (
                      <CTableRow key={e.id}>
                        <CTableDataCell className="small text-body-secondary">
                          {e.date && e.date.length === 7 ? monthLabel(e.date) : fmtDate(e.date)}
                        </CTableDataCell>
                        <CTableDataCell className="fw-semibold">{e.label}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge
                            color={e.color}
                            shape="rounded-pill"
                            style={{ fontSize: '0.62rem' }}
                          >
                            {e.source}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell className="small">{e.vendor || '—'}</CTableDataCell>
                        <CTableDataCell className="text-end fw-semibold">
                          {fmtL(e.amount)}
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              </div>
            </CCollapse>
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

// ── Project report card ───────────────────────────────────────────────────────

const ProjectReportCard = ({ report }) => {
  const [showMore, setShowMore] = useState(false)
  const { project: p } = report

  return (
    <CCard className="border-0 shadow-sm mb-4" style={{ borderRadius: 12 }}>
      <CCardHeader className="py-3">
        <div className="d-flex align-items-start justify-content-between flex-wrap gap-2">
          <div>
            <h6 className="fw-bold mb-1">{p.title || p.name}</h6>
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <CBadge
                color={STATUS_COLOR[p.status] || 'secondary'}
                shape="rounded-pill"
                style={{ fontSize: '0.68rem', textTransform: 'capitalize' }}
              >
                {p.status || '—'}
              </CBadge>
              <span className="text-body-secondary small">
                {p.project_type || 'Project'}
                {p.funding_agency ? ` · ${p.funding_agency}` : ''}
                {p.location ? ` · ${p.location}` : ''}
              </span>
            </div>
          </div>
          <CButton
            size="sm"
            color="secondary"
            variant="outline"
            onClick={() => setShowMore((v) => !v)}
          >
            {showMore ? 'Hide details' : 'Show more details'}
            <CIcon icon={showMore ? cilChevronTop : cilChevronBottom} className="ms-1" size="sm" />
          </CButton>
        </div>
      </CCardHeader>

      <CCardBody>
        {/* Basic facts */}
        <div className="d-flex flex-wrap gap-4 mb-4">
          <Fact label="Project Value" value={fmtL(report.pv)} color="#4361ee" />
          <Fact
            label="Duration"
            value={`${report.durationMonths} months (${fmtDate(p.start_date)} → ${fmtDate(p.end_date)})`}
          />
          <Fact
            label="Completion"
            value={
              p.tasks_count
                ? `${p.tasks_completed || 0}/${p.tasks_count} phases done`
                : 'No phases recorded'
            }
          />
          <Fact label="Amount Received" value={fmtL(p.amount_received || 0)} />
          <Fact label="Amount Spent" value={fmtL(p.amount_spent || 0)} />
          <Fact label="Project Officer" value={p.officer_name || 'Unassigned'} />
        </div>

        {/* Contribution — planned vs actual */}
        <SectionTitle>Contribution to HMA (Admin + HR + Core)</SectionTitle>
        <CRow className="g-3 mb-4">
          <CCol xs={12} md={4}>
            <div className="border rounded-3 p-3 h-100">
              <div className="small text-body-secondary mb-1">Planned by PO</div>
              {report.hasPlan ? (
                <div className="fw-bold fs-6" style={{ color: '#06d6a0' }}>
                  {fmtL(report.plannedContribution)}
                </div>
              ) : (
                <CBadge color="warning" shape="rounded-pill">
                  Not planned
                </CBadge>
              )}
            </div>
          </CCol>
          <CCol xs={12} md={4}>
            <div className="border rounded-3 p-3 h-100">
              <div className="small text-body-secondary mb-1">
                Actual (dynamic — follows activation & adjustments)
              </div>
              <div className="fw-bold fs-6" style={{ color: '#4361ee' }}>
                {fmtL(report.actualContribution)}
              </div>
              <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                Admin {fmtL(report.totalAdmin)} · HR {fmtL(report.totalHr)} · Core{' '}
                {fmtL(report.totalCore)}
              </div>
            </div>
          </CCol>
          <CCol xs={12} md={4}>
            <div className="border rounded-3 p-3 h-100">
              <div className="small text-body-secondary mb-1">Charged so far from pools</div>
              <div className="fw-bold fs-6" style={{ color: '#f0ad4e' }}>
                {fmtL(report.hrChargedTotal + report.coreChargedTotal)}
              </div>
              <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                HR {fmtL(report.hrChargedTotal)} · Core {fmtL(report.coreChargedTotal)} · Direct
                spend {fmtL(report.directSpentTotal)}
              </div>
            </div>
          </CCol>
        </CRow>

        {/* Assigned team */}
        <SectionTitle>
          Assigned Team ({report.team.length} member{report.team.length !== 1 ? 's' : ''})
        </SectionTitle>
        {report.team.length === 0 ? (
          <div className="text-body-secondary small mb-4">
            No employees are currently assigned to this project.
          </div>
        ) : (
          <div className="table-responsive mb-4">
            <CTable hover align="middle" small className="mb-0" style={{ fontSize: '0.82rem' }}>
              <CTableHead className="bg-body-tertiary">
                <CTableRow>
                  <CTableHeaderCell className="border-0 py-2">Employee</CTableHeaderCell>
                  <CTableHeaderCell className="border-0 py-2">Designation</CTableHeaderCell>
                  <CTableHeaderCell className="border-0 py-2 text-end">Salary</CTableHeaderCell>
                  <CTableHeaderCell className="border-0 py-2 text-end">
                    Monthly Share (this project)
                  </CTableHeaderCell>
                  <CTableHeaderCell className="border-0 py-2">
                    Attendance (last upload)
                  </CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {report.team.map((t) => (
                  <CTableRow key={t.employee.id}>
                    <CTableDataCell>
                      <div className="fw-semibold">{t.employee.employee_name}</div>
                      <div className="text-body-secondary" style={{ fontSize: '0.7rem' }}>
                        {t.employee.employee_id}
                      </div>
                    </CTableDataCell>
                    <CTableDataCell className="small">
                      {t.employee.employment?.designation || '—'}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">{fmtL(t.salary)}</CTableDataCell>
                    <CTableDataCell className="text-end fw-semibold">
                      {fmtL(t.monthlyShare)}
                      {t.allActiveProjects.length > 1 && (
                        <div className="text-body-secondary" style={{ fontSize: '0.68rem' }}>
                          split across {t.allActiveProjects.length} projects
                        </div>
                      )}
                    </CTableDataCell>
                    <CTableDataCell className="small">
                      {t.latestAttendance ? (
                        <>
                          {MONTH_NAMES[t.latestAttendance.month - 1]} {t.latestAttendance.year} —{' '}
                          <span className="text-success">
                            {t.latestAttendance.present_count || 0} present
                          </span>
                          {' / '}
                          <span
                            className={
                              t.latestAttendance.absent_count > 0
                                ? 'text-danger'
                                : 'text-body-secondary'
                            }
                          >
                            {t.latestAttendance.absent_count || 0} absent
                          </span>
                        </>
                      ) : (
                        <span className="text-body-secondary">No upload yet</span>
                      )}
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </div>
        )}

        {/* Expanded details */}
        <CCollapse visible={showMore}>
          {/* Apportionment — simplified */}
          <SectionTitle>Apportionment — Month by Month (simplified)</SectionTitle>
          <div className="table-responsive mb-4">
            <CTable bordered align="middle" small className="mb-0" style={{ fontSize: '0.8rem' }}>
              <CTableHead className="bg-body-tertiary">
                <CTableRow>
                  <CTableHeaderCell className="py-2">Month</CTableHeaderCell>
                  <CTableHeaderCell className="py-2 text-end">Admin</CTableHeaderCell>
                  <CTableHeaderCell className="py-2 text-end">HR</CTableHeaderCell>
                  <CTableHeaderCell className="py-2 text-end">Core</CTableHeaderCell>
                  <CTableHeaderCell className="py-2 text-end">Project Direct</CTableHeaderCell>
                  <CTableHeaderCell className="py-2 text-end">Month Total</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {report.bd.map((m) => (
                  <CTableRow key={m.month}>
                    <CTableDataCell>
                      {monthLabel(m.month)}
                      {!m.isActive && (
                        <CBadge
                          color="secondary"
                          shape="rounded-pill"
                          className="ms-2"
                          style={{ fontSize: '0.6rem' }}
                        >
                          HR/Core frozen
                        </CBadge>
                      )}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">{fmtL(m.adminBudget)}</CTableDataCell>
                    <CTableDataCell className="text-end">
                      {m.isActive ? fmtL(m.hrBudget) : '—'}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                      {m.isActive ? fmtL(m.coreBudget) : '—'}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                      {m.directBudget > 0 ? fmtL(m.directBudget) : '—'}
                    </CTableDataCell>
                    <CTableDataCell className="text-end fw-semibold">
                      {fmtL(m.adminBudget + m.hrBudget + m.coreBudget + m.directBudget)}
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </div>

          {/* Pool expenses charged to this project */}
          <SectionTitle>Shared Pool Expenses Charged to This Project</SectionTitle>
          {report.hrCharges.length === 0 && report.coreCharges.length === 0 ? (
            <div className="text-body-secondary small mb-4">
              No HR/Core pool expenses have been apportioned to this project yet.
            </div>
          ) : (
            <div className="table-responsive mb-4">
              <CTable hover align="middle" small className="mb-0" style={{ fontSize: '0.8rem' }}>
                <CTableHead className="bg-body-tertiary">
                  <CTableRow>
                    <CTableHeaderCell className="py-2">Expense</CTableHeaderCell>
                    <CTableHeaderCell className="py-2">Pool</CTableHeaderCell>
                    <CTableHeaderCell className="py-2">Date</CTableHeaderCell>
                    <CTableHeaderCell className="py-2 text-end">Bill Total</CTableHeaderCell>
                    <CTableHeaderCell className="py-2 text-end">This Project</CTableHeaderCell>
                    <CTableHeaderCell className="py-2">How</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {[
                    ...report.hrCharges.map((c) => ({ ...c, _pool: 'HR' })),
                    ...report.coreCharges.map((c) => ({ ...c, _pool: 'Core' })),
                  ].map((c) => (
                    <CTableRow key={`${c._pool}-${c.id}`}>
                      <CTableDataCell>
                        <div className="fw-semibold">{c.label || '—'}</div>
                        {c.vendor && (
                          <div className="text-body-secondary" style={{ fontSize: '0.68rem' }}>
                            {c.vendor}
                          </div>
                        )}
                      </CTableDataCell>
                      <CTableDataCell>
                        <CBadge
                          color={c._pool === 'HR' ? 'primary' : 'info'}
                          shape="rounded-pill"
                          style={{ fontSize: '0.62rem' }}
                        >
                          {c._pool}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell className="small">{fmtDate(c.date)}</CTableDataCell>
                      <CTableDataCell className="text-end">{fmtL(c.amount)}</CTableDataCell>
                      <CTableDataCell className="text-end fw-semibold">
                        {fmtL(c.myAmount)}
                        <div className="text-body-secondary" style={{ fontSize: '0.66rem' }}>
                          {c.mySharePct}% share
                        </div>
                      </CTableDataCell>
                      <CTableDataCell>
                        {c.isFromThisProject ? (
                          <CBadge
                            color="success"
                            shape="rounded-pill"
                            style={{ fontSize: '0.62rem' }}
                          >
                            HR selected this project
                          </CBadge>
                        ) : (
                          <span className="text-body-secondary" style={{ fontSize: '0.7rem' }}>
                            Common — shared across projects
                          </span>
                        )}
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            </div>
          )}

          {/* Direct project expenses */}
          <SectionTitle>Actual Project Expenses (entered per project)</SectionTitle>
          {report.directExpenses.length === 0 ? (
            <div className="text-body-secondary small mb-4">
              No actual expenses recorded against this project.
            </div>
          ) : (
            <div className="table-responsive mb-4">
              <CTable hover align="middle" small className="mb-0" style={{ fontSize: '0.8rem' }}>
                <CTableHead className="bg-body-tertiary">
                  <CTableRow>
                    <CTableHeaderCell className="py-2">Label</CTableHeaderCell>
                    <CTableHeaderCell className="py-2">Pool</CTableHeaderCell>
                    <CTableHeaderCell className="py-2">Month</CTableHeaderCell>
                    <CTableHeaderCell className="py-2 text-end">Amount</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {report.directExpenses.map((e) => (
                    <CTableRow key={e.id}>
                      <CTableDataCell>{e.label}</CTableDataCell>
                      <CTableDataCell className="text-capitalize small">{e.pool}</CTableDataCell>
                      <CTableDataCell className="small">{monthLabel(e.month)}</CTableDataCell>
                      <CTableDataCell className="text-end fw-semibold">
                        {fmtL(e.amount)}
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            </div>
          )}
        </CCollapse>
      </CCardBody>
    </CCard>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const DetailedReportPage = () => {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('name')
  // null = all projects selected
  const [selectedIds, setSelectedIds] = useState(null)

  const [isSyncing, setIsSyncing] = useState(false)
  const [syncCounter, setSyncCounter] = useState(0)

  const handleSync = () => {
    setIsSyncing(true)
    setSyncCounter((c) => c + 1)
    setTimeout(() => setIsSyncing(false), 800)
  }

  const [allProjects, setAllProjects] = useState([])
  useEffect(() => {
    let cancelled = false
    localProjects.list({ pageSize: 1000 }).then(({ items }) => {
      if (!cancelled) setAllProjects(items || [])
    })
    return () => {
      cancelled = true
    }
  }, [syncCounter])

  const projectNameById = useMemo(
    () => Object.fromEntries(allProjects.map((p) => [p.id, p.title || p.name])),
    [allProjects],
  )

  const [orgTotals, setOrgTotals] = useState({
    hrRevenue: 0,
    recruitmentRevenue: 0,
    trainingRevenue: 0,
    internshipRevenue: 0,
    attendancePool: 0,
    totalRevenue: 0,
    hrExpenses: 0,
    coreExpenses: 0,
    adminExpenses: 0,
    hrExpenseEntries: [],
    coreExpenseEntries: [],
    adminExpenseEntries: [],
    directEntries: [],
    directTotal: 0,
    deptExpenses: 0,
    generalActual: 0,
    totalExpenses: 0,
    netPosition: 0,
  })

  useEffect(() => {
    let active = true
    Promise.all([localRecruitments.list(), localInternships.list()]).then(
      async ([recList, intList]) => {
        if (!active) return

        const recruitmentRevenue = recList
          .filter((r) => (r.activity_type || 'recruitment') === 'recruitment')
          .reduce((s, r) => s + (r.amount_received || 0) + (r.amount_receivable || 0), 0)
        const trainingRevenue = recList
          .filter((r) => r.activity_type === 'training')
          .reduce((s, r) => s + (r.amount_received || 0) + (r.amount_receivable || 0), 0)
        const internshipRevenue = intList.reduce(
          (s, r) => s + (r.amount_received || 0) + (r.amount_receivable || 0),
          0,
        )
        const hrRevenue = recruitmentRevenue + trainingRevenue + internshipRevenue
        const attendancePool = attendanceRevenue.getTotalPool().total

        // Expenses occurred — itemized entries from every register
        const hrExpenseEntries = await localOrgPool.getAllHRExpenses()
        const coreExpenseEntries = await localOrgPool.getAllCoreExpenses()
        const adminExpenseEntries = await localOrgPool.getAllAdminExpenses()
        const directEntries = await localProjectExpenses.list()

        const sumAmt = (rows) => rows.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
        const hrExpenses = sumAmt(hrExpenseEntries)
        const coreExpenses = sumAmt(coreExpenseEntries)
        const adminExpenses = sumAmt(adminExpenseEntries)
        const directTotal = sumAmt(directEntries)

        let generalActual = 0
        try {
          generalActual = (
            await localGeneralExpenses.expenses.list({ page_size: 10000 })
          ).items.reduce((s, e) => s + (parseFloat(e.actual_amount) || 0), 0)
        } catch {
          generalActual = 0
        }

        const deptExpenses = hrExpenses + coreExpenses + adminExpenses
        const totalRevenue = hrRevenue + attendancePool
        const totalExpenses = deptExpenses + generalActual + directTotal

        setOrgTotals({
          hrRevenue,
          recruitmentRevenue,
          trainingRevenue,
          internshipRevenue,
          attendancePool,
          totalRevenue,
          hrExpenses,
          coreExpenses,
          adminExpenses,
          hrExpenseEntries,
          coreExpenseEntries,
          adminExpenseEntries,
          directEntries,
          directTotal,
          deptExpenses,
          generalActual,
          totalExpenses,
          netPosition: totalRevenue - totalExpenses,
        })
      },
    )

    return () => {
      active = false
    }
  }, [syncCounter])

  // ── Filter / sort / search over projects ─────────────────────────────────
  const visibleProjects = useMemo(() => {
    let list = [...allProjects]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (p) =>
          (p.title || p.name || '').toLowerCase().includes(q) ||
          (p.project_type || '').toLowerCase().includes(q) ||
          (p.officer_name || '').toLowerCase().includes(q) ||
          (p.location || '').toLowerCase().includes(q),
      )
    }
    if (statusFilter) list = list.filter((p) => p.status === statusFilter)

    const value = (p) => p.project_value || p.project_valuation || p.amount_sanctioned || 0
    const months = (p) => {
      if (!p.start_date || !p.end_date) return 0
      const [sy, sm] = p.start_date.split('-').map(Number)
      const [ey, em] = p.end_date.split('-').map(Number)
      return (ey - sy) * 12 + (em - sm) + 1
    }
    list.sort((a, b) => {
      if (sortBy === 'value') return value(b) - value(a)
      if (sortBy === 'duration') return months(b) - months(a)
      return (a.title || a.name || '').localeCompare(b.title || b.name || '')
    })
    return list
  }, [allProjects, search, statusFilter, sortBy])

  const isAllSelected = selectedIds === null
  const selectedProjects = useMemo(
    () =>
      isAllSelected ? visibleProjects : visibleProjects.filter((p) => selectedIds.includes(p.id)),
    [visibleProjects, selectedIds, isAllSelected],
  )

  const toggleProject = (id) => {
    if (isAllSelected) {
      // Switching from "all" to an explicit selection of just this project
      setSelectedIds([id])
      return
    }
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  // Reports are built only for the selected projects — this is the heavy part.
  const [reports, setReports] = useState([])
  useEffect(() => {
    let cancelled = false
    Promise.all(selectedProjects.map((p) => buildProjectReport(p))).then((built) => {
      if (!cancelled) setReports(built)
    })
    return () => {
      cancelled = true
    }
  }, [selectedProjects])

  return (
    <>
      {/* Header */}
      <div className="mb-4 d-flex justify-content-between align-items-start flex-wrap gap-3">
        <div>
          <h4 className="fw-bold mb-1">Detailed Report</h4>
          <p className="text-body-secondary mb-0 small">
            Everything about a project in one place — project data, team & attendance, pool
            contributions, apportionment and expenses, side by side.
          </p>
        </div>
        <CButton
          color="primary"
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={isSyncing}
        >
          <CIcon icon={cilSync} className="me-2" />
          {isSyncing ? 'Syncing...' : 'Sync Data'}
        </CButton>
      </div>

      {/* Org-wide revenue & expenses strip */}
      <CRow className="g-3 mb-4">
        {[
          {
            label: 'Total Revenue',
            value: fmtL(orgTotals.totalRevenue),
            sub: `HR ${fmtL(orgTotals.hrRevenue)} · Attendance (TPC) ${fmtL(orgTotals.attendancePool)}`,
            color: '#06d6a0',
          },
          {
            label: 'Department Expenses',
            value: fmtL(orgTotals.deptExpenses),
            sub: `HR ${fmtL(orgTotals.hrExpenses)} · Core ${fmtL(orgTotals.coreExpenses)} · Admin ${fmtL(orgTotals.adminExpenses)}`,
            color: '#ef476f',
          },
          {
            label: 'General Expenses (actual)',
            value: fmtL(orgTotals.generalActual),
            sub: 'From General Expenses divisions',
            color: '#f0ad4e',
          },
          {
            label: 'Projects',
            value: allProjects.length,
            sub: `${selectedProjects.length} selected in this report`,
            color: '#4361ee',
          },
        ].map((stat) => (
          <CCol key={stat.label} xs={12} sm={6} xl={3}>
            <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
              <CCardBody className="py-3">
                <div className="fw-bold fs-5 lh-1 mb-1" style={{ color: stat.color }}>
                  {stat.value}
                </div>
                <div className="small text-body-secondary">{stat.label}</div>
                <div className="text-body-secondary mt-1" style={{ fontSize: '0.7rem' }}>
                  {stat.sub}
                </div>
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>

      {/* Itemized revenue + expenses occurred */}
      <FinanceDetailsSection totals={orgTotals} projectNameById={projectNameById} />

      {/* Controls */}
      <CCard className="border-0 shadow-sm mb-4" style={{ borderRadius: 12 }}>
        <CCardBody className="py-3">
          <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
            <CInputGroup size="sm" style={{ maxWidth: 320 }}>
              <CInputGroupText>
                <CIcon icon={cilSearch} size="sm" />
              </CInputGroupText>
              <CFormInput
                placeholder="Search project, type, officer, location…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <CButton color="secondary" variant="ghost" size="sm" onClick={() => setSearch('')}>
                  <CIcon icon={cilX} size="sm" />
                </CButton>
              )}
            </CInputGroup>
            <CFormSelect
              size="sm"
              style={{ width: 150 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="ongoing">Ongoing</option>
              <option value="approved">Approved</option>
              <option value="completed">Completed</option>
              <option value="pipeline">Pipeline</option>
            </CFormSelect>
            <CFormSelect
              size="sm"
              style={{ width: 170 }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort projects"
            >
              <option value="name">Sort: Name</option>
              <option value="value">Sort: Value (high → low)</option>
              <option value="duration">Sort: Duration (long → short)</option>
            </CFormSelect>
          </div>

          {/* Project selection */}
          <div className="d-flex flex-wrap gap-3 align-items-center">
            <CFormCheck
              id="detailed-report-all"
              label={<strong>All projects</strong>}
              checked={isAllSelected}
              onChange={() => setSelectedIds(isAllSelected ? [] : null)}
            />
            {visibleProjects.map((p) => (
              <CFormCheck
                key={p.id}
                id={`detailed-report-${p.id}`}
                label={p.title || p.name}
                checked={isAllSelected || selectedIds.includes(p.id)}
                onChange={() => toggleProject(p.id)}
              />
            ))}
          </div>
        </CCardBody>
      </CCard>

      {/* Project reports */}
      {reports.length === 0 ? (
        <div className="text-center text-body-secondary py-5 small border rounded-3">
          No projects selected. Pick one or more projects above — or tick “All projects”.
        </div>
      ) : (
        reports.map((r) => <ProjectReportCard key={r.project.id} report={r} />)
      )}
    </>
  )
}

export default DetailedReportPage
