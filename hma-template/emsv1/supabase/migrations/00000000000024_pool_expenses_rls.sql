-- Core-pool expenses can be linked to a specific overhead employee (the
-- picker in GlobalHRPoolPage.jsx that pre-fills amount from their salary,
-- and dedupes the dropdown against employees already added) — the mock
-- (localOrgPool.js core_expenses) has always carried this as `employee_id`,
-- but the table never gained the column. Add it now, while wiring the
-- frontend to Supabase, so that piece of functionality isn't dropped.
alter table pool_expenses add column employee_id uuid references employees(id);

-- pool_expenses/pool_expense_allocations/admin_pool_credits (00000000000005_org_pool.sql)
-- were created with no RLS enabled — the frontend (localOrgPool.js) has run
-- entirely on localStorage since, so this gap was never exercised. Wiring
-- the frontend to Supabase now, so closing it first.
--
-- Ownership matches permissions.js: MODULE.HR_POOL grants HR edit access and
-- CEO/Heads view-only, same shape as internships_select/internships_write.
alter table pool_expenses enable row level security;
alter table pool_expense_allocations enable row level security;
alter table admin_pool_credits enable row level security;

create policy pool_expenses_select on pool_expenses for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'hr'));
create policy pool_expenses_write on pool_expenses for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

create policy pool_expense_allocations_select on pool_expense_allocations for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'hr'));
create policy pool_expense_allocations_write on pool_expense_allocations for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

create policy admin_pool_credits_select on admin_pool_credits for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'hr'));
create policy admin_pool_credits_write on admin_pool_credits for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));
