// One-time push of whatever attendance/holiday data is sitting in this
// browser's localStorage (from before the Supabase migration —
// supabase/migrations/00000000000047_attendance_supabase_migration.sql) up
// into the real Supabase tables, so nothing already imported during testing
// is lost. Flag-guarded so it only ever runs once per browser, and safe to
// re-run (upserts throughout) — same shape as localAttendance.js's old
// applyWeekendHolidayBackfill. Local data already went through that policy
// backfill previously in any browser that has data, so records are taken
// as-is rather than re-deriving status/late/early here.
import supabase from './supabase'

const LEGACY_KEYS = {
  records: 'hma_attendance_records',
  summaries: 'hma_attendance_summaries',
  uploads: 'hma_attendance_uploads',
  holidays: 'hma_holidays',
}

const STATUS_TO_DB = {
  Present: 'present',
  'Half Day': 'half_day',
  Absent: 'absent',
  'On Leave': 'on_leave',
  Holiday: 'holiday',
  'Weekly Off': 'weekly_off',
}

const readLegacy = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]')
  } catch {
    return []
  }
}

const BACKFILL_FLAG = 'hma_attendance_supabase_backfill_v1'

export const backfillAttendanceToSupabase = async () => {
  if (localStorage.getItem(BACKFILL_FLAG)) return
  try {
    const legacyRecords = readLegacy(LEGACY_KEYS.records)
    const legacySummaries = readLegacy(LEGACY_KEYS.summaries)
    const legacyUploads = readLegacy(LEGACY_KEYS.uploads)
    const legacyHolidays = readLegacy(LEGACY_KEYS.holidays)

    if (
      !legacyRecords.length &&
      !legacySummaries.length &&
      !legacyUploads.length &&
      !legacyHolidays.length
    ) {
      localStorage.setItem(BACKFILL_FLAG, '1')
      return
    }

    // Resolve every employee_id code referenced by any legacy record/summary
    // to its real uuid in one batch.
    const codes = new Set()
    for (const r of legacyRecords) if (r.employee_id) codes.add(r.employee_id)
    for (const s of legacySummaries) if (s.employee_id) codes.add(s.employee_id)
    const byCode = {}
    if (codes.size) {
      const { data } = await supabase
        .from('employees')
        .select('id, employee_id')
        .in('employee_id', [...codes])
      for (const row of data || []) byCode[row.employee_id] = row.id
    }

    if (legacyUploads.length) {
      const uploadRows = legacyUploads.map((u) => ({
        id: u.id,
        file_name: u.file_name,
        year: u.year,
        month: u.month,
        total_records: u.total_records,
        valid_records: u.valid_records,
        total_employees: u.total_employees,
        uploaded_by_name: u.uploaded_by || 'HR',
        status: u.status || 'Completed',
        uploaded_at: u.uploaded_at,
      }))
      await supabase.from('attendance_uploads').upsert(uploadRows, { onConflict: 'id' })
    }

    if (legacyRecords.length) {
      const recordRows = legacyRecords
        .filter((r) => byCode[r.employee_id])
        .map((r) => ({
          employee_id: byCode[r.employee_id],
          attendance_date: r.date,
          year: r.year,
          month: r.month,
          status: STATUS_TO_DB[r.status] || 'absent',
          leave_type: r.leave_type || null,
          in_time: r.in_time || null,
          out_time: r.out_time || null,
          work_duration_minutes: r.work_duration_minutes ?? null,
          late_by_minutes: r.late_by_minutes || 0,
          early_by_minutes: r.early_by_minutes || 0,
          is_weekly_off_type: !!r.is_weekly_off_type,
          overtime_minutes: r.overtime_minutes ?? null,
          shift: r.shift || '',
          pre_holiday_status: r.pre_holiday_status || null,
          upload_id: r.upload_id || null,
        }))
      if (recordRows.length) {
        await supabase
          .from('attendance_records')
          .upsert(recordRows, { onConflict: 'employee_id,attendance_date' })
      }
    }

    if (legacySummaries.length) {
      const summaryRows = legacySummaries
        .filter((s) => byCode[s.employee_id])
        .map((s) => ({
          employee_id: byCode[s.employee_id],
          year: s.year,
          month: s.month,
          present_count: s.present_count || 0,
          absent_count: s.absent_count || 0,
          half_day_count: s.half_day_count || 0,
          weekly_off_count: s.weekly_off_count || 0,
          weekly_off_worked_count: s.weekly_off_worked_count || 0,
          holiday_count: s.holiday_count || 0,
          leave_count: s.leave_count || 0,
          late_days: s.late_days || 0,
          late_hours: s.late_hours || null,
          late_minutes_total: s.late_minutes_total || 0,
          late_units: s.late_units || 0,
          excess_late_units: s.excess_late_units || 0,
          late_deduction_hours: s.late_deduction_hours || 0,
          early_deduction_hours: s.early_deduction_hours || 0,
          early_days: s.early_days || 0,
          early_hours: s.early_hours || null,
          total_work_duration: s.total_work_duration || null,
          total_overtime: s.total_overtime || null,
          avg_working_hours: s.avg_working_hours || null,
          total_records: s.total_records || 0,
        }))
      if (summaryRows.length) {
        await supabase
          .from('attendance_summaries')
          .upsert(summaryRows, { onConflict: 'employee_id,year,month' })
      }
    }

    if (legacyHolidays.length) {
      const holidayRows = legacyHolidays.map((h) => ({
        id: h.id,
        holiday_date: h.date,
        name: h.name,
        year: h.year,
        month: h.month,
        created_at: h.created_at,
      }))
      await supabase.from('holidays').upsert(holidayRows, { onConflict: 'id' })
    }

    localStorage.setItem(BACKFILL_FLAG, '1')
  } catch (err) {
    // Non-fatal — the app works fine against Supabase either way; a failed
    // backfill just means this browser's old local data stays un-migrated
    // and can be retried (flag isn't set on failure).
    console.warn('[backfillAttendanceToSupabase] Failed:', err)
  }
}
