/**
 * forecastEngine.js — Pure math for Super Forecasting's driver-based
 * forecast: known commitments carried forward exactly, plus a Holt-linear
 * trend + residual-derived interval over the volatile remainder only.
 *
 * Same convention as monthlyApportionment.js: no localStorage, no
 * Supabase, no React — every function is a plain data-in/data-out
 * transform, and this file imports nothing at all (scripts/load-esm-source.mjs
 * only resolves same-directory relative imports, so a zero-import file is
 * the only shape it can load directly).
 */

// ── Month helpers ───────────────────────────────────────────────────────────

/** 'YYYY-MM' for a Date, using its LOCAL year/month (never UTC). */
export const monthKeyOf = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

/** Add `delta` calendar months to a 'YYYY-MM' key (delta may be negative). */
export const addMonths = (ym, delta) => {
  const [y, m] = ym.split('-').map(Number)
  return monthKeyOf(new Date(y, m - 1 + delta, 1))
}

// Explicit, generous guard against a runaway loop from malformed input — not
// a silent truncation: monthsBetween throws rather than quietly dropping
// months past this span, so a caller passing garbage finds out immediately.
export const MAX_MONTHS_SPAN = 1200 // 100 years

/** Every calendar month from start to end (both 'YYYY-MM'), inclusive.
 *  Empty or inverted ranges (start > end) return []. */
export const monthsBetween = (start, end) => {
  if (!start || !end) return []
  const months = []
  let cur = start
  let guard = 0
  while (cur <= end) {
    months.push(cur)
    cur = addMonths(cur, 1)
    guard += 1
    if (guard > MAX_MONTHS_SPAN) {
      throw new Error(
        `monthsBetween(${start}, ${end}) exceeds ${MAX_MONTHS_SPAN} months — check inputs`,
      )
    }
  }
  return months
}

// ── Holt linear trend (double exponential smoothing) ────────────────────────

/**
 * Fits a Holt linear trend model to a chronological numeric series.
 * Degrades to the series' last value (zero trend) when there are fewer than
 * 3 points, and to all-zero when the series is empty — too little data to
 * estimate a trend, so the model falls back to "assume flat".
 *
 * @returns {{ level: number, trend: number, fitted: number[] }}
 *   `fitted[i]` is the model's one-step-ahead estimate of `series[i]`
 *   (fitted[0] is just series[0] — there's no prior estimate for it).
 */
export const holtLinear = (series, { alpha = 0.5, beta = 0.3 } = {}) => {
  const clean = (series || []).map((v) => (Number.isFinite(v) ? v : 0))
  const n = clean.length
  if (n === 0) return { level: 0, trend: 0, fitted: [] }
  if (n < 3) return { level: clean[n - 1], trend: 0, fitted: clean.slice() }

  let level = clean[0]
  let trend = clean[1] - clean[0]
  const fitted = [clean[0]]

  for (let t = 1; t < n; t++) {
    const prevLevel = level
    fitted.push(prevLevel + trend)
    level = alpha * clean[t] + (1 - alpha) * (prevLevel + trend)
    trend = beta * (level - prevLevel) + (1 - beta) * trend
  }

  return { level, trend, fitted }
}

/** In-sample one-step-ahead error spread (RMS residual) of a fit against
 *  its own series — 0 for an empty series or a perfect fit. */
export const residualSigma = (series, fitted) => {
  const n = Math.min((series || []).length, (fitted || []).length)
  if (n === 0) return 0
  let sumSq = 0
  for (let i = 0; i < n; i++) {
    const residual = (series[i] || 0) - (fitted[i] || 0)
    sumSq += residual * residual
  }
  return Math.sqrt(sumSq / n)
}

// z-score for an ~80% interval (p10/p90), i.e. Φ⁻¹(0.9).
const Z80 = 1.2816

/**
 * Projects `horizonMonths` ahead of a historical series using Holt linear
 * trend, with a p10/p50/p90 band derived from the fit's own in-sample
 * residual spread. Spend can't go negative, so every bound is clamped at 0
 * (clamping preserves p10 <= p50 <= p90 since max(x, 0) is monotonic).
 *
 * @returns {Array<{ p10: number, p50: number, p90: number }>} length === horizonMonths
 */
export const projectSeries = (series, horizonMonths, opts = {}) => {
  const months = []
  if (!horizonMonths || horizonMonths <= 0) return months

  const { level, trend, fitted } = holtLinear(series, opts)
  const sigma = residualSigma(series, fitted)

  for (let h = 1; h <= horizonMonths; h++) {
    const p50 = Math.max(0, level + trend * h)
    const p10 = Math.max(0, p50 - Z80 * sigma)
    const p90 = Math.max(0, p50 + Z80 * sigma)
    months.push({ p10, p50, p90 })
  }
  return months
}

/**
 * Composes one forecast month's spend from a known commitment (carried
 * forward exactly, no uncertainty) and the volatile remainder's band — so
 * every forecast figure keeps its known/estimated split. `committed +
 * estimated === p50` exactly, by construction.
 */
export const composeMonth = ({ committed = 0, volatileBand = { p10: 0, p50: 0, p90: 0 } } = {}) => {
  const c = Number.isFinite(committed) ? committed : 0
  const band = volatileBand || { p10: 0, p50: 0, p90: 0 }
  const estimated = Number.isFinite(band.p50) ? band.p50 : 0
  const p10 = Number.isFinite(band.p10) ? band.p10 : 0
  const p90 = Number.isFinite(band.p90) ? band.p90 : 0
  return {
    committed: c,
    estimated,
    p50: c + estimated,
    p10: c + p10,
    p90: c + p90,
  }
}

/**
 * How much new project value is needed to close a period gap by
 * `targetReduction`, given projects earn `combinedPct`% of their value in
 * pool cuts over their own `avgDurationMonths`-month duration, when the gap
 * itself is measured over a `periodMonths`-month period.
 *
 * A project of value V running D months earns V * (combinedPct/100) in
 * pool-cut money total, spread evenly across D months — so over an
 * L-month *period*, it contributes V * c * min(L, D) / D, not the whole
 * V * c (that only holds when the project's whole duration falls inside the
 * period being measured). Solving for V given a target contribution:
 *   V = targetReduction * D / (c * min(L, D))
 * which reduces to the naive targetReduction / c exactly when D === L.
 */
export const newProjectValueNeeded = ({
  targetReduction,
  combinedPct,
  avgDurationMonths,
  periodMonths,
}) => {
  const c = (combinedPct || 0) / 100
  const D = avgDurationMonths || 0
  const L = periodMonths || 0
  const overlap = Math.min(D, L)
  if (c <= 0 || D <= 0 || overlap <= 0) return 0
  return Math.round(((targetReduction * D) / (c * overlap)) * 100) / 100
}
