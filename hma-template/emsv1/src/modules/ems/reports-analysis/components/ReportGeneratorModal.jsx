import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CFormCheck,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudDownload } from '@coreui/icons'
import { exportSectionsToExcel } from '../../../../services/reportExcelExport'
import { exportSectionsToWord } from '../../../../services/reportWordExport'
import { exportSectionsToPdf } from '../../../../services/reportPdfExport'

const FORMAT_LABELS = { excel: 'Excel (.xlsx)', word: 'Word (.doc)', pdf: 'PDF' }
const WRITERS = {
  excel: exportSectionsToExcel,
  word: exportSectionsToWord,
  pdf: exportSectionsToPdf,
}

/**
 * Generic report-picker modal reused by every new Reports-hub report
 * (Forecast Expense, Attendance, Payroll). `sectionDefs` drives the
 * checkbox list (shown before data is loaded); `buildSections` does the
 * actual data work and is called lazily on Generate, returning the full
 * section array keyed the same way as `sectionDefs` — the modal filters to
 * whatever the user checked before handing sections to the chosen writer.
 * Mirrors the checkbox-picker UX of ExpensePoolReportModal/
 * ConsolidatedReportModal so all Reports-hub generators feel the same.
 */
const ReportGeneratorModal = ({
  visible,
  onClose,
  title,
  subtitle,
  sectionDefs,
  buildSections,
  filename,
  formats,
  children,
}) => {
  const [selected, setSelected] = useState(sectionDefs.map((s) => s.key))
  const [format, setFormat] = useState(formats[0])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const allChecked = selected.length === sectionDefs.length
  const toggleKey = (key) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }
  const toggleAll = () => setSelected(allChecked ? [] : sectionDefs.map((s) => s.key))

  const handleGenerate = async () => {
    if (!selected.length) return
    setGenerating(true)
    setError('')
    try {
      const allSections = await buildSections()
      const chosen = allSections.filter((s) => selected.includes(s.key))
      WRITERS[format](chosen, { title, subtitle, filename })
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
        <CModalTitle>{title}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {children}

        <CFormCheck
          id="report-gen-all"
          label={<span className="fw-semibold">All</span>}
          checked={allChecked}
          onChange={toggleAll}
          className="mb-2 pb-2 border-bottom"
        />
        {sectionDefs.map((section) => (
          <CFormCheck
            key={section.key}
            id={`report-gen-${section.key}`}
            label={section.label}
            checked={selected.includes(section.key)}
            onChange={() => toggleKey(section.key)}
            className="mb-2"
          />
        ))}

        <div className="mt-3">
          <label htmlFor="report-gen-format" className="small fw-semibold mb-1 d-block">
            Format
          </label>
          <CFormSelect
            id="report-gen-format"
            size="sm"
            style={{ maxWidth: 220 }}
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            {formats.map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABELS[f]}
              </option>
            ))}
          </CFormSelect>
        </div>

        {!selected.length && (
          <CAlert color="light" className="small py-2 mt-3 mb-0">
            Select at least one section to generate a report.
          </CAlert>
        )}
        {error && (
          <CAlert color="danger" className="small py-2 mt-3 mb-0">
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

ReportGeneratorModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  sectionDefs: PropTypes.arrayOf(
    PropTypes.shape({ key: PropTypes.string.isRequired, label: PropTypes.string.isRequired }),
  ).isRequired,
  buildSections: PropTypes.func.isRequired,
  filename: PropTypes.string,
  formats: PropTypes.arrayOf(PropTypes.oneOf(['excel', 'word', 'pdf'])),
  children: PropTypes.node,
}

ReportGeneratorModal.defaultProps = {
  subtitle: undefined,
  filename: undefined,
  formats: ['excel', 'word', 'pdf'],
  children: null,
}

export default ReportGeneratorModal
