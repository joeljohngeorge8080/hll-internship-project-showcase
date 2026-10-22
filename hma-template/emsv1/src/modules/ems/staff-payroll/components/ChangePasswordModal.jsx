import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CInputGroup,
  CInputGroupText,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked } from '@coreui/icons'
import api from '../../../../services/api'

const ChangePasswordModal = ({ visible, onClose, employeeId, employeeName }) => {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSaving(true)
    try {
      await api.patch(`/employees/${employeeId}/password`, { new_password: newPassword })
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update password')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setNewPassword('')
    setConfirmPassword('')
    setError('')
    setSuccess(false)
    onClose()
  }

  return (
    <CModal visible={visible} onClose={handleClose} backdrop="static">
      <CModalHeader>
        <CModalTitle>
          <CIcon icon={cilLockLocked} className="me-2" />
          Change Password
        </CModalTitle>
      </CModalHeader>
      <CForm onSubmit={handleSave}>
        <CModalBody>
          {error && <CAlert color="danger">{error}</CAlert>}
          {success ? (
            <CAlert color="success">
              Password updated successfully for <strong>{employeeName}</strong>. The employee can
              now log in with the new password.
            </CAlert>
          ) : (
            <>
              <p className="text-body-secondary small mb-3">
                Setting a new password for <strong>{employeeName}</strong>. This action is logged in
                the audit trail.
              </p>
              <div className="mb-3">
                <CFormLabel className="fw-semibold">
                  New Password <span className="text-danger">*</span>
                </CFormLabel>
                <CInputGroup>
                  <CInputGroupText>
                    <CIcon icon={cilLockLocked} />
                  </CInputGroupText>
                  <CFormInput
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </CInputGroup>
              </div>
              <div className="mb-3">
                <CFormLabel className="fw-semibold">
                  Confirm Password <span className="text-danger">*</span>
                </CFormLabel>
                <CInputGroup>
                  <CInputGroupText>
                    <CIcon icon={cilLockLocked} />
                  </CInputGroupText>
                  <CFormInput
                    type="password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </CInputGroup>
              </div>
            </>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" type="button" onClick={handleClose} disabled={saving}>
            {success ? 'Close' : 'Cancel'}
          </CButton>
          {!success && (
            <CButton color="warning" type="submit" disabled={saving}>
              {saving && <CSpinner size="sm" className="me-2" />}
              Update Password
            </CButton>
          )}
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

ChangePasswordModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  employeeId: PropTypes.string.isRequired,
  employeeName: PropTypes.string.isRequired,
}

export default ChangePasswordModal
