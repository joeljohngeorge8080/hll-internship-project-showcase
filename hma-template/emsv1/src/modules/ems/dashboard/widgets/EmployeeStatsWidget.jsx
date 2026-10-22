import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CRow, CCol } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPeople, cilUserFollow, cilUserUnfollow, cilBriefcase } from '@coreui/icons'
import { localEmployees } from '../../../../services/localEmployees'

const StatItem = ({ icon, label, value, color }) => (
  <CCol xs={6} className="text-center mb-3">
    <div
      className="rounded-3 d-flex align-items-center justify-content-center mx-auto mb-2"
      style={{ width: 44, height: 44, background: `${color}18` }}
    >
      <CIcon icon={icon} style={{ color, width: 20, height: 20 }} />
    </div>
    <div className="fw-bold fs-5 lh-1 mb-1" style={{ color }}>
      {value}
    </div>
    <div className="text-body-secondary small">{label}</div>
  </CCol>
)

const EmployeeStatsWidget = () => {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { items: all } = await localEmployees.list({ pageSize: 9999 })
      const active = all.filter((e) => e.status === 'Active').length
      const inactive = all.filter((e) => e.status === 'Inactive').length
      const onProject = all.filter((e) =>
        (e.project_assignments || []).some((a) => a.status === 'Active'),
      ).length
      if (!cancelled) setStats({ total: all.length, active, inactive, onProject })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!stats) return null

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4 pb-2">
        <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">
          Employee Overview
        </h6>
        <CRow className="g-0">
          <StatItem icon={cilPeople} label="Total" value={stats.total} color="#4361ee" />
          <StatItem icon={cilUserFollow} label="Active" value={stats.active} color="#06d6a0" />
          <StatItem
            icon={cilUserUnfollow}
            label="Inactive"
            value={stats.inactive}
            color="#ef476f"
          />
          <StatItem
            icon={cilBriefcase}
            label="On Project"
            value={stats.onProject}
            color="#f77f00"
          />
        </CRow>
      </CCardBody>
    </CCard>
  )
}

export default EmployeeStatsWidget
