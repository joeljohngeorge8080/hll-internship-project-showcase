# HMA IEMS — Gaps, Risks & Weaknesses Audit

> A deliberately unflattering audit of the codebase as of 2026-07-07
> (branch `master2`). Ordered by severity. Each item states the problem,
> where it lives, the concrete failure it causes, and a fix direction.
> "Verified" = I traced it in the code this pass. "Likely" = strong
> inference not exhaustively traced.

---

## S0 — Architectural / data-integrity (fix before real users or real money)

### G1. There is no real database. All data lives in browser localStorage. **[Verified]**
Every `src/services/local*.js` reads/writes `localStorage`. Data is
**per-browser, per-device, per-profile**. Consequences that will bite:
- Two people never see the same data. A PO's budget plan does not exist for
  the CEO looking at the same "project."
- Clearing browser data, switching machines, or a browser eviction under
  storage pressure **silently destroys everything**. There is no backup.
- localStorage is ~5 MB per origin. Attendance imports and growing expense
  ledgers will hit the ceiling; `setItem` then throws `QuotaExceededError`,
  which **no service catches** — the write is lost and the UI may half-update.
- **Fix:** wire the existing FastAPI backend in per module (the `local*`
  APIs already mirror the intended HTTP shape). Until then, treat every
  number in the app as a demo, not a record.

### G2. The audit log is fake. **[Verified]**
`src/services/localAudit.js` is a hardcoded array of 5 mock rows with a
`list()` and **no write path**. Grep confirms no mutation anywhere calls it.
ADR-013 and the compliance story claim "every create/update/delete writes an
immutable audit row" — that is **entirely unimplemented on the frontend**.
Any screen showing "Audit Logs" is showing fiction.
- **Fix:** either implement a real append-only audit write on every service
  mutation (and move it server-side — a client can't be trusted to log its
  own actions), or stop presenting the audit UI as real.

### G3. "Immutable" and "append-only" are conventions, not guarantees. **[Verified]**
ADR-014–019 and `project_budget_drd.md` promise immutable project value,
locked payroll, append-only history. In a localStorage model, **any of this
can be overwritten** by any code path or by a user editing localStorage in
devtools. There is no engine enforcing immutability. The guarantees are
aspirational documentation, not system behavior.

### G4. Money is computed in floating-point rupees. **[Verified]**
111 `parseFloat`/`toFixed` sites across services; pool math in
`localOrgPool.js` and `monthlyApportionment.js` does `pv * (pct/100)` then
`Math.round(x*100)/100`. Rounding each intermediate to paise accumulates
error across installments/months. `validatePlanTotal` even bakes in a
half-paisa tolerance to hide the drift. For a financial oversight tool this
is a correctness smell: totals can fail to reconcile by a rupee, and the
"which pool absorbs the remainder" rounding is not defined anywhere.
- **Fix:** compute in integer paise, or centralize a single rounding policy
  with an explicit remainder-allocation rule (largest-remainder method).

### G5. Entity IDs are `Date.now()` + short random — collision-prone. **[Verified]**
`uid = \`proj_${Date.now()}_${Math.random().toString(36).slice(2,5)}\`` and
~30 variants (some only 3–5 random chars, `localCalculator.js` uses bare
`Date.now()`). Two records created in the same millisecond with the same
3-char random suffix collide, and a colliding id silently overwrites the
earlier record on `save`. Low probability per write, but this is the primary
key of financial records with **no uniqueness check on insert**.
- **Fix:** `crypto.randomUUID()` (available in all target browsers).

---

## S1 — Security

### G6. Authentication and authorization are client-side only. **[Verified]**
`ProtectedRoute` + `usePermission` gate the **UI**, reading role from the
Redux store, which is seeded from localStorage. A user can set their own role
by editing localStorage/Redux devtools and unlock any screen. Because the
data layer is also local, there is no server check to stop them. **The RBAC
matrix is UX, not security.** This is acceptable only as long as the app is a
single-user local demo; it is disqualifying for multi-user or sensitive data.

### G7. Plaintext passwords hardcoded in shipped source. **[Verified]**
`src/services/localUsers.js` `PASSWORD_LOGINS` contains five admin
credentials in cleartext (`ADMIN001` / `Demo-Admin-1` … `ADMIN005`). These are
bundled into the built JS and served to every visitor — anyone can read them
in the browser or the git history and log in as Admin (which
`usePermission` grants total access). Rotating them requires a code change.
- **Fix:** remove entirely; authenticate against the backend with hashed
  passwords (the backend already has bcrypt in `core/security.py`).

### G8. Google JWT is decoded, never verified. **[Verified]**
`auth.js` `decodeGoogleJwt` does `atob(credential.split('.')[1])` and trusts
the `email` claim to establish a session — **no signature verification**. A
forged token with any email in the whitelist yields a valid local session.
(The backend has `google_auth.py` that presumably verifies properly, but the
frontend short-circuits before reaching it.)
- **Fix:** never trust an unverified token client-side to grant access;
  verification must happen server-side and the session must come from there.

### G9. Dev login bypass ships in the bundle. **[Verified]**
`DEV_USERS` + `dev-bypass-<role>` credential path in `auth.js`. Guarded by
`isDevMode() = import.meta.env.DEV || VITE_DEV_LOGIN==='true'`. `.env` has
`VITE_DEV_LOGIN=true`; `.env.production` sets it false — so safety depends
entirely on the correct env file being used at build time. One
misconfigured deploy exposes a one-click login as any role including CEO.
- **Fix:** strip dev-login code from production builds via dead-code
  elimination, not just a runtime flag.

### G10. `.env` is gitignored but `.env.production` is committed. **[Verified]**
`.env.production` and `.env.example` are tracked. They currently hold no
secrets (`VITE_GOOGLE_CLIENT_ID=` is empty), but the pattern invites a real
client id / flag being committed later. The Render deploy hook lives in a
GitHub secret (good), but confirm no future secret lands in a committed env.

---

## S2 — Testing & correctness safety net

### G11. Zero automated tests. No test runner at all. **[Verified]**
No `*.test.*` / `*.spec.*` files; `package.json` has no `test` script; the
`test/` directory contains two screenshots. The financial math in
`monthlyApportionment.js` was **deliberately written pure and I/O-free to be
testable** (its own comment says so) and yet has **no tests**. This is the
highest-leverage gap to close: the reconciliation math, pool splits, and
`monthsBetween` edge cases are exactly what unit tests exist for.
- **Fix:** add Vitest (Vite-native), start with `monthlyApportionment.js`,
  `localOrgPool` pool math, and `attendanceParser`.

### G12. No frontend CI. **[Verified]**
`.github/workflows/` has backend deploy + stale-bot only. Nothing runs lint
or build on push/PR. Broken code reaches `master2` freely (the recent commit
log is full of after-the-fact "fix Prettier formatting" commits — evidence
that formatting/lint is caught by humans late, not by CI).
- **Fix:** a GH Action running `npm ci && npm run lint && npm run build` on PR.

---

## S3 — Fragile edge cases (verified in code)

### G13. `monthsBetween` silently returns 1 on bad/missing dates. **[Verified]**
`localOrgPool.js`: `if (!start || !end) return 1`, and it string-splits
`YYYY-MM` on `-` with no validation. A project missing `end_date`, or with a
reversed range (end < start → `Math.max(1, …)` clamps to 1), produces a
**wrong denominator** in `(project_value × pct) ÷ months`, silently inflating
every monthly budget. There is no "this project has no dates" warning to the
PO — the number just comes out plausible and wrong. `monthsInRange` in
`monthlyApportionment.js` returns `[]` for the same bad input, so the two
helpers **disagree** on how to treat missing dates.

### G14. `budgetNotForeseen` fallback changes the formula silently. **[Verified]**
When `project_value === 0`, `getProjectInstallmentBudgets` switches from
"pct of project value ÷ total months" to "pct of *installment* ÷ installment
months" — a different basis — and only surfaces a boolean flag. Two projects
with the same installments can show different pool budgets depending on
whether someone filled in project value, with no visible explanation.

### G15. Field-name sprawl for the same concept. **[Verified]**
Project value is read as `project_value || project_valuation ||
amount_sanctioned || amount` in different functions of the *same file*
(`localOrgPool.js`), and `end_date || target_date` elsewhere. Whichever field
happens to be populated wins, so the same project can value differently in
two views. This is a data-model that was never normalized.

### G16. `xlsx@0.18.5` — attendance import parser. **[Verified: version; Likely: risk]**
`attendanceParser.js` uses SheetJS `xlsx` 0.18.5 from npm. That line has
known prototype-pollution/ReDoS advisories, and SheetJS moved distribution
off the npm registry. Parsing an untrusted `.xlsx` (which is the entire point
of the import feature) is the exact attack surface. Parsing uses `raw: true`
which also means no type coercion — dates/numbers arrive as whatever Excel
stored, feeding G13-style date bugs.
- **Fix:** update to the vendor-distributed SheetJS build; validate/whitelist
  parsed cells before use.

### G17. localStorage JSON.parse without schema validation, ~40 sites. **[Verified]**
Every service does `JSON.parse(localStorage.getItem(...))` inside a
try/catch that falls back to seed/empty on *parse* error — but a
**successfully parsed but shape-changed** object (old schema, renamed field,
partial write from a crash) passes through untouched and propagates
`undefined` into money math. There is no versioning/migration on the stored
shape.

### G18. Auth response interceptor swallows 401s for local/dev tokens. **[Verified]**
`api.js` ignores 401s when the token starts with `dev-`/`local-`. Combined
with the local-first data model, a genuinely expired or revoked backend
session can persist indefinitely on the client. Sessions never really end.

---

## S4 — Maintainability

### G19. God-files in the service and page layers. **[Verified]**
`localOrgPool.js` 1,246 lines, `localGeneralExpenses.js` 1,207,
`localProjects.js` 1,037, `sdpProjectsData.js` 995; and on the UI side
`pms/project-associate/ProjectDetailPage.jsx` is **2,583 lines**,
`MonthlyPlanPanel.jsx` 1,128. These exceed what one person can hold in
context; they mix data access, math, and formatting. Bugs like G13/G15 hide
in files this size. Break out the pure math (as `monthlyApportionment.js`
already models) and keep services thin.

### G20. Docs vs code drift is systemic, not incidental. **[Verified]**
The numbered specs `01`–`12` describe a 5-role, 24-entity, backend-driven
system that **does not match** the 11-role, localStorage, dual-EMS/PMS
reality. A new hire reading the specs will build the wrong mental model.
`PROJECT_OVERVIEW.md` and the ADR reconciliation (through ADR-036) are the
correction; the numbered specs should be marked historical.

### G21. Two parallel role/permission truths risk diverging. **[Verified]**
Roles live in `constants/roles.js` (11) but the human-readable
`02_Roles_and_Permissions.md` still lists 5, and the permission matrix is
hand-maintained per module. Adding a role means editing several files with
nothing checking they agree. A test asserting "every ROLE has a row in every
PERMISSIONS module" would catch drift cheaply.

---

## Triage summary

| If you have… | Fix, in order |
|---|---|
| One day | G7 (delete plaintext passwords), G2/G20 (stop presenting fake audit + stale specs as real), G5 (`crypto.randomUUID`) |
| One week | G11 (Vitest on the money math), G12 (frontend CI), G16 (xlsx), G13/G14 (date + fallback correctness) |
| Before real users | G1 + G6 (backend as source of truth; server-side authz) — everything else is downstream of these two |

The through-line: **the app is an excellent, fast-moving prototype whose
"database," "auth," and "audit trail" are all client-side illusions.** That
was the right call for weekly CEO demos under changing requirements. It is
the wrong foundation for the moment this holds real financial records — and
that transition (G1/G6) is the project's central unfinished work.
