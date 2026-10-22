-- localAttendance.js has always stamped created_at/updated_at when reading and
-- writing attendance_records (see fromDbRecord and applyHolidayToDate), but
-- 00000000000008_attendance.sql never gave the table those columns. Holiday
-- application failed with "Could not find the 'updated_at' column of
-- 'attendance_records' in the schema cache" — same closing-the-gap pattern as
-- 00000000000027_expense_timestamps_rls.sql.

alter table attendance_records add column created_at timestamptz not null default now();
alter table attendance_records add column updated_at timestamptz not null default now();
create trigger trg_attendance_records_updated_at before update on attendance_records
  for each row execute function set_updated_at();
