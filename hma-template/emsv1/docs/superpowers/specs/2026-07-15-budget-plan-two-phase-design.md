# Two-Phase Project Budget Plan (Planning → Actual) — Design Spec

**Date:** 2026-07-15
**Status:** Approved design, pending implementation plan
**Replaces:** the combined Monthly Plan table in `MonthlyPlanPanel.jsx` (planned + actual mixed inline, auto-cascade pool math)

---

## 1. Problem & Goals

Today the Monthly Plan tab mixes planned and actual amounts on the same
phase lines, has no draft/submit lifecycle, and funds over-planned months
through implicit auto-cascade adjustments. That auto-cascade produced a
real bug: a plan using 96% of project value silently handed a full 5% to
Admin, pushing HR and Core negative.

This feature splits budgeting into two explicit phases:

1. **Planning phase** — the Project Officer (PO) plans every rupee of the
   project's working pool (85% with default pool percentages) month by
   month, settles every surplus/deficit explicitly, and submits.
2. **Actual expense entry phase** — after submit, planned figures are
   locked; the PO enters real spend against each planned line and settles
   variances. Actual-phase settlements are what actually move money to
   HR/Core/Admin.

**Goals:**
- Every money movement is an explicit, revocable ledger record — no
  silent cascades.
- Pools (HR/Core/Admin) can never go negative — structurally, not by
  validation after the fact.
- The grand invariant always holds: month budgets + HR + Core + Admin =
  total project value.
- Submit is blocked until every month is settled to the paisa.
- PO-facing UI is Excel-plain: plain bordered tables, plain inputs, no
  gradients or badges.

**Out of scope:**
- Migration of existing `monthly_plan` data — projects **start fresh**
  with the new model; the old `monthly_plan`, `pool_adjustments`, and
  `sent_allocations` fields are ignored by the new UI.
- HR/EMS-side expense logging changes beyond the "Money transferred — ₹0"
  display rule (Section 7).
- Backend/API work — this remains a localStorage-backed module like the
  rest of the PMS prototype.

---

## 2. Lifecycle

Stored as `project.budget_plan.status`:

```
(no plan)
   │  PO enters project value + duration on the project;
   │  Monthly Plan tab shows the split preview (working pool,
   │  per-month even split, Admin/HR/Core totals)
   │  [Initialize Plan]
   ▼
planning        draft; everything editable; Save/Reset/Full Delete available
   │  [Submit Plan]  — blocked until settlement checks pass (Section 5)
   ▼
submitted       planned figures locked; actual entry open;
                new task rows may still be added (flagged added_in_actual)
```

- **Locked after submit:** planned amounts, task structure created during
  planning, and planning-phase transfers are frozen at submit. The PO may
  still add *new* tasks/subtasks in the actual phase.
- **Full Delete** (planning phase only) removes `budget_plan` entirely and
  returns the project to the Initialize step.

---

## 3. Data Model

New versioned object on the project record. Old fields are untouched but
unused by the new UI.

```js
budget_plan: {
  version: 2,
  status: 'planning' | 'submitted',
  submitted_at: null | ISOString,

  // Captured at initialize time from the project's admin_pct/hr_pct/core_pct
  // (defaults 5/5/5). These are the CAPS: the PO may lower hr/core during
  // planning but never raise them above these values. admin is system-only.
  pool_pct: { admin: 5, hr: 5, core: 5 },

  months: [
    {
      month: 'YYYY-MM',
      tasks: [
        {
          id,
          phase: 'design' | 'implementation' | 'monitoring',
          name: 'Training',
          recurring: false,        // true when created by Recurring Tasks
          added_in_actual: false,  // true for rows added after submit
          subtasks: [
            {
              id,
              name: 'Venue rent',
              planned_amount: 5000,   // rupees; stored math runs in paise
              actual_amount: 0,       // meaningful only after submit
              actual_status: 'pending' | 'entered' | 'transferred'
            }
          ]
        }
      ]
    }
  ],

  // THE LEDGER. Every rupee that moves is one explicit record.
  // All balances are derived by replaying this — nothing else stores money.
  transfers: [
    {
      id,
      phase: 'planning' | 'actual',   // which phase created it
      origin_month: 'YYYY-MM',        // the month whose surplus/deficit caused it
      from: 'month:YYYY-MM' | 'hr' | 'core' | 'admin',
      to:   'month:YYYY-MM' | 'hr' | 'core',
      amount: 2000,                    // always positive; direction is from→to
      created_at, created_by
    }
  ],

  // Set by [Save]. [Reset] restores this; if null, Reset restores the
  // freshly initialized empty state (empty task lists, empty ledger).
  saved_snapshot: null | { months, transfers, saved_at }
}
```

**Task shape:** nested — a task groups subtasks; amounts live only on
subtasks; a task's total is the sum of its subtasks. Each subtask line is
Phase (inherited from task) / Task / Subtask / Amount.

**Derived values (never stored):**

| Value | Formula |
|---|---|
| Working pool | `project_value × (100 − admin − hr − core)%` |
| Month baseline | working pool ÷ month count (even split) |
| Month allocated budget | baseline + Σ ledger transfers *to* the month − Σ transfers *from* the month |
| Month planned total | Σ subtask `planned_amount` in the month |
| Pool balance (hr/core/admin) | `pct% × project_value` + Σ transfers to pool − Σ transfers from pool |
| Grand invariant | Σ month allocated + hr + core + admin = project_value — holds by construction (ledger is zero-sum) |

**Pool clamping:** a transfer that would push any pool below zero is
rejected at entry (validation error, nothing written). HR and Core also
cannot be raised above their `pool_pct` caps. This structurally fixes the
96%-plan bug: HR/Core drain to ₹0 first, and only a genuine remainder may
draw from Admin (Section 5), never a fixed 5%.

**Split rule:** whenever an amount is sent to or taken from multiple
selected months, it is divided **equally** among them, computed in paise
with the last recipient absorbing rounding so the parts always sum exactly.
Surplus sent to "HR/Core" splits between the two proportionally to their
`pool_pct` (50/50 at 5/5).

---

## 4. Planning Phase UI

Rendered in the project's Monthly Plan tab while `status === 'planning'`.
Excel-plain styling throughout.

### 4.1 Header block (sticky)

```
Total Project Value: ₹10,00,000          Duration: 10 months (Aug 2026 – May 2027)
Project (85%): ₹8,50,000   Admin (5%): ₹50,000   HR (5%): ₹50,000   Core (5%): ₹50,000
                                          ↑ live — updates as transfers happen

[Save]  [Reset]  [Reset Calculation]  [Full Delete]        [Recurring Tasks]
```

- **Save** — writes `saved_snapshot` (deep copy of months + transfers).
  Note: the plan persists to localStorage on every edit regardless; Save
  only marks the Reset checkpoint.
- **Reset** — confirmation modal, then restores months + transfers from
  `saved_snapshot` (or the initialized empty state if never saved).
- **Reset Calculation** — recomputes every derived figure from the ledger
  and reports any stored-vs-derived disagreement. Repair/refresh button;
  changes no data.
- **Full Delete** — confirmation modal, then deletes `budget_plan`.
- **Recurring Tasks** — toggles an inline plain-table section: rows of
  `Phase | Task | Subtask | Total amount`; **Apply** divides each total
  equally across all months, creating the same task/subtask in every month
  with `recurring: true`.
- **HR/Core inputs** — HR and Core show paired amount + percent inputs,
  editable, capped at their `pool_pct`. Lowering one creates a ledger
  transfer `hr|core → month:<the month the PO is currently working in>`
  (the month whose card last had focus; shown next to the input so the
  target is explicit). Raising back toward the cap reverses/revokes that
  transfer. Admin is read-only text.

### 4.2 Per-month cards

One card per month, in order. Each month has a **distinct color accent**
(rotating muted palette: left border + tinted header only — content stays
plain) so the PO always knows which month they're in. The same month keeps
the same color in the actual phase.

```
┌─ Month 1 · Aug 2026 ─────────────────────────── [Reset this month] ─┐
│ Allocated (85% split): ₹85,000    Planned: ₹78,000                  │
│                                                                     │
│  Phase          Task        Subtask         Amount        [🗑]      │
│  Implementation Training    Venue rent      ₹5,000         🗑       │
│                             Food            ₹3,000         🗑       │
│                             [+ subtask]                             │
│  Design         Survey      Printing        ₹2,000         🗑       │
│  [+ Add Task]                                                       │
│                                                                     │
│  ⚠ Not fully utilized — balance this month: ₹7,000                  │
│  [Send to HR/Core]  [Send to other months ▾]                        │
└─────────────────────────────────────────────────────────────────────┘
```

- **Add Task** opens a new task row: phase select, task name, first
  subtask name + amount. **+ subtask** adds a line under an existing task.
- **Delete** (🗑 per subtask and per task) removes the line(s); the amount
  returns to the month's balance automatically (planned total just shrinks).
- **Under-planned** (planned < allocated): balance line with two actions —
  - *Send to HR/Core*: one ledger transfer per pool, split by `pool_pct`.
  - *Send to other months*: checkbox list of the remaining months
    (MonthPicker); equal split on confirm; one ledger record per target.
- **Over-planned** (planned > allocated): `Needs ₹X more to satisfy` with —
  - *Take from months*: checkbox list; equal split, but capped at each
    source month's available balance (a month can't be taken below its own
    planned total); if the selection can't cover ₹X the dialog says how
    much is still uncovered.
  - *Take from HR/Core*: draws up to the pools' remaining balances.
  - If HR/Core can't cover the rest, the message directs the PO to take
    the remainder from other months. **Admin is never drawn during
    editing** — only via the explicit submit-time action (Section 5).
- **Transfers display**: each transfer touching the month is a plain text
  line under the totals — `+ ₹2,000 received from Aug 2026`,
  `− ₹3,000 sent to HR/Core` — with a `revoke` link (planning phase only;
  revoking deletes the ledger record and restores both sides).
- **[Reset this month]** — confirmation modal listing what will be undone,
  then: restores this month's tasks from `saved_snapshot` (or empty) AND
  deletes every ledger transfer whose `origin_month` is this month —
  which automatically restores every other month/pool those transfers
  touched. Transfers that *other* months originated into this month are
  kept.

---

## 5. Submit Validation & the 85/95/100 Ladder

**Submit Plan** button at the bottom of the planning view, with a plain
checklist beside it showing each condition's pass/fail state and the
offending months/amounts.

**Blocking conditions:**

1. **Every month settled:** for each month,
   `planned total == allocated budget` to the paisa. Leftover balance or
   uncovered deficit anywhere blocks submit.
2. **Grand invariant:** Σ month allocated + HR + Core + Admin =
   project_value. Holds by construction; checked as a corruption safety
   net (failure message offers Reset Calculation).
3. **No pool negative:** HR, Core, Admin ≥ 0 (guaranteed at entry;
   re-verified here).

**The ladder (default 5/5/5 pools):**

- Plan total ≤ working pool (85%): normal.
- Above working pool: the excess must already be covered by explicit
  *Take from HR/Core* transfers — capacity up to 95%.
- Above working pool + HR + Core: submit offers exactly one action —
  `Draw ₹X from Admin` — creating an `admin → month` transfer for the
  precise uncovered remainder. Admin never goes below 0; if Admin can't
  cover it either, submit is blocked with
  `plan exceeds total project value by ₹Y`.
- This replaces the old auto-cascade entirely.

**On successful submit:**
- `status → 'submitted'`, `submitted_at` stamped.
- Every planned subtask's actual mirror is live (`actual_amount: 0`,
  `actual_status: 'pending'`).
- Planning-phase transfers freeze (no revoke links).
- Save/Reset/Full Delete/Recurring Tasks controls disappear.

---

## 6. Actual Expense Entry Phase

Same tab, `status === 'submitted'`. Months keep their planning-phase color
accents. Per task, the **planned row is read-only (grey)** directly above
its **actual row (editable, white)**.

```
┌─ Month 1 · Aug 2026 ── Planned: ₹85,000 · Actual so far: ₹41,000 ──┐
│  Phase           Task       Subtask       Planned      Actual      │
│  Implementation  Training   Venue rent    ₹5,000      [₹4,200]     │
│  Implementation  Training   Food          ₹3,000      [₹3,000]     │
│  Design          Survey     Printing      ₹2,000      [₹    0]     │
│  [+ Add Task]   ← new rows allowed; planned column shows "—"       │
└────────────────────────────────────────────────────────────────────┘
```

- Actual rows start as copies of planned (phase/task/subtask prefilled,
  amount 0). The PO may edit the actual side's phase/task/subtask text and
  enter the real amount; the planned side never changes.
- Entering a non-zero amount sets `actual_status: 'entered'`.
- **Per-subtask settlement (at the side of each line):**
  - *Actual < planned*: `₹X remaining` with **[→ HR/Core]** (pool_pct
    split; sets `actual_status: 'transferred'`) or **[→ months ▾]**
    (checkbox list, equal split — increases the receiving months' actual-
    phase available budget).
  - *Actual > planned*: `Insufficient — needs ₹X` with
    **[Take from HR/Core]** or **[Take from months ▾]** (equal split,
    capped at each source's availability).
- **Actual-phase transfers are the real triggers**: only `phase: 'actual'`
  ledger records move money in the live HR/Core/Admin pools that the
  Expense tab / EMS reads. Planning-phase transfers shaped the budget;
  actual-phase transfers move actual money.
- **Admin in the actual phase**: as in planning, Admin is drawn only when
  an overage exceeds what HR/Core/months can supply, via an explicit
  `Draw from Admin` confirmation on the settlement dialog.
- Tasks added in this phase (`added_in_actual: true`) have no planned
  amount; their actual spend must be funded by a take-from transfer before
  the month can settle.
- Month header shows running `Planned vs Actual so far`. A month where
  every subtask is `entered` or `transferred` and no uncovered overage
  remains shows a plain **Settled** note.

---

## 7. Expense Tab Interaction

- The Expense tab reads pool availability from `phase: 'actual'` ledger
  records (plus the base pool amounts), not from the old
  `pool_adjustments`.
- A subtask whose remainder was sent to HR/Core (`actual_status:
  'transferred'`) displays in the Expense tab as
  **"Money transferred — ₹0"** instead of an available amount.

---

## 8. Components & Services

**New files:**

| File | Responsibility |
|---|---|
| `src/services/budgetPlan.js` | Pure math, no I/O (style of `monthlyApportionment.js`): `initializePlan`, `monthAllocated`, `monthPlannedTotal`, `monthActualTotal`, `poolBalance` (clamped), `validateTransfer`, `equalSplit` (paise-exact, last recipient absorbs rounding), `settlementCheck`, `resetMonth`, `grandInvariantCheck` |
| `src/services/localBudgetPlan.js` | localStorage persistence on the project record: initialize, save/snapshot/restore, fullDelete, submit, task/subtask CRUD, updateActual, addTransfer, revokeTransfer, resetMonth |
| `src/modules/pms/project-associate/BudgetPlanPanel.jsx` | Container; renders split preview / planning view / actual view from `budget_plan.status` |
| `.../budget-plan/PlanHeader.jsx` | Totals strip, HR/Core capped inputs, Save/Reset/Reset-Calc/Full-Delete buttons |
| `.../budget-plan/RecurringTasksEntry.jsx` | Plain-table recurring task entry + Apply |
| `.../budget-plan/PlanningMonthCard.jsx` | One month, planning phase |
| `.../budget-plan/ActualMonthCard.jsx` | One month, actual phase |
| `.../budget-plan/MonthPicker.jsx` | Shared checkbox month-selection popover for all send/take actions |

**Modified files:**

- `ProjectDetailPage.jsx` — renders `BudgetPlanPanel` in place of
  `MonthlyPlanPanel` in the Monthly Plan tab. Old panel + services remain
  in the repo, unused, removable later.
- `ExpensePanel` (in `MonthlyPlanPanel.jsx`, extracted or adapted) —
  reads actual-phase ledger transfers; shows "Money transferred — ₹0"
  per Section 7.

**Error handling:**

- Every transfer validated in `budgetPlan.js` before persisting: source
  must have the funds (pool clamp at 0; month capped at available
  balance). Violations return a plain inline error message; nothing is
  written.
- All money math in integer paise internally, formatted on display.
- Role gating unchanged: the same `canEdit` (PO/owner) prop the current
  panel receives.

---

## 9. Testing

- **Unit (Vitest), `budgetPlan.js`:**
  - equal-split paise exactness (e.g. ₹5,000 across 9 months sums back
    exactly);
  - pool clamping — the 96% regression: plan at 96% of value → HR+Core
    drain to exactly 0, Admin gives exactly 1%, nothing negative;
  - settlement check blocks on any unsettled month, passes when settled;
  - month reset restores every month/pool its transfers touched;
  - grand invariant after arbitrary valid transfer sequences;
  - transfer validation rejects overdraws and above-cap HR/Core raises.
- **E2E (existing `test/` browser pattern):** initialize → plan two months
  → settle surplus to next month → submit → enter actuals → send a
  remainder to HR → verify Expense tab shows "Money transferred — ₹0".

---

## 10. Decisions Log

| Decision | Choice |
|---|---|
| Plan editability after submit | Locked; new task rows may be added in actual phase |
| Task structure | Nested — task groups subtasks; amounts on subtasks only |
| Admin edits | System-only; drawn solely via explicit submit-time / settlement `Draw from Admin` action |
| Multi-month split | Equal split (paise-exact) |
| Existing old-format plans | Start fresh; old data ignored, no migration |
| Architecture | New v2 model + explicit zero-sum transfer ledger (Approach A) |
| UI style | Excel-plain per standing PO/PA UI preference |
