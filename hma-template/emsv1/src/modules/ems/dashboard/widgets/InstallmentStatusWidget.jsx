/**
 * InstallmentStatusWidget.jsx  ─  "Money We're Owed vs Money Received"
 *
 * Shows the CEO:
 *   • Total sanctioned (promised by funders)
 *   • Total received (money actually in hand)
 *   • Total pending (still waiting to be released)
 *
 * Simple, bold visuals. No jargon.
 * Data: project installments from localProjects.
 */
import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CProgress } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilWallet, cilBank, cilCheckAlt, cilClock } from '@coreui/icons'
import { localProjects } from '../../../../services/localProjects'

const fmtL = (n) => {
  if (!n && n !== 0) return '₹0'
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)} L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(0)} K`
  return `₹${Math.round(n)}`
}

const InstallmentStatusWidget = () => {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const allProjects = await localProjects.dashboardList()

      let totalSanctioned = 0
      let totalReceived = 0
      const projectSummaries = []

      allProjects.forEach((p) => {
        const value = p.project_value || p.project_valuation || 0
        const received = p.amount_received || p.amount_released || 0
        const pending = Math.max(0, value - received)

        totalSanctioned += value
        totalReceived += received

        if (value > 0) {
          projectSummaries.push({
            name: p.title || p.name,
            value,
            received,
            pending,
            pct: value > 0 ? Math.round((received / value) * 100) : 0,
            status: p.status,
          })
        }
      })

      const totalPending = Math.max(0, totalSanctioned - totalReceived)
      const receivedPct =
        totalSanctioned > 0 ? Math.round((totalReceived / totalSanctioned) * 100) : 0

      // Sort: most pending first (most money still owed)
      projectSummaries.sort((a, b) => b.pending - a.pending)

      if (!cancelled) {
        setData({
          totalSanctioned,
          totalReceived,
          totalPending,
          receivedPct,
          projects: projectSummaries.slice(0, 5),
          projectCount: allProjects.length,
        })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return null

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
          <div className="d-flex align-items-center gap-2 mb-4">
            <CIcon
              icon={cilWallet}
              style={{ width: 20, height: 20, color: 'rgba(255,255,255,0.85)' }}
            />
            <div>
              <div className="text-white fw-bold" style={{ fontSize: '0.88rem' }}>
                Money Received vs Pending
              </div>
              <div
                style={{
                  fontSize: '0.65rem',
                  color: 'rgba(255,255,255,0.7)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Across {data.projectCount} projects — how much has been paid to HMA
              </div>
            </div>
          </div>

          {/* Big 3 numbers */}
          <div className="d-flex gap-3">
            {[
              {
                icon: cilBank,
                label: 'Total Sanctioned',
                value: fmtL(data.totalSanctioned),
                color: '#93C5FD',
              },
              {
                icon: cilCheckAlt,
                label: 'Received',
                value: fmtL(data.totalReceived),
                color: '#34D399',
              },
              {
                icon: cilClock,
                label: 'Still Pending',
                value: fmtL(data.totalPending),
                color: '#FBBF24',
              },
            ].map((stat) => (
              <div key={stat.label} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ marginBottom: 6 }}>
                  <CIcon icon={stat.icon} style={{ width: 16, height: 16, color: stat.color }} />
                </div>
                <div
                  className="fw-bold"
                  style={{
                    color: stat.color,
                    fontSize: '1rem',
                    lineHeight: 1,
                    fontFamily: "'Fira Code', monospace",
                  }}
                >
                  {stat.value}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Overall progress */}
          <div className="mt-4">
            <div className="d-flex justify-content-between mb-2">
              <span
                style={{
                  fontSize: '0.65rem',
                  color: 'rgba(255,255,255,0.6)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Overall funds received
              </span>
              <span
                className="fw-bold"
                style={{
                  fontSize: '0.75rem',
                  color: data.receivedPct > 70 ? '#34D399' : '#FBBF24',
                  fontFamily: "'Fira Code', monospace",
                }}
              >
                {data.receivedPct}%
              </span>
            </div>
            <CProgress
              value={data.receivedPct}
              height={6}
              className="rounded-pill"
              style={{
                '--cui-progress-bar-bg': data.receivedPct > 70 ? '#10B981' : '#F59E0B',
                background: 'rgba(255,255,255,0.1)',
              }}
            />
          </div>
        </div>

        {/* Per-project mini list */}
        <div className="p-4">
          <div
            style={{
              fontSize: '0.65rem',
              color: 'var(--cui-secondary-color)',
              marginBottom: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
          >
            Top pending payments (most money still to receive)
          </div>
          <div className="d-flex flex-column gap-3">
            {data.projects.map((p, i) => (
              <div key={i}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span
                    className="text-truncate fw-medium"
                    style={{ fontSize: '0.75rem', maxWidth: '55%', color: 'var(--cui-body-color)' }}
                  >
                    {p.name}
                  </span>
                  <div
                    className="d-flex gap-2 align-items-center"
                    style={{ fontFamily: "'Fira Code', monospace" }}
                  >
                    <span
                      style={{
                        fontSize: '0.65rem',
                        color: '#059669',
                        background: 'rgba(5, 150, 105, 0.1)',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      Recd {fmtL(p.received)}
                    </span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        color: '#DC2626',
                        background: 'rgba(220, 38, 38, 0.1)',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      Due {fmtL(p.pending)}
                    </span>
                  </div>
                </div>
                <CProgress
                  value={p.pct}
                  height={4}
                  className="rounded-pill"
                  style={{
                    '--cui-progress-bar-bg':
                      p.pct > 80 ? '#10B981' : p.pct > 50 ? '#2563EB' : '#F59E0B',
                    background: 'var(--cui-border-color)',
                  }}
                />
              </div>
            ))}
            {data.projects.length === 0 && (
              <div className="text-center text-body-secondary small py-2">No project data yet</div>
            )}
          </div>
        </div>
      </CCardBody>
    </CCard>
  )
}

export default InstallmentStatusWidget
