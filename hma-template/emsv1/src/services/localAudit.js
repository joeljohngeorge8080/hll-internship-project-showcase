/**
 * localAudit.js — Append-only audit log writer. Kept as a thin, same-name
 * shim over supabaseAudit.write() so none of its 9+ call sites need to
 * change: every one of them already calls `localAudit.write({...})` without
 * awaiting it (fire-and-forget), and supabaseAudit.write() preserves that
 * same never-throws contract.
 *
 * Previously this module WAS the store (browser localStorage, one entry
 * array per browser — see git history before the audit_logs Supabase
 * migration). Reads now live exclusively in supabaseAudit.js /
 * EmsAuditLogsPage.jsx, since audit_logs is the single source of truth and
 * there is no longer a separate local half to merge.
 *
 * setUserGetter() is kept as a no-op purely so App.jsx's existing call
 * doesn't need editing — actor identity (who performed the action) is now
 * looked up server-side from auth.uid() inside the log_manual_audit_entry()
 * RPC, never trusted from client-side Redux state, so this getter is no
 * longer read by anything.
 */
import { supabaseAudit } from './supabaseAudit'

export const localAudit = {
  /** No-op — kept for backward compatibility with App.jsx's existing call. */
  setUserGetter() {},

  /**
   * Append one audit log entry. Fire-and-forget: never throws, never
   * blocks the caller's real operation on the log write succeeding.
   * @param {object} opts
   * @param {string} opts.module       — 'Staff & Payroll' | 'Auth' | etc.
   * @param {string} opts.action       — 'EMPLOYEE_CREATED' | 'USER_LOGIN' | etc.
   * @param {string} [opts.record_id]  — id of the affected record
   * @param {string} [opts.record_label] — human-readable name of the record
   * @param {object} [opts.old_value]  — snapshot before the change (key fields only)
   * @param {object} [opts.new_value]  — snapshot after the change (key fields only)
   * @param {string} [opts.details]    — one-line summary shown in the table
   */
  write(opts) {
    return supabaseAudit.write(opts)
  },
}
