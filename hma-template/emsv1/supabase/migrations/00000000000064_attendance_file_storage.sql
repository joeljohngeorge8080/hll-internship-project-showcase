-- Add file storage reference to attendance_uploads
-- Allows users to retrieve and re-download the originally uploaded Excel files

alter table attendance_uploads
  add column if not exists file_path text;

-- Create the RLS-protected storage bucket for attendance files
-- (Note: Storage buckets are created via Supabase dashboard or via the storage.buckets table,
-- not directly in migrations. This comment documents the intent — the bucket should be
-- named 'attendance-files' with path-based RLS policies applied.)
