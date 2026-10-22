-- Attendance module was entirely localStorage-only (src/services/localAttendance.js
-- and localHolidays.js) despite this Supabase schema (00000000000008_attendance.sql)
-- already existing — meaning attendance data was invisible across browsers/devices
-- and never had RLS. This migration extends attendance_summaries/attendance_uploads
-- to match the app's full computed field set, then turns on RLS everywhere.

-- attendance_summaries' original columns (present_days, half_days, absent_days,
-- leave_days, overtime_minutes, late_count, early_count) are narrower than what
-- buildSummary() in localAttendance.js computes. The app reads/writes exclusively
-- via these new columns; the original ones are left in place, unused.
alter table attendance_summaries
  add column if not exists present_count integer,
  add column if not exists absent_count integer,
  add column if not exists half_day_count integer,
  add column if not exists weekly_off_count integer,
  add column if not exists weekly_off_worked_count integer,
  add column if not exists holiday_count integer,
  add column if not exists leave_count integer,
  add column if not exists late_days integer,
  add column if not exists late_hours text,
  add column if not exists late_minutes_total integer,
  add column if not exists late_units integer,
  add column if not exists excess_late_units integer,
  add column if not exists late_deduction_hours numeric(8,2),
  add column if not exists early_deduction_hours numeric(8,2),
  add column if not exists early_days integer,
  add column if not exists early_hours text,
  add column if not exists total_work_duration text,
  add column if not exists total_overtime text,
  add column if not exists avg_working_hours text,
  add column if not exists total_records integer;

-- uploaded_by is a uuid FK to employees(id), but not every uploader (e.g. an
-- admin/dev-mode account) has a resolvable employee row — same pattern as
-- project_documents.uploaded_by_name (00000000000036_project_documents.sql).
alter table attendance_uploads
  add column if not exists uploaded_by_name text;

alter table attendance_records enable row level security;
alter table attendance_summaries enable row level security;
alter table attendance_uploads enable row level security;
alter table attendance_corrections enable row level security;
alter table holidays enable row level security;

-- Same shape as employee_documents_select/write (00000000000031_employee_child_rls.sql):
-- staff roles or the employee's own record may read; only admin/hr may write.
create policy attendance_records_select on attendance_records for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'hr', 'project_coordinator', 'project_associate', 'project_officer')
    or employee_id = current_employee_id()
  );
create policy attendance_records_write on attendance_records for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

create policy attendance_summaries_select on attendance_summaries for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'hr', 'project_coordinator', 'project_associate', 'project_officer')
    or employee_id = current_employee_id()
  );
create policy attendance_summaries_write on attendance_summaries for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

-- Upload history and the correction audit trail are HR/admin-facing views,
-- not something an individual employee needs to read.
create policy attendance_uploads_select on attendance_uploads for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'hr'));
create policy attendance_uploads_write on attendance_uploads for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

create policy attendance_corrections_select on attendance_corrections for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'hr'));
create policy attendance_corrections_write on attendance_corrections for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

-- Holiday calendar is visible to every signed-in staff member; only admin/hr add/edit.
create policy holidays_select on holidays for select
  using (current_user_role() is not null);
create policy holidays_write on holidays for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));
