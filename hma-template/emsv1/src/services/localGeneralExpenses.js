// Supabase-backed General Expenses store — migrated from localStorage.
// Mirrors: expense_categories, general_expenses, expense_uploads
// (supabase/migrations/00000000000010_expenses.sql,
// 00000000000026_expense_timestamps_rls.sql). Keeps the same external shape
// as the old localStorage version, so consumers only need to handle these
// calls being async now.

import supabase from './supabase'
import { localAudit } from './localAudit'

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

// general_expenses has no `variance` column in Postgres — it was always a
// derived value (actual - planned), never something worth persisting.
const withVariance = (row) => ({
  ...row,
  variance: parseFloat(
    (parseFloat(row.actual_amount || 0) - parseFloat(row.planned_amount || 0)).toFixed(2),
  ),
})

// ── Categories ────────────────────────────────────────────────────────────────

const categories = {
  async list(includeInactive = false) {
    let query = supabase.from('expense_categories').select('*').order('name')
    if (!includeInactive) query = query.eq('is_active', true)
    const { data, error } = await query
    throwIfError(error, 'Failed to load expense categories')
    return data || []
  },

  async create(name, description = '') {
    const { data: conflict } = await supabase
      .from('expense_categories')
      .select('id')
      .ilike('name', name)
      .maybeSingle()
    if (conflict) throw new Error('Category name already exists')

    const { data: cat, error } = await supabase
      .from('expense_categories')
      .insert({ name: name.trim(), description, is_active: true })
      .select()
      .single()
    throwIfError(error, 'Failed to create category')
    return cat
  },

  async update(id, patch) {
    if (patch.name) {
      const { data: conflict } = await supabase
        .from('expense_categories')
        .select('id')
        .ilike('name', patch.name)
        .neq('id', id)
        .maybeSingle()
      if (conflict) throw new Error('Category name already exists')
    }
    const { data: cat, error } = await supabase
      .from('expense_categories')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    throwIfError(error, 'Failed to update category')
    return cat
  },

  async delete(id) {
    const { count, error: countError } = await supabase
      .from('general_expenses')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id)
    throwIfError(countError, 'Failed to check category usage')
    if (count > 0) {
      throw new Error('Cannot delete a category that has expense records. Deactivate it instead.')
    }
    const { error } = await supabase.from('expense_categories').delete().eq('id', id)
    throwIfError(error, 'Failed to delete category')
  },
}

// ── Expenses ──────────────────────────────────────────────────────────────────

const SELECT = '*, expense_categories(name)'
const withCategoryName = (row) => ({
  ...withVariance(row),
  category_name: row.expense_categories?.name || 'Unknown',
  expense_categories: undefined,
})

const expenses = {
  async list({ year, month, category_id, status, page = 1, page_size = 25 } = {}) {
    let query = supabase.from('general_expenses').select(SELECT, { count: 'exact' })
    if (year) query = query.eq('year', year)
    if (month) query = query.eq('month', month)
    if (category_id) query = query.eq('category_id', category_id)
    if (status) query = query.eq('status', status)

    const offset = (page - 1) * page_size
    query = query
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .order('expense_name', { ascending: true })
      .range(offset, offset + page_size - 1)

    const { data, error, count } = await query
    throwIfError(error, 'Failed to load expenses')
    const total = count || 0
    return {
      items: (data || []).map(withCategoryName),
      total,
      total_pages: Math.max(1, Math.ceil(total / page_size)),
      page,
    }
  },

  async get(id) {
    const { data, error } = await supabase
      .from('general_expenses')
      .select(SELECT)
      .eq('id', id)
      .maybeSingle()
    throwIfError(error, 'Failed to load expense')
    if (!data) throw new Error('Expense not found')
    return withCategoryName(data)
  },

  async create(data) {
    const { data: record, error } = await supabase
      .from('general_expenses')
      .insert({
        category_id: data.category_id,
        expense_name: data.expense_name,
        month: data.month,
        year: data.year,
        frequency: data.frequency || 'Monthly',
        planned_amount: parseFloat(data.planned_amount || 0),
        actual_amount: parseFloat(data.actual_amount || 0),
        status: data.status || 'Pending',
        remarks: data.remarks || null,
        upload_id: data.upload_id || null,
      })
      .select(SELECT)
      .single()
    throwIfError(error, 'Failed to create expense')
    const exp = withCategoryName(record)
    localAudit.write({
      module: 'General Expenses',
      action: 'EXPENSE_CREATED',
      record_id: exp.id,
      record_label: exp.expense_name,
      new_value: {
        expense_name: exp.expense_name,
        planned_amount: exp.planned_amount,
        actual_amount: exp.actual_amount,
        status: exp.status,
        month: exp.month,
        year: exp.year,
      },
      details: `Created expense "${exp.expense_name}" (${exp.year}-${String(exp.month).padStart(2, '0')}) — planned ₹${exp.planned_amount.toLocaleString()}`,
    })
    return exp
  },

  async update(id, patch) {
    const { data: record, error } = await supabase
      .from('general_expenses')
      .update(patch)
      .eq('id', id)
      .select(SELECT)
      .single()
    throwIfError(error, 'Failed to update expense')
    const updated = withCategoryName(record)
    localAudit.write({
      module: 'General Expenses',
      action: 'EXPENSE_UPDATED',
      record_id: id,
      record_label: updated.expense_name,
      new_value: {
        expense_name: updated.expense_name,
        planned_amount: updated.planned_amount,
        actual_amount: updated.actual_amount,
        status: updated.status,
      },
      details: `Updated expense "${updated.expense_name}" — actual ₹${updated.actual_amount.toLocaleString()}, status: ${updated.status}`,
    })
    return updated
  },

  async delete(id) {
    const exp = await expenses.get(id)
    const { error } = await supabase.from('general_expenses').delete().eq('id', id)
    throwIfError(error, 'Failed to delete expense')
    localAudit.write({
      module: 'General Expenses',
      action: 'EXPENSE_DELETED',
      record_id: id,
      record_label: exp.expense_name,
      old_value: {
        expense_name: exp.expense_name,
        actual_amount: exp.actual_amount,
        status: exp.status,
      },
      details: `Deleted expense "${exp.expense_name}" (${exp.year}-${String(exp.month).padStart(2, '0')})`,
    })
  },
}

// ── Uploads ───────────────────────────────────────────────────────────────────
// uploads.create() is currently unused anywhere in the app — kept for shape
// parity with the old localStorage service, mapped straight to the real
// expense_uploads columns (file_name, uploaded_by, uploaded_at).

const uploads = {
  async list() {
    const { data, error } = await supabase
      .from('expense_uploads')
      .select('*')
      .order('uploaded_at', { ascending: false })
    throwIfError(error, 'Failed to load uploads')
    return data || []
  },

  async create(data) {
    const { data: upload, error } = await supabase
      .from('expense_uploads')
      .insert({ file_name: data.file_name, uploaded_by: data.uploaded_by || null })
      .select()
      .single()
    throwIfError(error, 'Failed to record upload')
    return upload
  },
}

// ── Analysis ──────────────────────────────────────────────────────────────────

const analysis = {
  async get(year) {
    const { data, error } = await supabase.from('general_expenses').select(SELECT).eq('year', year)
    throwIfError(error, 'Failed to load expense analysis')
    const allExpenses = (data || []).map(withCategoryName)

    const ytd_planned = allExpenses.reduce((s, e) => s + parseFloat(e.planned_amount || 0), 0)
    const ytd_actual = allExpenses.reduce((s, e) => s + parseFloat(e.actual_amount || 0), 0)
    const ytd_variance = parseFloat((ytd_actual - ytd_planned).toFixed(2))

    const monthMap = {}
    for (const e of allExpenses) {
      if (!monthMap[e.month]) monthMap[e.month] = { planned: 0, actual: 0, count: 0 }
      monthMap[e.month].planned += parseFloat(e.planned_amount || 0)
      monthMap[e.month].actual += parseFloat(e.actual_amount || 0)
      monthMap[e.month].count += 1
    }
    const monthly_summary = Object.entries(monthMap)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([m, v]) => ({
        month: parseInt(m),
        year,
        planned_total: parseFloat(v.planned.toFixed(2)),
        actual_total: parseFloat(v.actual.toFixed(2)),
        variance_total: parseFloat((v.actual - v.planned).toFixed(2)),
        record_count: v.count,
      }))

    const catTotals = {}
    for (const e of allExpenses) {
      if (!catTotals[e.category_id]) catTotals[e.category_id] = { planned: 0, actual: 0 }
      catTotals[e.category_id].planned += parseFloat(e.planned_amount || 0)
      catTotals[e.category_id].actual += parseFloat(e.actual_amount || 0)
    }
    const category_summary = Object.entries(catTotals)
      .sort((a, b) => b[1].actual - a[1].actual)
      .map(([cid, v]) => {
        const match = allExpenses.find((e) => e.category_id === cid)
        return {
          category_id: cid,
          category_name: match?.category_name || 'Unknown',
          planned_total: parseFloat(v.planned.toFixed(2)),
          actual_total: parseFloat(v.actual.toFixed(2)),
          variance_total: parseFloat((v.actual - v.planned).toFixed(2)),
        }
      })

    const status_breakdown = {}
    for (const e of allExpenses) {
      status_breakdown[e.status] = (status_breakdown[e.status] || 0) + 1
    }

    return {
      year,
      ytd_planned: parseFloat(ytd_planned.toFixed(2)),
      ytd_actual: parseFloat(ytd_actual.toFixed(2)),
      ytd_variance,
      monthly_summary,
      category_summary,
      status_breakdown,
    }
  },
}

export const localGeneralExpenses = { categories, expenses, uploads, analysis }
