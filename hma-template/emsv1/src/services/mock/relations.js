// Embedded-select relations the app uses (PostgREST resource embedding), keyed
// by parent table → embedded table name. Mirrors the foreign keys in
// supabase/migrations so the mock client can resolve e.g.
// `employees.select('*, employee_contacts(*)')` without a real database.
//
//   many   — child rows whose `col` equals the parent's id (array result)
//   one    — a single child row whose `col` equals the parent's id (object/null)
//   parent — the row in the embedded table whose id equals the parent's `col`
const many = (col) => ({ kind: 'many', col })
const one = (col) => ({ kind: 'one', col })
const parent = (col) => ({ kind: 'parent', col })

export const RELATIONS = {
  employees: {
    employee_contacts: one('employee_id'),
    employee_addresses: one('employee_id'),
    employee_employment: one('employee_id'),
    employee_identification: one('employee_id'),
    employee_bank_accounts: many('employee_id'),
    employee_family_members: many('employee_id'),
    salary_history: many('employee_id'),
  },
  projects: {
    project_officer_assignments: many('project_id'),
    project_installments: many('project_id'),
    project_milestones: many('project_id'),
    project_risks: many('project_id'),
    project_field_personnel: many('project_id'),
    project_notes: many('project_id'),
    project_personnel_details: many('project_id'),
    project_activities: many('project_id'),
    project_pool_pct_adjustments: many('project_id'),
    project_monthly_plan: many('project_id'),
    project_pool_adjustments: many('project_id'),
    project_sent_allocations: many('project_id'),
    project_expenses: many('project_id'),
    project_plan_blocks: one('project_id'),
  },
  project_officer_assignments: { employees: parent('employee_id') },
  project_installments: { project_installment_extra_ucs: many('installment_id') },
  project_monthly_plan: { project_monthly_plan_phases: many('monthly_plan_id') },
  project_pool_adjustments: { employees: parent('created_by') },
  project_sent_allocations: { employees: parent('sent_by') },
  beneficiaries: { beneficiary_follow_ups: many('beneficiary_id') },
  admin_expenses: { admin_expense_monthly_actuals: many('admin_expense_id') },
  core_salaries: { employees: parent('employee_id') },
  salary_details: { employees: parent('employee_id') },
  general_expenses: { expense_categories: parent('category_id') },
  pool_expense_allocations: { projects: parent('project_id') },
  employee_employment: { employees: parent('employee_id') },
}

// Tables whose primary key is not a generated `id` column.
export const PRIMARY_KEYS = {
  employee_contacts: 'employee_id',
  employee_addresses: 'employee_id',
  employee_employment: 'employee_id',
  employee_identification: 'employee_id',
  project_ledgers: 'project_id',
  project_plan_blocks: 'project_id',
}

// Columns that must stay unique (the app relies on Postgres rejecting dupes).
export const UNIQUE_COLUMNS = {
  employees: ['employee_id'],
  projects: ['project_code'],
}
