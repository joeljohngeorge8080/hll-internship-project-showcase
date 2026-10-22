// attendanceReportSections.js — Reports-hub section builder for the
// Attendance report. Reuses localAttendance's existing org-wide
// aggregation functions (no re-derivation of attendance math) and joins
// employee name/department from localEmployees for display.
import { localAttendance } from './localAttendance'
import { localEmployees } from './localEmployees'

export const buildAttendanceSections = async ({ year, month }) => {
  const [summaries, aggregate, coverage, warnings, { items: employees }] = await Promise.all([
    localAttendance.listMonthlySummaries({ year, month }),
    localAttendance.getMonthlySummaryAggregate(year, month),
    localAttendance.getMonthCoverage(year, month),
    localAttendance.getIntegrityWarnings(year, month),
    localEmployees.list({ status: 'Active', pageSize: 2000 }),
  ])

  const byCode = Object.fromEntries(employees.map((e) => [e.employee_id, e]))

  return [
    {
      key: 'aggregate',
      title: 'Org-Wide Aggregate',
      kv: aggregate
        ? [
            ['Total Employees', aggregate.total_employees],
            ['Clean Records (no absence/late)', aggregate.clean_count],
            ['Employees with Absences', aggregate.has_absent],
            ['Employees with Late Days', aggregate.has_late],
            ['Employees with Leave', aggregate.has_leave],
            ['Total Absent Days (org-wide)', aggregate.total_absent_days],
            ['Total Late Days (org-wide)', aggregate.total_late_days],
          ]
        : [],
    },
    {
      key: 'perEmployee',
      title: 'Per-Employee Monthly Summary',
      headers: [
        'Employee',
        'Department',
        'Present',
        'Absent',
        'Half-Day',
        'Weekly Off',
        'Holiday',
        'Leave',
        'Late Days',
        'Overtime (min)',
        'Avg Hours',
      ],
      rows: summaries.map((s) => {
        const emp = byCode[s.employee_id]
        return [
          emp?.employee_name || s.employee_id,
          emp?.employment?.department || '—',
          s.present_count,
          s.absent_count,
          s.half_day_count,
          s.weekly_off_count,
          s.holiday_count,
          s.leave_count,
          s.late_days,
          s.total_overtime ?? '—',
          s.avg_working_hours ?? '—',
        ]
      }),
      currencyCols: [],
    },
    {
      key: 'integrity',
      title: 'Data Integrity & Coverage',
      kv: [
        ['Working Days in Month', coverage.totalWorkingDays],
        ['Working Days Covered', coverage.coveredWorkingDays],
        ['Coverage Complete', coverage.isComplete ? 'Yes' : 'No'],
        ['Missing Dates', coverage.missingDates.length ? coverage.missingDates.join(', ') : 'None'],
      ],
      headers: ['Employee', 'Total Days Recorded', 'Days in Month', 'Over By'],
      rows: warnings.map((w) => {
        const emp = byCode[w.employee_id]
        return [emp?.employee_name || w.employee_id, w.total, w.daysInMonth, w.overBy]
      }),
      tableTitle: 'Employees with Inconsistent Day Counts',
      currencyCols: [],
    },
  ]
}

export const ATTENDANCE_SECTION_DEFS = [
  { key: 'aggregate', label: 'Org-Wide Aggregate' },
  { key: 'perEmployee', label: 'Per-Employee Monthly Summary' },
  { key: 'integrity', label: 'Data Integrity & Coverage' },
]
