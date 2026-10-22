// System-wide admin settings, backed by the `admin_settings` Supabase table
// (see supabase/migrations/00000000000013_org_support.sql, extended with
// maintenance_message/app_display_name/auto_archive_after_days in
// 00000000000065_admin_settings_fields.sql). Single row, id is always `true`
// (enforced by the table's own check constraint) — get()/update() always
// target that one row.
import supabase from './supabase'

const ROW_ID = true

const DEFAULTS = {
  maintenance_mode: false,
  maintenance_message:
    'The system is currently under scheduled maintenance. We will be back shortly. Please contact your administrator for urgent matters.',
  app_display_name: 'HMA IEMS',
  session_timeout_minutes: 60,
  max_login_attempts: 5,
  lockout_duration_minutes: 15,
  password_min_length: 8,
  password_require_special: true,
  force_2fa_admin: false,
  force_2fa_ceo: false,
  email_notifications_enabled: true,
  system_alert_email: 'admin@example.com',
  digest_frequency: 'daily',
  announcement_auto_expire_days: 30,
  audit_log_retention_days: 90,
  auto_archive_after_days: 365,
}

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

const fromDbRow = (row) => {
  if (!row) return { ...DEFAULTS }
  const policy = row.password_policy || {}
  const prefs = row.notification_prefs || {}
  return {
    maintenance_mode: row.maintenance_mode,
    maintenance_message: row.maintenance_message ?? DEFAULTS.maintenance_message,
    app_display_name: row.app_display_name ?? DEFAULTS.app_display_name,
    session_timeout_minutes: row.session_timeout_minutes,
    max_login_attempts: policy.max_login_attempts ?? DEFAULTS.max_login_attempts,
    lockout_duration_minutes: policy.lockout_duration_minutes ?? DEFAULTS.lockout_duration_minutes,
    password_min_length: policy.password_min_length ?? DEFAULTS.password_min_length,
    password_require_special: policy.password_require_special ?? DEFAULTS.password_require_special,
    force_2fa_admin: policy.force_2fa_admin ?? DEFAULTS.force_2fa_admin,
    force_2fa_ceo: policy.force_2fa_ceo ?? DEFAULTS.force_2fa_ceo,
    email_notifications_enabled:
      prefs.email_notifications_enabled ?? DEFAULTS.email_notifications_enabled,
    system_alert_email: prefs.system_alert_email ?? DEFAULTS.system_alert_email,
    digest_frequency: prefs.digest_frequency ?? DEFAULTS.digest_frequency,
    announcement_auto_expire_days:
      prefs.announcement_auto_expire_days ?? DEFAULTS.announcement_auto_expire_days,
    audit_log_retention_days: row.retention_days ?? DEFAULTS.audit_log_retention_days,
    auto_archive_after_days: row.auto_archive_after_days ?? DEFAULTS.auto_archive_after_days,
  }
}

const toDbRow = (settings) => ({
  id: ROW_ID,
  maintenance_mode: settings.maintenance_mode,
  maintenance_message: settings.maintenance_message,
  app_display_name: settings.app_display_name,
  session_timeout_minutes: settings.session_timeout_minutes,
  password_policy: {
    max_login_attempts: settings.max_login_attempts,
    lockout_duration_minutes: settings.lockout_duration_minutes,
    password_min_length: settings.password_min_length,
    password_require_special: settings.password_require_special,
    force_2fa_admin: settings.force_2fa_admin,
    force_2fa_ceo: settings.force_2fa_ceo,
  },
  notification_prefs: {
    email_notifications_enabled: settings.email_notifications_enabled,
    system_alert_email: settings.system_alert_email,
    digest_frequency: settings.digest_frequency,
    announcement_auto_expire_days: settings.announcement_auto_expire_days,
  },
  retention_days: settings.audit_log_retention_days,
  auto_archive_after_days: settings.auto_archive_after_days,
})

export const localAdminSettings = {
  async get() {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('*')
      .eq('id', ROW_ID)
      .maybeSingle()
    throwIfError(error, 'Failed to load admin settings')
    return fromDbRow(data)
  },

  async update(patch) {
    const current = await this.get()
    const updated = { ...current, ...patch }
    const { error } = await supabase.from('admin_settings').upsert(toDbRow(updated))
    throwIfError(error, 'Failed to update admin settings')
    return updated
  },

  async reset() {
    const { error } = await supabase.from('admin_settings').upsert(toDbRow(DEFAULTS))
    throwIfError(error, 'Failed to reset admin settings')
    return { ...DEFAULTS }
  },
}
