-- Replaces the 3 near-identical hr_expenses/core_expenses/admin_expenses arrays
-- in localOrgPool.js with one table distinguished by `pool`.
create table pool_expenses (
  id uuid primary key default gen_random_uuid(),
  pool pool_name not null,
  label text not null,
  vendor text,
  frequency text,
  yearly_price numeric(14,2),
  amount numeric(14,2) not null,
  expense_date date not null,
  notes text,
  bill_no text,
  entered_by_project_id uuid references projects(id),
  revenue_sources text[] not null default '{}', -- e.g. {project_pool, hr_revenue, lsgb_revenue, admin_pool}
  hr_revenue_pct numeric(5,2),
  lsgb_revenue_pct numeric(5,2),
  project_pool_pct numeric(5,2),
  admin_share_pct numeric(5,2), -- core-pool expenses only
  created_by uuid references employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_pool_expenses_updated_at before update on pool_expenses
  for each row execute function set_updated_at();

-- Proportional per-project split of a pool_expense, queried/updated routinely
-- enough to warrant a real child table rather than a jsonb snapshot.
create table pool_expense_allocations (
  id uuid primary key default gen_random_uuid(),
  pool_expense_id uuid not null references pool_expenses(id) on delete cascade,
  project_id uuid not null references projects(id),
  share_pct numeric(5,2) not null,
  amount_charged numeric(14,2) not null
);

create table admin_pool_credits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  amount numeric(14,2) not null,
  created_at timestamptz not null default now()
);
