-- Finance > Files: page-level file storage for the Finance nav group,
-- same shape as internship_documents / recruitment_documents / etc.

insert into storage.buckets (id, name, public, file_size_limit)
values ('finance-documents', 'finance-documents', false, 26214400) -- 25MB/file
on conflict (id) do nothing;

create table finance_documents (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by_name text,
  uploaded_at timestamptz not null default now()
);

alter table finance_documents enable row level security;

-- Matches MODULE.FINANCE in src/constants/permissions.js: Heads (Finance)
-- edits, CEO/HR view-only, PMS roles have no access.
create policy finance_documents_select on finance_documents for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'hr'));

create policy finance_documents_write on finance_documents for all
  using (current_user_role() in ('admin', 'heads'))
  with check (current_user_role() in ('admin', 'heads'));

create policy finance_documents_storage_select on storage.objects for select
  using (
    bucket_id = 'finance-documents'
    and current_user_role() in ('admin', 'ceo', 'heads', 'hr')
  );

create policy finance_documents_storage_write on storage.objects for all
  using (
    bucket_id = 'finance-documents'
    and current_user_role() in ('admin', 'heads')
  )
  with check (
    bucket_id = 'finance-documents'
    and current_user_role() in ('admin', 'heads')
  );
