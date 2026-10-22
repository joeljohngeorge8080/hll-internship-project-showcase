-- localCoreSalaries.js / localSalaryDetails.js were localStorage-only; nothing
-- ever wrote to salary_details/core_salaries so they never gained the columns
-- the UI actually needs (da, pt_auto, pt_override — see MonthlySalaryDetailsTab.jsx)
-- or timestamps, and RLS was never enabled on either table. Closing all three
-- gaps together while wiring these two services to Supabase — same pattern as
-- 00000000000027_expense_timestamps_rls.sql.

alter table salary_details add column da numeric(14,2) not null default 0;
alter table salary_details add column pt_auto boolean not null default true;
alter table salary_details add column pt_override numeric(14,2);
alter table salary_details add column created_at timestamptz not null default now();
alter table salary_details add column updated_at timestamptz not null default now();
create trigger trg_salary_details_updated_at before update on salary_details
  for each row execute function set_updated_at();

alter table core_salaries add column created_at timestamptz not null default now();
alter table core_salaries add column updated_at timestamptz not null default now();
create trigger trg_core_salaries_updated_at before update on core_salaries
  for each row execute function set_updated_at();

-- RLS mirrors MODULE.STAFF_PAYROLL / MODULE.GENERAL_EXPENSES
-- (src/constants/permissions.js): CEO/Heads view-only, HR edits, PMS roles
-- have no access — same shape as general_expenses_select/write.
alter table salary_details enable row level security;
alter table core_salaries enable row level security;

create policy salary_details_select on salary_details for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'hr'));
create policy salary_details_write on salary_details for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

create policy core_salaries_select on core_salaries for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'hr'));
create policy core_salaries_write on core_salaries for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));
