# Playwright System Audit — Connectivity, Dummy Values, Buttons

**Date:** 2026-07-14
**Status:** Approved (user confirmed: recommended defaults + button checks)

## Goal

Drive the running app with Playwright across every EMS + PMS page to verify:
1. **Connectivity** — every displayed figure comes from a real service
   (localStorage stores), not a hardcoded literal in the JSX.
2. **No dummy values** — no `NaN`, `undefined`, `[object Object]`,
   `Invalid Date`, lorem/TODO/sample text rendered anywhere.
3. **Buttons work** — tabs switch, dropdowns open, collapses expand,
   modals open and close. Broken interactions get fixed.
4. **Text fields work** — every visible enabled `input`, `textarea`,
   `select` accepts a typed/selected test value (value registers, no
   page errors). Type-only: forms are never submitted, so no junk
   records are created.

## Decisions (from clarification)

- **Seed data is real.** The 17 SDP CSV projects and 73 THLL employees are
  the intended dataset. Only true placeholders/hardcoded/disconnected
  values are findings.
- **Fix everything found**, then re-run the audit to confirm green.
- **Coverage: full EMS + PMS** — every non-`:id` route, both systems.
- **Buttons:** click non-destructive interactive elements; skip anything
  matching delete/remove/trash/logout/sign-out and file inputs.

## Method

1. `npm start` (vite, port 3000) in background.
2. Plain `playwright` (already in node_modules) script at
   `scratchpad/audit.mjs` (not committed):
   - `addInitScript` sets `localStorage.hma_token = 'dev-token-DEV000'`
     (Dev Admin) — dev-mode bypass in `services/auth.js`.
   - Visit every route from `ems.routes.js` + `pms.routes.js`.
   - Per page collect: console errors, pageerrors, failed requests,
     dummy-pattern matches in `document.body.innerText`
     (`NaN`, `undefined`, `[object Object]`, `Invalid Date`, `Lorem`,
     `TODO`, `FIXME`, `₹NaN`, `--`), screenshot.
   - Interactive sweep: for each visible enabled `button, [role=button],
     .nav-link` (max ~40/page), click; assert no pageerror; close any
     modal via backdrop/Close; skip destructive labels.
   - Cross-checks (connectivity spot checks, computed in-page from
     localStorage and compared to rendered text):
     a. Detailed Report Total Revenue = HR ledgers + TPC pool + LSGB withdrawn
     b. Core Pool payroll totals = sum of employee salaries
     c. Consolidated Sheet project count = localProjects count
     d. GST bills grid total vs localGstBills
3. Placeholder pages (route element = `Placeholder`) are **reported as
   known-intentional**, not fixed (out of scope to build them).
4. Findings triage → fix code → re-run audit → both runs' summaries in
   final report.

## Acceptance criteria

- Audit script completes over all routes with zero uncaught page errors,
  zero dummy-pattern matches (excluding known-intentional placeholders),
  zero broken buttons, and all cross-checks equal.
- Fixes are minimal diffs, lint-clean, `npm run build` passes.

## Out of scope

- Building out intentional Placeholder pages.
- Backend/API paths (app is localStorage-first by design).
- Visual/styling issues that don't affect correctness.
