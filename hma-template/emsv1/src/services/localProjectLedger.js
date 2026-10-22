/**
 * localProjectLedger.js — Supabase persistence for uploaded Excel project
 * ledgers (plan: docs/plans/actual-phase-ledger-upload.md §7). One row per
 * project id in project_ledgers, with the parsed row array in its `rows`
 * jsonb column — mirrors localBudgetPlan.js's plan_data blob rather than
 * batch-inserting into the row-per-entry project_ledger_rows table.
 * Re-upload replaces the whole entry for that project (no merge/append).
 *
 * Previously this module persisted to a browser-local localStorage key,
 * which meant a PO's uploaded ledger was invisible to every other
 * collaborator. get/save/remove are now async (real DB round trips);
 * rowsForMonthOf/monthsWithDataOf are pure derivations over an
 * already-loaded ledger object so callers that render several months don't
 * each need their own fetch.
 */
import supabase from './supabase'
import {
  normalizeActivityText,
  activityLabelOf,
} from '../modules/pms/project-associate/budget-plan/activityOptions'

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

const fromRow = (row) => {
  if (!row) return null
  return {
    version: 1,
    uploaded_at: row.uploaded_at,
    uploaded_by: row.uploaded_by_name || 'Unknown',
    source_file: row.source_file,
    source_sheet: row.source_sheet,
    rows: row.rows || [],
    activity_overrides: row.activity_overrides || {},
  }
}

/** A row's effective activity mapping: its own resolved `activity` if the
 * parser matched one, otherwise a lookup in this ledger's remembered
 * `activity_overrides` (keyed by normalizeActivityText(activityRaw)). Null
 * when still unmapped — such rows are excluded from aggregation. */
const effectiveActivity = (row, overrides) => {
  if (row.activity) return { value: row.activity, other: '' }
  const ov = overrides[normalizeActivityText(row.activityRaw)]
  return ov || null
}

export const localProjectLedger = {
  async get(projectId) {
    const { data, error } = await supabase
      .from('project_ledgers')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle()
    throwIfError(error, 'Failed to load project ledger')
    return fromRow(data)
  },

  /** Replaces the whole stored ledger for this project (re-upload = replace,
   * not merge — a re-upload is then a single-row upsert that can't half-apply). */
  async save(projectId, { sourceFile, sourceSheet, rows, uploadedBy, activityOverrides = {} }) {
    const patch = {
      source_file: sourceFile,
      source_sheet: sourceSheet,
      rows,
      uploaded_by_name: uploadedBy || 'Unknown',
      activity_overrides: activityOverrides,
      uploaded_at: new Date().toISOString(),
    }
    const { error } = await supabase
      .from('project_ledgers')
      .upsert({ project_id: projectId, ...patch }, { onConflict: 'project_id' })
    throwIfError(error, 'Failed to save project ledger')
    return fromRow(patch)
  },

  async remove(projectId) {
    const { error } = await supabase.from('project_ledgers').delete().eq('project_id', projectId)
    throwIfError(error, 'Failed to remove project ledger')
  },

  /**
   * Row-level detail for one month — Date, Particulars, Amount, Budget Head,
   * Activity, Phase — sorted by date. Excludes committed rows by default
   * (plan P9 — not yet real spend); callers that show them anyway should
   * still exclude them from any total, e.g. via `row.committed`.
   */
  rowsForMonthOf(ledger, month, { includeCommitted = false } = {}) {
    if (!ledger) return []
    const overrides = ledger.activity_overrides || {}
    return ledger.rows
      .filter((row) => row.month === month && (includeCommitted || !row.committed))
      .map((row) => ({ row, eff: effectiveActivity(row, overrides) }))
      .filter(({ eff }) => eff)
      .map(({ row, eff }) => ({ ...row, activityLabel: activityLabelOf(eff.value, eff.other) }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  },

  /** Every month with at least one resolvable-activity row, sorted ascending
   * — drives which month sections the ledger view renders. */
  monthsWithDataOf(ledger) {
    if (!ledger) return []
    const overrides = ledger.activity_overrides || {}
    const months = new Set()
    ledger.rows.forEach((row) => {
      if (effectiveActivity(row, overrides)) months.add(row.month)
    })
    return [...months].sort()
  },
}
