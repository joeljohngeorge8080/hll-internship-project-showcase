-- localBudgetPlan.js was localStorage-only (per-browser), so a collaborator's
-- plan/tasks/actuals/transfers were invisible to everyone else. This column
-- holds the nested mutable part of the plan object (months incl. tasks and
-- subtasks, plus the transfers ledger) so the whole plan now lives in
-- budget_plans, matching the columns that already exist for the flat fields
-- (status, project_value, start/end date, pool pcts, saved_snapshot).
alter table budget_plans add column plan_data jsonb not null default '{"months":[],"transfers":[]}'::jsonb;
