-- LSGB Revenue rework: replace the single manually-settable balance
-- (lsgb_revenue_balance, 00000000000050) with a real ledger of individual
-- "money added to LSGB" entries. The sanctioned balance becomes
-- sum(lsgb_revenue_credits.amount) instead of one overridable number, so
-- every deposit keeps its own date/month/year/notes for the inflow side of
-- the LSGB inflow/outflow ledger (outflow already exists: pool_expenses
-- rows tagged lsgb_revenue, see getLsgbRevenueExpenses in localOrgPool.js).
--
-- Ownership: Finance (the 'heads' role, displayed as "Finance" — see
-- ROLE_DISPLAY_OVERRIDES in constants/roles.js) now owns adding money, via
-- a new Finance-only page. HR keeps read access to the combined ledger
-- (already true via MODULE.EXPENSE_MANAGEMENT's LSGB tab) but loses write
-- access — matches lsgb_revenue_balance_write below being narrowed to
-- admin/heads.
create table if not exists lsgb_revenue_credits (
  id uuid primary key default gen_random_uuid(),
  amount numeric(14, 2) not null,
  credit_date date not null,
  month integer not null,
  year integer not null,
  notes text,
  created_by uuid references employees(id),
  created_at timestamptz not null default now()
);

alter table lsgb_revenue_credits enable row level security;

create policy lsgb_revenue_credits_select on lsgb_revenue_credits for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'hr'));

create policy lsgb_revenue_credits_write on lsgb_revenue_credits for all
  using (current_user_role() in ('admin', 'heads'))
  with check (current_user_role() in ('admin', 'heads'));

-- Carry forward whatever sanctioned balance was already entered under the
-- old single-balance model, so switching to a ledger doesn't zero out real
-- money already accounted for.
insert into lsgb_revenue_credits (amount, credit_date, month, year, notes)
select
  balance,
  current_date,
  extract(month from current_date)::int,
  extract(year from current_date)::int,
  'Opening balance (migrated from single-balance entry)'
from lsgb_revenue_balance
where id = '00000000-0000-0000-0000-000000000002' and balance > 0;

-- HR no longer edits the LSGB balance directly — narrow the legacy
-- singleton's write access to match (kept only for the historical row
-- above; nothing reads its `balance` column anymore).
drop policy if exists lsgb_revenue_balance_write on lsgb_revenue_balance;
create policy lsgb_revenue_balance_write on lsgb_revenue_balance for all
  using (current_user_role() in ('admin', 'heads'))
  with check (current_user_role() in ('admin', 'heads'));
