# Roles and Permissions Matrix

## User Roles

The HMA IEMS system consists of five primary user roles:

1. CEO
2. Department Heads
3. HR
4. Finance
5. Project Officer

---

# Permission Legend

| Symbol | Meaning                |
| ------ | ---------------------- |
| V      | View Only              |
| E      | Edit / Create / Update |
| X      | No Access              |

---

# Module Access Matrix

| Module                  | CEO | Heads | HR | Finance | Project Officer |
| ----------------------- | --- | ----- | -- | ------- | --------------- |
| Dashboard               | V   | V     | V  | V       | V               |
| Projects                | V   | V     | V  | V       | E               |
| Project Actual Expenses | V   | V     | V  | E       | E               |
| Staff & Payroll         | V   | V     | E  | V       | X               |
| Attendance              | V   | V     | E  | V       | X               |
| Expense Management      | V   | V     | E  | V       | X               |
| Finance                 | V   | V     | V  | E       | X               |
| Reports & Analysis      | V   | V     | V  | V       | V               |
| Audit Logs              | V   | V     | V  | V       | V               |

---

# Detailed Role Definitions

## CEO

### Access Level

View Only

### Permissions

* View Dashboard
* View Projects
* View Staff & Payroll
* View Attendance
* View Expense Management
* View Finance
* View Reports & Analysis
* View Audit Logs

### Restrictions

* No direct editing responsibilities.
* Strategic monitoring and decision-making role.

---

## Department Heads

### Access Level

View Only

### Permissions

* View Dashboard
* View Projects
* View Staff & Payroll
* View Attendance
* View Expense Management
* View Finance
* View Reports & Analysis
* View Audit Logs

### Restrictions

* Cannot edit any records.
* Cannot modify employee, finance, project, or attendance information.

---

## HR

### Access Level

View All + Edit Assigned Modules

### Permissions

#### Staff & Payroll

* Add Employee
* Edit Employee
* Update Employee Status
* Upload Employee Documents
* Process Payroll
* Generate Payslips
* Record Salary Increments
* Maintain Salary History

#### Attendance

* Import Attendance
* Correct Attendance
* Manage Leave Records
* Generate Attendance Reports

#### Expense Management

* Upload Expense Files
* Create Expense Records
* Edit Expense Records
* Delete Expense Records
* Generate Expense Reports

#### Authentication

* Reset User Passwords

#### System Access

* View All Modules
* View Audit Logs

### Restrictions

* Cannot modify project master information.
* Cannot modify finance records.

---

## Finance

### Access Level

View All + Edit Finance & Project Expenses

### Permissions

#### Finance Module

* Upload Finance Excel Files
* Edit Finance Records
* Manage Finance Data
* Generate Finance Reports

#### Project Expenses

* Create Project Expense Records
* Edit Project Expense Records
* Delete Project Expense Records
* Upload Supporting Financial Documents

#### System Access

* View All Modules
* View Audit Logs

### Restrictions

* Cannot modify project master information.
* Cannot modify employee information.
* Cannot modify attendance records.
* Cannot process payroll.

---

## Project Officer

### Access Level

Project Management Access

### Permissions

#### Projects

* Create Projects
* Edit Projects
* Update Project Information
* Change Project Officer Assignment
* Upload Project Data
* Manage Project Status

#### Project Expenses

* Create Project Expense Records
* Edit Project Expense Records
* Delete Project Expense Records

#### Reports

* View Reports & Analysis
* Generate Reports

#### Audit Logs

* View Audit Logs

### Restrictions

* Cannot access Staff & Payroll.
* Cannot access Attendance.
* Cannot access Expense Management.
* Cannot access Finance Module.

---

# Project Expense Ownership

Project Actual Expenses are jointly maintained by:

* Finance Department
* Project Officers

Both roles are permitted to:

* Add Expenses
* Edit Expenses
* Delete Expenses

All changes must be recorded in:

* Audit Logs
* Expense Change History

including:

* Old Value
* New Value
* User
* Timestamp
* Remarks

---

# Audit Log Policy

All critical system actions shall be logged.

Examples include:

* Employee Creation
* Employee Modification
* Salary Updates
* Salary Increment Records
* Attendance Corrections
* Expense Modifications
* Project Updates
* Finance Uploads
* Password Resets

Audit Logs are viewable by:

* CEO
* Heads
* HR
* Finance
* Project Officers

Audit Logs are editable by:

* No User

Audit Logs shall remain immutable and permanently preserved.
