import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CProgress, CRow, CCol } from '@coreui/react'
import { localGeneralExpenses } from '../../../../services/localGeneralExpenses'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)

const GeneralExpenseWidget = () => {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    const year = new Date().getFullYear()
    localGeneralExpenses.analysis.get(year).then((analysis) => {
      if (cancelled) return
      const now = new Date()
      const month = now.getMonth() + 1
      const monthly = analysis.monthly_summary.find((m) => m.month === month)

      setData({
        ytd_planned: analysis.ytd_planned,
        ytd_actual: analysis.ytd_actual,
        month_planned: monthly?.planned_total || 0,
        month_actual: monthly?.actual_total || 0,
        count: analysis.monthly_summary.reduce((s, m) => s + m.record_count, 0),
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return null

  const variance = data.ytd_actual - data.ytd_planned
  const utilPct =
    data.ytd_planned > 0 ? Math.min(100, Math.round((data.ytd_actual / data.ytd_planned) * 100)) : 0

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4">
        <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">
          General Expenses — {new Date().getFullYear()}
        </h6>
        <CRow className="g-2 mb-3">
          <CCol xs={6}>
            <div className="small text-body-secondary mb-1">YTD Planned</div>
            <div className="fw-bold" style={{ color: '#4361ee' }}>
              {fmt(data.ytd_planned)}
            </div>
          </CCol>
          <CCol xs={6}>
            <div className="small text-body-secondary mb-1">YTD Actual</div>
            <div
              className="fw-bold"
              style={{ color: data.ytd_actual > data.ytd_planned ? '#ef476f' : '#06d6a0' }}
            >
              {fmt(data.ytd_actual)}
            </div>
          </CCol>
          <CCol xs={6}>
            <div className="small text-body-secondary mb-1">This Month</div>
            <div className="fw-semibold text-body">{fmt(data.month_actual)}</div>
          </CCol>
          <CCol xs={6}>
            <div className="small text-body-secondary mb-1">Variance</div>
            <div className="fw-semibold" style={{ color: variance > 0 ? '#ef476f' : '#06d6a0' }}>
              {variance > 0 ? '+' : ''}
              {fmt(variance)}
            </div>
          </CCol>
        </CRow>
        <CProgress
          value={utilPct}
          height={6}
          color={utilPct > 100 ? 'danger' : utilPct > 85 ? 'warning' : 'success'}
          className="rounded-pill mb-1"
        />
        <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
          {utilPct}% budget utilised · {data.count} entries
        </div>
      </CCardBody>
    </CCard>
  )
}

export default GeneralExpenseWidget
