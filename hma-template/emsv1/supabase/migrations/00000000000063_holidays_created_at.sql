-- Add created_at column to holidays table
-- The localHolidays service expects this column for tracking when custom holidays were added

alter table holidays
  add column if not exists created_at timestamptz not null default now();
