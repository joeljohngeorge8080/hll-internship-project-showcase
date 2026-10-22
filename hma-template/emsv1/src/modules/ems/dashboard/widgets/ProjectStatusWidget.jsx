/**
 * ProjectStatusWidget.jsx
 * Dashboard widget — Project Status from Consolidated Sheet.
 *
 * Designed to be instantly understood at a glance — even by a child.
 * Shows how many projects are running, waiting, done, and how healthy
 * the overall budget is, with large colourful icons and plain language.
 */
import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CProgress } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilTask, cilMediaPlay, cilCheckAlt, cilCheckCircle, cilSearch } from '@coreui/icons'
import { localProjects } from '../../../../services/localProjects'
import { localOrgPool } from '../../../../services/localOrgPool'
import { localProjectExpenses } from '../../../../services/localProjectExpenses'

// ── Compact currency formatter ────────────────────────────────────────────────
const fmtL = (n) => {
  if (!n && n !== 0) return '—'
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)} L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(0)} K`
  return `₹${Math.round(n)}`
}

// Status buckets — professional labels, icons, colours
const STATUS_DEFS = [
  {
    key: 'ongoing',
    icon: cilMediaPlay,
    label: 'Running',
    sublabel: 'Active on the ground',
    bg: '#2563EB',
    shadow: 'rgba(37,99,235,0.3)',
  },
  {
    key: 'approved',
    icon: cilCheckAlt,
    label: 'Ready to Start',
    sublabel: 'Approved, starting soon',
    bg: '#059669',
    shadow: 'rgba(5,150,105,0.3)',
  },
  {
    key: 'completed',
    icon: cilCheckCircle,
    label: 'Completed',
    sublabel: 'Successfully delivered',
    bg: '#475569',
    shadow: 'rgba(71,85,105,0.3)',
  },
  {
    key: 'pipeline',
    icon: cilSearch,
    label: 'In Pipeline',
    sublabel: 'Being planned',
    bg: '#F59E0B',
    shadow: 'rgba(245,158,11,0.25)',
  },
]

const ProjectStatusWidget = () => {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    localProjects.dashboardList().then(async (allProjects) => {
      if (cancelled) return

      // Count by status
      const counts = { ongoing: 0, approved: 0, completed: 0, pipeline: 0 }
      let totalBudget = 0
      let totalUsed = 0

      for (const p of allProjects) {
        const s = p.status || 'pipeline'
        if (counts[s] !== undefined) counts[s]++
        else counts.pipeline++

        // Budget from consolidated sheet logic
        const bd = localOrgPool.buildProjectMonthlyBreakdown(p)
        const budget =
          bd.reduce((s, m) => s + m.adminBudget + m.hrBudget + m.coreBudget, 0) +
          bd.reduce((s, m) => s + m.directBudget, 0)
        const hrUsed = (await localOrgPool.getProjectHRBudgetSummary(p.id)).totalCharged || 0
        const coreUsed = (await localOrgPool.getProjectCoreBudgetSummary(p.id)).totalCharged || 0
        const adminUsed = (
          await localProjectExpenses.list({ projectId: p.id, pool: 'admin' })
        ).reduce((s, e) => s + e.amount, 0)
        const directUsed = p.expense_accounted || p.amount_spent || 0

        totalBudget += budget
        totalUsed += hrUsed + coreUsed + adminUsed + directUsed
      }

      if (cancelled) return

      const budgetPct =
        totalBudget > 0 ? Math.min(100, Math.round((totalUsed / totalBudget) * 100)) : 0

      setData({
        counts,
        total: allProjects.length,
        totalBudget,
        totalUsed,
        budgetPct,
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return null

  const budgetColor = data.budgetPct > 90 ? '#DC2626' : data.budgetPct > 70 ? '#F59E0B' : '#059669'
  const budgetLabel = data.budgetPct > 90 ? 'Critical' : data.budgetPct > 70 ? 'Watch' : 'Healthy'

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
          <div className="d-flex align-items-center gap-2 mb-1">
            <CIcon
              icon={cilTask}
              style={{ width: 20, height: 20, color: 'rgba(255,255,255,0.85)' }}
            />
            <div>
              <div
                className="text-white fw-bold"
                style={{ fontSize: '0.88rem', letterSpacing: '0.05em' }}
              >
                PROJECT STATUS
              </div>
              <div
                className="text-white-50"
                style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                from Consolidated Sheet · {data.total} total projects
              </div>
            </div>
          </div>
        </div>

        {/* Status cards — big and clear */}
        <div className="px-4 pt-4 pb-3">
          <div className="d-flex gap-3 flex-wrap mb-4">
            {STATUS_DEFS.map((def) => {
              const count = data.counts[def.key] || 0
              return (
                <div
                  key={def.key}
                  style={{
                    flex: '1 1 calc(50% - 8px)',
                    minWidth: 100,
                    background: def.bg,
                    borderRadius: 12,
                    padding: '14px 16px',
                    boxShadow: `0 4px 12px ${def.shadow}`,
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    cursor: 'default',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = `0 6px 16px ${def.shadow}`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = `0 4px 12px ${def.shadow}`
                  }}
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <CIcon
                      icon={def.icon}
                      style={{ width: 22, height: 22, color: 'rgba(255,255,255,0.85)' }}
                    />
                    <div
                      className="text-white fw-bold"
                      style={{
                        fontSize: '1.8rem',
                        lineHeight: 1,
                        fontFamily: "'Fira Code', monospace",
                      }}
                    >
                      {count}
                    </div>
                  </div>
                  <div
                    className="text-white fw-semibold mt-2"
                    style={{ fontSize: '0.8rem', opacity: 0.95 }}
                  >
                    {def.label}
                  </div>
                  <div
                    style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', marginTop: 2 }}
                  >
                    {def.sublabel}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Budget health bar */}
          <div
            style={{
              background: 'var(--cui-tertiary-bg, #f8f9fa)',
              borderRadius: 12,
              padding: '12px 16px',
              border: '1px solid var(--cui-border-color)',
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span
                className="fw-bold"
                style={{ fontSize: '0.75rem', color: 'var(--cui-body-color)' }}
              >
                Budget Used So Far
              </span>
              <span style={{ fontSize: '0.75rem', color: budgetColor, fontWeight: 700 }}>
                {budgetLabel}
              </span>
            </div>
            <CProgress
              value={data.budgetPct}
              height={10}
              className="rounded-pill mb-2"
              style={{ '--cui-progress-bar-bg': budgetColor }}
            />
            <div
              className="d-flex justify-content-between"
              style={{
                fontSize: '0.65rem',
                color: 'var(--cui-secondary-color)',
                fontFamily: "'Fira Code', monospace",
              }}
            >
              <span>Used: {fmtL(data.totalUsed)}</span>
              <span>{data.budgetPct}% of total budget</span>
              <span>Total: {fmtL(data.totalBudget)}</span>
            </div>
          </div>
        </div>
      </CCardBody>
    </CCard>
  )
}

export default ProjectStatusWidget
