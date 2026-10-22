import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CBadge,
  CCard,
  CCardBody,
  CCol,
  CFormSelect,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import api from '../../../../services/api'
import { localAttendance } from '../../../../services/localAttendance'
import { localHolidays } from '../../../../services/localHolidays'
import { localEmployees } from '../../../../services/localEmployees'
import {
  computeAttendanceDeduction,
  parseTimeToMinutes,
  formatMinutesAsTime,
} from '../../../../services/attendanceCalc'

const MONTHS = [
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
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const pad = (n) => String(n).padStart(2, '0')

const _thisYear = new Date().getFullYear()
const _thisMonth = new Date().getMonth() + 1
const YEARS = Array.from({ length: 5 }, (_, i) => _thisYear - 2 + i)

const STATUS_BG = {
  Present: '#d1e7dd',
  Absent: '#f8d7da',
  'Half Day': '#ffe5b4',
  'On Leave': '#e2d9f3',
  Holiday: '#e9ecef',
  'Weekly Off': '#e9ecef',
}
const LEAVE_TYPE_BG = {
  SL: '#f8d7da',
  CL: '#cff4fc',
  OD: '#d1e7dd',
  COFF: '#fff3cd',
}

const LEGEND = [
  { label: 'Present', bg: '#d1e7dd' },
  { label: 'Absent', bg: '#f8d7da' },
  { label: 'Half Day', bg: '#ffe5b4' },
  { label: 'Leave (SL/CL/OD/COFF)', bg: '#cff4fc' },
  { label: 'Weekly Off / Holiday', bg: '#e9ecef' },
  { label: 'Custom Holiday', bg: '#fff3cd' },
]

const SUMMARY_CARDS = [
  { key: 'present_count', label: 'Present', color: 'success' },
  { key: 'absent_count', label: 'Absent', color: 'danger' },
  { key: 'half_day_count', label: 'Half Day', color: 'warning' },
  { key: 'late_days', label: 'Late Days', color: 'warning' },
  { key: 'leave_count', label: 'On Leave', color: 'info' },
  { key: 'avg_working_hours', label: 'Avg Hours', color: 'primary' },
]

const STATUS_BADGE_COLORS = {
  Present: 'success',
  Absent: 'danger',
  'Half Day': 'warning',
  'Weekly Off': 'secondary',
  Holiday: 'info',
  'On Leave': 'primary',
}

const getCellBg = (rec, holiday) => {
  if (rec) {
    if (rec.status === 'On Leave' && rec.leave_type) {
      return LEAVE_TYPE_BG[rec.leave_type] || '#e2d9f3'
    }
    return STATUS_BG[rec.status] || '#fff'
  }
  if (holiday) {
    return holiday.type === 'custom' ? '#fff3cd' : '#e9ecef'
  }
  return '#fff'
}

const AttendanceSummaryTab = ({ employeeId }) => {
  const [viewYear, setViewYear] = useState(_thisYear)
  const [viewMonth, setViewMonth] = useState(_thisMonth)
  const [summary, setSummary] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [summaryRes, historyRes] = await Promise.all([
          api.get(
            `/employees/${employeeId}/attendance-summary?year=${viewYear}&month=${viewMonth}`,
          ),
          api.get(
            `/attendance?employee_id=${employeeId}&year=${viewYear}&month=${viewMonth}&page_size=100`,
          ),
        ])
        setSummary(summaryRes.data)
        setRecords(historyRes.data.items || [])
      } catch {
        const monthlySummary = await localAttendance.getSummary(employeeId, viewYear, viewMonth)
        const { items } = await localAttendance.listRecords({
          employeeId,
          year: viewYear,
          month: viewMonth,
          pageSize: 100,
        })
        setSummary(monthlySummary)
        setRecords(items)
        if (!monthlySummary && items.length === 0) {
          setError(
            'No attendance data for this month. Import attendance data from the Attendance module.',
          )
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [employeeId, viewYear, viewMonth])

  const [holidayMap, setHolidayMap] = useState({})
  useEffect(() => {
    let cancelled = false
    localHolidays.getMonthMap(viewYear, viewMonth).then((map) => {
      if (!cancelled) setHolidayMap(map)
    })
    return () => {
      cancelled = true
    }
  }, [viewYear, viewMonth])

  const recordMap = useMemo(() => {
    const m = {}
    for (const r of records) m[r.date] = r
    return m
  }, [records])

  const avgCheckInTime = useMemo(() => {
    const minutes = records
      .filter((r) => (r.status === 'Present' || r.status === 'Half Day') && r.in_time)
      .map((r) => parseTimeToMinutes(r.in_time))
      .filter((m) => m != null)
    if (minutes.length === 0) return null
    return formatMinutesAsTime(minutes.reduce((sum, m) => sum + m, 0) / minutes.length)
  }, [records])

  const [empSalary, setEmpSalary] = useState(null)
  useEffect(() => {
    let cancelled = false
    localEmployees
      .getById(employeeId)
      .then((emp) => {
        if (!cancelled) setEmpSalary(emp?.current_salary ? parseFloat(emp.current_salary) : null)
      })
      .catch(() => {
        if (!cancelled) setEmpSalary(null)
      })
    return () => {
      cancelled = true
    }
  }, [employeeId])

  const deductionInfo = useMemo(() => {
    if (!summary || !empSalary) return null
    return computeAttendanceDeduction({
      salary: empSalary,
      presentCount: summary.present_count || 0,
      absentCount: summary.absent_count || 0,
      halfDayCount: summary.half_day_count || 0,
      excessLateUnits: summary.excess_late_units || 0,
    })
  }, [summary, empSalary])

  const { weeks } = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate()
    const firstDow = new Date(viewYear, viewMonth - 1, 1).getDay()
    const startOffset = (firstDow + 6) % 7
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7
    const cells = []
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startOffset + 1
      cells.push(dayNum >= 1 && dayNum <= daysInMonth ? dayNum : null)
    }
    const ws = []
    for (let r = 0; r < cells.length / 7; r++) {
      ws.push(cells.slice(r * 7, r * 7 + 7))
    }
    return { weeks: ws }
  }, [viewYear, viewMonth])

  return (
    <>
      {/* Month / Year selector */}
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <span className="fw-semibold text-body-secondary small">Attendance for:</span>
        <CFormSelect
          size="sm"
          value={viewMonth}
          onChange={(e) => setViewMonth(Number(e.target.value))}
          style={{ width: 140 }}
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </CFormSelect>
        <CFormSelect
          size="sm"
          value={viewYear}
          onChange={(e) => setViewYear(Number(e.target.value))}
          style={{ width: 90 }}
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </CFormSelect>
      </div>

      <CAlert color="secondary" className="small mb-3 py-2">
        Attendance records are read-only in this view. Corrections must be submitted through the
        Attendance module.
      </CAlert>

      {loading ? (
        <div className="text-center py-4">
          <CSpinner color="primary" size="sm" />
          <span className="ms-2 text-body-secondary">Loading attendance…</span>
        </div>
      ) : !summary && records.length === 0 ? (
        <p className="text-body-secondary small">{error}</p>
      ) : (
        <>
          {/* Summary cards */}
          {summary && (
            <CRow className="g-2 mb-4">
              {SUMMARY_CARDS.map(({ key, label, color }) => (
                <CCol xs={4} md={2} key={key}>
                  <CCard className={`border-top border-top-${color} border-3 h-100`}>
                    <CCardBody className="text-center py-2 px-1">
                      <div className={`fs-4 fw-bold text-${color}`}>{summary[key] ?? '—'}</div>
                      <div style={{ fontSize: 11 }} className="text-body-secondary mt-1">
                        {label}
                      </div>
                    </CCardBody>
                  </CCard>
                </CCol>
              ))}
            </CRow>
          )}

          {/* Avg check-in + deduction impact */}
          {summary && (
            <CRow className="g-2 mb-4">
              <CCol xs={6} md={3}>
                <CCard className="border-top border-top-primary border-3 h-100">
                  <CCardBody className="text-center py-2 px-1">
                    <div className="fs-4 fw-bold text-primary">{avgCheckInTime ?? '—'}</div>
                    <div style={{ fontSize: 11 }} className="text-body-secondary mt-1">
                      Avg Check-in Time
                    </div>
                  </CCardBody>
                </CCard>
              </CCol>
              <CCol xs={6} md={3}>
                <CCard className="border-top border-top-danger border-3 h-100">
                  <CCardBody className="text-center py-2 px-1">
                    <div className="fs-4 fw-bold text-danger">
                      {deductionInfo
                        ? `₹ ${deductionInfo.totalDeduction.toFixed(2)}`
                        : 'Not on file'}
                    </div>
                    <div style={{ fontSize: 11 }} className="text-body-secondary mt-1">
                      This Month&rsquo;s Deduction
                    </div>
                  </CCardBody>
                </CCard>
              </CCol>
              <CCol xs={6} md={3}>
                <CCard className="border-top border-top-success border-3 h-100">
                  <CCardBody className="text-center py-2 px-1">
                    <div className="fs-4 fw-bold text-success">
                      {deductionInfo ? `₹ ${deductionInfo.netPayable.toFixed(2)}` : '—'}
                    </div>
                    <div style={{ fontSize: 11 }} className="text-body-secondary mt-1">
                      Net Payable
                    </div>
                  </CCardBody>
                </CCard>
              </CCol>
            </CRow>
          )}

          {/* Attendance Calendar */}
          <div className="mb-4">
            <div className="fw-semibold mb-2">
              {MONTHS[viewMonth - 1]} {viewYear} — Attendance Calendar
            </div>

            {/* Legend */}
            <div className="d-flex gap-3 mb-2 flex-wrap align-items-center">
              {LEGEND.map((item) => (
                <div key={item.label} className="d-flex align-items-center gap-1">
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      background: item.bg,
                      border: '1px solid #dee2e6',
                      borderRadius: 2,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 10 }}>{item.label}</span>
                </div>
              ))}
            </div>

            {/* Day header */}
            <div style={{ display: 'flex', marginBottom: 2 }}>
              {DAY_LABELS.map((label) => (
                <div
                  key={label}
                  style={{
                    width: '14.28%',
                    textAlign: 'center',
                    fontWeight: 600,
                    fontSize: 11,
                    padding: '3px 0',
                    borderBottom: '2px solid #dee2e6',
                  }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'flex' }}>
                {week.map((dayNum, di) => {
                  if (!dayNum) {
                    return (
                      <div
                        key={di}
                        style={{
                          width: '14.28%',
                          minHeight: 54,
                          border: '1px solid #dee2e6',
                          background: '#fafafa',
                        }}
                      />
                    )
                  }
                  const dateStr = `${viewYear}-${pad(viewMonth)}-${pad(dayNum)}`
                  const rec = recordMap[dateStr]
                  const holiday = holidayMap[dateStr]
                  const bg = getCellBg(rec, holiday)
                  const statusLabel =
                    rec?.status === 'On Leave' && rec?.leave_type ? rec.leave_type : rec?.status
                  const showHolidayNote =
                    holiday && rec && rec.status !== 'Holiday' && rec.status !== 'Weekly Off'

                  return (
                    <div
                      key={di}
                      style={{
                        width: '14.28%',
                        minHeight: 54,
                        border: '1px solid #dee2e6',
                        padding: '3px 4px',
                        background: bg,
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{dayNum}</div>
                      {statusLabel && (
                        <div style={{ fontSize: 9, marginTop: 1, opacity: 0.85, lineHeight: 1.3 }}>
                          {statusLabel}
                        </div>
                      )}
                      {showHolidayNote && (
                        <div
                          style={{ fontSize: 8, marginTop: 1, color: '#856404', lineHeight: 1.3 }}
                        >
                          {holiday.name}
                        </div>
                      )}
                      {!rec && holiday && (
                        <div
                          style={{ fontSize: 9, marginTop: 1, color: '#6b7280', lineHeight: 1.3 }}
                        >
                          {holiday.name}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}

            {records.length === 0 && (
              <p className="text-body-secondary small mt-2 mb-0">
                No attendance records for this month. Holidays from the company calendar are shown.
              </p>
            )}
          </div>

          {/* Daily records table */}
          {records.length > 0 && (
            <>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <strong>Daily Records</strong>
                <span className="text-body-secondary small">{records.length} records</span>
              </div>
              <CTable hover responsive small>
                <CTableHead color="light">
                  <CTableRow>
                    <CTableHeaderCell>Date</CTableHeaderCell>
                    <CTableHeaderCell>Status</CTableHeaderCell>
                    <CTableHeaderCell>In Time</CTableHeaderCell>
                    <CTableHeaderCell>Out Time</CTableHeaderCell>
                    <CTableHeaderCell>Working Hours</CTableHeaderCell>
                    <CTableHeaderCell>Late By</CTableHeaderCell>
                    <CTableHeaderCell>Corrections</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {records.map((rec) => (
                    <CTableRow key={rec.id}>
                      <CTableDataCell className="fw-semibold">{rec.date}</CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={STATUS_BADGE_COLORS[rec.status] || 'secondary'}>
                          {rec.status}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell>{rec.in_time || '—'}</CTableDataCell>
                      <CTableDataCell>{rec.out_time || '—'}</CTableDataCell>
                      <CTableDataCell>
                        {rec.work_duration || rec.work_duration_minutes
                          ? rec.work_duration || `${Math.floor(rec.work_duration_minutes / 60)}h`
                          : '—'}
                      </CTableDataCell>
                      <CTableDataCell>
                        {rec.late_by ? (
                          <CBadge color="warning" className="text-dark">
                            {rec.late_by}
                          </CBadge>
                        ) : (
                          '—'
                        )}
                      </CTableDataCell>
                      <CTableDataCell>
                        {(rec.corrections || []).length > 0 ? (
                          <CBadge color="info">{rec.corrections.length}</CBadge>
                        ) : (
                          '—'
                        )}
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            </>
          )}
        </>
      )}
    </>
  )
}

AttendanceSummaryTab.propTypes = {
  employeeId: PropTypes.string.isRequired,
}

export default AttendanceSummaryTab
