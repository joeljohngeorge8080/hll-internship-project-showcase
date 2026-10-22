/**
 * HRPerformanceWidget.jsx  ─  "How Is HR Doing?"
 *
 * Dashboard version of Super Forecasting's HR section: HR revenue
 * (recruitment + training + internship) vs HR's own cost (operating
 * vendor contracts tagged HR + Expense Pools' HR expenses), expressed as
 * a plain coverage percentage.
 */
import React, { useEffect, useState } from 'react'
import { CCard, CCardBody } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPeople } from '@coreui/icons'
import { computeHRRevenueBreakdown, computeHRHealth } from '../../../../services/forecastData'

const fmtL = (n) => {
  if (!n && n !== 0) return '₹0'
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)} L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(0)} K`
  return `₹${Math.round(n)}`
}

const HRPerformanceWidget = () => {
  const [data, setData] = useState(null)

  useEffect(() => {
    const year = new Date().getFullYear()
    computeHRRevenueBreakdown().then(async (revenue) => {
      const health = await computeHRHealth(`${year}-01`, `${year}-12`, revenue.total)
      setData({ revenue, health })
    })
  }, [])

  if (!data) return null

  const { revenue, health } = data

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 16, overflow: 'hidden' }}>
      <CCardBody className="p-0">
        <div
          style={{
            padding: '14px 20px 10px',
            borderBottom: '1px solid var(--cui-border-color,#dee2e6)',
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <CIcon
              icon={cilPeople}
              style={{ width: 18, height: 18, color: 'var(--cui-primary)' }}
            />
            <div>
              <div
                className="fw-bold"
                style={{ fontSize: '0.85rem', color: 'var(--cui-body-color)' }}
              >
                How Is HR Doing?
              </div>
              <div
                className="text-body-secondary"
                style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                Revenue earned vs HR's own cost
              </div>
            </div>
          </div>
        </div>

        <div className="p-4">
          {health.totalCost > 0 ? (
            <div style={{ fontSize: '0.85rem' }}>
              HR earned{' '}
              <strong className="text-success" style={{ fontFamily: "'Fira Code', monospace" }}>
                {fmtL(revenue.total)}
              </strong>{' '}
              and cost{' '}
              <strong className="text-danger" style={{ fontFamily: "'Fira Code', monospace" }}>
                {fmtL(health.totalCost)}
              </strong>{' '}
              — HR covers <strong>{health.coveragePct}%</strong> of its own cost.
            </div>
          ) : (
            <div className="text-body-secondary" style={{ fontSize: '0.8rem' }}>
              HR has no recorded cost this period.
            </div>
          )}
          <div className="text-body-secondary mt-3" style={{ fontSize: '0.65rem' }}>
            Recruitment {fmtL(revenue.recruitment)} · Training {fmtL(revenue.training)} · Internship{' '}
            {fmtL(revenue.internship)}
          </div>
        </div>
      </CCardBody>
    </CCard>
  )
}

export default HRPerformanceWidget
