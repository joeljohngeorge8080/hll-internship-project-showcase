-- Project Activity tab: PO/PC/PA log the current activity on a project, with a
-- target date (compared against today to flag overdue work) and a free-text
-- field for risks/challenges. Unlike project_notes (append-only log), rows here
-- are meant to be edited in place as an activity progresses, so a status is
-- tracked explicitly rather than inferred purely from the date — otherwise a
-- finished activity whose target date has passed would show as "Overdue" forever.

create table project_activities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  description text not null,
  target_date date,
  risk_challenges text,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references employees(id)
);
create trigger trg_project_activities_updated_at before update on project_activities
  for each row execute function set_updated_at();

alter table project_activities enable row level security;

-- Same project-ownership shape as project_notes (00000000000028_project_notes_personnel.sql):
-- PA/PO on the project, project_coordinator/admin/ceo/heads/hr, can read;
-- PA/PO on the project or admin/project_coordinator can write.
create policy project_activities_select on project_activities for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'project_coordinator', 'hr')
    or exists (
      select 1 from projects pr
      left join project_officer_assignments poa on poa.project_id = pr.id
      where pr.id = project_activities.project_id
        and (pr.project_associate_id = current_employee_id() or poa.employee_id = current_employee_id())
    )
  );
create policy project_activities_write on project_activities for all
  using (
    current_user_role() in ('admin', 'project_coordinator')
    or exists (
      select 1 from projects pr
      left join project_officer_assignments poa on poa.project_id = pr.id
      where pr.id = project_activities.project_id
        and (pr.project_associate_id = current_employee_id() or poa.employee_id = current_employee_id())
    )
  )
  with check (
    current_user_role() in ('admin', 'project_coordinator')
    or exists (
      select 1 from projects pr
      left join project_officer_assignments poa on poa.project_id = pr.id
      where pr.id = project_activities.project_id
        and (pr.project_associate_id = current_employee_id() or poa.employee_id = current_employee_id())
    )
  );
