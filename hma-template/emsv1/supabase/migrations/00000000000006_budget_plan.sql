create type budget_plan_status as enum ('planning', 'submitted');

create table budget_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references projects(id) on delete cascade,
  status budget_plan_status not null default 'planning',
  submitted_at timestamptz,
  project_value numeric(14,2) not null,
  start_date date,
  end_date date,
  admin_pct numeric(5,2) not null default 5,
  hr_pct numeric(5,2) not null default 5,
  core_pct numeric(5,2) not null default 5,
  saved_snapshot jsonb, -- explicit point-in-time copy for Reset; not queried structurally
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_budget_plans_updated_at before update on budget_plans
  for each row execute function set_updated_at();

create table budget_plan_months (
  id uuid primary key default gen_random_uuid(),
  budget_plan_id uuid not null references budget_plans(id) on delete cascade,
  month date not null,
  unique (budget_plan_id, month)
);

-- Normalized (not jsonb) because subtasks are mutated per-row routinely (add/remove/
-- amend amount) rather than replaced wholesale.
create table budget_plan_tasks (
  id uuid primary key default gen_random_uuid(),
  budget_plan_month_id uuid not null references budget_plan_months(id) on delete cascade,
  phase text,
  name text not null,
  recurring boolean not null default false,
  is_ledger_import boolean not null default false, -- replaces magic-string LEDGER_TASK_NAME match
  added_in_actual boolean not null default false
);

create table budget_plan_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references budget_plan_tasks(id) on delete cascade,
  name text not null,
  planned_amount numeric(14,2) not null default 0,
  actual_amount numeric(14,2),
  actual_status text,
  activity text,
  activity_other text,
  sub_budget_head text
);

-- Append-only ledger of amount transfers between months/pools within a plan.
create table budget_plan_transfers (
  id uuid primary key default gen_random_uuid(),
  budget_plan_id uuid not null references budget_plans(id) on delete cascade,
  phase text not null, -- 'planning' | 'actual'
  origin_month date,
  from_ref text,
  to_ref text,
  amount numeric(14,2) not null,
  tag text,
  pool_ref pool_name,
  created_by uuid references employees(id),
  created_at timestamptz not null default now()
);
