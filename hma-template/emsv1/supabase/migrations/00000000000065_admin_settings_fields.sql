-- admin_settings was missing fields the localStorage version (localAdminSettings.js)
-- already exposed in the Settings UI: maintenance banner text, app display name,
-- and a second retention window (audit log vs. general archive are tracked
-- separately, not the same setting).

alter table admin_settings
  add column if not exists maintenance_message text,
  add column if not exists app_display_name text,
  add column if not exists auto_archive_after_days integer;

comment on column admin_settings.retention_days is 'Audit log retention (days). See auto_archive_after_days for general archive window.';
