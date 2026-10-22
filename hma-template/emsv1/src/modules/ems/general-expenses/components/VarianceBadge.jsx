import React from 'react'
import { CBadge } from '@coreui/react'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.abs(n))

const VarianceBadge = ({ variance }) => {
  if (variance === null || variance === undefined)
    return <span className="text-body-secondary">—</span>
  const v = parseFloat(variance)
  if (v === 0) return <CBadge color="secondary">± 0</CBadge>
  if (v > 0) return <CBadge color="danger">+{fmt(v)}</CBadge>
  return <CBadge color="success">-{fmt(v)}</CBadge>
}

export default VarianceBadge
