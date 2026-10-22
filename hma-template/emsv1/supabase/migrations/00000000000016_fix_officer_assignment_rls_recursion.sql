-- projects_select and project_officer_assignments_select (00000000000014_rls_core.sql)
-- each check the other table via EXISTS, so any query that touches both under RLS
-- (e.g. selecting projects with an embedded project_officer_assignments relation)
-- causes Postgres to recurse between the two policies forever. Break the cycle by
-- routing project_officer_assignments_select's projects lookup through a
-- security-definer helper (same pattern as current_user_role()/current_employee_id()
-- in 00000000000003_auth_helpers.sql), which bypasses RLS on projects instead of
-- re-triggering projects_select.
create or replace function project_associate_owns(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from projects where id = pid and project_associate_id = current_employee_id()
  );
$$;

drop policy if exists project_officer_assignments_select on project_officer_assignments;
create policy project_officer_assignments_select on project_officer_assignments for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'project_coordinator')
    or employee_id = current_employee_id()
    or project_associate_owns(project_id)
  );
