import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus } from '@coreui/icons'

import api from '../../../../services/api'
import { localEmployees } from '../../../../services/localEmployees'

const today = () => new Date().toISOString().split('T')[0]

const ProjectAssignmentSection = ({ employeeId, projectAssignments = [], canEdit, onSave }) => {
  const current = projectAssignments.find((a) => a.status === 'Active') || null
  const history = [...projectAssignments].reverse() // newest first

  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ project_name: '', assigned_date: today(), remarks: '' })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const openModal = () => {
    setForm({ project_name: '', assigned_date: today(), remarks: '' })
    setError('')
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.project_name.trim()) {
      setError('Project name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      try {
        await api.post(`/employees/${employeeId}/project-assignments`, form)
      } catch {
        await localEmployees.assignProject(employeeId, { ...form, assigned_by: 'HR' })
      }
      setShowModal(false)
      onSave()
    } catch (err) {
      setError(err.message || 'Failed to save project assignment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Current Assignment Card */}
      <CCard
        className={`mb-3 border-start border-4 ${current ? 'border-start-info' : 'border-start-secondary'}`}
      >
        <CCardBody className="py-3">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <div className="small text-body-secondary mb-1">Current Project Assignment</div>
              {current ? (
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <CBadge color="info" className="fs-6 px-3 py-1">
                    {current.project_name}
                  </CBadge>
                  <span className="text-body-secondary small">
                    Assigned {current.assigned_date}
                    {current.assigned_by && ` by ${current.assigned_by}`}
                  </span>
                </div>
              ) : (
                <span className="text-body-secondary">Not currently assigned to a project</span>
              )}
            </div>
            {canEdit && (
              <CButton color="primary" size="sm" onClick={openModal}>
                <CIcon icon={cilPlus} className="me-1" />
                {current ? 'Reassign Project' : 'Assign Project'}
              </CButton>
            )}
          </div>
          {current?.remarks && (
            <div className="small text-body-secondary mt-2">
              <span className="fw-semibold">Remarks: </span>
              {current.remarks}
            </div>
          )}
        </CCardBody>
      </CCard>

      {/* Assignment History */}
      {history.length > 0 && (
        <>
          <div className="fw-semibold small text-body-secondary mb-2">Assignment Log</div>
          <CTable hover responsive small>
            <CTableHead color="light">
              <CTableRow>
                <CTableHeaderCell>Project</CTableHeaderCell>
                <CTableHeaderCell>Assigned Date</CTableHeaderCell>
                <CTableHeaderCell>End Date</CTableHeaderCell>
                <CTableHeaderCell>Status</CTableHeaderCell>
                <CTableHeaderCell>Assigned By</CTableHeaderCell>
                <CTableHeaderCell>Remarks</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {history.map((a) => (
                <CTableRow key={a.id}>
                  <CTableDataCell className="fw-semibold">{a.project_name}</CTableDataCell>
                  <CTableDataCell>{a.assigned_date}</CTableDataCell>
                  <CTableDataCell>{a.end_date || '—'}</CTableDataCell>
                  <CTableDataCell>
                    <CBadge color={a.status === 'Active' ? 'success' : 'secondary'}>
                      {a.status}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell>{a.assigned_by || '—'}</CTableDataCell>
                  <CTableDataCell className="text-body-secondary small">
                    {a.remarks || '—'}
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        </>
      )}

      {history.length === 0 && !canEdit && (
        <p className="text-body-secondary small">No project assignment history.</p>
      )}

      {/* Assign / Reassign Modal */}
      <CModal visible={showModal} onClose={() => setShowModal(false)} backdrop="static">
        <CModalHeader>
          <CModalTitle>{current ? 'Reassign to New Project' : 'Assign Project'}</CModalTitle>
        </CModalHeader>
        <CForm onSubmit={handleSave}>
          <CModalBody>
            {error && <CAlert color="danger">{error}</CAlert>}

            {current && (
              <CAlert color="warning" className="small mb-3">
                Assigning a new project will end the current assignment to{' '}
                <strong>{current.project_name}</strong>. This change will be logged.
              </CAlert>
            )}

            <CRow className="g-3">
              <CCol md={12}>
                <CFormLabel className="fw-semibold">
                  Project Name <span className="text-danger">*</span>
                </CFormLabel>
                <CFormInput
                  value={form.project_name}
                  onChange={set('project_name')}
                  placeholder="e.g. Smart City Infrastructure Phase 2"
                  required
                />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Assigned Date</CFormLabel>
                <CFormInput
                  type="date"
                  value={form.assigned_date}
                  onChange={set('assigned_date')}
                />
              </CCol>
              <CCol md={12}>
                <CFormLabel>Remarks</CFormLabel>
                <CFormInput
                  value={form.remarks}
                  onChange={set('remarks')}
                  placeholder="Optional notes for the audit log"
                />
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton
              color="secondary"
              type="button"
              onClick={() => setShowModal(false)}
              disabled={saving}
            >
              Cancel
            </CButton>
            <CButton color="primary" type="submit" disabled={saving}>
              {saving && <CSpinner size="sm" className="me-2" />}
              {current ? 'Reassign' : 'Assign'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>
    </>
  )
}

ProjectAssignmentSection.propTypes = {
  employeeId: PropTypes.string.isRequired,
  projectAssignments: PropTypes.array,
  canEdit: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
}

export default ProjectAssignmentSection
