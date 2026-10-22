import assert from 'node:assert/strict'
import { loadEsmSource } from './load-esm-source.mjs'

const {
  monthsInRange,
  equalSplit,
  computeWorkingPool,
  monthBaseline,
  netForEntity,
  monthAllocated,
  monthPlannedTotal,
  monthActualTotal,
  poolBalance,
  monthAvailableBalance,
  validateTransfer,
  removeTransfersOriginatingFrom,
  grandInvariantCheck,
  settlementCheck,
} = await loadEsmSource('src/services/budgetPlan.js')

// ── monthsInRange ───────────────────────────────────────────────────
assert.deepEqual(monthsInRange('2026-08', '2026-10'), ['2026-08', '2026-09', '2026-10'])
assert.deepEqual(monthsInRange('2026-11', '2027-01'), ['2026-11', '2026-12', '2027-01'])
assert.deepEqual(monthsInRange('', ''), [])

// ── equalSplit — exact paise, last recipient absorbs rounding ──────
assert.deepEqual(equalSplit(100, 3), [33.33, 33.33, 33.34])
assert.equal(
  equalSplit(100, 3).reduce((s, n) => s + n, 0),
  100,
)
assert.equal(
  Math.round(equalSplit(5000, 9).reduce((s, n) => s + n, 0) * 100) / 100,
  5000,
)
assert.deepEqual(equalSplit(10, 1), [10])
assert.deepEqual(equalSplit(10, 0), [])

// ── computeWorkingPool ──────────────────────────────────────────────
assert.equal(computeWorkingPool(1000000, { admin: 5, hr: 5, core: 5 }), 850000)
assert.equal(computeWorkingPool(1000000, { admin: 5, hr: 5, core: 6 }), 840000)

// ── monthBaseline ───────────────────────────────────────────────────
assert.equal(monthBaseline(850000, 10), 85000)
assert.equal(monthBaseline(850000, 0), 0)

// ── netForEntity ────────────────────────────────────────────────────
const transfers = [
  { from: 'month:2026-08', to: 'hr', amount: 2000 },
  { from: 'hr', to: 'month:2026-09', amount: 500 },
]
assert.equal(netForEntity(transfers, 'month:2026-08'), -2000)
assert.equal(netForEntity(transfers, 'hr'), 2000 - 500)
assert.equal(netForEntity(transfers, 'month:2026-09'), 500)
assert.equal(netForEntity(transfers, 'core'), 0)

// ── monthAllocated ──────────────────────────────────────────────────
assert.equal(monthAllocated(85000, transfers, '2026-08'), 83000)
assert.equal(monthAllocated(85000, transfers, '2026-09'), 85500)
assert.equal(monthAllocated(85000, transfers, '2026-10'), 85000)

// ── monthPlannedTotal / monthActualTotal ───────────────────────────
const tasks = [
  {
    phase: 'implementation',
    name: 'Training',
    subtasks: [
      { name: 'Venue rent', planned_amount: 5000, actual_amount: 4200 },
      { name: 'Food', planned_amount: 3000, actual_amount: 3000 },
    ],
  },
  {
    phase: 'design',
    name: 'Survey',
    subtasks: [{ name: 'Printing', planned_amount: 2000, actual_amount: 0 }],
  },
]
assert.equal(monthPlannedTotal(tasks), 10000)
assert.equal(monthActualTotal(tasks), 7200)
assert.equal(monthPlannedTotal([]), 0)
assert.equal(monthPlannedTotal(undefined), 0)

// ── poolBalance ─────────────────────────────────────────────────────
assert.equal(poolBalance(1000000, { admin: 5, hr: 5, core: 5 }, 'hr', transfers), 50000 + 1500)
assert.equal(poolBalance(1000000, { admin: 5, hr: 5, core: 5 }, 'core', transfers), 50000)

// ── monthAvailableBalance ───────────────────────────────────────────
// month 2026-08 is allocated 83000 (after the -2000 transfer above) with 10000 planned → 73000 spare
const byMonth = { '2026-08': tasks }
assert.equal(monthAvailableBalance(85000, transfers, byMonth, '2026-08'), 73000)
assert.equal(monthAvailableBalance(85000, transfers, {}, '2026-10'), 85000)

// ── validateTransfer ────────────────────────────────────────────────
const ctx = {
  projectValue: 1000000,
  poolPct: { admin: 5, hr: 5, core: 5 },
  months: ['2026-08', '2026-09', '2026-10'],
  monthTasksByMonth: { '2026-08': tasks },
  transfers: [],
}

assert.deepEqual(validateTransfer(ctx, { from: 'hr', to: 'month:2026-08', amount: 0 }), {
  valid: false,
  error: 'Amount must be greater than zero.',
})
assert.equal(validateTransfer(ctx, { from: 'hr', to: 'month:2026-08', amount: 100 }).valid, true)
// hr only has 50000 — asking for more fails
assert.equal(
  validateTransfer(ctx, { from: 'hr', to: 'month:2026-08', amount: 999999 }).valid,
  false,
)
// baseline = monthBaseline(850000, 3) = 283333.33; month 2026-08 has 10000 planned
// (from `tasks`) → 273333.33 available to take, to the paisa
assert.equal(
  validateTransfer(ctx, { from: 'month:2026-08', to: 'hr', amount: 273333.33 }).valid,
  true,
)
assert.equal(
  validateTransfer(ctx, { from: 'month:2026-08', to: 'hr', amount: 273333.34 }).valid,
  false,
)
assert.equal(
  validateTransfer(ctx, { from: 'month:2099-01', to: 'hr', amount: 10 }).valid,
  false,
  'month outside project duration is rejected',
)
assert.equal(validateTransfer(ctx, { from: 'bogus', to: 'hr', amount: 10 }).valid, false)

// ── removeTransfersOriginatingFrom ──────────────────────────────────
const taggedTransfers = [
  { origin_month: '2026-08', from: 'month:2026-08', to: 'hr', amount: 100 },
  { origin_month: '2026-09', from: 'hr', to: 'month:2026-09', amount: 50 },
]
assert.deepEqual(removeTransfersOriginatingFrom(taggedTransfers, '2026-08'), [taggedTransfers[1]])

// ── grandInvariantCheck ─────────────────────────────────────────────
const invCtx = {
  projectValue: 1000000,
  poolPct: { admin: 5, hr: 5, core: 5 },
  months: ['2026-08', '2026-09', '2026-10'],
  transfers: [],
}
assert.equal(grandInvariantCheck(invCtx).valid, true)
assert.equal(grandInvariantCheck(invCtx).grandTotal, 1000000)

// ── settlementCheck ─────────────────────────────────────────────────
// Fully settled: 3 months, each planned exactly = baseline (283333.33 * 2 + 283333.34)
const settledMonths = ['2026-08', '2026-09', '2026-10']
const wp = computeWorkingPool(1000000, { admin: 5, hr: 5, core: 5 }) // 850000
const perMonth = equalSplit(wp, 3) // exact baseline per month
const settledByMonth = Object.fromEntries(
  settledMonths.map((m, i) => [
    m,
    [{ phase: 'design', name: 'x', subtasks: [{ name: 'y', planned_amount: perMonth[i] }] }],
  ]),
)
const settledCheck = settlementCheck({
  projectValue: 1000000,
  poolPct: { admin: 5, hr: 5, core: 5 },
  months: settledMonths,
  monthTasksByMonth: settledByMonth,
  transfers: [],
})
assert.equal(settledCheck.valid, true)
assert.equal(settledCheck.monthIssues.length, 0)
assert.equal(settledCheck.adminDraw, null)

// Over-planned beyond working pool + HR + Core (the 96% regression case):
// project value 1,000,000, 1 month, plan = 960,000 (96%), pools at default 5/5/5
// → working pool baseline is 850,000; excess of 110,000 must draw HR(50k)+Core(50k)
// fully, leaving 10,000 short, which is exactly the admin draw needed (not 5%/50,000).
const regressionCheck = settlementCheck({
  projectValue: 1000000,
  poolPct: { admin: 5, hr: 5, core: 5 },
  months: ['2026-08'],
  monthTasksByMonth: {
    '2026-08': [{ phase: 'design', name: 'x', subtasks: [{ name: 'y', planned_amount: 960000 }] }],
  },
  transfers: [],
})
assert.equal(regressionCheck.valid, false)
assert.equal(regressionCheck.totalShortfall, 110000)
assert.ok(regressionCheck.adminDraw)
assert.equal(regressionCheck.adminDraw.amount, 10000, 'admin only gives the true remainder, not a flat 5%')

console.log('budgetPlan.js: ALL PASSED')
