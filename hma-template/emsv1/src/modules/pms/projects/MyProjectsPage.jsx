/**
 * MyProjectsPage — Project Officer's view of their assigned projects.
 * Route: /pms/projects/my-projects
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRow,
  CCol,
  CCard,
  CCardBody,
  CButton,
  CBadge,
  CProgress,
  CFormInput,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilSearch,
  cilPlus,
  cilLocationPin,
  cilCalendar,
  cilBuilding,
  cilPeople,
  cilFilterX,
} from '@coreui/icons'

import { localProjects, PHASE_CONFIG } from '../../../services/localProjects'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

const ProjectCard = ({ project, onClick }) => {
  const phase = PHASE_CONFIG[project.phase] || PHASE_CONFIG.pipeline
  const utilization =
    project.amount_released > 0
      ? Math.round((project.amount_utilized / project.amount_released) * 100)
      : 0

  const isOverdue =
    project.end_date && project.phase !== 'completed' && new Date(project.end_date) < new Date()

  return (
    <CCard
      className="shadow-sm mb-3 border-start border-4 h-100"
      style={{
        borderColor: `var(--cui-${phase.color})`,
        cursor: 'pointer',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onClick={() => onClick(project.id)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = ''
      }}
    >
      <CCardBody>
        {/* Header */}
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div className="flex-grow-1 me-2">
            <h6 className="fw-bold mb-1" style={{ lineHeight: 1.3 }}>
              {project.title}
            </h6>
          </div>
          <CBadge
            color={phase.color}
            shape="rounded-pill"
            className="text-uppercase px-2 py-1 flex-shrink-0"
            style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}
          >
            {phase.label}
          </CBadge>
        </div>

        {/* Meta info */}
        <div className="d-flex flex-column gap-1 mb-3 small text-body-secondary">
          {project.funding_agency && (
            <div className="d-flex align-items-center gap-1">
              <CIcon icon={cilBuilding} size="sm" className="flex-shrink-0" />
              <span className="text-truncate">{project.funding_agency}</span>
            </div>
          )}
          {project.location && (
            <div className="d-flex align-items-center gap-1">
              <CIcon icon={cilLocationPin} size="sm" className="flex-shrink-0" />
              <span>{project.location}</span>
            </div>
          )}
          <div className="d-flex align-items-center gap-1">
            <CIcon icon={cilCalendar} size="sm" className="flex-shrink-0" />
            <span className={isOverdue ? 'text-danger fw-medium' : ''}>
              {formatDate(project.start_date)} → {formatDate(project.end_date)}
              {isOverdue && ' (Overdue)'}
            </span>
          </div>
          {project.field_personnel?.length > 0 && (
            <div className="d-flex align-items-center gap-1">
              <CIcon icon={cilPeople} size="sm" className="flex-shrink-0" />
              <span>{project.field_personnel.length} Field Personnel</span>
            </div>
          )}
        </div>

        {/* Financial summary */}
        <div className="bg-body-secondary rounded p-2 mb-2">
          <div className="d-flex justify-content-between small mb-1">
            <span className="text-body-secondary">Valuation</span>
            <span className="fw-bold">{formatCurrency(project.project_valuation)}</span>
          </div>
          <div className="d-flex justify-content-between small mb-1">
            <span className="text-body-secondary">Released</span>
            <span className="fw-semibold text-info">{formatCurrency(project.amount_released)}</span>
          </div>
          {project.amount_released > 0 && (
            <>
              <div className="d-flex justify-content-between small text-body-secondary mb-1">
                <span>Utilization</span>
                <span>{utilization}%</span>
              </div>
              <CProgress
                value={utilization}
                color={utilization > 90 ? 'danger' : utilization > 70 ? 'warning' : 'success'}
                height={5}
              />
            </>
          )}
        </div>
      </CCardBody>
    </CCard>
  )
}

const MyProjectsPage = () => {
  const navigate = useNavigate()
  const OFFICER_ID = 'po_001' // Demo hardcoded; replace with auth context

  const [projects, setProjects] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [phase, setPhase] = useState('')
  const [stats, setStats] = useState({
    total: 0,
    ongoing: 0,
    approved: 0,
    pipeline: 0,
    completed: 0,
  })

  const loadProjects = useCallback(async () => {
    const result = await localProjects.list({ search, phase, officerId: OFFICER_ID })
    return result
  }, [search, phase])

  useEffect(() => {
    let cancelled = false
    loadProjects().then((result) => {
      if (cancelled) return
      setProjects(result.items)
      setTotal(result.total)
    })
    return () => {
      cancelled = true
    }
  }, [loadProjects])

  // Summary stats
  useEffect(() => {
    let cancelled = false
    localProjects.getByOfficer(OFFICER_ID).then((all) => {
      if (cancelled) return
      setStats({
        total: all.length,
        ongoing: all.filter((p) => p.phase === 'ongoing').length,
        approved: all.filter((p) => p.phase === 'approved').length,
        pipeline: all.filter((p) => p.phase === 'pipeline').length,
        completed: all.filter((p) => p.phase === 'completed').length,
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="mb-1 fw-semibold">My Projects</h4>
          <p className="text-body-secondary small mb-0">{stats.total} projects assigned to you</p>
        </div>
        <CButton color="primary" onClick={() => navigate('/pms/projects/create')}>
          <CIcon icon={cilPlus} className="me-1" />
          Create Project
        </CButton>
      </div>

      {/* Summary stats */}
      <CRow className="g-3 mb-4">
        {[
          { label: 'Ongoing', count: stats.ongoing, color: 'primary' },
          { label: 'Approved', count: stats.approved, color: 'info' },
          { label: 'Pipeline', count: stats.pipeline, color: 'secondary' },
          { label: 'Completed', count: stats.completed, color: 'success' },
        ].map((s) => (
          <CCol key={s.label} xs={6} md={3}>
            <CCard
              className="shadow-sm border-0 text-center py-3"
              style={{ cursor: 'pointer' }}
              onClick={() => setPhase(phase === s.label.toLowerCase() ? '' : s.label.toLowerCase())}
            >
              <div className={`fs-2 fw-bold text-${s.color}`}>{s.count}</div>
              <CBadge color={s.color} shape="rounded-pill" className="mx-auto px-3">
                {s.label}
              </CBadge>
            </CCard>
          </CCol>
        ))}
      </CRow>

      {/* Filters */}
      <CRow className="g-2 mb-3">
        <CCol xs={12} md={6}>
          <CInputGroup>
            <CInputGroupText>
              <CIcon icon={cilSearch} size="sm" />
            </CInputGroupText>
            <CFormInput
              placeholder="Search by title, funding agency, location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </CInputGroup>
        </CCol>
        <CCol xs={8} md={4}>
          <CFormSelect value={phase} onChange={(e) => setPhase(e.target.value)}>
            <option value="">All Phases</option>
            <option value="pipeline">Pipeline</option>
            <option value="approved">Approved</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
          </CFormSelect>
        </CCol>
        <CCol xs={4} md={2}>
          <CButton
            color="secondary"
            variant="ghost"
            className="w-100"
            onClick={() => {
              setSearch('')
              setPhase('')
            }}
          >
            <CIcon icon={cilFilterX} size="sm" className="me-1" /> Clear
          </CButton>
        </CCol>
      </CRow>

      {/* Project cards */}
      {projects.length === 0 ? (
        <CAlert color="info" className="text-center">
          No projects found.{' '}
          <strong
            className="text-primary"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/pms/projects/create')}
          >
            Create your first project →
          </strong>
        </CAlert>
      ) : (
        <CRow className="g-3">
          {projects.map((project) => (
            <CCol key={project.id} xs={12} md={6} xl={4}>
              <ProjectCard project={project} onClick={(id) => navigate(`/pms/projects/${id}`)} />
            </CCol>
          ))}
        </CRow>
      )}
    </>
  )
}

export default MyProjectsPage
