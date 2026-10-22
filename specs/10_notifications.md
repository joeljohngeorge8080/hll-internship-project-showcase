# Spec 10 — Notifications

**Roadmap:** P13 (infra) → P12 (triggers) · **Decisions:** ADR-031 (AWS SES)

## Purpose
Outbound email via AWS SES: payslips, monthly reports, and (future) alerts. Infra stands up early; triggers wire in as source modules land.

## Entities / Tables

### `notification_log` (proposed)
`id` · `recipient` · `channel` (email) · `template_key` · `subject` · `status` (Queued/Sent/Failed) · `related_module` · `related_record_id` · `error` · `created_at` · `sent_at`

(Single proposed table; confirm during P13.)

## APIs (internal/service-level)
Primarily a backend service, not user-facing CRUD. Possible admin/debug endpoints:
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/notifications/log` | CEO/Heads (view) | delivery log (optional) |
| POST | `/notifications/test` | admin | send a test email (optional) |

## Triggers (wired in P12, as sources exist)
- **Payslip generated** → email employee (dep: Payroll P6).
- **Monthly report ready** → email recipients (dep: Reporting P10).
- **Password reset** → notify user (dep: Auth P1).
- **Low-stock alert** → email (only if Inventory adopted — spec 11).

## Permissions
No end-user edit surface. Delivery-log viewing (if exposed) is management-only. Sending is system-initiated.

## Validation rules
- Valid recipient address; template exists; required template variables present.
- Each send writes a `notification_log` row with status.
- SES configuration (verified sender/domain) required before enabling sends.

## Edge cases
- SES send failure → mark Failed + capture error; retry policy; never block the source transaction (payroll/report stays valid).
- Missing/invalid recipient email → skip + log.
- Bounce/complaint handling → out of scope for v1 (note for future).
- Rate limits → queue/throttle.
