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
import { cilArrowLeft, cilSave } from '@coreui/icons'

import { localTasks } from '../../../services/localTasks'
import { localReports } from '../../../services/localReports'
import ImageUploadWithPreview from './components/ImageUploadWithPreview'
import TaskCard from './components/TaskCard'

const TaskReportSubmitPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  // Form state
  const [status, setStatus] = useState('active')
  const [notes, setNotes] = useState('')
  const [attachments, setAttachments] = useState([])

  useEffect(() => {
    const t = localTasks.getById(id)
    if (t) {
      setTask(t)
      setStatus(t.status || 'active')
      setNotes(t.notes || '')
      // In a real app we might load existing attachments here
    }
    setLoading(false)
  }, [id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await localReports.createTaskReport({
        task_id: id,
        task_title: task.title,
        requested_status: status,
        notes: notes,
        geo_photos: attachments,
        bill_uploads: [],
      })

      setToast({ color: 'success', message: 'Task report submitted for review' })
      setTimeout(() => navigate('/pms/daily-reports/my-tasks'), 1500)
    } catch (err) {
      setToast({ color: 'danger', message: err.message || 'Failed to submit task report' })
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

  if (!task) {
    return (
      <>
        <CAlert color="danger">Task not found</CAlert>
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
          onClick={() => navigate('/pms/daily-reports/my-tasks')}
        >
          <CIcon icon={cilArrowLeft} />
        </CButton>
        <div className="flex-grow-1">
          <h4 className="mb-0 fw-semibold">Submit Task Report</h4>
          <div className="small text-body-secondary">
            Update progress and status for assigned task
          </div>
        </div>
      </div>

      <CRow className="justify-content-center">
        <CCol xs={12} lg={8} xl={7}>
          {/* Display Task Details */}
          <div className="mb-4">
            <TaskCard task={task} showActions={false} showAssignee={false} />
          </div>

          <CCard className="shadow-sm">
            <CCardHeader className="bg-transparent border-bottom-0 pt-3">
              <h5 className="mb-0 fw-semibold">Update Progress</h5>
            </CCardHeader>
            <CCardBody>
              <CForm onSubmit={handleSubmit}>
                {/* Status Dropdown */}
                <div className="mb-3">
                  <CFormLabel className="fw-medium">Task Status</CFormLabel>
                  <CFormSelect value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="active">Active (In Progress)</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </CFormSelect>
                  <div className="text-body-tertiary mt-1" style={{ fontSize: '0.75rem' }}>
                    Updating status to Completed will mark the task as done.
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
                  <CButton color="primary" type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <CSpinner size="sm" className="me-2" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CIcon icon={cilSave} className="me-1" />
                        Save Task Report
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

export default TaskReportSubmitPage
