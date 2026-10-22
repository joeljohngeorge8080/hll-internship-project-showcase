import React, { useEffect, useState } from 'react'
import {
  CAlert,
  CBadge,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormSelect,
  CProgress,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'

import { MODULE } from '../../../../constants/modules'
import { usePermission } from '../../../../hooks/usePermission'
import api from '../../../../services/api'
import { localGeneralExpenses } from '../../../../services/localGeneralExpenses'

const thisYear = new Date().getFullYear()
const YEARS = [thisYear - 2, thisYear - 1, thisYear, thisYear + 1]

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

const currency = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const StatCard = ({ label, value, sub, color }) => (
  <CCard className={`border-top border-top-${color} border-3 h-100`}>
    <CCardBody className="py-3">
      <div className={`fs-3 fw-bold text-${color}`}>{value}</div>
      <div className="small text-body-secondary">{label}</div>
      {sub && <div className="small mt-1">{sub}</div>}
    </CCardBody>
  </CCard>
)

const varianceColor = (v) => {
  if (v > 0) return 'danger'
  if (v < 0) return 'success'
  return 'secondary'
}

const ExpenseAnalysis = () => {
  usePermission(MODULE.GENERAL_EXPENSES, 'view')

  const [year, setYear] = useState(thisYear)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async (y) => {
    setLoading(true)
    setError('')
    try {
      const { data: res } = await api.get(`/general-expenses/analysis?year=${y}`)
      setData(res)
    } catch {
      setData(await localGeneralExpenses.analysis.get(y))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(year)
  }, [year])

  if (loading)
    return (
      <div className="text-center py-5">
        <CSpinner />
      </div>
    )
  if (error) return <CAlert color="danger">{error}</CAlert>
  if (!data) return null

  const utilizationPct =
    data.ytd_planned > 0 ? Math.min(100, Math.round((data.ytd_actual / data.ytd_planned) * 100)) : 0

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <strong className="fs-5">Expense Analysis</strong>
        <CFormSelect
          style={{ width: 110 }}
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </CFormSelect>
      </div>

      {/* YTD Summary Cards */}
      <CRow className="g-3 mb-4">
        <CCol sm={6} lg={3}>
          <StatCard label="YTD Budgeted" value={currency(data.ytd_planned)} color="primary" />
        </CCol>
        <CCol sm={6} lg={3}>
          <StatCard label="YTD Actual" value={currency(data.ytd_actual)} color="info" />
        </CCol>
        <CCol sm={6} lg={3}>
          <StatCard
            label="YTD Variance"
            value={currency(Math.abs(data.ytd_variance))}
            sub={
              data.ytd_variance > 0
                ? 'Over budget'
                : data.ytd_variance < 0
                  ? 'Under budget'
                  : 'On track'
            }
            color={varianceColor(data.ytd_variance)}
          />
        </CCol>
        <CCol sm={6} lg={3}>
          <StatCard
            label="Budget Utilization"
            value={`${utilizationPct}%`}
            sub={
              <CProgress
                value={utilizationPct}
                color={
                  utilizationPct > 100 ? 'danger' : utilizationPct > 80 ? 'warning' : 'success'
                }
                className="mt-1"
                style={{ height: 6 }}
              />
            }
            color="dark"
          />
        </CCol>
      </CRow>

      <CRow className="g-3 mb-4">
        {/* Monthly Summary */}
        <CCol lg={7}>
          <CCard className="h-100">
            <CCardHeader>
              <strong>Monthly Breakdown</strong>
            </CCardHeader>
            <CCardBody>
              {data.monthly_summary.length === 0 ? (
                <p className="text-body-secondary">No data for {year}.</p>
              ) : (
                <CTable small hover responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Month</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Planned</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Actual</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Variance</CTableHeaderCell>
                      <CTableHeaderCell className="text-center">Records</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {data.monthly_summary.map((m) => (
                      <CTableRow key={m.month}>
                        <CTableDataCell>{MONTHS[m.month]}</CTableDataCell>
                        <CTableDataCell className="text-end">
                          {currency(m.planned_total)}
                        </CTableDataCell>
                        <CTableDataCell className="text-end">
                          {currency(m.actual_total)}
                        </CTableDataCell>
                        <CTableDataCell className="text-end">
                          <CBadge color={varianceColor(m.variance_total)}>
                            {m.variance_total > 0 ? '+' : ''}
                            {currency(m.variance_total)}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell className="text-center">{m.record_count}</CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
          </CCard>
        </CCol>

        {/* Category Breakdown */}
        <CCol lg={5}>
          <CCard className="h-100">
            <CCardHeader>
              <strong>Category Breakdown</strong>
            </CCardHeader>
            <CCardBody>
              {data.category_summary.length === 0 ? (
                <p className="text-body-secondary">No data.</p>
              ) : (
                <>
                  {data.category_summary.map((c) => {
                    const pct =
                      data.ytd_actual > 0 ? Math.round((c.actual_total / data.ytd_actual) * 100) : 0
                    return (
                      <div key={c.category_id} className="mb-3">
                        <div className="d-flex justify-content-between small mb-1">
                          <span className="fw-semibold">{c.category_name}</span>
                          <span className="text-body-secondary">
                            {currency(c.actual_total)} ({pct}%)
                          </span>
                        </div>
                        <CProgress value={pct} color="primary" style={{ height: 6 }} />
                      </div>
                    )
                  })}
                </>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Status Breakdown */}
      {Object.keys(data.status_breakdown).length > 0 && (
        <CCard>
          <CCardHeader>
            <strong>Status Distribution</strong>
          </CCardHeader>
          <CCardBody>
            <div className="d-flex flex-wrap gap-3">
              {Object.entries(data.status_breakdown).map(([s, count]) => {
                const color =
                  s === 'Paid'
                    ? 'success'
                    : s === 'Overdue'
                      ? 'danger'
                      : s === 'Cancelled'
                        ? 'secondary'
                        : 'warning'
                return (
                  <div key={s} className="text-center">
                    <div className={`fs-4 fw-bold text-${color}`}>{count}</div>
                    <CBadge color={color}>{s}</CBadge>
                  </div>
                )
              })}
            </div>
          </CCardBody>
        </CCard>
      )}
    </>
  )
}

export default ExpenseAnalysis
