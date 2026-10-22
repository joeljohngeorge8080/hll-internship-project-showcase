# HMA IEMS — Complete UI/UX Architecture & CoreUI Conversion Plan

---

## IMPORTANT — TECH STACK CORRECTION

The user prompt lists "Tailwind CSS" and "Recharts." The **actual installed template uses neither.**

| What was listed | What the template actually uses |
|---|---|
| Tailwind CSS | Sass + Bootstrap 5 via CoreUI SCSS |
| Recharts | Chart.js 4.x via `@coreui/react-chartjs` |

The `.cursorrules` file inside this template explicitly states:
> "NEVER use Tailwind CSS, Material-UI, or other component libraries."
> "Suggest Tailwind CSS or other CSS frameworks" is listed under **What AI Should NOT Do**.

**This entire document follows the actual template stack.** All chart components use `@coreui/react-chartjs`. All styling uses Bootstrap 5 utilities and CoreUI SCSS custom properties.

---

## PART 1 — CURRENT TEMPLATE AUDIT

### What Exists

**Package versions (from package.json):**
- React 19.2.4
- Vite 8.x
- `@coreui/react` 5.10.0
- `@coreui/coreui` 5.6.1 (Bootstrap 5-based CSS)
- React Router 7.x (`HashRouter`)
- Redux 5.x + React-Redux 9.x (`legacy_createStore`, no RTK)
- Chart.js 4.x + `@coreui/react-chartjs` 3.x
- simplebar-react 3.x

**Shell architecture (keep entirely):**
- `App.jsx` — HashRouter, public routes, lazy DefaultLayout
- `layout/DefaultLayout.jsx` — Sidebar + Header + Content + Footer composition
- `components/AppSidebar.jsx` — Redux-driven, unfoldable/narrow mode
- `components/AppSidebarNav.jsx` — renders `_nav` config
- `components/AppContent.jsx` — renders routes.js via Suspense
- `components/AppBreadcrumb.jsx` — builds breadcrumbs from routes.js names
- `components/AppHeader.jsx` — sticky, scroll-shadow, theme switcher
- `components/AppFooter.jsx` — minimal footer
- `store.js` — `sidebarShow` + `theme`

**Current state of `_nav.jsx`:** ~12 demo groups (Theme, Base, Buttons, Forms, Charts, Icons, Notifications, Widgets, Pages, Docs) — **all to be replaced**.

**Current state of `routes.js`:** ~40 demo routes — **all to be replaced**.

---

### What to DELETE (demo content, not needed in HMA IEMS)

| Path | Action |
|---|---|
| `src/views/base/` | Delete entirely |
| `src/views/buttons/` | Delete entirely |
| `src/views/charts/` | Delete entirely |
| `src/views/forms/` | Delete entirely |
| `src/views/icons/` | Delete entirely |
| `src/views/notifications/` | Delete entirely |
| `src/views/theme/` | Delete entirely |
| `src/views/widgets/` | Delete entirely |
| `src/views/pages/register/` | Delete (no self-registration in HMA IEMS) |
| `src/views/dashboard/Dashboard.jsx` | Full replacement |
| `src/views/dashboard/MainChart.jsx` | Delete |
| `src/components/DocsComponents.jsx` | Delete |
| `src/components/DocsExample.jsx` | Delete |
| `src/components/DocsIcons.jsx` | Delete |
| `src/components/DocsLink.jsx` | Delete |

**In `App.jsx`:** Remove `examples.scss` import. Remove Register route.

**In `AppHeader.jsx`:** Remove the demo nav links (Dashboard/Users/Settings). Remove the bell/list/mail icon row.

**In `AppHeaderDropdown.jsx`:** Remove Tasks, Comments, Payments, Projects, Lock Account items.

**In `AppFooter.jsx`:** Update copyright text to HMA.

---

### What to KEEP AND MODIFY

| File | Change |
|---|---|
| `App.jsx` | Remove register route + examples.scss only |
| `layout/DefaultLayout.jsx` | No change |
| `components/AppSidebar.jsx` | Replace brand logo with HMA logo only |
| `components/AppSidebarNav.jsx` | No change |
| `components/AppContent.jsx` | No change |
| `components/AppBreadcrumb.jsx` | No change |
| `components/AppHeader.jsx` | Remove demo links, keep sidebar toggle + theme switcher + user dropdown |
| `components/AppFooter.jsx` | Update text only |
| `components/header/AppHeaderDropdown.jsx` | Redesign to show employee name, role, profile, logout only |
| `store.js` | Add `user` and `token` fields to state |
| `scss/style.scss` | Add import for `_custom.scss` |
| `views/pages/login/Login.jsx` | Full redesign |
| `views/pages/page404/Page404.jsx` | Minor restyle |
| `views/pages/page500/Page500.jsx` | Minor restyle |

---

## PART 2 — SIDEBAR REDESIGN

### New `_nav.jsx` Structure

The entire existing content is replaced. New structure:

```
[CNavItem]  Dashboard                         → /dashboard
            Icon: cilSpeedometer
            Visible to: ALL roles

[CNavGroup] Projects                          → /projects
            Icon: cilFolder
            Visible to: ALL roles
  [CNavItem]  CSR Projects                    → /projects/csr
  [CNavItem]  LSGB Projects                   → /projects/lsgb
  [CNavItem]  Other Projects                  → /projects/other

[CNavItem]  Staff & Payroll                   → /staff
            Icon: cilPeople
            Visible to: CEO, Heads, HR, Finance  (hidden from ProjectOfficer)

[CNavItem]  Attendance                        → /attendance
            Icon: cilCalendar
            Visible to: CEO, Heads, HR, Finance  (hidden from ProjectOfficer)

[CNavItem]  Expense Management                → /expenses
            Icon: cilMoney (or cilDollar)
            Visible to: CEO, Heads, HR, Finance  (hidden from ProjectOfficer)

[CNavItem]  Finance                           → /finance
            Icon: cilChart
            Visible to: CEO, Heads, HR, Finance  (hidden from ProjectOfficer)

[CNavItem]  Reports & Analysis                → /reports
            Icon: cilChartLine
            Visible to: ALL roles

[CNavItem]  Audit Logs                        → /audit-logs
            Icon: cilShieldAlt (or cilHistory)
            Visible to: ALL roles
```

### Role-Based Nav Rendering Strategy

Each nav item object gets an optional `roles` array property:

```
{ component: CNavItem, name: 'Staff & Payroll', to: '/staff', roles: ['CEO','Heads','HR','Finance'] }
```

`AppSidebarNav.jsx` is modified to filter items based on `user.role` from Redux store before rendering. Items without a `roles` property are shown to all authenticated users.

---

## PART 3 — FINAL PAGE HIERARCHY

```
PUBLIC (no auth required)
├── /login                          Login

PROTECTED (DefaultLayout)
├── /dashboard                      Dashboard

├── /projects                       → redirects to /projects/csr
│   ├── /projects/csr               CSR Project List
│   │   ├── /projects/csr/new       Create Project
│   │   └── /projects/csr/:id       Project Detail
│   │       └── /projects/csr/:id/edit   Edit Project
│   ├── /projects/lsgb              LSGB Project List (same structure)
│   │   ├── /projects/lsgb/new
│   │   └── /projects/lsgb/:id
│   │       └── /projects/lsgb/:id/edit
│   └── /projects/other             Other Project List (same structure)
│       ├── /projects/other/new
│       └── /projects/other/:id
│           └── /projects/other/:id/edit

├── /staff                          Employee Directory
│   ├── /staff/new                  Create Employee (HR only)
│   ├── /staff/:id                  Employee Profile
│   │   └── /staff/:id/edit         Edit Employee (HR only)
│   ├── /staff/payroll              Payroll List
│   │   ├── /staff/payroll/generate Generate Payroll (HR only)
│   │   └── /staff/payroll/:id      Payroll Detail / Payslip
│   └── /staff/increments           Salary Increments (HR only)

├── /attendance                     Attendance Records
│   ├── /attendance/import          Import Attendance (HR only)
│   └── /attendance/corrections     Attendance Corrections (HR only)

├── /expenses                       Expense Records
│   ├── /expenses/upload            Upload Expenses (HR only)
│   └── /expenses/analysis          Expense Analysis

├── /finance                        Finance Overview
│   ├── /finance/upload/1           Finance Upload — Sheet 1 (Finance only)
│   ├── /finance/upload/2           Finance Upload — Sheet 2 (Finance only)
│   ├── /finance/upload/3           Finance Upload — Sheet 3 (Finance only)
│   └── /finance/history            Finance File History

├── /reports                        Reports Overview
│   ├── /reports/projects           Project Reports
│   ├── /reports/attendance         Attendance Reports
│   ├── /reports/payroll            Payroll Reports
│   ├── /reports/expenses           Expense Reports
│   ├── /reports/forecast           Forecast Reports
│   └── /reports/predicted-vs-actual Predicted vs Actual

└── /audit-logs                     Audit Log List
    └── /audit-logs/:id             Audit Log Detail

ERROR PAGES
├── /404
└── /500
```

---

## PART 4 — ROUTING STRUCTURE

### `routes.js` — Full Replacement

All routes use React.lazy for code splitting. Route object shape: `{ path, name, element, roles? }`.

`AppContent.jsx` is updated to filter routes using `user.role` and `ProtectedRoute` wrapper.

```
{ path: '/dashboard',                     name: 'Dashboard',              roles: ALL }

{ path: '/projects',                      name: 'Projects',               roles: ALL }
{ path: '/projects/csr',                  name: 'CSR Projects',           roles: ALL }
{ path: '/projects/csr/new',              name: 'New Project',            roles: ['ProjectOfficer'] }
{ path: '/projects/csr/:id',              name: 'Project Detail',         roles: ALL }
{ path: '/projects/csr/:id/edit',         name: 'Edit Project',           roles: ['ProjectOfficer'] }
{ path: '/projects/lsgb',                 name: 'LSGB Projects',          roles: ALL }
{ path: '/projects/lsgb/new',             name: 'New Project',            roles: ['ProjectOfficer'] }
{ path: '/projects/lsgb/:id',             name: 'Project Detail',         roles: ALL }
{ path: '/projects/lsgb/:id/edit',        name: 'Edit Project',           roles: ['ProjectOfficer'] }
{ path: '/projects/other',                name: 'Other Projects',         roles: ALL }
{ path: '/projects/other/new',            name: 'New Project',            roles: ['ProjectOfficer'] }
{ path: '/projects/other/:id',            name: 'Project Detail',         roles: ALL }
{ path: '/projects/other/:id/edit',       name: 'Edit Project',           roles: ['ProjectOfficer'] }

{ path: '/staff',                         name: 'Staff & Payroll',        roles: ['CEO','Heads','HR','Finance'] }
{ path: '/staff/new',                     name: 'Add Employee',           roles: ['HR'] }
{ path: '/staff/:id',                     name: 'Employee Profile',       roles: ['CEO','Heads','HR','Finance'] }
{ path: '/staff/:id/edit',                name: 'Edit Employee',          roles: ['HR'] }
{ path: '/staff/payroll',                 name: 'Payroll',                roles: ['CEO','Heads','HR','Finance'] }
{ path: '/staff/payroll/generate',        name: 'Generate Payroll',       roles: ['HR'] }
{ path: '/staff/payroll/:id',             name: 'Payroll Detail',         roles: ['CEO','Heads','HR','Finance'] }
{ path: '/staff/increments',              name: 'Salary Increments',      roles: ['HR'] }

{ path: '/attendance',                    name: 'Attendance',             roles: ['CEO','Heads','HR','Finance'] }
{ path: '/attendance/import',             name: 'Import Attendance',      roles: ['HR'] }
{ path: '/attendance/corrections',        name: 'Attendance Corrections', roles: ['HR'] }

{ path: '/expenses',                      name: 'Expense Management',     roles: ['CEO','Heads','HR','Finance'] }
{ path: '/expenses/upload',               name: 'Upload Expenses',        roles: ['HR'] }
{ path: '/expenses/analysis',             name: 'Expense Analysis',       roles: ['CEO','Heads','HR','Finance'] }

{ path: '/finance',                       name: 'Finance',                roles: ['CEO','Heads','HR','Finance'] }
{ path: '/finance/upload/:sheet',         name: 'Finance Upload',         roles: ['Finance'] }
{ path: '/finance/history',               name: 'File History',           roles: ['CEO','Heads','HR','Finance'] }

{ path: '/reports',                       name: 'Reports & Analysis',     roles: ALL }
{ path: '/reports/projects',              name: 'Project Reports',        roles: ALL }
{ path: '/reports/attendance',            name: 'Attendance Reports',     roles: ALL }
{ path: '/reports/payroll',               name: 'Payroll Reports',        roles: ['CEO','Heads','HR','Finance'] }
{ path: '/reports/expenses',              name: 'Expense Reports',        roles: ALL }
{ path: '/reports/forecast',              name: 'Forecast Reports',       roles: ALL }
{ path: '/reports/predicted-vs-actual',   name: 'Predicted vs Actual',    roles: ALL }

{ path: '/audit-logs',                    name: 'Audit Logs',             roles: ALL }
{ path: '/audit-logs/:id',               name: 'Log Detail',             roles: ALL }
```

---

## PART 5 — FOLDER STRUCTURE

```
src/
├── App.jsx                            (modify — remove register route + examples.scss)
├── index.jsx                          (no change)
├── routes.js                          (full replacement)
├── _nav.jsx                           (full replacement)
├── store.js                           (add user + token to state)
│
├── assets/
│   └── brand/
│       ├── logo.jsx                   (replace with HMA full logo SVG)
│       └── sygnet.jsx                 (replace with HMA narrow mark SVG)
│
├── components/
│   ├── AppSidebar.jsx                 (change logo only)
│   ├── AppSidebarNav.jsx              (add role-filter logic)
│   ├── AppHeader.jsx                  (remove demo links)
│   ├── AppContent.jsx                 (add route-level role guard)
│   ├── AppBreadcrumb.jsx              (no change)
│   ├── AppFooter.jsx                  (update text)
│   ├── header/
│   │   ├── AppHeaderDropdown.jsx      (redesign: name, role badge, logout)
│   │   └── index.js
│   ├── index.js
│   └── shared/
│       ├── PageHeader.jsx             (page title + action buttons)
│       ├── StatusBadge.jsx            (colored CBadge by status string)
│       ├── RoleBadge.jsx              (colored CBadge by role string)
│       ├── DataTable.jsx              (CTable + pagination + search wrapper)
│       ├── ConfirmDialog.jsx          (CModal for delete/override confirmation)
│       ├── FileUploadZone.jsx         (drag-drop file upload area)
│       ├── ExportButtonGroup.jsx      (PDF / Excel / Word buttons)
│       ├── SectionCard.jsx            (CCard with title/action slot)
│       ├── FilterBar.jsx              (search + select filters row)
│       ├── EmptyState.jsx             (empty table/list placeholder)
│       ├── ReadOnlyBanner.jsx         (CAlert for locked/completed records)
│       ├── MonthYearPicker.jsx        (month + year select pair)
│       ├── BudgetUtilizationBar.jsx   (labeled CProgress: Budget/Spent/Remaining)
│       └── ProtectedRoute.jsx         (role-gate wrapper component)
│
├── hooks/
│   ├── useAuth.js                     (returns user object from Redux)
│   ├── useRole.js                     (returns current role string)
│   └── usePermission.js               (returns canView/canEdit booleans)
│
├── constants/
│   └── permissions.js                 (PERMISSIONS matrix object)
│
├── layout/
│   └── DefaultLayout.jsx              (no change)
│
├── scss/
│   ├── style.scss                     (add @use './_custom' at end)
│   ├── _custom.scss                   (HMA color tokens, sidebar overrides)
│   └── vendors/
│       └── simplebar.scss             (no change)
│
└── views/
    ├── pages/
    │   ├── login/
    │   │   └── Login.jsx              (full redesign)
    │   ├── page404/
    │   │   └── Page404.jsx            (restyle)
    │   └── page500/
    │       └── Page500.jsx            (restyle)
    │
    ├── dashboard/
    │   └── Dashboard.jsx              (full replacement)
    │
    ├── projects/
    │   ├── ProjectList.jsx            (parameterized by type: csr/lsgb/other)
    │   ├── ProjectDetail.jsx          (tabs: Info / Expenses / Officer History)
    │   ├── ProjectForm.jsx            (create + edit, field-level locks)
    │   └── components/
    │       ├── ProjectStatusBadge.jsx
    │       ├── ProjectExpenseTable.jsx
    │       └── ProjectExpenseForm.jsx (modal)
    │
    ├── staff/
    │   ├── EmployeeDirectory.jsx
    │   ├── EmployeeProfile.jsx        (tabs: Details / Salary / Attendance / Payroll / Docs)
    │   ├── EmployeeForm.jsx           (create + edit)
    │   ├── payroll/
    │   │   ├── PayrollList.jsx
    │   │   ├── PayrollGenerate.jsx    (HR only)
    │   │   └── PayrollDetail.jsx      (payslip view)
    │   ├── increments/
    │   │   └── SalaryIncrements.jsx
    │   └── components/
    │       ├── EmployeeCard.jsx
    │       ├── SalaryHistoryTable.jsx
    │       ├── DocumentsList.jsx
    │       └── PayslipCard.jsx
    │
    ├── attendance/
    │   ├── AttendanceRecords.jsx      (table + calendar toggle)
    │   ├── AttendanceImport.jsx       (HR only — step flow)
    │   ├── AttendanceCorrections.jsx  (HR only)
    │   └── components/
    │       ├── AttendanceCalendar.jsx  (custom monthly grid — built from scratch)
    │       ├── AttendanceTable.jsx
    │       └── CorrectionForm.jsx     (modal)
    │
    ├── expenses/
    │   ├── ExpenseRecords.jsx
    │   ├── ExpenseUpload.jsx          (HR only)
    │   ├── ExpenseAnalysis.jsx
    │   └── components/
    │       ├── ExpenseTable.jsx
    │       └── ExpenseForm.jsx        (modal)
    │
    ├── finance/
    │   ├── FinanceOverview.jsx
    │   ├── FinanceUpload.jsx          (parameterized by sheet: 1/2/3)
    │   ├── FinanceFileHistory.jsx
    │   └── components/
    │       ├── FileHistoryTable.jsx
    │       └── UploadCard.jsx
    │
    ├── reports/
    │   ├── ReportsOverview.jsx        (card grid of report types)
    │   ├── ProjectReports.jsx
    │   ├── AttendanceReports.jsx
    │   ├── PayrollReports.jsx
    │   ├── ExpenseReports.jsx
    │   ├── ForecastReports.jsx
    │   ├── PredictedVsActual.jsx
    │   └── components/
    │       ├── ReportCard.jsx
    │       └── charts/
    │           ├── ExpenseTrendChart.jsx
    │           ├── ProjectUtilizationChart.jsx
    │           ├── ForecastLineChart.jsx
    │           ├── PredictedVsActualChart.jsx
    │           └── SustainabilityGauge.jsx  (custom — built from scratch)
    │
    └── audit-logs/
        ├── AuditLogList.jsx
        ├── AuditLogDetail.jsx
        └── components/
            ├── AuditLogTable.jsx
            └── DiffViewer.jsx              (custom — built from scratch)
```

---

## PART 6 — COMPONENT STRUCTURE (DETAIL)

### Shell Components (CoreUI, keep/modify)

| Component | Role in HMA IEMS | Change |
|---|---|---|
| `AppSidebar` | Fixed sidebar container + brand | Logo only |
| `AppSidebarNav` | Renders `_nav` config | Add role-filter pass |
| `AppHeader` | Sticky top bar + theme switcher | Remove demo links |
| `AppContent` | Route renderer inside container | Add route guard |
| `AppBreadcrumb` | Auto-breadcrumb from routes | No change |
| `AppFooter` | Bottom bar | Text only |
| `DefaultLayout` | Layout composition | No change |
| `AppHeaderDropdown` | User dropdown | Redesign content |

### Shared Components (new, built once)

| Component | Purpose | CoreUI Base |
|---|---|---|
| `PageHeader` | Title + action buttons per page | `CRow`, `CCol`, `CButton` |
| `StatusBadge` | Colored badge for status strings | `CBadge` |
| `RoleBadge` | Colored badge for roles | `CBadge` |
| `DataTable` | Full table with pagination + search | `CTable`, `CPagination` |
| `ConfirmDialog` | Delete/action confirmation | `CModal` |
| `FileUploadZone` | Drag-drop upload area | Custom (no CoreUI equivalent) |
| `ExportButtonGroup` | PDF/Excel/Word buttons | `CButtonGroup`, `CButton` |
| `SectionCard` | Card with title/action slot | `CCard`, `CCardHeader`, `CCardBody` |
| `FilterBar` | Search + selects + date range | `CForm`, `CFormInput`, `CFormSelect` |
| `EmptyState` | Empty list placeholder + CTA | `CCard`, icon, `CButton` |
| `ReadOnlyBanner` | Warning for locked records | `CAlert` |
| `MonthYearPicker` | Month + year select pair | `CFormSelect` |
| `BudgetUtilizationBar` | Budget/Spent/Remaining progress | `CProgress`, labels |
| `ProtectedRoute` | Role gate for route rendering | Pure logic, no CoreUI |

---

## PART 7 — DASHBOARD REDESIGN

The current dashboard is a CRM/e-commerce demo. Full replacement.

### Layout (5 rows)

**Row 1 — KPI Stat Cards** (4 columns: `xs={12} sm={6} xl={3}`)

Using `CWidgetStatsA` — the exact component from the template's `WidgetsDropdown` pattern:

| Card | Value | Sparkline | Color |
|---|---|---|---|
| Active Projects | Count | CChartLine (last 6 months) | primary |
| Active Employees | Count | CChartBar (by type) | info |
| Attendance Rate | % this month | CChartLine | success |
| Total Expenses | ₹ this month | CChartLine | warning |

ProjectOfficer sees: Active Projects, Attendance Rate only (no payroll/employee cards)

**Row 2 — Main Charts** (2 columns: `md={6}`)

Left: Project Status Breakdown — `CChartDoughnut`
- Slices: Draft / Active / Completed / Archived / Cancelled
- Legend below

Right: Monthly Expense Trend — `CChartBar`
- X-axis: last 6 months
- Y-axis: ₹ amount
- Tooltip shows exact figure

ProjectOfficer sees: Project Status chart only (right chart hidden)

**Row 3 — Summary Cards** (2 columns: `md={6}`)

Left: Attendance Summary Card (`SectionCard`)
- Today's Present / Absent / Late counts
- Three `CProgress` bars

Right: Payroll Summary Card (`SectionCard`)
- Last payroll: Month, Total Net Disbursed, Employee Count
- "Generate Payroll" CTA (HR only)

ProjectOfficer: Row 3 hidden entirely

**Row 4 — Recent Activity Tables** (2 columns: `md={6}`)

Left: Recent Projects Table
- Columns: Code | Name | Type | Status | Officer
- "View All" link to /projects

Right: Recent Audit Activity
- Columns: Action | Module | User | Time ago
- "View All" link to /audit-logs

Both tables are `CTable` with `hover` and `responsive` props.

---

## PART 8 — PROJECTS MODULE PAGE DESIGN

### A. Project List Page (`/projects/csr`, `/projects/lsgb`, `/projects/other`)

**Page structure:**
```
PageHeader: "CSR Projects" | "+ New Project" button (ProjectOfficer only)
FilterBar: [Search] [Status ▼] [Project Officer ▼] [Clear Filters]
DataTable
  Columns: Project Code | Project Name | Funder | Location | Value | Start Date | End Date | Status | Officer | Actions
  Status: StatusBadge (Draft=secondary, Active=success, Completed=info, Archived=warning, Cancelled=danger)
  Actions: [View] [Edit] — Edit hidden from CEO/Heads/HR/Finance
  Pagination: 10/20/50 per page
```

Note: `ProjectList.jsx` is a single parameterized component. The `type` prop (`csr`/`lsgb`/`other`) determines the API call and page title. No duplicate files.

### B. Project Detail Page (`/projects/:type/:id`)

Uses `CTabs` from `@coreui/react`:

**Tab 1 — Project Info**
- Two-column form layout (read-only display)
- Fields: Code, Name, Type, Funder, Location, Value (locked badge next to it), Start Date, End Date, Assigned Officer, Status, Remarks
- Status change dropdown (ProjectOfficer only, disabled when Completed)
- "Edit Project" button (ProjectOfficer only, disabled when Completed)
- `ReadOnlyBanner` displayed at top when status = Completed

**Tab 2 — Actual Expenses**
- `BudgetUtilizationBar`: Total Budget | Total Spent | Remaining (colored CProgress)
- "+ Add Expense" button (Finance and ProjectOfficer only, disabled for Completed)
- Expense table: Category | Date | Amount | Remarks | Added By | Updated By | Actions
- Actions: Edit | Delete (Finance and ProjectOfficer only, disabled for Completed)
- `ReadOnlyBanner` overlays when status = Completed

**Tab 3 — Officer History**
- Read-only CTable
- Columns: Previous Officer | New Officer | Changed By | Changed On | Remarks

**Project Expense Add/Edit — `CModal` (not a separate page):**
- Category (CFormSelect)
- Date (CFormInput type=date)
- Amount (CFormInput type=number)
- Remarks (CFormTextarea)
- `ConfirmDialog` on delete action

### C. Project Create/Edit Form (`/projects/:type/new`, `/projects/:type/:id/edit`)

Dedicated page (not modal — form is substantial):

Two-column CForm layout:
- Project Name | Project Type (CSR/LSGB/Other)
- Other Type Name (visible only when Type=Other, via conditional render)
- Funder | Location
- Project Value (read-only in edit mode with lock icon + tooltip)
- Start Date | End Date
- Assigned Project Officer (CFormSelect of employees with role=ProjectOfficer)
- Status (CFormSelect — hidden in create mode, shown in edit)
- Remarks (full-width CFormTextarea)

Submit: "Create Project" / "Save Changes" | Cancel button

---

## PART 9 — STAFF & PAYROLL PAGE DESIGN

### A. Employee Directory (`/staff`)

```
PageHeader: "Employee Directory" | "+ Add Employee" (HR only)
FilterBar: [Search by name/ID] [Department ▼] [Type ▼: Permanent/FTC/TPC] [Status ▼]
```

Two view modes (toggle):
- **Grid View** (default): CRow of EmployeeCards — Avatar, Name, ID, Designation, Department, StatusBadge, "View Profile" CButton
- **Table View**: CTable — ID | Name | Designation | Dept | Type | Status | Join Date | Actions

### B. Employee Profile (`/staff/:id`)

Split layout:
- **Left sidebar** (col-md-3): CCard with Avatar, Name, Employee ID, Designation, Department, StatusBadge, Employee Type, Join Date, Edit button (HR only)
- **Right content** (col-md-9): CTabs

**Tab 1 — Personal Details**
- Two-column read-only display: Full Name, Email, Phone, Join Date, Exit Date (if any)
- Employment: Type, Status, Designation, Department
- Edit button (HR only) navigates to `/staff/:id/edit`

**Tab 2 — Salary History**
- "+ Add Increment" button (HR only)
- CTable: Old Salary | Increment % | Increment Amount | New Salary | Effective Date | Remarks | Changed By
- Modal for Add Increment: Employee (read-only), Current Salary (read-only), Increment % (input, auto-calculates new salary), Effective Date, Remarks

**Tab 3 — Attendance Summary**
- MonthYearPicker filter
- Summary row: Present | Absent | Late | Half Day | Leave (colored number badges)
- Monthly CTable: Date | Punch In | Punch Out | Hours | Status | Late Minutes

**Tab 4 — Payroll History**
- CTable: Month | Year | Gross | Deductions | Net | Status | Payslip
- Payslip column: "Download" CButton (opens PayslipCard in modal or new window)

**Tab 5 — Documents**
- "+ Upload Document" button (HR only)
- List: Document Type | File Name | Uploaded By | Upload Date | Download | Delete (HR only)

### C. Payroll List (`/staff/payroll`)

```
PageHeader: "Payroll" | "Generate Payroll" CButton (HR only)
FilterBar: [Month ▼] [Year ▼] [Employee search]
```

CTable: Employee | Employee ID | Month | Gross Salary | Deductions | Net Salary | Status | Generated On | Actions
- Status: Generated (info) | Locked (success) | Override (warning)
- Actions: View Payslip | Override (HR only, opens confirmation + remarks modal)
- CProgress bar in Deductions column showing % of gross

### D. Salary Increments (`/staff/increments`)

```
PageHeader: "Salary Increments" | "+ Add Increment" (HR only)
FilterBar: [Month ▼] [Year ▼] [Employee search]
CTable: Employee | Employee ID | Old Salary | Increment % | Increment Amount | New Salary | Effective Date | Added By | Remarks
```

---

## PART 10 — ATTENDANCE PAGE DESIGN

### A. Attendance Records (`/attendance`)

```
PageHeader: "Attendance Records"
FilterBar: [Month ▼] [Year ▼] [Employee search] | Toggle: [Table View] [Calendar View]
```

**Table View:**
CTable (responsive): Employee ID | Employee Name | Date | Punch In | Punch Out | Total Hours | Status | Late Minutes | Source
- Status badges: Present (success) | Absent (danger) | Half Day (warning) | Late (info) | Leave (secondary)
- Source badge: Machine | Excel

**Calendar View (custom `AttendanceCalendar` component):**
- Monthly grid layout
- Y-axis: Employee names
- X-axis: Days of month
- Each cell: colored dot/chip based on attendance status
- Click cell → inline popover with punch-in/out details

### B. Import Attendance (`/attendance/import`) — HR only

**Step-by-step flow using manually-built step indicator (CProgress or custom):**

Step 1 — Select Source
- Two CCard option cards: "Punch Machine Data" | "Excel Upload"

Step 2 — Upload File
- `FileUploadZone` component
- Accepted formats: .xlsx, .xls, .csv
- File size limit shown

Step 3 — Preview & Map Columns
- `ColumnMapper` component: shows uploaded columns, allows mapping to expected fields (Employee ID, Date, Punch In, Punch Out)
- Preview table of first 10 rows

Step 4 — Validate
- Validation summary: Total Rows | Valid | Errors
- Errors listed with row number and issue description

Step 5 — Confirm
- "Confirm Import" CButton
- Success: summary card (X records imported, Y skipped)

### C. Attendance Corrections (`/attendance/corrections`) — HR only

```
PageHeader: "Attendance Corrections" | "+ Add Correction"
FilterBar: [Employee search] [Date range] [Month ▼]
```

CTable (corrections history): Employee | Date | Original Status | Corrected Status | Reason | Corrected By | Corrected On

Correction Form (CModal):
- Employee (CFormSelect)
- Date (CFormInput type=date)
- Original Value (read-only, auto-populated after date selection)
- Corrected Status (CFormSelect: Present/Absent/Half Day/Leave)
- Reason (CFormTextarea, required)
- Remarks (optional CFormTextarea)

---

## PART 11 — EXPENSE MANAGEMENT PAGE DESIGN

### A. Expense Records (`/expenses`)

```
PageHeader: "Expense Management" | "+ Add Expense" (HR only)
FilterBar: [Search] [Category ▼] [Source ▼: Manual/Excel] [Date from] [Date to]
```

CTable: Title | Category | Amount | Date | Source | Added By | Created | Actions
- Actions: Edit | Delete (HR only)
- Amounts right-aligned, formatted as ₹

Add/Edit modal (`CModal`):
- Expense Title, Category (CFormSelect), Amount, Date, Remarks, Source (auto-set)

### B. Upload Expenses (`/expenses/upload`) — HR only

Same step flow as Attendance Import (Step 1=Upload, Step 2=Preview, Step 3=Validate, Step 4=Confirm)
- Accepted: .xlsx, .xls
- Required columns: Title, Category, Amount, Date

### C. Expense Analysis (`/expenses/analysis`)

```
FilterBar: [Year ▼] [Month ▼ or "Year View"]
```

Row 1 — Summary KPI cards: Total This Month | Total This Year | Largest Category | Largest Single Expense

Row 2 — Charts (2 columns):
- Left: `CChartDoughnut` — Expense breakdown by Category (current month/selected period)
- Right: `CChartBar` — Top 5 categories by total amount

Row 3 — Full width: `CChartLine` — 12-month expense trend

---

## PART 12 — FINANCE PAGE DESIGN

### A. Finance Overview (`/finance`)

Three `SectionCard` components side-by-side (col-md-4 each), one per Finance Upload type:

Each card shows:
- Upload type title ("Finance Sheet 1", etc.)
- Latest file: name, version, upload date, uploaded by
- Download latest CButton
- Upload New Version CButton (Finance only)

Below the cards: Recent activity CTable
- File | Action | Version | User | Timestamp | Remarks

### B. Finance Upload Page (`/finance/upload/:sheet`)

Parameterized by sheet number (1, 2, 3).

Title: "Finance Upload — Sheet {n}"
- Current file info card (name, version, uploaded by, date)
- `FileUploadZone` — .xlsx, .xls only
- Version notes CFormTextarea
- Confirm Upload CButton (Finance only)

Below: Version History CTable
- Version | File Name | Uploaded By | Date | Remarks | Download

### C. Finance File History (`/finance/history`)

Cross-sheet view:
FilterBar: [Sheet ▼: All/1/2/3] [Date range] [Uploaded by]
CTable: Sheet | Version | File Name | Uploaded By | Date | Remarks | Download

---

## PART 13 — REPORTS & ANALYSIS PAGE DESIGN

### A. Reports Overview (`/reports`)

Grid of `ReportCard` components (col-md-4):
- Icon + Title + Description + "Open Report" CButton
- Cards: Project Reports | Attendance Reports | Payroll Reports | Expense Reports | Forecast Reports | Predicted vs Actual
- Payroll Reports card hidden from ProjectOfficer

### B. Project Reports (`/reports/projects`)

FilterBar: [Project Type ▼] [Status ▼] [Project Officer ▼] [Date range]

Charts:
- Row 1 — Two columns:
  - Left: `CChartBar` (horizontal) — Top 10 projects by budget utilization %
  - Right: `CChartDoughnut` — Project status distribution
- Row 2: `CChartLine` — Monthly project expense trend (line per project type)

Table: Project Code | Name | Type | Total Value | Total Spent | Remaining | Utilization % | Status

ExportButtonGroup: PDF | Excel | Word

### C. Forecast Reports (`/reports/forecast`)

Header note: CAlert info — "Forecast data provided by the ML team."

Row 1 — Forecast KPI cards (4 columns):
- Projected Expenses (next month) | Revenue Forecast | Profit/Loss Estimate | Sustainability Score

Row 2 — Charts:
- Left: `CChartLine` — Predicted expense trend (next 6 months) with dashed line style
- Right: `SustainabilityGauge` — Custom gauge component (0-100 score)

Row 3 — Forecast Table: Period | Forecast Type | Projected Value | Confidence Note | Model | Created

### D. Predicted vs Actual (`/reports/predicted-vs-actual`)

FilterBar: [Project ▼] [Year ▼] [Month range]

`PredictedVsActualChart`: `CChartLine` with two datasets (Predicted=dashed, Actual=solid) + annotation markers on variance points

Variance Table: Month | Predicted | Actual | Variance (₹) | Variance (%) | Over/Under badge

ExportButtonGroup: PDF | Excel | Word

---

## PART 14 — AUDIT LOG PAGE DESIGN

### A. Audit Log List (`/audit-logs`)

```
PageHeader: "Audit Logs" (no action buttons — view only)
FilterBar: [Module ▼] [Action Type ▼] [User search] [Role ▼] [Date range] [Clear]
```

CTable (striped, read-only):
Timestamp | User | Role | Module | Action | Record ID | IP Address | [Details button]

- No Edit / Delete buttons anywhere on this page
- "Details" opens `AuditLogDetail` at `/audit-logs/:id`
- Pagination: 20 per page default

### B. Audit Log Detail (`/audit-logs/:id`)

CCard layout:
- Header: Module / Action / Timestamp
- Info row: User, Role, IP Address, Record ID
- `DiffViewer` component: two-column side-by-side (Old Value | New Value)
  - Values displayed as formatted key-value pairs or JSON
  - Changed fields highlighted in yellow
- Remarks section below
- Back button → `/audit-logs`
- No Edit button — strictly read-only

---

## PART 15 — REUSABLE SHARED COMPONENTS

| Component | Props | CoreUI Base | Notes |
|---|---|---|---|
| `PageHeader` | `title`, `actions[]` | `CRow`, `CCol`, `CButton` | Action buttons are role-gated externally |
| `StatusBadge` | `status`, `size?` | `CBadge` | Color map object for all status strings |
| `RoleBadge` | `role` | `CBadge` | Color per role |
| `DataTable` | `columns`, `data`, `pagination?`, `loading?` | `CTable`, `CPagination` | Sort, filter, empty state built-in |
| `ConfirmDialog` | `visible`, `title`, `message`, `onConfirm`, `onCancel` | `CModal` | Used for all delete/override flows |
| `FileUploadZone` | `accept`, `onFile`, `maxSize?` | Custom div + HTML drag events | Progress bar during upload |
| `ExportButtonGroup` | `onPdf`, `onExcel`, `onWord`, `loading?` | `CButtonGroup`, `CButton` | Loading spinner on active export |
| `SectionCard` | `title`, `action?`, `children` | `CCard` | Consistent card layout across all modules |
| `FilterBar` | `filters[]` (config-driven) | `CForm`, `CRow`, `CCol` | Search + selects + date range in one row |
| `EmptyState` | `title`, `message`, `action?` | `CCard`, icon | Shown when DataTable has no rows |
| `ReadOnlyBanner` | `message?` | `CAlert` color=warning | Shown for Completed projects, locked payroll |
| `MonthYearPicker` | `month`, `year`, `onChange` | `CFormSelect` (x2) | Used in attendance + payroll + reports |
| `BudgetUtilizationBar` | `budget`, `spent`, `remaining` | `CProgress` + labels | Used in project detail expenses tab |
| `ProtectedRoute` | `roles[]`, `children` | Pure logic | Redirects to /dashboard if role not allowed |

---

## PART 16 — COREUI COMPONENTS TO REUSE DIRECTLY

### Layout & Navigation
- `CSidebar`, `CSidebarBrand`, `CSidebarHeader`, `CSidebarFooter`, `CSidebarToggler`
- `CNavItem`, `CNavGroup`, `CNavTitle` (sidebar nav items)
- `CHeader`, `CHeaderNav`, `CHeaderToggler` (top header)
- `CBreadcrumb`, `CBreadcrumbItem`
- `CContainer`, `CRow`, `CCol`

### Data Display
- `CTable`, `CTableHead`, `CTableBody`, `CTableRow`, `CTableHeaderCell`, `CTableDataCell` (all tables)
- `CBadge` (status + role badges)
- `CProgress`, `CProgressBar` (budget + attendance bars)
- `CAvatar` (employee photos)
- `CWidgetStatsA` (dashboard KPI cards with sparklines)
- `CPagination`, `CPaginationItem`

### Forms
- `CForm`, `CFormInput`, `CFormLabel`, `CFormSelect`, `CFormTextarea`, `CFormCheck`
- `CInputGroup`, `CInputGroupText`
- `CFormFeedback` (validation messages)

### Modals & Overlays
- `CModal`, `CModalHeader`, `CModalTitle`, `CModalBody`, `CModalFooter`
- `CToast`, `CToaster` (success/error notifications after actions)
- `CAlert` (inline messages, ReadOnlyBanner)
- `CSpinner` (loading states)

### Navigation & Tabs
- `CTabs`, `CTabList`, `CTab`, `CTabContent`, `CTabPanel` (project detail, employee profile)
- `CDropdown`, `CDropdownMenu`, `CDropdownItem`, `CDropdownToggle`

### Buttons
- `CButton`, `CButtonGroup`
- `CCloseButton`

### Cards
- `CCard`, `CCardHeader`, `CCardBody`, `CCardFooter`, `CCardTitle`, `CCardText`

### Charts (from `@coreui/react-chartjs`)
- `CChartLine` — trend lines, sparklines, forecast lines
- `CChartBar` — comparison charts, stacked bars
- `CChartDoughnut` — status breakdowns, category breakdowns
- `CChartPie` — alternative to doughnut
- Sparklines inside `CWidgetStatsA` use `CChartLine` and `CChartBar` inline

### Icons (from `@coreui/icons`)
All icons used from `@coreui/icons` via `CIcon`. Proposed icon assignments:

| Module | Icon |
|---|---|
| Dashboard | `cilSpeedometer` |
| Projects | `cilFolder` |
| Staff & Payroll | `cilPeople` |
| Attendance | `cilCalendar` |
| Expense Management | `cilMoney` |
| Finance | `cilChart` |
| Reports & Analysis | `cilChartLine` |
| Audit Logs | `cilShieldAlt` |
| Add/Create | `cilPlus` |
| Edit | `cilPencil` |
| Delete | `cilTrash` |
| Download | `cilCloudDownload` |
| Upload | `cilCloudUpload` |
| Lock | `cilLockLocked` |
| View | `cilEye` |
| Employee | `cilUser` |
| Export PDF | `cilFile` |
| Export Excel | `cilSpreadsheet` |

---

## PART 17 — COMPONENTS TO BUILD FROM SCRATCH

These have no equivalent in CoreUI and must be custom-built:

| Component | Why custom | Complexity |
|---|---|---|
| `AttendanceCalendar` | Monthly grid with per-cell status coloring — no CoreUI calendar | High |
| `FileUploadZone` | Drag-and-drop with progress — CoreUI has no file upload component | Medium |
| `ColumnMapper` | Excel column → field mapping UI for imports | High |
| `DiffViewer` | Side-by-side old/new value diff for audit logs | Medium |
| `SustainabilityGauge` | Gauge chart (0-100 score indicator) — Chart.js has no gauge, needs custom canvas | High |
| `PredictedVsActualChart` | Dual-series line with dashed "predicted" styling + variance annotations | Medium |
| `PayslipCard` | Formatted payslip for print/PDF — structured document layout | Medium |
| `ReadOnlyBanner` | Trivial — `CAlert` wrapper with lock icon and standard message | Low |
| `BudgetUtilizationBar` | Labeled multi-segment progress — combines CProgress + text calculations | Low |
| `ExportButtonGroup` | Button group with PDF/Excel/Word + loading states | Low |
| `MonthCalendarView` | Monthly attendance overview grid for HR | High |

---

## PART 18 — RESPONSIVE DESIGN STRATEGY

### Breakpoint Grid (Bootstrap 5 / CoreUI)

| Breakpoint | Width | Sidebar | Layout | Tables |
|---|---|---|---|---|
| xs | < 576px | Hidden (overlay drawer) | 1 column | Essential columns only |
| sm | ≥ 576px | Hidden (overlay drawer) | 1-2 col | Scroll horizontal |
| md | ≥ 768px | Narrow/icon mode | 2 column | Scroll horizontal |
| lg | ≥ 992px | Full width visible | Multi-column | Full columns |
| xl | ≥ 1200px | Full width + unfoldable | Full layout | Full columns |

### Sidebar Behavior
- Desktop (lg+): Always visible, toggle to icon-narrow mode via `CSidebarToggler`
- Tablet (md): Sidebar defaults to narrow/unfoldable mode on first load
- Mobile (sm/xs): Sidebar hidden by default, hamburger menu → `CSidebar` with `visible` prop, `CCloseButton` shown

### Table Responsiveness
- All `CTable` components use `responsive` prop → horizontal scroll container
- On mobile: hide non-essential columns with `d-none d-md-table-cell`
- Essential columns always shown: Name/ID, Date/Period, Status, one value column
- "Expand row" pattern for detail on mobile not implemented in Phase 1 (use responsive scroll instead)

### Dashboard Cards
- `CRow` with `xs={{ cols: 1 }} sm={{ cols: 2 }} xl={{ cols: 4 }}` for KPI row
- Charts stacked to 1 column on xs/sm: `md={6}` → `xs={12} md={6}`

### Modals
- `CModal` with `size="lg"` on desktop, `size="xl"` avoided — CoreUI modals are inherently responsive (full-width on mobile)

### Forms
- Desktop: two-column CRow layout (`col-md-6` per field)
- Mobile: single column (Bootstrap 5 grid handles this automatically)

### Key Rules
1. Always add `responsive` to every `CTable`
2. Use `d-none d-md-flex` for header action buttons on mobile → use dropdown or floating button
3. KPI sparklines removed on xs screens (`d-none d-sm-block` wrapper on sparkline area)
4. Breadcrumb hidden on xs (`d-none d-md-block`)

---

## PART 19 — ROLE-BASED UI VISIBILITY STRATEGY

### Architecture: Redux + Permission Hook

**Step 1 — Store user in Redux**

`store.js` initial state expands to:
```
{ sidebarShow: true, theme: 'light', user: null, token: null }
```
After login: `dispatch({ type: 'set', user: { id, name, role, employeeId }, token: '...' })`

**Step 2 — Permission constants (`constants/permissions.js`)**

Single source of truth — one object, never duplicated:
```
PERMISSIONS = {
  projects:         { view: ['CEO','Heads','HR','Finance','ProjectOfficer'], edit: ['ProjectOfficer'] },
  projectExpenses:  { view: ['CEO','Heads','HR','Finance','ProjectOfficer'], edit: ['Finance','ProjectOfficer'] },
  staff:            { view: ['CEO','Heads','HR','Finance'],                  edit: ['HR'] },
  attendance:       { view: ['CEO','Heads','HR','Finance'],                  edit: ['HR'] },
  expenses:         { view: ['CEO','Heads','HR','Finance'],                  edit: ['HR'] },
  finance:          { view: ['CEO','Heads','HR','Finance'],                  edit: ['Finance'] },
  reports:          { view: ['CEO','Heads','HR','Finance','ProjectOfficer'], edit: [] },
  auditLogs:        { view: ['CEO','Heads','HR','Finance','ProjectOfficer'], edit: [] },
  passwordReset:    { view: [],                                              edit: ['HR'] },
}
```

**Step 3 — `usePermission` hook**

```
usePermission(module, action) → boolean
// e.g. usePermission('projects', 'edit') → true if current user role is ProjectOfficer
```

**Step 4 — Application points**

| Where | Strategy |
|---|---|
| Sidebar nav | `_nav` items have `roles[]` array; `AppSidebarNav` filters before render |
| Route guard | `ProtectedRoute` wraps each protected route; redirects to `/dashboard` if role not in `roles[]` |
| Action buttons (Add/Edit/Delete) | `{canEdit && <CButton>}` using `usePermission` |
| Form fields | `readOnly` or `disabled` prop based on `canEdit` |
| Completed project | All forms unconditionally read-only regardless of role (business rule, not RBAC) |
| Table action column | Entire column hidden with `{canEdit && <CTableHeaderCell>}` |
| Dashboard cards | Role-specific cards use `{canView && <CCol>}` |

**Step 5 — Additional data-state locks (beyond RBAC)**

These are business rules applied on top of permission checks:
- Completed project: all edits locked (status=Completed → all forms read-only)
- Locked payroll: `is_locked=true` → edit blocked, override flow required (HR only)
- Locked attendance: uploaded attendance → corrections only through Corrections page, not inline edit
- Immutable audit logs: no edit/delete UI exists anywhere, by design

---

## PART 20 — SUGGESTED CHARTS AND TABLES

### Chart Inventory by Page

| Page | Chart | Type | Component | X-axis | Y-axis | Purpose |
|---|---|---|---|---|---|---|
| Dashboard | KPI sparkline 1 | Line | `CChartLine` inside `CWidgetStatsA` | Months (6) | Project count | Trend |
| Dashboard | KPI sparkline 2 | Bar | `CChartBar` inside `CWidgetStatsA` | Months | Headcount | Trend |
| Dashboard | Project status | Doughnut | `CChartDoughnut` | — | Count by status | Breakdown |
| Dashboard | Monthly expenses | Bar | `CChartBar` | Last 6 months | ₹ | Trend |
| Project Reports | Budget utilization | Horizontal Bar | `CChartBar` | Projects | % utilized | Comparison |
| Project Reports | Status distribution | Doughnut | `CChartDoughnut` | — | Count | Breakdown |
| Project Reports | Expense over time | Line | `CChartLine` | Months | ₹ by type | Multi-series |
| Attendance | Dept attendance | Bar | `CChartBar` | Departments | % present | Comparison |
| Attendance | Monthly trend | Line | `CChartLine` | Months | % present | Trend |
| Expense Analysis | Category split | Doughnut | `CChartDoughnut` | — | ₹ by category | Breakdown |
| Expense Analysis | Top 5 categories | Horizontal Bar | `CChartBar` | Categories | ₹ | Comparison |
| Expense Analysis | Monthly trend | Line | `CChartLine` | 12 months | ₹ | Trend |
| Payroll Reports | Monthly total | Bar | `CChartBar` | Months | ₹ net | Trend |
| Payroll Reports | Gross vs deductions | Stacked Bar | `CChartBar` (stacked) | Employees | ₹ | Comparison |
| Forecast Reports | Expense forecast | Line (dashed) | `CChartLine` | Future months | ₹ predicted | Forecast |
| Forecast Reports | Sustainability | Gauge | Custom canvas | — | 0-100 | Score |
| Predicted vs Actual | Dual comparison | Line (2 series) | `CChartLine` | Months | ₹ | Comparison |

### Key Table Column Definitions

| Table | Location | Columns | Sortable | Filterable |
|---|---|---|---|---|
| Project List | `/projects/:type` | Code, Name, Funder, Location, Value, Start, End, Status, Officer, Actions | Status, Date | Status, Officer, Search |
| Project Expenses | Project Detail Tab 2 | Category, Date, Amount, Remarks, Added By, Updated By, Actions | Date, Amount | Category |
| Employee Directory | `/staff` | ID, Name, Designation, Dept, Type, Status, Join Date, Actions | Name, Join Date | Type, Status, Dept |
| Salary History | Employee Profile Tab 2 | Old, Increment%, Amount, New, Effective Date, Changed By, Remarks | Date | — |
| Attendance Records | `/attendance` | Employee ID, Name, Date, Punch In, Punch Out, Hours, Status, Late Min, Source | Date, Status | Status, Source, Employee |
| Attendance Corrections | `/attendance/corrections` | Employee, Date, Original, Corrected, Reason, By, On | Date | Employee |
| Payroll | `/staff/payroll` | Employee, ID, Month, Year, Gross, Deductions, Net, Status, Generated On, Actions | Month/Year | Month, Year, Status |
| Expense Records | `/expenses` | Title, Category, Amount, Date, Source, Added By, Actions | Date, Amount | Category, Source |
| Finance History | `/finance/history` | Sheet, Version, File, Uploaded By, Date, Remarks, Download | Date | Sheet |
| Audit Logs | `/audit-logs` | Timestamp, User, Role, Module, Action Type, Record ID, IP, Details | Timestamp | Module, Action, Role, User |

---

## PART 21 — FULL IMPLEMENTATION ROADMAP

### Phase 0 — Foundation Cleanup
**Duration: 2 days | Goal: Clean slate, HMA shell established**

| # | Task |
|---|---|
| 0.1 | Delete all views/base, views/buttons, views/forms, views/icons, views/notifications, views/theme |
| 0.2 | Delete views/widgets (WidgetsDropdown, WidgetsBrand, Widgets.jsx) |
| 0.3 | Delete views/pages/register |
| 0.4 | Delete DocsComponents, DocsExample, DocsIcons, DocsLink from components/ |
| 0.5 | Clear routes.js to empty skeleton |
| 0.6 | Clear _nav.jsx to empty skeleton |
| 0.7 | Remove `import './scss/examples.scss'` from App.jsx |
| 0.8 | Remove Register route from App.jsx |
| 0.9 | Strip AppHeader demo links + icon strip |
| 0.10 | Redesign AppHeaderDropdown (name, role badge, Profile link, Logout) |
| 0.11 | Update AppFooter copyright |
| 0.12 | Create `constants/permissions.js` (PERMISSIONS matrix) |
| 0.13 | Expand `store.js` with `user` and `token` initial state |
| 0.14 | Create `hooks/useAuth.js`, `hooks/useRole.js`, `hooks/usePermission.js` |
| 0.15 | Create `components/shared/ProtectedRoute.jsx` |
| 0.16 | Create `scss/_custom.scss`, add `@use` in style.scss |

---

### Phase 1 — Login + Auth Shell
**Duration: 2 days | Goal: Working login with role routing**

| # | Task |
|---|---|
| 1.1 | Redesign `Login.jsx` — HMA branding, Employee ID field, no register link, no "Forgot password?" (HR resets only) |
| 1.2 | Connect login form to Redux dispatch (local mock auth until API ready) |
| 1.3 | Implement post-login redirect → /dashboard |
| 1.4 | Implement unauthenticated redirect → /login in ProtectedRoute |
| 1.5 | Implement role-based sidebar filtering in AppSidebarNav |
| 1.6 | Test all 5 roles' sidebar visibility with mock user objects |
| 1.7 | Update App.jsx theme key from demo template name to 'hma-iems-theme' |

---

### Phase 2 — Dashboard
**Duration: 2 days | Goal: Working dashboard with placeholder/static data**

| # | Task |
|---|---|
| 2.1 | Replace Dashboard.jsx — KPI cards row using CWidgetStatsA |
| 2.2 | Project status doughnut chart (CChartDoughnut) |
| 2.3 | Monthly expense bar chart (CChartBar, last 6 months) |
| 2.4 | Attendance summary card (CProgress bars) |
| 2.5 | Payroll summary card |
| 2.6 | Recent projects CTable |
| 2.7 | Recent audit activity CTable |
| 2.8 | Apply role-based card/row visibility (ProjectOfficer view) |
| 2.9 | Update _nav.jsx with Dashboard entry |
| 2.10 | Update routes.js with /dashboard route |

---

### Phase 3 — Projects Module
**Duration: 5 days | Goal: Full project CRUD + expenses**

| # | Task |
|---|---|
| 3.1 | Build `ProjectList.jsx` (parameterized by type, CTable + filters) |
| 3.2 | Build `ProjectStatusBadge.jsx` |
| 3.3 | Build `ProjectDetail.jsx` with CTabs (Info, Expenses, Officer History) |
| 3.4 | Build `BudgetUtilizationBar` shared component |
| 3.5 | Build `ProjectExpenseTable.jsx` inside detail Expenses tab |
| 3.6 | Build `ProjectExpenseForm.jsx` (CModal — add/edit) |
| 3.7 | Build `ConfirmDialog.jsx` shared component |
| 3.8 | Build `ReadOnlyBanner.jsx` shared component |
| 3.9 | Build `ProjectForm.jsx` (create + edit page with conditional fields) |
| 3.10 | Apply role-based action visibility (add/edit/delete per role) |
| 3.11 | Apply Completed = read-only business rule |
| 3.12 | Update _nav.jsx with Projects CNavGroup (CSR, LSGB, Other) |
| 3.13 | Update routes.js with all /projects/* routes |

---

### Phase 4 — Staff & Payroll Module
**Duration: 6 days | Goal: Employee directory + profile + payroll**

| # | Task |
|---|---|
| 4.1 | Build `EmployeeDirectory.jsx` (grid + table toggle, filters) |
| 4.2 | Build `EmployeeCard.jsx` |
| 4.3 | Build `EmployeeProfile.jsx` with CTabs (5 tabs) |
| 4.4 | Build `EmployeeForm.jsx` (create + edit, HR only) |
| 4.5 | Build `SalaryHistoryTable.jsx` + Add Increment modal |
| 4.6 | Build `DocumentsList.jsx` + upload (HR only) |
| 4.7 | Build `MonthYearPicker.jsx` shared component |
| 4.8 | Build `PayrollList.jsx` (month/year filter, status, override) |
| 4.9 | Build `PayrollGenerate.jsx` (HR only, month selector + confirm) |
| 4.10 | Build `PayslipCard.jsx` (modal or printable view) |
| 4.11 | Build `PayrollDetail.jsx` |
| 4.12 | Build `SalaryIncrements.jsx` (list + add modal, HR only) |
| 4.13 | Update _nav.jsx with Staff & Payroll |
| 4.14 | Update routes.js with all /staff/* routes |

---

### Phase 5 — Attendance Module
**Duration: 5 days | Goal: Attendance records + import + corrections**

| # | Task |
|---|---|
| 5.1 | Build `AttendanceTable.jsx` with status color coding |
| 5.2 | Build `AttendanceCalendar.jsx` (custom monthly grid — highest complexity) |
| 5.3 | Build `AttendanceRecords.jsx` (table/calendar toggle, month/year filter) |
| 5.4 | Build `FileUploadZone.jsx` shared component |
| 5.5 | Build `ColumnMapper.jsx` for import step 3 |
| 5.6 | Build `AttendanceImport.jsx` (5-step flow, HR only) |
| 5.7 | Build `CorrectionForm.jsx` (CModal) |
| 5.8 | Build `AttendanceCorrections.jsx` (HR only) |
| 5.9 | Update _nav.jsx and routes.js |

---

### Phase 6 — Expense Management Module
**Duration: 4 days | Goal: Expense records + analysis**

| # | Task |
|---|---|
| 6.1 | Build `ExpenseTable.jsx` |
| 6.2 | Build `ExpenseForm.jsx` (CModal, HR only) |
| 6.3 | Build `ExpenseRecords.jsx` (table + filters) |
| 6.4 | Build `ExpenseUpload.jsx` (step flow, HR only) |
| 6.5 | Build `ExpenseAnalysis.jsx` (3 charts + KPI cards) |
| 6.6 | Build `ExportButtonGroup.jsx` shared component |
| 6.7 | Update _nav.jsx and routes.js |

---

### Phase 7 — Finance Module
**Duration: 4 days | Goal: Finance file management**

| # | Task |
|---|---|
| 7.1 | Build `UploadCard.jsx` (per-sheet status card) |
| 7.2 | Build `FinanceOverview.jsx` (3 upload cards + activity table) |
| 7.3 | Build `FinanceUpload.jsx` (parameterized, Finance only) |
| 7.4 | Build `FileHistoryTable.jsx` |
| 7.5 | Build `FinanceFileHistory.jsx` (cross-sheet history) |
| 7.6 | Update _nav.jsx and routes.js |

---

### Phase 8 — Reports & Analysis Module
**Duration: 5 days | Goal: Full reporting hub**

| # | Task |
|---|---|
| 8.1 | Build `ReportCard.jsx` |
| 8.2 | Build `ReportsOverview.jsx` (card grid, role-filtered) |
| 8.3 | Build `ProjectReports.jsx` (charts + table + export) |
| 8.4 | Build `AttendanceReports.jsx` (charts + table + export) |
| 8.5 | Build `PayrollReports.jsx` (charts + table + export) |
| 8.6 | Build `ExpenseReports.jsx` (reuse analysis charts + export) |
| 8.7 | Build `ForecastReports.jsx` (ML team data display) |
| 8.8 | Build `SustainabilityGauge.jsx` (custom canvas component) |
| 8.9 | Build `PredictedVsActualChart.jsx` (dual-series line) |
| 8.10 | Build `PredictedVsActual.jsx` page |
| 8.11 | Update _nav.jsx and routes.js |

---

### Phase 9 — Audit Logs Module
**Duration: 2 days | Goal: Read-only system log**

| # | Task |
|---|---|
| 9.1 | Build `AuditLogTable.jsx` |
| 9.2 | Build `AuditLogList.jsx` (advanced filters, pagination) |
| 9.3 | Build `DiffViewer.jsx` (custom old/new value comparison) |
| 9.4 | Build `AuditLogDetail.jsx` |
| 9.5 | Update _nav.jsx and routes.js |

---

### Phase 10 — Brand, Polish & QA
**Duration: 5 days | Goal: Responsive, branded, production-ready**

| # | Task |
|---|---|
| 10.1 | Create HMA IEMS logo SVG (full + narrow mark) for sidebar brand |
| 10.2 | Define HMA color tokens in `_custom.scss` (primary color, sidebar bg) |
| 10.3 | Apply HMA branding overrides via CoreUI SCSS custom properties |
| 10.4 | Audit all pages at xs/sm/md/lg breakpoints |
| 10.5 | Add loading states (CSpinner) to all data-fetching views |
| 10.6 | Add EmptyState to all tables when data is empty |
| 10.7 | Add CToast notifications for all create/update/delete/error actions |
| 10.8 | Test all 5 role scenarios (login as each role, verify correct access) |
| 10.9 | Test all business rule locks (Completed project, locked payroll, audit log read-only) |
| 10.10 | Restyle Page404 and Page500 with HMA branding |
| 10.11 | Verify breadcrumbs are correct for all routes |
| 10.12 | Final responsive sweep |

---

### Phase 11 — API Integration
**Duration: 10-15 days | Parallel with backend development**

| # | Task |
|---|---|
| 11.1 | Set up API client (axios instance with base URL + JWT header interceptor) |
| 11.2 | Implement JWT token storage (localStorage or httpOnly cookie — decide with backend) |
| 11.3 | Implement token expiry handling (auto-logout or refresh) |
| 11.4 | Connect Auth module (login, logout, /auth/me on app load) |
| 11.5 | Connect Projects APIs (list, create, update, status change, expenses CRUD) |
| 11.6 | Connect Staff & Payroll APIs (employees, salary history, payroll, documents) |
| 11.7 | Connect Attendance APIs (records, import, corrections) |
| 11.8 | Connect Expense APIs (records, upload, analysis data) |
| 11.9 | Connect Finance APIs (files, upload, history) |
| 11.10 | Connect Reports APIs (all report endpoints, export triggers) |
| 11.11 | Connect Audit Logs API |
| 11.12 | Connect Dashboard summary API |
| 11.13 | End-to-end testing across all roles |

---

## SUMMARY — WHAT CHANGES vs WHAT STAYS

| Category | Keep | Modify | Replace | Delete |
|---|---|---|---|---|
| App shell | DefaultLayout, AppContent, AppBreadcrumb, AppSidebarNav | AppSidebar (logo), AppHeader (links), AppFooter (text), AppHeaderDropdown (content), App.jsx (routes), store.js (state) | _nav.jsx, routes.js, Login.jsx, Dashboard.jsx | All views/base, views/buttons, views/forms, views/icons, views/notifications, views/theme, views/widgets, views/pages/register, DocsComponents |
| SCSS | simplebar.scss, style.scss structure | style.scss (add custom import) | — | examples.scss usage |
| Charts | CChartLine, CChartBar, CChartDoughnut, CWidgetStatsA | — | MainChart.jsx | — |
| New additions | 14 shared components, 5 hooks/constants, 30+ view pages | — | — | — |

**Total new view files to create: ~35**
**Total existing view files to delete: ~50**
**Total shell files to modify: ~7**
**Total shell files unchanged: ~5**
