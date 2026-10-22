-- attendance_corrections only captured (reason, corrected_by, corrected_at) —
-- no record of what actually changed. AttendanceCorrections.jsx displays an
-- old-status -> new-status badge pair per correction (and localAttendance.js's
-- old localStorage shape stored the same before/after snapshot), so the table
-- needs these fields to support that view.

alter table attendance_corrections
  add column if not exists old_status text,
  add column if not exists new_status text,
  add column if not exists old_leave_type text,
  add column if not exists new_leave_type text,
  add column if not exists old_in_time time,
  add column if not exists new_in_time time,
  add column if not exists old_out_time time,
  add column if not exists new_out_time time;

-- leave_type (SL/CL/OD/COFF) is only ever set via a manual HR correction
-- (never present in the Pace import itself) but is read back off the record
-- for calendar/table display (AttendanceSummaryTab.jsx, AttendanceCorrections.jsx)
-- — attendance_records had nowhere to persist it.
alter table attendance_records
  add column if not exists leave_type text;
