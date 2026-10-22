-- audit_logs_select (00000000000017_audit_log.sql) omitted 'project_associate' from
-- the role allow-list, even though the documented Audit Logs permission matrix
-- (docs/02_Roles_and_Permissions.md, mirrored by permissions.js's MODULE.AUDIT_LOGS)
-- grants CEO/Heads/HR/Project Coordinator/Project Associate View access — a
-- logged-in Project Associate saw the Audit Logs page's DB-backed half
-- (Projects/Staff & Payroll entries) render silently empty instead of the
-- entries their role is meant to see.
drop policy audit_logs_select on audit_logs;
create policy audit_logs_select on audit_logs for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'project_coordinator', 'hr', 'project_associate'));
