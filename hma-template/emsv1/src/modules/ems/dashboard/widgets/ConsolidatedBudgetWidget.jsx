/**
 * ConsolidatedBudgetWidget.jsx
 * Dashboard widget — Consolidated Sheet Budget Breakdown.
 *
 * Shows each expense type (Admin, HR, Core, Direct) with:
 *   • Budget allocated
 *   • Amount used
 *   • Visual progress bar
 *
 * Written in plain, bold language so anyone can understand at a glance.
 * Data source: same logic as Consolidated Sheet tab in Expense Management.
 */
import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CProgress } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilWallet, cilBuilding, cilPeople, cilSettings, cilBriefcase } from '@coreui/icons'
import { localProjects } from '../../../../services/localProjects'
import { localOrgPool } from '../../../../services/localOrgPool'
import { localProjectExpenses } from '../../../../services/localProjectExpenses'

// ── Compact currency formatter ─────────────────────────────────────────────────
const fmtL = (n) => {
  if (!n && n !== 0) return '₹0'
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)} L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(0)} K`
  return `₹${Math.round(n)}`
}

// Expense categories from consolidated sheet
const EXPENSE_TYPES = [
  {
    key: 'admin',
    icon: cilBuilding,
    label: 'HMA Admin',
    sublabel: 'Our office running costs',
    color: '#475569',
    lightColor: 'rgba(71,85,105,0.08)',
  },
  {
    key: 'hr',
    icon: cilPeople,
    label: 'HR Expenses',
    sublabel: 'People & recruitment costs',
    color: '#F59E0B',
    lightColor: 'rgba(245,158,11,0.08)',
  },
  {
    key: 'core',
    icon: cilSettings,
    label: 'Core Team Salary',
    sublabel: 'Salaries for our core team',
    color: '#059669',
    lightColor: 'rgba(5,150,105,0.08)',
  },
  {
    key: 'direct',
    icon: cilBriefcase,
    label: 'Project Direct',
    sublabel: 'Money spent on the field',
    color: '#2563EB',
    lightColor: 'rgba(37,99,235,0.08)',
  },
]

const ConsolidatedBudgetWidget = () => {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const allProjects = await localProjects.dashboardList()

      let totals = { admin: 0, hr: 0, core: 0, direct: 0 }
      let used = { admin: 0, hr: 0, core: 0, direct: 0 }
      let projectCount = allProjects.length
      let totalProjectValue = 0

      for (const p of allProjects) {
        const bd = localOrgPool.buildProjectMonthlyBreakdown(p)
        totals.admin += bd.reduce((s, m) => s + m.adminBudget, 0)
        totals.hr += bd.reduce((s, m) => s + m.hrBudget, 0)
        totals.core += bd.reduce((s, m) => s + m.coreBudget, 0)
        totals.direct += bd.reduce((s, m) => s + m.directBudget, 0)

        used.admin += (await localProjectExpenses.list({ projectId: p.id, pool: 'admin' })).reduce(
          (s, e) => s + e.amount,
          0,
        )
        used.hr += (await localOrgPool.getProjectHRBudgetSummary(p.id)).totalCharged || 0
        used.core += (await localOrgPool.getProjectCoreBudgetSummary(p.id)).totalCharged || 0
        // direct used tracking: typically project direct expenses
        used.direct += p.expense_accounted || p.amount_spent || 0

        totalProjectValue += p.project_value || p.project_valuation || 0
      }

      if (!cancelled) setData({ totals, used, projectCount, totalProjectValue })
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return null

  const grandBudget = Object.values(data.totals).reduce((s, v) => s + v, 0)
  const grandUsed = Object.values(data.used).reduce((s, v) => s + v, 0)
  const grandPct = grandBudget > 0 ? Math.min(100, Math.round((grandUsed / grandBudget) * 100)) : 0

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 16, overflow: 'hidden' }}>
      <CCardBody className="p-0">
        {/* Header */}
        <div
          style={{
            background: '#0F172A',
            padding: '16px 20px 14px',
          }}
        >
          <div className="d-flex align-items-center gap-2 mb-3">
            <CIcon
              icon={cilWallet}
              style={{ width: 20, height: 20, color: 'rgba(255,255,255,0.85)' }}
            />
            <div>
              <div
                className="text-white fw-bold"
                style={{ fontSize: '0.88rem', letterSpacing: '0.05em' }}
              >
                BUDGET TRACKER
              </div>
              <div
                className="text-white-50"
                style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                Consolidated Sheet · {data.projectCount} projects · Total value{' '}
                <span style={{ fontFamily: "'Fira Code', monospace" }}>
                  {fmtL(data.totalProjectValue)}
                </span>
              </div>
            </div>
          </div>

          {/* Grand total bar */}
          <div className="mt-3">
            <div className="d-flex justify-content-between mb-2">
              <span
                className="text-white-50"
                style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                Overall Budget Used
              </span>
              <span
                className="fw-bold"
                style={{
                  fontSize: '0.75rem',
                  fontFamily: "'Fira Code', monospace",
                  color: grandPct > 90 ? '#DC2626' : grandPct > 70 ? '#F59E0B' : '#10B981',
                }}
              >
                {grandPct}% — {fmtL(grandUsed)} of {fmtL(grandBudget)}
              </span>
            </div>
            <CProgress
              value={grandPct}
              height={6}
              className="rounded-pill"
              style={{
                '--cui-progress-bar-bg':
                  grandPct > 90 ? '#DC2626' : grandPct > 70 ? '#F59E0B' : '#10B981',
                background: 'rgba(255,255,255,0.1)',
              }}
            />
          </div>
        </div>

        {/* Expense type breakdown */}
        <div className="p-4 d-flex flex-column gap-3">
          {EXPENSE_TYPES.map((type) => {
            const budget = data.totals[type.key] || 0
            const usedAmt = data.used[type.key] || 0
            const pct = budget > 0 ? Math.min(100, Math.round((usedAmt / budget) * 100)) : 0
            const remaining = budget - usedAmt
            const barColor = pct > 90 ? '#DC2626' : pct > 70 ? '#F59E0B' : type.color

            return (
              <div
                key={type.key}
                style={{
                  background: type.lightColor,
                  borderRadius: 12,
                  padding: '14px 16px',
                  border: `1px solid ${type.color}33`,
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = `0 4px 12px ${type.color}15`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {/* Top row */}
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <CIcon icon={type.icon} style={{ width: 18, height: 18, color: type.color }} />
                    <div>
                      <div className="fw-bold" style={{ fontSize: '0.8rem', color: type.color }}>
                        {type.label}
                      </div>
                      <div
                        style={{
                          fontSize: '0.65rem',
                          color: 'var(--cui-secondary-color)',
                          marginTop: 2,
                        }}
                      >
                        {type.sublabel}
                      </div>
                    </div>
                  </div>
                  <div className="text-end">
                    <div
                      className="fw-bold"
                      style={{
                        fontSize: '0.9rem',
                        color: type.color,
                        fontFamily: "'Fira Code', monospace",
                      }}
                    >
                      {fmtL(budget)}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--cui-secondary-color)' }}>
                      total budget
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <CProgress
                  value={pct}
                  height={6}
                  className="rounded-pill mb-2"
                  style={{ '--cui-progress-bar-bg': barColor, background: 'rgba(0,0,0,0.06)' }}
                />

                {/* Bottom stats */}
                <div
                  className="d-flex justify-content-between"
                  style={{
                    fontSize: '0.65rem',
                    color: 'var(--cui-secondary-color)',
                    fontFamily: "'Fira Code', monospace",
                  }}
                >
                  <span>
                    Used:{' '}
                    <span
                      className="fw-bold"
                      style={{
                        color: usedAmt > 0 ? 'var(--cui-body-color)' : 'var(--cui-secondary-color)',
                      }}
                    >
                      {fmtL(usedAmt)}
                    </span>
                  </span>
                  <span className="fw-bold" style={{ color: barColor }}>
                    {pct}%
                  </span>
                  <span>
                    Left:{' '}
                    <span
                      className="fw-bold"
                      style={{ color: remaining < 0 ? '#DC2626' : '#059669' }}
                    >
                      {remaining < 0 ? '−' : ''}
                      {fmtL(Math.abs(remaining))}
                    </span>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </CCardBody>
    </CCard>
  )
}

export default ConsolidatedBudgetWidget
