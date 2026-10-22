-- CreateProjectPage.jsx (src/modules/pms/projects/CreateProjectPage.jsx) is the
-- project creation form for Project Officers, but projects_insert
-- (00000000000020_projects_write_policy_fix.sql) never included
-- 'project_officer' among the allowed roles — a PO hit "new row violates
-- row-level security policy for table projects" on every attempt. Add the
-- missing role; row-ownership on a *new* project is still decided by app
-- logic, not the creator's identity, same reasoning as the other roles here.
drop policy projects_insert on projects;

create policy projects_insert on projects for insert
  with check (
    current_user_role() in (
      'admin', 'ceo', 'heads', 'project_coordinator', 'project_associate', 'project_officer'
    )
  );
