# HMA IEMS — MVP Definition & Phased Delivery

> Defines the minimum viable product, ranks features, and sequences delivery
> so the project ships value early instead of trying to build everything at
> once. Grounded in `DECISIONS.md`, `EMS_ROADMAP.md`, and `specs/`.
>
> Last updated: 2026-07-07

---

## 1. MVP Thesis

**The system exists to replace fragmented Excel workflows with a secure,
auditable, role-based record system.** The MVP is the smallest slice that lets
real users **log in, see role-appropriate data, manage employees and projects,
import attendance, and run basic reports** — with audit integrity from day one.

**MVP = the critical path:**
`Auth → RBAC + Audit → Employee Management → Projects → Attendance → core Reporting`.

Everything else is layered on after the MVP is in users' hands.

---

## 2. Feature Ranking

### 🔴 Critical — *must be in the MVP*
| Feature | Why critical |
|---|---|
| Authentication (JWT, Employee ID login) | No system without identity |
| RBAC enforcement (matrix + ProtectedRoute) | Role-appropriate access is the core value prop |
| Audit logging (cross-cutting write hook) | Compliance/governance is non-negotiable (ADR-013) |
| Employee Management (master + salary/dept history + documents) | The entity everything references |
| Projects (PA→PO assignment, budget planning/allocation, expenses, documents) | Primary business object (CSR/LSGB/Other); scope narrowed to expense oversight, no daily task-tracking (ADR-036) |
| Attendance import (Pace `.xlsx`) + corrections | Replaces the most painful manual workflow |
| Basic Reporting (attendance, project, expense) + export | The reason management adopts the system |
| Shell/Foundation (done), brand-minimum, error pages | Usable, navigable app |

### 🟡 Important — *fast-follow after MVP*
| Feature | Why not day-1 |
|---|---|
| Payroll generation + payslips | Blocked on HR deduction-formula confirmation (ADR-021); attendance must exist first |
| Expense Management (company ops) | Valuable but independent; can follow |
| Finance (3-sheet upload + versioning) | Independent workspace; follows |
| Notifications (SES: payslip, monthly report) | Enhances Payroll/Reporting once those exist |
| Audit Logs viewer (filters + diff) | Audit *data* exists from MVP; the rich viewer can follow |
| Dashboard widgets | Deferred pending stakeholder validation (ADR-029) |
| Full brand/QA polish, responsive audit | Hardening pass |

### 🟢 Nice to Have — *later / conditional*
| Feature | Notes |
|---|---|
| Forecasting / ML reports | Deferred until ML spec lands (ADR-027) |
| Inventory | Net-new, pending scope (ADR-034) |
| Employee Self-Service portal | Future release (per `04_Modules.md`) |
| Announcements module | Future release |
| Advanced "Power BI-style" dashboards | After base reporting proves out |
| Leave applications / approval workflow | Out of scope now (ADR-022) |

---

## 3. MVP Scope Boundary (explicit in/out)

**In:** login, role-gated navigation + routes, audit writes, employee CRUD with
history + documents, project CRUD + expenses + documents (PA→PO assignment,
budget planning/allocation, 5% EMS share), attendance import + corrections +
summary, three core reports with export, S3 file storage.

**Out (post-MVP):** payroll, expense-management module, finance module,
notifications, dashboard widgets, audit viewer UI (data still captured),
forecasting, inventory, self-service, announcements. **Also out (ADR-036,
2026-07-07):** daily task-tracking/reporting and PMS dashboard KPI/phase
widgets — the CEO wants expense oversight, not project-management tooling.

**Definition of Done for the MVP:** all five roles can log in and see correct
access; HR can manage employees and import attendance; Project Officers/Finance
can manage projects and project expenses within their boundaries; every
mutation is audited; the three core reports export correctly; lint + build are
green and the app is deployed.

---

## 4. Phased Delivery Plan

| Release | Phases (EMS_ROADMAP) | Contents | Exit criteria |
|---|---|---|---|
| **R0 — Foundation** ✅ | P0 | Clean shell, RBAC scaffold, routing, state | Lint/build green; shell navigable (done) |
| **R1 — Secure Shell** | P1, P2 | Real login, JWT, RBAC enforcement, audit write-hook | A real user logs in; routes gated; mutations audited; mock user removed |
| **R2 — Core Data (MVP part 1)** | P3, P4 | Employee Management; Projects (+expenses, +documents) | HR manages employees w/ history; POs/Finance manage projects + expenses within boundaries |
| **R3 — Attendance + Reporting (MVP complete)** | P5, P10 (subset) | Pace import + corrections + summary; attendance/project/expense reports + export | Attendance imported & corrected; 3 reports export → **MVP shippable** |
| **R4 — Payroll & Money** | P6, P7, P8 | Payroll (once formula confirmed), Expense Mgmt, Finance | Monthly payroll generates & locks; expense/finance modules live |
| **R5 — Comms & Audit UI** | P12, P13, P11 | SES notifications, audit-logs viewer | Payslip/report emails send; audit viewer filterable |
| **R6 — Hardening** | P14 | Brand, responsive, per-role QA, polish | All-role QA pass; production-ready |
| **R7 — Conditional** | P9, forecasting | Inventory (if scoped), ML forecasting (if spec lands) | Gated on external decisions |

**MVP ships at the end of R3.** R1–R3 are the critical path; R4+ build on it.

---

## 5. Risks & Sequencing Notes
- **Payroll is intentionally post-MVP** — it is blocked on the HR deduction formula (ADR-021) and depends on Attendance. Forcing it into the MVP would stall the whole release.
- **Audit logging is in the MVP even though its viewer is not** — capturing the trail from day one is mandatory; the rich UI can follow.
- **Projects can start once a minimal employee directory exists** (soft dependency for officer/team assignment) — sequence R2 so Employee precedes Project team features.
- **Inventory and Forecasting must not block the MVP** — both are gated on external decisions (ADR-034, ADR-027).
- **Backend runs as a parallel track** — each frontend phase swaps placeholder data for live FastAPI endpoints as it lands.

---

## 6. Decision Gates Before Building
1. **Confirm payroll deduction formula** (HR) → unblocks R4 / Payroll.
2. **Confirm Inventory scope** → enables or removes R7 Inventory.
3. **ML forecasting requirements** → enables forecasting reports.
4. **Dashboard widget set** (stakeholders) → upgrades the placeholder.
