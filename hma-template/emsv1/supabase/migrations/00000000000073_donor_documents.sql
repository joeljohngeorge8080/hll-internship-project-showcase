-- Donor Records > Files: page-level file storage for the Donor/Funding
-- Agency Records page, same shape as internship_documents /
-- recruitment_documents / lsgb_documents.

insert into storage.buckets (id, name, public, file_size_limit)
values ('donor-documents', 'donor-documents', false, 26214400) -- 25MB/file
on conflict (id) do nothing;

create table donor_documents (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by_name text,
  uploaded_at timestamptz not null default now()
);

alter table donor_documents enable row level security;

-- Matches MODULE.PMS_AGENCIES in src/constants/permissions.js: CEO/Heads/
-- Project Coordinator/Project Associate have edit access, HR and Project
-- Officer have none — there's no separate view-only tier here, so select
-- and write share the same role list.
create policy donor_documents_select on donor_documents for select
  using (
    current_user_role() in
    ('admin', 'ceo', 'heads', 'project_coordinator', 'project_associate')
  );

create policy donor_documents_write on donor_documents for all
  using (
    current_user_role() in
    ('admin', 'ceo', 'heads', 'project_coordinator', 'project_associate')
  )
  with check (
    current_user_role() in
    ('admin', 'ceo', 'heads', 'project_coordinator', 'project_associate')
  );

create policy donor_documents_storage_select on storage.objects for select
  using (
    bucket_id = 'donor-documents'
    and current_user_role() in
      ('admin', 'ceo', 'heads', 'project_coordinator', 'project_associate')
  );

create policy donor_documents_storage_write on storage.objects for all
  using (
    bucket_id = 'donor-documents'
    and current_user_role() in
      ('admin', 'ceo', 'heads', 'project_coordinator', 'project_associate')
  )
  with check (
    bucket_id = 'donor-documents'
    and current_user_role() in
      ('admin', 'ceo', 'heads', 'project_coordinator', 'project_associate')
  );
