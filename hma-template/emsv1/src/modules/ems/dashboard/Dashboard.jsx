import React, { useState, lazy } from 'react'
import { CButton } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSettings } from '@coreui/icons'

import useDashboardWidgets from '../../../components/dashboard/useDashboardWidgets'
import DashboardGrid from '../../../components/dashboard/DashboardGrid'
import WidgetCatalog from '../../../components/dashboard/WidgetCatalog'

// ── Existing widgets (lazy-loaded for faster initial render) ───────────────────
const EmployeeStatsWidget = lazy(() => import('./widgets/EmployeeStatsWidget'))
const AttendanceSummaryWidget = lazy(() => import('./widgets/AttendanceSummaryWidget'))
const GeneralExpenseWidget = lazy(() => import('./widgets/GeneralExpenseWidget'))
const ExpenseByCategoryWidget = lazy(() => import('./widgets/ExpenseByCategoryWidget'))
const PayrollSummaryWidget = lazy(() => import('./widgets/PayrollSummaryWidget'))
const AnnouncementsWidget = lazy(() => import('./widgets/AnnouncementsWidget'))
const ExpensePoolsWidget = lazy(() => import('./widgets/ExpensePoolsWidget'))
const GlobalCorePoolWidget = lazy(() => import('./widgets/GlobalCorePoolWidget'))
const ExpenseManagementWidget = lazy(() => import('./widgets/ExpenseManagementWidget'))
const DepartmentHeadcountWidget = lazy(() => import('./widgets/DepartmentHeadcountWidget'))
const AttendanceTrendWidget = lazy(() => import('./widgets/AttendanceTrendWidget'))
const ProjectsOverviewWidget = lazy(() => import('./widgets/ProjectsOverviewWidget'))
const ProfitLossWidget = lazy(() => import('./widgets/ProfitLossWidget'))
const ProjectStatusWidget = lazy(() => import('./widgets/ProjectStatusWidget'))
const ConsolidatedBudgetWidget = lazy(() => import('./widgets/ConsolidatedBudgetWidget'))

// ── New CEO-facing widgets ─────────────────────────────────────────────────────
const OrgHealthWidget = lazy(() => import('./widgets/OrgHealthWidget'))
const MonthAtGlanceWidget = lazy(() => import('./widgets/MonthAtGlanceWidget'))
const MoneyFlowWidget = lazy(() => import('./widgets/MoneyFlowWidget'))
const BudgetAlertsWidget = lazy(() => import('./widgets/BudgetAlertsWidget'))
const RevenueVsSpendWidget = lazy(() => import('./widgets/RevenueVsSpendWidget'))
const TopProjectsWidget = lazy(() => import('./widgets/TopProjectsWidget'))
const UpcomingDeadlinesWidget = lazy(() => import('./widgets/UpcomingDeadlinesWidget'))
const InstallmentStatusWidget = lazy(() => import('./widgets/InstallmentStatusWidget'))

// ── Super Forecasting widgets (Reports & Analysis › Super Forecasting) ────────
const ExpenseHealthWidget = lazy(() => import('./widgets/ExpenseHealthWidget'))
const HRPerformanceWidget = lazy(() => import('./widgets/HRPerformanceWidget'))

/**
 * Widget registry — ordered in CEO-friendly top-to-bottom flow:
 *
 * 1. Organisation Health (hero banner — full width)
 * 2. This Month at a Glance
 * 3. Project Status
 * 4. Budget Alerts
 * 5. Expense Health Check / How Is HR Doing? (from Super Forecasting)
 * 6. Where Does Every Rupee Go? (donut)
 * 7. Budget Tracker (consolidated sheet)
 * 8. Revenue vs Spend (bar chart)
 * 9. Top Projects by Value
 * 10. Upcoming Deadlines
 * 11. Installment Money Tracker
 * 12. Payroll Summary
 * 13. Employee Overview
 * 14. Department Headcount
 * 15. Profit / Loss (detailed)
 * 16. Announcements
 * ── Advanced / technical (hidden from CEO view by default, available via Customize) ──
 * 17. Expense Pools
 * 18. Global Core Pool
 * 19. Expense Management
 * 20. Expenses by Category
 * 21. General Expenses
 * 22. Projects Overview
 * 23. Attendance Summary
 * 24. Attendance Trend
 */
const ALL_WIDGETS = [
  // ── ROW 1: Hero ──────────────────────────────────────────────────────────────
  {
    id: 'org_health',
    title: 'Organisation Health',
    description: 'Overall health score — green/yellow/red verdict + quick stats at a glance',
    colProps: { xs: 12 },
    badge: { label: 'CEO', color: 'danger' },
    component: OrgHealthWidget,
  },

  // ── ROW 2: Month + Project Status + Budget Alerts ─────────────────────────────
  {
    id: 'month_at_glance',
    title: 'This Month at a Glance',
    description: '3 giant numbers: total spend, payroll, and active projects this month',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'CEO', color: 'danger' },
    component: MonthAtGlanceWidget,
  },
  {
    id: 'project_status',
    title: 'Project Status',
    description: 'Status cards: Running / Approved / Done / Planned — from Consolidated Sheet',
    colProps: { xs: 12, sm: 6, xl: 5 },
    badge: { label: 'Projects', color: 'warning' },
    component: ProjectStatusWidget,
  },
  {
    id: 'budget_alerts',
    title: 'Budget Alerts',
    description: 'Auto-flags any project or category over 85% of budget — or shows green All Clear',
    colProps: { xs: 12, sm: 6, xl: 4 },
    badge: { label: 'Finance', color: 'success' },
    component: BudgetAlertsWidget,
  },

  // ── ROW 2.5: Super Forecasting highlights ─────────────────────────────────────
  {
    id: 'expense_health',
    title: 'Expense Health Check',
    description: 'Expense counts and HR/Admin/Core budget status — from Super Forecasting',
    colProps: { xs: 12, sm: 6, xl: 4 },
    badge: { label: 'Finance', color: 'success' },
    component: ExpenseHealthWidget,
  },
  {
    id: 'hr_performance',
    title: 'How Is HR Doing?',
    description: 'HR revenue vs HR’s own cost, as a coverage % — from Super Forecasting',
    colProps: { xs: 12, sm: 6, xl: 4 },
    badge: { label: 'HR', color: 'primary' },
    component: HRPerformanceWidget,
  },

  // ── ROW 3: Money flow + Consolidated Budget ────────────────────────────────────
  {
    id: 'money_flow',
    title: 'Spending Breakdown',
    description: 'Donut chart — where every rupee goes: Projects vs Salaries vs Admin vs HR',
    colProps: { xs: 12, sm: 6, xl: 4 },
    badge: { label: 'Finance', color: 'success' },
    component: MoneyFlowWidget,
  },
  {
    id: 'consolidated_budget',
    title: 'Budget Tracker',
    description: 'Consolidated Sheet budget vs used per expense type (Admin/HR/Core/Direct)',
    colProps: { xs: 12, sm: 6, xl: 4 },
    badge: { label: 'Finance', color: 'success' },
    component: ConsolidatedBudgetWidget,
  },
  {
    id: 'revenue_vs_spend',
    title: 'Revenue vs Spend',
    description: 'Monthly side-by-side bar chart: how much HMA earns vs spends each month',
    colProps: { xs: 12, sm: 6, xl: 4 },
    badge: { label: 'Finance', color: 'success' },
    component: RevenueVsSpendWidget,
  },

  // ── ROW 4: Projects ───────────────────────────────────────────────────────────
  {
    id: 'top_projects',
    title: 'Top Projects by Value',
    description: 'Ranked list of biggest projects by ₹ value with location and status',
    colProps: { xs: 12, lg: 6 },
    badge: { label: 'Projects', color: 'warning' },
    component: TopProjectsWidget,
  },
  {
    id: 'upcoming_deadlines',
    title: 'Upcoming Deadlines',
    description: 'Project end dates and installment due dates in the next 60 days',
    colProps: { xs: 12, sm: 6, lg: 3 },
    badge: { label: 'Projects', color: 'warning' },
    component: UpcomingDeadlinesWidget,
  },
  {
    id: 'installment_status',
    title: 'Money Received vs Pending',
    description: 'Total sanctioned vs received vs still pending across all projects',
    colProps: { xs: 12, sm: 6, lg: 3 },
    badge: { label: 'Finance', color: 'success' },
    component: InstallmentStatusWidget,
  },

  // ── ROW 5: People & Finance ───────────────────────────────────────────────────
  {
    id: 'payroll_summary',
    title: 'Payroll Summary',
    description: 'Monthly payroll total, average salary, breakdown by department',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Finance', color: 'success' },
    component: PayrollSummaryWidget,
  },
  {
    id: 'employee_stats',
    title: 'Employee Overview',
    description: 'Total, active, inactive, and on-project employee counts',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'HR', color: 'primary' },
    component: EmployeeStatsWidget,
  },
  {
    id: 'department_headcount',
    title: 'Department Headcount',
    description: 'Active employees by department',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'HR', color: 'primary' },
    component: DepartmentHeadcountWidget,
  },
  {
    id: 'profit_loss',
    title: 'Profit / Loss',
    description: 'Expenses vs own revenue — how much must come from Govt Grants',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Finance', color: 'success' },
    component: ProfitLossWidget,
  },

  // ── ROW 6: Communications ─────────────────────────────────────────────────────
  {
    id: 'announcements',
    title: 'Recent Announcements',
    description: 'Latest announcements and notices from leadership',
    colProps: { xs: 12, lg: 6 },
    badge: { label: 'Comms', color: 'info' },
    component: AnnouncementsWidget,
  },

  // ── Advanced / technical ──────────────────────────────────────────────────────
  {
    id: 'expense_pools',
    title: 'Expence Booking',
    description: 'HR / Admin / Core monthly pool budget vs used',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Finance', color: 'success' },
    component: ExpensePoolsWidget,
  },
  {
    id: 'global_core_pool',
    title: 'Global Core Pool',
    description: 'Unassigned vs assigned employee salary totals',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Finance', color: 'success' },
    component: GlobalCorePoolWidget,
  },
  {
    id: 'expense_management',
    title: 'Expense Management',
    description: 'Admin/HR/Core/Direct budget vs used, across all projects',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Finance', color: 'success' },
    component: ExpenseManagementWidget,
  },
  {
    id: 'expense_by_category',
    title: 'Expenses by Category',
    description: 'Top expense categories with relative spend comparison',
    colProps: { xs: 12, lg: 6 },
    badge: { label: 'Finance', color: 'success' },
    component: ExpenseByCategoryWidget,
  },
  {
    id: 'general_expense',
    title: 'General Expenses',
    description: 'YTD planned vs actual spend, this month total, budget utilisation',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Finance', color: 'success' },
    component: GeneralExpenseWidget,
  },
  {
    id: 'projects_overview',
    title: 'Projects Overview',
    description: 'Total projects, value, and beneficiaries (live data)',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Projects', color: 'warning' },
    component: ProjectsOverviewWidget,
  },
  {
    id: 'attendance_summary',
    title: 'Attendance Summary',
    description: 'Present / absent / late / leave counts for this month',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'HR', color: 'primary' },
    component: AttendanceSummaryWidget,
  },
  {
    id: 'attendance_trend',
    title: 'Attendance Trend',
    description: '6-month trailing present/absent/leave rate chart',
    colProps: { xs: 12, lg: 6 },
    badge: { label: 'HR', color: 'primary' },
    component: AttendanceTrendWidget,
  },
]

// ── CEO default set: only the most important widgets active by default ──────────
// Technical/ops widgets are in the catalog but off by default.
const CEO_DEFAULT_IDS = [
  'org_health',
  'month_at_glance',
  'project_status',
  'budget_alerts',
  'expense_health',
  'hr_performance',
  'money_flow',
  'consolidated_budget',
  'revenue_vs_spend',
  'top_projects',
  'upcoming_deadlines',
  'installment_status',
  'payroll_summary',
  'employee_stats',
  'department_headcount',
  'profit_loss',
  'announcements',
]

const Dashboard = () => {
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [renderedCount, setRenderedCount] = useState(0)
  const { activeIds, activeWidgets, toggleWidget, resetWidgets } = useDashboardWidgets(
    'ems_ceo_v2', // new key → forces fresh defaults with CEO layout
    ALL_WIDGETS,
    CEO_DEFAULT_IDS,
  )

  return (
    <>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="fw-bold mb-1">EMS Dashboard</h4>
          <p className="text-body-secondary mb-0 small">
            {renderedCount} of {activeWidgets.length} active widgets showing data
          </p>
        </div>
        <CButton color="secondary" variant="outline" size="sm" onClick={() => setCatalogOpen(true)}>
          <CIcon icon={cilSettings} className="me-1" size="sm" />
          Customize
        </CButton>
      </div>

      <DashboardGrid activeWidgets={activeWidgets} onRenderedCountChange={setRenderedCount} />

      <WidgetCatalog
        visible={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        allWidgets={ALL_WIDGETS}
        activeIds={activeIds}
        onToggle={toggleWidget}
        onReset={resetWidgets}
      />
    </>
  )
}

export default Dashboard
