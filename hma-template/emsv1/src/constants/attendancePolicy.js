// Attendance business-rule constants (previously duplicated independently in
// localAttendance.js and AttendanceImport.jsx, and baked as magic numbers
// into DeductionSummary.jsx / attendanceRevenue.js / CorePoolPage.jsx).
export const FREE_LATE_UNITS = 7 // free late units per month, no carry-forward
export const LATE_UNIT_MIN = 15 // 1 unit = 15 minutes — gates WHEN the free pool is used up
// >120 min late while Present → Half Day (priority rule), independent of
// whether the free pool is exhausted. 11:16 AM onward (SHIFT_START + 121min).
export const HALF_DAY_THRESHOLD_MIN = 120
export const HALF_DAY_DEDUCTION_HOURS = 4 // Half Day = 4 hrs deduction (= half an 8-hr day)

// Late-entry bracket schedule for days AFTER the 7 free units are exhausted:
// deductionHours = ceil(lateMinutes / 30) * 0.5, i.e. 9:16-9:45 → 0.5hr,
// 9:46-10:15 → 1hr, 10:16-10:45 → 1.5hr, 10:46-11:15 → 2hr. Beyond 120 min
// (11:16+) the record is already reclassified to Half Day above instead.
export const LATE_BRACKET_MIN = 30
export const LATE_BRACKET_HOURS = 0.5

// Early punch-out: 1 hour (60 min) free per month, mirroring the late-entry
// free-unit pool but tracked in raw minutes (no 15-min quantization).
export const FREE_EARLY_OUT_MINUTES = 60
// >120 min early (before 3:45 PM, i.e. SHIFT_END - 121min) while Present →
// Half Day, same priority-rule pattern as late-entry.
export const EARLY_OUT_HALF_DAY_THRESHOLD_MIN = 120
// Bracket schedule for early-outs after the free 60 minutes are used up:
// deductionHours = ceil(earlyMinutes / 60), i.e. up to 1hr early → 1hr,
// up to 2hr early → 2hr deducted (beyond that, reclassified to Half Day above).
export const EARLY_OUT_BRACKET_MIN = 60
export const EARLY_OUT_BRACKET_HOURS = 1

// Official shift window ("09:15 AM – 05:45 PM" per docs/03_Business_Rules.md).
// Lateness/earliness are derived from a record's own in_time/out_time against
// these, NOT from the punch machine's own "Late By"/"Early By" export columns
// — those have been found to sit blank or unreliable even when the punch
// times themselves are clearly past the official window.
export const SHIFT_START_TIME = '09:15'
export const SHIFT_END_TIME = '17:45'

// Wizard-preview-only rule (AttendanceImport.jsx generateRemarks/effective_absent).
// Not part of the unified deduction formula in attendanceCalc.js — none of the
// production formulas fold excess leave into absent days.
export const CL_MONTHLY_LIMIT = 1
