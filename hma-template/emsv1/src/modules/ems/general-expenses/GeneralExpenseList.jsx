import React, { useState } from 'react'
import { CCol, CFormLabel, CFormSelect, CRow } from '@coreui/react'
import DivisionsSummary from './components/DivisionsSummary'

const THIS_YEAR = new Date().getFullYear()
const THIS_MONTH = new Date().getMonth() + 1

const MONTHS_OPT = [
  { v: 0, l: 'All Months' },
  { v: 1, l: 'January' },
  { v: 2, l: 'February' },
  { v: 3, l: 'March' },
  { v: 4, l: 'April' },
  { v: 5, l: 'May' },
  { v: 6, l: 'June' },
  { v: 7, l: 'July' },
  { v: 8, l: 'August' },
  { v: 9, l: 'September' },
  { v: 10, l: 'October' },
  { v: 11, l: 'November' },
  { v: 12, l: 'December' },
]
const YEARS = [THIS_YEAR - 2, THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1]

const GeneralExpenseList = () => {
  const [year, setYear] = useState(THIS_YEAR)
  const [month, setMonth] = useState(THIS_MONTH)

  return (
    <>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h4 className="mb-1">General Expenses</h4>
          <p className="text-body-secondary mb-0 small">
            Divisions overview — HR, Admin and Core salary.
          </p>
        </div>

        {/* Period filter */}
        <CRow className="g-2 align-items-end">
          <CCol xs="auto">
            <CFormLabel className="small fw-semibold mb-1">Month</CFormLabel>
            <CFormSelect
              size="sm"
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              style={{ minWidth: 130 }}
            >
              {MONTHS_OPT.map((m) => (
                <option key={m.v} value={m.v}>
                  {m.l}
                </option>
              ))}
            </CFormSelect>
          </CCol>
          <CCol xs="auto">
            <CFormLabel className="small fw-semibold mb-1">Year</CFormLabel>
            <CFormSelect
              size="sm"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              style={{ minWidth: 90 }}
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </CFormSelect>
          </CCol>
        </CRow>
      </div>

      <DivisionsSummary year={year} month={month || undefined} />
    </>
  )
}

export default GeneralExpenseList
