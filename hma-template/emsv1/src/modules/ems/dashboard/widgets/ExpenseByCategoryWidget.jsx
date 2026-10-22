import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CProgress } from '@coreui/react'
import { localGeneralExpenses } from '../../../../services/localGeneralExpenses'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)

const COLORS = [
  '#4361ee',
  '#06d6a0',
  '#f77f00',
  '#ef476f',
  '#2ec4b6',
  '#9b5de5',
  '#f15bb5',
  '#00bbf9',
  '#fee440',
  '#fb5607',
]

const ExpenseByCategoryWidget = () => {
  const [categories, setCategories] = useState([])

  useEffect(() => {
    let cancelled = false
    const year = new Date().getFullYear()
    localGeneralExpenses.analysis.get(year).then((analysis) => {
      if (cancelled) return
      setCategories((analysis.category_summary || []).slice(0, 8))
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (categories.length === 0) {
    return (
      <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
        <CCardBody className="pt-4">
          <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">
            Expenses by Category
          </h6>
          <div className="text-body-secondary small text-center py-4">No expense data yet</div>
        </CCardBody>
      </CCard>
    )
  }

  const max = Math.max(...categories.map((c) => c.actual_total), 1)

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4">
        <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">
          Expenses by Category — {new Date().getFullYear()}
        </h6>
        <div className="d-flex flex-column gap-2">
          {categories.map((cat, i) => (
            <div key={cat.category_id}>
              <div className="d-flex justify-content-between mb-1">
                <span className="small text-truncate me-2" style={{ maxWidth: '65%' }}>
                  {cat.category_name}
                </span>
                <span className="small fw-semibold text-body-secondary">
                  {fmt(cat.actual_total)}
                </span>
              </div>
              <CProgress
                value={Math.round((cat.actual_total / max) * 100)}
                height={5}
                className="rounded-pill"
                style={{ '--cui-progress-bar-bg': COLORS[i % COLORS.length] }}
              />
            </div>
          ))}
        </div>
      </CCardBody>
    </CCard>
  )
}

export default ExpenseByCategoryWidget
