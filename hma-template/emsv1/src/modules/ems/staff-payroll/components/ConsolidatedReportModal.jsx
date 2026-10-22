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
import { localEmployees } from '../../../../services/localEmployees'
import {
  exportConsolidatedExcel,
  CONSOLIDATED_SECTIONS,
} from '../../../../services/employeeReportExport'

// filters mirrors EmployeeList's current search/status/department/category so
// "Generate Report" produces a sheet for whatever HR is currently looking at.
const ConsolidatedReportModal = ({ visible, onClose, filters }) => {
  const [selected, setSelected] = useState(CONSOLIDATED_SECTIONS.map((s) => s.key))
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const allChecked = selected.length === CONSOLIDATED_SECTIONS.length
  const toggleSection = (key) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }
  const toggleAll = () => setSelected(allChecked ? [] : CONSOLIDATED_SECTIONS.map((s) => s.key))

  const handleGenerate = async () => {
    if (!selected.length) return
    setGenerating(true)
    setError('')
    try {
      const { items } = await localEmployees.list({ ...filters, page: 1, pageSize: 2000 })
      if (!items.length) {
        setError('No employees match the current filters.')
        return
      }
      await exportConsolidatedExcel(items, selected)
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
        <CModalTitle>Generate Consolidated Staff Report</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <p className="text-body-secondary small mb-3">
          One Excel sheet, one row per employee — using the search/filters currently applied on the
          staff list.
        </p>

        <CFormCheck
          id="cons-report-all"
          label={<span className="fw-semibold">All</span>}
          checked={allChecked}
          onChange={toggleAll}
          className="mb-2 pb-2 border-bottom"
        />
        {CONSOLIDATED_SECTIONS.map((section) => (
          <CFormCheck
            key={section.key}
            id={`cons-report-${section.key}`}
            label={section.label}
            checked={selected.includes(section.key)}
            onChange={() => toggleSection(section.key)}
            className="mb-2"
          />
        ))}

        {!selected.length && (
          <CAlert color="light" className="small py-2 mt-2 mb-0">
            Select at least one section to generate a report.
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

ConsolidatedReportModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  filters: PropTypes.object.isRequired,
}

export default ConsolidatedReportModal
