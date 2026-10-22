create table employees (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null unique, -- human-readable business code (e.g. "PA001"), distinct from PK
  first_name text not null,
  middle_name text,
  last_name text not null,
  gender text,
  date_of_birth date,
  marital_status text,
  blood_group text,
  employee_category text,
  status record_status not null default 'active',
  joined_date date,
  exit_date date,
  deleted_at timestamptz,
  deleted_remarks text,
  current_salary numeric(14,2),
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_employees_updated_at before update on employees
  for each row execute function set_updated_at();

create table employee_contacts (
  employee_id uuid primary key references employees(id) on delete cascade,
  personal_email text,
  working_email text,
  mobile text,
  phone text,
  emergency_contact_name text,
  emergency_contact_phone text
);

create table employee_addresses (
  employee_id uuid primary key references employees(id) on delete cascade,
  resident_location text,
  present_address text,
  permanent_address text,
  state text
);

create table employee_employment (
  employee_id uuid primary key references employees(id) on delete cascade,
  designation text not null, -- role scoping (PA specialization, PO detection) derives from this string today
  department text,
  reporting_to uuid references employees(id),
  working_region text,
  working_state text,
  start_date date,
  end_date date
);

create table employee_identification (
  employee_id uuid primary key references employees(id) on delete cascade,
  pan text,
  aadhar text,
  passport text,
  uan text,
  esi_number text,
  pf_number text
);

create table employee_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  bank_name text,
  account_number text,
  ifsc text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table employee_family_members (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  name text not null,
  relation text,
  date_of_birth date,
  created_at timestamptz not null default now()
);

create table employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  doc_type text,
  storage_path text not null, -- S3 reference per ADR-031
  uploaded_at timestamptz not null default now()
);

create table salary_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  previous_salary numeric(14,2),
  increment_pct numeric(6,2),
  increment_amount numeric(14,2),
  new_salary numeric(14,2) not null,
  effective_date date not null,
  designation_changed_to text,
  ctc_breakdown jsonb, -- point-in-time snapshot, not queried structurally
  remarks text,
  created_by uuid references employees(id),
  created_at timestamptz not null default now()
);

create table employee_status_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  status record_status not null,
  remarks text,
  changed_by uuid references employees(id),
  changed_at timestamptz not null default now()
);

create table employee_department_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  department text not null,
  changed_by uuid references employees(id),
  changed_at timestamptz not null default now()
);

-- profiles: bridges auth.users (Supabase Auth) to the app's role + employee record.
-- Replaces localUsers.js entirely; plaintext PASSWORD_LOGINS (G7) do not carry over.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_id uuid references employees(id),
  role app_role not null default 'employee',
  full_name text not null,
  google_email text,
  added_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
