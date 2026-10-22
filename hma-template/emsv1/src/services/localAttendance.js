// Supabase-backed attendance store (attendance_records, attendance_summaries,
// attendance_uploads, attendance_corrections — see
// supabase/migrations/00000000000008_attendance.sql, extended by
// 00000000000047/00000000000048). Every method here is async and every
// call site passes the human-readable employee_id code (e.g. "EMP009"), not
// the internal employees.id uuid that these tables' employee_id columns
// actually store as a FK — resolveEmployeeUuid(s) below bridges that,
// mirroring the tolerant lookup already established in localEmployees.getById().
//
// Previously this entire module was localStorage-only, meaning attendance
// data imported by HR was invisible to every other browser/device and one
// storage-clear away from total loss (see supabase/migrations/
// 00000000000047_attendance_supabase_migration.sql's comment for the full
// history). src/services/attendanceSupabaseBackfill.js does the one-time
// push of whatever was sitting in a browser's localStorage into these
// tables before this rewrite.

import supabase from './supabase'
import { localHolidays } from './localHolidays'
import { localAudit } from './localAudit'
import {
  classifyLateEntry,
  classifyEarlyOut,
  applyWeekendHolidayCorrection,
  validateAttendanceIntegrity,
  computeMonthCoverage,
  computeLateMinutes,
  computeEarlyMinutes,
  computeMonthlyDeductionDetails,
} from './attendanceCalc'
import {
  FREE_LATE_UNITS,
  HALF_DAY_THRESHOLD_MIN,
  EARLY_OUT_HALF_DAY_THRESHOLD_MIN,
} from '../constants/attendancePolicy'

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()
const pad2 = (n) => String(n).padStart(2, '0')
// Duration-style "HH:MM" formatter, matching Pace's own late_by string shape.
const fmtHHMM = (min) => (min == null ? null : `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`)

// ── status mapping: app Title Case <-> attendance_status enum ──────────────────
const STATUS_TO_DB = {
  Present: 'present',
  'Half Day': 'half_day',
  Absent: 'absent',
  'On Leave': 'on_leave',
  Holiday: 'holiday',
  'Weekly Off': 'weekly_off',
}
const STATUS_FROM_DB = Object.fromEntries(Object.entries(STATUS_TO_DB).map(([k, v]) => [v, k]))
const toDbStatus = (s) => STATUS_TO_DB[s] || s
const fromDbStatus = (s) => STATUS_FROM_DB[s] || s

// ── employee code <-> uuid resolution (batched — saveImport can touch 100s) ────
const resolveEmployeeMaps = async (employeeIdCodes) => {
  const codes = [...new Set(employeeIdCodes.filter(Boolean))]
  const byCode = {}
  const byUuid = {}
  if (!codes.length) return { byCode, byUuid }
  const { data, error } = await supabase
    .from('employees')
    .select('id, employee_id, first_name, middle_name, last_name')
    .in('employee_id', codes)
  throwIfError(error, 'Failed to resolve employees')
  for (const row of data || []) {
    const name = [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ')
    byCode[row.employee_id] = { uuid: row.id, name }
    byUuid[row.id] = { code: row.employee_id, name }
  }
  return { byCode, byUuid }
}

// ── helpers ───────────────────────────────────────────────────────────────────

const STATUS_ORDER = ['Present', 'Half Day', 'Absent', 'On Leave', 'Holiday', 'Weekly Off']
const isValidStatus = (s) => STATUS_ORDER.includes(s)

// Parse "HH:MM" or "HH:MM:SS" -> total minutes from midnight
const toMinutes = (str) => {
  if (!str) return null
  const parts = str.split(':').map(Number)
  return parts[0] * 60 + (parts[1] || 0)
}

// Format minutes as "H h MM m"
const fmtDuration = (min) => {
  if (min == null || isNaN(min)) return null
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// Build monthly summary from a set of app-shape records for one employee-month
const buildSummary = (records) => {
  let present = 0,
    absent = 0,
    weeklyOff = 0,
    holiday = 0,
    leave = 0,
    halfDay = 0,
    weeklyOffWorked = 0,
    lateDays = 0,
    lateMinTotal = 0,
    lateUnitsTotal = 0,
    earlyDays = 0,
    earlyMinTotal = 0,
    workMinTotal = 0,
    otMinTotal = 0

  for (const r of records) {
    switch (r.status) {
      case 'Present':
        present++
        break
      case 'Half Day':
        halfDay++
        present++
        break
      case 'Absent':
        absent++
        break
      case 'On Leave':
        leave++
        break
      case 'Holiday':
        holiday++
        break
      case 'Weekly Off':
        weeklyOff++
        break
    }
    if (r.is_weekly_off_type && r.status !== 'Weekly Off') {
      weeklyOffWorked++
    }
    if (r.status === 'Present' && r.late_by_minutes > 0) {
      lateDays++
      lateMinTotal += r.late_by_minutes
      lateUnitsTotal += Math.ceil(r.late_by_minutes / 15)
    }
    if (r.early_by_minutes > 0) {
      earlyDays++
      earlyMinTotal += r.early_by_minutes
    }
    if (r.work_duration_minutes != null) workMinTotal += r.work_duration_minutes
    if (r.overtime_minutes != null) otMinTotal += r.overtime_minutes
  }

  const workingDays = present + absent + halfDay + leave
  const avgWorkMin = workingDays > 0 ? Math.round(workMinTotal / workingDays) : 0

  const sortedRecords = [...records].sort((a, b) => a.date.localeCompare(b.date))
  const deductionDetails = computeMonthlyDeductionDetails(sortedRecords)

  return {
    present_count: present,
    absent_count: absent,
    half_day_count: halfDay,
    weekly_off_count: weeklyOff,
    weekly_off_worked_count: weeklyOffWorked,
    holiday_count: holiday,
    leave_count: leave,
    late_days: lateDays,
    late_hours: fmtDuration(lateMinTotal),
    late_minutes_total: lateMinTotal,
    late_units: lateUnitsTotal,
    excess_late_units: Math.max(0, lateUnitsTotal - FREE_LATE_UNITS),
    late_deduction_hours: deductionDetails.lateDeductionHours,
    early_deduction_hours: deductionDetails.earlyDeductionHours,
    early_days: earlyDays,
    early_hours: fmtDuration(earlyMinTotal),
    total_work_duration: fmtDuration(workMinTotal),
    total_overtime: fmtDuration(otMinTotal),
    avg_working_hours: fmtDuration(avgWorkMin),
    total_records: records.length,
  }
}

// Applies all auto-correction rules to one candidate record before it's
// persisted. See the original localStorage-era comment (still accurate):
// weekend rule only touches 'Absent'; late-entry/early-out rules only act on
// 'Present'; all are no-ops otherwise, so call order doesn't matter and
// re-running this on an already-corrected record is idempotent.
const applyRecordPolicy = (
  status,
  inTime,
  outTime,
  lateByFallbackMinutes,
  earlyByFallbackMinutes,
  dateStr,
) => {
  const holiday = localHolidays.getDefaultHoliday(dateStr)
  const weekend = applyWeekendHolidayCorrection(status, !!holiday)

  const derivedLateMinutes = computeLateMinutes(inTime)
  const lateMinutes = derivedLateMinutes != null ? derivedLateMinutes : lateByFallbackMinutes || 0
  const late = classifyLateEntry(weekend.status, lateMinutes)

  const derivedEarlyMinutes = computeEarlyMinutes(outTime)
  const earlyMinutes =
    derivedEarlyMinutes != null ? derivedEarlyMinutes : earlyByFallbackMinutes || 0
  const early = classifyEarlyOut(late.status, earlyMinutes)

  const autoCorrections = []
  if (weekend.corrected) {
    autoCorrections.push({
      reason: `Default holiday (${holiday?.name}) — Absent corrected to Weekly Off`,
    })
  }
  if (late.reclassifiedToHalfDay) {
    autoCorrections.push({
      reason: `>${HALF_DAY_THRESHOLD_MIN} min late while Present — reclassified to Half Day`,
    })
  }
  if (early.reclassifiedToHalfDay) {
    autoCorrections.push({
      reason: `>${EARLY_OUT_HALF_DAY_THRESHOLD_MIN} min early punch-out while Present — reclassified to Half Day`,
    })
  }
  return { status: early.status, lateMinutes, earlyMinutes, autoCorrections }
}

// ── db row <-> app shape ─────────────────────────────────────────────────────

const fromDbRecord = (row, byUuid) => ({
  id: row.id,
  employee_id: byUuid[row.employee_id]?.code || row.employee_id,
  employee_name: byUuid[row.employee_id]?.name || '',
  date: row.attendance_date,
  year: row.year,
  month: row.month,
  status: fromDbStatus(row.status),
  leave_type: row.leave_type || null,
  in_time: row.in_time,
  out_time: row.out_time,
  work_duration_minutes: row.work_duration_minutes,
  work_duration: row.work_duration_minutes != null ? fmtDuration(row.work_duration_minutes) : null,
  late_by_minutes: row.late_by_minutes || 0,
  late_by: row.late_by_minutes > 0 ? fmtHHMM(row.late_by_minutes) : null,
  early_by_minutes: row.early_by_minutes || 0,
  early_by: row.early_by_minutes > 0 ? fmtHHMM(row.early_by_minutes) : null,
  is_weekly_off_type: !!row.is_weekly_off_type,
  overtime_minutes: row.overtime_minutes,
  overtime: row.overtime_minutes != null ? fmtDuration(row.overtime_minutes) : null,
  shift: row.shift || '',
  pre_holiday_status: row.pre_holiday_status,
  upload_id: row.upload_id,
  corrections: [], // attached by listRecords() when needed — see below
  created_at: row.created_at,
  updated_at: row.updated_at,
})

const fromDbSummary = (row) => ({
  id: row.id,
  upload_id: row.upload_id,
  employee_id: row.employee_id, // caller-supplied code, already known
  year: row.year,
  month: row.month,
  present_count: row.present_count || 0,
  absent_count: row.absent_count || 0,
  half_day_count: row.half_day_count || 0,
  weekly_off_count: row.weekly_off_count || 0,
  weekly_off_worked_count: row.weekly_off_worked_count || 0,
  holiday_count: row.holiday_count || 0,
  leave_count: row.leave_count || 0,
  late_days: row.late_days || 0,
  late_hours: row.late_hours,
  late_minutes_total: row.late_minutes_total || 0,
  late_units: row.late_units || 0,
  excess_late_units: row.excess_late_units || 0,
  late_deduction_hours: row.late_deduction_hours != null ? Number(row.late_deduction_hours) : 0,
  early_deduction_hours: row.early_deduction_hours != null ? Number(row.early_deduction_hours) : 0,
  early_days: row.early_days || 0,
  early_hours: row.early_hours,
  total_work_duration: row.total_work_duration,
  total_overtime: row.total_overtime,
  avg_working_hours: row.avg_working_hours,
  total_records: row.total_records || 0,
  created_at: row.created_at,
  updated_at: row.updated_at,
})

const fromDbCorrection = (row) => ({
  id: row.id,
  old_status: row.old_status,
  new_status: row.new_status,
  old_leave_type: row.old_leave_type,
  new_leave_type: row.new_leave_type,
  old_in_time: row.old_in_time,
  new_in_time: row.new_in_time,
  old_out_time: row.old_out_time,
  new_out_time: row.new_out_time,
  reason: row.reason,
  corrected_by: row.corrected_by_name || 'System',
  corrected_at: row.corrected_at,
})

// Recomputes and upserts the attendance_summaries row for one employee-month
// from whatever is currently in attendance_records.
const rebuildOneSummary = async (employeeUuid, employeeCode, year, month) => {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('employee_id', employeeUuid)
    .eq('year', year)
    .eq('month', month)
  throwIfError(error, 'Failed to load records for summary rebuild')

  const appRecords = (data || []).map((row) =>
    fromDbRecord(row, { [employeeUuid]: { code: employeeCode } }),
  )
  const summary = buildSummary(appRecords)

  const { error: upsertError } = await supabase
    .from('attendance_summaries')
    .upsert(
      { employee_id: employeeUuid, year, month, ...summary },
      { onConflict: 'employee_id,year,month' },
    )
  throwIfError(upsertError, 'Failed to save attendance summary')
}

// ── public API ────────────────────────────────────────────────────────────────

export const localAttendance = {
  // ── uploads ─────────────────────────────────────────────────────────────────

  async listUploads({ year, month } = {}) {
    let query = supabase
      .from('attendance_uploads')
      .select('*')
      .order('uploaded_at', { ascending: false })
    if (year) query = query.eq('year', Number(year))
    if (month) query = query.eq('month', Number(month))
    const { data, error } = await query
    throwIfError(error, 'Failed to load uploads')
    return (data || []).map((row) => ({
      id: row.id,
      file_name: row.file_name,
      year: row.year,
      month: row.month,
      total_records: row.total_records,
      valid_records: row.valid_records,
      total_employees: row.total_employees,
      uploaded_by: row.uploaded_by_name || 'HR',
      uploaded_at: row.uploaded_at,
      status: row.status,
    }))
  },

  async getUpload(uploadId) {
    const { data, error } = await supabase
      .from('attendance_uploads')
      .select('*')
      .eq('id', uploadId)
      .maybeSingle()
    throwIfError(error, 'Failed to load upload')
    if (!data) return null
    return {
      id: data.id,
      file_name: data.file_name,
      year: data.year,
      month: data.month,
      total_records: data.total_records,
      valid_records: data.valid_records,
      total_employees: data.total_employees,
      uploaded_by: data.uploaded_by_name || 'HR',
      uploaded_at: data.uploaded_at,
      status: data.status,
    }
  },

  // ── saveImport ───────────────────────────────────────────────────────────────
  // Called after parse + user confirms. Upserts records by employee+date so a
  // partial (daily/weekly) re-upload for a month merges into what's already
  // there, applies the weekend/holiday + half-day policy corrections, then
  // rebuilds the affected employees' month summaries.
  async saveImport({ fileName, year, month, uploadedBy, filePath, parsedRows }) {
    const ts = now()
    const uploadId = uid()

    // Collapse duplicate employee_id+date rows within this file — last wins.
    const dedupedRows = new Map()
    for (const r of parsedRows) {
      if (r._valid === false) continue
      dedupedRows.set(`${r.employee_id}|${r.date}`, r)
    }

    const { byCode } = await resolveEmployeeMaps(
      [...dedupedRows.values()].map((r) => r.employee_id),
    )

    const touchedEmployees = new Set()
    const unresolvedCodes = new Set()
    const upsertRows = []
    const correctionsByRecord = []

    for (const r of dedupedRows.values()) {
      const resolved = byCode[r.employee_id]
      if (!resolved) {
        unresolvedCodes.add(r.employee_id)
        continue
      }
      const policy = applyRecordPolicy(
        r.status,
        r.in_time,
        r.out_time,
        toMinutes(r.late_by),
        toMinutes(r.early_by),
        r.date,
      )

      upsertRows.push({
        employee_id: resolved.uuid,
        attendance_date: r.date,
        year,
        month,
        status: toDbStatus(policy.status),
        in_time: r.in_time || null,
        out_time: r.out_time || null,
        work_duration_minutes: toMinutes(r.work_duration),
        late_by_minutes: policy.lateMinutes || 0,
        is_weekly_off_type: !!r.is_weekly_off_type,
        early_by_minutes: policy.earlyMinutes || 0,
        overtime_minutes: toMinutes(r.overtime),
        shift: r.shift || '',
        upload_id: uploadId,
      })
      touchedEmployees.add(r.employee_id)
      if (policy.autoCorrections.length) {
        correctionsByRecord.push({
          employeeUuid: resolved.uuid,
          date: r.date,
          oldStatus: r.status,
          newStatus: policy.status,
          reasons: policy.autoCorrections.map((c) => c.reason),
        })
      }
    }

    if (upsertRows.length) {
      const { error: uploadError } = await supabase.from('attendance_uploads').insert({
        id: uploadId,
        file_name: fileName,
        year,
        month,
        file_path: filePath || null,
        total_records: dedupedRows.size,
        valid_records: upsertRows.length,
        total_employees: touchedEmployees.size,
        uploaded_by_name: uploadedBy || 'HR',
        status: 'Completed',
        uploaded_at: ts,
      })
      throwIfError(uploadError, 'Failed to save upload record')

      const { data: upserted, error: upsertError } = await supabase
        .from('attendance_records')
        .upsert(upsertRows, { onConflict: 'employee_id,attendance_date' })
        .select('id, employee_id, attendance_date')
      throwIfError(upsertError, 'Failed to save attendance records')

      if (correctionsByRecord.length && upserted) {
        const idByKey = {}
        for (const row of upserted) idByKey[`${row.employee_id}|${row.attendance_date}`] = row.id
        const correctionRows = correctionsByRecord.flatMap((c) => {
          const recordId = idByKey[`${c.employeeUuid}|${c.date}`]
          if (!recordId) return []
          return c.reasons.map((reason) => ({
            attendance_record_id: recordId,
            old_status: c.oldStatus,
            new_status: c.newStatus,
            reason,
            corrected_at: ts,
          }))
        })
        if (correctionRows.length) {
          const { error: correctionError } = await supabase
            .from('attendance_corrections')
            .insert(correctionRows)
          throwIfError(correctionError, 'Failed to save auto-corrections')
        }
      }

      for (const code of touchedEmployees) {
        await rebuildOneSummary(byCode[code].uuid, code, year, month)
      }
    }

    const integrityWarnings = await this.getIntegrityWarnings(year, month)

    localAudit.write({
      module: 'Attendance',
      action: 'ATTENDANCE_IMPORTED',
      record_id: uploadId,
      record_label: fileName,
      new_value: {
        year,
        month,
        total_records: dedupedRows.size,
        total_employees: touchedEmployees.size,
        new_records: upsertRows.length,
      },
      details: `Imported "${fileName}" for ${year}-${String(month).padStart(2, '0')}: ${dedupedRows.size} records, ${touchedEmployees.size} employees${unresolvedCodes.size ? `, ${unresolvedCodes.size} unresolved employee ID(s) skipped` : ''}`,
    })

    return {
      uploadId,
      totalRecords: dedupedRows.size,
      totalEmployees: touchedEmployees.size,
      newRecords: upsertRows.length,
      unresolvedEmployeeIds: [...unresolvedCodes],
      integrityWarnings,
    }
  },

  // ── records ──────────────────────────────────────────────────────────────────

  async listRecords({ employeeId, year, month, date, page = 1, pageSize = 30 } = {}) {
    let query = supabase.from('attendance_records').select('*', { count: 'exact' })
    if (employeeId) {
      const { byCode } = await resolveEmployeeMaps([employeeId])
      const resolved = byCode[employeeId]
      if (!resolved) return { items: [], total: 0 }
      query = query.eq('employee_id', resolved.uuid)
    }
    if (year) query = query.eq('year', Number(year))
    if (month) query = query.eq('month', Number(month))
    if (date) query = query.eq('attendance_date', date)
    query = query.order(date ? 'employee_id' : 'attendance_date', { ascending: !!date })

    const { data, error, count } = await query
    throwIfError(error, 'Failed to load attendance records')
    const rows = data || []

    // Resolve every distinct employee uuid present back to its business code.
    const byUuid = {}
    const uniqueUuids = [...new Set(rows.map((r) => r.employee_id))]
    if (uniqueUuids.length) {
      const { data: emps, error: empError } = await supabase
        .from('employees')
        .select('id, employee_id, first_name, middle_name, last_name')
        .in('id', uniqueUuids)
      throwIfError(empError, 'Failed to resolve employees')
      for (const e of emps || []) {
        byUuid[e.id] = {
          code: e.employee_id,
          name: [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' '),
        }
      }
    }

    let items = rows.map((row) => fromDbRecord(row, byUuid))

    // Attach correction counts (AttendanceSummaryTab only needs .length; the
    // Corrections page loads full detail per-record via listCorrectionsForRecord).
    if (items.length) {
      const { data: corrs } = await supabase
        .from('attendance_corrections')
        .select('id, attendance_record_id')
        .in(
          'attendance_record_id',
          items.map((r) => r.id),
        )
      const countByRecord = {}
      for (const c of corrs || []) {
        countByRecord[c.attendance_record_id] = (countByRecord[c.attendance_record_id] || 0) + 1
      }
      items = items.map((r) => ({
        ...r,
        corrections: Array.from({ length: countByRecord[r.id] || 0 }),
      }))
    }

    const total = count ?? items.length
    const start = (page - 1) * pageSize
    return { items: items.slice(start, start + pageSize), total }
  },

  async listCorrectionsForRecord(recordId) {
    const { data, error } = await supabase
      .from('attendance_corrections')
      .select('*')
      .eq('attendance_record_id', recordId)
      .order('corrected_at', { ascending: true })
    throwIfError(error, 'Failed to load corrections')
    return (data || []).map(fromDbCorrection)
  },

  // ── summaries ─────────────────────────────────────────────────────────────────

  async getSummary(employeeId, year, month) {
    const { byCode } = await resolveEmployeeMaps([employeeId])
    const resolved = byCode[employeeId]
    if (!resolved) return null
    const { data, error } = await supabase
      .from('attendance_summaries')
      .select('*')
      .eq('employee_id', resolved.uuid)
      .eq('year', Number(year))
      .eq('month', Number(month))
      .maybeSingle()
    throwIfError(error, 'Failed to load attendance summary')
    return data ? fromDbSummary({ ...data, employee_id: employeeId }) : null
  },

  async getLatestSummary(employeeId) {
    const { byCode } = await resolveEmployeeMaps([employeeId])
    const resolved = byCode[employeeId]
    if (!resolved) return null
    const { data, error } = await supabase
      .from('attendance_summaries')
      .select('*')
      .eq('employee_id', resolved.uuid)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle()
    throwIfError(error, 'Failed to load latest attendance summary')
    return data ? fromDbSummary({ ...data, employee_id: employeeId }) : null
  },

  async listMonthlySummaries({ year, month } = {}) {
    let query = supabase.from('attendance_summaries').select('*')
    if (year) query = query.eq('year', Number(year))
    if (month) query = query.eq('month', Number(month))
    const { data, error } = await query
    throwIfError(error, 'Failed to load attendance summaries')
    const rows = data || []
    const uniqueUuids = [...new Set(rows.map((r) => r.employee_id))]
    let byUuid = {}
    if (uniqueUuids.length) {
      const { data: emps } = await supabase
        .from('employees')
        .select('id, employee_id')
        .in('id', uniqueUuids)
      for (const e of emps || []) byUuid[e.id] = e.employee_id
    }
    return rows.map((row) =>
      fromDbSummary({ ...row, employee_id: byUuid[row.employee_id] || row.employee_id }),
    )
  },

  // ── corrections ──────────────────────────────────────────────────────────────

  async applyCorrection(
    recordId,
    { new_status, new_in_time, new_out_time, leave_type, reason, corrected_by },
  ) {
    const { data: old, error: findError } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('id', recordId)
      .maybeSingle()
    throwIfError(findError, 'Failed to load record')
    if (!old) throw new Error('Record not found')

    const ts = now()
    const resolvedStatus = new_status ? toDbStatus(new_status) : old.status
    const resolvedLeaveType = new_status === 'On Leave' ? leave_type || null : null

    const { error: updateError } = await supabase
      .from('attendance_records')
      .update({
        status: resolvedStatus,
        leave_type: resolvedLeaveType,
        in_time: new_in_time || old.in_time,
        out_time: new_out_time || old.out_time,
        updated_at: ts,
      })
      .eq('id', recordId)
    throwIfError(updateError, 'Failed to update record')

    const { error: correctionError } = await supabase.from('attendance_corrections').insert({
      attendance_record_id: recordId,
      old_status: fromDbStatus(old.status),
      new_status: new_status || fromDbStatus(old.status),
      old_leave_type: old.leave_type || null,
      new_leave_type: resolvedLeaveType,
      old_in_time: old.in_time,
      new_in_time: new_in_time || old.in_time,
      old_out_time: old.out_time,
      new_out_time: new_out_time || old.out_time,
      reason: reason || '',
      corrected_at: ts,
    })
    throwIfError(correctionError, 'Failed to save correction')

    const { data: emp } = await supabase
      .from('employees')
      .select('employee_id')
      .eq('id', old.employee_id)
      .maybeSingle()
    const employeeCode = emp?.employee_id
    if (employeeCode) {
      await rebuildOneSummary(old.employee_id, employeeCode, old.year, old.month)
    }

    localAudit.write({
      module: 'Attendance',
      action: 'ATTENDANCE_CORRECTED',
      record_id: recordId,
      record_label: employeeCode || old.employee_id,
      old_value: { status: fromDbStatus(old.status), in_time: old.in_time, out_time: old.out_time },
      new_value: {
        status: resolvedStatus,
        in_time: new_in_time || old.in_time,
        out_time: new_out_time || old.out_time,
      },
      details: `Attendance corrected for ${employeeCode || old.employee_id} on ${old.attendance_date}: "${fromDbStatus(old.status)}" → "${new_status || fromDbStatus(old.status)}"${reason ? ' — ' + reason : ''}`,
    })

    return fromDbRecord(
      { ...old, status: resolvedStatus, leave_type: resolvedLeaveType },
      employeeCode ? { [old.employee_id]: { code: employeeCode } } : {},
    )
  },

  // ── department summary (for dashboard cards) ──────────────────────────────────
  async getMonthlySummaryAggregate(year, month) {
    const rows = await this.listMonthlySummaries({ year, month })
    if (rows.length === 0) return null
    return {
      total_employees: rows.length,
      clean_count: rows.filter(
        (s) => (s.absent_count || 0) === 0 && (s.late_minutes_total || 0) === 0,
      ).length,
      has_absent: rows.filter((s) => (s.absent_count || 0) > 0).length,
      has_late: rows.filter((s) => (s.late_days || 0) > 0).length,
      has_leave: rows.filter((s) => (s.leave_count || 0) > 0).length,
      total_absent_days: rows.reduce((sum, s) => sum + (s.absent_count || 0), 0),
      total_late_days: rows.reduce((sum, s) => sum + (s.late_days || 0), 0),
    }
  },

  // ── integrity / coverage ──────────────────────────────────────────────────
  async getIntegrityWarnings(year, month) {
    const daysInMonth = new Date(year, month, 0).getDate()
    const rows = await this.listMonthlySummaries({ year, month })
    return rows
      .map((s) => ({
        employee_id: s.employee_id,
        ...validateAttendanceIntegrity({
          presentCount: s.present_count,
          absentCount: s.absent_count,
          halfDayCount: 0,
          leaveCount: s.leave_count,
          weeklyOffCount: s.weekly_off_count,
          holidayCount: s.holiday_count,
          daysInMonth,
        }),
      }))
      .filter((w) => !w.valid)
  },

  async getMonthCoverage(year, month) {
    const daysInMonth = new Date(year, month, 0).getDate()
    const allDates = Array.from(
      { length: daysInMonth },
      (_, i) => `${year}-${pad2(month)}-${pad2(i + 1)}`,
    )
    const holidayMap = await localHolidays.getMonthMap(year, month)
    const defaultHolidaySet = new Set(
      Object.keys(holidayMap).filter((d) => holidayMap[d].type !== 'custom'),
    )
    const { data, error } = await supabase
      .from('attendance_records')
      .select('attendance_date')
      .eq('year', Number(year))
      .eq('month', Number(month))
    throwIfError(error, 'Failed to load coverage data')
    const recordedDateSet = new Set((data || []).map((r) => r.attendance_date))
    return computeMonthCoverage(allDates, defaultHolidaySet, recordedDateSet)
  },

  async rebuildMonthSummaries(year, month) {
    const rows = await this.listMonthlySummaries({ year, month })
    const employeeCodes = [...new Set(rows.map((r) => r.employee_id))]
    const { byCode } = await resolveEmployeeMaps(employeeCodes)
    for (const code of employeeCodes) {
      if (byCode[code]) await rebuildOneSummary(byCode[code].uuid, code, year, month)
    }
  },

  // ── holiday calendar integration ─────────────────────────────────────────────
  // Called by GeneralCalendar when HR adds a custom holiday. Flips every
  // Absent record on that date to Holiday so no deduction is applied.
  async applyHolidayToDate(date, holidayName) {
    const d = new Date(date + 'T00:00:00')
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const ts = now()

    const { data: rows, error: findError } = await supabase
      .from('attendance_records')
      .select('id, employee_id, status')
      .eq('attendance_date', date)
      .eq('status', 'absent')
    throwIfError(findError, 'Failed to load records for holiday application')
    if (!rows || rows.length === 0) return 0

    const { error: updateError } = await supabase
      .from('attendance_records')
      .update({ pre_holiday_status: 'absent', status: 'holiday', updated_at: ts })
      .in(
        'id',
        rows.map((r) => r.id),
      )
    throwIfError(updateError, 'Failed to apply holiday')

    const { error: correctionError } = await supabase.from('attendance_corrections').insert(
      rows.map((r) => ({
        attendance_record_id: r.id,
        old_status: 'Absent',
        new_status: 'Holiday',
        reason: `Company holiday: ${holidayName}`,
        corrected_at: ts,
      })),
    )
    throwIfError(correctionError, 'Failed to record holiday corrections')

    const employeeUuids = [...new Set(rows.map((r) => r.employee_id))]
    const { data: emps } = await supabase
      .from('employees')
      .select('id, employee_id')
      .in('id', employeeUuids)
    for (const e of emps || []) {
      await rebuildOneSummary(e.id, e.employee_id, year, month)
    }

    localAudit.write({
      module: 'Attendance',
      action: 'HOLIDAY_APPLIED',
      record_id: date,
      record_label: holidayName,
      new_value: { date, holiday_name: holidayName, records_updated: rows.length },
      details: `Holiday "${holidayName}" applied to ${date} — ${rows.length} Absent record(s) converted to Holiday`,
    })
    return rows.length
  },

  // Called by GeneralCalendar when HR removes a custom holiday. Reverts only
  // records that were changed by applyHolidayToDate (have pre_holiday_status set).
  async revertHolidayFromDate(date) {
    const d = new Date(date + 'T00:00:00')
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const ts = now()

    const { data: rows, error: findError } = await supabase
      .from('attendance_records')
      .select('id, employee_id, pre_holiday_status')
      .eq('attendance_date', date)
      .not('pre_holiday_status', 'is', null)
    throwIfError(findError, 'Failed to load records for holiday reversion')
    if (!rows || rows.length === 0) return 0

    for (const r of rows) {
      const { error: updateError } = await supabase
        .from('attendance_records')
        .update({ status: r.pre_holiday_status, pre_holiday_status: null, updated_at: ts })
        .eq('id', r.id)
      throwIfError(updateError, 'Failed to revert holiday')
    }

    const { error: correctionError } = await supabase.from('attendance_corrections').insert(
      rows.map((r) => ({
        attendance_record_id: r.id,
        old_status: 'Holiday',
        new_status: fromDbStatus(r.pre_holiday_status),
        reason: 'Holiday removed from calendar',
        corrected_at: ts,
      })),
    )
    throwIfError(correctionError, 'Failed to record holiday-reversion corrections')

    const employeeUuids = [...new Set(rows.map((r) => r.employee_id))]
    const { data: emps } = await supabase
      .from('employees')
      .select('id, employee_id')
      .in('id', employeeUuids)
    for (const e of emps || []) {
      await rebuildOneSummary(e.id, e.employee_id, year, month)
    }

    localAudit.write({
      module: 'Attendance',
      action: 'HOLIDAY_REVERTED',
      record_id: date,
      record_label: date,
      old_value: { date, holiday_applied: true },
      new_value: { date, holiday_applied: false, records_restored: rows.length },
      details: `Holiday removed from ${date} — ${rows.length} record(s) restored to original status`,
    })
    return rows.length
  },

  isValidStatus,
}
