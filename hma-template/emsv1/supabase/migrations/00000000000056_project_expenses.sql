-- Actual per-project expense entries (Admin/HR/Core/Project pool spend
-- logged against a specific project + month) — migrates
-- localProjectExpenses.js off localStorage (see ADR-037). Distinct from
-- pool_expenses (the org-wide vendor ledger): these rows are tied to one
-- project via project_id and feed the Expense Management "Project
-- Expenses" tab, the Consolidated/Apportionment sheets' "Used"/"Actual"
-- figures, and the PMS Monthly Plan's Actual Spend panel. The old
-- localStorage version had no consumer that ever wrote a row — the
-- Project Expenses tab only listed and deleted — so every "actual" figure
-- downstream was silently stuck at zero; the frontend now gains a real
-- Add Expense form alongside this table.
create table project_expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  pool pool_name not null,
  month date not null,
  amount numeric(14,2) not null check (amount > 0),
  label text not null,
  expense_date date not null default current_date,
  logged_by text,
  created_at timestamptz not null default now()
);

create index project_expenses_project_id_idx on project_expenses(project_id);

-- Same ownership shape as pool_expenses (00000000000024_pool_expenses_rls.sql):
-- MODULE.EXPENSE_MANAGEMENT grants HR edit, CEO/Heads view-only.
alter table project_expenses enable row level security;

create policy project_expenses_select on project_expenses for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'hr'));
create policy project_expenses_write on project_expenses for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

alter publication supabase_realtime add table project_expenses;
