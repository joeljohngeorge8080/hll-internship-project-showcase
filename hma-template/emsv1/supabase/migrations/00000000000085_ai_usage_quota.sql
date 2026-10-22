-- Persistent per-user AI assistant usage quota, replacing the in-memory
-- per-instance cooldown in bedrock-chat/index.ts. In-memory state resets on
-- edge function cold start and doesn't share across scaled instances, so it
-- was a soft guard only — this survives both and backs a real daily/monthly
-- cap on Bedrock spend.

create table ai_usage_quota (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  call_count integer not null default 0,
  primary key (user_id, usage_date)
);

create index ai_usage_quota_user_id_idx on ai_usage_quota(user_id);

alter table ai_usage_quota enable row level security;

-- Users can see their own usage; all writes happen via the bedrock-chat edge
-- function's service-role client, which bypasses RLS, so no write policy is
-- needed for the authenticated role.
create policy ai_usage_quota_select_self on ai_usage_quota for select
  using (user_id = auth.uid());
