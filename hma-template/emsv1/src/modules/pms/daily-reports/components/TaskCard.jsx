/**
 * TaskCard — Card component for task list views.
 *
 * Shows: Title, Assigned to, Due date, Status.
 */
import React from 'react'
import PropTypes from 'prop-types'
import { CCard, CCardBody, CButton, CBadge } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPeople, cilCalendar, cilCheckCircle, cilXCircle } from '@coreui/icons'

const STATUS_CONFIG = {
  active: { color: 'primary', label: 'Active' },
  completed: { color: 'success', label: 'Completed' },
  cancelled: { color: 'secondary', label: 'Cancelled' },
}

const formatDate = (dateStr) => {
  if (!dateStr) return null
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

const isOverdue = (dueDate) => {
  if (!dueDate) return false
  return new Date(dueDate) < new Date(new Date().toISOString().split('T')[0])
}

const TaskCard = ({
  task,
  onComplete,
  onCancel,
  onSubmitReport,
  showActions = false,
  showAssignee = true,
}) => {
  const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.active
  const overdue = task.status === 'active' && isOverdue(task.due_date)

  return (
    <CCard className={`daily-report-card mb-2 border-start border-4 border-start-${config.color}`}>
      <CCardBody className="py-3 px-3">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div className="flex-grow-1 me-2">
            <h6 className="mb-1 fw-semibold">{task.title}</h6>
            <div className="small text-primary fw-medium mb-1">
              🏢 {task.project_name || 'General Project'}
            </div>
            {task.description && (
              <div
                className="small text-body-secondary text-truncate"
                style={{ maxWidth: '400px' }}
              >
                {task.description}
              </div>
            )}
          </div>
          <CBadge
            color={config.color}
            shape="rounded-pill"
            className="px-3 py-1 text-uppercase"
            style={{ fontSize: '0.7rem', fontWeight: 600 }}
          >
            {config.label}
          </CBadge>
        </div>

        <div className="d-flex align-items-center gap-3 small text-body-secondary">
          {showAssignee && (
            <span className="d-flex align-items-center gap-1">
              <CIcon icon={cilPeople} size="sm" />
              {task.assigned_to_name}
            </span>
          )}
          {task.due_date && (
            <span
              className={`d-flex align-items-center gap-1 ${overdue ? 'text-danger fw-medium' : ''}`}
            >
              <CIcon icon={cilCalendar} size="sm" />
              {formatDate(task.due_date)}
              {overdue && ' (overdue)'}
            </span>
          )}
        </div>

        {/* Actions */}
        {showActions && task.status === 'active' && (
          <div className="d-flex gap-2 mt-3 pt-2 border-top">
            {onSubmitReport && (
              <CButton color="primary" size="sm" onClick={() => onSubmitReport(task.id)}>
                Submit Report
              </CButton>
            )}
            {onComplete && (
              <CButton
                color="success"
                variant="outline"
                size="sm"
                onClick={() => onComplete(task.id)}
              >
                <CIcon icon={cilCheckCircle} size="sm" className="me-1" />
                Complete
              </CButton>
            )}
            {onCancel && (
              <CButton color="danger" variant="ghost" size="sm" onClick={() => onCancel(task.id)}>
                <CIcon icon={cilXCircle} size="sm" className="me-1" />
                Cancel
              </CButton>
            )}
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

TaskCard.propTypes = {
  task: PropTypes.object.isRequired,
  onComplete: PropTypes.func,
  onCancel: PropTypes.func,
  onSubmitReport: PropTypes.func,
  showActions: PropTypes.bool,
  showAssignee: PropTypes.bool,
}

export default TaskCard
