import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CProgress, CRow, CCol } from '@coreui/react'
import { localTasks } from '../../../../services/localTasks'
import { localReports, REPORT_STATUS } from '../../../../services/localReports'

const FieldPersonnelWidget = () => {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    localTasks.seedDemoData()
    localReports
      .seedDemoData()
      .then(() => localReports.list({ pageSize: 9999 }))
      .then(({ items: reports }) => {
        if (cancelled) return
        const { items: tasks } = localTasks.list({ pageSize: 9999 })

        const personnelIds = [...new Set(tasks.map((t) => t.assigned_to).filter(Boolean))]
        const activeTasks = tasks.filter(
          (t) => t.status === 'in_progress' || t.status === 'pending',
        )
        const completedTasks = tasks.filter((t) => t.status === 'completed')
        const totalTasks = tasks.length

        const pendingReports = reports.filter(
          (r) => r.status === REPORT_STATUS.SUBMITTED || r.status === REPORT_STATUS.RESUBMITTED,
        ).length

        const completionRate =
          totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0

        setData({
          personnelCount: personnelIds.length,
          activeTasks: activeTasks.length,
          completedTasks: completedTasks.length,
          completionRate,
          pendingReports,
        })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return null

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4">
        <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">
          Field Personnel
        </h6>
        <CRow className="g-2 mb-3">
          <CCol xs={6}>
            <div
              className="text-center rounded-3 py-2"
              style={{ background: 'rgba(67,97,238,0.08)' }}
            >
              <div className="fw-bold fs-5 lh-1 mb-1" style={{ color: '#4361ee' }}>
                {data.personnelCount}
              </div>
              <div className="small text-body-secondary">Personnel</div>
            </div>
          </CCol>
          <CCol xs={6}>
            <div
              className="text-center rounded-3 py-2"
              style={{ background: 'rgba(247,127,0,0.08)' }}
            >
              <div className="fw-bold fs-5 lh-1 mb-1" style={{ color: '#f77f00' }}>
                {data.activeTasks}
              </div>
              <div className="small text-body-secondary">Active Tasks</div>
            </div>
          </CCol>
          <CCol xs={6}>
            <div
              className="text-center rounded-3 py-2"
              style={{ background: 'rgba(6,214,160,0.08)' }}
            >
              <div className="fw-bold fs-5 lh-1 mb-1" style={{ color: '#06d6a0' }}>
                {data.completedTasks}
              </div>
              <div className="small text-body-secondary">Completed</div>
            </div>
          </CCol>
          <CCol xs={6}>
            <div
              className="text-center rounded-3 py-2"
              style={{ background: 'rgba(240,173,78,0.08)' }}
            >
              <div className="fw-bold fs-5 lh-1 mb-1" style={{ color: '#f0ad4e' }}>
                {data.pendingReports}
              </div>
              <div className="small text-body-secondary">Pending Reports</div>
            </div>
          </CCol>
        </CRow>
        <div className="d-flex justify-content-between mb-1">
          <span className="small text-body-secondary">Task Completion</span>
          <span className="small fw-semibold">{data.completionRate}%</span>
        </div>
        <CProgress
          value={data.completionRate}
          height={6}
          color={
            data.completionRate >= 75 ? 'success' : data.completionRate >= 40 ? 'warning' : 'danger'
          }
          className="rounded-pill"
        />
      </CCardBody>
    </CCard>
  )
}

export default FieldPersonnelWidget
