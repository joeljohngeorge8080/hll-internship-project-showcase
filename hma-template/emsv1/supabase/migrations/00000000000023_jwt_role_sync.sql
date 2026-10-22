-- Sync profiles.role → JWT role claim so RLS policies can check current_user_role()
-- When a profile is created or updated, update auth.users.raw_app_meta_data
-- to include the role, which Supabase uses to regenerate JWT claims on next token refresh.
--
-- Without this trigger, JWT tokens stay as role='authenticated' (the default)
-- regardless of what's in profiles.role, and RLS checks like
-- current_user_role() in ('project_officer', ...) fail.

create or replace function public.sync_profile_role_to_jwt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object('role', new.role::text)
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists sync_profile_role_to_jwt_trigger on profiles;

create trigger sync_profile_role_to_jwt_trigger
after insert or update of role on profiles
for each row
execute function public.sync_profile_role_to_jwt();
