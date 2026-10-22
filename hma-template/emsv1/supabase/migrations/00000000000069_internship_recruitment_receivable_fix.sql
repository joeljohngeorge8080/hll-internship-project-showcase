-- Re-apply amount_receivable columns on internships/recruitments.
-- Migration 26 was marked applied in the remote migration history without
-- the column actually existing on the live database (schema drift). This
-- reissues the change idempotently so it takes effect this time.
alter table internships add column if not exists amount_receivable numeric(14,2) default 0;
alter table recruitments add column if not exists amount_receivable numeric(14,2) default 0;
