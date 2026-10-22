# Spec 09 — Dashboard

**Roadmap:** P3 (placeholder shipped in P0) · **Decisions:** ADR-029 (deferred)

## Purpose
Provide an at-a-glance organizational overview. **Layout and widgets are deferred** pending stakeholder validation (ADR-029); a placeholder ships now.

## Entities / Tables
None of its own. When finalized, the dashboard **reads** summaries from existing modules (projects, employees, attendance_summary, payroll, expenses, finance). No new tables anticipated.

## APIs (when finalized — not yet built)
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/dashboard/summary` | view | KPI figures |
| GET | `/dashboard/activity` | view | recent activity feed |
| GET | `/dashboard/charts` | view | chart datasets |

## Permissions
All roles: **V** (view only).

## Validation rules
- Read-only aggregation; respects each source module's locks/soft-deletes and role scoping.

## Edge cases / status
- **Current state:** placeholder card ("widgets pending stakeholder validation"). No KPI cards, doughnuts, or summary tables committed.
- **Do not** implement specific widgets until requirements are confirmed; revisit ADR-029.
- Candidate widgets (for the future scoping conversation, not commitments): active projects, total employees, attendance summary, expense summary, finance summary, recent audit activity.
