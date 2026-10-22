/**
 * StatusBadge — Color-coded pill for daily report status.
 *
 * Pending → Amber, Approved → Green, Declined → Red,
 * Resubmitted → Blue, Draft → Gray,
 * Settled → Primary, Report Submitted → Dark.
 */
import React from 'react'
import PropTypes from 'prop-types'
import { CBadge } from '@coreui/react'

const STATUS_CONFIG = {
  draft: { color: 'secondary', label: 'Draft' },
  submitted: { color: 'warning', label: 'Pending' },
  declined: { color: 'danger', label: 'Declined' },
  resubmitted: { color: 'info', label: 'Resubmitted' },
  approved: { color: 'success', label: 'Approved' },
  settled: { color: 'primary', label: 'Settled' },
  report_submitted: { color: 'dark', label: 'In Report' },
}

const StatusBadge = ({ status, className = '' }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft
  return (
    <CBadge
      color={config.color}
      shape="rounded-pill"
      className={`px-3 py-1 daily-report-status-badge ${className}`}
    >
      {config.label}
    </CBadge>
  )
}

StatusBadge.propTypes = {
  status: PropTypes.oneOf([
    'draft',
    'submitted',
    'declined',
    'resubmitted',
    'approved',
    'settled',
    'report_submitted',
  ]).isRequired,
  className: PropTypes.string,
}

export default StatusBadge
