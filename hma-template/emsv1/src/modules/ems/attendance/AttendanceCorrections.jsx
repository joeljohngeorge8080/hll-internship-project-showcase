import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft, cilCalendar, cilCheckCircle, cilPencil, cilWarning } from '@coreui/icons'
import { useSelector } from 'react-redux'

import { usePermission } from '../../../hooks/usePermission'
import { MODULE } from '../../../constants/modules'
import api from '../../../services/api'
import { localAttendance } from '../../../services/localAttendance'
import { localEmployees } from '../../../services/localEmployees'
import MonthCalendar from './MonthCalendar'

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

const STATUSES = ['Present', 'Absent', 'Half Day', 'On Leave', 'Holiday', 'Weekly Off']
const STATUS_COLORS = {
  Present: 'success',
  Absent: 'danger',
  'Half Day': 'warning',
  'Weekly Off': 'secondary',
  Holiday: 'info',
  'On Leave': 'primary',
}

const LEAVE_TYPES = [
  { code: 'SL', label: 'Sick Leave', color: 'danger' },
  { code: 'CL', label: 'Casual Leave', color: 'info' },
  { code: 'OD', label: 'On Duty', color: 'success' },
  { code: 'COFF', label: 'Compensated Off', color: 'warning' },
]

const LEGEND_ITEMS = [
  { label: 'Present', bg: '#d1e7dd' },
  { label: 'Absent', bg: '#f8d7da' },
  { label: 'Half Day', bg: '#ffe5b4' },
  { label: 'SL', bg: '#f8d7da' },
  { label: 'CL', bg: '#cff4fc' },
  { label: 'OD', bg: '#d1e7dd' },
  { label: 'COFF', bg: '#fff3cd' },
  { label: 'Holiday/Off', bg: '#e9ecef' },
  { label: 'Selected', bg: 'var(--cui-primary)' },
]

const PAGE_SIZE = 20

const AttendanceCorrections = () => {
  const navigate = useNavigate()
  const canEdit = usePermission(MODULE.ATTENDANCE, 'edit')
  const currentUser = useSelector((s) => s.user)

  // ── filters ────────────────────────────────────────────────────────
  const [year, setYear] = useState(thisYear)
  const [month, setMonth] = useState(thisMonth)
  const [empSearch, setEmpSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  // ── summaries list (primary calendar entry point) ──────────────────
  const [summaries, setSummaries] = useState([])
  const [summariesLoading, setSummariesLoading] = useState(false)

  // ── calendar modal ─────────────────────────────────────────────────
  const [calendarEmployee, setCalendarEmployee] = useState(null)
  const [empRecords, setEmpRecords] = useState([])
  const [empRecordsLoading, setEmpRecordsLoading] = useState(false)
  const [selectedDates, setSelectedDates] = useState(new Set())
  const [pendingAction, setPendingAction] = useState(null)
  const [applyReason, setApplyReason] = useState('')
  const [applyProgress, setApplyProgress] = useState(null)
  const [calendarError, setCalendarError] = useState('')

  // ── legacy row-level correction modal (demoted) ────────────────────
  const [selected, setSelected] = useState(null)
  const [corrForm, setCorrForm] = useState({
    new_status: '',
    new_in_time: '',
    new_out_time: '',
    reason: '',
  })
  const [saving, setSaving] = useState(false)
  const [corrError, setCorrError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  // ── legacy flat records (demoted table) ────────────────────────────
  const [records, setRecords] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  // ── employee name lookup map ───────────────────────────────────────
  const [nameMap, setNameMap] = useState({})

  // ── drag refs (useRef so mousemove reads live value, not stale closure)
  const isDragging = useRef(false)
  const dragAnchor = useRef(null)

  // ── Effect 0: build employee_id → name lookup ─────────────────────
  useEffect(() => {
    let cancelled = false
    localEmployees
      .list({ pageSize: 1000, includeDeleted: true })
      .then(({ items }) => {
        if (cancelled) return
        const map = {}
        for (const e of items) map[e.employee_id] = e.employee_name
        setNameMap(map)
      })
      .catch(() => {
        // silent — name display degrades gracefully
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ── Effect 1: load employee summaries ──────────────────────────────
  useEffect(() => {
    const load = async () => {
      setSummariesLoading(true)
      try {
        const { data } = await api.get(`/attendance/summaries?year=${year}&month=${month}`)
        let rows = data.items || []
        if (empSearch) {
          const q = empSearch.toLowerCase()
          rows = rows.filter(
            (s) =>
              s.employee_id.toLowerCase().includes(q) ||
              (nameMap[s.employee_id] || '').toLowerCase().includes(q),
          )
        }
        setSummaries(rows)
      } catch {
        let rows = await localAttendance.listMonthlySummaries({ year, month })
        if (empSearch) {
          const q = empSearch.toLowerCase()
          rows = rows.filter(
            (s) =>
              s.employee_id.toLowerCase().includes(q) ||
              (nameMap[s.employee_id] || '').toLowerCase().includes(q),
          )
        }
        setSummaries(rows)
      } finally {
        setSummariesLoading(false)
      }
    }
    load()
  }, [year, month, empSearch, refreshTick, nameMap])

  // ── Effect 2: per-employee daily records for calendar modal ────────
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!calendarEmployee) {
        if (!cancelled) setEmpRecords([])
        return
      }
      if (!cancelled) setEmpRecordsLoading(true)
      try {
        const { data } = await api.get(
          `/attendance/records?employee_id=${calendarEmployee.employee_id}&year=${year}&month=${month}&page_size=100`,
        )
        if (!cancelled) setEmpRecords(data.items || [])
      } catch {
        const result = await localAttendance.listRecords({
          employeeId: calendarEmployee.employee_id,
          year,
          month,
          pageSize: 100,
        })
        if (!cancelled) setEmpRecords(result.items)
      } finally {
        if (!cancelled) setEmpRecordsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [calendarEmployee, year, month])

  // ── Effect 3: flat records for demoted table ───────────────────────
  // When a specific date is selected, load all records for that date at once
  // (max ~50 employees) — no pagination needed. Without a date filter the
  // full month is paginated in PAGE_SIZE chunks.
  useEffect(() => {
    const loadRecords = async () => {
      setLoading(true)
      const activePage = dateFilter ? 1 : page
      const activePageSize = dateFilter ? 500 : PAGE_SIZE
      try {
        const params = new URLSearchParams({
          year,
          month,
          page: activePage,
          page_size: activePageSize,
        })
        if (empSearch) params.set('employee_id', empSearch)
        if (dateFilter) params.set('date', dateFilter)
        const { data } = await api.get(`/attendance/records?${params}`)
        setRecords(data.items || [])
        setTotal(data.total || 0)
      } catch {
        const result = await localAttendance.listRecords({
          year,
          month,
          date: dateFilter || undefined,
          employeeId: empSearch || undefined,
          page: activePage,
          pageSize: activePageSize,
        })
        setRecords(result.items)
        setTotal(result.total)
      } finally {
        setLoading(false)
      }
    }
    loadRecords()
  }, [year, month, page, empSearch, dateFilter, refreshTick])

  // ── Effect 4: cancel drag if mouse released outside the window ─────
  useEffect(() => {
    const cancel = () => {
      isDragging.current = false
    }
    window.addEventListener('mouseup', cancel)
    return () => window.removeEventListener('mouseup', cancel)
  }, [])

  // ── Calendar handlers ──────────────────────────────────────────────
  const handleOpenCalendar = (summary) => {
    setCalendarEmployee(summary)
    setSelectedDates(new Set())
    setPendingAction(null)
    setApplyReason('')
    setCalendarError('')
    setApplyProgress(null)
  }

  const handleCloseCalendar = () => {
    setCalendarEmployee(null)
    setSelectedDates(new Set())
    setPendingAction(null)
    setApplyReason('')
    setCalendarError('')
    setApplyProgress(null)
  }

  const handleDragStart = (dateStr) => {
    isDragging.current = true
    dragAnchor.current = dateStr
    setSelectedDates(new Set([dateStr]))
  }

  const handleDragEnter = (dateStr) => {
    if (!isDragging.current) return
    const anchor = dragAnchor.current
    const a = new Date(anchor)
    const b = new Date(dateStr)
    const [start, end] = a <= b ? [a, b] : [b, a]
    const range = new Set()
    const cursor = new Date(start)
    while (cursor <= end) {
      range.add(cursor.toISOString().slice(0, 10))
      cursor.setDate(cursor.getDate() + 1)
    }
    setSelectedDates(range)
  }

  const handleDragEnd = () => {
    isDragging.current = false
  }

  const handleApply = async () => {
    if (!pendingAction || !applyReason.trim()) {
      setCalendarError(
        pendingAction === null
          ? 'Choose an action (Mark as Present or a leave type) and provide a reason.'
          : 'Reason is required.',
      )
      return
    }
    setCalendarError('')
    const datesToApply = [...selectedDates].sort()
    setApplyProgress({ done: 0, total: datesToApply.length })

    const isMarkPresent = pendingAction === 'PRESENT'
    let done = 0
    for (const dateStr of datesToApply) {
      const rec = empRecords.find((r) => r.date === dateStr)
      if (!rec) {
        done++
        setApplyProgress({ done, total: datesToApply.length })
        continue
      }
      const payload = isMarkPresent
        ? {
            new_status: 'Present',
            leave_type: null,
            new_in_time: null,
            new_out_time: null,
            reason: applyReason.trim(),
            corrected_by: currentUser?.full_name || currentUser?.employee_id || 'HR',
          }
        : {
            new_status: 'On Leave',
            leave_type: pendingAction,
            new_in_time: null,
            new_out_time: null,
            reason: applyReason.trim(),
            corrected_by: currentUser?.full_name || currentUser?.employee_id || 'HR',
          }
      try {
        await api.patch(`/attendance/records/${rec.id}/correct`, payload)
      } catch {
        await localAttendance.applyCorrection(rec.id, payload)
      }
      done++
      setApplyProgress({ done, total: datesToApply.length })
    }

    const refreshed = await localAttendance.listRecords({
      employeeId: calendarEmployee.employee_id,
      year,
      month,
      pageSize: 100,
    })
    setEmpRecords(refreshed.items)
    setApplyProgress(null)
    setSelectedDates(new Set())
    setPendingAction(null)
    setApplyReason('')
    setRefreshTick((t) => t + 1)
  }

  // ── Legacy row-level correction handlers ───────────────────────────
  const openCorrection = (rec) => {
    setSelected(rec)
    setCorrForm({
      new_status: rec.status,
      new_in_time: rec.in_time || '',
      new_out_time: rec.out_time || '',
      reason: '',
    })
    setCorrError('')
  }

  const handleSaveCorrection = async (e) => {
    e.preventDefault()
    if (!corrForm.reason.trim()) {
      setCorrError('Reason is required for every correction.')
      return
    }
    setSaving(true)
    setCorrError('')
    try {
      try {
        await api.patch(`/attendance/records/${selected.id}/correct`, {
          ...corrForm,
          corrected_by: currentUser?.employee_id,
        })
      } catch {
        await localAttendance.applyCorrection(selected.id, {
          ...corrForm,
          corrected_by: currentUser?.full_name || currentUser?.employee_id || 'HR',
        })
      }
      setSelected(null)
      setRefreshTick((t) => t + 1)
    } catch (err) {
      setCorrError(err.message || 'Failed to apply correction')
    } finally {
      setSaving(false)
    }
  }

  if (!canEdit) {
    return (
      <CAlert color="danger">
        <strong>Access Denied.</strong> Only HR may perform attendance corrections.
      </CAlert>
    )
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <CRow className="mb-3 align-items-center">
        <CCol>
          <CButton
            color="link"
            className="ps-0 text-decoration-none"
            onClick={() => navigate('/ems/attendance')}
          >
            <CIcon icon={cilArrowLeft} className="me-1" />
            Back to Attendance
          </CButton>
        </CCol>
      </CRow>

      <h4 className="mb-3">Attendance Corrections</h4>

      <CAlert color="warning" className="small mb-3 py-2">
        <CIcon icon={cilWarning} className="me-1" />
        Every correction is permanently logged. Original values are preserved in the audit trail.
        Only HR may perform corrections.
      </CAlert>

      {/* Filters */}
      <CCard className="mb-4">
        <CCardBody className="py-3">
          <CRow className="g-2 align-items-end">
            <CCol md={2}>
              <label className="fw-semibold small mb-1 d-block">Month</label>
              <CFormSelect
                size="sm"
                value={month}
                onChange={(e) => {
                  setMonth(Number(e.target.value))
                  setPage(1)
                  setDateFilter('')
                }}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={1}>
              <label className="fw-semibold small mb-1 d-block">Year</label>
              <CFormSelect
                size="sm"
                value={year}
                onChange={(e) => {
                  setYear(Number(e.target.value))
                  setPage(1)
                  setDateFilter('')
                }}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={2}>
              <label className="fw-semibold small mb-1 d-block">Date</label>
              <CFormInput
                type="date"
                size="sm"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value)
                  setPage(1)
                }}
              />
            </CCol>
            <CCol md={3}>
              <label className="fw-semibold small mb-1 d-block">Employee ID / Name</label>
              <CFormInput
                size="sm"
                placeholder="Filter by ID or name"
                value={empSearch}
                onChange={(e) => {
                  setEmpSearch(e.target.value)
                  setPage(1)
                }}
              />
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {/* Employee Summaries — primary calendar entry */}
      <CCard className="mb-4">
        <CCardHeader className="d-flex align-items-center justify-content-between">
          <strong>
            Employees — {MONTHS[month - 1]} {year}
          </strong>
          <span className="text-body-secondary small">
            {summaries.length} employee{summaries.length !== 1 ? 's' : ''}
          </span>
        </CCardHeader>
        <CCardBody className="p-0">
          {summariesLoading ? (
            <div className="text-center py-4">
              <CSpinner color="primary" size="sm" />
            </div>
          ) : summaries.length === 0 ? (
            <p className="text-body-secondary small m-3">
              No attendance data for this month. Import attendance first.
            </p>
          ) : (
            <CTable hover responsive small className="mb-0">
              <CTableHead color="light">
                <CTableRow>
                  <CTableHeaderCell>Employee ID</CTableHeaderCell>
                  <CTableHeaderCell>Name</CTableHeaderCell>
                  <CTableHeaderCell>Present</CTableHeaderCell>
                  <CTableHeaderCell>Absent</CTableHeaderCell>
                  <CTableHeaderCell>Half Day</CTableHeaderCell>
                  <CTableHeaderCell>Leave</CTableHeaderCell>
                  <CTableHeaderCell>Late Days</CTableHeaderCell>
                  <CTableHeaderCell></CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {summaries.map((s) => (
                  <CTableRow key={s.id || s.employee_id}>
                    <CTableDataCell className="fw-semibold">{s.employee_id}</CTableDataCell>
                    <CTableDataCell>{nameMap[s.employee_id] || '—'}</CTableDataCell>
                    <CTableDataCell>
                      <CBadge color="success">{s.present_count || 0}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={(s.absent_count || 0) > 0 ? 'danger' : 'secondary'}>
                        {s.absent_count || 0}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>{s.half_day_count || 0}</CTableDataCell>
                    <CTableDataCell>{s.leave_count || 0}</CTableDataCell>
                    <CTableDataCell>
                      {(s.late_days || 0) > 0 ? (
                        <CBadge color="warning" className="text-dark">
                          {s.late_days}
                        </CBadge>
                      ) : (
                        0
                      )}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CButton color="primary" size="sm" onClick={() => handleOpenCalendar(s)}>
                        <CIcon icon={cilCalendar} className="me-1" />
                        Open Calendar
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>

      {/* All Records — row-level editing, filtered by date */}
      <CCard className="mb-4">
        <CCardHeader className="d-flex align-items-center justify-content-between">
          <strong>
            {dateFilter ? `Records — ${dateFilter}` : `All Records — ${MONTHS[month - 1]} ${year}`}
          </strong>
          <span className="text-body-secondary small">{total} records</span>
        </CCardHeader>
        <CCardBody className="p-0">
          {!dateFilter && (
            <div className="px-3 py-2 border-bottom bg-info-subtle small text-info-emphasis">
              Select a date above to view all employee records for that day.
            </div>
          )}
          {loading ? (
            <div className="text-center py-4">
              <CSpinner color="primary" size="sm" />
            </div>
          ) : records.length === 0 ? (
            <p className="text-body-secondary small m-3">
              {dateFilter ? 'No records found for this date.' : 'No records found.'}
            </p>
          ) : (
            <CTable hover responsive small className="mb-0">
              <CTableHead color="light">
                <CTableRow>
                  <CTableHeaderCell>Employee ID</CTableHeaderCell>
                  <CTableHeaderCell>Name</CTableHeaderCell>
                  <CTableHeaderCell>Date</CTableHeaderCell>
                  <CTableHeaderCell>Status</CTableHeaderCell>
                  <CTableHeaderCell>In Time</CTableHeaderCell>
                  <CTableHeaderCell>Out Time</CTableHeaderCell>
                  <CTableHeaderCell>Late By</CTableHeaderCell>
                  <CTableHeaderCell>Corrections</CTableHeaderCell>
                  <CTableHeaderCell></CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {records.map((rec) => (
                  <CTableRow key={rec.id}>
                    <CTableDataCell className="fw-semibold">{rec.employee_id}</CTableDataCell>
                    <CTableDataCell>
                      {rec.employee_name || nameMap[rec.employee_id] || '—'}
                    </CTableDataCell>
                    <CTableDataCell>{rec.date}</CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={STATUS_COLORS[rec.status] || 'secondary'}>
                        {rec.leave_type ? `${rec.status} (${rec.leave_type})` : rec.status}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>{rec.in_time || '—'}</CTableDataCell>
                    <CTableDataCell>{rec.out_time || '—'}</CTableDataCell>
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
                        <span className="text-body-secondary">—</span>
                      )}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CButton
                        color="warning"
                        variant="outline"
                        size="sm"
                        onClick={() => openCorrection(rec)}
                      >
                        <CIcon icon={cilPencil} />
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}

          {!dateFilter && totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top">
              <span className="text-body-secondary small">
                Page {page} of {totalPages}
              </span>
              <div className="d-flex gap-1">
                <CButton
                  size="sm"
                  color="secondary"
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ‹
                </CButton>
                <CButton
                  size="sm"
                  color="secondary"
                  variant="outline"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  ›
                </CButton>
              </div>
            </div>
          )}
        </CCardBody>
      </CCard>

      {/* Calendar Modal */}
      <CModal
        visible={Boolean(calendarEmployee)}
        onClose={handleCloseCalendar}
        backdrop="static"
        size="xl"
      >
        <CModalHeader>
          <CModalTitle>
            Calendar — {calendarEmployee?.employee_id}
            {calendarEmployee && nameMap[calendarEmployee.employee_id]
              ? ` — ${nameMap[calendarEmployee.employee_id]}`
              : ''}{' '}
            — {MONTHS[month - 1]} {year}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {empRecordsLoading ? (
            <div className="text-center py-4">
              <CSpinner color="primary" />
            </div>
          ) : (
            <>
              {/* Legend */}
              <div className="d-flex gap-3 mb-3 flex-wrap align-items-center">
                {LEGEND_ITEMS.map((item) => (
                  <div key={item.label} className="d-flex align-items-center gap-1">
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        background: item.bg,
                        border: '1px solid #dee2e6',
                        borderRadius: 2,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 11 }}>{item.label}</span>
                  </div>
                ))}
              </div>

              <p className="text-body-secondary small mb-2">
                Drag across days to select a range, then choose an action below.
              </p>

              <MonthCalendar
                year={year}
                month={month}
                records={empRecords}
                selectedDates={selectedDates}
                onDragStart={handleDragStart}
                onDragEnter={handleDragEnter}
                onDragEnd={handleDragEnd}
              />

              {/* Apply panel */}
              {selectedDates.size > 0 && (
                <div className="mt-3 p-3 border rounded bg-light">
                  <div className="fw-semibold mb-2">
                    {selectedDates.size} day{selectedDates.size !== 1 ? 's' : ''} selected — choose
                    an action:
                  </div>

                  {/* Mark as Present */}
                  <div className="mb-2">
                    <span className="small text-body-secondary fw-semibold me-2">Attendance:</span>
                    <CButton
                      color="success"
                      variant={pendingAction === 'PRESENT' ? undefined : 'outline'}
                      size="sm"
                      onClick={() => setPendingAction('PRESENT')}
                    >
                      <CIcon icon={cilCheckCircle} className="me-1" />
                      Mark as Present
                    </CButton>
                  </div>

                  {/* Leave types */}
                  <div className="d-flex gap-2 mb-3 flex-wrap align-items-center">
                    <span className="small text-body-secondary fw-semibold">Leave:</span>
                    {LEAVE_TYPES.map(({ code, label, color }) => (
                      <CButton
                        key={code}
                        color={color}
                        variant={pendingAction === code ? undefined : 'outline'}
                        size="sm"
                        onClick={() => setPendingAction(code)}
                      >
                        {code} — {label}
                      </CButton>
                    ))}
                  </div>

                  <CFormInput
                    size="sm"
                    placeholder="Reason (required)"
                    value={applyReason}
                    onChange={(e) => setApplyReason(e.target.value)}
                    className="mb-2"
                  />

                  {calendarError && (
                    <CAlert color="danger" className="py-1 small mb-2">
                      {calendarError}
                    </CAlert>
                  )}

                  {applyProgress && (
                    <p className="small text-body-secondary mb-2">
                      Applying… {applyProgress.done}/{applyProgress.total}
                    </p>
                  )}

                  <CButton
                    color={pendingAction === 'PRESENT' ? 'success' : 'primary'}
                    size="sm"
                    disabled={!pendingAction || !applyReason.trim() || Boolean(applyProgress)}
                    onClick={handleApply}
                  >
                    {applyProgress ? (
                      <>
                        <CSpinner size="sm" className="me-1" />
                        Applying…
                      </>
                    ) : pendingAction === 'PRESENT' ? (
                      <>
                        <CIcon icon={cilCheckCircle} className="me-1" />
                        Mark as Present
                      </>
                    ) : (
                      'Apply Leave'
                    )}
                  </CButton>
                  <CButton
                    color="secondary"
                    variant="outline"
                    size="sm"
                    className="ms-2"
                    onClick={() => {
                      setSelectedDates(new Set())
                      setPendingAction(null)
                      setApplyReason('')
                      setCalendarError('')
                    }}
                  >
                    Clear
                  </CButton>
                </div>
              )}
            </>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={handleCloseCalendar}>
            Close
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Legacy row-level Correction Modal */}
      <CModal visible={Boolean(selected)} onClose={() => setSelected(null)} backdrop="static">
        <CModalHeader>
          <CModalTitle>
            Correct Attendance — {selected?.employee_id}
            {selected && nameMap[selected.employee_id]
              ? ` (${nameMap[selected.employee_id]})`
              : ''}{' '}
            on {selected?.date}
          </CModalTitle>
        </CModalHeader>
        <CForm onSubmit={handleSaveCorrection}>
          <CModalBody>
            {corrError && <CAlert color="danger">{corrError}</CAlert>}

            {selected && (
              <div className="mb-3 p-2 rounded border small">
                <strong>Current: </strong>
                <CBadge color={STATUS_COLORS[selected.status] || 'secondary'} className="me-2">
                  {selected.status}
                </CBadge>
                {selected.in_time && <span className="me-2">In: {selected.in_time}</span>}
                {selected.out_time && <span>Out: {selected.out_time}</span>}
              </div>
            )}

            <CRow className="g-3">
              <CCol md={12}>
                <CFormLabel className="fw-semibold">
                  New Status <span className="text-danger">*</span>
                </CFormLabel>
                <CFormSelect
                  value={corrForm.new_status}
                  onChange={(e) => setCorrForm((f) => ({ ...f, new_status: e.target.value }))}
                  required
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={6}>
                <CFormLabel>In Time (corrected)</CFormLabel>
                <CFormInput
                  type="time"
                  value={corrForm.new_in_time}
                  onChange={(e) => setCorrForm((f) => ({ ...f, new_in_time: e.target.value }))}
                />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Out Time (corrected)</CFormLabel>
                <CFormInput
                  type="time"
                  value={corrForm.new_out_time}
                  onChange={(e) => setCorrForm((f) => ({ ...f, new_out_time: e.target.value }))}
                />
              </CCol>
              <CCol md={12}>
                <CFormLabel className="fw-semibold">
                  Reason <span className="text-danger">*</span>
                </CFormLabel>
                <CFormInput
                  value={corrForm.reason}
                  onChange={(e) => setCorrForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="Required — describe why this correction is needed"
                  required
                />
              </CCol>
            </CRow>

            {selected?.corrections?.length > 0 && (
              <div className="mt-3">
                <div className="fw-semibold small text-body-secondary mb-1">Correction History</div>
                {selected.corrections.map((c) => (
                  <div key={c.id} className="small border rounded p-2 mb-1">
                    <CBadge color={STATUS_COLORS[c.old_status] || 'secondary'} className="me-1">
                      {c.old_status}
                    </CBadge>
                    →
                    <CBadge color={STATUS_COLORS[c.new_status] || 'secondary'} className="mx-1">
                      {c.new_status}
                    </CBadge>
                    by {c.corrected_by} — {c.reason}
                  </div>
                ))}
              </div>
            )}
          </CModalBody>
          <CModalFooter>
            <CButton
              type="button"
              color="secondary"
              onClick={() => setSelected(null)}
              disabled={saving}
            >
              Cancel
            </CButton>
            <CButton type="submit" color="warning" disabled={saving}>
              {saving && <CSpinner size="sm" className="me-2" />}
              Apply Correction
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>
    </>
  )
}

export default AttendanceCorrections
