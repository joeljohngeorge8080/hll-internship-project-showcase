# DRD — Project Phase & Budget Tracking Format

## 1. Objective

A reusable structure for any project: phases contain tasks, tasks roll up into a budget, and actual spend is tracked against that budget in real time. Modeled on the Beed M-Cup project structure, generalized so any project can plug in.

## 2. Core entities

### 2.1 Phase

Top-level grouping of work. A project has N phases, always in sequence.

| Field | Type | Notes |
|---|---|---|
| `phase_id` | int | 1, 2, 3... sequential |
| `phase_name` | string | e.g. "Design & Initiation", "Implementation" |
| `start_date` | date | optional, for timeline view |
| `end_date` | date | optional |
| `phase_budget` | currency | auto-sum of all tasks in phase (2.3) |

### 2.2 Task (line item within a phase)

Any phase can have unlimited tasks added. Tasks can nest one level (a task can have sub-items, like "Developing Communication materials" had 2 sub-lines in the Beed sheet).

| Field | Type | Notes |
|---|---|---|
| `task_id` | string | unique, e.g. `P1-T3` |
| `phase_id` | int | FK to phase |
| `parent_task_id` | string \| null | set if this is a sub-item of another task |
| `task_name` | string | e.g. "Cost of M-Cups" |
| `detail` | string | free text description |
| `qty` | number \| "LS" | LS = lump sum, skip unit calc |
| `rate` | currency | per-unit rate; ignored if qty = LS |
| `amount` | currency | `qty × rate`, or manual entry if LS |

**Adding a task:** append a row with a new `task_id` under the target `phase_id`. No schema change needed. Sub-items use `parent_task_id` to nest under a parent line (e.g. all "Developing Communication materials" sub-lines share one parent).

### 2.3 Budget rollup (calculated, not stored)

```
task_total(task)     = qty × rate                         (or manual if LS)
phase_budget(phase)  = Σ task_total for all tasks in phase
project_subtotal     = Σ phase_budget for all phases
admin_overhead       = project_subtotal × admin_rate%      (e.g. 5%)
grand_total_budget   = project_subtotal + admin_overhead
```

Admin rate is a single project-level constant, applied once at the end — not per phase.

### 2.4 Transaction (actuals log)

Every real expense, one row per transaction. This is the append-only ledger — never edit the budget rows above once actuals start flowing here.

| Field | Type | Notes |
|---|---|---|
| `date` | date | |
| `note_number` | string | optional external reference / voucher no. |
| `particulars` | string | what was paid for |
| `amount` | currency | |
| `status` | enum | `Accounted` \| `Committed` (see 3) |
| `payment_status` | enum | `Paid` \| `Pending` \| blank |
| `budget_head` | string | usually "Project Expense" or "Admin" |
| `phase_id` | int | FK to phase — **must match an existing phase**, don't invent new ones ad hoc |
| `sub_budget_head` | string | maps loosely to a `task_name` for traceability |
| `activity` | string | free text |

## 3. Status model

Two states only, applied to every transaction:

- **Accounted** — money spent and confirmed/reconciled.
- **Committed** — money earmarked/advanced/invoiced but not yet reconciled as final spend (e.g. advances, pending settlements).

```
expenses_accounted = Σ amount where status = Accounted
expenses_committed = Σ amount where status = Committed
fund_balance             = amount_received − expenses_accounted
balance_after_commitment = fund_balance − expenses_committed
```

`payment_status` (Paid/Pending) is a separate axis from `status` — a transaction can be `Accounted` + `Pending` if it's confirmed but not yet disbursed.

## 4. Variance tracking (budget vs actual)

For each phase:

```
phase_actual(phase)   = Σ transaction.amount where transaction.phase_id = phase
                         and status in (Accounted, Committed)
phase_variance         = phase_budget − phase_actual
phase_pct_used         = phase_actual / phase_budget × 100
```

Flag automatically when:
- `phase_pct_used > 100%` → over budget
- a `transaction.phase_id` has no matching `phase_id` in the phase table → **unbudgeted phase**, needs reconciliation
- a task's `task_total` in the budget has zero matching transactions late into the project timeline → **deliverable at risk** (e.g. core procurement lagging)

## 5. Minimum viable sheet layout

**Sheet 1 — Budget** (phases + tasks, as in §2.1–2.3), ending in a Grand Total + Admin row.

**Sheet 2 — Summary** (4 numbers, always visible at a glance):
`Project Value | Amount Received | Expenses Accounted | Fund Balance | Balance After Commitment`

**Sheet 3 — Transactions** (append-only log, §2.4), one row per expense, newest at bottom or sortable by date.

## 6. Rules for extending

- New task any time → new row in Sheet 1 under the right `phase_id`. Recalculate `phase_budget` and `grand_total_budget` automatically (formula, not manual retype).
- New phase → only if genuinely new scope; otherwise map the transaction to the closest existing phase to avoid budget fragmentation (this is what went wrong with "Monitoring & Evaluation Phase" appearing only in actuals, not in the budget, in the Beed sheet).
- Never delete a transaction row — if wrong, add a reversing entry and note it in `activity`.
- Duplicate detection: flag any two transactions with identical `amount` + similar `particulars` within the same phase for manual review before counting both.
