# Payments Tab Authorization — RBAC Verification

**Date:** 2026-09-06
**Scope:** Phase 2-4 deployment, Task 7 — confirm only HR/Admin can see and
use the Payments tab (Expense Management), and that the AWS billing
credential is hidden from everyone else.

## Method

1. Static review of the gating logic:
   - `src/constants/permissions.js` — `MODULE.EXPENSE_MANAGEMENT` matrix.
   - `src/hooks/usePermission.js` / `src/components/ProtectedRoute.jsx` —
     how `view`/`edit` access is resolved (Admin short-circuits to full
     access; everyone else looked up in the matrix).
   - `src/modules/ems/expense-management/PaymentsPage.jsx` — the Payments
     tab itself gates the AWS credential card on
     `usePermission(MODULE.EXPENSE_MANAGEMENT, 'edit')`.
   - `supabase/migrations/00000000000059_payment_credentials.sql` — the
     real security boundary. `payment_credentials` has RLS restricting
     `select`/`write` to `current_user_role() in ('admin', 'hr')`,
     independent of anything the frontend does.
2. Live browser verification: started the Vite dev server
   (`npm run start`, `VITE_DEV_LOGIN=true`) and drove it with a headless
   Chromium (Playwright) through the app's built-in "Dev quick-login"
   buttons on the login screen, which sign in as real seeded dev/demo
   accounts (one per role). For each role: opened Expense Management,
   checked whether the **Payments** tab exists, and — if it does — opened
   it and checked whether the AWS card renders as the editable/managed
   card or the "AWS billing access is managed by HR/Admin" restricted
   card.

## Results

| Role | Payments tab visible? | AWS credential card |
|---|---|---|
| HR | Yes | **Managed** (Set Up/Edit, sign-in buttons) — has `edit` |
| Admin | Yes | **Managed** — Admin short-circuits to full access |
| Finance (Heads) | Yes | Restricted — "managed by HR/Admin" |
| CEO | Yes | Restricted — "managed by HR/Admin" |
| Project Coordinator | Yes | Restricted — "managed by HR/Admin" |
| Project Officer | **No** — entire Expense Management page returns a "No Access" screen (`EXPENSE_MANAGEMENT` is `ACCESS.NONE` for this role), so the Payments tab is unreachable | n/a |

(Project Associate was not separately screenshotted; it has the same
`ACCESS.VIEW` as Project Coordinator/Finance/CEO in the permissions
matrix, so it renders identically — tab visible, credential restricted.)

Screenshots for each role are attached to this test run (not committed —
local artifacts only).

## Credential visibility (Step 5)

The frontend `canEdit` check above decides whether the app even *attempts*
to fetch the stored AWS login — non-HR/Admin roles render
`AwsRestrictedCard` and skip the fetch entirely. Even if that frontend
check were bypassed, the Supabase `payment_credentials_select` RLS policy
independently restricts `select` to `admin`/`hr`, so no other role's
session can read the row regardless of UI state. This session's sandbox
network policy blocked outbound calls to the project's Supabase host
(403 at the egress proxy), so the live run could not complete an actual
authenticated round-trip against production RLS — that half of the
verification is by source/migration review rather than a live query. The
frontend gating behavior above (which role sees which card) **was**
verified live.

## Conclusion

Matches the success criteria: HR/Admin can see and manage the AWS
credential; Finance, CEO, Project Coordinator and Project Associate can
see the tab and the link-only cards (Claude, Supabase) but not the AWS
credential; Project Officer cannot see the tab (or the module) at all.
No code changes were required — existing implementation (commits
`a9001b8`..`b252f13`) already satisfies this.
