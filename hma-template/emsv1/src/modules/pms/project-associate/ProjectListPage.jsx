/**
 * ProjectListPage.jsx — All projects list with search, filter, and actions.
 * Route: /pms/projects
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  CToaster,
  CToast,
  CToastBody,
  CToastClose,
  CDropdown,
  CDropdownToggle,
  CDropdownMenu,
  CDropdownItem,
  CSpinner,
  CPagination,
  CPaginationItem,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilPlus,
  cilSearch,
  cilFilterX,
  cilPen,
  cilArrowRight,
  cilPeople,
  cilOptions,
  cilFolder,
  cilTrash,
  cilReload,
} from '@coreui/icons'
import { localProjects } from '../../../services/localProjects'
import useRole from '../../../hooks/useRole'
import useAuth from '../../../hooks/useAuth'
import { ROLE } from '../../../constants/roles'
import DeleteProjectConfirmModal from './DeleteProjectConfirmModal'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)

const STATUS_META = {
  pipeline: { label: 'Pipeline', color: 'secondary' },
  approved: { label: 'Approved', color: 'info' },
  ongoing: { label: 'Ongoing', color: 'primary' },
  completed: { label: 'Completed', color: 'success' },
}

const DEPT_META = {
  community_development: { label: 'Community Development', color: 'success' },
  public_health: { label: 'Public Health', color: 'info' },
}

const ProjectListPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [projects, setProjects] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const PAGE_SIZE = 25
  const [filters, setFilters] = useState({
    search: '',
    status: searchParams.get('status') || '',
    phase: '',
    dept: searchParams.get('dept') || '',
  })
  const [toast, setToast] = useState(null)
  const [deleteModal, setDeleteModal] = useState({ visible: false, project: null })
  const [reloadKey, setReloadKey] = useState(0)
  const [reloading, setReloading] = useState(false)
  const [paSpecialization, setPaSpecialization] = useState(null)
  const [paId, setPaId] = useState('')
  const [stats, setStats] = useState({
    total: 0,
    ongoing: 0,
    approved: 0,
    pipeline: 0,
    completed: 0,
  })

  const role = useRole()
  const { user } = useAuth()
  const isPA = role === ROLE.PROJECT_ASSOCIATE
  const canDelete =
    role === ROLE.PROJECT_OFFICER ||
    role === ROLE.PROJECT_ASSOCIATE ||
    role === ROLE.PROJECT_COORDINATOR

  // Sync filter when URL ?status= or ?dept= changes
  useEffect(() => {
    const s = searchParams.get('status') || ''
    const d = searchParams.get('dept') || ''
    setFilters((prev) => ({ ...prev, status: s, dept: d }))
  }, [searchParams])

  // PAs have a fixed specialization derived from their employee record, plus
  // their own employees.id UUID to catch projects explicitly assigned to them
  // by the Coordinator outside that specialization.
  useEffect(() => {
    let cancelled = false
    if (!isPA) {
      setPaSpecialization(null)
      setPaId('')
      return
    }
    Promise.all([
      localProjects.getPaSpecialization(user?.employee_id),
      localProjects.resolveEmployeeUuidByCode(user?.employee_id),
    ]).then(([spec, uuid]) => {
      if (cancelled) return
      setPaSpecialization(spec)
      setPaId(uuid || '')
    })
    return () => {
      cancelled = true
    }
  }, [isPA, user?.employee_id])

  const load = useCallback(async () => {
    // PAs see projects matching their fixed specialization, plus anything
    // explicitly assigned to them; all other roles see everything.
    const result = await localProjects.list({
      ...filters,
      specialization: isPA ? paSpecialization || '' : '',
      paId: isPA ? paId : '',
      page,
      pageSize: PAGE_SIZE,
    })
    return result
  }, [filters, isPA, paSpecialization, paId, page])

  useEffect(() => {
    let cancelled = false
    load().then((result) => {
      if (cancelled) return
      setProjects(result.items)
      setTotal(result.total)
      setTotalPages(result.total_pages)
      setReloading(false)
    })
    return () => {
      cancelled = true
    }
  }, [load, reloadKey])

  const activeDept = DEPT_META[filters.dept] || null

  // Compute stat-chip counts:
  // – PAs see only their own projects scoped stats
  // – All other roles see dept-filtered pool totals (so chips reflect category view)
  useEffect(() => {
    let cancelled = false
    async function computeStats() {
      if (isPA) {
        const s = await localProjects.getStatsForSpecialization(paSpecialization || '', paId)
        if (!cancelled) setStats(s)
        return
      }
      const deptResult = await localProjects.list({ dept: filters.dept, pageSize: 9999 })
      if (cancelled) return
      const deptPool = deptResult.items
      setStats({
        total: deptPool.length,
        ongoing: deptPool.filter((p) => p.status === 'ongoing').length,
        approved: deptPool.filter((p) => p.status === 'approved').length,
        pipeline: deptPool.filter((p) => p.status === 'pipeline').length,
        completed: deptPool.filter((p) => p.status === 'completed').length,
      })
    }
    computeStats()
    return () => {
      cancelled = true
    }
  }, [isPA, paSpecialization, paId, filters.dept, reloadKey])

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
    setPage(1)
  }

  const clearFilters = () => {
    setFilters({ search: '', status: '', phase: '', dept: '' })
    setPage(1)
  }

  const handleDeleteConfirm = async () => {
    const proj = deleteModal.project
    try {
      await localProjects.remove(proj.id)
    } catch (err) {
      setDeleteModal({ visible: false, project: null })
      setToast({ color: 'danger', message: err.message || 'Failed to delete project' })
      return
    }
    setDeleteModal({ visible: false, project: null })
    setToast({ color: 'success', message: `"${proj.name}" was deleted.` })
    const result = await load()
    setProjects(result.items)
    setTotal(result.total)
    setTotalPages(result.total_pages)
  }

  return (
    <>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <h4 className="fw-bold mb-0">
              {activeDept ? activeDept.label + ' Projects' : 'All Projects'}
            </h4>
            {activeDept && (
              <CBadge color={activeDept.color} shape="rounded-pill" className="px-2">
                {filters.dept === 'community_development' ? 'CD' : 'PH'}
              </CBadge>
            )}
          </div>
          <p className="text-body-secondary mb-0 small">
            {total} project{total !== 1 ? 's' : ''} total
            {activeDept && (
              <span className="ms-1">
                · filtered by{' '}
                <span className={`text-${activeDept.color} fw-medium`}>{activeDept.label}</span>
              </span>
            )}
          </p>
        </div>
        <div className="d-flex gap-2">
          <CButton
            color="secondary"
            variant="outline"
            onClick={() => {
              setReloading(true)
              setReloadKey((k) => k + 1)
            }}
            disabled={reloading}
          >
            {reloading ? (
              <CSpinner size="sm" className="me-1" />
            ) : (
              <CIcon icon={cilReload} className="me-1" />
            )}
            Reload
          </CButton>
          <CButton
            color="primary"
            className="shadow-sm"
            onClick={() => navigate('/pms/projects/create')}
          >
            <CIcon icon={cilPlus} className="me-1" />
            Create Project
          </CButton>
        </div>
      </div>

      {/* Stat chips */}
      <div className="d-flex gap-2 flex-wrap mb-4">
        {[
          { label: 'All', value: stats.total, status: '' },
          { label: 'Ongoing', value: stats.ongoing, status: 'ongoing', color: 'primary' },
          { label: 'Approved', value: stats.approved, status: 'approved', color: 'info' },
          { label: 'Pipeline', value: stats.pipeline, status: 'pipeline', color: 'secondary' },
          { label: 'Completed', value: stats.completed, status: 'completed', color: 'success' },
        ].map((chip) => (
          <button
            key={chip.status}
            className={`btn btn-sm px-3 fw-medium ${
              filters.status === chip.status ? 'btn-primary' : 'btn-light border'
            }`}
            style={{ borderRadius: '20px' }}
            onClick={() => handleFilterChange('status', chip.status)}
          >
            {chip.label}
            <span
              className={`ms-2 badge rounded-pill ${
                filters.status === chip.status
                  ? 'text-white bg-primary-subtle'
                  : 'bg-secondary text-white'
              }`}
            >
              {chip.value}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <CCard className="mb-3 shadow-sm border-0" style={{ borderRadius: '12px' }}>
        <CCardBody className="py-3">
          <CRow className="g-2 align-items-end">
            <CCol xs={12} md={5}>
              <CInputGroup size="sm">
                <CInputGroupText className="bg-transparent">
                  <CIcon icon={cilSearch} size="sm" />
                </CInputGroupText>
                <CFormInput
                  placeholder="Search by name, location, officer..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
              </CInputGroup>
            </CCol>
            <CCol xs={6} md={3}>
              <CFormSelect
                size="sm"
                value={filters.phase}
                onChange={(e) => handleFilterChange('phase', e.target.value)}
              >
                <option value="">All Phases</option>
                <option value="design_and_initiation">Design and Initiation</option>
                <option value="implementation">Implementation</option>
                <option value="monitoring_and_evaluation">Monitoring and Evaluation</option>
              </CFormSelect>
            </CCol>
            <CCol xs={6} md={2}>
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

      {/* Table */}
      <CCard className="border-0 shadow-sm" style={{ borderRadius: '12px' }}>
        <CTable hover responsive className="mb-0" style={{ fontSize: '0.875rem' }}>
          <CTableHead className="bg-body-tertiary">
            <CTableRow>
              <CTableHeaderCell className="border-0 py-3 ps-4" style={{ width: '22%' }}>
                Project
              </CTableHeaderCell>
              <CTableHeaderCell className="border-0 py-3">Code</CTableHeaderCell>
              <CTableHeaderCell className="border-0 py-3">Type</CTableHeaderCell>
              <CTableHeaderCell className="border-0 py-3">Officer</CTableHeaderCell>
              <CTableHeaderCell className="border-0 py-3">Value</CTableHeaderCell>
              <CTableHeaderCell className="border-0 py-3">Amount Received</CTableHeaderCell>
              <CTableHeaderCell className="border-0 py-3">Status</CTableHeaderCell>
              <CTableHeaderCell className="border-0 py-3 text-end pe-4">Actions</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {projects.map((p) => {
              const sm = STATUS_META[p.status] || { label: p.status, color: 'secondary' }
              return (
                <CTableRow
                  key={p.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/pms/projects/${p.id}`)}
                >
                  <CTableDataCell className="py-3 ps-4">
                    <div className="fw-semibold">{p.name}</div>
                    <div className="text-body-secondary" style={{ fontSize: '0.75rem' }}>
                      {p.location} · {p.funding_agency}
                    </div>
                  </CTableDataCell>
                  <CTableDataCell className="py-3">
                    <span
                      className="fw-medium text-body-secondary small"
                      style={{ letterSpacing: '0.5px' }}
                    >
                      {p.project_code || '—'}
                    </span>
                  </CTableDataCell>
                  <CTableDataCell className="py-3">
                    <span className="text-body-secondary small">{p.project_type || '—'}</span>
                  </CTableDataCell>
                  <CTableDataCell className="py-3">
                    {p.officer_name ? (
                      <div>
                        <div className="fw-medium">{p.officer_name}</div>
                        {p.email_sent && (
                          <span className="text-success" style={{ fontSize: '0.7rem' }}>
                            Emailed
                          </span>
                        )}
                      </div>
                    ) : (
                      <span
                        className="text-danger small fw-medium"
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/pms/projects/${p.id}/edit`)
                        }}
                      >
                        + Assign Officer
                      </span>
                    )}
                    {p.project_associate_name && (
                      <div className="text-body-secondary" style={{ fontSize: '0.7rem' }}>
                        PA: {p.project_associate_name}
                      </div>
                    )}
                  </CTableDataCell>
                  <CTableDataCell className="py-3 fw-semibold">
                    {fmt(p.project_value)}
                  </CTableDataCell>
                  <CTableDataCell className="py-3">
                    <div className="text-success fw-medium">{fmt(p.amount_received)}</div>
                    {p.project_value > 0 && (
                      <div className="text-body-secondary" style={{ fontSize: '0.7rem' }}>
                        {Math.round((p.amount_received / p.project_value) * 100)}% of total
                      </div>
                    )}
                  </CTableDataCell>
                  <CTableDataCell className="py-3">
                    <CBadge color={sm.color} shape="rounded-pill" className="px-2 text-capitalize">
                      {sm.label}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell className="py-3 pe-4 text-end">
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
                            navigate(`/pms/projects/${p.id}`)
                          }}
                        >
                          <CIcon icon={cilArrowRight} className="me-2" />
                          View Details
                        </CDropdownItem>
                        <CDropdownItem
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/pms/projects/${p.id}/edit`)
                          }}
                        >
                          <CIcon icon={cilPen} className="me-2" />
                          Edit Project
                        </CDropdownItem>
                        <CDropdownItem
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/pms/projects/${p.id}/edit#officer`)
                          }}
                        >
                          <CIcon icon={cilPeople} className="me-2" />
                          Assign Officer
                        </CDropdownItem>
                        {canDelete && (
                          <CDropdownItem
                            className="text-danger"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteModal({ visible: true, project: p })
                            }}
                          >
                            <CIcon icon={cilTrash} className="me-2" />
                            Delete Project
                          </CDropdownItem>
                        )}
                      </CDropdownMenu>
                    </CDropdown>
                  </CTableDataCell>
                </CTableRow>
              )
            })}
          </CTableBody>
        </CTable>

        {projects.length === 0 && (
          <div className="text-center py-5">
            <div className="mb-2 text-body-secondary">
              <CIcon icon={cilFolder} style={{ width: 48, height: 48 }} />
            </div>
            <h5 className="text-body-secondary">No projects found</h5>
            <p className="text-body-tertiary">
              {filters.search || filters.status || filters.phase
                ? 'Try adjusting your filters'
                : 'Get started by creating your first project'}
            </p>
            {!filters.search && !filters.status && (
              <CButton color="primary" onClick={() => navigate('/pms/projects/create')}>
                <CIcon icon={cilPlus} className="me-1" />
                Create Project
              </CButton>
            )}
          </div>
        )}

        {totalPages > 1 && (
          <div className="d-flex justify-content-between align-items-center px-4 py-3 border-top">
            <small className="text-body-secondary">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
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
      </CCard>

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

      <DeleteProjectConfirmModal
        visible={deleteModal.visible}
        project={deleteModal.project}
        onClose={() => setDeleteModal({ visible: false, project: null })}
        onConfirm={handleDeleteConfirm}
      />
    </>
  )
}

export default ProjectListPage
