# HMA IEMS — Project Overview (Onboarding Guide)

> The document a senior engineer would walk a new hire through on day one.
> It describes the system **as it actually is**, not as the spec files
> (`01`–`12`) describe it — those are the original aspiration and have
> drifted badly from reality. When this doc and a spec disagree, this doc
> and the code win. Written 2026-07-07.

---

## 1. What this is

HMA IEMS is an internal enterprise-management web app for HMA (an NGO-like
organization running funded projects — CSR, LSGB, donor-backed). It replaces
a pile of Excel sheets that tracked employees, attendance, payroll, project
budgets, and expenses.

The one-sentence purpose, per the CEO (see `newplan.txt` / ADR-036): **answer
whether the company is planning and spending project money correctly.** It is
an *expense-oversight* tool with an HR system attached — not a full
project-management suite, even though a partial one was built along the way.

## 2. The shape of the codebase

```
HMA/                          ← git repo root
├── backend/                  ← FastAPI + SQLModel backend (~3,300 lines Python)
├── hma-template/emsv1/       ← THE frontend. React 19 + Vite + CoreUI 5.
│   └── src/
│       ├── modules/ems/      ← HR/ops side: staff-payroll, attendance,
│       │                       general-expenses, hr-pool, core-pool,
│       │                       recruitment, internship, announcements…
│       ├── modules/pms/      ← project side: project-associate, projects,
│       │                       lsgb, donors, daily-reports*, dashboard*
│       ├── services/         ← the "database" — see §3, the most important
│       │                       directory in the repo
│       ├── routes/           ← ems.routes.js + pms.routes.js (lazy-loaded)
│       ├── constants/        ← roles.js, permissions.js (RBAC matrix)
│       └── hooks/            ← useAuth, useRole, usePermission
├── docs/                     ← specs, ADRs (DECISIONS.md), roadmap, this file
└── git-coreui/               ← pristine CoreUI template kept for reference
```

`*` = out of scope since ADR-036; don't build on these.

There is **one Redux store** with a single `'set'` action — it holds only
`user`, `token`, and sidebar/theme UI state. All business data lives in the
service layer, not Redux.

## 3. The single most important thing to understand

**The frontend does not use the backend for data.** Every `local*` file in
`src/services/` (localProjects, localEmployees, localOrgPool,
localGeneralExpenses, ~25 of them) is a self-contained "table" persisted in
**browser localStorage**, with seed data merged in on load. The FastAPI
backend exists and has real auth (bcrypt, JWT, Google token verification, S3)
— but the frontend checks its local services *first* and only falls back to
the backend for accounts it doesn't know. In practice the browser profile
**is** the database.

Why? Speed of iteration. The team needed to demo working flows to the CEO
weekly, requirements were changing under them (see ADR-036 — the CEO cut the
whole PMS concept mid-build), and a localStorage data layer let the frontend
evolve without waiting for backend endpoints. The `local*` services all share
the backend's intended API shape (`list({ page, pageSize })`, `get`,
`create`, `update`) so they can be swapped for real HTTP calls module by
module later.

The cost of that decision is the top item in `GAPS.md`: no multi-user data,
no durability, no server-side enforcement of anything. Understand that
trade-off before touching anything financial.

## 4. Roles and access

Eleven roles in `src/constants/roles.js`: Admin, CEO, Heads, HR, Finance,
Project Associate, Project Officer, Field Personnel, Backend Team, Project
Coordinator, Employee. (The docs' original five-role model is obsolete.)

- The RBAC matrix is one file: `src/constants/permissions.js`, keyed
  `module → role → V|E|none`. Consumed by `usePermission` and
  `<ProtectedRoute module=… action=…>`. **Never write ad-hoc role checks** —
  add a matrix row.
- Admin short-circuits to full access in `usePermission`.
- All of this is client-side gating only. It shapes the UI; it is not
  security (see GAPS).

## 5. The business flow (post-ADR-036)

1. A funded project arrives. One of the two **Project Associates** registers
   it and assigns a **Project Officer** (`pms/project-associate`).
2. The **PO owns everything after that**: fills in project detail, designs
   the phase/task budget, plans monthly spend, records expenses
   (`pms/projects`, `docs/project_budget_drd.md` is the budget data model).
3. Money is split by percentage of project value: **~85% project spend**,
   **5% admin overhead**, **5% HR pool**, **5% core pool** (configurable per
   project: `hr_pct`, `core_pct`, `ADMIN_PCT`). The HR/core shares flow to
   the **EMS side** — this is the "5% to EMS (HR)" the CEO cares about.
4. EMS (HR) runs the org on those pools: salaries, attendance-driven
   payroll, general expenses (`ems/hr-pool`, `ems/core-pool`,
   `ems/staff-payroll`, `ems/general-expenses`).
5. The CEO's question — "are we planning and spending correctly?" — is
   answered by budget-vs-actual variance views built on the monthly plans.

The math engine for step 3 lives in **`src/services/localOrgPool.js`**
(pool budgets per installment/month) and
**`src/services/monthlyApportionment.js`** (pure, I/O-free plan math —
deliberately written data-in/data-out so it can be unit-tested). A plan is
valid only when Σ(monthly totals) equals the working pool within a half-paisa
tolerance (`validatePlanTotal`).

## 6. Key decisions and the reasons behind them

| Decision | Why | Where recorded |
|---|---|---|
| CoreUI React template, no Tailwind/MUI | Template was already licensed/familiar; one design system; `.cursorrules` enforces it | ADR-009/011 |
| Chart.js not Recharts | It's what the template ships; specs said Recharts and were overruled | ADR-010 |
| localStorage-first data layer | Demo velocity while requirements were fluid; backend swap-in planned per module | §3 above |
| Google OAuth login + seeded admin accounts | Org uses Gmail; zero password management for normal users. (ADR-003 said "no OAuth" — reality overruled it; treat ADR-003 as superseded) | code: `auth.js`, `localUsers.js` |
| HashRouter | Static hosting (Netlify) without server rewrites originally; kept for simplicity | ADR-012 |
| Percent-based pool split (5/5/5/85) | Mirrors how HMA already ran overheads in Excel; single project-level constants | ADR-036, `project_budget_drd.md` |
| Append-only ledgers, immutable budgets | Audit/compliance intent — budget rows never edited once actuals flow; wrong entries get reversing entries | `project_budget_drd.md` §2.4, ADR-013–019 (aspirational — see GAPS) |
| Module-by-module delivery | Small team, CEO reviews between modules | ADR-030 |
| Dual `ems/` + `pms/` module trees | The two sides have different users, navs, and dashboards; each has its own `_nav.jsx` and routes file | commit `8e3f09f` |

## 7. Deployment reality

- **Frontend:** Netlify (`netlify.toml` at repo root; base `hma-template/emsv1`,
  SPA redirect). `VITE_DEV_LOGIN` controls the dev role-switcher login;
  `.env.production` sets it false.
- **Backend:** Render, deployed by a GitHub Actions hook that fires on pushes
  to `master` touching `backend/**`. Note the active dev branch is `master2`
  — backend deploys do **not** fire from it.
- No frontend CI. Lint and build run on developer machines only.

## 8. Where to start reading

1. `src/services/localOrgPool.js` — the money model. Everything the CEO
   cares about flows through here.
2. `src/services/monthlyApportionment.js` — the clean, pure version of the
   plan math, with its spec in `docs/superpowers/specs/`.
3. `src/constants/permissions.js` + `ProtectedRoute.jsx` — how access works.
4. `src/services/auth.js` + `localUsers.js` — how login actually works
   (three paths: dev bypass, local whitelist, backend fallback).
5. `docs/DECISIONS.md` — the ADR log, freshly reconciled through ADR-036.
6. `docs/GAPS.md` — everything that's wrong, so you don't rediscover it.
