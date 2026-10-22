// Supabase-backed store for per-employee, per-month Salary Invoice overrides
// (src/modules/ems/staff-payroll/SalaryInvoicePage.jsx). One row per
// employee per year/month — see supabase/migrations/00000000000038_salary_invoice_overrides.sql.
import supabase from './supabase'

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

const TABLE = 'salary_invoice_overrides'

export const localSalaryInvoiceOverrides = {
  async list({ year, month }) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('year', year)
      .eq('month', month)
    throwIfError(error, 'Failed to load salary invoice overrides')
    return data || []
  },

  async upsert({
    employeeId,
    year,
    month,
    idealBasic,
    da,
    tnd,
    tndw,
    pt,
    recovery,
    serviceChargeRate,
    idealHRA,
    idealOA,
    actualHRA,
    actualOA,
  }) {
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(
        {
          employee_id: employeeId,
          year,
          month,
          ideal_basic: idealBasic ?? null,
          da: da ?? null,
          tnd: tnd ?? null,
          tndw: tndw ?? null,
          pt: pt ?? null,
          recovery: recovery ?? null,
          service_charge_rate: serviceChargeRate ?? null,
          ideal_hra: idealHRA ?? null,
          ideal_oa: idealOA ?? null,
          actual_hra: actualHRA ?? null,
          actual_oa: actualOA ?? null,
        },
        { onConflict: 'employee_id,year,month' },
      )
      .select()
      .single()
    throwIfError(error, 'Failed to save salary invoice override')
    return data
  },

  async removeAllForMonth({ year, month }) {
    const { error } = await supabase.from(TABLE).delete().eq('year', year).eq('month', month)
    throwIfError(error, 'Failed to reset salary invoice overrides')
  },
}
