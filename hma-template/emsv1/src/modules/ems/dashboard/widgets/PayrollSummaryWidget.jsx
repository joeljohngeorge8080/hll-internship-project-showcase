import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CRow, CCol, CProgress } from '@coreui/react'
import { localEmployees } from '../../../../services/localEmployees'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)

const fmtCompact = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)

const DEPT_COLORS = ['#4361ee', '#06d6a0', '#f77f00', '#ef476f', '#2ec4b6', '#9b5de5']

const PayrollSummaryWidget = () => {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { items } = await localEmployees.list({ pageSize: 9999 })
      const employees = items.filter((e) => e.status === 'Active')

      const totalGross = employees.reduce((s, e) => s + parseFloat(e.current_salary || 0), 0)
      const avgGross = employees.length > 0 ? totalGross / employees.length : 0

      const deptMap = {}
      for (const emp of employees) {
        const dept = emp.employment?.department || 'Unknown'
        if (!deptMap[dept]) deptMap[dept] = { count: 0, total: 0 }
        deptMap[dept].count += 1
        deptMap[dept].total += parseFloat(emp.current_salary || 0)
      }

      const departments = Object.entries(deptMap)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 5)
        .map(([name, v]) => ({ name, ...v }))

      if (!cancelled) setData({ count: employees.length, totalGross, avgGross, departments })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return null

  const maxDeptTotal = Math.max(...data.departments.map((d) => d.total), 1)

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4">
        <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">
          Payroll Summary
        </h6>
        <CRow className="g-2 mb-3">
          <CCol xs={6}>
            <div className="small text-body-secondary mb-1">Total Monthly</div>
            <div className="fw-bold" style={{ color: '#4361ee', fontSize: '1rem' }}>
              {fmtCompact(data.totalGross)}
            </div>
          </CCol>
          <CCol xs={6}>
            <div className="small text-body-secondary mb-1">Avg. Salary</div>
            <div className="fw-bold" style={{ color: '#06d6a0', fontSize: '1rem' }}>
              {fmtCompact(data.avgGross)}
            </div>
          </CCol>
          <CCol xs={12}>
            <div className="small text-body-secondary mb-1">Active Employees</div>
            <div className="fw-bold" style={{ color: '#f77f00', fontSize: '1rem' }}>
              {data.count}
            </div>
          </CCol>
        </CRow>

        {data.departments.length > 0 && (
          <>
            <div
              className="text-body-secondary mb-2"
              style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}
            >
              By Department
            </div>
            <div className="d-flex flex-column gap-2">
              {data.departments.map((dept, i) => (
                <div key={dept.name}>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="small text-truncate me-2" style={{ maxWidth: '60%' }}>
                      {dept.name}
                    </span>
                    <span className="small text-body-secondary">
                      {dept.count} · {fmtCompact(dept.total)}
                    </span>
                  </div>
                  <CProgress
                    value={Math.round((dept.total / maxDeptTotal) * 100)}
                    height={4}
                    className="rounded-pill"
                    style={{ '--cui-progress-bar-bg': DEPT_COLORS[i % DEPT_COLORS.length] }}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </CCardBody>
    </CCard>
  )
}

export default PayrollSummaryWidget
