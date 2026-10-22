-- Expense Pools redesign: LSGB revenue as a real funding source again — a
-- single manually-settable balance (HR types in the sanctioned amount after
-- uploading the LSGB sheet), auto-decremented by bookings tagged
-- lsgb_revenue (pool_expenses.lsgb_revenue_pct already exists, unused,
-- since 00000000000005_org_pool.sql). Singleton row, same fixed-UUID
-- pattern as lsgb_sheet (00000000000040_lsgb_sheet.sql), kept as its own
-- table rather than a column on lsgb_sheet since HR needs write access here
-- but is view-only on the sheet itself (lsgb_sheet_write, migration 040).
create table if not exists lsgb_revenue_balance (
  id uuid primary key default '00000000-0000-0000-0000-000000000002',
  balance numeric(14, 2) not null default 0,
  updated_by uuid references employees(id),
  updated_at timestamptz not null default now()
);

alter table lsgb_revenue_balance enable row level security;

create policy lsgb_revenue_balance_select on lsgb_revenue_balance for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'hr'));

create policy lsgb_revenue_balance_write on lsgb_revenue_balance for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

insert into lsgb_revenue_balance (id) values ('00000000-0000-0000-0000-000000000002')
  on conflict do nothing;
