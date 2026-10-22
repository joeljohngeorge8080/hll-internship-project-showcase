-- Fixes: "Failed to update project: column table_name of relation audit_logs
-- does not exist" (and the same failure on any employees/salary_details/
-- core_salaries write).
--
-- Root cause: the `audit_logs` table (originally created by
-- 00000000000017_audit_log.sql, extended by 00000000000060 and 00000000000077)
-- was dropped by hand and got recreated by the FastAPI backend's
-- `SQLModel.metadata.create_all()` on its next startup (app/database.py),
-- using the backend's own AuditLog ORM model shape (module_name/action_type/
-- old_value/new_value) instead of the original migration shape
-- (table_name/action/old_data/new_data/entry_kind/...). The trigger function
-- audit_log_row() — still attached to projects/employees/salary_details/
-- core_salaries — was never touched and still inserts using `table_name`,
-- so it now fails on every row it tries to log, rolling back the very
-- update/insert/delete that triggered it.
--
-- Fix: archive the ORM-shaped rows (small number of Auth login/logout
-- entries written by the backend while the table was in the wrong shape),
-- then recreate `audit_logs` in its original trigger-compatible shape (with
-- `ip_address` added, since that's a real capability the backend model had
-- that the original schema lacked) and reattach the trigger + RPC function.
-- The backend's AuditLog model and write_audit() are updated in the same
-- change to target these column names, and the model no longer manages a
-- table shape that conflicts with what the migrations define — see
-- backend/app/models/audit.py and backend/app/services/audit_service.py.

do $$
begin
  if to_regclass('public.audit_logs') is not null then
    execute 'alter table audit_logs rename to audit_logs_orm_backup_20260920';
  end if;
end
$$;

drop trigger if exists trg_audit_projects on projects;
drop trigger if exists trg_audit_employees on employees;
drop trigger if exists trg_audit_salary_details on salary_details;
drop trigger if exists trg_audit_core_salaries on core_salaries;
drop function if exists audit_log_row();
drop function if exists log_manual_audit_entry(text, text, text, text, jsonb, jsonb, text);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Deliberately NOT a foreign key (the original 00000000000017 migration
  -- had `references profiles(id)`/`references employees(id)` here). Two
  -- reasons: (1) a hard FK with the default RESTRICT action would make it
  -- impossible to ever delete a profile or employee once they have a single
  -- audit entry, which every write guarantees within one action; (2) the
  -- FastAPI backend now writes rows here directly using its own `users.id`,
  -- and there's no verified guarantee that always matches a `profiles.id`
  -- row — an unenforced mismatch would silently orphan the reference,
  -- whereas an enforced one would hard-fail every backend audit write.
  -- An audit log's job is to record what happened, not to stay perfectly
  -- relationally normalized; an orphaned id here is harmless.
  actor_profile_id uuid,
  actor_employee_id uuid,
  actor_name text,
  -- Deliberately `text`, not the `app_role` enum: trigger rows cast an
  -- app_role value in here (fine, enum->text is implicit), but the FastAPI
  -- backend's own UserRole enum uses different casing/values entirely
  -- ('Admin', 'Project Officer', ...) and would fail an enum constraint.
  actor_role text,
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE', 'MANUAL')),
  old_data jsonb,
  new_data jsonb,
  entry_kind text not null default 'trigger' check (entry_kind in ('trigger', 'manual')),
  action_label text,
  record_label text,
  details text,
  ip_address text
);

comment on column audit_logs.table_name is
  'For entry_kind=trigger: the real Postgres table name. For entry_kind=manual: a free-text module label (e.g. "General Expenses" or "Auth") supplied by the caller.';
comment on column audit_logs.action_label is
  'entry_kind=manual only: the free-form action string (e.g. LOGIN, EMPLOYEE_CREATED) supplied by the caller.';
comment on column audit_logs.record_label is
  'entry_kind=manual only: human-readable label for the affected record.';
comment on column audit_logs.details is
  'entry_kind=manual only: one-line summary supplied by the caller.';
comment on column audit_logs.ip_address is
  'entry_kind=manual only: client IP captured by the backend for auth/security-relevant events.';

create index idx_audit_logs_table_record on audit_logs (table_name, record_id);
create index idx_audit_logs_created_at on audit_logs (created_at desc);
create index idx_audit_logs_entry_kind on audit_logs (entry_kind);

alter table audit_logs enable row level security;

create policy audit_logs_select on audit_logs for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'project_coordinator', 'hr', 'project_associate'));

-- No insert/update policy at all: regular clients can never write here
-- directly. The trigger function and log_manual_audit_entry() below are
-- security definer (owned by the migration role), so their inserts bypass
-- RLS as the table owner regardless of who triggered them.

create policy audit_logs_delete on audit_logs for delete
  using (is_admin());

create or replace function audit_log_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_employee_id uuid;
  v_name text;
  v_role app_role;
  v_record_id uuid;
begin
  select employee_id, full_name, role into v_employee_id, v_name, v_role
  from profiles where id = v_profile_id;

  if TG_OP = 'DELETE' then
    v_record_id := OLD.id;
  else
    v_record_id := NEW.id;
  end if;

  insert into audit_logs (
    actor_profile_id, actor_employee_id, actor_name, actor_role,
    table_name, record_id, action, old_data, new_data
  ) values (
    v_profile_id,
    v_employee_id,
    coalesce(v_name, 'System'),
    v_role,
    TG_TABLE_NAME,
    v_record_id,
    TG_OP,
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(OLD) else null end,
    case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(NEW) else null end
  );

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

create trigger trg_audit_projects
  after insert or update or delete on projects
  for each row execute function audit_log_row();

create trigger trg_audit_employees
  after insert or update or delete on employees
  for each row execute function audit_log_row();

create trigger trg_audit_salary_details
  after insert or update or delete on salary_details
  for each row execute function audit_log_row();

create trigger trg_audit_core_salaries
  after insert or update or delete on core_salaries
  for each row execute function audit_log_row();

-- Manual-write RPC for browser (supabase-js) callers that edit tables with
-- no trigger coverage (General Expenses, Expense Pools, Payroll details,
-- Payment Credentials, Attendance). Identity is derived server-side from
-- auth.uid(), never from client input, same tamper-resistance guarantee as
-- the trigger path. The FastAPI backend does NOT use this RPC — it already
-- authenticates the acting user itself before calling write_audit(), and
-- inserts into audit_logs directly using its own trusted actor.
create or replace function log_manual_audit_entry(
  p_module text,
  p_action text,
  p_record_id text default null,
  p_record_label text default null,
  p_old_value jsonb default null,
  p_new_value jsonb default null,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_employee_id uuid;
  v_name text;
  v_role app_role;
  v_record_id uuid;
  v_new_id uuid;
begin
  if v_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  select employee_id, full_name, role into v_employee_id, v_name, v_role
  from profiles where id = v_profile_id;

  begin
    v_record_id := p_record_id::uuid;
  exception when others then
    v_record_id := null;
  end;

  insert into audit_logs (
    actor_profile_id, actor_employee_id, actor_name, actor_role,
    table_name, record_id, action, old_data, new_data,
    entry_kind, action_label, record_label, details
  ) values (
    v_profile_id, v_employee_id, coalesce(v_name, 'Unknown'), v_role,
    coalesce(p_module, 'Unknown'), v_record_id, 'MANUAL', p_old_value, p_new_value,
    'manual', p_action, coalesce(p_record_label, p_record_id), p_details
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;

grant execute on function log_manual_audit_entry(text, text, text, text, jsonb, jsonb, text) to authenticated;
