/**
 * localOrgPool.js — Organisation-wide HR & Core pool for shared expense tracking.
 * Supabase-backed (see ADR-037 / 00000000000005_org_pool.sql,
 * 00000000000024_pool_expenses_rls.sql) — pool_expenses (+ child rows in
 * pool_expense_allocations) and admin_pool_credits replace the old
 * localStorage 'hma_org_pool_v1' blob. Project data comes from the real
 * localProjects service (already Supabase-backed) instead of the old,
 * separate 'hma_projects_v11' localStorage copy — any demo/deleted project
 * that isn't a real row in the `projects` table can no longer appear here.
 *
 * All the proportional-allocation math and budget formulas below are
 * unchanged from the old mock — they're pure calculations over an
 * already-resolved project list, with no storage dependency of their own.
 *
 * Budget Rules (Revised):
 *
 *  ADMIN:
 *    - Active from project creation, across ALL months of project duration
 *    - Monthly = project_value × admin_pct% ÷ total_project_months
 *
 *  HR & CORE:
 *    - FROZEN at ₹0 until "Activate Project" is clicked in PMS
 *      (operations_activated_month is set at that point)
 *    - Once activated, distributed from that month onwards
 *    - Monthly = project_value × effective_pct% ÷ total_project_months
 *    - effective_pct comes from pool_pct_adjustments for the month, or default
 *    - % may be REDUCED from any month — frees budget for project direct work
 *
 *  DIRECT PROJECT:
 *    - Per month = installment_amount × (100 - admin - hr - core)% ÷ installment_months
 *    - Reducing HR/Core % increases the direct %
 */

import supabase from './supabase'
import { localProjects } from './localProjects'
import { localNotifications } from './localNotifications'
import { localAudit } from './localAudit'
import {
  RECEIPT_MIME_TYPES,
  sanitizeFileName,
  uploadWithCleanup,
  cleanupOrphan,
} from './storageUtils'

// ─── Fixed allocation constants ───────────────────────────────────────────────
const ADMIN_PCT = 5 // % of installment → admin overhead (unchanged)
const RECEIPT_BUCKET = 'pool-expense-receipts'
const RECEIPT_MAX_BYTES = 10 * 1024 * 1024 // 10MB/file, matches employee-documents cap

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

// pool_expenses.expense_date is a Postgres `date`; the app works in "YYYY-MM"
// keys throughout — convert at the DB boundary in both directions, same
// pattern as localProjects.js's toDbMonth/fromDbMonth.
const toDbMonth = (m) => (m && m.length === 7 ? `${m}-01` : m || null)
const fromDbMonth = (m) => (m ? String(m).slice(0, 7) : '')

const uid = () => `hre_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`

// ─── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Count months between two date strings (YYYY-MM or YYYY-MM-DD), inclusive.
 */
const monthsBetween = (start, end) => {
  if (!start || !end) return 1
  const [sy, sm] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  return Math.max(1, (ey - sy) * 12 + (em - sm) + 1)
}

/**
 * Total duration of a project in months (start_date → end_date, inclusive).
 * Falls back to 1 if either date is missing.
 */
const totalProjectMonths = (project) => monthsBetween(project.start_date, project.end_date)

// ─── New: month-aware helpers ─────────────────────────────────────────────────────────

/** Convert a date string (YYYY-MM-DD or YYYY-MM) to YYYY-MM. */
const toYM = (dateStr) => (dateStr ? dateStr.slice(0, 7) : null)

/**
 * Derive the activation month. Prefers the explicit operations_activated_month
 * field (set by the new activateProject()); falls back to the legacy
 * operations_activated_at ISO timestamp for projects activated before this change.
 * Final fallback: if the project's status is 'ongoing', treat its start_date month
 * as the activation month so existing live projects aren't incorrectly frozen.
 */
const getActivationMonth = (project) =>
  project.operations_activated_month ||
  (project.operations_activated_at ? project.operations_activated_at.slice(0, 7) : null) ||
  (project.status === 'ongoing' && project.start_date ? project.start_date.slice(0, 7) : null)

/**
 * Get the effective HR and Core percentages for a specific month,
 * honouring any pool_pct_adjustments on the project.
 * Adjustments are sorted by from_month; the latest one ≤ month wins.
 */
const getEffectivePoolPcts = (project, month) => {
  const adj = (project.pool_pct_adjustments || []).filter((a) => a.from_month <= month)
  if (!adj.length) {
    return { hr_pct: project.hr_pct ?? 5, core_pct: project.core_pct ?? 5, isAdjusted: false }
  }
  const latest = adj[adj.length - 1]
  return {
    hr_pct: latest.hr_pct,
    core_pct: latest.core_pct,
    isAdjusted: true,
    adjustedFrom: latest.from_month,
  }
}

/**
 * Build an ordered month list (YYYY-MM strings) from startDate to endDate, inclusive.
 */
const buildMonthList = (startDate, endDate) => {
  const months = []
  if (!startDate || !endDate) return months
  let [cy, cm] = startDate.split('-').map(Number)
  const [ey, em] = endDate.split('-').map(Number)
  while (cy < ey || (cy === ey && cm <= em)) {
    months.push(`${cy}-${String(cm).padStart(2, '0')}`)
    cm++
    if (cm > 12) {
      cm = 1
      cy++
    }
  }
  return months
}

/**
 * Returns the installment covering today, or the last installment as a fallback.
 */
const getCurrentInstallment = (project) => {
  const today = new Date().toISOString().split('T')[0]
  const insts = project.installments || []
  return (
    insts.find((i) => i.start_date <= today && (i.end_date || i.target_date) >= today) ||
    insts[insts.length - 1] ||
    null
  )
}

/**
 * Resolve the effective total project value for a project.
 */
const projectValue = (p) => p.project_value || p.project_valuation || 0

// ─── Storage helpers ──────────────────────────────────────────────────────────

/** All real projects, from the Supabase-backed project service — not a
 * separate/stale copy, so anything not a real project row can't appear. */
const readProjects = async () => {
  const { items } = await localProjects.list({ pageSize: 1000 })
  return items
}

const POOL_TABLE_COL = 'pool'

/** Maps a pool_expenses row (+ joined pool_expense_allocations) back to the
 * shape the rest of this file / its consumers have always used. */
const fromDbExpense = (row) => ({
  id: row.id,
  label: row.label || '',
  vendor: row.vendor || '',
  frequency: row.frequency || 'Monthly',
  yearly_price: parseFloat(row.yearly_price) || 0,
  amount: parseFloat(row.amount) || 0,
  date: fromDbMonth(row.expense_date),
  notes: row.notes || '',
  bill_no: row.bill_no || '',
  employee_id: row.employee_id || null,
  payment_mode: row.payment_mode || '',
  approval_status: row.approval_status || 'Pending',
  receipt_storage_path: row.receipt_storage_path || null,
  receipt_file_name: row.receipt_file_name || null,
  receipt_content_type: row.receipt_content_type || null,
  entered_by_project_id: row.entered_by_project_id || null,
  revenue_sources: row.revenue_sources || [],
  hr_revenue_pct: row.hr_revenue_pct != null ? parseFloat(row.hr_revenue_pct) : 0,
  project_pool_pct: row.project_pool_pct != null ? parseFloat(row.project_pool_pct) : 100,
  admin_share_pct: row.admin_share_pct != null ? parseFloat(row.admin_share_pct) : 0,
  lsgb_revenue_pct: row.lsgb_revenue_pct != null ? parseFloat(row.lsgb_revenue_pct) : 0,
  project_allocations: (row.pool_expense_allocations || []).map((a) => ({
    projectId: a.project_id,
    projectName: a.projects?.title || a.projects?.name || '',
    sharePct: parseFloat(a.share_pct) || 0,
    amountCharged: parseFloat(a.amount_charged) || 0,
  })),
  created_at: row.created_at,
})

const ALLOC_SELECT = 'id, project_id, share_pct, amount_charged, projects(title)'

const listExpenses = async (pool) => {
  const { data, error } = await supabase
    .from('pool_expenses')
    .select(`*, pool_expense_allocations(${ALLOC_SELECT})`)
    .eq(POOL_TABLE_COL, pool)
    .order('expense_date', { ascending: false })
  throwIfError(error, `Failed to load ${pool} expenses`)
  return (data || []).map(fromDbExpense)
}

/** Sum of project_pool-sourced amount_charged, grouped by "<projectId>|<month>"
 * — allocations have no date of their own, so they're grouped by their
 * parent expense's month (`e.date`). Same project_pool filter/field as
 * getProjectPoolRemaining, just month-grouped instead of collapsed
 * all-time — feeds the per-month "remaining share budget" check used to
 * gate which months a project-share booking can be dated to. */
const getBookedByProjectMonth = async (pool) => {
  const expenses = await listExpenses(pool)
  const map = {}
  expenses.forEach((e) => {
    const sources = e.revenue_sources || ['project_pool']
    if (!sources.includes('project_pool')) return
    for (const a of e.project_allocations || []) {
      const key = `${a.projectId}|${e.date}`
      map[key] = (map[key] || 0) + (a.amountCharged || 0)
    }
  })
  return map
}

/** Replaces every allocation row for one expense — same replace-in-place
 * pattern localProjects.js uses for auto pool_adjustments. */
const replaceAllocations = async (poolExpenseId, allocations) => {
  await supabase.from('pool_expense_allocations').delete().eq('pool_expense_id', poolExpenseId)
  if (!allocations?.length) return
  const { error } = await supabase.from('pool_expense_allocations').insert(
    allocations.map((a) => ({
      pool_expense_id: poolExpenseId,
      project_id: a.projectId,
      share_pct: a.sharePct,
      amount_charged: a.amountCharged,
    })),
  )
  throwIfError(error, 'Failed to save expense allocations')
}

/** Re-derives an expense's stored project_allocations after an edit that
 * could change its pool-portion (amount, project_pool_pct, or
 * revenue_sources) — reads back whatever wasn't in `data` from the current
 * row so a partial edit still recomputes against the right pool-portion.
 * If the caller passes an explicit `project_allocations` (a user-picked
 * project override, same convention as insertExpense/addHRExpense), that
 * wins over the automatic proportional split — otherwise a later edit to
 * amount/pct/sources would silently discard the manual pick. */
const recomputeExpenseAllocations = async (
  pool,
  expenseId,
  data,
  getExpenses,
  computeAllocations,
) => {
  if (
    data.amount === undefined &&
    data.project_pool_pct === undefined &&
    data.revenue_sources === undefined &&
    data.project_allocations === undefined
  )
    return

  if (data.project_allocations !== undefined) {
    await replaceAllocations(expenseId, data.project_allocations)
    return
  }

  const current = (await getExpenses()).find((e) => e.id === expenseId)
  const amount = data.amount !== undefined ? parseFloat(data.amount) || 0 : current?.amount || 0
  const projectPoolPct =
    data.project_pool_pct !== undefined
      ? parseFloat(data.project_pool_pct) || 0
      : (current?.project_pool_pct ?? 100)
  const sources = data.revenue_sources || current?.revenue_sources || ['project_pool']

  const allocations = sources.includes('project_pool')
    ? await computeAllocations(pool, Math.round(amount * (projectPoolPct / 100) * 100) / 100)
    : []
  await replaceAllocations(expenseId, allocations)
}

const insertExpense = async (pool, expense, enteredByProjectId) => {
  const totalAmt = parseFloat(expense.amount) || 0
  const revenueSources = expense.revenue_sources || ['project_pool']
  const projectPoolPct = parseFloat(expense.project_pool_pct) ?? 100
  const hrRevenuePct = parseFloat(expense.hr_revenue_pct) ?? 0
  const adminSharePct = parseFloat(expense.admin_share_pct) || 0
  const lsgbRevenuePct = parseFloat(expense.lsgb_revenue_pct) || 0

  // enteredByProjectId has only ever been the literal string 'global' at
  // every call site (never a real project id) — the column is a real FK to
  // projects(id), so store null rather than a value that would fail the FK.
  const enteredByUuid =
    enteredByProjectId && enteredByProjectId !== 'global' ? enteredByProjectId : null

  const { data: inserted, error } = await supabase
    .from('pool_expenses')
    .insert({
      pool,
      label: expense.label || '',
      vendor: expense.vendor || '',
      frequency: expense.frequency || 'Monthly',
      yearly_price: parseFloat(expense.yearly_price) || 0,
      amount: totalAmt,
      expense_date: toDbMonth(expense.date) || new Date().toISOString().slice(0, 10),
      notes: expense.notes || '',
      bill_no: expense.bill_no || '',
      employee_id: expense.employee_id || null,
      payment_mode: expense.payment_mode || null,
      approval_status: expense.approval_status || 'Pending',
      entered_by_project_id: enteredByUuid,
      revenue_sources: revenueSources,
      hr_revenue_pct: hrRevenuePct,
      project_pool_pct: projectPoolPct,
      lsgb_revenue_pct: lsgbRevenuePct,
      ...(pool === 'core' ? { admin_share_pct: adminSharePct } : {}),
    })
    .select()
    .single()
  throwIfError(error, `Failed to add ${pool} expense`)

  const allocations = expense.project_allocations?.length ? expense.project_allocations : []
  if (allocations.length) await replaceAllocations(inserted.id, allocations)

  return fromDbExpense({ ...inserted, pool_expense_allocations: [] })
}

const removeExpense = async (expenseId) => {
  const { error } = await supabase.from('pool_expenses').delete().eq('id', expenseId)
  throwIfError(error, 'Failed to remove expense')
}

const patchExpense = async (expenseId, data) => {
  const patch = {}
  const directFields = [
    'label',
    'vendor',
    'frequency',
    'notes',
    'bill_no',
    'employee_id',
    'payment_mode',
    'approval_status',
    'revenue_sources',
  ]
  for (const f of directFields) if (data[f] !== undefined) patch[f] = data[f]
  if (data.amount !== undefined) patch.amount = parseFloat(data.amount) || 0
  if (data.yearly_price !== undefined) patch.yearly_price = parseFloat(data.yearly_price) || 0
  if (data.date !== undefined) patch.expense_date = toDbMonth(data.date)
  if (data.hr_revenue_pct !== undefined) patch.hr_revenue_pct = parseFloat(data.hr_revenue_pct) || 0
  if (data.project_pool_pct !== undefined)
    patch.project_pool_pct = parseFloat(data.project_pool_pct) || 0
  if (data.admin_share_pct !== undefined)
    patch.admin_share_pct = parseFloat(data.admin_share_pct) || 0
  if (data.lsgb_revenue_pct !== undefined)
    patch.lsgb_revenue_pct = parseFloat(data.lsgb_revenue_pct) || 0

  if (Object.keys(patch).length) {
    const { error } = await supabase.from('pool_expenses').update(patch).eq('id', expenseId)
    throwIfError(error, 'Failed to update expense')
  }
}

/** Receipts are stored at "<pool_expense_id>/<timestamp>-<filename>" — the
 * expense row must already exist before uploading. Same upload-then-attach
 * shape as localEmployeeDocuments.js, minus the separate metadata table
 * since a pool expense has at most one receipt. */
const uploadExpenseReceipt = async (expenseId, file) => {
  const path = `${expenseId}/${Date.now()}-${sanitizeFileName(file.name)}`
  await uploadWithCleanup(RECEIPT_BUCKET, path, file, {
    maxBytes: RECEIPT_MAX_BYTES,
    allowedMimeTypes: RECEIPT_MIME_TYPES,
  })

  const { error } = await supabase
    .from('pool_expenses')
    .update({
      receipt_storage_path: path,
      receipt_file_name: file.name,
      receipt_content_type: file.type || null,
    })
    .eq('id', expenseId)
  if (error) {
    // Metadata write failed — remove the now-orphaned storage object.
    await cleanupOrphan(RECEIPT_BUCKET, path)
    throw new Error(`Failed to save receipt metadata: ${error.message}`)
  }
}

const getExpenseReceiptUrl = async (expense) => {
  if (!expense?.receipt_storage_path) return null
  const { data, error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(expense.receipt_storage_path, 60)
  if (error) return null
  return data?.signedUrl || null
}

const removeExpenseReceipt = async (expenseId, storagePath) => {
  if (storagePath) {
    const { error } = await supabase.storage.from(RECEIPT_BUCKET).remove([storagePath])
    throwIfError(error, 'Failed to delete receipt file')
  }
  const { error } = await supabase
    .from('pool_expenses')
    .update({ receipt_storage_path: null, receipt_file_name: null, receipt_content_type: null })
    .eq('id', expenseId)
  throwIfError(error, 'Failed to clear receipt')
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const localOrgPool = {
  /**
   * Returns all activated active projects with their monthly HR or Core budget
   * for the current month, using adjustment-aware effective percentages.
   *
   * HR/Core: only included after operations_activated_month.
   * Pool budget: sum of per-month contributions from activation to project end.
   */
  async getActiveProjectMonthlyBudgets(pool = 'hr') {
    const todayYM = new Date().toISOString().slice(0, 7) // YYYY-MM

    // Real, Supabase-backed projects only.
    const projects = await readProjects()

    const budgets = projects
      .map((p) => {
        if (pool === 'admin') {
          const pv = projectValue(p)
          const tpm = totalProjectMonths(p) || 1
          const pct = p.admin_pct ?? 5
          const monthlyBudget = pv > 0 ? Math.round(((pv * (pct / 100)) / tpm) * 100) / 100 : 0
          const poolBudget = pv > 0 ? Math.round(pv * (pct / 100) * 100) / 100 : 0
          return {
            projectId: p.id,
            projectName: p.title || p.name,
            installmentId: null,
            installmentLabel: null,
            pct,
            totalProjectMonths: tpm,
            poolBudget,
            monthlyBudget,
            budgetNotForeseen: pv === 0,
            sharePct: 0, // filled below
            activationMonth: null,
          }
        }

        const activationMonth = getActivationMonth(p) || todayYM

        let inst = getCurrentInstallment(p)
        if (!inst) {
          inst = (p.installments && p.installments[0]) || {
            id: null,
            label: 'N/A',
            amount: 0,
            start_date: p.start_date,
          }
        }

        const pv = projectValue(p)
        const tpm = totalProjectMonths(p) || 1
        const pcts = getEffectivePoolPcts(p, todayYM)
        const pct = pool === 'core' ? pcts.core_pct : pcts.hr_pct

        // Monthly budget for this pool at today's effective %
        const monthlyBudget = pv > 0 ? Math.round(((pv * (pct / 100)) / tpm) * 100) / 100 : 0

        // Total pool budget = sum across all active months (activation → project end)
        const allMonths = buildMonthList(p.start_date, p.end_date)
        const poolBudget = allMonths.reduce((sum, month) => {
          if (month < activationMonth) return sum
          const mPcts = getEffectivePoolPcts(p, month)
          const mPct = pool === 'core' ? mPcts.core_pct : mPcts.hr_pct
          return sum + (pv > 0 ? Math.round(((pv * (mPct / 100)) / tpm) * 100) / 100 : 0)
        }, 0)

        const endField = inst.end_date || inst.target_date || ''
        const instMonths = monthsBetween(inst.start_date, endField)

        return {
          projectId: p.id,
          projectName: p.title || p.name,
          installmentId: inst.id,
          installmentLabel: inst.label,
          installmentStart: inst.start_date,
          installmentEnd: endField,
          installmentAmount: inst.amount,
          pct,
          instMonths,
          totalProjectMonths: tpm,
          poolBudget: Math.round(poolBudget * 100) / 100,
          monthlyBudget,
          budgetNotForeseen: pv === 0,
          sharePct: 0, // filled below
          activationMonth,
        }
      })
      .filter(Boolean)

    const total = budgets.reduce((s, b) => s + b.monthlyBudget, 0)
    const totalRounded = Math.round(total * 100) / 100

    return budgets.map((b) => ({
      ...b,
      sharePct: total > 0 ? Math.round((b.monthlyBudget / total) * 10000) / 100 : 0,
      totalMonthlyPool: totalRounded,
    }))
  },

  /**
   * Returns all installments for a project with their full budget breakdown.
   * HR/Core monthly budget = (project_value × pct%) ÷ total project months,
   * distributed equally across all installment months.
   *
   * Each installment row contains:
   *  - projectBudget       85% of installment amount  (for project spend)
   *  - adminBudget          5% of installment amount  (admin overhead, unchanged)
   *  - hrMonthlyBudget     (project_value × 5%) ÷ total_project_months
   *  - coreMonthlyBudget   same as hrMonthlyBudget
   *  - budgetNotForeseen   true → project_value missing, fallback used
   *  - budgetDesignedByOfficer  placeholder for PO-entered project budget
   *
   * @param {string}       projectId
   * @param {'hr'|'core'}  pool  (kept for API compatibility)
   */
  async getProjectInstallmentBudgets(projectId, pool = 'hr') {
    const p = await localProjects.getById(projectId)
    if (!p) return []

    const pv = projectValue(p)
    const tpm = totalProjectMonths(p)
    const globalBudgetNotForeseen = pv === 0

    const hrPct = p.hr_pct ?? 5
    const corePct = p.core_pct ?? 5

    // HR/Core monthly is the same every month across the whole project
    const globalHRMonthly = globalBudgetNotForeseen
      ? null
      : Math.round(((pv * (hrPct / 100)) / tpm) * 100) / 100

    const globalCoreMonthly = globalBudgetNotForeseen
      ? null
      : Math.round(((pv * (corePct / 100)) / tpm) * 100) / 100

    // Pool-specific pct and installment list (sridd3 equal-distribution approach)
    const pct = pool === 'core' ? corePct : hrPct
    const installments = p.installments || []

    // Total project value for pool budget (use best available field)
    const totalProjectValue = p.project_value || p.project_valuation || p.amount_sanctioned || 0
    const totalHRBudget = totalProjectValue * (pct / 100)

    // Count total months across ALL installments combined
    const totalMonths = Math.max(
      1,
      installments.reduce((sum, inst) => {
        const endField = inst.end_date || inst.target_date || ''
        return sum + monthsBetween(inst.start_date, endField)
      }, 0),
    )

    // Equal monthly share for every month of the project
    const monthlyBudget = Math.round((totalHRBudget / totalMonths) * 100) / 100

    return installments.map((inst) => {
      const endField = inst.end_date || inst.target_date || ''
      const instMonths = monthsBetween(inst.start_date, endField)
      const months = instMonths
      const instPoolBudget = Math.round(monthlyBudget * months * 100) / 100

      // Project spend receives the remaining percentage
      const projectPct = 100 - ADMIN_PCT - hrPct - corePct
      const projectBudget = Math.round(inst.amount * (projectPct / 100) * 100) / 100

      // 5% of installment → admin (unchanged)
      const adminBudget = Math.round(inst.amount * (ADMIN_PCT / 100) * 100) / 100

      // HR / Core monthly
      let hrMonthlyBudget, coreMonthlyBudget, budgetNotForeseen
      if (globalBudgetNotForeseen) {
        // Fallback: hrPct / corePct of installment ÷ installment months
        hrMonthlyBudget = Math.round(((inst.amount * (hrPct / 100)) / instMonths) * 100) / 100
        coreMonthlyBudget = Math.round(((inst.amount * (corePct / 100)) / instMonths) * 100) / 100
        budgetNotForeseen = true
      } else {
        hrMonthlyBudget = globalHRMonthly
        coreMonthlyBudget = globalCoreMonthly
        budgetNotForeseen = false
      }

      // Month-by-month label list (for calendar views)
      const monthList = []
      if (inst.start_date && endField) {
        let [cy, cm] = inst.start_date.split('-').map(Number)
        const [ey, em] = endField.split('-').map(Number)
        while (cy < ey || (cy === ey && cm <= em)) {
          monthList.push(`${cy}-${String(cm).padStart(2, '0')}`)
          cm++
          if (cm > 12) {
            cm = 1
            cy++
          }
        }
      }

      return {
        // Identifiers
        installmentId: inst.id,
        installmentLabel: inst.label,
        installmentStart: inst.start_date,
        installmentEnd: endField,
        installmentAmount: inst.amount,
        percentage: inst.percentage,
        ucStatus: inst.uc_status,

        // Duration
        instMonths,
        months,
        totalProjectMonths: tpm,
        totalMonths,
        monthList,

        // Budget breakdown
        projectBudget, // remaining % of installment — PO designs this
        adminBudget, // 5%  of installment
        hrMonthlyBudget, // hrPct of project_value ÷ total months
        coreMonthlyBudget, // corePct of project_value ÷ total months
        hrPoolTotal: globalBudgetNotForeseen ? null : Math.round(pv * (hrPct / 100) * 100) / 100,
        corePoolTotal: globalBudgetNotForeseen
          ? null
          : Math.round(pv * (corePct / 100) * 100) / 100,
        pct: pool === 'core' ? corePct : hrPct,
        hrPct,
        corePct,
        projectPct,
        adminPct: ADMIN_PCT,

        // sridd3 equal-distribution fields
        totalHRBudget: Math.round(totalHRBudget * 100) / 100,

        // Flags
        budgetNotForeseen,
        budgetDesignedByOfficer: inst.budget_designed_by_officer || null,
        // Legacy compat fields used by old visualiser
        poolBudget: (pool === 'core' ? coreMonthlyBudget : hrMonthlyBudget) * instMonths,
        monthlyBudget: pool === 'core' ? coreMonthlyBudget : hrMonthlyBudget,
      }
    })
  },

  /**
   * Builds a complete month-by-month budget breakdown for ONE project.
   * Pure function over an already-resolved project object — no DB access,
   * stays synchronous.
   *
   * Rules implemented:
   *  Admin  : project_value × admin_pct% ÷ total_months — every month from creation
   *  HR     : ₹0 before operations_activated_month; after: project_value × effective_hr_pct% ÷ total_months
   *  Core   : same freeze rule as HR
   *  Direct : installment_amount × (100 - admin - hr - core)% ÷ installment_months
   *           Reducing HR/Core raises Direct for those months.
   *
   * @param {object} project  full project record from localProjects
   * @returns {Array<{
   *   month, isActive,
   *   adminBudget, hrBudget, coreBudget, directBudget,
   *   admin_pct, hr_pct, core_pct, direct_pct,
   *   isAdjusted, hasNewAdjustment,
   *   installmentId, installmentLabel, phaseName
   * }>}
   */
  buildProjectMonthlyBreakdown(project) {
    const pv = project.project_value || project.project_valuation || project.amount_sanctioned || 0
    const tpm = totalProjectMonths(project)
    const adminPct = project.admin_pct ?? 5
    const activationMonth = getActivationMonth(project)

    // Admin: fixed per-month amount from project_value, spread across ALL months
    const adminMonthly = pv > 0 ? Math.round(((pv * (adminPct / 100)) / tpm) * 100) / 100 : 0

    // Full month list for this project
    const months = buildMonthList(project.start_date, project.end_date)

    return months.map((month) => {
      const isActive = !!(activationMonth && month >= activationMonth)
      const pcts = getEffectivePoolPcts(project, month)

      // HR / Core: ₹0 before activation
      const effectiveHrPct = isActive ? pcts.hr_pct : 0
      const effectiveCorePct = isActive ? pcts.core_pct : 0
      const hrBudget =
        isActive && pv > 0 ? Math.round(((pv * (pcts.hr_pct / 100)) / tpm) * 100) / 100 : 0
      const coreBudget =
        isActive && pv > 0 ? Math.round(((pv * (pcts.core_pct / 100)) / tpm) * 100) / 100 : 0

      // Find the installment this month belongs to
      const installment = (project.installments || []).find((inst) => {
        const instEnd = inst.end_date || inst.target_date || ''
        return (
          inst.start_date && instEnd && month >= toYM(inst.start_date) && month <= toYM(instEnd)
        )
      })

      let directBudget = 0
      let directPct = 0
      if (installment) {
        const instEnd = installment.end_date || installment.target_date || ''
        const instMonths = monthsBetween(installment.start_date, instEnd)
        directPct = Math.max(0, 100 - adminPct - effectiveHrPct - effectiveCorePct)
        directBudget =
          Math.round(((installment.amount * (directPct / 100)) / instMonths) * 100) / 100
      }

      const monthEntry = (project.monthly_plan || []).find((m) => m.month === month)
      const plannedPhases = monthEntry ? monthEntry.phases : []

      return {
        month,
        isActive,
        adminBudget: adminMonthly,
        hrBudget,
        coreBudget,
        directBudget,
        admin_pct: adminPct,
        hr_pct: effectiveHrPct,
        core_pct: effectiveCorePct,
        direct_pct: directPct,
        isAdjusted: isActive && pcts.isAdjusted,
        hasNewAdjustment: (project.pool_pct_adjustments || []).some((a) => a.from_month === month),
        installmentId: installment?.id || null,
        installmentLabel: installment?.label || null,
        phaseName: installment?.phase_name || installment?.label || null,
        plannedPhases,
      }
    })
  },

  /**
   * For each given project, returns its full month range with the
   * project-share ("Project Pool") budget for `pool`, how much of it is
   * already booked, and whether that month is still bookable
   * (`allowed = isActive && remaining > 0`). Reuses
   * buildProjectMonthlyBreakdown for the budget/active side and
   * getBookedByProjectMonth for the booked side — no new DB query shape,
   * just a month-scoped view of data the running-balance functions above
   * already compute all-time.
   *
   * Note: unlike HR/Core (frozen at ₹0 until project activation), the
   * Admin pool is active from project creation across every month (see the
   * Budget Rules doc at the top of this file) — so for pool === 'admin',
   * every month in the project's range counts as active regardless of
   * buildProjectMonthlyBreakdown's own `isActive` flag (which only tracks
   * HR/Core activation).
   *
   * Returns the FULL month array per project (not pre-filtered to allowed
   * ones) so a caller can still surface a month that's no longer allowed —
   * e.g. when editing an expense whose own prior booking used up that
   * month's remaining budget.
   *
   * @param {'hr'|'admin'|'core'} pool
   * @param {string[]} projectIds
   * @returns {Promise<Record<string, Array<{month, isActive, budget, booked, remaining, allowed}>>>}
   *   keyed by projectId
   */
  async getAllowedProjectShareMonthsForProjects(pool, projectIds) {
    if (!projectIds || projectIds.length === 0) return {}
    const budgetKey = pool === 'admin' ? 'adminBudget' : pool === 'core' ? 'coreBudget' : 'hrBudget'

    const [projects, bookedMap] = await Promise.all([
      Promise.all(projectIds.map((id) => localProjects.getById(id))),
      getBookedByProjectMonth(pool),
    ])

    const result = {}
    projectIds.forEach((id, i) => {
      const project = projects[i]
      if (!project) {
        result[id] = []
        return
      }
      const monthly = this.buildProjectMonthlyBreakdown(project)
      result[id] = monthly.map((m) => {
        const isActive = pool === 'admin' ? true : m.isActive
        const budget = Math.round((m[budgetKey] || 0) * 100) / 100
        const booked = Math.round((bookedMap[`${id}|${m.month}`] || 0) * 100) / 100
        const remaining = Math.round((budget - booked) * 100) / 100
        return {
          month: m.month,
          isActive,
          budget,
          booked,
          remaining,
          allowed: isActive && remaining > 0,
        }
      })
    })
    return result
  },

  /**
   * Total project-share budget still bookable for `pool` in a given month,
   * summed across every real project (not just those with a
   * project_sent_allocations row — a project can have a monthly share
   * budget before any money has actually been sent in) — i.e. "active this
   * month AND still has remaining budget this month", matching the same
   * per-project `allowed` rule getAllowedProjectShareMonthsForProjects
   * applies, just aggregated into one figure for the wallet dashboard's
   * month picker. Projects with no remaining budget that month (or that
   * aren't active yet) contribute ₹0, not a negative amount.
   *
   * @param {'hr'|'admin'|'core'} pool
   * @param {string} month  YYYY-MM
   */
  async getProjectShareMonthlyAvailable(pool, month) {
    const budgetKey = pool === 'admin' ? 'adminBudget' : pool === 'core' ? 'coreBudget' : 'hrBudget'
    const [projects, bookedMap] = await Promise.all([readProjects(), getBookedByProjectMonth(pool)])

    let total = 0
    for (const project of projects) {
      const entry = this.buildProjectMonthlyBreakdown(project).find((m) => m.month === month)
      if (!entry) continue
      const isActive = pool === 'admin' ? true : entry.isActive
      if (!isActive) continue
      const budget = entry[budgetKey] || 0
      const booked = bookedMap[`${project.id}|${month}`] || 0
      const remaining = Math.round((budget - booked) * 100) / 100
      if (remaining > 0) total += remaining
    }
    return Math.round(total * 100) / 100
  },

  /**
   * Projects with money still available in this pool — the same
   * sent-minus-booked set computeAllocations splits proportionally.
   * Exposed separately so the booking modal can offer them as a manual
   * pick, instead of always relying on the automatic split. Pass
   * `projectIds` to restrict the result to a specific subset (used when the
   * modal computes the proportional split across only the checked
   * projects).
   */
  async getProjectPoolRemaining(pool, projectIds) {
    const [sentRes, expenses, projects] = await Promise.all([
      supabase.from('project_sent_allocations').select('project_id, amount').eq('pool', pool),
      listExpenses(pool),
      readProjects(),
    ])
    throwIfError(sentRes.error, 'Failed to load sent allocations')

    const nameById = {}
    projects.forEach((p) => {
      nameById[p.id] = p.title || p.name
    })

    const sentByProject = {}
    ;(sentRes.data || []).forEach((r) => {
      sentByProject[r.project_id] = (sentByProject[r.project_id] || 0) + (parseFloat(r.amount) || 0)
    })

    const bookedByProject = {}
    expenses.forEach((e) => {
      const sources = e.revenue_sources || ['project_pool']
      if (!sources.includes('project_pool')) return
      for (const a of e.project_allocations || []) {
        bookedByProject[a.projectId] = (bookedByProject[a.projectId] || 0) + (a.amountCharged || 0)
      }
    })

    let remaining = Object.keys(sentByProject)
      .map((projectId) => ({
        projectId,
        projectName: nameById[projectId] || '',
        sent: Math.round((sentByProject[projectId] || 0) * 100) / 100,
        booked: Math.round((bookedByProject[projectId] || 0) * 100) / 100,
        remaining: (sentByProject[projectId] || 0) - (bookedByProject[projectId] || 0),
      }))
      .filter((p) => p.remaining > 0)

    if (projectIds) {
      const allowed = new Set(projectIds)
      remaining = remaining.filter((p) => allowed.has(p.projectId))
    }

    return remaining
  },

  /**
   * Splits a given expense's pool-portion across whichever projects have
   * ever sent money into this pool, proportional to each project's own
   * remaining (sent all-time minus booked all-time) contribution. This is
   * the default when no project is manually picked in the booking modal —
   * write-side of the running-balance model (see getPoolRevenueBalance for
   * the read-side). Pass `projectIds` to restrict the split to a manually
   * checked subset instead of every contributing project.
   */
  async computeAllocations(pool, amount, projectIds) {
    const remaining = await this.getProjectPoolRemaining(pool, projectIds)
    const total = remaining.reduce((s, p) => s + p.remaining, 0)
    return remaining.map((p) => {
      const sharePct = total > 0 ? Math.round((p.remaining / total) * 10000) / 100 : 0
      return {
        projectId: p.projectId,
        projectName: p.projectName,
        installmentId: null,
        sharePct,
        amountCharged: Math.round(amount * (sharePct / 100) * 100) / 100,
      }
    })
  },

  /**
   * Running balance for a pool's project-sourced revenue: all-time sum of
   * what Project Officers have sent (project_sent_allocations), minus
   * all-time sum of what's been booked against project_pool — no month
   * dimension, no reset. For 'admin', also nets out Core's admin_pool
   * ("Admin 5% Share") draws, same cross-pool deduction
   * getMonthlyAdminPoolBudgetSummary already applies.
   */
  async getPoolRevenueBalance(pool) {
    const [sentRes, expenses] = await Promise.all([
      supabase.from('project_sent_allocations').select('amount').eq('pool', pool),
      listExpenses(pool),
    ])
    throwIfError(sentRes.error, 'Failed to load sent allocations')
    const totalSent = (sentRes.data || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)

    let totalBooked = expenses.reduce((sum, e) => {
      const sources = e.revenue_sources || ['project_pool']
      if (!sources.includes('project_pool')) return sum
      const poolPct = parseFloat(e.project_pool_pct) ?? 100
      const totalAmt = parseFloat(e.amount) || 0
      return sum + Math.round(totalAmt * (poolPct / 100) * 100) / 100
    }, 0)

    if (pool === 'admin') {
      const coreExpenses = await this.getCoreExpenses()
      totalBooked += coreExpenses.reduce((sum, e) => {
        const sources = e.revenue_sources || []
        if (!sources.includes('admin_pool')) return sum
        const sharePct = parseFloat(e.admin_share_pct) || 0
        const totalAmt = parseFloat(e.amount) || 0
        return sum + Math.round(totalAmt * (sharePct / 100) * 100) / 100
      }, 0)
    }

    return {
      totalSent: Math.round(totalSent * 100) / 100,
      totalBooked: Math.round(totalBooked * 100) / 100,
      remaining: Math.round((totalSent - totalBooked) * 100) / 100,
    }
  },

  /**
   * Sum of every HR/Admin/Core pool expense's LSGB-Revenue-tagged portion,
   * all-time — nets against the manually-set balance in
   * localLsgbRevenue.js to produce the LSGB "available" figure shown in the
   * booking modal. Mirrors getHRRevenueUsed's shape exactly.
   */
  async getLsgbRevenueUsed() {
    const [hr, admin, core] = await Promise.all([
      this.getHRExpenses(),
      this.getAdminExpenses(),
      this.getCoreExpenses(),
    ])
    const sumTagged = (rows) =>
      rows
        .filter((e) => (e.revenue_sources || []).includes('lsgb_revenue'))
        .reduce((s, e) => s + (e.amount || 0) * ((e.lsgb_revenue_pct || 0) / 100), 0)
    return Math.round((sumTagged(hr) + sumTagged(admin) + sumTagged(core)) * 100) / 100
  },

  /**
   * Raw list of every pool_expense (HR/Admin/Core) tagged with
   * 'lsgb_revenue' in revenue_sources, oldest-first — feeds the LSGB tab's
   * ledger. Unlike getLsgbRevenueUsed (an aggregate only), this keeps the
   * `pool` column (fromDbExpense drops it) and a precomputed `lsgbAmount`
   * (the LSGB-attributable portion of each expense, not its gross amount)
   * so the ledger can show a running balance that reconciles with
   * getLsgbRevenueUsed's total.
   */
  async getLsgbRevenueExpenses() {
    const { data, error } = await supabase
      .from('pool_expenses')
      .select(`*, pool_expense_allocations(${ALLOC_SELECT})`)
      .contains('revenue_sources', ['lsgb_revenue'])
      .order('expense_date', { ascending: true })
    throwIfError(error, 'Failed to load LSGB revenue expenses')
    return (data || []).map((row) => ({
      ...fromDbExpense(row),
      pool: row.pool,
      lsgbAmount:
        Math.round(
          (parseFloat(row.amount) || 0) * ((parseFloat(row.lsgb_revenue_pct) || 0) / 100) * 100,
        ) / 100,
    }))
  },

  // ── HR Expense CRUD ────────────────────────────────────────────────────────

  async getHRExpenses() {
    return listExpenses('hr')
  },

  /**
   * Shared low-balance alert for any per-project pool budget (HR/Core/Admin
   * all expose the same { isActive, poolBudget, remaining } summary shape).
   * `poolLabel` both prefixes the notification text and scopes the dedup
   * check, so an unread HR alert for a project doesn't suppress a Core/Admin
   * alert for that same project.
   */
  async _checkPoolBudgetThreshold(pool, poolLabel, getSummary) {
    const budgets = await this.getActiveProjectMonthlyBudgets(pool)
    for (const b of budgets) {
      const summary = await getSummary(b.projectId)
      if (summary.isActive && summary.poolBudget > 0) {
        const remainingPct = summary.remaining / summary.poolBudget
        if (remainingPct <= 0.1) {
          const notifications = await localNotifications.getNotifications('HR')
          const existing = notifications.find(
            (n) =>
              n.relatedProjectId === b.projectId &&
              !n.read &&
              n.message.startsWith(`${poolLabel} Budget for project`) &&
              n.message.includes('nearing exhaustion'),
          )
          if (!existing) {
            await localNotifications.addNotification({
              message: `${poolLabel} Budget for project "${b.projectName}" is nearing exhaustion (${Math.round(remainingPct * 100)}% remaining).`,
              roleTarget: 'HR',
              relatedProjectId: b.projectId,
              type: 'danger',
            })
          }
        }
      }
    }
  },

  async checkHRBudgetThresholds() {
    await this._checkPoolBudgetThreshold('hr', 'HR', (id) => this.getProjectHRBudgetSummary(id))
  },

  async checkCoreBudgetThresholds() {
    await this._checkPoolBudgetThreshold('core', 'Core', (id) =>
      this.getProjectCoreBudgetSummary(id),
    )
  },

  async checkAdminBudgetThresholds() {
    await this._checkPoolBudgetThreshold('admin', 'Admin', (id) =>
      this.getProjectAdminBudgetSummary(id),
    )
  },

  /**
   * Returns the total monthly HR project-pool budget across all active projects,
   * and how much has already been used (charged to project_pool) this month.
   *
   * @returns {{ totalMonthlyBudget: number, usedThisMonth: number, remaining: number }}
   */
  async getMonthlyHRPoolBudgetSummary(month) {
    const budgets = await this.getActiveProjectMonthlyBudgets('hr')
    const totalMonthlyBudget = budgets.length > 0 ? (budgets[0].totalMonthlyPool ?? 0) : 0

    const expenses = await this.getHRExpenses()
    const targetMonth = month || new Date().toISOString().slice(0, 7) // YYYY-MM

    const usedThisMonth = expenses
      .filter((e) => {
        const eMonth = e.date ? e.date.slice(0, 7) : targetMonth
        return eMonth === targetMonth
      })
      .reduce((sum, e) => {
        const sources = e.revenue_sources || ['project_pool']
        if (!sources.includes('project_pool')) return sum
        const poolPct = parseFloat(e.project_pool_pct) ?? 100
        const totalAmt = parseFloat(e.amount) || 0
        return sum + Math.round(totalAmt * (poolPct / 100) * 100) / 100
      }, 0)

    return {
      totalMonthlyBudget: Math.round(totalMonthlyBudget * 100) / 100,
      usedThisMonth: Math.round(usedThisMonth * 100) / 100,
      remaining: Math.round((totalMonthlyBudget - usedThisMonth) * 100) / 100,
    }
  },

  async addHRExpense(expense, enteredByProjectId) {
    const totalAmt = parseFloat(expense.amount) || 0
    const revenueSources = expense.revenue_sources || ['project_pool']
    const projectPoolPct = parseFloat(expense.project_pool_pct) ?? 100

    // Use caller-provided allocations (user-edited) if present, else auto-compute
    let allocations
    if (expense.project_allocations && expense.project_allocations.length > 0) {
      allocations = expense.project_allocations
    } else {
      const projectPoolAmt = Math.round(totalAmt * (projectPoolPct / 100) * 100) / 100
      allocations = revenueSources.includes('project_pool')
        ? await this.computeAllocations('hr', projectPoolAmt)
        : []
    }

    const newExp = await insertExpense(
      'hr',
      { ...expense, project_allocations: allocations },
      enteredByProjectId,
    )

    setTimeout(() => this.checkHRBudgetThresholds(), 100)
    localAudit.write({
      module: 'Expense Pools',
      action: 'POOL_EXPENSE_ADDED',
      record_id: newExp.id,
      record_label: newExp.label || newExp.vendor,
      new_value: {
        label: newExp.label,
        vendor: newExp.vendor,
        amount: newExp.amount,
        date: newExp.date,
      },
      details: `HR Pool expense added: "${newExp.label || newExp.vendor}" — ₹${Number(newExp.amount).toLocaleString()}`,
    })
    return newExp
  },

  async removeHRExpense(expenseId) {
    await removeExpense(expenseId)
  },

  async uploadExpenseReceipt(expenseId, file) {
    await uploadExpenseReceipt(expenseId, file)
  },

  async getExpenseReceiptUrl(expense) {
    return getExpenseReceiptUrl(expense)
  },

  async removeExpenseReceipt(expenseId, storagePath) {
    await removeExpenseReceipt(expenseId, storagePath)
  },

  async updateHRExpense(expenseId, data) {
    await patchExpense(expenseId, data)
    await recomputeExpenseAllocations(
      'hr',
      expenseId,
      data,
      () => this.getHRExpenses(),
      (pool, amt) => this.computeAllocations(pool, amt),
    )
    setTimeout(() => this.checkHRBudgetThresholds(), 100)
    localAudit.write({
      module: 'Expense Pools',
      action: 'POOL_EXPENSE_UPDATED',
      record_id: expenseId,
      record_label: data.label || data.vendor || expenseId,
      new_value: { amount: data.amount, label: data.label, vendor: data.vendor },
      details: `HR Pool expense updated: ${data.label || data.vendor || expenseId}${data.amount !== undefined ? ' — ₹' + Number(data.amount).toLocaleString() : ''}`,
    })
  },

  /**
   * Returns all HR expense records allocated to this project.
   *
   * Priority:
   *  1. If the expense has a per-expense custom allocation for this project
   *     (i.e. updateExpenseProjectAllocation was called), use that stored value.
   *  2. Otherwise fall back to the live proportional share based on monthly budgets.
   */
  async getProjectsMonthlyHRRemaining(month) {
    const budgets = await this.getActiveProjectMonthlyBudgets('hr')
    const expenses = await this.getHRExpenses()
    const targetMonth = month || new Date().toISOString().slice(0, 7)

    const usedMap = {}
    for (const exp of expenses) {
      const eMonth = exp.date ? exp.date.slice(0, 7) : targetMonth
      if (eMonth !== targetMonth) continue
      const sources = exp.revenue_sources || ['project_pool']
      if (!sources.includes('project_pool')) continue

      const allocs = exp.project_allocations || []
      if (allocs.length > 0) {
        for (const a of allocs) {
          usedMap[a.projectId] = (usedMap[a.projectId] || 0) + (a.amountCharged || 0)
        }
      } else {
        const total = budgets.reduce((s, b) => s + b.monthlyBudget, 0)
        for (const b of budgets) {
          const share = total > 0 ? b.monthlyBudget / total : 0
          const poolPct = parseFloat(exp.project_pool_pct) ?? 100
          const poolAmt = parseFloat(exp.amount || 0) * (poolPct / 100)
          usedMap[b.projectId] =
            (usedMap[b.projectId] || 0) + Math.round(poolAmt * share * 100) / 100
        }
      }
    }

    const result = {}
    for (const b of budgets) {
      const used = Math.round((usedMap[b.projectId] || 0) * 100) / 100
      result[b.projectId] = {
        monthlyBudget: b.monthlyBudget,
        usedThisMonth: used,
        remaining: Math.round((b.monthlyBudget - used) * 100) / 100,
      }
    }
    return result
  },

  async getProjectHRCharges(projectId) {
    const budgets = await this.getActiveProjectMonthlyBudgets('hr')
    const mine = budgets.find((b) => b.projectId === projectId)
    if (!mine) return []

    const total = budgets.reduce((s, b) => s + b.monthlyBudget, 0)
    const liveSharePct = total > 0 ? (mine.monthlyBudget / total) * 100 : 0

    const expenses = await this.getHRExpenses()
    return expenses.map((exp) => {
      // Check for a custom per-expense allocation for this project
      const customAlloc = (exp.project_allocations || []).find((a) => a.projectId === projectId)

      // Use custom allocation if stored, otherwise fall back to live share
      const mySharePct = customAlloc ? customAlloc.sharePct : liveSharePct
      const myAmount = customAlloc
        ? customAlloc.amountCharged
        : Math.round(parseFloat(exp.amount || 0) * (liveSharePct / 100) * 100) / 100

      return {
        ...exp,
        myAmount,
        mySharePct: Math.round(mySharePct * 100) / 100,
        isFromThisProject: exp.entered_by_project_id === projectId,
        hasCustomAllocation: !!customAlloc,
      }
    })
  },

  /**
   * Returns this project's HR budget summary for the current installment.
   */
  async getProjectHRBudgetSummary(projectId) {
    const budgets = await this.getActiveProjectMonthlyBudgets('hr')
    const mine = budgets.find((b) => b.projectId === projectId)

    const charges = await this.getProjectHRCharges(projectId)
    const totalCharged = charges.reduce((s, c) => s + (c.myAmount || 0), 0)

    if (!mine) {
      return {
        isActive: false,
        monthlyBudget: 0,
        poolBudget: 0,
        sharePct: 0,
        totalMonthlyPool: 0,
        totalCharged: Math.round(totalCharged * 100) / 100,
        remaining: 0,
        activeProjectCount: budgets.length,
        budgetNotForeseen: false,
      }
    }

    return {
      isActive: true,
      monthlyBudget: mine.monthlyBudget,
      poolBudget: mine.poolBudget,
      sharePct: mine.sharePct,
      totalMonthlyPool: mine.totalMonthlyPool,
      totalCharged: Math.round(totalCharged * 100) / 100,
      remaining: Math.round((mine.poolBudget - totalCharged) * 100) / 100,
      activeProjectCount: budgets.length,
      budgetNotForeseen: mine.budgetNotForeseen,
      totalProjectMonths: mine.totalProjectMonths,
    }
  },

  /** Returns all HR expenses in the org pool. */
  async getAllHRExpenses() {
    return this.getHRExpenses()
  },

  async getProjectCoreCharges(projectId) {
    const expenses = await this.getCoreExpenses()
    return expenses
      .map((exp) => {
        const alloc = (exp.project_allocations || []).find((a) => a.projectId === projectId)
        if (!alloc) return null
        return {
          ...exp,
          myAmount: alloc.amountCharged,
          mySharePct: alloc.sharePct,
          isFromThisProject: exp.entered_by_project_id === projectId,
        }
      })
      .filter(Boolean)
  },

  async getProjectCoreBudgetSummary(projectId) {
    const budgets = await this.getActiveProjectMonthlyBudgets('core')
    const mine = budgets.find((b) => b.projectId === projectId)

    const charges = await this.getProjectCoreCharges(projectId)
    const totalCharged = charges.reduce((s, c) => s + (c.myAmount || 0), 0)

    if (!mine) {
      return {
        isActive: false,
        monthlyBudget: 0,
        poolBudget: 0,
        sharePct: 0,
        totalMonthlyPool: 0,
        totalCharged: Math.round(totalCharged * 100) / 100,
        remaining: 0,
        activeProjectCount: budgets.length,
        budgetNotForeseen: false,
      }
    }

    return {
      isActive: true,
      monthlyBudget: mine.monthlyBudget,
      poolBudget: mine.poolBudget,
      sharePct: mine.sharePct,
      totalMonthlyPool: mine.totalMonthlyPool,
      totalCharged: Math.round(totalCharged * 100) / 100,
      remaining: Math.round((mine.poolBudget - totalCharged) * 100) / 100,
      activeProjectCount: budgets.length,
      budgetNotForeseen: mine.budgetNotForeseen,
      totalProjectMonths: mine.totalProjectMonths,
    }
  },

  // ── Core Expense CRUD ──────────────────────────────────────────────────────

  async getCoreExpenses() {
    return listExpenses('core')
  },

  async addCoreExpense(expense, enteredByProjectId) {
    const totalAmt = parseFloat(expense.amount) || 0
    const revenueSources = expense.revenue_sources || ['project_pool']
    const projectPoolPct = parseFloat(expense.project_pool_pct) ?? 100

    let allocations
    if (expense.project_allocations && expense.project_allocations.length > 0) {
      allocations = expense.project_allocations
    } else {
      const projectPoolAmt = Math.round(totalAmt * (projectPoolPct / 100) * 100) / 100
      allocations = revenueSources.includes('project_pool')
        ? await this.computeAllocations('core', projectPoolAmt)
        : []
    }

    const newExp = await insertExpense(
      'core',
      { ...expense, project_allocations: allocations },
      enteredByProjectId,
    )
    setTimeout(() => this.checkCoreBudgetThresholds(), 100)
    return newExp
  },

  async removeCoreExpense(expenseId) {
    await removeExpense(expenseId)
  },

  async updateCoreExpense(expenseId, data) {
    await patchExpense(expenseId, data)
    await recomputeExpenseAllocations(
      'core',
      expenseId,
      data,
      () => this.getCoreExpenses(),
      (pool, amt) => this.computeAllocations(pool, amt),
    )
    setTimeout(() => this.checkCoreBudgetThresholds(), 100)
  },

  /**
   * Returns the total monthly Core project-pool budget across all active projects,
   * and how much has already been used (charged to project_pool) this month.
   */
  async getMonthlyCorePoolBudgetSummary(month) {
    const budgets = await this.getActiveProjectMonthlyBudgets('core')
    const totalMonthlyBudget = budgets.length > 0 ? (budgets[0].totalMonthlyPool ?? 0) : 0

    const expenses = await this.getCoreExpenses()
    const targetMonth = month || new Date().toISOString().slice(0, 7)

    const usedThisMonth = expenses
      .filter((e) => (e.date ? e.date.slice(0, 7) : targetMonth) === targetMonth)
      .reduce((sum, e) => {
        const sources = e.revenue_sources || ['project_pool']
        if (!sources.includes('project_pool')) return sum
        const poolPct = parseFloat(e.project_pool_pct) ?? 100
        const totalAmt = parseFloat(e.amount) || 0
        return sum + Math.round(totalAmt * (poolPct / 100) * 100) / 100
      }, 0)

    return {
      totalMonthlyBudget: Math.round(totalMonthlyBudget * 100) / 100,
      usedThisMonth: Math.round(usedThisMonth * 100) / 100,
      remaining: Math.round((totalMonthlyBudget - usedThisMonth) * 100) / 100,
    }
  },

  async getProjectsMonthlyCoreRemaining(month) {
    const budgets = await this.getActiveProjectMonthlyBudgets('core')
    const expenses = await this.getCoreExpenses()
    const targetMonth = month || new Date().toISOString().slice(0, 7)

    const usedMap = {}
    for (const exp of expenses) {
      const eMonth = exp.date ? exp.date.slice(0, 7) : targetMonth
      if (eMonth !== targetMonth) continue
      const sources = exp.revenue_sources || ['project_pool']
      if (!sources.includes('project_pool')) continue

      const allocs = exp.project_allocations || []
      if (allocs.length > 0) {
        for (const a of allocs) {
          usedMap[a.projectId] = (usedMap[a.projectId] || 0) + (a.amountCharged || 0)
        }
      } else {
        const total = budgets.reduce((s, b) => s + b.monthlyBudget, 0)
        for (const b of budgets) {
          const share = total > 0 ? b.monthlyBudget / total : 0
          const poolPct = parseFloat(exp.project_pool_pct) ?? 100
          const poolAmt = parseFloat(exp.amount || 0) * (poolPct / 100)
          usedMap[b.projectId] =
            (usedMap[b.projectId] || 0) + Math.round(poolAmt * share * 100) / 100
        }
      }
    }

    const result = {}
    for (const b of budgets) {
      const used = Math.round((usedMap[b.projectId] || 0) * 100) / 100
      result[b.projectId] = {
        monthlyBudget: b.monthlyBudget,
        usedThisMonth: used,
        remaining: Math.round((b.monthlyBudget - used) * 100) / 100,
      }
    }
    return result
  },

  /** Returns all Core expenses in the org pool. */
  async getAllCoreExpenses() {
    return this.getCoreExpenses()
  },

  // ── Admin Expense CRUD ─────────────────────────────────────────────────────

  async getAdminExpenses() {
    return listExpenses('admin')
  },

  async addAdminExpense(expense, enteredByProjectId) {
    const totalAmt = parseFloat(expense.amount) || 0
    const revenueSources = expense.revenue_sources || ['project_pool']
    const projectPoolPct = parseFloat(expense.project_pool_pct) ?? 100

    let allocations
    if (expense.project_allocations && expense.project_allocations.length > 0) {
      allocations = expense.project_allocations
    } else {
      const projectPoolAmt = Math.round(totalAmt * (projectPoolPct / 100) * 100) / 100
      allocations = revenueSources.includes('project_pool')
        ? await this.computeAllocations('admin', projectPoolAmt)
        : []
    }

    const newExp = await insertExpense(
      'admin',
      { ...expense, project_allocations: allocations },
      enteredByProjectId,
    )
    setTimeout(() => this.checkAdminBudgetThresholds(), 100)
    return newExp
  },

  async removeAdminExpense(expenseId) {
    await removeExpense(expenseId)
  },

  async updateAdminExpense(expenseId, data) {
    await patchExpense(expenseId, data)
    await recomputeExpenseAllocations(
      'admin',
      expenseId,
      data,
      () => this.getAdminExpenses(),
      (pool, amt) => this.computeAllocations(pool, amt),
    )
    setTimeout(() => this.checkAdminBudgetThresholds(), 100)
  },

  /** Returns all Admin expenses in the org pool. */
  async getAllAdminExpenses() {
    return this.getAdminExpenses()
  },

  async getProjectAdminCharges(projectId) {
    const expenses = await this.getAdminExpenses()
    return expenses
      .map((exp) => {
        const alloc = (exp.project_allocations || []).find((a) => a.projectId === projectId)
        if (!alloc) return null
        return {
          ...exp,
          myAmount: alloc.amountCharged,
          mySharePct: alloc.sharePct,
          isFromThisProject: exp.entered_by_project_id === projectId,
        }
      })
      .filter(Boolean)
  },

  async getProjectAdminBudgetSummary(projectId) {
    const budgets = await this.getActiveProjectMonthlyBudgets('admin')
    const mine = budgets.find((b) => b.projectId === projectId)

    const charges = await this.getProjectAdminCharges(projectId)
    const totalCharged = charges.reduce((s, c) => s + (c.myAmount || 0), 0)

    if (!mine) {
      return {
        isActive: false,
        monthlyBudget: 0,
        poolBudget: 0,
        sharePct: 0,
        totalMonthlyPool: 0,
        totalCharged: Math.round(totalCharged * 100) / 100,
        remaining: 0,
        activeProjectCount: budgets.length,
        budgetNotForeseen: false,
      }
    }

    return {
      isActive: true,
      monthlyBudget: mine.monthlyBudget,
      poolBudget: mine.poolBudget,
      sharePct: mine.sharePct,
      totalMonthlyPool: mine.totalMonthlyPool,
      totalCharged: Math.round(totalCharged * 100) / 100,
      remaining: Math.round((mine.poolBudget - totalCharged) * 100) / 100,
      activeProjectCount: budgets.length,
      budgetNotForeseen: mine.budgetNotForeseen,
      totalProjectMonths: mine.totalProjectMonths,
    }
  },

  /**
   * Returns the total monthly Admin project-pool budget across all active projects,
   * and how much has already been used (charged to project_pool) this month.
   */
  async getMonthlyAdminPoolBudgetSummary(month) {
    const budgets = await this.getActiveProjectMonthlyBudgets('admin')
    const totalMonthlyBudget = budgets.length > 0 ? (budgets[0].totalMonthlyPool ?? 0) : 0

    const expenses = await this.getAdminExpenses()
    const targetMonth = month || new Date().toISOString().slice(0, 7)

    const usedFromAdminExpenses = expenses
      .filter((e) => (e.date ? e.date.slice(0, 7) : targetMonth) === targetMonth)
      .reduce((sum, e) => {
        const sources = e.revenue_sources || ['project_pool']
        if (!sources.includes('project_pool')) return sum
        const poolPct = parseFloat(e.project_pool_pct) ?? 100
        const totalAmt = parseFloat(e.amount) || 0
        return sum + Math.round(totalAmt * (poolPct / 100) * 100) / 100
      }, 0)

    // Core expenses can draw on the Admin pool too ("Admin 5% Share") — a
    // real cross-pool deduction, so it counts against Admin's own budget
    // the same as Admin's own project_pool spend does.
    const coreExpenses = await this.getCoreExpenses()
    const usedFromCoreExpenses = coreExpenses
      .filter((e) => (e.date ? e.date.slice(0, 7) : targetMonth) === targetMonth)
      .reduce((sum, e) => {
        const sources = e.revenue_sources || []
        if (!sources.includes('admin_pool')) return sum
        const sharePct = parseFloat(e.admin_share_pct) || 0
        const totalAmt = parseFloat(e.amount) || 0
        return sum + Math.round(totalAmt * (sharePct / 100) * 100) / 100
      }, 0)

    const usedThisMonth = usedFromAdminExpenses + usedFromCoreExpenses

    return {
      totalMonthlyBudget: Math.round(totalMonthlyBudget * 100) / 100,
      usedThisMonth: Math.round(usedThisMonth * 100) / 100,
      remaining: Math.round((totalMonthlyBudget - usedThisMonth) * 100) / 100,
    }
  },

  async getProjectsMonthlyAdminRemaining(month) {
    const budgets = await this.getActiveProjectMonthlyBudgets('admin')
    const expenses = await this.getAdminExpenses()
    const targetMonth = month || new Date().toISOString().slice(0, 7)

    const usedMap = {}
    for (const exp of expenses) {
      const eMonth = exp.date ? exp.date.slice(0, 7) : targetMonth
      if (eMonth !== targetMonth) continue
      const sources = exp.revenue_sources || ['project_pool']
      if (!sources.includes('project_pool')) continue

      const allocs = exp.project_allocations || []
      if (allocs.length > 0) {
        for (const a of allocs) {
          usedMap[a.projectId] = (usedMap[a.projectId] || 0) + (a.amountCharged || 0)
        }
      } else {
        const total = budgets.reduce((s, b) => s + b.monthlyBudget, 0)
        for (const b of budgets) {
          const share = total > 0 ? b.monthlyBudget / total : 0
          const poolPct = parseFloat(exp.project_pool_pct) ?? 100
          const poolAmt = parseFloat(exp.amount || 0) * (poolPct / 100)
          usedMap[b.projectId] =
            (usedMap[b.projectId] || 0) + Math.round(poolAmt * share * 100) / 100
        }
      }
    }

    // Core expenses tagged "Admin 5% Share" draw on this same budget. There's
    // no per-project allocation stored for this source (flat aggregate draw
    // only — see design spec), so distribute proportionally across Admin's
    // active projects by their monthly-budget share, same fallback used above
    // for a plain Admin expense with no project_allocations of its own.
    const coreExpenses = await this.getCoreExpenses()
    const totalBudget = budgets.reduce((s, b) => s + b.monthlyBudget, 0)
    for (const exp of coreExpenses) {
      const eMonth = exp.date ? exp.date.slice(0, 7) : targetMonth
      if (eMonth !== targetMonth) continue
      const sources = exp.revenue_sources || []
      if (!sources.includes('admin_pool')) continue

      const sharePct = parseFloat(exp.admin_share_pct) || 0
      const shareAmt = (parseFloat(exp.amount) || 0) * (sharePct / 100)
      for (const b of budgets) {
        const share = totalBudget > 0 ? b.monthlyBudget / totalBudget : 0
        usedMap[b.projectId] =
          (usedMap[b.projectId] || 0) + Math.round(shareAmt * share * 100) / 100
      }
    }

    const result = {}
    for (const b of budgets) {
      const used = Math.round((usedMap[b.projectId] || 0) * 100) / 100
      result[b.projectId] = {
        monthlyBudget: b.monthlyBudget,
        usedThisMonth: used,
        remaining: Math.round((b.monthlyBudget - used) * 100) / 100,
      }
    }
    return result
  },

  /** 5% (admin_pct) of total project value — credited once, as a lump sum. */
  computeAdminPoolAmount(project) {
    const pv = projectValue(project)
    const pct = project.admin_pct ?? 5
    return Math.round(pv * (pct / 100) * 100) / 100
  },

  /** Appends a lump-sum admin credit record (org-wide ledger, mirrors hr/core expense arrays). */
  async recordAdminCredit(projectId, amount) {
    const { data, error } = await supabase
      .from('admin_pool_credits')
      .insert({ project_id: projectId, amount })
      .select()
      .single()
    throwIfError(error, 'Failed to record admin credit')
    return {
      id: data.id,
      projectId: data.project_id,
      amount: data.amount,
      createdAt: data.created_at,
    }
  },

  /** Returns all admin pool lump-sum credit records. */
  async getAdminPoolCredits() {
    const { data, error } = await supabase
      .from('admin_pool_credits')
      .select('*')
      .order('created_at', { ascending: false })
    throwIfError(error, 'Failed to load admin pool credits')
    return (data || []).map((r) => ({
      id: r.id,
      projectId: r.project_id,
      amount: parseFloat(r.amount) || 0,
      createdAt: r.created_at,
    }))
  },

  /**
   * Sum of every HR/Admin/Core pool expense's HR-Revenue-tagged portion,
   * across all time (matches the gross HR revenue figure it's meant to net
   * against, which is also an all-time total, not month-scoped). Used to
   * turn "HR Revenue" from a cosmetic tag into a real running balance —
   * see caller in GlobalHRPoolPage.jsx.
   */
  async getHRRevenueUsed() {
    const [hr, admin, core] = await Promise.all([
      this.getHRExpenses(),
      this.getAdminExpenses(),
      this.getCoreExpenses(),
    ])
    const sumTagged = (rows) =>
      rows
        .filter((e) => (e.revenue_sources || []).includes('hr_revenue'))
        .reduce((s, e) => s + (e.amount || 0) * ((e.hr_revenue_pct || 0) / 100), 0)
    return Math.round((sumTagged(hr) + sumTagged(admin) + sumTagged(core)) * 100) / 100
  },

  uid,
}
