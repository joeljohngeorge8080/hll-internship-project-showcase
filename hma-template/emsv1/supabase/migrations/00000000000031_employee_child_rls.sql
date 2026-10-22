-- Employee child tables (contacts, addresses, employment, identification, bank
-- accounts, family members, documents, status/department history) were created
-- in 00000000000002_employees.sql without RLS — confirmed live that the anon
-- key gets 200 reading all of them. Same shape as the employees table's own
-- policy (00000000000014_rls_core.sql): staff roles or the employee's own
-- record may read; only admin/hr may write, matching who edits Staff & Payroll.

alter table employee_contacts enable row level security;
alter table employee_addresses enable row level security;
alter table employee_employment enable row level security;
alter table employee_identification enable row level security;
alter table employee_bank_accounts enable row level security;
alter table employee_family_members enable row level security;
alter table employee_documents enable row level security;
alter table employee_status_history enable row level security;
alter table employee_department_history enable row level security;

create policy employee_contacts_select on employee_contacts for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'hr', 'project_coordinator', 'project_associate', 'project_officer')
    or employee_id = current_employee_id()
  );
create policy employee_contacts_write on employee_contacts for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

create policy employee_addresses_select on employee_addresses for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'hr', 'project_coordinator', 'project_associate', 'project_officer')
    or employee_id = current_employee_id()
  );
create policy employee_addresses_write on employee_addresses for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

create policy employee_employment_select on employee_employment for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'hr', 'project_coordinator', 'project_associate', 'project_officer')
    or employee_id = current_employee_id()
  );
create policy employee_employment_write on employee_employment for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

create policy employee_identification_select on employee_identification for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'hr')
    or employee_id = current_employee_id()
  );
create policy employee_identification_write on employee_identification for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

create policy employee_bank_accounts_select on employee_bank_accounts for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'hr')
    or employee_id = current_employee_id()
  );
create policy employee_bank_accounts_write on employee_bank_accounts for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

create policy employee_family_members_select on employee_family_members for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'hr')
    or employee_id = current_employee_id()
  );
create policy employee_family_members_write on employee_family_members for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

create policy employee_documents_select on employee_documents for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'hr')
    or employee_id = current_employee_id()
  );
create policy employee_documents_write on employee_documents for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

create policy employee_status_history_select on employee_status_history for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'hr')
    or employee_id = current_employee_id()
  );
create policy employee_status_history_write on employee_status_history for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

create policy employee_department_history_select on employee_department_history for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'hr', 'project_coordinator')
    or employee_id = current_employee_id()
  );
create policy employee_department_history_write on employee_department_history for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));
