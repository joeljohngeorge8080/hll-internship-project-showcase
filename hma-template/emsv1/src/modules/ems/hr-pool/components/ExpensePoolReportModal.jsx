import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CFormCheck,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudDownload } from '@coreui/icons'
import { exportExpensePoolReport } from '../../../../services/expensePoolReportExport'

// pools: [{ key, label, poolFundLabel, revenueRows, getExpenses }] — one entry
// per HR/Admin/Core tab, mirroring the checkbox-per-section pattern used by
// ConsolidatedReportModal for the Staff List report.
const ExpensePoolReportModal = ({ visible, onClose, pools }) => {
  const [selected, setSelected] = useState(pools.map((p) => p.key))
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const allChecked = selected.length === pools.length
  const toggleKey = (key) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }
  const toggleAll = () => setSelected(allChecked ? [] : pools.map((p) => p.key))

  const handleGenerate = async () => {
    if (!selected.length) return
    setGenerating(true)
    setError('')
    try {
      const chosen = pools.filter((p) => selected.includes(p.key))
      const withExpenses = await Promise.all(
        chosen.map(async (p) => ({ ...p, expenses: await p.getExpenses() })),
      )
      exportExpensePoolReport(withExpenses)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to generate report. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <CModal visible={visible} onClose={onClose} backdrop="static">
      <CModalHeader>
        <CModalTitle>Generate Expense Booking Report</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <p className="text-body-secondary small mb-3">
          One Excel sheet per pool — revenue details, expenses booked, and dates.
        </p>

        <CFormCheck
          id="pool-report-all"
          label={<span className="fw-semibold">All</span>}
          checked={allChecked}
          onChange={toggleAll}
          className="mb-2 pb-2 border-bottom"
        />
        {pools.map((pool) => (
          <CFormCheck
            key={pool.key}
            id={`pool-report-${pool.key}`}
            label={pool.label}
            checked={selected.includes(pool.key)}
            onChange={() => toggleKey(pool.key)}
            className="mb-2"
          />
        ))}

        {!selected.length && (
          <CAlert color="light" className="small py-2 mt-2 mb-0">
            Select at least one pool to generate a report.
          </CAlert>
        )}
        {error && (
          <CAlert color="danger" className="small py-2 mt-2 mb-0">
            {error}
          </CAlert>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={onClose} disabled={generating}>
          Cancel
        </CButton>
        <CButton color="primary" disabled={!selected.length || generating} onClick={handleGenerate}>
          <CIcon icon={cilCloudDownload} className="me-1" />
          {generating && <CSpinner size="sm" className="me-2" />}
          {generating ? 'Generating…' : 'Generate Report'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

ExpensePoolReportModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  pools: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      poolFundLabel: PropTypes.string.isRequired,
      revenueRows: PropTypes.array.isRequired,
      getExpenses: PropTypes.func.isRequired,
    }),
  ).isRequired,
}

export default ExpensePoolReportModal
