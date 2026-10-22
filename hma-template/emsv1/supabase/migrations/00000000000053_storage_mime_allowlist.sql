-- Phase 0 of the Supabase Pro adoption plan: the four private buckets
-- (employee-documents, project-documents, employee-photos,
-- pool-expense-receipts) were size-capped only, with no file-type
-- restriction. Adds a bucket-level allowlist so a client bypassing the
-- app's own check (uploadWithCleanup in src/services/storageUtils.js) still
-- gets rejected server-side.

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]::text[]
where id in ('employee-documents', 'project-documents');

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'employee-photos';

update storage.buckets
set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'pool-expense-receipts';
