# HMA IEMS - System Architecture

## 1. Architecture Style

The system shall follow a modular monolithic architecture with role-based access control.

This is preferred because:
- The user count is small
- The business rules are complex
- The system is internal
- The modules are highly related
- Maintenance should be simple

---

## 2. Frontend Architecture

### Stack
- React
- Vite
- Tailwind CSS
- HTML
- CSS
- JavaScript
- Recharts

### UI Strategy
- Use CoreUI as the base template
- Customize screens to match HMA IEMS
- Remove demo CRM, e-commerce, blog, and unused sections
- Build custom pages for projects, attendance, payroll, finance, reports, and audit logs

---

## 3. Backend Architecture

### Stack
- Python
- FastAPI
- Pydantic
- SQLModel

### Backend Layers
- API Layer
- Service Layer
- Data Access Layer
- Validation Layer
- Audit Logging Layer
- Report Generation Layer
- Import/Export Layer

---

## 4. Database Architecture

### Stack
- PostgreSQL
- Supabase Pro

### Design Principles
- Use normalized tables
- Preserve history
- Never overwrite critical records without logging
- Keep audit logs immutable
- Store uploaded files separately in object storage

---

## 5. Authentication Architecture

### Method
- Username and password
- JWT for session management

### Login Identity
- Employee ID as username

### Administration
- HR can reset passwords
- Users are created manually

---

## 6. Storage Architecture

### File Storage
- AWS S3

### Stored Files
- Employee documents
- Expense uploads
- Finance uploads
- Report exports
- Project-related uploads if enabled later

---

## 7. Email Architecture

### Service
- AWS SES

### Usage
- Monthly report mail
- Future announcement mail
- Future notification mail

---

## 8. Infrastructure Architecture

### Hosting
- AWS EC2

### Supporting Services
- AWS Route53
- AWS Certificate Manager
- AWS CloudWatch

### Containerization
- Docker

### CI/CD
- GitHub Actions
- AWS ECR

---

## 9. Role-Based Access Architecture

### CEO
- View all modules

### Heads
- View all modules

### HR
- View all
- Edit staff & payroll
- Edit attendance
- Edit expense management

### Finance
- View all
- Edit finance module
- Edit project expenses

### Project Officer
- View dashboard
- View projects
- View reports
- View audit logs
- Edit projects
- Edit project expenses

---

## 10. Core Business Flow

### Project Flow
Create project
→ Set locked project value
→ Create predicted budget through ML/formula
→ Allow actual expenses to be updated
→ Generate reports and variance analysis

### HR Flow
Manage employees
→ Maintain attendance
→ Generate payroll
→ Maintain salary history
→ Track attendance corrections

### Finance Flow
Upload finance files
→ Maintain finance history
→ Update project expenses
→ View all records

### Reporting Flow
Collect data from all modules
→ Generate analytics
→ Forecast future outcomes
→ Export reports

---

## 11. Audit Architecture

Every create, update, delete, correction, login, and override action must generate an immutable audit log entry.

Audit logs must store:
- user
- role
- action
- module
- record id
- old value
- new value
- timestamp
- remarks
- ip address

Audit logs are view-only for all users.