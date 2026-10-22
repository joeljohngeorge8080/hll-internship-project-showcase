// Supabase-backed store for per-employee, per-month salary detail records.
// Mirrors: salary_details (supabase/migrations/00000000000009_payroll.sql,
// 00000000000058_payroll_rls.sql). Migrated from localStorage.
//
// Keyed by employee CODE (e.g. "EMP2408") at the public API boundary — same
// convention the old localStorage version used, matching localAttendance.js —
// but the underlying table's employee_id column is a UUID FK, so reads filter
// through the employees join and writes resolve the code to its UUID first.
//
// Each record stores the raw manual inputs (idealBasic, da, pt, recovery,
// tnd, tndw, centreInchargeAllowance, rsoAllowance, invoiceNo, hcNo, state,
// remarks) plus ctcOverrides — a sparse map of any auto-calculated breakdown
// fields (Ideal HRA, EPFO, CTC, ...) HR has manually pinned to a value.
// Everything else in the breakdown is still derived fresh via
// computeEffectiveCTC() on read/display, never persisted. Audit trail is
// automatic via the trg_audit_salary_details DB trigger — no manual
// localAudit.write() here.

import supabase from './supabase'

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

const resolveEmployeeUuid = async (employeeCode) => {
  const { data, error } = await supabase
    .from('employees')
    .select('id')
    .eq('employee_id', employeeCode)
    .maybeSingle()
  throwIfError(error, 'Failed to resolve employee')
  if (!data) throw new Error(`Employee "${employeeCode}" not found`)
  return data.id
}

const toRecordShape = (row, employeeCode) => ({
  id: row.id,
  employee_id: employeeCode,
  year: row.year,
  month: row.month,
  idealBasic: row.ideal_basic != null ? Number(row.ideal_basic) : null,
  da: Number(row.da || 0),
  stateForPT: row.state || '',
  ptAuto: row.pt_auto !== false,
  ptOverride: row.pt_override != null ? Number(row.pt_override) : null,
  recovery: row.recovery != null ? Number(row.recovery) : 0,
  tnd: row.tnd != null ? Number(row.tnd) : null,
  tndw: row.tndw != null ? Number(row.tndw) : null,
  centreInchargeAllowance:
    row.centre_incharge_allowance != null ? Number(row.centre_incharge_allowance) : 0,
  rsoAllowance: row.rso_allowance != null ? Number(row.rso_allowance) : 0,
  invoiceNo: row.invoice_no || '',
  hcNo: row.hc_no || '',
  remarks: row.remarks || '',
  ctcOverrides: row.ctc_overrides || {},
  created_at: row.created_at,
  updated_at: row.updated_at,
})

const toDbPatch = (fields) => {
  const patch = {}
  if (fields.idealBasic !== undefined) patch.ideal_basic = fields.idealBasic
  if (fields.da !== undefined) patch.da = fields.da
  if (fields.stateForPT !== undefined) patch.state = fields.stateForPT
  if (fields.ptAuto !== undefined) patch.pt_auto = fields.ptAuto
  if (fields.ptOverride !== undefined) patch.pt_override = fields.ptOverride || null
  if (fields.recovery !== undefined) patch.recovery = fields.recovery
  if (fields.tnd !== undefined) patch.tnd = fields.tnd
  if (fields.tndw !== undefined) patch.tndw = fields.tndw
  if (fields.centreInchargeAllowance !== undefined)
    patch.centre_incharge_allowance = fields.centreInchargeAllowance
  if (fields.rsoAllowance !== undefined) patch.rso_allowance = fields.rsoAllowance
  if (fields.invoiceNo !== undefined) patch.invoice_no = fields.invoiceNo
  if (fields.hcNo !== undefined) patch.hc_no = fields.hcNo
  if (fields.remarks !== undefined) patch.remarks = fields.remarks
  if (fields.ctcOverrides !== undefined) patch.ctc_overrides = fields.ctcOverrides
  return patch
}

export const localSalaryDetails = {
  async get(employeeCode, year, month) {
    const { data, error } = await supabase
      .from('salary_details')
      .select('*, employees!inner(employee_id)')
      .eq('employees.employee_id', employeeCode)
      .eq('year', Number(year))
      .eq('month', Number(month))
      .maybeSingle()
    throwIfError(error, 'Failed to load salary details')
    return data ? toRecordShape(data, employeeCode) : null
  },

  // Creates or updates the one record for this employee+year+month.
  async upsert(employeeCode, year, month, fields) {
    const employeeUuid = await resolveEmployeeUuid(employeeCode)
    const { data, error } = await supabase
      .from('salary_details')
      .upsert(
        {
          employee_id: employeeUuid,
          year: Number(year),
          month: Number(month),
          ...toDbPatch(fields),
        },
        { onConflict: 'employee_id,year,month' },
      )
      .select()
      .single()
    throwIfError(error, 'Failed to save salary details')
    return toRecordShape(data, employeeCode)
  },

  async listByEmployee(employeeCode) {
    const { data, error } = await supabase
      .from('salary_details')
      .select('*, employees!inner(employee_id)')
      .eq('employees.employee_id', employeeCode)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
    throwIfError(error, 'Failed to load salary details')
    return (data || []).map((row) => toRecordShape(row, employeeCode))
  },
}
