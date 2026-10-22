import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CRow, CCol } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilFolder, cilCheckCircle, cilClock, cilWarning } from '@coreui/icons'
import { localProjects } from '../../../../services/localProjects'

const KpiCard = ({ icon, label, value, sub, color, bg }) => (
  <CCol xs={6}>
    <div className="rounded-3 d-flex align-items-center gap-2 px-3 py-2" style={{ background: bg }}>
      <div
        className="rounded-2 d-flex align-items-center justify-content-center flex-shrink-0"
        style={{ width: 36, height: 36, background: `${color}22` }}
      >
        <CIcon icon={icon} style={{ color, width: 18, height: 18 }} />
      </div>
      <div className="min-w-0">
        <div className="fw-bold fs-5 lh-1 mb-0" style={{ color }}>
          {value}
        </div>
        <div className="small text-body">{label}</div>
        {sub && (
          <div className="text-body-secondary" style={{ fontSize: '0.7rem' }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  </CCol>
)

const ProjectKPIsWidget = () => {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let cancelled = false
    localProjects.seedDemoData()
    localProjects.getStats().then((s) => {
      if (!cancelled) setStats(s)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!stats) return null

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4">
        <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">
          Project Pipeline
        </h6>
        <CRow className="g-2">
          <KpiCard
            icon={cilWarning}
            label="Pipeline"
            value={stats.pipeline}
            color="#f0ad4e"
            bg="rgba(240,173,78,0.08)"
            sub="Awaiting approval"
          />
          <KpiCard
            icon={cilCheckCircle}
            label="Approved"
            value={stats.approved}
            color="#0dcaf0"
            bg="rgba(13,202,240,0.08)"
            sub="Ready to start"
          />
          <KpiCard
            icon={cilClock}
            label="Ongoing"
            value={stats.ongoing}
            color="#4361ee"
            bg="rgba(67,97,238,0.08)"
            sub="Active"
          />
          <KpiCard
            icon={cilFolder}
            label="Completed"
            value={stats.completed}
            color="#06d6a0"
            bg="rgba(6,214,160,0.08)"
            sub="Finished"
          />
        </CRow>
        <div className="mt-3 text-body-secondary" style={{ fontSize: '0.72rem' }}>
          {stats.pendingApprovals} pending approval{stats.pendingApprovals !== 1 ? 's' : ''}
          &nbsp;·&nbsp; {stats.total} total projects
        </div>
      </CCardBody>
    </CCard>
  )
}

export default ProjectKPIsWidget
