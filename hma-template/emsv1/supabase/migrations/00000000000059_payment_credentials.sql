-- HR's "Payments" tab (Expense Management) needs a shared login for the
-- billing-only AWS IAM user. Deliberately its own table with tighter RLS
-- than the rest of Expense Management (admin/hr only, not the module's
-- usual ceo/heads/coordinator/associate viewers) since this holds a real
-- secret, not operational data. Not audited via the generic audit_log_row()
-- trigger used on projects/employees/salary_details/core_salaries — that
-- trigger writes full old/new row JSON into audit_logs, which ceo/heads/
-- coordinator/associate can read on the Audit Logs page, and would leak the
-- password to roles this table explicitly excludes.
create table payment_credentials (
  id uuid primary key default gen_random_uuid(),
  service text not null unique, -- 'aws' for now; extensible if others ever need a stored login
  login_url text,
  username text,
  password text,
  notes text,
  updated_at timestamptz not null default now()
);
create trigger trg_payment_credentials_updated_at before update on payment_credentials
  for each row execute function set_updated_at();

alter table payment_credentials enable row level security;

create policy payment_credentials_select on payment_credentials for select
  using (current_user_role() in ('admin', 'hr'));
create policy payment_credentials_write on payment_credentials for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));
