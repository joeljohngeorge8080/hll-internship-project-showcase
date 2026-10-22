/**
 * ExpenseHealthWidget.jsx  ─  "Expense Health Check"
 *
 * Dashboard version of Super Forecasting's "Expenses at a Glance": how many
 * expense records exist across every surface (operating contracts, Expense
 * Pool entries, projects with a plan) plus a per-pool OK/Watch/Over Budget
 * status for HR/Admin/Core this month.
 */
import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CBadge } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilClipboard } from '@coreui/icons'
import { computeProfitLossTotals, computeExpenseGlance } from '../../../../services/forecastData'

const ExpenseHealthWidget = () => {
  const [glance, setGlance] = useState(null)

  useEffect(() => {
    const load = async () => {
      const year = new Date().getFullYear()
      const totals = await computeProfitLossTotals(`${year}-01`, `${year}-12`)
      setGlance(await computeExpenseGlance(totals))
    }
    load()
  }, [])

  if (!glance) return null

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
              icon={cilClipboard}
              style={{ width: 18, height: 18, color: 'var(--cui-primary)' }}
            />
            <div>
              <div
                className="fw-bold"
                style={{ fontSize: '0.85rem', color: 'var(--cui-body-color)' }}
              >
                Expense Health Check
              </div>
              <div
                className="text-body-secondary"
                style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                Contracts, pool entries &amp; project plans
              </div>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="d-flex gap-3 mb-3">
            {[
              { label: 'Operating Contracts', value: glance.operatingCount },
              { label: 'Expense Pool Entries', value: glance.poolCount },
              { label: 'Projects with a Plan', value: glance.projectCount },
            ].map((s) => (
              <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
                <div
                  className="fw-bold"
                  style={{
                    fontSize: '1.2rem',
                    fontFamily: "'Fira Code', monospace",
                    color: 'var(--cui-body-color)',
                  }}
                >
                  {s.value}
                </div>
                <div className="text-body-secondary" style={{ fontSize: '0.62rem', marginTop: 2 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <div className="fw-semibold mb-2" style={{ fontSize: '0.75rem' }}>
            Is spending under control this month?
          </div>
          <div className="d-flex flex-wrap gap-2">
            {[
              { label: 'HR', health: glance.hr },
              { label: 'Admin', health: glance.admin },
              { label: 'Core', health: glance.core },
            ].map((p) => (
              <div
                key={p.label}
                className="d-flex align-items-center gap-2 border rounded-3 px-3 py-2"
                style={{ flex: '1 1 auto' }}
              >
                <span className="fw-semibold" style={{ fontSize: '0.78rem' }}>
                  {p.label}
                </span>
                <CBadge color={p.health.color} shape="rounded-pill" style={{ fontSize: '0.68rem' }}>
                  {p.health.label}
                </CBadge>
              </div>
            ))}
          </div>
        </div>
      </CCardBody>
    </CCard>
  )
}

export default ExpenseHealthWidget
