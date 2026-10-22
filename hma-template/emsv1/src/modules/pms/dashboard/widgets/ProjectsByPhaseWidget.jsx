import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CProgress } from '@coreui/react'
import { localProjects } from '../../../../services/localProjects'

const PHASES = [
  { key: 'design_and_initiation', label: 'Design & Initiation', color: '#5bc0de' },
  { key: 'implementation', label: 'Implementation', color: '#4361ee' },
  { key: 'monitoring_and_evaluation', label: 'Monitoring & Evaluation', color: '#06d6a0' },
]

const STATUS_COLORS = {
  pipeline: '#f0ad4e',
  approved: '#0dcaf0',
  ongoing: '#4361ee',
  completed: '#06d6a0',
}

const ProjectsByPhaseWidget = () => {
  const [projects, setProjects] = useState([])

  useEffect(() => {
    let cancelled = false
    localProjects.seedDemoData()
    localProjects.list({ pageSize: 9999 }).then(({ items }) => {
      if (!cancelled) setProjects(items)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const total = Math.max(projects.length, 1)

  const statusCounts = ['pipeline', 'approved', 'ongoing', 'completed'].map((s) => ({
    label: s.charAt(0).toUpperCase() + s.slice(1),
    count: projects.filter((p) => p.status === s).length,
    color: STATUS_COLORS[s],
  }))

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4">
        <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">
          Projects by Phase & Status
        </h6>

        <div className="mb-3">
          <div
            className="text-body-secondary mb-2"
            style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}
          >
            Lifecycle Phase
          </div>
          {PHASES.map((phase) => {
            const count = projects.filter((p) => p.phase === phase.key).length
            return (
              <div key={phase.key} className="mb-2">
                <div className="d-flex justify-content-between mb-1">
                  <span className="small">{phase.label}</span>
                  <span className="small fw-semibold">{count}</span>
                </div>
                <CProgress
                  value={Math.round((count / total) * 100)}
                  height={5}
                  className="rounded-pill"
                  style={{ '--cui-progress-bar-bg': phase.color }}
                />
              </div>
            )
          })}
        </div>

        <div>
          <div
            className="text-body-secondary mb-2"
            style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}
          >
            Project Status
          </div>
          <div className="d-flex flex-wrap gap-2">
            {statusCounts.map((s) => (
              <div
                key={s.label}
                className="rounded-pill px-2 py-1 d-flex align-items-center gap-1"
                style={{ background: `${s.color}15` }}
              >
                <span className="fw-bold small" style={{ color: s.color }}>
                  {s.count}
                </span>
                <span className="small text-body-secondary">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </CCardBody>
    </CCard>
  )
}

export default ProjectsByPhaseWidget
