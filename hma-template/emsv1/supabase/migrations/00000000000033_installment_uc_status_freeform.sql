-- The installment edit form's UC Status field is now free text (officers
-- track statuses beyond the fixed pending/submitted/approved set, e.g. "Sent
-- to auditor"). project_installments.uc_status was the shared `uc_status`
-- enum ('pending'|'submitted'|'approved') — widen just this column to text
-- so it accepts anything, without touching project_milestones.uc_status,
-- which stays on the enum (no UI change there).

alter table project_installments alter column uc_status drop default;
alter table project_installments alter column uc_status type text using uc_status::text;
alter table project_installments alter column uc_status set default 'Pending';
