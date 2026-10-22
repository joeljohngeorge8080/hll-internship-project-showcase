// src/modules/ems/expense-management/RevenuePage.jsx
import React, { useState, useEffect } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CBadge,
  CFormSelect,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
} from '@coreui/react'
import { localRecruitments } from '../../../services/localRecruitments'
import { localInternships } from '../../../services/localInternships'
import { localProjects } from '../../../services/localProjects'
import { localOrgPool } from '../../../services/localOrgPool'
import { localLsgbRevenue } from '../../../services/localLsgbRevenue'
import { computeEffectivePoolMonthly } from '../../../services/monthlyApportionment'

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

const StatCard = ({ label, value, color }) => (
  <CCard className={`border-top border-top-${color} border-3 text-center h-100`}>
    <CCardBody className="py-3">
      <div className="small text-body-secondary mb-1">{label}</div>
      <div className={`fw-bold fs-5 text-${color}`}>{fmt(value)}</div>
    </CCardBody>
  </CCard>
)

/**
 * Company-wide revenue rollup:
 *  - HR Revenue: sums of amount_received across Recruitment, Training
 *    (both from localRecruitments, split by activity_type), and Internship
 *    (localInternships).
 *  - Project Shares: the total Admin/HR/Core pool money every planned
 *    project has generated, summed across every month of every project's
 *    monthly_plan via computeEffectivePoolMonthly (System B — the same
 *    figures the Monthly Plan / Planning Summary already show per project,
 *    rolled up company-wide here).
 */
const RevenuePage = () => {
  const [selectedMonth, setSelectedMonth] = useState('')

  const [recruitmentRows, setRecruitmentRows] = useState([])
  const [internshipRows, setInternshipRows] = useState([])

  useEffect(() => {
    let active = true
    localRecruitments.list().then((data) => {
      if (active) setRecruitmentRows(data || [])
    })
    localInternships.list().then((data) => {
      if (active) setInternshipRows(data || [])
    })
    return () => {
      active = false
    }
  }, [])

  const recruitmentRevenue = recruitmentRows
    .filter((r) => (r.activity_type || 'recruitment') === 'recruitment')
    .reduce((s, r) => s + (r.amount_received || 0) + (r.amount_receivable || 0), 0)
  const trainingRevenue = recruitmentRows
    .filter((r) => r.activity_type === 'training')
    .reduce((s, r) => s + (r.amount_received || 0) + (r.amount_receivable || 0), 0)

  const internshipRevenue = internshipRows.reduce(
    (s, r) => s + (r.amount_received || 0) + (r.amount_receivable || 0),
    0,
  )

  const hrRevenueTotal = recruitmentRevenue + trainingRevenue + internshipRevenue

  const [lsgbBalance, setLsgbBalance] = useState(0)
  const [lsgbUsed, setLsgbUsed] = useState(0)
  useEffect(() => {
    let active = true
    Promise.all([localLsgbRevenue.get(), localOrgPool.getLsgbRevenueUsed()]).then(
      ([lsgb, used]) => {
        if (!active) return
        setLsgbBalance(parseFloat(lsgb?.balance) || 0)
        setLsgbUsed(used)
      },
    )
    return () => {
      active = false
    }
  }, [])
  const lsgbAvailable = Math.max(0, lsgbBalance - lsgbUsed)

  const [plannedProjects, setPlannedProjects] = useState([])
  useEffect(() => {
    let cancelled = false
    localProjects.list({ pageSize: 1000 }).then(({ items }) => {
      if (!cancelled) setPlannedProjects(items.filter((p) => p.monthly_plan?.length > 0))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const allMonths = [
    ...new Set(plannedProjects.flatMap((p) => p.monthly_plan.map((m) => m.month))),
  ].sort()

  const poolTotalForProject = (p, pool) => {
    if (!selectedMonth) {
      return p.monthly_plan.reduce((s, m) => s + computeEffectivePoolMonthly(p, pool, m.month), 0)
    }
    const hasMonth = p.monthly_plan.some((m) => m.month === selectedMonth)
    return hasMonth ? computeEffectivePoolMonthly(p, pool, selectedMonth) : 0
  }

  const projectShareRows = plannedProjects
    .filter((p) => !selectedMonth || p.monthly_plan.some((m) => m.month === selectedMonth))
    .map((p) => ({
      id: p.id,
      name: p.name || p.title,
      admin: poolTotalForProject(p, 'admin'),
      hr: poolTotalForProject(p, 'hr'),
      core: poolTotalForProject(p, 'core'),
    }))
  const adminShare = projectShareRows.reduce((s, r) => s + r.admin, 0)
  const hrShare = projectShareRows.reduce((s, r) => s + r.hr, 0)
  const coreShare = projectShareRows.reduce((s, r) => s + r.core, 0)
  const projectSharesTotal = adminShare + hrShare + coreShare

  const grandTotal = hrRevenueTotal + projectSharesTotal

  return (
    <>
      <div className="mb-3">
        <p className="text-body-secondary small mb-0">
          Company-wide revenue: HR revenue (Recruitment, Training, Internship fees) and every
          planned project's Admin/HR/Core pool shares, rolled up.
        </p>
      </div>

      <CCard className="mb-4 border-0 shadow-sm" style={{ background: 'var(--cui-tertiary-bg)' }}>
        <CCardBody className="text-center py-4">
          <div className="small text-body-secondary mb-1">Total Revenue</div>
          <div className="fw-bold fs-2 text-success">{fmt(grandTotal)}</div>
        </CCardBody>
      </CCard>

      {/* HR Revenue */}
      <CCard className="mb-4">
        <CCardHeader className="bg-transparent fw-semibold">💼 HR Revenue</CCardHeader>
        <CCardBody>
          <CRow className="g-3 mb-3">
            <CCol xs={6} md={3}>
              <StatCard label="Recruitment" value={recruitmentRevenue} color="primary" />
            </CCol>
            <CCol xs={6} md={3}>
              <StatCard label="Training" value={trainingRevenue} color="info" />
            </CCol>
            <CCol xs={6} md={3}>
              <StatCard label="Internship" value={internshipRevenue} color="warning" />
            </CCol>
            <CCol xs={6} md={3}>
              <StatCard label="HR Revenue Total" value={hrRevenueTotal} color="success" />
            </CCol>
          </CRow>

          <div style={{ overflowX: 'auto' }}>
            <CTable small hover align="middle" className="mb-0" style={{ fontSize: '0.82rem' }}>
              <CTableHead color="light">
                <CTableRow>
                  <CTableHeaderCell>Type</CTableHeaderCell>
                  <CTableHeaderCell>Name</CTableHeaderCell>
                  <CTableHeaderCell>Details</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Amount</CTableHeaderCell>
                  <CTableHeaderCell>Payment</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {recruitmentRows.length === 0 && internshipRows.length === 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={5} className="text-center text-body-secondary py-4">
                      No HR revenue records yet.
                    </CTableDataCell>
                  </CTableRow>
                )}
                {recruitmentRows.map((r) => (
                  <CTableRow key={r.id}>
                    <CTableDataCell>
                      <CBadge color={r.activity_type === 'training' ? 'info' : 'primary'}>
                        {r.activity_type === 'training' ? 'Training' : 'Recruitment'}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>{r.candidate_name}</CTableDataCell>
                    <CTableDataCell className="small text-body-secondary">
                      {r.position || '—'}
                    </CTableDataCell>
                    <CTableDataCell className="text-end fw-semibold">
                      {fmt(r.amount_received)}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={r.payment_status === 'Paid' ? 'success' : 'warning'}>
                        {r.payment_status}
                      </CBadge>
                    </CTableDataCell>
                  </CTableRow>
                ))}
                {internshipRows.map((r) => (
                  <CTableRow key={r.id}>
                    <CTableDataCell>
                      <CBadge color="warning" textColor="dark">
                        Internship
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>{r.name}</CTableDataCell>
                    <CTableDataCell className="small text-body-secondary">
                      {r.institution || '—'}
                    </CTableDataCell>
                    <CTableDataCell className="text-end fw-semibold">
                      {fmt(r.amount_received)}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={r.payment_status === 'Paid' ? 'success' : 'warning'}>
                        {r.payment_status}
                      </CBadge>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </div>
        </CCardBody>
      </CCard>

      {/* LSGB Revenue */}
      <CCard className="mb-4">
        <CCardHeader className="bg-transparent fw-semibold">🏛 LSGB Revenue</CCardHeader>
        <CCardBody>
          <CRow className="g-3">
            <CCol xs={6} md={4}>
              <StatCard label="Sanctioned Balance" value={lsgbBalance} color="primary" />
            </CCol>
            <CCol xs={6} md={4}>
              <StatCard label="Used" value={lsgbUsed} color="warning" />
            </CCol>
            <CCol xs={6} md={4}>
              <StatCard label="Available" value={lsgbAvailable} color="success" />
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {/* Project Shares */}
      <CCard className="mb-4">
        <CCardHeader className="bg-transparent fw-semibold d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span>🏗 Project Shares</span>
          <CFormSelect
            size="sm"
            style={{ maxWidth: 200 }}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            <option value="">All months</option>
            {allMonths.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </CFormSelect>
        </CCardHeader>
        <CCardBody>
          <CRow className="g-3 mb-3">
            <CCol xs={6} md={3}>
              <StatCard label="Admin" value={adminShare} color="warning" />
            </CCol>
            <CCol xs={6} md={3}>
              <StatCard label="HR" value={hrShare} color="primary" />
            </CCol>
            <CCol xs={6} md={3}>
              <StatCard label="Core" value={coreShare} color="danger" />
            </CCol>
            <CCol xs={6} md={3}>
              <StatCard label="Project Shares Total" value={projectSharesTotal} color="success" />
            </CCol>
          </CRow>

          <div style={{ overflowX: 'auto' }}>
            <CTable small hover align="middle" className="mb-0" style={{ fontSize: '0.82rem' }}>
              <CTableHead color="light">
                <CTableRow>
                  <CTableHeaderCell>Project</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Admin</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">HR</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Core</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Total</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {projectShareRows.length === 0 ? (
                  <CTableRow>
                    <CTableDataCell colSpan={5} className="text-center text-body-secondary py-4">
                      {selectedMonth
                        ? `No projects have a share for ${monthLabel(selectedMonth)}.`
                        : 'No planned projects yet.'}
                    </CTableDataCell>
                  </CTableRow>
                ) : (
                  projectShareRows.map((r) => (
                    <CTableRow key={r.id}>
                      <CTableDataCell className="fw-semibold">{r.name}</CTableDataCell>
                      <CTableDataCell className="text-end">{fmt(r.admin)}</CTableDataCell>
                      <CTableDataCell className="text-end">{fmt(r.hr)}</CTableDataCell>
                      <CTableDataCell className="text-end">{fmt(r.core)}</CTableDataCell>
                      <CTableDataCell className="text-end fw-semibold">
                        {fmt(r.admin + r.hr + r.core)}
                      </CTableDataCell>
                    </CTableRow>
                  ))
                )}
              </CTableBody>
            </CTable>
          </div>
        </CCardBody>
      </CCard>
    </>
  )
}

export default RevenuePage
