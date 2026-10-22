import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CRow, CCol, CProgress } from '@coreui/react'
import { localReports, REPORT_STATUS } from '../../../../services/localReports'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)

const SettlementsWidget = () => {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    localReports
      .seedDemoData()
      .then(() => localReports.list({ pageSize: 9999 }))
      .then(({ items }) => {
        if (cancelled) return
        const approved = items.filter((r) => r.status === REPORT_STATUS.APPROVED)
        const settled = items.filter((r) => r.status === REPORT_STATUS.SETTLED)

        const pendingAmount = approved.reduce((s, r) => s + (r.bill_amount || 0), 0)
        const settledAmount = settled.reduce((s, r) => s + (r.bill_amount || 0), 0)
        const totalAmount = pendingAmount + settledAmount

        const settlePct = totalAmount > 0 ? Math.round((settledAmount / totalAmount) * 100) : 0

        setData({
          pendingCount: approved.length,
          settledCount: settled.length,
          pendingAmount,
          settledAmount,
          settlePct,
        })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return null

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4">
        <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">Settlements</h6>
        <CRow className="g-2 mb-3">
          <CCol xs={6}>
            <div className="small text-body-secondary mb-1">Pending</div>
            <div className="fw-bold fs-5 lh-1 mb-0" style={{ color: '#f0ad4e' }}>
              {data.pendingCount}
            </div>
            <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
              {fmt(data.pendingAmount)}
            </div>
          </CCol>
          <CCol xs={6}>
            <div className="small text-body-secondary mb-1">Settled</div>
            <div className="fw-bold fs-5 lh-1 mb-0" style={{ color: '#06d6a0' }}>
              {data.settledCount}
            </div>
            <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
              {fmt(data.settledAmount)}
            </div>
          </CCol>
        </CRow>
        <div className="d-flex justify-content-between mb-1">
          <span className="small text-body-secondary">Settlement Rate</span>
          <span className="small fw-semibold">{data.settlePct}%</span>
        </div>
        <CProgress
          value={data.settlePct}
          height={6}
          color={data.settlePct >= 75 ? 'success' : 'warning'}
          className="rounded-pill"
        />
      </CCardBody>
    </CCard>
  )
}

export default SettlementsWidget
