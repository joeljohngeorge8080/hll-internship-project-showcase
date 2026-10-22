import assert from 'node:assert/strict'
import { loadEsmSource } from './load-esm-source.mjs'

const {
  monthsBetween,
  addMonths,
  monthKeyOf,
  holtLinear,
  residualSigma,
  projectSeries,
  composeMonth,
  newProjectValueNeeded,
} = await loadEsmSource('src/services/forecastEngine.js')

// ── monthKeyOf / addMonths ──────────────────────────────────────────────
assert.equal(monthKeyOf(new Date(2026, 0, 15)), '2026-01')
assert.equal(addMonths('2026-01', 1), '2026-02')
assert.equal(addMonths('2026-01', -1), '2025-12')

// ── monthsBetween — year boundary ───────────────────────────────────────
assert.deepEqual(monthsBetween('2025-11', '2026-02'), [
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
])
// empty ranges
assert.deepEqual(monthsBetween('', ''), [])
assert.deepEqual(monthsBetween(null, '2026-01'), [])
assert.deepEqual(monthsBetween('2026-01', null), [])
// inverted range
assert.deepEqual(monthsBetween('2026-05', '2026-01'), [])
// single month
assert.deepEqual(monthsBetween('2026-03', '2026-03'), ['2026-03'])

// ── holtLinear — degenerate series ──────────────────────────────────────
assert.deepEqual(holtLinear([]), { level: 0, trend: 0, fitted: [] })
assert.deepEqual(holtLinear([42]), { level: 42, trend: 0, fitted: [42] })
assert.deepEqual(holtLinear([10, 30]), { level: 30, trend: 0, fitted: [10, 30] })

// ── holtLinear — recovers a known linear ramp exactly ───────────────────
{
  const ramp = [10, 20, 30, 40, 50]
  const { level, trend, fitted } = holtLinear(ramp)
  assert.equal(level, 50)
  assert.equal(trend, 10)
  assert.deepEqual(fitted, ramp)
}
// Holds regardless of alpha/beta for a perfectly linear series.
{
  const ramp = [100, 150, 200, 250]
  const { level, trend } = holtLinear(ramp, { alpha: 0.8, beta: 0.1 })
  assert.equal(level, 250)
  assert.equal(trend, 50)
}

// ── residualSigma ────────────────────────────────────────────────────────
assert.equal(residualSigma([], []), 0)
assert.equal(residualSigma([10, 20, 30], [10, 20, 30]), 0)
assert.equal(residualSigma([10, 20], [10, 10]), Math.sqrt((0 * 0 + 10 * 10) / 2))

// ── projectSeries — band ordering & sigma=0 collapse ────────────────────
{
  const constant = [100, 100, 100, 100]
  const band = projectSeries(constant, 3)
  assert.equal(band.length, 3)
  band.forEach((m) => {
    assert.ok(m.p10 <= m.p50)
    assert.ok(m.p50 <= m.p90)
    // sigma is 0 for a flat series → the band collapses to a point.
    assert.equal(m.p10, m.p50)
    assert.equal(m.p50, m.p90)
    assert.equal(m.p50, 100)
  })
}
{
  const noisy = [50, 90, 40, 110, 60, 95]
  const band = projectSeries(noisy, 4)
  assert.equal(band.length, 4)
  band.forEach((m) => {
    assert.ok(m.p10 <= m.p50, 'p10 <= p50')
    assert.ok(m.p50 <= m.p90, 'p50 <= p90')
    assert.ok(m.p10 >= 0, 'p10 clamped at 0')
  })
}
assert.deepEqual(projectSeries([1, 2, 3], 0), [])
assert.deepEqual(projectSeries([], 3).length, 3) // empty series still yields a (zero) band per month

// ── composeMonth — committed + estimated === p50 exactly ────────────────
{
  const m = composeMonth({ committed: 5000, volatileBand: { p10: 800, p50: 1200, p90: 1800 } })
  assert.equal(m.committed, 5000)
  assert.equal(m.estimated, 1200)
  assert.equal(m.p50, 5000 + 1200)
  assert.equal(m.committed + m.estimated, m.p50)
  assert.equal(m.p10, 5000 + 800)
  assert.equal(m.p90, 5000 + 1800)
}
// hostile inputs
assert.deepEqual(composeMonth(), { committed: 0, estimated: 0, p50: 0, p10: 0, p90: 0 })
assert.deepEqual(composeMonth({}), { committed: 0, estimated: 0, p50: 0, p10: 0, p90: 0 })
assert.deepEqual(composeMonth({ committed: undefined, volatileBand: undefined }), {
  committed: 0,
  estimated: 0,
  p50: 0,
  p10: 0,
  p90: 0,
})

// ── newProjectValueNeeded ─────────────────────────────────────────────────
// D === L reduces to the naive targetReduction / c formula.
assert.equal(
  newProjectValueNeeded({
    targetReduction: 150000,
    combinedPct: 15,
    avgDurationMonths: 12,
    periodMonths: 12,
  }),
  150000 / 0.15,
)
// D === 2L doubles the required value vs the D === L case.
{
  const base = newProjectValueNeeded({
    targetReduction: 150000,
    combinedPct: 15,
    avgDurationMonths: 12,
    periodMonths: 12,
  })
  const doubled = newProjectValueNeeded({
    targetReduction: 150000,
    combinedPct: 15,
    avgDurationMonths: 24,
    periodMonths: 12,
  })
  assert.equal(doubled, base * 2)
}
// hostile inputs — zero/negative guards degrade to 0, never throw or divide by zero
assert.equal(
  newProjectValueNeeded({ targetReduction: 100, combinedPct: 0, avgDurationMonths: 12, periodMonths: 12 }),
  0,
)
assert.equal(
  newProjectValueNeeded({ targetReduction: 100, combinedPct: 15, avgDurationMonths: 0, periodMonths: 12 }),
  0,
)
assert.equal(newProjectValueNeeded({}), 0)

// ── Hostile inputs across the board — NaN/undefined amounts never throw ──
assert.doesNotThrow(() => holtLinear([NaN, undefined, 5, 'x']))
assert.doesNotThrow(() => projectSeries([NaN, undefined, 5], 6))
assert.doesNotThrow(() => residualSigma([NaN], [undefined]))
{
  const { level, trend } = holtLinear([0, 0, 0, 0])
  assert.equal(level, 0)
  assert.equal(trend, 0)
}

console.log('forecastEngine.js: ALL PASSED')
