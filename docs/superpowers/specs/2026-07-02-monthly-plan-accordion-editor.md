# Monthly Plan Accordion Editor — Design Spec

**Date:** 2026-07-02
**Module:** PMS Project Detail — Monthly Plan tab (`MonthlyPlanPanel.jsx`)
**Status:** Approved by user

## Context

The current `BlockPlanner` (built earlier this session) lets the Project Officer define planning "blocks" via two month-range dropdowns (start/end) per block. The user found this confusing — by default only the project's first month is targeted, and there was no way to add/remove phase/task lines once a plan was generated. Confirmed via discussion: replace the block-range UI with a per-month accordion (click a month to expand/edit it independently), add a "copy this month to all months" convenience action, and let phase/task lines be added/removed both before and after Generate.

This is a UI-only change. No modification to `localProjects.js` or `monthlyApportionment.js` — the existing `generateMonthlyPlan(projectId, blocks)` and `updateMonthPlan(projectId, month, phases)` APIs are reused exactly as they are today.

## Design

### 1. Month accordion replaces block-range pickers (`BlockPlanner` → `MonthAccordion`)

One row per `monthsInRange(project.start_date, project.end_date)` entry, collapsed by default, showing the month label and its current line-item total. Clicking a row expands it to show that month's own phase/task/amount line editor (the existing line-editor JSX, reused per month instead of per block) with Add Line / Remove Line controls. State shape: `Array<{ month, lines: Array<{phase, label, amount}> }>`, one entry per project month, seeded from `project.plan_blocks` if present (each block expanded back to its covered months) or empty lines otherwise.

An expanded month gets a "📋 Copy to all months" button: copies that month's current `lines` array (deep-cloned) into every other month's local state. This is a one-time copy, not a persistent link — every month remains independently editable afterward, including via this same copy action again later.

### 2. Generate — same underlying call, new block construction

Clicking Generate filters the accordion state down to months with at least one non-empty line (label + positive amount), maps each into a single-month block (`{ startMonth: month, endMonth: month, phases }`), and calls `localProjects.generateMonthlyPlan(project.id, blocks)` — completely unchanged from today. Months left empty in the accordion are simply absent from the blocks array, so the existing remainder-distribution logic fills them in automatically. If every month is filled in, the existing exact-match validation applies, same as today. The existing regenerate-confirmation dialog (shown when `project.monthly_plan` already exists) is preserved.

### 3. `PlanTable` gains add/remove phase lines

Today `PlanTable` renders each month's `phases` with an editable amount input only (label/phase shown as static text/badge). This adds: the label becomes an editable text input, phase becomes a dropdown (matching the accordion's line editor), and Add Line / Remove Line buttons appear per month row. All three write through the existing `localProjects.updateMonthPlan(project.id, month, phases)` — no service-layer change, just more of `PlanTable`'s existing `handleAmountChange`-style pattern applied to label/phase/add/remove as well.

## Out of scope

- Any change to `localProjects.js`, `monthlyApportionment.js`, or the withdrawal (`addPoolAdjustment`) feature — untouched.
- Persistent linking between months after a "copy to all" — explicitly a one-time copy, not a sync.
- Validation changes to `generateMonthlyPlan` — the existing balance-checking behavior is reused as-is.
