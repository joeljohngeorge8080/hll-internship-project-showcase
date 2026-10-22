import React from 'react'
import { MODULE } from '../constants/modules'
import Placeholder from '../views/Placeholder'

const PmsDashboard = React.lazy(() => import('../modules/pms/dashboard/PmsDashboard'))

// Project management pages
const MyProjectsPage = React.lazy(() => import('../modules/pms/projects/MyProjectsPage'))
const CreateProjectPage = React.lazy(() => import('../modules/pms/projects/CreateProjectPage'))
const ProjectDetailPage = React.lazy(() => import('../modules/pms/projects/ProjectDetailPage'))

const placeholder = (title, message) => {
  const Page = () => React.createElement(Placeholder, { title, message })
  Page.displayName = `Placeholder(${title})`
  return Page
}

// Project Associate pages
const ProjectAssociateDashboard = React.lazy(
  () => import('../modules/pms/project-associate/ProjectAssociateDashboard'),
)
const ProjectListPage = React.lazy(() => import('../modules/pms/project-associate/ProjectListPage'))
const ProjectFormPage = React.lazy(() => import('../modules/pms/project-associate/ProjectFormPage'))
const PAProjectDetailPage = React.lazy(
  () => import('../modules/pms/project-associate/ProjectDetailPage'),
)
const ProjectOfficersPage = React.lazy(
  () => import('../modules/pms/project-associate/ProjectOfficersPage'),
)
const TeamOverviewPage = React.lazy(
  () => import('../modules/pms/project-associate/TeamOverviewPage'),
)

// Daily Reports lazy-loaded components
const ReportSubmitPage = React.lazy(() => import('../modules/pms/daily-reports/ReportSubmitPage'))
const MyReportsPage = React.lazy(() => import('../modules/pms/daily-reports/MyReportsPage'))
const ReportEditPage = React.lazy(() => import('../modules/pms/daily-reports/ReportEditPage'))
const OfficerDashboardPage = React.lazy(
  () => import('../modules/pms/daily-reports/OfficerDashboardPage'),
)
const ReportDetailReviewPage = React.lazy(
  () => import('../modules/pms/daily-reports/ReportDetailReviewPage'),
)
const BackendReportsPage = React.lazy(
  () => import('../modules/pms/daily-reports/BackendReportsPage'),
)
const TaskManagementPage = React.lazy(
  () => import('../modules/pms/daily-reports/TaskManagementPage'),
)
const FieldPersonnelOverviewPage = React.lazy(
  () => import('../modules/pms/daily-reports/FieldPersonnelOverviewPage'),
)
const MyTasksPage = React.lazy(() => import('../modules/pms/daily-reports/MyTasksPage'))
const BeneficiaryPage = React.lazy(() => import('../modules/ems/beneficiary/BeneficiaryPage'))
const TaskReportSubmitPage = React.lazy(
  () => import('../modules/pms/daily-reports/TaskReportSubmitPage'),
)
const TaskReportEditPage = React.lazy(
  () => import('../modules/pms/daily-reports/TaskReportEditPage'),
)
const PersonnelLogPage = React.lazy(() => import('../modules/pms/daily-reports/PersonnelLogPage'))
const FieldPersonnelBillsPage = React.lazy(
  () => import('../modules/pms/daily-reports/FieldPersonnelBillsPage'),
)
const SettlementsPage = React.lazy(() => import('../modules/pms/daily-reports/SettlementsPage'))
const AuditLogsPage = React.lazy(() => import('../modules/ems/audit-logs/EmsAuditLogsPage'))

// LSGB
const LsgbSheetPage = React.lazy(() => import('../modules/pms/lsgb/LsgbSheetPage'))

// Donors
const DonorPage = React.lazy(() => import('../modules/pms/donors/DonorPage'))

// AI Assistant (shared with EMS)
const ChatPage = React.lazy(() => import('../modules/shared/ai-chat/ChatPage'))

export const pmsRoutes = [
  { path: '/', exact: true, name: 'Home' },
  {
    path: '/pms/dashboard',
    name: 'Dashboard',
    element: PmsDashboard,
    module: MODULE.PMS_DASHBOARD,
  },
  {
    path: '/pms/ai-chat',
    name: 'AI Assistant',
    element: ChatPage,
    module: MODULE.AI_CHAT,
  },

  // ── Project Associate Dashboard ───────────────────────────────────────────
  {
    path: '/pms/pa/dashboard',
    name: 'PA Dashboard',
    element: ProjectAssociateDashboard,
    module: MODULE.PMS_PROJECTS,
  },
  {
    path: '/pms/pa/team-overview',
    name: 'Team Overview',
    element: TeamOverviewPage,
    module: MODULE.PMS_PROJECTS,
  },

  // ── Projects ──────────────────────────────────────────────────────────────
  {
    path: '/pms/projects',
    name: 'Projects',
    element: ProjectListPage,
    module: MODULE.PMS_PROJECTS,
  },
  {
    path: '/pms/projects/my-projects',
    name: 'My Projects',
    element: MyProjectsPage,
    module: MODULE.PMS_PROJECTS,
  },
  {
    path: '/pms/projects/create',
    name: 'Create Project',
    element: ProjectFormPage,
    module: MODULE.PMS_PROJECTS,
  },
  {
    path: '/pms/projects/archive',
    name: 'Archive',
    element: placeholder('Project Archive'),
    module: MODULE.PMS_PROJECTS,
  },
  {
    path: '/pms/projects/:id/edit',
    name: 'Edit Project',
    element: ProjectFormPage,
    module: MODULE.PMS_PROJECTS,
  },
  {
    path: '/pms/projects/:id',
    name: 'Project Detail',
    element: PAProjectDetailPage,
    module: MODULE.PMS_PROJECTS,
  },

  {
    path: '/pms/project-lifecycle/pipeline',
    name: 'Pipeline',
    element: placeholder('Pipeline'),
    module: MODULE.PMS_LIFECYCLE,
  },
  {
    path: '/pms/project-lifecycle/design',
    name: 'Design Phase',
    element: placeholder('Design Phase'),
    module: MODULE.PMS_LIFECYCLE,
  },
  {
    path: '/pms/project-lifecycle/implementation',
    name: 'Implementation',
    element: placeholder('Implementation'),
    module: MODULE.PMS_LIFECYCLE,
  },
  {
    path: '/pms/project-lifecycle/followup',
    name: 'Follow-up',
    element: placeholder('Follow-up'),
    module: MODULE.PMS_LIFECYCLE,
  },
  {
    path: '/pms/project-lifecycle/completed',
    name: 'Completed',
    element: placeholder('Completed Projects'),
    module: MODULE.PMS_LIFECYCLE,
  },

  {
    path: '/pms/project-expenses/entry',
    name: 'Expense Entry',
    element: placeholder('Expense Entry'),
    module: MODULE.PMS_EXPENSES,
  },
  {
    path: '/pms/project-expenses/history',
    name: 'Expense History',
    element: placeholder('Expense History'),
    module: MODULE.PMS_EXPENSES,
  },
  {
    path: '/pms/project-expenses/analysis',
    name: 'Expense Analysis',
    element: placeholder('Expense Analysis'),
    module: MODULE.PMS_EXPENSES,
  },
  {
    path: '/pms/project-expenses/documents',
    name: 'Expense Documents',
    element: placeholder('Expense Documents'),
    module: MODULE.PMS_EXPENSES,
  },

  {
    path: '/pms/project-documents/proposals',
    name: 'Proposals',
    element: placeholder('Proposals'),
    module: MODULE.PMS_DOCUMENTS,
  },
  {
    path: '/pms/project-documents/agreements',
    name: 'Agreements',
    element: placeholder('Agreements'),
    module: MODULE.PMS_DOCUMENTS,
  },
  {
    path: '/pms/project-documents/invoices',
    name: 'Invoices',
    element: placeholder('Invoices'),
    module: MODULE.PMS_DOCUMENTS,
  },
  {
    path: '/pms/project-documents/utilization-certificates',
    name: 'Utilization Certificates',
    element: placeholder('Utilization Certificates'),
    module: MODULE.PMS_DOCUMENTS,
  },
  {
    path: '/pms/project-documents/reports',
    name: 'Reports',
    element: placeholder('Document Reports'),
    module: MODULE.PMS_DOCUMENTS,
  },
  {
    path: '/pms/project-documents/other',
    name: 'Other Documents',
    element: placeholder('Other Documents'),
    module: MODULE.PMS_DOCUMENTS,
  },

  {
    path: '/pms/project-teams/officers',
    name: 'Project Officers',
    element: ProjectOfficersPage,
    module: MODULE.PMS_TEAMS,
  },
  {
    path: '/pms/project-teams/allocation',
    name: 'Employee Allocation',
    element: placeholder('Employee Allocation'),
    module: MODULE.PMS_TEAMS,
  },
  {
    path: '/pms/project-teams/history',
    name: 'Assignment History',
    element: placeholder('Assignment History'),
    module: MODULE.PMS_TEAMS,
  },

  {
    path: '/pms/project-locations/locations',
    name: 'Locations',
    element: placeholder('Locations'),
    module: MODULE.PMS_LOCATIONS,
  },
  {
    path: '/pms/project-locations/districts',
    name: 'Districts',
    element: placeholder('Districts'),
    module: MODULE.PMS_LOCATIONS,
  },
  {
    path: '/pms/project-locations/mapping',
    name: 'Location Mapping',
    element: placeholder('Location Mapping'),
    module: MODULE.PMS_LOCATIONS,
  },

  {
    path: '/pms/project-reports/project-wise',
    name: 'Project-wise Report',
    element: placeholder('Project-wise Report'),
    module: MODULE.PMS_REPORTS,
  },
  {
    path: '/pms/project-reports/overall',
    name: 'Overall Report',
    element: placeholder('Overall Report'),
    module: MODULE.PMS_REPORTS,
  },
  {
    path: '/pms/project-reports/monthly',
    name: 'Monthly Report',
    element: placeholder('Monthly Report'),
    module: MODULE.PMS_REPORTS,
  },
  {
    path: '/pms/project-reports/yearly',
    name: 'Yearly Report',
    element: placeholder('Yearly Report'),
    module: MODULE.PMS_REPORTS,
  },
  {
    path: '/pms/project-reports/exports',
    name: 'Exports',
    element: placeholder('Report Exports'),
    module: MODULE.PMS_REPORTS,
  },

  {
    path: '/pms/funding-agencies',
    name: 'Funding Agencies',
    element: DonorPage,
    module: MODULE.PMS_AGENCIES,
  },
  {
    path: '/pms/beneficiary',
    name: 'Beneficiary Records',
    element: BeneficiaryPage,
    module: MODULE.BENEFICIARY,
  },

  // ── Daily Reports ─────────────────────────────────────────────────────────
  {
    path: '/pms/daily-reports/new',
    name: 'Submit Report',
    element: ReportSubmitPage,
    module: MODULE.PMS_DAILY_REPORTS,
  },
  {
    path: '/pms/daily-reports/history',
    name: 'My Reports',
    element: MyReportsPage,
    module: MODULE.PMS_DAILY_REPORTS,
  },
  {
    path: '/pms/daily-reports/:id/edit',
    name: 'Edit Report',
    element: ReportEditPage,
    module: MODULE.PMS_DAILY_REPORTS,
  },
  {
    path: '/pms/daily-reports/review',
    name: 'Review Reports',
    element: OfficerDashboardPage,
    module: MODULE.PMS_DAILY_REPORTS,
  },
  {
    path: '/pms/daily-reports/review/:id',
    name: 'Report Detail',
    element: ReportDetailReviewPage,
    module: MODULE.PMS_DAILY_REPORTS,
  },
  {
    path: '/pms/daily-reports/approved',
    name: 'Approved Reports',
    element: BackendReportsPage,
    module: MODULE.PMS_DAILY_REPORTS,
  },
  {
    path: '/pms/daily-reports/tasks',
    name: 'Assign Tasks',
    element: TaskManagementPage,
    module: MODULE.PMS_DAILY_REPORTS,
  },
  {
    path: '/pms/daily-reports/team',
    name: 'My Team',
    element: FieldPersonnelOverviewPage,
    module: MODULE.PMS_DAILY_REPORTS,
  },
  {
    path: '/pms/daily-reports/my-tasks',
    name: 'My Tasks',
    element: MyTasksPage,
    module: MODULE.PMS_DAILY_REPORTS,
  },
  {
    path: '/pms/tasks/report/:id',
    name: 'Task Report',
    element: TaskReportSubmitPage,
    module: MODULE.PMS_DAILY_REPORTS,
  },
  {
    path: '/pms/tasks/report/:taskId/edit/:reportId',
    name: 'Edit Task Report',
    element: TaskReportEditPage,
    module: MODULE.PMS_DAILY_REPORTS,
  },
  {
    path: '/pms/daily-reports/personnel-log',
    name: 'Personnel Log',
    element: PersonnelLogPage,
    module: MODULE.PMS_DAILY_REPORTS,
  },
  {
    path: '/pms/field-personnel/bills',
    name: 'Upload Bills',
    element: FieldPersonnelBillsPage,
    module: MODULE.PMS_DAILY_REPORTS,
  },

  // ── Settlements & Merged Reports ──────────────────────────────────────────
  {
    path: '/pms/settlements',
    name: 'Settlements',
    element: SettlementsPage,
    module: MODULE.PMS_SETTLEMENTS,
  },

  {
    path: '/pms/audit-logs',
    name: 'Audit Logs',
    element: AuditLogsPage,
    module: MODULE.AUDIT_LOGS,
  },

  // ── LSGB Projects ─────────────────────────────────────────────────────────
  {
    path: '/pms/lsgb',
    name: 'LSGB Projects',
    element: LsgbSheetPage,
    module: MODULE.PMS_PROJECTS,
  },
]

export default pmsRoutes
