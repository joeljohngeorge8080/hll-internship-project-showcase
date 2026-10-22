-- sent_by/created_by are uuid FKs to employees(id), but not every sender (e.g.
-- an admin/dev-mode account) has a resolvable employee row — same pattern as
-- attendance_uploads.uploaded_by_name (00000000000047) and
-- project_documents.uploaded_by_name (00000000000036).

alter table announcements
  add column if not exists sent_by_name text;

alter table ceo_notes
  add column if not exists created_by_name text;
