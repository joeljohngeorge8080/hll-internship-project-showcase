/**
 * localPayroll.js — Payroll utilities for Project Budget & Overhead tracking.
 *
 * Provides:
 *  - splitSalaryByProject()     — proportional salary split across projects
 *  - getAllEmployeesWithProjectInfo() — all employees enriched with project counts
 *  - getProjectEmployees()      — employees actively assigned to a specific project
 *  - computeCoreDeductions()    — salary deductions from core pool per installment
 *  - suggestRecurringAmount()   — ±5% suggestion for recurring admin expenses
 *  - getCorePoolSummary()       — overview of core pool usage for an installment
 *
 * "Assigned to a project" is derived live from Supabase (projects.project_associate_id
 * and project_officer_assignments), not from a per-employee project_assignments array —
 * that array was a localStorage-era artifact (Project Officer/Associate assignment now
 * lives on the projects/project_officer_assignments tables themselves, see
 * localProjects.js's assignOfficers()/create()), so this store always reflects the
 * current HR/PC/PA assignment state instead of a snapshot that only updates when
 * someone edits the employee record directly.
 */

import { localEmployees } from './localEmployees'
import { localProjects } from './localProjects'

// ─── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Count months between two date strings (inclusive). Only the year/month
 * components are used, so full "YYYY-MM-DD" dates work the same as "YYYY-MM".
 * e.g. monthsBetween('2026-01', '2026-04') === 4
 */
const monthsBetween = (startMonth, endMonth) => {
  if (!startMonth || !endMonth) return 1
  const [sy, sm] = startMonth.split('-').map(Number)
  const [ey, em] = endMonth.split('-').map(Number)
  return Math.max(1, (ey - sy) * 12 + (em - sm) + 1)
}

const fetchEmployeesAndProjects = async () => {
  const [{ items: employees }, { items: projects }] = await Promise.all([
    localEmployees.list({ pageSize: 1000, includeDeleted: false }),
    localProjects.list({ pageSize: 9999 }),
  ])
  return { employees, projects }
}

/** Projects an employee is currently assigned to, as Project Officer or Project Associate. */
const projectsForEmployee = (employeeId, projects) =>
  projects.filter(
    (p) => p.project_associate_id === employeeId || (p.officer_ids || []).includes(employeeId),
  )

// ─── Public API ────────────────────────────────────────────────────────────────

export const localPayroll = {
  /**
   * Split an employee's salary proportionally across projects by project value.
   * @param {number} salary
   * @param {number[]} projectValues
   * @returns {number[]} deductions per project (same order as projectValues)
   *
   * @example
   * splitSalaryByProject(35000, [20000000, 1000000, 5000000])
   * // → [26923.07, 1346.15, 6730.76]
   */
  splitSalaryByProject(salary, projectValues) {
    const total = projectValues.reduce((s, v) => s + v, 0)
    if (total === 0) return projectValues.map(() => 0)
    return projectValues.map((v) => salary * (v / total))
  },

  /**
   * Returns ALL employees enriched with:
   *  - activeProjectCount  (number of projects currently assigned, as PO or PA)
   *  - activeProjectNames  (string[])
   *  - activeProjectIds    (string[])
   *  - isOverhead          (true when activeProjectCount === 0)
   */
  async getAllEmployeesWithProjectInfo() {
    const { employees, projects } = await fetchEmployeesAndProjects()

    return employees.map((emp) => {
      const empProjects = projectsForEmployee(emp.id, projects)
      return {
        ...emp,
        activeProjectCount: empProjects.length,
        activeProjectNames: empProjects.map((p) => p.name),
        activeProjectIds: empProjects.map((p) => p.id),
        activeProjectValues: empProjects.map((p) => p.project_value),
        isOverhead: empProjects.length === 0,
      }
    })
  },

  /** Returns employees currently assigned (as PO or PA) to a specific project. */
  async getProjectEmployees(projectId) {
    const { employees, projects } = await fetchEmployeesAndProjects()
    const project = projects.find((p) => p.id === projectId)
    if (!project) return []
    return employees.filter((emp) =>
      projectsForEmployee(emp.id, projects).some((p) => p.id === projectId),
    )
  },

  /**
   * Computes how much of each project-assigned employee's salary should be
   * deducted from THIS project's core pool.
   *
   * Logic:
   *  1. Get all employees assigned to this project.
   *  2. For each employee, for EVERY project they're currently assigned to, compute its MONTHLY RATE:
   *       monthly_rate = project.value / project_duration_months
   *  3. Use splitSalaryByProject() with these monthly rates as weights.
   *  4. Multiply the resulting monthly share by THIS project's month count.
   *
   * @returns {Promise<Array<{ employee, monthlyShare, projectMonths, totalDeduction, allActiveProjects, allMonthlyRates }>>}
   */
  async computeCoreDeductions(projectId) {
    const { employees, projects } = await fetchEmployeesAndProjects()
    const thisProject = projects.find((p) => p.id === projectId)
    if (!thisProject) return []

    const projectMonths = Math.max(monthsBetween(thisProject.start_date, thisProject.end_date), 1)

    const getMonthlyRate = (proj) => {
      const months = Math.max(monthsBetween(proj.start_date, proj.end_date), 1)
      return (proj.project_value || 0) / months
    }

    const deductions = []

    employees.forEach((emp) => {
      const empProjects = projectsForEmployee(emp.id, projects)
      const isOnThisProject = empProjects.some((p) => p.id === projectId)
      if (!isOnThisProject) return

      const salary = parseFloat(emp.current_salary) || 0
      if (salary <= 0) return

      const allMonthlyRates = empProjects.map(getMonthlyRate)
      const thisIdx = empProjects.findIndex((p) => p.id === projectId)

      const splits = localPayroll.splitSalaryByProject(salary, allMonthlyRates)
      const monthlyShare = splits[thisIdx] ?? salary
      const totalDeduction = monthlyShare * projectMonths

      deductions.push({
        employee: emp,
        salary,
        allActiveProjects: empProjects.map((p) => p.name),
        allMonthlyRates: allMonthlyRates.map((r) => Math.round(r * 100) / 100),
        monthlyShare: Math.round(monthlyShare * 100) / 100,
        projectMonths: projectMonths,
        totalDeduction: Math.round(totalDeduction * 100) / 100,
      })
    })

    return deductions
  },

  /**
   * Returns a suggested amount for a recurring admin expense type,
   * based on the previous expense of matching type ± 5%.
   *
   * The Supabase project_expenses table (unlike the old localStorage
   * admin_expenses array) doesn't carry an is_recurring/recurring_type flag,
   * so there's no longer a signal to find "the previous expense of this
   * type" from. Always returns no suggestion until that metadata exists.
   */

  suggestRecurringAmount(projectId, recurringType) {
    return { suggested: null, prevAmount: null, trend: null }
  },

  /**
   * Returns a summary of the global core pool usage for the project.
   */
  async getCorePoolSummary(projectId) {
    const { items: projects } = await localProjects.list({ pageSize: 9999 })
    const project = projects.find((p) => p.id === projectId)
    if (!project) return { allocated: 0, used: 0, remaining: 0, deductions: [] }

    const deductions = await localPayroll.computeCoreDeductions(projectId)
    const projectValue = project.project_value || 0
    const allocated = projectValue * ((project.core_pct ?? 5) / 100)
    const used = deductions.reduce((s, d) => s + d.totalDeduction, 0)
    const remaining = allocated - used

    return {
      allocated: Math.round(allocated * 100) / 100,
      used: Math.round(used * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      deductions,
    }
  },
}
