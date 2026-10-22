import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormSelect,
  CNav,
  CNavItem,
  CNavLink,
  CProgress,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CTabContent,
  CTabPane,
  CTooltip,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilCalendar,
  cilCloudUpload,
  cilMoney,
  cilPencil,
  cilPeople,
  cilWarning,
} from '@coreui/icons'

import { usePermission } from '../../../hooks/usePermission'
import { MODULE } from '../../../constants/modules'
import api from '../../../services/api'
import { localAttendance } from '../../../services/localAttendance'
import GeneralCalendar from './GeneralCalendar'
import EmployeeCalendarModal from './EmployeeCalendarModal'
import DeductionSummary from './DeductionSummary'

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

const thisYear = new Date().getFullYear()
const thisMonth = new Date().getMonth() + 1
const YEARS = [thisYear - 1, thisYear, thisYear + 1]

const StatCard = ({ label, value, color }) => (
  <CCard className={`border-top border-top-${color} border-3 h-100`}>
    <CCardBody className="text-center py-3">
      <div className={`fs-2 fw-bold text-${color}`}>{value ?? '—'}</div>
      <div className="small text-body-secondary mt-1">{label}</div>
    </CCardBody>
  </CCard>
)

const AttendanceDashboard = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const canEdit = usePermission(MODULE.ATTENDANCE, 'edit')

  // If navigated from import wizard, jump to the imported month/year
  const [activeTab, setActiveTab] = useState('overview')
  const [year, setYear] = useState(location.state?.year || thisYear)
  const [month, setMonth] = useState(location.state?.month || thisMonth)
  const [agg, setAgg] = useState(null)
  const [uploads, setUploads] = useState([])
  const [summaries, setSummaries] = useState([])
  const [coverage, setCoverage] = useState(null)
  const [integrityWarnings, setIntegrityWarnings] = useState([])
  const [loading, setLoading] = useState(true)
  const [calendarEmp, setCalendarEmp] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [uploadsRes, sumRes] = await Promise.all([
          api.get(`/attendance/uploads?year=${year}&month=${month}`),
          api.get(`/attendance/summaries?year=${year}&month=${month}`),
        ])
        setUploads(uploadsRes.data.items || [])
        setSummaries(sumRes.data.items || [])
        setAgg(sumRes.data.aggregate || null)
        setCoverage(await localAttendance.getMonthCoverage(year, month))
        setIntegrityWarnings(await localAttendance.getIntegrityWarnings(year, month))
      } catch {
        const localUploads = await localAttendance.listUploads({ year, month })
        const localSums = await localAttendance.listMonthlySummaries({ year, month })
        const localAgg = await localAttendance.getMonthlySummaryAggregate(year, month)
        setUploads(localUploads)
        setSummaries(localSums)
        setAgg(localAgg)
        setCoverage(await localAttendance.getMonthCoverage(year, month))
        setIntegrityWarnings(await localAttendance.getIntegrityWarnings(year, month))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [year, month])

  return (
    <>
      {/* Header */}
      <CRow className="mb-3 align-items-center">
        <CCol>
          <h4 className="mb-0">Attendance</h4>
        </CCol>
        {canEdit && (
          <CCol xs="auto" className="d-flex gap-2">
            <CButton
              color="warning"
              size="sm"
              onClick={() => navigate('/ems/attendance/corrections')}
            >
              <CIcon icon={cilPencil} className="me-1" />
              Corrections
            </CButton>
            <CButton color="primary" onClick={() => navigate('/ems/attendance/import')}>
              <CIcon icon={cilCloudUpload} className="me-1" />
              Import Excel
            </CButton>
          </CCol>
        )}
      </CRow>

      {/* Month/Year filter */}
      <CCard className="mb-4">
        <CCardBody className="py-3">
          <CRow className="g-2 align-items-center">
            <CCol xs="auto">
              <span className="fw-semibold text-body-secondary small">Viewing:</span>
            </CCol>
            <CCol xs="auto">
              <CFormSelect
                size="sm"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                style={{ width: 140 }}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol xs="auto">
              <CFormSelect
                size="sm"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                style={{ width: 100 }}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {/* Tabs */}
      <CNav variant="tabs" className="mb-3">
        <CNavItem>
          <CNavLink
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            style={{ cursor: 'pointer' }}
          >
            <CIcon icon={cilPeople} className="me-1" />
            Overview
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink
            active={activeTab === 'deductions'}
            onClick={() => setActiveTab('deductions')}
            style={{ cursor: 'pointer' }}
          >
            <CIcon icon={cilMoney} className="me-1" />
            Deductions
          </CNavLink>
        </CNavItem>
      </CNav>

      <CTabContent>
        <CTabPane visible={activeTab === 'deductions'}>
          <DeductionSummary year={year} month={month} />
        </CTabPane>

        <CTabPane visible={activeTab === 'overview'}>
          {loading ? (
            <div className="text-center py-5">
              <CSpinner color="primary" />
            </div>
          ) : (
            <>
              {/* Aggregate summary cards */}
              {agg ? (
                <>
                  <CRow className="g-3 mb-2">
                    <CCol xs={6} md>
                      <StatCard
                        label="Total Employees"
                        value={agg.total_employees}
                        color="primary"
                      />
                    </CCol>
                    <CCol xs={6} md>
                      <StatCard label="No Absences" value={agg.clean_count} color="success" />
                    </CCol>
                    <CCol xs={6} md>
                      <StatCard label="Have Absent Days" value={agg.has_absent} color="danger" />
                    </CCol>
                    <CCol xs={6} md>
                      <StatCard label="Have Late Entries" value={agg.has_late} color="warning" />
                    </CCol>
                    <CCol xs={6} md>
                      <StatCard label="Took Leave" value={agg.has_leave} color="info" />
                    </CCol>
                  </CRow>
                  <p className="text-body-secondary small mb-4 px-1">
                    Each number = count of employees. Total absent days this month:{' '}
                    <strong>{agg.total_absent_days}</strong> &nbsp;|&nbsp; Total late days:{' '}
                    <strong>{agg.total_late_days}</strong>
                  </p>
                </>
              ) : (
                <div className="text-body-secondary small mb-4 px-1">
                  No attendance data for {MONTHS[month - 1]} {year}. Upload an Excel file to get
                  started.
                </div>
              )}

              {/* Month Coverage */}
              {coverage && (
                <CCard className="mb-4">
                  <CCardHeader>
                    <strong>Month Coverage</strong>
                  </CCardHeader>
                  <CCardBody>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="small">
                        {coverage.coveredWorkingDays} of {coverage.totalWorkingDays} working days
                        uploaded
                      </span>
                      {coverage.isComplete ? (
                        <CBadge color="success">Complete</CBadge>
                      ) : (
                        <CBadge color="warning">Incomplete</CBadge>
                      )}
                    </div>
                    <CProgress
                      value={
                        coverage.totalWorkingDays > 0
                          ? (coverage.coveredWorkingDays / coverage.totalWorkingDays) * 100
                          : 0
                      }
                      color={coverage.isComplete ? 'success' : 'warning'}
                    />
                    {!coverage.isComplete && coverage.missingDates.length > 0 && (
                      <div className="text-body-secondary small mt-2">
                        Missing: {coverage.missingDates.slice(0, 10).join(', ')}
                        {coverage.missingDates.length > 10 &&
                          ` and ${coverage.missingDates.length - 10} more`}
                      </div>
                    )}
                  </CCardBody>
                </CCard>
              )}

              {/* Data integrity warnings */}
              {integrityWarnings.length > 0 && (
                <CAlert color="danger" className="mb-4">
                  <CIcon icon={cilWarning} className="me-1" />
                  <strong>Data integrity warning:</strong> some employees have more recorded days
                  than exist in {MONTHS[month - 1]} {year} — likely duplicate or misclassified
                  records.
                  <ul className="mb-0 mt-1">
                    {integrityWarnings.map((w) => (
                      <li key={w.employee_id}>
                        {w.employee_id}: recorded {w.total} days but this month has {w.daysInMonth}{' '}
                        calendar days (over by {w.overBy})
                      </li>
                    ))}
                  </ul>
                </CAlert>
              )}

              {/* Upload History */}
              <CCard className="mb-4">
                <CCardHeader className="d-flex align-items-center justify-content-between">
                  <strong>Upload History</strong>
                  <span className="text-body-secondary small">
                    {MONTHS[month - 1]} {year}
                  </span>
                </CCardHeader>
                <CCardBody className="p-0">
                  {uploads.length === 0 ? (
                    <p className="text-body-secondary small m-3">No uploads for this month.</p>
                  ) : (
                    <CTable hover responsive small className="mb-0">
                      <CTableHead color="light">
                        <CTableRow>
                          <CTableHeaderCell>File</CTableHeaderCell>
                          <CTableHeaderCell>Uploaded By</CTableHeaderCell>
                          <CTableHeaderCell>Uploaded At</CTableHeaderCell>
                          <CTableHeaderCell>Records</CTableHeaderCell>
                          <CTableHeaderCell>Employees</CTableHeaderCell>
                          <CTableHeaderCell>Status</CTableHeaderCell>
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {uploads.map((u) => (
                          <CTableRow key={u.id}>
                            <CTableDataCell className="fw-semibold">{u.file_name}</CTableDataCell>
                            <CTableDataCell>{u.uploaded_by}</CTableDataCell>
                            <CTableDataCell className="small text-body-secondary">
                              {new Date(u.uploaded_at).toLocaleString()}
                            </CTableDataCell>
                            <CTableDataCell>{u.total_records}</CTableDataCell>
                            <CTableDataCell>
                              <CIcon icon={cilPeople} className="me-1 text-body-secondary" />
                              {u.total_employees}
                            </CTableDataCell>
                            <CTableDataCell>
                              <CBadge color={u.status === 'Completed' ? 'success' : 'warning'}>
                                {u.status}
                              </CBadge>
                            </CTableDataCell>
                          </CTableRow>
                        ))}
                      </CTableBody>
                    </CTable>
                  )}
                </CCardBody>
              </CCard>

              {/* Per-employee summary table */}
              {summaries.length > 0 && (
                <CCard>
                  <CCardHeader>
                    <strong>
                      Employee Summary — {MONTHS[month - 1]} {year}
                    </strong>
                  </CCardHeader>
                  <CCardBody className="p-0">
                    <CTable hover responsive small className="mb-0">
                      <CTableHead color="light">
                        <CTableRow>
                          <CTableHeaderCell>Employee ID</CTableHeaderCell>
                          <CTableHeaderCell>Present</CTableHeaderCell>
                          <CTableHeaderCell>Absent</CTableHeaderCell>
                          <CTableHeaderCell>Half Day</CTableHeaderCell>
                          <CTableHeaderCell>Weekly Off</CTableHeaderCell>
                          <CTableHeaderCell>WOP</CTableHeaderCell>
                          <CTableHeaderCell>Leave</CTableHeaderCell>
                          <CTableHeaderCell>Late Days</CTableHeaderCell>
                          <CTableHeaderCell>Avg Hours</CTableHeaderCell>
                          <CTableHeaderCell></CTableHeaderCell>
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {summaries.map((s) => (
                          <CTableRow key={s.id}>
                            <CTableDataCell className="fw-semibold">{s.employee_id}</CTableDataCell>
                            <CTableDataCell>
                              <CBadge color="success">{s.present_count}</CBadge>
                            </CTableDataCell>
                            <CTableDataCell>
                              <CBadge color={s.absent_count > 0 ? 'danger' : 'secondary'}>
                                {s.absent_count}
                              </CBadge>
                            </CTableDataCell>
                            <CTableDataCell>{s.half_day_count || 0}</CTableDataCell>
                            <CTableDataCell>{s.weekly_off_count || 0}</CTableDataCell>
                            <CTableDataCell>{s.weekly_off_worked_count || 0}</CTableDataCell>
                            <CTableDataCell>{s.leave_count || 0}</CTableDataCell>
                            <CTableDataCell>
                              {s.late_days > 0 ? (
                                <CBadge color="warning" className="text-dark">
                                  {s.late_days}
                                </CBadge>
                              ) : (
                                0
                              )}
                            </CTableDataCell>
                            <CTableDataCell className="text-body-secondary small">
                              {s.avg_working_hours || '—'}
                            </CTableDataCell>
                            <CTableDataCell>
                              <CTooltip content="View Calendar">
                                <CButton
                                  color="info"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCalendarEmp(s.employee_id)}
                                >
                                  <CIcon icon={cilCalendar} />
                                </CButton>
                              </CTooltip>
                            </CTableDataCell>
                          </CTableRow>
                        ))}
                      </CTableBody>
                    </CTable>
                  </CCardBody>
                </CCard>
              )}

              {/* General Calendar — company holidays */}
              <div className="mt-4">
                <GeneralCalendar year={year} month={month} />
              </div>
            </>
          )}
        </CTabPane>
      </CTabContent>

      {/* Employee Personal Calendar Modal */}
      <EmployeeCalendarModal
        visible={Boolean(calendarEmp)}
        onClose={() => setCalendarEmp(null)}
        employeeId={calendarEmp}
        year={year}
        month={month}
      />
    </>
  )
}

export default AttendanceDashboard
