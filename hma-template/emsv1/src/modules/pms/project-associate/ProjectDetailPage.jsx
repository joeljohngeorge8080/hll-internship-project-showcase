/**
 * ProjectDetailPage.jsx — Full project detail view for Project Associate.
 * Route: /pms/projects/:id
 */
import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CButton,
  CBadge,
  CProgress,
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CAlert,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CToaster,
  CToast,
  CToastBody,
  CToastClose,
  CSpinner,
  CTable,
  CTableHead,
  CTableBody,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
  CFormInput,
  CFormSelect,
  CFormLabel,
  CFormCheck,
  CFormTextarea,
  CInputGroup,
  CInputGroupText,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilPen,
  cilArrowLeft,
  cilPeople,
  cilCheckCircle,
  cilXCircle,
  cilWarning,
  cilEnvelopeLetter,
  cilCalendar,
  cilLocationPin,
  cilBuilding,
  cilDollar,
  cilFile,
  cilPlus,
  cilTrash,
  cilPencil,
  cilWallet,
  cilCloudUpload,
  cilCheck,
  cilReload,
} from '@coreui/icons'
import { CChartDoughnut } from '@coreui/react-chartjs'
import { localProjects, localOfficers } from '../../../services/localProjects'
import { localPayroll } from '../../../services/localPayroll'
import { localProjectExpenses } from '../../../services/localProjectExpenses'
import { localProjectDocuments } from '../../../services/localProjectDocuments'
import useRole from '../../../hooks/useRole'
import useAuth from '../../../hooks/useAuth'
import { ROLE } from '../../../constants/roles'
import BudgetPlanPanel from './BudgetPlanPanel'
import { ExpensePanel } from './MonthlyPlanPanel'
import ProjectDocumentsPanel from './ProjectDocumentsPanel'
import ReportBuilderPanel from './ReportBuilderPanel'
import DeleteProjectConfirmModal from './DeleteProjectConfirmModal'
import GstBillsPage from '../../ems/finance/GstBillsPage'

// ─── Budget helpers ────────────────────────────────────────────────────────────
const fmtShort = (n) => {
  if (!n && n !== 0) return '—'
  if (Math.abs(n) >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`
  if (Math.abs(n) >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

const formatMonth = (m) => {
  if (!m) return '—'
  try {
    const [y, mo] = m.split('-')
    return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
  } catch {
    return m
  }
}

const RECURRING_TYPES = [
  { value: 'electricity', label: '⚡ Electricity' },
  { value: 'water', label: '💧 Water' },
  { value: 'internet', label: '🌐 Internet' },
  { value: 'other', label: '📦 Other' },
]

// ── Expense Card ──────────────────────────────────────────────────────────────
const ExpenseCard = ({
  title,
  color,
  budget,
  expenses,
  isAdmin,
  projectId,
  onAdd,
  onRemove,
  onEdit,
  isReadOnly = false,
}) => {
  const [form, setForm] = useState({
    label: '',
    amount: '',
    date: '',
    notes: '',
    is_recurring: false,
    recurring_type: 'electricity',
  })
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})

  const totalUsed = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
  const remaining = (budget || 0) - totalUsed
  const pct = budget > 0 ? Math.round((totalUsed / budget) * 100) : 0

  const suggestion = useMemo(() => {
    if (!isAdmin || !form.is_recurring || !form.recurring_type) return null
    return localPayroll.suggestRecurringAmount(projectId, form.recurring_type)
  }, [isAdmin, form.is_recurring, form.recurring_type, projectId])

  const handleAdd = () => {
    if (!form.label || !form.amount) return
    onAdd({ ...form, amount: parseFloat(form.amount) })
    setForm({
      label: '',
      amount: '',
      date: '',
      notes: '',
      is_recurring: false,
      recurring_type: 'electricity',
    })
    setAdding(false)
  }

  const startEdit = (exp) => {
    setEditId(exp.id)
    setEditForm({ ...exp })
  }
  const handleEditSave = () => {
    onEdit(editId, editForm)
    setEditId(null)
  }

  const fmtIN = (n) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n || 0)
  const fmtDate = (d) =>
    d
      ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : ''

  // Separate org-level (EMS vendor ledger), project-actual (EMS Project
  // Expenses tab), and project-specific (added directly in this card) expenses
  const orgExpenses = expenses.filter((e) => e.source === 'hr_admin')
  const actualExpenses = expenses.filter((e) => e.source === 'project_actual')
  const projExpenses = expenses.filter(
    (e) => e.source !== 'hr_admin' && e.source !== 'project_actual',
  )

  return (
    <CCard className="shadow-sm h-100">
      <CCardHeader
        className={`bg-transparent fw-semibold pt-3 border-start border-4 border-start-${color}`}
      >
        {title}
      </CCardHeader>
      <CCardBody className="d-flex flex-column">
        <div className="mb-3">
          <div className="d-flex justify-content-between small text-body-secondary mb-1">
            <span>Used: {fmtShort(totalUsed)}</span>
            <span>Budget: {fmtShort(budget)}</span>
          </div>
          <CProgress
            value={Math.min(pct, 100)}
            color={pct > 90 ? 'danger' : pct > 70 ? 'warning' : color}
            height={6}
          />
          <div
            className={`small fw-semibold mt-1 ${remaining < 0 ? 'text-danger' : 'text-success'}`}
          >
            {remaining >= 0
              ? `${fmtShort(remaining)} remaining`
              : `${fmtShort(Math.abs(remaining))} over budget`}
          </div>
        </div>

        {/* ── Org-level HR Admin expenses (synced from EMS) ── */}
        {orgExpenses.length > 0 && (
          <div className="mb-3">
            <div className="d-flex align-items-center gap-2 mb-2">
              <span
                className="small fw-semibold text-body-secondary text-uppercase"
                style={{ fontSize: '0.68rem', letterSpacing: '0.04em' }}
              >
                HR Admin (Org-level)
              </span>
              <CBadge color="warning" textColor="dark" style={{ fontSize: '0.6rem' }}>
                Synced from EMS
              </CBadge>
            </div>
            <div className="d-flex flex-column gap-2">
              {orgExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="d-flex align-items-start justify-content-between border rounded px-3 py-2"
                  style={{
                    background: 'rgba(247,201,72,0.06)',
                    borderColor: 'rgba(247,201,72,0.3) !important',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="fw-semibold small d-flex align-items-center gap-1 flex-wrap">
                      {exp.expense_category}
                      <span className="text-body-secondary fw-normal">— {exp.vendor_name}</span>
                      <CBadge color="secondary" style={{ fontSize: '0.58rem' }}>
                        {exp.frequency}
                      </CBadge>
                    </div>
                    <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                      Monthly: {fmtShort(exp.amount)} · Annual: {fmtShort(exp.annual_amount)}
                    </div>
                  </div>
                  <span className="fw-bold small ms-2 text-nowrap">{fmtShort(exp.amount)}/mo</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Project-actual expenses (logged via EMS Project Expenses tab) ── */}
        {actualExpenses.length > 0 && (
          <div className="mb-3">
            <div className="d-flex align-items-center gap-2 mb-2">
              <span
                className="small fw-semibold text-body-secondary text-uppercase"
                style={{ fontSize: '0.68rem', letterSpacing: '0.04em' }}
              >
                Project Actual
              </span>
              <CBadge color="info" style={{ fontSize: '0.6rem' }}>
                Logged via EMS
              </CBadge>
            </div>
            <div className="d-flex flex-column gap-2">
              {actualExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="d-flex align-items-start justify-content-between border rounded px-3 py-2"
                  style={{
                    background: 'rgba(13,110,253,0.06)',
                    borderColor: 'rgba(13,110,253,0.3) !important',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="fw-semibold small">{exp.label}</div>
                    <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                      {fmtDate(exp.date)}
                      {exp.notes && ` · ${exp.notes}`}
                    </div>
                  </div>
                  <span className="fw-bold small ms-2 text-nowrap">{fmtShort(exp.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Project-specific expenses ── */}
        {projExpenses.length > 0 && (
          <div className="mb-3">
            {orgExpenses.length > 0 && (
              <div
                className="small fw-semibold text-body-secondary text-uppercase mb-2"
                style={{ fontSize: '0.68rem', letterSpacing: '0.04em' }}
              >
                Project-Specific
              </div>
            )}
            <div className="d-flex flex-column gap-2">
              {projExpenses.map((exp) =>
                editId === exp.id ? (
                  <div key={exp.id} className="border rounded p-2 bg-body-secondary">
                    <CRow className="g-1 mb-1">
                      <CCol xs={12} md={5}>
                        <CFormInput
                          size="sm"
                          placeholder="Label"
                          value={editForm.label}
                          onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                        />
                      </CCol>
                      <CCol xs={6} md={3}>
                        <CInputGroup size="sm">
                          <CInputGroupText>₹</CInputGroupText>
                          <CFormInput
                            type="number"
                            value={editForm.amount}
                            onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                          />
                        </CInputGroup>
                      </CCol>
                      <CCol xs={6} md={4}>
                        <CFormInput
                          size="sm"
                          type="date"
                          value={editForm.date}
                          onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                        />
                      </CCol>
                      {isAdmin && (
                        <CCol xs={12}>
                          <div className="d-flex align-items-center gap-2 mt-1">
                            <CFormCheck
                              label="Recurring"
                              checked={!!editForm.is_recurring}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, is_recurring: e.target.checked }))
                              }
                            />
                            {editForm.is_recurring && (
                              <CFormSelect
                                size="sm"
                                value={editForm.recurring_type}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, recurring_type: e.target.value }))
                                }
                                style={{ maxWidth: 140 }}
                              >
                                {RECURRING_TYPES.map((r) => (
                                  <option key={r.value} value={r.value}>
                                    {r.label}
                                  </option>
                                ))}
                              </CFormSelect>
                            )}
                          </div>
                        </CCol>
                      )}
                    </CRow>
                    <div className="d-flex gap-1">
                      <CButton size="sm" color="primary" onClick={handleEditSave}>
                        Save
                      </CButton>
                      <CButton
                        size="sm"
                        color="secondary"
                        variant="ghost"
                        onClick={() => setEditId(null)}
                      >
                        Cancel
                      </CButton>
                    </div>
                  </div>
                ) : (
                  <div
                    key={exp.id}
                    className="d-flex align-items-start justify-content-between border rounded px-3 py-2"
                  >
                    <div>
                      <div className="fw-semibold small">
                        {exp.label}
                        {exp.is_recurring && (
                          <CBadge color="info" className="ms-2" style={{ fontSize: '0.65rem' }}>
                            {RECURRING_TYPES.find((r) => r.value === exp.recurring_type)?.label ||
                              'Recurring'}
                          </CBadge>
                        )}
                      </div>
                      <div className="text-body-secondary" style={{ fontSize: '0.75rem' }}>
                        {fmtDate(exp.date)}
                        {exp.notes && ` · ${exp.notes}`}
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="fw-bold small">{fmtShort(exp.amount || exp.myAmount)}</span>
                      {!isReadOnly && (
                        <>
                          <CButton
                            color="secondary"
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(exp)}
                          >
                            <CIcon icon={cilPencil} size="sm" />
                          </CButton>
                          <CButton
                            color="danger"
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemove(exp.id)}
                          >
                            <CIcon icon={cilTrash} size="sm" />
                          </CButton>
                        </>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {expenses.length === 0 && (
          <div className="text-center text-body-tertiary small py-3">No expenses added yet.</div>
        )}

        {adding ? (
          <div className="border rounded p-2 bg-body-secondary mt-auto">
            <CRow className="g-1 mb-1">
              <CCol xs={12} md={5}>
                <CFormInput
                  size="sm"
                  placeholder="Expense label *"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                />
              </CCol>
              <CCol xs={6} md={3}>
                <CInputGroup size="sm">
                  <CInputGroupText>₹</CInputGroupText>
                  <CFormInput
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                </CInputGroup>
              </CCol>
              <CCol xs={6} md={4}>
                <CFormInput
                  size="sm"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </CCol>
              <CCol xs={12}>
                <CFormInput
                  size="sm"
                  placeholder="Notes (optional)"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </CCol>
              {isAdmin && (
                <CCol xs={12}>
                  <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
                    <CFormCheck
                      label="Recurring / Fixed expense"
                      checked={form.is_recurring}
                      onChange={(e) => setForm((f) => ({ ...f, is_recurring: e.target.checked }))}
                    />
                    {form.is_recurring && (
                      <CFormSelect
                        size="sm"
                        value={form.recurring_type}
                        onChange={(e) => setForm((f) => ({ ...f, recurring_type: e.target.value }))}
                        style={{ maxWidth: 150 }}
                      >
                        {RECURRING_TYPES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </CFormSelect>
                    )}
                  </div>
                  {form.is_recurring && suggestion?.suggested && (
                    <div className="small text-info mt-1 d-flex align-items-center gap-2">
                      💡 Previous: ₹{suggestion.prevAmount?.toLocaleString('en-IN')} → Suggested: ₹
                      {suggestion.suggested?.toLocaleString('en-IN')} (+5%)
                      <CButton
                        size="sm"
                        color="info"
                        variant="ghost"
                        style={{ padding: '0 6px' }}
                        onClick={() =>
                          setForm((f) => ({ ...f, amount: String(suggestion.suggested) }))
                        }
                      >
                        Use
                      </CButton>
                    </div>
                  )}
                </CCol>
              )}
            </CRow>
            <div className="d-flex gap-1 mt-1">
              <CButton size="sm" color="primary" onClick={handleAdd}>
                Add
              </CButton>
              <CButton size="sm" color="secondary" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </CButton>
            </div>
          </div>
        ) : !isReadOnly ? (
          <CButton
            size="sm"
            color={color}
            variant="outline"
            className="mt-auto"
            onClick={() => setAdding(true)}
          >
            <CIcon icon={cilPlus} className="me-1" />
            Add Expense
          </CButton>
        ) : null}
      </CCardBody>
    </CCard>
  )
}

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

const STATUS_META = {
  pipeline: { label: 'Pipeline', color: 'secondary' },
  approved: { label: 'Approved', color: 'info' },
  ongoing: { label: 'Ongoing', color: 'primary' },
  completed: { label: 'Completed', color: 'success' },
}

// Demo pending approval items
const DEMO_APPROVALS = [
  {
    id: 'apr_1',
    type: 'Procurement',
    title: 'Purchase of 50 PVC pipes — 6 inch',
    submittedBy: 'Arjun Sharma',
    submittedAt: '2024-12-10',
    amount: 48500,
    status: 'pending',
  },
  {
    id: 'apr_2',
    type: 'Task Expense',
    title: 'Labour charges — Pipeline excavation (Week 2)',
    submittedBy: 'Arjun Sharma',
    submittedAt: '2024-12-08',
    amount: 32000,
    status: 'pending',
  },
]

const DEMO_TASKS = [
  {
    title: 'Site survey & soil testing',
    status: 'completed',
    assignee: 'Field Team A',
    target_date: '2024-04-01',
    actual_date: '2024-04-05',
  },
  {
    title: 'Pipeline route mapping',
    status: 'completed',
    assignee: 'Arjun Sharma',
    target_date: '2024-04-15',
    actual_date: '2024-04-12',
  },
  {
    title: 'Procurement of pipes & fittings',
    status: 'completed',
    assignee: 'Procurement Team',
    target_date: '2024-05-10',
    actual_date: '2024-05-10',
  },
  {
    title: 'Excavation — Phase 1 (Villages 1–4)',
    status: 'completed',
    assignee: 'Field Team A',
    target_date: '2024-06-01',
    actual_date: '2024-06-15',
  },
  {
    title: 'Excavation — Phase 2 (Villages 5–8)',
    status: 'completed',
    assignee: 'Field Team B',
    target_date: '2024-07-15',
    actual_date: '2024-07-10',
  },
  {
    title: 'Pipeline laying — Phase 1',
    status: 'active',
    assignee: 'Field Team A',
    target_date: '2024-09-01',
    actual_date: null,
  },
  {
    title: 'Storage tank construction',
    status: 'active',
    assignee: 'Civil Contractor',
    target_date: '2024-10-01',
    actual_date: null,
  },
  {
    title: 'Final commissioning & testing',
    status: 'active',
    assignee: 'Arjun Sharma',
    target_date: '2025-01-15',
    actual_date: null,
  },
]

const ProjectDetailPage = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [projectExpensesByPool, setProjectExpensesByPool] = useState({
    admin: [],
    hr: [],
    core: [],
  })
  const [activeTab, setActiveTab] = useState(0)
  const [approvals, setApprovals] = useState([])
  const [approveModal, setApproveModal] = useState({ visible: false, item: null })
  const [rejectModal, setRejectModal] = useState({ visible: false, item: null })
  const [ucModal, setUcModal] = useState({ visible: false, milestone: null })
  const [toast, setToast] = useState(null)
  // Activity tab: null = form closed; object with id = editing, without = adding
  const [activityForm, setActivityForm] = useState(null)
  const [savingActivity, setSavingActivity] = useState(false)
  // Expanded milestone checklists in the Project Milestones tab
  const [expandedMilestones, setExpandedMilestones] = useState({})
  // Beneficiaries state
  const [beneficiariesCompleted, setBeneficiariesCompleted] = useState('')
  const [deleteModal, setDeleteModal] = useState(false)

  // Activation state
  const [activateModal, setActivateModal] = useState(false)
  const [activating, setActivating] = useState(false)
  const [activationMonth, setActivationMonth] = useState('')

  const role = useRole()
  const { user } = useAuth()
  const canDelete =
    role === ROLE.PROJECT_OFFICER ||
    role === ROLE.PROJECT_ASSOCIATE ||
    role === ROLE.PROJECT_COORDINATOR

  // PA assignment — coordinator selects from dropdown, then clicks ✓ to confirm.
  // pendingPaId tracks the dropdown value before it is confirmed; null means
  // "same as what's currently saved" (no pending change).
  const [pendingPaId, setPendingPaId] = useState(null)
  const [paSaving, setPaSaving] = useState(false)

  const handleConfirmPaAssignment = async () => {
    if (paSaving) return
    setPaSaving(true)
    try {
      const updated = await localProjects.update(id, {
        project_associate_id: pendingPaId || null,
      })
      setProject(updated)
      setPendingPaId(null)
      const paName = paEmployeesList.find((pa) => pa.employee_id === pendingPaId)?.name || null
      setToast({
        color: 'success',
        message: paName ? `Project assigned to ${paName}` : 'Project Associate assignment cleared',
      })
    } catch (err) {
      setToast({ color: 'danger', message: err.message || 'Failed to update assignment' })
    } finally {
      setPaSaving(false)
    }
  }
  // Activation requires a completed monthly plan — the Project Officer
  // must plan the budget before it can go live. (Previously also required
  // a task to be assigned first, but that gate assumed active task
  // monitoring by field personnel, which doesn't happen in practice, so
  // it was removed — a project with a plan but zero tasks can activate.)
  const hasMonthlyPlan = Boolean(project?.monthly_plan?.length)
  const isBudgetAdmin = role === ROLE.CEO || role === ROLE.HR
  // PO ownership gate — resolves this Project Officer's own employees.id UUID
  // (the same id space project.officer_ids is stored in) so edit rights can
  // be scoped to projects they're actually assigned to.
  const [poUuid, setPoUuid] = useState('')
  useEffect(() => {
    if (role !== ROLE.PROJECT_OFFICER) return
    let cancelled = false
    localProjects.resolveEmployeeUuidByCode(user?.employee_id).then((uuid) => {
      if (!cancelled) setPoUuid(uuid || '')
    })
    return () => {
      cancelled = true
    }
  }, [role, user?.employee_id])
  // A Project Officer's edit rights are scoped to projects they're actually
  // assigned to (project.officer_ids / legacy officer_id), the same way a
  // Project Associate is scoped to their own specialization/assignment a
  // few lines up — otherwise any PO could open any other PO's project by
  // URL and edit its budget plan.
  const poOwnsProject =
    !!poUuid && (project?.officer_ids?.includes(poUuid) || project?.officer_id === poUuid)
  // Monthly budget planning is specifically the Project Officer's/Project
  // Associate's/Coordinator's job (spec) — they need Monthly Plan tab edit
  // access too, in addition to (not instead of) everything isBudgetAdmin
  // already covers.
  const canEditMonthlyPlan =
    isBudgetAdmin ||
    (role === ROLE.PROJECT_OFFICER && poOwnsProject) ||
    role === ROLE.PROJECT_ASSOCIATE ||
    role === ROLE.PROJECT_COORDINATOR
  // Activity log is specifically a PO/PA/Coordinator responsibility — no
  // isBudgetAdmin carve-out, matching what was asked for.
  const canEditActivity =
    (role === ROLE.PROJECT_OFFICER && poOwnsProject) ||
    role === ROLE.PROJECT_ASSOCIATE ||
    role === ROLE.PROJECT_COORDINATOR

  useEffect(() => {
    let cancelled = false
    localProjects.seedDemoData()
    localProjects.getById(id).then((p) => {
      if (cancelled) return
      setProject(p)
      if (p) {
        setBeneficiariesCompleted(p.beneficiaries_completed || 0)
      }
      // Load approvals only for projects that have pending ones
      if (p && p.pending_approvals > 0) {
        setApprovals(DEMO_APPROVALS)
      }
    })
    return () => {
      cancelled = true
    }
  }, [id])
  // Sync when another component (e.g. EMS pool page, ExpensePanel) mutates
  // the project record in localStorage and fires hma_projects_changed.
  // Also listens to the native `storage` event so changes made in ANOTHER
  // browser tab (same origin) are reflected here automatically.
  useEffect(() => {
    let cancelled = false
    const handleExternalChange = () => {
      localProjects.getById(id).then((fresh) => {
        if (!cancelled && fresh) setProject(fresh)
      })
    }
    // Fires in the same tab (dispatched by localProjects.notify())
    window.addEventListener('hma_projects_changed', handleExternalChange)
    // Fires in OTHER tabs whenever localStorage is written
    const handleStorageEvent = (e) => {
      if (e.key === 'hma_projects_sync_at') handleExternalChange()
    }
    window.addEventListener('storage', handleStorageEvent)
    return () => {
      cancelled = true
      window.removeEventListener('hma_projects_changed', handleExternalChange)
      window.removeEventListener('storage', handleStorageEvent)
    }
  }, [id])
  // PA specialization gate — resolved async now that getPaSpecialization hits Supabase.
  const [paSpecialization, setPaSpecialization] = useState(null)
  const [paUuid, setPaUuid] = useState('')
  useEffect(() => {
    if (role !== ROLE.PROJECT_ASSOCIATE) return
    let cancelled = false
    Promise.all([
      localProjects.getPaSpecialization(user?.employee_id),
      localProjects.resolveEmployeeUuidByCode(user?.employee_id),
    ]).then(([spec, uuid]) => {
      if (cancelled) return
      setPaSpecialization(spec)
      setPaUuid(uuid || '')
    })
    return () => {
      cancelled = true
    }
  }, [role, user?.employee_id])
  // PA employees for the Project Coordinator's reassignment dropdown.
  const [paEmployeesList, setPaEmployeesList] = useState([])
  useEffect(() => {
    if (role !== ROLE.PROJECT_COORDINATOR) return
    let cancelled = false
    localProjects.listPaEmployees().then((list) => {
      if (!cancelled) setPaEmployeesList(list || [])
    })
    return () => {
      cancelled = true
    }
  }, [role])
  // Resolve assigned officer objects (officer_ids[] / legacy officer_id) for the Officer(s) tab.
  const [officerObjects, setOfficerObjects] = useState([])
  useEffect(() => {
    const officerIds = project?.officer_ids?.length
      ? project.officer_ids
      : project?.officer_id
        ? [project.officer_id]
        : []
    let cancelled = false
    Promise.all(officerIds.map((oid) => localOfficers.getById(oid))).then((results) => {
      if (!cancelled) setOfficerObjects(results.filter(Boolean))
    })
    return () => {
      cancelled = true
    }
  }, [project?.officer_ids, project?.officer_id])

  // Logged actual expenses (Budget & Payroll tab) for this project, one list
  // per pool — mapped to the report-row shape poolExpensesFor used to build
  // synchronously before this store moved to Supabase.
  useEffect(() => {
    if (!project?.id) return
    let cancelled = false
    Promise.all(
      ['admin', 'hr', 'core'].map((pool) =>
        localProjectExpenses.list({ projectId: project.id, pool }).then((rows) =>
          rows.map((e) => ({
            id: e.id,
            label: e.label,
            amount: e.amount,
            date: e.createdAt,
            notes: `Logged by ${e.createdBy}`,
            source: 'project_actual',
          })),
        ),
      ),
    ).then(([admin, hr, core]) => {
      if (!cancelled) setProjectExpensesByPool({ admin, hr, core })
    })
    return () => {
      cancelled = true
    }
  }, [project?.id])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const fresh = await localProjects.getById(id)
      if (fresh) setProject(fresh)
    } finally {
      setRefreshing(false)
    }
  }

  if (!project) {
    return (
      <>
        <div style={{ fontSize: '4rem' }}>🔍</div>
        <h5 className="text-body-secondary">Project not found</h5>
        <CButton color="primary" variant="outline" onClick={() => navigate('/pms/projects')}>
          Back to Projects
        </CButton>
      </>
    )
  }

  // Guard: a Project Associate can only view projects matching their fixed
  // specialization (Community Development vs Public Health), OR a project
  // that the Coordinator explicitly assigned to them (by UUID). The Project
  // Coordinator oversees both specializations and bypasses this entirely.
  if (role === ROLE.PROJECT_ASSOCIATE && paSpecialization !== null) {
    const explicitlyAssigned = paUuid && project.project_associate_id === paUuid
    const matchesSpecialization =
      paSpecialization &&
      localProjects.specializationMatchesProjectType(paSpecialization, project.project_type)
    if (!explicitlyAssigned && !matchesSpecialization) {
      return (
        <>
          <CButton
            color="secondary"
            variant="ghost"
            size="sm"
            className="mb-3"
            onClick={() => navigate('/pms/projects')}
          >
            <CIcon icon={cilArrowLeft} className="me-1" />
            All Projects
          </CButton>
          <div className="text-center py-5">
            <div style={{ fontSize: '4rem' }}>🔒</div>
            <h5 className="fw-bold mt-3">Access Restricted</h5>
            <p className="text-body-secondary">
              This project belongs to a different specialization than the one assigned to you.
            </p>
            <CButton color="primary" onClick={() => navigate('/pms/projects')}>
              View My Projects
            </CButton>
          </div>
        </>
      )
    }
  }

  const receivedPct =
    project.project_value > 0
      ? Math.round((project.amount_received / project.project_value) * 100)
      : 0
  const sm = STATUS_META[project.status] || { label: project.status, color: 'secondary' }

  let ucAlert = null
  const pendingUcs =
    project.installments?.filter(
      (i) => i.uc_status !== 'Approved' && i.uc_status !== 'Submitted',
    ) || []
  if (pendingUcs.length > 0) {
    let overdue = 0
    let dueSoon = 0
    pendingUcs.forEach((inst) => {
      // Prefer the dedicated uc_target_date; fall back to end_date/target_date
      const tStr = inst.uc_target_date || inst.end_date || inst.target_date
      if (!tStr) return
      const [ty, tm, td] = tStr.split('-').map(Number)
      const target = new Date(ty, tm - 1, td)
      const now = new Date()
      target.setHours(0, 0, 0, 0)
      now.setHours(0, 0, 0, 0)
      const diff = Math.ceil((now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24))
      if (diff > 0) overdue++
      else if (diff >= -7) dueSoon++
    })
    if (overdue > 0) ucAlert = { color: 'danger', text: `⚠️ ${overdue} UC(s) Overdue` }
    else if (dueSoon > 0) ucAlert = { color: 'warning', text: `⏳ ${dueSoon} UC(s) Due Soon` }
  }

  const handleApprove = (item) => {
    setApprovals((prev) => prev.map((a) => (a.id === item.id ? { ...a, status: 'approved' } : a)))
    setApproveModal({ visible: false, item: null })
    setToast({ color: 'success', message: 'Approval granted successfully' })
  }

  const handleReject = (item) => {
    setApprovals((prev) => prev.map((a) => (a.id === item.id ? { ...a, status: 'rejected' } : a)))
    setRejectModal({ visible: false, item: null })
    setToast({ color: 'danger', message: 'Request rejected and sent back' })
  }

  const handleSubmitUc = async (inst) => {
    const fileInput = document.querySelector('#uc-file-input')
    const file = fileInput?.files?.[0]
    if (!file) {
      alert('Please select a UC document (PDF) to upload.')
      return
    }

    const actualDate = new Date().toISOString().split('T')[0]
    
    // Find or add UC checklist item
    const updatedChecklist = [...(inst.documents_checklist || [])]
    const ucIdx = updatedChecklist.findIndex(
      (d) => d.name.toLowerCase().includes('uc') || d.name.toLowerCase().includes('utili')
    )
    if (ucIdx !== -1) {
      updatedChecklist[ucIdx] = {
        ...updatedChecklist[ucIdx],
        checked: true,
        file_name: file.name,
        uploaded_at: new Date().toISOString(),
      }
    } else {
      updatedChecklist.push({
        name: 'Utilization Certificate (UC)',
        checked: true,
        file_name: file.name,
        uploaded_at: new Date().toISOString(),
      })
    }

    const updated = await localProjects.updateInstallment(project.id, inst.id, {
      uc_status: 'Submitted',
      actual_date: actualDate,
      actual_uc_submission_date: actualDate,
      documents_checklist: updatedChecklist,
    })
    setProject(updated)
    setUcModal({ visible: false, milestone: null })
    setToast({ color: 'success', message: 'Utilisation Certificate submitted' })
  }

  const handleUpdateBeneficiaries = async () => {
    const val = parseInt(beneficiariesCompleted, 10) || 0
    const updated = await localProjects.update(project.id, { beneficiaries_completed: val })
    setProject(updated)
    setToast({ color: 'success', message: 'Beneficiaries count updated' })
  }

  const handleDeleteConfirm = async () => {
    try {
      await localProjects.remove(project.id)
    } catch (err) {
      setToast({ color: 'danger', message: err.message || 'Failed to delete project' })
      return
    }
    navigate('/pms/projects')
  }

  const handleActivateConfirm = async () => {
    if (!activationMonth) {
      setToast({ color: 'danger', message: 'Please select an activation month.' })
      return
    }
    setActivating(true)
    try {
      const updated = await localProjects.activateProject(project.id, activationMonth)
      setProject(updated)
      setActivateModal(false)
      setToast({
        color: 'success',
        message: `Project activated from ${activationMonth}. HR/Core budgets now live in EMS.`,
      })
    } catch (err) {
      setToast({ color: 'danger', message: err.message || 'Failed to activate project' })
    } finally {
      setActivating(false)
    }
  }

  const handleDeactivate = async () => {
    setActivating(true)
    try {
      const updated = await localProjects.deactivateProject(project.id)
      setProject(updated)
      setToast({ color: 'warning', message: 'Project deactivated. HR/Core budgets frozen.' })
    } catch (err) {
      setToast({ color: 'danger', message: err.message || 'Failed to deactivate project' })
    } finally {
      setActivating(false)
    }
  }

  const openAddActivity = () =>
    setActivityForm({
      id: null,
      description: '',
      target_date: '',
      risk_challenges: '',
      status: 'pending',
    })
  const openEditActivity = (a) =>
    setActivityForm({
      id: a.id,
      description: a.description || '',
      target_date: a.target_date || '',
      risk_challenges: a.risk_challenges || '',
      status: a.status || 'pending',
    })

  const handleSaveActivity = async () => {
    if (!activityForm.description.trim()) {
      setToast({ color: 'danger', message: 'Activity description is required' })
      return
    }
    setSavingActivity(true)
    try {
      const updated = activityForm.id
        ? await localProjects.updateActivity(project.id, activityForm.id, activityForm)
        : await localProjects.addActivity(project.id, activityForm)
      setProject(updated)
      setActivityForm(null)
      setToast({
        color: 'success',
        message: activityForm.id ? 'Activity updated' : 'Activity added',
      })
    } catch (err) {
      setToast({ color: 'danger', message: err.message || 'Failed to save activity' })
    } finally {
      setSavingActivity(false)
    }
  }

  const activityStatusMeta = (a) => {
    if (a.status === 'completed') return { label: 'Completed', color: 'success' }
    if (a.status === 'ongoing') return { label: 'Ongoing', color: 'warning' }
    if (a.target_date && new Date(a.target_date) < new Date(new Date().toDateString())) {
      return { label: 'Overdue', color: 'danger' }
    }
    return { label: 'Upcoming', color: 'info' }
  }

  return (
    <>
      {/* Back + Refresh */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <CButton
          color="secondary"
          variant="ghost"
          size="sm"
          onClick={() => navigate('/pms/projects')}
        >
          <CIcon icon={cilArrowLeft} className="me-1" />
          All Projects
        </CButton>
        <CButton
          color="secondary"
          variant="ghost"
          size="sm"
          title="Refresh project"
          disabled={refreshing}
          onClick={handleRefresh}
        >
          {refreshing ? <CSpinner size="sm" /> : <CIcon icon={cilReload} size="sm" />}
        </CButton>
      </div>

      {/* Hero banner */}
      <div
        className="rounded-4 mb-4 p-4 text-white position-relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)' }}
      >
        <div
          className="position-absolute end-0 top-0 opacity-10"
          style={{ fontSize: '8rem', lineHeight: 1 }}
        >
          🏗️
        </div>
        <div className="position-relative d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="d-flex align-items-center gap-2 mb-1">
              <CBadge color={sm.color} shape="rounded-pill" className="px-2">
                {sm.label}
              </CBadge>
              <CBadge color="light" className="text-dark px-2 text-capitalize">
                {project.phase}
              </CBadge>
            </div>
            <h4 className="fw-bold mb-2">{project.name}</h4>
            <div className="d-flex flex-wrap gap-3 opacity-75 small">
              <span>
                <CIcon icon={cilLocationPin} className="me-1" />
                {project.location}
              </span>
              <span>
                <CIcon icon={cilBuilding} className="me-1" />
                {project.funding_agency}
              </span>
              <span>
                <CIcon icon={cilCalendar} className="me-1" />
                {fmtDate(project.start_date)} → {fmtDate(project.end_date)}
              </span>
            </div>
            {role === ROLE.PROJECT_COORDINATOR && (
              <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
                <span className="small opacity-75">Responsible PA</span>
                <CFormSelect
                  size="sm"
                  style={{ width: 'auto', minWidth: '170px' }}
                  value={pendingPaId !== null ? pendingPaId : project.project_associate_id || ''}
                  onChange={(e) => setPendingPaId(e.target.value)}
                >
                  <option value="">— Unassigned —</option>
                  {paEmployeesList.map((pa) => (
                    <option key={pa.employee_id} value={pa.employee_id}>
                      {pa.name}
                    </option>
                  ))}
                </CFormSelect>
                {/* Confirm button — only shown when the selection differs from saved value */}
                {pendingPaId !== null && pendingPaId !== (project.project_associate_id || '') && (
                  <CButton
                    size="sm"
                    color="success"
                    title="Confirm assignment"
                    disabled={paSaving}
                    onClick={handleConfirmPaAssignment}
                    style={{
                      borderRadius: '50%',
                      width: 30,
                      height: 30,
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {paSaving ? (
                      <CSpinner size="sm" />
                    ) : (
                      <CIcon icon={cilCheck} style={{ width: 14, height: 14 }} />
                    )}
                  </CButton>
                )}
                {/* Current assignment badge */}
                {pendingPaId === null && project.project_associate_name && (
                  <span
                    className="badge rounded-pill"
                    style={{ background: 'rgba(255,255,255,0.25)', fontSize: '0.72rem' }}
                  >
                    ✓ {project.project_associate_name}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="d-flex gap-2 flex-shrink-0 flex-wrap">
            {/* Activate / Deactivate Project */}
            {canEditMonthlyPlan && hasMonthlyPlan && !project.operations_activated_month && (
              <CButton
                color="success"
                className="fw-semibold"
                onClick={() => {
                  setActivationMonth(new Date().toISOString().slice(0, 7))
                  setActivateModal(true)
                }}
              >
                <CIcon icon={cilCheckCircle} className="me-1" />
                Activate Project
              </CButton>
            )}
            {isBudgetAdmin && project.operations_activated_month && (
              <CButton
                color="light"
                className="text-warning fw-semibold"
                onClick={handleDeactivate}
                disabled={activating}
                title="Freeze HR/Core budgets"
              >
                <CIcon icon={cilXCircle} className="me-1" />
                Deactivate
              </CButton>
            )}
            <CButton
              color="light"
              className="text-primary fw-semibold"
              onClick={() => navigate(`/pms/projects/${id}/edit`)}
            >
              <CIcon icon={cilPen} className="me-1" />
              Edit Project
            </CButton>
            {canDelete && (
              <CButton
                color="light"
                className="text-danger fw-semibold"
                onClick={() => setDeleteModal(true)}
              >
                <CIcon icon={cilTrash} className="me-1" />
                Delete Project
              </CButton>
            )}
          </div>
          {ucAlert && (
            <CBadge
              color={ucAlert.color}
              className={`px-3 py-2 d-flex align-items-center ${ucAlert.color === 'warning' ? 'text-dark' : 'text-white'}`}
              style={{ fontSize: '0.8rem' }}
            >
              {ucAlert.text}
            </CBadge>
          )}
          {project.operations_activated_month && (
            <CBadge
              color="success"
              className="px-3 py-2 d-flex align-items-center"
              style={{ fontSize: '0.8rem' }}
            >
              <CIcon icon={cilCheckCircle} className="me-1" style={{ width: 12, height: 12 }} />
              HR/Core Active from {formatMonth(project.operations_activated_month)}
            </CBadge>
          )}
          {!project.operations_activated_month && hasMonthlyPlan && (
            <CBadge
              color="warning"
              className="px-3 py-2 d-flex align-items-center text-dark"
              style={{ fontSize: '0.8rem' }}
            >
              HR/Core Frozen — Not Activated
            </CBadge>
          )}
        </div>
      </div>

      {/* KPI row */}
      <CRow className="g-3 mb-4">
        {/* Left Column */}
        <CCol xs={12} md={6}>
          <div className="d-flex flex-column gap-3 h-100">
            {[
              {
                label: 'Project Value',
                value: fmt(project.project_value),
                color: '#4361ee',
                bg: 'rgba(67,97,238,0.06)',
              },
              {
                label: 'Beneficiaries Reached',
                value: `${project.beneficiaries_completed?.toLocaleString('en-IN') || 0} / ${project.beneficiaries_target?.toLocaleString('en-IN') || 0}`,
                sub: 'Completed vs Target',
                color: '#f72585',
                bg: 'rgba(247,37,133,0.06)',
                isBeneficiaries: true,
              },
            ].map((kpi, i) => (
              <CCard
                key={i}
                className="border-0 shadow-sm flex-grow-1"
                style={{ borderRadius: '12px' }}
              >
                <CCardBody className="py-3">
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="fw-bold fs-5 lh-1 mb-1" style={{ color: kpi.color }}>
                      {kpi.value}
                    </div>
                  </div>
                  <div className="fw-semibold small text-body">{kpi.label}</div>
                  <div className="text-body-secondary mb-2" style={{ fontSize: '0.72rem' }}>
                    {kpi.sub}
                  </div>
                  {kpi.isBeneficiaries && (
                    <div className="d-flex align-items-center gap-2 mt-2 pt-2 border-top">
                      <CFormInput
                        type="number"
                        size="sm"
                        style={{ width: '90px', fontSize: '0.75rem' }}
                        value={beneficiariesCompleted}
                        onChange={(e) => setBeneficiariesCompleted(e.target.value)}
                        placeholder="Completed"
                      />
                      <CButton
                        size="sm"
                        color="danger"
                        variant="outline"
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                        onClick={handleUpdateBeneficiaries}
                      >
                        Save
                      </CButton>
                    </div>
                  )}
                </CCardBody>
              </CCard>
            ))}
          </div>
        </CCol>

        {/* Right Column */}
        <CCol xs={12} md={6}>
          <div className="d-flex flex-column gap-3 h-100">
            {[
              {
                label: 'Amount Received',
                value: fmt(project.amount_received),
                sub: `${receivedPct}% of total`,
                color: '#2ec4b6',
                bg: 'rgba(46,196,182,0.06)',
              },
              {
                label: 'Amount Spent',
                value: fmt(project.amount_spent),
                sub: `Balance: ${fmt(project.amount_received - project.amount_spent)}`,
                color: '#f77f00',
                bg: 'rgba(247,127,0,0.06)',
              },
            ].map((kpi, i) => (
              <CCard
                key={i}
                className="border-0 shadow-sm flex-grow-1"
                style={{ borderRadius: '12px' }}
              >
                <CCardBody className="py-3">
                  <div className="fw-bold fs-5 lh-1 mb-1" style={{ color: kpi.color }}>
                    {kpi.value}
                  </div>
                  <div className="fw-semibold small text-body">{kpi.label}</div>
                  <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                    {kpi.sub}
                  </div>
                </CCardBody>
              </CCard>
            ))}
          </div>
        </CCol>
      </CRow>

      <CCard className="border-0 shadow-sm" style={{ borderRadius: '12px' }}>
        <CCardHeader className="bg-transparent border-bottom-0 px-4 pt-3">
          <CNav variant="underline" role="tablist">
            {[
              'Overview',
              'Project Officer',
              'Activity',
              'Approvals',
              'Project Financials',
              'Project Milestones',
              'Budget & Payroll',
              'Monthly Plan',
              'Expense',
              'Upload',
              'Report',
            ].map((tab, i) =>
              // Approvals tab is demo-only (no real approval workflow beyond the
              // Project Officer's HR/Core/Admin pool release in Monthly Plan) —
              // kept out of the nav, not removed from the index-based tab array.
              tab === 'Approvals' ? null : (
                <CNavItem key={i}>
                  <CNavLink
                    active={activeTab === i}
                    onClick={() => setActiveTab(i)}
                    role="button"
                    className="fw-medium"
                  >
                    {tab}
                    {i === 4 && (
                      <CBadge
                        color={
                          project.project_value -
                            (project.expense_accounted || 0) -
                            (project.committed_expense || 0) >=
                          0
                            ? 'success'
                            : 'danger'
                        }
                        shape="rounded-pill"
                        className="ms-2"
                      >
                        {(() => {
                          const bal =
                            project.project_value -
                            (project.expense_accounted || 0) -
                            (project.committed_expense || 0)
                          return bal >= 0 ? '✓' : '!'
                        })()}
                      </CBadge>
                    )}
                  </CNavLink>
                </CNavItem>
              ),
            )}
          </CNav>
        </CCardHeader>

        <CCardBody className="bg-body-tertiary rounded-bottom-4 pt-4">
          <CTabContent>
            {/* Overview Tab */}
            <CTabPane visible={activeTab === 0}>
              <CRow className="g-3">
                <CCol xs={12} md={6}>
                  <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: '10px' }}>
                    <CCardBody>
                      <h6 className="fw-bold mb-3 text-body-secondary text-uppercase small">
                        Project Info
                      </h6>
                      {[
                        { label: 'Project Code', value: project.project_code },
                        { label: 'Project Type', value: project.project_type },
                        { label: 'Funding Agency', value: project.funding_agency },
                        { label: 'Implementing Partner', value: project.implementing_partner },
                        { label: 'Location', value: project.location },
                        { label: 'Project Start Date', value: fmtDate(project.start_date) },
                        { label: 'Project End Date', value: fmtDate(project.end_date) },
                        { label: 'Last Updated', value: fmtDate(project.updated_at) },
                      ].map((row, i) => (
                        <div
                          key={i}
                          className="d-flex justify-content-between py-2 border-bottom small"
                        >
                          <span className="text-body-secondary">{row.label}</span>
                          <span className="fw-medium">{row.value || '—'}</span>
                        </div>
                      ))}
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol xs={12} md={6}>
                  <CCard className="border-0 shadow-sm" style={{ borderRadius: '10px' }}>
                    <CCardBody>
                      <h6 className="fw-bold mb-3 text-body-secondary text-uppercase small">
                        Fund Utilization
                      </h6>
                      <div className="mb-3">
                        <div className="d-flex justify-content-between mb-1 small">
                          <span className="text-body-secondary">Received</span>
                          <span className="fw-semibold">{receivedPct}%</span>
                        </div>
                        <CProgress
                          value={receivedPct}
                          height={8}
                          color="success"
                          className="rounded-pill"
                        />
                      </div>
                      <div className="mb-3">
                        <div className="d-flex justify-content-between mb-1 small">
                          <span className="text-body-secondary">Spent</span>
                          <span className="fw-semibold">
                            {project.amount_received > 0
                              ? Math.round((project.amount_spent / project.amount_received) * 100)
                              : 0}
                            %
                          </span>
                        </div>
                        <CProgress
                          value={
                            project.amount_received > 0
                              ? Math.round((project.amount_spent / project.amount_received) * 100)
                              : 0
                          }
                          height={8}
                          color="primary"
                          className="rounded-pill"
                        />
                      </div>
                      {project.description && (
                        <>
                          <hr />
                          <h6 className="fw-semibold small mb-2">Description</h6>
                          <p className="text-body-secondary small mb-0">{project.description}</p>
                        </>
                      )}
                    </CCardBody>
                  </CCard>
                </CCol>
                {project.remarks && (
                  <CCol xs={12}>
                    <CCard className="border-0 shadow-sm" style={{ borderRadius: '10px' }}>
                      <CCardBody>
                        <h6 className="fw-bold mb-2 text-body-secondary text-uppercase small">
                          Remarks
                        </h6>
                        <p className="small mb-0">{project.remarks}</p>
                      </CCardBody>
                    </CCard>
                  </CCol>
                )}
                <CCol xs={12} md={6}>
                  <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: '10px' }}>
                    <CCardBody>
                      <h6 className="fw-bold mb-3 text-body-secondary text-uppercase small">
                        Notes
                      </h6>
                      {(project.notes || []).length === 0 ? (
                        <div className="text-body-secondary small fst-italic">No notes yet.</div>
                      ) : (
                        <div className="d-flex flex-column gap-2">
                          {project.notes.map((n) => (
                            <div key={n.id} className="small border-bottom pb-2">
                              <div>{n.note}</div>
                              <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                                {n.created_at
                                  ? new Date(n.created_at).toLocaleString('en-IN', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : ''}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol xs={12} md={6}>
                  <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: '10px' }}>
                    <CCardBody>
                      <h6 className="fw-bold mb-3 text-body-secondary text-uppercase small">
                        Field Personnel Details
                      </h6>
                      {(project.personnel_details || []).length === 0 ? (
                        <div className="text-body-secondary small fst-italic">
                          No field personnel added yet.
                        </div>
                      ) : (
                        <div className="d-flex flex-column gap-2">
                          {project.personnel_details.map((p) => (
                            <div
                              key={p.id}
                              className="d-flex justify-content-between py-2 border-bottom small"
                            >
                              <span className="fw-medium">{p.name || 'Unnamed'}</span>
                              <span className="text-body-secondary">
                                {[p.age && `Age ${p.age}`, p.phone].filter(Boolean).join(' · ') ||
                                  '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CCardBody>
                  </CCard>
                </CCol>
              </CRow>
            </CTabPane>

            {/* Project Officer(s) Tab */}
            <CTabPane visible={activeTab === 1}>
              {(() => {
                if (officerObjects.length === 0) {
                  return (
                    <CAlert color="warning" className="d-flex align-items-center gap-2">
                      <CIcon icon={cilWarning} />
                      No officer assigned.&nbsp;
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          navigate(`/pms/projects/${id}/edit`)
                        }}
                        className="fw-semibold"
                      >
                        Assign one now →
                      </a>
                    </CAlert>
                  )
                }

                return (
                  <div className="d-flex flex-column gap-3">
                    {officerObjects.map((officer, idx) => (
                      <CCard
                        key={officer.id}
                        className="border-0 shadow-sm"
                        style={{ borderRadius: '10px', maxWidth: '500px' }}
                      >
                        <CCardBody>
                          <div className="d-flex align-items-center gap-3 mb-3">
                            <div
                              className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold fs-4"
                              style={{ width: 56, height: 56, flexShrink: 0 }}
                            >
                              {officer.name?.charAt(0)}
                            </div>
                            <div>
                              <h6 className="fw-bold mb-0">{officer.name}</h6>
                              <div className="text-body-secondary small">Project Officer</div>
                              {idx === 0 && officerObjects.length > 1 && (
                                <CBadge
                                  color="primary"
                                  shape="rounded-pill"
                                  style={{ fontSize: '0.6rem' }}
                                >
                                  Primary
                                </CBadge>
                              )}
                            </div>
                          </div>
                          {[{ icon: cilEnvelopeLetter, label: officer.email }].map((row, i) => (
                            <div key={i} className="d-flex align-items-center gap-2 mb-2 small">
                              <CIcon icon={row.icon} className="text-primary" />
                              <span>{row.label}</span>
                            </div>
                          ))}
                          {idx === 0 && project.email_sent && (
                            <CAlert
                              color="success"
                              className="mt-3 py-2 px-3 d-flex align-items-center gap-2 small mb-2"
                            >
                              <CIcon icon={cilEnvelopeLetter} />
                              <div>
                                Access email sent via <strong>AWS SES</strong>
                              </div>
                            </CAlert>
                          )}
                        </CCardBody>
                      </CCard>
                    ))}
                    {project.project_associate_name && (
                      <CCard
                        className="border-0 shadow-sm"
                        style={{ borderRadius: '10px', maxWidth: '500px' }}
                      >
                        <CCardBody>
                          <div className="d-flex align-items-center gap-3">
                            <div
                              className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center fw-bold fs-4"
                              style={{ width: 56, height: 56, flexShrink: 0 }}
                            >
                              {project.project_associate_name.charAt(0)}
                            </div>
                            <div>
                              <h6 className="fw-bold mb-0">{project.project_associate_name}</h6>
                              <div className="text-body-secondary small">Project Associate</div>
                            </div>
                          </div>
                        </CCardBody>
                      </CCard>
                    )}
                    <div className="mt-1">
                      <CButton
                        color="primary"
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/pms/projects/${id}/edit`)}
                      >
                        <CIcon icon={cilPeople} className="me-1" />
                        Manage Officers
                      </CButton>
                    </div>
                  </div>
                )
              })()}
            </CTabPane>

            {/* Approvals Tab */}
            <CTabPane visible={activeTab === 3}>
              {approvals.length === 0 ? (
                <div className="text-center py-5 text-body-secondary">
                  <div className="mb-2 text-body-secondary">
                    <CIcon icon={cilCheckCircle} style={{ width: 48, height: 48 }} />
                  </div>
                  <h6>No pending approvals</h6>
                  <p className="small">All submissions are reviewed</p>
                </div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {approvals.map((item) => (
                    <CCard
                      key={item.id}
                      className="border-0 shadow-sm"
                      style={{
                        borderRadius: '10px',
                        borderLeft: `4px solid ${item.status === 'pending' ? '#f77f00' : item.status === 'approved' ? '#06d6a0' : '#e74c3c'}`,
                      }}
                    >
                      <CCardBody>
                        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                          <div>
                            <div className="d-flex align-items-center gap-2 mb-1">
                              <CBadge color="info" shape="rounded-pill" className="small">
                                {item.type}
                              </CBadge>
                              <CBadge
                                color={
                                  item.status === 'pending'
                                    ? 'warning'
                                    : item.status === 'approved'
                                      ? 'success'
                                      : 'danger'
                                }
                                shape="rounded-pill"
                                className="small text-capitalize"
                              >
                                {item.status}
                              </CBadge>
                            </div>
                            <h6 className="fw-semibold mb-1">{item.title}</h6>
                            <div className="text-body-secondary small">
                              Submitted by {item.submittedBy} · {item.submittedAt}
                            </div>
                          </div>
                          <div className="text-end">
                            <div className="fw-bold fs-5 text-primary">{fmt(item.amount)}</div>
                            {item.status === 'pending' && (
                              <div className="d-flex gap-2 mt-2">
                                <CButton
                                  color="success"
                                  size="sm"
                                  onClick={() => setApproveModal({ visible: true, item })}
                                >
                                  <CIcon icon={cilCheckCircle} className="me-1" />
                                  Approve
                                </CButton>
                                <CButton
                                  color="danger"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setRejectModal({ visible: true, item })}
                                >
                                  <CIcon icon={cilXCircle} className="me-1" />
                                  Reject
                                </CButton>
                              </div>
                            )}
                          </div>
                        </div>
                      </CCardBody>
                    </CCard>
                  ))}
                </div>
              )}
            </CTabPane>

            {/* Project Financials Tab */}
            <CTabPane visible={activeTab === 4}>
              {/* 4 KPI tiles */}
              <CRow className="g-3 mb-4">
                {[
                  {
                    label: 'Expense Accounted',
                    value: fmt(project.expense_accounted),
                    sub: `${project.amount_received > 0 ? Math.round(((project.expense_accounted || 0) / project.amount_received) * 100) : 0}% of amount received`,
                    color: '#f77f00',
                    bg: 'rgba(247,127,0,0.07)',
                    icon: '📤',
                  },
                  {
                    label: 'Committed Expense',
                    value: fmt(project.committed_expense),
                    sub: 'Approved but not yet paid',
                    color: '#7209b7',
                    bg: 'rgba(114,9,183,0.07)',
                    icon: '🔒',
                  },
                  (() => {
                    const bal =
                      (project.amount_received || 0) -
                      (project.expense_accounted || 0)
                    return {
                      label: 'Fund Balance',
                      value: fmt(bal),
                      sub: 'Amount received minus accounted',
                      color: bal >= 0 ? '#06d6a0' : '#e74c3c',
                      bg: bal >= 0 ? 'rgba(6,214,160,0.07)' : 'rgba(231,76,60,0.07)',
                      icon: bal >= 0 ? '✅' : '⚠️',
                    }
                  })(),
                  (() => {
                    const balAfter =
                      (project.amount_received || 0) -
                      (project.expense_accounted || 0) -
                      (project.committed_expense || 0)
                    return {
                      label: 'Fund Balance After Commitment',
                      value: fmt(balAfter),
                      sub: 'Available after all commitments',
                      color: balAfter >= 0 ? '#06d6a0' : '#e74c3c',
                      bg: balAfter >= 0 ? 'rgba(6,214,160,0.07)' : 'rgba(231,76,60,0.07)',
                      icon: balAfter >= 0 ? '✅' : '⚠️',
                    }
                  })(),
                ].map((kpi, i) => (
                  <CCol key={i} xs={12} sm={6} xl={3}>
                    <div
                      className="rounded-3 p-4 h-100"
                      style={{ background: kpi.bg, border: `1.5px solid ${kpi.color}22` }}
                    >
                      <div className="d-flex align-items-center gap-2 mb-3">
                        <span style={{ fontSize: '1.25rem' }}>{kpi.icon}</span>
                        <span className="small fw-semibold text-body-secondary">{kpi.label}</span>
                      </div>
                      <div
                        className="fw-bold lh-1 mb-2"
                        style={{ color: kpi.color, fontSize: '1.35rem' }}
                      >
                        {kpi.value}
                      </div>
                      <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                        {kpi.sub}
                      </div>
                    </div>
                  </CCol>
                ))}
              </CRow>



              <GstBillsPage projectId={project.id} isProjectView={true} />
            </CTabPane>

            {/* Project Milestones Tab */}
            <CTabPane visible={activeTab === 5}>
              <CCard className="border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                <CCardBody className="p-0">
                  {project.installments && project.installments.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                      <CTable hover align="middle" className="mb-0" style={{ fontSize: '0.85rem' }}>
                        <CTableHead color="light">
                          <CTableRow>
                            <CTableHeaderCell>#</CTableHeaderCell>
                            <CTableHeaderCell>Installment</CTableHeaderCell>
                            <CTableHeaderCell className="text-center">%</CTableHeaderCell>
                            <CTableHeaderCell className="text-end">Amount</CTableHeaderCell>
                            <CTableHeaderCell>Start Date</CTableHeaderCell>
                            <CTableHeaderCell>End Date</CTableHeaderCell>
                            <CTableHeaderCell>Duration</CTableHeaderCell>
                            <CTableHeaderCell>Payment Received</CTableHeaderCell>
                            <CTableHeaderCell>UC Target Date</CTableHeaderCell>
                            <CTableHeaderCell>Actual UC Submission</CTableHeaderCell>
                            <CTableHeaderCell className="text-center">Days Left</CTableHeaderCell>
                            <CTableHeaderCell className="text-center">UC Status</CTableHeaderCell>
                            <CTableHeaderCell className="text-end">Actions</CTableHeaderCell>
                          </CTableRow>
                        </CTableHead>
                        <CTableBody>
                          {project.installments.map((inst, i) => {
                            const isExpanded = Boolean(expandedMilestones[inst.id])

                            // UC badge colour
                            const ucBadgeColor =
                              inst.uc_status === 'Approved'
                                ? 'success'
                                : inst.uc_status === 'Submitted'
                                  ? 'primary'
                                  : 'warning'

                            // Days left until UC target
                            let daysLeftColor = 'secondary'
                            let daysLeftLabel = '—'
                            if (inst.uc_target_date && inst.uc_status !== 'Approved') {
                              const today = new Date()
                              today.setHours(0, 0, 0, 0)
                              const target = new Date(inst.uc_target_date)
                              target.setHours(0, 0, 0, 0)
                              const daysLeft = Math.ceil((target - today) / 86400000)
                              if (daysLeft < 0) {
                                daysLeftColor = 'danger'
                                daysLeftLabel = `${Math.abs(daysLeft)}d overdue`
                              } else if (daysLeft === 0) {
                                daysLeftColor = 'danger'
                                daysLeftLabel = 'Due today'
                              } else if (daysLeft <= 14) {
                                daysLeftColor = 'warning'
                                daysLeftLabel = `${daysLeft}d left`
                              } else {
                                daysLeftColor = 'success'
                                daysLeftLabel = `${daysLeft}d left`
                              }
                            } else if (inst.uc_status === 'Approved') {
                              daysLeftColor = 'success'
                              daysLeftLabel = '✓ Done'
                            }

                            // Duration of milestone (start → end)
                            let durationLabel = '—'
                            if (inst.start_date && (inst.end_date || inst.target_date)) {
                              const s = new Date(inst.start_date)
                              const e = new Date(inst.end_date || inst.target_date)
                              const days = Math.ceil((e - s) / 86400000)
                              if (days >= 0) {
                                durationLabel =
                                  days >= 30
                                    ? `${Math.round(days / 30.4)} mo`
                                    : `${days}d`
                              }
                            }

                            return (
                              <React.Fragment key={inst.id}>
                                <CTableRow>
                                  <CTableDataCell className="text-body-secondary fw-semibold">
                                    {i + 1}
                                  </CTableDataCell>
                                  <CTableDataCell className="fw-semibold">
                                    <div>{inst.label}</div>
                                    {inst.phase_name && (
                                      <div className="small text-body-secondary">{inst.phase_name}</div>
                                    )}
                                  </CTableDataCell>
                                  <CTableDataCell className="text-center">
                                    <CBadge color="secondary">{inst.percentage}%</CBadge>
                                  </CTableDataCell>
                                  <CTableDataCell className="text-end fw-bold text-primary">
                                    {fmt(inst.amount)}
                                  </CTableDataCell>
                                  <CTableDataCell className="text-body-secondary">
                                    {fmtDate(inst.start_date)}
                                  </CTableDataCell>
                                  <CTableDataCell className="text-body-secondary">
                                    {fmtDate(inst.end_date || inst.target_date)}
                                  </CTableDataCell>
                                  <CTableDataCell>
                                    <span className="small text-body-secondary">{durationLabel}</span>
                                  </CTableDataCell>
                                  <CTableDataCell>
                                    {inst.payment_received_date ? (
                                      <span className="text-success fw-semibold">
                                        {fmtDate(inst.payment_received_date)}
                                      </span>
                                    ) : (
                                      <span className="text-body-tertiary fst-italic small">Not received</span>
                                    )}
                                  </CTableDataCell>
                                  <CTableDataCell>
                                    {inst.uc_target_date ? (
                                      <span>{fmtDate(inst.uc_target_date)}</span>
                                    ) : (
                                      <span className="text-body-tertiary fst-italic small">—</span>
                                    )}
                                  </CTableDataCell>
                                  <CTableDataCell>
                                    {inst.actual_uc_submission_date ? (
                                      <span className="text-success fw-semibold">
                                        {fmtDate(inst.actual_uc_submission_date)}
                                      </span>
                                    ) : (
                                      <span className="text-body-tertiary fst-italic small">Not submitted</span>
                                    )}
                                  </CTableDataCell>
                                  <CTableDataCell className="text-center">
                                    {inst.uc_target_date || inst.uc_status === 'Approved' ? (
                                      <CBadge color={daysLeftColor} shape="rounded-pill">
                                        {daysLeftLabel}
                                      </CBadge>
                                    ) : (
                                      <span className="text-body-tertiary small">—</span>
                                    )}
                                  </CTableDataCell>
                                  <CTableDataCell className="text-center">
                                    <div className="d-flex flex-column align-items-center justify-content-center gap-1">
                                      <CBadge color={ucBadgeColor} shape="rounded-pill">
                                        {inst.uc_status || 'Pending'}
                                      </CBadge>
                                      {daysLeftLabel && daysLeftLabel !== '—' && inst.uc_status !== 'Approved' && (
                                        <span style={{ fontSize: '0.72rem', fontWeight: 600 }} className={`text-${daysLeftColor}`}>
                                          ({daysLeftLabel})
                                        </span>
                                      )}
                                    </div>
                                  </CTableDataCell>
                                  <CTableDataCell>
                                    <div className="d-flex align-items-center gap-2">
                                      {/* Submit UC button */}
                                      {(inst.uc_status === 'Pending' || !inst.uc_status) ? (
                                        <button
                                          title="Submit Utilisation Certificate"
                                          onClick={() => setUcModal({ visible: true, milestone: inst })}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            padding: '5px 12px',
                                            borderRadius: '20px',
                                            border: '1.5px solid #4361ee',
                                            background: 'linear-gradient(135deg,#4361ee 0%,#3a0ca3 100%)',
                                            color: '#fff',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            letterSpacing: '0.02em',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            boxShadow: '0 2px 6px rgba(67,97,238,0.3)',
                                            transition: 'opacity .15s',
                                          }}
                                          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                                          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                        >
                                          <CIcon icon={cilCloudUpload} style={{ width: 13, height: 13 }} />
                                          Submit UC
                                        </button>
                                      ) : (
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            padding: '5px 12px',
                                            borderRadius: '20px',
                                            background: inst.uc_status === 'Approved' ? 'rgba(25,135,84,0.1)' : 'rgba(13,110,253,0.1)',
                                            color: inst.uc_status === 'Approved' ? '#198754' : '#0d6efd',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            border: `1.5px solid ${inst.uc_status === 'Approved' ? 'rgba(25,135,84,0.3)' : 'rgba(13,110,253,0.3)'}`,
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          <CIcon icon={cilCheck} style={{ width: 13, height: 13 }} />
                                          {inst.uc_status}
                                        </span>
                                      )}

                                      {/* View / Hide Docs button */}
                                      <button
                                        title={isExpanded ? 'Hide document checklist' : 'View document checklist'}
                                        onClick={() => {
                                          setExpandedMilestones((prev) => ({
                                            ...prev,
                                            [inst.id]: !prev[inst.id],
                                          }))
                                        }}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '5px',
                                          padding: '5px 12px',
                                          borderRadius: '20px',
                                          border: isExpanded ? '1.5px solid #4361ee' : '1.5px solid var(--cui-border-color)',
                                          background: isExpanded ? 'rgba(67,97,238,0.08)' : 'transparent',
                                          color: isExpanded ? '#4361ee' : 'var(--cui-body-color)',
                                          fontSize: '0.75rem',
                                          fontWeight: 600,
                                          letterSpacing: '0.02em',
                                          cursor: 'pointer',
                                          whiteSpace: 'nowrap',
                                          transition: 'all .15s',
                                        }}
                                        onMouseEnter={e => {
                                          e.currentTarget.style.background = 'rgba(67,97,238,0.08)'
                                          e.currentTarget.style.borderColor = '#4361ee'
                                          e.currentTarget.style.color = '#4361ee'
                                        }}
                                        onMouseLeave={e => {
                                          if (!isExpanded) {
                                            e.currentTarget.style.background = 'transparent'
                                            e.currentTarget.style.borderColor = 'var(--cui-border-color)'
                                            e.currentTarget.style.color = 'var(--cui-body-color)'
                                          }
                                        }}
                                      >
                                        <CIcon icon={cilFile} style={{ width: 13, height: 13 }} />
                                        {isExpanded ? 'Hide Docs' : 'View Docs'}
                                      </button>
                                    </div>
                                  </CTableDataCell>
                                </CTableRow>

                                {/* ── Documents Checklist Panel ── */}
                                {isExpanded && (
                                  <CTableRow>
                                    <CTableDataCell colSpan={13} className="p-0">
                                      <div
                                        style={{
                                          background: 'linear-gradient(135deg, rgba(67,97,238,0.03) 0%, rgba(76,201,240,0.03) 100%)',
                                          borderTop: '2px solid rgba(67,97,238,0.12)',
                                          padding: '20px 28px 24px',
                                        }}
                                      >
                                        {/* Panel header */}
                                        <div className="d-flex align-items-center gap-2 mb-3">
                                          <div
                                            style={{
                                              width: 32,
                                              height: 32,
                                              borderRadius: 8,
                                              background: 'linear-gradient(135deg,#4361ee,#3a0ca3)',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                            }}
                                          >
                                            <CIcon icon={cilFile} style={{ width: 15, height: 15, color: '#fff' }} />
                                          </div>
                                          <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--cui-body-color)' }}>
                                              Document Submission Checklist
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--cui-secondary-color)' }}>
                                              {inst.label} — {(inst.documents_checklist || []).filter(d => d.checked).length}/{(inst.documents_checklist || []).length} documents submitted
                                            </div>
                                          </div>
                                          {/* Progress bar */}
                                          {(inst.documents_checklist || []).length > 0 && (
                                            <div className="ms-auto d-flex align-items-center gap-2">
                                              <div
                                                style={{
                                                  width: 100,
                                                  height: 6,
                                                  borderRadius: 99,
                                                  background: 'var(--cui-border-color)',
                                                  overflow: 'hidden',
                                                }}
                                              >
                                                <div
                                                  style={{
                                                    width: `${Math.round(((inst.documents_checklist || []).filter(d => d.checked).length / (inst.documents_checklist || []).length) * 100)}%`,
                                                    height: '100%',
                                                    background: 'linear-gradient(90deg,#4361ee,#4cc9f0)',
                                                    borderRadius: 99,
                                                    transition: 'width .4s ease',
                                                  }}
                                                />
                                              </div>
                                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#4361ee' }}>
                                                {Math.round(((inst.documents_checklist || []).filter(d => d.checked).length / (inst.documents_checklist || []).length) * 100)}%
                                              </span>
                                            </div>
                                          )}
                                        </div>

                                        {/* Document items */}
                                        {(inst.documents_checklist || []).length === 0 ? (
                                          <div
                                            style={{
                                              padding: '16px 20px',
                                              borderRadius: 10,
                                              background: 'var(--cui-tertiary-bg, #f8f9fa)',
                                              border: '1px dashed var(--cui-border-color)',
                                              fontSize: '0.82rem',
                                              color: 'var(--cui-secondary-color)',
                                              fontStyle: 'italic',
                                            }}
                                          >
                                            No documents configured for this installment. Edit the project to add requirements.
                                          </div>
                                        ) : (
                                          <div
                                            style={{
                                              display: 'grid',
                                              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                              gap: '10px',
                                            }}
                                          >
                                            {(inst.documents_checklist || []).map((doc, dIdx) => (
                                              <div
                                                key={dIdx}
                                                style={{
                                                  display: 'flex',
                                                  flexDirection: 'column',
                                                  gap: '8px',
                                                  padding: '12px 14px',
                                                  borderRadius: 10,
                                                  background: doc.checked
                                                    ? 'rgba(25,135,84,0.05)'
                                                    : 'var(--cui-body-bg, #fff)',
                                                  border: doc.checked
                                                    ? '1.5px solid rgba(25,135,84,0.25)'
                                                    : '1.5px solid var(--cui-border-color)',
                                                  transition: 'all .2s',
                                                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                                                }}
                                              >
                                                {/* Doc name row */}
                                                <div className="d-flex align-items-center gap-2">
                                                  <div
                                                    style={{
                                                      width: 22,
                                                      height: 22,
                                                      borderRadius: 6,
                                                      background: doc.checked ? 'rgba(25,135,84,0.15)' : 'var(--cui-tertiary-bg,#f0f0f0)',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      justifyContent: 'center',
                                                      flexShrink: 0,
                                                    }}
                                                  >
                                                    {doc.checked ? (
                                                      <CIcon icon={cilCheck} style={{ width: 12, height: 12, color: '#198754' }} />
                                                    ) : (
                                                      <CIcon icon={cilFile} style={{ width: 11, height: 11, color: 'var(--cui-secondary-color)' }} />
                                                    )}
                                                  </div>
                                                  <span
                                                    style={{
                                                      fontSize: '0.82rem',
                                                      fontWeight: 600,
                                                      color: 'var(--cui-body-color)',
                                                      flexGrow: 1,
                                                    }}
                                                  >
                                                    {doc.name}
                                                  </span>
                                                  {doc.checked && (
                                                    <CBadge color="success" shape="rounded-pill" style={{ fontSize: '0.65rem' }}>
                                                      ✓ Done
                                                    </CBadge>
                                                  )}
                                                </div>

                                                {/* File row */}
                                                {doc.file_name ? (
                                                  <div
                                                    style={{
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      gap: '6px',
                                                      padding: '5px 10px',
                                                      borderRadius: 6,
                                                      background: 'rgba(25,135,84,0.08)',
                                                      border: '1px solid rgba(25,135,84,0.2)',
                                                    }}
                                                  >
                                                    <span style={{ fontSize: '0.75rem', color: '#198754', fontWeight: 600, flexGrow: 1 }}>
                                                      📄 {doc.file_name}
                                                    </span>
                                                    <button
                                                      title="Remove file"
                                                      style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: '#dc3545',
                                                        cursor: 'pointer',
                                                        padding: '0 2px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700,
                                                        lineHeight: 1,
                                                      }}
                                                      onClick={async () => {
                                                        try {
                                                          if (doc.document_id) {
                                                            await localProjectDocuments.remove({
                                                              id: doc.document_id,
                                                              storage_path: doc.storage_path,
                                                            })
                                                          }
                                                          const updatedChecklist = [...(inst.documents_checklist || [])]
                                                          updatedChecklist[dIdx] = {
                                                            ...updatedChecklist[dIdx],
                                                            checked: false,
                                                            file_name: null,
                                                            uploaded_at: null,
                                                            document_id: null,
                                                            storage_path: null,
                                                          }
                                                          const updatedProj = await localProjects.updateInstallment(project.id, inst.id, {
                                                            documents_checklist: updatedChecklist
                                                          })
                                                          setProject(updatedProj)
                                                          setToast({ color: 'success', message: 'File removed' })
                                                        } catch (err) {
                                                          setToast({ color: 'danger', message: err.message })
                                                        }
                                                      }}
                                                    >
                                                      ✕
                                                    </button>
                                                  </div>
                                                ) : (
                                                  <button
                                                    style={{
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      justifyContent: 'center',
                                                      gap: '5px',
                                                      padding: '5px 0',
                                                      borderRadius: 6,
                                                      border: '1.5px dashed var(--cui-border-color)',
                                                      background: 'transparent',
                                                      color: 'var(--cui-secondary-color)',
                                                      fontSize: '0.75rem',
                                                      fontWeight: 600,
                                                      cursor: 'pointer',
                                                      width: '100%',
                                                      transition: 'all .15s',
                                                    }}
                                                    onMouseEnter={e => {
                                                      e.currentTarget.style.borderColor = '#4361ee'
                                                      e.currentTarget.style.color = '#4361ee'
                                                      e.currentTarget.style.background = 'rgba(67,97,238,0.04)'
                                                    }}
                                                    onMouseLeave={e => {
                                                      e.currentTarget.style.borderColor = 'var(--cui-border-color)'
                                                      e.currentTarget.style.color = 'var(--cui-secondary-color)'
                                                      e.currentTarget.style.background = 'transparent'
                                                    }}
                                                    onClick={() => {
                                                      const input = document.createElement('input')
                                                      input.type = 'file'
                                                      input.accept = '.pdf,.doc,.docx,.png,.jpg'
                                                      input.onchange = async (e) => {
                                                        const file = e.target.files[0]
                                                        if (file) {
                                                          try {
                                                            // Actually upload the bytes to Supabase Storage
                                                            // (project-documents bucket) + project_documents —
                                                            // the same table the Upload tab and generated
                                                            // reports read from, so this file shows up in both.
                                                            const uploaded = await localProjectDocuments.upload(
                                                              project.id,
                                                              file,
                                                              user?.full_name || user?.employee_id || 'Unknown',
                                                            )
                                                            const updatedChecklist = [...(inst.documents_checklist || [])]
                                                            updatedChecklist[dIdx] = {
                                                              ...updatedChecklist[dIdx],
                                                              checked: true,
                                                              file_name: file.name,
                                                              uploaded_at: uploaded.uploaded_at,
                                                              document_id: uploaded.id,
                                                              storage_path: uploaded.storage_path,
                                                            }
                                                            const updatedProj = await localProjects.updateInstallment(project.id, inst.id, {
                                                              documents_checklist: updatedChecklist
                                                            })
                                                            setProject(updatedProj)
                                                            setToast({ color: 'success', message: `Uploaded ${file.name}` })
                                                          } catch (err) {
                                                            setToast({ color: 'danger', message: err.message })
                                                          }
                                                        }
                                                      }
                                                      input.click()
                                                    }}
                                                  >
                                                    <CIcon icon={cilCloudUpload} style={{ width: 13, height: 13 }} />
                                                    Click to upload file
                                                  </button>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </CTableDataCell>
                                  </CTableRow>
                                )}
                              </React.Fragment>
                            )
                          })}
                        </CTableBody>
                      </CTable>
                    </div>
                  ) : (
                    <div className="text-center py-5 text-body-secondary">
                      <div style={{ fontSize: '2.5rem' }}>📋</div>
                      <div className="mt-2">No installments configured for this project.</div>
                    </div>
                  )}
                </CCardBody>
              </CCard>
            </CTabPane>

            {/* ══ TAB 5: Budget & Payroll ════════════════════════════════════ */}
            <CTabPane visible={activeTab === 6}>
              {/* Budget & Payroll helpers inline — uses project.installments */}
              {(() => {
                const poolExpensesFor = (pool) => projectExpensesByPool[pool] || []

                const updateProjectPct = async (field, val) => {
                  const updated = await localProjects.update(project.id, {
                    [field]: parseFloat(val) || 0,
                  })
                  setProject(updated)
                }

                return (
                  <div>
                    {/* Admin Budget Section */}
                    <CCard className="shadow-sm mb-4 border-top border-top-4 border-top-primary">
                      <CCardHeader className="bg-transparent fw-semibold pt-3 d-flex justify-content-between align-items-center">
                        <span>🌐 Project Overheads</span>
                        <div className="d-flex gap-3 flex-wrap align-items-end">
                          {[
                            { key: 'admin_pct', color: '#f7c948', label: 'Admin' },
                            { key: 'hr_pct', color: '#4361ee', label: 'HR' },
                            { key: 'core_pct', color: '#f72585', label: 'Core' },
                          ].map(({ key, color, label }) => {
                            const pct = project[key] ?? 5
                            const budgetAmt =
                              (project.project_valuation || project.project_value || 0) *
                              (pct / 100)
                            return (
                              <div
                                key={key}
                                className="d-flex flex-column align-items-center gap-1"
                              >
                                <span className="small fw-semibold" style={{ color }}>
                                  {label}
                                </span>
                                {canEditMonthlyPlan ? (
                                  <CInputGroup size="sm" style={{ width: 90 }}>
                                    <CFormInput
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.5"
                                      value={pct}
                                      style={{
                                        textAlign: 'center',
                                        fontWeight: 600,
                                        fontSize: '0.82rem',
                                      }}
                                      onChange={(e) => updateProjectPct(key, e.target.value)}
                                    />
                                    <CInputGroupText style={{ fontSize: '0.75rem' }}>
                                      %
                                    </CInputGroupText>
                                  </CInputGroup>
                                ) : (
                                  <span
                                    className="fw-semibold text-body-secondary border rounded bg-body-tertiary d-inline-block text-center"
                                    style={{ width: 65, padding: '2px 6px', fontSize: '0.8rem' }}
                                  >
                                    {pct}%
                                  </span>
                                )}
                                <span
                                  className="text-body-tertiary"
                                  style={{ fontSize: '0.68rem' }}
                                >
                                  {budgetAmt > 0 ? `₹${(budgetAmt / 1_00_000).toFixed(1)}L` : '—'}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </CCardHeader>
                      <CCardBody>
                        <CRow className="g-3">
                          <CCol xs={12} md={4}>
                            <ExpenseCard
                              title="🏛 Admin Expenses"
                              color="warning"
                              budget={
                                (project.project_valuation || project.project_value || 0) *
                                ((project.admin_pct ?? 5) / 100)
                              }
                              expenses={poolExpensesFor('admin')}
                              isAdmin={true}
                              projectId={project.id}
                              isReadOnly={true}
                            />
                          </CCol>
                          <CCol xs={12} md={4}>
                            <ExpenseCard
                              title="👥 HR Pool Charges"
                              color="primary"
                              budget={
                                (project.project_valuation || project.project_value || 0) *
                                ((project.hr_pct ?? 5) / 100)
                              }
                              expenses={poolExpensesFor('hr')}
                              isAdmin={false}
                              projectId={project.id}
                              isReadOnly={true}
                            />
                          </CCol>
                          <CCol xs={12} md={4}>
                            <ExpenseCard
                              title="⚡ Core Pool Charges"
                              color="danger"
                              budget={
                                (project.project_valuation || project.project_value || 0) *
                                ((project.core_pct ?? 5) / 100)
                              }
                              expenses={poolExpensesFor('core')}
                              isAdmin={false}
                              projectId={project.id}
                              isReadOnly={true}
                            />
                          </CCol>
                        </CRow>
                      </CCardBody>
                    </CCard>
                  </div>
                )
              })()}
            </CTabPane>

            {/* Monthly Plan Tab */}
            <CTabPane visible={activeTab === 7}>
              <BudgetPlanPanel
                project={project}
                onProjectChange={setProject}
                canEdit={canEditMonthlyPlan}
                currentUser={user?.full_name || user?.employee_id || 'Unknown'}
              />
            </CTabPane>

            {/* Expense Tab */}
            <CTabPane visible={activeTab === 8}>
              <ExpensePanel
                project={project}
                onProjectChange={setProject}
                canEdit={canEditMonthlyPlan}
                currentUser={user?.full_name || user?.employee_id || 'Unknown'}
              />
            </CTabPane>

            {/* Upload Tab */}
            <CTabPane visible={activeTab === 9}>
              <ProjectDocumentsPanel
                project={project}
                canEdit={canEditMonthlyPlan}
                currentUser={user?.full_name || user?.employee_id || 'Unknown'}
              />
            </CTabPane>

            {/* Report Tab */}
            <CTabPane visible={activeTab === 10}>
              <ReportBuilderPanel project={project} officers={officerObjects} />
            </CTabPane>

            {/* Activity Tab */}
            <CTabPane visible={activeTab === 2}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold mb-0 text-body-secondary text-uppercase small">
                  Current Activity
                </h6>
                {canEditActivity && !activityForm && (
                  <CButton color="primary" size="sm" onClick={openAddActivity}>
                    Add Activity
                  </CButton>
                )}
              </div>

              {activityForm && (
                <CCard className="border-0 shadow-sm mb-3" style={{ borderRadius: '10px' }}>
                  <CCardBody>
                    <CRow className="g-3">
                      <CCol xs={12}>
                        <CFormLabel>Current Activity *</CFormLabel>
                        <CFormTextarea
                          rows={2}
                          value={activityForm.description}
                          onChange={(e) =>
                            setActivityForm((f) => ({ ...f, description: e.target.value }))
                          }
                        />
                      </CCol>
                      <CCol xs={12} md={4}>
                        <CFormLabel>Target Date</CFormLabel>
                        <CFormInput
                          type="date"
                          value={activityForm.target_date}
                          onChange={(e) =>
                            setActivityForm((f) => ({ ...f, target_date: e.target.value }))
                          }
                        />
                      </CCol>
                      {activityForm.id && (
                        <CCol xs={12} md={4}>
                          <CFormLabel>Status</CFormLabel>
                          <CFormSelect
                            value={activityForm.status}
                            onChange={(e) =>
                              setActivityForm((f) => ({ ...f, status: e.target.value }))
                            }
                          >
                            <option value="pending">Pending</option>
                            <option value="ongoing">Ongoing</option>
                            <option value="completed">Completed</option>
                          </CFormSelect>
                        </CCol>
                      )}
                      <CCol xs={12}>
                        <CFormLabel>Risks &amp; Challenges</CFormLabel>
                        <CFormTextarea
                          rows={3}
                          placeholder="Describe any risks or challenges for this activity"
                          value={activityForm.risk_challenges}
                          onChange={(e) =>
                            setActivityForm((f) => ({ ...f, risk_challenges: e.target.value }))
                          }
                        />
                      </CCol>
                    </CRow>
                    <div className="mt-3 d-flex gap-2">
                      <CButton
                        color="primary"
                        size="sm"
                        disabled={savingActivity}
                        onClick={handleSaveActivity}
                      >
                        {savingActivity && <CSpinner size="sm" className="me-2" />}
                        {activityForm.id ? 'Save Changes' : 'Add'}
                      </CButton>
                      <CButton
                        color="secondary"
                        variant="ghost"
                        size="sm"
                        disabled={savingActivity}
                        onClick={() => setActivityForm(null)}
                      >
                        Cancel
                      </CButton>
                    </div>
                  </CCardBody>
                </CCard>
              )}

              {(project.activities || []).length === 0 && !activityForm ? (
                <div className="text-body-secondary small fst-italic">No activity logged yet.</div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {(project.activities || []).map((a) => {
                    const meta = activityStatusMeta(a)
                    return (
                      <CCard
                        key={a.id}
                        className="border-0 shadow-sm"
                        style={{ borderRadius: '10px' }}
                      >
                        <CCardBody>
                          <div className="d-flex justify-content-between align-items-start gap-2">
                            <div className="flex-grow-1">
                              <div className="fw-medium">{a.description}</div>
                              <div className="text-body-secondary small mt-1">
                                {a.target_date
                                  ? `Target: ${new Date(a.target_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                  : 'No target date'}
                              </div>
                              {a.risk_challenges && (
                                <div className="small mt-2">
                                  <span className="fw-medium text-body-secondary">
                                    Risks &amp; Challenges:{' '}
                                  </span>
                                  {a.risk_challenges}
                                </div>
                              )}
                            </div>
                            <div className="d-flex flex-column align-items-end gap-2">
                              <CBadge color={meta.color} shape="rounded-pill">
                                {meta.label}
                              </CBadge>
                              {canEditActivity && (
                                <CButton
                                  color="secondary"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditActivity(a)}
                                >
                                  Edit
                                </CButton>
                              )}
                            </div>
                          </div>
                        </CCardBody>
                      </CCard>
                    )
                  })}
                </div>
              )}
            </CTabPane>
          </CTabContent>
        </CCardBody>
      </CCard>

      {/* Approve Modal */}
      <CModal
        visible={approveModal.visible}
        onClose={() => setApproveModal({ visible: false, item: null })}
        alignment="center"
      >
        <CModalHeader>
          <CModalTitle>Confirm Approval</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p>
            Approve <strong>{approveModal.item?.title}</strong> for{' '}
            <strong className="text-primary">{fmt(approveModal.item?.amount)}</strong>?
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="ghost"
            onClick={() => setApproveModal({ visible: false, item: null })}
          >
            Cancel
          </CButton>
          <CButton color="success" onClick={() => handleApprove(approveModal.item)}>
            <CIcon icon={cilCheckCircle} className="me-1" />
            Approve
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Reject Modal */}
      <CModal
        visible={rejectModal.visible}
        onClose={() => setRejectModal({ visible: false, item: null })}
        alignment="center"
      >
        <CModalHeader>
          <CModalTitle>Reject Request</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p>
            Reject <strong>{rejectModal.item?.title}</strong>? This will send it back to the Project
            Officer.
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="ghost"
            onClick={() => setRejectModal({ visible: false, item: null })}
          >
            Cancel
          </CButton>
          <CButton color="danger" onClick={() => handleReject(rejectModal.item)}>
            <CIcon icon={cilXCircle} className="me-1" />
            Reject
          </CButton>
        </CModalFooter>
      </CModal>

      {/* UC Submission Modal */}
      <CModal
        visible={ucModal.visible}
        onClose={() => setUcModal({ visible: false, milestone: null })}
        alignment="center"
        size="md"
      >
        {/* Gradient header */}
        <div
          style={{
            background: 'linear-gradient(135deg,#4361ee 0%,#3a0ca3 100%)',
            padding: '20px 24px 16px',
            borderRadius: '12px 12px 0 0',
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CIcon icon={cilCloudUpload} style={{ width: 22, height: 22, color: '#fff' }} />
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>
                Submit Utilisation Certificate
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem' }}>
                Upload the UC document for this installment
              </div>
            </div>
          </div>
        </div>

        <CModalBody style={{ padding: '20px 24px' }}>
          {/* Installment info pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(67,97,238,0.06)',
              border: '1px solid rgba(67,97,238,0.15)',
              marginBottom: 18,
            }}
          >
            <CBadge color="primary" shape="rounded-pill" style={{ fontSize: '0.72rem' }}>
              Installment
            </CBadge>
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
              {ucModal.milestone?.label || ucModal.milestone?.title}
            </span>
            {ucModal.milestone?.amount && (
              <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#4361ee', fontSize: '0.85rem' }}>
                {fmt(ucModal.milestone?.amount)}
              </span>
            )}
          </div>

          {/* File upload zone */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--cui-body-color)', display: 'block', marginBottom: 8 }}>
              UC Document <span style={{ color: '#dc3545' }}>*</span>
            </label>
            <label
              htmlFor="uc-file-input"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '20px 16px',
                borderRadius: 10,
                border: '2px dashed rgba(67,97,238,0.3)',
                background: 'rgba(67,97,238,0.03)',
                cursor: 'pointer',
                transition: 'all .2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#4361ee'
                e.currentTarget.style.background = 'rgba(67,97,238,0.06)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(67,97,238,0.3)'
                e.currentTarget.style.background = 'rgba(67,97,238,0.03)'
              }}
            >
              <CIcon icon={cilCloudUpload} style={{ width: 28, height: 28, color: '#4361ee', opacity: 0.7 }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#4361ee' }}>
                  Click to select file
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--cui-secondary-color)', marginTop: 2 }}>
                  PDF files accepted
                </div>
              </div>
              <input type="file" id="uc-file-input" accept=".pdf" style={{ display: 'none' }} />
            </label>
          </div>

          {/* Remarks */}
          <div>
            <label style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--cui-body-color)', display: 'block', marginBottom: 8 }}>
              Remarks <span style={{ fontWeight: 400, color: 'var(--cui-secondary-color)', fontSize: '0.75rem' }}>(optional)</span>
            </label>
            <textarea
              className="form-control"
              rows="3"
              placeholder="Any comments regarding the fund utilisation..."
              style={{ borderRadius: 8, fontSize: '0.85rem', resize: 'none' }}
            />
          </div>
        </CModalBody>

        <CModalFooter style={{ borderTop: '1px solid var(--cui-border-color)', padding: '12px 20px', gap: 10 }}>
          <CButton
            color="secondary"
            variant="ghost"
            onClick={() => setUcModal({ visible: false, milestone: null })}
            style={{ fontWeight: 600, fontSize: '0.82rem' }}
          >
            Cancel
          </CButton>
          <button
            onClick={() => handleSubmitUc(ucModal.milestone)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 20px',
              borderRadius: 20,
              border: 'none',
              background: 'linear-gradient(135deg,#4361ee 0%,#3a0ca3 100%)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(67,97,238,0.4)',
              transition: 'opacity .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <CIcon icon={cilCloudUpload} style={{ width: 15, height: 15 }} />
            Submit UC
          </button>
        </CModalFooter>
      </CModal>

      <CToaster placement="top-end">
        {toast && (
          <CToast
            autohide
            delay={3000}
            visible
            color={toast.color}
            className="text-white"
            onClose={() => setToast(null)}
          >
            <div className="d-flex">
              <CToastBody>{toast.message}</CToastBody>
              <CToastClose className="me-2 m-auto" white />
            </div>
          </CToast>
        )}
      </CToaster>

      {/* Activate Project Modal */}
      <CModal visible={activateModal} onClose={() => setActivateModal(false)} alignment="center" size="sm">
        <CModalHeader>
          <CModalTitle style={{ fontSize: '1rem' }}>Activate Project</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p className="small text-body-secondary mb-3">
            Activating will unlock <strong>HR &amp; Core pool budgets</strong> in EMS Expense
            Management from the selected month onwards. The project status will be set to{' '}
            <strong>Ongoing</strong>.
          </p>
          <div className="mb-3">
            <CFormLabel className="fw-semibold small mb-1">Activate from month</CFormLabel>
            <CFormInput
              type="month"
              value={activationMonth}
              onChange={(e) => setActivationMonth(e.target.value)}
              min={project?.start_date?.slice(0, 7)}
              max={project?.end_date?.slice(0, 7)}
            />
            <div className="text-body-secondary" style={{ fontSize: '0.72rem', marginTop: 4 }}>
              HR/Core budget rows in EMS will show values from this month.
            </div>
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" size="sm" onClick={() => setActivateModal(false)}>
            Cancel
          </CButton>
          <CButton
            color="success"
            size="sm"
            onClick={handleActivateConfirm}
            disabled={activating || !activationMonth}
          >
            {activating ? <CSpinner size="sm" className="me-1" /> : <CIcon icon={cilCheckCircle} className="me-1" />}
            Activate
          </CButton>
        </CModalFooter>
      </CModal>

      <DeleteProjectConfirmModal
        visible={deleteModal}
        project={project}
        onClose={() => setDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
      />
    </>
  )
}

export default ProjectDetailPage
