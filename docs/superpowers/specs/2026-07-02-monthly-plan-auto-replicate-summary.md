# Monthly Plan Auto-Replicate + Planning Summary — Design Spec

**Date:** 2026-07-02
**Module:** PMS Project Detail — Monthly Plan tab (`MonthlyPlanPanel.jsx`)
**Status:** Approved by user

## Context

Follow-up to the month accordion editor (`MonthAccordion`) shipped earlier this session. Two gaps found in use: (1) the accordion required an explicit "Copy to all months" click even for the common case of wanting every month to start identical, and (2) there was no summary of the plan's totals or whether it's actually fundable.

## Design

### 1. Auto-replicate on first valid month

`MonthAccordion` gains a `hasAutoReplicated` boolean ref/state, initialized to `true` if `project.plan_blocks?.length` already exists (reopening an already-configured plan never triggers this), else `false`. After any line edit, if `hasAutoReplicated` is still `false` and the just-edited month now has at least one complete line (`label.trim() && parseFloat(amount) > 0`, the same validity check `Generate` already uses), copy that month's lines into every *other* month that is still at its default single-empty-line state, then set `hasAutoReplicated = true` so this never fires again this session. The manual "📋 Copy to all months" button is unchanged and still available afterward for re-syncing on demand.

### 2. Planning Summary card

New `PlanningSummary` component, rendered inside `MonthlyPlanPanel` below `PlanTable` (only when `project.monthly_plan?.length`). Reads only existing data/functions (`computeEffectivePoolMonthly`, `validatePlanTotal`, `computeWorkingPool` — all already imported/used elsewhere in this file):

- **Totals row**: Project (`sumPlanTotal`-style sum of each month's `total`), Admin/HR/Core (sum of `computeEffectivePoolMonthly` per pool across all months), and a grand total of all four.
- **Run verdict**: `validatePlanTotal(project.monthly_plan, computeWorkingPool(project)).valid` → "✅ Can run as planned" or "❌ Off by ₹X — won't run as planned."
- **Phase breakdown**: sum of all months' phase-line amounts grouped by `phase` (design/implementation/monitoring).
- **Per-month mini table**: one row per month, Project/Admin/HR/Core columns, read-only.
- **Line count**: total number of phase/task lines across the whole plan.

## Out of scope

- No change to `localProjects.js` or `monthlyApportionment.js` — pure UI, reading existing data.
- The run verdict uses the existing balance-vs-baseline check only (not actual-funds-received) per user's confirmed choice.
