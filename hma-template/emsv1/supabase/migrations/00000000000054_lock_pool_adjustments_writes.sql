-- Phase 1 of the Supabase Pro adoption plan: project_pool_adjustments never
-- had RLS enabled at all (unlike its sibling core tables in
-- 00000000000014_rls_core.sql) — any authenticated client could read or write
-- any row in this financial table. This closes that gap and, per the
-- server-authoritative design chosen for the apportionment-engine Edge
-- Function, additionally prevents a client from writing the two
-- system-derived sources directly.

alter table project_pool_adjustments enable row level security;

-- Read access mirrors projects_select's project-ownership shape
-- (00000000000014_rls_core.sql).
create policy project_pool_adjustments_select on project_pool_adjustments for select
  using (
    current_user_role() in ('admin', 'ceo', 'heads', 'project_coordinator', 'hr')
    or exists (
      select 1 from projects pr
      left join project_officer_assignments poa on poa.project_id = pr.id
      where pr.id = project_pool_adjustments.project_id
        and (pr.project_associate_id = current_employee_id() or poa.employee_id = current_employee_id())
    )
  );

-- auto_cascade and actual_pull rows are derived by the documented
-- cascade/actual-vs-planned algorithm and are now ONLY ever written by the
-- apportionment-engine Edge Function using the service_role key (which
-- bypasses RLS entirely) — a client can no longer author these two sources
-- directly, closing the gap where a buggy or modified client could write
-- un-vetted cascade numbers straight into this table.
--
-- Manual adjustments (localProjects.setManualPoolAdjustment, source
-- 'manual') and PO-driven surplus transfers
-- (sendSurplusToNextMonth/revokeActualSurplusTransfer, source
-- 'actual_surplus_next_month') are unaffected — those two sources remain
-- directly client-writable under the same project-ownership check, since
-- they represent a human's explicit action, not a server-derived figure.
create policy project_pool_adjustments_write on project_pool_adjustments for insert
  with check (
    source not in ('auto_cascade', 'actual_pull')
    and (
      current_user_role() in ('admin', 'project_coordinator')
      or exists (
        select 1 from projects pr
        left join project_officer_assignments poa on poa.project_id = pr.id
        where pr.id = project_pool_adjustments.project_id
          and (pr.project_associate_id = current_employee_id() or poa.employee_id = current_employee_id())
      )
    )
  );

create policy project_pool_adjustments_delete on project_pool_adjustments for delete
  using (
    source not in ('auto_cascade', 'actual_pull')
    and (
      current_user_role() in ('admin', 'project_coordinator')
      or exists (
        select 1 from projects pr
        left join project_officer_assignments poa on poa.project_id = pr.id
        where pr.id = project_pool_adjustments.project_id
          and (pr.project_associate_id = current_employee_id() or poa.employee_id = current_employee_id())
      )
    )
  );
