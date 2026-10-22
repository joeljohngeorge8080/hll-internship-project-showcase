-- Book Expense UI redesign (Expense Pools > HR/Admin/Core): adds payment
-- mode, approval status, and a single receipt attachment per pool_expenses
-- row, so HR can record how an expense was paid, whether it's been
-- approved, and keep proof of purchase alongside the booking.
alter table pool_expenses
  add column if not exists payment_mode text,
  add column if not exists approval_status text not null default 'Pending'
    check (approval_status in ('Pending', 'Approved', 'Rejected')),
  add column if not exists receipt_storage_path text,
  add column if not exists receipt_file_name text,
  add column if not exists receipt_content_type text;

insert into storage.buckets (id, name, public, file_size_limit)
values ('pool-expense-receipts', 'pool-expense-receipts', false, 10485760) -- 10MB/file, matches employee-documents cap
on conflict (id) do nothing;

-- Receipts are stored at "<pool_expense_id>/<timestamp>-<filename>" — same
-- ownership boundary as pool_expenses_select/write (00000000000024), applied
-- to storage.objects directly since a receipt is only ever readable/writable
-- by whoever can see/edit its parent expense row.
create policy pool_expense_receipts_select on storage.objects for select
  using (
    bucket_id = 'pool-expense-receipts'
    and current_user_role() in ('admin', 'ceo', 'heads', 'hr')
  );

create policy pool_expense_receipts_write on storage.objects for all
  using (bucket_id = 'pool-expense-receipts' and current_user_role() in ('admin', 'hr'))
  with check (bucket_id = 'pool-expense-receipts' and current_user_role() in ('admin', 'hr'));
