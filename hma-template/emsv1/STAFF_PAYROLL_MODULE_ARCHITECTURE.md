# HMA EMS - Staff & Payroll Module Architecture

**Date:** June 11, 2026  
**Version:** 1.0  
**Status:** Approved Architecture  
**Audience:** Development Team, Architecture Committee

---

## Table of Contents

1. [Module Overview](#module-overview)
2. [Page Structure](#page-structure)
3. [Component Structure](#component-structure)
4. [Folder Structure](#folder-structure)
5. [Route Structure](#route-structure)
6. [State Management Design](#state-management-design)
7. [Data Models](#data-models)
8. [API Integration](#api-integration)
9. [Audit Logging](#audit-logging)
10. [Role-Based Access Control](#role-based-access-control)
11. [User Workflows](#user-workflows)
12. [Implementation Checklist](#implementation-checklist)

---

## Module Overview

### Staff & Payroll Module Purpose

The Staff & Payroll module enables HMA to:
- Maintain comprehensive employee directory and records
- Track employee compensation and payroll information
- Display employee assignments and project associations
- Manage HR-related employee data and documentation
- Provide employees with personal compensation information
- Generate payroll reports and analytics
- Maintain immutable audit trail of all HR changes

### Module Scope

**In Scope:**
- Employee directory (list with filtering, search, pagination)
- Employee detail view (profile, compensation, attendance, documents)
- Employee edit (HR only, with audit logging)
- Payroll data display (salary, CTC, pay history)
- Attendance tracking integration
- Project assignment tracking
- Compensation history
- Salary slip generation and download
- Payroll run management (Finance/HR only)
- Staff analytics and reports

**Out of Scope:**
- Recruitment/hiring workflows (future module)
- Benefits management (future module)
- Performance reviews (future module)
- Leave management (Attendance module)
- Expense approvals (Expense module)

### Target Users

1. **Employees:** View own profile, compensation, salary slips, documents
2. **Managers:** View team members, basic profile info, project assignments
3. **HR:** Full access, can edit all employee data, approve payroll, generate reports
4. **Finance:** View payroll data, process payroll runs, reports
5. **Admin:** Full access to all staff and payroll data

---

## Page Structure

### Page Hierarchy

```
Staff & Payroll Module
│
├── Employee Directory
│   ├── Employee List Page
│   │   ├── Filters & Search
│   │   ├── Data Table with 4 columns
│   │   ├── Pagination
│   │   └── Bulk Actions (HR only)
│   │
│   └── Employee Detail Page
│       ├── Section 1: Employee Profile
│       ├── Section 2: Compensation Details
│       ├── Section 3: Attendance Summary
│       ├── Section 4: Project Assignments
│       ├── Section 5: Documents & Files
│       └── Action Bar (Edit, View History, etc.)
│
├── Employee Edit Page
│   ├── Personal Information Form
│   ├── Employment Details Form
│   ├── Compensation Form
│   ├── Bank Details Form
│   └── Save/Cancel Buttons
│
├── Payroll Module
│   ├── Payroll Runs List
│   │   ├── Filter by month/year
│   │   ├── Show all runs
│   │   └── Generate new payroll
│   │
│   ├── Payroll Run Detail
│   │   ├── Run summary
│   │   ├── Employee salary breakdown
│   │   ├── Totals
│   │   └── Actions (approve, reject, process)
│   │
│   ├── Salary Slips
│   │   ├── Employee's salary slips list
│   │   └── View/Download individual slip
│   │
│   └── Payroll Reports
│       ├── Monthly payroll summary
│       └── Year-to-date analysis
│
├── Compensation View (Employee's own data)
│   ├── My Salary Information
│   └── Compensation History
│
└── Staff Analytics (HR/Finance only)
    ├── Headcount by department
    ├── Salary distribution
    ├── Turnover analysis
    └── Reports
```

### 1. Employee List Page

#### Page Layout

```
┌────────────────────────────────────────────────────┐
│ Breadcrumb: Home / Staff & Payroll / Staff Dir.   │
├────────────────────────────────────────────────────┤
│ Page Header                                        │
│ - Title: "Staff Directory"                         │
│ - Subtitle: "156 employees, 12 departments"        │
│ - Action Button: "+ Add Employee" (HR only)        │
├────────────────────────────────────────────────────┤
│ Filters & Search Section                           │
│ [Search by name/ID] [Department ▼] [Status ▼]    │
│ [Designation ▼] [Clear All]                        │
├────────────────────────────────────────────────────┤
│ Data Table                                         │
│ ┌────┬───────────┬──────────┬────────────────┐    │
│ │ ID │ Name      │ Designat.│ Project        │    │
│ ├────┼───────────┼──────────┼────────────────┤    │
│ │ E1 │ John Smith│ Manager  │ CSR Education  │ 🔗 │
│ │ E2 │ Jane Doe  │ Analyst  │ LSGB Training  │ 🔗 │
│ │ E3 │ Bob Miller│ Developer│ Unassigned     │ 🔗 │
│ └────┴───────────┴──────────┴────────────────┘    │
├────────────────────────────────────────────────────┤
│ Pagination: [< 1 2 3 >] Show: [10 ▼] entries     │
└────────────────────────────────────────────────────┘
```

#### Table Columns (4 main fields + extras)

| Column | Data Type | Sortable | Filterable | Searchable | Format |
|--------|-----------|----------|-----------|-----------|---------|
| **Employee ID** | String | ✅ Yes | ❌ No | ✅ Yes | EMP-2024-001 |
| **Name** | String | ✅ Yes | ❌ No | ✅ Yes | Text with avatar |
| **Designation** | String | ✅ Yes | ✅ Yes | ❌ No | Job title |
| **Assigned Project** | String | ✅ Yes | ✅ Yes | ✅ Yes | Project name or "Unassigned" |
| **Status** | Enum | ✅ Yes | ✅ Yes | ❌ No | Active/Inactive/On Leave badge |
| **Department** | String | ✅ Yes | ✅ Yes | ❌ No | Dept name |
| **Email** | String | ❌ No | ❌ No | ✅ Yes | email@example.com |

#### List Page Features

**Search:**
- Search by employee name (partial match)
- Search by employee ID (exact match)
- Search by email (partial match)
- Real-time search as user types

**Filters:**
- Filter by Department: Dropdown with all departments
- Filter by Designation: Dropdown with all job titles
- Filter by Status: Active, Inactive, On Leave, Contract End
- Filter by Project: Unassigned, Project name
- Multi-select filters (AND logic)

**Sorting:**
- Default sort: Employee Name (A-Z)
- Click column header to sort ascending/descending
- Persist sort preference in local storage

**Pagination:**
- Display options: 10, 25, 50, 100 entries per page
- Page indicators: "Showing 1-10 of 156 results"
- Navigation: Previous/Next buttons, page number input

**Bulk Actions (HR only):**
- Select multiple employees (checkbox in header)
- Export selected to CSV/Excel
- Change department for selected
- Update project assignment
- Deactivate/Activate selected
- Send batch message

**Row Actions:**
- Click row to navigate to detail page
- Hover over row to show action menu: View, Edit, Delete (archive)
- Right-click context menu: View, Edit, Delete, Export

#### Empty States

**No employees found:**
```
┌────────────────────────────────┐
│                                │
│  👥 No employees found        │
│                                │
│  No staff members exist yet    │
│                                │
│  [+ Add Employee]              │
│                                │
└────────────────────────────────┘
```

**No results match filters:**
```
┌────────────────────────────────┐
│                                │
│  🔍 No matches found          │
│                                │
│  Try adjusting your filters   │
│                                │
│  [Clear Filters]              │
│                                │
└────────────────────────────────┘
```

### 2. Employee Detail Page

#### Page Layout

```
┌──────────────────────────────────────────────────────────┐
│ Breadcrumb: Home / Staff / Directory / [Employee Name]  │
├──────────────────────────────────────────────────────────┤
│ Header Section                                           │
│ - Status Badge: "Active"                                 │
│ - Large Avatar/Photo                                     │
│ - Name: "John Smith"                                     │
│ - Designation: "Senior Manager"                          │
│ - Action Buttons: [Edit] [View History] [Send Message]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ SECTION 1: EMPLOYEE PROFILE                             │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Personal Information                               │  │
│ ├─────────────────────┬──────────────────────────────┤  │
│ │ Full Name           │ John David Smith             │  │
│ │ Employee ID         │ EMP-2024-001                 │  │
│ │ Email               │ john.smith@hma.org           │  │
│ │ Phone               │ +1-555-123-4567              │  │
│ │ Date of Birth       │ 03/15/1985 (Age: 39)        │  │
│ │ Gender              │ Male                         │  │
│ │ Marital Status      │ Married                      │  │
│ │ Nationality         │ USA                          │  │
│ │                                                    │  │
│ │ Employment Details                                 │  │
│ │ Department          │ Operations                   │  │
│ │ Designation         │ Senior Manager               │  │
│ │ Report To           │ Regional Director            │  │
│ │ Status              │ Active                       │  │
│ │ Date of Joining     │ 01/01/2020                   │  │
│ │ Contract End Date   │ 12/31/2025                   │  │
│ │ Employment Type     │ Full Time                    │  │
│ │                                                    │  │
│ │ Contact Information                                │  │
│ │ Office Address      │ 123 Main St, New York        │  │
│ │ Emergency Contact   │ Jane Smith - 555-7890        │  │
│ │ LinkedIn Profile    │ [Link]                       │  │
│ └────────────────────┴──────────────────────────────┘  │
│                                                          │
│ SECTION 2: COMPENSATION DETAILS                         │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Salary Information (Current FY)                    │  │
│ ├─────────────────────┬──────────────────────────────┤  │
│ │ Base Salary         │ $60,000 / year              │  │
│ │ Allowances          │ $12,000 / year              │  │
│ │ Bonus               │ $10,000 / year              │  │
│ │ Gross Annual (CTC)  │ $82,000 / year              │  │
│ │ Monthly CTC         │ $6,833.33 / month           │  │
│ │ Effective Date      │ 01/01/2024                  │  │
│ │                                                    │  │
│ │ Deductions                                         │  │
│ │ Income Tax          │ 20% of gross                │  │
│ │ Social Security     │ 6.2% of gross               │  │
│ │ Health Insurance    │ $200 / month                │  │
│ │ Retirement Plan     │ 401(k) - 5% company match   │  │
│ │                                                    │  │
│ │ Bank Details                                       │  │
│ │ Bank Name           │ [Masked for security]       │  │
│ │ Account Number      │ XXXX-XXXX-XXXX-1234        │  │
│ │ IFSC Code           │ HDFC0000001                  │  │
│ └────────────────────┴──────────────────────────────┘  │
│                                                          │
│ SECTION 3: ATTENDANCE SUMMARY                           │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Current Month (June 2024)                          │  │
│ ├─────────────────────┬──────────────────────────────┤  │
│ │ Total Days          │ 30                           │  │
│ │ Working Days        │ 22                           │  │
│ │ Present Days        │ 21 (95.5%)                  │  │
│ │ Absent Days         │ 1                            │  │
│ │ Leave Days          │ 0                            │  │
│ │ On Time %           │ 98%                          │  │
│ │                                                    │  │
│ │ Year-to-Date (2024)                               │  │
│ │ Total Days          │ 156                          │  │
│ │ Present Days        │ 150 (96.2%)                 │  │
│ │ Leaves Taken        │ 5 days                       │  │
│ │ Leaves Remaining    │ 15 days                      │  │
│ │ Total Absences      │ 1 (unexplained)             │  │
│ │                                                    │  │
│ │ [View Full Attendance Report]                      │  │
│ └────────────────────┴──────────────────────────────┘  │
│                                                          │
│ SECTION 4: PROJECT ASSIGNMENTS                         │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Active Assignments                                 │  │
│ │ ┌────┬──────────────┬──────┬──────────┐            │  │
│ │ │ ID │ Project      │ Role │ Start    │            │  │
│ │ ├────┼──────────────┼──────┼──────────┤            │  │
│ │ │ P1 │ CSR Education│ Lead │ Jan 2024 │            │  │
│ │ │ P2 │ LSGB Training│ Team │ Mar 2024 │            │  │
│ │ └────┴──────────────┴──────┴──────────┘            │  │
│ │ [View All Assignments]                             │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ SECTION 5: DOCUMENTS & FILES                           │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Official Documents                                 │  │
│ │ - Employment Agreement (PDF) - Jan 2020            │  │
│ │ - Offer Letter (PDF) - Dec 2019                    │  │
│ │ - Tax Documents (ZIP) - Updated                    │  │
│ │                                                    │  │
│ │ Recent Uploads                                     │  │
│ │ - Certification.pdf - 2 months ago                 │  │
│ │ - Training Completion.pdf - 3 months ago           │  │
│ │                                                    │  │
│ │ [Upload New Document]                              │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ [Print] [Export as PDF] [Share] [Back to List]         │
└──────────────────────────────────────────────────────────┘
```

#### Section Specifications

**Section 1: Employee Profile**
- Format: Two-column layout (label-value pairs)
- Subsections: Personal Info, Employment Details, Contact Info
- Edit capability: Edit button opens full edit page
- Photo/Avatar: Displayed in header, large size
- All fields display-only on detail page

**Section 2: Compensation Details**
- Format: Two-column layout with subsections
- Subsections: Current Salary Info, Deductions, Bank Details (masked)
- Salary components: Base, Allowances, Bonus, Gross Annual, Monthly CTC
- Tax/Deductions: Federal tax, social security, health insurance, retirement
- Bank info: Masked for security (only last 4 digits shown)
- Effective date: Shows when current salary took effect
- Edit capability: Link to Payroll page or Edit button

**Section 3: Attendance Summary**
- Format: Current month + Year-to-date summary
- Metrics: Present days, absent, leaves, on-time percentage
- Visual: Mini charts showing attendance trend
- Link to full attendance report in Attendance module
- Badge for attendance status (Good/Warning/At Risk)

**Section 4: Project Assignments**
- Format: Table of current projects
- Columns: Project ID, Project Name, Employee Role, Start Date
- Active assignments only (completed projects hidden by default)
- Link each project to Project Detail page
- [View All] link shows completed assignments

**Section 5: Documents & Files**
- Format: List of documents organized by type
- Types: Employment Agreement, Offer Letter, Tax Documents, Training, Certifications
- Actions: Download, Preview, Delete (HR only)
- Upload form: Allow HR to upload new documents
- Timestamps: When each document was uploaded/modified

### 3. Employee Edit Page

#### Edit Page Layout

```
┌──────────────────────────────────────────────────────┐
│ Breadcrumb: ... / [Employee Name] / Edit             │
├──────────────────────────────────────────────────────┤
│ Page Header                                          │
│ - Title: "Edit Employee Record"                      │
│ - Subtitle: "Make changes to employee details"      │
├──────────────────────────────────────────────────────┤
│ Tabs Navigation (organize form sections)             │
│ [Personal Info] [Employment] [Compensation] [Bank]  │
│                                                      │
│ TAB 1: PERSONAL INFORMATION                          │
│ ├─ Photo Upload (required)                           │
│ ├─ Full Name (required)                              │
│ ├─ Email (required, unique)                          │
│ ├─ Phone (required)                                  │
│ ├─ Date of Birth (required)                          │
│ ├─ Gender (required, select)                         │
│ ├─ Marital Status (select)                           │
│ ├─ Nationality (required, autocomplete)              │
│ └─ Emergency Contact (name + phone)                  │
│                                                      │
│ TAB 2: EMPLOYMENT DETAILS                            │
│ ├─ Department (required, select)                     │
│ ├─ Designation (required, select/autocomplete)       │
│ ├─ Reports To (select staff)                         │
│ ├─ Status (select: Active/Inactive/On Leave)         │
│ ├─ Date of Joining (required, date)                  │
│ ├─ Contract End Date (optional, date)                │
│ ├─ Employment Type (select: Full Time/Part Time/...)│
│ └─ Work Location (select/text)                       │
│                                                      │
│ TAB 3: COMPENSATION                                  │
│ ├─ Base Salary (required, currency)                  │
│ ├─ Allowances (currency)                             │
│ ├─ Bonus (currency)                                  │
│ ├─ Monthly CTC (auto-calculated)                     │
│ ├─ Effective Date (date)                             │
│ ├─ Deductions (expandable list)                      │
│ │  ├─ Deduction Name (required)                      │
│ │  ├─ Amount (required, currency)                    │
│ │  ├─ Percentage? (toggle)                           │
│ │  └─ [Remove]                                       │
│ │  [+ Add Deduction]                                 │
│ └─ Notes (textarea)                                  │
│                                                      │
│ TAB 4: BANK DETAILS                                  │
│ ├─ Bank Name (required, autocomplete)                │
│ ├─ Account Number (required)                         │
│ ├─ Account Holder Name (required)                    │
│ ├─ IFSC Code (required)                              │
│ ├─ Account Type (required, select)                   │
│ └─ Remarks (textarea)                                │
│                                                      │
│ Form Controls:                                       │
│ [Save Changes] [Discard] [View History] [Audit Log] │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### Edit Page Features

**Form Validation:**
- Real-time field validation with error messages
- Required field indicators (red asterisk)
- Unique email validation (check against existing)
- Field-level error messages below field
- Form-level validation on submit

**Tab Navigation:**
- 4 tabs organizing related fields
- Save button on every tab
- Indicator on tab if has errors

**Unsaved Changes:**
- Auto-save draft to local storage
- Dirty flag prevents accidental loss
- Warning before navigating away
- Auto-detect changes, enable Save button only when changed

**Permission-Based Editing:**
- Employees: Can only edit their own profile (limited fields)
- Managers: Cannot edit employee records
- HR: Full edit capability on all fields
- Finance: Can edit compensation fields only
- Admin: Full edit capability

**Audit Trail on Edit:**
- All changes logged with before/after values
- User ID, timestamp, IP address recorded
- Edit reason optional field (recommended)
- Audit log accessible from detail page

#### Compensation Tab Features

**Salary Components:**
- Base Salary (editable)
- Allowances (editable)
- Bonus (editable)
- Monthly CTC (auto-calculated from above)

**Deductions (Dynamic List):**
- Add/Remove deductions
- Each deduction: Name, Amount, Is Percentage?
- Examples: Income Tax, Social Security, Health Insurance

**Effective Date:**
- When new compensation takes effect
- Tracks salary history (can view previous rates)

### 4. Payroll Runs Page (Finance/HR only)

#### Payroll Runs List Layout

```
┌──────────────────────────────────────────────────┐
│ Breadcrumb: Home / Staff & Payroll / Payroll    │
├──────────────────────────────────────────────────┤
│ Page Header                                      │
│ - Title: "Payroll Runs"                          │
│ - Action Button: "+ Generate Payroll" (HR only) │
├──────────────────────────────────────────────────┤
│ Filters                                          │
│ [Month/Year ▼] [Status ▼] [Clear]               │
├──────────────────────────────────────────────────┤
│ Data Table                                       │
│ ┌────┬──────────┬──────────┬──────────┐         │
│ │ ID │ Period   │ Status   │ Total    │         │
│ ├────┼──────────┼──────────┼──────────┤         │
│ │ PR │ June 2024│ Approved │ $50,000K │ 🔗     │
│ │ PR │ May 2024 │ Processed│ $50,000K │ 🔗     │
│ └────┴──────────┴──────────┴──────────┘         │
│                                                  │
│ [View Report] [Export] [Process Payroll]        │
└──────────────────────────────────────────────────┘
```

#### Payroll Run Detail Page

**Sections:**
- Run Summary (period, total employees, total amount, status)
- Employee Breakdown (table with salary details per employee)
- Totals (sum of all components)
- Approval/Process buttons (status-dependent)

### 5. Salary Slips Page

**List View:**
- All salary slips for current employee (own) or all employees (Finance/HR)
- Filter by month/year
- Download button for each slip

**Detail View:**
- Full salary slip details (PDF view)
- Download as PDF
- Print option
- Share via email

### 6. Compensation History View (Employee's own)

**Page:**
- Timeline view of salary changes
- Each entry shows: Date, Previous Salary, New Salary, Reason
- Immutable historical data

---

## Component Structure

### Component Hierarchy

```
Staff & Payroll Module (Directory: src/features/staff/)
│
├── pages/
│   ├── EmployeeDirectoryPage.jsx
│   ├── EmployeeDetailPage.jsx
│   ├── EmployeeEditPage.jsx
│   ├── MyCompensationPage.jsx
│   ├── PayrollRunsPage.jsx
│   ├── PayrollRunDetailPage.jsx
│   ├── SalarySlipsPage.jsx
│   └── CompensationHistoryPage.jsx
│
├── components/
│   ├── EmployeeList/
│   │   ├── EmployeeListTable.jsx (main table)
│   │   ├── EmployeeListFilters.jsx (filters & search)
│   │   ├── EmployeeListPagination.jsx (pagination)
│   │   ├── EmployeeListActions.jsx (bulk actions for HR)
│   │   └── EmployeeListEmptyState.jsx (empty/no results)
│   │
│   ├── EmployeeDetail/
│   │   ├── EmployeeDetailHeader.jsx (photo, name, badges)
│   │   ├── EmployeeProfileSection.jsx (Section 1: Profile)
│   │   ├── CompensationDetailsSection.jsx (Section 2: Comp)
│   │   ├── AttendanceSummarySection.jsx (Section 3: Attendance)
│   │   ├── ProjectAssignmentsSection.jsx (Section 4: Projects)
│   │   ├── DocumentsFilesSection.jsx (Section 5: Docs)
│   │   └── EmployeeDetailSidebar.jsx (related info)
│   │
│   ├── EmployeeForm/
│   │   ├── EmployeeFormWrapper.jsx (handles edit logic)
│   │   ├── PersonalInformationTab.jsx (Tab 1)
│   │   ├── EmploymentDetailsTab.jsx (Tab 2)
│   │   ├── CompensationTab.jsx (Tab 3)
│   │   ├── BankDetailsTab.jsx (Tab 4)
│   │   ├── DeductionInput.jsx (reusable deduction)
│   │   ├── FormControls.jsx (Save, Cancel buttons)
│   │   └── FormTabs.jsx (tab navigation)
│   │
│   ├── Payroll/
│   │   ├── PayrollRunsTable.jsx (list of runs)
│   │   ├── PayrollRunSummary.jsx (summary cards)
│   │   ├── PayrollEmployeeBreakdown.jsx (employee table)
│   │   ├── SalarySlipViewer.jsx (PDF view)
│   │   ├── PayrollFilters.jsx (date filters)
│   │   └── CompensationHistoryTimeline.jsx (timeline)
│   │
│   ├── Cards/
│   │   ├── CompensationCard.jsx (salary info card)
│   │   ├── AttendanceCard.jsx (attendance summary)
│   │   ├── StatusCard.jsx (employment status)
│   │   └── MetricCard.jsx (key metrics)
│   │
│   ├── Modals/
│   │   ├── ConfirmDeactivateModal.jsx (deactivate employee)
│   │   ├── DocumentUploadModal.jsx (upload documents)
│   │   ├── GeneratePayrollModal.jsx (start payroll run)
│   │   └── SalaryUpdateModal.jsx (change salary)
│   │
│   └── Common/
│       ├── StatusBadge.jsx (Active/Inactive/On Leave)
│       ├── DesignationBadge.jsx (job title display)
│       ├── DepartmentBadge.jsx (department display)
│       ├── CurrencyDisplay.jsx (formatted money)
│       ├── AttendancePercentage.jsx (percentage display)
│       ├── EmployeeAvatar.jsx (photo/avatar component)
│       └── DocumentPreview.jsx (file preview)
│
├── hooks/
│   ├── useEmployeeList.js (fetch all employees)
│   ├── useEmployeeDetail.js (fetch single employee)
│   ├── useEmployeeForm.js (form submission logic)
│   ├── useEmployeeFilters.js (filter state management)
│   ├── useCompensationHistory.js (fetch history)
│   ├── usePayrollRuns.js (fetch payroll runs)
│   ├── useAttendanceSummary.js (fetch attendance)
│   ├── useProjectAssignments.js (fetch projects)
│   ├── useEmployeeAudit.js (audit logging)
│   ├── useSalarySlips.js (fetch slips)
│   └── useEmployeePagination.js (pagination state)
│
├── services/
│   ├── employeeService.js (API calls)
│   ├── compensationService.js (salary/CTC API)
│   ├── payrollService.js (payroll API)
│   ├── salarySlipService.js (slip API)
│   ├── employeeAuditService.js (audit log API)
│   ├── attendanceService.js (integration with Attendance)
│   └── projectService.js (integration with Projects)
│
├── store/
│   ├── employeeSlice.js (Redux reducer)
│   ├── employeeSelectors.js (state selectors)
│   ├── employeeAPI.js (RTK Query endpoints)
│   └── payrollSlice.js (payroll state)
│
├── types/
│   ├── employee.types.ts (TypeScript types)
│   ├── compensation.types.ts (compensation types)
│   ├── payroll.types.ts (payroll types)
│   └── audit.types.ts (audit log types)
│
└── utils/
    ├── employeeDataTransform.js (data formatting)
    ├── compensationCalculations.js (salary math)
    ├── filterHelpers.js (filter utilities)
    ├── sortHelpers.js (sorting utilities)
    ├── validationRules.js (form validation)
    └── payrollCalculations.js (payroll math)
```

### Component Specifications

#### Page Components

**EmployeeDirectoryPage.jsx**
- Props: None
- Children: EmployeeListFilters, EmployeeListTable, EmployeeListPagination, EmployeeListActions
- State: Filter values, sort config, current page, page size
- Behavior: Displays all employees with filtering, sorting, pagination

**EmployeeDetailPage.jsx**
- Props: employeeId (from URL params)
- Children: EmployeeDetailHeader, 5 Section components, Sidebar (optional)
- State: Employee data (loading, error), expanded sections
- Behavior: Fetches and displays employee details

**EmployeeEditPage.jsx**
- Props: employeeId (from URL params, empty for create)
- Children: EmployeeFormWrapper, FormTabs, FormControls
- State: Form values, validation errors, loading, unsaved changes
- Behavior: Edit existing employee (restricted to own profile or HR)

#### Section Components

**EmployeeDetailHeader.jsx**
- Props: employee data, onEdit callback
- Displays: Large avatar/photo, name, designation, status badge, action buttons
- Behavior: Manages edit modal state

**EmployeeProfileSection.jsx**
- Props: employee data
- Displays: 8 fields (name, ID, email, phone, DOB, gender, marital status, nationality)
- Format: Two-column label-value pairs

**CompensationDetailsSection.jsx**
- Props: compensation data
- Displays: 3 subsections (Salary, Deductions, Bank Details - masked)
- Format: Two-column label-value pairs
- Special: Bank details masked for security

**AttendanceSummarySection.jsx**
- Props: employee data, attendance stats
- Displays: Current month + YTD attendance metrics
- Format: Two-column layout with progress bars
- Link: To full attendance report

**ProjectAssignmentsSection.jsx**
- Props: employee data, assignments array
- Displays: Table of current project assignments
- Columns: Project ID, Name, Role, Start Date
- Link: Each project links to Project Detail page

**DocumentsFilesSection.jsx**
- Props: documents array
- Displays: Documents organized by type
- Actions: Download, Preview, Delete (HR only), Upload (HR)

#### Form Components

**EmployeeFormWrapper.jsx**
- Props: employeeId (optional)
- Children: FormTabs, Tab content, FormControls
- State: Form submission state, validation errors, unsaved changes
- Behavior: Orchestrates form submission, handles auto-save

**PersonalInformationTab.jsx**
- Props: initialValues, onChange callback
- Displays: 8 form fields
- Behavior: Real-time validation, field change events
- Special: Photo upload with preview

**EmploymentDetailsTab.jsx**
- Props: initialValues, onChange callback
- Displays: 8 form fields
- Behavior: Dropdown autocomplete for department, designation, reports to

**CompensationTab.jsx**
- Props: initialValues, onChange callback
- Displays: 5 main fields + dynamic deduction list
- Behavior: Auto-calculate monthly CTC, deduction add/remove

**BankDetailsTab.jsx**
- Props: initialValues, onChange callback
- Displays: 5 form fields
- Behavior: Bank name autocomplete, IFSC validation

#### Card Components

**CompensationCard.jsx**
- Props: compensation data
- Display: Salary, CTC, allowances, bonus in card format
- Style: Color-coded for quick scanning

**AttendanceCard.jsx**
- Props: attendance stats
- Display: Present days, absent, on-time % in card format
- Style: Visual indicator (Good/Warning/At Risk)

---

## Folder Structure

### Complete Directory Tree

```
src/features/staff/
│
├── pages/
│   ├── EmployeeDirectoryPage.jsx
│   ├── EmployeeDetailPage.jsx
│   ├── EmployeeEditPage.jsx
│   ├── MyCompensationPage.jsx
│   ├── PayrollRunsPage.jsx
│   ├── PayrollRunDetailPage.jsx
│   ├── SalarySlipsPage.jsx
│   └── CompensationHistoryPage.jsx
│
├── components/
│   ├── EmployeeList/
│   │   ├── EmployeeListTable.jsx
│   │   ├── EmployeeListFilters.jsx
│   │   ├── EmployeeListPagination.jsx
│   │   ├── EmployeeListActions.jsx
│   │   └── EmployeeListEmptyState.jsx
│   │
│   ├── EmployeeDetail/
│   │   ├── EmployeeDetailHeader.jsx
│   │   ├── EmployeeProfileSection.jsx
│   │   ├── CompensationDetailsSection.jsx
│   │   ├── AttendanceSummarySection.jsx
│   │   ├── ProjectAssignmentsSection.jsx
│   │   ├── DocumentsFilesSection.jsx
│   │   └── EmployeeDetailSidebar.jsx
│   │
│   ├── EmployeeForm/
│   │   ├── EmployeeFormWrapper.jsx
│   │   ├── PersonalInformationTab.jsx
│   │   ├── EmploymentDetailsTab.jsx
│   │   ├── CompensationTab.jsx
│   │   ├── BankDetailsTab.jsx
│   │   ├── DeductionInput.jsx
│   │   ├── FormControls.jsx
│   │   └── FormTabs.jsx
│   │
│   ├── Payroll/
│   │   ├── PayrollRunsTable.jsx
│   │   ├── PayrollRunSummary.jsx
│   │   ├── PayrollEmployeeBreakdown.jsx
│   │   ├── SalarySlipViewer.jsx
│   │   ├── PayrollFilters.jsx
│   │   └── CompensationHistoryTimeline.jsx
│   │
│   ├── Cards/
│   │   ├── CompensationCard.jsx
│   │   ├── AttendanceCard.jsx
│   │   ├── StatusCard.jsx
│   │   └── MetricCard.jsx
│   │
│   ├── Modals/
│   │   ├── ConfirmDeactivateModal.jsx
│   │   ├── DocumentUploadModal.jsx
│   │   ├── GeneratePayrollModal.jsx
│   │   └── SalaryUpdateModal.jsx
│   │
│   └── Common/
│       ├── StatusBadge.jsx
│       ├── DesignationBadge.jsx
│       ├── DepartmentBadge.jsx
│       ├── CurrencyDisplay.jsx
│       ├── AttendancePercentage.jsx
│       ├── EmployeeAvatar.jsx
│       └── DocumentPreview.jsx
│
├── hooks/
│   ├── useEmployeeList.js
│   ├── useEmployeeDetail.js
│   ├── useEmployeeForm.js
│   ├── useEmployeeFilters.js
│   ├── useCompensationHistory.js
│   ├── usePayrollRuns.js
│   ├── useAttendanceSummary.js
│   ├── useProjectAssignments.js
│   ├── useEmployeeAudit.js
│   ├── useSalarySlips.js
│   └── useEmployeePagination.js
│
├── services/
│   ├── employeeService.js
│   ├── compensationService.js
│   ├── payrollService.js
│   ├── salarySlipService.js
│   ├── employeeAuditService.js
│   ├── attendanceService.js
│   └── projectService.js
│
├── store/
│   ├── employeeSlice.js
│   ├── employeeSelectors.js
│   ├── employeeAPI.js
│   └── payrollSlice.js
│
├── types/
│   ├── employee.types.ts
│   ├── compensation.types.ts
│   ├── payroll.types.ts
│   └── audit.types.ts
│
└── utils/
    ├── employeeDataTransform.js
    ├── compensationCalculations.js
    ├── filterHelpers.js
    ├── sortHelpers.js
    ├── validationRules.js
    └── payrollCalculations.js
```

### Folder Organization Rules

**pages/** - Page-level components (full page views)
- One file per URL route
- Handles data fetching and state subscription
- Passes data to section components

**components/** - Reusable components organized by feature
- Each feature (EmployeeList, EmployeeDetail, etc.) in own folder
- Common components shared across features
- Sub-components grouped logically

**hooks/** - Custom React hooks for logic reuse
- One hook per data/logic responsibility
- Named with `use` prefix
- Exported for use in multiple components

**services/** - API integration layer
- One service file per data domain
- Handles HTTP requests, error handling
- Returns promises or observables

**store/** - Redux state management
- Slices organized by feature/domain
- Selectors for accessing state
- RTK Query API definitions

**types/** - TypeScript type definitions
- One file per data model
- Interfaces and types exported
- Used across services and components

**utils/** - Pure utility functions
- No side effects
- Reusable across components
- Organized by domain (calculations, filters, etc.)

---

## Route Structure

### Route Tree

```
/staff                               ← Staff & Payroll module root

/staff                               ← Employee directory main
├── /staff                           ← List all employees (default)
├── /staff/new                       ← Create new employee (HR only)
├── /staff/:employeeId               ← Employee detail
│   ├── /staff/:employeeId/edit      ← Edit employee (HR/own)
│   ├── /staff/:employeeId/audit     ← View change history
│   └── /staff/:employeeId/documents ← Manage documents
│
/staff/compensation                  ← Employee's own compensation
├── /staff/compensation              ← My salary information
├── /staff/compensation/history      ← Compensation history timeline
└── /staff/compensation/slips        ← My salary slips
│
/payroll                             ← Payroll module (Finance/HR only)
├── /payroll                         ← Payroll runs list
├── /payroll/new                     ← Generate new payroll
├── /payroll/:runId                  ← Run detail
├── /payroll/:runId/approve          ← Approval workflow
└── /payroll/:runId/process          ← Process payroll
│
/payroll/slips                       ← Salary slips (Finance/HR)
├── /payroll/slips                   ← All employees' slips
├── /payroll/slips/:slipId           ← Individual slip detail
└── /payroll/slips/:slipId/download  ← Download PDF

/reports/staff                       ← Staff analytics (HR/Finance only)
├── /reports/staff                   ← Headcount by dept
├── /reports/staff/salary-analysis   ← Salary distribution
├── /reports/staff/turnover          ← Turnover analysis
└── /reports/staff/payroll-summary   ← Payroll summary
```

### Route Configuration

```typescript
interface RouteConfig {
  path: string
  component: Component
  exact?: boolean
  requiredRoles?: string[]
  breadcrumb?: (params) => string
  title?: string
}

// Routes for Staff Module
const staffRoutes = [
  // Employee Directory
  {
    path: '',
    component: EmployeeDirectoryPage,
    exact: true,
    requiredRoles: ['*'],
    title: 'Staff Directory',
    breadcrumb: 'Staff Directory'
  },
  
  {
    path: 'new',
    component: EmployeeEditPage,
    exact: true,
    requiredRoles: ['Admin', 'HR'],
    title: 'Add New Employee',
    breadcrumb: 'Add Employee'
  },
  
  {
    path: ':employeeId',
    component: EmployeeDetailPage,
    exact: true,
    requiredRoles: ['*'],
    title: (params) => `Employee: ${params.employeeId}`,
    breadcrumb: (params) => `${params.employeeName}`
  },
  
  {
    path: ':employeeId/edit',
    component: EmployeeEditPage,
    exact: true,
    requiredRoles: ['Admin', 'HR', 'Self'],
    title: 'Edit Employee',
    breadcrumb: 'Edit'
  },
  
  // Compensation (Employee's own)
  {
    path: 'compensation',
    component: MyCompensationPage,
    exact: true,
    requiredRoles: ['*'],
    title: 'My Compensation',
    breadcrumb: 'My Compensation'
  },
  
  {
    path: 'compensation/history',
    component: CompensationHistoryPage,
    exact: true,
    requiredRoles: ['*'],
    title: 'Compensation History',
    breadcrumb: 'History'
  },
  
  // Payroll (Finance/HR only)
  {
    path: 'payroll',
    component: PayrollRunsPage,
    exact: true,
    requiredRoles: ['Admin', 'HR', 'Finance'],
    title: 'Payroll Runs',
    breadcrumb: 'Payroll'
  },
  
  {
    path: 'payroll/:runId',
    component: PayrollRunDetailPage,
    exact: true,
    requiredRoles: ['Admin', 'HR', 'Finance'],
    title: 'Payroll Run Detail',
    breadcrumb: 'Run Detail'
  }
]
```

### URL Examples

```
/staff                              ← Employee directory
/staff/emp-001                      ← John Smith's profile
/staff/emp-001/edit                 ← Edit John Smith
/staff/new                          ← Create new employee
/staff/compensation                 ← My salary (current user)
/staff/compensation/history         ← Salary history
/payroll                            ← Payroll runs list
/payroll/jun-2024                   ← June 2024 payroll
```

---

## State Management Design

### Redux Store Structure

```
store/
├── employee (employeeSlice)
│   ├── list
│   │   ├── data: Employee[]
│   │   ├── loading: boolean
│   │   ├── error: string | null
│   │   ├── filters: FilterState
│   │   ├── sorting: SortState
│   │   ├── pagination: PaginationState
│   │   └── totalCount: number
│   │
│   ├── detail
│   │   ├── currentEmployee: Employee | null
│   │   ├── loading: boolean
│   │   ├── error: string | null
│   │   ├── expandedSections: string[]
│   │   └── lastUpdated: timestamp
│   │
│   ├── edit
│   │   ├── formValues: FormData
│   │   ├── initialValues: FormData
│   │   ├── isDirty: boolean
│   │   ├── validationErrors: Record<string, string>
│   │   ├── isSubmitting: boolean
│   │   ├── submitError: string | null
│   │   └── savedDraft: FormData
│   │
│   └── ui
│       ├── selectedEmployeeIds: string[]
│       ├── showDeactivateModal: boolean
│       ├── showDocumentUploadModal: boolean
│       ├── activeSection: string | null
│       └── sidebarCollapsed: boolean
│
└── payroll (payrollSlice)
    ├── runs
    │   ├── data: PayrollRun[]
    │   ├── loading: boolean
    │   ├── currentRun: PayrollRun | null
    │   ├── filters: FilterState
    │   └── sorting: SortState
    │
    ├── salarySlips
    │   ├── data: SalarySlip[]
    │   ├── loading: boolean
    │   └── filters: FilterState
    │
    └── compensationHistory
        ├── data: CompensationRecord[]
        ├── loading: boolean
        └── employeeId: string
```

### Slice Definitions

**employeeSlice.js**

```typescript
interface EmployeeState {
  list: {
    data: Employee[]
    loading: boolean
    error: string | null
    filters: {
      department: string[]
      designation: string[]
      status: string[]
      searchQuery: string
    }
    sorting: {
      field: string
      direction: 'asc' | 'desc'
    }
    pagination: {
      page: number
      pageSize: number
      totalCount: number
    }
  }
  detail: {
    currentEmployee: Employee | null
    loading: boolean
    error: string | null
    expandedSections: string[]
    lastUpdated: number
  }
  edit: {
    formValues: Partial<Employee>
    initialValues: Partial<Employee>
    isDirty: boolean
    validationErrors: Record<string, string>
    isSubmitting: boolean
    submitError: string | null
    savedDraft: Partial<Employee>
  }
  ui: {
    selectedEmployeeIds: string[]
    showDeactivateModal: boolean
    showDocumentUploadModal: boolean
    activeSection: string | null
    sidebarCollapsed: boolean
  }
}
```

### RTK Query API Slice

```typescript
interface EmployeeAPI {
  // Queries
  getEmployees(params: QueryParams): Employee[]
  getEmployeeDetail(employeeId: string): Employee
  getCompensationHistory(employeeId: string): CompensationRecord[]
  getProjectAssignments(employeeId: string): Assignment[]
  getAttendanceSummary(employeeId: string): AttendanceStats
  
  // Mutations
  createEmployee(data: CreateEmployeeData): Employee
  updateEmployee(data: UpdateEmployeeData): Employee
  deactivateEmployee(employeeId: string): void
  updateCompensation(data: UpdateCompensationData): void
  uploadDocument(data: UploadDocumentData): Document
}
```

### Local Storage State

**Persisted State:**
- Sort preference: `staff_sort`
- Page size: `staff_pageSize`
- Filter state: `staff_filters`
- Form draft: `staff_form_draft_{employeeId}`
- Compensation filter: `staff_comp_filter`

---

## Data Models

### Core Data Models

#### Employee Model

```typescript
interface Employee {
  // Identity
  id: UUID
  employeeId: string (e.g., "EMP-2024-001")
  
  // Basic Info
  firstName: string
  lastName: string
  email: string (unique)
  phone: string
  dateOfBirth: Date
  gender: 'Male' | 'Female' | 'Other'
  maritalStatus: string
  nationality: string
  
  // Employment
  department: string
  designation: string
  reportsTo: UUID (manager ID)
  status: 'Active' | 'Inactive' | 'OnLeave' | 'Terminated'
  dateOfJoining: Date
  contractEndDate: Date | null
  employmentType: 'FullTime' | 'PartTime' | 'Contract' | 'Consultant'
  workLocation: string
  
  // Compensation (current)
  baseSalary: number
  allowances: number
  bonus: number
  monthlyCtc: number (calculated)
  salaryEffectiveDate: Date
  
  // Bank Details
  bankName: string
  accountNumber: string (encrypted)
  accountHolderName: string
  ifscCode: string
  accountType: string
  
  // Contact
  emergencyContactName: string
  emergencyContactPhone: string
  officialAddress: string
  
  // Metadata
  photo: string (URL to image)
  documents: Document[]
  
  // Audit
  createdBy: UUID
  createdAt: DateTime
  updatedBy: UUID
  updatedAt: DateTime
  isDeleted: boolean (soft delete)
}
```

#### Compensation Model

```typescript
interface Compensation {
  id: UUID
  employeeId: UUID
  
  // Salary Components
  baseSalary: number
  allowances: Record<string, number> (allowance type → amount)
  bonus: number
  
  // Calculated
  monthlyCtc: number
  annualCtc: number
  
  // Deductions
  deductions: Deduction[]
  
  // Timeline
  effectiveDate: Date
  endDate: Date | null
  
  // Audit
  createdAt: DateTime
  createdBy: UUID
}

interface Deduction {
  id: UUID
  name: string
  amount: number
  isPercentage: boolean
  applicableFrom: Date
}
```

#### PayrollRun Model

```typescript
interface PayrollRun {
  id: UUID
  period: string (e.g., "June 2024")
  startDate: Date
  endDate: Date
  status: 'Draft' | 'Approved' | 'Processed' | 'Rejected'
  
  // Totals
  totalEmployees: number
  totalGrossSalary: number
  totalDeductions: number
  totalNetAmount: number
  
  // Details
  salaryBreakdown: SalaryLine[]
  
  // Metadata
  createdBy: UUID
  createdAt: DateTime
  approvedBy: UUID | null
  approvedAt: DateTime | null
  processedAt: DateTime | null
}
```

---

## API Integration

### API Endpoints

```
Backend Base URL: /api/v1

Employee Endpoints:
├── GET    /employees                  ← List all employees
├── GET    /employees/:id              ← Get employee detail
├── POST   /employees                  ← Create new employee
├── PUT    /employees/:id              ← Update employee
├── DELETE /employees/:id              ← Delete employee (soft delete)
│
├── GET    /employees/:id/compensation ← Compensation history
├── PUT    /employees/:id/compensation ← Update compensation
├── GET    /employees/:id/projects     ← Project assignments
├── GET    /employees/:id/attendance   ← Attendance summary
├── GET    /employees/:id/documents    ← List documents
├── POST   /employees/:id/documents    ← Upload document
├── DELETE /employees/:id/documents/:docId ← Delete document
│
├── GET    /employees/:id/audit-log    ← Audit trail
├── POST   /employees/:id/deactivate   ← Soft deactivate
│
└── GET    /employees/export           ← Export employees

Payroll Endpoints:
├── GET    /payroll                    ← List payroll runs
├── GET    /payroll/:runId             ← Run detail
├── POST   /payroll                    ← Create/generate payroll
├── PUT    /payroll/:runId             ← Update run
├── PUT    /payroll/:runId/approve     ← Approve run
├── PUT    /payroll/:runId/process     ← Process payroll
│
├── GET    /salary-slips               ← List salary slips
├── GET    /salary-slips/:slipId       ← Slip detail
└── GET    /salary-slips/:slipId/download ← Download PDF
```

### Request/Response Examples

**List Employees Request:**
```
GET /api/v1/employees?page=1&pageSize=10&department=Operations&sort=name:asc

Query Params:
  page: 1
  pageSize: 10
  department: 'Operations'
  status: 'Active'
  sort: 'name:asc'
```

**List Employees Response:**
```json
{
  "data": [
    {
      "id": "emp-uuid-001",
      "employeeId": "EMP-2024-001",
      "firstName": "John",
      "lastName": "Smith",
      "email": "john.smith@hma.org",
      "designation": "Senior Manager",
      "department": "Operations",
      "projectAssignment": "CSR Education",
      "status": "Active"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalCount": 156,
    "totalPages": 16
  }
}
```

**Employee Detail Request:**
```
GET /api/v1/employees/emp-uuid-001?include=compensation,projects,attendance,documents
```

**Employee Detail Response:**
```json
{
  "data": {
    "id": "emp-uuid-001",
    "employeeId": "EMP-2024-001",
    "firstName": "John",
    "lastName": "Smith",
    "email": "john.smith@hma.org",
    "phone": "+1-555-123-4567",
    "dateOfBirth": "1985-03-15",
    "gender": "Male",
    "maritalStatus": "Married",
    "nationality": "USA",
    "department": "Operations",
    "designation": "Senior Manager",
    "reportsTo": "director-uuid",
    "status": "Active",
    "dateOfJoining": "2020-01-01",
    "contractEndDate": "2025-12-31",
    "employmentType": "FullTime",
    "workLocation": "New York",
    "baseSalary": 60000,
    "allowances": 12000,
    "bonus": 10000,
    "monthlyCtc": 6833.33,
    "salaryEffectiveDate": "2024-01-01",
    "bankName": "Chase Bank",
    "accountNumber": "XXXX-XXXX-XXXX-1234",
    "accountHolderName": "John David Smith",
    "ifscCode": "HDFC0000001",
    "accountType": "Savings",
    "emergencyContactName": "Jane Smith",
    "emergencyContactPhone": "+1-555-7890",
    "photo": "https://cdn.example.com/photos/emp-001.jpg",
    "compensation": [...],
    "projects": [...],
    "attendance": {...},
    "documents": [...],
    "createdAt": "2020-01-01T10:00:00Z",
    "updatedAt": "2024-06-11T10:00:00Z"
  }
}
```

---

## Audit Logging

### Audit Events

**Events Triggered:**

| Event | Trigger | Audit Fields |
|-------|---------|--------------|
| EMPLOYEE_CREATED | New employee added | Employee data, user, timestamp |
| EMPLOYEE_UPDATED | Employee info edited | Changed fields, old/new values, user |
| EMPLOYEE_DEACTIVATED | Employee deactivated | Employee ID, user, reason, timestamp |
| EMPLOYEE_REACTIVATED | Employee reactivated | Employee ID, user, timestamp |
| COMPENSATION_UPDATED | Salary changed | Old salary, new salary, effective date, user |
| COMPENSATION_HISTORY_CREATED | Compensation record created | Record data, user |
| DOCUMENT_UPLOADED | Document added | Document name, size, user |
| DOCUMENT_DELETED | Document removed | Document name, user |
| PAYROLL_RUN_CREATED | Payroll generated | Period, employee count, total amount, user |
| PAYROLL_RUN_APPROVED | Payroll approved | Run ID, approver, timestamp |
| PAYROLL_RUN_PROCESSED | Payroll processed | Run ID, processor, timestamp |
| SALARY_SLIP_GENERATED | Slip created | Employee ID, period, user |

### Audit Log Fields

```typescript
interface AuditLog {
  id: UUID
  employeeId: UUID
  
  // Event details
  eventType: string (e.g., 'EMPLOYEE_UPDATED')
  entityType: 'Employee' | 'Compensation' | 'Payroll'
  entityId: UUID
  
  // Change tracking
  changesBefore: Record<string, any>
  changesAfter: Record<string, any>
  changedFields: string[]
  
  // User & context
  userId: UUID
  userName: string
  userRole: string
  
  // Request info
  ipAddress: string
  userAgent: string
  reason?: string
  
  // Metadata
  timestamp: DateTime
  requestId: string
  status: 'Success' | 'Failed'
}
```

### Audit Trail View

**On Employee Detail Page:**
- "View History" button opens audit log panel
- Shows all changes chronologically
- Filterable by event type, date range
- Exportable to CSV

---

## Role-Based Access Control

### Access Matrix

| Feature | Employee | Manager | HR | Finance | Admin |
|---------|----------|---------|----|----|-------|
| View own profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| View team profiles | ❌ | ✅ | ✅ | ❌ | ✅ |
| View all employees | ❌ | ❌ | ✅ | ❌ | ✅ |
| Edit own profile (limited) | ✅ | ❌ | ✅ | ❌ | ✅ |
| Edit any employee | ❌ | ❌ | ✅ | ❌ | ✅ |
| Edit compensation | ❌ | ❌ | ✅ | ✅ | ✅ |
| View compensation | ✅ | ❌ | ✅ | ✅ | ✅ |
| Deactivate employee | ❌ | ❌ | ✅ | ❌ | ✅ |
| Manage payroll | ❌ | ❌ | ✅ | ✅ | ✅ |
| Download salary slip | ✅ | ❌ | ✅ | ✅ | ✅ |
| Upload documents | ✅ (own) | ❌ | ✅ | ❌ | ✅ |
| View audit logs | ❌ | ❌ | ✅ | ❌ | ✅ |
| Export employee data | ❌ | ❌ | ✅ | ✅ | ✅ |

### Field-Level Restrictions

**HR can edit all fields EXCEPT:**
- Employee ID (auto-generated, immutable)
- Account number (encrypted, cannot edit after creation)

**Employees can edit own:**
- Contact information (phone, emergency contact)
- Address information
- Profile photo

**Finance can edit:**
- Compensation fields only
- Deduction records

---

## User Workflows

### Workflow 1: View Employee Directory

```
User navigates to /staff
↓
Page loads, shows list of employees
↓
User can:
├─ Sort by clicking column headers
├─ Filter by department, designation, status
├─ Search by name, ID, email
├─ Change page/page size
└─ Click employee row to view detail
```

### Workflow 2: View Employee Profile

```
User clicks on employee name
↓
Navigated to /staff/:employeeId
↓
Detail page loads with 5 sections
↓
User can:
├─ View all employee information
├─ Scroll through sections
├─ Click project assignments to view projects
├─ View audit log (HR only)
└─ Click Edit button to modify (HR or self)
```

### Workflow 3: Edit Employee (HR)

```
HR user clicks Edit button
↓
Navigated to /staff/:employeeId/edit
↓
Form displays with 4 tabs
↓
HR fills/modifies fields
↓
Form validates in real-time
↓
HR clicks "Save Changes"
↓
Request sent to API
↓
✅ Success: Redirect to detail, show success toast
   Audit log created: EMPLOYEE_UPDATED with before/after values
   
❌ Error: Show error, keep form data
   Allow retry
```

### Workflow 4: Upload Document (HR)

```
On employee detail page
↓
HR clicks Upload in Documents section
↓
File upload dialog appears
↓
HR selects file (PDF, DOC, etc.)
↓
File uploads to server
↓
Document added to list
↓
Audit log created: DOCUMENT_UPLOADED
```

### Workflow 5: View Salary Information (Employee)

```
Employee navigates to /staff/compensation
↓
Shows own salary information
│
├─ Base Salary: $60,000/year
├─ Allowances: $12,000/year
├─ Bonus: $10,000/year
├─ Monthly CTC: $6,833.33
│
└─ [View History] [Download Slips]
```

### Workflow 6: Generate Payroll (HR/Finance)

```
Finance user navigates to /payroll
↓
Clicks "+ Generate Payroll" button
↓
Modal appears asking for month/year
↓
Finance selects period
↓
System calculates salaries for all active employees
↓
Payroll run created in Draft status
↓
Redirect to payroll detail page
↓
Finance reviews numbers
↓
Clicks "Approve" button
↓
Status changes to Approved
↓
Audit log: PAYROLL_RUN_APPROVED
↓
Can now "Process Payroll" (initiate bank transfer)
```

---

## Implementation Checklist

### Phase 1: Core Structure (Week 1)

**Backend:**
- [ ] Define Employee data model
- [ ] Define Compensation model
- [ ] Define PayrollRun model
- [ ] Create audit log table/triggers
- [ ] Implement employee CRUD API
- [ ] Implement list endpoints with filtering
- [ ] Implement role-based access control
- [ ] Create test data fixtures

**Frontend:**
- [ ] Create folder structure
- [ ] Setup route configuration
- [ ] Setup Redux store
- [ ] Setup RTK Query API
- [ ] Create base page components
- [ ] Setup TypeScript types

### Phase 2: Employee List (Week 1-2)

- [ ] EmployeeListTable component
- [ ] EmployeeListFilters component
- [ ] EmployeeListPagination component
- [ ] Implement filtering, sorting, pagination
- [ ] Implement bulk actions (HR)
- [ ] Add responsive styling
- [ ] Add empty states

### Phase 3: Employee Detail (Week 2-3)

- [ ] 5 section components
- [ ] Fetch employee data
- [ ] Display all information
- [ ] Add audit log viewer
- [ ] Add action buttons
- [ ] Responsive layout

### Phase 4: Edit & Create (Week 3-4)

- [ ] 4 tab form components
- [ ] Form validation
- [ ] Auto-save drafts
- [ ] Unsaved changes warning
- [ ] Audit logging on submit
- [ ] Permission-based fields

### Phase 5: Payroll (Week 4-5)

- [ ] Payroll runs list
- [ ] Payroll run detail
- [ ] Generate payroll logic
- [ ] Approve/Process workflows
- [ ] Salary slip generation
- [ ] Reports

### Phase 6: Integration & Polish (Week 5-6)

- [ ] Connect to Attendance module
- [ ] Connect to Projects module
- [ ] Full E2E testing
- [ ] Performance optimization
- [ ] Accessibility review
- [ ] Documentation

---

## Summary

### Key Design Decisions

✅ **4-column list:** Employee ID, Name, Designation, Project (clickable)  
✅ **5-section detail:** Profile, Compensation, Attendance, Projects, Documents  
✅ **HR-only edit:** With full audit logging  
✅ **Tabbed edit form:** Organized by category  
✅ **Role-based access:** Different access per role  
✅ **Immutable audit trail:** All changes tracked  
✅ **Compensation history:** Timeline view of salary changes  
✅ **Payroll integration:** Generate runs, approve, process  

### Architecture Highlights

| Component | Technology | Purpose |
|-----------|-----------|---------|
| State Management | Redux Toolkit | Centralized state |
| Data Fetching | RTK Query | Efficient API caching |
| Forms | React Hook Form | Type-safe validation |
| Audit Logging | DB Triggers | Immutable audit trail |
| Authorization | Role-based middleware | Enforce permissions |

---

**Document Status:** Approved for Development  
**Next Step:** Begin Phase 1 implementation  
**Timeline:** 6 weeks for complete module  
**Dependencies:** Attendance module (for attendance integration), Projects module (for project linking)
