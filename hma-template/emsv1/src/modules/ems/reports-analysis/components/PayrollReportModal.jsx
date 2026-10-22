import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { CFormSelect, CRow, CCol } from '@coreui/react'
import ReportGeneratorModal from './ReportGeneratorModal'
import {
  buildPayrollSections,
  PAYROLL_SECTION_DEFS,
} from '../../../../services/payrollReportSections'

const now = new Date()
const YEARS = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const monthName = (m) => new Date(2000, m - 1).toLocaleDateString('en-IN', { month: 'long' })

const PayrollReportModal = ({ visible, onClose }) => {
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  return (
    <ReportGeneratorModal
      visible={visible}
      onClose={onClose}
      title="Payroll Report"
      subtitle={`${monthName(month)} ${year} — all active employees`}
      sectionDefs={PAYROLL_SECTION_DEFS}
      buildSections={() => buildPayrollSections({ year, month })}
      filename={`Payroll_Report_${year}_${String(month).padStart(2, '0')}`}
    >
      <CRow className="g-2 mb-3">
        <CCol xs={6}>
          <label className="small fw-semibold mb-1 d-block">Month</label>
          <CFormSelect size="sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {monthName(m)}
              </option>
            ))}
          </CFormSelect>
        </CCol>
        <CCol xs={6}>
          <label className="small fw-semibold mb-1 d-block">Year</label>
          <CFormSelect size="sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </CFormSelect>
        </CCol>
      </CRow>
    </ReportGeneratorModal>
  )
}

PayrollReportModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
}

export default PayrollReportModal
