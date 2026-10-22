/**
 * UpcomingDeadlinesWidget.jsx  ─  "Upcoming Deadlines"
 *
 * Shows installments and project end dates due in the next 60 days.
 * If nothing is due soon → shows a reassuring "No deadlines soon" message.
 *
 * Data: localProjects — project.installments[] and project.end_date.
 */
import React, { useEffect, useState } from 'react'
import { CCard, CCardBody } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilAlarm, cilCheckCircle } from '@coreui/icons'
import { localProjects } from '../../../../services/localProjects'

const fmtL = (n) => {
  if (!n && n !== 0) return '₹0'
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)} L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(0)} K`
  return `₹${Math.round(n)}`
}

const diffDays = (dateStr) => {
  if (!dateStr) return Infinity
  const target = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target - today) / 86400000)
}

const urgencyStyle = (days) => {
  if (days < 0) return { color: '#DC2626', bg: 'rgba(220, 38, 38, 0.08)', label: 'Overdue' }
  if (days <= 7) return { color: '#DC2626', bg: 'rgba(220, 38, 38, 0.05)', label: `${days}d left` }
  if (days <= 14)
    return { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.05)', label: `${days}d left` }
  if (days <= 30)
    return { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.03)', label: `${days}d left` }
  return { color: '#2563EB', bg: 'rgba(37, 99, 235, 0.04)', label: `${days}d left` }
}

const UpcomingDeadlinesWidget = () => {
  const [deadlines, setDeadlines] = useState(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const allProjects = await localProjects.dashboardList()
      const items = []
      const WINDOW = 60 // days ahead

      allProjects.forEach((p) => {
        const projName = p.title || p.name

        // Project end date
        if (p.end_date) {
          const days = diffDays(p.end_date)
          if (days <= WINDOW) {
            items.push({
              id: `end_${p.id}`,
              name: projName,
              type: 'Project End',
              date: p.end_date,
              days,
              amount: null,
            })
          }
        }

        // Installments
        ;(p.installments || []).forEach((inst, idx) => {
          const targetDate = inst.target_date || inst.end_date
          if (!targetDate || inst.actual_date) return // skip received ones
          const days = diffDays(targetDate)
          if (days <= WINDOW) {
            items.push({
              id: `inst_${p.id}_${idx}`,
              name: projName,
              type: inst.label || `Installment ${idx + 1}`,
              date: targetDate,
              days,
              amount: inst.amount || null,
            })
          }
        })
      })

      // Sort: most urgent first
      items.sort((a, b) => a.days - b.days)
      if (!cancelled) setDeadlines(items)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (!deadlines) return null

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 16, overflow: 'hidden' }}>
      <CCardBody className="p-0">
        {/* Header */}
        <div
          style={{
            background: deadlines.some((d) => d.days <= 7)
              ? '#7F1D1D'
              : deadlines.some((d) => d.days <= 14)
                ? '#78350F'
                : '#1E3A8A',
            padding: '14px 20px 12px',
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <CIcon
              icon={cilAlarm}
              style={{ width: 20, height: 20, color: 'rgba(255,255,255,0.85)' }}
            />
            <div>
              <div className="text-white fw-bold" style={{ fontSize: '0.88rem' }}>
                Upcoming Deadlines
              </div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)' }}>
                {deadlines.length > 0
                  ? `${deadlines.length} deadline${deadlines.length > 1 ? 's' : ''} in the next 60 days`
                  : 'No deadlines in the next 60 days'}
              </div>
            </div>
            {deadlines.filter((d) => d.days <= 7).length > 0 && (
              <div
                style={{
                  marginLeft: 'auto',
                  background: '#DC2626',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  borderRadius: 20,
                  padding: '4px 10px',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)',
                }}
              >
                {deadlines.filter((d) => d.days <= 7).length} urgent
              </div>
            )}
          </div>
        </div>

        <div className="p-3">
          {deadlines.length === 0 ? (
            <div className="text-center py-4">
              <CIcon
                icon={cilCheckCircle}
                style={{ width: 44, height: 44, color: '#059669', marginBottom: 10 }}
              />
              <div className="fw-bold" style={{ color: '#059669', fontSize: '1rem' }}>
                All Clear
              </div>
              <div className="text-body-secondary small">No deadlines in the next 60 days.</div>
            </div>
          ) : (
            <div className="d-flex flex-column gap-2" style={{ maxHeight: 290, overflowY: 'auto' }}>
              {deadlines.slice(0, 8).map((d) => {
                const urg = urgencyStyle(d.days)
                return (
                  <div
                    key={d.id}
                    style={{
                      background: urg.bg,
                      border: `1px solid ${urg.color}25`,
                      borderLeft: `4px solid ${urg.color}`,
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
                    <div className="d-flex align-items-start justify-content-between gap-2">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          className="fw-semibold text-truncate"
                          style={{ fontSize: '0.75rem', color: 'var(--cui-body-color)' }}
                        >
                          {d.name}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--cui-secondary-color)' }}>
                          {d.type} ·{' '}
                          {new Date(d.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        {d.amount && (
                          <div
                            style={{
                              fontSize: '0.7rem',
                              color: '#2563EB',
                              fontWeight: 600,
                              marginTop: 4,
                              fontFamily: "'Fira Code', monospace",
                            }}
                          >
                            {fmtL(d.amount)}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          background: urg.color,
                          color: 'white',
                          borderRadius: 20,
                          padding: '2px 8px',
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {urg.label}
                      </div>
                    </div>
                  </div>
                )
              })}
              {deadlines.length > 8 && (
                <div
                  className="text-center text-body-secondary mt-2"
                  style={{ fontSize: '0.75rem', fontWeight: 500 }}
                >
                  +{deadlines.length - 8} more deadlines
                </div>
              )}
            </div>
          )}
        </div>
      </CCardBody>
    </CCard>
  )
}

export default UpcomingDeadlinesWidget
