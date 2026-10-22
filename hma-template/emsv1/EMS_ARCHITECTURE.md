# HMA Enterprise Management System (EMS) - Architecture Design Document

**Version:** 1.0  
**Date:** June 11, 2026  
**Status:** Master Reference Architecture  
**Audience:** Development Team, Technical Leadership, Product Stakeholders

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Principles](#core-principles)
3. [Technology Stack](#technology-stack)
4. [System Architecture](#system-architecture)
5. [Module Architecture](#module-architecture)
6. [Authentication & Authorization](#authentication--authorization)
7. [Data Architecture](#data-architecture)
8. [API Design Patterns](#api-design-patterns)
9. [Frontend Architecture](#frontend-architecture)
10. [Audit & Compliance](#audit--compliance)
11. [Scalability Strategy](#scalability-strategy)
12. [Folder Structure Redesign](#folder-structure-redesign)
13. [Migration Plan](#migration-plan)
14. [Development Phases](#development-phases)
15. [Deployment & Operations](#deployment--operations)

---

## System Overview

### Purpose
HMA EMS is an internal staff management system designed to streamline operational processes across projects, payroll, attendance, expenses, announcements, and reporting. It serves as the single source of truth for organizational data and decision-making.

### Scope
**Core Modules:**
- Dashboard (operational command center)
- Projects (project lifecycle management)
- Staff & Payroll (employee records, compensation, payments)
- Attendance (time tracking, leave management)
- Announcements (internal communications)
- Reports & Analysis (business intelligence, KPIs)
- Expense Management (reimbursement workflow)
- Personal Profile (self-service employee portal)

**Non-Scope:**
- CRM (customer management)
- Marketing automation
- Public-facing portal

### Users
- All HMA staff (employees)
- Department managers (supervisory access)
- HR & Finance teams (administrative access)
- Executive leadership (read-only KPI access)
- System administrators

### Key Metrics
- Uptime: 99.5% during business hours
- Response time: <500ms for UI operations, <2s for bulk reports
- Data accuracy: 100% audit trail for all business mutations
- Security: ISO 27001 aligned, SOC 2 ready

---

## Core Principles

### 1. **Audit-First Architecture**
Every business action (create, read, update, delete, approve, deny) must generate an immutable audit log entry that captures:
- WHO (user identity)
- WHAT (entity type, field changes)
- WHEN (timestamp)
- WHERE (service/API endpoint)
- WHY (reason/context, if provided)
- HOW (action type: API call, UI interaction, batch job)

This is non-negotiable and built into the data layer, not added retroactively.

### 2. **Role-Based Access Control (RBAC)**
- Users belong to roles: Employee, Manager, HR, Finance, Admin, Executive
- Roles have permissions: read, create, update, delete, approve, export
- Permissions are fine-grained per module and per entity type
- RBAC is enforced at API boundary, not just UI layer
- Roles can be customized per department/team
- No hardcoded role checks in business logic; use permission middleware

### 3. **Data Integrity & Consistency**
- Single source of truth (backend API)
- Eventual consistency acceptable only for secondary analytics views
- Optimistic locking for concurrent edits
- Transaction boundaries clearly defined per business flow
- Referential integrity at database level
- Soft deletes for staff, projects, and financial records (audit trail)

### 4. **User Experience (Internal Staff)**
- Simple, fast, predictable workflows
- Mobile-friendly (staff checking attendance on phones)
- Offline read mode for critical views (dashboards, schedules)
- Accessible (WCAG 2.1 AA minimum)
- Keyboard-navigable for power users
- Real-time notifications for approvals, announcements

### 5. **Security**
- OAuth 2.0 for authentication (Google account)
- JWT for session management (short-lived access token + long-lived refresh token)
- HTTPS everywhere
- CORS properly scoped
- Input validation on both client and server
- No sensitive data in URLs or logs
- Password-less by default (SSO only)

### 6. **Scalability**
- Horizontal scaling for stateless API
- Database connection pooling
- Caching strategy for reference data (roles, departments, employees)
- API response pagination (no unbounded lists)
- Analytics/reports use separate read-replica or data warehouse
- Frontend lazy loading and code splitting by feature
- No client-side pagination of >1000 records

### 7. **Observability**
- Structured logging (JSON format)
- All API requests logged with timing and outcome
- Error tracking and alerting
- Performance monitoring (APM)
- User activity tracking (feature usage, not surveillance)
- Dashboard for operational health

### 8. **Maintainability**
- Clear separation of concerns
- Domain-driven folder structure
- Type safety (TypeScript in frontend)
- Comprehensive API documentation
- Automated testing (unit, integration, E2E)
- Code review process before production
- Database schema versioning

---

## Technology Stack

### Frontend
| Component | Technology | Version | Rationale |
|-----------|-----------|---------|-----------|
| Runtime | React | 19.2.x | Latest stable, server components ready |
| Build Tool | Vite | 8.x | Fast dev/build, best-in-class DX |
| Styling | Tailwind CSS | 3.x | Utility-first, low-overhead themes |
| UI Components | CoreUI React | 5.10.x | Pre-built admin patterns (use as starter only) |
| Icons | CoreUI Icons | 3.x | Consistent icon set |
| Routing | React Router | 7.x | Standard client-side routing with data fetching |
| State | Redux Toolkit + RTK Query | Latest | Structured state + server state management |
| Forms | React Hook Form + Zod | Latest | Type-safe form validation |
| HTTP Client | Axios + RTK Query | Latest | Automatic retry, caching, request deduplication |
| Date Handling | date-fns | Latest | Lightweight, tree-shakeable |
| Charts | Chart.js + React Wrapper | 4.x | Lightweight, no vendor lock-in |
| Tables | TanStack Table (headless) | 8.x | Powerful, unstyled, composable |
| Notifications | Custom hook + Toast Provider | - | Simple, predictable, accessible |
| Testing | Vitest + Testing Library | Latest | Fast, React-native testing |
| Linting | ESLint + Prettier | Latest | Code quality and formatting |
| Type Checking | TypeScript | 5.x | Gradual adoption starting with shared types |

### Backend
| Component | Technology | Version | Rationale |
|-----------|-----------|---------|-----------|
| Framework | FastAPI | 0.100+ | Async, fast, built-in OpenAPI |
| Web Server | Uvicorn | Latest | Production-grade ASGI server |
| Database | PostgreSQL | 14+ | Reliable, rich data types, JSON support |
| ORM | SQLAlchemy | 2.x | Type-safe, declarative schemas |
| Auth | python-jose + passlib | Latest | JWT encoding/verification, password hashing |
| Validation | Pydantic | 2.x | Schema validation, OpenAPI integration |
| Logging | structlog | Latest | Structured logging for observability |
| Testing | pytest + pytest-asyncio | Latest | Comprehensive async testing |
| Async Job Queue | Celery + Redis | Latest | For report generation, batch processing |
| Email | aiosmtplib | Latest | Async email (announcements, alerts) |

### Database
| Component | Technology | Version | Rationale |
|-----------|-----------|---------|-----------|
| Primary | PostgreSQL on Supabase | 14+ | Managed, built-in auth, realtime |
| Caching | Redis (Elasticache) | 7.x | Session storage, rate limiting, caching |
| Full-Text Search | PostgreSQL FTS | Native | Fast text search on announcements |
| Audit Table | PostgreSQL Triggers | Native | Immutable audit log per table |

### Infrastructure & DevOps
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Container Registry | AWS ECR | Native AWS integration |
| Compute | AWS ECS Fargate | Serverless containers, no ops |
| Load Balancer | AWS ALB | Application-level routing, health checks |
| CDN | CloudFront | Cache static assets, compress |
| Storage | S3 (for exports, archives) | Durable, scalable, versioned |
| Monitoring | CloudWatch + Datadog | Logs, metrics, alerts, APM |
| CI/CD | GitHub Actions | Native GitHub integration |
| IaC | Terraform | Reproducible, version-controlled infra |
| Secrets | AWS Secrets Manager | Centralized secret rotation |

---

## System Architecture

### High-Level Data Flow

```
┌─────────────────┐
│  User Browser   │
│  (React SPA)    │
└────────┬────────┘
         │ HTTPS + OAuth
         ▼
┌─────────────────────────────┐
│  AWS CloudFront (CDN)       │
│  + AWS ALB (Load Balancer)  │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  ECS Fargate Cluster (API Replicas)     │
│  ┌─────────────────────────────────────┐│
│  │ FastAPI App (Async)                 ││
│  │ - Auth Middleware                   ││
│  │ - RBAC Middleware                   ││
│  │ - Audit Logger Middleware           ││
│  │ - API Endpoints by Module           ││
│  └─────────────────────────────────────┘│
└────────┬────────────────────────────────┘
         │
    ┌────┴────┬──────────┐
    │          │          │
    ▼          ▼          ▼
┌────────┐ ┌───────┐ ┌───────┐
│ Primary │ │Replica│ │ Cache │
│   DB    │ │  DB   │ │Redis  │
└────────┘ └───────┘ └───────┘
```

### Request-Response Lifecycle

1. **Authentication Phase**
   - User logs in via Google OAuth
   - Backend exchanges code for Google tokens
   - Backend generates JWT (access + refresh token)
   - Tokens stored in secure httpOnly cookies

2. **Authorization Phase**
   - Each request includes JWT in Authorization header
   - Middleware validates JWT signature and expiry
   - Middleware checks user's roles and permissions
   - If insufficient permission, return 403

3. **Business Logic Phase**
   - Endpoint processes request (create, read, update, delete)
   - All mutations wrapped in database transaction
   - Audit logger captures change details

4. **Audit Logging Phase**
   - Audit entry created in `audit_log` table
   - Entry includes user, action, timestamp, old/new values
   - Audit entry immutable (no updates, rare deletes)

5. **Response Phase**
   - Result serialized to JSON
   - Metadata included (timestamp, request ID, version)
   - Compressed (gzip) and sent to client

6. **Cache Invalidation Phase**
   - If mutation affected cached data, invalidate cache key
   - RTK Query on frontend auto-refetches affected queries

### Deployment Topology

```
Region: us-east-1 (Primary)
├─ VPC
│  ├─ Public Subnet (ALB)
│  ├─ Private Subnet (ECS Fargate)
│  │  ├─ API Replica 1
│  │  ├─ API Replica 2
│  │  └─ API Replica 3
│  └─ Private Subnet (Databases)
│     ├─ RDS Primary (PostgreSQL)
│     ├─ RDS Replica (Read-only)
│     └─ ElastiCache (Redis)
├─ CloudFront Distribution
├─ S3 Bucket (Static assets, exports)
├─ CloudWatch Logs
└─ Secrets Manager

Region: us-west-2 (Backup/DR)
└─ RDS Read Replica (cross-region)
```

---

## Module Architecture

### Module Patterns

Each business module follows a consistent pattern:

```
Domain/Module
├── Frontend (React)
│   ├── pages/              # Page-level components
│   ├── components/         # Reusable UI components
│   ├── hooks/              # Custom hooks (queries, mutations)
│   ├── store/              # Redux slices for state
│   ├── types/              # TypeScript types
│   └── services/           # API client methods
├── Backend (FastAPI)
│   ├── models.py           # SQLAlchemy ORM models
│   ├── schemas.py          # Pydantic request/response schemas
│   ├── router.py           # API endpoint definitions
│   ├── service.py          # Business logic
│   ├── dependencies.py     # DI (auth, validation)
│   └── permissions.py      # Permission checks
└── Database
    ├── migrations/         # Alembic schema changes
    ├── tables.sql          # DDL + indexes + triggers
    └── seed_data.sql       # Reference data (roles, departments)
```

### Module 1: Dashboard

**Purpose:** Operational command center showing real-time KPIs, task queue, and alerts.

**Key Features:**
- KPI cards (headcount, active projects, pending approvals, budget status)
- Task queue (my approvals pending, my requests pending)
- Announcements feed
- Attendance heatmap
- Project status overview
- Expense summary (pending reimbursements)

**Roles with Dashboard Access:** All (customized per role)

**Data Model:**
- Aggregated views (no raw transaction display)
- Real-time for critical alerts, hourly refresh for metrics
- Caches computed metrics (e.g., pending approvals count) for <100ms response

**Backend:**
- GET `/api/dashboard/metrics` → aggregated data
- GET `/api/dashboard/tasks` → user's pending actions
- GET `/api/dashboard/alerts` → critical notifications

---

### Module 2: Projects

**Purpose:** Project lifecycle management from creation to closure.

**Key Features:**
- Create, read, update, delete projects
- Assign staff to projects (roles: lead, contributor)
- Track project status (planning, active, paused, completed, archived)
- Budget tracking per project
- Milestone tracking
- Project timeline view (Gantt-like)
- Filters by status, team, date range

**Roles & Permissions:**
- Employee: Read own projects
- Manager: Read/write projects in team, assign staff
- Admin: Full CRUD, bulk operations

**Data Model:**

```
Projects table:
- id (PK)
- name
- description
- status (planning, active, paused, completed, archived)
- budget_allocated (decimal)
- budget_spent (decimal)
- start_date
- end_date
- owner_id (FK to Users)
- department_id (FK to Departments)
- created_at
- updated_at
- created_by (FK to Users)
- updated_by (FK to Users)

Project_Members table:
- id (PK)
- project_id (FK)
- user_id (FK)
- role (lead, contributor, observer)
- hours_allocated (per sprint or total)
- started_at
- ended_at

Project_Milestones table:
- id (PK)
- project_id (FK)
- name
- due_date
- status (pending, in_progress, completed)
- created_at
- updated_at
```

**Backend Endpoints:**
- GET `/api/projects` → list with pagination, filters
- POST `/api/projects` → create
- GET `/api/projects/{id}` → detail
- PUT `/api/projects/{id}` → update
- DELETE `/api/projects/{id}` → soft delete
- POST `/api/projects/{id}/members` → assign staff
- GET `/api/projects/{id}/timeline` → Gantt data
- GET `/api/projects/{id}/budget` → budget detail

**Audit Requirements:**
- Track project status changes with reason
- Track budget updates (alerts if exceed 90%)
- Track staff assignments/removals

---

### Module 3: Staff & Payroll

**Purpose:** Employee records, compensation, and payroll execution.

**Key Features:**
- Employee profiles (personal info, designation, department)
- Compensation management (salary, benefits, allowances, deductions)
- Payroll processing (monthly payroll runs, payment history)
- Salary slips (PDF generation)
- Tax configuration (IT, CT, etc.)
- Bank account management
- Leave balance tracking

**Roles & Permissions:**
- Employee: Read own profile, read own salary slip
- Manager: Read team profiles, approve timesheets (indirect)
- HR: Full CRUD, payroll admin
- Finance: Read/confirm payroll, payment approvals
- Admin: Full CRUD, batch imports

**Data Model:**

```
Users table:
- id (PK)
- email (unique, indexed)
- first_name
- last_name
- employee_id (unique)
- designation_id (FK)
- department_id (FK)
- manager_id (FK to Users)
- employment_type (full_time, part_time, contract)
- date_of_joining
- date_of_exit (nullable, for alumni)
- status (active, on_leave, inactive, terminated)
- phone
- address
- created_at
- updated_at

Compensations table:
- id (PK)
- user_id (FK)
- salary_amount
- effective_from
- effective_to (nullable)
- created_at
- updated_at
- approved_by (FK to Users)
- approved_at

Payroll_Runs table:
- id (PK)
- month_year (YYYY-MM)
- status (draft, locked, processed, paid, archived)
- total_payroll_amount
- created_at
- created_by (FK)
- locked_at
- locked_by (FK)
- processed_at
- processed_by (FK)

Salary_Slips table:
- id (PK)
- payroll_run_id (FK)
- user_id (FK)
- gross_salary
- deductions_total
- net_salary
- generated_at
- pdf_url (S3 path)

Audit trail captures: salary changes, payroll lock, payment approval
```

**Backend Endpoints:**
- GET `/api/employees` → list (HR/Finance only, with filters)
- POST `/api/employees` → create new employee
- GET `/api/employees/{id}` → employee detail
- PUT `/api/employees/{id}` → update
- GET `/api/employees/{id}/compensation` → salary history
- POST `/api/compensation` → set/update salary (audit tracked)
- GET `/api/payroll/runs` → list payroll runs
- POST `/api/payroll/runs` → create new payroll run (locked from editing)
- PUT `/api/payroll/runs/{id}/lock` → lock for processing
- PUT `/api/payroll/runs/{id}/process` → execute payroll
- GET `/api/salary-slip/{id}` → individual slip (PDF or JSON)

**Audit Requirements:**
- All salary changes logged with approver
- Payroll run locks immutable
- Payment confirmations logged
- Slip generation logged

---

### Module 4: Attendance

**Purpose:** Track work time, leave, and attendance patterns.

**Key Features:**
- Daily check-in/check-out (mobile-friendly)
- Leave request workflow (apply, approve, reject)
- Leave balance tracking (annual, sick, unpaid)
- Attendance reports (by employee, by department)
- Late arrival alerts
- Absence alerts
- Monthly attendance summary

**Roles & Permissions:**
- Employee: Check in/out, request leave, view own attendance
- Manager: Approve/reject team leave, view team attendance
- HR: Full CRUD, bulk uploads, leave policy management
- Admin: Full CRUD, override attendance

**Data Model:**

```
Attendance_Records table:
- id (PK)
- user_id (FK)
- attendance_date (date)
- check_in_time (timestamp)
- check_out_time (timestamp)
- total_hours (computed)
- status (present, absent, half_day, sick_leave, casual_leave, paid_leave, unpaid_leave)
- notes (optional, why absent)
- created_at
- updated_at

Leave_Requests table:
- id (PK)
- user_id (FK)
- leave_type_id (FK)
- start_date (date)
- end_date (date)
- reason (text)
- status (pending, approved, rejected, cancelled)
- requested_at
- created_by (user_id)
- approved_by (FK to Users, nullable)
- approved_at (nullable)
- rejection_reason (nullable)
- created_at
- updated_at

Leave_Balances table:
- id (PK)
- user_id (FK)
- leave_type_id (FK)
- year (YYYY)
- total_entitlement
- used_count
- balance_count
- last_updated_at

Leave_Types table:
- id (PK)
- name (Annual, Sick, Casual, Unpaid, Maternity, etc.)
- max_days_per_year
- carryover_allowed
- requires_approval
- created_at
```

**Backend Endpoints:**
- POST `/api/attendance/checkin` → record check-in
- POST `/api/attendance/checkout` → record check-out
- GET `/api/attendance?date_range=...&user_id=...` → records
- GET `/api/attendance/summary/{user_id}?month=...` → monthly summary
- POST `/api/leave/request` → apply for leave
- GET `/api/leave/requests?status=pending` → pending requests (for manager)
- PUT `/api/leave/requests/{id}/approve` → approve
- PUT `/api/leave/requests/{id}/reject` → reject
- GET `/api/leave/balance/{user_id}` → current balance
- GET `/api/attendance/report?from=...&to=...` → export

**Audit Requirements:**
- Attendance corrections logged (who changed, when, reason)
- Leave approvals logged with approver
- Leave balance reconciliation audit trail

---

### Module 5: Announcements

**Purpose:** Internal communication channel for company-wide and department-specific updates.

**Key Features:**
- Create announcements (company-wide, department, team)
- Rich text editor (markdown or WYSIWYG)
- Schedule announcements (publish at specific time)
- View history and revisions
- Mark as read
- Search announcements
- Pin important announcements
- Email notifications (optional)

**Roles & Permissions:**
- Employee: Read, mark as read
- Manager: Create team announcements
- HR: Create company-wide announcements
- Admin: Full CRUD, email management

**Data Model:**

```
Announcements table:
- id (PK)
- title
- content (markdown or HTML)
- scope (company_wide, department, team)
- target_department_id (FK, nullable if company-wide)
- target_team_id (FK, nullable)
- created_by (FK to Users)
- published_at (timestamp, nullable if scheduled)
- scheduled_for (timestamp, nullable)
- expires_at (timestamp, nullable)
- is_pinned (boolean)
- created_at
- updated_at

Announcement_Reads table:
- id (PK)
- announcement_id (FK)
- user_id (FK)
- read_at (timestamp)
- created_at

Announcement_Revisions table:
- id (PK)
- announcement_id (FK)
- content_before
- content_after
- edited_by (FK to Users)
- edited_at
```

**Backend Endpoints:**
- GET `/api/announcements?scope=...&limit=...` → list (paginated, cached)
- POST `/api/announcements` → create
- PUT `/api/announcements/{id}` → update (creates revision)
- DELETE `/api/announcements/{id}` → soft delete
- POST `/api/announcements/{id}/read` → mark as read
- PUT `/api/announcements/{id}/pin` → pin
- GET `/api/announcements/{id}/revisions` → history

**Audit Requirements:**
- Track announcement creation and edits
- Track who read (for important announcements)

---

### Module 6: Reports & Analysis

**Purpose:** Business intelligence, dashboards, and data exports.

**Key Features:**
- Pre-built reports (headcount, payroll summary, attendance trends, project status, expense summary)
- Custom report builder (select fields, filters, date ranges, export format)
- Report scheduling (auto-generate and email)
- Data export (CSV, Excel, PDF)
- Charts and visualizations
- Drill-down capability (click metric to see details)

**Roles & Permissions:**
- Employee: View personal data reports (own attendance, own expenses)
- Manager: View team reports
- HR/Finance: Full access to all reports, can schedule
- Executive: Pre-built KPI dashboards only (read-only)
- Admin: Full CRUD, export data

**Data Model:**

```
Reports table:
- id (PK)
- name
- description
- report_type (pre_built, custom)
- owner_id (FK)
- query_definition (JSON: fields, filters, group_by, order_by)
- last_run_at
- last_run_by (FK)
- created_at
- updated_at

Report_Schedules table:
- id (PK)
- report_id (FK)
- frequency (daily, weekly, monthly)
- day_of_week (if weekly)
- day_of_month (if monthly)
- time_of_day
- recipients (comma-separated emails or FK to UserGroups)
- format (csv, xlsx, pdf)
- is_active
- created_at
- updated_at
- created_by (FK)

Report_Exports table:
- id (PK)
- report_id (FK)
- generated_at
- generated_by (FK)
- file_url (S3)
- row_count
- format
- created_at
```

**Pre-Built Reports:**
1. **Headcount Report:** Total employees, by department, by status (active/inactive/on_leave)
2. **Payroll Summary:** Total cost, by department, average salary, top earners
3. **Attendance Trends:** Daily average attendance, late arrivals count, absentees, leave breakdown
4. **Project Status:** Active projects, on-time vs delayed, budget variance, team utilization
5. **Expense Summary:** Total expenses, by category, pending reimbursements, approval pending
6. **Leave Trends:** Leave usage by type, by department, balance forecast

**Backend Endpoints:**
- GET `/api/reports` → list available reports
- POST `/api/reports` → create custom report
- GET `/api/reports/{id}/run` → execute report (returns data)
- GET `/api/reports/{id}/export?format=csv` → export
- POST `/api/reports/{id}/schedule` → schedule auto-generation
- GET `/api/reports/{id}/export-history` → past exports

**Audit Requirements:**
- Track report runs, who ran it, when, query params
- Track exports (data accessed by whom)

---

### Module 7: Expense Management

**Purpose:** Employee expense reimbursement workflow.

**Key Features:**
- Submit expense claims (single or multi-receipt)
- Expense categories (travel, meals, accommodation, tools, other)
- Receipt upload (image, PDF)
- Approval workflow (manager, finance)
- Reimbursement tracking
- Department/project allocation
- Expense policies (per diem limits, approval thresholds)

**Roles & Permissions:**
- Employee: Submit own expenses, view own claims
- Manager: Approve/reject team expenses (up to budget limit)
- Finance: Approve large expenses, process reimbursements
- Admin: Full CRUD, policy management

**Data Model:**

```
Expense_Claims table:
- id (PK)
- user_id (FK)
- claim_date (when submitted)
- claim_period_from (date)
- claim_period_to (date)
- status (draft, submitted, manager_review, finance_review, approved, rejected, reimbursed, archived)
- total_amount
- currency
- description
- created_at
- updated_at
- submitted_by (user_id)
- submitted_at

Expense_Items table:
- id (PK)
- expense_claim_id (FK)
- category_id (FK)
- description
- amount
- transaction_date (date)
- receipt_url (S3)
- notes
- created_at
- updated_at

Expense_Approvals table:
- id (PK)
- expense_claim_id (FK)
- approval_level (manager, finance)
- approved_by (FK to Users)
- approved_at
- status (approved, rejected)
- comments (rejection reason or approval notes)
- created_at

Expense_Reimbursements table:
- id (PK)
- expense_claim_id (FK)
- amount_reimbursed
- payment_method (bank_transfer, check, other)
- payment_reference
- paid_by (FK)
- paid_at
- created_at
```

**Backend Endpoints:**
- POST `/api/expenses/claim` → create claim
- POST `/api/expenses/claim/{id}/item` → add expense item
- POST `/api/expenses/claim/{id}/submit` → submit for approval
- GET `/api/expenses/claims?status=...` → list
- PUT `/api/expenses/claim/{id}/approve` → approve
- PUT `/api/expenses/claim/{id}/reject` → reject
- POST `/api/expenses/claim/{id}/reimburse` → mark as reimbursed
- GET `/api/expenses/report?from=...&to=...` → summary report

**Audit Requirements:**
- Track approval decisions with approver
- Track status transitions
- Receipt uploads logged

---

### Module 8: Personal Profile

**Purpose:** Self-service employee portal for personal data and preferences.

**Key Features:**
- View/edit personal information (address, phone, emergency contacts)
- Update profile picture
- Change password (if applicable)
- Set notification preferences
- Download payslips
- View leave balance
- View attendance history
- Download documents (offer letter, appointment letter, etc.)

**Roles & Permissions:**
- Employee: Full edit own profile
- Manager: View team member profiles (read-only)
- HR: Edit employee profiles (for admin corrections)
- Admin: Full CRUD

**Data Model:**

```
User_Profiles table:
- id (PK)
- user_id (FK)
- phone_number
- address_line_1
- address_line_2
- city
- state
- postal_code
- country
- emergency_contact_name
- emergency_contact_phone
- emergency_contact_relation
- profile_picture_url (S3)
- bio (optional)
- social_links (JSON: LinkedIn, GitHub, etc.)
- created_at
- updated_at

User_Preferences table:
- id (PK)
- user_id (FK)
- receive_announcements_email (boolean)
- receive_approval_notifications (boolean)
- receive_digest (daily, weekly, none)
- locale (en, es, fr, etc.)
- theme (light, dark, auto)
- timezone
- created_at
- updated_at

User_Documents table:
- id (PK)
- user_id (FK)
- document_type (offer_letter, appointment_letter, salary_slip, payroll_stub, etc.)
- document_date (date)
- file_url (S3)
- created_at
```

**Backend Endpoints:**
- GET `/api/profile/me` → current user's profile
- PUT `/api/profile/me` → update profile
- POST `/api/profile/me/picture` → upload profile picture
- GET `/api/profile/me/preferences` → preferences
- PUT `/api/profile/me/preferences` → update preferences
- GET `/api/profile/me/documents` → list available documents
- GET `/api/profile/me/payslips?year=...` → salary slips
- GET `/api/profile/{id}` → view another user's profile (if permitted)

**Audit Requirements:**
- Track profile edits (what changed, by whom if by HR)
- Track document access (who downloaded what)

---

## Authentication & Authorization

### OAuth 2.0 + JWT Architecture

**Flow:**
1. User accesses frontend at `https://ems.hma.internal`
2. Frontend detects no JWT → redirects to `/auth/login`
3. Login page shows "Sign in with Google"
4. User clicks → frontend redirects to backend OAuth callback: `/auth/google?redirect_uri=...`
5. Backend redirects to Google OAuth consent screen
6. User authorizes HMA EMS to access Google profile (email, name)
7. Google redirects back to backend with authorization code
8. Backend exchanges code for Google tokens
9. Backend validates email domain is `@hma.com` (only HMA staff allowed)
10. Backend creates/updates user in local database (first login: create; subsequent: update last_login)
11. Backend generates JWT tokens:
    - **Access token:** 15 minutes expiry, payload includes user_id, roles, permissions
    - **Refresh token:** 7 days expiry, payload includes user_id, version
12. Backend sets tokens in httpOnly cookies (secure, sameSite=Strict)
13. Backend redirects to frontend homepage
14. Frontend extracts user info from JWT and initializes app state

**Token Refresh:**
- Frontend automatically uses refresh token to get new access token before expiry
- Refresh endpoint: `POST /auth/refresh`
- If refresh token expired, user directed to login again

### RBAC Model

**Roles (Database-driven):**
```
Roles:
- EMPLOYEE (default)
- MANAGER
- HR
- FINANCE
- ADMIN
- EXECUTIVE
```

**Permissions (Attached to roles, not users directly):**
```
Permissions format: resource:action

Example permissions:
- projects:read
- projects:create
- projects:update
- projects:delete
- projects:budget_override (only finance)
- staff:read_all
- staff:read_own
- staff:update_own
- staff:update_any
- staff:delete
- payroll:read
- payroll:process (only finance+hr)
- payroll:approve (only finance)
- attendance:read_own
- attendance:read_team
- attendance:read_all
- attendance:checkin
- attendance:approve_leave
- expenses:submit
- expenses:approve_manager
- expenses:approve_finance
- expenses:reimburse
- reports:read_own
- reports:read_all
- reports:create_custom
- announcements:read
- announcements:create_team
- announcements:create_company (HR only)
- audit:read (HR+Admin only)
```

**Permission Enforcement:**
- Checked at API middleware layer (before business logic)
- If user lacks permission → return 403 Forbidden with clear error message
- All permission checks logged in audit trail

**Custom Roles:**
- Departments can create custom roles (e.g., "Team Lead", "Project Manager")
- Custom roles inherit permissions from parent role or have explicit permissions
- Custom role changes require admin approval

### Session Management

- Sessions stored in Redis (distributed, fast)
- Session expires after 30 days of inactivity
- Explicit logout clears session
- Force logout available for admin (e.g., terminating employee immediately)

---

## Data Architecture

### Database Schema Organization

**Schemas (PostgreSQL):**
- `public` → core application tables
- `audit` → audit log tables (separate for performance)
- `analytics` → materialized views for reporting

**Core Tables:**
```
public schema:
├── Users (employee records)
├── Roles
├── Permissions
├── Role_Permissions (junction)
├── Departments
├── Designations
├── Projects
├── Project_Members
├── Project_Milestones
├── Compensations
├── Payroll_Runs
├── Salary_Slips
├── Attendance_Records
├── Leave_Requests
├── Leave_Types
├── Leave_Balances
├── Announcements
├── Announcement_Reads
├── Announcement_Revisions
├── Expense_Claims
├── Expense_Items
├── Expense_Approvals
├── Expense_Reimbursements
├── User_Profiles
├── User_Preferences
└── User_Documents
```

### Audit Log Strategy

**Audit Tables (in `audit` schema):**
```
audit.log (immutable, append-only):
- id (PK)
- entity_type (User, Project, PayrollRun, ExpenseClaim, etc.)
- entity_id (FK to entity)
- action (CREATE, READ, UPDATE, DELETE, APPROVE, REJECT, PROCESS)
- user_id (FK to Users, who performed action)
- timestamp (when)
- ip_address
- user_agent
- old_values (JSON, for UPDATE)
- new_values (JSON, for UPDATE)
- reason (why, for approvals)
- status (success, failure)
- error_message (if failure)
- metadata (JSON, extra context)

Example row:
{
  "entity_type": "ExpenseClaim",
  "entity_id": 42,
  "action": "UPDATE",
  "user_id": 5,
  "timestamp": "2026-06-11T10:30:00Z",
  "old_values": {"status": "submitted"},
  "new_values": {"status": "approved"},
  "reason": "Approved by finance team"
}
```

**Triggers (PostgreSQL):**
For each mutable table, a trigger automatically logs:
- INSERT → audit log entry with new_values
- UPDATE → audit log entry with old_values + new_values
- DELETE → audit log entry with old_values (no actual deletion, soft delete instead)

**Audit Access:**
- Read-only for all users (no modification, deletion)
- Accessible via API endpoint `/api/audit?entity_type=...&entity_id=...`
- Only HR, Finance, Admin can access audit logs (permission gated)

### Data Relationships

**Key Constraints:**
- User → Manager (self-referential FK, nullable for C-level)
- User → Department
- User → Designation
- Project → Department (owned by)
- Project → User (owner)
- Project_Members → Project + User
- Compensation → User (one active per user at a time)
- PayrollRun → none (reference data)
- Salary_Slip → PayrollRun + User
- Attendance_Record → User + date (unique constraint)
- Leave_Request → User + LeaveType
- Leave_Balance → User + LeaveType + year (unique)
- Announcement → User (created_by) + Department (nullable)
- Expense_Claim → User (submitter)
- Expense_Item → ExpenseClaim + ExpenseCategory

### Caching Strategy

**Redis Keys:**
- `user:{user_id}` → user profile (TTL: 1 hour)
- `role:{role_id}` → role permissions (TTL: 24 hours)
- `department:{dept_id}` → department info (TTL: 24 hours)
- `leaderboard:top_projects` → trending projects (TTL: 6 hours)
- `dashboard:metrics:{user_id}` → user's dashboard data (TTL: 10 minutes)

**Cache Invalidation:**
- On UPDATE/DELETE, invalidate all related keys
- Use Redis Pub/Sub to notify all API instances of cache invalidation
- No stale cache during concurrent updates

### Database Performance

**Indexes:**
- Composite indexes on frequently filtered columns
  - attendance: `(user_id, attendance_date DESC)`
  - expense_claims: `(user_id, status, created_at DESC)`
  - announcements: `(scope, published_at DESC)`
- Full-text search indexes on announcement content and titles
- Partial indexes for active records (WHERE deleted_at IS NULL)

**Query Optimization:**
- N+1 query prevention: always use JOINs, never loop-fetch
- Pagination limit: max 1000 records per request (default 50)
- Denormalization for hot data (e.g., user.department_name cached)

---

## API Design Patterns

### RESTful Conventions

**Endpoint Structure:**
```
GET    /api/{module}/{resource}              # List with filters, sorting, pagination
POST   /api/{module}/{resource}              # Create new
GET    /api/{module}/{resource}/{id}         # Fetch detail
PUT    /api/{module}/{resource}/{id}         # Full replacement
PATCH  /api/{module}/{resource}/{id}         # Partial update
DELETE /api/{module}/{resource}/{id}         # Soft delete (audit logged)
```

**Examples:**
```
GET    /api/projects                         # List projects
POST   /api/projects                         # Create project
GET    /api/projects/{id}                    # Get project detail
PUT    /api/projects/{id}                    # Update project
DELETE /api/projects/{id}                    # Archive/delete project

GET    /api/projects/{id}/members            # List project members
POST   /api/projects/{id}/members            # Add member
DELETE /api/projects/{id}/members/{member}   # Remove member

GET    /api/employees/{id}/attendance?from=...&to=...
POST   /api/attendance/checkin               # Check in (action endpoint)
POST   /api/attendance/checkout              # Check out

POST   /api/leave/request                    # Submit leave request
PUT    /api/leave/request/{id}/approve       # Manager action
PUT    /api/leave/request/{id}/reject        # Manager action
```

### Request Format

**Query Parameters (for GET):**
- `limit` (default: 50, max: 1000)
- `offset` (default: 0)
- `sort_by` (default: created_at, format: `+field` for asc, `-field` for desc)
- `filter[field]=value` (repeatable for multiple filters)
- `search` (full-text search)

**Example:**
```
GET /api/projects?limit=20&offset=0&sort_by=-created_at&filter[status]=active&filter[department]=engineering
```

**Request Body (for POST/PUT):**
```json
{
  "name": "Project Alpha",
  "description": "...",
  "budget_allocated": 50000.00,
  "start_date": "2026-06-15",
  "end_date": "2026-12-31"
}
```

### Response Format

**Success (200, 201):**
```json
{
  "data": {
    "id": 123,
    "name": "Project Alpha",
    ...
  },
  "meta": {
    "timestamp": "2026-06-11T10:30:00Z",
    "request_id": "req_abc123xyz"
  }
}
```

**List (200):**
```json
{
  "data": [
    {...},
    {...}
  ],
  "pagination": {
    "total": 250,
    "limit": 50,
    "offset": 0,
    "has_more": true
  },
  "meta": {
    "timestamp": "2026-06-11T10:30:00Z",
    "request_id": "req_abc123xyz"
  }
}
```

**Error (4xx, 5xx):**
```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You do not have permission to approve this expense",
    "details": {
      "required_permission": "expenses:approve_finance",
      "user_roles": ["employee"]
    }
  },
  "meta": {
    "timestamp": "2026-06-11T10:30:00Z",
    "request_id": "req_abc123xyz"
  }
}
```

**Error Codes:**
- `BAD_REQUEST` (400): Validation failed
- `UNAUTHORIZED` (401): JWT expired or invalid
- `PERMISSION_DENIED` (403): User lacks permission
- `NOT_FOUND` (404): Resource doesn't exist
- `CONFLICT` (409): Constraint violation (e.g., duplicate email)
- `UNPROCESSABLE_ENTITY` (422): Business logic violation (e.g., insufficient leave balance)
- `RATE_LIMITED` (429): Too many requests
- `INTERNAL_ERROR` (500): Server error

### Versioning Strategy

**No URL versioning.**
- API is single version, backward compatibility maintained
- Deprecation warnings via response headers
- Breaking changes communicated 90 days in advance

---

## Frontend Architecture

### Project Structure

```
frontend/
├── public/                     # Static assets
│   └── index.html
├── src/
│   ├── index.jsx              # Entry point
│   ├── App.jsx                # Root component, theme setup
│   ├── auth/
│   │   ├── OAuthCallback.jsx  # Google OAuth callback handler
│   │   ├── LoginPage.jsx
│   │   ├── useAuth.ts         # Auth hook
│   │   ├── authApi.ts         # Auth API client
│   │   ├── authSlice.ts       # Redux auth state
│   │   └── ProtectedRoute.jsx # Route guard
│   ├── common/
│   │   ├── components/
│   │   │   ├── Layout.jsx     # Main app layout (sidebar, header, footer)
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── Breadcrumb.jsx
│   │   │   ├── Toast.jsx      # Notifications
│   │   │   ├── ErrorBoundary.jsx
│   │   │   └── LoadingSpinner.jsx
│   │   ├── hooks/
│   │   │   ├── useApi.ts      # Generic API hook
│   │   │   ├── useDebounce.ts
│   │   │   └── useLocalStorage.ts
│   │   ├── utils/
│   │   │   ├── formatters.ts  # Date, currency formatting
│   │   │   ├── validators.ts
│   │   │   └── constants.ts
│   │   └── types/
│   │       └── index.ts       # Shared TypeScript types
│   ├── store/
│   │   ├── index.ts           # Redux store setup
│   │   ├── authSlice.ts       # Redux slices
│   │   ├── uiSlice.ts
│   │   ├── notificationSlice.ts
│   │   └── api.ts             # RTK Query setup
│   ├── features/              # Feature modules (by domain)
│   │   ├── dashboard/
│   │   │   ├── pages/
│   │   │   │   └── Dashboard.jsx
│   │   │   ├── components/
│   │   │   │   ├── MetricsCard.jsx
│   │   │   │   ├── TaskQueue.jsx
│   │   │   │   └── AnnouncementsFeed.jsx
│   │   │   ├── hooks/
│   │   │   │   └── useDashboardData.ts
│   │   │   ├── api/
│   │   │   │   └── dashboardApi.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── dashboardSlice.ts
│   │   ├── projects/
│   │   │   ├── pages/
│   │   │   │   ├── ProjectsList.jsx
│   │   │   │   ├── ProjectDetail.jsx
│   │   │   │   └── ProjectForm.jsx
│   │   │   ├── components/
│   │   │   │   ├── ProjectCard.jsx
│   │   │   │   ├── TeamMemberList.jsx
│   │   │   │   └── BudgetTracker.jsx
│   │   │   ├── hooks/
│   │   │   │   ├── useProjects.ts
│   │   │   │   └── useProjectDetail.ts
│   │   │   ├── api/
│   │   │   │   └── projectsApi.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── projectsSlice.ts
│   │   ├── staff/
│   │   │   ├── pages/
│   │   │   │   ├── StaffList.jsx
│   │   │   │   ├── EmployeeDetail.jsx
│   │   │   │   └── StaffForm.jsx
│   │   │   ├── components/
│   │   │   │   └── CompensationHistory.jsx
│   │   │   ├── api/
│   │   │   │   └── staffApi.ts
│   │   │   └── types/
│   │   │       └── index.ts
│   │   ├── attendance/
│   │   │   ├── pages/
│   │   │   │   ├── CheckInOut.jsx
│   │   │   │   ├── LeaveRequest.jsx
│   │   │   │   ├── AttendanceReport.jsx
│   │   │   │   └── LeaveBalance.jsx
│   │   │   ├── components/
│   │   │   │   ├── CheckInButton.jsx
│   │   │   │   ├── LeaveRequestForm.jsx
│   │   │   │   └── AttendanceHeatmap.jsx
│   │   │   ├── api/
│   │   │   │   └── attendanceApi.ts
│   │   │   └── types/
│   │   │       └── index.ts
│   │   ├── expenses/
│   │   │   ├── pages/
│   │   │   │   ├── ExpensesList.jsx
│   │   │   │   ├── ExpenseForm.jsx
│   │   │   │   └── ExpenseDetail.jsx
│   │   │   ├── components/
│   │   │   │   ├── ReceiptUpload.jsx
│   │   │   │   └── ApprovalWorkflow.jsx
│   │   │   ├── api/
│   │   │   │   └── expensesApi.ts
│   │   │   └── types/
│   │   │       └── index.ts
│   │   ├── announcements/
│   │   │   ├── pages/
│   │   │   │   ├── AnnouncementsList.jsx
│   │   │   │   ├── AnnouncementForm.jsx
│   │   │   │   └── AnnouncementDetail.jsx
│   │   │   ├── api/
│   │   │   │   └── announcementsApi.ts
│   │   │   └── types/
│   │   │       └── index.ts
│   │   ├── reports/
│   │   │   ├── pages/
│   │   │   │   ├── ReportsList.jsx
│   │   │   │   ├── PreBuiltReports.jsx
│   │   │   │   └── CustomReportBuilder.jsx
│   │   │   ├── api/
│   │   │   │   └── reportsApi.ts
│   │   │   └── types/
│   │   │       └── index.ts
│   │   ├── payroll/
│   │   │   ├── pages/
│   │   │   │   ├── PayrollRuns.jsx
│   │   │   │   ├── SalarySlip.jsx
│   │   │   │   └── PayrollHistory.jsx
│   │   │   ├── api/
│   │   │   │   └── payrollApi.ts
│   │   │   └── types/
│   │   │       └── index.ts
│   │   ├── profile/
│   │   │   ├── pages/
│   │   │   │   ├── ProfilePage.jsx
│   │   │   │   └── PreferencesPage.jsx
│   │   │   ├── components/
│   │   │   │   └── ProfileForm.jsx
│   │   │   ├── api/
│   │   │   │   └── profileApi.ts
│   │   │   └── types/
│   │   │       └── index.ts
│   │   └── audit/ (HR/Admin only)
│   │       ├── pages/
│   │       │   └── AuditLog.jsx
│   │       ├── api/
│   │       │   └── auditApi.ts
│   │       └── types/
│   │           └── index.ts
│   ├── styles/
│   │   ├── tailwind.config.js
│   │   ├── globals.css
│   │   └── variables.css
│   └── vite-env.d.ts
├── index.html
├── vite.config.mjs
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── eslint.config.mjs
├── prettier.config.mjs
├── package.json
└── README.md
```

### State Management Strategy

**Redux Slices:**
1. `authSlice` → user identity, roles, permissions, JWT tokens
2. `uiSlice` → sidebar toggle, theme, language, modals state
3. `notificationSlice` → toast/notification queue
4. Feature-specific slices (if needed) → loaded on-demand

**RTK Query (Server State):**
- Define API endpoints per feature (dashboardApi, projectsApi, staffApi, etc.)
- Auto-caching, auto-refetch on mutation
- No manual data fetching or state management for async data
- Use `invalidatesTags` to auto-invalidate related queries after mutations

**Example:**
```typescript
// featuresApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export const projectsApi = createApi({
  reducerPath: 'projectsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/projects' }),
  tagTypes: ['Projects', 'ProjectMembers'],
  endpoints: (builder) => ({
    getProjects: builder.query({
      query: ({ limit = 50, offset = 0, status } = {}) =>
        `/projects?limit=${limit}&offset=${offset}${status ? `&filter[status]=${status}` : ''}`,
      providesTags: ['Projects'],
    }),
    getProjectDetail: builder.query({
      query: (id) => `/projects/${id}`,
      providesTags: (result, error, id) => [{ type: 'Projects', id }],
    }),
    createProject: builder.mutation({
      query: (body) => ({ url: '/projects', method: 'POST', body }),
      invalidatesTags: ['Projects'],
    }),
    updateProject: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/projects/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Projects', id }, 'Projects'],
    }),
  }),
})

export const {
  useGetProjectsQuery,
  useGetProjectDetailQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
} = projectsApi
```

### Component Patterns

**Page Components:**
- Top-level for a route
- Manage data loading, errors, permissions
- Delegate rendering to smaller components
- Handle common actions (search, filter, sort, pagination)

**Presentational Components:**
- Receive data via props
- No API calls or Redux dispatch
- Pure, testable, reusable
- CoreUI/Tailwind styled

**Hook Patterns:**
- Custom hooks for API calls (`useGetProjects`, `useCreateProject`)
- Custom hooks for business logic (`useLeaveBalance`, `useExpenseWorkflow`)
- Custom hooks for UI state (`useModal`, `useFormState`)

### Form Handling

**React Hook Form + Zod:**
```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const projectSchema = z.object({
  name: z.string().min(3, 'Project name required').max(100),
  description: z.string().optional(),
  budget_allocated: z.number().positive('Budget must be positive'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
})

type ProjectFormData = z.infer<typeof projectSchema>

function ProjectForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
  })
  const [createProject] = useCreateProjectMutation()

  const onSubmit = async (data: ProjectFormData) => {
    try {
      await createProject(data).unwrap()
      toast.success('Project created')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      {errors.name && <span>{errors.name.message}</span>}
      {/* ... */}
    </form>
  )
}
```

### Error Handling

**Global Error Boundary:**
- Catches unhandled errors in components
- Displays user-friendly message
- Logs to error tracking service (Sentry, Datadog)
- Provides "Report" button to send feedback

**API Error Handling:**
- RTK Query auto-handles errors
- Show toast notification with error message
- Log to console (dev) and error tracker (prod)
- Retry logic for network errors

**Form Validation:**
- Client-side validation (Zod schema)
- Server-side validation (FastAPI Pydantic)
- Display field-level errors
- Show summary of validation failures

### Performance Optimization

**Code Splitting:**
- Lazy load feature modules (projects, attendance, etc.)
- Separate bundle for auth vs. authenticated app
- Async route loading

**Rendering Optimization:**
- Memoize components (React.memo for presentational components)
- useCallback for stable function references
- Virtualized tables/lists (TanStack Virtual)

**Data Fetching:**
- RTK Query caching prevents redundant requests
- Pagination (max 1000 records)
- Lazy load related data (e.g., load team members on expand)

**Bundle Analysis:**
- Use `vite-plugin-visualization` to analyze bundle
- Remove unused CoreUI components
- Tree-shake unused utilities

---

## Audit & Compliance

### Audit Log Comprehensive Coverage

**Covered Actions:**
1. Authentication: Login, logout, failed login attempts, token refresh
2. Authorization: Permission denied attempts
3. Data mutations: Create, update, delete any business entity
4. Approvals: Approval/rejection with reason
5. Financial: Payroll processing, expense reimbursement
6. Configuration: Role changes, user deactivation, policy updates
7. Exports: Who exported data, when, what data

**Audit Log Fields:**
- `id` → unique identifier
- `timestamp` → when (UTC)
- `user_id` → who (FK to Users)
- `user_email` → for historical reference (user might be deleted)
- `action` → CREATE, READ, UPDATE, DELETE, APPROVE, REJECT, PROCESS, etc.
- `entity_type` → Project, User, PayrollRun, ExpenseClaim, etc.
- `entity_id` → which record
- `entity_summary` → brief text description (e.g., "Project: Alpha")
- `old_values` → previous state (JSON, for UPDATE)
- `new_values` → new state (JSON, for UPDATE)
- `reason` → why (for approvals, only if provided)
- `ip_address` → source IP
- `user_agent` → browser/client info
- `status` → success or failure
- `error_message` → if failed
- `metadata` → extra context (JSON, e.g., batch job ID, import filename)

**Audit Log Access:**
- Endpoint: `GET /api/audit/logs`
- Filters: entity_type, entity_id, user_id, action, date_range
- Export: CSV, JSON
- Access restricted to HR, Finance, Admin (role-gated)
- Audit log itself is audited (immutable table, no direct updates)

### Retention & Archival

- **Hot storage (active):** 1 year in PostgreSQL (fast access)
- **Warm storage (archive):** 3 years in S3 (compliance, slower access)
- **Purge policy:** Delete after 7 years (legal retention met)

### Compliance

**Standards Alignment:**
- **ISO 27001:** Information security management
  - Access control (RBAC)
  - Data protection (HTTPS, encryption at rest)
  - Incident logging (audit trail)
- **SOC 2 Type II:** Controls over security, availability, and data integrity
  - Regular backups (RDS automated snapshots)
  - Disaster recovery (cross-region replica)
  - Change management (audit log for config changes)
- **GDPR (if EU staff):** Right to be forgotten, data portability
  - Soft deletes (retain audit trail)
  - Data export endpoint `/api/profile/me/export` (JSON, all personal data)
  - Vendor agreements reviewed

---

## Scalability Strategy

### Horizontal Scaling

**Stateless API:**
- No session state in memory (stored in Redis)
- Multiple API instances behind load balancer
- Automatic failover if one instance dies

**Database Scaling:**
- Read replicas for reporting/analytics queries
- Write goes to primary
- Connection pooling (PgBouncer) to limit connections
- Caching layer (Redis) for hot data

**Frontend Scaling:**
- Static assets served via CloudFront CDN
- Browser caching headers (1-year for versioned assets)
- API responses cached per-user via RTK Query

### Load Capacity

**Estimated Capacity (with initial setup):**
- **Concurrent users:** 500+ (dashboard + real-time updates)
- **API throughput:** 1000+ requests/sec
- **Database:** 10,000+ transactions/min
- **Storage:** 500 GB year-1 (grows with reports, exports, receipts)

**Bottlenecks & Solutions:**
| Bottleneck | Current Limit | Solution |
|-----------|---------------|----------|
| API CPU | 4 vCPU (ECS task) | Auto-scale to 10+ replicas on CPU >70% |
| Database CPU | 4 vCPU (RDS) | Upgrade to 8 vCPU, read replicas for reports |
| Database Storage | 500 GB | Provision 1 TB initially, auto-scale |
| Network | 1 Gbps ALB | CloudFront caching reduces origin traffic |
| Cache | 512 MB Redis | Upgrade to 5+ GB if memory pressure >80% |

### Caching Layers

1. **Browser Cache:** Static assets (CSS, JS, images) cached 1 year
2. **CDN Cache:** Compressed assets served from edge locations
3. **API Response Cache:** RTK Query manages client-side data cache
4. **Redis Cache:** Hot reference data (user roles, departments, etc.)
5. **Database Query Cache:** Materialized views for frequent aggregations

### Async Processing

**Use Cases:**
- Report generation (long-running, non-blocking)
- Email notifications (batch send)
- Payroll processing (batch operation)
- Data exports (large volume)

**Architecture:**
- Task queue: Celery + Redis
- Job definition: Pydantic model
- Worker: Separate ECS task, scaled independently
- Status: User polls `/api/jobs/{id}/status` or receives webhook

**Example (Report Generation):**
```
1. User submits custom report request
2. API creates Job record (status=queued)
3. API returns Job ID to frontend
4. Frontend shows "Report generating..." with polling
5. Worker picks up job from queue
6. Worker executes report, uploads result to S3
7. Worker updates Job record (status=completed, result_url=...)
8. Frontend polls, sees completion, provides download link
```

---

## Folder Structure Redesign

### From CoreUI Template to EMS Architecture

**Current (CoreUI Template - Remove):**
```
src/
├── views/base/        # ← DELETE (demo components)
├── views/buttons/     # ← DELETE
├── views/icons/       # ← DELETE
├── views/notifications/  # ← DELETE
├── views/theme/       # ← DELETE
└── views/widgets/     # ← REVIEW (some reusable)
```

**Target (EMS Production):**
```
src/
├── index.jsx
├── App.jsx
├── auth/                    # Authentication & OAuth
│   ├── components/
│   │   ├── LoginPage.jsx
│   │   ├── OAuthCallback.jsx
│   │   └── ProtectedRoute.jsx
│   ├── hooks/
│   │   └── useAuth.ts
│   ├── store/
│   │   └── authSlice.ts
│   ├── types/
│   │   └── index.ts
│   └── services/
│       └── authService.ts
├── common/                  # Shared across all features
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── MainLayout.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── Footer.jsx
│   │   │   └── Breadcrumb.jsx
│   │   ├── Forms/
│   │   │   ├── FormField.jsx
│   │   │   ├── FormSection.jsx
│   │   │   └── FormError.jsx
│   │   ├── Tables/
│   │   │   ├── DataTable.jsx (reusable table wrapper)
│   │   │   ├── TablePagination.jsx
│   │   │   ├── TableFilters.jsx
│   │   │   └── TableActions.jsx
│   │   ├── Notifications/
│   │   │   ├── Toast.jsx
│   │   │   ├── ToastContainer.jsx
│   │   │   └── AlertBanner.jsx
│   │   ├── Cards/
│   │   │   ├── MetricCard.jsx
│   │   │   ├── StatsCard.jsx
│   │   │   └── ActionCard.jsx
│   │   ├── Modals/
│   │   │   ├── ConfirmDialog.jsx
│   │   │   ├── FormModal.jsx
│   │   │   └── DetailsModal.jsx
│   │   ├── Buttons/
│   │   │   ├── PrimaryButton.jsx
│   │   │   ├── SecondaryButton.jsx
│   │   │   └── ActionButton.jsx
│   │   └── Loading/
│   │       ├── LoadingSpinner.jsx
│   │       ├── SkeletonLoader.jsx
│   │       └── ErrorBoundary.jsx
│   ├── hooks/
│   │   ├── useApi.ts
│   │   ├── useDebounce.ts
│   │   ├── useLocalStorage.ts
│   │   ├── usePagination.ts
│   │   ├── useModal.ts
│   │   ├── useNotification.ts
│   │   └── usePermission.ts
│   ├── utils/
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   ├── constants.ts
│   │   ├── permissions.ts
│   │   └── api-client.ts
│   ├── types/
│   │   ├── index.ts (shared types)
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   └── ui.ts
│   └── styles/
│       ├── tailwind.config.js
│       ├── globals.css
│       └── theme.css
├── store/                   # Redux store
│   ├── index.ts
│   ├── authSlice.ts
│   ├── uiSlice.ts
│   ├── notificationSlice.ts
│   └── api.ts (RTK Query setup)
├── features/                # Feature modules (domain-driven)
│   ├── dashboard/
│   │   ├── pages/
│   │   │   └── Dashboard.jsx
│   │   ├── components/
│   │   │   ├── MetricsGrid.jsx
│   │   │   ├── TaskQueue.jsx
│   │   │   ├── AnnouncementsFeed.jsx
│   │   │   ├── ProjectsOverview.jsx
│   │   │   ├── AttendanceHeatmap.jsx
│   │   │   └── ExpenseSummary.jsx
│   │   ├── hooks/
│   │   │   └── useDashboardData.ts
│   │   ├── services/
│   │   │   └── dashboardApi.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── dashboardSlice.ts (if needed)
│   ├── projects/
│   │   ├── pages/
│   │   │   ├── ProjectsList.jsx
│   │   │   ├── ProjectDetail.jsx
│   │   │   └── ProjectForm.jsx
│   │   ├── components/
│   │   │   ├── ProjectCard.jsx
│   │   │   ├── ProjectFilters.jsx
│   │   │   ├── TeamMembersPanel.jsx
│   │   │   ├── BudgetTracker.jsx
│   │   │   ├── MilestonesList.jsx
│   │   │   └── ProjectTimeline.jsx
│   │   ├── hooks/
│   │   │   ├── useProjects.ts
│   │   │   ├── useProjectDetail.ts
│   │   │   └── useProjectMembers.ts
│   │   ├── services/
│   │   │   └── projectsApi.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── projectsSlice.ts
│   ├── staff/
│   │   ├── pages/
│   │   │   ├── StaffList.jsx
│   │   │   ├── EmployeeDetail.jsx
│   │   │   ├── StaffForm.jsx
│   │   │   ├── PayrollHistory.jsx
│   │   │   └── SalarySlip.jsx
│   │   ├── components/
│   │   │   ├── StaffTable.jsx
│   │   │   ├── EmployeeCard.jsx
│   │   │   ├── CompensationPanel.jsx
│   │   │   ├── DocumentsList.jsx
│   │   │   └── PayrollRunsList.jsx
│   │   ├── hooks/
│   │   │   ├── useStaff.ts
│   │   │   ├── useEmployeeDetail.ts
│   │   │   └── useCompensation.ts
│   │   ├── services/
│   │   │   └── staffApi.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── staffSlice.ts
│   ├── attendance/
│   │   ├── pages/
│   │   │   ├── CheckInOut.jsx
│   │   │   ├── LeaveRequest.jsx
│   │   │   ├── AttendanceReport.jsx
│   │   │   ├── LeaveBalance.jsx
│   │   │   └── LeaveHistory.jsx
│   │   ├── components/
│   │   │   ├── CheckInButton.jsx
│   │   │   ├── CheckOutButton.jsx
│   │   │   ├── LeaveRequestForm.jsx
│   │   │   ├── AttendanceTable.jsx
│   │   │   ├── AttendanceHeatmap.jsx
│   │   │   ├── LeaveBalanceCard.jsx
│   │   │   └── LeaveRequestsTable.jsx
│   │   ├── hooks/
│   │   │   ├── useAttendance.ts
│   │   │   ├── useCheckInOut.ts
│   │   │   ├── useLeaveRequest.ts
│   │   │   └── useLeaveBalance.ts
│   │   ├── services/
│   │   │   └── attendanceApi.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── attendanceSlice.ts
│   ├── expenses/
│   │   ├── pages/
│   │   │   ├── ExpensesList.jsx
│   │   │   ├── ExpenseForm.jsx
│   │   │   ├── ExpenseDetail.jsx
│   │   │   └── ExpenseApprovals.jsx
│   │   ├── components/
│   │   │   ├── ExpenseTable.jsx
│   │   │   ├── ExpenseCard.jsx
│   │   │   ├── ReceiptUpload.jsx
│   │   │   ├── ApprovalWorkflow.jsx
│   │   │   ├── ExpenseItemList.jsx
│   │   │   └── ExpenseSummary.jsx
│   │   ├── hooks/
│   │   │   ├── useExpenses.ts
│   │   │   ├── useExpenseForm.ts
│   │   │   └── useExpenseApprovals.ts
│   │   ├── services/
│   │   │   └── expensesApi.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── expensesSlice.ts
│   ├── announcements/
│   │   ├── pages/
│   │   │   ├── AnnouncementsList.jsx
│   │   │   ├── AnnouncementForm.jsx
│   │   │   └── AnnouncementDetail.jsx
│   │   ├── components/
│   │   │   ├── AnnouncementCard.jsx
│   │   │   ├── AnnouncementEditor.jsx
│   │   │   ├── AnnouncementFilters.jsx
│   │   │   └── AnnouncementSearch.jsx
│   │   ├── hooks/
│   │   │   ├── useAnnouncements.ts
│   │   │   └── useAnnouncementForm.ts
│   │   ├── services/
│   │   │   └── announcementsApi.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── announcementsSlice.ts
│   ├── reports/
│   │   ├── pages/
│   │   │   ├── ReportsList.jsx
│   │   │   ├── PreBuiltReports.jsx
│   │   │   ├── CustomReportBuilder.jsx
│   │   │   ├── ReportDetail.jsx
│   │   │   └── ReportScheduling.jsx
│   │   ├── components/
│   │   │   ├── ReportCard.jsx
│   │   │   ├── ReportFilters.jsx
│   │   │   ├── ReportBuilder.jsx
│   │   │   ├── ChartRenderer.jsx
│   │   │   ├── TableRenderer.jsx
│   │   │   ├── ReportExporter.jsx
│   │   │   └── ScheduleForm.jsx
│   │   ├── hooks/
│   │   │   ├── useReports.ts
│   │   │   ├── useReportDetail.ts
│   │   │   └── useReportExport.ts
│   │   ├── services/
│   │   │   └── reportsApi.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── reportsSlice.ts
│   ├── payroll/
│   │   ├── pages/
│   │   │   ├── PayrollRuns.jsx
│   │   │   ├── PayrollDetail.jsx
│   │   │   ├── SalarySlips.jsx
│   │   │   └── PayrollHistory.jsx
│   │   ├── components/
│   │   │   ├── PayrollRunsTable.jsx
│   │   │   ├── PayrollCard.jsx
│   │   │   ├── SalarySlipViewer.jsx
│   │   │   ├── PayrollSummary.jsx
│   │   │   └── PayrollApprovals.jsx
│   │   ├── hooks/
│   │   │   ├── usePayrollRuns.ts
│   │   │   ├── usePayrollDetail.ts
│   │   │   └── useSalarySlip.ts
│   │   ├── services/
│   │   │   └── payrollApi.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── payrollSlice.ts
│   ├── profile/
│   │   ├── pages/
│   │   │   ├── ProfilePage.jsx
│   │   │   ├── PreferencesPage.jsx
│   │   │   ├── SecurityPage.jsx
│   │   │   └── DocumentsPage.jsx
│   │   ├── components/
│   │   │   ├── ProfileForm.jsx
│   │   │   ├── ProfilePicture.jsx
│   │   │   ├── PreferencesForm.jsx
│   │   │   ├── SecuritySettings.jsx
│   │   │   └── DocumentsList.jsx
│   │   ├── hooks/
│   │   │   ├── useProfile.ts
│   │   │   ├── usePreferences.ts
│   │   │   └── useProfileUpdate.ts
│   │   ├── services/
│   │   │   └── profileApi.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── profileSlice.ts
│   ├── audit/ (HR/Admin)
│   │   ├── pages/
│   │   │   └── AuditLog.jsx
│   │   ├── components/
│   │   │   ├── AuditTable.jsx
│   │   │   ├── AuditFilters.jsx
│   │   │   └── AuditDetail.jsx
│   │   ├── hooks/
│   │   │   ├── useAuditLog.ts
│   │   │   └── useAuditExport.ts
│   │   ├── services/
│   │   │   └── auditApi.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── auditSlice.ts
│   └── admin/ (Admin only, if needed)
│       ├── pages/
│       │   ├── RolesManagement.jsx
│       │   ├── PermissionsManagement.jsx
│       │   ├── DepartmentsManagement.jsx
│       │   └── SystemSettings.jsx
│       ├── components/
│       │   ├── RolesTable.jsx
│       │   ├── PermissionsPanel.jsx
│       │   ├── DepartmentsTable.jsx
│       │   └── SettingsForm.jsx
│       ├── hooks/
│       │   ├── useRoles.ts
│       │   ├── usePermissions.ts
│       │   └── useDepartments.ts
│       ├── services/
│       │   └── adminApi.ts
│       ├── types/
│       │   └── index.ts
│       └── adminSlice.ts
├── styles/
│   ├── tailwind.config.js
│   ├── globals.css
│   ├── variables.css
│   ├── components.css
│   └── animations.css
├── vite-env.d.ts
└── public/
    ├── index.html
    ├── favicon.ico
    └── manifest.json
```

---

## Migration Plan

### Phase 0: Setup (Week 1-2)

**Objective:** Prepare development environment and tooling.

**Tasks:**
1. Initialize new frontend directory structure (as above)
2. Set up Vite + React 19 + TypeScript + Tailwind
3. Configure Redux + RTK Query
4. Install dev dependencies (testing, linting, formatting)
5. Create base layouts and styling
6. Set up GitHub Actions CI/CD pipeline
7. Create GitHub issues/PRs for tracking

**Deliverables:**
- Working development environment
- Empty pages for each feature module
- CI/CD pipeline

### Phase 1: Auth & Foundation (Week 3-4)

**Objective:** Secure authentication and core UI patterns.

**Tasks:**
1. Implement Google OAuth 2.0 flow
2. JWT token generation and refresh
3. ProtectedRoute component
4. Login/OAuth callback pages
5. Auth state management (Redux)
6. RBAC middleware and permission checking
7. Main layout (sidebar, header, breadcrumb, footer)
8. Reusable UI components (buttons, forms, tables, cards, modals)
9. Error boundary and error handling
10. API client setup with RTK Query

**Deliverables:**
- Users can log in via Google
- Protected routes enforced
- Basic admin dashboard accessible
- Reusable component library ready

### Phase 2: Core Modules (Week 5-10)

**Objective:** Build primary business modules.

**Tasks by Module:**

**Dashboard (Week 5):**
- KPI cards
- Task queue
- Recent announcements
- Real-time alerts

**Projects (Week 6-7):**
- List, create, detail, update pages
- Team member assignment
- Budget tracking
- Milestone tracking
- Timeline view

**Staff & Payroll (Week 7-8):**
- Employee list and detail
- Salary history
- Payroll runs (view only initially)
- Salary slip generation and download

**Attendance (Week 8-9):**
- Check-in/check-out
- Leave request form
- Attendance reports
- Leave balance display
- Approval workflow for managers

**Expenses (Week 9-10):**
- Expense claim form
- Receipt upload
- Approval workflow
- Reimbursement tracking

**Deliverables:**
- All core modules functional
- CRUD operations working
- Approval workflows in place
- Reports exportable

### Phase 3: Secondary Modules (Week 11-13)

**Objective:** Complete remaining features.

**Tasks:**

**Announcements (Week 11):**
- Create announcement page
- Announcement feed
- Search and filters
- Email notifications

**Reports & Analysis (Week 12):**
- Pre-built reports (headcount, payroll, attendance, projects, expenses)
- Custom report builder
- Report export (CSV, Excel, PDF)
- Chart visualizations
- Report scheduling

**Personal Profile (Week 12):**
- Profile edit page
- Preferences page
- Document management
- Password/security settings

**Audit & Admin (Week 13):**
- Audit log viewer
- Filters and search
- Export functionality
- System settings (roles, permissions, departments)

**Deliverables:**
- All modules complete
- User-facing feature complete
- Admin interfaces ready

### Phase 4: Polish & Optimization (Week 14-16)

**Objective:** Performance, security, testing, documentation.

**Tasks:**
1. End-to-end testing (Cypress/Playwright)
2. Unit tests for utilities and hooks
3. Performance optimization (code splitting, caching)
4. Security audit (CORS, CSP, input validation)
5. Accessibility audit (WCAG 2.1 AA)
6. User acceptance testing (UAT) with stakeholders
7. Documentation (API, component library, deployment)
8. Prepare production deployment

**Deliverables:**
- Test coverage >80%
- Performance budget met (<500ms API response, <2s bundle load)
- Zero critical security issues
- Accessibility score >90
- User manual and developer docs

### Phase 5: Launch & Training (Week 17-18)

**Objective:** Deploy to production and train users.

**Tasks:**
1. Data migration from legacy systems (if applicable)
2. Production deployment
3. Monitoring and alerting setup
4. User training sessions
5. Gather feedback and iterate

**Deliverables:**
- Live production system
- Monitoring dashboards
- User documentation
- Support playbook

---

## Development Phases

### Sprint Structure

**Typical 2-Week Sprint:**

**Week 1:**
- Mon-Tue: Sprint planning, define stories and acceptance criteria
- Wed-Fri: Development
- Fri PM: Code review and merge main branch

**Week 2:**
- Mon-Fri: Development
- Fri AM: Testing
- Fri PM: Sprint review, demo to stakeholders
- Fri end: Retrospective

### Definition of Done (Feature)

A feature is considered done when:
- ✅ Code written and reviewed (PR approved by 2 developers)
- ✅ Unit tests written (>80% coverage)
- ✅ Integration tests passing
- ✅ No console errors/warnings
- ✅ Accessible (WCAG 2.1 AA)
- ✅ API documented (OpenAPI/Swagger)
- ✅ Audit logging implemented
- ✅ Error handling in place
- ✅ Tested on desktop and mobile (responsive)
- ✅ Merged to main branch
- ✅ Deployed to staging
- ✅ UAT sign-off received

### Testing Strategy

**Test Pyramid:**
```
       /\
      /E2E\
     /------\
    /   IT   \
   /----------\
  /   Unit     \
 /--------------\
```

- **Unit Tests (60%):** Utilities, hooks, business logic
- **Integration Tests (30%):** API endpoints, state management
- **E2E Tests (10%):** Critical user workflows (login, submit expense, approve leave)

**Test Tools:**
- Vitest (unit)
- Testing Library (React component testing)
- Cypress/Playwright (E2E)
- MSW (mock API)

### Code Review Checklist

Before approving PR:
- [ ] Code follows project style guide
- [ ] No console errors/warnings
- [ ] Tests added and passing
- [ ] Audit logging implemented (if mutation)
- [ ] RBAC checks enforced (if permission-gated)
- [ ] Error handling comprehensive
- [ ] Performance acceptable (no N+1 queries)
- [ ] Security reviewed (no hardcoded secrets, no XSS)
- [ ] Accessibility checked (keyboard nav, screen reader)
- [ ] Documentation updated

---

## Deployment & Operations

### Environment Strategy

**Three Environments:**

1. **Development (Local)**
   - Run locally on developer machine
   - Mock API (MSW) or local backend
   - Hot reload enabled
   - No rate limiting

2. **Staging (AWS)**
   - Mirrors production setup
   - Real backend (test data)
   - Monitoring enabled
   - Used for UAT
   - Automatically deployed on main branch merge

3. **Production (AWS)**
   - Multi-region, HA setup
   - Real data, real users
   - Enhanced monitoring and alerting
   - Manual deployment (after staging validation)
   - Automatic backups

### Frontend Deployment

**Static Asset Hosting:**
- Build React app with Vite: `npm run build` → `dist/` folder
- Upload to S3: `aws s3 sync dist/ s3://ems-frontend-prod/`
- CloudFront CDN invalidation: `aws cloudfront create-invalidation --distribution-id ... --paths "/*"`
- Cache headers: versioned files 1 year, index.html no-cache

**CI/CD Pipeline (GitHub Actions):**
```yaml
name: Deploy Frontend

on:
  push:
    branches:
      - main
      - staging

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run lint
      - run: npm run test
      - run: npm run build
      - name: Deploy to S3
        run: aws s3 sync dist/ s3://ems-frontend-${{ github.ref_name }}/
      - name: Invalidate CloudFront
        run: aws cloudfront create-invalidation --distribution-id ... --paths "/*"
```

### Backend Deployment

**Docker Image:**
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Deployment to ECS Fargate:**
- Build Docker image: `docker build -t ems-api:v1.0 .`
- Push to ECR: `aws ecr get-login-password | docker login --username AWS --password-stdin ...`
- Update ECS task definition with new image
- Deploy: `aws ecs update-service --cluster ems-prod --service ems-api --force-new-deployment`

### Monitoring & Observability

**Metrics (CloudWatch/Datadog):**
- API latency (p50, p95, p99)
- Error rate (4xx, 5xx)
- Database CPU, memory, connections
- Cache hit rate (Redis)
- Queue depth (Celery jobs)
- User activity (logins, actions)

**Logs:**
- All API requests logged (method, path, status, latency, user_id)
- All errors captured with stack trace
- Audit trail for all mutations
- Structured logging (JSON)

**Alerts:**
- API response time > 2s → page on-call
- Error rate > 1% → page on-call
- Database CPU > 80% → notify ops
- Disk usage > 80% → notify ops
- Cache miss rate > 50% → investigate

**Dashboard:**
- Real-time API health
- User sessions and activity
- Database performance
- Queue status
- Error trends
- Audit log volume

### Disaster Recovery

**Backup Strategy:**
- Database: Daily snapshots to S3, 30-day retention
- Cross-region replica: Warm standby in us-west-2
- RTO (Recovery Time Objective): 1 hour
- RPO (Recovery Point Objective): 1 day

**Failover Procedure:**
1. Detect primary region down
2. DNS switch to secondary region (Route 53 failover policy)
3. Promote secondary RDS replica to primary
4. Re-deploy API to secondary region
5. Notify users of temporary service degradation
6. Investigate root cause

**Runbook:** Document in wiki, include playbook for common issues:
- API crash
- Database corruption
- Storage full
- Network partition

---

## Summary & Next Steps

### Key Takeaways

1. **This EMS is purpose-built for HMA internal staff.**
   - Domain-driven modular architecture
   - Audit-first data strategy
   - Role-based access control throughout
   - Mobile-friendly for field staff

2. **CoreUI template is a visual starting point only.**
   - Use component primitives, discard demo pages
   - Redesign folder structure for domain modules
   - Implement authentication and RBAC from scratch
   - Add audit logging to every business mutation

3. **Technology stack is modern and scalable.**
   - React 19 + Vite for fast development
   - FastAPI for high-performance async backend
   - PostgreSQL for reliable ACID transactions
   - Redis for caching and session management
   - AWS for cloud hosting and CDN

4. **5-18 week development timeline (5 phases).**
   - Phases 0-1: Foundation and auth (2-4 weeks)
   - Phases 2-3: Business modules (8 weeks)
   - Phase 4: Testing and optimization (3 weeks)
   - Phase 5: Launch and training (2 weeks)

### Architecture Decisions Locked In

- **No generic ERP:** This is staff management, not a full ERP system
- **Google OAuth + JWT:** Passwordless, secure, zero password management
- **RBAC at API layer:** Not UI layer; permissions non-negotiable
- **Immutable audit logs:** Every mutation logged, no retroactive changes
- **Domain-first modules:** Not component-first; business logic comes first
- **TypeScript progressive adoption:** Start with shared types, expand gradually
- **RTK Query for server state:** Not Redux; automatic caching and refetching
- **Tailwind CSS:** Utility-first, theme customization simple

### Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Scope creep (adding CRM/HCM features) | Steering committee + change control process |
| Performance degradation with 10K+ employees | Caching strategy, read replicas, pagination enforced |
| RBAC complexity (custom roles per dept) | Role templates, permission inheritance, admin UI |
| Data privacy (sensitive payroll, medical leave) | Encryption at rest, HTTPS everywhere, audit logs, GDPR compliance |
| Integration with legacy systems | ETL jobs, API layer for translation, phased migration |
| Team attrition mid-project | Comprehensive documentation, code reviews, pair programming |

### Success Criteria

- ✅ All users can log in securely via Google OAuth
- ✅ All 8 core modules live and functional
- ✅ Dashboard shows real-time KPIs
- ✅ Audit trail complete for all business actions
- ✅ RBAC enforced: no unauthorized access
- ✅ Performance: <500ms API response, <2s page load
- ✅ Uptime: 99.5% during business hours
- ✅ Mobile responsive: usable on phones
- ✅ Zero data loss incidents
- ✅ User adoption >90% (staff actively using within 3 months)

---

**Document Owner:** Senior Technical Lead  
**Last Updated:** June 11, 2026  
**Next Review:** December 11, 2026  
**Status:** Approved for Development
