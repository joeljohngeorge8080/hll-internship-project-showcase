create type project_status as enum ('pipeline', 'approved', 'ongoing', 'completed');

create table projects (
  id uuid primary key default gen_random_uuid(),
  project_code text not null unique,
  project_type text,
  title text not null,
  description text,
  funding_agency text, -- absorbs localDonors.js: donor is a funding_agency on a project, not a parallel entity
  implementing_partner text,
  location text,
  district text,
  status project_status not null default 'pipeline',
  phase text,
  project_value numeric(14,2) not null default 0,
  amount_received numeric(14,2) not null default 0,
  amount_sanctioned numeric(14,2) not null default 0,
  amount_spent numeric(14,2) not null default 0,
  amount_utilized numeric(14,2) not null default 0,
  expense_accounted numeric(14,2) not null default 0,
  committed_expense numeric(14,2) not null default 0,
  start_date date,
  end_date date,
  beneficiaries_target integer,
  beneficiaries_completed integer,
  project_associate_id uuid references employees(id),
  core_pct numeric(5,2) not null default 5,
  hr_pct numeric(5,2) not null default 5,
  admin_pct numeric(5,2) not null default 5,
  remarks text,
  status_ts_note text, -- carried from localDonors.notes where merged
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_projects_updated_at before update on projects
  for each row execute function set_updated_at();

-- Replaces officer_ids array. "Project Officer" is derived from employee designation
-- string in current code; formalized here as an explicit assignment row instead of
-- string-matching designation, per data-model review.
create table project_officer_assignments (
  project_id uuid not null references projects(id) on delete cascade,
  employee_id uuid not null references employees(id),
  assigned_at timestamptz not null default now(),
  primary key (project_id, employee_id)
);

create table project_installments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  label text,
  percentage numeric(5,2),
  amount numeric(14,2),
  phase_name text,
  start_date date,
  target_date date,
  actual_date date,
  uc_status uc_status not null default 'pending'
);

create table project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  amount numeric(14,2),
  target_date date,
  actual_date date,
  uc_status uc_status not null default 'pending'
);

create table project_risks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  severity text,
  status text
);

create table project_field_personnel (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text,
  email text not null,
  status text not null default 'invited',
  invited_at timestamptz not null default now()
);

-- Time-varying override of projects.hr_pct/core_pct from a given month onward.
create table project_pool_pct_adjustments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  from_month date not null,
  hr_pct numeric(5,2) not null,
  core_pct numeric(5,2) not null,
  created_at timestamptz not null default now()
);

create table project_monthly_plan (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  month date not null,
  total numeric(14,2) not null default 0,
  unique (project_id, month)
);

create table project_monthly_plan_phases (
  id uuid primary key default gen_random_uuid(),
  monthly_plan_id uuid not null references project_monthly_plan(id) on delete cascade,
  phase text,
  name text,
  amount numeric(14,2) not null default 0,
  actual numeric(14,2)
);

-- Immutable ledger: rows are appended, never updated in place, matching current
-- filter+reinsert semantics in localOrgPool.js.
create table project_pool_adjustments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  pool pool_name not null,
  month date not null,
  amount numeric(14,2) not null,
  source pool_adjustment_source not null,
  reason text,
  counter_month date,
  created_by uuid references employees(id),
  created_at timestamptz not null default now()
);

-- PO's "release to EMS" gate; unlocks EMS-side spend against a pool+month.
create table project_sent_allocations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  pool pool_name not null,
  month date not null,
  amount numeric(14,2) not null,
  sent_by uuid references employees(id),
  sent_at timestamptz not null default now()
);
