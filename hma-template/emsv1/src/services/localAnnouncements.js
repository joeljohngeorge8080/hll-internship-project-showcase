// Announcements + CEO personal notes, backed by Supabase (`announcements`,
// `announcement_reads`, `ceo_notes` — see
// supabase/migrations/00000000000013_org_support.sql, sent_by_name/
// created_by_name fallback added in
// 00000000000066_announcements_notes_name_fallback.sql).
//
// target_roles is a Postgres app_role[] with no 'all' sentinel value — an
// empty array is the "all roles" case (matches the column's own '{}'
// default), same meaning the old localStorage version gave target_roles
// ['all']. read_by (a uuid[] in the old shape) is now the announcement_reads
// join table, one row per (announcement, reader).
import supabase from './supabase'
import { localAdminSettings } from './localAdminSettings'

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

// ── Message types ──────────────────────────────────────────────────────────────

export const MSG_TYPE = {
  ANNOUNCEMENT: 'announcement',
  ALERT: 'alert',
  WARNING: 'warning',
  REPORT: 'report',
  INFO: 'info',
  REMINDER: 'reminder',
}

export const MSG_TYPE_META = {
  [MSG_TYPE.ANNOUNCEMENT]: { label: 'Announcement', color: 'primary', icon: '📢' },
  [MSG_TYPE.ALERT]: { label: 'Alert', color: 'danger', icon: '🚨' },
  [MSG_TYPE.WARNING]: { label: 'Warning', color: 'warning', icon: '⚠️' },
  [MSG_TYPE.REPORT]: { label: 'Report', color: 'info', icon: '📊' },
  [MSG_TYPE.INFO]: { label: 'Information', color: 'secondary', icon: 'ℹ️' },
  [MSG_TYPE.REMINDER]: { label: 'Reminder', color: 'success', icon: '🔔' },
}

// ── Announcements ──────────────────────────────────────────────────────────────

const toDbTargetRoles = (roles) => {
  if (!roles?.length || roles.includes('all')) return []
  return roles.map((r) => String(r).toLowerCase())
}

const fromDbAnnouncement = (row, readBy = []) => ({
  id: row.id,
  type: row.announcement_type,
  title: row.title,
  body: row.body,
  target_roles: row.target_roles?.length ? row.target_roles : ['all'],
  sent_at: row.sent_at,
  sent_by: row.sent_by_name || 'CEO',
  read_by: readBy,
})

// Batches the announcement_reads lookup for a set of announcement ids —
// avoids N+1 queries when listing.
const loadReadByMap = async (announcementIds) => {
  if (!announcementIds.length) return {}
  const { data, error } = await supabase
    .from('announcement_reads')
    .select('announcement_id, user_id')
    .in('announcement_id', announcementIds)
  throwIfError(error, 'Failed to load read receipts')
  const map = {}
  for (const row of data || []) {
    if (!map[row.announcement_id]) map[row.announcement_id] = []
    map[row.announcement_id].push(row.user_id)
  }
  return map
}

/**
 * Whether an announcement is past the admin-configured auto-expire window.
 * A non-positive/missing setting means "never expire".
 */
const isExpired = (row, expireDays) => {
  if (!expireDays || expireDays <= 0) return false
  const ageMs = Date.now() - new Date(row.sent_at).getTime()
  return ageMs > expireDays * 24 * 60 * 60 * 1000
}

export const localAnnouncements = {
  // Sender-facing: the CEO's own "Sent Announcements" history is kept
  // regardless of age — auto-expire only archives an announcement out of
  // recipients' inboxes, it doesn't erase the sender's record of having sent it.
  async listAll({ type = '' } = {}) {
    let query = supabase.from('announcements').select('*').order('sent_at', { ascending: false })
    if (type) query = query.eq('announcement_type', type)
    const { data, error } = await query
    throwIfError(error, 'Failed to load announcements')
    const readByMap = await loadReadByMap((data || []).map((r) => r.id))
    return (data || []).map((r) => fromDbAnnouncement(r, readByMap[r.id] || []))
  },

  // Recipient-facing: expired announcements are archived out of the inbox.
  async listForRole(role) {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('sent_at', { ascending: false })
    throwIfError(error, 'Failed to load announcements')
    const expireDays = (await localAdminSettings.get()).announcement_auto_expire_days
    const targetRole = String(role).toLowerCase()
    const rows = (data || []).filter(
      (r) => !r.target_roles?.length || r.target_roles.includes(targetRole),
    )
    const readByMap = await loadReadByMap(rows.map((r) => r.id))
    return rows
      .map((r) => fromDbAnnouncement(r, readByMap[r.id] || []))
      .filter((r) => !isExpired(r, expireDays))
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    throwIfError(error, 'Failed to load announcement')
    if (!data) return null
    const readByMap = await loadReadByMap([id])
    return fromDbAnnouncement(data, readByMap[id] || [])
  },

  async send(data) {
    const { data: row, error } = await supabase
      .from('announcements')
      .insert({
        announcement_type: data.type || MSG_TYPE.ANNOUNCEMENT,
        title: data.title.trim(),
        body: data.body.trim(),
        target_roles: toDbTargetRoles(data.target_roles),
        sent_by_name: data.sent_by || 'CEO',
      })
      .select()
      .single()
    throwIfError(error, 'Failed to send announcement')
    return fromDbAnnouncement(row, [])
  },

  async markRead(id, userId) {
    if (!userId) return
    const { error } = await supabase
      .from('announcement_reads')
      .upsert({ announcement_id: id, user_id: userId }, { onConflict: 'announcement_id,user_id' })
    // A non-UUID userId (dev/local account) can't satisfy the FK — treat
    // read-tracking as best-effort, don't break the inbox over it.
    if (error) return
  },

  async markAllRead(role, userId) {
    if (!userId) return
    const targetRole = String(role).toLowerCase()
    const { data } = await supabase.from('announcements').select('id, target_roles')
    const rows = (data || []).filter(
      (r) => !r.target_roles?.length || r.target_roles.includes(targetRole),
    )
    if (!rows.length) return
    await supabase.from('announcement_reads').upsert(
      rows.map((r) => ({ announcement_id: r.id, user_id: userId })),
      { onConflict: 'announcement_id,user_id' },
    )
  },

  async delete(id) {
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    throwIfError(error, 'Failed to delete announcement')
  },

  async unreadCount(role, userId) {
    const rows = await this.listForRole(role)
    return rows.filter((r) => !r.read_by.includes(userId)).length
  },
}

// ── CEO personal notes ─────────────────────────────────────────────────────────

export const NOTE_COLORS = ['default', 'primary', 'success', 'warning', 'danger', 'info']

const fromDbNote = (row) => ({
  id: row.id,
  title: row.title,
  body: row.body || '',
  color: row.color || 'default',
  created_at: row.created_at,
  updated_at: row.updated_at,
})

export const localCeoNotes = {
  async list() {
    const { data, error } = await supabase
      .from('ceo_notes')
      .select('*')
      .order('updated_at', { ascending: false })
    throwIfError(error, 'Failed to load notes')
    return (data || []).map(fromDbNote)
  },

  async getById(id) {
    const { data, error } = await supabase.from('ceo_notes').select('*').eq('id', id).maybeSingle()
    throwIfError(error, 'Failed to load note')
    return data ? fromDbNote(data) : null
  },

  async create(data) {
    const { data: row, error } = await supabase
      .from('ceo_notes')
      .insert({
        title: data.title?.trim() || 'Untitled Note',
        body: data.body?.trim() || '',
        color: data.color || 'default',
        created_by_name: data.created_by || null,
      })
      .select()
      .single()
    throwIfError(error, 'Failed to create note')
    return fromDbNote(row)
  },

  async update(id, data) {
    const { data: row, error } = await supabase
      .from('ceo_notes')
      .update({
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
      })
      .eq('id', id)
      .select()
      .single()
    throwIfError(error, 'Failed to update note')
    if (!row) throw new Error('Note not found')
    return fromDbNote(row)
  },

  async delete(id) {
    const { error } = await supabase.from('ceo_notes').delete().eq('id', id)
    throwIfError(error, 'Failed to delete note')
  },
}
