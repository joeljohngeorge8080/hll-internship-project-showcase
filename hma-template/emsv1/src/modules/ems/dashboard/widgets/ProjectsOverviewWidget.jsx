import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CRow, CCol } from '@coreui/react'
import { localProjects } from '../../../../services/localProjects'

const fmtCompact = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n || 0)

const ProjectsOverviewWidget = () => {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    localProjects.dashboardList().then((items) => {
      if (cancelled) return
      const projects = items || []
      setData({
        totalProjects: projects.length,
        totalValue: projects.reduce((s, p) => s + (p.project_value || p.project_valuation || 0), 0),
        totalBeneficiaries: projects.reduce(
          (s, p) => s + (p.beneficiaries_target || p.beneficiaries_completed || 0),
          0,
        ),
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
          Projects Overview
        </h6>
        <CRow className="g-2">
          <CCol xs={4}>
            <div className="small text-body-secondary mb-1">Projects</div>
            <div className="fw-bold" style={{ color: '#4361ee', fontSize: '1.1rem' }}>
              {data.totalProjects}
            </div>
          </CCol>
          <CCol xs={4}>
            <div className="small text-body-secondary mb-1">Total Value</div>
            <div className="fw-bold" style={{ color: '#06d6a0', fontSize: '1.1rem' }}>
              {fmtCompact(data.totalValue)}
            </div>
          </CCol>
          <CCol xs={4}>
            <div className="small text-body-secondary mb-1">Beneficiaries</div>
            <div className="fw-bold" style={{ color: '#f77f00', fontSize: '1.1rem' }}>
              {data.totalBeneficiaries.toLocaleString('en-IN')}
            </div>
          </CCol>
        </CRow>
      </CCardBody>
    </CCard>
  )
}

export default ProjectsOverviewWidget
