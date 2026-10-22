-- Migration 00000000000081: Backfill operations_activated_month from start_date.
-- One-off data fix: existing activated projects were activated from whatever
-- month the "Activate Project" button was clicked in, rather than the
-- project's actual start date. This realigns operations_activated_month to
-- the first-of-month of each project's start_date so HR/Core pool budgets
-- (see localOrgPool.js) unlock from the correct month.
--
-- Only touches projects that are already activated
-- (operations_activated_month IS NOT NULL) and have a start_date set.
-- Does not modify status, operations_activated_at, or any other column.

update projects
set operations_activated_month = date_trunc('month', start_date)::date
where operations_activated_month is not null
  and start_date is not null;
