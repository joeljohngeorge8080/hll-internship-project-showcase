# HMA IEMS - Database Requirements

## 1. users
Stores login accounts.

### Fields
- id
- employee_id
- username
- password_hash
- role
- is_active
- created_at
- updated_at
- last_login_at

### Notes
- Username or id is used for login.
- Employee ID should be unique.
- Passwords must be hashed.


---

## 2. employee_types
Stores employee categories.

### Fields
- id
- type_name
- description

### Values
- Permanent
- FTC
- TPC

---

## 3. employees
Stores employee master data.

### Fields
- id
- employee_id
- full_name
- email
- phone
- designation
- department
- employee_type_id
- status
- join_date
- exit_date
- current_salary
- created_at
- updated_at

### Notes
- Bank details are not stored.
- Employee records are not deleted permanently.

---

## 4. employee_salary_history
Stores salary changes and increments.

### Fields
- id
- employee_id
- old_salary
- increment_percentage
- increment_amount
- new_salary
- effective_date
- remarks
- changed_by
- created_at

---

## 5. employee_documents
Stores employee file uploads.

### Fields
- id
- employee_id
- document_type
- file_name
- file_path
- uploaded_by
- uploaded_at
- remarks

### Notes
- Merged certificates can be stored as one file.
- Files should be preserved historically.

---

## 6. projects
Stores project master data.

### Fields
- id
- project_code
- project_name
- project_type
- other_type_name
- funder
- location
- project_value
- start_date
- end_date
- status
- officer_id
- remarks
- created_by
- created_at
- updated_at

### Notes
- Project value is locked after creation.
- Project code is auto-generated.
- Categories: CSR, LSGB, Other.

---

## 7. project_officer_history
Stores project officer change history.

### Fields
- id
- project_id
- old_officer_id
- new_officer_id
- changed_by
- changed_at
- remarks

---

## 8. project_expenses
Stores project actual expenses.

### Fields
- id
- project_id
- category
- amount
- expense_date
- remarks
- created_by
- updated_by
- created_at
- updated_at
- is_deleted

### Notes
- Editable by Finance and Project Officer.
- All changes must be logged.

---

## 9. project_expense_history
Stores project expense change history.

### Fields
- id
- project_expense_id
- old_amount
- new_amount
- old_remarks
- new_remarks
- changed_by
- changed_at

---

## 10. attendance
Stores employee attendance records.

### Fields
- id
- employee_id
- employee_name
- attendance_date
- status
- in_time
- out_time
- work_duration
- late_by
- early_by
- overtime
- shift
- imported_file_id
- created_at
- updated_at

### Notes
- Attendance is locked after upload.
- Corrections should not overwrite original records.

---

## 11. attendance_corrections
Stores attendance correction history.

### Fields
- id
- attendance_id
- original_value
- corrected_value
- reason
- corrected_by
- corrected_at
- remarks

---

## 11. attendance_summary
Stores employee attendance summary records.

### Fields
- id
- employee_id
- month
- year
- present_count
- absent_count
- weekly_off_count
- holiday_count
- leave_count
- late_hours
- late_days
- early_hours
- early_days
- average_working_hours
- total_work_duration
- total_overtime

---

## 12. leave_balances
Stores leave balance information.

### Fields
- id
- employee_id
- casual_leave_balance
- sick_leave_balance
- month
- year
- updated_at

### Notes
- Leave does not carry forward to next year.
- Monthly leave rules must be stored in policy table.

---

## 13. payroll
Stores payroll generation data.

### Fields
- id
- employee_id
- payroll_month
- payroll_year
- gross_salary
- deductions
- net_salary
- status
- generated_by
- generated_at
- remarks
- is_locked

---

## 14. payroll_history
Stores payroll overrides and changes.

### Fields
- id
- payroll_id
- old_value
- new_value
- changed_by
- changed_at
- remarks

---

## 15. expenses
Stores company expense records.

### Fields
- id
- expense_title
- category
- amount
- expense_date
- uploaded_by
- source_type
- remarks
- created_at
- updated_at
- is_deleted

---

## 16. finance_files
Stores finance upload records.

### Fields
- id
- file_name
- file_path
- uploaded_by
- uploaded_at
- remarks
- version_number
- is_active

---

## 17. finance_file_history
Stores finance file version history.

### Fields
- id
- finance_file_id
- old_file_name
- new_file_name
- changed_by
- changed_at
- remarks

---

## 18. reports
Stores generated report metadata.

### Fields
- id
- report_name
- report_type
- generated_by
- generated_at
- file_path
- file_format
- remarks

---

## 19. forecasts
Stores forecast results.

### Fields
- id
- forecast_type
- forecast_period
- projected_value
- confidence_notes
- source_model
- created_at
- remarks

---

## 20. audit_logs
Stores immutable system logs.

### Fields
- id
- user_id
- role
- module_name
- action_type
- record_id
- old_value
- new_value
- remarks
- ip_address
- created_at

### Notes
- Audit logs must never be deleted or edited.