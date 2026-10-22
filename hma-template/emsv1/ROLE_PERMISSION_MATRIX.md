# HMA EMS - Role Permission Matrix

**Date:** June 11, 2026  
**Version:** 1.0  
**Status:** Approved Authorization Model  
**Audience:** Development Team, Security Committee, HR Leadership

---

## Table of Contents

1. [Authorization Model Overview](#authorization-model-overview)
2. [Role Definitions](#role-definitions)
3. [View Permissions Matrix](#view-permissions-matrix)
4. [Create Permissions Matrix](#create-permissions-matrix)
5. [Edit Permissions Matrix](#edit-permissions-matrix)
6. [Delete Permissions Matrix](#delete-permissions-matrix)
7. [Approval Permissions Matrix](#approval-permissions-matrix)
8. [Module-Specific Access Rules](#module-specific-access-rules)
9. [Field-Level Permissions](#field-level-permissions)
10. [Permission Dependencies](#permission-dependencies)
11. [Implementation Guide](#implementation-guide)

---

## Authorization Model Overview

### Authorization Principles

1. **Role-Based Access Control (RBAC):** Permissions assigned via roles
2. **Principle of Least Privilege:** Users get minimum permissions needed
3. **Separation of Duties:** Critical functions split between roles (e.g., create/approve)
4. **Immutable Audit Trail:** All permission changes logged
5. **Centralized Policy:** All permissions defined centrally, not in code
6. **Override Protection:** Critical approvals cannot be self-approved

### Authorization Framework

**Authorization Flow:**

```
User Action
    ↓
Check User Role(s)
    ↓
Check Permission for Action + Resource
    ↓
Check Resource Ownership (if applicable)
    ↓
Check Department/Team Membership (if applicable)
    ↓
✅ Grant Access or ❌ Deny Access + Log Event
    ↓
If Access Granted: Execute Action + Create Audit Log
```

### Permission Types

1. **View** - Can read/display information
2. **Create** - Can create new records
3. **Edit** - Can modify existing records
4. **Delete** - Can remove/archive records (soft delete)
5. **Approve** - Can approve workflows (expenses, leave, payroll)

---

## Role Definitions

### 1. CEO (Chief Executive Officer)

**Scope:** Full system access  
**Responsibility:** Strategic oversight, financial health, organizational decisions  
**System Access:** All modules with full permissions  
**Audit Trail:** All CEO actions logged and flagged  

**Key Permissions:**
- View all data across all modules
- Create projects, announcements, reports
- Edit all records (with caution)
- Approve all workflows (expenses, leave, payroll)
- Override any decision
- Export all data

**Restrictions:**
- Cannot unilaterally delete financial records (must review with Finance Head)
- Cannot directly modify individual employee records (must go through HR)
- Cannot directly modify payroll (must go through Finance Head)

### 2. Finance Head

**Scope:** Financial data and payroll management  
**Responsibility:** Budget oversight, payroll processing, expense approvals, financial reporting  
**System Access:** Finance-focused modules with specialized permissions  

**Key Permissions:**
- View all financial data (projects budget, expenses, payroll)
- View all employee compensation details
- Create and process payroll runs
- Approve expense claims above certain threshold
- Generate financial reports
- Download financial data for external systems

**Restrictions:**
- Cannot create or edit employee personal data
- Cannot create projects or announcements (view only)
- Cannot approve leave requests
- Cannot delete payroll records

### 3. HR (Human Resources)

**Scope:** Employee records and organizational management  
**Responsibility:** Staff management, announcements, leave/attendance oversight, HR reporting  
**System Access:** HR-focused modules with specialized permissions  

**Key Permissions:**
- View all employee records and compensation
- Create and edit employee records
- Upload employee documents
- Create and publish announcements
- Approve all leave requests
- Manage attendance exceptions
- Generate HR reports (headcount, turnover, etc.)

**Restrictions:**
- Cannot edit salary components (Finance Head only)
- Cannot approve individual expense claims (approver is manager/finance)
- Cannot delete employee records
- Cannot view financial data beyond high-level

### 4. Project Manager

**Scope:** Project and team management  
**Responsibility:** Project execution, team assignment, budget tracking, team performance  
**System Access:** Project and team-specific permissions  

**Key Permissions:**
- View all projects (own and organization)
- Create and edit own projects
- Edit project details (timeline, team members, budget)
- View team member details
- Approve team member expenses (up to threshold)
- Approve team member leave requests
- View project-specific reports

**Restrictions:**
- Cannot create projects outside their division
- Cannot approve expenses beyond their authority level
- Cannot delete projects
- Cannot edit other managers' projects
- Cannot view confidential financial data

### 5. Employee (Standard Staff)

**Scope:** Personal and assigned work  
**Responsibility:** Task execution, personal time tracking, expense claiming  
**System Access:** Personal and read-only access to relevant data  

**Key Permissions:**
- View own profile, salary, compensation history
- View own attendance and leave balance
- Create own expense claims
- View assigned projects
- View organizational announcements
- View own project assignments
- Download own salary slips

**Restrictions:**
- Cannot view other employee details
- Cannot edit own record (HR only)
- Cannot approve own expenses/leave
- Cannot create or edit projects
- Cannot access payroll module
- Cannot access settings

---

## View Permissions Matrix

### Dashboard Module

| Role | Dashboard | KPI Cards | Reports | Insights | Own Data |
|------|-----------|-----------|---------|----------|----------|
| **CEO** | ✅ Full | ✅ All data | ✅ All reports | ✅ All | ✅ Yes |
| **Finance Head** | ✅ Financial | ✅ Budget/Cash | ✅ Financial | ✅ Financial | ✅ Yes |
| **HR** | ✅ HR | ✅ Headcount | ✅ HR reports | ✅ HR | ✅ Yes |
| **Project Manager** | ✅ Project | ✅ Project KPIs | ✅ Own projects | ✅ Project | ✅ Yes |
| **Employee** | ✅ Personal | ✅ Personal stats | ❌ No | ❌ No | ✅ Yes |

**Dashboard Widget Access:**
- CEO: All widgets (Financial, HR, Projects, Attendance, Expenses)
- Finance Head: Financial widgets only
- HR: HR & Attendance widgets
- Project Manager: Project & Team widgets
- Employee: Personal stats (own attendance, projects, pending items)

---

### Projects Module

| Role | View List | View CSR | View LSGB | View Detail | View Budget | View Team |
|------|-----------|----------|-----------|-------------|-------------|-----------|
| **CEO** | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All |
| **Finance Head** | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All |
| **HR** | ✅ All | ✅ All | ✅ All | ✅ All | ❌ No | ✅ All |
| **Project Manager** | ✅ Own | ✅ Own CSR | ✅ Own LSGB | ✅ Own | ✅ Own | ✅ Own Team |
| **Employee** | ✅ Assigned | ✅ Assigned | ✅ Assigned | ✅ Assigned | ❌ No | ✅ Team |

**Detailed View Rules:**
- CEO: All projects, all details, all financial info
- Finance Head: All projects, all financial details, team roster
- HR: All projects, team member names, no budget details
- Project Manager: Own projects only (same division), full details for own projects
- Employee: Only projects assigned to them, basic information only

---

### Staff & Payroll Module

| Role | View List | View Detail | View Compensation | View Payroll | View History | View Bank | View Documents |
|------|-----------|-------------|-------------------|--------------|--------------|-----------|-----------------|
| **CEO** | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All (masked) | ✅ All |
| **Finance Head** | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All (masked) | ❌ No |
| **HR** | ✅ All | ✅ All | ✅ All | ❌ Runs only | ✅ All | ✅ All (masked) | ✅ All |
| **Project Manager** | ✅ Own Team | ✅ Own Team | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| **Employee** | ❌ No | ✅ Own | ✅ Own | ❌ No | ✅ Own | ✅ Own (masked) | ✅ Own |

**Compensation View Rules:**
- CEO: Full compensation (salary, deductions, benefits)
- Finance Head: Full compensation for payroll purposes
- HR: Full compensation for records management
- Project Manager: Cannot see compensation
- Employee: Own compensation only, annual/monthly totals

**Payroll View Rules:**
- CEO: View all payroll runs, approve final runs
- Finance Head: View/generate/process payroll, see all employee details
- HR: View payroll run summaries, view completed runs
- Project Manager: Cannot access payroll
- Employee: Cannot access payroll

**Bank Details (Security - Always Masked):**
- Except last 4 digits of account number
- Only CEO, Finance Head, HR, Employee (own) can view
- Full details only in secure backend for transfers

---

### Attendance Module

| Role | View Own | View Team | View All | View Reports | View Leaves | View Exceptions |
|------|----------|-----------|----------|--------------|-------------|-----------------|
| **CEO** | ✅ Yes | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All |
| **Finance Head** | ✅ Yes | ❌ No | ❌ No | ✅ Summary | ❌ No | ❌ No |
| **HR** | ✅ Yes | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All |
| **Project Manager** | ✅ Yes | ✅ Own Team | ❌ No | ✅ Own Team | ✅ Own Team | ✅ Own Team |
| **Employee** | ✅ Yes | ❌ No | ❌ No | ✅ Own | ✅ Own | ❌ No |

**Attendance Rules:**
- CEO: Full view of all attendance data
- Finance Head: Only summary reports for cost allocation
- HR: Full view for all employees, manage exceptions
- Project Manager: View team attendance only
- Employee: View own only

---

### Announcements Module

| Role | View All | View By Department | View Archived | Create | Edit | Delete |
|------|----------|-------------------|---------------|--------|------|--------|
| **CEO** | ✅ All | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Finance Head** | ✅ All | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **HR** | ✅ All | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Project Manager** | ✅ All | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Employee** | ✅ All | ✅ Yes | ✅ Archive Only | ❌ No | ❌ No | ❌ No |

---

### Reports & Analysis Module

| Role | Dashboard | Pre-Built Reports | Custom Reports | Export Data | Schedule Reports |
|------|-----------|-------------------|-----------------|-------------|-----------------|
| **CEO** | ✅ All | ✅ All | ✅ All | ✅ All | ✅ Yes |
| **Finance Head** | ✅ Financial | ✅ Financial | ✅ Financial | ✅ Financial | ✅ Financial |
| **HR** | ✅ HR | ✅ HR | ✅ HR | ✅ HR | ✅ HR |
| **Project Manager** | ✅ Projects | ✅ Project Reports | ✅ Own Projects | ✅ Own Projects | ✅ Own Projects |
| **Employee** | ✅ Own | ❌ No | ❌ No | ❌ No | ❌ No |

**Pre-Built Reports Access:**
- CEO: Financial, HR, Projects, Expenses, Attendance reports
- Finance Head: Budget Analysis, Expense Reports, Payroll Reports, Cash Flow
- HR: Headcount, Turnover, Attendance, Payroll Reports, Compliance
- Project Manager: Project Status, Budget, Timeline, Team Performance
- Employee: Own attendance, own expenses (if applicable)

---

### Expense Management Module

| Role | View Own | View Team | View All | View Approvals | View Reports |
|------|----------|-----------|----------|-----------------|--------------|
| **CEO** | ✅ Yes | ✅ All | ✅ All | ✅ All | ✅ All |
| **Finance Head** | ✅ Yes | ❌ No | ✅ All | ✅ All | ✅ All |
| **HR** | ✅ Yes | ❌ No | ❌ No | ❌ No | ✅ Summary |
| **Project Manager** | ✅ Yes | ✅ Own Team | ❌ No | ✅ Own Team | ✅ Own Team |
| **Employee** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |

---

### Personal Profile Module

| Role | View Own | View Other | View Documents | View Compensation | View Salary Slips |
|------|----------|-----------|-----------------|-------------------|------------------|
| **CEO** | ✅ Yes | ✅ All | ✅ All | ✅ All | ✅ All |
| **Finance Head** | ✅ Yes | ❌ No | ❌ No | ✅ All | ✅ All |
| **HR** | ✅ Yes | ✅ All | ✅ All | ✅ All | ✅ All |
| **Project Manager** | ✅ Yes | ❌ Own Team | ❌ No | ❌ No | ❌ No |
| **Employee** | ✅ Yes | ❌ No | ✅ Own | ✅ Own | ✅ Own |

---

## Create Permissions Matrix

### Dashboard Module

| Role | Create Widget | Create Report |
|------|---------------|---------------|
| **CEO** | ✅ Yes | ✅ Yes |
| **Finance Head** | ❌ No | ✅ Financial |
| **HR** | ❌ No | ✅ HR |
| **Project Manager** | ❌ No | ❌ No |
| **Employee** | ❌ No | ❌ No |

---

### Projects Module

| Role | Create Project | Create CSR | Create LSGB | Add Expense Category | Add Milestone |
|------|----------------|-----------|-----------|---------------------|--------------|
| **CEO** | ✅ Both | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Finance Head** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| **HR** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| **Project Manager** | ✅ Own Div | ✅ Own CSR | ✅ Own LSGB | ✅ Own Projects | ✅ Own Projects |
| **Employee** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |

**Project Creation Rules:**
- CEO: Can create projects in any division
- Finance Head: Cannot create projects
- HR: Cannot create projects
- Project Manager: Can only create projects within their assigned division(s)
- Employee: Cannot create projects

---

### Staff & Payroll Module

| Role | Create Employee | Create Compensation Record | Create Payroll Run | Add Document |
|------|-----------------|---------------------------|-------------------|--------------|
| **CEO** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Finance Head** | ❌ No | ✅ Yes | ✅ Yes | ❌ No |
| **HR** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Project Manager** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Employee** | ❌ No | ❌ No | ❌ No | ✅ Own (limited docs) |

**Employee Creation Rules:**
- CEO: Can create new employee records
- Finance Head: Cannot create employees
- HR: Can create new employee records
- Project Manager: Cannot create employees
- Employee: Cannot create employee records

**Payroll Creation Rules:**
- CEO: Can generate payroll runs
- Finance Head: Can generate payroll runs (primary responsibility)
- HR: Cannot generate payroll (Finance Head responsibility)
- Other: Cannot generate payroll

---

### Attendance Module

| Role | Check In/Out | Create Leave Request | Create Exception | Add Attendance Record |
|------|--------------|----------------------|-------------------|----------------------|
| **CEO** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Finance Head** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **HR** | ✅ Yes | ✅ All | ✅ Yes | ✅ Yes |
| **Project Manager** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Employee** | ✅ Yes | ✅ Own | ❌ No | ❌ No |

**Attendance Rules:**
- CEO: Full control, can create for anyone
- Finance Head: Own check-in/out, own leave requests
- HR: Can manage all attendance, create exceptions
- Project Manager: Own only, can approve team requests
- Employee: Own check-in/out and leave requests only

---

### Announcements Module

| Role | Create Announcement |
|------|---------------------|
| **CEO** | ✅ Yes |
| **Finance Head** | ❌ No |
| **HR** | ✅ Yes |
| **Project Manager** | ❌ No |
| **Employee** | ❌ No |

**Announcement Rules:**
- CEO: Can create company-wide announcements
- Finance Head: Cannot create
- HR: Can create announcements (HR policy, benefits, news)
- Project Manager: Cannot create system announcements
- Employee: Cannot create

---

### Reports & Analysis Module

| Role | Create Custom Report | Schedule Report |
|------|---------------------|-----------------|
| **CEO** | ✅ Yes | ✅ Yes |
| **Finance Head** | ✅ Financial | ✅ Financial |
| **HR** | ✅ HR | ✅ HR |
| **Project Manager** | ✅ Own Projects | ✅ Own Projects |
| **Employee** | ❌ No | ❌ No |

---

### Expense Management Module

| Role | Create Expense Claim | Create Category |
|------|---------------------|-----------------|
| **CEO** | ✅ Yes | ✅ Yes |
| **Finance Head** | ✅ Yes | ✅ Yes |
| **HR** | ❌ No | ❌ No |
| **Project Manager** | ✅ Yes | ✅ Own Projects |
| **Employee** | ✅ Own | ❌ No |

**Expense Claim Rules:**
- CEO: Can create for self and others
- Finance Head: Can create own and process all
- HR: Cannot create expense claims
- Project Manager: Can create own and project claims
- Employee: Can only create own expense claims

---

### Personal Profile Module

| Role | Create Profile (New) | Upload Document |
|------|---------------------|-----------------|
| **CEO** | N/A (exists) | ✅ Yes |
| **Finance Head** | N/A (exists) | ✅ Own |
| **HR** | N/A (system creates) | ✅ All |
| **Project Manager** | N/A (exists) | ✅ Own |
| **Employee** | N/A (exists) | ✅ Own (limited) |

---

## Edit Permissions Matrix

### Dashboard Module

| Role | Edit Widget | Edit Report |
|------|-------------|-------------|
| **CEO** | ✅ Yes | ✅ Yes |
| **Finance Head** | ❌ No | ✅ Own |
| **HR** | ❌ No | ✅ Own |
| **Project Manager** | ❌ No | ✅ Own |
| **Employee** | ❌ No | ❌ No |

---

### Projects Module

| Role | Edit Own | Edit Other | Edit Budget | Edit Team | Edit Timeline |
|------|----------|-----------|-------------|-----------|--------------|
| **CEO** | ✅ Yes | ✅ All | ✅ Yes | ✅ Yes | ✅ Yes |
| **Finance Head** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| **HR** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| **Project Manager** | ✅ Own | ❌ No | ✅ Own | ✅ Own | ✅ Own |
| **Employee** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |

**Project Edit Rules:**
- CEO: Can edit any project
- Finance Head: Cannot edit projects
- HR: Cannot edit projects
- Project Manager: Can only edit own projects (status, timeline, team, budget for own projects)
- Employee: Cannot edit projects

**Budget Edit Restrictions:**
- Only CEO and Project Manager (own projects) can edit budget
- Changes to budget > 10% require CEO approval
- Finance Head can view but not edit

---

### Staff & Payroll Module

| Role | Edit Employee | Edit Compensation | Edit Payroll | Manage Documents |
|------|---------------|-------------------|--------------|-----------------|
| **CEO** | ✅ All | ✅ All | ✅ All | ✅ All |
| **Finance Head** | ❌ No | ✅ All | ✅ All | ❌ No |
| **HR** | ✅ All | ✅ All | ❌ No | ✅ All |
| **Project Manager** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Employee** | ✅ Own (limited) | ❌ No | ❌ No | ✅ Own |

**Employee Edit Rules:**
- CEO: Can edit all employee fields
- Finance Head: Cannot edit employee records
- HR: Can edit all fields (personal info, employment, contact)
- Project Manager: Cannot edit employee records
- Employee: Can edit only own contact info (phone, address, emergency contact)

**Employee Field Edit Restrictions by Role:**
```
Employee Editable by HR:
├── All fields (personal, employment, compensation)

Employee Editable by CEO:
├── All fields

Employee Editable by Employee (own):
├── Phone
├── Address
├── Emergency Contact
└── Profile Photo

NOT Editable:
├── Employee ID (auto-generated)
├── Email (locked after creation)
└── Account Number (set once, then locked)
```

**Compensation Edit Rules:**
- CEO: Can edit all compensation components
- Finance Head: Can edit salary components (base, allowances, bonus, deductions)
- HR: Can edit all compensation details
- Changes to compensation > 5% require CEO review
- All changes to compensation create audit log with reason

---

### Attendance Module

| Role | Edit Own Check-In | Edit Team Check-In | Edit Leave Status | Adjust Records |
|------|------------------|-------------------|------------------|-----------------|
| **CEO** | ✅ Yes | ✅ All | ✅ All | ✅ All |
| **Finance Head** | ✅ Own | ❌ No | ❌ No | ❌ No |
| **HR** | ✅ Yes | ✅ All | ✅ All | ✅ All |
| **Project Manager** | ✅ Yes | ✅ Own Team | ✅ Own Team | ✅ Own Team |
| **Employee** | ✅ Own | ❌ No | ❌ No | ❌ No |

**Attendance Edit Rules:**
- Only within 24 hours of check-in (soft edit window)
- After 24 hours requires HR approval
- Cannot edit others' records except as noted
- HR can edit any historical record (with audit log)

---

### Announcements Module

| Role | Edit Own | Edit Other | Publish/Unpublish |
|------|----------|-----------|-------------------|
| **CEO** | ✅ Yes | ✅ All | ✅ Yes |
| **Finance Head** | ❌ No | ❌ No | ❌ No |
| **HR** | ✅ Own | ✅ All | ✅ Yes |
| **Project Manager** | ❌ No | ❌ No | ❌ No |
| **Employee** | ❌ No | ❌ No | ❌ No |

---

### Reports & Analysis Module

| Role | Edit Custom Report | Update Report Settings |
|------|-------------------|----------------------|
| **CEO** | ✅ Yes | ✅ Yes |
| **Finance Head** | ✅ Own | ✅ Financial |
| **HR** | ✅ Own | ✅ HR |
| **Project Manager** | ✅ Own | ✅ Own Projects |
| **Employee** | ❌ No | ❌ No |

---

### Expense Management Module

| Role | Edit Own | Edit Other | Edit Status |
|------|----------|-----------|------------|
| **CEO** | ✅ Yes | ✅ All | ✅ Yes |
| **Finance Head** | ✅ Own | ❌ No | ✅ All |
| **HR** | ❌ No | ❌ No | ❌ No |
| **Project Manager** | ✅ Own | ✅ Own Team | ✅ Own Team |
| **Employee** | ✅ Own (pending) | ❌ No | ❌ No |

**Expense Edit Rules:**
- Can only edit if status is "Draft" or "Rejected"
- Once "Submitted", only approvers can edit
- Cannot reduce expense amount once submitted (add supplement claim)
- Receipt attachment required before submission

---

### Personal Profile Module

| Role | Edit Own | Edit Other | Edit Preferences |
|------|----------|-----------|------------------|
| **CEO** | ✅ Yes | ✅ All | ✅ All |
| **Finance Head** | ✅ Own | ❌ No | ✅ Own |
| **HR** | ✅ Yes | ✅ All | ✅ All |
| **Project Manager** | ✅ Own | ❌ Own Team (limited) | ✅ Own |
| **Employee** | ✅ Own | ❌ No | ✅ Own |

**Personal Profile Edit Rules:**
- Employees can edit limited fields (phone, address, emergency contact)
- HR can edit all fields
- CEO can edit all fields
- Email cannot be changed after creation
- Sensitive fields (SSN, bank) restricted

---

## Delete Permissions Matrix

### Dashboard Module

| Role | Delete Widget | Delete Report |
|------|---------------|---------------|
| **CEO** | ✅ Yes | ✅ Yes |
| **Finance Head** | ❌ No | ✅ Own |
| **HR** | ❌ No | ✅ Own |
| **Project Manager** | ❌ No | ✅ Own |
| **Employee** | ❌ No | ❌ No |

---

### Projects Module

| Role | Delete Project | Delete Expense Category | Delete Milestone |
|------|----------------|------------------------|-----------------|
| **CEO** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Finance Head** | ❌ No | ❌ No | ❌ No |
| **HR** | ❌ No | ❌ No | ❌ No |
| **Project Manager** | ✅ Own (soft delete) | ✅ Own | ✅ Own |
| **Employee** | ❌ No | ❌ No | ❌ No |

**Project Delete Rules:**
- Soft delete only (archive, not permanent removal)
- Archived projects remain in system with historical data intact
- Cannot delete if expenses recorded (soft delete only)
- CEO: Can permanently delete archived projects (audit logged)
- Project Manager: Can soft delete own projects only

---

### Staff & Payroll Module

| Role | Delete Employee | Delete Compensation | Delete Payroll Run | Delete Document |
|------|-----------------|-------------------|-------------------|-----------------|
| **CEO** | ✅ Soft only | ❌ No (archive) | ❌ No (archive) | ✅ Yes |
| **Finance Head** | ❌ No | ❌ No | ❌ No | ❌ No |
| **HR** | ✅ Soft only | ❌ No (archive) | ❌ No | ✅ Yes |
| **Project Manager** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Employee** | ❌ No | ❌ No | ❌ No | ❌ No |

**Delete Rules:**
- Employee records: Only soft delete (never hard delete, keeps audit trail)
- Compensation records: Only archive (keep history)
- Payroll runs: Only archive (keep history for tax/audit purposes)
- Documents: Can be deleted (soft delete with restore option)
- Deleted records remain in audit log permanently

---

### Attendance Module

| Role | Delete Check-In | Delete Leave Request | Delete Record |
|------|-----------------|----------------------|----------------|
| **CEO** | ✅ Yes (within window) | ✅ Draft only | ✅ Soft delete |
| **Finance Head** | ✅ Own (within window) | ❌ No | ❌ No |
| **HR** | ✅ Yes | ✅ Any | ✅ Soft delete |
| **Project Manager** | ✅ Own (within window) | ✅ Own Team (draft) | ❌ No |
| **Employee** | ✅ Own (within window) | ✅ Draft only | ❌ No |

**Attendance Delete Rules:**
- Delete only within 24-hour window
- After 24 hours: HR must create adjustment record
- Leave requests: Can delete own while in Draft status
- Once Approved/Rejected, cannot delete (must create cancellation request)

---

### Announcements Module

| Role | Delete Announcement |
|------|---------------------|
| **CEO** | ✅ Yes |
| **Finance Head** | ❌ No |
| **HR** | ✅ Own & All |
| **Project Manager** | ❌ No |
| **Employee** | ❌ No |

**Announcement Delete Rules:**
- Soft delete only (archive)
- Archived announcements visible to HR for history
- Cannot be permanently deleted for compliance

---

### Reports & Analysis Module

| Role | Delete Custom Report | Delete Scheduled Report |
|------|---------------------|------------------------|
| **CEO** | ✅ Yes | ✅ Yes |
| **Finance Head** | ✅ Own | ✅ Own |
| **HR** | ✅ Own | ✅ Own |
| **Project Manager** | ✅ Own | ✅ Own |
| **Employee** | ❌ No | ❌ No |

---

### Expense Management Module

| Role | Delete Own Claim | Delete Other | Delete Category |
|------|-----------------|-------------|-----------------|
| **CEO** | ✅ Yes (soft) | ✅ All (soft) | ✅ Yes |
| **Finance Head** | ✅ Own (soft) | ❌ No | ✅ Yes |
| **HR** | ❌ No | ❌ No | ❌ No |
| **Project Manager** | ✅ Own (soft) | ✅ Team (soft) | ✅ Own Projects |
| **Employee** | ✅ Own Draft only | ❌ No | ❌ No |

**Expense Delete Rules:**
- Claim: Can only delete if status is Draft or Rejected
- Once Submitted: Cannot delete (must request cancellation)
- Soft delete only (remains in audit trail)
- Approved claims: Cannot be deleted

---

### Personal Profile Module

| Role | Delete Document | Delete Account |
|------|-----------------|-----------------|
| **CEO** | ✅ Yes | ✅ Deactivate only |
| **Finance Head** | ✅ Own | ❌ No |
| **HR** | ✅ All | ✅ Soft delete |
| **Project Manager** | ❌ No | ❌ No |
| **Employee** | ✅ Own | ❌ No |

**Profile Delete Rules:**
- Documents: Can be deleted/archived
- Employee accounts: Only soft delete (maintain audit trail)
- Terminated employee: Deactivated, not deleted
- All data preserved indefinitely for compliance

---

## Approval Permissions Matrix

### Projects Module

| Role | Approve Budget Change | Approve Timeline | Approve Team Changes |
|------|----------------------|------------------|----------------------|
| **CEO** | ✅ Any | ✅ Any | ✅ Any |
| **Finance Head** | ✅ Any | ❌ No | ❌ No |
| **HR** | ❌ No | ❌ No | ❌ No |
| **Project Manager** | ✅ Own | ✅ Own | ✅ Own |
| **Employee** | ❌ No | ❌ No | ❌ No |

**Approval Rules:**
- Budget increase > 10%: CEO approval required
- Budget increase 5-10%: Project Manager can approve, Finance Head reviews
- Timeline extension: Project Manager approves own, CEO approves others
- Team additions: Project Manager approves for own project

---

### Staff & Payroll Module

| Role | Approve Compensation | Approve Payroll Run | Approve Document |
|------|---------------------|-------------------|-----------------|
| **CEO** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Finance Head** | ❌ CEO review only | ✅ Yes | ❌ No |
| **HR** | ✅ Yes | ❌ No | ✅ Yes |
| **Project Manager** | ❌ No | ❌ No | ❌ No |
| **Employee** | ❌ No | ❌ No | ❌ No |

**Approval Rules:**
- Compensation > 5% increase: CEO approval required
- Payroll runs: Finance Head approval, CEO final approval
- Documents: HR approval required for official records
- New employee: HR creates, CEO may review

---

### Attendance Module

| Role | Approve Leave Request | Approve Absence Exception | Approve Overtime |
|------|----------------------|--------------------------|------------------|
| **CEO** | ✅ Any | ✅ Any | ✅ Any |
| **Finance Head** | ❌ No | ❌ No | ❌ No |
| **HR** | ✅ Any | ✅ Any | ✅ Any |
| **Project Manager** | ✅ Own Team | ✅ Own Team | ✅ Own Team |
| **Employee** | ❌ No | ❌ No | ❌ No |

**Approval Rules:**
- Leave requests: Manager first, then HR (2-level approval)
- Absence exceptions: HR can approve/deny
- Overtime: Manager approves, HR notified
- Critical leaves (>5 days): CEO final approval

**Leave Approval Flow:**
```
Employee requests leave
    ↓
Manager approves/rejects
    ↓ (if approved)
HR approves/rejects
    ↓ (if approved)
Leave marked in system
```

---

### Expense Management Module

| Role | Approve Own | Approve Team | Approve All | Set Limits |
|------|-------------|-------------|-----------|-----------|
| **CEO** | ❌ Cannot (anti-fraud) | ✅ Any | ✅ Any | ✅ Yes |
| **Finance Head** | ❌ Cannot (anti-fraud) | ❌ No | ✅ Any | ✅ Yes |
| **HR** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Project Manager** | ❌ Cannot (anti-fraud) | ✅ Team | ❌ Others | ✅ Team Budget |
| **Employee** | ❌ No | ❌ No | ❌ No | ❌ No |

**Expense Approval Flow:**
```
Employee submits expense
    ↓
Manager approves/rejects (up to authority limit)
    ↓ (if above limit)
Finance Head approves/rejects
    ↓ (if approved)
Finance processes payment
```

**Approval Limits:**
- Employee: Cannot approve own expenses
- Project Manager: Can approve team expenses up to $5,000 per claim, $50,000 per month
- Finance Head: Can approve up to $25,000 per claim
- CEO: No limit, final authority
- All approvals require business justification

**Separation of Duties:**
- Cannot create and approve own expense
- Requires second approval for amounts > $10,000
- Finance Head cannot bypass Project Manager review for team expenses

---

### Announcements Module

| Role | Approve Publishing | Approve Distribution | Approve Recall |
|------|-------------------|---------------------|-----------------|
| **CEO** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Finance Head** | ❌ No | ❌ No | ❌ No |
| **HR** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Project Manager** | ❌ No | ❌ No | ❌ No |
| **Employee** | ❌ No | ❌ No | ❌ No |

---

### Reports & Analysis Module

| Role | Approve Report Distribution | Approve Sensitive Data | Approve Export |
|------|---------------------------|----------------------|-----------------|
| **CEO** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Finance Head** | ✅ Financial Reports | ✅ Financial Data | ✅ Financial Only |
| **HR** | ✅ HR Reports | ✅ HR Data | ✅ HR Only |
| **Project Manager** | ✅ Own Projects | ✅ Own Projects | ✅ Own Projects |
| **Employee** | ❌ No | ❌ No | ❌ No |

---

### Payroll Module

| Role | Approve Payroll | Approve Payroll Adjustment | Approve Reversal |
|------|-----------------|---------------------------|-----------------|
| **CEO** | ✅ Final | ✅ Yes | ✅ Yes |
| **Finance Head** | ✅ Prepare & Approve | ✅ Yes | ❌ CEO only |
| **HR** | ❌ No | ❌ No | ❌ No |
| **Project Manager** | ❌ No | ❌ No | ❌ No |
| **Employee** | ❌ No | ❌ No | ❌ No |

**Payroll Approval Flow:**
```
Finance Head generates payroll
    ↓
Finance Head reviews & approves
    ↓
Payroll sent to CEO for final approval
    ↓
CEO approves
    ↓
Finance Head processes (bank transfer)
```

---

## Module-Specific Access Rules

### Dashboard Module Access Rules

**CEO Dashboard:**
- All widgets visible (Financial, HR, Projects, Expenses, Attendance)
- Real-time data refresh
- Edit permissions for widget settings
- Can set system-wide dashboard defaults

**Finance Head Dashboard:**
- Financial widgets only (Cash Flow, Budget Status, Expense Trends)
- Payroll summary widget
- Financial alerts and KPIs
- Cannot view HR or Attendance data

**HR Dashboard:**
- HR widgets (Headcount, Turnover, Leave Balance, Attendance)
- Announcement feed
- Cannot view Financial data
- Cannot view Project details

**Project Manager Dashboard:**
- Project widgets for own projects only
- Team performance metrics
- Budget status for own projects
- Cannot view other managers' data

**Employee Dashboard:**
- Personal widgets (My Attendance, My Expenses, Pending Tasks)
- Leave balance
- Announcements relevant to employee
- Cannot view organization-wide data

### Projects Module Access Rules

**Scope:**
- Projects organized by division (CSR or LSGB)
- Each project has assigned manager
- Team members assigned to projects

**Access Rules by Role:**
- CEO: All projects, all divisions, all data
- Finance Head: All projects (financial data only), cannot edit
- HR: All projects (team data only), cannot edit
- Project Manager: Only projects assigned to them, full access to own projects
- Employee: Only assigned projects, view-only

**Sensitive Data in Projects:**
- Budget details: CEO, Finance Head, Project Manager (own only)
- Team salaries: CEO, Finance Head, HR only
- Financial variance: CEO, Finance Head only

### Staff & Payroll Module Access Rules

**Scope:**
- 156 employees across multiple departments
- Sensitive personal data (compensation, bank info)
- Payroll data (for Finance/HR only)

**Field-Level Access:**
- Employee ID: All roles (if allowed to view employee)
- Name, Email, Phone: All allowed roles
- Department, Designation: All allowed roles
- Salary Components: CEO, Finance Head, HR only
- Bank Details: CEO, Finance Head, HR (masked), Employee (own, masked)
- Performance Data: Manager (own team), HR (all), CEO

**Sensitive Data Protection:**
- Bank account numbers always masked (last 4 digits only)
- Full bank details only shown in secure backend for transfers
- SSN/Tax ID: CEO, HR, Finance Head only
- Compensation history: CEO, Finance Head, HR only

### Attendance Module Access Rules

**Check-In/Out:**
- All employees can check own
- Managers can view team check-in times
- HR can see all and manage exceptions

**Leave Requests:**
- Employee requests own leave
- Manager approves/rejects
- HR final approval and maintains records
- HR can see all leaves and generate reports

**Attendance Reports:**
- CEO: All employees, all time periods
- Finance Head: Summary only (for cost allocation)
- HR: All employees, all reports
- Project Manager: Own team only
- Employee: Own only

### Expense Management Module Access Rules

**Claim Creation:**
- Employees create own claims
- Managers can create for team/projects
- Finance Head can create any
- CEO can create any

**Approval Hierarchy:**
- Level 1: Manager (if amount < $5,000)
- Level 2: Finance Head (if amount $5,000-$25,000)
- Level 3: CEO (if amount > $25,000)
- Cannot approve own claims (separation of duties)

**Data Visibility:**
- Employees see own claims only
- Managers see own + team claims
- Finance Head sees all claims
- CEO sees all claims

---

## Field-Level Permissions

### Employee Record Fields

**Public Fields (All can view if employee is visible):**
- Name, Email, Phone
- Department, Designation
- Photo/Avatar

**Restricted Fields (Only CEO, HR, Finance Head):**
- Salary components
- Bank account details (masked for non-financial)
- Social Security Number / Tax ID
- Compensation history
- Performance reviews

**Employee Can Edit Own:**
- Phone number
- Address
- Emergency contact
- Profile photo
- Preferences/Settings

**HR Only Can Edit:**
- Personal information (DOB, gender, marital status)
- Employment details (department, designation, status)
- Compensation information
- Bank details
- Contact information

**Finance Only Can Edit:**
- Compensation amounts
- Deductions
- Tax withholdings

### Project Fields

**Public Fields (All can view):**
- Project Name, ID
- Status
- Start/End Dates
- Responsible Manager
- Team member names (not salaries)

**Restricted Fields (CEO, Finance Head, Project Manager own):**
- Budget amounts
- Financial variance
- Actual expenses
- Revenue/funding
- Profit margin

**Edit-Only Fields (CEO, Project Manager own):**
- Project timeline
- Team assignments
- Budget allocation
- Status changes

### Compensation Fields

**Public to Employee (Own Only):**
- Base salary (annual/monthly)
- Monthly CTC
- Total compensation

**Restricted (CEO, Finance Head, HR only):**
- Individual salary components breakdown
- Deductions
- Tax withholdings
- Bonus amounts
- Allowance details
- History of salary changes

---

## Permission Dependencies

### Conditional Permissions

**Approval Authority Depends On:**
- Amount being approved
- Type of resource
- User's department/role
- Existing approval chain

**Edit Permission Depends On:**
- Record ownership or team membership
- Record status (Draft, Submitted, Approved, etc.)
- Time window (24-hour soft edit for attendance)
- Financial limits

**Delete Permission Depends On:**
- Record status
- Historical importance (payroll always archived)
- Financial impact
- Compliance requirements

### Approval Chain Examples

**Expense Claim Approval:**
```
Employee submits $3,000 claim
  → Manager approves (within limit $5,000)
  → Finance processes
  
Employee submits $12,000 claim
  → Manager approves (notified it needs Finance approval)
  → Finance Head approves (within limit $25,000)
  → Finance processes
  
Employee submits $50,000 claim
  → Manager approves
  → Finance Head approves
  → CEO approves (final authority)
  → Finance processes
```

**Leave Request Approval:**
```
Employee requests 3-day leave
  → Manager approves/rejects
  → If approved: HR confirms
  → Leave recorded in system
  
Employee requests 10-day leave
  → Manager approves/rejects
  → HR reviews
  → CEO final approval
  → Leave recorded
```

**Payroll Processing:**
```
Finance Head generates payroll for June
  → Finance Head reviews (correctness)
  → Finance Head approves (payroll ready)
  → CEO approves (authorization)
  → Finance Head processes (bank transfer)
```

---

## Implementation Guide

### Permission Enforcement Points

**Frontend (UX-level):**
- Hide menu items user cannot access
- Disable buttons user cannot activate
- Show "Not Authorized" messages
- Prevent form submission for unauthorized actions

**Backend (Security-level - CRITICAL):**
- Validate permission on every API call
- Check user role(s)
- Check resource ownership (if applicable)
- Check approval authority
- Log all authorization decisions
- Reject unauthorized requests with 403 Forbidden

**Database Level:**
- Row-level security (users can only see their authorized data)
- Field-level encryption for sensitive data
- Audit table for permission changes

### Permission Storage

**Option 1: Role-Based (Recommended)**
```
Roles table:
├── CEO
├── Finance Head
├── HR
├── Project Manager
└── Employee

Role_Permissions table:
├── role_id: UUID
├── module: string (Projects, Staff, etc.)
├── action: string (View, Create, Edit, Delete, Approve)
├── resource_type: string (Project, Employee, Expense, etc.)
├── conditions: JSON (optional, for conditional permissions)
└── created_at: DateTime
```

**Option 2: User Roles**
```
User_Roles table:
├── user_id: UUID
├── role_id: UUID
├── department: string (optional, for scoped roles)
├── team_id: UUID (optional, for team managers)
├── effective_from: DateTime
├── effective_to: DateTime
└── assigned_by: UUID
```

### Permission Checking Logic

**Flow:**

```
API Request with User Token
    ↓
Extract user ID from token
    ↓
Load user's roles and assignments
    ↓
Check if role has [action] permission on [resource]
    ↓
If conditional permission:
  ├─ Check ownership (is resource owned by user?)
  ├─ Check team membership (is resource in user's team?)
  ├─ Check amount limits (is amount within authority?)
  ├─ Check time window (is it within edit window?)
  └─ Other conditions...
    ↓
✅ Permission granted: Allow request
❌ Permission denied: Return 403 + log event
    ↓
Execute action if authorized
    ↓
Create audit log entry (who, what, when, from where)
```

### Audit Logging of Permission Use

**Log Every:**
- Successful authorization (who, what resource, what action, when, from where)
- Failed authorization attempts (rejected request)
- Permission grants/revokes (admin changes)
- Approval actions (who approved, what, amount, when)

**Retention:**
- Keep all permission logs for 7 years (compliance)
- Searchable by user, date, resource, action
- Exportable for audits

---

## Summary

### Permission Structure Overview

| Component | Details |
|-----------|---------|
| **Total Roles** | 5 (CEO, Finance Head, HR, Project Manager, Employee) |
| **Total Modules** | 8 (Dashboard, Projects, Staff, Attendance, Announcements, Reports, Expenses, Profile) |
| **Permission Types** | 5 (View, Create, Edit, Delete, Approve) |
| **Total Matrix Cells** | 200+ (5 roles × 8 modules × 5 permissions) |
| **Conditional Rules** | 50+ (amount limits, time windows, ownership, approvals) |
| **Separation of Duties** | 10+ (cannot create and approve own, etc.) |

### Key Security Principles

✅ **Role-Based Access Control:** Permissions assigned via roles  
✅ **Principle of Least Privilege:** Minimum access needed  
✅ **Separation of Duties:** Critical functions split (create/approve)  
✅ **Immutable Audit Trail:** All actions logged  
✅ **Backend Enforcement:** Permission checks on API, not just UI  
✅ **Field-Level Security:** Sensitive data encrypted/masked  
✅ **Approval Chains:** Multi-level approval for high-value actions  
✅ **Time Windows:** Edit windows prevent audit trail gaps  

### Role Hierarchy

```
CEO (Full Access)
├─ Finance Head (Financial + Payroll)
├─ HR (Staff + Organizational)
├─ Project Manager (Project + Team Scope)
└─ Employee (Personal + Assigned)
```

---

**Document Status:** Approved for Development  
**Next Step:** Implement permission checking middleware in backend  
**Implementation Order:**  
1. Define role and permission tables
2. Implement permission checking middleware
3. Add permission validation to all API endpoints
4. Add audit logging to all permission checks
5. Test all role scenarios

---

## Appendix: Quick Reference by Role

### CEO Quick Permissions
✅ View: Everything  
✅ Create: Projects, Employees, Payroll, Announcements  
✅ Edit: All records  
✅ Delete: Soft delete only  
✅ Approve: All workflows  

### Finance Head Quick Permissions
✅ View: Financial data, payroll, compensation  
✅ Create: Payroll runs, expense categories  
✅ Edit: Compensation, payroll, expense status  
✅ Delete: None (soft archive)  
✅ Approve: Payroll, expenses  

### HR Quick Permissions
✅ View: All staff, attendance, compensation  
✅ Create: Employees, compensation records, announcements  
✅ Edit: All employee records  
✅ Delete: Soft delete employees, archive announcements  
✅ Approve: Leave requests, compensation, documents  

### Project Manager Quick Permissions
✅ View: Own projects, own team  
✅ Create: Own projects, own expenses, own leave  
✅ Edit: Own projects, own projects' budget/timeline  
✅ Delete: Soft delete own projects  
✅ Approve: Own team leave, own team expenses (within limit)  

### Employee Quick Permissions
✅ View: Own profile, own compensation, own expenses, assigned projects  
✅ Create: Own expense claims, own leave requests  
✅ Edit: Own contact info, own pending claims  
✅ Delete: Own draft claims  
✅ Approve: None  
