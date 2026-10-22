-- Donor/funding-agency records (localDonors.js). ADR-037 originally proposed
-- merging this into projects.funding_agency, but that merge was never
-- executed and DonorPage.jsx still depends on a standalone list independent
-- of any project — a donor record's project link is optional (project_id is
-- nullable; project_name can be typed manually when no project is linked).
-- Kept as its own table for this migration pass; folding into projects is a
-- separate, deliberate data-model decision, not something to improvise here.

create table donors (
  id uuid primary key default gen_random_uuid(),
  funding_agency text not null,
  location text,
  project_id uuid references projects(id),
  project_name text,
  num_beneficiaries integer default 0,
  project_value numeric(14,2) default 0,
  year integer not null,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_donors_updated_at before update on donors
  for each row execute function set_updated_at();
