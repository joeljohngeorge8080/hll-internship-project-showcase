import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CFormInput,
  CFormSelect,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilTrash } from '@coreui/icons'
import { localBudgetPlan } from '../../../../services/localBudgetPlan'
import { ACTIVITY_OPTIONS, activityLabelOf } from './activityOptions'

const PHASE_OPTIONS = [
  { value: 'design', label: 'Design' },
  { value: 'implementation', label: 'Implementation' },
  { value: 'monitoring', label: 'Monitoring' },
]

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const emptyDraftTask = () => ({
  id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  phase: 'design',
  name: '',
  totalAmount: '',
  activity: '',
  activityOther: '',
  subBudgetHead: '',
  subtasks: [],
})

const emptySubtaskDraft = {
  name: '',
  totalAmount: '',
  activity: '',
  activityOther: '',
  subBudgetHead: '',
}

/** A queued task's own total when it has no explicit subtasks, or the sum
 * of its subtask totals when it does — used only for the summary display. */
const draftTaskTotal = (task) =>
  task.subtasks.length > 0
    ? task.subtasks.reduce((s, st) => s + (parseFloat(st.totalAmount) || 0), 0)
    : parseFloat(task.totalAmount) || 0

const RecurringTasksEntry = ({ project, plan, canEdit, onPlanChange }) => {
  const [drafts, setDrafts] = useState([])
  const [subtaskDraftByTask, setSubtaskDraftByTask] = useState({})
  const [error, setError] = useState('')
  const [applied, setApplied] = useState(false)

  if (!canEdit || plan.status !== 'planning') return null

  const monthCount = plan.months.length

  const addDraftTask = () => setDrafts((prev) => [...prev, emptyDraftTask()])
  const removeDraftTask = (id) => setDrafts((prev) => prev.filter((t) => t.id !== id))
  const updateDraftTask = (id, patch) =>
    setDrafts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))

  const subtaskDraft = (taskId) => subtaskDraftByTask[taskId] || emptySubtaskDraft
  const setSubtaskDraft = (taskId, patch) =>
    setSubtaskDraftByTask((prev) => ({
      ...prev,
      [taskId]: { ...subtaskDraft(taskId), ...patch },
    }))

  const addSubtaskToDraft = (taskId) => {
    const draft = subtaskDraft(taskId)
    if (!draft.name.trim() || !(parseFloat(draft.totalAmount) > 0) || !draft.activity) return
    if (draft.activity === 'other' && !draft.activityOther.trim()) return
    updateDraftTask(taskId, {
      subtasks: [
        ...(drafts.find((t) => t.id === taskId)?.subtasks || []),
        { id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, ...draft },
      ],
    })
    setSubtaskDraftByTask((prev) => ({ ...prev, [taskId]: emptySubtaskDraft }))
  }

  const removeSubtaskFromDraft = (taskId, subtaskDraftId) => {
    const task = drafts.find((t) => t.id === taskId)
    if (!task) return
    updateDraftTask(taskId, { subtasks: task.subtasks.filter((s) => s.id !== subtaskDraftId) })
  }

  const draftActivityOk = (t) =>
    t.subtasks.length > 0 || (t.activity && (t.activity !== 'other' || t.activityOther.trim()))
  const validDrafts = drafts.filter(
    (t) => t.name.trim() && draftTaskTotal(t) > 0 && draftActivityOk(t),
  )
  const totalBudget = validDrafts.reduce((s, t) => s + draftTaskTotal(t), 0)
  const perMonth = monthCount > 0 ? totalBudget / monthCount : 0

  const handleApply = async () => {
    setError('')
    if (!validDrafts.length) {
      setError('Add at least one task with a name and amount before applying.')
      return
    }
    try {
      const updated = await localBudgetPlan.applyRecurringTasks(project.id, {
        tasks: validDrafts.map((t) => ({
          phase: t.phase,
          name: t.name,
          totalAmount: t.totalAmount,
          activity: t.activity,
          activityOther: t.activityOther,
          subBudgetHead: t.subBudgetHead,
          subtasks: t.subtasks.map((s) => ({
            name: s.name,
            totalAmount: s.totalAmount,
            activity: s.activity,
            activityOther: s.activityOther,
            subBudgetHead: s.subBudgetHead,
          })),
        })),
      })
      onPlanChange(updated)
      setDrafts([])
      setApplied(true)
      setTimeout(() => setApplied(false), 3000)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <CCard className="mb-3">
      <CCardHeader className="fw-semibold d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          Recurring Tasks
          <div className="small text-body-secondary fw-normal">
            Enter tasks to divide equally across {monthCount} month{monthCount !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          {totalBudget > 0 && (
            <span className="small text-body-secondary">
              Total <strong>{fmt(totalBudget)}</strong> · Per month <strong>{fmt(perMonth)}</strong>
            </span>
          )}
          <CButton size="sm" color="secondary" variant="outline" onClick={addDraftTask}>
            <CIcon icon={cilPlus} className="me-1" /> Add Task
          </CButton>
        </div>
      </CCardHeader>
      <CCardBody>
        {drafts.length === 0 ? (
          <div className="text-center text-body-tertiary small py-3 border rounded">
            No recurring tasks yet. Click &quot;Add Task&quot; to get started.
          </div>
        ) : (
          <div className="d-flex flex-column gap-2">
            {drafts.map((task) => (
              <div key={task.id} className="border rounded p-2">
                <div className="d-flex gap-2 align-items-center flex-wrap">
                  <CFormSelect
                    size="sm"
                    style={{ width: 150 }}
                    value={task.phase}
                    onChange={(e) => updateDraftTask(task.id, { phase: e.target.value })}
                  >
                    {PHASE_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </CFormSelect>
                  <CFormInput
                    size="sm"
                    style={{ minWidth: 160, flex: 1 }}
                    placeholder="Task / activity name"
                    value={task.name}
                    onChange={(e) => updateDraftTask(task.id, { name: e.target.value })}
                  />
                  {task.subtasks.length === 0 && (
                    <>
                      <CFormSelect
                        size="sm"
                        style={{ width: 170 }}
                        value={task.activity}
                        onChange={(e) => updateDraftTask(task.id, { activity: e.target.value })}
                      >
                        <option value="">Activity...</option>
                        {ACTIVITY_OPTIONS.map((a) => (
                          <option key={a.value} value={a.value}>
                            {a.label}
                          </option>
                        ))}
                      </CFormSelect>
                      {task.activity === 'other' && (
                        <CFormInput
                          size="sm"
                          style={{ width: 150 }}
                          placeholder="Activity name"
                          value={task.activityOther}
                          onChange={(e) =>
                            updateDraftTask(task.id, { activityOther: e.target.value })
                          }
                        />
                      )}
                      <CFormInput
                        size="sm"
                        style={{ width: 150 }}
                        placeholder="Sub-budget head"
                        value={task.subBudgetHead}
                        onChange={(e) =>
                          updateDraftTask(task.id, { subBudgetHead: e.target.value })
                        }
                      />
                      <CFormInput
                        size="sm"
                        type="number"
                        min="0"
                        style={{ width: 130 }}
                        placeholder="Total amount"
                        value={task.totalAmount}
                        onChange={(e) => updateDraftTask(task.id, { totalAmount: e.target.value })}
                      />
                    </>
                  )}
                  {draftTaskTotal(task) > 0 && monthCount > 0 && (
                    <span className="small text-body-secondary text-nowrap">
                      {fmt(draftTaskTotal(task) / monthCount)}/mo
                    </span>
                  )}
                  <CButton
                    size="sm"
                    color="danger"
                    variant="ghost"
                    onClick={() => removeDraftTask(task.id)}
                    title="Remove task"
                  >
                    <CIcon icon={cilTrash} size="sm" />
                  </CButton>
                </div>

                {task.subtasks.length > 0 && (
                  <div className="mt-2 ms-3 d-flex flex-column gap-1">
                    {task.subtasks.map((sub) => (
                      <div key={sub.id} className="d-flex gap-2 align-items-center">
                        <span className="small" style={{ width: 160 }}>
                          {sub.name}
                        </span>
                        <span className="small text-body-secondary" style={{ width: 150 }}>
                          {activityLabelOf(sub.activity, sub.activityOther)}
                        </span>
                        {sub.subBudgetHead && (
                          <span className="small text-body-tertiary" style={{ width: 140 }}>
                            {sub.subBudgetHead}
                          </span>
                        )}
                        <span className="small text-body-secondary">
                          {fmt(parseFloat(sub.totalAmount) || 0)} total
                        </span>
                        <CButton
                          size="sm"
                          color="danger"
                          variant="ghost"
                          onClick={() => removeSubtaskFromDraft(task.id, sub.id)}
                        >
                          <CIcon icon={cilTrash} size="sm" />
                        </CButton>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-2 ms-3 d-flex gap-2 align-items-center flex-wrap">
                  <CFormInput
                    size="sm"
                    style={{ width: 160 }}
                    placeholder="Subtask name"
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
                    min="0"
                    style={{ width: 130 }}
                    placeholder="Subtask total"
                    value={subtaskDraft(task.id).totalAmount}
                    onChange={(e) => setSubtaskDraft(task.id, { totalAmount: e.target.value })}
                  />
                  <CButton
                    size="sm"
                    color="secondary"
                    variant="outline"
                    onClick={() => addSubtaskToDraft(task.id)}
                    disabled={
                      !subtaskDraft(task.id).activity ||
                      (subtaskDraft(task.id).activity === 'other' &&
                        !subtaskDraft(task.id).activityOther.trim())
                    }
                  >
                    <CIcon icon={cilPlus} className="me-1" /> Subtask
                  </CButton>
                  {task.subtasks.length === 0 && (
                    <span className="small text-body-tertiary">
                      Optional — leave blank to use the single Total amount above.
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <CAlert color="danger" className="py-2 small mt-2 mb-0">
            {error}
          </CAlert>
        )}
        {applied && (
          <CAlert color="success" className="py-2 small mt-2 mb-0">
            Tasks distributed across all {monthCount} months.
          </CAlert>
        )}
        {validDrafts.length > 0 && (
          <CButton color="primary" className="mt-2" onClick={handleApply}>
            Apply — divide equally across {monthCount} month{monthCount !== 1 ? 's' : ''}
          </CButton>
        )}
      </CCardBody>
    </CCard>
  )
}

RecurringTasksEntry.propTypes = {
  project: PropTypes.object.isRequired,
  plan: PropTypes.object.isRequired,
  canEdit: PropTypes.bool,
  onPlanChange: PropTypes.func.isRequired,
}

export default RecurringTasksEntry
