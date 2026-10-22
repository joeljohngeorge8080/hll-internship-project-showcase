-- projects_write (00000000000014_rls_core.sql) only ever let a Project
-- Associate write a row where project_associate_id = current_employee_id().
-- That works for updates to a project a PA already owns, but breaks project
-- *creation*: ProjectFormPage.jsx auto-assigns a new project's
-- project_associate_id to whichever PA's specialization matches the chosen
-- project_type — which is often a different PA than whoever is creating it
-- (or falls back to the creator only when no match exists). A PA hit "new
-- row violates row-level security policy for table projects" on save
-- whenever the auto-match picked someone else. CEO/HEADS also had no write
-- path at all, despite permissions.js (PMS_PROJECTS) granting them EDIT
-- same as project_coordinator/project_associate.
--
-- Split into per-action policies: INSERT is allowed for any role that has
-- app-level EDIT on PMS_PROJECTS, since row-ownership on a *new* project is
-- decided by app logic, not the creator's own identity. UPDATE/DELETE keep
-- the original self-ownership shape (a PA/PO may only touch a project
-- they're already tied to), with ceo/heads added to match projects_select.
drop policy projects_write on projects;

create policy projects_insert on projects for insert
  with check (
    current_user_role() in ('admin', 'ceo', 'heads', 'project_coordinator', 'project_associate')
  );

create policy projects_update on projects for update
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'project_coordinator')
    or project_associate_id = current_employee_id()
    or exists (
      select 1 from project_officer_assignments poa
      where poa.project_id = projects.id and poa.employee_id = current_employee_id()
    )
  )
  with check (
    current_user_role() in ('admin', 'ceo', 'heads', 'project_coordinator')
    or project_associate_id = current_employee_id()
    or exists (
      select 1 from project_officer_assignments poa
      where poa.project_id = projects.id and poa.employee_id = current_employee_id()
    )
  );

create policy projects_delete on projects for delete
  using (
    current_user_role() in ('admin', 'project_coordinator')
    or project_associate_id = current_employee_id()
    or exists (
      select 1 from project_officer_assignments poa
      where poa.project_id = projects.id and poa.employee_id = current_employee_id()
    )
  );
