/**
 * LedgerMonthBlock.jsx — Read-only per-month block that shows activity
 * totals from the uploaded Excel project ledger (plan §8 of
 * docs/plans/actual-phase-ledger-upload.md). Rendered inside ActualMonthCard
 * below the manual task/subtask rows, visually separated with an info note
 * that these figures are NOT part of the settlement/approval math.
 *
 * Props:
 *   projectId  {string}  — the project's UUID (to fetch from localProjectLedger)
 *   month      {string}  — "YYYY-MM" — the month to display
 *   planMonth  {object}  — plan.months[] entry for this month (tasks list for
 *                          computing per-activity planned totals)
 */
import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { CButton } from '@coreui/react'
import { localProjectLedger } from '../../../../services/localProjectLedger'
import { activityLabelOf, ACTIVITY_OPTIONS } from './activityOptions'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const fmtDate = (d) => {
  if (!d) return '—'
  // d is ISO "YYYY-MM-DD"
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

/**
 * Sum `planned_amount` for all subtasks in the month whose resolved activity
 * matches `activityValue`. Accounts for tasks spread across multiple task
 * objects under the same activity (spec §6).
 */
const plannedForActivity = (planMonth, activityValue) => {
  if (!planMonth) return null
  let total = 0
  let found = false
  ;(planMonth.tasks || []).forEach((task) => {
    ;(task.subtasks || []).forEach((sub) => {
      if (sub.activity === activityValue) {
        total += parseFloat(sub.planned_amount) || 0
        found = true
      }
    })
  })
  return found ? Math.round(total * 100) / 100 : null
}

const LedgerMonthBlock = ({ projectId, month, planMonth }) => {
  const [ledger, setLedger] = useState(null)
  const [showRows, setShowRows] = useState(false)

  useEffect(() => {
    let cancelled = false
    localProjectLedger.get(projectId).then((l) => {
      if (!cancelled) setLedger(l)
    })
    return () => {
      cancelled = true
    }
  }, [projectId])

  const rows = useMemo(() => localProjectLedger.rowsForMonthOf(ledger, month), [ledger, month])

  if (!ledger || rows.length === 0) return null

  // Group by activity label (resolved) — one figure per activity per month (spec §6)
  const byActivity = {}
  rows.forEach((row) => {
    const key = row.activityLabel
    byActivity[key] = (byActivity[key] || 0) + row.amount
  })
  const activityRows = Object.entries(byActivity).map(([label, uploaded]) => {
    // Try to find the activity value (for planned lookup) from the label
    const opt = ACTIVITY_OPTIONS.find((a) => activityLabelOf(a.value) === label)
    const planned = opt ? plannedForActivity(planMonth, opt.value) : null
    return { label, uploaded: Math.round(uploaded * 100) / 100, planned }
  })

  const uploadedTotal = activityRows.reduce((s, r) => s + r.uploaded, 0)
  const plannedTotal = activityRows.reduce((s, r) => s + (r.planned ?? 0), 0)

  const uploadedAt = ledger.uploaded_at
    ? new Date(ledger.uploaded_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  const sheetLabel =
    ledger.source_sheet && ledger.source_sheet.length > 28
      ? ledger.source_sheet.slice(0, 27) + '…'
      : ledger.source_sheet || ''

  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px dashed var(--cui-border-color, #ccc)' }}>
      {/* Section header */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="small fw-semibold text-body-secondary">
          Uploaded from Excel{' '}
          <span
            className="badge text-bg-secondary ms-1"
            style={{ fontSize: '0.62rem', fontWeight: 400 }}
            title="These figures come from the uploaded project ledger workbook and are NOT counted in settlement, shortfall or approval calculations."
          >
            ⓘ not in settlement
          </span>
        </span>
        <CButton
          size="sm"
          color="secondary"
          variant="ghost"
          className="py-0 px-1"
          style={{ fontSize: '0.72rem' }}
          onClick={() => setShowRows((v) => !v)}
        >
          {showRows ? 'Hide rows' : 'Show rows'}
        </CButton>
      </div>

      {/* Per-activity comparison table */}
      <table className="w-100 small" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '40%' }} />
          <col style={{ width: '30%' }} />
          <col style={{ width: '30%' }} />
        </colgroup>
        <thead>
          <tr className="text-body-secondary" style={{ borderBottom: '1px solid #ddd' }}>
            <th className="py-1 fw-normal text-start">Activity</th>
            <th className="py-1 fw-normal text-end">Planned</th>
            <th className="py-1 fw-normal text-end">Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {activityRows.map(({ label, uploaded, planned }) => (
            <tr key={label} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td className="py-1">{label}</td>
              <td className="py-1 text-end text-body-secondary">
                {planned !== null ? fmt(planned) : '—'}
              </td>
              <td
                className="py-1 text-end fw-medium"
                style={{
                  color:
                    planned !== null && uploaded > planned + 0.5 ? 'var(--cui-danger)' : 'inherit',
                }}
              >
                {fmt(uploaded)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '1px solid #ccc' }}>
            <td className="py-1 fw-semibold">Total</td>
            <td className="py-1 text-end text-body-secondary fw-semibold">
              {plannedTotal > 0 ? fmt(plannedTotal) : '—'}
            </td>
            <td className="py-1 text-end fw-semibold">{fmt(uploadedTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Metadata footer */}
      <div className="small text-body-tertiary mt-1">
        {uploadedAt && `Uploaded ${uploadedAt}`}
        {sheetLabel && ` · sheet "${sheetLabel}"`}
      </div>

      {/* Optional raw-row drill-down */}
      {showRows && (
        <div className="mt-2">
          <table
            className="w-100"
            style={{
              borderCollapse: 'collapse',
              fontSize: '0.72rem',
              tableLayout: 'fixed',
            }}
          >
            <colgroup>
              <col style={{ width: '12%' }} />
              <col style={{ width: '38%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '25%' }} />
            </colgroup>
            <thead>
              <tr className="text-body-secondary" style={{ borderBottom: '1px solid #ddd' }}>
                <th className="py-1 fw-normal text-start">Date</th>
                <th className="py-1 fw-normal text-start">Particulars</th>
                <th className="py-1 fw-normal text-start">Activity</th>
                <th className="py-1 fw-normal text-end">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                  <td className="py-1">{fmtDate(row.date)}</td>
                  <td
                    className="py-1"
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={row.particulars}
                  >
                    {row.particulars || '—'}
                  </td>
                  <td className="py-1">{row.activityLabel}</td>
                  <td className="py-1 text-end">{fmt(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

LedgerMonthBlock.propTypes = {
  projectId: PropTypes.string.isRequired,
  month: PropTypes.string.isRequired,
  planMonth: PropTypes.object,
}

export default LedgerMonthBlock
