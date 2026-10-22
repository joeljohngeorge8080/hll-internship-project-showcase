/**
 * MoneyFlowWidget.jsx  ─  "Where Does Every Rupee Go?"
 *
 * Animated SVG donut chart showing how total HMA spend is split between:
 *   • Project Field Work (direct project expenses)
 *   • Staff Salaries (payroll)
 *   • Admin & Operations (office running costs)
 *   • HR & Recruitment (HR pool costs)
 *
 * No external chart library needed — pure SVG.
 * Designed so a 10-year-old can understand it at a glance.
 */
import React, { useEffect, useState } from 'react'
import { CCard, CCardBody } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilChartPie } from '@coreui/icons'
import { localEmployees } from '../../../../services/localEmployees'
import { localProjects } from '../../../../services/localProjects'
import { localOrgPool } from '../../../../services/localOrgPool'
import { localGeneralExpenses } from '../../../../services/localGeneralExpenses'

const fmtL = (n) => {
  if (!n) return '₹0'
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)} L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(0)} K`
  return `₹${Math.round(n)}`
}

// SVG donut slice builder
const describeArc = (cx, cy, r, startAngle, endAngle) => {
  const toRad = (deg) => ((deg - 90) * Math.PI) / 180
  const x1 = cx + r * Math.cos(toRad(startAngle))
  const y1 = cy + r * Math.sin(toRad(startAngle))
  const x2 = cx + r * Math.cos(toRad(endAngle))
  const y2 = cy + r * Math.sin(toRad(endAngle))
  const large = endAngle - startAngle > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
}

const DonutChart = ({ segments, size = 140 }) => {
  const cx = size / 2
  const cy = size / 2
  const R = size / 2 - 12
  const INNER = R * 0.55
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0)
    return (
      <svg width={size} height={size}>
        <circle
          cx={cx}
          cy={cy}
          r={R}
          fill="none"
          stroke="var(--cui-border-color,#dee2e6)"
          strokeWidth={R - INNER}
        />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dy="0.35em"
          fontSize="10"
          fill="var(--cui-body-color,#333)"
        >
          No data
        </text>
      </svg>
    )

  let angle = 0
  return (
    <svg width={size} height={size} style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }}>
      {segments.map((seg) => {
        const sweep = (seg.value / total) * 360
        const start = angle
        const end = angle + sweep - 1.5 // gap
        angle += sweep
        if (sweep < 2) return null
        return (
          <path
            key={seg.label}
            d={describeArc(cx, cy, R - (R - INNER) / 2, start, end)}
            fill="none"
            stroke={seg.color}
            strokeWidth={R - INNER}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          >
            <title>
              {seg.label}: {fmtL(seg.value)} ({Math.round((seg.value / total) * 100)}%)
            </title>
          </path>
        )
      })}
      {/* Centre label */}
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fontSize="9"
        fill="var(--cui-body-secondary-color,#888)"
      >
        TOTAL
      </text>
      <text
        x={cx}
        y={cy + 8}
        textAnchor="middle"
        fontWeight="700"
        fontSize="11"
        fill="var(--cui-body-color,#333)"
      >
        {fmtL(total)}
      </text>
    </svg>
  )
}

const MoneyFlowWidget = () => {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Payroll (salaries)
      const { items: employeeItems } = await localEmployees.list({ pageSize: 9999 })
      const employees = employeeItems.filter((e) => e.status === 'Active')
      const salaries = employees.reduce((s, e) => s + parseFloat(e.current_salary || 0), 0)

      // Project budget totals from consolidated sheet
      const allProjects = await localProjects.dashboardList()
      let directBudget = 0,
        adminBudget = 0,
        hrBudget = 0,
        coreBudget = 0
      allProjects.forEach((p) => {
        const bd = localOrgPool.buildProjectMonthlyBreakdown(p)
        directBudget += bd.reduce((s, m) => s + m.directBudget, 0)
        adminBudget += bd.reduce((s, m) => s + m.adminBudget, 0)
        hrBudget += bd.reduce((s, m) => s + m.hrBudget, 0)
        coreBudget += bd.reduce((s, m) => s + m.coreBudget, 0)
      })

      // General expenses (office costs)
      const year = new Date().getFullYear()
      const ge = await localGeneralExpenses.analysis.get(year)
      const generalActual = ge.ytd_actual || 0

      const segments = [
        {
          label: 'Project Field Work',
          color: '#2563EB',
          value: directBudget,
          sublabel: 'Direct to the field',
        },
        { label: 'Staff Salaries', color: '#059669', value: salaries, sublabel: 'Monthly payroll' },
        {
          label: 'Admin & Office',
          color: '#475569',
          value: adminBudget + generalActual,
          sublabel: 'Office running costs',
        },
        {
          label: 'HR & Core',
          color: '#F59E0B',
          value: hrBudget + coreBudget,
          sublabel: 'HR & core team costs',
        },
      ].filter((s) => s.value > 0)

      const total = segments.reduce((s, seg) => s + seg.value, 0)
      if (!cancelled) setData({ segments, total })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return null

  const total = data.total

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 16, overflow: 'hidden' }}>
      <CCardBody className="p-0">
        {/* Header */}
        <div
          style={{
            padding: '14px 20px 10px',
            borderBottom: '1px solid var(--cui-border-color,#dee2e6)',
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <CIcon
              icon={cilChartPie}
              style={{ width: 18, height: 18, color: 'var(--cui-primary)' }}
            />
            <div>
              <div
                className="fw-bold"
                style={{ fontSize: '0.85rem', color: 'var(--cui-body-color)' }}
              >
                Spending Breakdown
              </div>
              <div
                className="text-body-secondary"
                style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                Where every rupee goes — {fmtL(total)}
              </div>
            </div>
          </div>
        </div>

        {/* Chart + legend */}
        <div
          className="d-flex align-items-center gap-3 px-4 pt-4 pb-3"
          style={{ flexWrap: 'wrap' }}
        >
          <div style={{ flexShrink: 0 }}>
            <DonutChart segments={data.segments} size={150} />
          </div>

          {/* Legend */}
          <div className="d-flex flex-column gap-3" style={{ flex: 1, minWidth: 140 }}>
            {data.segments.map((seg) => {
              const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0
              return (
                <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: seg.color,
                      flexShrink: 0,
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      className="fw-bold"
                      style={{
                        fontSize: '0.75rem',
                        lineHeight: 1.2,
                        color: 'var(--cui-body-color)',
                      }}
                    >
                      {seg.label}
                    </div>
                    <div
                      style={{
                        fontSize: '0.65rem',
                        color: 'var(--cui-secondary-color)',
                        marginTop: 2,
                      }}
                    >
                      {seg.sublabel}
                    </div>
                  </div>
                  <div
                    className="text-end"
                    style={{ flexShrink: 0, fontFamily: "'Fira Code', monospace" }}
                  >
                    <div className="fw-bold" style={{ fontSize: '0.85rem', color: seg.color }}>
                      {pct}%
                    </div>
                    <div
                      style={{
                        fontSize: '0.65rem',
                        color: 'var(--cui-secondary-color)',
                        marginTop: 2,
                      }}
                    >
                      {fmtL(seg.value)}
                    </div>
                  </div>
                </div>
              )
            })}
            {data.segments.length === 0 && (
              <div className="text-body-secondary small text-center py-2">No expense data yet</div>
            )}
          </div>
        </div>
      </CCardBody>
    </CCard>
  )
}

export default MoneyFlowWidget
