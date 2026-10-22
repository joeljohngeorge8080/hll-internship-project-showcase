-- Four distinct expense concepts, kept separate per product decision (they track
-- different things: vendor contracts, monthly categorized actuals, pool-ledger
-- entries already in pool_expenses, and project-attributed pool spend).

create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true
);

create table expense_uploads (
  id uuid primary key default gen_random_uuid(),
  file_name text,
  uploaded_by uuid references employees(id),
  uploaded_at timestamptz not null default now()
);

create table general_expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references expense_categories(id),
  expense_name text not null,
  month integer not null,
  year integer not null,
  frequency text,
  planned_amount numeric(14,2) not null default 0,
  actual_amount numeric(14,2),
  status text not null default 'pending',
  remarks text,
  upload_id uuid references expense_uploads(id)
);

-- Org-wide recurring vendor contracts (distinct from general_expenses' monthly
-- categorized actuals and pool_expenses' pool ledger).
create table admin_expenses (
  id uuid primary key default gen_random_uuid(),
  vendor_name text not null,
  expense_category text,
  frequency text,
  annual_amount numeric(14,2),
  expense_group text not null, -- 'HR' | 'Admin'
  status text not null default 'active',
  remarks text
);

create table admin_expense_monthly_actuals (
  id uuid primary key default gen_random_uuid(),
  admin_expense_id uuid not null references admin_expenses(id) on delete cascade,
  year_month date not null, -- normalized to first-of-month
  amount numeric(14,2) not null,
  unique (admin_expense_id, year_month)
);

-- Project-attributed actual spend against a pool (project's own view of pool burn).
create table project_expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  pool pool_name not null,
  month date not null,
  amount numeric(14,2) not null,
  label text,
  expense_date date,
  created_by uuid references employees(id),
  created_at timestamptz not null default now()
);
