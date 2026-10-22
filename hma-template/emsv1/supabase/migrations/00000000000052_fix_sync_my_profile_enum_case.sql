-- sync_my_profile() compared users.role against the UserRole *values* ('Admin',
-- 'Heads', ...), but SQLModel/SQLAlchemy auto-created the Postgres `userrole`
-- enum using the Python enum's *member names* instead ('ADMIN', 'HEADS', ...).
-- Every comparison therefore raised 22P02 (invalid input value for enum
-- userrole), the RPC threw, profiles.role never got written, and RLS's
-- current_user_role() saw NULL for every Google-login user — hiding all
-- staff data regardless of the role actually assigned in User Management.

create or replace function public.sync_my_profile()
returns profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_source users%rowtype;
  v_role app_role;
  v_employee_uuid uuid;
  v_profile profiles;
begin
  if v_email = '' then
    raise exception 'No authenticated session';
  end if;

  select * into v_source from users
  where lower(google_email) = v_email and is_active
  limit 1;

  if not found then
    raise exception 'No authorized account found for %. Contact HR.', v_email;
  end if;

  -- users.role is the Postgres `userrole` enum, whose labels are the Python
  -- UserRole *member names* (ADMIN, HEADS, ...), not its display values
  -- ('Admin', 'Heads', ...). app_role only covers the 8 roles RLS actually
  -- branches on, so anything else (Finance, Field Personnel, Backend Team)
  -- falls back to 'employee'.
  v_role := case v_source.role::text
    when 'ADMIN' then 'admin'
    when 'CEO' then 'ceo'
    when 'HEADS' then 'heads'
    when 'HR' then 'hr'
    when 'PROJECT_COORDINATOR' then 'project_coordinator'
    when 'PROJECT_ASSOCIATE' then 'project_associate'
    when 'PROJECT_OFFICER' then 'project_officer'
    else 'employee'
  end::app_role;

  select id into v_employee_uuid from employees where employee_id = v_source.employee_id;

  insert into profiles (id, employee_id, role, full_name, google_email)
  values (
    auth.uid(), v_employee_uuid, v_role,
    coalesce(v_source.full_name, v_source.google_email), v_source.google_email
  )
  on conflict (id) do update
    set employee_id = excluded.employee_id,
        role = excluded.role,
        full_name = excluded.full_name,
        google_email = excluded.google_email
  returning * into v_profile;

  return v_profile;
end;
$$;

grant execute on function public.sync_my_profile() to authenticated;
