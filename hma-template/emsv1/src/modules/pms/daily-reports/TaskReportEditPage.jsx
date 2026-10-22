import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CRow,
  CCol,
  CCard,
  CCardBody,
  CCardHeader,
  CForm,
  CFormLabel,
  CFormTextarea,
  CFormSelect,
  CButton,
  CSpinner,
  CAlert,
  CToaster,
  CToast,
  CToastBody,
  CToastClose,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft, cilSave, cilWarning } from '@coreui/icons'

import { localTasks } from '../../../services/localTasks'
import { localReports } from '../../../services/localReports'
import ImageUploadWithPreview from './components/ImageUploadWithPreview'
import TaskCard from './components/TaskCard'

const TaskReportEditPage = () => {
  const { taskId, reportId } = useParams()
  const navigate = useNavigate()

  const [task, setTask] = useState(null)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  // Form state
  const [status, setStatus] = useState('active')
  const [notes, setNotes] = useState('')
  const [attachments, setAttachments] = useState([])

  useEffect(() => {
    let cancelled = false
    const t = localTasks.getById(taskId)
    localReports.getById(reportId).then((r) => {
      if (cancelled) return
      if (t && r) {
        setTask(t)
        setReport(r)
        setStatus(r.requested_status || t.status || 'active')
        setNotes(r.notes || '')
        setAttachments(r.geo_photos || [])
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [taskId, reportId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await localReports.resubmit(reportId, {
        requested_status: status,
        notes: notes,
        geo_photos: attachments,
      })

      setToast({ color: 'success', message: 'Task report resubmitted for review' })
      setTimeout(() => navigate('/pms/daily-reports/history'), 1500)
    } catch (err) {
      setToast({ color: 'danger', message: err.message || 'Failed to resubmit task report' })
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  if (!task || !report) {
    return (
      <>
        <CAlert color="danger">Task or Report not found</CAlert>
        <CButton color="primary" variant="outline" onClick={() => navigate(-1)}>
          Go Back
        </CButton>
      </>
    )
  }

  return (
    <>
      <div className="d-flex align-items-center gap-3 mb-3">
        <CButton
          color="secondary"
          variant="ghost"
          onClick={() => navigate('/pms/daily-reports/history')}
        >
          <CIcon icon={cilArrowLeft} />
        </CButton>
        <div className="flex-grow-1">
          <h4 className="mb-0 fw-semibold">Edit Task Report</h4>
          <div className="small text-body-secondary">
            Update and resubmit your declined task report
          </div>
        </div>
      </div>

      {report.decline_reason && (
        <CAlert color="danger" className="d-flex align-items-start gap-2 mb-4">
          <CIcon icon={cilWarning} className="mt-1" />
          <div>
            <strong>Officer Feedback:</strong>
            <div className="mt-1">{report.decline_reason}</div>
            <div className="small mt-1 opacity-75">
              Please address this feedback before resubmitting.
            </div>
          </div>
        </CAlert>
      )}

      <CRow className="justify-content-center">
        <CCol xs={12} lg={8} xl={7}>
          {/* Display Task Details */}
          <div className="mb-4">
            <TaskCard task={task} showActions={false} showAssignee={false} />
          </div>

          <CCard className="shadow-sm border-top border-4 border-top-warning">
            <CCardHeader className="bg-transparent pt-3 pb-2">
              <h5 className="mb-0 fw-semibold">Revise Progress</h5>
            </CCardHeader>
            <CCardBody>
              <CForm onSubmit={handleSubmit}>
                {/* Status Dropdown */}
                <div className="mb-3">
                  <CFormLabel className="fw-medium">Requested Task Status</CFormLabel>
                  <CFormSelect value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="active">Active (In Progress)</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </CFormSelect>
                  <div className="text-body-tertiary mt-1" style={{ fontSize: '0.75rem' }}>
                    Updating status to Completed will mark the task as done upon approval.
                  </div>
                </div>

                {/* Progress Notes */}
                <div className="mb-3">
                  <CFormLabel className="fw-medium">Progress Notes</CFormLabel>
                  <CFormTextarea
                    rows={4}
                    placeholder="Describe the progress made, current challenges, or completion summary..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    required
                  />
                </div>

                {/* Attachments */}
                <div className="mb-4">
                  <CFormLabel className="fw-medium">Supporting Documents / Photos</CFormLabel>
                  <ImageUploadWithPreview value={attachments} onChange={setAttachments} />
                </div>

                {/* Submit Action */}
                <div className="d-flex justify-content-end pt-3 border-top">
                  <CButton
                    color="warning"
                    className="text-white"
                    type="submit"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <CSpinner size="sm" className="me-2" />
                        Resubmitting...
                      </>
                    ) : (
                      <>
                        <CIcon icon={cilSave} className="me-1" />
                        Resubmit Task Report
                      </>
                    )}
                  </CButton>
                </div>
              </CForm>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

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

export default TaskReportEditPage
