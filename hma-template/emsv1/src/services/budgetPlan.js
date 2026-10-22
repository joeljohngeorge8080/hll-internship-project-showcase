/**
 * budgetPlan.js — Pure math for the two-phase project budget plan
 * (spec: docs/superpowers/specs/2026-07-15-budget-plan-two-phase-design.md).
 * No localStorage or other I/O, and NO imports of any other module —
 * every function is a plain data-in/data-out transform, and the file must
 * stay import-free so it loads standalone via scripts/load-esm-source.mjs.
 * (monthsInRange is intentionally duplicated from monthlyApportionment.js
 * for this reason, not shared.)
 */

/** Every calendar month from start to end ('YYYY-MM' or 'YYYY-MM-DD'), inclusive. */
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

/**
 * Splits `amount` into `count` shares that sum to it exactly, in paise —
 * every share is the floor share except the last, which absorbs whatever
 * paise remain. This is the one splitting rule used everywhere in this
 * module (Send/Take to multiple months, HR/Core 50/50).
 */
export const equalSplit = (amount, count) => {
  if (count <= 0) return []
  const totalPaise = Math.round(amount * 100)
  const basePaise = Math.floor(totalPaise / count)
  const shares = Array(count).fill(basePaise)
  shares[count - 1] += totalPaise - basePaise * count
  return shares.map((p) => p / 100)
}

/** Working pool = project value minus Admin/HR/Core's independent percentages. */
export const computeWorkingPool = (projectValue, poolPct) => {
  const projectPct = 100 - (poolPct.admin || 0) - (poolPct.hr || 0) - (poolPct.core || 0)
  return Math.round(projectValue * (projectPct / 100) * 100) / 100
}

/**
 * A single representative "if split evenly" figure — display convenience
 * only (e.g. "₹X/month if split evenly"). NOT exact when workingPool
 * doesn't divide evenly by monthCount (the remainder paisa would be
 * dropped) — any computation that must sum back to workingPool exactly
 * (allocation math, invariant/settlement checks) must use monthBaselines
 * below instead, never this scalar.
 */
export const monthBaseline = (workingPool, monthCount) =>
  monthCount > 0 ? Math.round((workingPool / monthCount) * 100) / 100 : 0

/**
 * Exact per-month baseline shares of the working pool — equalSplit, so
 * the last month absorbs whatever paisa remain and the shares always sum
 * to workingPool exactly. This is the baseline every real allocation
 * computation (monthAllocated, validateTransfer, grandInvariantCheck,
 * settlementCheck) must use — monthBaseline's flat scalar is display-only.
 */
export const monthBaselines = (workingPool, months) => {
  const shares = equalSplit(workingPool, (months || []).length)
  return Object.fromEntries((months || []).map((m, i) => [m, shares[i]]))
}

/**
 * Net effect of the ledger on one entity (a month or a pool): every
 * transfer TO the entity adds, every transfer FROM it subtracts. This is
 * the only place the ledger is read — every other derived figure in this
 * module is baseline/base-rate plus this.
 */
export const netForEntity = (transfers, entityKey) =>
  Math.round(
    (transfers || []).reduce((s, t) => {
      if (t.to === entityKey) return s + t.amount
      if (t.from === entityKey) return s - t.amount
      return s
    }, 0) * 100,
  ) / 100

/** A month's current allocated budget: baseline plus/minus every transfer touching it. */
export const monthAllocated = (baseline, transfers, month) =>
  Math.round((baseline + netForEntity(transfers, `month:${month}`)) * 100) / 100

/** Sum of every subtask's planned_amount across a month's task list. */
export const monthPlannedTotal = (tasks) =>
  Math.round(
    (tasks || []).reduce(
      (s, t) =>
        s + (t.subtasks || []).reduce((ss, st) => ss + (parseFloat(st.planned_amount) || 0), 0),
      0,
    ) * 100,
  ) / 100

/** Sum of every subtask's actual_amount across a month's task list. */
export const monthActualTotal = (tasks) =>
  Math.round(
    (tasks || []).reduce(
      (s, t) =>
        s + (t.subtasks || []).reduce((ss, st) => ss + (parseFloat(st.actual_amount) || 0), 0),
      0,
    ) * 100,
  ) / 100

/**
 * A pool's current balance: its base rate (pct% of project value) plus/
 * minus every ledger transfer touching it. Never clamped here — clamping
 * happens at the point a transfer is validated (validateTransfer), so an
 * already-valid ledger can never produce a negative balance.
 */
export const poolBalance = (projectValue, poolPct, pool, transfers) => {
  const base = Math.round(((projectValue * (poolPct[pool] || 0)) / 100) * 100) / 100
  return Math.round((base + netForEntity(transfers, pool)) * 100) / 100
}

/**
 * How much of a month's allocated budget is not yet claimed. `totalsFn`
 * picks which side of a task's figures counts as "claimed" — planned
 * (the default, for planning-phase checks, where actual figures don't
 * exist/matter yet) or monthActualTotal (for actual-phase checks, where
 * planned already equals allocated by construction — settlement forced
 * that at submit — so the real spare amount is allocated minus what's
 * actually been spent so far, not minus the frozen planned figure).
 */
export const monthAvailableBalance = (
  baseline,
  transfers,
  monthTasksByMonth,
  month,
  totalsFn = monthPlannedTotal,
) =>
  Math.round(
    (monthAllocated(baseline, transfers, month) -
      totalsFn((monthTasksByMonth || {})[month] || [])) *
      100,
  ) / 100

const isPoolKey = (k) => k === 'hr' || k === 'core' || k === 'admin'
const isMonthKey = (k) => typeof k === 'string' && k.startsWith('month:')
const monthOf = (key) => key.slice('month:'.length)
// Compound key for a pool's per-month attribution, e.g. 'pool:hr:2026-04' —
// distinct from both a bare pool key (the pool's real, global balance) and
// a month key (that month's own project task budget). Moving money between
// two of these only ever shifts which month gets credit with contributing
// to a pool; it never touches monthAllocated or the pool's real balance,
// so grandInvariantCheck stays satisfied automatically without special-casing.
export const isPoolMonthKey = (k) => typeof k === 'string' && /^pool:(hr|core|admin):/.test(k)
export const poolMonthKey = (pool, month) => `pool:${pool}:${month}`
export const parsePoolMonthKey = (key) => {
  const [, pool, month] = key.split(':')
  return { pool, month }
}

/** This month's own static baseline share of `pool` — project value's pool
 * percentage split equally across every month in the plan. */
export const poolMonthBaseline = (projectValue, poolPct, pool, monthCount) =>
  monthCount > 0 ? (projectValue * (poolPct[pool] || 0)) / 100 / monthCount : 0

/** This month's own net contribution to `pool` — money that moved specifically
 * between THIS month and this pool (via the month's own budget, or via a
 * direct pool-to-pool reattribution with another month), never other months'
 * unrelated activity. Positive when the month is credited with more, negative
 * when less. */
export const poolNetForMonth = (transfers, pool, month) =>
  (transfers || []).reduce((s, t) => {
    if (t.from === `month:${month}` && t.to === pool) return s + t.amount
    if (t.to === `month:${month}` && t.from === pool) return s - t.amount
    if (t.to === poolMonthKey(pool, month)) return s + t.amount
    if (t.from === poolMonthKey(pool, month)) return s - t.amount
    return s
  }, 0)

/** This month's current attributed amount for `pool`: baseline plus net. */
export const poolMonthAmount = (projectValue, poolPct, pool, monthCount, transfers, month) =>
  Math.round(
    (poolMonthBaseline(projectValue, poolPct, pool, monthCount) +
      poolNetForMonth(transfers, pool, month)) *
      100,
  ) / 100

/**
 * Validates one proposed transfer against current balances. Rejects: a
 * non-positive amount, an unrecognized from/to key, a month outside the
 * project's duration, a pool source that doesn't have the funds, or a
 * month source whose available balance (allocated − planned) is smaller
 * than the amount. This is the single choke point that keeps every pool
 * and every month non-negative by construction — callers must run every
 * transfer through this before appending it to the ledger.
 */
export const validateTransfer = (
  { projectValue, poolPct, transfers, months, monthTasksByMonth, phase },
  { from, to, amount },
) => {
  const amt = Math.round((parseFloat(amount) || 0) * 100) / 100
  if (amt <= 0) return { valid: false, error: 'Amount must be greater than zero.' }
  if (!isPoolKey(from) && !isMonthKey(from)) {
    return { valid: false, error: 'Invalid transfer source.' }
  }
  if (!isPoolKey(to) && !isMonthKey(to)) {
    return { valid: false, error: 'Invalid transfer target.' }
  }
  if (isMonthKey(from) && !(months || []).includes(monthOf(from))) {
    return { valid: false, error: `${monthOf(from)} is outside the project's duration.` }
  }
  if (isMonthKey(to) && !(months || []).includes(monthOf(to))) {
    return { valid: false, error: `${monthOf(to)} is outside the project's duration.` }
  }
  if (isPoolKey(from)) {
    const balance = poolBalance(projectValue, poolPct, from, transfers)
    if (amt - balance > 0.005) {
      return {
        valid: false,
        error: `${from.toUpperCase()} only has ₹${balance.toFixed(2)} available.`,
      }
    }
  }
  if (isMonthKey(from)) {
    const month = monthOf(from)
    const effectiveBaseline = monthBaselines(
      computeWorkingPool(projectValue, poolPct),
      months || [],
    )[month]
    const totalsFn = phase === 'actual' ? monthActualTotal : monthPlannedTotal
    const available = monthAvailableBalance(
      effectiveBaseline,
      transfers,
      monthTasksByMonth,
      month,
      totalsFn,
    )
    if (amt - available > 0.005) {
      return {
        valid: false,
        error: `${month} only has ₹${available.toFixed(2)} balance available.`,
      }
    }
  }
  return { valid: true }
}

/**
 * Validates a direct pool-to-pool reattribution between two months (e.g.
 * "move ₹5,000 of March's HR credit to April's Core credit") — the money
 * never touches either month's own project task budget, only which month
 * is credited with contributing to which pool. Rejects a non-positive
 * amount, either month being outside the project's duration, an
 * unrecognized pool name, or a source month/pool whose current attributed
 * amount is smaller than what's being moved.
 */
export const validatePoolTransfer = (
  { projectValue, poolPct, transfers, months },
  { fromPool, fromMonth, toPool, toMonth, amount },
) => {
  const amt = Math.round((parseFloat(amount) || 0) * 100) / 100
  if (amt <= 0) return { valid: false, error: 'Amount must be greater than zero.' }
  if (!isPoolKey(fromPool)) return { valid: false, error: 'Invalid source pool.' }
  if (!isPoolKey(toPool)) return { valid: false, error: 'Invalid destination pool.' }
  if (!(months || []).includes(fromMonth)) {
    return { valid: false, error: `${fromMonth} is outside the project's duration.` }
  }
  if (!(months || []).includes(toMonth)) {
    return { valid: false, error: `${toMonth} is outside the project's duration.` }
  }
  if (fromPool === toPool && fromMonth === toMonth) {
    return { valid: false, error: 'Source and destination are the same.' }
  }
  const monthCount = (months || []).length
  const available = poolMonthAmount(
    projectValue,
    poolPct,
    fromPool,
    monthCount,
    transfers,
    fromMonth,
  )
  if (amt - available > 0.005) {
    return {
      valid: false,
      error: `${fromMonth}'s ${fromPool.toUpperCase()} only has ₹${available.toFixed(2)} available.`,
    }
  }
  return { valid: true }
}

/** Drops every ledger record whose origin_month is the given month (used by month Reset). */
export const removeTransfersOriginatingFrom = (transfers, month) =>
  (transfers || []).filter((t) => t.origin_month !== month)

/** Σ month allocated + Σ pool balances must always equal project value. */
export const grandInvariantCheck = ({ projectValue, poolPct, months, transfers }) => {
  const workingPool = computeWorkingPool(projectValue, poolPct)
  const baselines = monthBaselines(workingPool, months || [])
  const monthsTotal = (months || []).reduce(
    (s, m) => s + monthAllocated(baselines[m], transfers, m),
    0,
  )
  const poolsTotal = ['hr', 'core', 'admin'].reduce(
    (s, p) => s + poolBalance(projectValue, poolPct, p, transfers),
    0,
  )
  const grandTotal = Math.round((monthsTotal + poolsTotal) * 100) / 100
  const diff = Math.round((grandTotal - projectValue) * 100) / 100
  return { valid: Math.abs(diff) < 0.01, grandTotal, projectValue, diff }
}

/**
 * The Submit-time checklist (spec Section 5). Every month must have
 * planned === allocated to the paisa; if not, reports the total shortfall
 * (over-planned months) and surplus (under-planned months) so the UI can
 * name the offending months. When there's a shortfall, also reports
 * whether HR+Core can cover it and, if not, the exact remainder Admin
 * would need to cover (the 85/95/100 ladder) — never a flat percentage.
 */
export const settlementCheck = ({
  projectValue,
  poolPct,
  months,
  monthTasksByMonth,
  transfers,
}) => {
  const workingPool = computeWorkingPool(projectValue, poolPct)
  const baselines = monthBaselines(workingPool, months || [])

  const monthIssues = (months || [])
    .map((month) => {
      const allocated = monthAllocated(baselines[month], transfers, month)
      const planned = monthPlannedTotal((monthTasksByMonth || {})[month] || [])
      const diff = Math.round((planned - allocated) * 100) / 100
      return { month, allocated, planned, diff }
    })
    .filter((i) => Math.abs(i.diff) >= 0.01)

  const totalShortfall =
    Math.round(monthIssues.filter((i) => i.diff > 0).reduce((s, i) => s + i.diff, 0) * 100) / 100
  const totalSurplus =
    Math.round(monthIssues.filter((i) => i.diff < 0).reduce((s, i) => s - i.diff, 0) * 100) / 100

  const hrBalance = poolBalance(projectValue, poolPct, 'hr', transfers)
  const coreBalance = poolBalance(projectValue, poolPct, 'core', transfers)
  const adminBalance = poolBalance(projectValue, poolPct, 'admin', transfers)
  const poolsNonNegative = hrBalance >= -0.005 && coreBalance >= -0.005 && adminBalance >= -0.005

  const invariantOk = grandInvariantCheck({ projectValue, poolPct, months, transfers }).valid

  let adminDraw = null
  if (totalShortfall > 0) {
    const coverableByHrCore = Math.min(
      totalShortfall,
      Math.max(hrBalance, 0) + Math.max(coreBalance, 0),
    )
    const remainder = Math.round((totalShortfall - coverableByHrCore) * 100) / 100
    if (remainder > 0.005) {
      const cappedAmount = Math.min(remainder, Math.max(adminBalance, 0))
      adminDraw = {
        amount: Math.round(cappedAmount * 100) / 100,
        fullyCovered: remainder <= adminBalance + 0.005,
      }
    }
  }

  return {
    valid: monthIssues.length === 0 && invariantOk && poolsNonNegative,
    monthIssues,
    totalShortfall,
    totalSurplus,
    invariantOk,
    poolsNonNegative,
    adminDraw,
  }
}
