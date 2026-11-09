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
- **Deploy to EC2 (manual):** run the *Deploy static site to EC2* workflow from the Actions tab. It builds the site, uploads it over SSH, swaps it into `/var/www/hma-ems`, reloads nginx (`hma-template/emsv1/nginx.conf`), and rolls back if the health check fails. Repository secrets needed: `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`. The host needs nginx and a user with passwordless `sudo` for the deploy commands.

### HTTPS setup (one-time, before the first deploy)
The site is served at `https://hll-internship-project.joelz.site`. The certificate must exist on the host first, otherwise `nginx -t` fails and the workflow restores the previous config (nothing goes live).

1. Point a DNS **A record** for `hll-internship-project.joelz.site` at the server's Elastic IP, and open ports **80** and **443** in the EC2 security group.
2. On the host (Ubuntu 24.04):
   ```
   sudo apt update && sudo apt install -y nginx certbot
   sudo certbot certonly --webroot -w /var/www/html -d hll-internship-project.joelz.site
   ```
   The default nginx site serves `/var/www/html` on port 80, which is all certbot needs for the first issue.
3. Run the deploy workflow. Renewals are automatic (the `certbot.timer` unit) and use the `/.well-known/acme-challenge/` path kept open in `nginx.conf`; check with `sudo certbot renew --dry-run`.
4. HSTS is set to one day. Once HTTPS is stable, raise `max-age` in `nginx.conf`.

## Credits
This showcase is a sanitized copy of a project built by a small team during an internship. The original repository is private and contains company data, so its commit history is not part of this public copy.

| Name | GitHub |
| --- | --- |
| Joel John George | [joeljohngeorge8080](https://github.com/joeljohngeorge8080) |
| Prathyusha | [prathyusha71](https://github.com/prathyusha71) |
| V Sridhar | [Sridd20](https://github.com/Sridd20) |

This copy (sanitization, in-browser demo data layer, deployment setup) was prepared by Joel John George.
