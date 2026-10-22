/**
 * monthlyApportionment.js — Pure math for project monthly planning
 * (spec: docs/superpowers/specs/2026-07-02-hr-core-admin-monthly-apportionment-design.md,
 * Sections 2-4). No localStorage or other I/O — every function is a plain
 * data-in/data-out transform so it's testable without a browser.
 *
 * computeCascadeAdjustments and computeActualVsPlannedTransfers are ported
 * verbatim into supabase/functions/apportionment-engine/index.ts, which is
 * now the only place that actually writes their output (project_pool_adjustments'
 * RLS forbids a client from writing auto_cascade/actual_pull rows directly —
 * see 00000000000054_lock_pool_adjustments_writes.sql). Keep the two in sync
 * if this algorithm changes. The rest of this file (validation, live-preview
 * figures) is still called directly from the frontend.
 */

/**
 * Working pool = the project's own baseline share of total value — the
 * residual after Admin, HR, and Core's percentages (each independently
 * pct% of total value, not carved out of this pool). This is what the
 * monthly plan (generateMonthlyPlan) must sum to.
 */
export const computeWorkingPool = (project) => {
  const pv = project.project_value || project.project_valuation || 0
  const adminPct = project.admin_pct ?? 5
  const hrPct = project.hr_pct ?? 5
  const corePct = project.core_pct ?? 5
  const projectPct = 100 - adminPct - hrPct - corePct
  return Math.round(pv * (projectPct / 100) * 100) / 100
}

/**
 * Every calendar month from start to end (both 'YYYY-MM-DD' or 'YYYY-MM'),
 * inclusive. Returns at least one month.
 */
export const monthsInRange = (startDate, endDate) => {
  if (!startDate || !endDate) return []
  const [sy, sm] = startDate.split('-').map(Number)
  const [ey, em] = endDate.split('-').map(Number)
  const months = []
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

/** Sum of every month's total in a monthly plan. */
export const sumPlanTotal = (monthlyPlan) =>
  Math.round((monthlyPlan || []).reduce((s, m) => s + (m.total || 0), 0) * 100) / 100

/**
 * A plan is valid only when its total exactly matches the working pool
 * (spec Section 3) — within a half-paisa rounding tolerance.
 */
export const validatePlanTotal = (monthlyPlan, workingPool) => {
  const planTotal = sumPlanTotal(monthlyPlan)
  const diff = Math.round((planTotal - workingPool) * 100) / 100
  return { valid: Math.abs(diff) < 0.01, planTotal, workingPool, diff }
}

/**
 * Flat monthly rate for one pool ('admin'|'hr'|'core') — pct% of total
 * project value, divided evenly across the project's duration. Identical
 * every month; recomputed live from current project fields, never cached.
 */
export const computeFlatMonthlyRate = (project, pool) => {
  const pv = project.project_value || project.project_valuation || 0
  const pct = project[`${pool}_pct`] ?? 5
  const months = monthsInRange(project.start_date, project.end_date)
  if (months.length === 0) return 0
  return Math.round(((pv * (pct / 100)) / months.length) * 100) / 100
}

/** Sum of adjustment amounts recorded against one exact (pool, month) pair. */
export const sumPoolAdjustments = (adjustments, pool, month) =>
  Math.round(
    (adjustments || [])
      .filter((a) => a.pool === pool && a.month === month)
      .reduce((s, a) => s + (a.amount || 0), 0) * 100,
  ) / 100

/**
 * Effective monthly figure for one pool/month after manual withdrawals:
 * the flat rate minus every adjustment recorded against that exact
 * (pool, month) pair. Not clamped at 0 — a negative figure legitimately
 * represents a pool in deficit for that project that month; callers that
 * display this should warn, not block, on a negative result.
 */
export const computeEffectivePoolMonthly = (project, pool, month) => {
  const flat = computeFlatMonthlyRate(project, pool)
  const withdrawn = sumPoolAdjustments(project.pool_adjustments, pool, month)
  return Math.round((flat - withdrawn) * 100) / 100
}

/**
 * Sum of every manual pool_adjustment delta (admin+hr+core) recorded
 * against one exact month, regardless of which pool. Excludes
 * auto_cascade adjustments — those already fund an overage the month's
 * raw phase total already includes, so folding them in here would
 * double-count the same rupees.
 */
export const sumManualPoolAdjustments = (adjustments, month) =>
  Math.round(
    (adjustments || [])
      .filter((a) => a.source === 'manual' && a.month === month && a.pool !== 'project')
      .reduce((s, a) => s + (a.amount || 0), 0) * 100,
  ) / 100

/**
 * A month's Project Total after folding in manual pool reallocation: a
 * pool reduction (positive delta) adds to Project; a manual top-up above
 * the flat rate (negative delta) subtracts from it. Symmetric by
 * construction — the same delta is subtracted from the pool's own
 * effective figure (computeEffectivePoolMonthly) and added here, so the
 * two changes cancel and a month's grand total (Project + Admin + HR +
 * Core) is unaffected by any manual reallocation. Not clamped at 0 for
 * the same reason computeEffectivePoolMonthly isn't — a large enough
 * cross-pool top-up can legitimately push this negative.
 */
export const computeEffectiveProjectMonthly = (project, month) => {
  const monthEntry = (project.monthly_plan || []).find((m) => m.month === month)
  const rawTotal = monthEntry?.total || 0
  const manualDelta = sumManualPoolAdjustments(project.pool_adjustments, month)
  const projectTransfer = sumPoolAdjustments(project.pool_adjustments, 'project', month)
  return Math.round((rawTotal + manualDelta - projectTransfer) * 100) / 100
}

/**
 * A pool's effective monthly figure re-expressed as a % of that month's
 * slice of total project value (project_value ÷ duration). Purely a
 * derived display/edit convenience — there is no separate stored
 * per-month percentage; an unedited month always shows exactly the
 * project's own admin_pct/hr_pct/core_pct, since flat rate ÷ monthly
 * value recovers it exactly by construction.
 */
export const computeEffectivePoolPct = (project, pool, month) => {
  const pv = project.project_value || project.project_valuation || 0
  const months = monthsInRange(project.start_date, project.end_date)
  if (months.length === 0 || pv === 0) return 0
  const monthlyValue = pv / months.length
  const amount = computeEffectivePoolMonthly(project, pool, month)
  return Math.round((amount / monthlyValue) * 100 * 100) / 100
}

/**
 * A project's normal Project-column share for one month — the working
 * pool spread evenly across the project's duration. This is the "baseline"
 * (B) a month's Project total is compared against to decide whether it
 * needs to borrow from HR/Core.
 */
export const computeMonthBaseline = (project) => {
  const months = monthsInRange(project.start_date, project.end_date)
  if (months.length === 0) return 0
  return Math.round((computeWorkingPool(project) / months.length) * 100) / 100
}

/**
 * One month's own combined HR+Core flat capacity (HC) — the amount a
 * Project overage can draw from that same month before needing to reach
 * into other months. `month` is accepted for API symmetry with other
 * per-month functions even though the flat rate is month-independent today.
 */
export const computeMonthHRCore = (project, month) =>
  Math.round(
    (computeFlatMonthlyRate(project, 'hr') + computeFlatMonthlyRate(project, 'core')) * 100,
  ) / 100

/**
 * Derives the auto_cascade pool_adjustments a monthly plan implies: when a
 * month's Project total (P) exceeds its baseline share (B), the excess is
 * funded by pulling from HR/Core — first that same month's own HR+Core
 * capacity (HC), split 50/50, then, if the excess is larger than HC, the
 * remainder is spread across every OTHER month's HR+Core (also split 50/50
 * within each), capped at whatever capacity each month actually has left —
 * a month already drained by a previous excess in this same pass (or by its
 * own same-month pull) cannot be double-drawn. If the excess still can't be
 * fully placed after every month's HR+Core capacity is exhausted, the
 * remainder is drawn from that month's own Admin share instead — Admin is
 * the funder of last resort so HR/Core are never pushed into deficit by a
 * plan that overcommits past the entire project's combined capacity (Admin
 * itself is not clamped at 0 for the same reason HR/Core effective figures
 * aren't — see computeEffectivePoolMonthly).
 *
 * Pure function of the project's current monthly_plan; does not read or
 * preserve any existing pool_adjustments — the caller (the
 * apportionment-engine Edge Function) merges this against manual ones.
 *
 * Every split below computes one side and derives the other as the exact
 * remainder (never rounding both sides independently), and each capped
 * round's last recipient absorbs any leftover rounding — so the sum of
 * every adjustment this function creates for one month's excess always
 * equals that excess exactly, to the paisa. This matters:
 * validatePlanTotalWithCascade compares the raw plan total against
 * workingPool + (sum of every auto_cascade amount), and that comparison
 * only tolerates half a paisa of drift — independent per-record rounding
 * would silently accumulate past that tolerance on an uneven split (e.g.
 * spreading ₹5,000 across 9 months) and produce a false "Off by X".
 */
export const computeCascadeAdjustments = (project) => {
  const plan = project.monthly_plan || []
  const allMonths = plan.map((m) => m.month)
  const baseline = computeMonthBaseline(project)
  const adjustments = []

  // Shared, mutated across the whole pass — once a month's HR+Core capacity
  // funds one overage (its own or another month's), it can't fund a second.
  const capacityRemaining = {}
  allMonths.forEach((m) => {
    capacityRemaining[m] = computeMonthHRCore(project, m)
  })

  const pushSplit = (month, total) => {
    if (total <= 0) return
    const hrShare = Math.round((total / 2) * 100) / 100
    const coreShare = Math.round((total - hrShare) * 100) / 100
    adjustments.push({ pool: 'hr', month, amount: hrShare, source: 'auto_cascade' })
    adjustments.push({ pool: 'core', month, amount: coreShare, source: 'auto_cascade' })
    capacityRemaining[month] = Math.round((capacityRemaining[month] - total) * 100) / 100
  }

  // Spreads `amount` across `targetMonths`, as evenly as possible, never
  // drawing a month past its own remaining capacity. Months whose capacity
  // is smaller than an even share are drained fully and dropped, then the
  // rest is re-divided among what's left (classic water-filling) — this
  // terminates because each non-final round removes at least one month.
  // Returns whatever amount had nowhere left to go.
  const distributeCapped = (amount, targetMonths) => {
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

  plan.forEach((m) => {
    const excess = Math.round((m.total - baseline) * 100) / 100
    if (excess <= 0) return

    const sameMonthPull = Math.min(excess, capacityRemaining[m.month])
    pushSplit(m.month, sameMonthPull)

    const remaining = Math.round((excess - sameMonthPull) * 100) / 100
    if (remaining <= 0) return

    const otherMonths = allMonths.filter((mm) => mm !== m.month)
    const unfunded = distributeCapped(remaining, otherMonths)

    if (unfunded > 0) {
      adjustments.push({ pool: 'admin', month: m.month, amount: unfunded, source: 'auto_cascade' })
    }
  })

  return adjustments
}

/** Sum of a month's phase-line `actual` figures. Blank/unset lines count as 0. */
export const computeMonthActualTotal = (monthEntry) =>
  Math.round(
    (monthEntry?.phases || []).reduce((s, ph) => s + (parseFloat(ph.actual) || 0), 0) * 100,
  ) / 100

/**
 * Derives the 'actual_pull' pool_adjustments a monthly plan's actual-vs-
 * planned figures imply: processing months chronologically, when a
 * month's actual total exceeds its *effective* planned total (raw plan
 * total plus/minus any transfer already applied to it earlier in this
 * same pass), the excess is pulled from the immediately next month's
 * effective planned total, capped at whatever that month currently has
 * available. Never reaches past the next month — an excess bigger than
 * next month's capacity, or a last-month excess with no next month, is
 * simply not represented by an adjustment for the uncovered remainder
 * (the UI flags it directly from the raw numbers, nothing is forced).
 * Pure function of the project's current monthly_plan and
 * pool_adjustments; does not read or preserve any existing 'actual_pull'
 * records itself — the caller (the apportionment-engine Edge Function)
 * discards old ones and replaces them with this function's fresh output,
 * the same convention computeCascadeAdjustments already uses for
 * 'auto_cascade'. The caller must pass pool_adjustments with any stale
 * 'actual_pull' records already stripped out, or this function will
 * double-subtract them when computing effective planned figures.
 */
export const computeActualVsPlannedTransfers = (project) => {
  const plan = project.monthly_plan || []
  const adjustments = project.pool_adjustments || []
  const transfers = []
  const appliedDelta = {}
  const effectivePlanned = (month, rawTotal) => {
    const manualDelta = sumManualPoolAdjustments(adjustments, month)
    const existingProjectTransfer = sumPoolAdjustments(adjustments, 'project', month)
    return rawTotal + manualDelta - existingProjectTransfer - (appliedDelta[month] || 0)
  }

  plan.forEach((m, idx) => {
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

/**
 * Same balance check as validatePlanTotal, but a month's overage that's
 * fully funded by an auto_cascade pull no longer counts against it — only
 * a genuine, uncovered shortfall does. Reuses validatePlanTotal by raising
 * the comparison baseline by however much was actually pulled via cascade:
 * every cascaded rupee exists specifically to fund an overage, so total
 * pulled always equals total funded, by construction.
 */
export const validatePlanTotalWithCascade = (monthlyPlan, workingPool, poolAdjustments) => {
  const totalCascadePulled =
    Math.round(
      (poolAdjustments || [])
        .filter((a) => a.source === 'auto_cascade')
        .reduce((s, a) => s + (a.amount || 0), 0) * 100,
    ) / 100
  return validatePlanTotal(monthlyPlan, workingPool + totalCascadePulled)
}
