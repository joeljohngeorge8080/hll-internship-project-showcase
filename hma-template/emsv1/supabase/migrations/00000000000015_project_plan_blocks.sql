-- Raw block definitions behind a project's generated monthly_plan (see
-- localProjects.js generateMonthlyPlan()) — kept separate from the derived
-- project_monthly_plan rows so the planning editor can reopen and revise the
-- original block ranges instead of only seeing the flattened per-month result.
-- One row per project; the whole block set is replaced on each regeneration
-- (matches the existing "overwrite plan_blocks wholesale" semantics).
create table project_plan_blocks (
  project_id uuid primary key references projects(id) on delete cascade,
  blocks jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
create trigger trg_project_plan_blocks_updated_at before update on project_plan_blocks
  for each row execute function set_updated_at();
