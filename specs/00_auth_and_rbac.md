# Spec 00 — Authentication & RBAC

**Roadmap:** P1 (Auth), P2 (RBAC + Audit) · **Decisions:** ADR-002, 003, 004, 005, 013, 032

## Purpose
Authenticate users via Employee ID + password (JWT) and authorize every action against the role permission matrix. Establish the cross-cutting audit-write hook.

## Entities / Tables

### `users`
| Field | Type | Notes |
|---|---|---|
| id | PK | |
| employee_id | FK → employees, unique | login username (e.g. `EMP2398`) |
| password_hash | string | bcrypt/argon2 |
| role | enum | CEO / Heads / HR / Finance / Project Officer |
| is_active | bool | inactive users cannot log in |
| created_at, updated_at, last_login_at | timestamp | |

### `audit_logs` (append-only — ADR-013)
| Field | Type | Notes |
|---|---|---|
| id | PK | |
| user_id | FK → users | actor |
| role | string | role snapshot at action time |
| module_name | string | |
| action_type | enum | Create/Update/Delete/Correction/Login/Logout/Override/PasswordReset |
| record_id | string\|null | affected record |
| old_value, new_value | json | |
| remarks | string | |
| ip_address | string | |
| created_at | timestamp | |

## APIs
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/auth/login` | public | Employee ID + password → JWT |
| POST | `/auth/logout` | authenticated | invalidate session |
| GET | `/auth/me` | authenticated | current user + role |
| POST | `/auth/reset-password` | HR | reset another user's password |
| GET | `/audit-logs` | all (view) | list (see spec 08) |

## Permissions
- Login open to any active user. Password reset: **HR only**. User creation: manual by admins (no API/UI in this release).
- Permission matrix is the single source of truth (ADR-004); enforced by `ProtectedRoute` (route level) and `usePermission` (UI level) on the frontend, and re-checked in the service layer on the backend.

## Validation rules
- Employee ID must exist in `users` and map to an active employee; `is_active = true`.
- Password verified against `password_hash`; never store/return plaintext.
- JWT carries `user_id`, `employee_id`, `role`, expiry; sent as `Authorization: Bearer`.
- Reset-password: caller role must be HR; target must exist; new password meets policy; writes audit log (`PasswordReset`).
- Every authenticated mutation writes an audit row before responding success.

## Edge cases
- Inactive/resigned user with valid credentials → reject login.
- Expired/invalid JWT → 401 → frontend clears state, redirects to `/login`, preserves intended deep link.
- Role changed server-side mid-session → next request re-reads role from token/`/auth/me`; stale token honored only until expiry.
- Concurrent logins from multiple devices → allowed (stateless JWT); logout is client-side token discard unless a denylist is added later.
- Audit-write failure must not silently swallow the action result — surface/retry per service-layer policy; audit integrity takes priority.
- Business locks (ADR-005) are checked **after** RBAC: an Edit-capable user is still blocked on completed projects / locked payroll.
