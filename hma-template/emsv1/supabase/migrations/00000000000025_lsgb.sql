-- LSGB (Local Self Government Body) tables — previously localStorage-only
-- (src/services/localLsgb.js). Three entities: bodies (the panchayat/
-- municipality itself + sanction details), fund withdrawals against a body's
-- sanctioned amount, and work orders (individual POs dispatched to health
-- centres, kept minimal per docs/SDP Projects 2026-2027.xlsx).

create table lsgb_bodies (
  id uuid primary key default gen_random_uuid(),
  officer_id uuid references employees(id),
  project_id uuid references projects(id),
  body_name text not null,
  body_type text,
  sanction_number text,
  sanction_date date,
  sanctioned_amount numeric(14,2) not null default 0,
  work_order_number text,
  agreement_date date,
  validity_period text,
  office_address text,
  contact_person text,
  contact_role text,
  contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_lsgb_bodies_updated_at before update on lsgb_bodies
  for each row execute function set_updated_at();

create table lsgb_fund_withdrawals (
  id uuid primary key default gen_random_uuid(),
  lsgb_body_id uuid references lsgb_bodies(id) on delete cascade,
  lsgb_body_name text,
  officer_id uuid references employees(id),
  project_id uuid references projects(id),
  amount numeric(14,2) not null default 0,
  withdrawal_date date not null default current_date,
  purpose text not null default 'Core Expenses',
  description text,
  -- Historical: was meant to link a withdrawal to the pool_expenses row that
  -- created it, but the sync that wrote this column was removed along with
  -- the rest of the structured LSGB module. LSGB revenue now flows through
  -- localLsgbRevenue.get()/setBalance() (manual sanctioned balance) and
  -- localOrgPool.getLsgbRevenueUsed() (aggregate of pool_expenses tagged
  -- lsgb_revenue) — this table is no longer written to by the app.
  pool_expense_id uuid references pool_expenses(id) on delete set null,
  created_at timestamptz not null default now()
);

create table lsgb_work_orders (
  id uuid primary key default gen_random_uuid(),
  lsgb_body_id uuid references lsgb_bodies(id),
  customer_name text not null,
  district text,
  po_number text,
  total_qty numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  hma_revenue numeric(14,2) not null default 0,
  order_status text,
  payment_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_lsgb_work_orders_updated_at before update on lsgb_work_orders
  for each row execute function set_updated_at();

-- RLS mirrors MODULE.PMS_PROJECTS (src/constants/permissions.js), the module
-- all three LSGB pages are gated behind: CEO/Heads/Project Coordinator/
-- Project Associate/Project Officer get edit access, HR is view-only.
alter table lsgb_bodies enable row level security;
alter table lsgb_fund_withdrawals enable row level security;
alter table lsgb_work_orders enable row level security;

create policy lsgb_bodies_select on lsgb_bodies for select
  using (current_user_role() in
    ('admin', 'ceo', 'heads', 'hr', 'project_coordinator', 'project_associate', 'project_officer'));
create policy lsgb_bodies_write on lsgb_bodies for all
  using (current_user_role() in
    ('admin', 'ceo', 'heads', 'project_coordinator', 'project_associate', 'project_officer'))
  with check (current_user_role() in
    ('admin', 'ceo', 'heads', 'project_coordinator', 'project_associate', 'project_officer'));

create policy lsgb_fund_withdrawals_select on lsgb_fund_withdrawals for select
  using (current_user_role() in
    ('admin', 'ceo', 'heads', 'hr', 'project_coordinator', 'project_associate', 'project_officer'));
create policy lsgb_fund_withdrawals_write on lsgb_fund_withdrawals for all
  using (current_user_role() in
    ('admin', 'ceo', 'heads', 'project_coordinator', 'project_associate', 'project_officer'))
  with check (current_user_role() in
    ('admin', 'ceo', 'heads', 'project_coordinator', 'project_associate', 'project_officer'));

create policy lsgb_work_orders_select on lsgb_work_orders for select
  using (current_user_role() in
    ('admin', 'ceo', 'heads', 'hr', 'project_coordinator', 'project_associate', 'project_officer'));
create policy lsgb_work_orders_write on lsgb_work_orders for all
  using (current_user_role() in
    ('admin', 'ceo', 'heads', 'project_coordinator', 'project_associate', 'project_officer'))
  with check (current_user_role() in
    ('admin', 'ceo', 'heads', 'project_coordinator', 'project_associate', 'project_officer'));
