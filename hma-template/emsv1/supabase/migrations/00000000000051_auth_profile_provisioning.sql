-- Bridges the FastAPI-managed `users` allow-list (google_email -> role, granted
-- by HR via POST /users) to Supabase's own `profiles`/auth.uid() identity.
--
-- Login flow: frontend verifies the Google credential via the backend
-- (/auth/google, checks `users`), then also calls
-- supabase.auth.signInWithIdToken() so RLS-gated queries have a real session.
-- Right after that succeeds, the frontend calls this RPC so `profiles` (and
-- therefore the JWT role claim, via sync_profile_role_to_jwt_trigger) reflects
-- whatever HR most recently set in `users` — not just whatever was true the
-- first time this person ever signed in.
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

  -- users.role is free text (matches the UserRole labels in the backend);
  -- app_role only covers the 8 roles RLS actually branches on, so anything
  -- else (Finance, Field Personnel, Backend Team) falls back to 'employee'.
  v_role := case v_source.role
    when 'Admin' then 'admin'
    when 'CEO' then 'ceo'
    when 'Heads' then 'heads'
    when 'HR' then 'hr'
    when 'Project Coordinator' then 'project_coordinator'
    when 'Project Associate' then 'project_associate'
    when 'Project Officer' then 'project_officer'
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
