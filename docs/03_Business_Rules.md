# HMA IEMS - Business Rules

## 1. Employee Rules

### Employee Types

The system shall support three employee categories:

- Permanent
- FTC (Fixed Term Contract)
- TPC (Temporary Project Contract)

### Employee Status

An employee shall have one of the following statuses:

- Active
- Inactive
- Resigned
- Retired

Employee records shall never be permanently deleted.

Historical records must remain preserved for reporting and auditing purposes.

---

## 2. Authentication Rules

Authentication shall use:

- Employee ID
- Password
- JWT Authentication

Google OAuth shall not be used.

### Password Reset

Only HR shall have permission to reset user passwords.

### User Creation

Users shall be created manually by system administrators.

Employee ID shall be used as the login username.

Example:

EMP2398

---

## 3. Attendance Rules

### Working Schedule

Working Days:

- Monday to Saturday

Holidays:

- Second Saturday
- Fourth Saturday
- Company Holidays

Working Hours:

Start Time:
09:15 AM

End Time:
05:45 PM

---

## 4. Late Entry Rules

### Free Late Entry Allowance

Every employee receives:

7 free late-entry units per month.

1 unit = 15 minutes.

Example:

15 minutes late = 1 unit
30 minutes late = 2 units
45 minutes late = 3 units
1 hour late = 4 units

---

### Salary Deduction Rule

After all free units are exhausted:

Hourly salary deduction shall apply.

Formula:

Daily Salary =
Monthly Salary / Total Days in Month

Hourly Salary =
Daily Salary / 8

Example:

Salary = ₹25,000

Daily Salary =
25000 / 31

= ₹806

Hourly Salary =
806 / 8

= ₹100.75

Late Entry after free units exhausted:

1 Hour Late =
₹100.75 deduction

---

### Half Day Rule

If employee arrives more than one hour late:

Attendance shall be marked as Half Day.

4 hours salary deduction shall apply.

---

## 5. Leave Rules

### Casual Leave

1 Casual Leave per month.

Maximum Annual Casual Leave:

12 Days

Unused casual leave shall not be carried forward to next year.

---

### Sick Leave

Maximum Annual Sick Leave:

8 Days

Unused sick leave shall not be carried forward.

---

## 6. Attendance Corrections

Attendance corrections are permitted.

Only HR may perform corrections.

Every correction must store:

- Original Value
- Corrected Value
- Reason
- Modified By
- Timestamp

Attendance history shall never be overwritten.

---

## 7. Payroll Rules

### Payroll Generation

Payroll shall be generated manually by HR.

Payroll is generated monthly.

---

### Salary History

Salary records shall never be overwritten.

Every increment must create a new salary history entry.

Store:

- Old Salary
- Increment Percentage
- Increment Amount
- New Salary
- Effective Date
- Remarks
- Modified By

---

### Payroll Locking

Generated payroll shall be locked.

HR may override payroll if required.

All overrides shall be logged.

---

## 8. Project Rules

### Project Categories

Projects shall belong to one category:

- CSR
- LSGB
- Other

If category is "Other", custom category name shall be required.

---

### Project Status

Projects shall support:

- Draft
- Active
- Completed
- Archived
- Cancelled

Completed projects become read-only.

---

### Project Ownership

One project shall have one Project Officer.

Project Officer assignment may be changed.

Assignment history shall be maintained.

---

### Project Value

Project value is fixed.

Project value cannot be modified after project creation.

---

## 9. Project Expense Rules

Project Actual Expenses may be edited by:

- Finance
- Project Officer

Both roles have equal editing rights.

Every modification must store:

- Previous Value
- New Value
- Remarks
- User
- Timestamp

---

## 10. Expense Management Rules

Managed by HR.

Expense records may be:

- Created
- Updated
- Deleted

Excel upload is supported.

Original uploaded files shall always be preserved.

Expense history must remain available.

---

## 11. Finance Rules

Finance module is independent.

Finance shall upload and manage:

- Finance Excel Sheet 1
- Finance Excel Sheet 2
- Finance Excel Sheet 3

Historical versions shall be preserved.

---

## 12. Reporting Rules

All users may:

- View Reports
- Generate Reports
- Export Reports

Supported Formats:

- PDF
- Excel
- Word

---

## 13. Forecasting Rules

Forecasting shall be displayed under Reports & Analysis.

Forecasting shall include:

- Expense Forecast
- Revenue Forecast
- Profit/Loss Forecast
- Project Sustainability Forecast

Prediction logic shall be provided by the ML Team.

---

## 14. Audit Log Rules

All critical actions shall be logged.

Examples:

- Employee Creation
- Employee Updates
- Salary Changes
- Attendance Corrections
- Project Updates
- Expense Updates
- Finance Uploads
- Password Resets

Audit Logs are visible to all users.

Audit Logs are immutable.

No user may modify or delete audit logs.

## Attendance Data Source

The primary attendance source shall be the Pace Attendance Software.

Attendance data shall be imported through Excel exports generated from the attendance machine software.

The system shall support:

- Monthly Attendance Import
- Attendance Record Processing
- Attendance Summary Generation

Attendance records shall contain:

- Employee ID
- Employee Name
- Attendance Date
- Status
- In Time
- Out Time
- Work Duration
- Late By
- Early By
- Overtime
- Shift

The imported attendance file shall be treated as the source of truth.

Manual attendance corrections are allowed only by HR.

All corrections must be logged.