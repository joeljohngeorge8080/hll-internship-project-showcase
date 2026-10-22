-- Manual per-employee-per-month inputs only; CTC breakdown is always computed
-- fresh at read time (view/function), never persisted here.
create table salary_details (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  year integer not null,
  month integer not null,
  ideal_basic numeric(14,2),
  pt numeric(14,2),
  recovery numeric(14,2),
  tnd numeric(14,2),
  tndw numeric(14,2),
  centre_incharge_allowance numeric(14,2),
  rso_allowance numeric(14,2),
  invoice_no text,
  hc_no text,
  state text,
  remarks text,
  unique (employee_id, year, month)
);

create table core_salaries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  month integer not null,
  year integer not null,
  planned_amount numeric(14,2) not null default 0,
  actual_amount numeric(14,2),
  status text,
  remarks text,
  unique (employee_id, year, month)
);

-- No payroll totals table: localPayroll.js is pure derived queries over
-- employees + projects + salary_details; recreate as SQL views/functions.
