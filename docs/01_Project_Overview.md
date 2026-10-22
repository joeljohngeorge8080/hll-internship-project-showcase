# Project Name

HMA IEMS (HMA Internal Enterprise Management System)

---

# Purpose

The purpose of HMA IEMS is to provide a centralized enterprise management platform for managing projects, employees, attendance, payroll, expenses, finance records, reporting, and organizational decision-making.

The system is designed to replace fragmented Excel-based processes and manual record-keeping with a secure, role-based, web-based management system. HMA IEMS aims to improve operational efficiency, financial transparency, project monitoring, employee management, and organizational reporting while maintaining complete auditability of all critical business activities.

The platform shall provide management with a unified view of organizational performance, project progress, expense utilization, employee productivity, and financial forecasting through interactive dashboards, reports, and analytics.

---

# Problem Statement

The organization currently relies on multiple Excel sheets, manual workflows, and disconnected record management practices to manage projects, expenses, attendance, payroll, and finance operations.

This approach introduces several challenges:

* Lack of centralized project monitoring and reporting.
* Difficulty tracking actual project expenses against planned budgets.
* Limited visibility into project performance and financial health.
* Manual attendance and payroll processing.
* High dependency on Excel files maintained by different departments.
* Lack of historical audit trails for changes and updates.
* Difficulty generating consolidated reports across departments.
* Limited forecasting and analytical capabilities.
* Challenges in monitoring organizational expenses and project profitability.
* Increased risk of data duplication, inconsistency, and reporting errors.

The organization requires a centralized Enterprise Management System that provides controlled access, automated calculations, structured workflows, and comprehensive reporting capabilities.

---

# Goals

The primary goals of HMA IEMS are:

### Project Management

* Centralize all project information.
* Manage CSR, LSGB, and future project categories.
* Track project lifecycle from creation to completion.
* Monitor project expenses and financial utilization.
* Compare predicted expenses with actual expenses.
* Generate project-specific and organization-wide reports.

### Employee Management

* Maintain a centralized employee database.
* Manage employee profiles, employment types, and status.
* Store employee documents securely.
* Maintain employee history and salary records.

### Attendance Management

* Integrate attendance machine records.
* Support attendance imports through Excel.
* Automate attendance calculations.
* Manage attendance corrections with complete audit history.

### Payroll Management

* Automate salary calculations.
* Apply attendance-based deductions.
* Manage annual increments.
* Generate payroll reports and payslips.
* Maintain complete salary history.

### Expense Management

* Record and manage organizational expenses.
* Support Excel-based expense uploads.
* Enable expense analysis and reporting.
* Maintain audit history for all expense modifications.

### Finance Management

* Provide a dedicated finance workspace.
* Manage finance-specific Excel records.
* Maintain historical finance uploads.
* Enable financial tracking and reporting.

### Reporting & Analytics

* Generate operational and financial reports.
* Provide project performance analysis.
* Support forecasting and predictive analysis.
* Export reports in PDF, Excel, and Word formats.
* Deliver management insights through dashboards and charts.

### Governance & Compliance

* Implement role-based access control.
* Maintain immutable audit logs.
* Track all critical system changes.
* Improve accountability and transparency.

---

# Modules

The system shall consist of the following modules:

## 1. Dashboard

Provides a consolidated overview of:

* Active Projects
* Project Status
* Attendance Summary
* Financial Indicators
* Expense Summary
* Organizational Performance Metrics
* Forecasting Highlights

---

## 2. Projects

Manages:

* CSR Projects
* LSGB Projects
* Future Project Categories
* Project Details
* Project Expenses
* Project Reports
* Project Lifecycle Management

---

## 3. Staff & Payroll

Manages:

* Employee Records
* Employee Profiles
* Employee Documents
* Salary Management
* Increment History
* Payroll Processing
* Payroll Reports

---

## 4. Attendance

Manages:

* Attendance Machine Records
* Excel Attendance Uploads
* Attendance Corrections
* Leave Tracking
* Attendance Reports

---

## 5. Expense Management

Manages:

* Organizational Expenses
* Expense Uploads
* Expense Records
* Expense Analysis
* Expense Reporting

---

## 6. Finance

Manages:

* Finance Department Records
* Finance Excel Uploads
* Historical Finance Files
* Financial Tracking
* Finance Reports

---

## 7. Reports & Analysis

Provides:

* Attendance Reports
* Project Reports
* Financial Reports
* Forecast Reports
* Predicted vs Actual Analysis
* Power BI Style Visualizations
* Executive Reporting

---

## 8. Audit Logs

Maintains:

* User Activity Logs
* Data Modification History
* Attendance Corrections
* Salary Changes
* Expense Changes
* Project Updates

---

# Tech Stack

## Frontend

* React 18+
* Vite
* HTML5
* CSS3
* JavaScript
* Tailwind CSS
* Recharts

## Backend

* Python 3.12+
* FastAPI
* Pydantic

## Database

* PostgreSQL
* Supabase Pro
* SQLModel ORM

## Authentication

* Username & Password Authentication
* JWT (JSON Web Tokens)
* Role-Based Access Control (RBAC)
* Password Reset by HR

## File Storage

* AWS S3

## Email Services

* AWS SES

## Infrastructure

* AWS EC2
* AWS Route53
* AWS Certificate Manager
* AWS CloudWatch

## DevOps

* Docker
* Git
* GitHub
* GitHub Actions

## Testing

* Postman

## Documentation

* Notion
* Markdown
* Draw.io

---

# Users

## CEO

Responsibilities:

* View all modules
* Monitor organizational performance
* Access reports and analytics
* Review audit logs

Access Level:

* View All

---

## Department Heads

Responsibilities:

* Monitor department activities
* Review reports and operational performance

Access Level:

* View All

---

## HR

Responsibilities:

* Manage employees
* Manage attendance
* Process payroll
* Manage organizational expenses
* Reset user passwords

Access Level:

* View All
* Edit Staff & Payroll
* Edit Attendance
* Edit Expense Management

---

## Finance

Responsibilities:

* Manage finance records
* Upload and maintain finance files
* Manage project expenses
* Support financial reporting

Access Level:

* View All
* Edit Finance Module
* Edit Project Expenses

---

## Project Officer

Responsibilities:

* Manage projects
* Update project details
* Manage actual project expenses
* Monitor project performance

Access Level:

* View Projects
* View Reports & Analysis
* View Audit Logs
* Edit Projects
* Edit Project Expenses
