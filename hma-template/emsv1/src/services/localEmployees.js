// Supabase-backed employee store (migrated from localStorage — see ADR-037).
// Keeps the same external object shape as the old localStorage version
// (nested contact/address/employment/identification, array fields for
// bank_accounts/family_members/salary_history/status_history/department_history)
// so consumers only need to handle these calls being async now.

import supabase from './supabase'

// In-memory cache for the full employee list, keyed on the in-flight
// *promise* rather than the resolved data (matching localProjects.js's
// fetchAllProjects/fetchDashboardProjects pattern). Dashboard widgets all call
// list({ pageSize: 9999 }) from their own mount effect, which fire in the same
// tick — caching only the resolved result meant every one of those calls still
// missed the cache and fired its own Supabase round-trip, since none of them
// had resolved yet when the others checked. Caching the promise itself means
// the first caller's in-flight request is handed to every other caller within
// the TTL window, so N simultaneous widgets collapse into one real query.
// Cache invalidates after 5 minutes (TTL) or on any write (create/update/delete).
let _employeeListCache = null // { promise, setAt }
const EMPLOYEE_CACHE_TTL_MS = 5 * 60 * 1000

const invalidateEmployeeCache = () => {
  _employeeListCache = null
}

const isUnfilteredEmployeeQuery = (query) =>
  !query.search &&
  !query.status &&
  !query.department &&
  !query.category &&
  query.page === 1 &&
  query.pageSize === 9999

const getEmployeeListFromCache = (query) => {
  if (!_employeeListCache || !isUnfilteredEmployeeQuery(query)) return null
  if (Date.now() - _employeeListCache.setAt > EMPLOYEE_CACHE_TTL_MS) {
    invalidateEmployeeCache()
    return null
  }
  return _employeeListCache.promise
}

const setEmployeeListCache = (promise, query) => {
  if (!isUnfilteredEmployeeQuery(query)) return
  _employeeListCache = { promise, setAt: Date.now() }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (v) => UUID_RE.test(v || '')

const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()
const today = () => now().split('T')[0]

const STATUS_TO_DB = { Active: 'active', Inactive: 'inactive', Deleted: 'deleted' }
const STATUS_FROM_DB = { active: 'Active', inactive: 'Inactive', deleted: 'Deleted' }
const toDbStatus = (s) => STATUS_TO_DB[s] || (s || 'active').toLowerCase()
const fromDbStatus = (s) => STATUS_FROM_DB[s] || 'Active'

// project_assignments has no Supabase table yet — that's `project_officer_assignments`,
// part of the Projects migration phase, not Employees. Kept on a small dedicated
// localStorage key until that phase lands, so this one feature doesn't block the rest.
const PROJECT_ASSIGN_LEGACY_KEY = 'hma_employee_project_assignments_legacy'

const readLegacyAssignments = (employeeId) => {
  try {
    const all = JSON.parse(localStorage.getItem(PROJECT_ASSIGN_LEGACY_KEY) || '{}')
    return all[employeeId] || []
  } catch {
    return []
  }
}

const writeLegacyAssignments = (employeeId, assignments) => {
  let all = {}
  try {
    all = JSON.parse(localStorage.getItem(PROJECT_ASSIGN_LEGACY_KEY) || '{}')
  } catch {
    all = {}
  }
  all[employeeId] = assignments
  localStorage.setItem(PROJECT_ASSIGN_LEGACY_KEY, JSON.stringify(all))
}

// employee_status_history/employee_department_history are joined and mapped
// by toEmployeeShape below (status_history/department_history) but nothing
// in the app actually reads those two fields off a fetched employee — both
// tables are write-only audit trails (inserted from update()/updateStatus()).
// Dropped from the select so every getById()/detailed list() call doesn't
// pay for joining in years of audit rows nobody displays.
const EMPLOYEE_SELECT = `
  *,
  employee_contacts(*),
  employee_addresses(*),
  employee_employment!employee_employment_employee_id_fkey(*),
  employee_identification(*),
  employee_bank_accounts(*),
  employee_family_members(*),
  salary_history!salary_history_employee_id_fkey(*)
`

// list() is called with pageSize up to 9999 by dashboard widgets, reports and
// payroll calculators that only ever read the scalar columns, `.contact`
// and `.employment` off each row (verified against every caller — none of
// them touch bank_accounts/family_members/identification/address/the history
// arrays). Pulling those joins for every row on every list call was the
// single biggest cost in the app: a 25-row page could join in thousands of
// salary_history/status_history/department_history rows. list() uses this
// trimmed select by default and only falls back to the full EMPLOYEE_SELECT
// when a caller passes `detailed: true` (MyProfilePage's list-based fallback
// lookup, which renders the same full profile UI as getById).
const EMPLOYEE_LIST_SELECT = `
  *,
  employee_contacts(*),
  employee_employment!employee_employment_employee_id_fkey(*)
`

const toEmployeeShape = (row) => {
  const contact = row.employee_contacts || {}
  const address = row.employee_addresses || {}
  const employment = row.employee_employment || {}
  const identification = row.employee_identification || {}

  return {
    id: row.id,
    employee_id: row.employee_id,
    first_name: row.first_name,
    middle_name: row.middle_name || '',
    last_name: row.last_name,
    employee_name: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' '),
    gender: row.gender || '',
    marital_status: row.marital_status || '',
    blood_group: row.blood_group || '',
    date_of_birth: row.date_of_birth || '',
    employee_category: row.employee_category || '',
    status: fromDbStatus(row.status),
    joined_date: row.joined_date || '',
    exit_date: row.exit_date || '',
    deleted: row.status === 'deleted',
    deleted_at: row.deleted_at || null,
    deleted_remarks: row.deleted_remarks || '',
    current_salary: row.current_salary != null ? Number(row.current_salary) : 0,
    photo_url: row.photo_url || null,
    created_at: row.created_at,
    updated_at: row.updated_at,

    contact: {
      personal_email: contact.personal_email || '',
      working_email: contact.working_email || '',
      mobile: contact.mobile || '',
      phone: contact.phone || '',
      emergency_contact: contact.emergency_contact_name || '',
    },
    address: {
      resident_location: address.resident_location || '',
      present_address: address.present_address || '',
      permanent_address: address.permanent_address || '',
      state: address.state || '',
    },
    employment: {
      designation: employment.designation || '',
      designation_text: employment.designation_text || '',
      department: employment.department || '',
      reporting_to: employment.reporting_to || '',
      employee_category: row.employee_category || '',
      status: fromDbStatus(row.status),
      working_region: employment.working_region || '',
      working_state: employment.working_state || '',
      start_date: employment.start_date || row.joined_date || '',
      end_date: employment.end_date || '',
    },
    identification: {
      pan_number: identification.pan || '',
      aadhar_number: identification.aadhar || '',
      passport_number: identification.passport || '',
      uan_number: identification.uan || '',
      esi_number: identification.esi_number || '',
      pf_number: identification.pf_number || '',
      insurance_number: identification.insurance_number || '',
    },
    bank_accounts: (row.employee_bank_accounts || []).map((b) => ({
      id: b.id,
      bank_name: b.bank_name || '',
      account_number: b.account_number || '',
      ifsc: b.ifsc || '',
      is_primary: !!b.is_primary,
    })),
    family_members: (row.employee_family_members || []).map((f) => ({
      id: f.id,
      name: f.name,
      relation: f.relation || '',
      date_of_birth: f.date_of_birth || '',
    })),
    salary_history: (row.salary_history || [])
      .map((s) => ({
        id: s.id,
        previous_salary: Number(s.previous_salary || 0),
        increment_percentage: s.increment_pct != null ? Number(s.increment_pct) : null,
        increment_amount: Number(s.increment_amount || 0),
        new_salary: Number(s.new_salary),
        effective_date: s.effective_date,
        remarks: s.remarks || '',
        designation_changed_to: s.designation_changed_to || undefined,
        ctc_breakdown: s.ctc_breakdown || undefined,
        created_at: s.created_at,
      }))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    documents: [],
    project_assignments: readLegacyAssignments(row.id),
    status_history: (row.employee_status_history || [])
      .map((s) => ({
        id: s.id,
        new_status: fromDbStatus(s.status),
        remarks: s.remarks || '',
        changed_at: s.changed_at,
      }))
      .sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at)),
    department_history: (row.employee_department_history || [])
      .map((d) => ({
        id: d.id,
        new_department: d.department,
        changed_at: d.changed_at,
      }))
      .sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at)),
  }
}

const throwIfError = (error, fallbackMsg) => {
  if (error) throw new Error(error.message || fallbackMsg)
}

// Reconciles a submitted array-field (bank accounts, family members) against
// what's in the DB: rows dropped from the form get deleted, rows with an id
// get updated, rows without one get inserted (skipped if blank — e.g. an
// "Add" row left empty and submitted anyway).
const syncBankAccounts = async (employeeId, existing, submitted) => {
  const submittedIds = new Set(submitted.filter((b) => b.id).map((b) => b.id))
  const toDelete = existing.filter((b) => !submittedIds.has(b.id)).map((b) => b.id)
  if (toDelete.length) {
    const { error } = await supabase.from('employee_bank_accounts').delete().in('id', toDelete)
    throwIfError(error, 'Failed to remove bank account')
  }
  for (const b of submitted) {
    const row = {
      bank_name: b.bank_name || null,
      account_number: b.account_number || null,
      ifsc: b.ifsc || null,
      is_primary: !!b.is_primary,
    }
    if (b.id) {
      const { error } = await supabase.from('employee_bank_accounts').update(row).eq('id', b.id)
      throwIfError(error, 'Failed to update bank account')
    } else if (row.bank_name || row.account_number || row.ifsc) {
      const { error } = await supabase
        .from('employee_bank_accounts')
        .insert({ ...row, employee_id: employeeId })
      throwIfError(error, 'Failed to add bank account')
    }
  }
}

const syncFamilyMembers = async (employeeId, existing, submitted) => {
  const submittedIds = new Set(submitted.filter((f) => f.id).map((f) => f.id))
  const toDelete = existing.filter((f) => !submittedIds.has(f.id)).map((f) => f.id)
  if (toDelete.length) {
    const { error } = await supabase.from('employee_family_members').delete().in('id', toDelete)
    throwIfError(error, 'Failed to remove family member')
  }
  for (const f of submitted) {
    const row = {
      name: f.name || null,
      relation: f.relation || null,
      date_of_birth: f.date_of_birth || null,
    }
    if (f.id) {
      const { error } = await supabase.from('employee_family_members').update(row).eq('id', f.id)
      throwIfError(error, 'Failed to update family member')
    } else if (row.name) {
      const { error } = await supabase
        .from('employee_family_members')
        .insert({ ...row, employee_id: employeeId })
      throwIfError(error, 'Failed to add family member')
    }
  }
}

// Builds and runs the actual list query. Split out from localEmployees.list()
// so the promise can be handed to setEmployeeListCache() before it resolves —
// see the cache comment above for why that matters.
function fetchEmployeeList(
  { search, status, department, category, page, pageSize },
  { includeDeleted, detailed },
) {
  const departmentJoin = department
    ? 'employee_employment!employee_employment_employee_id_fkey!inner(*)'
    : 'employee_employment!employee_employment_employee_id_fkey(*)'
  const select = (detailed ? EMPLOYEE_SELECT : EMPLOYEE_LIST_SELECT).replace(
    'employee_employment!employee_employment_employee_id_fkey(*)',
    departmentJoin,
  )

  let query = supabase.from('employees').select(select, { count: 'exact' })

  if (!includeDeleted) query = query.neq('status', 'deleted')
  if (status) query = query.eq('status', toDbStatus(status))
  if (category) query = query.eq('employee_category', category)
  if (department) query = query.eq('employee_employment.department', department)
  if (search) {
    const q = search.replace(/[%,]/g, '')
    query = query.or(`employee_id.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
  }

  query = query.order('employee_id', { ascending: true })

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  return query.range(from, to).then(({ data, error, count }) => {
    throwIfError(error, 'Failed to list employees')
    const total = count ?? 0
    return {
      items: (data || []).map(toEmployeeShape),
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
    }
  })
}

export const localEmployees = {
  // ── list ────────────────────────────────────────────────────────────────────
  async list({
    search = '',
    status = '',
    department = '',
    category = '',
    page = 1,
    pageSize = 25,
    includeDeleted = false,
    detailed = false,
  } = {}) {
    const queryParams = { search, status, department, category, page, pageSize }

    // Check cache for unfiltered full list (used by dashboard widgets)
    const cached = getEmployeeListFromCache(queryParams)
    if (cached) return cached

    const promise = fetchEmployeeList(queryParams, { includeDeleted, detailed })
    // Cache the in-flight promise for the unfiltered full list (dashboard
    // widgets); a failed fetch must not poison the cache for later callers.
    setEmployeeListCache(promise, queryParams)
    promise.catch(() => invalidateEmployeeCache())
    return promise
  },

  // ── getById ─────────────────────────────────────────────────────────────────
  // Accepts either the internal uuid (id) or the human-readable business code
  // (employee_id, e.g. "EMP023") — the latter is the only identifier shown
  // anywhere in the UI, so a bookmarked/typed/shared URL naturally carries it
  // instead of the uuid. Querying a uuid column with a non-uuid string makes
  // Postgres reject the request outright (22P02), which used to surface as a
  // raw 400 and an unhandled rejection instead of a clean "not found".
  async getById(id) {
    const { data, error } = await supabase
      .from('employees')
      .select(EMPLOYEE_SELECT)
      .eq(isUuid(id) ? 'id' : 'employee_id', id)
      .maybeSingle()
    throwIfError(error, 'Failed to load employee')
    return data ? toEmployeeShape(data) : null
  },

  // ── create ──────────────────────────────────────────────────────────────────
  async create(data) {
    const { data: existing } = await supabase
      .from('employees')
      .select('id')
      .eq('employee_id', data.employee_id)
      .maybeSingle()
    if (existing) throw new Error(`Employee ID "${data.employee_id}" already exists`)

    const ts = now()
    const initialSalary = parseFloat(data.initial_salary) || 0

    const { data: inserted, error } = await supabase
      .from('employees')
      .insert({
        employee_id: data.employee_id,
        first_name: data.first_name,
        middle_name: data.middle_name || null,
        last_name: data.last_name,
        gender: data.gender || null,
        marital_status: data.marital_status || null,
        blood_group: data.blood_group || null,
        date_of_birth: data.date_of_birth || null,
        employee_category: data.employee_category || null,
        status: toDbStatus(data.status || 'Active'),
        joined_date: data.joined_date || null,
        current_salary: initialSalary,
        photo_url: data.photo_url || null,
      })
      .select()
      .single()
    throwIfError(error, 'Failed to create employee')

    const employeeId = inserted.id

    await Promise.all([
      supabase.from('employee_contacts').insert({
        employee_id: employeeId,
        personal_email: data.contact?.personal_email || null,
        working_email: data.contact?.working_email || null,
        mobile: data.contact?.mobile || null,
        phone: data.contact?.phone || null,
        emergency_contact_name: data.contact?.emergency_contact || null,
      }),
      supabase.from('employee_addresses').insert({
        employee_id: employeeId,
        resident_location: data.address?.resident_location || null,
        present_address: data.address?.present_address || null,
        permanent_address: data.address?.permanent_address || null,
        state: data.address?.state || null,
      }),
      supabase.from('employee_employment').insert({
        employee_id: employeeId,
        designation: data.employment?.designation || '',
        designation_text: data.employment?.designation_text || null,
        department: data.employment?.department || null,
        reporting_to: data.employment?.reporting_to || null,
        working_region: data.employment?.working_region || null,
        working_state: data.employment?.working_state || null,
        start_date: data.employment?.start_date || data.joined_date || null,
      }),
      supabase.from('employee_identification').insert({
        employee_id: employeeId,
        pan: data.identification?.pan_number || null,
        aadhar: data.identification?.aadhar_number || null,
        passport: data.identification?.passport_number || null,
        uan: data.identification?.uan_number || null,
        esi_number: data.identification?.esi_number || null,
        pf_number: data.identification?.pf_number || null,
        insurance_number: data.identification?.insurance_number || null,
      }),
    ])

    if (data.bank_accounts?.length) {
      await supabase
        .from('employee_bank_accounts')
        .insert(data.bank_accounts.map((b) => ({ ...b, employee_id: employeeId })))
    }
    if (data.family_members?.length) {
      await supabase
        .from('employee_family_members')
        .insert(data.family_members.map((f) => ({ ...f, employee_id: employeeId })))
    }
    if (initialSalary) {
      await supabase.from('salary_history').insert({
        employee_id: employeeId,
        previous_salary: 0,
        increment_amount: initialSalary,
        new_salary: initialSalary,
        effective_date: data.joined_date || today(),
        remarks: 'Initial salary on joining',
      })
    }
    if (data.initial_project) {
      writeLegacyAssignments(employeeId, [
        {
          id: uid(),
          project_name: data.initial_project,
          assigned_date: data.initial_project_date || today(),
          end_date: null,
          status: 'Active',
          remarks: data.initial_project_remarks || '',
          assigned_by: data.assigned_by || 'HR',
          created_at: ts,
        },
      ])
    }

    invalidateEmployeeCache()
    return this.getById(employeeId)
  },

  // ── update ──────────────────────────────────────────────────────────────────
  async update(id, data) {
    const current = await this.getById(id)
    if (!current) throw new Error('Employee not found')

    if (data.employee_id && data.employee_id !== current.employee_id) {
      const { data: existing } = await supabase
        .from('employees')
        .select('id')
        .eq('employee_id', data.employee_id)
        .neq('id', id)
        .maybeSingle()
      if (existing) throw new Error(`Employee ID "${data.employee_id}" already exists`)
    }

    const DATE_KEYS = new Set(['date_of_birth', 'joined_date'])
    const employeePatch = {}
    for (const key of [
      'employee_id',
      'first_name',
      'middle_name',
      'last_name',
      'gender',
      'marital_status',
      'blood_group',
      'date_of_birth',
      'employee_category',
      'joined_date',
    ]) {
      if (data[key] !== undefined) {
        employeePatch[key] = DATE_KEYS.has(key) ? data[key] || null : data[key]
      }
    }
    if (Object.keys(employeePatch).length) {
      const { error } = await supabase.from('employees').update(employeePatch).eq('id', id)
      throwIfError(error, 'Failed to update employee')
    }

    if (data.contact) {
      const { error } = await supabase
        .from('employee_contacts')
        .update({
          personal_email: data.contact.personal_email,
          working_email: data.contact.working_email,
          mobile: data.contact.mobile,
          phone: data.contact.phone,
          emergency_contact_name: data.contact.emergency_contact,
        })
        .eq('employee_id', id)
      throwIfError(error, 'Failed to update contact')
    }
    if (data.address) {
      const { error } = await supabase
        .from('employee_addresses')
        .update(data.address)
        .eq('employee_id', id)
      throwIfError(error, 'Failed to update address')
    }
    if (data.employment) {
      const newDept = data.employment.department
      if (newDept && newDept !== current.employment?.department) {
        await supabase.from('employee_department_history').insert({
          employee_id: id,
          department: newDept,
        })
      }
      // reporting_to is a UUID FK — empty string must become null or Postgres throws
      // "invalid input syntax for type uuid: ''"
      const nullIfEmpty = (v) => (v && v.trim() !== '' ? v : null)
      const { error } = await supabase
        .from('employee_employment')
        .update({
          designation: data.employment.designation || '',
          designation_text: nullIfEmpty(data.employment.designation_text),
          department: nullIfEmpty(data.employment.department),
          reporting_to: nullIfEmpty(data.employment.reporting_to),
          working_region: nullIfEmpty(data.employment.working_region),
          working_state: nullIfEmpty(data.employment.working_state),
          start_date: data.employment.start_date || null,
          end_date: data.employment.end_date || null,
        })
        .eq('employee_id', id)
      throwIfError(error, 'Failed to update employment')
    }
    if (data.identification) {
      const { error } = await supabase
        .from('employee_identification')
        .update({
          pan: data.identification.pan_number,
          aadhar: data.identification.aadhar_number,
          passport: data.identification.passport_number,
          uan: data.identification.uan_number,
          esi_number: data.identification.esi_number,
          pf_number: data.identification.pf_number,
          insurance_number: data.identification.insurance_number,
        })
        .eq('employee_id', id)
      throwIfError(error, 'Failed to update identification')
    }
    if (data.bank_accounts) {
      await syncBankAccounts(id, current.bank_accounts, data.bank_accounts)
    }
    if (data.family_members) {
      await syncFamilyMembers(id, current.family_members, data.family_members)
    }

    invalidateEmployeeCache()
    return this.getById(id)
  },

  // ── updateStatus ─────────────────────────────────────────────────────────────
  async updateStatus(id, { status, exit_date, remarks }) {
    const current = await this.getById(id)
    if (!current) throw new Error('Employee not found')
    const isDeleting = status === 'Deleted'

    const { error } = await supabase
      .from('employees')
      .update({
        status: toDbStatus(status),
        exit_date: exit_date || current.exit_date || null,
        ...(isDeleting ? { deleted_at: now(), deleted_remarks: remarks || '' } : {}),
      })
      .eq('id', id)
    throwIfError(error, 'Failed to update status')

    await supabase.from('employee_status_history').insert({
      employee_id: id,
      status: toDbStatus(status),
      remarks: remarks || '',
    })

    invalidateEmployeeCache()
    return this.getById(id)
  },

  // ── setDesignation ─────────────────────────────────────────────────────────
  // Minimal, single-field designation write — used when User Management
  // registers a Project Associate login and picks their specialization, so
  // Staff & Payroll's designation (which drives PMS specialization scoping,
  // see localProjects.js) matches without touching any other employment field.
  async setDesignation(employeeCode, designation) {
    const current = await this.getById(employeeCode)
    if (!current) throw new Error('Employee not found')
    const { error } = await supabase
      .from('employee_employment')
      .update({ designation })
      .eq('employee_id', current.id)
    throwIfError(error, 'Failed to update designation')
    invalidateEmployeeCache()
  },

  // ── updateSalaryDirect ────────────────────────────────────────────────────────
  async updateSalaryDirect(
    id,
    { new_salary, effective_date, remarks, new_designation, ctc_breakdown },
  ) {
    const current = await this.getById(id)
    if (!current) throw new Error('Employee not found')

    const previous = current.current_salary || 0
    const newSal = parseFloat(new_salary)
    const amount = newSal - previous

    const { error } = await supabase
      .from('employees')
      .update({ current_salary: newSal })
      .eq('id', id)
    throwIfError(error, 'Failed to update salary')

    if (new_designation) {
      await supabase
        .from('employee_employment')
        .update({ designation: new_designation })
        .eq('employee_id', id)
    }

    await supabase.from('salary_history').insert({
      employee_id: id,
      previous_salary: previous,
      increment_pct: 0,
      increment_amount: amount,
      new_salary: newSal,
      effective_date,
      remarks: remarks || '',
      designation_changed_to: new_designation || null,
      ctc_breakdown: ctc_breakdown || null,
    })

    invalidateEmployeeCache()
    return this.getById(id)
  },

  // ── applySalaryIncrement ──────────────────────────────────────────────────────
  async applySalaryIncrement(
    id,
    { increment_percentage, effective_date, remarks, new_designation },
  ) {
    const current = await this.getById(id)
    if (!current) throw new Error('Employee not found')

    const previous = current.current_salary || 0
    const pct = parseFloat(increment_percentage)
    const amount = (previous * pct) / 100
    const newSal = previous + amount

    const { error } = await supabase
      .from('employees')
      .update({ current_salary: newSal })
      .eq('id', id)
    throwIfError(error, 'Failed to update salary')

    if (new_designation) {
      await supabase
        .from('employee_employment')
        .update({ designation: new_designation })
        .eq('employee_id', id)
    }

    await supabase.from('salary_history').insert({
      employee_id: id,
      previous_salary: previous,
      increment_pct: pct,
      increment_amount: amount,
      new_salary: newSal,
      effective_date,
      remarks: remarks || '',
      designation_changed_to: new_designation || null,
    })

    invalidateEmployeeCache()
    return this.getById(id)
  },

  // ── addFamilyMember ───────────────────────────────────────────────────────────
  async addFamilyMember(employeeId, member) {
    const { data, error } = await supabase
      .from('employee_family_members')
      .insert({ ...member, employee_id: employeeId })
      .select()
      .single()
    throwIfError(error, 'Failed to add family member')
    return data
  },

  // ── assignProject ─────────────────────────────────────────────────────────────
  // TODO(Phase 2 - Projects migration): moves to `project_officer_assignments`
  // once real `projects` rows exist in Supabase. Legacy localStorage for now.
  async assignProject(id, { project_name, assigned_date, remarks = '', assigned_by = 'HR' }) {
    const prev = readLegacyAssignments(id)
    const day = today()
    const updated = prev.map((a) =>
      a.status === 'Active' ? { ...a, status: 'Ended', end_date: assigned_date || day } : a,
    )
    const newEntry = {
      id: uid(),
      project_name,
      assigned_date: assigned_date || day,
      end_date: null,
      status: 'Active',
      remarks,
      assigned_by,
      created_at: now(),
    }
    writeLegacyAssignments(id, [...updated, newEntry])
    return this.getById(id)
  },

  // ── addBankAccount ────────────────────────────────────────────────────────────
  async addBankAccount(employeeId, account) {
    const { data, error } = await supabase
      .from('employee_bank_accounts')
      .insert({ ...account, employee_id: employeeId })
      .select()
      .single()
    throwIfError(error, 'Failed to add bank account')
    return data
  },
}
