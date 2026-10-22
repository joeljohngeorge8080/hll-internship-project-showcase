-- Database-level audit log for Projects, Employees, and Payroll (salary_details,
-- core_salaries). Rows are written exclusively by the audit_log_row() trigger —
-- there is deliberately no INSERT/UPDATE policy for regular clients, so entries
-- can only be created by the mutations themselves, never forged or edited from
-- the app. Only 'admin' may delete an entry; nobody (including admin) can
-- update one, so the log is append-only short of an admin purge.

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_profile_id uuid references profiles(id),
  actor_employee_id uuid references employees(id),
  actor_name text,
  actor_role app_role,
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb
);

create index idx_audit_logs_table_record on audit_logs (table_name, record_id);
create index idx_audit_logs_created_at on audit_logs (created_at desc);

alter table audit_logs enable row level security;

-- Same privileged-role set that can already see cross-project data (projects_select).
create policy audit_logs_select on audit_logs for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'project_coordinator', 'hr'));

-- No insert/update policy at all: regular clients can never write here directly.
-- The trigger function below is security definer (owned by the migration role),
-- so its inserts bypass RLS as the table owner regardless of who triggered it.

create policy audit_logs_delete on audit_logs for delete
  using (is_admin());

-- Generic row-audit trigger: attach to any table with a uuid `id` primary key.
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
