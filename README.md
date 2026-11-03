# HMA IEMS — Integrated Enterprise Management System (portfolio showcase)

A sanitized copy of a production internal-operations platform: project management (PMS), employee/payroll/expense management (EMS), GST and fund-ledger tracking, role-based access, and an AI assistant.
All company data, credentials and identifiers have been removed; seed data is synthetic.

**Stack:** React 19 + Vite + CoreUI · Supabase-style data layer (schema and RLS in `supabase/migrations`, mocked in-browser here) · Netlify (static hosting) · GitHub Actions (frontend CI)

## Architecture highlights
- 50+ SQL migrations with row-level-security policies per role (admin, CEO, heads, HR, project coordinator/associate, employee)
- Service layer (`src/services/local*.js`) with in-flight promise caching for dashboard performance
- Supabase Edge Functions: apportionment engine, Bedrock chat with tool-calling and per-user daily quota
- Docs: `docs/` (requirements, roles, business rules, architecture), `specs/` (feature specs)

## Run it
The showcase needs no database, backend or sign-in. Pick a role on the landing screen and explore.

```
cd hma-template/emsv1
npm ci
npm run dev        # or: npm run build
```

- **Data:** fictional seed data (staff, projects, attendance, expenses, payroll) is generated in the browser by `src/services/mock/seed/` and served by an in-browser stand-in for the Supabase client (`src/services/supabase.js`, `src/services/mock/engine.js`). Edits persist in `localStorage`; "Reset demo data" on the role screen restores the seed.
- **Not included:** there is no backend server, Edge Functions (AI chat is stubbed) or deployment pipeline for one. The Postgres migrations under `supabase/` are kept as architecture reference only and are not run.
- **Deploy:** static site — `netlify.toml` builds `hma-template/emsv1`.
