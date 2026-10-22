import React from 'react'
import { CCol, CFormSelect, CRow } from '@coreui/react'

const MONTHS = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const thisYear = new Date().getFullYear()
const YEARS = [thisYear - 2, thisYear - 1, thisYear, thisYear + 1]

const STATUSES = ['', 'Pending', 'Paid', 'Overdue', 'Cancelled']

const ExpenseFilters = ({ year, month, categoryId, status, categories, onChange }) => {
  const set = (key, val) => onChange({ year, month, categoryId, status, [key]: val })

  return (
    <CRow className="g-2 mb-3">
      <CCol sm={3}>
        <CFormSelect
          value={year}
          onChange={(e) => set('year', e.target.value ? parseInt(e.target.value) : '')}
        >
          <option value="">All Years</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </CFormSelect>
      </CCol>

      <CCol sm={3}>
        <CFormSelect
          value={month}
          onChange={(e) => set('month', e.target.value ? parseInt(e.target.value) : '')}
        >
          {MONTHS.map((m, i) => (
            <option key={i} value={i || ''}>
              {i === 0 ? 'All Months' : m}
            </option>
          ))}
        </CFormSelect>
      </CCol>

      <CCol sm={3}>
        <CFormSelect value={categoryId} onChange={(e) => set('categoryId', e.target.value)}>
          <option value="">All Categories</option>
          {(categories || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </CFormSelect>
      </CCol>

      <CCol sm={3}>
        <CFormSelect value={status} onChange={(e) => set('status', e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s || 'All Statuses'}
            </option>
          ))}
        </CFormSelect>
      </CCol>
    </CRow>
  )
}

export default ExpenseFilters
