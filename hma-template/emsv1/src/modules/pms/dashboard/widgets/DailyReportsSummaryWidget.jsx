import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CRow, CCol } from '@coreui/react'
import { localReports, REPORT_STATUS } from '../../../../services/localReports'

const DailyReportsSummaryWidget = () => {
  const [counts, setCounts] = useState(null)

  useEffect(() => {
    let cancelled = false
    localReports
      .seedDemoData()
      .then(() => localReports.list({ pageSize: 9999 }))
      .then(({ items }) => {
        if (cancelled) return
        const pending = items.filter(
          (r) => r.status === REPORT_STATUS.SUBMITTED || r.status === REPORT_STATUS.RESUBMITTED,
        ).length
        const approved = items.filter((r) => r.status === REPORT_STATUS.APPROVED).length
        const declined = items.filter((r) => r.status === REPORT_STATUS.DECLINED).length
        const settled = items.filter((r) => r.status === REPORT_STATUS.SETTLED).length
        setCounts({ pending, approved, declined, settled, total: items.length })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!counts) return null

  const rows = [
    {
      label: 'Pending Review',
      value: counts.pending,
      color: '#f0ad4e',
      bg: 'rgba(240,173,78,0.10)',
    },
    { label: 'Approved', value: counts.approved, color: '#06d6a0', bg: 'rgba(6,214,160,0.10)' },
    { label: 'Declined', value: counts.declined, color: '#ef476f', bg: 'rgba(239,71,111,0.10)' },
    { label: 'Settled', value: counts.settled, color: '#4361ee', bg: 'rgba(67,97,238,0.10)' },
  ]

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4">
        <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">Daily Reports</h6>
        <CRow className="g-2">
          {rows.map((item) => (
            <CCol xs={6} key={item.label}>
              <div className="rounded-3 text-center py-2 px-1" style={{ background: item.bg }}>
                <div className="fw-bold fs-5 lh-1 mb-1" style={{ color: item.color }}>
                  {item.value}
                </div>
                <div className="small text-body-secondary">{item.label}</div>
              </div>
            </CCol>
          ))}
        </CRow>
        <div className="mt-3 text-body-secondary" style={{ fontSize: '0.72rem' }}>
          {counts.total} total reports across all projects
        </div>
      </CCardBody>
    </CCard>
  )
}

export default DailyReportsSummaryWidget
