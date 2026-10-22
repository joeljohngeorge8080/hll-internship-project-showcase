/**
 * ProjectOfficersPage.jsx — Manage project officers (Project Associate view).
 * Route: /pms/project-teams/officers
 * PA is superior: can add, edit, activate/deactivate any officer.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CCard,
  CCardBody,
  CRow,
  CCol,
  CButton,
  CBadge,
  CFormInput,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
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
  CForm,
  CFormLabel,
  CAlert,
  CToaster,
  CToast,
  CToastBody,
  CToastClose,
  CSpinner,
  CDropdown,
  CDropdownToggle,
  CDropdownMenu,
  CDropdownItem,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilPlus,
  cilSearch,
  cilFilterX,
  cilPen,
  cilFolder,
  cilEnvelopeLetter,
  cilOptions,
  cilPeople,
  cilShieldAlt,
  cilCheckCircle,
  cilXCircle,
} from '@coreui/icons'
import { localOfficers, localProjects } from '../../../services/localProjects'
import useAuth from '../../../hooks/useAuth'
import useRole from '../../../hooks/useRole'
import usePermission from '../../../hooks/usePermission'
import { ROLE } from '../../../constants/roles'
import { MODULE } from '../../../constants/modules'
// Only PO-relevant designations shown in the Add Officer modal
const PO_DESIGNATIONS = [
  'Field Assistant',
  'Project Lead (HMA)',
  'Project Officer',
  'Project Officer (Community Development)',
  'Project Officer (Public Health)',
  'Project Officer (IT)',
  'Senior Project Officer',
]

const EMPTY_FORM = { name: '', email: '', phone: '', designation: '', officer_type: '' }

const OFFICER_TYPE_COLOR = { CSR: 'warning', General: 'secondary' }

// ─── Reusable officer form (used by both Add and Edit modals) ─────────────────
const OfficerForm = ({ form, setField, formErrors }) => (
  <CForm>
    <CRow className="g-3">
      <CCol xs={12}>
        <CFormLabel className="fw-semibold small">
          Full Name <span className="text-danger">*</span>
        </CFormLabel>
        <CFormInput
          placeholder="e.g., Arjun Sharma"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          invalid={!!formErrors.name}
        />
        {formErrors.name && <div className="text-danger small mt-1">{formErrors.name}</div>}
      </CCol>

      <CCol xs={12}>
        <CFormLabel className="fw-semibold small">
          Email Address <span className="text-danger">*</span>
        </CFormLabel>
        <CFormInput
          type="email"
          placeholder="e.g., arjun@hma.org"
          value={form.email}
          onChange={(e) => setField('email', e.target.value)}
          invalid={!!formErrors.email}
        />
        {formErrors.email && <div className="text-danger small mt-1">{formErrors.email}</div>}
      </CCol>

      <CCol xs={12} md={6}>
        <CFormLabel className="fw-semibold small">Phone</CFormLabel>
        <CFormInput
          placeholder="+91-XXXXX-XXXXX"
          value={form.phone}
          onChange={(e) => setField('phone', e.target.value)}
        />
      </CCol>

      <CCol xs={12} md={6}>
        <CFormLabel className="fw-semibold small">
          Designation <span className="text-danger">*</span>
        </CFormLabel>
        <CFormSelect
          value={form.designation}
          onChange={(e) => setField('designation', e.target.value)}
          invalid={!!formErrors.designation}
        >
          <option value="">Select...</option>
          {PO_DESIGNATIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </CFormSelect>
        {formErrors.designation && (
          <div className="text-danger small mt-1">{formErrors.designation}</div>
        )}
      </CCol>

      <CCol xs={12}>
        <CFormLabel className="fw-semibold small">
          Project Type <span className="text-danger">*</span>
        </CFormLabel>
        <CFormSelect
          value={form.officer_type || ''}
          onChange={(e) => setField('officer_type', e.target.value)}
          invalid={!!formErrors.officer_type}
        >
          <option value="">Select project type...</option>
          <option value="General">General</option>
          <option value="CSR">CSR — Corporate Social Responsibility</option>
        </CFormSelect>
        {formErrors.officer_type && (
          <div className="text-danger small mt-1">{formErrors.officer_type}</div>
        )}
      </CCol>
    </CRow>
  </CForm>
)

// ─── Main page ────────────────────────────────────────────────────────────────
const ProjectOfficersPage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = useRole()
  const isPA = role === ROLE.PROJECT_ASSOCIATE
  const isCoordinator = role === ROLE.PROJECT_COORDINATOR
  const isOfficer = role === ROLE.PROJECT_OFFICER
  const canEdit = usePermission(MODULE.PMS_TEAMS, 'edit')

  const [officers, setOfficers] = useState([])
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({ search: '', status: '' })

  // Add modal state
  const [addVisible, setAddVisible] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [addErrors, setAddErrors] = useState({})
  const [addSaving, setAddSaving] = useState(false)

  // Edit modal state
  const [editVisible, setEditVisible] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [editErrors, setEditErrors] = useState({})
  const [editSaving, setEditSaving] = useState(false)

  const [toast, setToast] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [officerProjects, setOfficerProjects] = useState({})

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    // PAs see only officers on projects matching their fixed specialization;
    // Coordinator/Admin/CEO/Heads see everyone
    const specialization = isPA
      ? (await localProjects.getPaSpecialization(user?.employee_id)) || ''
      : ''
    const result = isPA
      ? await localOfficers.listForSpecialization(specialization, filters)
      : await localOfficers.list(filters)
    return result
  }, [filters, isPA, user?.employee_id])

  useEffect(() => {
    let cancelled = false
    load().then((result) => {
      if (cancelled) return
      setOfficers(result.items)
      setTotal(result.total)
    })
    return () => {
      cancelled = true
    }
  }, [load])

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const handleFilterChange = (field, value) => setFilters((prev) => ({ ...prev, [field]: value }))

  const clearFilters = () => setFilters({ search: '', status: '' })

  const validateForm = (form, setErrors) => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = 'Valid email is required'
    if (!form.designation.trim()) e.designation = 'Designation is required'
    if (!form.officer_type) e.officer_type = 'Project type is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Add officer ──────────────────────────────────────────────────────────────
  const openAdd = () => {
    setAddForm(EMPTY_FORM)
    setAddErrors({})
    setAddVisible(true)
  }

  const handleAdd = async () => {
    if (!validateForm(addForm, setAddErrors)) return
    setAddSaving(true)
    try {
      await localOfficers.create(addForm)
      setToast({ color: 'success', message: 'Officer added — invite email sent' })
      setAddVisible(false)
      const result = await load()
      setOfficers(result.items)
      setTotal(result.total)
    } catch (err) {
      setToast({ color: 'danger', message: err.message })
    }
    setAddSaving(false)
  }

  // ── Edit officer ─────────────────────────────────────────────────────────────
  const openEdit = (officer, e) => {
    e?.stopPropagation()
    setEditTarget(officer)
    setEditForm({
      name: officer.name,
      email: officer.email,
      phone: officer.phone || '',
      designation: officer.designation || '',
      officer_type: officer.officer_type || '',
    })
    setEditErrors({})
    setEditVisible(true)
  }

  const handleEdit = async () => {
    if (!validateForm(editForm, setEditErrors)) return
    setEditSaving(true)
    try {
      await localOfficers.update(editTarget.id, editForm)
      setToast({ color: 'success', message: 'Officer details updated' })
      setEditVisible(false)
      setEditTarget(null)
      const result = await load()
      setOfficers(result.items)
      setTotal(result.total)
    } catch (err) {
      setToast({ color: 'danger', message: err.message })
    }
    setEditSaving(false)
  }

  // ── Toggle status ────────────────────────────────────────────────────────────
  const toggleStatus = async (officer, e) => {
    e?.stopPropagation()
    const next = officer.status === 'active' ? 'inactive' : 'active'
    try {
      await localOfficers.update(officer.id, { status: next })
      setToast({ color: 'info', message: `Officer marked as ${next}` })
      const result = await load()
      setOfficers(result.items)
      setTotal(result.total)
    } catch (err) {
      setToast({ color: 'danger', message: err.message })
    }
  }

  // ── Expand row ───────────────────────────────────────────────────────────────
  const toggleExpand = (officerId) => {
    if (expandedId === officerId) {
      setExpandedId(null)
      return
    }
    setExpandedId(officerId)
    if (!officerProjects[officerId]) {
      localOfficers.getProjectsForOfficer(officerId).then((projects) => {
        setOfficerProjects((prev) => ({ ...prev, [officerId]: projects }))
      })
    }
  }

  // ── Stats ────────────────────────────────────────────────────────────────────
  const activeCount = officers.filter((o) => o.status === 'active').length
  const inactiveCount = officers.filter((o) => o.status === 'inactive').length
  const totalAssignments = officers.reduce((s, o) => s + o.projects_assigned.length, 0)

  return (
    <>
      {/* PA Authority Banner */}
      <div
        className="rounded-4 mb-4 px-4 py-3 d-flex align-items-center gap-3 flex-wrap"
        style={{ background: 'linear-gradient(135deg, #06d6a0 0%, #0096c7 100%)', color: '#fff' }}
      >
        <div
          className="rounded-circle bg-primary-subtle d-flex align-items-center justify-content-center flex-shrink-0"
          style={{ width: 44, height: 44 }}
        >
          <CIcon icon={cilShieldAlt} style={{ color: '#06d6a0', width: 22, height: 22 }} />
        </div>
        <div className="flex-grow-1">
          <div className="fw-bold fs-6">
            {isPA
              ? 'Project Associate Access'
              : isCoordinator
                ? 'Project Coordinator Access'
                : isOfficer
                  ? 'View-Only Access'
                  : 'Admin / Full Access'}
             
            <CBadge
              color="light"
              className="text-dark ms-1"
              style={{ fontSize: '0.65rem', verticalAlign: 'middle' }}
            >
              {isPA ? 'Scoped to Your Specialization' : isOfficer ? 'Read-Only' : 'All Officers'}
            </CBadge>
          </div>
          <div className="opacity-75 small">
            Logged in as <strong>{user?.full_name || 'Project Associate'}</strong>
            {isPA
              ? ' — showing only officers on projects matching your specialization'
              : isOfficer
                ? ' — view-only; contact a Project Coordinator or Associate to add or edit officers'
                : ' — showing all project officers across the organisation'}
          </div>
        </div>
        <div
          className="small opacity-75 d-none d-md-flex align-items-center gap-1 px-3 py-1 rounded-pill"
          style={{ background: 'rgba(255,255,255,0.2)', whiteSpace: 'nowrap' }}
        >
          Admin &nbsp;›&nbsp; <strong>Project Coordinator</strong> &nbsp;›&nbsp; Project Officer
          &nbsp;›&nbsp; Field Personnel
        </div>
      </div>

      {/* Page header */}
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h4 className="fw-bold mb-1">Project Officers</h4>
          <p className="text-body-secondary small mb-0">
            {total} officer{total !== 1 ? 's' : ''} · {totalAssignments} total project assignments
          </p>
        </div>
        {canEdit && (
          <CButton color="primary" className="shadow-sm" onClick={openAdd}>
            <CIcon icon={cilPlus} className="me-1" />
            Add Officer
          </CButton>
        )}
      </div>

      {/* Stat cards */}
      <CRow className="g-3 mb-4">
        {[
          { label: 'Total Officers', value: total, color: '#4361ee', bg: 'rgba(67,97,238,0.08)' },
          { label: 'Active', value: activeCount, color: '#06d6a0', bg: 'rgba(6,214,160,0.08)' },
          { label: 'Inactive', value: inactiveCount, color: '#e74c3c', bg: 'rgba(231,76,60,0.08)' },
          {
            label: 'Total Assignments',
            value: totalAssignments,
            color: '#f77f00',
            bg: 'rgba(247,127,0,0.08)',
          },
        ].map((card, i) => (
          <CCol key={i} xs={6} xl={3}>
            <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
              <CCardBody className="d-flex align-items-center gap-3 py-3">
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center fw-bold fs-4 flex-shrink-0"
                  style={{ width: 52, height: 52, background: card.bg, color: card.color }}
                >
                  {card.value}
                </div>
                <div className="fw-semibold small">{card.label}</div>
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>

      {/* Filters */}
      <CCard className="mb-3 border-0 shadow-sm" style={{ borderRadius: '12px' }}>
        <CCardBody className="py-3">
          <CRow className="g-2 align-items-end">
            <CCol xs={12} md={6}>
              <CInputGroup size="sm">
                <CInputGroupText className="bg-transparent">
                  <CIcon icon={cilSearch} size="sm" />
                </CInputGroupText>
                <CFormInput
                  placeholder="Search by name, email or designation..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
              </CInputGroup>
            </CCol>
            <CCol xs={6} md={3}>
              <CFormSelect
                size="sm"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </CFormSelect>
            </CCol>
            <CCol xs={6} md={3}>
              <CButton
                color="secondary"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="w-100"
              >
                <CIcon icon={cilFilterX} size="sm" className="me-1" />
                Clear
              </CButton>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {/* Officers Table */}
      <CCard className="border-0 shadow-sm" style={{ borderRadius: '12px' }}>
        <CTable hover responsive className="mb-0" style={{ fontSize: '0.875rem' }}>
          <CTableHead className="bg-body-tertiary">
            <CTableRow>
              <CTableHeaderCell className="border-0 py-3 ps-4">Officer</CTableHeaderCell>
              <CTableHeaderCell className="border-0 py-3">Contact</CTableHeaderCell>
              <CTableHeaderCell className="border-0 py-3">Designation</CTableHeaderCell>
              <CTableHeaderCell className="border-0 py-3">Type</CTableHeaderCell>
              <CTableHeaderCell className="border-0 py-3">Projects</CTableHeaderCell>
              <CTableHeaderCell className="border-0 py-3">Status</CTableHeaderCell>
              <CTableHeaderCell className="border-0 py-3 text-end pe-4">Actions</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {officers.map((officer) => (
              <React.Fragment key={officer.id}>
                <CTableRow style={{ cursor: 'pointer' }} onClick={() => toggleExpand(officer.id)}>
                  {/* Name */}
                  <CTableDataCell className="py-3 ps-4">
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                        style={{ width: 40, height: 40, fontSize: '1rem' }}
                      >
                        {officer.name.charAt(0)}
                      </div>
                      <div>
                        <div className="fw-semibold">{officer.name}</div>
                        <div className="text-body-secondary" style={{ fontSize: '0.75rem' }}>
                          Added {new Date(officer.created_at).toLocaleDateString('en-IN')}
                        </div>
                      </div>
                    </div>
                  </CTableDataCell>

                  {/* Contact */}
                  <CTableDataCell className="py-3">
                    <div className="d-flex align-items-center gap-1 small">
                      <CIcon
                        icon={cilEnvelopeLetter}
                        className="text-body-secondary"
                        style={{ width: 14 }}
                      />
                      <span>{officer.email}</span>
                    </div>
                    {officer.phone && (
                      <div className="text-body-secondary" style={{ fontSize: '0.75rem' }}>
                        {officer.phone}
                      </div>
                    )}
                  </CTableDataCell>

                  {/* Designation */}
                  <CTableDataCell className="py-3">
                    <span className="fw-medium">{officer.designation || '—'}</span>
                  </CTableDataCell>

                  {/* Officer Type */}
                  <CTableDataCell className="py-3">
                    <CBadge
                      color={OFFICER_TYPE_COLOR[officer.officer_type] || 'secondary'}
                      shape="rounded-pill"
                      className="px-2"
                    >
                      {officer.officer_type || 'General'}
                    </CBadge>
                  </CTableDataCell>

                  {/* Projects count */}
                  <CTableDataCell className="py-3">
                    <div className="d-flex align-items-center gap-2">
                      <div
                        className="rounded-2 d-flex align-items-center justify-content-center fw-bold"
                        style={{
                          width: 28,
                          height: 28,
                          background:
                            officer.projects_assigned.length > 0
                              ? 'rgba(67,97,238,0.1)'
                              : '#f8f9fa',
                          color: officer.projects_assigned.length > 0 ? '#4361ee' : '#6c757d',
                          fontSize: '0.8rem',
                        }}
                      >
                        {officer.projects_assigned.length}
                      </div>
                      <span className="small text-body-secondary">
                        project{officer.projects_assigned.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </CTableDataCell>

                  {/* Status */}
                  <CTableDataCell className="py-3">
                    <CBadge
                      color={officer.status === 'active' ? 'success' : 'secondary'}
                      shape="rounded-pill"
                      className="px-2 text-capitalize"
                    >
                      {officer.status}
                    </CBadge>
                  </CTableDataCell>

                  {/* Actions */}
                  <CTableDataCell className="py-3 pe-4 text-end">
                    {/* Direct edit button — PA privilege */}
                    {canEdit && (
                      <CButton
                        color="success"
                        variant="outline"
                        size="sm"
                        className="me-1"
                        title="Edit officer"
                        onClick={(e) => openEdit(officer, e)}
                      >
                        <CIcon icon={cilPen} style={{ width: 13, height: 13 }} />
                      </CButton>
                    )}

                    <CDropdown alignment="end">
                      <CDropdownToggle
                        color="secondary"
                        variant="ghost"
                        size="sm"
                        caret={false}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <CIcon icon={cilOptions} />
                      </CDropdownToggle>
                      <CDropdownMenu>
                        <CDropdownItem
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleExpand(officer.id)
                          }}
                        >
                          <CIcon icon={cilFolder} className="me-2" />
                          View Projects
                        </CDropdownItem>
                        <CDropdownItem
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate('/pms/projects/create')
                          }}
                        >
                          <CIcon icon={cilPeople} className="me-2" />
                          Assign to Project
                        </CDropdownItem>
                        {canEdit && (
                          <CDropdownItem onClick={(e) => openEdit(officer, e)}>
                            <CIcon icon={cilPen} className="me-2" />
                            Edit Details
                          </CDropdownItem>
                        )}
                        {canEdit && (
                          <CDropdownItem onClick={(e) => toggleStatus(officer, e)}>
                            <CIcon
                              icon={officer.status === 'active' ? cilXCircle : cilCheckCircle}
                              className="me-2"
                            />
                            {officer.status === 'active' ? 'Deactivate' : 'Activate'}
                          </CDropdownItem>
                        )}
                      </CDropdownMenu>
                    </CDropdown>
                  </CTableDataCell>
                </CTableRow>

                {/* Expanded projects sub-row */}
                {expandedId === officer.id && (
                  <CTableRow>
                    <CTableDataCell colSpan={7} className="py-0">
                      <div
                        className="p-3 bg-body-tertiary"
                        style={{ borderTop: '1px solid #e9ecef' }}
                      >
                        <h6 className="fw-semibold small text-body-secondary text-uppercase mb-3">
                          Assigned Projects
                        </h6>
                        {(officerProjects[officer.id] || []).length === 0 ? (
                          <p className="text-body-secondary small mb-0">No projects assigned yet</p>
                        ) : (
                          <div className="d-flex flex-wrap gap-2">
                            {(officerProjects[officer.id] || []).map((p) => (
                              <div
                                key={p.id}
                                className="d-flex align-items-center gap-2 px-3 py-2 rounded-3 border"
                                style={{ cursor: 'pointer', fontSize: '0.825rem' }}
                                onClick={() => navigate(`/pms/projects/${p.id}`)}
                              >
                                <CBadge
                                  color={
                                    p.status === 'ongoing'
                                      ? 'success'
                                      : p.status === 'approved'
                                        ? 'info'
                                        : p.status === 'pipeline'
                                          ? 'secondary'
                                          : 'secondary'
                                  }
                                  shape="rounded-circle"
                                  style={{ width: 8, height: 8 }}
                                >
                                  {' '}
                                </CBadge>
                                <span className="fw-medium">{p.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                )}
              </React.Fragment>
            ))}
          </CTableBody>
        </CTable>

        {officers.length === 0 && (
          <div className="text-center py-5">
            <div style={{ fontSize: '3.5rem' }} className="mb-2">
              👥
            </div>
            <h5 className="text-body-secondary">No officers found</h5>
            <p className="text-body-tertiary">
              {filters.search || filters.status
                ? 'Try adjusting filters'
                : 'Add your first project officer to get started'}
            </p>
            {!filters.search && !filters.status && canEdit && (
              <CButton color="primary" onClick={openAdd}>
                <CIcon icon={cilPlus} className="me-1" />
                Add Officer
              </CButton>
            )}
          </div>
        )}
      </CCard>

      {/* ── Add Officer Modal ──────────────────────────────────────────────────── */}
      <CModal
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        alignment="center"
        size="md"
      >
        <CModalHeader>
          <CModalTitle>
            <CIcon icon={cilPlus} className="me-2 text-primary" />
            Add Project Officer
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <OfficerForm
            form={addForm}
            setField={(f, v) => {
              setAddForm((p) => ({ ...p, [f]: v }))
              if (addErrors[f]) setAddErrors((p) => ({ ...p, [f]: null }))
            }}
            formErrors={addErrors}
          />
          <CAlert
            color="info"
            className="mt-3 py-2 px-3 d-flex align-items-start gap-2 mb-0"
            style={{ fontSize: '0.8rem' }}
          >
            <CIcon icon={cilEnvelopeLetter} className="mt-1 flex-shrink-0" />
            <div>
              An invite email will be sent to <strong>{addForm.email || 'the officer'}</strong> via{' '}
              <strong>AWS SES</strong> with their login link and project access.
            </div>
          </CAlert>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" onClick={() => setAddVisible(false)}>
            Cancel
          </CButton>
          <CButton color="primary" onClick={handleAdd} disabled={addSaving}>
            {addSaving ? (
              <CSpinner size="sm" className="me-1" />
            ) : (
              <CIcon icon={cilPlus} className="me-1" />
            )}
            Add &amp; Send Email
          </CButton>
        </CModalFooter>
      </CModal>

      {/* ── Edit Officer Modal ─────────────────────────────────────────────────── */}
      <CModal
        visible={editVisible}
        onClose={() => {
          setEditVisible(false)
          setEditTarget(null)
        }}
        alignment="center"
        size="md"
      >
        <CModalHeader>
          <CModalTitle>
            <CIcon icon={cilPen} className="me-2 text-success" />
            Edit Officer — {editTarget?.name}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {/* PA privilege notice */}
          <div
            className="rounded-3 px-3 py-2 mb-3 d-flex align-items-center gap-2 small"
            style={{
              background: 'rgba(6,214,160,0.08)',
              border: '1px solid rgba(6,214,160,0.25)',
              color: '#0a7a5a',
            }}
          >
            <CIcon icon={cilShieldAlt} />
            <div>You have permission to edit this officer's details.</div>
          </div>
          <OfficerForm
            form={editForm}
            setField={(f, v) => {
              setEditForm((p) => ({ ...p, [f]: v }))
              if (editErrors[f]) setEditErrors((p) => ({ ...p, [f]: null }))
            }}
            formErrors={editErrors}
          />
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="ghost"
            onClick={() => {
              setEditVisible(false)
              setEditTarget(null)
            }}
          >
            Cancel
          </CButton>
          <CButton color="success" onClick={handleEdit} disabled={editSaving}>
            {editSaving ? (
              <CSpinner size="sm" className="me-1" />
            ) : (
              <CIcon icon={cilCheckCircle} className="me-1" />
            )}
            Save Changes
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Toast */}
      <CToaster placement="top-end">
        {toast && (
          <CToast
            autohide
            delay={3500}
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

export default ProjectOfficersPage
