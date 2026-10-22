/**
 * WidgetCard.jsx — Shared card shell for all dashboard widgets.
 *
 * Replaces hand-duplicated <CCard> markup across 25 widgets.
 * Presentational only — no data fetching. Each widget keeps its own
 * useEffect/service call and `if (!data) return null` guard.
 *
 * Props:
 *   label (required) — small uppercase heading
 *   icon (optional) — CoreUI icon component
 *   badge (optional) — { text, color } verdict pill
 *   stat (optional) — { value, color } one big bold number
 *   stats (optional) — [{ label, value, color }] row of KPI numbers
 *   rows (optional) — [{ label, value, progress? }] list rows with optional CProgress bar
 *   sentence (required-ish) — one plain-English explanatory line
 *   hero (boolean) — full-width banner variant
 *   children (optional) — custom content (overrides all above rendering)
 */
import React from 'react'
import { CCard, CCardBody, CProgress, CBadge } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import PropTypes from 'prop-types'

const WidgetCard = ({
  label,
  icon,
  badge,
  stat,
  stats,
  rows,
  sentence,
  hero,
  children,
}) => {
  const fmtCompact = (n) => {
    if (!n && n !== 0) return '₹0'
    if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`
    if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)} L`
    if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(0)} K`
    return `₹${Math.round(n)}`
  }

  return (
    <CCard className="h-100" style={{ border: '1px solid var(--cui-border-color)' }}>
      <CCardBody className={hero ? 'p-0' : 'p-4'}>
        {children ? (
          children
        ) : (
          <>
            {/* Header */}
            {label && (
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="d-flex align-items-center gap-2">
                  {icon && (
                    <CIcon
                      icon={icon}
                      style={{ width: 18, height: 18, color: 'var(--cui-primary)' }}
                    />
                  )}
                  <h6 className="fw-semibold mb-0 small text-uppercase text-body-secondary">
                    {label}
                  </h6>
                </div>
                {badge && (
                  <CBadge color={badge.color} shape="rounded-pill">
                    {badge.text}
                  </CBadge>
                )}
              </div>
            )}

            {/* Single stat */}
            {stat && (
              <div className="mb-3">
                <div
                  className="fw-bold"
                  style={{
                    fontSize: '1.6rem',
                    color: stat.color || 'var(--cui-body-color)',
                    fontFamily: "'Fira Code', monospace",
                  }}
                >
                  {typeof stat.value === 'number' ? fmtCompact(stat.value) : stat.value}
                </div>
              </div>
            )}

            {/* Stats row (multiple KPIs) */}
            {stats && stats.length > 0 && (
              <div className="d-flex gap-3 mb-3 flex-wrap">
                {stats.map((s) => (
                  <div key={s.label} style={{ flex: '1 1 auto', minWidth: 100 }}>
                    <div
                      className="fw-bold"
                      style={{
                        fontSize: '1.3rem',
                        color: s.color || 'var(--cui-body-color)',
                        fontFamily: "'Fira Code', monospace",
                        marginBottom: '4px',
                      }}
                    >
                      {typeof s.value === 'number' ? fmtCompact(s.value) : s.value}
                    </div>
                    <div className="small text-body-secondary">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Rows (e.g., department headcount with optional progress bars) */}
            {rows && rows.length > 0 && (
              <div className="mb-3">
                {rows.map((r) => (
                  <div key={r.label} className="d-flex justify-content-between align-items-center mb-2">
                    <span className="small text-body-secondary">{r.label}</span>
                    <span className="fw-semibold">{typeof r.value === 'number' ? fmtCompact(r.value) : r.value}</span>
                    {r.progress !== undefined && (
                      <div style={{ width: '30%', marginLeft: '8px' }}>
                        <CProgress
                          value={r.progress}
                          height={6}
                          className="rounded-pill"
                          style={{ '--cui-progress-bar-bg': r.progressColor || 'var(--cui-primary)' }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Sentence explanation */}
            {sentence && (
              <div className="text-body-secondary small">{sentence}</div>
            )}
          </>
        )}
      </CCardBody>
    </CCard>
  )
}

WidgetCard.propTypes = {
  label: PropTypes.string,
  icon: PropTypes.object,
  badge: PropTypes.shape({ text: PropTypes.string, color: PropTypes.string }),
  stat: PropTypes.shape({ value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), color: PropTypes.string }),
  stats: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      color: PropTypes.string,
    }),
  ),
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      progress: PropTypes.number,
      progressColor: PropTypes.string,
    }),
  ),
  sentence: PropTypes.string,
  hero: PropTypes.bool,
  children: PropTypes.node,
}

export default WidgetCard
