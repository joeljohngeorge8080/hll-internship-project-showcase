// Recomputes a project's auto_cascade/actual_pull pool_adjustments server-side
// and writes them with the service-role key, so the numbers written to
// project_pool_adjustments are always what this documented algorithm actually
// produced — a client can no longer author its own adjustment rows for these
// two sources (see 00000000000054_lock_pool_adjustments_writes.sql, which
// restricts INSERT/UPDATE/DELETE on project_pool_adjustments to service_role).
//
// Ports the pure cascade/transfer math from src/services/monthlyApportionment.js
// verbatim — keep the two in sync if the algorithm changes; there is
// intentionally no shared import since frontend code and Deno edge code don't
// share a build step here.
//
// Auth shape follows supabase/functions/bedrock-chat/index.ts: a per-request
// client built from the caller's own Authorization header identifies the user
// and (via that project's projects_write RLS policy) verifies they may write
// to the target project, before a separate service-role client performs the
// privileged read/write.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ─── Ported from monthlyApportionment.js (pure functions, no I/O) ─────────────

const monthsInRange = (startDate: string, endDate: string) => {
  if (!startDate || !endDate) return []
  const [sy, sm] = startDate.split('-').map(Number)
  const [ey, em] = endDate.split('-').map(Number)
  const months: string[] = []
  let cy = sy
  let cm = sm
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

const computeWorkingPool = (project: any) => {
  const pv = project.project_value || project.project_valuation || 0
  const adminPct = project.admin_pct ?? 5
  const hrPct = project.hr_pct ?? 5
  const corePct = project.core_pct ?? 5
  const projectPct = 100 - adminPct - hrPct - corePct
  return Math.round(pv * (projectPct / 100) * 100) / 100
}

const computeFlatMonthlyRate = (project: any, pool: string) => {
  const pv = project.project_value || project.project_valuation || 0
  const pct = project[`${pool}_pct`] ?? 5
  const months = monthsInRange(project.start_date, project.end_date)
  if (months.length === 0) return 0
  return Math.round(((pv * (pct / 100)) / months.length) * 100) / 100
}

const sumPoolAdjustments = (adjustments: any[], pool: string, month: string) =>
  Math.round(
    (adjustments || [])
      .filter((a) => a.pool === pool && a.month === month)
      .reduce((s, a) => s + (a.amount || 0), 0) * 100,
  ) / 100

const sumManualPoolAdjustments = (adjustments: any[], month: string) =>
  Math.round(
    (adjustments || [])
      .filter((a) => a.source === 'manual' && a.month === month && a.pool !== 'project')
      .reduce((s, a) => s + (a.amount || 0), 0) * 100,
  ) / 100

const computeMonthBaseline = (project: any) => {
  const months = monthsInRange(project.start_date, project.end_date)
  if (months.length === 0) return 0
  return Math.round((computeWorkingPool(project) / months.length) * 100) / 100
}

const computeMonthHRCore = (project: any) =>
  Math.round(
    (computeFlatMonthlyRate(project, 'hr') + computeFlatMonthlyRate(project, 'core')) * 100,
  ) / 100

const computeCascadeAdjustments = (project: any) => {
  const plan = project.monthly_plan || []
  const allMonths = plan.map((m: any) => m.month)
  const baseline = computeMonthBaseline(project)
  const adjustments: any[] = []

  const capacityRemaining: Record<string, number> = {}
  allMonths.forEach((m: string) => {
    capacityRemaining[m] = computeMonthHRCore(project)
  })

  const pushSplit = (month: string, total: number) => {
    if (total <= 0) return
    const hrShare = Math.round((total / 2) * 100) / 100
    const coreShare = Math.round((total - hrShare) * 100) / 100
    adjustments.push({ pool: 'hr', month, amount: hrShare, source: 'auto_cascade' })
    adjustments.push({ pool: 'core', month, amount: coreShare, source: 'auto_cascade' })
    capacityRemaining[month] = Math.round((capacityRemaining[month] - total) * 100) / 100
  }

  const distributeCapped = (amount: number, targetMonths: string[]) => {
    let remaining = Math.round(amount * 100) / 100
    let pool = targetMonths.filter((mm) => capacityRemaining[mm] > 0)

    while (remaining > 0 && pool.length > 0) {
      const evenShare = Math.round((remaining / pool.length) * 100) / 100
      const saturated = pool.filter((mm) => capacityRemaining[mm] < evenShare)

      if (saturated.length === 0) {
        pool.forEach((mm, i) => {
          const isLast = i === pool.length - 1
          const take = isLast ? remaining : evenShare
          pushSplit(mm, take)
          remaining = Math.round((remaining - take) * 100) / 100
        })
        break
      }

      saturated.forEach((mm) => {
        const take = capacityRemaining[mm]
        pushSplit(mm, take)
        remaining = Math.round((remaining - take) * 100) / 100
      })
      pool = pool.filter((mm) => !saturated.includes(mm))
    }

    return Math.max(Math.round(remaining * 100) / 100, 0)
  }

  plan.forEach((m: any) => {
    const excess = Math.round((m.total - baseline) * 100) / 100
    if (excess <= 0) return

    const sameMonthPull = Math.min(excess, capacityRemaining[m.month])
    pushSplit(m.month, sameMonthPull)

    const remaining = Math.round((excess - sameMonthPull) * 100) / 100
    if (remaining <= 0) return

    const otherMonths = allMonths.filter((mm: string) => mm !== m.month)
    const unfunded = distributeCapped(remaining, otherMonths)

    if (unfunded > 0) {
      adjustments.push({ pool: 'admin', month: m.month, amount: unfunded, source: 'auto_cascade' })
    }
  })

  return adjustments
}

const computeMonthActualTotal = (monthEntry: any) =>
  Math.round(
    (monthEntry?.phases || []).reduce((s: number, ph: any) => s + (parseFloat(ph.actual) || 0), 0) *
      100,
  ) / 100

const computeActualVsPlannedTransfers = (project: any) => {
  const plan = project.monthly_plan || []
  const adjustments = project.pool_adjustments || []
  const transfers: any[] = []
  const appliedDelta: Record<string, number> = {}
  const effectivePlanned = (month: string, rawTotal: number) => {
    const manualDelta = sumManualPoolAdjustments(adjustments, month)
    const existingProjectTransfer = sumPoolAdjustments(adjustments, 'project', month)
    return rawTotal + manualDelta - existingProjectTransfer - (appliedDelta[month] || 0)
  }

  plan.forEach((m: any, idx: number) => {
    const rawTotal = m.total || 0
    const planned = effectivePlanned(m.month, rawTotal)
    const actual = computeMonthActualTotal(m)
    const excess = Math.round((actual - planned) * 100) / 100
    if (excess <= 0) return

    const nextMonth = plan[idx + 1]
    if (!nextMonth) return

    const nextRawTotal = nextMonth.total || 0
    const nextAvailable = effectivePlanned(nextMonth.month, nextRawTotal)
    const pull = Math.min(excess, Math.max(nextAvailable, 0))
    if (pull <= 0) return

    transfers.push({
      pool: 'project',
      month: nextMonth.month,
      amount: pull,
      source: 'actual_pull',
      counterMonth: m.month,
      reason: `Auto-pulled to cover ${m.month} overage`,
    })
    transfers.push({
      pool: 'project',
      month: m.month,
      amount: -pull,
      source: 'actual_pull',
      counterMonth: nextMonth.month,
      reason: `Auto-funded from ${nextMonth.month}`,
    })
    appliedDelta[nextMonth.month] = (appliedDelta[nextMonth.month] || 0) + pull
  })

  return transfers
}

// ─── DB month format is 'YYYY-MM-DD'; app format is 'YYYY-MM' ────────────────
const toDbMonth = (m: string | null) => (m && m.length === 7 ? `${m}-01` : m)
const fromDbMonth = (m: string | null) => (m ? String(m).slice(0, 7) : m)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const callerClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const {
    data: { user },
    error: authError,
  } = await callerClient.auth.getUser()
  if (authError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  let body: { projectId?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }
  const { projectId } = body
  if (!projectId) {
    return jsonResponse({ error: 'projectId is required' }, 400)
  }

  // Authorization: re-query the project through the CALLER's own client, so
  // the existing projects_write RLS policy (admin/coordinator, the project's
  // own PA, or an assigned PO) decides access — no separate copy of that
  // role/ownership logic to keep in sync here.
  const { data: authCheck, error: authCheckError } = await callerClient
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .maybeSingle()
  if (authCheckError || !authCheck) {
    return jsonResponse({ error: 'Forbidden' }, 403)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: project, error: projectError } = await admin
    .from('projects')
    .select('project_value, admin_pct, hr_pct, core_pct, start_date, end_date')
    .eq('id', projectId)
    .maybeSingle()
  if (projectError || !project) {
    return jsonResponse({ error: 'Project not found' }, 404)
  }

  const { data: monthRows, error: monthError } = await admin
    .from('project_monthly_plan')
    .select('month, total, project_monthly_plan_phases(amount, actual)')
    .eq('project_id', projectId)
  if (monthError) {
    return jsonResponse({ error: `Failed to load monthly plan: ${monthError.message}` }, 500)
  }

  const monthlyPlan = (monthRows || [])
    .map((m: any) => ({
      month: fromDbMonth(m.month),
      total: Number(m.total) || 0,
      phases: (m.project_monthly_plan_phases || []).map((ph: any) => ({
        amount: Number(ph.amount) || 0,
        actual: ph.actual,
      })),
    }))
    .sort((a: any, b: any) => a.month.localeCompare(b.month))

  const { data: adjRows, error: adjError } = await admin
    .from('project_pool_adjustments')
    .select('pool, month, amount, source, counter_month')
    .eq('project_id', projectId)
  if (adjError) {
    return jsonResponse({ error: `Failed to load pool adjustments: ${adjError.message}` }, 500)
  }

  const existingAdjustments = (adjRows || []).map((a: any) => ({
    pool: a.pool,
    month: fromDbMonth(a.month),
    amount: Number(a.amount) || 0,
    source: a.source,
    counterMonth: fromDbMonth(a.counter_month),
  }))
  const preservedAdjustments = existingAdjustments.filter(
    (a) => a.source !== 'auto_cascade' && a.source !== 'actual_pull',
  )

  const projectForCompute = { ...project, monthly_plan: monthlyPlan }
  const cascadeAdjustments = computeCascadeAdjustments(projectForCompute).map((a: any) => ({
    ...a,
    reason: 'Auto-funded from Project overage',
  }))
  const actualPullAdjustments = computeActualVsPlannedTransfers({
    ...projectForCompute,
    pool_adjustments: preservedAdjustments,
  })

  const { error: deleteError } = await admin
    .from('project_pool_adjustments')
    .delete()
    .eq('project_id', projectId)
    .in('source', ['auto_cascade', 'actual_pull'])
  if (deleteError) {
    return jsonResponse({ error: `Failed to clear old adjustments: ${deleteError.message}` }, 500)
  }

  const rows = [...cascadeAdjustments, ...actualPullAdjustments].map((a) => ({
    project_id: projectId,
    pool: a.pool,
    month: toDbMonth(a.month),
    amount: a.amount,
    source: a.source,
    reason: a.reason || null,
    counter_month: toDbMonth(a.counterMonth) || null,
    created_by: null,
  }))
  if (rows.length) {
    const { error: insertError } = await admin.from('project_pool_adjustments').insert(rows)
    if (insertError) {
      return jsonResponse({ error: `Failed to save pool adjustments: ${insertError.message}` }, 500)
    }
  }

  return jsonResponse({ ok: true, adjustmentCount: rows.length })
})
