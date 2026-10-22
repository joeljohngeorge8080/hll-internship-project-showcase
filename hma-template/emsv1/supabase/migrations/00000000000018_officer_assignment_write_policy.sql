-- project_officer_assignments (00000000000014_rls_core.sql) only ever got a
-- SELECT policy. With RLS enabled and no policy for INSERT/UPDATE/DELETE,
-- Postgres denies every write by default — so a Project Associate assigning
-- an officer to their own project hit "new row violates row-level security
-- policy for table project_officer_assignments". Add the missing write
-- policy, reusing project_associate_owns() (00000000000016) to avoid the
-- same projects/project_officer_assignments recursion that fix addressed.
create policy project_officer_assignments_write on project_officer_assignments for all
  using (
    current_user_role() in ('admin', 'project_coordinator')
    or project_associate_owns(project_id)
  )
  with check (
    current_user_role() in ('admin', 'project_coordinator')
    or project_associate_owns(project_id)
  );
