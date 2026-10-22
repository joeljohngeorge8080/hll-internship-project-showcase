/**
 * ReportDetailReviewPage — Full detail view for Project Officer review.
 *
 * Route: /pms/daily-reports/review/:id
 * Shows all submitted data, dual upload sections, task info.
 */
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CRow,
  CCol,
  CCard,
  CCardBody,
  CCardHeader,
  CButton,
  CSpinner,
  CAlert,
  CTable,
  CTableBody,
  CTableRow,
  CTableDataCell,
  CToaster,
  CToast,
  CToastBody,
  CToastClose,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilArrowLeft,
  cilCheckCircle,
  cilXCircle,
  cilFile,
  cilPaperclip,
  cilImage,
  cilNotes,
} from '@coreui/icons'

import StatusBadge from './components/StatusBadge'
import DeclineReasonModal from './components/DeclineReasonModal'
import { localReports, REPORT_STATUS } from '../../../services/localReports'

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
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

const formatDateTime = (isoStr) => {
  if (!isoStr) return '—'
  try {
    return new Date(isoStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoStr
  }
}

const AttachmentSection = ({ title, icon, items = [] }) => {
  if (!items || items.length === 0) return null
  const isPdf = (item) => item.file_type === 'application/pdf'

  return (
    <CCard className="shadow-sm mb-3">
      <CCardHeader className="bg-transparent">
        <CIcon icon={icon} className="me-2" />
        <strong>
          {title} ({items.length})
        </strong>
      </CCardHeader>
      <CCardBody>
        <div className="d-flex flex-wrap gap-3">
          {items.map((att, idx) =>
            isPdf(att) ? (
              <div key={idx} className="text-center p-3 border rounded">
                <CIcon icon={cilFile} size="xl" className="mb-1" />
                <div className="small text-truncate" style={{ maxWidth: '100px' }}>
                  {att.file_name}
                </div>
              </div>
            ) : (
              <img
                key={idx}
                src={att.file_url}
                alt={att.file_name}
                className="rounded border"
                style={{ maxWidth: '200px', maxHeight: '150px', objectFit: 'cover' }}
              />
            ),
          )}
        </div>
      </CCardBody>
    </CCard>
  )
}

const ReportDetailReviewPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  const [declineModalVisible, setDeclineModalVisible] = useState(false)
  const [declineLoading, setDeclineLoading] = useState(false)
  const [approveModalVisible, setApproveModalVisible] = useState(false)
  const [approveLoading, setApproveLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    localReports.getById(id).then((r) => {
      if (cancelled) return
      if (!r) {
        setError('Report not found')
      } else {
        setReport(r)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const confirmApprove = async () => {
    setApproveLoading(true)
    try {
      const updated = await localReports.approve(id)
      setReport(updated)
      setToast({ color: 'success', message: 'Report approved' })
      setApproveModalVisible(false)
      setTimeout(() => navigate('/pms/daily-reports/review'), 1500)
    } catch (err) {
      setToast({ color: 'danger', message: err.message })
    }
    setApproveLoading(false)
  }

  const confirmDecline = async (reason) => {
    setDeclineLoading(true)
    try {
      const updated = await localReports.decline(id, 'project_officer', reason)
      setReport(updated)
      setToast({ color: 'warning', message: 'Report declined' })
      setDeclineModalVisible(false)
      setTimeout(() => navigate('/pms/daily-reports/review'), 1500)
    } catch (err) {
      setToast({ color: 'danger', message: err.message })
    }
    setDeclineLoading(false)
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  if (error) {
    return (
      <>
        <CAlert color="danger">{error}</CAlert>
        <CButton color="primary" variant="outline" onClick={() => navigate(-1)}>
          Go Back
        </CButton>
      </>
    )
  }

  const canReview =
    report.status === REPORT_STATUS.SUBMITTED || report.status === REPORT_STATUS.RESUBMITTED

  return (
    <>
      {/* Back button + header */}
      <div className="d-flex align-items-center gap-3 mb-3">
        <CButton
          color="secondary"
          variant="ghost"
          onClick={() => navigate('/pms/daily-reports/review')}
        >
          <CIcon icon={cilArrowLeft} />
        </CButton>
        <div className="flex-grow-1">
          <h4 className="mb-0 fw-semibold">Report Detail</h4>
          <div className="small text-body-secondary">Review submitted daily report</div>
        </div>
        <StatusBadge status={report.status} />
      </div>

      {report.status === REPORT_STATUS.RESUBMITTED && (
        <CAlert color="info" className="mb-3">
          This report was <strong>resubmitted</strong> after a previous decline.
        </CAlert>
      )}

      <CRow className="g-3">
        {/* Main details */}
        <CCol xs={12} lg={8}>
          <CCard className="shadow-sm mb-3">
            <CCardHeader className="bg-transparent">
              <strong>Report Information</strong>
            </CCardHeader>
            <CCardBody>
              <CTable borderless className="mb-0">
                <CTableBody>
                  {report.report_type !== 'task' ? (
                    <>
                      <CTableRow>
                        <CTableDataCell
                          className="fw-medium text-body-secondary"
                          style={{ width: '35%' }}
                        >
                          Bill Topic
                        </CTableDataCell>
                        <CTableDataCell className="fw-semibold">{report.bill_topic}</CTableDataCell>
                      </CTableRow>
                      <CTableRow>
                        <CTableDataCell className="fw-medium text-body-secondary">
                          Amount
                        </CTableDataCell>
                        <CTableDataCell className="fw-semibold fs-5 text-primary">
                          {formatCurrency(report.amount)}
                        </CTableDataCell>
                      </CTableRow>
                      <CTableRow>
                        <CTableDataCell className="fw-medium text-body-secondary">
                          Date
                        </CTableDataCell>
                        <CTableDataCell>{formatDate(report.report_date)}</CTableDataCell>
                      </CTableRow>
                      <CTableRow>
                        <CTableDataCell className="fw-medium text-body-secondary">
                          Time
                        </CTableDataCell>
                        <CTableDataCell>{report.report_time || '—'}</CTableDataCell>
                      </CTableRow>
                    </>
                  ) : (
                    <>
                      <CTableRow>
                        <CTableDataCell
                          className="fw-medium text-body-secondary"
                          style={{ width: '35%' }}
                        >
                          Task Name
                        </CTableDataCell>
                        <CTableDataCell className="fw-semibold text-info">
                          <CIcon icon={cilNotes} size="sm" className="me-1" />
                          {report.task_title}
                        </CTableDataCell>
                      </CTableRow>
                      <CTableRow>
                        <CTableDataCell className="fw-medium text-body-secondary">
                          Requested Status
                        </CTableDataCell>
                        <CTableDataCell>
                          <span
                            className={`badge bg-${report.requested_status === 'completed' ? 'success' : report.requested_status === 'cancelled' ? 'danger' : 'primary'} text-uppercase px-2 py-1`}
                          >
                            {report.requested_status}
                          </span>
                        </CTableDataCell>
                      </CTableRow>
                    </>
                  )}
                  <CTableRow>
                    <CTableDataCell className="fw-medium text-body-secondary">
                      Submitted By
                    </CTableDataCell>
                    <CTableDataCell>{report.submitted_by_name}</CTableDataCell>
                  </CTableRow>
                  <CTableRow>
                    <CTableDataCell className="fw-medium text-body-secondary">
                      Submitted At
                    </CTableDataCell>
                    <CTableDataCell>{formatDateTime(report.submitted_at)}</CTableDataCell>
                  </CTableRow>
                  {report.report_type !== 'task' && report.task_title && (
                    <CTableRow>
                      <CTableDataCell className="fw-medium text-body-secondary">
                        Linked Task
                      </CTableDataCell>
                      <CTableDataCell>
                        <span className="text-info d-flex align-items-center gap-1">
                          <CIcon icon={cilNotes} size="sm" />
                          {report.task_title}
                        </span>
                      </CTableDataCell>
                    </CTableRow>
                  )}
                  {report.notes && (
                    <CTableRow>
                      <CTableDataCell className="fw-medium text-body-secondary">
                        Notes
                      </CTableDataCell>
                      <CTableDataCell>{report.notes}</CTableDataCell>
                    </CTableRow>
                  )}
                </CTableBody>
              </CTable>
            </CCardBody>
          </CCard>

          {/* Details of Meetings Conducted */}
          {report.report_type !== 'task' && report.meetings && report.meetings.length > 0 && (
            <CCard className="shadow-sm mb-3">
              <CCardHeader className="bg-transparent">
                <strong>Details of Meetings Conducted (LSGB)</strong>
              </CCardHeader>
              <CCardBody className="p-0">
                <div className="table-responsive">
                  <CTable
                    hover
                    align="middle"
                    className="mb-0 border-0"
                    style={{ fontSize: '0.875rem' }}
                  >
                    <CTableHead color="light">
                      <CTableRow>
                        <CTableHeaderCell
                          className="text-center border-0"
                          style={{ width: '60px' }}
                        >
                          Sl. No
                        </CTableHeaderCell>
                        <CTableHeaderCell className="border-0">Particulars</CTableHeaderCell>
                        <CTableHeaderCell className="border-0">Venue Address</CTableHeaderCell>
                        <CTableHeaderCell className="border-0">
                          Local Point of Contact (Name, Contact No)
                        </CTableHeaderCell>
                        <CTableHeaderCell className="border-0">Remarks</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {report.meetings.map((m, idx) => (
                        <CTableRow key={idx}>
                          <CTableDataCell className="text-center fw-medium text-body-secondary">
                            {idx + 1}
                          </CTableDataCell>
                          <CTableDataCell>{m.particulars}</CTableDataCell>
                          <CTableDataCell>{m.venue_address}</CTableDataCell>
                          <CTableDataCell>{m.local_contact}</CTableDataCell>
                          <CTableDataCell>{m.remarks || '—'}</CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
                </div>
              </CCardBody>
            </CCard>
          )}

          {/* Geo-tagged Photos */}
          <AttachmentSection title="Geo-tagged Photos" icon={cilImage} items={report.geo_photos} />

          {/* Bills / Receipts */}
          <AttachmentSection
            title="🧾 Bills / Receipts"
            icon={cilPaperclip}
            items={report.bill_uploads}
          />
        </CCol>

        {/* Sidebar */}
        <CCol xs={12} lg={4}>
          {/* Review actions */}
          {canReview && (
            <CCard className="shadow-sm mb-3 border-primary border-top border-3">
              <CCardHeader className="bg-transparent">
                <strong>Review Actions</strong>
              </CCardHeader>
              <CCardBody>
                <div className="d-grid gap-2">
                  <CButton color="success" onClick={() => setApproveModalVisible(true)}>
                    <CIcon icon={cilCheckCircle} className="me-1" />
                    Approve Report
                  </CButton>
                  <CButton
                    color="danger"
                    variant="outline"
                    onClick={() => setDeclineModalVisible(true)}
                  >
                    <CIcon icon={cilXCircle} className="me-1" />
                    Decline Report
                  </CButton>
                </div>
              </CCardBody>
            </CCard>
          )}

          {/* Previous review info */}
          {report.reviewed_at && (
            <CCard className="shadow-sm">
              <CCardHeader className="bg-transparent">
                <strong>Review History</strong>
              </CCardHeader>
              <CCardBody className="small">
                <div>
                  Status: <StatusBadge status={report.status} />
                </div>
                <div className="mt-2">Reviewed at: {formatDateTime(report.reviewed_at)}</div>
                {report.decline_reason && (
                  <div className="mt-2 p-2 bg-danger-subtle rounded">
                    <strong>Decline reason:</strong> {report.decline_reason}
                  </div>
                )}
              </CCardBody>
            </CCard>
          )}
        </CCol>
      </CRow>

      {/* Approve confirmation */}
      <CModal
        visible={approveModalVisible}
        onClose={() => setApproveModalVisible(false)}
        alignment="center"
      >
        <CModalHeader closeButton>
          <CModalTitle>Confirm Approval</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p>
            Are you sure you want to <strong>approve</strong> this report?
          </p>
          <p className="text-body-secondary small mb-0">
            {report.report_type === 'task'
              ? `The task status will be updated to ${report.requested_status}.`
              : 'The report will be forwarded to the backend team for settlement processing.'}
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" onClick={() => setApproveModalVisible(false)}>
            Cancel
          </CButton>
          <CButton color="success" onClick={confirmApprove} disabled={approveLoading}>
            <CIcon icon={cilCheckCircle} className="me-1" />
            Confirm Approve
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Decline modal */}
      <DeclineReasonModal
        visible={declineModalVisible}
        onClose={() => setDeclineModalVisible(false)}
        onConfirm={confirmDecline}
        loading={declineLoading}
      />

      <CToaster placement="top-end">
        {toast && (
          <CToast
            autohide
            delay={3000}
            visible
            color={toast.color}
            className="text-white"
            onClose={() => setToast(null)}
          >
            <div className="d-flex">
              <CToastBody>{toast.message}</CToastBody>
              <CToastClose className="me-2 m-auto" white />
            </div>
          </CToast>
        )}
      </CToaster>
    </>
  )
}

export default ReportDetailReviewPage
