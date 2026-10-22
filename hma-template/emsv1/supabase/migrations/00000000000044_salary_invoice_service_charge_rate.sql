-- Salary Details (formerly Salary Invoice) page changes:
-- (src/modules/ems/staff-payroll/SalaryInvoicePage.jsx)
-- 1. CIA and RSO allowance overrides are no longer part of this page's
--    workflow — drop the columns from salary_invoice_overrides.
-- 2. Service charge is person-specific, not a single global rate. Add a
--    per-employee, per-month override column; null means "not overridden —
--    fall back to the global Rate Config value", matching the `??` fallback
--    chain the other override columns already use.
alter table salary_invoice_overrides drop column if exists cia;
alter table salary_invoice_overrides drop column if exists rso;
alter table salary_invoice_overrides add column if not exists service_charge_rate numeric(6,3);
