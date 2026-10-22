import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CFormCheck,
  CFormLabel,
  CFormSelect,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudDownload } from '@coreui/icons'
import { buildEmployeeSections, REPORT_SECTIONS } from '../../../../services/employeeReportSections'
import { exportEmployeeExcel, exportEmployeeWord } from '../../../../services/employeeReportExport'

const EmployeeReportPanel = ({ employee }) => {
  const [selected, setSelected] = useState(REPORT_SECTIONS.map((s) => s.key))
  const [format, setFormat] = useState('excel')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const allChecked = selected.length === REPORT_SECTIONS.length

  const toggleSection = (key) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }
  const toggleAll = () => setSelected(allChecked ? [] : REPORT_SECTIONS.map((s) => s.key))

  const handleGenerate = async () => {
    if (!selected.length) return
    setGenerating(true)
    setError('')
    try {
      const allSections = await buildEmployeeSections(employee)
      const chosen = allSections.filter((s) => selected.includes(s.key))
      if (format === 'excel') {
        exportEmployeeExcel(chosen, employee)
      } else {
        exportEmployeeWord(chosen, employee)
      }
    } catch (err) {
      setError(err.message || 'Failed to generate report. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <CCard className="border-0 shadow-sm" style={{ borderRadius: 10 }}>
      <CCardHeader className="bg-transparent fw-semibold">Staff Report</CCardHeader>
      <CCardBody>
        <p className="text-body-secondary small mb-3">
          Select the sections to include, then generate this employee&apos;s report.
        </p>

        <CFormCheck
          id="emp-report-all"
          label={<span className="fw-semibold">All</span>}
          checked={allChecked}
          onChange={toggleAll}
          className="mb-2 pb-2 border-bottom"
        />

        {REPORT_SECTIONS.map((section) => (
          <CFormCheck
            key={section.key}
            id={`emp-report-${section.key}`}
            label={section.label}
            checked={selected.includes(section.key)}
            onChange={() => toggleSection(section.key)}
            className="mb-2"
          />
        ))}

        {!selected.length && (
          <CAlert color="light" className="small py-2 mt-2 mb-3">
            Select at least one section to generate a report.
          </CAlert>
        )}

        <CFormLabel htmlFor="emp-report-format" className="small fw-semibold mt-2">
          Download as
        </CFormLabel>
        <CFormSelect
          id="emp-report-format"
          size="sm"
          className="mb-3"
          value={format}
          onChange={(e) => setFormat(e.target.value)}
        >
          <option value="excel">Excel (.xlsx)</option>
          <option value="word">Word (.doc)</option>
        </CFormSelect>

        <CButton
          color="primary"
          size="sm"
          disabled={!selected.length || generating}
          onClick={handleGenerate}
        >
          <CIcon icon={cilCloudDownload} className="me-1" />
          {generating ? 'Generating…' : 'Generate Report'}
        </CButton>

        {error && (
          <CAlert color="danger" className="small py-2 mt-3 mb-0">
            {error}
          </CAlert>
        )}
      </CCardBody>
    </CCard>
  )
}

EmployeeReportPanel.propTypes = {
  employee: PropTypes.object.isRequired,
}

export default EmployeeReportPanel
