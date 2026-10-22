create type attendance_status as enum ('present', 'half_day', 'absent', 'on_leave', 'holiday', 'weekly_off');

create table attendance_uploads (
  id uuid primary key default gen_random_uuid(),
  file_name text,
  year integer not null,
  month integer not null,
  total_records integer,
  valid_records integer,
  total_employees integer,
  status text,
  uploaded_by uuid references employees(id),
  uploaded_at timestamptz not null default now()
);

create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  attendance_date date not null,
  year integer not null,
  month integer not null,
  status attendance_status not null,
  in_time time,
  out_time time,
  work_duration_minutes integer,
  late_by_minutes integer,
  early_by_minutes integer,
  is_weekly_off_type boolean not null default false,
  overtime_minutes integer,
  shift text,
  pre_holiday_status text,
  upload_id uuid references attendance_uploads(id),
  unique (employee_id, attendance_date)
);

-- Append-only audit trail of auto/manual corrections applied to a record
-- (weekend/holiday reclassification, late/early half-day rules, etc.).
create table attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null references attendance_records(id) on delete cascade,
  reason text not null,
  corrected_by uuid references employees(id), -- null = system auto-correction
  corrected_at timestamptz not null default now()
);

-- Rebuilt (not purely computed on read) so payroll can depend on a stable shape;
-- refresh via trigger/function whenever attendance_records changes for that employee+month.
create table attendance_summaries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  year integer not null,
  month integer not null,
  present_days numeric(5,2),
  half_days numeric(5,2),
  absent_days numeric(5,2),
  leave_days numeric(5,2),
  overtime_minutes integer,
  late_count integer,
  early_count integer,
  updated_at timestamptz not null default now(),
  unique (employee_id, year, month)
);

-- Only custom holiday overrides are stored; Sundays and 2nd/4th Saturdays remain
-- computed at the application layer, not pre-populated here.
create table holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  name text not null,
  year integer not null,
  month integer not null
);
