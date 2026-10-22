// Pure attendance policy math — no localStorage, no I/O. Same convention as
// monthlyApportionment.js: every function is a plain data-in/data-out
// transform, so it's testable without a browser and safely shared between
// the live import path (localAttendance.js) and the one-time backfill.

import {
  FREE_LATE_UNITS,
  LATE_UNIT_MIN,
  HALF_DAY_THRESHOLD_MIN,
  HALF_DAY_DEDUCTION_HOURS,
  LATE_BRACKET_MIN,
  LATE_BRACKET_HOURS,
  FREE_EARLY_OUT_MINUTES,
  EARLY_OUT_HALF_DAY_THRESHOLD_MIN,
  EARLY_OUT_BRACKET_MIN,
  EARLY_OUT_BRACKET_HOURS,
  SHIFT_START_TIME,
  SHIFT_END_TIME,
} from '../constants/attendancePolicy'

// >120 min late while Present → Half Day (priority rule), else standard
// ceil(minutes/15) unit count (used only to track when the 7-free-unit pool
// is exhausted — see computeMonthlyDeductionDetails for the actual $ amount).
// Only ever acts on status === 'Present' — a no-op for every other status, so
// it's safe to re-run on already-processed records (idempotent), which is
// what the backfill migration relies on.
export const classifyLateEntry = (status, lateMinutes) => {
  if (status !== 'Present' || !(lateMinutes > 0)) {
    return { status, lateUnits: 0, reclassifiedToHalfDay: false }
  }
  if (lateMinutes > HALF_DAY_THRESHOLD_MIN) {
    return { status: 'Half Day', lateUnits: 0, reclassifiedToHalfDay: true }
  }
  return {
    status: 'Present',
    lateUnits: Math.ceil(lateMinutes / LATE_UNIT_MIN),
    reclassifiedToHalfDay: false,
  }
}

// Mirror of classifyLateEntry for early punch-outs. >120 min early while
// Present → Half Day (priority rule), independent of the monthly free-pool
// state. No-op for every other status — idempotent, safe for the backfill.
export const classifyEarlyOut = (status, earlyMinutes) => {
  if (status !== 'Present' || !(earlyMinutes > 0)) {
    return { status, reclassifiedToHalfDay: false }
  }
  if (earlyMinutes > EARLY_OUT_HALF_DAY_THRESHOLD_MIN) {
    return { status: 'Half Day', reclassifiedToHalfDay: true }
  }
  return { status: 'Present', reclassifiedToHalfDay: false }
}

// Absent on a default-holiday date (Sunday, 2nd/4th Saturday) → Weekly Off.
// Present/Half Day on that date is left untouched — a legitimate worked
// weekly-off. No-op for every other status — also idempotent.
export const applyWeekendHolidayCorrection = (status, isDefaultHoliday) => {
  if (isDefaultHoliday && status === 'Absent') {
    return { status: 'Weekly Off', corrected: true }
  }
  return { status, corrected: false }
}

// Deduction-hours schedule for a late day AFTER the 7 free units are already
// used up: 0-30 min → 0.5hr, 31-60 → 1hr, 61-90 → 1.5hr, 91-120 → 2hr.
// (Beyond 120 min the record is already Half Day via classifyLateEntry.)
export const computeLateBracketDeductionHours = (lateMinutes) =>
  Math.ceil(lateMinutes / LATE_BRACKET_MIN) * LATE_BRACKET_HOURS

// Deduction-hours schedule for an early-out day AFTER the 60 free minutes
// are used up: 0-60 min early → 1hr, 61-120 → 2hr. (Beyond 120 min the
// record is already Half Day via classifyEarlyOut.)
export const computeEarlyOutBracketDeductionHours = (earlyMinutes) =>
  Math.ceil(earlyMinutes / EARLY_OUT_BRACKET_MIN) * EARLY_OUT_BRACKET_HOURS

// Two-stage monthly deduction algorithm, run once per employee per month over
// that employee's Present/Half-Day records for the month SORTED by date
// ascending (chronological order matters — the free pool is consumed by
// whichever late/early days occur first in the month, and only days AFTER
// the pool is already exhausted get bracket-deducted, per the confirmed
// "7+1" precedent — the day that would exceed the pool still counts as free;
// only strictly later days pay the bracket rate).
//
// records: Array<{ status, late_by_minutes, early_by_minutes }>
export const computeMonthlyDeductionDetails = (records) => {
  let lateUnitsUsed = 0
  let earlyMinutesUsed = 0
  let lateDeductionHours = 0
  let earlyDeductionHours = 0

  for (const r of records) {
    if (r.status !== 'Present') continue

    if (r.late_by_minutes > 0) {
      if (lateUnitsUsed >= FREE_LATE_UNITS) {
        lateDeductionHours += computeLateBracketDeductionHours(r.late_by_minutes)
      } else {
        lateUnitsUsed += Math.ceil(r.late_by_minutes / LATE_UNIT_MIN)
      }
    }

    if (r.early_by_minutes > 0) {
      if (earlyMinutesUsed >= FREE_EARLY_OUT_MINUTES) {
        earlyDeductionHours += computeEarlyOutBracketDeductionHours(r.early_by_minutes)
      } else {
        earlyMinutesUsed += r.early_by_minutes
      }
    }
  }

  return { lateUnitsUsed, earlyMinutesUsed, lateDeductionHours, earlyDeductionHours }
}

// Confirmed formula: daily-salary divisor = present + absent + weekly-off days.
export const computeDailySalary = (salary, presentCount, absentCount, weeklyOffCount = 0) => {
  const workingDays = presentCount + absentCount + weeklyOffCount
  return workingDays > 0 ? salary / workingDays : 0
}

export const computeHourlySalary = (dailySalary) => dailySalary / 8

export const computeAttendanceDeduction = ({
  salary,
  presentCount,
  absentCount,
  weeklyOffCount = 0,
  halfDayCount,
  lateDeductionHours = 0,
  earlyDeductionHours = 0,
}) => {
  const dailySalary = computeDailySalary(salary, presentCount, absentCount, weeklyOffCount)
  const hourlySalary = computeHourlySalary(dailySalary)

  const absentDeduction = absentCount * dailySalary
  const halfDayDeduction = halfDayCount * HALF_DAY_DEDUCTION_HOURS * hourlySalary
  const lateDeduction = lateDeductionHours * hourlySalary
  const earlyDeduction = earlyDeductionHours * hourlySalary
  const totalDeduction = absentDeduction + halfDayDeduction + lateDeduction + earlyDeduction

  return {
    dailySalary,
    hourlySalary,
    absentDeduction,
    halfDayDeduction,
    lateDeduction,
    earlyDeduction,
    totalDeduction,
    netPayable: Math.max(0, salary - totalDeduction),
  }
}

// Flags when an employee-month's recorded days exceed the calendar days in
// that month — a data-integrity signal (e.g. duplicate-date records slipping
// past the upsert merge), never expected to fire under normal operation.
export const validateAttendanceIntegrity = ({
  presentCount,
  absentCount,
  halfDayCount = 0,
  leaveCount,
  weeklyOffCount,
  holidayCount,
  daysInMonth,
}) => {
  const total =
    presentCount + absentCount + halfDayCount + leaveCount + weeklyOffCount + holidayCount
  return {
    total,
    daysInMonth,
    valid: total <= daysInMonth,
    overBy: Math.max(0, total - daysInMonth),
  }
}

// Working-days coverage for a month: how many non-holiday calendar dates
// actually have at least one attendance record, and which are still missing.
export const computeMonthCoverage = (allDatesInMonth, defaultHolidayDateSet, recordedDateSet) => {
  const workingDates = allDatesInMonth.filter((d) => !defaultHolidayDateSet.has(d))
  const coveredWorkingDates = workingDates.filter((d) => recordedDateSet.has(d))
  return {
    totalWorkingDays: workingDates.length,
    coveredWorkingDays: coveredWorkingDates.length,
    missingDates: workingDates.filter((d) => !recordedDateSet.has(d)),
    isComplete: coveredWorkingDates.length === workingDates.length,
  }
}

// Shared "HH:MM" <-> minutes-from-midnight helpers, so the new avg-check-in
// metric doesn't become a 3rd independent time parser in this module family.
export const parseTimeToMinutes = (hhmm) => {
  if (!hhmm) return null
  const parts = String(hhmm).split(':').map(Number)
  if (parts.some((n) => Number.isNaN(n))) return null
  return parts[0] * 60 + (parts[1] || 0)
}

export const formatMinutesAsTime = (minutes) => {
  if (minutes == null || Number.isNaN(minutes)) return null
  const total = Math.round(minutes)
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Lateness ground truth: a record's own in_time vs. the official shift start
// — NOT the punch machine's "Late By" export column, which has been found to
// sit blank for entire employees/shifts even when in_time is clearly late.
// Returns null (no opinion) when in_time itself is missing.
export const computeLateMinutes = (inTime, shiftStartTime = SHIFT_START_TIME) => {
  const inMinutes = parseTimeToMinutes(inTime)
  const startMinutes = parseTimeToMinutes(shiftStartTime)
  if (inMinutes == null || startMinutes == null) return null
  return Math.max(0, inMinutes - startMinutes)
}

// Earliness ground truth: a record's own out_time vs. the official shift end
// — same rationale as computeLateMinutes (the punch machine's own "Early By"
// column is not trusted as the source of truth). Returns null when out_time
// itself is missing.
export const computeEarlyMinutes = (outTime, shiftEndTime = SHIFT_END_TIME) => {
  const outMinutes = parseTimeToMinutes(outTime)
  const endMinutes = parseTimeToMinutes(shiftEndTime)
  if (outMinutes == null || endMinutes == null) return null
  return Math.max(0, endMinutes - outMinutes)
}
