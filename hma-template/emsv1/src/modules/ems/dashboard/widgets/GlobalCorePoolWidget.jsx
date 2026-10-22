import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CRow, CCol } from '@coreui/react'
import { localPayroll } from '../../../../services/localPayroll'

const fmtCompact = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n || 0)

const GlobalCorePoolWidget = () => {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    localPayroll.getAllEmployeesWithProjectInfo().then((all) => {
      if (cancelled) return
      const employees = all.filter((e) => e.status !== 'Deleted' && e.status !== 'Inactive')
      const unassigned = employees.filter((e) => e.isOverhead)
      const assigned = employees.filter((e) => !e.isOverhead)
      setData({
        unassignedCount: unassigned.length,
        assignedCount: assigned.length,
        unassignedSalary: unassigned.reduce((s, e) => s + (parseFloat(e.current_salary) || 0), 0),
        assignedSalary: assigned.reduce((s, e) => s + (parseFloat(e.current_salary) || 0), 0),
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
          Global Core Pool
        </h6>
        <CRow className="g-2">
          <CCol xs={6}>
            <div className="small text-body-secondary mb-1">
              Unassigned ({data.unassignedCount})
            </div>
            <div className="fw-bold" style={{ color: '#ef476f' }}>
              {fmtCompact(data.unassignedSalary)}
            </div>
          </CCol>
          <CCol xs={6}>
            <div className="small text-body-secondary mb-1">Assigned ({data.assignedCount})</div>
            <div className="fw-bold" style={{ color: '#06d6a0' }}>
              {fmtCompact(data.assignedSalary)}
            </div>
          </CCol>
        </CRow>
        <div className="text-body-secondary mt-2" style={{ fontSize: '0.72rem' }}>
          Unassigned employees' salaries are core overhead expenses.
        </div>
      </CCardBody>
    </CCard>
  )
}

export default GlobalCorePoolWidget
