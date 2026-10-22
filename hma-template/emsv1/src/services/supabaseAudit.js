// supabaseAudit.js — the audit log's single data source (see
// supabase/migrations/00000000000017_audit_log.sql and
// 00000000000077_audit_logs_manual_writes.sql). Two kinds of row share the
// table: entry_kind='trigger' rows are written exclusively by AFTER INSERT/
// UPDATE/DELETE triggers on `projects`/`employees`/`salary_details`/
// `core_salaries`; entry_kind='manual' rows are written by every other
// module (General Expenses, Expense Pools, Payroll, Payment Credentials,
// Attendance, Auth) via the log_manual_audit_entry() RPC — this module
// itself never issues a raw INSERT, so a client can never forge a row. Both
// kinds normalise to the same entry shape for EmsAuditLogsPage.
import supabase from './supabase'

const TABLE_MODULE = {
  projects: 'Projects',
  employees: 'Staff & Payroll',
  salary_details: 'Staff & Payroll',
  core_salaries: 'Staff & Payroll',
}

const TABLE_ACTION_PREFIX = {
  projects: 'PROJECT',
  employees: 'EMPLOYEE',
  salary_details: 'SALARY_DETAIL',
  core_salaries: 'CORE_SALARY',
}

const ROLE_LABELS = {
  admin: 'Admin',
  ceo: 'CEO',
  heads: 'Finance',
  hr: 'HR',
  project_coordinator: 'Project Coordinator',
  project_associate: 'Project Associate',
  project_officer: 'Project Officer',
  employee: 'Employee',
}

const formatRole = (role) => ROLE_LABELS[role] || role || 'Unknown'

const employeeName = (data) =>
  data ? [data.first_name, data.middle_name, data.last_name].filter(Boolean).join(' ') : null

/** Human-readable name of the affected record, from whichever snapshot is available. */
const recordLabel = (row) => {
  const data = row.new_data || row.old_data
  if (!data) return row.record_id || ''
  switch (row.table_name) {
    case 'projects':
      return data.title || row.record_id
    case 'employees':
      return employeeName(data) || row.record_id
    case 'salary_details':
    case 'core_salaries':
      return data.month && data.year ? `Salary ${data.month}/${data.year}` : row.record_id
    default:
      return row.record_id
  }
}

/** Employees soft-delete via status update rather than a real DELETE — detect that case. */
const isSoftDelete = (row) =>
  row.table_name === 'employees' &&
  row.action === 'UPDATE' &&
  row.new_data?.status === 'deleted' &&
  row.old_data?.status !== 'deleted'

const actionLabel = (row) => {
  const prefix = TABLE_ACTION_PREFIX[row.table_name] || row.table_name.toUpperCase()
  if (row.action === 'DELETE' || isSoftDelete(row)) return `${prefix}_DELETED`
  if (row.action === 'INSERT') return `${prefix}_CREATED`
  return `${prefix}_UPDATED`
}

// Columns that change on every write regardless of business intent — noise in a diff.
const DIFF_IGNORE_KEYS = new Set(['updated_at', 'created_at'])

/** One-line "field: old → new" summary of what changed, for the Details column. */
const buildDetails = (row) => {
  if (row.action === 'INSERT') return 'Created'
  if (row.action === 'DELETE') return 'Deleted'
  if (isSoftDelete(row))
    return `Marked deleted${row.new_data?.deleted_remarks ? `: ${row.new_data.deleted_remarks}` : ''}`

  const oldData = row.old_data || {}
  const newData = row.new_data || {}
  const changes = Object.keys(newData)
    .filter((key) => !DIFF_IGNORE_KEYS.has(key))
    .filter((key) => JSON.stringify(oldData[key]) !== JSON.stringify(newData[key]))
    .map((key) => `${key}: ${JSON.stringify(oldData[key])} → ${JSON.stringify(newData[key])}`)

  if (!changes.length) return 'No field changes'
  return changes.length > 3
    ? `${changes.slice(0, 3).join(', ')}, +${changes.length - 3} more`
    : changes.join(', ')
}

/** entry_kind='manual' rows already carry pre-formatted, human-readable
 * fields from the caller — table_name doubles as the module label, and
 * action_label/record_label/details are used as-is instead of being
 * derived from old_data/new_data the way trigger rows are. */
const toEntryShape = (row) =>
  row.entry_kind === 'manual'
    ? {
        id: row.id,
        source: 'db',
        timestamp: row.created_at,
        user_id: row.actor_employee_id || '',
        user_name: row.actor_name || 'Unknown',
        role: formatRole(row.actor_role),
        module: row.table_name,
        action: row.action_label || 'MANUAL',
        record_id: row.record_id || '',
        record_label: row.record_label || row.record_id || '',
        old_value: row.old_data,
        new_value: row.new_data,
        details: row.details || '',
      }
    : {
        id: row.id,
        source: 'db',
        timestamp: row.created_at,
        user_id: row.actor_employee_id || '',
        user_name: row.actor_name || 'Unknown',
        role: formatRole(row.actor_role),
        module: TABLE_MODULE[row.table_name] || row.table_name,
        action: actionLabel(row),
        record_id: row.record_id || '',
        record_label: recordLabel(row),
        old_value: row.old_data,
        new_value: row.new_data,
        details: buildDetails(row),
      }

export const supabaseAudit = {
  /** Fetches up to `limit` most recent entries — filtering/pagination happens client-side. */
  async list({ limit = 500 } = {}) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error(`Failed to load audit log: ${error.message}`)
    return (data || []).map(toEntryShape)
  },

  /** Distinct module names present in the log — the 4 trigger-covered tables
   * plus whatever free-text modules manual entries have actually used. */
  async getModules() {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('table_name')
      .eq('entry_kind', 'manual')
    if (error) throw new Error(`Failed to load audit modules: ${error.message}`)
    const manualModules = [...new Set((data || []).map((r) => r.table_name).filter(Boolean))]
    return [...new Set([...Object.values(TABLE_MODULE), ...manualModules])].sort()
  },

  /** Distinct action labels present in the log, for the filter dropdown. */
  async getActions() {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('action, action_label, table_name, entry_kind')
      .eq('entry_kind', 'manual')
    if (error) throw new Error(`Failed to load audit actions: ${error.message}`)
    const manualActions = (data || []).map((r) => r.action_label).filter(Boolean)
    return [...new Set(manualActions)].sort()
  },

  /**
   * Append one manual (non-trigger) audit entry via the log_manual_audit_entry
   * RPC — never a raw table insert, so actor identity always comes from
   * auth.uid() server-side and can't be forged from the client. Mirrors
   * localAudit.write()'s old contract: swallows its own errors so a log
   * write failure never breaks the caller's real operation.
   */
  async write({
    module,
    action,
    record_id = '',
    record_label = '',
    old_value = null,
    new_value = null,
    details = '',
  }) {
    try {
      await supabase.rpc('log_manual_audit_entry', {
        p_module: module,
        p_action: action,
        p_record_id: record_id || null,
        p_record_label: record_label || null,
        p_old_value: old_value,
        p_new_value: new_value,
        p_details: details || null,
      })
    } catch {
      // Silent — log write failure must never break the main operation.
    }
  },

  /** Exact total row count, for the header stat — cheap head-only query, no rows returned. */
  async count() {
    const { count, error } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
    if (error) throw new Error(`Failed to count audit log: ${error.message}`)
    return count || 0
  },

  /**
   * Deletes one entry. Only succeeds for admins — enforced by the
   * `audit_logs_delete` RLS policy, not by this function. Non-admin callers
   * get a Postgres permission error back from Supabase.
   */
  async remove(id) {
    const { error } = await supabase.from('audit_logs').delete().eq('id', id)
    if (error) throw new Error(`Failed to delete audit entry: ${error.message}`)
  },
}
