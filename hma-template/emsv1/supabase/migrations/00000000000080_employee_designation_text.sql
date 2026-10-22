-- The existing employee_employment.designation column drives role scoping
-- (PA specialization, PO detection) and stays constrained to the fixed
-- DESIGNATIONS list, now labelled "Roles" in the UI. This adds a separate,
-- unconstrained free-text field for the company's actual job title, since
-- HMA has more designations than the fixed role list covers.
alter table employee_employment
  add column designation_text text;
