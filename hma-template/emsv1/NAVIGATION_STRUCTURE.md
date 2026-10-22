# HMA EMS - Final Navigation Structure Design

**Date:** June 11, 2026  
**Version:** 1.0  
**Status:** Approved Navigation Architecture  
**Audience:** Development Team, Product Stakeholders

---

## Table of Contents

1. [Navigation Overview](#navigation-overview)
2. [Sidebar Structure](#sidebar-structure)
3. [Menu Hierarchy](#menu-hierarchy)
4. [Page Hierarchy & Routes](#page-hierarchy--routes)
5. [Breadcrumb Structure](#breadcrumb-structure)
6. [URL Patterns](#url-patterns)
7. [Role-Based Menu Visibility](#role-based-menu-visibility)
8. [Mobile Navigation](#mobile-navigation)
9. [Navigation Behavior](#navigation-behavior)
10. [Implementation Guide](#implementation-guide)

---

## Navigation Overview

### Navigation Principles

1. **User-Centric:** Menu reflects user workflows, not system components
2. **Role-Based:** Menu items hidden/shown per user role
3. **Consistent:** Same structure across all pages
4. **Discoverable:** All features accessible within 2-3 clicks
5. **Persistent:** Sidebar present on all authenticated pages (except modals)
6. **Accessible:** Keyboard navigation, screen reader friendly

### Navigation Rules

- **Main menu items:** Match major business modules
- **Submenu items:** Related features within a module
- **Max nesting:** 2 levels (module → feature, no deeper)
- **Icon usage:** Each main item has an icon, submenu items no icons
- **Badges:** Show counts/status (pending approvals, unread announcements)
- **Hover states:** Clear indication of clickable items

---

## Sidebar Structure

### Visual Layout

```
┌─────────────────────────────────┐
│  HMA EMS Logo (collapsible)     │ ← Brand area
├─────────────────────────────────┤
│ 🏠 Dashboard                    │ ← Main menu items
│ 📁 Projects                     │    (expandable groups)
│    ├─ CSR Projects             │    (submenu, indented)
│    └─ LSGB Projects            │
│ 👥 Staff & Payroll             │
│ 📅 Attendance                   │
│ 📢 Announcements (3)            │ ← Badge shows count
│ 📊 Reports & Analysis           │
│ 💰 Expense Management (1)       │ ← Badge shows count
│ 👤 Profile                      │
│ ⚙️  Settings (HR/Admin only)    │
│ 🔐 Audit Logs (HR/Admin only)   │
├─────────────────────────────────┤
│ 👤 User Menu (dropdown)         │ ← User profile area
│ 🌙 Theme Toggle                 │
│ 🚪 Logout                       │
└─────────────────────────────────┘
```

### Sidebar Sections

**Section 1: Branding Area**
- Logo (full or icon based on sidebar state)
- Close button (mobile only)

**Section 2: Main Navigation**
- Dashboard (always visible)
- 9 Main modules (role-based visibility)
- Total: 1 + 9 = 10 main items

**Section 3: User Controls**
- User profile dropdown
- Theme switcher
- Logout button

---

## Menu Hierarchy

### Complete Menu Structure

```
├── 🏠 DASHBOARD
│   └── /dashboard
│
├── 📁 PROJECTS
│   ├── CSR Projects
│   │   └── /projects/csr
│   └── LSGB Projects
│       └── /projects/lsgb
│
├── 👥 STAFF & PAYROLL
│   ├── Staff Directory
│   │   └── /staff
│   ├── My Compensation
│   │   └── /staff/compensation
│   ├── Payroll
│   │   └── /payroll
│   └── Salary Slips
│       └── /payroll/slips
│
├── 📅 ATTENDANCE
│   ├── Check In/Out
│   │   └── /attendance/checkin
│   ├── Leave Requests
│   │   └── /attendance/leave
│   └── Attendance Report
│       └── /attendance/reports
│
├── 📢 ANNOUNCEMENTS
│   └── /announcements
│
├── 📊 REPORTS & ANALYSIS
│   ├── Dashboard
│   │   └── /reports/dashboard
│   ├── Pre-Built Reports
│   │   └── /reports/prebuilt
│   ├── Custom Reports
│   │   └── /reports/custom
│   └── Report Scheduling
│       └── /reports/schedule
│
├── 💰 EXPENSE MANAGEMENT
│   ├── My Expenses
│   │   └── /expenses
│   ├── Approve Expenses (Manager only)
│   │   └── /expenses/approvals
│   └── Expense Report
│       └── /expenses/report
│
├── 👤 PERSONAL PROFILE
│   ├── Profile
│   │   └── /profile
│   ├── Preferences
│   │   └── /profile/preferences
│   └── Security
│       └── /profile/security
│
├── ⚙️ SETTINGS (Admin only)
│   ├── Roles & Permissions
│   │   └── /settings/roles
│   ├── Departments
│   │   └── /settings/departments
│   ├── Designations
│   │   └── /settings/designations
│   └── System Settings
│       └── /settings/system
│
└── 🔐 AUDIT LOGS (HR/Admin only)
    └── /audit
```

### Menu Item Specifications

#### 1. Dashboard
- **Icon:** Home/Dashboard
- **Badge:** None
- **Roles:** All
- **Direct Route:** Yes (no submenu)
- **Route:** `/dashboard`

#### 2. Projects
- **Icon:** Folder/Project
- **Badge:** Optional (active projects count)
- **Roles:** All
- **Submenu:** Yes (2 items)
  - **CSR Projects**
    - Route: `/projects/csr`
    - Roles: All
    - Description: Projects for CSR division
  - **LSGB Projects**
    - Route: `/projects/lsgb`
    - Roles: All
    - Description: Projects for LSGB division

#### 3. Staff & Payroll
- **Icon:** People/Users
- **Badge:** None
- **Roles:** All (but limited access per role)
- **Submenu:** Yes (4 items)
  - **Staff Directory**
    - Route: `/staff`
    - Roles: All (limited to own team for managers)
    - Shows: Employee list, profiles, designations
  - **My Compensation**
    - Route: `/staff/compensation`
    - Roles: All
    - Shows: Salary history, compensation details (own only)
  - **Payroll**
    - Route: `/payroll`
    - Roles: HR, Finance
    - Shows: Payroll runs, processing status
  - **Salary Slips**
    - Route: `/payroll/slips`
    - Roles: All
    - Shows: Generated salary slips, download option

#### 4. Attendance
- **Icon:** Calendar/Clock
- **Badge:** Optional (pending leave approvals for managers)
- **Roles:** All
- **Submenu:** Yes (3 items)
  - **Check In/Out**
    - Route: `/attendance/checkin`
    - Roles: All
    - Shows: Check in/out buttons, today's status
  - **Leave Requests**
    - Route: `/attendance/leave`
    - Roles: All
    - Shows: Request form, leave balance, request history
  - **Attendance Report**
    - Route: `/attendance/reports`
    - Roles: Manager, HR, Admin (own attendance for employees)
    - Shows: Attendance data, summaries, filters

#### 5. Announcements
- **Icon:** Bell/Megaphone
- **Badge:** Unread count (red dot)
- **Roles:** All
- **Direct Route:** Yes (no submenu)
- **Route:** `/announcements`
- **Shows:** Feed, filters, mark as read

#### 6. Reports & Analysis
- **Icon:** Chart/Graph
- **Badge:** None
- **Roles:** All (read-only access)
- **Submenu:** Yes (4 items)
  - **Dashboard**
    - Route: `/reports/dashboard`
    - Roles: All
    - Shows: Executive KPI cards
  - **Pre-Built Reports**
    - Route: `/reports/prebuilt`
    - Roles: All
    - Shows: Curated reports (headcount, payroll, attendance, projects, expenses)
  - **Custom Reports**
    - Route: `/reports/custom`
    - Roles: Finance, HR, Admin
    - Shows: Report builder, saved custom reports
  - **Report Scheduling**
    - Route: `/reports/schedule`
    - Roles: Finance, HR, Admin
    - Shows: Auto-generated report schedules, email recipients

#### 7. Expense Management
- **Icon:** Credit Card/Receipt
- **Badge:** Pending count (for approvers)
- **Roles:** All
- **Submenu:** Yes (3 items)
  - **My Expenses**
    - Route: `/expenses`
    - Roles: All
    - Shows: Expense claim form, submission history, statuses
  - **Approve Expenses**
    - Route: `/expenses/approvals`
    - Roles: Manager, Finance
    - Shows: Pending expense claims, approval workflow
  - **Expense Report**
    - Route: `/expenses/report`
    - Roles: Finance, Admin
    - Shows: Aggregated expense data, trends, insights

#### 8. Personal Profile
- **Icon:** User
- **Badge:** None
- **Roles:** All
- **Submenu:** Yes (3 items)
  - **Profile**
    - Route: `/profile`
    - Roles: All
    - Shows: Personal info, contact details, emergency contacts
  - **Preferences**
    - Route: `/profile/preferences`
    - Roles: All
    - Shows: Notification settings, language, theme, timezone
  - **Security**
    - Route: `/profile/security`
    - Roles: All
    - Shows: Password management (if applicable), logout all sessions, OAuth login history

#### 9. Settings (Admin/HR only)
- **Icon:** Gear/Cog
- **Badge:** None
- **Roles:** Admin, HR
- **Submenu:** Yes (4 items)
  - **Roles & Permissions**
    - Route: `/settings/roles`
    - Roles: Admin only
    - Shows: Role definitions, permission matrix, custom roles
  - **Departments**
    - Route: `/settings/departments`
    - Roles: Admin, HR
    - Shows: Department list, hierarchy, managers
  - **Designations**
    - Route: `/settings/designations`
    - Roles: Admin, HR
    - Shows: Job titles, levels, salary bands
  - **System Settings**
    - Route: `/settings/system`
    - Roles: Admin only
    - Shows: Config options, feature flags, API keys

#### 10. Audit Logs (HR/Admin only)
- **Icon:** Shield/Log
- **Badge:** None
- **Roles:** HR, Admin
- **Direct Route:** Yes (no submenu)
- **Route:** `/audit`
- **Shows:** Audit trail, filters (entity type, user, action, date), export

---

## Page Hierarchy & Routes

### Route Tree Organization

```
/                                    ← Root (redirect to /dashboard if authenticated)

/auth/                               ← Authentication pages (public)
├── /auth/login                      ← Login page
└── /auth/oauth-callback             ← OAuth callback handler

/dashboard                           ← Dashboard (authenticated)

/projects                            ← Projects module
├── /projects/csr                    ← CSR Projects list
│   ├── /projects/csr/:id           ← Project detail
│   ├── /projects/csr/:id/edit      ← Edit project
│   └── /projects/csr/:id/members   ← Manage team members
├── /projects/lsgb                   ← LSGB Projects list
│   ├── /projects/lsgb/:id          ← Project detail
│   ├── /projects/lsgb/:id/edit     ← Edit project
│   └── /projects/lsgb/:id/members  ← Manage team members
└── /projects/new                    ← Create new project (conditional form)

/staff                               ← Staff module
├── /staff                           ← Directory list
│   └── /staff/:id                  ← Employee detail
├── /staff/compensation              ← Compensation history (own)
│   └── /staff/compensation/:id     ← View employee compensation (admin only)

/payroll                             ← Payroll module
├── /payroll                         ← Payroll runs list
│   └── /payroll/:id                ← Run detail
├── /payroll/slips                   ← Salary slips
│   └── /payroll/slips/:id          ← Individual slip (view/download)

/attendance                          ← Attendance module
├── /attendance/checkin              ← Check in/out page
├── /attendance/leave                ← Leave requests
│   ├── /attendance/leave/new        ← Request form
│   └── /attendance/leave/:id        ← Request detail
├── /attendance/reports              ← Reports

/announcements                       ← Announcements module
├── /announcements                   ← Feed
│   └── /announcements/:id          ← Detail view
├── /announcements/new               ← Create (HR only)
└── /announcements/:id/edit          ← Edit (HR only)

/expenses                            ← Expense module
├── /expenses                        ← Claims list
│   ├── /expenses/new                ← Create claim
│   └── /expenses/:id                ← Claim detail
│       ├── /expenses/:id/edit       ← Edit claim
│       └── /expenses/:id/items      ← Manage items
├── /expenses/approvals              ← Pending approvals (managers/finance)
│   └── /expenses/:id/approve        ← Approval view
└── /expenses/report                 ← Aggregate report

/reports                             ← Reports module
├── /reports/dashboard               ← KPI dashboard
├── /reports/prebuilt                ← Pre-built reports list
│   └── /reports/prebuilt/:id        ← Run specific report
├── /reports/custom                  ← Custom report builder
│   ├── /reports/custom/new          ← Create custom
│   └── /reports/custom/:id          ← View saved custom
└── /reports/schedule                ← Scheduling

/profile                             ← Profile module (user)
├── /profile                         ← Main profile
├── /profile/preferences             ← Settings
└── /profile/security                ← Security

/settings                            ← Admin settings (admin only)
├── /settings/roles                  ← Roles management
├── /settings/departments            ← Department management
├── /settings/designations           ← Designation management
└── /settings/system                 ← System configuration

/audit                               ← Audit logs (HR/Admin only)

/error/404                           ← 404 page
/error/500                           ← 500 page
```

### Page Nesting Patterns

**Pattern 1: List + Detail**
```
/module/list               ← Main list with table/cards
/module/:id               ← Detail view (modal or new page)
/module/:id/edit          ← Edit form
/module/new               ← Create form
```

**Pattern 2: List with Sections**
```
/module                   ← Default section
/module/subsection        ← Alternative section (same module)
```

**Pattern 3: User-Owned Content**
```
/module                   ← Show current user's data only
/module/:id               ← View own detail
/module/:id/edit          ← Edit own
```

**Pattern 4: Manageable Content (Manager/Admin)**
```
/module                   ← Admin view shows all
/module?team=123          ← Manager view shows team filter
/module/:id               ← Detail (may reveal sensitive data)
/module/:id/edit          ← Edit (admin only for sensitive fields)
```

---

## Breadcrumb Structure

### Breadcrumb Rules

1. **Always include "Home"** as first breadcrumb (links to dashboard)
2. **Show current page** as last breadcrumb (not clickable)
3. **Max depth:** 3-4 breadcrumbs (including Home)
4. **Format:** Home / Module / Feature / Item (if applicable)
5. **Dynamics:** Change based on current route and user context

### Breadcrumb Examples by Module

#### Dashboard
```
Home / Dashboard
```

#### Projects - CSR List
```
Home / Projects / CSR Projects
```

#### Projects - CSR Detail
```
Home / Projects / CSR Projects / [Project Name]
```

#### Projects - Create New
```
Home / Projects / Create New Project
```

#### Staff - Directory
```
Home / Staff & Payroll / Staff Directory
```

#### Staff - Employee Detail
```
Home / Staff & Payroll / Staff Directory / [Employee Name]
```

#### Staff - Compensation
```
Home / Staff & Payroll / My Compensation
```

#### Payroll - Runs
```
Home / Staff & Payroll / Payroll
```

#### Payroll - Run Detail
```
Home / Staff & Payroll / Payroll / [Run Month/Year]
```

#### Payroll - Salary Slips
```
Home / Staff & Payroll / Salary Slips
```

#### Payroll - Slip Detail
```
Home / Staff & Payroll / Salary Slips / [Employee Name] - [Month/Year]
```

#### Attendance - Check In/Out
```
Home / Attendance / Check In/Out
```

#### Attendance - Leave Requests
```
Home / Attendance / Leave Requests
```

#### Attendance - Leave Request Detail
```
Home / Attendance / Leave Requests / [Request ID]
```

#### Attendance - Reports
```
Home / Attendance / Attendance Report
```

#### Announcements - Feed
```
Home / Announcements
```

#### Announcements - Detail
```
Home / Announcements / [Announcement Title]
```

#### Reports - Dashboard
```
Home / Reports & Analysis / Dashboard
```

#### Reports - Pre-Built
```
Home / Reports & Analysis / Pre-Built Reports
```

#### Reports - Pre-Built Specific
```
Home / Reports & Analysis / Pre-Built Reports / [Report Name]
```

#### Reports - Custom Report
```
Home / Reports & Analysis / Custom Reports / [Report Name]
```

#### Expenses - List
```
Home / Expense Management / My Expenses
```

#### Expenses - Detail
```
Home / Expense Management / My Expenses / [Claim ID]
```

#### Expenses - Approvals (Manager)
```
Home / Expense Management / Approve Expenses
```

#### Expenses - Approval Detail (Manager)
```
Home / Expense Management / Approve Expenses / [Claim ID]
```

#### Profile
```
Home / Personal Profile
```

#### Profile - Preferences
```
Home / Personal Profile / Preferences
```

#### Profile - Security
```
Home / Personal Profile / Security
```

#### Settings - Roles
```
Home / Settings / Roles & Permissions
```

#### Audit Logs
```
Home / Audit Logs
```

### Breadcrumb Interaction

- **Clickable items:** All breadcrumbs except the last one
- **Last item:** Not clickable (current page)
- **Separator:** " / " (slash with spaces)
- **Home icon:** Optional (can use icon instead of text)

### Dynamic Content in Breadcrumbs

**Example: Project Detail Page**
```
Breadcrumb structure:
Home / Projects / [Division: CSR or LSGB] / [Project Name]

Data sources:
- "Home" → hardcoded link to /dashboard
- "Projects" → hardcoded, links to /projects
- "[Division]" → derived from current route segment (CSR or LSGB)
- "[Project Name]" → fetched from API, current not clickable
```

**Example: Employee Detail (viewed by HR)**
```
Breadcrumb structure:
Home / Staff & Payroll / [Selected Filter: All/Department] / [Employee Name]

Data sources:
- "Home" → hardcoded
- "Staff & Payroll" → hardcoded, links to /staff
- "[Selected Filter]" → optional, depends on filter applied
- "[Employee Name]" → fetched from API
```

---

## URL Patterns

### Naming Conventions

**Base Module Path:**
```
/module-name                 ← Snake case, plural where possible
```

**Examples:**
```
/dashboard                   ← Singular (dashboard is unique)
/projects                    ← Plural
/staff                       ← Plural (or could be singular, but plural is standard)
/attendance                  ← Singular (abstract concept)
/announcements               ← Plural
/expenses                    ← Plural
/payroll                     ← Singular (abstract concept)
/profile                     ← Singular (user-specific)
/settings                    ← Plural
/audit                       ← Singular
```

### Parameter Patterns

**Resource ID:**
```
/module/:id                  ← UUID or numeric ID
Example: /staff/uuid-12345
```

**Filtering:**
```
/module?filter=value         ← Query parameter
Example: /projects?status=active&division=csr
```

**Nested Sub-Resources:**
```
/module/:id/subresource      ← Related resource
Example: /projects/uuid-123/members
```

### URL Structure Summary

```
Auth Routes (public):
/auth/login
/auth/oauth-callback

App Routes (authenticated):
/dashboard

/projects                         (list all)
/projects/csr                     (CSR project list)
/projects/csr/:id                 (CSR project detail)
/projects/csr/:id/edit            (CSR project edit)
/projects/csr/:id/members         (CSR project members)
/projects/lsgb                    (LSGB project list)
/projects/lsgb/:id                (LSGB project detail)
/projects/new                     (create new project)

/staff                            (staff directory list)
/staff/:id                        (staff detail)
/staff/compensation               (compensation view)
/staff/compensation/:id           (employee compensation detail)

/payroll                          (payroll runs)
/payroll/:id                      (payroll run detail)
/payroll/slips                    (salary slips list)
/payroll/slips/:id                (salary slip detail/download)

/attendance/checkin               (check in/out interface)
/attendance/leave                 (leave requests list)
/attendance/leave/:id             (leave request detail)
/attendance/leave/new             (create leave request)
/attendance/reports               (attendance reports)

/announcements                    (feed)
/announcements/:id                (detail)
/announcements/new                (create)
/announcements/:id/edit           (edit)

/reports/dashboard                (KPI dashboard)
/reports/prebuilt                 (pre-built reports list)
/reports/prebuilt/:id             (run specific pre-built)
/reports/custom                   (custom reports list)
/reports/custom/new               (create custom)
/reports/custom/:id               (view saved custom)
/reports/schedule                 (scheduling)

/expenses                         (my claims list)
/expenses/new                     (create claim)
/expenses/:id                     (claim detail)
/expenses/:id/edit                (claim edit)
/expenses/:id/items               (manage items)
/expenses/approvals               (approval list)
/expenses/approvals?:id           (approval detail)
/expenses/report                  (aggregate report)

/profile                          (personal profile)
/profile/preferences              (preferences)
/profile/security                 (security)

/settings/roles                   (roles & permissions)
/settings/departments             (departments)
/settings/designations            (designations)
/settings/system                  (system settings)

/audit                            (audit log)
/audit?filters                    (with filters)

Error Routes:
/error/404                        (not found)
/error/500                        (server error)
```

---

## Role-Based Menu Visibility

### Role Definitions

**1. Employee (Default)**
- Access: Dashboard, Projects, Staff (limited), Attendance, Announcements, Reports (read-only), Expenses, Profile
- Cannot: Approve expenses/leave, access payroll, modify system settings, view audit logs

**2. Manager**
- Access: All Employee features +
- Additional: Can approve subordinate leave requests, Can approve expense requests up to budget limit
- Cannot: Process payroll, modify system settings, view audit logs

**3. HR**
- Access: All features except Settings/Roles
- Additional: Can approve all leave requests, Can approve all expenses, Can view payroll, Can view audit logs, Can manage staff records
- Cannot: Modify system settings, manage roles/permissions

**4. Finance**
- Access: Dashboard, Staff (read-only), Payroll (full), Reports, Expenses (approve/process), Audit (view)
- Cannot: Approve leave, create announcements, manage system settings

**5. Admin**
- Access: All features including Settings and Audit Logs
- Permissions: Full access to all modules and configurations

### Menu Visibility Matrix

| Menu Item | Employee | Manager | HR | Finance | Admin |
|-----------|----------|---------|----|---------:|-------|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Projects | ✅ | ✅ | ✅ | ❌ | ✅ |
| Staff & Payroll | ✅ (limited) | ✅ (team) | ✅ | ✅ (read-only) | ✅ |
| - Staff Directory | ✅ | ✅ | ✅ | ✅ | ✅ |
| - My Compensation | ✅ | ✅ | ✅ | ✅ | ✅ |
| - Payroll | ❌ | ❌ | ✅ | ✅ | ✅ |
| - Salary Slips | ✅ | ✅ | ✅ | ✅ | ✅ |
| Attendance | ✅ | ✅ | ✅ | ❌ | ✅ |
| Announcements | ✅ | ✅ | ✅ | ❌ | ✅ |
| Reports & Analysis | ✅ | ✅ | ✅ | ✅ | ✅ |
| Expense Management | ✅ | ✅ | ✅ | ✅ | ✅ |
| Personal Profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| Settings | ❌ | ❌ | ❌ | ❌ | ✅ |
| Audit Logs | ❌ | ❌ | ✅ | ❌ | ✅ |

### Feature-Level Access Control

Some features are visible in menu but accessed based on role:

```
Approvals (Expense/Leave):
- Not visible in menu for employees
- Visible as submenu for managers/HR/finance when they have pending items
- Dynamically show/hide based on user's role

Payroll:
- Not visible for employees/managers
- Visible for HR and Finance only

Settings:
- Visible only for Admin

Audit:
- Visible only for HR and Admin
```

---

## Mobile Navigation

### Mobile Sidebar Behavior

**Closed State:**
```
Hamburger icon (≡) at top-left
Logo area collapses to icon only
Sidebar hidden off-screen (left)
```

**Open State (Overlay):**
```
Sidebar slides in from left
Semi-transparent backdrop
Hamburger becomes X (close button)
Full menu visible (same as desktop)
Tapping outside sidebar closes it
```

**Screen Size:** Breakpoint at 768px (tablet size)
- Below 768px: Mobile sidebar (hidden by default, hamburger toggle)
- 768px and above: Desktop sidebar (always visible)

### Mobile Menu Adjustments

**No changes to menu structure:**
- Same items visible
- Same hierarchy
- Same breadcrumbs

**Visual adjustments:**
- Larger touch targets (min 44px height)
- Simplified icons
- Expanded spacing for finger navigation
- Scroll if menu doesn't fit screen height

### Mobile Back Navigation

**In addition to breadcrumbs:**
- Back button in header (< or ← icon)
- Tapping back navigates to previous page in history
- On list pages, back returns to module entry point
- On detail pages, back returns to list

---

## Navigation Behavior

### Menu Interaction Patterns

#### Main Menu Item Click
- **If has submenu:** Expand/collapse submenu (toggle)
- **If direct route:** Navigate to route, close mobile sidebar
- **Visual feedback:** Highlight active item/submenu

#### Submenu Item Click
- **Always:** Navigate to route immediately
- **Mobile:** Close sidebar after navigation
- **Desktop:** Keep sidebar open
- **Visual feedback:** Highlight active submenu item

#### Breadcrumb Click
- **Home:** Navigate to dashboard
- **Module:** Navigate to module main page
- **Feature:** Navigate to feature page
- **Last item:** No action (not clickable)

### Active State Styling

**Active menu item:**
- Background color highlighted
- Icon color or styling changed
- Text color contrasted
- Indicator (left border or dot) shown

**Active submenu:**
- Parent item expanded
- Submenu item highlighted
- Only one active item per level

### Menu Scrolling

**If menu exceeds viewport height:**
- Sidebar becomes scrollable
- User/brand area sticky at top
- User controls sticky at bottom
- Max-height: 100vh minus header and footer area

### Keyboard Navigation

**Tab Order:**
1. Skip to main content link
2. All menu items (top-to-bottom)
3. User controls
4. Page content

**Arrow Keys:**
- Up/Down: Navigate between menu items
- Right: Expand submenu (if collapsed)
- Left: Collapse submenu (if expanded)
- Enter: Activate menu item

**Escape:**
- Close expanded submenu
- Close mobile sidebar

### Direct URL Entry

**User can enter any valid URL directly:**
```
Examples:
- /projects/csr/12345
- /staff/john-doe
- /expenses/approvals
```

**Behavior:**
- Breadcrumbs adjust to show correct path
- Menu highlights correct active items
- If permission denied, show 403 error

---

## Implementation Guide

### Navigation Data Structure

**Menu Configuration (data-driven):**

```typescript
// Navigation item structure
interface NavItem {
  id: string                    // Unique ID
  label: string                 // Display text
  icon: IconType               // Icon component
  path?: string                 // Direct route (if no children)
  children?: NavItem[]          // Submenu items
  requiredRoles?: string[]      // Show only for these roles
  badge?: {                     // Optional badge
    type: 'count' | 'dot'      // Count number or dot indicator
    value: number | boolean    // Value to display
    color?: 'red' | 'orange'   // Optional color
  }
  badge?: () => Promise<number> // Or dynamic fetching function
}

// Navigation tree
const navigationConfig: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: HomeIcon,
    path: '/dashboard',
    requiredRoles: ['*'] // All roles
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: FolderIcon,
    children: [
      {
        id: 'projects-csr',
        label: 'CSR Projects',
        path: '/projects/csr'
      },
      {
        id: 'projects-lsgb',
        label: 'LSGB Projects',
        path: '/projects/lsgb'
      }
    ]
  },
  // ... more items
]
```

### Breadcrumb Generation

**Automatic from route:**

```typescript
// Hook that generates breadcrumbs based on current route
interface Breadcrumb {
  label: string
  path: string
  active: boolean
}

function useBreadcrumbs(location: Location, navigationConfig: NavItem[]): Breadcrumb[] {
  return [
    { label: 'Home', path: '/dashboard', active: false },
    // Derived from URL segments and config
    { label: 'Projects', path: '/projects', active: false },
    { label: 'CSR Projects', path: '/projects/csr', active: false },
    { label: 'Project Name', path: '/projects/csr/123', active: true }
  ]
}
```

### Active Menu Detection

**From React Router useLocation:**

```typescript
// Hook to determine which menu items are active
function useActiveMenu() {
  const location = useLocation()
  
  // Logic to find active item based on current pathname
  // Returns: { activeModule, activeFeature, activeSubfeature }
}
```

### Dynamic Badge Counting

**Real-time updates:**

```typescript
// API hook to fetch badge counts
function useBadgeCounts(role: string) {
  // Fetch counts for:
  // - Unread announcements
  // - Pending expenses to approve
  // - Pending leave to approve (for managers)
  // Update on interval or WebSocket
}
```

### Mobile Sidebar Toggle

**Store sidebar open/close state:**

```typescript
// Redux or Context
interface UIState {
  sidebarOpen: boolean
  sidebarCollapsed: boolean // Narrow/expanded view
}

// Actions
dispatch({ type: 'TOGGLE_SIDEBAR' })
dispatch({ type: 'SET_SIDEBAR_OPEN', payload: boolean })
```

### Permission-Based Rendering

```typescript
// Utility to check if menu item visible
function isMenuItemVisible(item: NavItem, userRoles: string[]): boolean {
  if (!item.requiredRoles) return true
  if (item.requiredRoles.includes('*')) return true
  return item.requiredRoles.some(role => userRoles.includes(role))
}

// Component rendering
navItems
  .filter(item => isMenuItemVisible(item, userRoles))
  .map(item => <NavMenuItem key={item.id} item={item} />)
```

### Submenu Toggle State

```typescript
// Track which submenus are expanded
const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set())

function toggleSubMenu(menuId: string) {
  const newExpanded = new Set(expandedMenus)
  if (newExpanded.has(menuId)) {
    newExpanded.delete(menuId)
  } else {
    newExpanded.add(menuId)
  }
  setExpandedMenus(newExpanded)
}
```

### Route Configuration

```typescript
// Centralized route definition
const routes = [
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { path: 'dashboard', element: <Dashboard /> },
      {
        path: 'projects',
        element: <ProjectsLayout />,
        children: [
          { path: 'csr', element: <CSRProjectsList /> },
          { path: 'csr/:id', element: <CSRProjectDetail /> },
          // ... more project routes
        ]
      },
      // ... more routes
    ]
  }
]
```

---

## Summary

### Navigation Structure Overview

| Component | Details |
|-----------|---------|
| **Sidebar Sections** | Branding, Navigation (10 items + submenus), User Controls |
| **Main Menu Items** | 10 total (Dashboard + 9 modules) |
| **Submenu Items** | Projects (2), Staff & Payroll (4), Attendance (3), Reports (4), Expenses (3), Profile (3), Settings (4) |
| **Total Routes** | ~50+ distinct pages |
| **Breadcrumb Depth** | Max 4 levels (Home / Module / Feature / Item) |
| **Role-Based Menu** | 5 roles with different menu visibility |
| **Mobile Responsive** | Hamburger menu, overlay sidebar, touch-friendly |
| **Keyboard Navigation** | Full keyboard support, tab order, arrow keys |
| **Badges** | Unread counts, pending approvals, status indicators |

### Key Design Decisions

✅ **Two-level nesting only:** Easy to understand, no deep menu diving  
✅ **Direct dashboard access:** Single click from home  
✅ **Role-based visibility:** No unauthorized menu items shown  
✅ **Dynamic breadcrumbs:** Auto-generated from route, always current  
✅ **Consistent patterns:** Same structure for all modules  
✅ **Mobile-first approach:** Works equally well on all screen sizes  
✅ **Accessible:** Keyboard navigation, screen readers, ARIA labels  
✅ **Scalable:** Easy to add new modules, reuse patterns  

---

**Document Status:** Approved for Development  
**Next Step:** Implement navigation config file in codebase  
**Timeline:** Can be implemented before feature modules are built
