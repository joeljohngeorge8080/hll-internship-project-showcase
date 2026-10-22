import React, { useState, useEffect } from 'react'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CRow,
  CCol,
  CButton,
  CFormInput,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CBadge,
  CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCheck } from '@coreui/icons'
import { localOrgPool } from '../../../services/localOrgPool'
import { splitPercentagesByWeight, redistributeOnEdit } from './percentageUtils'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const fmtMonth = (ym) => {
  if (!ym) return ''
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

const PAYMENT_MODES = ['Bank Transfer', 'Cheque', 'Cash', 'UPI', 'Other']
const APPROVAL_STATUSES = ['Pending', 'Approved', 'Rejected']

// ─── Revenue Source Selector ─────────────────────────────────────────────────────
// Generalized over however many sources a given pool card offers: HR and
// Admin cards offer 3 (hr_revenue, project_pool, lsgb_revenue); Core offers
// a 4th (admin_pool) via showAdminShare. `pctBySource` holds one percentage
// per source key; toggling or editing any source redistributes the rest so
// the selected sources always sum to exactly 100.
const RevenueSourceSelector = ({
  poolType,
  poolFundLabel,
  revSources,
  setRevSources,
  pctBySource,
  setPctBySource,
  totalAmount,
  hrRevenueTotal,
  lsgbRevenueTotal,
  showAdminShare,
  projectPoolAvailable,
  adminPoolAvailable,
}) => {
  const total = parseFloat(totalAmount) || 0
  const availableSources = [
    'hr_revenue',
    'project_pool',
    'lsgb_revenue',
    ...(showAdminShare ? ['admin_pool'] : []),
  ]
  const multiSelected = revSources.length >= 2

  const SOURCE_LABELS = {
    hr_revenue: 'HR Revenue',
    project_pool: poolFundLabel,
    lsgb_revenue: 'LSGB Revenue',
    admin_pool: 'Admin 5% Share',
  }
  const SOURCE_COLORS = {
    hr_revenue: '#4cc9f0',
    project_pool: '#06d6a0',
    lsgb_revenue: '#ffb703',
    admin_pool: '#7209b7',
  }

  const toggle = (src) => {
    setRevSources((prev) => {
      const isRemoving = prev.includes(src)
      const next = isRemoving ? prev.filter((s) => s !== src) : [...prev, src]
      const finalNext = next.length > 0 ? next : ['project_pool']
      // Evenly split 100% across whatever ends up selected — matches this
      // selector's original 2-source behaviour (single = 100%, two = 50/50),
      // generalised to however many are selected, with the rounding
      // remainder given to the first selected source so the total is always
      // exactly 100.
      const nextPct = {}
      availableSources.forEach((s) => {
        nextPct[s] = 0
      })
      Object.assign(nextPct, splitPercentagesByWeight(finalNext))
      setPctBySource(nextPct)
      return finalNext
    })
  }

  // Redistribute the remaining percentage proportionally across the other
  // currently-selected sources.
  const handlePctChange = (src, val) => {
    setPctBySource(redistributeOnEdit(revSources, src, val, pctBySource))
  }

  const handleAmtChange = (src, val) => {
    if (total <= 0) return
    const amt = Math.max(0, Math.min(total, parseFloat(val) || 0))
    const pct = Math.round((amt / total) * 10000) / 100
    handlePctChange(src, pct)
  }

  const totalPct = Math.round(revSources.reduce((s, k) => s + (pctBySource[k] || 0), 0) * 100) / 100
  const pctValid = !multiSelected || totalPct === 100

  const rowStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '10px 14px',
  }

  const renderRow = (src, availableTotal) => {
    const label = SOURCE_LABELS[src]
    const color = SOURCE_COLORS[src]
    const checked = revSources.includes(src)
    const pct = pctBySource[src] || 0
    const amt = total > 0 ? Math.round(total * (pct / 100) * 100) / 100 : 0

    return (
      <div key={src} style={rowStyle}>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <input
            type="checkbox"
            id={`rev-${src}-${poolType}`}
            checked={checked}
            onChange={() => toggle(src)}
            style={{ accentColor: color, width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
          />
          <label
            htmlFor={`rev-${src}-${poolType}`}
            className="mb-0 fw-semibold"
            style={{ cursor: 'pointer', color, minWidth: 96 }}
          >
            <div>{label}</div>
          </label>
          {checked && multiSelected && (
            <>
              <CInputGroup size="sm" style={{ width: 90 }}>
                <CFormInput
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={pct}
                  onChange={(e) => handlePctChange(src, e.target.value)}
                  style={{ textAlign: 'right', fontWeight: 600 }}
                />
                <CInputGroupText style={{ fontWeight: 600, fontSize: '0.8rem' }}>%</CInputGroupText>
              </CInputGroup>
              <CInputGroup size="sm" style={{ width: 120 }}>
                <CInputGroupText style={{ fontSize: '0.8rem' }}>&#8377;</CInputGroupText>
                <CFormInput
                  type="number"
                  min="0"
                  value={amt || ''}
                  placeholder="Amount"
                  onChange={(e) => handleAmtChange(src, e.target.value)}
                  style={{ textAlign: 'right' }}
                />
              </CInputGroup>
              {total > 0 && (
                <span className="text-body-secondary" style={{ fontSize: '0.73rem' }}>
                  of {fmt(total)}
                </span>
              )}
            </>
          )}
          {checked && !multiSelected && total > 0 && (
            <span className="text-body-secondary ms-auto" style={{ fontSize: '0.78rem' }}>
              100% — {fmt(total)}
            </span>
          )}
        </div>
        {checked &&
          availableTotal !== undefined &&
          (() => {
            const drawn = multiSelected ? amt : total
            const remaining = (availableTotal || 0) - drawn
            const isOver = remaining < 0
            return (
              <div
                className={`small mt-1 ${isOver ? 'text-danger fw-semibold' : 'text-body-secondary'}`}
                style={{ fontSize: '0.74rem' }}
              >
                Available: {fmt(availableTotal || 0)} &nbsp;−{fmt(drawn)} this expense &nbsp;→&nbsp;
                {fmt(remaining)} remaining
              </div>
            )
          })()}
      </div>
    )
  }

  return (
    <div
      className="rounded-3 p-3 mb-3"
      style={{
        background: 'rgba(6,214,160,0.06)',
        border: '1px solid rgba(6,214,160,0.25)',
        fontSize: '0.85rem',
      }}
    >
      <div className="fw-semibold text-body mb-2" style={{ fontSize: '0.82rem' }}>
        Revenue Source
      </div>

      <div className="d-flex flex-column gap-2">
        {renderRow('hr_revenue', hrRevenueTotal)}
        {renderRow('project_pool', projectPoolAvailable)}
        {renderRow('lsgb_revenue', lsgbRevenueTotal)}
        {showAdminShare && renderRow('admin_pool', adminPoolAvailable)}
      </div>

      {multiSelected && (
        <div
          className={`small mt-2 d-flex align-items-center gap-2 ${pctValid ? 'text-success' : 'text-danger'}`}
          style={{ fontSize: '0.74rem' }}
        >
          {pctValid ? (
            <>
              <CIcon icon={cilCheck} style={{ width: 12, height: 12 }} />
              Percentages sum to 100% —{' '}
              {revSources.map((s) => `${SOURCE_LABELS[s]}: ${pctBySource[s] || 0}%`).join(' · ')}
            </>
          ) : (
            <>&#9888; Percentages must sum to 100% (currently {totalPct}%)</>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Budget Cap Alert ──────────────────────────────────────────────────────────
// Shared by every hard-capped revenue source (Project Pool, Admin 5% Share,
// LSGB Revenue) — each is a real running balance that shouldn't go
// negative, unlike HR Revenue which is informational-only in
// RevenueSourceSelector.
const BudgetCapAlert = ({ label, totalAmt, poolPortion, balance }) => {
  const { remaining } = balance

  if (totalAmt <= 0) return <div className="mb-3" style={{ minHeight: 0 }} />

  const overage = Math.round((poolPortion - remaining) * 100) / 100
  const isOver = overage > 0
  const isWarn = !isOver && remaining > 0 && poolPortion >= remaining * 0.8

  if (!isOver && !isWarn) return <div className="mb-3" style={{ minHeight: 0 }} />

  if (!isOver) {
    return (
      <div
        className="mb-3 p-2 rounded d-flex align-items-center gap-2"
        style={{
          background: 'rgba(255,193,7,0.1)',
          border: '1px solid rgba(255,193,7,0.35)',
          fontSize: '0.78rem',
        }}
      >
        <span style={{ fontSize: '1rem' }}>&#9889;</span>
        <span className="text-warning">
          This expense will use <strong>{fmt(poolPortion)}</strong> of the{' '}
          <strong>{fmt(remaining)}</strong> remaining {label} balance.
        </span>
      </div>
    )
  }

  return (
    <div
      className="mb-3 p-3 rounded"
      style={{
        background: 'rgba(220,53,69,0.12)',
        border: '1.5px solid rgba(220,53,69,0.5)',
        fontSize: '0.82rem',
      }}
    >
      <div className="d-flex align-items-center gap-2 fw-bold text-danger mb-1">
        <span style={{ fontSize: '1.05rem' }}>&#128683;</span>
        {label} balance exceeded
      </div>
      <div
        className="d-flex flex-wrap gap-3 mt-1"
        style={{ fontSize: '0.77rem', color: 'rgba(255,255,255,0.75)' }}
      >
        <span>
          Remaining: <strong className="text-warning">{fmt(remaining)}</strong>
        </span>
        <span>
          This expense ({label} portion):{' '}
          <strong className="text-danger">{fmt(poolPortion)}</strong>
        </span>
        <span>
          Overage: <strong className="text-danger">+{fmt(overage)}</strong>
        </span>
      </div>
      <div className="mt-2 small text-body-secondary" style={{ fontSize: '0.73rem' }}>
        Reduce the expense amount, reduce the {label} %, or route more to another revenue source to
        stay within balance.
      </div>
    </div>
  )
}

// ─── Section wrapper — gives every part of the form a clear, labeled block ────
const Section = ({ title, subtitle, children }) => (
  <div className="mb-4">
    <div className="fw-semibold mb-1" style={{ fontSize: '0.92rem' }}>
      {title}
    </div>
    {subtitle && (
      <div className="text-body-secondary mb-2" style={{ fontSize: '0.76rem' }}>
        {subtitle}
      </div>
    )}
    {children}
  </div>
)

const emptyForm = () => ({
  vendor: '',
  label: '',
  frequency: 'Monthly',
  yearly_price: '',
  amount: '',
  expenseMonth: new Date().toISOString().slice(0, 7),
  notes: '',
  bill_no: '',
  bill_date: '',
  employee_id: '',
  payment_mode: '',
  approval_status: 'Pending',
})

/**
 * Book Expense modal. Funding comes from a running balance per source
 * (Project Revenue, HR Revenue, LSGB Revenue, +Admin 5% Share for Core) —
 * no month scoping, no per-project picking. Which project's books absorb
 * the Project-Revenue portion is decided automatically server-side
 * (localOrgPool.computeAllocations), proportional to each project's own
 * remaining sent-but-unspent contribution — entirely hidden here.
 */
const BookExpenseModal = ({
  show,
  onClose,
  poolType,
  poolLabel,
  poolFundLabel,
  hrRevenueTotal,
  lsgbRevenueTotal,
  hrRevenueBreakdown,
  getAdminPoolBalance,
  expenseDropdownItems,
  onPickExpense,
  employeeCheckboxItems,
  onBulkAddEmployees,
  getAllEmployees,
  getPoolBalance,
  addExpense,
  updateExpense,
  onDelete,
  editingExpense,
  onSaved,
}) => {
  const showAdminShare = Boolean(getAdminPoolBalance)
  const isEdit = Boolean(editingExpense)

  const [form, setForm] = useState(emptyForm())
  const [revSources, setRevSources] = useState(['project_pool'])
  const [pctBySource, setPctBySource] = useState({
    hr_revenue: 0,
    project_pool: 100,
    lsgb_revenue: 0,
    admin_pool: 0,
  })
  const [selectedHrCategories, setSelectedHrCategories] = useState(['internship', 'recruitment', 'training'])

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([])
  const [bulkAdding, setBulkAdding] = useState(false)
  const [allEmployees, setAllEmployees] = useState([])
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptRemoved, setReceiptRemoved] = useState(false)
  const [poolBalance, setPoolBalance] = useState({ totalSent: 0, totalBooked: 0, remaining: 0 })
  const [adminPoolBalance, setAdminPoolBalance] = useState({
    totalSent: 0,
    totalBooked: 0,
    remaining: 0,
  })
  const [projectOptions, setProjectOptions] = useState([])
  const [pickMode, setPickMode] = useState('auto') // 'auto' | 'select'
  const [selectedProjectIds, setSelectedProjectIds] = useState([])
  const [projectPctById, setProjectPctById] = useState({})
  // Project-share month gating: { [projectId]: [{month, isActive, budget, booked, remaining, allowed}] }
  const [allowedMonthsByProject, setAllowedMonthsByProject] = useState({})
  // Multi-month split for NEW bookings only (editing keeps the single-month
  // dropdown — retroactively splitting an already-booked row across months
  // would mean deleting/recreating it, out of scope here).
  const [selectedMonths, setSelectedMonths] = useState([])
  const [monthPctByMonth, setMonthPctByMonth] = useState({})

  // Reset/prefill whenever the modal is opened (fresh add, or editing a row)
  useEffect(() => {
    if (!show) return
    if (editingExpense) {
      setForm({
        vendor: editingExpense.vendor || '',
        label: editingExpense.label || '',
        frequency: editingExpense.frequency || 'Monthly',
        yearly_price: editingExpense.yearly_price ? String(editingExpense.yearly_price) : '',
        amount: editingExpense.amount ? String(editingExpense.amount) : '',
        expenseMonth: editingExpense.date || new Date().toISOString().slice(0, 7),
        notes: editingExpense.notes || '',
        bill_no: editingExpense.bill_no || '',
        bill_date: editingExpense.bill_date || '',
        employee_id: editingExpense.employee_id || '',
        payment_mode: editingExpense.payment_mode || '',
        approval_status: editingExpense.approval_status || 'Pending',
      })
      setRevSources(
        editingExpense.revenue_sources?.length ? editingExpense.revenue_sources : ['project_pool'],
      )
      setPctBySource({
        hr_revenue: editingExpense.hr_revenue_pct || 0,
        project_pool: editingExpense.project_pool_pct ?? 100,
        lsgb_revenue: editingExpense.lsgb_revenue_pct || 0,
        admin_pool: editingExpense.admin_share_pct || 0,
      })
      // Editing always shows whatever allocation is currently stored, so the
      // user can see and adjust it — pick Automatic explicitly to go back
      // to a fresh proportional split instead.
      const allocs = editingExpense.project_allocations || []
      if (allocs.length > 0) {
        setPickMode('select')
        setSelectedProjectIds(allocs.map((a) => a.projectId))
        setProjectPctById(Object.fromEntries(allocs.map((a) => [a.projectId, a.sharePct])))
      } else {
        setPickMode('auto')
        setSelectedProjectIds([])
        setProjectPctById({})
      }
      setSelectedMonths([])
      setMonthPctByMonth({})
    } else {
      setForm(emptyForm())
      setRevSources(['project_pool'])
      setPctBySource({ hr_revenue: 0, project_pool: 100, lsgb_revenue: 0, admin_pool: 0 })
      setPickMode('auto')
      setSelectedProjectIds([])
      setProjectPctById({})
      setSelectedMonths([])
      setMonthPctByMonth({})
    }
    setSelectedHrCategories(['internship', 'recruitment', 'training'])
    setReceiptFile(null)
    setReceiptRemoved(false)
    setSelectedEmployeeIds([])
  }, [show, editingExpense])

  const reload = async () => {
    setPoolBalance(await getPoolBalance())
    if (getAdminPoolBalance) setAdminPoolBalance(await getAdminPoolBalance())
    if (getAllEmployees) {
      const res = await getAllEmployees()
      setAllEmployees(res?.items || res || [])
    }
    setProjectOptions(await localOrgPool.getProjectPoolRemaining(poolType))
  }

  useEffect(() => {
    if (show) reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show])

  const handleRemoveReceipt = async () => {
    if (!editingExpense?.id) return
    try {
      await localOrgPool.removeExpenseReceipt(
        editingExpense.id,
        editingExpense.receipt_storage_path,
      )
      setReceiptRemoved(true)
    } catch (e) {
      setSaveError(e?.message || 'Failed to remove the receipt. Please try again.')
    }
  }

  const handleExpensePick = (expenseId) => {
    if (!expenseId) return
    const mapped = onPickExpense(expenseId)
    if (!mapped) return
    setForm((f) => {
      const next = { ...f }
      for (const [k, v] of Object.entries(mapped)) {
        if (v !== undefined) next[k] = v
      }
      return next
    })
  }

  const toggleHrCategory = (cat) => {
    setSelectedHrCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    )
  }

  const toggleSelectedEmployee = (id) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((eid) => eid !== id) : [...prev, id],
    )
  }

  const toggleSelectAllEmployees = () => {
    const allIds = (employeeCheckboxItems || []).map((e) => e.id)
    setSelectedEmployeeIds((prev) => (prev.length === allIds.length ? [] : allIds))
  }

  const handleBulkAddEmployees = async () => {
    if (!selectedEmployeeIds.length) return
    setBulkAdding(true)
    try {
      const selected = (employeeCheckboxItems || []).filter((e) =>
        selectedEmployeeIds.includes(e.id),
      )
      await onBulkAddEmployees(selected)
      setSelectedEmployeeIds([])
      if (onSaved) await onSaved()
      onClose()
    } finally {
      setBulkAdding(false)
    }
  }

  const handleYearlyPriceChange = (val) => {
    const raw = parseFloat(val)
    const yp = Number.isFinite(raw) ? Math.max(0, raw) : 0
    const displayYp = val === '' ? '' : String(yp)
    const mc = yp > 0 ? (yp / 12).toFixed(2) : ''
    setForm((f) => ({ ...f, yearly_price: displayYp, amount: mc }))
  }

  const handleMonthlyCutChange = (val) => {
    const raw = parseFloat(val)
    const mc = Number.isFinite(raw) ? Math.max(0, raw) : 0
    const displayMc = val === '' ? '' : String(mc)
    const yp = mc > 0 ? (mc * 12).toFixed(2) : ''
    setForm((f) => ({ ...f, amount: displayMc, yearly_price: yp }))
  }

  const isSplitValid = () => {
    if (revSources.length < 2) return true
    const sum = revSources.reduce((s, src) => s + (pctBySource[src] || 0), 0)
    return Math.round(sum * 100) / 100 === 100
  }

  const hasPool = revSources.includes('project_pool')
  const hasAdminShare = revSources.includes('admin_pool')
  const hasLsgb = revSources.includes('lsgb_revenue')
  const hasHrRevenue = revSources.includes('hr_revenue')
  const selectedHrCategoriesTotal = hrRevenueBreakdown
    ? selectedHrCategories.reduce((s, k) => s + (hrRevenueBreakdown[k] || 0), 0)
    : hrRevenueTotal
  const poolPortion = hasPool
    ? Math.round((parseFloat(form.amount) || 0) * (pctBySource.project_pool / 100) * 100) / 100
    : 0

  // Project-share month gating: load every contributing project's monthly
  // budget/booked/remaining breakdown (not just the checked subset) so the
  // "Which projects?" rows can always show a real per-month figure, whether
  // or not that project is currently checked — narrowing to the checked
  // subset only happens below, when deriving which months the picker offers.
  useEffect(() => {
    if (!show || !hasPool || projectOptions.length === 0) {
      setAllowedMonthsByProject({})
      return
    }
    let cancelled = false
    localOrgPool
      .getAllowedProjectShareMonthsForProjects(
        poolType,
        projectOptions.map((p) => p.projectId),
      )
      .then((res) => {
        if (!cancelled) setAllowedMonthsByProject(res)
      })
    return () => {
      cancelled = true
    }
  }, [show, hasPool, projectOptions, poolType])

  // Union of every allowed month across the relevant project set — the
  // checked subset in Select mode, or every contributing project in
  // Automatic mode (so Automatic isn't left fully unconstrained). Union, not
  // intersection, so staggered project activation/budgets don't collapse the
  // picker to an unusably empty set. Always keeps the expense being edited's
  // own month choosable even if it's no longer "allowed", so editing never
  // locks the user out of their existing booking.
  const trueAllowedMonths = (() => {
    const relevantIds =
      pickMode === 'select' && selectedProjectIds.length > 0
        ? selectedProjectIds
        : projectOptions.map((p) => p.projectId)
    const set = new Set()
    relevantIds.forEach((id) => {
      ;(allowedMonthsByProject[id] || []).forEach((m) => {
        if (m.allowed) set.add(m.month)
      })
    })
    return set
  })()
  const combinedAllowedMonths = (() => {
    const set = new Set(trueAllowedMonths)
    if (isEdit && editingExpense?.date) set.add(editingExpense.date)
    return Array.from(set).sort()
  })()

  // How much project-pool money is actually bookable against `month`,
  // summed across whichever projects are relevant right now (the checked
  // subset in Select mode, or every contributing project in Automatic mode)
  // — only positive per-project contributions count, so one exhausted
  // project can't drag the total below what the others still have.
  const monthAggregateRemaining = (month) => {
    const relevantIds =
      pickMode === 'select' && selectedProjectIds.length > 0
        ? selectedProjectIds
        : projectOptions.map((p) => p.projectId)
    return relevantIds.reduce((sum, id) => {
      const info = (allowedMonthsByProject[id] || []).find((m) => m.month === month)
      return sum + Math.max(0, info?.remaining || 0)
    }, 0)
  }

  // Keep the single-month field valid as the constraint set changes — only
  // for editing (the multi-month picker below owns this for new bookings).
  useEffect(() => {
    if (!isEdit || combinedAllowedMonths.length === 0) return
    if (!combinedAllowedMonths.includes(form.expenseMonth)) {
      setForm((f) => ({ ...f, expenseMonth: combinedAllowedMonths[0] }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, combinedAllowedMonths.join(',')])

  // Keep the multi-month selection valid as the constraint set changes
  // (project/source switches) — drop any month that's no longer allowed and
  // re-split the rest, or fall back to the first allowed month if nothing
  // valid is left.
  useEffect(() => {
    if (isEdit || !hasPool) return
    if (combinedAllowedMonths.length === 0) {
      if (selectedMonths.length > 0) setSelectedMonths([])
      return
    }
    const stillValid = selectedMonths.filter((m) => combinedAllowedMonths.includes(m))
    if (stillValid.length === 0) {
      setSelectedMonths([combinedAllowedMonths[0]])
      setMonthPctByMonth({ [combinedAllowedMonths[0]]: 100 })
    } else if (stillValid.length !== selectedMonths.length) {
      const weightByKey = Object.fromEntries(stillValid.map((m) => [m, monthAggregateRemaining(m)]))
      setSelectedMonths(stillValid)
      setMonthPctByMonth(splitPercentagesByWeight(stillValid, weightByKey))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, hasPool, combinedAllowedMonths.join(',')])

  const isProjectSplitValid = () => {
    if (pickMode !== 'select' || selectedProjectIds.length < 2) return true
    const sum = selectedProjectIds.reduce((s, id) => s + (projectPctById[id] || 0), 0)
    return Math.round(sum * 100) / 100 === 100
  }

  // Toggling a project redistributes proportionally to each selected
  // project's own remaining pool balance (not an even split) — matches the
  // Automatic split's own weighting, just scoped to the checked subset.
  const toggleProject = (projectId) => {
    setSelectedProjectIds((prev) => {
      const isRemoving = prev.includes(projectId)
      const next = isRemoving ? prev.filter((id) => id !== projectId) : [...prev, projectId]
      const weightByKey = Object.fromEntries(
        next.map((id) => [id, projectOptions.find((p) => p.projectId === id)?.remaining || 0]),
      )
      setProjectPctById(splitPercentagesByWeight(next, weightByKey))
      return next
    })
  }

  // Redistribute the remaining percentage proportionally across the other
  // currently-selected projects — same pattern as the revenue-source rows.
  const handleProjectPctChange = (projectId, val) => {
    setProjectPctById(redistributeOnEdit(selectedProjectIds, projectId, val, projectPctById))
  }

  const handleProjectAmtChange = (projectId, val) => {
    if (poolPortion <= 0) return
    const amt = Math.max(0, Math.min(poolPortion, parseFloat(val) || 0))
    const pct = Math.round((amt / poolPortion) * 10000) / 100
    handleProjectPctChange(projectId, pct)
  }

  const isMonthSplitValid = () => {
    if (selectedMonths.length < 2) return true
    const sum = selectedMonths.reduce((s, m) => s + (monthPctByMonth[m] || 0), 0)
    return Math.round(sum * 100) / 100 === 100
  }

  // Toggling a month redistributes proportionally to each selected month's
  // own aggregate remaining budget — same pattern as toggleProject, just
  // weighted by monthAggregateRemaining instead of a project's balance.
  // Unlike the auto-recovery effect above (which snaps to a default when the
  // constraint set changes), unchecking the last month here is allowed to
  // leave the selection empty — the "select at least one month" warning and
  // the disabled Save button already cover that case.
  const toggleMonth = (month) => {
    setSelectedMonths((prev) => {
      const isRemoving = prev.includes(month)
      const next = isRemoving ? prev.filter((m) => m !== month) : [...prev, month]
      const weightByKey = Object.fromEntries(next.map((m) => [m, monthAggregateRemaining(m)]))
      setMonthPctByMonth(splitPercentagesByWeight(next, weightByKey))
      return next
    })
  }

  // Redistribute the remaining percentage proportionally across the other
  // currently-selected months — same pattern as the project rows. The
  // percentage is of the WHOLE expense amount (each month becomes its own
  // pool_expenses row with its own slice of the total), not just the
  // project-pool portion.
  const handleMonthPctChange = (month, val) => {
    setMonthPctByMonth(redistributeOnEdit(selectedMonths, month, val, monthPctByMonth))
  }

  const handleMonthAmtChange = (month, val) => {
    const totalAmt = parseFloat(form.amount) || 0
    if (totalAmt <= 0) return
    const amt = Math.max(0, Math.min(totalAmt, parseFloat(val) || 0))
    const pct = Math.round((amt / totalAmt) * 10000) / 100
    handleMonthPctChange(month, pct)
  }

  const handleSave = async () => {
    if (!form.label || !form.amount) return
    if (!((parseFloat(form.amount) || 0) > 0)) return
    if (!isSplitValid()) return
    if (!isProjectSplitValid()) return
    if (hasPool && !isEdit) {
      if (selectedMonths.length === 0) return
      if (!isMonthSplitValid()) return
    }
    setSaving(true)
    setSaveError('')
    try {
      const totalAmt = parseFloat(form.amount) || 0

      const buildAllocations = (monthPoolPortion) =>
        hasPool && pickMode === 'select' && selectedProjectIds.length > 0
          ? selectedProjectIds.map((id) => {
              const p = projectOptions.find((opt) => opt.projectId === id)
              const sharePct = projectPctById[id] || 0
              return {
                projectId: id,
                projectName: p?.projectName || '',
                sharePct,
                amountCharged: Math.round(monthPoolPortion * (sharePct / 100) * 100) / 100,
              }
            })
          : null

      const basePayload = {
        ...form,
        employee_id: form.employee_id || null,
        revenue_sources: revSources,
        hr_revenue_pct: pctBySource.hr_revenue,
        lsgb_revenue_pct: pctBySource.lsgb_revenue,
        ...(showAdminShare ? { admin_share_pct: pctBySource.admin_pool } : {}),
        project_pool_pct: pctBySource.project_pool,
      }

      let expenseId

      if (!isEdit && hasPool && selectedMonths.length > 1) {
        // Multi-month: one pool_expenses row per selected month, each
        // carrying its own slice of the total amount (and, if a manual
        // project split is active, that slice's own project allocations).
        // No schema change needed — this reuses the existing one-row-per-
        // month shape, it just books several rows in one user action.
        for (const month of selectedMonths) {
          const monthPct = monthPctByMonth[month] || 0
          const monthAmt = Math.round(totalAmt * (monthPct / 100) * 100) / 100
          const monthPoolPortion =
            Math.round(monthAmt * (pctBySource.project_pool / 100) * 100) / 100
          const monthAllocations = buildAllocations(monthPoolPortion)
          const rowPayload = {
            ...basePayload,
            amount: String(monthAmt),
            date: month,
            ...(monthAllocations ? { project_allocations: monthAllocations } : {}),
          }
          const created = await addExpense(rowPayload, 'global')
          if (!expenseId) expenseId = created?.id
        }
      } else {
        const date = !isEdit && hasPool ? selectedMonths[0] || form.expenseMonth : form.expenseMonth
        const manualAllocations = buildAllocations(poolPortion)
        const payload = {
          ...basePayload,
          date,
          ...(manualAllocations ? { project_allocations: manualAllocations } : {}),
        }
        if (isEdit) {
          await updateExpense(editingExpense.id, payload)
          expenseId = editingExpense.id
        } else {
          const created = await addExpense(payload, 'global')
          expenseId = created?.id
        }
      }

      if (receiptFile && expenseId) {
        await localOrgPool.uploadExpenseReceipt(expenseId, receiptFile)
      }

      if (onSaved) await onSaved()
      onClose()
    } catch (e) {
      setSaveError(e?.message || 'Failed to save the expense. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editingExpense?.id || !onDelete) return
    if (!window.confirm('Delete this expense? This cannot be undone.')) return
    setDeleting(true)
    setSaveError('')
    try {
      await onDelete(editingExpense.id)
      if (onSaved) await onSaved()
      onClose()
    } catch (e) {
      setSaveError(e?.message || 'Failed to delete the expense. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const disabledReason = (() => {
    if (!form.label || !form.amount) return true
    const totalAmt = parseFloat(form.amount) || 0
    if (!(totalAmt > 0)) return true
    if (!isSplitValid()) return true
    if (hasPool && pickMode === 'select' && selectedProjectIds.length === 0) return true
    if (!isProjectSplitValid()) return true
    if (hasPool) {
      if (poolPortion > poolBalance.remaining) return true
    }
    if (hasPool && !isEdit) {
      if (selectedMonths.length === 0) return true
      if (!isMonthSplitValid()) return true
      for (const month of selectedMonths) {
        const monthPct = monthPctByMonth[month] || 0
        const monthAmt = Math.round(totalAmt * (monthPct / 100) * 100) / 100
        const monthPoolPortion = Math.round(monthAmt * (pctBySource.project_pool / 100) * 100) / 100
        if (monthPoolPortion > monthAggregateRemaining(month)) return true
      }
    }
    if (hasAdminShare) {
      const sharePortion = Math.round(totalAmt * (pctBySource.admin_pool / 100) * 100) / 100
      if (sharePortion > adminPoolBalance.remaining) return true
    }
    if (hasLsgb) {
      const lsgbPortion = Math.round(totalAmt * (pctBySource.lsgb_revenue / 100) * 100) / 100
      if (lsgbPortion > lsgbRevenueTotal) return true
    }
    if (hasHrRevenue) {
      if (hrRevenueBreakdown && selectedHrCategories.length === 0) return true
      const hrPortion = Math.round(totalAmt * (pctBySource.hr_revenue / 100) * 100) / 100
      if (hrPortion > selectedHrCategoriesTotal) return true
    }
    return false
  })()

  return (
    <CModal visible={show} onClose={onClose} size="lg" scrollable backdrop="static">
      <CModalHeader closeButton>
        <div className="w-100">
          <CModalTitle>
            {isEdit ? 'Edit' : 'Add New'} {poolLabel} Expense
          </CModalTitle>
          {/* ── Always-visible balance strip ── */}
          <div className="d-flex flex-wrap gap-2 mt-2">
            <CBadge
              color="success"
              shape="rounded-pill"
              className="px-3 py-2"
              style={{ fontSize: '0.75rem' }}
            >
              {poolFundLabel} remaining: {fmt(poolBalance.remaining)}
            </CBadge>
            {showAdminShare && (
              <CBadge
                color="dark"
                shape="rounded-pill"
                className="px-3 py-2"
                style={{ fontSize: '0.75rem' }}
              >
                Admin 5% Share remaining: {fmt(adminPoolBalance.remaining)}
              </CBadge>
            )}
            <CBadge
              color="info"
              shape="rounded-pill"
              className="px-3 py-2"
              style={{ fontSize: '0.75rem', cursor: revSources.includes('hr_revenue') ? 'pointer' : 'default' }}
              title={revSources.includes('hr_revenue') ? 'HR Revenue breakdown shown below' : ''}
            >
              HR Revenue available: {fmt(hrRevenueTotal)}
            </CBadge>
            <CBadge
              color="warning"
              shape="rounded-pill"
              className="px-3 py-2"
              style={{ fontSize: '0.75rem' }}
            >
              LSGB Revenue available: {fmt(lsgbRevenueTotal)}
            </CBadge>
          </div>
        </div>
      </CModalHeader>

      <CModalBody>
        {employeeCheckboxItems && !isEdit ? (
          <Section
            title="Select Employee(s) — TPC category"
            subtitle="Add one or more employees' salaries as Core expenses in one click, or fill the form below for a one-off expense instead."
          >
            <div className="p-3 rounded border" style={{ fontSize: '0.85rem' }}>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="fw-semibold" style={{ fontSize: '0.82rem' }}>
                  {employeeCheckboxItems.length} available
                </div>
                <CButton
                  size="sm"
                  color="success"
                  disabled={!selectedEmployeeIds.length || bulkAdding}
                  onClick={handleBulkAddEmployees}
                >
                  {bulkAdding
                    ? 'Adding…'
                    : `Add Selected (${selectedEmployeeIds.length}) as ${poolLabel} Expenses`}
                </CButton>
              </div>
              {employeeCheckboxItems.length === 0 ? (
                <div className="text-body-secondary small">
                  No TPC-category employees available to add.
                </div>
              ) : (
                <>
                  <div className="d-flex align-items-center gap-2 mb-2 pb-2 border-bottom">
                    <input
                      type="checkbox"
                      id={`select-all-employees-${poolType}`}
                      checked={selectedEmployeeIds.length === employeeCheckboxItems.length}
                      onChange={toggleSelectAllEmployees}
                      style={{ width: 15, height: 15, cursor: 'pointer' }}
                    />
                    <label
                      htmlFor={`select-all-employees-${poolType}`}
                      className="mb-0 fw-semibold"
                      style={{ cursor: 'pointer' }}
                    >
                      Select All
                    </label>
                  </div>
                  <div
                    className="d-flex flex-column gap-1"
                    style={{ maxHeight: 220, overflowY: 'auto' }}
                  >
                    {employeeCheckboxItems.map((emp) => (
                      <div key={emp.id} className="d-flex align-items-center gap-2">
                        <input
                          type="checkbox"
                          id={`emp-chk-${poolType}-${emp.id}`}
                          checked={selectedEmployeeIds.includes(emp.id)}
                          onChange={() => toggleSelectedEmployee(emp.id)}
                          style={{ width: 15, height: 15, cursor: 'pointer' }}
                        />
                        <label
                          htmlFor={`emp-chk-${poolType}-${emp.id}`}
                          className="mb-0 d-flex justify-content-between flex-fill"
                          style={{ cursor: 'pointer' }}
                        >
                          <span>{emp.label}</span>
                          {emp.amount > 0 && (
                            <span className="text-body-secondary">{fmt(emp.amount)}</span>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Section>
        ) : null}

        <Section title="What / Who" subtitle="The basic details of this expense.">
          {expenseDropdownItems && expenseDropdownItems.length > 0 && !isEdit && (
            <CRow className="g-2 mb-2">
              <CCol xs={12} md={6}>
                <CFormSelect
                  size="sm"
                  onChange={(e) => handleExpensePick(e.target.value)}
                  defaultValue=""
                >
                  <option value="">— Prefill from an existing planned expense (optional) —</option>
                  {expenseDropdownItems.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
            </CRow>
          )}

          <CRow className="g-2 mb-2">
            <CCol xs={12} md={6}>
              <CFormInput
                size="sm"
                placeholder="Vendor / Payee *"
                value={form.vendor}
                onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
              />
            </CCol>
            <CCol xs={12} md={6}>
              <CFormInput
                size="sm"
                placeholder="Category / Description *"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </CCol>
          </CRow>

          {getAllEmployees && (
            <CRow className="g-2 mb-2">
              <CCol xs={12} md={6}>
                <CFormSelect
                  size="sm"
                  value={form.employee_id}
                  onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
                >
                  <option value="">— Beneficiary / Employee (optional) —</option>
                  {allEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employee_name}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol xs={12} md={6}>
                <CFormSelect
                  size="sm"
                  value={form.payment_mode}
                  onChange={(e) => setForm((f) => ({ ...f, payment_mode: e.target.value }))}
                >
                  <option value="">— Payment Mode (optional) —</option>
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
            </CRow>
          )}

          <CRow className="g-2 mb-2">
            <CCol xs={12} md={4}>
              <CFormSelect
                size="sm"
                value={form.frequency}
                onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
              >
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Yearly">Yearly</option>
                <option value="One-time">One-time</option>
              </CFormSelect>
            </CCol>
            <CCol xs={6} md={4}>
              <CInputGroup size="sm">
                <CInputGroupText>₹</CInputGroupText>
                <CFormInput
                  type="number"
                  min="0"
                  placeholder="Yearly Price"
                  value={form.yearly_price}
                  onChange={(e) => handleYearlyPriceChange(e.target.value)}
                />
              </CInputGroup>
            </CCol>
            <CCol xs={6} md={4}>
              <CInputGroup size="sm">
                <CInputGroupText>₹</CInputGroupText>
                <CFormInput
                  type="number"
                  min="0"
                  placeholder="Monthly Cut *"
                  value={form.amount}
                  onChange={(e) => handleMonthlyCutChange(e.target.value)}
                />
              </CInputGroup>
            </CCol>
          </CRow>

          {!hasPool && (
            <CRow className="g-2 mb-2">
              <CCol xs={12} md={4}>
                <label className="form-label small mb-1">Month</label>
                <CFormInput
                  size="sm"
                  type="month"
                  value={form.expenseMonth}
                  onChange={(e) => setForm((f) => ({ ...f, expenseMonth: e.target.value }))}
                />
              </CCol>
            </CRow>
          )}

          <CRow className="g-2">
            <CCol xs={12} md={3}>
              <CFormInput
                size="sm"
                placeholder="Bill No (optional)"
                value={form.bill_no}
                onChange={(e) => setForm((f) => ({ ...f, bill_no: e.target.value }))}
              />
            </CCol>
            <CCol xs={12} md={3}>
              <label className="form-label small mb-1">Date</label>
              <CFormInput
                size="sm"
                type="date"
                value={form.bill_date}
                onChange={(e) => setForm((f) => ({ ...f, bill_date: e.target.value }))}
              />
            </CCol>
            <CCol xs={12} md={6}>
              <CFormInput
                size="sm"
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </CCol>
          </CRow>
        </Section>

        <Section
          title="How it's funded"
          subtitle="Choose which revenue source(s) pay for this expense."
        >
          <RevenueSourceSelector
            poolType={poolType}
            poolFundLabel={poolFundLabel}
            revSources={revSources}
            setRevSources={setRevSources}
            pctBySource={pctBySource}
            setPctBySource={setPctBySource}
            totalAmount={form.amount}
            hrRevenueTotal={hrRevenueTotal}
            lsgbRevenueTotal={lsgbRevenueTotal}
            showAdminShare={showAdminShare}
            projectPoolAvailable={poolBalance.remaining}
            adminPoolAvailable={adminPoolBalance.remaining}
          />

          {revSources.includes('hr_revenue') && hrRevenueBreakdown && (
            <div
              className="rounded-3 p-3 mb-3 mt-3"
              style={{
                background: 'rgba(79,172,254,0.08)',
                border: '1px solid rgba(79,172,254,0.25)',
                fontSize: '0.85rem',
              }}
            >
              <div className="fw-semibold text-body mb-2" style={{ fontSize: '0.82rem' }}>
                HR Revenue Categories — which to draw from?
              </div>
              <div className="d-flex flex-column gap-2">
                {[
                  { key: 'internship', label: 'Internship' },
                  { key: 'recruitment', label: 'Recruitment' },
                  { key: 'training', label: 'Training' },
                ].map(({ key, label }) => {
                  const checked = selectedHrCategories.includes(key)
                  return (
                    <div
                      key={key}
                      className="d-flex align-items-center gap-2 p-2 rounded"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      <input
                        type="checkbox"
                        id={`hr-cat-${key}-${poolType}`}
                        checked={checked}
                        onChange={() => toggleHrCategory(key)}
                        style={{
                          accentColor: '#4cc9f0',
                          width: 15,
                          height: 15,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      />
                      <label
                        htmlFor={`hr-cat-${key}-${poolType}`}
                        className="mb-0 fw-semibold flex-fill"
                        style={{ cursor: 'pointer', color: '#4cc9f0' }}
                      >
                        {label}
                      </label>
                      <span className="text-body-secondary">
                        {fmt(hrRevenueBreakdown[key] || 0)}
                      </span>
                    </div>
                  )
                })}
              </div>
              {selectedHrCategories.length === 0 ? (
                <div className="text-danger mt-2" style={{ fontSize: '0.74rem' }}>
                  Select at least one category to draw HR Revenue from.
                </div>
              ) : (
                <div className="text-body-secondary mt-2" style={{ fontSize: '0.74rem' }}>
                  Combined available from selected categories:{' '}
                  <strong>
                    {fmt(
                      selectedHrCategories.reduce(
                        (s, k) => s + (hrRevenueBreakdown[k] || 0),
                        0,
                      ),
                    )}
                  </strong>
                </div>
              )}
            </div>
          )}
          {hasPool && (
            <BudgetCapAlert
              label={poolFundLabel}
              totalAmt={parseFloat(form.amount) || 0}
              poolPortion={
                Math.round(
                  (parseFloat(form.amount) || 0) * (pctBySource.project_pool / 100) * 100,
                ) / 100
              }
              balance={poolBalance}
            />
          )}
          {hasAdminShare && (
            <BudgetCapAlert
              label="Admin 5% Share"
              totalAmt={parseFloat(form.amount) || 0}
              poolPortion={
                Math.round((parseFloat(form.amount) || 0) * (pctBySource.admin_pool / 100) * 100) /
                100
              }
              balance={adminPoolBalance}
            />
          )}
          {hasLsgb && (
            <BudgetCapAlert
              label="LSGB Revenue"
              totalAmt={parseFloat(form.amount) || 0}
              poolPortion={
                Math.round(
                  (parseFloat(form.amount) || 0) * (pctBySource.lsgb_revenue / 100) * 100,
                ) / 100
              }
              balance={{ remaining: lsgbRevenueTotal }}
            />
          )}
        </Section>

        {hasPool && (
          <div
            className="mb-3 p-2 rounded border border-success"
            style={{ background: 'rgba(6,214,160,0.06)', fontSize: '0.8rem' }}
          >
            <div className="text-success fw-semibold mb-2">Which projects?</div>
            <div className="d-flex gap-3 mb-2">
              <div className="form-check">
                <input
                  type="radio"
                  className="form-check-input"
                  id="pool-pick-auto"
                  checked={pickMode === 'auto'}
                  onChange={() => setPickMode('auto')}
                />
                <label className="form-check-label" htmlFor="pool-pick-auto">
                  Automatic
                </label>
              </div>
              <div className="form-check">
                <input
                  type="radio"
                  className="form-check-input"
                  id="pool-pick-select"
                  checked={pickMode === 'select'}
                  onChange={() => setPickMode('select')}
                />
                <label className="form-check-label" htmlFor="pool-pick-select">
                  Select Projects
                </label>
              </div>
            </div>

            {pickMode === 'auto' && (
              <div className="text-body-secondary" style={{ fontSize: '0.74rem' }}>
                The {poolFundLabel} portion is split proportionally across every project that has
                contributed to this pool.
              </div>
            )}

            {pickMode === 'select' &&
              (projectOptions.length === 0 ? (
                <div className="text-body-secondary" style={{ fontSize: '0.74rem' }}>
                  No projects currently have remaining budget in this pool.
                </div>
              ) : (
                <>
                  <div className="d-flex flex-column gap-1">
                    {projectOptions.map((p) => {
                      const checked = selectedProjectIds.includes(p.projectId)
                      const multi = selectedProjectIds.length >= 2
                      const pct = projectPctById[p.projectId] || 0
                      const amt =
                        poolPortion > 0 ? Math.round(poolPortion * (pct / 100) * 100) / 100 : 0
                      const drawn = multi ? amt : checked ? poolPortion : 0
                      // Two independent constraints: the project's actual
                      // all-time running balance (sent into the pool minus
                      // booked, from project_sent_allocations) and its
                      // theoretical share budget for the selected month
                      // (project_value × pct% ÷ total months, from
                      // buildProjectMonthlyBreakdown) — a booking can't
                      // exceed either, so the effective cap is whichever is
                      // smaller.
                      // Preview month: the first selected month for a new,
                      // possibly multi-month booking (see "Which month(s)?"
                      // below for the authoritative per-month figures once
                      // more than one is picked), or the single edited
                      // month while editing.
                      const previewMonth = isEdit ? form.expenseMonth : selectedMonths[0]
                      const monthInfo = (allowedMonthsByProject[p.projectId] || []).find(
                        (m) => m.month === previewMonth,
                      )
                      const effectiveAvailable = Math.min(
                        p.remaining ?? Infinity,
                        monthInfo ? monthInfo.remaining : Infinity,
                      )
                      const remaining = effectiveAvailable - drawn
                      const isOver = checked && remaining < 0

                      return (
                        <div
                          key={p.projectId}
                          className="p-2 rounded"
                          style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.1)',
                          }}
                        >
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <input
                              type="checkbox"
                              id={`pool-project-${p.projectId}`}
                              checked={checked}
                              onChange={() => toggleProject(p.projectId)}
                              style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
                            />
                            <label
                              htmlFor={`pool-project-${p.projectId}`}
                              className="mb-0"
                              style={{ cursor: 'pointer', minWidth: 96 }}
                            >
                              {p.projectName}
                            </label>
                            {checked && multi && (
                              <>
                                <CInputGroup size="sm" style={{ width: 90 }}>
                                  <CFormInput
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={pct}
                                    onChange={(e) =>
                                      handleProjectPctChange(p.projectId, e.target.value)
                                    }
                                    style={{ textAlign: 'right', fontWeight: 600 }}
                                  />
                                  <CInputGroupText style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                                    %
                                  </CInputGroupText>
                                </CInputGroup>
                                <CInputGroup size="sm" style={{ width: 120 }}>
                                  <CInputGroupText style={{ fontSize: '0.8rem' }}>
                                    &#8377;
                                  </CInputGroupText>
                                  <CFormInput
                                    type="number"
                                    min="0"
                                    value={amt || ''}
                                    placeholder="Amount"
                                    onChange={(e) =>
                                      handleProjectAmtChange(p.projectId, e.target.value)
                                    }
                                    style={{ textAlign: 'right' }}
                                  />
                                </CInputGroup>
                              </>
                            )}
                            {checked && !multi && poolPortion > 0 && (
                              <span
                                className="text-body-secondary ms-auto"
                                style={{ fontSize: '0.78rem' }}
                              >
                                100% — {fmt(poolPortion)}
                              </span>
                            )}
                          </div>
                          <div
                            className="small mt-1 text-body-secondary"
                            style={{ fontSize: '0.74rem' }}
                          >
                            All-time balance: {fmt(p.remaining || 0)} (sent {fmt(p.sent || 0)} −
                            booked {fmt(p.booked || 0)})
                          </div>
                          <div
                            className="small text-body-secondary"
                            style={{ fontSize: '0.74rem' }}
                          >
                            {!previewMonth
                              ? "Pick a month below to see this month's share"
                              : monthInfo
                                ? `${fmtMonth(previewMonth)} share: ${fmt(monthInfo.remaining)} remaining (budget ${fmt(monthInfo.budget)} − booked ${fmt(monthInfo.booked)})`
                                : `${fmtMonth(previewMonth)} share: not available for this project`}
                          </div>
                          <div
                            className={`small mt-1 ${isOver ? 'text-danger fw-semibold' : 'text-body-secondary'}`}
                            style={{ fontSize: '0.74rem' }}
                          >
                            Bookable this month: {fmt(effectiveAvailable)} &nbsp;−{fmt(drawn)} this
                            expense &nbsp;→&nbsp;
                            {fmt(remaining)} remaining
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {selectedProjectIds.length === 0 && (
                    <div className="text-danger mt-2" style={{ fontSize: '0.74rem' }}>
                      Select at least one project.
                    </div>
                  )}
                  {selectedProjectIds.length >= 2 && (
                    <div
                      className={`small mt-2 d-flex align-items-center gap-2 ${isProjectSplitValid() ? 'text-success' : 'text-danger'}`}
                      style={{ fontSize: '0.74rem' }}
                    >
                      {isProjectSplitValid() ? (
                        <>
                          <CIcon icon={cilCheck} style={{ width: 12, height: 12 }} />
                          Percentages sum to 100%
                        </>
                      ) : (
                        <>
                          &#9888; Percentages must sum to 100% (currently{' '}
                          {Math.round(
                            selectedProjectIds.reduce((s, id) => s + (projectPctById[id] || 0), 0) *
                              100,
                          ) / 100}
                          %)
                        </>
                      )}
                    </div>
                  )}
                </>
              ))}
          </div>
        )}

        {hasPool && isEdit && (
          <Section
            title="Which month?"
            subtitle="Only months where the selected project(s) are active and still have share budget left are offered."
          >
            <CRow className="g-2">
              <CCol xs={12} md={4}>
                <CFormSelect
                  size="sm"
                  value={form.expenseMonth}
                  onChange={(e) => setForm((f) => ({ ...f, expenseMonth: e.target.value }))}
                >
                  {combinedAllowedMonths.length === 0 && (
                    <option value="">— no months currently available —</option>
                  )}
                  {combinedAllowedMonths.map((m) => (
                    <option key={m} value={m}>
                      {fmtMonth(m)}
                      {!trueAllowedMonths.has(m) ? ' (current)' : ''}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
            </CRow>
          </Section>
        )}

        {hasPool && !isEdit && (
          <Section
            title="Which month(s)?"
            subtitle="Select one or more months to book this expense's project-share portion against — each month can only take as much as it still has available. With more than one selected, the total splits proportionally across them."
          >
            {combinedAllowedMonths.length === 0 ? (
              <div className="text-body-secondary" style={{ fontSize: '0.74rem' }}>
                No months currently available for the selected project(s).
              </div>
            ) : (
              <>
                <div className="d-flex flex-column gap-1">
                  {combinedAllowedMonths.map((month) => {
                    const checked = selectedMonths.includes(month)
                    const multi = selectedMonths.length >= 2
                    const totalAmt = parseFloat(form.amount) || 0
                    const pct = monthPctByMonth[month] || 0
                    const monthAmt =
                      totalAmt > 0 ? Math.round(totalAmt * (pct / 100) * 100) / 100 : 0
                    const monthPoolPortion =
                      Math.round(monthAmt * (pctBySource.project_pool / 100) * 100) / 100
                    const drawn = multi ? monthPoolPortion : checked ? poolPortion : 0
                    const monthCap = monthAggregateRemaining(month)
                    const remaining = monthCap - drawn
                    const isOver = checked && remaining < 0

                    return (
                      <div
                        key={month}
                        className="p-2 rounded"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}
                      >
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <input
                            type="checkbox"
                            id={`pool-month-${month}`}
                            checked={checked}
                            onChange={() => toggleMonth(month)}
                            style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
                          />
                          <label
                            htmlFor={`pool-month-${month}`}
                            className="mb-0"
                            style={{ cursor: 'pointer', minWidth: 120 }}
                          >
                            {fmtMonth(month)}
                          </label>
                          {checked && multi && (
                            <>
                              <CInputGroup size="sm" style={{ width: 90 }}>
                                <CFormInput
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={pct}
                                  onChange={(e) => handleMonthPctChange(month, e.target.value)}
                                  style={{ textAlign: 'right', fontWeight: 600 }}
                                />
                                <CInputGroupText style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                                  %
                                </CInputGroupText>
                              </CInputGroup>
                              <CInputGroup size="sm" style={{ width: 120 }}>
                                <CInputGroupText style={{ fontSize: '0.8rem' }}>
                                  &#8377;
                                </CInputGroupText>
                                <CFormInput
                                  type="number"
                                  min="0"
                                  value={monthAmt || ''}
                                  placeholder="Amount"
                                  onChange={(e) => handleMonthAmtChange(month, e.target.value)}
                                  style={{ textAlign: 'right' }}
                                />
                              </CInputGroup>
                            </>
                          )}
                          {checked && !multi && poolPortion > 0 && (
                            <span
                              className="text-body-secondary ms-auto"
                              style={{ fontSize: '0.78rem' }}
                            >
                              100% — {fmt(poolPortion)}
                            </span>
                          )}
                        </div>
                        <div
                          className={`small mt-1 ${isOver ? 'text-danger fw-semibold' : 'text-body-secondary'}`}
                          style={{ fontSize: '0.74rem' }}
                        >
                          Available this month: {fmt(monthCap)} &nbsp;−{fmt(drawn)} this expense
                          &nbsp;→&nbsp;
                          {fmt(remaining)} remaining
                        </div>
                      </div>
                    )
                  })}
                </div>
                {selectedMonths.length === 0 && (
                  <div className="text-danger mt-2" style={{ fontSize: '0.74rem' }}>
                    Select at least one month.
                  </div>
                )}
                {selectedMonths.length >= 2 && (
                  <div
                    className={`small mt-2 d-flex align-items-center gap-2 ${isMonthSplitValid() ? 'text-success' : 'text-danger'}`}
                    style={{ fontSize: '0.74rem' }}
                  >
                    {isMonthSplitValid() ? (
                      <>
                        <CIcon icon={cilCheck} style={{ width: 12, height: 12 }} />
                        Percentages sum to 100%
                      </>
                    ) : (
                      <>
                        &#9888; Percentages must sum to 100% (currently{' '}
                        {Math.round(
                          selectedMonths.reduce((s, m) => s + (monthPctByMonth[m] || 0), 0) * 100,
                        ) / 100}
                        %)
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </Section>
        )}

        <Section title="Attachment & Approval">
          <CRow className="g-2">
            <CCol xs={12} md={6}>
              <label className="form-label small mb-1">Receipt (optional)</label>
              <CFormInput
                size="sm"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              />
              {editingExpense?.receipt_file_name && !receiptFile && !receiptRemoved && (
                <div className="text-body-secondary small mt-1 d-flex align-items-center gap-2">
                  <span>Current: {editingExpense.receipt_file_name}</span>
                  <CButton
                    size="sm"
                    color="danger"
                    variant="ghost"
                    className="p-0"
                    style={{ fontSize: '0.75rem' }}
                    onClick={handleRemoveReceipt}
                  >
                    Remove
                  </CButton>
                </div>
              )}
              {receiptRemoved && !receiptFile && (
                <div className="text-body-secondary small mt-1">Receipt removed.</div>
              )}
            </CCol>
            <CCol xs={12} md={6}>
              <label className="form-label small mb-1">Approval Status</label>
              <CFormSelect
                size="sm"
                value={form.approval_status}
                onChange={(e) => setForm((f) => ({ ...f, approval_status: e.target.value }))}
              >
                {APPROVAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
          </CRow>
        </Section>
      </CModalBody>

      <CModalFooter>
        {saveError && (
          <CAlert
            color="danger"
            className="w-100 mb-2"
            dismissible
            onClose={() => setSaveError('')}
          >
            {saveError}
          </CAlert>
        )}
        {isEdit && onDelete && (
          <CButton
            color="danger"
            variant="ghost"
            className="me-auto"
            onClick={handleDelete}
            disabled={deleting || saving}
          >
            {deleting ? 'Deleting…' : 'Delete Expense'}
          </CButton>
        )}
        <CButton color="secondary" variant="ghost" onClick={onClose}>
          Cancel
        </CButton>
        <CButton
          color="success"
          onClick={handleSave}
          disabled={disabledReason || saving || deleting}
        >
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add & Distribute Expense'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export default BookExpenseModal
