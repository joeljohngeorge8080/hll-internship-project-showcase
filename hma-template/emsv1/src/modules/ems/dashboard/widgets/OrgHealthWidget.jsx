/**
 * OrgHealthWidget.jsx  ─  "Organisation Health Score"
 *
 * Full-width HERO banner at the top of the CEO dashboard.
 * One traffic-light verdict + one plain-English sentence tells the CEO
 * everything is fine — or exactly what needs attention.
 *
 * Data sources (all local-storage):
 *   • projects         → localProjects
 *   • payroll          → localEmployees
 *   • org-pool budgets → localOrgPool
 *   • profit/loss      → computeProfitLossTotals (same as ProfitLoss widget)
 */
import React, { useEffect, useState } from 'react'
import { CCard, CCardBody } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilCheckCircle,
  cilWarning,
  cilXCircle,
  cilBriefcase,
  cilPeople,
  cilWallet,
} from '@coreui/icons'
import { localProjects } from '../../../../services/localProjects'
import { localEmployees } from '../../../../services/localEmployees'
import { localOrgPool } from '../../../../services/localOrgPool'
import { computeProfitLossTotals } from '../../../../services/forecastData'

const fmtL = (n) => {
  if (!n && n !== 0) return '₹0'
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)} L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(0)} K`
  return `₹${Math.round(n)}`
}

const OrgHealthWidget = () => {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // ── projects
      const allProjects = await localProjects.dashboardList()
      const ongoingProjects = allProjects.filter((p) => p.status === 'ongoing')
      const totalProjectValue = allProjects.reduce(
        (s, p) => s + (p.project_value || p.project_valuation || 0),
        0,
      )

      // ── budget health
      let totalBudget = 0
      let totalUsed = 0
      let overBudgetCount = 0
      for (const p of allProjects) {
        const bd = localOrgPool.buildProjectMonthlyBreakdown(p)
        const budget = bd.reduce(
          (s, m) => s + m.adminBudget + m.hrBudget + m.coreBudget + m.directBudget,
          0,
        )
        const hrUsed = (await localOrgPool.getProjectHRBudgetSummary(p.id)).totalCharged || 0
        const coreUsed = (await localOrgPool.getProjectCoreBudgetSummary(p.id)).totalCharged || 0
        const used = hrUsed + coreUsed
        totalBudget += budget
        totalUsed += used
        if (budget > 0 && used / budget > 0.85) overBudgetCount++
      }
      const budgetPct = totalBudget > 0 ? Math.round((totalUsed / totalBudget) * 100) : 0

      // ── payroll
      const { items: employeeItems } = await localEmployees.list({ pageSize: 9999 })
      const employees = employeeItems.filter((e) => e.status === 'Active')
      const monthlyPayroll = employees.reduce((s, e) => s + parseFloat(e.current_salary || 0), 0)

      // ── profit/loss
      const year = new Date().getFullYear()
      const pl = await computeProfitLossTotals(`${year}-01`, `${year}-12`)

      // ── score logic
      const alerts = []
      if (overBudgetCount > 0)
        alerts.push(`${overBudgetCount} project${overBudgetCount > 1 ? 's' : ''} over 85% budget`)
      if (!pl.isProfit)
        alerts.push(`₹${(pl.gapAmount / 100000).toFixed(1)}L needed from Govt Grants`)
      if (budgetPct > 90) alerts.push('Overall budget nearly exhausted')

      let score = 'green'
      let verdict = 'All Good'
      let summary = `${ongoingProjects.length} projects running smoothly · Monthly payroll ${fmtL(monthlyPayroll)} · Budget ${budgetPct}% used`

      if (alerts.length >= 2) {
        score = 'red'
        verdict = 'Needs Attention'
        summary = alerts.join(' · ')
      } else if (alerts.length === 1) {
        score = 'yellow'
        verdict = 'Watch Closely'
        summary = `Watch: ${alerts[0]} · ${ongoingProjects.length} projects active · Payroll ${fmtL(monthlyPayroll)}`
      }

      if (!cancelled) {
        setData({
          score,
          verdict,
          summary,
          ongoingProjects: ongoingProjects.length,
          totalProjects: allProjects.length,
          totalProjectValue,
          monthlyPayroll,
          budgetPct,
          activeEmployees: employees.length,
          alerts,
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return null

  const BG = {
    green: 'linear-gradient(135deg, #0f172a 0%, #064e3b 100%)',
    yellow: 'linear-gradient(135deg, #0f172a 0%, #78350f 100%)',
    red: 'linear-gradient(135deg, #0f172a 0%, #7f1d1d 100%)',
  }
  const ACCENT = { green: '#34d399', yellow: '#fbbf24', red: '#f87171' }
  const STATUS_ICON = { green: cilCheckCircle, yellow: cilWarning, red: cilXCircle }
  const accent = ACCENT[data.score]
  const bg = BG[data.score]

  return (
    <CCard className="border-0 shadow-lg" style={{ borderRadius: 18, overflow: 'hidden' }}>
      <CCardBody className="p-0">
        <div style={{ background: bg, padding: '24px 32px' }}>
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
            {/* Left: verdict */}
            <div className="d-flex align-items-center gap-4">
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.08)',
                  border: `1px solid ${accent}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CIcon
                  icon={STATUS_ICON[data.score]}
                  style={{ width: 30, height: 30, color: accent }}
                />
              </div>
              <div>
                <div
                  style={{
                    fontSize: '0.65rem',
                    color: 'rgba(255,255,255,0.5)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    marginBottom: 4,
                  }}
                >
                  Organisation Health
                </div>
                <div
                  className="fw-bold"
                  style={{
                    fontSize: '1.5rem',
                    color: accent,
                    lineHeight: 1.1,
                    fontFamily: "'Fira Code', monospace",
                  }}
                >
                  {data.verdict}
                </div>
                <div
                  style={{
                    fontSize: '0.85rem',
                    color: 'rgba(255,255,255,0.85)',
                    marginTop: 6,
                    maxWidth: 500,
                  }}
                >
                  {data.summary}
                </div>
              </div>
            </div>

            {/* Right: 3 quick stats */}
            <div className="d-flex gap-3 flex-wrap">
              {[
                {
                  icon: cilBriefcase,
                  label: 'Active Projects',
                  value: data.ongoingProjects,
                  sub: `of ${data.totalProjects} total`,
                },
                {
                  icon: cilPeople,
                  label: 'Staff Strength',
                  value: data.activeEmployees,
                  sub: 'active employees',
                },
                {
                  icon: cilWallet,
                  label: 'Total Portfolio',
                  value: fmtL(data.totalProjectValue),
                  sub: 'project value',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    padding: '12px 20px',
                    minWidth: 130,
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div
                      style={{
                        fontSize: '0.65rem',
                        color: 'rgba(255,255,255,0.6)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {stat.label}
                    </div>
                    <CIcon
                      icon={stat.icon}
                      style={{ width: 15, height: 15, color: 'rgba(255,255,255,0.55)' }}
                    />
                  </div>
                  <div
                    className="fw-bold"
                    style={{
                      color: '#fff',
                      fontSize: '1.4rem',
                      lineHeight: 1,
                      fontFamily: "'Fira Code', monospace",
                    }}
                  >
                    {stat.value}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: accent, marginTop: 4 }}>{stat.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CCardBody>
    </CCard>
  )
}

export default OrgHealthWidget
