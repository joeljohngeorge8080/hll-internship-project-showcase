import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CBadge,
  CButton,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'
import api from '../../../../services/api'
import { localEmployees } from '../../../../services/localEmployees'

const STATUS_COLORS = {
  Active: 'success',
  Inactive: 'secondary',
  Resigned: 'danger',
  Retired: 'warning',
  Deleted: 'dark',
}
const STATUSES = ['Active', 'Inactive', 'Resigned', 'Retired', 'Deleted']
const REQUIRES_EXIT = ['Resigned', 'Retired']

const ChangeStatusModal = ({
  visible,
  onClose,
  employeeId,
  employeeName,
  currentStatus,
  onSave,
  onDelete,
}) => {
  const [status, setStatus] = useState(currentStatus)
  const [exitDate, setExitDate] = useState('')
  const [remarks, setRemarks] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const needsExitDate = REQUIRES_EXIT.includes(status)
  const isDeleting = status === 'Deleted'

  const handleSave = async (e) => {
    e.preventDefault()
    if (needsExitDate && !exitDate) {
      setError('Exit date is required for this status')
      return
    }
    if (isDeleting && !remarks.trim()) {
      setError('Reason for deletion is required')
      return
    }
    if (isDeleting && !confirmed) {
      setError('Please confirm you want to delete this employee')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.patch(`/employees/${employeeId}/status`, {
        status,
        exit_date: exitDate || undefined,
        remarks: remarks || undefined,
      })
    } catch {
      // API not available — use local store
      try {
        await localEmployees.updateStatus(employeeId, {
          status,
          exit_date: exitDate || undefined,
          remarks: remarks || undefined,
        })
      } catch (localErr) {
        setError(localErr.message || 'Failed to update status')
        setSaving(false)
        return
      }
    }

    setSaving(false)
    if (isDeleting) {
      onDelete?.()
    } else {
      onSave()
      onClose()
    }
  }

  const handleClose = () => {
    setStatus(currentStatus)
    setExitDate('')
    setRemarks('')
    setConfirmed(false)
    setError('')
    onClose()
  }

  return (
    <CModal visible={visible} onClose={handleClose} backdrop="static">
      <CModalHeader>
        <CModalTitle>Change Employee Status</CModalTitle>
      </CModalHeader>
      <CForm onSubmit={handleSave}>
        <CModalBody>
          {error && <CAlert color="danger">{error}</CAlert>}

          <div className="mb-3">
            <span className="text-body-secondary small">Current Status: </span>
            <CBadge color={STATUS_COLORS[currentStatus] || 'secondary'} className="ms-1">
              {currentStatus}
            </CBadge>
          </div>

          <div className="mb-3">
            <CFormLabel className="fw-semibold">
              New Status <span className="text-danger">*</span>
            </CFormLabel>
            <CFormSelect
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setConfirmed(false)
                setError('')
              }}
              required
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === 'Deleted' ? 'Delete Employee' : s}
                </option>
              ))}
            </CFormSelect>
          </div>

          {needsExitDate && (
            <div className="mb-3">
              <CFormLabel className="fw-semibold">
                Exit Date <span className="text-danger">*</span>
              </CFormLabel>
              <CFormInput
                type="date"
                value={exitDate}
                onChange={(e) => setExitDate(e.target.value)}
                required
              />
            </div>
          )}

          <div className="mb-3">
            <CFormLabel className={isDeleting ? 'fw-semibold' : ''}>
              Remarks {isDeleting && <span className="text-danger">*</span>}
            </CFormLabel>
            <CFormInput
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={
                isDeleting ? 'Reason for deletion (required)' : 'Optional reason for status change'
              }
              required={isDeleting}
            />
          </div>

          {isDeleting && (
            <>
              <CAlert color="danger" className="mb-3">
                <strong>Warning: This action cannot be undone.</strong>
                <br />
                Deleting <strong>{employeeName || 'this employee'}</strong> will permanently mark
                their record as deleted and remove them from all active lists. This deletion will be
                recorded in the audit log.
              </CAlert>
              <div className="mb-3">
                <CFormCheck
                  id="confirm-delete"
                  label={`I confirm I want to delete ${employeeName || 'this employee'}`}
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
              </div>
            </>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" type="button" onClick={handleClose} disabled={saving}>
            Cancel
          </CButton>
          <CButton
            color={isDeleting ? 'danger' : 'primary'}
            type="submit"
            disabled={saving || status === currentStatus || (isDeleting && !confirmed)}
          >
            {saving && <CSpinner size="sm" className="me-2" />}
            {isDeleting ? 'Delete Employee' : 'Update Status'}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

ChangeStatusModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  employeeId: PropTypes.string.isRequired,
  employeeName: PropTypes.string,
  currentStatus: PropTypes.string.isRequired,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func,
}

export default ChangeStatusModal
