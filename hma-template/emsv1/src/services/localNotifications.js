// Company notifications, backed by the `notifications` Supabase table (see
// supabase/migrations/00000000000013_org_support.sql). role_target is the
// app_role enum (lowercase) and is nullable — a null row means "visible to
// every role", the same meaning the old localStorage version gave roleTarget
// 'all'. Callers still pass roleTarget in whatever case they use ('HR',
// 'all', etc.) — normalized here so callers don't need to change.
import supabase from './supabase'

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

// 'all' (and unset) means visible to every role → stored as null.
const toDbRoleTarget = (roleTarget) => {
  if (!roleTarget || roleTarget === 'all') return null
  return String(roleTarget).toLowerCase()
}

const fromDbNotification = (row) => ({
  id: row.id,
  message: row.message,
  roleTarget: row.role_target || 'all',
  relatedProjectId: row.related_project_id,
  type: row.notification_type,
  read: row.is_read,
  created_at: row.created_at,
})

export const localNotifications = {
  async addNotification({ message, roleTarget, relatedProjectId, type = 'warning' }) {
    const { error } = await supabase.from('notifications').insert({
      message,
      role_target: toDbRoleTarget(roleTarget),
      related_project_id: relatedProjectId || null,
      notification_type: type,
      is_read: false,
    })
    throwIfError(error, 'Failed to add notification')
  },

  async getNotifications(roleTarget) {
    let query = supabase.from('notifications').select('*').order('created_at', { ascending: false })
    const { data, error } = await query
    throwIfError(error, 'Failed to load notifications')
    const rows = (data || []).map(fromDbNotification)
    if (!roleTarget) return rows
    const target = String(roleTarget).toLowerCase()
    return rows.filter((n) => n.roleTarget.toLowerCase() === target || n.roleTarget === 'all')
  },

  async getUnreadCount(roleTarget) {
    const rows = await this.getNotifications(roleTarget)
    return rows.filter((n) => !n.read).length
  },

  async markAsRead(id) {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    throwIfError(error, 'Failed to mark notification as read')
  },

  async markAllAsRead(roleTarget) {
    let query = supabase.from('notifications').update({ is_read: true })
    if (roleTarget) {
      const target = toDbRoleTarget(roleTarget)
      query = target ? query.or(`role_target.eq.${target},role_target.is.null`) : query
    }
    const { error } = await query.eq('is_read', false)
    throwIfError(error, 'Failed to mark notifications as read')
  },
}
