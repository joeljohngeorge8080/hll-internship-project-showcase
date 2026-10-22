/**
 * localBudgetPlan.js — Supabase persistence for the two-phase project
 * budget plan (spec: docs/superpowers/specs/2026-07-15-budget-plan-two-phase-design.md).
 * One row per project id in budget_plans. The nested/mutable part of the
 * plan (months incl. tasks/subtasks, and the transfers ledger) lives in
 * that row's plan_data jsonb column; the flat fields (status, project_value,
 * dates, pool pcts, saved_snapshot) map to their own columns.
 *
 * Previously this module persisted to a browser-local localStorage key,
 * which meant a collaborator's plan/tasks/actuals/transfers were invisible
 * to every other user. Every exported function is now async.
 */
import supabase from './supabase'
import {
  monthsInRange,
  equalSplit,
  validateTransfer,
  validatePoolTransfer,
  poolMonthKey,
  removeTransfersOriginatingFrom,
  settlementCheck,
} from './budgetPlan.js'

/** Name of the single actual task collapseLedgerTotal writes/updates per
 * month — matched by name so re-collapsing overwrites in place instead of
 * duplicating a line every time the PO re-uploads a corrected ledger. */
export const LEDGER_TASK_NAME = 'Uploaded from Excel — Ledger'

const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
const now = () => new Date().toISOString()

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

const emptyMonths = (months) => months.map((month) => ({ month, tasks: [] }))

const fromRow = (row) => ({
  version: 2,
  status: row.status,
  submitted_at: row.submitted_at,
  project_value: row.project_value,
  start_date: row.start_date,
  end_date: row.end_date,
  pool_pct: { admin: row.admin_pct, hr: row.hr_pct, core: row.core_pct },
  months: row.plan_data?.months || [],
  transfers: row.plan_data?.transfers || [],
  saved_snapshot: row.saved_snapshot,
})

const toRowPatch = (plan) => ({
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
})

const fetchRow = async (projectId) => {
  const { data, error } = await supabase
    .from('budget_plans')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle()
  throwIfError(error, 'Failed to load budget plan')
  return data
}

const requirePlan = async (projectId) => {
  const row = await fetchRow(projectId)
  if (!row) throw new Error('No budget plan exists for this project yet.')
  return fromRow(row)
}

const persist = async (projectId, plan) => {
  const { error } = await supabase
    .from('budget_plans')
    .update(toRowPatch(plan))
    .eq('project_id', projectId)
  throwIfError(error, 'Failed to save budget plan')
  return plan
}

const requirePlanning = (plan) => {
  if (plan.status !== 'planning') {
    throw new Error('Plan is locked — planning is closed.')
  }
}

const requireSubmitted = (plan) => {
  if (plan.status !== 'submitted') {
    throw new Error('Actual expense entry opens only after the plan is submitted.')
  }
}

const buildMonthTasksByMonth = (plan) =>
  Object.fromEntries(plan.months.map((m) => [m.month, m.tasks]))

const buildTransferCtx = (plan) => ({
  projectValue: plan.project_value,
  poolPct: plan.pool_pct,
  months: plan.months.map((m) => m.month),
  monthTasksByMonth: buildMonthTasksByMonth(plan),
  transfers: plan.transfers,
})

export const localBudgetPlan = {
  async getPlan(projectId) {
    const row = await fetchRow(projectId)
    return row ? fromRow(row) : null
  },

  requirePlanning,
  requireSubmitted,
  buildMonthTasksByMonth,
  buildTransferCtx,

  async initializePlan(projectId, { projectValue, startDate, endDate, poolPct }) {
    const existing = await fetchRow(projectId)
    if (existing) {
      throw new Error('A budget plan already exists for this project — use Full Delete first.')
    }
    const months = monthsInRange(startDate, endDate)
    if (months.length === 0) {
      throw new Error('Project must have a start and end date before initializing a plan.')
    }
    const plan = {
      version: 2,
      status: 'planning',
      submitted_at: null,
      project_value: projectValue,
      start_date: startDate,
      end_date: endDate,
      pool_pct: { admin: poolPct?.admin ?? 5, hr: poolPct?.hr ?? 5, core: poolPct?.core ?? 5 },
      months: emptyMonths(months),
      transfers: [],
      saved_snapshot: null,
    }
    const { error } = await supabase
      .from('budget_plans')
      .insert({ project_id: projectId, ...toRowPatch(plan) })
    throwIfError(error, 'Failed to initialize budget plan')
    return plan
  },

  async save(projectId) {
    const plan = await requirePlan(projectId)
    plan.saved_snapshot = {
      months: JSON.parse(JSON.stringify(plan.months)),
      transfers: JSON.parse(JSON.stringify(plan.transfers)),
      saved_at: now(),
    }
    return persist(projectId, plan)
  },

  async reset(projectId) {
    const plan = await requirePlan(projectId)
    if (plan.saved_snapshot) {
      plan.months = JSON.parse(JSON.stringify(plan.saved_snapshot.months))
      plan.transfers = JSON.parse(JSON.stringify(plan.saved_snapshot.transfers))
    } else {
      plan.months = emptyMonths(plan.months.map((m) => m.month))
      plan.transfers = []
    }
    return persist(projectId, plan)
  },

  async fullDelete(projectId) {
    const { error } = await supabase.from('budget_plans').delete().eq('project_id', projectId)
    throwIfError(error, 'Failed to delete budget plan')
  },

  async addTask(projectId, month, { phase, name, recurring = false }) {
    const plan = await requirePlan(projectId)
    requirePlanning(plan)
    const monthEntry = plan.months.find((m) => m.month === month)
    if (!monthEntry) throw new Error(`${month} is not part of this plan.`)
    monthEntry.tasks.push({
      id: uid('task'),
      phase,
      name: (name || '').trim(),
      recurring,
      added_in_actual: false,
      subtasks: [],
    })
    return persist(projectId, plan)
  },

  async removeTask(projectId, month, taskId) {
    const plan = await requirePlan(projectId)
    requirePlanning(plan)
    const monthEntry = plan.months.find((m) => m.month === month)
    if (!monthEntry) throw new Error(`${month} is not part of this plan.`)
    monthEntry.tasks = monthEntry.tasks.filter((t) => t.id !== taskId)
    return persist(projectId, plan)
  },

  async addSubtask(
    projectId,
    month,
    taskId,
    { name, planned_amount, activity, activity_other, sub_budget_head },
  ) {
    const plan = await requirePlan(projectId)
    const monthEntry = plan.months.find((m) => m.month === month)
    if (!monthEntry) throw new Error(`${month} is not part of this plan.`)
    const task = monthEntry.tasks.find((t) => t.id === taskId)
    if (!task) throw new Error('Task not found.')
    if (!task.added_in_actual) requirePlanning(plan)
    if (!activity || !activity.trim()) {
      throw new Error('Select an Activity before adding this subtask.')
    }
    if (activity === 'other' && !(activity_other || '').trim()) {
      throw new Error('Enter a name for the "Other" activity.')
    }
    task.subtasks.push({
      id: uid('sub'),
      name: (name || '').trim(),
      planned_amount: Math.round((parseFloat(planned_amount) || 0) * 100) / 100,
      actual_amount: 0,
      actual_status: 'pending',
      activity: activity.trim(),
      activity_other: activity === 'other' ? activity_other.trim() : '',
      sub_budget_head: (sub_budget_head || '').trim(),
    })
    return persist(projectId, plan)
  },

  async removeSubtask(projectId, month, taskId, subtaskId) {
    const plan = await requirePlan(projectId)
    requirePlanning(plan)
    const monthEntry = plan.months.find((m) => m.month === month)
    if (!monthEntry) throw new Error(`${month} is not part of this plan.`)
    const task = monthEntry.tasks.find((t) => t.id === taskId)
    if (!task) throw new Error('Task not found.')
    task.subtasks = task.subtasks.filter((s) => s.id !== subtaskId)
    return persist(projectId, plan)
  },

  async updateSubtaskPlanned(projectId, month, taskId, subtaskId, amount) {
    const plan = await requirePlan(projectId)
    requirePlanning(plan)
    const monthEntry = plan.months.find((m) => m.month === month)
    if (!monthEntry) throw new Error(`${month} is not part of this plan.`)
    const task = monthEntry.tasks.find((t) => t.id === taskId)
    if (!task) throw new Error('Task not found.')
    const subtask = task.subtasks.find((s) => s.id === subtaskId)
    if (!subtask) throw new Error('Subtask not found.')
    subtask.planned_amount = Math.round((parseFloat(amount) || 0) * 100) / 100
    return persist(projectId, plan)
  },

  /**
   * Applies a batch of recurring tasks at once (spec Section 4.1, extended
   * to support subtasks). Each task's total — or, if it has explicit
   * subtasks, each subtask's own total — is divided equally across every
   * month (paise-exact), creating one recurring task per month with either
   * a single auto-named subtask (flat mode) or the given subtasks.
   */
  async applyRecurringTasks(projectId, { tasks }) {
    const plan = await requirePlan(projectId)
    requirePlanning(plan)
    if (!tasks || tasks.length === 0) throw new Error('Add at least one task before applying.')

    const validateActivity = (label, activity, activityOther) => {
      if (!activity || !activity.trim()) {
        throw new Error(`"${label}" needs an Activity selected.`)
      }
      if (activity === 'other' && !(activityOther || '').trim()) {
        throw new Error(`"${label}" needs a name for the "Other" activity.`)
      }
    }

    const monthCount = plan.months.length
    const prepared = tasks.map(
      ({ phase, name, totalAmount, activity, activityOther, subBudgetHead, subtasks }) => {
        if (!name || !name.trim()) throw new Error('Every task needs a name.')
        const trimmedName = name.trim()
        const hasSubtasks = subtasks && subtasks.length > 0

        if (hasSubtasks) {
          const preparedSubtasks = subtasks.map(
            ({
              name: subName,
              totalAmount: subTotal,
              activity: subActivity,
              activityOther: subActivityOther,
              subBudgetHead: subBudgetHeadValue,
            }) => {
              if (!subName || !subName.trim()) throw new Error('Every subtask needs a name.')
              validateActivity(subName.trim(), subActivity, subActivityOther)
              const amt = Math.round((parseFloat(subTotal) || 0) * 100) / 100
              if (amt <= 0) throw new Error(`"${subName}" needs an amount greater than zero.`)
              return {
                name: subName.trim(),
                shares: equalSplit(amt, monthCount),
                activity: subActivity.trim(),
                activity_other: subActivity === 'other' ? subActivityOther.trim() : '',
                sub_budget_head: (subBudgetHeadValue || '').trim(),
              }
            },
          )
          return { phase, name: trimmedName, subtasks: preparedSubtasks }
        }

        validateActivity(trimmedName, activity, activityOther)
        const amt = Math.round((parseFloat(totalAmount) || 0) * 100) / 100
        if (amt <= 0) throw new Error(`"${trimmedName}" needs an amount greater than zero.`)
        return {
          phase,
          name: trimmedName,
          subtasks: [
            {
              name: trimmedName,
              shares: equalSplit(amt, monthCount),
              activity: activity.trim(),
              activity_other: activity === 'other' ? activityOther.trim() : '',
              sub_budget_head: (subBudgetHead || '').trim(),
            },
          ],
        }
      },
    )

    plan.months.forEach((monthEntry, i) => {
      prepared.forEach((task) => {
        monthEntry.tasks.push({
          id: uid('task'),
          phase: task.phase,
          name: task.name,
          recurring: true,
          added_in_actual: false,
          subtasks: task.subtasks.map((sub) => ({
            id: uid('sub'),
            name: sub.name,
            planned_amount: sub.shares[i],
            actual_amount: 0,
            actual_status: 'pending',
            activity: sub.activity,
            activity_other: sub.activity_other,
            sub_budget_head: sub.sub_budget_head,
          })),
        })
      })
    })
    return persist(projectId, plan)
  },

  /**
   * Moves `amount` either away from `originMonth` (direction 'send', split
   * across `targets`) or into it (direction 'take', drawn from `targets`),
   * validating and appending one ledger record per target. `subtaskRef`
   * (actual phase only) flags the originating subtask 'transferred' when
   * sending its remainder away (spec Section 6).
   */
  async moveBalance(
    projectId,
    { originMonth, direction, targets, amount, phase, createdBy, subtaskRef },
  ) {
    const plan = await requirePlan(projectId)
    const amt = Math.round((parseFloat(amount) || 0) * 100) / 100
    if (amt <= 0) throw new Error('Amount must be greater than zero.')
    if (!targets || targets.length === 0) throw new Error('Select at least one destination.')

    const shares = equalSplit(amt, targets.length)
    const ctx = buildTransferCtx(plan)
    const newTransfers = []

    targets.forEach((target, i) => {
      const share = shares[i]
      const from = direction === 'send' ? `month:${originMonth}` : target
      const to = direction === 'send' ? target : `month:${originMonth}`
      const validation = validateTransfer(
        { ...ctx, phase, transfers: [...ctx.transfers, ...newTransfers] },
        { from, to, amount: share },
      )
      if (!validation.valid) throw new Error(validation.error)
      newTransfers.push({
        id: uid('xfer'),
        phase,
        origin_month: originMonth,
        from,
        to,
        amount: share,
        created_at: now(),
        created_by: createdBy || 'Unknown',
      })
    })

    plan.transfers = [...plan.transfers, ...newTransfers]

    if (subtaskRef && direction === 'send' && phase === 'actual') {
      const monthEntry = plan.months.find((m) => m.month === subtaskRef.month)
      const task = monthEntry?.tasks.find((t) => t.id === subtaskRef.taskId)
      const subtask = task?.subtasks.find((s) => s.id === subtaskRef.subtaskId)
      if (subtask) subtask.actual_status = 'transferred'
    }

    return persist(projectId, plan)
  },

  /**
   * Reattributes `amount` of `fromPool`'s credit in `fromMonth` to `toPool`
   * in `toMonth` — a direct pool-to-pool move that never touches either
   * month's own project task budget. This is how reducing a month's HR/
   * Core/Admin block now behaves: the reduced amount goes to another
   * month's pool credit, not back into this month's own allocation.
   */
  async movePoolBalance(
    projectId,
    { fromPool, fromMonth, toPool, toMonth, amount, phase, createdBy },
  ) {
    const plan = await requirePlan(projectId)
    const amt = Math.round((parseFloat(amount) || 0) * 100) / 100
    const ctx = buildTransferCtx(plan)
    const validation = validatePoolTransfer(ctx, {
      fromPool,
      fromMonth,
      toPool,
      toMonth,
      amount: amt,
    })
    if (!validation.valid) throw new Error(validation.error)

    plan.transfers = [
      ...plan.transfers,
      {
        id: uid('xfer'),
        phase,
        origin_month: fromMonth,
        from: poolMonthKey(fromPool, fromMonth),
        to: poolMonthKey(toPool, toMonth),
        amount: amt,
        created_at: now(),
        created_by: createdBy || 'Unknown',
      },
    ]
    return persist(projectId, plan)
  },

  /** Removes one ledger record by id. Planning-phase transfers are frozen once submitted. */
  async revokeTransfer(projectId, transferId) {
    const plan = await requirePlan(projectId)
    const transfer = plan.transfers.find((t) => t.id === transferId)
    if (!transfer) throw new Error('Transfer not found.')
    if (transfer.phase === 'planning' && plan.status === 'submitted') {
      throw new Error('Planning transfers are locked after submit.')
    }
    plan.transfers = plan.transfers.filter((t) => t.id !== transferId)
    return persist(projectId, plan)
  },

  /**
   * Reset this month: restore its tasks from the save snapshot (or empty)
   * AND drop every ledger transfer this month originated (which restores
   * every other month/pool that transfer touched) — spec Section 4.2.
   * Transfers where this month is only a counterparty (originated by a
   * DIFFERENT month) are kept.
   */
  async resetMonth(projectId, month) {
    const plan = await requirePlan(projectId)
    requirePlanning(plan)
    const monthEntry = plan.months.find((m) => m.month === month)
    if (!monthEntry) throw new Error(`${month} is not part of this plan.`)

    const savedMonth = plan.saved_snapshot?.months.find((m) => m.month === month)
    monthEntry.tasks = savedMonth ? JSON.parse(JSON.stringify(savedMonth.tasks)) : []
    plan.transfers = removeTransfersOriginatingFrom(plan.transfers, month)

    return persist(projectId, plan)
  },

  /**
   * The header HR/Core amount input (spec Section 4.1): upserts the single
   * pool→month adjustment tagged 'pool_cap_adjustment' for this pool,
   * capped so the pool's balance never exceeds its original pct cap.
   * Raising back to exactly the cap removes the adjustment (no no-op record).
   */
  async setPoolCapAdjustment(projectId, { pool, targetMonth, newAmount, createdBy }) {
    const plan = await requirePlan(projectId)
    requirePlanning(plan)
    if (pool !== 'hr' && pool !== 'core') throw new Error('Pool must be hr or core.')

    const cap = Math.round(((plan.project_value * (plan.pool_pct[pool] || 0)) / 100) * 100) / 100
    const amt = Math.round((parseFloat(newAmount) || 0) * 100) / 100
    if (amt > cap + 0.005) {
      throw new Error(`${pool.toUpperCase()} cannot be raised above its set ₹${cap.toFixed(2)}.`)
    }
    if (amt < 0) throw new Error(`${pool.toUpperCase()} cannot go below zero.`)

    const delta = Math.round((cap - amt) * 100) / 100
    const withoutExisting = plan.transfers.filter(
      (t) => !(t.tag === 'pool_cap_adjustment' && t.pool_ref === pool),
    )

    if (Math.abs(delta) < 0.01) {
      plan.transfers = withoutExisting
    } else {
      plan.transfers = [
        ...withoutExisting,
        {
          id: uid('xfer'),
          phase: 'planning',
          origin_month: targetMonth,
          from: pool,
          to: `month:${targetMonth}`,
          amount: delta,
          tag: 'pool_cap_adjustment',
          pool_ref: pool,
          created_at: now(),
          created_by: createdBy || 'Unknown',
        },
      ]
    }
    return persist(projectId, plan)
  },

  async computeSettlement(projectId) {
    const plan = await requirePlan(projectId)
    return settlementCheck(buildTransferCtx(plan))
  },

  /** Submits the plan (spec Section 5) — blocked until settlementCheck.valid. */
  async submit(projectId) {
    const plan = await requirePlan(projectId)
    requirePlanning(plan)
    const check = settlementCheck(buildTransferCtx(plan))
    if (!check.valid) {
      throw new Error(
        'Plan is not fully settled — settle every month (and any HR/Core/Admin shortfall) before submitting.',
      )
    }
    plan.status = 'submitted'
    plan.submitted_at = now()
    return persist(projectId, plan)
  },

  /**
   * The one last-resort submit-time action (spec Section 5): draws the
   * settlementCheck's reported adminDraw.amount from Admin, split equally
   * across every month still in deficit after HR/Core's own capacity is
   * accounted for by settlementCheck's math.
   */
  async drawFromAdmin(projectId, { createdBy }) {
    const plan = await requirePlan(projectId)
    requirePlanning(plan)
    const check = settlementCheck(buildTransferCtx(plan))
    if (!check.adminDraw || check.adminDraw.amount <= 0) {
      throw new Error('No Admin draw is needed right now.')
    }
    const deficitMonths = check.monthIssues.filter((i) => i.diff > 0).map((i) => i.month)
    const shares = equalSplit(check.adminDraw.amount, deficitMonths.length)
    const newTransfers = deficitMonths.map((month, i) => ({
      id: uid('xfer'),
      phase: 'planning',
      origin_month: month,
      from: 'admin',
      to: `month:${month}`,
      amount: shares[i],
      created_at: now(),
      created_by: createdBy || 'Unknown',
    }))
    plan.transfers = [...plan.transfers, ...newTransfers]
    return persist(projectId, plan)
  },

  async updateActual(projectId, month, taskId, subtaskId, amount) {
    const plan = await requirePlan(projectId)
    requireSubmitted(plan)
    const monthEntry = plan.months.find((m) => m.month === month)
    const task = monthEntry?.tasks.find((t) => t.id === taskId)
    const subtask = task?.subtasks.find((s) => s.id === subtaskId)
    if (!subtask) throw new Error('Subtask not found.')
    const amt = Math.round((parseFloat(amount) || 0) * 100) / 100
    subtask.actual_amount = amt
    subtask.actual_status = amt > 0 ? 'entered' : 'pending'
    return persist(projectId, plan)
  },

  /** New task row added during actual entry — has no planned amount (spec Section 6). */
  async addActualTask(projectId, month, { phase, name }) {
    const plan = await requirePlan(projectId)
    requireSubmitted(plan)
    const monthEntry = plan.months.find((m) => m.month === month)
    if (!monthEntry) throw new Error(`${month} is not part of this plan.`)
    monthEntry.tasks.push({
      id: uid('task'),
      phase,
      name: (name || '').trim(),
      recurring: false,
      added_in_actual: true,
      subtasks: [],
    })
    return persist(projectId, plan)
  },

  /**
   * Sends the plan back to the planning phase (the "Back to Planning"
   * escape hatch). Erases every actual-phase entry — actual amounts, tasks
   * added during actual entry, actual-phase transfers, and month approvals
   * — but leaves planned amounts, plan structure, and planning-phase
   * transfers exactly as they were at submit, since nothing in the actual
   * phase can touch those (requirePlanning already guards them).
   */
  async reopenPlanning(projectId) {
    const plan = await requirePlan(projectId)
    requireSubmitted(plan)
    plan.months.forEach((monthEntry) => {
      monthEntry.tasks = monthEntry.tasks.filter((t) => !t.added_in_actual)
      monthEntry.tasks.forEach((t) => {
        t.subtasks.forEach((s) => {
          s.actual_amount = 0
          s.actual_status = 'pending'
        })
      })
      monthEntry.approved = false
    })
    plan.transfers = plan.transfers.filter((t) => t.phase !== 'actual')
    plan.status = 'planning'
    plan.submitted_at = null
    return persist(projectId, plan)
  },

  /** Reset one month's actual-phase entries only (spec-analogous to
   * resetMonth in planning): drops tasks added in actual, zeroes every
   * subtask's actual figures, and removes actual-phase transfers this
   * month originated (transfers other months sent into it are kept). */
  async resetActualMonth(projectId, month) {
    const plan = await requirePlan(projectId)
    requireSubmitted(plan)
    const monthEntry = plan.months.find((m) => m.month === month)
    if (!monthEntry) throw new Error(`${month} is not part of this plan.`)
    if (monthEntry.approved) throw new Error('Un-approve this month before resetting it.')
    monthEntry.tasks = monthEntry.tasks.filter((t) => !t.added_in_actual)
    monthEntry.tasks.forEach((t) => {
      t.subtasks.forEach((s) => {
        s.actual_amount = 0
        s.actual_status = 'pending'
      })
    })
    plan.transfers = plan.transfers.filter(
      (t) => !(t.phase === 'actual' && t.origin_month === month),
    )
    return persist(projectId, plan)
  },

  /** Approving a month freezes its actual entries — amounts, added tasks,
   * transfers, and this month's own Reset all become unavailable until
   * it's un-approved. */
  async approveMonth(projectId, month) {
    const plan = await requirePlan(projectId)
    requireSubmitted(plan)
    const monthEntry = plan.months.find((m) => m.month === month)
    if (!monthEntry) throw new Error(`${month} is not part of this plan.`)
    monthEntry.approved = true
    return persist(projectId, plan)
  },

  async unapproveMonth(projectId, month) {
    const plan = await requirePlan(projectId)
    requireSubmitted(plan)
    const monthEntry = plan.months.find((m) => m.month === month)
    if (!monthEntry) throw new Error(`${month} is not part of this plan.`)
    monthEntry.approved = false
    return persist(projectId, plan)
  },

  /**
   * Sends a project ledger upload's month total into that month's actual
   * phase as a single line (the "Collapse to actual" button). Finds the
   * task by LEDGER_TASK_NAME and overwrites its one subtask's actual_amount
   * if it already exists, otherwise creates both — so re-collapsing after a
   * corrected re-upload updates in place instead of piling up duplicates.
   */
  async collapseLedgerTotal(projectId, month, amount) {
    const plan = await requirePlan(projectId)
    requireSubmitted(plan)
    const monthEntry = plan.months.find((m) => m.month === month)
    if (!monthEntry) throw new Error(`${month} is not part of this plan.`)
    if (monthEntry.approved) throw new Error('Un-approve this month before updating it.')
    const amt = Math.round((parseFloat(amount) || 0) * 100) / 100
    const existingTask = monthEntry.tasks.find(
      (t) => t.added_in_actual && t.name === LEDGER_TASK_NAME,
    )
    if (existingTask && existingTask.subtasks[0]) {
      existingTask.subtasks[0].actual_amount = amt
      existingTask.subtasks[0].actual_status = amt > 0 ? 'entered' : 'pending'
    } else {
      monthEntry.tasks.push({
        id: uid('task'),
        phase: 'implementation',
        name: LEDGER_TASK_NAME,
        recurring: false,
        added_in_actual: true,
        subtasks: [
          {
            id: uid('sub'),
            name: 'Ledger total',
            planned_amount: 0,
            actual_amount: amt,
            actual_status: amt > 0 ? 'entered' : 'pending',
            activity: 'other',
            activity_other: 'Ledger upload',
            sub_budget_head: '',
          },
        ],
      })
    }
    return persist(projectId, plan)
  },
}
