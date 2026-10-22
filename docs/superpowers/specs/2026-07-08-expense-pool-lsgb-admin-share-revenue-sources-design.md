# Expense Pool: LSGB Revenue + Core's Admin 5% Share — Design Spec

**Date:** 2026-07-08
**Modules:** EMS Expense Pools (`src/modules/ems/hr-pool/`), `src/services/localOrgPool.js`
**Status:** Approved by user

## Context

The EMS "Expense Pools" page (`GlobalHRPoolPage.jsx`) renders three `ExpensePoolCard` instances — HR, Admin, Core — each with an "Add Expense" form containing a **Revenue Source** selector (`RevenueSourceSelector` in `ExpensePoolCard.jsx`). Today that selector hardcodes exactly two sources: **HR Revenue** (a computed total: recruitment + training + internship income) and **Project Pool** (that card's own per-project % cut, labeled per pool via `poolFundLabel` — "Project 5% Pool" for HR, "Project 5% Admin Pool" for Admin, "Core 5% Pool" for Core). When both are checked, a %/₹ split is required to sum to 100%; the split is purely a display attribution — only the `project_pool` portion (`project_pool_pct`) ever affects real budget math (`getMonthly*PoolBudgetSummary`, `getProjectsMonthly*Remaining` in `localOrgPool.js` all filter `sources.includes('project_pool')` — `hr_revenue_pct` is stored but never read back for any calculation).

This same page already computes `localLsgb.getSummary()` (LSGB bodies' sanctioned funds minus withdrawals) and shows it as a static read-only line — "LSGB Fund Balance: ₹X (₹Y sanctioned − ₹Z withdrawn)" — between the Admin and Core cards, explicitly commented "info line, unrelated to Core 5% pool math." The user asked to wire that number into the actual revenue-source mechanism, plus add a second, Core-only source representing salaries that are actually funded by pulling from the Admin pool's own 5% share.

Two independent additions, confirmed via discussion:

1. **LSGB Revenue** — a third revenue-source option on **all three** pool cards (HR, Admin, Core), informational only (like HR Revenue today) — its balance is `localLsgb.getSummary().remaining`, not reduced by prior usage (matches HR Revenue's existing non-cumulative "available" check, which only compares against the current expense being entered).
2. **Admin 5% Share** — a fourth revenue-source option, **Core card only**. Unlike HR/LSGB Revenue, this is a *real cross-pool deduction*: money tagged this way must count against Admin's own monthly budget (`getMonthlyAdminPoolBudgetSummary`/`getProjectsMonthlyAdminRemaining`), which today only scan Admin's own expense list. No per-project allocation breakdown for this portion — it's a flat monthly draw against Admin's aggregate remaining budget, explicitly scoped down from Core's own Project Pool source (which does have full per-project allocation editing) because the need described is "some salaries pull from Admin's pot too," not per-project attribution of whose admin-cut funded it.

## Design

### 1. Generalize `RevenueSourceSelector` from 2 hardcoded sources to a configurable list

Currently `revSources`/`hrRevPct`/`projPoolPct` assume exactly two possible sources with hardcoded pairwise complement math (toggling one sets the other to 100 − x). Generalize to operate over whichever sources are active for a given card instance:

- **HR and Admin cards:** 3 possible sources — `hr_revenue`, `project_pool`, `lsgb_revenue`.
- **Core card:** 4 possible sources — `hr_revenue`, `project_pool`, `lsgb_revenue`, `admin_pool`.

New state in `ExpensePoolCard.jsx`: keep the existing `hrRevPct`/`projPoolPct` named state variables (unchanged shape, minimizes diff against the many existing references to them — `handleAdd`, `isSplitValid`, the allocation-preview `useEffect`, `resetAddForm`), and add two more of the same shape: `lsgbRevPct` (all cards) and `adminSharePct` (Core card only, always `0` and unused on HR/Admin).

**Toggle behavior**, generalized from the existing 2-source version: on toggling any source on/off, redistribute 100% evenly across whichever sources end up selected (this matches today's exact behavior for 2 sources — single selection is always 100%, two selections reset to 50/50 — extended to 3 or 4 evenly, with a rounding-remainder fix so percentages always sum to exactly 100, e.g. 3-way split is 33.34/33.33/33.33 not 33.33/33.33/33.33).

**Manual percentage editing**, generalized from `handleHrPctChange`/`handlePoolPctChange`: when the user edits one selected source's %, redistribute the remainder proportionally across the *other currently-selected* sources — this reuses the exact proportional-redistribution-with-rounding-fix algorithm this file already applies to per-project allocation splitting (`handleAllocPctChange`), just applied to the revenue-source axis instead of the project axis, generalized from a hardcoded pair to however many sources (2–4) are currently selected.

**`isSplitValid()`** generalizes from "if HR Revenue and Project Pool are both selected, they must sum to 100" to "if 2 or more sources are selected, all their percentages must sum to exactly 100" (a single selected source is always 100% and always valid, matching today).

### 2. New "LSGB Revenue" row (HR, Admin, Core cards)

New checkbox row in `RevenueSourceSelector`, styled like the existing HR Revenue / Project Pool rows (own accent color, distinct from HR's `#4cc9f0` blue and Pool's `#06d6a0` green — using `#f77f00` orange), with the same "Available: {fmt(lsgbAvailable)} − {fmt(drawn)} this expense → {fmt(remaining)} remaining" line HR Revenue already has, non-cumulative (only ever compares against the expense currently being entered, exactly like HR Revenue does — it does not track or subtract prior usage across previously-logged expenses).

- New prop threaded through `GlobalHRPoolPage.jsx` → `ExpensePoolCard` → `RevenueSourceSelector`: `lsgbAvailable={lsgbSummary?.remaining || 0}`, passed identically to all three `ExpensePoolCard` instances (mirrors how `hrRevenueTotal` is already threaded to all three).
- `handleAdd()` stores `lsgb_revenue_pct: lsgbRevPct` on the new expense record alongside the existing two pct fields.
- `localOrgPool.js`'s `addHRExpense`/`addAdminExpense`/`addCoreExpense`: accept and persist `expense.lsgb_revenue_pct` the same way `hr_revenue_pct` is handled today (parsed, defaulted to `0`, stored — never read back for any budget calculation, matching `hr_revenue_pct`'s existing behavior).
- Expense list badges (`ExpensePoolCard.jsx`'s rendered list, ~line 1117 today): add a third pill — "LSGB Revenue" (+ `{lsgb_revenue_pct}%` shown whenever 2+ sources are tagged on that expense, matching how the existing two badges already show their % once more than one source is present).
- `GlobalHRPoolPage.jsx`'s per-project card badge (~line 396, shows "HR Rev" tags on individual project allocation cards): add the equivalent "LSGB Rev" tag for consistency, same simple pattern (no %, just presence).
- The existing "LSGB Fund Balance (info line, unrelated to Core 5% pool math)" comment is now inaccurate once this ships — update it to note the figure now also feeds the revenue-source selector on all three cards.

### 3. New "Admin 5% Share" row (Core card only)

Fourth checkbox row, Core-only — `ExpensePoolCard` gets a new boolean prop `showAdminShare` (`true` only for the Core instance in `GlobalHRPoolPage.jsx`), gating whether `RevenueSourceSelector` offers this fourth option at all (HR/Admin cards never render it, never allow `admin_pool` into their `revSources`).

Unlike HR/LSGB Revenue, this behaves like **Project Pool** — a real, budget-capped draw, not a static informational check:

- New prop `adminPoolBudgetSummary` passed only to the Core `ExpensePoolCard` instance: `{ totalMonthlyBudget, usedThisMonth, remaining }` from `localOrgPool.getMonthlyAdminPoolBudgetSummary(month)` (already exists, used today by the Admin card for its own Project Pool cap alert — reused here read-only by Core).
- The existing "Budget Cap Alert" block (today rendered only when `hasPool`, using `poolBudgetSummary`) gets a second, parallel instance for `hasAdminShare` using `adminPoolBudgetSummary` instead — same over-budget warning treatment, applied to a second source.
- **No per-project allocation editor** for this portion — no `computeAllocations` call, no "Distributed across N active projects" preview/edit table for the admin-share amount. It's stored as a flat amount: `admin_share_pct` on the Core expense record, and the ₹ amount it represents (`totalAmt × adminSharePct / 100`) is simply added to Admin's own "used this month" total in aggregate — not attributed to any specific project.
- **Cross-pool budget math** (the part that makes this a "real deduction," not a tag): `localOrgPool.js`'s `getMonthlyAdminPoolBudgetSummary(month)` and `getProjectsMonthlyAdminRemaining(month)` currently compute `usedThisMonth` only by scanning `this.getAdminExpenses()`. Both are extended to *also* scan `this.getCoreExpenses()` for entries where `revenue_sources.includes('admin_pool')`, adding `amount × admin_share_pct / 100` into the running total (`getMonthlyAdminPoolBudgetSummary`) — and, since there's no per-project split for this portion, `getProjectsMonthlyAdminRemaining` distributes each such Core-sourced amount across Admin's active projects proportionally by their existing `monthlyBudget` share (the same fallback proportional-split logic that function already uses today when a plain Admin expense has no `project_allocations` of its own).
- `localOrgPool.js`'s `addCoreExpense`: accepts and persists `expense.admin_share_pct` (parsed, defaulted to `0`), added to `revenue_sources` as `'admin_pool'` when selected. No allocation array is computed or stored for this source.
- Expense list badge: Core's expense list gets a fourth possible pill, "Admin 5% Share" (+ % once 2+ sources are tagged), same pattern as the other three.

## Out of scope

- Any change to the existing HR Revenue / Project Pool sources' own behavior, math, or styling beyond what's needed to generalize the selector from 2 to N sources.
- Per-project allocation breakdown for the Admin 5% Share portion (explicitly cut — flat aggregate draw only, per user confirmation).
- Any change to `CorePoolPage.jsx`'s separate "Global Core Pool" salary-expense list (`hma_core_salary_expenses`) — that's a different page/store entirely from `localOrgPool`'s `core_expenses`, not touched by this work.
- Any change to the LSGB module itself (`localLsgb.js`, `LsgbOverviewPage.jsx`, `LsgbFundsPage.jsx`, `LsgbAnalysisPage.jsx`) — LSGB Revenue here only *reads* `localLsgb.getSummary()`, exactly as the existing info line already does.
- Making LSGB Revenue's "available" figure cumulative (tracking prior usage across previously-logged expenses) — explicitly matches HR Revenue's existing non-cumulative behavior, not a new stricter standard.
- Editing revenue sources on an already-created expense — `revenue_sources` and all `*_pct` fields remain set-once-at-creation only, matching current behavior (the edit form only ever touches `label`/`amount`/`date`).
