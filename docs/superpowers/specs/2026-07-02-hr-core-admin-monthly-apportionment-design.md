# HR / Core / Admin Monthly Apportionment — Design Spec (v2)

**Date:** 2026-07-02
**Module:** PMS Project Detail / EMS Expense Management (frontend prototype, `hma-template/emsv1`)
**Status:** Approved by user, pending implementation plan
**Supersedes:** `docs/superpowers/specs/2026-07-01-hr-core-admin-apportionment-design.md` (the simpler flat-rate-ledger model). That spec's Task 1 code was implemented, reviewed, then discarded (`git reset --hard`) once this richer architecture was provided — nothing from the old spec carries over except the general vocabulary (Admin/HR/Core pools, activation gating).

## Background

The previous design used a single flat monthly rate per pool (HR/Core), computed once at activation and only changing via a manually-triggered withdrawal. The user has since described a materially richer model: a Project Officer plans an actual month-by-month execution budget (not a flat average), HR/Core/Admin are carved out of that plan on a percentage basis that can vary per month, and the system automatically reconciles the plan against real spending every month — including a formula-driven clawback when a project overspends into HR/Core's share, and a leftover-redistribution mechanic when a project starts late or underspends.

## Scope for this spec

This spec covers the **project-level planning and apportionment engine only** — the monthly plan template, the Admin/HR/Core split, activation gating, and the spend-driven reconciliation rules. It explicitly excludes (per user decision) a broader company-wide expense-forecast-vs-project-comparison / profit-loss reporting feature, which is large enough to warrant its own future spec once this engine exists and produces real data to report on.

## Section 1 — Admin: locked lump sum

- At project creation (or the first time `project_value` becomes known), Admin's percentage (`admin_pct`, default 5%, PO-adjustable) is computed against the **original total project value** and credited once as `admin_pool_amount`, e.g. 10L × 5% = 50K.
- This amount is locked — never recomputed or affected by activation timing, late starts, underspend/overspend, or any of the redistribution rules below. It is only ever spent down against (existing admin expense tracking), never resized.
- It is shown as an even monthly display row (`admin_pool_amount ÷ duration`) purely for reporting consistency with the HR/Core tables — this row has no calculation behind it beyond simple division; it does not participate in Sections 5–7.

## Section 2 — Working pool and the baseline table

- **Working pool** = `project_value − admin_pool_amount` (e.g. 9.5L).
- **Baseline monthly table** = working pool ÷ project duration in months, generated immediately once `project_value` and `start_date`/`end_date` are set (e.g. 95K × 10 months). This is the starting reference for Section 3 — it is the *total pot* for each month before any Project/HR/Core split.

## Section 3 — Monthly planning template

- The Project Officer plans **one representative month** as a set of phase line items — Design, Implementation, Monitoring — each with a task/activity description and an amount. The line items for that month sum to that month's total pot.
- Clicking **Generate** replicates that same line-item template across every remaining month of the project duration, producing a full month-by-month plan in one action (10 months in the running example).
- After generation, every individual month's line items remain editable — the PO can rebalance a design-heavy month down and an implementation-heavy month up to reflect the project's real phase timeline.
- **Validation:** the sum of all months' totals must equal the working pool (9.5L) exactly. The UI must show a running total vs. target and block/flag saving a plan that doesn't balance.
- This produces, per month: `{ month: 'YYYY-MM', phases: [{ phase: 'design'|'implementation'|'monitoring', label, amount }], total }` where `total = sum(phases[].amount)`.

## Section 4 — HR / Core percentage per month

- Independently of Section 3's phase planning, the PO sets an HR% and Core% for **each month individually** (default 5%/5%, adjustable via up/down arrow controls — not a single project-wide setting).
- For a given month, that month's HR%/Core% is applied against **that same month's total pot** (Section 3's `total` for that month) — carved out of it, not additive on top of it.
- The Project's own usable execution budget for that month is the residual: `projectAmount = total − hrAmount − coreAmount`.
- In the flat/default case (95K pot, 5%/5%) this reproduces exactly: Project 85K + HR 5K + Core 5K = 95K pot.
- Admin does not participate here — it was already removed once, up front (Section 1), from the original total value, not from any month's pot.

## Section 5 — Activation gating

- HR and Core release nothing until: (1) the Project Officer has assigned at least one task to the project (precondition), and (2) the Project Officer/Associate clicks "Activate Project" (the actual trigger — unchanged from the previous spec; "project coordinator" language elsewhere was informal, not naming the RBAC role).
- Before activation, the plan (Sections 1–4) can still be fully built and edited — activation only gates *release into the live/derived tables*, not planning.
- **UI:** the Activate control renders greyed-out with a "Not Activated" label (not merely a disabled button with a tooltip) until the task-assignment precondition is satisfied.
- The month in which the click occurs becomes the activation month for Section 6's redistribution logic.

## Section 6 — Late-start redistribution (Case 1)

- If activation happens after the project's nominal start month (e.g. project spans January–October but activation lands in March), the months before activation (Jan, Feb) are not released and are not simply dropped — their **planned totals** (Project + HR + Core, each pool separately) are summed and redistributed **evenly** across the remaining active months (March–October), added on top of each remaining month's already-planned figure for that pool.
- This applies to Project, HR, and Core alike — each pool's full entitlement over the project's lifetime is preserved, just compressed into fewer months.
- Admin is unaffected (Section 1 — locked at creation, independent of activation timing).
- This produces a second, system-computed table — the **derived monthly table** — distinct from the PO's static plan (Section 3/4). The derived table is what Section 7's live reconciliation and all release/display logic actually operate on; the static plan is the PO's editable source of intent.
- The derived table is **recomputed live**, not frozen at activation — since Section 3/4 explicitly allow editing the plan at any time ("make all values flexible"), any later plan edit is reflected the next time the derived table is read. There is no separate "lock the plan" step; the plan simply remains editable and the derived/reconciliation math always runs off its current state plus the activation month and actuals recorded so far.

## Section 7 — Spend-driven reconciliation (Cases 2 & 3)

Each month, the system compares **actual project spend** for that month against that month's **derived pot** (Section 6's output for that month, or Section 4's plan if no redistribution applies).

**No existing data source covers this.** The codebase currently only tracks lifetime aggregates per project (`amount_spent`, `expense_accounted`, `committed_expense` — confirmed via `localProjects.js`), not dated line items. This spec adds a new dated expense ledger, `project.project_expenses: Array<{ id, label, amount, date, phase, notes }>` — the Project Officer logs spend against it as work happens (same shape/pattern as the existing `hr_expenses`/`admin_expenses` arrays, just scoped to the project's own execution spend instead of an org-wide pool). "Actual spend for month M" = sum of `project_expenses` entries whose `date` falls in month M.

- **Underspend:** if actual project spend is below the pot's project-share, HR and Core still release their full derived share. The unused project-side leftover rolls forward, added to the remaining months' project-planned totals (distributed evenly across the remaining months, same mechanic as Section 6).
- **Encroachment zone (confirmed linear formula):** once actual project spend rises above the pot's project-share toward the full pot, HR and Core each give up ground linearly and equally:
  ```
  overage = max(0, actualSpend - projectShare)
  hrThisMonth = max(0, hrDerived - overage / 2)
  coreThisMonth = max(0, coreDerived - overage / 2)
  ```
  Worked example: pot 95K = 85K project-share + 5K HR + 5K Core. At 90K spent (overage 5K), each of HR/Core loses 2.5K → both at 2.5K. At 95K spent (overage 10K), both at 0.
- **Overflow beyond the full pot** (actual spend > pot total): the excess is pulled from HR's and Core's **future remaining months** — split 50/50 between the two pools, spread proportionally across the remaining months only (never touching past months, matching the "current month onward" rule from the original spec). This is the same class of redistribution as Section 6, just triggered automatically by overspend rather than a manual action.

## Section 8 — Installments: display only, no calculation coupling

- Installment records (amount, dates, UC status — the existing `project.installments` structure) remain visible in the project's schedule/detail views with their current level of detail.
- Nothing in Sections 1–7's math reads or gates on installment data. Real-world cash-flow timing (whether a specific installment has actually landed) is managed manually by Finance/the project team outside the system — there is no automated "insufficient installment funds" gate to build.

## Section 9 — UI placement

- The monthly planning template (Section 3) and per-month HR/Core % controls (Section 4) are new UI, added to the project detail page (`hma-template/emsv1/src/modules/pms/project-associate/ProjectDetailPage.jsx`) as a new section/tab alongside the existing "Installment Schedule" and "Project Overheads" cards.
- The baseline table (Section 2), derived monthly split (Section 6), and the live plan-vs-actual reconciliation view (Section 7) surface on that same project page (for the PO's own view) and on the EMS Consolidated Sheet / monthly drill-down (`hma-template/emsv1/src/modules/ems/expense-management/ExpenseManagementPage.jsx`) for the cross-project HR/Finance view — same two-surface pattern as the original spec.
- The "Activate Project" control stays in its existing location on the project hero banner, restyled per Section 5.
- No new top-level route is needed — this is new sections within the existing project detail page, plus the existing consolidated sheet reading from the new monthly-plan/derived data instead of the old flat-rate ledger.

## Data model (draft — to be finalized during implementation planning)

Per project, roughly:

- `admin_pct`, `admin_pool_amount`, `admin_pool_credited`, `admin_credited_at` — Section 1 (same shape as the original spec).
- `monthly_plan: Array<{ month: 'YYYY-MM', phases: Array<{ phase, label, amount }>, total, hr_pct, core_pct }>` — the PO's static, editable plan (Sections 3–4). One entry per project-duration month.
- `monthly_derived: Array<{ month, projectAmount, hrAmount, coreAmount, source: 'plan'|'redistributed'|'clawback'|'overflow' }>` — system-computed, factoring in activation-timing redistribution (Section 6) and live spend reconciliation (Section 7). This is what drives all release/display logic; `monthly_plan` is intent, `monthly_derived` is reality.
- `project_expenses: Array<{ id, label, amount, date, phase, notes }>` — new dated ledger of the project's own execution spend, the actuals feed for Section 7 (see Section 7 for rationale — no equivalent exists today).
- `is_operations_active`, `operations_activated_at` — unchanged from the existing codebase.

## Out of scope

- The HR expense-forecast template and the general cross-project profit/loss report (deferred to a future spec, per user decision in this session).
- Any installment-driven gating of release (Section 8 — explicitly ruled out).
- Backend/API persistence — this remains `localStorage`-backed per the existing frontend-prototype pattern; no backend exists yet.
- Repayment/loan tracking for any redistributed or clawed-back amounts (money only ever moves forward in time within the same project; it is never tracked as a debt to repay).

## Implementation scope note

This is substantially larger than a set of formula tweaks — it's a new monthly-planning UI plus a live spend-vs-plan reconciliation engine. Recommend splitting the implementation plan into two parts: (1) the planning template + Admin/baseline/HR/Core-per-month generation (usable and demoable on its own), and (2) the live actuals-driven clawback/redistribution engine (Sections 6–7, which depends on (1)'s data existing first). This split will be proposed again, for confirmation, when the implementation plan is written.
