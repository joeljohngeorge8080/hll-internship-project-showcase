-- Forecast Expense tab display preferences (localForecastVisibility.js).
-- Global HR-configured state, not per-browser — hides a line item from the
-- forecast, opts an Admin Expenses vendor entry into the forecast view, and
-- persists the 'From'/'To' month range HR picked. Single row, same
-- singleton pattern as admin_settings (id always true).

create table forecast_visibility (
  id boolean primary key default true check (id),
  hidden text[] not null default '{}',
  included text[] not null default '{}',
  range_start text,
  range_end text,
  updated_at timestamptz not null default now()
);
create trigger trg_forecast_visibility_updated_at before update on forecast_visibility
  for each row execute function set_updated_at();
