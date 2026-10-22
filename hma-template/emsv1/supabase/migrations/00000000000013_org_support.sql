create table announcements (
  id uuid primary key default gen_random_uuid(),
  announcement_type text not null,
  title text not null,
  body text not null,
  target_roles app_role[] not null default '{}',
  sent_by uuid references employees(id),
  sent_at timestamptz not null default now()
);

-- Replaces read_by uuid[] with a proper join table for RLS/query sanity.
create table announcement_reads (
  announcement_id uuid not null references announcements(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create table ceo_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  color text,
  created_by uuid references employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_ceo_notes_updated_at before update on ceo_notes
  for each row execute function set_updated_at();

create table notifications (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  role_target app_role,
  related_project_id uuid references projects(id),
  notification_type text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Single-row settings table (app enforces there is exactly one row via application logic).
create table admin_settings (
  id boolean primary key default true check (id),
  maintenance_mode boolean not null default false,
  session_timeout_minutes integer not null default 60,
  password_policy jsonb not null default '{}',
  notification_prefs jsonb not null default '{}',
  retention_days integer,
  updated_at timestamptz not null default now()
);
create trigger trg_admin_settings_updated_at before update on admin_settings
  for each row execute function set_updated_at();

-- Real audit log (closes GAPS.md G2 — localAudit.js had no write path).
-- Populated by application-layer writes and/or triggers on sensitive tables
-- (expenses, payroll, budget approvals, employee status changes).
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  table_name text not null,
  row_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_log_table_row on audit_log (table_name, row_id);
