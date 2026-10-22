import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { CAlert, CButton, CCol, CForm, CFormInput, CFormLabel, CRow, CSpinner } from '@coreui/react'
import api from '../../../../services/api'
import { localEmployees } from '../../../../services/localEmployees'

const ContactTab = ({ employeeId, contact, canEdit, onSave }) => {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    personal_email: contact?.personal_email || '',
    working_email: contact?.working_email || '',
    mobile: contact?.mobile || '',
    phone: contact?.phone || '',
    emergency_contact: contact?.emergency_contact || '',
  })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.put(`/employees/${employeeId}/contact`, form)
      setEditing(false)
      onSave()
    } catch (err) {
      try {
        await localEmployees.update(employeeId, { contact: form })
        setEditing(false)
        onSave()
      } catch (localErr) {
        setError(err.response?.data?.detail || localErr.message || 'Save failed')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <CForm onSubmit={handleSave}>
      {error && <CAlert color="danger">{error}</CAlert>}
      <CRow className="g-3">
        <CCol md={6}>
          <CFormLabel>Personal Email</CFormLabel>
          <CFormInput
            type="email"
            value={form.personal_email}
            onChange={set('personal_email')}
            disabled={!editing}
          />
        </CCol>
        <CCol md={6}>
          <CFormLabel>Working Email *</CFormLabel>
          <CFormInput
            type="email"
            value={form.working_email}
            onChange={set('working_email')}
            disabled={!editing}
            required
          />
        </CCol>
        <CCol md={4}>
          <CFormLabel>Mobile Number *</CFormLabel>
          <CFormInput
            value={form.mobile}
            onChange={set('mobile')}
            disabled={!editing}
            required
            pattern="^\d{10}$"
            title="10-digit Mobile Number"
            maxLength={10}
            minLength={10}
          />
        </CCol>
        <CCol md={4}>
          <CFormLabel>Phone Number</CFormLabel>
          <CFormInput value={form.phone} onChange={set('phone')} disabled={!editing} />
        </CCol>
        <CCol md={4}>
          <CFormLabel>Emergency Contact</CFormLabel>
          <CFormInput
            value={form.emergency_contact}
            onChange={set('emergency_contact')}
            disabled={!editing}
          />
        </CCol>
      </CRow>
      {canEdit && (
        <div className="mt-3 d-flex gap-2">
          {editing ? (
            <>
              <CButton color="primary" type="submit" disabled={saving}>
                {saving && <CSpinner size="sm" className="me-2" />}
                Save
              </CButton>
              <CButton
                color="secondary"
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </CButton>
            </>
          ) : (
            <CButton
              color="primary"
              type="button"
              onClick={(e) => {
                e.preventDefault()
                setEditing(true)
              }}
            >
              Edit
            </CButton>
          )}
        </div>
      )}
    </CForm>
  )
}

ContactTab.propTypes = {
  employeeId: PropTypes.string.isRequired,
  contact: PropTypes.object,
  canEdit: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
}

export default ContactTab
