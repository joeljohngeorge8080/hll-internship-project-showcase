-- LSGB Projects > Files: page-level file storage for the LSGB Projects
-- module, same shape as internship_documents and recruitment_documents.
-- Users can upload, preview, view, download, and delete any file type.

insert into storage.buckets (id, name, public, file_size_limit)
values ('lsgb-documents', 'lsgb-documents', false, 26214400) -- 25MB/file
on conflict (id) do nothing;

create table lsgb_documents (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by_name text,
  uploaded_at timestamptz not null default now()
);

alter table lsgb_documents enable row level security;

-- Same role shape as internship_documents/recruitment_documents
-- (admin/hr write, admin/ceo/heads/hr read)
create policy lsgb_documents_select on lsgb_documents for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'hr', 'project_coordinator'));

create policy lsgb_documents_write on lsgb_documents for all
  using (current_user_role() in ('admin', 'hr', 'project_coordinator'))
  with check (current_user_role() in ('admin', 'hr', 'project_coordinator'));

create policy lsgb_documents_storage_select on storage.objects for select
  using (
    bucket_id = 'lsgb-documents'
    and current_user_role() in ('admin', 'ceo', 'heads', 'hr', 'project_coordinator')
  );

create policy lsgb_documents_storage_write on storage.objects for all
  using (
    bucket_id = 'lsgb-documents'
    and current_user_role() in ('admin', 'hr', 'project_coordinator')
  )
  with check (
    bucket_id = 'lsgb-documents'
    and current_user_role() in ('admin', 'hr', 'project_coordinator')
  );
