/**
 * BudgetAlertsWidget.jsx  ─  "Budget Alerts"
 *
 * Auto-scans every project and every expense category.
 * If anything is >85% through its budget → show a bold alert card.
 * If everything is fine → show a big green "All Clear" message.
 *
 * The CEO should be able to spot problems in under 3 seconds.
 */
import React, { useEffect, useState } from 'react'
import { CCard, CCardBody } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBellExclamation, cilCheckCircle } from '@coreui/icons'
import { localProjects } from '../../../../services/localProjects'
import { localOrgPool } from '../../../../services/localOrgPool'
import { localGeneralExpenses } from '../../../../services/localGeneralExpenses'

const fmtL = (n) => {
  if (!n && n !== 0) return '₹0'
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)} L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(0)} K`
  return `₹${Math.round(n)}`
}

const THRESHOLDS = [
  {
    pct: 100,
    color: '#DC2626',
    label: 'OVER BUDGET',
    bg: 'rgba(220, 38, 38, 0.08)',
    border: 'rgba(220, 38, 38, 0.25)',
  },
  {
    pct: 90,
    color: '#DC2626',
    label: 'Critical (90%+)',
    bg: 'rgba(220, 38, 38, 0.05)',
    border: 'rgba(220, 38, 38, 0.15)',
  },
  {
    pct: 85,
    color: '#F59E0B',
    label: 'Warning (85%+)',
    bg: 'rgba(245, 158, 11, 0.05)',
    border: 'rgba(245, 158, 11, 0.15)',
  },
]

const getThreshold = (pct) => {
  if (pct >= 100) return THRESHOLDS[0]
  if (pct >= 90) return THRESHOLDS[1]
  if (pct >= 85) return THRESHOLDS[2]
  return null
}

const BudgetAlertsWidget = () => {
  const [alerts, setAlerts] = useState(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const items = []

      // ── Per-project HR + Core budget check
      const allProjects = await localProjects.dashboardList()
      for (const p of allProjects) {
        const bd = localOrgPool.buildProjectMonthlyBreakdown(p)
        const hrBudget = bd.reduce((s, m) => s + m.hrBudget, 0)
        const coreBudget = bd.reduce((s, m) => s + m.coreBudget, 0)
        const hrUsed = (await localOrgPool.getProjectHRBudgetSummary(p.id)).totalCharged || 0
        const coreUsed = (await localOrgPool.getProjectCoreBudgetSummary(p.id)).totalCharged || 0

        const checkPool = (label, budget, used) => {
          if (budget <= 0) return
          const pct = Math.round((used / budget) * 100)
          const thresh = getThreshold(pct)
          if (thresh) {
            items.push({
              id: `${p.id}_${label}`,
              name: p.title || p.name,
              category: label,
              pct,
              used,
              budget,
              thresh,
            })
          }
        }
        checkPool('HR Budget', hrBudget, hrUsed)
        checkPool('Core Budget', coreBudget, coreUsed)
      }

      // ── General expense categories check
      const year = new Date().getFullYear()
      const analysis = await localGeneralExpenses.analysis.get(year)
      analysis.category_summary?.forEach((cat) => {
        if (cat.planned_total <= 0) return
        const pct = Math.round((cat.actual_total / cat.planned_total) * 100)
        const thresh = getThreshold(pct)
        if (thresh) {
          items.push({
            id: `cat_${cat.category_id}`,
            name: cat.category_name,
            category: 'General Expenses',
            pct,
            used: cat.actual_total,
            budget: cat.planned_total,
            thresh,
          })
        }
      })

      // Sort: highest % first
      items.sort((a, b) => b.pct - a.pct)
      if (!cancelled) setAlerts(items)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (!alerts) return null

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 16, overflow: 'hidden' }}>
      <CCardBody className="p-0">
        {/* Header */}
        <div
          style={{
            background: alerts.length > 0 ? '#7F1D1D' : '#064E3B',
            padding: '14px 20px 12px',
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <CIcon
              icon={alerts.length > 0 ? cilBellExclamation : cilCheckCircle}
              style={{ width: 20, height: 20, color: 'rgba(255,255,255,0.85)' }}
            />
            <div>
              <div className="text-white fw-bold" style={{ fontSize: '0.88rem' }}>
                Budget Alerts
              </div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.75)' }}>
                {alerts.length > 0
                  ? `${alerts.length} item${alerts.length > 1 ? 's' : ''} need${alerts.length === 1 ? 's' : ''} attention`
                  : 'All budgets are within limits'}
              </div>
            </div>
            {alerts.length > 0 && (
              <div
                style={{
                  marginLeft: 'auto',
                  background: '#DC2626',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '1rem',
                  fontFamily: "'Fira Code', monospace",
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)',
                }}
              >
                {alerts.length}
              </div>
            )}
          </div>
        </div>

        {/* Alerts list OR all-clear */}
        <div className="p-3">
          {alerts.length === 0 ? (
            <div className="text-center py-4">
              <CIcon
                icon={cilCheckCircle}
                style={{ width: 44, height: 44, color: '#059669', marginBottom: 10 }}
              />
              <div className="fw-bold" style={{ color: '#059669', fontSize: '1rem' }}>
                All Clear
              </div>
              <div className="text-body-secondary small">Every budget is within safe limits.</div>
            </div>
          ) : (
            <div className="d-flex flex-column gap-2" style={{ maxHeight: 280, overflowY: 'auto' }}>
              {alerts.slice(0, 8).map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    background: alert.thresh.bg,
                    border: `1px solid ${alert.thresh.border}`,
                    borderRadius: 10,
                    padding: '10px 12px',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.03)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="fw-bold text-truncate"
                        style={{ fontSize: '0.8rem', color: alert.thresh.color }}
                      >
                        {alert.name}
                      </div>
                      <div
                        style={{
                          fontSize: '0.65rem',
                          color: 'var(--cui-secondary-color)',
                          marginTop: 2,
                        }}
                      >
                        {alert.thresh.label} · {alert.category}
                      </div>
                    </div>
                    <div
                      className="fw-bold ms-2 d-flex align-items-center justify-content-center"
                      style={{
                        fontSize: '0.8rem',
                        color: 'white',
                        background: alert.thresh.color,
                        borderRadius: 8,
                        padding: '4px 10px',
                        flexShrink: 0,
                        fontFamily: "'Fira Code', monospace",
                      }}
                    >
                      {alert.pct}%
                    </div>
                  </div>
                  {/* Mini progress bar */}
                  <div style={{ height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 4 }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, alert.pct)}%`,
                        background: alert.thresh.color,
                        borderRadius: 4,
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                  <div
                    className="d-flex justify-content-between mt-2"
                    style={{
                      fontSize: '0.65rem',
                      color: 'var(--cui-secondary-color)',
                      fontFamily: "'Fira Code', monospace",
                    }}
                  >
                    <span>Used: {fmtL(alert.used)}</span>
                    <span>Budget: {fmtL(alert.budget)}</span>
                  </div>
                </div>
              ))}
              {alerts.length > 8 && (
                <div
                  className="text-center text-body-secondary mt-2"
                  style={{ fontSize: '0.75rem', fontWeight: 500 }}
                >
                  +{alerts.length - 8} more alerts
                </div>
              )}
            </div>
          )}
        </div>
      </CCardBody>
    </CCard>
  )
}

export default BudgetAlertsWidget
