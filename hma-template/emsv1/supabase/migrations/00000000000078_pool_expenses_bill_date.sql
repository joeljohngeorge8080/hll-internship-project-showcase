-- Add bill_date to pool_expenses for tracking when an invoice/bill was issued
-- (distinct from expense_date which tracks when the expense is booked/effective)
alter table pool_expenses
  add column if not exists bill_date date;
