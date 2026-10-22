import React from 'react'
import PropTypes from 'prop-types'
import {
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const monthLabelShort = (ym) => {
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

/** Small bordered strip: one column per month, each showing its baseline
 * split amount — the old design's per-month block-wise split visualization,
 * shown both before a plan exists (flat even-split preview) and, once a
 * plan is initialized, kept live from the plan's exact ledger baselines. */
const BaselineSplitStrip = ({ months, amounts, workingPool }) => {
  if (!months.length) return null
  return (
    <div className="mb-3">
      <div className="small text-body-secondary mb-2">
        Project baseline: <strong>{fmt(workingPool)}</strong> across{' '}
        <strong>{months.length}</strong> month{months.length !== 1 ? 's' : ''} — split into the
        blocks below
      </div>
      <div style={{ overflowX: 'auto' }}>
        <CTable bordered small align="middle" className="mb-0" style={{ fontSize: '0.8rem' }}>
          <CTableHead color="light">
            <CTableRow>
              {months.map((m) => (
                <CTableHeaderCell key={m} className="text-center text-nowrap">
                  {monthLabelShort(m)}
                </CTableHeaderCell>
              ))}
            </CTableRow>
          </CTableHead>
          <CTableBody>
            <CTableRow>
              {months.map((m) => (
                <CTableDataCell key={m} className="text-center text-nowrap">
                  {fmt(amounts[m] || 0)}
                </CTableDataCell>
              ))}
            </CTableRow>
          </CTableBody>
        </CTable>
      </div>
    </div>
  )
}

BaselineSplitStrip.propTypes = {
  months: PropTypes.arrayOf(PropTypes.string).isRequired,
  amounts: PropTypes.objectOf(PropTypes.number).isRequired,
  workingPool: PropTypes.number.isRequired,
}

export default BaselineSplitStrip
