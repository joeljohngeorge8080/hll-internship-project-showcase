-- internships/recruitments (00000000000012_pms_peripheral.sql) were created
-- with no RLS enabled at all — 00000000000014_rls_core.sql's own comment
-- names them as "deliberately deferred to a follow-up migration" but that
-- follow-up never landed, leaving both tables unrestricted (any authenticated
-- request could read/write). Wiring the frontend (localInternships.js,
-- localRecruitments.js) to Supabase now, so closing that gap first.
--
-- Ownership matches permissions.js: MODULE.INTERNSHIP / MODULE.RECRUITMENT
-- grant HR edit access and CEO/Heads view-only, same shape as employees_write.
alter table internships enable row level security;
alter table recruitments enable row level security;

create policy internships_select on internships for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'hr'));
create policy internships_write on internships for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

create policy recruitments_select on recruitments for select
  using (current_user_role() in ('admin', 'ceo', 'heads', 'hr'));
create policy recruitments_write on recruitments for all
  using (current_user_role() in ('admin', 'hr'))
  with check (current_user_role() in ('admin', 'hr'));

-- The frontend has only ever captured "supervisor" as a free-text name
-- (InternshipPage.jsx: plain text input, "Reporting supervisor" placeholder),
-- never a resolved employee — the uuid FK here doesn't match real usage and
-- would reject every save with "invalid input syntax for type uuid". Drop
-- the inline FK from 00000000000012_pms_peripheral.sql first — Postgres
-- won't retype a column out from under a constraint that depends on it.
alter table internships drop constraint internships_supervisor_fkey;
alter table internships alter column supervisor type text using supervisor::text;
