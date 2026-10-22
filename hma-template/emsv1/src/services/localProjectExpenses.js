/**
 * Supabase-backed store for per-project actual expense entries (migrated
 * from localStorage — see ADR-037 and 00000000000056_project_expenses.sql).
 * Distinct from localAdminExpenses.js (the org-wide vendor-contract ledger)
 * — these entries are tied to one specific project via project_id, and feed
 * the PMS "Actual Spend" section, the Expense Management "Project Expenses"
 * tab, and the Consolidated/Apportionment sheets' Used/Actual figures.
 * 'hr'/'core' are accepted by the shape as a provision for later, not yet
 * exposed in any UI.
 */
import supabase from './supabase'

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

const VALID_POOLS = ['admin', 'hr', 'core', 'project']

// Same YYYY-MM <-> first-of-month date convention as localOrgPool.js's
// toDbMonth/fromDbMonth.
const toDbMonth = (m) => (m && m.length === 7 ? `${m}-01` : m || null)
const fromDbMonth = (m) => (m ? String(m).slice(0, 7) : '')

const fromDbRow = (row) => ({
  id: row.id,
  project_id: row.project_id,
  pool: row.pool,
  month: fromDbMonth(row.month),
  amount: parseFloat(row.amount) || 0,
  label: row.label || '',
  date: row.expense_date,
  createdBy: row.logged_by || 'Unknown',
  createdAt: row.created_at,
})

export const localProjectExpenses = {
  async list({ projectId = '', pool = '', month = '' } = {}) {
    let query = supabase.from('project_expenses').select('*')
    if (projectId) query = query.eq('project_id', projectId)
    if (pool) query = query.eq('pool', pool)
    if (month) query = query.eq('month', toDbMonth(month))
    query = query.order('expense_date', { ascending: false })
    const { data, error } = await query
    throwIfError(error, 'Failed to load project expenses')
    return (data || []).map(fromDbRow)
  },

  async create({ project_id, pool, month, amount, label, createdBy, date }) {
    if (!project_id) throw new Error('A project is required.')
    if (!VALID_POOLS.includes(pool)) throw new Error('Pool must be admin, hr, core, or project.')
    if (!month) throw new Error('A month is required.')
    const amt = Math.round((parseFloat(amount) || 0) * 100) / 100
    if (amt <= 0) throw new Error('Amount must be greater than zero.')
    if (!label || !label.trim()) throw new Error('A label is required.')

    const { data: inserted, error } = await supabase
      .from('project_expenses')
      .insert({
        project_id,
        pool,
        month: toDbMonth(month),
        amount: amt,
        label: label.trim(),
        expense_date: date || new Date().toISOString().slice(0, 10),
        logged_by: createdBy || 'Unknown',
      })
      .select()
      .single()
    throwIfError(error, 'Failed to log project expense')
    return fromDbRow(inserted)
  },

  async remove(id) {
    const { error } = await supabase.from('project_expenses').delete().eq('id', id)
    throwIfError(error, 'Failed to remove project expense')
  },

  async sumForMonth(projectId, pool, month) {
    const { data, error } = await supabase
      .from('project_expenses')
      .select('amount')
      .eq('project_id', projectId)
      .eq('pool', pool)
      .eq('month', toDbMonth(month))
    throwIfError(error, 'Failed to sum project expenses')
    return Math.round((data || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) * 100) / 100
  },
}
