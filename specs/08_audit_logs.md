# Spec 08 — Audit Logs

**Roadmap:** P11 (viewer) · **Decisions:** ADR-013 · Write-hook is cross-cutting from P2.

## Purpose
Provide a read-only, filterable view over the immutable `audit_logs` trail. The **writing** of audit rows is a cross-cutting concern owned by every module (ADR-013); this spec covers the **viewer**.

## Entities / Tables
Reuses `audit_logs` (defined in spec 00). No new tables.

## APIs
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/audit-logs` | all (view) | list with filters + pagination |
| GET | `/audit-logs/{id}` | all (view) | single entry detail |

Query params: `module_name`, `user_id`, `role`, `action_type`, `date_from`, `date_to`, `record_id`, `page`, `page_size`.

## Permissions
All roles: **V** (view only). **No role may create, edit, or delete** audit logs (ADR-013).

## Validation rules
- Endpoints are strictly read-only; there is no write/update/delete API.
- Filters validated (valid enum for `action_type`, ISO dates, sane ranges).
- Detail view shows `old_value` vs `new_value` via a diff component.

## Edge cases
- Very large result sets → enforce pagination + sensible default page size; index on `module_name`, `created_at`, `user_id`.
- `old_value`/`new_value` may be large JSON → diff viewer handles truncation/expansion.
- Login/Logout/PasswordReset entries have `record_id = null` → render gracefully.
- Any attempt to mutate via API → 405/403; integrity is non-negotiable.
- Time zone: store UTC; display in local with explicit tz label.
