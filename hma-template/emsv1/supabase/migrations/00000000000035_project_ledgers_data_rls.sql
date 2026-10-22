-- localProjectLedger.js was localStorage-only (per-browser), same bug class
-- as budget_plans (see 00000000000034): a PO's uploaded ledger was invisible
-- to every other collaborator. project_ledgers/project_ledger_rows already
-- existed but were unused — rather than batch-inserting into the row-per-
-- entry project_ledger_rows table, this follows the same single-jsonb-blob
-- approach as budget_plans.plan_data: one `rows` column holding the whole
-- parsed row array, matching the in-memory shape the app already works with.
--
-- uploaded_by is a uuid FK to employees, but the app only has a display-name
-- string (currentUser) at the call site, not an employee id — so the name is
-- stored in a new text column instead of forcing a lookup the app can't do
-- reliably. The existing uuid column is left unused (nullable, never written).
alter table project_ledgers add column rows jsonb not null default '[]'::jsonb;
alter table project_ledgers add column uploaded_by_name text;

-- This table had zero RLS policies (dead/unused until now) — any authenticated
-- user could read or write any project's ledger once real data landed here.
-- Mirrors budget_plans_select/budget_plans_write's project-ownership shape.
alter table project_ledgers enable row level security;

create policy project_ledgers_select on project_ledgers for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'project_coordinator', 'hr')
    or exists (
      select 1 from projects pr
      left join project_officer_assignments poa on poa.project_id = pr.id
      where pr.id = project_ledgers.project_id
        and (pr.project_associate_id = current_employee_id() or poa.employee_id = current_employee_id())
    )
  );

create policy project_ledgers_write on project_ledgers for all
  using (
    current_user_role() in ('admin', 'project_coordinator')
    or exists (
      select 1 from projects pr
      left join project_officer_assignments poa on poa.project_id = pr.id
      where pr.id = project_ledgers.project_id
        and (pr.project_associate_id = current_employee_id() or poa.employee_id = current_employee_id())
    )
  );
