# Spec 11 — Inventory  ❓ PENDING SCOPE

**Roadmap:** P9 · **Decisions:** ADR-034 (net-new, deferred)

> ⚠ **This module is NOT in the HMA IEMS v2.0 spec.** It was requested as a
> generic-EMS module but has no entities, fields, business rules, or
> permission-matrix rows in the requirements. **Nothing below is approved** —
> this is a scoping starting point, not a buildable spec. Do not implement
> until a scoping decision is made (see open questions).

## Purpose (proposed)
Track physical assets / stock: catalog, quantities, movements, and assignment to employees or projects.

## Open questions (must answer before building)
1. Is Inventory officially in scope for this release, or a future phase?
2. Does it replace anything, or is it additive?
3. What roles edit it? (New rows needed in the permission matrix / ADR-004.)
4. Asset tracking vs consumable stock vs both?
5. Integration points: link to `employees`? `projects`? `expenses`?

## Proposed entities (DRAFT — unconfirmed)
- `inventory_items` — `id` · `item_code` · `name` · `category` · `unit` · `reorder_level` · `is_active` · timestamps
- `inventory_stock` — `id` · `item_id` · `quantity_on_hand` · `location` · `updated_at`
- `inventory_movements` (append-only) — `id` · `item_id` · `movement_type` (In/Out/Adjust) · `quantity` · `reason` · `employee_id?` · `project_id?` · `moved_by` · `moved_at`
- `inventory_assignments` — `id` · `item_id` · `assignee_type` (employee/project) · `assignee_id` · `assigned_qty` · `assigned_at` · `returned_at?` · `status`

## Proposed permissions (DRAFT)
Likely HR or a new Store-keeper role edits; CEO/Heads/Finance view. **Requires matrix update + ADR.**

## Proposed validation (DRAFT)
- Movements adjust `quantity_on_hand`; never negative without an Adjust reason.
- Low stock (`quantity_on_hand ≤ reorder_level`) → alert (Notifications spec 10).
- Movements append-only for auditability (consistent with ADR-014).

## Edge cases (DRAFT)
- Assigning more than on-hand → reject.
- Returns restore quantity; partial returns supported.
- Item retired with stock on hand → guard.

## Status
❓ **Blocked on scoping (ADR-034).** Reporting/Notifications treat Inventory as conditional.
