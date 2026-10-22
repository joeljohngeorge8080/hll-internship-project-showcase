/**
 * attendanceRevenue.js — Attendance Deduction Pool (TPC only).
 *
 * When a TPC (Third Party Contract) staff member is Absent, takes a
 * Half-Day, or accumulates excess Late units, the salary not paid out is
 * retained by the company and tracked here as a separate revenue pool.
 * Only TPC-category employees contribute — Permanent/FTC deductions are
 * surfaced as "savings" elsewhere but are NOT pooled as revenue.
 *
 * Deduction formula matches Attendance → Deductions exactly (via the shared
 * attendanceCalc.computeAttendanceDeduction):
 *   per-day rate  = monthly salary ÷ (present + absent + weekly-off days)
 *   absent        = absent days × per-day rate
 *   half-day      = half-day count × 4 × hourly rate (>120 min late or early-out)
 *   late          = bracket rate for late days beyond the 7 free units
 *   early-out     = bracket rate for early-out days beyond the 60 free minutes
 * Paid leave (CL/SL/OD/COFF) is never deducted.
 */

import { localAttendance } from './localAttendance'
import { localEmployees } from './localEmployees'
import { computeAttendanceDeduction } from './attendanceCalc'

const isTPC = (emp) => (emp.employee_category || emp.employment?.employee_category || '') === 'TPC'

const computeDeduction = (salary, summary) => {
  if (!summary || salary <= 0) {
    return {
      absentDeduction: 0,
      halfDayDeduction: 0,
      lateDeduction: 0,
      earlyDeduction: 0,
      totalDeduction: 0,
    }
  }
  const { absentDeduction, halfDayDeduction, lateDeduction, earlyDeduction, totalDeduction } =
    computeAttendanceDeduction({
      salary,
      presentCount: summary.present_count || 0,
      absentCount: summary.absent_count || 0,
      weeklyOffCount: summary.weekly_off_count || 0,
      halfDayCount: summary.half_day_count || 0,
      lateDeductionHours: summary.late_deduction_hours || 0,
      earlyDeductionHours: summary.early_deduction_hours || 0,
    })
  return { absentDeduction, halfDayDeduction, lateDeduction, earlyDeduction, totalDeduction }
}

const tpcEmployees = async () => {
  const { items } = await localEmployees.list({ pageSize: 1000 })
  return items.filter(isTPC)
}

export const attendanceRevenue = {
  /**
   * TPC deduction pool for one month.
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async getMonthlyPool(year, month) {
    const employees = await tpcEmployees()
    const summaries = await localAttendance.listMonthlySummaries({ year, month })
    const byEmpId = {}
    summaries.forEach((s) => {
      byEmpId[s.employee_id] = s
    })

    const rows = employees
      .map((emp) => {
        const salary = parseFloat(emp.current_salary || 0)
        const summary = byEmpId[emp.employee_id]
        const d = computeDeduction(salary, summary)
        return {
          employee_id: emp.employee_id,
          employee_name: emp.employee_name,
          designation: emp.employment?.designation || '',
          salary,
          absent_count: summary?.absent_count || 0,
          half_day_count: summary?.half_day_count || 0,
          excess_late_units: summary?.excess_late_units || 0,
          ...d,
        }
      })
      .filter((r) => r.totalDeduction > 0)
      .sort((a, b) => b.totalDeduction - a.totalDeduction)

    const total = rows.reduce((s, r) => s + r.totalDeduction, 0)
    return { rows, total: Math.round(total * 100) / 100 }
  },

  /**
   * Cumulative TPC pool balance across every month with attendance data.
   * @returns {Promise<{ total: number, months: Array<{ year, month, total }> }>}
   */
  async getTotalPool() {
    const allSummaries = await localAttendance.listMonthlySummaries()
    const monthKeys = new Set(allSummaries.map((s) => `${s.year}-${s.month}`))

    const months = (
      await Promise.all(
        [...monthKeys].map(async (key) => {
          const [year, month] = key.split('-').map(Number)
          const { total } = await this.getMonthlyPool(year, month)
          return { year, month, total }
        }),
      )
    )
      .filter((m) => m.total > 0)
      .sort((a, b) => a.year - b.year || a.month - b.month)

    const total = months.reduce((s, m) => s + m.total, 0)
    return { total: Math.round(total * 100) / 100, months }
  },
}
