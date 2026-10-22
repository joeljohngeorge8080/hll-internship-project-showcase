-- Migration 26: Add UC tracking and document checklist fields to project_installments
-- Required by issue #99 — Project Milestone tab redesign.
--
-- New columns:
--   payment_received_date  — actual date the installment payment was received
--   uc_target_date         — deadline by which the Utilization Certificate must be submitted
--   actual_uc_submission_date — actual date UC was submitted to the funder
--   documents_checklist    — JSONB array of { name: text, checked: boolean } objects
--                            representing documents that need to be submitted with the UC

alter table project_installments
  add column if not exists payment_received_date   date,
  add column if not exists uc_target_date          date,
  add column if not exists actual_uc_submission_date date,
  add column if not exists documents_checklist     jsonb not null default '[]'::jsonb;

comment on column project_installments.payment_received_date    is 'Actual date the installment payment was received from the funder';
comment on column project_installments.uc_target_date           is 'Deadline for submitting the Utilization Certificate for this installment';
comment on column project_installments.actual_uc_submission_date is 'Actual date the UC was submitted to the funder';
comment on column project_installments.documents_checklist      is 'JSONB array of {name: text, checked: boolean} — documents required for UC submission';
