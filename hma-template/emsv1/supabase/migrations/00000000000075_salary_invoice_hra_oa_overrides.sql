-- Salary Invoice page: HRA/OA stop being formula-derived (Basic × 30%/10%)
-- and become manual per-employee, per-month entries, same treatment as
-- Ideal Basic/DA/TND/TNDW/PT/Recovery already get on this table. Null means
-- "not entered yet" — SalaryInvoicePage.jsx treats that as 0, not as "fall
-- back to the formula" (the formula is gone for these four).
alter table salary_invoice_overrides add column if not exists ideal_hra numeric(14,2);
alter table salary_invoice_overrides add column if not exists ideal_oa numeric(14,2);
alter table salary_invoice_overrides add column if not exists actual_hra numeric(14,2);
alter table salary_invoice_overrides add column if not exists actual_oa numeric(14,2);
