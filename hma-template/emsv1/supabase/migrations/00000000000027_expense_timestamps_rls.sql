-- localAdminExpenses.js / localGeneralExpenses.js were localStorage-only and
-- always stamped created_at/updated_at on every record; the tables created in
-- 00000000000010_expenses.sql never gained those columns since nothing wrote
-- to them yet. Adding them now, plus RLS, while wiring these two services to
-- Supabase — same closing-the-gap pattern as 00000000000024_pool_expenses_rls.sql.

alter table expense_categories add column created_at timestamptz not null default now();
alter table expense_categories add column updated_at timestamptz not null default now();
create trigger trg_expense_categories_updated_at before update on expense_categories
  for each row execute function set_updated_at();

alter table general_expenses add column created_at timestamptz not null default now();
alter table general_expenses add column updated_at timestamptz not null default now();
create trigger trg_general_expenses_updated_at before update on general_expenses
  for each row execute function set_updated_at();

alter table admin_expenses add column created_at timestamptz not null default now();
alter table admin_expenses add column updated_at timestamptz not null default now();
create trigger trg_admin_expenses_updated_at before update on admin_expenses
  for each row execute function set_updated_at();

-- RLS mirrors MODULE.GENERAL_EXPENSES / MODULE.EXPENSE_MANAGEMENT
-- (src/constants/permissions.js): CEO/Heads view-only, HR edits, PMS roles
-- have no access to either module — same shape as pool_expenses_write.
alter table expense_categories enable row level security;
alter table expense_uploads enable row level security;
alter table general_expenses enable row level security;
alter table admin_expenses enable row level security;
alter table admin_expense_monthly_actuals enable row level security;

create policy expense_categories_select on expense_categories for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'hr'));
create policy expense_categories_write on expense_categories for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

create policy expense_uploads_select on expense_uploads for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'hr'));
create policy expense_uploads_write on expense_uploads for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

create policy general_expenses_select on general_expenses for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'hr'));
create policy general_expenses_write on general_expenses for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

create policy admin_expenses_select on admin_expenses for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'hr'));
create policy admin_expenses_write on admin_expenses for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

create policy admin_expense_monthly_actuals_select on admin_expense_monthly_actuals for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'hr'));
create policy admin_expense_monthly_actuals_write on admin_expense_monthly_actuals for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));
