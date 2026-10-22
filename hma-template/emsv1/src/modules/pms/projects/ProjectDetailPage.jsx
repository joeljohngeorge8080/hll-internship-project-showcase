/**
 * ProjectDetailPage — Full project detail view for Project Officers.
 * Route: /pms/projects/:id
 * Tabs: Overview · Team · Tasks · Reports
 */
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CRow,
  CCol,
  CCard,
  CCardBody,
  CCardHeader,
  CButton,
  CBadge,
  CProgress,
  CSpinner,
  CAlert,
  CTable,
  CTableHead,
  CTableBody,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
  CForm,
  CFormInput,
  CFormLabel,
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CToaster,
  CToast,
  CToastBody,
  CToastClose,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilArrowLeft,
  cilPeople,
  cilEnvelopeClosed,
  cilTrash,
  cilCalendar,
  cilLocationPin,
  cilBuilding,
  cilDollar,
  cilPencil,
  cilTask,
  cilPlus,
  cilNotes,
} from '@coreui/icons'

import { localProjects, PHASE_CONFIG } from '../../../services/localProjects'
import { localTasks } from '../../../services/localTasks'
import { localOrgPool } from '../../../services/localOrgPool'
import TaskAssignModal from '../daily-reports/components/TaskAssignModal'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0)

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

const formatDateTime = (isoStr) => {
  if (!isoStr) return '—'
  try {
    return new Date(isoStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoStr
  }
}

const DetailRow = ({ label, value, icon }) => (
  <div className="d-flex gap-3 py-2 border-bottom">
    <div className="text-body-secondary" style={{ width: '160px', flexShrink: 0 }}>
      {icon && <CIcon icon={icon} size="sm" className="me-1" />}
      {label}
    </div>
    <div className="fw-medium">{value || '—'}</div>
  </div>
)

const OFFICER_ID = 'po_001'

const ProjectDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const [project, setProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [hrBudgets, setHrBudgets] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [toast, setToast] = useState(null)
  const [inviteForm, setInviteForm] = useState({ name: '', email: '' })
  const [inviting, setInviting] = useState(false)
  const [removeModal, setRemoveModal] = useState({ visible: false, email: '' })
  const [taskModalVisible, setTaskModalVisible] = useState(false)
  const [taskModalLoading, setTaskModalLoading] = useState(false)

  const reload = async () => {
    const p = await localProjects.getById(id)
    setProject(p)
    if (p) {
      const t = localTasks.getByProject(id)
      setTasks(t)
      // getProjectInstallmentBudgets now returns all four budget components in one call
      setHrBudgets(await localOrgPool.getProjectInstallmentBudgets(id, 'hr'))
    }
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    localProjects.getByOfficer(OFFICER_ID).then((officerProjects) => {
      if (cancelled) return
      localTasks.seedDemoData(officerProjects)
      reload()
    })
    return () => {
      cancelled = true
    }
  }, [id, reload])

  const handleInvite = async (e) => {
    e.preventDefault()
    setInviting(true)
    try {
      const updated = await localProjects.invitePersonnel(id, inviteForm)
      setProject(updated)
      setToast({
        color: 'success',
        message: `Recruitment invitation sent to ${inviteForm.email}`,
      })
      setInviteForm({ name: '', email: '' })
    } catch (err) {
      setToast({ color: 'danger', message: err.message })
    }
    setInviting(false)
  }

  const handleRemove = async () => {
    try {
      const updated = await localProjects.removePersonnel(id, removeModal.email)
      setProject(updated)
      setToast({ color: 'info', message: 'Personnel removed from project.' })
    } catch (err) {
      setToast({ color: 'danger', message: err.message })
    }
    setRemoveModal({ visible: false, email: '' })
  }

  const handleCreateTask = (formData) => {
    setTaskModalLoading(true)
    try {
      localTasks.create({ ...formData, project_id: id, project_name: project?.title })
      setToast({ color: 'success', message: 'Task created for the project team' })
      setTaskModalVisible(false)
      reload()
    } catch (err) {
      setToast({ color: 'danger', message: err.message })
    }
    setTaskModalLoading(false)
  }

  const handleCompleteTask = (taskId) => {
    localTasks.complete(taskId)
    reload()
    setToast({ color: 'success', message: 'Task marked as completed.' })
  }

  if (loading)
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )

  if (!project)
    return (
      <>
        <CAlert color="danger">Project not found.</CAlert>
        <CButton color="primary" variant="outline" onClick={() => navigate(-1)}>
          Go Back
        </CButton>
      </>
    )

  const phase = PHASE_CONFIG[project.phase] || PHASE_CONFIG.pipeline
  const utilization =
    project.amount_released > 0
      ? Math.round((project.amount_utilized / project.amount_released) * 100)
      : 0
  const isOverdue =
    project.end_date && project.phase !== 'completed' && new Date(project.end_date) < new Date()
  const activeTasks = tasks.filter((t) => t.status === 'active')
  const completedTasks = tasks.filter((t) => t.status === 'completed')

  return (
    <>
      {/* Header */}
      <div className="d-flex align-items-center gap-3 mb-4">
        <CButton
          color="secondary"
          variant="ghost"
          onClick={() => navigate('/pms/projects/my-projects')}
        >
          <CIcon icon={cilArrowLeft} />
        </CButton>
        <div className="flex-grow-1">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <h4 className="mb-0 fw-bold">{project.title}</h4>
            <CBadge color={phase.color} shape="rounded-pill" className="text-uppercase px-3 py-1">
              {phase.label}
            </CBadge>
            {isOverdue && (
              <CBadge color="danger" shape="rounded-pill">
                Overdue
              </CBadge>
            )}
          </div>
          <div className="small text-body-secondary mt-1">
            <CIcon icon={cilLocationPin} size="sm" className="me-1" />
            {project.location} · Created {formatDateTime(project.created_at)}
          </div>
        </div>
        <CButton
          color="primary"
          variant="outline"
          size="sm"
          onClick={() => navigate(`/pms/projects/${id}/edit`)}
        >
          <CIcon icon={cilPencil} className="me-1" /> Edit
        </CButton>
      </div>

      {/* Tabs */}
      <CNav variant="underline" className="mb-4">
        <CNavItem>
          <CNavLink
            active={activeTab === 0}
            onClick={() => setActiveTab(0)}
            role="button"
            className="fw-medium"
          >
            Overview
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink
            active={activeTab === 1}
            onClick={() => setActiveTab(1)}
            role="button"
            className="fw-medium"
          >
            <CIcon icon={cilPeople} className="me-1" />
            Team
            {project.field_personnel?.length > 0 && (
              <CBadge color="secondary" shape="rounded-pill" className="ms-1">
                {project.field_personnel.length}
              </CBadge>
            )}
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink
            active={activeTab === 2}
            onClick={() => setActiveTab(2)}
            role="button"
            className="fw-medium"
          >
            <CIcon icon={cilTask} className="me-1" />
            Tasks
            {activeTasks.length > 0 && (
              <CBadge color="danger" shape="rounded-pill" className="ms-1">
                {activeTasks.length}
              </CBadge>
            )}
          </CNavLink>
        </CNavItem>
      </CNav>

      <CTabContent>
        {/* ── TAB 0: Overview ─────────────────────────────────────────────────── */}
        <CTabPane visible={activeTab === 0}>
          <CRow className="g-4">
            <CCol xs={12} lg={7}>
              <CCard className="shadow-sm mb-4">
                <CCardHeader className="bg-transparent fw-semibold pt-3">
                  Project Details
                </CCardHeader>
                <CCardBody className="small">
                  <DetailRow
                    label="Funding Agency"
                    icon={cilBuilding}
                    value={project.funding_agency}
                  />
                  <DetailRow
                    label="Implementing Partner"
                    icon={cilBuilding}
                    value={project.implementing_partner}
                  />
                  <DetailRow label="Location" icon={cilLocationPin} value={project.location} />
                  <DetailRow
                    label="Start Date"
                    icon={cilCalendar}
                    value={formatDate(project.start_date)}
                  />
                  <DetailRow
                    label="End Date"
                    icon={cilCalendar}
                    value={
                      <span className={isOverdue ? 'text-danger fw-bold' : ''}>
                        {formatDate(project.end_date)} {isOverdue && '(Overdue)'}
                      </span>
                    }
                  />
                </CCardBody>
              </CCard>
            </CCol>
            <CCol xs={12} lg={5}>
              {/* Summary stats */}
              <CCard className="shadow-sm mb-4">
                <CCardHeader className="bg-transparent fw-semibold pt-3">Quick Stats</CCardHeader>
                <CCardBody>
                  <CRow className="g-2 text-center">
                    {[
                      {
                        label: 'Team Members',
                        value: project.field_personnel?.length || 0,
                        color: 'primary',
                      },
                      { label: 'Active Tasks', value: activeTasks.length, color: 'warning' },
                      { label: 'Completed', value: completedTasks.length, color: 'success' },
                    ].map((s) => (
                      <CCol key={s.label} xs={4}>
                        <div className="bg-body-secondary rounded p-2">
                          <div className={`fw-bold fs-4 text-${s.color}`}>{s.value}</div>
                          <div className="text-body-secondary" style={{ fontSize: '0.7rem' }}>
                            {s.label}
                          </div>
                        </div>
                      </CCol>
                    ))}
                  </CRow>
                </CCardBody>
              </CCard>

              <CCard className="shadow-sm">
                <CCardHeader className="bg-transparent fw-semibold pt-3">
                  <CIcon icon={cilDollar} className="me-2" />
                  Financial Summary
                </CCardHeader>
                <CCardBody>
                  <CRow className="g-2 text-center mb-3">
                    {[
                      { label: 'Valuation', value: project.project_valuation },
                      { label: 'Sanctioned', value: project.amount_sanctioned },
                      { label: 'Released', value: project.amount_released },
                      { label: 'Utilized', value: project.amount_utilized },
                    ].map((item) => (
                      <CCol key={item.label} xs={6}>
                        <div className="bg-body-secondary rounded p-2">
                          <div className="fw-bold" style={{ fontSize: '0.85rem' }}>
                            {formatCurrency(item.value)}
                          </div>
                          <div className="text-body-secondary" style={{ fontSize: '0.7rem' }}>
                            {item.label}
                          </div>
                        </div>
                      </CCol>
                    ))}
                  </CRow>
                  {project.amount_released > 0 && (
                    <>
                      <div className="d-flex justify-content-between small text-body-secondary mb-1">
                        <span>Fund Utilization</span>
                        <span className="fw-medium">{utilization}%</span>
                      </div>
                      <CProgress
                        value={utilization}
                        color={
                          utilization > 90 ? 'danger' : utilization > 70 ? 'warning' : 'success'
                        }
                        height={8}
                      />
                    </>
                  )}
                </CCardBody>
              </CCard>
              <CCard className="shadow-sm mt-4">
                <CCardHeader className="bg-transparent fw-semibold pt-3">
                  <CIcon icon={cilCalendar} className="me-2" />
                  Budget Distribution per Installment
                </CCardHeader>
                <CCardBody>
                  <p className="small text-body-secondary mb-1">
                    Fixed allocation per installment received. HR &amp; Core monthly budgets are
                    derived from the <strong>total project value</strong> spread equally across the
                    full project duration.
                  </p>
                  {!hrBudgets || hrBudgets.length === 0 ? (
                    <div className="text-center small text-body-tertiary mt-3">
                      No installments to show.
                    </div>
                  ) : (
                    hrBudgets.map((row) => (
                      <div
                        key={row?.installmentId || Math.random()}
                        className="mb-3 border rounded p-3"
                      >
                        {/* Installment header */}
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <div className="fw-medium small">{row.installmentLabel}</div>
                          <div className="d-flex align-items-center gap-2">
                            {row.budgetNotForeseen && (
                              <CBadge
                                color="warning"
                                shape="rounded-pill"
                                style={{ fontSize: '0.68rem' }}
                              >
                                ⚠ Budget Not Foreseen
                              </CBadge>
                            )}
                            <span className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                              {formatCurrency(row.installmentAmount)} ·{' '}
                              {row.instMonths || row.months || 1} mo
                            </span>
                          </div>
                        </div>

                        {row.budgetNotForeseen && (
                          <div className="small text-warning mb-2" style={{ fontSize: '0.72rem' }}>
                            Project value not set — HR &amp; Core are computed from installment
                            amount as fallback.
                          </div>
                        )}

                        <hr className="my-2" />

                        {/* Four bands */}
                        <div className="d-flex gap-2 flex-wrap">
                          {/* Project Budget */}
                          <div
                            className="flex-grow-1 rounded p-2"
                            style={{
                              background: 'rgba(67,97,238,0.07)',
                              border: '1px solid rgba(67,97,238,0.2)',
                            }}
                          >
                            <div className="small fw-semibold" style={{ color: '#4361ee' }}>
                              {row.projectPct}% — Project Budget
                            </div>
                            <div className="fw-bold fs-6" style={{ color: '#4361ee' }}>
                              {formatCurrency(row.projectBudget)}
                            </div>
                            <div className="text-body-secondary" style={{ fontSize: '0.68rem' }}>
                              Budget designed by Project Officer upon receipt
                            </div>
                          </div>
                        </div>

                        <div className="d-flex gap-2 flex-wrap mt-2">
                          <div
                            className="flex-fill rounded p-2 text-center"
                            style={{
                              background: 'rgba(67,164,238,0.08)',
                              border: '1px solid rgba(67,164,238,0.2)',
                              minWidth: '90px',
                            }}
                          >
                            <div className="small fw-semibold text-primary">HR ({row.hrPct}%)</div>
                            <div className="fw-bold text-primary">
                              {formatCurrency(row.hrMonthlyBudget)}
                              <span className="fw-normal" style={{ fontSize: '0.65rem' }}>
                                /mo
                              </span>
                            </div>
                            <div className="text-body-tertiary" style={{ fontSize: '0.65rem' }}>
                              {row.budgetNotForeseen
                                ? 'from installment (fallback)'
                                : `proj. value ÷ ${row.totalProjectMonths} mo`}
                            </div>
                          </div>
                          <div
                            className="flex-fill rounded p-2 text-center"
                            style={{
                              background: 'rgba(46,196,182,0.08)',
                              border: '1px solid rgba(46,196,182,0.2)',
                              minWidth: '90px',
                            }}
                          >
                            <div className="small fw-semibold text-success">
                              Core ({row.corePct}%)
                            </div>
                            <div className="fw-bold text-success">
                              {formatCurrency(row.coreMonthlyBudget)}
                              <span className="fw-normal" style={{ fontSize: '0.65rem' }}>
                                /mo
                              </span>
                            </div>
                            <div className="text-body-tertiary" style={{ fontSize: '0.65rem' }}>
                              {row.budgetNotForeseen
                                ? 'from installment (fallback)'
                                : `proj. value ÷ ${row.totalProjectMonths} mo`}
                            </div>
                          </div>
                          <div
                            className="flex-fill rounded p-2 text-center"
                            style={{
                              background: 'rgba(247,124,106,0.08)',
                              border: '1px solid rgba(247,124,106,0.2)',
                              minWidth: '90px',
                            }}
                          >
                            <div className="small fw-semibold" style={{ color: '#f77c6a' }}>
                              Admin ({row.adminPct}%)
                            </div>
                            <div className="fw-bold" style={{ color: '#f77c6a' }}>
                              {formatCurrency(row.adminBudget)}
                            </div>
                            <div className="text-body-tertiary" style={{ fontSize: '0.65rem' }}>
                              {row.adminPct}% of installment
                            </div>
                          </div>
                        </div>

                        {/* Distribution bar */}
                        <div className="d-flex rounded overflow-hidden mt-2" style={{ height: 6 }}>
                          <div
                            style={{
                              width: `${row.projectPct}%`,
                              background: 'rgba(67,97,238,0.55)',
                            }}
                            title={`Project: ${row.projectPct}%`}
                          />
                          <div
                            style={{ width: `${row.hrPct}%`, background: 'rgba(67,164,238,0.8)' }}
                            title={`HR: ${row.hrPct}%`}
                          />
                          <div
                            style={{ width: `${row.corePct}%`, background: 'rgba(46,196,182,0.8)' }}
                            title={`Core: ${row.corePct}%`}
                          />
                          <div
                            style={{
                              width: `${row.adminPct}%`,
                              background: 'rgba(247,124,106,0.8)',
                            }}
                            title={`Admin: ${row.adminPct}%`}
                          />
                        </div>
                      </div>
                    ))
                  )}
                  {hrBudgets && hrBudgets.length > 0 && !hrBudgets[0]?.budgetNotForeseen && (
                    <div className="small text-body-secondary border-top pt-2 mt-1">
                      HR &amp; Core total:{' '}
                      <strong>{formatCurrency(hrBudgets[0]?.hrPoolTotal)}</strong> each over{' '}
                      <strong>{hrBudgets[0]?.totalProjectMonths} project months</strong>
                    </div>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        </CTabPane>

        {/* ── TAB 1: Team ─────────────────────────────────────────────────────── */}
        <CTabPane visible={activeTab === 1}>
          <CRow className="g-4">
            <CCol xs={12} lg={5}>
              <CCard className="shadow-sm border-top border-4 border-top-primary">
                <CCardHeader className="bg-transparent fw-semibold pt-3">
                  <CIcon icon={cilEnvelopeClosed} className="me-2" />
                  Recruit / Invite Field Staff
                </CCardHeader>
                <CCardBody>
                  <p className="small text-body-secondary mb-3">
                    Since field workers are contract-based, send a recruitment notification for this
                    project. They will receive an email with project details and an invitation to
                    join the team.
                  </p>
                  <CForm onSubmit={handleInvite}>
                    <div className="mb-2">
                      <CFormLabel className="small fw-medium">Full Name</CFormLabel>
                      <CFormInput
                        size="sm"
                        placeholder="e.g. Rajesh Kumar"
                        value={inviteForm.name}
                        onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <CFormLabel className="small fw-medium">Email Address</CFormLabel>
                      <CFormInput
                        size="sm"
                        type="email"
                        placeholder="e.g. rajesh@example.com"
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                        required
                      />
                    </div>
                    <CButton
                      color="primary"
                      type="submit"
                      size="sm"
                      className="w-100"
                      disabled={inviting}
                    >
                      {inviting ? (
                        <CSpinner size="sm" />
                      ) : (
                        <>
                          <CIcon icon={cilEnvelopeClosed} className="me-1" />
                          Send Recruitment Notice
                        </>
                      )}
                    </CButton>
                  </CForm>
                </CCardBody>
              </CCard>
            </CCol>
            <CCol xs={12} lg={7}>
              <CCard className="shadow-sm">
                <CCardHeader className="bg-transparent fw-semibold pt-3">
                  Field Personnel Team ({project.field_personnel?.length || 0})
                </CCardHeader>
                <CCardBody className="p-0">
                  {project.field_personnel?.length === 0 ? (
                    <div className="text-center text-body-tertiary py-4 small">
                      No field personnel assigned. Use the form to send recruitment notices.
                    </div>
                  ) : (
                    <CTable hover align="middle" className="mb-0" style={{ fontSize: '0.85rem' }}>
                      <CTableHead color="light">
                        <CTableRow>
                          <CTableHeaderCell>Name</CTableHeaderCell>
                          <CTableHeaderCell>Email</CTableHeaderCell>
                          <CTableHeaderCell>Invited</CTableHeaderCell>
                          <CTableHeaderCell className="text-end"></CTableHeaderCell>
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {project.field_personnel.map((fp) => (
                          <CTableRow key={fp.email}>
                            <CTableDataCell className="fw-semibold">{fp.name}</CTableDataCell>
                            <CTableDataCell className="text-body-secondary">
                              {fp.email}
                            </CTableDataCell>
                            <CTableDataCell className="text-body-tertiary small">
                              {formatDateTime(fp.invited_at)}
                            </CTableDataCell>
                            <CTableDataCell className="text-end">
                              <CButton
                                color="danger"
                                variant="ghost"
                                size="sm"
                                onClick={() => setRemoveModal({ visible: true, email: fp.email })}
                              >
                                <CIcon icon={cilTrash} size="sm" />
                              </CButton>
                            </CTableDataCell>
                          </CTableRow>
                        ))}
                      </CTableBody>
                    </CTable>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        </CTabPane>

        {/* ── TAB 2: Tasks ────────────────────────────────────────────────────── */}
        <CTabPane visible={activeTab === 2}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h6 className="fw-semibold mb-0">Project Tasks</h6>
              <div className="small text-body-secondary">
                Visible to all {project.field_personnel?.length || 0} team member
                {project.field_personnel?.length !== 1 ? 's' : ''}
              </div>
            </div>
            <CButton color="primary" size="sm" onClick={() => setTaskModalVisible(true)}>
              <CIcon icon={cilPlus} className="me-1" />
              Add Task
            </CButton>
          </div>

          {tasks.length === 0 ? (
            <CCard className="shadow-sm">
              <CCardBody className="text-center py-5">
                <div className="mb-2 text-body-secondary">
                  <CIcon icon={cilNotes} style={{ width: 40, height: 40 }} />
                </div>
                <h6 className="text-body-secondary mt-2">No tasks yet</h6>
                <p className="text-body-tertiary small mb-3">
                  Add tasks for your project team to work on.
                </p>
                <CButton color="primary" size="sm" onClick={() => setTaskModalVisible(true)}>
                  <CIcon icon={cilPlus} className="me-1" />
                  Add First Task
                </CButton>
              </CCardBody>
            </CCard>
          ) : (
            <div>
              {/* Active tasks */}
              {activeTasks.length > 0 && (
                <>
                  <div
                    className="small fw-semibold text-body-secondary mb-2 text-uppercase"
                    style={{ letterSpacing: '0.05em' }}
                  >
                    Active ({activeTasks.length})
                  </div>
                  {activeTasks.map((task) => (
                    <CCard
                      key={task.id}
                      className="shadow-sm mb-2 border-start border-4 border-start-primary"
                    >
                      <CCardBody className="py-3">
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <div className="fw-semibold mb-1">{task.title}</div>
                            {task.description && (
                              <div
                                className="small text-body-secondary text-truncate"
                                style={{ maxWidth: '500px' }}
                              >
                                {task.description}
                              </div>
                            )}
                            {task.due_date && (
                              <div className="small text-body-tertiary mt-1">
                                <CIcon icon={cilCalendar} size="sm" className="me-1" />
                                Due: {task.due_date}
                              </div>
                            )}
                          </div>
                          <CButton
                            color="success"
                            variant="outline"
                            size="sm"
                            onClick={() => handleCompleteTask(task.id)}
                          >
                            Mark Complete
                          </CButton>
                        </div>
                      </CCardBody>
                    </CCard>
                  ))}
                </>
              )}
              {/* Completed tasks */}
              {completedTasks.length > 0 && (
                <>
                  <div
                    className="small fw-semibold text-body-secondary mb-2 mt-3 text-uppercase"
                    style={{ letterSpacing: '0.05em' }}
                  >
                    Completed ({completedTasks.length})
                  </div>
                  {completedTasks.map((task) => (
                    <CCard
                      key={task.id}
                      className="shadow-sm mb-2 border-start border-4 border-start-success opacity-75"
                    >
                      <CCardBody className="py-2">
                        <div className="fw-medium text-body-secondary text-decoration-line-through">
                          {task.title}
                        </div>
                      </CCardBody>
                    </CCard>
                  ))}
                </>
              )}
            </div>
          )}
        </CTabPane>
      </CTabContent>

      {/* Remove Personnel Modal */}
      <CModal
        visible={removeModal.visible}
        onClose={() => setRemoveModal({ visible: false, email: '' })}
        alignment="center"
      >
        <CModalHeader>
          <CModalTitle>Remove Personnel</CModalTitle>
        </CModalHeader>
        <CModalBody>
          Remove <strong>{removeModal.email}</strong> from this project?
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="ghost"
            onClick={() => setRemoveModal({ visible: false, email: '' })}
          >
            Cancel
          </CButton>
          <CButton color="danger" onClick={handleRemove}>
            Remove
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Task Create Modal */}
      <TaskAssignModal
        visible={taskModalVisible}
        onClose={() => setTaskModalVisible(false)}
        onConfirm={handleCreateTask}
        loading={taskModalLoading}
        preselectedProjectId={id}
      />

      <CToaster placement="top-end">
        {toast && (
          <CToast
            autohide
            delay={4000}
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
    </>
  )
}

export default ProjectDetailPage
