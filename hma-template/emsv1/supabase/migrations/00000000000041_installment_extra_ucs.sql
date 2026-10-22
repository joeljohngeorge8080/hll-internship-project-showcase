-- GitHub issue #138: an installment can span a financial-year break (e.g.
-- Jan–Aug), so the funding agency may need more than one Utilization
-- Certificate (a temporary UC at the FY-end, plus the final one) even though
-- the MoU still counts it as a single installment. project_installments only
-- had room for one UC (uc_status/uc_target_date/actual_uc_submission_date),
-- so this adds a child table for any UCs beyond the first, added via the
-- "+" control in the edit form. The installment's own three UC columns stay
-- as the first/primary UC — unchanged, no backfill needed.

create table project_installment_extra_ucs (
  id uuid primary key default gen_random_uuid(),
  installment_id uuid not null references project_installments(id) on delete cascade,
  uc_status text not null default 'Pending',
  uc_target_date date,
  actual_uc_submission_date date,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_project_installment_extra_ucs_installment_id
  on project_installment_extra_ucs(installment_id);

-- No RLS: matches project_installments, which also has none (see migrations
-- 00000000000004, 00000000000033, 00000000000039 — access is gated by the
-- projects table one level up, not per-child-table policies).
