-- Daily Reports (PMS field-personnel expense/task reports), migrated from
-- localStorage ('hma_daily_reports_v2') — see localReports.js. Mirrors the
-- DRD Report Object shape the local store already used, field-for-field, so
-- no data model changes ride along with the storage-layer migration.
--
-- task_id/submitted_by/reviewed_by are kept as plain text, not uuid FKs:
-- localTasks.js (the task store these reference) is still localStorage-only
-- (out of scope for this migration) and its demo seed data uses non-uuid
-- placeholder ids like 'task_001' — a uuid column or FK here would reject
-- that. Revisit once Tasks is migrated too.
--
-- No RLS: every PMS role already needs broad read/write here (field
-- personnel submit, project officers/coordinators review) — same
-- low-ceremony convention as forecast_visibility and other PMS-internal
-- tables that don't hold financial or credential data.

create table daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null default 'expense' check (report_type in ('expense', 'task')),
  submitted_by text,
  submitted_by_name text,
  submitted_at timestamptz,
  bill_topic text,
  amount numeric(14,2) not null default 0,
  report_date date,
  report_time text,
  notes text,
  geo_photos jsonb not null default '[]',
  bill_uploads jsonb not null default '[]',
  meetings jsonb,
  task_id text,
  task_title text,
  requested_status text,
  status text not null default 'submitted' check (
    status in ('draft', 'submitted', 'declined', 'resubmitted', 'approved', 'settled', 'report_submitted')
  ),
  decline_reason text,
  reviewed_by text,
  reviewed_at timestamptz,
  forwarded_to_backend_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_daily_reports_status on daily_reports (status);
create index idx_daily_reports_submitted_by on daily_reports (submitted_by);
create index idx_daily_reports_report_date on daily_reports (report_date desc);

create trigger trg_daily_reports_updated_at before update on daily_reports
  for each row execute function set_updated_at();
