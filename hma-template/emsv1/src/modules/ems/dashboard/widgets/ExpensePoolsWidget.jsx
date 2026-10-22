import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CProgress } from '@coreui/react'
import { localOrgPool } from '../../../../services/localOrgPool'

const fmtCompact = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n || 0)

const ROWS = [
  {
    key: 'hr',
    label: 'HR Pool',
    color: '#4361ee',
    get: () => localOrgPool.getMonthlyHRPoolBudgetSummary(),
  },
  {
    key: 'admin',
    label: 'Admin Pool',
    color: '#f77f00',
    get: () => localOrgPool.getMonthlyAdminPoolBudgetSummary(),
  },
  {
    key: 'core',
    label: 'Core Pool',
    color: '#06d6a0',
    get: () => localOrgPool.getMonthlyCorePoolBudgetSummary(),
  },
]

const ExpensePoolsWidget = () => {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.all(ROWS.map(async (r) => ({ ...r, summary: await r.get() }))).then((resolved) => {
      if (!cancelled) setRows(resolved)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!rows) return null

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4">
        <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">
          Expence Booking
        </h6>
        <div className="d-flex flex-column gap-3">
          {rows.map((r) => {
            const { totalMonthlyBudget, usedThisMonth } = r.summary
            const pct =
              totalMonthlyBudget > 0
                ? Math.min(100, Math.round((usedThisMonth / totalMonthlyBudget) * 100))
                : 0
            return (
              <div key={r.key}>
                <div className="d-flex justify-content-between small mb-1">
                  <span className="fw-medium">{r.label}</span>
                  <span className="text-body-secondary">
                    {fmtCompact(usedThisMonth)} / {fmtCompact(totalMonthlyBudget)}
                  </span>
                </div>
                <CProgress
                  value={pct}
                  height={5}
                  className="rounded-pill"
                  style={{ '--cui-progress-bar-bg': r.color }}
                />
              </div>
            )
          })}
        </div>
      </CCardBody>
    </CCard>
  )
}

export default ExpensePoolsWidget
