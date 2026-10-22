import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CProgress } from '@coreui/react'
import { buildDepartments } from '../../reports-analysis/VisualModelPage'

const DEPT_COLORS = ['#4361ee', '#06d6a0', '#f77f00', '#ef476f', '#2ec4b6', '#9b5de5']

const DepartmentHeadcountWidget = () => {
  const [departments, setDepartments] = useState(null)

  useEffect(() => {
    let cancelled = false
    buildDepartments().then((depts) => {
      if (!cancelled) setDepartments(depts.slice(0, 5))
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!departments) return null

  const maxHeadcount = Math.max(...departments.map((d) => d.headcount), 1)

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4">
        <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">
          Department Headcount
        </h6>
        {departments.length === 0 ? (
          <div className="text-body-secondary small">No active employees yet.</div>
        ) : (
          <div className="d-flex flex-column gap-2">
            {departments.map((d, i) => (
              <div key={d.name}>
                <div className="d-flex justify-content-between small mb-1">
                  <span className="text-truncate me-2">{d.name}</span>
                  <span className="text-body-secondary">{d.headcount}</span>
                </div>
                <CProgress
                  value={Math.round((d.headcount / maxHeadcount) * 100)}
                  height={5}
                  className="rounded-pill"
                  style={{ '--cui-progress-bar-bg': DEPT_COLORS[i % DEPT_COLORS.length] }}
                />
              </div>
            ))}
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

export default DepartmentHeadcountWidget
