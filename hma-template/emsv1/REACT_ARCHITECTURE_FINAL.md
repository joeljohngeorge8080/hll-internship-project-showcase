# HMA EMS - Final React Architecture

**Date:** June 11, 2026  
**Version:** 1.0  
**Status:** Production-Ready Architecture  
**Audience:** Development Team, Technical Leadership

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Folder Structure](#folder-structure)
3. [Route Structure](#route-structure)
4. [Module Structure](#module-structure)
5. [Layout Structure](#layout-structure)
6. [Shared Components Structure](#shared-components-structure)
7. [State Management Structure](#state-management-structure)
8. [API Integration Structure](#api-integration-structure)
9. [Authentication Structure](#authentication-structure)
10. [Role-Based Access Structure](#role-based-access-structure)
11. [Audit Log Integration Strategy](#audit-log-integration-strategy)
12. [Data Flow Patterns](#data-flow-patterns)
13. [Error Handling Strategy](#error-handling-strategy)
14. [Performance Optimization](#performance-optimization)

---

## Architecture Overview

### Technology Stack

**Frontend:**
- React 19.x with TypeScript
- Vite 8.x (build tool)
- Tailwind CSS 3.x (styling)
- Redux Toolkit 2.x (state management)
- RTK Query (API caching)
- React Router 7.x (routing)
- React Hook Form (forms)
- Zod (validation)
- Recharts (visualizations)
- Vitest (testing)

**Backend:**
- FastAPI (Python web framework)
- Pydantic (data validation)
- SQLAlchemy 2.x (ORM)
- PostgreSQL 14+ (database)
- Supabase (managed PostgreSQL)

**Authentication:**
- Google OAuth 2.0 (login)
- JWT tokens (authorization)
- RefreshToken rotation (security)
- HTTPOnly cookies (token storage)

**Infrastructure:**
- AWS ECS Fargate (API hosting)
- AWS RDS (database)
- AWS S3 (file storage)
- CloudFront (CDN)
- GitHub Actions (CI/CD)

### Architectural Principles

1. **Feature-Driven:** Code organized by business capabilities, not layers
2. **Single Responsibility:** Each module/component has one reason to change
3. **Separation of Concerns:** Business logic, UI, state, API calls separated
4. **Type Safety:** TypeScript throughout, no `any` types
5. **DRY:** Reusable components, hooks, utilities
6. **SOLID:** Following SOLID principles for maintainability
7. **Audit-First:** All mutations logged with immutable audit trail
8. **Security-First:** Role-based access enforced at backend, not frontend
9. **Performance-First:** Lazy loading, code splitting, caching
10. **Accessibility-First:** WCAG 2.1 AA compliance

---

## Folder Structure

### Root Directory Structure

```
coreui-free-react-admin-template/
│
├── public/
│   ├── favicon.ico
│   ├── manifest.json
│   └── robots.txt
│
├── src/
│   ├── index.jsx                           ← Entry point
│   ├── App.jsx                             ← Root app component
│   ├── main.jsx                            ← Vite entry
│   │
│   ├── common/                             ← Shared across all features
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   │
│   ├── features/                           ← Feature modules
│   │   ├── auth/                           ← Authentication
│   │   ├── dashboard/                      ← Dashboard module
│   │   ├── projects/                       ← Projects module
│   │   ├── staff/                          ← Staff & Payroll module
│   │   ├── attendance/                     ← Attendance module (future)
│   │   ├── announcements/                  ← Announcements (future)
│   │   ├── reports/                        ← Reports (future)
│   │   ├── expenses/                       ← Expenses (future)
│   │   └── profile/                        ← Personal Profile (future)
│   │
│   ├── layout/                             ← Application layouts
│   │   ├── components/
│   │   └── types/
│   │
│   ├── store/                              ← Redux store
│   │   ├── index.ts
│   │   ├── rootReducer.ts
│   │   ├── slices/
│   │   └── api/
│   │
│   ├── config/                             ← Application config
│   │   ├── constants.ts
│   │   ├── environment.ts
│   │   ├── api.config.ts
│   │   └── auth.config.ts
│   │
│   ├── routes/                             ← Route configuration
│   │   ├── index.tsx
│   │   ├── public.routes.tsx
│   │   ├── protected.routes.tsx
│   │   └── admin.routes.tsx
│   │
│   ├── styles/                             ← Global styles
│   │   ├── globals.css
│   │   ├── tailwind.css
│   │   └── theme.css
│   │
│   ├── lib/                                ← Third-party integrations
│   │   ├── api-client.ts
│   │   ├── auth-provider.tsx
│   │   ├── rbac-provider.tsx
│   │   └── audit-logger.ts
│   │
│   └── types/                              ← Global TypeScript types
│       ├── index.ts
│       ├── user.types.ts
│       ├── api.types.ts
│       └── common.types.ts
│
├── vite.config.mjs                         ← Vite configuration
├── tailwind.config.js                      ← Tailwind configuration
├── tsconfig.json                           ← TypeScript configuration
├── vitest.config.ts                        ← Test configuration
├── .env.example                            ← Environment variables template
├── package.json                            ← Dependencies
└── README.md                                ← Documentation
```

### Feature Module Structure

```
src/features/{module}/
│
├── pages/                                   ← Page-level components
│   ├── {ModuleName}ListPage.tsx
│   ├── {ModuleName}DetailPage.tsx
│   ├── {ModuleName}EditPage.tsx
│   └── {ModuleName}CreatePage.tsx
│
├── components/                              ← Feature-specific components
│   ├── {Feature}List/
│   │   ├── {Feature}ListTable.tsx
│   │   ├── {Feature}ListFilters.tsx
│   │   ├── {Feature}ListPagination.tsx
│   │   └── {Feature}ListEmptyState.tsx
│   │
│   ├── {Feature}Detail/
│   │   ├── {Feature}DetailHeader.tsx
│   │   ├── {Feature}Section{N}.tsx
│   │   └── {Feature}Sidebar.tsx
│   │
│   ├── {Feature}Form/
│   │   ├── {Feature}FormWrapper.tsx
│   │   ├── {Feature}FormTab{N}.tsx
│   │   └── {Feature}FormControls.tsx
│   │
│   └── {Feature}Modals/
│       ├── Confirm{Action}Modal.tsx
│       └── {Action}Modal.tsx
│
├── hooks/                                   ← Custom React hooks
│   ├── use{Feature}List.ts
│   ├── use{Feature}Detail.ts
│   ├── use{Feature}Form.ts
│   ├── use{Feature}Filters.ts
│   └── use{Feature}Pagination.ts
│
├── services/                                ← API services
│   ├── {feature}Service.ts
│   ├── {feature}AuditService.ts
│   └── {feature}AnalyticsService.ts
│
├── store/                                   ← Redux slices
│   ├── {feature}Slice.ts
│   ├── {feature}Selectors.ts
│   └── {feature}API.ts (RTK Query)
│
├── types/                                   ← TypeScript types
│   ├── {feature}.types.ts
│   └── {feature}.models.ts
│
├── utils/                                   ← Utility functions
│   ├── {feature}Transform.ts
│   ├── {feature}Validation.ts
│   ├── {feature}Calculations.ts
│   └── {feature}Helpers.ts
│
├── constants/                               ← Feature constants
│   ├── {feature}Constants.ts
│   └── {feature}Messages.ts
│
└── index.ts                                 ← Public exports
```

### Common Components Structure

```
src/common/
│
├── components/
│   ├── Layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── Breadcrumb.tsx
│   │   └── Navigation.tsx
│   │
│   ├── Forms/
│   │   ├── FormField.tsx
│   │   ├── FormInput.tsx
│   │   ├── FormSelect.tsx
│   │   ├── FormCheckbox.tsx
│   │   ├── FormDatePicker.tsx
│   │   ├── FormTextarea.tsx
│   │   └── FormError.tsx
│   │
│   ├── Buttons/
│   │   ├── Button.tsx
│   │   ├── IconButton.tsx
│   │   ├── ButtonGroup.tsx
│   │   └── ActionButton.tsx
│   │
│   ├── Cards/
│   │   ├── Card.tsx
│   │   ├── MetricCard.tsx
│   │   ├── InfoCard.tsx
│   │   └── ActionCard.tsx
│   │
│   ├── Tables/
│   │   ├── Table.tsx
│   │   ├── TableRow.tsx
│   │   ├── TableHeader.tsx
│   │   ├── TableBody.tsx
│   │   └── TablePagination.tsx
│   │
│   ├── Modals/
│   │   ├── Modal.tsx
│   │   ├── ConfirmModal.tsx
│   │   ├── AlertModal.tsx
│   │   └── FormModal.tsx
│   │
│   ├── Badges/
│   │   ├── Badge.tsx
│   │   ├── StatusBadge.tsx
│   │   └── RoleBadge.tsx
│   │
│   ├── Loaders/
│   │   ├── Spinner.tsx
│   │   ├── Skeleton.tsx
│   │   ├── LoadingOverlay.tsx
│   │   └── PageLoader.tsx
│   │
│   ├── Toast/
│   │   ├── Toast.tsx
│   │   ├── ToastContainer.tsx
│   │   └── useToast.ts
│   │
│   ├── Dialogs/
│   │   ├── Dialog.tsx
│   │   ├── AlertDialog.tsx
│   │   └── ConfirmDialog.tsx
│   │
│   └── Error/
│       ├── ErrorBoundary.tsx
│       ├── ErrorPage.tsx
│       ├── NotFoundPage.tsx
│       └── ForbiddenPage.tsx
│
├── hooks/
│   ├── useAuth.ts
│   ├── useRBAC.ts
│   ├── useApi.ts
│   ├── useLocalStorage.ts
│   ├── useSessionStorage.ts
│   ├── useDebounce.ts
│   ├── useThrottle.ts
│   ├── usePrevious.ts
│   ├── useWindowSize.ts
│   ├── useMediaQuery.ts
│   ├── useOutsideClick.ts
│   ├── useAsync.ts
│   ├── useFetch.ts
│   └── useForm.ts
│
├── services/
│   ├── apiClient.ts
│   ├── authService.ts
│   ├── rbacService.ts
│   ├── auditService.ts
│   ├── storageService.ts
│   └── notificationService.ts
│
├── types/
│   ├── common.types.ts
│   ├── api.types.ts
│   ├── user.types.ts
│   ├── auth.types.ts
│   ├── rbac.types.ts
│   └── audit.types.ts
│
├── utils/
│   ├── validation.ts
│   ├── formatting.ts
│   ├── date.ts
│   ├── string.ts
│   ├── number.ts
│   ├── array.ts
│   ├── object.ts
│   ├── error-handling.ts
│   ├── logger.ts
│   ├── constants.ts
│   └── helpers.ts
│
└── index.ts                                 ← Public exports
```

### Store Structure

```
src/store/
│
├── index.ts                                 ← Store configuration
├── rootReducer.ts                           ← Root reducer
├── rootSelector.ts                          ← Root selectors
│
├── slices/
│   ├── authSlice.ts                         ← Authentication state
│   ├── rbacSlice.ts                         ← RBAC state
│   ├── uiSlice.ts                           ← UI state (theme, sidebar, etc)
│   ├── notificationSlice.ts                 ← Toast notifications
│   ├── filterSlice.ts                       ← Global filters
│   └── appSlice.ts                          ← General app state
│
├── api/
│   ├── baseApi.ts                           ← RTK Query base
│   ├── authApi.ts                           ← Auth endpoints
│   ├── projectsApi.ts                       ← Projects endpoints
│   ├── staffApi.ts                          ← Staff endpoints
│   ├── attendanceApi.ts                     ← Attendance endpoints
│   ├── expensesApi.ts                       ← Expenses endpoints
│   ├── reportsApi.ts                        ← Reports endpoints
│   ├── auditApi.ts                          ← Audit endpoints
│   └── index.ts                             ← Combined export
│
└── selectors/
    ├── authSelectors.ts
    ├── rbacSelectors.ts
    ├── uiSelectors.ts
    └── notificationSelectors.ts
```

---

## Route Structure

### Route Hierarchy

```
/                                           ← Root redirect
├── Public Routes (No Auth Required)
│   ├── /auth/login                          ← Login page
│   ├── /auth/oauth-callback                 ← OAuth handler
│   ├── /error/404                           ← Not found
│   ├── /error/403                           ← Forbidden
│   └── /error/500                           ← Server error
│
├── Protected Routes (Auth Required)
│   ├── /dashboard                           ← Dashboard
│   │
│   ├── /projects                            ← Projects root
│   │   ├── /projects/csr                    ← CSR projects list
│   │   ├── /projects/csr/new                ← Create CSR project
│   │   ├── /projects/csr/:projectId         ← CSR project detail
│   │   ├── /projects/csr/:projectId/edit    ← Edit CSR project
│   │   ├── /projects/lsgb                   ← LSGB projects list
│   │   ├── /projects/lsgb/new               ← Create LSGB project
│   │   ├── /projects/lsgb/:projectId        ← LSGB project detail
│   │   └── /projects/lsgb/:projectId/edit   ← Edit LSGB project
│   │
│   ├── /staff                               ← Staff & Payroll root
│   │   ├── /staff                           ← Employee directory
│   │   ├── /staff/new                       ← Create employee
│   │   ├── /staff/:employeeId               ← Employee detail
│   │   ├── /staff/:employeeId/edit          ← Edit employee
│   │   ├── /staff/compensation              ← My compensation
│   │   ├── /staff/compensation/history      ← Compensation history
│   │   ├── /payroll                         ← Payroll runs
│   │   ├── /payroll/:runId                  ← Run detail
│   │   └── /payroll/slips                   ← Salary slips
│   │
│   ├── /attendance                          ← Attendance root
│   │   ├── /attendance/checkin              ← Check in/out
│   │   ├── /attendance/leave                ← Leave requests
│   │   ├── /attendance/leave/:requestId     ← Request detail
│   │   └── /attendance/reports              ← Attendance reports
│   │
│   ├── /announcements                       ← Announcements root
│   │   ├── /announcements                   ← Feed
│   │   ├── /announcements/:announcementId   ← Detail
│   │   ├── /announcements/new               ← Create (HR/CEO)
│   │   └── /announcements/:announcementId/edit ← Edit (HR/CEO)
│   │
│   ├── /reports                             ← Reports root
│   │   ├── /reports/dashboard               ← Report dashboard
│   │   ├── /reports/prebuilt                ← Pre-built reports
│   │   ├── /reports/prebuilt/:reportId      ← Run report
│   │   ├── /reports/custom                  ← Custom reports
│   │   ├── /reports/custom/new              ← Create custom
│   │   ├── /reports/custom/:reportId        ← View custom
│   │   └── /reports/schedule                ← Scheduling
│   │
│   ├── /expenses                            ← Expenses root
│   │   ├── /expenses                        ← My claims
│   │   ├── /expenses/new                    ← Create claim
│   │   ├── /expenses/:claimId               ← Claim detail
│   │   ├── /expenses/:claimId/edit          ← Edit claim
│   │   ├── /expenses/approvals              ← Pending approvals
│   │   └── /expenses/report                 ← Expense report
│   │
│   ├── /profile                             ← Profile root
│   │   ├── /profile                         ← My profile
│   │   ├── /profile/preferences             ← Preferences
│   │   └── /profile/security                ← Security
│   │
│   └── Admin Routes (Admin/CEO Only)
│       ├── /settings/roles                  ← Role management
│       ├── /settings/departments            ← Department management
│       ├── /settings/designations           ← Designation management
│       ├── /settings/system                 ← System settings
│       └── /audit                           ← Audit logs
│
└── Catch-All
    └── /*                                   ← 404 page
```

### Route Configuration File

```typescript
// src/routes/index.tsx

interface RouteConfig {
  path: string
  element: React.ReactNode
  layout?: 'MainLayout' | 'AuthLayout' | 'ErrorLayout'
  requiredRoles?: string[]
  requiredPermission?: string
  breadcrumb?: string | (params: any) => string
  title?: string
  metadata?: {
    icon?: string
    description?: string
  }
}

// publicRoutes: Auth, 404, 403, 500 pages
// protectedRoutes: Dashboard, Projects, Staff, Attendance, etc.
// adminRoutes: Settings, Audit logs
```

### Route Protection Strategy

```
Route Request
    ↓
Check if route requires authentication
    ↓ (if yes)
Check if user is authenticated
    ↓ (if no)
Redirect to /auth/login
    ↓ (if yes)
Check required roles (if specified)
    ↓ (if not authorized)
Redirect to /error/403
    ↓ (if authorized)
Check required permissions (if specified)
    ↓ (if not granted)
Redirect to /error/403
    ↓ (if granted)
Load and render route component
```

---

## Module Structure

### 8 Feature Modules

**1. Auth Module (src/features/auth/)**
- Purpose: Authentication and user sessions
- Pages: LoginPage, OAuthCallbackPage
- Components: LoginForm, SessionValidator
- Services: Google OAuth, JWT token management, session persistence
- State: authSlice (user, tokens, loginStatus)
- Routes: /auth/login, /auth/oauth-callback

**2. Dashboard Module (src/features/dashboard/)**
- Purpose: Application home and overview
- Pages: DashboardPage
- Components: Widget components, KPI cards, charts, summaries
- Services: Dashboard data aggregation
- State: dashboardSlice (selected widgets, layout)
- Routes: /dashboard

**3. Projects Module (src/features/projects/)**
- Purpose: Project management (CSR and LSGB)
- Pages: ListPage, DetailPage, EditPage, CreatePage
- Components: ProjectList, ProjectDetail (6 sections), ProjectForm (3 tabs)
- Services: projectService, projectAuditService, projectAnalyticsService
- State: projectSlice (list, detail, edit, ui)
- Routes: /projects/{csr,lsgb}/{actions}
- Special: 6-section detail, 3-tab form, audit logging

**4. Staff Module (src/features/staff/)**
- Purpose: Employee and payroll management
- Pages: DirectoryPage, DetailPage, EditPage, PayrollPage, SalarySlipsPage
- Components: EmployeeList, EmployeeDetail (5 sections), EmployeeForm (4 tabs)
- Services: employeeService, compensationService, payrollService
- State: employeeSlice, payrollSlice
- Routes: /staff/{employee,payroll,compensation}
- Special: 5-section detail, 4-tab form, payroll processing, audit logging

**5. Attendance Module (src/features/attendance/)**
- Purpose: Check-in/out, leave, attendance tracking
- Pages: CheckinPage, LeaveRequestsPage, ReportsPage
- Components: CheckinForm, LeaveRequestForm, AttendanceTable
- Services: attendanceService, leaveService
- State: attendanceSlice
- Routes: /attendance/{checkin,leave,reports}
- Special: Real-time check-in, leave approval workflow

**6. Announcements Module (src/features/announcements/)**
- Purpose: Organizational communications
- Pages: FeedPage, DetailPage, CreatePage, EditPage
- Components: AnnouncementList, AnnouncementDetail, AnnouncementForm
- Services: announcementService
- State: announcementSlice
- Routes: /announcements/{list,detail,create,edit}

**7. Reports Module (src/features/reports/)**
- Purpose: Analytics, insights, reporting
- Pages: DashboardPage, PrebuiltPage, CustomPage, SchedulePage
- Components: ReportBuilder, ReportViewer, ChartComponents
- Services: reportService, analyticsService
- State: reportSlice
- Routes: /reports/{dashboard,prebuilt,custom,schedule}
- Special: Custom report builder, scheduled exports

**8. Expenses Module (src/features/expenses/)**
- Purpose: Expense claims and approvals
- Pages: ListPage, DetailPage, CreatePage, ApprovalsPage
- Components: ExpenseList, ExpenseForm, ApprovalWorkflow
- Services: expenseService, approvalService
- State: expenseSlice
- Routes: /expenses/{list,detail,create,approvals}
- Special: Multi-level approval workflow, attachment handling

**Additional Modules (Future):**
- Profile Module: Personal profile, preferences, security
- Settings Module (Admin): RBAC, departments, system config
- Audit Module (HR/Admin): Audit log viewer

---

## Layout Structure

### MainLayout (Authenticated Pages)

```
┌──────────────────────────────────────────────────┐
│              Header Component                    │
│  [Logo] [Search] [Notifications] [User Menu]    │
├────────────┬──────────────────────────────────────┤
│  Sidebar   │                                      │
│  Navigation│         Page Content                 │
│  [Menu     │  ┌──────────────────────────────────┐│
│   Items]   │  │ [Breadcrumb]                    ││
│            │  ├──────────────────────────────────┤│
│  [Collapse]│  │ [Page Title]                    ││
│            │  ├──────────────────────────────────┤│
│            │  │ [Main Content Area]             ││
│            │  │ [Sections/Tables/Forms]         ││
│            │  └──────────────────────────────────┘│
│            │                                      │
├────────────┴──────────────────────────────────────┤
│              Footer Component                     │
│  [Links] [Copyright] [Version]                   │
└──────────────────────────────────────────────────┘
```

**MainLayout Components:**
- Header: Logo, search, notifications, user dropdown, theme toggle
- Sidebar: Navigation menu, role-based items, collapse toggle
- Content: Breadcrumb, page title, main content, modals
- Footer: Links, copyright, version info
- Toast Container: Global notifications (top-right)

### AuthLayout (Login/OAuth Pages)

```
┌──────────────────────────────────────────┐
│                                          │
│        [Logo]                            │
│        [Auth Form / OAuth Buttons]       │
│        [Links / Help]                    │
│                                          │
└──────────────────────────────────────────┘
```

**AuthLayout Features:**
- Centered container
- No sidebar or header
- Full-width form
- Simple navigation
- Social login options

### ErrorLayout (404, 403, 500)

```
┌──────────────────────────────────────────┐
│        [Error Icon]                      │
│        [Error Title]                     │
│        [Error Message]                   │
│        [Action Buttons]                  │
└──────────────────────────────────────────┘
```

**ErrorLayout Features:**
- Centered error information
- Clear action buttons (Go Home, Contact Support)
- Error code display
- Dark/light mode support

### Layout Configuration

```typescript
// src/layout/types/layout.types.ts

interface LayoutConfig {
  sidebar?: {
    visible: boolean
    collapsed: boolean
    width: string
    breakpoint: 'mobile' | 'tablet' | 'desktop'
  }
  header?: {
    visible: boolean
    height: string
    sticky: boolean
  }
  footer?: {
    visible: boolean
    sticky: boolean
  }
  theme?: 'light' | 'dark' | 'auto'
  spacing?: 'compact' | 'normal' | 'comfortable'
}
```

---

## Shared Components Structure

### Component Categories

**1. Form Components** (src/common/components/Forms/)
- FormField wrapper (label + input + error)
- FormInput (text, password, email, number)
- FormSelect (dropdown, multi-select)
- FormCheckbox (single, group)
- FormRadio (single, group)
- FormDatePicker (single, range)
- FormTextarea (rich text optional)
- FormFileUpload (single, multiple)

**2. Button Components** (src/common/components/Buttons/)
- Button (primary, secondary, danger, success)
- IconButton (icon-only buttons)
- ButtonGroup (button collections)
- ActionButton (with loading state)
- SplitButton (dropdown + button)

**3. Table Components** (src/common/components/Tables/)
- Table wrapper
- TableHeader (with sorting)
- TableBody (with actions)
- TableRow (clickable)
- TablePagination
- TableFilters
- TableExport

**4. Card Components** (src/common/components/Cards/)
- Card (container)
- MetricCard (with values and trends)
- InfoCard (with icon and description)
- ActionCard (clickable card)
- StatCard (dashboard statistic)

**5. Modal/Dialog Components** (src/common/components/Modals/)
- Modal (generic container)
- ConfirmModal (yes/no)
- AlertModal (info/warning/error)
- FormModal (form inside modal)
- SlidePanel (side drawer)

**6. Badge/Tag Components** (src/common/components/Badges/)
- Badge (status, role, type)
- StatusBadge (Active/Inactive/Pending)
- RoleBadge (CEO/HR/Employee)
- TypeBadge (CSR/LSGB)

**7. Loader Components** (src/common/components/Loaders/)
- Spinner (loading indicator)
- Skeleton (content placeholder)
- LoadingOverlay (full-screen loading)
- PageLoader (page-level loading)
- TableSkeleton (table placeholder)

**8. Navigation Components** (src/common/components/Layout/)
- Sidebar (collapsible navigation)
- Header (top bar)
- Breadcrumb (navigation trail)
- Navigation (menu items with icons)
- UserMenu (dropdown)

**9. Toast/Notification Components** (src/common/components/Toast/)
- Toast (message notification)
- ToastContainer (manager)
- useToast hook (imperative API)

**10. Error Components** (src/common/components/Error/)
- ErrorBoundary (error catcher)
- ErrorPage (error display)
- NotFoundPage (404)
- ForbiddenPage (403)
- EmptyState (no results)

### Component Design Patterns

**Base Button Component Pattern:**
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
}

// Usage:
<Button variant="primary" size="lg" loading={isSubmitting}>
  Save Changes
</Button>
```

**Form Component Pattern:**
```typescript
interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  hint?: string
  disabled?: boolean
}

// Usage:
<FormField label="Email" error={errors.email} required>
  <FormInput type="email" {...register('email')} />
</FormField>
```

---

## State Management Structure

### Redux Store Organization

**File: src/store/index.ts**
```typescript
// Configure Redux store with:
// - All slices (auth, rbac, ui, notification, filter, app)
// - RTK Query API
// - Redux DevTools (dev only)
// - Middleware (thunk, logger)
// - Persist middleware (localStorage)
```

### Slices Organization

**Auth Slice** (src/store/slices/authSlice.ts)
```typescript
interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isLoading: boolean
  error: string | null
  isAuthenticated: boolean
  loginProvider: 'google' | null
  sessionExpiry: number | null
}

// Actions: setUser, setTokens, logout, refreshToken, etc.
// Selectors: selectUser, selectIsAuthenticated, selectUserRole
```

**RBAC Slice** (src/store/slices/rbacSlice.ts)
```typescript
interface RBACState {
  roles: Role[]
  permissions: Permission[]
  userRoles: string[]
  userPermissions: string[]
  loading: boolean
  error: string | null
}

// Actions: setRoles, setPermissions, updateUserRoles
// Selectors: selectUserPermissions, selectCanAccessModule, selectCanPerformAction
```

**UI Slice** (src/store/slices/uiSlice.ts)
```typescript
interface UIState {
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  searchOpen: boolean
  mobileMenuOpen: boolean
  pageTitle: string
  breadcrumbs: Breadcrumb[]
  activeModal: string | null
}

// Actions: toggleTheme, toggleSidebar, setSidebarCollapsed
// Selectors: selectTheme, selectSidebarOpen, selectBreadcrumbs
```

**Notification Slice** (src/store/slices/notificationSlice.ts)
```typescript
interface NotificationState {
  toasts: Toast[]
  modals: Modal[]
}

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration?: number
}

// Actions: addToast, removeToast, clearToasts
// Selectors: selectToasts, selectHasErrors
```

**Filter Slice** (src/store/slices/filterSlice.ts)
```typescript
interface FilterState {
  [moduleKey: string]: {
    filters: Record<string, any>
    sorting: { field: string; direction: 'asc' | 'desc' }
    page: number
    pageSize: number
  }
}

// Actions: setFilter, clearFilters, setSorting, setPagination
// Selectors: selectModuleFilters, selectModuleSort
```

**App Slice** (src/store/slices/appSlice.ts)
```typescript
interface AppState {
  initialized: boolean
  loading: boolean
  error: string | null
  appVersion: string
  lastSyncTime: number | null
}

// Actions: initializeApp, setLoading, setError
// Selectors: selectAppInitialized, selectAppLoading
```

### RTK Query API Configuration

**Base API** (src/store/api/baseApi.ts)
```typescript
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/v1',
    prepareHeaders: (headers, { getState }) => {
      // Add JWT token from auth state
      // Add request ID for tracking
      // Add CSRF token if needed
      return headers
    },
    credentials: 'include' // Include HTTPOnly cookies
  }),
  tagTypes: ['User', 'Project', 'Employee', 'Expense', 'Leave', 'Payroll', 'Report'],
  endpoints: () => ({})
})

// Features:
// - Automatic token refresh
// - Request/response interceptors
// - Cache invalidation
// - Optimistic updates
```

**Feature APIs** (src/store/api/{feature}Api.ts)
```typescript
// Each module exports:
// - Query endpoints (GET)
// - Mutation endpoints (POST, PUT, DELETE)
// - Cache invalidation tags
// - Optimistic update handlers

// Example:
export const projectsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProjects: builder.query({...}),
    getProjectDetail: builder.query({...}),
    createProject: builder.mutation({...}),
    updateProject: builder.mutation({...}),
    deleteProject: builder.mutation({...})
  })
})
```

---

## API Integration Structure

### API Client Configuration

**File: src/lib/api-client.ts**
```typescript
interface ApiConfig {
  baseURL: string
  timeout: number
  headers: Record<string, string>
  interceptors: {
    request: AxiosInterceptor[]
    response: AxiosInterceptor[]
  }
}

// Configure:
// - Base URL (from environment)
// - Default headers
// - Timeout (30 seconds)
// - Request/response interceptors
// - Error handling
// - Token refresh logic
```

### API Service Layer

**File: src/common/services/apiClient.ts**
```typescript
class ApiClient {
  private static instance: AxiosInstance

  static getInstance(): AxiosInstance {
    // Singleton pattern
  }

  static async request<T>(config: AxiosRequestConfig): Promise<T> {
    // Make request with error handling
  }

  static get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    // GET request
  }

  static post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    // POST request
  }

  static put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    // PUT request
  }

  static delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    // DELETE request
  }
}
```

### API Error Handling

**Request Flow:**
```
Outgoing Request
  ↓
Add JWT token to Authorization header
  ↓
Send request
  ↓
Response received
  ↓
Check status code
  ↓
200-299: Return data
  ↓
401: Token expired → Refresh token → Retry request
  ↓
403: Forbidden → Show error, redirect
  ↓
4xx/5xx: Handle error → Show toast, log to Sentry
```

### RTK Query Features

**Automatic Cache Management:**
- Cache data for 5 minutes (configurable per endpoint)
- Invalidate cache on mutations
- Refetch on focus (optional)

**Optimistic Updates:**
```typescript
// Example: Delete project optimistically
deleteProject: builder.mutation({
  query: (id) => ({
    url: `/projects/${id}`,
    method: 'DELETE'
  }),
  async onQueryStarted(id, { dispatch, queryFulfilled }) {
    // Optimistically remove from cache
    const patchResult = dispatch(
      projectsApi.util.updateQueryData('getProjects', undefined, (draft) => {
        // Remove project from list
      })
    )
    try {
      await queryFulfilled
    } catch {
      // Rollback on error
      patchResult.undo()
    }
  }
})
```

---

## Authentication Structure

### OAuth 2.0 Flow

**File: src/lib/auth-provider.tsx**

```
User clicks "Login with Google"
  ↓
Redirect to Google OAuth endpoint
  ↓
User logs in with Google account
  ↓
Google redirects to /auth/oauth-callback with code
  ↓
Frontend exchanges code for tokens (backend)
  ↓
Backend returns JWT (access + refresh tokens)
  ↓
Frontend stores tokens (HTTPOnly cookies + localStorage)
  ↓
Redirect to /dashboard
  ↓
User authenticated and authorized
```

### Token Management

**File: src/lib/auth-provider.tsx**

**Token Storage Strategy:**
- Access Token: HTTPOnly cookie (secure, can't be accessed by JS)
- Refresh Token: HTTPOnly cookie (secure)
- User Info: localStorage (non-sensitive only: name, avatar, role)

**Token Lifecycle:**
```typescript
// Access Token: 15 minutes
// Refresh Token: 7 days
// Refresh Strategy: Check on app load, before API calls

// If access token expired:
// 1. Check refresh token
// 2. If valid, silently refresh access token
// 3. If expired, redirect to login
```

**Token Refresh Middleware:**
```typescript
// RTK Query middleware
// Before each request:
// - Check if access token close to expiry (< 2 min)
// - If yes, refresh token before making request
// - If refresh fails, redirect to login
```

### Login Flow

**File: src/features/auth/pages/LoginPage.tsx**

```
User lands on /auth/login
  ↓
Display login form
  ↓
Options:
├─ Google OAuth button → Redirect to Google
├─ Email/Password (if enabled)
└─ Links: Terms, Privacy, Help

Google Login Flow:
  ↓
Redirect to: https://accounts.google.com/o/oauth2/v2/auth
  ↓
Params:
  ├─ client_id: {GOOGLE_CLIENT_ID}
  ├─ redirect_uri: /auth/oauth-callback
  ├─ response_type: code
  ├─ scope: openid email profile
  ├─ state: {random token for CSRF}
  └─ ...

User grants permissions
  ↓
Redirect to /auth/oauth-callback?code=XXX&state=XXX
  ↓
Frontend receives code
  ↓
Send code to backend: POST /auth/oauth-token
  ↓
Backend exchanges code for Google ID token
  ↓
Backend verifies ID token with Google
  ↓
Backend creates/updates user in database
  ↓
Backend generates JWT tokens
  ↓
Backend sets HTTPOnly cookies
  ↓
Backend returns user data + success
  ↓
Frontend redirects to /dashboard
```

### OAuth Callback Handler

**File: src/features/auth/pages/OAuthCallbackPage.tsx**

```typescript
interface OAuthCallbackPageProps {
  code: string // from URL params
  state: string // CSRF protection
}

// Steps:
// 1. Validate state token (CSRF protection)
// 2. Extract code from URL
// 3. Call backend /auth/oauth-token endpoint
// 4. Store tokens in redux state
// 5. Dispatch auth success action
// 6. Redirect to /dashboard or return URL
```

### Session Management

**File: src/common/hooks/useAuth.ts**

```typescript
interface UseAuthReturn {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  updateUserProfile: (data: Partial<User>) => Promise<void>
}

// Hook provides:
// - Current user state
// - Authentication status
// - Login/logout functions
// - Token refresh
// - Session management
```

---

## Role-Based Access Structure

### RBAC Provider

**File: src/lib/rbac-provider.tsx**

```typescript
interface RBACContextType {
  roles: string[]
  permissions: string[]
  canAccess: (module: string) => boolean
  canPerformAction: (action: 'view' | 'create' | 'edit' | 'delete' | 'approve', resource: string) => boolean
  canAccessField: (field: string) => boolean
  isCEO: boolean
  isHR: boolean
  isFinanceHead: boolean
  isProjectManager: boolean
  isEmployee: boolean
}

// Provider:
// - Load user roles on app init
// - Load permissions for roles
// - Provide RBAC utilities
// - Cache permissions
```

### RBAC Utilities

**File: src/common/services/rbacService.ts**

```typescript
class RBACService {
  // Check permission
  hasPermission(action: string, resource: string): boolean {
    // Check if user can perform action on resource
  }

  // Check role
  hasRole(role: string): boolean {
    // Check if user has role
  }

  // Check multiple roles (OR logic)
  hasAnyRole(roles: string[]): boolean {
    // Check if user has any of the roles
  }

  // Check multiple roles (AND logic)
  hasAllRoles(roles: string[]): boolean {
    // Check if user has all roles
  }

  // Field-level access
  canViewField(field: string): boolean {
    // Check if user can view field
  }

  // Get accessible modules
  getAccessibleModules(): Module[] {
    // Return modules user can access
  }

  // Get accessible actions on resource
  getAccessibleActions(resource: string): Action[] {
    // Return actions user can perform
  }
}
```

### Route Protection

**File: src/routes/ProtectedRoute.tsx**

```typescript
interface ProtectedRouteProps {
  element: React.ReactNode
  requiredRoles?: string[]
  requiredPermission?: {
    action: string
    resource: string
  }
  fallback?: React.ReactNode
}

// Flow:
// 1. Check if user authenticated
// 2. Check if user has required roles (if specified)
// 3. Check if user has required permission (if specified)
// 4. If all checks pass, render element
// 5. Otherwise, render fallback or redirect to 403
```

### Permission-Based Component Rendering

**File: src/common/components/PermissionGate.tsx**

```typescript
interface PermissionGateProps {
  permission: string
  action?: 'view' | 'create' | 'edit' | 'delete' | 'approve'
  fallback?: React.ReactNode
  children: React.ReactNode
}

// Usage:
<PermissionGate permission="projects" action="create">
  <button>Create Project</button>
</PermissionGate>

// Or using hook:
const canCreate = usePermission('projects', 'create')
if (!canCreate) return null
```

### Permission Matrix Implementation

**File: src/config/permissions.ts**

```typescript
// Define permission structure
const PERMISSIONS_MATRIX = {
  dashboard: {
    view: ['CEO', 'Finance', 'HR', 'PM', 'Employee'],
    create: [],
    edit: ['CEO'],
    delete: [],
    approve: []
  },
  projects: {
    view: {
      'CEO': true,
      'Finance': true,
      'HR': true,
      'PM': 'own_division_only',
      'Employee': 'assigned_only'
    },
    create: {
      'CEO': true,
      'PM': 'own_division_only'
    },
    edit: {
      'CEO': true,
      'PM': 'own_projects_only'
    },
    delete: {
      'CEO': 'soft_delete_only',
      'PM': 'own_projects_soft_delete'
    },
    approve: {
      'CEO': true,
      'Finance': 'budget_approval_only'
    }
  },
  // ... other modules
}

// Usage:
function canUserPerformAction(user: User, module: string, action: string): boolean {
  // Check PERMISSIONS_MATRIX
}
```

---

## Audit Log Integration Strategy

### Audit Log Infrastructure

**File: src/lib/audit-logger.ts**

```typescript
interface AuditLogEntry {
  id: UUID
  userId: UUID
  userRole: string
  timestamp: DateTime
  
  // Action details
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'EXPORT' | 'VIEW'
  entityType: string (e.g., 'Project', 'Employee', 'Expense')
  entityId: UUID
  
  // Changes
  changesBefore?: Record<string, any>
  changesAfter?: Record<string, any>
  changedFields?: string[]
  
  // Context
  reason?: string
  ipAddress: string
  userAgent: string
  requestId: string
  
  // Status
  status: 'Success' | 'Failed' | 'Partial'
  result?: any
  error?: string
}
```

### Audit Logging Service

**File: src/common/services/auditService.ts**

```typescript
class AuditLogger {
  static async logAction(entry: AuditLogEntry): Promise<void> {
    // Send to backend audit endpoint
    // Backend stores immutably in audit table
  }

  static async logCreate(
    entityType: string,
    entityId: UUID,
    data: any,
    reason?: string
  ): Promise<void> {
    // Log creation with all fields
  }

  static async logUpdate(
    entityType: string,
    entityId: UUID,
    before: any,
    after: any,
    reason?: string
  ): Promise<void> {
    // Log update with before/after values
  }

  static async logDelete(
    entityType: string,
    entityId: UUID,
    data: any,
    reason?: string
  ): Promise<void> {
    // Log soft delete
  }

  static async logApproval(
    entityType: string,
    entityId: UUID,
    action: 'approve' | 'reject',
    reason?: string
  ): Promise<void> {
    // Log approval action
  }
}
```

### Automatic Audit Logging

**RTK Query Mutation Wrapper:**
```typescript
// Every mutation automatically logs
const createProject = builder.mutation({
  query: (data) => ({
    url: '/projects',
    method: 'POST',
    body: data
  }),
  async onQueryStarted(data, { dispatch, queryFulfilled }) {
    try {
      const result = await queryFulfilled
      // Automatically log
      AuditLogger.logCreate('Project', result.data.id, data)
    } catch (error) {
      // Log failed creation
      AuditLogger.logAction({
        action: 'CREATE',
        entityType: 'Project',
        status: 'Failed',
        error: error.message
      })
    }
  }
})
```

### Audit Log Viewer UI

**File: src/features/audit/pages/AuditLogPage.tsx**

**Components:**
- AuditLogTable (list of audit entries)
- AuditLogFilters (by entity, user, date, action)
- AuditLogDetail (expanded entry view)
- AuditLogExport (CSV, PDF export)

**Features:**
- Search by user, entity, action
- Filter by date range, status
- View before/after values
- Export audit trail
- Sort by timestamp, user, action

### Immutable Audit Storage

**Backend Implementation:**
```sql
-- PostgreSQL audit log table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL,
  changes_before JSONB,
  changes_after JSONB,
  changed_fields TEXT[],
  ip_address INET,
  user_agent TEXT,
  reason TEXT,
  status VARCHAR(20),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Indexes for querying
  INDEX idx_user_id (user_id),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created_at (created_at),
  INDEX idx_action (action)
);

-- Prevent deletion/modification (immutable)
CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION raise_immutable_error();
```

---

## Data Flow Patterns

### Query Data Flow

```
Component Mounts
  ↓
useQuery Hook Called
  ↓
RTK Query checks cache
  ↓
If cached: Return cached data
If stale: Fetch from API
If missing: Fetch from API
  ↓
API Request
  ↓
Backend returns data
  ↓
RTK Query caches data (5 min default)
  ↓
Component receives data
  ↓
Component renders with data
```

### Mutation Data Flow

```
User Action (click, submit)
  ↓
Dispatch Mutation
  ↓
Validate Input (client-side)
  ↓
Optimistic Update (optional)
  ↓
API Request (POST/PUT/DELETE)
  ↓
Add JWT Token to request
  ↓
Backend validates, processes
  ↓
Backend logs audit entry
  ↓
Backend returns result
  ↓
Frontend receives response
  ↓
Invalidate related caches
  ↓
Refetch dependent queries
  ↓
Update UI
  ↓
Show success toast
  ↓
Optional: Redirect
```

### State Management Data Flow

```
User Action
  ↓
Dispatch Redux Action
  ↓
Reducer processes action (synchronously)
  ↓
State updated
  ↓
Subscribed components notified
  ↓
Components re-render with new state
  ↓
Effect hooks run (if dependencies changed)
  ↓
Optional: API calls from effects
```

---

## Error Handling Strategy

### Error Classification

**HTTP Errors:**
- 400 Bad Request: Input validation error
- 401 Unauthorized: User not authenticated
- 403 Forbidden: User not authorized
- 404 Not Found: Resource doesn't exist
- 429 Too Many Requests: Rate limited
- 500 Internal Server Error: Backend error
- 503 Service Unavailable: Backend down

### Error Handling Flow

```
API Request
  ↓
Network Error?
  ├─ Yes: Show "Connection Error" toast
  │       Retry automatically (3x with exponential backoff)
  │       If persists: Show offline mode
  └─ No: Continue
      ↓
  Response Status?
  ├─ 401: Token expired
  │       Refresh token
  │       If refresh succeeds: Retry request
  │       If refresh fails: Redirect to login
  ├─ 403: User not authorized
  │       Show "Access Denied" toast
  │       Redirect to /error/403
  ├─ 404: Resource not found
  │       Show "Not Found" toast
  │       Redirect to previous page or list
  ├─ 4xx: Validation or client error
  │       Extract error details
  │       Show field-level errors in form
  │       Or show general error toast
  ├─ 5xx: Server error
  │       Log to error tracking (Sentry)
  │       Show "Something went wrong" toast
  │       Retry available
  └─ 2xx: Success
      ↓
  Process response
```

### Global Error Handler

**File: src/lib/error-handler.ts**

```typescript
class ErrorHandler {
  static handle(error: AxiosError): ErrorResponse {
    // Classify error
    // Extract error message
    // Log to Sentry (prod)
    // Return user-friendly error
  }

  static getErrorMessage(error: AxiosError): string {
    // Return appropriate message based on status
  }

  static handleValidationError(error: AxiosError): Record<string, string> {
    // Extract field-level errors
    // Return object with field -> error mapping
  }
}
```

### Error Boundary

**File: src/common/components/Error/ErrorBoundary.tsx**

```typescript
// Catches JavaScript errors anywhere in component tree
// Logs error to Sentry
// Displays fallback UI
// Provides recovery options
```

---

## Performance Optimization

### Code Splitting Strategy

```
// By route
Home: App shell (always)
Auth: auth.js (on demand)
Dashboard: dashboard.js (on demand)
Projects: projects.js (on demand)
Staff: staff.js (on demand)
Etc...

// Size: ~50KB gzip each module
// Loading: Parallel chunk loading
```

### Lazy Loading Implementation

```typescript
// Route-based code splitting
const Dashboard = lazy(() => import('@/features/dashboard'))
const Projects = lazy(() => import('@/features/projects'))

// Component-based code splitting
const ChartVisualization = lazy(() => import('@/common/components/ChartVisualization'))

// Wrapped with Suspense
<Suspense fallback={<PageLoader />}>
  <Dashboard />
</Suspense>
```

### Caching Strategy

**RTK Query Cache:**
- Default TTL: 5 minutes
- Endpoints can override TTL
- Stale data served while refetching
- Manual cache invalidation on mutations

**Browser Cache:**
- Static assets: 1 year (via hash)
- API responses: No-cache (RTK Query handles)
- Images: 30 days

**Local Storage:**
- User preferences (theme, sidebar state)
- Filter settings
- Form drafts
- TTL: Until manually cleared

### Bundle Analysis

```bash
# Analyze bundle size
npm run analyze

# Expected:
# - App shell: ~100KB gzip
# - Per module: ~30-50KB gzip
# - Total initial load: ~150-200KB gzip
```

### Lighthouse Targets

```
Performance:     > 85
Accessibility:   > 90
Best Practices:  > 85
SEO:             > 90
```

---

## Summary

### Architecture Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **UI Framework** | React 19 | Component-based UI |
| **Build** | Vite 8 | Fast bundling |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Routing** | React Router 7 | Client-side routing |
| **State** | Redux Toolkit | Central state |
| **API Data** | RTK Query | Server state management |
| **Forms** | React Hook Form | Efficient forms |
| **Validation** | Zod | Type-safe validation |
| **Charts** | Recharts | Data visualization |
| **Auth** | OAuth 2.0 + JWT | Secure authentication |
| **Backend** | FastAPI | Python REST API |
| **Database** | PostgreSQL + Supabase | Managed database |

### Folder Organization Summary

```
src/
├── common/               Shared across modules
├── features/            8 business modules
├── layout/             Layout components
├── store/              Redux state
├── routes/             Route configuration
├── lib/                3rd party integration
├── config/             App configuration
├── styles/             Global styles
└── types/              Global types
```

### Module Count: 8 Modules

1. Auth (login, OAuth)
2. Dashboard (overview)
3. Projects (CSR + LSGB)
4. Staff (employees, payroll)
5. Attendance (check-in, leave)
6. Announcements (communications)
7. Reports (analytics)
8. Expenses (claims, approvals)

### Key Features

✅ **Type-Safe:** TypeScript throughout  
✅ **Role-Based:** RBAC enforcement  
✅ **Audit-First:** Immutable audit logs  
✅ **Secure:** JWT + OAuth, HTTPOnly cookies  
✅ **Performant:** Code splitting, caching, lazy loading  
✅ **Scalable:** Feature-driven architecture  
✅ **Maintainable:** Clear separation of concerns  
✅ **Accessible:** WCAG 2.1 AA compliance  
✅ **Testable:** Unit, integration, E2E tests  
✅ **Observable:** Error tracking, logging  

---

**Document Status:** Production-Ready Architecture  
**Next Step:** Begin implementation in Phase 1  
**Total Development Time:** 18+ weeks  
**Team Size:** 4-6 developers recommended  

---

## Appendix: File Naming Conventions

### TypeScript/React Files

**Components:**
- `ComponentName.tsx` (functional component)
- `ComponentName.test.tsx` (test file)

**Hooks:**
- `useHookName.ts` (custom hook)

**Services:**
- `serviceName.ts` (service class/functions)

**Types:**
- `domain.types.ts` (type definitions)

**Utils:**
- `utilityName.ts` (utility functions)

**Constants:**
- `CONSTANT_NAME.ts` (constants)

### Redux Files

**Slices:**
- `featureSlice.ts` (reducer + actions)

**Selectors:**
- `featureSelectors.ts` (memoized selectors)

**API:**
- `featureApi.ts` (RTK Query endpoints)

### CSS Files

**Styles:**
- `globals.css` (global styles)
- `tailwind.css` (Tailwind directives)
- `theme.css` (theme variables)

### Configuration Files

- `vite.config.mjs`
- `tailwind.config.js`
- `tsconfig.json`
- `.env.example`

---

This architecture provides a solid, production-ready foundation for the HMA EMS application, supporting all required modules, security requirements, and scalability needs.
