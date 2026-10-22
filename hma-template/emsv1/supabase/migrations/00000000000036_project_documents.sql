-- Projects > Upload tab: lets a PO/PA/Coordinator attach arbitrary documents
-- to a project, stored in Supabase Storage (not S3 — unlike the older,
-- still-unused employee_documents.storage_path per ADR-031).

insert into storage.buckets (id, name, public, file_size_limit)
values ('project-documents', 'project-documents', false, 26214400) -- 25MB/file
on conflict (id) do nothing;

-- project_documents is metadata only; the file bytes live in the bucket at
-- storage_path. Deleting the row does NOT cascade-delete the storage object
-- (storage.objects isn't FK-able from a public table) — the app must remove
-- both in the same action (see localProjectDocuments.remove).
create table project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by_name text,
  uploaded_at timestamptz not null default now()
);

alter table project_documents enable row level security;

-- Same project-ownership shape as budget_plans_select/write and
-- project_ledgers_select/write.
create policy project_documents_select on project_documents for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'project_coordinator', 'hr')
    or exists (
      select 1 from projects pr
      left join project_officer_assignments poa on poa.project_id = pr.id
      where pr.id = project_documents.project_id
        and (pr.project_associate_id = current_employee_id() or poa.employee_id = current_employee_id())
    )
  );

create policy project_documents_write on project_documents for all
  using (
    current_user_role() in ('admin', 'project_coordinator')
    or exists (
      select 1 from projects pr
      left join project_officer_assignments poa on poa.project_id = pr.id
      where pr.id = project_documents.project_id
        and (pr.project_associate_id = current_employee_id() or poa.employee_id = current_employee_id())
    )
  );

-- storage.objects RLS: files are stored at "<project_id>/<filename>", so the
-- first path segment IS the project id — same ownership check as above,
-- applied via a path-prefix match instead of a project_documents join.
create policy project_documents_storage_select on storage.objects for select
  using (
    bucket_id = 'project-documents'
    and (
      current_user_role() in ('admin', 'ceo', 'heads', 'project_coordinator', 'hr')
      or exists (
        select 1 from projects pr
        left join project_officer_assignments poa on poa.project_id = pr.id
        where pr.id::text = (storage.foldername(name))[1]
          and (pr.project_associate_id = current_employee_id() or poa.employee_id = current_employee_id())
      )
    )
  );

create policy project_documents_storage_write on storage.objects for all
  using (
    bucket_id = 'project-documents'
    and (
      current_user_role() in ('admin', 'project_coordinator')
      or exists (
        select 1 from projects pr
        left join project_officer_assignments poa on poa.project_id = pr.id
        where pr.id::text = (storage.foldername(name))[1]
          and (pr.project_associate_id = current_employee_id() or poa.employee_id = current_employee_id())
      )
    )
  )
  with check (
    bucket_id = 'project-documents'
    and (
      current_user_role() in ('admin', 'project_coordinator')
      or exists (
        select 1 from projects pr
        left join project_officer_assignments poa on poa.project_id = pr.id
        where pr.id::text = (storage.foldername(name))[1]
          and (pr.project_associate_id = current_employee_id() or poa.employee_id = current_employee_id())
      )
    )
  );
