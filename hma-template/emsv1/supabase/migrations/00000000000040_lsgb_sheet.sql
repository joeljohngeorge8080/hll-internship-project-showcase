-- Replaces the old structured lsgb_bodies / lsgb_work_orders / lsgb_fund_withdrawals
-- module (Overview / Fund Tracking / Analysis pages) with a single raw, editable
-- spreadsheet: the LSGB source sheet's column layout changes often, so instead of
-- mapping uploads onto fixed columns, the app now stores whatever grid was
-- uploaded (headers + rows, as JSON) and lets every cell be edited in place.
-- Singleton table — exactly one sheet, referenced by a fixed id.

create table lsgb_sheet (
  id uuid primary key default '00000000-0000-0000-0000-000000000001',
  sheet_name text not null default 'LSGB Projects',
  headers jsonb not null default '[]'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  uploaded_at timestamptz,
  uploaded_by text,
  updated_at timestamptz not null default now()
);
create trigger trg_lsgb_sheet_updated_at before update on lsgb_sheet
  for each row execute function set_updated_at();

-- Same cross-role access as the rest of PMS_PROJECTS (MODULE.PMS_PROJECTS):
-- CEO/Heads/Project Coordinator/Project Associate/Project Officer can edit,
-- HR view-only.
alter table lsgb_sheet enable row level security;

create policy lsgb_sheet_select on lsgb_sheet for select
  using (current_user_role() in (
    'admin', 'ceo', 'heads', 'project_coordinator', 'project_associate', 'project_officer', 'hr'
  ));
create policy lsgb_sheet_write on lsgb_sheet for all
  using (current_user_role() in (
    'admin', 'ceo', 'heads', 'project_coordinator', 'project_associate', 'project_officer'
  ))
  with check (current_user_role() in (
    'admin', 'ceo', 'heads', 'project_coordinator', 'project_associate', 'project_officer'
  ));
