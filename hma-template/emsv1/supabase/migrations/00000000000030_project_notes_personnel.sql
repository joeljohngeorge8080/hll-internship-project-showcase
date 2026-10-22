-- Project notes (timestamped free-text log) and field personnel identity
-- details (name/age/phone, all optional). Standalone from the retired
-- project_field_personnel email-invite/portal-access feature — that table
-- drove login access and RLS scoping and is no longer surfaced in the UI;
-- these two tables are plain project-attached records with no auth role.

create table project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now(),
  created_by uuid references employees(id)
);

create table project_personnel_details (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text,
  age integer,
  phone text,
  created_at timestamptz not null default now()
);

alter table project_notes enable row level security;
alter table project_personnel_details enable row level security;

-- Same project-ownership shape as project_expenses (00000000000014_rls_core.sql):
-- PA/PO on the project, project_coordinator/admin/ceo/heads/hr, can read;
-- PA/PO on the project or admin/project_coordinator can write.
create policy project_notes_select on project_notes for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'project_coordinator', 'hr')
    or exists (
      select 1 from projects pr
      left join project_officer_assignments poa on poa.project_id = pr.id
      where pr.id = project_notes.project_id
        and (pr.project_associate_id = current_employee_id() or poa.employee_id = current_employee_id())
    )
  );
create policy project_notes_write on project_notes for all
  using (
    current_user_role() in ('admin', 'project_coordinator')
    or exists (
      select 1 from projects pr
      left join project_officer_assignments poa on poa.project_id = pr.id
      where pr.id = project_notes.project_id
        and (pr.project_associate_id = current_employee_id() or poa.employee_id = current_employee_id())
    )
  )
  with check (
    current_user_role() in ('admin', 'project_coordinator')
    or exists (
      select 1 from projects pr
      left join project_officer_assignments poa on poa.project_id = pr.id
      where pr.id = project_notes.project_id
        and (pr.project_associate_id = current_employee_id() or poa.employee_id = current_employee_id())
    )
  );

create policy project_personnel_details_select on project_personnel_details for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'project_coordinator', 'hr')
    or exists (
      select 1 from projects pr
      left join project_officer_assignments poa on poa.project_id = pr.id
      where pr.id = project_personnel_details.project_id
        and (pr.project_associate_id = current_employee_id() or poa.employee_id = current_employee_id())
    )
  );
create policy project_personnel_details_write on project_personnel_details for all
  using (
    current_user_role() in ('admin', 'project_coordinator')
    or exists (
      select 1 from projects pr
      left join project_officer_assignments poa on poa.project_id = pr.id
      where pr.id = project_personnel_details.project_id
        and (pr.project_associate_id = current_employee_id() or poa.employee_id = current_employee_id())
    )
  )
  with check (
    current_user_role() in ('admin', 'project_coordinator')
    or exists (
      select 1 from projects pr
      left join project_officer_assignments poa on poa.project_id = pr.id
      where pr.id = project_personnel_details.project_id
        and (pr.project_associate_id = current_employee_id() or poa.employee_id = current_employee_id())
    )
  );
