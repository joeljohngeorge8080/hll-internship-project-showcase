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
  CFormInput,
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
import CIcon from '@coreui/icons-react'
import {
  cilArrowLeft,
  cilCheckCircle,
  cilCloudUpload,
  cilSearch,
  cilWarning,
  cilX,
} from '@coreui/icons'
import { useSelector } from 'react-redux'

import { usePermission } from '../../../hooks/usePermission'
import { MODULE } from '../../../constants/modules'
import { parseAttendanceExcel } from '../../../services/attendanceParser'
import { localAttendance } from '../../../services/localAttendance'
import { localEmployees } from '../../../services/localEmployees'
import { uploadAttendanceFile } from '../../../services/attendanceFileUpload'
import api from '../../../services/api'
import {
  FREE_LATE_UNITS,
  FREE_EARLY_OUT_MINUTES,
  HALF_DAY_DEDUCTION_HOURS,
  CL_MONTHLY_LIMIT,
} from '../../../constants/attendancePolicy'
import {
  classifyLateEntry,
  classifyEarlyOut,
  computeAttendanceDeduction,
  computeLateMinutes,
  computeEarlyMinutes,
  computeMonthlyDeductionDetails,
} from '../../../services/attendanceCalc'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toMin = (hhmm) => {
  if (!hhmm) return 0
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

const fmtHHMM = (totalMin) => {
  if (!totalMin) return '—'
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Generate plain-language remarks explaining each deduction trigger.
// Salary figures are symbolic (× DS / × HS) since actual salary is in Payroll module.
const generateRemarks = (e) => {
  const remarks = []

  // ── Absent deduction ──────────────────────────────────────────────────────
  // Leave excess: on_leave > monthly limit → excess treated as Absent
  const leaveExcess = Math.max(0, e.on_leave - CL_MONTHLY_LIMIT)
  const effectiveAbsent = e.absent + leaveExcess

  if (e.on_leave > CL_MONTHLY_LIMIT) {
    remarks.push({
      type: 'leave',
      icon: '📋',
      label: 'Leave Exceeded',
      text:
        `Leave used: ${e.on_leave} day${e.on_leave > 1 ? 's' : ''} (monthly limit: ${CL_MONTHLY_LIMIT}). ` +
        `${leaveExcess} excess day${leaveExcess > 1 ? 's' : ''} treated as Absent.`,
    })
  }

  if (effectiveAbsent > 0) {
    remarks.push({
      type: 'absent',
      icon: '🔴',
      label: 'Absent Deduction',
      text:
        `${effectiveAbsent} absent day${effectiveAbsent > 1 ? 's' : ''}` +
        (leaveExcess > 0 ? ` (${e.absent} actual + ${leaveExcess} from excess leave)` : '') +
        ` → Deduction = ${effectiveAbsent} × Daily Salary (DS)`,
    })
  }

  // ── Half Day deduction (Priority Rule) ────────────────────────────────────
  // Pace-marked Half Days + HMA rule violations (>120 min late or >120 min
  // early punch-out while Pace still marked Present)
  const totalHalfDays = e.half_day + e.hd_violations.length

  if (totalHalfDays > 0) {
    const parts = []
    if (e.half_day > 0) parts.push(`${e.half_day} marked by Pace`)
    if (e.hd_violations.length > 0) {
      const dates = e.hd_violations.map((v) => `${v.date} (${v.reason})`).join(', ')
      parts.push(
        `${e.hd_violations.length} HMA rule violation${e.hd_violations.length > 1 ? 's' : ''}: ${dates}`,
      )
    }
    remarks.push({
      type: 'halfday',
      icon: '🟠',
      label: 'Half Day Deduction',
      text:
        `${totalHalfDays} Half Day${totalHalfDays > 1 ? 's' : ''} (${parts.join(' + ')}). ` +
        `Rule: >120 min late or >120 min early out → 4-hr deduction (priority over bracket rates). ` +
        `Deduction = ${totalHalfDays} × ${HALF_DAY_DEDUCTION_HOURS} × Hourly Salary (HS)`,
    })
  }

  // ── Late entry deduction (bracket rate for days after the 7 free units) ──
  if (e.late_deduction_hours > 0) {
    remarks.push({
      type: 'late',
      icon: '🟡',
      label: 'Late Entry Deduction',
      text:
        `Late units used this month: ${e.late_units_used} (7 free). ` +
        `Bracket deduction for days beyond the free allowance: ${e.late_deduction_hours.toFixed(2)} hrs. ` +
        `Deduction = ${e.late_deduction_hours.toFixed(2)} × HS`,
    })
  } else if (e.late_units_used > 0) {
    remarks.push({
      type: 'late_ok',
      icon: '🟢',
      label: 'Late Entry — Within Limit',
      text: `Late units used: ${e.late_units_used} / 7 free. ` + `No deduction.`,
    })
  }

  // ── Early punch-out deduction (bracket rate for days after the free hour) ──
  if (e.early_deduction_hours > 0) {
    remarks.push({
      type: 'early',
      icon: '🟡',
      label: 'Early Punch-Out Deduction',
      text:
        `Early-out minutes used this month: ${e.early_minutes_used} (60 free). ` +
        `Bracket deduction for days beyond the free hour: ${e.early_deduction_hours.toFixed(2)} hrs. ` +
        `Deduction = ${e.early_deduction_hours.toFixed(2)} × HS`,
    })
  } else if (e.early_minutes_used > 0) {
    remarks.push({
      type: 'early_ok',
      icon: '🟢',
      label: 'Early Punch-Out — Within Limit',
      text:
        `Early-out minutes used: ${e.early_minutes_used} / ${FREE_EARLY_OUT_MINUTES} free. ` +
        `No deduction.`,
    })
  }

  if (remarks.filter((r) => ['absent', 'halfday', 'late', 'early'].includes(r.type)).length === 0) {
    remarks.push({
      type: 'clean',
      icon: '✅',
      label: 'No Deductions',
      text: 'Full salary. No absent days, no excess late/early minutes, no half-day triggers.',
    })
  }

  return remarks
}

// ─── Core summary builder ────────────────────────────────────────────────────
// Mirrors localAttendance.js's buildSummary + computeMonthlyDeductionDetails
// exactly, so this preview always agrees with what actually gets persisted
// on Confirm & Import.
const buildEmployeeSummaries = (rows) => {
  const map = {}

  for (const r of rows) {
    if (!map[r.employee_id]) {
      map[r.employee_id] = {
        employee_id: r.employee_id,
        employee_name: r.employee_name,
        present: 0,
        absent: 0,
        half_day: 0,
        weekly_off: 0,
        // Days coded WOP/WO½P by Pace — a scheduled weekly-off the employee
        // still worked (full or half day). Kept separate from `weekly_off`
        // so present/half_day day counts stay correct for payroll, and
        // displayed separately (P, A, WO, WOP) rather than combined.
        weekly_off_worked: 0,
        holiday: 0,
        on_leave: 0,
        late_days: 0, // informational: days with any late minutes
        late_minutes_total: 0,
        early_days: 0, // informational: days with any early-out minutes
        early_minutes_total: 0,
        hd_violations: [], // >120 min late or early while Pace marked Present → HD rule
        total_work_minutes: 0,
        work_days_with_duration: 0,
        _records: [], // fed to computeMonthlyDeductionDetails below
      }
    }

    const e = map[r.employee_id]

    switch (r.status) {
      case 'Present':
        e.present++
        break
      case 'Absent':
        e.absent++
        break
      case 'Half Day':
        e.half_day++
        break
      case 'Weekly Off':
        e.weekly_off++
        break
      case 'Holiday':
        e.holiday++
        break
      case 'On Leave':
        e.on_leave++
        break
    }

    // WOP/WO½P: Pace marked this a scheduled weekly-off day, but status
    // ended up Present/Half Day because they worked it. Reported as its own
    // separate figure (not folded into `weekly_off`) so P/A/WO/WOP can each
    // be shown distinctly, without touching the present/half_day tallies
    // above, which must stay correct for payroll.
    if (r.is_weekly_off_type && r.status !== 'Weekly Off') {
      e.weekly_off_worked++
    }

    // Lateness/earliness are derived from in_time/out_time vs. the official
    // shift window, not trusted from Pace's own "Late By"/"Early By" export
    // columns — those have been found to be unreliable even when the punch
    // times themselves are clearly outside the official window.
    const lateMin = computeLateMinutes(r.in_time) || 0
    const earlyMin = computeEarlyMinutes(r.out_time) || 0
    const lateClassified = classifyLateEntry(r.status, lateMin)
    const earlyClassified = classifyEarlyOut(lateClassified.status, earlyMin)
    const effectiveStatus = earlyClassified.status

    if (lateClassified.reclassifiedToHalfDay) {
      e.hd_violations.push({ date: r.date, reason: `${fmtHHMM(lateMin)} late` })
    }
    if (earlyClassified.reclassifiedToHalfDay) {
      e.hd_violations.push({ date: r.date, reason: `${fmtHHMM(earlyMin)} early out` })
    }
    if (r.status === 'Present' && lateMin > 0) {
      e.late_days++
      e.late_minutes_total += lateMin
    }
    if (r.status === 'Present' && earlyMin > 0) {
      e.early_days++
      e.early_minutes_total += earlyMin
    }

    e._records.push({
      date: r.date,
      status: effectiveStatus,
      late_by_minutes: lateMin,
      early_by_minutes: earlyMin,
    })

    if (r.work_duration) {
      const wMin = toMin(r.work_duration)
      if (wMin > 0) {
        e.total_work_minutes += wMin
        e.work_days_with_duration++
      }
    }
  }

  return Object.values(map)
    .map(({ _records, ...e }) => {
      const sortedRecords = [..._records].sort((a, b) => a.date.localeCompare(b.date))
      const deductionDetails = computeMonthlyDeductionDetails(sortedRecords)
      const avgWorkMin =
        e.work_days_with_duration > 0
          ? Math.round(e.total_work_minutes / e.work_days_with_duration)
          : 0

      const enriched = {
        ...e,
        late_units_used: deductionDetails.lateUnitsUsed,
        late_deduction_hours: deductionDetails.lateDeductionHours,
        early_minutes_used: deductionDetails.earlyMinutesUsed,
        early_deduction_hours: deductionDetails.earlyDeductionHours,
        free_units_remaining: Math.max(0, FREE_LATE_UNITS - deductionDetails.lateUnitsUsed),
        total_half_days: e.half_day + e.hd_violations.length,
        effective_absent: e.absent + Math.max(0, e.on_leave - CL_MONTHLY_LIMIT),
        avg_work_hhmm: fmtHHMM(avgWorkMin),
        late_minutes_hhmm: fmtHHMM(e.late_minutes_total),
      }
      enriched.remarks = generateRemarks(enriched)
      enriched.has_deduction = enriched.remarks.some((r) =>
        ['absent', 'halfday', 'late', 'early'].includes(r.type),
      )
      return enriched
    })
    .sort((a, b) => a.employee_id.localeCompare(b.employee_id))
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

const STATUS_COLORS = {
  Present: 'success',
  Absent: 'danger',
  'Half Day': 'warning',
  'Weekly Off': 'secondary',
  Holiday: 'info',
  'On Leave': 'primary',
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const Step = ({ n, label, active, done }) => (
  <div className="d-flex align-items-center gap-2">
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: done
          ? 'var(--cui-success)'
          : active
            ? 'var(--cui-primary)'
            : 'var(--cui-border-color)',
        color: done || active ? '#fff' : 'var(--cui-body-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {done ? '✓' : n}
    </div>
    <span className={`small ${active ? 'fw-semibold' : 'text-body-secondary'}`}>{label}</span>
  </div>
)

// ─── Deduction Summary component (Step 4) ────────────────────────────────────
// For each employee, looks up their current_salary from local store and
// calculates the exact deduction. Employees with no salary record on file
// show "-" in every money column — the total only sums rows where salary is known.
const DeductionSummary = ({ summaries, month, year }) => {
  const [empById, setEmpById] = useState({})
  useEffect(() => {
    let cancelled = false
    localEmployees
      .list({ pageSize: 1000, includeDeleted: true })
      .then(({ items }) => {
        if (cancelled) return
        const map = {}
        for (const e of items) map[e.id] = e
        setEmpById(map)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const rows = summaries.map((e) => {
    // Confirmed divisor: present + absent + weekly-off days (present here
    // folds in Half Day, matching localAttendance.js's present_count
    // semantics, so this preview and the production Deductions tab agree).
    const presentCount = e.present + e.total_half_days
    const absentCount = e.effective_absent
    const weeklyOffCount = e.weekly_off
    const workingDays = presentCount + absentCount + weeklyOffCount

    const emp = empById[e.employee_id]
    const salary = emp?.current_salary ? parseFloat(emp.current_salary) : null

    let calc = null
    if (salary !== null && workingDays > 0) {
      calc = computeAttendanceDeduction({
        salary,
        presentCount,
        absentCount,
        weeklyOffCount,
        halfDayCount: e.total_half_days,
        lateDeductionHours: e.late_deduction_hours,
        earlyDeductionHours: e.early_deduction_hours,
      })
    }

    return {
      ...e,
      salary,
      workingDays,
      dailySalary: calc?.dailySalary ?? null,
      absentAmt: calc?.absentDeduction ?? null,
      hdAmt: calc?.halfDayDeduction ?? null,
      lateAmt: calc?.lateDeduction ?? null,
      earlyAmt: calc?.earlyDeduction ?? null,
      deduction: calc?.totalDeduction ?? null,
    }
  })

  const knownRows = rows.filter((r) => r.deduction !== null)
  const missingCount = rows.length - knownRows.length
  const totalDeduction = knownRows.reduce((sum, r) => sum + r.deduction, 0)
  const deductionRows = rows.filter((r) => r.has_deduction)

  return (
    <CCard>
      <CCardHeader className="d-flex align-items-center justify-content-between">
        <strong>
          Salary Deduction Summary —{' '}
          {
            [
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
            ][month]
          }{' '}
          {year}
        </strong>
        <span className="text-body-secondary small">
          {deductionRows.length} of {rows.length} employees have deductions
        </span>
      </CCardHeader>
      <CCardBody className="p-0">
        {missingCount > 0 && (
          <div className="px-3 py-2 border-bottom bg-warning-subtle small text-dark">
            <CIcon icon={cilWarning} size="sm" className="me-1" />
            {missingCount} employee{missingCount > 1 ? 's' : ''} missing salary data — their
            deductions are excluded from the total. Add salary via Staff → Employee Profile → Salary
            tab.
          </div>
        )}

        <CTable hover bordered small className="mb-0">
          <CTableHead color="light">
            <CTableRow>
              <CTableHeaderCell>Employee</CTableHeaderCell>
              <CTableHeaderCell className="text-center">Monthly Salary</CTableHeaderCell>
              <CTableHeaderCell className="text-center">Working Days</CTableHeaderCell>
              <CTableHeaderCell className="text-center">Daily Salary (DS)</CTableHeaderCell>
              <CTableHeaderCell className="text-center">Absent</CTableHeaderCell>
              <CTableHeaderCell className="text-center">Half Days</CTableHeaderCell>
              <CTableHeaderCell className="text-center">Late</CTableHeaderCell>
              <CTableHeaderCell className="text-center">Early Out</CTableHeaderCell>
              <CTableHeaderCell className="text-center fw-bold">Total Deduction</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {rows.map((r) => {
              const hasSalary = r.salary !== null && r.workingDays > 0
              const ds = hasSalary ? r.dailySalary : null
              const absentAmt = hasSalary ? r.absentAmt : null
              const hdAmt = hasSalary ? r.hdAmt : null
              const lateAmt = hasSalary ? r.lateAmt : null
              const earlyAmt = hasSalary ? r.earlyAmt : null

              return (
                <CTableRow
                  key={r.employee_id}
                  className={r.has_deduction && hasSalary ? 'table-danger' : ''}
                >
                  <CTableDataCell>
                    <div className="fw-semibold small">{r.employee_id}</div>
                    <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                      {r.employee_name}
                    </div>
                  </CTableDataCell>
                  <CTableDataCell className="text-center small">
                    {r.salary !== null ? `₹ ${r.salary.toLocaleString('en-IN')}` : '-'}
                  </CTableDataCell>
                  <CTableDataCell className="text-center small text-body-secondary">
                    {hasSalary ? r.workingDays : '-'}
                  </CTableDataCell>
                  <CTableDataCell className="text-center small">
                    {ds ? `₹ ${ds.toFixed(2)}` : '-'}
                  </CTableDataCell>
                  <CTableDataCell className="text-center small">
                    {!hasSalary ? (
                      '-'
                    ) : absentAmt > 0 ? (
                      <span className="text-danger">− ₹ {absentAmt.toFixed(2)}</span>
                    ) : (
                      <span className="text-body-secondary">—</span>
                    )}
                  </CTableDataCell>
                  <CTableDataCell className="text-center small">
                    {!hasSalary ? (
                      '-'
                    ) : hdAmt > 0 ? (
                      <span className="text-dark">− ₹ {hdAmt.toFixed(2)}</span>
                    ) : (
                      <span className="text-body-secondary">—</span>
                    )}
                  </CTableDataCell>
                  <CTableDataCell className="text-center small">
                    {!hasSalary ? (
                      '-'
                    ) : lateAmt > 0 ? (
                      <span className="text-dark">− ₹ {lateAmt.toFixed(2)}</span>
                    ) : (
                      <span className="text-body-secondary">—</span>
                    )}
                  </CTableDataCell>
                  <CTableDataCell className="text-center small">
                    {!hasSalary ? (
                      '-'
                    ) : earlyAmt > 0 ? (
                      <span className="text-dark">− ₹ {earlyAmt.toFixed(2)}</span>
                    ) : (
                      <span className="text-body-secondary">—</span>
                    )}
                  </CTableDataCell>
                  <CTableDataCell className="text-center">
                    {!hasSalary ? (
                      <span className="small">-</span>
                    ) : r.deduction > 0 ? (
                      <CBadge color="danger">− ₹ {r.deduction.toFixed(2)}</CBadge>
                    ) : (
                      <CBadge color="success">No deduction</CBadge>
                    )}
                  </CTableDataCell>
                </CTableRow>
              )
            })}
          </CTableBody>
          <tfoot>
            <tr style={{ background: 'var(--cui-tertiary-bg, #f8f9fa)', fontWeight: 600 }}>
              <td colSpan={8} className="px-3 py-2 text-end">
                Total Deduction
                {missingCount > 0 && (
                  <span className="fw-normal text-body-secondary ms-2 small">
                    ({knownRows.length} of {rows.length} employees)
                  </span>
                )}
              </td>
              <td className="text-center px-3 py-2">
                {knownRows.length > 0 ? (
                  <span className="text-danger fs-6">
                    − ₹{' '}
                    {totalDeduction.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                ) : (
                  <span className="text-body-secondary small">No salary data yet</span>
                )}
              </td>
            </tr>
          </tfoot>
        </CTable>
      </CCardBody>
    </CCard>
  )
}

const STEPS = ['Select Period', 'Upload File', 'Review & Confirm', 'Complete']
// Internal step values skip 2 (preview removed); map to visual positions for the indicator
const STEP_DISPLAY = { 0: 0, 1: 1, 3: 2, 4: 3 }

// ─── Main component ───────────────────────────────────────────────────────────

const AttendanceImport = () => {
  const navigate = useNavigate()
  const canEdit = usePermission(MODULE.ATTENDANCE, 'edit')
  const currentUser = useSelector((s) => s.user)

  const [step, setStep] = useState(0)
  const [year, setYear] = useState(thisYear)
  const [month, setMonth] = useState(thisMonth)

  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [parseErrors, setParseErrors] = useState([])
  const [parseWarnings, setParseWarnings] = useState([])
  const [parsedRows, setParsedRows] = useState([])
  const [periodMismatch, setPeriodMismatch] = useState(null)

  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState(null)
  const [analysisFilter, setAnalysisFilter] = useState('all') // 'all' | 'deductions' | 'clean'
  const [analysisSearch, setAnalysisSearch] = useState('')
  const [empById, setEmpById] = useState({})

  const fileInputRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    localEmployees
      .list({ pageSize: 1000, includeDeleted: true })
      .then(({ items }) => {
        if (cancelled) return
        const map = {}
        for (const e of items) map[e.id] = e
        setEmpById(map)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!canEdit) {
    return (
      <CAlert color="danger">
        <strong>Access Denied.</strong> Only HR may import attendance.
      </CAlert>
    )
  }

  // ── File handling ────────────────────────────────────────────────────────────

  const handleFileDrop = (e) => {
    e.preventDefault()
    const dropped = e.dataTransfer?.files[0] || e.target.files[0]
    if (!dropped) return
    if (!dropped.name.match(/\.(xlsx|xls)$/i)) {
      setParseErrors(['Only .xlsx or .xls files are accepted.'])
      return
    }
    setFile(dropped)
    setParseErrors([])
    setParseWarnings([])
  }

  // ── Parse ────────────────────────────────────────────────────────────────────

  const handleParse = async () => {
    if (!file) return
    setParsing(true)
    setParseErrors([])
    setParsedRows([])
    setPeriodMismatch(null)
    try {
      const { rows, errors, warnings, detectedYear, detectedMonth } =
        await parseAttendanceExcel(file)
      setParseErrors(errors)
      setParseWarnings(warnings)
      setParsedRows(rows)

      if (errors.length === 0 && rows.length > 0) {
        if (detectedYear && detectedMonth) {
          if (detectedYear !== year || detectedMonth !== month) {
            setPeriodMismatch({ detectedYear, detectedMonth })
          }
          setYear(detectedYear)
          setMonth(detectedMonth)
        }
        setStep(3)
      }
    } catch (err) {
      setParseErrors([err.message])
    } finally {
      setParsing(false)
    }
  }

  // ── Confirm import ───────────────────────────────────────────────────────────

  const handleConfirmImport = async () => {
    setSaving(true)
    try {
      let filePath = null
      try {
        filePath = await uploadAttendanceFile(file, year, month)
      } catch {
        // File upload is optional; if it fails, proceed with data import
      }

      try {
        await api.post('/attendance/import', {
          file_name: file.name,
          year,
          month,
          file_path: filePath,
          rows: parsedRows,
        })
      } catch {
        await localAttendance.saveImport({
          fileName: file.name,
          year,
          month,
          filePath,
          uploadedBy: currentUser?.full_name || currentUser?.employee_id || 'HR',
          parsedRows,
        })
      }
      setSaveResult({ success: true, count: parsedRows.length })
      setStep(4)
    } catch (err) {
      setSaveResult({ success: false, message: err.message })
      setStep(4)
    } finally {
      setSaving(false)
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const statusCounts = parsedRows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})
  const uniqueEmployees = [...new Set(parsedRows.map((r) => r.employee_id))].length

  // Computed once parse is done (step 3+)
  const employeeSummaries = step >= 3 ? buildEmployeeSummaries(parsedRows) : []
  const withDeductions = employeeSummaries.filter((e) => e.has_deduction)
  const cleanEmployees = employeeSummaries.filter((e) => !e.has_deduction)
  const categoryFilteredSummaries =
    analysisFilter === 'deductions'
      ? withDeductions
      : analysisFilter === 'clean'
        ? cleanEmployees
        : employeeSummaries
  const filteredSummaries = analysisSearch.trim()
    ? categoryFilteredSummaries.filter((e) => {
        const q = analysisSearch.trim().toLowerCase()
        return (
          e.employee_id?.toLowerCase().includes(q) || e.employee_name?.toLowerCase().includes(q)
        )
      })
    : categoryFilteredSummaries

  // ── Render ────────────────────────────────────────────────────────────────────

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

      <h4 className="mb-3">Import Attendance Excel</h4>

      {/* Step indicator */}
      <CCard className="mb-4">
        <CCardBody className="py-3">
          <div className="d-flex gap-4 flex-wrap">
            {STEPS.map((label, i) => (
              <Step
                key={label}
                n={i + 1}
                label={label}
                active={STEP_DISPLAY[step] === i}
                done={STEP_DISPLAY[step] > i}
              />
            ))}
          </div>
          <CProgress
            value={((STEP_DISPLAY[step] + 1) / STEPS.length) * 100}
            className="mt-3"
            style={{ height: 4 }}
          />
        </CCardBody>
      </CCard>

      {/* ── Step 0: Select Period ─────────────────────────────────────────────── */}
      {step === 0 && (
        <CCard>
          <CCardHeader>
            <strong>Step 1 — Select Month &amp; Year</strong>
          </CCardHeader>
          <CCardBody>
            <CRow className="g-3 mb-4">
              <CCol md={3}>
                <label className="fw-semibold small mb-1 d-block">Month</label>
                <CFormSelect value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <label className="fw-semibold small mb-1 d-block">Year</label>
                <CFormSelect value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
            </CRow>
            <CButton color="primary" onClick={() => setStep(1)}>
              Continue →
            </CButton>
          </CCardBody>
        </CCard>
      )}

      {/* ── Step 1: Upload ────────────────────────────────────────────────────── */}
      {step === 1 && (
        <CCard>
          <CCardHeader>
            <strong>
              Step 2 — Upload Pace Excel File ({MONTHS[month - 1]} {year})
            </strong>
          </CCardHeader>
          <CCardBody>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--cui-border-color)',
                borderRadius: 8,
                padding: '48px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'var(--cui-tertiary-bg, #f8f9fa)',
              }}
            >
              <CIcon icon={cilCloudUpload} style={{ width: 40, height: 40, opacity: 0.4 }} />
              <div className="mt-2 fw-semibold">
                {file ? file.name : 'Drop your Excel file here, or click to browse'}
              </div>
              <div className="text-body-secondary small mt-1">Accepts .xlsx and .xls</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleFileDrop}
              />
            </div>

            {parseErrors.length > 0 && (
              <CAlert color="danger" className="mt-3">
                <CIcon icon={cilX} className="me-2" />
                <strong>Validation errors:</strong>
                <ul className="mb-0 mt-1">
                  {parseErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </CAlert>
            )}

            {parseWarnings.length > 0 && (
              <CAlert color="warning" className="mt-3 small">
                <CIcon icon={cilWarning} className="me-2" />
                <strong>Warnings ({parseWarnings.length}):</strong>
                <ul className="mb-0 mt-1">
                  {parseWarnings.slice(0, 5).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {parseWarnings.length > 5 && <li>…and {parseWarnings.length - 5} more</li>}
                </ul>
              </CAlert>
            )}

            <div className="d-flex gap-2 mt-3">
              <CButton color="secondary" variant="outline" onClick={() => setStep(0)}>
                ← Back
              </CButton>
              <CButton color="primary" onClick={handleParse} disabled={!file || parsing}>
                {parsing && <CSpinner size="sm" className="me-2" />}
                Validate &amp; Parse
              </CButton>
            </div>
          </CCardBody>
        </CCard>
      )}

      {/* ── Step 3: Employee Analysis ─────────────────────────────────────────── */}
      {step === 3 && (
        <>
          {/* Summary counts */}
          <CRow className="g-3 mb-3">
            <CCol xs={4}>
              <CCard className="border-top border-top-primary border-3 text-center h-100">
                <CCardBody className="py-2">
                  <div className="fs-3 fw-bold text-primary">{employeeSummaries.length}</div>
                  <div className="small text-body-secondary">Total Employees</div>
                </CCardBody>
              </CCard>
            </CCol>
            <CCol xs={4}>
              <CCard className="border-top border-top-danger border-3 text-center h-100">
                <CCardBody className="py-2">
                  <div className="fs-3 fw-bold text-danger">{withDeductions.length}</div>
                  <div className="small text-body-secondary">Have Deductions</div>
                </CCardBody>
              </CCard>
            </CCol>
            <CCol xs={4}>
              <CCard className="border-top border-top-success border-3 text-center h-100">
                <CCardBody className="py-2">
                  <div className="fs-3 fw-bold text-success">{cleanEmployees.length}</div>
                  <div className="small text-body-secondary">No Deductions</div>
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>

          {/* Rules legend */}
          <CCard className="mb-3 border-start border-start-info border-3">
            <CCardBody className="py-2 px-3 small text-body-secondary">
              <strong className="text-body me-2">Rules applied:</strong>
              DS = Monthly Salary ÷ (Present + Absent + Weekly Off) &nbsp;·&nbsp; HS = DS ÷ 8
              &nbsp;·&nbsp; 7 free late units/month, then 30/60/90/120 min late deducts 0.5/1/1.5/2
              hrs &nbsp;·&nbsp; 60 free early-out minutes/month, then 60/120 min early deducts 1/2
              hrs &nbsp;·&nbsp; &gt;120 min late or early-out = Half Day (HS × 4), overrides bracket
              rate
            </CCardBody>
          </CCard>

          <CCard>
            <CCardHeader className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <strong>
                Employee Deduction Analysis — {MONTHS[month - 1]} {year}
              </strong>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                {/* Search by employee name/ID */}
                <div className="position-relative">
                  <CIcon
                    icon={cilSearch}
                    size="sm"
                    className="position-absolute text-body-secondary"
                    style={{ left: 10, top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <CFormInput
                    size="sm"
                    type="search"
                    placeholder="Search employee..."
                    value={analysisSearch}
                    onChange={(e) => setAnalysisSearch(e.target.value)}
                    style={{ paddingInlineStart: 30, width: 200 }}
                    aria-label="Search employee attendance"
                  />
                </div>
                {/* Filter */}
                <div className="d-flex gap-1">
                  {[
                    { key: 'all', label: `All (${employeeSummaries.length})` },
                    { key: 'deductions', label: `Has Deductions (${withDeductions.length})` },
                    { key: 'clean', label: `Clean (${cleanEmployees.length})` },
                  ].map(({ key, label }) => (
                    <CButton
                      key={key}
                      size="sm"
                      color={analysisFilter === key ? 'primary' : 'secondary'}
                      variant={analysisFilter === key ? undefined : 'outline'}
                      onClick={() => setAnalysisFilter(key)}
                    >
                      {label}
                    </CButton>
                  ))}
                </div>
              </div>
            </CCardHeader>
            <CCardBody className="p-0">
              <CTable hover bordered small className="mb-0">
                <CTableHead color="light">
                  <CTableRow>
                    <CTableHeaderCell style={{ minWidth: 160 }}>Employee</CTableHeaderCell>
                    <CTableHeaderCell style={{ minWidth: 160 }}>Attendance</CTableHeaderCell>
                    <CTableHeaderCell style={{ minWidth: 160 }}>Late Entry</CTableHeaderCell>
                    <CTableHeaderCell style={{ minWidth: 120 }}>Deductions</CTableHeaderCell>
                    <CTableHeaderCell style={{ minWidth: 300 }}>
                      Remarks (How &amp; Why)
                    </CTableHeaderCell>
                    <CTableHeaderCell className="text-end" style={{ minWidth: 110 }}>
                      Recovery (₹)
                    </CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {filteredSummaries.map((e) => {
                    // Same divisor/inputs as the Salary Deduction Summary
                    // table below — this is just that same figure surfaced
                    // per-row here too, at the rightmost column.
                    let recovery = null
                    try {
                      const emp = empById[e.employee_id]
                      const salary = emp?.current_salary ? parseFloat(emp.current_salary) : null
                      const presentCount = e.present + e.total_half_days
                      const absentCount = e.effective_absent
                      const weeklyOffCount = e.weekly_off
                      const workingDays = presentCount + absentCount + weeklyOffCount
                      if (salary && workingDays > 0) {
                        recovery = computeAttendanceDeduction({
                          salary,
                          presentCount,
                          absentCount,
                          weeklyOffCount,
                          halfDayCount: e.total_half_days,
                          lateDeductionHours: e.late_deduction_hours,
                          earlyDeductionHours: e.early_deduction_hours,
                        }).totalDeduction
                      }
                    } catch {
                      recovery = null
                    }

                    return (
                      <CTableRow key={e.employee_id}>
                        {/* Employee */}
                        <CTableDataCell>
                          <div className="fw-semibold small">{e.employee_id}</div>
                          <div className="text-body-secondary" style={{ fontSize: '0.75rem' }}>
                            {e.employee_name}
                          </div>
                        </CTableDataCell>

                        {/* Attendance compact */}
                        <CTableDataCell>
                          <div className="d-flex flex-wrap gap-1" style={{ fontSize: '0.75rem' }}>
                            <span className="text-success fw-semibold">{e.present}P</span>
                            {e.absent > 0 && <CBadge color="danger">{e.absent}A</CBadge>}
                            {e.total_half_days > 0 && (
                              <CBadge color="warning" className="text-dark">
                                {e.total_half_days}HD
                              </CBadge>
                            )}
                            {e.on_leave > 0 && <CBadge color="primary">{e.on_leave}L</CBadge>}
                            <span className="text-body-secondary">{e.weekly_off}WO</span>
                            {e.weekly_off_worked > 0 && (
                              <span className="text-body-secondary">{e.weekly_off_worked}WOP</span>
                            )}
                          </div>
                          <div className="text-body-secondary mt-1" style={{ fontSize: '0.72rem' }}>
                            Avg: {e.avg_work_hhmm}
                          </div>
                        </CTableDataCell>

                        {/* Late entry / early out */}
                        <CTableDataCell>
                          {e.late_days === 0 &&
                          e.early_days === 0 &&
                          e.hd_violations.length === 0 ? (
                            <span className="text-body-secondary small">Clean</span>
                          ) : (
                            <div style={{ fontSize: '0.75rem' }}>
                              {e.late_days > 0 && (
                                <div>
                                  <span className="fw-semibold">{e.late_days}</span> late day
                                  {e.late_days > 1 ? 's' : ''}
                                  <span className="text-body-secondary ms-1">
                                    ({e.late_minutes_hhmm})
                                  </span>
                                  {' · '}
                                  Units: {e.late_units_used}/7
                                  {e.late_deduction_hours > 0 && (
                                    <CBadge color="danger" className="ms-1">
                                      +{e.late_deduction_hours.toFixed(1)}h
                                    </CBadge>
                                  )}
                                </div>
                              )}
                              {e.early_days > 0 && (
                                <div>
                                  <span className="fw-semibold">{e.early_days}</span> early-out day
                                  {e.early_days > 1 ? 's' : ''}
                                  {' · '}
                                  Mins: {e.early_minutes_used}/{FREE_EARLY_OUT_MINUTES}
                                  {e.early_deduction_hours > 0 && (
                                    <CBadge color="danger" className="ms-1">
                                      +{e.early_deduction_hours.toFixed(1)}h
                                    </CBadge>
                                  )}
                                </div>
                              )}
                              {e.hd_violations.length > 0 && (
                                <CBadge color="warning" className="mt-1 text-dark">
                                  {e.hd_violations.length} &gt;120 min (HD rule)
                                </CBadge>
                              )}
                            </div>
                          )}
                        </CTableDataCell>

                        {/* Deduction badges */}
                        <CTableDataCell>
                          <div className="d-flex flex-column gap-1">
                            {e.remarks
                              .filter((r) => ['absent', 'halfday', 'late'].includes(r.type))
                              .map((r, i) => (
                                <CBadge
                                  key={i}
                                  color={
                                    r.type === 'absent'
                                      ? 'danger'
                                      : r.type === 'halfday'
                                        ? 'warning'
                                        : 'dark'
                                  }
                                  className={`text-start text-wrap${r.type === 'halfday' ? ' text-dark' : ''}`}
                                  style={{ fontSize: '0.72rem', whiteSpace: 'normal' }}
                                >
                                  {r.icon} {r.label}
                                </CBadge>
                              ))}
                            {!e.has_deduction && (
                              <CBadge color="success" style={{ fontSize: '0.72rem' }}>
                                No deductions
                              </CBadge>
                            )}
                          </div>
                        </CTableDataCell>

                        {/* Remarks */}
                        <CTableDataCell>
                          <div className="d-flex flex-column gap-2">
                            {e.remarks.map((r, i) => (
                              <div key={i} style={{ fontSize: '0.75rem' }}>
                                <span
                                  className={
                                    r.type === 'absent'
                                      ? 'text-danger fw-semibold'
                                      : r.type === 'halfday'
                                        ? 'fw-semibold'
                                        : r.type === 'late'
                                          ? 'fw-semibold'
                                          : r.type === 'clean'
                                            ? 'text-success'
                                            : 'text-body-secondary'
                                  }
                                >
                                  {r.icon} {r.label}:{' '}
                                </span>
                                <span className="text-body-secondary">{r.text}</span>
                              </div>
                            ))}
                          </div>
                        </CTableDataCell>

                        {/* Recovery amount */}
                        <CTableDataCell className="text-end fw-semibold">
                          {recovery == null ? (
                            <span className="text-body-secondary">-</span>
                          ) : recovery > 0 ? (
                            <span className="text-danger">− ₹ {recovery.toFixed(2)}</span>
                          ) : (
                            <span className="text-body-secondary">₹ 0.00</span>
                          )}
                        </CTableDataCell>
                      </CTableRow>
                    )
                  })}
                </CTableBody>
              </CTable>
            </CCardBody>
          </CCard>

          {/* Salary deduction preview — shown before confirming so HR can review amounts */}
          <div className="mt-4">
            <DeductionSummary summaries={employeeSummaries} month={month} year={year} />
          </div>

          <div className="d-flex gap-2 mt-3">
            <CButton color="secondary" variant="outline" onClick={() => setStep(1)}>
              ← Back
            </CButton>
            <CButton color="success" onClick={handleConfirmImport} disabled={saving}>
              {saving && <CSpinner size="sm" className="me-2" />}
              <CIcon icon={cilCheckCircle} className="me-1" />
              Confirm &amp; Import
            </CButton>
          </div>
        </>
      )}

      {/* ── Step 4: Done ─────────────────────────────────────────────────────── */}
      {step === 4 && (
        <>
          {saveResult?.success ? (
            <>
              {/* Success banner */}
              <CCard className="mb-4 border-top border-top-success border-3">
                <CCardBody className="py-3 d-flex align-items-center gap-3">
                  <CIcon
                    icon={cilCheckCircle}
                    style={{ width: 40, height: 40, color: 'var(--cui-success)', flexShrink: 0 }}
                  />
                  <div>
                    <div className="fw-bold fs-6">Import Successful</div>
                    <div className="text-body-secondary small">
                      {saveResult.count} attendance records imported for {MONTHS[month - 1]} {year}.
                    </div>
                  </div>
                  <div className="ms-auto d-flex gap-2">
                    <CButton
                      color="primary"
                      size="sm"
                      onClick={() => navigate('/ems/attendance', { state: { year, month } })}
                    >
                      View Attendance
                    </CButton>
                    <CButton
                      color="secondary"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStep(0)
                        setFile(null)
                        setParsedRows([])
                        setParseErrors([])
                        setParseWarnings([])
                        setSaveResult(null)
                        setPeriodMismatch(null)
                      }}
                    >
                      Import Another
                    </CButton>
                  </div>
                </CCardBody>
              </CCard>

              {/* Deduction summary was already reviewed in the previous step */}
            </>
          ) : (
            <CCard>
              <CCardBody className="text-center py-5">
                <CIcon icon={cilX} style={{ width: 56, height: 56, color: 'var(--cui-danger)' }} />
                <h5 className="mt-3">Import Failed</h5>
                <p className="text-body-secondary">{saveResult?.message}</p>
                <CButton color="secondary" onClick={() => setStep(3)}>
                  ← Back
                </CButton>
              </CCardBody>
            </CCard>
          )}
        </>
      )}
    </>
  )
}

export default AttendanceImport
