/**
 * ReportCard — Card component for daily report list views.
 *
 * Shows: Personnel Name, Bill Topic, Amount, Date/Time, StatusBadge.
 * Shows counts for geo_photos and bill_uploads.
 */
import React from 'react'
import PropTypes from 'prop-types'
import { CCard, CCardBody, CButton } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPaperclip, cilArrowRight, cilImage, cilNotes } from '@coreui/icons'

import StatusBadge from './StatusBadge'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

const ReportCard = ({
  report,
  onClick,
  onApprove,
  onDecline,
  showActions = false,
  showPersonnel = true,
}) => {
  const photoCount = report.geo_photos?.length || 0
  const billCount = report.bill_uploads?.length || 0

  return (
    <CCard
      className={`daily-report-card mb-2 border-start border-4 border-start-${
        report.status === 'approved'
          ? 'success'
          : report.status === 'declined'
            ? 'danger'
            : report.status === 'resubmitted'
              ? 'info'
              : report.status === 'draft'
                ? 'secondary'
                : 'warning'
      }`}
      role="button"
      onClick={() => onClick?.(report.id)}
    >
      <CCardBody className="py-3 px-3">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div className="flex-grow-1 me-2">
            <h6 className="mb-1 fw-semibold text-truncate">{report.bill_topic}</h6>
            {showPersonnel && (
              <div className="small text-body-secondary">{report.submitted_by_name}</div>
            )}
            {report.task_title && (
              <div className="small text-body-secondary d-flex align-items-center gap-1 mt-1">
                <CIcon icon={cilNotes} size="sm" />
                {report.task_title}
              </div>
            )}
          </div>
          <StatusBadge status={report.status} />
        </div>

        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-3 small text-body-secondary">
            <strong className="text-body fs-6">{formatCurrency(report.amount)}</strong>
            <span>{formatDate(report.report_date)}</span>
            {report.report_time && <span>{report.report_time}</span>}
          </div>

          <div className="d-flex align-items-center gap-2 small text-body-secondary">
            {photoCount > 0 && (
              <span className="d-flex align-items-center gap-1" title="Geo-tagged photos">
                <CIcon icon={cilImage} size="sm" />
                {photoCount}
              </span>
            )}
            {billCount > 0 && (
              <span className="d-flex align-items-center gap-1" title="Bills/receipts">
                <CIcon icon={cilPaperclip} size="sm" />
                {billCount}
              </span>
            )}
            <CIcon icon={cilArrowRight} size="sm" className="text-body-tertiary" />
          </div>
        </div>

        {report.status === 'declined' && report.decline_reason && (
          <div className="mt-2 p-2 bg-danger-subtle rounded small">
            <strong>Reason:</strong> {report.decline_reason}
          </div>
        )}

        {showActions && (report.status === 'submitted' || report.status === 'resubmitted') && (
          <div className="d-flex gap-2 mt-3 pt-2 border-top">
            <CButton
              color="success"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onApprove?.(report.id)
              }}
            >
              Approve
            </CButton>
            <CButton
              color="danger"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onDecline?.(report.id)
              }}
            >
              Decline
            </CButton>
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

ReportCard.propTypes = {
  report: PropTypes.object.isRequired,
  onClick: PropTypes.func,
  onApprove: PropTypes.func,
  onDecline: PropTypes.func,
  showActions: PropTypes.bool,
  showPersonnel: PropTypes.bool,
}

export default ReportCard
