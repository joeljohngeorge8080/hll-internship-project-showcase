import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CRow, CCol } from '@coreui/react'
import { localProjects } from '../../../../services/localProjects'
import { localOrgPool } from '../../../../services/localOrgPool'

const fmtCompact = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n || 0)

const ExpenseManagementWidget = () => {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const allProjects = await localProjects.dashboardList()
      let sumAdmin = 0,
        sumHr = 0,
        sumCore = 0,
        sumDirect = 0
      let sumHrUsed = 0,
        sumCoreUsed = 0
      for (const p of allProjects) {
        const bd = localOrgPool.buildProjectMonthlyBreakdown(p)
        sumAdmin += bd.reduce((s, m) => s + m.adminBudget, 0)
        sumHr += bd.reduce((s, m) => s + m.hrBudget, 0)
        sumCore += bd.reduce((s, m) => s + m.coreBudget, 0)
        sumDirect += bd.reduce((s, m) => s + m.directBudget, 0)
        sumHrUsed += (await localOrgPool.getProjectHRBudgetSummary(p.id)).totalCharged || 0
        sumCoreUsed += (await localOrgPool.getProjectCoreBudgetSummary(p.id)).totalCharged || 0
      }
      if (!cancelled) {
        setData({
          sumAdmin,
          sumHr,
          sumCore,
          sumDirect,
          sumHrUsed,
          sumCoreUsed,
          projectCount: allProjects.length,
        })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return null

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4">
        <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">
          Expense Management — {data.projectCount} project{data.projectCount !== 1 ? 's' : ''}
        </h6>
        <CRow className="g-2">
          <CCol xs={6}>
            <div className="small text-body-secondary mb-1">Admin Budget</div>
            <div className="fw-bold" style={{ color: '#f77f00' }}>
              {fmtCompact(data.sumAdmin)}
            </div>
          </CCol>
          <CCol xs={6}>
            <div className="small text-body-secondary mb-1">HR Budget</div>
            <div className="fw-bold" style={{ color: '#4361ee' }}>
              {fmtCompact(data.sumHr)}
            </div>
          </CCol>
          <CCol xs={6}>
            <div className="small text-body-secondary mb-1">Core Budget</div>
            <div className="fw-bold" style={{ color: '#06d6a0' }}>
              {fmtCompact(data.sumCore)}
            </div>
          </CCol>
          <CCol xs={6}>
            <div className="small text-body-secondary mb-1">Direct Budget</div>
            <div className="fw-bold text-body">{fmtCompact(data.sumDirect)}</div>
          </CCol>
        </CRow>
        <div className="text-body-secondary mt-2" style={{ fontSize: '0.72rem' }}>
          Used so far: HR {fmtCompact(data.sumHrUsed)} · Core {fmtCompact(data.sumCoreUsed)}
        </div>
      </CCardBody>
    </CCard>
  )
}

export default ExpenseManagementWidget
