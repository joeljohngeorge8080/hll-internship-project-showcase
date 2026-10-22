-- Staff & Payroll > Documents tab: switches employee document storage from the
-- unused S3 design (storage_path was "S3 reference per ADR-031" but no S3
-- integration was ever wired) to Supabase Storage, matching the pattern
-- already proven for project documents (00000000000036_project_documents.sql).
-- storage_path is repurposed to hold the Supabase Storage object path instead.

insert into storage.buckets (id, name, public, file_size_limit)
values ('employee-documents', 'employee-documents', false, 10485760) -- 10MB/file, matches DocumentsTab.jsx's client-side cap
on conflict (id) do nothing;

alter table employee_documents
  add column if not exists document_name text,
  add column if not exists document_category text,
  add column if not exists file_name text,
  add column if not exists content_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists remarks text;

comment on column employee_documents.storage_path is 'Supabase Storage object path (bucket: employee-documents), not S3.';

-- storage.objects RLS: files are stored at "<employee_id>/<timestamp>-<filename>",
-- so the first path segment IS the employee id — same ownership check as
-- employee_documents_select/write (00000000000031_employee_child_rls.sql),
-- applied via a path-prefix match instead of an employee_documents join.
create policy employee_documents_storage_select on storage.objects for select
  using (
    bucket_id = 'employee-documents'
    and (
      current_user_role() in ('admin', 'ceo', 'heads', 'hr')
      or (storage.foldername(name))[1] = current_employee_id()::text
    )
  );

create policy employee_documents_storage_write on storage.objects for all
  using (
    bucket_id = 'employee-documents'
    and current_user_role() in ('admin', 'hr')
  )
  with check (
    bucket_id = 'employee-documents'
    and current_user_role() in ('admin', 'hr')
  );
