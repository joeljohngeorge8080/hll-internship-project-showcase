# HMA EMS - Project Module Architecture

**Date:** June 11, 2026  
**Version:** 1.0  
**Status:** Approved Architecture  
**Audience:** Development Team, Architecture Committee

---

## Table of Contents

1. [Module Overview](#module-overview)
2. [Page Structure](#page-structure)
3. [Component Structure](#component-structure)
4. [Route Structure](#route-structure)
5. [State Management Design](#state-management-design)
6. [Data Models](#data-models)
7. [API Integration](#api-integration)
8. [Audit Logging](#audit-logging)
9. [User Interactions & Workflows](#user-interactions--workflows)
10. [Error Handling](#error-handling)
11. [Performance Considerations](#performance-considerations)
12. [Implementation Checklist](#implementation-checklist)

---

## Module Overview

### Projects Module Purpose

The Projects module enables HMA staff to:
- View all projects organized by type (CSR or LSGB)
- Access comprehensive project information and metrics
- Track project expenses (predicted vs. actual)
- Analyze financial health and budget utilization
- Export project data for reporting

### Module Scope

**In Scope:**
- Project list with filtering, sorting, search
- Project detail view with full information
- Expense tracking (predicted and actual)
- Expense analysis with visualizations
- Project edit (create new, update existing) with audit logging
- Role-based access control
- Export functionality

**Out of Scope:**
- Project creation workflows (admin form only)
- Team member assignment (handled in Staff module)
- Financial approval workflows (handled in Finance module)
- Project scheduling/gantt charts (future enhancement)

### Target Users

1. **Employees:** View-only access to assigned projects and projects they can see per department
2. **Managers:** View all team projects, edit team project details
3. **Finance:** View all projects, approve expenses, analyze budgets
4. **HR:** View all projects, generate reports
5. **Admin:** Full access, can create/edit/delete projects

---

## Page Structure

### Page Hierarchy

```
Projects Module
├── Projects List Page (CSR)
│   ├── Filters & Search
│   ├── Data Table with 10 columns
│   ├── Pagination
│   └── Bulk Actions (admin only)
│
├── Projects List Page (LSGB)
│   ├── Filters & Search
│   ├── Data Table with 10 columns
│   ├── Pagination
│   └── Bulk Actions (admin only)
│
├── Project Detail Page
│   ├── Section 1: Project Overview
│   ├── Section 2: Predicted Expense Distribution
│   ├── Section 3: Actual Expenses
│   ├── Section 4: Expense Analysis
│   ├── Section 5: Charts & Visualizations
│   ├── Section 6: Summary
│   └── Action Bar (Edit, Delete, Export)
│
├── Project Edit Page
│   ├── General Information Form
│   ├── Financial Details Form
│   ├── Timeline Form
│   ├── Status Dropdown
│   └── Save/Cancel Buttons
│
└── Project Create Page
    ├── Type Selection (CSR or LSGB)
    ├── General Information Form
    ├── Financial Details Form
    ├── Timeline Form
    └── Create/Cancel Buttons
```

### 1. Project List Page (CSR/LSGB)

#### Page Layout

```
┌─────────────────────────────────────────────────────────┐
│ Breadcrumb: Home / Projects / CSR Projects              │
├─────────────────────────────────────────────────────────┤
│ Page Header                                             │
│ - Title: "CSR Projects"                                 │
│ - Subtitle: "12 active projects, 34 completed"          │
│ - Action Button: "+ New Project" (admin only)           │
├─────────────────────────────────────────────────────────┤
│ Filters & Search Section                                │
│ [Search by name/ID] [Status ▼] [Funder ▼] [Clear All]  │
├─────────────────────────────────────────────────────────┤
│ Data Table                                              │
│ ┌────┬──────────┬────────────┬──────────┬──────────┐    │
│ │ ID │ Name     │ Type       │ Status   │ Value    │... │
│ ├────┼──────────┼────────────┼──────────┼──────────┤    │
│ │ CS │ Project1 │ CSR        │ Active   │ $50,000  │ 🔗 │
│ │ CS │ Project2 │ CSR        │ Planned  │ $75,000  │ 🔗 │
│ └────┴──────────┴────────────┴──────────┴──────────┘    │
├─────────────────────────────────────────────────────────┤
│ Pagination: [< 1 2 3 >] Show: [10 ▼] entries            │
└─────────────────────────────────────────────────────────┘
```

#### Table Columns (10 fields)

| Column | Data Type | Sortable | Filterable | Searchable | Format |
|--------|-----------|----------|-----------|-----------|---------|
| **Project ID** | String | ✅ Yes | ❌ No | ✅ Yes | CS-2024-001 |
| **Project Name** | String | ✅ Yes | ❌ No | ✅ Yes | Text (bold) |
| **Project Type** | Enum | ✅ Yes | ✅ Yes | ❌ No | "CSR" or "LSGB" badge |
| **Funder** | String | ✅ Yes | ✅ Yes | ✅ Yes | Text (with logo if exists) |
| **Location** | String | ✅ Yes | ✅ Yes | ✅ Yes | "City, Country" |
| **Project Value** | Currency | ✅ Yes | ❌ No | ❌ No | $XX,XXX.XX |
| **Overhead Model** | String | ✅ Yes | ✅ Yes | ❌ No | "Fixed" / "Percentage" badge |
| **Start Date** | Date | ✅ Yes | ✅ Yes | ❌ No | MM/DD/YYYY |
| **End Date** | Date | ✅ Yes | ✅ Yes | ❌ No | MM/DD/YYYY |
| **Status** | Enum | ✅ Yes | ✅ Yes | ❌ No | Planned / Active / On Hold / Completed / Closed |
| **Responsible Staff** | String | ✅ Yes | ✅ Yes | ❌ No | Name (with avatar) |

#### List Page Features

**Search:**
- Search by project name (partial match)
- Search by project ID (exact match)
- Search by funder name (partial match)
- Real-time search as user types

**Filters:**
- Filter by Status: Planned, Active, On Hold, Completed, Closed
- Filter by Funder: Dynamic list from projects
- Filter by Overhead Model: Fixed, Percentage
- Filter by Date Range: Start/End date pickers
- Multi-select filters (AND logic)

**Sorting:**
- Default sort: Project Name (A-Z)
- Click column header to sort ascending/descending
- Persist sort preference in local storage

**Pagination:**
- Display options: 10, 25, 50, 100 entries per page
- Page indicators: "Showing 1-10 of 50 results"
- Navigation: Previous/Next buttons, page number input

**Bulk Actions (Admin only):**
- Select multiple projects (checkbox in header)
- Export selected to CSV
- Change status for selected projects
- Delete selected projects (with confirmation)

**Row Actions:**
- Click row to navigate to detail page
- Hover over row to show action menu: View, Edit, Delete
- Right-click context menu: View, Edit, Delete, Export

#### Empty States

**No projects exist:**
```
┌─────────────────────────────────┐
│                                 │
│    📁 No projects found        │
│                                 │
│   Get started by creating       │
│   your first CSR project        │
│                                 │
│   [+ Create Project]            │
│                                 │
└─────────────────────────────────┘
```

**No results match filters:**
```
┌─────────────────────────────────┐
│                                 │
│   🔍 No matches found          │
│                                 │
│   Try adjusting your filters   │
│   or search terms              │
│                                 │
│   [Clear Filters]              │
│                                 │
└─────────────────────────────────┘
```

### 2. Project Detail Page

#### Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Breadcrumb: Home / Projects / CSR Projects / [Project Name] │
├─────────────────────────────────────────────────────────────┤
│ Header Section                                              │
│ - Status Badge: "Active"                                    │
│ - Title: "Project Name"                                     │
│ - Action Buttons: [Edit] [Delete] [Export] [...]            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ SECTION 1: PROJECT OVERVIEW                                │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Project ID       │ CS-2024-001                      │    │
│ │ Project Type     │ CSR                              │    │
│ │ Funder           │ Global Foundation Inc.           │    │
│ │ Location         │ New York, USA                    │    │
│ │ Start Date       │ 01/15/2024                       │    │
│ │ End Date         │ 12/31/2024                       │    │
│ │ Duration         │ 11 months 16 days               │    │
│ │ Responsible Staff│ John Smith (Manager)             │    │
│ │ Status           │ Active                           │    │
│ │ Budget           │ $250,000                         │    │
│ │ Spent            │ $125,000 (50%)                   │    │
│ │ Remaining        │ $125,000 (50%)                   │    │
│ │ Overhead Model   │ 15% Fixed                        │    │
│ │ Estimated OH     │ $37,500                          │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ SECTION 2: PREDICTED EXPENSE DISTRIBUTION                  │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Budget Breakdown (Table View)                       │    │
│ │ ┌─────────────┬──────────┬──────────┬──────────┐   │    │
│ │ │ Category    │ Amount   │ % of Total│ Status   │   │    │
│ │ ├─────────────┼──────────┼──────────┼──────────┤   │    │
│ │ │ Staff Costs │ $80,000  │ 32%      │ 100% OH  │   │    │
│ │ │ Equipment   │ $60,000  │ 24%      │ 50% OH   │   │    │
│ │ │ Transport   │ $40,000  │ 16%      │ No OH    │   │    │
│ │ │ Operations  │ $50,000  │ 20%      │ 100% OH  │   │    │
│ │ │ Admin       │ $20,000  │ 8%       │ 100% OH  │   │    │
│ │ └─────────────┴──────────┴──────────┴──────────┘   │    │
│ │ Pie Chart (predicted)                              │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ SECTION 3: ACTUAL EXPENSES                                 │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Expenses Table (Last 20 entries)                    │    │
│ │ ┌────┬─────────┬──────────┬─────┬──────┬────────┐  │    │
│ │ │ ID │ Category│ Amount   │ Date│ Staff│ Status │  │    │
│ │ ├────┼─────────┼──────────┼─────┼──────┼────────┤  │    │
│ │ │ E1 │ Staff   │ $1,200   │ Date│ Name │ Paid   │  │    │
│ │ │ E2 │ Equipment$800      │ Date│ Name │ Pending│  │    │
│ │ └────┴─────────┴──────────┴─────┴──────┴────────┘  │    │
│ │ Total Actual Expenses: $45,000                      │    │
│ │ [View All Expenses]                                 │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ SECTION 4: EXPENSE ANALYSIS                                │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Variance Analysis                                   │    │
│ │ ┌──────────────┬──────────┬──────────┬──────────┐  │    │
│ │ │ Category     │ Predicted│ Actual   │ Variance │  │    │
│ │ ├──────────────┼──────────┼──────────┼──────────┤  │    │
│ │ │ Staff Costs  │ $80,000  │ $42,000  │ -$38,000 │  │    │
│ │ │ Equipment    │ $60,000  │ $2,000   │ -$58,000 │  │    │
│ │ │ Transport    │ $40,000  │ $1,000   │ -$39,000 │  │    │
│ │ └──────────────┴──────────┴──────────┴──────────┘  │    │
│ │ Variance Trend (%)                                  │    │
│ │ - Staff Costs: -47.5% (Under Budget)               │    │
│ │ - Equipment: -96.7% (Significantly Under Budget)   │    │
│ │ - Transport: -97.5% (Significantly Under Budget)   │    │
│ │ Overall Project Variance: -88% (Under Budget)      │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ SECTION 5: CHARTS & VISUALIZATIONS                         │
│ ┌────────────────────────┬────────────────────────────┐   │
│ │ Budget vs Actual       │ Expense Trend Over Time    │   │
│ │ (Bar Chart)            │ (Line Chart)               │   │
│ │  Expected: $250K       │  Monthly Spending Pattern  │   │
│ │  Actual:   $125K       │  Q1: $30K, Q2: $45K,etc  │   │
│ │                        │                            │   │
│ │ Pie Charts             │ Category Breakdown         │   │
│ │ Predicted Distribution │ Actual Distribution        │   │
│ └────────────────────────┴────────────────────────────┘   │
│                                                             │
│ SECTION 6: SUMMARY                                         │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Key Metrics                                         │    │
│ │ - Total Budget: $250,000                            │    │
│ │ - Total Spent: $125,000 (50% Utilization)          │    │
│ │ - Budget Remaining: $125,000                        │    │
│ │ - Projected Final Cost: $145,000 (58%)             │    │
│ │ - Days Remaining: 234 days                          │    │
│ │ - Budget Health: GOOD (on track)                    │    │
│ │                                                     │    │
│ │ Status & Next Steps                                │    │
│ │ - Current Status: Active and on track              │    │
│ │ - Next Milestone: Phase 2 - July 1st               │    │
│ │ - Upcoming Payments: $15,000 due July 15th         │    │
│ │                                                     │    │
│ │ [Print] [Export as PDF] [Share]                     │    │
│ └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

#### Section Specifications

**Section 1: Project Overview**
- Format: Two-column layout (label-value pairs)
- Fields: ID, Type, Funder, Location, Start/End Dates, Duration, Responsible Staff, Status, Budget, Spent, Remaining, Overhead Model, Estimated Overhead
- Edit capability: Edit button opens side panel for inline editing
- All fields display-only (no direct field editing on detail page)

**Section 2: Predicted Expense Distribution**
- Format: Table + Pie Chart (dual layout)
- Table columns: Category, Amount, % of Total, Overhead Applied
- Pie chart: Visual representation of budget breakdown
- Legend: Shows all categories with color coding
- Interactivity: Click chart segment to filter Section 3 actual expenses by category

**Section 3: Actual Expenses**
- Format: Table (paginated, max 20 rows per page)
- Columns: ID, Category, Amount, Date, Staff Name, Status
- Link each expense to Expense Management module
- Summary row: Total actual expenses
- "View All Expenses" link: Opens full expense list filtered by this project

**Section 4: Expense Analysis**
- Format: Variance comparison table + Text summary
- Table columns: Category, Predicted, Actual, Variance, Variance %
- Color coding: Red (over budget), Green (under budget), Neutral (on budget)
- Summary text: Narrative analysis of budget performance
- Alerts: If over budget or approaching limits

**Section 5: Charts & Visualizations**
- 4-chart layout:
  1. Budget vs Actual (Bar chart): Horizontal bars comparing total planned vs spent
  2. Expense Trend Over Time (Line chart): Monthly spending pattern
  3. Predicted Distribution (Pie chart): Budget breakdown by category
  4. Actual Distribution (Pie chart): Spending breakdown by category
- Interactive: Hover for values, click to filter other sections
- Legend: All charts include legends with color coding

**Section 6: Summary**
- Format: Cards + Summary text + Action buttons
- Key Metrics cards: Budget, Spent, Remaining, Utilization %, Projected Final Cost, Days Remaining, Budget Health
- Status narrative: Plain-English summary of project status
- Next steps: Upcoming milestones, due payments, action items
- Export options: Print, Export as PDF, Share link

### 3. Project Edit Page

#### Edit Page Layout

```
┌─────────────────────────────────────────────────────────┐
│ Breadcrumb: ... / [Project Name] / Edit                 │
├─────────────────────────────────────────────────────────┤
│ Page Header                                             │
│ - Title: "Edit Project"                                 │
│ - Subtitle: "Make changes to project details"          │
├─────────────────────────────────────────────────────────┤
│ Side Panel Layout (2/3 content, 1/3 sidebar)            │
│                                                         │
│ Form Sections:                                          │
│                                                         │
│ FORM: General Information                               │
│ ├─ Project Name (required, text)                        │
│ ├─ Project Type (read-only, CSR/LSGB)                  │
│ ├─ Description (optional, textarea)                     │
│ ├─ Funder (required, select/autocomplete)              │
│ ├─ Location (required, text)                            │
│ ├─ Responsible Staff (required, staff select)           │
│ └─ Status (required, select: Planned/Active/Hold/...)  │
│                                                         │
│ FORM: Financial Details                                 │
│ ├─ Total Budget (required, currency)                    │
│ ├─ Overhead Model (required, select: Fixed/Percentage) │
│ ├─ Overhead Amount/Rate (required, currency/percent)   │
│ ├─ Expense Categories (expandable list)                │
│ │  ├─ Category Name (required)                          │
│ │  ├─ Predicted Amount (required, currency)            │
│ │  ├─ Overhead Applied (yes/no toggle)                 │
│ │  └─ [Remove Category]                                │
│ │  [+ Add Category]                                     │
│ └─ Contingency Amount (optional, currency)              │
│                                                         │
│ FORM: Timeline                                          │
│ ├─ Start Date (required, date picker)                   │
│ ├─ End Date (required, date picker)                     │
│ ├─ Milestones (expandable list)                         │
│ │  ├─ Milestone Name (required)                         │
│ │  ├─ Target Date (required, date picker)              │
│ │  ├─ Expected Cost (optional, currency)               │
│ │  └─ [Remove Milestone]                               │
│ │  [+ Add Milestone]                                    │
│ └─ Notes (optional, textarea)                           │
│                                                         │
│ Form Controls:                                          │
│ [Save Changes] [Discard Changes] [Delete Project]      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Edit Page Features

**Form Validation:**
- Real-time field validation with error messages
- Required field indicators (red asterisk)
- Field-level error messages below field
- Form-level validation on submit

**Unsaved Changes:**
- Auto-save draft to local storage
- Dirty flag prevents accidental loss
- Warning before navigating away: "You have unsaved changes"
- Auto-detect changes, enable Save button only when changed

**Inline Editing:**
- Add/Remove expense categories dynamically
- Add/Remove milestones dynamically
- Date pickers for date fields
- Dropdown/autocomplete for select fields

**Permission-Based Editing:**
- Employees: Cannot edit projects
- Managers: Can edit projects assigned to their team
- Finance: Can edit financial details only
- HR: Can view, limited edit capability
- Admin: Full edit capability

**Audit Trail on Edit:**
- All changes logged with before/after values
- User ID, timestamp, IP address recorded
- Edit reason optional field (recommended for managers)
- Audit log accessible from edit page

### 4. Project Create Page

#### Create Page Layout

```
┌─────────────────────────────────────────────────────────┐
│ Breadcrumb: Home / Projects / Create New Project         │
├─────────────────────────────────────────────────────────┤
│ Page Header                                             │
│ - Title: "Create New Project"                           │
│ - Subtitle: "Add a new CSR or LSGB project to HMA EMS" │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ STEP 1: Select Project Type (if not pre-selected)      │
│                                                         │
│ ┌─────────────┐  ┌─────────────┐                       │
│ │   CSR       │  │    LSGB     │                       │
│ │ PROJECT     │  │  PROJECT    │                       │
│ │             │  │             │                       │
│ │ For CSR     │  │ For LSGB    │                       │
│ │ division... │  │ division... │                       │
│ └─────────────┘  └─────────────┘                       │
│                                                         │
│ STEP 2: Fill Project Information (Same as Edit)        │
│ [Same form sections as Edit Page]                       │
│                                                         │
│ Form Controls:                                          │
│ [Create Project] [Cancel]                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Create Page Features

- Type pre-selection: If accessed from /projects/csr/new, CSR is pre-selected
- Same form sections as Edit page
- All required fields must be filled before Create button is enabled
- On successful creation: Redirect to project detail page, show success toast
- Audit log created immediately upon project creation

---

## Component Structure

### Component Hierarchy

```
Projects Module (Directory: src/features/projects/)
│
├── pages/
│   ├── ProjectsListPage.jsx (CSR/LSGB list view)
│   ├── ProjectDetailPage.jsx
│   ├── ProjectEditPage.jsx
│   └── ProjectCreatePage.jsx
│
├── components/
│   ├── ProjectList/
│   │   ├── ProjectListTable.jsx (main table component)
│   │   ├── ProjectListFilters.jsx (filters & search)
│   │   ├── ProjectListPagination.jsx (pagination controls)
│   │   ├── ProjectListActions.jsx (bulk actions for admin)
│   │   └── ProjectListEmptyState.jsx (empty/no results)
│   │
│   ├── ProjectDetail/
│   │   ├── ProjectDetailHeader.jsx (status, title, action buttons)
│   │   ├── ProjectOverviewSection.jsx (Section 1)
│   │   ├── PredictedExpenseSection.jsx (Section 2: table + pie chart)
│   │   ├── ActualExpensesSection.jsx (Section 3: expense table)
│   │   ├── ExpenseAnalysisSection.jsx (Section 4: variance analysis)
│   │   ├── ChartsVisualizationSection.jsx (Section 5: 4 charts)
│   │   ├── SummarySection.jsx (Section 6: key metrics + next steps)
│   │   └── ProjectDetailSidebar.jsx (optional sidebar for related info)
│   │
│   ├── ProjectForm/
│   │   ├── ProjectFormWrapper.jsx (handles create/edit logic)
│   │   ├── GeneralInformationForm.jsx
│   │   ├── FinancialDetailsForm.jsx
│   │   ├── TimelineForm.jsx
│   │   ├── ExpenseCategoryInput.jsx (reusable category input)
│   │   ├── MilestoneInput.jsx (reusable milestone input)
│   │   └── FormControls.jsx (Save, Cancel, Delete buttons)
│   │
│   ├── Charts/
│   │   ├── BudgetVsActualChart.jsx (bar chart)
│   │   ├── ExpenseTrendChart.jsx (line chart)
│   │   ├── PredictedDistributionChart.jsx (pie chart)
│   │   ├── ActualDistributionChart.jsx (pie chart)
│   │   └── ChartContainer.jsx (wrapper for consistent styling)
│   │
│   ├── Tables/
│   │   ├── ExpenseCategoryTable.jsx (predicted expenses)
│   │   ├── ActualExpensesTable.jsx (recent actual expenses)
│   │   ├── VarianceAnalysisTable.jsx (variance comparison)
│   │   └── TableRow.jsx (reusable table row)
│   │
│   ├── Cards/
│   │   ├── KeyMetricCard.jsx (for summary section)
│   │   └── StatusCard.jsx (project status info)
│   │
│   ├── Modals/
│   │   ├── ConfirmDeleteModal.jsx (delete confirmation)
│   │   ├── ProjectEditModal.jsx (side panel for quick edit)
│   │   └── ExportOptionsModal.jsx (export to CSV/PDF)
│   │
│   └── Common/
│       ├── ProjectTypeBadge.jsx (CSR/LSGB badge)
│       ├── StatusBadge.jsx (Planned/Active/Hold/etc)
│       ├── OverheadModelBadge.jsx (Fixed/Percentage)
│       └── CurrencyDisplay.jsx (formatted money)
│
├── hooks/
│   ├── useProjects.js (fetch all projects)
│   ├── useProjectDetail.js (fetch single project)
│   ├── useProjectForm.js (form submission logic)
│   ├── useProjectFilters.js (filter state management)
│   ├── useProjectExport.js (export functionality)
│   ├── useProjectAudit.js (audit logging)
│   └── useProjectPagination.js (pagination state)
│
├── services/
│   ├── projectService.js (API calls)
│   ├── projectExpenseService.js (expense-related API)
│   ├── projectAnalyticsService.js (variance/analysis calculations)
│   └── projectAuditService.js (audit log API)
│
├── store/
│   ├── projectSlice.js (Redux reducer)
│   ├── projectSelectors.js (state selectors)
│   └── projectAPI.js (RTK Query endpoints)
│
├── types/
│   ├── project.types.ts (TypeScript types)
│   ├── expense.types.ts (expense-related types)
│   └── audit.types.ts (audit log types)
│
└── utils/
    ├── projectDataTransform.js (data formatting)
    ├── expenseCalculations.js (budget/expense math)
    ├── filterHelpers.js (filter utilities)
    ├── sortHelpers.js (sorting utilities)
    └── validationRules.js (form validation rules)
```

### Component Specifications

#### Page Components

**ProjectsListPage.jsx**
- Props: None (reads from route: /projects/csr or /projects/lsgb)
- Children: ProjectListFilters, ProjectListTable, ProjectListPagination, ProjectListActions (admin)
- State: Filter values, sort config, current page, page size
- Behavior: Displays CSR or LSGB projects based on URL

**ProjectDetailPage.jsx**
- Props: projectId (from URL params)
- Children: ProjectDetailHeader, 6 Section components, ProjectDetailSidebar (optional)
- State: Project data (loading, error), expanded sections
- Behavior: Fetches and displays project details

**ProjectEditPage.jsx**
- Props: projectId (from URL params, empty for create)
- Children: ProjectFormWrapper, FormControls
- State: Form values, validation errors, loading, unsaved changes
- Behavior: Edit existing or create new project

#### Layout Components

**ProjectDetailHeader.jsx**
- Props: project data, onEdit callback, onDelete callback, onExport callback
- Displays: Status badge, project name, description, action buttons
- Behavior: Manages edit/delete modal state

**ProjectListTable.jsx**
- Props: projects array, isLoading, sortConfig, currentSort, onSort, onRowClick
- Displays: 10-column table with sorting, clickable rows
- Behavior: Renders data, handles row selection, emits sort events

**ProjectListFilters.jsx**
- Props: onFilterChange callback, currentFilters
- Displays: Search input, filter dropdowns
- Behavior: Real-time filtering, emits filter changes

#### Form Components

**ProjectFormWrapper.jsx**
- Props: projectId (optional), onSuccess callback
- Children: GeneralInformationForm, FinancialDetailsForm, TimelineForm, FormControls
- State: Form submission state, validation errors, unsaved changes
- Behavior: Orchestrates form submission, handles auto-save to local storage

**GeneralInformationForm.jsx**
- Props: initialValues, onChange callback
- Displays: 7 form fields
- Behavior: Real-time validation, field change events

**FinancialDetailsForm.jsx**
- Props: initialValues, onChange callback
- Displays: 6 main fields + dynamic category list
- Behavior: Category add/remove, overhead calculation

**TimelineForm.jsx**
- Props: initialValues, onChange callback
- Displays: Start/End dates, milestone list
- Behavior: Milestone add/remove, date validation

#### Section Components

**PredictedExpenseSection.jsx**
- Props: project data
- Displays: Category table (5 columns) + Pie chart
- Behavior: Synchronized - clicking chart filters table

**ActualExpensesSection.jsx**
- Props: project data, expenses array
- Displays: Expense table (6 columns, 20 rows max)
- Behavior: Link to expense detail, "View All" link

**ExpenseAnalysisSection.jsx**
- Props: project data, expenses array
- Displays: Variance table (4 columns) + narrative text
- Behavior: Color coding (red/green/neutral), summary calculation

**ChartsVisualizationSection.jsx**
- Props: project data, expenses array
- Displays: 4 charts in 2x2 grid
- Behavior: Responsive, interactive tooltips

#### Chart Components

**BudgetVsActualChart.jsx**
- Type: Horizontal bar chart
- Data: Predicted total vs Actual total
- Interaction: Hover for values

**ExpenseTrendChart.jsx**
- Type: Line chart
- Data: Monthly spending over project duration
- Interaction: Click point for month detail

**PredictedDistributionChart.jsx**
- Type: Pie chart
- Data: Budget breakdown by category
- Interaction: Click segment to filter other sections

**ActualDistributionChart.jsx**
- Type: Pie chart
- Data: Actual spending by category
- Interaction: Click segment to filter other sections

#### Common Components

**ProjectTypeBadge.jsx**
- Props: type ('CSR' | 'LSGB')
- Display: Colored badge with icon
- Colors: CSR = Blue, LSGB = Green

**StatusBadge.jsx**
- Props: status enum
- Display: Colored badge with icon
- Colors: Planned = Gray, Active = Green, OnHold = Orange, Completed = Blue, Closed = Red

**OverheadModelBadge.jsx**
- Props: model ('Fixed' | 'Percentage')
- Display: Colored badge

**CurrencyDisplay.jsx**
- Props: amount (number)
- Display: Formatted currency string ($XX,XXX.XX)
- Behavior: Handles null/undefined, supports different currencies

---

## Route Structure

### Route Tree

```
/projects                          ← Projects module root
├── /projects/csr                  ← CSR Projects list
│   ├── /projects/csr/new          ← Create new CSR project
│   └── /projects/csr/:projectId   ← CSR project detail
│       ├── /projects/csr/:projectId/edit    ← CSR project edit
│       ├── /projects/csr/:projectId/expenses ← Project's expenses (future)
│       └── /projects/csr/:projectId/analytics ← Detailed analytics (future)
│
└── /projects/lsgb                 ← LSGB Projects list
    ├── /projects/lsgb/new         ← Create new LSGB project
    └── /projects/lsgb/:projectId  ← LSGB project detail
        ├── /projects/lsgb/:projectId/edit    ← LSGB project edit
        ├── /projects/lsgb/:projectId/expenses ← Project's expenses (future)
        └── /projects/lsgb/:projectId/analytics ← Detailed analytics (future)
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

// Routes for Projects Module
const projectRoutes = [
  // List Routes
  {
    path: 'csr',
    component: ProjectsListPage,
    exact: true,
    requiredRoles: ['*'],
    title: 'CSR Projects',
    breadcrumb: 'CSR Projects'
  },
  {
    path: 'lsgb',
    component: ProjectsListPage,
    exact: true,
    requiredRoles: ['*'],
    title: 'LSGB Projects',
    breadcrumb: 'LSGB Projects'
  },

  // Create Routes
  {
    path: 'csr/new',
    component: ProjectCreatePage,
    exact: true,
    requiredRoles: ['Admin', 'Manager', 'HR'],
    title: 'Create CSR Project',
    breadcrumb: 'Create New Project'
  },
  {
    path: 'lsgb/new',
    component: ProjectCreatePage,
    exact: true,
    requiredRoles: ['Admin', 'Manager', 'HR'],
    title: 'Create LSGB Project',
    breadcrumb: 'Create New Project'
  },

  // Detail Routes
  {
    path: 'csr/:projectId',
    component: ProjectDetailPage,
    exact: true,
    requiredRoles: ['*'],
    title: (params) => `Project: ${params.projectId}`,
    breadcrumb: (params) => `${params.projectName}`
  },
  {
    path: 'lsgb/:projectId',
    component: ProjectDetailPage,
    exact: true,
    requiredRoles: ['*'],
    title: (params) => `Project: ${params.projectId}`,
    breadcrumb: (params) => `${params.projectName}`
  },

  // Edit Routes
  {
    path: 'csr/:projectId/edit',
    component: ProjectEditPage,
    exact: true,
    requiredRoles: ['Admin', 'Manager', 'HR'],
    title: 'Edit Project',
    breadcrumb: 'Edit'
  },
  {
    path: 'lsgb/:projectId/edit',
    component: ProjectEditPage,
    exact: true,
    requiredRoles: ['Admin', 'Manager', 'HR'],
    title: 'Edit Project',
    breadcrumb: 'Edit'
  }
]
```

### Route Parameters

**Dynamic Segments:**

| Segment | Type | Example | Source |
|---------|------|---------|--------|
| projectId | UUID | `550e8400-e29b-41d4-a716-446655440000` | Database primary key |
| division | String | `csr` or `lsgb` | Route segment |

### URL Examples

```
/projects/csr                           ← CSR projects list
/projects/csr/123-456-789               ← CSR project detail
/projects/csr/123-456-789/edit          ← Edit CSR project
/projects/csr/new                       ← Create new CSR project

/projects/lsgb                          ← LSGB projects list
/projects/lsgb/987-654-321              ← LSGB project detail
/projects/lsgb/987-654-321/edit         ← Edit LSGB project
/projects/lsgb/new                      ← Create new LSGB project
```

---

## State Management Design

### Redux Store Structure

```
store/
├── projects (projectSlice)
│   ├── list
│   │   ├── data: Project[]
│   │   ├── loading: boolean
│   │   ├── error: string | null
│   │   ├── filters: FilterState
│   │   ├── sorting: SortState
│   │   ├── pagination: PaginationState
│   │   └── totalCount: number
│   │
│   ├── detail
│   │   ├── currentProject: Project | null
│   │   ├── loading: boolean
│   │   ├── error: string | null
│   │   ├── expandedSections: string[] (Section IDs)
│   │   └── lastUpdated: timestamp
│   │
│   ├── edit
│   │   ├── formValues: FormData
│   │   ├── initialValues: FormData (for dirty detection)
│   │   ├── isDirty: boolean
│   │   ├── validationErrors: Record<string, string>
│   │   ├── isSubmitting: boolean
│   │   ├── submitError: string | null
│   │   └── savedDraft: FormData (from local storage)
│   │
│   └── ui
│       ├── selectedProjectIds: string[] (for bulk actions)
│       ├── showDeleteModal: boolean
│       ├── showExportModal: boolean
│       ├── activeSection: string | null (detail page)
│       └── sidebarCollapsed: boolean
│
└── expenses (from Expense module)
    └── projectExpenses: Record<projectId, Expense[]>
```

### Slice Definitions

**projectSlice.js**

```typescript
interface ProjectState {
  list: {
    data: Project[]
    loading: boolean
    error: string | null
    filters: {
      status: string[]
      funder: string[]
      overheadModel: string[]
      dateRange: [Date, Date]
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
    currentProject: Project | null
    loading: boolean
    error: string | null
    expandedSections: string[]
    lastUpdated: number
  }
  edit: {
    formValues: Partial<Project>
    initialValues: Partial<Project>
    isDirty: boolean
    validationErrors: Record<string, string>
    isSubmitting: boolean
    submitError: string | null
    savedDraft: Partial<Project>
  }
  ui: {
    selectedProjectIds: string[]
    showDeleteModal: boolean
    showExportModal: boolean
    activeSection: string | null
    sidebarCollapsed: boolean
  }
}
```

### Reducer Actions

**List Slice Actions:**
- `fetchProjectsRequest()` - Start loading
- `fetchProjectsSuccess(projects, totalCount)` - Update with data
- `fetchProjectsError(error)` - Set error
- `setFilter(filterType, values)` - Update filter
- `clearFilters()` - Reset all filters
- `setSort(field, direction)` - Update sort
- `setPage(page)` - Change page
- `setPageSize(pageSize)` - Change page size

**Detail Slice Actions:**
- `fetchProjectDetailRequest()` - Start loading
- `fetchProjectDetailSuccess(project)` - Update with data
- `fetchProjectDetailError(error)` - Set error
- `toggleSection(sectionId)` - Expand/collapse section

**Edit Slice Actions:**
- `setFormValue(field, value)` - Update form field
- `setFormValues(values)` - Bulk update form
- `loadSavedDraft()` - Load draft from local storage
- `clearSavedDraft()` - Clear draft
- `markDirty()` - Set isDirty = true
- `setValidationErrors(errors)` - Update validation errors
- `submitFormRequest()` - Start submission
- `submitFormSuccess()` - Success submission
- `submitFormError(error)` - Submission error
- `resetForm()` - Clear form to initial state

**UI Slice Actions:**
- `toggleProjectSelection(projectId)` - Toggle bulk selection
- `clearProjectSelection()` - Clear all selections
- `openDeleteModal()` - Show delete confirmation
- `closeDeleteModal()` - Hide delete modal
- `openExportModal()` - Show export options
- `closeExportModal()` - Hide export modal
- `setActiveSection(sectionId)` - Set active section
- `toggleSidebarCollapsed()` - Collapse/expand sidebar

### RTK Query API Slice

```typescript
interface ProjectAPI {
  // Queries
  getProjects(params: QueryParams): Project[]
  getProjectDetail(projectId: string): Project
  
  // Mutations
  createProject(data: CreateProjectData): Project
  updateProject(data: UpdateProjectData): Project
  deleteProject(projectId: string): void
  
  // Related
  getProjectExpenses(projectId: string): Expense[]
  getProjectAnalytics(projectId: string): Analytics
}

// Endpoints configuration
const projectAPI = createApi({
  reducerPath: 'projectAPI',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/v1',
    prepareHeaders: (headers, { getState }) => {
      // Add auth token
      return headers
    }
  }),
  endpoints: (builder) => ({
    // Query endpoints (GET)
    getProjects: builder.query({
      query: (params) => ({
        url: '/projects',
        params: {
          division: params.division,
          page: params.page,
          pageSize: params.pageSize,
          filters: params.filters,
          sort: params.sort,
          search: params.search
        }
      }),
      serializeQueryArgs: ({ queryArgs }) => ({
        division: queryArgs.division
      }),
      merge: (currentCacheData, responseData) => {
        currentCacheData.items.push(...responseData.items)
      },
      keepUnusedDataFor: 60
    }),
    
    getProjectDetail: builder.query({
      query: (projectId) => `/projects/${projectId}`,
      providesTags: (result) => [
        { type: 'Project', id: result?.id }
      ]
    }),
    
    // Mutation endpoints (POST, PUT, DELETE)
    createProject: builder.mutation({
      query: (data) => ({
        url: '/projects',
        method: 'POST',
        body: data
      }),
      invalidatesTags: ['ProjectList']
    }),
    
    updateProject: builder.mutation({
      query: ({ projectId, ...data }) => ({
        url: `/projects/${projectId}`,
        method: 'PUT',
        body: data
      }),
      invalidatesTags: (result, error, { projectId }) => [
        { type: 'Project', id: projectId }
      ]
    }),
    
    deleteProject: builder.mutation({
      query: (projectId) => ({
        url: `/projects/${projectId}`,
        method: 'DELETE'
      }),
      invalidatesTags: ['ProjectList']
    })
  })
})
```

### Local Storage State

**Persisted State:**
- Sort preference: `projects_sort_{division}`
- Page size preference: `projects_pageSize`
- Filter state: `projects_filters_{division}`
- Form draft: `projects_form_draft_{projectId}`

**Structure:**
```typescript
// projects_sort_csr
{ field: 'name', direction: 'asc' }

// projects_pageSize
25

// projects_filters_csr
{
  status: ['Active', 'Planned'],
  funder: ['Global Foundation'],
  overheadModel: [],
  dateRange: ['2024-01-01', '2024-12-31'],
  searchQuery: 'education'
}

// projects_form_draft_project-123
{
  name: 'Project X',
  budget: 50000,
  startDate: '2024-07-01',
  // ... other fields
}
```

### State Flow Diagram

```
User Action (e.g., filter change)
         ↓
Dispatch Action to Redux Store
         ↓
Reducer Updates State (synchronously)
         ↓
Component Subscribed to State Receives Update
         ↓
Component Re-renders with New Data
         ↓
[If Async Required: RTK Query Mutation/Query]
         ↓
API Call Sent to Backend
         ↓
Response Received
         ↓
RTK Query Cache Updated
         ↓
Component Updates Again with Fresh Data
         ↓
Audit Log Created (Backend)
```

### Hooks for State Access

**Custom Hooks:**

```typescript
// List page hooks
useProjectsList(division, pageNum, pageSize, filters, sort)
  → { projects, loading, error, totalCount }

useProjectFilters(division)
  → { filters, setFilter, clearFilters, applyFilters }

useProjectSort(division)
  → { sortConfig, setSortConfig, toggleSort }

useProjectPagination(division)
  → { page, pageSize, setPage, setPageSize, totalPages }

// Detail page hooks
useProjectDetail(projectId)
  → { project, loading, error, refresh }

useProjectExpenses(projectId)
  → { expenses, loading, error }

useProjectAnalytics(projectId)
  → { analytics, loading, error }

useExpandedSections()
  → { expandedSections, toggleSection, expandAll, collapseAll }

// Edit page hooks
useProjectForm(projectId)
  → { formValues, setFormValue, isDirty, errors, submit, reset }

useFormDraft(projectId)
  → { savedDraft, saveDraft, loadDraft, clearDraft }

useProjectDelete(projectId)
  → { isLoading, error, deleteProject, confirmDelete }

useProjectExport()
  → { isLoading, exportToCSV, exportToPDF }

// Bulk action hooks
useProjectBulkSelection()
  → { selectedIds, toggleSelection, selectAll, clearSelection, deleteSelected, exportSelected }
```

---

## Data Models

### Core Data Models

#### Project Model

```typescript
interface Project {
  // Identity
  id: UUID
  projectId: string (e.g., "CS-2024-001")
  
  // Basic Info
  name: string
  description: string
  type: 'CSR' | 'LSGB'
  status: 'Planned' | 'Active' | 'OnHold' | 'Completed' | 'Closed'
  
  // Organization
  funder: string
  location: string
  responsibleStaffId: UUID
  responsibleStaffName: string
  
  // Financial
  totalBudget: number (decimal)
  overheadModel: 'Fixed' | 'Percentage'
  overheadAmount: number | null (for Fixed model)
  overheadRate: number | null (for Percentage model, 0-100)
  estimatedOverhead: number (calculated)
  contingencyAmount: number (optional)
  
  // Timeline
  startDate: Date
  endDate: Date
  durationDays: number (calculated)
  
  // Calculated Fields
  totalSpent: number (calculated from expenses)
  remainingBudget: number (calculated)
  projectedFinalCost: number (estimated based on current burn rate)
  budgetUtilization: number (%)
  budgetHealth: 'Good' | 'At Risk' | 'Over Budget'
  
  // Metadata
  createdBy: UUID
  createdAt: DateTime
  updatedBy: UUID
  updatedAt: DateTime
  isDeleted: boolean (soft delete)
}
```

#### ExpenseCategory Model

```typescript
interface ExpenseCategory {
  id: UUID
  projectId: UUID
  name: string
  predictedAmount: number
  overheadApplied: boolean
  overhead: number (calculated based on model)
  
  // Derived from actual expenses
  actualAmount: number (sum of expenses in category)
  variance: number (predicted - actual)
  variancePercent: number
  
  createdAt: DateTime
}
```

#### Milestone Model

```typescript
interface Milestone {
  id: UUID
  projectId: UUID
  name: string
  targetDate: Date
  expectedCost: number (optional)
  status: 'NotStarted' | 'InProgress' | 'Completed'
  
  createdAt: DateTime
}
```

#### ProjectAnalytics Model

```typescript
interface ProjectAnalytics {
  projectId: UUID
  
  // Budget summary
  totalBudget: number
  totalSpent: number
  budgetUtilization: number (%)
  remainingBudget: number
  
  // Expense breakdown
  expensesByCategory: Record<string, number> (category → amount)
  expensesByMonth: Record<string, number> (month → amount)
  
  // Variance
  variance: number (predicted - actual, total)
  variancePercent: number
  varianceByCategory: Record<string, number>
  
  // Projections
  projectedFinalCost: number
  projectedBudgetHealth: 'Good' | 'At Risk' | 'Over Budget'
  burnRate: number ($/day)
  daysUntilBudgetExhausted: number
  
  // Status
  daysRemaining: number
  projectProgress: number (%) (based on timeline)
  costPerformanceIndex: number (earned value / actual cost)
  
  updatedAt: DateTime
}
```

---

## API Integration

### API Endpoints

```
Backend Base URL: /api/v1

Projects Endpoints:
├── GET    /projects                       ← List all projects (paginated)
├── GET    /projects/csr                   ← List CSR projects
├── GET    /projects/lsgb                  ← List LSGB projects
├── GET    /projects/:id                   ← Get project detail
├── POST   /projects                       ← Create new project
├── PUT    /projects/:id                   ← Update project
├── DELETE /projects/:id                   ← Delete project (soft delete)
│
├── GET    /projects/:id/expenses          ← Get project expenses
├── GET    /projects/:id/categories        ← Get expense categories
├── GET    /projects/:id/milestones        ← Get milestones
├── GET    /projects/:id/analytics         ← Get analytics data
├── GET    /projects/:id/audit-log         ← Get audit trail
│
└── POST   /projects/:id/export            ← Export project data

Query Parameters:
├── page: number (default: 1)
├── pageSize: number (default: 10, max: 100)
├── division: 'csr' | 'lsgb'
├── status: string[] (filter)
├── funder: string[] (filter)
├── overheadModel: string[] (filter)
├── startDate: string (filter)
├── endDate: string (filter)
├── search: string (search query)
├── sort: string (field:asc or field:desc)
└── include: string[] (related data to include)
```

### Request/Response Examples

**List Request:**
```
GET /api/v1/projects?division=csr&page=1&pageSize=10&status=Active&sort=name:asc

Query Params:
  division: 'csr'
  page: 1
  pageSize: 10
  status: ['Active']
  sort: 'name:asc'
```

**List Response:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "projectId": "CS-2024-001",
      "name": "Education Initiative",
      "type": "CSR",
      "status": "Active",
      "funder": "Global Foundation",
      "location": "New York, USA",
      "projectValue": 250000,
      "overheadModel": "Fixed",
      "overhead": 37500,
      "startDate": "2024-01-15",
      "endDate": "2024-12-31",
      "responsibleStaff": "John Smith",
      "totalSpent": 125000,
      "budgetUtilization": 50
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalCount": 12,
    "totalPages": 2
  },
  "meta": {
    "timestamp": "2024-06-11T10:30:00Z",
    "requestId": "req-12345"
  }
}
```

**Detail Request:**
```
GET /api/v1/projects/550e8400-e29b-41d4-a716-446655440000?include=expenses,analytics,audit
```

**Detail Response:**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "projectId": "CS-2024-001",
    "name": "Education Initiative",
    "description": "Building schools in rural areas",
    "type": "CSR",
    "status": "Active",
    "funder": "Global Foundation",
    "location": "New York, USA",
    "projectValue": 250000,
    "overheadModel": "Fixed",
    "overhead": 37500,
    "startDate": "2024-01-15T00:00:00Z",
    "endDate": "2024-12-31T23:59:59Z",
    "durationDays": 351,
    "responsibleStaffId": "staff-123",
    "responsibleStaffName": "John Smith",
    "totalBudget": 250000,
    "totalSpent": 125000,
    "remainingBudget": 125000,
    "budgetUtilization": 50,
    "budgetHealth": "Good",
    "projectedFinalCost": 145000,
    "createdAt": "2024-01-10T08:00:00Z",
    "createdBy": "admin-001",
    "updatedAt": "2024-06-11T10:00:00Z",
    "updatedBy": "manager-002",
    
    // Included relations
    "expenses": [...],
    "categories": [...],
    "milestones": [...],
    "analytics": {...},
    "auditLog": [...]
  },
  "meta": {...}
}
```

**Create Request:**
```json
POST /api/v1/projects

{
  "name": "New Education Program",
  "description": "Build training center",
  "type": "CSR",
  "funder": "Global Foundation",
  "location": "Mumbai, India",
  "responsibleStaffId": "staff-123",
  "totalBudget": 300000,
  "overheadModel": "Percentage",
  "overheadRate": 15,
  "startDate": "2024-07-01",
  "endDate": "2025-06-30",
  "status": "Planned",
  "categories": [
    {
      "name": "Staff Costs",
      "predictedAmount": 100000,
      "overheadApplied": true
    },
    {
      "name": "Equipment",
      "predictedAmount": 120000,
      "overheadApplied": false
    }
  ],
  "milestones": [
    {
      "name": "Phase 1 Complete",
      "targetDate": "2024-10-01",
      "expectedCost": 75000
    }
  ]
}
```

**Update Request:**
```json
PUT /api/v1/projects/550e8400-e29b-41d4-a716-446655440000

{
  "name": "Education Initiative (Updated)",
  "status": "OnHold",
  "totalBudget": 280000,
  "categories": [
    {
      "id": "cat-1",
      "name": "Staff Costs",
      "predictedAmount": 110000,
      "overheadApplied": true
    }
  ],
  "auditReason": "Budget adjustment due to delay"
}
```

---

## Audit Logging

### Audit Events

**Events Triggered:**

| Event | Trigger | Audit Fields |
|-------|---------|--------------|
| PROJECT_CREATED | New project created | Project data, user, timestamp |
| PROJECT_UPDATED | Project edited | Changed fields, old/new values, user, reason |
| PROJECT_DELETED | Project deleted (soft) | Project ID, user, timestamp |
| PROJECT_RESTORED | Project undeleted | Project ID, user, timestamp |
| CATEGORY_ADDED | Expense category added | Category data, user |
| CATEGORY_UPDATED | Category budget changed | Field name, old/new values, user |
| CATEGORY_REMOVED | Category removed | Category data, user |
| PROJECT_STATUS_CHANGED | Status updated | Old status, new status, user, reason |
| PROJECT_BUDGET_CHANGED | Budget amount changed | Old budget, new budget, user, reason |
| MILESTONE_ADDED | Milestone created | Milestone data, user |
| MILESTONE_UPDATED | Milestone changed | Changed fields, old/new values, user |
| MILESTONE_REMOVED | Milestone deleted | Milestone data, user |

### Audit Log Fields

```typescript
interface AuditLog {
  id: UUID
  projectId: UUID
  
  // Event details
  eventType: string (e.g., 'PROJECT_UPDATED')
  entityType: 'Project' | 'Category' | 'Milestone'
  entityId: UUID
  
  // Change tracking
  changesBefore: Record<string, any> (old values)
  changesAfter: Record<string, any> (new values)
  changedFields: string[] (list of modified fields)
  
  // User & context
  userId: UUID
  userName: string
  userRole: string
  userDepartment: string
  
  // Request info
  ipAddress: string
  userAgent: string
  reason?: string (optional explanation)
  
  // Metadata
  timestamp: DateTime
  requestId: string (correlation ID)
  
  // Status
  status: 'Success' | 'Partial' | 'Failed'
  failureReason?: string
}
```

### Audit Log Creation

**Timing:**
- Created AFTER successful API call (transaction)
- Includes final state of data
- Atomic with the change (same transaction)

**Content:**
- Before snapshot: Previous field values
- After snapshot: New field values
- User context: Who made the change, from where
- Reason: Why the change was made (optional but recommended)

**Retention:**
- Immutable: Cannot be updated or deleted
- 7-year retention policy (per compliance)
- Queryable: By project, user, date range, event type

### Audit Trail View

**On Project Detail Page:**
- "Audit Log" button opens side panel
- Shows all changes to this project chronologically
- Filterable by event type, user, date range
- Exportable to CSV/PDF

---

## User Interactions & Workflows

### Workflow 1: View CSR Projects List

```
User navigates to /projects/csr
↓
Page loads, shows list of all CSR projects
↓
User can:
├─ Sort by clicking column headers
├─ Filter by status, funder, date range
├─ Search by project name/ID
├─ Change page/page size
└─ Click project row to view detail
```

### Workflow 2: Create New Project

```
User clicks "+ New Project" button
↓
Redirected to /projects/csr/new (or /projects/lsgb/new)
↓
Form displays with empty fields
↓
User fills in General Info, Financial Details, Timeline sections
↓
Form validates in real-time
↓
User clicks "Create Project" button
↓
Request sent to API
↓
✅ Success: Redirect to project detail, show success toast
   Audit log created: PROJECT_CREATED
   
❌ Error: Show error message, keep form data (not cleared)
   Allow retry
```

### Workflow 3: Edit Project

```
User opens project detail page
↓
User clicks "Edit" button
↓
Navigated to /projects/:id/edit
↓
Form pre-populated with current project data
↓
User makes changes to fields
↓
Form tracks changes (isDirty flag)
↓
Auto-save to local storage every 5 seconds
↓
User clicks "Save Changes" button
↓
Form validates
↓
Request sent to API with changes
↓
✅ Success: Redirect to detail page, show success toast
   Audit log created: PROJECT_UPDATED with before/after values
   
❌ Error: Show error, keep form open with changes
   Allow retry
```

### Workflow 4: View Project Analytics

```
User opens project detail page
↓
Page auto-loads all 6 sections:
├─ Project Overview (loaded immediately)
├─ Predicted Expense Distribution (loaded)
├─ Actual Expenses (loaded)
├─ Expense Analysis (calculated)
├─ Charts (rendered from data)
└─ Summary (compiled)
↓
User can interact with charts
├─ Hover for tooltips
├─ Click pie chart segments to filter table
└─ Click line chart points for month detail
↓
User can expand/collapse sections (preference saved)
```

### Workflow 5: Export Project Data

```
User on project detail or list page
↓
User clicks "Export" button
↓
Modal shows export options:
├─ Format: CSV, PDF, Excel
├─ Content: All data, selected sections, custom
└─ Include: Expenses, Analytics, Audit Log
↓
User selects options
↓
User clicks "Export"
↓
File generated and downloaded to device
↓
Audit log created: PROJECT_EXPORTED
```

### Workflow 6: Bulk Delete Projects (Admin)

```
Admin on projects list page
↓
Admin clicks checkboxes to select projects
↓
Admin selects "Delete" from bulk actions menu
↓
Confirmation modal appears
↓
Admin confirms deletion
↓
Request sent to API
↓
✅ Success: Projects marked as deleted (soft delete)
   List refreshed, selection cleared
   Toast shows: "3 projects deleted"
   Audit log created for each: PROJECT_DELETED
```

---

## Error Handling

### Error Scenarios

#### 1. Project Not Found (404)

**Trigger:** User navigates to /projects/:id for non-existent project

**Handling:**
```
Attempt to fetch project detail
↓
API returns 404 error
↓
Catch error in component
↓
Display error page: "Project not found"
Show breadcrumb navigation back to list
Offer "Back to Projects" button
```

#### 2. Unauthorized Access (403)

**Trigger:** User without permission tries to edit/delete

**Handling:**
```
User clicks Edit button
↓
Permission check on API
↓
API returns 403 Forbidden
↓
Display error: "You don't have permission to edit this project"
Show "Back" button
```

#### 3. Network Error

**Trigger:** Network failure during data fetch

**Handling:**
```
API request fails
↓
Retry mechanism activates (3 retries max)
↓
If retry fails: Show error toast
"Unable to load data. Check your connection."
Offer "Retry" button
Fallback: Show cached data if available
```

#### 4. Form Validation Error

**Trigger:** User submits invalid form data

**Handling:**
```
User clicks Save/Create button
↓
Client-side validation runs
↓
If error: Show inline field errors
Highlight invalid fields in red
Show error message below field
Prevent submission
↓
User corrects fields
↓
Resubmit
```

#### 5. Server Validation Error

**Trigger:** Data passes client validation but fails server validation

**Handling:**
```
Form submitted to API
↓
Server validation fails
↓
API returns 422 Unprocessable Entity with field errors
↓
Map errors to form fields
Show field errors inline
Also show summary error: "Please fix the errors below"
Keep form open, data intact
Allow retry
```

#### 6. Optimistic Update Rollback

**Trigger:** Optimistic update fails due to server error

**Handling:**
```
User makes change
↓
UI updates optimistically
↓
Request sent to API
↓
API request fails
↓
UI rolls back to previous state
↓
Error toast shown: "Failed to save. Please try again"
"Undo" option in toast (if applicable)
```

### Error UI Components

**Error Toast (top-right corner):**
```
┌─────────────────────────────────────┐
│ ✗ Error: Failed to load projects    │
│                          [✓] [✕]    │
└─────────────────────────────────────┘
```

**Inline Field Error:**
```
[ Project Name ]
[input field]
✗ Project name is required
```

**Full Page Error:**
```
┌─────────────────────────────────────┐
│                                     │
│  ⚠️  Something went wrong           │
│                                     │
│  We couldn't load the project.      │
│  Error: [error details]             │
│                                     │
│  [← Back] [🔄 Retry]                │
│                                     │
└─────────────────────────────────────┘
```

---

## Performance Considerations

### Optimization Strategies

**1. Pagination**
- Load only 10 items by default
- User can change to 25, 50, or 100
- Server-side filtering/sorting
- Prevents loading 1000+ items at once

**2. Lazy Loading**
- Project detail sections load sequentially
- Critical sections first (Overview, Expenses)
- Less critical sections load in background (Charts)
- User sees content as it loads

**3. Caching**
- RTK Query caches project data for 5 minutes
- Manual refresh available
- List cache invalidated on edit/delete
- Detail cache invalidated on update

**4. Data Normalization**
- Project data normalized in Redux
- Expense data stored separately
- Cross-reference via IDs
- Avoid data duplication

**5. Component Memoization**
- Memoize table rows (prevent re-render on parent change)
- Memoize chart components
- Memoize filter/sort controls

**6. Image Optimization**
- Funder logos lazy-loaded
- Staff avatars cached
- Responsive image sizes

**7. Virtual Scrolling (Future)**
- For list pages with 100+ items
- Render only visible rows
- Significantly improves performance

### Performance Metrics

**Target Metrics:**
- List page load: < 2 seconds
- Detail page load: < 3 seconds
- Search/filter response: < 500ms
- Chart render: < 1 second
- Form submission: < 2 seconds

**Monitoring:**
- Client-side performance tracking (Web Vitals)
- API response time tracking
- Error rate monitoring
- User interaction tracking

---

## Implementation Checklist

### Phase 1: Core Structure (Week 1-2)

**Backend:**
- [ ] Define Project data model (schema migration)
- [ ] Define ExpenseCategory model
- [ ] Define Milestone model
- [ ] Define ProjectAnalytics model
- [ ] Create audit log table/triggers
- [ ] Implement project CRUD API endpoints
- [ ] Implement list endpoints with filtering/sorting
- [ ] Implement role-based access control
- [ ] Write API documentation

**Frontend:**
- [ ] Create projects folder structure
- [ ] Create route configuration
- [ ] Setup Redux store and slices
- [ ] Create RTK Query API definition
- [ ] Create base page components
- [ ] Setup TypeScript types

### Phase 2: List Page (Week 2-3)

**Components:**
- [ ] ProjectsListPage component
- [ ] ProjectListTable component
- [ ] ProjectListFilters component
- [ ] ProjectListPagination component
- [ ] ProjectListActions component (admin)
- [ ] StatusBadge, ProjectTypeB badge components

**Features:**
- [ ] Fetch and display projects
- [ ] Implement sorting
- [ ] Implement filtering
- [ ] Implement pagination
- [ ] Implement search
- [ ] Implement bulk selection (admin)
- [ ] Add row actions (click to detail)
- [ ] Add responsive styling

**Testing:**
- [ ] Unit tests for components
- [ ] Integration tests for filtering/sorting
- [ ] E2E tests for list page

### Phase 3: Detail Page (Week 3-4)

**Components:**
- [ ] ProjectDetailPage component
- [ ] ProjectDetailHeader component
- [ ] ProjectOverviewSection component
- [ ] PredictedExpenseSection component (table + chart)
- [ ] ActualExpensesSection component (table)
- [ ] ExpenseAnalysisSection component (table + text)
- [ ] ChartsVisualizationSection component (4 charts)
- [ ] SummarySection component (cards + text)
- [ ] Chart components (Bar, Line, Pie)

**Features:**
- [ ] Fetch project detail
- [ ] Display all 6 sections
- [ ] Render charts with data
- [ ] Implement chart interactions
- [ ] Implement section expand/collapse
- [ ] Add edit/delete buttons
- [ ] Add export functionality
- [ ] Show audit log link

**Testing:**
- [ ] Unit tests for each section
- [ ] Chart rendering tests
- [ ] Data transformation tests
- [ ] E2E tests for detail page

### Phase 4: Create & Edit (Week 4-5)

**Components:**
- [ ] ProjectCreatePage component
- [ ] ProjectEditPage component
- [ ] ProjectFormWrapper component
- [ ] GeneralInformationForm component
- [ ] FinancialDetailsForm component
- [ ] TimelineForm component
- [ ] ExpenseCategoryInput component (reusable)
- [ ] MilestoneInput component (reusable)
- [ ] Form validation components

**Features:**
- [ ] Form field rendering and binding
- [ ] Real-time validation
- [ ] Dynamic field lists (categories, milestones)
- [ ] Auto-save to local storage
- [ ] Dirty state detection
- [ ] Submit handling with loading state
- [ ] Error display and retry
- [ ] Unsaved changes warning

**Audit Logging:**
- [ ] Create audit log entry on project creation
- [ ] Create audit log entry on project update
- [ ] Track all field changes (before/after)
- [ ] Include user context and reason

**Testing:**
- [ ] Form validation tests
- [ ] Submission tests
- [ ] Audit log tests
- [ ] E2E tests for create/edit workflows

### Phase 5: Integration & Polish (Week 5-6)

**Integration:**
- [ ] Connect to Expense module (link expenses)
- [ ] Connect to Staff module (staff selection)
- [ ] Implement role-based menu hiding
- [ ] Add breadcrumb navigation
- [ ] Add page titles/meta tags

**Performance:**
- [ ] Implement caching strategy
- [ ] Add loading states/skeletons
- [ ] Optimize re-renders
- [ ] Test pagination with large datasets

**UX/Polish:**
- [ ] Add success/error toasts
- [ ] Add confirmation dialogs
- [ ] Add empty states
- [ ] Add loading indicators
- [ ] Responsive design for mobile
- [ ] Accessibility review (ARIA labels, keyboard nav)
- [ ] Dark mode support

**Documentation:**
- [ ] Component documentation
- [ ] API documentation
- [ ] User guide for projects module
- [ ] Developer guide for extending

**Testing:**
- [ ] Full E2E test suite
- [ ] Performance tests
- [ ] Accessibility tests
- [ ] Security tests (authorization)

---

## Summary

### Key Design Decisions

✅ **Two project types:** CSR and LSGB (separate list pages, unified detail view)  
✅ **Audit-first:** All edits create immutable audit logs with before/after values  
✅ **Role-based access:** View-only for employees, edit for managers/admins  
✅ **Six-section detail:** Overview, Budget Breakdown, Actual, Analysis, Charts, Summary  
✅ **Real-time calculations:** Budget health, variance, projections auto-calculated  
✅ **Interactive charts:** Click to filter, hover for details  
✅ **Draft auto-save:** Form data auto-saved to local storage, prevents loss  
✅ **Pagination:** Efficient data loading, default 10 items per page  

### Architecture Highlights

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **State Management** | Redux Toolkit + RTK Query | Centralized state, API caching |
| **Data Flow** | Flux pattern | Unidirectional, predictable |
| **Form Handling** | React Hook Form + Zod | Type-safe validation |
| **Charts** | Recharts/Chart.js | Data visualization |
| **Audit Logging** | Database triggers | Immutable, real-time |
| **Caching** | RTK Query + Local Storage | Performance optimization |

---

**Document Status:** Approved for Development  
**Next Step:** Begin Phase 1 implementation (backend models + API)  
**Timeline:** 5-6 weeks for complete module  
**Dependencies:** Staff module (for staff selection), Expense module (for expense linking)
