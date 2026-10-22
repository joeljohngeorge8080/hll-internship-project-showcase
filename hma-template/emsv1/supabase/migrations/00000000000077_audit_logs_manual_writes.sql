-- Extends audit_logs (00000000000017_audit_log.sql) so modules without a
-- trigger-covered table (General Expenses, Expense Pools, Payroll details,
-- Payment Credentials, Attendance, Auth) can also log real, centrally-visible
-- entries — closing the gap where localAudit.write() only ever wrote to
-- browser localStorage, invisible to every other admin/device.
--
-- Preserves the original design's tamper-resistance invariant: audit_logs
-- still has NO insert/update policy for regular clients. The only two ways
-- a row can ever be created are (a) the existing audit_log_row() triggers,
-- or (b) log_manual_audit_entry() below — both security definer, both
-- deriving actor identity server-side from auth.uid() via profiles, never
-- from client-supplied input. A malicious client can call the RPC with a
-- fabricated module/action/details string, but it can never forge *who*
-- performed it, which is the property the original migration protects.

alter table audit_logs
  add column entry_kind text not null default 'trigger' check (entry_kind in ('trigger', 'manual')),
  add column action_label text,
  add column record_label text,
  add column details text;

comment on column audit_logs.entry_kind is
  'trigger = written by audit_log_row() on projects/employees/salary_details/core_salaries; manual = written by log_manual_audit_entry() for every other module.';
comment on column audit_logs.table_name is
  'For entry_kind=trigger: the real Postgres table name. For entry_kind=manual: a free-text module label (e.g. "General Expenses") supplied by the caller — already human-readable, not looked up via TABLE_MODULE client-side.';
comment on column audit_logs.action_label is
  'entry_kind=manual only: the free-form action string (e.g. EMPLOYEE_CREATED) supplied by the caller. Trigger rows derive their action label client-side from the action/table_name columns instead.';
comment on column audit_logs.record_label is
  'entry_kind=manual only: human-readable label for the affected record, since manual record ids are not reliably real uuids. Trigger rows derive this client-side from old_data/new_data.';
comment on column audit_logs.details is
  'entry_kind=manual only: one-line summary supplied by the caller. Trigger rows derive a field-diff summary client-side instead.';

alter table audit_logs drop constraint audit_logs_action_check;
alter table audit_logs add constraint audit_logs_action_check
  check (action in ('INSERT', 'UPDATE', 'DELETE', 'MANUAL'));

create index idx_audit_logs_entry_kind on audit_logs (entry_kind);

-- Same actor-identity lookup audit_log_row() already performs — copied, not
-- shared, so this function's contract stays independent of the trigger's.
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

  -- Manual callers pass whatever id the source record has (often a real
  -- uuid, sometimes not) — cast on a best-effort basis; record_label always
  -- carries the human-readable fallback regardless of whether this succeeds.
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
