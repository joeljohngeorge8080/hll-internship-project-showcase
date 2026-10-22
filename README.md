# HMA IEMS — Integrated Enterprise Management System (portfolio showcase)

A sanitized copy of a production internal-operations platform: project management (PMS), employee/payroll/expense management (EMS), GST and fund-ledger tracking, role-based access, and an AI assistant.
All company data, credentials and identifiers have been removed; seed data is synthetic.

**Stack:** React 19 + Vite + CoreUI · Supabase (Postgres, Auth, RLS, Edge Functions) · FastAPI · AWS (EC2, SES, Bedrock) · Docker / GitHub Actions

## Architecture highlights
- 50+ SQL migrations with row-level-security policies per role (admin, CEO, heads, HR, project coordinator/associate, employee)
- Service layer (`src/services/local*.js`) with in-flight promise caching for dashboard performance
- Supabase Edge Functions: apportionment engine, Bedrock chat with tool-calling and per-user daily quota
- Docs: `docs/` (requirements, roles, business rules, architecture), `deployment/` (CI/CD, EC2, nginx)

## Run it
1. Create a free Supabase project; apply migrations: `cd hma-template/emsv1 && supabase link && supabase db push`
2. `cp .env.example .env` and set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon key only)
3. Seed demo users: `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node supabase/seed/seed-users.mjs`
4. `npm ci && npm run dev`

Demo employees live in `src/services/seedEmployees.json` (fictional). Never commit a service-role key.
