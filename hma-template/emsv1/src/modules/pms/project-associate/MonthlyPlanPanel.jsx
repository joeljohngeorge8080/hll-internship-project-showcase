import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CFormSelect,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CButton,
  CAlert,
  CBadge,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilTrash, cilReload } from '@coreui/icons'
import * as XLSX from 'xlsx-js-style'
import { localProjects } from '../../../services/localProjects'
import { localProjectExpenses } from '../../../services/localProjectExpenses'
import { localBudgetPlan } from '../../../services/localBudgetPlan'
import {
  computeWorkingPool,
  monthsInRange,
  computeEffectivePoolMonthly,
  computeEffectivePoolPct,
  computeEffectiveProjectMonthly,
  computeMonthActualTotal,
  sumManualPoolAdjustments,
  validatePlanTotalWithCascade,
} from '../../../services/monthlyApportionment'

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

const monthLabelShort = (ym) => {
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

const BaselineTable = ({ months, baselinePerMonth }) => (
  <div className="mb-3">
    <div style={{ overflowX: 'auto' }}>
      <CTable bordered small align="middle" className="mb-0" style={{ fontSize: '0.8rem' }}>
        <CTableHead color="light">
          <CTableRow>
            {months.map((m) => (
              <CTableHeaderCell key={m} className="text-center text-nowrap">
                {monthLabelShort(m)}
              </CTableHeaderCell>
            ))}
          </CTableRow>
        </CTableHead>
        <CTableBody>
          <CTableRow>
            {months.map((m) => (
              <CTableDataCell key={m} className="text-center text-nowrap">
                {fmt(baselinePerMonth)}
              </CTableDataCell>
            ))}
          </CTableRow>
        </CTableBody>
      </CTable>
    </div>
  </div>
)

BaselineTable.propTypes = {
  months: PropTypes.arrayOf(PropTypes.string).isRequired,
  baselinePerMonth: PropTypes.number.isRequired,
}

const monthLabel = (ym) => {
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

const emptyRecurringTask = () => ({
  id: Date.now() + Math.random(),
  phase: 'design',
  label: '',
  totalAmount: '',
})

const RecurringTasksSection = ({ project, onProjectChange, canEdit, monthCount, months }) => {
  const [tasks, setTasks] = useState([])
  const [applied, setApplied] = useState(false)
  const [taskError, setTaskError] = useState('')

  const addTask = () => setTasks((prev) => [...prev, emptyRecurringTask()])
  const removeTask = (id) => setTasks((prev) => prev.filter((t) => t.id !== id))
  const updateTask = (id, patch) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))

  const validTasks = tasks.filter((t) => t.label.trim() && parseFloat(t.totalAmount) > 0)
  const totalBudget = validTasks.reduce((s, t) => s + (parseFloat(t.totalAmount) || 0), 0)
  const perMonth = monthCount > 0 ? totalBudget / monthCount : 0

  const handleApply = async () => {
    setTaskError('')
    if (!validTasks.length) {
      setTaskError('Add at least one task with a label and amount before applying.')
      return
    }
    let updated = project
    // Sequential — each month's updateMonthPlan depends on the project state
    // mutated by the previous month's call, so this can't be Promise.all'd.
    for (const month of months) {
      const existing = updated.monthly_plan.find((m) => m.month === month)
      const existingPhases = existing
        ? existing.phases.filter(
            (ph) => !validTasks.some((t) => t.label.trim() === ph.label && t.phase === ph.phase),
          )
        : []
      const newPhases = [
        ...existingPhases,
        ...validTasks.map((t) => ({
          phase: t.phase,
          label: t.label.trim(),
          amount: Math.round((parseFloat(t.totalAmount) / monthCount) * 100) / 100,
        })),
      ]
      const result = await localProjects.updateMonthPlan(updated.id, month, newPhases)
      updated = result.project
    }
    onProjectChange(updated)
    setApplied(true)
    setTimeout(() => setApplied(false), 3000)
  }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0c1a2e 100%)',
        borderRadius: 14,
        padding: '20px 24px 16px',
        marginBottom: 20,
        border: '1px solid rgba(99,179,237,0.18)',
        boxShadow: '0 4px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow accent */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)',
          borderRadius: '14px 14px 0 0',
        }}
      />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              boxShadow: '0 2px 12px rgba(59,130,246,0.4)',
            }}
          >
            🔁
          </div>
          <div>
            <div
              style={{
                color: '#e2e8f0',
                fontWeight: 700,
                fontSize: '0.95rem',
                letterSpacing: '0.01em',
              }}
            >
              Recurring Tasks
            </div>
            <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: 1 }}>
              Enter tasks to divide equally across {monthCount} month{monthCount !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {totalBudget > 0 && (
            <div
              style={{
                background: 'rgba(59,130,246,0.15)',
                border: '1px solid rgba(59,130,246,0.3)',
                borderRadius: 20,
                padding: '3px 12px',
                fontSize: '0.75rem',
                color: '#93c5fd',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ color: '#64748b' }}>Total</span>
              <span style={{ fontWeight: 700 }}>{fmt(totalBudget)}</span>
              <span style={{ color: '#475569' }}>·</span>
              <span style={{ color: '#64748b' }}>Per month</span>
              <span style={{ fontWeight: 700, color: '#60a5fa' }}>{fmt(perMonth)}</span>
            </div>
          )}
          {canEdit && (
            <button
              onClick={addTask}
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                border: 'none',
                borderRadius: 8,
                padding: '6px 14px',
                color: '#fff',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: '0 2px 8px rgba(59,130,246,0.35)',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Add Task
            </button>
          )}
        </div>
      </div>

      {/* Tasks List */}
      {tasks.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '18px 0 10px',
            color: '#334155',
            fontSize: '0.8rem',
            border: '1.5px dashed rgba(71,85,105,0.4)',
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 6, opacity: 0.5 }}>📋</div>
          No recurring tasks yet.{canEdit ? " Click 'Add Task' to get started." : ''}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tasks.map((task, idx) => (
            <div
              key={task.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: '9px 12px',
                animation: 'fadeSlideIn 0.2s ease',
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  background: 'rgba(99,102,241,0.25)',
                  border: '1px solid rgba(99,102,241,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.65rem',
                  color: '#a5b4fc',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {idx + 1}
              </div>
              <select
                value={task.phase}
                disabled={!canEdit}
                onChange={(e) => updateTask(task.id, { phase: e.target.value })}
                style={{
                  background: 'rgba(15,23,42,0.8)',
                  border: '1px solid rgba(71,85,105,0.5)',
                  borderRadius: 7,
                  padding: '4px 8px',
                  color: '#cbd5e1',
                  fontSize: '0.78rem',
                  cursor: canEdit ? 'pointer' : 'default',
                  flexShrink: 0,
                  outline: 'none',
                }}
              >
                {PHASE_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Task / activity name"
                value={task.label}
                disabled={!canEdit}
                onChange={(e) => updateTask(task.id, { label: e.target.value })}
                style={{
                  flex: 1,
                  background: 'rgba(15,23,42,0.8)',
                  border: '1px solid rgba(71,85,105,0.5)',
                  borderRadius: 7,
                  padding: '4px 10px',
                  color: '#e2e8f0',
                  fontSize: '0.82rem',
                  outline: 'none',
                  minWidth: 0,
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
                <div
                  style={{
                    background: 'rgba(15,23,42,0.8)',
                    border: '1px solid rgba(71,85,105,0.5)',
                    borderLeft: 'none',
                    borderRadius: '7px 0 0 7px',
                    padding: '4px 8px',
                    color: '#64748b',
                    fontSize: '0.82rem',
                    borderRight: 'none',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  ₹
                </div>
                <input
                  type="number"
                  min="0"
                  placeholder="Total budget"
                  value={task.totalAmount}
                  disabled={!canEdit}
                  onChange={(e) => updateTask(task.id, { totalAmount: e.target.value })}
                  style={{
                    width: 110,
                    background: 'rgba(15,23,42,0.8)',
                    border: '1px solid rgba(71,85,105,0.5)',
                    borderLeft: '1px solid rgba(71,85,105,0.5)',
                    borderRadius: '0 7px 7px 0',
                    padding: '4px 10px',
                    color: '#e2e8f0',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                />
              </div>
              {parseFloat(task.totalAmount) > 0 && monthCount > 0 && (
                <div
                  style={{
                    flexShrink: 0,
                    fontSize: '0.72rem',
                    color: '#60a5fa',
                    background: 'rgba(59,130,246,0.12)',
                    borderRadius: 6,
                    padding: '3px 8px',
                    whiteSpace: 'nowrap',
                    border: '1px solid rgba(59,130,246,0.2)',
                  }}
                >
                  {fmt(parseFloat(task.totalAmount) / monthCount)}/mo
                </div>
              )}
              {canEdit && (
                <button
                  onClick={() => removeTask(task.id)}
                  style={{
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 7,
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f87171',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.15s',
                    fontSize: 14,
                  }}
                  title="Remove task"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer: error + apply button */}
      {(taskError || (canEdit && tasks.length > 0)) && (
        <div
          style={{
            marginTop: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          {taskError && (
            <div
              style={{
                flex: 1,
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 8,
                padding: '6px 12px',
                color: '#fca5a5',
                fontSize: '0.78rem',
              }}
            >
              ⚠️ {taskError}
            </div>
          )}
          {applied && (
            <div
              style={{
                flex: 1,
                background: 'rgba(34,197,94,0.12)',
                border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: 8,
                padding: '6px 12px',
                color: '#86efac',
                fontSize: '0.78rem',
              }}
            >
              ✓ Tasks distributed across all {monthCount} months
            </div>
          )}
          {canEdit && validTasks.length > 0 && (
            <button
              onClick={handleApply}
              style={{
                background: 'linear-gradient(135deg, #059669, #047857)',
                border: 'none',
                borderRadius: 9,
                padding: '8px 18px',
                color: '#fff',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                boxShadow: '0 2px 12px rgba(5,150,105,0.35)',
                marginLeft: 'auto',
                transition: 'all 0.2s',
              }}
            >
              <span>⚡</span>
              Apply — divide equally across {monthCount} month{monthCount !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

RecurringTasksSection.propTypes = {
  project: PropTypes.object.isRequired,
  onProjectChange: PropTypes.func.isRequired,
  canEdit: PropTypes.bool,
  monthCount: PropTypes.number.isRequired,
  months: PropTypes.arrayOf(PropTypes.string).isRequired,
}

// ─── Unified Monthly Plan card ────────────────────────────────────────────────
// Combines the old "Plan the Budget by Month" drafting accordion and the
// "Monthly Plan" table into a single card. Shows:
//   1. Month-wise baseline split strip (even split reference)
//   2. Recurring Tasks section
//   3. Editable per-month table with phase breakdown + Admin/HR/Core pool inputs
const PlanTable = ({ project, onProjectChange, canEdit = false, currentUser = 'Unknown' }) => {
  const workingPool = computeWorkingPool(project)
  const validation = validatePlanTotalWithCascade(
    project.monthly_plan,
    workingPool,
    project.pool_adjustments,
  )
  const [saved, setSaved] = useState(false)
  const [reallocError, setReallocError] = useState('')
  const [revokeConfirm, setRevokeConfirm] = useState(null) // { action: fn, label: string }
  const months = monthsInRange(project.start_date, project.end_date)
  const monthCount = months.length
  const baselinePerMonth = monthCount > 0 ? Math.round((workingPool / monthCount) * 100) / 100 : 0

  // Initialize empty month stubs for every month in the project date range
  const handleInitialize = async () => {
    const updated = await localProjects.generateMonthlyPlan(project.id, [])
    onProjectChange(updated)
  }

  const handleAmountChange = async (month, phaseIdx, amount) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    const phases = monthEntry.phases.map((ph, i) =>
      i === phaseIdx ? { ...ph, amount: parseFloat(amount) || 0 } : ph,
    )
    const { project: updated } = await localProjects.updateMonthPlan(project.id, month, phases)
    onProjectChange(updated)
  }

  const handleActualChange = async (month, phaseIdx, actual) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    const phases = monthEntry.phases.map((ph, i) =>
      i === phaseIdx ? { ...ph, actual: parseFloat(actual) || 0 } : ph,
    )
    const { project: updated } = await localProjects.updateMonthPlan(project.id, month, phases)
    onProjectChange(updated)
  }

  const handleLabelChange = async (month, phaseIdx, label) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    const phases = monthEntry.phases.map((ph, i) => (i === phaseIdx ? { ...ph, label } : ph))
    const { project: updated } = await localProjects.updateMonthPlan(project.id, month, phases)
    onProjectChange(updated)
  }

  const handlePhaseChange = async (month, phaseIdx, phase) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    const phases = monthEntry.phases.map((ph, i) => (i === phaseIdx ? { ...ph, phase } : ph))
    const { project: updated } = await localProjects.updateMonthPlan(project.id, month, phases)
    onProjectChange(updated)
  }

  const handleAddPhase = async (month) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    const phases = [...monthEntry.phases, { phase: 'design', label: '', amount: 0, actual: 0 }]
    const { project: updated } = await localProjects.updateMonthPlan(project.id, month, phases)
    onProjectChange(updated)
  }

  const handleRemovePhase = async (month, phaseIdx) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    const phases = monthEntry.phases.filter((_, i) => i !== phaseIdx)
    const { project: updated } = await localProjects.updateMonthPlan(project.id, month, phases)
    onProjectChange(updated)
  }

  const handlePoolAmountChange = async (pool, month, newAmount) => {
    const updated = await localProjects.setManualPoolAdjustment(project.id, {
      pool,
      month,
      newAmount,
      createdBy: currentUser,
    })
    onProjectChange(updated)
  }

  const handlePoolPctChange = async (pool, month, newPct) => {
    const pv = project.project_value || project.project_valuation || 0
    const allMonths = monthsInRange(project.start_date, project.end_date)
    const monthlyValue = allMonths.length > 0 ? pv / allMonths.length : 0
    const newAmount = ((parseFloat(newPct) || 0) / 100) * monthlyValue
    const updated = await localProjects.setManualPoolAdjustment(project.id, {
      pool,
      month,
      newAmount,
      createdBy: currentUser,
    })
    onProjectChange(updated)
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleSendSurplusToPools = async (monthValue, surplus) => {
    setReallocError('')
    try {
      const updated = await localProjects.sendSurplusToPools(project.id, {
        month: monthValue,
        surplus,
        createdBy: currentUser,
      })
      onProjectChange(updated)
    } catch (e) {
      setReallocError(e.message)
    }
  }

  const handleSendSurplusToNextMonth = async (monthValue, surplus) => {
    setReallocError('')
    try {
      const updated = await localProjects.sendSurplusToNextMonth(project.id, {
        month: monthValue,
        surplus,
        createdBy: currentUser,
      })
      onProjectChange(updated)
    } catch (e) {
      setReallocError(e.message)
    }
  }

  const handleRefresh = async () => {
    // recomputePlan re-derives all auto_cascade and actual_pull adjustments
    // from the current stored plan (preserving manual ones), writes back to
    // Supabase, and returns the updated project — so Admin/HR/Core figures
    // and the validation badge reflect any external changes or desync.
    const fresh = await localProjects.recomputePlan(project.id)
    if (fresh) onProjectChange(fresh)
  }

  const handleExportExcel = () => {
    const round2 = (n) => Math.round(n * 100) / 100
    const phaseLabelOf = (value) => PHASE_OPTIONS.find((p) => p.value === value)?.label || value

    // ── Styles (xlsx-js-style cell `s` objects) ─────────────────────────
    const edge = { style: 'thin', color: { rgb: 'B0B7C3' } }
    const border = { top: edge, bottom: edge, left: edge, right: edge }
    const NAVY = '1F4E79'
    const BLUE = '2E75B6'
    const styles = {
      title: {
        font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: NAVY } },
        alignment: { horizontal: 'center', vertical: 'center' },
      },
      sectionHead: {
        font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: BLUE } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border,
      },
      detailLabel: {
        font: { bold: true, sz: 10 },
        fill: { fgColor: { rgb: 'F2F2F2' } },
        border,
      },
      detailValue: { font: { sz: 10 }, border, alignment: { horizontal: 'left' } },
      tableHead: {
        font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: BLUE } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border,
      },
      total: {
        font: { bold: true, sz: 11 },
        fill: { fgColor: { rgb: 'D9E2F3' } },
        border,
      },
    }
    const rowFill = (isAlt) => (isAlt ? { fill: { fgColor: { rgb: 'EEF4FB' } } } : {})
    const dataCell = (isAlt) => ({ font: { sz: 10 }, border, ...rowFill(isAlt) })
    const varianceCell = (v, isAlt) => ({
      font: { sz: 10, bold: v < 0, color: { rgb: v < 0 ? 'C00000' : '1E7E34' } },
      border,
      ...rowFill(isAlt),
    })
    const MONEY = '#,##0.00'
    const txt = (v, s) => ({ v: v === null || v === undefined || v === '' ? '—' : v, t: 's', s })
    const num = (v, s) => ({ v: round2(v || 0), t: 'n', z: MONEY, s })
    const pad = (s) => ({ v: '', t: 's', s })
    const fullWidthRow = (label, s) => [txt(label, s), ...Array(6).fill(pad(s))]

    // ── Sheet content ───────────────────────────────────────────────────
    const aoa = []
    const merges = []
    const mergeFullRow = () =>
      merges.push({ s: { r: aoa.length, c: 0 }, e: { r: aoa.length, c: 6 } })

    mergeFullRow()
    aoa.push(fullWidthRow(project.name || project.title || 'Project', styles.title))
    aoa.push([])

    mergeFullRow()
    aoa.push(fullWidthRow('PROJECT DETAILS', styles.sectionHead))
    const details = [
      ['Project Code', txt(project.project_code, styles.detailValue)],
      ['Funding Agency', txt(project.funding_agency, styles.detailValue)],
      ['Implementing Partner', txt(project.implementing_partner, styles.detailValue)],
      ['Location', txt(project.location, styles.detailValue)],
      ['Project Officer', txt(project.officer_name, styles.detailValue)],
      ['Project Associate', txt(project.project_associate_name, styles.detailValue)],
      ['Status', txt(project.status, styles.detailValue)],
      ['Start Date', txt(project.start_date, styles.detailValue)],
      ['End Date', txt(project.end_date, styles.detailValue)],
      ['Project Value (₹)', num(project.project_value, styles.detailValue)],
      ['Amount Received (₹)', num(project.amount_received, styles.detailValue)],
      ['Project Baseline (₹)', num(workingPool, styles.detailValue)],
    ]
    details.forEach(([label, valueCell]) => {
      const r = aoa.length
      merges.push({ s: { r, c: 0 }, e: { r, c: 1 } }) // label spans A:B
      merges.push({ s: { r, c: 2 }, e: { r, c: 6 } }) // value spans C:G
      aoa.push([
        txt(label, styles.detailLabel),
        pad(styles.detailLabel),
        valueCell,
        ...Array(4).fill(pad(styles.detailValue)),
      ])
    })
    aoa.push([])

    mergeFullRow()
    aoa.push(fullWidthRow('PHASE BREAKDOWN — PLANNED vs ACTUAL', styles.sectionHead))
    aoa.push(
      [
        'Sl No',
        'Month',
        'Phase',
        'Task / Activity',
        'Planned (₹)',
        'Actual (₹)',
        'Variance (₹)',
      ].map((h) => txt(h, styles.tableHead)),
    )

    let slNo = 0
    let plannedTotal = 0
    let actualTotal = 0
    ;(project.monthly_plan || []).forEach((m) => {
      m.phases.forEach((ph) => {
        slNo += 1
        const planned = parseFloat(ph.amount) || 0
        const actual = parseFloat(ph.actual) || 0
        plannedTotal += planned
        actualTotal += actual
        const isAlt = slNo % 2 === 0
        const s = dataCell(isAlt)
        aoa.push([
          { v: slNo, t: 'n', s },
          txt(monthLabel(m.month), s),
          txt(phaseLabelOf(ph.phase), s),
          txt(ph.label, s),
          num(planned, s),
          num(actual, s),
          num(planned - actual, varianceCell(planned - actual, isAlt)),
        ])
      })
    })
    aoa.push([
      pad(styles.total),
      pad(styles.total),
      pad(styles.total),
      txt('TOTAL', styles.total),
      num(plannedTotal, styles.total),
      num(actualTotal, styles.total),
      num(plannedTotal - actualTotal, styles.total),
    ])

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!merges'] = merges
    ws['!cols'] = [
      { wch: 8 },
      { wch: 12 },
      { wch: 16 },
      { wch: 34 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
    ]
    ws['!rows'] = aoa.map((_, i) => (i === 0 ? { hpt: 30 } : { hpt: 18 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Monthly Plan')
    const safeName = (project.name || 'project').replace(/[^\w\d-]+/g, '_').slice(0, 60)
    XLSX.writeFile(wb, `${safeName}_monthly_plan.xlsx`)
  }

  return (
    <>
      <CCard className="shadow-sm mb-4">
        <CCardHeader className="bg-transparent fw-semibold pt-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span>📊 Monthly Plan</span>
          <div className="d-flex align-items-center gap-2">
            <CButton
              size="sm"
              color="secondary"
              variant="ghost"
              title="Refresh figures"
              onClick={handleRefresh}
            >
              <CIcon icon={cilReload} size="sm" />
            </CButton>
            {project.monthly_plan?.length > 0 && (
              <CBadge color={validation.valid ? 'success' : 'danger'}>
                {validation.valid
                  ? `Balanced — ${fmt(validation.planTotal)}`
                  : `Off by ${fmt(Math.abs(validation.diff))} (plan ${fmt(validation.planTotal)} vs baseline ${fmt(validation.workingPool)})`}
              </CBadge>
            )}
            {project.monthly_plan?.length > 0 && (
              <CButton size="sm" color="success" className="text-white" onClick={handleExportExcel}>
                📥 Export Excel
              </CButton>
            )}
            {project.monthly_plan?.length > 0 && (
              <CButton size="sm" color="primary" onClick={handleSave}>
                💾 Save Monthly Plan
              </CButton>
            )}
          </div>
        </CCardHeader>
        {saved && (
          <CAlert color="success" className="mb-0 py-2 small rounded-0 text-center">
            ✓ Monthly plan saved
          </CAlert>
        )}
        {reallocError && (
          <CAlert color="danger" className="mb-0 py-2 small rounded-0 text-center">
            {reallocError}
          </CAlert>
        )}
        <CCardBody className="p-0">
          {/* ── Baseline split strip ────────────────────────────────────────── */}
          {monthCount > 0 && (
            <div style={{ padding: '12px 16px 4px' }}>
              <div className="small text-body-secondary mb-2">
                Project baseline: <strong>{fmt(workingPool)}</strong> across{' '}
                <strong>{monthCount}</strong> month{monthCount !== 1 ? 's' : ''} —{' '}
                <strong>{fmt(baselinePerMonth)}</strong>/month if split evenly
              </div>
              <BaselineTable months={months} baselinePerMonth={baselinePerMonth} />
            </div>
          )}

          {/* ── Empty state ─────────────────────────────────────────────────── */}
          {!project.monthly_plan?.length && (
            <div style={{ padding: '0 16px 16px' }}>
              {canEdit ? (
                <>
                  <CAlert color="info" className="small mb-3">
                    No monthly plan yet. Click below to create empty entries for all {monthCount}{' '}
                    month{monthCount !== 1 ? 's' : ''}.
                  </CAlert>
                  <CButton color="primary" onClick={handleInitialize}>
                    ⚡ Initialize Monthly Plan
                  </CButton>
                </>
              ) : (
                <CAlert color="info" className="small mb-0">
                  No monthly plan has been created yet.
                </CAlert>
              )}
            </div>
          )}

          {/* ── Recurring Tasks ─────────────────────────────────────────────── */}
          {project.monthly_plan?.length > 0 && (
            <div style={{ padding: '16px 16px 0' }}>
              <RecurringTasksSection
                project={project}
                onProjectChange={onProjectChange}
                canEdit={canEdit}
                monthCount={monthCount}
                months={months}
              />
            </div>
          )}

          {/* ── Per-month editable table ─────────────────────────────────────── */}
          {project.monthly_plan?.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <CTable hover align="middle" className="mb-0" style={{ fontSize: '0.82rem' }}>
                <CTableHead color="light">
                  <CTableRow>
                    <CTableHeaderCell>Month</CTableHeaderCell>
                    <CTableHeaderCell>Phase Breakdown (Project)</CTableHeaderCell>
                    <CTableHeaderCell className="text-end" style={{ minWidth: 220 }}>
                      Project Total
                    </CTableHeaderCell>
                    <CTableHeaderCell className="text-end" style={{ minWidth: 140 }}>
                      Admin
                    </CTableHeaderCell>
                    <CTableHeaderCell className="text-end" style={{ minWidth: 140 }}>
                      HR
                    </CTableHeaderCell>
                    <CTableHeaderCell className="text-end" style={{ minWidth: 140 }}>
                      Core
                    </CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {project.monthly_plan.map((m, idx) => {
                    const adjustedFor = (pool) =>
                      (project.pool_adjustments || []).some(
                        (a) => a.pool === pool && a.month === m.month,
                      )
                    const projectReallocation = sumManualPoolAdjustments(
                      project.pool_adjustments,
                      m.month,
                    )
                    const projectTransfers = (project.pool_adjustments || []).filter(
                      (a) => a.pool === 'project' && a.month === m.month,
                    )
                    const netProjectTransfer = projectTransfers.reduce(
                      (s, a) => s + (a.amount || 0),
                      0,
                    )
                    const monthActual = computeMonthActualTotal(m)
                    const monthPlanned = computeEffectiveProjectMonthly(project, m.month)
                    const surplus = Math.round((monthPlanned - monthActual) * 100) / 100
                    const hasNextMonth = idx < project.monthly_plan.length - 1

                    // Only allow revoking the LAST "Send → Next Month" in a chain.
                    // Both sender (negative) and receiver (positive) months get entries with
                    // source='actual_surplus_next_month'. Only negative amounts are outgoing
                    // (i.e. this month sent surplus away). Filter to those only.
                    const myNextMonthTransfers = projectTransfers.filter(
                      (a) => a.source === 'actual_surplus_next_month' && (a.amount || 0) < 0,
                    )
                    const isChainContinued =
                      myNextMonthTransfers.length > 0 &&
                      (() => {
                        const counterMonth =
                          myNextMonthTransfers[myNextMonthTransfers.length - 1]?.counterMonth
                        if (!counterMonth) return false
                        // Check if the receiver month also sent surplus onward (amount < 0 = outgoing)
                        return (project.pool_adjustments || []).some(
                          (a) =>
                            a.pool === 'project' &&
                            a.month === counterMonth &&
                            a.source === 'actual_surplus_next_month' &&
                            (a.amount || 0) < 0,
                        )
                      })()
                    const canRevokeNextMonthTransfer =
                      myNextMonthTransfers.length > 0 && !isChainContinued
                    return (
                      <CTableRow key={m.month}>
                        <CTableDataCell className="fw-semibold">
                          {monthLabel(m.month)}
                        </CTableDataCell>
                        <CTableDataCell>
                          {m.phases.map((ph, i) => (
                            <div
                              key={i}
                              className="d-flex align-items-center gap-1 mb-1 flex-nowrap"
                            >
                              <div className="d-flex flex-nowrap align-items-center gap-1">
                                <CFormSelect
                                  size="sm"
                                  style={{ width: 110 }}
                                  value={ph.phase}
                                  disabled={!canEdit}
                                  onChange={(e) => handlePhaseChange(m.month, i, e.target.value)}
                                >
                                  {PHASE_OPTIONS.map((p) => (
                                    <option key={p.value} value={p.value}>
                                      {p.label}
                                    </option>
                                  ))}
                                </CFormSelect>
                                <CFormInput
                                  size="sm"
                                  style={{ width: 130 }}
                                  placeholder="Task / activity"
                                  value={ph.label}
                                  disabled={!canEdit}
                                  onChange={(e) => handleLabelChange(m.month, i, e.target.value)}
                                />
                              </div>
                              <div className="d-flex flex-nowrap align-items-center gap-1">
                                <CInputGroup style={{ width: 190 }}>
                                  <CInputGroupText
                                    style={{
                                      background: '#cfe2ff',
                                      color: '#084298',
                                      fontWeight: 700,
                                      fontSize: '0.78rem',
                                    }}
                                  >
                                    Planned ₹
                                  </CInputGroupText>
                                  <CFormInput
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    style={{ minWidth: 90 }}
                                    value={ph.amount || ''}
                                    disabled={!canEdit}
                                    onChange={(e) => handleAmountChange(m.month, i, e.target.value)}
                                  />
                                </CInputGroup>
                                <CInputGroup style={{ width: 190 }}>
                                  <CInputGroupText
                                    style={{
                                      background: '#d1e7dd',
                                      color: '#0a3622',
                                      fontWeight: 700,
                                      fontSize: '0.78rem',
                                    }}
                                  >
                                    Actual ₹
                                  </CInputGroupText>
                                  <CFormInput
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    style={{ minWidth: 90 }}
                                    value={ph.actual || ''}
                                    disabled={!canEdit}
                                    onChange={(e) => handleActualChange(m.month, i, e.target.value)}
                                  />
                                </CInputGroup>
                              </div>
                              {canEdit && (
                                <CButton
                                  size="sm"
                                  color="danger"
                                  variant="ghost"
                                  disabled={m.phases.length === 1}
                                  onClick={() => handleRemovePhase(m.month, i)}
                                >
                                  <CIcon icon={cilTrash} size="sm" />
                                </CButton>
                              )}
                            </div>
                          ))}
                          {canEdit && (
                            <CButton
                              size="sm"
                              color="secondary"
                              variant="outline"
                              onClick={() => handleAddPhase(m.month)}
                            >
                              <CIcon icon={cilPlus} className="me-1" />
                              Add Line
                            </CButton>
                          )}
                        </CTableDataCell>
                        <CTableDataCell className="text-end fw-bold">
                          {fmt(monthPlanned)}
                          {projectReallocation !== 0 && (
                            <CBadge
                              color="warning"
                              shape="rounded-pill"
                              className="ms-1"
                              style={{ fontSize: '0.6rem' }}
                            >
                              adjusted
                            </CBadge>
                          )}
                          {netProjectTransfer !== 0 && (
                            <div className="mt-1">
                              <CBadge
                                color={netProjectTransfer > 0 ? 'warning' : 'info'}
                                shape="rounded-pill"
                                style={{ fontSize: '0.6rem' }}
                              >
                                {netProjectTransfer > 0 ? '−' : '+'}
                                {fmt(Math.abs(netProjectTransfer))}{' '}
                                {netProjectTransfer > 0 ? '→ given to' : '← from'}{' '}
                                {projectTransfers
                                  .map((a) => monthLabelShort(a.counterMonth))
                                  .join(', ')}
                              </CBadge>
                              {canRevokeNextMonthTransfer && canEdit && (
                                <CButton
                                  size="sm"
                                  color="secondary"
                                  variant="ghost"
                                  style={{ fontSize: '0.62rem', padding: '0 4px' }}
                                  onClick={() =>
                                    setRevokeConfirm({
                                      label: `surplus transfer from ${monthLabelShort(m.month)}`,
                                      action: async () => {
                                        const updated =
                                          await localProjects.revokeActualSurplusTransfer(
                                            project.id,
                                            { month: m.month },
                                          )
                                        onProjectChange(updated)
                                      },
                                    })
                                  }
                                >
                                  Revoke
                                </CButton>
                              )}
                            </div>
                          )}
                          {surplus > 0 && canEdit && (
                            <div className="d-flex flex-column gap-2 mt-2 align-items-stretch">
                              <CButton
                                color="success"
                                className="fw-bold text-white"
                                style={{ fontSize: '0.85rem', padding: '8px 14px' }}
                                onClick={() => handleSendSurplusToPools(m.month, surplus)}
                              >
                                Send {fmt(surplus)} → HR/Core
                              </CButton>
                              {hasNextMonth && (
                                <CButton
                                  color="primary"
                                  className="fw-bold text-white"
                                  style={{ fontSize: '0.85rem', padding: '8px 14px' }}
                                  onClick={() => handleSendSurplusToNextMonth(m.month, surplus)}
                                >
                                  Send {fmt(surplus)} → Next Month
                                </CButton>
                              )}
                            </div>
                          )}
                        </CTableDataCell>
                        {['admin', 'hr', 'core'].map((pool) => (
                          <CTableDataCell key={pool} className="text-end">
                            <CInputGroup size="sm" style={{ width: 145, marginLeft: 'auto' }}>
                              <CInputGroupText>₹</CInputGroupText>
                              <CFormInput
                                type="number"
                                placeholder="0"
                                value={computeEffectivePoolMonthly(project, pool, m.month) || ''}
                                disabled={!canEdit}
                                onChange={(e) =>
                                  handlePoolAmountChange(pool, m.month, e.target.value)
                                }
                              />
                            </CInputGroup>
                            <CInputGroup
                              size="sm"
                              style={{ minWidth: 80, marginLeft: 'auto', marginTop: 4 }}
                            >
                              <CFormInput
                                type="number"
                                step="0.1"
                                placeholder="0"
                                value={computeEffectivePoolPct(project, pool, m.month) || ''}
                                disabled={!canEdit}
                                onChange={(e) => handlePoolPctChange(pool, m.month, e.target.value)}
                              />
                              <CInputGroupText>%</CInputGroupText>
                            </CInputGroup>
                            {adjustedFor(pool) && (
                              <CBadge
                                color="warning"
                                shape="rounded-pill"
                                className="ms-1"
                                style={{ fontSize: '0.6rem' }}
                              >
                                adjusted
                              </CBadge>
                            )}
                          </CTableDataCell>
                        ))}
                      </CTableRow>
                    )
                  })}
                </CTableBody>
              </CTable>
            </div>
          )}
        </CCardBody>
      </CCard>

      {/* Revoke confirmation modal */}
      <CModal
        visible={Boolean(revokeConfirm)}
        onClose={() => setRevokeConfirm(null)}
        alignment="center"
        size="sm"
      >
        <CModalHeader>
          <CModalTitle>⚠️ Confirm Revoke</CModalTitle>
        </CModalHeader>
        <CModalBody className="small">
          <p className="mb-1">Are you sure you want to revoke the:</p>
          <p className="fw-semibold mb-0">{revokeConfirm?.label}</p>
          <p className="text-danger mt-2 mb-0" style={{ fontSize: '0.78rem' }}>
            This action cannot be undone without re-sending.
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="ghost"
            size="sm"
            onClick={() => setRevokeConfirm(null)}
          >
            Cancel
          </CButton>
          <CButton
            color="danger"
            size="sm"
            onClick={async () => {
              await revokeConfirm?.action()
              setRevokeConfirm(null)
            }}
          >
            Yes, Revoke
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

PlanTable.propTypes = {
  project: PropTypes.object.isRequired,
  onProjectChange: PropTypes.func.isRequired,
  canEdit: PropTypes.bool,
  currentUser: PropTypes.string,
}

const PlanningSummary = ({ project }) => {
  const workingPool = computeWorkingPool(project)
  const validation = validatePlanTotalWithCascade(
    project.monthly_plan,
    workingPool,
    project.pool_adjustments,
  )

  const projectTotal = project.monthly_plan.reduce(
    (s, m) => s + computeEffectiveProjectMonthly(project, m.month),
    0,
  )
  const poolTotal = (pool) =>
    project.monthly_plan.reduce(
      (s, m) => s + computeEffectivePoolMonthly(project, pool, m.month),
      0,
    )
  const adminTotal = poolTotal('admin')
  const hrTotal = poolTotal('hr')
  const coreTotal = poolTotal('core')
  const grandTotal = projectTotal + adminTotal + hrTotal + coreTotal

  const phaseTotals = { design: 0, implementation: 0, monitoring: 0 }
  let lineCount = 0
  project.monthly_plan.forEach((m) => {
    m.phases.forEach((ph) => {
      phaseTotals[ph.phase] = (phaseTotals[ph.phase] || 0) + (ph.amount || 0)
      lineCount += 1
    })
  })

  return (
    <CCard className="shadow-sm mb-4">
      <CCardHeader className="bg-transparent fw-semibold pt-3">📈 Planning Summary</CCardHeader>
      <CCardBody>
        <CAlert color={validation.valid ? 'success' : 'danger'} className="py-2 small">
          {validation.valid
            ? '✅ Can run as planned — the plan balances against the project baseline.'
            : `❌ Off by ${fmt(Math.abs(validation.diff))} — won't run as planned.`}
        </CAlert>

        <CRow className="g-3 mb-3">
          {[
            { label: 'Project', value: projectTotal, color: 'text-primary' },
            { label: 'Admin', value: adminTotal, color: 'text-warning' },
            { label: 'HR', value: hrTotal, color: 'text-info' },
            { label: 'Core', value: coreTotal, color: 'text-danger' },
            { label: 'Grand Total', value: grandTotal, color: 'text-dark fw-bold' },
          ].map((row) => (
            <CCol key={row.label} xs={6} md={2} className="text-center">
              <div className="small text-body-secondary">{row.label}</div>
              <div className={row.color}>{fmt(row.value)}</div>
            </CCol>
          ))}
        </CRow>

        <div className="small text-body-secondary mb-2">
          {lineCount} task line{lineCount !== 1 ? 's' : ''} planned · Design{' '}
          {fmt(phaseTotals.design)} · Implementation {fmt(phaseTotals.implementation)} · Monitoring{' '}
          {fmt(phaseTotals.monitoring)}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <CTable bordered small align="middle" className="mb-0" style={{ fontSize: '0.78rem' }}>
            <CTableHead color="light">
              <CTableRow>
                <CTableHeaderCell>Month</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Project</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Admin</CTableHeaderCell>
                <CTableHeaderCell className="text-end">HR</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Core</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {project.monthly_plan.map((m) => (
                <CTableRow key={m.month}>
                  <CTableDataCell>{monthLabel(m.month)}</CTableDataCell>
                  <CTableDataCell className="text-end">
                    {fmt(computeEffectiveProjectMonthly(project, m.month))}
                  </CTableDataCell>
                  <CTableDataCell className="text-end">
                    {fmt(computeEffectivePoolMonthly(project, 'admin', m.month))}
                  </CTableDataCell>
                  <CTableDataCell className="text-end">
                    {fmt(computeEffectivePoolMonthly(project, 'hr', m.month))}
                  </CTableDataCell>
                  <CTableDataCell className="text-end">
                    {fmt(computeEffectivePoolMonthly(project, 'core', m.month))}
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        </div>
      </CCardBody>
    </CCard>
  )
}

PlanningSummary.propTypes = {
  project: PropTypes.object.isRequired,
}

const ActualSpendPanel = ({ project }) => {
  const [entries, setEntries] = useState([])
  useEffect(() => {
    let cancelled = false
    localProjectExpenses.list({ projectId: project.id, pool: 'admin' }).then((rows) => {
      if (!cancelled) setEntries(rows)
    })
    return () => {
      cancelled = true
    }
  }, [project.id])

  const actualForMonth = (month) =>
    entries.filter((e) => e.month === month).reduce((s, e) => s + e.amount, 0)

  const actualProjectForMonth = (month) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    return computeMonthActualTotal(monthEntry)
  }

  return (
    <CCard className="shadow-sm mb-4">
      <CCardHeader className="bg-transparent fw-semibold pt-3">💸 Actual Spend</CCardHeader>
      <CCardBody>
        <div className="small text-body-secondary mb-3">
          Real money spent against this project, month by month, compared to the planned pool rates.
          Admin actuals are logged by HR in EMS → Expense Management → Project Expenses. Project
          actuals are entered directly on each phase line in the Monthly Plan table above. HR/Core
          actual tracking is not yet wired up.
        </div>
        <div style={{ overflowX: 'auto' }}>
          <CTable bordered small align="middle" className="mb-0" style={{ fontSize: '0.78rem' }}>
            <CTableHead color="light">
              <CTableRow>
                <CTableHeaderCell>Month</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Planned Admin</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Actual Admin</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Variance</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Project</CTableHeaderCell>
                <CTableHeaderCell className="text-end">HR</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Core</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {project.monthly_plan.map((m) => {
                const planned = computeEffectivePoolMonthly(project, 'admin', m.month)
                const actual = actualForMonth(m.month)
                const variance = planned - actual
                return (
                  <CTableRow key={m.month}>
                    <CTableDataCell>{monthLabel(m.month)}</CTableDataCell>
                    <CTableDataCell className="text-end">{fmt(planned)}</CTableDataCell>
                    <CTableDataCell className="text-end">
                      {actual === 0 ? 'None' : fmt(actual)}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                      <CBadge color={variance >= 0 ? 'success' : 'danger'}>{fmt(variance)}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                      {actualProjectForMonth(m.month) === 0
                        ? 'None'
                        : fmt(actualProjectForMonth(m.month))}
                    </CTableDataCell>
                    <CTableDataCell className="text-end text-body-tertiary">
                      — not yet tracked
                    </CTableDataCell>
                    <CTableDataCell className="text-end text-body-tertiary">
                      — not yet tracked
                    </CTableDataCell>
                  </CTableRow>
                )
              })}
            </CTableBody>
          </CTable>
        </div>
      </CCardBody>
    </CCard>
  )
}

ActualSpendPanel.propTypes = {
  project: PropTypes.object.isRequired,
}

const POOL_SEND_LABELS = { admin: 'Admin', hr: 'HR', core: 'Core' }

/**
 * The PO's month-by-month expense-management surface: pick a month from the
 * dropdown and send/revoke that month's Admin/HR/Core expense split (see
 * localProjects.sendPoolAllocation/revokePoolAllocation). Sending a
 * pool+month is what unlocks HR to log actual expenses against it in EMS,
 * capped at the sent amount; a pool+month that's never sent simply never
 * becomes available there — that IS the PO's restriction, no separate
 * block action needed. For projects on the new Budget Plan, HR and Core
 * additionally can't be sent until the PO approves that month in the
 * Budget Plan's actual phase (localBudgetPlan.approveMonth) — Admin is
 * never gated by this.
 */
const ExpensePanel = ({ project, onProjectChange, canEdit = false, currentUser = 'Unknown' }) => {
  // New-model projects never populate project.monthly_plan (it's the old
  // field — see budgetPlan.js/localBudgetPlan.js), so the month list and
  // per-pool figures here fall back to the new budget plan when one
  // exists; legacy projects with only the old monthly_plan keep working
  // exactly as before.
  const [budgetPlan, setBudgetPlan] = useState(null)
  useEffect(() => {
    let cancelled = false
    localBudgetPlan.getPlan(project.id).then((p) => {
      if (!cancelled) setBudgetPlan(p)
    })
    return () => {
      cancelled = true
    }
  }, [project.id])
  const months = budgetPlan
    ? budgetPlan.months.map((m) => m.month)
    : (project.monthly_plan || []).map((m) => m.month)
  const [selectedMonth, setSelectedMonth] = useState(months[0] || '')
  const [sendError, setSendError] = useState('')
  const [revokeConfirm, setRevokeConfirm] = useState(null) // { action: fn, label: string }
  const month = months.includes(selectedMonth) ? selectedMonth : months[0]

  // This month's Admin/HR/Core figure. For a new-model plan: an even
  // monthly slice of the pool's total cap, plus/minus any ledger transfer
  // tagged to this exact month (an HR/Core cap adjustment or Admin draw
  // targeting this month). For a legacy project, the old flat-rate model.
  const poolMonthAmount = (pool, m) => {
    if (!budgetPlan) return computeEffectivePoolMonthly(project, pool, m)
    const cap = (budgetPlan.project_value * (budgetPlan.pool_pct[pool] || 0)) / 100
    const flat =
      budgetPlan.months.length > 0 ? Math.round((cap / budgetPlan.months.length) * 100) / 100 : 0
    const monthNet = (budgetPlan.transfers || [])
      .filter((t) => t.origin_month === m && (t.from === pool || t.to === pool))
      .reduce((s, t) => s + (t.to === pool ? t.amount : -t.amount), 0)
    return Math.round((flat + monthNet) * 100) / 100
  }

  const budgetMonthEntry = budgetPlan?.months.find((m) => m.month === month)

  const transferredSubtasks =
    budgetMonthEntry?.tasks.flatMap((t) =>
      t.subtasks
        .filter((s) => s.actual_status === 'transferred')
        .map((s) => ({ ...s, taskName: t.name })),
    ) || []

  // HR/Core can only be sent once the PO has approved that month in the
  // Budget Plan's actual phase — Admin is never gated by this. Legacy
  // projects with no budgetPlan predate the approval concept entirely, so
  // they're never blocked by it.
  const monthApproved = budgetMonthEntry?.approved || false
  const requiresApproval = (pool) => pool !== 'admin' && Boolean(budgetPlan)

  // Excludes pool: 'project' — those are shown (and kept live) by the Actual
  // Expense card above; mirroring them here too would go stale between the
  // two components' independent renders and duplicate the same entry twice.
  const [actualEntries, setActualEntries] = useState([])
  useEffect(() => {
    let cancelled = false
    localProjectExpenses.list({ projectId: project.id, month }).then((rows) => {
      if (!cancelled) setActualEntries(rows.filter((e) => e.pool !== 'project'))
    })
    return () => {
      cancelled = true
    }
  }, [project.id, month])

  if (!months.length) {
    return (
      <CCard className="shadow-sm mb-4">
        <CCardHeader className="bg-transparent fw-semibold pt-3">📤 Expense</CCardHeader>
        <CCardBody>
          <div className="text-center text-body-tertiary small py-3">
            No Monthly Plan yet — plan the project first.
          </div>
        </CCardBody>
      </CCard>
    )
  }

  const sentFor = (pool) =>
    (project.sent_allocations || []).find((a) => a.pool === pool && a.month === month)

  const handleSend = async (pool) => {
    setSendError('')
    if (requiresApproval(pool) && !monthApproved) {
      setSendError(
        `${POOL_SEND_LABELS[pool]} for ${monthLabel(month)} can't be sent until the PO approves this month in the Budget Plan's actual phase.`,
      )
      return
    }
    const amount = poolMonthAmount(pool, month)
    if (amount <= 0) {
      setSendError(
        `${POOL_SEND_LABELS[pool]} for ${monthLabel(month)} is not allowed to take — there's no amount available to send (${fmt(amount)}).`,
      )
      return
    }
    try {
      const updated = await localProjects.sendPoolAllocation(project.id, {
        pool,
        month,
        amount,
        sentBy: currentUser,
      })
      onProjectChange(updated)
    } catch (e) {
      setSendError(e.message)
    }
  }

  const handleRevoke = (pool) => {
    setRevokeConfirm({
      label: `${POOL_SEND_LABELS[pool]} allocation for ${monthLabel(month)}`,
      action: async () => {
        setSendError('')
        const updated = await localProjects.revokePoolAllocation(project.id, { pool, month })
        onProjectChange(updated)
      },
    })
  }

  return (
    <>
      <CCard className="shadow-sm mb-4">
        <CCardHeader className="bg-transparent fw-semibold pt-3">📤 Expense</CCardHeader>
        <CCardBody>
          <div className="small text-body-secondary mb-3">
            Pick a month and send/revoke its Admin/HR/Core split. Sending a pool+month unlocks HR to
            log actual expenses against it in EMS, capped at the sent amount. A pool+month
            that&apos;s never sent stays unavailable there — simply don&apos;t send it to restrict
            that month. HR and Core also need the PO to approve that month in the Budget Plan&apos;s
            actual phase first; Admin does not.
          </div>

          <div className="d-flex flex-wrap gap-2 mb-3">
            {months.map((m) => (
              <CButton
                key={m}
                size="sm"
                color="primary"
                variant={m === month ? undefined : 'outline'}
                onClick={() => setSelectedMonth(m)}
              >
                {monthLabel(m)}
              </CButton>
            ))}
          </div>

          <CCard>
            <CCardHeader className="bg-transparent fw-semibold py-2">💰 Expenses</CCardHeader>
            <CCardBody className="p-2">
              {sendError && (
                <CAlert color="danger" className="py-2 small mb-2">
                  {sendError}
                </CAlert>
              )}
              {['admin', 'hr', 'core'].map((pool) => {
                const amount = poolMonthAmount(pool, month)
                const sent = sentFor(pool)
                const notAllowed = amount <= 0
                const blockedByApproval = requiresApproval(pool) && !monthApproved
                return (
                  <div
                    key={pool}
                    className="d-flex justify-content-between align-items-center border-bottom py-1 small"
                  >
                    <div>
                      <div className="fw-medium">{POOL_SEND_LABELS[pool]}</div>
                      <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                        Planned {fmt(amount)}
                      </div>
                    </div>
                    {sent ? (
                      <div className="d-flex align-items-center gap-2">
                        <CBadge
                          color="success"
                          shape="rounded-pill"
                          style={{ fontSize: '0.62rem' }}
                        >
                          Sent {fmt(sent.amount)}
                        </CBadge>
                        {canEdit && (
                          <CButton
                            size="sm"
                            color="secondary"
                            variant="ghost"
                            onClick={() => handleRevoke(pool)}
                          >
                            Revoke
                          </CButton>
                        )}
                      </div>
                    ) : notAllowed ? (
                      <CBadge color="danger" shape="rounded-pill" style={{ fontSize: '0.62rem' }}>
                        Not allowed to take
                      </CBadge>
                    ) : blockedByApproval ? (
                      <CBadge color="warning" shape="rounded-pill" style={{ fontSize: '0.62rem' }}>
                        Awaiting month approval
                      </CBadge>
                    ) : (
                      canEdit && (
                        <CButton
                          size="sm"
                          color="primary"
                          variant="outline"
                          onClick={() => handleSend(pool)}
                        >
                          Send
                        </CButton>
                      )
                    )}
                  </div>
                )
              })}
              {actualEntries.length > 0 && (
                <div className="mt-2">
                  <div className="small fw-semibold mb-1">Actual logged this month</div>
                  {actualEntries.map((e) => (
                    <div key={e.id} className="d-flex justify-content-between small">
                      <span>
                        {POOL_SEND_LABELS[e.pool]} — {e.label}
                      </span>
                      <span>{fmt(e.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              {transferredSubtasks.length > 0 && (
                <div className="mt-2">
                  <div className="small fw-semibold mb-1">Transferred from Budget Plan</div>
                  {transferredSubtasks.map((s) => (
                    <div key={s.id} className="d-flex justify-content-between small text-success">
                      <span>
                        {s.taskName} — {s.name}
                      </span>
                      <span>Money transferred — ₹0</span>
                    </div>
                  ))}
                </div>
              )}
            </CCardBody>
          </CCard>
        </CCardBody>
      </CCard>

      {/* Revoke confirmation modal */}
      <CModal
        visible={Boolean(revokeConfirm)}
        onClose={() => setRevokeConfirm(null)}
        alignment="center"
        size="sm"
      >
        <CModalHeader>
          <CModalTitle>⚠️ Confirm Revoke</CModalTitle>
        </CModalHeader>
        <CModalBody className="small">
          <p className="mb-1">Are you sure you want to revoke the sent budget for:</p>
          <p className="fw-semibold mb-0">{revokeConfirm?.label}</p>
          <p className="text-danger mt-2 mb-0" style={{ fontSize: '0.78rem' }}>
            This will remove access for HR to log expenses against this allocation.
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="ghost"
            size="sm"
            onClick={() => setRevokeConfirm(null)}
          >
            Cancel
          </CButton>
          <CButton
            color="danger"
            size="sm"
            onClick={async () => {
              await revokeConfirm?.action()
              setRevokeConfirm(null)
            }}
          >
            Yes, Revoke
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

ExpensePanel.propTypes = {
  project: PropTypes.object.isRequired,
  onProjectChange: PropTypes.func.isRequired,
  canEdit: PropTypes.bool,
  currentUser: PropTypes.string,
}

export { ExpensePanel }

const MonthlyPlanPanel = ({
  project,
  onProjectChange,
  canEdit = false,
  currentUser = 'Unknown',
}) => {
  const hasPlan = Boolean(project.monthly_plan?.length)
  return (
    <>
      <PlanTable
        project={project}
        onProjectChange={onProjectChange}
        canEdit={canEdit}
        currentUser={currentUser}
      />
      {hasPlan && (
        <>
          <PlanningSummary project={project} />
          <ActualSpendPanel project={project} />
        </>
      )}
    </>
  )
}

MonthlyPlanPanel.propTypes = {
  project: PropTypes.object.isRequired,
  onProjectChange: PropTypes.func.isRequired,
  canEdit: PropTypes.bool,
  currentUser: PropTypes.string,
}

export default MonthlyPlanPanel
