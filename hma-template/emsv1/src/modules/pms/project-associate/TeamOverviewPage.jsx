/**
 * TeamOverviewPage.jsx — Project Associate view of all Project Officers & their Field Personnel.
 * Route: /pms/pa/team-overview
 *
 * Shows:
 *  • Summary KPI strip (total officers, field personnel, pending reports, avg progress)
 *  • Per-officer card: their projects, progress, field personnel list + last report date
 *  • Colour-coded activity badges (active vs inactive personnel)
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRow,
  CCol,
  CCard,
  CCardBody,
  CCardHeader,
  CBadge,
  CButton,
  CProgress,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CCollapse,
  CTooltip,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilSearch,
  cilPeople,
  cilFolder,
  cilUser,
  cilArrowRight,
  cilCheckCircle,
  cilChevronBottom,
  cilChevronTop,
  cilWarning,
  cilClock,
} from '@coreui/icons'
import { localProjects, localOfficers } from '../../../services/localProjects'
import { localReports, REPORT_STATUS } from '../../../services/localReports'
import useAuth from '../../../hooks/useAuth'
import useRole from '../../../hooks/useRole'
import { ROLE } from '../../../constants/roles'

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)

const relativeDate = (iso) => {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

const STATUS_META = {
  active: { label: 'Active', color: 'success' },
  pipeline: { label: 'Pipeline', color: 'warning' },
  completed: { label: 'Completed', color: 'secondary' },
  on_hold: { label: 'On Hold', color: 'danger' },
}

// ─── Per-officer card ─────────────────────────────────────────────────────────

const OfficerCard = ({ officer, projects, allReports }) => {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)

  // Projects metrics
  const totalProjects = projects.length
  const activeProjects = projects.filter((p) => p.status === 'active').length
  const avgProgress =
    totalProjects > 0
      ? Math.round(
          projects.reduce((sum, p) => {
            const pct = p.tasks_count > 0 ? (p.tasks_completed / p.tasks_count) * 100 : 0
            return sum + pct
          }, 0) / totalProjects,
        )
      : 0

  // Collect all field personnel across this officer's projects
  const personnelMap = {}
  projects.forEach((p) => {
    ;(p.field_personnel || []).forEach((fp) => {
      if (!personnelMap[fp.email]) {
        personnelMap[fp.email] = {
          ...fp,
          projects: [],
          lastReportDate: null,
          pendingCount: 0,
          approvedCount: 0,
        }
      }
      personnelMap[fp.email].projects.push(p.name || p.title)
    })
  })

  // Enrich with report data
  allReports.forEach((r) => {
    const email = r.submitted_by_email || r.submitted_by
    if (personnelMap[email]) {
      const d = r.submitted_at || r.created_at
      if (!personnelMap[email].lastReportDate || d > personnelMap[email].lastReportDate) {
        personnelMap[email].lastReportDate = d
      }
      if (r.status === REPORT_STATUS.SUBMITTED || r.status === REPORT_STATUS.RESUBMITTED) {
        personnelMap[email].pendingCount++
      }
      if (r.status === REPORT_STATUS.APPROVED) {
        personnelMap[email].approvedCount++
      }
    }
  })

  const personnel = Object.values(personnelMap)
  const totalPersonnel = personnel.length

  // Activity status for the officer card border
  const borderColor = activeProjects > 0 ? '#4361ee' : '#adb5bd'

  return (
    <CCard
      className="mb-3 border-0 shadow-sm"
      style={{ borderRadius: 14, borderLeft: `4px solid ${borderColor}` }}
    >
      {/* Officer Header */}
      <CCardBody className="pb-2">
        <div className="d-flex align-items-start justify-content-between flex-wrap gap-2">
          <div className="d-flex align-items-center gap-3">
            {/* Avatar */}
            <div
              className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0"
              style={{
                width: 46,
                height: 46,
                background: 'linear-gradient(135deg, #4361ee, #3a0ca3)',
                fontSize: '1.1rem',
              }}
            >
              {officer.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="fw-bold" style={{ fontSize: '1rem' }}>
                {officer.name}
              </div>
              <div className="text-body-secondary small">
                {officer.designation || 'Project Officer'}
              </div>
              <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                {officer.email}
              </div>
            </div>
          </div>

          {/* Metric chips */}
          <div className="d-flex gap-2 flex-wrap align-items-center">
            <span
              className="badge rounded-pill px-3 py-2"
              style={{ background: 'rgba(67,97,238,0.1)', color: '#4361ee', fontSize: '0.78rem' }}
            >
              <CIcon icon={cilFolder} style={{ width: 12 }} className="me-1" />
              {activeProjects}/{totalProjects} Projects
            </span>
            <span
              className="badge rounded-pill px-3 py-2"
              style={{ background: 'rgba(6,214,160,0.1)', color: '#06d6a0', fontSize: '0.78rem' }}
            >
              <CIcon icon={cilPeople} style={{ width: 12 }} className="me-1" />
              {totalPersonnel} Personnel
            </span>
          </div>
        </div>

        {/* Avg progress bar */}
        {totalProjects > 0 && (
          <div className="mt-3">
            <div className="d-flex justify-content-between mb-1">
              <span className="small text-body-secondary">Overall Project Progress</span>
              <span className="small fw-semibold">{avgProgress}%</span>
            </div>
            <CProgress
              value={avgProgress}
              height={7}
              className="rounded-pill"
              color={avgProgress === 100 ? 'success' : avgProgress > 60 ? 'primary' : 'warning'}
            />
          </div>
        )}

        {/* Expand toggle */}
        <div className="d-flex justify-content-between align-items-center mt-3">
          <CButton
            color="primary"
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/pms/project-teams/officers`)}
            className="ps-0"
          >
            View Officer Profile <CIcon icon={cilArrowRight} className="ms-1" />
          </CButton>
          <CButton
            color="secondary"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((e) => !e)}
            className="d-flex align-items-center gap-1"
          >
            {expanded ? 'Hide Details' : 'Show Details'}
            <CIcon icon={expanded ? cilChevronTop : cilChevronBottom} style={{ width: 14 }} />
          </CButton>
        </div>
      </CCardBody>

      {/* Expanded: Projects + Field Personnel */}
      <CCollapse visible={expanded}>
        <div className="border-top mx-3" />

        {/* Projects table */}
        {totalProjects > 0 && (
          <div className="px-3 pt-3 pb-1">
            <p
              className="small fw-semibold text-uppercase text-body-secondary mb-2"
              style={{ letterSpacing: '0.06em' }}
            >
              Assigned Projects
            </p>
            <CTable hover responsive className="mb-2" style={{ fontSize: '0.82rem' }}>
              <CTableHead className="bg-body-tertiary">
                <CTableRow>
                  <CTableHeaderCell className="border-0 py-2 ps-3">Project</CTableHeaderCell>
                  <CTableHeaderCell className="border-0 py-2">Status</CTableHeaderCell>
                  <CTableHeaderCell className="border-0 py-2">Value</CTableHeaderCell>
                  <CTableHeaderCell className="border-0 py-2 pe-3"></CTableHeaderCell>
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
                      <CTableDataCell className="py-2 ps-3">
                        <div className="fw-medium">{p.name || p.title}</div>
                        <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                          {p.location}
                        </div>
                      </CTableDataCell>
                      <CTableDataCell className="py-2">
                        <CBadge color={sm.color} shape="rounded-pill" className="px-2">
                          {sm.label}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell className="py-2 fw-semibold">
                        {fmt(p.project_value || p.project_valuation)}
                      </CTableDataCell>
                      <CTableDataCell className="py-2 pe-3 text-end">
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
          </div>
        )}

        {/* Field Personnel */}
        <div className="px-3 pt-1 pb-3">
          <p
            className="small fw-semibold text-uppercase text-body-secondary mb-2"
            style={{ letterSpacing: '0.06em' }}
          >
            Field Personnel ({totalPersonnel})
          </p>
          {totalPersonnel === 0 ? (
            <div className="text-body-secondary small py-2 fst-italic">
              No field personnel assigned to this officer's projects.
            </div>
          ) : (
            <div className="d-flex flex-wrap gap-2">
              {personnel.map((fp) => {
                const isActive = fp.status === 'active'
                const hasRecentReport =
                  fp.lastReportDate &&
                  Date.now() - new Date(fp.lastReportDate).getTime() < 7 * 86400000
                return (
                  <div
                    key={fp.email}
                    className="d-flex align-items-center gap-2 border rounded-3 px-3 py-2"
                    style={{
                      background: isActive ? 'rgba(6,214,160,0.05)' : 'rgba(173,181,189,0.08)',
                      borderColor: isActive ? 'rgba(6,214,160,0.25)' : '#dee2e6',
                    }}
                  >
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0"
                      style={{
                        width: 30,
                        height: 30,
                        background: isActive
                          ? 'linear-gradient(135deg,#06d6a0,#2ec4b6)'
                          : '#adb5bd',
                        fontSize: '0.75rem',
                      }}
                    >
                      {fp.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="fw-medium" style={{ fontSize: '0.82rem' }}>
                        {fp.name}
                      </div>
                      <div className="d-flex align-items-center gap-1">
                        {fp.pendingCount > 0 && (
                          <span style={{ fontSize: '0.68rem', color: '#f77f00' }}>
                            <CIcon icon={cilClock} style={{ width: 10 }} className="me-1" />
                            {fp.pendingCount} pending
                          </span>
                        )}
                        {fp.lastReportDate ? (
                          <span
                            className="text-body-secondary d-flex align-items-center gap-1"
                            style={{ fontSize: '0.68rem' }}
                          >
                            <span
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: '50%',
                                display: 'inline-block',
                                background: hasRecentReport
                                  ? 'var(--cui-success)'
                                  : 'var(--cui-warning)',
                                flexShrink: 0,
                              }}
                            />
                            {relativeDate(fp.lastReportDate)}
                          </span>
                        ) : (
                          <span className="text-danger" style={{ fontSize: '0.68rem' }}>
                            <CIcon icon={cilWarning} style={{ width: 10 }} className="me-1" />
                            No reports
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </CCollapse>
    </CCard>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TeamOverviewPage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = useRole()
  const isPA = role === ROLE.PROJECT_ASSOCIATE

  const [officers, setOfficers] = useState([])
  const [projectsMap, setProjectsMap] = useState({})
  const [allReports, setAllReports] = useState([])
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    await localReports.seedDemoData()

    // PAs see only officers/projects matching their fixed specialization;
    // Coordinator (and Admin/CEO) see everything.
    const specialization = isPA
      ? (await localProjects.getPaSpecialization(user?.employee_id)) || ''
      : ''
    const { items: officerList } = isPA
      ? await localOfficers.listForSpecialization(specialization)
      : await localOfficers.list()
    const { items: allProjects } = await localProjects.list({ pageSize: 500, specialization })
    const { items: reports } = await localReports.list({ pageSize: 1000 })

    // Build officer → projects map (supports multi-officer via officer_ids[])
    const map = {}
    officerList.forEach((o) => {
      map[o.id] = allProjects.filter(
        (p) =>
          p.officer_id === o.id ||
          p.assigned_officer_id === o.id ||
          (p.officer_ids || []).includes(o.id),
      )
    })

    // Also capture projects with no assigned officer (unassigned) — only for Admin view
    if (!isPA) {
      const unassignedProjects = allProjects.filter(
        (p) => !p.officer_id && !p.assigned_officer_id && !p.officer_ids?.length,
      )
      if (unassignedProjects.length) {
        map['__unassigned__'] = unassignedProjects
      }
    }

    return { officerList, map, reports }
  }, [isPA, user?.employee_id])

  useEffect(() => {
    let cancelled = false
    load().then(({ officerList, map, reports }) => {
      if (cancelled) return
      setOfficers(officerList)
      setProjectsMap(map)
      setAllReports(reports)
    })
    return () => {
      cancelled = true
    }
  }, [load])

  // Filtered officers
  const filteredOfficers = officers.filter((o) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      o.name?.toLowerCase().includes(q) ||
      o.email?.toLowerCase().includes(q) ||
      o.designation?.toLowerCase().includes(q)
    )
  })

  // KPI aggregates
  const totalProjects = Object.values(projectsMap)
    .flat()
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i).length

  const totalPersonnel = Object.values(projectsMap)
    .flat()
    .reduce((s, p) => s + (p.field_personnel?.length || 0), 0)

  const allProjectsList = Object.values(projectsMap)
    .flat()
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
  const avgProgress =
    allProjectsList.length > 0
      ? Math.round(
          allProjectsList.reduce((sum, p) => {
            const pct = p.tasks_count > 0 ? (p.tasks_completed / p.tasks_count) * 100 : 0
            return sum + pct
          }, 0) / allProjectsList.length,
        )
      : 0

  const kpis = [
    {
      label: 'Project Officers',
      value: officers.length,
      icon: cilUser,
      color: '#4361ee',
      bg: 'rgba(67,97,238,0.08)',
    },
    {
      label: 'Total Projects',
      value: totalProjects,
      icon: cilFolder,
      color: '#2ec4b6',
      bg: 'rgba(46,196,182,0.08)',
    },
    {
      label: 'Field Personnel',
      value: totalPersonnel,
      icon: cilPeople,
      color: '#06d6a0',
      bg: 'rgba(6,214,160,0.08)',
    },
    {
      label: 'Avg Progress',
      value: `${avgProgress}%`,
      icon: cilCheckCircle,
      color: '#6f42c1',
      bg: 'rgba(111,66,193,0.08)',
    },
  ]

  return (
    <>
      {/* Hero */}
      <div
        className="rounded-4 mb-4 px-4 py-4 text-white position-relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #3a0ca3 0%, #4361ee 60%, #2ec4b6 100%)',
          minHeight: '110px',
        }}
      >
        <div
          className="position-absolute top-0 end-0 opacity-10"
          style={{ fontSize: '8rem', lineHeight: 1, marginTop: '-1rem' }}
        >
          👥
        </div>
        <div className="position-relative">
          <h4 className="fw-bold mb-1">Team Overview</h4>
          <p className="mb-3 opacity-75 mb-0">
            Monitor all Project Officers and their Field Personnel across every project.
          </p>
        </div>
      </div>

      {/* KPI Strip */}
      <CRow className="g-3 mb-4">
        {kpis.map((kpi, i) => (
          <CCol key={i} xs={6} md={4} xl>
            <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
              <CCardBody className="d-flex align-items-center gap-3 py-3">
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ width: 46, height: 46, background: kpi.bg }}
                >
                  <CIcon icon={kpi.icon} style={{ color: kpi.color, width: 22, height: 22 }} />
                </div>
                <div>
                  <div className="fw-bold fs-5 lh-1 mb-1" style={{ color: kpi.color }}>
                    {kpi.value}
                  </div>
                  <div className="small text-body-secondary fw-medium">{kpi.label}</div>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>

      {/* Search */}
      <div className="mb-3">
        <CInputGroup size="sm" style={{ maxWidth: 360 }}>
          <CInputGroupText className="bg-transparent">
            <CIcon icon={cilSearch} size="sm" />
          </CInputGroupText>
          <CFormInput
            placeholder="Search officers by name, email, designation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CInputGroup>
      </div>

      {/* Officer Cards */}
      {filteredOfficers.length === 0 ? (
        <div className="text-center py-5 text-body-secondary">
          <div style={{ fontSize: '3rem' }}>👤</div>
          <h5>No officers found</h5>
          <p className="small">
            Try adjusting your search, or add officers via Project Officers page.
          </p>
          <CButton color="primary" onClick={() => navigate('/pms/project-teams/officers')}>
            Manage Officers
          </CButton>
        </div>
      ) : (
        filteredOfficers.map((officer) => (
          <OfficerCard
            key={officer.id}
            officer={officer}
            projects={projectsMap[officer.id] || []}
            allReports={allReports}
          />
        ))
      )}
    </>
  )
}

export default TeamOverviewPage
