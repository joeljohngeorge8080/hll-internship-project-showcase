create table beneficiaries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  age integer,
  apl_bpl text,
  place_ward text,
  phone text,
  address text,
  occupation text
);

create table beneficiary_follow_ups (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references beneficiaries(id) on delete cascade,
  follow_up_date date not null,
  completed boolean not null default false,
  notes text
);

-- Wide, low-normalization table mirroring an external ops spreadsheet 1:1.
create table lsgb_bodies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  officer_id uuid references employees(id),
  body_name text not null,
  body_type text not null,
  sanction_number text,
  sanction_date date,
  sanction_amount numeric(14,2),
  work_order_number text,
  agreement_date date,
  contact_name text,
  contact_phone text,
  contact_email text
);

create table lsgb_fund_withdrawals (
  id uuid primary key default gen_random_uuid(),
  lsgb_body_id uuid not null references lsgb_bodies(id) on delete cascade,
  project_id uuid references projects(id),
  officer_id uuid references employees(id),
  amount numeric(14,2) not null,
  withdrawal_date date not null,
  purpose text not null -- 'Core' | 'HR' | 'Other Operational'
);

create table lsgb_work_orders (
  id uuid primary key default gen_random_uuid(),
  lsgb_body_id uuid references lsgb_bodies(id),
  project_id uuid references projects(id),
  details jsonb not null default '{}' -- 50+ column ops-tracking sheet; kept flexible, revisit if queried structurally
);

create table internships (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  institution text,
  department text,
  start_date date,
  end_date date,
  supervisor uuid references employees(id),
  status text,
  amount_received numeric(14,2),
  payment_status text,
  remarks text
);

create table recruitments (
  id uuid primary key default gen_random_uuid(),
  activity_type text not null, -- 'recruitment' | 'training'
  candidate_name text not null,
  position text,
  department text,
  date_applied date,
  interview_date date,
  status text,
  amount_received numeric(14,2),
  payment_status text,
  remarks text
);

create type task_type as enum ('task', 'procurement');
create type task_status as enum ('active', 'completed', 'cancelled');

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  installment_id uuid references project_installments(id),
  title text not null,
  description text,
  task_type task_type not null default 'task',
  assignee uuid references employees(id),
  assigned_by uuid references employees(id),
  assigned_at timestamptz not null default now(),
  due_date date,
  status task_status not null default 'active'
);
