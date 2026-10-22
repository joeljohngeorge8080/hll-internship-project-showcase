import assert from 'node:assert/strict'
import { register } from 'node:module'
import { loadEsmSource } from './load-esm-source.mjs'

// localBudgetPlan.js now persists to Supabase (budget_plans table) instead
// of localStorage. This loader hook substitutes an in-memory fake client
// for `import supabase from './supabase'` — the real client reads
// import.meta.env (Vite-only) and can't load under plain Node.
register(new URL('./mock-supabase-loader.mjs', import.meta.url))

const { localBudgetPlan } = await loadEsmSource('src/services/localBudgetPlan.js')

const PID = 'proj_test_1'

// Test-only direct write into the fake store — the async-Supabase
// localBudgetPlan.js has no __setPlanForTest escape hatch (it operated on
// a plain JS object; now it's a DB row), so mutated fixtures are injected
// straight into the mock table instead.
const setPlanForTest = (pid, plan) => {
  const store = globalThis.__mockSupabaseStore
  const rows = store.budget_plans || (store.budget_plans = [])
  const patch = {
    status: plan.status,
    submitted_at: plan.submitted_at,
    project_value: plan.project_value,
    start_date: plan.start_date,
    end_date: plan.end_date,
    admin_pct: plan.pool_pct.admin,
    hr_pct: plan.pool_pct.hr,
    core_pct: plan.pool_pct.core,
    saved_snapshot: plan.saved_snapshot,
    plan_data: { months: plan.months, transfers: plan.transfers },
  }
  const existing = rows.find((r) => r.project_id === pid)
  if (existing) Object.assign(existing, patch)
  else rows.push({ id: 'row_test', project_id: pid, ...patch })
}

// ── initialize ──────────────────────────────────────────────────────
assert.equal(await localBudgetPlan.getPlan(PID), null)
let plan = await localBudgetPlan.initializePlan(PID, {
  projectValue: 1000000,
  startDate: '2026-08',
  endDate: '2026-10',
  poolPct: { admin: 5, hr: 5, core: 5 },
})
assert.equal(plan.status, 'planning')
assert.equal(plan.months.length, 3)
assert.deepEqual(
  plan.months.map((m) => m.month),
  ['2026-08', '2026-09', '2026-10'],
)
assert.deepEqual(plan.transfers, [])
assert.equal(plan.saved_snapshot, null)
assert.deepEqual(await localBudgetPlan.getPlan(PID), plan)

// re-initializing an existing plan throws (must fullDelete first)
await assert.rejects(() =>
  localBudgetPlan.initializePlan(PID, {
    projectValue: 1,
    startDate: '2026-08',
    endDate: '2026-09',
    poolPct: { admin: 5, hr: 5, core: 5 },
  }),
)

// ── save / reset ────────────────────────────────────────────────────
plan.months[0].tasks.push({ id: 't1', phase: 'design', name: 'X', subtasks: [] })
setPlanForTest(PID, plan)
await localBudgetPlan.save(PID)
const afterSave = await localBudgetPlan.getPlan(PID)
assert.ok(afterSave.saved_snapshot)
assert.equal(afterSave.saved_snapshot.months[0].tasks.length, 1)

// mutate further, then reset back to the save point
afterSave.months[0].tasks.push({ id: 't2', phase: 'design', name: 'Y', subtasks: [] })
setPlanForTest(PID, afterSave)
assert.equal((await localBudgetPlan.getPlan(PID)).months[0].tasks.length, 2)
const afterReset = await localBudgetPlan.reset(PID)
assert.equal(afterReset.months[0].tasks.length, 1, 'reset restores the saved snapshot')

// reset with no prior save restores the empty initialized state
await localBudgetPlan.fullDelete(PID)
plan = await localBudgetPlan.initializePlan(PID, {
  projectValue: 1000000,
  startDate: '2026-08',
  endDate: '2026-09',
  poolPct: { admin: 5, hr: 5, core: 5 },
})
plan.months[0].tasks.push({ id: 't3', phase: 'design', name: 'Z', subtasks: [] })
setPlanForTest(PID, plan)
const resetToEmpty = await localBudgetPlan.reset(PID)
assert.equal(resetToEmpty.months[0].tasks.length, 0, 'reset with no save point restores empty months')

// ── fullDelete ──────────────────────────────────────────────────────
await localBudgetPlan.fullDelete(PID)
assert.equal(await localBudgetPlan.getPlan(PID), null)

// ── task/subtask CRUD ───────────────────────────────────────────────
await localBudgetPlan.fullDelete(PID)
plan = await localBudgetPlan.initializePlan(PID, {
  projectValue: 1000000,
  startDate: '2026-08',
  endDate: '2026-09',
  poolPct: { admin: 5, hr: 5, core: 5 },
})

plan = await localBudgetPlan.addTask(PID, '2026-08', { phase: 'implementation', name: 'Training' })
const taskId = plan.months[0].tasks[0].id
assert.equal(plan.months[0].tasks[0].name, 'Training')
assert.deepEqual(plan.months[0].tasks[0].subtasks, [])
assert.equal(plan.months[0].tasks[0].recurring, false)
assert.equal(plan.months[0].tasks[0].added_in_actual, false)

plan = await localBudgetPlan.addSubtask(PID, '2026-08', taskId, {
  name: 'Venue rent',
  planned_amount: 5000,
  activity: 'implementation',
})
const subtaskId = plan.months[0].tasks[0].subtasks[0].id
assert.equal(plan.months[0].tasks[0].subtasks[0].planned_amount, 5000)
assert.equal(plan.months[0].tasks[0].subtasks[0].actual_amount, 0)
assert.equal(plan.months[0].tasks[0].subtasks[0].actual_status, 'pending')

plan = await localBudgetPlan.updateSubtaskPlanned(PID, '2026-08', taskId, subtaskId, 6000)
assert.equal(plan.months[0].tasks[0].subtasks[0].planned_amount, 6000)

plan = await localBudgetPlan.addSubtask(PID, '2026-08', taskId, {
  name: 'Food',
  planned_amount: 1000,
  activity: 'implementation',
})
assert.equal(plan.months[0].tasks[0].subtasks.length, 2)
const foodId = plan.months[0].tasks[0].subtasks[1].id
plan = await localBudgetPlan.removeSubtask(PID, '2026-08', taskId, foodId)
assert.equal(plan.months[0].tasks[0].subtasks.length, 1)

plan = await localBudgetPlan.removeTask(PID, '2026-08', taskId)
assert.equal(plan.months[0].tasks.length, 0)

// ── recurring tasks ─────────────────────────────────────────────────
plan = await localBudgetPlan.applyRecurringTasks(PID, {
  tasks: [{ phase: 'monitoring', name: 'Field visit', totalAmount: 100, activity: 'monitoring' }],
})
assert.equal(plan.months[0].tasks.length, 1)
assert.equal(plan.months[1].tasks.length, 1)
assert.equal(plan.months[0].tasks[0].recurring, true)
// 100 split across 2 months: 50/50
assert.equal(plan.months[0].tasks[0].subtasks[0].planned_amount, 50)
assert.equal(plan.months[1].tasks[0].subtasks[0].planned_amount, 50)

// batch with subtasks + a flat task in the same Apply
plan = await localBudgetPlan.applyRecurringTasks(PID, {
  tasks: [
    {
      phase: 'implementation',
      name: 'Training',
      subtasks: [
        { name: 'Venue rent', totalAmount: 100, activity: 'implementation' },
        { name: 'Food', totalAmount: 50, activity: 'implementation' },
      ],
    },
    { phase: 'design', name: 'Printing', totalAmount: 30, activity: 'design' },
  ],
})
assert.equal(plan.months[0].tasks.length, 3) // Field visit + Training + Printing
const training0 = plan.months[0].tasks.find((t) => t.name === 'Training')
assert.equal(training0.subtasks.length, 2)
assert.equal(training0.subtasks[0].name, 'Venue rent')
assert.equal(training0.subtasks[0].planned_amount, 50) // 100 / 2 months
assert.equal(training0.subtasks[1].planned_amount, 25) // 50 / 2 months
const printing0 = plan.months[0].tasks.find((t) => t.name === 'Printing')
assert.equal(printing0.subtasks[0].planned_amount, 15) // 30 / 2 months

await assert.rejects(() => localBudgetPlan.applyRecurringTasks(PID, { tasks: [] }), /at least one task/)
await assert.rejects(
  () => localBudgetPlan.applyRecurringTasks(PID, { tasks: [{ phase: 'design', name: '' }] }),
  /needs a name/,
)

// ── locked once submitted ───────────────────────────────────────────
plan.status = 'submitted'
setPlanForTest(PID, plan)
await assert.rejects(
  () => localBudgetPlan.addTask(PID, '2026-08', { phase: 'design', name: 'X' }),
  /locked/,
)
plan.status = 'planning'
setPlanForTest(PID, plan)

// ── moveBalance: send from a month to HR/Core (planning phase) ─────
await localBudgetPlan.fullDelete(PID)
plan = await localBudgetPlan.initializePlan(PID, {
  projectValue: 1000000,
  startDate: '2026-08',
  endDate: '2026-10',
  poolPct: { admin: 5, hr: 5, core: 5 },
})
// month 2026-08 baseline is ~283,333.33 (850000/3); send 3000 to HR+Core, 50/50
plan = await localBudgetPlan.moveBalance(PID, {
  originMonth: '2026-08',
  direction: 'send',
  targets: ['hr', 'core'],
  amount: 3000,
  phase: 'planning',
  createdBy: 'PO',
})
const sendTransfers = plan.transfers.filter((t) => t.origin_month === '2026-08')
assert.equal(sendTransfers.length, 2)
assert.equal(
  sendTransfers.reduce((s, t) => s + t.amount, 0),
  3000,
)
assert.ok(sendTransfers.every((t) => t.from === 'month:2026-08'))
assert.deepEqual(sendTransfers.map((t) => t.to).sort(), ['core', 'hr'])

// ── moveBalance: send to multiple months, equal split ──────────────
plan = await localBudgetPlan.moveBalance(PID, {
  originMonth: '2026-09',
  direction: 'send',
  targets: ['month:2026-08', 'month:2026-10'],
  amount: 100,
  phase: 'planning',
  createdBy: 'PO',
})
const monthSendTransfers = plan.transfers.filter((t) => t.origin_month === '2026-09')
assert.equal(monthSendTransfers.length, 2)
assert.deepEqual(
  monthSendTransfers.map((t) => t.amount).sort((a, b) => a - b),
  [50, 50],
)

// ── moveBalance: take from HR/Core into a month ────────────────────
plan = await localBudgetPlan.moveBalance(PID, {
  originMonth: '2026-10',
  direction: 'take',
  targets: ['hr'],
  amount: 200,
  phase: 'planning',
  createdBy: 'PO',
})
const takeTransfer = plan.transfers.find(
  (t) => t.origin_month === '2026-10' && t.from === 'hr' && t.to === 'month:2026-10',
)
assert.ok(takeTransfer)
assert.equal(takeTransfer.amount, 200)

// ── moveBalance rejects an invalid transfer with a plain error ──────
await assert.rejects(
  () =>
    localBudgetPlan.moveBalance(PID, {
      originMonth: '2026-10',
      direction: 'take',
      targets: ['hr'],
      amount: 9999999,
      phase: 'planning',
      createdBy: 'PO',
    }),
  /available/,
)

// ── revokeTransfer ──────────────────────────────────────────────────
const toRevoke = plan.transfers.find((t) => t.id === takeTransfer.id)
plan = await localBudgetPlan.revokeTransfer(PID, toRevoke.id)
assert.equal(plan.transfers.some((t) => t.id === toRevoke.id), false)

// revoking a planning transfer after submit is blocked
const someTransferId = plan.transfers[0].id
plan.status = 'submitted'
setPlanForTest(PID, plan)
await assert.rejects(() => localBudgetPlan.revokeTransfer(PID, someTransferId), /locked/)
plan.status = 'planning'
setPlanForTest(PID, plan)

// ── resetMonth ───────────────────────────────────────────────────────
// 2026-09's outgoing transfers should vanish; 2026-08/2026-10's incoming
// halves of that same pair also vanish (paired removal, both sides
// tagged with origin_month = 2026-09 in this implementation — see below).
plan = await localBudgetPlan.resetMonth(PID, '2026-09')
assert.equal(
  plan.transfers.some((t) => t.origin_month === '2026-09'),
  false,
)
// the 2026-08 → HR/Core send from earlier (origin_month 2026-08) must still be there
assert.ok(plan.transfers.some((t) => t.origin_month === '2026-08'))

// ── setPoolCapAdjustment ─────────────────────────────────────────────
await localBudgetPlan.fullDelete(PID)
plan = await localBudgetPlan.initializePlan(PID, {
  projectValue: 1000000,
  startDate: '2026-08',
  endDate: '2026-08',
  poolPct: { admin: 5, hr: 5, core: 5 },
})
// HR cap is 50000 (5% of 1,000,000). Lower it to 30000 → 20000 flows to the target month.
plan = await localBudgetPlan.setPoolCapAdjustment(PID, {
  pool: 'hr',
  targetMonth: '2026-08',
  newAmount: 30000,
  createdBy: 'PO',
})
const capTransfer = plan.transfers.find((t) => t.tag === 'pool_cap_adjustment' && t.pool_ref === 'hr')
assert.ok(capTransfer)
assert.equal(capTransfer.amount, 20000)
// raising it back above the 50000 cap is rejected
await assert.rejects(() =>
  localBudgetPlan.setPoolCapAdjustment(PID, {
    pool: 'hr',
    targetMonth: '2026-08',
    newAmount: 60000,
    createdBy: 'PO',
  }),
)
// raising back to exactly the cap removes the adjustment transfer entirely
plan = await localBudgetPlan.setPoolCapAdjustment(PID, {
  pool: 'hr',
  targetMonth: '2026-08',
  newAmount: 50000,
  createdBy: 'PO',
})
assert.equal(
  plan.transfers.some((t) => t.tag === 'pool_cap_adjustment' && t.pool_ref === 'hr'),
  false,
)

// ── computeSettlement / submit ──────────────────────────────────────
await localBudgetPlan.fullDelete(PID)
plan = await localBudgetPlan.initializePlan(PID, {
  projectValue: 300000,
  startDate: '2026-08',
  endDate: '2026-08',
  poolPct: { admin: 5, hr: 5, core: 5 },
})
// working pool = 255000, 1 month → baseline 255000. Plan nothing yet → unsettled (surplus).
let check = await localBudgetPlan.computeSettlement(PID)
assert.equal(check.valid, false)
assert.equal(check.totalSurplus, 255000)
await assert.rejects(() => localBudgetPlan.submit(PID), /settle/i)

plan = await localBudgetPlan.addTask(PID, '2026-08', { phase: 'design', name: 'X' })
const soleTaskId = plan.months[0].tasks[0].id
plan = await localBudgetPlan.addSubtask(PID, '2026-08', soleTaskId, {
  name: 'Y',
  planned_amount: 255000,
  activity: 'design',
})
check = await localBudgetPlan.computeSettlement(PID)
assert.equal(check.valid, true)

plan = await localBudgetPlan.submit(PID)
assert.equal(plan.status, 'submitted')
assert.ok(plan.submitted_at)
assert.equal(plan.months[0].tasks[0].subtasks[0].actual_amount, 0)
assert.equal(plan.months[0].tasks[0].subtasks[0].actual_status, 'pending')

// planning mutators are now locked
await assert.rejects(
  () => localBudgetPlan.addTask(PID, '2026-08', { phase: 'design', name: 'Z' }),
  /locked/,
)

// ── drawFromAdmin (96% regression case, exercised pre-submit) ───────
await localBudgetPlan.fullDelete(PID)
plan = await localBudgetPlan.initializePlan(PID, {
  projectValue: 1000000,
  startDate: '2026-08',
  endDate: '2026-08',
  poolPct: { admin: 5, hr: 5, core: 5 },
})
plan = await localBudgetPlan.addTask(PID, '2026-08', { phase: 'design', name: 'Big' })
const bigTaskId = plan.months[0].tasks[0].id
plan = await localBudgetPlan.addSubtask(PID, '2026-08', bigTaskId, {
  name: 'Everything',
  planned_amount: 960000,
  activity: 'design',
})
check = await localBudgetPlan.computeSettlement(PID)
assert.equal(check.adminDraw.amount, 10000)
await assert.rejects(
  () => localBudgetPlan.submit(PID),
  /settle/i,
  'still unsettled — HR/Core not yet drawn',
)

// PO takes from HR/Core first (as the ladder message directs)
plan = await localBudgetPlan.moveBalance(PID, {
  originMonth: '2026-08',
  direction: 'take',
  targets: ['hr', 'core'],
  amount: 100000,
  phase: 'planning',
  createdBy: 'PO',
})
check = await localBudgetPlan.computeSettlement(PID)
assert.equal(check.valid, false)
assert.equal(check.adminDraw.amount, 10000, 'exactly the true remainder, not a flat 5%')

plan = await localBudgetPlan.drawFromAdmin(PID, { createdBy: 'PO' })
check = await localBudgetPlan.computeSettlement(PID)
assert.equal(check.valid, true)
assert.ok(
  (await localBudgetPlan.getPlan(PID)).transfers.some(
    (t) => t.from === 'admin' && t.to === 'month:2026-08',
  ),
)
plan = await localBudgetPlan.submit(PID)
assert.equal(plan.status, 'submitted')

// ── actual phase: updateActual, addActualTask, Send remainder ──────
plan = await localBudgetPlan.updateActual(
  PID,
  '2026-08',
  bigTaskId,
  plan.months[0].tasks[0].subtasks[0].id,
  900000,
)
const bigSubtaskId = plan.months[0].tasks[0].subtasks[0].id
assert.equal(plan.months[0].tasks[0].subtasks[0].actual_amount, 900000)
assert.equal(plan.months[0].tasks[0].subtasks[0].actual_status, 'entered')

plan = await localBudgetPlan.addActualTask(PID, '2026-08', {
  phase: 'monitoring',
  name: 'Unplanned extra',
})
const extraTask = plan.months[0].tasks.find((t) => t.name === 'Unplanned extra')
assert.equal(extraTask.added_in_actual, true)
assert.equal(extraTask.subtasks.length, 0)

// send the 60000 actual remainder from the big subtask to HR/Core
plan = await localBudgetPlan.moveBalance(PID, {
  originMonth: '2026-08',
  direction: 'send',
  targets: ['hr', 'core'],
  amount: 60000,
  phase: 'actual',
  createdBy: 'PO',
  subtaskRef: { month: '2026-08', taskId: bigTaskId, subtaskId: bigSubtaskId },
})
assert.equal(
  plan.months[0].tasks[0].subtasks[0].actual_status,
  'transferred',
  'sending a subtask remainder flags it transferred',
)

// addSubtask is allowed on an added_in_actual task even though the plan is submitted
plan = await localBudgetPlan.getPlan(PID)
assert.equal(plan.status, 'submitted')
const extraTaskId = plan.months[0].tasks.find((t) => t.added_in_actual).id
plan = await localBudgetPlan.addSubtask(PID, '2026-08', extraTaskId, {
  name: 'Fuel',
  planned_amount: 0,
  activity: 'monitoring',
})
assert.equal(plan.months[0].tasks.find((t) => t.id === extraTaskId).subtasks.length, 1)
// but a normal (non-added_in_actual) task still can't get a new subtask post-submit
await assert.rejects(
  () => localBudgetPlan.addSubtask(PID, '2026-08', bigTaskId, { name: 'X', planned_amount: 0 }),
  /locked/,
)

// ── approveMonth / unapproveMonth ───────────────────────────────────
plan = await localBudgetPlan.approveMonth(PID, '2026-08')
assert.equal(plan.months[0].approved, true)
await assert.rejects(
  () => localBudgetPlan.resetActualMonth(PID, '2026-08'),
  /Un-approve/,
  'an approved month cannot be reset',
)
plan = await localBudgetPlan.unapproveMonth(PID, '2026-08')
assert.equal(plan.months[0].approved, false)

// ── resetActualMonth: clears only this month's actual-phase data ──
const planningTransferCountBefore = plan.transfers.filter((t) => t.phase === 'planning').length
plan = await localBudgetPlan.resetActualMonth(PID, '2026-08')
assert.equal(
  plan.months[0].tasks.some((t) => t.added_in_actual),
  false,
  'added_in_actual tasks are dropped on reset',
)
const resetSubtask = plan.months[0].tasks.find((t) => t.id === bigTaskId).subtasks[0]
assert.equal(resetSubtask.actual_amount, 0)
assert.equal(resetSubtask.actual_status, 'pending')
assert.equal(
  plan.transfers.some((t) => t.phase === 'actual' && t.origin_month === '2026-08'),
  false,
  'actual-phase transfers this month originated are gone',
)
assert.equal(
  plan.transfers.filter((t) => t.phase === 'planning').length,
  planningTransferCountBefore,
  'planning-phase transfers are untouched by an actual-phase reset',
)

// ── reopenPlanning: erases ALL actual-phase data, restores planning ─
plan = await localBudgetPlan.updateActual(PID, '2026-08', bigTaskId, bigSubtaskId, 5000)
plan = await localBudgetPlan.approveMonth(PID, '2026-08')
const plannedTotalsBefore = plan.months.map((m) =>
  m.tasks.reduce((s, t) => s + t.subtasks.reduce((ss, st) => ss + st.planned_amount, 0), 0),
)
plan = await localBudgetPlan.reopenPlanning(PID)
assert.equal(plan.status, 'planning')
assert.equal(plan.submitted_at, null)
assert.ok(
  plan.months.every((m) => !m.approved),
  'every month approval is cleared',
)
assert.ok(
  plan.months.every((m) => m.tasks.every((t) => !t.added_in_actual)),
  'every added_in_actual task is dropped',
)
assert.ok(
  plan.months.every((m) => m.tasks.every((t) => t.subtasks.every((s) => s.actual_amount === 0))),
  'every actual amount is reset to zero',
)
assert.ok(
  plan.transfers.every((t) => t.phase !== 'actual'),
  'every actual-phase transfer is removed',
)
assert.ok(
  plan.transfers.some((t) => t.phase === 'planning'),
  'planning-phase transfers survive',
)
const plannedTotalsAfter = plan.months.map((m) =>
  m.tasks.reduce((s, t) => s + t.subtasks.reduce((ss, st) => ss + st.planned_amount, 0), 0),
)
assert.deepEqual(plannedTotalsAfter, plannedTotalsBefore, 'planned amounts are untouched')
// editing is open again now that we're back in planning
plan = await localBudgetPlan.addTask(PID, '2026-08', { phase: 'design', name: 'Post-reopen edit' })
assert.ok(plan.months[0].tasks.some((t) => t.name === 'Post-reopen edit'))

console.log('localBudgetPlan.js: ALL PASSED')
