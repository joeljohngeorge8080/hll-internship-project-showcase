import React from 'react'
import { MODULE } from '../constants/modules'

const UserManagementPage = React.lazy(
  () => import('../modules/ems/user-management/UserManagementPage'),
)
const AdminSettingsPage = React.lazy(() => import('../modules/ems/admin/AdminSettingsPage'))
const CeoAnnouncementsPage = React.lazy(
  () => import('../modules/ems/announcements/CeoAnnouncementsPage'),
)
const AnnouncementsInboxPage = React.lazy(
  () => import('../modules/ems/announcements/AnnouncementsInboxPage'),
)

const Dashboard = React.lazy(() => import('../modules/ems/dashboard/Dashboard'))
const MyProfilePage = React.lazy(() => import('../modules/ems/staff-payroll/MyProfilePage'))
const EmployeeList = React.lazy(() => import('../modules/ems/staff-payroll/EmployeeList'))
const EmployeeProfile = React.lazy(() => import('../modules/ems/staff-payroll/EmployeeProfile'))
const EmployeeForm = React.lazy(() => import('../modules/ems/staff-payroll/EmployeeForm'))
const SalaryInvoicePage = React.lazy(() => import('../modules/ems/staff-payroll/SalaryInvoicePage'))
const AttendanceDashboard = React.lazy(
  () => import('../modules/ems/attendance/AttendanceDashboard'),
)
const AttendanceImport = React.lazy(() => import('../modules/ems/attendance/AttendanceImport'))
const AttendanceCorrections = React.lazy(
  () => import('../modules/ems/attendance/AttendanceCorrections'),
)
const GlobalHRPoolPage = React.lazy(() => import('../modules/ems/hr-pool/GlobalHRPoolPage'))
const CorePoolPage = React.lazy(() => import('../modules/ems/core-pool/CorePoolPage'))
const ProjectOverheadsList = React.lazy(
  () => import('../modules/ems/projects/ProjectOverheadsList'),
)
const ProjectOverheadView = React.lazy(() => import('../modules/ems/projects/ProjectOverheadView'))

const GeneralExpenseList = React.lazy(
  () => import('../modules/ems/general-expenses/GeneralExpenseList'),
)
const GeneralExpenseForm = React.lazy(
  () => import('../modules/ems/general-expenses/GeneralExpenseForm'),
)
const GeneralExpenseDetail = React.lazy(
  () => import('../modules/ems/general-expenses/GeneralExpenseDetail'),
)
const CategoryManager = React.lazy(
  () => import('../modules/ems/general-expenses/components/CategoryManager'),
)
const ExpenseUpload = React.lazy(
  () => import('../modules/ems/general-expenses/components/ExpenseUpload'),
)
const ExpenseAnalysis = React.lazy(
  () => import('../modules/ems/general-expenses/components/ExpenseAnalysis'),
)
const GstBillsPage = React.lazy(() => import('../modules/ems/finance/GstBillsPage'))
const Gst2bComparisonPage = React.lazy(() => import('../modules/ems/finance/Gst2bComparisonPage'))
const HrGstUploadPage = React.lazy(() => import('../modules/ems/finance/HrGstUploadPage'))
const FinanceFilesPage = React.lazy(() => import('../modules/ems/finance/FinanceFilesPage'))
const LsgbFinancePage = React.lazy(() => import('../modules/ems/finance/LsgbFinancePage'))

const ExpenseManagementPage = React.lazy(
  () => import('../modules/ems/expense-management/ExpenseManagementPage'),
)
const InternshipPage = React.lazy(() => import('../modules/ems/internship/InternshipPage'))
const RecruitmentPage = React.lazy(() => import('../modules/ems/recruitment/RecruitmentPage'))
const VisualModelPage = React.lazy(() => import('../modules/ems/reports-analysis/VisualModelPage'))
const SuperForecastingPage = React.lazy(
  () => import('../modules/ems/reports-analysis/SuperForecastingPage'),
)
const ForecastExpensePage = React.lazy(() => import('../modules/ems/forecast/ForecastExpensePage'))
const DetailedReportPage = React.lazy(
  () => import('../modules/ems/reports-analysis/DetailedReportPage'),
)
const ReportsPage = React.lazy(() => import('../modules/ems/reports-analysis/ReportsPage'))
const EmsAuditLogsPage = React.lazy(() => import('../modules/ems/audit-logs/EmsAuditLogsPage'))

// AI Assistant (shared with PMS)
const ChatPage = React.lazy(() => import('../modules/shared/ai-chat/ChatPage'))

export const emsRoutes = [
  { path: '/', exact: true, name: 'Home' },
  { path: '/ems/dashboard', name: 'Dashboard', element: Dashboard, module: MODULE.DASHBOARD },
  {
    path: '/ems/my-profile',
    name: 'My Profile',
    element: MyProfilePage,
    module: MODULE.MY_PROFILE,
  },
  {
    path: '/ems/ai-chat',
    name: 'AI Assistant',
    element: ChatPage,
    module: MODULE.AI_CHAT,
  },

  {
    path: '/ems/staff-payroll',
    name: 'Staff & Payroll',
    element: EmployeeList,
    module: MODULE.STAFF_PAYROLL,
  },
  {
    path: '/ems/staff-payroll/new',
    name: 'Add Employee',
    element: EmployeeForm,
    module: MODULE.STAFF_PAYROLL,
  },
  {
    path: '/ems/staff-payroll/:id/edit',
    name: 'Edit Employee',
    element: EmployeeForm,
    module: MODULE.STAFF_PAYROLL,
  },
  {
    path: '/ems/staff-payroll/salary-invoice',
    name: 'Salary Details',
    element: SalaryInvoicePage,
    module: MODULE.STAFF_PAYROLL,
  },
  {
    path: '/ems/staff-payroll/:id',
    name: 'Employee Profile',
    element: EmployeeProfile,
    module: MODULE.STAFF_PAYROLL,
  },

  {
    path: '/ems/attendance',
    name: 'Attendance',
    element: AttendanceDashboard,
    module: MODULE.ATTENDANCE,
  },
  {
    path: '/ems/attendance/import',
    name: 'Import Excel',
    element: AttendanceImport,
    module: MODULE.ATTENDANCE,
  },
  {
    path: '/ems/attendance/corrections',
    name: 'Corrections',
    element: AttendanceCorrections,
    module: MODULE.ATTENDANCE,
  },
  {
    path: '/ems/internship',
    name: 'Internship',
    element: InternshipPage,
    module: MODULE.INTERNSHIP,
  },
  {
    path: '/ems/recruitment',
    name: 'Recruitment',
    element: RecruitmentPage,
    module: MODULE.RECRUITMENT,
  },
  {
    path: '/ems/hr-pool/global',
    name: 'Expense Booking',
    element: GlobalHRPoolPage,
    module: MODULE.HR_POOL,
  },
  {
    path: '/ems/core-pool/global',
    name: 'Global Core Pool',
    element: CorePoolPage,
    module: MODULE.CORE_POOL,
  },
  {
    path: '/ems/projects/overheads',
    name: 'Project Overheads',
    element: ProjectOverheadsList,
    module: MODULE.CORE_POOL,
  },
  {
    path: '/ems/projects/:id/overheads',
    name: 'Project Overhead Details',
    element: ProjectOverheadView,
    module: MODULE.CORE_POOL,
  },
  {
    path: '/ems/expense-management',
    name: 'Expense Management',
    element: ExpenseManagementPage,
    module: MODULE.EXPENSE_MANAGEMENT,
  },

  {
    path: '/ems/forecast/super-forecasting',
    name: 'Super Forecasting',
    element: SuperForecastingPage,
    module: MODULE.FORECAST,
  },
  {
    path: '/ems/forecast/expense',
    name: 'Forecast Expense',
    element: ForecastExpensePage,
    module: MODULE.FORECAST,
  },

  {
    path: '/ems/general-expenses',
    name: 'General Expenses',
    element: GeneralExpenseList,
    module: MODULE.GENERAL_EXPENSES,
  },
  {
    path: '/ems/general-expenses/new',
    name: 'Add Expense',
    element: GeneralExpenseForm,
    module: MODULE.GENERAL_EXPENSES,
  },
  {
    path: '/ems/general-expenses/categories',
    name: 'Expense Categories',
    element: CategoryManager,
    module: MODULE.GENERAL_EXPENSES,
  },
  {
    path: '/ems/general-expenses/upload',
    name: 'Upload Excel',
    element: ExpenseUpload,
    module: MODULE.GENERAL_EXPENSES,
  },
  {
    path: '/ems/general-expenses/analysis',
    name: 'Expense Analysis',
    element: ExpenseAnalysis,
    module: MODULE.GENERAL_EXPENSES,
  },
  {
    path: '/ems/general-expenses/:id/edit',
    name: 'Edit Expense',
    element: GeneralExpenseForm,
    module: MODULE.GENERAL_EXPENSES,
  },
  {
    path: '/ems/general-expenses/:id',
    name: 'Expense Detail',
    element: GeneralExpenseDetail,
    module: MODULE.GENERAL_EXPENSES,
  },

  {
    path: '/ems/finance/gst-bills',
    name: 'GST Bills',
    element: GstBillsPage,
    module: MODULE.FINANCE,
  },
  {
    path: '/ems/finance/gst-2b-comparison',
    name: 'GST 2B Comparison',
    element: Gst2bComparisonPage,
    module: MODULE.FINANCE,
  },
  {
    path: '/ems/finance/files',
    name: 'Files',
    element: FinanceFilesPage,
    module: MODULE.FINANCE,
  },
  {
    path: '/ems/finance/lsgb',
    name: 'LSGB',
    element: LsgbFinancePage,
    module: MODULE.FINANCE,
  },
  {
    path: '/ems/hr-admin/upload-gst-bill',
    name: 'Upload GST Bill',
    element: HrGstUploadPage,
    module: MODULE.GST_UPLOAD,
  },

  {
    path: '/ems/reports-analysis/visual-model',
    name: 'Visual Model',
    element: VisualModelPage,
    module: MODULE.REPORTS,
  },
  {
    path: '/ems/reports-analysis/detailed-report',
    name: 'Detailed Report',
    element: DetailedReportPage,
    module: MODULE.REPORTS,
  },
  {
    path: '/ems/reports-analysis/reports',
    name: 'Reports',
    element: ReportsPage,
    module: MODULE.REPORTS,
  },

  {
    path: '/ems/audit-logs',
    name: 'Audit Logs',
    element: EmsAuditLogsPage,
    module: MODULE.AUDIT_LOGS,
  },

  {
    path: '/ems/user-management',
    name: 'Registered Users',
    element: UserManagementPage,
    module: MODULE.USER_MANAGEMENT,
  },
  {
    path: '/ems/user-management/add',
    name: 'Add User',
    element: UserManagementPage,
    module: MODULE.USER_MANAGEMENT,
  },

  // Admin Settings — Admin only
  {
    path: '/ems/admin-settings',
    name: 'Admin Settings',
    element: AdminSettingsPage,
    module: MODULE.ADMIN_SETTINGS,
  },

  // CEO Announcements — all three nav links point here; tabs are managed internally
  {
    path: '/ems/announcements',
    name: 'Announcements',
    element: CeoAnnouncementsPage,
    module: MODULE.CEO_ANNOUNCEMENTS,
  },
  {
    path: '/ems/announcements/compose',
    name: 'Compose Announcement',
    element: CeoAnnouncementsPage,
    module: MODULE.CEO_ANNOUNCEMENTS,
  },
  {
    path: '/ems/announcements/sent',
    name: 'Sent Announcements',
    element: CeoAnnouncementsPage,
    module: MODULE.CEO_ANNOUNCEMENTS,
  },

  // Notifications inbox — all non-CEO/Admin roles
  {
    path: '/ems/notifications',
    name: 'Notifications',
    element: AnnouncementsInboxPage,
    module: MODULE.NOTIFICATIONS,
  },
]

export default emsRoutes
