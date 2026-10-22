-- projects_select (00000000000014_rls_core.sql) omitted 'hr' from the
-- role allow-list, even though the sibling policies on the same migration —
-- budget_plans_select and project_expenses_select — both grant hr the same
-- access and are commented "same project-ownership shape as projects". HR
-- owns EMS > Expense Management (permissions.js: EXPENSE_MANAGEMENT.HR =
-- EDIT), which reads the projects table directly via localProjects.list();
-- without this, every tab on that page silently showed zero projects for an
-- HR-logged-in session.
drop policy projects_select on projects;
create policy projects_select on projects for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'project_coordinator', 'hr')
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
