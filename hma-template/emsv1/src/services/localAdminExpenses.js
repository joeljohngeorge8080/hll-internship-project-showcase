// Supabase-backed store for Admin Expenses (vendor recurring contracts).
// Migrated from localStorage — see supabase/migrations/00000000000010_expenses.sql
// (admin_expenses, admin_expense_monthly_actuals) and 00000000000026_expense_timestamps_rls.sql.
// Tracks vendor name, expense category, frequency, and annual contract value.
// Monthly equivalent is always derived: annual_amount / 12.
// monthly_actuals additionally records what was really spent in a given
// 'YYYY-MM' — normalized into a child table in Postgres, but still returned
// here as the same { 'YYYY-MM': amount } map consumers already expect.

import supabase from './supabase'

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

// Month keys are 'YYYY-MM' throughout the app, but year_month is a Postgres
// `date` (first-of-month) — same DB-boundary convention as localProjects.js.
const toDbMonth = (m) => (m && m.length === 7 ? `${m}-01` : m)
const fromDbMonth = (m) => (m ? String(m).slice(0, 7) : m)

// DB status is lowercase ('active'|'inactive'); the app's shape has always
// used Title-case strings — preserved here, same as employee/UC status.
const STATUS_TO_DB = { Active: 'active', Inactive: 'inactive' }
const STATUS_FROM_DB = { active: 'Active', inactive: 'Inactive' }
const toDbStatus = (s) => STATUS_TO_DB[s] || (s || 'active').toLowerCase()
const fromDbStatus = (s) => STATUS_FROM_DB[s] || 'Active'

const SELECT = '*, admin_expense_monthly_actuals(year_month, amount)'

const fromDbRow = (row) => {
  const monthly_actuals = {}
  ;(row.admin_expense_monthly_actuals || []).forEach((m) => {
    monthly_actuals[fromDbMonth(m.year_month)] = parseFloat(m.amount) || 0
  })
  return {
    id: row.id,
    vendor_name: row.vendor_name,
    expense_category: row.expense_category,
    frequency: row.frequency,
    annual_amount: row.annual_amount,
    monthly_actuals,
    // 'HR' | 'Admin' — only used by the Forecast Expense tab's card grouping
    group: row.expense_group,
    status: fromDbStatus(row.status),
    remarks: row.remarks,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export const localAdminExpenses = {
  async list({ search = '', category = '', frequency = '', status = '' } = {}) {
    let query = supabase.from('admin_expenses').select(SELECT)
    if (search) query = query.ilike('vendor_name', `%${search}%`)
    if (category) query = query.eq('expense_category', category)
    if (frequency) query = query.eq('frequency', frequency)
    if (status) query = query.eq('status', toDbStatus(status))
    const { data, error } = await query
    throwIfError(error, 'Failed to load admin expenses')
    return (data || []).map(fromDbRow)
  },

  async categories() {
    const { data, error } = await supabase.from('admin_expenses').select('expense_category')
    throwIfError(error, 'Failed to load admin expense categories')
    return [...new Set((data || []).map((r) => r.expense_category).filter(Boolean))].sort()
  },

  async get(id) {
    const { data, error } = await supabase
      .from('admin_expenses')
      .select(SELECT)
      .eq('id', id)
      .maybeSingle()
    throwIfError(error, 'Failed to load admin expense')
    if (!data) throw new Error('Expense not found')
    return fromDbRow(data)
  },

  /** Find an entry by exact vendor + category match, if one exists. */
  async findByVendorCategory(vendor_name, expense_category) {
    const { data, error } = await supabase
      .from('admin_expenses')
      .select(SELECT)
      .eq('vendor_name', vendor_name)
      .eq('expense_category', expense_category)
      .maybeSingle()
    throwIfError(error, 'Failed to look up admin expense')
    return data ? fromDbRow(data) : null
  },

  async create(data) {
    const { data: record, error } = await supabase
      .from('admin_expenses')
      .insert({
        vendor_name: data.vendor_name.trim(),
        expense_category: data.expense_category.trim(),
        frequency: data.frequency,
        annual_amount: parseFloat(data.annual_amount) || 0,
        expense_group: data.group || 'Admin',
        status: toDbStatus(data.status || 'Active'),
        remarks: data.remarks?.trim() || null,
      })
      .select(SELECT)
      .single()
    throwIfError(error, 'Failed to create admin expense')
    return fromDbRow(record)
  },

  /** Merge a single month's actual spend into an entry's monthly_actuals map. */
  async setMonthlyActual(id, monthKey, amount) {
    const { error } = await supabase
      .from('admin_expense_monthly_actuals')
      .upsert(
        { admin_expense_id: id, year_month: toDbMonth(monthKey), amount: parseFloat(amount) || 0 },
        { onConflict: 'admin_expense_id,year_month' },
      )
    throwIfError(error, 'Failed to save monthly actual')
    return this.get(id)
  },

  async update(id, patch) {
    const dbPatch = {}
    if (patch.vendor_name !== undefined) dbPatch.vendor_name = patch.vendor_name
    if (patch.expense_category !== undefined) dbPatch.expense_category = patch.expense_category
    if (patch.frequency !== undefined) dbPatch.frequency = patch.frequency
    if (patch.annual_amount !== undefined)
      dbPatch.annual_amount = parseFloat(patch.annual_amount) || 0
    if (patch.group !== undefined) dbPatch.expense_group = patch.group
    if (patch.status !== undefined) dbPatch.status = toDbStatus(patch.status)
    if (patch.remarks !== undefined) dbPatch.remarks = patch.remarks?.trim() || null
    const { data: record, error } = await supabase
      .from('admin_expenses')
      .update(dbPatch)
      .eq('id', id)
      .select(SELECT)
      .single()
    throwIfError(error, 'Failed to update admin expense')
    return fromDbRow(record)
  },

  async delete(id) {
    const { error } = await supabase.from('admin_expenses').delete().eq('id', id)
    throwIfError(error, 'Failed to delete admin expense')
  },

  /**
   * Returns active HR admin expenses converted to the PMS ExpenseCard format.
   * Amount shown is the monthly equivalent (annual / 12).
   * These entries are tagged with source: 'hr_admin' so PMS can render them
   * as read-only org-level entries.
   */
  async asProjectExpenses() {
    const rows = await this.list({ status: 'Active' })
    return rows.map((r) => ({
      id: r.id,
      label: `${r.expense_category} — ${r.vendor_name}`,
      amount: Math.round(parseFloat(r.annual_amount || 0) / 12),
      date: r.updated_at || r.created_at || '',
      notes: `${r.frequency} · HR Admin`,
      source: 'hr_admin',
      vendor_name: r.vendor_name,
      expense_category: r.expense_category,
      frequency: r.frequency,
      annual_amount: r.annual_amount,
    }))
  },
}
