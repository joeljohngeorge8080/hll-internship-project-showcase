-- Extensions
create extension if not exists pgcrypto;

-- Roles: matches src/constants/roles.js (8 roles, verified against current code,
-- not the 5- or 11-role counts in older docs/memory).
create type app_role as enum (
  'admin',
  'ceo',
  'heads',
  'hr',
  'project_coordinator',
  'project_associate',
  'project_officer',
  'employee'
);

-- Shared status/enum types used across multiple modules.
create type record_status as enum ('active', 'inactive', 'deleted');
create type uc_status as enum ('pending', 'submitted', 'approved');
create type pool_name as enum ('admin', 'hr', 'core', 'project');
create type pool_adjustment_source as enum ('manual', 'auto_cascade', 'actual_pull', 'actual_surplus_next_month');

-- updated_at trigger, applied per-table below (ADR-033: every table carries created_at/updated_at).
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
