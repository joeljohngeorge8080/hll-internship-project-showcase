-- RLS for the core identity/money-flow tables. Peripheral modules (GST, LSGB,
-- internships, recruitments, announcements, etc.) follow the same two patterns
-- shown here — (a) flat V/E-by-role from permissions.js, (b) row-ownership via
-- project scoping — and are deliberately deferred to a follow-up migration so
-- the ~24-module x 8-role matrix isn't hand-copied 24 times in one pass.

alter table profiles enable row level security;
alter table employees enable row level security;
alter table projects enable row level security;
alter table project_officer_assignments enable row level security;
alter table budget_plans enable row level security;
alter table project_expenses enable row level security;
alter table audit_log enable row level security;

-- profiles: everyone reads their own row; admin/hr/ceo/heads read all (staff directory).
create policy profiles_select_self on profiles for select
  using (id = auth.uid() or current_user_role() in ('admin', 'hr', 'ceo', 'heads'));
create policy profiles_update_self on profiles for update
  using (id = auth.uid() or is_admin());

-- employees: Employee role sees only their own linked record; staff roles see all.
create policy employees_select on employees for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'hr', 'project_coordinator', 'project_associate', 'project_officer')
    or id = current_employee_id()
  );
create policy employees_write on employees for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

-- projects: row-ownership scoping beyond the flat permissions matrix.
--   PA sees only projects where project_associate_id = self.
--   PO sees only projects they're assigned to via project_officer_assignments.
--   Field personnel see only projects where their email is in project_field_personnel.
--   Coordinator/Admin/CEO/Heads see all.
create policy projects_select on projects for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'project_coordinator')
    or project_associate_id = current_employee_id()
    or exists (
      select 1 from project_officer_assignments poa
      where poa.project_id = projects.id and poa.employee_id = current_employee_id()
    )
    or exists (
      select 1 from project_field_personnel pfp
      join profiles p on p.id = auth.uid()
      where pfp.project_id = projects.id and pfp.email = p.google_email
    )
  );
create policy projects_write on projects for all
  using (
    current_user_role() in ('admin', 'project_coordinator')
    or project_associate_id = current_employee_id()
    or exists (
      select 1 from project_officer_assignments poa
      where poa.project_id = projects.id and poa.employee_id = current_employee_id()
    )
  )
  with check (
    current_user_role() in ('admin', 'project_coordinator')
    or project_associate_id = current_employee_id()
    or exists (
      select 1 from project_officer_assignments poa
      where poa.project_id = projects.id and poa.employee_id = current_employee_id()
    )
  );

create policy project_officer_assignments_select on project_officer_assignments for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'project_coordinator')
    or employee_id = current_employee_id()
    or exists (select 1 from projects pr where pr.id = project_id and pr.project_associate_id = current_employee_id())
  );

-- budget_plans / project_expenses: same project-ownership shape as projects.
create policy budget_plans_select on budget_plans for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'project_coordinator', 'hr')
    or exists (
      select 1 from projects pr
      left join project_officer_assignments poa on poa.project_id = pr.id
      where pr.id = budget_plans.project_id
        and (pr.project_associate_id = current_employee_id() or poa.employee_id = current_employee_id())
    )
  );
create policy budget_plans_write on budget_plans for all
  using (
    current_user_role() in ('admin', 'project_coordinator')
    or exists (
      select 1 from projects pr
      left join project_officer_assignments poa on poa.project_id = pr.id
      where pr.id = budget_plans.project_id
        and (pr.project_associate_id = current_employee_id() or poa.employee_id = current_employee_id())
    )
  );

create policy project_expenses_select on project_expenses for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'project_coordinator', 'hr')
    or exists (
      select 1 from projects pr
      left join project_officer_assignments poa on poa.project_id = pr.id
      where pr.id = project_expenses.project_id
        and (pr.project_associate_id = current_employee_id() or poa.employee_id = current_employee_id())
    )
  );

-- audit_log: written by application/triggers, readable only by admin/CEO.
create policy audit_log_select on audit_log for select
  using (current_user_role() in ('admin', 'ceo'));
create policy audit_log_insert on audit_log for insert
  with check (true); -- writes happen via security-definer triggers/functions, not direct user inserts
