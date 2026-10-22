-- Fix lsgb_documents/storage RLS policies from migration 71: they used an
-- ad-hoc role list instead of the real PMS_PROJECTS permission matrix
-- (src/constants/permissions.js) — Project Associate, Project Officer, CEO
-- and Heads all have edit access to PMS_PROJECTS but were excluded, and HR
-- was wrongly given write instead of view-only. This is also why
-- LsgbSheetPage.jsx's canEdit prop (fixed separately, now via usePermission)
-- was always false for a Project Associate — the frontend and RLS bugs were
-- the same root cause: guessing the role list instead of reading it.

drop policy if exists lsgb_documents_select on lsgb_documents;
drop policy if exists lsgb_documents_write on lsgb_documents;
drop policy if exists lsgb_documents_storage_select on storage.objects;
drop policy if exists lsgb_documents_storage_write on storage.objects;

create policy lsgb_documents_select on lsgb_documents for select
  using (
    current_user_role() in
    ('admin', 'ceo', 'heads', 'hr', 'project_coordinator', 'project_associate', 'project_officer')
  );

create policy lsgb_documents_write on lsgb_documents for all
  using (
    current_user_role() in
    ('admin', 'ceo', 'heads', 'project_coordinator', 'project_associate', 'project_officer')
  )
  with check (
    current_user_role() in
    ('admin', 'ceo', 'heads', 'project_coordinator', 'project_associate', 'project_officer')
  );

create policy lsgb_documents_storage_select on storage.objects for select
  using (
    bucket_id = 'lsgb-documents'
    and current_user_role() in
      ('admin', 'ceo', 'heads', 'hr', 'project_coordinator', 'project_associate', 'project_officer')
  );

create policy lsgb_documents_storage_write on storage.objects for all
  using (
    bucket_id = 'lsgb-documents'
    and current_user_role() in
      ('admin', 'ceo', 'heads', 'project_coordinator', 'project_associate', 'project_officer')
  )
  with check (
    bucket_id = 'lsgb-documents'
    and current_user_role() in
      ('admin', 'ceo', 'heads', 'project_coordinator', 'project_associate', 'project_officer')
  );
