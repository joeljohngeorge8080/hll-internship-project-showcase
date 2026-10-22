/**
 * forecastData.js — I/O + composition for Super Forecasting. Fetches from
 * the app's own services, normalises everything to monthly series, and
 * calls forecastEngine.js (pure math, no I/O) to turn those series into a
 * forecast. Exports the same names SuperForecastingPage.jsx used to export
 * directly, so the dashboard widgets that consume this logic didn't need
 * to change anything but their import path.
 *
 * Authoritative-actuals ruling (product decision, not relitigated here):
 * localOrgPool's HR/Admin/Core pool expenses are the real spend ledger for
 * closed months. localAdminExpenses (vendor contracts from the "Forecast
 * Expense" tab) is planning/commitment only — for closed months it isn't
 * added to spend at all (that would double-count the same rupees the pool
 * ledger already carries); for open months its annual_amount/12 is used as
 * a known, contractually-committed forward driver.
 */
import { localAdminExpenses } from './localAdminExpenses'
import { localGeneralExpenses } from './localGeneralExpenses'
import { localRecruitments } from './localRecruitments'
import { localInternships } from './localInternships'
import { localProjects } from './localProjects'
import { localOrgPool } from './localOrgPool'
import {
  computeEffectivePoolMonthly,
  computeEffectiveProjectMonthly,
  computeMonthActualTotal,
  monthsInRange,
} from './monthlyApportionment'
import {
  monthsBetween,
  addMonths,
  monthKeyOf,
  projectSeries,
  composeMonth,
  newProjectValueNeeded,
} from './forecastEngine'

export { monthsBetween, addMonths, monthKeyOf }

const round2 = (n) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100

/** 'YYYY-MM' for right now, from LOCAL time — never UTC (a UTC month key is
 *  wrong for up to 5.5 hours after midnight IST on the 1st of every month). */
export const currentMonthLocal = () => monthKeyOf(new Date())

/** A month is "closed" (has real actuals) once it's strictly before the
 *  current month — the current month is still in progress. */
const isClosedMonth = (m, current) => m < current

// ── HR revenue, date-proxied (no schema change — see plan) ──────────────────
// recruitment/training → month of interview_date ?? date_applied ?? created_at
// internship → amount_received spread evenly across monthsInRange(start,end),
// falling back to created_at when the internship has no usable date range.
// Anything left with no usable date at all lands in `unattributed`, excluded
// from every per-month figure rather than silently folded into some month.

const emptyHrMonth = () => ({ recruitment: 0, training: 0, internship: 0 })

const buildHRRevenueByMonth = async () => {
  const byMonth = {}
  let unattributed = 0
  const add = (month, kind, amount) => {
    if (!amount) return
    if (!month) {
      unattributed += amount
      return
    }
    byMonth[month] = byMonth[month] || emptyHrMonth()
    byMonth[month][kind] += amount
  }

  const rec = await localRecruitments.list()
  rec.forEach((r) => {
    const amount = parseFloat(r.amount_received) || 0
    const month = (r.interview_date || r.date_applied || r.created_at || '').slice(0, 7)
    const kind = (r.activity_type || 'recruitment') === 'training' ? 'training' : 'recruitment'
    add(month || null, kind, amount)
  })

  const interns = await localInternships.list()
  interns.forEach((r) => {
    const amount = parseFloat(r.amount_received) || 0
    if (!amount) return
    const months = monthsInRange(r.start_date, r.end_date)
    if (months.length === 0) {
      add((r.created_at || '').slice(0, 7) || null, 'internship', amount)
      return
    }
    const share = amount / months.length
    months.forEach((m) => add(m, 'internship', share))
  })

  return { byMonth, unattributed: round2(unattributed) }
}

/** All-time HR revenue summary (recruitment/training/internship + total),
 *  plus how much of it couldn't be attributed to any month. Used where a
 *  period-independent figure is wanted — the per-month/per-period P&L
 *  figures below use buildHRRevenueByMonth's month map instead, so a
 *  narrower date range can't inflate or hide revenue that falls outside it. */
export const computeHRRevenueBreakdown = async () => {
  const { byMonth, unattributed } = await buildHRRevenueByMonth()
  const totals = Object.values(byMonth).reduce(
    (acc, m) => ({
      recruitment: acc.recruitment + m.recruitment,
      training: acc.training + m.training,
      internship: acc.internship + m.internship,
    }),
    emptyHrMonth(),
  )
  return {
    recruitment: round2(totals.recruitment),
    training: round2(totals.training),
    internship: round2(totals.internship),
    total: round2(totals.recruitment + totals.training + totals.internship),
    unattributed,
  }
}

// ── Spend drivers ─────────────────────────────────────────────────────────

/** Pool ledger (localOrgPool) HR+Admin+Core expenses — the authoritative
 *  actual-spend record. */
const buildPoolExpenseActuals = async () => {
  const [hr, admin, core] = await Promise.all([
    localOrgPool.getHRExpenses(),
    localOrgPool.getAdminExpenses(),
    localOrgPool.getCoreExpenses(),
  ])
  return [...hr, ...admin, ...core]
}

const groupAmountByMonth = (entries) => {
  const byMonth = {}
  entries.forEach((e) => {
    if (!e.date) return
    byMonth[e.date] = (byMonth[e.date] || 0) + (parseFloat(e.amount) || 0)
  })
  return byMonth
}

/** localGeneralExpenses' "Outsourced Services" category, kept as its own
 *  labelled spend line — see the plan's open question: whether this
 *  overlaps with pool expenses wasn't covered by the pool-is-authoritative
 *  ruling, so it's surfaced separately rather than folded in silently. */
const buildOutsourcedServicesByMonth = async () => {
  const cats = await localGeneralExpenses.categories.list()
  const outsourced = cats.find((c) => c.name === 'Outsourced Services')
  if (!outsourced) return {}
  const { items } = await localGeneralExpenses.expenses.list({
    category_id: outsourced.id,
    page_size: 500,
  })
  const byMonth = {}
  items.forEach((e) => {
    const m = `${e.year}-${String(e.month).padStart(2, '0')}`
    byMonth[m] = (byMonth[m] || 0) + (parseFloat(e.actual_amount) || 0)
  })
  return byMonth
}

/** Active vendor-contract commitments (localAdminExpenses), as a flat
 *  monthly driver for open months — annual_amount / 12, same "monthly
 *  equivalent" convention the Forecast Expense tab already uses. */
const buildAdminCommitmentMonthly = async () => {
  const active = await localAdminExpenses.list({ status: 'Active' })
  const total = active.reduce((s, e) => s + (parseFloat(e.annual_amount) || 0) / 12, 0)
  const hrTotal = active
    .filter((e) => e.group === 'HR')
    .reduce((s, e) => s + (parseFloat(e.annual_amount) || 0) / 12, 0)
  return { total: round2(total), hrTotal: round2(hrTotal), count: active.length }
}

/** Contiguous, 0-filled monthly series from the earliest known pool-expense
 *  month through `uptoMonth` — Holt needs evenly-spaced calendar months, not
 *  a sparse list of only the months that happen to have data (that sparse
 *  weighting was the old forecastFrom()'s bug). */
const buildHistoricalPoolSeries = (poolByMonth, uptoMonth) => {
  const known = Object.keys(poolByMonth)
    .filter((m) => m <= uptoMonth)
    .sort()
  if (known.length === 0) return []
  return monthsBetween(known[0], uptoMonth).map((m) => poolByMonth[m] || 0)
}

// ── Profit/Loss ───────────────────────────────────────────────────────────

/**
 * Builds the full Profit/Loss picture for [rangeStart, rangeEnd]: a signed
 * per-month net (earn − spend, never clamped at 0), a running cumulative
 * balance, and a period verdict. Closed months use real actuals; open
 * months use a driver-based forecast — known commitments carried forward
 * exactly, plus a Holt-linear trend + residual band over the volatile
 * remainder (the historical pool-expense series only, not the whole blended
 * total — that's what lets the interval correctly narrow in a month that's
 * mostly contractually committed).
 */
export const computeProfitLossTotals = async (rangeStart, rangeEnd) => {
  const months = monthsBetween(rangeStart, rangeEnd)
  const current = currentMonthLocal()
  const lastClosedMonth = addMonths(current, -1)

  const [projectsRes, poolExpenseEntries, outsourcedByMonth, hrRevenue, adminCommitment] =
    await Promise.all([
      localProjects.list({ pageSize: 1000 }),
      buildPoolExpenseActuals(),
      buildOutsourcedServicesByMonth(),
      buildHRRevenueByMonth(),
      buildAdminCommitmentMonthly(),
    ])

  const projects = projectsRes.items.filter((p) => p.monthly_plan?.length > 0)
  const poolByMonth = groupAmountByMonth(poolExpenseEntries)
  const historicalSeries = buildHistoricalPoolSeries(poolByMonth, lastClosedMonth)

  // One Holt projection covers the whole horizon this range needs, indexed
  // by 1-based month offset from the first open month.
  const firstOpenMonth = addMonths(lastClosedMonth, 1)
  const maxOffset = months.reduce((max, m) => {
    if (!(m > lastClosedMonth)) return max
    return Math.max(max, monthsBetween(firstOpenMonth, m).length)
  }, 0)
  const volatileBands = projectSeries(historicalSeries, maxOffset)
  const volatileBandFor = (m) => {
    const offset = monthsBetween(firstOpenMonth, m).length
    return volatileBands[offset - 1] || { p10: 0, p50: 0, p90: 0 }
  }

  let shares = 0
  let hrRevenueInRange = 0
  let poolActualInRange = 0
  let projectActualInRange = 0
  let outsourcedInRange = 0
  let committedInRange = 0
  let estimatedInRange = 0
  let cumulative = 0

  const monthRows = months.map((m) => {
    const closed = isClosedMonth(m, current)
    let projectSpend = 0
    let shareRevenue = 0
    projects.forEach((p) => {
      const monthEntry = (p.monthly_plan || []).find((e) => e.month === m)
      if (!monthEntry) return
      projectSpend += closed
        ? computeMonthActualTotal(monthEntry)
        : computeEffectiveProjectMonthly(p, m)
      shareRevenue +=
        computeEffectivePoolMonthly(p, 'admin', m) +
        computeEffectivePoolMonthly(p, 'hr', m) +
        computeEffectivePoolMonthly(p, 'core', m)
    })

    const hrRow = hrRevenue.byMonth[m] || emptyHrMonth()
    const hrMonthTotal = hrRow.recruitment + hrRow.training + hrRow.internship
    const earn = round2(shareRevenue + hrMonthTotal)

    let spend
    if (closed) {
      const poolAmount = poolByMonth[m] || 0
      const outsourced = outsourcedByMonth[m] || 0
      const total = round2(poolAmount + projectSpend + outsourced)
      spend = { committed: total, estimated: 0, p10: total, p50: total, p90: total }
      poolActualInRange += poolAmount
      projectActualInRange += projectSpend
      outsourcedInRange += outsourced
    } else {
      const committed = round2(adminCommitment.total + projectSpend)
      spend = composeMonth({ committed, volatileBand: volatileBandFor(m) })
      committedInRange += committed
      estimatedInRange += spend.estimated
    }

    const net = round2(earn - spend.p50)
    cumulative = round2(cumulative + net)
    shares += shareRevenue
    hrRevenueInRange += hrMonthTotal

    return {
      month: m,
      isForecast: !closed,
      source: closed ? 'actual' : 'forecast',
      spend,
      totalExpense: spend.p50,
      shareRevenue: earn,
      hrRevenue: round2(hrMonthTotal),
      net,
      cumulative,
    }
  })

  const spendTotal = round2(monthRows.reduce((s, r) => s + r.totalExpense, 0))
  const earnTotal = round2(monthRows.reduce((s, r) => s + r.shareRevenue, 0))
  const netTotal = round2(earnTotal - spendTotal)

  // Float equality on a sum of rounded rupees is never exact — half a rupee
  // either way still counts as "covered", not a phantom gap or surplus.
  const EPS = 0.5
  const isProfit = netTotal >= -EPS
  const gapAmount = isProfit ? 0 : round2(-netTotal)
  const surplus = netTotal > EPS ? round2(netTotal) : 0
  const gapSharePct = spendTotal > 0 ? round2((gapAmount / spendTotal) * 100) : 0
  const firstNegativeMonth = monthRows.find((r) => r.cumulative < -EPS)?.month || null

  const poolExpensesInRange = poolExpenseEntries.filter(
    (e) => e.date >= rangeStart && e.date <= rangeEnd,
  )

  return {
    monthRows,
    hrRevenueTotal: round2(hrRevenueInRange),
    hrRevenueUnattributed: hrRevenue.unattributed,
    shares: round2(shares),
    operating: round2(committedInRange), // forward commitment driver (admin contracts + planned project spend)
    project: round2(projectActualInRange),
    poolExpenses: {
      totalAmount: round2(poolExpensesInRange.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)),
      count: poolExpensesInRange.length,
    },
    projectCount: projects.length,
    committedSpend: round2(committedInRange),
    estimatedSpend: round2(estimatedInRange),
    outsourcedSpend: round2(outsourcedInRange),
    poolActualSpend: round2(poolActualInRange),
    projectActualSpend: round2(projectActualInRange),
    expenses: spendTotal,
    ownRevenue: earnTotal,
    net: netTotal,
    gapAmount,
    surplus,
    gapSharePct,
    isProfit,
    firstNegativeMonth,
    lastClosedMonth,
    currentMonth: current,
  }
}

// ── Gap-reduction plan ────────────────────────────────────────────────────

/**
 * Reverse-calculator: how much new project value would be needed to close
 * the funding gap (or grow a surplus) by targetPct%, using the
 * duration-aware formula (a project's own duration vs. the picked period's
 * length matter — see forecastEngine.newProjectValueNeeded).
 */
export const computeGapReductionPlan = async (totals, targetPct) => {
  const projects = (await localProjects.list({ pageSize: 1000 })).items.filter(
    (p) => p.status === 'active' || p.status === 'ongoing',
  )

  const totalValue = projects.reduce((s, p) => s + (p.project_value || p.project_valuation || 0), 0)
  const weightedPctSum = projects.reduce((s, p) => {
    const pv = p.project_value || p.project_valuation || 0
    const combinedPct = (p.admin_pct ?? 5) + (p.hr_pct ?? 5) + (p.core_pct ?? 5)
    return s + pv * combinedPct
  }, 0)
  const weightedDurationSum = projects.reduce((s, p) => {
    const pv = p.project_value || p.project_valuation || 0
    return s + pv * monthsInRange(p.start_date, p.end_date).length
  }, 0)
  const avgCombinedPct = totalValue > 0 ? weightedPctSum / totalValue : 15
  const avgDurationMonths = totalValue > 0 ? weightedDurationSum / totalValue : 0
  const periodMonths = totals.monthRows?.length || 0

  const baseAmount = totals.isProfit ? totals.surplus : totals.gapAmount
  const targetReduction = baseAmount * ((targetPct || 0) / 100)
  const neededNewProjectValue = newProjectValueNeeded({
    targetReduction,
    combinedPct: avgCombinedPct,
    avgDurationMonths,
    periodMonths,
  })
  const avgProjectSize = projects.length > 0 ? totalValue / projects.length : 0
  const approxProjectsNeeded =
    avgProjectSize > 0 ? Math.ceil(neededNewProjectValue / avgProjectSize) : null

  return {
    avgCombinedPct: round2(avgCombinedPct),
    avgDurationMonths: round2(avgDurationMonths),
    periodMonths,
    baseAmount: round2(baseAmount),
    targetReduction: round2(targetReduction),
    neededNewProjectValue,
    avgProjectSize: round2(avgProjectSize),
    approxProjectsNeeded,
  }
}

// ── Pool health & expense glance ──────────────────────────────────────────

/** Plain OK/Watch/Over Budget health label for one pool's monthly summary —
 *  same 85%/100% threshold convention already used by GeneralExpenseWidget.jsx. */
export const poolHealth = (summary) => {
  if (!summary || summary.totalMonthlyBudget <= 0) return { label: 'No Data', color: 'secondary' }
  const pct = (summary.usedThisMonth / summary.totalMonthlyBudget) * 100
  if (pct > 100) return { label: 'Over Budget', color: 'danger' }
  if (pct > 85) return { label: 'Watch', color: 'warning' }
  return { label: 'OK', color: 'success' }
}

/**
 * Expense counts + per-pool budget health for a period — the "Expenses at a
 * Glance" section. `month` (default: this month, LOCAL time) is passed
 * explicitly to the pool-summary calls rather than relying on their own
 * UTC-based default, which used to read as last month for the first 5.5
 * hours of every month in IST.
 */
export const computeExpenseGlance = async (totals, month) => {
  const targetMonth = month || currentMonthLocal()
  const operatingCount = (await localAdminExpenses.list({ status: 'Active' })).length
  return {
    operatingCount,
    poolCount: totals.poolExpenses.count,
    projectCount: totals.projectCount,
    hr: poolHealth(await localOrgPool.getMonthlyHRPoolBudgetSummary(targetMonth)),
    admin: poolHealth(await localOrgPool.getMonthlyAdminPoolBudgetSummary(targetMonth)),
    core: poolHealth(await localOrgPool.getMonthlyCorePoolBudgetSummary(targetMonth)),
  }
}

/**
 * HR's own cost vs HR revenue, for the "How Is HR Doing?" section. Closed
 * months use the pool ledger's actual HR spend; open months use the HR-
 * tagged admin-expense commitment driver — same actual/commitment split as
 * computeProfitLossTotals, applied to just the HR slice.
 */
export const computeHRHealth = async (rangeStart, rangeEnd, hrRevenueTotal) => {
  const months = monthsBetween(rangeStart, rangeEnd)
  const current = currentMonthLocal()

  const [hrExpenses, adminCommitment] = await Promise.all([
    localOrgPool.getHRExpenses(),
    buildAdminCommitmentMonthly(),
  ])
  const hrPoolByMonth = groupAmountByMonth(hrExpenses)

  const totalCost = round2(
    months.reduce((sum, m) => {
      if (isClosedMonth(m, current)) return sum + (hrPoolByMonth[m] || 0)
      return sum + adminCommitment.hrTotal
    }, 0),
  )

  const coveragePct =
    totalCost > 0 ? Math.min(100, Math.round((hrRevenueTotal / totalCost) * 100)) : null
  return { totalCost, coveragePct }
}
