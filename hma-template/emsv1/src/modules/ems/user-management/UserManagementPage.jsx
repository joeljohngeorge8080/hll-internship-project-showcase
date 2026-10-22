import React, { useState, useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CPagination,
  CPaginationItem,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilTrash, cilPeople, cilChevronBottom, cilChevronTop } from '@coreui/icons'

import {
  listUserAccounts,
  createUserAccount,
  deleteUserAccount,
} from '../../../services/userAccounts'
import { localOfficers } from '../../../services/localProjects'
import { localEmployees } from '../../../services/localEmployees'
import useAuth from '../../../hooks/useAuth'
import { ROLE, ROLES, roleDisplayName } from '../../../constants/roles'

const ASSIGNABLE_ROLES = ROLES.filter((r) => r !== ROLE.ADMIN)
// There are two Project Associates in practice, each permanently scoped to one
// project type via their Staff & Payroll designation (see
// specializationFromDesignation in localProjects.js). Surfacing both here as
// distinct Role options — instead of one bare "Project Associate" — lets HR/
// Admin pick the right one at registration time; the designation string must
// match PA_SPECIALIZATION_BY_DESIGNATION in localProjects.js exactly.
const PA_SPECIALIZATIONS = [
  { value: 'community_development', designation: 'Project Associate (Community Development)' },
  { value: 'public_health', designation: 'Project Associate (Public Health)' },
]
// Composite <option> values for the Role select, e.g. "Project Associate::public_health".
const roleOptionValue = (role, specialization) =>
  specialization ? `${role}::${specialization}` : role
const roleSelectOptions = (roles) =>
  roles.flatMap((r) =>
    r === ROLE.PROJECT_ASSOCIATE
      ? PA_SPECIALIZATIONS.map((s) => ({
          value: roleOptionValue(r, s.value),
          label: s.designation,
        }))
      : [{ value: roleOptionValue(r), label: roleDisplayName(r) }],
  )
// Project Coordinator/Associate may only grant Project Officer access — the
// backend enforces this too, restricting the dropdown is just so the request
// never round-trips to a 403.
const OFFICER_MANAGER_ROLES = [ROLE.PROJECT_COORDINATOR, ROLE.PROJECT_ASSOCIATE]
// Roles with a Staff & Payroll link worth showing project assignments for.
const PROJECT_LINKED_ROLES = [ROLE.PROJECT_ASSOCIATE, ROLE.PROJECT_OFFICER]

const ROLE_COLORS = {
  [ROLE.ADMIN]: 'danger',
  [ROLE.CEO]: 'dark',
  [ROLE.HEADS]: 'primary',
  [ROLE.HR]: 'info',
  [ROLE.PROJECT_COORDINATOR]: 'warning',
  [ROLE.PROJECT_ASSOCIATE]: 'secondary',
  [ROLE.PROJECT_OFFICER]: 'secondary',
  [ROLE.EMPLOYEE]: 'light',
}

const EMPTY_FORM = {
  full_name: '',
  google_email: '',
  role: ROLE.EMPLOYEE,
  employee_id: '',
  pa_specialization: '',
}
const PAGE_SIZE = 25

const UserManagementPage = () => {
  const { user } = useAuth()
  const isAdmin = user?.role === ROLE.ADMIN
  const isOfficerManager = OFFICER_MANAGER_ROLES.includes(user?.role)
  const emptyForm = () => ({
    ...EMPTY_FORM,
    role: isOfficerManager ? ROLE.PROJECT_OFFICER : EMPTY_FORM.role,
  })
  const location = useLocation()
  const navigate = useNavigate()
  // The sidebar's "Add User" item links straight here (/add) so it isn't
  // just a relabeled duplicate of "Registered Users" — landing on this path
  // opens the modal immediately instead of requiring an extra click.
  const isAddRoute = location.pathname.endsWith('/add')

  const [users, setUsers] = useState([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(isAddRoute)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [success, setSuccess] = useState('')
  const [successColor, setSuccessColor] = useState('success')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [expandedProjects, setExpandedProjects] = useState([])
  const [expandedLoading, setExpandedLoading] = useState(false)

  useEffect(() => {
    if (isAddRoute) setShowModal(true) // eslint-disable-line react-hooks/set-state-in-effect
  }, [isAddRoute])

  const refresh = useCallback(() => {
    setLoading(true)
    setLoadError('')
    return listUserAccounts()
      .then((data) => setUsers(data))
      .catch((err) =>
        setLoadError(err.response?.data?.detail || err.message || 'Failed to load users'),
      )
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh() // eslint-disable-line react-hooks/set-state-in-effect
  }, [refresh])

  // Clamp back onto the last real page if a delete (or a fresh load) leaves
  // the current page past the end of the list.
  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(users.length / PAGE_SIZE))
    if (page > lastPage) setPage(lastPage) // eslint-disable-line react-hooks/set-state-in-effect
  }, [users, page])

  const closeModal = () => {
    setShowModal(false)
    if (isAddRoute) navigate('/ems/user-management')
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      // pa_specialization is a client-side-only hint (which specialization option
      // was picked in the Role select) — the backend's UserAccountCreate schema
      // has no such field, so it's stripped before the account is created and
      // applied separately below via the Staff & Payroll designation.
      const { pa_specialization, ...payload } = form
      const created = await createUserAccount(payload)

      let designationWarning = ''
      if (form.role === ROLE.PROJECT_ASSOCIATE && pa_specialization) {
        const spec = PA_SPECIALIZATIONS.find((s) => s.value === pa_specialization)
        try {
          await localEmployees.setDesignation(form.employee_id, spec.designation)
        } catch (err) {
          designationWarning =
            ` The account was created, but the Staff & Payroll designation could not be ` +
            `updated to "${spec.designation}" — set it manually in Staff & Payroll. ` +
            `(${err.message || 'Unknown error'})`
        }
      }

      setSuccessColor(created.email_sent && !designationWarning ? 'success' : 'warning')
      setSuccess(
        (created.email_sent
          ? `${form.full_name} has been registered successfully.`
          : `${form.full_name} was registered, but the welcome email could not be sent. ` +
            `AWS SES is in sandbox mode — verify ${form.google_email} in the SES console, then resend the invite.`) +
          designationWarning,
      )
      closeModal()
      setForm(emptyForm())
      await refresh()
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to register user')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteUserAccount(deleteTarget.id)
      setDeleteTarget(null)
      await refresh()
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to remove user')
      setDeleteTarget(null)
    }
  }

  const canDelete = (u) => {
    // Officer managers (PC/PA) can grant access but never remove it — the
    // backend blocks this too (DELETE stays HR/Admin-only).
    if (isOfficerManager) return false
    if (!isAdmin && u.role === ROLE.ADMIN) return false
    return u.google_email !== user?.google_email
  }

  const totalPages = Math.ceil(users.length / PAGE_SIZE)
  const pagedUsers = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const toggleExpand = async (u) => {
    if (!PROJECT_LINKED_ROLES.includes(u.role) || !u.employee_id) return
    if (expandedId === u.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(u.id)
    setExpandedProjects([])
    setExpandedLoading(true)
    try {
      const projects = await localOfficers.getProjectsForEmployeeCode(u.employee_id)
      setExpandedProjects(projects)
    } finally {
      setExpandedLoading(false)
    }
  }

  return (
    <>
      <div className="d-flex align-items-start justify-content-between mb-4 gap-3">
        <div>
          <h4 className="fw-semibold mb-1">User Management</h4>
          <p className="text-body-secondary small mb-0">
            Only registered Google accounts can log in to HMA IEMS.
          </p>
        </div>
        <CButton
          color="primary"
          onClick={() => {
            setShowModal(true)
            setError('')
          }}
        >
          <CIcon icon={cilPlus} className="me-1" />
          Add User
        </CButton>
      </div>

      {loadError && (
        <CAlert color="danger" dismissible onClose={() => setLoadError('')} className="mb-3">
          {loadError}
        </CAlert>
      )}

      {success && (
        <CAlert color={successColor} dismissible onClose={() => setSuccess('')} className="mb-3">
          {success}
        </CAlert>
      )}

      <CCard>
        <CCardHeader className="fw-semibold">Registered Users ({users.length})</CCardHeader>
        <CCardBody className="p-0">
          <CTable hover responsive className="mb-0">
            <CTableHead color="light">
              <CTableRow>
                <CTableHeaderCell>Name</CTableHeaderCell>
                <CTableHeaderCell>Google Email</CTableHeaderCell>
                <CTableHeaderCell>Role</CTableHeaderCell>
                <CTableHeaderCell>Employee ID</CTableHeaderCell>
                <CTableHeaderCell>Date Added</CTableHeaderCell>
                <CTableHeaderCell></CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {loading && (
                <CTableRow>
                  <CTableDataCell colSpan={6} className="text-center py-4">
                    <CSpinner size="sm" />
                  </CTableDataCell>
                </CTableRow>
              )}
              {!loading &&
                pagedUsers.map((u) => {
                  const expandable = PROJECT_LINKED_ROLES.includes(u.role) && u.employee_id
                  const isExpanded = expandedId === u.id
                  return (
                    <React.Fragment key={u.id}>
                      <CTableRow
                        style={expandable ? { cursor: 'pointer' } : undefined}
                        onClick={expandable ? () => toggleExpand(u) : undefined}
                      >
                        <CTableDataCell className="fw-medium">
                          {expandable && (
                            <CIcon
                              icon={isExpanded ? cilChevronTop : cilChevronBottom}
                              size="sm"
                              className="me-2 text-body-secondary"
                            />
                          )}
                          {u.full_name}
                        </CTableDataCell>
                        <CTableDataCell className="text-body-secondary">
                          {u.google_email}
                        </CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={ROLE_COLORS[u.role] || 'secondary'}>
                            {roleDisplayName(u.role)}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell className="text-body-secondary small">
                          {u.employee_id || <span className="text-body-tertiary">Not linked</span>}
                        </CTableDataCell>
                        <CTableDataCell className="text-body-secondary small">
                          {new Date(u.created_at).toLocaleDateString()}
                        </CTableDataCell>
                        <CTableDataCell className="text-end">
                          {canDelete(u) && (
                            <CButton
                              color="danger"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteTarget(u)
                              }}
                            >
                              <CIcon icon={cilTrash} />
                            </CButton>
                          )}
                        </CTableDataCell>
                      </CTableRow>
                      {isExpanded && (
                        <CTableRow>
                          <CTableDataCell colSpan={6} className="bg-body-tertiary small py-2">
                            {expandedLoading ? (
                              <CSpinner size="sm" />
                            ) : expandedProjects.length === 0 ? (
                              <span className="text-body-secondary fst-italic">
                                Not assigned to any project yet.
                              </span>
                            ) : (
                              <div className="d-flex flex-wrap gap-2">
                                {expandedProjects.map((p) => (
                                  <CBadge key={p.id} color="light" className="text-dark border">
                                    {p.name || p.project_code}
                                  </CBadge>
                                ))}
                              </div>
                            )}
                          </CTableDataCell>
                        </CTableRow>
                      )}
                    </React.Fragment>
                  )
                })}
              {!loading && !loadError && users.length === 0 && (
                <CTableRow>
                  <CTableDataCell colSpan={6}>
                    <div className="hma-empty-state">
                      <CIcon icon={cilPeople} className="hma-empty-state__icon" />
                      <p className="hma-empty-state__title">No users registered yet</p>
                      <p className="hma-empty-state__desc">
                        Add users to grant them access to HMA IEMS.
                      </p>
                    </div>
                  </CTableDataCell>
                </CTableRow>
              )}
              {!loading && loadError && (
                <CTableRow>
                  <CTableDataCell colSpan={6} className="text-center text-body-secondary py-4">
                    Couldn&apos;t load the user list — see the error above.
                  </CTableDataCell>
                </CTableRow>
              )}
            </CTableBody>
          </CTable>
          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center p-3 border-top">
              <small className="text-body-secondary">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, users.length)} of{' '}
                {users.length}
              </small>
              <CPagination size="sm" className="mb-0">
                <CPaginationItem disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Previous
                </CPaginationItem>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                  <CPaginationItem key={p} active={p === page} onClick={() => setPage(p)}>
                    {p}
                  </CPaginationItem>
                ))}
                <CPaginationItem disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                  Next
                </CPaginationItem>
              </CPagination>
            </div>
          )}
        </CCardBody>
      </CCard>

      {/* ── Add User Modal ── */}
      <CModal visible={showModal} onClose={closeModal}>
        <CModalHeader>
          <CModalTitle>Register New User</CModalTitle>
        </CModalHeader>
        <CForm onSubmit={handleAdd}>
          <CModalBody>
            {error && (
              <CAlert color="danger" className="mb-3">
                {error}
              </CAlert>
            )}
            <div className="mb-3">
              <CFormLabel>Full Name</CFormLabel>
              <CFormInput
                placeholder="e.g. John Doe"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                required
              />
            </div>
            <div className="mb-3">
              <CFormLabel>Google Email</CFormLabel>
              <CFormInput
                type="email"
                placeholder="name@gmail.com"
                value={form.google_email}
                onChange={(e) => setForm((f) => ({ ...f, google_email: e.target.value }))}
                required
              />
              <div className="form-text">This must match the user's Google account exactly.</div>
            </div>
            <div className="mb-3">
              <CFormLabel>Role</CFormLabel>
              <CFormSelect
                value={roleOptionValue(form.role, form.pa_specialization)}
                onChange={(e) => {
                  const [role, pa_specialization = ''] = e.target.value.split('::')
                  setForm((f) => ({ ...f, role, pa_specialization }))
                }}
                disabled={isOfficerManager}
                required
              >
                {roleSelectOptions(
                  isAdmin
                    ? [ROLE.ADMIN, ...ASSIGNABLE_ROLES]
                    : isOfficerManager
                      ? [ROLE.PROJECT_OFFICER]
                      : ASSIGNABLE_ROLES,
                ).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </CFormSelect>
              {isOfficerManager && (
                <div className="form-text">You can only grant Project Officer access.</div>
              )}
            </div>
            <div className="mb-3">
              <CFormLabel>Employee ID {form.pa_specialization ? '' : '(optional)'}</CFormLabel>
              <CFormInput
                placeholder="e.g. EMP2408"
                value={form.employee_id}
                onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
                required={!!form.pa_specialization}
              />
              <div className="form-text">
                {form.pa_specialization
                  ? 'Required for this specialization — it sets the matching designation on the ' +
                    "employee's Staff & Payroll record, which is what scopes their PMS view."
                  : 'Link this login to an existing Staff & Payroll record so the employee can see ' +
                    'their own data. Leave blank if this person has no staff record (e.g. an ' +
                    'external/admin account).'}
              </div>
            </div>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="ghost" onClick={closeModal}>
              Cancel
            </CButton>
            <CButton color="primary" type="submit" disabled={saving}>
              {saving && <CSpinner size="sm" className="me-1" />}
              Register User
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>

      {/* ── Delete Confirm Modal ── */}
      <CModal visible={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <CModalHeader>
          <CModalTitle>Remove User</CModalTitle>
        </CModalHeader>
        <CModalBody>
          Remove <strong>{deleteTarget?.full_name}</strong> ({deleteTarget?.google_email}) from the
          system? They will no longer be able to log in.
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" onClick={() => setDeleteTarget(null)}>
            Cancel
          </CButton>
          <CButton color="danger" onClick={handleDelete}>
            Remove
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default UserManagementPage
