/**
 * TaskAssignModal — Modal for Project Officers to create a project task.
 * Tasks are project-scoped and can be assigned to a specific installment/milestone.
 * The assigned installment_id makes the task show up in the Project Associate's
 * "Project Milestones" tab under the correct installment card.
 */
import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CFormSelect,
  CFormFeedback,
  CSpinner,
  CRow,
  CCol,
  CAlert,
  CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilTask, cilLocationPin, cilFolder } from '@coreui/icons'

import { localProjects } from '../../../../services/localProjects'

const OFFICER_ID = 'po_001' // Demo: replace with auth context

const TaskAssignModal = ({
  visible,
  onClose,
  onConfirm,
  loading = false,
  preselectedProjectId = null,
}) => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    project_id: preselectedProjectId || '',
    installment_id: '',
    task_type: 'task',
    assignee: '',
    due_date: '',
  })
  const [errors, setErrors] = useState({})
  const [officerProjects, setOfficerProjects] = useState([])
  const [selectedProjectData, setSelectedProjectData] = useState(null)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    localProjects.seedDemoData()
    localProjects.getByOfficer(OFFICER_ID).then((projects) => {
      if (cancelled) return
      setOfficerProjects(projects)
      if (preselectedProjectId) {
        const proj = projects.find((p) => p.id === preselectedProjectId)
        setSelectedProjectData(proj || null)
        setForm((f) => ({ ...f, project_id: preselectedProjectId }))
      }
    })
    return () => {
      cancelled = true
    }
  }, [visible, preselectedProjectId])

  // When project changes, update selectedProjectData and clear installment
  const handleProjectChange = (projectId) => {
    const proj = officerProjects.find((p) => p.id === projectId) || null
    setSelectedProjectData(proj)
    setForm((prev) => ({ ...prev, project_id: projectId, installment_id: '' }))
    if (errors.project_id) setErrors((prev) => ({ ...prev, project_id: '' }))
  }

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.title.trim()) errs.title = 'Task title is required'
    if (form.title.length > 150) errs.title = 'Maximum 150 characters'
    if (!form.project_id) errs.project_id = 'Please select a project'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    const selectedProject = officerProjects.find((p) => p.id === form.project_id)
    onConfirm({
      ...form,
      project_name: selectedProject?.title || '',
    })
  }

  const handleClose = () => {
    setForm({
      title: '',
      description: '',
      project_id: preselectedProjectId || '',
      installment_id: '',
      task_type: 'task',
      assignee: '',
      due_date: '',
    })
    setErrors({})
    setSelectedProjectData(null)
    onClose()
  }

  const installments = selectedProjectData?.installments || []

  return (
    <CModal visible={visible} onClose={handleClose} alignment="center" size="lg">
      <CModalHeader closeButton>
        <CModalTitle>
          <CIcon icon={cilTask} className="me-2" />
          Create Project Task
        </CModalTitle>
      </CModalHeader>
      <CModalBody>
        {officerProjects.length === 0 && (
          <CAlert color="warning" className="small">
            You have no projects yet. Create a project first, then assign tasks to it.
          </CAlert>
        )}

        {/* Select Project */}
        <div className="mb-3">
          <CFormLabel htmlFor="task-project" className="fw-medium">
            Project <span className="text-danger">*</span>
          </CFormLabel>
          <CFormSelect
            id="task-project"
            value={form.project_id}
            onChange={(e) => handleProjectChange(e.target.value)}
            invalid={!!errors.project_id}
            disabled={!!preselectedProjectId}
          >
            <option value="">— Select Project —</option>
            {officerProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </CFormSelect>
          {errors.project_id && <CFormFeedback invalid>{errors.project_id}</CFormFeedback>}
          {selectedProjectData && (
            <div className="text-body-secondary mt-1" style={{ fontSize: '0.75rem' }}>
              <CIcon icon={cilLocationPin} size="sm" className="me-1" />
              {selectedProjectData.location} · Team:{' '}
              {selectedProjectData.field_personnel?.length || 0} member(s)
            </div>
          )}
        </div>

        {/* Assign to Milestone / Installment */}
        {form.project_id && (
          <div className="mb-3">
            <CFormLabel htmlFor="task-installment" className="fw-medium">
              <CIcon icon={cilFolder} size="sm" className="me-1" />
              Assign to Milestone
              <span className="text-body-secondary fw-normal ms-1">(optional)</span>
            </CFormLabel>
            {installments.length === 0 ? (
              <div
                className="rounded-3 border p-2 small text-body-secondary"
                style={{ background: 'var(--cui-body-tertiary-bg)' }}
              >
                No installments/milestones configured for this project yet.
              </div>
            ) : (
              <CFormSelect
                id="task-installment"
                value={form.installment_id}
                onChange={(e) => handleChange('installment_id', e.target.value)}
              >
                <option value="">— No milestone (general task) —</option>
                {installments.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.label} ({inst.percentage}%) — {inst.id}
                  </option>
                ))}
              </CFormSelect>
            )}
            {form.installment_id && (
              <div className="mt-1" style={{ fontSize: '0.75rem' }}>
                <CBadge color="info" shape="rounded-pill">
                  Task will appear under this milestone for Project Associate
                </CBadge>
              </div>
            )}
          </div>
        )}

        {/* Task Type */}
        <div className="mb-3">
          <CFormLabel htmlFor="task-type" className="fw-medium">
            Task Type
          </CFormLabel>
          <CFormSelect
            id="task-type"
            value={form.task_type}
            onChange={(e) => handleChange('task_type', e.target.value)}
          >
            <option value="task">📋 Task</option>
            <option value="procurement">🛒 Procurement</option>
          </CFormSelect>
        </div>

        {/* Title */}
        <div className="mb-3">
          <CFormLabel htmlFor="task-title" className="fw-medium">
            Task Title <span className="text-danger">*</span>
          </CFormLabel>
          <CFormInput
            id="task-title"
            placeholder="e.g. Site Survey — Block A Foundation"
            value={form.title}
            onChange={(e) => handleChange('title', e.target.value)}
            invalid={!!errors.title}
          />
          {errors.title && <CFormFeedback invalid>{errors.title}</CFormFeedback>}
        </div>

        {/* Assignee */}
        <div className="mb-3">
          <CFormLabel htmlFor="task-assignee" className="fw-medium">
            Assignee
          </CFormLabel>
          <CFormInput
            id="task-assignee"
            placeholder="e.g. Field Team A, Arjun Sharma, Procurement Team"
            value={form.assignee}
            onChange={(e) => handleChange('assignee', e.target.value)}
          />
        </div>

        {/* Description */}
        <div className="mb-3">
          <CFormLabel htmlFor="task-description" className="fw-medium">
            Description
          </CFormLabel>
          <CFormTextarea
            id="task-description"
            rows={3}
            placeholder="Describe what the team needs to do, any specific instructions..."
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
          />
        </div>

        <CRow className="g-3">
          {/* Due Date */}
          <CCol xs={12} md={6}>
            <CFormLabel htmlFor="task-due" className="fw-medium">
              Due Date
            </CFormLabel>
            <CFormInput
              id="task-due"
              type="date"
              value={form.due_date}
              onChange={(e) => handleChange('due_date', e.target.value)}
            />
            <div className="text-body-tertiary mt-1" style={{ fontSize: '0.75rem' }}>
              Optional — leave blank if open-ended
            </div>
          </CCol>
        </CRow>

        {selectedProjectData && selectedProjectData.field_personnel?.length > 0 && (
          <div className="mt-3 p-2 bg-body-secondary rounded small text-body-secondary">
            <strong>👥 This task will be visible to:</strong>{' '}
            {selectedProjectData.field_personnel.map((fp) => fp.name).join(', ')}
          </div>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="ghost" onClick={handleClose} disabled={loading}>
          Cancel
        </CButton>
        <CButton
          color="primary"
          onClick={handleSubmit}
          disabled={loading || officerProjects.length === 0}
        >
          {loading ? (
            <>
              <CSpinner size="sm" className="me-1" />
              Creating...
            </>
          ) : (
            'Create Task'
          )}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

TaskAssignModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  preselectedProjectId: PropTypes.string,
}

export default TaskAssignModal
