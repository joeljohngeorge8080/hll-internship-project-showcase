# HMA IEMS — Session Progress Log

---

## Session Date: 2026-06-16

---

## What Was Done This Session

---

### 1. CLAUDE.md Created

**File:** `/home/jojo/labs/git-lab/HMA/CLAUDE.md`

**Purpose:** Guidance file for Claude Code in future sessions. Captures the full project context so future conversations start with complete understanding.

**Contents:**
- Project overview (HMA IEMS — replacing Excel-based workflows)
- Frontend dev commands (`npm start`, `npm run build`, `npm run lint`)
- Frontend stack clarification (CoreUI React, NOT Tailwind; Chart.js, NOT Recharts)
- Backend stack (FastAPI, SQLModel, Pydantic, PostgreSQL via Supabase)
- Database immutability rules (history tables, audit logs, completed projects)
- Full RBAC matrix (5 roles × 9 modules)
- Key business rules (attendance late-entry formula, payroll locking, project value immutability)
- Audit log field requirements
- ML/forecasting boundary (EMS consumes predictions, doesn't compute them)
- Commit convention

---

### 2. CoreUI Template Analyzed

**Template location:** `/home/jojo/labs/git-lab/HMA/git-coreui/coreui-free-react-admin-template/`

**Key findings:**
- React 19.2.4, Vite 8.x, CoreUI React 5.10.0, Bootstrap 5 via SCSS
- Chart.js 4.x via `@coreui/react-chartjs` (NOT Recharts)
- HashRouter — routes use `#/path` format
- Redux store currently has only `sidebarShow` and `theme`
- ~50 demo view files across base/buttons/forms/icons/notifications/theme/widgets — all to be deleted
- Shell components (AppSidebar, AppHeader, AppContent, DefaultLayout, AppBreadcrumb) are solid and reusable
- `.cursorrules` explicitly forbids Tailwind CSS and any non-CoreUI component library
- Dependencies already installed (`node_modules` present)

---

### 3. HMA_IEMS_ARCHITECTURE.md Created

**File:** `/home/jojo/labs/git-lab/HMA/git-coreui/coreui-free-react-admin-template/HMA_IEMS_ARCHITECTURE.md`

**Purpose:** Complete UI/UX architecture and CoreUI conversion plan. The master reference document for all frontend development work.

**Contents (20 sections):**

| Section | What it covers |
|---|---|
| Tech Stack Correction | Confirms Bootstrap 5 + Chart.js, not Tailwind + Recharts |
| Template Audit | What to delete (~50 files), what to keep, what to modify (7 files) |
| Sidebar Redesign | Full `_nav.jsx` replacement — 8 items, role-filtered |
| Page Hierarchy | Complete tree of all pages and sub-pages |
| Routing Structure | All routes with path, name, component, and roles[] |
| Folder Structure | Full `src/` directory layout including new files |
| Component Structure | Shell, shared, and module-level component breakdown |
| Dashboard Redesign | 4-row layout — KPI cards, charts, summary cards, tables |
| Projects Module | List page, detail tabs, create/edit form, expense modal |
| Staff & Payroll | Directory, profile tabs, payroll, salary increments |
| Attendance | Records (table+calendar), import 5-step flow, corrections |
| Expense Management | Records, upload, analysis charts |
| Finance | 3-upload overview, versioning, file history |
| Reports & Analysis | Overview grid, 6 report pages, forecast, predicted vs actual |
| Audit Logs | Read-only list with advanced filters + diff viewer detail |
| Reusable Components | 14 shared components defined |
| CoreUI Components | Full inventory of CoreUI components mapped to usage |
| Build-from-Scratch | 8 custom components (AttendanceCalendar, DiffViewer, SustainabilityGauge, etc.) |
| Responsive Strategy | Breakpoint table + rules for tables, sidebar, cards, modals |
| RBAC Strategy | PERMISSIONS matrix + usePermission hook + 5 application points |
| Charts & Tables | Full chart inventory by page + all key table column definitions |
| Implementation Roadmap | 11 phases, ~55 days total, task-level breakdown |

---

### 4. How to Test (Answered)

- `npm start` from the template directory starts the dev server at `http://localhost:3000`
- Routes use hash format: `http://localhost:3000/#/dashboard`
- `npm run lint` for lint check
- `npm run build && npm run serve` for production build preview at port 4173
- Node modules are already installed — no `npm install` needed

---

## Files Created This Session

| File | Location |
|---|---|
| `CLAUDE.md` | `/home/jojo/labs/git-lab/HMA/CLAUDE.md` |
| `HMA_IEMS_ARCHITECTURE.md` | `/home/jojo/labs/git-lab/HMA/git-coreui/coreui-free-react-admin-template/HMA_IEMS_ARCHITECTURE.md` |
| `SESSION_PROGRESS.md` | `/home/jojo/labs/git-lab/HMA/SESSION_PROGRESS.md` (this file) |

---

## Files Already in the Repository (Pre-Session)

| File | Purpose |
|---|---|
| `01_Project_Overview.md` | System purpose, goals, modules, full tech stack, user roles |
| `02_Roles_and_Permissions.md` | Permission matrix for all 5 roles across all 9 modules |
| `03_Business_Rules.md` | Attendance rules, payroll rules, project rules, leave rules |
| `04_Modules.md` | Feature list per module |
| `05_UI_Screens.md` | UI screen specifications |
| `06_Navigation.md` | Navigation structure |
| `07_Database_Requirements.md` | All 20 database tables with fields |
| `08_API_Requirements.md` | All REST API endpoints |
| `09_ML_Requirements.md` | Forecasting/ML integration requirements |
| `10_Architecture.md` | System architecture (frontend, backend, DB, auth, storage, infra) |
| `11_Development_Rules.md` | Code style, security, audit, import/export, Claude Code rules |
| `EXPENSE- MASTER SHEET (1).xlsx` | Source Excel data |
| `git-coreui/coreui-free-react-admin-template/` | CoreUI React template (base for frontend) |

---

## What Has NOT Been Done Yet (Next Steps)

Everything in the implementation roadmap is still pending. Work starts at Phase 0:

### Phase 0 — Foundation Cleanup (Next Immediate Step)
1. Delete all demo view files (views/base, buttons, forms, icons, notifications, theme, widgets)
2. Delete views/pages/register
3. Delete Docs* components
4. Clear routes.js and _nav.jsx to empty skeletons
5. Remove examples.scss import from App.jsx
6. Strip AppHeader demo links
7. Redesign AppHeaderDropdown
8. Update AppFooter text
9. Create `constants/permissions.js`
10. Expand `store.js` with user + token
11. Create hooks: useAuth, useRole, usePermission
12. Create ProtectedRoute component
13. Create `scss/_custom.scss`

### Phase 1 — Login + Auth Shell
### Phase 2 — Dashboard
### Phase 3 — Projects Module
### Phase 4 — Staff & Payroll
### Phase 5 — Attendance
### Phase 6 — Expense Management
### Phase 7 — Finance
### Phase 8 — Reports & Analysis
### Phase 9 — Audit Logs
### Phase 10 — Brand & QA
### Phase 11 — API Integration

---

## Key Decisions Made This Session

1. **No Tailwind CSS** — the actual template uses Bootstrap 5 via CoreUI SCSS. `.cursorrules` forbids Tailwind.
2. **No Recharts** — Chart.js 4.x via `@coreui/react-chartjs` is used throughout.
3. **ProjectList.jsx is one parameterized component** — not 3 separate files for CSR/LSGB/Other.
4. **FinanceUpload.jsx is one parameterized component** — not 3 files for sheets 1/2/3.
5. **Module-by-module build order** — validate each phase before starting the next (per `11_Development_Rules.md`).
6. **PERMISSIONS matrix is a single source of truth** — defined once in `constants/permissions.js`, consumed via `usePermission` hook.
7. **Business locks are separate from RBAC** — Completed projects and locked payroll are unconditionally read-only regardless of role.
