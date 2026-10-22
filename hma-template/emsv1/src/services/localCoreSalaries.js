// Supabase-backed Core division salary store — migrated from localStorage.
// Mirrors: core_salaries (supabase/migrations/00000000000009_payroll.sql,
// 00000000000058_payroll_rls.sql). Keeps the same external shape as the old
// localStorage version — employee_id here is the employee's UUID row id
// (matches how CoreSalaryPanel.jsx already used it), employee_name/
// employee_code are joined in from employees. Audit trail is automatic via
// the trg_audit_core_salaries DB trigger — no manual localAudit.write() here.

import supabase from './supabase'

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

const SELECT = '*, employees(employee_id, first_name, middle_name, last_name)'

const employeeName = (emp) =>
  emp ? [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ') : ''

const toEntryShape = (row) => {
  const planned = parseFloat(row.planned_amount || 0)
  const actual = parseFloat(row.actual_amount || 0)
  return {
    id: row.id,
    employee_id: row.employee_id,
    employee_name: employeeName(row.employees),
    employee_code: row.employees?.employee_id || '',
    month: row.month,
    year: row.year,
    planned_amount: planned,
    actual_amount: actual,
    variance: parseFloat((actual - planned).toFixed(2)),
    status: row.status || 'Pending',
    remarks: row.remarks,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export const localCoreSalaries = {
  async list({ year, month } = {}) {
    let query = supabase.from('core_salaries').select(SELECT)
    if (year) query = query.eq('year', year)
    if (month) query = query.eq('month', month)
    const { data, error } = await query
    throwIfError(error, 'Failed to load salary entries')
    return (data || [])
      .map(toEntryShape)
      .sort((a, b) => a.employee_name.localeCompare(b.employee_name))
  },

  async get(id) {
    const { data, error } = await supabase
      .from('core_salaries')
      .select(SELECT)
      .eq('id', id)
      .maybeSingle()
    throwIfError(error, 'Failed to load salary entry')
    if (!data) throw new Error('Salary entry not found')
    return toEntryShape(data)
  },

  async create(data) {
    const { data: row, error } = await supabase
      .from('core_salaries')
      .insert({
        employee_id: data.employee_id,
        month: data.month,
        year: data.year,
        planned_amount: parseFloat(data.planned_amount || 0),
        actual_amount: parseFloat(data.actual_amount || 0),
        status: data.status || 'Pending',
        remarks: data.remarks || null,
      })
      .select(SELECT)
      .single()
    throwIfError(error, 'Failed to create salary entry')
    return toEntryShape(row)
  },

  async update(id, patch) {
    const dbPatch = {}
    if (patch.planned_amount !== undefined)
      dbPatch.planned_amount = parseFloat(patch.planned_amount)
    if (patch.actual_amount !== undefined) dbPatch.actual_amount = parseFloat(patch.actual_amount)
    if (patch.status !== undefined) dbPatch.status = patch.status
    if (patch.remarks !== undefined) dbPatch.remarks = patch.remarks

    const { data: row, error } = await supabase
      .from('core_salaries')
      .update(dbPatch)
      .eq('id', id)
      .select(SELECT)
      .single()
    throwIfError(error, 'Failed to update salary entry')
    return toEntryShape(row)
  },

  async delete(id) {
    const { error } = await supabase.from('core_salaries').delete().eq('id', id)
    throwIfError(error, 'Failed to delete salary entry')
  },
}
