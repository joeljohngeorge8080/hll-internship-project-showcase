/**
 * RevenueVsSpendWidget.jsx  ─  "Revenue vs Spend — Monthly Bar Chart"
 *
 * Side-by-side bar chart for the last 6 months:
 *   • Blue bar  = Total Expense (operating + project)
 *   • Green bar = Own Revenue (share pools + HR revenue)
 *
 * Uses the same computeProfitLossTotals logic as the Profit/Loss widget.
 * Pure SVG — no external charting library needed.
 * Plain language labels so any CEO can read it instantly.
 */
import React, { useEffect, useState, useMemo } from 'react'
import { CCard, CCardBody } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBarChart } from '@coreui/icons'
import { computeProfitLossTotals } from '../../../../services/forecastData'

const fmtL = (n) => {
  if (!n && n !== 0) return '₹0'
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)} L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(0)} K`
  return `₹${Math.round(n)}`
}

const addMonths = (ym, delta) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const RevenueVsSpendWidget = () => {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    const load = async () => {
      const now = new Date()
      const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const start = addMonths(curYm, -5)
      const data = await computeProfitLossTotals(start, curYm)
      setRows(data.monthRows.slice(-6))
    }
    load()
  }, [])

  if (!rows) return null

  const maxVal = Math.max(...rows.flatMap((r) => [r.totalExpense, r.shareRevenue]), 1)
  const chartH = 100
  const barW = 14
  const gap = 6
  const groupW = barW * 2 + gap
  const totalW = rows.length * (groupW + 10) + 20

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
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2">
              <CIcon
                icon={cilBarChart}
                style={{ width: 18, height: 18, color: 'var(--cui-primary)' }}
              />
              <div>
                <div
                  className="fw-bold"
                  style={{ fontSize: '0.85rem', color: 'var(--cui-body-color)' }}
                >
                  Revenue vs Spend
                </div>
                <div
                  className="text-body-secondary"
                  style={{
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Last 6 months — how much we earn vs spend
                </div>
              </div>
            </div>
            {/* Legend */}
            <div className="d-flex gap-3">
              {[
                ['#2563EB', 'Spend'],
                ['#059669', 'Revenue'],
              ].map(([color, label]) => (
                <div key={label} className="d-flex align-items-center gap-1">
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
                  <span style={{ fontSize: '0.65rem', color: 'var(--cui-secondary-color)' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="px-4 pt-4 pb-3" style={{ overflowX: 'auto' }}>
          <svg
            width="100%"
            viewBox={`0 0 ${totalW} ${chartH + 28}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ minWidth: 260 }}
          >
            {/* Grid lines */}
            {[0.25, 0.5, 0.75, 1].map((ratio) => (
              <line
                key={ratio}
                x1={0}
                y1={chartH * (1 - ratio)}
                x2={totalW}
                y2={chartH * (1 - ratio)}
                stroke="var(--cui-border-color,#dee2e6)"
                strokeWidth={0.5}
                strokeDasharray="3,3"
                opacity={ratio === 1 ? 1 : 0.5}
              />
            ))}

            {/* Bars */}
            {rows.map((row, i) => {
              const x = 10 + i * (groupW + 10)
              const expH = maxVal > 0 ? (row.totalExpense / maxVal) * chartH : 2
              const revH = maxVal > 0 ? (row.shareRevenue / maxVal) * chartH : 2
              const [, m] = row.month.split('-').map(Number)
              const monthLabel = MONTH_SHORT[m - 1]

              return (
                <g key={row.month}>
                  {/* Spend bar */}
                  <rect
                    x={x}
                    y={chartH - expH}
                    width={barW}
                    height={Math.max(expH, 2)}
                    rx={2}
                    fill="#2563EB"
                    opacity={0.9}
                    style={{ transition: 'height 0.5s ease, y 0.5s ease' }}
                  >
                    <title>
                      Spend {monthLabel}: {fmtL(row.totalExpense)}
                    </title>
                  </rect>
                  {/* Revenue bar */}
                  <rect
                    x={x + barW + gap}
                    y={chartH - revH}
                    width={barW}
                    height={Math.max(revH, 2)}
                    rx={2}
                    fill="#059669"
                    opacity={0.9}
                    style={{ transition: 'height 0.5s ease, y 0.5s ease' }}
                  >
                    <title>
                      Revenue {monthLabel}: {fmtL(row.shareRevenue)}
                    </title>
                  </rect>
                  {/* Month label */}
                  <text
                    x={x + barW + gap / 2}
                    y={chartH + 16}
                    textAnchor="middle"
                    fontSize="9"
                    fill="var(--cui-body-secondary-color,#888)"
                    fontWeight="500"
                  >
                    {monthLabel}
                    {row.isForecast ? '*' : ''}
                  </text>
                  {/* Surplus/deficit indicator */}
                  {row.totalExpense > 0 && (
                    <text
                      x={x + barW + gap / 2}
                      y={chartH - Math.max(expH, revH) - 4}
                      textAnchor="middle"
                      fontSize="8"
                      fill={row.totalExpense > row.shareRevenue ? '#DC2626' : '#059669'}
                      fontWeight="bold"
                    >
                      {row.totalExpense > row.shareRevenue ? '↑' : '↓'}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>

          {/* Summary row */}
          <div
            className="d-flex justify-content-between px-1 mt-2"
            style={{ fontSize: '0.65rem', color: 'var(--cui-secondary-color)' }}
          >
            <span>* forecast months</span>
            <span>
              <span style={{ color: '#DC2626' }}>↑</span> = spending more than earning
            </span>
          </div>

          {/* Totals */}
          <div className="d-flex gap-3 mt-3 px-1">
            {[
              {
                label: 'Total Spend',
                value: rows.reduce((s, r) => s + r.totalExpense, 0),
                color: '#2563EB',
              },
              {
                label: 'Total Revenue',
                value: rows.reduce((s, r) => s + r.shareRevenue, 0),
                color: '#059669',
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  flex: 1,
                  background: 'var(--cui-tertiary-bg,#f8f9fa)',
                  border: '1px solid var(--cui-border-color)',
                  borderRadius: 8,
                  padding: '8px 12px',
                }}
              >
                <div
                  style={{
                    fontSize: '0.65rem',
                    color: 'var(--cui-secondary-color)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {item.label}
                </div>
                <div
                  className="fw-bold"
                  style={{
                    fontSize: '1rem',
                    color: item.color,
                    marginTop: 2,
                    fontFamily: "'Fira Code', monospace",
                  }}
                >
                  {fmtL(item.value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CCardBody>
    </CCard>
  )
}

export default RevenueVsSpendWidget
