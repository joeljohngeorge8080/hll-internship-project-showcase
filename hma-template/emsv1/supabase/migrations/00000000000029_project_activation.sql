-- Migration 00000000000025: Add operations_activated_month to projects table.
-- This column stores the YYYY-MM month from which HR and Core pool budgets
-- unlock for a project. It is set by the "Activate Project" action in PMS
-- (Project Associate / HR / CEO). Null = not yet activated (HR/Core frozen).

alter table projects
  add column if not exists operations_activated_month date,
  add column if not exists operations_activated_at timestamptz;

comment on column projects.operations_activated_month is
  'Month (stored as first-of-month date) from which HR/Core pool budgets are active. Null = frozen.';
comment on column projects.operations_activated_at is
  'Timestamp when the project was activated (legacy fallback; prefer operations_activated_month).';
