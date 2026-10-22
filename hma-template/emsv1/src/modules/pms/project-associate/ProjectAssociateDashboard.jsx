import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRow,
  CCol,
  CCard,
  CCardBody,
  CCardHeader,
  CButton,
  CBadge,
  CProgress,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilPlus,
  cilFolder,
  cilPeople,
  cilCheckCircle,
  cilClock,
  cilArrowRight,
} from '@coreui/icons'
import { localProjects } from '../../../services/localProjects'
import useAuth from '../../../hooks/useAuth'
import useRole from '../../../hooks/useRole'
import { ROLE } from '../../../constants/roles'

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

const PHASE_META = {
  design_and_initiation: { label: 'Design and Initiation', color: '#5bc0de' },
  implementation: { label: 'Implementation', color: '#337ab7' },
  monitoring_and_evaluation: { label: 'Monitoring and Evaluation', color: '#06d6a0' },
}

const ProjectAssociateDashboard = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = useRole()
  const isPA = role === ROLE.PROJECT_ASSOCIATE
  const isCoordinator = role === ROLE.PROJECT_COORDINATOR
  const [stats, setStats] = useState(null)
  const [recentProjects, setRecentProjects] = useState([])
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    // PAs are scoped to their fixed specialization, plus anything the
    // Coordinator explicitly assigned to them outside it; Coordinator (and
    // everyone else) sees everything.
    const specialization = isPA
      ? (await localProjects.getPaSpecialization(user?.employee_id)) || ''
      : ''
    const paId = isPA
      ? (await localProjects.resolveEmployeeUuidByCode(user?.employee_id)) || ''
      : ''
    const nextStats = isPA
      ? await localProjects.getStatsForSpecialization(specialization, paId)
      : await localProjects.getStats()
    const { items } = await localProjects.list({ pageSize: 5, specialization, paId })
    return { nextStats, items }
  }, [isPA, user?.employee_id])

  useEffect(() => {
    let cancelled = false
    load()
      .then(({ nextStats, items }) => {
        if (cancelled) return
        setStats(nextStats)
        setRecentProjects(items)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err?.message || 'Failed to load dashboard data.')
      })
    return () => {
      cancelled = true
    }
  }, [load])

  if (loadError) {
    return <CAlert color="danger">Failed to load the dashboard: {loadError}</CAlert>
  }

  if (!stats) return null

  const kpiCards = [
    {
      label: 'Pipeline',
      value: stats.pipeline,
      icon: cilFolder,
      color: '#f0ad4e',
      bg: 'rgba(240,173,78,0.08)',
      sub: 'Awaiting approval',
    },
    {
      label: 'Approved',
      value: stats.approved,
      icon: cilCheckCircle,
      color: '#0dcaf0',
      bg: 'rgba(13,202,240,0.08)',
      sub: 'Ready to start',
    },
    {
      label: 'Ongoing',
      value: stats.ongoing,
      icon: cilClock,
      color: '#4361ee',
      bg: 'rgba(67,97,238,0.08)',
      sub: 'Currently active',
    },
    {
      label: 'Completed',
      value: stats.completed,
      icon: cilCheckCircle,
      color: '#06d6a0',
      bg: 'rgba(6,214,160,0.08)',
      sub: 'Successfully finished',
    },
  ]

  return (
    <>
      {/* Hero Header */}
      <div
        className="rounded-4 mb-4 px-4 py-4 text-white position-relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)',
          minHeight: '120px',
        }}
      >
        <div
          className="position-absolute top-0 end-0 opacity-10"
          style={{ fontSize: '8rem', lineHeight: 1, marginTop: '-1rem' }}
        >
          🏗️
        </div>
        <div className="position-relative">
          <h3 className="fw-bold mb-1">
            {isCoordinator ? 'Project Coordinator Dashboard' : 'Project Associate Dashboard'}
          </h3>
          <p className="mb-3 opacity-75">
            {isCoordinator
              ? 'Oversee both specializations, assign officers, and track progress'
              : 'Manage your projects, assign officers, and track progress'}
          </p>
          <div className="d-flex gap-2 flex-wrap">
            {!isCoordinator && (
              <CButton
                color="light"
                size="sm"
                className="fw-semibold text-primary"
                onClick={() => navigate('/pms/projects/create')}
              >
                <CIcon icon={cilPlus} className="me-1" />
                New Project
              </CButton>
            )}
            <CButton
              color="light"
              variant="outline"
              size="sm"
              className="text-white border-white"
              onClick={() => navigate('/pms/project-teams/officers')}
            >
              <CIcon icon={cilPeople} className="me-1" />
              Project Officers
            </CButton>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <CRow className="g-3 mb-4">
        {kpiCards.map((card, i) => (
          <CCol key={i} xs={12} sm={6} xl={3}>
            <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
              <CCardBody className="d-flex align-items-center gap-3 py-3">
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ width: 52, height: 52, background: card.bg }}
                >
                  <CIcon icon={card.icon} style={{ color: card.color, width: 24, height: 24 }} />
                </div>
                <div className="min-w-0">
                  <div className="fw-bold fs-5 lh-1 mb-1" style={{ color: card.color }}>
                    {card.value}
                  </div>
                  <div className="fw-semibold small text-body">{card.label}</div>
                  <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                    {card.sub}
                  </div>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>

      <CRow className="g-4">
        {/* Left: Phase Breakdown */}
        <CCol xs={12} lg={4}>
          <CCard className="border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
            <CCardBody className="pt-4">
              <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">
                Projects by Phase
              </h6>
              {Object.entries(PHASE_META).map(([phase, meta]) => {
                const count = recentProjects.filter((p) => p.phase === phase).length
                const total = Math.max(recentProjects.length, 1)
                return (
                  <div key={phase} className="mb-2">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="small">{meta.label}</span>
                      <span className="small fw-semibold">{count}</span>
                    </div>
                    <CProgress
                      value={(count / total) * 100}
                      height={5}
                      className="rounded-pill"
                      style={{ '--cui-progress-bar-bg': meta.color }}
                    />
                  </div>
                )
              })}
            </CCardBody>
          </CCard>

          {/* Projects by Type */}
          <CCard className="border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
            <CCardBody className="pt-4">
              <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">
                Projects by Type
              </h6>
              {[
                { label: 'Consultancy', count: stats.types?.consultancy || 0, color: '#4361ee' },
                { label: 'Other Public Health', count: stats.types?.health || 0, color: '#2ec4b6' },
                { label: 'M-CUP', count: stats.types?.mcup || 0, color: '#f77f00' },
              ].map((type) => {
                const total = Math.max(stats.total, 1)
                return (
                  <div key={type.label} className="mb-2">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="small">{type.label}</span>
                      <span className="small fw-semibold">{type.count}</span>
                    </div>
                    <CProgress
                      value={(type.count / total) * 100}
                      height={5}
                      className="rounded-pill"
                      style={{ '--cui-progress-bar-bg': type.color }}
                    />
                  </div>
                )
              })}
            </CCardBody>
          </CCard>

          {/* Quick Actions */}
          <CCard className="border-0 shadow-sm" style={{ borderRadius: '12px' }}>
            <CCardHeader className="bg-transparent border-bottom-0 pt-3 pb-0">
              <h6 className="fw-bold mb-0">Quick Actions</h6>
            </CCardHeader>
            <CCardBody className="pt-2">
              {[
                ...(!isCoordinator
                  ? [
                      {
                        label: 'Create New Project',
                        to: '/pms/projects/create',
                        icon: cilPlus,
                        color: '#4361ee',
                      },
                    ]
                  : []),
                {
                  label: 'View All Projects',
                  to: '/pms/projects',
                  icon: cilFolder,
                  color: '#2ec4b6',
                },
                {
                  label: 'Manage Officers',
                  to: '/pms/project-teams/officers',
                  icon: cilPeople,
                  color: '#f77f00',
                },
              ].map((action, i) => (
                <button
                  key={i}
                  className="btn btn-light w-100 text-start mb-2 d-flex align-items-center gap-2 py-2"
                  style={{ borderRadius: '8px', border: '1px solid #f0f0f0' }}
                  onClick={() => navigate(action.to)}
                >
                  <div
                    className="rounded-2 d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{
                      width: 32,
                      height: 32,
                      background: `${action.color}15`,
                    }}
                  >
                    <CIcon
                      icon={action.icon}
                      style={{ color: action.color, width: 16, height: 16 }}
                    />
                  </div>
                  <span className="fw-medium small">{action.label}</span>
                  <CIcon
                    icon={cilArrowRight}
                    className="ms-auto text-body-secondary"
                    style={{ width: 14, height: 14 }}
                  />
                </button>
              ))}
            </CCardBody>
          </CCard>
        </CCol>

        {/* Right: Recent Projects Table */}
        <CCol xs={12} lg={8}>
          <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
            <CCardHeader className="bg-transparent border-bottom d-flex justify-content-between align-items-center py-3">
              <h6 className="fw-bold mb-0">Recent Projects</h6>
              <CButton
                color="primary"
                variant="ghost"
                size="sm"
                onClick={() => navigate('/pms/projects')}
              >
                View All <CIcon icon={cilArrowRight} className="ms-1" />
              </CButton>
            </CCardHeader>
            <CCardBody className="p-0">
              <CTable hover responsive className="mb-0" style={{ fontSize: '0.875rem' }}>
                <CTableHead className="bg-body-tertiary">
                  <CTableRow>
                    <CTableHeaderCell className="border-0 py-3 ps-4">Project</CTableHeaderCell>
                    <CTableHeaderCell className="border-0 py-3">Code</CTableHeaderCell>
                    <CTableHeaderCell className="border-0 py-3">Type</CTableHeaderCell>
                    <CTableHeaderCell className="border-0 py-3">Officer</CTableHeaderCell>
                    <CTableHeaderCell className="border-0 py-3">Value</CTableHeaderCell>
                    <CTableHeaderCell className="border-0 py-3">Status</CTableHeaderCell>
                    <CTableHeaderCell className="border-0 py-3"></CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {recentProjects.map((p) => {
                    const statusMeta = STATUS_META[p.status] || {
                      label: p.status,
                      color: 'secondary',
                    }
                    return (
                      <CTableRow
                        key={p.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/pms/projects/${p.id}`)}
                      >
                        <CTableDataCell className="py-3 ps-4">
                          <div className="fw-semibold text-truncate" style={{ maxWidth: '200px' }}>
                            {p.name}
                          </div>
                          <div className="text-body-secondary" style={{ fontSize: '0.75rem' }}>
                            {p.location}
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
                                <span
                                  className="text-success"
                                  style={{ fontSize: '0.7rem' }}
                                  title="Email sent via SES"
                                >
                                  Invited
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-body-secondary small">Unassigned</span>
                          )}
                          {p.project_associate_name && (
                            <div className="text-body-secondary" style={{ fontSize: '0.7rem' }}>
                              PA: {p.project_associate_name}
                            </div>
                          )}
                        </CTableDataCell>
                        <CTableDataCell className="py-3">
                          <div className="fw-semibold">{fmt(p.project_value)}</div>
                          <div className="text-success" style={{ fontSize: '0.75rem' }}>
                            {fmt(p.amount_received)} received
                          </div>
                        </CTableDataCell>
                        <CTableDataCell className="py-3">
                          <CBadge color={statusMeta.color} shape="rounded-pill" className="px-2">
                            {statusMeta.label}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell className="py-3 pe-3 text-end">
                          <CButton
                            color="primary"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/pms/projects/${p.id}`)
                            }}
                          >
                            <CIcon icon={cilArrowRight} />
                          </CButton>
                        </CTableDataCell>
                      </CTableRow>
                    )
                  })}
                </CTableBody>
              </CTable>
              {recentProjects.length === 0 && (
                <div className="text-center py-5 text-body-secondary">
                  <CIcon icon={cilFolder} style={{ width: 40, height: 40 }} className="mb-1" />
                  <div>No projects yet</div>
                </div>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  )
}

export default ProjectAssociateDashboard
