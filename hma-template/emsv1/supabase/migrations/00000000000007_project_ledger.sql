-- Re-upload replaces the whole ledger (delete+insert in one transaction at the
-- application layer), never merges rows.
create table project_ledgers (
  project_id uuid primary key references projects(id) on delete cascade,
  source_file text,
  source_sheet text,
  activity_overrides jsonb not null default '{}',
  uploaded_by uuid references employees(id),
  uploaded_at timestamptz not null default now()
);

create table project_ledger_rows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  entry_date date,
  particulars text,
  amount numeric(14,2) not null,
  activity text,
  activity_raw text,
  month date,
  committed boolean not null default false,
  budget_head text,
  phase text
);
