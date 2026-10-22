# HMA IEMS - Development Rules

## 1. Code Style

- Use clean, readable, modular code
- Prefer simple functions over overly complex abstractions
- Follow consistent naming conventions
- Separate business logic from UI logic
- Separate API logic from database logic

---

## 2. Frontend Rules

- Use React with Vite
- Use CoreUI as the starting template
- Keep the sidebar role-based
- Keep the dashboard fixed and simple
- Do not use unnecessary animations
- Use responsive tables and cards
- Use Recharts for visual reports

---

## 3. Backend Rules

- Use FastAPI
- Use SQLModel for ORM
- Use Pydantic for validation
- Build REST APIs only
- Use JWT authentication
- Use service layer for business rules
- Keep modules independent

---

## 4. Database Rules

- Use PostgreSQL
- Use Supabase Pro
- Store timestamps for all records
- Preserve history tables for critical changes
- Do not overwrite important historical data
- Use foreign keys properly
- Use unique constraints for employee ID and project code

---

## 5. Security Rules

- Hash passwords securely
- Never store plain text passwords
- Use JWT securely
- Restrict access by role
- Log every sensitive action
- Never expose hidden data to unauthorized users

---

## 6. Audit Rules

- Log all create, update, delete, correction, override, and login events
- Never allow audit logs to be edited or deleted
- Store old and new values whenever data changes
- Include remarks for manual override actions

---

## 7. Import/Export Rules

- Support Excel upload for attendance, expenses, and finance files
- Preserve original uploaded files
- Support report export in PDF, Excel, and Word formats
- Validate files before import
- Reject invalid or malformed uploads

---

## 8. Payroll Rules

- Payroll shall be generated monthly
- HR shall trigger payroll generation
- Salary history shall be preserved
- Salary increment changes shall create history entries
- Payroll lock must be respected

---

## 9. Attendance Rules

- Attendance is imported from machine data or Excel
- Attendance is locked after upload
- HR may correct attendance if needed
- Every correction must be logged
- Late entry policy must be applied from the policy table

---

## 10. Project Rules

- Project values are locked after creation
- Project officers may change
- Completed projects are read-only
- Project expenses may be edited by Finance and Project Officer
- Predicted values are generated outside the project module

---

## 11. Finance Rules

- Finance module is separate
- Finance can view everything
- Finance can edit finance data
- Finance can edit project expenses only
- Finance uploads must be versioned

---

## 12. Documentation Rules

- Maintain markdown documents for all major decisions
- Keep diagrams in Draw.io
- Keep project requirements in Notion
- Update documents whenever architecture changes

---

## 13. Claude Code Rules

- Provide Claude with clear, structured documents
- Do not ask Claude to guess business rules
- Do not generate whole project at once
- Build module by module
- Validate each module before moving to the next
- Use Claude for architecture, code generation, and code review