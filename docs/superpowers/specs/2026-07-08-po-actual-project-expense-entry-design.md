# PO Self-Service Actual Project Expense Entry — Design Spec

**Date:** 2026-07-08
**Modules:** PMS Project Detail (`src/modules/pms/project-associate/`), `src/services/localProjectExpenses.js`
**Status:** Approved by user

## Context

The Expense tab (`ExpensePanel` in `MonthlyPlanPanel.jsx`) already lets the PO pick a month and see that month's planned Admin/HR/Core pool split, with Send/Revoke to unlock HR to log actual admin spend in EMS (see `2026-07-02-project-actual-spend-tracking-design.md`). But the **Project** pool — the direct task/phase cost the PO actually plans in the Monthly Plan tab (design/implementation/monitoring line items) — has no actual-expense tracking anywhere. `ActualSpendPanel` (below Planning Summary, same file) literally renders "— not yet tracked" for it.

The user's ask: give the PO a place to record what the Project pool actually cost, month by month, next to what was planned — without adding EMS/HR in the loop (this is the PO's own direct spend, not overhead routed through HR).

Confirmed via discussion:
- Scope is the **Project pool only** — Admin/HR/Core stay HR's job via EMS, unchanged.
- It replaces the "✅ Tasks" card in `ExpensePanel`'s 4-card grid — a straight swap, not an addition (Tasks stay visible elsewhere: Project Milestones tab already lists tasks per milestone).
- **The PO's users are used to Excel.** The entry surface must be as plain as a spreadsheet row — a date, a short description, an amount, an Add button, and a plain running list. No badges, no progress bars, no variance-colored pills, no multi-step flow. One visible number comparing planned vs. logged is enough; the rest of this codebase's richer visual language (gradients, pill badges, icons-in-circles) does not belong in this one card.

## Design

### 1. `localProjectExpenses.js` — add `'project'` to `VALID_POOLS`

One-line change: `const VALID_POOLS = ['admin', 'hr', 'core', 'project']`. Everything else (`list`, `create`, `remove`, `sumForMonth`) is already generic over `pool` and needs no change. Update the file's header comment, which currently says "Only pool: 'admin' is exposed in the UI so far" — it's no longer accurate once this ships.

### 2. `ExpensePanel` — replace the Tasks card with a plain "Actual Expense" card

Same `CCol xs={12} md={6}` slot currently holding the Tasks card (first card in the 2x2 grid). New card, scoped to the panel's already-selected `month`:

- Header: plain text "Actual Expense" (no emoji, no count badge — keep it quiet, matching the plain-entry goal; the rest of the panel already has enough emoji headers).
- One line under the header, plain text, no color-coding: `Planned ₹X · Logged ₹Y · Remaining ₹Z` (Z = X − Y, shown as a plain negative number if overspent — no red/green, no "over budget" language; the PO can read a minus sign).
- A plain list of this month's logged entries, spreadsheet-row style: `date — description — ₹amount` with a small delete (✕) control per row, gated on `canEdit`. No card-within-card, no icons.
- Below the list (or if empty, in place of it), a single-row add form when `canEdit`: three plain inputs — Date, Description, Amount (₹) — and one "Add" button. No recurring/category options, no notes field, no second confirmation step. Enter key on the amount field also submits (small affordance, matches spreadsheet muscle memory).
- Data operations: `localProjectExpenses.list({ projectId: project.id, pool: 'project', month })` for the list and the "Logged" sum; `localProjectExpenses.create({ project_id: project.id, pool: 'project', month, amount, label, createdBy: currentUser })` on Add; `localProjectExpenses.remove(id)` on delete. Planned figure is the existing `computeEffectiveProjectMonthly(project, month)` (already imported and used elsewhere in this file).
- Validation: mirror the service's own validation (amount > 0, description required) by disabling Add until both are filled with a positive amount — no separate error alert component; an empty/invalid Add button click simply does nothing (matches "don't confuse them" — no modal, no red banner for a spreadsheet-simple form).
- When `!canEdit`: show the list and the Planned/Logged/Remaining line only, no add row, no delete controls (view-only, same convention as the rest of this panel).

### 3. `ActualSpendPanel` — wire the "Project" column to real data

Currently the table (Month / Planned Admin / Actual Admin / Variance / Project / HR / Core) hardcodes Project/HR/Core to a static "— not yet tracked" cell. Change only the **Project** column to mirror how Admin already works: `computeEffectiveProjectMonthly(project, m.month)` for planned, `localProjectExpenses.list({ projectId: project.id, pool: 'project' })` summed per month for actual (same `actualForMonth`-style helper already used for Admin, generalized to take a pool argument or duplicated once for Project — whichever keeps the diff smallest). HR/Core columns are untouched, still "— not yet tracked".

## Out of scope

- Any Admin/HR/Core actual-entry UI change — those stay exactly as they are (HR via EMS).
- Editing a logged entry after creation (delete + re-add covers corrections; matches the "simple" requirement — no inline edit mode for this card).
- Any reconciliation with `project.expense_accounted` / `committed_expense` (those are separate, manually-set top-level fields on the project record, unconnected to the granular per-month `localProjectExpenses` entries — a pre-existing inconsistency in this codebase, not something this change fixes).
- Any Send/Revoke-style gating on Project-pool entry — the PO can log directly, no unlock step (unlike Admin/HR/Core, which route through HR/EMS).
