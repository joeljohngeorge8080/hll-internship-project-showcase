# HMA IEMS - API Requirements

## Authentication APIs

### POST /auth/login
Login with username and password.

### POST /auth/logout
Logout current user.

### GET /auth/me
Get current logged-in user details.

### POST /auth/reset-password
Reset password by HR.

---

## Dashboard APIs

### GET /dashboard/summary
Return dashboard KPI data.

### GET /dashboard/activity
Return recent activity records.

### GET /dashboard/charts
Return dashboard chart data.

---

## Employee APIs

### GET /employees
List employees.

### POST /employees
Create employee.

### GET /employees/{id}
Get employee details.

### PUT /employees/{id}
Update employee details.

### DELETE /employees/{id}
Delete employee logically by status change.

### GET /employees/{id}/salary-history
Get salary history.

### GET /employees/{id}/documents
Get employee documents.

### POST /employees/{id}/documents
Upload employee documents.

---

## Project APIs

### GET /projects
List projects.

### POST /projects
Create project.

### GET /projects/{id}
Get project details.

### PUT /projects/{id}
Update project details.

### PATCH /projects/{id}/status
Change project status.

### GET /projects/{id}/expenses
Get project expense list.

### POST /projects/{id}/expenses
Create project expense.

### PUT /projects/{id}/expenses/{expense_id}
Update project expense.

### DELETE /projects/{id}/expenses/{expense_id}
Delete project expense.

### GET /projects/{id}/history
Get project officer history.

---

## Attendance APIs

### GET /attendance
List attendance records.

### POST /attendance/import
Import attendance from Excel or machine data.

### PUT /attendance/{id}
Update attendance manually if allowed.

### GET /attendance/{id}/corrections
Get attendance correction history.

### POST /attendance/{id}/corrections
Create correction log.

### GET /attendance/report
Generate attendance report.

---

## Payroll APIs

### POST /payroll/generate
Generate payroll for selected month.

### GET /payroll
List payroll records.

### GET /payroll/{id}
Get payroll details.

### PUT /payroll/{id}
Update payroll if override is allowed.

### GET /payroll/{id}/history
Get payroll change history.

### GET /payroll/report
Generate payroll report.

---

## Expense APIs

### GET /expenses
List expense records.

### POST /expenses/upload
Upload expense Excel.

### POST /expenses
Create expense manually.

### PUT /expenses/{id}
Update expense.

### DELETE /expenses/{id}
Delete expense.

### GET /expenses/report
Generate expense report.

---

## Finance APIs

### GET /finance/files
List finance files.

### POST /finance/files/upload
Upload finance Excel file.

### PUT /finance/files/{id}
Update finance file metadata or version.

### GET /finance/files/{id}/history
Get file history.

### GET /finance/report
Generate finance report.

---

## Reports APIs

### GET /reports/attendance
Generate attendance report.

### GET /reports/project
Generate project report.

### GET /reports/project/overall
Generate overall project report.

### GET /reports/forecast
Generate forecast report.

### GET /reports/predicted
Generate predicted report.

### GET /reports/actual-expense
Generate actual expense report.

### GET /reports/powerbi-style
Generate visualization summary.

### POST /reports/export
Export reports to PDF, Excel, or Word.

---

## Audit Log APIs

### GET /audit-logs
List audit logs.

### GET /audit-logs/{id}
Get audit log detail.

---

## Settings APIs

### GET /settings/policies
Get company policies.

### PUT /settings/policies
Update policies.

### GET /settings/roles
Get role list.

### PUT /settings/roles
Update role permissions.