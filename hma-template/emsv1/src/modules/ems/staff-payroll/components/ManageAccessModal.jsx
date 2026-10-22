import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CCol,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilPeople } from '@coreui/icons'
import api from '../../../../services/api'
import supabase from '../../../../services/supabase'
import { roleDisplayName } from '../../../../constants/roles'

const USER_ROLES = ['CEO', 'Heads', 'HR', 'Project Officer']

// profiles.role is the app_role Postgres enum (lowercase, snake_case) —
// see 00000000000001_extensions_and_helpers.sql. USER_ROLES above are the
// display labels shown in the picker.
const ROLE_TO_DB = {
  CEO: 'ceo',
  Heads: 'heads',
  HR: 'hr',
  'Project Officer': 'project_officer',
}

const ManageAccessModal = ({ visible, onClose, employeeId, employeeName, currentAccount }) => {
  const [googleEmail, setGoogleEmail] = useState('')
  const [role, setRole] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (visible && currentAccount) {
      setGoogleEmail(currentAccount.google_email || '')
      setRole(currentAccount.role || 'Project Officer')
      setNewPassword('')
      setConfirmPassword('')
    }
  }, [visible, currentAccount])

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (googleEmail && !emailRegex.test(googleEmail)) {
      setError('Invalid email address')
      return
    }
    if (newPassword && newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (newPassword && newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    const payload = {}
    if (googleEmail && googleEmail !== currentAccount?.google_email) {
      payload.google_email = googleEmail.trim().toLowerCase()
    }
    if (role && role !== currentAccount?.role) {
      payload.user_role = role
    }
    if (newPassword) {
      payload.new_password = newPassword
    }

    if (Object.keys(payload).length === 0) {
      setError('No changes detected')
      return
    }

    setSaving(true)
    try {
      try {
        await api.patch(`/employees/${employeeId}/account`, payload)
      } catch {
        // Password changes require Supabase Auth's admin API (service_role
        // key), which can never be called safely from this client — so this
        // fallback can only ever apply the email/role fields.
        if (payload.new_password) {
          throw new Error(
            'Password changes are not available right now — the account service is offline. Email and role changes can still be saved.',
          )
        }

        const { data: profileRow, error: findError } = await supabase
          .from('profiles')
          .select('id')
          .eq('employee_id', employeeId)
          .maybeSingle()
        if (findError) throw new Error(findError.message)
        if (!profileRow) throw new Error('No login account found for this employee')

        const patch = {}
        if (payload.google_email) patch.google_email = payload.google_email
        if (payload.user_role) patch.role = ROLE_TO_DB[payload.user_role] || payload.user_role

        const { data: updated, error: updateError } = await supabase
          .from('profiles')
          .update(patch)
          .eq('id', profileRow.id)
          .select()
        if (updateError) throw new Error(updateError.message)
        if (!updated?.length) {
          throw new Error('Only Admin can change another employee’s account access.')
        }
      }
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to update account access')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setGoogleEmail('')
    setRole('')
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
          <CIcon icon={cilPeople} className="me-2" />
          Manage Account Access
        </CModalTitle>
      </CModalHeader>
      <CForm onSubmit={handleSave}>
        <CModalBody>
          {error && <CAlert color="danger">{error}</CAlert>}

          {success ? (
            <CAlert color="success">
              Account access updated for <strong>{employeeName}</strong>. Changes take effect on the
              next login.
            </CAlert>
          ) : (
            <>
              <p className="text-body-secondary small mb-3">
                Managing system access for <strong>{employeeName}</strong>. The employee logs in
                using their assigned Google account. All changes are logged in the audit trail.
              </p>

              <CRow className="g-3">
                <CCol md={12}>
                  <CFormLabel className="fw-semibold">
                    Google Account (Gmail) <span className="text-danger">*</span>
                  </CFormLabel>
                  <CFormInput
                    type="email"
                    placeholder="employee@gmail.com"
                    value={googleEmail}
                    onChange={(e) => setGoogleEmail(e.target.value)}
                    autoComplete="off"
                  />
                  <div className="form-text">
                    The employee signs in using this Google account. Changing it revokes access for
                    the old account immediately.
                  </div>
                </CCol>

                <CCol md={12}>
                  <CFormLabel className="fw-semibold">
                    User Role <span className="text-danger">*</span>
                  </CFormLabel>
                  <CFormSelect value={role} onChange={(e) => setRole(e.target.value)} required>
                    {USER_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {roleDisplayName(r)}
                      </option>
                    ))}
                  </CFormSelect>
                  <div className="form-text">Controls what sections this employee can access.</div>
                </CCol>

                <CCol md={12}>
                  <hr className="my-1" />
                  <div className="small fw-semibold mb-1">
                    Change Password{' '}
                    <span className="text-body-secondary fw-normal">
                      (leave blank to keep current)
                    </span>
                  </div>
                  <div className="form-text mb-2">
                    Password changes require the account service to be online — if it&apos;s down,
                    leave this blank and save email/role changes separately.
                  </div>
                </CCol>

                <CCol md={6}>
                  <CFormLabel>New Password</CFormLabel>
                  <CInputGroup>
                    <CInputGroupText>
                      <CIcon icon={cilLockLocked} />
                    </CInputGroupText>
                    <CFormInput
                      type="password"
                      placeholder="Min 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </CInputGroup>
                </CCol>

                <CCol md={6}>
                  <CFormLabel>Confirm Password</CFormLabel>
                  <CInputGroup>
                    <CInputGroupText>
                      <CIcon icon={cilLockLocked} />
                    </CInputGroupText>
                    <CFormInput
                      type="password"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </CInputGroup>
                </CCol>
              </CRow>
            </>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" type="button" onClick={handleClose} disabled={saving}>
            {success ? 'Close' : 'Cancel'}
          </CButton>
          {!success && (
            <CButton color="primary" type="submit" disabled={saving}>
              {saving && <CSpinner size="sm" className="me-2" />}
              Save Access
            </CButton>
          )}
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

ManageAccessModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  employeeId: PropTypes.string.isRequired,
  employeeName: PropTypes.string.isRequired,
  currentAccount: PropTypes.shape({
    google_email: PropTypes.string,
    role: PropTypes.string,
  }),
}

export default ManageAccessModal
