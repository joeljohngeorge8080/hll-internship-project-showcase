-- Add amount_receivable to internships and recruitments to track pending receivables
alter table internships add column amount_receivable numeric(14,2) default 0;
alter table recruitments add column amount_receivable numeric(14,2) default 0;
