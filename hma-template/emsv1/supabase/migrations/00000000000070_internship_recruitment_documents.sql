-- Internship / Recruitment > Files: replaces the old "Upload Excel" bulk
-- import (parse spreadsheet rows -> bulkCreate) with a general file store,
-- same shape as project_documents (00000000000036_project_documents.sql)
-- but page-level rather than per-record, and unrestricted mime type since
-- the requirement is "any file" rather than documents only.

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('internship-documents', 'internship-documents', false, 26214400), -- 25MB/file
  ('recruitment-documents', 'recruitment-documents', false, 26214400)
on conflict (id) do nothing;

create table internship_documents (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by_name text,
  uploaded_at timestamptz not null default now()
);

create table recruitment_documents (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by_name text,
  uploaded_at timestamptz not null default now()
);

alter table internship_documents enable row level security;
alter table recruitment_documents enable row level security;

-- Same role shape as internships_select/write and recruitments_select/write
-- in 00000000000021_internships_recruitments_rls.sql.
create policy internship_documents_select on internship_documents for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'hr'));
create policy internship_documents_write on internship_documents for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

create policy recruitment_documents_select on recruitment_documents for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'hr'));
create policy recruitment_documents_write on recruitment_documents for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

create policy internship_documents_storage_select on storage.objects for select
  using (
    bucket_id = 'internship-documents'
    and current_user_role() in ('admin', 'ceo', 'heads', 'hr')
  );
create policy internship_documents_storage_write on storage.objects for all
  using (
    bucket_id = 'internship-documents'
    and current_user_role() in ('admin', 'hr')
  )
  with check (
    bucket_id = 'internship-documents'
    and current_user_role() in ('admin', 'hr')
  );

create policy recruitment_documents_storage_select on storage.objects for select
  using (
    bucket_id = 'recruitment-documents'
    and current_user_role() in ('admin', 'ceo', 'heads', 'hr')
  );
create policy recruitment_documents_storage_write on storage.objects for all
  using (
    bucket_id = 'recruitment-documents'
    and current_user_role() in ('admin', 'hr')
  )
  with check (
    bucket_id = 'recruitment-documents'
    and current_user_role() in ('admin', 'hr')
  );
