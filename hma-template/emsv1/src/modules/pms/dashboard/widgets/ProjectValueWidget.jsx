import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CProgress, CRow, CCol } from '@coreui/react'
import { localProjects } from '../../../../services/localProjects'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(n)

const ProjectValueWidget = () => {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let cancelled = false
    localProjects.seedDemoData()
    localProjects.getStats().then((s) => {
      if (!cancelled) setStats(s)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!stats) return null

  const receivedPct =
    stats.totalValue > 0
      ? Math.min(100, Math.round((stats.totalReceived / stats.totalValue) * 100))
      : 0
  const spentPct =
    stats.totalValue > 0
      ? Math.min(100, Math.round((stats.totalSpent / stats.totalValue) * 100))
      : 0

  const typeData = [
    { label: 'Consultancy', count: stats.types.consultancy, color: '#4361ee' },
    { label: 'Public Health', count: stats.types.health, color: '#2ec4b6' },
    { label: 'M-CUP', count: stats.types.mcup, color: '#f77f00' },
  ]

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4">
        <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">
          Portfolio Financials
        </h6>
        <CRow className="g-2 mb-3">
          <CCol xs={4} className="text-center">
            <div className="small text-body-secondary mb-1">Total Value</div>
            <div className="fw-bold" style={{ color: '#4361ee' }}>
              {fmt(stats.totalValue)}
            </div>
          </CCol>
          <CCol xs={4} className="text-center">
            <div className="small text-body-secondary mb-1">Received</div>
            <div className="fw-bold" style={{ color: '#06d6a0' }}>
              {fmt(stats.totalReceived)}
            </div>
          </CCol>
          <CCol xs={4} className="text-center">
            <div className="small text-body-secondary mb-1">Utilised</div>
            <div className="fw-bold" style={{ color: '#f77f00' }}>
              {fmt(stats.totalSpent)}
            </div>
          </CCol>
        </CRow>
        <div className="mb-1">
          <div className="d-flex justify-content-between mb-1">
            <span className="small text-body-secondary">Received</span>
            <span className="small fw-semibold">{receivedPct}%</span>
          </div>
          <CProgress value={receivedPct} height={5} color="success" className="rounded-pill mb-2" />
          <div className="d-flex justify-content-between mb-1">
            <span className="small text-body-secondary">Utilised</span>
            <span className="small fw-semibold">{spentPct}%</span>
          </div>
          <CProgress value={spentPct} height={5} color="warning" className="rounded-pill mb-3" />
        </div>
        <div
          className="text-body-secondary mb-1"
          style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}
        >
          By Type
        </div>
        <div className="d-flex gap-2 flex-wrap">
          {typeData.map((t) => (
            <div
              key={t.label}
              className="rounded-pill px-2 py-1 small d-flex align-items-center gap-1"
              style={{ background: `${t.color}15` }}
            >
              <span className="fw-bold" style={{ color: t.color }}>
                {t.count}
              </span>
              <span className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                {t.label}
              </span>
            </div>
          ))}
        </div>
      </CCardBody>
    </CCard>
  )
}

export default ProjectValueWidget
