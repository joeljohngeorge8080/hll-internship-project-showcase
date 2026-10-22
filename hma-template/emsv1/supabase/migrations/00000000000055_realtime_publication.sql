-- Phase 2 of the Supabase Pro adoption plan: enables Realtime broadcast for
-- the tables GlobalHRPoolPage/ExpensePoolCard and EmsAuditLogsPage now
-- subscribe to. A postgres_changes subscription against a table that isn't
-- in this publication silently never fires — this is what actually turns
-- Realtime "on" for these tables, the client-side .channel() calls alone do
-- nothing without it.
alter publication supabase_realtime add table pool_expenses;
alter publication supabase_realtime add table pool_expense_allocations;
alter publication supabase_realtime add table audit_logs;
