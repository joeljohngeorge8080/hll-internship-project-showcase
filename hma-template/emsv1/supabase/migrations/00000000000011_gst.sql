create table gst_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text,
  project_id uuid references projects(id),
  uploaded_by uuid references employees(id),
  uploaded_at timestamptz not null default now()
);

-- Known columns modeled explicitly; `raw_row` holds the remaining arbitrary Excel
-- columns until the real column list is confirmed against a sample import file.
create table gst_entries (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references gst_batches(id) on delete cascade,
  project_id uuid references projects(id),
  department text,
  vertical text,
  accounted text not null default 'Not Accounted',
  eligibility text not null, -- 'Eligible' | 'Not Eligible' (auto-set: Admin/CSR dept or CSR vertical -> Not Eligible)
  raw_row jsonb not null default '{}'
);
