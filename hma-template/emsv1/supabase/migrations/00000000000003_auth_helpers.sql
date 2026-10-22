-- These reference `profiles`, so they must run after 00000000000002_employees.sql
-- (which creates profiles) rather than alongside the other schema-wide helpers.

-- profiles.role lookup for the currently authenticated user; used throughout RLS policies.
create or replace function current_user_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(current_user_role() = 'admin', false);
$$;

-- profiles.employee_id lookup; row-scoping policies (PA/PO/coordinator) join through this.
create or replace function current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select employee_id from profiles where id = auth.uid();
$$;
