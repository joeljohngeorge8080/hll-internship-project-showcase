-- Per-employee, per-month overrides for the Salary Invoice page
-- (src/modules/ems/staff-payroll/SalaryInvoicePage.jsx). Previously these
-- (Ideal Basic, DA, TND, TNDW, PT, Recovery, CIA, RSO overrides entered by
-- clicking a cell) only lived in React component state and were lost on
-- reload/navigation. One row per employee per year/month; a null column
-- means "not overridden — fall back to the computed default" (attendance,
-- state PT map, current_salary, or 0), matching the `??` fallback chain the
-- page already uses.

create table salary_invoice_overrides (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  ideal_basic numeric(14,2),
  da numeric(14,2),
  tnd numeric(6,2),
  tndw numeric(6,2),
  pt numeric(14,2),
  recovery numeric(14,2),
  cia numeric(14,2),
  rso numeric(14,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, year, month)
);
create trigger trg_salary_invoice_overrides_updated_at before update on salary_invoice_overrides
  for each row execute function set_updated_at();

-- RLS mirrors MODULE.STAFF_PAYROLL (src/constants/permissions.js): HR edits,
-- CEO/Heads view-only, same as employee_* child tables in
-- 00000000000031_employee_child_rls.sql.
alter table salary_invoice_overrides enable row level security;

create policy salary_invoice_overrides_select on salary_invoice_overrides for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'hr'));
create policy salary_invoice_overrides_write on salary_invoice_overrides for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));
