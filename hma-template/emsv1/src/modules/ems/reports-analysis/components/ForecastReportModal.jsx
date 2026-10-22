import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { CFormSelect, CRow, CCol } from '@coreui/react'
import ReportGeneratorModal from './ReportGeneratorModal'
import {
  buildForecastSections,
  FORECAST_SECTION_DEFS,
} from '../../../../services/forecastReportSections'

const monthKeyOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
const addMonths = (ym, delta) => {
  const [y, m] = ym.split('-').map(Number)
  return monthKeyOf(new Date(y, m - 1 + delta, 1))
}
const monthOptions = () => {
  const now = monthKeyOf(new Date())
  const months = []
  for (let i = -35; i <= 0; i += 1) months.push(addMonths(now, i))
  return months
}
const ALL_MONTHS = monthOptions()

const ForecastReportModal = ({ visible, onClose }) => {
  const [start, setStart] = useState(ALL_MONTHS[Math.max(0, ALL_MONTHS.length - 3)])
  const [end, setEnd] = useState(ALL_MONTHS[ALL_MONTHS.length - 1])

  return (
    <ReportGeneratorModal
      visible={visible}
      onClose={onClose}
      title="Forecast Expense Report"
      subtitle={`Actual data range: ${start} to ${end}`}
      sectionDefs={FORECAST_SECTION_DEFS}
      buildSections={() => buildForecastSections({ start, end })}
      filename="Forecast_Expense_Report"
    >
      <CRow className="g-2 mb-3">
        <CCol xs={6}>
          <label className="small fw-semibold mb-1 d-block">From</label>
          <CFormSelect size="sm" value={start} onChange={(e) => setStart(e.target.value)}>
            {ALL_MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </CFormSelect>
        </CCol>
        <CCol xs={6}>
          <label className="small fw-semibold mb-1 d-block">To</label>
          <CFormSelect size="sm" value={end} onChange={(e) => setEnd(e.target.value)}>
            {ALL_MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </CFormSelect>
        </CCol>
      </CRow>
    </ReportGeneratorModal>
  )
}

ForecastReportModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
}

export default ForecastReportModal
