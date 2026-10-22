-- Staff & Payroll profile photos: were stored as base64 data URLs inline in
-- employees.photo_url (bloats table rows, no size/type enforcement beyond a
-- client-side check). Moves photos to Supabase Storage, same private-bucket +
-- signed-URL shape as employee_documents (00000000000045) and project
-- documents (00000000000036). photo_url now holds a storage object path
-- ("<employee_id>/photo.<ext>") instead of a data URL; existing base64 rows
-- are left as-is and the frontend renders them directly for backward compat.

insert into storage.buckets (id, name, public, file_size_limit)
values ('employee-photos', 'employee-photos', false, 2097152) -- 2MB/file, matches ProfilePhotoUpload.jsx's client-side cap
on conflict (id) do nothing;

comment on column employees.photo_url is 'Supabase Storage object path (bucket: employee-photos). Older rows may still hold a base64 data: URL from before this migration.';

-- Same select/write shape as employee_documents_select/write
-- (00000000000031_employee_child_rls.sql): only admin/hr may write a photo,
-- broader staff roles or the employee's own record may view.
create policy employee_photos_storage_select on storage.objects for select
  using (
    bucket_id = 'employee-photos'
    and (
      current_user_role() in ('admin', 'ceo', 'heads', 'hr', 'project_coordinator', 'project_associate', 'project_officer')
      or (storage.foldername(name))[1] = current_employee_id()::text
    )
  );

create policy employee_photos_storage_write on storage.objects for all
  using (
    bucket_id = 'employee-photos'
    and current_user_role() in ('admin', 'hr')
  )
  with check (
    bucket_id = 'employee-photos'
    and current_user_role() in ('admin', 'hr')
  );
