// Supabase-backed project store (migrated from localStorage — see ADR-037,
// Phase 2 of the local*.js → Supabase migration). Keeps the same external
// object shape as the old localStorage version (officer_ids, installments,
// milestones, risks, field_personnel, pool_pct_adjustments, pool_adjustments,
// sent_allocations, monthly_plan, plan_blocks, hr_expenses/admin_expenses)
// so consumers only need to handle these calls being async now.
import supabase from './supabase'
import { localEmployees } from './localEmployees'
import {
  computeWorkingPool,
  monthsInRange,
  sumPlanTotal,
  validatePlanTotal,
  computeFlatMonthlyRate,
  validatePlanTotalWithCascade,
  computeEffectivePoolMonthly,
} from './monthlyApportionment'

const now = () => new Date().toISOString()
const today = () => now().split('T')[0]

// Month columns (project_monthly_plan.month, project_pool_adjustments.month/
// counter_month, project_sent_allocations.month, project_pool_pct_adjustments
// .from_month, project_expenses.month) are Postgres `date`, but the app works
// in "YYYY-MM" keys throughout — convert at the DB boundary in both directions.
const toDbMonth = (m) => (m && m.length === 7 ? `${m}-01` : m)
const fromDbMonth = (m) => (m ? String(m).slice(0, 7) : m)

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

/**
 * Fires a same-tab CustomEvent AND writes a localStorage key so cross-tab
 * listeners (the Consolidated Report, Apportionment Sheet, etc.) also
 * pick up the change immediately without polling.
 */
const notifyProjectChanged = () => {
  try {
    window.dispatchEvent(new CustomEvent('hma_projects_changed'))
    localStorage.setItem('hma_projects_sync_at', Date.now().toString())
  } catch {
    // non-browser environment (tests, SSR) — silently skip
  }
}

// uc_status: DB enum is lowercase ('pending'|'submitted'|'approved'); the app's
// shape has always used Title-case strings — preserved here, same as employee status.
// project_milestones.uc_status is still this real enum column, read-only in
// this app (no write path exists), which is why only the FROM_DB direction
// is still needed here.
const UC_FROM_DB = { pending: 'Pending', submitted: 'Submitted', approved: 'Approved' }
const fromDbUc = (s) => UC_FROM_DB[s] || 'Pending'

// project_installments.uc_status is now a plain text column (migration 33) —
// the edit form's UC Status field takes any text, not just the fixed three
// values. Store/read verbatim instead of coercing through the enum map, but
// still recognize the old lowercase enum values on read so historical rows
// (written back when this was still an enum) keep displaying Title-case.
const toDbUcText = (s) => (s && s.trim()) || 'Pending'
const fromDbUcText = (s) => UC_FROM_DB[s] || s || 'Pending'

export const PROJECT_PHASE = {
  PIPELINE: 'pipeline',
  APPROVED: 'approved',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
}

export const PHASE_CONFIG = {
  pipeline: { label: 'Pipeline', color: 'secondary' },
  approved: { label: 'Approved', color: 'info' },
  ongoing: { label: 'Ongoing', color: 'primary' },
  completed: { label: 'Completed', color: 'success' },
  implementation: { label: 'Implementation', color: 'primary' },
  design: { label: 'Design', color: 'info' },
}

// ─── PA Specialization ──────────────────────────────────────────────────────
// A Project Associate's project-type specialization is fixed by their employee
// designation rather than a separate stored field, so it can't drift out of
// sync with Staff & Payroll.
const PA_SPECIALIZATION_BY_DESIGNATION = {
  'project associate (community development)': 'community_development',
  'project associate (public health)': 'public_health',
}

const specializationFromDesignation = (designation) => {
  const d = (designation || '').toLowerCase()
  for (const [key, value] of Object.entries(PA_SPECIALIZATION_BY_DESIGNATION)) {
    if (d.includes(key)) return value
  }
  return null
}

// Same category mapping `list({ dept })` uses — one source of truth so a PA's
// specialization and the dept-filter query param always agree. Pure/sync — no
// DB access — so consumers using it inside array callbacks don't need to await.
const specializationMatchesProjectType = (specialization, projectType) => {
  const t = (projectType || '').toLowerCase()
  if (specialization === 'community_development') {
    return (
      t.includes('consultancy') ||
      t.includes('community') ||
      t.includes('m cup') ||
      t.includes('mcup')
    )
  }
  if (specialization === 'public_health') {
    return t.includes('public health') || t.includes('health')
  }
  return false
}

// Full employee roster, reused from the already-migrated Employees service
// rather than re-querying `employees` directly — keeps one source of truth for
// the shape (designation, contact, status) behind designation-matching helpers.
const getAllEmployeesLite = async () => {
  const { items } = await localEmployees.list({ pageSize: 1000, includeDeleted: true })
  return items
}

/** A Project Associate's fixed specialization, derived from their employee designation. */
const getPaSpecialization = async (employeeCode) => {
  if (!employeeCode) return null
  const employees = await getAllEmployeesLite()
  const employee = employees.find((e) => e.employee_id === employeeCode)
  return specializationFromDesignation(employee?.employment?.designation)
}

/** Both Project Associate employees, for the Coordinator's reassignment control.
 *  Matches employees whose designation explicitly names a specialization, OR any
 *  employee whose designation simply contains "project associate" (without a
 *  parenthesised specialization — e.g. just "Project Associate"). The latter
 *  produces a null specialization, meaning they are visible in the coordinator's
 *  dropdown but will only appear in the PA's own view via the explicit
 *  project_associate_id assignment, not via specialization-matching.
 */
const listPaEmployees = async () => {
  const employees = await getAllEmployeesLite()
  return employees
    .filter((e) => {
      const d = (e.employment?.designation || '').toLowerCase()
      // Accept any designation that includes "project associate" — specialisation
      // suffix is optional (e.g. "Project Associate" without "(Community…)" still qualifies).
      return d.includes('project associate')
    })
    .map((e) => ({
      // The real employees.id UUID — project.project_associate_id is a genuine
      // FK now, not the human-readable employee code.
      employee_id: e.id,
      name: e.employee_name,
      specialization: specializationFromDesignation(e.employment?.designation),
    }))
}

/** Resolves a human-readable employee code (e.g. "ADMIN001") to its employees.id UUID. */
const resolveEmployeeUuidByCode = async (code) => {
  if (!code) return null
  const { data } = await supabase
    .from('employees')
    .select('id')
    .eq('employee_id', code)
    .maybeSingle()
  return data?.id || null
}

const employeeName = (e) =>
  e ? [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ') : null

const PROJECT_SELECT = `
  *,
  operations_activated_month,
  operations_activated_at,
  project_officer_assignments(
    employee_id,
    employees(id, first_name, middle_name, last_name, employee_contacts(working_email, personal_email))
  ),
  project_installments(*, project_installment_extra_ucs(*)),
  project_milestones(*),
  project_risks(*),
  project_field_personnel(*),
  project_notes(*),
  project_personnel_details(*),
  project_activities(*),
  project_pool_pct_adjustments(*),
  project_monthly_plan(*, project_monthly_plan_phases(*)),
  project_pool_adjustments(*, employees(first_name, middle_name, last_name)),
  project_sent_allocations(*, employees(first_name, middle_name, last_name)),
  project_plan_blocks(blocks),
  project_expenses(*)
`

const toExtraUcShape = (row) => ({
  id: row.id,
  uc_status: fromDbUcText(row.uc_status),
  uc_target_date: row.uc_target_date || null,
  actual_uc_submission_date: row.actual_uc_submission_date || null,
})

const toInstallmentShape = (row) => ({
  id: row.id,
  label: row.label,
  percentage: row.percentage,
  amount: row.amount,
  phase_name: row.phase_name,
  start_date: row.start_date,
  end_date: row.target_date,
  target_date: row.target_date,
  actual_date: row.actual_date,
  uc_status: fromDbUcText(row.uc_status),
  // UC tracking fields (added in migration 26)
  payment_received_date: row.payment_received_date || null,
  uc_target_date: row.uc_target_date || null,
  actual_uc_submission_date: row.actual_uc_submission_date || null,
  documents_checklist: Array.isArray(row.documents_checklist) ? row.documents_checklist : [],
  // Additional UCs beyond the first — an installment can span a financial-year
  // break and need more than one UC (issue #138). Empty unless the caller's
  // select included project_installment_extra_ucs.
  extra_ucs: (row.project_installment_extra_ucs || [])
    .slice()
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map(toExtraUcShape),
})

const toMilestoneShape = (row) => ({
  id: row.id,
  title: row.title,
  amount: row.amount,
  target_date: row.target_date,
  actual_date: row.actual_date,
  uc_status: fromDbUc(row.uc_status),
})

const toRiskShape = (row) => ({
  id: row.id,
  title: row.title,
  severity: row.severity,
  status: row.status,
})

const toFieldPersonnelShape = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  status: row.status,
  invited_at: row.invited_at,
})

const toNoteShape = (row) => ({
  id: row.id,
  note: row.note,
  created_at: row.created_at,
})

const toPersonnelDetailShape = (row) => ({
  id: row.id,
  name: row.name,
  age: row.age,
  phone: row.phone,
  created_at: row.created_at,
})

const toActivityShape = (row) => ({
  id: row.id,
  description: row.description,
  target_date: row.target_date,
  risk_challenges: row.risk_challenges,
  status: row.status,
  created_at: row.created_at,
  updated_at: row.updated_at,
})

const toPoolPctAdjShape = (row) => ({
  from_month: fromDbMonth(row.from_month),
  hr_pct: row.hr_pct,
  core_pct: row.core_pct,
})

const toPoolAdjShape = (row) => ({
  id: row.id,
  pool: row.pool,
  month: fromDbMonth(row.month),
  amount: row.amount,
  source: row.source,
  reason: row.reason,
  counterMonth: fromDbMonth(row.counter_month),
  created_by: row.created_by, // raw uuid, kept so downstream recomputation can round-trip it
  createdBy:
    employeeName(row.employees) ||
    (row.source === 'auto_cascade' || row.source === 'actual_pull' ? 'System' : 'Unknown'),
  createdAt: row.created_at,
})

const toSentAllocShape = (row) => ({
  id: row.id,
  pool: row.pool,
  month: fromDbMonth(row.month),
  amount: row.amount,
  sentBy: employeeName(row.employees) || 'Unknown',
  sentAt: row.sent_at,
})

const toExpenseShape = (row) => ({
  id: row.id,
  label: row.label,
  amount: row.amount,
  date: row.expense_date,
  month: fromDbMonth(row.month),
  created_at: row.created_at,
})

const toMonthlyPlanShape = (row) => ({
  month: fromDbMonth(row.month),
  total: row.total,
  phases: (row.project_monthly_plan_phases || []).map((ph) => ({
    id: ph.id,
    phase: ph.phase,
    name: ph.name,
    amount: ph.amount,
    actual: ph.actual,
  })),
})

const toProjectShape = (row) => {
  const officerAssignments = row.project_officer_assignments || []
  const officerIds = officerAssignments.map((a) => a.employee_id)
  const primaryOfficer = officerAssignments[0]?.employees || null
  const milestones = (row.project_milestones || []).map(toMilestoneShape)
  const monthlyPlan = (row.project_monthly_plan || [])
    .slice()
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(toMonthlyPlanShape)
  const expenses = row.project_expenses || []
  const planBlocksRaw = row.project_plan_blocks
  const planBlocks = Array.isArray(planBlocksRaw) ? planBlocksRaw[0]?.blocks : planBlocksRaw?.blocks

  return {
    id: row.id,
    project_code: row.project_code || '',
    project_type: row.project_type,
    name: row.title,
    title: row.title,
    description: row.description,
    funding_agency: row.funding_agency,
    implementing_partner: row.implementing_partner,
    location: row.location,
    district: row.district,
    status: row.status,
    phase: row.phase,
    project_value: Number(row.project_value) || 0,
    project_valuation: Number(row.project_value) || 0,
    amount_received: Number(row.amount_received) || 0,
    amount_released: Number(row.amount_received) || 0,
    amount_sanctioned: Number(row.amount_sanctioned) || 0,
    amount_spent: Number(row.amount_spent) || 0,
    amount_utilized: Number(row.amount_utilized) || 0,
    expense_accounted: Number(row.expense_accounted) || 0,
    committed_expense: Number(row.committed_expense) || 0,
    start_date: row.start_date,
    end_date: row.end_date,
    beneficiaries_target: row.beneficiaries_target || 0,
    beneficiaries_completed: row.beneficiaries_completed || 0,

    // Legacy single-officer fields, derived from the join table (no longer stored columns).
    officer_id: officerIds[0] || null,
    assigned_officer_id: officerIds[0] || null,
    officer_name: primaryOfficer ? employeeName(primaryOfficer) : null,
    officer_email: primaryOfficer
      ? primaryOfficer.employee_contacts?.working_email ||
        primaryOfficer.employee_contacts?.personal_email ||
        null
      : null,
    officer_ids: officerIds,
    email_sent: officerIds.length > 0,

    project_associate_id: row.project_associate_id,
    field_personnel: (row.project_field_personnel || []).map(toFieldPersonnelShape),
    notes: (row.project_notes || [])
      .map(toNoteShape)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    personnel_details: (row.project_personnel_details || []).map(toPersonnelDetailShape),
    activities: (row.project_activities || [])
      .map(toActivityShape)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),

    core_pct: row.core_pct ?? 5,
    hr_pct: row.hr_pct ?? 5,
    admin_pct: row.admin_pct ?? 5,
    remarks: row.remarks || '',

    milestones,
    installments: (row.project_installments || []).map(toInstallmentShape),
    risks: (row.project_risks || []).map(toRiskShape),
    pool_pct_adjustments: (row.project_pool_pct_adjustments || [])
      .slice()
      .sort((a, b) => a.from_month.localeCompare(b.from_month))
      .map(toPoolPctAdjShape),
    pool_adjustments: (row.project_pool_adjustments || []).map(toPoolAdjShape),
    sent_allocations: (row.project_sent_allocations || []).map(toSentAllocShape),
    monthly_plan: monthlyPlan,
    plan_blocks: planBlocks || [],
    hr_expenses: expenses.filter((e) => e.pool === 'hr').map(toExpenseShape),
    admin_expenses: expenses.filter((e) => e.pool === 'admin').map(toExpenseShape),

    // Not backed by real columns — no CRUD ever wrote these beyond CSV demo
    // data in the pre-migration version. Derived so old readers keep working.
    tasks_count: milestones.length,
    tasks_completed: milestones.filter((m) => m.uc_status === 'Approved').length,
    pending_approvals: 0,

    // HR/Core activation fields — set by activateProject() in PMS.
    // Null means HR/Core pool budgets are frozen at ₹0 for this project.
    operations_activated_month: row.operations_activated_month
      ? String(row.operations_activated_month).slice(0, 7)
      : null,
    operations_activated_at: row.operations_activated_at || null,

    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/**
 * Resolves the Project Associate "corresponding" to a project: the explicit
 * project_associate_id assignment if one was made, otherwise whichever PA's
 * fixed specialization matches the project's type (same matching used to
 * scope a PA's own project visibility).
 */
const attachPaNames = async (projects) => {
  const paEmployees = await listPaEmployees()
  return projects.map((p) => {
    const assigned = paEmployees.find((pa) => pa.employee_id === p.project_associate_id)
    const bySpecialization = paEmployees.find((pa) =>
      specializationMatchesProjectType(pa.specialization, p.project_type),
    )
    return { ...p, project_associate_name: assigned?.name || bySpecialization?.name || null }
  })
}

// ── In-memory deduplication cache ───────────────────────────────────────────
// Widgets on the dashboard all call fetchAllProjects() on mount simultaneously,
// which would fire N identical heavy Supabase queries at once. This cache holds
// the *in-flight promise* for up to CACHE_TTL_MS, so subsequent callers within
// that window share the same request — no duplicate DB round-trips.
// The cache is busted immediately on any write (create/update/remove/…) so data
// is never stale beyond a single mutation.
const CACHE_TTL_MS = 5000 // 5 seconds
let _allProjectsCache = null // { promise, setAt }

const bustProjectsCache = () => {
  _allProjectsCache = null
}

const fetchAllProjects = () => {
  const now = Date.now()
  if (_allProjectsCache && now - _allProjectsCache.setAt < CACHE_TTL_MS) {
    return _allProjectsCache.promise
  }
  const promise = supabase
    .from('projects')
    .select(PROJECT_SELECT)
    .then(({ data, error }) => {
      throwIfError(error, 'Failed to load projects')
      return attachPaNames((data || []).map(toProjectShape))
    })
    .catch((err) => {
      // Don't hold a failed promise in cache
      _allProjectsCache = null
      throw err
    })
  _allProjectsCache = { promise, setAt: now }
  return promise
}

// ── Slim select for dashboard reads ─────────────────────────────────────────
// Widgets that only need scalar fields + installments/monthly plan use this
// much lighter query (no officer join, no expenses, no pool adjustments).
// Uses the same 5-second cache as fetchAllProjects but as a separate cache.
const PROJECT_SELECT_SLIM = `
  id, title, project_code, project_type, status, phase,
  project_value, amount_received, amount_sanctioned,
  amount_spent, amount_utilized, expense_accounted, committed_expense,
  start_date, end_date, location, district,
  beneficiaries_target, beneficiaries_completed,
  core_pct, hr_pct, admin_pct, remarks,
  project_associate_id, created_at, updated_at,
  operations_activated_month,
  operations_activated_at,
  project_installments(*),
  project_monthly_plan(month, total),
  project_pool_pct_adjustments(*)
`

let _dashboardProjectsCache = null // { promise, setAt }

const bustDashboardProjectsCache = () => {
  _dashboardProjectsCache = null
}

const toDashboardProjectShape = (row) => ({
  id: row.id,
  project_code: row.project_code || '',
  project_type: row.project_type,
  name: row.title,
  title: row.title,
  status: row.status,
  phase: row.phase,
  project_value: Number(row.project_value) || 0,
  project_valuation: Number(row.project_value) || 0,
  amount_received: Number(row.amount_received) || 0,
  amount_released: Number(row.amount_received) || 0,
  amount_sanctioned: Number(row.amount_sanctioned) || 0,
  amount_spent: Number(row.amount_spent) || 0,
  amount_utilized: Number(row.amount_utilized) || 0,
  expense_accounted: Number(row.expense_accounted) || 0,
  committed_expense: Number(row.committed_expense) || 0,
  start_date: row.start_date,
  end_date: row.end_date,
  location: row.location,
  district: row.district,
  beneficiaries_target: row.beneficiaries_target || 0,
  beneficiaries_completed: row.beneficiaries_completed || 0,
  core_pct: row.core_pct ?? 5,
  hr_pct: row.hr_pct ?? 5,
  admin_pct: row.admin_pct ?? 5,
  remarks: row.remarks || '',
  project_associate_id: row.project_associate_id,
  created_at: row.created_at,
  updated_at: row.updated_at,
  // Needed by buildProjectMonthlyBreakdown
  installments: (row.project_installments || []).map(toInstallmentShape),
  monthly_plan: (row.project_monthly_plan || [])
    .slice()
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({ month: fromDbMonth(m.month), total: m.total, phases: [] })),
  pool_pct_adjustments: (row.project_pool_pct_adjustments || [])
    .slice()
    .sort((a, b) => a.from_month.localeCompare(b.from_month))
    .map(toPoolPctAdjShape),
  // HR/Core activation fields — needed by buildProjectMonthlyBreakdown().
  operations_activated_month: row.operations_activated_month
    ? String(row.operations_activated_month).slice(0, 7)
    : null,
  operations_activated_at: row.operations_activated_at || null,
  // Stub fields so consumers don't crash
  officer_ids: [],
  officer_id: null,
  field_personnel: [],
  pool_adjustments: [],
  sent_allocations: [],
  plan_blocks: [],
  milestones: [],
  risks: [],
  hr_expenses: [],
  admin_expenses: [],
  tasks_count: 0,
  tasks_completed: 0,
  pending_approvals: 0,
})

const fetchDashboardProjects = () => {
  const now = Date.now()
  if (_dashboardProjectsCache && now - _dashboardProjectsCache.setAt < CACHE_TTL_MS) {
    return _dashboardProjectsCache.promise
  }
  const promise = supabase
    .from('projects')
    .select(PROJECT_SELECT_SLIM)
    .then(({ data, error }) => {
      throwIfError(error, 'Failed to load dashboard projects')
      return (data || []).map(toDashboardProjectShape)
    })
    .catch((err) => {
      _dashboardProjectsCache = null
      throw err
    })
  _dashboardProjectsCache = { promise, setAt: now }
  return promise
}

export const localProjects = {
  getPaSpecialization,
  specializationMatchesProjectType,
  listPaEmployees,
  resolveEmployeeUuidByCode,

  // No-op — projects now live in Supabase; every page used to call this as a
  // "make sure demo data exists" guard before reading localStorage. Kept as a
  // harmless no-arg call so the ~20 existing call sites don't need touching.
  seedDemoData() {},

  async list({
    search = '',
    status = '',
    phase = '',
    officerId = '',
    paId = '',
    dept = '',
    specialization = '',
    page = 1,
    pageSize = 50,
  } = {}) {
    let items = await fetchAllProjects()
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(
        (p) =>
          (p.name || p.title)?.toLowerCase().includes(q) ||
          p.location?.toLowerCase().includes(q) ||
          p.officer_name?.toLowerCase().includes(q) ||
          p.funding_agency?.toLowerCase().includes(q),
      )
    }
    if (status) items = items.filter((p) => p.status === status)
    if (phase) items = items.filter((p) => p.phase === phase)
    if (officerId) items = items.filter((p) => (p.officer_ids || []).includes(officerId))
    if (dept) items = items.filter((p) => specializationMatchesProjectType(dept, p.project_type))
    if (specialization || paId) {
      // A PA's own scoped view: their specialization's projects, PLUS anything
      // the Coordinator explicitly assigned to them (by UUID) outside that
      // specialization. When specialization is null/empty (PA designation doesn't
      // carry a recognised suffix), fall back to showing only explicitly-assigned
      // projects so the list is never empty for a PA who has been assigned projects.
      items = items.filter(
        (p) =>
          (specialization && specializationMatchesProjectType(specialization, p.project_type)) ||
          (paId && p.project_associate_id === paId),
      )
    }

    items = [...items].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    const total = items.length
    const total_pages = Math.max(1, Math.ceil(total / pageSize))
    const start = (page - 1) * pageSize
    return { items: items.slice(start, start + pageSize), total, total_pages }
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('projects')
      .select(PROJECT_SELECT)
      .eq('id', id)
      .maybeSingle()
    throwIfError(error, 'Failed to load project')
    if (!data) return null
    const [withPaName] = await attachPaNames([toProjectShape(data)])
    return withPaName
  },

  /** Same as getById but also fires the cross-component change notification.
   *  Every public write method returns through this so the Consolidated
   *  Report, Apportionment Sheet, and any other listener auto-refreshes.
   *  Also busts the in-memory cache so the next dashboard read is fresh. */
  async _notifyingGetById(id) {
    bustProjectsCache()
    bustDashboardProjectsCache()
    const project = await this.getById(id)
    notifyProjectChanged()
    return project
  },

  /**
   * Lightweight project list for dashboard widgets.
   * Uses a slimmer DB select (no officer join, no pool adjustments, no expenses)
   * and a shared 5-second in-memory cache so all widgets on the same page share
   * one Supabase round-trip instead of firing N identical queries simultaneously.
   *
   * Returns the full allProjects array (no pagination — dashboard always wants all).
   * Shape includes: scalar project fields, installments, monthly_plan, pool_pct_adjustments.
   */
  async dashboardList() {
    const items = await fetchDashboardProjects()
    return items.slice().sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
  },

  async getByOfficer(officerId) {
    const items = await fetchAllProjects()
    return items
      .filter((p) => (p.officer_ids || []).includes(officerId))
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
  },

  async getByPersonnelEmail(email) {
    if (!email) return []
    const items = await fetchAllProjects()
    return items
      .filter((p) => p.field_personnel?.some((fp) => fp.email === email))
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
  },

  /**
   * Replaces every installment (and their extra UCs beyond the first) for a
   * project. Shared by create() and update() — both fully replace the
   * installment set rather than diffing, same pattern pool_expense
   * allocations use elsewhere in this file. `.select()` on the installments
   * insert is required here (unlike the old code) so the newly-generated
   * installment ids are available to attach extra_ucs rows to.
   */
  async _saveInstallments(projectId, installments) {
    if (!installments?.length) return

    const { data: insertedInstallments, error: instErr } = await supabase
      .from('project_installments')
      .insert(
        installments.map((inst) => ({
          project_id: projectId,
          label: inst.label || null,
          percentage: parseFloat(inst.percentage) || 0,
          amount: parseFloat(inst.amount) || 0,
          phase_name: inst.phase_name || null,
          start_date: inst.start_date || null,
          target_date: inst.end_date || inst.target_date || null,
          actual_date: inst.actual_date || null,
          uc_status: toDbUcText(inst.uc_status),
          // UC tracking fields (migration 26)
          payment_received_date: inst.payment_received_date || null,
          uc_target_date: inst.uc_target_date || null,
          actual_uc_submission_date: inst.actual_uc_submission_date || null,
          documents_checklist: Array.isArray(inst.documents_checklist)
            ? inst.documents_checklist
            : [],
        })),
      )
      .select()
    throwIfError(instErr, 'Failed to save installments')

    // Supabase returns inserted rows in the same order they were given, so
    // index-zip back against the source installments to find each one's
    // extra_ucs (issue #138 — an installment spanning a financial-year break
    // may need more than one Utilization Certificate).
    const extraUcRows = installments.flatMap((inst, i) =>
      (inst.extra_ucs || []).map((uc, j) => ({
        installment_id: insertedInstallments[i].id,
        uc_status: toDbUcText(uc.uc_status),
        uc_target_date: uc.uc_target_date || null,
        actual_uc_submission_date: uc.actual_uc_submission_date || null,
        sort_order: j,
      })),
    )
    if (extraUcRows.length) {
      const { error: ucErr } = await supabase
        .from('project_installment_extra_ucs')
        .insert(extraUcRows)
      throwIfError(ucErr, 'Failed to save additional UCs')
    }
  },

  async create(data) {
    const { data: inserted, error } = await supabase
      .from('projects')
      .insert({
        project_code: data.project_code || null,
        project_type: data.project_type || null,
        title: data.title || data.name || 'Untitled Project',
        description: data.description || null,
        funding_agency: data.funding_agency || null,
        implementing_partner: data.implementing_partner || null,
        location: data.location || null,
        district: data.district || null,
        status: data.status || 'pipeline',
        phase: data.phase || 'pipeline',
        project_value: parseFloat(data.project_valuation || data.project_value) || 0,
        amount_received: parseFloat(data.amount_received || data.amount_released) || 0,
        amount_sanctioned: parseFloat(data.amount_sanctioned) || 0,
        amount_spent: parseFloat(data.amount_spent || data.amount_utilized) || 0,
        amount_utilized: parseFloat(data.amount_spent || data.amount_utilized) || 0,
        expense_accounted: parseFloat(data.expense_accounted) || 0,
        committed_expense: parseFloat(data.committed_expense) || 0,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        beneficiaries_target: parseInt(data.beneficiaries_target, 10) || 0,
        beneficiaries_completed: parseInt(data.beneficiaries_completed, 10) || 0,
        project_associate_id: data.project_associate_id || null,
        core_pct: data.core_pct ?? 5,
        hr_pct: data.hr_pct ?? 5,
        admin_pct: data.admin_pct ?? 5,
        remarks: data.remarks || null,
      })
      .select()
      .single()
    throwIfError(error, 'Failed to create project')

    const projectId = inserted.id

    await this._saveInstallments(projectId, data.installments)

    return this._notifyingGetById(projectId)
  },

  async update(id, data) {
    const current = await this.getById(id)
    if (!current) throw new Error('Project not found')

    const patch = {}
    const directFields = {
      project_code: 'project_code',
      project_type: 'project_type',
      title: 'title',
      name: 'title',
      description: 'description',
      funding_agency: 'funding_agency',
      implementing_partner: 'implementing_partner',
      location: 'location',
      district: 'district',
      status: 'status',
      phase: 'phase',
      start_date: 'start_date',
      end_date: 'end_date',
      remarks: 'remarks',
      project_associate_id: 'project_associate_id',
    }
    for (const [key, col] of Object.entries(directFields)) {
      if (data[key] !== undefined) patch[col] = data[key] || null
    }
    const numericFields = {
      project_value: 'project_value',
      project_valuation: 'project_value',
      amount_received: 'amount_received',
      amount_released: 'amount_received',
      amount_sanctioned: 'amount_sanctioned',
      amount_spent: 'amount_spent',
      amount_utilized: 'amount_utilized',
      expense_accounted: 'expense_accounted',
      committed_expense: 'committed_expense',
      core_pct: 'core_pct',
      hr_pct: 'hr_pct',
      admin_pct: 'admin_pct',
    }
    for (const [key, col] of Object.entries(numericFields)) {
      if (data[key] !== undefined) patch[col] = parseFloat(data[key]) || 0
    }
    const intFields = {
      beneficiaries_target: 'beneficiaries_target',
      beneficiaries_completed: 'beneficiaries_completed',
    }
    for (const [key, col] of Object.entries(intFields)) {
      if (data[key] !== undefined) patch[col] = parseInt(data[key], 10) || 0
    }

    if (Object.keys(patch).length) {
      const { error } = await supabase.from('projects').update(patch).eq('id', id)
      throwIfError(error, 'Failed to update project')
    }

    if (data.installments !== undefined) {
      // Extra UC rows cascade-delete with their installment (on delete cascade).
      await supabase.from('project_installments').delete().eq('project_id', id)
      await this._saveInstallments(id, data.installments)
    }

    return this._notifyingGetById(id)
  },

  /**
   * Permanently removes a project. Cascades for planning/assignment child
   * rows (see migrations for the `on delete cascade` set), but financial and
   * compliance records — expenses, pool allocations, GST, LSGB — are kept on
   * `restrict` deletion by design, so we check for those first and refuse
   * with a specific message rather than surfacing a raw Postgres 23503.
   * Irreversible — callers must confirm first.
   */
  async remove(id) {
    const current = await this.getById(id)
    if (!current) throw new Error('Project not found')

    const blockers = [
      { table: 'project_expenses', column: 'project_id', label: 'project expense' },
      { table: 'pool_expense_allocations', column: 'project_id', label: 'pool expense allocation' },
      { table: 'admin_pool_credits', column: 'project_id', label: 'admin pool credit' },
      {
        table: 'pool_expenses',
        column: 'entered_by_project_id',
        label: 'HR/Admin/Core pool expense entry',
      },
      { table: 'gst_batches', column: 'project_id', label: 'GST batch' },
      { table: 'gst_entries', column: 'project_id', label: 'GST entry' },
      { table: 'lsgb_bodies', column: 'project_id', label: 'LSGB body' },
      { table: 'lsgb_fund_withdrawals', column: 'project_id', label: 'LSGB fund withdrawal' },
      { table: 'lsgb_work_orders', column: 'project_id', label: 'LSGB work order' },
    ]

    const counts = await Promise.all(
      blockers.map(async ({ table, column }) => {
        const { count, error } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq(column, id)
        throwIfError(error, `Failed to check ${table} before delete`)
        return count || 0
      }),
    )

    const present = blockers.map((b, i) => ({ ...b, count: counts[i] })).filter((b) => b.count > 0)

    if (present.length) {
      const detail = present
        .map((b) => `${b.count} ${b.label}${b.count === 1 ? '' : 's'}`)
        .join(', ')
      throw new Error(
        `Cannot delete "${current.name || 'this project'}": it still has ${detail}. Remove or reassign those records first.`,
      )
    }

    const { error } = await supabase.from('projects').delete().eq('id', id)
    throwIfError(error, 'Failed to delete project')
    bustProjectsCache()
    bustDashboardProjectsCache()
    notifyProjectChanged()
    return current
  },

  // ── Monthly Planning ────────────────────────────────────────────────────────

  async _persistMonthlyPlan(projectId, monthlyPlan) {
    await supabase.from('project_monthly_plan').delete().eq('project_id', projectId)
    if (!monthlyPlan.length) return

    const { data: inserted, error } = await supabase
      .from('project_monthly_plan')
      .insert(
        monthlyPlan.map((m) => ({
          project_id: projectId,
          month: toDbMonth(m.month),
          total: m.total,
        })),
      )
      .select()
    throwIfError(error, 'Failed to save monthly plan')

    const phaseRows = []
    inserted.forEach((row) => {
      const source = monthlyPlan.find((m) => m.month === fromDbMonth(row.month))
      ;(source?.phases || []).forEach((ph) => {
        phaseRows.push({
          monthly_plan_id: row.id,
          phase: ph.phase || null,
          name: ph.name || null,
          amount: parseFloat(ph.amount) || 0,
          actual: ph.actual != null ? parseFloat(ph.actual) : null,
        })
      })
    })
    if (phaseRows.length) {
      const { error: phaseErr } = await supabase
        .from('project_monthly_plan_phases')
        .insert(phaseRows)
      throwIfError(phaseErr, 'Failed to save monthly plan phases')
    }
  },

  async _persistPlanBlocks(projectId, blocks) {
    const { error } = await supabase
      .from('project_plan_blocks')
      .upsert({ project_id: projectId, blocks }, { onConflict: 'project_id' })
    throwIfError(error, 'Failed to save plan blocks')
  },

  /**
   * Re-derives this project's auto_cascade/actual_pull pool_adjustments from
   * its currently-stored monthly_plan, server-side. The cascade/transfer math
   * (see monthlyApportionment.js for the documented algorithm) runs inside
   * supabase/functions/apportionment-engine, which writes the result with the
   * service-role key — project_pool_adjustments' RLS
   * (00000000000054_lock_pool_adjustments_writes.sql) no longer permits a
   * client to write these two sources directly, so this call is the only way
   * they get updated.
   */
  async _recomputeAutoPoolAdjustments(projectId) {
    const { error } = await supabase.functions.invoke('apportionment-engine', {
      body: { projectId },
    })
    if (error) throw new Error(`Failed to recompute pool adjustments: ${error.message}`)
  },

  /**
   * Builds project.monthly_plan from one or more independently-planned
   * "blocks" — each a contiguous month range with its own phase breakdown,
   * replicated identically across every month in that block's range. Months
   * not covered by any block start as empty stubs. See the original
   * localStorage implementation's docstring for full behavior — unchanged
   * here, just persisted against Supabase instead of a localStorage blob.
   */
  async generateMonthlyPlan(projectId, blocks) {
    const project = await this.getById(projectId)
    if (!project) throw new Error('Project not found')

    const months = monthsInRange(project.start_date, project.end_date)
    if (months.length === 0) {
      throw new Error('Project must have a start_date and end_date before generating a plan')
    }
    const monthSet = new Set(months)

    const stampedBlocks = blocks.map((b) => ({
      id: b.id || `blk_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      startMonth: b.startMonth,
      endMonth: b.endMonth,
      phases: b.phases.map((ph) => ({ ...ph, amount: parseFloat(ph.amount) || 0 })),
    }))

    const blockedMonthEntries = []
    const claimedBy = {}

    for (const block of stampedBlocks) {
      const blockMonths = monthsInRange(block.startMonth, block.endMonth)
      if (blockMonths.length === 0) {
        throw new Error(`Block has an invalid month range (${block.startMonth}–${block.endMonth}).`)
      }
      for (const m of blockMonths) {
        if (!monthSet.has(m)) {
          throw new Error(
            `Block ${block.startMonth}–${block.endMonth} falls outside the project's duration ` +
              `(${months[0]}–${months[months.length - 1]}).`,
          )
        }
        if (claimedBy[m]) {
          throw new Error(
            `Month ${m} is covered by more than one block ` +
              `(${claimedBy[m]} and ${block.startMonth}–${block.endMonth}).`,
          )
        }
        claimedBy[m] = `${block.startMonth}–${block.endMonth}`
      }
      const total = Math.round(block.phases.reduce((s, ph) => s + ph.amount, 0) * 100) / 100
      for (const m of blockMonths) {
        blockedMonthEntries.push({ month: m, phases: block.phases.map((ph) => ({ ...ph })), total })
      }
    }

    const workingPool = computeWorkingPool(project)
    const blockedTotal = sumPlanTotal(blockedMonthEntries)
    const remainingMonths = months.filter((m) => !claimedBy[m])

    let monthlyPlan
    if (remainingMonths.length === 0) {
      monthlyPlan = months.map((m) => blockedMonthEntries.find((e) => e.month === m))
      const { valid, planTotal, diff } = validatePlanTotal(monthlyPlan, workingPool)
      if (!valid) {
        throw new Error(
          `Plan total (${planTotal}) does not match the project baseline (${workingPool}) — ` +
            `difference of ${diff}. Adjust the block amounts and try again.`,
        )
      }
    } else {
      if (blockedTotal > workingPool) {
        throw new Error(
          `Blocked months' total (₹${blockedTotal}) already exceeds the project baseline ` +
            `(₹${workingPool}) — reduce block amounts.`,
        )
      }
      const remainingEntries = remainingMonths.map((month) => ({ month, phases: [], total: 0 }))
      monthlyPlan = months.map(
        (m) =>
          blockedMonthEntries.find((e) => e.month === m) ||
          remainingEntries.find((e) => e.month === m),
      )
    }

    await this._persistMonthlyPlan(projectId, monthlyPlan)
    await this._persistPlanBlocks(projectId, stampedBlocks)
    return this._notifyingGetById(projectId)
  },

  /**
   * Bridges a submitted localBudgetPlan (the PMS "Monthly Plan" tab's own
   * store, entirely separate from this project record) into this project's
   * monthly_plan — the field EMS's Consolidated Sheet, Apportionment Sheet,
   * and Project Expenses page all read. Called once, right after budget
   * plan submit, so the project stops looking empty in EMS. Does not touch
   * sent_allocations — pool amounts still require an explicit send.
   */
  async syncMonthlyPlanFromBudgetPlan(projectId, monthlyPlan) {
    await this._persistMonthlyPlan(projectId, monthlyPlan)
    return this._notifyingGetById(projectId)
  },

  /**
   * Replaces one month's phase line items, then recomputes auto_cascade and
   * actual_pull pool_adjustments from scratch against the updated plan.
   * Manual (and any other non-system-sourced) adjustments are left untouched
   * in the database — only the system-generated rows are replaced. Does not
   * block on an unbalanced total; the returned `validation` field tells the
   * caller whether the overall plan still balances.
   */
  async updateMonthPlan(projectId, month, phases) {
    const project = await this.getById(projectId)
    if (!project) throw new Error('Project not found')
    const plan = project.monthly_plan || []
    const mIdx = plan.findIndex((m) => m.month === month)
    if (mIdx === -1) throw new Error(`Month ${month} not found in plan`)

    const total =
      Math.round(phases.reduce((s, ph) => s + (parseFloat(ph.amount) || 0), 0) * 100) / 100
    const updatedPlan = [...plan]
    updatedPlan[mIdx] = { ...updatedPlan[mIdx], phases, total }

    await this._persistMonthlyPlan(projectId, updatedPlan)
    await this._recomputeAutoPoolAdjustments(projectId)

    const refreshed = await this._notifyingGetById(projectId)
    const validation = validatePlanTotalWithCascade(
      updatedPlan,
      computeWorkingPool(refreshed),
      refreshed.pool_adjustments,
    )
    return { project: refreshed, validation }
  },

  /** Re-derives auto_cascade/actual_pull pool_adjustments from the project's current stored monthly_plan. */
  async recomputePlan(projectId) {
    const project = await this.getById(projectId)
    if (!project) return null
    if (!project.monthly_plan?.length) return project

    await this._recomputeAutoPoolAdjustments(projectId)
    return this._notifyingGetById(projectId)
  },

  /**
   * Directly sets a pool's effective figure for one month by upserting a
   * single manual pool_adjustment (replacing any prior manual adjustment for
   * that exact pool+month — not stacking).
   */
  async setManualPoolAdjustment(projectId, { pool, month, newAmount, createdBy }) {
    const project = await this.getById(projectId)
    if (!project) throw new Error('Project not found')

    const validPools = ['admin', 'hr', 'core']
    if (!validPools.includes(pool)) throw new Error('Pool must be admin, hr, or core.')
    if (!month) throw new Error('A month is required.')

    const months = monthsInRange(project.start_date, project.end_date)
    if (!months.includes(month)) throw new Error(`${month} is outside the project's duration.`)

    const flat = computeFlatMonthlyRate(project, pool)
    const nonManualWithdrawn = (project.pool_adjustments || [])
      .filter((a) => a.pool === pool && a.month === month && a.source !== 'manual')
      .reduce((s, a) => s + (a.amount || 0), 0)
    const delta = Math.round((flat - nonManualWithdrawn - (parseFloat(newAmount) || 0)) * 100) / 100

    await supabase
      .from('project_pool_adjustments')
      .delete()
      .eq('project_id', projectId)
      .eq('pool', pool)
      .eq('month', toDbMonth(month))
      .eq('source', 'manual')

    if (Math.abs(delta) >= 0.01) {
      const createdByUuid = await resolveEmployeeUuidByCode(createdBy)
      const { error } = await supabase.from('project_pool_adjustments').insert({
        project_id: projectId,
        pool,
        month: toDbMonth(month),
        amount: delta,
        source: 'manual',
        reason: 'Direct edit',
        created_by: createdByUuid,
      })
      throwIfError(error, 'Failed to set manual pool adjustment')
    }
    return this._notifyingGetById(projectId)
  },

  // ── Send-to-EMS Allocations ──────────────────────────────────────────────────

  /** PO confirms sending one month's pool amount to EMS. Upserts (replaces any prior sent record for the same pool+month). */
  async sendPoolAllocation(projectId, { pool, month, amount, sentBy }) {
    const project = await this.getById(projectId)
    if (!project) throw new Error('Project not found')

    const validPools = ['admin', 'hr', 'core']
    if (!validPools.includes(pool)) throw new Error('Pool must be admin, hr, or core.')
    if (!month) throw new Error('A month is required.')

    const months = monthsInRange(project.start_date, project.end_date)
    if (!months.includes(month)) throw new Error(`${month} is outside the project's duration.`)

    const amt = parseFloat(amount) || 0
    if (amt <= 0) throw new Error('Sent amount must be greater than zero.')

    await supabase
      .from('project_sent_allocations')
      .delete()
      .eq('project_id', projectId)
      .eq('pool', pool)
      .eq('month', toDbMonth(month))

    const sentByUuid = await resolveEmployeeUuidByCode(sentBy)
    const { error } = await supabase.from('project_sent_allocations').insert({
      project_id: projectId,
      pool,
      month: toDbMonth(month),
      amount: amt,
      sent_by: sentByUuid,
    })
    throwIfError(error, 'Failed to send pool allocation')
    return this._notifyingGetById(projectId)
  },

  /** Reverses a send — the pool+month goes back to unavailable in EMS. */
  async revokePoolAllocation(projectId, { pool, month }) {
    const { error } = await supabase
      .from('project_sent_allocations')
      .delete()
      .eq('project_id', projectId)
      .eq('pool', pool)
      .eq('month', toDbMonth(month))
    throwIfError(error, 'Failed to revoke pool allocation')
    return this._notifyingGetById(projectId)
  },

  // ── Actual-vs-Planned Reallocation ──────────────────────────────────────────

  /** Case 2 "Send to HR/Core": splits a month's Project surplus 50/50 into HR and Core's effective monthly figures. */
  async sendSurplusToPools(projectId, { month, surplus, createdBy }) {
    const amt = parseFloat(surplus) || 0
    if (amt <= 0) throw new Error('No surplus available to send for this month.')
    const half = Math.round((amt / 2) * 100) / 100
    const otherHalf = Math.round((amt - half) * 100) / 100

    const project = await this.getById(projectId)
    if (!project) throw new Error('Project not found')

    const hrCurrent = computeEffectivePoolMonthly(project, 'hr', month)
    const afterHr = await this.setManualPoolAdjustment(projectId, {
      pool: 'hr',
      month,
      newAmount: hrCurrent + half,
      createdBy,
    })
    const coreCurrent = computeEffectivePoolMonthly(afterHr, 'core', month)
    return this.setManualPoolAdjustment(projectId, {
      pool: 'core',
      month,
      newAmount: coreCurrent + otherHalf,
      createdBy,
    })
  },

  /** Case 2 "Send to next month": pushes a month's Project surplus into next month's effective planned Project total. */
  async sendSurplusToNextMonth(projectId, { month, surplus, createdBy }) {
    const amt = parseFloat(surplus) || 0
    if (amt <= 0) throw new Error('No surplus available to send for this month.')

    const project = await this.getById(projectId)
    if (!project) throw new Error('Project not found')

    const months = monthsInRange(project.start_date, project.end_date)
    const monthIdx = months.indexOf(month)
    if (monthIdx === -1) throw new Error(`${month} is outside the project's duration.`)
    const nextMonth = months[monthIdx + 1]
    if (!nextMonth) throw new Error('There is no next month to send this surplus to.')

    await supabase
      .from('project_pool_adjustments')
      .delete()
      .eq('project_id', projectId)
      .eq('source', 'actual_surplus_next_month')
      .in('month', [toDbMonth(month), toDbMonth(nextMonth)])

    const createdByUuid = await resolveEmployeeUuidByCode(createdBy)
    const { error } = await supabase.from('project_pool_adjustments').insert([
      {
        project_id: projectId,
        pool: 'project',
        month: toDbMonth(month),
        amount: amt,
        source: 'actual_surplus_next_month',
        counter_month: toDbMonth(nextMonth),
        reason: `PO-sent surplus to ${nextMonth}`,
        created_by: createdByUuid,
      },
      {
        project_id: projectId,
        pool: 'project',
        month: toDbMonth(nextMonth),
        amount: -amt,
        source: 'actual_surplus_next_month',
        counter_month: toDbMonth(month),
        reason: `PO-sent surplus from ${month}`,
        created_by: createdByUuid,
      },
    ])
    throwIfError(error, 'Failed to send surplus to next month')
    return this._notifyingGetById(projectId)
  },

  /** Reverses a Case-2 "Send to next month" transfer — removes both paired records. */
  async revokeActualSurplusTransfer(projectId, { month }) {
    const project = await this.getById(projectId)
    if (!project) throw new Error('Project not found')

    const outgoing = (project.pool_adjustments || []).filter(
      (a) => a.source === 'actual_surplus_next_month' && a.month === month && (a.amount || 0) < 0,
    )
    if (!outgoing.length) return project

    const existing = outgoing[outgoing.length - 1]
    const counterMonth = existing.counterMonth

    await supabase
      .from('project_pool_adjustments')
      .delete()
      .eq('project_id', projectId)
      .eq('source', 'actual_surplus_next_month')
      .in('month', [toDbMonth(month), toDbMonth(counterMonth)])

    return this._notifyingGetById(projectId)
  },

  // ── Project Activation ──────────────────────────────────────────────────────────

  /**
   * Activates a project's HR/Core pool budgets from a given month onwards.
   * Called from the PMS Project Detail page ("Activate Project" button).
   * Once activated, HR and Core budget rows in EMS Expense Management sheets
   * (Consolidated Sheet, Apportionment Sheet) become non-zero from this month.
   *
   * @param {string} projectId  - UUID of the project to activate
   * @param {string} month      - YYYY-MM string of the activation month
   */
  async activateProject(projectId, month) {
    if (!month) throw new Error('Activation month is required.')
    const { error } = await supabase
      .from('projects')
      .update({
        operations_activated_month: toDbMonth(month),
        operations_activated_at: new Date().toISOString(),
        status: 'ongoing',
      })
      .eq('id', projectId)
    throwIfError(error, 'Failed to activate project')
    return this._notifyingGetById(projectId)
  },

  /**
   * Reverses activation — freezes HR/Core pool budgets again.
   * Only available to HR/CEO. Does NOT reset project status so work
   * progress isn't lost; the PO can re-activate from any month.
   *
   * @param {string} projectId  - UUID of the project to deactivate
   */
  async deactivateProject(projectId) {
    const { error } = await supabase
      .from('projects')
      .update({
        operations_activated_month: null,
        operations_activated_at: null,
      })
      .eq('id', projectId)
    throwIfError(error, 'Failed to deactivate project')
    return this._notifyingGetById(projectId)
  },

  // ── Pool % Adjustment API ──────────────────────────────────────────────────────

  /** Upsert a pool % adjustment for a project from a given month onwards. */
  async addPoolPctAdjustment(projectId, { from_month, hr_pct, core_pct }) {
    await supabase
      .from('project_pool_pct_adjustments')
      .delete()
      .eq('project_id', projectId)
      .eq('from_month', toDbMonth(from_month))
    const { error } = await supabase.from('project_pool_pct_adjustments').insert({
      project_id: projectId,
      from_month: toDbMonth(from_month),
      hr_pct: Math.max(0, Math.min(100, parseFloat(hr_pct) || 0)),
      core_pct: Math.max(0, Math.min(100, parseFloat(core_pct) || 0)),
    })
    throwIfError(error, 'Failed to save pool % adjustment')
    return this._notifyingGetById(projectId)
  },

  async removePoolPctAdjustment(projectId, from_month) {
    const { error } = await supabase
      .from('project_pool_pct_adjustments')
      .delete()
      .eq('project_id', projectId)
      .eq('from_month', toDbMonth(from_month))
    throwIfError(error, 'Failed to remove pool % adjustment')
    return this._notifyingGetById(projectId)
  },

  // ── Installment Management ─────────────────────────────────────────────────

  async updateInstallment(projectId, installmentId, data) {
    const patch = {}
    if (data.label !== undefined) patch.label = data.label
    if (data.percentage !== undefined) patch.percentage = parseFloat(data.percentage) || 0
    if (data.amount !== undefined) patch.amount = parseFloat(data.amount) || 0
    if (data.phase_name !== undefined) patch.phase_name = data.phase_name
    if (data.start_date !== undefined) patch.start_date = data.start_date || null
    if (data.end_date !== undefined || data.target_date !== undefined) {
      patch.target_date = data.end_date ?? data.target_date ?? null
    }
    if (data.actual_date !== undefined) patch.actual_date = data.actual_date || null
    if (data.uc_status !== undefined) patch.uc_status = toDbUcText(data.uc_status)
    // UC tracking fields (migration 26)
    if (data.payment_received_date !== undefined)
      patch.payment_received_date = data.payment_received_date || null
    if (data.uc_target_date !== undefined) patch.uc_target_date = data.uc_target_date || null
    if (data.actual_uc_submission_date !== undefined)
      patch.actual_uc_submission_date = data.actual_uc_submission_date || null
    if (data.documents_checklist !== undefined)
      patch.documents_checklist = Array.isArray(data.documents_checklist)
        ? data.documents_checklist
        : []

    const { data: rows, error } = await supabase
      .from('project_installments')
      .update(patch)
      .eq('id', installmentId)
      .eq('project_id', projectId)
      .select()
    throwIfError(error, 'Failed to update installment')
    if (!rows?.length) throw new Error('Installment not found')
    return this._notifyingGetById(projectId)
  },

  // ── Pool Expenses (hr_expenses/admin_expenses) ──────────────────────────────

  async addExpense(projectId, pool, expense) {
    const { error } = await supabase.from('project_expenses').insert({
      project_id: projectId,
      pool: pool === 'hr' ? 'hr' : 'admin',
      month: toDbMonth(expense.month) || expense.date || today(),
      amount: parseFloat(expense.amount) || 0,
      label: expense.label || null,
      expense_date: expense.date || expense.expense_date || null,
    })
    throwIfError(error, 'Failed to add expense')
    return this._notifyingGetById(projectId)
  },

  async removeExpense(projectId, pool, expenseId) {
    const { error } = await supabase
      .from('project_expenses')
      .delete()
      .eq('id', expenseId)
      .eq('project_id', projectId)
    throwIfError(error, 'Failed to remove expense')
    return this._notifyingGetById(projectId)
  },

  async updateExpense(projectId, pool, expenseId, data) {
    const patch = {}
    if (data.label !== undefined) patch.label = data.label
    if (data.amount !== undefined) patch.amount = parseFloat(data.amount) || 0
    if (data.date !== undefined) patch.expense_date = data.date
    if (data.month !== undefined) patch.month = toDbMonth(data.month)
    const { error } = await supabase
      .from('project_expenses')
      .update(patch)
      .eq('id', expenseId)
      .eq('project_id', projectId)
    throwIfError(error, 'Failed to update expense')
    return this._notifyingGetById(projectId)
  },

  // ── Officer Assignment ──────────────────────────────────────────────────────

  assignOfficer(projectId, officerId) {
    return this.assignOfficers(projectId, [officerId])
  },

  /** Assigns multiple officers to a project (replaces the existing assignment list). */
  async assignOfficers(projectId, officerIds) {
    const validIds = (officerIds || []).filter(Boolean)
    await supabase.from('project_officer_assignments').delete().eq('project_id', projectId)
    if (validIds.length) {
      const { error } = await supabase
        .from('project_officer_assignments')
        .insert(validIds.map((employee_id) => ({ project_id: projectId, employee_id })))
      throwIfError(error, 'Failed to assign officers')
    }
    return this._notifyingGetById(projectId)
  },

  // ── Field Personnel ──────────────────────────────────────────────────────────

  async invitePersonnel(projectId, { name, email }) {
    const { data: existing } = await supabase
      .from('project_field_personnel')
      .select('id')
      .eq('project_id', projectId)
      .eq('email', email)
      .maybeSingle()
    if (existing) throw new Error(`${email} has already been invited to this project.`)

    const { error } = await supabase.from('project_field_personnel').insert({
      project_id: projectId,
      name: name || email.split('@')[0],
      email,
      status: 'invited',
    })
    throwIfError(error, 'Failed to invite personnel')
    return this._notifyingGetById(projectId)
  },

  async removePersonnel(projectId, email) {
    const { error } = await supabase
      .from('project_field_personnel')
      .delete()
      .eq('project_id', projectId)
      .eq('email', email)
    throwIfError(error, 'Failed to remove personnel')
    return this._notifyingGetById(projectId)
  },

  // ── Notes ─────────────────────────────────────────────────────────────────

  async addNote(projectId, note) {
    const trimmed = (note || '').trim()
    if (!trimmed) throw new Error('Note cannot be empty')
    const { error } = await supabase
      .from('project_notes')
      .insert({ project_id: projectId, note: trimmed })
    throwIfError(error, 'Failed to add note')
    return this._notifyingGetById(projectId)
  },

  async deleteNote(projectId, noteId) {
    const { error } = await supabase
      .from('project_notes')
      .delete()
      .eq('id', noteId)
      .eq('project_id', projectId)
    throwIfError(error, 'Failed to delete note')
    return this._notifyingGetById(projectId)
  },

  // ── Field Personnel Details (name/age/phone; optional, no login) ───────────

  async addPersonnelDetail(projectId, { name, age, phone }) {
    const { error } = await supabase.from('project_personnel_details').insert({
      project_id: projectId,
      name: name?.trim() || null,
      age: age ? parseInt(age, 10) : null,
      phone: phone?.trim() || null,
    })
    throwIfError(error, 'Failed to add personnel detail')
    return this._notifyingGetById(projectId)
  },

  async deletePersonnelDetail(projectId, detailId) {
    const { error } = await supabase
      .from('project_personnel_details')
      .delete()
      .eq('id', detailId)
      .eq('project_id', projectId)
    throwIfError(error, 'Failed to delete personnel detail')
    return this._notifyingGetById(projectId)
  },

  // ── Activity (editable, unlike the append-only Notes log) ──────────────────

  async addActivity(projectId, { description, target_date, risk_challenges }) {
    const trimmed = (description || '').trim()
    if (!trimmed) throw new Error('Activity description cannot be empty')
    const { error } = await supabase.from('project_activities').insert({
      project_id: projectId,
      description: trimmed,
      target_date: target_date || null,
      risk_challenges: risk_challenges?.trim() || null,
    })
    throwIfError(error, 'Failed to add activity')
    return this._notifyingGetById(projectId)
  },

  async updateActivity(
    projectId,
    activityId,
    { description, target_date, risk_challenges, status },
  ) {
    const trimmed = (description || '').trim()
    if (!trimmed) throw new Error('Activity description cannot be empty')
    const { error } = await supabase
      .from('project_activities')
      .update({
        description: trimmed,
        target_date: target_date || null,
        risk_challenges: risk_challenges?.trim() || null,
        status: ['completed', 'ongoing'].includes(status) ? status : 'pending',
      })
      .eq('id', activityId)
      .eq('project_id', projectId)
    throwIfError(error, 'Failed to update activity')
    return this._notifyingGetById(projectId)
  },

  async deleteActivity(projectId, activityId) {
    const { error } = await supabase
      .from('project_activities')
      .delete()
      .eq('id', activityId)
      .eq('project_id', projectId)
    throwIfError(error, 'Failed to delete activity')
    return this._notifyingGetById(projectId)
  },

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getStats(filterItems) {
    const items = filterItems || (await fetchAllProjects())
    const totalValue = items.reduce((s, p) => s + (p.project_value || p.project_valuation || 0), 0)
    const totalReceived = items.reduce(
      (s, p) => s + (p.amount_received || p.amount_released || 0),
      0,
    )
    const totalSpent = items.reduce((s, p) => s + (p.amount_spent || p.amount_utilized || 0), 0)
    return {
      total: items.length,
      active: items.filter((p) => p.status === 'active' || p.status === 'ongoing').length,
      ongoing: items.filter((p) => p.status === 'ongoing').length,
      approved: items.filter((p) => p.status === 'approved').length,
      pipeline: items.filter((p) => p.status === 'pipeline').length,
      completed: items.filter((p) => p.status === 'completed').length,
      pendingApprovals: items.reduce((s, p) => s + (p.pending_approvals || 0), 0),
      totalValue,
      totalReceived,
      totalSpent,
      types: {
        consultancy: items.filter((p) => p.project_type === 'Consultancy').length,
        health: items.filter((p) => p.project_type === 'Other Public Health').length,
        mcup: items.filter((p) => p.project_type === 'M-CUP').length,
      },
    }
  },

  /** Same as getStats() but scoped to a specific Project Associate's projects. */
  async getStatsForPA(paId) {
    const items = (await fetchAllProjects()).filter((p) => p.project_associate_id === paId)
    return this.getStats(items)
  },

  /**
   * Same as getStats() but scoped to a Project Associate's fixed specialization,
   * plus anything explicitly assigned to them (paId) outside that specialization.
   */
  async getStatsForSpecialization(specialization, paId = '') {
    const items = (await fetchAllProjects()).filter(
      (p) =>
        (specialization && specializationMatchesProjectType(specialization, p.project_type)) ||
        (paId && p.project_associate_id === paId),
    )
    return this.getStats(items)
  },
}

// ─── Project Officers API ──────────────────────────────────────────────────────

export const localOfficers = {
  async _getOfficersFromStaff() {
    const employees = await getAllEmployeesLite()
    const allProjects = await fetchAllProjects()
    return employees
      .filter((e) => (e.employment?.designation || '').toLowerCase().includes('project officer'))
      .map((e) => ({
        id: e.id,
        name: e.employee_name,
        email: e.contact?.working_email || e.contact?.personal_email || '',
        phone: e.contact?.mobile || '',
        designation: e.employment?.designation || 'Project Officer',
        status: (e.status || 'active').toLowerCase(),
        projects_assigned: allProjects
          .filter((p) => (p.officer_ids || []).includes(e.id))
          .map((p) => p.id),
        created_at: e.created_at || now(),
      }))
  },

  async list({ search = '', status = '' } = {}) {
    let items = await this._getOfficersFromStaff()
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.email.toLowerCase().includes(q) ||
          o.designation?.toLowerCase().includes(q),
      )
    }
    if (status) items = items.filter((o) => o.status === status)
    return { items, total: items.length }
  },

  /** Returns only officers assigned to at least one project that belongs to `paId`. */
  async listForPA(paId, { search = '', status = '' } = {}) {
    const allProjects = (await fetchAllProjects()).filter((p) => p.project_associate_id === paId)
    const officerIdSet = new Set()
    allProjects.forEach((p) => (p.officer_ids || []).forEach((id) => officerIdSet.add(id)))
    let items = (await this._getOfficersFromStaff()).filter((o) => officerIdSet.has(o.id))
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.email.toLowerCase().includes(q) ||
          o.designation?.toLowerCase().includes(q),
      )
    }
    if (status) items = items.filter((o) => o.status === status)
    return { items, total: items.length }
  },

  /** Returns only officers assigned to at least one project matching a Project Associate's fixed specialization. */
  async listForSpecialization(specialization, { search = '', status = '' } = {}) {
    const allProjects = (await fetchAllProjects()).filter((p) =>
      specializationMatchesProjectType(specialization, p.project_type),
    )
    const officerIdSet = new Set()
    allProjects.forEach((p) => (p.officer_ids || []).forEach((id) => officerIdSet.add(id)))
    let items = (await this._getOfficersFromStaff()).filter((o) => officerIdSet.has(o.id))
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.email.toLowerCase().includes(q) ||
          o.designation?.toLowerCase().includes(q),
      )
    }
    if (status) items = items.filter((o) => o.status === status)
    return { items, total: items.length }
  },

  async getById(id) {
    return (await this._getOfficersFromStaff()).find((o) => o.id === id) || null
  },

  create() {
    throw new Error('Project Officers must be created via Staff & Payroll')
  },

  update() {
    throw new Error('Update Project Officers via Staff & Payroll')
  },

  async getAvailable() {
    return (await this._getOfficersFromStaff()).filter((o) => o.status === 'active')
  },

  async getProjectsForOfficer(officerId) {
    return (await fetchAllProjects()).filter((p) => (p.officer_ids || []).includes(officerId))
  },

  /** Finds any active Staff & Payroll employee by their working/personal email,
   *  regardless of designation — used to invite a project officer by email who
   *  isn't already tagged "Project Officer" in Staff & Payroll. */
  async findByEmail(email) {
    const q = (email || '').trim().toLowerCase()
    if (!q) return null
    const match = (await getAllEmployeesLite()).find(
      (e) =>
        (e.contact?.working_email || '').toLowerCase() === q ||
        (e.contact?.personal_email || '').toLowerCase() === q,
    )
    if (!match) return null
    return {
      id: match.id,
      employee_id: match.employee_id,
      name: match.employee_name,
      email: match.contact?.working_email || match.contact?.personal_email || '',
      designation: match.employment?.designation || '',
      status: (match.status || 'active').toLowerCase(),
    }
  },

  /** Projects a Staff & Payroll employee (by their human-readable code) is tied
   *  to, either as the owning Project Associate or as an assigned officer. */
  async getProjectsForEmployeeCode(code) {
    const uuid = await resolveEmployeeUuidByCode(code)
    if (!uuid) return []
    const all = await fetchAllProjects()
    return all
      .filter((p) => p.project_associate_id === uuid || (p.officer_ids || []).includes(uuid))
      .map((p) => ({ id: p.id, name: p.name, project_code: p.project_code, phase: p.phase }))
  },
}
