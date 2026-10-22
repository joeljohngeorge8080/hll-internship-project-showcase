-- localEmployees.list()'s search filter (EmployeeList.jsx) does
-- `.or(employee_id.ilike.%q%, first_name.ilike.%q%, last_name.ilike.%q%)`.
-- A leading '%' defeats a plain btree index (Postgres can't use it for a
-- substring match), so every search was a full table scan. pg_trgm's GIN
-- index supports '%term%' ILIKE directly, so this keeps the existing
-- substring-match search UX instead of narrowing it to prefix-only.
create extension if not exists pg_trgm;

create index if not exists idx_employees_employee_id_trgm
  on employees using gin (employee_id gin_trgm_ops);
create index if not exists idx_employees_first_name_trgm
  on employees using gin (first_name gin_trgm_ops);
create index if not exists idx_employees_last_name_trgm
  on employees using gin (last_name gin_trgm_ops);

-- Plain equality filters used by localEmployees.list() (status, category)
-- and the department filter's `!inner` join condition.
create index if not exists idx_employees_status on employees(status);
create index if not exists idx_employees_category on employees(employee_category);
create index if not exists idx_employee_employment_department on employee_employment(department);

-- FK lookups: every history/child table is always queried by employee_id
-- (getById's joins, syncBankAccounts/syncFamilyMembers, report exports).
-- These aren't auto-created by the `references employees(id)` FK itself.
create index if not exists idx_employee_bank_accounts_employee_id on employee_bank_accounts(employee_id);
create index if not exists idx_employee_family_members_employee_id on employee_family_members(employee_id);
create index if not exists idx_salary_history_employee_id on salary_history(employee_id, created_at desc);
create index if not exists idx_employee_status_history_employee_id on employee_status_history(employee_id);
create index if not exists idx_employee_department_history_employee_id on employee_department_history(employee_id);
