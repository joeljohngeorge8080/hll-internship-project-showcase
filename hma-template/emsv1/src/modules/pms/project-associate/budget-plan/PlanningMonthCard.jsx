import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CFormInput,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilTrash, cilPlus, cilReload } from '@coreui/icons'
import {
  monthAllocated,
  monthBaselines,
  computeWorkingPool,
  monthPlannedTotal,
  poolMonthBaseline,
  poolNetForMonth,
  isPoolMonthKey,
  parsePoolMonthKey,
} from '../../../../services/budgetPlan'
import { localBudgetPlan } from '../../../../services/localBudgetPlan'
import MonthPicker from './MonthPicker'
import PoolAdjustModal from './PoolAdjustModal'
import { ACTIVITY_OPTIONS, activityLabelOf } from './activityOptions'

const PHASE_OPTIONS = [
  { value: 'design', label: 'Design' },
  { value: 'implementation', label: 'Implementation' },
  { value: 'monitoring', label: 'Monitoring' },
]

const ACCENTS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2']

const POOL_LABELS = { admin: 'Admin', hr: 'HR', core: 'Core' }

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const phaseLabelOf = (value) => PHASE_OPTIONS.find((p) => p.value === value)?.label || value

const monthLabel = (ym) => {
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

const emptyNewTask = { phase: 'design', name: '' }
const emptyNewSubtask = { name: '', amount: '', activity: '', activityOther: '', subBudgetHead: '' }

const PlanningMonthCard = ({
  project,
  plan,
  month,
  colorIndex,
  canEdit,
  onPlanChange,
  currentUser,
}) => {
  const [resetConfirm, setResetConfirm] = useState(false)
  const [error, setError] = useState('')
  const [adjustingPool, setAdjustingPool] = useState(null)
  const [newTask, setNewTask] = useState(emptyNewTask)
  const [newSubtaskByTask, setNewSubtaskByTask] = useState({})
  const accent = ACCENTS[colorIndex % ACCENTS.length]

  const monthEntry = plan.months.find((m) => m.month === month)
  const monthCount = plan.months.length
  const baselines = monthBaselines(
    computeWorkingPool(plan.project_value, plan.pool_pct),
    plan.months.map((m) => m.month),
  )
  const allocated = monthAllocated(baselines[month], plan.transfers, month)
  const planned = monthPlannedTotal(monthEntry.tasks)
  const diff = Math.round((planned - allocated) * 100) / 100
  const monthTransfers = plan.transfers.filter((t) => {
    if (t.from === `month:${month}` || t.to === `month:${month}`) return true
    if (isPoolMonthKey(t.from) && parsePoolMonthKey(t.from).month === month) return true
    if (isPoolMonthKey(t.to) && parsePoolMonthKey(t.to).month === month) return true
    return false
  })

  const run = async (fn) => {
    setError('')
    try {
      onPlanChange(await fn())
    } catch (e) {
      setError(e.message)
    }
  }

  const handleAddTask = async () => {
    if (!newTask.name.trim()) return
    await run(() =>
      localBudgetPlan.addTask(project.id, month, { phase: newTask.phase, name: newTask.name }),
    )
    setNewTask(emptyNewTask)
  }

  const subtaskDraft = (taskId) => newSubtaskByTask[taskId] || emptyNewSubtask
  const setSubtaskDraft = (taskId, patch) =>
    setNewSubtaskByTask((prev) => ({ ...prev, [taskId]: { ...subtaskDraft(taskId), ...patch } }))

  const handleAddSubtask = async (taskId) => {
    const draft = subtaskDraft(taskId)
    if (!draft.name.trim() || !draft.activity) return
    await run(() =>
      localBudgetPlan.addSubtask(project.id, month, taskId, {
        name: draft.name,
        planned_amount: parseFloat(draft.amount) || 0,
        activity: draft.activity,
        activity_other: draft.activityOther,
        sub_budget_head: draft.subBudgetHead,
      }),
    )
    setNewSubtaskByTask((prev) => ({ ...prev, [taskId]: emptyNewSubtask }))
  }

  const handleSend = (targets) =>
    run(() =>
      localBudgetPlan.moveBalance(project.id, {
        originMonth: month,
        direction: 'send',
        targets,
        amount: Math.abs(diff),
        phase: 'planning',
        createdBy: currentUser,
      }),
    )
  const handleTake = (targets) =>
    run(() =>
      localBudgetPlan.moveBalance(project.id, {
        originMonth: month,
        direction: 'take',
        targets,
        amount: Math.abs(diff),
        phase: 'planning',
        createdBy: currentUser,
      }),
    )

  return (
    <CCard className="mb-3" style={{ borderLeft: `4px solid ${accent}` }}>
      <CCardHeader
        style={{ background: `${accent}14` }}
        className="d-flex justify-content-between align-items-center"
      >
        <span className="fw-semibold">{monthLabel(month)}</span>
        {canEdit && (
          <CButton
            size="sm"
            color="secondary"
            variant="ghost"
            onClick={() => setResetConfirm(true)}
          >
            <CIcon icon={cilReload} size="sm" className="me-1" /> Reset this month
          </CButton>
        )}
      </CCardHeader>
      <CCardBody>
        <div className="small text-body-secondary mb-2">
          Allocated: <strong>{fmt(allocated)}</strong> &nbsp;·&nbsp; Planned:{' '}
          <strong>{fmt(planned)}</strong>
        </div>

        <div className="d-flex gap-2 flex-wrap mb-3">
          {['admin', 'hr', 'core'].map((pool) => {
            const net = poolNetForMonth(plan.transfers, pool, month)
            const amount =
              poolMonthBaseline(plan.project_value, plan.pool_pct, pool, monthCount) + net
            return (
              <div key={pool} className="border rounded p-2 flex-grow-1" style={{ minWidth: 140 }}>
                <div className="small text-body-secondary d-flex justify-content-between">
                  <span>
                    {POOL_LABELS[pool]} ({pool === 'admin' ? '' : 'max '}
                    {plan.pool_pct[pool]}%)
                  </span>
                  {Math.abs(net) > 0.005 && (
                    <span className="badge text-bg-warning" style={{ fontSize: '0.62rem' }}>
                      adjusted
                    </span>
                  )}
                </div>
                <div className="d-flex align-items-center justify-content-between gap-2">
                  <span className="fw-semibold">{fmt(amount)}</span>
                  {canEdit && (
                    <CButton
                      size="sm"
                      color="secondary"
                      variant="outline"
                      onClick={() => setAdjustingPool(pool)}
                    >
                      Send
                    </CButton>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {adjustingPool && (
          <PoolAdjustModal
            visible
            onClose={() => setAdjustingPool(null)}
            project={project}
            plan={plan}
            pool={adjustingPool}
            month={month}
            phase="planning"
            currentAmount={
              poolMonthBaseline(plan.project_value, plan.pool_pct, adjustingPool, monthCount) +
              poolNetForMonth(plan.transfers, adjustingPool, month)
            }
            currentUser={currentUser}
            onPlanChange={onPlanChange}
          />
        )}

        {monthEntry.tasks.map((task) => (
          <div key={task.id} className="border rounded p-2 mb-2">
            <div className="d-flex gap-2 align-items-center mb-1">
              <span className="small text-body-secondary" style={{ width: 110 }}>
                {phaseLabelOf(task.phase)}
              </span>
              <span className="fw-medium flex-grow-1">{task.name}</span>
              {canEdit && (
                <CButton
                  size="sm"
                  color="danger"
                  variant="ghost"
                  onClick={() => run(() => localBudgetPlan.removeTask(project.id, month, task.id))}
                >
                  <CIcon icon={cilTrash} size="sm" />
                </CButton>
              )}
            </div>
            {task.subtasks.map((sub) => (
              <div key={sub.id} className="d-flex gap-2 align-items-center mb-1 ms-3 flex-wrap">
                <span className="small" style={{ width: 160 }}>
                  {sub.name}
                </span>
                <span className="small text-body-secondary" style={{ width: 150 }}>
                  {activityLabelOf(sub.activity, sub.activity_other)}
                </span>
                {sub.sub_budget_head && (
                  <span className="small text-body-tertiary" style={{ width: 140 }}>
                    {sub.sub_budget_head}
                  </span>
                )}
                <CFormInput
                  size="sm"
                  type="number"
                  style={{ width: 130 }}
                  value={sub.planned_amount || ''}
                  disabled={!canEdit}
                  onChange={(e) =>
                    run(() =>
                      localBudgetPlan.updateSubtaskPlanned(
                        project.id,
                        month,
                        task.id,
                        sub.id,
                        e.target.value,
                      ),
                    )
                  }
                />
                {canEdit && (
                  <CButton
                    size="sm"
                    color="danger"
                    variant="ghost"
                    onClick={() =>
                      run(() => localBudgetPlan.removeSubtask(project.id, month, task.id, sub.id))
                    }
                  >
                    <CIcon icon={cilTrash} size="sm" />
                  </CButton>
                )}
              </div>
            ))}
            {canEdit && (
              <div className="d-flex gap-2 align-items-center ms-3 mt-1 flex-wrap">
                <CFormInput
                  size="sm"
                  style={{ width: 160 }}
                  placeholder="Subtask"
                  value={subtaskDraft(task.id).name}
                  onChange={(e) => setSubtaskDraft(task.id, { name: e.target.value })}
                />
                <CFormSelect
                  size="sm"
                  style={{ width: 170 }}
                  value={subtaskDraft(task.id).activity}
                  onChange={(e) => setSubtaskDraft(task.id, { activity: e.target.value })}
                >
                  <option value="">Activity...</option>
                  {ACTIVITY_OPTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </CFormSelect>
                {subtaskDraft(task.id).activity === 'other' && (
                  <CFormInput
                    size="sm"
                    style={{ width: 150 }}
                    placeholder="Activity name"
                    value={subtaskDraft(task.id).activityOther}
                    onChange={(e) => setSubtaskDraft(task.id, { activityOther: e.target.value })}
                  />
                )}
                <CFormInput
                  size="sm"
                  style={{ width: 150 }}
                  placeholder="Sub-budget head"
                  value={subtaskDraft(task.id).subBudgetHead}
                  onChange={(e) => setSubtaskDraft(task.id, { subBudgetHead: e.target.value })}
                />
                <CFormInput
                  size="sm"
                  type="number"
                  style={{ width: 130 }}
                  placeholder="Amount"
                  value={subtaskDraft(task.id).amount}
                  onChange={(e) => setSubtaskDraft(task.id, { amount: e.target.value })}
                />
                <CButton
                  size="sm"
                  color="secondary"
                  variant="outline"
                  onClick={() => handleAddSubtask(task.id)}
                  disabled={
                    !subtaskDraft(task.id).activity ||
                    (subtaskDraft(task.id).activity === 'other' &&
                      !subtaskDraft(task.id).activityOther.trim())
                  }
                >
                  <CIcon icon={cilPlus} className="me-1" /> Subtask
                </CButton>
              </div>
            )}
          </div>
        ))}

        {canEdit && (
          <div className="d-flex gap-2 align-items-center mb-2">
            <CFormSelect
              size="sm"
              style={{ width: 150 }}
              value={newTask.phase}
              onChange={(e) => setNewTask((t) => ({ ...t, phase: e.target.value }))}
            >
              {PHASE_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </CFormSelect>
            <CFormInput
              size="sm"
              placeholder="Task name"
              value={newTask.name}
              onChange={(e) => setNewTask((t) => ({ ...t, name: e.target.value }))}
            />
            <CButton size="sm" color="secondary" variant="outline" onClick={handleAddTask}>
              <CIcon icon={cilPlus} className="me-1" /> Add Task
            </CButton>
          </div>
        )}

        {monthTransfers.map((t) => {
          const thisMonthPoolLeg =
            isPoolMonthKey(t.from) && parsePoolMonthKey(t.from).month === month
              ? parsePoolMonthKey(t.from).pool
              : isPoolMonthKey(t.to) && parsePoolMonthKey(t.to).month === month
                ? parsePoolMonthKey(t.to).pool
                : null
          const outgoing =
            t.from === `month:${month}` ||
            (isPoolMonthKey(t.from) && parsePoolMonthKey(t.from).month === month)
          const counterpart = outgoing ? t.to : t.from
          const counterpartLabel = counterpart.startsWith('month:')
            ? monthLabel(counterpart.slice('month:'.length))
            : isPoolMonthKey(counterpart)
              ? `${POOL_LABELS[parsePoolMonthKey(counterpart).pool]} (${monthLabel(parsePoolMonthKey(counterpart).month)})`
              : counterpart.toUpperCase()
          return (
            <div key={t.id} className="small text-body-secondary">
              {thisMonthPoolLeg && `${POOL_LABELS[thisMonthPoolLeg]} — `}
              {outgoing
                ? `− ${fmt(t.amount)} sent to ${counterpartLabel}`
                : `+ ${fmt(t.amount)} received from ${counterpartLabel}`}
              {canEdit && plan.status === 'planning' && (
                <CButton
                  size="sm"
                  color="secondary"
                  variant="ghost"
                  className="ms-1 p-0 px-1"
                  onClick={() => run(() => localBudgetPlan.revokeTransfer(project.id, t.id))}
                >
                  revoke
                </CButton>
              )}
            </div>
          )
        })}

        {canEdit && diff < -0.005 && (
          <div className="mt-2 p-2 border rounded bg-body-tertiary">
            <div className="small mb-1">
              Not fully utilized — balance this month: <strong>{fmt(-diff)}</strong>
            </div>
            <div className="d-flex gap-2 flex-wrap">
              <CButton size="sm" color="success" onClick={() => handleSend(['hr', 'core'])}>
                Send to HR/Core
              </CButton>
              <MonthPicker
                months={plan.months.map((m) => m.month)}
                excludeMonth={month}
                label="Send to other months"
                onConfirm={(targets) => handleSend(targets.map((m) => `month:${m}`))}
              />
            </div>
          </div>
        )}

        {canEdit && diff > 0.005 && (
          <div className="mt-2 p-2 border rounded bg-body-tertiary">
            <div className="small mb-1 text-danger">Needs {fmt(diff)} more to satisfy</div>
            <div className="d-flex gap-2 flex-wrap">
              <CButton size="sm" color="warning" onClick={() => handleTake(['hr', 'core'])}>
                Take from HR/Core
              </CButton>
              <MonthPicker
                months={plan.months.map((m) => m.month)}
                excludeMonth={month}
                label="Take from months"
                onConfirm={(targets) => handleTake(targets.map((m) => `month:${m}`))}
              />
            </div>
          </div>
        )}

        {error && <div className="text-danger small mt-2">{error}</div>}
      </CCardBody>

      <CModal
        visible={resetConfirm}
        onClose={() => setResetConfirm(false)}
        alignment="center"
        size="sm"
      >
        <CModalHeader>
          <CModalTitle>Confirm Reset</CModalTitle>
        </CModalHeader>
        <CModalBody className="small">
          This restores {monthLabel(month)}&apos;s tasks to the last save and undoes every transfer
          it sent or took — which also restores any other month or pool those transfers touched.
          Continue?
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="ghost"
            size="sm"
            onClick={() => setResetConfirm(false)}
          >
            Cancel
          </CButton>
          <CButton
            color="danger"
            size="sm"
            onClick={async () => {
              await run(() => localBudgetPlan.resetMonth(project.id, month))
              setResetConfirm(false)
            }}
          >
            Confirm
          </CButton>
        </CModalFooter>
      </CModal>
    </CCard>
  )
}

PlanningMonthCard.propTypes = {
  project: PropTypes.object.isRequired,
  plan: PropTypes.object.isRequired,
  month: PropTypes.string.isRequired,
  colorIndex: PropTypes.number.isRequired,
  canEdit: PropTypes.bool,
  onPlanChange: PropTypes.func.isRequired,
  currentUser: PropTypes.string,
}

export default PlanningMonthCard
