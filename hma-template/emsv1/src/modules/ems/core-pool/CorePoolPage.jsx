import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CButton,
  CFormInput,
  CFormSelect,
  CFormLabel,
  CInputGroup,
  CInputGroupText,
  CBadge,
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CAlert,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilPlus,
  cilPencil,
  cilTrash,
  cilPeople,
  cilBriefcase,
  cilSearch,
  cilChevronBottom,
  cilChevronTop,
  cilMoney,
  cilX,
} from '@coreui/icons'
import { localPayroll } from '../../../services/localPayroll'
import { localAttendance } from '../../../services/localAttendance'
import { attendanceRevenue } from '../../../services/attendanceRevenue'
import { computeAttendanceDeduction } from '../../../services/attendanceCalc'

// ── Core Salary Expense store ─────────────────────────────────────────────────
// Tracks which employees' salaries are formally registered as core overhead.

const CORE_SAL_KEY = 'hma_core_salary_expenses'

const uid = () => `cse_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

const coreExpenses = {
  read: () => {
    try {
      return JSON.parse(localStorage.getItem(CORE_SAL_KEY) || '[]')
    } catch {
      return []
    }
  },
  write: (data) => localStorage.setItem(CORE_SAL_KEY, JSON.stringify(data)),
  add(entry) {
    const all = this.read()
    const record = { ...entry, id: uid(), added_at: new Date().toISOString() }
    this.write([...all, record])
    return record
  },
  update(id, patch) {
    this.write(this.read().map((r) => (r.id === id ? { ...r, ...patch } : r)))
  },
  remove(id) {
    this.write(this.read().filter((r) => r.id !== id))
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

const CATEGORY_COLOR = { Permanent: 'primary', FTC: 'warning', TPC: 'info' }

const MONTHS_OPT = [
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
const THIS_YEAR = new Date().getFullYear()
const THIS_MONTH = new Date().getMonth() + 1
const YEARS = [THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1]

// ── Salary saved from employee absence ────────────────────────────────────────
// Reuses the exact Absent/Half-day/excess-Late deduction formula from
// Attendance → Deductions (paid leave — CL/SL/OD/COFF — is still not
// deducted); this just surfaces that money-not-paid total here as savings,
// split by whether the employee is Core (unassigned) or Project-Assigned.

// Project Officers always belong to the Project-Assigned group, even before
// an active project assignment is recorded (former Project Assistants are
// migrated to Project Officer — see applyProjectAssistantMigration).
const isProjectAssigned = (emp) =>
  !emp.isOverhead || /project officer/i.test(emp.employment?.designation || '')

const computeEmployeeDeduction = (emp, summary) => {
  const salary = parseFloat(emp.current_salary || 0)
  const presentCount = summary?.present_count || 0
  const absentCount = summary?.absent_count || 0
  const weeklyOffCount = summary?.weekly_off_count || 0
  const halfDayCount = summary?.half_day_count || 0
  const lateDeductionHours = summary?.late_deduction_hours || 0
  const earlyDeductionHours = summary?.early_deduction_hours || 0
  if (salary <= 0 || !summary) {
    return {
      absentDeduction: 0,
      halfDayDeduction: 0,
      lateDeduction: 0,
      earlyDeduction: 0,
      totalDeduction: 0,
      absentCount,
      halfDayCount,
    }
  }
  const { absentDeduction, halfDayDeduction, lateDeduction, earlyDeduction, totalDeduction } =
    computeAttendanceDeduction({
      salary,
      presentCount,
      absentCount,
      weeklyOffCount,
      halfDayCount,
      lateDeductionHours,
      earlyDeductionHours,
    })
  return {
    absentDeduction,
    halfDayDeduction,
    lateDeduction,
    earlyDeduction,
    totalDeduction,
    absentCount,
    halfDayCount,
  }
}

// ── TPC Attendance Deduction Pool ────────────────────────────────────────────
// Salary withheld from TPC (Third Party) staff for absences becomes company
// revenue, held in this separate pool — Permanent/FTC deductions are not
// pooled (see attendanceRevenue.js).

const TpcAttendancePoolCard = () => {
  const [pool, setPool] = useState({ total: 0, months: [] })
  const [expanded, setExpanded] = useState(false)
  const [latestRows, setLatestRows] = useState([])

  useEffect(() => {
    let cancelled = false
    attendanceRevenue.getTotalPool().then((p) => {
      if (!cancelled) setPool(p)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const latest = useMemo(() => pool.months[pool.months.length - 1] || null, [pool])

  useEffect(() => {
    let cancelled = false
    if (latest) {
      attendanceRevenue.getMonthlyPool(latest.year, latest.month).then(({ rows }) => {
        if (!cancelled) setLatestRows(rows)
      })
    } else {
      Promise.resolve().then(() => {
        if (!cancelled) setLatestRows([])
      })
    }
    return () => {
      cancelled = true
    }
  }, [latest])

  return (
    <CCard className="border-0 shadow-sm mb-4" style={{ borderRadius: 12 }}>
      <CCardHeader className="d-flex align-items-center justify-content-between flex-wrap gap-2 py-3">
        <div>
          <div className="fw-semibold">Attendance Deduction Pool — TPC Staff</div>
          <div className="text-body-secondary small">
            Salary withheld from Third Party (TPC) staff for Absent / Half-day / excess Late is
            retained by the company as revenue and held in this pool.
          </div>
        </div>
        <div className="d-flex gap-2 align-items-center">
          <CBadge color="info" shape="rounded-pill" className="px-3 py-2">
            Pool balance: {fmt(pool.total)}
          </CBadge>
          {pool.months.length > 0 && (
            <CButton
              size="sm"
              color="secondary"
              variant="ghost"
              onClick={() => setExpanded((v) => !v)}
            >
              <CIcon icon={expanded ? cilChevronTop : cilChevronBottom} size="sm" />
            </CButton>
          )}
        </div>
      </CCardHeader>
      {expanded && (
        <CCardBody>
          <CRow className="g-3 mb-3">
            {pool.months.map((m) => (
              <CCol key={`${m.year}-${m.month}`} xs={6} md={3}>
                <div className="border rounded-3 p-3 text-center h-100">
                  <div className="fw-bold" style={{ color: '#06d6a0' }}>
                    {fmt(m.total)}
                  </div>
                  <div className="small text-body-secondary">
                    {MONTHS_OPT.find((o) => o.v === m.month)?.l} {m.year}
                  </div>
                </div>
              </CCol>
            ))}
          </CRow>
          {latest && latestRows.length > 0 && (
            <>
              <div className="fw-semibold small mb-2">
                Latest month — {MONTHS_OPT.find((o) => o.v === latest.month)?.l} {latest.year}
              </div>
              <div className="table-responsive">
                <CTable hover align="middle" small className="mb-0" style={{ fontSize: '0.82rem' }}>
                  <CTableHead className="bg-body-tertiary">
                    <CTableRow>
                      <CTableHeaderCell className="border-0 py-2">Employee</CTableHeaderCell>
                      <CTableHeaderCell className="border-0 py-2 text-center">
                        Absent
                      </CTableHeaderCell>
                      <CTableHeaderCell className="border-0 py-2 text-center">
                        Half-Day
                      </CTableHeaderCell>
                      <CTableHeaderCell className="border-0 py-2 text-center">
                        Late (excess)
                      </CTableHeaderCell>
                      <CTableHeaderCell className="border-0 py-2 text-end">
                        To Pool
                      </CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {latestRows.map((r) => (
                      <CTableRow key={r.employee_id}>
                        <CTableDataCell>
                          <div className="fw-semibold">{r.employee_name}</div>
                          <div className="text-body-secondary" style={{ fontSize: '0.7rem' }}>
                            {r.employee_id}
                          </div>
                        </CTableDataCell>
                        <CTableDataCell className="text-center">
                          {r.absent_count || '—'}
                        </CTableDataCell>
                        <CTableDataCell className="text-center">
                          {r.half_day_count || '—'}
                        </CTableDataCell>
                        <CTableDataCell className="text-center">
                          {r.excess_late_units || '—'}
                        </CTableDataCell>
                        <CTableDataCell
                          className="text-end fw-semibold"
                          style={{ color: '#06d6a0' }}
                        >
                          {fmt(r.totalDeduction)}
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              </div>
            </>
          )}
        </CCardBody>
      )}
    </CCard>
  )
}

const LeaveSavingsSummary = ({ coreEmployees, assignedEmployees }) => {
  const [year, setYear] = useState(THIS_YEAR)
  const [month, setMonth] = useState(THIS_MONTH)
  const [summaries, setSummaries] = useState([])

  useEffect(() => {
    let cancelled = false
    localAttendance.listMonthlySummaries({ year, month }).then((rows) => {
      if (!cancelled) setSummaries(rows)
    })
    return () => {
      cancelled = true
    }
  }, [year, month])

  const summaryByEmpId = useMemo(() => {
    const map = {}
    summaries.forEach((s) => {
      map[s.employee_id] = s
    })
    return map
  }, [summaries])

  const computeGroup = useCallback(
    (employees, groupLabel) => {
      const rows = employees
        .map((emp) => ({
          emp,
          groupLabel,
          ...computeEmployeeDeduction(emp, summaryByEmpId[emp.employee_id]),
        }))
        .filter((r) => r.totalDeduction > 0)
        .sort((a, b) => b.totalDeduction - a.totalDeduction)
      const total = rows.reduce((s, r) => s + r.totalDeduction, 0)
      return { rows, total }
    },
    [summaryByEmpId],
  )

  const core = useMemo(() => computeGroup(coreEmployees, 'Core'), [computeGroup, coreEmployees])
  const assigned = useMemo(
    () => computeGroup(assignedEmployees, 'Project-Assigned'),
    [computeGroup, assignedEmployees],
  )
  const allRows = useMemo(
    () => [...core.rows, ...assigned.rows].sort((a, b) => b.totalDeduction - a.totalDeduction),
    [core.rows, assigned.rows],
  )

  return (
    <CCard className="border-0 shadow-sm mb-4" style={{ borderRadius: 12 }}>
      <CCardHeader className="d-flex align-items-center justify-content-between flex-wrap gap-2 py-3">
        <div>
          <div className="fw-semibold">Salary Saved from Employee Absence</div>
          <div className="text-body-secondary small">
            Money not paid due to Absent days, Half-days and excess Late arrivals — paid leave
            (CL/SL/OD/COFF) isn't deducted, same as Attendance → Deductions.
          </div>
        </div>
        <div className="d-flex gap-2">
          <CFormSelect
            size="sm"
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            style={{ width: 130 }}
          >
            {MONTHS_OPT.map((m) => (
              <option key={m.v} value={m.v}>
                {m.l}
              </option>
            ))}
          </CFormSelect>
          <CFormSelect
            size="sm"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            style={{ width: 90 }}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </CFormSelect>
        </div>
      </CCardHeader>
      <CCardBody>
        <CRow className="g-3 mb-3">
          <CCol xs={12} md={6}>
            <div className="border rounded-3 p-3 text-center h-100">
              <div className="fw-bold fs-5" style={{ color: '#06d6a0' }}>
                {fmt(core.total)}
              </div>
              <div className="small text-body-secondary">
                Saved — Core Employees ({core.rows.length} affected)
              </div>
            </div>
          </CCol>
          <CCol xs={12} md={6}>
            <div className="border rounded-3 p-3 text-center h-100">
              <div className="fw-bold fs-5" style={{ color: '#4361ee' }}>
                {fmt(assigned.total)}
              </div>
              <div className="small text-body-secondary">
                Saved — Project-Assigned Employees ({assigned.rows.length} affected)
              </div>
            </div>
          </CCol>
        </CRow>

        {allRows.length === 0 ? (
          <div className="text-body-secondary small text-center py-3">
            No absence-related deductions for {MONTHS_OPT.find((m) => m.v === month)?.l} {year}.
          </div>
        ) : (
          <div className="table-responsive">
            <CTable hover align="middle" small className="mb-0" style={{ fontSize: '0.82rem' }}>
              <CTableHead className="bg-body-tertiary">
                <CTableRow>
                  <CTableHeaderCell className="border-0 py-2">Employee</CTableHeaderCell>
                  <CTableHeaderCell className="border-0 py-2">Group</CTableHeaderCell>
                  <CTableHeaderCell className="border-0 py-2 text-center">Absent</CTableHeaderCell>
                  <CTableHeaderCell className="border-0 py-2 text-center">
                    Half-Day
                  </CTableHeaderCell>
                  <CTableHeaderCell className="border-0 py-2 text-center">
                    Late/Early Out
                  </CTableHeaderCell>
                  <CTableHeaderCell className="border-0 py-2 text-end">Saved</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {allRows.map((r) => (
                  <CTableRow key={r.emp.id}>
                    <CTableDataCell>
                      <div className="fw-semibold">{r.emp.employee_name}</div>
                      <div className="text-body-secondary" style={{ fontSize: '0.7rem' }}>
                        {r.emp.employee_id}
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge
                        color={r.groupLabel === 'Core' ? 'warning' : 'success'}
                        shape="rounded-pill"
                      >
                        {r.groupLabel}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell className="text-center">{r.absentCount || '—'}</CTableDataCell>
                    <CTableDataCell className="text-center">{r.halfDayCount || '—'}</CTableDataCell>
                    <CTableDataCell className="text-center">
                      {r.lateDeduction || r.earlyDeduction
                        ? fmt((r.lateDeduction || 0) + (r.earlyDeduction || 0))
                        : '—'}
                    </CTableDataCell>
                    <CTableDataCell className="text-end fw-semibold" style={{ color: '#06d6a0' }}>
                      {fmt(r.totalDeduction)}
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

// ── Employee detail expand row ────────────────────────────────────────────────

const EmployeeDetailPanel = ({ emp }) => {
  const activeAssignments = emp.activeProjectNames || []

  return (
    <div className="px-4 py-3 bg-body-secondary border-top">
      <CRow className="g-3">
        {/* Personal / Employment details */}
        <CCol xs={12} md={6} lg={4}>
          <div
            className="small fw-semibold text-body-secondary text-uppercase mb-2"
            style={{ letterSpacing: '0.5px' }}
          >
            Employment Details
          </div>
          <div className="d-flex flex-column gap-1" style={{ fontSize: '0.82rem' }}>
            {[
              ['Employee ID', emp.employee_id],
              ['Designation', emp.employment?.designation],
              ['Department', emp.employment?.department],
              ['Category', emp.employee_category],
              ['Joined', fmtDate(emp.joined_date)],
              ['Working State', emp.employment?.working_state],
              ['Reporting To', emp.employment?.reporting_to],
            ].map(([label, value]) => (
              <div key={label} className="d-flex gap-2">
                <span className="text-body-secondary flex-shrink-0" style={{ minWidth: 110 }}>
                  {label}
                </span>
                <span className="fw-medium text-truncate">{value || '—'}</span>
              </div>
            ))}
          </div>
        </CCol>

        {/* Salary & Contact */}
        <CCol xs={12} md={6} lg={4}>
          <div
            className="small fw-semibold text-body-secondary text-uppercase mb-2"
            style={{ letterSpacing: '0.5px' }}
          >
            Salary & Contact
          </div>
          <div className="d-flex flex-column gap-1" style={{ fontSize: '0.82rem' }}>
            {[
              ['Monthly Salary', emp.current_salary ? fmt(emp.current_salary) : '—'],
              ['Mobile', emp.contact?.mobile],
              ['Work Email', emp.contact?.working_email],
              ['Personal Email', emp.contact?.personal_email],
              ['Location', emp.address?.resident_location],
            ].map(([label, value]) => (
              <div key={label} className="d-flex gap-2">
                <span className="text-body-secondary flex-shrink-0" style={{ minWidth: 110 }}>
                  {label}
                </span>
                <span className="fw-medium text-truncate">{value || '—'}</span>
              </div>
            ))}
          </div>
        </CCol>

        {/* Project assignments */}
        <CCol xs={12} lg={4}>
          <div
            className="small fw-semibold text-body-secondary text-uppercase mb-2"
            style={{ letterSpacing: '0.5px' }}
          >
            Project Assignments
          </div>
          {activeAssignments.length === 0 ? (
            <div className="text-body-secondary small">No project assignments on record.</div>
          ) : (
            <div className="d-flex flex-column gap-1">
              {activeAssignments.map((name, i) => (
                <div
                  key={i}
                  className="d-flex align-items-center gap-2 rounded-2 px-2 py-1 bg-success-subtle border border-success-subtle"
                  style={{ fontSize: '0.8rem' }}
                >
                  <CBadge color="success" shape="rounded-pill" style={{ fontSize: '0.6rem' }}>
                    Active
                  </CBadge>
                  <span className="fw-semibold text-truncate flex-grow-1">{name || 'Unnamed'}</span>
                </div>
              ))}
            </div>
          )}
        </CCol>
      </CRow>
    </div>
  )
}

// ── Expandable employee row ───────────────────────────────────────────────────

const EmployeeRow = ({ emp, index, showProjects }) => {
  const [open, setOpen] = useState(false)
  const activeCount = emp.activeProjectCount || 0

  return (
    <>
      <CTableRow
        style={{ cursor: 'pointer' }}
        className={open ? 'table-active' : ''}
        onClick={() => setOpen((o) => !o)}
      >
        <CTableDataCell className="ps-3 text-body-secondary small">{index + 1}</CTableDataCell>
        <CTableDataCell>
          <div className="fw-semibold">{emp.employee_name}</div>
          <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
            {emp.employee_id}
          </div>
        </CTableDataCell>
        <CTableDataCell className="small">{emp.employment?.designation || '—'}</CTableDataCell>
        <CTableDataCell className="small">{emp.employment?.department || '—'}</CTableDataCell>
        <CTableDataCell>
          <CBadge color={CATEGORY_COLOR[emp.employee_category] || 'secondary'} shape="rounded-pill">
            {emp.employee_category || '—'}
          </CBadge>
        </CTableDataCell>
        <CTableDataCell className="fw-semibold" style={{ color: '#4361ee' }}>
          {emp.current_salary ? (
            fmt(emp.current_salary)
          ) : (
            <span className="text-body-secondary small">Not set</span>
          )}
        </CTableDataCell>
        {showProjects && (
          <CTableDataCell>
            <CBadge color={activeCount > 0 ? 'success' : 'secondary'} shape="rounded-pill">
              {activeCount} active
            </CBadge>
          </CTableDataCell>
        )}
        <CTableDataCell className="text-end pe-3">
          <CIcon
            icon={open ? cilChevronTop : cilChevronBottom}
            style={{ width: 14, height: 14, color: 'var(--cui-body-secondary-color)' }}
          />
        </CTableDataCell>
      </CTableRow>

      {open && (
        <CTableRow>
          <CTableDataCell colSpan={showProjects ? 8 : 7} className="p-0 border-0">
            <EmployeeDetailPanel emp={emp} />
          </CTableDataCell>
        </CTableRow>
      )}
    </>
  )
}

// ── Employee table ────────────────────────────────────────────────────────────

const EmployeeTable = ({ employees, showProjects, emptyIcon, emptyText }) => {
  if (employees.length === 0) {
    return (
      <div className="text-center text-body-secondary py-5">
        <CIcon
          icon={emptyIcon}
          style={{ width: 40, height: 40, opacity: 0.3 }}
          className="mb-2 d-block mx-auto"
        />
        <div className="small">{emptyText}</div>
      </div>
    )
  }

  return (
    <div className="table-responsive">
      <CTable hover align="middle" className="mb-0" style={{ fontSize: '0.875rem' }}>
        <CTableHead className="bg-body-tertiary">
          <CTableRow>
            <CTableHeaderCell className="border-0 py-2 ps-3">#</CTableHeaderCell>
            <CTableHeaderCell className="border-0 py-2">Employee</CTableHeaderCell>
            <CTableHeaderCell className="border-0 py-2">Designation</CTableHeaderCell>
            <CTableHeaderCell className="border-0 py-2">Department</CTableHeaderCell>
            <CTableHeaderCell className="border-0 py-2">Category</CTableHeaderCell>
            <CTableHeaderCell className="border-0 py-2">Monthly Salary</CTableHeaderCell>
            {showProjects && (
              <CTableHeaderCell className="border-0 py-2">Projects</CTableHeaderCell>
            )}
            <CTableHeaderCell className="border-0 py-2" />
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {employees.map((emp, i) => (
            <EmployeeRow key={emp.id} emp={emp} index={i} showProjects={showProjects} />
          ))}
        </CTableBody>
      </CTable>
    </div>
  )
}

// ── Add Core Expense Modal ────────────────────────────────────────────────────

const AddExpenseModal = ({ visible, onClose, onAdd, allEmployees, existingIds }) => {
  const [selectedId, setSelectedId] = useState('')
  const [salary, setSalary] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const available = allEmployees.filter((e) => !existingIds.includes(e.id))
  const selected = allEmployees.find((e) => e.id === selectedId)

  const handleSelect = (id) => {
    setSelectedId(id)
    setError('')
    const emp = allEmployees.find((e) => e.id === id)
    setSalary(emp?.current_salary ? String(emp.current_salary) : '')
  }

  const handleAdd = () => {
    if (!selectedId) {
      setError('Please select an employee.')
      return
    }
    if (!salary || parseFloat(salary) <= 0) {
      setError('Please enter a valid salary amount.')
      return
    }
    onAdd({
      employee_id: selected.id,
      employee_code: selected.employee_id,
      employee_name: selected.employee_name,
      designation: selected.employment?.designation || '',
      department: selected.employment?.department || '',
      category: selected.employee_category || '',
      salary: parseFloat(salary),
      notes,
    })
    setSelectedId('')
    setSalary('')
    setNotes('')
    setError('')
    onClose()
  }

  const handleClose = () => {
    setSelectedId('')
    setSalary('')
    setNotes('')
    setError('')
    onClose()
  }

  return (
    <CModal visible={visible} onClose={handleClose} alignment="center">
      <CModalHeader closeButton>
        <CModalTitle>Add Employee to Core Expenses</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <p className="text-body-secondary small mb-3">
          Select an employee whose salary will be tracked as a core overhead expense.
        </p>

        {error && (
          <CAlert color="danger" className="py-2 small">
            {error}
          </CAlert>
        )}

        <div className="mb-3">
          <CFormLabel className="small fw-semibold">Employee</CFormLabel>
          <CFormSelect value={selectedId} onChange={(e) => handleSelect(e.target.value)}>
            <option value="">— Select employee —</option>
            {available.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.employee_name} ({emp.employee_id})
                {emp.employment?.designation ? ` · ${emp.employment.designation}` : ''}
              </option>
            ))}
          </CFormSelect>
          {available.length === 0 && (
            <div className="small text-body-secondary mt-1">All employees are already added.</div>
          )}
        </div>

        {selected && (
          <div
            className="rounded-3 px-3 py-2 bg-body-secondary mb-3"
            style={{ fontSize: '0.82rem' }}
          >
            <div className="d-flex gap-4 flex-wrap">
              <div>
                <span className="text-body-secondary">Dept: </span>
                <span className="fw-medium">{selected.employment?.department || '—'}</span>
              </div>
              <div>
                <span className="text-body-secondary">Category: </span>
                <CBadge
                  color={CATEGORY_COLOR[selected.employee_category] || 'secondary'}
                  shape="rounded-pill"
                  style={{ fontSize: '0.65rem' }}
                >
                  {selected.employee_category || '—'}
                </CBadge>
              </div>
              <div>
                <span className="text-body-secondary">On projects: </span>
                <span className="fw-medium">{selected.activeProjectCount || 0}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mb-3">
          <CFormLabel className="small fw-semibold">Monthly Salary (₹)</CFormLabel>
          <CInputGroup>
            <CInputGroupText>₹</CInputGroupText>
            <CFormInput
              type="number"
              min="0"
              placeholder="Enter monthly salary"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
            />
          </CInputGroup>
          {selected?.current_salary === 0 && (
            <div className="small text-warning mt-1">
              No salary on record — please enter the amount manually.
            </div>
          )}
        </div>

        <div className="mb-1">
          <CFormLabel className="small fw-semibold">
            Notes <span className="fw-normal text-body-secondary">(optional)</span>
          </CFormLabel>
          <CFormInput
            placeholder="e.g. FY 2026–27 overhead"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="ghost" onClick={handleClose}>
          Cancel
        </CButton>
        <CButton color="primary" onClick={handleAdd} disabled={available.length === 0}>
          <CIcon icon={cilPlus} className="me-1" />
          Add to Core Expenses
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

// ── Edit salary modal ─────────────────────────────────────────────────────────

const EditExpenseModal = ({ visible, entry, onClose, onSave }) => {
  const [salary, setSalary] = useState(entry?.salary || '')
  const [notes, setNotes] = useState(entry?.notes || '')

  useEffect(() => {
    let cancelled = false
    if (entry) {
      Promise.resolve().then(() => {
        if (cancelled) return
        setSalary(String(entry.salary || ''))
        setNotes(entry.notes || '')
      })
    }
    return () => {
      cancelled = true
    }
  }, [entry])

  const handleSave = () => {
    onSave({ salary: parseFloat(salary) || 0, notes })
    onClose()
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment="center" size="sm">
      <CModalHeader closeButton>
        <CModalTitle>Edit Core Expense</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div className="fw-semibold mb-3">{entry?.employee_name}</div>
        <div className="mb-3">
          <CFormLabel className="small fw-semibold">Monthly Salary (₹)</CFormLabel>
          <CInputGroup>
            <CInputGroupText>₹</CInputGroupText>
            <CFormInput
              type="number"
              min="0"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
            />
          </CInputGroup>
        </div>
        <div>
          <CFormLabel className="small fw-semibold">Notes</CFormLabel>
          <CFormInput
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes"
          />
        </div>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="ghost" onClick={onClose}>
          Cancel
        </CButton>
        <CButton color="primary" onClick={handleSave}>
          Save
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

// ── Core Expenses Tab ─────────────────────────────────────────────────────────

const CoreExpensesTab = ({ allEmployees }) => {
  const [entries, setEntries] = useState([])
  const [addOpen, setAddOpen] = useState(false)
  const [editEntry, setEditEntry] = useState(null)

  const reload = useCallback(async () => setEntries(coreExpenses.read()), [])
  useEffect(() => {
    let cancelled = false
    Promise.resolve()
      .then(() => coreExpenses.read())
      .then((rows) => {
        if (!cancelled) setEntries(rows)
      })
    return () => {
      cancelled = true
    }
  }, [reload])

  const handleAdd = (entry) => {
    coreExpenses.add(entry)
    reload()
  }
  const handleRemove = (id) => {
    coreExpenses.remove(id)
    reload()
  }
  const handleEditSave = (id, patch) => {
    coreExpenses.update(id, patch)
    reload()
  }

  const existingIds = entries.map((e) => e.employee_id)
  const totalMonthly = entries.reduce((s, e) => s + (e.salary || 0), 0)

  const coreEmployees = allEmployees.filter((e) => !isProjectAssigned(e))
  const assignedEmployees = allEmployees.filter(isProjectAssigned)

  return (
    <>
      <TpcAttendancePoolCard />
      <LeaveSavingsSummary coreEmployees={coreEmployees} assignedEmployees={assignedEmployees} />

      {/* Summary */}
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div>
          <div className="fw-semibold">Core Salary Expenses</div>
          <div className="text-body-secondary small">
            Salaries of employees not assigned to any project — registered as organizational
            overhead.
          </div>
        </div>
        <div className="d-flex gap-2 align-items-center">
          {totalMonthly > 0 && (
            <CBadge color="primary" shape="rounded-pill" className="px-3 py-2">
              Total: {fmt(totalMonthly)} / mo
            </CBadge>
          )}
          <CButton size="sm" color="primary" onClick={() => setAddOpen(true)}>
            <CIcon icon={cilPlus} className="me-1" />
            Add Employee
          </CButton>
        </div>
      </div>

      {/* Entries list */}
      {entries.length === 0 ? (
        <div className="text-center py-5 text-body-secondary border rounded-3 bg-body-secondary">
          <CIcon
            icon={cilMoney}
            style={{ width: 40, height: 40, opacity: 0.3 }}
            className="mb-2 d-block mx-auto"
          />
          <div className="small">No core salary expenses registered yet.</div>
          <div className="small mt-1">
            Click <strong>Add Employee</strong> to register an employee's salary as a core overhead
            expense.
          </div>
        </div>
      ) : (
        <div className="table-responsive">
          <CTable hover align="middle" className="mb-0" style={{ fontSize: '0.875rem' }}>
            <CTableHead className="bg-body-tertiary">
              <CTableRow>
                <CTableHeaderCell className="border-0 py-2 ps-3">#</CTableHeaderCell>
                <CTableHeaderCell className="border-0 py-2">Employee</CTableHeaderCell>
                <CTableHeaderCell className="border-0 py-2">Designation</CTableHeaderCell>
                <CTableHeaderCell className="border-0 py-2">Department</CTableHeaderCell>
                <CTableHeaderCell className="border-0 py-2">Category</CTableHeaderCell>
                <CTableHeaderCell className="border-0 py-2">Monthly Salary</CTableHeaderCell>
                <CTableHeaderCell className="border-0 py-2">Notes</CTableHeaderCell>
                <CTableHeaderCell className="border-0 py-2">Added</CTableHeaderCell>
                <CTableHeaderCell className="border-0 py-2" />
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {entries.map((entry, i) => (
                <CTableRow key={entry.id}>
                  <CTableDataCell className="ps-3 text-body-secondary small">
                    {i + 1}
                  </CTableDataCell>
                  <CTableDataCell>
                    <div className="fw-semibold">{entry.employee_name}</div>
                    <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                      {entry.employee_code}
                    </div>
                  </CTableDataCell>
                  <CTableDataCell className="small">{entry.designation || '—'}</CTableDataCell>
                  <CTableDataCell className="small">{entry.department || '—'}</CTableDataCell>
                  <CTableDataCell>
                    <CBadge
                      color={CATEGORY_COLOR[entry.category] || 'secondary'}
                      shape="rounded-pill"
                    >
                      {entry.category || '—'}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell className="fw-bold" style={{ color: '#4361ee' }}>
                    {fmt(entry.salary)}
                  </CTableDataCell>
                  <CTableDataCell
                    className="small text-body-secondary text-truncate"
                    style={{ maxWidth: 150 }}
                  >
                    {entry.notes || '—'}
                  </CTableDataCell>
                  <CTableDataCell className="small text-body-secondary">
                    {fmtDate(entry.added_at)}
                  </CTableDataCell>
                  <CTableDataCell className="text-end pe-3">
                    <CButton
                      color="secondary"
                      variant="ghost"
                      size="sm"
                      className="me-1"
                      title="Edit"
                      onClick={() => setEditEntry(entry)}
                    >
                      <CIcon icon={cilPencil} />
                    </CButton>
                    <CButton
                      color="danger"
                      variant="ghost"
                      size="sm"
                      title="Remove"
                      onClick={() => handleRemove(entry.id)}
                    >
                      <CIcon icon={cilTrash} />
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        </div>
      )}

      <AddExpenseModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={handleAdd}
        allEmployees={allEmployees}
        existingIds={existingIds}
      />

      <EditExpenseModal
        visible={!!editEntry}
        entry={editEntry}
        onClose={() => setEditEntry(null)}
        onSave={(patch) => {
          handleEditSave(editEntry.id, patch)
          setEditEntry(null)
        }}
      />
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const CorePoolPage = () => {
  const [activeTab, setActiveTab] = useState('employees')
  const [search, setSearch] = useState('')
  const [allEmployees, setAllEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    localPayroll
      .getAllEmployeesWithProjectInfo()
      .then((employees) => {
        if (!cancelled) setAllEmployees(employees)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || 'Failed to load employees')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const active = allEmployees.filter((e) => e.status !== 'Deleted' && e.status !== 'Inactive')

  const filtered = search.trim()
    ? active.filter((e) => {
        const q = search.toLowerCase()
        return (
          e.employee_name?.toLowerCase().includes(q) ||
          e.employee_id?.toLowerCase().includes(q) ||
          e.employment?.designation?.toLowerCase().includes(q) ||
          e.employment?.department?.toLowerCase().includes(q)
        )
      })
    : active

  const unassigned = filtered.filter((e) => !isProjectAssigned(e))
  const assigned = filtered.filter(isProjectAssigned)

  const totalUnassignedSalary = unassigned.reduce(
    (s, e) => s + (parseFloat(e.current_salary) || 0),
    0,
  )
  const totalAssignedSalary = assigned.reduce((s, e) => s + (parseFloat(e.current_salary) || 0), 0)

  if (loading || loadError) {
    return (
      <>
        <div className="mb-4">
          <h4 className="fw-bold mb-1">Global Core Pool</h4>
          <p className="text-body-secondary mb-0 small">
            Track core employee assignments and register unassigned employee salaries as overhead
            expenses.
          </p>
        </div>
        {loadError ? (
          <CAlert color="danger" className="mb-0">
            Couldn't load employee data — {loadError}
          </CAlert>
        ) : (
          <div className="text-center py-5">
            <CSpinner />
          </div>
        )}
      </>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="mb-4">
        <h4 className="fw-bold mb-1">Global Core Pool</h4>
        <p className="text-body-secondary mb-0 small">
          Track core employee assignments and register unassigned employee salaries as overhead
          expenses.
        </p>
      </div>

      {/* Summary stats */}
      <CRow className="g-3 mb-4">
        {[
          { label: 'Total Employees', value: active.length, color: '#4361ee' },
          {
            label: 'Unassigned (Overhead)',
            value: unassigned.length,
            color: '#f0ad4e',
            sub: totalUnassignedSalary > 0 ? fmt(totalUnassignedSalary) + '/mo' : null,
          },
          {
            label: 'On Projects',
            value: assigned.length,
            color: '#06d6a0',
            sub: totalAssignedSalary > 0 ? fmt(totalAssignedSalary) + '/mo' : null,
          },
          {
            label: 'Total Payroll',
            value: fmt(totalUnassignedSalary + totalAssignedSalary),
            color: '#9b5de5',
          },
        ].map((stat) => (
          <CCol key={stat.label} xs={6} md={3}>
            <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
              <CCardBody className="py-3 px-3">
                <div className="fw-bold fs-5 lh-1 mb-1" style={{ color: stat.color }}>
                  {stat.value}
                </div>
                <div className="small text-body-secondary">{stat.label}</div>
                {stat.sub && (
                  <div className="text-body-secondary mt-1" style={{ fontSize: '0.72rem' }}>
                    {stat.sub}
                  </div>
                )}
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>

      {/* Tabs */}
      <CNav variant="tabs" className="mb-0">
        <CNavItem>
          <CNavLink
            active={activeTab === 'employees'}
            style={{ cursor: 'pointer' }}
            onClick={() => setActiveTab('employees')}
          >
            <CIcon icon={cilPeople} className="me-1" size="sm" />
            Employees
            <CBadge color="primary" shape="rounded-pill" className="ms-2">
              {active.length}
            </CBadge>
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink
            active={activeTab === 'expenses'}
            style={{ cursor: 'pointer' }}
            onClick={() => setActiveTab('expenses')}
          >
            <CIcon icon={cilMoney} className="me-1" size="sm" />
            Core Expenses
          </CNavLink>
        </CNavItem>
      </CNav>

      <CTabContent className="border border-top-0 rounded-bottom bg-body mb-4">
        {/* ── Employees tab ── */}
        <CTabPane visible={activeTab === 'employees'} className="p-3">
          <CInputGroup size="sm" className="mb-4" style={{ maxWidth: 380 }}>
            <CInputGroupText>
              <CIcon icon={cilSearch} size="sm" />
            </CInputGroupText>
            <CFormInput
              placeholder="Search name, ID, designation, department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <CButton color="secondary" variant="ghost" size="sm" onClick={() => setSearch('')}>
                <CIcon icon={cilX} size="sm" />
              </CButton>
            )}
          </CInputGroup>

          {/* Unassigned */}
          <CCard className="border-0 shadow-sm mb-4" style={{ borderRadius: 12 }}>
            <CCardHeader className="bg-transparent border-bottom d-flex align-items-center justify-content-between py-3">
              <div>
                <span className="fw-semibold">Unassigned Employees</span>
                <span className="text-body-secondary small ms-2">
                  — not currently on any project
                </span>
              </div>
              <div className="d-flex gap-2 align-items-center flex-wrap">
                <CBadge color="warning" shape="rounded-pill">
                  {unassigned.length} employees
                </CBadge>
                {totalUnassignedSalary > 0 && (
                  <CBadge color="secondary" shape="rounded-pill">
                    {fmt(totalUnassignedSalary)} / mo
                  </CBadge>
                )}
              </div>
            </CCardHeader>
            <CCardBody className="p-0">
              <EmployeeTable
                employees={unassigned}
                showProjects={false}
                emptyIcon={cilPeople}
                emptyText={
                  search
                    ? 'No unassigned employees match your search.'
                    : 'All employees are currently assigned to projects.'
                }
              />
            </CCardBody>
          </CCard>

          {/* Assigned */}
          <CCard className="border-0 shadow-sm" style={{ borderRadius: 12 }}>
            <CCardHeader className="bg-transparent border-bottom d-flex align-items-center justify-content-between py-3">
              <div>
                <span className="fw-semibold">Project-Assigned Employees</span>
                <span className="text-body-secondary small ms-2">
                  — click a row to expand details
                </span>
              </div>
              <div className="d-flex gap-2 align-items-center flex-wrap">
                <CBadge color="success" shape="rounded-pill">
                  {assigned.length} employees
                </CBadge>
                {totalAssignedSalary > 0 && (
                  <CBadge color="secondary" shape="rounded-pill">
                    {fmt(totalAssignedSalary)} / mo
                  </CBadge>
                )}
              </div>
            </CCardHeader>
            <CCardBody className="p-0">
              <EmployeeTable
                employees={assigned}
                showProjects={true}
                emptyIcon={cilBriefcase}
                emptyText={
                  search
                    ? 'No assigned employees match your search.'
                    : 'No employees are currently assigned to any project.'
                }
              />
            </CCardBody>
          </CCard>
        </CTabPane>

        {/* ── Core Expenses tab ── */}
        <CTabPane visible={activeTab === 'expenses'} className="p-3">
          <CoreExpensesTab allEmployees={active} />
        </CTabPane>
      </CTabContent>
    </>
  )
}

export default CorePoolPage
